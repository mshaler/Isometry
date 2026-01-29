import Foundation
import GRDB
import IsometryCore

// Import the core Node entity and extend it with GRDB functionality
public typealias Node = IsometryCore.Node

// MARK: - GRDB Record Conformance

extension IsometryCore.Node {
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

    // Custom decoding for tags JSON array
    public init(row: Row) throws {
        let id: String = row[CodingKeys.id.rawValue]
        let nodeType: String = row[CodingKeys.nodeType.rawValue]
        let name: String = row[CodingKeys.name.rawValue]
        let content: String? = row[CodingKeys.content.rawValue]
        let summary: String? = row[CodingKeys.summary.rawValue]
        let latitude: Double? = row[CodingKeys.latitude.rawValue]
        let longitude: Double? = row[CodingKeys.longitude.rawValue]
        let locationName: String? = row[CodingKeys.locationName.rawValue]
        let locationAddress: String? = row[CodingKeys.locationAddress.rawValue]
        let createdAt: Date = row[CodingKeys.createdAt.rawValue]
        let modifiedAt: Date = row[CodingKeys.modifiedAt.rawValue]
        let dueAt: Date? = row[CodingKeys.dueAt.rawValue]
        let completedAt: Date? = row[CodingKeys.completedAt.rawValue]
        let eventStart: Date? = row[CodingKeys.eventStart.rawValue]
        let eventEnd: Date? = row[CodingKeys.eventEnd.rawValue]
        let folder: String? = row[CodingKeys.folder.rawValue]
        let status: String? = row[CodingKeys.status.rawValue]
        let priority: Int = row[CodingKeys.priority.rawValue]
        let importance: Int = row[CodingKeys.importance.rawValue]
        let sortOrder: Int = row[CodingKeys.sortOrder.rawValue]
        let source: String? = row[CodingKeys.source.rawValue]
        let sourceId: String? = row[CodingKeys.sourceId.rawValue]
        let sourceUrl: String? = row[CodingKeys.sourceUrl.rawValue]
        let deletedAt: Date? = row[CodingKeys.deletedAt.rawValue]
        let version: Int = row[CodingKeys.version.rawValue]
        let syncVersion: Int = row[CodingKeys.syncVersion.rawValue]
        let lastSyncedAt: Date? = row[CodingKeys.lastSyncedAt.rawValue]
        let conflictResolvedAt: Date? = row[CodingKeys.conflictResolvedAt.rawValue]

        // Decode tags from JSON string
        let tags: [String]
        if let tagsJSON: String = row[CodingKeys.tags.rawValue],
           let data = tagsJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            tags = decoded
        } else {
            tags = []
        }

        // Initialize using the core Node initializer
        self.init(
            id: id,
            nodeType: nodeType,
            name: name,
            content: content,
            summary: summary,
            latitude: latitude,
            longitude: longitude,
            locationName: locationName,
            locationAddress: locationAddress,
            createdAt: createdAt,
            modifiedAt: modifiedAt,
            dueAt: dueAt,
            completedAt: completedAt,
            eventStart: eventStart,
            eventEnd: eventEnd,
            folder: folder,
            tags: tags,
            status: status,
            priority: priority,
            importance: importance,
            sortOrder: sortOrder,
            source: source,
            sourceId: sourceId,
            sourceUrl: sourceUrl,
            deletedAt: deletedAt,
            version: version,
            syncVersion: syncVersion,
            lastSyncedAt: lastSyncedAt,
            conflictResolvedAt: conflictResolvedAt
        )
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