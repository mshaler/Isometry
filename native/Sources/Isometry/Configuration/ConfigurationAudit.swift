import Foundation
import Combine
import os.log

/// Configuration audit trail system for tracking changes and compliance
@MainActor
public final class ConfigurationAudit: ObservableObject, Sendable {

    // MARK: - Published Properties

    @Published public private(set) var auditEntries: [ConfigurationAuditEntry] = []
    @Published public private(set) var complianceStatus: ComplianceStatus = ComplianceStatus()

    // MARK: - Private Properties

    private let storage: AuditStorage
    private let logger = Logger(subsystem: "com.isometry.app", category: "ConfigurationAudit")
    private let maxAuditEntries = 10000
    private var compressionTimer: Timer?

    // MARK: - Initialization

    public init(storage: AuditStorage = UserDefaultsAuditStorage()) {
        self.storage = storage
        loadStoredAuditEntries()
        setupPeriodicCompression()
    }

    deinit {
        compressionTimer?.invalidate()
    }

    // MARK: - Public API

    /// Record a configuration change in the audit trail
    public func recordChange(_ change: ConfigurationChange) throws {
        let entry = ConfigurationAuditEntry(
            id: UUID(),
            action: .configurationChanged,
            configurationKey: change.key,
            oldValue: change.oldValue,
            newValue: change.newValue,
            environment: change.environment,
            source: change.source.rawValue,
            timestamp: change.timestamp,
            metadata: createChangeMetadata(change)
        )

        try addConfigurationAuditEntry(entry)
        logger.debug("Recorded configuration change: \(change.key)")
    }

    /// Record configuration access (read) event
    public func recordAccess(_ key: String, environment: String?, source: String = "application") throws {
        let entry = ConfigurationAuditEntry(
            action: .configurationAccessed,
            configurationKey: key,
            environment: environment,
            source: source,
            timestamp: Date()
        )

        try addConfigurationAuditEntry(entry)
        logger.debug("Recorded configuration access: \\(key)")
    }

    /// Record configuration validation event
    public func recordValidation(
        _ key: String,
        result: ValidationResult,
        environment: String? = nil
    ) throws {
        let action: AuditAction = result.isValid ? .validationPassed : .validationFailed

        let entry = ConfigurationAuditEntry(
            action: action,
            configurationKey: key,
            environment: environment,
            source: "validation_system",
            timestamp: Date(),
            metadata: [
                "validation_errors": result.errors.joined(separator: ", "),
                "validation_warnings": result.warnings.joined(separator: ", "),
                "error_count": String(result.errors.count),
                "warning_count": String(result.warnings.count)
            ]
        )

        try addConfigurationAuditEntry(entry)
        let status = result.isValid ? "passed" : "failed"
        logger.debug("Recorded validation result for \(key): \(status)")
    }

    /// Record security event related to configuration
    public func recordSecurityEvent(
        _ key: String,
        eventType: SecurityEventType,
        details: String,
        severity: SecuritySeverity = .medium
    ) throws {
        let entry = ConfigurationAuditEntry(
            action: .securityEvent,
            configurationKey: key,
            source: "security_system",
            timestamp: Date(),
            metadata: [
                "event_type": eventType.rawValue,
                "details": details,
                "severity": severity.rawValue
            ]
        )

        try addConfigurationAuditEntry(entry)
        updateComplianceStatus(for: eventType, severity: severity)

        logger.warning("Recorded security event for \(key): \(eventType.rawValue) (\(severity.rawValue))")
    }

    /// Record rollback event
    public func recordRollback(
        _ key: String,
        fromValue: String?,
        toValue: String?,
        reason: String,
        environment: String? = nil
    ) throws {
        let entry = ConfigurationAuditEntry(
            action: .configurationRolledBack,
            configurationKey: key,
            oldValue: fromValue,
            newValue: toValue,
            environment: environment,
            source: "rollback_system",
            timestamp: Date(),
            metadata: [
                "rollback_reason": reason
            ]
        )

        try addConfigurationAuditEntry(entry)
        logger.debug("Recorded rollback for \(key): \(reason)")
    }

