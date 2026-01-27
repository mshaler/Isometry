import Foundation
import Combine
import CloudKit
import os.log

/// Intelligent A/B testing infrastructure with statistical analysis and experiment lifecycle management
@MainActor
public final class ABTestManager: ObservableObject, Sendable {

    // MARK: - Published Properties

    @Published public private(set) var activeExperiments: [String: ABTest] = [:]
    @Published public private(set) var userAssignments: [String: String] = [:] // userId -> experimentId
    @Published public private(set) var experimentResults: [String: ExperimentResults] = [:]
    @Published public private(set) var isLoading: Bool = false

    // MARK: - Private Properties

    private let cloudKitManager: CloudKitSyncManager
    private let statistics: ABTestStatistics
    private let featureFlagManager: FeatureFlagManager
    private let storage: ABTestStorage
    private let logger = Logger(subsystem: "com.isometry.app", category: "ABTesting")
    private var subscriptions = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(
        cloudKitManager: CloudKitSyncManager,
        featureFlagManager: FeatureFlagManager,
        storage: ABTestStorage = UserDefaultsABTestStorage()
    ) {
        self.cloudKitManager = cloudKitManager
        self.featureFlagManager = featureFlagManager
        self.statistics = ABTestStatistics()
        self.storage = storage

        setupCloudKitSync()
        loadStoredData()
    }

    // MARK: - Public API

    /// Get user's variant assignment for an experiment
    public func getVariant(for experimentId: String, userId: String) -> ABTestVariant? {
        // Check if user is already assigned
        if let assignedExperiment = userAssignments[userId],
           assignedExperiment == experimentId {
            return activeExperiments[experimentId]?.assignedVariant(for: userId)
        }

        guard let experiment = activeExperiments[experimentId] else {
            logger.warning("Experiment not found: \\(experimentId)")
            return nil
        }

        // Check experiment eligibility
        guard experiment.isActive && isUserEligible(userId: userId, experiment: experiment) else {
            return nil
        }

        // Assign user to variant
        let variant = assignUserToVariant(userId: userId, experiment: experiment)
        userAssignments[userId] = experimentId

        // Track assignment
        trackEvent(.userAssigned, experimentId: experimentId, userId: userId, metadata: [
            "variant": variant.id,
            "timestamp": Date().timeIntervalSince1970
        ])

        // Update storage
        saveUserAssignments()

        logger.info("User \\(userId) assigned to variant \\(variant.id) in experiment \\(experimentId)")
        return variant
    }

    /// Track experiment event (conversion, goal completion, etc.)
    public func trackEvent(
        _ eventType: ABTestEventType,
        experimentId: String,
        userId: String,
        value: Double = 1.0,
        metadata: [String: String] = [:]
    ) {
        guard let experiment = activeExperiments[experimentId],
              let variant = experiment.assignedVariant(for: userId) else {
            logger.warning("Cannot track event for unassigned user \\(userId) in experiment \\(experimentId)")
            return
        }

        let event = ABTestEvent(
            id: UUID(),
            experimentId: experimentId,
            userId: userId,
            variantId: variant.id,
            eventType: eventType,
            value: value,
            metadata: metadata,
            timestamp: Date()
        )

        // Update experiment results
        updateExperimentResults(for: experimentId, event: event)

        // Store event
        storage.storeEvent(event)

        // Check for statistical significance
        if experiment.configuration.enableStatisticalAnalysis {
            Task {
                await checkStatisticalSignificance(for: experimentId)
            }
        }

        logger.debug("Tracked \\(eventType.rawValue) event for user \\(userId) in experiment \\(experimentId)")
    }

    /// Create new A/B test experiment
    public func createExperiment(_ config: ABTestConfiguration) async throws -> ABTest {
        // Validate configuration
        try validateConfiguration(config)

        let experiment = ABTest(
            id: config.id,
            name: config.name,
            configuration: config,
            status: .draft,
            createdAt: Date(),
            variants: config.variants
        )

        activeExperiments[experiment.id] = experiment

        // Sync to CloudKit
        try await cloudKitManager.saveABTest(experiment)

        logger.info("Created experiment: \\(experiment.name) (\\(experiment.id))")
        return experiment
    }

