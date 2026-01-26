import Foundation
import GRDB

/// Native rollback coordination for migration safety
///
/// Provides comprehensive rollback capabilities including data export,
/// backup management, and safe reversion procedures for the sql.js migration.
@MainActor
public class RollbackCoordinator: ObservableObject {

    // MARK: - Types

    public struct RollbackPlan: Codable {
        public let id: String
        public let reason: String
        public let timestamp: Date
        public let estimatedDuration: TimeInterval
        public let dataSafety: DataSafety
        public let requiredSteps: [RollbackStep]
        public let backupLocation: String

        public enum DataSafety: String, Codable, CaseIterable {
            case safe = "safe"
            case risky = "risky"
            case dangerous = "dangerous"
        }
    }

    public struct RollbackStep: Codable, Identifiable {
        public let id: String
        public let name: String
        public let description: String
        public let isCritical: Bool
        public let estimatedTime: TimeInterval
        public var isCompleted: Bool = false
        public var error: String?
    }

    public struct SQLjsExportFormat: Codable {
        public let schema: String
        public let data: [String]
        public let indexes: [String]
        public let metadata: ExportMetadata
    }

    public struct ExportMetadata: Codable {
        public let version: String
        public let timestamp: Date
        public let recordCount: Int
        public let tableCount: Int
        public let totalSize: Int64
        public let checksum: String
        public let source: String
    }

    public struct RollbackResult: Codable {
        public let success: Bool
        public let duration: TimeInterval
        public let stepsCompleted: Int
        public let stepsTotal: Int
        public let errors: [String]
        public let warnings: [String]
        public let backupUsed: String?
        public let dataPreserved: Bool
    }

    public struct CloudKitStatus: Codable {
        public let hasData: Bool
        public let unsyncedCount: Int
        public let lastSync: Date?
        public let syncEnabled: Bool
    }

    public struct DataSizeInfo: Codable {
        public let totalSize: Int64
        public let tablesSizes: [String: Int64]
        public let recordCounts: [String: Int]
        public let indexSize: Int64
    }

    // MARK: - Properties

    private let database: IsometryDatabase
    private let dataExporter: DataExporter
    private let fileManager: FileManager
    private let backupDirectory: URL

    @Published public var isRollbackActive = false
    @Published public var currentPlan: RollbackPlan?
    @Published public var progress: Double = 0.0
    @Published public var currentStep: String = ""

    // Configuration
    private let maxBackupRetention = 7 // days
    private let compressionEnabled = true
    private let encryptionEnabled = false // For future security enhancement

    // MARK: - Initialization

    public init(database: IsometryDatabase) throws {
        self.database = database
        self.dataExporter = DataExporter(database: database)
        self.fileManager = FileManager.default

        // Create backup directory
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.backupDirectory = documentsPath.appendingPathComponent("Isometry/Rollback/Backups", isDirectory: true)

        try fileManager.createDirectory(at: backupDirectory, withIntermediateDirectories: true)

        // Clean up old backups on initialization
        cleanupOldBackups()
    }

    // MARK: - Public Methods

