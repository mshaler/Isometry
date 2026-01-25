import Foundation

/// Business logic service for Graph operations and analysis
/// Provides high-level graph algorithms and analysis functions
public actor GraphService {
    private let nodeRepository: NodeRepository
    private let edgeRepository: EdgeRepository

    /// Initialize with required dependencies
    /// - Parameters:
    ///   - nodeRepository: Repository for node data access
    ///   - edgeRepository: Repository for edge data access
    public init(nodeRepository: NodeRepository, edgeRepository: EdgeRepository) {
        self.nodeRepository = nodeRepository
        self.edgeRepository = edgeRepository
    }

    // MARK: - Graph Construction

    /// Create a link between two nodes
    /// - Parameters:
    ///   - sourceId: Source node ID
    ///   - targetId: Target node ID
    ///   - label: Optional label for the edge
    ///   - weight: Weight of the connection (default 1.0)
    /// - Returns: The created edge
    /// - Throws: ServiceError on validation or repository errors
    public func createLink(
        sourceId: String,
        targetId: String,
        label: String? = nil,
        weight: Double = 1.0
    ) async throws -> Edge {
        // Validate nodes exist
        guard try await nodeRepository.get(id: sourceId) != nil else {
            throw ServiceError.notFound("Source node \(sourceId) not found")
        }

        guard try await nodeRepository.get(id: targetId) != nil else {
            throw ServiceError.notFound("Target node \(targetId) not found")
        }

        // Check for existing link to avoid duplicates
        let existingOutgoing = try await edgeRepository.getOutgoingEdges(sourceId: sourceId, edgeType: .link)
        if existingOutgoing.contains(where: { $0.targetId == targetId }) {
            throw ServiceError.conflictError("Link already exists between \(sourceId) and \(targetId)")
        }

        // Create the link edge
        let edge = Edge(
            edgeType: .link,
            sourceId: sourceId,
            targetId: targetId,
            label: label,
            weight: weight,
            directed: true
        )

        try await edgeRepository.create(edge)
        return edge
    }

    /// Create a hierarchical parent-child relationship
    /// - Parameters:
    ///   - parentId: Parent node ID
    ///   - childId: Child node ID
    /// - Returns: The created nest edge
    /// - Throws: ServiceError on validation or repository errors
    public func createNest(parentId: String, childId: String) async throws -> Edge {
        // Validate nodes exist
        guard try await nodeRepository.get(id: parentId) != nil else {
            throw ServiceError.notFound("Parent node \(parentId) not found")
        }

        guard try await nodeRepository.get(id: childId) != nil else {
            throw ServiceError.notFound("Child node \(childId) not found")
        }

        // Check if child already has a parent
        if let existingParent = try await edgeRepository.getParent(childId: childId) {
            throw ServiceError.businessRuleViolation("Node \(childId) already has parent \(existingParent)")
        }

        // Prevent cycles
        if try await wouldCreateCycle(parentId: parentId, childId: childId) {
            throw ServiceError.businessRuleViolation("Creating parent-child relationship would create a cycle")
        }

        // Create the nest edge
        let edge = Edge(
            edgeType: .nest,
            sourceId: parentId,
            targetId: childId,
            directed: true
        )

        try await edgeRepository.create(edge)
        return edge
    }

    /// Create a sequence relationship between nodes
    /// - Parameters:
    ///   - nodes: Array of node IDs in sequence order
    /// - Returns: Array of created sequence edges
    /// - Throws: ServiceError on validation or repository errors
    public func createSequence(nodes: [String]) async throws -> [Edge] {
        guard nodes.count >= 2 else {
            throw ServiceError.invalidData("Sequence must contain at least 2 nodes")
        }

        // Validate all nodes exist
        for nodeId in nodes {
            guard try await nodeRepository.get(id: nodeId) != nil else {
                throw ServiceError.notFound("Node \(nodeId) not found")
            }
        }

        var edges: [Edge] = []

        // Create sequence edges between consecutive nodes
        for i in 0..<(nodes.count - 1) {
            let sourceId = nodes[i]
            let targetId = nodes[i + 1]

            let edge = Edge(
                edgeType: .sequence,
                sourceId: sourceId,
                targetId: targetId,
                directed: true,
                sequenceOrder: i
            )

            try await edgeRepository.create(edge)
            edges.append(edge)
        }

        return edges
    }

    // MARK: - Graph Analysis

    /// Analyze graph connectivity and structure
    /// - Returns: Graph analysis results
    /// - Throws: ServiceError on repository errors
    public func analyzeGraph() async throws -> GraphAnalysis {
        let nodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)
        let edges = try await edgeRepository.getAll(limit: nil, offset: nil)

        let nodeCount = nodes.count
        let edgeCount = edges.count

        // Calculate degree statistics
        var inDegrees: [String: Int] = [:]
        var outDegrees: [String: Int] = [:]

        for edge in edges {
            outDegrees[edge.sourceId, default: 0] += 1
            inDegrees[edge.targetId, default: 0] += 1
        }

        let maxInDegree = inDegrees.values.max() ?? 0
        let maxOutDegree = outDegrees.values.max() ?? 0
        let avgInDegree = nodeCount > 0 ? Double(edgeCount) / Double(nodeCount) : 0
        let avgOutDegree = avgInDegree // Same for directed graphs

        // Find connected components
        let components = try await edgeRepository.findConnectedComponents(edgeType: nil, minSize: 1)
        let largestComponentSize = components.map { $0.count }.max() ?? 0

        // Count edge types
        let edgeTypeStats = Dictionary(grouping: edges, by: { $0.edgeType })
            .mapValues { $0.count }

        return GraphAnalysis(
            nodeCount: nodeCount,
            edgeCount: edgeCount,
            maxInDegree: maxInDegree,
            maxOutDegree: maxOutDegree,
            avgInDegree: avgInDegree,
            avgOutDegree: avgOutDegree,
            connectedComponents: components.count,
            largestComponentSize: largestComponentSize,
            edgeTypeStats: edgeTypeStats,
            density: nodeCount > 1 ? Double(edgeCount) / Double(nodeCount * (nodeCount - 1)) : 0
        )
    }

    /// Find all paths between two nodes
    /// - Parameters:
    ///   - sourceId: Starting node ID
    ///   - targetId: Destination node ID
    ///   - maxLength: Maximum path length to search
    ///   - maxPaths: Maximum number of paths to return
    /// - Returns: Array of paths (each path is an array of node IDs)
    /// - Throws: ServiceError on repository errors
    public func findAllPaths(
        sourceId: String,
        targetId: String,
        maxLength: Int = 10,
        maxPaths: Int = 100
    ) async throws -> [[String]] {
        guard try await nodeRepository.get(id: sourceId) != nil else {
            throw ServiceError.notFound("Source node \(sourceId) not found")
        }

        guard try await nodeRepository.get(id: targetId) != nil else {
            throw ServiceError.notFound("Target node \(targetId) not found")
        }

        // Use depth-first search to find all paths
        var allPaths: [[String]] = []
        var visited: Set<String> = []

        await findPathsRecursive(
            from: sourceId,
            to: targetId,
            currentPath: [sourceId],
            visited: &visited,
            allPaths: &allPaths,
            maxLength: maxLength,
            maxPaths: maxPaths
        )

        return allPaths
    }

    /// Get nodes by centrality measures
    /// - Parameters:
    ///   - measure: Type of centrality to calculate
    ///   - limit: Maximum number of nodes to return
    /// - Returns: Array of nodes with centrality scores
    /// - Throws: ServiceError on repository errors
    public func getNodesByCentrality(
        measure: CentralityMeasure,
        limit: Int = 50
    ) async throws -> [(nodeId: String, score: Double)] {
        let nodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)
        let edges = try await edgeRepository.getAll(limit: nil, offset: nil)

        var centrality: [String: Double] = [:]

        switch measure {
        case .degree:
            // Count total connections (in + out)
            for node in nodes {
                let outgoing = try await edgeRepository.getOutgoingEdges(sourceId: node.id, edgeType: nil)
                let incoming = try await edgeRepository.getIncomingEdges(targetId: node.id, edgeType: nil)
                centrality[node.id] = Double(outgoing.count + incoming.count)
            }

        case .betweenness:
            // Simplified betweenness centrality (computationally expensive for large graphs)
            for node in nodes {
                centrality[node.id] = try await calculateBetweennessCentrality(for: node.id)
            }

        case .closeness:
            // Average shortest path length to all other nodes
            for node in nodes {
                centrality[node.id] = try await calculateClosenessCentrality(for: node.id)
            }
        }

        return centrality.sorted { $0.value > $1.value }
            .prefix(limit)
            .map { ($0.key, $0.value) }
    }

    /// Find clusters in the graph using edge weights and types
    /// - Parameters:
    ///   - algorithm: Clustering algorithm to use
    ///   - minClusterSize: Minimum nodes per cluster
    /// - Returns: Array of clusters (each cluster is an array of node IDs)
    /// - Throws: ServiceError on repository errors
    public func findClusters(
        algorithm: ClusteringAlgorithm = .connectedComponents,
        minClusterSize: Int = 2
    ) async throws -> [[String]] {
        switch algorithm {
        case .connectedComponents:
            return try await edgeRepository.findConnectedComponents(edgeType: nil, minSize: minClusterSize)

        case .stronglyConnected:
            // Find strongly connected components (more complex, simplified implementation)
            return try await findStronglyConnectedComponents(minSize: minClusterSize)

        case .communityDetection:
            // Simplified community detection using affinity edges
            return try await findCommunitiesUsingAffinity(minSize: minClusterSize)
        }
    }

    // MARK: - Private Helper Methods

    /// Check if creating a parent-child relationship would create a cycle
    private func wouldCreateCycle(parentId: String, childId: String) async throws -> Bool {
        // Check if parentId is already a descendant of childId
        let descendants = try await edgeRepository.getDescendants(ancestorId: childId, maxDepth: 100)
        return descendants.contains(parentId)
    }

    /// Recursive path finding helper
    private func findPathsRecursive(
        from currentNode: String,
        to targetNode: String,
        currentPath: [String],
        visited: inout Set<String>,
        allPaths: inout [[String]],
        maxLength: Int,
        maxPaths: Int
    ) async {
        if allPaths.count >= maxPaths || currentPath.count > maxLength {
            return
        }

        if currentNode == targetNode {
            allPaths.append(currentPath)
            return
        }

        visited.insert(currentNode)
        defer { visited.remove(currentNode) }

        // Get outgoing edges
        do {
            let outgoingEdges = try await edgeRepository.getOutgoingEdges(sourceId: currentNode, edgeType: nil)

            for edge in outgoingEdges {
                if !visited.contains(edge.targetId) {
                    var newPath = currentPath
                    newPath.append(edge.targetId)

                    await findPathsRecursive(
                        from: edge.targetId,
                        to: targetNode,
                        currentPath: newPath,
                        visited: &visited,
                        allPaths: &allPaths,
                        maxLength: maxLength,
                        maxPaths: maxPaths
                    )
                }
            }
        } catch {
            // Log error but continue
            return
        }
    }

    /// Calculate betweenness centrality for a node
    private func calculateBetweennessCentrality(for nodeId: String) async throws -> Double {
        // Simplified implementation - count how many shortest paths pass through this node
        // This is computationally expensive and would need optimization for large graphs
        let nodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)
        var betweenness = 0.0
        let nodeIds = nodes.map { $0.id }.filter { $0 != nodeId }

        for i in 0..<nodeIds.count {
            for j in (i+1)..<nodeIds.count {
                let sourceId = nodeIds[i]
                let targetId = nodeIds[j]

                // Find shortest path
                let shortestPath = try await edgeRepository.findShortestPath(
                    sourceId: sourceId,
                    targetId: targetId,
                    edgeType: nil,
                    maxDistance: 10
                )

                // If this node is on the shortest path (and not source/target)
                if shortestPath.contains(nodeId) && sourceId != nodeId && targetId != nodeId {
                    betweenness += 1.0
                }
            }
        }

        return betweenness
    }

    /// Calculate closeness centrality for a node
    private func calculateClosenessCentrality(for nodeId: String) async throws -> Double {
        let nodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)
        let otherNodeIds = nodes.map { $0.id }.filter { $0 != nodeId }

        var totalDistance = 0.0
        var reachableNodes = 0

        for targetId in otherNodeIds {
            let path = try await edgeRepository.findShortestPath(
                sourceId: nodeId,
                targetId: targetId,
                edgeType: nil,
                maxDistance: 10
            )

            if !path.isEmpty {
                totalDistance += Double(path.count - 1) // path length
                reachableNodes += 1
            }
        }

        if reachableNodes == 0 {
            return 0.0
        }

        // Closeness centrality is reciprocal of average distance
        let avgDistance = totalDistance / Double(reachableNodes)
        return avgDistance > 0 ? 1.0 / avgDistance : 0.0
    }

    /// Find strongly connected components (simplified)
    private func findStronglyConnectedComponents(minSize: Int) async throws -> [[String]] {
        // This is a simplified implementation - full Tarjan's or Kosaraju's algorithm would be more complex
        let components = try await edgeRepository.findConnectedComponents(edgeType: nil, minSize: minSize)

        // Filter to only include components where all nodes can reach each other
        var strongComponents: [[String]] = []

        for component in components {
            var isStrong = true

            // Check if every node can reach every other node
            for i in 0..<component.count {
                for j in 0..<component.count where i != j {
                    let path = try await edgeRepository.findShortestPath(
                        sourceId: component[i],
                        targetId: component[j],
                        edgeType: nil,
                        maxDistance: component.count
                    )

                    if path.isEmpty {
                        isStrong = false
                        break
                    }
                }
                if !isStrong { break }
            }

            if isStrong {
                strongComponents.append(component)
            }
        }

        return strongComponents
    }

    /// Find communities using affinity edges
    private func findCommunitiesUsingAffinity(minSize: Int) async throws -> [[String]] {
        // Get all affinity edges (computed similarity)
        let affinityEdges = try await edgeRepository.getByType(.affinity, limit: nil, offset: nil)

        // Group nodes connected by high-weight affinity edges
        var communities: [Set<String>] = []

        // Sort affinity edges by weight (highest first)
        let sortedAffinityEdges = affinityEdges.sorted { $0.weight > $1.weight }

        for edge in sortedAffinityEdges where edge.weight > 0.5 { // Threshold for community membership
            let sourceId = edge.sourceId
            let targetId = edge.targetId

            // Find if either node is already in a community
            var communityIndex = -1
            for (index, community) in communities.enumerated() {
                if community.contains(sourceId) || community.contains(targetId) {
                    communityIndex = index
                    break
                }
            }

            if communityIndex == -1 {
                // Create new community
                communities.append(Set([sourceId, targetId]))
            } else {
                // Add to existing community
                communities[communityIndex].insert(sourceId)
                communities[communityIndex].insert(targetId)
            }
        }

        // Convert to arrays and filter by minimum size
        return communities
            .map { Array($0) }
            .filter { $0.count >= minSize }
    }
}

