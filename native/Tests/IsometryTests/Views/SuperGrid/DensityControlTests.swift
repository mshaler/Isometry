import XCTest
@testable import Isometry

/// Tests for SuperDensitySparsity control functionality
/// Validates hierarchical data aggregation from CardBoard v1/v2
final class DensityControlTests: XCTestCase {

    // MARK: - DensityLevel Tests

    func testDensityLevel_creation() {
        // Given/When
        let level = DensityLevel(
            id: "test_level",
            name: "Test Level",
            aggregation: .group,
            collapseDepth: 2
        )

        // Then
        XCTAssertEqual(level.id, "test_level")
        XCTAssertEqual(level.name, "Test Level")
        XCTAssertEqual(level.aggregation, .group)
        XCTAssertEqual(level.collapseDepth, 2)
    }

    func testDensityLevel_aggregationTypes() {
        let noneLevel = DensityLevel(id: "1", name: "None", aggregation: .none, collapseDepth: 0)
        let groupLevel = DensityLevel(id: "2", name: "Group", aggregation: .group, collapseDepth: 1)
        let rollupLevel = DensityLevel(id: "3", name: "Rollup", aggregation: .rollup, collapseDepth: 2)

        XCTAssertEqual(noneLevel.aggregation, .none)
        XCTAssertEqual(groupLevel.aggregation, .group)
        XCTAssertEqual(rollupLevel.aggregation, .rollup)
    }

    // MARK: - DensityHierarchy Tests

    func testDensityHierarchy_creation() {
        // Given
        let sparseValues = ["Capture", "Backlog", "TODO"]
        let denseValue = "TO DO"

        // When
        let hierarchy = DensityHierarchy(
            sparseValues: sparseValues,
            denseValue: denseValue
        )

        // Then
        XCTAssertEqual(hierarchy.sparseValues, sparseValues)
        XCTAssertEqual(hierarchy.denseValue, denseValue)
        XCTAssertEqual(hierarchy.mapping.count, 3)
        XCTAssertEqual(hierarchy.mapping["Capture"], "TO DO")
        XCTAssertEqual(hierarchy.mapping["Backlog"], "TO DO")
        XCTAssertEqual(hierarchy.mapping["TODO"], "TO DO")
    }

    func testDensityHierarchy_emptyValues() {
        // Given
        let hierarchy = DensityHierarchy(
            sparseValues: [],
            denseValue: "Empty"
        )

        // Then
        XCTAssertTrue(hierarchy.sparseValues.isEmpty)
        XCTAssertEqual(hierarchy.denseValue, "Empty")
        XCTAssertTrue(hierarchy.mapping.isEmpty)
    }

    // MARK: - DensityControlViewModel Tests

    @MainActor
    func testDensityControlViewModel_initialization() {
        // Given
        let hierarchies = [
            DensityHierarchy(sparseValues: ["A", "B"], denseValue: "AB"),
            DensityHierarchy(sparseValues: ["C", "D"], denseValue: "CD")
        ]

        // When
        let viewModel = DensityControlViewModel(
            facetId: "test_facet",
            hierarchies: hierarchies
        )

        // Then
        XCTAssertEqual(viewModel.currentLevel, 0)
        XCTAssertEqual(viewModel.facetId, "test_facet")
        XCTAssertEqual(viewModel.hierarchies.count, 2)
        XCTAssertEqual(viewModel.maxLevel, 2)
    }

    @MainActor
    func testDensityControlViewModel_setLevel() {
        // Given
        let hierarchies = [
            DensityHierarchy(sparseValues: ["A"], denseValue: "Level1"),
            DensityHierarchy(sparseValues: ["B"], denseValue: "Level2")
        ]
        let viewModel = DensityControlViewModel(facetId: "test", hierarchies: hierarchies)

        var changedFacetId: String?
        var changedLevel: Int?
        var changedHierarchy: DensityHierarchy?

        viewModel.onChange = { facetId, level, hierarchy in
            changedFacetId = facetId
            changedLevel = level
            changedHierarchy = hierarchy
        }

        // When
        viewModel.setLevel(1)

        // Then
        XCTAssertEqual(viewModel.currentLevel, 1)
        XCTAssertEqual(changedFacetId, "test")
        XCTAssertEqual(changedLevel, 1)
        XCTAssertEqual(changedHierarchy?.denseValue, "Level1")
    }

    @MainActor
    func testDensityControlViewModel_setLevelBounds() {
        // Given
        let hierarchies = [
            DensityHierarchy(sparseValues: ["A"], denseValue: "Level1")
        ]
        let viewModel = DensityControlViewModel(facetId: "test", hierarchies: hierarchies)

        // When: Set level below minimum
        viewModel.setLevel(-1)

        // Then
        XCTAssertEqual(viewModel.currentLevel, 0)

        // When: Set level above maximum
        viewModel.setLevel(5)

        // Then
        XCTAssertEqual(viewModel.currentLevel, 1) // maxLevel
    }