    /// Get audit history for a specific configuration key
    public func getAuditHistory(for key: String, limit: Int = 100) -> [ConfigurationAuditEntry] {
        return auditEntries
            .filter { $0.configurationKey == key }
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(limit)
            .map { $0 }
    }

    /// Get audit entries for a specific time range
    public func getAuditHistory(
        from startDate: Date,
        to endDate: Date,
        actions: [AuditAction]? = nil
    ) -> [ConfigurationAuditEntry] {
        return auditEntries
            .filter { entry in
                entry.timestamp >= startDate &&
                entry.timestamp <= endDate &&
                (actions?.contains(entry.action) ?? true)
            }
            .sorted { $0.timestamp > $1.timestamp }
    }

    /// Get recent security events
    public func getSecurityEvents(limit: Int = 50) -> [ConfigurationAuditEntry] {
        return auditEntries
            .filter { $0.action == .securityEvent }
            .sorted { $0.timestamp > $1.timestamp }
            .prefix(limit)
            .map { $0 }
    }

    /// Generate audit report
    public func generateAuditReport(
        from startDate: Date,
        to endDate: Date,
        format: AuditReportFormat = .detailed
    ) -> AuditReport {
        let entries = getAuditHistory(from: startDate, to: endDate)

        let changeCount = entries.filter { $0.action == .configurationChanged }.count
        let accessCount = entries.filter { $0.action == .configurationAccessed }.count
        let validationFailures = entries.filter { $0.action == .validationFailed }.count
        let securityEvents = entries.filter { $0.action == .securityEvent }.count
        let rollbacks = entries.filter { $0.action == .configurationRolledBack }.count

        let topChangedConfigs = Dictionary(grouping: entries.filter { $0.action == .configurationChanged }) { $0.configurationKey }
            .mapValues { $0.count }
            .sorted { $0.value > $1.value }
            .prefix(10)
            .map { AuditReportItem(key: $0.key, count: $0.value) }

        return AuditReport(
            reportPeriod: DateInterval(start: startDate, end: endDate),
            totalEntries: entries.count,
            changeCount: changeCount,
            accessCount: accessCount,
            validationFailures: validationFailures,
            securityEvents: securityEvents,
            rollbackCount: rollbacks,
            topChangedConfigurations: topChangedConfigs,
            complianceStatus: complianceStatus,
            generatedAt: Date()
        )
    }

    /// Export audit trail
    public func exportAuditTrail(
        from startDate: Date?,
        to endDate: Date?,
        format: AuditExportFormat = .json
    ) -> Data? {
        var entriesToExport = auditEntries

        if let startDate = startDate {
            entriesToExport = entriesToExport.filter { $0.timestamp >= startDate }
        }

        if let endDate = endDate {
            entriesToExport = entriesToExport.filter { $0.timestamp <= endDate }
        }

        let export = AuditExport(
            entries: entriesToExport,
            exportDate: Date(),
            totalEntries: entriesToExport.count
        )

        switch format {
        case .json:
            return try? JSONEncoder().encode(export)
        case .csv:
            return exportToCSV(entriesToExport)
        }
    }

    /// Clear old audit entries (compliance retention)
    public func cleanupOldEntries(olderThan retentionPeriod: TimeInterval) throws {
        let cutoffDate = Date().addingTimeInterval(-retentionPeriod)
        let originalCount = auditEntries.count

        auditEntries = auditEntries.filter { $0.timestamp >= cutoffDate }

        // Update storage
        try storage.saveAuditEntries(auditEntries)

        let removedCount = originalCount - auditEntries.count
        if removedCount > 0 {
            logger.debug("Cleaned up \(removedCount) old audit entries (older than \(retentionPeriod / 86400) days)")
        }
    }

    // MARK: - Private Methods

    private func addConfigurationAuditEntry(_ entry: ConfigurationAuditEntry) throws {
        auditEntries.insert(entry, at: 0)

        // Limit memory usage
        if auditEntries.count > maxAuditEntries {
            auditEntries = Array(auditEntries.prefix(maxAuditEntries))
        }

        // Store persistently
        try storage.saveAuditEntries(auditEntries)
    }

    private func loadStoredAuditEntries() {
        do {
            auditEntries = try storage.loadAuditEntries()
            logger.debug("Loaded \(auditEntries.count) audit entries from storage")
        } catch {
            logger.error("Failed to load audit entries: \\(error)")
            auditEntries = []
        }
    }

