import XCTest
@testable import Isometry

/// Basic compilation and integration tests to verify Phase 4 success metrics
final class BasicCompilationTest: XCTestCase {

    func testViewConfigDefaults() throws {
        // Test that ViewConfig.default works correctly
        let config = ViewConfig.default
        XCTAssertEqual(config.name, "Default Grid")
        XCTAssertTrue(config.isDefault)
        XCTAssertEqual(config.originPattern, "anchor")
        XCTAssertEqual(config.xAxisMapping, "time")
        XCTAssertEqual(config.yAxisMapping, "category")
        XCTAssertEqual(config.zoomLevel, 1.0)
    }

    func testEisenhowerMatrixConfig() throws {
        let config = ViewConfig.eisenhowerMatrix
        XCTAssertEqual(config.name, "Eisenhower Matrix")
        XCTAssertTrue(config.isEisenhowerMatrix)
        XCTAssertEqual(config.originPattern, "bipolar")
        XCTAssertEqual(config.xAxisMapping, "hierarchy")
        XCTAssertEqual(config.yAxisMapping, "hierarchy")
    }

    @MainActor
    func testSuperGridViewModelInitialization() throws {
        let viewModel = SuperGridViewModel()
        XCTAssertEqual(viewModel.nodes.count, 0)
        XCTAssertEqual(viewModel.currentViewType, .grid)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
        XCTAssertFalse(viewModel.hasActiveFilters)
    }

    func testNodeModelCreation() throws {
        let node = Node(
            id: "test-123",
            name: "Test Node",
            content: "Test content",
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "Test Folder",
            tags: ["tag1", "tag2"],
            status: "active",
            priority: 3 // High priority as integer
        )

        XCTAssertEqual(node.id, "test-123")
        XCTAssertEqual(node.name, "Test Node")
        XCTAssertEqual(node.content, "Test content")
        XCTAssertEqual(node.folder, "Test Folder")
        XCTAssertEqual(node.tags.count, 2)
        XCTAssertEqual(node.priority, 3)
        XCTAssertEqual(node.status, "active")
    }

    @MainActor
    func testProductionVerificationComponents() throws {
        // Test that production verification components can be instantiated
        // This verifies Wave 3 implementation is working

        let cloudKitVerifier = CloudKitProductionVerifier()
        XCTAssertEqual(cloudKitVerifier.verificationStatus, .notStarted)

        let complianceVerifier = AppStoreComplianceVerifier()
        XCTAssertEqual(complianceVerifier.overallStatus, .notStarted)

        let performanceValidator = PerformanceValidator()
        XCTAssertTrue(performanceValidator.results.isEmpty)
    }
}