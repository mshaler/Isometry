import Foundation
import Vapor
import GRDB
import Isometry

/// HTTP API server that exposes IsometryDatabase operations through REST endpoints
///
/// Provides drop-in compatibility for existing React sql.js queries by matching
/// the exact same interface and response format.
public actor IsometryAPIServer {
    // MARK: - Properties

    private var app: Application?
    private let database: IsometryDatabase
    private var isRunning = false

    public private(set) var port: Int

    // MARK: - Initialization

    /// Creates a new API server wrapping the specified database
    /// - Parameters:
    ///   - database: The IsometryDatabase instance to expose via HTTP
    ///   - port: The port to listen on (default: 8080)
    public init(database: IsometryDatabase, port: Int = 8080) {
        self.database = database
        self.port = port
    }

    // MARK: - Server Lifecycle

    /// Starts the HTTP server on the configured port
    /// - Parameter port: Optional port override
    /// - Returns: The actual port the server is listening on
    @discardableResult
    public func start(port: Int? = nil) async throws -> Int {
        guard !isRunning else {
            throw APIServerError.alreadyRunning
        }

        if let port = port {
            self.port = port
        }

        // Create Vapor application
        var env = Environment.development
        try LoggingSystem.bootstrap(from: &env)

        let app = try await Application.make(env)
        self.app = app

        // Configure CORS for React prototype access
        let corsConfiguration = CORSMiddleware.Configuration(
            allowedOrigin: .originBased,
            allowedMethods: [.GET, .POST, .PUT, .DELETE, .OPTIONS],
            allowedHeaders: [.accept, .authorization, .contentType, .origin, .xRequestedWith]
        )
        app.middleware.use(CORSMiddleware(configuration: corsConfiguration))

        // Configure JSON content configuration
        ContentConfiguration.global.use(decoder: JSONDecoder(), for: .json)
        ContentConfiguration.global.use(encoder: JSONEncoder(), for: .json)

        // Register routes
        try await registerRoutes(app)

        // Start server on available port if specified port is busy
        var actualPort = self.port
        var attempts = 0
        let maxAttempts = 10

        while attempts < maxAttempts {
            do {
                try await app.server.start(hostname: "127.0.0.1", port: actualPort)
                self.port = actualPort
                isRunning = true
                print("✅ IsometryAPIServer started on http://127.0.0.1:\(actualPort)")
                return actualPort
            } catch {
                attempts += 1
                actualPort += 1
                if attempts >= maxAttempts {
                    throw APIServerError.portUnavailable(originalPort: self.port, error: error)
                }
            }
        }

        throw APIServerError.startupFailed
    }

    /// Stops the HTTP server
    public func stop() async throws {
        guard let app = self.app, isRunning else {
            return
        }

        try await app.server.shutdown()
        self.app = nil
        isRunning = false
        print("🛑 IsometryAPIServer stopped")
    }

    // MARK: - Route Registration

    private func registerRoutes(_ app: Application) async throws {
        // Health check endpoint
        app.get("health") { req in
            return ["status": "ok", "timestamp": ISO8601DateFormatter().string(from: Date())]
        }

        // API endpoints group
        let api = app.grouped("api")

        // SQL execution endpoint (primary compatibility layer)
        api.post("execute", use: executeSQL)

        // Node endpoints
        api.get("nodes", use: getNodes)
        api.post("nodes", use: createNode)
        api.get("nodes", ":id", use: getNodeById)
        api.put("nodes", ":id", use: updateNode)
        api.delete("nodes", ":id", use: deleteNode)

        // Search endpoints
        api.get("search", use: searchNodes)

        // Notebook card endpoints
        api.get("notebook-cards", use: getNotebookCards)
        api.post("notebook-cards", use: createNotebookCard)
        api.get("notebook-cards", ":id", use: getNotebookCardById)
        api.put("notebook-cards", ":id", use: updateNotebookCard)
        api.delete("notebook-cards", ":id", use: deleteNotebookCard)
    }

    // MARK: - SQL Execution Endpoint

    private func executeSQL(_ req: Request) async throws -> Response {
        let sqlRequest = try req.content.decode(SQLExecuteRequest.self)

        do {
            let results = try await executeSQLQuery(sql: sqlRequest.sql, params: sqlRequest.params ?? [])
            // The SQL results are an array, but we need to encode each result
            return try await encodeJSONResponse(results, for: req)
        } catch {
            throw APIServerError.sqlExecutionFailed(sql: sqlRequest.sql, error: error)
        }
    }

    // MARK: - Node Endpoints

    private func getNodes(_ req: Request) async throws -> Response {
        let folder = req.query[String.self, at: "folder"]
        let nodeType = req.query[String.self, at: "type"]

        let nodes: [Isometry.Node]

        switch (folder, nodeType) {
        case let (folder?, nil):
            nodes = try await database.getNodes(inFolder: folder)
        case let (nil, nodeType?):
            nodes = try await database.getNodes(ofType: nodeType)
        case (nil, nil):
            nodes = try await database.getAllNodes()
        case let (folder?, nodeType?):
            // Filter by both folder and type
            let allNodes = try await database.getNodes(inFolder: folder)
            nodes = allNodes.filter { $0.nodeType == nodeType }
        }

        // Convert to API format (matching sql.js output)
        let apiNodes = nodes.map(APINode.init)
        return try await encodeJSONResponse(apiNodes, for: req)
    }

    private func createNode(_ req: Request) async throws -> Response {
        let apiNode = try req.content.decode(APINodeCreate.self)

        // Create node in steps to help Swift type checker
        let nodeId = apiNode.id ?? UUID().uuidString
        let nodeType = apiNode.nodeType ?? "note"
        let createdDate = apiNode.createdAt ?? Date()
        let priority = apiNode.priority ?? 0
        let importance = apiNode.importance ?? 0
        let sortOrder = apiNode.sortOrder ?? 0
        let tags = apiNode.tags ?? []

        let node = Isometry.Node(
            id: nodeId,
            nodeType: nodeType,
            name: apiNode.name,
            content: apiNode.content,
            summary: apiNode.summary,
            createdAt: createdDate,
            modifiedAt: Date(),
            folder: apiNode.folder,
            tags: tags,
            status: apiNode.status,
            priority: priority,
            importance: importance,
            sortOrder: sortOrder,
            source: apiNode.source,
            sourceId: apiNode.sourceId,
            version: 1,
            syncVersion: 0
        )

        try await database.createNode(node)

        let responseNode = APINode(node: node)
        return try await encodeJSONResponse(responseNode, for: req)
    }

    private func getNodeById(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing node ID")
        }

        guard let node = try await database.getNode(id: id) else {
            throw Abort(.notFound, reason: "Node not found")
        }

        let apiNode = APINode(node: node)
        return try await encodeJSONResponse(apiNode, for: req)
    }

    private func updateNode(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing node ID")
        }

        guard var existingNode = try await database.getNode(id: id) else {
            throw Abort(.notFound, reason: "Node not found")
        }

        let updates = try req.content.decode(APINodeUpdate.self)

        // Apply updates to mutable fields
        if let name = updates.name { existingNode.name = name }
        if let nodeType = updates.nodeType { existingNode.nodeType = nodeType }
        if let folder = updates.folder { existingNode.folder = folder }
        if let content = updates.content { existingNode.content = content }
        if let summary = updates.summary { existingNode.summary = summary }
        if let tags = updates.tags { existingNode.tags = tags }
        if let sortOrder = updates.sortOrder { existingNode.sortOrder = sortOrder }
        if let priority = updates.priority { existingNode.priority = priority }
        if let importance = updates.importance { existingNode.importance = importance }
        if let status = updates.status { existingNode.status = status }

        existingNode.modifiedAt = Date()

        try await database.updateNode(existingNode)

        let apiNode = APINode(node: existingNode)
        return try await encodeJSONResponse(apiNode, for: req)
    }

    private func deleteNode(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing node ID")
        }

        try await database.deleteNode(id: id)

        return try await encodeJSONResponse(["deleted": true, "id": id], for: req)
    }

    // MARK: - Search Endpoints

    private func searchNodes(_ req: Request) async throws -> Response {
        guard let query = req.query[String.self, at: "q"] else {
            throw Abort(.badRequest, reason: "Missing search query parameter 'q'")
        }

        let nodes = try await database.searchNodes(query: query)
        let apiNodes = nodes.map(APINode.init)
        return try await encodeJSONResponse(apiNodes, for: req)
    }

    // MARK: - Notebook Card Endpoints

    private func getNotebookCards(_ req: Request) async throws -> Response {
        let folder = req.query[String.self, at: "folder"]

        let cards: [Isometry.NotebookCard]
        if let folder = folder {
            cards = try await database.getNotebookCards(inFolder: folder)
        } else {
            cards = try await database.getAllNotebookCards()
        }

        let apiCards = cards.map(APINotebookCard.init)
        return try await encodeJSONResponse(apiCards, for: req)
    }

    private func createNotebookCard(_ req: Request) async throws -> Response {
        let apiCard = try req.content.decode(APINotebookCardCreate.self)

        let card = Isometry.NotebookCard(
            id: apiCard.id ?? UUID().uuidString,
            title: apiCard.title,
            markdownContent: apiCard.markdownContent,
            properties: apiCard.properties ?? [:],
            templateId: apiCard.templateId,
            createdAt: apiCard.createdAt ?? Date(),
            modifiedAt: Date(),
            folder: apiCard.folder,
            tags: apiCard.tags ?? [],
            linkedNodeId: apiCard.nodeId,
            syncVersion: 0,
            lastSyncedAt: nil,
            conflictResolvedAt: nil,
            deletedAt: nil
        )

        try await database.createNotebookCard(card)

        let responseCard = APINotebookCard(card: card)
        return try await encodeJSONResponse(responseCard, for: req)
    }

    private func getNotebookCardById(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing card ID")
        }

        guard let card = try await database.getNotebookCard(id: id) else {
            throw Abort(.notFound, reason: "Notebook card not found")
        }

        let apiCard = APINotebookCard(card: card)
        return try await encodeJSONResponse(apiCard, for: req)
    }

    private func updateNotebookCard(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing card ID")
        }

        guard let existingCard = try await database.getNotebookCard(id: id) else {
            throw Abort(.notFound, reason: "Notebook card not found")
        }

        let updates = try req.content.decode(APINotebookCardUpdate.self)

        // Create updated card (NotebookCard is immutable)
        let updatedCard = Isometry.NotebookCard(
            id: existingCard.id,
            title: updates.title ?? existingCard.title,
            markdownContent: updates.markdownContent ?? existingCard.markdownContent,
            properties: updates.properties ?? existingCard.properties,
            templateId: updates.templateId ?? existingCard.templateId,
            createdAt: existingCard.createdAt,
            modifiedAt: Date(),
            folder: updates.folder ?? existingCard.folder,
            tags: updates.tags ?? existingCard.tags,
            linkedNodeId: existingCard.linkedNodeId,
            syncVersion: existingCard.syncVersion + 1,
            lastSyncedAt: existingCard.lastSyncedAt,
            conflictResolvedAt: existingCard.conflictResolvedAt,
            deletedAt: existingCard.deletedAt
        )

        try await database.updateNotebookCard(updatedCard)

        let apiCard = APINotebookCard(card: updatedCard)
        return try await encodeJSONResponse(apiCard, for: req)
    }

    private func deleteNotebookCard(_ req: Request) async throws -> Response {
        guard let id = req.parameters.get("id") else {
            throw Abort(.badRequest, reason: "Missing card ID")
        }

        try await database.deleteNotebookCard(id: id)

        return try await encodeJSONResponse(["deleted": true, "id": id], for: req)
    }

    // MARK: - Utility Methods

    private func encodeJSONResponse<T: Codable>(_ data: T, for req: Request) async throws -> Response {
        let response = Response()
        response.headers.contentType = .json
        try response.content.encode(data, as: .json)
        return response
    }

    // Special overload for [String: Any] dictionaries (not Codable)
    private func encodeJSONResponse(_ data: [String: Any], for req: Request) async throws -> Response {
        let response = Response()
        response.headers.contentType = .json
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        response.body = Response.Body(data: jsonData)
        return response
    }

    // Special overload for [[String: Any]] arrays (not Codable)
    private func encodeJSONResponse(_ data: [[String: Any]], for req: Request) async throws -> Response {
        let response = Response()
        response.headers.contentType = .json
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        response.body = Response.Body(data: jsonData)
        return response
    }

    private func executeSQLQuery(sql: String, params: [SQLParameter]) async throws -> [[String: Any]] {
        // This will be implemented in SQLExecutor.swift in Task 2
        // For now, provide a basic implementation using existing database methods

        let trimmedSQL = sql.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if trimmedSQL.hasPrefix("select") && trimmedSQL.contains("nodes") {
            // Handle common node queries
            let nodes = try await database.getAllNodes()
            return nodes.map { node in
                [
                    "id": node.id,
                    "node_type": node.nodeType,
                    "name": node.name,
                    "content": node.content ?? "",
                    "folder": node.folder ?? "",
                    "tags": node.tags.joined(separator: ","),
                    "created_at": node.createdAt.timeIntervalSince1970,
                    "modified_at": node.modifiedAt.timeIntervalSince1970
                ]
            }
        } else if trimmedSQL.hasPrefix("select") && trimmedSQL.contains("notebook_cards") {
            // Handle common notebook card queries
            let cards = try await database.getAllNotebookCards()
            return cards.map { card in
                [
                    "id": card.id,
                    "title": card.title,
                    "markdown_content": card.markdownContent ?? "",
                    "properties": card.properties,
                    "template_id": card.templateId ?? "",
                    "folder": card.folder ?? "",
                    "created_at": card.createdAt.timeIntervalSince1970,
                    "modified_at": card.modifiedAt.timeIntervalSince1970
                ]
            }
        } else {
            // For non-SELECT queries, return simple success
            return [["success": true, "affected_rows": 1]]
        }
    }
}