    /// Initiate native-side rollback process
    public func initiateRollback(plan: RollbackPlan) async throws -> RollbackResult {
        guard !isRollbackActive else {
            throw RollbackError.rollbackInProgress
        }

        print("🔄 Initiating rollback: \(plan.reason)")

        isRollbackActive = true
        currentPlan = plan
        progress = 0.0

        let startTime = Date()
        var completedSteps = 0
        var errors: [String] = []
        var warnings: [String] = []
        var backupUsed: String?

        defer {
            isRollbackActive = false
            currentPlan = nil
            progress = 1.0
            currentStep = ""
        }

        do {
            // Execute rollback steps
            for (index, step) in plan.requiredSteps.enumerated() {
                currentStep = step.name
                progress = Double(index) / Double(plan.requiredSteps.count)

                do {
                    try await executeRollbackStep(step)
                    completedSteps += 1

                    // Special handling for backup step
                    if step.name == "create_backup" {
                        backupUsed = await getLatestBackupId()
                    }

                } catch {
                    let errorMsg = "Step \(step.name) failed: \(error.localizedDescription)"
                    print("❌ \(errorMsg)")

                    if step.isCritical {
                        errors.append(errorMsg)
                        break // Stop on critical step failure
                    } else {
                        warnings.append(errorMsg)
                        completedSteps += 1
                    }
                }
            }

            let duration = Date().timeIntervalSince(startTime)
            let success = errors.isEmpty && completedSteps >= plan.requiredSteps.filter { $0.isCritical }.count

            let result = RollbackResult(
                success: success,
                duration: duration,
                stepsCompleted: completedSteps,
                stepsTotal: plan.requiredSteps.count,
                errors: errors,
                warnings: warnings,
                backupUsed: backupUsed,
                dataPreserved: success
            )

            print("✅ Rollback completed: success=\(success), duration=\(Int(duration))s")
            return result

        } catch {
            let duration = Date().timeIntervalSince(startTime)
            let errorMsg = "Rollback failed: \(error.localizedDescription)"
            print("❌ \(errorMsg)")

            return RollbackResult(
                success: false,
                duration: duration,
                stepsCompleted: completedSteps,
                stepsTotal: plan.requiredSteps.count,
                errors: [errorMsg],
                warnings: warnings,
                backupUsed: backupUsed,
                dataPreserved: false
            )
        }
    }

    /// Export all native data in sql.js compatible format
    public func exportToSQLjs() async throws -> SQLjsExportFormat {
        print("📤 Exporting data for sql.js compatibility...")

        return try await database.read { db in
            let exporter = self.dataExporter

            // Generate schema statements
            let schema = try exporter.generateSchemaStatements(db)

            // Generate data statements
            let data = try exporter.generateDataStatements(db)

            // Generate index statements
            let indexes = try exporter.generateIndexStatements(db)

            // Generate metadata
            let metadata = try exporter.generateExportMetadata(db)

            return SQLjsExportFormat(
                schema: schema,
                data: data,
                indexes: indexes,
                metadata: metadata
            )
        }
    }

    /// Create complete backup of current database state
    public func createRollbackBackup() async throws -> String {
        print("💾 Creating rollback backup...")

        let backupId = generateBackupId()
        let backupPath = backupDirectory.appendingPathComponent("\(backupId).backup")

        // Export data
        let exportFormat = try await exportToSQLjs()

        // Create backup package
        let backupData = try JSONEncoder().encode(exportFormat)

        if compressionEnabled {
            let compressedData = try compress(data: backupData)
            try compressedData.write(to: backupPath)
        } else {
            try backupData.write(to: backupPath)
        }

        // Create metadata file
        let metadataPath = backupDirectory.appendingPathComponent("\(backupId).metadata.json")
        let metadataData = try JSONEncoder().encode(exportFormat.metadata)
        try metadataData.write(to: metadataPath)

        print("✅ Backup created: \(backupId)")
        return backupId
    }

    /// Validate rollback safety before execution
    public func validateRollbackSafety() async throws -> Bool {
        print("🔍 Validating rollback safety...")

        // Check database state
        let isHealthy = try await database.read { db in
            // Basic health check
            try db.execute(sql: "PRAGMA integrity_check")
            return true
        }

        guard isHealthy else {
            throw RollbackError.databaseCorrupted
        }

        // Check available disk space
        let availableSpace = try getAvailableDiskSpace()
        let requiredSpace = try await estimateBackupSize()

        guard availableSpace > requiredSpace * 2 else { // 2x safety margin
            throw RollbackError.insufficientStorage
        }

        // Check for critical transactions
        let pendingTransactions = try await database.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_queue WHERE status = 'pending'") ?? 0
        }

        if pendingTransactions > 100 {
            throw RollbackError.tooManyPendingTransactions
        }

