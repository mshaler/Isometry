import Foundation
import GRDB

/// Tracks CloudKit sync state for the database
public struct SyncState: Codable, Sendable, Identifiable {
    // MARK: - Identity
    public let id: String

    // MARK: - Sync Progress
    public var lastSyncToken: Data?
    public var lastSyncAt: Date?
    public var pendingChanges: Int
    public var conflictCount: Int

    // MARK: - Error Tracking
    public var consecutiveFailures: Int
    public var lastError: String?
    public var lastErrorAt: Date?

    // MARK: - Initialization

    public init(
        id: String = "default",
        lastSyncToken: Data? = nil,
        lastSyncAt: Date? = nil,
        pendingChanges: Int = 0,
        conflictCount: Int = 0,
        consecutiveFailures: Int = 0,
        lastError: String? = nil,
        lastErrorAt: Date? = nil
    ) {
        self.id = id
        self.lastSyncToken = lastSyncToken
        self.lastSyncAt = lastSyncAt
        self.pendingChanges = pendingChanges
        self.conflictCount = conflictCount
        self.consecutiveFailures = consecutiveFailures
        self.lastError = lastError
        self.lastErrorAt = lastErrorAt
    }
}

// MARK: - GRDB Record Conformance

extension SyncState: FetchableRecord, PersistableRecord {
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
    }

    enum CodingKeys: String, CodingKey {
        case id
        case lastSyncToken = "last_sync_token"
        case lastSyncAt = "last_sync_at"
        case pendingChanges = "pending_changes"
        case conflictCount = "conflict_count"
        case consecutiveFailures = "consecutive_failures"
        case lastError = "last_error"
        case lastErrorAt = "last_error_at"
    }
}

// MARK: - Computed Properties

extension SyncState {
    /// Whether sync is currently healthy
    public var isHealthy: Bool {
        consecutiveFailures == 0 && conflictCount == 0
    }

    /// Whether sync has been attempted
    public var hasSynced: Bool {
        lastSyncAt != nil
    }

    /// Whether there are pending local changes to sync
    public var hasPendingChanges: Bool {
        pendingChanges > 0
    }

    /// Whether there are unresolved conflicts
    public var hasConflicts: Bool {
        conflictCount > 0
    }

    /// Human-readable status summary
    public var statusSummary: String {
        if !hasSynced {
            return "Never synced"
        }
        if hasConflicts {
            return "\(conflictCount) conflict\(conflictCount == 1 ? "" : "s")"
        }
        if consecutiveFailures > 0 {
            return "Sync failing (\(consecutiveFailures) attempts)"
        }
        if hasPendingChanges {
            return "\(pendingChanges) pending"
        }
        return "Synced"
    }
}
