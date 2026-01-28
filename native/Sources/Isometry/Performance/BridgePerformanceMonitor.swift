import Foundation
import os.log
import WebKit

/// Monitors and tracks WebView bridge performance on the native side
/// Provides comprehensive metrics for bridge operation optimization
public class BridgePerformanceMonitor {

    // MARK: - Types

    public struct PerformanceMetric {
        public let operation: String
        public let duration: TimeInterval
        public let timestamp: Date
        public let messageSize: Int?
        public let success: Bool
        public let error: String?

        public init(
            operation: String,
            duration: TimeInterval,
            timestamp: Date = Date(),
            messageSize: Int? = nil,
            success: Bool,
            error: String? = nil
        ) {
            self.operation = operation
            self.duration = duration
            self.timestamp = timestamp
            self.messageSize = messageSize
            self.success = success
            self.error = error
        }
    }

    public struct PerformanceReport {
        public let totalOperations: Int
        public let averageDuration: TimeInterval
        public let successRate: Double
        public let throughput: Double // operations per second
        public let memoryUsage: UInt64 // bytes
        public let slowestOperations: [PerformanceMetric]
        public let recommendations: [String]
        public let generatedAt: Date

        public init(
            totalOperations: Int,
            averageDuration: TimeInterval,
            successRate: Double,
            throughput: Double,
            memoryUsage: UInt64,
            slowestOperations: [PerformanceMetric],
            recommendations: [String]
        ) {
            self.totalOperations = totalOperations
            self.averageDuration = averageDuration
            self.successRate = successRate
            self.throughput = throughput
            self.memoryUsage = memoryUsage
            self.slowestOperations = slowestOperations
            self.recommendations = recommendations
            self.generatedAt = Date()
        }
    }

    public struct BridgeLatencyTargets {
        public static let messageHandlerLatency: TimeInterval = 0.010  // 10ms
        public static let databaseOperationLatency: TimeInterval = 0.050  // 50ms
        public static let syncNotificationLatency: TimeInterval = 0.100  // 100ms
        public static let largeDataTransferLatency: TimeInterval = 0.500  // 500ms
    }

    // MARK: - Properties

    private var metrics: [PerformanceMetric] = []
    private let metricsQueue = DispatchQueue(label: "BridgePerformanceMonitor", qos: .background)
    private let maxMetrics = 1000 // Limit memory usage
    private let logger = Logger(subsystem: "Isometry", category: "BridgePerformance")

    // Configuration
    public var isEnabled = true
    public var enableDetailedLogging = false

    // Memory tracking
    private var initialMemoryFootprint: UInt64 = 0

    // MARK: - Initialization

    public init() {
        initialMemoryFootprint = getCurrentMemoryUsage()
        logger.debug("BridgePerformanceMonitor initialized. Initial memory: \(self.initialMemoryFootprint) bytes")
    }

    // MARK: - Public API

    /// Start monitoring a bridge operation
    public func startOperation(_ operation: String) -> BridgeOperationTracker {
        return BridgeOperationTracker(operation: operation, monitor: self)
    }

    /// Record a completed operation
    public func recordOperation(
        _ operation: String,
        duration: TimeInterval,
        messageSize: Int? = nil,
        success: Bool,
        error: String? = nil
    ) {
        guard isEnabled else { return }

        let metric = PerformanceMetric(
            operation: operation,
            duration: duration,
            messageSize: messageSize,
            success: success,
            error: error
        )

        metricsQueue.async { [weak self] in
            self?.addMetric(metric)
        }

        if enableDetailedLogging {
            logger.debug("Bridge operation: \(operation), duration: \(String(format: "%.2f", duration * 1000))ms, success: \(success)")
        }

        // Log slow operations
        if duration > BridgeLatencyTargets.databaseOperationLatency {
            logger.warning("Slow bridge operation: \(operation) took \(duration * 1000, specifier: "%.2f")ms")
        }
    }

    /// Track MessageHandler processing time
    public func trackMessageHandler<T>(
        handler: String,
        messageSize: Int,
        operation: @escaping () async throws -> T
    ) async -> T? {
        let tracker = startOperation("messageHandler.\(handler)")
        tracker.setMessageSize(messageSize)

        do {
            let result = try await operation()
            tracker.recordSuccess()
            return result
        } catch {
            tracker.recordError(error)
            return nil
        }
    }

