import Foundation
import Vapor

/// HTTP controller for Graph operations and analysis
struct GraphController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let graph = routes.grouped("graph")

        // Graph traversal routes
        graph.get("neighbors", ":nodeID", use: getNeighbors)
        graph.get("path", ":fromID", ":toID", use: findPath)
        graph.get("subgraph", ":nodeID", use: getSubgraph)

        // Graph analysis routes
        graph.get("analysis", use: analyzeGraph)
        graph.get("components", use: getComponents)
        graph.get("centrality", use: getCentrality)
    }

    // MARK: - Route Handlers

    /// GET /api/v1/graph/neighbors/:nodeID - Get node neighbors
    func getNeighbors(req: Request) async throws -> NeighborsResponse {
        guard let nodeID = req.parameters.get("nodeID") else {
            throw Abort(.badRequest, reason: "Missing node ID parameter")
        }

        let direction = req.query[String.self, at: "direction"]?.lowercased() ?? "both"
        let edgeTypeParam = req.query[String.self, at: "edgeType"]

        let traversalDirection: TraversalDirection
        switch direction {
        case "outgoing", "out":
            traversalDirection = .outgoing
        case "incoming", "in":
            traversalDirection = .incoming
        case "both":
            traversalDirection = .both
        default:
            throw Abort(.badRequest, reason: "Invalid direction. Valid values: outgoing, incoming, both")
        }

        let edgeType: EdgeType?
        if let edgeTypeParam = edgeTypeParam {
            guard let parsedEdgeType = EdgeType(rawValue: edgeTypeParam.uppercased()) else {
                throw Abort(.badRequest, reason: "Invalid edge type")
            }
            edgeType = parsedEdgeType
        } else {
            edgeType = nil
        }

        let neighborIds = try await req.edgeRepository.getNeighbors(
            nodeId: nodeID,
            edgeType: edgeType,
            direction: traversalDirection
        )

        // Get full node information for neighbors
        var neighbors: [NodeSummaryDTO] = []
        for neighborId in neighborIds {
            if let node = try await req.nodeRepository.get(id: neighborId) {
                neighbors.append(NodeSummaryDTO(node))
            }
        }

        return NeighborsResponse(
            centerNodeId: nodeID,
            neighbors: neighbors,
            direction: direction,
            edgeType: edgeTypeParam
        )
    }

    /// GET /api/v1/graph/path/:fromID/:toID - Find shortest path
    func findPath(req: Request) async throws -> PathResponse {
        guard let fromID = req.parameters.get("fromID") else {
            throw Abort(.badRequest, reason: "Missing 'fromID' parameter")
        }

        guard let toID = req.parameters.get("toID") else {
            throw Abort(.badRequest, reason: "Missing 'toID' parameter")
        }

        let maxDistance = req.query[Int.self, at: "maxDistance"] ?? 10
        let edgeTypeParam = req.query[String.self, at: "edgeType"]

        let edgeType: EdgeType?
        if let edgeTypeParam = edgeTypeParam {
            guard let parsedEdgeType = EdgeType(rawValue: edgeTypeParam.uppercased()) else {
                throw Abort(.badRequest, reason: "Invalid edge type")
            }
            edgeType = parsedEdgeType
        } else {
            edgeType = nil
        }

        let pathNodeIds = try await req.edgeRepository.findShortestPath(
            sourceId: fromID,
            targetId: toID,
            edgeType: edgeType,
            maxDistance: maxDistance
        )

        // Get full node information for path
        var pathNodes: [NodeSummaryDTO] = []
        for nodeId in pathNodeIds {
            if let node = try await req.nodeRepository.get(id: nodeId) {
                pathNodes.append(NodeSummaryDTO(node))
            }
        }

        return PathResponse(
            fromNodeId: fromID,
            toNodeId: toID,
            path: pathNodes,
            distance: pathNodeIds.count - 1,
            found: !pathNodeIds.isEmpty
        )
    }

    /// GET /api/v1/graph/subgraph/:nodeID - Extract subgraph
    func getSubgraph(req: Request) async throws -> SubgraphResponse {
        guard let nodeID = req.parameters.get("nodeID") else {
            throw Abort(.badRequest, reason: "Missing node ID parameter")
        }

        let depth = req.query[Int.self, at: "depth"] ?? 2
        let direction = req.query[String.self, at: "direction"]?.lowercased() ?? "both"
        let edgeTypeParam = req.query[String.self, at: "edgeType"]

        let traversalDirection: TraversalDirection
        switch direction {
        case "outgoing", "out":
            traversalDirection = .outgoing
        case "incoming", "in":
            traversalDirection = .incoming
        case "both":
            traversalDirection = .both
        default:
            throw Abort(.badRequest, reason: "Invalid direction. Valid values: outgoing, incoming, both")
        }

        let edgeType: EdgeType?
        if let edgeTypeParam = edgeTypeParam {
            guard let parsedEdgeType = EdgeType(rawValue: edgeTypeParam.uppercased()) else {
                throw Abort(.badRequest, reason: "Invalid edge type")
            }
            edgeType = parsedEdgeType
        } else {
            edgeType = nil
        }

        let subgraph = try await req.edgeRepository.extractSubgraph(
            centerId: nodeID,
            depth: depth,
            edgeType: edgeType,
            direction: traversalDirection
        )

        // Get full node information
        var nodes: [NodeSummaryDTO] = []
        for nodeId in subgraph.nodeIds {
            if let node = try await req.nodeRepository.get(id: nodeId) {
                nodes.append(NodeSummaryDTO(node))
            }
        }

        return SubgraphResponse(
            centerNodeId: nodeID,
            nodes: nodes,
            edges: subgraph.edges.map(EdgeSummaryDTO.init),
            depth: depth
        )
    }

    /// GET /api/v1/graph/analysis - Analyze graph structure
    func analyzeGraph(req: Request) async throws -> GraphAnalysisResponse {
        let analysis = try await req.graphService.analyzeGraph()
        return GraphAnalysisResponse(analysis)
    }

    /// GET /api/v1/graph/components - Get connected components
    func getComponents(req: Request) async throws -> ComponentsResponse {
        let minSize = req.query[Int.self, at: "minSize"] ?? 2
        let edgeTypeParam = req.query[String.self, at: "edgeType"]

        let edgeType: EdgeType?
        if let edgeTypeParam = edgeTypeParam {
            guard let parsedEdgeType = EdgeType(rawValue: edgeTypeParam.uppercased()) else {
                throw Abort(.badRequest, reason: "Invalid edge type")
            }
            edgeType = parsedEdgeType
        } else {
            edgeType = nil
        }

        let components = try await req.edgeRepository.findConnectedComponents(
            edgeType: edgeType,
            minSize: minSize
        )

        return ComponentsResponse(
            components: components,
            totalComponents: components.count,
            minSize: minSize
        )
    }

    /// GET /api/v1/graph/centrality - Get node centrality scores
    func getCentrality(req: Request) async throws -> CentralityResponse {
        let measureParam = req.query[String.self, at: "measure"]?.lowercased() ?? "degree"
        let limit = req.query[Int.self, at: "limit"] ?? 50

        let measure: CentralityMeasure
        switch measureParam {
        case "degree":
            measure = .degree
        case "betweenness":
            measure = .betweenness
        case "closeness":
            measure = .closeness
        default:
            throw Abort(.badRequest, reason: "Invalid centrality measure. Valid values: degree, betweenness, closeness")
        }

        let centralityScores = try await req.graphService.getNodesByCentrality(
            measure: measure,
            limit: limit
        )

        // Convert to response format with node details
        var results: [CentralityResult] = []
        for (nodeId, score) in centralityScores {
            if let node = try await req.nodeRepository.get(id: nodeId) {
                results.append(CentralityResult(
                    node: NodeSummaryDTO(node),
                    score: score
                ))
            }
        }

        return CentralityResponse(
            measure: measureParam,
            results: results
        )
    }
}