    private func setupPeriodicCompression() {
        // Compress old entries every hour
        compressionTimer = Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { [weak self] _ in
            Task { @MainActor in
                do {
                    try self?.compressOldEntries()
                } catch {
                    // Log error but don't crash - compression is not critical
                    print("Failed to compress audit entries: \(error)")
                }
            }
        }
    }

    private func compressOldEntries() throws {
        let thirtyDaysAgo = Date().addingTimeInterval(-30 * 24 * 60 * 60)
        let oldEntries = auditEntries.filter { $0.timestamp < thirtyDaysAgo }

        if oldEntries.count > 100 {
            // Compress by keeping only significant events older than 30 days
            let significantActions: [AuditAction] = [
                .configurationChanged,
                .securityEvent,
                .configurationRolledBack,
                .validationFailed
            ]

            let compressedEntries = oldEntries.filter { significantActions.contains($0.action) }
            let recentEntries = auditEntries.filter { $0.timestamp >= thirtyDaysAgo }

            auditEntries = recentEntries + compressedEntries
            try storage.saveAuditEntries(auditEntries)

            let removedCount = oldEntries.count - compressedEntries.count
            logger.debug("Compressed \(removedCount) old audit entries")
        }
    }

    private func createChangeMetadata(_ change: ConfigurationChange) -> [String: String] {
        var metadata: [String: String] = [:]

        if let oldValue = change.oldValue {
            metadata["old_value_hash"] = hashValue(oldValue)
        }

        if let newValue = change.newValue {
            metadata["new_value_hash"] = hashValue(newValue)
            metadata["value_length"] = String(newValue.count)
        }

        return metadata
    }

    private func hashValue(_ value: String) -> String {
        // Simple hash for audit purposes (not cryptographic)
        return String(value.hash)
    }

    private func updateComplianceStatus(for eventType: SecurityEventType, severity: SecuritySeverity) {
        complianceStatus.lastSecurityEvent = Date()

        switch eventType {
        case .unauthorizedAccess:
            complianceStatus.securityViolations += 1
        case .invalidConfiguration:
            complianceStatus.configurationViolations += 1
        case .dataExposure:
            complianceStatus.dataViolations += 1
        case .auditFailure:
            complianceStatus.auditViolations += 1
        }

        if severity == .high || severity == .critical {
            complianceStatus.criticalEvents += 1
        }

        // Update compliance score
        updateComplianceScore()
    }

    private func updateComplianceScore() {
        let totalViolations = complianceStatus.securityViolations +
                             complianceStatus.configurationViolations +
                             complianceStatus.dataViolations +
                             complianceStatus.auditViolations

        // Calculate compliance score (0.0 to 1.0)
        let baseScore = 1.0
        let violationPenalty = min(Double(totalViolations) * 0.02, 0.5) // Max 50% penalty
        let criticalPenalty = min(Double(complianceStatus.criticalEvents) * 0.05, 0.3) // Max 30% penalty

        complianceStatus.complianceScore = max(0.0, baseScore - violationPenalty - criticalPenalty)
    }

    private func exportToCSV(_ entries: [ConfigurationAuditEntry]) -> Data? {
        var csv = "Timestamp,Action,ConfigurationKey,OldValue,NewValue,Environment,Source\\n"

        for entry in entries {
            let timestamp = ISO8601DateFormatter().string(from: entry.timestamp)
            let oldValue = entry.oldValue?.replacingOccurrences(of: ",", with: ";") ?? ""
            let newValue = entry.newValue?.replacingOccurrences(of: ",", with: ";") ?? ""
            let environment = entry.environment ?? ""

            csv += "\\(timestamp),\\(entry.action.rawValue),\\(entry.configurationKey),\\(oldValue),\\(newValue),\\(environment),\\(entry.source)\\n"
        }

        return csv.data(using: .utf8)
    }
}

// MARK: - Supporting Types

/// Audit trail entry
public struct ConfigurationAuditEntry: Codable, Sendable, Identifiable {
    public let id: UUID
    public let action: AuditAction
    public let configurationKey: String
    public let oldValue: String?
    public let newValue: String?
    public let environment: String?
    public let source: String
    public let timestamp: Date
    public let metadata: [String: String]

