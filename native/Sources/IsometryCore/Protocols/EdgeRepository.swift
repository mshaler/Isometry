import Foundation

/// Repository protocol for Edge CRUD operations and graph queries
public protocol EdgeRepository: Sendable {
    // MARK: - Basic CRUD Operations

    /// Create a new edge
    /// - Parameter edge: The edge to create
    /// - Throws: RepositoryError on database errors
    func create(_ edge: Edge) async throws

    /// Create multiple edges in a batch operation
    /// - Parameter edges: The edges to create
    /// - Throws: RepositoryError on database errors
    func createBatch(_ edges: [Edge]) async throws

    /// Get an edge by ID
    /// - Parameter id: The edge ID
    /// - Returns: The edge if found, nil otherwise
    /// - Throws: RepositoryError on database errors
    func get(id: String) async throws -> Edge?

    /// Update an existing edge
    /// - Parameter edge: The edge to update
    /// - Throws: RepositoryError on database errors
    func update(_ edge: Edge) async throws

    /// Delete an edge by ID
    /// - Parameter id: The edge ID to delete
    /// - Throws: RepositoryError on database errors
    func delete(id: String) async throws

    // MARK: - Basic Edge Queries

    /// Get all edges with pagination
    /// - Parameters:
    ///   - limit: Maximum number of edges to return
    ///   - offset: Number of edges to skip
    /// - Returns: Array of edges
    /// - Throws: RepositoryError on database errors
    func getAll(limit: Int?, offset: Int?) async throws -> [Edge]

    /// Count total edges
    /// - Returns: Total count
    /// - Throws: RepositoryError on database errors
    func count() async throws -> Int

    /// Get edges by type
    /// - Parameters:
    ///   - edgeType: The edge type to filter by
    ///   - limit: Maximum number of edges
    ///   - offset: Number of edges to skip
    /// - Returns: Array of edges of the specified type
    /// - Throws: RepositoryError on database errors
    func getByType(_ edgeType: EdgeType, limit: Int?, offset: Int?) async throws -> [Edge]

    /// Get edges originating from a source node
    /// - Parameters:
    ///   - sourceId: The source node ID
    ///   - edgeType: Optional edge type filter
    /// - Returns: Array of outgoing edges
    /// - Throws: RepositoryError on database errors
    func getOutgoingEdges(sourceId: String, edgeType: EdgeType?) async throws -> [Edge]

    /// Get edges targeting a destination node
    /// - Parameters:
    ///   - targetId: The target node ID
    ///   - edgeType: Optional edge type filter
    /// - Returns: Array of incoming edges
    /// - Throws: RepositoryError on database errors
    func getIncomingEdges(targetId: String, edgeType: EdgeType?) async throws -> [Edge]

    /// Get all edges connected to a node (both directions)
    /// - Parameters:
    ///   - nodeId: The node ID
    ///   - edgeType: Optional edge type filter
    /// - Returns: Array of connected edges
    /// - Throws: RepositoryError on database errors
    func getConnectedEdges(nodeId: String, edgeType: EdgeType?) async throws -> [Edge]

    // MARK: - Graph Traversal Operations

    /// Get immediate neighbors of a node
    /// - Parameters:
    ///   - nodeId: The central node ID
    ///   - edgeType: Optional edge type filter
    ///   - direction: Direction of traversal (outgoing, incoming, both)
    /// - Returns: Array of neighboring node IDs
    /// - Throws: RepositoryError on database errors
    func getNeighbors(nodeId: String, edgeType: EdgeType?, direction: TraversalDirection) async throws -> [String]

    /// Get nodes at a specific distance from a source node
    /// - Parameters:
    ///   - sourceId: The source node ID
    ///   - distance: Number of hops (1 = immediate neighbors)
    ///   - edgeType: Optional edge type filter
    ///   - direction: Direction of traversal
    /// - Returns: Array of node IDs at the specified distance
    /// - Throws: RepositoryError on database errors
    func getNodesAtDistance(sourceId: String, distance: Int, edgeType: EdgeType?, direction: TraversalDirection) async throws -> [String]

