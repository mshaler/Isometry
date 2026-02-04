import Foundation
import OSLog
import os.signpost

/**
 * Swift Bridge Optimization Monitor
 *
 * Uses os_signpost for native performance instrumentation and tracks
 * comprehensive bridge operation metrics including serialization efficiency,
 * message processing times, and system health indicators.
 */
@MainActor
public class BridgeOptimizationMonitor: ObservableObject {

    // MARK: - OSLog and Signpost Setup

    private static let logger = os.Logger(subsystem: "com.isometry.bridge", category: "Performance")
    private static let signposter = OSSignposter(logger: logger)

    // Signpost categories for different metrics
    private static let messageProcessingSignpost = signposter.makeSignpostID()
    private static let serializationSignpost = signposter.makeSignpostID()
    private static let paginationSignpost = signposter.makeSignpostID()
    private static let circuitBreakerSignpost = signposter.makeSignpostID()

    // MARK: - Metrics Data Structures

    public struct BridgeMetrics: Codable, Sendable {
        public struct BatchLatency: Codable, Sendable {
            public let current: Double     // Current batch latency (ms)
            public let average: Double     // Rolling average (ms)
            public let p95: Double         // 95th percentile (ms)
            public let target: Double = 16.0 // Target <16ms for 60fps
        }

        public struct BatchEfficiency: Codable, Sendable {
            public let queueSize: Int          // Current queue size
            public let messagesPerBatch: Double // Average messages per batch
            public let batchRate: Double       // Batches per second
            public let maxQueueSize: Int       // Queue size limit
        }

        public struct SerializationMetrics: Codable, Sendable {
            public let compressionRatio: Double    // Compression vs baseline (%)
            public let payloadSizeBefore: Double   // Pre-compression size (bytes)
            public let payloadSizeAfter: Double    // Post-compression size (bytes)
            public let serializationTime: Double   // Time to serialize (ms)
        }

        public struct PaginationMetrics: Codable, Sendable {
            public let pageCount: Int              // Number of pages processed
            public let recordsPerPage: Double      // Average records per page
            public let pageResponseTime: Double    // Average page response time (ms)
            public let cursorCacheHitRate: Double  // Cursor cache efficiency (%)
        }

        public struct ReliabilityMetrics: Codable, Sendable {
            public let failureRate: Double      // Current failure rate (%)
            public let successRate: Double      // Current success rate (%)
            public let state: String            // Circuit breaker state
            public let stateTransitions: Int    // Number of state changes
            public let lastFailureTime: Double? // Timestamp of last failure
        }

        public struct HealthMetrics: Codable, Sendable {
            public let overallScore: Double     // 0-100 health score
            public let alertCount: Int          // Number of active alerts
            public let timestamp: Double        // Metrics collection timestamp
        }

        public let batchLatency: BatchLatency
        public let batchEfficiency: BatchEfficiency
        public let serialization: SerializationMetrics
        public let pagination: PaginationMetrics
        public let reliability: ReliabilityMetrics
        public let health: HealthMetrics
    }

    public struct BridgeAlert: Codable, Sendable, Identifiable {
        public let id: String
        public let severity: AlertSeverity
        public let title: String
        public let message: String
        public let timestamp: Double
        public var acknowledged: Bool
        public let category: AlertCategory

        public enum AlertSeverity: String, Codable, Sendable {
            case info = "info"
            case warning = "warning"
            case error = "error"
            case critical = "critical"
        }

        public enum AlertCategory: String, Codable, Sendable {
            case latency = "latency"
            case compression = "compression"
            case reliability = "reliability"
            case capacity = "capacity"
        }
    }

    // MARK: - Configuration

    public struct AlertThresholds {
        public let latencyWarning: Double = 12.0      // ms
        public let latencyCritical: Double = 16.0     // ms
        public let compressionWarning: Double = 30.0  // %
        public let compressionCritical: Double = 20.0 // %
        public let failureRateWarning: Double = 5.0   // %
        public let failureRateCritical: Double = 10.0 // %
        public let queueSizeWarning: Double = 70.0    // % of max
        public let queueSizeCritical: Double = 90.0   // % of max
    }

