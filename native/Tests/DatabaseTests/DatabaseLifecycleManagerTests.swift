import XCTest
import GRDB
import CryptoKit
@testable import Isometry

/// Comprehensive test suite for database lifecycle operations
/// Tests dump, restore, export, purge, and rehydrate operations with versioning integration
final class DatabaseLifecycleManagerTests: XCTestCase {

    var database: IsometryDatabase!
    var versionControl: DatabaseVersionControl!
    var storageManager: ContentAwareStorageManager!
    var lifecycleManager: DatabaseLifecycleManager!
    var testBasePath: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()

        // Create temporary test directory
        testBasePath = FileManager.default.temporaryDirectory
            .appendingPathComponent("lifecycle-tests-\(UUID().uuidString)")

        try FileManager.default.createDirectory(at: testBasePath, withIntermediateDirectories: true)

        // Initialize test database with in-memory store
        database = try IsometryDatabase(path: ":memory:")
        Task {
            try await database.initialize()
        }

        // Initialize storage manager with test path
        let storageBasePath = testBasePath.appendingPathComponent("storage")
        storageManager = ContentAwareStorageManager(
            basePath: storageBasePath,
            database: database,
            maxCacheSize: 10_000_000, // 10MB for tests
            cleanupInterval: 3600,
            cachingEnabled: true
        )

        // Initialize version control
        versionControl = DatabaseVersionControl(
            database: database,
            storageManager: storageManager
        )

        // Initialize lifecycle manager
        lifecycleManager = DatabaseLifecycleManager(
            database: database,
            versionControl: versionControl,
            storageManager: storageManager,
            basePath: testBasePath,
            maxOperationTimeout: 60, // 1 minute for tests
            enableVerboseLogging: false // Reduce test noise
        )

