import Foundation
import GRDB
import CryptoKit

// CAS Integration types moved to dedicated CASIntegration.swift file

// MARK: - Configuration Types

/// Dump operation configuration
public struct DumpConfiguration: Codable {
    public let includeNodes: Bool
    public let includeEdges: Bool
    public let includeAttachments: Bool
    public let includeIndexes: Bool
    public let compressionLevel: CompressionLevel
    public let encryptionEnabled: Bool
    public let dateRange: DateInterval?
    public let nodeTypes: [String]?

    public static let `default` = DumpConfiguration(
        includeNodes: true,
        includeEdges: true,
        includeAttachments: true,
        includeIndexes: true,
        compressionLevel: .medium,
        encryptionEnabled: false,
        dateRange: nil,
        nodeTypes: nil
    )

    public init(
        includeNodes: Bool = true,
        includeEdges: Bool = true,
        includeAttachments: Bool = true,
        includeIndexes: Bool = true,
        compressionLevel: CompressionLevel = .medium,
        encryptionEnabled: Bool = false,
        dateRange: DateInterval? = nil,
        nodeTypes: [String]? = nil
    ) {
        self.includeNodes = includeNodes
        self.includeEdges = includeEdges
        self.includeAttachments = includeAttachments
        self.includeIndexes = includeIndexes
        self.compressionLevel = compressionLevel
        self.encryptionEnabled = encryptionEnabled
        self.dateRange = dateRange
        self.nodeTypes = nodeTypes
    }
}

/// Restore operation configuration
public struct RestoreConfiguration: Codable {
    public let dryRun: Bool
    public let restoreAttachments: Bool
    public let overwriteExisting: Bool
    public let validateIntegrity: Bool
    public let createBackup: Bool
    public let targetPointInTime: Date?
    public let conflictResolution: ConflictResolutionStrategy

    public static let `default` = RestoreConfiguration(
        dryRun: false,
        restoreAttachments: true,
        overwriteExisting: false,
        validateIntegrity: true,
        createBackup: true,
        targetPointInTime: nil,
        conflictResolution: .abort
    )

    public init(
        dryRun: Bool = false,
        restoreAttachments: Bool = true,
        overwriteExisting: Bool = false,
        validateIntegrity: Bool = true,
        createBackup: Bool = true,
        targetPointInTime: Date? = nil,
        conflictResolution: ConflictResolutionStrategy = .abort
    ) {
        self.dryRun = dryRun
        self.restoreAttachments = restoreAttachments
        self.overwriteExisting = overwriteExisting
        self.validateIntegrity = validateIntegrity
        self.createBackup = createBackup
        self.targetPointInTime = targetPointInTime
        self.conflictResolution = conflictResolution
    }
}

/// Purge operation configuration
public struct PurgeConfiguration: Codable {
    public let dryRun: Bool
    public let includeAttachments: Bool
    public let secureWipe: Bool
    public let dateRange: DateInterval?
    public let nodeTypes: [String]?
    public let preserveReferences: Bool
    public let auditCompliance: Bool

    public init(
        dryRun: Bool = true,
        includeAttachments: Bool = true,
        secureWipe: Bool = false,
        dateRange: DateInterval? = nil,
        nodeTypes: [String]? = nil,
        preserveReferences: Bool = true,
        auditCompliance: Bool = true
    ) {
        self.dryRun = dryRun
        self.includeAttachments = includeAttachments
        self.secureWipe = secureWipe
        self.dateRange = dateRange
        self.nodeTypes = nodeTypes
        self.preserveReferences = preserveReferences
        self.auditCompliance = auditCompliance
    }
}

/// Rehydrate operation configuration
public struct RehydrateConfiguration: Codable {
    public let dataSources: [DataSource]
    public let timeRange: DateInterval?
    public let conflictResolution: ConflictResolutionStrategy
    public let includeSyntheticData: Bool
    public let syntheticDataScale: DataScale
    public let preserveExisting: Bool

