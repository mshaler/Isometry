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
/// Supports chunked uploads (400 records per operation) and progress tracking.
public actor CloudKitSyncManager {
    // MARK: - Configuration

    public static let containerIdentifier = "iCloud.com.cardboard.app"
    public static let zoneName = "IsometryZone"
    public static let subscriptionID = "isometry-changes"

    /// CloudKit limit for records per operation
    public static let recordsPerChunk = 400

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

    // MARK: - Progress Tracking

    /// Current sync progress (0.0 to 1.0)
    private var _syncProgress: Double = 0.0

    /// Total records to sync in current operation
    private var totalRecordsToSync: Int = 0

    /// Records synced so far in current operation
    private var recordsSynced: Int = 0

    /// Progress update callback for UI binding (main-actor isolated)
    private var _onProgressUpdate: (@MainActor @Sendable (Double) -> Void)?

    /// Current sync progress (0.0 to 1.0)
    public var syncProgress: Double {
        _syncProgress
    }

    /// Whether a sync operation is in progress
    public var isSyncInProgress: Bool {
        isSyncing
    }

    /// Sets the progress update callback (called from main actor)
    public func setProgressCallback(_ callback: @escaping @MainActor @Sendable (Double) -> Void) {
        _onProgressUpdate = callback
    }

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
        updateProgress(0.0)
        defer {
            isSyncing = false
            updateProgress(1.0)
        }

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

            updateProgress(1.0)

        } catch {
            consecutiveFailures += 1

            // Update sync state with error
            var state = try await localDatabase.getSyncState()
            state.consecutiveFailures = consecutiveFailures
            state.lastError = error.localizedDescription
            state.lastErrorAt = Date()
            try await localDatabase.updateSyncState(state)

            updateProgress(0.0) // Reset on error

            throw error
        }
    }

    /// Pushes local changes to CloudKit using chunked uploads
    /// CloudKit has a limit of 400 records per operation
    private func pushChanges() async throws {
        let pendingNodes = try await localDatabase.getPendingChanges(since: 0)

        guard !pendingNodes.isEmpty else {
            updateProgress(1.0)
            return
        }

        let records = pendingNodes.map { nodeToRecord($0) }
        totalRecordsToSync = records.count
        recordsSynced = 0
        updateProgress(0.0)

        // Chunk records into batches of 400 (CloudKit limit)
        let chunks = stride(from: 0, to: records.count, by: Self.recordsPerChunk).map {
            Array(records[$0..<min($0 + Self.recordsPerChunk, records.count)])
        }

        for (chunkIndex, chunk) in chunks.enumerated() {
            try await pushRecordChunk(chunk, chunkIndex: chunkIndex, totalChunks: chunks.count)
        }

        updateProgress(1.0)
    }

    /// Pushes a single chunk of records to CloudKit with retry logic
    private func pushRecordChunk(_ records: [CKRecord], chunkIndex: Int, totalChunks: Int, retryAttempt: Int = 0) async throws {
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
                    recordsSynced += 1
                case .failure(let error):
                    // Handle partial failure - continue with other records
                    if let ckError = error as? CKError {
                        let mappedError = mapCKError(ckError)
                        if case .retryLater = mappedError {
                            // Don't throw, just log - we'll handle retries at chunk level
                            print("Record \(recordID.recordName) failed, will retry: \(error)")
                        }
                    }
                }
            }

            // Update progress
            let progressPerChunk = 0.5 / Double(totalChunks) // Push is first 50%
            updateProgress(Double(chunkIndex + 1) * progressPerChunk)

        } catch let error as CKError {
            let mappedError = mapCKError(error)

            // Handle retryable errors with exponential backoff
            if case .retryLater(let retryAfter) = mappedError, retryAttempt < maxRetries {
                let delay = max(retryAfter, retryDelay(attempt: retryAttempt + 1))
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                try await pushRecordChunk(records, chunkIndex: chunkIndex, totalChunks: totalChunks, retryAttempt: retryAttempt + 1)
                return
            }

            // Handle rate limiting
            if error.code == .requestRateLimited || error.code == .serviceUnavailable {
                if retryAttempt < maxRetries {
                    let delay = retryDelay(attempt: retryAttempt + 1)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    try await pushRecordChunk(records, chunkIndex: chunkIndex, totalChunks: totalChunks, retryAttempt: retryAttempt + 1)
                    return
                }
            }

            throw mappedError
        }
    }

    /// Updates sync progress and notifies callback
    private func updateProgress(_ progress: Double) {
        _syncProgress = min(max(progress, 0.0), 1.0)
        let currentProgress = _syncProgress
        if let callback = _onProgressUpdate {
            Task { @MainActor in
                callback(currentProgress)
            }
        }
    }

    /// Pushes pending NotebookCard changes to CloudKit
    /// TODO: Integrate with main sync flow in Phase 6.2
    public func pushNotebookCards() async throws {
        let pendingCards = try await localDatabase.getAllNotebookCards()
            .filter { $0.lastSyncedAt == nil || $0.modifiedAt > ($0.lastSyncedAt ?? .distantPast) }

        guard !pendingCards.isEmpty else {
            return
        }

        let records = pendingCards.map { notebookCardToRecord($0) }

        // Use existing chunk upload pattern
        let chunks = stride(from: 0, to: records.count, by: Self.recordsPerChunk).map {
            Array(records[$0..<min($0 + Self.recordsPerChunk, records.count)])
        }

        for (index, chunk) in chunks.enumerated() {
            try await pushNotebookCardChunk(chunk, chunkIndex: index, totalChunks: chunks.count)
        }
    }

    /// Pushes a single chunk of NotebookCard records to CloudKit
    private func pushNotebookCardChunk(_ records: [CKRecord], chunkIndex: Int, totalChunks: Int, retryAttempt: Int = 0) async throws {
        let maxRetries = 3

        do {
            let operation = CKModifyRecordsOperation(
                recordsToSave: records,
                recordIDsToDelete: nil
            )
            operation.savePolicy = .changedKeys
            operation.qualityOfService = .userInitiated

            // Async/await wrapper for CloudKit operation
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                operation.modifyRecordsResultBlock = { result in
                    switch result {
                    case .success:
                        continuation.resume()
                    case .failure(let error):
                        continuation.resume(throwing: error)
                    }
                }

                database.add(operation)
            }

            // Update sync metadata for uploaded cards
            for record in records {
                let cardId = record.recordID.recordName
                if let card = try await localDatabase.getNotebookCard(id: cardId) {
                    let syncedCard = NotebookCard(
                        id: card.id,
                        title: card.title,
                        markdownContent: card.markdownContent,
                        properties: card.properties,
                        templateId: card.templateId,
                        createdAt: card.createdAt,
                        modifiedAt: card.modifiedAt,
                        folder: card.folder,
                        tags: card.tags,
                        linkedNodeId: card.linkedNodeId,
                        syncVersion: card.syncVersion,
                        lastSyncedAt: Date(),
                        conflictResolvedAt: card.conflictResolvedAt,
                        deletedAt: card.deletedAt
                    )
                    try await localDatabase.updateNotebookCard(syncedCard)
                }
            }

        } catch {
            // Handle retry logic similar to Node sync
            if let ckError = error as? CKError {
                if ckError.code == .requestRateLimited || ckError.code == .serviceUnavailable {
                    if retryAttempt < maxRetries {
                        let delay = retryDelay(attempt: retryAttempt + 1)
                        try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                        try await pushNotebookCardChunk(records, chunkIndex: chunkIndex, totalChunks: totalChunks, retryAttempt: retryAttempt + 1)
                        return
                    }
                }
            }
            throw error
        }
    }

    /// Pulls remote changes from CloudKit with progress tracking
    private func pullChanges() async throws {
        let zoneID = zone.zoneID

        let configuration = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
        configuration.previousServerChangeToken = changeToken

        var changedRecords: [CKRecord] = []
        var deletedRecordIDs: [CKRecord.ID] = []

        // Start pull phase at 50%
        updateProgress(0.5)

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

        // Progress: fetched records (60%)
        updateProgress(0.6)

        let totalChanges = changedRecords.count + deletedRecordIDs.count
        var processedChanges = 0

        // Apply changes to local database with conflict resolution
        for record in changedRecords {
            // Handle different record types
            switch record.recordType {
            case "Node":
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

            case "NotebookCard":
                if let serverCard = recordToNotebookCard(record) {
                    if let localCard = try await localDatabase.getNotebookCard(id: serverCard.id) {
                        // Check for conflict: both modified since last sync
                        let localModifiedSinceSync = localCard.lastSyncedAt == nil ||
                            localCard.modifiedAt > (localCard.lastSyncedAt ?? .distantPast)
                        let hasConflict = localModifiedSinceSync && serverCard.syncVersion != localCard.syncVersion

                        if hasConflict {
                            // For now, use server wins strategy for notebook cards
                            // TODO: Add notebook-specific conflict resolution in Phase 6.2
                            try await localDatabase.updateNotebookCard(serverCard)
                        } else if serverCard.syncVersion > localCard.syncVersion {
                            // No conflict, server is newer - apply update
                            try await localDatabase.updateNotebookCard(serverCard)
                        }
                        // If local is newer (syncVersion >= server), keep local
                    } else {
                        // New record from server
                        try await localDatabase.createNotebookCard(serverCard)
                    }
                }

            default:
                // Handle other record types (ViewConfig, FilterPreset, etc.)
                // For now, skip unknown types - they'll be handled by existing specific sync methods
                break
            }

            processedChanges += 1
            if totalChanges > 0 {
                // Progress from 60% to 95%
                updateProgress(0.6 + (0.35 * Double(processedChanges) / Double(totalChanges)))
            }
        }

        // Apply deletions
        for recordID in deletedRecordIDs {
            try await localDatabase.deleteNode(id: recordID.recordName)
            processedChanges += 1
            if totalChanges > 0 {
                updateProgress(0.6 + (0.35 * Double(processedChanges) / Double(totalChanges)))
            }
        }

        // Save change token
        self.changeToken = changeToken

        // Final progress
        updateProgress(0.95)
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

    /// Convert ViewConfig to CloudKit record
    private func viewConfigToRecord(_ config: ViewConfig) -> CKRecord {
        let recordID = CKRecord.ID(recordName: config.id, zoneID: zone.zoneID)
        let record = CKRecord(recordType: "ViewConfig", recordID: recordID)

        record["name"] = config.name
        record["isDefault"] = config.isDefault ? 1 : 0
        record["originPattern"] = config.originPattern
        record["xAxisMapping"] = config.xAxisMapping
        record["yAxisMapping"] = config.yAxisMapping
        record["zoomLevel"] = config.zoomLevel
        record["panOffsetX"] = config.panOffsetX
        record["panOffsetY"] = config.panOffsetY
        record["filterConfig"] = config.filterConfig
        record["createdAt"] = config.createdAt
        record["modifiedAt"] = config.modifiedAt
        record["lastUsedAt"] = config.lastUsedAt
        record["syncVersion"] = config.syncVersion

        return record
    }

    /// Convert FilterPreset to CloudKit record
    private func filterPresetToRecord(_ preset: FilterPreset) -> CKRecord {
        let recordID = CKRecord.ID(recordName: preset.id, zoneID: zone.zoneID)
        let record = CKRecord(recordType: "FilterPreset", recordID: recordID)

        record["name"] = preset.name
        record["isDefault"] = preset.isDefault ? 1 : 0
        record["filterConfig"] = preset.filterConfig
        record["description"] = preset.description
        record["iconName"] = preset.iconName
        record["usageCount"] = preset.usageCount
        record["lastUsedAt"] = preset.lastUsedAt
        record["createdAt"] = preset.createdAt
        record["modifiedAt"] = preset.modifiedAt
        record["syncVersion"] = preset.syncVersion

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

    /// Convert CloudKit record to ViewConfig
    private func recordToViewConfig(_ record: CKRecord) -> ViewConfig? {
        guard let name = record["name"] as? String else { return nil }

        return ViewConfig(
            id: record.recordID.recordName,
            name: name,
            isDefault: (record["isDefault"] as? Int ?? 0) == 1,
            originPattern: record["originPattern"] as? String ?? "anchor",
            xAxisMapping: record["xAxisMapping"] as? String ?? "time",
            yAxisMapping: record["yAxisMapping"] as? String ?? "category",
            zoomLevel: record["zoomLevel"] as? Double ?? 1.0,
            panOffsetX: record["panOffsetX"] as? Double ?? 0.0,
            panOffsetY: record["panOffsetY"] as? Double ?? 0.0,
            filterConfig: record["filterConfig"] as? String,
            createdAt: record["createdAt"] as? Date ?? Date(),
            modifiedAt: record["modifiedAt"] as? Date ?? Date(),
            lastUsedAt: record["lastUsedAt"] as? Date,
            syncVersion: record["syncVersion"] as? Int ?? 0
        )
    }

    /// Convert CloudKit record to FilterPreset
    private func recordToFilterPreset(_ record: CKRecord) -> FilterPreset? {
        guard let name = record["name"] as? String,
              let filterConfig = record["filterConfig"] as? String else { return nil }

        return FilterPreset(
            id: record.recordID.recordName,
            name: name,
            isDefault: (record["isDefault"] as? Int ?? 0) == 1,
            filterConfig: filterConfig,
            description: record["description"] as? String,
            iconName: record["iconName"] as? String,
            usageCount: record["usageCount"] as? Int ?? 0,
            lastUsedAt: record["lastUsedAt"] as? Date,
            createdAt: record["createdAt"] as? Date ?? Date(),
            modifiedAt: record["modifiedAt"] as? Date ?? Date(),
            syncVersion: record["syncVersion"] as? Int ?? 0
        )
    }

    /// Converts NotebookCard to CloudKit record
    private func notebookCardToRecord(_ card: NotebookCard) -> CKRecord {
        let recordID = CKRecord.ID(recordName: card.id, zoneID: zone.zoneID)
        let record = CKRecord(recordType: "NotebookCard", recordID: recordID)

        record["title"] = card.title
        record["markdownContent"] = card.markdownContent
        record["templateId"] = card.templateId
        record["folder"] = card.folder
        record["linkedNodeId"] = card.linkedNodeId
        record["syncVersion"] = card.syncVersion
        record["createdAt"] = card.createdAt
        record["modifiedAt"] = card.modifiedAt
        record["lastSyncedAt"] = card.lastSyncedAt
        record["conflictResolvedAt"] = card.conflictResolvedAt
        record["deletedAt"] = card.deletedAt

        // Encode properties as JSON string
        if let propertiesData = try? JSONEncoder().encode(card.properties),
           let propertiesString = String(data: propertiesData, encoding: .utf8) {
            record["properties"] = propertiesString
        }

        // Encode tags as JSON string
        if let tagsData = try? JSONEncoder().encode(card.tags),
           let tagsString = String(data: tagsData, encoding: .utf8) {
            record["tags"] = tagsString
        }

        return record
    }

    /// Converts CloudKit record to NotebookCard
    private func recordToNotebookCard(_ record: CKRecord) -> NotebookCard? {
        guard let title = record["title"] as? String else { return nil }

        // Decode properties from JSON string
        let properties: [String: String]
        if let propertiesString = record["properties"] as? String,
           let data = propertiesString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            properties = decoded
        } else {
            properties = [:]
        }

        // Decode tags from JSON string
        let tags: [String]
        if let tagsString = record["tags"] as? String,
           let data = tagsString.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            tags = decoded
        } else {
            tags = []
        }

        return NotebookCard(
            id: record.recordID.recordName,
            title: title,
            markdownContent: record["markdownContent"] as? String,
            properties: properties,
            templateId: record["templateId"] as? String,
            createdAt: record["createdAt"] as? Date ?? Date(),
            modifiedAt: record["modifiedAt"] as? Date ?? Date(),
            folder: record["folder"] as? String,
            tags: tags,
            linkedNodeId: record["linkedNodeId"] as? String,
            syncVersion: record["syncVersion"] as? Int ?? 0,
            lastSyncedAt: record["lastSyncedAt"] as? Date,
            conflictResolvedAt: record["conflictResolvedAt"] as? Date,
            deletedAt: record["deletedAt"] as? Date
        )
    }

    // MARK: - SuperGrid Sync Methods

    /// Sync view configurations to CloudKit
    public func syncViewConfigs(_ configs: [ViewConfig]) async throws {
        let records = configs.map(viewConfigToRecord)
        try await pushRecords(records)
    }

    /// Sync filter presets to CloudKit
    public func syncFilterPresets(_ presets: [FilterPreset]) async throws {
        let records = presets.map(filterPresetToRecord)
        try await pushRecords(records)
    }

    /// Pull view configurations from CloudKit
    public func pullViewConfigs() async throws -> [ViewConfig] {
        let predicate = NSPredicate(format: "TRUEPREDICATE")
        let query = CKQuery(recordType: "ViewConfig", predicate: predicate)

        let (records, _) = try await database.records(matching: query, inZoneWith: zone.zoneID)

        var configs: [ViewConfig] = []
        for (_, result) in records {
            switch result {
            case .success(let record):
                if let config = recordToViewConfig(record) {
                    configs.append(config)
                }
            case .failure(let error):
                print("Failed to fetch view config: \(error)")
            }
        }

        return configs
    }

    /// Pull filter presets from CloudKit
    public func pullFilterPresets() async throws -> [FilterPreset] {
        let predicate = NSPredicate(format: "TRUEPREDICATE")
        let query = CKQuery(recordType: "FilterPreset", predicate: predicate)

        let (records, _) = try await database.records(matching: query, inZoneWith: zone.zoneID)

        var presets: [FilterPreset] = []
        for (_, result) in records {
            switch result {
            case .success(let record):
                if let preset = recordToFilterPreset(record) {
                    presets.append(preset)
                }
            case .failure(let error):
                print("Failed to fetch filter preset: \(error)")
            }
        }

        return presets
    }

    /// Generic method to push records to CloudKit with chunking support
    private func pushRecords(_ records: [CKRecord]) async throws {
        guard !records.isEmpty else { return }

        // Chunk records into batches of 400 (CloudKit limit)
        let chunks = stride(from: 0, to: records.count, by: Self.recordsPerChunk).map {
            Array(records[$0..<min($0 + Self.recordsPerChunk, records.count)])
        }

        for chunk in chunks {
            try await pushGenericRecordChunk(chunk)
        }
    }

    /// Pushes a generic chunk of records to CloudKit
    private func pushGenericRecordChunk(_ records: [CKRecord], retryAttempt: Int = 0) async throws {
        do {
            let (savedResults, _) = try await database.modifyRecords(
                saving: records,
                deleting: [],
                savePolicy: .changedKeys,
                atomically: false
            )

            for (recordID, result) in savedResults {
                switch result {
                case .success:
                    print("Successfully synced record: \(recordID.recordName)")
                case .failure(let error):
                    print("Failed to sync record \(recordID.recordName): \(error)")
                    throw error
                }
            }
        } catch let error as CKError {
            // Handle retryable errors
            if (error.code == .requestRateLimited || error.code == .serviceUnavailable) && retryAttempt < maxRetries {
                let delay = retryDelay(attempt: retryAttempt + 1)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                try await pushGenericRecordChunk(records, retryAttempt: retryAttempt + 1)
                return
            }
            throw mapCKError(error)
        }
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
