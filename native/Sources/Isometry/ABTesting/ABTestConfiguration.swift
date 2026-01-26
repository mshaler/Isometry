import Foundation
import CloudKit
import os.log

/// A/B test configuration models and CloudKit integration
public struct ABTestConfigurationHelper: Sendable {

    /// CloudKit record type for A/B tests
    public static let recordType = "ABTest"

    /// Convert ABTest to CloudKit record
    public static func cloudKitRecord(from test: ABTest) throws -> CKRecord {
        let record = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: test.id))

        record["name"] = test.name
        record["status"] = test.status.rawValue
        record["createdAt"] = test.createdAt
        record["startedAt"] = test.startedAt
        record["stoppedAt"] = test.stoppedAt
        record["lastModified"] = test.lastModified

        // Encode configuration and variants as JSON data
        let encoder = JSONEncoder()
        record["configuration"] = try encoder.encode(test.configuration)
        record["variants"] = try encoder.encode(test.variants)
        record["userAssignments"] = try encoder.encode(test.userAssignments)

        return record
    }

    /// Convert CloudKit record to ABTest
    public static func abTest(from record: CKRecord) throws -> ABTest {
        guard let name = record["name"] as? String,
              let statusString = record["status"] as? String,
              let status = ExperimentStatus(rawValue: statusString),
              let createdAt = record["createdAt"] as? Date,
              let configurationData = record["configuration"] as? Data,
              let variantsData = record["variants"] as? Data else {
            throw ABTestConfigurationError.invalidRecord("Missing required fields")
        }

        let decoder = JSONDecoder()

        let configuration = try decoder.decode(ABTestConfiguration.self, from: configurationData)
        let variants = try decoder.decode([ABTestVariant].self, from: variantsData)

        let userAssignments: [String: UserAssignment]
        if let assignmentData = record["userAssignments"] as? Data {
            userAssignments = try decoder.decode([String: UserAssignment].self, from: assignmentData)
        } else {
            userAssignments = [:]
        }

        return ABTest(
            id: record.recordID.recordName,
            name: name,
            configuration: configuration,
            status: status,
            createdAt: createdAt,
            startedAt: record["startedAt"] as? Date,
            stoppedAt: record["stoppedAt"] as? Date,
            lastModified: record["lastModified"] as? Date ?? createdAt,
            variants: variants,
            userAssignments: userAssignments
        )
    }
}

/// Default A/B test configurations for common experiment types
public struct DefaultABTestConfigurations {

