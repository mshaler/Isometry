import Foundation
import GRDB

/// Notebook card for capture-shell-preview workflow
/// Integrates with existing Isometry data model and sync infrastructure
public struct NotebookCard: Codable, Sendable, Hashable {
    public let id: String
    public let title: String
    public let markdownContent: String?
    public let properties: [String: String] // Simplified for Phase 6.1
    public let templateId: String?
    public let createdAt: Date
    public let modifiedAt: Date
    public let folder: String?
    public let tags: [String]
    public let linkedNodeId: String?

    // CloudKit sync fields (matching Node patterns)
    public let syncVersion: Int
    public let lastSyncedAt: Date?
    public let conflictResolvedAt: Date?
    public let deletedAt: Date?

    public init(
        id: String = UUID().uuidString,
        title: String,
        markdownContent: String? = nil,
        properties: [String: String] = [:],
        templateId: String? = nil,
        createdAt: Date = Date(),
        modifiedAt: Date = Date(),
        folder: String? = nil,
        tags: [String] = [],
        linkedNodeId: String? = nil,
        syncVersion: Int = 0,
        lastSyncedAt: Date? = nil,
        conflictResolvedAt: Date? = nil,
        deletedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.markdownContent = markdownContent
        self.properties = properties
        self.templateId = templateId
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.folder = folder
        self.tags = tags
        self.linkedNodeId = linkedNodeId
        self.syncVersion = syncVersion
        self.lastSyncedAt = lastSyncedAt
        self.conflictResolvedAt = conflictResolvedAt
        self.deletedAt = deletedAt
    }

    // MARK: - Computed Properties

    /// Whether this card is deleted (soft delete)
    public var isDeleted: Bool {
        return deletedAt != nil
    }

    /// Update with new modified date and sync version
    public func updated() -> NotebookCard {
        return NotebookCard(
            id: id,
            title: title,
            markdownContent: markdownContent,
            properties: properties,
            templateId: templateId,
            createdAt: createdAt,
            modifiedAt: Date(),
            folder: folder,
            tags: tags,
            linkedNodeId: linkedNodeId,
            syncVersion: syncVersion + 1,
            lastSyncedAt: lastSyncedAt,
            conflictResolvedAt: conflictResolvedAt,
            deletedAt: deletedAt
        )
    }
}

// MARK: - GRDB Record Conformance

