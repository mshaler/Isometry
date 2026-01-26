import Foundation
import Combine
import CloudKit
import os.log

/// Robust configuration management with environment-aware settings and runtime hot-reload
@MainActor
public final class ConfigurationManager: ObservableObject, Sendable {

    // MARK: - Published Properties

    @Published public private(set) var configurations: [String: ConfigurationItem] = [:]
    @Published public private(set) var environment: ConfigurationEnvironment = .production
    @Published public private(set) var isLoading: Bool = false
    @Published public private(set) var lastSyncDate: Date?
    @Published public private(set) var pendingChanges: [ConfigurationChange] = []

    // MARK: - Private Properties

    private let cloudKitManager: CloudKitSyncManager
    private let validation: ConfigurationValidation
    private let audit: ConfigurationAudit
    private let cache: ConfigurationCache
    private let logger = Logger(subsystem: "com.isometry.app", category: "Configuration")
    private var subscriptions = Set<AnyCancellable>()
    private var validationSubscriptions = Set<AnyCancellable>()
    private var hotReloadTimer: Timer?

    // MARK: - Initialization

    public init(
        cloudKitManager: CloudKitSyncManager,
        validation: ConfigurationValidation = ConfigurationValidation(),
        audit: ConfigurationAudit = ConfigurationAudit()
    ) {
        self.cloudKitManager = cloudKitManager
        self.validation = validation
        self.audit = audit
        self.cache = ConfigurationCache()

        detectEnvironment()
        setupCloudKitSync()
        loadCachedConfigurations()
        setupHotReload()
    }

    deinit {
        hotReloadTimer?.invalidate()
    }

    // MARK: - Public API

    /// Get configuration value with type safety and environment awareness
    public func getValue<T: Codable>(_ key: String, type: T.Type, defaultValue: T? = nil) -> T? {
        let startTime = CFAbsoluteTimeGetCurrent()
        defer {
            let retrievalTime = CFAbsoluteTimeGetCurrent() - startTime
            logger.debug("Configuration retrieval for '\\(key)' took \\(String(format: "%.3f", retrievalTime * 1000))ms")
        }

        guard let item = configurations[key] else {
            if let defaultValue = defaultValue {
                logger.info("Configuration key '\\(key)' not found, using default value")
                return defaultValue
            }
            logger.warning("Configuration key '\\(key)' not found and no default provided")
            return nil
        }

        // Check environment-specific override
        if let envValue = item.environmentValues[environment.rawValue] {
            return parseValue(envValue, type: type, key: key)
        }

        // Use global value
        return parseValue(item.value, type: type, key: key)
    }

    /// Set configuration value with validation and audit trail
    public func setValue<T: Codable>(_ key: String, value: T, environment: ConfigurationEnvironment? = nil) async throws {
        let serializedValue = try serializeValue(value)

        // Validate the change
        let change = ConfigurationChange(
            key: key,
            oldValue: configurations[key]?.value,
            newValue: serializedValue,
            environment: environment?.rawValue,
            timestamp: Date(),
            source: .user
        )

        let validationResult = validation.validateChange(change, currentConfig: configurations)
        guard validationResult.isValid else {
            throw ConfigurationError.validationFailed(validationResult.errors.joined(separator: ", "))
        }

        // Apply the change
        try await applyConfigurationChange(change)

        logger.info("Configuration '\\(key)' updated successfully")
    }

    /// Bulk update multiple configuration values
    public func setBulkValues(_ updates: [String: Any], environment: ConfigurationEnvironment? = nil) async throws {
        var changes: [ConfigurationChange] = []

        // Prepare all changes first
        for (key, value) in updates {
            let serializedValue = try serializeValue(value)
            let change = ConfigurationChange(
                key: key,
                oldValue: configurations[key]?.value,
                newValue: serializedValue,
                environment: environment?.rawValue,
                timestamp: Date(),
                source: .bulk
            )
            changes.append(change)
        }

        // Validate all changes
        for change in changes {
            let validationResult = validation.validateChange(change, currentConfig: configurations)
            guard validationResult.isValid else {
                throw ConfigurationError.validationFailed("Validation failed for key '\\(change.key)': \\(validationResult.errors.joined(separator: ", "))")
            }
        }

        // Apply all changes atomically
        try await applyConfigurationChanges(changes)

        logger.info("Bulk configuration update completed for \\(changes.count) keys")
    }

    /// Hot reload configurations from CloudKit without restart
    public func hotReload() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let cloudConfigs = try await cloudKitManager.fetchConfigurations()
            let previousConfigs = configurations

