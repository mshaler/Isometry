# Phase 13: Native Chrome + File Import - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The app feels native — it has a proper SwiftUI shell with platform-appropriate navigation and menus, and users can import files via the native file picker feeding the existing ETL pipeline. No new parsing code in Swift — bytes go to the Web Worker which runs the existing TypeScript ETL parsers.

</domain>

<decisions>
## Implementation Decisions

### Sidebar & Navigation Layout
- NavigationSplitView sidebar contains view switcher only (the 9 D3 views: Grid, List, Kanban, Calendar, Timeline, Network, Tree, Gallery, SuperGrid)
- Sidebar collapsed by default on iPad/macOS — maximizes D3 canvas area
- Each view in sidebar gets an SF Symbol icon + text label
- On iPhone (compact width): no sidebar — a toolbar button opens a sheet/popover picker showing all 9 views
- iPad/macOS: sidebar toggle button in toolbar to reveal/collapse

### Toolbar & Menu Design
- iOS toolbar items: sidebar toggle (iPad only), import file button, view picker button
- macOS File menu: Import File item only (Cmd+I) — no Export in this phase
- macOS Edit menu: Undo/Redo with Cmd+Z / Cmd+Shift+Z (implementation approach is Claude's discretion)
- Web content renders below the toolbar in a separate area — no overlay/floating chrome
- Safe area insets continue to be delivered via LaunchPayload (CHRM-04)

### File Import Flow
- Universal file picker — one "Import" button opens picker filtered to .json, .md/.txt, .csv, .xlsx
- File type auto-detected from extension (maps to ETL parser source: 'json', 'markdown', 'excel', 'csv')
- Single file selection only — one file per import operation
- 50MB size limit enforced in Swift before passing to JS — oversized files get a standard alert dialog ("File too large")
- Swift reads file bytes → base64 encodes → sends via bridge to JS → JS passes to WorkerBridge.importFile() → existing ETL pipeline runs in Web Worker
- Progress feedback via existing web-side ImportToast — no new native progress UI needed
- After import completes, JS triggers a checkpoint (database mutation → dirty flag → autosave)

### Claude's Discretion
- Undo/Redo implementation: bridge to web runtime if undo stack exists, or stub as no-op
- Dark/light mode: system automatic vs forced — depends on what the web runtime currently supports
- Status bar style on iOS
- Exact SF Symbol choices for each of the 9 views
- Toolbar button styling and placement details

</decisions>

<specifics>
## Specific Ideas

- Launch screen should match the web runtime's background color for a seamless transition from launch → loaded content
- App icon is a placeholder for now — simple colored square. Real icon designed later.
- The `native:action` bridge message type (already stubbed in BridgeManager.swift) is the integration point for file import: Swift handles the file picker, then sends bytes through the bridge

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BridgeManager.swift`: Already has `native:action` case stubbed — this is where file import dispatch goes
- `WebViewContainer.swift`: Platform-conditional UIViewRepresentable/NSViewRepresentable — stays as-is
- `DatabaseManager.swift`: Actor-based persistence — no changes needed for this phase
- `ContentView.swift`: Currently a flat ZStack — needs restructuring to NavigationSplitView
- `IsometryApp.swift`: Already has `.onChange(of: scenePhase)` lifecycle management and macOS app delegate
- `WorkerBridge.importFile()`: JS-side ETL entry point already exists — accepts (data, source, options)
- `NativeShell.md`: Reference architecture with toolbar pattern, macOS Commands struct, and native action handler

### Established Patterns
- `@MainActor` on BridgeManager — all bridge interactions must stay on main thread
- WeakScriptMessageHandler proxy pattern — any new message handlers must follow this
- `#if os(macOS)` / `#if os(iOS)` conditional compilation — established for platform-specific code
- Base64 encoding for data transfer between Swift and JS (used in LaunchPayload and checkpoint)
- `bridgeManager.register(with: config)` called before WKWebView creation

### Integration Points
- `ContentView.swift` → restructure from ZStack to NavigationSplitView with sidebar
- `BridgeManager.didReceive()` → fill in `native:action` case for file import dispatch
- `IsometryApp.body` → add `.commands { }` modifier for macOS menu bar
- LaunchPayload → safe area insets already sent (CHRM-04 partially done)
- Asset catalog → new app icon and launch screen storyboard/color

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-native-chrome-file-import*
*Context gathered: 2026-03-03*