    /// Start experiment (begin user assignment)
    public func startExperiment(_ experimentId: String) async throws {
        guard var experiment = activeExperiments[experimentId] else {
            throw ABTestError.experimentNotFound(experimentId)
        }

        guard experiment.status == .draft else {
            throw ABTestError.invalidStatus("Cannot start experiment in \\(experiment.status) status")
        }

        experiment.status = .running
        experiment.startedAt = Date()
        activeExperiments[experimentId] = experiment

        // Update feature flags if connected
        if let flagId = experiment.configuration.linkedFeatureFlag {
            // Enable the feature flag for the experiment
            logger.info("Starting linked feature flag \\(flagId) for experiment \\(experimentId)")
        }

        // Sync to CloudKit
        try await cloudKitManager.saveABTest(experiment)

        logger.info("Started experiment: \\(experiment.name)")
    }

    /// Stop experiment and analyze results
    public func stopExperiment(_ experimentId: String, reason: String = "Manual stop") async throws -> ExperimentResults {
        guard var experiment = activeExperiments[experimentId] else {
            throw ABTestError.experimentNotFound(experimentId)
        }

        guard experiment.status == .running else {
            throw ABTestError.invalidStatus("Cannot stop experiment in \\(experiment.status) status")
        }

        experiment.status = .stopped
        experiment.stoppedAt = Date()
        activeExperiments[experimentId] = experiment

        // Generate final results
        let results = await generateFinalResults(for: experimentId, stopReason: reason)
        experimentResults[experimentId] = results

        // Sync to CloudKit
        try await cloudKitManager.saveABTest(experiment)

        logger.info("Stopped experiment: \\(experiment.name) - \\(reason)")
        return results
    }

    /// Get current experiment results
    public func getExperimentResults(_ experimentId: String) -> ExperimentResults? {
        return experimentResults[experimentId]
    }

    /// Get user's experiment history
    public func getUserExperimentHistory(_ userId: String) -> [UserExperimentHistory] {
        var history: [UserExperimentHistory] = []

        for (experimentId, experiment) in activeExperiments {
            if let variant = experiment.assignedVariant(for: userId) {
                let events = storage.getEvents(for: experimentId, userId: userId)
                history.append(UserExperimentHistory(
                    experimentId: experimentId,
                    experimentName: experiment.name,
                    variantId: variant.id,
                    variantName: variant.name,
                    assignedAt: experiment.userAssignments[userId]?.assignedAt ?? Date(),
                    events: events
                ))
            }
        }

        return history.sorted { $0.assignedAt > $1.assignedAt }
    }

    // MARK: - Private Methods

    private func setupCloudKitSync() {
        // Listen for CloudKit updates
        cloudKitManager.abTestUpdates
            .receive(on: DispatchQueue.main)
            .sink { [weak self] experiments in
                Task { @MainActor in
                    await self?.updateExperiments(experiments)
                }
            }
            .store(in: &subscriptions)
    }

    private func loadStoredData() {
        do {
            let (experiments, assignments, results) = try storage.loadStoredData()
            self.activeExperiments = experiments
            self.userAssignments = assignments
            self.experimentResults = results
            logger.info("Loaded \\(experiments.count) experiments and \\(assignments.count) user assignments")
        } catch {
            logger.error("Failed to load stored A/B test data: \\(error)")
        }
    }

    private func updateExperiments(_ cloudExperiments: [String: ABTest]) async {
        let oldExperiments = activeExperiments
        activeExperiments = cloudExperiments

        // Detect changes and log
        let added = Set(cloudExperiments.keys).subtracting(Set(oldExperiments.keys))
        let removed = Set(oldExperiments.keys).subtracting(Set(cloudExperiments.keys))
        let modified = Set(cloudExperiments.keys).intersection(Set(oldExperiments.keys))
            .filter { cloudExperiments[$0]?.lastModified != oldExperiments[$0]?.lastModified }

        logger.info("Updated experiments - added: \\(added.count), removed: \\(removed.count), modified: \\(modified.count)")

        // Save updated data
        saveStoredData()
    }

    private func isUserEligible(userId: String, experiment: ABTest) -> Bool {
        let config = experiment.configuration

        // Check if user is in target audience
        if !config.targetAudience.isEmpty {
            // This would integrate with user segmentation system
            // For now, simple property checks
        }

        // Check exclusion criteria
        for criteria in config.exclusionCriteria {
            if evaluateUserCriteria(userId: userId, criteria: criteria) {
                return false
            }
        }

        // Check inclusion criteria
        if !config.inclusionCriteria.isEmpty {
            return config.inclusionCriteria.allSatisfy { criteria in
                evaluateUserCriteria(userId: userId, criteria: criteria)
            }
        }

        return true
    }