    public init(
        dataSources: [DataSource],
        timeRange: DateInterval? = nil,
        conflictResolution: ConflictResolutionStrategy = .merge,
        includeSyntheticData: Bool = false,
        syntheticDataScale: DataScale = .medium,
        preserveExisting: Bool = true
    ) {
        self.dataSources = dataSources
        self.timeRange = timeRange
        self.conflictResolution = conflictResolution
        self.includeSyntheticData = includeSyntheticData
        self.syntheticDataScale = syntheticDataScale
        self.preserveExisting = preserveExisting
    }
}

/// Export operation configuration
public struct ExportConfiguration: Codable {
    public let format: DatabaseExportFormat
    public let includeSchema: Bool
    public let includeData: Bool
    public let includeAttachments: Bool
    public let dateRange: DateInterval?
    public let nodeTypes: [String]?
    public let fieldMapping: [String: String]?
    public let customTransforms: [String]?

    public static let `default` = ExportConfiguration(
        format: .json,
        includeSchema: true,
        includeData: true,
        includeAttachments: false,
        dateRange: nil,
        nodeTypes: nil,
        fieldMapping: nil,
        customTransforms: nil
    )

    public init(
        format: DatabaseExportFormat = .json,
        includeSchema: Bool = true,
        includeData: Bool = true,
        includeAttachments: Bool = false,
        dateRange: DateInterval? = nil,
        nodeTypes: [String]? = nil,
        fieldMapping: [String: String]? = nil,
        customTransforms: [String]? = nil
    ) {
        self.format = format
        self.includeSchema = includeSchema
        self.includeData = includeData
        self.includeAttachments = includeAttachments
        self.dateRange = dateRange
        self.nodeTypes = nodeTypes
        self.fieldMapping = fieldMapping
        self.customTransforms = customTransforms
    }
}

// MARK: - Supporting Enums

/// Compression levels for dump operations
public enum CompressionLevel: String, Codable, CaseIterable {
    case none = "none"
    case low = "low"
    case medium = "medium"
    case high = "high"
    case maximum = "maximum"

    public var ratio: Double {
        switch self {
        case .none: return 0.0
        case .low: return 0.25
        case .medium: return 0.5
        case .high: return 0.75
        case .maximum: return 0.9
        }
    }
}

/// Conflict resolution strategies
public enum ConflictResolutionStrategy: String, Codable, CaseIterable {
    case abort = "abort"
    case merge = "merge"
    case overwrite = "overwrite"
    case skip = "skip"
    case manual = "manual"
}

/// Data sources for rehydration
public enum DataSource: String, Codable, CaseIterable {
    case appleNotes = "apple_notes"
    case syntheticData = "synthetic_data"
    case externalAPI = "external_api"
}

/// Database export formats
public enum DatabaseExportFormat: String, Codable, CaseIterable {
    case json = "json"
    case csv = "csv"
    case xml = "xml"
    case sql = "sql"
    case protobuf = "protobuf"
}

// MARK: - Result Types

/// Dump operation result
public struct DumpResult: Codable {
    public let dumpPath: URL
    public let manifestPath: URL
    public let totalRecords: Int
    public let dumpFileSize: Int64
    public let attachmentsIncluded: Int
    public let operationId: UUID
    public let checksum: String
    public let compressionRatio: Double?

    public init(
        dumpPath: URL,
        manifestPath: URL,
        totalRecords: Int,
        dumpFileSize: Int64,
        attachmentsIncluded: Int,
        operationId: UUID,
        checksum: String,
        compressionRatio: Double? = nil
    ) {
        self.dumpPath = dumpPath
        self.manifestPath = manifestPath
        self.totalRecords = totalRecords
        self.dumpFileSize = dumpFileSize
        self.attachmentsIncluded = attachmentsIncluded
        self.operationId = operationId
        self.checksum = checksum
        self.compressionRatio = compressionRatio
    }
}

/// Restore operation result
public struct RestoreResult: Codable {
    public let restoredRecords: Int
    public let attachmentsRestored: Int
    public let operationId: UUID
    public let safetySnapshotId: UUID?
    public let conflictsEncountered: Int
    public let warnings: [String]

