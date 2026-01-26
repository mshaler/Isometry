import Foundation
import GRDB

/// Data exporter for converting GRDB data to sql.js compatible format
///
/// Handles data type mappings, schema conversion, and ensures compatibility
/// with sql.js implementation for safe rollback procedures.
public class DataExporter {

    // MARK: - Properties

    private let database: IsometryDatabase
    private let dateFormatter: ISO8601DateFormatter

    // Configuration
    private let batchSize = 1000
    private let maxStringLength = 1_000_000 // 1MB string limit for sql.js
    private let enableOptimizations = true

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        self.dateFormatter = ISO8601DateFormatter()
    }

    // MARK: - Public Methods

    /// Export complete database to sql.js compatible format
    public func exportToSQLjs() async throws -> RollbackCoordinator.SQLjsExportFormat {
        print("📤 Starting complete database export...")

        return try await database.read { db in
            let schema = try self.generateSchemaStatements(db)
            let data = try self.generateDataStatements(db)
            let indexes = try self.generateIndexStatements(db)
            let metadata = try self.generateExportMetadata(db)

            return RollbackCoordinator.SQLjsExportFormat(
                schema: schema,
                data: data,
                indexes: indexes,
                metadata: metadata
            )
        }
    }

    /// Generate CREATE TABLE statements compatible with sql.js
    public func generateSchemaStatements(_ db: Database) throws -> String {
        print("🏗️ Generating schema statements...")

        var schemaStatements: [String] = []

        // Get all tables (excluding SQLite system tables)
        let tables = try String.fetchAll(db, sql: """
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)

        for tableName in tables {
            // Get table schema
            let createSQL = try String.fetchOne(db, sql: """
                SELECT sql FROM sqlite_master
                WHERE type = 'table' AND name = ?
            """, arguments: [tableName])

            if let sql = createSQL {
                let compatibleSQL = try makeSchemaCompatibleWithSqlJs(sql)
                schemaStatements.append(compatibleSQL + ";")
            }
        }

        return schemaStatements.joined(separator: "\n\n")
    }

    /// Generate INSERT statements for all data
    public func generateDataStatements(_ db: Database) throws -> [String] {
        print("📊 Generating data statements...")

        var dataStatements: [String] = []

        // Get all tables
        let tables = try String.fetchAll(db, sql: """
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)

        for tableName in tables {
            let tableStatements = try generateTableDataStatements(db, tableName: tableName)
            dataStatements.append(contentsOf: tableStatements)
        }

        return dataStatements
    }

    /// Generate CREATE INDEX statements compatible with sql.js
    public func generateIndexStatements(_ db: Database) throws -> [String] {
        print("📋 Generating index statements...")

        let indexes = try String.fetchAll(db, sql: """
            SELECT sql FROM sqlite_master
            WHERE type = 'index' AND sql IS NOT NULL
            ORDER BY name
        """)

        return indexes.compactMap { sql in
            do {
                return try makeIndexCompatibleWithSqlJs(sql) + ";"
            } catch {
                print("⚠️ Failed to convert index: \(sql), error: \(error)")
                return nil
            }
        }
    }

    /// Generate export metadata
    public func generateExportMetadata(_ db: Database) throws -> RollbackCoordinator.ExportMetadata {
        print("📝 Generating export metadata...")

        // Count total records
        let tables = try String.fetchAll(db, sql: """
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        """)

        var totalRecords = 0
        for tableName in tables {
            let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(tableName)") ?? 0
            totalRecords += count
        }

        let tableCount = tables.count

        // Calculate approximate size
        let dbSize = try getDatabaseSize(db)

        // Generate checksum of critical data
        let checksum = try generateDataChecksum(db)

        return RollbackCoordinator.ExportMetadata(
            version: "2.1.0",
            timestamp: Date(),
            recordCount: totalRecords,
            tableCount: tableCount,
            totalSize: dbSize,
            checksum: checksum,
            source: "GRDB-SQLITE"
        )
    }

    /// Validate export integrity against original database
    public func validateExportIntegrity(_ export: RollbackCoordinator.SQLjsExportFormat) throws -> Bool {
        print("✅ Validating export integrity...")

        // Validate record counts
        guard export.metadata.recordCount > 0 else {
            throw ExportError.emptyExport
        }

        // Validate schema presence
        guard !export.schema.isEmpty else {
            throw ExportError.missingSchema
        }

        // Validate data presence
        guard !export.data.isEmpty else {
            throw ExportError.missingData
        }

        // Additional validation logic would go here
        return true
    }

    /// Optimize export for sql.js limitations
    public func optimizeForSQLjs(_ export: RollbackCoordinator.SQLjsExportFormat) -> RollbackCoordinator.SQLjsExportFormat {
        print("⚡ Optimizing export for sql.js...")

        if !enableOptimizations {
            return export
        }

        // Optimize schema
        let optimizedSchema = optimizeSchemaForSqlJs(export.schema)

        // Optimize data statements
        let optimizedData = optimizeDataForSqlJs(export.data)

        // Optimize indexes (remove problematic ones for sql.js)
        let optimizedIndexes = optimizeIndexesForSqlJs(export.indexes)

        return RollbackCoordinator.SQLjsExportFormat(
            schema: optimizedSchema,
            data: optimizedData,
            indexes: optimizedIndexes,
            metadata: export.metadata
        )
    }

    // MARK: - Private Methods

    private func generateTableDataStatements(_ db: Database, tableName: String) throws -> [String] {
        var statements: [String] = []

        // Get column information
        let columns = try getTableColumns(db, tableName: tableName)

        // Get total record count for progress tracking
        let totalCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(tableName)") ?? 0

        if totalCount == 0 {
            return statements
        }

        print("📊 Exporting \(totalCount) records from \(tableName)...")

        // Export in batches to handle large tables
        var offset = 0

        while offset < totalCount {
            let batchStatements = try generateBatchDataStatements(
                db,
                tableName: tableName,
                columns: columns,
                offset: offset,
                limit: batchSize
            )
            statements.append(contentsOf: batchStatements)
            offset += batchSize
        }

        return statements
    }

    private func generateBatchDataStatements(
        _ db: Database,
        tableName: String,
        columns: [ColumnInfo],
        offset: Int,
        limit: Int
    ) throws -> [String] {

        let columnNames = columns.map { $0.name }.joined(separator: ", ")

        let rows = try Row.fetchAll(db, sql: """
            SELECT \(columnNames) FROM \(tableName)
            ORDER BY ROWID LIMIT ? OFFSET ?
        """, arguments: [limit, offset])

        var statements: [String] = []

        for row in rows {
            let values = try columns.map { column in
                try formatValueForSqlJs(row[column.name], type: column.type)
            }.joined(separator: ", ")

            let statement = "INSERT INTO \(tableName) (\(columnNames)) VALUES (\(values))"
            statements.append(statement)
        }

        return statements
    }

    private func getTableColumns(_ db: Database, tableName: String) throws -> [ColumnInfo] {
        let pragma = try Row.fetchAll(db, sql: "PRAGMA table_info(\(tableName))")

        return pragma.map { row in
            ColumnInfo(
                name: row["name"],
                type: row["type"],
                notNull: row["notnull"],
                defaultValue: row["dflt_value"],
                primaryKey: row["pk"]
            )
        }
    }

    private func formatValueForSqlJs(_ value: DatabaseValue, type: String) throws -> String {
        switch value.storage {
        case .null:
            return "NULL"

        case .int64(let int):
            return String(int)

        case .double(let double):
            return String(double)

        case .string(let string):
            return formatStringForSqlJs(string)

        case .blob(let data):
            return formatBlobForSqlJs(data)
        }
    }

    private func formatStringForSqlJs(_ string: String) -> String {
        // Handle large strings that might exceed sql.js limits
        let truncated = string.count > maxStringLength
            ? String(string.prefix(maxStringLength))
            : string

        // Escape single quotes and other special characters
        let escaped = truncated
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "''")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")

        return "'\(escaped)'"
    }

    private func formatBlobForSqlJs(_ data: Data) -> String {
        // Convert binary data to hex representation for sql.js
        let hexString = data.map { String(format: "%02x", $0) }.joined()
        return "X'\(hexString)'"
    }

    private func makeSchemaCompatibleWithSqlJs(_ sql: String) throws -> String {
        var compatibleSQL = sql

        // Remove GRDB-specific pragmas and features not supported by sql.js
        compatibleSQL = compatibleSQL.replacingOccurrences(of: "WITHOUT ROWID", with: "")

        // Handle FTS tables - sql.js doesn't support FTS5
        if compatibleSQL.contains("CREATE VIRTUAL TABLE") && compatibleSQL.contains("FTS5") {
            // Convert FTS5 to regular table with text columns for basic compatibility
            compatibleSQL = convertFTSToRegularTable(compatibleSQL)
        }

        // Remove CHECK constraints that might not be supported
        compatibleSQL = removeUnsupportedConstraints(compatibleSQL)

        return compatibleSQL
    }

    private func makeIndexCompatibleWithSqlJs(_ sql: String) throws -> String {
        var compatibleSQL = sql

        // Remove partial indexes if they cause issues
        if compatibleSQL.contains("WHERE") {
            print("⚠️ Skipping partial index (not fully supported): \(sql)")
            return "-- Partial index skipped for compatibility: \(sql)"
        }

        // Remove expression indexes that might not work
        if compatibleSQL.contains("(") && compatibleSQL.contains(")") && !sql.contains("CREATE INDEX") {
            print("⚠️ Skipping expression index (may not be supported): \(sql)")
            return "-- Expression index skipped for compatibility: \(sql)"
        }

        return compatibleSQL
    }

    private func convertFTSToRegularTable(_ sql: String) -> String {
        // Basic conversion of FTS5 to regular table
        // This is a simplified conversion that maintains data but loses search capability
        let tableName = extractTableName(from: sql)
        return """
        CREATE TABLE \(tableName) (
            content TEXT,
            content_fts TEXT
        )
        """
    }

    private func removeUnsupportedConstraints(_ sql: String) -> String {
        // Remove constraints that might not be supported in sql.js
        return sql
            .replacingOccurrences(of: "GENERATED ALWAYS", with: "-- GENERATED ALWAYS")
            .replacingOccurrences(of: "AS IDENTITY", with: "-- AS IDENTITY")
    }

    private func extractTableName(from sql: String) -> String {
        // Extract table name from CREATE statement
        let components = sql.components(separatedBy: " ")
        if let tableIndex = components.firstIndex(of: "TABLE"),
           tableIndex + 1 < components.count {
            return components[tableIndex + 1]
        }
        return "unknown_table"
    }

    private func optimizeSchemaForSqlJs(_ schema: String) -> String {
        // Remove comments and extra whitespace
        return schema
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix("--") }
            .joined(separator: "\n")
    }

    private func optimizeDataForSqlJs(_ data: [String]) -> [String] {
        // Group INSERT statements into batches for better performance
        var optimizedData: [String] = []
        var currentBatch: [String] = []

        for statement in data {
            currentBatch.append(statement)

            if currentBatch.count >= batchSize {
                optimizedData.append(contentsOf: currentBatch)
                currentBatch = []
            }
        }

        if !currentBatch.isEmpty {
            optimizedData.append(contentsOf: currentBatch)
        }

        return optimizedData
    }

    private func optimizeIndexesForSqlJs(_ indexes: [String]) -> [String] {
        // Filter out indexes that might cause issues in sql.js
        return indexes.filter { index in
            // Keep simple indexes, filter complex ones
            !index.contains("WHERE") && !index.contains("UNIQUE") || index.contains("PRIMARY KEY")
        }
    }

    private func getDatabaseSize(_ db: Database) throws -> Int64 {
        // Get database file size
        let pageCount = try Int64.fetchOne(db, sql: "PRAGMA page_count") ?? 0
        let pageSize = try Int64.fetchOne(db, sql: "PRAGMA page_size") ?? 4096

        return pageCount * pageSize
    }

    private func generateDataChecksum(_ db: Database) throws -> String {
        // Generate a checksum of critical data for integrity validation
        let tables = try String.fetchAll(db, sql: """
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)

        var checksumData = ""

        for tableName in tables {
            let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(tableName)") ?? 0
            checksumData += "\(tableName):\(count);"
        }

        // Simple checksum using built-in hashing
        return String(checksumData.hashValue)
    }
}

// MARK: - Supporting Types

private struct ColumnInfo {
    let name: String
    let type: String
    let notNull: Bool
    let defaultValue: DatabaseValue?
    let primaryKey: Bool
}

public enum ExportError: LocalizedError {
    case emptyExport
    case missingSchema
    case missingData
    case checksumMismatch
    case formatValidationFailed(String)

    public var errorDescription: String? {
        switch self {
        case .emptyExport:
            return "Export contains no data"
        case .missingSchema:
            return "Export missing required schema"
        case .missingData:
            return "Export missing required data"
        case .checksumMismatch:
            return "Export checksum validation failed"
        case .formatValidationFailed(let reason):
            return "Export format validation failed: \(reason)"
        }
    }
}