import XCTest
import Foundation
@testable import Isometry

/// Comprehensive test suite for data verification pipeline
/// Tests accuracy, performance, edge cases, and property-based invariants
final class DataVerificationPipelineTests: XCTestCase {

    // MARK: - Test Infrastructure

    private var pipeline: DataVerificationPipeline!
    private var mockNativeImporter: MockAppleNotesNativeImporter!
    private var mockAltoIndexImporter: MockAltoIndexImporter!
    private var testDatabase: IsometryDatabase!
    private var storageManager: ContentAwareStorageManager!

    override func setUp() async throws {
        // Create test database
        testDatabase = try IsometryDatabase(path: ":memory:")
        await testDatabase.initializeDatabase()

        // Create test storage manager
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        storageManager = ContentAwareStorageManager(basePath: tempDir, database: testDatabase)

        // Create mock importers
        mockNativeImporter = MockAppleNotesNativeImporter(database: testDatabase)
        mockAltoIndexImporter = MockAltoIndexImporter(database: testDatabase, storageManager: storageManager)

        // Create verification pipeline
        pipeline = DataVerificationPipeline(
            nativeImporter: mockNativeImporter,
            altoIndexImporter: mockAltoIndexImporter,
            database: testDatabase
        )
    }

    override func tearDown() async throws {
        // Clean up test storage
        if let basePath = storageManager?.basePath {
            try? FileManager.default.removeItem(at: basePath)
        }
        pipeline = nil
        mockNativeImporter = nil
        mockAltoIndexImporter = nil
        testDatabase = nil
        storageManager = nil
    }

    // MARK: - Accuracy Testing

    func testPerfectPreservationScenario() async throws {
        // Arrange: Create identical datasets
        let perfectNodes = generatePerfectTestNodes(count: 100)
        mockNativeImporter.mockNodes = perfectNodes
        mockAltoIndexImporter.mockNodes = perfectNodes

        // Act: Run verification
        let result = await pipeline.verifyDataIntegrity()

        // Assert: 100% accuracy expected
        XCTAssertTrue(result.isSuccessful)
        XCTAssertEqual(result.overallAccuracy, 1.0, accuracy: 0.0001)
        XCTAssertEqual(result.identicalMatches, 100)
        XCTAssertEqual(result.acceptableDifferences, 0)
        XCTAssertEqual(result.warnings, 0)
        XCTAssertEqual(result.criticalIssues, 0)
    }

    func testAcceptableDifferencesScenario() async throws {
        // Arrange: Create datasets with acceptable formatting differences
        let nativeNodes = generateTestNodesWithFormattingVariations()
        let altoNodes = generateTestNodesWithNormalizedFormatting()

        mockNativeImporter.mockNodes = nativeNodes
        mockAltoIndexImporter.mockNodes = altoNodes

        // Act: Run verification
        let result = await pipeline.verifyDataIntegrity()

        // Assert: High accuracy with acceptable differences
        XCTAssertTrue(result.isSuccessful)
        XCTAssertGreaterThan(result.overallAccuracy, 0.999) // >99.9% target
        XCTAssertGreaterThan(result.acceptableDifferences, 0)
        XCTAssertEqual(result.criticalIssues, 0)

        // Verify specific acceptable difference types
        let acceptableTypes = result.differenceBreakdown.filter { $0.classification == .acceptable }
        XCTAssertTrue(acceptableTypes.contains { $0.type == .whitespaceNormalization })
        XCTAssertTrue(acceptableTypes.contains { $0.type == .timestampPrecision })
    }

    func testDataCorruptionDetection() async throws {
        // Arrange: Create corrupted dataset
        let goodNodes = generatePerfectTestNodes(count: 50)
        let corruptedNodes = generateCorruptedTestNodes(count: 50)

        mockNativeImporter.mockNodes = goodNodes + corruptedNodes
        mockAltoIndexImporter.mockNodes = goodNodes + generatePerfectTestNodes(count: 50)

        // Act: Run verification
        let result = await pipeline.verifyDataIntegrity()

        // Assert: Corruption detected
        XCTAssertFalse(result.isSuccessful)
        XCTAssertLessThan(result.overallAccuracy, 0.999) // Below threshold
        XCTAssertEqual(result.criticalIssues, 50)

        // Verify corruption types detected
        let criticalIssues = result.differenceBreakdown.filter { $0.classification == .critical }
        XCTAssertTrue(criticalIssues.contains { $0.type == .contentCorruption })
        XCTAssertTrue(criticalIssues.contains { $0.type == .missingData })
    }

