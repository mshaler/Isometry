import XCTest
import Combine
@testable import Isometry

/// Comprehensive integration tests for feature flagging, A/B testing, and configuration management
@MainActor
final class FeatureFlagIntegrationTests: XCTestCase {

    private var featureFlagManager: FeatureFlagManager!
    private var abTestManager: ABTestManager!
    private var configurationManager: ConfigurationManager!
    private var mockCloudKitManager: MockCloudKitSyncManager!
    private var analytics: FeatureFlagAnalytics!
    private var subscriptions = Set<AnyCancellable>()

    override func setUp() async throws {
        try await super.setUp()

        // Set up mock CloudKit manager
        mockCloudKitManager = MockCloudKitSyncManager()

        // Initialize analytics
        analytics = FeatureFlagAnalytics(storage: InMemoryAnalyticsStorage())

        // Initialize feature flag manager
        featureFlagManager = FeatureFlagManager(
            cloudKitManager: mockCloudKitManager,
            analytics: analytics
        )

        // Initialize A/B test manager
        abTestManager = ABTestManager(
            cloudKitManager: mockCloudKitManager,
            featureFlagManager: featureFlagManager,
            storage: InMemoryABTestStorage()
        )

        // Initialize configuration manager
        configurationManager = ConfigurationManager(
            cloudKitManager: mockCloudKitManager,
            validation: ConfigurationValidation(),
            audit: ConfigurationAudit(storage: InMemoryAuditStorage())
        )
    }

    override func tearDown() async throws {
        subscriptions.removeAll()
        featureFlagManager = nil
        abTestManager = nil
        configurationManager = nil
        mockCloudKitManager = nil
        analytics = nil
        try await super.tearDown()
    }

    // MARK: - Feature Flag Integration Tests

    func testFeatureFlagEvaluationPerformance() async throws {
        // Arrange: Set up multiple feature flags
        let flags = createTestFeatureFlags()
        mockCloudKitManager.featureFlags = flags

        // Act: Measure evaluation performance
        let startTime = CFAbsoluteTimeGetCurrent()
        let iterations = 1000

        for i in 0..<iterations {
            let userId = "user_\(i % 100)" // 100 unique users
            _ = featureFlagManager.isEnabled("test_flag_1", for: userId)
            _ = featureFlagManager.isEnabled("test_flag_2", for: userId)
            _ = featureFlagManager.isEnabled("test_flag_3", for: userId)
        }

        let totalTime = CFAbsoluteTimeGetCurrent() - startTime
        let averageTime = totalTime / Double(iterations * 3) // 3 flags per iteration

        // Assert: Performance requirements met
        XCTAssertLessThan(averageTime, 0.001, "Flag evaluation should be under 1ms on average")
        XCTAssertLessThan(totalTime, 1.0, "Total evaluation time should be under 1 second")

        print("Average flag evaluation time: \(String(format: "%.4f", averageTime * 1000))ms")
        print("Total evaluation time: \(String(format: "%.2f", totalTime))s")
    }

    func testFeatureFlagAnalyticsIntegration() async throws {
        // Arrange: Set up a feature flag
        let flag = FeatureFlag(
            id: "analytics_test",
            name: "Analytics Test Flag",
            description: "Test flag for analytics integration",
            globalConfiguration: FlagConfiguration(isEnabled: true),
            metadata: FlagMetadata(
                category: "test",
                owner: "test-team",
                tags: ["analytics", "test"]
            )
        )

        mockCloudKitManager.featureFlags = ["analytics_test": flag]

        // Act: Evaluate flags and track events
        let userIds = (0..<50).map { "user_\($0)" }

        for userId in userIds {
            let isEnabled = featureFlagManager.isEnabled("analytics_test", for: userId)
            XCTAssertTrue(isEnabled)

            // Simulate usage
            analytics.trackPerformanceImpact("analytics_test", impact: PerformanceImpact(
                cpuUsage: Double.random(in: 0.01...0.05),
                memoryUsage: Double.random(in: 1.0...5.0),
                networkRequests: Int.random(in: 0...3)
            ))
        }

        // Wait for analytics processing
        try await Task.sleep(nanoseconds: 100_000_000) // 100ms

        // Assert: Analytics data collected
        let report = analytics.getAnalyticsReport(for: "analytics_test")
        XCTAssertNotNil(report)
        XCTAssertEqual(report?.usageStats.evaluationCount, userIds.count)
        XCTAssertEqual(report?.usageStats.uniqueUsers.count, userIds.count)
    }

    // MARK: - A/B Testing Integration Tests

