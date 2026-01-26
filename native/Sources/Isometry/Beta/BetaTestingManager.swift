import Foundation
import SwiftUI
import Combine
import CloudKit
import os.log

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

/// Beta testing infrastructure for Isometry TestFlight distribution with enhanced environment detection and feature flag integration
@MainActor
public class BetaTestingManager: ObservableObject {

    // MARK: - Published State

    @Published public var isBetaMode: Bool = false
    @Published public var betaVersion: BetaVersion?
    @Published public var feedbackItems: [BetaFeedback] = []
    @Published public var isCollectingFeedback = false
    @Published public var analyticsEnabled = true
    @Published public var environmentStatus: EnvironmentStatus = .unknown
    @Published public var isExpired = false

    // MARK: - Dependencies

    private let featureFlagManager: FeatureFlagManager?
    private let cloudKitManager: CloudKitSyncManager?
    private let logger = Logger(subsystem: "com.isometry.app", category: "BetaTesting")

    // MARK: - Environment Detection

    public enum EnvironmentStatus: String, CaseIterable {
        case production = "Production"
        case testFlight = "TestFlight"
        case debug = "Debug"
        case simulator = "Simulator"
        case unknown = "Unknown"

        public var isTestEnvironment: Bool {
            switch self {
            case .production:
                return false
            case .testFlight, .debug, .simulator:
                return true
            case .unknown:
                return false
            }
        }
    }

    // MARK: - Initialization

    public init(featureFlagManager: FeatureFlagManager? = nil, cloudKitManager: CloudKitSyncManager? = nil) {
        self.featureFlagManager = featureFlagManager
        self.cloudKitManager = cloudKitManager
        setupBetaMode()
    }

    private func setupBetaMode() {
        // Enhanced environment detection
        environmentStatus = detectEnvironment()
        isBetaMode = environmentStatus.isTestEnvironment

        logger.info("Environment detected: \(environmentStatus.rawValue), Beta mode: \(isBetaMode)")

        if isBetaMode {
            setupBetaVersion()
            setupBetaAnalytics()
            checkBetaExpiration()
        }
    }

    /// Comprehensive environment detection for TestFlight, Debug, and Production builds
    private func detectEnvironment() -> EnvironmentStatus {
        // Check for simulator first
        #if targetEnvironment(simulator)
        return .simulator
        #endif

        // Check for debug configuration
        #if DEBUG
        return .debug
        #endif

        // Check for TestFlight environment
        // Multiple detection methods for reliability
        if isTestFlightEnvironment() {
            return .testFlight
        }

        // Default to production
        return .production
    }

    /// Robust TestFlight detection using multiple indicators
    private func isTestFlightEnvironment() -> Bool {
        // Method 1: Check App Store receipt URL
        let receiptUrl = Bundle.main.appStoreReceiptURL
        let isTestFlightReceipt = receiptUrl?.lastPathComponent == "sandboxReceipt"

        // Method 2: Check bundle provisioning profile (if available)
        let hasEmbeddedProfile = Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") != nil

        // Method 3: Check for TestFlight-specific Info.plist entries
        let hasTestFlightConfig = Bundle.main.object(forInfoDictionaryKey: "ITSAppUsesNonExemptEncryption") != nil

        // Method 4: Check for beta identifier in bundle
        let bundleId = Bundle.main.bundleIdentifier ?? ""
        let hasBetaIdentifier = bundleId.contains(".beta") || bundleId.contains("-beta")

        // TestFlight if any of the strong indicators are present
        let isTestFlight = isTestFlightReceipt || (hasEmbeddedProfile && hasTestFlightConfig)

        logger.info("TestFlight detection - Receipt: \(isTestFlightReceipt), Profile: \(hasEmbeddedProfile), Config: \(hasTestFlightConfig), BundleId: \(hasBetaIdentifier)")

        return isTestFlight
    }

