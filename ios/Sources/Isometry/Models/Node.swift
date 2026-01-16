import Foundation
import GRDB

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

// MARK: - GRDB Record Conformance

extension Node: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "nodes"

    // Custom column mapping for snake_case database columns
    enum Columns {
        static let id = Column(CodingKeys.id)
        static let nodeType = Column(CodingKeys.nodeType)
        static let name = Column(CodingKeys.name)
        static let content = Column(CodingKeys.content)
        static let summary = Column(CodingKeys.summary)
        static let latitude = Column(CodingKeys.latitude)
        static let longitude = Column(CodingKeys.longitude)
        static let locationName = Column(CodingKeys.locationName)
        static let locationAddress = Column(CodingKeys.locationAddress)
        static let createdAt = Column(CodingKeys.createdAt)
        static let modifiedAt = Column(CodingKeys.modifiedAt)
        static let dueAt = Column(CodingKeys.dueAt)
        static let completedAt = Column(CodingKeys.completedAt)
        static let eventStart = Column(CodingKeys.eventStart)
        static let eventEnd = Column(CodingKeys.eventEnd)
        static let folder = Column(CodingKeys.folder)
        static let tags = Column(CodingKeys.tags)
        static let status = Column(CodingKeys.status)
        static let priority = Column(CodingKeys.priority)
        static let importance = Column(CodingKeys.importance)
        static let sortOrder = Column(CodingKeys.sortOrder)
        static let source = Column(CodingKeys.source)
        static let sourceId = Column(CodingKeys.sourceId)
        static let sourceUrl = Column(CodingKeys.sourceUrl)
        static let deletedAt = Column(CodingKeys.deletedAt)
        static let version = Column(CodingKeys.version)
        static let syncVersion = Column(CodingKeys.syncVersion)
        static let lastSyncedAt = Column(CodingKeys.lastSyncedAt)
        static let conflictResolvedAt = Column(CodingKeys.conflictResolvedAt)
    }

    enum CodingKeys: String, CodingKey {
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

    // Custom decoding for tags JSON array
    public init(row: Row) throws {
        id = row[CodingKeys.id.rawValue]
        nodeType = row[CodingKeys.nodeType.rawValue]
        name = row[CodingKeys.name.rawValue]
        content = row[CodingKeys.content.rawValue]
        summary = row[CodingKeys.summary.rawValue]
        latitude = row[CodingKeys.latitude.rawValue]
        longitude = row[CodingKeys.longitude.rawValue]
        locationName = row[CodingKeys.locationName.rawValue]
        locationAddress = row[CodingKeys.locationAddress.rawValue]
        createdAt = row[CodingKeys.createdAt.rawValue]
        modifiedAt = row[CodingKeys.modifiedAt.rawValue]
        dueAt = row[CodingKeys.dueAt.rawValue]
        completedAt = row[CodingKeys.completedAt.rawValue]
        eventStart = row[CodingKeys.eventStart.rawValue]
        eventEnd = row[CodingKeys.eventEnd.rawValue]
        folder = row[CodingKeys.folder.rawValue]
        status = row[CodingKeys.status.rawValue]
        priority = row[CodingKeys.priority.rawValue]
        importance = row[CodingKeys.importance.rawValue]
        sortOrder = row[CodingKeys.sortOrder.rawValue]
        source = row[CodingKeys.source.rawValue]
        sourceId = row[CodingKeys.sourceId.rawValue]
        sourceUrl = row[CodingKeys.sourceUrl.rawValue]
        deletedAt = row[CodingKeys.deletedAt.rawValue]
        version = row[CodingKeys.version.rawValue]
        syncVersion = row[CodingKeys.syncVersion.rawValue]
        lastSyncedAt = row[CodingKeys.lastSyncedAt.rawValue]
        conflictResolvedAt = row[CodingKeys.conflictResolvedAt.rawValue]

        // Decode tags from JSON string
        if let tagsJSON: String = row[CodingKeys.tags.rawValue],
           let data = tagsJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            tags = decoded
        } else {
            tags = []
        }
    }

    // Custom encoding for tags JSON array
    public func encode(to container: inout PersistenceContainer) throws {
        container[CodingKeys.id.rawValue] = id
        container[CodingKeys.nodeType.rawValue] = nodeType
        container[CodingKeys.name.rawValue] = name
        container[CodingKeys.content.rawValue] = content
        container[CodingKeys.summary.rawValue] = summary
        container[CodingKeys.latitude.rawValue] = latitude
        container[CodingKeys.longitude.rawValue] = longitude
        container[CodingKeys.locationName.rawValue] = locationName
        container[CodingKeys.locationAddress.rawValue] = locationAddress
        container[CodingKeys.createdAt.rawValue] = createdAt
        container[CodingKeys.modifiedAt.rawValue] = modifiedAt
        container[CodingKeys.dueAt.rawValue] = dueAt
        container[CodingKeys.completedAt.rawValue] = completedAt
        container[CodingKeys.eventStart.rawValue] = eventStart
        container[CodingKeys.eventEnd.rawValue] = eventEnd
        container[CodingKeys.folder.rawValue] = folder
        container[CodingKeys.status.rawValue] = status
        container[CodingKeys.priority.rawValue] = priority
        container[CodingKeys.importance.rawValue] = importance
        container[CodingKeys.sortOrder.rawValue] = sortOrder
        container[CodingKeys.source.rawValue] = source
        container[CodingKeys.sourceId.rawValue] = sourceId
        container[CodingKeys.sourceUrl.rawValue] = sourceUrl
        container[CodingKeys.deletedAt.rawValue] = deletedAt
        container[CodingKeys.version.rawValue] = version
        container[CodingKeys.syncVersion.rawValue] = syncVersion
        container[CodingKeys.lastSyncedAt.rawValue] = lastSyncedAt
        container[CodingKeys.conflictResolvedAt.rawValue] = conflictResolvedAt

        // Encode tags as JSON string
        if let data = try? JSONEncoder().encode(tags),
           let jsonString = String(data: data, encoding: .utf8) {
            container[CodingKeys.tags.rawValue] = jsonString
        } else {
            container[CodingKeys.tags.rawValue] = "[]"
        }
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
