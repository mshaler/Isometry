import Foundation
import GRDB
import Isometry

/// SQL execution engine that provides safe raw SQL execution with parameter binding
///
/// Handles validation, parameter binding, and result formatting to match sql.js output format exactly.
public actor SQLExecutor {
    // MARK: - Properties

    private let database: IsometryDatabase

    // Allowed SQL operations for safety
    private let allowedOperations: Set<String> = [
        "select", "insert", "update", "delete", "with"
    ]

    // Cache for prepared statements (performance optimization)
    private var preparedStatements: [String: String] = [:]

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - SQL Execution

    /// Executes raw SQL with parameter binding and returns results in sql.js format
    /// - Parameters:
    ///   - sql: The SQL statement to execute
    ///   - params: Parameters to bind to the SQL statement
    /// - Returns: Array of dictionaries matching sql.js output format
    /// - Throws: SQLExecutorError for validation or execution failures
    public func execute(sql: String, params: [SQLParameter]) async throws -> [[String: Any]] {
        // Validate SQL statement
        try validateSQL(sql)

        // Clean and normalize SQL
        let normalizedSQL = normalizeSQL(sql)

        // Check if this is a common pattern we can optimize
        if let optimizedResult = try await executeOptimizedQuery(normalizedSQL, params: params) {
            return optimizedResult
        }

        // Execute raw SQL
        return try await executeRawSQL(normalizedSQL, params: params)
    }

    // MARK: - SQL Validation

    private func validateSQL(_ sql: String) throws {
        let trimmed = sql.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw SQLExecutorError.emptySQL
        }

        // Extract first word (operation)
        let firstWord = trimmed.lowercased().split(separator: " ").first?.description ?? ""

        guard allowedOperations.contains(firstWord) else {
            throw SQLExecutorError.unauthorizedOperation(firstWord)
        }

        // Basic SQL injection prevention
        try validateForInjection(sql)
    }

    private func validateForInjection(_ sql: String) throws {
        let dangerous = ["--", "/*", "*/", ";", "xp_", "sp_"]
        let lowercased = sql.lowercased()

        for pattern in dangerous {
            if lowercased.contains(pattern) {
                throw SQLExecutorError.potentialInjection(pattern)
            }
        }
    }

    private func normalizeSQL(_ sql: String) -> String {
        return sql.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    // MARK: - Optimized Query Execution

    /// Check for common query patterns and execute them through optimized database methods
    private func executeOptimizedQuery(_ sql: String, params: [SQLParameter]) async throws -> [[String: Any]]? {
        let lowercased = sql.lowercased()

        // Get all nodes
        if lowercased.contains("select") && lowercased.contains("from nodes") &&
           !lowercased.contains("where") {
            return try await getAllNodesOptimized()
        }

        // Get all notebook cards
        if lowercased.contains("select") && lowercased.contains("from notebook_cards") &&
           !lowercased.contains("where") {
            return try await getAllNotebookCardsOptimized()
        }

        // Node by ID
        if lowercased.contains("select") && lowercased.contains("from nodes") &&
           lowercased.contains("where") && lowercased.contains("id = ?") {
            if let idParam = params.first {
                return try await getNodeByIdOptimized(id: idParam)
            }
        }

        // Search queries
        if lowercased.contains("fts") || lowercased.contains("match") {
            return try await executeSearchQuery(sql, params: params)
        }

        return nil // No optimization available
    }

    private func getAllNodesOptimized() async throws -> [[String: Any]] {
        let nodes = try await database.getAllNodes()
        return nodes.map(nodeToSQLJSFormat)
    }

    private func getAllNotebookCardsOptimized() async throws -> [[String: Any]] {
        let cards = try await database.getAllNotebookCards()
        return cards.map(cardToSQLJSFormat)
    }

    private func getNodeByIdOptimized(id: SQLParameter) async throws -> [[String: Any]] {
        guard let idValue = id.stringValue else {
            throw SQLExecutorError.invalidParameter("id", id)
        }

        guard let node = try await database.getNode(id: idValue) else {
            return []
        }

        return [nodeToSQLJSFormat(node)]
    }

    private func executeSearchQuery(_ sql: String, params: [SQLParameter]) async throws -> [[String: Any]] {
        // Extract search term from parameters
        guard let searchTerm = params.first?.stringValue else {
            throw SQLExecutorError.invalidParameter("search term", params.first ?? .null)
        }

        let nodes = try await database.searchNodes(query: searchTerm)
        return nodes.map(nodeToSQLJSFormat)
    }

    // MARK: - Raw SQL Execution

    /// Execute raw SQL through GRDB with proper parameter binding
    private func executeRawSQL(_ sql: String, params: [SQLParameter]) async throws -> [[String: Any]] {
        let arguments = StatementArguments(params.map(\.databaseValue))

        // Handle different SQL types
        let lowercased = sql.lowercased()

        if lowercased.hasPrefix("select") || lowercased.hasPrefix("with") {
            // SELECT queries - return data
            return try await database.transaction { db in
                let rows = try Row.fetchAll(db, sql: sql, arguments: arguments)
                return rows.map { row in
                    var result: [String: Any] = [:]
                    for column in row.columnNames {
                        let value = row[column]
                        result[column] = value
                    }
                    return result
                }
            }
        } else {
            // INSERT/UPDATE/DELETE queries - return affected rows count
            let affectedRows = try await database.transaction { db in
                try db.execute(sql: sql, arguments: arguments)
                return 1 // Return 1 for now, GRDB doesn't expose changes directly in this context
            }

            return [["affected_rows": affectedRows]]
        }
    }

    // MARK: - Format Conversion

    /// Convert Node to sql.js format
    private func nodeToSQLJSFormat(_ node: Node) -> [String: Any] {
        return [
            "id": node.id,
            "node_type": node.nodeType,
            "name": node.name,
            "content": node.content ?? "",
            "summary": node.summary ?? "",
            "folder": node.folder ?? "",
            "tags": node.tags.joined(separator: ","),
            "status": node.status ?? "",
            "priority": node.priority,
            "importance": node.importance,
            "sort_order": node.sortOrder,
            "source": node.source ?? "",
            "source_id": node.sourceId ?? "",
            "created_at": formatDate(node.createdAt),
            "modified_at": formatDate(node.modifiedAt),
            "deleted_at": node.deletedAt.map(formatDate) ?? NSNull(),
            "version": node.version,
            "sync_version": node.syncVersion,
            "last_synced_at": node.lastSyncedAt.map(formatDate) ?? NSNull()
        ]
    }

    /// Convert NotebookCard to sql.js format
    private func cardToSQLJSFormat(_ card: NotebookCard) -> [String: Any] {
        return [
            "id": card.id,
            "title": card.title,
            "markdown_content": card.markdownContent ?? "",
            "properties": formatProperties(card.properties),
            "template_id": card.templateId ?? "",
            "folder": card.folder ?? "",
            "tags": card.tags.joined(separator: ","),
            "linked_node_id": card.linkedNodeId ?? "",
            "created_at": formatDate(card.createdAt),
            "modified_at": formatDate(card.modifiedAt),
            "deleted_at": card.deletedAt.map(formatDate) ?? NSNull(),
            "sync_version": card.syncVersion,
            "last_synced_at": card.lastSyncedAt.map(formatDate) ?? NSNull()
        ]
    }

    /// Convert GRDB Row to sql.js format
    private func rowToSQLJSFormat(_ row: Row) -> [String: Any] {
        var result: [String: Any] = [:]

        for column in row.columnNames {
            let value = row[column]
            result[column] = value
        }

        return result
    }

    /// Format Date for sql.js compatibility
    private func formatDate(_ date: Date) -> String {
        return ISO8601DateFormatter().string(from: date)
    }

    /// Format properties dictionary for sql.js
    private func formatProperties(_ properties: [String: String]) -> String {
        guard !properties.isEmpty else { return "{}" }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: properties)
            return String(data: jsonData, encoding: .utf8) ?? "{}"
        } catch {
            return "{}"
        }
    }
}

