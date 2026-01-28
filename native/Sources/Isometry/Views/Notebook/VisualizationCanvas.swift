import SwiftUI
import os.signpost
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Native Canvas visualization component for notebook data using SuperGrid patterns
/// Provides high-performance rendering of notebook cards as connected nodes and edges
/// Targets 60fps performance with platform-specific optimizations
public struct VisualizationCanvas: View {
    @StateObject private var dataAdapter: CanvasDataAdapter
    @State private var selectedCard: VisualizationNotebookCard?
    @State private var showingCardDetail = false

    // Performance monitoring
    @State private var renderSignpostID: OSSignpostID?
    @State private var lastFrameTime: TimeInterval = 0
    @State private var currentFPS: Double = 60.0

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

    // Gesture and interaction state
    @State private var transform = CGAffineTransform.identity
    @GestureState private var magnification = 1.0
    @GestureState private var panOffset = CGSize.zero
    @State private var renderQuality: RenderQuality = .full

    // Visualization type and configuration
    @State private var visualizationType: VisualizationType = .network
    @State private var animationEnabled = true
    @State private var showDebugInfo = false

    public init(database: IsometryDatabase) {
        self._dataAdapter = StateObject(wrappedValue: CanvasDataAdapter(database: database))
    }

    public var body: some View {
        GeometryReader { geometry in
            ZStack {
                // z=0: CANVAS - High-performance rendering (equivalent to D3 SVG)
                Canvas { context, size in
                    // Start performance measurement
                    let renderID = PerformanceMonitor.shared.startNotebookRender()
                    let frameStart = CACurrentMediaTime()
                    defer {
                        PerformanceMonitor.shared.endNotebookRender(renderID, layoutType: visualizationType.rawValue)
                        updateFrameRate(frameStart)
                    }

                    updateRenderQuality()

                    // Apply pan and zoom transform
                    let totalTransform = transform
                        .scaledBy(x: magnification, y: magnification)
                        .translatedBy(x: panOffset.width, y: panOffset.height)

                    context.concatenate(totalTransform)

                    // Platform-optimized rendering based on visualization type
                    switch visualizationType {
                    case .network:
                        drawNetworkVisualization(in: context, size: size)
                    case .timeline:
                        drawTimelineVisualization(in: context, size: size)
                    case .hierarchy:
                        drawHierarchyVisualization(in: context, size: size)
                    case .grid:
                        drawGridVisualization(in: context, size: size)
                    }

                    if showDebugInfo {
                        drawDebugOverlay(in: context, size: size)
                    }
                }
                .clipped()
                .gesture(createGestureHandler())
                .onTapGesture { location in
                    handleCanvasTap(at: location, in: geometry.size)
                }

                // z=1: CONTROLS - SwiftUI overlays
                VStack {
                    HStack {
                        VisualizationControls(
                            visualizationType: $visualizationType,
                            animationEnabled: $animationEnabled,
                            showDebugInfo: $showDebugInfo,
                            onFitToContent: fitToContent,
                            onExport: exportVisualization
                        )
                        Spacer()
                        if showDebugInfo {
                            PerformanceIndicator(fps: currentFPS, renderQuality: renderQuality)
                        }
                    }
                    .padding()

                    Spacer()
                }
            }
        }
        .sheet(item: $selectedCard) { card in
            VisualizationCardDetailView(card: card)
        }
        .task {
            await dataAdapter.initialize()
            setupPlatformOptimizations()
        }
        #if os(iOS)
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

    // MARK: - Visualization Rendering

    private func drawNetworkVisualization(in context: GraphicsContext, size: CGSize) {
        guard let visualizationData = dataAdapter.networkData else { return }

        #if os(iOS)
        if isMemoryConstrained {
            drawOptimizedNetwork(in: context, size: size, data: visualizationData)
            return
        }
        #endif

        // Draw edges first (behind nodes)
        drawNetworkEdges(in: context, edges: visualizationData.edges)

        // Draw nodes
        drawNetworkNodes(in: context, nodes: visualizationData.nodes)

        // Draw labels if zoom level is appropriate
        if transform.a > 0.5 { // Only draw labels when zoomed in enough
            drawNodeLabels(in: context, nodes: visualizationData.nodes)
        }
    }

    private func drawNetworkEdges(in context: GraphicsContext, edges: [NetworkEdge]) {
        for edge in edges {
            let path = Path { p in
                p.move(to: edge.startPoint)

                if animationEnabled && edge.isAnimated {
                    // Curved edge for visual appeal
                    let controlPoint = CGPoint(
                        x: (edge.startPoint.x + edge.endPoint.x) / 2,
                        y: min(edge.startPoint.y, edge.endPoint.y) - 20
                    )
                    p.addQuadCurve(to: edge.endPoint, control: controlPoint)
                } else {
                    p.addLine(to: edge.endPoint)
                }
            }

            let strokeColor = edgeColor(for: edge)
            let strokeWidth = edgeWidth(for: edge)

            context.stroke(path, with: .color(strokeColor), lineWidth: strokeWidth)
        }
    }

    private func drawNetworkNodes(in context: GraphicsContext, nodes: [NetworkNode]) {
        for node in nodes {
            let rect = CGRect(
                x: node.position.x - node.radius,
                y: node.position.y - node.radius,
                width: node.radius * 2,
                height: node.radius * 2
            )

            // Node background
            let nodePath = Path(ellipseIn: rect)
            let nodeColor = nodeColor(for: node)
            context.fill(nodePath, with: .color(nodeColor))

            // Node border
            let borderColor = node.isSelected ? Color.blue : Color.gray.opacity(0.5)
            context.stroke(nodePath, with: .color(borderColor), lineWidth: node.isSelected ? 2.0 : 1.0)

            // Priority indicator for high-priority cards
            if node.priority > 1 {
                let indicatorRect = CGRect(
                    x: node.position.x + node.radius - 6,
                    y: node.position.y - node.radius,
                    width: 12,
                    height: 12
                )
                context.fill(Path(ellipseIn: indicatorRect), with: .color(.red))
            }
        }
    }

    private func drawTimelineVisualization(in context: GraphicsContext, size: CGSize) {
        guard let timelineData = dataAdapter.timelineData else { return }

        // Draw timeline axis
        drawTimelineAxis(in: context, size: size, timeRange: timelineData.timeRange)

        // Draw events
        for event in timelineData.events {
            drawTimelineEvent(in: context, event: event, timeRange: timelineData.timeRange, canvasSize: size)
        }
    }

    private func drawHierarchyVisualization(in context: GraphicsContext, size: CGSize) {
        guard let hierarchyData = dataAdapter.hierarchyData else { return }

        // Draw hierarchy tree structure
        for connection in hierarchyData.connections {
            let path = Path { p in
                p.move(to: connection.parentPosition)
                p.addLine(to: connection.childPosition)
            }
            context.stroke(path, with: .color(.gray), lineWidth: 1.0)
        }

        // Draw hierarchy nodes
        for node in hierarchyData.nodes {
            let rect = CGRect(
                x: node.position.x - 40,
                y: node.position.y - 15,
                width: 80,
                height: 30
            )

            let nodePath = Path(roundedRect: rect, cornerRadius: 5)
            context.fill(nodePath, with: .color(nodeColor(for: node)))
            context.stroke(nodePath, with: .color(.gray), lineWidth: 1.0)
        }
    }

    private func drawGridVisualization(in context: GraphicsContext, size: CGSize) {
        guard let gridData = dataAdapter.gridData else { return }

        // Use existing SuperGrid drawing patterns
        let cellSize = CGSize(width: 120, height: 80)

        // Draw grid background
        drawGridLines(in: context, size: size, cellSize: cellSize)

        // Draw grid cells
        for cellData in gridData.cells {
            let rect = CGRect(
                x: CGFloat(cellData.gridX) * cellSize.width,
                y: CGFloat(cellData.gridY) * cellSize.height,
                width: cellSize.width - 2,
                height: cellSize.height - 2
            )

            // Cell background based on card properties
            let cellColor = cellData.card.priority > 1 ? Color.red.opacity(0.1) : Color.gray.opacity(0.05)
            context.fill(Path(rect), with: .color(cellColor))

            // Cell border
            context.stroke(Path(rect), with: .color(.gray.opacity(0.3)), lineWidth: 1.0)

            // Card title (simplified for performance)
            if transform.a > 0.7 {
                let text = Text(cellData.card.title)
                    .font(.caption)
                    .foregroundColor(.primary)
                context.draw(text, at: CGPoint(x: rect.midX, y: rect.midY))
            }
        }
    }

    // MARK: - Helper Drawing Methods

    private func drawGridLines(in context: GraphicsContext, size: CGSize, cellSize: CGSize) {
        let majorLineColor = Color.gray.opacity(0.2)
        let minorLineColor = Color.gray.opacity(0.1)

        // Vertical lines
        for (index, x) in stride(from: 0, to: size.width, by: cellSize.width).enumerated() {
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
        for (index, y) in stride(from: 0, to: size.height, by: cellSize.height).enumerated() {
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

    private func drawTimelineAxis(in context: GraphicsContext, size: CGSize, timeRange: ClosedRange<Date>) {
        let axisY = size.height - 50
        let axisPath = Path { p in
            p.move(to: CGPoint(x: 20, y: axisY))
            p.addLine(to: CGPoint(x: size.width - 20, y: axisY))
        }
        context.stroke(axisPath, with: .color(.primary), lineWidth: 2.0)

        // Time markers
        let timeInterval = timeRange.upperBound.timeIntervalSince(timeRange.lowerBound)
        let markerCount = min(10, max(3, Int(size.width / 100)))

        for i in 0..<markerCount {
            let ratio = CGFloat(i) / CGFloat(markerCount - 1)
            let x = 20 + ratio * (size.width - 40)
            let tickPath = Path { p in
                p.move(to: CGPoint(x: x, y: axisY - 5))
                p.addLine(to: CGPoint(x: x, y: axisY + 5))
            }
            context.stroke(tickPath, with: .color(.primary), lineWidth: 1.0)
        }
    }

    private func drawTimelineEvent(in context: GraphicsContext, event: TimelineEvent, timeRange: ClosedRange<Date>, canvasSize: CGSize) {
        let timeRatio = event.timestamp.timeIntervalSince(timeRange.lowerBound) / timeRange.upperBound.timeIntervalSince(timeRange.lowerBound)
        let x = 20 + CGFloat(timeRatio) * (canvasSize.width - 40)
        let y = 50 + CGFloat(event.trackIndex) * 60

        let eventRect = CGRect(x: x - 30, y: y - 15, width: 60, height: 30)
        let eventPath = Path(roundedRect: eventRect, cornerRadius: 5)

        context.fill(eventPath, with: .color(eventColor(for: event)))
        context.stroke(eventPath, with: .color(.gray), lineWidth: 1.0)

        if transform.a > 0.6 {
            let text = Text(event.title)
                .font(.caption2)
                .foregroundColor(.primary)
            context.draw(text, at: CGPoint(x: x, y: y))
        }
    }

    private func drawDebugOverlay(in context: GraphicsContext, size: CGSize) {
        // Performance metrics overlay
        let debugText = """
        FPS: \(String(format: "%.1f", currentFPS))
        Cards: \(dataAdapter.cardCount)
        Quality: \(renderQuality.debugDescription)
        Zoom: \(String(format: "%.2f", transform.a))
        """

        let backgroundRect = CGRect(x: 10, y: 10, width: 150, height: 80)
        context.fill(Path(backgroundRect), with: .color(.black.opacity(0.7)))

        let text = Text(debugText)
            .font(.caption2)
            .foregroundColor(.white)
        context.draw(text, at: CGPoint(x: backgroundRect.midX, y: backgroundRect.midY))
    }

    private func drawNodeLabels(in context: GraphicsContext, nodes: [NetworkNode]) {
        for node in nodes where node.shouldShowLabel {
            let text = Text(node.title)
                .font(.caption)
                .foregroundColor(.primary)

            let labelPosition = CGPoint(
                x: node.position.x,
                y: node.position.y + node.radius + 15
            )
            context.draw(text, at: labelPosition)
        }
    }

    // MARK: - Platform Optimizations

    #if os(iOS)
    private func drawOptimizedNetwork(in context: GraphicsContext, size: CGSize, data: NetworkVisualizationData) {
        // Memory-constrained rendering - simplified graphics
        for node in data.nodes where node.priority > 0 {
            let rect = CGRect(
                x: node.position.x - 5,
                y: node.position.y - 5,
                width: 10,
                height: 10
            )
            context.fill(Path(ellipseIn: rect), with: .color(.blue.opacity(0.7)))
        }

        // Skip edge rendering in memory-constrained mode
    }
    #endif

    private var isMemoryConstrained: Bool {
        #if os(iOS)
        return PerformanceMonitor.shared.memoryStats.isMemoryConstrained
        #else
        return false
        #endif
    }

    private func updateRenderQuality() {
        #if os(iOS)
        if isMemoryConstrained {
            renderQuality = .reduced
        } else if isBackgrounded {
            renderQuality = .reduced
        } else {
            renderQuality = .full
        }
        #elseif os(macOS)
        renderQuality = displayScale > 1.5 ? RenderQuality.enhanced : RenderQuality.full
        #endif
    }

    // MARK: - Color and Style Helpers

    private func nodeColor(for node: NetworkNode) -> Color {
        switch node.cardType {
        case .note:
            return .blue.opacity(0.7)
        case .task:
            return node.isCompleted ? .green.opacity(0.7) : .orange.opacity(0.7)
        case .event:
            return .purple.opacity(0.7)
        case .location:
            return .red.opacity(0.7)
        default:
            return .gray.opacity(0.7)
        }
    }

    private func nodeColor(for node: HierarchyNode) -> Color {
        // Use a hierarchy-based color scheme
        switch node.level {
        case 0:
            return .blue.opacity(0.8)  // Root level
        case 1:
            return .green.opacity(0.7) // First level
        case 2:
            return .orange.opacity(0.7) // Second level
        default:
            return .gray.opacity(0.6)  // Deeper levels
        }
    }

    private func edgeColor(for edge: NetworkEdge) -> Color {
        switch edge.relationship {
        case .reference:
            return .blue.opacity(0.5)
        case .sequence:
            return .green.opacity(0.5)
        case .hierarchy:
            return .purple.opacity(0.5)
        case .temporal:
            return .orange.opacity(0.5)
        default:
            return .gray.opacity(0.3)
        }
    }

    private func edgeWidth(for edge: NetworkEdge) -> CGFloat {
        switch edge.strength {
        case 0.0..<0.3:
            return 1.0
        case 0.3..<0.7:
            return 2.0
        default:
            return 3.0
        }
    }

    private func eventColor(for event: TimelineEvent) -> Color {
        switch event.eventType {
        case .creation:
            return .green.opacity(0.7)
        case .modification:
            return .blue.opacity(0.7)
        case .completion:
            return .purple.opacity(0.7)
        case .deadline:
            return .red.opacity(0.7)
        default:
            return .gray.opacity(0.7)
        }
    }

    // MARK: - Gesture Handling

    private func createGestureHandler() -> some Gesture {
        #if os(iOS)
        return iOSOptimizedGestures()
        #elseif os(macOS)
        return macOSOptimizedGestures()
        #endif
    }

    #if os(iOS)
    private func iOSOptimizedGestures() -> some Gesture {
        SimultaneousGesture(
            MagnificationGesture(minimumScaleDelta: 0.01)
                .updating($magnification) { value, state, transaction in
                    state = value
                    transaction.disablesAnimations = isMemoryConstrained
                }
                .onEnded { value in
                    let animation: Animation? = isMemoryConstrained ? nil : .easeOut(duration: 0.2)
                    withAnimation(animation) {
                        let constrainedValue = max(0.1, min(value, 10.0))
                        transform = transform.scaledBy(x: constrainedValue, y: constrainedValue)
                    }
                },

            DragGesture(minimumDistance: 1.0)
                .updating($panOffset) { value, state, transaction in
                    state = value.translation
                    transaction.disablesAnimations = isMemoryConstrained
                }
                .onEnded { value in
                    let animation: Animation? = isMemoryConstrained ? nil : .easeOut(duration: 0.15)
                    withAnimation(animation) {
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

            DragGesture(minimumDistance: 0.5)
                .updating($panOffset) { value, state, _ in
                    state = CGSize(
                        width: value.translation.width * 1.2,
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

    // MARK: - User Interaction

    private func handleCanvasTap(at location: CGPoint, in canvasSize: CGSize) {
        // Convert tap location to canvas coordinates accounting for transform
        let inverseTransform = transform.inverted()
        let canvasLocation = location.applying(inverseTransform)

        // Find card at tapped location based on visualization type
        switch visualizationType {
        case .network:
            if let node = dataAdapter.networkData?.nodes.first(where: { node in
                let distance = sqrt(pow(canvasLocation.x - node.position.x, 2) + pow(canvasLocation.y - node.position.y, 2))
                return distance <= node.radius
            }) {
                selectedCard = node.card
                showingCardDetail = true
            }

        case .grid:
            let cellSize = CGSize(width: 120, height: 80)
            let gridX = Int(canvasLocation.x / cellSize.width)
            let gridY = Int(canvasLocation.y / cellSize.height)

            if let cellData = dataAdapter.gridData?.cells.first(where: { $0.gridX == gridX && $0.gridY == gridY }) {
                selectedCard = cellData.card
                showingCardDetail = true
            }

        case .timeline:
            // Handle timeline event selection
            if let event = dataAdapter.timelineData?.events.first(where: { event in
                let distance = sqrt(pow(canvasLocation.x - event.position.x, 2) + pow(canvasLocation.y - event.position.y, 2))
                return distance <= 30
            }) {
                selectedCard = event.card
                showingCardDetail = true
            }

        case .hierarchy:
            // Handle hierarchy node selection
            if let node = dataAdapter.hierarchyData?.nodes.first(where: { node in
                let rect = CGRect(x: node.position.x - 40, y: node.position.y - 15, width: 80, height: 30)
                return rect.contains(canvasLocation)
            }) {
                selectedCard = node.card
                showingCardDetail = true
            }
        }
    }

    private func fitToContent() {
        withAnimation(.easeInOut(duration: 0.5)) {
            transform = .identity
        }
    }

    private func exportVisualization() {
        // Export functionality will be implemented in Plan 02 (WKWebView integration)
        print("Export visualization - to be implemented in Plan 02")
    }

    // MARK: - Performance Tracking

    private func updateFrameRate(_ frameStart: TimeInterval) {
        let frameEnd = CACurrentMediaTime()
        let frameDuration = frameEnd - frameStart
        let instantFPS = 1.0 / frameDuration

        // Smooth FPS calculation
        currentFPS = currentFPS * 0.9 + instantFPS * 0.1

        lastFrameTime = frameDuration

        // Record performance metrics
        PerformanceMonitor.shared.recordComponentResize(frameDuration)
    }

    // MARK: - Platform Lifecycle

    private func setupPlatformOptimizations() {
        #if os(iOS)
        setupiOSOptimizations()
        #elseif os(macOS)
        setupmacOSOptimizations()
        #endif
    }

    #if os(iOS)
    private func setupiOSOptimizations() {
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
            animationEnabled = false
        case .active:
            isBackgrounded = false
            animationEnabled = true
            Task {
                await dataAdapter.refreshData()
            }
        case .inactive:
            break
        @unknown default:
            break
        }
    }

    private func handleMemoryPressure() {
        dataAdapter.clearCaches()
        renderQuality = .reduced
    }
    #endif

    #if os(macOS)
    private func setupmacOSOptimizations() {
        updateDisplayScale()

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

// MARK: - Supporting Types

public enum VisualizationType: String, CaseIterable {
    case network = "Network"
    case timeline = "Timeline"
    case hierarchy = "Hierarchy"
    case grid = "Grid"
}

public enum RenderQuality: String {
    case reduced = "Reduced"
    case full = "Full"
    case enhanced = "Enhanced"

    var debugDescription: String { rawValue }
}

// MARK: - Visualization Controls

struct VisualizationControls: View {
    @Binding var visualizationType: VisualizationType
    @Binding var animationEnabled: Bool
    @Binding var showDebugInfo: Bool
    let onFitToContent: () -> Void
    let onExport: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Visualization type picker
            Menu {
                ForEach(VisualizationType.allCases, id: \.self) { type in
                    Button(type.rawValue) {
                        visualizationType = type
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: iconFor(visualizationType))
                    Text(visualizationType.rawValue)
                    Image(systemName: "chevron.down")
                        .font(.caption2)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            // Fit to content button
            Button(action: onFitToContent) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .padding(6)
                    .background(.regularMaterial)
                    .clipShape(Circle())
            }

            // Animation toggle
            Button(action: { animationEnabled.toggle() }) {
                Image(systemName: animationEnabled ? "play.circle.fill" : "pause.circle")
                    .foregroundColor(animationEnabled ? .green : .gray)
                    .padding(6)
                    .background(.regularMaterial)
                    .clipShape(Circle())
            }

            // Debug toggle
            Button(action: { showDebugInfo.toggle() }) {
                Image(systemName: "info.circle")
                    .foregroundColor(showDebugInfo ? .blue : .gray)
                    .padding(6)
                    .background(.regularMaterial)
                    .clipShape(Circle())
            }

            // Export button (placeholder for Plan 02)
            Button(action: onExport) {
                Image(systemName: "square.and.arrow.up")
                    .padding(6)
                    .background(.regularMaterial)
                    .clipShape(Circle())
            }
        }
    }

    private func iconFor(_ type: VisualizationType) -> String {
        switch type {
        case .network:
            return "circles.hexagongrid"
        case .timeline:
            return "timeline.selection"
        case .hierarchy:
            return "list.triangle"
        case .grid:
            return "square.grid.3x3"
        }
    }
}

// MARK: - Performance Indicator

struct PerformanceIndicator: View {
    let fps: Double
    let renderQuality: RenderQuality

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("\(fps, specifier: "%.1f") FPS")
                .font(.caption2)
                .foregroundColor(fps > 55 ? .green : fps > 30 ? .orange : .red)

            Text(renderQuality.rawValue)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(6)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - Card Detail View (Placeholder)

struct VisualizationCardDetailView: View {
    let card: VisualizationNotebookCard

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 16) {
                Text(card.title)
                    .font(.title2)
                    .fontWeight(.semibold)

                if let content = card.content {
                    ScrollView {
                        Text(content)
                            .font(.body)
                    }
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Card Details")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
        }
    }
}

// MARK: - Preview

#Preview {
    VisualizationCanvas(database: IsometryDatabase.preview)
}

// MARK: - Accessibility

extension VisualizationCanvas {
    enum AccessibilityID {
        static let canvas = "notebook.visualization.canvas"
        static let controls = "notebook.visualization.controls"
        static let performanceIndicator = "notebook.visualization.performance"
    }
}