import SwiftUI
import UniformTypeIdentifiers
#if os(iOS)
import UIKit
#endif

/// Axis selection configuration for PAFV (Planes, Axes, Facets, Values)
public struct AxisSelection: Identifiable, Hashable, Codable {
    public let id: String
    public let name: String
    public let type: AxisType
    public let plane: PlaneType
    public let values: [String]?
    public let description: String?

    public enum AxisType: String, Codable, CaseIterable {
        case location = "L"    // LATCH: Location
        case alphabet = "A"    // LATCH: Alphabet
        case time = "T"        // LATCH: Time
        case category = "C"    // LATCH: Category
        case hierarchy = "H"   // LATCH: Hierarchy
    }

    public enum PlaneType: String, Codable, CaseIterable {
        case x = "x"           // Columns
        case y = "y"           // Rows
        case z = "z"           // Layers/Filters
        case available = "available" // Unassigned
    }

    public init(
        id: String,
        name: String,
        type: AxisType,
        plane: PlaneType,
        values: [String]? = nil,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.plane = plane
        self.values = values
        self.description = description
    }
}

/// Axis Navigator for SuperGrid PAFV configuration
/// Provides drag-and-drop interface for assigning axes to planes
@MainActor
public final class AxisNavigatorViewModel: ObservableObject {
    @Published public var rowAxes: [AxisSelection] = []
    @Published public var columnAxes: [AxisSelection] = []
    @Published public var filterAxes: [AxisSelection] = []
    @Published public var availableAxes: [AxisSelection] = []

    // Drag state
    @Published public var draggedAxis: AxisSelection?
    @Published public var dragOverPlane: AxisSelection.PlaneType?

    // Callbacks
    public var onAxisAssign: ((AxisSelection, AxisSelection.PlaneType) -> Void)?
    public var onAxisRemove: ((String) -> Void)?
    public var onAxisReorder: ((String, Int, AxisSelection.PlaneType) -> Void)?

    public init() {
        loadDefaultAxes()
    }

    // MARK: - Axis Management

    public func assignAxis(_ axis: AxisSelection, to plane: AxisSelection.PlaneType) {
        // Remove from current plane
        removeAxisFromAllPlanes(axis.id)

        // Add to new plane
        var updatedAxis = axis
        updatedAxis = AxisSelection(
            id: axis.id,
            name: axis.name,
            type: axis.type,
            plane: plane,
            values: axis.values,
            description: axis.description
        )

        switch plane {
        case .x:
            columnAxes.append(updatedAxis)
        case .y:
            rowAxes.append(updatedAxis)
        case .z:
            filterAxes.append(updatedAxis)
        case .available:
            availableAxes.append(updatedAxis)
        }

        onAxisAssign?(updatedAxis, plane)
    }

    public func removeAxis(_ axisId: String) {
        removeAxisFromAllPlanes(axisId)
        onAxisRemove?(axisId)
    }

    public func reorderAxis(_ axisId: String, to newIndex: Int, in plane: AxisSelection.PlaneType) {
        switch plane {
        case .x:
            if let currentIndex = columnAxes.firstIndex(where: { $0.id == axisId }) {
                let axis = columnAxes.remove(at: currentIndex)
                columnAxes.insert(axis, at: min(newIndex, columnAxes.count))
            }
        case .y:
            if let currentIndex = rowAxes.firstIndex(where: { $0.id == axisId }) {
                let axis = rowAxes.remove(at: currentIndex)
                rowAxes.insert(axis, at: min(newIndex, rowAxes.count))
            }
        case .z:
            if let currentIndex = filterAxes.firstIndex(where: { $0.id == axisId }) {
                let axis = filterAxes.remove(at: currentIndex)
                filterAxes.insert(axis, at: min(newIndex, filterAxes.count))
            }
        case .available:
            if let currentIndex = availableAxes.firstIndex(where: { $0.id == axisId }) {
                let axis = availableAxes.remove(at: currentIndex)
                availableAxes.insert(axis, at: min(newIndex, availableAxes.count))
            }
        }

        onAxisReorder?(axisId, newIndex, plane)
    }

