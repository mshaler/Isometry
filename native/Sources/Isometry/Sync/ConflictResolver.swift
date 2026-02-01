import Foundation
import CloudKit
import GRDB

/// Result of conflict resolution
public struct ResolvedConflict: Sendable {
    public let nodeId: String
    public let resolvedRecord: CKRecord
    public let strategy: ResolutionStrategy
    public let resolvedAt: Date
    public let wasAutomatic: Bool

    public init(nodeId: String, resolvedRecord: CKRecord, strategy: ResolutionStrategy, resolvedAt: Date = Date(), wasAutomatic: Bool = true) {
        self.nodeId = nodeId
        self.resolvedRecord = resolvedRecord
        self.strategy = strategy
        self.resolvedAt = resolvedAt
        self.wasAutomatic = wasAutomatic
    }
}

/// Strategy used for conflict resolution
public enum ResolutionStrategy: String, Sendable {
    case automaticMerge = "automatic_merge"
    case lastWriteWins = "last_write_wins"
    case fieldLevelMerge = "field_level_merge"
    case manualResolution = "manual_resolution"
    case keepBothVersions = "keep_both_versions"
}

/// User decision for manual conflict resolution
public struct ResolutionDecision: Sendable {
    public let strategy: ResolutionStrategy
    public let selectedRecord: CKRecord? // For manual selection
    public let fieldChoices: [String: String] // field name -> chosen value
    public let customMerge: CKRecord? // Fully custom merged record

    public init(strategy: ResolutionStrategy, selectedRecord: CKRecord? = nil, fieldChoices: [String: String] = [:], customMerge: CKRecord? = nil) {
        self.strategy = strategy
        self.selectedRecord = selectedRecord
        self.fieldChoices = fieldChoices
        self.customMerge = customMerge
    }
}

/// Diff information for UI display
public struct ConflictDiff: Sendable {
    public let nodeId: String
    public let fieldDiffs: [FieldDiff]
    public let conflictType: ConflictInfo.ConflictType
    public let canAutoResolve: Bool

    public init(nodeId: String, fieldDiffs: [FieldDiff], conflictType: ConflictInfo.ConflictType, canAutoResolve: Bool) {
        self.nodeId = nodeId
        self.fieldDiffs = fieldDiffs
        self.conflictType = conflictType
        self.canAutoResolve = canAutoResolve
    }
}

/// Individual field difference
public struct FieldDiff: Sendable {
    public let fieldName: String
    public let localValue: String?
    public let serverValue: String?
    public let conflicted: Bool
    public let autoResolved: Bool
    public let resolvedValue: String? // Value after auto-resolution

    public init(fieldName: String, localValue: String?, serverValue: String?, conflicted: Bool, autoResolved: Bool = false, resolvedValue: String? = nil) {
        self.fieldName = fieldName
        self.localValue = localValue
        self.serverValue = serverValue
        self.conflicted = conflicted
        self.autoResolved = autoResolved
        self.resolvedValue = resolvedValue
    }
}