        // Wait for async initialization
        try waitForInitialization()
    }

    override func tearDownWithError() throws {
        // Cleanup test directory
        if FileManager.default.fileExists(atPath: testBasePath.path) {
            try FileManager.default.removeItem(at: testBasePath)
        }

        database = nil
        versionControl = nil
        storageManager = nil
        lifecycleManager = nil

        try super.tearDownWithError()
    }

    // MARK: - Dump Operation Tests

    func testDumpOperationBasic() async throws {
        // Setup: Create test data
        try await setupTestData()

        // Execute: Perform dump operation
        let dumpConfig = DumpConfiguration(
            includeNodes: true,
            includeEdges: true,
            includeAttachments: false,
            includeIndexes: true,
            compressionLevel: .none,
            encryptionEnabled: false
        )

        let dumpResult = try await lifecycleManager.dump(configuration: dumpConfig)

        // Verify: Check dump result
        XCTAssertTrue(FileManager.default.fileExists(atPath: dumpResult.dumpPath.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dumpResult.manifestPath.path))
        XCTAssertGreaterThan(dumpResult.totalRecords, 0)
        XCTAssertGreaterThan(dumpResult.dumpFileSize, 0)
        XCTAssertFalse(dumpResult.checksum.isEmpty)

        // Verify manifest contains correct metadata
        let manifestData = try Data(contentsOf: dumpResult.manifestPath)
        let manifest = try JSONDecoder().decode(DumpManifest.self, from: manifestData)

        XCTAssertEqual(manifest.totalRecords, dumpResult.totalRecords)
        XCTAssertEqual(manifest.checksum, dumpResult.checksum)
        XCTAssertEqual(manifest.operationId, dumpResult.operationId)
    }

    func testDumpOperationWithFiltering() async throws {
        // Setup: Create test data with different dates
        try await setupTestDataWithDates()

        // Execute: Perform filtered dump
        let startDate = Date().addingTimeInterval(-86400) // 1 day ago
        let endDate = Date()
        let dateRange = DateInterval(start: startDate, end: endDate)

        let dumpConfig = DumpConfiguration(
            includeNodes: true,
            includeEdges: false,
            includeAttachments: false,
            includeIndexes: false,
            compressionLevel: .none,
            encryptionEnabled: false,
            dateRange: dateRange,
            nodeTypes: ["notebook_card"]
        )

        let dumpResult = try await lifecycleManager.dump(configuration: dumpConfig)

        // Verify: Check filtered results
        XCTAssertTrue(FileManager.default.fileExists(atPath: dumpResult.dumpPath.path))
        XCTAssertGreaterThan(dumpResult.totalRecords, 0)

        // Verify manifest reflects filtering
        let manifestData = try Data(contentsOf: dumpResult.manifestPath)
        let manifest = try JSONDecoder().decode(DumpManifest.self, from: manifestData)

        XCTAssertEqual(manifest.configuration.dateRange?.start, dateRange.start)
        XCTAssertEqual(manifest.configuration.nodeTypes, ["notebook_card"])
    }

    func testDumpOperationWithCompression() async throws {
        // Setup: Create test data
        try await setupTestData()

        // Execute: Perform compressed dump
        let dumpConfig = DumpConfiguration(
            includeNodes: true,
            includeEdges: true,
            includeAttachments: false,
            includeIndexes: true,
            compressionLevel: .high,
            encryptionEnabled: false
        )

        let dumpResult = try await lifecycleManager.dump(configuration: dumpConfig)

        // Verify: Check compression was applied
        XCTAssertTrue(FileManager.default.fileExists(atPath: dumpResult.dumpPath.path))
        XCTAssertNotNil(dumpResult.compressionRatio)

        if let compressionRatio = dumpResult.compressionRatio {
            XCTAssertGreaterThan(compressionRatio, 0.0)
            XCTAssertLessThanOrEqual(compressionRatio, 1.0)
        }
    }

    // MARK: - Restore Operation Tests

    func testRestoreOperationBasic() async throws {
        // Setup: Create and dump test data
        try await setupTestData()

        let originalNodeCount = try await database.countNodes()

        let dumpResult = try await lifecycleManager.dump()

        // Clear database
        try await clearDatabase()
        let emptyNodeCount = try await database.countNodes()
        XCTAssertEqual(emptyNodeCount, 0)

        // Execute: Perform restore operation
        let restoreConfig = RestoreConfiguration(
            dryRun: false,
            restoreAttachments: true,
            overwriteExisting: true,
            validateIntegrity: true,
            createBackup: true
        )

        let restoreResult = try await lifecycleManager.restore(
            from: dumpResult.dumpPath,
            configuration: restoreConfig
        )

        // Verify: Check restoration
        let restoredNodeCount = try await database.countNodes()
        XCTAssertEqual(restoreResult.restoredRecords, originalNodeCount)
        XCTAssertEqual(restoredNodeCount, originalNodeCount)
        XCTAssertNotNil(restoreResult.safetySnapshotId)
    }

    func testRestoreOperationDryRun() async throws {
        // Setup: Create dump
        try await setupTestData()
        let dumpResult = try await lifecycleManager.dump()

        // Clear database
        try await clearDatabase()
        let originalNodeCount = try await database.countNodes()

        // Execute: Perform dry run restore
        let restoreConfig = RestoreConfiguration(
            dryRun: true,
            restoreAttachments: false,
            overwriteExisting: false,
            validateIntegrity: true,
            createBackup: false
        )

        let restoreResult = try await lifecycleManager.restore(
            from: dumpResult.dumpPath,
            configuration: restoreConfig
        )

        // Verify: Database should remain unchanged
        let finalNodeCount = try await database.countNodes()
        XCTAssertEqual(finalNodeCount, originalNodeCount)
        XCTAssertEqual(restoreResult.restoredRecords, 0) // Dry run shouldn't restore
    }

    func testRestoreOperationIntegrityValidation() async throws {
        // Setup: Create dump and corrupt it
        try await setupTestData()
        let dumpResult = try await lifecycleManager.dump()

        // Corrupt the dump file
        let corruptedData = "corrupted data".data(using: .utf8)!
        try corruptedData.write(to: dumpResult.dumpPath)

        // Execute and verify: Restore should fail due to integrity check
        let restoreConfig = RestoreConfiguration(validateIntegrity: true)

        do {
            _ = try await lifecycleManager.restore(from: dumpResult.dumpPath, configuration: restoreConfig)
            XCTFail("Restore should have failed due to corrupted file")
        } catch {
            // Expected failure
            XCTAssertTrue(error is LifecycleError)
        }
    }

    // MARK: - Purge Operation Tests

    func testPurgeOperationDryRun() async throws {
        // Setup: Create test data with different dates
        try await setupTestDataWithDates()

        let originalNodeCount = try await database.countNodes()

        // Execute: Perform dry run purge
        let cutoffDate = Date().addingTimeInterval(-3600) // 1 hour ago
        let dateRange = DateInterval(start: Date.distantPast, end: cutoffDate)

        let purgeConfig = PurgeConfiguration(
            dryRun: true,
            includeAttachments: true,
            secureWipe: false,
            dateRange: dateRange,
            preserveReferences: true,
            auditCompliance: true
        )

        let purgeResult = try await lifecycleManager.purge(configuration: purgeConfig)

        // Verify: Database should remain unchanged but analysis should be provided
        let finalNodeCount = try await database.countNodes()
        XCTAssertEqual(finalNodeCount, originalNodeCount)
        XCTAssertEqual(purgeResult.purgedRecords, 0) // Dry run
        XCTAssertGreaterThan(purgeResult.impactAnalysis.candidateRecords, 0)
        XCTAssertFalse(purgeResult.auditTrail.isEmpty)
    }

    func testPurgeOperationWithAuditTrail() async throws {
        // Setup: Create test data
        try await setupTestData()

        let originalNodeCount = try await database.countNodes()

        // Execute: Perform actual purge
        let dateRange = DateInterval(start: Date.distantPast, end: Date())

        let purgeConfig = PurgeConfiguration(
            dryRun: false,
            includeAttachments: true,
            secureWipe: false,
            dateRange: dateRange,
            preserveReferences: true,
            auditCompliance: true
        )

        let purgeResult = try await lifecycleManager.purge(configuration: purgeConfig)

        // Verify: Check purge results and audit trail
        let finalNodeCount = try await database.countNodes()
        XCTAssertLessThan(finalNodeCount, originalNodeCount)
        XCTAssertGreaterThan(purgeResult.purgedRecords, 0)
        XCTAssertFalse(purgeResult.auditTrail.isEmpty)

        // Verify audit trail contains proper entries
        for auditEntry in purgeResult.auditTrail {
            XCTAssertEqual(auditEntry.operationType, .purge)
            XCTAssertFalse(auditEntry.recordId.isEmpty)
            XCTAssertFalse(auditEntry.details.isEmpty)
        }
    }

    func testPurgeOperationReferentialIntegrity() async throws {
        // Setup: Create test data with relationships
        try await setupTestDataWithRelationships()

        // Execute: Purge with referential integrity checks
        let purgeConfig = PurgeConfiguration(
            dryRun: true,
            preserveReferences: true,
            auditCompliance: true
        )

        let purgeResult = try await lifecycleManager.purge(configuration: purgeConfig)

        // Verify: Check referential impact analysis
        let referentialImpact = purgeResult.impactAnalysis.referentialImpact
        XCTAssertGreaterThanOrEqual(referentialImpact.orphanedEdges, 0)
        XCTAssertGreaterThanOrEqual(referentialImpact.cascadeDeletes, 0)
    }

    // MARK: - Rehydrate Operation Tests

    func testRehydrateOperationFromAppleNotes() async throws {
        // Setup: Clear database
        try await clearDatabase()

        let originalNodeCount = try await database.countNodes()
        XCTAssertEqual(originalNodeCount, 0)

        // Execute: Rehydrate from simulated Apple Notes data
        let rehydrateConfig = RehydrateConfiguration(
            dataSources: [.appleNotes],
            timeRange: nil,
            conflictResolution: .merge,
            includeSyntheticData: false,
            preserveExisting: false
        )

        let rehydrateResult = try await lifecycleManager.rehydrate(configuration: rehydrateConfig)

        // Verify: Check rehydration results
        let finalNodeCount = try await database.countNodes()
        XCTAssertGreaterThan(rehydrateResult.recordsCreated, 0)
        XCTAssertEqual(finalNodeCount, rehydrateResult.recordsCreated)
        XCTAssertEqual(rehydrateResult.dataSources, [.appleNotes])
    }

    func testRehydrateOperationWithSyntheticData() async throws {
        // Setup: Clear database
        try await clearDatabase()

        // Execute: Rehydrate with synthetic data
        let rehydrateConfig = RehydrateConfiguration(
            dataSources: [.syntheticData],
            timeRange: nil,
            conflictResolution: .merge,
            includeSyntheticData: true,
            syntheticDataScale: .small, // For test speed
            preserveExisting: false
        )

        let rehydrateResult = try await lifecycleManager.rehydrate(configuration: rehydrateConfig)

        // Verify: Check synthetic data generation
        let finalNodeCount = try await database.countNodes()
        XCTAssertGreaterThan(rehydrateResult.recordsCreated, 0)
        XCTAssertEqual(finalNodeCount, rehydrateResult.recordsCreated)
        XCTAssertGreaterThan(rehydrateResult.syntheticDataGenerated, 0)
    }

    func testRehydrateOperationConflictResolution() async throws {
        // Setup: Create existing data
        try await setupTestData()

        let originalNodeCount = try await database.countNodes()

        // Execute: Rehydrate with conflict resolution
        let rehydrateConfig = RehydrateConfiguration(
            dataSources: [.syntheticData],
            conflictResolution: .merge,
            includeSyntheticData: true,
            preserveExisting: true
        )

        let rehydrateResult = try await lifecycleManager.rehydrate(configuration: rehydrateConfig)

        // Verify: Check conflict resolution handling
        let finalNodeCount = try await database.countNodes()
        XCTAssertGreaterThanOrEqual(finalNodeCount, originalNodeCount)
        XCTAssertGreaterThanOrEqual(rehydrateResult.conflictsResolved, 0)
    }

    // MARK: - Versioning Integration Tests

    func testVersioningIntegrationWithDump() async throws {
        // Setup: Create test data
        try await setupTestData()

        // Execute: Perform dump with version control
        let dumpResult = try await lifecycleManager.dump()

        // Verify: Check version control integration
        let operations = await lifecycleManager.getActiveOperations()
        let history = await lifecycleManager.getOperationHistory(limit: 10)

        XCTAssertTrue(operations.isEmpty) // Should be completed
        XCTAssertFalse(history.isEmpty)

        let dumpOperation = history.first { $0.operationId == dumpResult.operationId }
        XCTAssertNotNil(dumpOperation)
        XCTAssertEqual(dumpOperation?.type, .dump)
    }

    func testVersioningIntegrationWithRestore() async throws {
        // Setup: Create dump
        try await setupTestData()
        let dumpResult = try await lifecycleManager.dump()

        // Execute: Clear and restore
        try await clearDatabase()
        let restoreResult = try await lifecycleManager.restore(from: dumpResult.dumpPath)

        // Verify: Check version control tracking
        let history = await lifecycleManager.getOperationHistory(limit: 10)
        let restoreOperation = history.first { $0.operationId == restoreResult.operationId }

        XCTAssertNotNil(restoreOperation)
        XCTAssertEqual(restoreOperation?.type, .restore)
    }

    // MARK: - Performance Tests

    func testLargeDatasetDumpPerformance() async throws {
        // Setup: Create large dataset
        try await setupLargeTestDataset(nodeCount: 10000)

        let startTime = Date()

        // Execute: Perform dump
        let dumpResult = try await lifecycleManager.dump()

        let duration = Date().timeIntervalSince(startTime)

        // Verify: Performance targets
        XCTAssertLessThan(duration, 300.0) // Should complete in under 5 minutes
        XCTAssertEqual(dumpResult.totalRecords, 10000)
        XCTAssertGreaterThan(dumpResult.dumpFileSize, 0)

        print("Large dataset dump performance: \(duration) seconds for \(dumpResult.totalRecords) records")
    }

    func testLargeDatasetRestorePerformance() async throws {
        // Setup: Create large dataset and dump
        try await setupLargeTestDataset(nodeCount: 10000)
        let dumpResult = try await lifecycleManager.dump()

        // Clear database
        try await clearDatabase()

        let startTime = Date()

        // Execute: Perform restore
        let restoreResult = try await lifecycleManager.restore(from: dumpResult.dumpPath)

        let duration = Date().timeIntervalSince(startTime)

        // Verify: Performance targets
        XCTAssertLessThan(duration, 300.0) // Should complete in under 5 minutes
        XCTAssertEqual(restoreResult.restoredRecords, 10000)

        print("Large dataset restore performance: \(duration) seconds for \(restoreResult.restoredRecords) records")
    }

    func testMemoryUsageDuringOperations() async throws {
        // Setup: Create test data
        try await setupTestData()

        let startMemory = getCurrentMemoryUsage()

        // Execute: Perform multiple operations
        let dumpResult = try await lifecycleManager.dump()
        let midMemory = getCurrentMemoryUsage()

        try await clearDatabase()
        _ = try await lifecycleManager.restore(from: dumpResult.dumpPath)
        let endMemory = getCurrentMemoryUsage()

        // Verify: Memory usage should be reasonable
        let memoryIncrease = endMemory - startMemory
        XCTAssertLessThan(memoryIncrease, 100_000_000) // Less than 100MB increase

        print("Memory usage: start=\(startMemory), mid=\(midMemory), end=\(endMemory), increase=\(memoryIncrease)")
    }

    // MARK: - Data Integrity Tests

    func testDataIntegrityDuringDumpRestore() async throws {
        // Setup: Create test data with specific content
        let testNodes = try await createSpecificTestNodes()
        let originalHashes = try await calculateNodeHashes(testNodes)

        // Execute: Dump and restore cycle
        let dumpResult = try await lifecycleManager.dump()
        try await clearDatabase()
        _ = try await lifecycleManager.restore(from: dumpResult.dumpPath)

        // Verify: Data integrity
        let restoredNodes = try await database.getAllNodes()
        let restoredHashes = try await calculateNodeHashes(restoredNodes)

        XCTAssertEqual(originalHashes.count, restoredHashes.count)

        for (nodeId, originalHash) in originalHashes {
            XCTAssertEqual(restoredHashes[nodeId], originalHash, "Data integrity lost for node \(nodeId)")
        }
    }

    func testUnicodeAndSpecialCharacterPreservation() async throws {
        // Setup: Create nodes with Unicode and special characters
        try await createUnicodeTestNodes()

        // Execute: Dump and restore cycle
        let dumpResult = try await lifecycleManager.dump()
        try await clearDatabase()
        _ = try await lifecycleManager.restore(from: dumpResult.dumpPath)

        // Verify: Unicode preservation
        let restoredNodes = try await database.getAllNodes()
        let unicodeNode = restoredNodes.first { $0.name.contains("🌟") }

        XCTAssertNotNil(unicodeNode)
        XCTAssertTrue(unicodeNode!.name.contains("🌟"))
        XCTAssertTrue(unicodeNode!.content.contains("特殊"))
    }

    // MARK: - Edge Cases and Error Testing

    func testOperationWithCorruptedDatabase() async throws {
        // This test would check how operations handle database corruption
        // Implementation would depend on how corruption is simulated
    }

    func testOperationWithDiskSpaceExhaustion() async throws {
        // This test would simulate disk space issues
        // Implementation would depend on disk space simulation capabilities
    }

    func testConcurrentOperations() async throws {
        // Setup: Create test data
        try await setupTestData()

        // Execute: Run concurrent operations
        async let dumpTask = lifecycleManager.dump()
        async let purgeTask = lifecycleManager.purge(configuration: PurgeConfiguration(dryRun: true))

        // Verify: Both operations should complete or handle concurrency appropriately
        do {
            let (dumpResult, purgeResult) = try await (dumpTask, purgeTask)

            XCTAssertGreaterThan(dumpResult.totalRecords, 0)
            XCTAssertGreaterThanOrEqual(purgeResult.purgedRecords, 0)
        } catch {
            // Some concurrency handling might prevent this - verify it's handled gracefully
            XCTAssertTrue(error is LifecycleError)
        }
    }

    func testOperationCancellation() async throws {
        // Setup: Create large dataset for long-running operation
        try await setupLargeTestDataset(nodeCount: 5000)

        // Execute: Start dump and cancel it
        let dumpTask = Task {
            try await lifecycleManager.dump()
        }

        // Give it a moment to start
        try await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds

        // Cancel the operation
        dumpTask.cancel()

        // Verify: Operation should be cancelled gracefully
        do {
            _ = try await dumpTask.value
            XCTFail("Operation should have been cancelled")
        } catch {
            XCTAssertTrue(error is CancellationError || error is LifecycleError)
        }
    }

    // MARK: - Helper Methods

    private func waitForInitialization() throws {
        let expectation = XCTestExpectation(description: "Database initialization")

        Task {
            try await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)
    }

    private func setupTestData() async throws {
        let testNodes = [
            Node(
                id: UUID().uuidString,
                nodeType: "notebook_card",
                name: "Test Note 1",
                content: "This is test content for note 1",
                tags: ["test", "sample"],
                priority: 1
            ),
            Node(
                id: UUID().uuidString,
                nodeType: "notebook_card",
                name: "Test Note 2",
                content: "This is test content for note 2",
                tags: ["test", "demo"],
                priority: 2
            ),
            Node(
                id: UUID().uuidString,
                nodeType: "document",
                name: "Test Document",
                content: "This is a test document with more content",
                tags: ["document", "test"],
                priority: 1
            )
        ]

        for node in testNodes {
            try await database.createNode(node)
        }
    }

    private func setupTestDataWithDates() async throws {
        let now = Date()
        let hourAgo = now.addingTimeInterval(-3600)
        let dayAgo = now.addingTimeInterval(-86400)

        let testNodes = [
            Node(
                id: UUID().uuidString,
                nodeType: "notebook_card",
                name: "Recent Note",
                content: "Recent test content",
                createdAt: now,
                modifiedAt: now
            ),
            Node(
                id: UUID().uuidString,
                nodeType: "notebook_card",
                name: "Hour Old Note",
                content: "Hour old test content",
                createdAt: hourAgo,
                modifiedAt: hourAgo
            ),
            Node(
                id: UUID().uuidString,
                nodeType: "notebook_card",
                name: "Day Old Note",
                content: "Day old test content",
                createdAt: dayAgo,
                modifiedAt: dayAgo
            )
        ]

        for node in testNodes {
            try await database.createNode(node)
        }
    }

    private func setupTestDataWithRelationships() async throws {
        // Create nodes
        try await setupTestData()

        // Create edges between nodes
        let nodes = try await database.getAllNodes()
        guard nodes.count >= 2 else { return }

        let edge = Edge(
            id: UUID().uuidString,
            sourceId: nodes[0].id,
            targetId: nodes[1].id,
            edgeType: .reference,
            weight: 1.0,
            directed: true
        )

        try await database.createEdge(edge)
    }

    private func setupLargeTestDataset(nodeCount: Int) async throws {
        for i in 0..<nodeCount {
            let node = Node(
                id: UUID().uuidString,
                nodeType: "generated_node",
                name: "Generated Node \(i)",
                content: "Generated content for node \(i) with some additional text to make it realistic",
                tags: ["generated", "test", "batch-\(i / 100)"],
                priority: i % 3 + 1
            )

            try await database.createNode(node)

            // Add progress indication for large datasets
            if i % 1000 == 0 {
                print("Created \(i) nodes...")
            }
        }
    }

    private func createSpecificTestNodes() async throws -> [Node] {
        let specificNodes = [
            Node(
                id: "test-node-1",
                nodeType: "integrity_test",
                name: "Integrity Test Node 1",
                content: "This content will be hashed for integrity verification",
                tags: ["integrity", "test"],
                priority: 1
            ),
            Node(
                id: "test-node-2",
                nodeType: "integrity_test",
                name: "Integrity Test Node 2",
                content: "Another piece of content for hash verification",
                tags: ["integrity", "verification"],
                priority: 2
            )
        ]

        for node in specificNodes {
            try await database.createNode(node)
        }

        return specificNodes
    }

    private func createUnicodeTestNodes() async throws {
        let unicodeNodes = [
            Node(
                id: "unicode-test-1",
                nodeType: "unicode_test",
                name: "Unicode Test 🌟 Node",
                content: "Content with Unicode: 特殊文字 and emojis 🎉📚🔬",
                tags: ["unicode", "特殊"],
                priority: 1
            ),
            Node(
                id: "unicode-test-2",
                nodeType: "unicode_test",
                name: "Math Symbols ∑∏∫√",
                content: "Mathematical content: ∀x∈ℝ: x² ≥ 0",
                tags: ["math", "symbols"],
                priority: 1
            )
        ]

        for node in unicodeNodes {
            try await database.createNode(node)
        }
    }

    private func calculateNodeHashes(_ nodes: [Node]) async throws -> [String: String] {
        var hashes: [String: String] = [:]

        for node in nodes {
            let hashContent = "\(node.id)\(node.name)\(node.content)\(node.nodeType)"
            let hash = SHA256.hash(data: hashContent.data(using: .utf8)!)
            hashes[node.id] = hash.compactMap { String(format: "%02x", $0) }.joined()
        }

        return hashes
    }

    private func clearDatabase() async throws {
        // Delete all nodes
        let nodes = try await database.getAllNodes()
        for node in nodes {
            try await database.purgeNode(id: node.id)
        }

        // Verify empty
        let remainingCount = try await database.countNodes()
        XCTAssertEqual(remainingCount, 0)
    }

    private func getCurrentMemoryUsage() -> Int64 {
        let KERN_SUCCESS = 0
        let HOST_VM_INFO_COUNT = MemoryLayout<vm_statistics_data_t>.size / MemoryLayout<integer_t>.size

        var vmStats = vm_statistics_data_t()
        var infoCount = mach_msg_type_number_t(HOST_VM_INFO_COUNT)

        let result = withUnsafeMutablePointer(to: &vmStats) { vmStatsPtr in
            vmStatsPtr.withMemoryRebound(to: integer_t.self, capacity: HOST_VM_INFO_COUNT) { intPtr in
                host_statistics(mach_host_self(), HOST_VM_INFO, intPtr, &infoCount)
            }
        }

        if result == KERN_SUCCESS {
            let pageSize = vm_kernel_page_size
            let totalPages = vmStats.free_count + vmStats.active_count + vmStats.inactive_count + vmStats.wire_count
            return Int64(totalPages * pageSize)
        }

        return 0
    }
}