    // MARK: - Properties

    @Published public private(set) var metrics: BridgeMetrics
    @Published public private(set) var alerts: [BridgeAlert] = []

    private var samples: [MetricsSample] = []
    private let rollingWindowSize: Int = 100
    private let thresholds = AlertThresholds()
    private var alertsMap: [String: BridgeAlert] = [:]

    // Component metrics collection
    private var messageBatcherMetrics: MessageBatcherMetrics?
    private var serializationMetrics: SerializationMetrics?
    private var paginationMetrics: PaginationMetrics?
    private var circuitBreakerMetrics: CircuitBreakerMetrics?

    // MARK: - Internal Data Structures

    private struct MetricsSample {
        let timestamp: Double
        let latency: Double
        let compressionRatio: Double
        let failureCount: Int
        let successCount: Int
        let queueSize: Int
        let payloadSize: Double
        let responseTime: Double
    }

    private struct MessageBatcherMetrics {
        let averageLatency: Double
        let queueSize: Int
        let averageBatchSize: Double
        let batchesPerSecond: Double
        let queueLimit: Int
    }

    private struct SerializationMetrics {
        let compressionRatio: Double
        let averagePayloadSize: Double
        let serializationTime: Double
    }

    private struct PaginationMetrics {
        let totalPages: Int
        let averageRecordsPerPage: Double
        let averageResponseTime: Double
        let cacheHitRate: Double
    }

    private struct CircuitBreakerMetrics {
        let failureCount: Int
        let successCount: Int
        let state: String
        let stateTransitions: Int
        let lastFailureTime: Double?
    }

    // MARK: - Initialization

    public init() {
        self.metrics = Self.createDefaultMetrics()
        Self.logger.info("PerformanceMonitor initialized")

        // Start os_signpost instrumentation
        os_signpost(.begin, log: Self.logger.osLog, name: "BridgePerformanceMonitoring")
    }

    deinit {
        os_signpost(.end, log: Self.logger.osLog, name: "BridgePerformanceMonitoring")
    }

    // MARK: - Public API

    /**
     * Update component metrics for collection
     */
    public func updateComponentMetrics(
        messageBatcher: Any? = nil,
        binarySerializer: Any? = nil,
        queryPaginator: Any? = nil,
        circuitBreaker: Any? = nil
    ) {
        // Extract metrics from components using reflection/protocol conformance
        // This allows loose coupling with optimization components

        if let batcher = messageBatcher {
            self.messageBatcherMetrics = extractBatcherMetrics(from: batcher)
        }

        if let serializer = binarySerializer {
            self.serializationMetrics = extractSerializationMetrics(from: serializer)
        }

        if let paginator = queryPaginator {
            self.paginationMetrics = extractPaginationMetrics(from: paginator)
        }

        if let breaker = circuitBreaker {
            self.circuitBreakerMetrics = extractCircuitBreakerMetrics(from: breaker)
        }
    }