    /// Track database operation latency
    public func trackDatabaseOperation<T>(
        operation: String,
        execution: @escaping () async throws -> T
    ) async -> T? {
        let tracker = startOperation("database.\(operation)")

        do {
            let result = try await execution()
            tracker.recordSuccess()
            return result
        } catch {
            tracker.recordError(error)
            return nil
        }
    }

    /// Measure WebView JavaScript evaluation performance
    public func trackJavaScriptEvaluation(
        script: String,
        webView: WKWebView
    ) async -> Any? {
        let tracker = startOperation("javascript.evaluation")
        tracker.setMessageSize(script.utf8.count)

        return await withCheckedContinuation { continuation in
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    tracker.recordError(error)
                    continuation.resume(returning: nil)
                } else {
                    tracker.recordSuccess()
                    continuation.resume(returning: result)
                }
            }
        }
    }

    /// Generate comprehensive performance report
    public func generatePerformanceReport() -> PerformanceReport {
        return metricsQueue.sync {
            guard !metrics.isEmpty else {
                return createEmptyReport()
            }

            let totalOperations = metrics.count
            let successfulOperations = metrics.filter { $0.success }
            let _ = metrics.filter { !$0.success } // failedOperations - unused but calculated for clarity

            let averageDuration = metrics.reduce(0) { $0 + $1.duration } / Double(totalOperations)
            let successRate = Double(successfulOperations.count) / Double(totalOperations) * 100

            // Calculate throughput (operations per second)
            let timeSpan = metrics.last!.timestamp.timeIntervalSince(metrics.first!.timestamp)
            let throughput = timeSpan > 0 ? Double(totalOperations) / timeSpan : 0

            let slowestOperations = Array(metrics.sorted { $0.duration > $1.duration }.prefix(10))
            let currentMemory = getCurrentMemoryUsage()
            let recommendations = generateRecommendations(
                metrics: metrics,
                successRate: successRate,
                averageDuration: averageDuration
            )

            return PerformanceReport(
                totalOperations: totalOperations,
                averageDuration: averageDuration,
                successRate: successRate,
                throughput: throughput,
                memoryUsage: currentMemory - initialMemoryFootprint,
                slowestOperations: slowestOperations,
                recommendations: recommendations
            )
        }
    }

    /// Get current performance metrics
    public func getMetrics() -> [PerformanceMetric] {
        return metricsQueue.sync {
            return Array(metrics)
        }
    }

    /// Clear all stored metrics
    public func clearMetrics() {
        metricsQueue.async { [weak self] in
            self?.metrics.removeAll()
            self?.initialMemoryFootprint = self?.getCurrentMemoryUsage() ?? 0
        }
    }

    /// Export metrics as JSON for analysis
    public func exportMetrics() -> Data? {
        let report = generatePerformanceReport()
        let export = [
            "timestamp": ISO8601DateFormatter().string(from: report.generatedAt),
            "platform": "iOS",
            "totalOperations": report.totalOperations,
            "averageDuration": report.averageDuration,
            "successRate": report.successRate,
            "throughput": report.throughput,
            "memoryUsage": report.memoryUsage,
            "recommendations": report.recommendations,
            "metrics": metrics.map { metric in
                [
                    "operation": metric.operation,
                    "duration": metric.duration,
                    "timestamp": ISO8601DateFormatter().string(from: metric.timestamp),
                    "messageSize": metric.messageSize ?? 0,
                    "success": metric.success,
                    "error": metric.error ?? ""
                ]
            }
        ] as [String: Any]

        return try? JSONSerialization.data(withJSONObject: export, options: .prettyPrinted)
    }

    // MARK: - Private Methods

    private func addMetric(_ metric: PerformanceMetric) {
        metrics.append(metric)

        // Limit memory usage
        if metrics.count > maxMetrics {
            metrics.removeFirst(metrics.count - maxMetrics)
        }
    }

    private func getCurrentMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return info.resident_size
        } else {
            return 0
        }
    }

    private func createEmptyReport() -> PerformanceReport {
        return PerformanceReport(
            totalOperations: 0,
            averageDuration: 0,
            successRate: 100,
            throughput: 0,
            memoryUsage: 0,
            slowestOperations: [],
            recommendations: ["No operations recorded yet."]
        )
    }

    private func generateRecommendations(
        metrics: [PerformanceMetric],
        successRate: Double,
        averageDuration: TimeInterval
    ) -> [String] {
        var recommendations: [String] = []

        // Success rate analysis
        if successRate < 95 {
            recommendations.append("⚠️ Success rate (\(String(format: "%.1f", successRate))%) is below 95%. Consider improving error handling.")
        } else {
            recommendations.append("✅ Good success rate (\(String(format: "%.1f", successRate))%)")
        }

        // Performance analysis
        if averageDuration > BridgeLatencyTargets.databaseOperationLatency {
            recommendations.append("⚠️ Average operation duration (\(String(format: "%.2f", averageDuration * 1000))ms) exceeds target (\(String(format: "%.2f", BridgeLatencyTargets.databaseOperationLatency * 1000))ms)")
        } else {
            recommendations.append("✅ Average operation duration within targets")
        }

        // Operation-specific analysis
        let groupedMetrics = Dictionary(grouping: metrics) { $0.operation }

        for (operation, operationMetrics) in groupedMetrics {
            let avgDuration = operationMetrics.reduce(0) { $0 + $1.duration } / Double(operationMetrics.count)
            let operationSuccessRate = Double(operationMetrics.filter { $0.success }.count) / Double(operationMetrics.count) * 100

            if avgDuration > BridgeLatencyTargets.databaseOperationLatency && operationMetrics.count > 5 {
                recommendations.append("🔍 Operation '\(operation)' averaging \(String(format: "%.2f", avgDuration * 1000))ms - consider optimization")
            }

            if operationSuccessRate < 90 && operationMetrics.count > 5 {
                recommendations.append("⚠️ Operation '\(operation)' has low success rate (\(String(format: "%.1f", operationSuccessRate))%)")
            }
        }

        // Memory analysis
        let currentMemoryOverhead = getCurrentMemoryUsage() - initialMemoryFootprint
        let memoryOverheadMB = Double(currentMemoryOverhead) / (1024 * 1024)

        if memoryOverheadMB > 10 {
            recommendations.append("⚠️ Memory overhead (\(String(format: "%.2f", memoryOverheadMB))MB) is high - monitor for leaks")
        }

        return recommendations
    }
}