// MARK: - Supporting Types

/// Graph analysis results
public struct GraphAnalysis: Codable, Sendable {
    public let nodeCount: Int
    public let edgeCount: Int
    public let maxInDegree: Int
    public let maxOutDegree: Int
    public let avgInDegree: Double
    public let avgOutDegree: Double
    public let connectedComponents: Int
    public let largestComponentSize: Int
    public let edgeTypeStats: [EdgeType: Int]
    public let density: Double

    public init(
        nodeCount: Int,
        edgeCount: Int,
        maxInDegree: Int,
        maxOutDegree: Int,
        avgInDegree: Double,
        avgOutDegree: Double,
        connectedComponents: Int,
        largestComponentSize: Int,
        edgeTypeStats: [EdgeType: Int],
        density: Double
    ) {
        self.nodeCount = nodeCount
        self.edgeCount = edgeCount
        self.maxInDegree = maxInDegree
        self.maxOutDegree = maxOutDegree
        self.avgInDegree = avgInDegree
        self.avgOutDegree = avgOutDegree
        self.connectedComponents = connectedComponents
        self.largestComponentSize = largestComponentSize
        self.edgeTypeStats = edgeTypeStats
        self.density = density
    }
}

/// Centrality measures for node importance
public enum CentralityMeasure: String, Codable, CaseIterable, Sendable {
    case degree = "degree"
    case betweenness = "betweenness"
    case closeness = "closeness"
}

/// Clustering algorithms
public enum ClusteringAlgorithm: String, Codable, CaseIterable, Sendable {
    case connectedComponents = "connected_components"
    case stronglyConnected = "strongly_connected"
    case communityDetection = "community_detection"
}