    // MARK: - Drag Handling

    public func startDrag(_ axis: AxisSelection) {
        draggedAxis = axis
    }

    public func dragOver(_ plane: AxisSelection.PlaneType?) {
        dragOverPlane = plane
    }

    public func endDrag(in plane: AxisSelection.PlaneType?) {
        guard let draggedAxis = draggedAxis else { return }

        if let targetPlane = plane, targetPlane != draggedAxis.plane {
            assignAxis(draggedAxis, to: targetPlane)
        }

        // Reset drag state
        self.draggedAxis = nil
        self.dragOverPlane = nil
    }

    // MARK: - Private Helpers

    private func removeAxisFromAllPlanes(_ axisId: String) {
        rowAxes.removeAll { $0.id == axisId }
        columnAxes.removeAll { $0.id == axisId }
        filterAxes.removeAll { $0.id == axisId }
        availableAxes.removeAll { $0.id == axisId }
    }

    public func loadDefaultAxes() {
        availableAxes = [
            AxisSelection(
                id: "folder",
                name: "Folder",
                type: .category,
                plane: .available,
                values: ["Work", "Personal", "Projects", "Archive"],
                description: "Note folder categories"
            ),
            AxisSelection(
                id: "modified_time",
                name: "Modified Time",
                type: .time,
                plane: .available,
                values: ["Today", "This Week", "This Month", "Older"],
                description: "When the note was last modified"
            ),
            AxisSelection(
                id: "priority",
                name: "Priority",
                type: .hierarchy,
                plane: .available,
                values: ["High", "Medium", "Low", "None"],
                description: "Note importance level"
            ),
            AxisSelection(
                id: "tags",
                name: "Tags",
                type: .category,
                plane: .available,
                values: ["urgent", "important", "project", "idea", "meeting"],
                description: "Note tags and labels"
            ),
            AxisSelection(
                id: "word_count",
                name: "Word Count",
                type: .hierarchy,
                plane: .available,
                values: ["Short (<100)", "Medium (100-500)", "Long (>500)"],
                description: "Note length category"
            ),
            AxisSelection(
                id: "first_letter",
                name: "First Letter",
                type: .alphabet,
                plane: .available,
                values: Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(String.init),
                description: "Alphabetical grouping by first letter"
            )
        ]
    }
}

/// Drop zone component for axis assignment
public struct AxisDropZone: View {
    let title: String
    let plane: AxisSelection.PlaneType
    let axes: [AxisSelection]
    let isDropTarget: Bool
    let onDrop: (AxisSelection, AxisSelection.PlaneType) -> Bool

    public init(
        title: String,
        plane: AxisSelection.PlaneType,
        axes: [AxisSelection],
        isDropTarget: Bool,
        onDrop: @escaping (AxisSelection, AxisSelection.PlaneType) -> Bool
    ) {
        self.title = title
        self.plane = plane
        self.axes = axes
        self.isDropTarget = isDropTarget
        self.onDrop = onDrop
    }

    private var backgroundView: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill({
                #if os(iOS)
                Color(UIColor.systemGray6)
                #else
                Color(NSColor.controlBackgroundColor)
                #endif
            }())
            .stroke(
                isDropTarget ? Color.accentColor : Color.gray.opacity(0.3),
                lineWidth: 1
            )
    }

    private var headerView: some View {
        HStack {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            Spacer()

            Text("\(axes.count)")
                .font(.caption2)
                .foregroundColor(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.gray.opacity(0.2))
                .clipShape(Capsule())
        }
    }

    private var axisGridView: some View {
        LazyVGrid(columns: [
            GridItem(.adaptive(minimum: 80, maximum: 120), spacing: 4)
        ], spacing: 4) {
            ForEach(axes) { axis in
                AxisChipView(axis: axis)
            }
        }
    }

    @ViewBuilder
    private var dropTargetView: some View {
        if axes.isEmpty {
            Text("Drop axes here")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.gray.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [3]))
                )
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            headerView
            axisGridView
            dropTargetView
        }
        .padding(12)
        .background(backgroundView)
        .dropDestination(for: AxisSelection.self) { droppedAxes, location in
            guard let axis = droppedAxes.first else { return false }
            return onDrop(axis, plane)
        }
        .accessibilityLabel("\(title) drop zone")
        .accessibilityValue("\(axes.count) axes assigned")
    }
}

