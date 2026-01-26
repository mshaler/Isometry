import Foundation
import GRDB

/// GSD-based versioning system for ETL operations and data lineage
/// Tracks version evolution across Sources → Streams → Surfaces pipeline
public actor ETLVersionManager {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Version Creation and Management

    /// Creates a new version snapshot for a given stream
    public func createVersion(
        streamId: String,
        description: String,
        operationId: UUID? = nil,
        metadata: [String: Any] = [:]
    ) async throws -> ETLDataVersion {
        let version = ETLDataVersion(
            id: UUID(),
            streamId: streamId,
            versionNumber: try await getNextVersionNumber(for: streamId),
            description: description,
            createdAt: Date(),
            createdBy: operationId,
            metadata: metadata,
            status: .active
        )

        try await database.insert(version: version)
        return version
    }

    /// Tags a specific version for easy reference
    public func tagVersion(
        versionId: UUID,
        tag: String,
        description: String? = nil
    ) async throws {
        let versionTag = ETLVersionTag(
            id: UUID(),
            versionId: versionId,
            tag: tag,
            description: description,
            createdAt: Date()
        )

        try await database.insert(versionTag: versionTag)
    }

    /// Gets the current active version for a stream
    public func getCurrentVersion(for streamId: String) async throws -> ETLDataVersion? {
        return try await database.getCurrentVersion(for: streamId)
    }

    /// Lists all versions for a stream
    public func getVersionHistory(for streamId: String) async throws -> [ETLDataVersion] {
        return try await database.getVersionHistory(for: streamId)
    }

    /// Creates a checkpoint during ETL operations
    public func createCheckpoint(
        operationId: UUID,
        phase: ETLPhase,
        streamId: String,
        itemCount: Int,
        description: String
    ) async throws {
        let checkpoint = ETLVersionCheckpoint(
            id: UUID(),
            operationId: operationId,
            streamId: streamId,
            phase: phase,
            itemCount: itemCount,
            description: description,
            createdAt: Date()
        )

        try await database.insert(checkpoint: checkpoint)
    }

    // MARK: - Version Comparison and Lineage

    /// Compares two versions and returns differences
    public func compareVersions(
        from fromVersionId: UUID,
        to toVersionId: UUID
    ) async throws -> ETLVersionDiff {
        let fromVersion = try await database.getVersion(id: fromVersionId)
        let toVersion = try await database.getVersion(id: toVersionId)

        guard let fromVersion = fromVersion, let toVersion = toVersion else {
            throw ETLVersionError.versionNotFound
        }

        // Get node counts for each version
        let fromCount = try await database.getNodeCount(for: fromVersion.streamId, at: fromVersion.createdAt)
        let toCount = try await database.getNodeCount(for: toVersion.streamId, at: toVersion.createdAt)

        return ETLVersionDiff(
            fromVersion: fromVersion,
            toVersion: toVersion,
            addedNodes: max(0, toCount - fromCount),
            removedNodes: max(0, fromCount - toCount),
            modifiedNodes: try await getModifiedNodeCount(from: fromVersion, to: toVersion)
        )
    }

    /// Tracks data lineage for a specific node
    public func getNodeLineage(nodeId: String) async throws -> [ETLLineageEntry] {
        return try await database.getNodeLineage(nodeId: nodeId)
    }

    // MARK: - Schema Versioning Integration

    /// Records schema changes during ETL operations
    public func recordSchemaChange(
        streamId: String,
        changeType: ETLSchemaChangeType,
        description: String,
        operationId: UUID? = nil
    ) async throws {
        let schemaChange = ETLSchemaChange(
            id: UUID(),
            streamId: streamId,
            changeType: changeType,
            description: description,
            operationId: operationId,
            appliedAt: Date()
        )

        try await database.insert(schemaChange: schemaChange)
    }

    // MARK: - Private Helpers

    private func getNextVersionNumber(for streamId: String) async throws -> Int {
        let lastVersion = try await database.getLastVersionNumber(for: streamId)
        return (lastVersion ?? 0) + 1
    }

    private func getModifiedNodeCount(from: ETLDataVersion, to: ETLDataVersion) async throws -> Int {
        // Compare modification timestamps between versions
        return try await database.getModifiedNodeCount(
            streamId: from.streamId,
            fromTime: from.createdAt,
            toTime: to.createdAt
        )
    }
}

// MARK: - Supporting Types

// Type-safe ETL metadata
public struct ETLMetadata: Codable, Sendable {
    public let stringValues: [String: String]
    public let numericValues: [String: Double]
    public let booleanValues: [String: Bool]
    public let dateValues: [String: Date]

