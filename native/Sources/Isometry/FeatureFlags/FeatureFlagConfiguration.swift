import Foundation
import CloudKit
import os.log

/// Feature flag configuration models and CloudKit integration
public struct FeatureFlagConfiguration: Sendable {

    /// CloudKit record type for feature flags
    public static let recordType = "FeatureFlag"

    /// Convert FeatureFlag to CloudKit record
    public static func cloudKitRecord(from flag: FeatureFlag) throws -> CKRecord {
        let record = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: flag.id))

        record["name"] = flag.name
        record["description"] = flag.description
        record["lastModified"] = flag.lastModified

        // Encode configurations as JSON data
        let encoder = JSONEncoder()
        record["globalConfiguration"] = try encoder.encode(flag.globalConfiguration)

        if !flag.segmentConfigurations.isEmpty {
            record["segmentConfigurations"] = try encoder.encode(flag.segmentConfigurations)
        }

        if !flag.userOverrides.isEmpty {
            record["userOverrides"] = try encoder.encode(flag.userOverrides)
        }

        record["metadata"] = try encoder.encode(flag.metadata)

        return record
    }

    /// Convert CloudKit record to FeatureFlag
    public static func featureFlag(from record: CKRecord) throws -> FeatureFlag {
        guard let name = record["name"] as? String,
              let description = record["description"] as? String,
              let lastModified = record["lastModified"] as? Date,
              let globalConfigData = record["globalConfiguration"] as? Data,
              let metadataData = record["metadata"] as? Data else {
            throw FeatureFlagConfigurationError.invalidRecord("Missing required fields")
        }

        let decoder = JSONDecoder()

        let globalConfiguration = try decoder.decode(FlagConfiguration.self, from: globalConfigData)
        let metadata = try decoder.decode(FlagMetadata.self, from: metadataData)

        let segmentConfigurations: [String: FlagConfiguration]
        if let segmentData = record["segmentConfigurations"] as? Data {
            segmentConfigurations = try decoder.decode([String: FlagConfiguration].self, from: segmentData)
        } else {
            segmentConfigurations = [:]
        }

        let userOverrides: [String: FlagConfiguration]
        if let userData = record["userOverrides"] as? Data {
            userOverrides = try decoder.decode([String: FlagConfiguration].self, from: userData)
        } else {
            userOverrides = [:]
        }

        return FeatureFlag(
            id: record.recordID.recordName,
            name: name,
            description: description,
            globalConfiguration: globalConfiguration,
            segmentConfigurations: segmentConfigurations,
            userOverrides: userOverrides,
            metadata: metadata,
            lastModified: lastModified
        )
    }
}

/// Default feature flag configurations for the application
public struct DefaultFeatureFlags {

    /// Core feature flags for beta testing
    public static let betaFeatures: [FeatureFlag] = [
        FeatureFlag(
            id: "advanced_analytics",
            name: "Advanced Analytics",
            description: "Enable ML-powered analytics and insights",
            globalConfiguration: FlagConfiguration(
                isEnabled: false,
                rolloutPercentage: 0.0
            ),
            metadata: FlagMetadata(
                category: "analytics",
                owner: "beta-team",
                tags: ["ml", "analytics", "beta"],
                priority: .high
            )
        ),

        FeatureFlag(
            id: "adaptive_ui",
            name: "Adaptive UI",
            description: "Enable ML-powered adaptive user interfaces",
            globalConfiguration: FlagConfiguration(
                isEnabled: false,
                rolloutPercentage: 0.1
            ),
            metadata: FlagMetadata(
                category: "user-experience",
                owner: "ui-team",
                tags: ["ml", "ui", "personalization"],
                priority: .medium
            )
        ),

        FeatureFlag(
            id: "real_time_sync",
            name: "Real-time Sync",
            description: "Enable real-time CloudKit synchronization",
            globalConfiguration: FlagConfiguration(
                isEnabled: true,
                rolloutPercentage: 1.0
            ),
            metadata: FlagMetadata(
                category: "sync",
                owner: "sync-team",
                tags: ["cloudkit", "sync", "realtime"],
                priority: .critical
            )
        ),

        FeatureFlag(
            id: "beta_feedback_enhanced",
            name: "Enhanced Beta Feedback",
            description: "Enable enhanced feedback collection with ML categorization",
            globalConfiguration: FlagConfiguration(
                isEnabled: false,
                rolloutPercentage: 0.5,
                conditions: [
                    FlagCondition(
                        type: .userProperty,
                        operator: .equals,
                        value: "beta_user=true"
                    )
                ]
            ),
            metadata: FlagMetadata(
                category: "beta",
                owner: "beta-team",
                tags: ["feedback", "ml", "beta"],
                priority: .high
            )
        ),

        FeatureFlag(
            id: "ab_testing_framework",
            name: "A/B Testing Framework",
            description: "Enable A/B testing capabilities for experiments",
            globalConfiguration: FlagConfiguration(
                isEnabled: true,
                rolloutPercentage: 1.0
            ),
            metadata: FlagMetadata(
                category: "experimentation",
                owner: "growth-team",
                tags: ["ab-testing", "experiments", "framework"],
                priority: .high
            )
        )
    ]