            await updateConfigurations(cloudConfigs)

            // Detect and log changes
            let changedKeys = detectConfigurationChanges(old: previousConfigs, new: configurations)
            if !changedKeys.isEmpty {
                logger.info("Hot reload completed - \\(changedKeys.count) configuration keys updated: \\(changedKeys.joined(separator: ", "))")

                // Audit the hot reload
                for key in changedKeys {
                    let change = ConfigurationChange(
                        key: key,
                        oldValue: previousConfigs[key]?.value,
                        newValue: configurations[key]?.value,
                        timestamp: Date(),
                        source: .hotReload
                    )
                    audit.recordChange(change)
                }
            }

            lastSyncDate = Date()
        } catch {
            logger.error("Hot reload failed: \\(error)")
            throw ConfigurationError.hotReloadFailed(error)
        }
    }

    /// Get configuration item with metadata
    public func getConfigurationItem(_ key: String) -> ConfigurationItem? {
        return configurations[key]
    }

    /// Get all configurations for debugging/admin interface
    public func getAllConfigurations() -> [String: ConfigurationItem] {
        return configurations
    }

    /// Get configurations filtered by category
    public func getConfigurationsByCategory(_ category: String) -> [String: ConfigurationItem] {
        return configurations.filter { $0.value.category == category }
    }

    /// Rollback configuration to previous value
    public func rollback(_ key: String) async throws {
        guard let item = configurations[key] else {
            throw ConfigurationError.keyNotFound(key)
        }

        let auditHistory = audit.getAuditHistory(for: key)
        guard let previousChange = auditHistory.last(where: { $0.key == key }) else {
            throw ConfigurationError.noPreviousValue(key)
        }

        guard let previousValue = previousChange.oldValue else {
            throw ConfigurationError.noPreviousValue(key)
        }

        let rollbackChange = ConfigurationChange(
            key: key,
            oldValue: item.value,
            newValue: previousValue,
            timestamp: Date(),
            source: .rollback
        )

        try await applyConfigurationChange(rollbackChange)
        logger.info("Configuration '\\(key)' rolled back successfully")
    }

    /// Export configurations for backup or migration
    public func exportConfigurations(format: ConfigurationExportFormat = .json) -> Data? {
        let exportData = ConfigurationExport(
            configurations: configurations,
            environment: environment,
            exportDate: Date(),
            version: "1.0"
        )

        switch format {
        case .json:
            return try? JSONEncoder().encode(exportData)
        case .plist:
            return try? PropertyListEncoder().encode(exportData)
        }
    }

    /// Import configurations from backup
    public func importConfigurations(from data: Data, format: ConfigurationExportFormat = .json) async throws {
        let decoder: any TopLevelDecoder
        switch format {
        case .json:
            decoder = JSONDecoder()
        case .plist:
            decoder = PropertyListDecoder()
        }

        let exportData = try decoder.decode(ConfigurationExport.self, from: data)

        // Validate all configurations before import
        for (key, item) in exportData.configurations {
            let change = ConfigurationChange(
                key: key,
                oldValue: configurations[key]?.value,
                newValue: item.value,
                timestamp: Date(),
                source: .import
            )

            let validationResult = validation.validateChange(change, currentConfig: configurations)
            guard validationResult.isValid else {
                throw ConfigurationError.validationFailed("Import validation failed for key '\\(key)': \\(validationResult.errors.joined(separator: ", "))")
            }
        }

        // Apply all configurations
        await updateConfigurations(exportData.configurations)
        logger.info("Configuration import completed - \\(exportData.configurations.count) keys imported")
    }

    // MARK: - Private Methods

    private func detectEnvironment() {
        #if DEBUG
        environment = .development
        #elseif STAGING
        environment = .staging
        #else
        environment = .production
        #endif

        logger.info("Detected environment: \\(environment.rawValue)")
    }

    private func setupCloudKitSync() {
        cloudKitManager.configurationUpdates
            .receive(on: DispatchQueue.main)
            .sink { [weak self] cloudConfigs in
                Task { @MainActor in
                    await self?.updateConfigurations(cloudConfigs)
                }
            }
            .store(in: &subscriptions)
    }

    private func loadCachedConfigurations() {
        let cachedConfigs = cache.loadConfigurations()
        self.configurations = cachedConfigs

        // Apply environment-specific defaults
        applyEnvironmentDefaults()

        logger.info("Loaded \\(cachedConfigs.count) cached configurations")
    }

    private func applyEnvironmentDefaults() {
        let defaults = DefaultConfigurations.forEnvironment(environment)

        for (key, defaultItem) in defaults {
            if configurations[key] == nil {
                configurations[key] = defaultItem
            }
        }
    }

    private func setupHotReload() {
        // Set up periodic hot reload check (configurable interval)
        let interval = getValue("config_hot_reload_interval", type: Double.self, defaultValue: 60.0) ?? 60.0

        hotReloadTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                try? await self?.hotReload()
            }
        }
    }

    private func updateConfigurations(_ cloudConfigs: [String: ConfigurationItem]) async {
        let oldConfigs = configurations
        configurations = cloudConfigs

        // Cache updated configurations
        cache.saveConfigurations(cloudConfigs)

        // Apply environment defaults for any missing keys
        applyEnvironmentDefaults()

        // Track changes for audit
        let changedKeys = detectConfigurationChanges(old: oldConfigs, new: configurations)
        for key in changedKeys {
            let change = ConfigurationChange(
                key: key,
                oldValue: oldConfigs[key]?.value,
                newValue: configurations[key]?.value,
                timestamp: Date(),
                source: .cloudSync
            )
            audit.recordChange(change)
        }

        logger.debug("Updated \\(cloudConfigs.count) configurations (\\(changedKeys.count) changed)")
    }

    private func applyConfigurationChange(_ change: ConfigurationChange) async throws {
        // Update or create configuration item
        var item = configurations[change.key] ?? ConfigurationItem(
            key: change.key,
            value: "",
            type: .string,
            category: "uncategorized",
            description: "Dynamically created configuration",
            isRequired: false,
            validationRules: []
        )

        // Update the value
        if let environment = change.environment {
            item.environmentValues[environment] = change.newValue
        } else {
            item.value = change.newValue ?? ""
        }

        item.lastModified = Date()
        configurations[change.key] = item

        // Record audit trail
        audit.recordChange(change)

        // Sync to CloudKit
        try await cloudKitManager.saveConfiguration(item)

        // Cache locally
        cache.saveConfigurations(configurations)

        logger.debug("Applied configuration change for key '\\(change.key)'")
    }

    private func applyConfigurationChanges(_ changes: [ConfigurationChange]) async throws {
        for change in changes {
            try await applyConfigurationChange(change)
        }
    }

    private func detectConfigurationChanges(old: [String: ConfigurationItem], new: [String: ConfigurationItem]) -> [String] {
        var changedKeys: [String] = []

        // Check for modified values
        for (key, newItem) in new {
            if let oldItem = old[key] {
                if oldItem.value != newItem.value || oldItem.environmentValues != newItem.environmentValues {
                    changedKeys.append(key)
                }
            } else {
                changedKeys.append(key) // New key
            }
        }

        // Check for removed keys
        for (key, _) in old {
            if new[key] == nil {
                changedKeys.append(key)
            }
        }

        return changedKeys
    }

    private func parseValue<T: Codable>(_ value: String, type: T.Type, key: String) -> T? {
        // Handle basic types directly
        if type == String.self {
            return value as? T
        } else if type == Bool.self {
            return Bool(value) as? T
        } else if type == Int.self {
            return Int(value) as? T
        } else if type == Double.self {
            return Double(value) as? T
        }

        // Handle complex types via JSON
        guard let data = value.data(using: .utf8) else {
            logger.error("Failed to convert configuration value to data for key '\\(key)'")
            return nil
        }

        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            logger.error("Failed to decode configuration value for key '\\(key)': \\(error)")
            return nil
        }
    }

    private func serializeValue<T: Codable>(_ value: T) throws -> String {
        // Handle basic types directly
        if let stringValue = value as? String {
            return stringValue
        } else if let boolValue = value as? Bool {
            return String(boolValue)
        } else if let intValue = value as? Int {
            return String(intValue)
        } else if let doubleValue = value as? Double {
            return String(doubleValue)
        }

        // Handle complex types via JSON
        let data = try JSONEncoder().encode(value)
        guard let string = String(data: data, encoding: .utf8) else {
            throw ConfigurationError.serializationFailed("Unable to convert data to string")
        }
        return string
    }
}