    /// Conversion rate optimization experiment
    public static func conversionRateExperiment(
        name: String,
        controlDescription: String,
        testDescription: String,
        featureFlag: String? = nil
    ) -> ABTestConfiguration {
        let variants = [
            ABTestVariant(
                id: "control",
                name: "Control",
                description: controlDescription,
                weight: 0.5,
                isControl: true
            ),
            ABTestVariant(
                id: "test",
                name: "Test",
                description: testDescription,
                weight: 0.5,
                isControl: false
            )
        ]

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: name,
            description: "Conversion rate optimization experiment",
            variants: variants,
            primaryMetric: "conversion_rate",
            expectedDuration: 14 * 24 * 60 * 60, // 14 days
            expectedSampleSize: 1000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true,
            autoStopOnSignificance: false,
            linkedFeatureFlag: featureFlag
        )
    }

    /// User engagement experiment
    public static func engagementExperiment(
        name: String,
        variants: [ABTestVariant],
        duration: TimeInterval = 21 * 24 * 60 * 60 // 21 days
    ) -> ABTestConfiguration {
        return ABTestConfiguration(
            id: UUID().uuidString,
            name: name,
            description: "User engagement optimization experiment",
            variants: variants,
            primaryMetric: "average_session_duration",
            secondaryMetrics: ["page_views", "click_through_rate"],
            expectedDuration: duration,
            expectedSampleSize: 2000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true,
            autoStopOnSignificance: false
        )
    }

    /// Feature adoption experiment
    public static func featureAdoptionExperiment(
        name: String,
        featureFlag: String,
        rolloutPercentages: [Double] = [0.0, 0.25, 0.5, 1.0]
    ) -> ABTestConfiguration {
        let variants = rolloutPercentages.enumerated().map { index, percentage in
            ABTestVariant(
                id: "rollout_\(Int(percentage * 100))",
                name: "\(Int(percentage * 100))% Rollout",
                description: "Feature enabled for \(Int(percentage * 100))% of users",
                weight: 1.0 / Double(rolloutPercentages.count),
                isControl: index == 0,
                configuration: ["feature_enabled": percentage > 0 ? "true" : "false"]
            )
        }

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: name,
            description: "Feature adoption rate experiment",
            variants: variants,
            primaryMetric: "feature_adoption_rate",
            secondaryMetrics: ["user_retention", "feature_usage_frequency"],
            expectedDuration: 28 * 24 * 60 * 60, // 28 days
            expectedSampleSize: 5000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true,
            autoStopOnSignificance: false,
            linkedFeatureFlag: featureFlag
        )
    }

    /// UI/UX design experiment
    public static func uiDesignExperiment(
        name: String,
        designVariants: [(name: String, description: String)]
    ) -> ABTestConfiguration {
        let weight = 1.0 / Double(designVariants.count)
        let variants = designVariants.enumerated().map { index, design in
            ABTestVariant(
                id: "design_\(index + 1)",
                name: design.name,
                description: design.description,
                weight: weight,
                isControl: index == 0
            )
        }

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: name,
            description: "UI/UX design comparison experiment",
            variants: variants,
            primaryMetric: "user_satisfaction",
            secondaryMetrics: ["task_completion_rate", "time_on_page", "bounce_rate"],
            expectedDuration: 10 * 24 * 60 * 60, // 10 days
            expectedSampleSize: 1500,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true,
            autoStopOnSignificance: false
        )
    }
}

/// A/B test configuration validation utilities
public struct ABTestValidator {

    /// Validate complete A/B test configuration
    public static func validate(_ configuration: ABTestConfiguration) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Validate basic properties
        if configuration.name.isEmpty {
            errors.append("Experiment name cannot be empty")
        }

        if configuration.description.isEmpty {
            warnings.append("Experiment description is empty")
        }

        if configuration.primaryMetric.isEmpty {
            errors.append("Primary metric must be specified")
        }

        // Validate variants
        let variantValidation = validateVariants(configuration.variants)
        errors.append(contentsOf: variantValidation.errors)
        warnings.append(contentsOf: variantValidation.warnings)

        // Validate statistical parameters
        if configuration.significanceLevel <= 0 || configuration.significanceLevel >= 1 {
            errors.append("Significance level must be between 0 and 1")
        }

        if configuration.statisticalPower <= 0 || configuration.statisticalPower >= 1 {
            errors.append("Statistical power must be between 0 and 1")
        }

        if configuration.expectedSampleSize < 100 {
            warnings.append("Expected sample size is very low (< 100)")
        }

        if configuration.expectedDuration < 24 * 60 * 60 { // 1 day
            warnings.append("Expected duration is very short (< 1 day)")
        }

        // Validate criteria
        for criteria in configuration.inclusionCriteria {
            if criteria.property.isEmpty || criteria.value.isEmpty {
                errors.append("Inclusion criteria property and value cannot be empty")
            }
        }

