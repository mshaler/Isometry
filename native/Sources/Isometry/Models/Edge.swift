import Foundation
import GRDB
import IsometryCore

// Import the core Edge entities and extend them with GRDB functionality
public typealias EdgeType = IsometryCore.EdgeType
public typealias Edge = IsometryCore.Edge

// MARK: - GRDB Record Conformance

extension IsometryCore.Edge {
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

    public init(row: Row) throws {
        let id: String = row[CodingKeys.id.rawValue]
        let sourceId: String = row[CodingKeys.sourceId.rawValue]
        let targetId: String = row[CodingKeys.targetId.rawValue]
        let label: String? = row[CodingKeys.label.rawValue]
        let weight: Double = row[CodingKeys.weight.rawValue]
        let sequenceOrder: Int? = row[CodingKeys.sequenceOrder.rawValue]
        let channel: String? = row[CodingKeys.channel.rawValue]
        let timestamp: Date? = row[CodingKeys.timestamp.rawValue]
        let subject: String? = row[CodingKeys.subject.rawValue]
        let createdAt: Date = row[CodingKeys.createdAt.rawValue]
        let syncVersion: Int = row[CodingKeys.syncVersion.rawValue]

        // Decode directed as Bool from Int
        let directedInt: Int = row[CodingKeys.directed.rawValue]
        let directed = directedInt != 0

        // Decode edgeType from string
        let edgeTypeString: String = row[CodingKeys.edgeType.rawValue]
        let edgeType = EdgeType(rawValue: edgeTypeString) ?? .link

        // Initialize using the core Edge initializer
        self.init(
            id: id,
            edgeType: edgeType,
            sourceId: sourceId,
            targetId: targetId,
            label: label,
            weight: weight,
            directed: directed,
            sequenceOrder: sequenceOrder,
            channel: channel,
            timestamp: timestamp,
            subject: subject,
            createdAt: createdAt,
            syncVersion: syncVersion
        )
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

extension IsometryCore.Edge {
    static let source = belongsTo(IsometryCore.Node.self, using: ForeignKey(["source_id"]))
    static let target = belongsTo(IsometryCore.Node.self, using: ForeignKey(["target_id"]))

    var source: QueryInterfaceRequest<IsometryCore.Node> {
        request(for: IsometryCore.Edge.source)
    }

    var target: QueryInterfaceRequest<IsometryCore.Node> {
        request(for: IsometryCore.Edge.target)
    }
}