// MARK: - Supporting Types

/// Configuration item with metadata and environment-specific values
public struct ConfigurationItem: Codable, Sendable, Identifiable {
    public let id: String
    public let key: String
    public var value: String
    public let type: ConfigurationType
    public let category: String
    public let description: String
    public let isRequired: Bool
    public let validationRules: [ValidationRule]
    public var environmentValues: [String: String] = [:]
    public var lastModified: Date = Date()

    public init(
        key: String,
        value: String,
        type: ConfigurationType,
        category: String,
        description: String,
        isRequired: Bool = false,
        validationRules: [ValidationRule] = [],
        environmentValues: [String: String] = [:]
    ) {
        self.id = key
        self.key = key
        self.value = value
        self.type = type
        self.category = category
        self.description = description
        self.isRequired = isRequired
        self.validationRules = validationRules
        self.environmentValues = environmentValues
    }
}

/// Configuration data types
public enum ConfigurationType: String, Codable, Sendable, CaseIterable {
    case string
    case boolean
    case integer
    case double
    case json
    case url
    case email
    case array
}

/// Configuration environments
public enum ConfigurationEnvironment: String, Codable, Sendable, CaseIterable {
    case development
    case staging
    case production

    var isProduction: Bool {
        return self == .production
    }
}

/// Configuration change tracking
public struct ConfigurationChange: Codable, Sendable, Identifiable {
    public let id: UUID
    public let key: String
    public let oldValue: String?
    public let newValue: String?
    public let environment: String?
    public let timestamp: Date
    public let source: ChangeSource