        for criteria in configuration.exclusionCriteria {
            if criteria.property.isEmpty || criteria.value.isEmpty {
                errors.append("Exclusion criteria property and value cannot be empty")
            }
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    /// Validate experiment variants
    public static func validateVariants(_ variants: [ABTestVariant]) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        guard variants.count >= 2 else {
            errors.append("Experiment must have at least 2 variants")
            return ValidationResult(isValid: false, errors: errors, warnings: warnings)
        }

        let controlCount = variants.filter { $0.isControl }.count
        if controlCount == 0 {
            errors.append("Experiment must have exactly one control variant")
        } else if controlCount > 1 {
            errors.append("Experiment cannot have multiple control variants")
        }

        // Check for duplicate IDs
        let uniqueIds = Set(variants.map { $0.id })
        if uniqueIds.count != variants.count {
            errors.append("Variant IDs must be unique")
        }

        // Check for empty names
        for variant in variants {
            if variant.name.isEmpty {
                errors.append("Variant name cannot be empty")
            }
            if variant.description.isEmpty {
                warnings.append("Variant '\(variant.name)' has empty description")
            }
        }

        // Validate weights
        let totalWeight = variants.reduce(0) { $0 + $1.weight }
        if abs(totalWeight - 1.0) > 0.001 {
            errors.append("Variant weights must sum to 1.0 (currently: \(String(format: "%.3f", totalWeight)))")
        }

        for variant in variants {
            if variant.weight <= 0 {
                errors.append("Variant '\(variant.name)' weight must be positive")
            }
        }

        // Check for uneven distribution (warning only)
        let expectedWeight = 1.0 / Double(variants.count)
        let maxDeviation = variants.map { abs($0.weight - expectedWeight) }.max() ?? 0
        if maxDeviation > 0.1 {
            warnings.append("Variant weights are significantly uneven")
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    /// Validate statistical power configuration
    public static func validateStatisticalPower(
        baselineRate: Double,
        minimumDetectableEffect: Double,
        sampleSize: Int,
        significanceLevel: Double,
        statisticalPower: Double
    ) -> StatisticalValidationResult {
        var warnings: [String] = []
        var recommendations: [String] = []

        // Calculate actual power with given parameters
        let calculator = ABTestStatistics()
        let actualPower = calculator.calculateStatisticalPower(
            controlConversionRate: baselineRate,
            testConversionRate: baselineRate + minimumDetectableEffect,
            sampleSizePerGroup: sampleSize / 2, // Assuming equal split
            significanceLevel: significanceLevel
        )

        if actualPower < statisticalPower {
            warnings.append("Current sample size (\(sampleSize)) provides power of \(String(format: "%.1f", actualPower * 100))%, below target \(String(format: "%.1f", statisticalPower * 100))%")

            let requiredSampleSize = calculator.calculateRequiredSampleSize(
                baselineConversionRate: baselineRate,
                minimumDetectableEffect: minimumDetectableEffect,
                significanceLevel: significanceLevel,
                statisticalPower: statisticalPower
            )

            recommendations.append("Increase sample size to \(requiredSampleSize * 2) total participants (\(requiredSampleSize) per variant)")
        }

        if minimumDetectableEffect < 0.01 {
            warnings.append("Very small minimum detectable effect (\(String(format: "%.1f", minimumDetectableEffect * 100))%) will require large sample sizes")
        }

        if significanceLevel > 0.05 {
            warnings.append("High significance level (\(String(format: "%.1f", significanceLevel * 100))%) increases risk of false positives")
        }

        return StatisticalValidationResult(
            actualPower: actualPower,
            meetsRequirements: actualPower >= statisticalPower,
            warnings: warnings,
            recommendations: recommendations
        )
    }

    public struct ValidationResult {
        public let isValid: Bool
        public let errors: [String]
        public let warnings: [String]

        public var hasWarnings: Bool { !warnings.isEmpty }
    }

    public struct StatisticalValidationResult {
        public let actualPower: Double
        public let meetsRequirements: Bool
        public let warnings: [String]
        public let recommendations: [String]
    }
}

/// A/B test experiment templates for quick setup
public struct ExperimentTemplates {

    /// Landing page optimization template
    public static func landingPageOptimization() -> ABTestConfiguration {
        return DefaultABTestConfigurations.conversionRateExperiment(
            name: "Landing Page CTA Optimization",
            controlDescription: "Current blue CTA button",
            testDescription: "New orange CTA button with updated copy"
        )
    }

    /// Email campaign optimization template
    public static func emailCampaignOptimization() -> ABTestConfiguration {
        let variants = [
            ABTestVariant(
                id: "subject_a",
                name: "Short Subject",
                description: "Concise subject line",
                weight: 0.33,
                isControl: true
            ),
            ABTestVariant(
                id: "subject_b",
                name: "Descriptive Subject",
                description: "Detailed subject line",
                weight: 0.33,
                isControl: false
            ),
            ABTestVariant(
                id: "subject_c",
                name: "Question Subject",
                description: "Question-based subject line",
                weight: 0.34,
                isControl: false
            )
        ]

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: "Email Subject Line Optimization",
            description: "Testing different email subject line strategies",
            variants: variants,
            primaryMetric: "open_rate",
            secondaryMetrics: ["click_through_rate", "conversion_rate"],
            expectedDuration: 7 * 24 * 60 * 60, // 7 days
            expectedSampleSize: 10000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true
        )
    }

    /// Pricing strategy experiment template
    public static func pricingStrategy() -> ABTestConfiguration {
        let variants = [
            ABTestVariant(
                id: "price_current",
                name: "Current Price",
                description: "Existing pricing structure",
                weight: 0.25,
                isControl: true,
                configuration: ["price_tier": "current"]
            ),
            ABTestVariant(
                id: "price_low",
                name: "Lower Price",
                description: "15% price reduction",
                weight: 0.25,
                isControl: false,
                configuration: ["price_tier": "low"]
            ),
            ABTestVariant(
                id: "price_high",
                name: "Higher Price",
                description: "10% price increase",
                weight: 0.25,
                isControl: false,
                configuration: ["price_tier": "high"]
            ),
            ABTestVariant(
                id: "price_bundle",
                name: "Bundle Option",
                description: "Value bundle pricing",
                weight: 0.25,
                isControl: false,
                configuration: ["price_tier": "bundle"]
            )
        ]

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: "Pricing Strategy Test",
            description: "Testing different pricing approaches for conversion optimization",
            variants: variants,
            primaryMetric: "conversion_rate",
            secondaryMetrics: ["revenue_per_user", "cart_abandonment_rate"],
            expectedDuration: 21 * 24 * 60 * 60, // 21 days
            expectedSampleSize: 3000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true
        )
    }