    private func evaluateUserCriteria(userId: String, criteria: UserCriteria) -> Bool {
        // This would integrate with user profile system
        // For demo purposes, simplified implementation
        switch criteria.property {
        case "user_type":
            return criteria.value == "beta" // Assume beta users for testing
        case "platform":
            return criteria.value == "ios" // Assume iOS for testing
        default:
            return false
        }
    }

    private func assignUserToVariant(userId: String, experiment: ABTest) -> ABTestVariant {
        // Use deterministic hash-based assignment for consistency
        let hash = stableHash(userId + experiment.id)
        let weights = experiment.variants.map { $0.weight }
        let totalWeight = weights.reduce(0, +)

        let threshold = Double(hash % 10000) / 10000.0 * totalWeight
        var currentWeight = 0.0

        for variant in experiment.variants {
            currentWeight += variant.weight
            if threshold <= currentWeight {
                // Update experiment with user assignment
                var updatedExperiment = experiment
                updatedExperiment.userAssignments[userId] = UserAssignment(
                    userId: userId,
                    variantId: variant.id,
                    assignedAt: Date()
                )
                activeExperiments[experiment.id] = updatedExperiment
                return variant
            }
        }

        // Fallback to control
        return experiment.variants.first { $0.isControl } ?? experiment.variants[0]
    }

    private func updateExperimentResults(for experimentId: String, event: ABTestEvent) {
        var results = experimentResults[experimentId] ?? ExperimentResults(
            experimentId: experimentId,
            startDate: Date(),
            endDate: nil,
            status: .running
        )

        // Update variant metrics
        if var variantMetrics = results.variantMetrics[event.variantId] {
            variantMetrics.eventCount += 1
            variantMetrics.totalValue += event.value
            variantMetrics.lastEvent = event.timestamp

            // Update event type specific metrics
            variantMetrics.eventTypeMetrics[event.eventType.rawValue, default: EventTypeMetrics()].count += 1
            variantMetrics.eventTypeMetrics[event.eventType.rawValue]?.totalValue += event.value

            results.variantMetrics[event.variantId] = variantMetrics
        } else {
            // Create new variant metrics
            var eventTypeMetrics: [String: EventTypeMetrics] = [:]
            eventTypeMetrics[event.eventType.rawValue] = EventTypeMetrics(
                count: 1,
                totalValue: event.value,
                conversionRate: 0.0
            )

            results.variantMetrics[event.variantId] = VariantMetrics(
                variantId: event.variantId,
                userCount: 0,
                eventCount: 1,
                totalValue: event.value,
                conversionRate: 0.0,
                eventTypeMetrics: eventTypeMetrics,
                lastEvent: event.timestamp
            )
        }

        // Update overall experiment metrics
        results.lastUpdated = Date()
        experimentResults[experimentId] = results
    }

    private func checkStatisticalSignificance(for experimentId: String) async {
        guard let experiment = activeExperiments[experimentId],
              let results = experimentResults[experimentId] else { return }

        let analysis = await statistics.analyzeExperiment(
            variants: experiment.variants,
            results: results,
            configuration: experiment.configuration
        )

        // Check if experiment has reached significance
        if analysis.hasStatisticalSignificance {
            logger.info("Experiment \\(experimentId) has reached statistical significance")

            // Auto-stop if configured
            if experiment.configuration.autoStopOnSignificance {
                do {
                    try await stopExperiment(experimentId, reason: "Statistical significance reached")
                } catch {
                    logger.error("Failed to auto-stop experiment \\(experimentId): \\(error)")
                }
            }
        }

        // Update results with statistical analysis
        var updatedResults = results
        updatedResults.statisticalAnalysis = analysis
        experimentResults[experimentId] = updatedResults
    }

