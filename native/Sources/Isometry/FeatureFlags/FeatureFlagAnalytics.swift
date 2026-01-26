import Foundation
import Combine
import os.log
import CoreML

/// Feature flag analytics and performance tracking system
@MainActor
public final class FeatureFlagAnalytics: ObservableObject, Sendable {

    // MARK: - Published Properties

    @Published public private(set) var evaluationMetrics: EvaluationMetrics = EvaluationMetrics()
    @Published public private(set) var flagUsageStats: [String: FlagUsageStats] = [:]
    @Published public private(set) var performanceMetrics: PerformanceMetrics = PerformanceMetrics()

    // MARK: - Private Properties

    private let storage: AnalyticsStorage
    private let logger = Logger(subsystem: "com.isometry.app", category: "FeatureFlagAnalytics")
    private var analyticsBuffer: [AnalyticsEvent] = []
    private let bufferSize = 100
    private let flushInterval: TimeInterval = 30.0
    private var flushTimer: Timer?
    private var subscriptions = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(storage: AnalyticsStorage = UserDefaultsAnalyticsStorage()) {
        self.storage = storage
        loadStoredMetrics()
        setupPeriodicFlush()
    }

    deinit {
        flushTimer?.invalidate()
        flushAnalytics()
    }

    // MARK: - Public API

    /// Track feature flag evaluation with performance metrics
    public func trackFlagEvaluation(_ flagName: String, evaluationTime: TimeInterval, userId: String? = nil) {
        let event = AnalyticsEvent(
            type: .flagEvaluation,
            flagName: flagName,
            userId: userId,
            metadata: [
                "evaluationTime": evaluationTime,
                "timestamp": Date().timeIntervalSince1970
            ]
        )

        addEvent(event)
        updateEvaluationMetrics(flagName: flagName, evaluationTime: evaluationTime)
        updateFlagUsageStats(flagName: flagName, userId: userId)
    }

    /// Track feature flag change events
    public func trackFlagChange(_ flagName: String, change: FlagChange) {
        let event = AnalyticsEvent(
            type: .flagChange,
            flagName: flagName,
            metadata: [
                "changeType": changeTypeString(change),
                "timestamp": Date().timeIntervalSince1970
            ]
        )

        addEvent(event)
        updateChangeMetrics(flagName: flagName, change: change)
    }

    /// Track feature flag performance impact
    public func trackPerformanceImpact(_ flagName: String, impact: PerformanceImpact) {
        let event = AnalyticsEvent(
            type: .performanceImpact,
            flagName: flagName,
            metadata: [
                "cpuUsage": impact.cpuUsage,
                "memoryUsage": impact.memoryUsage,
                "networkRequests": impact.networkRequests,
                "timestamp": Date().timeIntervalSince1970
            ]
        )

        addEvent(event)
        updatePerformanceMetrics(flagName: flagName, impact: impact)
    }

    /// Get analytics report for specific flag
    public func getAnalyticsReport(for flagName: String) -> FlagAnalyticsReport? {
        guard let usageStats = flagUsageStats[flagName] else { return nil }

        let events = getStoredEvents().filter { $0.flagName == flagName }
        let evaluationEvents = events.filter { $0.type == .flagEvaluation }
        let changeEvents = events.filter { $0.type == .flagChange }

        return FlagAnalyticsReport(
            flagName: flagName,
            usageStats: usageStats,
            evaluationCount: evaluationEvents.count,
            changeCount: changeEvents.count,
            averageEvaluationTime: calculateAverageEvaluationTime(from: evaluationEvents),
            performanceImpact: getPerformanceImpact(for: flagName),
            userSegmentation: calculateUserSegmentation(from: evaluationEvents),
            timeSeriesData: generateTimeSeriesData(from: evaluationEvents)
        )
    }

    /// Get comprehensive analytics dashboard data
    public func getAnalyticsDashboard() -> AnalyticsDashboard {
        return AnalyticsDashboard(
            overallMetrics: evaluationMetrics,
            performanceMetrics: performanceMetrics,
            flagUsageStats: flagUsageStats,
            topFlags: getTopFlags(),
            performanceIssues: identifyPerformanceIssues(),
            recommendations: generateRecommendations()
        )
    }

    /// Export analytics data for external analysis
    public func exportAnalyticsData(format: AnalyticsExportFormat = .json) -> Data? {
        let exportData = AnalyticsExportData(
            evaluationMetrics: evaluationMetrics,
            flagUsageStats: flagUsageStats,
            performanceMetrics: performanceMetrics,
            events: getStoredEvents(),
            exportDate: Date()
        )

        switch format {
        case .json:
            return try? JSONEncoder().encode(exportData)
        case .csv:
            return exportToCSV(exportData)
        }
    }

