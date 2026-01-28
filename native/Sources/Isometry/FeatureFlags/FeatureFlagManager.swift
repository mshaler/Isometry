import Foundation
import Combine
import CloudKit
import os.log

/// Core feature flag management system with real-time toggling and analytics integration
@MainActor
public final class FeatureFlagManager: ObservableObject, Sendable {

    // MARK: - Published Properties

    @Published public private(set) var flags: [String: FeatureFlag] = [:]
    @Published public private(set) var isLoading: Bool = false
    @Published public private(set) var lastSyncDate: Date?

    // MARK: - Private Properties

    private let cloudKitManager: CloudKitSyncManager
    private let analytics: FeatureFlagAnalytics
    private let cache: FeatureFlagCache
    private let logger = Logger(subsystem: "com.isometry.app", category: "FeatureFlags")
    private var subscriptions = Set<AnyCancellable>()

    // MARK: - Initialization

    public init(cloudKitManager: CloudKitSyncManager, analytics: FeatureFlagAnalytics) {
        self.cloudKitManager = cloudKitManager
        self.analytics = analytics
        self.cache = FeatureFlagCache()

        setupCloudKitSync()
        loadCachedFlags()
    }

    // MARK: - Public API

    /// Evaluate feature flag with hierarchical resolution (global → user segment → individual)
    public func isEnabled(_ flagName: String, for userId: String? = nil, userSegment: UserSegment? = nil) -> Bool {
        let startTime = CFAbsoluteTimeGetCurrent()
        defer {
            let evaluationTime = CFAbsoluteTimeGetCurrent() - startTime
            analytics.trackFlagEvaluation(flagName, evaluationTime: evaluationTime, userId: userId)
        }

        guard let flag = flags[flagName] else {
            logger.warning("Feature flag not found: \\(flagName)")
            return false
        }

        // Hierarchical evaluation: individual → segment → global
        if let userId = userId, let userOverride = flag.userOverrides[userId] {
            return userOverride.isEnabled
        }

        if let userSegment = userSegment, let segmentConfig = flag.segmentConfigurations[userSegment.id] {
            return segmentConfig.isEnabled
        }

        return flag.globalConfiguration.isEnabled
    }

    /// Get feature flag configuration with metadata
    public func getFlagConfiguration(_ flagName: String) -> FeatureFlag? {
        return flags[flagName]
    }

    /// Get all active flags for debugging
    public func getAllFlags() -> [String: FeatureFlag] {
        return flags
    }

    /// Force refresh from CloudKit
    public func refresh() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let cloudFlagsDict = try await cloudKitManager.fetchFeatureFlags()
            // Convert [String: Any] to [String: FeatureFlag]
            var cloudFlags: [String: FeatureFlag] = [:]
            for (key, value) in cloudFlagsDict {
                if let flagValue = value as? FeatureFlag {
                    cloudFlags[key] = flagValue
                }
            }
            await updateFlags(cloudFlags)
            lastSyncDate = Date()
            logger.debug("Successfully refreshed \\(cloudFlags.count) feature flags")
        } catch {
            logger.error("Failed to refresh feature flags: \\(error)")
            throw FeatureFlagError.syncFailed(error)
        }
    }

    // MARK: - Private Methods

    private func setupCloudKitSync() {
        // CloudKit sync is handled manually through refreshFlags()
        // TODO: Implement proper CloudKit subscription updates
        logger.debug("CloudKit sync configured to use manual refresh")
    }

    private func loadCachedFlags() {
        let cachedFlags = cache.loadFlags()
        self.flags = cachedFlags
        logger.debug("Loaded \\(cachedFlags.count) cached feature flags")
    }

    private func updateFlags(_ cloudFlags: [String: FeatureFlag]) async {
        let oldFlags = flags
        flags = cloudFlags

        // Cache updated flags
        cache.saveFlags(cloudFlags)

        // Track flag changes for analytics
        let changedFlags = findChangedFlags(old: oldFlags, new: cloudFlags)
        for (flagName, change) in changedFlags {
            analytics.trackFlagChange(flagName, change: change)
        }

        logger.debug("Updated \\(cloudFlags.count) feature flags (\\(changedFlags.count) changed)")
    }

    private func findChangedFlags(old: [String: FeatureFlag], new: [String: FeatureFlag]) -> [String: FlagChange] {
        var changes: [String: FlagChange] = [:]

        // Check for added and modified flags
        for (name, newFlag) in new {
            if let oldFlag = old[name] {
                if oldFlag.globalConfiguration.isEnabled != newFlag.globalConfiguration.isEnabled {
                    changes[name] = .toggled(from: oldFlag.globalConfiguration.isEnabled, to: newFlag.globalConfiguration.isEnabled)
                } else if oldFlag.lastModified != newFlag.lastModified {
                    changes[name] = .modified
                }
            } else {
                changes[name] = .added
            }
        }

        // Check for removed flags
        for (name, _) in old {
            if new[name] == nil {
                changes[name] = .removed
            }
        }

        return changes
    }
}

