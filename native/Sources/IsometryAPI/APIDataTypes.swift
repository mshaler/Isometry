import Foundation
import Isometry

// MARK: - API Node Types

/// API representation of a Node (matches sql.js query results)
public struct APINode: Codable {
    public let id: String
    public let nodeType: String
    public let name: String
    public let folder: String?
    public let content: String?
    public let summary: String?
    public let sourceId: String?
    public let source: String?
    public let sortOrder: Int
    public let tags: [String]
    public let priority: Int
    public let importance: Int
    public let status: String?
    public let createdAt: String
    public let modifiedAt: String
    public let deletedAt: String?
    public let version: Int
    public let syncVersion: Int
    public let lastSyncedAt: String?

    /// Initialize from Core Node model
    public init(node: Isometry.Node) {
        let formatter = ISO8601DateFormatter()

        self.id = node.id
        self.nodeType = node.nodeType
        self.name = node.name
        self.folder = node.folder
        self.content = node.content
        self.summary = node.summary
        self.sourceId = node.sourceId
        self.source = node.source
        self.sortOrder = node.sortOrder
        self.tags = node.tags
        self.priority = node.priority
        self.importance = node.importance
        self.status = node.status
        self.createdAt = formatter.string(from: node.createdAt)
        self.modifiedAt = formatter.string(from: node.modifiedAt)
        self.deletedAt = node.deletedAt.map(formatter.string)
        self.version = node.version
        self.syncVersion = node.syncVersion
        self.lastSyncedAt = node.lastSyncedAt.map(formatter.string)
    }
}

/// Node creation request
public struct APINodeCreate: Codable {
    public let id: String?
    public let nodeType: String?
    public let name: String
    public let folder: String?
    public let content: String?
    public let summary: String?
    public let sourceId: String?
    public let source: String?
    public let sortOrder: Int?
    public let tags: [String]?
    public let priority: Int?
    public let importance: Int?
    public let status: String?
    public let createdAt: Date?
}

/// Node update request
public struct APINodeUpdate: Codable {
    public let name: String?
    public let nodeType: String?
    public let folder: String?
    public let content: String?
    public let summary: String?
    public let tags: [String]?
    public let sortOrder: Int?
    public let priority: Int?
    public let importance: Int?
    public let status: String?
}

// MARK: - API Notebook Card Types

/// API representation of a NotebookCard (matches sql.js query results)
public struct APINotebookCard: Codable {
    public let id: String
    public let nodeId: String?  // Maps to linkedNodeId
    public let title: String
    public let markdownContent: String?
    public let properties: [String: String]?
    public let templateId: String?
    public let folder: String?
    public let tags: [String]?
    public let createdAt: String
    public let modifiedAt: String
    public let deletedAt: String?
    public let syncVersion: Int
    public let lastSyncedAt: String?

    /// Initialize from Core NotebookCard model
    public init(card: Isometry.NotebookCard) {
        let formatter = ISO8601DateFormatter()

        self.id = card.id
        self.nodeId = card.linkedNodeId
        self.title = card.title
        self.markdownContent = card.markdownContent
        self.properties = card.properties
        self.templateId = card.templateId
        self.folder = card.folder
        self.tags = card.tags
        self.createdAt = formatter.string(from: card.createdAt)
        self.modifiedAt = formatter.string(from: card.modifiedAt)
        self.deletedAt = card.deletedAt.map(formatter.string)
        self.syncVersion = card.syncVersion
        self.lastSyncedAt = card.lastSyncedAt.map(formatter.string)
    }
}

/// Notebook card creation request
public struct APINotebookCardCreate: Codable {
    public let id: String?
    public let nodeId: String?  // Maps to linkedNodeId
    public let title: String
    public let markdownContent: String?
    public let properties: [String: String]?
    public let templateId: String?
    public let folder: String?
    public let tags: [String]?
    public let createdAt: Date?
}

/// Notebook card update request
public struct APINotebookCardUpdate: Codable {
    public let title: String?
    public let markdownContent: String?
    public let properties: [String: String]?
    public let templateId: String?
    public let folder: String?
    public let tags: [String]?
}

// MARK: - API Search Types

/// Search result container
public struct APISearchResult: Codable {
    public let nodes: [APINode]
    public let notebookCards: [APINotebookCard]
    public let query: String
    public let totalResults: Int

    public init(nodes: [APINode] = [], notebookCards: [APINotebookCard] = [], query: String) {
        self.nodes = nodes
        self.notebookCards = notebookCards
        self.query = query
        self.totalResults = nodes.count + notebookCards.count
    }
}

// MARK: - API Response Types

/// Generic API response wrapper
public struct APIResponse<T: Codable>: Codable {
    public let data: T
    public let timestamp: String
    public let status: String

    public init(data: T, status: String = "success") {
        self.data = data
        self.timestamp = ISO8601DateFormatter().string(from: Date())
        self.status = status
    }
}

/// Error response
public struct APIError: Codable, Error {
    public let error: String
    public let code: String
    public let timestamp: String
    public let details: [String: String]?

    public init(error: String, code: String = "INTERNAL_ERROR", details: [String: String]? = nil) {
        self.error = error
        self.code = code
        self.timestamp = ISO8601DateFormatter().string(from: Date())
        self.details = details
    }
}

// MARK: - SQL Compatibility Types

/// Raw SQL execution result (matches sql.js format exactly)
public struct SQLResult: Codable {
    public let columns: [String]
    public let values: [[Any]]

    public init(columns: [String], values: [[Any]]) {
        self.columns = columns
        self.values = values
    }

    // Custom Codable implementation to handle Any type
    enum CodingKeys: String, CodingKey {
        case columns, values
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        columns = try container.decode([String].self, forKey: .columns)

        // For now, we'll implement a simplified version
        // In practice, sql.js format is rarely needed for this API bridge
        values = []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(columns, forKey: .columns)

        // Encode values as nested arrays
        var valuesContainer = container.nestedUnkeyedContainer(forKey: .values)
        for row in values {
            var rowContainer = valuesContainer.nestedUnkeyedContainer()
            for value in row {
                if let stringVal = value as? String {
                    try rowContainer.encode(stringVal)
                } else if let intVal = value as? Int {
                    try rowContainer.encode(intVal)
                } else if let doubleVal = value as? Double {
                    try rowContainer.encode(doubleVal)
                } else if let boolVal = value as? Bool {
                    try rowContainer.encode(boolVal)
                } else {
                    try rowContainer.encodeNil()
                }
            }
        }
    }
}

/// Simplified result format that matches current React usage
public typealias SQLExecuteResult = [[String: Any]]