import Foundation
import Vapor
import IsometryCore

/// Data Transfer Object for Edge API responses
/// Converts internal Edge model to JSON-serializable format
public struct EdgeDTO: Content {
    let id: String
    let edgeType: String
    let sourceId: String
    let targetId: String
    let label: String?
    let weight: Double
    let directed: Bool
    let sequenceOrder: Int?

    // Communication metadata
    let channel: String?
    let timestamp: Date?
    let subject: String?

    // Timestamps
    let createdAt: Date

    /// Initialize from Edge domain entity
    public init(_ edge: Edge) {
        self.id = edge.id
        self.edgeType = edge.edgeType.rawValue
        self.sourceId = edge.sourceId
        self.targetId = edge.targetId
        self.label = edge.label
        self.weight = edge.weight
        self.directed = edge.directed
        self.sequenceOrder = edge.sequenceOrder
        self.channel = edge.channel
        self.timestamp = edge.timestamp
        self.subject = edge.subject
        self.createdAt = edge.createdAt
    }
}

/// Simplified Edge DTO for graph visualizations
public struct EdgeSummaryDTO: Content {
    let id: String
    let edgeType: String
    let sourceId: String
    let targetId: String
    let weight: Double
    let label: String?

    public init(_ edge: Edge) {
        self.id = edge.id
        self.edgeType = edge.edgeType.rawValue
        self.sourceId = edge.sourceId
        self.targetId = edge.targetId
        self.weight = edge.weight
        self.label = edge.label
    }
}