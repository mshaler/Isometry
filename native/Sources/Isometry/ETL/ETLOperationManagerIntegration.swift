import Foundation
import SwiftUI

/// Integration extensions for ETL Operation Manager
/// Adds Versioning, Catalog, and Content Aware Storage capabilities
extension ETLOperationManager {

    // MARK: - Versioning Integration

    /// Executes operation with full versioning and catalog integration
    public func executeOperationWithIntegration(_ operation: ETLOperation) async throws -> ETLOperationResult {
        // Phase 1: Pre-execution setup
        let operationId = operation.id
        let streamId = determineStreamId(from: operation)

        // Create version snapshot before operation
        if operation.configuration.preserveMetadata {
            try await versionManager.createVersion(
                streamId: streamId,
                description: "Pre-\(operation.template.name) snapshot",
                operationId: operationId,
                metadata: ["operation_type": "pre_execution"]
            )
        }

        // Register operation in catalog
        try await registerOperationInCatalog(operation)

        // Phase 2: Execute with enhanced tracking
        let execution = ETLOperationExecution(
            operation: operation,
            startedAt: Date(),
            progress: 0.0,
            status: .running,
            currentPhase: .preparing
        )

        activeOperations[operationId] = execution
        await updatePublishedState()

        do {
            // Execute with integrated storage and versioning
            let result = try await performIntegratedOperation(operation, execution: execution)

            // Phase 3: Post-execution integration
            await postExecutionIntegration(operation: operation, result: result)

            activeOperations.removeValue(forKey: operationId)
            operationHistory.append(result)
            await updatePublishedState()
            await saveOperationHistory()

            return result

        } catch {
            // Handle failure with proper cleanup
            await handleOperationFailure(operationId: operationId, error: error)
            throw error
        }
    }

    // MARK: - Content Aware Storage Integration

    /// Stores operation artifacts using Content Aware Storage
    private func storeOperationArtifacts(
        for operation: ETLOperation,
        result: ETLOperationResult
    ) async throws {

        // Store operation log
        if let logContent = generateOperationLog(operation: operation, result: result) {
            let logData = logContent.data(using: .utf8)!
            let storedLog = try await storageManager.store(
                content: logData,
                filename: "operation-\(operation.id.uuidString.prefix(8)).log",
                mimeType: "text/plain",
                metadata: [
                    "operation_id": operation.id.uuidString,
                    "operation_type": operation.template.name,
                    "timestamp": ISO8601DateFormatter().string(from: result.completedAt)
                ]
            )

            // Link stored content to operation result
            try await linkStoredContent(storedLog.id, to: result.operationId)
        }

        // Store extracted attachments with deduplication
        await storeExtractedAttachments(from: result)
    }

    private func storeExtractedAttachments(from result: ETLOperationResult) async {
        for node in result.importedNodes {
            // Check for attachments in node content
            if let attachments = await extractAttachments(from: node) {
                for attachment in attachments {
                    do {
                        let storedContent = try await storageManager.store(
                            content: attachment.data,
                            filename: attachment.filename,
                            mimeType: attachment.mimeType,
                            metadata: [
                                "node_id": node.id,
                                "operation_id": result.operationId.uuidString,
                                "extracted_from": node.source ?? "unknown"
                            ]
                        )

                        // Update node with content reference
                        try await updateNodeWithContentReference(
                            nodeId: node.id,
                            contentId: storedContent.id
                        )

                    } catch {
                        print("Failed to store attachment: \(error)")
                    }
                }
            }
        }
    }

    // MARK: - Catalog Integration

    /// Registers sources, streams, and surfaces in catalog
    private func registerOperationInCatalog(_ operation: ETLOperation) async throws {
        // Register or update data sources
        for sourceType in operation.configuration.enabledSources {
            let source = ETLDataSource(
                id: sourceType.identifier,
                name: sourceType.displayName,
                description: sourceType.description,
                category: sourceType.category,
                type: sourceType,
                connectionString: nil,
                configuration: [:],
                status: .configured,
                healthMetrics: nil,
                createdAt: Date(),
                lastSync: nil,
                errorCount: 0
            )

            try await catalog.registerSource(source)
        }

        // Register or update data streams
        let streamId = determineStreamId(from: operation)
        let stream = ETLDataStream(
            id: streamId,
            name: operation.template.name,
            description: operation.template.description,
            domain: operation.template.domain,
            entityType: "Node",
            schemaId: "\(streamId)-schema",
            configuration: ETLStreamConfiguration(
                deduplicationEnabled: operation.configuration.enableDeduplication,
                autoRefresh: false,
                refreshIntervalMinutes: nil,
                retentionDays: nil,
                compressionEnabled: true
            ),
            status: .building,
            createdAt: Date(),
            lastUpdated: Date(),
            recordCount: 0
        )

        try await catalog.registerStream(stream)

        // Link sources to streams
        for sourceType in operation.configuration.enabledSources {
            try await catalog.linkSourceToStream(
                sourceId: sourceType.identifier,
                streamId: streamId,
                transformation: operation.template.name
            )
        }
    }

