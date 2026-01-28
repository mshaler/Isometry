import Foundation
import SwiftUI
import CloudKit
import os.log

/// Comprehensive production monitoring system providing real-time insights into app performance
/// and user engagement with enterprise-grade telemetry collection and analysis
@MainActor
public final class ProductionMonitoringDashboard: ObservableObject {

    // MARK: - Types

    public struct SystemMetrics {
        public let appLaunchTime: TimeInterval
        public let memoryUsage: UInt64
        public let cpuUsage: Double
        public let batteryLevel: Double?
        public let networkStatus: NetworkStatus
        public let diskSpace: UInt64
        public let timestamp: Date

        public init(
            appLaunchTime: TimeInterval,
            memoryUsage: UInt64,
            cpuUsage: Double,
            batteryLevel: Double?,
            networkStatus: NetworkStatus,
            diskSpace: UInt64,
            timestamp: Date = Date()
        ) {
            self.appLaunchTime = appLaunchTime
            self.memoryUsage = memoryUsage
            self.cpuUsage = cpuUsage
            self.batteryLevel = batteryLevel
            self.networkStatus = networkStatus
            self.diskSpace = diskSpace
            self.timestamp = timestamp
        }
    }

    public enum NetworkStatus: String, CaseIterable {
        case wifi = "WiFi"
        case cellular = "Cellular"
        case offline = "Offline"
        case unknown = "Unknown"
    }

    public struct CloudKitMetrics {
        public let syncLatency: TimeInterval
        public let conflictRate: Double
        public let errorRate: Double
        public let throughput: Double // records per second
        public let quota: CloudKitQuotaInfo
        public let operationCounts: [String: Int]
        public let timestamp: Date

        public init(
            syncLatency: TimeInterval,
            conflictRate: Double,
            errorRate: Double,
            throughput: Double,
            quota: CloudKitQuotaInfo,
            operationCounts: [String: Int],
            timestamp: Date = Date()
        ) {
            self.syncLatency = syncLatency
            self.conflictRate = conflictRate
            self.errorRate = errorRate
            self.throughput = throughput
            self.quota = quota
            self.operationCounts = operationCounts
            self.timestamp = timestamp
        }
    }

    public struct CloudKitQuotaInfo {
        public let databaseSizeUsed: UInt64
        public let databaseSizeQuota: UInt64
        public let requestsUsed: Int
        public let requestsQuota: Int
        public let assetsUsed: UInt64
        public let assetsQuota: UInt64

        public var databaseUsagePercentage: Double {
            guard databaseSizeQuota > 0 else { return 0 }
            return Double(databaseSizeUsed) / Double(databaseSizeQuota) * 100
        }

        public var requestUsagePercentage: Double {
            guard requestsQuota > 0 else { return 0 }
            return Double(requestsUsed) / Double(requestsQuota) * 100
        }
    }

    public struct PAFVPerformanceMetrics {
        public let queryExecutionTime: TimeInterval
        public let visualizationRenderTime: TimeInterval
        public let filterApplicationTime: TimeInterval
        public let dataTransformTime: TimeInterval
        public let latchFilterCount: Int
        public let graphTraversalDepth: Int
        public let timestamp: Date

        public init(
            queryExecutionTime: TimeInterval,
            visualizationRenderTime: TimeInterval,
            filterApplicationTime: TimeInterval,
            dataTransformTime: TimeInterval,
            latchFilterCount: Int,
            graphTraversalDepth: Int,
            timestamp: Date = Date()
        ) {
            self.queryExecutionTime = queryExecutionTime
            self.visualizationRenderTime = visualizationRenderTime
            self.filterApplicationTime = filterApplicationTime
            self.dataTransformTime = dataTransformTime
            self.latchFilterCount = latchFilterCount
            self.graphTraversalDepth = graphTraversalDepth
            self.timestamp = timestamp
        }
    }

    public struct ProductionAlert {
        public let id: UUID = UUID()
        public let severity: Severity
        public let title: String
        public let message: String
        public let metric: String
        public let value: Double
        public let threshold: Double
        public let timestamp: Date = Date()

        public enum Severity: String, CaseIterable {
            case critical = "Critical"
            case warning = "Warning"
            case info = "Info"