extension NotebookCard: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "notebook_cards"

    // Custom column mapping for snake_case database columns
    enum Columns {
        static let id = Column(CodingKeys.id)
        static let title = Column(CodingKeys.title)
        static let markdownContent = Column(CodingKeys.markdownContent)
        static let properties = Column(CodingKeys.properties)
        static let templateId = Column(CodingKeys.templateId)
        static let createdAt = Column(CodingKeys.createdAt)
        static let modifiedAt = Column(CodingKeys.modifiedAt)
        static let folder = Column(CodingKeys.folder)
        static let tags = Column(CodingKeys.tags)
        static let linkedNodeId = Column(CodingKeys.linkedNodeId)
        static let syncVersion = Column(CodingKeys.syncVersion)
        static let lastSyncedAt = Column(CodingKeys.lastSyncedAt)
        static let conflictResolvedAt = Column(CodingKeys.conflictResolvedAt)
        static let deletedAt = Column(CodingKeys.deletedAt)
    }

    // Custom decoding for JSON fields (properties and tags)
    public init(row: Row) throws {
        let id: String = row[CodingKeys.id.rawValue]
        let title: String = row[CodingKeys.title.rawValue]
        let markdownContent: String? = row[CodingKeys.markdownContent.rawValue]
        let templateId: String? = row[CodingKeys.templateId.rawValue]
        let createdAt: Date = row[CodingKeys.createdAt.rawValue]
        let modifiedAt: Date = row[CodingKeys.modifiedAt.rawValue]
        let folder: String? = row[CodingKeys.folder.rawValue]
        let linkedNodeId: String? = row[CodingKeys.linkedNodeId.rawValue]
        let syncVersion: Int = row[CodingKeys.syncVersion.rawValue]
        let lastSyncedAt: Date? = row[CodingKeys.lastSyncedAt.rawValue]
        let conflictResolvedAt: Date? = row[CodingKeys.conflictResolvedAt.rawValue]
        let deletedAt: Date? = row[CodingKeys.deletedAt.rawValue]

        // Decode properties from JSON string
        let properties: [String: String]
        if let propertiesJSON: String = row[CodingKeys.properties.rawValue],
           let data = propertiesJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            properties = decoded
        } else {
            properties = [:]
        }

        // Decode tags from JSON string (matching Node pattern)
        let tags: [String]
        if let tagsJSON: String = row[CodingKeys.tags.rawValue],
           let data = tagsJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            tags = decoded
        } else {
            tags = []
        }

        self.init(
            id: id,
            title: title,
            markdownContent: markdownContent,
            properties: properties,
            templateId: templateId,
            createdAt: createdAt,
            modifiedAt: modifiedAt,
            folder: folder,
            tags: tags,
            linkedNodeId: linkedNodeId,
            syncVersion: syncVersion,
            lastSyncedAt: lastSyncedAt,
            conflictResolvedAt: conflictResolvedAt,
            deletedAt: deletedAt
        )
    }

    // Custom encoding for JSON fields
    public func encode(to container: inout PersistenceContainer) throws {
        container[CodingKeys.id.rawValue] = id
        container[CodingKeys.title.rawValue] = title
        container[CodingKeys.markdownContent.rawValue] = markdownContent
        container[CodingKeys.templateId.rawValue] = templateId
        container[CodingKeys.createdAt.rawValue] = createdAt
        container[CodingKeys.modifiedAt.rawValue] = modifiedAt
        container[CodingKeys.folder.rawValue] = folder
        container[CodingKeys.linkedNodeId.rawValue] = linkedNodeId
        container[CodingKeys.syncVersion.rawValue] = syncVersion
        container[CodingKeys.lastSyncedAt.rawValue] = lastSyncedAt
        container[CodingKeys.conflictResolvedAt.rawValue] = conflictResolvedAt
        container[CodingKeys.deletedAt.rawValue] = deletedAt

        // Encode properties as JSON string
        let propertiesData = try JSONEncoder().encode(properties)
        container[CodingKeys.properties.rawValue] = String(data: propertiesData, encoding: .utf8)

        // Encode tags as JSON string (matching Node pattern)
        let tagsData = try JSONEncoder().encode(tags)
        container[CodingKeys.tags.rawValue] = String(data: tagsData, encoding: .utf8)
    }
}

// MARK: - CodingKeys

extension NotebookCard {
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case markdownContent = "markdown_content"
        case properties
        case templateId = "template_id"
        case createdAt = "created_at"
        case modifiedAt = "modified_at"
        case folder
        case tags
        case linkedNodeId = "linked_node_id"
        case syncVersion = "sync_version"
        case lastSyncedAt = "last_synced_at"
        case conflictResolvedAt = "conflict_resolved_at"
        case deletedAt = "deleted_at"
    }
}

// MARK: - Associations

extension NotebookCard {
    /// Association to linked Node
    static let linkedNode = belongsTo(Node.self, key: "linkedNodeId")

    /// The linked node, if any
    var linkedNode: QueryInterfaceRequest<Node> {
        request(for: NotebookCard.linkedNode)
    }
}

// MARK: - Query Extensions

extension NotebookCard {
    /// Query for active (non-deleted) notebook cards
    static var active: QueryInterfaceRequest<NotebookCard> {
        filter(Columns.deletedAt == nil)
    }

    /// Query for notebook cards by folder
    static func inFolder(_ folder: String?) -> QueryInterfaceRequest<NotebookCard> {
        if let folder = folder {
            return filter(Columns.folder == folder)
        } else {
            return filter(Columns.folder == nil)
        }
    }

    /// Query for notebook cards with specific tag
    static func withTag(_ tag: String) -> QueryInterfaceRequest<NotebookCard> {
        filter(sql: "json_extract(tags, '$') LIKE '%' || ? || '%'", arguments: [tag])
    }

    /// Order by creation date (newest first)
    static var byCreationDate: QueryInterfaceRequest<NotebookCard> {
        order(Columns.createdAt.desc)
    }

    /// Order by modification date (newest first)
    static var byModificationDate: QueryInterfaceRequest<NotebookCard> {
        order(Columns.modifiedAt.desc)
    }
}