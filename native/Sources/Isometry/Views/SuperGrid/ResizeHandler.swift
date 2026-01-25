import Foundation
import SwiftUI

/// Resize state for tracking grid resize operations
public struct ResizeState {
    public let isResizing: Bool
    public let type: ResizeType?
    public let index: Int
    public let startPosition: CGPoint
    public let startSize: CGFloat
    public let isShiftPressed: Bool
    public let initialSizes: [CGFloat]

    public enum ResizeType {
        case row
        case column
        case rowHeader
        case columnHeader
    }

    public static let inactive = ResizeState(
        isResizing: false,
        type: nil,
        index: -1,
        startPosition: .zero,
        startSize: 0,
        isShiftPressed: false,
        initialSizes: []
    )
}

/// Resize operation for undo/redo functionality
public struct ResizeOperation {
    public let type: String
    public let description: String
    public let undo: () -> Void
    public let redo: () -> Void

    public init(type: String, description: String, undo: @escaping () -> Void, redo: @escaping () -> Void) {
        self.type = type
        self.description = description
        self.undo = undo
        self.redo = redo
    }
}

/// Configuration options for resize behavior
public struct ResizeHandlerOptions {
    public let minColumnWidth: CGFloat
    public let minRowHeight: CGFloat
    public let onResizeStart: ((ResizeState) -> Void)?
    public let onResize: ((ResizeState, CGFloat) -> Void)?
    public let onResizeEnd: ((ResizeOperation) -> Void)?

    public init(
        minColumnWidth: CGFloat = 50,
        minRowHeight: CGFloat = 20,
        onResizeStart: ((ResizeState) -> Void)? = nil,
        onResize: ((ResizeState, CGFloat) -> Void)? = nil,
        onResizeEnd: ((ResizeOperation) -> Void)? = nil
    ) {
        self.minColumnWidth = minColumnWidth
        self.minRowHeight = minRowHeight
        self.onResizeStart = onResizeStart
        self.onResize = onResize
        self.onResizeEnd = onResizeEnd
    }
}

/// Grid resize handler for SuperGrid
/// Implements shift+drag bulk resize functionality from CardBoard v1/v2
@MainActor
public final class GridResizeHandler: ObservableObject {
    @Published public private(set) var currentState: ResizeState = .inactive

    private let options: ResizeHandlerOptions
    private var dragGesture: DragGesture?

    public init(options: ResizeHandlerOptions = ResizeHandlerOptions()) {
        self.options = options
    }

    /// Create a resize drag gesture for a grid element
    public func createResizeDragGesture(
        type: ResizeState.ResizeType,
        index: Int,
        currentSize: CGFloat,
        allSizes: [CGFloat]
    ) -> some Gesture {
        DragGesture(minimumDistance: 1.0, coordinateSpace: .local)
            .onChanged { [weak self] value in
                self?.handleDragChanged(
                    value: value,
                    type: type,
                    index: index,
                    currentSize: currentSize,
                    allSizes: allSizes
                )
            }
            .onEnded { [weak self] value in
                self?.handleDragEnded(
                    value: value,
                    type: type,
                    index: index,
                    allSizes: allSizes
                )
            }
    }

    private func handleDragChanged(
        value: DragGesture.Value,
        type: ResizeState.ResizeType,
        index: Int,
        currentSize: CGFloat,
        allSizes: [CGFloat]
    ) {
        // Initialize resize state on first drag change
        if !currentState.isResizing {
            let newState = ResizeState(
                isResizing: true,
                type: type,
                index: index,
                startPosition: value.startLocation,
                startSize: currentSize,
                isShiftPressed: isShiftKeyPressed(),
                initialSizes: allSizes
            )
            currentState = newState
            options.onResizeStart?(newState)
        }

        // Calculate new size based on drag delta
        let isHorizontal = type == .column || type == .rowHeader
        let delta = isHorizontal
            ? value.translation.width
            : value.translation.height

        let minSize = isHorizontal ? options.minColumnWidth : options.minRowHeight
        let newSize = max(minSize, currentState.startSize + delta)

        options.onResize?(currentState, newSize)
    }