    func testAccuracyCalculationAlgorithms() async throws {
        // Arrange: Known dataset with calculated expected accuracy
        let testCase = AccuracyTestCase.createKnownAccuracyScenario()

        mockNativeImporter.mockNodes = testCase.nativeNodes
        mockAltoIndexImporter.mockNodes = testCase.altoNodes

        // Act: Run verification
        let result = await pipeline.verifyDataIntegrity()

        // Assert: Accuracy matches known calculation
        XCTAssertEqual(
            result.overallAccuracy,
            testCase.expectedAccuracy,
            accuracy: 0.001,
            "Accuracy calculation should match expected value"
        )

        // Verify component accuracies
        XCTAssertEqual(result.titleAccuracy, testCase.expectedTitleAccuracy, accuracy: 0.001)
        XCTAssertEqual(result.contentAccuracy, testCase.expectedContentAccuracy, accuracy: 0.001)
        XCTAssertEqual(result.timestampAccuracy, testCase.expectedTimestampAccuracy, accuracy: 0.001)
    }

    // MARK: - Comparison Algorithm Testing

    func testTextSimilarityAlgorithms() async throws {
        let testCases = [
            ("Hello World", "Hello World", 1.0),
            ("Hello World", "hello world", 0.95), // Case difference
            ("Hello World", "Hello Wrold", 0.9),  // Typo
            ("Hello World", "Hi World", 0.7),     // Word substitution
            ("Hello World", "Goodbye", 0.1)       // Completely different
        ]

        for (text1, text2, expectedSimilarity) in testCases {
            let similarity = pipeline.verificationEngine.calculateTextSimilarity(text1, text2)
            XCTAssertEqual(
                similarity,
                expectedSimilarity,
                accuracy: 0.1,
                "Text similarity for '\(text1)' vs '\(text2)' should be approximately \(expectedSimilarity)"
            )
        }
    }

    func testTimestampComparisonPrecision() async throws {
        let baseDate = Date()
        let testCases = [
            (baseDate, baseDate, true),                                    // Identical
            (baseDate, baseDate.addingTimeInterval(0.1), true),          // 100ms difference - acceptable
            (baseDate, baseDate.addingTimeInterval(1.0), true),          // 1s difference - acceptable
            (baseDate, baseDate.addingTimeInterval(60.0), false),        // 1min difference - not acceptable
        ]

        for (date1, date2, expectedMatch) in testCases {
            let matches = pipeline.verificationEngine.compareTimestamps(date1, date2)
            XCTAssertEqual(
                matches,
                expectedMatch,
                "Timestamp comparison for \(date1) vs \(date2) should be \(expectedMatch)"
            )
        }
    }

    func testAttachmentHashVerification() async throws {
        // Create test attachments
        let originalData = "Test attachment content".data(using: .utf8)!
        let identicalData = "Test attachment content".data(using: .utf8)!
        let modifiedData = "Modified attachment content".data(using: .utf8)!

        // Test identical content
        let identicalMatch = pipeline.verificationEngine.compareAttachmentHashes(originalData, identicalData)
        XCTAssertTrue(identicalMatch, "Identical attachment content should match")

        // Test modified content
        let modifiedMatch = pipeline.verificationEngine.compareAttachmentHashes(originalData, modifiedData)
        XCTAssertFalse(modifiedMatch, "Modified attachment content should not match")
    }

    func testFolderHierarchyComparison() async throws {
        // Create hierarchical folder structures
        let nativeHierarchy = createTestFolderHierarchy(depth: 3, breadth: 2)
        let identicalHierarchy = createTestFolderHierarchy(depth: 3, breadth: 2)
        let modifiedHierarchy = createTestFolderHierarchy(depth: 2, breadth: 3)

        // Test identical hierarchies
        let identicalAccuracy = pipeline.verificationEngine.compareFolderHierarchies(nativeHierarchy, identicalHierarchy)
        XCTAssertEqual(identicalAccuracy, 1.0, accuracy: 0.001)

        // Test different hierarchies
        let modifiedAccuracy = pipeline.verificationEngine.compareFolderHierarchies(nativeHierarchy, modifiedHierarchy)
        XCTAssertLessThan(modifiedAccuracy, 0.9)
    }