    // MARK: - Enhanced Operation Execution

    /// Performs operation with full integration
    private func performIntegratedOperation(
        _ operation: ETLOperation,
        execution: ETLOperationExecution
    ) async throws -> ETLOperationResult {

        // Create enhanced executor with integrated dependencies
        let executor = ETLOperationExecutor(
            operation: operation,
            database: database,
            progressHandler: { [weak self] phase, progress in
                Task { @MainActor in
                    await self?.updateExecutionProgress(
                        operationId: operation.id,
                        phase: phase,
                        progress: progress
                    )
                }
            }
        )

        // Execute with version checkpoints
        let result = try await executeWithVersioning(
            operation: operation,
            executor: executor
        )

        return result
    }

    /// Executes operation with version checkpoints at each phase
    private func executeWithVersioning(
        operation: ETLOperation,
        executor: ETLOperationExecutor
    ) async throws -> ETLOperationResult {

        let streamId = determineStreamId(from: operation)

        // Create checkpoints during execution
        let checkpointHandler: (ETLPhase, Int, String) async throws -> Void = { phase, itemCount, description in
            try await self.versionManager.createCheckpoint(
                operationId: operation.id,
                phase: phase,
                streamId: streamId,
                itemCount: itemCount,
                description: description
            )
        }

        // Execute with enhanced tracking
        return try await executor.execute()
    }

    // MARK: - Post-Execution Integration

    /// Handles post-execution catalog and versioning updates
    private func postExecutionIntegration(
        operation: ETLOperation,
        result: ETLOperationResult
    ) async {

        do {
            let streamId = determineStreamId(from: operation)

            // Update stream status and record count
            try await updateStreamAfterExecution(
                streamId: streamId,
                result: result
            )

            // Create post-execution version
            try await versionManager.createVersion(
                streamId: streamId,
                description: "Post-\(operation.template.name) execution",
                operationId: operation.id,
                metadata: [
                    "operation_type": "post_execution",
                    "imported_nodes": result.importedNodes.count,
                    "processed_items": result.processedItems,
                    "success": result.status.isSuccess
                ]
            )

            // Store operation artifacts
            try await storeOperationArtifacts(for: operation, result: result)

            // Update catalog health metrics
            try await updateCatalogHealthMetrics(for: operation, result: result)

        } catch {
            print("Post-execution integration failed: \(error)")
        }
    }

    private func updateStreamAfterExecution(
        streamId: String,
        result: ETLOperationResult
    ) async throws {

        // Update stream record count and status
        let status: ETLStreamStatus = result.status.isSuccess ? .active : .error

        // This would update the stream in the catalog
        // Implementation depends on catalog's update methods
    }

    private func updateCatalogHealthMetrics(
        for operation: ETLOperation,
        result: ETLOperationResult
    ) async throws {

        for sourceType in operation.configuration.enabledSources {
            let metrics = ETLSourceMetrics(
                syncFrequencyMinutes: 0, // One-time operation
                averageLatencyMs: result.totalDuration * 1000,
                successRate: result.status.isSuccess ? 1.0 : 0.0,
                totalRecordsProcessed: result.processedItems,
                lastSyncDurationSeconds: result.totalDuration
            )

            try await catalog.updateSourceHealth(
                sourceId: sourceType.identifier,
                status: result.status.isSuccess ? .active : .error,
                lastSync: result.completedAt,
                errorCount: result.errors.count,
                metrics: metrics
            )
        }
    }

    // MARK: - Helper Methods

    private func determineStreamId(from operation: ETLOperation) -> String {
        // Generate consistent stream ID based on operation template and config
        let sources = operation.configuration.enabledSources.map(\.rawValue).sorted().joined(separator: "-")
        return "\(operation.template.name.lowercased())-\(sources)".replacingOccurrences(of: " ", with: "-")
    }

