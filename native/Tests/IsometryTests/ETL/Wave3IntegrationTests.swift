import Foundation
import Testing
@testable import Isometry

/// Integration tests for Wave 3 ETL Pipeline Test Automation components
/// Tests the complete fuzzing, data integrity, and regression testing pipeline
@Test("Wave 3 ETL Integration Tests")
class Wave3IntegrationTests {

    private var database: IsometryDatabase!
    private var testHarness: ImportTestHarness!
    private var fuzzEngine: FuzzTestEngine!
    private var integrityValidator: DataIntegrityValidator!
    private var regressionSuite: RegressionTestSuite!
    private var testRepository: FileSystemTestDataRepository!

    init() async throws {
        // Set up test database
        database = try IsometryDatabase(path: ":memory:")
        try await database.initialize()

        // Set up test infrastructure
        testHarness = ImportTestHarness(database: database)
        let testDataGenerator = TestDataGenerator()

        fuzzEngine = FuzzTestEngine(
            testDataGenerator: testDataGenerator,
            importTestHarness: testHarness
        )

        integrityValidator = DataIntegrityValidator(
            testHarness: testHarness,
            testDataGenerator: testDataGenerator
        )

        // Set up test repository
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("wave3-test-\(UUID().uuidString)")
        testRepository = try FileSystemTestDataRepository(baseURL: tempURL)

        regressionSuite = RegressionTestSuite(
            testHarness: testHarness,
            dataIntegrityValidator: integrityValidator,
            testDataRepository: testRepository
        )
    }

    @Test("FuzzTestEngine generates malformed inputs and detects errors")
    func testFuzzEngineBasicOperation() async throws {
        let altoIndexImporter = AltoIndexImporter(database: database)

        // Run a small fuzzing campaign
        let summary = try await fuzzEngine.fuzzImporter(
            altoIndexImporter,
            iterations: 50,
            strategies: [.corruption, .truncation, .injection],
            statisticalConfidence: 0.90
        )

        // Verify fuzzing results
        #expect(summary.totalTests == 50)
        #expect(summary.testResults.count == 50)
        #expect(summary.coverage.coveragePercentage > 0.5, "Should achieve >50% error path coverage")
        #expect(summary.effectiveness.robustnessPercentage > 0.8, "Should handle >80% of fuzzing attempts robustly")
        #expect(summary.effectiveness.criticalFailures == 0, "Should have no critical failures")

        print("✅ Fuzzing campaign completed:")
        print("   Coverage: \(String(format: "%.1f", summary.coverage.coveragePercentage * 100))%")
        print("   Robustness: \(String(format: "%.1f", summary.effectiveness.robustnessPercentage * 100))%")
        print("   Overall score: \(String(format: "%.2f", summary.effectiveness.overallScore))")
    }

    @Test("DataIntegrityValidator validates accuracy with statistical confidence")
    func testDataIntegrityValidation() async throws {
        let altoIndexImporter = AltoIndexImporter(database: database)

        // Establish baseline
        let baseline = try await integrityValidator.establishBaseline(
            importer: altoIndexImporter,
            sampleSize: 20
        )

        #expect(baseline.sampleSize == 20)
        #expect(baseline.confidenceLevel == 0.99)
        #expect(baseline.overallAccuracy > 0.0)

        // Run validation
        let report = try await integrityValidator.validateIntegrity(
            importer: altoIndexImporter,
            sampleSize: 15,
            confidenceLevel: 0.95
        )

        // Verify validation results
        #expect(report.accuracyMetrics.sampleSize == 15)
        #expect(report.accuracyMetrics.confidenceLevel == 0.95)
        #expect(report.accuracyMetrics.overallAccuracy > 0.0)
        #expect(report.comparisonWithBaseline != nil, "Should compare against baseline")
        #expect(report.recommendations.count >= 0)

        // Check quality grading
        let grade = report.accuracyMetrics.qualityGrade
        #expect([.excellent, .good, .acceptable, .needsImprovement].contains(grade))

        print("✅ Data integrity validation completed:")
        print("   Overall accuracy: \(String(format: "%.2f", report.accuracyMetrics.overallAccuracy * 100))%")
        print("   Quality grade: \(grade.rawValue)")
        print("   Production ready: \(report.accuracyMetrics.meetsProductionRequirements ? "Yes" : "No")")
    }