    public init(stringValues: [String: String] = [:], numericValues: [String: Double] = [:], booleanValues: [String: Bool] = [:], dateValues: [String: Date] = [:]) {
        self.stringValues = stringValues
        self.numericValues = numericValues
        self.booleanValues = booleanValues
        self.dateValues = dateValues
    }
}

public struct ETLDataVersion: Codable, Sendable {
    public let id: UUID
    public let streamId: String
    public let versionNumber: Int
    public let description: String
    public let createdAt: Date
    public let createdBy: UUID? // ETL Operation ID
    public let metadata: ETLMetadata
    public let status: ETLVersionStatus

    public init(
        id: UUID,
        streamId: String,
        versionNumber: Int,
        description: String,
        createdAt: Date,
        createdBy: UUID? = nil,
        metadata: ETLMetadata = ETLMetadata(),
        status: ETLVersionStatus = .active
    ) {
        self.id = id
        self.streamId = streamId
        self.versionNumber = versionNumber
        self.description = description
        self.createdAt = createdAt
        self.createdBy = createdBy
        self.metadata = metadata
        self.status = status
    }
}

public enum ETLVersionStatus: String, Codable, CaseIterable, Sendable {
    case active = "active"
    case archived = "archived"
    case deprecated = "deprecated"
    case failed = "failed"
}

public struct ETLVersionTag: Codable, Sendable {
    public let id: UUID
    public let versionId: UUID
    public let tag: String
    public let description: String?
    public let createdAt: Date
}

public struct ETLVersionCheckpoint: Codable, Sendable {
    public let id: UUID
    public let operationId: UUID
    public let streamId: String
    public let phase: ETLPhase
    public let itemCount: Int
    public let description: String
    public let createdAt: Date
}

public struct ETLVersionDiff: Sendable {
    public let fromVersion: ETLDataVersion
    public let toVersion: ETLDataVersion
    public let addedNodes: Int
    public let removedNodes: Int
    public let modifiedNodes: Int

    public var totalChanges: Int {
        addedNodes + removedNodes + modifiedNodes
    }

    public var changePercentage: Double {
        let baseCount = max(1, try! fromVersion.metadata["nodeCount"] as? Int ?? 1)
        return Double(totalChanges) / Double(baseCount) * 100
    }
}

// Type-safe lineage changes
public struct ETLLineageChanges: Codable, Sendable {
    public let fieldChanges: [String: String]
    public let valueChanges: [String: String]
    public let metadataChanges: [String: String]

    public init(fieldChanges: [String: String] = [:], valueChanges: [String: String] = [:], metadataChanges: [String: String] = [:]) {
        self.fieldChanges = fieldChanges
        self.valueChanges = valueChanges
        self.metadataChanges = metadataChanges
    }
}

public struct ETLLineageEntry: Codable, Sendable {
    public let nodeId: String
    public let operationId: UUID
    public let operationType: String
    public let sourceSystem: String
    public let versionId: UUID
    public let timestamp: Date
    public let changes: ETLLineageChanges
}

public struct ETLSchemaChange: Codable, Sendable {
    public let id: UUID
    public let streamId: String
    public let changeType: ETLSchemaChangeType
    public let description: String
    public let operationId: UUID?
    public let appliedAt: Date
}

public enum ETLSchemaChangeType: String, Codable, CaseIterable, Sendable {
    case addColumn = "add_column"
    case removeColumn = "remove_column"
    case modifyColumn = "modify_column"
    case addIndex = "add_index"
    case removeIndex = "remove_index"
    case addConstraint = "add_constraint"
    case removeConstraint = "remove_constraint"
    case migration = "migration"
}

public enum ETLVersionError: LocalizedError {
    case versionNotFound
    case invalidStreamId
    case duplicateTag
    case schemaConflict

    public var errorDescription: String? {
        switch self {
        case .versionNotFound:
            return "Version not found"
        case .invalidStreamId:
            return "Invalid stream identifier"
        case .duplicateTag:
            return "Version tag already exists"
        case .schemaConflict:
            return "Schema version conflict detected"
        }
    }
}

// MARK: - Database Extensions for Versioning

