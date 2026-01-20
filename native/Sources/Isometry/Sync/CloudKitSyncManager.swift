import Foundation
import CloudKit

/// Errors that can occur during CloudKit sync
public enum SyncError: LocalizedError, Sendable {
    case notAuthenticated
    case networkUnavailable
    case serverError(underlying: Error)
    case quotaExceeded
    case zoneNotFound
    case recordNotFound(recordId: String)
    case conflictDetected(localVersion: Int, serverVersion: Int)
    case retryLater(retryAfter: TimeInterval)

    public var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not signed in to iCloud"
        case .networkUnavailable:
            return "Network unavailable"
        case .serverError(let error):
            return "Server error: \(error.localizedDescription)"
        case .quotaExceeded:
            return "iCloud storage quota exceeded"
        case .zoneNotFound:
            return "Sync zone not found"
        case .recordNotFound(let id):
            return "Record not found: \(id)"
        case .conflictDetected(let local, let server):
            return "Conflict: local v\(local) vs server v\(server)"
        case .retryLater(let seconds):
            return "Retry after \(Int(seconds)) seconds"
        }
    }
}

/// Conflict resolution strategy
public enum ConflictResolutionStrategy: Sendable {
    /// Server version always wins (default for simplicity)
    case serverWins
    /// Local version always wins
    case localWins
    /// Most recently modified version wins
    case latestWins
    /// Merge field-by-field, preferring newer values
    case fieldLevelMerge
    /// Queue for manual resolution
    case manualResolution
}

/// Represents a sync conflict requiring resolution
public struct SyncConflict: Sendable {
    public let nodeId: String
    public let localNode: Node
    public let serverNode: Node
    public let detectedAt: Date
    public let conflictType: ConflictType

    public enum ConflictType: String, Sendable {
        case bothModified = "both_modified"
        case localDeleted = "local_deleted"
        case serverDeleted = "server_deleted"
        case versionMismatch = "version_mismatch"
    }
}

/// Result of conflict resolution
public struct ConflictResolution: Sendable {
    public let nodeId: String
    public let resolvedNode: Node
    public let strategy: ConflictResolutionStrategy
    public let resolvedAt: Date
}

