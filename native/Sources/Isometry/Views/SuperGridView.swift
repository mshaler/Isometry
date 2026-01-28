import SwiftUI
import os.signpost
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// SwiftUI implementation of SuperGrid - native equivalent of React SuperGrid
/// Uses Canvas for high-performance rendering of 1000+ cells with platform optimizations
public struct SuperGridView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SuperGridViewModel()
    @State private var selectedNode: Node?
    @State private var showingFilters = false

    // Performance monitoring
    @State private var renderSignpostID: OSSignpostID?

    // Platform-specific optimization state
    #if os(iOS)
    @Environment(\.scenePhase) private var scenePhase
    @State private var memoryPressureObserver: NSObjectProtocol?
    @State private var isBackgrounded = false
    #endif

    #if os(macOS)
    @State private var windowSize: CGSize = .zero
    @State private var displayScale: CGFloat = 1.0
    #endif

    public init() {}

    public var body: some View {
        GeometryReader { geometry in
            ZStack {
                // z=0: SPARSITY - Canvas rendering (equivalent to D3 SVG)
                OptimizedGridCanvas(
                    nodes: optimizedNodes(for: geometry.size),
                    viewConfig: viewModel.currentConfig,
                    onCellTap: { node in
                        selectedNode = node
                    },
                    platformOptimizations: createPlatformOptimizations()
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
            setupPlatformOptimizations()
        }
        .navigationTitle("SuperGrid")
        #if os(iOS)
        #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
            handleMemoryPressure()
        }
        #elseif os(macOS)
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didChangeScreenNotification)) { _ in
            updateDisplayScale()
        }
        #endif
        .onDisappear {
            cleanup()
        }
    }

    // MARK: - Platform Optimization Methods

    private func createPlatformOptimizations() -> PlatformOptimizations {
        #if os(iOS)
        return PlatformOptimizations(
            memoryConstrained: isMemoryConstrained,
            backgrounded: isBackgrounded,
            batteryOptimized: true
        )
        #elseif os(macOS)
        return PlatformOptimizations(
            highDPI: displayScale > 1.5,
            windowSize: windowSize,
            multiWindow: true
        )
        #endif
    }

    private func optimizedNodes(for size: CGSize) -> [GridCellData] {
        #if os(iOS)
        // iOS: Virtualization for memory constraints
        if isMemoryConstrained || viewModel.nodes.count > 1000 {
            return virtualizedNodes(for: size, maxNodes: 500)
        }
        #elseif os(macOS)
        // macOS: Handle larger datasets but optimize for high DPI
        if displayScale > 2.0 && viewModel.nodes.count > 2000 {
            return virtualizedNodes(for: size, maxNodes: 1500)
        }
        #endif
        return viewModel.nodes
    }

    private func virtualizedNodes(for size: CGSize, maxNodes: Int) -> [GridCellData] {
        // Simple viewport-based virtualization
        let cellSize = CGSize(width: 120, height: 80)
        let visibleColumns = Int(ceil(size.width / cellSize.width)) + 2  // +2 for buffer
        let visibleRows = Int(ceil(size.height / cellSize.height)) + 2

        return viewModel.nodes.filter { cell in
            cell.x >= -1 && cell.x <= visibleColumns &&
            cell.y >= -1 && cell.y <= visibleRows
        }.prefix(maxNodes).map { $0 }
    }

    private var isMemoryConstrained: Bool {
        #if os(iOS)
        let memoryUsage = getMemoryUsage()
        return memoryUsage > 100 * 1024 * 1024 // 100MB threshold
        #else
        return false
        #endif
    }

    #if os(iOS)
    private func getMemoryUsage() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        return kerr == KERN_SUCCESS ? Int64(info.resident_size) : 0
    }
    #endif

    private func setupPlatformOptimizations() {
        #if os(iOS)
        setupiOSOptimizations()
        #elseif os(macOS)
        setupmacOSOptimizations()
        #endif
    }

    #if os(iOS)
    private func setupiOSOptimizations() {
        // Monitor memory pressure
        memoryPressureObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            handleMemoryPressure()
        }
    }

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .background:
            isBackgrounded = true
            // Reduce memory usage when backgrounded
            viewModel.clearNonVisibleCells()
        case .active:
            isBackgrounded = false
            // Restore full functionality
            Task {
                await viewModel.refreshData()
            }
        case .inactive:
            // Prepare for background
            break
        @unknown default:
            break
        }
    }

    private func handleMemoryPressure() {
        // Clear caches and reduce memory footprint
        viewModel.clearCaches()

        // Force garbage collection
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            // Trigger view refresh with reduced dataset
        }
    }
    #endif

    #if os(macOS)
    private func setupmacOSOptimizations() {
        // Get initial display scale
        updateDisplayScale()

        // Monitor window changes
        NotificationCenter.default.addObserver(
            forName: NSWindow.didResizeNotification,
            object: nil,
            queue: .main
        ) { _ in
            updateWindowSize()
        }
    }

    private func updateDisplayScale() {
        if let window = NSApp.keyWindow {
            displayScale = window.backingScaleFactor
        }
    }

    private func updateWindowSize() {
        if let window = NSApp.keyWindow {
            windowSize = window.frame.size
        }
    }
    #endif

    private func cleanup() {
        #if os(iOS)
        if let observer = memoryPressureObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        #endif
    }
}