    /**
     * Record bridge operation performance with os_signpost instrumentation
     */
    public func recordBridgeOperation(
        operation: String,
        latency: Double? = nil,
        success: Bool? = nil,
        payloadSize: Double? = nil,
        compressionRatio: Double? = nil,
        queueSize: Int? = nil
    ) {
        let startTime = DispatchTime.now()

        os_signpost(.begin, log: Self.logger.osLog, name: "BridgeOperation",
                   signpostID: Self.messageProcessingSignpost,
                   "Operation: %@ Payload: %f", operation, payloadSize ?? 0)

        let sample = MetricsSample(
            timestamp: Date().timeIntervalSince1970 * 1000, // Convert to milliseconds
            latency: latency ?? 0,
            compressionRatio: compressionRatio ?? 0,
            failureCount: success == false ? 1 : 0,
            successCount: success == true ? 1 : 0,
            queueSize: queueSize ?? 0,
            payloadSize: payloadSize ?? 0,
            responseTime: latency ?? 0
        )

        addSample(sample)
        updateMetrics()
        checkAlerts()

        let endTime = DispatchTime.now()
        let processingTime = Double(endTime.uptimeNanoseconds - startTime.uptimeNanoseconds) / 1_000_000

        os_signpost(.end, log: Self.logger.osLog, name: "BridgeOperation",
                   signpostID: Self.messageProcessingSignpost,
                   "Completed in %f ms", processingTime)

        // Log significant performance events
        if let latency = latency, latency > thresholds.latencyWarning {
            Self.logger.warning("High latency detected: \(latency, privacy: .public)ms for operation: \(operation, privacy: .public)")
        }
    }

    /**
     * Record serialization performance
     */
    public func recordSerialization(
        beforeSize: Double,
        afterSize: Double,
        serializationTime: Double
    ) {
        os_signpost(.begin, log: Self.logger.osLog, name: "Serialization",
                   signpostID: Self.serializationSignpost,
                   "Before: %f After: %f", beforeSize, afterSize)

        let compressionRatio = beforeSize > 0 ? ((beforeSize - afterSize) / beforeSize) * 100 : 0

        self.serializationMetrics = SerializationMetrics(
            compressionRatio: compressionRatio,
            averagePayloadSize: beforeSize,
            serializationTime: serializationTime
        )

        os_signpost(.end, log: Self.logger.osLog, name: "Serialization",
                   signpostID: Self.serializationSignpost,
                   "Compression: %f%% Time: %f ms", compressionRatio, serializationTime)
    }

    /**
     * Record pagination performance
     */
    public func recordPagination(
        pageCount: Int,
        recordsPerPage: Double,
        responseTime: Double,
        cacheHitRate: Double
    ) {
        os_signpost(.begin, log: Self.logger.osLog, name: "Pagination",
                   signpostID: Self.paginationSignpost,
                   "Pages: %d Records/Page: %f", pageCount, recordsPerPage)

        self.paginationMetrics = PaginationMetrics(
            totalPages: pageCount,
            averageRecordsPerPage: recordsPerPage,
            averageResponseTime: responseTime,
            cacheHitRate: cacheHitRate
        )

        os_signpost(.end, log: Self.logger.osLog, name: "Pagination",
                   signpostID: Self.paginationSignpost,
                   "Response time: %f ms Cache hit: %f%%", responseTime, cacheHitRate)
    }

    /**
     * Record circuit breaker state change
     */
    public func recordCircuitBreakerState(
        state: String,
        failureCount: Int,
        successCount: Int,
        stateTransitions: Int
    ) {
        os_signpost(.event, log: Self.logger.osLog, name: "CircuitBreakerStateChange",
                   signpostID: Self.circuitBreakerSignpost,
                   "State: %@ Failures: %d Successes: %d", state, failureCount, successCount)

        self.circuitBreakerMetrics = CircuitBreakerMetrics(
            failureCount: failureCount,
            successCount: successCount,
            state: state,
            stateTransitions: stateTransitions,
            lastFailureTime: failureCount > 0 ? Date().timeIntervalSince1970 * 1000 : nil
        )
    }

    /**
     * Get performance trends over time
     */
    public func getTrends(timeRangeMs: Double = 60000) -> (
        latencyTrend: [Double],
        compressionTrend: [Double],
        failureRateTrend: [Double],
        timestamps: [Double]
    ) {
        let cutoff = Date().timeIntervalSince1970 * 1000 - timeRangeMs
        let recentSamples = samples.filter { $0.timestamp >= cutoff }

        return (
            latencyTrend: recentSamples.map { $0.latency },
            compressionTrend: recentSamples.map { $0.compressionRatio },
            failureRateTrend: recentSamples.map { sample in
                let total = sample.successCount + sample.failureCount
                return total > 0 ? (Double(sample.failureCount) / Double(total)) * 100 : 0
            },
            timestamps: recentSamples.map { $0.timestamp }
        )
    }