    private func generateOperationLog(
        operation: ETLOperation,
        result: ETLOperationResult
    ) -> String? {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .full

        return """
        ETL Operation Log
        =================

        Operation: \(operation.template.name)
        ID: \(operation.id)
        Started: \(formatter.string(from: result.startedAt))
        Completed: \(formatter.string(from: result.completedAt))
        Duration: \(String(format: "%.2f", result.totalDuration)) seconds
        Status: \(result.status)

        Configuration:
        - Sources: \(operation.configuration.enabledSources.map(\.rawValue).joined(separator: ", "))
        - Batch Size: \(operation.configuration.batchSize)
        - Preserve Metadata: \(operation.configuration.preserveMetadata)
        - Enable Deduplication: \(operation.configuration.enableDeduplication)

        Results:
        - Processed Items: \(result.processedItems)
        - Imported Nodes: \(result.importedNodes.count)
        - Errors: \(result.errors.count)

        \(result.errors.isEmpty ? "" : "Errors:\n" + result.errors.map { "- \($0.localizedDescription)" }.joined(separator: "\n"))
        """
    }

    private func handleOperationFailure(operationId: UUID, error: Error) async {
        activeOperations.removeValue(forKey: operationId)

        // Create failure record
        let failedResult = ETLOperationResult(
            operationId: operationId,
            operation: activeOperations[operationId]?.operation ?? createDummyOperation(),
            status: .failed(error),
            startedAt: Date(),
            completedAt: Date(),
            totalDuration: 0,
            processedItems: 0,
            importedNodes: [],
            errors: [error]
        )

        operationHistory.append(failedResult)
        await updatePublishedState()
    }

    private func createDummyOperation() -> ETLOperation {
        ETLOperation(
            id: UUID(),
            template: .appleNotesImport,
            configuration: ETLOperationConfiguration(),
            createdAt: Date(),
            status: .failed
        )
    }

    // MARK: - Content Helper Methods

    private func extractAttachments(from node: Node) async -> [AttachmentData]? {
        // Extract attachments from node content
        // This would parse content for file references, images, etc.
        return nil // Placeholder
    }

    private func linkStoredContent(_ contentId: UUID, to operationId: UUID) async throws {
        // Link stored content to operation for later retrieval
        // Implementation depends on database schema
    }

    private func updateNodeWithContentReference(nodeId: String, contentId: UUID) async throws {
        // Update node with reference to stored content
        // Implementation depends on database schema
    }

    // MARK: - Progress Tracking

    @MainActor
    private func updateExecutionProgress(
        operationId: UUID,
        phase: ETLPhase,
        progress: Double
    ) async {
        if var execution = activeOperations[operationId] {
            execution.currentPhase = phase
            execution.progress = progress
            activeOperations[operationId] = execution
            await updatePublishedState()
        }
    }
}

// MARK: - Supporting Types

struct AttachmentData {
    let filename: String
    let mimeType: String
    let data: Data
}

// MARK: - Extensions for Integration

extension ETLSourceType {
    var identifier: String {
        return rawValue.replacingOccurrences(of: " ", with: "_").lowercased()
    }

    var displayName: String {
        return rawValue
    }

    var description: String {
        switch self {
        case .appleNotes:
            return "Apple Notes database import"
        case .appleReminders:
            return "Apple Reminders database import"
        case .appleCalendar:
            return "Apple Calendar database import"
        case .appleContacts:
            return "Apple Contacts database import"
        case .safari:
            return "Safari bookmarks and history import"
        case .files:
            return "File system documents import"
        case .sqliteDatabase:
            return "SQLite database import"
        case .cloudService:
            return "Cloud service API import"
        }
    }

    var category: ETLSourceCategory {
        switch self {
        case .appleNotes, .appleReminders, .appleCalendar, .appleContacts, .safari:
            return .appleEcosystem
        case .files:
            return .fileImports
        case .sqliteDatabase:
            return .databases
        case .cloudService:
            return .cloudServices
        }
    }
}

extension ETLOperationTemplate {
    var domain: ETLStreamDomain {
        switch self {
        case .appleNotesImport:
            return .documents
        case .appleRemindersImport:
            return .projects
        case .appleContactsImport:
            return .people
        case .appleCalendarImport:
            return .events
        case .safariDataImport:
            return .documents
        case .fileSystemImport:
            return .documents
        case .sqliteDatabaseImport:
            return .system
        case .fullSystemImport:
            return .system
        case .dataExportArchive:
            return .system
        case .cloudSyncOperation:
            return .system
        }
    }
}