// MARK: - Platform Optimizations
struct PlatformOptimizations {
    let memoryConstrained: Bool
    let backgrounded: Bool
    let batteryOptimized: Bool
    let highDPI: Bool
    let windowSize: CGSize
    let multiWindow: Bool

    #if os(iOS)
    init(memoryConstrained: Bool, backgrounded: Bool, batteryOptimized: Bool) {
        self.memoryConstrained = memoryConstrained
        self.backgrounded = backgrounded
        self.batteryOptimized = batteryOptimized
        self.highDPI = false
        self.windowSize = .zero
        self.multiWindow = false
    }
    #elseif os(macOS)
    init(highDPI: Bool, windowSize: CGSize, multiWindow: Bool) {
        self.memoryConstrained = false
        self.backgrounded = false
        self.batteryOptimized = false
        self.highDPI = highDPI
        self.windowSize = windowSize
        self.multiWindow = multiWindow
    }
    #endif
}

// MARK: - Optimized Grid Canvas
/// High-performance Canvas rendering for 1000+ cells with platform-specific optimizations
/// Equivalent to D3 SVG rendering in React version
struct OptimizedGridCanvas: View {
    let nodes: [GridCellData]
    let viewConfig: ViewConfig
    let onCellTap: (Node) -> Void
    let platformOptimizations: PlatformOptimizations

    @State private var transform = CGAffineTransform.identity
    @GestureState private var magnification = 1.0
    @GestureState private var panOffset = CGSize.zero

    // Platform-specific rendering optimization
    @State private var renderQuality: RenderQuality = .full
    @State private var lastRenderTime: Date = Date()