/// Thread-safe CloudKit sync manager
///
/// Handles bidirectional sync between local SQLite and CloudKit.
/// Uses exponential backoff for retries and change tokens for incremental sync.
public actor CloudKitSyncManager {
    // MARK: - Configuration

    public static let containerIdentifier = "iCloud.com.cardboard.app"
    public static let zoneName = "IsometryZone"
    public static let subscriptionID = "isometry-changes"

    // MARK: - Properties

    private let container: CKContainer
    private let database: CKDatabase
    private let zone: CKRecordZone
    private let localDatabase: IsometryDatabase

    private var changeToken: CKServerChangeToken?
    private var consecutiveFailures = 0
    private var isSyncing = false

    // Exponential backoff settings
    private let baseRetryDelay: TimeInterval = 1.0
    private let maxRetryDelay: TimeInterval = 300.0 // 5 minutes
    private let maxRetries = 5

    // Conflict resolution
    private var conflictStrategy: ConflictResolutionStrategy = .latestWins
    private var pendingConflicts: [SyncConflict] = []

    // MARK: - Configuration

    /// Sets the conflict resolution strategy
    public func setConflictResolutionStrategy(_ strategy: ConflictResolutionStrategy) {
        self.conflictStrategy = strategy
    }

    /// Returns any pending conflicts requiring manual resolution
    public func getPendingConflicts() -> [SyncConflict] {
        return pendingConflicts
    }

    /// Manually resolves a conflict with a chosen node
    public func resolveConflict(nodeId: String, with resolvedNode: Node) async throws {
        try await localDatabase.updateNode(resolvedNode)
        pendingConflicts.removeAll { $0.nodeId == nodeId }

        // Mark as conflict resolved
        var updatedNode = resolvedNode
        updatedNode.conflictResolvedAt = Date()
        updatedNode.syncVersion += 1
        try await localDatabase.updateNode(updatedNode)
    }

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.localDatabase = database
        self.container = CKContainer(identifier: Self.containerIdentifier)
        self.database = container.privateCloudDatabase
        self.zone = CKRecordZone(zoneName: Self.zoneName)
    }

    // MARK: - Setup

    /// Creates the sync zone if it doesn't exist
    public func setupZone() async throws {
        do {
            _ = try await database.save(zone)
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Zone already exists, this is fine
        }
    }

    /// Subscribes to changes for push notifications
    public func subscribeToChanges() async throws {
        let subscription = CKDatabaseSubscription(subscriptionID: Self.subscriptionID)

        let notificationInfo = CKSubscription.NotificationInfo()
        notificationInfo.shouldSendContentAvailable = true
        subscription.notificationInfo = notificationInfo

        do {
            _ = try await database.save(subscription)
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Subscription already exists
        }
    }

    // MARK: - Sync Operations

    /// Performs a full sync cycle: push local changes, then pull remote changes
    public func sync() async throws {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            try await pushChanges()
            try await pullChanges()
            consecutiveFailures = 0

            // Update sync state
            var state = try await localDatabase.getSyncState()
            state.lastSyncAt = Date()
            state.consecutiveFailures = 0
            state.lastError = nil
            state.lastErrorAt = nil
            try await localDatabase.updateSyncState(state)

        } catch {
            consecutiveFailures += 1

            // Update sync state with error
            var state = try await localDatabase.getSyncState()
            state.consecutiveFailures = consecutiveFailures
            state.lastError = error.localizedDescription
            state.lastErrorAt = Date()
            try await localDatabase.updateSyncState(state)

            throw error
        }
    }

    /// Pushes local changes to CloudKit
    private func pushChanges() async throws {
        let pendingNodes = try await localDatabase.getPendingChanges(since: 0)

        guard !pendingNodes.isEmpty else { return }

        let records = pendingNodes.map { nodeToRecord($0) }

        let operation = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: nil)
        operation.savePolicy = .changedKeys
        operation.qualityOfService = .userInitiated

        do {
            let (savedResults, _) = try await database.modifyRecords(
                saving: records,
                deleting: [],
                savePolicy: .changedKeys,
                atomically: false
            )

            // Update sync versions for successfully saved records
            for (recordID, result) in savedResults {
                switch result {
                case .success:
                    // Mark as synced in local database
                    if var node = try await localDatabase.getNode(id: recordID.recordName) {
                        node.lastSyncedAt = Date()
                        try await localDatabase.updateNode(node)
                    }
                case .failure(let error):
                    throw error
                }
            }
        } catch let error as CKError {
            throw mapCKError(error)
        }
    }

    /// Pulls remote changes from CloudKit
    private func pullChanges() async throws {
        let zoneID = zone.zoneID

        let configuration = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
        configuration.previousServerChangeToken = changeToken

        var changedRecords: [CKRecord] = []
        var deletedRecordIDs: [CKRecord.ID] = []

        let (modificationResultsByID, deletions, changeToken, _) = try await database.recordZoneChanges(
            inZoneWith: zoneID,
            since: self.changeToken
        )

        // Process modifications
        for (_, result) in modificationResultsByID {
            switch result {
            case .success(let modification):
                changedRecords.append(modification.record)
            case .failure(let error):
                // Log but continue processing
                print("Failed to fetch record: \(error)")
            }
        }

        // Process deletions
        for deletion in deletions {
            deletedRecordIDs.append(deletion.recordID)
        }

        // Apply changes to local database with conflict resolution
        for record in changedRecords {
            if let serverNode = recordToNode(record) {
                if let localNode = try await localDatabase.getNode(id: serverNode.id) {
                    // Check for conflict: both modified since last sync
                    let localModifiedSinceSync = localNode.lastSyncedAt == nil ||
                        localNode.modifiedAt > (localNode.lastSyncedAt ?? .distantPast)
                    let hasConflict = localModifiedSinceSync && serverNode.syncVersion != localNode.syncVersion

                    if hasConflict {
                        let resolvedNode = try await resolveConflict(
                            local: localNode,
                            server: serverNode
                        )
                        if let resolved = resolvedNode {
                            try await localDatabase.updateNode(resolved)
                        }
                    } else if serverNode.syncVersion > localNode.syncVersion {
                        // No conflict, server is newer - apply update
                        try await localDatabase.updateNode(serverNode)
                    }
                    // If local is newer (syncVersion >= server), keep local
                } else {
                    // New record from server
                    try await localDatabase.createNode(serverNode)
                }
            }
        }

        // Apply deletions
        for recordID in deletedRecordIDs {
            try await localDatabase.deleteNode(id: recordID.recordName)
        }

        // Save change token
        self.changeToken = changeToken
    }

    // MARK: - Conflict Resolution

    /// Resolves a conflict between local and server versions based on the current strategy
    private func resolveConflict(local: Node, server: Node) async throws -> Node? {
        switch conflictStrategy {
        case .serverWins:
            return server

        case .localWins:
            // Return local but increment sync version to push our changes
            var resolved = local
            resolved.syncVersion = server.syncVersion + 1
            return resolved

        case .latestWins:
            // Compare modification timestamps
            if local.modifiedAt > server.modifiedAt {
                var resolved = local
                resolved.syncVersion = server.syncVersion + 1
                return resolved
            } else {
                return server
            }

        case .fieldLevelMerge:
            // Merge fields, preferring newer values for each
            let merged = mergeNodes(local: local, server: server)
            return merged

        case .manualResolution:
            // Queue for manual resolution, don't update yet
            let conflict = SyncConflict(
                nodeId: local.id,
                localNode: local,
                serverNode: server,
                detectedAt: Date(),
                conflictType: .bothModified
            )
            pendingConflicts.append(conflict)

            // Update sync state to indicate pending conflicts
            var state = try await localDatabase.getSyncState()
            state.conflictCount = pendingConflicts.count
            try await localDatabase.updateSyncState(state)

            return nil // Don't update automatically
        }
    }

    /// Merges two nodes field-by-field, preferring more recent changes
    private func mergeNodes(local: Node, server: Node) -> Node {
        // Use the more recent modification as the base
        var merged = local.modifiedAt > server.modifiedAt ? local : server

        // For text content, use the most recently modified version
        if local.modifiedAt > server.modifiedAt {
            merged.content = local.content
            merged.name = local.name
            merged.summary = local.summary
        }

        // For status fields, prefer the most recent
        merged.status = local.modifiedAt > server.modifiedAt ? local.status : server.status
        merged.priority = local.modifiedAt > server.modifiedAt ? local.priority : server.priority

        // Merge tags: union of both sets
        let allTags = Set(local.tags).union(Set(server.tags))
        merged.tags = Array(allTags).sorted()

        // Increment version to mark as merged
        merged.version = max(local.version, server.version) + 1
        merged.syncVersion = max(local.syncVersion, server.syncVersion) + 1
        merged.conflictResolvedAt = Date()

        return merged
    }

    // MARK: - Record Conversion

    private func nodeToRecord(_ node: Node) -> CKRecord {
        let recordID = CKRecord.ID(recordName: node.id, zoneID: zone.zoneID)
        let record = CKRecord(recordType: "Node", recordID: recordID)

        record["nodeType"] = node.nodeType
        record["name"] = node.name
        record["content"] = node.content
        record["summary"] = node.summary
        record["folder"] = node.folder
        record["status"] = node.status
        record["priority"] = node.priority
        record["importance"] = node.importance
        record["sortOrder"] = node.sortOrder
        record["version"] = node.version
        record["syncVersion"] = node.syncVersion
        record["createdAt"] = node.createdAt
        record["modifiedAt"] = node.modifiedAt

        if let tags = try? JSONEncoder().encode(node.tags),
           let tagsString = String(data: tags, encoding: .utf8) {
            record["tags"] = tagsString
        }

        return record
    }

    private func recordToNode(_ record: CKRecord) -> Node? {
        guard let name = record["name"] as? String else { return nil }

        var tags: [String] = []
        if let tagsString = record["tags"] as? String,
           let data = tagsString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            tags = decoded
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
            lastSyncedAt: Date()
        )
    }

    // MARK: - Error Handling

    private func mapCKError(_ error: CKError) -> SyncError {
        switch error.code {
        case .notAuthenticated:
            return .notAuthenticated
        case .networkUnavailable, .networkFailure:
            return .networkUnavailable
        case .quotaExceeded:
            return .quotaExceeded
        case .zoneNotFound:
            return .zoneNotFound
        case .serverRecordChanged:
            return .conflictDetected(localVersion: 0, serverVersion: 0)
        case .requestRateLimited, .serviceUnavailable:
            let retryAfter = error.retryAfterSeconds ?? 60
            return .retryLater(retryAfter: retryAfter)
        default:
            return .serverError(underlying: error)
        }
    }

    /// Calculates retry delay using exponential backoff
    private func retryDelay(attempt: Int) -> TimeInterval {
        let delay = baseRetryDelay * pow(2.0, Double(attempt - 1))
        return min(delay, maxRetryDelay)
    }
}