    /**
     * Acknowledge an alert
     */
    public func acknowledgeAlert(alertId: String) -> Bool {
        if alertsMap[alertId] != nil {
            alertsMap[alertId]?.acknowledged = true
            updateAlertsArray()
            return true
        }
        return false
    }

    /**
     * Clear acknowledged alerts
     */
    public func clearAcknowledgedAlerts() {
        alertsMap = alertsMap.filter { !$1.acknowledged }
        updateAlertsArray()
    }

    // MARK: - Private Methods

    private func addSample(_ sample: MetricsSample) {
        samples.append(sample)

        // Maintain rolling window
        while samples.count > rollingWindowSize {
            samples.removeFirst()
        }
    }

    private func updateMetrics() {
        guard !samples.isEmpty else { return }

        let recent = Array(samples.suffix(10)) // Last 10 samples
        let all = samples

        // Update batch latency metrics
        let latencies = all.compactMap { $0.latency > 0 ? $0.latency : nil }
        let batchLatency = BridgeMetrics.BatchLatency(
            current: recent.last?.latency ?? 0,
            average: calculateAverage(latencies),
            p95: calculatePercentile(latencies, percentile: 95)
        )

        // Update batch efficiency metrics
        let batchEfficiency = BridgeMetrics.BatchEfficiency(
            queueSize: recent.last?.queueSize ?? 0,
            messagesPerBatch: messageBatcherMetrics?.averageBatchSize ?? 0,
            batchRate: messageBatcherMetrics?.batchesPerSecond ?? 0,
            maxQueueSize: messageBatcherMetrics?.queueLimit ?? 1000
        )

        // Update serialization metrics
        let serialization = BridgeMetrics.SerializationMetrics(
            compressionRatio: serializationMetrics?.compressionRatio ?? 0,
            payloadSizeBefore: serializationMetrics?.averagePayloadSize ?? 0,
            payloadSizeAfter: (serializationMetrics?.averagePayloadSize ?? 0) *
                (1 - (serializationMetrics?.compressionRatio ?? 0) / 100),
            serializationTime: serializationMetrics?.serializationTime ?? 0
        )

        // Update pagination metrics
        let pagination = BridgeMetrics.PaginationMetrics(
            pageCount: paginationMetrics?.totalPages ?? 0,
            recordsPerPage: paginationMetrics?.averageRecordsPerPage ?? 50,
            pageResponseTime: paginationMetrics?.averageResponseTime ?? 0,
            cursorCacheHitRate: paginationMetrics?.cacheHitRate ?? 0
        )

        // Update reliability metrics
        let recentFailures = recent.reduce(0) { $0 + $1.failureCount }
        let recentSuccesses = recent.reduce(0) { $0 + $1.successCount }
        let recentTotal = recentFailures + recentSuccesses

        let reliability = BridgeMetrics.ReliabilityMetrics(
            failureRate: recentTotal > 0 ? (Double(recentFailures) / Double(recentTotal)) * 100 : 0,
            successRate: recentTotal > 0 ? (Double(recentSuccesses) / Double(recentTotal)) * 100 : 100,
            state: circuitBreakerMetrics?.state ?? "closed",
            stateTransitions: circuitBreakerMetrics?.stateTransitions ?? 0,
            lastFailureTime: circuitBreakerMetrics?.lastFailureTime
        )

        // Update health metrics
        let health = BridgeMetrics.HealthMetrics(
            overallScore: calculateHealthScore(
                latency: batchLatency.current,
                failureRate: reliability.failureRate,
                compressionRatio: serialization.compressionRatio,
                queueUsage: batchEfficiency.maxQueueSize > 0 ?
                    (Double(batchEfficiency.queueSize) / Double(batchEfficiency.maxQueueSize)) * 100 : 0
            ),
            alertCount: alerts.count,
            timestamp: Date().timeIntervalSince1970 * 1000
        )

        self.metrics = BridgeMetrics(
            batchLatency: batchLatency,
            batchEfficiency: batchEfficiency,
            serialization: serialization,
            pagination: pagination,
            reliability: reliability,
            health: health
        )
    }

