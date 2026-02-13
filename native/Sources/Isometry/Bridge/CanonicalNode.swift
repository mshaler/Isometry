/**
 * CanonicalNode Swift model matching TypeScript CanonicalNode schema
 *
 * This is the Swift counterpart to src/etl/types/canonical.ts.
 * Used for decoding JSON responses from window.isometryETL.importFile().
 *
 * LATCH Mapping:
 * - L (Location): latitude, longitude, locationName, locationAddress
 * - A (Alphabet): name (primary sort key)
 * - T (Time): createdAt, modifiedAt, dueAt, completedAt, eventStart, eventEnd
 * - C (Category): nodeType, folder, tags, status
 * - H (Hierarchy): priority, importance, sortOrder
 *
 * Note: Uses existing AnyCodable from SyncCoordinator.swift for properties dictionary.
 */

import Foundation

// MARK: - CanonicalNode

/// Swift Codable struct matching TypeScript CanonicalNode schema.
/// All ETL operations between Swift and JavaScript use this format.
/// Note: Cannot conform to Equatable because AnyCodable doesn't conform to Equatable.
public struct CanonicalNode: Codable, Sendable {
    // Core Identity
    public let id: String
    public let nodeType: String
    public let name: String
    public let content: String?
    public let summary: String?

    // LATCH: Location
    public let latitude: Double?
    public let longitude: Double?
    public let locationName: String?
    public let locationAddress: String?

    // LATCH: Time (ISO 8601 strings)
    public let createdAt: String
    public let modifiedAt: String
    public let dueAt: String?
    public let completedAt: String?
    public let eventStart: String?
    public let eventEnd: String?

    // LATCH: Category
    public let folder: String?
    public let tags: [String]
    public let status: String?

    // LATCH: Hierarchy
    public let priority: Int
    public let importance: Int
    public let sortOrder: Int

    // Grid positioning (SuperGrid)
    public let gridX: Double
    public let gridY: Double

    // Provenance
    public let source: String?
    public let sourceId: String?
    public let sourceUrl: String?

    // Lifecycle
    public let deletedAt: String?
    public let version: Int

    // Extension point for format-specific metadata
    public let properties: [String: AnyCodable]?

    // MARK: - CodingKeys for JSON mapping

    enum CodingKeys: String, CodingKey {
        case id
        case nodeType = "nodeType"
        case name
        case content
        case summary
        case latitude
        case longitude
        case locationName = "locationName"
        case locationAddress = "locationAddress"
        case createdAt = "createdAt"
        case modifiedAt = "modifiedAt"
        case dueAt = "dueAt"
        case completedAt = "completedAt"
        case eventStart = "eventStart"
        case eventEnd = "eventEnd"
        case folder
        case tags
        case status
        case priority
        case importance
        case sortOrder = "sortOrder"
        case gridX = "gridX"
        case gridY = "gridY"
        case source
        case sourceId = "sourceId"
        case sourceUrl = "sourceUrl"
        case deletedAt = "deletedAt"
        case version
        case properties
    }

    // MARK: - Default value handling

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Required fields
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        modifiedAt = try container.decode(String.self, forKey: .modifiedAt)