/// Individual axis chip view
public struct AxisChipView: View {
    let axis: AxisSelection
    @State private var isDragging = false

    public init(axis: AxisSelection) {
        self.axis = axis
    }

    public var body: some View {
        HStack(spacing: 4) {
            // Axis type indicator
            Circle()
                .fill(colorForAxisType(axis.type))
                .frame(width: 8, height: 8)

            // Axis name
            Text(axis.name)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)

            // Value count
            if let values = axis.values {
                Text("(\(values.count))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.white)
                .stroke(Color.gray.opacity(0.4), lineWidth: 0.5)
        )
        .opacity(isDragging ? 0.5 : 1.0)
        .scaleEffect(isDragging ? 0.95 : 1.0)
        .draggable(axis) {
            // Drag preview
            Text(axis.name)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .onDrag {
            isDragging = true
            return NSItemProvider(object: axis.name as NSString)
        } preview: {
            Text(axis.name)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .accessibilityLabel("Axis: \(axis.name)")
        .accessibilityHint("Drag to assign to a different plane")
    }

    private func colorForAxisType(_ type: AxisSelection.AxisType) -> Color {
        switch type {
        case .location:
            return .green
        case .alphabet:
            return .blue
        case .time:
            return .orange
        case .category:
            return .purple
        case .hierarchy:
            return .red
        }
    }
}

/// Main Axis Navigator view
public struct AxisNavigatorView: View {
    @StateObject private var viewModel = AxisNavigatorViewModel()

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Text("Axis Navigator")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                Button("Reset") {
                    viewModel.loadDefaultAxes()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            // Drop zones
            HStack(spacing: 12) {
                AxisDropZone(
                    title: "Rows (Y)",
                    plane: .y,
                    axes: viewModel.rowAxes,
                    isDropTarget: viewModel.dragOverPlane == .y
                ) { axis, plane in
                    viewModel.assignAxis(axis, to: plane)
                    return true
                }

                AxisDropZone(
                    title: "Columns (X)",
                    plane: .x,
                    axes: viewModel.columnAxes,
                    isDropTarget: viewModel.dragOverPlane == .x
                ) { axis, plane in
                    viewModel.assignAxis(axis, to: plane)
                    return true
                }

                AxisDropZone(
                    title: "Filters (Z)",
                    plane: .z,
                    axes: viewModel.filterAxes,
                    isDropTarget: viewModel.dragOverPlane == .z
                ) { axis, plane in
                    viewModel.assignAxis(axis, to: plane)
                    return true
                }
            }

            // Available axes
            AxisDropZone(
                title: "Available Axes",
                plane: .available,
                axes: viewModel.availableAxes,
                isDropTarget: viewModel.dragOverPlane == .available
            ) { axis, plane in
                viewModel.assignAxis(axis, to: plane)
                return true
            }
        }
        .padding()
        .background({
            #if os(iOS)
            Color(UIColor.systemBackground)
            #else
            Color(NSColor.windowBackgroundColor)
            #endif
        }())
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - AxisSelection Transferable Conformance

extension AxisSelection: Transferable {
    public static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .axisSelection)
    }
}

extension UTType {
    static let axisSelection = UTType(exportedAs: "com.isometry.axis-selection")
}

// MARK: - Preview Support

#if DEBUG
struct AxisNavigatorView_Previews: PreviewProvider {
    static var previews: some View {
        AxisNavigatorView()
            .frame(width: 600, height: 400)
            .previewDisplayName("Axis Navigator")
    }
}
#endif