/**
 * FilterBridgeHandler - Dedicated WebView Bridge Handler for LATCH Filter Operations
 *
 * Provides specialized filter message handling with LATCH pattern optimization,
 * comprehensive error handling, and performance monitoring for real-time filter synchronization.
 */

import WebKit
import Foundation
import GRDB
import IsometryCore

/**
 * Dedicated native filter message handler for WebView bridge integration
 * Handles filter execution requests from React with LATCH pattern optimization
 */
@MainActor
public class FilterBridgeHandler: NSObject, WKScriptMessageHandler {
    private var database: IsometryDatabase?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let performanceMonitor = FilterPerformanceMonitor()
    private let queryCache = FilterQueryCache()
    private let logger = BridgeLogger(category: "FilterBridge")

    // Request correlation for async operations
    private var activeRequests: Set<String> = []

    public init(database: IsometryDatabase? = nil) {
        self.database = database
        super.init()

        // Configure JSON encoding for consistency
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
    }

    /**
     * Set database reference for late binding during app initialization
     */
    public func setDatabase(_ database: IsometryDatabase) {
        self.database = database
    }

    /**
     * Main entry point for WebView filter message handling
     * Conforms to WKScriptMessageHandler protocol
     */
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        Task {
            await handleFilterMessage(message)
        }
    }

    /**
     * Handle filter message parsing, validation, and routing with comprehensive error handling
     */
    private func handleFilterMessage(_ message: WKScriptMessage) async {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Parse and validate message structure
        guard let messageBody = message.body as? [String: Any] else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid filter message format - expected JSON object",
                requestId: nil,
                startTime: startTime
            )
            return
        }

        // Extract required fields
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            await sendErrorResponse(
                to: message.webView,
                error: "Missing required fields: method and id",
                requestId: messageBody["id"] as? String,
                startTime: startTime
            )
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        // Track active request for cancellation support
        activeRequests.insert(requestId)
        defer { activeRequests.remove(requestId) }

        // Security validation
        guard validateFilterMethod(method) else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid filter method: \(method)",
                requestId: requestId,
                startTime: startTime
            )
            return
        }

        // Route to filter operation handler
        await handleFilterOperation(
            method: method,
            params: params,
            requestId: requestId,
            webView: message.webView,
            startTime: startTime
        )
    }

    /**
     * Handle filter operation routing with performance monitoring
     */
    private func handleFilterOperation(
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
                startTime: startTime
            )
            return
        }

        // Start performance monitoring
        let operationId = await performanceMonitor.startOperation(method: method, requestId: requestId)

        do {
            let result: [String: Any]

            // Route to specific filter operation handler
            switch method {
            case "executeFilter":
                result = try await executeFilter(params: params, database: database)

            case "getFilterStatistics":
                result = await getFilterStatistics()

            case "cancelPendingRequests":
                result = await cancelPendingRequests()

            default:
                throw FilterBridgeError.invalidMethod("Unknown filter method: \(method)")
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

            let errorMessage = formatFilterError(error)
            logger.error("Filter operation failed: \(method) - \(errorMessage)")

            await sendErrorResponse(
                to: webView,
                error: errorMessage,
                requestId: requestId,
                startTime: startTime
            )
        }
    }

    // MARK: - Filter Operation Handlers

    /**
     * Execute LATCH filter with pattern optimization and caching
     */
    private func executeFilter(
        params: [String: Any],
        database: IsometryDatabase
    ) async throws -> [String: Any] {
        guard let sql = params["sql"] as? String else {
            throw FilterBridgeError.missingParameter("sql")
        }

        guard let paramArray = params["params"] as? [Any] else {
            throw FilterBridgeError.missingParameter("params")
        }

        let limit = params["limit"] as? Int ?? 1000
        let offset = params["offset"] as? Int ?? 0
        let sequenceId = params["sequenceId"] as? String

        // Validate parameters
        guard limit > 0, limit <= 5000, offset >= 0 else {
            throw FilterBridgeError.invalidParameter("Invalid pagination parameters")
        }

        // Check cache first
        let cacheKey = createCacheKey(sql: sql, params: paramArray, limit: limit, offset: offset)
        if let cachedResult = await queryCache.get(key: cacheKey) {
            logger.debug("Cache hit for filter query")
            return [
                "success": true,
                "results": cachedResult.results,
                "count": cachedResult.count,
                "duration": 0, // Cache hit
                "sequenceId": sequenceId ?? NSNull(),
                "cached": true
            ]
        }

        // Analyze LATCH query pattern for optimization
        if let pattern = analyzeLATCHQuery(sql) {
            logger.debug("Using LATCH pattern optimization: \(pattern)")
            return try await executeOptimizedFilter(
                pattern: pattern,
                params: paramArray,
                limit: limit,
                offset: offset,
                sequenceId: sequenceId,
                database: database,
                cacheKey: cacheKey
            )
        }

        // Fallback to raw SQL execution
        logger.debug("Using raw SQL fallback for filter")
        return try await executeRawFilter(
            sql: sql,
            params: paramArray,
            limit: limit,
            offset: offset,
            sequenceId: sequenceId,
            database: database,
            cacheKey: cacheKey
        )
    }

    /**
     * Execute optimized filter using LATCH pattern recognition
     */
    private func executeOptimizedFilter(
        pattern: LATCHQueryPattern,
        params: [Any],
        limit: Int,
        offset: Int,
        sequenceId: String?,
        database: IsometryDatabase,
        cacheKey: String
    ) async throws -> [String: Any] {
        let startTime = CFAbsoluteTimeGetCurrent()

        let results: [Node]

        switch pattern {
        case .ftsSearch:
            guard let query = params.first as? String else {
                throw FilterBridgeError.invalidParameterType("query", "String")
            }
            let allResults = try await database.searchNodes(query: query)
            // Apply pagination manually since the existing method doesn't support it
            results = Array(allResults.dropFirst(offset).prefix(limit))

        case .spatialQuery:
            guard params.count >= 4,
                  let south = params[0] as? Double,
                  let north = params[1] as? Double,
                  let west = params[2] as? Double,
                  let east = params[3] as? Double else {
                throw FilterBridgeError.invalidParameterType("spatial bounds", "[Double, Double, Double, Double]")
            }

            // Use raw SQL for spatial queries since there's no specialized method
            let spatialSQL = """
                SELECT * FROM nodes
                WHERE deleted_at IS NULL
                AND latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
                ORDER BY modified_at DESC
                LIMIT ? OFFSET ?
            """

            results = try await executeRawQuery(
                sql: spatialSQL,
                params: [south, north, west, east, limit, offset],
                database: database
            )

        case .folderQuery:
            guard let folder = params.first as? String else {
                throw FilterBridgeError.invalidParameterType("folder", "String")
            }
            let allResults = try await database.getNodes(inFolder: folder)
            // Apply pagination manually
            results = Array(allResults.dropFirst(offset).prefix(limit))

        case .timeQuery:
            guard params.count >= 2,
                  let startTime = params[0] as? String,
                  let endTime = params[1] as? String else {
                throw FilterBridgeError.invalidParameterType("time range", "[String, String]")
            }

            // Use raw SQL for time range queries
            let timeSQL = """
                SELECT * FROM nodes
                WHERE deleted_at IS NULL
                AND created_at BETWEEN ? AND ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """

            results = try await executeRawQuery(
                sql: timeSQL,
                params: [startTime, endTime, limit, offset],
                database: database
            )

        case .compoundQuery:
            // Handle complex multi-LATCH queries with raw SQL
            results = try await executeRawQuery(
                sql: translateSQL(createCompoundQuery(params: params)),
                params: params + [limit, offset],
                database: database
            )
        }

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        let resultData = formatFilterResults(results, duration: duration, sequenceId: sequenceId)

        // Cache successful results for first page
        if offset == 0 && !results.isEmpty {
            await queryCache.set(
                key: cacheKey,
                result: CachedFilterResult(results: resultData["results"] as! [[String: Any]], count: results.count),
                ttl: 300 // 5 minutes
            )
        }

        return resultData
    }

    /**
     * Execute raw SQL filter with QueryTranslator optimization
     */
    private func executeRawFilter(
        sql: String,
        params: [Any],
        limit: Int,
        offset: Int,
        sequenceId: String?,
        database: IsometryDatabase,
        cacheKey: String
    ) async throws -> [String: Any] {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Translate SQL for GRDB compatibility
        let translatedSQL = translateSQL(sql)
        let results = try await executeRawQuery(
            sql: translatedSQL,
            params: params + [limit, offset],
            database: database
        )

        let duration = CFAbsoluteTimeGetCurrent() - startTime
        let resultData = formatFilterResults(results, duration: duration, sequenceId: sequenceId)

        // Cache successful results for first page
        if offset == 0 && !results.isEmpty {
            await queryCache.set(
                key: cacheKey,
                result: CachedFilterResult(results: resultData["results"] as! [[String: Any]], count: results.count),
                ttl: 300 // 5 minutes
            )
        }

        return resultData
    }

    /**
     * Get filter performance statistics
     */
    private func getFilterStatistics() async -> [String: Any] {
        let stats = await performanceMonitor.getStatistics()
        let cacheStats = await queryCache.getStatistics()

        return [
            "success": true,
            "cacheHitRate": cacheStats.hitRate,
            "averageQueryTime": stats.averageQueryTime,
            "totalQueries": stats.totalQueries,
            "commonPatterns": stats.commonPatterns,
            "cacheSize": cacheStats.size,
            "cacheTTL": cacheStats.averageTTL
        ]
    }

    /**
     * Cancel pending filter requests
     */
    private func cancelPendingRequests() async -> [String: Any] {
        let cancelledCount = activeRequests.count
        activeRequests.removeAll()

        logger.info("Cancelled \(cancelledCount) pending filter requests")

        return [
            "success": true,
            "cancelledRequests": cancelledCount
        ]
    }

    // MARK: - Helper Methods

    /**
     * Validate filter method names for security
     */
    private func validateFilterMethod(_ method: String) -> Bool {
        let allowedMethods = Set([
            "executeFilter",
            "getFilterStatistics",
            "cancelPendingRequests"
        ])
        return allowedMethods.contains(method)
    }

    /**
     * Analyze SQL query for LATCH patterns (local implementation to avoid circular dependency)
     */
    private func analyzeLATCHQuery(_ sql: String) -> LATCHQueryPattern? {
        let normalizedSQL = sql.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)

        // FTS5 search pattern (Alphabet filtering)
        if normalizedSQL.contains("nodes_fts") && normalizedSQL.contains("match") {
            return .ftsSearch
        }

        // Spatial query pattern (Location filtering)
        if normalizedSQL.contains("latitude") && normalizedSQL.contains("longitude") &&
           normalizedSQL.contains("between") {
            return .spatialQuery
        }

        // Folder query pattern (Category filtering)
        if normalizedSQL.contains("folder") && (normalizedSQL.contains("=") || normalizedSQL.contains("in")) {
            return .folderQuery
        }

        // Time range query pattern (Time filtering)
        if (normalizedSQL.contains("created_at") || normalizedSQL.contains("modified_at") ||
            normalizedSQL.contains("due_at")) && normalizedSQL.contains("between") {
            return .timeQuery
        }

        // Complex compound query with multiple LATCH dimensions
        let latchCount = [
            normalizedSQL.contains("nodes_fts"),
            normalizedSQL.contains("latitude"),
            normalizedSQL.contains("folder"),
            normalizedSQL.contains("created_at") || normalizedSQL.contains("modified_at")
        ].filter { $0 }.count

        if latchCount >= 2 {
            return .compoundQuery
        }

        return nil
    }

    /**
     * Translate SQL for GRDB compatibility (local implementation)
     */
    private func translateSQL(_ sql: String) -> String {
        var translated = sql

        // Handle datetime functions
        translated = translated.replacingOccurrences(
            of: "datetime('now')",
            with: "CURRENT_TIMESTAMP"
        )

        // Handle LIMIT without OFFSET
        translated = translated.replacingOccurrences(
            of: #"LIMIT\s+(\d+)$"#,
            with: "LIMIT $1 OFFSET 0",
            options: .regularExpression
        )

        return translated
    }

    /**
     * Execute raw SQL query and return Node results
     */
    private func executeRawQuery(
        sql: String,
        params: [Any],
        database: IsometryDatabase
    ) async throws -> [Node] {
        // Use database's read method to execute raw SQL and map to Node objects
        return try await database.read { db in
            var results: [Node] = []

            let statement = try db.makeStatement(sql: sql)

            // Convert params to StatementArguments if provided
            if !params.isEmpty {
                let arguments = params.map { param -> DatabaseValue in
                    if let string = param as? String {
                        return DatabaseValue(value: string) ?? .null
                    } else if let int = param as? Int {
                        return DatabaseValue(value: int) ?? .null
                    } else if let double = param as? Double {
                        return DatabaseValue(value: double) ?? .null
                    } else if let bool = param as? Bool {
                        return DatabaseValue(value: bool) ?? .null
                    } else {
                        return DatabaseValue.null
                    }
                }
                try statement.setArguments(StatementArguments(arguments))
            }

            // Execute query and map rows to Node objects
            for row in try Row.fetchAll(statement) {
                // Map database row to Node
                let node = try Node(row: row)
                results.append(node)
            }

            return results
        }
    }

    /**
     * Create cache key for filter query
     */
    private func createCacheKey(sql: String, params: [Any], limit: Int, offset: Int) -> String {
        let paramString = params.map { "\($0)" }.joined(separator: ",")
        return "\(sql)|\(paramString)|\(limit)|\(offset)".data(using: .utf8)?.base64EncodedString() ?? "\(sql.hashValue)"
    }

    /**
     * Create compound query for complex LATCH patterns
     */
    private func createCompoundQuery(params: [Any]) -> String {
        // This would create complex SQL for compound LATCH filters
        // For now, use a simple pattern that delegates to QueryTranslator
        return """
            SELECT * FROM nodes
            WHERE deleted_at IS NULL
            AND id IN (SELECT rowid FROM nodes_fts WHERE nodes_fts MATCH ?)
        """
    }

    /**
     * Format Node results for bridge response
     */
    private func formatFilterResults(_ nodes: [Node], duration: CFAbsoluteTime, sequenceId: String?) -> [String: Any] {
        do {
            let nodeData = try nodes.map { node in
                let data = try encoder.encode(node)
                return try JSONSerialization.jsonObject(with: data) as! [String: Any]
            }

            return [
                "success": true,
                "results": nodeData,
                "count": nodes.count,
                "duration": duration * 1000, // Convert to milliseconds
                "sequenceId": sequenceId ?? NSNull(),
                "cached": false
            ]
        } catch {
            logger.error("Failed to format filter results: \(error)")
            return [
                "success": false,
                "error": "Failed to format results: \(error.localizedDescription)",
                "results": [],
                "count": 0
            ]
        }
    }

    /**
     * Format filter error for response
     */
    private func formatFilterError(_ error: Error) -> String {
        if let bridgeError = error as? FilterBridgeError {
            return bridgeError.localizedDescription
        }
        return "Filter execution failed: \(error.localizedDescription)"
    }

    // MARK: - Response Delivery

    /**
     * Send success response to WebView
     */
    private func sendSuccessResponse(
        to webView: WKWebView?,
        result: [String: Any],
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
     * Send error response to WebView
     */
    private func sendErrorResponse(
        to webView: WKWebView?,
        error: String,
        requestId: String?,
        startTime: CFAbsoluteTime
    ) async {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
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
            logger.warning("No WebView available for filter response")
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
                throw FilterBridgeError.encodingFailed("Failed to encode filter response")
            }

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            try await webView.evaluateJavaScript(script)

        } catch {
            logger.error("Failed to send filter response: \(error)")
            // Attempt fallback response
            let fallbackScript = "window._isometryBridge?.handleResponse({\"id\":\"\(id)\",\"success\":false,\"error\":\"Failed to serialize response\"})"
            _ = try? await webView.evaluateJavaScript(fallbackScript)
        }
    }
}

