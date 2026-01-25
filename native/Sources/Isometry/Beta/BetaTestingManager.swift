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

    // MARK: - Initialization

    public init() {
        setupBetaMode()
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
    public let deviceInfo: DeviceInfo
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

public struct DeviceInfo {
    public let model: String
    public let osVersion: String
    public let appVersion: String
    public let buildNumber: String
    public let locale: String
    public let timezone: String

    public static var current: DeviceInfo {
        #if os(iOS)
        let model = UIDevice.current.model
        let osVersion = UIDevice.current.systemVersion
        #else
        let model = "Mac"
        let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
        #endif

        return DeviceInfo(
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