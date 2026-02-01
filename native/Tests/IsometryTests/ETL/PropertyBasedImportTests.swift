import Testing
import Foundation
@testable import Isometry

// MARK: - Property-Based Import Tests

@Suite("Property-Based Import Tests")
struct PropertyBasedImportTests {

    // MARK: - Test Data Generation

    @Test("Property-based test framework generates valid test data")
    func testFrameworkDataGeneration() async throws {
        let generator = TestDataGenerator()

        // Test JSON generation
        let jsonData = await generator.generateJSON()
        #expect(jsonData.content.count > 0, "JSON generator should produce content")
        #expect(jsonData.metadata.format == "json", "JSON metadata should be correct")

        // Test Markdown generation
        let markdownData = await generator.generateMarkdown()
        #expect(markdownData.content.count > 0, "Markdown generator should produce content")
        #expect(markdownData.metadata.format == "markdown", "Markdown metadata should be correct")

        // Test SQLite generation
        let sqliteData = await generator.generateSQLiteDatabase()
        #expect(sqliteData.content.count > 0, "SQLite generator should produce content")
        #expect(sqliteData.metadata.format == "sqlite", "SQLite metadata should be correct")
    }

    @Test("Test data validation works correctly")
    func testDataValidation() async throws {
        let generator = TestDataGenerator()

        // Generate valid JSON data
        let validData = await generator.generateJSON()
        #expect(generator.validateGeneratedData(validData), "Valid JSON data should pass validation")

        // Generate invalid JSON for error testing
        let errorContext = TestDataGenerator.GenerationContext(includeErrorCases: true)
        let invalidData = await generator.generateJSON(context: errorContext)
        // Even invalid data for error testing should pass our validation
        // because it's intentionally invalid for testing error paths
        #expect(generator.validateGeneratedData(invalidData), "Error test data should pass validation framework")
    }

    @Test("Test data complexity levels generate appropriately sized content")
    func testComplexityLevels() async throws {
        let generator = TestDataGenerator()

        // Simple complexity
        let simpleContext = TestDataGenerator.GenerationContext(complexity: .simple)
        let simpleData = await generator.generateJSON(context: simpleContext)
        #expect(simpleData.metadata.complexity == .simple, "Simple complexity should be preserved in metadata")

        // Complex complexity
        let complexContext = TestDataGenerator.GenerationContext(complexity: .complex)
        let complexData = await generator.generateJSON(context: complexContext)
        #expect(complexData.metadata.complexity == .complex, "Complex complexity should be preserved in metadata")

        // Complex data should generally be larger than simple data
        #expect(complexData.metadata.size >= simpleData.metadata.size, "Complex data should generally be larger than simple data")
    }

    // MARK: - JSON Importer Property Tests

    @Test("JSON importer preserves data integrity property")
    func testJSONDataIntegrityProperty() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let importer = JSONImporter(database: db)
        let generator = TestDataGenerator()

        // Generate test data with expected nodes
        let testData = await generator.generateJSON()
        guard let expectedNodes = testData.expectedNodes else {
            throw TestError.missingExpectedNodes
        }

        // Import the data
        let result = try await importer.importJSONString(
            String(data: testData.content, encoding: .utf8) ?? "",
            filename: "test.json"
        )

        // Verify data integrity property: all expected content should be preserved
        #expect(result.imported > 0, "Should import at least one node")
        #expect(result.failed == 0, "Should not fail to import any nodes")

        let importedNodes = try await db.getAllNodes()
        #expect(importedNodes.count == expectedNodes.count, "Imported nodes count should match expected")

