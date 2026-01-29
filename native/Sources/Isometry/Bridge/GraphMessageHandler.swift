import Foundation
import WebKit
import GRDB

/// Graph analytics WebView message handler for bridging React graph views to native ConnectionSuggestionEngine
/// Enables real-time connection suggestions, graph metrics, and query optimization
public class GraphMessageHandler: NSObject, WKScriptMessageHandler {
    // MARK: - Dependencies

    private let database: IsometryDatabase
    private let connectionEngine: ConnectionSuggestionEngine
    private let queryCache: QueryCache
    private let performanceMonitor: RenderingPerformanceMonitor?
    private let logger = GraphAnalyticsLogger()

    // MARK: - Performance Tracking

    private let perfMonitor = GraphPerformanceMonitor()

    // MARK: - Message Ordering

    private var lastSequenceId: UInt64 = 0
    private let sequenceLock = NSLock()

    // MARK: - Suggestion Caching

    private var localCache: [String: CachedSuggestion] = [:]
    private let cacheTimeout: TimeInterval = 300 // 5 minutes
    private let cacheLock = NSLock()

    // MARK: - Initialization

    public init(
        database: IsometryDatabase,
        connectionEngine: ConnectionSuggestionEngine,
        queryCache: QueryCache,
        performanceMonitor: RenderingPerformanceMonitor? = nil
    ) {
        self.database = database
        self.connectionEngine = connectionEngine
        self.queryCache = queryCache
        self.performanceMonitor = performanceMonitor
        super.init()
        logger.info("GraphMessageHandler initialized with connection engine and query cache")
    }

    // MARK: - WKScriptMessageHandler

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let messageStartTime = CFAbsoluteTimeGetCurrent()
        let messageId = perfMonitor.startMessageProcessing()

        defer {
            perfMonitor.endMessageProcessing(messageId, startTime: messageStartTime)
        }

        // Parse message with type safety
        guard let messageData = parseMessage(message) else {
            logger.error("Failed to parse graph analytics message")
            sendError(to: message.webView, requestId: nil, error: "Invalid message format")
            return
        }

        // Sequence ID validation for ordering
        if !validateSequenceId(messageData.sequenceId) {
            logger.warning("Out-of-order message received. Current: \(lastSequenceId), Received: \(messageData.sequenceId)")
            // Still process, but log the ordering issue
        }

