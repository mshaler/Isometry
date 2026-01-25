import Foundation

/// Primary data entity representing a card in Isometry
public struct Node: Codable, Sendable, Identifiable, Hashable {
    // MARK: - Core Identity
    public let id: String
    public var nodeType: String
    public var name: String
    public var content: String?
    public var summary: String?

    // MARK: - LATCH: Location
    public var latitude: Double?
    public var longitude: Double?
    public var locationName: String?
    public var locationAddress: String?

    // MARK: - LATCH: Time
    public var createdAt: Date
    public var modifiedAt: Date
    public var dueAt: Date?
    public var completedAt: Date?
    public var eventStart: Date?
    public var eventEnd: Date?

    // MARK: - LATCH: Category
    public var folder: String?
    public var tags: [String]
    public var status: String?

    // MARK: - LATCH: Hierarchy
    public var priority: Int
    public var importance: Int
    public var sortOrder: Int

    // MARK: - Metadata
    public var source: String?
    public var sourceId: String?
    public var sourceUrl: String?
    public var deletedAt: Date?
    public var version: Int

    // MARK: - Sync
    public var syncVersion: Int
    public var lastSyncedAt: Date?
    public var conflictResolvedAt: Date?

    // MARK: - Initialization

    public init(
        id: String = UUID().uuidString,
        nodeType: String = "note",
        name: String,
        content: String? = nil,
        summary: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        locationName: String? = nil,
        locationAddress: String? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        dueAt: Date? = nil,
        completedAt: Date? = nil,
        eventStart: Date? = nil,
        eventEnd: Date? = nil,
        folder: String? = nil,
        tags: [String] = [],
        status: String? = nil,
        priority: Int = 0,
        importance: Int = 0,
        sortOrder: Int = 0,
        source: String? = nil,
        sourceId: String? = nil,
        sourceUrl: String? = nil,
        deletedAt: Date? = nil,
        version: Int = 1,
        syncVersion: Int = 0,
        lastSyncedAt: Date? = nil,
        conflictResolvedAt: Date? = nil
    ) {
        self.id = id
        self.nodeType = nodeType
        self.name = name
        self.content = content
        self.summary = summary
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = locationName
        self.locationAddress = locationAddress
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.dueAt = dueAt
        self.completedAt = completedAt
        self.eventStart = eventStart
        self.eventEnd = eventEnd
        self.folder = folder
        self.tags = tags
        self.status = status
        self.priority = priority
        self.importance = importance
        self.sortOrder = sortOrder
        self.source = source
        self.sourceId = sourceId
        self.sourceUrl = sourceUrl
        self.deletedAt = deletedAt
        self.version = version
        self.syncVersion = syncVersion
        self.lastSyncedAt = lastSyncedAt
        self.conflictResolvedAt = conflictResolvedAt
    }
}

// MARK: - Coding Keys for JSON Serialization

extension Node {
    public enum CodingKeys: String, CodingKey {
        case id
        case nodeType = "node_type"
        case name
        case content
        case summary
        case latitude
        case longitude
        case locationName = "location_name"
        case locationAddress = "location_address"
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
        case dueAt = "due_at"
        case completedAt = "completed_at"
        case eventStart = "event_start"
        case eventEnd = "event_end"
        case folder
        case tags
        case status
        case priority
        case importance
        case sortOrder = "sort_order"
        case source
        case sourceId = "source_id"
        case sourceUrl = "source_url"
        case deletedAt = "deleted_at"
        case version
        case syncVersion = "sync_version"
        case lastSyncedAt = "last_synced_at"
        case conflictResolvedAt = "conflict_resolved_at"
    }
}

// MARK: - Computed Properties

extension Node {
    /// Whether this node has been soft-deleted
    public var isDeleted: Bool {
        deletedAt != nil
    }

    /// Whether this node has location data
    public var hasLocation: Bool {
        latitude != nil && longitude != nil
    }

    /// Whether this node is overdue
    public var isOverdue: Bool {
        guard let dueAt, completedAt == nil else { return false }
        return dueAt < Date()
    }
}