    private func handleDragEnded(
        value: DragGesture.Value,
        type: ResizeState.ResizeType,
        index: Int,
        allSizes: [CGFloat]
    ) {
        guard currentState.isResizing else { return }

        // Calculate final size
        let isHorizontal = type == .column || type == .rowHeader
        let delta = isHorizontal
            ? value.translation.width
            : value.translation.height

        let minSize = isHorizontal ? options.minColumnWidth : options.minRowHeight
        let finalSize = max(minSize, currentState.startSize + delta)

        // Create resize operation for undo/redo
        if let onResizeEnd = options.onResizeEnd {
            let initialSizes = currentState.initialSizes
            let wasShiftPressed = currentState.isShiftPressed
            let resizeType = type
            let resizeIndex = index

            let operation = ResizeOperation(
                type: "resize_change",
                description: "Resize \(type)\(wasShiftPressed ? " (all)" : "")"
            ) {
                // Undo: restore initial sizes
                self.restoreSizes(initialSizes, type: resizeType)
            } redo: {
                // Redo: apply final size(s)
                if wasShiftPressed {
                    self.applyBulkResize(finalSize, type: resizeType)
                } else {
                    self.applySingleResize(finalSize, type: resizeType, index: resizeIndex)
                }
            }

            onResizeEnd(operation)
        }

        // Reset state
        currentState = .inactive
    }

    // MARK: - Platform-specific methods

    #if os(macOS)
    private func isShiftKeyPressed() -> Bool {
        return NSEvent.modifierFlags.contains(.shift)
    }
    #else
    private func isShiftKeyPressed() -> Bool {
        // For iOS, we'll need to track shift state differently
        // This could be done through a gesture recognizer or UI element
        return false // Simplified for now
    }
    #endif

    // MARK: - Size application methods (to be implemented by caller)

    private func restoreSizes(_ sizes: [CGFloat], type: ResizeState.ResizeType) {
        // This would be implemented by the view model or parent component
        // For now, we'll just mark it as a placeholder
        print("Restore sizes: \(sizes) for type: \(type)")
    }

    private func applyBulkResize(_ size: CGFloat, type: ResizeState.ResizeType) {
        // Apply the same size to all rows/columns
        print("Apply bulk resize: \(size) for type: \(type)")
    }

    private func applySingleResize(_ size: CGFloat, type: ResizeState.ResizeType, index: Int) {
        // Apply size to single row/column at index
        print("Apply single resize: \(size) for type: \(type) at index: \(index)")
    }
}

/// SwiftUI view modifier for resize handles
public struct ResizeHandle: View {
    let orientation: Orientation
    let onDrag: (DragGesture.Value) -> Void
    let onDragEnd: (DragGesture.Value) -> Void

    public enum Orientation {
        case horizontal
        case vertical
    }

    public init(
        orientation: Orientation,
        onDrag: @escaping (DragGesture.Value) -> Void,
        onDragEnd: @escaping (DragGesture.Value) -> Void
    ) {
        self.orientation = orientation
        self.onDrag = onDrag
        self.onDragEnd = onDragEnd
    }

    public var body: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(
                width: orientation == .vertical ? 8 : nil,
                height: orientation == .horizontal ? 8 : nil
            )
            .contentShape(Rectangle())
            .cursor(orientation == .horizontal ? .resizeUpDown : .resizeLeftRight)
            .gesture(
                DragGesture()
                    .onChanged(onDrag)
                    .onEnded(onDragEnd)
            )
    }
}

// MARK: - Cursor modifier extension

extension View {
    /// Apply cursor style for resize handles
    func cursor(_ cursor: NSCursor.CursorType) -> some View {
        #if os(macOS)
        return self.onHover { hovering in
            if hovering {
                cursor.cursor.set()
            } else {
                NSCursor.arrow.set()
            }
        }
        #else
        return self
        #endif
    }
}

#if os(macOS)
extension NSCursor {
    enum CursorType {
        case resizeLeftRight
        case resizeUpDown
        case arrow

        var cursor: NSCursor {
            switch self {
            case .resizeLeftRight:
                return NSCursor.resizeLeftRight
            case .resizeUpDown:
                return NSCursor.resizeUpDown
            case .arrow:
                return NSCursor.arrow
            }
        }
    }
}
#endif

// MARK: - Preview support

#if DEBUG
struct ResizeHandle_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            HStack {
                Rectangle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 100, height: 100)

                ResizeHandle(orientation: .vertical) { _ in
                    print("Dragging")
                } onDragEnd: { _ in
                    print("Drag ended")
                }

                Rectangle()
                    .fill(Color.red.opacity(0.3))
                    .frame(width: 100, height: 100)
            }

            ResizeHandle(orientation: .horizontal) { _ in
                print("Dragging")
            } onDragEnd: { _ in
                print("Drag ended")
            }

            Rectangle()
                .fill(Color.green.opacity(0.3))
                .frame(width: 200, height: 100)
        }
        .padding()
        .previewDisplayName("Resize Handles")
    }
}
#endif