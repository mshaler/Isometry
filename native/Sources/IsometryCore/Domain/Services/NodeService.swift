import Foundation

/// Business logic service for Node operations
/// Provides high-level operations that may involve multiple repositories
/// and enforce business rules
public actor NodeService {
    private let nodeRepository: NodeRepository
    private let edgeRepository: EdgeRepository?

    /// Initialize with required dependencies
    /// - Parameters:
    ///   - nodeRepository: Repository for node data access
    ///   - edgeRepository: Optional repository for edge operations (for related operations)
    public init(nodeRepository: NodeRepository, edgeRepository: EdgeRepository? = nil) {
        self.nodeRepository = nodeRepository
        self.edgeRepository = edgeRepository
    }

    // MARK: - Node CRUD Operations

    /// Create a new node with business rule validation
    /// - Parameter node: The node to create
    /// - Returns: The created node with updated timestamps
    /// - Throws: ServiceError on validation or repository errors
    public func createNode(_ node: Node) async throws -> Node {
        // Validate business rules
        try validateNode(node)

        // Ensure proper timestamps
        var nodeToCreate = node
        let now = Date()
        nodeToCreate.createdAt = now
        nodeToCreate.modifiedAt = now
        nodeToCreate.version = 1
        nodeToCreate.syncVersion = 1

        // Create in repository
        try await nodeRepository.create(nodeToCreate)
        return nodeToCreate
    }

    /// Update a node with optimistic concurrency control
    /// - Parameter node: The node to update
    /// - Returns: The updated node
    /// - Throws: ServiceError on validation, version conflict, or repository errors
    public func updateNode(_ node: Node) async throws -> Node {
        // Check if node exists
        guard let existingNode = try await nodeRepository.get(id: node.id) else {
            throw ServiceError.notFound("Node with id \(node.id) not found")
        }

        // Optimistic concurrency check
        if node.version != existingNode.version {
            throw ServiceError.conflictError("Node version conflict. Expected \(existingNode.version), got \(node.version)")
        }

        // Validate business rules
        try validateNode(node)

        // Update version and timestamp
        var nodeToUpdate = node
        nodeToUpdate.modifiedAt = Date()
        nodeToUpdate.version = existingNode.version + 1
        nodeToUpdate.syncVersion = existingNode.syncVersion + 1

        // Update in repository
        try await nodeRepository.update(nodeToUpdate)
        return nodeToUpdate
    }

    /// Delete a node and optionally its relationships
    /// - Parameters:
    ///   - id: Node ID to delete
    ///   - deleteRelationships: Whether to delete connected edges
    /// - Throws: ServiceError on repository errors
    public func deleteNode(id: String, deleteRelationships: Bool = true) async throws {
        // Check if node exists
        guard try await nodeRepository.get(id: id) != nil else {
            throw ServiceError.notFound("Node with id \(id) not found")
        }

        // Delete relationships if requested and edge repository available
        if deleteRelationships, let edgeRepo = edgeRepository {
            let edges = try await edgeRepo.getConnectedEdges(nodeId: id, edgeType: nil)
            for edge in edges {
                try await edgeRepo.delete(id: edge.id)
            }
        }

        // Delete the node (soft delete)
        try await nodeRepository.delete(id: id)
    }

    // MARK: - Business Logic Operations

    /// Duplicate a node with a new ID
    /// - Parameters:
    ///   - nodeId: ID of node to duplicate
    ///   - newName: Optional new name for the duplicate
    /// - Returns: The created duplicate node
    /// - Throws: ServiceError on repository errors
    public func duplicateNode(nodeId: String, newName: String? = nil) async throws -> Node {
        guard let originalNode = try await nodeRepository.get(id: nodeId) else {
            throw ServiceError.notFound("Node with id \(nodeId) not found")
        }

        // Create duplicate with new ID and updated metadata
        let duplicateName = newName ?? "Copy of \(originalNode.name)"
        let duplicate = Node(
            id: UUID().uuidString,
            nodeType: originalNode.nodeType,
            name: duplicateName,
            content: originalNode.content,
            summary: originalNode.summary,
            latitude: originalNode.latitude,
            longitude: originalNode.longitude,
            locationName: originalNode.locationName,
            locationAddress: originalNode.locationAddress,
            createdAt: Date(),
            modifiedAt: Date(),
            dueAt: originalNode.dueAt,
            completedAt: nil, // Clear completion status for duplicate
            eventStart: originalNode.eventStart,
            eventEnd: originalNode.eventEnd,
            folder: originalNode.folder,
            tags: originalNode.tags,
            status: originalNode.status,
            priority: originalNode.priority,
            importance: originalNode.importance,
            sortOrder: originalNode.sortOrder,
            source: "duplicate",
            sourceId: originalNode.id, // Reference to original node
            sourceUrl: originalNode.sourceUrl,
            deletedAt: nil, // Ensure duplicate is not marked as deleted
            version: 1,
            syncVersion: 1,
            lastSyncedAt: nil,
            conflictResolvedAt: nil
        )

        return try await createNode(duplicate)
    }

    /// Archive old nodes based on age and criteria
    /// - Parameters:
    ///   - olderThan: Archive nodes older than this date
    ///   - nodeTypes: Optional array of node types to limit archival
    /// - Returns: Number of nodes archived
    /// - Throws: ServiceError on repository errors
    public func archiveOldNodes(olderThan: Date, nodeTypes: [String]? = nil) async throws -> Int {
        let nodes = try await nodeRepository.getByDateRange(
            startDate: Date.distantPast,
            endDate: olderThan,
            limit: nil,
            offset: nil
        )

        let nodesToArchive = nodes.filter { node in
            // Filter by node types if specified
            if let nodeTypes = nodeTypes, !nodeTypes.contains(node.nodeType) {
                return false
            }
            // Don't archive already deleted nodes
            return !node.isDeleted
        }

        // Archive by soft deletion
        for node in nodesToArchive {
            try await nodeRepository.delete(id: node.id)
        }

        return nodesToArchive.count
    }

    /// Get nodes that need attention (overdue, high priority, etc.)
    /// - Returns: Array of nodes requiring attention
    /// - Throws: ServiceError on repository errors
    public func getNodesNeedingAttention() async throws -> [Node] {
        let allNodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)

        return allNodes.filter { node in
            // Overdue nodes
            if node.isOverdue {
                return true
            }

            // High priority nodes
            if node.priority >= 8 {
                return true
            }

            // Important nodes without due date
            if node.importance >= 8 && node.dueAt == nil {
                return true
            }

            return false
        }
    }

    /// Get node statistics
    /// - Returns: Statistics about nodes in the system
    /// - Throws: ServiceError on repository errors
    public func getNodeStatistics() async throws -> NodeStatistics {
        let totalCount = try await nodeRepository.count(includeDeleted: false)
        let deletedCount = try await nodeRepository.count(includeDeleted: true) - totalCount
        let withLocationCount = (try await nodeRepository.getWithLocation(limit: nil, offset: nil)).count

        // Get nodes for additional stats
        let allNodes = try await nodeRepository.getAll(limit: nil, offset: nil, includeDeleted: false)

        let nodeTypeStats = Dictionary(grouping: allNodes, by: { $0.nodeType })
            .mapValues { $0.count }

        let overdueCount = allNodes.filter { $0.isOverdue }.count
        let completedCount = allNodes.filter { $0.completedAt != nil }.count

        return NodeStatistics(
            totalCount: totalCount,
            deletedCount: deletedCount,
            withLocationCount: withLocationCount,
            overdueCount: overdueCount,
            completedCount: completedCount,
            nodeTypeStats: nodeTypeStats
        )
    }

    // MARK: - Search and Filtering

    /// Advanced search with multiple criteria
    /// - Parameters:
    ///   - criteria: Search criteria
    /// - Returns: Array of matching nodes
    /// - Throws: ServiceError on repository errors
    public func advancedSearch(criteria: NodeSearchCriteria) async throws -> [Node] {
        var results: [Node] = []

        // Start with full-text search if query provided
        if let query = criteria.query, !query.isEmpty {
            results = try await nodeRepository.search(
                query: query,
                limit: criteria.limit,
                offset: criteria.offset
            )
        } else {
            results = try await nodeRepository.getAll(
                limit: criteria.limit,
                offset: criteria.offset,
                includeDeleted: false
            )
        }

        // Apply additional filters
        results = results.filter { node in
            // Node types filter
            if let nodeTypes = criteria.nodeTypes, !nodeTypes.isEmpty {
                if !nodeTypes.contains(node.nodeType) {
                    return false
                }
            }

            // Tags filter
            if let tags = criteria.tags, !tags.isEmpty {
                let nodeTags = Set(node.tags)
                let searchTags = Set(tags)
                if nodeTags.intersection(searchTags).isEmpty {
                    return false
                }
            }

            // Date range filter
            if let startDate = criteria.startDate {
                if node.createdAt < startDate {
                    return false
                }
            }

            if let endDate = criteria.endDate {
                if node.createdAt > endDate {
                    return false
                }
            }

            // Priority filter
            if let minPriority = criteria.minPriority {
                if node.priority < minPriority {
                    return false
                }
            }

            return true
        }

        return results
    }

    // MARK: - Private Validation

    /// Validate node business rules
    /// - Parameter node: Node to validate
    /// - Throws: ServiceError on validation failures
    private func validateNode(_ node: Node) throws {
        // Name is required and not empty
        if node.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw ServiceError.invalidData("Node name cannot be empty")
        }

        // Priority and importance must be in valid range
        if node.priority < 0 || node.priority > 10 {
            throw ServiceError.invalidData("Priority must be between 0 and 10")
        }

        if node.importance < 0 || node.importance > 10 {
            throw ServiceError.invalidData("Importance must be between 0 and 10")
        }

        // Event dates must be logical
        if let eventStart = node.eventStart, let eventEnd = node.eventEnd {
            if eventStart > eventEnd {
                throw ServiceError.invalidData("Event start time cannot be after end time")
            }
        }

        // Due date cannot be in the past for new nodes (when creating)
        if let dueAt = node.dueAt, dueAt < Date() && node.version == 1 {
            throw ServiceError.invalidData("Due date cannot be in the past")
        }

        // Location coordinates must be valid
        if let latitude = node.latitude {
            if latitude < -90 || latitude > 90 {
                throw ServiceError.invalidData("Latitude must be between -90 and 90")
            }
        }

        if let longitude = node.longitude {
            if longitude < -180 || longitude > 180 {
                throw ServiceError.invalidData("Longitude must be between -180 and 180")
            }
        }
    }
}