    func testABTestFeatureFlagIntegration() async throws {
        // Arrange: Create A/B test linked to feature flag
        let variants = [
            ABTestVariant(
                id: "control",
                name: "Control",
                description: "Control group",
                weight: 0.5,
                isControl: true
            ),
            ABTestVariant(
                id: "treatment",
                name: "Treatment",
                description: "Treatment group",
                weight: 0.5,
                isControl: false
            )
        ]

        let config = ABTestConfiguration(
            id: "ab_test_integration",
            name: "A/B Test Integration",
            description: "Test A/B testing integration with feature flags",
            variants: variants,
            primaryMetric: "conversion_rate",
            linkedFeatureFlag: "integration_test_flag"
        )

        let experiment = try await abTestManager.createExperiment(config)

        // Set up linked feature flag
        let linkedFlag = FeatureFlag(
            id: "integration_test_flag",
            name: "Integration Test Flag",
            description: "Feature flag linked to A/B test",
            globalConfiguration: FlagConfiguration(isEnabled: true),
            metadata: FlagMetadata(
                category: "integration",
                owner: "test-team",
                abTestId: experiment.id
            )
        )

        mockCloudKitManager.featureFlags = ["integration_test_flag": linkedFlag]

        // Act: Start experiment and assign users
        try await abTestManager.startExperiment(experiment.id)

        let userIds = (0..<100).map { "user_\($0)" }
        var assignments: [String: String] = [:]

        for userId in userIds {
            let variant = abTestManager.getVariant(for: experiment.id, userId: userId)
            XCTAssertNotNil(variant, "User \(userId) should be assigned to a variant")

            if let variant = variant {
                assignments[userId] = variant.id

                // Verify feature flag respects A/B test assignment
                let flagEnabled = featureFlagManager.isEnabled("integration_test_flag", for: userId)
                XCTAssertTrue(flagEnabled, "Linked feature flag should be enabled")
            }
        }

        // Assert: Proper distribution and consistency
        let controlCount = assignments.values.filter { $0 == "control" }.count
        let treatmentCount = assignments.values.filter { $0 == "treatment" }.count

        // Should be roughly 50/50 distribution (allowing for 20% variance)
        XCTAssertGreaterThan(controlCount, 30)
        XCTAssertLessThan(controlCount, 70)
        XCTAssertGreaterThan(treatmentCount, 30)
        XCTAssertLessThan(treatmentCount, 70)

        print("Control group: \(controlCount), Treatment group: \(treatmentCount)")
    }

    func testABTestStatisticalAnalysis() async throws {
        // Arrange: Create experiment with sufficient data for statistical analysis
        let config = ABTestConfiguration(
            id: "statistical_test",
            name: "Statistical Analysis Test",
            description: "Test statistical significance calculation",
            variants: [
                ABTestVariant(id: "control", name: "Control", description: "Control", weight: 0.5, isControl: true),
                ABTestVariant(id: "treatment", name: "Treatment", description: "Treatment", weight: 0.5, isControl: false)
            ],
            primaryMetric: "conversion_rate",
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true
        )

        let experiment = try await abTestManager.createExperiment(config)
        try await abTestManager.startExperiment(experiment.id)

        // Act: Generate synthetic event data with different conversion rates
        let userIds = (0..<1000).map { "user_\($0)" }

        for userId in userIds {
            if let variant = abTestManager.getVariant(for: experiment.id, userId: userId) {
                // Simulate different conversion rates: control 10%, treatment 15%
                let conversionProbability = variant.isControl ? 0.10 : 0.15
                let shouldConvert = Double.random(in: 0...1) < conversionProbability

                if shouldConvert {
                    abTestManager.trackEvent(
                        .conversion,
                        experimentId: experiment.id,
                        userId: userId,
                        value: 1.0
                    )
                }
            }
        }

        // Wait for statistical analysis
        try await Task.sleep(nanoseconds: 500_000_000) // 500ms

        // Assert: Statistical analysis results
        let results = abTestManager.getExperimentResults(experiment.id)
        XCTAssertNotNil(results)

        if let analysis = results?.statisticalAnalysis {
            XCTAssertNotNil(analysis.confidence)
            XCTAssertNotNil(analysis.pValue)
            XCTAssertNotNil(analysis.effectSize)

            print("Statistical Analysis:")
            print("  P-value: \(analysis.pValue)")
            print("  Confidence: \(analysis.confidence)")
            print("  Effect Size: \(analysis.effectSize)")
            print("  Significant: \(analysis.hasStatisticalSignificance)")

            // With 1000 users and 5% difference in conversion rates,
            // we should have sufficient power to detect significance
            if analysis.hasStatisticalSignificance {
                XCTAssertLessThan(analysis.pValue, 0.05)
                XCTAssertEqual(analysis.winningVariant, "treatment")
            }
        }
    }