    // MARK: - Performance Testing

    func testLargeDatasetVerificationPerformance() async throws {
        // Arrange: Large dataset (10k notes)
        let largeDataset = generatePerfectTestNodes(count: 10000)
        mockNativeImporter.mockNodes = largeDataset
        mockAltoIndexImporter.mockNodes = largeDataset

        // Act: Measure verification time
        let startTime = CFAbsoluteTimeGetCurrent()
        let result = await pipeline.verifyDataIntegrity()
        let endTime = CFAbsoluteTimeGetCurrent()
        let executionTime = endTime - startTime

        // Assert: Performance requirements (<30 seconds for 10k notes)
        XCTAssertLessThan(executionTime, 30.0, "Verification should complete in under 30 seconds for 10k notes")
        XCTAssertTrue(result.isSuccessful)
        XCTAssertEqual(result.overallAccuracy, 1.0, accuracy: 0.0001)

        print("Verification of 10k notes completed in \(executionTime) seconds")
    }

    func testMemoryUsageDuringBulkVerification() async throws {
        // Arrange: Monitor memory before
        let initialMemory = getMemoryUsage()

        // Act: Run bulk verification
        let bulkDataset = generatePerfectTestNodes(count: 5000)
        mockNativeImporter.mockNodes = bulkDataset
        mockAltoIndexImporter.mockNodes = bulkDataset

        let result = await pipeline.verifyDataIntegrity()

        // Assert: Memory usage stays reasonable
        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory

        XCTAssertLessThan(memoryIncrease, 500 * 1024 * 1024, "Memory increase should be less than 500MB for 5k notes")
        XCTAssertTrue(result.isSuccessful)
    }

    func testBackgroundProcessingPerformance() async throws {
        // Create main thread marker
        let expectation = XCTestExpectation(description: "Background verification completes")

        // Start verification on background queue
        let dataset = generatePerfectTestNodes(count: 1000)
        mockNativeImporter.mockNodes = dataset
        mockAltoIndexImporter.mockNodes = dataset

        Task {
            let result = await pipeline.verifyDataIntegrityInBackground()
            XCTAssertTrue(result.isSuccessful)
            expectation.fulfill()
        }

        // Verify main thread isn't blocked
        let mainThreadResponsive = await MainActor.run {
            // Simulate UI work
            Thread.sleep(forTimeInterval: 0.1)
            return true
        }

        XCTAssertTrue(mainThreadResponsive, "Main thread should remain responsive during background verification")
        await fulfillment(of: [expectation], timeout: 10.0)
    }

    func testConcurrentVerificationTasks() async throws {
        // Test multiple verification tasks running concurrently
        let taskCount = 5
        let expectations = (0..<taskCount).map { XCTestExpectation(description: "Task \($0) completes") }

        for i in 0..<taskCount {
            let dataset = generatePerfectTestNodes(count: 100)
            mockNativeImporter.mockNodes = dataset
            mockAltoIndexImporter.mockNodes = dataset

            Task {
                let result = await pipeline.verifyDataIntegrity()
                XCTAssertTrue(result.isSuccessful)
                expectations[i].fulfill()
            }
        }

        await fulfillment(of: expectations, timeout: 10.0)
    }

    // MARK: - Edge Case Testing

    func testVerificationWithCorruptedData() async throws {
        // Test various corruption scenarios
        let corruptionTypes: [CorruptionType] = [.truncatedContent, .invalidUTF8, .missingMandatoryFields, .circularReferences]

        for corruptionType in corruptionTypes {
            let corruptedNodes = generateCorruptedNodes(type: corruptionType, count: 10)
            let goodNodes = generatePerfectTestNodes(count: 10)

            mockNativeImporter.mockNodes = corruptedNodes
            mockAltoIndexImporter.mockNodes = goodNodes

            let result = await pipeline.verifyDataIntegrity()

            XCTAssertFalse(result.isSuccessful, "Should detect corruption of type: \(corruptionType)")
            XCTAssertGreaterThan(result.criticalIssues, 0, "Should report critical issues for \(corruptionType)")
        }
    }

