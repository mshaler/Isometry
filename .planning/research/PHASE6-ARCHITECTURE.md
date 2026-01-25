# Architecture Patterns: Phase 6 Native Integration

**Domain:** Native iOS/macOS implementation of React notebook architecture
**Researched:** 2026-01-25

## Current State Analysis

### React Architecture (Complete)
```
┌─────────────────────────────────────────────────────────────────┐
│                    ISOMETRY NOTEBOOK SIDECAR                   │
├─────────────────┬─────────────────┬─────────────────────────────┤
│     CAPTURE     │      SHELL      │           PREVIEW           │
│ (@uiw/react-md  │ (@xterm/xterm   │      (WKWebView +           │
│  + Properties)  │ + Claude API)   │       D3.js)                │
└─────────────────┴─────────────────┴─────────────────────────────┘
│                     SHARED CONTEXT LAYER                       │
│    NotebookCtx + FilterCtx + PAFVCtx + ThemeCtx (existing)     │
│                                                                 │
│                       SQLITE DATABASE                          │
│  notebook_cards (new) + nodes/edges/facets (existing)          │
└─────────────────────────────────────────────────────────────────┘
```

### Native Architecture (Existing SuperGrid)
```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPERGRID VIEW                          │
├─────────────────────────────────────────────────────────────────┤
│  Z=0: SPARSITY (Canvas)  │  Z=1: DENSITY (SwiftUI)  │  Z=2: OVERLAYS │
│  60fps Grid Rendering    │  Controls & Headers       │  Cards & Sheets │
└─────────────────────────────────────────────────────────────────┘
│                      SWIFT ACTOR STATE                         │
│         SuperGridViewModel + AppState + Database               │
│                                                                 │
│                      GRDB + CLOUDKIT                           │
│     IsometryDatabase (Actor) + CloudKitSyncManager             │
└─────────────────────────────────────────────────────────────────┘
```

## Recommended Native Architecture

### Three-Component Native Layout
```swift
struct NotebookView: View {
    @StateObject private var notebookManager = NotebookManager()
    @EnvironmentObject private var appState: AppState

    var body: some View {
        HStack(spacing: 0) {
            // Component 1: Capture
            CaptureView()
                .frame(minWidth: 300)
                .layoutPriority(1)

            Divider()

            // Component 2: Shell
            ShellView()
                .frame(minWidth: 250)
                .layoutPriority(0.8)

            Divider()

            // Component 3: Preview
            PreviewView()
                .frame(minWidth: 250)
                .layoutPriority(0.7)
        }
        .environmentObject(notebookManager)
    }
}
```

### State Management Pattern
```swift
// Extend existing AppState with notebook capabilities
@MainActor
class NotebookManager: ObservableObject {
    @Published var activeCard: NotebookCard?
    @Published var layoutConfig: LayoutConfiguration

    // Capture state
    @Published var markdownContent: String = ""
    @Published var isDirty: Bool = false
    @Published var isAutoSaving: Bool = false

    // Shell state
    @Published var terminalHistory: [TerminalLine] = []
    @Published var isExecuting: Bool = false
    @Published var claudeConnectionStatus: ConnectionStatus

    // Preview state
    @Published var previewContent: PreviewContent?
    @Published var exportStatus: ExportStatus?

    private let database: IsometryDatabase
    private let claudeClient: ClaudeAPIClient

    // Auto-save using Combine (replaces JavaScript debouncing)
    private var autoSaveTask: Task<Void, Never>?
    private let autoSaveSubject = PassthroughSubject<String, Never>()
}
```

## Component Boundaries

### Capture Component
**Responsibility:** Rich text editing, property management, auto-save
**Communicates With:** NotebookManager (state), Database (persistence)

```swift
struct CaptureView: View {
    @EnvironmentObject private var notebookManager: NotebookManager
    @State private var markdownEditor = MarkdownEditor()

    var body: some View {
        VStack {
            // Header with save status
            CaptureHeaderView()

            // Main editor area
            MarkdownEditorView(
                content: $notebookManager.markdownContent,
                onChange: { content in
                    notebookManager.markdownContentChanged(content)
                }
            )

            // Properties panel (collapsible)
            if notebookManager.propertiesExpanded {
                PropertyPanelView()
            }
        }
    }
}
```

### Shell Component
**Responsibility:** Terminal UI, process management, Claude API integration
**Communicates With:** NotebookManager (state), NSTask (processes), URLSession (Claude API)

```swift
struct ShellView: View {
    @EnvironmentObject private var notebookManager: NotebookManager
    @StateObject private var terminalManager = TerminalManager()

    var body: some View {
        VStack {
            // Header with connection status
            ShellHeaderView()

            // Terminal output area
            TerminalOutputView(lines: notebookManager.terminalHistory)

            // Command input
            CommandInputView { command in
                Task {
                    await terminalManager.executeCommand(command)
                }
            }

            // Status bar
            ShellStatusView()
        }
    }
}
```

