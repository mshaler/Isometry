#if os(macOS)
import SwiftUI

/// Comprehensive macOS menu bar integration for notebook functionality
public struct MenuBarIntegration: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var windowManager: WindowManager
    @State private var showingAbout = false
    @State private var showingPreferences = false

    public init() {}

    public var body: some View {
        EmptyView()
            .onAppear {
                setupMenuCommands()
            }
    }

    // MARK: - Menu Command Setup
    private func setupMenuCommands() {
        // Menu commands are set up via the main app's commandsBuilder
        // This view serves as a coordinator for menu state management
    }
}

// MARK: - Menu Commands

/// Main menu commands for Isometry notebook application
public struct IsometryMenuCommands: Commands {
    @ObservedObject private var appState: AppState
    @ObservedObject private var windowManager: WindowManager

    public init(appState: AppState, windowManager: WindowManager) {
        self.appState = appState
        self.windowManager = windowManager
    }

    public var body: some Commands {
        // Replace default "New" command
        CommandGroup(replacing: .newItem) {
            Group {
                Button("New Notebook Window") {
                    createNewNotebookWindow()
                }
                .keyboardShortcut("n", modifiers: [.command])

                Button("New Card") {
                    createNewCard()
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])

                Divider()

                Button("New Card from Template...") {
                    showTemplateSelection()
                }
                .keyboardShortcut("t", modifiers: [.command, .option])
            }
        }