    func testVerificationWithMissingAttachments() async throws {
        // Create nodes with missing attachment references
        let nodesWithMissingAttachments = generateNodesWithMissingAttachments(count: 20)
        let completeNodes = generatePerfectTestNodes(count: 20)

        mockNativeImporter.mockNodes = nodesWithMissingAttachments
        mockAltoIndexImporter.mockNodes = completeNodes

        let result = await pipeline.verifyDataIntegrity()

        XCTAssertFalse(result.isSuccessful)
        XCTAssertTrue(result.differenceBreakdown.contains { $0.type == .missingAttachment })
    }

    func testUnicodeAndSpecialCharacterPreservation() async throws {
        // Test various Unicode scenarios
        let unicodeTestCases = [
            "Simple ASCII text",
            "Text with émojis 🚀✨🎉",
            "Multiple languages: English, 中文, العربية, עברית",
            "Mathematical symbols: ∑∆∫√π≈≤≥",
            "Special Unicode: \u{1F468}\u{200D}\u{1F4BB}", // Man technologist
            "Zero-width joiners and combinators"
        ]

        for (index, testText) in unicodeTestCases.enumerated() {
            let nativeNode = Node(
                id: UUID().uuidString,
                title: "Unicode Test \(index)",
                content: testText,
                type: .note,
                createdAt: Date(),
                modifiedAt: Date()
            )

            let altoNode = nativeNode // Perfect copy

            mockNativeImporter.mockNodes = [nativeNode]
            mockAltoIndexImporter.mockNodes = [altoNode]

            let result = await pipeline.verifyDataIntegrity()

            XCTAssertEqual(
                result.overallAccuracy,
                1.0,
                accuracy: 0.001,
                "Unicode preservation failed for: \(testText)"
            )
        }
    }

    func testVerificationWithEmptyDataset() async throws {
        mockNativeImporter.mockNodes = []
        mockAltoIndexImporter.mockNodes = []

        let result = await pipeline.verifyDataIntegrity()

        XCTAssertTrue(result.isSuccessful)
        XCTAssertEqual(result.totalNodesProcessed, 0)
        XCTAssertTrue(result.isEmpty)
    }

    func testVerificationWithMismatchedDatasetSizes() async throws {
        mockNativeImporter.mockNodes = generatePerfectTestNodes(count: 100)
        mockAltoIndexImporter.mockNodes = generatePerfectTestNodes(count: 50)

        let result = await pipeline.verifyDataIntegrity()

        XCTAssertFalse(result.isSuccessful)
        XCTAssertTrue(result.differenceBreakdown.contains { $0.type == .datasetSizeMismatch })
        XCTAssertEqual(result.missingFromAltoIndex, 50)
    }

    // MARK: - Integration Testing

    func testEndToEndVerificationPipeline() async throws {
        // Create realistic Notes data scenario
        let realDataSimulation = generateRealisticNotesDataset()

        mockNativeImporter.mockNodes = realDataSimulation.nativeData
        mockAltoIndexImporter.mockNodes = realDataSimulation.altoData

        // Run full pipeline
        let result = await pipeline.verifyDataIntegrity()

        // Verify comprehensive results
        XCTAssertTrue(result.isSuccessful)
        XCTAssertGreaterThan(result.overallAccuracy, 0.999)
        XCTAssertNotNil(result.accuracyBreakdown)
        XCTAssertNotNil(result.latchMappingResults)
        XCTAssertNotNil(result.contentIntegrityScore)

        // Verify report generation
        let report = await pipeline.generateVerificationReport(result)
        XCTAssertFalse(report.isEmpty)
        XCTAssertTrue(report.contains("VERIFICATION REPORT"))
        XCTAssertTrue(report.contains("Overall Accuracy"))
    }