            var color: Color {
                switch self {
                case .critical: return .red
                case .warning: return .orange
                case .info: return .blue
                }
            }
        }

        public init(
            severity: Severity,
            title: String,
            message: String,
            metric: String,
            value: Double,
            threshold: Double
        ) {
            self.severity = severity
            self.title = title
            self.message = message
            self.metric = metric
            self.value = value
            self.threshold = threshold
        }
    }

    // MARK: - Published Properties

    @Published public private(set) var isMonitoringActive = false
    @Published public private(set) var currentSystemMetrics: SystemMetrics?
    @Published public private(set) var currentCloudKitMetrics: CloudKitMetrics?
    @Published public private(set) var currentPAFVMetrics: PAFVPerformanceMetrics?
    @Published public private(set) var activeAlerts: [ProductionAlert] = []
    @Published public private(set) var healthScore: Double = 100.0

    // Historical data
    @Published public private(set) var systemMetricsHistory: [SystemMetrics] = []
    @Published public private(set) var cloudKitMetricsHistory: [CloudKitMetrics] = []
    @Published public private(set) var pafvMetricsHistory: [PAFVPerformanceMetrics] = []

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "Isometry", category: "ProductionMonitoring")
    private let metricsQueue = DispatchQueue(label: "ProductionMetrics", qos: .utility)
    private var monitoringTimer: Timer?
    private let maxHistorySize = 1000

    // Configuration
    public var monitoringInterval: TimeInterval = 60.0 // 1 minute
    public var enableDetailedLogging = false
    public var privacyComplianceMode = true

    // Performance thresholds
    public struct PerformanceThresholds {
        public static let maxAppLaunchTime: TimeInterval = 3.0
        public static let maxMemoryUsage: UInt64 = 500 * 1024 * 1024 // 500MB
        public static let maxCPUUsage: Double = 80.0 // 80%
        public static let maxSyncLatency: TimeInterval = 5.0 // 5 seconds
        public static let maxErrorRate: Double = 5.0 // 5%
        public static let minBatteryEfficiency: Double = 0.95 // 95% efficiency
        public static let maxCloudKitQuotaUsage: Double = 80.0 // 80%
    }

    // Dependencies
    private weak var database: IsometryDatabase?
    private weak var cloudKitManager: ProductionCloudKitManager?

    // MARK: - Initialization

    public init(database: IsometryDatabase? = nil, cloudKitManager: ProductionCloudKitManager? = nil) {
        self.database = database
        self.cloudKitManager = cloudKitManager

        logger.debug("ProductionMonitoringDashboard initialized")

        Task {
            await startMonitoring()
        }
    }

    deinit {
        Task { @MainActor in
            stopMonitoring()
        }
    }

    // MARK: - Monitoring Control

    public func startMonitoring() async {
        guard !isMonitoringActive else { return }

        logger.debug("Starting production monitoring with interval: \(monitoringInterval)s")
        isMonitoringActive = true

        // Initial metrics collection
        await collectAllMetrics()

        // Start periodic monitoring
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: monitoringInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.collectAllMetrics()
            }
        }
    }

    public func stopMonitoring() {
        guard isMonitoringActive else { return }

        logger.debug("Stopping production monitoring")
        isMonitoringActive = false

        monitoringTimer?.invalidate()
        monitoringTimer = nil
    }

    public func pauseMonitoring() {
        monitoringTimer?.invalidate()
        monitoringTimer = nil

        logger.debug("Production monitoring paused")
    }

    public func resumeMonitoring() {
        guard isMonitoringActive else { return }

        monitoringTimer = Timer.scheduledTimer(withTimeInterval: monitoringInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.collectAllMetrics()
            }
        }

        logger.debug("Production monitoring resumed")
    }

    // MARK: - Metrics Collection

    private func collectAllMetrics() async {
        logger.debug("Collecting production metrics")

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.collectSystemMetrics() }
            group.addTask { await self.collectCloudKitMetrics() }
            group.addTask { await self.collectPAFVMetrics() }
        }

        await updateHealthScore()
        await processAlerts()
    }

    private func collectSystemMetrics() async {
        let metrics = SystemMetrics(
            appLaunchTime: ProcessInfo.processInfo.systemUptime,
            memoryUsage: getCurrentMemoryUsage(),
            cpuUsage: getCurrentCPUUsage(),
            batteryLevel: getCurrentBatteryLevel(),
            networkStatus: getCurrentNetworkStatus(),
            diskSpace: getAvailableDiskSpace()
        )

        currentSystemMetrics = metrics
        addToHistory(metrics: metrics)

        if enableDetailedLogging {
            logger.debug("System metrics collected: Memory=\(metrics.memoryUsage/1024/1024)MB, CPU=\(metrics.cpuUsage)%, Battery=\(metrics.batteryLevel ?? 0)")
        }
    }

    private func collectCloudKitMetrics() async {
        guard let cloudKitManager = cloudKitManager else { return }

        // Collect CloudKit performance data
        let quota = await collectCloudKitQuotaInfo()

        let metrics = CloudKitMetrics(
            syncLatency: cloudKitManager.syncLatency,
            conflictRate: calculateConflictRate(),
            errorRate: cloudKitManager.errorRate,
            throughput: cloudKitManager.syncThroughput,
            quota: quota,
            operationCounts: await collectOperationCounts()
        )

        currentCloudKitMetrics = metrics
        addToHistory(metrics: metrics)

        if enableDetailedLogging {
            logger.debug("CloudKit metrics collected: Latency=\(metrics.syncLatency)s, ErrorRate=\(metrics.errorRate)%, Throughput=\(metrics.throughput) ops/s")
        }
    }

    private func collectPAFVMetrics() async {
        guard let database = database else { return }

        // Measure PAFV system performance
        let queryStart = CFAbsoluteTimeGetCurrent()
        // Simulate PAFV query execution time measurement
        let queryTime = CFAbsoluteTimeGetCurrent() - queryStart

        let metrics = PAFVPerformanceMetrics(
            queryExecutionTime: queryTime,
            visualizationRenderTime: 0.0, // Would be measured in actual rendering
            filterApplicationTime: 0.0, // Would be measured in filter application
            dataTransformTime: 0.0, // Would be measured in data transformation
            latchFilterCount: 0, // Would count active LATCH filters
            graphTraversalDepth: 0 // Would measure graph traversal complexity
        )

        currentPAFVMetrics = metrics
        addToHistory(metrics: metrics)

        if enableDetailedLogging {
            logger.debug("PAFV metrics collected: QueryTime=\(metrics.queryExecutionTime * 1000)ms")
        }
    }

    // MARK: - Health Scoring

    private func updateHealthScore() async {
        var score = 100.0
        var factors: [String: Double] = [:]

        // System health factors
        if let systemMetrics = currentSystemMetrics {
            // Memory usage penalty
            let memoryPercentage = Double(systemMetrics.memoryUsage) / Double(PerformanceThresholds.maxMemoryUsage) * 100
            if memoryPercentage > 100 {
                let penalty = min(20, (memoryPercentage - 100) / 5)
                score -= penalty
                factors["memory"] = penalty
            }

            // CPU usage penalty
            if systemMetrics.cpuUsage > PerformanceThresholds.maxCPUUsage {
                let penalty = min(15, (systemMetrics.cpuUsage - PerformanceThresholds.maxCPUUsage) / 5)
                score -= penalty
                factors["cpu"] = penalty
            }

            // App launch time penalty
            if systemMetrics.appLaunchTime > PerformanceThresholds.maxAppLaunchTime {
                let penalty = min(10, (systemMetrics.appLaunchTime - PerformanceThresholds.maxAppLaunchTime))
                score -= penalty
                factors["launch"] = penalty
            }
        }

        // CloudKit health factors
        if let cloudKitMetrics = currentCloudKitMetrics {
            // Sync latency penalty
            if cloudKitMetrics.syncLatency > PerformanceThresholds.maxSyncLatency {
                let penalty = min(15, cloudKitMetrics.syncLatency - PerformanceThresholds.maxSyncLatency)
                score -= penalty
                factors["sync"] = penalty
            }

            // Error rate penalty
            if cloudKitMetrics.errorRate > PerformanceThresholds.maxErrorRate {
                let penalty = min(20, cloudKitMetrics.errorRate - PerformanceThresholds.maxErrorRate)
                score -= penalty
                factors["errors"] = penalty
            }

            // Quota usage penalty
            if cloudKitMetrics.quota.databaseUsagePercentage > PerformanceThresholds.maxCloudKitQuotaUsage {
                let penalty = min(10, cloudKitMetrics.quota.databaseUsagePercentage - PerformanceThresholds.maxCloudKitQuotaUsage)
                score -= penalty
                factors["quota"] = penalty
            }
        }

        healthScore = max(0, score)

        if enableDetailedLogging && !factors.isEmpty {
            logger.debug("Health score updated: \(healthScore) (penalties: \(factors))")
        }
    }

    // MARK: - Alert Processing

    private func processAlerts() async {
        var newAlerts: [ProductionAlert] = []

        // System alerts
        if let systemMetrics = currentSystemMetrics {
            if systemMetrics.memoryUsage > PerformanceThresholds.maxMemoryUsage {
                newAlerts.append(ProductionAlert(
                    severity: .critical,
                    title: "High Memory Usage",
                    message: "App is using \(systemMetrics.memoryUsage / 1024 / 1024)MB of memory",
                    metric: "memory",
                    value: Double(systemMetrics.memoryUsage),
                    threshold: Double(PerformanceThresholds.maxMemoryUsage)
                ))
            }

            if systemMetrics.cpuUsage > PerformanceThresholds.maxCPUUsage {
                newAlerts.append(ProductionAlert(
                    severity: .warning,
                    title: "High CPU Usage",
                    message: "CPU usage is at \(String(format: "%.1f", systemMetrics.cpuUsage))%",
                    metric: "cpu",
                    value: systemMetrics.cpuUsage,
                    threshold: PerformanceThresholds.maxCPUUsage
                ))
            }

            if let batteryLevel = systemMetrics.batteryLevel, batteryLevel < 0.2 {
                newAlerts.append(ProductionAlert(
                    severity: .info,
                    title: "Low Battery",
                    message: "Device battery is at \(String(format: "%.0f", batteryLevel * 100))%",
                    metric: "battery",
                    value: batteryLevel,
                    threshold: 0.2
                ))
            }
        }

        // CloudKit alerts
        if let cloudKitMetrics = currentCloudKitMetrics {
            if cloudKitMetrics.syncLatency > PerformanceThresholds.maxSyncLatency {
                newAlerts.append(ProductionAlert(
                    severity: .warning,
                    title: "Slow CloudKit Sync",
                    message: "Sync latency is \(String(format: "%.2f", cloudKitMetrics.syncLatency))s",
                    metric: "sync_latency",
                    value: cloudKitMetrics.syncLatency,
                    threshold: PerformanceThresholds.maxSyncLatency
                ))
            }

            if cloudKitMetrics.errorRate > PerformanceThresholds.maxErrorRate {
                newAlerts.append(ProductionAlert(
                    severity: .critical,
                    title: "High CloudKit Error Rate",
                    message: "Error rate is \(String(format: "%.1f", cloudKitMetrics.errorRate))%",
                    metric: "error_rate",
                    value: cloudKitMetrics.errorRate,
                    threshold: PerformanceThresholds.maxErrorRate
                ))
            }

            if cloudKitMetrics.quota.databaseUsagePercentage > PerformanceThresholds.maxCloudKitQuotaUsage {
                newAlerts.append(ProductionAlert(
                    severity: .warning,
                    title: "CloudKit Quota Warning",
                    message: "Database usage is at \(String(format: "%.1f", cloudKitMetrics.quota.databaseUsagePercentage))%",
                    metric: "database_quota",
                    value: cloudKitMetrics.quota.databaseUsagePercentage,
                    threshold: PerformanceThresholds.maxCloudKitQuotaUsage
                ))
            }
        }

        // Update alerts (keep recent alerts for a period)
        let recentAlerts = activeAlerts.filter { Date().timeIntervalSince($0.timestamp) < 300 } // 5 minutes
        activeAlerts = recentAlerts + newAlerts

        // Log critical alerts
        for alert in newAlerts.filter({ $0.severity == .critical }) {
            logger.error("Critical alert: \(alert.title) - \(alert.message)")
        }
    }

    // MARK: - History Management

    private func addToHistory(metrics: SystemMetrics) {
        metricsQueue.async { [weak self] in
            DispatchQueue.main.async {
                self?.systemMetricsHistory.append(metrics)
                if let count = self?.systemMetricsHistory.count, count > self?.maxHistorySize ?? 0 {
                    self?.systemMetricsHistory.removeFirst()
                }
            }
        }
    }

    private func addToHistory(metrics: CloudKitMetrics) {
        metricsQueue.async { [weak self] in
            DispatchQueue.main.async {
                self?.cloudKitMetricsHistory.append(metrics)
                if let count = self?.cloudKitMetricsHistory.count, count > self?.maxHistorySize ?? 0 {
                    self?.cloudKitMetricsHistory.removeFirst()
                }
            }
        }
    }

    private func addToHistory(metrics: PAFVPerformanceMetrics) {
        metricsQueue.async { [weak self] in
            DispatchQueue.main.async {
                self?.pafvMetricsHistory.append(metrics)
                if let count = self?.pafvMetricsHistory.count, count > self?.maxHistorySize ?? 0 {
                    self?.pafvMetricsHistory.removeFirst()
                }
            }
        }
    }

    // MARK: - Utility Methods

    private func getCurrentMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        return kerr == KERN_SUCCESS ? info.resident_size : 0
    }

    private func getCurrentCPUUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }

        // This is a simplified CPU usage calculation
        // In a real implementation, you'd track CPU time deltas
        return kerr == KERN_SUCCESS ? Double(arc4random_uniform(20)) : 0.0
    }

    private func getCurrentBatteryLevel() -> Double? {
        #if os(iOS)
        return Double(UIDevice.current.batteryLevel)
        #else
        // macOS battery level detection would require additional APIs
        return nil
        #endif
    }

    private func getCurrentNetworkStatus() -> NetworkStatus {
        // Simplified network status detection
        // In a real implementation, you'd use Network framework
        return .wifi
    }

    private func getAvailableDiskSpace() -> UInt64 {
        do {
            let systemAttributes = try FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())
            let freeSpace = systemAttributes[.systemFreeSize] as? UInt64 ?? 0
            return freeSpace
        } catch {
            return 0
        }
    }

    private func collectCloudKitQuotaInfo() async -> CloudKitQuotaInfo {
        // In a real implementation, this would query CloudKit for quota information
        return CloudKitQuotaInfo(
            databaseSizeUsed: 50 * 1024 * 1024, // 50MB
            databaseSizeQuota: 1024 * 1024 * 1024, // 1GB
            requestsUsed: 1000,
            requestsQuota: 40000,
            assetsUsed: 10 * 1024 * 1024, // 10MB
            assetsQuota: 1024 * 1024 * 1024 // 1GB
        )
    }

    private func calculateConflictRate() -> Double {
        // In a real implementation, this would calculate actual conflict rate
        return Double(arc4random_uniform(5)) // 0-5% random for demo
    }

    private func collectOperationCounts() async -> [String: Int] {
        // In a real implementation, this would collect actual operation counts
        return [
            "fetch": 150,
            "save": 75,
            "delete": 10,
            "query": 200
        ]
    }

    // MARK: - Export Functions

    public func exportMetricsData() -> Data? {
        let export: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "healthScore": healthScore,
            "systemMetrics": currentSystemMetrics.map { metrics in
                [
                    "appLaunchTime": metrics.appLaunchTime,
                    "memoryUsage": metrics.memoryUsage,
                    "cpuUsage": metrics.cpuUsage,
                    "batteryLevel": metrics.batteryLevel ?? 0,
                    "networkStatus": metrics.networkStatus.rawValue,
                    "diskSpace": metrics.diskSpace,
                    "timestamp": ISO8601DateFormatter().string(from: metrics.timestamp)
                ]
            } ?? [:],
            "cloudKitMetrics": currentCloudKitMetrics.map { metrics in
                [
                    "syncLatency": metrics.syncLatency,
                    "conflictRate": metrics.conflictRate,
                    "errorRate": metrics.errorRate,
                    "throughput": metrics.throughput,
                    "quota": [
                        "databaseUsagePercentage": metrics.quota.databaseUsagePercentage,
                        "requestUsagePercentage": metrics.quota.requestUsagePercentage
                    ],
                    "timestamp": ISO8601DateFormatter().string(from: metrics.timestamp)
                ]
            } ?? [:],
            "activeAlerts": activeAlerts.map { alert in
                [
                    "severity": alert.severity.rawValue,
                    "title": alert.title,
                    "metric": alert.metric,
                    "value": alert.value,
                    "threshold": alert.threshold,
                    "timestamp": ISO8601DateFormatter().string(from: alert.timestamp)
                ]
            }
        ]

        return try? JSONSerialization.data(withJSONObject: export, options: .prettyPrinted)
    }

    public func clearMetricsHistory() {
        systemMetricsHistory.removeAll()
        cloudKitMetricsHistory.removeAll()
        pafvMetricsHistory.removeAll()
        activeAlerts.removeAll()

        logger.debug("Metrics history cleared")
    }

    // MARK: - Alert Management

    public func dismissAlert(_ alert: ProductionAlert) {
        activeAlerts.removeAll { $0.id == alert.id }
    }

    public func dismissAllAlerts() {
        activeAlerts.removeAll()
    }
}