    private func generateFinalResults(for experimentId: String, stopReason: String) async -> ExperimentResults {
        guard let experiment = activeExperiments[experimentId] else {
            return ExperimentResults(experimentId: experimentId, startDate: Date(), endDate: Date(), status: .error)
        }

        let events = storage.getEvents(for: experimentId)
        let analysis = await statistics.performFinalAnalysis(
            experiment: experiment,
            events: events
        )

        let results = ExperimentResults(
            experimentId: experimentId,
            startDate: experiment.startedAt ?? experiment.createdAt,
            endDate: Date(),
            status: .completed,
            variantMetrics: generateVariantMetrics(for: experiment, events: events),
            statisticalAnalysis: analysis,
            summary: ExperimentSummary(
                totalParticipants: Set(events.map { $0.userId }).count,
                totalEvents: events.count,
                duration: Date().timeIntervalSince(experiment.startedAt ?? experiment.createdAt),
                winningVariant: analysis.winningVariant,
                confidence: analysis.confidence,
                stopReason: stopReason
            ),
            lastUpdated: Date()
        )

        return results
    }

    private func generateVariantMetrics(for experiment: ABTest, events: [ABTestEvent]) -> [String: VariantMetrics] {
        var metrics: [String: VariantMetrics] = [:]

        for variant in experiment.variants {
            let variantEvents = events.filter { $0.variantId == variant.id }
            let uniqueUsers = Set(variantEvents.map { $0.userId })

            var eventTypeMetrics: [String: EventTypeMetrics] = [:]
            for eventType in ABTestEventType.allCases {
                let typeEvents = variantEvents.filter { $0.eventType == eventType }
                if !typeEvents.isEmpty {
                    eventTypeMetrics[eventType.rawValue] = EventTypeMetrics(
                        count: typeEvents.count,
                        totalValue: typeEvents.reduce(0) { $0 + $1.value },
                        conversionRate: Double(typeEvents.count) / Double(max(uniqueUsers.count, 1))
                    )
                }
            }

            metrics[variant.id] = VariantMetrics(
                variantId: variant.id,
                userCount: uniqueUsers.count,
                eventCount: variantEvents.count,
                totalValue: variantEvents.reduce(0) { $0 + $1.value },
                conversionRate: Double(variantEvents.count) / Double(max(uniqueUsers.count, 1)),
                eventTypeMetrics: eventTypeMetrics,
                lastEvent: variantEvents.max(by: { $0.timestamp < $1.timestamp })?.timestamp
            )
        }

        return metrics
    }

    private func validateConfiguration(_ config: ABTestConfiguration) throws {
        guard !config.name.isEmpty else {
            throw ABTestError.invalidConfiguration("Experiment name cannot be empty")
        }

        guard config.variants.count >= 2 else {
            throw ABTestError.invalidConfiguration("Experiment must have at least 2 variants")
        }

        guard config.variants.contains(where: { $0.isControl }) else {
            throw ABTestError.invalidConfiguration("Experiment must have a control variant")
        }

        let totalWeight = config.variants.reduce(0) { $0 + $1.weight }
        guard abs(totalWeight - 1.0) < 0.001 else {
            throw ABTestError.invalidConfiguration("Variant weights must sum to 1.0 (currently: \\(totalWeight))")
        }
    }

    private func saveUserAssignments() {
        storage.saveUserAssignments(userAssignments)
    }

    private func saveStoredData() {
        do {
            try storage.saveStoredData(activeExperiments, userAssignments, experimentResults)
        } catch {
            logger.error("Failed to save A/B test data: \\(error)")
        }
    }

    private func stableHash(_ string: String) -> Int {
        var hash = 0
        for char in string.utf8 {
            hash = ((hash << 5) &- hash) &+ Int(char)
            hash = hash & hash // Convert to 32bit integer
        }
        return abs(hash)
    }
}

// MARK: - Supporting Types

/// A/B test experiment definition
public struct ABTest: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let configuration: ABTestConfiguration
    public var status: ExperimentStatus
    public let createdAt: Date
    public var startedAt: Date?
    public var stoppedAt: Date?
    public var lastModified: Date = Date()
    public let variants: [ABTestVariant]
    public var userAssignments: [String: UserAssignment] = [:]

    public func assignedVariant(for userId: String) -> ABTestVariant? {
        guard let assignment = userAssignments[userId] else { return nil }
        return variants.first { $0.id == assignment.variantId }
    }
}