    /// Clear all analytics data
    public func clearAnalytics() {
        analyticsBuffer.removeAll()
        flagUsageStats.removeAll()
        evaluationMetrics = EvaluationMetrics()
        performanceMetrics = PerformanceMetrics()
        storage.clearAllData()
        logger.info("Cleared all feature flag analytics data")
    }

    // MARK: - Private Methods

    private func addEvent(_ event: AnalyticsEvent) {
        analyticsBuffer.append(event)

        if analyticsBuffer.count >= bufferSize {
            flushAnalytics()
        }
    }

    private func updateEvaluationMetrics(flagName: String, evaluationTime: TimeInterval) {
        evaluationMetrics.totalEvaluations += 1
        evaluationMetrics.totalEvaluationTime += evaluationTime

        if evaluationTime > evaluationMetrics.slowestEvaluation {
            evaluationMetrics.slowestEvaluation = evaluationTime
            evaluationMetrics.slowestFlag = flagName
        }

        evaluationMetrics.averageEvaluationTime = evaluationMetrics.totalEvaluationTime / Double(evaluationMetrics.totalEvaluations)
    }

    private func updateFlagUsageStats(flagName: String, userId: String?) {
        var stats = flagUsageStats[flagName] ?? FlagUsageStats(flagName: flagName)
        stats.evaluationCount += 1
        stats.lastEvaluated = Date()

        if let userId = userId {
            stats.uniqueUsers.insert(userId)
        }

        flagUsageStats[flagName] = stats
    }

    private func updateChangeMetrics(flagName: String, change: FlagChange) {
        var stats = flagUsageStats[flagName] ?? FlagUsageStats(flagName: flagName)
        stats.changeCount += 1
        stats.lastChanged = Date()
        flagUsageStats[flagName] = stats
    }

    private func updatePerformanceMetrics(flagName: String, impact: PerformanceImpact) {
        performanceMetrics.totalCpuImpact += impact.cpuUsage
        performanceMetrics.totalMemoryImpact += impact.memoryUsage
        performanceMetrics.totalNetworkRequests += impact.networkRequests

        if impact.cpuUsage > performanceMetrics.highestCpuImpact {
            performanceMetrics.highestCpuImpact = impact.cpuUsage
            performanceMetrics.highestCpuFlag = flagName
        }
    }

