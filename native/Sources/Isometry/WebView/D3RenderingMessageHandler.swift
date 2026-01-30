import Foundation
import WebKit
import os.log

/**
 * D3 Rendering Message Handler
 *
 * Extends WebView bridge for native rendering optimizations
 * Provides real-time optimization parameters for React D3 rendering
 */
@available(iOS 14.0, macOS 11.0, *)
public class D3RenderingMessageHandler: NSObject, WKScriptMessageHandler {

    // MARK: - Types

    public struct OptimizationSettings {
        public let cullingEnabled: Bool
        public let lodLevel: Int
        public let batchSize: Int
        public let memoryStrategy: String
        public let targetFPS: Double
        public let gpuAcceleration: Bool

        public init(
            cullingEnabled: Bool = true,
            lodLevel: Int = 1,
            batchSize: Int = 100,
            memoryStrategy: String = "balanced",
            targetFPS: Double = 60.0,
            gpuAcceleration: Bool = true
        ) {
            self.cullingEnabled = cullingEnabled
            self.lodLevel = lodLevel
            self.batchSize = batchSize
            self.memoryStrategy = memoryStrategy
            self.targetFPS = targetFPS
            self.gpuAcceleration = gpuAcceleration
        }

        public func toDictionary() -> [String: Any] {
            return [
                "cullingEnabled": cullingEnabled,
                "lodLevel": lodLevel,
                "batchSize": batchSize,
                "memoryStrategy": memoryStrategy,
                "targetFPS": targetFPS,
                "gpuAcceleration": gpuAcceleration
            ]
        }
    }

    public struct LODConfiguration {
        public let level: Int
        public let simplificationRatio: Double
        public let renderDistance: Double
        public let elementThreshold: Int

        public init(level: Int, simplificationRatio: Double, renderDistance: Double, elementThreshold: Int) {
            self.level = level
            self.simplificationRatio = simplificationRatio
            self.renderDistance = renderDistance
            self.elementThreshold = elementThreshold
        }

        public func toDictionary() -> [String: Any] {
            return [
                "level": level,
                "simplificationRatio": simplificationRatio,
                "renderDistance": renderDistance,
                "elementThreshold": elementThreshold
            ]
        }
    }

    public struct PerformanceReport {
        public let frameRate: Double
        public let renderTime: Double
        public let memoryUsage: UInt64
        public let culledElements: Int
        public let renderedElements: Int
        public let optimizationsActive: [String]
        public let recommendations: [String]

        public init(
            frameRate: Double,
            renderTime: Double,
            memoryUsage: UInt64,
            culledElements: Int,
            renderedElements: Int,
            optimizationsActive: [String],
            recommendations: [String]
        ) {
            self.frameRate = frameRate
            self.renderTime = renderTime
            self.memoryUsage = memoryUsage
            self.culledElements = culledElements
            self.renderedElements = renderedElements
            self.optimizationsActive = optimizationsActive
            self.recommendations = recommendations
        }

        public func toDictionary() -> [String: Any] {
            return [
                "frameRate": frameRate,
                "renderTime": renderTime,
                "memoryUsage": memoryUsage,
                "culledElements": culledElements,
                "renderedElements": renderedElements,
                "optimizationsActive": optimizationsActive,
                "recommendations": recommendations,
                "timestamp": Date().timeIntervalSince1970,
                "performance60FPS": renderTime < 0.016
            ]
        }
    }

    // MARK: - Properties

    private let renderingOptimizer: RenderingOptimizer
    private let logger = os.Logger(subsystem: "Isometry", category: "D3RenderingMessageHandler")
    private let bridgePerformanceMonitor = BridgePerformanceMonitor()

    // Performance tracking
    private var lastFrameTime: CFAbsoluteTime = 0
    private var frameRateHistory: [Double] = []
    private var renderTimeHistory: [TimeInterval] = []

    // MARK: - Initialization

    public override init() {
        self.renderingOptimizer = RenderingOptimizer(settings: .balanced)
        super.init()

        logger.info("D3RenderingMessageHandler initialized with native optimization")
    }