// MARK: - Supporting Types and Classes

/**
 * LATCH Query Pattern Recognition
 */
public enum LATCHQueryPattern {
    case ftsSearch        // FTS5 text search (Alphabet)
    case spatialQuery     // Geographic bounds (Location)
    case folderQuery      // Folder/category filtering (Category)
    case timeQuery        // Time range filtering (Time)
    case compoundQuery    // Multiple LATCH dimensions
}

/**
 * Filter Bridge Error Types
 */
public enum FilterBridgeError: LocalizedError {
    case invalidMethod(String)
    case missingParameter(String)
    case invalidParameter(String)
    case invalidParameterType(String, String)
    case encodingFailed(String)
    case queryExecutionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidMethod(let method):
            return "Invalid filter method: \(method)"
        case .missingParameter(let param):
            return "Missing required parameter: \(param)"
        case .invalidParameter(let msg):
            return "Invalid parameter: \(msg)"
        case .invalidParameterType(let param, let expected):
            return "Invalid type for parameter '\(param)', expected: \(expected)"
        case .encodingFailed(let msg):
            return "Encoding failed: \(msg)"
        case .queryExecutionFailed(let msg):
            return "Query execution failed: \(msg)"
        }
    }
}

/**
 * Cached Filter Result
 */
struct CachedFilterResult {
    let results: [[String: Any]]
    let count: Int
    let timestamp: Date

