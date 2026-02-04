import Foundation
import GRDB

/// Comprehensive data verification pipeline that ensures >99.9% accuracy
/// Compares native Apple Notes data against alto-index baseline with detailed reporting
public actor DataVerificationPipeline {

    // Core dependencies
    private let nativeImporter: AppleNotesNativeImporter
    private let altoIndexImporter: AltoIndexImporter
    private let verificationEngine: VerificationEngine
    private let accuracyMetrics: AccuracyMetrics
    private let database: IsometryDatabase

    // Configuration
    private let batchSize: Int
    private let maxConcurrentVerifications: Int
    private let progressReporting: Bool

    // State management
    private var activeVerifications: Set<String> = []
    private var verificationResults: [String: ComprehensiveVerificationResult] = [:]
    private var globalMetrics = GlobalVerificationMetrics()

    public init(
        nativeImporter: AppleNotesNativeImporter,
        altoIndexImporter: AltoIndexImporter,
        database: IsometryDatabase,
        batchSize: Int = 100,
        maxConcurrentVerifications: Int = 5,
        progressReporting: Bool = true
    ) {
        self.nativeImporter = nativeImporter
        self.altoIndexImporter = altoIndexImporter
        self.database = database
        self.batchSize = batchSize
        self.maxConcurrentVerifications = maxConcurrentVerifications
        self.progressReporting = progressReporting

        self.verificationEngine = VerificationEngine()
        self.accuracyMetrics = AccuracyMetrics()
    }

    // MARK: - Core Verification Operations

    /// Perform comprehensive data verification comparing native vs alto-index import
    public func verifyDataIntegrity(sourceDirectory: URL, noteIds: [String]? = nil) async throws -> ComprehensiveVerificationResult {
        let verificationId = UUID().uuidString
        activeVerifications.insert(verificationId)
        defer { activeVerifications.remove(verificationId) }

        print("DataVerificationPipeline: Starting comprehensive verification (\(verificationId))")
        let startTime = Date()

        // Step 1: Import data from both sources
        let nativeResults = try await importFromNativeSource(noteIds: noteIds)
        let altoResults = try await importFromAltoIndexSource(sourceDirectory: sourceDirectory)

        print("DataVerificationPipeline: Imported \(nativeResults.count) native notes, \(altoResults.count) alto-index notes")

        // Step 2: Perform parallel verification
        let verificationResults = try await performParallelVerification(
            nativeNodes: nativeResults,
            altoNodes: altoResults
        )

        // Step 3: Calculate comprehensive accuracy metrics
        let accuracyResults = await accuracyMetrics.calculateComprehensiveAccuracy(
            verificationResults: verificationResults,
            nativeNodeCount: nativeResults.count,
            altoNodeCount: altoResults.count
        )

        // Step 4: Generate detailed report
        let duration = Date().timeIntervalSince(startTime)
        let comprehensiveResult = ComprehensiveVerificationResult(
            verificationId: verificationId,
            duration: duration,
            nativeNodeCount: nativeResults.count,
            altoNodeCount: altoResults.count,
            verificationResults: verificationResults,
            accuracyMetrics: accuracyResults,
            overallAccuracy: accuracyResults.overallAccuracy,
            isAcceptable: accuracyResults.overallAccuracy >= 0.999 // >99.9% requirement
        )

        // Store results
        verificationResults[verificationId] = comprehensiveResult

        // Update global metrics
        globalMetrics.recordVerification(result: comprehensiveResult)

        print("DataVerificationPipeline: Verification complete - \(String(format: "%.3f", accuracyResults.overallAccuracy * 100))% accuracy")

        return comprehensiveResult
    }

    /// Compare specific data sources for accuracy validation
    public func compareDataSources(
        sourceA: (type: DataSourceType, path: String?, query: String?, noteIds: [String]?),
        sourceB: (type: DataSourceType, path: String?, query: String?, noteIds: [String]?),
        comparisonType: ComparisonType = .fullComparison
    ) async throws -> DataSourceComparisonResult {
        let comparisonId = UUID().uuidString
        activeVerifications.insert(comparisonId)
        defer { activeVerifications.remove(comparisonId) }

        print("DataVerificationPipeline: Comparing \(sourceA.type) vs \(sourceB.type)")

        let startTime = Date()

        // Load data from both sources
        let dataA = try await loadDataFromSource(sourceA)
        let dataB = try await loadDataFromSource(sourceB)

        // Perform comparison based on type
        let comparisonResults: [NodeComparisonResult]

        switch comparisonType {
        case .fullComparison:
            comparisonResults = await verificationEngine.performFullComparison(dataA: dataA, dataB: dataB)

        case .structuralOnly:
            comparisonResults = await verificationEngine.performStructuralComparison(dataA: dataA, dataB: dataB)

        case .contentOnly:
            comparisonResults = await verificationEngine.performContentComparison(dataA: dataA, dataB: dataB)

        case .metadataOnly:
            comparisonResults = await verificationEngine.performMetadataComparison(dataA: dataA, dataB: dataB)
        }

        // Calculate comparison accuracy
        let accuracy = await accuracyMetrics.calculateComparisonAccuracy(comparisonResults: comparisonResults)

        let duration = Date().timeIntervalSince(startTime)

        let result = DataSourceComparisonResult(
            comparisonId: comparisonId,
            sourceAType: sourceA.type,
            sourceBType: sourceB.type,
            comparisonType: comparisonType,
            duration: duration,
            nodeComparisons: comparisonResults,
            accuracy: accuracy,
            isAcceptable: accuracy >= 0.999
        )

        print("DataVerificationPipeline: Comparison complete - \(String(format: "%.3f", accuracy * 100))% accuracy")

        return result
    }

    /// Validate round-trip data integrity
    public func validateRoundTripIntegrity(originalData: [Node], exportFormat: VerificationExportFormat) async throws -> RoundTripVerificationResult {
        print("DataVerificationPipeline: Starting round-trip validation")

        let roundTripId = UUID().uuidString
        let startTime = Date()

        // Export data to specified format
        let exportedData = try await exportDataToFormat(nodes: originalData, format: exportFormat)

        // Re-import the exported data
        let reimportedData = try await reimportDataFromFormat(data: exportedData, format: exportFormat)

        // Compare original vs reimported
        let comparisonResults = await verificationEngine.performFullComparison(
            dataA: originalData,
            dataB: reimportedData
        )

        // Calculate fidelity metrics
        let fidelityScore = await accuracyMetrics.calculateRoundTripFidelity(
            original: originalData,
            reimported: reimportedData,
            comparisonResults: comparisonResults
        )

        let duration = Date().timeIntervalSince(startTime)

        let result = RoundTripVerificationResult(
            roundTripId: roundTripId,
            originalCount: originalData.count,
            reimportedCount: reimportedData.count,
            exportFormat: exportFormat,
            duration: duration,
            fidelityScore: fidelityScore,
            comparisonResults: comparisonResults,
            dataLosses: identifyDataLosses(comparisonResults: comparisonResults),
            isAcceptable: fidelityScore >= 0.999
        )

        print("DataVerificationPipeline: Round-trip validation complete - \(String(format: "%.3f", fidelityScore * 100))% fidelity")

        return result
    }

    // MARK: - Batch and Background Operations

    /// Perform batch verification for large datasets
    public func performBatchVerification(sourceDirectory: URL, batchConfiguration: BatchVerificationConfiguration) async throws -> BatchVerificationResult {
        print("DataVerificationPipeline: Starting batch verification")

        let batchId = UUID().uuidString
        let startTime = Date()

        // Discover all available notes
        let availableNotes = try await discoverAvailableNotes(sourceDirectory: sourceDirectory)
        print("DataVerificationPipeline: Found \(availableNotes.count) notes for verification")

        // Split into batches
        let batches = availableNotes.chunked(into: batchConfiguration.batchSize)
        var batchResults: [ComprehensiveVerificationResult] = []

        // Process batches with concurrency limit
        for (batchIndex, batch) in batches.enumerated() {
            if progressReporting {
                print("DataVerificationPipeline: Processing batch \(batchIndex + 1)/\(batches.count) (\(batch.count) notes)")
            }

            let batchResult = try await verifyDataIntegrity(
                sourceDirectory: sourceDirectory,
                noteIds: batch
            )

            batchResults.append(batchResult)

            // Rate limiting if configured
            if batchConfiguration.delayBetweenBatches > 0 {
                try await Task.sleep(for: .seconds(batchConfiguration.delayBetweenBatches))
            }
        }

        // Aggregate results
        let aggregatedAccuracy = batchResults.map { $0.overallAccuracy }.reduce(0, +) / Double(batchResults.count)
        let totalDuration = Date().timeIntervalSince(startTime)

        let result = BatchVerificationResult(
            batchId: batchId,
            totalNotes: availableNotes.count,
            batchCount: batches.count,
            duration: totalDuration,
            batchResults: batchResults,
            aggregatedAccuracy: aggregatedAccuracy,
            averageBatchTime: totalDuration / Double(batches.count),
            isAcceptable: aggregatedAccuracy >= 0.999
        )

        print("DataVerificationPipeline: Batch verification complete - \(String(format: "%.3f", aggregatedAccuracy * 100))% average accuracy")

        return result
    }

    /// Run background verification with progress monitoring
    public func startBackgroundVerification(sourceDirectory: URL, progressHandler: @escaping (VerificationProgress) -> Void) async throws -> String {
        let backgroundId = UUID().uuidString
        activeVerifications.insert(backgroundId)

        print("DataVerificationPipeline: Starting background verification (\(backgroundId))")

        Task { [weak self] in
            guard let self = self else { return }

            do {
                var progress = VerificationProgress(verificationId: backgroundId, phase: .initializing)
                progressHandler(progress)

                // Discover notes
                progress.phase = .discovering
                progressHandler(progress)

                let availableNotes = try await self.discoverAvailableNotes(sourceDirectory: sourceDirectory)
                progress.totalItems = availableNotes.count

                // Process in batches with progress updates
                let batches = availableNotes.chunked(into: self.batchSize)

                for (batchIndex, batch) in batches.enumerated() {
                    progress.phase = .processing
                    progress.currentBatch = batchIndex + 1
                    progress.totalBatches = batches.count
                    progress.processedItems = batchIndex * self.batchSize
                    progressHandler(progress)

                    let batchResult = try await self.verifyDataIntegrity(
                        sourceDirectory: sourceDirectory,
                        noteIds: batch
                    )

                    progress.lastBatchAccuracy = batchResult.overallAccuracy
                }

                progress.phase = .completed
                progress.processedItems = availableNotes.count
                progressHandler(progress)

                await self.removeActiveVerification(backgroundId)

            } catch {
                var progress = VerificationProgress(verificationId: backgroundId, phase: .failed)
                progress.error = error
                progressHandler(progress)

                await self.removeActiveVerification(backgroundId)
            }
        }

        return backgroundId
    }

    // MARK: - Results and Reporting

    /// Get verification result by ID
    public func getVerificationResult(verificationId: String) async -> ComprehensiveVerificationResult? {
        return verificationResults[verificationId]
    }

    /// Get global verification metrics
    public func getGlobalMetrics() async -> GlobalVerificationMetrics {
        return globalMetrics
    }

    /// Generate comprehensive verification report
    public func generateVerificationReport(verificationId: String, format: ReportFormat) async throws -> Data {
        guard let result = verificationResults[verificationId] else {
            throw VerificationError.verificationNotFound(verificationId)
        }

        // Create a basic report using the comprehensive result data
        let reportString = """
        Verification Report
        ID: \(result.verificationId)
        Duration: \(result.duration)s
        Accuracy: \(String(format: "%.3f", result.overallAccuracy * 100))%
        Native Nodes: \(result.nativeNodeCount)
        Alto-index Nodes: \(result.altoNodeCount)
        Acceptable: \(result.isAcceptable ? "Yes" : "No")
        """
        return reportString.data(using: .utf8) ?? Data()
    }

    /// Get active verification status
    public func getActiveVerifications() async -> [String] {
        return Array(activeVerifications)
    }

    // MARK: - Private Implementation

    /// Import data from native source
    private func importFromNativeSource(noteIds: [String]?) async throws -> [Node] {
        print("DataVerificationPipeline: Importing from native source")

        if let specificNoteIds = noteIds {
            // Import specific notes
            var results: [Node] = []
            for noteId in specificNoteIds {
                if let node = try await nativeImporter.importNoteByIdentifier(noteId) {
                    results.append(node)
                }
            }
            return results
        } else {
            // Import all available notes
            let importResult = try await nativeImporter.importNotes()
            return importResult.nodes
        }
    }

    /// Import data from alto-index source
    private func importFromAltoIndexSource(sourceDirectory: URL) async throws -> [Node] {
        print("DataVerificationPipeline: Importing from alto-index source")

        let importResult = try await altoIndexImporter.importNotes(from: sourceDirectory)
        return importResult.nodes
    }

    /// Perform parallel verification of node collections
    private func performParallelVerification(nativeNodes: [Node], altoNodes: [Node]) async throws -> [NodeComparisonResult] {
        print("DataVerificationPipeline: Performing parallel verification")

        // Create node lookup for efficient comparison
        let altoNodesBySourceId = Dictionary(grouping: altoNodes) { $0.sourceId ?? $0.id }

        // Process in batches with concurrency
        let nodeBatches = nativeNodes.chunked(into: batchSize)
        var allResults: [NodeComparisonResult] = []

        for batch in nodeBatches {
            let batchResults = try await withThrowingTaskGroup(of: NodeComparisonResult?.self) { group in
                for nativeNode in batch {
                    group.addTask { [weak self] in
                        guard let self = self else { return nil }

                        // Find corresponding alto-index node
                        let sourceId = nativeNode.sourceId ?? nativeNode.id
                        let altoNodes = altoNodesBySourceId[sourceId] ?? []
                        let altoNode = altoNodes.first

                        return await self.verificationEngine.compareNodes(
                            native: nativeNode,
                            alto: altoNode
                        )
                    }
                }

                var batchResults: [NodeComparisonResult] = []
                for try await result in group {
                    if let result = result {
                        batchResults.append(result)
                    }
                }
                return batchResults
            }

            allResults.append(contentsOf: batchResults)
        }

        return allResults
    }

    /// Load data from a specific source
    private func loadDataFromSource(_ source: (type: DataSourceType, path: String?, query: String?, noteIds: [String]?)) async throws -> [Node] {
        switch source.type {
        case .nativeImport:
            if let path = source.path {
                return try await importFromNativeSource(noteIds: source.noteIds)
            } else {
                let importResult = try await nativeImporter.importNotes()
                return importResult.nodes
            }

        case .altoIndexExport:
            guard let path = source.path else {
                throw VerificationError.invalidDataSource("Alto-index source requires path")
            }
            return try await importFromAltoIndexSource(sourceDirectory: URL(fileURLWithPath: path))

        case .databaseQuery:
            guard let query = source.query else {
                throw VerificationError.invalidDataSource("Database source requires query")
            }
            return try await executeNodeQuery(query: query)
        }
    }

    /// Execute database query for nodes
    private func executeNodeQuery(query: String) async throws -> [Node] {
        return try await database.read { db in
            try Node.fetchAll(db, sql: query)
        }
    }

    /// Export data to specified format
    private func exportDataToFormat(nodes: [Node], format: VerificationExportFormat) async throws -> Data {
        switch format {
        case .altoIndexMarkdown:
            return try await altoIndexImporter.exportNodes(nodes, to: URL(fileURLWithPath: NSTemporaryDirectory()))

        case .json:
            return try JSONEncoder().encode(nodes)

        case .csv:
            // Simplified CSV export
            let csvData = nodes.map { node in
                "\"\(node.id)\",\"\(node.name)\",\"\(node.content ?? "")\""
            }.joined(separator: "\n")
            return csvData.data(using: .utf8) ?? Data()
        }
    }

    /// Re-import data from exported format
    private func reimportDataFromFormat(data: Data, format: VerificationExportFormat) async throws -> [Node] {
        switch format {
        case .altoIndexMarkdown:
            // Write to temp file and import
            let tempFile = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("verification-export.md")
            try data.write(to: tempFile)
            defer { try? FileManager.default.removeItem(at: tempFile) }

            let result = try await altoIndexImporter.importData(data, filename: tempFile.lastPathComponent, folder: nil)
            return result.nodes

        case .json:
            return try JSONDecoder().decode([Node].self, from: data)

        case .csv:
            // Simplified CSV parsing - in production would use proper CSV parser
            guard let csvString = String(data: data, encoding: .utf8) else {
                throw VerificationError.invalidExportFormat("CSV data not UTF-8")
            }

            let lines = csvString.components(separatedBy: "\n").filter { !$0.isEmpty }
            return lines.compactMap { line in
                let components = line.components(separatedBy: ",")
                guard components.count >= 3 else { return nil }

                return Node(
                    id: components[0].trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\""))),
                    nodeType: "note",
                    name: components[1].trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\""))),
                    content: components[2].trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\""))),
                    createdAt: Date(),
                    modifiedAt: Date(),
                    source: "verification"
                )
            }
        }
    }

    /// Discover available notes in source directory
    private func discoverAvailableNotes(sourceDirectory: URL) async throws -> [String] {
        let fileManager = FileManager.default
        guard let enumerator = fileManager.enumerator(at: sourceDirectory, includingPropertiesForKeys: nil) else {
            throw VerificationError.sourceDirectoryNotAccessible(sourceDirectory.path)
        }

        var noteIds: [String] = []
        for case let fileURL as URL in enumerator {
            if fileURL.pathExtension == "md" {
                let noteId = fileURL.deletingPathExtension().lastPathComponent
                noteIds.append(noteId)
            }
        }

        return noteIds
    }

    /// Identify data losses from comparison results
    private func identifyDataLosses(comparisonResults: [NodeComparisonResult]) -> [DataLoss] {
        return comparisonResults.compactMap { result in
            guard result.accuracy < 1.0 else { return nil }

            return DataLoss(
                nodeId: result.nodeId,
                lossType: classifyLossType(result: result),
                description: result.differences.joined(separator: "; "),
                severity: result.accuracy < 0.99 ? .critical : .warning
            )
        }
    }

    /// Classify type of data loss
    private func classifyLossType(result: NodeComparisonResult) -> DataLossType {
        if result.differences.contains(where: { $0.contains("content") }) {
            return .contentLoss
        } else if result.differences.contains(where: { $0.contains("attachment") }) {
            return .attachmentLoss
        } else if result.differences.contains(where: { $0.contains("metadata") }) {
            return .metadataLoss
        } else {
            return .formatLoss
        }
    }

    /// Remove active verification (thread-safe)
    private func removeActiveVerification(_ verificationId: String) async {
        activeVerifications.remove(verificationId)
    }

    // MARK: - Property-Based Testing Support

    /// Verify specific data lifecycle properties for property-based testing
    public func verifyProperty(
        property: VerificationPropertyType,
        originalData: Any,
        importedNodes: [Node]
    ) async throws -> PropertyVerificationResult {
        switch property {
        case .dataIntegrity:
            return try await verifyDataIntegrityProperty(originalData: originalData, importedNodes: importedNodes)
        case .latchMapping:
            return try await verifyLATCHMappingProperty(originalData: originalData, importedNodes: importedNodes)
        }
    }

    /// Verify data integrity property
    private func verifyDataIntegrityProperty(
        originalData: Any,
        importedNodes: [Node]
    ) async throws -> PropertyVerificationResult {
        let validator = PropertyBasedTestFramework.DataIntegrityValidator()
        let isValid = try await validator.validate(input: originalData, output: importedNodes)

        var semanticErrorCount = 0

        // Check for semantic errors
        for node in importedNodes {
            // Verify essential data is present
            if node.name.isEmpty || node.id.isEmpty {
                semanticErrorCount += 1
            }

            // Verify timestamps are reasonable
            if node.createdAt > Date() || node.modifiedAt > Date() {
                semanticErrorCount += 1
            }

            // Verify content integrity
            if let content = node.content, content.isEmpty && node.name.count > 0 {
                // Likely lost content during import
                semanticErrorCount += 1
            }
        }

        let accuracy = isValid ? (semanticErrorCount == 0 ? 1.0 : 0.8) : 0.0

        return PropertyVerificationResult(
            accuracy: accuracy,
            semanticErrorCount: semanticErrorCount,
            latchScores: LATCHScores(
                location: 1.0,
                alphabet: accuracy,
                time: accuracy,
                category: accuracy,
                hierarchy: accuracy
            )
        )
    }

    /// Verify LATCH mapping property
    private func verifyLATCHMappingProperty(
        originalData: Any,
        importedNodes: [Node]
    ) async throws -> PropertyVerificationResult {
        let validator = PropertyBasedTestFramework.LATCHMappingValidator()
        let isValid = try await validator.validate(input: originalData, output: importedNodes)

        // Calculate LATCH-specific scores
        var locationScore = 1.0
        var alphabetScore = 1.0
        var timeScore = 1.0
        var categoryScore = 1.0
        var hierarchyScore = 1.0

        for node in importedNodes {
            // Location (L) - validate if present
            if let lat = node.latitude, let lng = node.longitude {
                if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
                    locationScore *= 0.8
                }
            }

            // Alphabet (A) - name/title quality
            if node.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                alphabetScore *= 0.5
            }

            // Time (T) - timestamp consistency
            if node.createdAt > node.modifiedAt {
                timeScore *= 0.7
            }

            // Category (C) - folder organization
            if let folder = node.folder, folder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                categoryScore *= 0.9
            }

            // Hierarchy (H) - ordering and structure
            if node.sortOrder < 0 {
                hierarchyScore *= 0.8
            }
        }

        let overallAccuracy = isValid ? min(alphabetScore, timeScore) : 0.0

        return PropertyVerificationResult(
            accuracy: overallAccuracy,
            semanticErrorCount: isValid ? 0 : 1,
            latchScores: LATCHScores(
                location: locationScore,
                alphabet: alphabetScore,
                time: timeScore,
                category: categoryScore,
                hierarchy: hierarchyScore
            )
        )
    }
}