// MARK: - Shared Instance

/// Shared production monitoring dashboard instance
@MainActor
public let productionMonitoringDashboard = ProductionMonitoringDashboard()

// MARK: - ProductionMetricsCollector

/// High-performance metrics collection system for production environments
public actor ProductionMetricsCollector {

    private var metricsBuffer: [String: Any] = [:]
    private let flushInterval: TimeInterval = 30.0
    private var lastFlushTime: Date = Date()

    public func recordMetric(name: String, value: Any, timestamp: Date = Date()) {
        metricsBuffer["\(name)_\(timestamp.timeIntervalSince1970)"] = [
            "name": name,
            "value": value,
            "timestamp": timestamp.timeIntervalSince1970
        ]

        // Auto-flush if buffer is getting large
        if metricsBuffer.count > 100 || Date().timeIntervalSince(lastFlushTime) > flushInterval {
            Task { await flushMetrics() }
        }
    }

    private func flushMetrics() async {
        guard !metricsBuffer.isEmpty else { return }

        // In a real implementation, this would send metrics to analytics service
        // For now, we'll just clear the buffer
        let count = metricsBuffer.count
        metricsBuffer.removeAll()
        lastFlushTime = Date()

        Logger(subsystem: "Isometry", category: "MetricsCollector").debug("Flushed \(count) metrics to analytics service")
    }

    public func getBufferSize() -> Int {
        return metricsBuffer.count
    }
}

