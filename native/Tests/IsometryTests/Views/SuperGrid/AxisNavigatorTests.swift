import XCTest
@testable import Isometry

/// Tests for Axis Navigator functionality
/// Validates drag-and-drop axis assignment from CardBoard v1/v2
final class AxisNavigatorTests: XCTestCase {

    var viewModel: AxisNavigatorViewModel!

    override func setUp() async throws {
        await MainActor.run {
            viewModel = AxisNavigatorViewModel()
        }
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - AxisSelection Tests

    func testAxisSelection_creation() {
        // Given/When
        let axis = AxisSelection(
            id: "test_axis",
            name: "Test Axis",
            type: .category,
            plane: .x,
            values: ["Value1", "Value2"],
            description: "Test description"
        )

        // Then
        XCTAssertEqual(axis.id, "test_axis")
        XCTAssertEqual(axis.name, "Test Axis")
        XCTAssertEqual(axis.type, .category)
        XCTAssertEqual(axis.plane, .x)
        XCTAssertEqual(axis.values, ["Value1", "Value2"])
        XCTAssertEqual(axis.description, "Test description")
    }

    func testAxisSelection_axisTypes() {
        // Test all axis types
        let types = AxisSelection.AxisType.allCases
        XCTAssertEqual(types.count, 5)
        XCTAssertTrue(types.contains(.location))
        XCTAssertTrue(types.contains(.alphabet))
        XCTAssertTrue(types.contains(.time))
        XCTAssertTrue(types.contains(.category))
        XCTAssertTrue(types.contains(.hierarchy))
    }

    func testAxisSelection_planeTypes() {
        // Test all plane types
        let planes = AxisSelection.PlaneType.allCases
        XCTAssertEqual(planes.count, 4)
        XCTAssertTrue(planes.contains(.x))
        XCTAssertTrue(planes.contains(.y))
        XCTAssertTrue(planes.contains(.z))
        XCTAssertTrue(planes.contains(.available))
    }

    func testAxisSelection_hashable() {
        // Given
        let axis1 = AxisSelection(id: "test", name: "Test", type: .category, plane: .x)
        let axis2 = AxisSelection(id: "test", name: "Test", type: .category, plane: .x)
        let axis3 = AxisSelection(id: "different", name: "Test", type: .category, plane: .x)

        // Then
        XCTAssertEqual(axis1, axis2)
        XCTAssertNotEqual(axis1, axis3)

        let set: Set<AxisSelection> = [axis1, axis2, axis3]
        XCTAssertEqual(set.count, 2) // axis1 and axis2 should be treated as same
    }

    // MARK: - AxisNavigatorViewModel Tests

    @MainActor
    func testAxisNavigatorViewModel_initialization() {
        // Then
        XCTAssertTrue(viewModel.rowAxes.isEmpty)
        XCTAssertTrue(viewModel.columnAxes.isEmpty)
        XCTAssertTrue(viewModel.filterAxes.isEmpty)
        XCTAssertFalse(viewModel.availableAxes.isEmpty) // Should have default axes
        XCTAssertNil(viewModel.draggedAxis)
        XCTAssertNil(viewModel.dragOverPlane)
    }

    @MainActor
    func testAxisNavigatorViewModel_defaultAxes() {
        // Then
        XCTAssertGreaterThan(viewModel.availableAxes.count, 0)

        // Check for specific default axes
        let axisIds = viewModel.availableAxes.map { $0.id }
        XCTAssertTrue(axisIds.contains("folder"))
        XCTAssertTrue(axisIds.contains("modified_time"))
        XCTAssertTrue(axisIds.contains("priority"))
        XCTAssertTrue(axisIds.contains("tags"))
        XCTAssertTrue(axisIds.contains("word_count"))
        XCTAssertTrue(axisIds.contains("first_letter"))
    }

    @MainActor
    func testAxisNavigatorViewModel_assignAxis() {
        // Given
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        let initialAvailableCount = viewModel.availableAxes.count
        let initialRowCount = viewModel.rowAxes.count

        // When
        viewModel.assignAxis(folderAxis, to: .y)

        // Then
        XCTAssertEqual(viewModel.availableAxes.count, initialAvailableCount - 1)
        XCTAssertEqual(viewModel.rowAxes.count, initialRowCount + 1)
        XCTAssertTrue(viewModel.rowAxes.contains { $0.id == "folder" })
        XCTAssertFalse(viewModel.availableAxes.contains { $0.id == "folder" })
    }

    @MainActor
    func testAxisNavigatorViewModel_removeAxis() {
        // Given
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        viewModel.assignAxis(folderAxis, to: .y)
        XCTAssertTrue(viewModel.rowAxes.contains { $0.id == "folder" })

        // When
        viewModel.removeAxis("folder")

        // Then
        XCTAssertFalse(viewModel.rowAxes.contains { $0.id == "folder" })
        XCTAssertFalse(viewModel.columnAxes.contains { $0.id == "folder" })
        XCTAssertFalse(viewModel.filterAxes.contains { $0.id == "folder" })
        XCTAssertFalse(viewModel.availableAxes.contains { $0.id == "folder" })
    }

    @MainActor
    func testAxisNavigatorViewModel_reassignAxis() {
        // Given
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        viewModel.assignAxis(folderAxis, to: .y)
        XCTAssertTrue(viewModel.rowAxes.contains { $0.id == "folder" })

        // When: Reassign to columns
        viewModel.assignAxis(folderAxis, to: .x)

        // Then
        XCTAssertFalse(viewModel.rowAxes.contains { $0.id == "folder" })
        XCTAssertTrue(viewModel.columnAxes.contains { $0.id == "folder" })
    }

    @MainActor
    func testAxisNavigatorViewModel_reorderAxis() {
        // Given: Add multiple axes to rows
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        let priorityAxis = viewModel.availableAxes.first { $0.id == "priority" }!
        let tagsAxis = viewModel.availableAxes.first { $0.id == "tags" }!

        viewModel.assignAxis(folderAxis, to: .y)
        viewModel.assignAxis(priorityAxis, to: .y)
        viewModel.assignAxis(tagsAxis, to: .y)

        // Verify initial order
        XCTAssertEqual(viewModel.rowAxes.map { $0.id }, ["folder", "priority", "tags"])

        // When: Reorder priority to first position
        viewModel.reorderAxis("priority", to: 0, in: .y)

        // Then
        XCTAssertEqual(viewModel.rowAxes.map { $0.id }, ["priority", "folder", "tags"])
    }

    @MainActor
    func testAxisNavigatorViewModel_dragHandling() {
        // Given
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!

        // When: Start drag
        viewModel.startDrag(folderAxis)

        // Then
        XCTAssertEqual(viewModel.draggedAxis?.id, "folder")

        // When: Drag over plane
        viewModel.dragOver(.x)

        // Then
        XCTAssertEqual(viewModel.dragOverPlane, .x)

        // When: End drag
        viewModel.endDrag(in: .x)

        // Then
        XCTAssertNil(viewModel.draggedAxis)
        XCTAssertNil(viewModel.dragOverPlane)
        XCTAssertTrue(viewModel.columnAxes.contains { $0.id == "folder" })
    }

    @MainActor
    func testAxisNavigatorViewModel_dragToSamePlane() {
        // Given
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        viewModel.assignAxis(folderAxis, to: .y)

        // When: Drag within same plane (should not change assignment)
        viewModel.startDrag(folderAxis)
        viewModel.endDrag(in: .y)

        // Then
        XCTAssertTrue(viewModel.rowAxes.contains { $0.id == "folder" })
        XCTAssertFalse(viewModel.columnAxes.contains { $0.id == "folder" })
    }

    @MainActor
    func testAxisNavigatorViewModel_callbacks() {
        // Given
        var assignedAxis: AxisSelection?
        var assignedPlane: AxisSelection.PlaneType?
        var removedAxisId: String?
        var reorderedAxisId: String?

        viewModel.onAxisAssign = { axis, plane in
            assignedAxis = axis
            assignedPlane = plane
        }

        viewModel.onAxisRemove = { axisId in
            removedAxisId = axisId
        }

        viewModel.onAxisReorder = { axisId, _, _ in
            reorderedAxisId = axisId
        }

        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!

        // When: Assign axis
        viewModel.assignAxis(folderAxis, to: .x)

        // Then
        XCTAssertEqual(assignedAxis?.id, "folder")
        XCTAssertEqual(assignedPlane, .x)

        // When: Remove axis
        viewModel.removeAxis("folder")

        // Then
        XCTAssertEqual(removedAxisId, "folder")
    }

    // MARK: - Edge Cases

    @MainActor
    func testAxisNavigatorViewModel_edgeCases() {
        // Test removing non-existent axis
        viewModel.removeAxis("non_existent")
        // Should not crash

        // Test reordering in empty plane
        viewModel.reorderAxis("folder", to: 0, in: .x)
        // Should not crash

        // Test drag end without start
        viewModel.endDrag(in: .x)
        // Should not crash
    }

    // MARK: - Performance Tests

    @MainActor
    func testAxisNavigatorViewModel_performance() {
        measure {
            for i in 0..<100 {
                let axis = AxisSelection(
                    id: "test_\(i)",
                    name: "Test \(i)",
                    type: .category,
                    plane: .available
                )
                viewModel.assignAxis(axis, to: .x)
                viewModel.assignAxis(axis, to: .y)
                viewModel.assignAxis(axis, to: .z)
                viewModel.removeAxis("test_\(i)")
            }
        }
    }

    // MARK: - Integration Tests

    @MainActor
    func testAxisNavigatorViewModel_complexWorkflow() {
        // Simulate a complex user workflow
        let folderAxis = viewModel.availableAxes.first { $0.id == "folder" }!
        let timeAxis = viewModel.availableAxes.first { $0.id == "modified_time" }!
        let priorityAxis = viewModel.availableAxes.first { $0.id == "priority" }!

        // 1. Assign folder to rows
        viewModel.assignAxis(folderAxis, to: .y)
        XCTAssertEqual(viewModel.rowAxes.count, 1)

        // 2. Assign time to columns
        viewModel.assignAxis(timeAxis, to: .x)
        XCTAssertEqual(viewModel.columnAxes.count, 1)

        // 3. Assign priority to filters
        viewModel.assignAxis(priorityAxis, to: .z)
        XCTAssertEqual(viewModel.filterAxes.count, 1)

        // 4. Reassign folder from rows to columns
        viewModel.assignAxis(folderAxis, to: .x)
        XCTAssertEqual(viewModel.rowAxes.count, 0)
        XCTAssertEqual(viewModel.columnAxes.count, 2)

        // 5. Remove time completely
        viewModel.removeAxis("modified_time")
        XCTAssertEqual(viewModel.columnAxes.count, 1)
        XCTAssertTrue(viewModel.columnAxes.first?.id == "folder")

        // 6. Move everything back to available
        viewModel.assignAxis(folderAxis, to: .available)
        viewModel.assignAxis(priorityAxis, to: .available)
        XCTAssertEqual(viewModel.rowAxes.count, 0)
        XCTAssertEqual(viewModel.columnAxes.count, 0)
        XCTAssertEqual(viewModel.filterAxes.count, 0)
        XCTAssertEqual(viewModel.availableAxes.count, 4) // folder + priority + remaining defaults
    }
}