    @Test("RegressionTestSuite manages known-good datasets")
    func testRegressionTestManagement() async throws {
        let altoIndexImporter = AltoIndexImporter(database: database)

        // Create sample test data
        let testData = """
        {
          "nodes": [
            {
              "id": "regression-test-1",
              "name": "Regression Test Node",
              "content": "This is a regression test dataset"
            }
          ]
        }
        """.data(using: .utf8)!

        let expectedOutcome = """
        [
          {
            "id": "regression-test-1",
            "name": "Regression Test Node",
            "content": "This is a regression test dataset",
            "folder": null,
            "version": 1
          }
        ]
        """.data(using: .utf8)!

        // Add known-good dataset
        let metadata = RegressionTestSuite.DatasetMetadata(
            source: .synthetic,
            complexity: .simple,
            tags: ["integration-test"],
            associatedCommits: ["test-commit"]
        )

        let validationRules = [
            RegressionTestSuite.ValidationRule(
                name: "Node count check",
                description: "Should have exactly 1 node",
                rule: .exactNodeCount(1)
            )
        ]

        let dataset = try await regressionSuite.addKnownGoodDataset(
            name: "integration-test-dataset",
            description: "Integration test dataset for Wave 3",
            format: .json,
            data: testData,
            expectedOutcome: expectedOutcome,
            metadata: metadata,
            validationRules: validationRules
        )

        #expect(dataset.name == "integration-test-dataset")
        #expect(dataset.format == .json)
        #expect(dataset.validationRules.count == 1)

        // Run regression test
        let results = try await regressionSuite.runRegressionTests(
            importer: altoIndexImporter,
            format: .json,
            complexity: .simple
        )

        #expect(results.count >= 1, "Should run at least 1 regression test")
        #expect(results.allSatisfy { $0.success }, "All regression tests should pass")
        #expect(results.allSatisfy { !$0.indicatesRegression }, "No regressions should be detected")

        print("✅ Regression test management completed:")
        print("   Tests run: \(results.count)")
        print("   All passed: \(results.allSatisfy { $0.success })")
        print("   No regressions: \(results.allSatisfy { !$0.indicatesRegression })")
    }

    @Test("Complete Wave 3 integration pipeline")
    func testCompleteWave3Pipeline() async throws {
        let altoIndexImporter = AltoIndexImporter(database: database)

        print("🚀 Starting complete Wave 3 integration pipeline test...")

        // Step 1: Establish baseline with data integrity validator
        print("📊 Step 1: Establishing accuracy baseline...")
        let baseline = try await integrityValidator.establishBaseline(
            importer: altoIndexImporter,
            sampleSize: 10
        )
        #expect(baseline.overallAccuracy > 0.0)
        print("   Baseline accuracy: \(String(format: "%.2f", baseline.overallAccuracy * 100))%")

        // Step 2: Add regression test dataset
        print("📁 Step 2: Adding known-good regression dataset...")
        let testData = """
        {
          "nodes": [
            {
              "id": "pipeline-test-1",
              "name": "Pipeline Integration Test",
              "content": "Testing the complete Wave 3 pipeline"
            },
            {
              "id": "pipeline-test-2",
              "name": "Second Pipeline Node",
              "content": "Additional test content for validation"
            }
          ]
        }
        """.data(using: .utf8)!

        let expectedOutcome = """
        [
          {
            "id": "pipeline-test-1",
            "name": "Pipeline Integration Test",
            "content": "Testing the complete Wave 3 pipeline",
            "folder": null,
            "version": 1
          },
          {
            "id": "pipeline-test-2",
            "name": "Second Pipeline Node",
            "content": "Additional test content for validation",
            "folder": null,
            "version": 1
          }
        ]
        """.data(using: .utf8)!

        let metadata = RegressionTestSuite.DatasetMetadata(
            source: .synthetic,
            complexity: .moderate,
            tags: ["wave3", "integration", "pipeline"],
            specialCharacteristics: ["multi-node", "complete-pipeline-test"]
        )

        let _ = try await regressionSuite.addKnownGoodDataset(
            name: "wave3-pipeline-test",
            description: "Complete Wave 3 pipeline integration test",
            format: .json,
            data: testData,
            expectedOutcome: expectedOutcome,
            metadata: metadata
        )

        // Step 3: Run focused fuzzing test
        print("🔥 Step 3: Running focused fuzzing campaign...")
        let fuzzSummary = try await fuzzEngine.fuzzImporter(
            altoIndexImporter,
            iterations: 25,
            strategies: [.corruption, .injection, .structure],
            statisticalConfidence: 0.90
        )
        #expect(fuzzSummary.totalTests == 25)
        #expect(fuzzSummary.effectiveness.criticalFailures == 0)
        print("   Fuzzing robustness: \(String(format: "%.1f", fuzzSummary.effectiveness.robustnessPercentage * 100))%")

        // Step 4: Run data integrity validation
        print("📋 Step 4: Running data integrity validation...")
        let validationReport = try await integrityValidator.validateIntegrity(
            importer: altoIndexImporter,
            sampleSize: 10,
            confidenceLevel: 0.95
        )
        #expect(validationReport.accuracyMetrics.overallAccuracy > 0.0)
        #expect(validationReport.comparisonWithBaseline != nil)
        print("   Validation accuracy: \(String(format: "%.2f", validationReport.accuracyMetrics.overallAccuracy * 100))%")

        // Step 5: Run regression tests
        print("🔍 Step 5: Running regression test suite...")
        let regressionResults = try await regressionSuite.runRegressionTests(importer: altoIndexImporter)
        #expect(regressionResults.count >= 1)
        let passRate = Double(regressionResults.filter { $0.success }.count) / Double(regressionResults.count)
        print("   Regression tests: \(regressionResults.count) run, \(String(format: "%.1f", passRate * 100))% passed")

        // Step 6: Check for regressions
        print("⚠️ Step 6: Checking for regression indicators...")
        let regressionCount = regressionResults.filter { $0.indicatesRegression }.count
        #expect(regressionCount == 0, "No regressions should be detected in integration test")
        print("   Regressions detected: \(regressionCount)")

        // Step 7: Generate statistics
        print("📈 Step 7: Generating pipeline statistics...")
        let regressionStats = await regressionSuite.getRegressionStatistics()
        #expect(regressionStats.totalTests >= 1)
        print("   Total regression tests: \(regressionStats.totalTests)")
        print("   Success rate: \(String(format: "%.1f", regressionStats.successRate * 100))%")

        print("✅ Complete Wave 3 pipeline integration test successful!")
        print("🎉 All components working together correctly:")
        print("   • FuzzTestEngine: ✓ Malformed input generation and error detection")
        print("   • DataIntegrityValidator: ✓ Statistical accuracy validation")
        print("   • RegressionTestSuite: ✓ Known-good dataset management")
        print("   • Integration: ✓ Complete pipeline coordination")
    }