/// A/B test configuration
public struct ABTestConfiguration: Codable, Sendable {
    public let id: String
    public let name: String
    public let description: String
    public let variants: [ABTestVariant]
    public let targetAudience: [String]
    public let inclusionCriteria: [UserCriteria]
    public let exclusionCriteria: [UserCriteria]
    public let primaryMetric: String
    public let secondaryMetrics: [String]
    public let expectedDuration: TimeInterval
    public let expectedSampleSize: Int
    public let significanceLevel: Double // Default: 0.05
    public let statisticalPower: Double // Default: 0.8
    public let enableStatisticalAnalysis: Bool
    public let autoStopOnSignificance: Bool
    public let linkedFeatureFlag: String?

    public init(
        id: String,
        name: String,
        description: String,
        variants: [ABTestVariant],
        targetAudience: [String] = [],
        inclusionCriteria: [UserCriteria] = [],
        exclusionCriteria: [UserCriteria] = [],
        primaryMetric: String,
        secondaryMetrics: [String] = [],
        expectedDuration: TimeInterval = 14 * 24 * 60 * 60, // 14 days
        expectedSampleSize: Int = 1000,
        significanceLevel: Double = 0.05,
        statisticalPower: Double = 0.8,
        enableStatisticalAnalysis: Bool = true,
        autoStopOnSignificance: Bool = false,
        linkedFeatureFlag: String? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.variants = variants
        self.targetAudience = targetAudience
        self.inclusionCriteria = inclusionCriteria
        self.exclusionCriteria = exclusionCriteria
        self.primaryMetric = primaryMetric
        self.secondaryMetrics = secondaryMetrics
        self.expectedDuration = expectedDuration
        self.expectedSampleSize = expectedSampleSize
        self.significanceLevel = significanceLevel
        self.statisticalPower = statisticalPower
        self.enableStatisticalAnalysis = enableStatisticalAnalysis
        self.autoStopOnSignificance = autoStopOnSignificance
        self.linkedFeatureFlag = linkedFeatureFlag
    }
}

/// A/B test variant definition
public struct ABTestVariant: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let weight: Double // 0.0 to 1.0
    public let isControl: Bool
    public let configuration: [String: String] // Feature flag overrides or config values

    public init(
        id: String,
        name: String,
        description: String,
        weight: Double,
        isControl: Bool = false,
        configuration: [String: String] = [:]
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.weight = weight
        self.isControl = isControl
        self.configuration = configuration
    }
}

/// User assignment to experiment variant
public struct UserAssignment: Codable, Sendable {
    public let userId: String
    public let variantId: String
    public let assignedAt: Date
}

/// User criteria for experiment targeting
public struct UserCriteria: Codable, Sendable {
    public let property: String
    public let `operator`: String // equals, notEquals, contains, greaterThan, lessThan
    public let value: String

    public init(property: String, operator: String, value: String) {
        self.property = property
        self.`operator` = operator
        self.value = value
    }
}

/// Experiment status
public enum ExperimentStatus: String, Codable, Sendable, CaseIterable {
    case draft
    case running
    case paused
    case stopped
    case completed
    case error
}

/// A/B test event types
public enum ABTestEventType: String, Codable, Sendable, CaseIterable {
    case userAssigned = "user_assigned"
    case pageView = "page_view"
    case click = "click"
    case conversion = "conversion"
    case goal = "goal"
    case custom = "custom"
}

/// Individual A/B test event
public struct ABTestEvent: Codable, Sendable, Identifiable {
    public let id: UUID
    public let experimentId: String
    public let userId: String
    public let variantId: String
    public let eventType: ABTestEventType
    public let value: Double
    public let metadata: [String: String]
    public let timestamp: Date

    public init(
        id: UUID = UUID(),
        experimentId: String,
        userId: String,
        variantId: String,
        eventType: ABTestEventType,
        value: Double = 1.0,
        metadata: [String: String] = [:],
        timestamp: Date = Date()
    ) {
        self.id = id
        self.experimentId = experimentId
        self.userId = userId
        self.variantId = variantId
        self.eventType = eventType
        self.value = value
        self.metadata = metadata
        self.timestamp = timestamp
    }

