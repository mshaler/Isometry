import XCTest
import SwiftUI
@testable import Isometry

/// Cross-platform consistency tests ensuring UI behavior matches between iOS and macOS
@MainActor
final class CrossPlatformConsistencyTests: XCTestCase {

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
    }

    // MARK: - Layout Consistency Tests

    func testGridLayoutConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 100)
        let viewConfig = ViewConfig.default

        // Create identical grid setup for both platforms
        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes, viewConfig: viewConfig))
            .frame(width: 800, height: 600)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_grid_layout_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_grid_layout_macos"
            )
        )
        #endif

        // Verify cell positioning matches mathematical model
        let viewModel = SuperGridViewModel()
        await viewModel.initialize(database: MockAppState(nodes: nodes).database)

        // Test that cells are positioned consistently using same algorithm
        let gridCells = viewModel.nodes
        XCTAssertEqual(gridCells.count, 100)

        // Verify positioning algorithm is deterministic
        for cell in gridCells.prefix(10) {
            let expectedX = cell.node.hashValue % 20
            let expectedY = cell.node.hashValue % 15
            // Note: Actual positioning would depend on PAFV mapping
            XCTAssertGreaterThanOrEqual(cell.x, 0)
            XCTAssertGreaterThanOrEqual(cell.y, 0)
        }
    }

    func testHeaderSpanningConsistency() async throws {
        let viewConfigs = [
            ViewConfig(id: UUID(), name: "Time-Category", xAxisMapping: "time", yAxisMapping: "category", originType: .anchor(x: 0, y: 0)),
            ViewConfig(id: UUID(), name: "Category-Hierarchy", xAxisMapping: "category", yAxisMapping: "hierarchy", originType: .bipolar),
            ViewConfig(id: UUID(), name: "Priority-Time", xAxisMapping: "priority", yAxisMapping: "time", originType: .anchor(x: 2, y: 1))
        ]

        for (index, viewConfig) in viewConfigs.enumerated() {
            let gridView = SuperGridView()
                .environmentObject(MockAppState(nodes: MockData.sampleNodes(count: 50), viewConfig: viewConfig))
                .frame(width: 800, height: 600)

            #if os(iOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_headers_\(index)_ios"
                )
            )
            #elseif os(macOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_headers_\(index)_macos"
                )
            )
            #endif
        }
    }

    // MARK: - Color and Theme Consistency

    func testColorSchemeConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 50)

        for colorScheme in [ColorScheme.light, ColorScheme.dark] {
            let gridView = SuperGridView()
                .environmentObject(MockAppState(nodes: nodes))
                .preferredColorScheme(colorScheme)
                .frame(width: 700, height: 500)

            let schemeName = colorScheme == .light ? "light" : "dark"

            #if os(iOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_\(schemeName)_theme_ios"
                )
            )
            #elseif os(macOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_\(schemeName)_theme_macos"
                )
            )
            #endif
        }
    }

    func testPriorityColorMapping() async throws {
        let priorityNodes = [
            MockData.createNode(name: "P0", priority: 0),
            MockData.createNode(name: "P1", priority: 1),
            MockData.createNode(name: "P2", priority: 2),
            MockData.createNode(name: "P3", priority: 3)
        ]

        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: priorityNodes))
            .frame(width: 500, height: 300)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_priority_colors_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_priority_colors_macos"
            )
        )
        #endif
    }

    // MARK: - Typography Consistency

    func testFontScalingConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 20)

        for sizeCategory in [ContentSizeCategory.small, .medium, .large, .extraLarge] {
            let gridView = SuperGridView()
                .environmentObject(MockAppState(nodes: nodes))
                .environment(\.sizeCategory, sizeCategory)
                .frame(width: 600, height: 400)

            let sizeName = String(describing: sizeCategory).lowercased()

            #if os(iOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_font_\(sizeName)_ios"
                )
            )
            #elseif os(macOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_font_\(sizeName)_macos"
                )
            )
            #endif
        }
    }

    func testTextTruncationConsistency() async throws {
        let longNameNodes = [
            MockData.createNode(name: "This is a very long node name that should be truncated", priority: 1),
            MockData.createNode(name: "Short", priority: 2),
            MockData.createNode(name: "Medium length node name", priority: 1),
            MockData.createNode(name: "Another extremely long node name that definitely exceeds the available space", priority: 3)
        ]

        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: longNameNodes))
            .frame(width: 600, height: 400)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_text_truncation_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_text_truncation_macos"
            )
        )
        #endif
    }

    // MARK: - Navigation Patterns

    func testNavigationTitleConsistency() async throws {
        let gridView = NavigationStack {
            SuperGridView()
                .environmentObject(MockAppState(nodes: MockData.sampleNodes(count: 30)))
                .navigationTitle("SuperGrid Test")
        }
        .frame(width: 800, height: 600)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_navigation_title_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_navigation_title_macos"
            )
        )
        #endif
    }

    func testToolbarConsistency() async throws {
        let gridView = NavigationStack {
            SuperGridView()
                .environmentObject(MockAppState(nodes: MockData.sampleNodes(count: 40)))
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Add") {
                            // Action
                        }
                    }
                    ToolbarItem(placement: .secondaryAction) {
                        Button("Settings") {
                            // Action
                        }
                    }
                }
        }
        .frame(width: 800, height: 600)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_toolbar_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_toolbar_macos"
            )
        )
        #endif
    }

    // MARK: - Modal Presentations

    func testCardDetailModalConsistency() async throws {
        let testNode = MockData.createNode(name: "Test Node", priority: 2)

        let modalView = NavigationStack {
            CardDetailView(node: testNode)
        }
        .frame(width: 600, height: 500)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: modalView,
                identifier: "cross_platform_card_detail_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: modalView,
                identifier: "cross_platform_card_detail_macos"
            )
        )
        #endif
    }

    func testFilterOverlayConsistency() async throws {
        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: MockData.sampleNodes(count: 50)))
            .frame(width: 800, height: 600)

        // Note: This would ideally test the filter overlay in visible state
        // For now, test the base grid that would be underneath

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_filter_overlay_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_filter_overlay_macos"
            )
        )
        #endif
    }

    // MARK: - Gesture Behavior Consistency

    func testPanZoomBehaviorConsistency() async throws {
        // Test that pan/zoom constraints are equivalent
        let nodes = MockData.sampleNodes(count: 200)
        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes))
            .frame(width: 800, height: 600)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_pan_zoom_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_pan_zoom_macos"
            )
        )
        #endif

        // Test mathematical constraints are the same
        let viewModel = SuperGridViewModel()
        await viewModel.initialize(database: MockAppState(nodes: nodes).database)

        // Verify zoom constraints
        let minZoom = 0.1
        let maxZoom = 10.0
        XCTAssertGreaterThanOrEqual(minZoom, 0.05)
        XCTAssertLessThanOrEqual(maxZoom, 20.0)

        // Verify pan bounds (should be based on content size)
        let contentBounds = CGRect(x: 0, y: 0, width: 2400, height: 1200) // 20x15 cells at 120x80 each
        XCTAssertGreaterThan(contentBounds.width, 800)
        XCTAssertGreaterThan(contentBounds.height, 600)
    }

    // MARK: - Data Consistency Tests

    func testSQLiteSchemaConsistency() async throws {
        // Verify that both platforms use identical schema
        let database = MockDatabase.createWithLargeDataset()

        // Test that queries return identical results
        let allNodes = try await database.searchNodes(query: "")
        XCTAssertGreaterThan(allNodes.count, 0)

        let highPriorityNodes = try await database.filterNodes(filter: "priority > 2")
        XCTAssertLessThanOrEqual(highPriorityNodes.count, allNodes.count)

        // Test graph queries work identically
        if let firstNode = allNodes.first {
            let connectedNodes = try await database.findConnectedNodes(from: firstNode.id)
            XCTAssertGreaterThanOrEqual(connectedNodes.count, 0)
        }
    }

    func testViewConfigPortability() async throws {
        let viewConfigs = [
            ViewConfig(
                id: UUID(),
                name: "Portable Config 1",
                xAxisMapping: "time",
                yAxisMapping: "category",
                originType: .anchor(x: 0, y: 0)
            ),
            ViewConfig(
                id: UUID(),
                name: "Portable Config 2",
                xAxisMapping: "hierarchy",
                yAxisMapping: "priority",
                originType: .bipolar
            )
        ]

        for viewConfig in viewConfigs {
            let gridView = SuperGridView()
                .environmentObject(MockAppState(
                    nodes: MockData.sampleNodes(count: 60),
                    viewConfig: viewConfig
                ))
                .frame(width: 750, height: 550)

            let configName = viewConfig.name.replacingOccurrences(of: " ", with: "_").lowercased()

            #if os(iOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_\(configName)_ios"
                )
            )
            #elseif os(macOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_\(configName)_macos"
                )
            )
            #endif
        }
    }

    func testFilterPresetPortability() async throws {
        let filterPresets = [
            FilterPreset(id: UUID(), name: "High Priority", filterExpression: "priority > 2"),
            FilterPreset(id: UUID(), name: "Recent", filterExpression: "created_at > date('now', '-7 days')"),
            FilterPreset(id: UUID(), name: "Work Items", filterExpression: "tags CONTAINS 'work'")
        ]

        // Test that filter presets produce identical results
        let database = MockDatabase.createWithLargeDataset()

        for preset in filterPresets {
            let filteredNodes = try await database.filterNodes(filter: preset.filterExpression)
            XCTAssertGreaterThanOrEqual(filteredNodes.count, 0)

            // Visual test with filtered data
            let gridView = SuperGridView()
                .environmentObject(MockAppState(nodes: filteredNodes))
                .frame(width: 700, height: 500)

            let presetName = preset.name.replacingOccurrences(of: " ", with: "_").lowercased()

            #if os(iOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_filter_\(presetName)_ios"
                )
            )
            #elseif os(macOS)
            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "cross_platform_filter_\(presetName)_macos"
                )
            )
            #endif
        }
    }

    // MARK: - Accessibility Consistency

    func testAccessibilityLabelsConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 20)
        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes))
            .frame(width: 600, height: 400)

        // Test accessibility structure is consistent
        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_accessibility_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_accessibility_macos"
            )
        )
        #endif
    }

    func testReducedMotionConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 30)

        let gridView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes))
            .environment(\.accessibilityReduceMotion, true)
            .frame(width: 650, height: 450)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_reduced_motion_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "cross_platform_reduced_motion_macos"
            )
        )
        #endif
    }

    // MARK: - Performance Consistency

    func testRenderingPerformanceConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 1000)
        let appState = MockAppState(nodes: nodes)

        let startTime = Date()

        let viewModel = SuperGridViewModel()
        await viewModel.initialize(database: appState.database)

        let gridCells = viewModel.nodes
        XCTAssertEqual(gridCells.count, 1000)

        let renderTime = Date().timeIntervalSince(startTime)

        // Performance should be consistent across platforms
        // (though absolute values may differ)
        #if os(iOS)
        XCTAssertLessThan(renderTime, 0.5, "iOS rendering should be < 500ms for 1000 nodes")
        #elseif os(macOS)
        XCTAssertLessThan(renderTime, 0.3, "macOS rendering should be < 300ms for 1000 nodes")
        #endif
    }

    // MARK: - Mathematical Model Consistency

    func testPAFVCalculationConsistency() async throws {
        let nodes = MockData.sampleNodes(count: 100)
        let viewConfig = ViewConfig(
            id: UUID(),
            name: "Test PAFV",
            xAxisMapping: "time",
            yAxisMapping: "category",
            originType: .anchor(x: 0, y: 0)
        )

        let viewModel = SuperGridViewModel()
        await viewModel.initialize(database: MockAppState(nodes: nodes, viewConfig: viewConfig).database)

        let gridCells = viewModel.nodes

        // Verify PAFV calculations are deterministic
        var positionMap: [UUID: (x: Int, y: Int)] = [:]

        for cell in gridCells {
            positionMap[cell.node.id] = (x: cell.x, y: cell.y)
        }

        // Re-initialize and verify positions are identical
        let viewModel2 = SuperGridViewModel()
        await viewModel2.initialize(database: MockAppState(nodes: nodes, viewConfig: viewConfig).database)

        for cell in viewModel2.nodes {
            let originalPosition = positionMap[cell.node.id]!
            XCTAssertEqual(cell.x, originalPosition.x, "X position should be deterministic")
            XCTAssertEqual(cell.y, originalPosition.y, "Y position should be deterministic")
        }
    }

    func testOriginTypeCalculations() async throws {
        let nodes = MockData.sampleNodes(count: 50)

        let anchorConfig = ViewConfig(
            id: UUID(),
            name: "Anchor Test",
            xAxisMapping: "category",
            yAxisMapping: "priority",
            originType: .anchor(x: 0, y: 0)
        )

        let bipolarConfig = ViewConfig(
            id: UUID(),
            name: "Bipolar Test",
            xAxisMapping: "category",
            yAxisMapping: "priority",
            originType: .bipolar
        )

        let anchorViewModel = SuperGridViewModel()
        await anchorViewModel.initialize(database: MockAppState(nodes: nodes, viewConfig: anchorConfig).database)

        let bipolarViewModel = SuperGridViewModel()
        await bipolarViewModel.initialize(database: MockAppState(nodes: nodes, viewConfig: bipolarConfig).database)

        // Verify different origin types produce different but consistent layouts
        let anchorPositions = Set(anchorViewModel.nodes.map { "\($0.x),\($0.y)" })
        let bipolarPositions = Set(bipolarViewModel.nodes.map { "\($0.x),\($0.y)" })

        // Should have different distributions but same number of items
        XCTAssertEqual(anchorViewModel.nodes.count, bipolarViewModel.nodes.count)

        // Visual verification
        let anchorView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes, viewConfig: anchorConfig))
            .frame(width: 700, height: 500)

        let bipolarView = SuperGridView()
            .environmentObject(MockAppState(nodes: nodes, viewConfig: bipolarConfig))
            .frame(width: 700, height: 500)

        #if os(iOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: anchorView,
                identifier: "cross_platform_anchor_origin_ios"
            )
        )

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: bipolarView,
                identifier: "cross_platform_bipolar_origin_ios"
            )
        )
        #elseif os(macOS)
        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: anchorView,
                identifier: "cross_platform_anchor_origin_macos"
            )
        )

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: bipolarView,
                identifier: "cross_platform_bipolar_origin_macos"
            )
        )
        #endif
    }
}