    var body: some View {
        Canvas { context, size in
            // Start performance measurement
            let renderID = PerformanceMonitor.shared.startGridRender()
            defer { PerformanceMonitor.shared.endGridRender(renderID) }

            updateRenderQuality()

            // Apply pan and zoom transform
            let totalTransform = transform
                .scaledBy(x: magnification, y: magnification)
                .translatedBy(x: panOffset.width, y: panOffset.height)

            context.concatenate(totalTransform)

            // Platform-optimized rendering
            #if os(iOS)
            if platformOptimizations.memoryConstrained {
                drawOptimizedCells(in: context, size: size)
            } else {
                drawGridCells(in: context, size: size)
            }

            if !platformOptimizations.batteryOptimized || renderQuality == .full {
                drawGridLines(in: context, size: size)
            }
            #elseif os(macOS)
            drawGridCells(in: context, size: size)

            if platformOptimizations.highDPI {
                drawHighDPIGridLines(in: context, size: size)
            } else {
                drawGridLines(in: context, size: size)
            }
            #endif
        }
        .gesture(platformSpecificGestures())
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
                x: CGFloat(cellData.x) * cellSize.width,
                y: CGFloat(cellData.y) * cellSize.height,
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
        for (index, x) in stride(from: 0, to: size.width, by: 120).enumerated() {
            let isMajor = index % 5 == 0
            let color = isMajor ? majorLineColor : minorLineColor
            let lineWidth: CGFloat = isMajor ? 1.0 : 0.5

            let path = Path { p in
                p.move(to: CGPoint(x: x, y: 0))
                p.addLine(to: CGPoint(x: x, y: size.height))
            }
            context.stroke(path, with: .color(color), lineWidth: lineWidth)
        }

        // Horizontal lines
        for (index, y) in stride(from: 0, to: size.height, by: 80).enumerated() {
            let isMajor = index % 5 == 0
            let color = isMajor ? majorLineColor : minorLineColor
            let lineWidth: CGFloat = isMajor ? 1.0 : 0.5

            let path = Path { p in
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: size.width, y: y))
            }
            context.stroke(path, with: .color(color), lineWidth: lineWidth)
        }
    }

    private func nodeAt(location: CGPoint) -> Node? {
        let cellSize = CGSize(width: 120, height: 80)
        let gridX = Int(location.x / cellSize.width)
        let gridY = Int(location.y / cellSize.height)

        return nodes.first { $0.x == gridX && $0.y == gridY }?.node
    }

    // MARK: - Platform-Specific Rendering

    private func updateRenderQuality() {
        let currentTime = Date()
        let timeSinceLastRender = currentTime.timeIntervalSince(lastRenderTime)

        #if os(iOS)
        if platformOptimizations.batteryOptimized && timeSinceLastRender < 0.016 {
            renderQuality = .reduced
        } else {
            renderQuality = .full
        }
        #elseif os(macOS)
        renderQuality = platformOptimizations.highDPI ? .enhanced : .full
        #endif

        lastRenderTime = currentTime
    }

    #if os(iOS)
    private func drawOptimizedCells(in context: GraphicsContext, size: CGSize) {
        let cellSize = CGSize(width: 120, height: 80)

        // Draw only high-priority cells when memory constrained
        let priorityCells = nodes.filter { $0.node.priority > 1 }

        for cellData in priorityCells {
            let rect = CGRect(
                x: CGFloat(cellData.x) * cellSize.width,
                y: CGFloat(cellData.y) * cellSize.height,
                width: cellSize.width - 2,
                height: cellSize.height - 2
            )

            // Simplified rendering for memory efficiency
            context.fill(
                Path(rect),
                with: .color(.gray.opacity(0.1))
            )

            // Skip text rendering in memory-constrained mode
        }
    }
    #endif

    #if os(macOS)
    private func drawHighDPIGridLines(in context: GraphicsContext, size: CGSize) {
        let lineWidth: CGFloat = platformOptimizations.highDPI ? 0.5 : 1.0
        let majorLineColor = Color.gray.opacity(0.3)
        let minorLineColor = Color.gray.opacity(0.15)

        // Enhanced grid for high DPI displays
        for x in stride(from: 0, to: size.width, by: 120) {
            let path = Path { p in
                p.move(to: CGPoint(x: x, y: 0))
                p.addLine(to: CGPoint(x: x, y: size.height))
            }
            let isMainLine = Int(x) % 600 == 0
            context.stroke(
                path,
                with: .color(isMainLine ? majorLineColor : minorLineColor),
                lineWidth: isMainLine ? lineWidth * 2 : lineWidth
            )
        }

        for y in stride(from: 0, to: size.height, by: 80) {
            let path = Path { p in
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: size.width, y: y))
            }
            let isMainLine = Int(y) % 400 == 0
            context.stroke(
                path,
                with: .color(isMainLine ? majorLineColor : minorLineColor),
                lineWidth: isMainLine ? lineWidth * 2 : lineWidth
            )
        }
    }
    #endif

    // MARK: - Platform-Specific Gestures

    private func platformSpecificGestures() -> some Gesture {
        #if os(iOS)
        return iOSOptimizedGestures()
        #elseif os(macOS)
        return macOSOptimizedGestures()
        #endif
    }

    #if os(iOS)
    private func iOSOptimizedGestures() -> some Gesture {
        SimultaneousGesture(
            // Optimized zoom gesture for touch
            MagnificationGesture(minimumScaleDelta: 0.01)
                .updating($magnification) { value, state, transaction in
                    state = value
                    transaction.disablesAnimations = platformOptimizations.batteryOptimized
                }
                .onEnded { value in
                    withAnimation(platformOptimizations.batteryOptimized ? .none : .easeOut(duration: 0.2)) {
                        let constrainedValue = max(0.1, min(value, 10.0))
                        transform = transform.scaledBy(x: constrainedValue, y: constrainedValue)
                    }
                },

            // Touch-optimized pan gesture
            DragGesture(minimumDistance: 1.0)
                .updating($panOffset) { value, state, transaction in
                    state = value.translation
                    transaction.disablesAnimations = platformOptimizations.memoryConstrained
                }
                .onEnded { value in
                    withAnimation(platformOptimizations.batteryOptimized ? .none : .easeOut(duration: 0.15)) {
                        transform = transform.translatedBy(
                            x: value.translation.width,
                            y: value.translation.height
                        )
                    }
                }
        )
    }
    #endif

    #if os(macOS)
    private func macOSOptimizedGestures() -> some Gesture {
        SimultaneousGesture(
            // Trackpad-optimized zoom with momentum
            MagnificationGesture(minimumScaleDelta: 0.001)
                .updating($magnification) { value, state, _ in
                    state = value
                }
                .onEnded { value in
                    withAnimation(.easeOut(duration: 0.3)) {
                        let constrainedValue = max(0.1, min(value, 20.0))
                        transform = transform.scaledBy(x: constrainedValue, y: constrainedValue)
                    }
                },

            // Trackpad momentum scrolling
            DragGesture(minimumDistance: 0.5)
                .updating($panOffset) { value, state, _ in
                    state = CGSize(
                        width: value.translation.width * 1.2, // Amplify for trackpad feel
                        height: value.translation.height * 1.2
                    )
                }
                .onEnded { value in
                    let momentum = CGSize(
                        width: value.predictedEndLocation.x - value.location.x,
                        height: value.predictedEndLocation.y - value.location.y
                    )

                    withAnimation(.easeOut(duration: 0.4)) {
                        transform = transform.translatedBy(
                            x: value.translation.width + momentum.width * 0.3,
                            y: value.translation.height + momentum.height * 0.3
                        )
                    }
                }
        )
    }
    #endif
}