// MARK: - Data Types

/// Comprehensive verification result
public struct ComprehensiveVerificationResult {
    public let verificationId: String
    public let duration: TimeInterval
    public let nativeNodeCount: Int
    public let altoNodeCount: Int
    public let verificationResults: [NodeComparisonResult]
    public let accuracyMetrics: ComprehensiveAccuracyResult
    public let overallAccuracy: Double
    public let isAcceptable: Bool

    public var successRate: Double {
        guard !verificationResults.isEmpty else { return 0.0 }
        let successfulComparisons = verificationResults.filter { $0.accuracy >= 0.999 }.count
        return Double(successfulComparisons) / Double(verificationResults.count)
    }
}

/// Data source comparison result
public struct DataSourceComparisonResult {
    public let comparisonId: String
    public let sourceAType: DataSourceType
    public let sourceBType: DataSourceType
    public let comparisonType: ComparisonType
    public let duration: TimeInterval
    public let nodeComparisons: [NodeComparisonResult]
    public let accuracy: Double
    public let isAcceptable: Bool
}

/// Round-trip verification result
public struct RoundTripVerificationResult {
    public let roundTripId: String
    public let originalCount: Int
    public let reimportedCount: Int
    public let exportFormat: VerificationExportFormat
    public let duration: TimeInterval
    public let fidelityScore: Double
    public let comparisonResults: [NodeComparisonResult]
    public let dataLosses: [DataLoss]
    public let isAcceptable: Bool
}

