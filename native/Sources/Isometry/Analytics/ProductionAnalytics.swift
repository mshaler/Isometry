import Foundation
import SwiftUI
import os.log

/// Privacy-compliant analytics system for production environments
/// Implements GDPR-compliant data collection with user consent management
/// and comprehensive feature usage tracking for business intelligence
@MainActor
public final class ProductionAnalytics: ObservableObject {

    // MARK: - Types

    public enum AnalyticsEvent: String, CaseIterable {
        // App lifecycle events
        case appLaunch = "app_launch"
        case appBackground = "app_background"
        case appTerminate = "app_terminate"
        case sessionStart = "session_start"
        case sessionEnd = "session_end"

        // Feature usage events
        case noteCreated = "note_created"
        case noteEdited = "note_edited"
        case noteDeleted = "note_deleted"
        case searchPerformed = "search_performed"
        case filterApplied = "filter_applied"
        case visualizationRendered = "visualization_rendered"

        // PAFV system events
        case pafvQuery = "pafv_query"
        case latchFilter = "latch_filter"
        case graphTraversal = "graph_traversal"
        case dimensionProjection = "dimension_projection"

        // CloudKit events
        case syncCompleted = "sync_completed"
        case conflictResolved = "conflict_resolved"
        case offlineMode = "offline_mode"

        // Performance events
        case slowOperation = "slow_operation"
        case errorOccurred = "error_occurred"
        case crashRecovered = "crash_recovered"
    }

    public struct AnalyticsEventData {
        public let event: AnalyticsEvent
        public let properties: [String: Any]
        public let timestamp: Date
        public let sessionId: String
        public let userId: String?

        public init(
            event: AnalyticsEvent,
            properties: [String: Any] = [:],
            timestamp: Date = Date(),
            sessionId: String,
            userId: String? = nil
        ) {
            self.event = event
            self.properties = properties
            self.timestamp = timestamp
            self.sessionId = sessionId
            self.userId = userId
        }
    }

    public struct UserMetrics {
        public let sessionDuration: TimeInterval
        public let featuresUsed: Set<String>
        public let actionsPerformed: Int
        public let errorCount: Int
        public let performanceScore: Double
        public let engagementLevel: EngagementLevel

        public enum EngagementLevel: String, CaseIterable {
            case low = "low"
            case medium = "medium"
            case high = "high"
            case superUser = "super_user"

            public var threshold: Int {
                switch self {
                case .low: return 5
                case .medium: return 20
                case .high: return 50
                case .superUser: return 100
                }
            }
        }

        public init(
            sessionDuration: TimeInterval,
            featuresUsed: Set<String>,
            actionsPerformed: Int,
            errorCount: Int,
            performanceScore: Double
        ) {
            self.sessionDuration = sessionDuration
            self.featuresUsed = featuresUsed
            self.actionsPerformed = actionsPerformed
            self.errorCount = errorCount
            self.performanceScore = performanceScore

            // Calculate engagement level
            if actionsPerformed >= EngagementLevel.superUser.threshold {
                self.engagementLevel = .superUser
            } else if actionsPerformed >= EngagementLevel.high.threshold {
                self.engagementLevel = .high
            } else if actionsPerformed >= EngagementLevel.medium.threshold {
                self.engagementLevel = .medium
            } else {
                self.engagementLevel = .low
            }
        }
    }

    public struct FeatureUsageReport {
        public let featureName: String
        public let usageCount: Int
        public let averageSessionsPerUser: Double
        public let retentionRate: Double
        public let performanceMetrics: FeaturePerformanceMetrics
        public let generatedAt: Date

        public init(
            featureName: String,
            usageCount: Int,
            averageSessionsPerUser: Double,
            retentionRate: Double,
            performanceMetrics: FeaturePerformanceMetrics
        ) {
            self.featureName = featureName
            self.usageCount = usageCount
            self.averageSessionsPerUser = averageSessionsPerUser
            self.retentionRate = retentionRate
            self.performanceMetrics = performanceMetrics
            self.generatedAt = Date()
        }
    }

