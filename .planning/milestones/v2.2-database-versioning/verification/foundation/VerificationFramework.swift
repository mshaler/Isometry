import Testing
import Foundation
@testable import Isometry

/// Swift Testing Framework Configuration for Database Versioning & ETL Operations Verification
/// Provides foundation verification infrastructure for v2.2 milestone systematic verification
///
/// This framework supports automated verification of DBVER-01 through UI-03 requirements
/// with production data protection, test isolation, and comprehensive reporting.
///
/// Usage:
/// - Phase 8.2: Core versioning system verification (DBVER-01, DBVER-02, DBVER-03, STOR-01)
/// - Phase 8.3: ETL integration verification (ETL-01, ETL-02, ETL-03)
/// - Phase 8.4: UI integration validation (UI-01, UI-02, UI-03)
@Suite("Database Versioning & ETL Operations Foundation Verification")
struct DatabaseVersioningVerificationSuite {

    // MARK: - Test Environment Configuration

    /// Test database configuration with production isolation
    private static let testDatabaseConfig = DatabaseConfiguration(
        path: ":memory:", // In-memory database for test isolation
        enableFTS: true,
        enableVersionControl: true,
        isolationLevel: .testEnvironment
    )

    /// Test storage configuration with temporary directory isolation
    private static let testStorageConfig = StorageConfiguration(
        baseDirectory: FileManager.default.temporaryDirectory,
        maxStorageQuota: 100 * 1024 * 1024, // 100MB test limit
        enableDeduplication: true,
        compressionThreshold: 1024 // 1KB compression threshold for testing
    )

    // MARK: - Foundation Test Infrastructure

    @Test("Foundation: Test Environment Isolation")
    func testEnvironmentIsolation() async throws {
        // Verify test environment is isolated from production
        let testDatabase = try await IsometryDatabase(configuration: testDatabaseConfig)
        let productionPath = try await testDatabase.getDatabasePath()

        // Ensure test database is in-memory (production isolation)
        #expect(productionPath.contains(":memory:") || productionPath.contains("/tmp/"))
        #expect(!productionPath.contains("Documents") && !productionPath.contains("Library"))

        await testDatabase.close()
    }

    @Test("Foundation: Database Initialization")
    func testDatabaseInitialization() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(
            database: database,
            configuration: testStorageConfig
        )

        // Verify core components initialize correctly
        #expect(await database.isReady())

        await database.close()
    }

    @Test("Foundation: Version Control Infrastructure")
    func testVersionControlInfrastructure() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(
            database: database,
            configuration: testStorageConfig
        )

        let versionControl = DatabaseVersionControl(
            database: database,
            storageManager: storageManager
        )

        // Verify version control system initializes with main branch
        let currentBranch = await versionControl.getCurrentBranch()
        #expect(currentBranch.name == "main")
        #expect(currentBranch.isProtected == true)

        await database.close()
    }

    @Test("Foundation: ETL Infrastructure")
    func testETLInfrastructure() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let etlManager = ETLOperationManager(database: database)

        // Verify ETL manager initializes with empty state
        let currentOperations = await etlManager.currentOperations
        let queuedOperations = await etlManager.queuedOperations

        #expect(currentOperations.isEmpty)
        #expect(queuedOperations.isEmpty)
        #expect(await etlManager.isExecuting == false)

        await database.close()
    }

    @Test("Foundation: Content Storage Infrastructure")
    func testContentStorageInfrastructure() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(
            database: database,
            configuration: testStorageConfig
        )

        // Verify storage manager configuration
        let config = await storageManager.getConfiguration()
        #expect(config.enableDeduplication == true)
        #expect(config.maxStorageQuota == 100 * 1024 * 1024)

        await database.close()
    }
}

// MARK: - Database Version Control Verification Foundation

@Suite("DBVER Requirements Foundation Verification")
struct DatabaseVersionControlFoundationSuite {