### Preview Component
**Responsibility:** Content preview, visualization rendering, export
**Communicates With:** NotebookManager (state), WKWebView (web content), Canvas (visualizations)

```swift
struct PreviewView: View {
    @EnvironmentObject private var notebookManager: NotebookManager
    @StateObject private var previewManager = PreviewManager()

    var body: some View {
        VStack {
            // Header with export controls
            PreviewHeaderView()

            // Content area - switch between modes
            switch notebookManager.previewMode {
            case .visualization:
                VisualizationCanvasView() // Replaces D3.js
            case .web:
                WebPreviewView() // WKWebView
            case .document:
                DocumentPreviewView() // QLPreviewView
            }

            // Status bar
            PreviewStatusView()
        }
    }
}
```

## Data Flow Pattern

### 1. Capture → Database → Sync
```swift
// Auto-save pattern (replaces JavaScript debouncing)
notebookManager.markdownContentChanged(newContent)
    .debounce(for: .seconds(2), scheduler: DispatchQueue.main)
    .sink { content in
        Task {
            await database.saveNotebookCard(content)
            await cloudKitSyncManager.syncIfNeeded()
        }
    }
```

### 2. Shell → Process → Context
```swift
// Command execution pattern
func executeCommand(_ command: String) async {
    if command.hasPrefix("claude") {
        // Claude API integration
        let context = await notebookManager.getActiveCardContext()
        let response = await claudeClient.sendMessage(command, context: context)
        appendToHistory(.claude(response))
    } else {
        // System command execution
        let output = await processManager.execute(command)
        appendToHistory(.system(output))
    }
}
```

### 3. Preview → Live Updates
```swift
// Live preview updates (replaces React useEffect)
.onChange(of: notebookManager.markdownContent) { newContent in
    Task {
        await previewManager.updateVisualization(from: newContent)
    }
}
```

## Integration Points with Existing Native App

### Database Layer Extension
```swift
// Extend existing IsometryDatabase
extension IsometryDatabase {
    func createNotebookCard() async throws -> NotebookCard {
        // Leverage existing node creation patterns
        let node = try await createNode(type: .notebook)
        return NotebookCard(node: node)
    }

    func saveNotebookContent(_ card: NotebookCard) async throws {
        // Use existing updateNode patterns
        try await updateNode(card.nodeId, content: card.markdownContent)
    }
}
```

### SuperGrid Integration
```swift
// Notebook cards appear in existing SuperGrid
extension SuperGridViewModel {
    var allNodes: [Node] {
        // Existing logic already includes notebook nodes
        // No changes needed - notebook cards automatically appear
        return database.getAllNodes() // Includes notebook cards
    }
}
```

### CloudKit Sync Extension
```swift
// Leverage existing sync infrastructure
extension CloudKitSyncManager {
    func syncNotebookCards() async throws {
        // Use existing node sync patterns
        // Notebook cards sync automatically as Node entities
        try await syncNodes() // Already handles all node types
    }
}
```

## Performance Architecture

### Memory Management
- **Virtualization**: Use existing SuperGrid virtualization patterns for large terminal histories
- **Lazy Loading**: Load notebook content on-demand, similar to SuperGrid cell rendering
- **Cache Management**: Extend existing QueryCache for notebook-specific queries

### Concurrency Patterns
```swift
// Leverage existing Actor patterns
actor NotebookDatabase {
    private let database: IsometryDatabase

    func saveNotebookCard(_ card: NotebookCard) async throws {
        // Use existing Actor-based database access
        try await database.updateNode(card.nodeId, content: card.markdownContent)
    }
}
```

### Platform Optimizations
- **iOS**: Extend existing memory pressure handling for notebook content
- **macOS**: Use existing multi-window patterns for notebook sessions
- **Universal**: Leverage existing high-DPI optimizations for text rendering

## Canvas Visualization Architecture

### D3.js → Swift Canvas Migration
```swift
struct VisualizationCanvas: View {
    let dataPoints: [DataPoint]

    var body: some View {
        Canvas { context, size in
            // Use proven SuperGrid Canvas patterns
            drawGrid(in: context, size: size)
            drawDataPoints(dataPoints, in: context, size: size)
            drawInteractionOverlay(in: context, size: size)
        }
        .gesture(
            // Reuse SuperGrid pan/zoom gestures
            panZoomGesture()
        )
    }
}
```

## Sources

- SuperGridView.swift - Proven SwiftUI patterns and Canvas performance
- SuperGridViewModel.swift - State management and performance optimization patterns
- IsometryDatabase.swift - Actor-based database patterns for extension
- CloudKitSyncManager.swift - Sync infrastructure for reuse
- AppState.swift - State management hierarchy for integration