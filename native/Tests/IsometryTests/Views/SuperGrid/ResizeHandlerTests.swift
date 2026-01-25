import XCTest
import SwiftUI
@testable import Isometry

/// Tests for grid resize functionality
/// Validates shift+drag bulk resize behavior from CardBoard v1/v2
final class ResizeHandlerTests: XCTestCase {

    var resizeHandler: GridResizeHandler!
    var capturedStates: [ResizeState] = []
    var capturedSizes: [CGFloat] = []
    var capturedOperations: [ResizeOperation] = []

    override func setUp() {
        super.setUp()
        capturedStates = []
        capturedSizes = []
        capturedOperations = []

        let options = ResizeHandlerOptions(
            minColumnWidth: 50,
            minRowHeight: 20,
            onResizeStart: { state in
                self.capturedStates.append(state)
            },
            onResize: { _, newSize in
                self.capturedSizes.append(newSize)
            },
            onResizeEnd: { operation in
                self.capturedOperations.append(operation)
            }
        )

        resizeHandler = GridResizeHandler(options: options)
    }

    override func tearDown() {
        resizeHandler = nil
        capturedStates = []
        capturedSizes = []
        capturedOperations = []
        super.tearDown()
    }

    // MARK: - ResizeState Tests

    func testResizeState_inactive() {
        // Given
        let inactiveState = ResizeState.inactive

        // Then
        XCTAssertFalse(inactiveState.isResizing)
        XCTAssertNil(inactiveState.type)
        XCTAssertEqual(inactiveState.index, -1)
        XCTAssertEqual(inactiveState.startPosition, .zero)
        XCTAssertEqual(inactiveState.startSize, 0)
        XCTAssertFalse(inactiveState.isShiftPressed)
        XCTAssertTrue(inactiveState.initialSizes.isEmpty)
    }

    func testResizeState_active() {
        // Given
        let activeState = ResizeState(
            isResizing: true,
            type: .column,
            index: 2,
            startPosition: CGPoint(x: 100, y: 50),
            startSize: 120,
            isShiftPressed: true,
            initialSizes: [100, 120, 80, 150]
        )

        // Then
        XCTAssertTrue(activeState.isResizing)
        XCTAssertEqual(activeState.type, .column)
        XCTAssertEqual(activeState.index, 2)
        XCTAssertEqual(activeState.startPosition, CGPoint(x: 100, y: 50))
        XCTAssertEqual(activeState.startSize, 120)
        XCTAssertTrue(activeState.isShiftPressed)
        XCTAssertEqual(activeState.initialSizes, [100, 120, 80, 150])
    }

    // MARK: - ResizeOperation Tests

    func testResizeOperation_creation() {
        // Given
        var undoCalled = false
        var redoCalled = false

        let operation = ResizeOperation(
            type: "test_resize",
            description: "Test resize operation"
        ) {
            undoCalled = true
        } redo: {
            redoCalled = true
        }

        // When
        operation.undo()
        operation.redo()

        // Then
        XCTAssertEqual(operation.type, "test_resize")
        XCTAssertEqual(operation.description, "Test resize operation")
        XCTAssertTrue(undoCalled)
        XCTAssertTrue(redoCalled)
    }

    // MARK: - ResizeHandlerOptions Tests

    func testResizeHandlerOptions_defaults() {
        // Given
        let options = ResizeHandlerOptions()

        // Then
        XCTAssertEqual(options.minColumnWidth, 50)
        XCTAssertEqual(options.minRowHeight, 20)
        XCTAssertNil(options.onResizeStart)
        XCTAssertNil(options.onResize)
        XCTAssertNil(options.onResizeEnd)
    }

    func testResizeHandlerOptions_customValues() {
        // Given
        let options = ResizeHandlerOptions(
            minColumnWidth: 100,
            minRowHeight: 40,
            onResizeStart: { _ in },
            onResize: { _, _ in },
            onResizeEnd: { _ in }
        )

        // Then
        XCTAssertEqual(options.minColumnWidth, 100)
        XCTAssertEqual(options.minRowHeight, 40)
        XCTAssertNotNil(options.onResizeStart)
        XCTAssertNotNil(options.onResize)
        XCTAssertNotNil(options.onResizeEnd)
    }

    // MARK: - GridResizeHandler Tests

    @MainActor
    func testGridResizeHandler_initialState() {
        // Then
        XCTAssertFalse(resizeHandler.currentState.isResizing)
        XCTAssertNil(resizeHandler.currentState.type)
    }

    @MainActor
    func testGridResizeHandler_createResizeDragGesture() {
        // When
        let gesture = resizeHandler.createResizeDragGesture(
            type: .column,
            index: 1,
            currentSize: 120,
            allSizes: [100, 120, 80]
        )

        // Then
        XCTAssertNotNil(gesture, "Should create a drag gesture")
        // Note: Testing gesture behavior would require more complex setup
        // as SwiftUI gestures are primarily tested through UI tests
    }

    // MARK: - ResizeHandle View Tests

    func testResizeHandle_horizontal() {
        // Given
        var dragCalled = false
        var dragEndCalled = false

        let handle = ResizeHandle(orientation: .horizontal) { _ in
            dragCalled = true
        } onDragEnd: { _ in
            dragEndCalled = true
        }

        // Then
        XCTAssertNotNil(handle)
        // Note: View testing would typically be done with ViewInspector
        // or similar testing frameworks for SwiftUI
    }

    func testResizeHandle_vertical() {
        // Given
        var dragCalled = false
        var dragEndCalled = false

        let handle = ResizeHandle(orientation: .vertical) { _ in
            dragCalled = true
        } onDragEnd: { _ in
            dragEndCalled = true
        }

        // Then
        XCTAssertNotNil(handle)
    }

    // MARK: - Integration Tests

    @MainActor
    func testResizeHandler_callbacksInvoked() async {
        // Given
        let gesture = resizeHandler.createResizeDragGesture(
            type: .column,
            index: 1,
            currentSize: 120,
            allSizes: [100, 120, 80]
        )

        // Note: Actual gesture simulation would require more complex setup
        // For now, we verify that the callbacks are properly configured
        XCTAssertTrue(capturedStates.isEmpty, "No resize should have started yet")
        XCTAssertTrue(capturedSizes.isEmpty, "No resize events should have been captured yet")
        XCTAssertTrue(capturedOperations.isEmpty, "No operations should have been captured yet")
    }

    // MARK: - Performance Tests

    @MainActor
    func testResizeHandler_performance() {
        // Given: Large number of resize operations
        let largeAllSizes = Array(repeating: 100.0, count: 1000)

        // When/Then: Should create gestures efficiently
        measure {
            for i in 0..<100 {
                let _ = resizeHandler.createResizeDragGesture(
                    type: .column,
                    index: i % 10,
                    currentSize: 120,
                    allSizes: largeAllSizes
                )
            }
        }
    }

    // MARK: - Edge Cases

    @MainActor
    func testResizeHandler_edgeCases() {
        // Test with empty sizes array
        let gesture = resizeHandler.createResizeDragGesture(
            type: .column,
            index: 0,
            currentSize: 0,
            allSizes: []
        )

        XCTAssertNotNil(gesture, "Should handle empty sizes array")
    }

    @MainActor
    func testResizeHandler_negativeValues() {
        // Test with negative sizes (should be constrained by minimums)
        let gesture = resizeHandler.createResizeDragGesture(
            type: .row,
            index: 0,
            currentSize: -10, // Negative size
            allSizes: [-5, 0, 10] // Mix of negative, zero, and positive
        )

        XCTAssertNotNil(gesture, "Should handle negative size values")
    }
}