        // Optional fields with defaults
        nodeType = try container.decodeIfPresent(String.self, forKey: .nodeType) ?? "note"
        content = try container.decodeIfPresent(String.self, forKey: .content)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)

        // Location
        latitude = try container.decodeIfPresent(Double.self, forKey: .latitude)
        longitude = try container.decodeIfPresent(Double.self, forKey: .longitude)
        locationName = try container.decodeIfPresent(String.self, forKey: .locationName)
        locationAddress = try container.decodeIfPresent(String.self, forKey: .locationAddress)

        // Time
        dueAt = try container.decodeIfPresent(String.self, forKey: .dueAt)
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        eventStart = try container.decodeIfPresent(String.self, forKey: .eventStart)
        eventEnd = try container.decodeIfPresent(String.self, forKey: .eventEnd)

        // Category
        folder = try container.decodeIfPresent(String.self, forKey: .folder)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        status = try container.decodeIfPresent(String.self, forKey: .status)

        // Hierarchy
        priority = try container.decodeIfPresent(Int.self, forKey: .priority) ?? 0
        importance = try container.decodeIfPresent(Int.self, forKey: .importance) ?? 0
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0

        // Grid
        gridX = try container.decodeIfPresent(Double.self, forKey: .gridX) ?? 0
        gridY = try container.decodeIfPresent(Double.self, forKey: .gridY) ?? 0

        // Provenance
        source = try container.decodeIfPresent(String.self, forKey: .source)
        sourceId = try container.decodeIfPresent(String.self, forKey: .sourceId)
        sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl)

        // Lifecycle
        deletedAt = try container.decodeIfPresent(String.self, forKey: .deletedAt)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1

        // Properties
        properties = try container.decodeIfPresent([String: AnyCodable].self, forKey: .properties)
    }

    // MARK: - Full initializer

    public init(
        id: String,
        nodeType: String = "note",
        name: String,
        content: String? = nil,
        summary: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        locationName: String? = nil,
        locationAddress: String? = nil,
        createdAt: String,
        modifiedAt: String,
        dueAt: String? = nil,
        completedAt: String? = nil,
        eventStart: String? = nil,
        eventEnd: String? = nil,
        folder: String? = nil,
        tags: [String] = [],
        status: String? = nil,
        priority: Int = 0,
        importance: Int = 0,
        sortOrder: Int = 0,
        gridX: Double = 0,
        gridY: Double = 0,
        source: String? = nil,
        sourceId: String? = nil,
        sourceUrl: String? = nil,
        deletedAt: String? = nil,
        version: Int = 1,
        properties: [String: AnyCodable]? = nil
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
        self.gridX = gridX
        self.gridY = gridY
        self.source = source
        self.sourceId = sourceId
        self.sourceUrl = sourceUrl
        self.deletedAt = deletedAt
        self.version = version
        self.properties = properties
    }
}

// MARK: - Convenience Initializers

public extension CanonicalNode {
    /// Create an event node (calendar event)
    static func event(
        id: String = UUID().uuidString,
        name: String,
        content: String? = nil,
        eventStart: String,
        eventEnd: String,
        folder: String? = nil,
        source: String = "eventkit",
        sourceId: String? = nil
    ) -> CanonicalNode {
        let now = ISO8601DateFormatter().string(from: Date())
        return CanonicalNode(
            id: id,
            nodeType: "event",
            name: name,
            content: content,
            createdAt: now,
            modifiedAt: now,
            eventStart: eventStart,
            eventEnd: eventEnd,
            folder: folder,
            source: source,
            sourceId: sourceId
        )
    }

    /// Create a person node (contact)
    static func person(
        id: String = UUID().uuidString,
        name: String,
        content: String? = nil,
        summary: String? = nil,
        source: String = "contacts",
        sourceId: String? = nil
    ) -> CanonicalNode {
        let now = ISO8601DateFormatter().string(from: Date())
        return CanonicalNode(
            id: id,
            nodeType: "person",
            name: name,
            content: content,
            summary: summary,
            createdAt: now,
            modifiedAt: now,
            folder: "Contacts",
            source: source,
            sourceId: sourceId
        )
    }

    /// Create a note node
    static func note(
        id: String = UUID().uuidString,
        name: String,
        content: String,
        folder: String? = nil,
        tags: [String] = [],
        source: String = "manual",
        sourceId: String? = nil
    ) -> CanonicalNode {
        let now = ISO8601DateFormatter().string(from: Date())
        return CanonicalNode(
            id: id,
            nodeType: "note",
            name: name,
            content: content,
            createdAt: now,
            modifiedAt: now,
            folder: folder,
            tags: tags,
            source: source,
            sourceId: sourceId
        )
    }
}