    @MainActor
    func testDensityControlViewModel_getCurrentHierarchy() {
        // Given
        let hierarchies = [
            DensityHierarchy(sparseValues: ["A"], denseValue: "Level1"),
            DensityHierarchy(sparseValues: ["B"], denseValue: "Level2")
        ]
        let viewModel = DensityControlViewModel(facetId: "test", hierarchies: hierarchies)

        // When: At level 0
        var hierarchy = viewModel.getCurrentHierarchy()

        // Then
        XCTAssertNil(hierarchy)

        // When: At level 1
        viewModel.setLevel(1)
        hierarchy = viewModel.getCurrentHierarchy()

        // Then
        XCTAssertEqual(hierarchy?.denseValue, "Level1")

        // When: At level 2
        viewModel.setLevel(2)
        hierarchy = viewModel.getCurrentHierarchy()

        // Then
        XCTAssertEqual(hierarchy?.denseValue, "Level2")
    }

    @MainActor
    func testDensityControlViewModel_getLevelDescription() {
        // Given
        let hierarchies = [
            DensityHierarchy(sparseValues: ["A"], denseValue: "Custom Level")
        ]
        let viewModel = DensityControlViewModel(facetId: "test", hierarchies: hierarchies)

        // When: At level 0
        var description = viewModel.getLevelDescription()

        // Then
        XCTAssertEqual(description, "Individual")

        // When: At level 1
        viewModel.setLevel(1)
        description = viewModel.getLevelDescription()

        // Then
        XCTAssertEqual(description, "Custom Level")
    }

    @MainActor
    func testDensityControlViewModel_updateHierarchies() {
        // Given
        let initialHierarchies = [
            DensityHierarchy(sparseValues: ["A"], denseValue: "Level1")
        ]
        let viewModel = DensityControlViewModel(facetId: "test", hierarchies: initialHierarchies)
        viewModel.setLevel(1)

        // When: Update with fewer hierarchies
        let newHierarchies: [DensityHierarchy] = []
        viewModel.updateHierarchies(newHierarchies)

        // Then
        XCTAssertEqual(viewModel.hierarchies.count, 0)
        XCTAssertEqual(viewModel.currentLevel, 0) // Should reset to 0 when level exceeds new count
    }

    // MARK: - DensityTransformer Tests

    func testDensityTransformer_getAggregatedCounts() {
        // Given
        struct TestItem {
            let id: String
            let status: String
        }

        let items = [
            TestItem(id: "1", status: "Capture"),
            TestItem(id: "2", status: "Backlog"),
            TestItem(id: "3", status: "TODO"),
            TestItem(id: "4", status: "Doing"),
            TestItem(id: "5", status: "Capture")
        ]

        let hierarchy = DensityHierarchy(
            sparseValues: ["Capture", "Backlog", "TODO"],
            denseValue: "TO DO"
        )

        // When
        let counts = DensityTransformer.getAggregatedCounts(
            from: items,
            keyPath: \.status,
            hierarchy: hierarchy
        )

        // Then
        XCTAssertEqual(counts["TO DO"], 3) // Capture(2) + Backlog(1) + TODO(0)
        XCTAssertEqual(counts["Doing"], 1)
        XCTAssertEqual(counts.count, 2)
    }

    func testDensityTransformer_getAggregatedCounts_noHierarchy() {
        // Given
        struct TestItem {
            let status: String
        }

        let items = [
            TestItem(status: "A"),
            TestItem(status: "B"),
            TestItem(status: "A")
        ]

        // When: No hierarchy
        let counts = DensityTransformer.getAggregatedCounts(
            from: items,
            keyPath: \.status,
            hierarchy: nil
        )

        // Then
        XCTAssertEqual(counts["A"], 2)
        XCTAssertEqual(counts["B"], 1)
        XCTAssertEqual(counts.count, 2)
    }

    func testDensityTransformer_buildDensityHierarchy() {
        // Given
        let sparseValues = ["A", "B", "C"]
        let denseMapping: [String: [String]] = [
            "Group1": ["A", "B"],
            "Group2": ["C"]
        ]

        // When
        let hierarchies = DensityTransformer.buildDensityHierarchy(
            sparseValues: sparseValues,
            denseMapping: denseMapping
        )

        // Then
        XCTAssertEqual(hierarchies.count, 2)

        let group1Hierarchy = hierarchies.first { $0.denseValue == "Group1" }
        XCTAssertNotNil(group1Hierarchy)
        XCTAssertEqual(group1Hierarchy?.sparseValues, ["A", "B"])

        let group2Hierarchy = hierarchies.first { $0.denseValue == "Group2" }
        XCTAssertNotNil(group2Hierarchy)
        XCTAssertEqual(group2Hierarchy?.sparseValues, ["C"])
    }

    // MARK: - DensityControlFactory Tests