    // Custom coding to handle Any type in metadata
    private enum CodingKeys: String, CodingKey {
        case id, experimentId, userId, variantId, eventType, value, timestamp
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(experimentId, forKey: .experimentId)
        try container.encode(userId, forKey: .userId)
        try container.encode(variantId, forKey: .variantId)
        try container.encode(eventType, forKey: .eventType)
        try container.encode(value, forKey: .value)
        try container.encode(timestamp, forKey: .timestamp)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        experimentId = try container.decode(String.self, forKey: .experimentId)
        userId = try container.decode(String.self, forKey: .userId)
        variantId = try container.decode(String.self, forKey: .variantId)
        eventType = try container.decode(ABTestEventType.self, forKey: .eventType)
        value = try container.decode(Double.self, forKey: .value)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        metadata = [:] // Default empty metadata for decoded events
    }
}

/// Experiment results
public struct ExperimentResults: Sendable {
    public let experimentId: String
    public let startDate: Date
    public let endDate: Date?
    public let status: ExperimentResultsStatus
    public var variantMetrics: [String: VariantMetrics] = [:]
    public var statisticalAnalysis: StatisticalAnalysis?
    public var summary: ExperimentSummary?
    public var lastUpdated: Date = Date()

    public init(
        experimentId: String,
        startDate: Date,
        endDate: Date?,
        status: ExperimentResultsStatus,
        variantMetrics: [String: VariantMetrics] = [:],
        statisticalAnalysis: StatisticalAnalysis? = nil,
        summary: ExperimentSummary? = nil
    ) {
        self.experimentId = experimentId
        self.startDate = startDate
        self.endDate = endDate
        self.status = status
        self.variantMetrics = variantMetrics
        self.statisticalAnalysis = statisticalAnalysis
        self.summary = summary
    }
}

/// Results status
public enum ExperimentResultsStatus: String, Sendable {
    case running
    case completed
    case error
}

/// Per-variant metrics
public struct VariantMetrics: Sendable {
    public let variantId: String
    public let userCount: Int
    public let eventCount: Int
    public let totalValue: Double
    public let conversionRate: Double
    public let eventTypeMetrics: [String: EventTypeMetrics]
    public let lastEvent: Date?

    public init(
        variantId: String,
        userCount: Int,
        eventCount: Int,
        totalValue: Double,
        conversionRate: Double,
        eventTypeMetrics: [String: EventTypeMetrics],
        lastEvent: Date? = nil
    ) {
        self.variantId = variantId
        self.userCount = userCount
        self.eventCount = eventCount
        self.totalValue = totalValue
        self.conversionRate = conversionRate
        self.eventTypeMetrics = eventTypeMetrics
        self.lastEvent = lastEvent
    }
}

/// Event type specific metrics
public struct EventTypeMetrics: Sendable {
    public var count: Int = 0
    public var totalValue: Double = 0
    public var conversionRate: Double = 0

    public init(count: Int = 0, totalValue: Double = 0, conversionRate: Double = 0) {
        self.count = count
        self.totalValue = totalValue
        self.conversionRate = conversionRate
    }
}

/// Statistical analysis results
public struct StatisticalAnalysis: Sendable {
    public let hasStatisticalSignificance: Bool
    public let confidence: Double
    public let pValue: Double
    public let winningVariant: String?
    public let effectSize: Double
    public let recommendedAction: RecommendedAction
    public let analysisDate: Date

    public enum RecommendedAction: String, Sendable {
        case continueTest = "continue"
        case declareWinner = "declare_winner"
        case stopInconclusive = "stop_inconclusive"
        case needMoreData = "need_more_data"
    }
}

/// Experiment summary
public struct ExperimentSummary: Sendable {
    public let totalParticipants: Int
    public let totalEvents: Int
    public let duration: TimeInterval
    public let winningVariant: String?
    public let confidence: Double
    public let stopReason: String

    public init(
        totalParticipants: Int,
        totalEvents: Int,
        duration: TimeInterval,
        winningVariant: String?,
        confidence: Double,
        stopReason: String
    ) {
        self.totalParticipants = totalParticipants
        self.totalEvents = totalEvents
        self.duration = duration
        self.winningVariant = winningVariant
        self.confidence = confidence
        self.stopReason = stopReason
    }
}

/// User experiment history
public struct UserExperimentHistory: Sendable {
    public let experimentId: String
    public let experimentName: String
    public let variantId: String
    public let variantName: String
    public let assignedAt: Date
    public let events: [ABTestEvent]
}

/// A/B testing errors
public enum ABTestError: LocalizedError, Sendable {
    case experimentNotFound(String)
    case invalidConfiguration(String)
    case invalidStatus(String)
    case statisticalError(String)