    // MARK: - Configuration Integration Tests

    func testConfigurationFeatureFlagIntegration() async throws {
        // Arrange: Set up configuration that affects feature flags
        try await configurationManager.setValue("feature_flags_sync_interval", value: 120.0)

        let syncInterval: Double? = configurationManager.getValue(
            "feature_flags_sync_interval",
            type: Double.self
        )

        // Assert: Configuration affects feature flag behavior
        XCTAssertEqual(syncInterval, 120.0)

        // Act: Test configuration-driven feature flag behavior
        try await configurationManager.setValue("debug_feature_flags", value: true)

        let debugMode: Bool? = configurationManager.getValue(
            "debug_feature_flags",
            type: Bool.self,
            defaultValue: false
        )

        XCTAssertEqual(debugMode, true)
    }

    func testConfigurationHotReload() async throws {
        // Arrange: Set initial configuration
        try await configurationManager.setValue("test_config", value: "initial_value")

        var initialValue: String? = configurationManager.getValue("test_config", type: String.self)
        XCTAssertEqual(initialValue, "initial_value")

        // Act: Simulate CloudKit update
        let updatedConfig = ConfigurationItem(
            key: "test_config",
            value: "updated_value",
            type: .string,
            category: "test",
            description: "Test configuration"
        )

        mockCloudKitManager.configurations = ["test_config": updatedConfig]

        // Trigger hot reload
        let startTime = CFAbsoluteTimeGetCurrent()
        try await configurationManager.hotReload()
        let reloadTime = CFAbsoluteTimeGetCurrent() - startTime

        // Assert: Hot reload performance and correctness
        XCTAssertLessThan(reloadTime, 0.1, "Hot reload should complete under 100ms")

        let updatedValue: String? = configurationManager.getValue("test_config", type: String.self)
        XCTAssertEqual(updatedValue, "updated_value")

        print("Hot reload completed in \(String(format: "%.2f", reloadTime * 1000))ms")
    }

    // MARK: - Cross-System Integration Tests

    func testSystemWidePerformanceImpact() async throws {
        // Arrange: Initialize all systems with realistic data
        let flags = createTestFeatureFlags()
        let configs = createTestConfigurations()

        mockCloudKitManager.featureFlags = flags
        mockCloudKitManager.configurations = configs

        // Wait for initialization
        try await Task.sleep(nanoseconds: 100_000_000) // 100ms

        // Act: Measure combined system performance
        let startTime = CFAbsoluteTimeGetCurrent()
        let iterations = 500

        for i in 0..<iterations {
            let userId = "user_\(i)"

            // Feature flag evaluation
            _ = featureFlagManager.isEnabled("test_flag_1", for: userId)

            // A/B test variant assignment (if experiment exists)
            if !abTestManager.activeExperiments.isEmpty {
                _ = abTestManager.getVariant(for: abTestManager.activeExperiments.keys.first!, userId: userId)
            }

            // Configuration access
            let _: Double? = configurationManager.getValue("api_timeout", type: Double.self)
            let _: Bool? = configurationManager.getValue("debug_logging", type: Bool.self)
        }

        let totalTime = CFAbsoluteTimeGetCurrent() - startTime
        let averageTime = totalTime / Double(iterations)

        // Assert: System-wide performance impact is minimal
        XCTAssertLessThan(averageTime, 0.002, "Combined system operations should be under 2ms on average")
        XCTAssertLessThan(totalTime, 1.0, "Total operation time should be under 1 second")

        print("Average combined operation time: \(String(format: "%.4f", averageTime * 1000))ms")
        print("Total system impact assessment: \(String(format: "%.2f", totalTime))s")
    }

    func testCloudKitSyncCoordination() async throws {
        // Arrange: Set up initial state
        let flags = createTestFeatureFlags()
        let configs = createTestConfigurations()

        // Act: Simulate coordinated CloudKit updates
        mockCloudKitManager.featureFlags = flags
        mockCloudKitManager.configurations = configs

        // Simulate simultaneous updates from CloudKit
        let updateExpectation = expectation(description: "CloudKit updates processed")
        updateExpectation.expectedFulfillmentCount = 3 // All three managers should update

        var updateCount = 0
        let updateTracker = { @MainActor in
            updateCount += 1
            if updateCount == 3 {
                updateExpectation.fulfill()
            }
        }

        // Subscribe to update notifications
        featureFlagManager.$flags
            .dropFirst()
            .sink { _ in Task { @MainActor in updateTracker() } }
            .store(in: &subscriptions)

        configurationManager.$configurations
            .dropFirst()
            .sink { _ in Task { @MainActor in updateTracker() } }
            .store(in: &subscriptions)

        abTestManager.$activeExperiments
            .dropFirst()
            .sink { _ in Task { @MainActor in updateTracker() } }
            .store(in: &subscriptions)

        // Trigger CloudKit sync
        mockCloudKitManager.simulateCloudKitUpdate()

        // Wait for all systems to update
        await fulfillment(of: [updateExpectation], timeout: 5.0)

        // Assert: Data integrity maintained across all systems
        XCTAssertFalse(featureFlagManager.flags.isEmpty)
        XCTAssertFalse(configurationManager.configurations.isEmpty)
    }

