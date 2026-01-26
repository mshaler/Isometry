import WebKit
import Foundation

/// Database message handler for WebView bridge communication
/// Handles all database operations from React prototype through secure MessageHandler interface
public class DatabaseMessageHandler: NSObject, WKScriptMessageHandler {
    private var database: IsometryDatabase?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(database: IsometryDatabase? = nil) {
        self.database = database
        super.init()

        // Configure JSON encoding/decoding
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    /// Set database reference (used for late binding)
    public func setDatabase(_ database: IsometryDatabase) {
        self.database = database
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let messageBody = message.body as? [String: Any] else {
            sendError(to: message.webView, error: "Invalid message format", requestId: nil)
            return
        }

        // Parse message structure
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            sendError(to: message.webView, error: "Missing method or id", requestId: nil)
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        Task {
            await handleDatabaseRequest(
                method: method,
                params: params,
                requestId: requestId,
                webView: message.webView
            )
        }
    }

    private func handleDatabaseRequest(
        method: String,
        params: [String: Any],
        requestId: String,
        webView: WKWebView?
    ) async {
        let startTime = CFAbsoluteTimeGetCurrent()

        guard let database = database else {
            sendError(to: webView, error: "Database not available", requestId: requestId)
            return
        }

        // Log operation for security auditing
        logSecurityOperation(method: method, requestId: requestId, params: params)

        do {
            let result: Any

            switch method {
            case "execute":
                result = try await handleExecuteQuery(params: params)

            case "getNodes":
                result = try await handleOptimizedGetNodes(params: params)

            case "createNode":
                result = try await handleCreateNode(params: params)

            case "updateNode":
                result = try await handleUpdateNode(params: params)

            case "deleteNode":
                result = try await handleDeleteNode(params: params)

            case "search":
                result = try await handleOptimizedSearch(params: params)

            case "getGraph":
                result = try await handleGetGraph(params: params)

            case "reset":
                try await handleReset()
                result = ["success": true]

            default:
                throw DatabaseError.invalidOperation("Unknown method: \(method)")
            }

            let duration = CFAbsoluteTimeGetCurrent() - startTime
            sendSuccess(to: webView, result: result, requestId: requestId, duration: duration)

        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let errorMessage: String
            if let dbError = error as? DatabaseError {
                errorMessage = dbError.localizedDescription
            } else {
                errorMessage = "Database operation failed: \(error.localizedDescription)"
            }

            logSecurityError(method: method, requestId: requestId, error: error)
            sendError(to: webView, error: errorMessage, requestId: requestId, duration: duration)
        }
    }

    /// Handle database message with enhanced parsing and validation
    private func handleDatabaseMessage(_ messageBody: [String: Any]) async {
        // Extract and validate required fields
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            print("[DatabaseMessageHandler] Invalid message format: missing method or id")
            return
        }

        // Validate method name for security
        let allowedMethods = ["execute", "getNodes", "createNode", "updateNode", "deleteNode", "search", "getGraph", "reset"]
        guard allowedMethods.contains(method) else {
            print("[DatabaseMessageHandler] Invalid method: \(method)")
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        // Extract WebView from the message if available
        // Note: This would need to be passed from userContentController
        await handleDatabaseRequest(
            method: method,
            params: params,
            requestId: requestId,
            webView: nil // TODO: Get WebView reference from context
        )
    }

    // MARK: - Database Operation Handlers

    private func handleExecuteQuery(params: [String: Any]) async throws -> [[String: Any]] {
        guard let sql = params["sql"] as? String else {
            throw DatabaseError.invalidQuery("Missing SQL query")
        }

        let sqlParams = params["params"] as? [Any] ?? []

        return try await database!.read { db in
            var results: [[String: Any]] = []
            let rows = try db.makeStatement(sql: sql).makeSelectStatement()

            // Bind parameters if provided
            if !sqlParams.isEmpty {
                try rows.setArguments(StatementArguments(sqlParams))
            }

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

    private func handleOptimizedGetNodes(params: [String: Any]) async throws -> [[String: Any]] {
        let limit = params["limit"] as? Int ?? 100
        let offset = params["offset"] as? Int ?? 0
        let filter = params["filter"] as? String

        return try await database!.read { db in
            var sql = "SELECT * FROM nodes WHERE deleted_at IS NULL"
            var arguments: [Any] = []

            if let filter = filter, !filter.isEmpty {
                sql += " AND (title LIKE ? OR content LIKE ?)"
                arguments.append("%\(filter)%")
                arguments.append("%\(filter)%")
            }

            sql += " ORDER BY modified_at DESC LIMIT ? OFFSET ?"
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

    private func handleCreateNode(params: [String: Any]) async throws -> [String: Any] {
        guard let nodeData = params["node"] as? [String: Any] else {
            throw DatabaseError.invalidData("Missing node data")
        }

        let node = try parseNode(from: nodeData)
        try await database!.createNode(node)

        return try nodeToDict(node)
    }

    private func handleUpdateNode(params: [String: Any]) async throws -> [String: Any] {
        guard let nodeData = params["node"] as? [String: Any] else {
            throw DatabaseError.invalidData("Missing node data")
        }

        let node = try parseNode(from: nodeData)
        try await database!.updateNode(node)

        return try nodeToDict(node)
    }

    private func handleDeleteNode(params: [String: Any]) async throws -> [String: Bool] {
        guard let nodeId = params["id"] as? String else {
            throw DatabaseError.invalidData("Missing node ID")
        }

        try await database!.deleteNode(id: nodeId)
        return ["success": true]
    }

    private func handleOptimizedSearch(params: [String: Any]) async throws -> [[String: Any]] {
        guard let query = params["query"] as? String else {
            throw DatabaseError.invalidQuery("Missing search query")
        }

        let limit = params["limit"] as? Int ?? 50

        return try await database!.read { db in
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

    private func handleGetGraph(params: [String: Any]) async throws -> [[String: Any]] {
        let nodeId = params["nodeId"] as? String
        let depth = params["depth"] as? Int ?? 2

        return try await database!.read { db in
            var sql: String
            var arguments: [Any]

            if let nodeId = nodeId {
                // Get connections for specific node
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
                """
                arguments = [nodeId, depth]
            } else {
                // Get all nodes with their connections
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

    private func handleReset() async throws {
        // Implementation depends on how reset should work
        // For now, this is a no-op since native handles persistence automatically
    }

    // MARK: - Helper Methods

    private func parseNode(from data: [String: Any]) throws -> Node {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Node.self, from: jsonData)
    }

    private func nodeToDict(_ node: Node) throws -> [String: Any] {
        let data = try encoder.encode(node)
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw DatabaseError.encodingFailed
        }
        return dict
    }

    private func sendSuccess(to webView: WKWebView?, result: Any, requestId: String, duration: CFAbsoluteTime? = nil) {
        guard let webView = webView else { return }

        var response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result,
            "timestamp": Date().timeIntervalSince1970
        ]

        if let duration = duration {
            response["duration"] = duration * 1000 // Convert to milliseconds
        }

        sendResponse(to: webView, response: response)
    }

    private func sendError(to webView: WKWebView?, error: String, requestId: String?, duration: CFAbsoluteTime? = nil) {
        guard let webView = webView else { return }

        var response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error,
            "timestamp": Date().timeIntervalSince1970
        ]

        if let duration = duration {
            response["duration"] = duration * 1000 // Convert to milliseconds
        }

        sendResponse(to: webView, response: response)
    }

    // MARK: - Security and Logging

    private func logSecurityOperation(method: String, requestId: String, params: [String: Any]) {
        #if DEBUG
        print("[DatabaseMessageHandler] Security Audit - Method: \(method), ID: \(requestId)")
        #endif

        // In production, this would go to a secure logging system
        // For now, just validate that params don't contain obviously malicious content
        if method == "execute", let sql = params["sql"] as? String {
            validateSQLQuery(sql)
        }
    }

    private func logSecurityError(method: String, requestId: String, error: Error) {
        print("[DatabaseMessageHandler] Security Error - Method: \(method), ID: \(requestId), Error: \(error)")
    }

    private func validateSQLQuery(_ sql: String) {
        let suspiciousPatterns = ["DROP TABLE", "DELETE FROM users", "GRANT", "REVOKE", "CREATE USER"]
        let upperSQL = sql.uppercased()

        for pattern in suspiciousPatterns {
            if upperSQL.contains(pattern) {
                print("[DatabaseMessageHandler] WARNING: Suspicious SQL pattern detected: \(pattern)")
            }
        }
    }

    private func sendResponse(to webView: WKWebView, response: [String: Any]) {
        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { _, error in
                    if let error = error {
                        print("WebView bridge response error: \(error)")
                    }
                }
            }
        } catch {
            print("Failed to serialize bridge response: \(error)")
        }
    }
}

/// File system message handler for WebView bridge communication
/// Handles file operations within App Sandbox constraints
public class FileSystemMessageHandler: NSObject, WKScriptMessageHandler {
    private let fileManager = FileManager.default

    public override init() {
        super.init()
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let messageBody = message.body as? [String: Any] else {
            sendError(to: message.webView, error: "Invalid message format", requestId: nil)
            return
        }

        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            sendError(to: message.webView, error: "Missing method or id", requestId: nil)
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        Task {
            await handleFileSystemRequest(
                method: method,
                params: params,
                requestId: requestId,
                webView: message.webView
            )
        }
    }

    private func handleFileSystemRequest(
        method: String,
        params: [String: Any],
        requestId: String,
        webView: WKWebView?
    ) async {
        do {
            let result: Any

            switch method {
            case "readFile":
                result = try await handleReadFile(params: params)

            case "writeFile":
                result = try await handleWriteFile(params: params)

            case "deleteFile":
                result = try await handleDeleteFile(params: params)

            case "listFiles":
                result = try await handleListFiles(params: params)

            case "fileExists":
                result = try await handleFileExists(params: params)

            default:
                throw FileSystemError.invalidOperation("Unknown method: \(method)")
            }

            sendSuccess(to: webView, result: result, requestId: requestId)

        } catch {
            let errorMessage: String
            if let fsError = error as? FileSystemError {
                errorMessage = fsError.localizedDescription
            } else {
                errorMessage = "File system operation failed: \(error.localizedDescription)"
            }

            sendError(to: webView, error: errorMessage, requestId: requestId)
        }
    }

    // MARK: - File System Operation Handlers

    private func handleReadFile(params: [String: Any]) async throws -> [String: Any] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let safePath = try validateAndSanitizePath(path)
        guard fileManager.fileExists(atPath: safePath) else {
            throw FileSystemError.fileNotFound(safePath)
        }

        let content = try String(contentsOfFile: safePath, encoding: .utf8)
        let attributes = try fileManager.attributesOfItem(atPath: safePath)

        return [
            "content": content,
            "size": attributes[.size] as? UInt64 ?? 0,
            "modified": (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        ]
    }

    private func handleWriteFile(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String,
              let content = params["content"] as? String else {
            throw FileSystemError.invalidPath("Missing path or content")
        }

        let safePath = try validateAndSanitizePath(path)

        // Ensure directory exists
        let directory = URL(fileURLWithPath: safePath).deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        try content.write(toFile: safePath, atomically: true, encoding: .utf8)

        return ["success": true]
    }

    private func handleDeleteFile(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let safePath = try validateAndSanitizePath(path)

        if fileManager.fileExists(atPath: safePath) {
            try fileManager.removeItem(atPath: safePath)
        }

        return ["success": true]
    }

    private func handleListFiles(params: [String: Any]) async throws -> [[String: Any]] {
        let path = params["path"] as? String ?? ""
        let safePath = try validateAndSanitizePath(path.isEmpty ? documentsDirectory() : path)

        guard fileManager.fileExists(atPath: safePath) else {
            throw FileSystemError.directoryNotFound(safePath)
        }

        let contents = try fileManager.contentsOfDirectory(atPath: safePath)
        var results: [[String: Any]] = []

        for item in contents {
            let itemPath = URL(fileURLWithPath: safePath).appendingPathComponent(item).path
            let attributes = try fileManager.attributesOfItem(atPath: itemPath)

            results.append([
                "name": item,
                "path": itemPath,
                "isDirectory": attributes[.type] as? FileAttributeType == .typeDirectory,
                "size": attributes[.size] as? UInt64 ?? 0,
                "modified": (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
            ])
        }

        return results.sorted { ($0["name"] as? String ?? "") < ($1["name"] as? String ?? "") }
    }

    private func handleFileExists(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let safePath = try validateAndSanitizePath(path)
        let exists = fileManager.fileExists(atPath: safePath)

        return ["exists": exists]
    }

    // MARK: - Security & Path Validation

    private func validateAndSanitizePath(_ path: String) throws -> String {
        // Remove any dangerous path components
        let sanitized = path
            .replacingOccurrences(of: "../", with: "")
            .replacingOccurrences(of: "..\\", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // Ensure path is within app container
        let documentsPath = documentsDirectory()
        let resolvedPath: String

        if sanitized.hasPrefix("/") {
            // Absolute path - must be within documents or temp directory
            if !sanitized.hasPrefix(documentsPath) && !sanitized.hasPrefix(NSTemporaryDirectory()) {
                throw FileSystemError.accessDenied("Path outside app container: \(sanitized)")
            }
            resolvedPath = sanitized
        } else {
            // Relative path - resolve relative to documents directory
            resolvedPath = URL(fileURLWithPath: documentsPath)
                .appendingPathComponent(sanitized)
                .path
        }

        // Additional security checks
        if resolvedPath.contains("..") {
            throw FileSystemError.accessDenied("Invalid path traversal: \(path)")
        }

        return resolvedPath
    }

    private func documentsDirectory() -> String {
        return fileManager.urls(for: .documentDirectory, in: .userDomainMask).first?.path ?? ""
    }

    // MARK: - Response Handling

    private func sendSuccess(to webView: WKWebView?, result: Any, requestId: String) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result
        ]

        sendResponse(to: webView, response: response)
    }

    private func sendError(to webView: WKWebView?, error: String, requestId: String?) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        sendResponse(to: webView, response: response)
    }

    private func sendResponse(to webView: WKWebView, response: [String: Any]) {
        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { _, error in
                    if let error = error {
                        print("WebView bridge response error: \(error)")
                    }
                }
            }
        } catch {
            print("Failed to serialize bridge response: \(error)")
        }
    }
}

// MARK: - Error Types

public enum FileSystemError: LocalizedError {
    case invalidOperation(String)
    case invalidPath(String)
    case fileNotFound(String)
    case directoryNotFound(String)
    case accessDenied(String)

    public var errorDescription: String? {
        switch self {
        case .invalidOperation(let msg):
            return "Invalid file system operation: \(msg)"
        case .invalidPath(let msg):
            return "Invalid file path: \(msg)"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .directoryNotFound(let path):
            return "Directory not found: \(path)"
        case .accessDenied(let msg):
            return "Access denied: \(msg)"
        }
    }
}