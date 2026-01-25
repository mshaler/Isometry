import Foundation
import Vapor

/// Configure API routes
public func routes(_ app: Application) throws {
    // MARK: - Health Check Routes

    // Root health check
    app.get { req async -> String in
        "Isometry API Server is running! 🚀"
    }

    // Detailed health check
    app.get("health") { req async throws -> HealthResponse in
        let nodeCount = try await req.nodeRepository.count(includeDeleted: false)
        let edgeCount = try await req.edgeRepository.count()

        return HealthResponse(
            status: "healthy",
            version: "1.0.0",
            timestamp: Date(),
            database: HealthResponse.DatabaseInfo(
                connected: true,
                nodeCount: nodeCount,
                edgeCount: edgeCount
            )
        )
    }

    // MARK: - API Version 1 Routes

    let v1 = app.grouped("api", "v1")

    // Add JSON content type middleware for v1 routes
    let v1WithMiddleware = v1.grouped(ContentTypeMiddleware())

    // Register route groups
    try v1WithMiddleware.register(collection: NodesController())
    try v1WithMiddleware.register(collection: EdgesController())
    try v1WithMiddleware.register(collection: GraphController())
    try v1.register(collection: FiltersController())

    // MARK: - Documentation Routes

    app.get("docs") { req -> EventLoopFuture<Response> in
        // In a full implementation, this would serve the OpenAPI/Swagger UI
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Isometry API Documentation</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
                h1 { color: #333; }
                .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
                .method { font-weight: bold; color: #007AFF; }
            </style>
        </head>
        <body>
            <h1>Isometry API Documentation</h1>
            <p>Welcome to the Isometry API! This API provides access to node and graph operations.</p>

            <h2>Available Endpoints</h2>

            <div class="endpoint">
                <span class="method">GET</span> /health - API health check
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/nodes - List nodes with pagination and filtering
            </div>

            <div class="endpoint">
                <span class="method">POST</span> /api/v1/nodes - Create a new node
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/nodes/:id - Get a specific node
            </div>

            <div class="endpoint">
                <span class="method">PUT</span> /api/v1/nodes/:id - Update a node
            </div>

            <div class="endpoint">
                <span class="method">DELETE</span> /api/v1/nodes/:id - Delete a node
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/nodes/search - Full-text search nodes
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/edges - List edges
            </div>

            <div class="endpoint">
                <span class="method">POST</span> /api/v1/edges - Create a new edge
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/graph/neighbors/:nodeId - Get node neighbors
            </div>

            <div class="endpoint">
                <span class="method">GET</span> /api/v1/graph/path/:fromId/:toId - Find shortest path
            </div>

            <div class="endpoint">
                <span class="method">POST</span> /api/v1/filters/compile - Compile LATCH DSL expression
            </div>

            <div class="endpoint">
                <span class="method">POST</span> /api/v1/filters/execute - Execute compiled filter
            </div>

            <p><strong>Note:</strong> Full interactive documentation will be available in a future release.</p>
        </body>
        </html>
        """

        let response = Response()
        response.headers.contentType = .html
        response.body = .init(string: html)
        return req.eventLoop.makeSucceededFuture(response)
    }
}

// MARK: - Response Models

/// Health check response model
struct HealthResponse: Content {
    let status: String
    let version: String
    let timestamp: Date
    let database: DatabaseInfo

    struct DatabaseInfo: Content {
        let connected: Bool
        let nodeCount: Int
        let edgeCount: Int
    }
}

// MARK: - Middleware

/// Middleware to ensure JSON content type for API responses
struct ContentTypeMiddleware: Middleware {
    func respond(to request: Request, chainingTo next: Responder) -> EventLoopFuture<Response> {
        return next.respond(to: request).map { response in
            // Set JSON content type if not already set
            if response.headers.contentType == nil {
                response.headers.contentType = .json
            }
            return response
        }
    }
}