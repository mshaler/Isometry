import Foundation

/// CRDT (Conflict-free Replicated Data Type) metadata for distributed conflict resolution
/// Based on Last-Write-Wins CRDT with site ID tiebreaker for deterministic conflict resolution
public struct CRDTNode: Codable, Sendable {
    /// Unique node identifier
    public let id: String

    /// Device identifier for conflict resolution tiebreaker
    /// Format: "device_[UUID]" for deterministic ordering
    public let siteId: String

    /// Per-column CRDT version counter for field-level conflict detection
    /// Incremented each time a specific field is modified
    public var columnVersion: UInt64

    /// Database logical clock for ordering operations across devices
    /// Global monotonic counter for distributed operation ordering
    public var dbVersion: UInt64

    /// Last-write-wins timestamp for conflict resolution
    /// Combined with siteId for deterministic resolution when timestamps equal
    public var lastWriteWins: Date

    /// Content hash for detecting changes without full comparison
    /// Used for efficient conflict detection
    public var contentHash: String

    /// Fields that were modified in this version (for field-level conflict resolution)
    /// Array of field names that changed in the last update
    public var modifiedFields: [String]

    // MARK: - Initialization

    public init(
        id: String,
        siteId: String,
        columnVersion: UInt64 = 1,
        dbVersion: UInt64 = 1,
        lastWriteWins: Date = Date(),
        contentHash: String = "",
        modifiedFields: [String] = []
    ) {
        self.id = id
        self.siteId = siteId
        self.columnVersion = columnVersion
        self.dbVersion = dbVersion
        self.lastWriteWins = lastWriteWins
        self.contentHash = contentHash
        self.modifiedFields = modifiedFields
    }

    // MARK: - CRDT Operations

    /// Creates a new CRDT node for the current device
    public static func create(
        id: String,
        deviceId: String,
        modifiedFields: [String] = []
    ) -> CRDTNode {
        let siteId = "device_\(deviceId)"
        let contentHash = ""  // Will be computed based on actual content

        return CRDTNode(
            id: id,
            siteId: siteId,
            columnVersion: 1,
            dbVersion: 1,
            lastWriteWins: Date(),
            contentHash: contentHash,
            modifiedFields: modifiedFields
        )
    }

    /// Updates CRDT metadata when local content changes
    public mutating func updateForLocalChange(
        newContentHash: String,
        modifiedFields: [String],
        globalDbVersion: UInt64
    ) {
        self.columnVersion += 1
        self.dbVersion = globalDbVersion
        self.lastWriteWins = Date()
        self.contentHash = newContentHash
        self.modifiedFields = modifiedFields
    }

    /// Increments version for sync operations
    public mutating func incrementForSync(globalDbVersion: UInt64) {
        self.dbVersion = max(self.dbVersion, globalDbVersion)
    }

    // MARK: - Conflict Detection

    /// Determines if this CRDT node conflicts with another
    public func hasConflictWith(_ other: CRDTNode) -> Bool {
        // No conflict if same content or one is clearly newer
        if self.contentHash == other.contentHash {
            return false
        }

        // Check if column versions indicate simultaneous edits
        let versionDifference = abs(Int64(self.columnVersion) - Int64(other.columnVersion))
        let timeDifference = abs(self.lastWriteWins.timeIntervalSince(other.lastWriteWins))

        // Conflict if versions are close and timestamps are close (simultaneous edits)
        return versionDifference <= 2 && timeDifference < 30.0 // 30 seconds threshold
    }

    /// Determines conflict type for resolution strategy
    public func conflictType(with other: CRDTNode) -> ConflictType {
        if !hasConflictWith(other) {
            return .noConflict
        }

        // Check for field-level conflicts
        let commonFields = Set(self.modifiedFields).intersection(Set(other.modifiedFields))
        if commonFields.isEmpty {
            return .fieldLevelMergeable
        }

        return .contentConflict
    }

    public enum ConflictType {
        case noConflict
        case fieldLevelMergeable
        case contentConflict
    }

    // MARK: - Vector Clock Comparison

    /// Compares this CRDT with another using vector clock semantics
    public func compare(with other: CRDTNode) -> CRDTComparison {
        if self.dbVersion == other.dbVersion && self.columnVersion == other.columnVersion {
            return .concurrent
        }

        if self.dbVersion > other.dbVersion ||
           (self.dbVersion == other.dbVersion && self.columnVersion > other.columnVersion) {
            return .happensBefore
        }

        if other.dbVersion > self.dbVersion ||
           (other.dbVersion == self.dbVersion && other.columnVersion > self.columnVersion) {
            return .happensAfter
        }

        return .concurrent
    }

    public enum CRDTComparison {
        case happensBefore  // This CRDT is newer
        case happensAfter   // Other CRDT is newer
        case concurrent     // Simultaneous edits, need conflict resolution
    }
}

/// Extended CRDT metadata for tracking synchronization state
public struct CRDTSyncMetadata: Codable, Sendable {
    /// Node ID this metadata belongs to
    public let nodeId: String

    /// When this node was last synchronized successfully
    public var lastSyncedAt: Date?

    /// Vector of known device versions for this node
    /// Maps device ID to their last known version for this node
    public var deviceVersions: [String: UInt64]

    /// Conflict resolution history for debugging
    public var conflictHistory: [ConflictResolutionRecord]

    public init(nodeId: String) {
        self.nodeId = nodeId
        self.lastSyncedAt = nil
        self.deviceVersions = [:]
        self.conflictHistory = []
    }

    /// Records a conflict resolution event
    public mutating func recordConflictResolution(
        strategy: String,
        winnerSiteId: String,
        resolvedAt: Date
    ) {
        let record = ConflictResolutionRecord(
            strategy: strategy,
            winnerSiteId: winnerSiteId,
            resolvedAt: resolvedAt
        )
        conflictHistory.append(record)

        // Keep only last 10 conflict resolutions for memory efficiency
        if conflictHistory.count > 10 {
            conflictHistory.removeFirst(conflictHistory.count - 10)
        }
    }
}

/// Record of a conflict resolution event for audit purposes
public struct ConflictResolutionRecord: Codable, Sendable {
    public let strategy: String
    public let winnerSiteId: String
    public let resolvedAt: Date

    public init(strategy: String, winnerSiteId: String, resolvedAt: Date) {
        self.strategy = strategy
        self.winnerSiteId = winnerSiteId
        self.resolvedAt = resolvedAt
    }
}