    public init(
        restoredRecords: Int,
        attachmentsRestored: Int,
        operationId: UUID,
        safetySnapshotId: UUID? = nil,
        conflictsEncountered: Int = 0,
        warnings: [String] = []
    ) {
        self.restoredRecords = restoredRecords
        self.attachmentsRestored = attachmentsRestored
        self.operationId = operationId
        self.safetySnapshotId = safetySnapshotId
        self.conflictsEncountered = conflictsEncountered
        self.warnings = warnings
    }
}

/// Purge operation result
public struct PurgeResult: Codable {
    public let purgedRecords: Int
    public let attachmentsPurged: Int
    public let freeSpaceReclaimed: Int64
    public let auditTrail: [AuditEntry]
    public let impactAnalysis: PurgeImpactAnalysis

    public init(
        purgedRecords: Int,
        attachmentsPurged: Int,
        freeSpaceReclaimed: Int64,
        auditTrail: [AuditEntry],
        impactAnalysis: PurgeImpactAnalysis
    ) {
        self.purgedRecords = purgedRecords
        self.attachmentsPurged = attachmentsPurged
        self.freeSpaceReclaimed = freeSpaceReclaimed
        self.auditTrail = auditTrail
        self.impactAnalysis = impactAnalysis
    }
}

/// Rehydrate operation result
public struct RehydrateResult: Codable {
    public let recordsCreated: Int
    public let conflictsResolved: Int
    public let operationId: UUID
    public let dataSources: [DataSource]
    public let syntheticDataGenerated: Int

    public init(
        recordsCreated: Int,
        conflictsResolved: Int,
        operationId: UUID,
        dataSources: [DataSource],
        syntheticDataGenerated: Int = 0
    ) {
        self.recordsCreated = recordsCreated
        self.conflictsResolved = conflictsResolved
        self.operationId = operationId
        self.dataSources = dataSources
        self.syntheticDataGenerated = syntheticDataGenerated
    }
}

/// Database export operation result
public struct DatabaseExportResult: Codable {
    public let exportPath: URL
    public let format: DatabaseExportFormat
    public let recordsExported: Int
    public let fileSize: Int64
    public let operationId: UUID
    public let metadata: [String: String]

    public init(
        exportPath: URL,
        format: DatabaseExportFormat,
        recordsExported: Int,
        fileSize: Int64,
        operationId: UUID,
        metadata: [String: String] = [:]
    ) {
        self.exportPath = exportPath
        self.format = format
        self.recordsExported = recordsExported
        self.fileSize = fileSize
        self.operationId = operationId
        self.metadata = metadata
    }
}

// MARK: - Analysis and Audit Types

/// Purge impact analysis
public struct PurgeImpactAnalysis: Codable {
    public let candidateRecords: Int
    public let estimatedSpaceReclamation: Int64
    public let affectedTables: [String]
    public let auditEntries: [AuditEntry]
    public let referentialImpact: ReferentialImpact
    public let recommendations: [String]

    public init(
        candidateRecords: Int,
        estimatedSpaceReclamation: Int64,
        affectedTables: [String],
        auditEntries: [AuditEntry],
        referentialImpact: ReferentialImpact = ReferentialImpact(),
        recommendations: [String] = []
    ) {
        self.candidateRecords = candidateRecords
        self.estimatedSpaceReclamation = estimatedSpaceReclamation
        self.affectedTables = affectedTables
        self.auditEntries = auditEntries
        self.referentialImpact = referentialImpact
        self.recommendations = recommendations
    }
}

/// Referential integrity impact analysis
public struct ReferentialImpact: Codable {
    public let orphanedEdges: Int
    public let cascadeDeletes: Int
    public let integrityViolations: [String]

    public init(
        orphanedEdges: Int = 0,
        cascadeDeletes: Int = 0,
        integrityViolations: [String] = []
    ) {
        self.orphanedEdges = orphanedEdges
        self.cascadeDeletes = cascadeDeletes
        self.integrityViolations = integrityViolations
    }
}

