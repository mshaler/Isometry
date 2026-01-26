import Foundation
import os.log

/// Configuration validation engine with comprehensive rule checking and rollback mechanisms
public final class ConfigurationValidation: Sendable {

    private let logger = Logger(subsystem: "com.isometry.app", category: "ConfigurationValidation")

    public init() {}

    // MARK: - Public API

    /// Validate a configuration change against current configuration and rules
    public func validateChange(
        _ change: ConfigurationChange,
        currentConfig: [String: ConfigurationItem]
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Get the configuration item (existing or create temporary for validation)
        let configItem = currentConfig[change.key] ?? createTemporaryConfigItem(change)

        // Basic validation
        let basicValidation = validateBasicConstraints(change, configItem: configItem)
        errors.append(contentsOf: basicValidation.errors)
        warnings.append(contentsOf: basicValidation.warnings)

        // Type-specific validation
        let typeValidation = validateValueType(change.newValue ?? "", type: configItem.type)
        errors.append(contentsOf: typeValidation.errors)
        warnings.append(contentsOf: typeValidation.warnings)

        // Rule-based validation
        let ruleValidation = validateAgainstRules(change.newValue ?? "", rules: configItem.validationRules)
        errors.append(contentsOf: ruleValidation.errors)
        warnings.append(contentsOf: ruleValidation.warnings)

        // Cross-configuration validation
        let crossValidation = validateCrossConfiguration(change, currentConfig: currentConfig)
        errors.append(contentsOf: crossValidation.errors)
        warnings.append(contentsOf: crossValidation.warnings)

        // Security validation
        let securityValidation = validateSecurity(change, configItem: configItem)
        errors.append(contentsOf: securityValidation.errors)
        warnings.append(contentsOf: securityValidation.warnings)

        // Environment-specific validation
        let environmentValidation = validateEnvironmentConstraints(change, configItem: configItem)
        errors.append(contentsOf: environmentValidation.errors)
        warnings.append(contentsOf: environmentValidation.warnings)

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings,
            validatedValue: change.newValue
        )
    }

    /// Validate complete configuration set for consistency
    public func validateConfigurationSet(_ configurations: [String: ConfigurationItem]) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Check for required configurations
        let requiredValidation = validateRequiredConfigurations(configurations)
        errors.append(contentsOf: requiredValidation.errors)
        warnings.append(contentsOf: requiredValidation.warnings)

        // Check for configuration dependencies
        let dependencyValidation = validateConfigurationDependencies(configurations)
        errors.append(contentsOf: dependencyValidation.errors)
        warnings.append(contentsOf: dependencyValidation.warnings)

        // Check for conflicts
        let conflictValidation = validateConfigurationConflicts(configurations)
        errors.append(contentsOf: conflictValidation.errors)
        warnings.append(contentsOf: conflictValidation.warnings)

        // Performance impact validation
        let performanceValidation = validatePerformanceImpact(configurations)
        errors.append(contentsOf: performanceValidation.errors)
        warnings.append(contentsOf: performanceValidation.warnings)

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings
        )
    }

    /// Validate rollback safety
    public func validateRollback(
        key: String,
        currentValue: String?,
        targetValue: String?,
        currentConfig: [String: ConfigurationItem]
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        guard let targetValue = targetValue else {
            errors.append("No target value provided for rollback")
            return ValidationResult(isValid: false, errors: errors, warnings: warnings)
        }

        guard let configItem = currentConfig[key] else {
            errors.append("Configuration key '\(key)' not found")
            return ValidationResult(isValid: false, errors: errors, warnings: warnings)
        }

        // Create rollback change for validation
        let rollbackChange = ConfigurationChange(
            key: key,
            oldValue: currentValue,
            newValue: targetValue,
            source: .rollback
        )

        // Validate the rollback change
        let changeValidation = validateChange(rollbackChange, currentConfig: currentConfig)
        errors.append(contentsOf: changeValidation.errors)
        warnings.append(contentsOf: changeValidation.warnings)

        // Additional rollback-specific checks
        if currentValue == targetValue {
            warnings.append("Rollback target value is the same as current value")
        }

        // Check for potential system impact
        if configItem.category == "system" || configItem.category == "security" {
            warnings.append("Rolling back system/security configuration may affect application stability")
        }

        return ValidationResult(
            isValid: errors.isEmpty,
            errors: errors,
            warnings: warnings,
            validatedValue: targetValue
        )
    }

    // MARK: - Private Validation Methods

    private func validateBasicConstraints(
        _ change: ConfigurationChange,
        configItem: ConfigurationItem
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Check if key is empty
        if change.key.isEmpty {
            errors.append("Configuration key cannot be empty")
        }

        // Check if value is provided for required configurations
        if configItem.isRequired && (change.newValue == nil || change.newValue?.isEmpty == true) {
            errors.append("Required configuration '\(change.key)' cannot be empty")
        }

        // Check key format
        if !isValidKeyFormat(change.key) {
            errors.append("Configuration key '\(change.key)' contains invalid characters")
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateValueType(_ value: String, type: ConfigurationType) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        switch type {
        case .string:
            // String values are always valid
            break

        case .boolean:
            if !["true", "false", "1", "0", "yes", "no", "on", "off"].contains(value.lowercased()) {
                errors.append("Boolean value must be true, false, 1, 0, yes, no, on, or off")
            }

        case .integer:
            if Int(value) == nil {
                errors.append("Integer value is not a valid number")
            }

        case .double:
            if Double(value) == nil {
                errors.append("Double value is not a valid number")
            }

        case .json:
            if let data = value.data(using: .utf8) {
                do {
                    _ = try JSONSerialization.jsonObject(with: data)
                } catch {
                    errors.append("JSON value is not valid JSON: \(error.localizedDescription)")
                }
            } else {
                errors.append("JSON value cannot be converted to data")
            }

        case .url:
            if URL(string: value) == nil {
                errors.append("URL value is not a valid URL")
            }

        case .email:
            if !isValidEmail(value) {
                errors.append("Email value is not a valid email address")
            }

        case .array:
            // Try to parse as JSON array
            if let data = value.data(using: .utf8) {
                do {
                    let json = try JSONSerialization.jsonObject(with: data)
                    if !(json is [Any]) {
                        errors.append("Array value is not a valid JSON array")
                    }
                } catch {
                    errors.append("Array value is not valid JSON: \(error.localizedDescription)")
                }
            } else {
                errors.append("Array value cannot be converted to data")
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateAgainstRules(_ value: String, rules: [ValidationRule]) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        for rule in rules {
            let ruleResult = validateRule(value, rule: rule)
            errors.append(contentsOf: ruleResult.errors)
            warnings.append(contentsOf: ruleResult.warnings)
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateRule(_ value: String, rule: ValidationRule) -> ValidationResult {
        var errors: [String] = []

        switch rule.type {
        case .required:
            if value.isEmpty {
                errors.append(rule.message)
            }

        case .minLength:
            if let minLength = Int(rule.parameter ?? "0"), value.count < minLength {
                errors.append(rule.message)
            }

        case .maxLength:
            if let maxLength = Int(rule.parameter ?? "0"), value.count > maxLength {
                errors.append(rule.message)
            }

        case .pattern:
            if let pattern = rule.parameter {
                do {
                    let regex = try NSRegularExpression(pattern: pattern)
                    let range = NSRange(location: 0, length: value.utf16.count)
                    if regex.firstMatch(in: value, options: [], range: range) == nil {
                        errors.append(rule.message)
                    }
                } catch {
                    errors.append("Invalid regex pattern in validation rule")
                }
            }

        case .range:
            if let rangeParam = rule.parameter {
                let components = rangeParam.split(separator: "-")
                if components.count == 2,
                   let min = Double(components[0]),
                   let max = Double(components[1]),
                   let numericValue = Double(value) {
                    if numericValue < min || numericValue > max {
                        errors.append(rule.message)
                    }
                }
            }

        case .url:
            if URL(string: value) == nil {
                errors.append(rule.message)
            }

        case .email:
            if !isValidEmail(value) {
                errors.append(rule.message)
            }

        case .json:
            if let data = value.data(using: .utf8) {
                do {
                    _ = try JSONSerialization.jsonObject(with: data)
                } catch {
                    errors.append(rule.message)
                }
            } else {
                errors.append(rule.message)
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: [])
    }

    private func validateCrossConfiguration(
        _ change: ConfigurationChange,
        currentConfig: [String: ConfigurationItem]
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Validate specific cross-configuration constraints
        switch change.key {
        case "api_timeout":
            if let timeoutValue = Double(change.newValue ?? ""),
               let cacheTimeout = currentConfig["cache_timeout"],
               let cacheTimeoutValue = Double(cacheTimeout.value) {
                if timeoutValue < cacheTimeoutValue {
                    warnings.append("API timeout should typically be longer than cache timeout")
                }
            }

        case "max_concurrent_requests":
            if let maxRequests = Int(change.newValue ?? ""),
               maxRequests > 100 {
                warnings.append("Very high concurrent request limit may impact performance")
            }

        case "debug_logging":
            if change.newValue == "true",
               let environment = currentConfig["environment_mode"],
               environment.value == "production" {
                warnings.append("Debug logging is enabled in production environment")
            }

        default:
            break
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateSecurity(
        _ change: ConfigurationChange,
        configItem: ConfigurationItem
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Check for sensitive configuration categories
        if configItem.category == "security" {
            warnings.append("Modifying security configuration requires extra caution")
        }

        // Check for potential security risks
        if change.key.contains("password") || change.key.contains("secret") || change.key.contains("key") {
            if let value = change.newValue, value.count < 8 {
                warnings.append("Security credential appears to be too short")
            }
        }

        // Check for insecure values
        if change.key.contains("url") || change.key.contains("endpoint") {
            if let value = change.newValue, value.hasPrefix("http://") {
                warnings.append("Using HTTP instead of HTTPS may be insecure")
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateEnvironmentConstraints(
        _ change: ConfigurationChange,
        configItem: ConfigurationItem
    ) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Environment-specific validation
        if let environment = change.environment {
            switch environment {
            case ConfigurationEnvironment.production.rawValue:
                // Production-specific constraints
                if change.key == "debug_logging" && change.newValue == "true" {
                    warnings.append("Debug logging should typically be disabled in production")
                }
                if change.key == "mock_data_enabled" && change.newValue == "true" {
                    errors.append("Mock data cannot be enabled in production")
                }

            case ConfigurationEnvironment.development.rawValue:
                // Development-specific constraints (generally more permissive)
                break

            case ConfigurationEnvironment.staging.rawValue:
                // Staging-specific constraints
                if change.key == "analytics_enabled" && change.newValue == "false" {
                    warnings.append("Analytics should typically be enabled in staging for testing")
                }

            default:
                warnings.append("Unknown environment: \(environment)")
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateRequiredConfigurations(_ configurations: [String: ConfigurationItem]) -> ValidationResult {
        var errors: [String] = []

        let requiredKeys = configurations.values.filter { $0.isRequired }.map { $0.key }

        for key in requiredKeys {
            if let config = configurations[key] {
                if config.value.isEmpty {
                    errors.append("Required configuration '\(key)' is empty")
                }
            } else {
                errors.append("Required configuration '\(key)' is missing")
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: [])
    }

    private func validateConfigurationDependencies(_ configurations: [String: ConfigurationItem]) -> ValidationResult {
        var errors: [String] = []
        var warnings: [String] = []

        // Define configuration dependencies
        let dependencies: [String: [String]] = [
            "cloudkit_enabled": ["icloud_account_required"],
            "push_notifications": ["notification_permission"],
            "background_sync": ["background_app_refresh"]
        ]

        for (configKey, dependentKeys) in dependencies {
            if let config = configurations[configKey],
               config.value == "true" {
                for dependentKey in dependentKeys {
                    if let dependentConfig = configurations[dependentKey] {
                        if dependentConfig.value == "false" {
                            warnings.append("Configuration '\(configKey)' is enabled but dependency '\(dependentKey)' is disabled")
                        }
                    } else {
                        errors.append("Configuration '\(configKey)' requires '\(dependentKey)' to be configured")
                    }
                }
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: warnings)
    }

    private func validateConfigurationConflicts(_ configurations: [String: ConfigurationItem]) -> ValidationResult {
        var errors: [String] = []

        // Define configuration conflicts
        let conflicts: [(String, String, String)] = [
            ("mock_data_enabled", "true", "production_mode"),
            ("debug_logging", "true", "performance_optimized")
        ]

        for (configKey1, value1, configKey2) in conflicts {
            if let config1 = configurations[configKey1],
               let config2 = configurations[configKey2],
               config1.value == value1 && config2.value == "true" {
                errors.append("Configuration conflict: '\(configKey1)' cannot be '\(value1)' when '\(configKey2)' is enabled")
            }
        }

        return ValidationResult(isValid: errors.isEmpty, errors: errors, warnings: [])
    }

    private func validatePerformanceImpact(_ configurations: [String: ConfigurationItem]) -> ValidationResult {
        var warnings: [String] = []

        // Check for performance-impacting configurations
        if let debugLogging = configurations["debug_logging"],
           debugLogging.value == "true" {
            warnings.append("Debug logging may impact application performance")
        }

        if let cacheSize = configurations["cache_size_limit"],
           let size = Int(cacheSize.value),
           size > 500 {
            warnings.append("Large cache size (\(size)MB) may impact memory usage")
        }

        if let syncInterval = configurations["sync_interval"],
           let interval = Double(syncInterval.value),
           interval < 30 {
            warnings.append("Frequent sync interval (\(interval)s) may impact battery life")
        }

        return ValidationResult(isValid: true, errors: [], warnings: warnings)
    }

    // MARK: - Helper Methods

    private func createTemporaryConfigItem(_ change: ConfigurationChange) -> ConfigurationItem {
        return ConfigurationItem(
            key: change.key,
            value: change.newValue ?? "",
            type: inferConfigurationType(change.newValue ?? ""),
            category: "uncategorized",
            description: "Dynamically created configuration"
        )
    }

    private func inferConfigurationType(_ value: String) -> ConfigurationType {
        if value.isEmpty {
            return .string
        }

        if ["true", "false"].contains(value.lowercased()) {
            return .boolean
        }

        if Int(value) != nil {
            return .integer
        }

        if Double(value) != nil {
            return .double
        }

        if URL(string: value) != nil {
            return .url
        }

        if isValidEmail(value) {
            return .email
        }

        if let data = value.data(using: .utf8),
           (try? JSONSerialization.jsonObject(with: data)) != nil {
            return .json
        }

        return .string
    }

    private func isValidKeyFormat(_ key: String) -> Bool {
        let pattern = "^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$"
        return key.range(of: pattern, options: .regularExpression) != nil
    }

    private func isValidEmail(_ email: String) -> Bool {
        let emailPattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailPattern)
        return emailPredicate.evaluate(with: email)
    }
}

// MARK: - Supporting Types

/// Configuration validation result
public struct ValidationResult: Sendable {
    public let isValid: Bool
    public let errors: [String]
    public let warnings: [String]
    public let validatedValue: String?

    public init(
        isValid: Bool,
        errors: [String],
        warnings: [String],
        validatedValue: String? = nil
    ) {
        self.isValid = isValid
        self.errors = errors
        self.warnings = warnings
        self.validatedValue = validatedValue
    }

    public var hasWarnings: Bool { !warnings.isEmpty }
    public var hasErrors: Bool { !errors.isEmpty }

    public var summary: String {
        var components: [String] = []

        if hasErrors {
            components.append("Errors: \(errors.count)")
        }

        if hasWarnings {
            components.append("Warnings: \(warnings.count)")
        }

        return components.isEmpty ? "Valid" : components.joined(separator: ", ")
    }
}