    /// Find shortest path between two nodes
    /// - Parameters:
    ///   - sourceId: Starting node ID
    ///   - targetId: Destination node ID
    ///   - edgeType: Optional edge type filter
    ///   - maxDistance: Maximum path length to search
    /// - Returns: Array of node IDs representing the path (empty if no path found)
    /// - Throws: RepositoryError on database errors
    func findShortestPath(sourceId: String, targetId: String, edgeType: EdgeType?, maxDistance: Int) async throws -> [String]

    /// Extract subgraph around a central node
    /// - Parameters:
    ///   - centerId: Central node ID
    ///   - depth: Maximum distance from center
    ///   - edgeType: Optional edge type filter
    ///   - direction: Direction of traversal
    /// - Returns: Subgraph structure containing nodes and edges
    /// - Throws: RepositoryError on database errors
    func extractSubgraph(centerId: String, depth: Int, edgeType: EdgeType?, direction: TraversalDirection) async throws -> Subgraph

    /// Find connected components in the graph
    /// - Parameters:
    ///   - edgeType: Optional edge type filter
    ///   - minSize: Minimum component size to include
    /// - Returns: Array of connected components (arrays of node IDs)
    /// - Throws: RepositoryError on database errors
    func findConnectedComponents(edgeType: EdgeType?, minSize: Int) async throws -> [[String]]

    // MARK: - Sequence Operations (for SEQUENCE edge types)

    /// Get sequence of nodes following SEQUENCE edges
    /// - Parameters:
    ///   - startId: Starting node ID
    ///   - maxLength: Maximum sequence length
    /// - Returns: Array of node IDs in sequence order
    /// - Throws: RepositoryError on database errors
    func getSequence(startId: String, maxLength: Int) async throws -> [String]

    /// Get all sequences in the graph
    /// - Parameter minLength: Minimum sequence length to include
    /// - Returns: Array of sequences (arrays of node IDs)
    /// - Throws: RepositoryError on database errors
    func getAllSequences(minLength: Int) async throws -> [[String]]

    // MARK: - Hierarchy Operations (for NEST edge types)

    /// Get children of a parent node
    /// - Parameter parentId: Parent node ID
    /// - Returns: Array of child node IDs
    /// - Throws: RepositoryError on database errors
    func getChildren(parentId: String) async throws -> [String]

    /// Get parent of a child node
    /// - Parameter childId: Child node ID
    /// - Returns: Parent node ID if found, nil otherwise
    /// - Throws: RepositoryError on database errors
    func getParent(childId: String) async throws -> String?

    /// Get all descendants of a node (recursive)
    /// - Parameters:
    ///   - ancestorId: Ancestor node ID
    ///   - maxDepth: Maximum recursion depth
    /// - Returns: Array of descendant node IDs
    /// - Throws: RepositoryError on database errors
    func getDescendants(ancestorId: String, maxDepth: Int) async throws -> [String]

    /// Get all ancestors of a node (recursive)
    /// - Parameter descendantId: Descendant node ID
    /// - Returns: Array of ancestor node IDs (ordered from immediate parent to root)
    /// - Throws: RepositoryError on database errors
    func getAncestors(descendantId: String) async throws -> [String]

    /// Get root nodes (nodes with no parents)
    /// - Returns: Array of root node IDs
    /// - Throws: RepositoryError on database errors
    func getRootNodes() async throws -> [String]

    /// Get leaf nodes (nodes with no children)
    /// - Returns: Array of leaf node IDs
    /// - Throws: RepositoryError on database errors
    func getLeafNodes() async throws -> [String]
}

/// Direction for graph traversal
public enum TraversalDirection: String, Codable, Sendable {
    case outgoing = "outgoing"   // Follow edges from source to target
    case incoming = "incoming"   // Follow edges from target to source
    case both = "both"          // Follow edges in both directions
}

/// Subgraph structure containing nodes and edges
public struct Subgraph: Codable, Sendable {
    public let centerNodeId: String
    public let nodeIds: [String]
    public let edges: [Edge]
    public let depth: Int

    public init(centerNodeId: String, nodeIds: [String], edges: [Edge], depth: Int) {
        self.centerNodeId = centerNodeId
        self.nodeIds = nodeIds
        self.edges = edges
        self.depth = depth
    }
}