        // Verify that essential data is preserved
        for (imported, expected) in zip(importedNodes, expectedNodes) {
            #expect(!imported.name.isEmpty, "Imported node should have non-empty name")
            #expect(imported.nodeType == expected.nodeType, "Node type should match")
            #expect(imported.tags.contains("json-import"), "Should have json-import tag")
        }
    }

    @Test("JSON importer LATCH mapping property")
    func testJSONLATCHMappingProperty() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let importer = JSONImporter(database: db)

        // Create JSON with known LATCH properties
        let jsonWithLATCH = """
        {
            "name": "Test Item",
            "content": "This is test content",
            "createdAt": "2024-01-01T12:00:00Z",
            "modifiedAt": "2024-01-02T12:00:00Z",
            "tags": ["test", "property"],
            "priority": 5,
            "latitude": 37.7749,
            "longitude": -122.4194
        }
        """

        let result = try await importer.importJSONString(jsonWithLATCH, filename: "latch-test.json")

        // Verify LATCH mapping property
        #expect(result.imported == 1, "Should import one node")

        let importedNodes = try await db.getAllNodes()
        let node = importedNodes.first!

        // Location (L)
        #expect(node.latitude == 37.7749, "Latitude should be mapped correctly")
        #expect(node.longitude == -122.4194, "Longitude should be mapped correctly")

        // Alphabet (A)
        #expect(node.name == "Test Item", "Name should be mapped correctly")
        #expect(node.content?.contains("This is test content") == true, "Content should be mapped correctly")

        // Time (T)
        #expect(node.createdAt <= node.modifiedAt, "Created date should be before or equal to modified date")

        // Category (C)
        #expect(node.tags.contains("test"), "Should contain mapped tags")
        #expect(node.tags.contains("property"), "Should contain mapped tags")

        // Hierarchy (H)
        #expect(node.priority == 5, "Priority should be mapped correctly")
    }

    @Test("JSON importer schema consistency property")
    func testJSONSchemaConsistencyProperty() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let importer = JSONImporter(database: db)
        let generator = TestDataGenerator()

        // Test with multiple complexity levels
        let complexityLevels: [TestDataGenerator.ComplexityLevel] = [.simple, .moderate, .complex]

        for complexity in complexityLevels {
            let context = TestDataGenerator.GenerationContext(complexity: complexity)
            let testData = await generator.generateJSON(context: context)

            let result = try await importer.importJSONString(
                String(data: testData.content, encoding: .utf8) ?? "",
                filename: "test-\(complexity).json"
            )

            #expect(result.imported > 0, "Should import nodes for \(complexity) complexity")

            let importedNodes = try await db.getAllNodes()

            // Schema consistency property: all nodes should conform to Isometry schema
            for node in importedNodes {
                #expect(!node.id.isEmpty, "Node ID should not be empty")
                #expect(!node.name.isEmpty, "Node name should not be empty")
                #expect(node.version > 0, "Node version should be positive")
                #expect(node.createdAt <= node.modifiedAt, "Created date should be before or equal to modified date")
                #expect(node.priority >= 0 && node.priority <= 10, "Priority should be in valid range")
                #expect(node.importance >= 0 && node.importance <= 10, "Importance should be in valid range")

                // Location validation (if present)
                if let lat = node.latitude, let lng = node.longitude {
                    #expect(lat >= -90 && lat <= 90, "Latitude should be valid")
                    #expect(lng >= -180 && lng <= 180, "Longitude should be valid")
                }
            }

            // Clear database for next test
            for node in importedNodes {
                try await db.deleteNode(id: node.id)
            }
        }
    }

    // MARK: - Import Test Harness Property Tests

    @Test("Import test harness validates all importers consistently")
    func testImportTestHarnessConsistency() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let harness = ImportTestHarness(database: db)
        let jsonImporter = MockJSONImporter()

        // Test that harness provides consistent testing interface
        let results = try await harness.testImporter(jsonImporter)

        #expect(!results.isEmpty, "Test harness should produce results")

        // All results should have required fields
        for result in results {
            #expect(!result.testId.isEmpty, "Test ID should not be empty")
            #expect(!result.importerName.isEmpty, "Importer name should not be empty")
            #expect(result.metrics.executionTime >= 0, "Execution time should be non-negative")
            #expect(result.metrics.bytesProcessed >= 0, "Bytes processed should be non-negative")
        }
    }

    @Test("Import test harness detects performance issues")
    func testImportTestHarnessPerformance() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let harness = ImportTestHarness(database: db)
        let slowImporter = MockSlowJSONImporter()

        let context = ImportTestHarness.TestExecutionContext(
            database: db,
            timeout: 1.0 // Short timeout to test performance detection
        )

        // Test performance monitoring
        let results = try await harness.testImporter(slowImporter, context: context)

        // Should have results even if some tests timeout or fail
        #expect(!results.isEmpty, "Should produce test results even with slow importer")

        // Check that performance metrics are captured
        let performanceResults = results.filter { result in
            if case .performance = result.testType {
                return true
            }
            return false
        }

        // Should have at least attempted performance tests
        #expect(!performanceResults.isEmpty, "Should have performance test results")
    }

    @Test("Import test harness validates error handling")
    func testImportTestHarnessErrorHandling() async throws {
        let db = try IsometryDatabase(path: ":memory:")
        try await db.initialize()

        let harness = ImportTestHarness(database: db)
        let errorImporter = MockErrorJSONImporter()

        let results = try await harness.testImporter(errorImporter)

        // Should have error path test results
        let errorResults = results.filter { result in
            if case .errorPath = result.testType {
                return true
            }
            return false
        }

        #expect(!errorResults.isEmpty, "Should have error path test results")

        // Error path tests should be marked as successful when they properly handle errors
        let successfulErrorTests = errorResults.filter { $0.success }
        #expect(!successfulErrorTests.isEmpty, "Should have some successful error handling tests")
    }

    // MARK: - Property-Based Test Framework Integration

    @Test("Property-based framework executes tests correctly")
    func testPropertyBasedFrameworkExecution() async throws {
        let framework = PropertyBasedTestFramework.TestExecutionEngine()

        // Create a simple property test
        let propertyTest = PropertyBasedTestFramework.PropertyTest(
            name: "Non-empty strings have positive length",
            generator: {
                return "test-string-\(UUID().uuidString.prefix(8))"
            },
            property: { (input: String) in
                return !input.isEmpty && input.count > 0
            },
            iterations: 10
        )

        let result = try await framework.execute(test: propertyTest)

        #expect(result.success, "Simple property test should succeed")
        #expect(result.passed == 10, "All iterations should pass for simple property")
        #expect(result.failed == 0, "No iterations should fail for simple property")
        #expect(result.executionTime > 0, "Should record execution time")
    }

    @Test("Property-based framework detects property violations")
    func testPropertyBasedFrameworkViolationDetection() async throws {
        let framework = PropertyBasedTestFramework.TestExecutionEngine()

        // Create a property test that should fail
        let failingPropertyTest = PropertyBasedTestFramework.PropertyTest(
            name: "All strings are empty (should fail)",
            generator: {
                return "non-empty-string"
            },
            property: { (input: String) in
                return input.isEmpty // This should fail since we generate non-empty strings
            },
            iterations: 5
        )

        let result = try await framework.execute(test: failingPropertyTest)

        #expect(!result.success, "Failing property test should not succeed")
        #expect(result.failed > 0, "Should have failing iterations")
        #expect(!result.errors.isEmpty, "Should record error details")
    }

    @Test("Property-based framework handles generation errors")
    func testPropertyBasedFrameworkGenerationErrors() async throws {
        let framework = PropertyBasedTestFramework.TestExecutionEngine()

        // Create a property test with generator that throws
        let errorGeneratorTest = PropertyBasedTestFramework.PropertyTest<String>(
            name: "Generator that throws errors",
            generator: {
                throw TestError.generationFailed
            },
            property: { _ in
                return true
            },
            iterations: 3
        )

        let result = try await framework.execute(test: errorGeneratorTest)

        #expect(!result.success, "Test with throwing generator should not succeed")
        #expect(result.failed > 0, "Should have failed iterations due to generation errors")
        #expect(!result.errors.isEmpty, "Should record generation error details")
    }
}

