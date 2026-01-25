import Foundation

/// Conflict resolution strategy for sync conflicts
public enum SyncConflictStrategy: String, Codable, Sendable {
    /// Server version always wins (default for simplicity)
    case serverWins = "server_wins"
    /// Local version always wins
    case localWins = "local_wins"
    /// Most recently modified version wins
    case latestWins = "latest_wins"
    /// Merge field-by-field, preferring newer values
    case fieldLevelMerge = "field_merge"
    /// Queue for manual resolution
    case manualResolution = "manual"
}

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

    // MARK: - Conflict Metadata
    public var conflictStrategy: SyncConflictStrategy
    public var lastConflictAt: Date?
    public var totalConflictsResolved: Int

    // MARK: - Initial Sync Progress
    public var isInitialSync: Bool
    public var initialSyncProgress: Double
    public var initialSyncTotal: Int
    public var initialSyncCompleted: Int

    // MARK: - Initialization

    public init(
        id: String = "default",
        lastSyncToken: Data? = nil,
        lastSyncAt: Date? = nil,
        pendingChanges: Int = 0,
        conflictCount: Int = 0,
        consecutiveFailures: Int = 0,
        lastError: String? = nil,
        lastErrorAt: Date? = nil,
        conflictStrategy: SyncConflictStrategy = .latestWins,
        lastConflictAt: Date? = nil,
        totalConflictsResolved: Int = 0,
        isInitialSync: Bool = true,
        initialSyncProgress: Double = 0.0,
        initialSyncTotal: Int = 0,
        initialSyncCompleted: Int = 0
    ) {
        self.id = id
        self.lastSyncToken = lastSyncToken
        self.lastSyncAt = lastSyncAt
        self.pendingChanges = pendingChanges
        self.conflictCount = conflictCount
        self.consecutiveFailures = consecutiveFailures
        self.lastError = lastError
        self.lastErrorAt = lastErrorAt
        self.conflictStrategy = conflictStrategy
        self.lastConflictAt = lastConflictAt
        self.totalConflictsResolved = totalConflictsResolved
        self.isInitialSync = isInitialSync
        self.initialSyncProgress = initialSyncProgress
        self.initialSyncTotal = initialSyncTotal
        self.initialSyncCompleted = initialSyncCompleted
    }
}

// MARK: - Coding Keys for JSON Serialization

extension SyncState {
    public enum CodingKeys: String, CodingKey {
        case id
        case lastSyncToken = "last_sync_token"
        case lastSyncAt = "last_sync_at"
        case pendingChanges = "pending_changes"
        case conflictCount = "conflict_count"
        case consecutiveFailures = "consecutive_failures"
        case lastError = "last_error"
        case lastErrorAt = "last_error_at"
        case conflictStrategy = "conflict_strategy"
        case lastConflictAt = "last_conflict_at"
        case totalConflictsResolved = "total_conflicts_resolved"
        case isInitialSync = "is_initial_sync"
        case initialSyncProgress = "initial_sync_progress"
        case initialSyncTotal = "initial_sync_total"
        case initialSyncCompleted = "initial_sync_completed"
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

    /// Whether initial sync is in progress
    public var isInitialSyncInProgress: Bool {
        isInitialSync && initialSyncProgress > 0 && initialSyncProgress < 1.0
    }

    /// Human-readable status summary
    public var statusSummary: String {
        if isInitialSyncInProgress {
            return "Initial sync: \(Int(initialSyncProgress * 100))%"
        }
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

    /// Detailed status for UI display
    public var detailedStatus: String {
        var components: [String] = []

        if let lastSync = lastSyncAt {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            components.append("Last: \(formatter.localizedString(for: lastSync, relativeTo: Date()))")
        }

        if hasConflicts {
            components.append("\(conflictCount) conflicts")
        }

        if hasPendingChanges {
            components.append("\(pendingChanges) pending")
        }

        if totalConflictsResolved > 0 {
            components.append("\(totalConflictsResolved) resolved")
        }

        return components.isEmpty ? "Ready" : components.joined(separator: " | ")
    }
}