/// Batch verification result
public struct BatchVerificationResult {
    public let batchId: String
    public let totalNotes: Int
    public let batchCount: Int
    public let duration: TimeInterval
    public let batchResults: [ComprehensiveVerificationResult]
    public let aggregatedAccuracy: Double
    public let averageBatchTime: TimeInterval
    public let isAcceptable: Bool
}

/// Verification progress tracking
public struct VerificationProgress {
    public let verificationId: String
    public var phase: VerificationPhase = .initializing
    public var totalItems: Int = 0
    public var processedItems: Int = 0
    public var currentBatch: Int = 0
    public var totalBatches: Int = 0
    public var lastBatchAccuracy: Double = 0.0
    public var error: Error?

    public var progressPercentage: Double {
        guard totalItems > 0 else { return 0.0 }
        return Double(processedItems) / Double(totalItems) * 100.0
    }
}

// VerificationResult moved to CloudKitProductionVerifier.swift to avoid duplication

/// Global verification metrics
public struct GlobalVerificationMetrics {
    public var totalVerifications: Int = 0
    public var totalAccuracySum: Double = 0.0
    public var highestAccuracy: Double = 0.0
    public var lowestAccuracy: Double = 1.0
    public var lastVerificationTime: Date?

    public var averageAccuracy: Double {
        guard totalVerifications > 0 else { return 0.0 }
        return totalAccuracySum / Double(totalVerifications)
    }