    public var errorDescription: String? {
        switch self {
        case .experimentNotFound(let id):
            return "A/B test experiment not found: \(id)"
        case .invalidConfiguration(let reason):
            return "Invalid A/B test configuration: \(reason)"
        case .invalidStatus(let reason):
            return "Invalid experiment status: \(reason)"
        case .statisticalError(let reason):
            return "Statistical analysis error: \(reason)"
        }
    }
}

// MARK: - Storage Protocol

/// A/B test storage protocol
public protocol ABTestStorage {
    func saveStoredData(_ experiments: [String: ABTest], _ assignments: [String: String], _ results: [String: ExperimentResults]) throws
    func loadStoredData() throws -> ([String: ABTest], [String: String], [String: ExperimentResults])
    func storeEvent(_ event: ABTestEvent)
    func getEvents(for experimentId: String) -> [ABTestEvent]
    func getEvents(for experimentId: String, userId: String) -> [ABTestEvent]
    func saveUserAssignments(_ assignments: [String: String])
    func clearAllData()
}

/// UserDefaults-based A/B test storage
public final class UserDefaultsABTestStorage: ABTestStorage {
    private let experimentsKey = "ab_test_experiments"
    private let assignmentsKey = "ab_test_assignments"
    private let resultsKey = "ab_test_results"
    private let eventsKey = "ab_test_events"

    public init() {}

    public func saveStoredData(
        _ experiments: [String: ABTest],
        _ assignments: [String: String],
        _ results: [String: ExperimentResults]
    ) throws {
        let encoder = JSONEncoder()

        let experimentsData = try encoder.encode(experiments)
        UserDefaults.standard.set(experimentsData, forKey: experimentsKey)

        let assignmentsData = try encoder.encode(assignments)
        UserDefaults.standard.set(assignmentsData, forKey: assignmentsKey)

        // Note: ExperimentResults would need to be Codable for full persistence
        // For now, store basic data
    }

    public func loadStoredData() throws -> ([String: ABTest], [String: String], [String: ExperimentResults]) {
        let decoder = JSONDecoder()

        let experiments: [String: ABTest]
        if let data = UserDefaults.standard.data(forKey: experimentsKey) {
            experiments = try decoder.decode([String: ABTest].self, from: data)
        } else {
            experiments = [:]
        }

        let assignments: [String: String]
        if let data = UserDefaults.standard.data(forKey: assignmentsKey) {
            assignments = try decoder.decode([String: String].self, from: data)
        } else {
            assignments = [:]
        }

        // Results would be loaded from more persistent storage in production
        let results: [String: ExperimentResults] = [:]

        return (experiments, assignments, results)
    }

    public func storeEvent(_ event: ABTestEvent) {
        // In production, this would use Core Data or CloudKit
        // For demo, append to UserDefaults array
        var events = getStoredEvents()
        events.append(event)

        // Keep only last 1000 events
        if events.count > 1000 {
            events = Array(events.suffix(1000))
        }

        if let data = try? JSONEncoder().encode(events) {
            UserDefaults.standard.set(data, forKey: eventsKey)
        }
    }

    public func getEvents(for experimentId: String) -> [ABTestEvent] {
        return getStoredEvents().filter { $0.experimentId == experimentId }
    }

    public func getEvents(for experimentId: String, userId: String) -> [ABTestEvent] {
        return getStoredEvents().filter { $0.experimentId == experimentId && $0.userId == userId }
    }

    public func saveUserAssignments(_ assignments: [String: String]) {
        if let data = try? JSONEncoder().encode(assignments) {
            UserDefaults.standard.set(data, forKey: assignmentsKey)
        }
    }

    public func clearAllData() {
        UserDefaults.standard.removeObject(forKey: experimentsKey)
        UserDefaults.standard.removeObject(forKey: assignmentsKey)
        UserDefaults.standard.removeObject(forKey: resultsKey)
        UserDefaults.standard.removeObject(forKey: eventsKey)
    }

    private func getStoredEvents() -> [ABTestEvent] {
        guard let data = UserDefaults.standard.data(forKey: eventsKey) else {
            return []
        }

        do {
            return try JSONDecoder().decode([ABTestEvent].self, from: data)
        } catch {
            return []
        }
    }
}