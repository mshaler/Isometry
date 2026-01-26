import Foundation
import GRDB

/// GSD Executor Pattern implementation for ETL operations
/// Follows Get Shit Done methodology with atomic phases and checkpoint recovery
public actor ETLOperationExecutor {
    private let operation: ETLOperation
    private let database: IsometryDatabase
    private let progressHandler: (ETLPhase, Double) -> Void

    private var currentPhase: ETLPhase = .preparing
    private var processedItems: Int = 0
    private var totalItems: Int = 0
    private var importedNodes: [Node] = []
    private var errors: [Error] = []
    private var checkpoints: [ETLCheckpoint] = []

    public init(
        operation: ETLOperation,
        database: IsometryDatabase,
        progressHandler: @escaping (ETLPhase, Double) -> Void
    ) {
        self.operation = operation
        self.database = database
        self.progressHandler = progressHandler
    }

    // MARK: - Main Execution (GSD Pattern)

    public func execute() async throws -> ETLOperationResult {
        let startTime = Date()

        do {
            // Phase 1: Preparing
            try await executePhase(.preparing) {
                try await self.prepareExecution()
            }

            // Phase 2: Scanning
            try await executePhase(.scanning) {
                try await self.scanSources()
            }

            // Phase 3: Extracting
            try await executePhase(.extracting) {
                try await self.extractData()
            }

            // Phase 4: Transforming
            try await executePhase(.transforming) {
                try await self.transformData()
            }

            // Phase 5: Validating
            try await executePhase(.validating) {
                try await self.validateData()
            }

            // Phase 6: Loading
            try await executePhase(.loading) {
                try await self.loadToDatabase()
            }

            // Phase 7: Finalizing
            try await executePhase(.finalizing) {
                try await self.finalizeOperation()
            }

            let endTime = Date()
            let status: ETLResultStatus = errors.isEmpty ? .success : .partialSuccess

            return ETLOperationResult(
                operationId: operation.id,
                operation: operation,
                status: status,
                startedAt: startTime,
                completedAt: endTime,
                totalDuration: endTime.timeIntervalSince(startTime),
                processedItems: processedItems,
                importedNodes: importedNodes,
                errors: errors
            )

        } catch {
            let endTime = Date()
            errors.append(error)

            return ETLOperationResult(
                operationId: operation.id,
                operation: operation,
                status: .failed(error.localizedDescription),
                startedAt: startTime,
                completedAt: endTime,
                totalDuration: endTime.timeIntervalSince(startTime),
                processedItems: processedItems,
                importedNodes: importedNodes,
                errors: errors
            )
        }
    }

    // MARK: - Phase Execution Framework

    private func executePhase(_ phase: ETLPhase, _ work: () async throws -> Void) async throws {
        currentPhase = phase
        updateProgress(0.0)

        let checkpoint = ETLCheckpoint(
            phase: phase,
            timestamp: Date(),
            processedItems: processedItems,
            importedNodes: importedNodes.count
        )
        checkpoints.append(checkpoint)

        do {
            try await work()
            updateProgress(1.0)
        } catch {
            // Log checkpoint for potential recovery
            print("Phase \(phase.displayName) failed at checkpoint: \(checkpoint)")
            throw error
        }
    }

    private func updateProgress(_ progress: Double) {
        progressHandler(currentPhase, progress)
    }

    // MARK: - Phase 1: Preparing

    private func prepareExecution() async throws {
        updateProgress(0.2)

        // Validate operation configuration
        try validateConfiguration()
        updateProgress(0.4)

        // Check permissions
        try await checkRequiredPermissions()
        updateProgress(0.6)

        // Initialize output directories if needed
        try await createOutputDirectories()
        updateProgress(0.8)

        // Set up progress tracking
        totalItems = 0 // Will be updated during scanning
        processedItems = 0
        updateProgress(1.0)
    }

    private func validateConfiguration() throws {
        guard !operation.configuration.enabledSources.isEmpty else {
            throw ETLExecutionError.invalidConfiguration("No data sources enabled")
        }

        if operation.configuration.batchSize <= 0 {
            throw ETLExecutionError.invalidConfiguration("Invalid batch size")
        }
    }

    private func checkRequiredPermissions() async throws {
        for permission in operation.template.requiredPermissions {
            let hasPermission = await checkPermission(permission)
            if !hasPermission {
                throw ETLExecutionError.permissionDenied(permission.rawValue)
            }
        }
    }

    private func checkPermission(_ permission: ETLPermission) async -> Bool {
        // Implementation would check actual system permissions
        // For now, assume permissions are granted
        return true
    }

    private func createOutputDirectories() async throws {
        if let outputFolder = operation.configuration.outputFolder {
            let outputURL = getOutputDirectoryURL(outputFolder)
            try FileManager.default.createDirectory(
                at: outputURL,
                withIntermediateDirectories: true
            )
        }
    }

    private func getOutputDirectoryURL(_ folder: String) -> URL {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documentsPath.appendingPathComponent("Isometry").appendingPathComponent(folder)
    }

    // MARK: - Phase 2: Scanning

    private func scanSources() async throws {
        var itemCount = 0
        let sources = operation.configuration.enabledSources

        for (index, source) in sources.enumerated() {
            let sourceProgress = Double(index) / Double(sources.count)
            updateProgress(sourceProgress)

            let sourceItemCount = try await scanSource(source)
            itemCount += sourceItemCount
        }

        totalItems = itemCount
        updateProgress(1.0)
    }

    private func scanSource(_ source: ETLSourceType) async throws -> Int {
        switch source {
        case .appleNotes:
            return try await scanAppleNotes()
        case .appleReminders:
            return try await scanAppleReminders()
        case .appleCalendar:
            return try await scanAppleCalendar()
        case .appleContacts:
            return try await scanAppleContacts()
        case .safari:
            return try await scanSafariData()
        case .files:
            return try await scanFileSystem()
        case .sqliteDatabase:
            return try await scanSQLiteDatabase()
        case .cloudService:
            return try await scanCloudService()
        }
    }

    private func scanAppleNotes() async throws -> Int {
        // Use DirectAppleSyncManager to get count
        let syncManager = DirectAppleSyncManager(database: database)
        // Implementation would return count without actual import
        return 100 // Placeholder
    }

    private func scanAppleReminders() async throws -> Int {
        return 50 // Placeholder
    }

    private func scanAppleCalendar() async throws -> Int {
        return 200 // Placeholder
    }

    private func scanAppleContacts() async throws -> Int {
        return 75 // Placeholder
    }

    private func scanSafariData() async throws -> Int {
        return 150 // Placeholder
    }

    private func scanFileSystem() async throws -> Int {
        guard let outputFolder = operation.configuration.outputFolder else { return 0 }

        let directoryURL = getOutputDirectoryURL(outputFolder)
        let resourceKeys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey]

        let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: resourceKeys,
            options: [.skipsHiddenFiles]
        )

        var count = 0
        while let fileURL = enumerator?.nextObject() as? URL {
            let resourceValues = try fileURL.resourceValues(forKeys: Set(resourceKeys))
            if resourceValues.isRegularFile == true {
                let fileExtension = fileURL.pathExtension.lowercased()
                if operation.configuration.customFilters.isEmpty ||
                   operation.configuration.customFilters.contains { filter in
                       let pattern = filter.replacingOccurrences(of: "*", with: "")
                       return fileExtension.contains(pattern)
                   } {
                    count += 1
                }
            }
        }

        return count
    }

    private func scanSQLiteDatabase() async throws -> Int {
        return 500 // Placeholder
    }

    private func scanCloudService() async throws -> Int {
        return 300 // Placeholder
    }

    // MARK: - Phase 3: Extracting

    private func extractData() async throws {
        let sources = operation.configuration.enabledSources
        let batchSize = operation.configuration.batchSize

        for (sourceIndex, source) in sources.enumerated() {
            let sourceProgress = Double(sourceIndex) / Double(sources.count)
            updateProgress(sourceProgress)

            try await extractFromSource(source, batchSize: batchSize)
        }

        updateProgress(1.0)
    }

    private func extractFromSource(_ source: ETLSourceType, batchSize: Int) async throws {
        switch source {
        case .appleNotes:
            try await extractAppleNotes(batchSize: batchSize)
        case .appleReminders:
            try await extractAppleReminders(batchSize: batchSize)
        case .appleCalendar:
            try await extractAppleCalendar(batchSize: batchSize)
        case .appleContacts:
            try await extractAppleContacts(batchSize: batchSize)
        case .safari:
            try await extractSafariData(batchSize: batchSize)
        case .files:
            try await extractFiles(batchSize: batchSize)
        case .sqliteDatabase:
            try await extractSQLiteDatabase(batchSize: batchSize)
        case .cloudService:
            try await extractCloudService(batchSize: batchSize)
        }
    }

    private func extractAppleNotes(batchSize: Int) async throws {
        let syncManager = DirectAppleSyncManager(database: database)
        let syncConfig = DirectAppleSyncManager.SyncConfiguration(
            notesEnabled: true,
            remindersEnabled: false,
            calendarEnabled: false,
            contactsEnabled: false,
            safariEnabled: false,
            syncInterval: 0,
            batchSize: batchSize
        )

        // Create temporary database for extraction
        let tempDB = IsometryDatabase(path: ":memory:")!
        let tempSyncManager = DirectAppleSyncManager(database: tempDB, configuration: syncConfig)

        let result = try await tempSyncManager.performFullSync()
        processedItems += result.imported

        // Extract nodes from temp database
        let extractedNodes = try await tempDB.getAllNodes()
        importedNodes.append(contentsOf: extractedNodes)
    }

    private func extractAppleReminders(batchSize: Int) async throws {
        // Similar implementation for Reminders
        processedItems += 50 // Placeholder
    }

    private func extractAppleCalendar(batchSize: Int) async throws {
        // Similar implementation for Calendar
        processedItems += 200 // Placeholder
    }

    private func extractAppleContacts(batchSize: Int) async throws {
        // Similar implementation for Contacts
        processedItems += 75 // Placeholder
    }

    private func extractSafariData(batchSize: Int) async throws {
        // Similar implementation for Safari
        processedItems += 150 // Placeholder
    }

    private func extractFiles(batchSize: Int) async throws {
        // Use OfficeDocumentImporter for supported file types
        processedItems += 25 // Placeholder
    }

    private func extractSQLiteDatabase(batchSize: Int) async throws {
        // Use SQLiteFileImporter
        processedItems += 500 // Placeholder
    }

    private func extractCloudService(batchSize: Int) async throws {
        // CloudKit extraction implementation
        processedItems += 300 // Placeholder
    }

    // MARK: - Phase 4: Transforming

    private func transformData() async throws {
        let totalNodes = importedNodes.count

        for (index, node) in importedNodes.enumerated() {
            let progress = Double(index) / Double(totalNodes)
            updateProgress(progress)

            // Apply transformations based on operation configuration
            let transformedNode = try await transformNode(node)
            importedNodes[index] = transformedNode
        }

        updateProgress(1.0)
    }

    private func transformNode(_ node: Node) async throws -> Node {
        var transformedNode = node

        // Apply metadata preservation
        if operation.configuration.preserveMetadata {
            // Ensure all metadata is preserved
        }

        // Apply custom filters
        for filter in operation.configuration.customFilters {
            transformedNode = try applyCustomFilter(filter, to: transformedNode)
        }

        // Apply date range filtering if specified
        if let dateRange = operation.configuration.dateRange {
            let nodeDate = ISO8601DateFormatter().date(from: node.createdAt) ?? Date()
            if !dateRange.contains(nodeDate) {
                throw ETLExecutionError.filteredOut("Node outside date range")
            }
        }

        return transformedNode
    }

    private func applyCustomFilter(_ filter: String, to node: Node) throws -> Node {
        // Apply custom filter logic
        return node
    }

    // MARK: - Phase 5: Validating

    private func validateData() async throws {
        let totalNodes = importedNodes.count
        var validNodes: [Node] = []

        for (index, node) in importedNodes.enumerated() {
            let progress = Double(index) / Double(totalNodes)
            updateProgress(progress)

            do {
                try await validateNode(node)
                validNodes.append(node)
            } catch {
                errors.append(error)
                // Continue with other nodes
            }
        }

        importedNodes = validNodes
        updateProgress(1.0)
    }

    private func validateNode(_ node: Node) async throws {
        // Validate required fields
        guard !node.id.isEmpty else {
            throw ETLExecutionError.validation("Node missing ID")
        }

        guard !node.name.isEmpty else {
            throw ETLExecutionError.validation("Node missing name")
        }

        // Validate UUID format
        guard UUID(uuidString: node.id) != nil else {
            throw ETLExecutionError.validation("Invalid UUID format")
        }

        // Check for deduplication if enabled
        if operation.configuration.enableDeduplication {
            let existingNode = try await database.getNode(id: node.id)
            if existingNode != nil {
                throw ETLExecutionError.validation("Duplicate node ID: \(node.id)")
            }
        }
    }

    // MARK: - Phase 6: Loading

    private func loadToDatabase() async throws {
        let batchSize = operation.configuration.batchSize
        let totalNodes = importedNodes.count

        for i in stride(from: 0, to: totalNodes, by: batchSize) {
            let endIndex = min(i + batchSize, totalNodes)
            let batch = Array(importedNodes[i..<endIndex])

            let progress = Double(i) / Double(totalNodes)
            updateProgress(progress)

            try await loadBatch(batch)
        }

        updateProgress(1.0)
    }

    private func loadBatch(_ nodes: [Node]) async throws {
        for node in nodes {
            do {
                try await database.insert(node: node)
            } catch {
                errors.append(ETLExecutionError.databaseError("Failed to insert node \(node.id): \(error)"))
                // Continue with other nodes in batch
            }
        }
    }

    // MARK: - Phase 7: Finalizing

    private func finalizeOperation() async throws {
        updateProgress(0.2)

        // Clean up temporary files
        try await cleanupTemporaryFiles()
        updateProgress(0.4)

        // Generate operation summary
        let summary = generateOperationSummary()
        updateProgress(0.6)

        // Save operation log
        try await saveOperationLog(summary)
        updateProgress(0.8)

        // Notify completion
        await notifyOperationComplete()
        updateProgress(1.0)
    }

    private func cleanupTemporaryFiles() async throws {
        // Clean up any temporary files created during operation
    }

    private func generateOperationSummary() -> String {
        let successRate = totalItems > 0 ? (Double(importedNodes.count) / Double(totalItems)) * 100 : 0
        return """
        ETL Operation Summary
        =====================
        Operation: \(operation.template.name)
        Total Items Processed: \(processedItems)
        Nodes Imported: \(importedNodes.count)
        Errors: \(errors.count)
        Success Rate: \(String(format: "%.1f", successRate))%
        """
    }

    private func saveOperationLog(_ summary: String) async throws {
        if let outputFolder = operation.configuration.outputFolder {
            let logURL = getOutputDirectoryURL(outputFolder).appendingPathComponent("operation.log")
            try summary.write(to: logURL, atomically: true, encoding: .utf8)
        }
    }

    private func notifyOperationComplete() async {
        // Send notification or update UI
        print("ETL Operation \(operation.template.name) completed successfully")
    }
}