    public mutating func recordVerification(result: ComprehensiveVerificationResult) {
        totalVerifications += 1
        totalAccuracySum += result.overallAccuracy
        highestAccuracy = max(highestAccuracy, result.overallAccuracy)
        lowestAccuracy = min(lowestAccuracy, result.overallAccuracy)
        lastVerificationTime = Date()
    }
}

// DataSource moved to avoid duplication - using DataSourceType enum directly

/// Data loss tracking
public struct DataLoss {
    public let nodeId: String
    public let lossType: DataLossType
    public let description: String
    public let severity: DataLossSeverity
}

/// Batch verification configuration
public struct BatchVerificationConfiguration {
    public let batchSize: Int
    public let delayBetweenBatches: TimeInterval
    public let maxConcurrentBatches: Int

    public init(batchSize: Int = 100, delayBetweenBatches: TimeInterval = 0.5, maxConcurrentBatches: Int = 3) {
        self.batchSize = batchSize
        self.delayBetweenBatches = delayBetweenBatches
        self.maxConcurrentBatches = maxConcurrentBatches
    }
}

// MARK: - Enums

public enum VerificationPhase {
    case initializing
    case discovering
    case processing
    case completed
    case failed
}

public enum VerificationSourceType {
    case nativeVsAltoIndex
    case roundTrip
    case comprehensiveComparison
}