    // MARK: - WKScriptMessageHandler Protocol

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let tracker = bridgePerformanceMonitor.startOperation("d3rendering.\(message.name)")

        guard let messageBody = message.body as? [String: Any],
              let method = messageBody["method"] as? String,
              let messageId = messageBody["id"] as? String else {
            logger.error("Invalid D3 rendering message format")
            tracker.recordError("Invalid message format")
            return
        }

        tracker.setMessageSize(String(describing: messageBody).count)

        let params = messageBody["params"] as? [String: Any] ?? [:]

        Task { @MainActor in
            do {
                let result = try await processRenderingMessage(method: method, params: params, webView: message.webView)
                tracker.recordSuccess()
                await sendResponse(to: message.webView, requestId: messageId, result: result)
            } catch {
                logger.error("D3 rendering operation failed: \(error.localizedDescription)")
                tracker.recordError(error)
                await sendError(to: message.webView, requestId: messageId, error: error.localizedDescription)
            }
        }
    }

    // MARK: - Message Processing

    private func processRenderingMessage(method: String, params: [String: Any], webView: WKWebView?) async throws -> [String: Any] {
        switch method {
        case "optimizeViewport":
            return try await handleOptimizeViewport(params: params)

        case "updateLOD":
            return try await handleUpdateLOD(params: params)

        case "manageMemory":
            return try await handleManageMemory(params: params)

        case "getBenchmarkResults":
            return try await handleGetBenchmarkResults(params: params)

        case "recordFramePerformance":
            return try await handleRecordFramePerformance(params: params)

        case "getOptimizationRecommendations":
            return try await handleGetOptimizationRecommendations(params: params)

        default:
            throw D3RenderingError.unknownMethod(method)
        }
    }

    // MARK: - Handler Methods

    private func handleOptimizeViewport(params: [String: Any]) async throws -> [String: Any] {
        guard let viewportData = params["viewport"] as? [String: Any],
              let x = viewportData["x"] as? Double,
              let y = viewportData["y"] as? Double,
              let width = viewportData["width"] as? Double,
              let height = viewportData["height"] as? Double,
              let scale = viewportData["scale"] as? Double else {
            throw D3RenderingError.invalidParameters("Invalid viewport data")
        }

        let nodeCount = params["nodeCount"] as? Int ?? 0
        let targetFPS = params["targetFPS"] as? Double ?? 60.0

        let viewport = RenderingOptimizer.Viewport(
            x: x, y: y, width: width, height: height, scale: scale
        )

        let optimizedSettings = await renderingOptimizer.optimizeViewport(
            viewport: viewport,
            nodeCount: nodeCount,
            targetFPS: targetFPS
        )

        let response = OptimizationSettings(
            cullingEnabled: optimizedSettings.cullingEnabled,
            lodLevel: optimizedSettings.lodLevel,
            batchSize: optimizedSettings.batchSize,
            memoryStrategy: optimizedSettings.memoryPoolSize > 50_000_000 ? "performance" : "balanced",
            targetFPS: targetFPS,
            gpuAcceleration: optimizedSettings.useGPUAcceleration
        )

        logger.debug("Optimized viewport: LOD \(optimizedSettings.lodLevel), batch \(optimizedSettings.batchSize)")

        return [
            "success": true,
            "optimizationSettings": response.toDictionary(),
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    private func handleUpdateLOD(params: [String: Any]) async throws -> [String: Any] {
        guard let zoomLevel = params["zoomLevel"] as? Double else {
            throw D3RenderingError.invalidParameters("Missing zoomLevel")
        }

        let nodeCount = params["nodeCount"] as? Int ?? 0

        let lodLevel = await renderingOptimizer.updateLOD(
            zoomLevel: zoomLevel,
            nodeCount: nodeCount
        )

        // Calculate LOD configuration based on level
        let lodConfig = calculateLODConfiguration(level: lodLevel, zoomLevel: zoomLevel, nodeCount: nodeCount)

        logger.debug("Updated LOD to level \(lodLevel) for zoom \(zoomLevel) with \(nodeCount) nodes")

        return [
            "success": true,
            "lodConfiguration": lodConfig.toDictionary(),
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    private func handleManageMemory(params: [String: Any]) async throws -> [String: Any] {
        guard let memoryUsage = params["memoryUsage"] as? UInt64 else {
            throw D3RenderingError.invalidParameters("Missing memoryUsage")
        }

        let leakDetected = params["leakDetected"] as? Bool ?? false

        let memoryStrategy = await renderingOptimizer.manageMemory(
            memoryUsage: memoryUsage,
            leakDetected: leakDetected
        )

        logger.debug("Memory management strategy: \(memoryStrategy)")

        return [
            "success": true,
            "memoryStrategy": memoryStrategy,
            "recommendations": generateMemoryRecommendations(strategy: memoryStrategy),
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    private func handleGetBenchmarkResults(params: [String: Any]) async throws -> [String: Any] {
        let metrics = await renderingOptimizer.getBenchmarkResults()

        let performanceReport = PerformanceReport(
            frameRate: metrics.frameRate,
            renderTime: metrics.renderTime,
            memoryUsage: metrics.memoryUsage,
            culledElements: metrics.culledElements,
            renderedElements: metrics.renderedElements,
            optimizationsActive: getActiveOptimizations(),
            recommendations: generatePerformanceRecommendations(metrics: metrics)
        )

        logger.debug("Performance report: \(metrics.frameRate) FPS, \(metrics.renderTime * 1000) ms render time")

        return [
            "success": true,
            "performanceReport": performanceReport.toDictionary(),
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    private func handleRecordFramePerformance(params: [String: Any]) async throws -> [String: Any] {
        guard let renderTime = params["renderTime"] as? TimeInterval else {
            throw D3RenderingError.invalidParameters("Missing renderTime")
        }

        await renderingOptimizer.recordFramePerformance(renderTime: renderTime)

        // Update local frame rate tracking
        let currentTime = CFAbsoluteTimeGetCurrent()
        if lastFrameTime > 0 {
            let frameInterval = currentTime - lastFrameTime
            let fps = 1.0 / frameInterval
            frameRateHistory.append(fps)

            // Keep last 60 frames (1 second at 60fps)
            if frameRateHistory.count > 60 {
                frameRateHistory.removeFirst()
            }
        }
        lastFrameTime = currentTime

        renderTimeHistory.append(renderTime)
        if renderTimeHistory.count > 30 {
            renderTimeHistory.removeFirst()
        }

        let averageFPS = frameRateHistory.isEmpty ? 0 : frameRateHistory.reduce(0, +) / Double(frameRateHistory.count)
        let averageRenderTime = renderTimeHistory.isEmpty ? 0 : renderTimeHistory.reduce(0, +) / Double(renderTimeHistory.count)

        return [
            "success": true,
            "averageFPS": averageFPS,
            "averageRenderTime": averageRenderTime,
            "performance60FPS": renderTime < 0.016,
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    private func handleGetOptimizationRecommendations(params: [String: Any]) async throws -> [String: Any] {
        let metrics = await renderingOptimizer.getBenchmarkResults()
        let recommendations = generateDetailedRecommendations(metrics: metrics)

        return [
            "success": true,
            "recommendations": recommendations,
            "priority": categorizePriority(recommendations: recommendations),
            "timestamp": Date().timeIntervalSince1970
        ]
    }

    // MARK: - Helper Methods

    private func calculateLODConfiguration(level: Int, zoomLevel: Double, nodeCount: Int) -> LODConfiguration {
        let simplificationRatio: Double
        let renderDistance: Double
        let elementThreshold: Int

        switch level {
        case 0: // Highest quality
            simplificationRatio = 1.0
            renderDistance = 1.5
            elementThreshold = nodeCount

        case 1: // Balanced
            simplificationRatio = 0.75
            renderDistance = 1.2
            elementThreshold = min(nodeCount, 1000)

        case 2: // Performance
            simplificationRatio = 0.5
            renderDistance = 1.0
            elementThreshold = min(nodeCount, 500)

        case 3: // Maximum performance
            simplificationRatio = 0.25
            renderDistance = 0.8
            elementThreshold = min(nodeCount, 250)

        default:
            simplificationRatio = 0.75
            renderDistance = 1.2
            elementThreshold = min(nodeCount, 1000)
        }

        return LODConfiguration(
            level: level,
            simplificationRatio: simplificationRatio,
            renderDistance: renderDistance * zoomLevel,
            elementThreshold: elementThreshold
        )
    }

    private func generateMemoryRecommendations(strategy: String) -> [String] {
        switch strategy {
        case "aggressive":
            return [
                "Memory leak detected - reduce object retention",
                "Consider batch processing for large datasets",
                "Enable viewport culling to reduce active elements"
            ]
        case "conservative":
            return [
                "High memory usage - optimize data structures",
                "Consider increasing LOD level to reduce detail",
                "Monitor for memory pressure trends"
            ]
        case "balanced":
            return [
                "Memory usage is elevated but manageable",
                "Consider periodic garbage collection triggers"
            ]
        default:
            return ["Memory usage is optimal"]
        }
    }

    private func generatePerformanceRecommendations(metrics: RenderingOptimizer.RenderingMetrics) -> [String] {
        var recommendations: [String] = []

        if !metrics.performance60FPS {
            recommendations.append("Frame time exceeds 16ms target - consider performance optimizations")
        }

        if metrics.cullRatio < 0.3 {
            recommendations.append("Low culling ratio - increase viewport culling aggressiveness")
        }

        if metrics.memoryUsage > 100_000_000 { // > 100MB
            recommendations.append("High memory usage - consider memory optimization strategies")
        }

        if metrics.lodLevel < 2 && metrics.renderedElements > 1000 {
            recommendations.append("Consider increasing LOD level for large datasets")
        }

        if recommendations.isEmpty {
            recommendations.append("Performance is optimal")
        }

        return recommendations
    }

    private func generateDetailedRecommendations(metrics: RenderingOptimizer.RenderingMetrics) -> [String] {
        var recommendations = generatePerformanceRecommendations(metrics: metrics)

        // Add technical recommendations
        if metrics.gpuUtilization < 0.5 {
            recommendations.append("GPU underutilized - consider GPU-accelerated operations")
        }

        if frameRateHistory.count > 10 {
            let variance = calculateVariance(values: frameRateHistory)
            if variance > 100 { // High FPS variance
                recommendations.append("Frame rate inconsistency detected - investigate frame pacing")
            }
        }

        return recommendations
    }

    private func getActiveOptimizations() -> [String] {
        var optimizations: [String] = []

        // Would need to query current optimization state from RenderingOptimizer
        optimizations.append("ViewportCulling")
        optimizations.append("LODManagement")
        optimizations.append("MemoryPooling")

        return optimizations
    }

    private func categorizePriority(recommendations: [String]) -> String {
        for recommendation in recommendations {
            if recommendation.contains("exceeds") || recommendation.contains("leak") {
                return "high"
            }
        }

        if recommendations.count > 2 {
            return "medium"
        }

        return "low"
    }

    private func calculateVariance(values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }

        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.map { pow($0 - mean, 2) }.reduce(0, +) / Double(values.count)
        return variance
    }

    // MARK: - Response Helpers

    @MainActor
    private func sendResponse(to webView: WKWebView?, requestId: String, result: [String: Any]) async {
        guard let webView = webView else { return }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: result, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

            let script = "window.resolveWebViewRequest('\(requestId)', \(jsonString))"
            _ = try? await webView.evaluateJavaScript(script)
        } catch {
            logger.error("Failed to send D3 rendering response: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func sendError(to webView: WKWebView?, requestId: String, error: String) async {
        guard let webView = webView else { return }

        let script = "window.resolveWebViewRequest('\(requestId)', null, '\(error)')"
        _ = try? await webView.evaluateJavaScript(script)
    }
}

// MARK: - Error Types

public enum D3RenderingError: Error, LocalizedError {
    case unknownMethod(String)
    case invalidParameters(String)
    case optimizationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .unknownMethod(let method):
            return "Unknown D3 rendering method: \(method)"
        case .invalidParameters(let message):
            return "Invalid parameters: \(message)"
        case .optimizationFailed(let message):
            return "Optimization failed: \(message)"
        }
    }
}