// MARK: - Supporting Types

/// Feature flag configuration with hierarchical overrides
public struct FeatureFlag: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String
    public let globalConfiguration: FlagConfiguration
    public let segmentConfigurations: [String: FlagConfiguration]
    public let userOverrides: [String: FlagConfiguration]
    public let metadata: FlagMetadata
    public let lastModified: Date

    public init(
        id: String,
        name: String,
        description: String,
        globalConfiguration: FlagConfiguration,
        segmentConfigurations: [String: FlagConfiguration] = [:],
        userOverrides: [String: FlagConfiguration] = [:],
        metadata: FlagMetadata,
        lastModified: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.globalConfiguration = globalConfiguration
        self.segmentConfigurations = segmentConfigurations
        self.userOverrides = userOverrides
        self.metadata = metadata
        self.lastModified = lastModified
    }
}

/// Individual flag configuration
public struct FlagConfiguration: Codable, Sendable {
    public let isEnabled: Bool
    public let rolloutPercentage: Double // 0.0 to 1.0
    public let conditions: [FlagCondition]
    public let validFrom: Date?
    public let validUntil: Date?

    public init(
        isEnabled: Bool,
        rolloutPercentage: Double = 1.0,
        conditions: [FlagCondition] = [],
        validFrom: Date? = nil,
        validUntil: Date? = nil
    ) {
        self.isEnabled = isEnabled
        self.rolloutPercentage = max(0.0, min(1.0, rolloutPercentage))
        self.conditions = conditions
        self.validFrom = validFrom
        self.validUntil = validUntil
    }
}

/// Flag metadata for analytics and management
public struct FlagMetadata: Codable, Sendable {
    public let category: String
    public let owner: String
    public let tags: [String]
    public let priority: FlagPriority
    public let abTestId: String?

    public init(
        category: String,
        owner: String,
        tags: [String] = [],
        priority: FlagPriority = .medium,
        abTestId: String? = nil
    ) {
        self.category = category
        self.owner = owner
        self.tags = tags
        self.priority = priority
        self.abTestId = abTestId
    }
}

/// Condition operator for flag evaluation
public enum ConditionOperator: String, Codable, Sendable {
    case equals
    case notEquals
    case greaterThan
    case lessThan
    case contains
    case matches
}

/// Flag evaluation conditions
public struct FlagCondition: Codable, Sendable {
    public let type: ConditionType
    public let `operator`: ConditionOperator
    public let value: String

    public enum ConditionType: String, Codable, Sendable {
        case appVersion
        case osVersion
        case deviceModel
        case userProperty
        case timeWindow
    }
}

/// Flag priority for management interfaces
public enum FlagPriority: String, Codable, Sendable, CaseIterable {
    case low
    case medium
    case high
    case critical
}

/// User segment for targeted flag delivery
public struct UserSegment: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let criteria: [SegmentCriterion]

    public struct SegmentCriterion: Codable, Sendable {
        public let property: String
        public let `operator`: ConditionOperator
        public let value: String
    }
}

/// Flag change tracking for analytics
public enum FlagChange: Sendable {
    case added
    case removed
    case modified
    case toggled(from: Bool, to: Bool)
}

/// Feature flag errors
public enum FeatureFlagError: LocalizedError {
    case syncFailed(Error)
    case configurationInvalid(String)
    case evaluationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .syncFailed(let error):
            return "Feature flag sync failed: \(error.localizedDescription)"
        case .configurationInvalid(let reason):
            return "Feature flag configuration invalid: \(reason)"
        case .evaluationFailed(let reason):
            return "Feature flag evaluation failed: \(reason)"
        }
    }
}

// MARK: - Local Caching

private final class FeatureFlagCache {
    private let cacheURL: URL
    private let logger = Logger(subsystem: "com.isometry.app", category: "FeatureFlagCache")

    init() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.cacheURL = documentsPath.appendingPathComponent("feature_flags_cache.json")
    }

    func loadFlags() -> [String: FeatureFlag] {
        do {
            let data = try Data(contentsOf: cacheURL)
            let flags = try JSONDecoder().decode([String: FeatureFlag].self, from: data)
            return flags
        } catch {
            logger.debug("No cached feature flags found or failed to load: \\(error)")
            return [:]
        }
    }

    func saveFlags(_ flags: [String: FeatureFlag]) {
        do {
            let data = try JSONEncoder().encode(flags)
            try data.write(to: cacheURL)
        } catch {
            logger.error("Failed to cache feature flags: \\(error)")
        }
    }
}