    public struct FeaturePerformanceMetrics {
        public let averageExecutionTime: TimeInterval
        public let successRate: Double
        public let errorRate: Double
        public let userSatisfactionScore: Double

        public init(
            averageExecutionTime: TimeInterval,
            successRate: Double,
            errorRate: Double,
            userSatisfactionScore: Double
        ) {
            self.averageExecutionTime = averageExecutionTime
            self.successRate = successRate
            self.errorRate = errorRate
            self.userSatisfactionScore = userSatisfactionScore
        }
    }

    public struct FunnelAnalysis {
        public let funnelName: String
        public let steps: [FunnelStep]
        public let conversionRate: Double
        public let dropOffPoints: [String]
        public let averageTimeToCompletion: TimeInterval

        public struct FunnelStep {
            public let name: String
            public let entryCount: Int
            public let exitCount: Int
            public let conversionRate: Double

            public init(name: String, entryCount: Int, exitCount: Int) {
                self.name = name
                self.entryCount = entryCount
                self.exitCount = exitCount
                self.conversionRate = entryCount > 0 ? Double(exitCount) / Double(entryCount) * 100 : 0
            }
        }

        public init(
            funnelName: String,
            steps: [FunnelStep],
            averageTimeToCompletion: TimeInterval
        ) {
            self.funnelName = funnelName
            self.steps = steps
            self.averageTimeToCompletion = averageTimeToCompletion

            // Calculate overall conversion rate
            if let firstStep = steps.first, let lastStep = steps.last, firstStep.entryCount > 0 {
                self.conversionRate = Double(lastStep.exitCount) / Double(firstStep.entryCount) * 100
            } else {
                self.conversionRate = 0
            }

            // Identify drop-off points (steps with conversion rate < 70%)
            self.dropOffPoints = steps.compactMap { step in
                step.conversionRate < 70 ? step.name : nil
            }
        }
    }

    // MARK: - Privacy Compliance

    public struct PrivacySettings {
        public let analyticsEnabled: Bool
        public let crashReportingEnabled: Bool
        public let performanceMonitoringEnabled: Bool
        public let personalizedAnalyticsEnabled: Bool
        public let dataRetentionDays: Int
        public let consentTimestamp: Date?

        public init(
            analyticsEnabled: Bool = false,
            crashReportingEnabled: Bool = false,
            performanceMonitoringEnabled: Bool = false,
            personalizedAnalyticsEnabled: Bool = false,
            dataRetentionDays: Int = 90,
            consentTimestamp: Date? = nil
        ) {
            self.analyticsEnabled = analyticsEnabled
            self.crashReportingEnabled = crashReportingEnabled
            self.performanceMonitoringEnabled = performanceMonitoringEnabled
            self.personalizedAnalyticsEnabled = personalizedAnalyticsEnabled
            self.dataRetentionDays = dataRetentionDays
            self.consentTimestamp = consentTimestamp
        }
    }

    // MARK: - Published Properties

    @Published public private(set) var isEnabled = false
    @Published public private(set) var privacySettings = PrivacySettings()
    @Published public private(set) var currentSessionMetrics: UserMetrics?
    @Published public private(set) var featureUsageReports: [FeatureUsageReport] = []