    func testDataIntegrityAcrossSystems() async throws {
        // Arrange: Create interdependent data
        let experimentId = "data_integrity_test"

        // Create A/B test with linked feature flag
        let config = ABTestConfiguration(
            id: experimentId,
            name: "Data Integrity Test",
            description: "Test data integrity across systems",
            variants: [
                ABTestVariant(id: "control", name: "Control", description: "Control", weight: 0.5, isControl: true),
                ABTestVariant(id: "treatment", name: "Treatment", description: "Treatment", weight: 0.5, isControl: false)
            ],
            primaryMetric: "conversion_rate",
            linkedFeatureFlag: "data_integrity_flag"
        )

        let experiment = try await abTestManager.createExperiment(config)

        // Create linked feature flag
        let linkedFlag = FeatureFlag(
            id: "data_integrity_flag",
            name: "Data Integrity Flag",
            description: "Flag linked to data integrity test",
            globalConfiguration: FlagConfiguration(isEnabled: true),
            metadata: FlagMetadata(
                category: "test",
                owner: "test-team",
                abTestId: experiment.id
            )
        )

        mockCloudKitManager.featureFlags = ["data_integrity_flag": linkedFlag]

        // Create related configuration
        try await configurationManager.setValue("data_integrity_test_enabled", value: true)

        // Act: Perform operations that affect multiple systems
        try await abTestManager.startExperiment(experimentId)

        let userId = "integrity_test_user"
        let variant = abTestManager.getVariant(for: experimentId, userId: userId)
        let flagEnabled = featureFlagManager.isEnabled("data_integrity_flag", for: userId)
        let configEnabled: Bool? = configurationManager.getValue("data_integrity_test_enabled", type: Bool.self)

        // Assert: Data consistency across systems
        XCTAssertNotNil(variant)
        XCTAssertTrue(flagEnabled)
        XCTAssertEqual(configEnabled, true)

        // Verify cross-references are maintained
        let flagConfig = featureFlagManager.getFlagConfiguration("data_integrity_flag")
        XCTAssertEqual(flagConfig?.metadata.abTestId, experimentId)

        let experimentConfig = abTestManager.activeExperiments[experimentId]
        XCTAssertEqual(experimentConfig?.configuration.linkedFeatureFlag, "data_integrity_flag")
    }

    // MARK: - Helper Methods

    private func createTestFeatureFlags() -> [String: FeatureFlag] {
        return [
            "test_flag_1": FeatureFlag(
                id: "test_flag_1",
                name: "Test Flag 1",
                description: "First test flag",
                globalConfiguration: FlagConfiguration(isEnabled: true, rolloutPercentage: 1.0),
                metadata: FlagMetadata(category: "test", owner: "test-team")
            ),
            "test_flag_2": FeatureFlag(
                id: "test_flag_2",
                name: "Test Flag 2",
                description: "Second test flag",
                globalConfiguration: FlagConfiguration(isEnabled: false, rolloutPercentage: 0.5),
                metadata: FlagMetadata(category: "test", owner: "test-team")
            ),
            "test_flag_3": FeatureFlag(
                id: "test_flag_3",
                name: "Test Flag 3",
                description: "Third test flag",
                globalConfiguration: FlagConfiguration(isEnabled: true, rolloutPercentage: 0.8),
                metadata: FlagMetadata(category: "test", owner: "test-team")
            )
        ]
    }

    private func createTestConfigurations() -> [String: ConfigurationItem] {
        return [
            "api_timeout": ConfigurationItem(
                key: "api_timeout",
                value: "30.0",
                type: .double,
                category: "network",
                description: "API request timeout",
                isRequired: true
            ),
            "debug_logging": ConfigurationItem(
                key: "debug_logging",
                value: "false",
                type: .boolean,
                category: "debugging",
                description: "Enable debug logging"
            ),
            "cache_size": ConfigurationItem(
                key: "cache_size",
                value: "100",
                type: .integer,
                category: "performance",
                description: "Cache size in MB"
            )
        ]
    }
}