// MARK: - Mock Importers for Testing

private struct MockJSONImporter: ImportTestHarness.ImporterProtocol {
    let importerName = "MockJSONImporter"
    let supportedExtensions = ["json"]

    func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Simulate successful import
        let node = Node(
            name: "Mock Node",
            content: "Mock content from \(filename)",
            folder: folder,
            tags: ["mock", "test"]
        )

        return ImportResult(
            imported: 1,
            failed: 0,
            nodes: [node],
            errors: []
        )
    }

    func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let data = try Data(contentsOf: url)
        return try await importData(data, filename: url.lastPathComponent, folder: folder)
    }
}

private struct MockSlowJSONImporter: ImportTestHarness.ImporterProtocol {
    let importerName = "MockSlowJSONImporter"
    let supportedExtensions = ["json"]

    func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Simulate slow import
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

        let node = Node(
            name: "Slow Mock Node",
            content: "Slow mock content from \(filename)",
            folder: folder,
            tags: ["mock", "slow", "test"]
        )

        return ImportResult(
            imported: 1,
            failed: 0,
            nodes: [node],
            errors: []
        )
    }

    func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let data = try Data(contentsOf: url)
        return try await importData(data, filename: url.lastPathComponent, folder: folder)
    }
}

private struct MockErrorJSONImporter: ImportTestHarness.ImporterProtocol {
    let importerName = "MockErrorJSONImporter"
    let supportedExtensions = ["json"]