    private func setupPeriodicFlush() {
        flushTimer = Timer.scheduledTimer(withTimeInterval: flushInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.flushAnalytics()
            }
        }
    }

    private func flushAnalytics() {
        guard !analyticsBuffer.isEmpty else { return }

        do {
            try storage.storeEvents(analyticsBuffer)
            try storage.storeMetrics(evaluationMetrics, flagUsageStats, performanceMetrics)
            analyticsBuffer.removeAll()
            logger.debug("Flushed \\(analyticsBuffer.count) analytics events")
        } catch {
            logger.error("Failed to flush analytics: \\(error)")
        }
    }

    private func loadStoredMetrics() {
        do {
            let (storedEvaluationMetrics, storedFlagStats, storedPerformanceMetrics) = try storage.loadMetrics()
            self.evaluationMetrics = storedEvaluationMetrics ?? EvaluationMetrics()
            self.flagUsageStats = storedFlagStats ?? [:]
            self.performanceMetrics = storedPerformanceMetrics ?? PerformanceMetrics()
        } catch {
            logger.warning("Failed to load stored analytics metrics: \\(error)")
        }
    }

    private func getStoredEvents() -> [AnalyticsEvent] {
        do {
            return try storage.loadEvents()
        } catch {
            logger.error("Failed to load stored events: \\(error)")
            return []
        }
    }

    private func changeTypeString(_ change: FlagChange) -> String {
        switch change {
        case .added: return "added"
        case .removed: return "removed"
        case .modified: return "modified"
        case .toggled(let from, let to): return "toggled_\\(from)_to_\\(to)"
        }
    }

    private func calculateAverageEvaluationTime(from events: [AnalyticsEvent]) -> TimeInterval {
        let evaluationTimes = events.compactMap { $0.metadata["evaluationTime"] as? TimeInterval }
        guard !evaluationTimes.isEmpty else { return 0.0 }
        return evaluationTimes.reduce(0, +) / Double(evaluationTimes.count)
    }

    private func getPerformanceImpact(for flagName: String) -> PerformanceImpact? {
        let events = getStoredEvents().filter { $0.flagName == flagName && $0.type == .performanceImpact }
        guard !events.isEmpty else { return nil }

        let totalCpu = events.compactMap { $0.metadata["cpuUsage"] as? Double }.reduce(0, +)
        let totalMemory = events.compactMap { $0.metadata["memoryUsage"] as? Double }.reduce(0, +)
        let totalNetwork = events.compactMap { $0.metadata["networkRequests"] as? Int }.reduce(0, +)

        return PerformanceImpact(
            cpuUsage: totalCpu / Double(events.count),
            memoryUsage: totalMemory / Double(events.count),
            networkRequests: totalNetwork / events.count
        )
    }

    private func calculateUserSegmentation(from events: [AnalyticsEvent]) -> UserSegmentation {
        let userIds = events.compactMap { $0.userId }
        let uniqueUsers = Set(userIds)

        // Simple segmentation based on usage frequency
        let usageFrequency: [String: Int] = userIds.reduce(into: [:]) { counts, userId in
            counts[userId, default: 0] += 1
        }

        let heavyUsers = usageFrequency.filter { $0.value > 10 }.count
        let moderateUsers = usageFrequency.filter { $0.value > 3 && $0.value <= 10 }.count
        let lightUsers = usageFrequency.filter { $0.value <= 3 }.count

        return UserSegmentation(
            totalUsers: uniqueUsers.count,
            heavyUsers: heavyUsers,
            moderateUsers: moderateUsers,
            lightUsers: lightUsers
        )
    }

    private func generateTimeSeriesData(from events: [AnalyticsEvent]) -> [(Date, Int)] {
        let calendar = Calendar.current
        let groupedEvents = Dictionary(grouping: events) { event in
            let timestamp = event.metadata["timestamp"] as? TimeInterval ?? 0
            let date = Date(timeIntervalSince1970: timestamp)
            return calendar.startOfDay(for: date)
        }

        return groupedEvents.map { (date, events) in
            (date, events.count)
        }.sorted { $0.0 < $1.0 }
    }

    private func getTopFlags() -> [TopFlag] {
        return flagUsageStats.values
            .sorted { $0.evaluationCount > $1.evaluationCount }
            .prefix(10)
            .map { stats in
                TopFlag(
                    name: stats.flagName,
                    evaluationCount: stats.evaluationCount,
                    uniqueUsers: stats.uniqueUsers.count,
                    changeCount: stats.changeCount
                )
            }
    }

    private func identifyPerformanceIssues() -> [PerformanceIssue] {
        var issues: [PerformanceIssue] = []

        // Check for slow flag evaluations
        for (flagName, stats) in flagUsageStats {
            let report = getAnalyticsReport(for: flagName)
            if let avgTime = report?.averageEvaluationTime, avgTime > 0.001 { // 1ms threshold
                issues.append(PerformanceIssue(
                    type: .slowEvaluation,
                    flagName: flagName,
                    description: "Flag evaluation taking \\(String(format: "%.3f", avgTime * 1000))ms on average",
                    severity: avgTime > 0.005 ? .high : .medium
                ))
            }
        }

        // Check for high CPU impact
        if performanceMetrics.highestCpuImpact > 0.1 { // 10% CPU threshold
            issues.append(PerformanceIssue(
                type: .highCpuUsage,
                flagName: performanceMetrics.highestCpuFlag ?? "unknown",
                description: "High CPU usage: \\(String(format: "%.1f", performanceMetrics.highestCpuImpact * 100))%",
                severity: .high
            ))
        }

        return issues
    }

    private func generateRecommendations() -> [AnalyticsRecommendation] {
        var recommendations: [AnalyticsRecommendation] = []

        // Recommend caching for frequently evaluated flags
        for (flagName, stats) in flagUsageStats {
            if stats.evaluationCount > 1000 && stats.uniqueUsers.count < 10 {
                recommendations.append(AnalyticsRecommendation(
                    type: .enableCaching,
                    flagName: flagName,
                    description: "High evaluation count with low user diversity - consider caching",
                    priority: .medium
                ))
            }
        }

        // Recommend cleanup for unused flags
        let recentThreshold = Date().addingTimeInterval(-30 * 24 * 60 * 60) // 30 days ago
        for (flagName, stats) in flagUsageStats {
            if stats.lastEvaluated < recentThreshold {
                recommendations.append(AnalyticsRecommendation(
                    type: .removeUnusedFlag,
                    flagName: flagName,
                    description: "Flag not evaluated in 30+ days - consider removal",
                    priority: .low
                ))
            }
        }

        return recommendations
    }

    private func exportToCSV(_ data: AnalyticsExportData) -> Data? {
        var csv = "FlagName,EvaluationCount,UniqueUsers,AverageEvaluationTime,ChangeCount\\n"

        for (flagName, stats) in data.flagUsageStats {
            let report = getAnalyticsReport(for: flagName)
            let avgTime = report?.averageEvaluationTime ?? 0
            csv += "\\(flagName),\\(stats.evaluationCount),\\(stats.uniqueUsers.count),\\(avgTime),\\(stats.changeCount)\\n"
        }

        return csv.data(using: .utf8)
    }
}

