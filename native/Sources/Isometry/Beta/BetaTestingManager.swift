import Foundation
import SwiftUI
import Combine

// MARK: - Beta Configuration

public struct BetaConfiguration {
    public let version: String
    public let build: String
    public let testingPhase: TestingPhase
    public let features: [BetaFeature]
    public let feedbackCategories: [FeedbackCategory]
    public let analyticsEndpoint: String?

    public enum TestingPhase: String, CaseIterable {
        case alpha = "Alpha"
        case internalBeta = "Internal Beta"
        case externalBeta = "External Beta"
        case preRelease = "Pre-Release"
    }
}

public struct BetaVersion {
    public let configuration: BetaConfiguration
    public let releaseDate: Date
    public let expirationDate: Date
    public let testInstructions: String
    public let knownIssues: [String]
    public let newFeatures: [String]
}

/// Beta testing infrastructure for Isometry TestFlight distribution
@MainActor
public class BetaTestingManager: ObservableObject {

    // MARK: - Published State

    @Published public var isBetaMode: Bool = false
    @Published public var betaVersion: BetaVersion?
    @Published public var feedbackItems: [BetaFeedback] = []
    @Published public var isCollectingFeedback = false
    @Published public var analyticsEnabled = true

    // UX-01 & UX-02: User experience optimization properties
    @Published public var hasCompletedOnboarding = false
    @Published public var testingProgress: Double = 0.0
    @Published public var testingActivities: [TestingActivity] = []
    @Published public var userEngagementScore: Double = 0.0

    // MARK: - Initialization

    public init() {
        setupBetaMode()
        loadUserProgress()
        setupTestingActivities()
    }

    private func setupBetaMode() {
        // Check if this is a beta build
        #if DEBUG
        isBetaMode = true
        #else
        // Check for TestFlight environment
        isBetaMode = Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif

        if isBetaMode {
            setupBetaVersion()
            setupBetaAnalytics()
        }
    }

    private func setupBetaVersion() {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

        let configuration = BetaConfiguration(
            version: version,
            build: build,
            testingPhase: .externalBeta,
            features: createBetaFeatures(),
            feedbackCategories: createFeedbackCategories(),
            analyticsEndpoint: nil // Would be set to real endpoint in production
        )

        betaVersion = BetaVersion(
            configuration: configuration,
            releaseDate: Date(),
            expirationDate: Calendar.current.date(byAdding: .day, value: 90, to: Date()) ?? Date(),
            testInstructions: """
            Welcome to the Isometry beta!

            ## What to Test
            - SuperGrid visualization with your own data
            - CloudKit sync across devices
            - Performance with large datasets (1000+ items)
            - Filter and search functionality
            - Multi-platform consistency (iOS/macOS)

            ## Known Issues
            - CloudKit sync may be slow on first launch
            - Large datasets may affect performance
            - Some UI elements may not be final

            ## How to Provide Feedback
            Use the feedback button in the app or shake your device to report issues.
            """,
            knownIssues: [
                "CloudKit sync performance optimization in progress",
                "Large dataset rendering may experience frame drops",
                "Some accessibility features still being refined"
            ],
            newFeatures: [
                "SuperGrid with dynamic visualization",
                "CloudKit cross-device sync",
                "Production-ready performance optimization",
                "Comprehensive App Store compliance"
            ]
        )
    }

    private func setupBetaAnalytics() {
        // In production, this would set up analytics collection
        // For now, just track basic usage locally
        analyticsEnabled = true
    }

    // MARK: - Feedback Collection

    public func showFeedbackInterface() {
        isCollectingFeedback = true
    }

    public func submitFeedback(_ feedback: BetaFeedback) {
        feedbackItems.append(feedback)

        // Update engagement score for feedback submission
        updateEngagementScore(action: .submittedFeedback)

        Task {
            await sendFeedbackToServer(feedback)
        }
    }