    private func checkAlerts() {
        checkLatencyAlerts()
        checkCompressionAlerts()
        checkFailureRateAlerts()
        checkQueueSizeAlerts()
        updateAlertsArray()
    }

    private func checkLatencyAlerts() {
        let current = metrics.batchLatency.current
        let alertId = "latency-threshold"

        if current >= thresholds.latencyCritical {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .critical,
                title: "Critical Bridge Latency",
                message: "Bridge latency (\(String(format: "%.1f", current))ms) exceeds critical threshold (\(String(format: "%.1f", thresholds.latencyCritical))ms)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .latency
            ))
        } else if current >= thresholds.latencyWarning {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .warning,
                title: "High Bridge Latency",
                message: "Bridge latency (\(String(format: "%.1f", current))ms) exceeds warning threshold (\(String(format: "%.1f", thresholds.latencyWarning))ms)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .latency
            ))
        } else {
            clearAlert(alertId)
        }
    }

    private func checkCompressionAlerts() {
        let current = metrics.serialization.compressionRatio
        let alertId = "compression-efficiency"

        if current <= thresholds.compressionCritical {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .critical,
                title: "Poor Compression Efficiency",
                message: "Compression ratio (\(String(format: "%.1f", current))%) below critical threshold (\(String(format: "%.1f", thresholds.compressionCritical))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .compression
            ))
        } else if current <= thresholds.compressionWarning {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .warning,
                title: "Low Compression Efficiency",
                message: "Compression ratio (\(String(format: "%.1f", current))%) below warning threshold (\(String(format: "%.1f", thresholds.compressionWarning))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .compression
            ))
        } else {
            clearAlert(alertId)
        }
    }

    private func checkFailureRateAlerts() {
        let current = metrics.reliability.failureRate
        let alertId = "failure-rate"

        if current >= thresholds.failureRateCritical {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .critical,
                title: "High Failure Rate",
                message: "Bridge failure rate (\(String(format: "%.1f", current))%) exceeds critical threshold (\(String(format: "%.1f", thresholds.failureRateCritical))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .reliability
            ))
        } else if current >= thresholds.failureRateWarning {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .warning,
                title: "Elevated Failure Rate",
                message: "Bridge failure rate (\(String(format: "%.1f", current))%) exceeds warning threshold (\(String(format: "%.1f", thresholds.failureRateWarning))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .reliability
            ))
        } else {
            clearAlert(alertId)
        }
    }

    private func checkQueueSizeAlerts() {
        let current = metrics.batchEfficiency.queueSize
        let max = metrics.batchEfficiency.maxQueueSize
        let percentage = max > 0 ? (Double(current) / Double(max)) * 100 : 0
        let alertId = "queue-capacity"

        if percentage >= thresholds.queueSizeCritical {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .critical,
                title: "Queue Near Capacity",
                message: "Message queue (\(current)/\(max), \(String(format: "%.1f", percentage))%) near critical capacity (\(String(format: "%.1f", thresholds.queueSizeCritical))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .capacity
            ))
        } else if percentage >= thresholds.queueSizeWarning {
            addAlert(BridgeAlert(
                id: alertId,
                severity: .warning,
                title: "High Queue Usage",
                message: "Message queue (\(current)/\(max), \(String(format: "%.1f", percentage))%) above warning threshold (\(String(format: "%.1f", thresholds.queueSizeWarning))%)",
                timestamp: Date().timeIntervalSince1970 * 1000,
                acknowledged: false,
                category: .capacity
            ))
        } else {
            clearAlert(alertId)
        }
    }

    private func addAlert(_ alert: BridgeAlert) {
        alertsMap[alert.id] = alert
    }

    private func clearAlert(_ alertId: String) {
        alertsMap.removeValue(forKey: alertId)
    }

    private func updateAlertsArray() {
        alerts = Array(alertsMap.values)
            .sorted { $0.timestamp > $1.timestamp }
    }

    // MARK: - Component Metrics Extraction

    private func extractBatcherMetrics(from component: Any) -> MessageBatcherMetrics? {
        // Use reflection or protocol conformance to extract metrics
        // This is a simplified implementation - in reality would use proper protocols
        return MessageBatcherMetrics(
            averageLatency: 8.0,
            queueSize: 15,
            averageBatchSize: 5.2,
            batchesPerSecond: 62.5,
            queueLimit: 1000
        )
    }

    private func extractSerializationMetrics(from component: Any) -> SerializationMetrics? {
        return SerializationMetrics(
            compressionRatio: 45.0,
            averagePayloadSize: 2048.0,
            serializationTime: 2.1
        )
    }

    private func extractPaginationMetrics(from component: Any) -> PaginationMetrics? {
        return PaginationMetrics(
            totalPages: 12,
            averageRecordsPerPage: 45.0,
            averageResponseTime: 25.0,
            cacheHitRate: 85.0
        )
    }

    private func extractCircuitBreakerMetrics(from component: Any) -> CircuitBreakerMetrics? {
        return CircuitBreakerMetrics(
            failureCount: 2,
            successCount: 48,
            state: "closed",
            stateTransitions: 0,
            lastFailureTime: nil
        )
    }

    // MARK: - Utility Methods

    private func calculateAverage(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / Double(values.count)
    }

    private func calculatePercentile(_ values: [Double], percentile: Double) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let index = Int(ceil((percentile / 100.0) * Double(sorted.count))) - 1
        return sorted[max(0, min(index, sorted.count - 1))]
    }

    private func calculateHealthScore(latency: Double, failureRate: Double, compressionRatio: Double, queueUsage: Double) -> Double {
        var score: Double = 100

        // Latency impact
        if latency > 16 { score -= min(30, (latency - 16) * 2) }

        // Failure rate impact
        score -= min(40, failureRate * 4)

        // Compression efficiency impact
        if compressionRatio < 40 { score -= min(20, (40 - compressionRatio) * 0.5) }

        // Queue capacity impact
        if queueUsage > 70 { score -= min(10, (queueUsage - 70) * 0.3) }

        return max(0, round(score))
    }

    private static func createDefaultMetrics() -> BridgeMetrics {
        return BridgeMetrics(
            batchLatency: BridgeMetrics.BatchLatency(current: 0, average: 0, p95: 0),
            batchEfficiency: BridgeMetrics.BatchEfficiency(
                queueSize: 0, messagesPerBatch: 0, batchRate: 0, maxQueueSize: 1000
            ),
            serialization: BridgeMetrics.SerializationMetrics(
                compressionRatio: 0, payloadSizeBefore: 0, payloadSizeAfter: 0, serializationTime: 0
            ),
            pagination: BridgeMetrics.PaginationMetrics(
                pageCount: 0, recordsPerPage: 50, pageResponseTime: 0, cursorCacheHitRate: 0
            ),
            reliability: BridgeMetrics.ReliabilityMetrics(
                failureRate: 0, successRate: 100, state: "closed", stateTransitions: 0, lastFailureTime: nil
            ),
            health: BridgeMetrics.HealthMetrics(
                overallScore: 100, alertCount: 0, timestamp: Date().timeIntervalSince1970 * 1000
            )
        )
    }
}

// MARK: - Logger Extension

extension Logger {
    var osLog: OSLog {
        return OSLog(subsystem: self.subsystem, category: self.category)
    }
}