import SwiftUI

#if os(macOS)
import AppKit
#endif

/// Main notebook content view with responsive three-component layout
/// Provides desktop drag-to-resize, tablet/mobile adaptive layouts, and state persistence
public struct NotebookContentView: View {

    @StateObject private var layout = NotebookLayoutModel()
    @State private var screenSize: NotebookLayoutModel.ScreenSize = .desktop
    @State private var isDragging: String? = nil
    @State private var dragStart = DragStartState()

    public init() {}

    public var body: some View {
        NavigationView {
            GeometryReader { geometry in
                Group {
                    switch screenSize {
                    case .mobile:
                        mobileLayout
                    case .tablet:
                        tabletLayout
                    case .desktop:
                        desktopLayout(for: geometry.size)
                    }
                }
                .onAppear {
                    updateScreenSize(for: geometry.size.width)
                }
                .onChange(of: geometry.size.width) { _, width in
                    updateScreenSize(for: width)
                }
            }
        }
        .navigationTitle("Notebook")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
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