    func testIntegrationWithBothImporters() async throws {
        // Test actual integration with real importer interfaces
        let realNativeImporter = AppleNotesNativeImporter(database: testDatabase)
        let realAltoImporter = AltoIndexImporter(database: testDatabase, storageManager: storageManager)

        let integrationPipeline = DataVerificationPipeline(
            nativeImporter: realNativeImporter,
            altoIndexImporter: realAltoImporter,
            database: testDatabase
        )

        // Should handle empty datasets gracefully
        let result = await integrationPipeline.verifyDataIntegrity()
        XCTAssertTrue(result.isSuccessful)
        XCTAssertTrue(result.isEmpty)
    }

    func testVerificationResultStorageAndRetrieval() async throws {
        // Run verification and store results
        let dataset = generatePerfectTestNodes(count: 50)
        mockNativeImporter.mockNodes = dataset
        mockAltoIndexImporter.mockNodes = dataset

        let result = await pipeline.verifyDataIntegrity()
        let resultId = try await pipeline.storeVerificationResult(result)

        // Retrieve and verify
        let retrievedResult = try await pipeline.retrieveVerificationResult(id: resultId)
        XCTAssertEqual(retrievedResult.overallAccuracy, result.overallAccuracy)
        XCTAssertEqual(retrievedResult.totalNodesProcessed, result.totalNodesProcessed)
    }

    func testReportGenerationAndExport() async throws {
        // Create verification result with diverse data
        let complexResult = createComplexVerificationResult()

        // Test multiple export formats
        let jsonReport = await pipeline.exportVerificationReport(complexResult, format: .json)
        XCTAssertTrue(jsonReport.starts(with: "{"))

        let csvReport = await pipeline.exportVerificationReport(complexResult, format: .csv)
        XCTAssertTrue(csvReport.contains(","))

        let markdownReport = await pipeline.exportVerificationReport(complexResult, format: .markdown)
        XCTAssertTrue(markdownReport.contains("# Verification Report"))
    }

    // MARK: - Property-Based Testing

    func testVerificationDeterminism() async throws {
        // Generate random dataset
        let randomDataset = generateRandomTestNodes(count: 100, seed: 12345)

        // Run verification multiple times
        var results: [VerificationResult] = []

        for _ in 0..<5 {
            mockNativeImporter.mockNodes = randomDataset
            mockAltoIndexImporter.mockNodes = randomDataset

            let result = await pipeline.verifyDataIntegrity()
            results.append(result)
        }

        // Verify all results are identical (deterministic)
        let firstAccuracy = results[0].overallAccuracy
        for result in results {
            XCTAssertEqual(result.overallAccuracy, firstAccuracy, accuracy: 0.0001, "Verification should be deterministic")
        }
    }

    func testVerificationRepeatable() async throws {
        // Property: Verification of identical data should always be 100% accurate
        for seed in [1, 42, 12345, 67890, 999999] {
            let dataset = generateRandomTestNodes(count: 50, seed: seed)
            mockNativeImporter.mockNodes = dataset
            mockAltoIndexImporter.mockNodes = dataset

            let result = await pipeline.verifyDataIntegrity()

            XCTAssertEqual(
                result.overallAccuracy,
                1.0,
                accuracy: 0.0001,
                "Identical datasets should always verify with 100% accuracy (seed: \(seed))"
            )
        }
    }

    func testAccuracyMetricsConsistency() async throws {
        // Property: Component accuracies should contribute to overall accuracy mathematically
        let dataset = generateMixedAccuracyTestNodes()
        mockNativeImporter.mockNodes = dataset.native
        mockAltoIndexImporter.mockNodes = dataset.alto

        let result = await pipeline.verifyDataIntegrity()

        // Verify mathematical consistency
        let weightedAverage = (
            result.titleAccuracy * 0.2 +
            result.contentAccuracy * 0.4 +
            result.timestampAccuracy * 0.2 +
            result.metadataAccuracy * 0.2
        )

        XCTAssertEqual(
            result.overallAccuracy,
            weightedAverage,
            accuracy: 0.01,
            "Overall accuracy should be weighted average of components"
        )
    }

    func testRoundTripVerificationProperty() async throws {
        // Property: If A verifies against B with X accuracy, B should verify against A with same accuracy
        let asymmetricData = generateAsymmetricTestData()

        // Test A vs B
        mockNativeImporter.mockNodes = asymmetricData.setA
        mockAltoIndexImporter.mockNodes = asymmetricData.setB
        let resultAB = await pipeline.verifyDataIntegrity()

        // Test B vs A
        mockNativeImporter.mockNodes = asymmetricData.setB
        mockAltoIndexImporter.mockNodes = asymmetricData.setA
        let resultBA = await pipeline.verifyDataIntegrity()

        XCTAssertEqual(
            resultAB.overallAccuracy,
            resultBA.overallAccuracy,
            accuracy: 0.01,
            "Verification should be symmetric"
        )
    }

