import XCTest
import Foundation
import Combine
@testable import Isometry

@MainActor
final class BetaTestingManagerTests: XCTestCase {
    var betaManager: BetaTestingManager!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        betaManager = BetaTestingManager()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() async throws {
        betaManager = nil
        cancellables = nil
    }

    // MARK: - Environment Detection Tests

    func testEnvironmentDetection() throws {
        // Given: A BetaTestingManager instance
        // When: Environment is detected
        // Then: Environment status should be valid
        let environment = betaManager.environmentStatus
        XCTAssertTrue(BetaTestingManager.EnvironmentStatus.allCases.contains(environment))

        // Debug builds should be detected as test environment
        #if DEBUG
        XCTAssertTrue(environment.isTestEnvironment, "Debug builds should be detected as test environment")
        #endif
    }

    func testBetaModeDetection() throws {
        // Given: A BetaTestingManager instance
        // When: Beta mode is determined
        // Then: It should be consistent with environment detection
        let isBeta = betaManager.isBetaMode
        let isTestEnvironment = betaManager.environmentStatus.isTestEnvironment

        XCTAssertEqual(isBeta, isTestEnvironment, "Beta mode should match test environment status")
    }

    func testBetaVersionConfiguration() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Beta version is configured
        // Then: It should have valid configuration
        XCTAssertNotNil(betaManager.betaVersion)

        let betaVersion = try XCTUnwrap(betaManager.betaVersion)
        XCTAssertFalse(betaVersion.configuration.version.isEmpty)
        XCTAssertFalse(betaVersion.configuration.build.isEmpty)
        XCTAssertFalse(betaVersion.configuration.features.isEmpty)
        XCTAssertFalse(betaVersion.configuration.feedbackCategories.isEmpty)
    }

    func testBetaExpiration() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Beta version expiration is checked
        // Then: It should not be expired for new versions
        let isExpired = betaManager.isExpired
        XCTAssertFalse(isExpired, "New beta versions should not be expired")
    }

    // MARK: - Feature Flag Integration Tests

    func testBetaFeatureEnabledWithoutFeatureFlags() throws {
        // Given: Beta mode is enabled but no feature flag manager
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Checking if a feature is enabled
        let isEnabled = betaManager.isBetaFeatureEnabled(.debugMode)

        // Then: It should use local configuration
        XCTAssertNotNil(isEnabled) // Result depends on local config
    }

    func testBetaFeatureToggling() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Toggling a beta feature
        let initialState = betaManager.isBetaFeatureEnabled(.experimentalFilters)
        betaManager.toggleBetaFeature(.experimentalFilters)
        let afterToggle = betaManager.isBetaFeatureEnabled(.experimentalFilters)

        // Then: State should change
        XCTAssertNotEqual(initialState, afterToggle, "Feature state should change after toggle")

        // When: Toggling again
        betaManager.toggleBetaFeature(.experimentalFilters)
        let afterSecondToggle = betaManager.isBetaFeatureEnabled(.experimentalFilters)

        // Then: Should return to original state
        XCTAssertEqual(initialState, afterSecondToggle, "Feature should return to original state")
    }

    func testGetAllBetaFeatures() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Getting all beta features
        let features = betaManager.getAllBetaFeatures()

        // Then: Should return non-empty list
        XCTAssertFalse(features.isEmpty, "Should have beta features available")

        // Should include expected features
        let featureTypes = features.map(\.type)
        XCTAssertTrue(featureTypes.contains(.debugMode), "Should include debug mode feature")
        XCTAssertTrue(featureTypes.contains(.advancedVisualization), "Should include advanced visualization")
    }

    // MARK: - Analytics Tests

    func testBetaAnalyticsTracking() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Tracking an analytics event
        let testEvent = BetaAnalyticsEvent(
            name: "test_event",
            properties: [
                "test_property": "test_value",
                "numeric_property": 42
            ]
        )

        betaManager.trackBetaEvent(testEvent)

        // Then: Event should be stored
        let storedEvents = betaManager.getBetaAnalyticsEvents()
        XCTAssertTrue(storedEvents.contains { event in
            event.name == "test_event"
        }, "Event should be stored in analytics")
    }

    func testAnalyticsEventEnrichment() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Tracking an event
        let simpleEvent = BetaAnalyticsEvent(name: "simple_event")
        betaManager.trackBetaEvent(simpleEvent)

        // Then: Event should be enriched with environment data
        let storedEvents = betaManager.getBetaAnalyticsEvents()
        guard let storedEvent = storedEvents.first(where: { $0.name == "simple_event" }) else {
            XCTFail("Event should be stored")
            return
        }

        XCTAssertTrue(storedEvent.properties.keys.contains("environment"))
        XCTAssertTrue(storedEvent.properties.keys.contains("beta_version"))
        XCTAssertTrue(storedEvent.properties.keys.contains("timestamp"))
    }

    // MARK: - Feedback Collection Tests

    func testFeedbackSubmission() async throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Submitting feedback
        let feedback = BetaFeedback(
            category: .bug,
            title: "Test Feedback",
            description: "This is a test feedback submission",
            severity: .medium,
            attachments: [],
            deviceInfo: BetaDeviceInfo.current,
            timestamp: Date()
        )

        let initialCount = betaManager.feedbackItems.count
        betaManager.submitFeedback(feedback)

        // Then: Feedback should be added
        XCTAssertEqual(betaManager.feedbackItems.count, initialCount + 1)
        XCTAssertTrue(betaManager.feedbackItems.contains { $0.title == "Test Feedback" })
    }

    func testFeedbackInterface() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Showing feedback interface
        XCTAssertFalse(betaManager.isCollectingFeedback)
        betaManager.showFeedbackInterface()

        // Then: Interface should be shown
        XCTAssertTrue(betaManager.isCollectingFeedback)
    }

    // MARK: - Performance Tests

    func testFeatureEvaluationPerformance() throws {
        // Given: Beta mode is enabled
        guard betaManager.isBetaMode else {
            throw XCTSkip("Test requires beta mode")
        }

        // When: Measuring feature evaluation performance
        measure {
            for _ in 0..<1000 {
                _ = betaManager.isBetaFeatureEnabled(.debugMode)
            }
        }

        // Then: Performance should be acceptable (measured by XCTest)
    }

    // MARK: - Error Handling Tests

    func testInvalidFeatureToggle() throws {
        // Given: Beta mode may or may not be enabled

        // When: Toggling features in various states
        betaManager.toggleBetaFeature(.experimentalFilters)

        // Then: Should not crash (basic safety test)
        XCTAssertNotNil(betaManager)
    }
}

// MARK: - Test Helpers

extension BetaTestingManagerTests {
    func waitForAsync(_ timeout: TimeInterval = 5.0, expectation: @escaping () -> Bool) async throws {
        let start = Date()
        while !expectation() {
            if Date().timeIntervalSince(start) > timeout {
                XCTFail("Timed out waiting for expectation")
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
        }
    }
}