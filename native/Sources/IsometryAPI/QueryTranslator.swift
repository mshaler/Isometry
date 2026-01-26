import Foundation
import GRDB
import Isometry

/// Query translation layer that maps common React sql.js patterns to optimized database operations
///
/// Provides performance improvements by recognizing frequent query patterns and routing them
/// to specialized database methods instead of raw SQL execution.
public struct QueryTranslator {
    // MARK: - Query Pattern Cache

    private static var patternCache: [String: QueryPattern] = [:]

    // MARK: - Query Pattern Recognition

    /// Analyzes SQL query and returns optimized execution strategy if available
    /// - Parameter sql: The SQL query to analyze
    /// - Returns: QueryPattern if optimization is available, nil otherwise
    public static func analyzeQuery(_ sql: String) -> QueryPattern? {
        let normalizedSQL = sql.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)

        // Check cache first
        if let cached = patternCache[normalizedSQL] {
            return cached
        }

        // Analyze and cache result
        let pattern = recognizePattern(normalizedSQL)
        patternCache[normalizedSQL] = pattern
        return pattern
    }

    private static func recognizePattern(_ sql: String) -> QueryPattern? {
        // Node queries
        if isGetAllNodes(sql) {
            return .getAllNodes
        }

        if isGetNodeById(sql) {
            return .getNodeById
        }

        if isGetNodesByFolder(sql) {
            return .getNodesByFolder
        }

        if isGetNodesByType(sql) {
            return .getNodesByType
        }

        // Notebook card queries
        if isGetAllNotebookCards(sql) {
            return .getAllNotebookCards
        }

        if isGetNotebookCardById(sql) {
            return .getNotebookCardById
        }

        if isGetNotebookCardsByFolder(sql) {
            return .getNotebookCardsByFolder
        }

        // Search queries
        if isSearchNodes(sql) {
            return .searchNodes
        }

        if isSearchNotebookCards(sql) {
            return .searchNotebookCards
        }

        // Create operations
        if isCreateNode(sql) {
            return .createNode
        }

        if isCreateNotebookCard(sql) {
            return .createNotebookCard
        }

        // Update operations
        if isUpdateNode(sql) {
            return .updateNode
        }

        if isUpdateNotebookCard(sql) {
            return .updateNotebookCard
        }

        // Delete operations
        if isDeleteNode(sql) {
            return .deleteNode
        }

        if isDeleteNotebookCard(sql) {
            return .deleteNotebookCard
        }

        return nil
    }

    // MARK: - Node Query Patterns

    private static func isGetAllNodes(_ sql: String) -> Bool {
        return sql.matches("^select .* from nodes($| where deleted_at is null| order by| limit)")
    }

    private static func isGetNodeById(_ sql: String) -> Bool {
        return sql.matches("^select .* from nodes where .*id = ?")
    }

    private static func isGetNodesByFolder(_ sql: String) -> Bool {
        return sql.matches("^select .* from nodes where .*folder = ?")
    }

    private static func isGetNodesByType(_ sql: String) -> Bool {
        return sql.matches("^select .* from nodes where .*node_type = ?")
    }

    private static func isCreateNode(_ sql: String) -> Bool {
        return sql.hasPrefix("insert into nodes")
    }

    private static func isUpdateNode(_ sql: String) -> Bool {
        return sql.matches("^update nodes set .* where .*id = ?")
    }

    private static func isDeleteNode(_ sql: String) -> Bool {
        return sql.matches("^(delete from nodes|update nodes set deleted_at) .* where .*id = ?")
    }

    // MARK: - Notebook Card Query Patterns

    private static func isGetAllNotebookCards(_ sql: String) -> Bool {
        return sql.matches("^select .* from notebook_cards($| where deleted_at is null| order by| limit)")
    }

    private static func isGetNotebookCardById(_ sql: String) -> Bool {
        return sql.matches("^select .* from notebook_cards where .*id = ?")
    }

    private static func isGetNotebookCardsByFolder(_ sql: String) -> Bool {
        return sql.matches("^select .* from notebook_cards where .*folder = ?")
    }

    private static func isCreateNotebookCard(_ sql: String) -> Bool {
        return sql.hasPrefix("insert into notebook_cards")
    }

    private static func isUpdateNotebookCard(_ sql: String) -> Bool {
        return sql.matches("^update notebook_cards set .* where .*id = ?")
    }

    private static func isDeleteNotebookCard(_ sql: String) -> Bool {
        return sql.matches("^(delete from notebook_cards|update notebook_cards set deleted_at) .* where .*id = ?")
    }

    // MARK: - Search Query Patterns

    private static func isSearchNodes(_ sql: String) -> Bool {
        return sql.contains("nodes_fts") && sql.contains("match")
    }

    private static func isSearchNotebookCards(_ sql: String) -> Bool {
        return sql.contains("notebook_cards_fts") && sql.contains("match")
    }

    // MARK: - SQL.js to GRDB Translation

    /// Translates sql.js specific syntax to GRDB-compatible SQL
    /// - Parameter sql: Original sql.js query
    /// - Returns: GRDB-compatible SQL
    public static func translateSQL(_ sql: String) -> String {
        var translated = sql

        // Handle datetime functions
        translated = translated.replacingOccurrences(
            of: "datetime('now')",
            with: "CURRENT_TIMESTAMP"
        )

        // Handle LIMIT without OFFSET (sql.js vs SQLite differences)
        translated = translateLimitClause(translated)

        // Handle boolean columns (sql.js uses 0/1, GRDB uses true/false)
        translated = translateBooleanColumns(translated)

        // Handle JSON operations if any
        translated = translateJSONOperations(translated)

        return translated
    }

    private static func translateLimitClause(_ sql: String) -> String {
        // Convert "LIMIT n" to "LIMIT n OFFSET 0" for consistency
        return sql.replacingOccurrences(
            of: #"LIMIT\s+(\d+)$"#,
            with: "LIMIT $1 OFFSET 0",
            options: .regularExpression
        )
    }

    private static func translateBooleanColumns(_ sql: String) -> String {
        // This would handle any boolean column translations needed
        // For now, return as-is since our schema uses consistent types
        return sql
    }

    private static func translateJSONOperations(_ sql: String) -> String {
        // Handle JSON operations if we have any JSON columns
        // For now, return as-is since we use simple string storage
        return sql
    }

    // MARK: - Parameter Extraction

    /// Extracts parameters from common query patterns for validation
    /// - Parameters:
    ///   - pattern: The recognized query pattern
    ///   - params: The parameters provided
    /// - Returns: Validated parameters or throws error
    public static func extractParameters(for pattern: QueryPattern, from params: [SQLParameter]) throws -> [String: Any] {
        switch pattern {
        case .getNodeById, .updateNode, .deleteNode, .getNotebookCardById, .updateNotebookCard, .deleteNotebookCard:
            guard params.count >= 1, let id = params[0].stringValue else {
                throw QueryTranslatorError.missingParameter("id")
            }
            return ["id": id]

        case .getNodesByFolder, .getNotebookCardsByFolder:
            guard params.count >= 1, let folder = params[0].stringValue else {
                throw QueryTranslatorError.missingParameter("folder")
            }
            return ["folder": folder]

        case .getNodesByType:
            guard params.count >= 1, let nodeType = params[0].stringValue else {
                throw QueryTranslatorError.missingParameter("node_type")
            }
            return ["node_type": nodeType]

        case .searchNodes, .searchNotebookCards:
            guard params.count >= 1, let query = params[0].stringValue else {
                throw QueryTranslatorError.missingParameter("search_query")
            }
            return ["query": query]

        case .getAllNodes, .getAllNotebookCards:
            return [:] // No parameters needed

        case .createNode, .createNotebookCard:
            // These would need complex parameter extraction based on the actual INSERT statement
            // For now, delegate to raw SQL execution
            return [:]
        }
    }
}