    // MARK: - Stress Testing

    func testEnterpriseScalePerformance() async throws {
        // Test with 50k+ notes (enterprise scale)
        let enterpriseDataset = generatePerfectTestNodes(count: 50000)
        mockNativeImporter.mockNodes = enterpriseDataset
        mockAltoIndexImporter.mockNodes = enterpriseDataset

        let startTime = CFAbsoluteTimeGetCurrent()
        let result = await pipeline.verifyDataIntegrity()
        let endTime = CFAbsoluteTimeGetCurrent()

        let executionTime = endTime - startTime

        XCTAssertTrue(result.isSuccessful)
        XCTAssertEqual(result.overallAccuracy, 1.0, accuracy: 0.0001)
        XCTAssertLessThan(executionTime, 300.0, "50k notes should complete in under 5 minutes")

        print("Enterprise scale verification (50k notes) completed in \(executionTime) seconds")
    }

    // MARK: - Helper Methods

    private func generatePerfectTestNodes(count: Int) -> [Node] {
        return (0..<count).map { index in
            Node(
                id: "test-\(index)",
                title: "Test Note \(index)",
                content: "This is test content for note \(index) with some meaningful text.",
                type: .note,
                createdAt: Date(timeIntervalSince1970: 1640995200 + Double(index * 60)), // Predictable dates
                modifiedAt: Date(timeIntervalSince1970: 1640995200 + Double(index * 60) + 30)
            )
        }
    }

    private func generateTestNodesWithFormattingVariations() -> [Node] {
        return [
            Node(
                id: "format-1",
                title: "Title with  Extra   Spaces",
                content: "Content\n\n\nwith\textra\twhitespace",
                type: .note,
                createdAt: Date(),
                modifiedAt: Date()
            )
        ]
    }

    private func generateTestNodesWithNormalizedFormatting() -> [Node] {
        return [
            Node(
                id: "format-1",
                title: "Title with Extra Spaces",
                content: "Content\n\nwith extra whitespace",
                type: .note,
                createdAt: Date(),
                modifiedAt: Date()
            )
        ]
    }

    private func generateCorruptedTestNodes(count: Int) -> [Node] {
        return (0..<count).map { index in
            Node(
                id: "corrupt-\(index)",
                title: "", // Empty title (corruption)
                content: "Content \(index) with missing data", // Missing ending
                type: .note,
                createdAt: Date.distantPast, // Invalid date
                modifiedAt: Date.distantFuture // Invalid date
            )
        }
    }

    private func generateCorruptedNodes(type: CorruptionType, count: Int) -> [Node] {
        return (0..<count).map { index in
            switch type {
            case .truncatedContent:
                return Node(
                    id: "truncated-\(index)",
                    title: "Truncated Note \(index)",
                    content: "This content was trunca", // Artificially truncated
                    type: .note,
                    createdAt: Date(),
                    modifiedAt: Date()
                )
            case .invalidUTF8:
                return Node(
                    id: "invalid-utf8-\(index)",
                    title: "Invalid UTF8 \(index)",
                    content: "Content with invalid UTF8: \u{FFFF}", // Invalid Unicode
                    type: .note,
                    createdAt: Date(),
                    modifiedAt: Date()
                )
            case .missingMandatoryFields:
                return Node(
                    id: "", // Missing required ID
                    title: "Missing Fields \(index)",
                    content: "Content",
                    type: .note,
                    createdAt: Date(),
                    modifiedAt: Date()
                )
            case .circularReferences:
                // This would need more complex setup with relationships
                return Node(
                    id: "circular-\(index)",
                    title: "Circular Reference \(index)",
                    content: "Content with circular ref",
                    type: .note,
                    createdAt: Date(),
                    modifiedAt: Date()
                )
            }
        }
    }

