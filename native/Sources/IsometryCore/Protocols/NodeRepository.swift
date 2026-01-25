import Foundation

/// Repository protocol for Node CRUD operations and queries
public protocol NodeRepository: Sendable {
    // MARK: - Basic CRUD Operations

    /// Create a new node
    /// - Parameter node: The node to create
    /// - Throws: RepositoryError on database errors
    func create(_ node: Node) async throws

    /// Create multiple nodes in a batch operation
    /// - Parameter nodes: The nodes to create
    /// - Throws: RepositoryError on database errors
    func createBatch(_ nodes: [Node]) async throws

    /// Get a node by ID
    /// - Parameter id: The node ID
    /// - Returns: The node if found, nil otherwise
    /// - Throws: RepositoryError on database errors
    func get(id: String) async throws -> Node?

    /// Update an existing node
    /// - Parameter node: The node to update
    /// - Throws: RepositoryError on database errors
    func update(_ node: Node) async throws

    /// Delete a node by ID (soft delete)
    /// - Parameter id: The node ID to delete
    /// - Throws: RepositoryError on database errors
    func delete(id: String) async throws

    /// Hard delete a node by ID (permanently remove)
    /// - Parameter id: The node ID to permanently delete
    /// - Throws: RepositoryError on database errors
    func hardDelete(id: String) async throws

    // MARK: - Query Operations

    /// Get all nodes with pagination
    /// - Parameters:
    ///   - limit: Maximum number of nodes to return
    ///   - offset: Number of nodes to skip
    ///   - includeDeleted: Whether to include soft-deleted nodes
    /// - Returns: Array of nodes
    /// - Throws: RepositoryError on database errors
    func getAll(limit: Int?, offset: Int?, includeDeleted: Bool) async throws -> [Node]

    /// Count total nodes
    /// - Parameter includeDeleted: Whether to include soft-deleted nodes
    /// - Returns: Total count
    /// - Throws: RepositoryError on database errors
    func count(includeDeleted: Bool) async throws -> Int

    /// Search nodes using full-text search
    /// - Parameters:
    ///   - query: Search query string
    ///   - limit: Maximum number of results
    ///   - offset: Number of results to skip
    /// - Returns: Array of matching nodes
    /// - Throws: RepositoryError on database errors
    func search(query: String, limit: Int?, offset: Int?) async throws -> [Node]

    /// Get nodes by type
    /// - Parameters:
    ///   - nodeType: The node type to filter by
    ///   - limit: Maximum number of nodes
    ///   - offset: Number of nodes to skip
    /// - Returns: Array of nodes of the specified type
    /// - Throws: RepositoryError on database errors
    func getByType(_ nodeType: String, limit: Int?, offset: Int?) async throws -> [Node]

    /// Get nodes by folder
    /// - Parameters:
    ///   - folder: The folder name to filter by
    ///   - limit: Maximum number of nodes
    ///   - offset: Number of nodes to skip
    /// - Returns: Array of nodes in the specified folder
    /// - Throws: RepositoryError on database errors
    func getByFolder(_ folder: String, limit: Int?, offset: Int?) async throws -> [Node]

    /// Get nodes with specific tags
    /// - Parameters:
    ///   - tags: Array of tags to match (OR operation)
    ///   - limit: Maximum number of nodes
    ///   - offset: Number of nodes to skip
    /// - Returns: Array of nodes with matching tags
    /// - Throws: RepositoryError on database errors
    func getByTags(_ tags: [String], limit: Int?, offset: Int?) async throws -> [Node]

    /// Get nodes created within a date range
    /// - Parameters:
    ///   - startDate: Start of date range (inclusive)
    ///   - endDate: End of date range (inclusive)
    ///   - limit: Maximum number of nodes
    ///   - offset: Number of nodes to skip
    /// - Returns: Array of nodes created within the date range
    /// - Throws: RepositoryError on database errors
    func getByDateRange(startDate: Date, endDate: Date, limit: Int?, offset: Int?) async throws -> [Node]

    /// Get nodes that need syncing (have pending changes)
    /// - Returns: Array of nodes with pending sync changes
    /// - Throws: RepositoryError on database errors
    func getPendingSync() async throws -> [Node]

    /// Get nodes with location data
    /// - Parameters:
    ///   - limit: Maximum number of nodes
    ///   - offset: Number of nodes to skip
    /// - Returns: Array of nodes with latitude/longitude data
    /// - Throws: RepositoryError on database errors
    func getWithLocation(limit: Int?, offset: Int?) async throws -> [Node]

    // MARK: - Raw SQL Support

    /// Execute a raw SQL query and return nodes
    /// - Parameter sql: Raw SQL query string
    /// - Parameter arguments: SQL arguments for parameterized queries
    /// - Returns: Array of matching nodes
    /// - Throws: RepositoryError on database errors
    func executeSQL(_ sql: String, arguments: [Any]) async throws -> [Node]
}

/// Repository-specific errors
public enum RepositoryError: Error, Sendable {
    case notFound(String)
    case invalidData(String)
    case databaseError(String)
    case conflictError(String)
    case networkError(String)

    public var localizedDescription: String {
        switch self {
        case .notFound(let message):
            return "Not found: \(message)"
        case .invalidData(let message):
            return "Invalid data: \(message)"
        case .databaseError(let message):
            return "Database error: \(message)"
        case .conflictError(let message):
            return "Conflict error: \(message)"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}