    public init(
        key: String,
        oldValue: String?,
        newValue: String?,
        environment: String? = nil,
        timestamp: Date = Date(),
        source: ChangeSource
    ) {
        self.id = UUID()
        self.key = key
        self.oldValue = oldValue
        self.newValue = newValue
        self.environment = environment
        self.timestamp = timestamp
        self.source = source
    }
}

/// Configuration change sources
public enum ChangeSource: String, Codable, Sendable {
    case user
    case bulk
    case hotReload
    case cloudSync
    case rollback
    case `import`
    case system
}

/// Validation rules for configuration values
public struct ValidationRule: Codable, Sendable {
    public let type: ValidationType
    public let parameter: String?
    public let message: String

    public enum ValidationType: String, Codable, Sendable {
        case required
        case minLength
        case maxLength
        case pattern
        case range
        case url
        case email
        case json
    }
}

/// Configuration export data
public struct ConfigurationExport: Codable, Sendable {
    public let configurations: [String: ConfigurationItem]
    public let environment: ConfigurationEnvironment
    public let exportDate: Date
    public let version: String
}

/// Export format options
public enum ConfigurationExportFormat {
    case json
    case plist
}

/// Configuration errors
public enum ConfigurationError: LocalizedError {
    case keyNotFound(String)
    case validationFailed(String)
    case serializationFailed(String)
    case hotReloadFailed(Error)
    case noPreviousValue(String)
    case syncFailed(Error)

    public var errorDescription: String? {
        switch self {
        case .keyNotFound(let key):
            return "Configuration key not found: \(key)"
        case .validationFailed(let reason):
            return "Configuration validation failed: \(reason)"
        case .serializationFailed(let reason):
            return "Configuration serialization failed: \(reason)"
        case .hotReloadFailed(let error):
            return "Configuration hot reload failed: \(error.localizedDescription)"
        case .noPreviousValue(let key):
            return "No previous value found for configuration key: \(key)"
        case .syncFailed(let error):
            return "Configuration sync failed: \(error.localizedDescription)"
        }
    }
}

// MARK: - Local Caching

private final class ConfigurationCache {
    private let cacheURL: URL
    private let logger = Logger(subsystem: "com.isometry.app", category: "ConfigurationCache")

    init() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.cacheURL = documentsPath.appendingPathComponent("configuration_cache.json")
    }

    func loadConfigurations() -> [String: ConfigurationItem] {
        do {
            let data = try Data(contentsOf: cacheURL)
            let configs = try JSONDecoder().decode([String: ConfigurationItem].self, from: data)
            return configs
        } catch {
            logger.info("No cached configurations found or failed to load: \\(error)")
            return [:]
        }
    }

    func saveConfigurations(_ configs: [String: ConfigurationItem]) {
        do {
            let data = try JSONEncoder().encode(configs)
            try data.write(to: cacheURL)
        } catch {
            logger.error("Failed to cache configurations: \\(error)")
        }
    }
}

/// Default configurations for different environments
public struct DefaultConfigurations {