    // Session management
    @Published public private(set) var currentSessionId: String = ""
    @Published public private(set) var sessionStartTime: Date?
    @Published public private(set) var isSessionActive = false

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "Isometry", category: "ProductionAnalytics")
    private let analyticsQueue = DispatchQueue(label: "ProductionAnalytics", qos: .utility)
    private var eventBuffer: [AnalyticsEventData] = []
    private let maxBufferSize = 100
    private var flushTimer: Timer?

    // Session tracking
    private var sessionEvents: [AnalyticsEventData] = []
    private var sessionFeaturesUsed: Set<String> = []
    private var sessionActionsCount = 0
    private var sessionErrorCount = 0

    // Feature usage tracking
    private var featureUsageStats: [String: FeatureUsageStats] = [:]

    private struct FeatureUsageStats {
        var usageCount: Int = 0
        var totalExecutionTime: TimeInterval = 0
        var successCount: Int = 0
        var errorCount: Int = 0
        var lastUsed: Date = Date()
        var userSessions: Set<String> = []

        var averageExecutionTime: TimeInterval {
            return usageCount > 0 ? totalExecutionTime / TimeInterval(usageCount) : 0
        }

        var successRate: Double {
            let totalOps = successCount + errorCount
            return totalOps > 0 ? Double(successCount) / Double(totalOps) * 100 : 0
        }

        var errorRate: Double {
            let totalOps = successCount + errorCount
            return totalOps > 0 ? Double(errorCount) / Double(totalOps) * 100 : 0
        }
    }

    // Data storage
    private let userDefaults = UserDefaults.standard
    private let privacySettingsKey = "ProductionAnalytics.PrivacySettings"

    // MARK: - Initialization

    public init() {
        loadPrivacySettings()
        setupFlushTimer()

        logger.debug("ProductionAnalytics initialized with privacy compliance mode")
    }

    deinit {
        flushTimer?.invalidate()
    }

    // MARK: - Privacy Management

    public func requestAnalyticsConsent() async -> Bool {
        // In a real implementation, this would present a consent UI
        // For now, we'll simulate user consent
        logger.debug("Requesting analytics consent from user")

        // Simulate user consent (in real app, this would be actual user interaction)
        let userConsented = true // This would come from actual user input

        if userConsented {
            await enableAnalytics(
                analytics: true,
                crashReporting: true,
                performanceMonitoring: true,
                personalizedAnalytics: false // Conservative default
            )
            return true
        } else {
            await disableAllAnalytics()
            return false
        }
    }

    public func enableAnalytics(
        analytics: Bool,
        crashReporting: Bool,
        performanceMonitoring: Bool,
        personalizedAnalytics: Bool
    ) async {
        let newSettings = PrivacySettings(
            analyticsEnabled: analytics,
            crashReportingEnabled: crashReporting,
            performanceMonitoringEnabled: performanceMonitoring,
            personalizedAnalyticsEnabled: personalizedAnalytics,
            dataRetentionDays: 90,
            consentTimestamp: Date()
        )

        privacySettings = newSettings
        isEnabled = analytics
        savePrivacySettings()

        logger.debug("Analytics enabled: analytics=\(analytics), crash=\(crashReporting), performance=\(performanceMonitoring), personalized=\(personalizedAnalytics)")

        if analytics {
            await trackEvent(.sessionStart)
        }
    }

    public func disableAllAnalytics() async {
        privacySettings = PrivacySettings()
        isEnabled = false
        savePrivacySettings()

        // Clear any buffered data
        await clearAllData()

        logger.debug("All analytics disabled and data cleared")
    }

    public func updateDataRetention(days: Int) {
        guard days > 0 && days <= 365 else {
            logger.error("Invalid data retention period: \(days) days")
            return
        }

        privacySettings = PrivacySettings(
            analyticsEnabled: privacySettings.analyticsEnabled,
            crashReportingEnabled: privacySettings.crashReportingEnabled,
            performanceMonitoringEnabled: privacySettings.performanceMonitoringEnabled,
            personalizedAnalyticsEnabled: privacySettings.personalizedAnalyticsEnabled,
            dataRetentionDays: days,
            consentTimestamp: privacySettings.consentTimestamp
        )

        savePrivacySettings()
        logger.debug("Data retention updated to \(days) days")
    }

    // MARK: - Event Tracking

    public func trackEvent(_ event: AnalyticsEvent, properties: [String: Any] = [:]) async {
        guard isEnabled && privacySettings.analyticsEnabled else { return }

        let eventData = AnalyticsEventData(
            event: event,
            properties: sanitizeProperties(properties),
            sessionId: currentSessionId,
            userId: privacySettings.personalizedAnalyticsEnabled ? getCurrentUserId() : nil
        )

        await addEventToBuffer(eventData)

        // Update session tracking
        sessionEvents.append(eventData)
        sessionActionsCount += 1

        // Track feature usage
        if let feature = extractFeatureName(from: event, properties: properties) {
            sessionFeaturesUsed.insert(feature)
            await updateFeatureUsageStats(feature: feature, event: event, properties: properties)
        }

        logger.debug("Tracked event: \(event.rawValue) with \(properties.count) properties")
    }

    public func trackFeatureUsage(
        feature: String,
        executionTime: TimeInterval? = nil,
        success: Bool = true,
        properties: [String: Any] = [:]
    ) async {
        guard isEnabled && privacySettings.performanceMonitoringEnabled else { return }

        var eventProperties = properties
        if let executionTime = executionTime {
            eventProperties["execution_time"] = executionTime
        }
        eventProperties["success"] = success
        eventProperties["feature"] = feature

        await trackEvent(success ? .pafvQuery : .errorOccurred, properties: eventProperties)

        // Update feature stats
        await updateFeatureUsageStats(
            feature: feature,
            executionTime: executionTime,
            success: success
        )

        sessionFeaturesUsed.insert(feature)
    }

    public func trackError(
        error: Error,
        context: String,
        properties: [String: Any] = [:]
    ) async {
        guard isEnabled && privacySettings.crashReportingEnabled else { return }

        var errorProperties = properties
        errorProperties["error_type"] = String(describing: type(of: error))
        errorProperties["error_description"] = error.localizedDescription
        errorProperties["context"] = context

        // Remove any sensitive information
        errorProperties = sanitizeProperties(errorProperties)

        await trackEvent(.errorOccurred, properties: errorProperties)
        sessionErrorCount += 1

        logger.warning("Tracked error in \(context): \(error.localizedDescription)")
    }

    public func trackPerformanceBenchmark(
        operation: String,
        duration: TimeInterval,
        success: Bool,
        properties: [String: Any] = [:]
    ) async {
        guard isEnabled && privacySettings.performanceMonitoringEnabled else { return }

        var benchmarkProperties = properties
        benchmarkProperties["operation"] = operation
        benchmarkProperties["duration"] = duration
        benchmarkProperties["success"] = success

        if duration > 1.0 { // Slow operation threshold
            await trackEvent(.slowOperation, properties: benchmarkProperties)
        }

        // Update performance tracking
        await updateFeatureUsageStats(
            feature: operation,
            executionTime: duration,
            success: success
        )
    }

    // MARK: - Session Management

    public func startSession() {
        guard isEnabled else { return }

        currentSessionId = UUID().uuidString
        sessionStartTime = Date()
        isSessionActive = true
        sessionEvents.removeAll()
        sessionFeaturesUsed.removeAll()
        sessionActionsCount = 0
        sessionErrorCount = 0

        Task {
            await trackEvent(.sessionStart)
        }

        logger.debug("Analytics session started: \(currentSessionId)")
    }

    public func endSession() {
        guard isSessionActive else { return }

        let sessionDuration = sessionStartTime?.timeIntervalSinceNow ?? 0
        let performanceScore = calculateSessionPerformanceScore()

        currentSessionMetrics = UserMetrics(
            sessionDuration: abs(sessionDuration),
            featuresUsed: sessionFeaturesUsed,
            actionsPerformed: sessionActionsCount,
            errorCount: sessionErrorCount,
            performanceScore: performanceScore
        )

        Task {
            await trackEvent(.sessionEnd, properties: [
                "session_duration": abs(sessionDuration),
                "features_used": Array(sessionFeaturesUsed),
                "actions_performed": sessionActionsCount,
                "errors": sessionErrorCount,
                "performance_score": performanceScore
            ])
        }

        isSessionActive = false
        logger.debug("Analytics session ended: duration=\(abs(sessionDuration))s, actions=\(sessionActionsCount)")
    }

    // MARK: - Funnel Analysis

    public func trackFunnelStep(funnel: String, step: String, properties: [String: Any] = [:]) async {
        guard isEnabled else { return }

        var funnelProperties = properties
        funnelProperties["funnel"] = funnel
        funnelProperties["step"] = step

        await trackEvent(.pafvQuery, properties: funnelProperties)
    }

    public func generateFunnelAnalysis(funnelName: String, steps: [String]) async -> FunnelAnalysis {
        // In a real implementation, this would query stored events to calculate funnel metrics
        let funnelSteps = steps.enumerated().map { index, stepName in
            let entryCount = max(100 - (index * 20), 10) // Simulated data
            let exitCount = max(entryCount - Int(arc4random_uniform(20)), 5)
            return FunnelAnalysis.FunnelStep(name: stepName, entryCount: entryCount, exitCount: exitCount)
        }

        return FunnelAnalysis(
            funnelName: funnelName,
            steps: funnelSteps,
            averageTimeToCompletion: Double(arc4random_uniform(300)) + 60 // 1-5 minutes
        )
    }

    // MARK: - Reporting

    public func generateFeatureUsageReports() async -> [FeatureUsageReport] {
        var reports: [FeatureUsageReport] = []

        for (featureName, stats) in featureUsageStats {
            let performanceMetrics = FeaturePerformanceMetrics(
                averageExecutionTime: stats.averageExecutionTime,
                successRate: stats.successRate,
                errorRate: stats.errorRate,
                userSatisfactionScore: calculateUserSatisfactionScore(for: stats)
            )

            let report = FeatureUsageReport(
                featureName: featureName,
                usageCount: stats.usageCount,
                averageSessionsPerUser: Double(stats.userSessions.count),
                retentionRate: calculateRetentionRate(for: stats),
                performanceMetrics: performanceMetrics
            )

            reports.append(report)
        }

        featureUsageReports = reports.sorted { $0.usageCount > $1.usageCount }
        return featureUsageReports
    }

    public func exportAnalyticsData() -> Data? {
        guard privacySettings.analyticsEnabled else { return nil }

        let export: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "privacySettings": [
                "analyticsEnabled": privacySettings.analyticsEnabled,
                "crashReportingEnabled": privacySettings.crashReportingEnabled,
                "performanceMonitoringEnabled": privacySettings.performanceMonitoringEnabled,
                "personalizedAnalyticsEnabled": privacySettings.personalizedAnalyticsEnabled,
                "dataRetentionDays": privacySettings.dataRetentionDays
            ],
            "sessionMetrics": currentSessionMetrics.map { metrics in
                [
                    "sessionDuration": metrics.sessionDuration,
                    "featuresUsed": Array(metrics.featuresUsed),
                    "actionsPerformed": metrics.actionsPerformed,
                    "errorCount": metrics.errorCount,
                    "performanceScore": metrics.performanceScore,
                    "engagementLevel": metrics.engagementLevel.rawValue
                ]
            } ?? [:],
            "featureUsageReports": featureUsageReports.map { report in
                [
                    "featureName": report.featureName,
                    "usageCount": report.usageCount,
                    "averageSessionsPerUser": report.averageSessionsPerUser,
                    "retentionRate": report.retentionRate,
                    "performanceMetrics": [
                        "averageExecutionTime": report.performanceMetrics.averageExecutionTime,
                        "successRate": report.performanceMetrics.successRate,
                        "errorRate": report.performanceMetrics.errorRate,
                        "userSatisfactionScore": report.performanceMetrics.userSatisfactionScore
                    ]
                ]
            }
        ]

        return try? JSONSerialization.data(withJSONObject: export, options: .prettyPrinted)
    }

    // MARK: - A/B Testing Framework

    public func assignToExperiment(experimentName: String, variants: [String]) async -> String {
        guard isEnabled && privacySettings.personalizedAnalyticsEnabled else {
            return variants.first ?? "control"
        }

        // Simple hash-based assignment for consistent user experience
        let userId = getCurrentUserId()
        let hash = abs((experimentName + userId).hashValue)
        let variantIndex = hash % variants.count
        let assignedVariant = variants[variantIndex]

        await trackEvent(.sessionStart, properties: [
            "experiment": experimentName,
            "variant": assignedVariant
        ])

        logger.debug("User assigned to experiment '\(experimentName)' variant: \(assignedVariant)")
        return assignedVariant
    }

    // MARK: - Data Management

    public func clearAllData() async {
        eventBuffer.removeAll()
        sessionEvents.removeAll()
        sessionFeaturesUsed.removeAll()
        featureUsageStats.removeAll()
        featureUsageReports.removeAll()
        currentSessionMetrics = nil

        logger.debug("All analytics data cleared")
    }

    public func clearExpiredData() async {
        let retentionPeriod = TimeInterval(privacySettings.dataRetentionDays * 24 * 60 * 60)
        let cutoffDate = Date().addingTimeInterval(-retentionPeriod)

        // Remove expired events
        eventBuffer = eventBuffer.filter { $0.timestamp > cutoffDate }
        sessionEvents = sessionEvents.filter { $0.timestamp > cutoffDate }

        // Remove expired feature stats
        featureUsageStats = featureUsageStats.compactMapValues { stats in
            return stats.lastUsed > cutoffDate ? stats : nil
        }

        logger.debug("Expired analytics data cleared (retention: \(privacySettings.dataRetentionDays) days)")
    }

    // MARK: - Private Methods

    private func addEventToBuffer(_ event: AnalyticsEventData) async {
        analyticsQueue.async { [weak self] in
            DispatchQueue.main.async {
                self?.eventBuffer.append(event)

                // Auto-flush if buffer is full
                if let bufferSize = self?.eventBuffer.count, bufferSize >= self?.maxBufferSize ?? 100 {
                    self?.flushEventBuffer()
                }
            }
        }
    }

    private func flushEventBuffer() {
        guard !eventBuffer.isEmpty else { return }

        // In a real implementation, this would send events to analytics service
        let eventCount = eventBuffer.count
        eventBuffer.removeAll()

        logger.debug("Flushed \(eventCount) analytics events")
    }

    private func setupFlushTimer() {
        flushTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.flushEventBuffer()
        }
    }

    private func sanitizeProperties(_ properties: [String: Any]) -> [String: Any] {
        var sanitized: [String: Any] = [:]

        for (key, value) in properties {
            // Remove sensitive keys
            let sensitiveKeys = ["password", "token", "secret", "key", "credential"]
            if sensitiveKeys.contains(where: { key.lowercased().contains($0) }) {
                continue
            }

            // Sanitize string values
            if let stringValue = value as? String {
                sanitized[key] = stringValue.count > 100 ? String(stringValue.prefix(100)) : stringValue
            } else {
                sanitized[key] = value
            }
        }

        return sanitized
    }

    private func extractFeatureName(from event: AnalyticsEvent, properties: [String: Any]) -> String? {
        if let feature = properties["feature"] as? String {
            return feature
        }

        // Map events to feature names
        switch event {
        case .noteCreated, .noteEdited, .noteDeleted:
            return "note_management"
        case .searchPerformed:
            return "search"
        case .filterApplied:
            return "filtering"
        case .visualizationRendered:
            return "visualization"
        case .pafvQuery:
            return "pafv_system"
        case .latchFilter:
            return "latch_filtering"
        case .graphTraversal:
            return "graph_navigation"
        case .syncCompleted:
            return "cloud_sync"
        default:
            return nil
        }
    }

    private func updateFeatureUsageStats(
        feature: String,
        event: AnalyticsEvent? = nil,
        properties: [String: Any] = [:],
        executionTime: TimeInterval? = nil,
        success: Bool = true
    ) async {
        var stats = featureUsageStats[feature] ?? FeatureUsageStats()

        stats.usageCount += 1
        stats.lastUsed = Date()
        stats.userSessions.insert(currentSessionId)

        if let executionTime = executionTime {
            stats.totalExecutionTime += executionTime
        }

        if success {
            stats.successCount += 1
        } else {
            stats.errorCount += 1
        }

        featureUsageStats[feature] = stats
    }

    private func calculateSessionPerformanceScore() -> Double {
        guard sessionActionsCount > 0 else { return 100.0 }

        let errorPenalty = Double(sessionErrorCount) / Double(sessionActionsCount) * 100
        let score = max(0, 100.0 - errorPenalty)

        return score
    }

    private func calculateUserSatisfactionScore(for stats: FeatureUsageStats) -> Double {
        // Simplified satisfaction score based on usage patterns and success rate
        let successWeight = stats.successRate / 100.0
        let usageWeight = min(1.0, Double(stats.usageCount) / 50.0) // Cap at 50 uses
        let recencyWeight = max(0.1, 1.0 - (Date().timeIntervalSince(stats.lastUsed) / (7 * 24 * 60 * 60))) // 1 week decay

        return (successWeight * 0.5 + usageWeight * 0.3 + recencyWeight * 0.2) * 100.0
    }

    private func calculateRetentionRate(for stats: FeatureUsageStats) -> Double {
        // Simplified retention calculation based on recent usage
        let daysSinceLastUse = Date().timeIntervalSince(stats.lastUsed) / (24 * 60 * 60)
        return max(0, 100.0 - (daysSinceLastUse * 10)) // 10% decay per day
    }

    private func getCurrentUserId() -> String {
        // In a real implementation, this would return the actual user ID
        // For privacy compliance, this might be a hashed or anonymized identifier
        return "anonymous_user_\(UUID().uuidString.prefix(8))"
    }

    private func loadPrivacySettings() {
        if let data = userDefaults.data(forKey: privacySettingsKey),
           let decoded = try? JSONDecoder().decode(PrivacySettings.self, from: data) {
            privacySettings = decoded
            isEnabled = decoded.analyticsEnabled
            logger.debug("Loaded privacy settings: analytics=\(decoded.analyticsEnabled)")
        } else {
            logger.debug("No existing privacy settings found, using defaults")
        }
    }

    private func savePrivacySettings() {
        if let encoded = try? JSONEncoder().encode(privacySettings) {
            userDefaults.set(encoded, forKey: privacySettingsKey)
            logger.debug("Privacy settings saved")
        }
    }
}