    @Test("DBVER-01 Foundation: Branch Operations Infrastructure")
    func testBranchOperationsInfrastructure() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)

        // Test branch creation infrastructure
        let testBranch = try await versionControl.createBranch(
            name: "test-infrastructure",
            description: "Foundation verification test branch"
        )

        #expect(testBranch.name == "test-infrastructure")
        #expect(testBranch.parentId != nil)
        #expect(testBranch.isProtected == false)

        // Test branch switching infrastructure
        try await versionControl.switchToBranch("test-infrastructure")
        let currentBranch = await versionControl.getCurrentBranch()
        #expect(currentBranch.name == "test-infrastructure")

        await database.close()
    }

    @Test("DBVER-02 Foundation: Analytics Branch Support")
    func testAnalyticsBranchFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)

        // Verify analytics branch creation capability
        let analyticsBranch = try await versionControl.createAnalyticsBranch(
            name: "analytics-test",
            purpose: "Foundation verification analytics"
        )

        #expect(analyticsBranch.name == "analytics-test")
        #expect(analyticsBranch.branchType == .analytics)
        #expect(analyticsBranch.isIsolated == true)

        await database.close()
    }

    @Test("DBVER-03 Foundation: Synthetic Data Support")
    func testSyntheticDataFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)

        // Verify synthetic branch creation capability
        let syntheticBranch = try await versionControl.createSyntheticBranch(
            name: "synthetic-test",
            scenario: "Foundation verification synthetic data"
        )

        #expect(syntheticBranch.name == "synthetic-test")
        #expect(syntheticBranch.branchType == .synthetic)
        #expect(syntheticBranch.productionIsolated == true)

        await database.close()
    }
}

// MARK: - ETL Operations Verification Foundation

@Suite("ETL Requirements Foundation Verification")
struct ETLOperationsFoundationSuite {

    @Test("ETL-01 Foundation: Operation Management Infrastructure")
    func testOperationManagementFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let etlManager = ETLOperationManager(database: database)

        // Test operation creation from template
        let template = ETLOperationTemplate.defaultDataImport
        let operation = await etlManager.createOperation(from: template)

        #expect(operation.template.name == template.name)
        #expect(operation.status == .created)
        #expect(operation.id != nil)

        await database.close()
    }

    @Test("ETL-02 Foundation: Data Lineage Infrastructure")
    func testDataLineageFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let versionManager = ETLVersionManager(database: database)

        // Verify lineage tracking initialization
        #expect(await versionManager.isTrackingEnabled() == true)

        // Test lineage record creation
        let lineageRecord = try await versionManager.createLineageRecord(
            sourceId: "test-source",
            targetId: "test-target",
            transformationType: .dataImport
        )

        #expect(lineageRecord.sourceId == "test-source")
        #expect(lineageRecord.targetId == "test-target")

        await database.close()
    }

    @Test("ETL-03 Foundation: Data Catalog Infrastructure")
    func testDataCatalogFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let dataCatalog = ETLDataCatalog(database: database)

        // Test data source registration
        let dataSource = DataSource(
            id: "test-source",
            name: "Foundation Test Source",
            type: .database,
            connectionString: "test://connection"
        )

        try await dataCatalog.registerDataSource(dataSource)
        let registeredSource = try await dataCatalog.getDataSource(id: "test-source")

        #expect(registeredSource?.name == "Foundation Test Source")

        await database.close()
    }
}

// MARK: - Content Storage Verification Foundation

@Suite("STOR Requirements Foundation Verification")
struct ContentStorageFoundationSuite {