    private func sendFeedbackToServer(_ feedback: BetaFeedback) async {
        // In production, this would send feedback to a server
        // For now, just simulate the network request
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

        await MainActor.run {
            // Mark feedback as sent
            if let index = feedbackItems.firstIndex(where: { $0.id == feedback.id }) {
                feedbackItems[index] = BetaFeedback(
                    category: feedback.category,
                    title: feedback.title,
                    description: feedback.description,
                    severity: feedback.severity,
                    attachments: feedback.attachments,
                    deviceInfo: feedback.deviceInfo,
                    timestamp: feedback.timestamp,
                    status: .sent
                )
            }
        }
    }

    // MARK: - Beta Features Management

    public func isBetaFeatureEnabled(_ feature: BetaFeature.FeatureType) -> Bool {
        guard let betaVersion = betaVersion else { return false }
        return betaVersion.configuration.features.first(where: { $0.type == feature })?.isEnabled ?? false
    }

    public func toggleBetaFeature(_ feature: BetaFeature.FeatureType) {
        guard let betaVersion = betaVersion else { return }

        if let index = betaVersion.configuration.features.firstIndex(where: { $0.type == feature }) {
            var updatedFeatures = betaVersion.configuration.features
            updatedFeatures[index].isEnabled.toggle()

            let updatedConfiguration = BetaConfiguration(
                version: betaVersion.configuration.version,
                build: betaVersion.configuration.build,
                testingPhase: betaVersion.configuration.testingPhase,
                features: updatedFeatures,
                feedbackCategories: betaVersion.configuration.feedbackCategories,
                analyticsEndpoint: betaVersion.configuration.analyticsEndpoint
            )

            self.betaVersion = BetaVersion(
                configuration: updatedConfiguration,
                releaseDate: betaVersion.releaseDate,
                expirationDate: betaVersion.expirationDate,
                testInstructions: betaVersion.testInstructions,
                knownIssues: betaVersion.knownIssues,
                newFeatures: betaVersion.newFeatures
            )
        }
    }

    // MARK: - Analytics

    public func trackBetaEvent(_ event: BetaAnalyticsEvent) {
        guard analyticsEnabled else { return }

        // In production, this would send analytics to a server
        // For now, just log locally for debugging
        print("Beta Analytics: \(event.name) - \(event.properties)")
    }

    // MARK: - UX Optimization Methods (UX-01, UX-02)

    public func completeOnboarding() {
        hasCompletedOnboarding = true
        UserDefaults.standard.set(true, forKey: "beta_onboarding_completed")

        // Track onboarding completion
        trackBetaEvent(BetaAnalyticsEvent(
            name: "onboarding_completed",
            properties: ["completion_time": Date().timeIntervalSince1970]
        ))

        // Update engagement score
        updateEngagementScore(action: .completedOnboarding)
    }

    private func loadUserProgress() {
        hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "beta_onboarding_completed")
        testingProgress = UserDefaults.standard.double(forKey: "beta_testing_progress")
        userEngagementScore = UserDefaults.standard.double(forKey: "beta_engagement_score")