/// Intelligent CloudKit conflict resolution engine with hybrid automatic/manual resolution
///
/// Implements CRDT-style automatic resolution for simple conflicts and provides manual resolution
/// preparation for complex cases. Uses field-level analysis and smart merging strategies.
public actor ConflictResolver {

    // MARK: - Configuration

    /// Fields that can be safely auto-merged using union strategy
    private let unionMergeFields = Set(["tags"])

    /// Fields that use last-edit-wins strategy
    private let lastEditWinsFields = Set(["content", "name", "summary"])

    /// Fields that are metadata and can use newer-wins strategy
    private let metadataFields = Set(["status", "priority", "importance", "folder"])

    /// Maximum age difference for automatic conflict resolution (5 minutes)
    private let autoResolutionWindow: TimeInterval = 300

    // MARK: - Dependencies

    private let database: CKDatabase
    private let localDatabase: IsometryDatabase

    // MARK: - Initialization

    public init(database: CKDatabase, localDatabase: IsometryDatabase) {
        self.database = database
        self.localDatabase = localDatabase
    }

    // MARK: - Automatic Resolution

    /// Resolves conflicts automatically using CRDT-style algorithms where possible
    /// Returns array of successfully resolved conflicts, leaves complex ones for manual resolution
    public func resolveAutomatically(conflicts: [ConflictInfo]) async throws -> [ResolvedConflict] {
        var resolved: [ResolvedConflict] = []

        for conflict in conflicts {
            if let resolvedRecord = try await attemptAutomaticResolution(conflict) {
                let resolvedConflict = ResolvedConflict(
                    nodeId: conflict.nodeId,
                    resolvedRecord: resolvedRecord,
                    strategy: .automaticMerge,
                    wasAutomatic: true
                )
                resolved.append(resolvedConflict)

                // Apply resolution to CloudKit and local database
                try await applyResolution(conflict: conflict, resolvedRecord: resolvedRecord, strategy: .automaticMerge)
            }
        }

        return resolved
    }

    /// Prepares manual resolution by analyzing conflicts and generating diffs for UI
    /// Provides detailed field-by-field comparison for user decision making
    public func prepareManualResolution(conflict: ConflictInfo) async throws -> ConflictDiff {
        let fieldDiffs = analyzeFieldDifferences(
            localRecord: conflict.localRecord,
            serverRecord: conflict.serverRecord
        )

        let canAutoResolve = fieldDiffs.allSatisfy { !$0.conflicted || $0.autoResolved }

        return ConflictDiff(
            nodeId: conflict.nodeId,
            fieldDiffs: fieldDiffs,
            conflictType: conflict.conflictType,
            canAutoResolve: canAutoResolve
        )
    }

    /// Applies user's manual resolution decision to both local and remote records
    /// Handles custom field choices, record selections, and merged records
    public func applyResolution(conflict: ConflictInfo, decision: ResolutionDecision) async throws {
        let resolvedRecord: CKRecord

        switch decision.strategy {
        case .manualResolution:
            guard let selectedRecord = decision.selectedRecord else {
                throw ConflictResolutionError.invalidDecision("No record selected for manual resolution")
            }
            resolvedRecord = selectedRecord

        case .fieldLevelMerge:
            resolvedRecord = try applyFieldChoices(
                baseRecord: conflict.serverRecord,
                fieldChoices: decision.fieldChoices,
                localRecord: conflict.localRecord
            )

        case .keepBothVersions:
            // Create a merged record that preserves both versions
            resolvedRecord = try createMergedRecord(
                localRecord: conflict.localRecord,
                serverRecord: conflict.serverRecord
            )

        case .lastWriteWins:
            let localModified = conflict.localRecord.modificationDate ?? Date.distantPast
            let serverModified = conflict.serverRecord.modificationDate ?? Date.distantPast
            resolvedRecord = localModified > serverModified ? conflict.localRecord : conflict.serverRecord

        default:
            resolvedRecord = decision.customMerge ?? conflict.serverRecord
        }

        try await applyResolution(conflict: conflict, resolvedRecord: resolvedRecord, strategy: decision.strategy)
    }

    // MARK: - Private Implementation

    /// Attempts automatic resolution for a single conflict
    /// Returns resolved record if successful, nil if manual resolution needed
    private func attemptAutomaticResolution(_ conflict: ConflictInfo) async throws -> CKRecord? {
        let localRecord = conflict.localRecord
        let serverRecord = conflict.serverRecord

        // Check if records are too different in modification time (requires manual review)
        let localModified = localRecord.modificationDate ?? Date.distantPast
        let serverModified = serverRecord.modificationDate ?? Date.distantPast
        let timeDiff = abs(localModified.timeIntervalSince(serverModified))

        if timeDiff > autoResolutionWindow {
            // Too much time difference - likely needs manual review
            return nil
        }

        // Start with the more recently modified record as base
        let baseRecord = localModified > serverModified ? localRecord.copy() as! CKRecord : serverRecord.copy() as! CKRecord

        var hasComplexConflicts = false

        // Analyze each field for automatic resolution
        let allKeys = Set(localRecord.allKeys()).union(Set(serverRecord.allKeys()))

        for key in allKeys {
            let localValue = localRecord[key]
            let serverValue = serverRecord[key]

            // Skip if values are identical
            if isEqualValue(localValue, serverValue) {
                continue
            }

            // Try automatic resolution based on field type
            if let resolvedValue = try await resolveField(
                key: key,
                localValue: localValue,
                serverValue: serverValue,
                localModified: localModified,
                serverModified: serverModified
            ) {
                baseRecord[key] = resolvedValue
            } else {
                // Complex conflict requiring manual resolution
                hasComplexConflicts = true
            }
        }

        // Return resolved record only if all conflicts could be auto-resolved
        if hasComplexConflicts {
            return nil
        }

        // Update metadata for resolved record
        baseRecord["conflictResolvedAt"] = Date()
        let currentVersion = baseRecord["syncVersion"] as? Int ?? 0
        baseRecord["syncVersion"] = currentVersion + 1

        return baseRecord
    }

    /// Resolves a single field automatically if possible
    private func resolveField(
        key: String,
        localValue: CKRecordValue?,
        serverValue: CKRecordValue?,
        localModified: Date,
        serverModified: Date
    ) async throws -> CKRecordValue? {

        // Handle union merge fields (like tags)
        if unionMergeFields.contains(key) {
            return try mergeArrayValues(localValue: localValue, serverValue: serverValue)
        }

        // Handle last-edit-wins fields
        if lastEditWinsFields.contains(key) {
            return localModified > serverModified ? localValue : serverValue
        }

        // Handle metadata fields (use newer value)
        if metadataFields.contains(key) {
            return localModified > serverModified ? localValue : serverValue
        }

        // For other fields, can't auto-resolve
        return nil
    }

    /// Merges array values using union strategy
    private func mergeArrayValues(localValue: CKRecordValue?, serverValue: CKRecordValue?) throws -> CKRecordValue? {
        guard let localArray = localValue as? [String], let serverArray = serverValue as? [String] else {
            // Not arrays or different types - can't auto-merge
            return nil
        }

        let mergedSet = Set(localArray).union(Set(serverArray))
        return Array(mergedSet).sorted()
    }

    /// Checks if two CloudKit values are equal
    private func isEqualValue(_ value1: CKRecordValue?, _ value2: CKRecordValue?) -> Bool {
        switch (value1, value2) {
        case (nil, nil):
            return true
        case let (str1 as String, str2 as String):
            return str1 == str2
        case let (int1 as Int, int2 as Int):
            return int1 == int2
        case let (date1 as Date, date2 as Date):
            return date1 == date2
        case let (array1 as [String], array2 as [String]):
            return array1.sorted() == array2.sorted()
        default:
            return false
        }
    }

    /// Analyzes field differences between local and server records
    private func analyzeFieldDifferences(localRecord: CKRecord, serverRecord: CKRecord) -> [FieldDiff] {
        let allKeys = Set(localRecord.allKeys()).union(Set(serverRecord.allKeys()))
        var diffs: [FieldDiff] = []

        for key in allKeys.sorted() {
            let localValue = localRecord[key]
            let serverValue = serverRecord[key]

            let conflicted = !isEqualValue(localValue, serverValue)
            var autoResolved = false
            var resolvedValue: String? = nil

            // Check if this field can be auto-resolved
            if conflicted {
                let localModified = localRecord.modificationDate ?? Date.distantPast
                let serverModified = serverRecord.modificationDate ?? Date.distantPast

                if let resolved = try? await resolveField(
                    key: key,
                    localValue: localValue,
                    serverValue: serverValue,
                    localModified: localModified,
                    serverModified: serverModified
                ) {
                    autoResolved = true
                    resolvedValue = "\(resolved)"
                }
            }

            let diff = FieldDiff(
                fieldName: key,
                localValue: localValue.map { "\($0)" },
                serverValue: serverValue.map { "\($0)" },
                conflicted: conflicted,
                autoResolved: autoResolved,
                resolvedValue: resolvedValue
            )
            diffs.append(diff)
        }

        return diffs
    }

    /// Applies field choices to create resolved record
    private func applyFieldChoices(baseRecord: CKRecord, fieldChoices: [String: String], localRecord: CKRecord) throws -> CKRecord {
        let resolved = baseRecord.copy() as! CKRecord

        for (fieldName, choice) in fieldChoices {
            switch choice {
            case "local":
                resolved[fieldName] = localRecord[fieldName]
            case "server":
                resolved[fieldName] = baseRecord[fieldName]
            case "both":
                // For array fields, merge them
                if unionMergeFields.contains(fieldName) {
                    let mergedValue = try? mergeArrayValues(
                        localValue: localRecord[fieldName],
                        serverValue: baseRecord[fieldName]
                    )
                    resolved[fieldName] = mergedValue
                }
            default:
                // Custom value
                resolved[fieldName] = choice
            }
        }

        return resolved
    }

    /// Creates a merged record that preserves both versions
    private func createMergedRecord(localRecord: CKRecord, serverRecord: CKRecord) throws -> CKRecord {
        let merged = serverRecord.copy() as! CKRecord

        // Use field-level merging with preference for local changes
        let localModified = localRecord.modificationDate ?? Date.distantPast
        let serverModified = serverRecord.modificationDate ?? Date.distantPast

        for key in Set(localRecord.allKeys()).union(Set(serverRecord.allKeys())) {
            if unionMergeFields.contains(key) {
                // Merge arrays
                if let mergedValue = try? mergeArrayValues(
                    localValue: localRecord[key],
                    serverValue: serverRecord[key]
                ) {
                    merged[key] = mergedValue
                }
            } else {
                // Use newer value for other fields
                merged[key] = localModified > serverModified ? localRecord[key] : serverRecord[key]
            }
        }

        return merged
    }

    /// Applies resolved record to both CloudKit and local database
    private func applyResolution(conflict: ConflictInfo, resolvedRecord: CKRecord, strategy: ResolutionStrategy) async throws {
        // Update CloudKit record
        let (savedRecord, _) = try await database.modifyRecords(
            saving: [resolvedRecord],
            deleting: [],
            savePolicy: .changedKeys,
            atomically: true
        )

        // Verify save was successful
        guard let result = savedRecord[resolvedRecord.recordID],
              case .success = result else {
            throw ConflictResolutionError.saveFailure("Failed to save resolved record to CloudKit")
        }

        // Update local database
        if let node = recordToNode(resolvedRecord) {
            try await localDatabase.updateNode(node)
        }

        print("ConflictResolver: Applied resolution for \(conflict.nodeId) using \(strategy)")
    }

    /// Converts CloudKit record to Node for local database update
    private func recordToNode(_ record: CKRecord) -> Node? {
        guard let name = record["name"] as? String else { return nil }

        var tags: [String] = []
        if let tagsArray = record["tags"] as? [String] {
            tags = tagsArray
        }

        return Node(
            id: record.recordID.recordName,
            nodeType: record["nodeType"] as? String ?? "note",
            name: name,
            content: record["content"] as? String,
            summary: record["summary"] as? String,
            createdAt: record["createdAt"] as? Date ?? Date(),
            modifiedAt: record["modifiedAt"] as? Date ?? Date(),
            folder: record["folder"] as? String,
            tags: tags,
            status: record["status"] as? String,
            priority: record["priority"] as? Int ?? 0,
            importance: record["importance"] as? Int ?? 0,
            sortOrder: record["sortOrder"] as? Int ?? 0,
            version: record["version"] as? Int ?? 1,
            syncVersion: record["syncVersion"] as? Int ?? 0,
            lastSyncedAt: Date(),
            conflictResolvedAt: record["conflictResolvedAt"] as? Date
        )
    }

    // MARK: - CRDT Integration (Phase 20-02)

    /// Resolves conflicts using CRDT metadata for deterministic resolution
    /// Integrates with existing CloudKit conflict resolution but uses CRDT timestamps
    public func resolveCRDTConflict(
        local: Node,
        remote: Node,
        localCRDT: CRDTNode,
        remoteCRDT: CRDTNode
    ) async throws -> ResolvedConflict {

        // Use CRDT comparison for deterministic resolution
        let comparison = localCRDT.compare(with: remoteCRDT)

        var resolvedNode: Node
        let strategy: ResolutionStrategy

        switch comparison {
        case .happensBefore:
            // Local is newer
            resolvedNode = local
            strategy = .lastWriteWins

        case .happensAfter:
            // Remote is newer
            resolvedNode = remote
            strategy = .lastWriteWins

        case .concurrent:
            // Simultaneous edits - check if field-level merge is possible
            let conflictType = localCRDT.conflictType(with: remoteCRDT)

            switch conflictType {
            case .noConflict:
                // Use newer timestamp
                resolvedNode = localCRDT.lastWriteWins > remoteCRDT.lastWriteWins ? local : remote
                strategy = .lastWriteWins

            case .fieldLevelMergeable:
                // Merge non-conflicting fields
                resolvedNode = try await mergeCRDTFields(local: local, remote: remote, localCRDT: localCRDT, remoteCRDT: remoteCRDT)
                strategy = .fieldLevelMerge

            case .contentConflict:
                // True conflict - use last-write-wins with site ID tiebreaker
                if localCRDT.lastWriteWins == remoteCRDT.lastWriteWins {
                    // Site ID tiebreaker for deterministic resolution
                    resolvedNode = localCRDT.siteId > remoteCRDT.siteId ? local : remote
                } else {
                    resolvedNode = localCRDT.lastWriteWins > remoteCRDT.lastWriteWins ? local : remote
                }
                strategy = .lastWriteWins
            }
        }

        // Update sync metadata
        resolvedNode.syncVersion = max(local.syncVersion, remote.syncVersion) + 1
        resolvedNode.conflictResolvedAt = Date()

        // Convert to CloudKit record for existing infrastructure
        let resolvedRecord = nodeToCloudKitRecord(resolvedNode)

        return ResolvedConflict(
            nodeId: resolvedNode.id,
            resolvedRecord: resolvedRecord,
            strategy: strategy,
            resolvedAt: Date(),
            wasAutomatic: true
        )
    }

    /// Merges CRDT fields for field-level mergeable conflicts
    private func mergeCRDTFields(
        local: Node,
        remote: Node,
        localCRDT: CRDTNode,
        remoteCRDT: CRDTNode
    ) async throws -> Node {

        var merged = local
        let localFields = Set(localCRDT.modifiedFields)
        let remoteFields = Set(remoteCRDT.modifiedFields)

        // Apply changes from non-overlapping fields
        for field in localFields.union(remoteFields) {
            if localFields.contains(field) && !remoteFields.contains(field) {
                // Only local modified - keep local value
                continue
            } else if remoteFields.contains(field) && !localFields.contains(field) {
                // Only remote modified - use remote value
                applyCRDTFieldChange(to: &merged, from: remote, field: field)
            } else if localFields.contains(field) && remoteFields.contains(field) {
                // Both modified - use timestamp with site ID tiebreaker
                if localCRDT.lastWriteWins > remoteCRDT.lastWriteWins ||
                   (localCRDT.lastWriteWins == remoteCRDT.lastWriteWins && localCRDT.siteId > remoteCRDT.siteId) {
                    // Keep local value
                    continue
                } else {
                    // Use remote value
                    applyCRDTFieldChange(to: &merged, from: remote, field: field)
                }
            }
        }

        // Special handling for array fields (tags) - use union
        if localFields.contains("tags") || remoteFields.contains("tags") {
            let mergedTags = Set(local.tags).union(Set(remote.tags))
            merged.tags = Array(mergedTags).sorted()
        }

        return merged
    }

    /// Applies a single field change from source to target node
    private func applyCRDTFieldChange(to target: inout Node, from source: Node, field: String) {
        switch field {
        case "name":
            target.name = source.name
        case "content":
            target.content = source.content
        case "summary":
            target.summary = source.summary
        case "folder":
            target.folder = source.folder
        case "tags":
            target.tags = source.tags
        case "status":
            target.status = source.status
        case "priority":
            target.priority = source.priority
        case "importance":
            target.importance = source.importance
        default:
            break // Unknown field
        }
    }

    /// Converts Node to CloudKit record for compatibility with existing infrastructure
    private func nodeToCloudKitRecord(_ node: Node) -> CKRecord {
        let recordID = CKRecord.ID(recordName: node.id)
        let record = CKRecord(recordType: "Node", recordID: recordID)

        record["name"] = node.name
        record["content"] = node.content
        record["summary"] = node.summary
        record["folder"] = node.folder
        record["status"] = node.status
        record["priority"] = node.priority
        record["importance"] = node.importance
        record["syncVersion"] = node.syncVersion
        record["modifiedAt"] = node.modifiedAt
        record["conflictResolvedAt"] = node.conflictResolvedAt

        // Encode tags as JSON for CloudKit
        if !node.tags.isEmpty {
            record["tags"] = node.tags
        }

        return record
    }
}

// MARK: - Error Types

public enum ConflictResolutionError: LocalizedError, Sendable {
    case invalidDecision(String)
    case saveFailure(String)
    case mergeFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidDecision(let message):
            return "Invalid resolution decision: \(message)"
        case .saveFailure(let message):
            return "Failed to save resolution: \(message)"
        case .mergeFailed(let message):
            return "Failed to merge records: \(message)"
        }
    }
}