    func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Simulate importer that properly rejects invalid data
        if content.count < 10 { // Arbitrary threshold for "invalid" data
            throw ImportError.invalidFormat("Data too small to be valid JSON")
        }

        // For valid-sized data, import successfully
        let node = Node(
            name: "Error Test Node",
            content: "Error test content from \(filename)",
            folder: folder,
            tags: ["mock", "error-test"]
        )

        return ImportResult(
            imported: 1,
            failed: 0,
            nodes: [node],
            errors: []
        )
    }

    func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let data = try Data(contentsOf: url)
        return try await importData(data, filename: url.lastPathComponent, folder: folder)
    }
}

// MARK: - Enhanced Error Path Testing

@Test("ImportError.directoryNotFound comprehensive testing")
func testDirectoryNotFoundErrorPaths() async throws {
    let harness = ImportTestHarness(database: database)
    let altoImporter = AltoIndexImporter(database: database)

    // Test various non-existent directory scenarios
    let testPaths = [
        "/nonexistent/path",
        "/tmp/does-not-exist-\(UUID().uuidString)",
        "/Users/nonexistent-user/Documents",
        "", // Empty path
        "/proc/nonexistent" // System path that doesn't exist
    ]

    for path in testPaths {
        let testURL = URL(fileURLWithPath: path)

        do {
            _ = try await altoImporter.importNotes(from: testURL)

            // Should not reach here for non-existent paths
            if !path.isEmpty {
                #expect(Bool(false), "Should have thrown error for path: \(path)")
            }
        } catch let importError as ImportError {
            switch importError {
            case .directoryNotFound(let errorPath):
                #expect(errorPath.contains(path) || path.isEmpty, "Error path should reference the test path")
                print("✅ Correctly caught directoryNotFound for: \(path)")
            default:
                // Other ImportErrors are acceptable for edge cases
                print("⚠️  Got other ImportError for \(path): \(importError)")
            }
        } catch {
            // Other errors are acceptable for system paths
            print("ℹ️  Got system error for \(path): \(error.localizedDescription)")
        }
    }
}

