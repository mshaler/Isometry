/**
 * Enhanced Database MessageHandler for WebView Bridge
 *
 * Provides secure and performant database access for WebView with comprehensive validation
 * and error handling. Handles async/await patterns with proper actor isolation.
 */

import WebKit
import Foundation

/**
 * Enhanced DatabaseMessageHandler for secure database operations from WebView
 * Supports all database methods with comprehensive validation, error handling, and performance monitoring
 */
@MainActor
public class DatabaseMessageHandler: NSObject, WKScriptMessageHandler {
    private var database: IsometryDatabase?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let performanceMonitor = MessageHandlerPerformanceMonitor()
    private let securityValidator = MessageHandlerSecurityValidator()

    public init(database: IsometryDatabase? = nil) {
        self.database = database
        super.init()

        // Configure JSON encoding/decoding for consistency
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        encoder.outputFormatting = .sortedKeys
    }

    /**
     * Set database reference for late binding during app initialization
     */
    public func setDatabase(_ database: IsometryDatabase) {
        self.database = database
    }

    /**
     * Main entry point for WebView message handling
     * Validates message format and routes to appropriate handler
     */
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        Task {
            await handleMessage(message)
        }
    }

    /**
     * Handle message parsing, validation, and routing with comprehensive error handling
     */
    private func handleMessage(_ message: WKScriptMessage) async {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Parse and validate message structure
        guard let messageBody = message.body as? [String: Any] else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid message format - expected JSON object",
                requestId: nil,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Extract required fields with validation
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            await sendErrorResponse(
                to: message.webView,
                error: "Missing required fields: method and id",
                requestId: messageBody["id"] as? String,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]
        let timestamp = messageBody["timestamp"] as? TimeInterval ?? Date().timeIntervalSince1970

        // Security validation
        let securityResult = await securityValidator.validateRequest(
            method: method,
            params: params,
            requestId: requestId
        )

        guard securityResult.isAllowed else {
            await sendErrorResponse(
                to: message.webView,
                error: "Security validation failed: \\(securityResult.reason)",
                requestId: requestId,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Route to database handler
        await handleDatabaseMessage(
            method: method,
            params: params,
            requestId: requestId,
            webView: message.webView,
            startTime: startTime
        )
    }

    /**
     * Handle database message routing with performance monitoring
     */
    private func handleDatabaseMessage(
        method: String,
        params: [String: Any],
        requestId: String,
        webView: WKWebView?,
        startTime: CFAbsoluteTime
    ) async {
        guard let database = database else {
            await sendErrorResponse(
                to: webView,
                error: "Database not available",
                requestId: requestId,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Start performance monitoring
        let operationId = await performanceMonitor.startOperation(method: method, requestId: requestId)

        do {
            let result: Any

            // Route to specific database operation handler
            switch method {
            case "ping":
                result = await handlePing()

            case "execute":
                result = try await handleExecuteSQL(params: params, database: database)

            case "getNodes":
                result = try await handleGetNodes(params: params, database: database)

            case "createNode":
                result = try await handleCreateNode(params: params, database: database)

            case "updateNode":
                result = try await handleUpdateNode(params: params, database: database)

            case "deleteNode":
                result = try await handleDeleteNode(params: params, database: database)

            case "searchNodes":
                result = try await handleSearchNodes(params: params, database: database)

            case "getGraph":
                result = try await handleGetGraph(params: params, database: database)

            case "reset":
                try await handleReset(database: database)
                result = ["success": true]

            default:
                throw DatabaseError.invalidOperation("Unknown method: \\(method)")
            }

            // Record successful operation
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            await performanceMonitor.endOperation(operationId, success: true, duration: duration)

            await sendSuccessResponse(
                to: webView,
                result: result,
                requestId: requestId,
                duration: duration
            )

        } catch {
            // Record failed operation
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            await performanceMonitor.endOperation(operationId, success: false, duration: duration)

            let errorMessage = formatError(error)
            await securityValidator.logSecurityError(
                method: method,
                requestId: requestId,
                error: error
            )

            await sendErrorResponse(
                to: webView,
                error: errorMessage,
                requestId: requestId,
                duration: duration
            )
        }
    }

    // MARK: - Database Operation Handlers

    /**
     * Handle ping for connectivity testing
     */
    private func handlePing() async -> [String: Any] {
        return [
            "pong": true,
            "timestamp": Date().timeIntervalSince1970,
            "version": "1.0.0"
        ]
    }

    /**
     * Execute raw SQL query with parameter binding and result formatting
     */
    private func handleExecuteSQL(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [[String: Any]] {
        guard let sql = params["sql"] as? String else {
            throw DatabaseError.invalidQuery("Missing SQL query")
        }

        let sqlParams = params["params"] as? [Any] ?? []

        // Additional SQL validation for security
        try await securityValidator.validateSQLQuery(sql)

        return try await database.read { db in
            var results: [[String: Any]] = []

            let statement = try db.makeStatement(sql: sql)
            let rows = try statement.makeSelectStatement()

            // Bind parameters if provided
            if !sqlParams.isEmpty {
                try rows.setArguments(StatementArguments(sqlParams))
            }

            // Execute and collect results
            while let row = try rows.next() {
                var rowData: [String: Any] = [:]
                for (index, columnName) in rows.columnNames.enumerated() {
                    rowData[columnName] = row[index]
                }
                results.append(rowData)
            }

            return results
        }
    }

    /**
     * Get nodes with optimized filtering and pagination
     */
    private func handleGetNodes(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [[String: Any]] {
        let limit = params["limit"] as? Int ?? 100
        let offset = params["offset"] as? Int ?? 0
        let filter = params["filter"] as? String
        let sortBy = params["sortBy"] as? String ?? "modified_at"

        // Validate pagination parameters
        guard limit > 0, limit <= 1000, offset >= 0 else {
            throw DatabaseError.invalidQuery("Invalid pagination parameters")
        }

        return try await database.read { db in
            var sql = "SELECT * FROM nodes WHERE deleted_at IS NULL"
            var arguments: [Any] = []

            // Apply filter if provided
            if let filter = filter, !filter.isEmpty {
                sql += " AND (title LIKE ? OR content LIKE ?)"
                let filterPattern = "%\\(filter)%"
                arguments.append(filterPattern)
                arguments.append(filterPattern)
            }

            // Add sorting and pagination
            sql += " ORDER BY \\(sortBy) DESC LIMIT ? OFFSET ?"
            arguments.append(limit)
            arguments.append(offset)

            var results: [[String: Any]] = []
            let rows = try db.makeSelectStatement(sql: sql)
            try rows.setArguments(StatementArguments(arguments))

            while let row = try rows.next() {
                var nodeData: [String: Any] = [:]
                for (index, columnName) in rows.columnNames.enumerated() {
                    nodeData[columnName] = row[index]
                }
                results.append(nodeData)
            }

            return results
        }
    }

    /**
     * Create new node with validation and return created node data
     */
    private func handleCreateNode(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [String: Any] {
        guard let nodeData = params["node"] as? [String: Any] else {
            throw DatabaseError.invalidData("Missing node data")
        }

        // Parse and validate node data
        let node = try parseNodeFromDict(nodeData)

        // Create node through database
        try await database.createNode(node)

        // Return created node as dictionary
        return try nodeToDict(node)
    }

    /**
     * Update existing node with validation
     */
    private func handleUpdateNode(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [String: Any] {
        guard let nodeData = params["node"] as? [String: Any] else {
            throw DatabaseError.invalidData("Missing node data")
        }

        let node = try parseNodeFromDict(nodeData)

        // Update node through database
        try await database.updateNode(node)

        return try nodeToDict(node)
    }

    /**
     * Delete node (soft delete) with validation
     */
    private func handleDeleteNode(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [String: Bool] {
        guard let nodeId = params["id"] as? String else {
            throw DatabaseError.invalidData("Missing node ID")
        }

        // Validate node ID format
        guard !nodeId.isEmpty, nodeId.count <= 255 else {
            throw DatabaseError.invalidData("Invalid node ID format")
        }

        try await database.deleteNode(id: nodeId)
        return ["success": true]
    }

    /**
     * Full-text search with FTS5 optimization
     */
    private func handleSearchNodes(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [[String: Any]] {
        guard let query = params["query"] as? String else {
            throw DatabaseError.invalidQuery("Missing search query")
        }

        let limit = params["limit"] as? Int ?? 50

        // Validate search parameters
        guard !query.isEmpty, query.count <= 1000, limit > 0, limit <= 100 else {
            throw DatabaseError.invalidQuery("Invalid search parameters")
        }

        return try await database.read { db in
            let sql = """
                SELECT *,
                       snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
                       rank
                FROM nodes_fts
                WHERE nodes_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """

            var results: [[String: Any]] = []
            let rows = try db.makeSelectStatement(sql: sql)
            try rows.setArguments([query, limit])

            while let row = try rows.next() {
                var nodeData: [String: Any] = [:]
                for (index, columnName) in rows.columnNames.enumerated() {
                    nodeData[columnName] = row[index]
                }
                results.append(nodeData)
            }

            return results
        }
    }

    /**
     * Get graph data with recursive traversal
     */
    private func handleGetGraph(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [[String: Any]] {
        let nodeId = params["nodeId"] as? String
        let depth = params["depth"] as? Int ?? 2

        // Validate depth parameter
        guard depth >= 0, depth <= 10 else {
            throw DatabaseError.invalidQuery("Invalid graph depth")
        }

        return try await database.read { db in
            var sql: String
            var arguments: [Any]

            if let nodeId = nodeId {
                // Recursive graph traversal for specific node
                sql = """
                    WITH RECURSIVE graph_traversal(id, level) AS (
                        SELECT ? as id, 0 as level
                        UNION ALL
                        SELECT e.to_id, gt.level + 1
                        FROM edges e
                        JOIN graph_traversal gt ON e.from_id = gt.id
                        WHERE gt.level < ?
                    )
                    SELECT DISTINCT n.*
                    FROM nodes n
                    JOIN graph_traversal gt ON n.id = gt.id
                    WHERE n.deleted_at IS NULL
                    ORDER BY gt.level, n.modified_at DESC
                """
                arguments = [nodeId, depth]
            } else {
                // Get all nodes for general graph view
                sql = """
                    SELECT * FROM nodes
                    WHERE deleted_at IS NULL
                    ORDER BY modified_at DESC
                    LIMIT 100
                """
                arguments = []
            }

            var results: [[String: Any]] = []
            let rows = try db.makeSelectStatement(sql: sql)
            if !arguments.isEmpty {
                try rows.setArguments(StatementArguments(arguments))
            }

            while let row = try rows.next() {
                var nodeData: [String: Any] = [:]
                for (index, columnName) in rows.columnNames.enumerated() {
                    nodeData[columnName] = row[index]
                }
                results.append(nodeData)
            }

            return results
        }
    }

    /**
     * Reset database (implementation depends on requirements)
     */
    private func handleReset(database: IsometryDatabase) async throws {
        // For security, reset should be carefully implemented
        // For now, this is a no-op since native handles persistence
        // In production, might implement data cleanup or cache clearing
        print("[DatabaseMessageHandler] Reset requested - currently no-op")
    }

    // MARK: - Helper Methods

    /**
     * Parse Node from dictionary with validation
     */
    private func parseNodeFromDict(_ data: [String: Any]) throws -> Node {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Node.self, from: jsonData)
    }

    /**
     * Convert Node to dictionary for response
     */
    private func nodeToDict(_ node: Node) throws -> [String: Any] {
        let data = try encoder.encode(node)
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw DatabaseError.encodingFailed("Failed to convert node to dictionary")
        }
        return dict
    }

    /**
     * Format error for client response
     */
    private func formatError(_ error: Error) -> String {
        if let dbError = error as? DatabaseError {
            return dbError.localizedDescription
        } else {
            return "Database operation failed: \\(error.localizedDescription)"
        }
    }

    // MARK: - Response Delivery

    /**
     * Send success response to WebView with proper JavaScript execution
     */
    private func sendSuccessResponse(
        to webView: WKWebView?,
        result: Any,
        requestId: String,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId,
            result: result,
            error: nil,
            duration: duration
        )
    }

    /**
     * Send error response to WebView with proper JavaScript execution
     */
    private func sendErrorResponse(
        to webView: WKWebView?,
        error: String,
        requestId: String?,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId ?? "unknown",
            result: nil,
            error: error,
            duration: duration
        )
    }

    /**
     * Send response to WebView through JavaScript callback
     */
    private func sendResponse(
        to webView: WKWebView?,
        id: String,
        result: Any?,
        error: String?,
        duration: CFAbsoluteTime
    ) async {
        guard let webView = webView else {
            print("[DatabaseMessageHandler] No WebView available for response")
            return
        }

        var response: [String: Any] = [
            "id": id,
            "success": error == nil,
            "timestamp": Date().timeIntervalSince1970,
            "duration": duration * 1000 // Convert to milliseconds
        ]

        if let result = result {
            response["result"] = result
        }

        if let error = error {
            response["error"] = error
        }

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response, options: .sortedKeys)
            guard let responseString = String(data: responseData, encoding: .utf8) else {
                throw DatabaseError.encodingFailed("Failed to encode response")
            }

            let script = "window.resolveWebViewRequest('\(id)', \(result != nil ? "\(responseString)" : "null"), \(error != nil ? "\"\(error!)\"" : "null"))"

            await webView.evaluateJavaScript(script)

        } catch {
            print("[DatabaseMessageHandler] Failed to send response: \(error)")
            // Attempt fallback response
            let fallbackScript = "window.resolveWebViewRequest('\(id)', null, 'Failed to serialize response')"
            await webView.evaluateJavaScript(fallbackScript)
        }
    }
}

// MARK: - Support Classes

/**
 * Performance monitoring for MessageHandler operations
 */
@MainActor
private class MessageHandlerPerformanceMonitor {
    private var operations: [String: (startTime: CFAbsoluteTime, method: String)] = [:]

    func startOperation(method: String, requestId: String) async -> String {
        let operationId = "\(requestId)-\(method)"
        operations[operationId] = (CFAbsoluteTimeGetCurrent(), method)
        return operationId
    }

    func endOperation(_ operationId: String, success: Bool, duration: CFAbsoluteTime) async {
        operations.removeValue(forKey: operationId)

        #if DEBUG
        print("[Performance] \(operationId): \(success ? "SUCCESS" : "FAILED") in \(String(format: "%.2f", duration * 1000))ms")
        #endif
    }
}

/**
 * Security validation for MessageHandler requests
 */
@MainActor
private class MessageHandlerSecurityValidator {
    private let allowedMethods = Set([
        "ping", "execute", "getNodes", "createNode", "updateNode",
        "deleteNode", "searchNodes", "getGraph", "reset"
    ])

    func validateRequest(
        method: String,
        params: [String: Any],
        requestId: String
    ) async -> (isAllowed: Bool, reason: String) {
        // Validate method
        guard allowedMethods.contains(method) else {
            return (false, "Unknown method: \\(method)")
        }

        // Validate request ID format
        guard !requestId.isEmpty, requestId.count <= 255 else {
            return (false, "Invalid request ID format")
        }

        // Method-specific validation
        if method == "execute", let sql = params["sql"] as? String {
            if let sqlError = validateSQLSecurity(sql) {
                return (false, sqlError)
            }
        }

        return (true, "")
    }

    func validateSQLQuery(_ sql: String) async throws {
        if let error = validateSQLSecurity(sql) {
            throw DatabaseError.securityViolation(error)
        }
    }

    private func validateSQLSecurity(_ sql: String) -> String? {
        let upperSQL = sql.uppercased().trimmingCharacters(in: .whitespacesAndNewlines)

        // Check for dangerous SQL patterns
        let dangerousPatterns = [
            "DROP TABLE", "DROP DATABASE", "DELETE FROM users", "DELETE FROM nodes",
            "GRANT", "REVOKE", "CREATE USER", "ALTER TABLE", "TRUNCATE",
            "INSERT INTO users", "UPDATE users SET"
        ]

        for pattern in dangerousPatterns {
            if upperSQL.contains(pattern) {
                return "Potentially dangerous SQL pattern detected: \\(pattern)"
            }
        }

        return nil
    }

    func logSecurityError(method: String, requestId: String, error: Error) async {
        print("[Security] Error in \\(method) (\\(requestId)): \\(error)")
    }
}

// MARK: - Enhanced Database Error Types

public enum DatabaseError: LocalizedError {
    case invalidOperation(String)
    case invalidQuery(String)
    case invalidData(String)
    case encodingFailed(String)
    case securityViolation(String)

    public var errorDescription: String? {
        switch self {
        case .invalidOperation(let msg):
            return "Invalid database operation: \\(msg)"
        case .invalidQuery(let msg):
            return "Invalid database query: \\(msg)"
        case .invalidData(let msg):
            return "Invalid data: \\(msg)"
        case .encodingFailed(let msg):
            return "Encoding failed: \\(msg)"
        case .securityViolation(let msg):
            return "Security violation: \\(msg)"
        }
    }
}