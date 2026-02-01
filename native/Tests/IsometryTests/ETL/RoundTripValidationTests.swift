import Testing
import Foundation
@testable import Isometry

/// Comprehensive round-trip validation tests for all ETL importers
/// Tests Wave 2 requirements: >99.9% data preservation, >95% LATCH mapping accuracy
actor RoundTripValidationTests {

    private var database: IsometryDatabase!
    private var testHarness: ImportTestHarness!

    init() async throws {
        self.database = try IsometryDatabase(path: ":memory:")
        try await self.database.initialize()
        self.testHarness = ImportTestHarness(database: database)
    }

    // MARK: - AltoIndexImporter Round-Trip Tests

    @Test("AltoIndexImporter round-trip validation with single note")
    func testAltoIndexSingleNoteRoundTrip() async throws {
        let importer = AltoIndexImporter(database: database)

        // Generate test markdown content
        let markdownContent = """
        ---
        title: "Test Note for Round-Trip"
        id: "test-note-123"
        created: "2024-01-15T10:30:00Z"
        modified: "2024-01-15T10:35:00Z"
        folder: "test-folder"
        attachments:
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\\"tag link\\" href=\\"/tags/TestTag\\">#TestTag</a>"
        ---

        # Test Note Content

        This is a comprehensive test note with **bold text** and *italic text*.

        ## Features to Test
        - Data preservation
        - LATCH mapping
        - Content integrity
        - Schema conformance

        [Link to external resource](https://example.com)
        """

        let testData = markdownContent.data(using: .utf8)!

        // Execute round-trip test
        let result = try await testHarness.testRoundTrip(
            importer: importer,
            originalData: testData
        )

        // Verify success
        #expect(result.success, "Round-trip test should succeed")
        #expect(result.importResult?.imported == 1, "Should import exactly one note")

        // Check for enhanced validation results
        let preservationResult = result.validationResults.first { $0.validationType == .contentIntegrity }
        let latchResult = result.validationResults.first { $0.validationType == .latchMapping }
        let schemaResult = result.validationResults.first { $0.validationType == .schemaConformance }

        // Verify preservation accuracy >99.9%
        if let preservationDetails = preservationResult?.details {
            let preservationPercent = extractPercentage(from: preservationDetails)
            #expect(preservationPercent >= 99.9, "Data preservation should be ≥99.9%, got \(preservationPercent)%")
        }

        // Verify LATCH mapping accuracy >95%
        if let latchDetails = latchResult?.details {
            let latchPercent = extractPercentage(from: latchDetails)
            #expect(latchPercent >= 95.0, "LATCH mapping should be ≥95%, got \(latchPercent)%")
        }

        // All validations should pass
        #expect(preservationResult?.passed == true, "Content integrity should pass")
        #expect(latchResult?.passed == true, "LATCH mapping should pass")
        #expect(schemaResult?.passed == true, "Schema conformance should pass")

        print("✅ AltoIndex Single Note Round-Trip: Preservation=\(extractPercentage(from: preservationResult?.details ?? "0%"))%, LATCH=\(extractPercentage(from: latchResult?.details ?? "0%"))%")
    }

    @Test("AltoIndexImporter round-trip validation with multiple complex notes")
    func testAltoIndexMultipleNotesRoundTrip() async throws {
        let importer = AltoIndexImporter(database: database)

        // Generate complex multi-note content
        let complexContent = """
        ---
        title: "First Complex Note"
        id: "note-001"
        created: "2024-01-01T08:00:00Z"
        modified: "2024-01-01T09:00:00Z"
        folder: "projects"
        attachments:
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\\"tag link\\" href=\\"/tags/Project\\">#Project</a>"
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\\"tag link\\" href=\\"/tags/Important\\">#Important</a>"
        ---

        # Project Planning Document

        ## Objectives
        1. Complete round-trip validation
        2. Ensure >99.9% data preservation
        3. Validate LATCH mapping accuracy

        **Unicode content:** 日本語テスト, Ελληνικά, العربية

        > This is a blockquote with important information

        ```swift
        func testFunction() {
            print("Code preservation test")
        }
        ```

        ---

        ---
        title: "Second Note with Edge Cases"
        id: "note-002"
        created: "2024-01-02T14:30:00.123Z"
        modified: "2024-01-02T15:45:30.456Z"
        folder: "edge-cases"
        source: "https://example.com/note-002"
        attachments:
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\\"tag link\\" href=\\"/tags/EdgeCase\\">#EdgeCase</a>"
        ---

        # Edge Case Testing

        This note contains various edge cases:

        - Empty lines


        - Special characters: @#$%^&*()
        - Quotes: "double" and 'single'
        - Escape sequences: \\n \\t \\r

        | Table | With | Data |
        |-------|------|------|
        | Cell1 | Cell2| Cell3|
        | A     | B    | C    |
        """

        let testData = complexContent.data(using: .utf8)!

        // Execute round-trip test
        let result = try await testHarness.testRoundTrip(
            importer: importer,
            originalData: testData
        )

        // Verify success with strict requirements
        #expect(result.success, "Complex multi-note round-trip should succeed")
        #expect(result.importResult?.imported == 2, "Should import exactly two notes")

        // Enhanced validation checks
        let preservationResult = result.validationResults.first { $0.validationType == .contentIntegrity }
        let latchResult = result.validationResults.first { $0.validationType == .latchMapping }

        // Verify strict preservation requirements
        if let preservationDetails = preservationResult?.details {
            let preservationPercent = extractPercentage(from: preservationDetails)
            #expect(preservationPercent >= 99.9, "Multi-note data preservation should be ≥99.9%, got \(preservationPercent)%")
        }

        if let latchDetails = latchResult?.details {
            let latchPercent = extractPercentage(from: latchDetails)
            #expect(latchPercent >= 95.0, "Multi-note LATCH mapping should be ≥95%, got \(latchPercent)%")
        }

        print("✅ AltoIndex Complex Multi-Note Round-Trip: Preservation=\(extractPercentage(from: preservationResult?.details ?? "0%"))%, LATCH=\(extractPercentage(from: latchResult?.details ?? "0%"))%")
    }

    // MARK: - Performance Baseline Tests

    @Test("Establish performance baselines for all importers")
    func testEstablishPerformanceBaselines() async throws {
        let importers: [(String, any ImporterProtocol)] = [
            ("AltoIndexImporter", AltoIndexImporter(database: database)),
            ("SQLiteFileImporter", SQLiteFileImporter(database: database))
        ]

        var baselineResults: [(String, [ImportTestHarness.PerformanceBaseline])] = []

        for (name, importer) in importers {
            print("📊 Establishing baselines for \(name)...")

            let baselines = try await testHarness.establishComprehensiveBaselines(
                importer: importer
            )

            baselineResults.append((name, baselines))

            // Verify baselines were established
            #expect(baselines.count >= 4, "Should establish baselines for multiple data sizes")

            for baseline in baselines {
                #expect(baseline.avgExecutionTime > 0, "Execution time should be positive")
                #expect(baseline.avgMemoryUsage >= 0, "Memory usage should be non-negative")
                #expect(baseline.sampleCount >= 10, "Should have sufficient samples")
                #expect(baseline.standardDeviation >= 0, "Standard deviation should be non-negative")

                print("  📈 \(baseline.importerName) (\(baseline.dataSize) bytes): \(String(format: "%.3f", baseline.avgExecutionTime))s ± \(String(format: "%.3f", baseline.standardDeviation))s, \(baseline.avgMemoryUsage) bytes")
            }
        }

        // Verify performance characteristics
        for (name, baselines) in baselineResults {
            for baseline in baselines {
                // Performance requirements
                #expect(baseline.avgExecutionTime < 5.0, "\(name) should complete imports within 5 seconds")
                #expect(baseline.avgMemoryUsage < 100 * 1024 * 1024, "\(name) should use less than 100MB memory")
                #expect(baseline.avgThroughput > 1.0, "\(name) should process at least 1 node/second")
            }
        }

        print("✅ Performance baselines established for \(importers.count) importers")
    }

    @Test("Performance regression detection")
    func testPerformanceRegressionDetection() async throws {
        let importer = AltoIndexImporter(database: database)

        // Establish baseline
        let baseline = try await testHarness.establishPerformanceBaseline(
            importer: importer,
            dataSize: 10240,
            iterations: 5
        )

        // Test current performance
        let (result, detectedBaseline, isRegression) = try await testHarness.testPerformanceRegression(
            importer: importer,
            dataSize: 10240
        )

        #expect(detectedBaseline != nil, "Should find established baseline")
        #expect(isRegression == false, "Should not detect regression in normal operation")
        #expect(result.success, "Performance test should succeed")

        // Verify performance is within acceptable bounds
        let performanceRatio = result.metrics.executionTime / baseline.avgExecutionTime
        #expect(performanceRatio < 1.5, "Performance should not degrade more than 50%")

        print("✅ Performance regression test: \(String(format: "%.1f", performanceRatio * 100))% of baseline")
    }

    // MARK: - Enhanced Error Path Testing

    @Test("ImportError.directoryNotFound handling")
    func testDirectoryNotFoundErrorHandling() async throws {
        let importer = AltoIndexImporter(database: database)

        // Create test context
        let context = ImportTestHarness.TestExecutionContext(database: database)

        // Test with non-existent directory
        do {
            let nonExistentURL = URL(fileURLWithPath: "/nonexistent/path/to/directory")
            _ = try await importer.importNotes(from: nonExistentURL)

            #expect(Bool(false), "Should have thrown ImportError.directoryNotFound")
        } catch let error as ImportError {
            switch error {
            case .directoryNotFound(let path):
                #expect(path.contains("nonexistent"), "Error should reference the correct path")
                print("✅ Correctly handled directoryNotFound: \(path)")
            default:
                #expect(Bool(false), "Should throw directoryNotFound, got \(error)")
            }
        } catch {
            #expect(Bool(false), "Should throw ImportError, got \(error)")
        }
    }

    @Test("ImportError.fileFailed handling with corrupted data")
    func testFileFailedErrorHandling() async throws {
        let importer = AltoIndexImporter(database: database)

        // Create corrupted file
        let tempDirectory = FileManager.default.temporaryDirectory
        let corruptedFile = tempDirectory.appendingPathComponent("corrupted.md")

        // Invalid UTF-8 sequence
        let corruptedData = Data([0xFF, 0xFE, 0xFD, 0xFC])
        try corruptedData.write(to: corruptedFile)

        defer {
            try? FileManager.default.removeItem(at: corruptedFile)
        }

        // Test error handling
        do {
            _ = try await importer.importNote(from: corruptedFile)
            #expect(Bool(false), "Should have thrown an error for corrupted file")
        } catch {
            // Should handle gracefully (either ImportError.fileFailed or other appropriate error)
            #expect(error != nil, "Should throw some error for corrupted data")
            print("✅ Correctly handled corrupted file: \(error.localizedDescription)")
        }
    }

    @Test("Memory pressure error handling")
    func testMemoryPressureHandling() async throws {
        let importer = AltoIndexImporter(database: database)

        // Create context with very low memory limit
        let context = ImportTestHarness.TestExecutionContext(
            database: database,
            memoryLimit: 1024 // 1KB limit
        )

        // Generate large test data that exceeds memory limit
        let largeContent = String(repeating: "This is a very long note content that will consume significant memory. ", count: 1000)
        let largeMarkdown = """
        ---
        title: "Large Test Note"
        id: "large-note"
        ---

        \(largeContent)
        """

        let largeData = largeMarkdown.data(using: .utf8)!

        // Test memory pressure handling
        let result = try await testHarness.testRoundTrip(
            importer: importer,
            originalData: largeData,
            context: context
        )

        // Should either succeed with reasonable memory usage or fail gracefully
        if result.success {
            #expect(result.metrics.memoryUsed <= context.memoryLimit * 2, "Should not use excessive memory")
        } else {
            #expect(result.error != nil, "Should provide meaningful error for memory pressure")
        }

        print("✅ Memory pressure test: Success=\(result.success), Memory=\(result.metrics.memoryUsed) bytes")
    }

    // MARK: - Data Integrity Validation

    @Test("LATCH property mapping validation")
    func testLATCHPropertyMapping() async throws {
        let importer = AltoIndexImporter(database: database)

        let testContent = """
        ---
        title: "LATCH Test Note"
        id: "latch-test"
        created: "2024-01-15T10:00:00Z"
        modified: "2024-01-15T11:00:00Z"
        folder: "category-test"
        attachments:
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\\"tag link\\" href=\\"/tags/Hierarchy\\">#Hierarchy</a>"
        ---

        # Test Note for LATCH Validation

        Content for testing alphabetical organization.
        """

        let testData = testContent.data(using: .utf8)!

        // Import the data
        let importResult = try await importer.importData(testData, filename: "latch-test.md", folder: nil)

        #expect(importResult.imported == 1, "Should import one note")

        let node = importResult.nodes.first!

        // Validate LATCH properties
        // L - Location (not used in alto-index typically)
        #expect(node.latitude == nil && node.longitude == nil, "Location should be nil for alto-index")

        // A - Alphabet (name/title)
        #expect(node.name == "LATCH Test Note", "Alphabetical name should be preserved")
        #expect(!node.name.isEmpty, "Name should not be empty")

        // T - Time (created/modified dates)
        let expectedCreated = ISO8601DateFormatter().date(from: "2024-01-15T10:00:00Z")!
        let expectedModified = ISO8601DateFormatter().date(from: "2024-01-15T11:00:00Z")!
        #expect(abs(node.createdAt.timeIntervalSince(expectedCreated)) < 1.0, "Created time should be preserved")
        #expect(abs(node.modifiedAt.timeIntervalSince(expectedModified)) < 1.0, "Modified time should be preserved")
        #expect(node.createdAt <= node.modifiedAt, "Created should be before or equal to modified")

        // C - Category (folder)
        #expect(node.folder == "category-test", "Category folder should be preserved")

        // H - Hierarchy (tags/sort order)
        #expect(node.tags.contains("Hierarchy"), "Hierarchy tag should be extracted")
        #expect(node.sortOrder >= 0, "Sort order should be non-negative")

        print("✅ LATCH validation: L=✓, A=✓, T=✓, C=✓, H=✓")
    }

    @Test("Content integrity with special characters and formatting")
    func testContentIntegrityWithSpecialCharacters() async throws {
        let importer = AltoIndexImporter(database: database)

        let specialContent = """
        ---
        title: "Special Characters Test"
        id: "special-chars"
        ---

        # Unicode and Special Character Test

        ## Various Encodings
        - English: Hello, World!
        - Japanese: こんにちは世界！
        - Arabic: مرحبا بالعالم!
        - Emoji: 🌍🚀💻📱
        - Math: ∑∞∆√π∫
        - Symbols: ©®™€£¥

        ## Special Markdown
        **Bold** *italic* ~~strikethrough~~
        `inline code`

        > Blockquote with special chars: <>&"'

        ### Code Block
        ```
        function test() {
            return "Preserve this formatting";
        }
        ```

        | Table | With | Unicode |
        |-------|------|---------|
        | 日本語  | Ελληνικά | العربية |

        [Link with spaces and special chars](https://example.com/path?q=hello%20world&x=1)
        """

        let testData = specialContent.data(using: .utf8)!

        // Execute round-trip test
        let result = try await testHarness.testRoundTrip(
            importer: importer,
            originalData: testData
        )

        #expect(result.success, "Special character round-trip should succeed")

        // Verify content preservation
        let node = result.importResult!.nodes.first!
        let preservedContent = node.content!

        // Check that key special characters are preserved
        #expect(preservedContent.contains("こんにちは世界"), "Japanese characters should be preserved")
        #expect(preservedContent.contains("مرحبا بالعالم"), "Arabic characters should be preserved")
        #expect(preservedContent.contains("🌍🚀💻📱"), "Emojis should be preserved")
        #expect(preservedContent.contains("∑∞∆√π∫"), "Mathematical symbols should be preserved")
        #expect(preservedContent.contains("©®™€£¥"), "Currency and copyright symbols should be preserved")
        #expect(preservedContent.contains("**Bold**"), "Markdown formatting should be preserved")
        #expect(preservedContent.contains("```"), "Code blocks should be preserved")

        print("✅ Special character preservation: Unicode=✓, Emoji=✓, Math=✓, Markdown=✓")
    }

    // MARK: - Integration with React Components

    @Test("React component data format compatibility")
    func testReactComponentDataCompatibility() async throws {
        let importer = AltoIndexImporter(database: database)

        // Import test data
        let testContent = """
        ---
        title: "React Integration Test"
        id: "react-test"
        created: "2024-01-15T10:00:00Z"
        modified: "2024-01-15T10:30:00Z"
        folder: "react-tests"
        ---

        # React Component Integration

        This note tests integration with React import components.
        """

        let testData = testContent.data(using: .utf8)!
        let importResult = try await importer.importData(testData, filename: "react-test.md", folder: nil)

        #expect(importResult.imported == 1, "Should import one note")

        let node = importResult.nodes.first!

        // Verify React component expected properties
        #expect(node.id.count > 0, "Node should have valid ID")
        #expect(node.nodeType == "note", "Node type should match React expectations")
        #expect(node.name == "React Integration Test", "Name should be properly formatted")
        #expect(node.summary != nil, "Summary should be generated for React display")
        #expect(node.source == "apple-notes", "Source should be identifiable")
        #expect(node.version > 0, "Version should be positive")

        // Verify date formatting compatibility
        let dateFormatter = ISO8601DateFormatter()
        let createdString = dateFormatter.string(from: node.createdAt)
        let modifiedString = dateFormatter.string(from: node.modifiedAt)

        #expect(createdString.contains("2024-01-15"), "Created date should be serializable")
        #expect(modifiedString.contains("2024-01-15"), "Modified date should be serializable")

        // Verify optional fields handle null properly
        if node.latitude == nil {
            #expect(node.longitude == nil, "Longitude should also be nil if latitude is nil")
        }

        print("✅ React compatibility: ID=✓, Type=✓, Dates=✓, Optional fields=✓")
    }

    // MARK: - Helper Methods

    private func extractPercentage(from text: String) -> Double {
        let pattern = #"(\d+(?:\.\d+)?)%"#
        let regex = try! NSRegularExpression(pattern: pattern)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)

        if let match = regex.firstMatch(in: text, options: [], range: range) {
            let percentageRange = Range(match.range(at: 1), in: text)!
            let percentageString = String(text[percentageRange])
            return Double(percentageString) ?? 0.0
        }

        return 0.0
    }
}

// MARK: - Extensions for Testing Protocol Conformance

extension SQLiteFileImporter: ImporterProtocol {
    public func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Create temporary file for content-based import
        let tempDirectory = FileManager.default.temporaryDirectory
        let tempFile = tempDirectory.appendingPathComponent(filename)

        try content.write(to: tempFile)
        defer {
            try? FileManager.default.removeItem(at: tempFile)
        }

        return try await importDatabase(from: tempFile)
    }

    public var supportedExtensions: [String] {
        return ["db", "sqlite", "sqlite3"]
    }

    public var importerName: String {
        return "SQLiteFileImporter"
    }
}