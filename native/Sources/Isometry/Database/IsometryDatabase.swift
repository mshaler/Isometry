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
        let isMemory = path == ":memory:" || path.isEmpty
        let enableWAL = !isMemory

        var config = Configuration()
        config.foreignKeysEnabled = true
        config.prepareDatabase { db in
            // Only enable WAL mode for file-based databases
            // In-memory databases don't support WAL
            if enableWAL {
                try db.execute(sql: "PRAGMA journal_mode = WAL")
                try db.execute(sql: "PRAGMA synchronous = NORMAL")
            }
            try db.execute(sql: "PRAGMA cache_size = -64000") // 64MB cache
        }

        if isMemory {
            // For in-memory databases, use a temporary file-based database
            // GRDB's DatabasePool doesn't support true in-memory databases
            let tempDir = FileManager.default.temporaryDirectory
            let tempPath = tempDir.appendingPathComponent(UUID().uuidString + ".sqlite").path
            dbPool = try DatabasePool(path: tempPath, configuration: config)
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

        let nodeToSave = updatedNode // Capture immutable copy for sendable closure
        try await dbPool.write { db in
            try nodeToSave.update(db)
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

    /// Fetches a node by source ID and source name
    public func getNode(bySourceId sourceId: String, source: String) async throws -> Node? {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.sourceId == sourceId)
                .filter(Node.Columns.source == source)
                .fetchOne(db)
        }
    }

    /// Counts all active (non-deleted) nodes
    public func countNodes() async throws -> Int {
        try await dbPool.read { db in
            try Node
                .filter(Node.Columns.deletedAt == nil)
                .fetchCount(db)
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

        let edgeToSave = updatedEdge // Capture immutable copy for sendable closure
        try await dbPool.write { db in
            try edgeToSave.update(db)
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
                    -- Outbound: node is source, return targets
                    (e.source_id = ? AND e.target_id = n.id) OR
                    -- Inbound: node is target, return sources (for undirected edges)
                    (e.target_id = ? AND e.source_id = n.id AND e.directed = 0) OR
                    -- Inbound: node is target, return sources (for directed edges too, as neighbors)
                    (e.target_id = ? AND e.source_id = n.id)
                )
                WHERE n.deleted_at IS NULL
                ORDER BY n.name
                """
            return try Node.fetchAll(db, sql: sql, arguments: [nodeId, nodeId, nodeId])
        }
    }

    /// Calculates node importance based on inbound edge weights (simple centrality)
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

    // MARK: - PageRank Algorithm

    /// Calculates PageRank scores for all nodes using iterative power method
    /// - Parameters:
    ///   - dampingFactor: Probability of following a link (typically 0.85)
    ///   - iterations: Number of iterations to converge
    /// - Returns: Nodes with their PageRank scores, sorted by rank descending
    public func pageRank(dampingFactor: Double = 0.85, iterations: Int = 20) async throws -> [(node: Node, rank: Double)] {
        try await dbPool.read { db in
            // PageRank formula: PR(n) = (1-d)/N + d * Σ(PR(m)/outDegree(m)) for all m linking to n
            // SQLite recursive CTEs have limitations for iterative algorithms,
            // so we use in-memory iteration for accuracy:
            return try self.performPageRankInMemory(db: db, dampingFactor: dampingFactor, iterations: iterations)
        }
    }

    /// In-memory PageRank implementation for accuracy
    private nonisolated func performPageRankInMemory(db: Database, dampingFactor: Double, iterations: Int) throws -> [(node: Node, rank: Double)] {
        // Fetch all nodes
        let nodes = try Node.filter(Node.Columns.deletedAt == nil).fetchAll(db)
        guard !nodes.isEmpty else { return [] }

        // Build adjacency structure
        let edges = try Edge.fetchAll(db)

        // Map node IDs to indices
        var idToIndex: [String: Int] = [:]
        for (index, node) in nodes.enumerated() {
            idToIndex[node.id] = index
        }

        let n = nodes.count
        let initialRank = 1.0 / Double(n)

        // Initialize ranks
        var ranks = Array(repeating: initialRank, count: n)

        // Build outbound edges and compute out-degrees
        var outEdges: [[Int]] = Array(repeating: [], count: n)
        var outDegree: [Int] = Array(repeating: 0, count: n)

        for edge in edges {
            guard let sourceIdx = idToIndex[edge.sourceId],
                  let targetIdx = idToIndex[edge.targetId] else { continue }
            outEdges[sourceIdx].append(targetIdx)
            outDegree[sourceIdx] += 1
        }

        // Iterative PageRank
        for _ in 0..<iterations {
            var newRanks = Array(repeating: (1.0 - dampingFactor) / Double(n), count: n)

            for sourceIdx in 0..<n {
                guard outDegree[sourceIdx] > 0 else { continue }
                let contribution = dampingFactor * ranks[sourceIdx] / Double(outDegree[sourceIdx])
                for targetIdx in outEdges[sourceIdx] {
                    newRanks[targetIdx] += contribution
                }
            }

            // Handle dangling nodes (no outbound edges)
            let danglingSum = zip(ranks, outDegree)
                .filter { $0.1 == 0 }
                .reduce(0.0) { $0 + $1.0 }
            let danglingContribution = dampingFactor * danglingSum / Double(n)

            for i in 0..<n {
                newRanks[i] += danglingContribution
            }

            ranks = newRanks
        }

        // Combine with nodes and sort
        var results: [(node: Node, rank: Double)] = []
        for (index, node) in nodes.enumerated() {
            results.append((node: node, rank: ranks[index]))
        }

        return results.sorted { $0.rank > $1.rank }
    }

    // MARK: - Dijkstra's Algorithm (Weighted Shortest Path)

    /// Finds the shortest weighted path between two nodes using Dijkstra's algorithm
    /// - Parameters:
    ///   - fromId: Source node ID
    ///   - toId: Target node ID
    /// - Returns: Path as array of (node, cumulative distance), or nil if no path exists
    public func dijkstraPath(from fromId: String, to toId: String) async throws -> [(node: Node, distance: Double)]? {
        try await dbPool.read { db in
            try self.performDijkstraInMemory(db: db, from: fromId, to: toId)
        }
    }

    /// In-memory Dijkstra implementation
    private nonisolated func performDijkstraInMemory(db: Database, from fromId: String, to toId: String) throws -> [(node: Node, distance: Double)]? {
        // Fetch all active nodes
        let nodes = try Node.filter(Node.Columns.deletedAt == nil).fetchAll(db)
        guard !nodes.isEmpty else { return nil }

        // Build node lookup
        var nodeById: [String: Node] = [:]
        for node in nodes {
            nodeById[node.id] = node
        }

        guard nodeById[fromId] != nil, nodeById[toId] != nil else { return nil }

        // Fetch all edges
        let edges = try Edge.fetchAll(db)

        // Build adjacency list with weights
        var adjacency: [String: [(targetId: String, weight: Double)]] = [:]
        for node in nodes {
            adjacency[node.id] = []
        }

        for edge in edges {
            // Outbound from source
            adjacency[edge.sourceId]?.append((targetId: edge.targetId, weight: edge.weight))
            // If undirected, also add reverse
            if !edge.directed {
                adjacency[edge.targetId]?.append((targetId: edge.sourceId, weight: edge.weight))
            }
        }

        // Dijkstra's algorithm
        var distances: [String: Double] = [:]
        var previous: [String: String] = [:]
        var visited: Set<String> = []

        // Initialize
        for node in nodes {
            distances[node.id] = node.id == fromId ? 0 : .infinity
        }

        while visited.count < nodes.count {
            // Find unvisited node with minimum distance
            var minDist = Double.infinity
            var current: String?

            for (nodeId, dist) in distances where !visited.contains(nodeId) {
                if dist < minDist {
                    minDist = dist
                    current = nodeId
                }
            }

            guard let currentId = current, minDist != .infinity else { break }

            // Found target
            if currentId == toId {
                break
            }

            visited.insert(currentId)

            // Update neighbors
            for (neighborId, weight) in adjacency[currentId] ?? [] {
                guard !visited.contains(neighborId) else { continue }

                let newDist = distances[currentId]! + weight
                if newDist < (distances[neighborId] ?? .infinity) {
                    distances[neighborId] = newDist
                    previous[neighborId] = currentId
                }
            }
        }

        // Reconstruct path
        guard distances[toId] != .infinity else { return nil }

        var path: [(node: Node, distance: Double)] = []
        var currentId: String? = toId

        while let id = currentId, let node = nodeById[id] {
            path.insert((node: node, distance: distances[id] ?? 0), at: 0)
            currentId = previous[id]
        }

        return path
    }

    /// Finds shortest paths from a source to all reachable nodes
    /// - Parameter fromId: Source node ID
    /// - Returns: Dictionary mapping node IDs to (node, distance) tuples
    public func dijkstraAll(from fromId: String) async throws -> [String: (node: Node, distance: Double)] {
        try await dbPool.read { db in
            // Fetch all active nodes
            let nodes = try Node.filter(Node.Columns.deletedAt == nil).fetchAll(db)
            guard !nodes.isEmpty else { return [:] }

            var nodeById: [String: Node] = [:]
            for node in nodes {
                nodeById[node.id] = node
            }

            guard nodeById[fromId] != nil else { return [:] }

            // Fetch all edges and build adjacency
            let edges = try Edge.fetchAll(db)
            var adjacency: [String: [(targetId: String, weight: Double)]] = [:]
            for node in nodes {
                adjacency[node.id] = []
            }

            for edge in edges {
                adjacency[edge.sourceId]?.append((targetId: edge.targetId, weight: edge.weight))
                if !edge.directed {
                    adjacency[edge.targetId]?.append((targetId: edge.sourceId, weight: edge.weight))
                }
            }

            // Dijkstra
            var distances: [String: Double] = [:]
            var visited: Set<String> = []

            for node in nodes {
                distances[node.id] = node.id == fromId ? 0 : .infinity
            }

            while visited.count < nodes.count {
                var minDist = Double.infinity
                var current: String?

                for (nodeId, dist) in distances where !visited.contains(nodeId) {
                    if dist < minDist {
                        minDist = dist
                        current = nodeId
                    }
                }

                guard let currentId = current, minDist != .infinity else { break }

                visited.insert(currentId)

                for (neighborId, weight) in adjacency[currentId] ?? [] {
                    guard !visited.contains(neighborId) else { continue }

                    let newDist = distances[currentId]! + weight
                    if newDist < (distances[neighborId] ?? .infinity) {
                        distances[neighborId] = newDist
                    }
                }
            }

            // Build result
            var results: [String: (node: Node, distance: Double)] = [:]
            for (nodeId, distance) in distances where distance != .infinity {
                if let node = nodeById[nodeId] {
                    results[nodeId] = (node: node, distance: distance)
                }
            }

            return results
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
    public func transaction<T>(_ block: @escaping @Sendable (Database) throws -> T) async throws -> T {
        try await dbPool.write { db in
            try block(db)
        }
    }

    // MARK: - Sync-Safe Transactions

    /// Result of a sync transaction that can be rolled back
    public struct SyncTransactionResult<T> {
        public let value: T
        public let affectedNodeIds: [String]
        public let previousVersions: [String: Int]
    }

    /// Executes a sync operation within a transaction with rollback support
    /// If the CloudKit operation fails, changes can be rolled back
    ///
    /// - Parameters:
    ///   - nodeIds: The IDs of nodes being synced
    ///   - operation: The sync operation to perform
    /// - Returns: The result of the operation with rollback metadata
    public func syncTransaction<T>(
        nodeIds: [String],
        operation: @escaping @Sendable (Database) throws -> T
    ) async throws -> SyncTransactionResult<T> {
        try await dbPool.write { db in
            // Capture previous sync versions for rollback
            var previousVersions: [String: Int] = [:]
            for nodeId in nodeIds {
                if let node = try Node.fetchOne(db, key: nodeId) {
                    previousVersions[nodeId] = node.syncVersion
                }
            }

            // Execute the operation
            let result = try operation(db)

            return SyncTransactionResult(
                value: result,
                affectedNodeIds: nodeIds,
                previousVersions: previousVersions
            )
        }
    }

    /// Rolls back sync versions for nodes after a CloudKit error
    ///
    /// - Parameter result: The sync transaction result containing rollback metadata
    public func rollbackSyncVersions(_ result: SyncTransactionResult<some Any>) async throws {
        try await dbPool.write { db in
            for (nodeId, previousVersion) in result.previousVersions {
                try db.execute(
                    sql: """
                        UPDATE nodes
                        SET sync_version = ?
                        WHERE id = ?
                        """,
                    arguments: [previousVersion, nodeId]
                )
            }
        }
    }

    /// Batch updates nodes in a single transaction (efficient for sync operations)
    ///
    /// - Parameter nodes: The nodes to update
    /// - Returns: The number of nodes successfully updated
    @discardableResult
    public func batchUpdateNodes(_ nodes: [Node]) async throws -> Int {
        try await dbPool.write { db in
            var updateCount = 0
            for node in nodes {
                var updatedNode = node
                updatedNode.modifiedAt = Date()
                try updatedNode.update(db)
                updateCount += 1
            }
            return updateCount
        }
    }

    /// Batch creates nodes in a single transaction (efficient for initial sync)
    ///
    /// - Parameter nodes: The nodes to create
    /// - Returns: The number of nodes successfully created
    @discardableResult
    public func batchCreateNodes(_ nodes: [Node]) async throws -> Int {
        try await dbPool.write { db in
            var createCount = 0
            for node in nodes {
                try node.insert(db)
                createCount += 1
            }
            return createCount
        }
    }

    /// Updates sync state and nodes in a single atomic transaction
    ///
    /// - Parameters:
    ///   - nodes: Nodes to update
    ///   - syncState: New sync state
    public func atomicSyncUpdate(nodes: [Node], syncState: SyncState) async throws {
        try await dbPool.write { db in
            // Update all nodes
            for node in nodes {
                var updatedNode = node
                updatedNode.lastSyncedAt = Date()
                try updatedNode.update(db)
            }

            // Update sync state
            try syncState.save(db)
        }
    }

    /// Marks nodes as synced after successful CloudKit push
    ///
    /// - Parameter nodeIds: IDs of successfully synced nodes
    public func markNodesSynced(_ nodeIds: [String]) async throws {
        try await dbPool.write { db in
            let now = Date()
            for nodeId in nodeIds {
                try db.execute(
                    sql: """
                        UPDATE nodes
                        SET last_synced_at = ?
                        WHERE id = ?
                        """,
                    arguments: [now, nodeId]
                )
            }
        }
    }

    /// Increments pending changes count in sync state
    public func incrementPendingChanges(by count: Int = 1) async throws {
        try await dbPool.write { db in
            try db.execute(
                sql: """
                    UPDATE sync_state
                    SET pending_changes = pending_changes + ?
                    WHERE id = 'default'
                    """,
                arguments: [count]
            )
        }
    }

    /// Decrements pending changes count in sync state
    public func decrementPendingChanges(by count: Int = 1) async throws {
        try await dbPool.write { db in
            try db.execute(
                sql: """
                    UPDATE sync_state
                    SET pending_changes = MAX(0, pending_changes - ?)
                    WHERE id = 'default'
                    """,
                arguments: [count]
            )
        }
    }
}