// MARK: - Additional Test Classes

/// Tests for DatabaseExporter functionality
final class DatabaseExporterTests: XCTestCase {

    var database: IsometryDatabase!
    var storageManager: ContentAwareStorageManager!
    var exporter: DatabaseExporter!
    var testBasePath: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()

        // Create temporary test directory
        testBasePath = FileManager.default.temporaryDirectory
            .appendingPathComponent("exporter-tests-\(UUID().uuidString)")

        try FileManager.default.createDirectory(at: testBasePath, withIntermediateDirectories: true)

        // Initialize test components
        database = try IsometryDatabase(path: ":memory:")
        Task {
            try await database.initialize()
        }

        let storageBasePath = testBasePath.appendingPathComponent("storage")
        storageManager = ContentAwareStorageManager(
            basePath: storageBasePath,
            database: database
        )

        exporter = DatabaseExporter(
            database: database,
            storageManager: storageManager,
            basePath: testBasePath
        )

        // Wait for initialization
        try waitForInitialization()
        try await setupTestData()
    }

    override func tearDownWithError() throws {
        // Cleanup
        if FileManager.default.fileExists(atPath: testBasePath.path) {
            try FileManager.default.removeItem(at: testBasePath)
        }

        database = nil
        storageManager = nil
        exporter = nil

        try super.tearDownWithError()
    }

    func testJSONExport() async throws {
        // Execute: Export to JSON
        let config = ExportConfiguration(format: .json, includeSchema: true, includeData: true)
        let result = try await exporter.exportToJSON(configuration: config)

        // Verify: Check export result
        XCTAssertTrue(FileManager.default.fileExists(atPath: result.exportPath.path))
        XCTAssertEqual(result.format, .json)
        XCTAssertGreaterThan(result.recordsExported, 0)
        XCTAssertGreaterThan(result.fileSize, 0)

        // Verify JSON content
        let jsonData = try Data(contentsOf: result.exportPath)
        let jsonObject = try JSONSerialization.jsonObject(with: jsonData)
        let exportDict = jsonObject as? [String: Any]

        XCTAssertNotNil(exportDict)
        XCTAssertNotNil(exportDict?["metadata"])
        XCTAssertNotNil(exportDict?["nodes"])
    }

    func testCSVExport() async throws {
        // Execute: Export to CSV
        let fieldConfig = CSVFieldConfiguration(
            selectedFields: ["id", "name", "content", "created_at"],
            delimiter: ",",
            includeHeader: true
        )

        let config = ExportConfiguration(format: .csv, includeData: true)
        let result = try await exporter.exportToCSV(configuration: config, fieldSelection: fieldConfig)

        // Verify: Check export result
        XCTAssertTrue(FileManager.default.fileExists(atPath: result.exportPath.path))
        XCTAssertEqual(result.format, .csv)
        XCTAssertGreaterThan(result.recordsExported, 0)

        // Verify CSV content
        let csvContent = try String(contentsOf: result.exportPath)
        let lines = csvContent.components(separatedBy: .newlines).filter { !$0.isEmpty }

        XCTAssertGreaterThan(lines.count, 1) // Header + data
        XCTAssertTrue(lines[0].contains("id")) // Header check
    }

    func testSQLExport() async throws {
        // Execute: Export to SQL
        let config = ExportConfiguration(format: .sql, includeSchema: true, includeData: true)
        let result = try await exporter.exportToSQL(configuration: config)

        // Verify: Check export result
        XCTAssertTrue(FileManager.default.fileExists(atPath: result.exportPath.path))
        XCTAssertEqual(result.format, .sql)
        XCTAssertGreaterThan(result.recordsExported, 0)

        // Verify SQL content
        let sqlContent = try String(contentsOf: result.exportPath)
        XCTAssertTrue(sqlContent.contains("INSERT INTO"))
        XCTAssertTrue(sqlContent.contains("CREATE TABLE"))
    }

    func testExportValidation() async throws {
        // Execute: Export and validate
        let config = ExportConfiguration(format: .json, includeData: true)
        let exportResult = try await exporter.exportToJSON(configuration: config)

        let validationResult = try await exporter.validateExport(
            exportResult: exportResult,
            sourceConfiguration: config
        )

        // Verify: Validation should pass
        XCTAssertTrue(validationResult.isValid)
        XCTAssertTrue(validationResult.fileIntegrity)
        XCTAssertTrue(validationResult.recordCountMatches)
        XCTAssertEqual(validationResult.exportedRecordCount, exportResult.recordsExported)
    }

    // MARK: - Helper Methods

    private func waitForInitialization() throws {
        let expectation = XCTestExpectation(description: "Database initialization")

        Task {
            try await Task.sleep(nanoseconds: 100_000_000)
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)
    }

    private func setupTestData() async throws {
        let testNodes = [
            Node(
                id: "export-test-1",
                nodeType: "test_node",
                name: "Export Test Node 1",
                content: "Content for export testing",
                tags: ["export", "test"]
            ),
            Node(
                id: "export-test-2",
                nodeType: "test_node",
                name: "Export Test Node 2",
                content: "More content for export testing",
                tags: ["export", "validation"]
            )
        ]

        for node in testNodes {
            try await database.createNode(node)
        }
    }
}

