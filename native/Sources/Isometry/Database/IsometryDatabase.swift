import Foundation
import GRDB

// MARK: - Storage Related Types (TODO: Move to appropriate files)

public struct DatabaseStoredContent {
    public let id: String
    public let content: Data
    public let contentType: String
    public let size: Int64
    public let createdAt: Date
    public let lastAccessedAt: Date
}

public struct DatabaseStorageStats {
    public let totalSize: Int64
    public let itemCount: Int
    public let lastCleanup: Date
}

public struct DatabaseSurface {
    public let id: String
    public let name: String
    public let description: String
}


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
            self.dbPool = try DatabasePool(path: tempPath, configuration: config)
        } else {
            self.dbPool = try DatabasePool(path: path, configuration: config)
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

    // MARK: - Database Access

    /// Perform a read-only database operation
    public func read<T>(_ block: (Database) throws -> T) async throws -> T {
        return try await dbPool.read(block)
    }

    public func write<T>(_ block: (Database) throws -> T) async throws -> T {
        return try await dbPool.write(block)
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

    // MARK: - NotebookCard CRUD

    /// Creates a new notebook card
    public func createNotebookCard(_ card: NotebookCard) async throws {
        try await dbPool.write { db in
            try card.insert(db)
        }
    }

    /// Updates an existing notebook card
    public func updateNotebookCard(_ card: NotebookCard) async throws {
        let updatedCard = card.updated() // Increment version and set modified date

        try await dbPool.write { db in
            try updatedCard.update(db)
        }
    }

    /// Soft-deletes a notebook card by setting deleted_at
    public func deleteNotebookCard(id: String) async throws {
        try await dbPool.write { db in
            try db.execute(
                sql: """
                    UPDATE notebook_cards
                    SET deleted_at = datetime('now'),
                        modified_at = datetime('now'),
                        sync_version = sync_version + 1
                    WHERE id = ?
                    """,
                arguments: [id]
            )
        }
    }

    /// Permanently removes a notebook card from the database
    public func purgeNotebookCard(id: String) async throws {
        try await dbPool.write { db in
            try db.execute(sql: "DELETE FROM notebook_cards WHERE id = ?", arguments: [id])
        }
    }

    /// Fetches a notebook card by ID
    public func getNotebookCard(id: String) async throws -> NotebookCard? {
        try await dbPool.read { db in
            try NotebookCard.fetchOne(db, key: id)
        }
    }

    /// Fetches all active notebook cards
    public func getAllNotebookCards() async throws -> [NotebookCard] {
        try await dbPool.read { db in
            try NotebookCard.active
                .order(NotebookCard.Columns.modifiedAt.desc)
                .fetchAll(db)
        }
    }

    /// Fetches notebook cards in a specific folder
    public func getNotebookCards(inFolder folder: String?) async throws -> [NotebookCard] {
        try await dbPool.read { db in
            let baseQuery = NotebookCard.active
            let filteredQuery: QueryInterfaceRequest<NotebookCard>

            if let folder = folder {
                filteredQuery = baseQuery.filter(NotebookCard.Columns.folder == folder)
            } else {
                filteredQuery = baseQuery.filter(NotebookCard.Columns.folder == nil)
            }

            return try filteredQuery
                .order(NotebookCard.Columns.modifiedAt.desc)
                .fetchAll(db)
        }
    }

    /// Searches notebook cards using FTS5 full-text search
    public func searchNotebookCards(_ query: String) async throws -> [NotebookCard] {
        try await dbPool.read { db in
            let sql = """
                SELECT notebook_cards.*
                FROM notebook_cards
                JOIN notebook_cards_fts ON notebook_cards.rowid = notebook_cards_fts.rowid
                WHERE notebook_cards_fts MATCH ?
                  AND notebook_cards.deleted_at IS NULL
                ORDER BY rank
                """
            return try NotebookCard.fetchAll(db, sql: sql, arguments: [query])
        }
    }

    /// Counts active notebook cards
    public func countNotebookCards() async throws -> Int {
        try await dbPool.read { db in
            try NotebookCard.active
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

    // MARK: - Command History Operations

    /// Save command history entry to database
    public func saveCommandHistory(_ entry: HistoryEntry) async throws {
        try await dbPool.write { db in
            let outputPreview = entry.response?.output.prefix(500).description
            let iso8601Formatter = ISO8601DateFormatter()
            let timestamp = iso8601Formatter.string(from: entry.timestamp)

            try db.execute(
                sql: """
                    INSERT INTO command_history (
                        id, command_text, command_type, timestamp, duration, success,
                        output_preview, error_message, working_directory, session_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    entry.id.uuidString,
                    entry.command,
                    entry.type.rawValue,
                    timestamp,
                    entry.duration,
                    entry.success ? 1 : 0,
                    outputPreview,
                    entry.response?.error,
                    entry.cwd,
                    entry.sessionId
                ]
            )

            // Save notebook context if available
            if let context = entry.context {
                try db.execute(
                    sql: """
                        INSERT INTO notebook_context (
                            id, command_id, card_id, card_title
                        ) VALUES (?, ?, ?, ?)
                        """,
                    arguments: [
                        UUID().uuidString,
                        entry.id.uuidString,
                        context.cardId?.uuidString,
                        context.cardTitle
                    ]
                )
            }
        }
    }

    /// Search command history using FTS5
    public func searchCommandHistory(query: String) async throws -> [HistoryEntry] {
        return try await dbPool.read { db in
            let sql = """
                SELECT h.*, nc.card_id, nc.card_title
                FROM command_history h
                LEFT JOIN notebook_context nc ON h.id = nc.command_id
                JOIN command_history_fts fts ON h.rowid = fts.rowid
                WHERE command_history_fts MATCH ?
                AND h.deleted_at IS NULL
                ORDER BY h.timestamp DESC
                LIMIT 100
                """

            return try HistoryEntry.fetchAll(db, sql: sql, arguments: [query])
        }
    }

    /// Get recent commands with optional type filtering
    public func getRecentCommands(limit: Int, type: CommandType?) async throws -> [HistoryEntry] {
        return try await dbPool.read { db in
            var sql = """
                SELECT h.*, nc.card_id, nc.card_title
                FROM command_history h
                LEFT JOIN notebook_context nc ON h.id = nc.command_id
                WHERE h.deleted_at IS NULL
                """
            var arguments: [DatabaseValueConvertible] = []

            if let type = type {
                sql += " AND h.command_type = ?"
                arguments.append(type.rawValue)
            }

            sql += " ORDER BY h.timestamp DESC LIMIT ?"
            arguments.append(limit)

            return try HistoryEntry.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    /// Get commands by session ID
    public func getCommandsBySession(sessionId: String) async throws -> [HistoryEntry] {
        return try await dbPool.read { db in
            let sql = """
                SELECT h.*, nc.card_id, nc.card_title
                FROM command_history h
                LEFT JOIN notebook_context nc ON h.id = nc.command_id
                WHERE h.session_id = ?
                AND h.deleted_at IS NULL
                ORDER BY h.timestamp ASC
                """

            return try HistoryEntry.fetchAll(db, sql: sql, arguments: [sessionId])
        }
    }

    /// Get commands for a specific notebook card
    public func getCommandsForCard(cardId: String) async throws -> [HistoryEntry] {
        return try await dbPool.read { db in
            let sql = """
                SELECT h.*, nc.card_id, nc.card_title
                FROM command_history h
                JOIN notebook_context nc ON h.id = nc.command_id
                WHERE nc.card_id = ?
                AND h.deleted_at IS NULL
                ORDER BY h.timestamp DESC
                """

            return try HistoryEntry.fetchAll(db, sql: sql, arguments: [cardId])
        }
    }

    /// Clean up old command history entries
    public func cleanupOldHistory(olderThan: Date) async throws {
        try await dbPool.write { db in
            let iso8601Formatter = ISO8601DateFormatter()
            let cutoffDate = iso8601Formatter.string(from: olderThan)

            try db.execute(
                sql: """
                    UPDATE command_history
                    SET deleted_at = datetime('now')
                    WHERE timestamp < ?
                    AND deleted_at IS NULL
                    """,
                arguments: [cutoffDate]
            )
        }
    }

    /// Get command history statistics for a session
    public func getSessionStatistics(sessionId: String) async throws -> SessionStatistics {
        return try await dbPool.read { db in
            let row = try Row.fetchOne(db,
                sql: """
                    SELECT
                        COUNT(*) as total_commands,
                        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_commands,
                        COUNT(CASE WHEN command_type = 'system' THEN 1 END) as system_commands,
                        COUNT(CASE WHEN command_type = 'claude' THEN 1 END) as claude_commands,
                        AVG(duration) as average_duration,
                        SUM(duration) as total_duration
                    FROM command_history
                    WHERE session_id = ?
                    AND deleted_at IS NULL
                    """,
                arguments: [sessionId]
            )

            let totalCommands = row?["total_commands"] as? Int ?? 0
            let successfulCommands = row?["successful_commands"] as? Int ?? 0
            let systemCommands = row?["system_commands"] as? Int ?? 0
            let claudeCommands = row?["claude_commands"] as? Int ?? 0
            let averageDuration = row?["average_duration"] as? Double ?? 0
            let totalDuration = row?["total_duration"] as? Double ?? 0

            return SessionStatistics(
                sessionId: sessionId,
                totalCommands: totalCommands,
                successfulCommands: successfulCommands,
                systemCommands: systemCommands,
                claudeCommands: claudeCommands,
                successRate: totalCommands > 0 ? Double(successfulCommands) / Double(totalCommands) : 0,
                averageDuration: averageDuration,
                totalDuration: totalDuration
            )
        }
    }

    // MARK: - Notebook Cards


    /// Insert a new notebook card
    public func insertCard(_ card: NotebookCard) async throws {
        try await dbPool.write { db in
            try card.insert(db)
        }
    }

    /// Update an existing notebook card
    public func updateCard(_ card: NotebookCard) async throws {
        try await dbPool.write { db in
            try card.update(db)
        }
    }

    /// Delete a notebook card (soft delete)
    public func deleteCard(id: String) async throws {
        try await dbPool.write { db in
            try NotebookCard
                .filter(NotebookCard.Columns.id == id)
                .updateAll(db, NotebookCard.Columns.deletedAt.set(to: Date()))
        }
    }

    // MARK: - Database Pool Access

    /// Provides access to the database pool for observation and advanced operations
    /// This is needed for DatabaseRegionObservation and similar GRDB features
    public func getDatabasePool() -> DatabasePool {
        return dbPool
    }
}

// MARK: - Preview Support

extension IsometryDatabase {
    /// Create a preview database with sample data for SwiftUI previews
    public static let preview: IsometryDatabase = {
        do {
            let database = try IsometryDatabase(path: ":memory:")

            // Initialize with sample data in a Task for async context
            Task {
                try await database.initialize()

                // Add some sample notebook cards for previewing
                let sampleCards = [
                    Node(
                        id: UUID().uuidString,
                        nodeType: "notebook_card",
                        name: "Sample Note",
                        content: "This is a sample notebook card for preview purposes",
                        tags: ["preview", "sample"],
                        priority: 1
                    ),
                    Node(
                        id: UUID().uuidString,
                        nodeType: "notebook_card",
                        name: "Another Card",
                        content: "Another sample card with different tags",
                        tags: ["test", "demo"],
                        priority: 2
                    ),
                    Node(
                        id: UUID().uuidString,
                        nodeType: "notebook_card",
                        name: "High Priority Task",
                        content: "An important task that needs attention",
                        tags: ["urgent", "work"],
                        priority: 3
                    )
                ]

                // Convert nodes to notebook cards and insert them
                for node in sampleCards {
                    let notebookCard = NotebookCard(
                        title: node.name,
                        markdownContent: node.content,
                        properties: ["type": "note", "priority": String(node.priority)],
                        folder: node.folder,
                        tags: node.tags
                    )
                    try await database.insertCard(notebookCard)
                }
            }

            return database
        } catch {
            fatalError("Failed to create preview database: \(error)")
        }
    }()

    // MARK: - Missing Method Stubs (TODO: Implement)

    public func getStoredContent(by id: String) async throws -> DatabaseStoredContent? {
        // TODO: Implement stored content retrieval
        return nil
    }

    public func updateContentAccess(contentId: String, accessTime: Date) async throws {
        // TODO: Implement content access tracking
    }

    public func listStoredContent() async throws -> [DatabaseStoredContent] {
        // TODO: Implement stored content listing
        return []
    }

    public func getStorageStats() async throws -> DatabaseStorageStats {
        // TODO: Implement storage statistics
        return DatabaseStorageStats(totalSize: 0, itemCount: 0, lastCleanup: Date())
    }

    public func getCleanupCandidates(olderThan: Date) async throws -> [String] {
        // TODO: Implement cleanup candidate identification
        return []
    }

    public func deleteStoredContent(id: String) async throws {
        // TODO: Implement content deletion
    }

    public func getSurfaces() async throws -> [DatabaseSurface] {
        // TODO: Implement surface retrieval
        return []
    }

    public func getSurfaces(for application: String) async throws -> [DatabaseSurface] {
        // TODO: Implement surface retrieval by application
        return []
    }

    public func getSurfaces(using streamId: String) async throws -> [DatabaseSurface] {
        // TODO: Implement surface retrieval by stream ID
        return []
    }
}
