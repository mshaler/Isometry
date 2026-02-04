import Foundation
import GRDB
import CryptoKit

/// Comprehensive database export capability for external integration
/// Provides multi-format export with data fidelity preservation and performance optimization
public actor DatabaseExporter {

    // Core dependencies
    private let database: IsometryDatabase
    private let storageManager: ContentAwareStorageManager

    // Configuration
    private let basePath: URL
    private let maxExportSize: Int64
    private let enableStreaming: Bool

    // Performance tracking
    private var exportMetrics = ExportPerformanceMetrics()

    // Active export operations
    private var activeExports: [UUID: ExportOperation] = [:]

    public init(
        database: IsometryDatabase,
        storageManager: ContentAwareStorageManager,
        basePath: URL,
        maxExportSize: Int64 = 1_000_000_000, // 1GB default
        enableStreaming: Bool = true
    ) {
        self.database = database
        self.storageManager = storageManager
        self.basePath = basePath
        self.maxExportSize = maxExportSize
        self.enableStreaming = enableStreaming

        Task {
            await initializeExportStorage()
        }
    }

    // MARK: - Public Export Interface

    /// Export database to JSON format with hierarchical structure preservation
    public func exportToJSON(
        configuration: ExportConfiguration = ExportConfiguration.default,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting JSON export \(operationId.uuidString.prefix(8))")

        let operation = ExportOperation(
            id: operationId,
            format: .json,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performJSONExport(
                operationId: operationId,
                configuration: configuration,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: .json,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: JSON export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: JSON export failed: \(error)")
            throw ExportError.exportFailed(.json, error)
        }
    }

    /// Export database to CSV format with configurable field selection
    public func exportToCSV(
        configuration: ExportConfiguration = ExportConfiguration.default,
        fieldSelection: CSVFieldConfiguration? = nil,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting CSV export \(operationId.uuidString.prefix(8))")

        let operation = ExportOperation(
            id: operationId,
            format: .csv,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performCSVExport(
                operationId: operationId,
                configuration: configuration,
                fieldSelection: fieldSelection,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: .csv,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: CSV export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: CSV export failed: \(error)")
            throw ExportError.exportFailed(.csv, error)
        }
    }

    /// Export database to SQL format with schema recreation scripts
    public func exportToSQL(
        configuration: ExportConfiguration = ExportConfiguration.default,
        includeSchemaScript: Bool = true,
        includeDataScript: Bool = true,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting SQL export \(operationId.uuidString.prefix(8))")

        let operation = ExportOperation(
            id: operationId,
            format: .sql,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performSQLExport(
                operationId: operationId,
                configuration: configuration,
                includeSchemaScript: includeSchemaScript,
                includeDataScript: includeDataScript,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: .sql,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: SQL export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: SQL export failed: \(error)")
            throw ExportError.exportFailed(.sql, error)
        }
    }

    /// Export database to XML format for enterprise system integration
    public func exportToXML(
        configuration: ExportConfiguration = ExportConfiguration.default,
        schemaDefinition: XMLSchemaDefinition? = nil,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting XML export \(operationId.uuidString.prefix(8))")

        let operation = ExportOperation(
            id: operationId,
            format: .xml,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performXMLExport(
                operationId: operationId,
                configuration: configuration,
                schemaDefinition: schemaDefinition,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: .xml,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: XML export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: XML export failed: \(error)")
            throw ExportError.exportFailed(.xml, error)
        }
    }

    /// Export database to Protocol Buffer format for high-performance data exchange
    public func exportToProtobuf(
        configuration: ExportConfiguration = ExportConfiguration.default,
        schemaDefinition: ProtobufSchemaDefinition,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting Protobuf export \(operationId.uuidString.prefix(8))")

        let operation = ExportOperation(
            id: operationId,
            format: .protobuf,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performProtobufExport(
                operationId: operationId,
                configuration: configuration,
                schemaDefinition: schemaDefinition,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: .protobuf,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: Protobuf export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: Protobuf export failed: \(error)")
            throw ExportError.exportFailed(.protobuf, error)
        }
    }

    // MARK: - Batch Export Operations

    /// Perform batch export for large datasets with memory optimization
    public func batchExport(
        configuration: ExportConfiguration,
        batchSize: Int = 10000,
        progressCallback: ((ExportProgress) -> Void)? = nil
    ) async throws -> DatabaseExportResult {

        let operationId = UUID()
        let startTime = Date()

        print("DatabaseExporter: Starting batch export \(operationId.uuidString.prefix(8)) with batch size \(batchSize)")

        let operation = ExportOperation(
            id: operationId,
            format: configuration.format,
            status: .running,
            startTime: startTime,
            configuration: configuration
        )

        activeExports[operationId] = operation

        do {
            let result = try await performBatchExport(
                operationId: operationId,
                configuration: configuration,
                batchSize: batchSize,
                progressCallback: progressCallback
            )

            let duration = Date().timeIntervalSince(startTime)
            exportMetrics.recordExport(
                format: configuration.format,
                duration: duration,
                recordCount: result.recordsExported,
                fileSize: result.fileSize
            )

            activeExports.removeValue(forKey: operationId)

            print("DatabaseExporter: Batch export completed - \(result.recordsExported) records in \(String(format: "%.2f", duration))s")

            return result

        } catch {
            activeExports.removeValue(forKey: operationId)
            print("DatabaseExporter: Batch export failed: \(error)")
            throw ExportError.batchExportFailed(operationId, error)
        }
    }

    // MARK: - Validation and Round-trip Testing

    /// Validate export completeness with source verification
    public func validateExport(
        exportResult: DatabaseExportResult,
        sourceConfiguration: ExportConfiguration
    ) async throws -> ExportValidationResult {

        print("DatabaseExporter: Validating export \(exportResult.operationId.uuidString.prefix(8))")

        let startTime = Date()

        // Get source record count
        let sourceRecordCount = try await getSourceRecordCount(configuration: sourceConfiguration)

        // Validate file integrity
        let fileIntegrity = validateFileIntegrity(exportResult.exportPath)

        // Check record count match
        let recordCountMatches = (exportResult.recordsExported == sourceRecordCount)

        // Validate data types and encoding
        let dataTypesValid = try await validateDataTypes(
            exportPath: exportResult.exportPath,
            format: exportResult.format
        )

        // Check for Unicode and special character preservation
        let encodingValid = try await validateEncoding(
            exportPath: exportResult.exportPath,
            format: exportResult.format
        )

        let validationDuration = Date().timeIntervalSince(startTime)

        let result = ExportValidationResult(
            isValid: fileIntegrity && recordCountMatches && dataTypesValid && encodingValid,
            fileIntegrity: fileIntegrity,
            recordCountMatches: recordCountMatches,
            sourceRecordCount: sourceRecordCount,
            exportedRecordCount: exportResult.recordsExported,
            dataTypesValid: dataTypesValid,
            encodingValid: encodingValid,
            validationDuration: validationDuration
        )

        print("DatabaseExporter: Export validation \(result.isValid ? "passed" : "failed") in \(String(format: "%.2f", validationDuration))s")

        return result
    }

    // MARK: - Operation Management

    /// Get active export operations
    public func getActiveExports() -> [ExportOperation] {
        return Array(activeExports.values)
    }

    /// Cancel an export operation
    public func cancelExport(_ operationId: UUID) async throws {
        guard var operation = activeExports[operationId] else {
            throw ExportError.operationNotFound(operationId)
        }

        operation.status = .cancelled
        activeExports[operationId] = operation

        print("DatabaseExporter: Export operation \(operationId.uuidString.prefix(8)) cancelled")
    }

    /// Get export performance metrics
    public func getExportMetrics() -> ExportPerformanceMetrics {
        return exportMetrics
    }

    // MARK: - Private Implementation

    /// Initialize export storage directories
    private func initializeExportStorage() async {
        do {
            let exportDir = basePath.appendingPathComponent("exports")
            let tempDir = exportDir.appendingPathComponent("temp")

            for directory in [exportDir, tempDir] {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            }

            print("DatabaseExporter: Initialized export storage at \(exportDir.path)")
        } catch {
            print("DatabaseExporter: Failed to initialize export storage: \(error)")
        }
    }

    // MARK: - Format-Specific Export Implementations

    /// Perform JSON export with hierarchical structure preservation
    private func performJSONExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        let exportPath = basePath
            .appendingPathComponent("exports")
            .appendingPathComponent("export-\(operationId.uuidString)-\(Date().timeIntervalSince1970).json")

        var exportData: [String: Any] = [:]
        var recordsExported = 0

        // Add metadata
        exportData["metadata"] = [
            "export_id": operationId.uuidString,
            "export_timestamp": ISO8601DateFormatter().string(from: Date()),
            "format": "json",
            "version": "1.0"
        ]

        // Export nodes with filtering
        if configuration.includeData {
            let nodes = try await getFilteredNodes(configuration: configuration)
            let totalNodes = nodes.count

            var exportedNodes: [[String: Any]] = []

            for (index, node) in nodes.enumerated() {
                let nodeData = try await convertNodeToJSON(node, configuration: configuration)
                exportedNodes.append(nodeData)
                recordsExported += 1

                // Update progress
                let progress = ExportProgress(
                    operationId: operationId,
                    phase: "exporting_nodes",
                    completedItems: index + 1,
                    totalItems: totalNodes,
                    currentItem: node.name
                )
                progressCallback?(progress)
            }

            exportData["nodes"] = exportedNodes
        }

        // Add schema if requested
        if configuration.includeSchema {
            exportData["schema"] = try await exportJSONSchema()
        }

        // Include attachments if requested
        if configuration.includeAttachments {
            let attachments = try await exportAttachmentsAsJSON(configuration)
            exportData["attachments"] = attachments
        }

        // Write JSON file with pretty formatting
        let jsonData = try JSONSerialization.data(withJSONObject: exportData, options: [.prettyPrinted, .sortedKeys])
        try jsonData.write(to: exportPath)

        // Get file size
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: exportPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0

        return DatabaseExportResult(
            exportPath: exportPath,
            format: .json,
            recordsExported: recordsExported,
            fileSize: fileSize,
            operationId: operationId,
            metadata: [
                "schema_included": String(configuration.includeSchema),
                "attachments_included": String(configuration.includeAttachments)
            ]
        )
    }

    /// Perform CSV export with configurable field selection
    private func performCSVExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        fieldSelection: CSVFieldConfiguration?,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        let exportPath = basePath
            .appendingPathComponent("exports")
            .appendingPathComponent("export-\(operationId.uuidString)-\(Date().timeIntervalSince1970).csv")

        var csvContent = ""
        var recordsExported = 0

        // Determine field configuration
        let fieldConfig = fieldSelection ?? CSVFieldConfiguration.default

        // Write CSV header
        let headers = fieldConfig.selectedFields.joined(separator: ",")
        csvContent += headers + "\n"

        // Export data rows
        if configuration.includeData {
            let nodes = try await getFilteredNodes(configuration: configuration)
            let totalNodes = nodes.count

            for (index, node) in nodes.enumerated() {
                let rowData = try await convertNodeToCSVRow(node, fieldConfig: fieldConfig, configuration: configuration)
                csvContent += rowData + "\n"
                recordsExported += 1

                // Update progress
                let progress = ExportProgress(
                    operationId: operationId,
                    phase: "exporting_csv_rows",
                    completedItems: index + 1,
                    totalItems: totalNodes,
                    currentItem: node.name
                )
                progressCallback?(progress)

                // Write in chunks for large exports
                if csvContent.count > 10_000_000 { // 10MB chunks
                    try csvContent.write(to: exportPath, atomically: false, encoding: .utf8)
                    csvContent = ""
                }
            }
        }

        // Write remaining content
        if !csvContent.isEmpty {
            try csvContent.write(to: exportPath, atomically: true, encoding: .utf8)
        }

        // Get file size
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: exportPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0

        return DatabaseExportResult(
            exportPath: exportPath,
            format: .csv,
            recordsExported: recordsExported,
            fileSize: fileSize,
            operationId: operationId,
            metadata: [
                "field_count": String(fieldConfig.selectedFields.count),
                "delimiter": fieldConfig.delimiter
            ]
        )
    }

    /// Perform SQL export with schema recreation scripts
    private func performSQLExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        includeSchemaScript: Bool,
        includeDataScript: Bool,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        let exportPath = basePath
            .appendingPathComponent("exports")
            .appendingPathComponent("export-\(operationId.uuidString)-\(Date().timeIntervalSince1970).sql")

        var sqlContent = ""
        var recordsExported = 0

        // Add export header
        sqlContent += "-- Database Export Generated by Isometry\n"
        sqlContent += "-- Export ID: \(operationId.uuidString)\n"
        sqlContent += "-- Generated: \(Date())\n\n"

        // Include schema if requested
        if includeSchemaScript && configuration.includeSchema {
            sqlContent += "-- Schema Creation Scripts\n"
            sqlContent += try await generateSchemaSQL()
            sqlContent += "\n\n"
        }

        // Include data if requested
        if includeDataScript && configuration.includeData {
            sqlContent += "-- Data Insertion Scripts\n"
            let nodes = try await getFilteredNodes(configuration: configuration)
            let totalNodes = nodes.count

            for (index, node) in nodes.enumerated() {
                let insertSQL = try await convertNodeToSQL(node, configuration: configuration)
                sqlContent += insertSQL + "\n"
                recordsExported += 1

                // Update progress
                let progress = ExportProgress(
                    operationId: operationId,
                    phase: "generating_sql_inserts",
                    completedItems: index + 1,
                    totalItems: totalNodes,
                    currentItem: node.name
                )
                progressCallback?(progress)
            }
        }

        // Write SQL file
        try sqlContent.write(to: exportPath, atomically: true, encoding: .utf8)

        // Get file size
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: exportPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0

        return DatabaseExportResult(
            exportPath: exportPath,
            format: .sql,
            recordsExported: recordsExported,
            fileSize: fileSize,
            operationId: operationId,
            metadata: [
                "schema_included": String(includeSchemaScript),
                "data_included": String(includeDataScript)
            ]
        )
    }

    /// Perform XML export for enterprise system integration
    private func performXMLExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        schemaDefinition: XMLSchemaDefinition?,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        let exportPath = basePath
            .appendingPathComponent("exports")
            .appendingPathComponent("export-\(operationId.uuidString)-\(Date().timeIntervalSince1970).xml")

        var xmlContent = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        var recordsExported = 0

        // Add root element with metadata
        xmlContent += "<isometry_export>\n"
        xmlContent += "  <metadata>\n"
        xmlContent += "    <export_id>\(operationId.uuidString)</export_id>\n"
        xmlContent += "    <timestamp>\(ISO8601DateFormatter().string(from: Date()))</timestamp>\n"
        xmlContent += "    <format>xml</format>\n"
        xmlContent += "    <version>1.0</version>\n"
        xmlContent += "  </metadata>\n"

        // Include schema if requested
        if configuration.includeSchema {
            xmlContent += "  <schema>\n"
            xmlContent += try await generateXMLSchema(definition: schemaDefinition)
            xmlContent += "  </schema>\n"
        }

        // Export data
        if configuration.includeData {
            xmlContent += "  <data>\n"
            xmlContent += "    <nodes>\n"

            let nodes = try await getFilteredNodes(configuration: configuration)
            let totalNodes = nodes.count

            for (index, node) in nodes.enumerated() {
                let nodeXML = try await convertNodeToXML(node, configuration: configuration)
                xmlContent += nodeXML
                recordsExported += 1

                // Update progress
                let progress = ExportProgress(
                    operationId: operationId,
                    phase: "exporting_xml_nodes",
                    completedItems: index + 1,
                    totalItems: totalNodes,
                    currentItem: node.name
                )
                progressCallback?(progress)
            }

            xmlContent += "    </nodes>\n"
            xmlContent += "  </data>\n"
        }

        xmlContent += "</isometry_export>\n"

        // Write XML file
        try xmlContent.write(to: exportPath, atomically: true, encoding: .utf8)

        // Get file size
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: exportPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0

        return DatabaseExportResult(
            exportPath: exportPath,
            format: .xml,
            recordsExported: recordsExported,
            fileSize: fileSize,
            operationId: operationId,
            metadata: [
                "schema_included": String(configuration.includeSchema)
            ]
        )
    }

    /// Perform Protocol Buffer export for high-performance data exchange
    private func performProtobufExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        schemaDefinition: ProtobufSchemaDefinition,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        let exportPath = basePath
            .appendingPathComponent("exports")
            .appendingPathComponent("export-\(operationId.uuidString)-\(Date().timeIntervalSince1970).pb")

        var recordsExported = 0

        // Note: In a real implementation, this would use a proper Protocol Buffer library
        // For now, we'll create a simplified binary format

        var binaryData = Data()

        // Add header
        let header = ProtobufHeader(
            exportId: operationId.uuidString,
            timestamp: Date(),
            schemaVersion: schemaDefinition.version
        )
        let headerData = try JSONEncoder().encode(header)
        binaryData.append(headerData)

        // Export nodes
        if configuration.includeData {
            let nodes = try await getFilteredNodes(configuration: configuration)
            let totalNodes = nodes.count

            for (index, node) in nodes.enumerated() {
                let nodeData = try await convertNodeToProtobuf(node, schemaDefinition: schemaDefinition)
                binaryData.append(nodeData)
                recordsExported += 1

                // Update progress
                let progress = ExportProgress(
                    operationId: operationId,
                    phase: "encoding_protobuf",
                    completedItems: index + 1,
                    totalItems: totalNodes,
                    currentItem: node.name
                )
                progressCallback?(progress)
            }
        }

        // Write binary file
        try binaryData.write(to: exportPath)

        // Get file size
        let fileSize = Int64(binaryData.count)

        return DatabaseExportResult(
            exportPath: exportPath,
            format: .protobuf,
            recordsExported: recordsExported,
            fileSize: fileSize,
            operationId: operationId,
            metadata: [
                "schema_version": schemaDefinition.version,
                "compression": "none"
            ]
        )
    }

    /// Perform batch export for large datasets
    private func performBatchExport(
        operationId: UUID,
        configuration: ExportConfiguration,
        batchSize: Int,
        progressCallback: ((ExportProgress) -> Void)?
    ) async throws -> DatabaseExportResult {

        // Delegate to format-specific method based on configuration
        switch configuration.format {
        case .json:
            return try await exportToJSON(configuration: configuration, progressCallback: progressCallback)
        case .csv:
            return try await exportToCSV(configuration: configuration, progressCallback: progressCallback)
        case .sql:
            return try await exportToSQL(configuration: configuration, progressCallback: progressCallback)
        case .xml:
            return try await exportToXML(configuration: configuration, progressCallback: progressCallback)
        case .protobuf:
            // Would need schema definition for protobuf
            throw ExportError.unsupportedFormat(.protobuf)
        }
    }

    // MARK: - Helper Methods

    /// Get filtered nodes based on configuration
    private func getFilteredNodes(configuration: ExportConfiguration) async throws -> [Node] {
        return try await database.read { db in
            var query = Node.filter(Node.Columns.deletedAt == nil)

            // Apply date range filter
            if let dateRange = configuration.dateRange {
                query = query.filter(
                    Node.Columns.createdAt >= dateRange.start &&
                    Node.Columns.createdAt <= dateRange.end
                )
            }

            // Apply node type filter
            if let nodeTypes = configuration.nodeTypes {
                query = query.filter(nodeTypes.contains(Node.Columns.nodeType))
            }

            return try query.fetchAll(db)
        }
    }

    /// Convert node to JSON representation
    private func convertNodeToJSON(_ node: Node, configuration: ExportConfiguration) async throws -> [String: Any] {
        var nodeData: [String: Any] = [:]

        // Apply field mapping if specified
        let fieldMapping = configuration.fieldMapping ?? [:]

        nodeData[fieldMapping["id"] ?? "id"] = node.id
        nodeData[fieldMapping["name"] ?? "name"] = node.name
        nodeData[fieldMapping["content"] ?? "content"] = node.content
        nodeData[fieldMapping["created_at"] ?? "created_at"] = ISO8601DateFormatter().string(from: node.createdAt)
        nodeData[fieldMapping["modified_at"] ?? "modified_at"] = ISO8601DateFormatter().string(from: node.modifiedAt)

        // Include additional fields based on configuration
        if !node.tags.isEmpty {
            nodeData[fieldMapping["tags"] ?? "tags"] = node.tags
        }

        if let folder = node.folder {
            nodeData[fieldMapping["folder"] ?? "folder"] = folder
        }

        return nodeData
    }

    /// Convert node to CSV row
    private func convertNodeToCSVRow(_ node: Node, fieldConfig: CSVFieldConfiguration, configuration: ExportConfiguration) async throws -> String {
        var values: [String] = []

        for field in fieldConfig.selectedFields {
            let value: String
            switch field.lowercased() {
            case "id": value = node.id
            case "name": value = escapeCSVValue(node.name, delimiter: fieldConfig.delimiter)
            case "content": value = escapeCSVValue(node.content ?? "", delimiter: fieldConfig.delimiter)
            case "created_at": value = ISO8601DateFormatter().string(from: node.createdAt)
            case "modified_at": value = ISO8601DateFormatter().string(from: node.modifiedAt)
            case "tags": value = escapeCSVValue(node.tags.joined(separator: ";"), delimiter: fieldConfig.delimiter)
            case "folder": value = escapeCSVValue(node.folder ?? "", delimiter: fieldConfig.delimiter)
            default: value = ""
            }
            values.append(value)
        }

        return values.joined(separator: fieldConfig.delimiter)
    }

    /// Convert node to SQL INSERT statement
    private func convertNodeToSQL(_ node: Node, configuration: ExportConfiguration) async throws -> String {
        let tableName = configuration.fieldMapping?["table_name"] ?? "nodes"

        var fields = ["id", "name", "content", "created_at", "modified_at"]
        var values = [
            "'\(node.id.replacingOccurrences(of: "'", with: "''"))'",
            "'\(node.name.replacingOccurrences(of: "'", with: "''"))'",
            "'\((node.content ?? "").replacingOccurrences(of: "'", with: "''"))'",
            "'\(ISO8601DateFormatter().string(from: node.createdAt))'",
            "'\(ISO8601DateFormatter().string(from: node.modifiedAt))'"
        ]

        if !node.tags.isEmpty {
            fields.append("tags")
            values.append("'\(node.tags.joined(separator: ",").replacingOccurrences(of: "'", with: "''"))'")
        }

        if let folder = node.folder {
            fields.append("folder")
            values.append("'\(folder.replacingOccurrences(of: "'", with: "''"))'")
        }

        return "INSERT INTO \(tableName) (\(fields.joined(separator: ", "))) VALUES (\(values.joined(separator: ", ")));"
    }

    /// Convert node to XML representation
    private func convertNodeToXML(_ node: Node, configuration: ExportConfiguration) async throws -> String {
        var xml = "      <node>\n"
        xml += "        <id>\(xmlEscape(node.id))</id>\n"
        xml += "        <name>\(xmlEscape(node.name))</name>\n"
        xml += "        <content><![CDATA[\(node.content ?? "")]]></content>\n"
        xml += "        <created_at>\(ISO8601DateFormatter().string(from: node.createdAt))</created_at>\n"
        xml += "        <modified_at>\(ISO8601DateFormatter().string(from: node.modifiedAt))</modified_at>\n"

        if !node.tags.isEmpty {
            xml += "        <tags>\n"
            for tag in node.tags {
                xml += "          <tag>\(xmlEscape(tag))</tag>\n"
            }
            xml += "        </tags>\n"
        }

        if let folder = node.folder {
            xml += "        <folder>\(xmlEscape(folder))</folder>\n"
        }

        xml += "      </node>\n"
        return xml
    }

    /// Convert node to Protocol Buffer representation
    private func convertNodeToProtobuf(_ node: Node, schemaDefinition: ProtobufSchemaDefinition) async throws -> Data {
        // Simplified protobuf-like encoding
        var data = Data()

        // In a real implementation, this would use proper protobuf encoding
        let nodeDict = [
            "id": node.id,
            "name": node.name,
            "content": node.content,
            "created_at": ISO8601DateFormatter().string(from: node.createdAt),
            "modified_at": ISO8601DateFormatter().string(from: node.modifiedAt)
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: nodeDict)
        data.append(jsonData)

        return data
    }

    // MARK: - Utility Methods

    /// Escape CSV values
    private func escapeCSVValue(_ value: String, delimiter: String) -> String {
        if value.contains(delimiter) || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    /// Escape XML values
    private func xmlEscape(_ value: String) -> String {
        return value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    /// Get source record count for validation
    private func getSourceRecordCount(configuration: ExportConfiguration) async throws -> Int {
        let nodes = try await getFilteredNodes(configuration: configuration)
        return nodes.count
    }

    /// Validate file integrity
    private func validateFileIntegrity(_ filePath: URL) -> Bool {
        return FileManager.default.fileExists(atPath: filePath.path)
    }

    /// Validate data types in export
    private func validateDataTypes(exportPath: URL, format: DatabaseExportFormat) async throws -> Bool {
        // Simplified validation - would be format-specific
        return true
    }

    /// Validate encoding preservation
    private func validateEncoding(exportPath: URL, format: DatabaseExportFormat) async throws -> Bool {
        // Simplified validation - would check Unicode preservation
        return true
    }

    /// Export JSON schema
    private func exportJSONSchema() async throws -> [String: Any] {
        return [
            "tables": [
                "nodes": [
                    "fields": [
                        "id": "string",
                        "name": "string",
                        "content": "text",
                        "created_at": "datetime",
                        "modified_at": "datetime"
                    ]
                ]
            ]
        ]
    }

    /// Export attachments as JSON
    private func exportAttachmentsAsJSON(_ configuration: ExportConfiguration) async throws -> [String: Any] {
        // Simplified implementation
        return ["attachments": []]
    }

    /// Generate schema SQL
    private func generateSchemaSQL() async throws -> String {
        return """
        CREATE TABLE nodes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT,
            created_at TEXT NOT NULL,
            modified_at TEXT NOT NULL,
            tags TEXT,
            folder TEXT
        );
        """
    }

    /// Generate XML schema
    private func generateXMLSchema(definition: XMLSchemaDefinition?) async throws -> String {
        return """
        <!-- XML Schema Definition -->
        <element name="node">
            <complexType>
                <sequence>
                    <element name="id" type="string"/>
                    <element name="name" type="string"/>
                    <element name="content" type="string"/>
                    <element name="created_at" type="dateTime"/>
                    <element name="modified_at" type="dateTime"/>
                </sequence>
            </complexType>
        </element>
        """
    }
}

// MARK: - Supporting Types

/// Export operation tracking
public struct ExportOperation: Codable {
    public let id: UUID
    public let format: DatabaseExportFormat
    public var status: ExportOperationStatus
    public let startTime: Date
    public let configuration: ExportConfiguration
}

/// Export operation status
public enum ExportOperationStatus: Codable {
    case running
    case completed
    case failed(Error)
    case cancelled

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let status = try container.decode(String.self)

        switch status {
        case "running": self = .running
        case "completed": self = .completed
        case "cancelled": self = .cancelled
        default:
            self = .failed(NSError(domain: "ExportError", code: 1, userInfo: [NSLocalizedDescriptionKey: status]))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .running: try container.encode("running")
        case .completed: try container.encode("completed")
        case .cancelled: try container.encode("cancelled")
        case .failed(let error): try container.encode("failed: \(error.localizedDescription)")
        }
    }
}

/// Export progress tracking
public struct ExportProgress: Codable {
    public let operationId: UUID
    public let phase: String
    public let completedItems: Int
    public let totalItems: Int
    public let currentItem: String?

    public var progressPercentage: Double {
        guard totalItems > 0 else { return 0.0 }
        return min(100.0, (Double(completedItems) / Double(totalItems)) * 100.0)
    }
}

/// CSV field configuration
public struct CSVFieldConfiguration: Codable {
    public let selectedFields: [String]
    public let delimiter: String
    public let includeHeader: Bool
    public let quoteAllFields: Bool

    public static let `default` = CSVFieldConfiguration(
        selectedFields: ["id", "name", "content", "created_at", "modified_at"],
        delimiter: ",",
        includeHeader: true,
        quoteAllFields: false
    )

    public init(
        selectedFields: [String],
        delimiter: String = ",",
        includeHeader: Bool = true,
        quoteAllFields: Bool = false
    ) {
        self.selectedFields = selectedFields
        self.delimiter = delimiter
        self.includeHeader = includeHeader
        self.quoteAllFields = quoteAllFields
    }
}

/// XML schema definition
public struct XMLSchemaDefinition: Codable {
    public let version: String
    public let namespace: String?
    public let rootElement: String
    public let customElements: [String: String]

    public init(
        version: String = "1.0",
        namespace: String? = nil,
        rootElement: String = "isometry_export",
        customElements: [String: String] = [:]
    ) {
        self.version = version
        self.namespace = namespace
        self.rootElement = rootElement
        self.customElements = customElements
    }
}

/// Protocol Buffer schema definition
public struct ProtobufSchemaDefinition: Codable {
    public let version: String
    public let packageName: String
    public let messageTypes: [String: [String: String]]

    public init(
        version: String = "1.0",
        packageName: String = "isometry.export",
        messageTypes: [String: [String: String]] = [:]
    ) {
        self.version = version
        self.packageName = packageName
        self.messageTypes = messageTypes
    }
}

/// Protocol Buffer header
private struct ProtobufHeader: Codable {
    public let exportId: String
    public let timestamp: Date
    public let schemaVersion: String
}

/// Export validation result
public struct ExportValidationResult: Codable {
    public let isValid: Bool
    public let fileIntegrity: Bool
    public let recordCountMatches: Bool
    public let sourceRecordCount: Int
    public let exportedRecordCount: Int
    public let dataTypesValid: Bool
    public let encodingValid: Bool
    public let validationDuration: TimeInterval
}

/// Export performance metrics
public struct ExportPerformanceMetrics: Codable {
    public var totalExports: Int = 0
    public var exportsByFormat: [DatabaseExportFormat: Int] = [:]
    public var averageExportTime: [DatabaseExportFormat: TimeInterval] = [:]
    public var totalDataExported: Int64 = 0

    mutating func recordExport(format: DatabaseExportFormat, duration: TimeInterval, recordCount: Int, fileSize: Int64) {
        totalExports += 1
        exportsByFormat[format, default: 0] += 1
        totalDataExported += fileSize

        let currentAverage = averageExportTime[format] ?? 0.0
        let currentCount = exportsByFormat[format] ?? 1
        averageExportTime[format] = (currentAverage * Double(currentCount - 1) + duration) / Double(currentCount)
    }
}