// MARK: - Render Quality Enum
// Using RenderQuality from VisualizationCanvas.swift

// MARK: - Grid Headers Overlay
/// SwiftUI overlay for column and row headers with header spanning support
/// Enhanced with signature SuperGrid header spanning functionality
struct GridHeadersOverlay: View {
    let viewConfig: ViewConfig
    let size: CGSize

    // Header spanning configuration
    private let cellSize: CGFloat = 120
    private let headerHeight: CGFloat = 30
    private let headerWidth: CGFloat = 120

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Column headers with spanning
            columnHeadersView
                .frame(height: headerHeight)

            HStack(alignment: .top, spacing: 0) {
                // Row headers with spanning
                rowHeadersView
                    .frame(width: headerWidth)

                Spacer()
            }

            Spacer()
        }
    }

    private var columnHeadersView: some View {
        HStack(spacing: 0) {
            // Skip space for row headers
            Rectangle()
                .fill(Color.clear)
                .frame(width: headerWidth)

            // Column header spans
            HeaderSpanOverlay(
                spans: columnHeaderSpans,
                orientation: .horizontal,
                cellSize: cellSize
            ) { index in
                CGFloat(index) * cellSize
            }
            .frame(height: headerHeight)
        }
    }

    private var rowHeadersView: some View {
        VStack(spacing: 0) {
            // Skip space for column headers
            Rectangle()
                .fill(Color.clear)
                .frame(height: headerHeight)

            // Row header spans
            HeaderSpanOverlay(
                spans: rowHeaderSpans,
                orientation: .vertical,
                cellSize: 80 // Row height
            ) { index in
                CGFloat(index) * 80
            }
        }
    }

    // Generate column header spans based on current configuration
    private var columnHeaderSpans: [HeaderSpan] {
        let combinations = generateColumnCombinations()
        let dimensions = generateColumnDimensions()
        return HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )
    }

    // Generate row header spans based on current configuration
    private var rowHeaderSpans: [HeaderSpan] {
        let combinations = generateRowCombinations()
        let dimensions = generateRowDimensions()
        return HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )
    }

    private func generateColumnCombinations() -> [[String]] {
        // Generate header combinations based on viewConfig.xAxisMapping
        switch viewConfig.xAxisMapping {
        case "time":
            return [
                ["2024", "Q1", "Jan"],
                ["2024", "Q1", "Feb"],
                ["2024", "Q1", "Mar"],
                ["2024", "Q2", "Apr"],
                ["2024", "Q2", "May"],
                ["2024", "Q2", "Jun"]
            ]
        case "category":
            return [
                ["Work", "Projects"],
                ["Work", "Meetings"],
                ["Personal", "Health"],
                ["Personal", "Learning"]
            ]
        case "hierarchy":
            return [
                ["High", "P1"],
                ["High", "P2"],
                ["Medium", "P3"],
                ["Low", "P4"]
            ]
        default:
            return [["Col1"], ["Col2"], ["Col3"], ["Col4"]]
        }
    }

    private func generateRowCombinations() -> [[String]] {
        // Generate header combinations based on viewConfig.yAxisMapping
        switch viewConfig.yAxisMapping {
        case "category":
            return [
                ["Important", "Urgent"],
                ["Important", "Normal"],
                ["Normal", "Low"]
            ]
        case "time":
            return [
                ["This Week", "Today"],
                ["This Week", "Tomorrow"],
                ["Next Week", "Monday"],
                ["Next Week", "Tuesday"]
            ]
        case "hierarchy":
            return [
                ["Critical", "High"],
                ["Important", "Medium"],
                ["Nice to Have", "Low"]
            ]
        default:
            return [["Row1"], ["Row2"], ["Row3"]]
        }
    }

    private func generateColumnDimensions() -> [GridDimension] {
        switch viewConfig.xAxisMapping {
        case "time":
            return [
                GridDimension(id: "year", name: "Year", type: .time),
                GridDimension(id: "quarter", name: "Quarter", type: .time),
                GridDimension(id: "month", name: "Month", type: .time)
            ]
        case "category":
            return [
                GridDimension(id: "area", name: "Area", type: .category),
                GridDimension(id: "type", name: "Type", type: .category)
            ]
        case "hierarchy":
            return [
                GridDimension(id: "importance", name: "Importance", type: .hierarchy),
                GridDimension(id: "priority", name: "Priority", type: .hierarchy)
            ]
        default:
            return [GridDimension(id: "column", name: "Column", type: .category)]
        }
    }

    private func generateRowDimensions() -> [GridDimension] {
        switch viewConfig.yAxisMapping {
        case "category":
            return [
                GridDimension(id: "importance", name: "Importance", type: .category),
                GridDimension(id: "urgency", name: "Urgency", type: .category)
            ]
        case "time":
            return [
                GridDimension(id: "timeframe", name: "Timeframe", type: .time),
                GridDimension(id: "day", name: "Day", type: .time)
            ]
        case "hierarchy":
            return [
                GridDimension(id: "criticality", name: "Criticality", type: .hierarchy),
                GridDimension(id: "level", name: "Level", type: .hierarchy)
            ]
        default:
            return [GridDimension(id: "row", name: "Row", type: .category)]
        }
    }

}