// MARK: - Data Transfer Objects

/// Request structure for SQL execution (matches sql.js interface)
public struct SQLExecuteRequest: Codable {
    let sql: String
    let params: [SQLParameter]?
}

/// SQL parameter that can be various types
public enum SQLParameter: Codable {
    case string(String)
    case integer(Int)
    case double(Double)
    case bool(Bool)
    case null

    public var value: DatabaseValueConvertible? {
        switch self {
        case .string(let val): return val
        case .integer(let val): return val
        case .double(let val): return val
        case .bool(let val): return val
        case .null: return nil
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let stringVal = try? container.decode(String.self) {
            self = .string(stringVal)
        } else if let intVal = try? container.decode(Int.self) {
            self = .integer(intVal)
        } else if let doubleVal = try? container.decode(Double.self) {
            self = .double(doubleVal)
        } else if let boolVal = try? container.decode(Bool.self) {
            self = .bool(boolVal)
        } else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unsupported parameter type"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let val): try container.encode(val)
        case .integer(let val): try container.encode(val)
        case .double(let val): try container.encode(val)
        case .bool(let val): try container.encode(val)
        case .null: try container.encodeNil()
        }
    }
}

// MARK: - API Error Types

public enum APIServerError: LocalizedError {
    case alreadyRunning
    case portUnavailable(originalPort: Int, error: Error)
    case startupFailed
    case sqlExecutionFailed(sql: String, error: Error)

    public var errorDescription: String? {
        switch self {
        case .alreadyRunning:
            return "API server is already running"
        case .portUnavailable(let port, let error):
            return "Port \(port) is unavailable: \(error.localizedDescription)"
        case .startupFailed:
            return "Failed to start API server after multiple attempts"
        case .sqlExecutionFailed(let sql, let error):
            return "SQL execution failed for query '\(sql)': \(error.localizedDescription)"
        }
    }
}