        // Load completed activities
        let completedActivityIds = UserDefaults.standard.stringArray(forKey: "beta_completed_activities") ?? []
        for activityId in completedActivityIds {
            if let activity = testingActivities.first(where: { $0.id.uuidString == activityId }) {
                completeTestingActivity(activity.type)
            }
        }
    }

    private func setupTestingActivities() {
        testingActivities = [
            TestingActivity(
                type: .basicNavigation,
                title: "Basic App Navigation",
                description: "Explore the main interface and navigation between sections",
                estimatedDuration: 300 // 5 minutes
            ),
            TestingActivity(
                type: .dataManagement,
                title: "Data Management Testing",
                description: "Create, edit, and organize data items",
                estimatedDuration: 900 // 15 minutes
            ),
            TestingActivity(
                type: .cloudKitSync,
                title: "CloudKit Synchronization",
                description: "Test data sync across devices",
                estimatedDuration: 600 // 10 minutes
            ),
            TestingActivity(
                type: .performanceTesting,
                title: "Performance Evaluation",
                description: "Test app performance with various dataset sizes",
                estimatedDuration: 600 // 10 minutes
            ),
            TestingActivity(
                type: .filterSearch,
                title: "Filter and Search Testing",
                description: "Test filtering capabilities and search functionality",
                estimatedDuration: 480 // 8 minutes
            ),
            TestingActivity(
                type: .feedbackSubmission,
                title: "Feedback System Testing",
                description: "Submit feedback using the in-app feedback system",
                estimatedDuration: 300 // 5 minutes
            ),
            TestingActivity(
                type: .accessibilityTesting,
                title: "Accessibility Features",
                description: "Test with VoiceOver and accessibility features",
                estimatedDuration: 900 // 15 minutes
            ),
            TestingActivity(
                type: .edgeCaseTesting,
                title: "Edge Case Testing",
                description: "Test with large datasets and edge conditions",
                estimatedDuration: 900 // 15 minutes
            )
        ]
    }

    public func completeTestingActivity(_ activityType: TestingActivity.ActivityType) {
        guard let index = testingActivities.firstIndex(where: { $0.type == activityType && !$0.isCompleted }) else {
            return
        }

        testingActivities[index].isCompleted = true
        testingActivities[index].completedDate = Date()

        // Update progress
        updateTestingProgress()

        // Update engagement score
        updateEngagementScore(action: .completedActivity)

        // Save to UserDefaults
        let completedActivityIds = testingActivities.filter { $0.isCompleted }.map { $0.id.uuidString }
        UserDefaults.standard.set(completedActivityIds, forKey: "beta_completed_activities")

        // Track analytics
        trackBetaEvent(BetaAnalyticsEvent(
            name: "testing_activity_completed",
            properties: [
                "activity_type": activityType.rawValue,
                "completion_time": Date().timeIntervalSince1970
            ]
        ))
    }

    private func updateTestingProgress() {
        let completedCount = testingActivities.filter { $0.isCompleted }.count
        testingProgress = Double(completedCount) / Double(testingActivities.count)
        UserDefaults.standard.set(testingProgress, forKey: "beta_testing_progress")
    }

    private func updateEngagementScore(action: EngagementAction) {
        let previousScore = userEngagementScore

        switch action {
        case .completedOnboarding:
            userEngagementScore += 0.2
        case .completedActivity:
            userEngagementScore += 0.1
        case .submittedFeedback:
            userEngagementScore += 0.15
        case .viewedInstructions:
            userEngagementScore += 0.05
        }

        // Cap at 1.0
        userEngagementScore = min(userEngagementScore, 1.0)

        // Save to UserDefaults
        UserDefaults.standard.set(userEngagementScore, forKey: "beta_engagement_score")

        // Track engagement improvement
        if userEngagementScore > previousScore {
            trackBetaEvent(BetaAnalyticsEvent(
                name: "engagement_score_updated",
                properties: [
                    "previous_score": previousScore,
                    "new_score": userEngagementScore,
                    "action": action.rawValue
                ]
            ))
        }
    }

    private enum EngagementAction: String {
        case completedOnboarding = "completed_onboarding"
        case completedActivity = "completed_activity"
        case submittedFeedback = "submitted_feedback"
        case viewedInstructions = "viewed_instructions"
    }

    // MARK: - Helper Methods

    private func createBetaFeatures() -> [BetaFeature] {
        return [
            BetaFeature(
                type: .advancedVisualization,
                name: "Advanced Visualization",
                description: "Enhanced SuperGrid rendering with experimental features",
                isEnabled: true,
                isExperimental: true
            ),
            BetaFeature(
                type: .enhancedSync,
                name: "Enhanced CloudKit Sync",
                description: "Improved sync performance and conflict resolution",
                isEnabled: true,
                isExperimental: false
            ),
            BetaFeature(
                type: .debugMode,
                name: "Debug Mode",
                description: "Additional debugging tools and performance metrics",
                isEnabled: isBetaMode,
                isExperimental: true
            ),
            BetaFeature(
                type: .experimentalFilters,
                name: "Experimental Filters",
                description: "New filtering capabilities and search algorithms",
                isEnabled: false,
                isExperimental: true
            )
        ]
    }

    private func createFeedbackCategories() -> [FeedbackCategory] {
        return [
            FeedbackCategory(
                type: .bug,
                name: "Bug Report",
                description: "Report crashes, errors, or unexpected behavior",
                icon: "ladybug.fill"
            ),
            FeedbackCategory(
                type: .performance,
                name: "Performance Issue",
                description: "Report slow performance or frame drops",
                icon: "speedometer"
            ),
            FeedbackCategory(
                type: .ui,
                name: "UI/UX Feedback",
                description: "Suggest improvements to the user interface",
                icon: "paintbrush.fill"
            ),
            FeedbackCategory(
                type: .feature,
                name: "Feature Request",
                description: "Suggest new features or enhancements",
                icon: "lightbulb.fill"
            ),
            FeedbackCategory(
                type: .sync,
                name: "Sync Issue",
                description: "Report CloudKit sync problems",
                icon: "icloud.fill"
            ),
            FeedbackCategory(
                type: .general,
                name: "General Feedback",
                description: "Any other comments or suggestions",
                icon: "message.fill"
            )
        ]
    }
}

