import Foundation
import Vapor

/// HTTP controller for Edge operations
struct EdgesController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let edges = routes.grouped("edges")

        // Basic CRUD routes
        edges.get(use: listEdges)
        edges.post(use: createEdge)
        edges.get(":edgeID", use: getEdge)
        edges.delete(":edgeID", use: deleteEdge)
    }

    // MARK: - Route Handlers

    /// GET /api/v1/edges - List edges
    func listEdges(req: Request) async throws -> EdgesListResponse {
        let limit = req.query[Int.self, at: "limit"] ?? 50
        let offset = req.query[Int.self, at: "offset"] ?? 0
        let typeFilter = req.query[String.self, at: "type"]

        let edges: [Edge]

        if let typeFilter = typeFilter, let edgeType = EdgeType(rawValue: typeFilter.uppercased()) {
            edges = try await req.edgeRepository.getByType(edgeType, limit: limit, offset: offset)
        } else {
            edges = try await req.edgeRepository.getAll(limit: limit, offset: offset)
        }

        let totalCount = try await req.edgeRepository.count()

        return EdgesListResponse(
            edges: edges.map(EdgeDTO.init),
            pagination: PaginationInfo(
                limit: limit,
                offset: offset,
                total: totalCount,
                hasMore: offset + edges.count < totalCount
            )
        )
    }

    /// POST /api/v1/edges - Create a new edge
    func createEdge(req: Request) async throws -> EdgeDTO {
        let createRequest = try req.content.decode(CreateEdgeRequest.self)

        guard let edgeType = EdgeType(rawValue: createRequest.edgeType.uppercased()) else {
            throw Abort(.badRequest, reason: "Invalid edge type. Valid types: \(EdgeType.allCases.map(\.rawValue).joined(separator: ", "))")
        }

        let edge = Edge(
            edgeType: edgeType,
            sourceId: createRequest.sourceId,
            targetId: createRequest.targetId,
            label: createRequest.label,
            weight: createRequest.weight ?? 1.0,
            directed: createRequest.directed ?? true
        )

        try await req.edgeRepository.create(edge)
        return EdgeDTO(edge)
    }

    /// GET /api/v1/edges/:edgeID - Get a specific edge
    func getEdge(req: Request) async throws -> EdgeDTO {
        guard let edgeID = req.parameters.get("edgeID") else {
            throw Abort(.badRequest, reason: "Missing edge ID parameter")
        }

        guard let edge = try await req.edgeRepository.get(id: edgeID) else {
            throw Abort(.notFound, reason: "Edge not found")
        }

        return EdgeDTO(edge)
    }

    /// DELETE /api/v1/edges/:edgeID - Delete an edge
    func deleteEdge(req: Request) async throws -> HTTPStatus {
        guard let edgeID = req.parameters.get("edgeID") else {
            throw Abort(.badRequest, reason: "Missing edge ID parameter")
        }

        try await req.edgeRepository.delete(id: edgeID)
        return .noContent
    }
}

// MARK: - Request/Response Models

/// Request model for creating an edge
struct CreateEdgeRequest: Content {
    let edgeType: String
    let sourceId: String
    let targetId: String
    let label: String?
    let weight: Double?
    let directed: Bool?
}

/// Response model for edge lists
struct EdgesListResponse: Content {
    let edges: [EdgeDTO]
    let pagination: PaginationInfo
}