// MARK: - Supporting Types

public struct ETLCheckpoint: Codable {
    public let phase: ETLPhase
    public let timestamp: Date
    public let processedItems: Int
    public let importedNodes: Int
}

public enum ETLExecutionError: LocalizedError {
    case invalidConfiguration(String)
    case permissionDenied(String)
    case sourceUnavailable(String)
    case extraction(String)
    case transformation(String)
    case validation(String)
    case databaseError(String)
    case filteredOut(String)

    public var errorDescription: String? {
        switch self {
        case .invalidConfiguration(let msg):
            return "Configuration Error: \(msg)"
        case .permissionDenied(let permission):
            return "Permission Denied: \(permission)"
        case .sourceUnavailable(let source):
            return "Source Unavailable: \(source)"
        case .extraction(let msg):
            return "Extraction Error: \(msg)"
        case .transformation(let msg):
            return "Transformation Error: \(msg)"
        case .validation(let msg):
            return "Validation Error: \(msg)"
        case .databaseError(let msg):
            return "Database Error: \(msg)"
        case .filteredOut(let msg):
            return "Filtered: \(msg)"
        }
    }
}

// MARK: - Database Extension for ETL

extension IsometryDatabase {
    func getAllNodes() async throws -> [Node] {
        // Implementation to get all nodes from database
        return [] // Placeholder
    }
}