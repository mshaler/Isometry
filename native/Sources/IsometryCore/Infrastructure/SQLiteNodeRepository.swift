import Foundation
import GRDB

/// SQLite implementation of NodeRepository
/// Wraps the existing IsometryDatabase with the NodeRepository protocol
public actor SQLiteNodeRepository: NodeRepository {
    private let database: DatabaseQueue

    /// Initialize with a GRDB DatabaseQueue
    /// - Parameter database: The GRDB database queue
    public init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - Basic CRUD Operations

    public func create(_ node: Node) async throws {
        try await database.write { db in
            try node.insert(db)
        }
    }

    public func createBatch(_ nodes: [Node]) async throws {
        try await database.write { db in
            for node in nodes {
                try node.insert(db)
            }
        }
    }

    public func get(id: String) async throws -> Node? {
        try await database.read { db in
            try Node.fetchOne(db, sql: """
                SELECT * FROM nodes WHERE id = ?
            """, arguments: [id])
        }
    }

    public func update(_ node: Node) async throws {
        try await database.write { db in
            try node.update(db)
        }
    }

    public func delete(id: String) async throws {
        try await database.write { db in
            // Soft delete - set deleted_at timestamp
            try db.execute(sql: """
                UPDATE nodes
                SET deleted_at = ?, modified_at = ?
                WHERE id = ?
            """, arguments: [Date(), Date(), id])
        }
    }

    public func hardDelete(id: String) async throws {
        try await database.write { db in
            try db.execute(sql: """
                DELETE FROM nodes WHERE id = ?
            """, arguments: [id])
        }
    }

    // MARK: - Query Operations

    public func getAll(limit: Int?, offset: Int?, includeDeleted: Bool) async throws -> [Node] {
        try await database.read { db in
            var sql = "SELECT * FROM nodes"
            var arguments: StatementArguments = []

            if !includeDeleted {
                sql += " WHERE deleted_at IS NULL"
            }

            sql += " ORDER BY modified_at DESC"

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func count(includeDeleted: Bool) async throws -> Int {
        try await database.read { db in
            if includeDeleted {
                return try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM nodes") ?? 0
            } else {
                return try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM nodes WHERE deleted_at IS NULL") ?? 0
            }
        }
    }

    public func search(query: String, limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            var sql = """
                SELECT n.* FROM nodes n
                JOIN nodes_fts fts ON n.id = fts.rowid
                WHERE nodes_fts MATCH ? AND n.deleted_at IS NULL
                ORDER BY bm25(nodes_fts)
            """
            var arguments: StatementArguments = [query]

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getByType(_ nodeType: String, limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            var sql = """
                SELECT * FROM nodes
                WHERE node_type = ? AND deleted_at IS NULL
                ORDER BY modified_at DESC
            """
            var arguments: StatementArguments = [nodeType]

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getByFolder(_ folder: String, limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            var sql = """
                SELECT * FROM nodes
                WHERE folder = ? AND deleted_at IS NULL
                ORDER BY modified_at DESC
            """
            var arguments: StatementArguments = [folder]

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getByTags(_ tags: [String], limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            // Create a JSON query to find nodes with any of the specified tags
            let placeholders = tags.map { _ in "?" }.joined(separator: ", ")
            var sql = """
                SELECT * FROM nodes
                WHERE deleted_at IS NULL
            """

            // Add tag matching conditions
            let tagConditions = tags.map { _ in
                "json_extract(tags, '$[*]') LIKE '%' || ? || '%'"
            }.joined(separator: " OR ")

            if !tagConditions.isEmpty {
                sql += " AND (\(tagConditions))"
            }

            sql += " ORDER BY modified_at DESC"

            var arguments = StatementArguments(tags)

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getByDateRange(startDate: Date, endDate: Date, limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            var sql = """
                SELECT * FROM nodes
                WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL
                ORDER BY created_at DESC
            """
            var arguments: StatementArguments = [startDate, endDate]

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    public func getPendingSync() async throws -> [Node] {
        try await database.read { db in
            try Node.fetchAll(db, sql: """
                SELECT * FROM nodes
                WHERE (last_synced_at IS NULL OR sync_version > 0) AND deleted_at IS NULL
                ORDER BY modified_at ASC
            """)
        }
    }

    public func getWithLocation(limit: Int?, offset: Int?) async throws -> [Node] {
        try await database.read { db in
            var sql = """
                SELECT * FROM nodes
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND deleted_at IS NULL
                ORDER BY modified_at DESC
            """
            var arguments: StatementArguments = []

            if let limit = limit {
                sql += " LIMIT ?"
                arguments.append(limit)

                if let offset = offset {
                    sql += " OFFSET ?"
                    arguments.append(offset)
                }
            }

            return try Node.fetchAll(db, sql: sql, arguments: arguments)
        }
    }

    // MARK: - Raw SQL Support

    public func executeSQL(_ sql: String, arguments: [Any]) async throws -> [Node] {
        try await database.read { db in
            let statementArguments = StatementArguments(arguments)
            return try Node.fetchAll(db, sql: sql, arguments: statementArguments)
        }
    }
}

// MARK: - GRDB Integration

extension Node: FetchableRecord, PersistableRecord {
    /// Database table name
    public static let databaseTableName = "nodes"

    /// Initialize from database row
    public init(row: Row) throws {
        id = row["id"]
        nodeType = row["node_type"]
        name = row["name"]
        content = row["content"]
        summary = row["summary"]
        latitude = row["latitude"]
        longitude = row["longitude"]
        locationName = row["location_name"]
        locationAddress = row["location_address"]
        createdAt = row["created_at"]
        modifiedAt = row["modified_at"]
        dueAt = row["due_at"]
        completedAt = row["completed_at"]
        eventStart = row["event_start"]
        eventEnd = row["event_end"]
        folder = row["folder"]

        // Parse tags from JSON array
        if let tagsJSON: String = row["tags"], !tagsJSON.isEmpty {
            tags = (try? JSONDecoder().decode([String].self, from: tagsJSON.data(using: .utf8) ?? Data())) ?? []
        } else {
            tags = []
        }

        status = row["status"]
        priority = row["priority"]
        importance = row["importance"]
        sortOrder = row["sort_order"]
        source = row["source"]
        sourceId = row["source_id"]
        sourceUrl = row["source_url"]
        deletedAt = row["deleted_at"]
        version = row["version"]
        syncVersion = row["sync_version"]
        lastSyncedAt = row["last_synced_at"]
        conflictResolvedAt = row["conflict_resolved_at"]
    }

    /// Encode to database row
    public func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["node_type"] = nodeType
        container["name"] = name
        container["content"] = content
        container["summary"] = summary
        container["latitude"] = latitude
        container["longitude"] = longitude
        container["location_name"] = locationName
        container["location_address"] = locationAddress
        container["created_at"] = createdAt
        container["modified_at"] = modifiedAt
        container["due_at"] = dueAt
        container["completed_at"] = completedAt
        container["event_start"] = eventStart
        container["event_end"] = eventEnd
        container["folder"] = folder

        // Encode tags as JSON array
        if !tags.isEmpty {
            let tagsData = try JSONEncoder().encode(tags)
            container["tags"] = String(data: tagsData, encoding: .utf8)
        } else {
            container["tags"] = nil
        }

        container["status"] = status
        container["priority"] = priority
        container["importance"] = importance
        container["sort_order"] = sortOrder
        container["source"] = source
        container["source_id"] = sourceId
        container["source_url"] = sourceUrl
        container["deleted_at"] = deletedAt
        container["version"] = version
        container["sync_version"] = syncVersion
        container["last_synced_at"] = lastSyncedAt
        container["conflict_resolved_at"] = conflictResolvedAt
    }

    /// Primary key column
    public static let databaseSelection: [any SQLSelectable] = [AllColumns()]
}