// MARK: - Supporting Types

/// Node search criteria for advanced search
public struct NodeSearchCriteria {
    public let query: String?
    public let nodeTypes: [String]?
    public let tags: [String]?
    public let startDate: Date?
    public let endDate: Date?
    public let minPriority: Int?
    public let limit: Int?
    public let offset: Int?

    public init(
        query: String? = nil,
        nodeTypes: [String]? = nil,
        tags: [String]? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        minPriority: Int? = nil,
        limit: Int? = nil,
        offset: Int? = nil
    ) {
        self.query = query
        self.nodeTypes = nodeTypes
        self.tags = tags
        self.startDate = startDate
        self.endDate = endDate
        self.minPriority = minPriority
        self.limit = limit
        self.offset = offset
    }
}

/// Node statistics
public struct NodeStatistics: Codable, Sendable {
    public let totalCount: Int
    public let deletedCount: Int
    public let withLocationCount: Int
    public let overdueCount: Int
    public let completedCount: Int
    public let nodeTypeStats: [String: Int]

    public init(
        totalCount: Int,
        deletedCount: Int,
        withLocationCount: Int,
        overdueCount: Int,
        completedCount: Int,
        nodeTypeStats: [String: Int]
    ) {
        self.totalCount = totalCount
        self.deletedCount = deletedCount
        self.withLocationCount = withLocationCount
        self.overdueCount = overdueCount
        self.completedCount = completedCount
        self.nodeTypeStats = nodeTypeStats
    }
}

/// Service-specific errors
public enum ServiceError: Error, Sendable {
    case notFound(String)
    case invalidData(String)
    case conflictError(String)
    case businessRuleViolation(String)
    case dependencyMissing(String)

    public var localizedDescription: String {
        switch self {
        case .notFound(let message):
            return "Not found: \(message)"
        case .invalidData(let message):
            return "Invalid data: \(message)"
        case .conflictError(let message):
            return "Conflict error: \(message)"
        case .businessRuleViolation(let message):
            return "Business rule violation: \(message)"
        case .dependencyMissing(let message):
            return "Dependency missing: \(message)"
        }
    }
}