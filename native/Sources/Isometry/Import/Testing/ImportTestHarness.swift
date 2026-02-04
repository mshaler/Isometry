import Foundation
import Testing

// MARK: - Import Test Harness

/// Unified test harness providing consistent testing interface across all importers
/// Coordinates testing for all importer types with performance profiling and validation
public actor ImportTestHarness {

    // MARK: - Core Types

    /// Test execution context containing database, temp files, and configuration
    public struct TestExecutionContext {
        public let testId: String
        public let database: IsometryDatabase
        public let tempDirectory: URL
        public let timeout: TimeInterval
        public let memoryLimit: Int64  // bytes
        public let enableProfiling: Bool
        public let cleanupOnCompletion: Bool

        public init(
            testId: String = UUID().uuidString,
            database: IsometryDatabase,
            tempDirectory: URL? = nil,
            timeout: TimeInterval = 30.0,
            memoryLimit: Int64 = 100 * 1024 * 1024, // 100MB
            enableProfiling: Bool = true,
            cleanupOnCompletion: Bool = true
        ) {
            self.testId = testId
            self.database = database
            self.tempDirectory = tempDirectory ?? FileManager.default.temporaryDirectory.appendingPathComponent("isometry-test-\(testId)")
            self.timeout = timeout
            self.memoryLimit = memoryLimit
            self.enableProfiling = enableProfiling
            self.cleanupOnCompletion = cleanupOnCompletion
        }
    }

    // Import protocols are now defined in ImportProtocols.swift
    // This allows both production and test code to use the same protocols

    /// Comprehensive test result with metrics and validation data
    public struct TestResult {
        public let testId: String
        public let importerName: String
        public let testType: TestType
        public let success: Bool
        public let importResult: ImportResult?
        public let error: Error?
        public let metrics: TestMetrics
        public let validationResults: [ValidationResult]
        public let executedAt: Date

        public init(
            testId: String,
            importerName: String,
            testType: TestType,
            success: Bool,
            importResult: ImportResult? = nil,
            error: Error? = nil,
            metrics: TestMetrics,
            validationResults: [ValidationResult] = [],
            executedAt: Date = Date()
        ) {
            self.testId = testId
            self.importerName = importerName
            self.testType = testType
            self.success = success
            self.importResult = importResult
            self.error = error
            self.metrics = metrics
            self.validationResults = validationResults
            self.executedAt = executedAt
        }
    }

    /// Type of test being performed
    public enum TestType {
        case roundTrip(originalData: Data)
        case performance(dataSize: Int)
        case errorPath(expectedError: String)
        case concurrent(threadCount: Int)
        case memoryLeak
        case validation
        case integration

        public var description: String {
            switch self {
            case .roundTrip: return "Round-trip validation"
            case .performance(let size): return "Performance test (\(size) bytes)"
            case .errorPath(let error): return "Error path test (\(error))"
            case .concurrent(let threads): return "Concurrent test (\(threads) threads)"
            case .memoryLeak: return "Memory leak detection"
            case .validation: return "Data validation"
            case .integration: return "Integration test"
            }
        }
    }

    /// Performance and resource metrics
    public struct TestMetrics {
        public let executionTime: TimeInterval
        public let memoryUsed: Int64
        public let peakMemory: Int64
        public let nodesProcessed: Int
        public let bytesProcessed: Int64
        public let throughput: Double // nodes per second

        public init(
            executionTime: TimeInterval,
            memoryUsed: Int64,
            peakMemory: Int64,
            nodesProcessed: Int,
            bytesProcessed: Int64
        ) {
            self.executionTime = executionTime
            self.memoryUsed = memoryUsed
            self.peakMemory = peakMemory
            self.nodesProcessed = nodesProcessed
            self.bytesProcessed = bytesProcessed
            self.throughput = executionTime > 0 ? Double(nodesProcessed) / executionTime : 0
        }
    }

    /// Validation result for specific aspect of imported data
    public struct ValidationResult {
        public let validationType: ValidationType
        public let passed: Bool
        public let details: String
        public let expectedValue: String?
        public let actualValue: String?

        public init(
            validationType: ValidationType,
            passed: Bool,
            details: String,
            expectedValue: String? = nil,
            actualValue: String? = nil
        ) {
            self.validationType = validationType
            self.passed = passed
            self.details = details
            self.expectedValue = expectedValue
            self.actualValue = actualValue
        }
    }

    /// Type of validation being performed
    public enum ValidationType {
        case schemaConformance
        case contentIntegrity
        case latchMapping
        case relationshipPreservation
        case performanceBounds
        case memoryUsage
        case errorHandling
    }

    // MARK: - Performance Baselines

    /// Performance baseline for an importer
    public struct PerformanceBaseline {
        public let importerName: String
        public let dataSize: Int
        public let avgExecutionTime: TimeInterval
        public let avgMemoryUsage: Int64
        public let avgThroughput: Double
        public let standardDeviation: Double
        public let sampleCount: Int
        public let establishedAt: Date

        public init(
            importerName: String,
            dataSize: Int,
            avgExecutionTime: TimeInterval,
            avgMemoryUsage: Int64,
            avgThroughput: Double,
            standardDeviation: Double,
            sampleCount: Int,
            establishedAt: Date = Date()
        ) {
            self.importerName = importerName
            self.dataSize = dataSize
            self.avgExecutionTime = avgExecutionTime
            self.avgMemoryUsage = avgMemoryUsage
            self.avgThroughput = avgThroughput
            self.standardDeviation = standardDeviation
            self.sampleCount = sampleCount
            self.establishedAt = establishedAt
        }

        /// Check if a test result represents a performance regression
        public func isRegression(testResult: TestResult, threshold: Double = 1.5) -> Bool {
            let executionTimeRegression = testResult.metrics.executionTime > (avgExecutionTime * threshold)
            let memoryRegression = testResult.metrics.memoryUsed > Int64(Double(avgMemoryUsage) * threshold)
            let throughputRegression = testResult.metrics.throughput < (avgThroughput / threshold)

            return executionTimeRegression || memoryRegression || throughputRegression
        }
    }

    // MARK: - Dependencies

    private let defaultDatabase: IsometryDatabase
    private let testDataGenerator: TestDataGenerator

    // MARK: - State

    private var activeTests: [String: TestExecutionContext] = [:]
    private var testHistory: [TestResult] = []
    private var performanceBaselines: [String: PerformanceBaseline] = [:] // Key: "importerName-dataSize"

    public init(database: IsometryDatabase) {
        self.defaultDatabase = database
        self.testDataGenerator = TestDataGenerator()
    }

    // MARK: - Public Testing Methods

    /// Execute comprehensive test suite for a specific importer
    public func testImporter<T: ImporterProtocol>(
        _ importer: T,
        context: TestExecutionContext? = nil
    ) async throws -> [TestResult] {
        let testContext = context ?? TestExecutionContext(database: defaultDatabase)

        // Setup test environment
        try await setupTestEnvironment(context: testContext)
        defer {
            if testContext.cleanupOnCompletion {
                Task { await cleanupTestEnvironment(context: testContext) }
            }
        }

        var results: [TestResult] = []

        // Run core test suite
        results.append(contentsOf: try await runSchemaValidationTests(importer: importer, context: testContext))
        results.append(contentsOf: try await runContentIntegrityTests(importer: importer, context: testContext))
        results.append(contentsOf: try await runRoundTripTests(importer: importer, context: testContext))
        results.append(contentsOf: try await runPerformanceTests(importer: importer, context: testContext))
        results.append(contentsOf: try await runErrorPathTests(importer: importer, context: testContext))

        // Store results
        testHistory.append(contentsOf: results)

        return results
    }

    /// Execute round-trip test: import → export → verify data integrity
    public func testRoundTrip<T: ImporterProtocol>(
        importer: T,
        originalData: Data,
        context: TestExecutionContext? = nil
    ) async throws -> TestResult {
        let testContext = context ?? TestExecutionContext(database: defaultDatabase)
        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        do {
            // Setup isolated database for this test
            let isolatedDb = try IsometryDatabase(path: ":memory:")
            try await isolatedDb.initialize()

            let testContextWithIsolatedDb = TestExecutionContext(
                testId: testContext.testId,
                database: isolatedDb,
                tempDirectory: testContext.tempDirectory,
                timeout: testContext.timeout,
                memoryLimit: testContext.memoryLimit,
                enableProfiling: testContext.enableProfiling,
                cleanupOnCompletion: testContext.cleanupOnCompletion
            )

            // Write original data to temp file
            let tempFile = testContext.tempDirectory.appendingPathComponent("test-input")
            try originalData.write(to: tempFile)

            // Import the data
            let importResult = try await importer.importFromFile(tempFile, folder: "test")

            // Verify import was successful
            guard importResult.imported > 0 else {
                throw ImportTestError.importFailed("No data was imported")
            }

            // Get imported nodes for comparison
            let importedNodes = try await isolatedDb.getAllNodes()

            // Perform enhanced round-trip validation if supported
            var validationResults: [ValidationResult] = []
            var roundTripResult: RoundTripValidationResult?

            if let exportableImporter = importer as? ExportableImporterProtocol {
                // Enhanced round-trip test with export
                let exportFile = testContext.tempDirectory.appendingPathComponent("test-export")
                let exportedData = try await exportableImporter.exportNodes(importedNodes, to: exportFile)

                roundTripResult = try await exportableImporter.validateRoundTripData(
                    original: originalData,
                    exported: exportedData
                )

                // Convert enhanced validation to ValidationResult format
                validationResults.append(ValidationResult(
                    validationType: .contentIntegrity,
                    passed: roundTripResult!.preservationAccuracy >= 0.999,
                    details: "Data preservation: \(roundTripResult!.preservationAccuracy * 100)%",
                    expectedValue: "≥99.9%",
                    actualValue: "\(roundTripResult!.preservationAccuracy * 100)%"
                ))

                validationResults.append(ValidationResult(
                    validationType: .latchMapping,
                    passed: roundTripResult!.latchMappingAccuracy >= 0.95,
                    details: "LATCH mapping: \(roundTripResult!.latchMappingAccuracy * 100)%",
                    expectedValue: "≥95%",
                    actualValue: "\(roundTripResult!.latchMappingAccuracy * 100)%"
                ))

                validationResults.append(ValidationResult(
                    validationType: .schemaConformance,
                    passed: roundTripResult!.schemaConformanceScore >= 0.95,
                    details: "Schema conformance: \(roundTripResult!.schemaConformanceScore * 100)%",
                    expectedValue: "≥95%",
                    actualValue: "\(roundTripResult!.schemaConformanceScore * 100)%"
                ))

            } else {
                // Fallback to basic round-trip validation
                validationResults = validateRoundTripIntegrity(
                    originalData: originalData,
                    importedNodes: importedNodes,
                    importer: importer
                )
            }

            let executionTime = Date().timeIntervalSince(startTime)
            let finalMemory = getCurrentMemoryUsage()
            let metrics = TestMetrics(
                executionTime: executionTime,
                memoryUsed: finalMemory - initialMemory,
                peakMemory: finalMemory,
                nodesProcessed: importResult.imported,
                bytesProcessed: Int64(originalData.count)
            )

            let isSuccess = if let rtResult = roundTripResult {
                rtResult.isAcceptable
            } else {
                validationResults.allSatisfy { $0.passed }
            }

            return TestResult(
                testId: testContext.testId,
                importerName: importer.importerName,
                testType: .roundTrip(originalData: originalData),
                success: isSuccess,
                importResult: importResult,
                metrics: metrics,
                validationResults: validationResults
            )

        } catch {
            let executionTime = Date().timeIntervalSince(startTime)
            let finalMemory = getCurrentMemoryUsage()
            let metrics = TestMetrics(
                executionTime: executionTime,
                memoryUsed: finalMemory - initialMemory,
                peakMemory: finalMemory,
                nodesProcessed: 0,
                bytesProcessed: Int64(originalData.count)
            )

            return TestResult(
                testId: testContext.testId,
                importerName: importer.importerName,
                testType: .roundTrip(originalData: originalData),
                success: false,
                error: error,
                metrics: metrics
            )
        }
    }

    /// Execute performance profiling test
    public func testPerformance<T: ImporterProtocol>(
        importer: T,
        dataSize: Int,
        context: TestExecutionContext? = nil
    ) async throws -> TestResult {
        let testContext = context ?? TestExecutionContext(database: defaultDatabase)

        // Generate performance test data
        let generationContext = TestDataGenerator.GenerationContext(
            complexity: .stress,
            maxFileSize: dataSize
        )

        let testData = await testDataGenerator.generateJSON(context: generationContext)
        return try await testRoundTrip(importer: importer, originalData: testData.content, context: testContext)
    }

    /// Execute memory leak detection test
    public func testMemoryLeaks<T: ImporterProtocol>(
        importer: T,
        iterations: Int = 10,
        context: TestExecutionContext? = nil
    ) async throws -> TestResult {
        let testContext = context ?? TestExecutionContext(database: defaultDatabase)
        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        var peakMemory = initialMemory
        var lastMemory = initialMemory

        do {
            // Run multiple import cycles to detect leaks
            for i in 0..<iterations {
                let testData = await testDataGenerator.generateJSON(context: TestDataGenerator.GenerationContext())

                // Create isolated database for each iteration
                let isolatedDb = try IsometryDatabase(path: ":memory:")
                try await isolatedDb.initialize()

                // Perform import
                _ = try await importer.importData(testData.content, filename: "test-\(i).json", folder: "test")

                // Check memory usage
                let currentMemory = getCurrentMemoryUsage()
                peakMemory = max(peakMemory, currentMemory)

                // Memory should not grow significantly between iterations
                if i > 0 {
                    let memoryGrowth = currentMemory - lastMemory
                    if memoryGrowth > (10 * 1024 * 1024) { // 10MB growth threshold
                        throw ImportTestError.memoryLeakDetected("Memory grew by \(memoryGrowth) bytes between iterations")
                    }
                }

                lastMemory = currentMemory

                // Force garbage collection attempt
                autoreleasepool { }
            }

            let executionTime = Date().timeIntervalSince(startTime)
            let finalMemory = getCurrentMemoryUsage()
            let totalMemoryGrowth = finalMemory - initialMemory

            let validationResults = [
                ValidationResult(
                    validationType: .memoryUsage,
                    passed: totalMemoryGrowth < (50 * 1024 * 1024), // 50MB threshold
                    details: "Total memory growth: \(totalMemoryGrowth) bytes",
                    expectedValue: "< 50MB",
                    actualValue: "\(totalMemoryGrowth) bytes"
                )
            ]

            let metrics = TestMetrics(
                executionTime: executionTime,
                memoryUsed: totalMemoryGrowth,
                peakMemory: peakMemory,
                nodesProcessed: iterations,
                bytesProcessed: 0
            )

            return TestResult(
                testId: testContext.testId,
                importerName: importer.importerName,
                testType: .memoryLeak,
                success: validationResults.allSatisfy { $0.passed },
                metrics: metrics,
                validationResults: validationResults
            )

        } catch {
            let executionTime = Date().timeIntervalSince(startTime)
            let finalMemory = getCurrentMemoryUsage()

            let metrics = TestMetrics(
                executionTime: executionTime,
                memoryUsed: finalMemory - initialMemory,
                peakMemory: peakMemory,
                nodesProcessed: 0,
                bytesProcessed: 0
            )

            return TestResult(
                testId: testContext.testId,
                importerName: importer.importerName,
                testType: .memoryLeak,
                success: false,
                error: error,
                metrics: metrics
            )
        }
    }

    // MARK: - Private Test Implementation

    private func runSchemaValidationTests<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test with valid data that should conform to schema
        let validData = await testDataGenerator.generateJSON(context: TestDataGenerator.GenerationContext())
        let validResult = try await testRoundTrip(importer: importer, originalData: validData.content, context: context)
        results.append(validResult)

        return results
    }

    private func runContentIntegrityTests<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test different complexity levels
        for complexity in [TestDataGenerator.ComplexityLevel.simple, .moderate, .complex] {
            let testData = await testDataGenerator.generateJSON(context: TestDataGenerator.GenerationContext(complexity: complexity))
            let result = try await testRoundTrip(importer: importer, originalData: testData.content, context: context)
            results.append(result)
        }

        return results
    }

    private func runRoundTripTests<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test with various data formats based on supported extensions
        for ext in importer.supportedExtensions.prefix(3) { // Limit to 3 formats for efficiency
            let testData: TestDataGenerator.GeneratedTestData

            switch ext.lowercased() {
            case "json":
                testData = await testDataGenerator.generateJSON()
            case "md", "markdown":
                testData = await testDataGenerator.generateMarkdown()
            case "html", "htm":
                testData = await testDataGenerator.generateHTML()
            case "sql", "sqlite", "db":
                testData = await testDataGenerator.generateSQLiteDatabase()
            default:
                testData = await testDataGenerator.generateJSON() // Default fallback
            }

            let result = try await testRoundTrip(importer: importer, originalData: testData.content, context: context)
            results.append(result)
        }

        return results
    }

    private func runPerformanceTests<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test with different data sizes
        let sizes = [1024, 10240, 102400] // 1KB, 10KB, 100KB
        for size in sizes {
            let result = try await testPerformance(importer: importer, dataSize: size, context: context)
            results.append(result)
        }

        return results
    }

    private func runErrorPathTests<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test 1: Invalid data handling
        let errorContext = TestDataGenerator.GenerationContext(includeErrorCases: true)
        let invalidData = await testDataGenerator.generateJSON(context: errorContext)

        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        do {
            // This should fail gracefully
            _ = try await importer.importData(invalidData.content, filename: "invalid.json", folder: "test")

            // If we get here without error, the importer didn't properly validate
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(invalidData.content.count)
            )

            results.append(TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "Should reject invalid data"),
                success: false,
                error: ImportTestError.errorPathFailed("Importer accepted invalid data"),
                metrics: metrics
            ))

        } catch {
            // Expected error - this is success for error path testing
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(invalidData.content.count)
            )

            results.append(TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "Invalid data rejection"),
                success: true,
                error: error,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: true,
                        details: "Properly rejected invalid data: \(error.localizedDescription)"
                    )
                ]
            ))
        }

        // Test 2: Directory not found error (for file-based importers)
        results.append(contentsOf: try await testDirectoryNotFoundError(importer: importer, context: context))

        // Test 3: File failed error
        results.append(contentsOf: try await testFileFailedError(importer: importer, context: context))

        // Test 4: Network/resource error simulation
        results.append(contentsOf: try await testResourceErrorHandling(importer: importer, context: context))

        return results
    }

    /// Test ImportError.directoryNotFound scenarios
    private func testDirectoryNotFoundError<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        let nonExistentDirectory = URL(fileURLWithPath: "/nonexistent/directory/path")

        do {
            _ = try await importer.importFromFile(nonExistentDirectory, folder: "test")

            // Should not reach here
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: 0
            )

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "DirectoryNotFound"),
                success: false,
                error: ImportTestError.errorPathFailed("Should have thrown directoryNotFound error"),
                metrics: metrics
            )]

        } catch let importError as ImportError {
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: 0
            )

            let success = switch importError {
            case .directoryNotFound:
                true
            default:
                false
            }

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "DirectoryNotFound"),
                success: success,
                error: importError,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: success,
                        details: success ? "Correctly identified directory not found" : "Wrong error type: \(importError)"
                    )
                ]
            )]

        } catch {
            // Other errors are also acceptable as long as they're handled gracefully
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: 0
            )

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "DirectoryNotFound"),
                success: true,
                error: error,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: true,
                        details: "Gracefully handled missing directory: \(error.localizedDescription)"
                    )
                ]
            )]
        }
    }

    /// Test ImportError.fileFailed scenarios
    private func testFileFailedError<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        // Create a corrupted/unreadable file
        let corruptedFile = context.tempDirectory.appendingPathComponent("corrupted.test")
        let corruptedData = Data([0xFF, 0xFE, 0xFD, 0xFC]) // Invalid UTF-8 sequence

        try corruptedData.write(to: corruptedFile)

        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        do {
            _ = try await importer.importFromFile(corruptedFile, folder: "test")

            // Should not reach here for truly corrupted data
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(corruptedData.count)
            )

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "FileFailed"),
                success: false,
                error: ImportTestError.errorPathFailed("Should have failed on corrupted file"),
                metrics: metrics
            )]

        } catch let importError as ImportError {
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(corruptedData.count)
            )

            let success = switch importError {
            case .fileFailed:
                true
            default:
                false
            }

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "FileFailed"),
                success: success,
                error: importError,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: success,
                        details: success ? "Correctly identified file processing failure" : "Wrong error type: \(importError)"
                    )
                ]
            )]

        } catch {
            // Other errors are acceptable as long as file processing failed gracefully
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(corruptedData.count)
            )

            return [TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "FileFailed"),
                success: true,
                error: error,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: true,
                        details: "Gracefully handled corrupted file: \(error.localizedDescription)"
                    )
                ]
            )]
        }
    }

    /// Test resource/network error handling
    private func testResourceErrorHandling<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext
    ) async throws -> [TestResult] {
        var results: [TestResult] = []

        // Test memory pressure scenario
        let largeDataContext = TestDataGenerator.GenerationContext(
            complexity: .stress,
            maxFileSize: Int(context.memoryLimit * 2) // Exceed memory limit
        )
        let largeData = await testDataGenerator.generateJSON(context: largeDataContext)

        let startTime = Date()
        let initialMemory = getCurrentMemoryUsage()

        do {
            _ = try await importer.importData(largeData.content, filename: "large.json", folder: "test")

            // If successful, check if memory usage was reasonable
            let memoryUsed = getCurrentMemoryUsage() - initialMemory
            let withinBounds = memoryUsed <= context.memoryLimit

            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: memoryUsed,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(largeData.content.count)
            )

            results.append(TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "MemoryPressure"),
                success: withinBounds,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .memoryUsage,
                        passed: withinBounds,
                        details: "Memory usage under pressure: \(memoryUsed) bytes",
                        expectedValue: "< \(context.memoryLimit) bytes",
                        actualValue: "\(memoryUsed) bytes"
                    )
                ]
            ))

        } catch {
            // Expected failure under memory pressure
            let metrics = TestMetrics(
                executionTime: Date().timeIntervalSince(startTime),
                memoryUsed: getCurrentMemoryUsage() - initialMemory,
                peakMemory: getCurrentMemoryUsage(),
                nodesProcessed: 0,
                bytesProcessed: Int64(largeData.content.count)
            )

            results.append(TestResult(
                testId: context.testId,
                importerName: importer.importerName,
                testType: .errorPath(expectedError: "MemoryPressure"),
                success: true,
                error: error,
                metrics: metrics,
                validationResults: [
                    ValidationResult(
                        validationType: .errorHandling,
                        passed: true,
                        details: "Gracefully handled memory pressure: \(error.localizedDescription)"
                    )
                ]
            ))
        }

        return results
    }

    // MARK: - Validation Methods

    private func validateRoundTripIntegrity(
        originalData: Data,
        importedNodes: [Node],
        importer: any ImporterProtocol
    ) -> [ValidationResult] {
        var results: [ValidationResult] = []

        // Schema conformance validation
        results.append(validateSchemaConformance(nodes: importedNodes))

        // Content integrity validation
        results.append(validateContentIntegrity(originalData: originalData, nodes: importedNodes, importer: importer))

        // LATCH mapping validation
        results.append(validateLATCHMapping(nodes: importedNodes))

        return results
    }

    private func validateSchemaConformance(nodes: [Node]) -> ValidationResult {
        for node in nodes {
            // Check required fields
            if node.id.isEmpty {
                return ValidationResult(
                    validationType: .schemaConformance,
                    passed: false,
                    details: "Node has empty ID",
                    expectedValue: "Non-empty ID",
                    actualValue: "Empty"
                )
            }

            if node.name.isEmpty {
                return ValidationResult(
                    validationType: .schemaConformance,
                    passed: false,
                    details: "Node has empty name",
                    expectedValue: "Non-empty name",
                    actualValue: "Empty"
                )
            }

            // Check version is positive
            if node.version <= 0 {
                return ValidationResult(
                    validationType: .schemaConformance,
                    passed: false,
                    details: "Node has invalid version: \(node.version)",
                    expectedValue: "> 0",
                    actualValue: "\(node.version)"
                )
            }

            // Check timestamps are valid
            if node.createdAt > node.modifiedAt {
                return ValidationResult(
                    validationType: .schemaConformance,
                    passed: false,
                    details: "Created date is after modified date",
                    expectedValue: "createdAt <= modifiedAt",
                    actualValue: "createdAt: \(node.createdAt), modifiedAt: \(node.modifiedAt)"
                )
            }
        }

        return ValidationResult(
            validationType: .schemaConformance,
            passed: true,
            details: "All \(nodes.count) nodes conform to schema"
        )
    }

    private func validateContentIntegrity(
        originalData: Data,
        nodes: [Node],
        importer: any ImporterProtocol
    ) -> ValidationResult {
        // Basic integrity check - imported nodes should contain meaningful data
        guard !nodes.isEmpty else {
            return ValidationResult(
                validationType: .contentIntegrity,
                passed: false,
                details: "No nodes were created from import",
                expectedValue: "> 0 nodes",
                actualValue: "0 nodes"
            )
        }

        // Check that content was preserved (at least some nodes should have content)
        let nodesWithContent = nodes.filter { $0.content != nil && !$0.content!.isEmpty }
        let contentRatio = Double(nodesWithContent.count) / Double(nodes.count)

        if contentRatio < 0.1 { // At least 10% of nodes should have content
            return ValidationResult(
                validationType: .contentIntegrity,
                passed: false,
                details: "Too few nodes have content: \(contentRatio * 100)%",
                expectedValue: ">= 10% with content",
                actualValue: "\(contentRatio * 100)% with content"
            )
        }

        return ValidationResult(
            validationType: .contentIntegrity,
            passed: true,
            details: "Content integrity preserved: \(nodesWithContent.count)/\(nodes.count) nodes have content"
        )
    }

    private func validateLATCHMapping(nodes: [Node]) -> ValidationResult {
        for node in nodes {
            // Location validation (if present)
            if let lat = node.latitude, let lng = node.longitude {
                if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
                    return ValidationResult(
                        validationType: .latchMapping,
                        passed: false,
                        details: "Invalid coordinates: (\(lat), \(lng))",
                        expectedValue: "Valid lat/lng",
                        actualValue: "(\(lat), \(lng))"
                    )
                }
            }

            // Alphabet validation (name)
            if node.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return ValidationResult(
                    validationType: .latchMapping,
                    passed: false,
                    details: "Node name is empty or whitespace only",
                    expectedValue: "Non-empty name",
                    actualValue: "'\(node.name)'"
                )
            }

            // Time validation (already checked in schema conformance)

            // Category validation (folder, if present)
            if let folder = node.folder, folder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return ValidationResult(
                    validationType: .latchMapping,
                    passed: false,
                    details: "Node folder is empty or whitespace only",
                    expectedValue: "Valid folder name or nil",
                    actualValue: "'\(folder)'"
                )
            }

            // Hierarchy validation (sort order)
            if node.sortOrder < 0 {
                return ValidationResult(
                    validationType: .latchMapping,
                    passed: false,
                    details: "Node has negative sort order: \(node.sortOrder)",
                    expectedValue: ">= 0",
                    actualValue: "\(node.sortOrder)"
                )
            }
        }

        return ValidationResult(
            validationType: .latchMapping,
            passed: true,
            details: "All \(nodes.count) nodes have valid LATCH properties"
        )
    }

    // MARK: - Utility Methods

    private func setupTestEnvironment(context: TestExecutionContext) async throws {
        // Create temp directory
        try FileManager.default.createDirectory(at: context.tempDirectory, withIntermediateDirectories: true, attributes: nil)

        // Store active test context
        activeTests[context.testId] = context
    }

    private func cleanupTestEnvironment(context: TestExecutionContext) async {
        // Remove temp directory
        try? FileManager.default.removeItem(at: context.tempDirectory)

        // Remove from active tests
        activeTests.removeValue(forKey: context.testId)
    }

    private func getCurrentMemoryUsage() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int64(info.resident_size)
        } else {
            return 0
        }
    }

    // MARK: - Test Statistics

    /// Get test statistics for reporting
    public func getTestStatistics() -> (
        totalTests: Int,
        successfulTests: Int,
        failedTests: Int,
        averageExecutionTime: TimeInterval,
        averageThroughput: Double
    ) {
        let totalTests = testHistory.count
        let successfulTests = testHistory.filter { $0.success }.count
        let failedTests = totalTests - successfulTests

        let averageExecutionTime = totalTests > 0 ? testHistory.map { $0.metrics.executionTime }.reduce(0, +) / Double(totalTests) : 0
        let averageThroughput = totalTests > 0 ? testHistory.map { $0.metrics.throughput }.reduce(0, +) / Double(totalTests) : 0

        return (
            totalTests: totalTests,
            successfulTests: successfulTests,
            failedTests: failedTests,
            averageExecutionTime: averageExecutionTime,
            averageThroughput: averageThroughput
        )
    }

    /// Clear test history
    public func clearHistory() {
        testHistory.removeAll()
    }

    // MARK: - Performance Baseline Management

    /// Establish performance baseline for an importer
    public func establishPerformanceBaseline<T: ImporterProtocol>(
        importer: T,
        dataSize: Int,
        iterations: Int = 10,
        context: TestExecutionContext? = nil
    ) async throws -> PerformanceBaseline {
        let testContext = context ?? TestExecutionContext(database: defaultDatabase)

        var metrics: [TestMetrics] = []

        // Run multiple iterations to establish baseline
        for _ in 0..<iterations {
            let result = try await testPerformance(importer: importer, dataSize: dataSize, context: testContext)
            metrics.append(result.metrics)
        }

        // Calculate statistics
        let executionTimes = metrics.map { $0.executionTime }
        let memoryUsages = metrics.map { $0.memoryUsed }
        let throughputs = metrics.map { $0.throughput }

        let avgExecutionTime = executionTimes.reduce(0, +) / Double(executionTimes.count)
        let avgMemoryUsage = memoryUsages.reduce(0, +) / Int64(memoryUsages.count)
        let avgThroughput = throughputs.reduce(0, +) / Double(throughputs.count)

        // Calculate standard deviation for execution time
        let variance = executionTimes.map { pow($0 - avgExecutionTime, 2) }.reduce(0, +) / Double(executionTimes.count)
        let standardDeviation = sqrt(variance)

        let baseline = PerformanceBaseline(
            importerName: importer.importerName,
            dataSize: dataSize,
            avgExecutionTime: avgExecutionTime,
            avgMemoryUsage: avgMemoryUsage,
            avgThroughput: avgThroughput,
            standardDeviation: standardDeviation,
            sampleCount: iterations
        )

        // Store baseline
        let key = "\(importer.importerName)-\(dataSize)"
        performanceBaselines[key] = baseline

        print("📊 Performance baseline established for \(importer.importerName):")
        print("   Data size: \(dataSize) bytes")
        print("   Avg execution time: \(String(format: "%.3f", avgExecutionTime))s")
        print("   Avg memory usage: \(avgMemoryUsage) bytes")
        print("   Avg throughput: \(String(format: "%.1f", avgThroughput)) nodes/s")
        print("   Standard deviation: \(String(format: "%.3f", standardDeviation))s")

        return baseline
    }

    /// Test performance against established baseline
    public func testPerformanceRegression<T: ImporterProtocol>(
        importer: T,
        dataSize: Int,
        context: TestExecutionContext? = nil
    ) async throws -> (result: TestResult, baseline: PerformanceBaseline?, isRegression: Bool) {
        let result = try await testPerformance(importer: importer, dataSize: dataSize, context: context)
        let key = "\(importer.importerName)-\(dataSize)"
        let baseline = performanceBaselines[key]

        let isRegression = baseline?.isRegression(testResult: result) ?? false

        if let baseline = baseline, isRegression {
            print("⚠️  Performance regression detected for \(importer.importerName):")
            print("   Baseline: \(String(format: "%.3f", baseline.avgExecutionTime))s")
            print("   Current:  \(String(format: "%.3f", result.metrics.executionTime))s")
            print("   Regression: \(String(format: "%.1f", (result.metrics.executionTime / baseline.avgExecutionTime) * 100 - 100))%")
        }

        return (result: result, baseline: baseline, isRegression: isRegression)
    }

    /// Establish baselines for all common data sizes
    public func establishComprehensiveBaselines<T: ImporterProtocol>(
        importer: T,
        context: TestExecutionContext? = nil
    ) async throws -> [PerformanceBaseline] {
        let dataSizes = [1024, 10240, 102400, 1024000] // 1KB, 10KB, 100KB, 1MB
        var baselines: [PerformanceBaseline] = []

        for dataSize in dataSizes {
            print("📊 Establishing baseline for \(importer.importerName) at \(dataSize) bytes...")
            let baseline = try await establishPerformanceBaseline(
                importer: importer,
                dataSize: dataSize,
                context: context
            )
            baselines.append(baseline)
        }

        return baselines
    }

    /// Get all established baselines
    public func getPerformanceBaselines() -> [PerformanceBaseline] {
        return Array(performanceBaselines.values)
    }

    /// Clear all baselines
    public func clearPerformanceBaselines() {
        performanceBaselines.removeAll()
    }
}

// MARK: - Test Errors

public enum ImportTestError: Error, LocalizedError {
    case importFailed(String)
    case memoryLeakDetected(String)
    case performanceThresholdExceeded(String)
    case validationFailed(String)
    case errorPathFailed(String)
    case setupFailed(String)

    public var errorDescription: String? {
        switch self {
        case .importFailed(let message):
            return "Import failed: \(message)"
        case .memoryLeakDetected(let message):
            return "Memory leak detected: \(message)"
        case .performanceThresholdExceeded(let message):
            return "Performance threshold exceeded: \(message)"
        case .validationFailed(let message):
            return "Validation failed: \(message)"
        case .errorPathFailed(let message):
            return "Error path test failed: \(message)"
        case .setupFailed(let message):
            return "Test setup failed: \(message)"
        }
    }
}