        // File menu additions
        CommandGroup(after: .newItem) {
            Group {
                Button("Open Notebook...") {
                    openNotebook()
                }
                .keyboardShortcut("o", modifiers: [.command])

                Button("Open Recent") {
                    // Handled by system Recent Documents
                }
                .disabled(true)

                Divider()

                Button("Import Notes...") {
                    importNotes()
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])

                Button("Export Notebook...") {
                    exportNotebook()
                }
                .keyboardShortcut("e", modifiers: [.command, .shift])

                Divider()

                Button("Save Snapshot") {
                    saveSnapshot()
                }
                .keyboardShortcut("s", modifiers: [.command, .option])
            }
        }

        // Edit menu enhancements
        CommandGroup(after: .pasteboard) {
            Group {
                Divider()

                Button("Find in Notebook") {
                    showSearch()
                }
                .keyboardShortcut("f", modifiers: [.command])

                Button("Find and Replace") {
                    showFindReplace()
                }
                .keyboardShortcut("f", modifiers: [.command, .option])

                Divider()

                Button("Insert Slash Command") {
                    insertSlashCommand()
                }
                .keyboardShortcut("/", modifiers: [.command])

                Button("Insert Link...") {
                    insertLink()
                }
                .keyboardShortcut("k", modifiers: [.command])

                Button("Insert Date") {
                    insertCurrentDate()
                }
                .keyboardShortcut("d", modifiers: [.command, .shift])
            }
        }

        // View menu
        CommandGroup(replacing: .toolbar) {
            Group {
                Button(action: toggleSidebar) {
                    Text("Show/Hide Sidebar")
                }
                .keyboardShortcut("s", modifiers: [.command, .control])

                Button(action: toggleContentPane) {
                    Text("Show/Hide Content List")
                }
                .keyboardShortcut("l", modifiers: [.command, .control])

                Divider()

                Menu("Layout") {
                    Button("Single Column") {
                        setLayoutMode(.singleColumn)
                    }
                    .keyboardShortcut("1", modifiers: [.command, .control])

                    Button("Two Columns") {
                        setLayoutMode(.twoColumn)
                    }
                    .keyboardShortcut("2", modifiers: [.command, .control])

                    Button("Three Columns") {
                        setLayoutMode(.threeColumn)
                    }
                    .keyboardShortcut("3", modifiers: [.command, .control])
                }

                Divider()

                Menu("Theme") {
                    Button("NeXTSTEP Theme") {
                        setTheme(.nextstep)
                    }

                    Button("Modern Theme") {
                        setTheme(.modern)
                    }

                    Button("Auto (System)") {
                        setTheme(.auto)
                    }
                }

                Divider()

                Button("Zoom In") {
                    zoomIn()
                }
                .keyboardShortcut("+", modifiers: [.command])

                Button("Zoom Out") {
                    zoomOut()
                }
                .keyboardShortcut("-", modifiers: [.command])

                Button("Actual Size") {
                    resetZoom()
                }
                .keyboardShortcut("0", modifiers: [.command])

                Divider()

                Button("Enter Full Screen") {
                    toggleFullScreen()
                }
                .keyboardShortcut("f", modifiers: [.command, .control])
            }
        }

        // Custom Notebook menu
        CommandMenu("Notebook") {
            Group {
                Button("Quick Capture") {
                    showQuickCapture()
                }
                .keyboardShortcut("q", modifiers: [.command, .shift])

                Button("Focus Mode") {
                    toggleFocusMode()
                }
                .keyboardShortcut("f", modifiers: [.command, .shift])

                Divider()

                Menu("Card Operations") {
                    Button("Duplicate Card") {
                        duplicateCurrentCard()
                    }
                    .keyboardShortcut("d", modifiers: [.command])

                    Button("Archive Card") {
                        archiveCurrentCard()
                    }
                    .keyboardShortcut("a", modifiers: [.command, .shift])

                    Button("Delete Card") {
                        deleteCurrentCard()
                    }
                    .keyboardShortcut(.delete, modifiers: [.command])
                }

                Divider()

                Menu("Properties") {
                    Button("Set Priority...") {
                        setPriority()
                    }
                    .keyboardShortcut("p", modifiers: [.command, .option])

                    Button("Add Tags...") {
                        addTags()
                    }
                    .keyboardShortcut("t", modifiers: [.command, .shift])

                    Button("Set Due Date...") {
                        setDueDate()
                    }
                    .keyboardShortcut("r", modifiers: [.command, .option])
                }

                Divider()

                Button("Sync with iCloud") {
                    Task {
                        await appState.sync()
                    }
                }
                .keyboardShortcut("r", modifiers: [.command])
                .disabled(appState.syncStatus == .syncing)
            }
        }

        // Custom Shell menu
        CommandMenu("Shell") {
            Group {
                Button("New Shell Session") {
                    newShellSession()
                }
                .keyboardShortcut("t", modifiers: [.command])

                Button("Clear Shell") {
                    clearShell()
                }
                .keyboardShortcut("k", modifiers: [.command])

                Divider()

                Button("Execute Command") {
                    executeShellCommand()
                }
                .keyboardShortcut(.return, modifiers: [.command])

                Button("Interrupt Command") {
                    interruptShellCommand()
                }
                .keyboardShortcut("c", modifiers: [.command])

                Divider()

                Menu("Claude Integration") {
                    Button("Ask Claude") {
                        askClaude()
                    }
                    .keyboardShortcut("j", modifiers: [.command])

                    Button("Claude with Context") {
                        askClaudeWithContext()
                    }
                    .keyboardShortcut("j", modifiers: [.command, .shift])

                    Button("Claude Code Review") {
                        claudeCodeReview()
                    }
                    .keyboardShortcut("j", modifiers: [.command, .option])
                }

                Divider()

                Button("Command History") {
                    showCommandHistory()
                }
                .keyboardShortcut("h", modifiers: [.command, .shift])
            }
        }

        // Custom Preview menu
        CommandMenu("Preview") {
            Group {
                Button("Refresh Preview") {
                    refreshPreview()
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])

                Button("Export Preview...") {
                    exportPreview()
                }
                .keyboardShortcut("e", modifiers: [.command, .option])

                Divider()

                Menu("Visualization") {
                    Button("Canvas View") {
                        setVisualizationMode(.canvas)
                    }
                    .keyboardShortcut("1", modifiers: [.command, .option])

                    Button("Graph View") {
                        setVisualizationMode(.graph)
                    }
                    .keyboardShortcut("2", modifiers: [.command, .option])

                    Button("Timeline View") {
                        setVisualizationMode(.timeline)
                    }
                    .keyboardShortcut("3", modifiers: [.command, .option])
                }

                Divider()

                Button("Pan Canvas") {
                    enableCanvasPan()
                }
                .keyboardShortcut("p", modifiers: [.command, .control])

                Menu("Zoom") {
                    Button("Fit to Window") {
                        fitCanvasToWindow()
                    }
                    .keyboardShortcut("0", modifiers: [.command, .option])

                    Button("Zoom to Selection") {
                        zoomToSelection()
                    }
                    .keyboardShortcut("z", modifiers: [.command, .option])

                    Button("Center View") {
                        centerCanvasView()
                    }
                    .keyboardShortcut("c", modifiers: [.command, .option])
                }
            }
        }

        // Window menu enhancements
        CommandGroup(after: .windowArrangement) {
            Group {
                Divider()

                Button("Cascade Windows") {
                    cascadeWindows()
                }

                Button("Tile Windows") {
                    tileWindows()
                }

                Divider()

                Menu("Window Focus") {
                    Button("Focus Sidebar") {
                        focusSidebar()
                    }
                    .keyboardShortcut("1", modifiers: [.command, .shift])

                    Button("Focus Content") {
                        focusContent()
                    }
                    .keyboardShortcut("2", modifiers: [.command, .shift])

                    Button("Focus Detail") {
                        focusDetail()
                    }
                    .keyboardShortcut("3", modifiers: [.command, .shift])
                }
            }
        }

        // Help menu additions
        CommandGroup(after: .help) {
            Group {
                Divider()

                Button("Keyboard Shortcuts") {
                    showKeyboardShortcuts()
                }
                .keyboardShortcut("?", modifiers: [.command])

                Button("User Guide") {
                    openUserGuide()
                }

                Button("Send Feedback") {
                    sendFeedback()
                }
            }
        }
    }

    // MARK: - Command Implementations

    // File Menu Commands
    private func createNewNotebookWindow() {
        _ = windowManager.createNotebookWindow(title: "Untitled Notebook")
    }

    private func createNewCard() {
        // Implementation would create new card in current notebook
        print("Creating new card")
    }

    private func showTemplateSelection() {
        // Implementation would show template picker
        print("Showing template selection")
    }

    private func openNotebook() {
        // Implementation would show document picker
        print("Opening notebook")
    }

    private func importNotes() {
        // Implementation would show import dialog
        print("Importing notes")
    }

    private func exportNotebook() {
        // Implementation would show export dialog
        print("Exporting notebook")
    }

    private func saveSnapshot() {
        // Implementation would save current state snapshot
        print("Saving snapshot")
    }

    // Edit Menu Commands
    private func showSearch() {
        // Implementation would focus search field
        print("Showing search")
    }

    private func showFindReplace() {
        // Implementation would show find/replace panel
        print("Showing find and replace")
    }

    private func insertSlashCommand() {
        // Implementation would insert slash command
        print("Inserting slash command")
    }

    private func insertLink() {
        // Implementation would show link insertion dialog
        print("Inserting link")
    }

    private func insertCurrentDate() {
        // Implementation would insert current date
        print("Inserting current date")
    }

    // View Menu Commands
    private func toggleSidebar() {
        guard let activeWindowId = windowManager.activeWindowId,
              var context = windowManager.getWindowContext(activeWindowId) else {
            return
        }

        context.layoutState.sidebarCollapsed.toggle()
        windowManager.updateWindowContext(activeWindowId, context: context)
    }

    private func toggleContentPane() {
        guard let activeWindowId = windowManager.activeWindowId,
              var context = windowManager.getWindowContext(activeWindowId) else {
            return
        }

        context.layoutState.contentCollapsed.toggle()
        windowManager.updateWindowContext(activeWindowId, context: context)
    }

    private func setLayoutMode(_ mode: WindowManager.NotebookWindowContext.LayoutState.ViewMode) {
        guard let activeWindowId = windowManager.activeWindowId,
              var context = windowManager.getWindowContext(activeWindowId) else {
            return
        }

        context.layoutState.viewMode = mode
        windowManager.updateWindowContext(activeWindowId, context: context)
    }

    private func setTheme(_ theme: ThemeMode) {
        // Implementation would update app theme
        print("Setting theme: \(theme)")
    }

    private func zoomIn() {
        // Implementation would zoom in canvas
        print("Zooming in")
    }

    private func zoomOut() {
        // Implementation would zoom out canvas
        print("Zooming out")
    }

    private func resetZoom() {
        // Implementation would reset canvas zoom
        print("Resetting zoom")
    }

    private func toggleFullScreen() {
        // Implementation would toggle full screen mode
        print("Toggling full screen")
    }

    // Notebook Menu Commands
    private func showQuickCapture() {
        // Implementation would show quick capture interface
        print("Showing quick capture")
    }

    private func toggleFocusMode() {
        // Implementation would toggle focus mode
        print("Toggling focus mode")
    }

    private func duplicateCurrentCard() {
        // Implementation would duplicate current card
        print("Duplicating current card")
    }

    private func archiveCurrentCard() {
        // Implementation would archive current card
        print("Archiving current card")
    }

    private func deleteCurrentCard() {
        // Implementation would delete current card with confirmation
        print("Deleting current card")
    }

    private func setPriority() {
        // Implementation would show priority setting interface
        print("Setting priority")
    }

    private func addTags() {
        // Implementation would show tag addition interface
        print("Adding tags")
    }

    private func setDueDate() {
        // Implementation would show due date picker
        print("Setting due date")
    }

    // Shell Menu Commands
    private func newShellSession() {
        // Implementation would create new shell session
        print("Creating new shell session")
    }

    private func clearShell() {
        // Implementation would clear shell output
        print("Clearing shell")
    }

    private func executeShellCommand() {
        // Implementation would execute current shell command
        print("Executing shell command")
    }

    private func interruptShellCommand() {
        // Implementation would interrupt running command
        print("Interrupting shell command")
    }

    private func askClaude() {
        // Implementation would open Claude interface
        print("Asking Claude")
    }

    private func askClaudeWithContext() {
        // Implementation would ask Claude with current context
        print("Asking Claude with context")
    }

    private func claudeCodeReview() {
        // Implementation would request Claude code review
        print("Requesting Claude code review")
    }

    private func showCommandHistory() {
        // Implementation would show command history
        print("Showing command history")
    }

    // Preview Menu Commands
    private func refreshPreview() {
        // Implementation would refresh preview content
        print("Refreshing preview")
    }

    private func exportPreview() {
        // Implementation would export preview content
        print("Exporting preview")
    }

    private func setVisualizationMode(_ mode: VisualizationMode) {
        // Implementation would set visualization mode
        print("Setting visualization mode: \(mode)")
    }

    private func enableCanvasPan() {
        // Implementation would enable canvas panning mode
        print("Enabling canvas pan")
    }

    private func fitCanvasToWindow() {
        // Implementation would fit canvas to window
        print("Fitting canvas to window")
    }

    private func zoomToSelection() {
        // Implementation would zoom to selected elements
        print("Zooming to selection")
    }

    private func centerCanvasView() {
        // Implementation would center canvas view
        print("Centering canvas view")
    }

    // Window Menu Commands
    private func cascadeWindows() {
        let windows = windowManager.windows
        var yOffset: CGFloat = 100

        for window in windows {
            let newFrame = CGRect(
                x: 100,
                y: yOffset,
                width: window.frame?.width ?? 1000,
                height: window.frame?.height ?? 700
            )
            windowManager.updateWindowFrame(window.id, frame: newFrame)
            yOffset += 30
        }
    }

    private func tileWindows() {
        let windows = windowManager.windows
        guard !windows.isEmpty else { return }

        // Simple tiling - divide screen space
        let screenWidth: CGFloat = 1440 // Would get from NSScreen in real implementation
        let windowWidth = screenWidth / CGFloat(min(windows.count, 3))

        for (index, window) in windows.enumerated() {
            let newFrame = CGRect(
                x: CGFloat(index) * windowWidth,
                y: 100,
                width: windowWidth,
                height: window.frame?.height ?? 700
            )
            windowManager.updateWindowFrame(window.id, frame: newFrame)
        }
    }

    private func focusSidebar() {
        // Implementation would focus sidebar component
        print("Focusing sidebar")
    }

    private func focusContent() {
        // Implementation would focus content component
        print("Focusing content")
    }

    private func focusDetail() {
        // Implementation would focus detail component
        print("Focusing detail")
    }

    // Help Menu Commands
    private func showKeyboardShortcuts() {
        // Implementation would show keyboard shortcuts panel
        print("Showing keyboard shortcuts")
    }

    private func openUserGuide() {
        // Implementation would open user guide URL
        print("Opening user guide")
    }

    private func sendFeedback() {
        // Implementation would open feedback interface
        print("Sending feedback")
    }

    // MARK: - Supporting Types
    enum ThemeMode {
        case nextstep
        case modern
        case auto
    }

    enum VisualizationMode {
        case canvas
        case graph
        case timeline
    }
}

// MARK: - Menu State Manager

/// Manages menu state and validation
@MainActor
public final class MenuStateManager: ObservableObject {
    @Published public var canUndo: Bool = false
    @Published public var canRedo: Bool = false
    @Published public var hasSelection: Bool = false
    @Published public var isEditing: Bool = false
    @Published public var canExecuteCommand: Bool = false

    private let windowManager: WindowManager

    public init(windowManager: WindowManager) {
        self.windowManager = windowManager
    }

    /// Update menu state based on current context
    public func updateMenuState() {
        guard let activeWindowId = windowManager.activeWindowId,
              let context = windowManager.getWindowContext(activeWindowId) else {
            resetMenuState()
            return
        }

        canUndo = context.undoManager.canUndo
        canRedo = context.undoManager.canRedo
        // Additional state updates would be implemented here
    }

    private func resetMenuState() {
        canUndo = false
        canRedo = false
        hasSelection = false
        isEditing = false
        canExecuteCommand = false
    }
}

#endif