// MARK: - Supporting Types

/// Analytics event types
public enum AnalyticsEventType: String, Codable, Sendable {
    case flagEvaluation
    case flagChange
    case performanceImpact
}

/// Individual analytics event
public struct AnalyticsEvent: Codable, Sendable {
    public let id: UUID
    public let type: AnalyticsEventType
    public let flagName: String
    public let userId: String?
    public let metadata: [String: Any]
    public let timestamp: Date

    public init(
        type: AnalyticsEventType,
        flagName: String,
        userId: String? = nil,
        metadata: [String: Any] = [:]
    ) {
        self.id = UUID()
        self.type = type
        self.flagName = flagName
        self.userId = userId
        self.metadata = metadata
        self.timestamp = Date()
    }

    // Custom coding to handle Any type in metadata
    private enum CodingKeys: String, CodingKey {
        case id, type, flagName, userId, timestamp
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(flagName, forKey: .flagName)
        try container.encode(userId, forKey: .userId)
        try container.encode(timestamp, forKey: .timestamp)
        // Note: metadata is excluded from encoding due to Any type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        type = try container.decode(AnalyticsEventType.self, forKey: .type)
        flagName = try container.decode(String.self, forKey: .flagName)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        metadata = [:] // Default empty metadata for decoded events
    }
}

/// Evaluation performance metrics
public struct EvaluationMetrics: Codable, Sendable {
    public var totalEvaluations: Int = 0
    public var totalEvaluationTime: TimeInterval = 0
    public var averageEvaluationTime: TimeInterval = 0
    public var slowestEvaluation: TimeInterval = 0
    public var slowestFlag: String? = nil
}

/// Per-flag usage statistics
public struct FlagUsageStats: Codable, Sendable {
    public let flagName: String
    public var evaluationCount: Int = 0
    public var changeCount: Int = 0
    public var uniqueUsers: Set<String> = []
    public var lastEvaluated: Date = Date()
    public var lastChanged: Date = Date()

    public init(flagName: String) {
        self.flagName = flagName
    }
}

/// System performance metrics
public struct PerformanceMetrics: Codable, Sendable {
    public var totalCpuImpact: Double = 0
    public var totalMemoryImpact: Double = 0
    public var totalNetworkRequests: Int = 0
    public var highestCpuImpact: Double = 0
    public var highestCpuFlag: String? = nil
}

/// Performance impact data
public struct PerformanceImpact: Codable, Sendable {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let networkRequests: Int

    public init(cpuUsage: Double, memoryUsage: Double, networkRequests: Int) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.networkRequests = networkRequests
    }
}

/// Analytics report for individual flag
public struct FlagAnalyticsReport: Sendable {
    public let flagName: String
    public let usageStats: FlagUsageStats
    public let evaluationCount: Int
    public let changeCount: Int
    public let averageEvaluationTime: TimeInterval
    public let performanceImpact: PerformanceImpact?
    public let userSegmentation: UserSegmentation
    public let timeSeriesData: [(Date, Int)]
}

/// User segmentation data
public struct UserSegmentation: Sendable {
    public let totalUsers: Int
    public let heavyUsers: Int
    public let moderateUsers: Int
    public let lightUsers: Int
}

/// Analytics dashboard data
public struct AnalyticsDashboard: Sendable {
    public let overallMetrics: EvaluationMetrics
    public let performanceMetrics: PerformanceMetrics
    public let flagUsageStats: [String: FlagUsageStats]
    public let topFlags: [TopFlag]
    public let performanceIssues: [PerformanceIssue]
    public let recommendations: [AnalyticsRecommendation]
}

/// Top flag data for dashboard
public struct TopFlag: Sendable {
    public let name: String
    public let evaluationCount: Int
    public let uniqueUsers: Int
    public let changeCount: Int
}