        // Route message based on method
        Task {
            await handleGraphAnalyticsMessage(messageData, webView: message.webView)
        }
    }

    // MARK: - Message Parsing

    private func parseMessage(_ message: WKScriptMessage) -> GraphAnalyticsMessage? {
        guard let messageBody = message.body as? [String: Any],
              let messageId = messageBody["id"] as? String,
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any] else {
            return nil
        }

        // Extract sequence ID (default to 0 if missing)
        let sequenceId = params["sequenceId"] as? UInt64 ?? 0

        return GraphAnalyticsMessage(
            id: messageId,
            method: method,
            params: params,
            sequenceId: sequenceId
        )
    }

    // MARK: - Message Processing

    @MainActor
    private func handleGraphAnalyticsMessage(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        do {
            switch messageData.method {
            case "suggestConnections":
                await handleSuggestConnections(messageData, webView: webView)

            case "batchSuggestConnections":
                await handleBatchSuggestConnections(messageData, webView: webView)

            case "getGraphMetrics":
                await handleGetGraphMetrics(messageData, webView: webView)

            case "getCacheStats":
                await handleGetCacheStats(messageData, webView: webView)

            case "runGraphQuery":
                await handleRunGraphQuery(messageData, webView: webView)

            default:
                logger.warning("Unknown graph analytics method: \(messageData.method)")
                sendError(to: webView, requestId: messageData.id, error: "Unknown method: \(messageData.method)")
            }
        } catch {
            logger.error("Error processing graph analytics message: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: error.localizedDescription)
        }
    }

    // MARK: - Connection Suggestion Handlers

    @MainActor
    private func handleSuggestConnections(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        let handlerId = perfMonitor.startSuggestionComputation()
        defer { perfMonitor.endSuggestionComputation(handlerId) }

        do {
            // Parse parameters
            guard let nodeId = messageData.params["nodeId"] as? String else {
                throw GraphAnalyticsError.invalidNodeId
            }

            let suggestionOptions = try parseSuggestionOptions(from: messageData.params["options"] as? [String: Any])

            // Check local cache first
            if let cached = getCachedSuggestions(nodeId: nodeId, options: suggestionOptions) {
                sendSuccess(to: webView, requestId: messageData.id, result: [
                    "suggestions": cached.suggestions.map(convertConnectionSuggestionToJSON),
                    "cached": true,
                    "computeTime": 0.0
                ])
                logger.debug("Returned cached suggestions for node: \(nodeId)")
                return
            }

            // Compute suggestions via ConnectionSuggestionEngine
            let startTime = CFAbsoluteTimeGetCurrent()
            let suggestions = try await connectionEngine.suggestConnections(for: nodeId, options: suggestionOptions)
            let computeTime = CFAbsoluteTimeGetCurrent() - startTime

            // Cache results
            cacheSuggestions(nodeId: nodeId, options: suggestionOptions, suggestions: suggestions)

            // Track graph analytics latency in performance monitor
            await recordAnalyticsLatency(computeTime)

            sendSuccess(to: webView, requestId: messageData.id, result: [
                "suggestions": suggestions.map(convertConnectionSuggestionToJSON),
                "cached": false,
                "computeTime": computeTime
            ])

            logger.debug("Generated \(suggestions.count) suggestions for node \(nodeId) in \(String(format: "%.2fms", computeTime * 1000))")

        } catch {
            logger.error("Failed to process connection suggestions: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Connection suggestion failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleBatchSuggestConnections(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        let handlerId = perfMonitor.startBatchSuggestionComputation()
        defer { perfMonitor.endBatchSuggestionComputation(handlerId) }

        do {
            // Parse parameters
            guard let nodeIds = messageData.params["nodeIds"] as? [String] else {
                throw GraphAnalyticsError.invalidNodeIds
            }

            let suggestionOptions = try parseSuggestionOptions(from: messageData.params["options"] as? [String: Any])

            // Compute batch suggestions
            let startTime = CFAbsoluteTimeGetCurrent()
            let batchResults = try await connectionEngine.batchSuggestConnections(for: nodeIds, options: suggestionOptions)
            let computeTime = CFAbsoluteTimeGetCurrent() - startTime

            // Convert to JSON format
            var jsonResults: [String: [[String: Any]]] = [:]
            for (nodeId, suggestions) in batchResults {
                jsonResults[nodeId] = suggestions.map(convertConnectionSuggestionToJSON)
                // Cache individual results
                cacheSuggestions(nodeId: nodeId, options: suggestionOptions, suggestions: suggestions)
            }

            // Track performance
            await recordAnalyticsLatency(computeTime)

            sendSuccess(to: webView, requestId: messageData.id, result: [
                "batchResults": jsonResults,
                "nodeCount": nodeIds.count,
                "computeTime": computeTime
            ])

            logger.debug("Generated batch suggestions for \(nodeIds.count) nodes in \(String(format: "%.2fms", computeTime * 1000))")

        } catch {
            logger.error("Failed to process batch connection suggestions: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Batch suggestion failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Graph Analytics Handlers

    @MainActor
    private func handleGetGraphMetrics(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        let handlerId = perfMonitor.startMetricsComputation()
        defer { perfMonitor.endMetricsComputation(handlerId) }

        do {
            // Get metrics from ConnectionSuggestionEngine
            let startTime = CFAbsoluteTimeGetCurrent()
            let metrics = try await connectionEngine.getSuggestionMetrics()
            let computeTime = CFAbsoluteTimeGetCurrent() - startTime

            let jsonMetrics = [
                "totalNodes": metrics.totalNodes,
                "totalEdges": metrics.totalEdges,
                "averageTagsPerNode": metrics.averageTagsPerNode,
                "graphDensity": metrics.graphDensity,
                "computeTime": computeTime
            ] as [String : Any]

            sendSuccess(to: webView, requestId: messageData.id, result: jsonMetrics)

            logger.debug("Retrieved graph metrics in \(String(format: "%.2fms", computeTime * 1000))")

        } catch {
            logger.error("Failed to get graph metrics: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Graph metrics failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleGetCacheStats(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        let handlerId = perfMonitor.startCacheStatsComputation()
        defer { perfMonitor.endCacheStatsComputation(handlerId) }

        do {
            // Get cache statistics
            let cacheStats = await queryCache.getStats()

            let jsonStats = [
                "totalEntries": cacheStats.totalEntries,
                "validEntries": cacheStats.validEntries,
                "expiredEntries": cacheStats.expiredEntries,
                "hitRate": cacheStats.hitRate,
                "estimatedMemoryMB": cacheStats.estimatedMemoryMB
            ] as [String : Any]

            sendSuccess(to: webView, requestId: messageData.id, result: jsonStats)

            logger.debug("Retrieved cache stats: \(cacheStats.validEntries)/\(cacheStats.totalEntries) entries, \(String(format: "%.1fMB", cacheStats.estimatedMemoryMB))")

        } catch {
            logger.error("Failed to get cache stats: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Cache stats failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleRunGraphQuery(_ messageData: GraphAnalyticsMessage, webView: WKWebView?) async {
        let handlerId = perfMonitor.startGraphQueryComputation()
        defer { perfMonitor.endGraphQueryComputation(handlerId) }

        do {
            // Parse parameters
            guard let queryType = messageData.params["queryType"] as? String,
                  let parameters = messageData.params["parameters"] as? [String: Any] else {
                throw GraphAnalyticsError.invalidQueryParameters
            }

            // Use QueryCache for computation with caching
            let cacheKey = QueryCache.createKey(queryName: "graphQuery_\(queryType)", parameters: parameters)

            let startTime = CFAbsoluteTimeGetCurrent()
            let result = try await queryCache.getOrCompute(key: cacheKey, ttl: 600) { // 10 minute cache
                return try await executeGraphQuery(queryType: queryType, parameters: parameters)
            }
            let computeTime = CFAbsoluteTimeGetCurrent() - startTime

            sendSuccess(to: webView, requestId: messageData.id, result: [
                "queryType": queryType,
                "result": result,
                "computeTime": computeTime,
                "cached": computeTime < 0.001 // Very fast indicates cache hit
            ])

            logger.debug("Executed graph query \(queryType) in \(String(format: "%.2fms", computeTime * 1000))")

        } catch {
            logger.error("Failed to execute graph query: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Graph query failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Helper Methods

    private func parseSuggestionOptions(from optionsData: [String: Any]?) -> SuggestionOptions {
        let maxSuggestions = optionsData?["maxSuggestions"] as? Int ?? 10
        let minConfidence = optionsData?["minConfidence"] as? Double ?? 0.3
        let excludeExisting = optionsData?["excludeExistingConnections"] as? Bool ?? true

        // Parse includeTypes
        var includeTypes = ConnectionSuggestion.SuggestionType.allCases
        if let typeStrings = optionsData?["includeTypes"] as? [String] {
            includeTypes = typeStrings.compactMap { ConnectionSuggestion.SuggestionType(rawValue: $0) }
            if includeTypes.isEmpty {
                includeTypes = ConnectionSuggestion.SuggestionType.allCases
            }
        }

        return SuggestionOptions(
            maxSuggestions: max(1, min(maxSuggestions, 50)),
            minConfidence: max(0.0, min(minConfidence, 1.0)),
            includeTypes: includeTypes,
            excludeExistingConnections: excludeExisting
        )
    }

    private func convertConnectionSuggestionToJSON(_ suggestion: ConnectionSuggestion) -> [String: Any] {
        return [
            "id": suggestion.id.uuidString,
            "nodeId": suggestion.nodeId,
            "reason": suggestion.reason,
            "confidence": suggestion.confidence,
            "type": suggestion.type.rawValue
        ]
    }

    private func executeGraphQuery(queryType: String, parameters: [String: Any]) async throws -> [String: Any] {
        // Execute different types of graph queries
        switch queryType {
        case "shortestPath":
            guard let sourceId = parameters["sourceId"] as? String,
                  let targetId = parameters["targetId"] as? String else {
                throw GraphAnalyticsError.invalidQueryParameters
            }
            return try await computeShortestPath(from: sourceId, to: targetId)

        case "centralityAnalysis":
            guard let nodeId = parameters["nodeId"] as? String else {
                throw GraphAnalyticsError.invalidQueryParameters
            }
            return try await computeCentralityAnalysis(for: nodeId)

        case "clusterAnalysis":
            let depth = parameters["depth"] as? Int ?? 2
            return try await computeClusterAnalysis(depth: depth)

        default:
            throw GraphAnalyticsError.unknownQueryType
        }
    }

    private func computeShortestPath(from sourceId: String, to targetId: String) async throws -> [String: Any] {
        // Basic shortest path query using CTEs
        let query = """
        WITH RECURSIVE shortest_path AS (
            SELECT target_id as node_id, 1 as distance, source_id || '->' || target_id as path
            FROM edges
            WHERE source_id = ? AND deleted_at IS NULL

            UNION

            SELECT e.target_id, sp.distance + 1, sp.path || '->' || e.target_id
            FROM edges e
            JOIN shortest_path sp ON e.source_id = sp.node_id
            WHERE sp.distance < 6 AND e.deleted_at IS NULL
              AND sp.path NOT LIKE '%' || e.target_id || '%'
        )
        SELECT node_id, MIN(distance) as distance, path
        FROM shortest_path
        WHERE node_id = ?
        GROUP BY node_id
        ORDER BY distance
        LIMIT 1
        """

        return try await database.read { db in
            let row = try Row.fetchOne(db, sql: query, arguments: [sourceId, targetId])
            return [
                "sourceId": sourceId,
                "targetId": targetId,
                "distance": row?["distance"] as? Int ?? -1,
                "path": row?["path"] as? String ?? ""
            ]
        }
    }

    private func computeCentralityAnalysis(for nodeId: String) async throws -> [String: Any] {
        // Compute degree centrality and betweenness estimation
        let query = """
        SELECT
            (SELECT COUNT(*) FROM edges WHERE source_id = ? OR target_id = ? AND deleted_at IS NULL) as degree,
            (SELECT COUNT(DISTINCT source_id) FROM edges WHERE deleted_at IS NULL) as total_nodes,
            ? as node_id
        """

        return try await database.read { db in
            let row = try Row.fetchOne(db, sql: query, arguments: [nodeId, nodeId, nodeId])
            let degree = row?["degree"] as? Int ?? 0
            let totalNodes = row?["total_nodes"] as? Int ?? 1

            return [
                "nodeId": nodeId,
                "degreeCentrality": totalNodes > 1 ? Double(degree) / Double(totalNodes - 1) : 0.0,
                "degree": degree,
                "totalNodes": totalNodes
            ]
        }
    }

    private func computeClusterAnalysis(depth: Int) async throws -> [String: Any] {
        // Basic clustering coefficient computation
        let query = """
        WITH node_neighbors AS (
            SELECT DISTINCT
                n1.id as node_id,
                CASE WHEN e.source_id = n1.id THEN e.target_id ELSE e.source_id END as neighbor_id
            FROM nodes n1
            JOIN edges e ON (e.source_id = n1.id OR e.target_id = n1.id)
            WHERE n1.deleted_at IS NULL AND e.deleted_at IS NULL
        ),
        neighbor_pairs AS (
            SELECT DISTINCT
                n1.node_id,
                n1.neighbor_id as neighbor1,
                n2.neighbor_id as neighbor2
            FROM node_neighbors n1
            JOIN node_neighbors n2 ON n1.node_id = n2.node_id AND n1.neighbor_id < n2.neighbor_id
        ),
        connected_neighbors AS (
            SELECT np.node_id, COUNT(*) as connected_pairs
            FROM neighbor_pairs np
            JOIN edges e ON (
                (e.source_id = np.neighbor1 AND e.target_id = np.neighbor2) OR
                (e.source_id = np.neighbor2 AND e.target_id = np.neighbor1)
            )
            WHERE e.deleted_at IS NULL
            GROUP BY np.node_id
        )
        SELECT AVG(
            CASE
                WHEN total_pairs > 0 THEN CAST(connected_pairs AS REAL) / total_pairs
                ELSE 0.0
            END
        ) as avg_clustering_coefficient
        FROM (
            SELECT
                np.node_id,
                COUNT(*) as total_pairs,
                COALESCE(cn.connected_pairs, 0) as connected_pairs
            FROM neighbor_pairs np
            LEFT JOIN connected_neighbors cn ON np.node_id = cn.node_id
            GROUP BY np.node_id
        )
        """

        return try await database.read { db in
            let row = try Row.fetchOne(db, sql: query)
            return [
                "averageClusteringCoefficient": row?["avg_clustering_coefficient"] as? Double ?? 0.0,
                "analysisDepth": depth
            ]
        }
    }

    // MARK: - Local Caching

    private func getCachedSuggestions(nodeId: String, options: SuggestionOptions) -> CachedSuggestion? {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        let cacheKey = createCacheKey(nodeId: nodeId, options: options)
        guard let cached = localCache[cacheKey],
              Date().timeIntervalSince(cached.timestamp) < cacheTimeout else {
            return nil
        }

        return cached
    }

    private func cacheSuggestions(nodeId: String, options: SuggestionOptions, suggestions: [ConnectionSuggestion]) {
        cacheLock.lock()
        defer { cacheLock.unlock() }

        let cacheKey = createCacheKey(nodeId: nodeId, options: options)
        localCache[cacheKey] = CachedSuggestion(suggestions: suggestions, timestamp: Date())

        // Cleanup expired entries periodically
        if localCache.count > 100 {
            cleanupExpiredCache()
        }
    }

    private func createCacheKey(nodeId: String, options: SuggestionOptions) -> String {
        let typesString = options.includeTypes.map(\.rawValue).sorted().joined(separator: ",")
        return "\(nodeId)_\(options.maxSuggestions)_\(options.minConfidence)_\(typesString)_\(options.excludeExistingConnections)"
    }

    private func cleanupExpiredCache() {
        let cutoff = Date().addingTimeInterval(-cacheTimeout)
        localCache = localCache.filter { $1.timestamp > cutoff }
    }

    // MARK: - Performance Integration

    private func recordAnalyticsLatency(_ latency: TimeInterval) async {
        // Record graph analytics latency in RenderingPerformanceMonitor if available
        await performanceMonitor?.recordGraphAnalyticsLatency(latency)
        perfMonitor.recordSuggestionComputeTime(latency)
    }

    // MARK: - Sequence ID Validation

    private func validateSequenceId(_ sequenceId: UInt64) -> Bool {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }

        if sequenceId > lastSequenceId {
            lastSequenceId = sequenceId
            return true
        }

        return false
    }

    // MARK: - Response Helpers

    private func sendSuccess(to webView: WKWebView?, requestId: String, result: [String: Any]) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result
        ]

        sendJSResponse(to: webView, response: response)
    }

    private func sendError(to webView: WKWebView?, requestId: String?, error: String) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        sendJSResponse(to: webView, response: response)
    }

    private func sendJSResponse(to webView: WKWebView, response: [String: Any]) {
        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryGraphBridge?.handleResponse(\(responseString))"

            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { [weak self] _, error in
                    if let error = error {
                        self?.logger.error("Failed to send graph bridge response: \(error)")
                    }
                }
            }
        } catch {
            logger.error("Failed to serialize graph bridge response: \(error)")
        }
    }

    // MARK: - Performance Statistics

    public var performanceStats: GraphPerformanceStats {
        return perfMonitor.getStats()
    }
}

// MARK: - Supporting Types

struct GraphAnalyticsMessage {
    let id: String
    let method: String
    let params: [String: Any]
    let sequenceId: UInt64
}

struct GraphCommand {
    let nodeId: String
    let queryType: String
    let options: [String: Any]

    init(nodeId: String, queryType: String, options: [String: Any] = [:]) {
        self.nodeId = nodeId
        self.queryType = queryType
        self.options = options
    }
}

struct CachedSuggestion {
    let suggestions: [ConnectionSuggestion]
    let timestamp: Date
}

// MARK: - Graph Analytics Errors

enum GraphAnalyticsError: Error, LocalizedError {
    case invalidNodeId
    case invalidNodeIds
    case invalidQueryParameters
    case unknownQueryType
    case engineUnavailable
    case cacheError
    case queryTimeout

    var errorDescription: String? {
        switch self {
        case .invalidNodeId:
            return "Invalid or missing node ID"
        case .invalidNodeIds:
            return "Invalid or empty node ID list"
        case .invalidQueryParameters:
            return "Invalid query parameters"
        case .unknownQueryType:
            return "Unknown graph query type"
        case .engineUnavailable:
            return "Graph analytics engine is not available"
        case .cacheError:
            return "Query cache error"
        case .queryTimeout:
            return "Graph query timed out"
        }
    }
}

// MARK: - Performance Monitoring

class GraphPerformanceMonitor {
    private var messageCount: Int64 = 0
    private var totalMessageTime: TimeInterval = 0
    private var suggestionComputations: Int64 = 0
    private var batchComputations: Int64 = 0
    private var metricsComputations: Int64 = 0
    private var cacheStatsComputations: Int64 = 0
    private var graphQueryComputations: Int64 = 0
    private var totalSuggestionComputeTime: TimeInterval = 0

    private let performanceQueue = DispatchQueue(label: "graph-perf", qos: .utility)
    private let lock = NSLock()

    func startMessageProcessing() -> UUID {
        return UUID()
    }

    func endMessageProcessing(_ id: UUID, startTime: CFAbsoluteTime) {
        let duration = CFAbsoluteTimeGetCurrent() - startTime

        lock.lock()
        messageCount += 1
        totalMessageTime += duration
        lock.unlock()
    }

    func startSuggestionComputation() -> UUID {
        lock.lock()
        suggestionComputations += 1
        lock.unlock()
        return UUID()
    }

    func endSuggestionComputation(_ id: UUID) {}

    func startBatchSuggestionComputation() -> UUID {
        lock.lock()
        batchComputations += 1
        lock.unlock()
        return UUID()
    }

    func endBatchSuggestionComputation(_ id: UUID) {}

    func startMetricsComputation() -> UUID {
        lock.lock()
        metricsComputations += 1
        lock.unlock()
        return UUID()
    }

    func endMetricsComputation(_ id: UUID) {}

    func startCacheStatsComputation() -> UUID {
        lock.lock()
        cacheStatsComputations += 1
        lock.unlock()
        return UUID()
    }

    func endCacheStatsComputation(_ id: UUID) {}

    func startGraphQueryComputation() -> UUID {
        lock.lock()
        graphQueryComputations += 1
        lock.unlock()
        return UUID()
    }

    func endGraphQueryComputation(_ id: UUID) {}

    func recordSuggestionComputeTime(_ time: TimeInterval) {
        lock.lock()
        totalSuggestionComputeTime += time
        lock.unlock()
    }

    func getStats() -> GraphPerformanceStats {
        lock.lock()
        defer { lock.unlock() }

        let avgMessageTime = messageCount > 0 ? totalMessageTime / TimeInterval(messageCount) : 0
        let avgSuggestionTime = suggestionComputations > 0 ? totalSuggestionComputeTime / TimeInterval(suggestionComputations) : 0

        return GraphPerformanceStats(
            messageCount: messageCount,
            averageMessageTime: avgMessageTime,
            suggestionComputations: suggestionComputations,
            batchComputations: batchComputations,
            metricsComputations: metricsComputations,
            cacheStatsComputations: cacheStatsComputations,
            graphQueryComputations: graphQueryComputations,
            averageSuggestionComputeTime: avgSuggestionTime
        )
    }
}

public struct GraphPerformanceStats {
    let messageCount: Int64
    let averageMessageTime: TimeInterval
    let suggestionComputations: Int64
    let batchComputations: Int64
    let metricsComputations: Int64
    let cacheStatsComputations: Int64
    let graphQueryComputations: Int64
    let averageSuggestionComputeTime: TimeInterval
}

// MARK: - Logging

struct GraphAnalyticsLogger {
    private let subsystem = "IsometryGraphAnalytics"
    private let category = "Bridge"

    func debug(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] DEBUG: \(message)")
        #endif
    }

    func info(_ message: String) {
        print("[\(subsystem):\(category)] INFO: \(message)")
    }

    func warning(_ message: String) {
        print("[\(subsystem):\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}

// MARK: - Extension for RenderingPerformanceMonitor

extension RenderingPerformanceMonitor {
    /// Record graph analytics latency for performance monitoring
    func recordGraphAnalyticsLatency(_ latency: TimeInterval) async {
        // Implementation would be added to RenderingPerformanceMonitor to track graph operations
        // For now, just log the latency
        print("Graph analytics latency: \(String(format: "%.2fms", latency * 1000))")
    }
}