    @Test("STOR-01 Foundation: Content Storage Infrastructure")
    func testContentStorageFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)

        // Test content storage with small test data
        let testContent = "Foundation verification test content".data(using: .utf8)!
        let storedContent = try await storageManager.store(
            content: testContent,
            filename: "test.txt",
            mimeType: "text/plain"
        )

        #expect(storedContent.id != nil)
        #expect(storedContent.originalSize == testContent.count)
        #expect(storedContent.contentHash != nil)

        await database.close()
    }

    @Test("STOR-01 Foundation: Deduplication Infrastructure")
    func testDeduplicationFoundation() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)

        let testContent = "Duplicate test content".data(using: .utf8)!

        // Store content twice
        let stored1 = try await storageManager.store(content: testContent, filename: "test1.txt")
        let stored2 = try await storageManager.store(content: testContent, filename: "test2.txt")

        // Verify deduplication - same content hash, different metadata
        #expect(stored1.contentHash == stored2.contentHash)
        #expect(stored1.id != stored2.id)

        await database.close()
    }
}

// MARK: - Integration Test Foundation

@Suite("Integration Foundation Verification")
struct IntegrationFoundationSuite {

    @Test("Integration: Version Control + Storage")
    func testVersionControlStorageIntegration() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)

        // Test integration between version control and storage
        let testBranch = try await versionControl.createBranch(name: "storage-integration")
        try await versionControl.switchToBranch("storage-integration")

        // Store content within version control context
        let testContent = "Version controlled content".data(using: .utf8)!
        let storedContent = try await storageManager.store(content: testContent)

        #expect(storedContent.branchId == testBranch.id.uuidString)

        await database.close()
    }

    @Test("Integration: ETL + Version Control")
    func testETLVersionControlIntegration() async throws {
        let database = try await IsometryDatabase(configuration: testDatabaseConfig)
        let storageManager = ContentAwareStorageManager(database: database, configuration: testStorageConfig)
        let versionControl = DatabaseVersionControl(database: database, storageManager: storageManager)
        let etlManager = ETLOperationManager(database: database)

        // Create analytics branch for ETL operations
        let analyticsBranch = try await versionControl.createAnalyticsBranch(
            name: "etl-integration",
            purpose: "ETL operation testing"
        )

        try await versionControl.switchToBranch("etl-integration")

        // Create and queue ETL operation
        let template = ETLOperationTemplate.defaultDataImport
        let operation = await etlManager.createOperation(from: template)
        await etlManager.queueOperation(operation)

        let queuedOps = await etlManager.queuedOperations
        #expect(queuedOps.count == 1)
        #expect(queuedOps.first?.branchContext == analyticsBranch.name)

        await database.close()
    }
}

// MARK: - Test Configuration Extensions

private extension DatabaseConfiguration {
    static var testDefault: DatabaseConfiguration {
        DatabaseConfiguration(
            path: ":memory:",
            enableFTS: true,
            enableVersionControl: true,
            isolationLevel: .testEnvironment
        )
    }
}

private extension StorageConfiguration {
    static var testDefault: StorageConfiguration {
        StorageConfiguration(
            baseDirectory: FileManager.default.temporaryDirectory,
            maxStorageQuota: 50 * 1024 * 1024, // 50MB test limit
            enableDeduplication: true,
            compressionThreshold: 512
        )
    }
}

// MARK: - Verification Result Reporting

/// Verification results aggregator for systematic phase reporting
actor VerificationResultsAggregator {
    private var results: [VerificationResult] = []

    func addResult(_ result: VerificationResult) {
        results.append(result)
    }

    func getResults() -> [VerificationResult] {
        return results
    }

    func generateReport() -> VerificationReport {
        VerificationReport(
            phase: "8.1-Foundation",
            totalTests: results.count,
            passedTests: results.filter { $0.status == .passed }.count,
            failedTests: results.filter { $0.status == .failed }.count,
            results: results,
            timestamp: Date()
        )
    }
}

struct VerificationResult {
    let testName: String
    let requirement: String
    let status: VerificationStatus
    let executionTime: TimeInterval
    let details: String?

    enum VerificationStatus {
        case passed
        case failed
        case skipped
    }
}

struct VerificationReport {
    let phase: String
    let totalTests: Int
    let passedTests: Int
    let failedTests: Int
    let results: [VerificationResult]
    let timestamp: Date
}