/// Audit entry for compliance tracking
public struct AuditEntry: Codable, Identifiable {
    public let id: UUID
    public let operationType: LifecycleOperationType
    public let recordId: String
    public let recordType: String
    public let timestamp: Date
    public let details: [String: String]
    public let userContext: String?

    public init(
        id: UUID = UUID(),
        operationType: LifecycleOperationType,
        recordId: String,
        recordType: String,
        timestamp: Date = Date(),
        details: [String: String] = [:],
        userContext: String? = nil
    ) {
        self.id = id
        self.operationType = operationType
        self.recordId = recordId
        self.recordType = recordType
        self.timestamp = timestamp
        self.details = details
        self.userContext = userContext
    }
}

/// Dump manifest for integrity validation
public struct DumpManifest: Codable {
    public let version: String
    public let createdAt: Date
    public let operationId: UUID
    public let totalRecords: Int
    public let attachmentsIncluded: Int
    public let configuration: DumpConfiguration
    public let checksum: String
    public let schemaVersion: String?
    public let compressionInfo: CompressionInfo?

    public init(
        version: String,
        createdAt: Date,
        operationId: UUID,
        totalRecords: Int,
        attachmentsIncluded: Int,
        configuration: DumpConfiguration,
        checksum: String,
        schemaVersion: String? = nil,
        compressionInfo: CompressionInfo? = nil
    ) {
        self.version = version
        self.createdAt = createdAt
        self.operationId = operationId
        self.totalRecords = totalRecords
        self.attachmentsIncluded = attachmentsIncluded
        self.configuration = configuration
        self.checksum = checksum
        self.schemaVersion = schemaVersion
        self.compressionInfo = compressionInfo
    }
}

/// Compression information
public struct CompressionInfo: Codable {
    public let algorithm: String
    public let originalSize: Int64
    public let compressedSize: Int64
    public let compressionRatio: Double

    public init(algorithm: String, originalSize: Int64, compressedSize: Int64) {
        self.algorithm = algorithm
        self.originalSize = originalSize
        self.compressedSize = compressedSize
        self.compressionRatio = Double(compressedSize) / Double(originalSize)
    }
}

// MARK: - Atomic Operation Handling

/// Atomic operation context for transaction safety
public struct AtomicOperationContext {
    public let operationId: UUID
    public let transactionId: UUID
    public let checkpoints: [OperationCheckpoint]
    public let rollbackHandlers: [() async throws -> Void]
    public let progressCallback: ((Double) -> Void)?

    public init(
        operationId: UUID,
        transactionId: UUID = UUID(),
        progressCallback: ((Double) -> Void)? = nil
    ) {
        self.operationId = operationId
        self.transactionId = transactionId
        self.checkpoints = []
        self.rollbackHandlers = []
        self.progressCallback = progressCallback
    }
}

/// Operation checkpoint for recovery
public struct OperationCheckpoint: Codable {
    public let id: UUID
    public let timestamp: Date
    public let phase: String
    public let completedItems: Int
    public let totalItems: Int
    public let metadata: [String: String]

    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        phase: String,
        completedItems: Int,
        totalItems: Int,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.timestamp = timestamp
        self.phase = phase
        self.completedItems = completedItems
        self.totalItems = totalItems
        self.metadata = metadata
    }

    public var progress: Double {
        guard totalItems > 0 else { return 0.0 }
        return Double(completedItems) / Double(totalItems)
    }
}

// MARK: - Progress Tracking

/// Progress tracking for long-running operations
public struct OperationProgress: Codable {
    public let operationId: UUID
    public let phase: String
    public let completedItems: Int
    public let totalItems: Int
    public let estimatedTimeRemaining: TimeInterval?
    public let currentItem: String?

    public init(
        operationId: UUID,
        phase: String,
        completedItems: Int,
        totalItems: Int,
        estimatedTimeRemaining: TimeInterval? = nil,
        currentItem: String? = nil
    ) {
        self.operationId = operationId
        self.phase = phase
        self.completedItems = completedItems
        self.totalItems = totalItems
        self.estimatedTimeRemaining = estimatedTimeRemaining
        self.currentItem = currentItem
    }

