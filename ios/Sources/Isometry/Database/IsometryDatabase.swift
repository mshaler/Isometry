import Foundation
import GRDB

/// Thread-safe database actor for Isometry
///
/// Provides all CRUD operations, full-text search, and graph traversal
/// using native SQLite features (FTS5, recursive CTEs).
public actor IsometryDatabase {
    // MARK: - Properties

    private let dbPool: DatabasePool
    private var isInitialized = false

    // MARK: - Initialization

    /// Creates a new database actor with the specified path
    /// - Parameter path: File path for the SQLite database. Use `:memory:` for in-memory database.
    public init(path: String) throws {
        var config = Configuration()
        config.foreignKeysEnabled = true
        config.prepareDatabase { db in
            // Enable WAL mode for better concurrent access
            try db.execute(sql: "PRAGMA journal_mode = WAL")
            try db.execute(sql: "PRAGMA synchronous = NORMAL")
            try db.execute(sql: "PRAGMA cache_size = -64000") // 64MB cache
        }

        if path == ":memory:" {
            dbPool = try DatabasePool(path: "", configuration: config)
        } else {
            dbPool = try DatabasePool(path: path, configuration: config)
        }
    }

    /// Initializes the database schema
    public func initialize() async throws {
        guard !isInitialized else { return }

        try await dbPool.write { db in
            // Load schema from bundled SQL file
            guard let schemaURL = Bundle.module.url(forResource: "schema", withExtension: "sql"),
                  let schemaSQL = try? String(contentsOf: schemaURL, encoding: .utf8) else {
                throw DatabaseError.schemaLoadFailed(underlying: NSError(
                    domain: "IsometryDatabase",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "schema.sql not found in bundle"]
                ))
            }

            // Execute schema (handles CREATE IF NOT EXISTS)
            try db.execute(sql: schemaSQL)
        }

        isInitialized = true
    }

    // MARK: - Node CRUD

    /// Creates a new node
    public func createNode(_ node: Node) async throws {
        try await dbPool.write { db in
            try node.insert(db)
        }
    }

    /// Updates an existing node
    public func updateNode(_ node: Node) async throws {
        var updatedNode = node
        updatedNode.modifiedAt = Date()
        updatedNode.version += 1
        updatedNode.syncVersion += 1

        try await dbPool.write { db in
            try updatedNode.update(db)
        }
    }

    /// Soft-deletes a node by setting deleted_at
    public func deleteNode(id: String) async throws {
        try await dbPool.write { db in
            try db.execute(
                sql: """
                    UPDATE nodes
                    SET deleted_at = datetime('now'),
                        modified_at = datetime('now'),
                        sync_version = sync_version + 1
                    WHERE id = ?
                    """,
                arguments: [id]
            )
        }
    }

    /// Hard-deletes a node permanently
    public func purgeNode(id: String) async throws {
        try await dbPool.write { db in
            try db.execute(sql: "DELETE FROM nodes WHERE id = ?", arguments: [id])
        }
    }

    /// Fetches a single node by ID
    public func getNode(id: String) async throws -> Node? {
        try await dbPool.read { db in
            try Node.fetchOne(db, key: id)
        }
    }

    /// Fetches all active (non-deleted) nodes
    public func getAllNodes() async throws -> [Node] {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.deletedAt == nil)
                .order(Node.Columns.modifiedAt.desc)
                .fetchAll(db)
        }
    }

    /// Fetches nodes matching a folder
    public func getNodes(inFolder folder: String) async throws -> [Node] {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.folder == folder)
                .filter(Node.Columns.deletedAt == nil)
                .order(Node.Columns.sortOrder, Node.Columns.name)
                .fetchAll(db)
        }
    }

    /// Fetches nodes by type
    public func getNodes(ofType nodeType: String) async throws -> [Node] {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.nodeType == nodeType)
                .filter(Node.Columns.deletedAt == nil)
                .order(Node.Columns.modifiedAt.desc)
                .fetchAll(db)
        }
    }

    // MARK: - Full-Text Search (FTS5)

    /// Searches nodes using FTS5 full-text search
    /// - Parameter query: Search query (supports FTS5 syntax: AND, OR, NOT, phrases, etc.)
    /// - Returns: Matching nodes ordered by relevance
    public func searchNodes(query: String) async throws -> [Node] {
        try await dbPool.read { db in
            let sql = """
                SELECT nodes.*
                FROM nodes
                JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
                WHERE nodes_fts MATCH ?
                  AND nodes.deleted_at IS NULL
                ORDER BY rank
                """
            return try Node.fetchAll(db, sql: sql, arguments: [query])
        }
    }

    // MARK: - Edge CRUD

    /// Creates a new edge
    public func createEdge(_ edge: Edge) async throws {
        try await dbPool.write { db in
            try edge.insert(db)
        }
    }

    /// Updates an existing edge
    public func updateEdge(_ edge: Edge) async throws {
        var updatedEdge = edge
        updatedEdge.syncVersion += 1

        try await dbPool.write { db in
            try updatedEdge.update(db)
        }
    }

    /// Deletes an edge
    public func deleteEdge(id: String) async throws {
        try await dbPool.write { db in
            try db.execute(sql: "DELETE FROM edges WHERE id = ?", arguments: [id])
        }
    }

    /// Fetches edges from a source node
    public func getEdges(fromNode sourceId: String, type: EdgeType? = nil) async throws -> [Edge] {
        try await dbPool.read { db in
            var request = Edge.filter(Edge.Columns.sourceId == sourceId)
            if let type {
                request = request.filter(Edge.Columns.edgeType == type.rawValue)
            }
            return try request.fetchAll(db)
        }
    }

    /// Fetches edges to a target node
    public func getEdges(toNode targetId: String, type: EdgeType? = nil) async throws -> [Edge] {
        try await dbPool.read { db in
            var request = Edge.filter(Edge.Columns.targetId == targetId)
            if let type {
                request = request.filter(Edge.Columns.edgeType == type.rawValue)
            }
            return try request.fetchAll(db)
        }
    }

    // MARK: - Graph Traversal (Recursive CTEs)

    /// Finds all nodes connected to a starting node within a given depth
    /// Uses BFS traversal via recursive CTE
    public func connectedNodes(from startId: String, maxDepth: Int = 3) async throws -> [Node] {
        try await dbPool.read { db in
            let sql = """
                WITH RECURSIVE connected AS (
                    -- Base case: start node
                    SELECT id, 0 as depth
                    FROM nodes
                    WHERE id = ? AND deleted_at IS NULL

                    UNION ALL

                    -- Recursive case: follow edges
                    SELECT DISTINCT
                        CASE
                            WHEN e.source_id = c.id THEN e.target_id
                            ELSE e.source_id
                        END as id,
                        c.depth + 1 as depth
                    FROM connected c
                    JOIN edges e ON (e.source_id = c.id OR (e.target_id = c.id AND e.directed = 0))
                    WHERE c.depth < ?
                )
                SELECT DISTINCT n.*
                FROM nodes n
                JOIN connected c ON n.id = c.id
                WHERE n.deleted_at IS NULL
                ORDER BY c.depth, n.name
                """
            return try Node.fetchAll(db, sql: sql, arguments: [startId, maxDepth])
        }
    }

    /// Finds the shortest path between two nodes
    /// Returns the path as an array of nodes, or nil if no path exists
    public func shortestPath(from fromId: String, to toId: String, maxDepth: Int = 10) async throws -> [Node]? {
        try await dbPool.read { db in
            let sql = """
                WITH RECURSIVE path AS (
                    -- Base case
                    SELECT
                        id,
                        id as path,
                        0 as depth
                    FROM nodes
                    WHERE id = ? AND deleted_at IS NULL

                    UNION ALL

                    -- Recursive case
                    SELECT
                        CASE
                            WHEN e.source_id = p.id THEN e.target_id
                            ELSE e.source_id
                        END as id,
                        p.path || ',' ||
                        CASE
                            WHEN e.source_id = p.id THEN e.target_id
                            ELSE e.source_id
                        END as path,
                        p.depth + 1 as depth
                    FROM path p
                    JOIN edges e ON (e.source_id = p.id OR (e.target_id = p.id AND e.directed = 0))
                    JOIN nodes n ON n.id = CASE
                        WHEN e.source_id = p.id THEN e.target_id
                        ELSE e.source_id
                    END
                    WHERE p.depth < ?
                      AND n.deleted_at IS NULL
                      AND p.path NOT LIKE '%' || CASE
                          WHEN e.source_id = p.id THEN e.target_id
                          ELSE e.source_id
                      END || '%'
                )
                SELECT path FROM path WHERE id = ?
                ORDER BY depth
                LIMIT 1
                """

            guard let row = try Row.fetchOne(db, sql: sql, arguments: [fromId, maxDepth, toId]),
                  let pathString: String = row["path"] else {
                return nil
            }

            let nodeIds = pathString.split(separator: ",").map(String.init)
            var nodes: [Node] = []

            for nodeId in nodeIds {
                if let node = try Node.fetchOne(db, key: nodeId) {
                    nodes.append(node)
                }
            }

            return nodes
        }
    }

    /// Gets immediate neighbors of a node
    public func neighbors(of nodeId: String) async throws -> [Node] {
        try await dbPool.read { db in
            let sql = """
                SELECT DISTINCT n.*
                FROM nodes n
                JOIN edges e ON (
                    (e.source_id = ? AND e.target_id = n.id) OR
                    (e.target_id = ? AND e.source_id = n.id AND e.directed = 0)
                )
                WHERE n.deleted_at IS NULL
                ORDER BY n.name
                """
            return try Node.fetchAll(db, sql: sql, arguments: [nodeId, nodeId])
        }
    }

    /// Calculates node importance based on inbound edge weights
    public func nodeImportance() async throws -> [(node: Node, importance: Double)] {
        try await dbPool.read { db in
            let sql = """
                SELECT n.*, COALESCE(SUM(e.weight), 0) as importance
                FROM nodes n
                LEFT JOIN edges e ON e.target_id = n.id
                WHERE n.deleted_at IS NULL
                GROUP BY n.id
                ORDER BY importance DESC
                """

            return try Row.fetchAll(db, sql: sql).compactMap { row in
                guard let node = try? Node(row: row) else { return nil }
                let importance: Double = row["importance"]
                return (node: node, importance: importance)
            }
        }
    }

    // MARK: - Sync State

    /// Gets the current sync state
    public func getSyncState() async throws -> SyncState {
        try await dbPool.read { db in
            try SyncState.fetchOne(db, key: "default") ?? SyncState()
        }
    }

    /// Updates the sync state
    public func updateSyncState(_ state: SyncState) async throws {
        try await dbPool.write { db in
            try state.save(db)
        }
    }

    /// Gets nodes modified since last sync
    public func getPendingChanges(since syncVersion: Int) async throws -> [Node] {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.syncVersion > syncVersion)
                .fetchAll(db)
        }
    }

    // MARK: - Transaction Support

    /// Executes a block within a database transaction
    public func transaction<T>(_ block: @Sendable (Database) throws -> T) async throws -> T {
        try await dbPool.write { db in
            try block(db)
        }
    }
}