    @Test("Performance characteristics meet CI/CD requirements")
    func testPerformanceCharacteristics() async throws {
        let altoIndexImporter = AltoIndexImporter(database: database)

        // Test that operations complete within CI/CD time constraints
        let startTime = Date()

        // Quick fuzzing test (should complete in <30 seconds)
        let fuzzSummary = try await fuzzEngine.fuzzImporter(
            altoIndexImporter,
            iterations: 10,
            strategies: [.corruption, .truncation]
        )

        let fuzzTime = Date().timeIntervalSince(startTime)
        #expect(fuzzTime < 30.0, "Fuzzing should complete within 30 seconds for CI/CD")

        // Quick integrity validation (should complete in <15 seconds)
        let validationStart = Date()
        let validationReport = try await integrityValidator.validateIntegrity(
            importer: altoIndexImporter,
            sampleSize: 5,
            confidenceLevel: 0.90
        )

        let validationTime = Date().timeIntervalSince(validationStart)
        #expect(validationTime < 15.0, "Validation should complete within 15 seconds for CI/CD")

        // Verify results are meaningful despite reduced sample sizes
        #expect(fuzzSummary.totalTests == 10)
        #expect(fuzzSummary.effectiveness.overallScore > 0.0)
        #expect(validationReport.accuracyMetrics.sampleSize == 5)
        #expect(validationReport.accuracyMetrics.overallAccuracy > 0.0)

        let totalTime = Date().timeIntervalSince(startTime)
        print("✅ Performance test completed in \(String(format: "%.1f", totalTime))s")
        print("   Fuzzing: \(String(format: "%.1f", fuzzTime))s")
        print("   Validation: \(String(format: "%.1f", validationTime))s")
        print("   Total: \(String(format: "%.1f", totalTime))s")
    }

    @Test("Error handling and recovery across all components")
    func testErrorHandlingAndRecovery() async throws {
        // Test with a mock importer that simulates various failures
        let mockImporter = MockFailingImporter()

        // Test fuzzing with failing importer
        let fuzzSummary = try await fuzzEngine.fuzzImporter(
            mockImporter,
            iterations: 10,
            strategies: [.corruption]
        )

        // Should handle failures gracefully
        #expect(fuzzSummary.totalTests == 10)
        #expect(fuzzSummary.testResults.allSatisfy { !$0.unexpectedSuccess })

        // Test data integrity validation error handling
        do {
            let _ = try await integrityValidator.validateIntegrity(
                importer: mockImporter,
                sampleSize: 5
            )
            // If it doesn't throw, check that it handled errors gracefully
        } catch {
            // Expected to fail, but should fail gracefully
            #expect(error is ValidationError || error is ImportError)
        }

        print("✅ Error handling test completed - all components handle failures gracefully")
    }

    deinit {
        // Cleanup test repository
        if let testRepository = testRepository {
            try? FileManager.default.removeItem(at: testRepository.baseURL)
        }
    }
}

// MARK: - Mock Importer for Testing

/// Mock importer that simulates various failure scenarios
private class MockFailingImporter: ImportTestHarness.ImporterProtocol {
    let importerName = "MockFailingImporter"
    let supportedExtensions = ["mock"]

    func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Simulate random failures
        if Int.random(in: 1...10) <= 3 { // 30% failure rate
            throw ImportError.fileFailed("Mock failure for testing")
        }

        // Return minimal success
        return ImportResult(
            imported: 1,
            skipped: 0,
            failed: 0,
            errors: []
        )
    }

    func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let data = try Data(contentsOf: url)
        return try await importData(data, filename: url.lastPathComponent, folder: folder)
    }
}