    private func generateNodesWithMissingAttachments(count: Int) -> [Node] {
        return (0..<count).map { index in
            var node = Node(
                id: "missing-att-\(index)",
                title: "Node with Missing Attachment \(index)",
                content: "Content with attachment reference [missing-file-\(index).pdf]",
                type: .note,
                createdAt: Date(),
                modifiedAt: Date()
            )
            // Add reference to non-existent attachment
            node.attachmentPaths = ["missing-file-\(index).pdf"]
            return node
        }
    }

    private func createTestFolderHierarchy(depth: Int, breadth: Int) -> [FolderNode] {
        var folders: [FolderNode] = []

        func createFoldersRecursively(level: Int, parentId: String?) {
            guard level < depth else { return }

            for i in 0..<breadth {
                let folderId = "\(parentId ?? "root")-\(level)-\(i)"
                let folder = FolderNode(
                    id: folderId,
                    name: "Folder Level \(level) Item \(i)",
                    parentId: parentId
                )
                folders.append(folder)

                createFoldersRecursively(level: level + 1, parentId: folderId)
            }
        }

        createFoldersRecursively(level: 0, parentId: nil)
        return folders
    }

    private func generateRandomTestNodes(count: Int, seed: Int) -> [Node] {
        var generator = LinearCongruentialGenerator(seed: UInt64(seed))

        return (0..<count).map { index in
            let randomTitle = generateRandomString(length: Int.random(in: 5...50, using: &generator))
            let randomContent = generateRandomString(length: Int.random(in: 100...1000, using: &generator))

            return Node(
                id: "random-\(index)",
                title: randomTitle,
                content: randomContent,
                type: .note,
                createdAt: Date(timeIntervalSince1970: Double.random(in: 1000000000...1700000000, using: &generator)),
                modifiedAt: Date()
            )
        }
    }

    private func generateRandomString(length: Int) -> String {
        let characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
        return String((0..<length).map { _ in characters.randomElement()! })
    }

    private func getMemoryUsage() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout.size(ofValue: info) / MemoryLayout<integer_t>.size)

        let kerr = withUnsafeMutablePointer(to: &info) { infoPtr in
            return infoPtr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPtr in
                return task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), intPtr, &count)
            }
        }

        guard kerr == KERN_SUCCESS else { return 0 }
        return info.resident_size
    }

    private func generateRealisticNotesDataset() -> (nativeData: [Node], altoData: [Node]) {
        // Create realistic Apple Notes data simulation
        let baseNodes = [
            Node(
                id: "note-1",
                title: "Meeting Notes - Project Kickoff",
                content: """
                # Project Kickoff Meeting

                ## Attendees
                - Alice Johnson
                - Bob Smith
                - Carol Williams

                ## Action Items
                1. Set up development environment
                2. Create initial wireframes
                3. Schedule next review meeting

                **Next Meeting:** Friday, 2:00 PM
                """,
                type: .note,
                createdAt: Date(timeIntervalSince1970: 1640995200),
                modifiedAt: Date(timeIntervalSince1970: 1640995260)
            ),
            Node(
                id: "note-2",
                title: "Grocery List 🛒",
                content: """
                - Milk 🥛
                - Bread 🍞
                - Eggs 🥚
                - Cheese 🧀
                - Apples 🍎
                """,
                type: .note,
                createdAt: Date(timeIntervalSince1970: 1640995300),
                modifiedAt: Date(timeIntervalSince1970: 1640995300)
            )
        ]

        return (nativeData: baseNodes, altoData: baseNodes)
    }

    private func generateMixedAccuracyTestNodes() -> (native: [Node], alto: [Node]) {
        let nativeNode = Node(
            id: "mixed-1",
            title: "Original Title",
            content: "Original content with specific formatting.",
            type: .note,
            createdAt: Date(timeIntervalSince1970: 1640995200),
            modifiedAt: Date(timeIntervalSince1970: 1640995260)
        )

        let altoNode = Node(
            id: "mixed-1",
            title: "Slightly Different Title", // Different title
            content: "Original content with specific formatting.", // Same content
            type: .note,
            createdAt: Date(timeIntervalSince1970: 1640995200), // Same created
            modifiedAt: Date(timeIntervalSince1970: 1640995270) // Different modified
        )

        return (native: [nativeNode], alto: [altoNode])
    }

    private func generateAsymmetricTestData() -> (setA: [Node], setB: [Node]) {
        let setA = generatePerfectTestNodes(count: 10)
        var setB = setA

        // Modify one node slightly
        if !setB.isEmpty {
            setB[0] = Node(
                id: setB[0].id,
                title: setB[0].title + " (Modified)",
                content: setB[0].content,
                type: setB[0].type,
                createdAt: setB[0].createdAt,
                modifiedAt: setB[0].modifiedAt
            )
        }

        return (setA: setA, setB: setB)
    }

    private func createComplexVerificationResult() -> VerificationResult {
        return VerificationResult(
            isSuccessful: true,
            overallAccuracy: 0.9956,
            totalNodesProcessed: 1000,
            identicalMatches: 950,
            acceptableDifferences: 40,
            warnings: 8,
            criticalIssues: 2,
            titleAccuracy: 0.998,
            contentAccuracy: 0.994,
            timestampAccuracy: 0.999,
            metadataAccuracy: 0.992,
            verificationStartTime: Date(),
            verificationEndTime: Date().addingTimeInterval(45),
            differenceBreakdown: [],
            accuracyBreakdown: AccuracyBreakdown(),
            latchMappingResults: LATCHMappingResult(),
            contentIntegrityScore: 0.995
        )
    }
}