// MARK: - Bridge Operation Tracker

public class BridgeOperationTracker {
    private let operation: String
    private let startTime: CFAbsoluteTime
    private weak var monitor: BridgePerformanceMonitor?
    private var messageSize: Int?

    init(operation: String, monitor: BridgePerformanceMonitor) {
        self.operation = operation
        self.monitor = monitor
        self.startTime = CFAbsoluteTimeGetCurrent()
    }

    public func setMessageSize(_ size: Int) {
        messageSize = size
    }

    public func recordSuccess() {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        monitor?.recordOperation(
            operation,
            duration: duration,
            messageSize: messageSize,
            success: true
        )
    }

    public func recordError(_ error: Error) {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        monitor?.recordOperation(
            operation,
            duration: duration,
            messageSize: messageSize,
            success: false,
            error: error.localizedDescription
        )
    }

    public func recordError(_ errorMessage: String) {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        monitor?.recordOperation(
            operation,
            duration: duration,
            messageSize: messageSize,
            success: false,
            error: errorMessage
        )
    }
}

// MARK: - Global Performance Monitor

/// Shared bridge performance monitor instance
public let bridgePerformanceMonitor = BridgePerformanceMonitor()

// MARK: - Performance Extensions

extension IsometryDatabase {
    /// Execute with performance monitoring
    public func executeWithMonitoring<T>(
        operation: String,
        _ execution: @escaping () async throws -> T
    ) async -> T? {
        return await bridgePerformanceMonitor.trackDatabaseOperation(
            operation: operation,
            execution: execution
        )
    }
}

extension WKWebView {
    /// Evaluate JavaScript with performance monitoring
    public func evaluateJavaScriptWithMonitoring(
        _ script: String
    ) async -> Any? {
        return await bridgePerformanceMonitor.trackJavaScriptEvaluation(
            script: script,
            webView: self
        )
    }
}