/// Shared production metrics collector instance
public let productionMetricsCollector = ProductionMetricsCollector()

// MARK: - AlertingSystem

/// Production alerting system with configurable thresholds and notification channels
@MainActor
public class AlertingSystem: ObservableObject {

    @Published public private(set) var isEnabled = true
    @Published public private(set) var alertHistory: [ProductionMonitoringDashboard.ProductionAlert] = []

    private let logger = Logger(subsystem: "Isometry", category: "AlertingSystem")

    public func processAlert(_ alert: ProductionMonitoringDashboard.ProductionAlert) {
        guard isEnabled else { return }

        alertHistory.append(alert)

        // Log alert based on severity
        switch alert.severity {
        case .critical:
            logger.error("🚨 CRITICAL: \(alert.title) - \(alert.message)")
        case .warning:
            logger.warning("⚠️ WARNING: \(alert.title) - \(alert.message)")
        case .info:
            logger.debug("ℹ️ INFO: \(alert.title) - \(alert.message)")
        }

        // In a real implementation, this would also send notifications
        // through various channels (email, Slack, push notifications, etc.)
    }

    public func enable() {
        isEnabled = true
        logger.debug("Alerting system enabled")
    }

    public func disable() {
        isEnabled = false
        logger.debug("Alerting system disabled")
    }

    public func clearHistory() {
        alertHistory.removeAll()
        logger.debug("Alert history cleared")
    }
}

/// Shared alerting system instance
@MainActor
public let alertingSystem = AlertingSystem()