    public var progressPercentage: Double {
        guard totalItems > 0 else { return 0.0 }
        return min(100.0, (Double(completedItems) / Double(totalItems)) * 100.0)
    }
}

// MARK: - Validation and Integrity

/// Data integrity validation result
public struct IntegrityValidationResult: Codable {
    public let isValid: Bool
    public let checksumMatches: Bool
    public let schemaCompatible: Bool
    public let recordCountMatches: Bool
    public let attachmentIntegrity: Bool
    public let violations: [IntegrityViolation]
    public let warnings: [String]

    public init(
        isValid: Bool,
        checksumMatches: Bool,
        schemaCompatible: Bool,
        recordCountMatches: Bool,
        attachmentIntegrity: Bool,
        violations: [IntegrityViolation] = [],
        warnings: [String] = []
    ) {
        self.isValid = isValid
        self.checksumMatches = checksumMatches
        self.schemaCompatible = schemaCompatible
        self.recordCountMatches = recordCountMatches
        self.attachmentIntegrity = attachmentIntegrity
        self.violations = violations
        self.warnings = warnings
    }
}

/// Integrity violation details
public struct IntegrityViolation: Codable {
    public let type: ViolationType
    public let table: String
    public let recordId: String?
    public let field: String?
    public let description: String
    public let severity: ViolationSeverity

    public init(
        type: ViolationType,
        table: String,
        recordId: String? = nil,
        field: String? = nil,
        description: String,
        severity: ViolationSeverity = .warning
    ) {
        self.type = type
        self.table = table
        self.recordId = recordId
        self.field = field
        self.description = description
        self.severity = severity
    }
}

/// Types of integrity violations
public enum ViolationType: String, Codable, CaseIterable {
    case checksumMismatch = "checksum_mismatch"
    case missingRecord = "missing_record"
    case invalidReference = "invalid_reference"
    case dataCorruption = "data_corruption"
    case schemaViolation = "schema_violation"
}

/// Severity levels for violations
public enum ViolationSeverity: String, Codable, CaseIterable {
    case info = "info"
    case warning = "warning"
    case error = "error"
    case critical = "critical"
}

// MARK: - Cancellation and Cleanup

/// Operation cancellation token
public class OperationCancellationToken {
    private var _isCancelled = false
    private let lock = NSLock()

    public var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _isCancelled
    }

    public func cancel() {
        lock.lock()
        defer { lock.unlock() }
        _isCancelled = true
    }

    public func throwIfCancelled() throws {
        if isCancelled {
            throw OperationError.cancelled
        }
    }
}

/// Operation-specific errors
public enum OperationError: Error, LocalizedError {
    case cancelled
    case timeout(TimeInterval)
    case insufficientSpace(required: Int64, available: Int64)
    case integrityCheckFailed([IntegrityViolation])
    case unsupportedFormat(ExportFormat)
    case configurationError(String)

    public var errorDescription: String? {
        switch self {
        case .cancelled:
            return "Operation was cancelled"
        case .timeout(let interval):
            return "Operation timed out after \(interval) seconds"
        case .insufficientSpace(let required, let available):
            return "Insufficient space: required \(required) bytes, available \(available) bytes"
        case .integrityCheckFailed(let violations):
            return "Integrity check failed with \(violations.count) violations"
        case .unsupportedFormat(let format):
            return "Unsupported export format: \(format)"
        case .configurationError(let message):
            return "Configuration error: \(message)"
        }
    }
}

// MARK: - Helper Extensions

extension URL: @retroactive Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        guard let url = URL(string: string) else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Invalid URL string: \(string)"))
        }
        self = url
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(absoluteString)
    }
}

extension DateInterval: @retroactive Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let start = try container.decode(Date.self, forKey: .start)
        let duration = try container.decode(TimeInterval.self, forKey: .duration)
        self.init(start: start, duration: duration)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(start, forKey: .start)
        try container.encode(duration, forKey: .duration)
    }

    private enum CodingKeys: String, CodingKey {
        case start, duration
    }
}