/// Performance issue identification
public struct PerformanceIssue: Sendable {
    public let type: IssueType
    public let flagName: String
    public let description: String
    public let severity: Severity

    public enum IssueType {
        case slowEvaluation
        case highCpuUsage
        case highMemoryUsage
        case excessiveNetworkRequests
    }

    public enum Severity {
        case low, medium, high
    }
}

/// Analytics recommendations
public struct AnalyticsRecommendation: Sendable {
    public let type: RecommendationType
    public let flagName: String
    public let description: String
    public let priority: Priority

    public enum RecommendationType {
        case enableCaching
        case removeUnusedFlag
        case optimizeEvaluation
        case splitComplexFlag
    }

    public enum Priority {
        case low, medium, high
    }
}

/// Export data structure
public struct AnalyticsExportData: Codable, Sendable {
    public let evaluationMetrics: EvaluationMetrics
    public let flagUsageStats: [String: FlagUsageStats]
    public let performanceMetrics: PerformanceMetrics
    public let events: [AnalyticsEvent]
    public let exportDate: Date
}

/// Export format options
public enum AnalyticsExportFormat {
    case json
    case csv
}

// MARK: - Storage Protocol

/// Analytics storage protocol for different backends
public protocol AnalyticsStorage {
    func storeEvents(_ events: [AnalyticsEvent]) throws
    func loadEvents() throws -> [AnalyticsEvent]
    func storeMetrics(_ evaluation: EvaluationMetrics, _ usage: [String: FlagUsageStats], _ performance: PerformanceMetrics) throws
    func loadMetrics() throws -> (EvaluationMetrics?, [String: FlagUsageStats]?, PerformanceMetrics?)
    func clearAllData()
}

/// UserDefaults-based analytics storage
public final class UserDefaultsAnalyticsStorage: AnalyticsStorage {
    private let eventsKey = "feature_flag_analytics_events"
    private let evaluationMetricsKey = "feature_flag_evaluation_metrics"
    private let usageStatsKey = "feature_flag_usage_stats"
    private let performanceMetricsKey = "feature_flag_performance_metrics"

    public init() {}

    public func storeEvents(_ events: [AnalyticsEvent]) throws {
        let data = try JSONEncoder().encode(events)
        UserDefaults.standard.set(data, forKey: eventsKey)
    }

    public func loadEvents() throws -> [AnalyticsEvent] {
        guard let data = UserDefaults.standard.data(forKey: eventsKey) else {
            return []
        }
        return try JSONDecoder().decode([AnalyticsEvent].self, from: data)
    }

    public func storeMetrics(_ evaluation: EvaluationMetrics, _ usage: [String: FlagUsageStats], _ performance: PerformanceMetrics) throws {
        let encoder = JSONEncoder()

        let evaluationData = try encoder.encode(evaluation)
        UserDefaults.standard.set(evaluationData, forKey: evaluationMetricsKey)

        let usageData = try encoder.encode(usage)
        UserDefaults.standard.set(usageData, forKey: usageStatsKey)

        let performanceData = try encoder.encode(performance)
        UserDefaults.standard.set(performanceData, forKey: performanceMetricsKey)
    }

    public func loadMetrics() throws -> (EvaluationMetrics?, [String: FlagUsageStats]?, PerformanceMetrics?) {
        let decoder = JSONDecoder()

        let evaluation: EvaluationMetrics?
        if let data = UserDefaults.standard.data(forKey: evaluationMetricsKey) {
            evaluation = try decoder.decode(EvaluationMetrics.self, from: data)
        } else {
            evaluation = nil
        }

        let usage: [String: FlagUsageStats]?
        if let data = UserDefaults.standard.data(forKey: usageStatsKey) {
            usage = try decoder.decode([String: FlagUsageStats].self, from: data)
        } else {
            usage = nil
        }

        let performance: PerformanceMetrics?
        if let data = UserDefaults.standard.data(forKey: performanceMetricsKey) {
            performance = try decoder.decode(PerformanceMetrics.self, from: data)
        } else {
            performance = nil
        }

        return (evaluation, usage, performance)
    }

    public func clearAllData() {
        UserDefaults.standard.removeObject(forKey: eventsKey)
        UserDefaults.standard.removeObject(forKey: evaluationMetricsKey)
        UserDefaults.standard.removeObject(forKey: usageStatsKey)
        UserDefaults.standard.removeObject(forKey: performanceMetricsKey)
    }
}