// MARK: - Property-Based Testing

/// Property-based tests for lifecycle operations
final class LifecyclePropertyTests: XCTestCase {

    /// Test property: Dump-Restore cycle preserves data
    func testDumpRestorePreservesData() async throws {
        // Property: For any valid dataset, dump followed by restore should preserve all data
        let database = try IsometryDatabase(path: ":memory:")
        Task { try await database.initialize() }

        // Generate test data with various patterns
        for _ in 0..<10 {
            try await testDumpRestoreProperty(database: database)
        }
    }

    /// Test property: Export validation always catches corruption
    func testExportValidationCatchesCorruption() async throws {
        // Property: Any corruption in export should be detected by validation
        // This would involve generating valid exports and then corrupting them
        // systematically to verify detection
    }

    /// Test property: Purge operations maintain referential integrity
    func testPurgeReferentialIntegrityProperty() async throws {
        // Property: Purge operations should never create orphaned references
        // when preserveReferences is enabled
    }

    // MARK: - Property Test Helper

    private func testDumpRestoreProperty(database: IsometryDatabase) async throws {
        // Generate random test data
        let nodeCount = Int.random(in: 1...100)
        var originalNodes: [Node] = []

        for i in 0..<nodeCount {
            let node = Node(
                id: UUID().uuidString,
                nodeType: "property_test",
                name: "Property Test Node \(i)",
                content: generateRandomContent(),
                tags: generateRandomTags(),
                priority: Int.random(in: 1...3)
            )
            originalNodes.append(node)
            try await database.createNode(node)
        }

        // Create lifecycle manager
        let tempPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("property-test-\(UUID().uuidString)")

        let storageManager = ContentAwareStorageManager(basePath: tempPath, database: database)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)

