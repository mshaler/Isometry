import Foundation
import GRDB

/// Edge types for graph relationships
public enum EdgeType: String, Codable, Sendable, CaseIterable {
    case link = "LINK"           // Explicit user-created link
    case nest = "NEST"           // Parent-child hierarchy
    case sequence = "SEQUENCE"   // Ordered sequence
    case affinity = "AFFINITY"   // Computed similarity
}

/// Relationship between two nodes in the graph
public struct Edge: Codable, Sendable, Identifiable, Hashable {
    // MARK: - Core Identity
    public let id: String
    public var edgeType: EdgeType
    public var sourceId: String
    public var targetId: String

    // MARK: - Attributes
    public var label: String?
    public var weight: Double
    public var directed: Bool
    public var sequenceOrder: Int?

    // MARK: - Communication metadata (for email/message edges)
    public var channel: String?
    public var timestamp: Date?
    public var subject: String?

    // MARK: - Timestamps
    public var createdAt: Date

    // MARK: - Sync
    public var syncVersion: Int

    // MARK: - Initialization

    public init(
        id: String = UUID().uuidString,
        edgeType: EdgeType,
        sourceId: String,
        targetId: String,
        label: String? = nil,
        weight: Double = 1.0,
        directed: Bool = true,
        sequenceOrder: Int? = nil,
        channel: String? = nil,
        timestamp: Date? = nil,
        subject: String? = nil,
        createdAt: Date = Date(),
        syncVersion: Int = 0
    ) {
        self.id = id
        self.edgeType = edgeType
        self.sourceId = sourceId
        self.targetId = targetId
        self.label = label
        self.weight = weight
        self.directed = directed
        self.sequenceOrder = sequenceOrder
        self.channel = channel
        self.timestamp = timestamp
        self.subject = subject
        self.createdAt = createdAt
        self.syncVersion = syncVersion
    }
}

// MARK: - GRDB Record Conformance

extension Edge: FetchableRecord, PersistableRecord {
    public static let databaseTableName = "edges"

    enum Columns {
        static let id = Column(CodingKeys.id)
        static let edgeType = Column(CodingKeys.edgeType)
        static let sourceId = Column(CodingKeys.sourceId)
        static let targetId = Column(CodingKeys.targetId)
        static let label = Column(CodingKeys.label)
        static let weight = Column(CodingKeys.weight)
        static let directed = Column(CodingKeys.directed)
        static let sequenceOrder = Column(CodingKeys.sequenceOrder)
        static let channel = Column(CodingKeys.channel)
        static let timestamp = Column(CodingKeys.timestamp)
        static let subject = Column(CodingKeys.subject)
        static let createdAt = Column(CodingKeys.createdAt)
        static let syncVersion = Column(CodingKeys.syncVersion)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case edgeType = "edge_type"
        case sourceId = "source_id"
        case targetId = "target_id"
        case label
        case weight
        case directed
        case sequenceOrder = "sequence_order"
        case channel
        case timestamp
        case subject
        case createdAt = "created_at"
        case syncVersion = "sync_version"
    }

    public init(row: Row) throws {
        id = row[CodingKeys.id.rawValue]
        sourceId = row[CodingKeys.sourceId.rawValue]
        targetId = row[CodingKeys.targetId.rawValue]
        label = row[CodingKeys.label.rawValue]
        weight = row[CodingKeys.weight.rawValue]
        sequenceOrder = row[CodingKeys.sequenceOrder.rawValue]
        channel = row[CodingKeys.channel.rawValue]
        timestamp = row[CodingKeys.timestamp.rawValue]
        subject = row[CodingKeys.subject.rawValue]
        createdAt = row[CodingKeys.createdAt.rawValue]
        syncVersion = row[CodingKeys.syncVersion.rawValue]

        // Decode directed as Bool from Int
        let directedInt: Int = row[CodingKeys.directed.rawValue]
        directed = directedInt != 0

        // Decode edgeType from string
        let edgeTypeString: String = row[CodingKeys.edgeType.rawValue]
        edgeType = EdgeType(rawValue: edgeTypeString) ?? .link
    }

    public func encode(to container: inout PersistenceContainer) throws {
        container[CodingKeys.id.rawValue] = id
        container[CodingKeys.edgeType.rawValue] = edgeType.rawValue
        container[CodingKeys.sourceId.rawValue] = sourceId
        container[CodingKeys.targetId.rawValue] = targetId
        container[CodingKeys.label.rawValue] = label
        container[CodingKeys.weight.rawValue] = weight
        container[CodingKeys.directed.rawValue] = directed ? 1 : 0
        container[CodingKeys.sequenceOrder.rawValue] = sequenceOrder
        container[CodingKeys.channel.rawValue] = channel
        container[CodingKeys.timestamp.rawValue] = timestamp
        container[CodingKeys.subject.rawValue] = subject
        container[CodingKeys.createdAt.rawValue] = createdAt
        container[CodingKeys.syncVersion.rawValue] = syncVersion
    }
}

// MARK: - Associations

extension Edge {
    static let source = belongsTo(Node.self, using: ForeignKey(["source_id"]))
    static let target = belongsTo(Node.self, using: ForeignKey(["target_id"]))

    var source: QueryInterfaceRequest<Node> {
        request(for: Edge.source)
    }

    var target: QueryInterfaceRequest<Node> {
        request(for: Edge.target)
    }
}
