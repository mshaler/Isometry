import Foundation
import Vapor

/// HTTP controller for Node CRUD operations
struct NodesController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let nodes = routes.grouped("nodes")

        // Basic CRUD routes
        nodes.get(use: listNodes)
        nodes.post(use: createNode)
        nodes.get(":nodeID", use: getNode)
        nodes.put(":nodeID", use: updateNode)
        nodes.delete(":nodeID", use: deleteNode)

        // Search and query routes
        nodes.get("search", use: searchNodes)
        nodes.get("stats", use: getNodeStats)
    }

    // MARK: - Route Handlers

    /// GET /api/v1/nodes - List nodes with pagination and filtering
    func listNodes(req: Request) async throws -> NodesListResponse {
        // Parse query parameters
        let limit = req.query[Int.self, at: "limit"] ?? 50
        let offset = req.query[Int.self, at: "offset"] ?? 0
        let nodeType = req.query[String.self, at: "type"]
        let folder = req.query[String.self, at: "folder"]

        let nodes: [Node]

        // Apply filters based on query parameters
        if let nodeType = nodeType {
            nodes = try await req.nodeRepository.getByType(nodeType, limit: limit, offset: offset)
        } else if let folder = folder {
            nodes = try await req.nodeRepository.getByFolder(folder, limit: limit, offset: offset)
        } else {
            nodes = try await req.nodeRepository.getAll(limit: limit, offset: offset, includeDeleted: false)
        }

        let totalCount = try await req.nodeRepository.count(includeDeleted: false)

        return NodesListResponse(
            nodes: nodes.map(NodeDTO.init),
            pagination: PaginationInfo(
                limit: limit,
                offset: offset,
                total: totalCount,
                hasMore: offset + nodes.count < totalCount
            )
        )
    }

    /// POST /api/v1/nodes - Create a new node
    func createNode(req: Request) async throws -> NodeDTO {
        let createRequest = try req.content.decode(CreateNodeRequest.self)

        let node = Node(
            name: createRequest.name,
            content: createRequest.content,
            nodeType: createRequest.nodeType ?? "note",
            folder: createRequest.folder,
            tags: createRequest.tags ?? [],
            priority: createRequest.priority ?? 0,
            importance: createRequest.importance ?? 0
        )

        let createdNode = try await req.nodeService.createNode(node)
        return NodeDTO(createdNode)
    }

    /// GET /api/v1/nodes/:nodeID - Get a specific node
    func getNode(req: Request) async throws -> NodeDTO {
        guard let nodeID = req.parameters.get("nodeID") else {
            throw Abort(.badRequest, reason: "Missing node ID parameter")
        }

        guard let node = try await req.nodeRepository.get(id: nodeID) else {
            throw Abort(.notFound, reason: "Node not found")
        }

        return NodeDTO(node)
    }

    /// PUT /api/v1/nodes/:nodeID - Update a node
    func updateNode(req: Request) async throws -> NodeDTO {
        guard let nodeID = req.parameters.get("nodeID") else {
            throw Abort(.badRequest, reason: "Missing node ID parameter")
        }

        guard var node = try await req.nodeRepository.get(id: nodeID) else {
            throw Abort(.notFound, reason: "Node not found")
        }

        let updateRequest = try req.content.decode(UpdateNodeRequest.self)

        // Apply updates
        if let name = updateRequest.name {
            node.name = name
        }
        if let content = updateRequest.content {
            node.content = content
        }
        if let folder = updateRequest.folder {
            node.folder = folder
        }
        if let tags = updateRequest.tags {
            node.tags = tags
        }
        if let priority = updateRequest.priority {
            node.priority = priority
        }
        if let importance = updateRequest.importance {
            node.importance = importance
        }
        if let status = updateRequest.status {
            node.status = status
        }

        let updatedNode = try await req.nodeService.updateNode(node)
        return NodeDTO(updatedNode)
    }

    /// DELETE /api/v1/nodes/:nodeID - Delete a node
    func deleteNode(req: Request) async throws -> HTTPStatus {
        guard let nodeID = req.parameters.get("nodeID") else {
            throw Abort(.badRequest, reason: "Missing node ID parameter")
        }

        let deleteRelationships = req.query[Bool.self, at: "deleteRelationships"] ?? true

        try await req.nodeService.deleteNode(id: nodeID, deleteRelationships: deleteRelationships)
        return .noContent
    }

    /// GET /api/v1/nodes/search - Full-text search nodes
    func searchNodes(req: Request) async throws -> NodesListResponse {
        guard let query = req.query[String.self, at: "q"] else {
            throw Abort(.badRequest, reason: "Missing search query parameter 'q'")
        }

        let limit = req.query[Int.self, at: "limit"] ?? 50
        let offset = req.query[Int.self, at: "offset"] ?? 0

        let nodes = try await req.nodeRepository.search(query: query, limit: limit, offset: offset)
        let totalCount = nodes.count // Note: This is approximate for search results

        return NodesListResponse(
            nodes: nodes.map(NodeDTO.init),
            pagination: PaginationInfo(
                limit: limit,
                offset: offset,
                total: totalCount,
                hasMore: nodes.count == limit
            )
        )
    }

    /// GET /api/v1/nodes/stats - Get node statistics
    func getNodeStats(req: Request) async throws -> NodeStatsResponse {
        let stats = try await req.nodeService.getNodeStatistics()
        return NodeStatsResponse(stats)
    }
}

// MARK: - Request/Response Models

/// Request model for creating a node
struct CreateNodeRequest: Content {
    let name: String
    let content: String?
    let nodeType: String?
    let folder: String?
    let tags: [String]?
    let priority: Int?
    let importance: Int?
}

/// Request model for updating a node
struct UpdateNodeRequest: Content {
    let name: String?
    let content: String?
    let folder: String?
    let tags: [String]?
    let priority: Int?
    let importance: Int?
    let status: String?
}

/// Response model for node lists
struct NodesListResponse: Content {
    let nodes: [NodeDTO]
    let pagination: PaginationInfo
}

/// Pagination information
struct PaginationInfo: Content {
    let limit: Int
    let offset: Int
    let total: Int
    let hasMore: Bool
}

/// Node statistics response
struct NodeStatsResponse: Content {
    let totalCount: Int
    let deletedCount: Int
    let withLocationCount: Int
    let overdueCount: Int
    let completedCount: Int
    let nodeTypeStats: [String: Int]

    init(_ stats: NodeStatistics) {
        self.totalCount = stats.totalCount
        self.deletedCount = stats.deletedCount
        self.withLocationCount = stats.withLocationCount
        self.overdueCount = stats.overdueCount
        self.completedCount = stats.completedCount
        self.nodeTypeStats = stats.nodeTypeStats
    }
}