// MARK: - Mock Implementations

class MockCloudKitSyncManager: CloudKitSyncManager {
    var featureFlags: [String: FeatureFlag] = [:]
    var configurations: [String: ConfigurationItem] = [:]
    var abTests: [String: ABTest] = [:]

    private let featureFlagUpdatesSubject = PassthroughSubject<[String: FeatureFlag], Never>()
    private let configurationUpdatesSubject = PassthroughSubject<[String: ConfigurationItem], Never>()
    private let abTestUpdatesSubject = PassthroughSubject<[String: ABTest], Never>()

    var featureFlagUpdates: AnyPublisher<[String: FeatureFlag], Never> {
        featureFlagUpdatesSubject.eraseToAnyPublisher()
    }

    var configurationUpdates: AnyPublisher<[String: ConfigurationItem], Never> {
        configurationUpdatesSubject.eraseToAnyPublisher()
    }

    var abTestUpdates: AnyPublisher<[String: ABTest], Never> {
        abTestUpdatesSubject.eraseToAnyPublisher()
    }

    func fetchFeatureFlags() async throws -> [String: FeatureFlag] {
        return featureFlags
    }

    func fetchConfigurations() async throws -> [String: ConfigurationItem] {
        return configurations
    }

    func fetchABTests() async throws -> [String: ABTest] {
        return abTests
    }

    func saveFeatureFlag(_ flag: FeatureFlag) async throws {
        featureFlags[flag.id] = flag
    }

    func saveConfiguration(_ config: ConfigurationItem) async throws {
        configurations[config.key] = config
    }

    func saveABTest(_ test: ABTest) async throws {
        abTests[test.id] = test
    }

    func simulateCloudKitUpdate() {
        Task { @MainActor in
            featureFlagUpdatesSubject.send(featureFlags)
            configurationUpdatesSubject.send(configurations)
            abTestUpdatesSubject.send(abTests)
        }
    }
}

// In-memory storage implementations for testing
class InMemoryAnalyticsStorage: AnalyticsStorage {
    private var events: [AnalyticsEvent] = []
    private var metrics: (EvaluationMetrics?, [String: FlagUsageStats]?, PerformanceMetrics?) = (nil, nil, nil)

    func storeEvents(_ events: [AnalyticsEvent]) throws {
        self.events.append(contentsOf: events)
    }

    func loadEvents() throws -> [AnalyticsEvent] {
        return events
    }

    func storeMetrics(_ evaluation: EvaluationMetrics, _ usage: [String: FlagUsageStats], _ performance: PerformanceMetrics) throws {
        metrics = (evaluation, usage, performance)
    }

    func loadMetrics() throws -> (EvaluationMetrics?, [String: FlagUsageStats]?, PerformanceMetrics?) {
        return metrics
    }

    func clearAllData() {
        events.removeAll()
        metrics = (nil, nil, nil)
    }
}

class InMemoryABTestStorage: ABTestStorage {
    private var experiments: [String: ABTest] = [:]
    private var assignments: [String: String] = [:]
    private var results: [String: ExperimentResults] = [:]
    private var events: [ABTestEvent] = []

    func saveStoredData(_ experiments: [String: ABTest], _ assignments: [String: String], _ results: [String: ExperimentResults]) throws {
        self.experiments = experiments
        self.assignments = assignments
        self.results = results
    }

    func loadStoredData() throws -> ([String: ABTest], [String: String], [String: ExperimentResults]) {
        return (experiments, assignments, results)
    }

    func storeEvent(_ event: ABTestEvent) {
        events.append(event)
    }

    func getEvents(for experimentId: String) -> [ABTestEvent] {
        return events.filter { $0.experimentId == experimentId }
    }

    func getEvents(for experimentId: String, userId: String) -> [ABTestEvent] {
        return events.filter { $0.experimentId == experimentId && $0.userId == userId }
    }

    func saveUserAssignments(_ assignments: [String: String]) {
        self.assignments = assignments
    }

    func clearAllData() {
        experiments.removeAll()
        assignments.removeAll()
        results.removeAll()
        events.removeAll()
    }
}

class InMemoryAuditStorage: AuditStorage {
    private var entries: [AuditEntry] = []

    func saveAuditEntries(_ entries: [AuditEntry]) throws {
        self.entries = entries
    }

    func loadAuditEntries() throws -> [AuditEntry] {
        return entries
    }

    func clearAuditEntries() {
        entries.removeAll()
    }
}