    /// Development and debugging flags
    public static let developmentFlags: [FeatureFlag] = [
        FeatureFlag(
            id: "debug_logging",
            name: "Debug Logging",
            description: "Enable verbose debug logging",
            globalConfiguration: FlagConfiguration(
                isEnabled: false,
                rolloutPercentage: 1.0,
                conditions: [
                    FlagCondition(
                        type: .appVersion,
                        operator: .contains,
                        value: "debug"
                    )
                ]
            ),
            metadata: FlagMetadata(
                category: "development",
                owner: "dev-team",
                tags: ["debug", "logging", "development"],
                priority: .low
            )
        ),

        FeatureFlag(
            id: "mock_data",
            name: "Mock Data Mode",
            description: "Use mock data for development and testing",
            globalConfiguration: FlagConfiguration(
                isEnabled: false,
                rolloutPercentage: 1.0
            ),
            metadata: FlagMetadata(
                category: "development",
                owner: "dev-team",
                tags: ["mock", "testing", "development"],
                priority: .low
            )
        )
    ]

    /// All default flags combined
    public static let all: [FeatureFlag] = betaFeatures + developmentFlags

    /// Default flags as dictionary (keyed by flag name)
    public static let dictionary: [String: FeatureFlag] = {
        var dict: [String: FeatureFlag] = [:]
        for flag in all {
            dict[flag.name] = flag
        }
        return dict
    }()
}

/// Configuration validation utilities
public struct FeatureFlagValidator {

    /// Validate flag configuration
    public static func validate(_ flag: FeatureFlag) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Validate basic properties
        if flag.name.isEmpty {
            errors.append("Flag name cannot be empty")
        }

        if flag.description.isEmpty {
            warnings.append("Flag description is empty")
        }

        // Validate rollout percentage
        let rollout = flag.globalConfiguration.rolloutPercentage
        if rollout < 0.0 || rollout > 1.0 {
            errors.append("Global rollout percentage must be between 0.0 and 1.0")
        }

        // Validate segment configurations
        for (segmentId, config) in flag.segmentConfigurations {
            if segmentId.isEmpty {
                errors.append("Segment ID cannot be empty")
            }
            if config.rolloutPercentage < 0.0 || config.rolloutPercentage > 1.0 {
                errors.append("Segment rollout percentage must be between 0.0 and 1.0")
            }
        }

        // Validate user overrides
        for (userId, config) in flag.userOverrides {
            if userId.isEmpty {
                errors.append("User ID cannot be empty")
            }
            if config.rolloutPercentage < 0.0 || config.rolloutPercentage > 1.0 {
                errors.append("User override rollout percentage must be between 0.0 and 1.0")
            }
        }

        // Validate time windows
        if let validFrom = flag.globalConfiguration.validFrom,
           let validUntil = flag.globalConfiguration.validUntil {
            if validFrom >= validUntil {
                errors.append("Valid from date must be before valid until date")
            }
        }

        // Validate conditions
        for condition in flag.globalConfiguration.conditions {
            if condition.value.isEmpty {
                warnings.append("Condition value is empty")
            }
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    public struct ValidationResult {
        public let isValid: Bool
        public let errors: [String]
        public let warnings: [String]

        public var hasWarnings: Bool { !warnings.isEmpty }
    }
}

/// Feature flag configuration environment management
public struct FeatureFlagEnvironment {

    public enum Environment: String, CaseIterable {
        case development
        case staging
        case production

        var isProduction: Bool {
            return self == .production
        }
    }

    /// Get current environment based on build configuration
    public static var current: Environment {
        #if DEBUG
        return .development
        #elseif STAGING
        return .staging
        #else
        return .production
        #endif
    }

    /// Get environment-specific flag overrides
    public static func environmentOverrides(for environment: Environment) -> [String: FlagConfiguration] {
        switch environment {
        case .development:
            return [
                "debug_logging": FlagConfiguration(isEnabled: true),
                "mock_data": FlagConfiguration(isEnabled: true)
            ]
        case .staging:
            return [
                "debug_logging": FlagConfiguration(isEnabled: false),
                "mock_data": FlagConfiguration(isEnabled: false),
                "advanced_analytics": FlagConfiguration(isEnabled: true, rolloutPercentage: 1.0),
                "adaptive_ui": FlagConfiguration(isEnabled: true, rolloutPercentage: 0.5)
            ]
        case .production:
            return [:]
        }
    }

    /// Apply environment-specific overrides to flags
    public static func applyEnvironmentOverrides(_ flags: [String: FeatureFlag]) -> [String: FeatureFlag] {
        let overrides = environmentOverrides(for: current)
        var updatedFlags = flags

        for (flagName, override) in overrides {
            if var flag = updatedFlags[flagName] {
                flag = FeatureFlag(
                    id: flag.id,
                    name: flag.name,
                    description: flag.description,
                    globalConfiguration: override,
                    segmentConfigurations: flag.segmentConfigurations,
                    userOverrides: flag.userOverrides,
                    metadata: flag.metadata,
                    lastModified: flag.lastModified
                )
                updatedFlags[flagName] = flag
            }
        }

        return updatedFlags
    }
}

/// Feature flag configuration errors
public enum FeatureFlagConfigurationError: LocalizedError {
    case invalidRecord(String)
    case encodingFailed(String)
    case validationFailed([String])

    public var errorDescription: String? {
        switch self {
        case .invalidRecord(let reason):
            return "Invalid feature flag record: \(reason)"
        case .encodingFailed(let reason):
            return "Failed to encode feature flag: \(reason)"
        case .validationFailed(let errors):
            return "Feature flag validation failed: \(errors.joined(separator: ", "))"
        }
    }
}