// MARK: - Grid Cell Data
/// Data structure for positioning nodes in the grid
/// Uses node.id for stable identity to enable efficient SwiftUI diffing
public struct GridCellData: Identifiable, Hashable {
    /// Use node's ID for stable identity across updates
    /// This enables SwiftUI to efficiently diff and animate changes
    public var id: String { node.id }
    public let node: Node
    public let x: Int // Grid X coordinate
    public let y: Int // Grid Y coordinate

    public init(node: Node, x: Int, y: Int) {
        self.node = node
        self.x = x
        self.y = y
    }

    public static func == (lhs: GridCellData, rhs: GridCellData) -> Bool {
        lhs.node.id == rhs.node.id && lhs.x == rhs.x && lhs.y == rhs.y
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(node.id)
        hasher.combine(x)
        hasher.combine(y)
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        SuperGridView()
            .environmentObject(AppState())
    }
}

// MARK: - Accessibility Identifiers
extension SuperGridView {
    enum AccessibilityID {
        static let gridCanvas = "supergrid.canvas"
        static let miniNav = "supergrid.mininav"
        static let filterOverlay = "supergrid.filters"
        static let gridHeaders = "supergrid.headers"
    }
}

extension OptimizedGridCanvas {
    enum AccessibilityID {
        static let canvas = "grid.canvas.main"
        static let cellPrefix = "grid.cell." // Append node.id
    }
}

extension GridHeadersOverlay {
    enum AccessibilityID {
        static let columnHeaders = "grid.headers.columns"
        static let rowHeaders = "grid.headers.rows"
    }
}