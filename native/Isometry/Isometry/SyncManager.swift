import CloudKit
import os

// ---------------------------------------------------------------------------
// SyncManager -- CKSyncEngine Delegate + State Persistence + Offline Queue
// ---------------------------------------------------------------------------
// Actor-based sync manager conforming to CKSyncEngineDelegate.
// Owns the CKSyncEngine instance, persists state serialization (change tokens)
// on every stateUpdate event, and manages an offline queue of pending changes.
//
// Requirements addressed:
//   - SYNC-03: Change token persistence via CKSyncEngine.State.Serialization
//   - SYNC-10: Offline edits queue as JSON file, survives app restart
//
// Architecture:
//   - Initialized by IsometryApp after DatabaseManager
//   - State serialization persisted to sync-state.data (JSONEncoder)
//   - Offline queue persisted to sync-queue.json (JSONEncoder)
//   - System fields archived to record-metadata.json (Pitfall 2 prevention)

actor SyncManager: CKSyncEngineDelegate {

    // MARK: - Properties

    private var syncEngine: CKSyncEngine?
    private let stateURL: URL
    private let queueURL: URL
    private let systemFieldsURL: URL
    private var pendingChanges: [PendingChange]
    private var archivedSystemFields: [String: Data]
    private let logger = Logger(subsystem: "works.isometry.app", category: "Sync")

    /// Weak reference to BridgeManager for forwarding incoming sync records to JS.
    /// Set by IsometryApp after initialization.
    /// nonisolated(unsafe) because BridgeManager is @MainActor and we store a weak ref
    /// from an actor context -- the actual usage will hop to MainActor.
    nonisolated(unsafe) weak var bridgeManager: BridgeManager?

    // MARK: - Initialization

    /// Initialize SyncManager with paths for state persistence files.
    /// Loads offline queue and system fields from disk immediately.
    init(appSupportDir: URL) {
        stateURL = appSupportDir.appendingPathComponent("sync-state.data")
        queueURL = appSupportDir.appendingPathComponent("sync-queue.json")
        systemFieldsURL = appSupportDir.appendingPathComponent("record-metadata.json")
        pendingChanges = Self.loadQueueFromDisk(url: appSupportDir.appendingPathComponent("sync-queue.json"))
        archivedSystemFields = Self.loadSystemFieldsFromDisk(url: appSupportDir.appendingPathComponent("record-metadata.json"))
    }

    /// Create CKSyncEngine with persisted state (or nil on first launch).
    /// Must be called after init, in an async context.
    func initialize() {
        let stateSerialization = loadStateSerialization()
        let database = CKContainer.default().privateCloudDatabase
        let zoneID = SyncConstants.zoneID

        let config = CKSyncEngine.Configuration(
            database: database,
            stateSerialization: stateSerialization,
            delegate: self
        )

        syncEngine = CKSyncEngine(config)

        // Re-add any pending changes from the offline queue to CKSyncEngine's state
        if !pendingChanges.isEmpty {
            var recordZoneChanges = [CKSyncEngine.PendingRecordZoneChange]()

            for change in pendingChanges {
                let recordID = CKRecord.ID(recordName: change.recordId, zoneID: zoneID)
                if change.operation == "save" {
                    recordZoneChanges.append(.saveRecord(recordID))
                } else if change.operation == "delete" {
                    recordZoneChanges.append(.deleteRecord(recordID))
                }
            }

            if !recordZoneChanges.isEmpty {
                syncEngine?.state.add(pendingRecordZoneChanges: recordZoneChanges)
            }

            logger.info("Restored \(self.pendingChanges.count) pending changes from offline queue")
        }

        if stateSerialization != nil {
            logger.info("SyncManager initialized with persisted state")
        } else {
            logger.info("SyncManager initialized (first launch -- no persisted state)")
        }
    }

    // MARK: - CKSyncEngineDelegate: handleEvent

    nonisolated func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {

        case .stateUpdate(let update):
            // SYNC-03: Persist state serialization on EVERY stateUpdate event.
            // This preserves change tokens across app restarts.
            await persistStateSerialization(update.stateSerialization)

        case .accountChange(let change):
            await handleAccountChange(change)

        case .fetchedRecordZoneChanges(let changes):
            await handleFetchedRecordZoneChanges(changes)

        case .sentRecordZoneChanges(let sent):
            await handleSentRecordZoneChanges(sent)

        case .fetchedDatabaseChanges(let changes):
            await handleFetchedDatabaseChanges(changes)

        case .sentDatabaseChanges:
            // Database changes sent successfully -- no action needed
            break

        case .willFetchChanges, .willFetchRecordZoneChanges, .didFetchRecordZoneChanges,
             .willSendChanges, .didSendChanges, .didFetchChanges:
            // Lifecycle events -- no action needed for infrastructure phase
            break

        @unknown default:
            break
        }
    }

    // MARK: - CKSyncEngineDelegate: nextRecordZoneChangeBatch

    nonisolated func nextRecordZoneChangeBatch(
        _ context: CKSyncEngine.SendChangesContext,
        syncEngine: CKSyncEngine
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
        // Capture pending record zone changes
        let pendingRecordZoneChanges = syncEngine.state.pendingRecordZoneChanges
        // Snapshot actor-isolated data before building the batch
        let snapshot = await makeBatchSnapshot()
        return await Self.buildBatch(
            from: snapshot,
            pendingRecordZoneChanges: pendingRecordZoneChanges
        )
    }

    // MARK: - Batch Snapshot

    /// Snapshot of actor-isolated data needed to build a record zone change batch.
    /// Captured once and passed to a static (nonisolated) function.
    private struct BatchSnapshot: Sendable {
        let pendingChanges: [PendingChange]
        let archivedSystemFields: [String: Data]
    }

    private func makeBatchSnapshot() -> BatchSnapshot {
        BatchSnapshot(
            pendingChanges: pendingChanges,
            archivedSystemFields: archivedSystemFields
        )
    }

    // MARK: - Event Handlers

    private func handleAccountChange(_ change: CKSyncEngine.Event.AccountChange) {
        switch change.changeType {
        case .signIn:
            logger.info("iCloud account signed in -- ensuring zone exists")
            // CKSyncEngine auto-creates the zone on first send; no manual zone creation needed

        case .signOut:
            logger.info("iCloud account signed out -- clearing sync state")
            clearSyncState()

        case .switchAccounts:
            logger.info("iCloud account switched -- clearing sync state and re-initializing")
            clearSyncState()
            // Re-initialize will happen on next app launch

        @unknown default:
            logger.warning("Unknown account change type")
        }
    }

    private func handleFetchedRecordZoneChanges(_ changes: CKSyncEngine.Event.FetchedRecordZoneChanges) {
        // Process fetched records
        for modification in changes.modifications {
            let record = modification.record
            let recordType = record.recordType
            let recordId = record.recordID.recordName

            logger.info("Fetched record: \(recordType)/\(recordId)")

            // Archive system fields for future conflict resolution (Pitfall 2 prevention)
            archiveSystemFields(for: record)
        }

        // Process deletions
        for deletion in changes.deletions {
            let recordId = deletion.recordID.recordName
            let recordType = deletion.recordType

            logger.info("Fetched deletion: \(recordType)/\(recordId)")

            // Remove archived system fields for deleted records
            archivedSystemFields.removeValue(forKey: recordId)
        }

        persistSystemFields()

        // TODO(39-03): Forward fetched records to JS via BridgeManager
        // For now, records are logged but not dispatched to the web runtime.
        // Plan 39-03 will implement BridgeManager.sendSyncNotification() with
        // batched record payload for SyncMerger processing.
    }

    private func handleSentRecordZoneChanges(_ sent: CKSyncEngine.Event.SentRecordZoneChanges) {
        // Handle successful saves
        for savedRecord in sent.savedRecords {
            let recordId = savedRecord.recordID.recordName
            logger.info("Successfully sent record: \(savedRecord.recordType)/\(recordId)")

            // Archive system fields after successful send (Pitfall 2)
            archiveSystemFields(for: savedRecord)

            // Remove from pending changes
            let savedId = recordId
            pendingChanges.removeAll(where: { $0.recordId == savedId && $0.operation == "save" })
        }

        // Handle successful deletes
        for deletedRecordID in sent.deletedRecordIDs {
            let recordId = deletedRecordID.recordName
            logger.info("Successfully deleted record: \(recordId)")

            // Remove archived system fields
            archivedSystemFields.removeValue(forKey: recordId)

            // Remove from pending changes
            let deletedId = recordId
            pendingChanges.removeAll(where: { $0.recordId == deletedId && $0.operation == "delete" })
        }

        // Handle failures -- leave in queue for retry
        for failedSave in sent.failedRecordSaves {
            let recordId = failedSave.record.recordID.recordName
            let error = failedSave.error
            logger.error("Failed to send record \(recordId): \(error.localizedDescription)")
            // CKSyncEngine will retry automatically for transient errors
        }

        persistQueue()
        persistSystemFields()
    }

    private func handleFetchedDatabaseChanges(_ changes: CKSyncEngine.Event.FetchedDatabaseChanges) {
        for modification in changes.modifications {
            logger.info("Database zone modified: \(modification.zoneID.zoneName)")
        }

        for deletion in changes.deletions {
            let zoneName = deletion.zoneID.zoneName

            switch deletion.reason {
            case .purged:
                // User cleared iCloud data via Settings -- clear ALL local sync state
                logger.warning("Zone purged: \(zoneName) -- clearing local sync state")
                clearSyncState()

            case .encryptedDataReset:
                // Account recovery -- need to re-upload all data
                logger.warning("Zone encrypted data reset: \(zoneName) -- re-upload needed")
                // Phase 40 will implement full re-upload logic

            case .deleted:
                // Normal zone cleanup
                logger.info("Zone deleted: \(zoneName)")
                clearSyncState()

            @unknown default:
                logger.warning("Unknown zone deletion reason for \(zoneName)")
            }
        }
    }

    // MARK: - Build Record Zone Change Batch (static, nonisolated)

    /// Build a CKSyncEngine.RecordZoneChangeBatch from a snapshot of actor state.
    /// Static method to avoid actor isolation issues in the synchronous closure.
    private static func buildBatch(
        from snapshot: BatchSnapshot,
        pendingRecordZoneChanges: [CKSyncEngine.PendingRecordZoneChange]
    ) async -> CKSyncEngine.RecordZoneChangeBatch? {
        let zoneID = SyncConstants.zoneID
        let cardType = SyncConstants.cardRecordType
        let connType = SyncConstants.connectionRecordType

        guard !pendingRecordZoneChanges.isEmpty else {
            return nil
        }

        let localPendingChanges = snapshot.pendingChanges
        let localSystemFields = snapshot.archivedSystemFields

        let batch = await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: pendingRecordZoneChanges) { recordID in
            // Find the matching pending change from our local queue
            guard let change = localPendingChanges.first(where: { $0.recordId == recordID.recordName }) else {
                // No matching local change -- create a minimal record
                return CKRecord(recordType: cardType, recordID: recordID)
            }

            // Try to restore from archived system fields (Pitfall 2 prevention)
            let record: CKRecord
            if let archivedData = localSystemFields[change.recordId] {
                if let unarchiver = try? NSKeyedUnarchiver(forReadingFrom: archivedData) {
                    unarchiver.requiresSecureCoding = true
                    if let restored = CKRecord(coder: unarchiver) {
                        record = restored
                        unarchiver.finishDecoding()
                    } else {
                        unarchiver.finishDecoding()
                        record = CKRecord(recordType: change.recordType, recordID: recordID)
                    }
                } else {
                    record = CKRecord(recordType: change.recordType, recordID: recordID)
                }
            } else {
                record = CKRecord(recordType: change.recordType, recordID: recordID)
            }

            // Set fields based on record type
            if let fields = change.fields {
                if change.recordType == cardType {
                    record.setCardFields(fields)
                } else if change.recordType == connType {
                    record.setConnectionFields(fields, zoneID: zoneID)
                }
            }

            return record
        }

        return batch
    }

    // MARK: - State Persistence (SYNC-03)

    /// Persist CKSyncEngine state serialization to disk.
    /// Called on EVERY stateUpdate event to preserve change tokens.
    /// CKSyncEngine.State.Serialization conforms to Codable, so we use JSONEncoder.
    private func persistStateSerialization(_ serialization: CKSyncEngine.State.Serialization) {
        do {
            let data = try JSONEncoder().encode(serialization)
            try data.write(to: stateURL, options: .atomic)
            logger.debug("Persisted sync state serialization (\(data.count) bytes)")
        } catch {
            logger.error("Failed to persist sync state: \(error.localizedDescription)")
        }
    }

    /// Load CKSyncEngine state serialization from disk.
    /// Returns nil on first launch (no file exists).
    private func loadStateSerialization() -> CKSyncEngine.State.Serialization? {
        guard let data = try? Data(contentsOf: stateURL) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(CKSyncEngine.State.Serialization.self, from: data)
        } catch {
            logger.error("Failed to load sync state: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Offline Queue Persistence (SYNC-10)

    /// Add a pending change to the offline queue.
    /// Appends to in-memory array, persists to disk, and notifies CKSyncEngine.
    func addPendingChange(_ change: PendingChange) {
        pendingChanges.append(change)
        persistQueue()

        // Notify CKSyncEngine about the new pending change
        let zoneID = SyncConstants.zoneID
        let recordID = CKRecord.ID(recordName: change.recordId, zoneID: zoneID)
        if change.operation == "save" {
            syncEngine?.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
        } else if change.operation == "delete" {
            syncEngine?.state.add(pendingRecordZoneChanges: [.deleteRecord(recordID)])
        }

        logger.info("Queued pending change: \(change.operation) \(change.recordType)/\(change.recordId)")
    }

    /// Persist the offline queue to disk as JSON.
    private func persistQueue() {
        do {
            let data = try JSONEncoder().encode(pendingChanges)
            try data.write(to: queueURL, options: .atomic)
            logger.debug("Persisted offline queue (\(self.pendingChanges.count) changes)")
        } catch {
            logger.error("Failed to persist offline queue: \(error.localizedDescription)")
        }
    }

    /// Load offline queue from disk. Returns empty array if file missing.
    private static func loadQueueFromDisk(url: URL) -> [PendingChange] {
        guard let data = try? Data(contentsOf: url) else {
            return []
        }
        do {
            return try JSONDecoder().decode([PendingChange].self, from: data)
        } catch {
            // Corrupted file -- start fresh
            return []
        }
    }

    // MARK: - System Fields Archival (Pitfall 2 Prevention)

    /// Archive a CKRecord's system fields for future conflict resolution.
    /// Must be called after every successful fetch or send.
    private func archiveSystemFields(for record: CKRecord) {
        let archiver = NSKeyedArchiver(requiringSecureCoding: true)
        record.encodeSystemFields(with: archiver)
        archiver.finishEncoding()
        archivedSystemFields[record.recordID.recordName] = archiver.encodedData
    }

    /// Persist archived system fields to disk.
    private func persistSystemFields() {
        do {
            let data = try JSONEncoder().encode(archivedSystemFields)
            try data.write(to: systemFieldsURL, options: .atomic)
        } catch {
            logger.error("Failed to persist system fields: \(error.localizedDescription)")
        }
    }

    /// Load archived system fields from disk.
    private static func loadSystemFieldsFromDisk(url: URL) -> [String: Data] {
        guard let data = try? Data(contentsOf: url) else {
            return [:]
        }
        do {
            return try JSONDecoder().decode([String: Data].self, from: data)
        } catch {
            return [:]
        }
    }

    // MARK: - Clear Sync State

    /// Clear all sync state (called on sign-out or zone purge).
    private func clearSyncState() {
        let fm = FileManager.default
        try? fm.removeItem(at: stateURL)
        try? fm.removeItem(at: queueURL)
        try? fm.removeItem(at: systemFieldsURL)
        pendingChanges.removeAll()
        archivedSystemFields.removeAll()
        syncEngine = nil
        logger.info("Sync state cleared")
    }
}