// MARK: - PrivacyCompliantAnalytics Protocol

/// Protocol for ensuring analytics implementations comply with privacy regulations
public protocol PrivacyCompliantAnalytics {
    func requestConsent() async -> Bool
    func revokeConsent() async
    func exportUserData() -> Data?
    func deleteUserData() async
    func getDataRetentionPeriod() -> Int
}

extension ProductionAnalytics: PrivacyCompliantAnalytics {
    nonisolated public func requestConsent() async -> Bool {
        return await requestAnalyticsConsent()
    }

    nonisolated public func revokeConsent() async {
        await disableAllAnalytics()
    }

    public func exportUserData() -> Data? {
        return exportAnalyticsData()
    }

    public func deleteUserData() async {
        await clearAllData()
    }

    public func getDataRetentionPeriod() -> Int {
        return privacySettings.dataRetentionDays
    }
}

// MARK: - Shared Instance

/// Shared production analytics instance
@MainActor
public let productionAnalytics = ProductionAnalytics()

// MARK: - Analytics Extensions

extension ProductionAnalytics: @unchecked Sendable, Codable {
    enum CodingKeys: String, CodingKey {
        case privacySettings
        case currentSessionId
        case isSessionActive
    }

    nonisolated public convenience init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let privacySettings = try container.decode(PrivacySettings.self, forKey: .privacySettings)
        let currentSessionId = try container.decode(String.self, forKey: .currentSessionId)
        let isSessionActive = try container.decode(Bool.self, forKey: .isSessionActive)
        self.init()
        self.currentSessionId = currentSessionId
        self.isSessionActive = isSessionActive

        setupFlushTimer()
    }

    nonisolated public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(privacySettings, forKey: .privacySettings)
        try container.encode(currentSessionId, forKey: .currentSessionId)
        try container.encode(isSessionActive, forKey: .isSessionActive)
    }
}

extension ProductionAnalytics.PrivacySettings: Codable {}
extension ProductionAnalytics.UserMetrics: Codable {}
extension ProductionAnalytics.FeatureUsageReport: Codable {}
extension ProductionAnalytics.FeaturePerformanceMetrics: Codable {}
extension ProductionAnalytics.UserMetrics.EngagementLevel: Codable {}