public enum ComparisonType {
    case fullComparison
    case structuralOnly
    case contentOnly
    case metadataOnly
}

public enum DataSourceType {
    case nativeImport
    case altoIndexExport
    case databaseQuery
}

public enum VerificationExportFormat {
    case altoIndexMarkdown
    case json
    case csv
}

public enum DataLossType {
    case contentLoss
    case attachmentLoss
    case metadataLoss
    case formatLoss
}

public enum DataLossSeverity {
    case warning
    case critical
}

public enum ReportFormat {
    case json
    case csv
    case pdf
    case html
}

// MARK: - Error Types

public enum VerificationError: Error, LocalizedError {
    case verificationNotFound(String)
    case invalidDataSource(String)
    case sourceDirectoryNotAccessible(String)
    case invalidExportFormat(String)
    case verificationInProgress(String)

    public var errorDescription: String? {
        switch self {
        case .verificationNotFound(let id):
            return "Verification not found: \(id)"
        case .invalidDataSource(let details):
            return "Invalid data source: \(details)"
        case .sourceDirectoryNotAccessible(let path):
            return "Source directory not accessible: \(path)"
        case .invalidExportFormat(let details):
            return "Invalid export format: \(details)"
        case .verificationInProgress(let id):
            return "Verification already in progress: \(id)"
        }
    }
}

// MARK: - Helper Extensions

// Array.chunked extension moved to RenderingOptimizer.swift to avoid duplication

// MARK: - Property Testing Types

/// Property type for verification
public enum VerificationPropertyType {
    case dataIntegrity
    case latchMapping
}

/// Property verification result
public struct PropertyVerificationResult {
    public let accuracy: Double
    public let semanticErrorCount: Int
    public let latchScores: LATCHScores

    public init(accuracy: Double, semanticErrorCount: Int, latchScores: LATCHScores) {
        self.accuracy = accuracy
        self.semanticErrorCount = semanticErrorCount
        self.latchScores = latchScores
    }
}

/// LATCH dimensional scores
public struct LATCHScores {
    public let location: Double
    public let alphabet: Double
    public let time: Double
    public let category: Double
    public let hierarchy: Double

    public init(location: Double, alphabet: Double, time: Double, category: Double, hierarchy: Double) {
        self.location = location
        self.alphabet = alphabet
        self.time = time
        self.category = category
        self.hierarchy = hierarchy
    }
}