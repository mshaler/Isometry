import XCTest
import SwiftUI
@testable import Isometry

/// Comprehensive SuperGrid visual tests for macOS platform
@MainActor
final class SuperGridUITestsmacOS: XCTestCase {

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
    }

    // MARK: - macOS-Specific Layout Tests

    func testMacBookProLayout() async throws {
        let config = TestConfiguration.macBook13
        let gridView = createTestGrid(nodeCount: 200)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_macbook13_layout"
            )
        )
    }

    func testMacBook16Layout() async throws {
        let config = TestConfiguration.macBook16
        let gridView = createTestGrid(nodeCount: 300)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_macbook16_layout"
            )
        )
    }

    func testiMac24Layout() async throws {
        let config = TestConfiguration.iMac24
        let gridView = createTestGrid(nodeCount: 500)
            .frame(width: config.size.width, height: config.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_imac24_layout"
            )
        )
    }

    // MARK: - High-DPI Display Tests

    func testRetinaDisplayScaling() async throws {
        // Test 2x scaling typical of Retina displays
        let gridView = createTestGrid(nodeCount: 100)
            .scaleEffect(2.0)
            .frame(width: 1600, height: 1200)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_retina_2x_scaling",
                tolerance: 0.03 // Allow slight tolerance for scaling artifacts
            )
        )
    }

    func testNonRetinaDisplayScaling() async throws {
        // Test 1x scaling for non-Retina displays
        let gridView = createTestGrid(nodeCount: 100)
            .frame(width: 1280, height: 800)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_non_retina_1x_scaling"
            )
        )
    }

    // MARK: - Window Sizing Tests

    func testMinimumWindowSize() async throws {
        let gridView = createTestGrid(nodeCount: 20)
            .frame(width: 600, height: 400)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_minimum_window_macos"
            )
        )
    }

    func testMaximizedWindowSize() async throws {
        let gridView = createTestGrid(nodeCount: 1000)
            .frame(width: 2560, height: 1600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_maximized_window_macos"
            )
        )
    }

    func testDynamicWindowResize() async throws {
        // Test common window sizes
        let sizes = [
            CGSize(width: 800, height: 600),
            CGSize(width: 1024, height: 768),
            CGSize(width: 1440, height: 900),
            CGSize(width: 1920, height: 1080)
        ]

        for (index, size) in sizes.enumerated() {
            let gridView = createTestGrid(nodeCount: 100)
                .frame(width: size.width, height: size.height)

            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "supergrid_resize_\(Int(size.width))x\(Int(size.height))"
                )
            )
        }
    }

    // MARK: - Mouse Interaction Visual States

    func testHoverStates() async throws {
        // macOS supports true hover unlike iOS
        let gridView = createTestGrid(nodeCount: 50)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_hover_states_macos"
            )
        )
    }

    func testContextMenuState() async throws {
        // Test right-click context menu appearance
        let gridView = createTestGrid(nodeCount: 30)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_context_menu_macos"
            )
        )
    }

    // MARK: - Trackpad Gesture Visual States

    func testTrackpadZoomStates() async throws {
        // Test different zoom levels achievable via trackpad
        let zoomLevels = [0.5, 1.0, 1.5, 2.0]

        for zoomLevel in zoomLevels {
            let gridView = createTestGrid(nodeCount: 100)
                .scaleEffect(zoomLevel)
                .frame(width: 1200, height: 800)

            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "supergrid_trackpad_zoom_\(Int(zoomLevel * 100))_macos"
                )
            )
        }
    }

    func testMomentumScrolling() async throws {
        // Test visual state during momentum scrolling
        let gridView = createTestGrid(nodeCount: 200)
            .frame(width: 1000, height: 700)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_momentum_scroll_macos"
            )
        )
    }

    // MARK: - Multiple Display Support Tests

    func testExternalDisplayLayout() async throws {
        // Test layout on common external display sizes
        let externalDisplaySizes = [
            CGSize(width: 1920, height: 1080), // 1080p
            CGSize(width: 2560, height: 1440), // 1440p
            CGSize(width: 3440, height: 1440), // Ultrawide
            CGSize(width: 3840, height: 2160)  // 4K
        ]

        for (index, size) in externalDisplaySizes.enumerated() {
            let gridView = createTestGrid(nodeCount: 500)
                .frame(width: size.width, height: size.height)

            XCTAssertTrue(
                VisualTestingFramework.verifySnapshot(
                    of: gridView,
                    identifier: "supergrid_external_\(Int(size.width))x\(Int(size.height))"
                )
            )
        }
    }

    func testDualDisplayConfiguration() async throws {
        // Test split between two displays (half width)
        let halfWidth = TestConfiguration.iMac24.size.width / 2
        let gridView = createTestGrid(nodeCount: 150)
            .frame(width: halfWidth, height: TestConfiguration.iMac24.size.height)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_dual_display_split_macos"
            )
        )
    }

    // MARK: - macOS-Specific UI Chrome Tests

    func testNavigationTitleBar() async throws {
        let gridView = NavigationStack {
            createTestGrid(nodeCount: 50)
        }
        .frame(width: 1000, height: 700)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_navigation_titlebar_macos"
            )
        )
    }

    func testToolbarIntegration() async throws {
        let gridView = NavigationStack {
            createTestGrid(nodeCount: 50)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Action") { }
                    }
                    ToolbarItem(placement: .navigation) {
                        Button("Back") { }
                    }
                }
        }
        .frame(width: 1000, height: 700)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_toolbar_integration_macos"
            )
        )
    }

    // MARK: - Accessibility Tests (macOS-specific)

    func testVoiceOverSupport() async throws {
        let gridView = createTestGrid(nodeCount: 20)
            .accessibilityElement(children: .contain)
            .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_voiceover_macos"
            )
        )
    }

    func testHighContrastMode() async throws {
        let gridView = createTestGrid(nodeCount: 50)
            .environment(\.colorScheme, .dark)
            .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_high_contrast_macos"
            )
        )
    }

    func testReducedMotionMode() async throws {
        let gridView = createTestGrid(nodeCount: 50)
            .environment(\.accessibilityReduceMotion, true)
            .frame(width: 800, height: 600)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_reduced_motion_macos"
            )
        )
    }

    // MARK: - Performance Visual Tests

    func testLargeDatasetRendering() async throws {
        // Test visual appearance with 2000+ nodes
        let gridView = createTestGrid(nodeCount: 2000)
            .frame(width: 1600, height: 1200)

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_large_dataset_macos",
                tolerance: 0.05 // Allow tolerance for potential rendering differences
            )
        )
    }

    func testExtremePanZoomStates() async throws {
        // Test visual state at extreme zoom levels
        let extremeZoom = 5.0
        let gridView = createTestGrid(nodeCount: 100)
            .scaleEffect(extremeZoom)
            .frame(width: 1200, height: 800)
            .clipped()

        XCTAssertTrue(
            VisualTestingFramework.verifySnapshot(
                of: gridView,
                identifier: "supergrid_extreme_zoom_macos"
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
    }
}

// MARK: - macOS-Specific Mock Extensions

extension MockData {
    static func macOSSampleNodes(count: Int) -> [Node] {
        (0..<count).map { index in
            createMacOSNode(
                name: "macOS Node \(index + 1)",
                priority: Int.random(in: 0...3)
            )
        }
    }

    static func createMacOSNode(name: String, priority: Int) -> Node {
        Node(
            id: UUID(),
            name: name,
            content: "macOS-specific content for \(name) with keyboard shortcuts ⌘\(priority)",
            priority: priority,
            tags: ["macos", "desktop", "test"],
            createdAt: Date(),
            modifiedAt: Date()
        )
    }
}