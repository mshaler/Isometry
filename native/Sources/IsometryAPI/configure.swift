import Foundation
import Vapor
import GRDB
import IsometryCore

/// Configure the Vapor application
public func configure(_ app: Application) throws {
    // MARK: - Basic Configuration

    // Set server hostname and port
    app.http.server.configuration.hostname = "127.0.0.1"
    app.http.server.configuration.port = 8080

    // MARK: - Middleware Configuration

    // CORS Middleware - Allow cross-origin requests
    let corsConfiguration = CORSMiddleware.Configuration(
        allowedOrigin: .all,
        allowedMethods: [.GET, .POST, .PUT, .DELETE, .OPTIONS, .PATCH],
        allowedHeaders: [.accept, .authorization, .contentType, .origin, .xRequestedWith]
    )
    app.middleware.use(CORSMiddleware(configuration: corsConfiguration))

    // Error Middleware - Handle and format errors
    app.middleware.use(ErrorMiddleware.default(environment: app.environment))

    // JSON Response Middleware - Ensure proper JSON handling
    app.middleware.use(app.sessions.middleware)

    // Request ID Middleware - Add unique request IDs for logging
    app.middleware.use(RequestIDMiddleware())

    // MARK: - Database Configuration

    // Configure the database path
    let databaseURL = getDatabaseURL(for: app.environment)
    let databaseQueue = try DatabaseQueue(path: databaseURL.path)

    // Note: Vapor's built-in database system isn't used here
    // We directly inject our GRDB database queue

    // Store repositories for dependency injection
    try configureDependencyInjection(app, databaseQueue: databaseQueue)

    // MARK: - Routes Configuration

    try routes(app)

    // MARK: - Startup Message

    app.logger.info("🚀 Isometry API Server configured")
    app.logger.info("📍 Server will run at: http://\(app.http.server.configuration.hostname):\(app.http.server.configuration.port)")
    app.logger.info("💾 Database location: \(databaseURL.path)")
}

/// Get database URL based on environment
private func getDatabaseURL(for environment: Environment) -> URL {
    let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
    let documentsDirectory = homeDirectory.appendingPathComponent("Documents")

    switch environment {
    case .production:
        return documentsDirectory.appendingPathComponent("isometry-production.db")
    case .testing:
        return URL(fileURLWithPath: ":memory:")
    default:
        return documentsDirectory.appendingPathComponent("isometry-development.db")
    }
}

/// Configure dependency injection for repositories and services
private func configureDependencyInjection(_ app: Application, databaseQueue: DatabaseQueue) throws {
    // Create repository implementations
    let nodeRepository = SQLiteNodeRepository(database: databaseQueue)
    let edgeRepository = SQLiteEdgeRepository(database: databaseQueue)

    // Create services
    let nodeService = NodeService(nodeRepository: nodeRepository, edgeRepository: edgeRepository)
    let graphService = GraphService(nodeRepository: nodeRepository, edgeRepository: edgeRepository)
    let filterService = FilterService(nodeRepository: nodeRepository)

    // Register services with Vapor's dependency injection
    app.storage[NodeServiceKey.self] = nodeService
    app.storage[GraphServiceKey.self] = graphService
    app.storage[FilterServiceKey.self] = filterService
    app.storage[NodeRepositoryKey.self] = nodeRepository
    app.storage[EdgeRepositoryKey.self] = edgeRepository
}

// MARK: - Dependency Injection Keys

private struct NodeServiceKey: StorageKey {
    typealias Value = NodeService
}

private struct GraphServiceKey: StorageKey {
    typealias Value = GraphService
}

private struct FilterServiceKey: StorageKey {
    typealias Value = FilterService
}

private struct NodeRepositoryKey: StorageKey {
    typealias Value = NodeRepository
}

private struct EdgeRepositoryKey: StorageKey {
    typealias Value = EdgeRepository
}

// MARK: - Service Access Extensions

public extension Application {
    var nodeService: NodeService {
        guard let service = storage[NodeServiceKey.self] else {
            fatalError("NodeService not configured. Please call configure(_:) first.")
        }
        return service
    }

    var graphService: GraphService {
        guard let service = storage[GraphServiceKey.self] else {
            fatalError("GraphService not configured. Please call configure(_:) first.")
        }
        return service
    }

    var filterService: FilterService {
        guard let service = storage[FilterServiceKey.self] else {
            fatalError("FilterService not configured. Please call configure(_:) first.")
        }
        return service
    }

    var nodeRepository: NodeRepository {
        guard let repository = storage[NodeRepositoryKey.self] else {
            fatalError("NodeRepository not configured. Please call configure(_:) first.")
        }
        return repository
    }

    var edgeRepository: EdgeRepository {
        guard let repository = storage[EdgeRepositoryKey.self] else {
            fatalError("EdgeRepository not configured. Please call configure(_:) first.")
        }
        return repository
    }
}

public extension Request {
    var nodeService: NodeService { application.nodeService }
    var graphService: GraphService { application.graphService }
    var filterService: FilterService { application.filterService }
    var nodeRepository: NodeRepository { application.nodeRepository }
    var edgeRepository: EdgeRepository { application.edgeRepository }
}

// MARK: - Custom Middleware

/// Middleware to add unique request IDs for logging and tracing
struct RequestIDMiddleware: Middleware {
    func respond(to request: Request, chainingTo next: Responder) -> EventLoopFuture<Response> {
        let requestID = UUID().uuidString.prefix(8)
        request.logger[metadataKey: "request_id"] = .string(String(requestID))

        return next.respond(to: request).map { response in
            response.headers.add(name: "X-Request-ID", value: String(requestID))
            return response
        }
    }
}

// MARK: - Database Extensions

// Note: Custom database configuration not needed since we use GRDB directly

// MARK: - Environment Extensions

extension Environment {
    /// Custom environment for API development
    static var api: Environment {
        return Environment(name: "api")
    }
}