    /// Onboarding flow optimization template
    public static func onboardingFlowOptimization() -> ABTestConfiguration {
        let variants = [
            ABTestVariant(
                id: "onboarding_current",
                name: "Current Flow",
                description: "5-step onboarding process",
                weight: 0.5,
                isControl: true
            ),
            ABTestVariant(
                id: "onboarding_simplified",
                name: "Simplified Flow",
                description: "3-step streamlined onboarding",
                weight: 0.5,
                isControl: false
            )
        ]

        return ABTestConfiguration(
            id: UUID().uuidString,
            name: "Onboarding Flow Optimization",
            description: "Testing simplified onboarding flow for better completion rates",
            variants: variants,
            primaryMetric: "onboarding_completion_rate",
            secondaryMetrics: ["time_to_completion", "feature_adoption_rate"],
            expectedDuration: 14 * 24 * 60 * 60, // 14 days
            expectedSampleSize: 2000,
            significanceLevel: 0.05,
            statisticalPower: 0.8,
            enableStatisticalAnalysis: true
        )
    }
}

/// A/B test configuration errors
public enum ABTestConfigurationError: LocalizedError {
    case invalidRecord(String)
    case encodingFailed(String)
    case validationFailed([String])

    public var errorDescription: String? {
        switch self {
        case .invalidRecord(let reason):
            return "Invalid A/B test record: \(reason)"
        case .encodingFailed(let reason):
            return "Failed to encode A/B test: \(reason)"
        case .validationFailed(let errors):
            return "A/B test validation failed: \(errors.joined(separator: ", "))"
        }
    }
}