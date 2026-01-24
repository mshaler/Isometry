import SwiftUI

/// SwiftUI implementation of SuperGrid - native equivalent of React SuperGrid
/// Uses Canvas for high-performance rendering of 1000+ cells
public struct SuperGridView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SuperGridViewModel()
    @State private var selectedNode: Node?
    @State private var showingFilters = false

    public init() {}

    public var body: some View {
        GeometryReader { geometry in
            ZStack {
                // z=0: SPARSITY - Canvas rendering (equivalent to D3 SVG)
                GridCanvas(
                    nodes: viewModel.nodes,
                    viewConfig: viewModel.currentConfig,
                    onCellTap: { node in
                        selectedNode = node
                    }
                )
                .clipped()

                // z=1: DENSITY - SwiftUI overlays (equivalent to React controls)
                VStack {
                    HStack {
                        // MiniNav equivalent
                        MiniNavView(
                            viewModel: viewModel,
                            onFiltersToggle: {
                                showingFilters.toggle()
                            }
                        )
                        Spacer()
                    }
                    .padding()

                    Spacer()

                    // Grid headers overlay
                    GridHeadersOverlay(
                        viewConfig: viewModel.currentConfig,
                        size: geometry.size
                    )
                }
                .allowsHitTesting(true)

                // z=2: OVERLAY - Sheets and popovers (equivalent to React Portals)
                if showingFilters {
                    FilterControlsOverlay(
                        isPresented: $showingFilters,
                        viewModel: viewModel
                    )
                }
            }
        }
        .sheet(item: $selectedNode) { node in
            CardDetailView(node: node)
        }
        .task {
            await viewModel.initialize(database: appState.database)
        }
        .navigationTitle("SuperGrid")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Grid Canvas
/// High-performance Canvas rendering for 1000+ cells
/// Equivalent to D3 SVG rendering in React version
struct GridCanvas: View {
    let nodes: [GridCellData]
    let viewConfig: ViewConfig
    let onCellTap: (Node) -> Void

    @State private var transform = CGAffineTransform.identity
    @GestureState private var magnification = 1.0
    @GestureState private var panOffset = CGSize.zero

    var body: some View {
        Canvas { context, size in
            // Apply pan and zoom transform
            let totalTransform = transform
                .scaledBy(x: magnification, y: magnification)
                .translatedBy(x: panOffset.width, y: panOffset.height)

            context.concatenate(totalTransform)

            // Draw grid cells
            drawGridCells(in: context, size: size)

            // Draw grid lines
            drawGridLines(in: context, size: size)
        }
        .gesture(
            SimultaneousGesture(
                // Zoom gesture
                MagnificationGesture()
                    .updating($magnification) { value, state, _ in
                        state = value
                    }
                    .onEnded { value in
                        transform = transform.scaledBy(x: value, y: value)
                    },
                // Pan gesture
                DragGesture()
                    .updating($panOffset) { value, state, _ in
                        state = value.translation
                    }
                    .onEnded { value in
                        transform = transform.translatedBy(
                            x: value.translation.width,
                            y: value.translation.height
                        )
                    }
            )
        )
        .onTapGesture { location in
            // Convert tap location to grid coordinates
            if let node = nodeAt(location: location) {
                onCellTap(node)
            }
        }
    }

    private func drawGridCells(in context: GraphicsContext, size: CGSize) {
        let cellSize = CGSize(width: 120, height: 80)

        for cellData in nodes {
            let rect = CGRect(
                x: cellData.x * cellSize.width,
                y: cellData.y * cellSize.height,
                width: cellSize.width - 2, // 2px gap
                height: cellSize.height - 2
            )

            // Cell background
            context.fill(
                Path(rect),
                with: .color(cellData.node.priority > 0 ? .red.opacity(0.1) : .gray.opacity(0.05))
            )

            // Cell border
            context.stroke(
                Path(rect),
                with: .color(.gray.opacity(0.3)),
                lineWidth: 1
            )

            // Cell text (simplified - in production would use AttributedString)
            let text = Text(cellData.node.name)
                .font(.caption)
                .foregroundColor(.primary)

            context.draw(text, at: CGPoint(x: rect.midX, y: rect.midY))
        }
    }

    private func drawGridLines(in context: GraphicsContext, size: CGSize) {
        // Draw major grid lines every 5 cells
        // Implementation similar to D3 grid in React version
        let majorLineColor = Color.gray.opacity(0.2)
        let minorLineColor = Color.gray.opacity(0.1)

        // Vertical lines
        for x in stride(from: 0, to: size.width, by: 120) {
            let path = Path { p in
                p.move(to: CGPoint(x: x, y: 0))
                p.addLine(to: CGPoint(x: x, y: size.height))
            }
            context.stroke(path, with: .color(minorLineColor), lineWidth: 0.5)
        }

        // Horizontal lines
        for y in stride(from: 0, to: size.height, by: 80) {
            let path = Path { p in
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: size.width, y: y))
            }
            context.stroke(path, with: .color(minorLineColor), lineWidth: 0.5)
        }
    }

    private func nodeAt(location: CGPoint) -> Node? {
        let cellSize = CGSize(width: 120, height: 80)
        let gridX = Int(location.x / cellSize.width)
        let gridY = Int(location.y / cellSize.height)

        return nodes.first { $0.x == gridX && $0.y == gridY }?.node
    }
}

// MARK: - Grid Headers Overlay
/// SwiftUI overlay for column and row headers
/// Equivalent to React header spanning logic
struct GridHeadersOverlay: View {
    let viewConfig: ViewConfig
    let size: CGSize

    var body: some View {
        VStack {
            // Column headers
            HStack {
                ForEach(columnHeaders, id: \.self) { header in
                    Text(header)
                        .font(.caption)
                        .frame(width: 120)
                        .background(Color.gray.opacity(0.1))
                }
            }
            .frame(height: 30)

            HStack {
                // Row headers
                VStack {
                    ForEach(rowHeaders, id: \.self) { header in
                        Text(header)
                            .font(.caption)
                            .frame(height: 80)
                            .background(Color.gray.opacity(0.1))
                    }
                }
                .frame(width: 120)

                Spacer()
            }

            Spacer()
        }
    }

    private var columnHeaders: [String] {
        // Generate headers based on viewConfig.xAxisMapping
        switch viewConfig.xAxisMapping {
        case "time":
            return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        case "category":
            return ["Work", "Personal", "Learning", "Health"]
        case "hierarchy":
            return ["P1", "P2", "P3", "P4"]
        default:
            return ["Col 1", "Col 2", "Col 3", "Col 4"]
        }
    }

    private var rowHeaders: [String] {
        // Generate headers based on viewConfig.yAxisMapping
        switch viewConfig.yAxisMapping {
        case "category":
            return ["Important", "Normal", "Low"]
        case "time":
            return ["Today", "This Week", "Later"]
        case "hierarchy":
            return ["High", "Medium", "Low"]
        default:
            return ["Row 1", "Row 2", "Row 3"]
        }
    }
}

// MARK: - Grid Cell Data
/// Data structure for positioning nodes in the grid
public struct GridCellData: Identifiable {
    public let id = UUID()
    public let node: Node
    public let x: Int // Grid X coordinate
    public let y: Int // Grid Y coordinate

    public init(node: Node, x: Int, y: Int) {
        self.node = node
        self.x = x
        self.y = y
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        SuperGridView()
            .environmentObject(AppState())
    }
}