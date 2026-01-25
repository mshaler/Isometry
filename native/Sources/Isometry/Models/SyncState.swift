import Foundation
import GRDB
import IsometryCore

// Import the core SyncState entities and extend them with GRDB functionality
public typealias SyncConflictStrategy = IsometryCore.SyncConflictStrategy
public typealias SyncState = IsometryCore.SyncState

// MARK: - GRDB Record Conformance

extension IsometryCore.SyncState: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "sync_state"

    enum Columns {
        static let id = Column(CodingKeys.id)
        static let lastSyncToken = Column(CodingKeys.lastSyncToken)
        static let lastSyncAt = Column(CodingKeys.lastSyncAt)
        static let pendingChanges = Column(CodingKeys.pendingChanges)
        static let conflictCount = Column(CodingKeys.conflictCount)
        static let consecutiveFailures = Column(CodingKeys.consecutiveFailures)
        static let lastError = Column(CodingKeys.lastError)
        static let lastErrorAt = Column(CodingKeys.lastErrorAt)
        static let conflictStrategy = Column(CodingKeys.conflictStrategy)
        static let lastConflictAt = Column(CodingKeys.lastConflictAt)
        static let totalConflictsResolved = Column(CodingKeys.totalConflictsResolved)
        static let isInitialSync = Column(CodingKeys.isInitialSync)
        static let initialSyncProgress = Column(CodingKeys.initialSyncProgress)
        static let initialSyncTotal = Column(CodingKeys.initialSyncTotal)
        static let initialSyncCompleted = Column(CodingKeys.initialSyncCompleted)
    }
}