    init(results: [[String: Any]], count: Int) {
        self.results = results
        self.count = count
        self.timestamp = Date()
    }
}

/**
 * Filter Performance Monitor
 */
@MainActor
private class FilterPerformanceMonitor {
    private var operations: [String: (startTime: CFAbsoluteTime, method: String)] = [:]
    private var statistics: [String: Double] = [:]
    private var queryCount: Int = 0
    private var totalTime: Double = 0

    func startOperation(method: String, requestId: String) async -> String {
        let operationId = "\(requestId)-\(method)"
        operations[operationId] = (CFAbsoluteTimeGetCurrent(), method)
        return operationId
    }

    func endOperation(_ operationId: String, success: Bool, duration: Double) async {
        operations.removeValue(forKey: operationId)

        queryCount += 1
        totalTime += duration

        // Update method-specific statistics
        let components = operationId.split(separator: "-")
        if components.count > 1 {
            let method = String(components[1])
            let currentAvg = statistics[method] ?? 0
            let currentCount = statistics["\(method)_count"] ?? 0

            statistics[method] = (currentAvg * currentCount + duration) / (currentCount + 1)
            statistics["\(method)_count"] = currentCount + 1
        }

        #if DEBUG
        print("[FilterBridge Performance] \(operationId): \(success ? "SUCCESS" : "FAILED") in \(String(format: "%.2f", duration * 1000))ms")
        #endif
    }