    public init(
        id: UUID = UUID(),
        action: AuditAction,
        configurationKey: String,
        oldValue: String? = nil,
        newValue: String? = nil,
        environment: String? = nil,
        source: String,
        timestamp: Date = Date(),
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.action = action
        self.configurationKey = configurationKey
        self.oldValue = oldValue
        self.newValue = newValue
        self.environment = environment
        self.source = source
        self.timestamp = timestamp
        self.metadata = metadata
    }
}

/// Audit actions
public enum AuditAction: String, Codable, Sendable, CaseIterable {
    case configurationChanged = "configuration_changed"
    case configurationAccessed = "configuration_accessed"
    case configurationRolledBack = "configuration_rolled_back"
    case validationPassed = "validation_passed"
    case validationFailed = "validation_failed"
    case securityEvent = "security_event"
    case exportEvent = "export_event"
    case importEvent = "import_event"
}

/// Security event types
public enum SecurityEventType: String, Codable, Sendable {
    case unauthorizedAccess = "unauthorized_access"
    case invalidConfiguration = "invalid_configuration"
    case dataExposure = "data_exposure"
    case auditFailure = "audit_failure"
}

/// Security severity levels for configuration audit
public enum SecuritySeverity: String, Codable, Sendable {
    case low
    case medium
    case high
    case critical
}

/// Compliance status tracking
public struct ComplianceStatus: Codable, Sendable {
    public var complianceScore: Double = 1.0 // 0.0 to 1.0
    public var securityViolations: Int = 0
    public var configurationViolations: Int = 0
    public var dataViolations: Int = 0
    public var auditViolations: Int = 0
    public var criticalEvents: Int = 0
    public var lastSecurityEvent: Date?
    public var lastAssessment: Date = Date()

    public var complianceLevel: ComplianceLevel {
        switch complianceScore {
        case 0.9...1.0:
            return .excellent
        case 0.8..<0.9:
            return .good
        case 0.7..<0.8:
            return .fair
        case 0.5..<0.7:
            return .poor
        default:
            return .failing
        }
    }
}

/// Compliance levels
public enum ComplianceLevel: String, Sendable {
    case excellent
    case good
    case fair
    case poor
    case failing
}

/// Audit report
public struct AuditReport: Sendable {
    public let reportPeriod: DateInterval
    public let totalEntries: Int
    public let changeCount: Int
    public let accessCount: Int
    public let validationFailures: Int
    public let securityEvents: Int
    public let rollbackCount: Int
    public let topChangedConfigurations: [AuditReportItem]
    public let complianceStatus: ComplianceStatus
    public let generatedAt: Date
}

/// Audit report item
public struct AuditReportItem: Sendable {
    public let key: String
    public let count: Int
}

/// Audit report formats
public enum AuditReportFormat {
    case summary
    case detailed
    case compliance
}

/// Audit export
public struct AuditExport: Codable, Sendable {
    public let entries: [ConfigurationAuditEntry]
    public let exportDate: Date
    public let totalEntries: Int
}

/// Audit export formats
public enum AuditExportFormat {
    case json
    case csv
}

// MARK: - Storage Protocol

/// Audit storage protocol
public protocol AuditStorage {
    func saveAuditEntries(_ entries: [ConfigurationAuditEntry]) throws
    func loadAuditEntries() throws -> [ConfigurationAuditEntry]
    func clearAuditEntries()
}

/// UserDefaults-based audit storage
public final class UserDefaultsAuditStorage: AuditStorage {
    private let key = "configuration_audit_entries"

    public init() {}

    public func saveAuditEntries(_ entries: [ConfigurationAuditEntry]) throws {
        let data = try JSONEncoder().encode(entries)
        UserDefaults.standard.set(data, forKey: key)
    }

    public func loadAuditEntries() throws -> [ConfigurationAuditEntry] {
        guard let data = UserDefaults.standard.data(forKey: key) else {
            return []
        }
        return try JSONDecoder().decode([ConfigurationAuditEntry].self, from: data)
    }

    public func clearAuditEntries() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}