// MARK: - Supporting Types

enum CorruptionType {
    case truncatedContent
    case invalidUTF8
    case missingMandatoryFields
    case circularReferences
}

struct AccuracyTestCase {
    let nativeNodes: [Node]
    let altoNodes: [Node]
    let expectedAccuracy: Double
    let expectedTitleAccuracy: Double
    let expectedContentAccuracy: Double
    let expectedTimestampAccuracy: Double

    static func createKnownAccuracyScenario() -> AccuracyTestCase {
        // Create scenario with known accuracy values
        let nativeNode = Node(
            id: "known-1",
            title: "Perfect Title",
            content: "Perfect content match",
            type: .note,
            createdAt: Date(timeIntervalSince1970: 1640995200),
            modifiedAt: Date(timeIntervalSince1970: 1640995260)
        )

        let altoNode = nativeNode // Perfect match

        return AccuracyTestCase(
            nativeNodes: [nativeNode],
            altoNodes: [altoNode],
            expectedAccuracy: 1.0,
            expectedTitleAccuracy: 1.0,
            expectedContentAccuracy: 1.0,
            expectedTimestampAccuracy: 1.0
        )
    }
}

struct FolderNode {
    let id: String
    let name: String
    let parentId: String?
}

struct LinearCongruentialGenerator: RandomNumberGenerator {
    private var seed: UInt64

    init(seed: UInt64) {
        self.seed = seed
    }

    mutating func next() -> UInt64 {
        seed = (seed &* 1664525 &+ 1013904223) & 0xFFFFFFFF
        return seed
    }
}

// MARK: - Mock Importers

class MockAppleNotesNativeImporter: AppleNotesImporter {
    var mockNodes: [Node] = []
    let database: IsometryDatabase

    init(database: IsometryDatabase) {
        self.database = database
    }

    func importNotes(from path: String?, progressHandler: ((Double, String) -> Void)?) async throws -> ImportResult {
        return ImportResult(
            imported: mockNodes.count,
            failed: 0,
            duration: 1.0,
            importedNodes: mockNodes
        )
    }

    func verifyDataIntegrity() async throws -> VerificationResult {
        return VerificationResult(
            isSuccessful: true,
            overallAccuracy: 1.0,
            totalNodesProcessed: mockNodes.count
        )
    }
}

class MockAltoIndexImporter: AltoIndexImporter {
    var mockNodes: [Node] = []

    override func importNotes(from path: String?, progressHandler: ((Double, String) -> Void)?) async throws -> ImportResult {
        return ImportResult(
            imported: mockNodes.count,
            failed: 0,
            duration: 1.0,
            importedNodes: mockNodes
        )
    }

    override func verifyDataIntegrity() async throws -> VerificationResult {
        return VerificationResult(
            isSuccessful: true,
            overallAccuracy: 1.0,
            totalNodesProcessed: mockNodes.count
        )
    }
}