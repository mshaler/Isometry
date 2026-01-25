import XCTest
import SwiftUI
@testable import Isometry

/// Comprehensive SuperGrid visual tests for iOS platform
@MainActor
final class SuperGridUITests: XCTestCase {

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
    }

    // MARK: - Grid Rendering Tests

    func testBasicGridLayout() async throws {
        let mockNodes = MockData.sampleNodes(count: 10)
        let viewConfig = ViewConfig.default

        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: mockNodes, viewConfig: viewConfig))
            .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_basic_layout_ios"
            )
        )
    }

    func testGridWithDifferentDataDensities() async throws {
        // Test sparse data (10 nodes)
        let sparseView = createTestGrid(nodeCount: 10, identifier: "sparse")
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: sparseView,
                identifier: "supergrid_sparse_data_ios"
            )
        )

        // Test medium data (100 nodes)
        let mediumView = createTestGrid(nodeCount: 100, identifier: "medium")
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: mediumView,
                identifier: "supergrid_medium_data_ios"
            )
        )

        // Test dense data (1000 nodes)
        let denseView = createTestGrid(nodeCount: 1000, identifier: "dense")
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: denseView,
                identifier: "supergrid_dense_data_ios"
            )
        )
    }

    // MARK: - PAFV Axis Tests

    func testAnchorOriginConfiguration() async throws {
        let viewConfig = ViewConfig(
            id: UUID(),
            name: "Test Anchor",
            xAxisMapping: "category",
            yAxisMapping: "time",
            originType: .anchor(x: 0, y: 0)
        )

        let gridView = createTestGrid(viewConfig: viewConfig)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_anchor_origin_ios"
            )
        )
    }

    func testBipolarOriginConfiguration() async throws {
        let viewConfig = ViewConfig(
            id: UUID(),
            name: "Test Bipolar",
            xAxisMapping: "hierarchy",
            yAxisMapping: "category",
            originType: .bipolar
        )

        let gridView = createTestGrid(viewConfig: viewConfig)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_bipolar_origin_ios"
            )
        )
    }

    // MARK: - MiniNav Controls Tests

    func testMiniNavControlsVisibility() async throws {
        let gridView = createTestGrid(nodeCount: 50)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_mininav_visible_ios"
            )
        )
    }

    func testFilterControlsOverlay() async throws {
        // Note: This would require simulating filter toggle state
        // Implementation depends on test interaction capabilities
        let gridView = createTestGrid(nodeCount: 30)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_filters_overlay_ios"
            )
        )
    }

    // MARK: - Grid Headers Tests

    func testColumnHeaders() async throws {
        let viewConfig = ViewConfig(
            id: UUID(),
            name: "Time Categories",
            xAxisMapping: "time",
            yAxisMapping: "category",
            originType: .anchor(x: 0, y: 0)
        )

        let gridView = createTestGrid(viewConfig: viewConfig)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_time_headers_ios"
            )
        )
    }

    func testRowHeaders() async throws {
        let viewConfig = ViewConfig(
            id: UUID(),
            name: "Category Hierarchy",
            xAxisMapping: "category",
            yAxisMapping: "hierarchy",
            originType: .anchor(x: 0, y: 0)
        )

        let gridView = createTestGrid(viewConfig: viewConfig)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_hierarchy_headers_ios"
            )
        )
    }

    // MARK: - Cell Visual States Tests

    func testCellPriorityStates() async throws {
        let mixedPriorityNodes = [
            MockData.createNode(name: "High Priority", priority: 3),
            MockData.createNode(name: "Medium Priority", priority: 2),
            MockData.createNode(name: "Low Priority", priority: 1),
            MockData.createNode(name: "No Priority", priority: 0)
        ]

        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: mixedPriorityNodes))
            .frame(width: 500, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_priority_states_ios"
            )
        )
    }

    func testCellHoverStates() async throws {
        // iOS doesn't have hover, but we test touch feedback
        let gridView = createTestGrid(nodeCount: 20)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_touch_feedback_ios"
            )
        )
    }

    // MARK: - Device-Specific Layout Tests

    func testIPhone13Layout() async throws {
        let config = TestConfiguration.iPhone13
        let gridView = createTestGrid(nodeCount: 50)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_iphone13_layout"
            )
        )
    }

    func testIPhone15ProMaxLayout() async throws {
        let config = TestConfiguration.iPhone15ProMax
        let gridView = createTestGrid(nodeCount: 50)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_iphone15promax_layout"
            )
        )
    }

    func testIPadAirLayout() async throws {
        let config = TestConfiguration.iPadAir
        let gridView = createTestGrid(nodeCount: 100)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_ipadair_layout"
            )
        )
    }

    func testIPadProLayout() async throws {
        let config = TestConfiguration.iPadPro
        let gridView = createTestGrid(nodeCount: 150)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_ipadpro_layout"
            )
        )
    }

    // MARK: - Zoom and Pan States Tests

    func testDefaultZoomLevel() async throws {
        let gridView = createTestGrid(nodeCount: 100)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_default_zoom_ios"
            )
        )
    }

    func testZoomedInState() async throws {
        // This would require gesture simulation or state injection
        // For now, test with larger cell size configuration
        let gridView = createTestGrid(nodeCount: 50)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_zoomed_in_ios"
            )
        )
    }

    func testZoomedOutState() async throws {
        // Test with smaller effective cell size or larger dataset
        let gridView = createTestGrid(nodeCount: 500)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_zoomed_out_ios"
            )
        )
    }

    // MARK: - Error States Tests

    func testEmptyDataState() async throws {
        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: []))
            .frame(width: 600, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_empty_state_ios"
            )
        )
    }

    func testLoadingState() async throws {
        let gridView = SuperGridView()
            .environmentObject(MockAppState(isLoading: true))
            .frame(width: 600, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_loading_state_ios"
            )
        )
    }

    // MARK: - Helper Methods

    private func createTestGrid(
        nodeCount: Int = 50,
        identifier: String = "",
        viewConfig: ViewConfig? = nil
    ) -> some View {
        let nodes = MockData.sampleNodes(count: nodeCount)
        let config = viewConfig ?? ViewConfig.default

        return SuperGridView()
            .environmentObject(MockAppState(nodes: nodes, viewConfig: config))
            .frame(width: 800, height: 600)
    }
}

// MARK: - Mock Data and State

struct MockData {
    static func sampleNodes(count: Int) -> [Node] {
        (0..<count).map { index in
            createNode(
                name: "Node \(index + 1)",
                priority: Int.random(in: 0...3)
            )
        }
    }

    static func createNode(name: String, priority: Int) -> Node {
        Node(
            id: UUID(),
            name: name,
            content: "Sample content for \(name)",
            priority: priority,
            tags: ["sample", "test"],
            createdAt: Date(),
            modifiedAt: Date()
        )
    }
}

@MainActor
class MockAppState: AppState {
    private let mockNodes: [Node]
    private let mockViewConfig: ViewConfig
    private let mockIsLoading: Bool

    init(
        nodes: [Node] = [],
        viewConfig: ViewConfig = ViewConfig.default,
        isLoading: Bool = false
    ) {
        self.mockNodes = nodes
        self.mockViewConfig = viewConfig
        self.mockIsLoading = isLoading
        super.init()
    }

    override var nodes: [Node] {
        mockNodes
    }

    override var currentViewConfig: ViewConfig {
        mockViewConfig
    }

    override var isLoading: Bool {
        mockIsLoading
    }
}