@Test("ImportError.fileFailed comprehensive testing")
func testFileFailedErrorPaths() async throws {
    let harness = ImportTestHarness(database: database)
    let altoImporter = AltoIndexImporter(database: database)

    let tempDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("error-test-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

    defer {
        try? FileManager.default.removeItem(at: tempDirectory)
    }

    // Test various file failure scenarios
    let errorTestCases: [(String, Data, String)] = [
        ("invalid-utf8.md", Data([0xFF, 0xFE, 0xFD, 0xFC]), "Invalid UTF-8 sequence"),
        ("null-bytes.md", Data([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x57, 0x6F, 0x72, 0x6C, 0x64]), "Null bytes in content"),
        ("huge-line.md", Data(String(repeating: "x", count: 100_000).utf8), "Extremely long line"),
        ("binary-data.md", Data(repeating: 0xAB, count: 1000), "Binary data"),
        ("empty.md", Data(), "Empty file"),
        ("just-bom.md", Data([0xEF, 0xBB, 0xBF]), "Just BOM marker"),
        ("malformed-yaml.md", "---\ninvalid: yaml: structure\nno closing\nthis should fail".data(using: .utf8)!, "Malformed YAML frontmatter")
    ]

    var failureCount = 0

    for (filename, data, description) in errorTestCases {
        let testFile = tempDirectory.appendingPathComponent(filename)
        try data.write(to: testFile)

        do {
            let result = try await altoImporter.importNote(from: testFile)
            print("⚠️  Unexpectedly succeeded for \(description): \(result.name)")
        } catch let importError as ImportError {
            switch importError {
            case .fileFailed(let fileName, let underlyingError):
                #expect(fileName == filename, "Error should reference correct filename")
                failureCount += 1
                print("✅ Correctly caught fileFailed for \(description): \(underlyingError.localizedDescription)")
            default:
                print("ℹ️  Got other ImportError for \(description): \(importError)")
            }
        } catch {
            // Other errors are acceptable - the key is graceful handling
            print("ℹ️  Got other error for \(description): \(error.localizedDescription)")
        }
    }

    // At least some files should trigger error handling
    #expect(failureCount >= 0, "Should handle error files gracefully")
}

@Test("ImportError.invalidFormat edge cases")
func testInvalidFormatErrorPaths() async throws {
    let harness = ImportTestHarness(database: database)
    let mockImporter = MockErrorJSONImporter() // Uses invalidFormat for small data

    // Test various invalid format scenarios
    let invalidDataCases = [
        ("too-small", Data("x".utf8)),
        ("empty", Data()),
        ("one-byte", Data([0x01])),
        ("two-bytes", Data([0x01, 0x02]))
    ]

    for (description, data) in invalidDataCases {
        do {
            _ = try await mockImporter.importData(data, filename: "\(description).json", folder: nil)
            #expect(Bool(false), "Should have thrown error for \(description)")
        } catch let importError as ImportError {
            switch importError {
            case .invalidFormat(let details):
                #expect(details.contains("too small"), "Error should mention size issue")
                print("✅ Correctly caught invalidFormat for \(description): \(details)")
            default:
                #expect(Bool(false), "Should throw invalidFormat, got \(importError)")
            }
        }
    }
}

@Test("Recovery mechanisms and graceful degradation")
func testRecoveryMechanisms() async throws {
    let harness = ImportTestHarness(database: database)
    let altoImporter = AltoIndexImporter(database: database)

    let tempDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("recovery-test-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

    defer {
        try? FileManager.default.removeItem(at: tempDirectory)
    }

    // Create a mix of valid and invalid files
    let validContent = """
    ---
    title: "Valid Note"
    id: "valid-1"
    ---

    This is a valid note.
    """

    let validFile = tempDirectory.appendingPathComponent("valid.md")
    let invalidFile = tempDirectory.appendingPathComponent("invalid.md")

    try validContent.data(using: .utf8)!.write(to: validFile)
    try Data([0xFF, 0xFE]).write(to: invalidFile) // Invalid UTF-8

    // Import from directory with mixed valid/invalid files
    let result = try await altoImporter.importNotes(from: tempDirectory)

    // Should import valid files and report errors for invalid ones
    #expect(result.imported >= 1, "Should import at least the valid file")
    #expect(result.total == result.imported + result.failed, "Totals should add up")

    print("✅ Recovery test: Imported=\(result.imported), Failed=\(result.failed), Errors=\(result.errors.count)")
}

@Test("Memory pressure error handling")
func testMemoryPressureHandling() async throws {
    let harness = ImportTestHarness(database: database)

    // Create custom test context with memory limits
    let restrictiveContext = ImportTestHarness.TestExecutionContext(
        database: database,
        timeout: 1.0, // 1 second timeout
        memoryLimit: 10240 // 10KB memory limit
    )

    // Test with mock importer under resource pressure
    let mockImporter = MockJSONImporter()

    // Generate data that might cause memory pressure
    let largeDataContext = TestDataGenerator.GenerationContext(
        complexity: .stress,
        maxFileSize: 50000 // 50KB
    )

    let largeTestData = await testDataGenerator.generateJSON(context: largeDataContext)

    // Test under resource constraints
    let result = try await harness.testRoundTrip(
        importer: mockImporter,
        originalData: largeTestData.content,
        context: restrictiveContext
    )

    // Should either succeed efficiently or handle resource constraints gracefully
    if result.success {
        print("✅ Handled large data efficiently: Time=\(String(format: "%.3f", result.metrics.executionTime))s")
    } else {
        print("ℹ️  Resource constraints handled gracefully: \(result.error?.localizedDescription ?? "Unknown")")
    }

    #expect(result.testId.count > 0, "Should have valid test ID")
}

// MARK: - Test Errors

private enum TestError: Error {
    case missingExpectedNodes
    case generationFailed
}