// MARK: - Query Pattern Enumeration

public enum QueryPattern {
    // Node operations
    case getAllNodes
    case getNodeById
    case getNodesByFolder
    case getNodesByType
    case createNode
    case updateNode
    case deleteNode

    // Notebook card operations
    case getAllNotebookCards
    case getNotebookCardById
    case getNotebookCardsByFolder
    case createNotebookCard
    case updateNotebookCard
    case deleteNotebookCard

    // Search operations
    case searchNodes
    case searchNotebookCards
}

// MARK: - Error Types

public enum QueryTranslatorError: LocalizedError {
    case missingParameter(String)
    case invalidParameterType(String, String)

    public var errorDescription: String? {
        switch self {
        case .missingParameter(let param):
            return "Missing required parameter: \(param)"
        case .invalidParameterType(let param, let expected):
            return "Invalid type for parameter '\(param)', expected: \(expected)"
        }
    }
}

// MARK: - String Extension for Pattern Matching

extension String {
    /// Simple regex matching for SQL pattern recognition
    func matches(_ pattern: String) -> Bool {
        do {
            let regex = try NSRegularExpression(pattern: pattern, options: .caseInsensitive)
            let range = NSRange(location: 0, length: self.utf16.count)
            return regex.firstMatch(in: self, options: [], range: range) != nil
        } catch {
            return false
        }
    }
}