    @MainActor
    func testDensityControlFactory_createStatusDensityControl() {
        // Given
        var changeCallbackCalled = false

        // When
        let viewModel = DensityControlFactory.createStatusDensityControl { _, _, _ in
            changeCallbackCalled = true
        }

        // Then
        XCTAssertEqual(viewModel.facetId, "status")
        XCTAssertEqual(viewModel.hierarchies.count, 3)
        XCTAssertGreaterThan(viewModel.maxLevel, 0)

        // Test callback
        viewModel.setLevel(1)
        XCTAssertTrue(changeCallbackCalled)

        // Check hierarchy values
        let firstHierarchy = viewModel.hierarchies.first
        XCTAssertEqual(firstHierarchy?.denseValue, "TO DO")
        XCTAssertTrue(firstHierarchy?.sparseValues.contains("Capture") ?? false)
    }

    @MainActor
    func testDensityControlFactory_createPriorityDensityControl() {
        // When
        let viewModel = DensityControlFactory.createPriorityDensityControl { _, _, _ in }

        // Then
        XCTAssertEqual(viewModel.facetId, "priority")
        XCTAssertEqual(viewModel.hierarchies.count, 2)

        let highPriorityHierarchy = viewModel.hierarchies.first
        XCTAssertEqual(highPriorityHierarchy?.denseValue, "High Priority")
        XCTAssertTrue(highPriorityHierarchy?.sparseValues.contains("Critical") ?? false)
    }

    // MARK: - PresetDensityControl.PresetType Tests

    func testPresetType_facetIds() {
        XCTAssertEqual(PresetDensityControl.PresetType.status.facetId, "status")
        XCTAssertEqual(PresetDensityControl.PresetType.priority.facetId, "priority")
        XCTAssertEqual(PresetDensityControl.PresetType.category.facetId, "category")
        XCTAssertEqual(PresetDensityControl.PresetType.time.facetId, "time")
    }

    func testPresetType_hierarchies() {
        // Test status hierarchies
        let statusHierarchies = PresetDensityControl.PresetType.status.hierarchies
        XCTAssertEqual(statusHierarchies.count, 3)

        let todoHierarchy = statusHierarchies.first { $0.denseValue == "TO DO" }
        XCTAssertNotNil(todoHierarchy)
        XCTAssertTrue(todoHierarchy?.sparseValues.contains("Capture") ?? false)

        // Test priority hierarchies
        let priorityHierarchies = PresetDensityControl.PresetType.priority.hierarchies
        XCTAssertEqual(priorityHierarchies.count, 3)

        // Test category hierarchies
        let categoryHierarchies = PresetDensityControl.PresetType.category.hierarchies
        XCTAssertEqual(categoryHierarchies.count, 3)

        // Test time hierarchies
        let timeHierarchies = PresetDensityControl.PresetType.time.hierarchies
        XCTAssertEqual(timeHierarchies.count, 3)
    }

    // MARK: - Edge Cases

    @MainActor
    func testDensityControlViewModel_edgeCases() {
        // Test with no hierarchies
        let viewModel = DensityControlViewModel(facetId: "empty", hierarchies: [])
        XCTAssertEqual(viewModel.maxLevel, 0)
        XCTAssertNil(viewModel.getCurrentHierarchy())

        // Test setting same level multiple times
        var changeCount = 0
        viewModel.onChange = { _, _, _ in changeCount += 1 }

        viewModel.setLevel(0)
        viewModel.setLevel(0)
        viewModel.setLevel(0)

        XCTAssertEqual(changeCount, 0) // Should not trigger changes for same level
    }

    // MARK: - Performance Tests

    @MainActor
    func testDensityControlViewModel_performance() {
        // Given: Large hierarchy
        let largeHierarchy = (0..<1000).map { i in
            DensityHierarchy(
                sparseValues: ["sparse_\(i)"],
                denseValue: "dense_\(i)"
            )
        }

        let viewModel = DensityControlViewModel(
            facetId: "performance_test",
            hierarchies: largeHierarchy
        )

        // When/Then: Should handle level changes efficiently
        measure {
            for i in 0..<100 {
                viewModel.setLevel(i % 50)
            }
        }
    }

    // MARK: - Integration Tests

    @MainActor
    func testDensityControl_integrationWorkflow() {
        // Simulate a complete density control workflow
        let viewModel = DensityControlFactory.createStatusDensityControl { facetId, level, hierarchy in
            // Verify callback data
            XCTAssertEqual(facetId, "status")
            XCTAssertGreaterThanOrEqual(level, 0)
            if level > 0 {
                XCTAssertNotNil(hierarchy)
            } else {
                XCTAssertNil(hierarchy)
            }
        }

        // Start at individual level
        XCTAssertEqual(viewModel.currentLevel, 0)
        XCTAssertEqual(viewModel.getLevelDescription(), "Individual")

        // Move to first aggregation level
        viewModel.setLevel(1)
        XCTAssertEqual(viewModel.currentLevel, 1)
        XCTAssertEqual(viewModel.getLevelDescription(), "TO DO")

        // Move to maximum level
        viewModel.setLevel(viewModel.maxLevel)
        XCTAssertEqual(viewModel.currentLevel, viewModel.maxLevel)

        // Return to individual level
        viewModel.setLevel(0)
        XCTAssertEqual(viewModel.currentLevel, 0)
        XCTAssertEqual(viewModel.getLevelDescription(), "Individual")
    }
}