    func getStatistics() async -> (averageQueryTime: Double, totalQueries: Int, commonPatterns: [String]) {
        return (
            averageQueryTime: queryCount > 0 ? totalTime / Double(queryCount) : 0,
            totalQueries: queryCount,
            commonPatterns: Array(statistics.keys.filter { !$0.hasSuffix("_count") })
        )
    }
}

/**
 * Filter Query Cache
 */
@MainActor
private class FilterQueryCache {
    private var cache: [String: CachedFilterResult] = [:]
    private var hitCount: Int = 0
    private var missCount: Int = 0

    func get(key: String) async -> CachedFilterResult? {
        if let cached = cache[key] {
            // Check TTL (5 minutes default)
            if Date().timeIntervalSince(cached.timestamp) < 300 {
                hitCount += 1
                return cached
            } else {
                cache.removeValue(forKey: key)
            }
        }

        missCount += 1
        return nil
    }

    func set(key: String, result: CachedFilterResult, ttl: TimeInterval) async {
        // Implement LRU eviction if cache gets too large
        if cache.count >= 100 {
            // Remove oldest entries
            let sorted = cache.sorted { $0.value.timestamp < $1.value.timestamp }
            for (oldKey, _) in sorted.prefix(20) {
                cache.removeValue(forKey: oldKey)
            }
        }

        cache[key] = result
    }

    func getStatistics() async -> (hitRate: Double, size: Int, averageTTL: Double) {
        let totalRequests = hitCount + missCount
        let hitRate = totalRequests > 0 ? Double(hitCount) / Double(totalRequests) : 0

        return (
            hitRate: hitRate,
            size: cache.count,
            averageTTL: 300 // Fixed 5 minutes for now
        )
    }
}

/**
 * Bridge Logger
 */
private struct BridgeLogger {
    let category: String

    func debug(_ message: String) {
        #if DEBUG
        print("[FilterBridge:\(category)] DEBUG: \(message)")
        #endif
    }

    func info(_ message: String) {
        print("[FilterBridge:\(category)] INFO: \(message)")
    }

    func warning(_ message: String) {
        print("[FilterBridge:\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[FilterBridge:\(category)] ERROR: \(message)")
    }
}