    /// Check if beta version has expired
    private func checkBetaExpiration() {
        guard let betaVersion = betaVersion else { return }

        let now = Date()
        isExpired = now > betaVersion.expirationDate

        if isExpired {
            logger.warning("Beta version expired on \(betaVersion.expirationDate)")
            // Track expiration event
            trackBetaEvent(BetaAnalyticsEvent(
                name: "beta_expired",
                properties: [
                    "expiration_date": betaVersion.expirationDate.timeIntervalSince1970,
                    "days_overdue": now.timeIntervalSince(betaVersion.expirationDate) / 86400
                ]
            ))
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

    // MARK: - Beta Features Management with Feature Flag Integration

    /// Check if a beta feature is enabled, integrating with the centralized feature flag system
    public func isBetaFeatureEnabled(_ feature: BetaFeature.FeatureType) -> Bool {
        // First check centralized feature flag system if available
        if let featureFlagManager = featureFlagManager {
            let flagName = "beta_\(feature.rawValue)"
            if featureFlagManager.getAllFlags()[flagName] != nil {
                return featureFlagManager.isEnabled(flagName)
            }
        }

        // Fallback to local beta configuration
        guard let betaVersion = betaVersion else { return false }
        return betaVersion.configuration.features.first(where: { $0.type == feature })?.isEnabled ?? false
    }

    /// Toggle beta feature with proper analytics tracking
    public func toggleBetaFeature(_ feature: BetaFeature.FeatureType) {
        let wasEnabled = isBetaFeatureEnabled(feature)

        // Update local beta configuration
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

            // Track feature toggle analytics
            trackBetaEvent(BetaAnalyticsEvent(
                name: "beta_feature_toggled",
                properties: [
                    "feature": feature.rawValue,
                    "enabled": !wasEnabled,
                    "environment": environmentStatus.rawValue
                ]
            ))

            logger.info("Toggled beta feature \(feature.rawValue): \(wasEnabled) -> \(!wasEnabled)")
        }
    }

    /// Get all available beta features with their current state
    public func getAllBetaFeatures() -> [BetaFeature] {
        guard let betaVersion = betaVersion else { return [] }

        return betaVersion.configuration.features.map { feature in
            BetaFeature(
                type: feature.type,
                name: feature.name,
                description: feature.description,
                isEnabled: isBetaFeatureEnabled(feature.type),
                isExperimental: feature.isExperimental
            )
        }
    }

    // MARK: - Analytics with Enhanced Tracking

    /// Track beta events with comprehensive analytics
    public func trackBetaEvent(_ event: BetaAnalyticsEvent) {
        guard analyticsEnabled else { return }

        // Enhanced analytics with environment context
        let enrichedProperties = event.properties.merging([
            "environment": environmentStatus.rawValue,
            "beta_version": betaVersion?.configuration.version ?? "unknown",
            "build_number": betaVersion?.configuration.build ?? "unknown",
            "testing_phase": betaVersion?.configuration.testingPhase.rawValue ?? "unknown",
            "is_expired": isExpired,
            "timestamp": Date().timeIntervalSince1970
        ]) { existing, _ in existing }

        let enrichedEvent = BetaAnalyticsEvent(
            name: event.name,
            properties: enrichedProperties
        )

        // Log locally for debugging
        logger.info("Beta Analytics: \(enrichedEvent.name) - \(enrichedProperties)")

        // In production, this would send analytics to a server
        // For now, store locally and could sync with CloudKit
        storeBetaAnalyticsEvent(enrichedEvent)
    }

    /// Store beta analytics events locally with optional CloudKit sync
    private func storeBetaAnalyticsEvent(_ event: BetaAnalyticsEvent) {
        // Store in UserDefaults for persistence
        var storedEvents = UserDefaults.standard.array(forKey: "betaAnalyticsEvents") as? [Data] ?? []

        if let eventData = try? JSONEncoder().encode(event) {
            storedEvents.append(eventData)

            // Keep only last 100 events to prevent unbounded growth
            if storedEvents.count > 100 {
                storedEvents = Array(storedEvents.suffix(100))
            }

            UserDefaults.standard.set(storedEvents, forKey: "betaAnalyticsEvents")
        }
    }

    /// Get stored beta analytics events for reporting
    public func getBetaAnalyticsEvents() -> [BetaAnalyticsEvent] {
        let storedEvents = UserDefaults.standard.array(forKey: "betaAnalyticsEvents") as? [Data] ?? []

        return storedEvents.compactMap { data in
            try? JSONDecoder().decode(BetaAnalyticsEvent.self, from: data)
        }
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

public struct BetaAnalyticsEvent: Codable {
    public let name: String
    public let properties: [String: AnyCodable]
    public let timestamp: Date

    public init(name: String, properties: [String: Any] = [:]) {
        self.name = name
        self.properties = properties.mapValues { AnyCodable($0) }
        self.timestamp = Date()
    }
}

/// Helper type to encode/decode Any values in analytics events
public struct AnyCodable: Codable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let value = try? container.decode(Bool.self) {
            self.value = value
        } else if let value = try? container.decode(Int.self) {
            self.value = value
        } else if let value = try? container.decode(Double.self) {
            self.value = value
        } else if let value = try? container.decode(String.self) {
            self.value = value
        } else {
            self.value = NSNull()
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        if let value = value as? Bool {
            try container.encode(value)
        } else if let value = value as? Int {
            try container.encode(value)
        } else if let value = value as? Double {
            try container.encode(value)
        } else if let value = value as? String {
            try container.encode(value)
        } else {
            try container.encodeNil()
        }
    }
}