import SwiftUI

#if os(macOS)
import AppKit
#endif

#if os(iOS)
import UIKit
#endif

/// Main notebook content view with responsive three-component layout
/// Provides desktop drag-to-resize, tablet/mobile adaptive layouts, and state persistence
/// Enhanced with iOS multitasking and touch optimizations
public struct NotebookContentView: View {

    @StateObject private var layout = NotebookLayoutModel()
    @State private var screenSize: NotebookLayoutModel.ScreenSize = .desktop
    @State private var isDragging: String? = nil
    @State private var dragStart = DragStartState()

    #if os(iOS)
    @StateObject private var multitaskingSupport = MultitaskingSupport()
    @StateObject private var touchOptimizations = TouchOptimizations()
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    #endif

    public init() {}

    public var body: some View {
        NavigationView {
            GeometryReader { geometry in
                Group {
                    #if os(iOS)
                    // iOS layout with multitasking support
                    if multitaskingSupport.isSlideOverMode {
                        slideOverLayout
                    } else {
                        adaptiveLayout(for: geometry)
                    }
                    #else
                    // macOS/other platforms
                    switch screenSize {
                    case .mobile:
                        mobileLayout
                    case .tablet:
                        tabletLayout
                    case .desktop:
                        desktopLayout(for: geometry.size)
                    }
                    #endif
                }
                .onAppear {
                    updateScreenSize(for: geometry.size.width)
                    #if os(iOS)
                    setupiOSConfiguration(geometry: geometry)
                    #endif
                }
                .onChange(of: geometry.size.width) { _, width in
                    updateScreenSize(for: width)
                    #if os(iOS)
                    updateMultitaskingLayout(width: width)
                    #endif
                }
                #if os(iOS)
                .onChange(of: horizontalSizeClass) { _, _ in
                    handleSizeClassChange()
                }
                .modifier(touchOptimizations.touchOptimizations())
                #endif
            }
        }
        .navigationTitle("Notebook")
        #if os(iOS)
        #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
        #endif
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Menu {
                    Button("Reset Layout") {
                        layout.resetToDefaults()
                    }

                    Divider()

                    Button("Focus Capture") {
                        // TODO: Implement focus logic
                    }

                    Button("Focus Shell") {
                        // TODO: Implement focus logic
                    }

                    Button("Focus Preview") {
                        // TODO: Implement focus logic
                    }
                } label: {
                    Image(systemName: "rectangle.3.group")
                }
                .help("Layout Options")
            }
        }
    }

    // MARK: - Mobile Layout

    @ViewBuilder
    private var mobileLayout: some View {
        VStack(spacing: 8) {
            // All three components stacked vertically with equal heights
            NotebookCaptureView()
                .frame(minHeight: 200)

            NotebookShellView()
                .frame(minHeight: 200)

            NotebookPreviewView()
                .frame(minHeight: 200)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Tablet Layout

    @ViewBuilder
    private var tabletLayout: some View {
        VStack(spacing: 8) {
            // Capture on top (50% height)
            NotebookCaptureView()
                .frame(minHeight: 300)

            // Shell and Preview side-by-side below (50% height)
            HStack(spacing: 8) {
                NotebookShellView()
                    .frame(minWidth: 300)

                NotebookPreviewView()
                    .frame(minWidth: 300)
            }
            .frame(minHeight: 300)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Desktop Layout

    @ViewBuilder
    private func desktopLayout(for size: CGSize) -> some View {
        HStack(spacing: 0) {
            // Capture Component
            NotebookCaptureView()
                .frame(width: size.width * (layout.captureLayout.width / 100))
                .frame(minWidth: layout.getMinimumWidths().capture)

            // Capture-Shell Divider
            dividerView(for: "capture-shell")
                .onDragChanged(for: "capture-shell", in: size)

            // Shell Component
            NotebookShellView()
                .frame(width: size.width * (layout.shellLayout.width / 100))
                .frame(minWidth: layout.getMinimumWidths().shell)

            // Shell-Preview Divider
            dividerView(for: "shell-preview")
                .onDragChanged(for: "shell-preview", in: size)

            // Preview Component
            NotebookPreviewView()
                .frame(width: size.width * (layout.previewLayout.width / 100))
                .frame(minWidth: layout.getMinimumWidths().preview)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        // TODO: Add cursor handling in Phase 6.2 with proper macOS integration
    }

    // MARK: - Divider View

    @ViewBuilder
    private func dividerView(for type: String) -> some View {
        Rectangle()
            .fill(.separator.opacity(isDragging == type ? 0.8 : 0.4))
            .frame(width: 1)
            .overlay {
                Rectangle()
                    .fill(Color.clear)
                    .frame(width: 8) // Wider hit target
                    // TODO: Add cursor(.resizeLeftRight) in Phase 6.2
            }
            .onHover { isHovering in
                // Visual feedback on hover
                if !isHovering && isDragging != type {
                    // Reset visual state
                }
            }
    }

    // MARK: - Helper Methods

    private func updateScreenSize(for width: CGFloat) {
        let newSize = NotebookLayoutModel.ScreenSize.from(width: width)
        if newSize != screenSize {
            screenSize = newSize
            layout.calculateLayout(for: newSize)
        }
    }

    // MARK: - Drag State

    private struct DragStartState {
        var position: CGPoint = .zero
        var startingWidth: Double = 0
    }
}

// MARK: - Drag Gesture Extensions

private extension View {
    @ViewBuilder
    func onDragChanged(for dividerType: String, in containerSize: CGSize) -> some View {
        self.gesture(
            DragGesture()
                .onChanged { value in
                    // This will be implemented when we have access to the parent's state
                    // For now, this provides the structure for drag handling
                }
                .onEnded { value in
                    // Handle drag end
                }
        )
    }
}

// MARK: - Cursor Modifier
// TODO: Implement cursor handling in Phase 6.2 with proper macOS NSCursor integration

// MARK: - Enhanced Desktop Layout with Drag Handling

extension NotebookContentView {
    /// Enhanced desktop layout with proper drag gesture handling
    @ViewBuilder
    private func enhancedDesktopLayout(for size: CGSize) -> some View {
        HStack(spacing: 0) {
            // Capture Component
            NotebookCaptureView()
                .frame(width: max(
                    layout.getMinimumWidths().capture,
                    size.width * (layout.captureLayout.width / 100)
                ))

            // Capture-Shell Divider
            DividerView(
                type: "capture-shell",
                isDragging: isDragging == "capture-shell",
                onDragStarted: { startDrag("capture-shell", at: $0) },
                onDragChanged: { handleDrag("capture-shell", value: $0, containerSize: size) },
                onDragEnded: { endDrag() }
            )

            // Shell Component
            NotebookShellView()
                .frame(width: max(
                    layout.getMinimumWidths().shell,
                    size.width * (layout.shellLayout.width / 100)
                ))

            // Shell-Preview Divider
            DividerView(
                type: "shell-preview",
                isDragging: isDragging == "shell-preview",
                onDragStarted: { startDrag("shell-preview", at: $0) },
                onDragChanged: { handleDrag("shell-preview", value: $0, containerSize: size) },
                onDragEnded: { endDrag() }
            )

            // Preview Component
            NotebookPreviewView()
                .frame(width: max(
                    layout.getMinimumWidths().preview,
                    size.width * (layout.previewLayout.width / 100)
                ))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Drag Handling Methods

    private func startDrag(_ type: String, at position: CGPoint) {
        isDragging = type
        dragStart.position = position

        switch type {
        case "capture-shell":
            dragStart.startingWidth = layout.captureLayout.width
        case "shell-preview":
            dragStart.startingWidth = layout.shellLayout.width
        default:
            break
        }
    }

    private func handleDrag(_ type: String, value: DragGesture.Value, containerSize: CGSize) {
        let deltaX = value.location.x - dragStart.position.x
        let deltaPercentage = (deltaX / containerSize.width) * 100

        switch type {
        case "capture-shell":
            let newCaptureWidth = dragStart.startingWidth + deltaPercentage
            layout.updateComponentWidth(.capture, to: newCaptureWidth)

        case "shell-preview":
            let newShellWidth = dragStart.startingWidth + deltaPercentage
            layout.updateComponentWidth(.shell, to: newShellWidth)

        default:
            break
        }
    }

    private func endDrag() {
        isDragging = nil
        dragStart = DragStartState()
    }
}

// MARK: - Custom Divider View

private struct DividerView: View {
    let type: String
    let isDragging: Bool
    let onDragStarted: (CGPoint) -> Void
    let onDragChanged: (DragGesture.Value) -> Void
    let onDragEnded: () -> Void

    var body: some View {
        Rectangle()
            .fill(.separator.opacity(isDragging ? 0.8 : 0.4))
            .frame(width: 1)
            .background {
                Rectangle()
                    .fill(Color.clear)
                    .frame(width: 8) // Wider hit target for easier dragging
            }
            // TODO: Add cursor(.resizeLeftRight) in Phase 6.2
            .gesture(
                DragGesture(coordinateSpace: .local)
                    .onChanged { value in
                        if !isDragging {
                            onDragStarted(value.startLocation)
                        }
                        onDragChanged(value)
                    }
                    .onEnded { _ in
                        onDragEnded()
                    }
            )
    }
}

// MARK: - iOS-Specific Layouts

#if os(iOS)
extension NotebookContentView {

    /// Slide-over optimized layout for quick capture
    @ViewBuilder
    private var slideOverLayout: some View {
        let config = multitaskingSupport.getSlideOverConfiguration()

        VStack(spacing: 8) {
            if config.showCaptureOnly {
                NotebookCaptureView()
                    .frame(minHeight: 400)
            } else {
                // Compact three-component stack
                NotebookCaptureView()
                    .frame(minHeight: 200)

                NotebookShellView()
                    .frame(minHeight: 150)

                NotebookPreviewView()
                    .frame(minHeight: 150)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .gesture(multitaskingSupport.handleSlideOverDismissal())
    }

    /// Adaptive layout for split view and other multitasking modes
    @ViewBuilder
    private func adaptiveLayout(for geometry: GeometryReader<some View>.Content) -> some View {
        let size = geometry.size
        let layoutComponents = multitaskingSupport.calculateSplitViewLayout(containerWidth: size.width)

        switch multitaskingSupport.currentWindowMode.layoutPriority {
        case .balanced:
            // Three-component layout adapted for split view
            HStack(spacing: 4) {
                if layoutComponents.capture > 0 {
                    NotebookCaptureView()
                        .frame(width: layoutComponents.capture)
                        .frame(minWidth: 280)
                }

                if layoutComponents.shell > 0 {
                    NotebookShellView()
                        .frame(width: layoutComponents.shell)
                        .frame(minWidth: 200)
                }

                if layoutComponents.preview > 0 {
                    NotebookPreviewView()
                        .frame(width: layoutComponents.preview)
                        .frame(minWidth: 200)
                }
            }
            .padding(.horizontal, 8)

        case .captureFirst:
            // Capture prioritized for narrow split view
            VStack(spacing: 4) {
                NotebookCaptureView()
                    .frame(height: size.height * 0.6)

                HStack(spacing: 4) {
                    if layoutComponents.shell > 0 {
                        NotebookShellView()
                            .frame(minWidth: 150)
                    }

                    if layoutComponents.preview > 0 {
                        NotebookPreviewView()
                            .frame(minWidth: 150)
                    }
                }
                .frame(height: size.height * 0.4)
            }
            .padding(.horizontal, 8)

        case .captureOnly:
            // Only capture component visible
            NotebookCaptureView()
                .padding(.horizontal, 8)

        case .shellPreview:
            // Only shell and preview (rare case)
            HStack(spacing: 4) {
                NotebookShellView()
                NotebookPreviewView()
            }
            .padding(.horizontal, 8)
        }
    }

    /// Setup iOS-specific configuration
    private func setupiOSConfiguration(geometry: GeometryReader<some View>.Content) {
        // Configure multitasking based on initial geometry
        updateMultitaskingLayout(width: geometry.size.width)

        // Setup touch optimizations
        touchOptimizations.isHapticEnabled = true

        // Configure accessibility
        // This would be called on the main container view
    }

    /// Update multitasking layout when geometry changes
    private func updateMultitaskingLayout(width: CGFloat) {
        // This triggers recalculation in MultitaskingSupport
        let _ = multitaskingSupport.calculateSplitViewLayout(containerWidth: width)
    }

    /// Handle size class changes (iPad rotation, split view changes)
    private func handleSizeClassChange() {
        // Respond to iOS size class changes
        switch (horizontalSizeClass, verticalSizeClass) {
        case (.compact, .regular):
            // iPhone portrait or narrow split view
            screenSize = .mobile

        case (.regular, .compact):
            // iPad landscape or wide split view
            screenSize = .tablet

        case (.regular, .regular):
            // iPad portrait
            screenSize = .desktop

        default:
            screenSize = .mobile
        }
    }
}

/// iOS-specific toolbar configuration
extension NotebookContentView {

    @ToolbarContentBuilder
    private var iOSToolbarItems: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                Button("Reset Layout") {
                    layout.resetToDefaults()
                    touchOptimizations.triggerHaptic(.light)
                }

                Divider()

                Button("Focus Capture") {
                    // Focus on capture component
                    touchOptimizations.triggerHaptic(.selection)
                }

                Button("Focus Shell") {
                    // Focus on shell component
                    touchOptimizations.triggerHaptic(.selection)
                }

                Button("Focus Preview") {
                    // Focus on preview component
                    touchOptimizations.triggerHaptic(.selection)
                }

                Divider()

                Toggle("Haptic Feedback", isOn: $touchOptimizations.isHapticEnabled)

            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }

        // Add multitasking status indicator for debugging/info
        ToolbarItem(placement: .navigationBarLeading) {
            HStack {
                if multitaskingSupport.isInBackground {
                    Image(systemName: "moon.fill")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }

                if multitaskingSupport.backgroundSyncInProgress {
                    ProgressView()
                        .scaleEffect(0.7)
                }

                Text(windowModeText)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var windowModeText: String {
        switch multitaskingSupport.currentWindowMode {
        case .fullScreen:
            return "Full"
        case .splitView(let width):
            return "Split \(Int(width))"
        case .slideOver:
            return "Slide"
        case .compact:
            return "Compact"
        }
    }
}

/// Background app refresh handling
extension NotebookContentView {

    /// Handle app entering background
    private func handleAppBackground() {
        // Triggered by MultitaskingSupport notifications
        // Save current state, prepare for backgrounding
    }

    /// Handle app returning to foreground
    private func handleAppForeground() {
        // Triggered by MultitaskingSupport notifications
        // Refresh data, restore state
    }
}

#endif

// MARK: - Keyboard Shortcuts

extension NotebookContentView {
    /// Handle keyboard shortcuts for component focus and layout control
    /// TODO: Implement keyboard shortcuts in Phase 6.2
    private func handleKeyboardShortcuts() -> some View {
        self
        // Keyboard shortcuts will be implemented in Phase 6.2 with proper event handling
        // .onReceive for focus management (Cmd+1, Cmd+2, Cmd+3)
        // .onReceive for layout reset (Cmd+R)
    }
}

// MARK: - Accessibility

extension NotebookContentView {
    enum AccessibilityID {
        static let mainContainer = "notebook.content.main"
        static let captureComponent = "notebook.capture.container"
        static let shellComponent = "notebook.shell.container"
        static let previewComponent = "notebook.preview.container"
        static let captureShellDivider = "notebook.divider.capture-shell"
        static let shellPreviewDivider = "notebook.divider.shell-preview"
    }
}

// MARK: - Preview

#Preview {
    NotebookContentView()
        .frame(width: 1200, height: 800)
}