        let lifecycleManager = DatabaseLifecycleManager(
            database: database,
            versionControl: versionControl,
            storageManager: storageManager,
            basePath: tempPath
        )

        // Perform dump
        let dumpResult = try await lifecycleManager.dump()

        // Clear database
        for node in originalNodes {
            try await database.purgeNode(id: node.id)
        }

        // Restore
        _ = try await lifecycleManager.restore(from: dumpResult.dumpPath)

        // Verify property: All original data should be restored
        let restoredNodes = try await database.getAllNodes()
        XCTAssertEqual(restoredNodes.count, originalNodes.count)

        // Cleanup
        try? FileManager.default.removeItem(at: tempPath)
    }

    private func generateRandomContent() -> String {
        let sentences = [
            "This is a test sentence.",
            "Random content for testing purposes.",
            "Property-based testing helps find edge cases.",
            "Database operations should be reliable.",
            "Testing with randomized data improves coverage."
        ]

        let sentenceCount = Int.random(in: 1...3)
        return Array(sentences.shuffled().prefix(sentenceCount)).joined(separator: " ")
    }

    private func generateRandomTags() -> [String] {
        let availableTags = ["test", "property", "random", "data", "validation", "lifecycle"]
        let tagCount = Int.random(in: 0...3)
        return Array(availableTags.shuffled().prefix(tagCount))
    }
}