import Foundation
import Vapor
import IsometryCore

/// Data Transfer Object for Node API responses
/// Converts internal Node model to JSON-serializable format
public struct NodeDTO: Content {
    let id: String
    let nodeType: String
    let name: String
    let content: String?
    let summary: String?

    // Location (LATCH)
    let latitude: Double?
    let longitude: Double?
    let locationName: String?
    let locationAddress: String?

    // Time (LATCH)
    let createdAt: Date
    let modifiedAt: Date
    let dueAt: Date?
    let completedAt: Date?
    let eventStart: Date?
    let eventEnd: Date?

    // Category (LATCH)
    let folder: String?
    let tags: [String]
    let status: String?

    // Hierarchy (LATCH)
    let priority: Int
    let importance: Int
    let sortOrder: Int

    // Metadata
    let source: String?
    let sourceId: String?
    let sourceUrl: String?
    let version: Int

    /// Initialize from Node domain entity
    public init(_ node: Node) {
        self.id = node.id
        self.nodeType = node.nodeType
        self.name = node.name
        self.content = node.content
        self.summary = node.summary
        self.latitude = node.latitude
        self.longitude = node.longitude
        self.locationName = node.locationName
        self.locationAddress = node.locationAddress
        self.createdAt = node.createdAt
        self.modifiedAt = node.modifiedAt
        self.dueAt = node.dueAt
        self.completedAt = node.completedAt
        self.eventStart = node.eventStart
        self.eventEnd = node.eventEnd
        self.folder = node.folder
        self.tags = node.tags
        self.status = node.status
        self.priority = node.priority
        self.importance = node.importance
        self.sortOrder = node.sortOrder
        self.source = node.source
        self.sourceId = node.sourceId
        self.sourceUrl = node.sourceUrl
        self.version = node.version
    }
}

/// Simplified Node DTO for list responses (excludes large content fields)
public struct NodeSummaryDTO: Content {
    let id: String
    let nodeType: String
    let name: String
    let summary: String?
    let folder: String?
    let tags: [String]
    let priority: Int
    let importance: Int
    let createdAt: Date
    let modifiedAt: Date
    let dueAt: Date?
    let completedAt: Date?

    public init(_ node: Node) {
        self.id = node.id
        self.nodeType = node.nodeType
        self.name = node.name
        self.summary = node.summary
        self.folder = node.folder
        self.tags = node.tags
        self.priority = node.priority
        self.importance = node.importance
        self.createdAt = node.createdAt
        self.modifiedAt = node.modifiedAt
        self.dueAt = node.dueAt
        self.completedAt = node.completedAt
    }
}

/// Location-specific Node DTO for map responses
public struct NodeLocationDTO: Content {
    let id: String
    let name: String
    let latitude: Double
    let longitude: Double
    let locationName: String?
    let locationAddress: String?
    let nodeType: String
    let priority: Int

    public init?(_ node: Node) {
        guard let latitude = node.latitude, let longitude = node.longitude else {
            return nil
        }

        self.id = node.id
        self.name = node.name
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = node.locationName
        self.locationAddress = node.locationAddress
        self.nodeType = node.nodeType
        self.priority = node.priority
    }
}