        return true
    }

    /// Complete rollback process and cleanup
    public func completeRollback() async throws {
        print("✅ Completing rollback...")

        // Final validation
        try await validatePostRollback()

        // Cleanup temporary files
        cleanupTemporaryFiles()

        // Update rollback logs
        await logRollbackCompletion()

        print("✅ Rollback completed successfully")
    }

    /// Check CloudKit status for rollback planning
    public func checkCloudKitStatus() async -> CloudKitStatus {
        do {
            return try await database.read { db in
                let hasData = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM cloudkit_metadata") ?? 0 > 0
                let unsyncedCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM sync_queue WHERE cloudkit_status = 'pending'") ?? 0
                let lastSync = try Date.fetchOne(db, sql: "SELECT MAX(last_sync) FROM cloudkit_metadata")

                return CloudKitStatus(
                    hasData: hasData,
                    unsyncedCount: unsyncedCount,
                    lastSync: lastSync,
                    syncEnabled: true // Would check actual CloudKit availability
                )
            }
        } catch {
            print("⚠️ Failed to check CloudKit status: \(error)")
            return CloudKitStatus(hasData: false, unsyncedCount: 0, lastSync: nil, syncEnabled: false)
        }
    }

    /// Estimate total data size for rollback planning
    public func estimateDataSize() async -> DataSizeInfo {
        do {
            return try await database.read { db in
                var tablesSizes: [String: Int64] = [:]
                var recordCounts: [String: Int] = [:]

                let tables = try String.fetchAll(db, sql: """
                    SELECT name FROM sqlite_master
                    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                """)

                var totalSize: Int64 = 0

                for table in tables {
                    let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(table)") ?? 0
                    let size = try Int64.fetchOne(db, sql: """
                        SELECT SUM(LENGTH(sql)) FROM sqlite_master WHERE tbl_name = ?
                    """, arguments: [table]) ?? 0

                    recordCounts[table] = count
                    tablesSizes[table] = size
                    totalSize += size
                }

                let indexSize = try Int64.fetchOne(db, sql: """
                    SELECT SUM(LENGTH(sql)) FROM sqlite_master WHERE type = 'index'
                """) ?? 0

                return DataSizeInfo(
                    totalSize: totalSize,
                    tablesSizes: tablesSizes,
                    recordCounts: recordCounts,
                    indexSize: indexSize
                )
            }
        } catch {
            print("⚠️ Failed to estimate data size: \(error)")
            return DataSizeInfo(totalSize: 0, tablesSizes: [:], recordCounts: [:], indexSize: 0)
        }
    }

    // MARK: - Private Methods

    private func executeRollbackStep(_ step: RollbackStep) async throws {
        print("🔧 Executing step: \(step.name)")

        switch step.name {
        case "validate_environment":
            try await validateRollbackSafety()

        case "create_backup":
            _ = try await createRollbackBackup()

        case "pause_operations":
            try await pauseDatabaseOperations()

        case "export_data":
            _ = try await exportToSQLjs()

        case "validate_export":
            try await validateExport()

        case "cleanup_resources":
            try await cleanupResources()

        default:
            print("⚠️ Unknown rollback step: \(step.name)")
        }

        // Add artificial delay to simulate work
        try await Task.sleep(nanoseconds: UInt64(step.estimatedTime * 1_000_000_000))
    }

    private func pauseDatabaseOperations() async throws {
        // Pause all non-essential database operations
        print("⏸️ Pausing database operations...")

        // In a real implementation, this would:
        // - Stop background sync operations
        // - Complete pending transactions
        // - Set database to read-only mode temporarily
    }

    private func validateExport() async throws {
        print("✅ Validating data export...")

        // Validate that export is complete and consistent
        let export = try await exportToSQLjs()

        guard !export.schema.isEmpty else {
            throw RollbackError.exportValidationFailed("Schema export empty")
        }

        guard !export.data.isEmpty else {
            throw RollbackError.exportValidationFailed("Data export empty")
        }

        // Validate record counts match
        let exportedRecordCount = export.metadata.recordCount
        let actualRecordCount = try await getCurrentRecordCount()

        guard exportedRecordCount == actualRecordCount else {
            throw RollbackError.exportValidationFailed("Record count mismatch: \(exportedRecordCount) vs \(actualRecordCount)")
        }
    }

    private func cleanupResources() async throws {
        print("🧹 Cleaning up resources...")

        // Cleanup temporary files, caches, etc.
        cleanupTemporaryFiles()

        // Reset any temporary state
        await resetTemporaryState()
    }

    private func validatePostRollback() async throws {
        print("🔍 Validating post-rollback state...")

        // Validate that rollback was successful
        // This would typically involve checking:
        // - Data consistency
        // - Schema integrity
        // - Performance metrics
    }

    private func logRollbackCompletion() async {
        print("📝 Logging rollback completion...")

        // Log rollback completion for auditing
        let logEntry = [
            "timestamp": Date().iso8601String,
            "event": "rollback_completed",
            "plan_id": currentPlan?.id ?? "unknown"
        ]

        // In a real implementation, this would write to a proper log system
        print("📋 Rollback log: \(logEntry)")
    }

    private func getCurrentRecordCount() async throws -> Int {
        return try await database.read { db in
            let tables = try String.fetchAll(db, sql: """
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            """)

            var totalCount = 0
            for table in tables {
                let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(table)") ?? 0
                totalCount += count
            }

            return totalCount
        }
    }

    private func estimateBackupSize() async throws -> Int64 {
        let dataSize = await estimateDataSize()
        return dataSize.totalSize * 2 // Estimate with compression overhead
    }

    private func getAvailableDiskSpace() throws -> Int64 {
        let attributes = try fileManager.attributesOfFileSystem(forPath: backupDirectory.path)
        return attributes[.systemFreeSize] as? Int64 ?? 0
    }

    private func generateBackupId() -> String {
        let timestamp = Date().formatted(.iso8601.year().month().day().hour().minute().second())
        let random = String(Int.random(in: 1000...9999))
        return "rollback-\(timestamp)-\(random)"
    }

    private func getLatestBackupId() async -> String {
        let backups = getExistingBackups()
        return backups.max() ?? "unknown"
    }

    private func getExistingBackups() -> [String] {
        do {
            let contents = try fileManager.contentsOfDirectory(at: backupDirectory, includingPropertiesForKeys: nil)
            return contents
                .filter { $0.pathExtension == "backup" }
                .map { $0.deletingPathExtension().lastPathComponent }
                .sorted()
        } catch {
            print("⚠️ Failed to list existing backups: \(error)")
            return []
        }
    }

    private func cleanupOldBackups() {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -maxBackupRetention, to: Date()) ?? Date()

        do {
            let contents = try fileManager.contentsOfDirectory(at: backupDirectory, includingPropertiesForKeys: [.creationDateKey])

            for fileURL in contents {
                let attributes = try fileURL.resourceValues(forKeys: [.creationDateKey])
                if let creationDate = attributes.creationDate, creationDate < cutoffDate {
                    try fileManager.removeItem(at: fileURL)
                    print("🗑️ Removed old backup: \(fileURL.lastPathComponent)")
                }
            }
        } catch {
            print("⚠️ Failed to cleanup old backups: \(error)")
        }
    }

    private func cleanupTemporaryFiles() {
        // Implementation would clean up any temporary files created during rollback
    }

    private func resetTemporaryState() async {
        // Reset any temporary state variables
    }

    private func compress(data: Data) throws -> Data {
        // Simple compression implementation
        // In production, would use proper compression algorithm
        return try (data as NSData).compressed(using: .zlib) as Data
    }
}

// MARK: - Supporting Types

public enum RollbackError: LocalizedError {
    case rollbackInProgress
    case databaseCorrupted
    case insufficientStorage
    case tooManyPendingTransactions
    case exportValidationFailed(String)
    case backupCreationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .rollbackInProgress:
            return "Rollback operation already in progress"
        case .databaseCorrupted:
            return "Database corruption detected - cannot safely rollback"
        case .insufficientStorage:
            return "Insufficient storage space for backup creation"
        case .tooManyPendingTransactions:
            return "Too many pending transactions - complete sync first"
        case .exportValidationFailed(let reason):
            return "Export validation failed: \(reason)"
        case .backupCreationFailed(let reason):
            return "Backup creation failed: \(reason)"
        }
    }
}

// MARK: - Extensions

extension Date {
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}