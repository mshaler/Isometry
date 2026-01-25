import Foundation

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

// MARK: - Coding Keys for JSON Serialization

extension Edge {
    public enum CodingKeys: String, CodingKey {
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
}