extension IsometryDatabase {
    func insert(version: ETLDataVersion) async throws {
        try await writer.write { db in
            try db.execute(
                sql: """
                    INSERT INTO etl_versions (
                        id, stream_id, version_number, description, created_at,
                        created_by, metadata, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    version.id.uuidString,
                    version.streamId,
                    version.versionNumber,
                    version.description,
                    ISO8601DateFormatter().string(from: version.createdAt),
                    version.createdBy?.uuidString,
                    try JSONSerialization.data(withJSONObject: version.metadata),
                    version.status.rawValue
                ]
            )
        }
    }

    func insert(versionTag: ETLVersionTag) async throws {
        try await writer.write { db in
            try db.execute(
                sql: """
                    INSERT INTO etl_version_tags (
                        id, version_id, tag, description, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: [
                    versionTag.id.uuidString,
                    versionTag.versionId.uuidString,
                    versionTag.tag,
                    versionTag.description,
                    ISO8601DateFormatter().string(from: versionTag.createdAt)
                ]
            )
        }
    }

    func insert(checkpoint: ETLVersionCheckpoint) async throws {
        try await writer.write { db in
            try db.execute(
                sql: """
                    INSERT INTO etl_version_checkpoints (
                        id, operation_id, stream_id, phase, item_count,
                        description, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    checkpoint.id.uuidString,
                    checkpoint.operationId.uuidString,
                    checkpoint.streamId,
                    checkpoint.phase.rawValue,
                    checkpoint.itemCount,
                    checkpoint.description,
                    ISO8601DateFormatter().string(from: checkpoint.createdAt)
                ]
            )
        }
    }

    func insert(schemaChange: ETLSchemaChange) async throws {
        try await writer.write { db in
            try db.execute(
                sql: """
                    INSERT INTO etl_schema_changes (
                        id, stream_id, change_type, description, operation_id, applied_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    schemaChange.id.uuidString,
                    schemaChange.streamId,
                    schemaChange.changeType.rawValue,
                    schemaChange.description,
                    schemaChange.operationId?.uuidString,
                    ISO8601DateFormatter().string(from: schemaChange.appliedAt)
                ]
            )
        }
    }

    func getCurrentVersion(for streamId: String) async throws -> ETLDataVersion? {
        return try await reader.read { db in
            let sql = """
                SELECT * FROM etl_versions
                WHERE stream_id = ? AND status = 'active'
                ORDER BY version_number DESC
                LIMIT 1
                """
            return try ETLDataVersion.fetchOne(db, sql: sql, arguments: [streamId])
        }
    }

    func getVersionHistory(for streamId: String) async throws -> [ETLDataVersion] {
        return try await reader.read { db in
            let sql = """
                SELECT * FROM etl_versions
                WHERE stream_id = ?
                ORDER BY version_number DESC
                """
            return try ETLDataVersion.fetchAll(db, sql: sql, arguments: [streamId])
        }
    }

    func getVersion(id: UUID) async throws -> ETLDataVersion? {
        return try await reader.read { db in
            try ETLDataVersion.fetchOne(db, id: id.uuidString)
        }
    }

    func getLastVersionNumber(for streamId: String) async throws -> Int? {
        return try await reader.read { db in
            let sql = "SELECT MAX(version_number) FROM etl_versions WHERE stream_id = ?"
            return try Int.fetchOne(db, sql: sql, arguments: [streamId])
        }
    }

    func getNodeCount(for streamId: String, at timestamp: Date) async throws -> Int {
        return try await reader.read { db in
            let sql = """
                SELECT COUNT(*) FROM nodes
                WHERE source = ? AND created_at <= ?
                """
            return try Int.fetchOne(db, sql: sql, arguments: [streamId, ISO8601DateFormatter().string(from: timestamp)]) ?? 0
        }
    }

    func getModifiedNodeCount(streamId: String, fromTime: Date, toTime: Date) async throws -> Int {
        return try await reader.read { db in
            let sql = """
                SELECT COUNT(*) FROM nodes
                WHERE source = ? AND modified_at > ? AND modified_at <= ?
                """
            return try Int.fetchOne(db, sql: sql, arguments: [
                streamId,
                ISO8601DateFormatter().string(from: fromTime),
                ISO8601DateFormatter().string(from: toTime)
            ]) ?? 0
        }
    }

    func getNodeLineage(nodeId: String) async throws -> [ETLLineageEntry] {
        return try await reader.read { db in
            let sql = """
                SELECT
                    n.id as node_id,
                    vc.operation_id,
                    'ETL' as operation_type,
                    n.source as source_system,
                    v.id as version_id,
                    vc.created_at as timestamp,
                    '{}' as changes
                FROM nodes n
                JOIN etl_versions v ON n.source = v.stream_id
                JOIN etl_version_checkpoints vc ON v.id = vc.stream_id
                WHERE n.id = ?
                ORDER BY vc.created_at DESC
                """
            return try ETLLineageEntry.fetchAll(db, sql: sql, arguments: [nodeId])
        }
    }
}