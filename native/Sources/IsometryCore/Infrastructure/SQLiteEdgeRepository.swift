import Foundation
import GRDB

/// SQLite implementation of EdgeRepository
/// Provides graph operations and queries using SQLite with recursive CTEs
public actor SQLiteEdgeRepository: EdgeRepository {
    private let database: DatabaseQueue

    /// Initialize with a GRDB DatabaseQueue
    /// - Parameter database: The GRDB database queue
    public init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - Basic CRUD Operations

    public func create(_ edge: Edge) async throws {
        try await database.write { db in
            try edge.insert(db)
        }
    }

    public func createBatch(_ edges: [Edge]) async throws {
        try await database.write { db in
            for edge in edges {
                try edge.insert(db)
            }
        }
    }

    public func get(id: String) async throws -> Edge? {
        try await database.read { db in
            try Edge.fetchOne(db, sql: """
                SELECT * FROM edges WHERE id = ?
            """, arguments: [id])
        }
    }

    public func update(_ edge: Edge) async throws {
        try await database.write { db in
            try edge.update(db)
        }
    }

    public func delete(id: String) async throws {
        try await database.write { db in
            try db.execute(sql: """
                DELETE FROM edges WHERE id = ?
            """, arguments: [id])
        }
    }

    // MARK: - Basic Edge Queries

    public func getAll(limit: Int?, offset: Int?) async throws -> [Edge] {
        try await database.read { db in
            var sql = "SELECT * FROM edges ORDER BY created_at DESC"
            var arguments: StatementArguments = []

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(contentsOf: [limit])

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(contentsOf: [offset])
                }
            }

            return try Edge.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func count() async throws -> Int {
        try await database.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM edges") ?? 0
        }
    }

    public func getByType(_ edgeType: EdgeType, limit: Int?, offset: Int?) async throws -> [Edge] {
        try await database.read { db in
            var sql = """
                SELECT * FROM edges
                WHERE edge_type = ?
                ORDER BY created_at DESC
            """
            var arguments: StatementArguments = [edgeType.rawValue]

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(contentsOf: [limit])

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(contentsOf: [offset])
                }
            }

            return try Edge.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getOutgoingEdges(sourceId: String, edgeType: EdgeType?) async throws -> [Edge] {
        try await database.read { db in
            if let edgeType = edgeType {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE source_id = ? AND edge_type = ?
                    ORDER BY created_at ASC
                """, arguments: [sourceId, edgeType.rawValue])
            } else {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE source_id = ?
                    ORDER BY created_at ASC
                """, arguments: [sourceId])
            }
        }
    }

    public func getIncomingEdges(targetId: String, edgeType: EdgeType?) async throws -> [Edge] {
        try await database.read { db in
            if let edgeType = edgeType {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE target_id = ? AND edge_type = ?
                    ORDER BY created_at ASC
                """, arguments: [targetId, edgeType.rawValue])
            } else {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE target_id = ?
                    ORDER BY created_at ASC
                """, arguments: [targetId])
            }
        }
    }

    public func getConnectedEdges(nodeId: String, edgeType: EdgeType?) async throws -> [Edge] {
        try await database.read { db in
            if let edgeType = edgeType {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE (source_id = ? OR target_id = ?) AND edge_type = ?
                    ORDER BY created_at ASC
                """, arguments: [nodeId, nodeId, edgeType.rawValue])
            } else {
                return try Edge.fetchAll(db, sql: """
                    SELECT * FROM edges
                    WHERE source_id = ? OR target_id = ?
                    ORDER BY created_at ASC
                """, arguments: [nodeId, nodeId])
            }
        }
    }

    // MARK: - Graph Traversal Operations

    public func getNeighbors(nodeId: String, edgeType: EdgeType?, direction: TraversalDirection) async throws -> [String] {
        try await database.read { db in
            var sql = ""
            var arguments: StatementArguments = []

            switch direction {
            case .outgoing:
                sql = """
                    SELECT DISTINCT target_id FROM edges
                    WHERE source_id = ?
                """
                arguments = [nodeId]

            case .incoming:
                sql = """
                    SELECT DISTINCT source_id FROM edges
                    WHERE target_id = ?
                """
                arguments = [nodeId]

            case .both:
                sql = """
                    SELECT DISTINCT target_id as neighbor FROM edges WHERE source_id = ?
                    UNION
                    SELECT DISTINCT source_id as neighbor FROM edges WHERE target_id = ?
                """
                arguments = [nodeId, nodeId]
            }

            if let edgeType = edgeType {
                sql += " AND edge_type = ?"
                arguments.append(contentsOf: [edgeType.rawValue])
            }

            return try String.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getNodesAtDistance(sourceId: String, distance: Int, edgeType: EdgeType?, direction: TraversalDirection) async throws -> [String] {
        try await database.read { db in
            let edgeCondition = edgeType != nil ? "AND edge_type = ?" : ""
            var arguments: StatementArguments = [sourceId, distance]
            if let edgeType = edgeType {
                arguments.append(contentsOf: [edgeType.rawValue])
            }

            let directionCondition: String
            switch direction {
            case .outgoing:
                directionCondition = "parent_id = edges.source_id AND child_id = edges.target_id"
            case .incoming:
                directionCondition = "parent_id = edges.target_id AND child_id = edges.source_id"
            case .both:
                directionCondition = "(parent_id = edges.source_id AND child_id = edges.target_id) OR (parent_id = edges.target_id AND child_id = edges.source_id)"
            }

            let sql = """
                WITH RECURSIVE graph_traversal(node_id, depth) AS (
                    SELECT ?, 0
                    UNION ALL
                    SELECT
                        CASE
                            WHEN parent_id = edges.source_id THEN edges.target_id
                            ELSE edges.source_id
                        END as node_id,
                        depth + 1
                    FROM graph_traversal
                    JOIN edges ON (\(directionCondition))
                    WHERE depth < ? \(edgeCondition)
                )
                SELECT DISTINCT node_id FROM graph_traversal WHERE depth = ?
            """

            arguments.append(contentsOf: [distance])
            return try String.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func findShortestPath(sourceId: String, targetId: String, edgeType: EdgeType?, maxDistance: Int) async throws -> [String] {
        try await database.read { db in
            let edgeCondition = edgeType != nil ? "AND edge_type = ?" : ""
            var arguments: StatementArguments = [sourceId, maxDistance]
            if let edgeType = edgeType {
                arguments.append(contentsOf: [edgeType.rawValue])
            }
            arguments.append(contentsOf: [targetId])

            let sql = """
                WITH RECURSIVE path_search(node_id, path, depth) AS (
                    SELECT ?, json_array(?), 0
                    UNION ALL
                    SELECT
                        edges.target_id,
                        json_insert(path, '$[#]', edges.target_id),
                        depth + 1
                    FROM path_search
                    JOIN edges ON path_search.node_id = edges.source_id
                    WHERE depth < ? \(edgeCondition)
                      AND json_extract(path, '$') NOT LIKE '%' || edges.target_id || '%'
                )
                SELECT path FROM path_search
                WHERE node_id = ?
                ORDER BY depth
                LIMIT 1
            """

            if let pathJSON = try String.fetchOne(db, sql: sql, arguments: arguments) {
                let pathData = pathJSON.data(using: .utf8) ?? Data()
                return (try? JSONDecoder().decode([String].self, from: pathData)) ?? []
            }

            return []
        }
    }

    public func extractSubgraph(centerId: String, depth: Int, edgeType: EdgeType?, direction: TraversalDirection) async throws -> Subgraph {
        try await database.read { db in
            let edgeCondition = edgeType != nil ? "AND edge_type = ?" : ""
            var arguments: StatementArguments = [centerId, depth]
            if let edgeType = edgeType {
                arguments.append(contentsOf: [edgeType.rawValue])
            }

            let directionCondition: String
            switch direction {
            case .outgoing:
                directionCondition = "parent_id = edges.source_id AND child_id = edges.target_id"
            case .incoming:
                directionCondition = "parent_id = edges.target_id AND child_id = edges.source_id"
            case .both:
                directionCondition = "(parent_id = edges.source_id AND child_id = edges.target_id) OR (parent_id = edges.target_id AND child_id = edges.source_id)"
            }

            // Get all nodes within the specified depth
            let nodesSql = """
                WITH RECURSIVE subgraph_traversal(node_id, depth) AS (
                    SELECT ?, 0
                    UNION ALL
                    SELECT
                        CASE
                            WHEN parent_id = edges.source_id THEN edges.target_id
                            ELSE edges.source_id
                        END as node_id,
                        depth + 1
                    FROM subgraph_traversal
                    JOIN edges ON (\(directionCondition))
                    WHERE depth < ? \(edgeCondition)
                )
                SELECT DISTINCT node_id FROM subgraph_traversal
            """

            let nodeIds = try String.fetchAll(db, sql: nodesSql, arguments: arguments)

            // Get all edges between these nodes
            if nodeIds.isEmpty {
                return Subgraph(centerNodeId: centerId, nodeIds: [centerId], edges: [], depth: depth)
            }

            let placeholders = nodeIds.map { _ in "?" }.joined(separator: ", ")
            let edgesSql = """
                SELECT * FROM edges
                WHERE source_id IN (\(placeholders)) AND target_id IN (\(placeholders)) \(edgeCondition)
            """

            var edgeArguments = StatementArguments(nodeIds + nodeIds)
            if let edgeType = edgeType {
                edgeArguments.append(contentsOf: [edgeType.rawValue])
            }

            let edges = try Edge.fetchAll(db, sql: edgesSql, arguments: edgeArguments)

            return Subgraph(centerNodeId: centerId, nodeIds: nodeIds, edges: edges, depth: depth)
        }
    }

    public func findConnectedComponents(edgeType: EdgeType?, minSize: Int) async throws -> [[String]] {
        try await database.read { db in
            let edgeCondition = edgeType != nil ? "WHERE edge_type = ?" : ""
            var arguments: StatementArguments = []
            if let edgeType = edgeType {
                arguments.append(contentsOf: [edgeType.rawValue])
            }

            // Get all unique node IDs
            let nodesSql = """
                SELECT DISTINCT source_id as node_id FROM edges \(edgeCondition)
                UNION
                SELECT DISTINCT target_id as node_id FROM edges \(edgeCondition)
            """

            let allNodes = try String.fetchAll(db, sql: nodesSql, arguments: arguments)
            var visited: Set<String> = []
            var components: [[String]] = []

            // For each unvisited node, find its connected component
            for node in allNodes {
                if !visited.contains(node) {
                    let component = try self.findComponentForNode(node, db: db, edgeType: edgeType)

                    // Mark all nodes in this component as visited
                    for nodeId in component {
                        visited.insert(nodeId)
                    }

                    // Add component if it meets minimum size
                    if component.count >= minSize {
                        components.append(component)
                    }
                }
            }

            return components
        }
    }

    // MARK: - Sequence Operations

    public func getSequence(startId: String, maxLength: Int) async throws -> [String] {
        try await database.read { db in
            let sql = """
                WITH RECURSIVE sequence_traversal(node_id, depth, sequence_order) AS (
                    SELECT ?, 0, -1
                    UNION ALL
                    SELECT
                        edges.target_id,
                        depth + 1,
                        edges.sequence_order
                    FROM sequence_traversal
                    JOIN edges ON sequence_traversal.node_id = edges.source_id
                    WHERE depth < ? AND edges.edge_type = 'SEQUENCE'
                    ORDER BY edges.sequence_order ASC
                )
                SELECT node_id FROM sequence_traversal ORDER BY depth ASC
            """

            return try String.fetchAll(db, sql: sql, arguments: [startId, maxLength])
        }
    }

    public func getAllSequences(minLength: Int) async throws -> [[String]] {
        // First, get all sequence start points
        let startNodes = try await database.read { db in
            let startNodesSql = """
                SELECT DISTINCT source_id FROM edges WHERE edge_type = 'SEQUENCE'
                AND source_id NOT IN (
                    SELECT DISTINCT target_id FROM edges WHERE edge_type = 'SEQUENCE'
                )
            """
            return try String.fetchAll(db, sql: startNodesSql)
        }

        // Then, get sequences for each start node
        var sequences: [[String]] = []
        for startNode in startNodes {
            let sequence = try await getSequence(startId: startNode, maxLength: 100) // Reasonable max
            if sequence.count >= minLength {
                sequences.append(sequence)
            }
        }

        return sequences
    }

    // MARK: - Hierarchy Operations

    public func getChildren(parentId: String) async throws -> [String] {
        try await database.read { db in
            try String.fetchAll(db, sql: """
                SELECT target_id FROM edges
                WHERE source_id = ? AND edge_type = 'NEST'
                ORDER BY sequence_order ASC, created_at ASC
            """, arguments: [parentId])
        }
    }

    public func getParent(childId: String) async throws -> String? {
        try await database.read { db in
            try String.fetchOne(db, sql: """
                SELECT source_id FROM edges
                WHERE target_id = ? AND edge_type = 'NEST'
                LIMIT 1
            """, arguments: [childId])
        }
    }

    public func getDescendants(ancestorId: String, maxDepth: Int) async throws -> [String] {
        try await database.read { db in
            let sql = """
                WITH RECURSIVE hierarchy_traversal(node_id, depth) AS (
                    SELECT ?, 0
                    UNION ALL
                    SELECT
                        edges.target_id,
                        depth + 1
                    FROM hierarchy_traversal
                    JOIN edges ON hierarchy_traversal.node_id = edges.source_id
                    WHERE depth < ? AND edges.edge_type = 'NEST'
                )
                SELECT DISTINCT node_id FROM hierarchy_traversal WHERE depth > 0
                ORDER BY depth ASC
            """

            return try String.fetchAll(db, sql: sql, arguments: [ancestorId, maxDepth])
        }
    }

    public func getAncestors(descendantId: String) async throws -> [String] {
        try await database.read { db in
            let sql = """
                WITH RECURSIVE ancestor_traversal(node_id, depth) AS (
                    SELECT ?, 0
                    UNION ALL
                    SELECT
                        edges.source_id,
                        depth + 1
                    FROM ancestor_traversal
                    JOIN edges ON ancestor_traversal.node_id = edges.target_id
                    WHERE edges.edge_type = 'NEST'
                )
                SELECT node_id FROM ancestor_traversal WHERE depth > 0
                ORDER BY depth ASC
            """

            return try String.fetchAll(db, sql: sql, arguments: [descendantId])
        }
    }

    public func getRootNodes() async throws -> [String] {
        try await database.read { db in
            try String.fetchAll(db, sql: """
                SELECT DISTINCT source_id FROM edges WHERE edge_type = 'NEST'
                AND source_id NOT IN (
                    SELECT DISTINCT target_id FROM edges WHERE edge_type = 'NEST'
                )
            """)
        }
    }

    public func getLeafNodes() async throws -> [String] {
        try await database.read { db in
            try String.fetchAll(db, sql: """
                SELECT DISTINCT target_id FROM edges WHERE edge_type = 'NEST'
                AND target_id NOT IN (
                    SELECT DISTINCT source_id FROM edges WHERE edge_type = 'NEST'
                )
            """)
        }
    }

    // MARK: - Private Helper Methods

    /// Find all nodes in the connected component containing the given node
    private nonisolated func findComponentForNode(_ nodeId: String, db: Database, edgeType: EdgeType?) throws -> [String] {
        let edgeCondition = edgeType != nil ? "AND edge_type = ?" : ""
        var arguments: StatementArguments = [nodeId]
        if let edgeType = edgeType {
            arguments.append(contentsOf: [edgeType.rawValue])
        }

        let sql = """
            WITH RECURSIVE component_traversal(node_id) AS (
                SELECT ?
                UNION
                SELECT edges.target_id
                FROM component_traversal
                JOIN edges ON component_traversal.node_id = edges.source_id \(edgeCondition)
                UNION
                SELECT edges.source_id
                FROM component_traversal
                JOIN edges ON component_traversal.node_id = edges.target_id \(edgeCondition)
            )
            SELECT DISTINCT node_id FROM component_traversal
        """

        return try String.fetchAll(db, sql: sql, arguments: arguments)
    }
}

// MARK: - GRDB Integration

extension Edge: FetchableRecord, PersistableRecord {
    /// Database table name
    public static let databaseTableName = "edges"

    /// Initialize from database row
    public init(row: Row) throws {
        id = row["id"]
        edgeType = EdgeType(rawValue: row["edge_type"]) ?? .link
        sourceId = row["source_id"]
        targetId = row["target_id"]
        label = row["label"]
        weight = row["weight"]
        directed = row["directed"]
        sequenceOrder = row["sequence_order"]
        channel = row["channel"]
        timestamp = row["timestamp"]
        subject = row["subject"]
        createdAt = row["created_at"]
        syncVersion = row["sync_version"]
    }

    /// Encode to database row
    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["edge_type"] = edgeType.rawValue
        container["source_id"] = sourceId
        container["target_id"] = targetId
        container["label"] = label
        container["weight"] = weight
        container["directed"] = directed
        container["sequence_order"] = sequenceOrder
        container["channel"] = channel
        container["timestamp"] = timestamp
        container["subject"] = subject
        container["created_at"] = createdAt
        container["sync_version"] = syncVersion
    }

    /// Database selection
    public static let databaseSelection: [any SQLSelectable] = [AllColumns()]
}