// MARK: - Response Models

/// Response for neighbor queries
struct NeighborsResponse: Content {
    let centerNodeId: String
    let neighbors: [NodeSummaryDTO]
    let direction: String
    let edgeType: String?
}

/// Response for path finding
struct PathResponse: Content {
    let fromNodeId: String
    let toNodeId: String
    let path: [NodeSummaryDTO]
    let distance: Int
    let found: Bool
}

/// Response for subgraph extraction
struct SubgraphResponse: Content {
    let centerNodeId: String
    let nodes: [NodeSummaryDTO]
    let edges: [EdgeSummaryDTO]
    let depth: Int
}

/// Response for graph analysis
struct GraphAnalysisResponse: Content {
    let nodeCount: Int
    let edgeCount: Int
    let maxInDegree: Int
    let maxOutDegree: Int
    let avgInDegree: Double
    let avgOutDegree: Double
    let connectedComponents: Int
    let largestComponentSize: Int
    let edgeTypeStats: [String: Int]
    let density: Double

    init(_ analysis: GraphAnalysis) {
        self.nodeCount = analysis.nodeCount
        self.edgeCount = analysis.edgeCount
        self.maxInDegree = analysis.maxInDegree
        self.maxOutDegree = analysis.maxOutDegree
        self.avgInDegree = analysis.avgInDegree
        self.avgOutDegree = analysis.avgOutDegree
        self.connectedComponents = analysis.connectedComponents
        self.largestComponentSize = analysis.largestComponentSize
        self.edgeTypeStats = analysis.edgeTypeStats.mapKeys { $0.rawValue }
        self.density = analysis.density
    }
}

/// Response for connected components
struct ComponentsResponse: Content {
    let components: [[String]]
    let totalComponents: Int
    let minSize: Int
}

/// Response for centrality analysis
struct CentralityResponse: Content {
    let measure: String
    let results: [CentralityResult]
}

/// Individual centrality result
struct CentralityResult: Content {
    let node: NodeSummaryDTO
    let score: Double
}

// MARK: - Extensions

private extension Dictionary where Key == EdgeType {
    func mapKeys<T>(_ transform: (Key) -> T) -> [T: Value] {
        var result: [T: Value] = [:]
        for (key, value) in self {
            result[transform(key)] = value
        }
        return result
    }
}