    /// Get environment-specific default configurations
    public static func forEnvironment(_ environment: ConfigurationEnvironment) -> [String: ConfigurationItem] {
        var defaults = globalDefaults

        switch environment {
        case .development:
            defaults.merge(developmentDefaults) { _, new in new }
        case .staging:
            defaults.merge(stagingDefaults) { _, new in new }
        case .production:
            defaults.merge(productionDefaults) { _, new in new }
        }

        return defaults
    }

    /// Global default configurations
    private static let globalDefaults: [String: ConfigurationItem] = [
        "api_timeout": ConfigurationItem(
            key: "api_timeout",
            value: "30.0",
            type: .double,
            category: "network",
            description: "API request timeout in seconds",
            isRequired: true,
            validationRules: [
                ValidationRule(type: .range, parameter: "1.0-300.0", message: "Timeout must be between 1 and 300 seconds")
            ]
        ),

        "cache_size_limit": ConfigurationItem(
            key: "cache_size_limit",
            value: "100",
            type: .integer,
            category: "performance",
            description: "Maximum cache size in MB",
            isRequired: true,
            validationRules: [
                ValidationRule(type: .range, parameter: "10-1000", message: "Cache size must be between 10 and 1000 MB")
            ]
        ),

        "analytics_enabled": ConfigurationItem(
            key: "analytics_enabled",
            value: "true",
            type: .boolean,
            category: "privacy",
            description: "Enable analytics collection",
            isRequired: true
        ),

        "feature_flags_sync_interval": ConfigurationItem(
            key: "feature_flags_sync_interval",
            value: "300.0",
            type: .double,
            category: "feature_flags",
            description: "Feature flags sync interval in seconds",
            validationRules: [
                ValidationRule(type: .range, parameter: "60.0-3600.0", message: "Sync interval must be between 1 minute and 1 hour")
            ]
        )
    ]

    /// Development environment defaults
    private static let developmentDefaults: [String: ConfigurationItem] = [
        "api_base_url": ConfigurationItem(
            key: "api_base_url",
            value: "https://api-dev.isometry.app",
            type: .url,
            category: "network",
            description: "Base URL for API endpoints",
            isRequired: true,
            validationRules: [
                ValidationRule(type: .url, parameter: nil, message: "Must be a valid URL")
            ]
        ),

        "debug_logging": ConfigurationItem(
            key: "debug_logging",
            value: "true",
            type: .boolean,
            category: "debugging",
            description: "Enable debug logging"
        ),

        "mock_data_enabled": ConfigurationItem(
            key: "mock_data_enabled",
            value: "true",
            type: .boolean,
            category: "development",
            description: "Use mock data instead of real API calls"
        )
    ]

    /// Staging environment defaults
    private static let stagingDefaults: [String: ConfigurationItem] = [
        "api_base_url": ConfigurationItem(
            key: "api_base_url",
            value: "https://api-staging.isometry.app",
            type: .url,
            category: "network",
            description: "Base URL for API endpoints",
            isRequired: true,
            validationRules: [
                ValidationRule(type: .url, parameter: nil, message: "Must be a valid URL")
            ]
        ),

        "debug_logging": ConfigurationItem(
            key: "debug_logging",
            value: "false",
            type: .boolean,
            category: "debugging",
            description: "Enable debug logging"
        ),

        "mock_data_enabled": ConfigurationItem(
            key: "mock_data_enabled",
            value: "false",
            type: .boolean,
            category: "development",
            description: "Use mock data instead of real API calls"
        )
    ]

    /// Production environment defaults
    private static let productionDefaults: [String: ConfigurationItem] = [
        "api_base_url": ConfigurationItem(
            key: "api_base_url",
            value: "https://api.isometry.app",
            type: .url,
            category: "network",
            description: "Base URL for API endpoints",
            isRequired: true,
            validationRules: [
                ValidationRule(type: .url, parameter: nil, message: "Must be a valid URL")
            ]
        ),

        "debug_logging": ConfigurationItem(
            key: "debug_logging",
            value: "false",
            type: .boolean,
            category: "debugging",
            description: "Enable debug logging"
        ),

        "mock_data_enabled": ConfigurationItem(
            key: "mock_data_enabled",
            value: "false",
            type: .boolean,
            category: "development",
            description: "Use mock data instead of real API calls"
        ),

        "analytics_sample_rate": ConfigurationItem(
            key: "analytics_sample_rate",
            value: "0.1",
            type: .double,
            category: "privacy",
            description: "Analytics sampling rate (0.0-1.0)",
            validationRules: [
                ValidationRule(type: .range, parameter: "0.0-1.0", message: "Sample rate must be between 0.0 and 1.0")
            ]
        )
    ]
}