// MARK: - SQLParameter Extensions

extension SQLParameter {
    /// Get string value if parameter is a string
    var stringValue: String? {
        switch self {
        case .string(let value):
            return value
        case .integer(let value):
            return String(value)
        case .double(let value):
            return String(value)
        case .bool(let value):
            return String(value)
        case .null:
            return nil
        }
    }

    /// Convert to GRDB DatabaseValue
    var databaseValue: DatabaseValueConvertible? {
        switch self {
        case .string(let value):
            return value
        case .integer(let value):
            return value
        case .double(let value):
            return value
        case .bool(let value):
            return value
        case .null:
            return nil
        }
    }
}

// MARK: - Error Types

public enum SQLExecutorError: LocalizedError {
    case emptySQL
    case unauthorizedOperation(String)
    case potentialInjection(String)
    case invalidParameter(String, SQLParameter)
    case executionFailed(String, Error)

    public var errorDescription: String? {
        switch self {
        case .emptySQL:
            return "SQL statement cannot be empty"
        case .unauthorizedOperation(let op):
            return "Operation '\(op)' is not allowed"
        case .potentialInjection(let pattern):
            return "Potential SQL injection detected: '\(pattern)'"
        case .invalidParameter(let name, let param):
            return "Invalid parameter '\(name)': \(param)"
        case .executionFailed(let sql, let error):
            return "SQL execution failed for '\(sql)': \(error.localizedDescription)"
        }
    }
}