// MARK: - Supporting Types

public struct BetaFeature {
    public let type: FeatureType
    public let name: String
    public let description: String
    public var isEnabled: Bool
    public let isExperimental: Bool

    public enum FeatureType: String, CaseIterable {
        case advancedVisualization = "advanced_visualization"
        case enhancedSync = "enhanced_sync"
        case debugMode = "debug_mode"
        case experimentalFilters = "experimental_filters"
    }
}

public struct BetaFeedback: Identifiable {
    public let id = UUID()
    public let category: FeedbackCategory.CategoryType
    public let title: String
    public let description: String
    public let severity: FeedbackSeverity
    public let attachments: [FeedbackAttachment]
    public let deviceInfo: BetaDeviceInfo
    public let timestamp: Date
    public var status: FeedbackStatus = .pending

    public enum FeedbackSeverity: String, CaseIterable {
        case low = "Low"
        case medium = "Medium"
        case high = "High"
        case critical = "Critical"
    }

    public enum FeedbackStatus {
        case pending
        case sent
        case acknowledged
        case resolved
    }
}

public struct FeedbackCategory {
    public let type: CategoryType
    public let name: String
    public let description: String
    public let icon: String

    public enum CategoryType: String, CaseIterable {
        case bug = "bug"
        case performance = "performance"
        case ui = "ui"
        case feature = "feature"
        case sync = "sync"
        case general = "general"
    }
}

public struct FeedbackAttachment {
    public let id = UUID()
    public let type: AttachmentType
    public let data: Data
    public let filename: String

    public enum AttachmentType {
        case screenshot
        case log
        case crash
    }
}

public struct BetaDeviceInfo {
    public let model: String
    public let osVersion: String
    public let appVersion: String
    public let buildNumber: String
    public let locale: String
    public let timezone: String

    public static var current: BetaDeviceInfo {
        #if os(iOS)
        let model = UIDevice.current.model
        let osVersion = UIDevice.current.systemVersion
        #else
        let model = "Mac"
        let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
        #endif

        return BetaDeviceInfo(
            model: model,
            osVersion: osVersion,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown",
            buildNumber: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown",
            locale: Locale.current.identifier,
            timezone: TimeZone.current.identifier
        )
    }
}

public struct BetaAnalyticsEvent {
    public let name: String
    public let properties: [String: Any]
    public let timestamp: Date

    public init(name: String, properties: [String: Any] = [:]) {
        self.name = name
        self.properties = properties
        self.timestamp = Date()
    }
}

// MARK: - UX Optimization Types

public struct TestingActivity: Identifiable {
    public let id = UUID()
    public let type: ActivityType
    public let title: String
    public let description: String
    public let estimatedDuration: TimeInterval
    public var isCompleted: Bool = false
    public var completedDate: Date?

    public enum ActivityType: String, CaseIterable {
        case basicNavigation = "basic_navigation"
        case dataManagement = "data_management"
        case cloudKitSync = "cloudkit_sync"
        case performanceTesting = "performance_testing"
        case filterSearch = "filter_search"
        case feedbackSubmission = "feedback_submission"
        case accessibilityTesting = "accessibility_testing"
        case edgeCaseTesting = "edge_case_testing"
    }

    public init(type: ActivityType, title: String, description: String, estimatedDuration: TimeInterval) {
        self.type = type
        self.title = title
        self.description = description
        self.estimatedDuration = estimatedDuration
    }
}