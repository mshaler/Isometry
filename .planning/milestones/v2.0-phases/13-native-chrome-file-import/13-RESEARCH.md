# Phase 13: Native Chrome + File Import - Research

**Researched:** 2026-03-03
**Domain:** SwiftUI NavigationSplitView, macOS Commands, file import (fileImporter / NSOpenPanel), base64 bridge integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sidebar & Navigation Layout**
- NavigationSplitView sidebar contains view switcher only (the 9 D3 views: Grid, List, Kanban, Calendar, Timeline, Network, Tree, Gallery, SuperGrid)
- Sidebar collapsed by default on iPad/macOS — maximizes D3 canvas area
- Each view in sidebar gets an SF Symbol icon + text label
- On iPhone (compact width): no sidebar — a toolbar button opens a sheet/popover picker showing all 9 views
- iPad/macOS: sidebar toggle button in toolbar to reveal/collapse

**Toolbar & Menu Design**
- iOS toolbar items: sidebar toggle (iPad only), import file button, view picker button
- macOS File menu: Import File item only (Cmd+I) — no Export in this phase
- macOS Edit menu: Undo/Redo with Cmd+Z / Cmd+Shift+Z (implementation approach is Claude's discretion)
- Web content renders below the toolbar in a separate area — no overlay/floating chrome
- Safe area insets continue to be delivered via LaunchPayload (CHRM-04)

**File Import Flow**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHRM-01 | SwiftUI NavigationSplitView provides sidebar on iPad/macOS and stack navigation on iPhone | NavigationSplitView + columnVisibility + `@Environment(\.horizontalSizeClass)` compact detection |
| CHRM-02 | iOS bottom toolbar shows view-switching controls | `.toolbar { ToolbarItem(placement: .bottomBar) }` on iOS; `.navigationBarTrailing` on macOS |
| CHRM-03 | macOS Commands provide File menu (Import) and Edit menu (Undo/Redo) with keyboard shortcuts | `Commands` struct + `CommandGroup` + `@FocusedObject` or NotificationCenter to bridge to view state |
| CHRM-04 | Safe area insets passed to web runtime via LaunchPayload | Already implemented in BridgeManager.sendLaunchPayload() — NavigationSplitView restructure must preserve this |
| CHRM-05 | App icon and launch screen configured in Xcode asset catalog | AppIcon.appiconset already exists (no image files yet); UILaunchScreen Info.plist key + color asset |
| FILE-01 | User can pick files via native file picker (iOS: Files app sheet, macOS: NSOpenPanel) | `.fileImporter()` on iOS/iPadOS; `NSOpenPanel.runModal()` on macOS — same trigger, platform fork |
| FILE-02 | File picker supports .json, .txt/.md, .csv, and .xlsx file types | `UTType.json`, `.plainText`, `.commaSeparatedText`, custom `UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")` |
| FILE-03 | Swift reads file bytes and passes base64 to Web Worker which runs existing ETL parsers | `startAccessingSecurityScopedResource()` + `Data(contentsOf: url)` + `.base64EncodedString()` + `native:action` bridge message → NativeBridge.ts handler → `WorkerBridge.importFile()` |
| FILE-04 | File picker enforces ~50MB size cap with user-facing warning for oversized files | Check `url.fileSize` (resource value `URLResourceKey.fileSizeKey`) before reading; show `Alert` if oversized |
</phase_requirements>

---

## Summary

Phase 13 restructures the SwiftUI shell to add real native chrome: a NavigationSplitView sidebar for view switching, platform-appropriate toolbars and menus, and a complete file import pipeline that passes raw bytes through the existing bridge to the TypeScript ETL engine. All parsing remains in the Web Worker — Swift's only job is to open the system file picker, read bytes, base64-encode, and post a `native:action` bridge message.

The work divides cleanly into two tracks: (1) chrome restructuring — `ContentView.swift` transitions from a flat `ZStack` to `NavigationSplitView`, `IsometryApp.swift` gains a `.commands {}` modifier, and toolbars are wired per-platform; (2) file import pipeline — Swift handles system picker + size check + base64 encoding, a new `native:action` handler in `NativeBridge.ts` routes the payload to `WorkerBridge.importFile()`, and the existing `ImportToast` provides all progress feedback.

The main non-trivial challenge is connecting macOS `Commands` menu items to the file-picker state that lives inside `ContentView`. The standard pattern is to use a shared `@ObservableObject` (BridgeManager already fills this role) combined with `@FocusedObject` or `NotificationCenter` as the coordination mechanism. The `fileImporter` modifier handles iOS/iPad automatically; macOS uses `NSOpenPanel.runModal()` called directly (no `NSViewRepresentable` needed since panels are windows, not views).

**Primary recommendation:** Use `.fileImporter()` on iOS/iPad and `NSOpenPanel` on macOS. Trigger both from the same state flag on `BridgeManager` (`@Published var showingImporter: Bool`). Connect macOS Commands via `NotificationCenter.default.post(name: .importFile, object: nil)` observed in `ContentView`. Encode file bytes with `Data.base64EncodedString()` and post through `native:action` bridge message using the existing protocol.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SwiftUI | iOS 26.2 / macOS 26.2 (project target) | NavigationSplitView, toolbars, Commands, fileImporter | Native framework, no dependency |
| UniformTypeIdentifiers | System | UTType definitions for file picker | Required by fileImporter |
| AppKit (macOS only) | System | NSOpenPanel for macOS file picker | No SwiftUI open panel exists |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Foundation | System | Data(contentsOf:), base64EncodedString() | File byte reading |
| WebKit | System | evaluateJavaScript — sending native:action to NativeBridge | Already in use |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.fileImporter()` | UIDocumentPickerViewController (UIKit) | fileImporter is simpler SwiftUI API; UIKit approach needed only if fine-grained sheet control required |
| NotificationCenter for Commands→View | @FocusedObject | @FocusedObject cleaner but requires more boilerplate; NotificationCenter works with existing BridgeManager pattern |
| NSOpenPanel.runModal() | fileImporter on macOS too | fileImporter also works on macOS, but NSOpenPanel gives synchronous access without state management complexity |

**Installation:** No new packages — all standard Apple frameworks already linked.

---

## Architecture Patterns

### Recommended Project Structure

No new files required beyond restructuring existing ones. Files touched:

```
native/Isometry/Isometry/
├── ContentView.swift         ← Replace ZStack with NavigationSplitView; add fileImporter; sidebar
├── IsometryApp.swift         ← Add .commands { IsometryCommands() } modifier
├── BridgeManager.swift       ← Fill in native:action case; add @Published showingImporter
└── Assets.xcassets/
    ├── AppIcon.appiconset/   ← Add placeholder image files
    └── LaunchBackground.colorset/  ← New color asset for launch screen

src/native/NativeBridge.ts    ← Add native:action handler for file import
```

### Pattern 1: NavigationSplitView with Compact Fallback

**What:** On iPad/macOS, NavigationSplitView shows sidebar + detail. On iPhone (compact horizontal size class), NavigationSplitView collapses to stack — sidebar becomes a sheet/popover triggered by toolbar button.

**When to use:** Always — NavigationSplitView handles the size class collapse automatically; compact fallback via `@Environment(\.horizontalSizeClass)` guards the sidebar toggle button visibility.

**Example:**

```swift
// ContentView.swift — restructured
@State private var columnVisibility = NavigationSplitViewVisibility.detailOnly
@Environment(\.horizontalSizeClass) private var sizeClass

var body: some View {
    NavigationSplitView(columnVisibility: $columnVisibility) {
        // Sidebar: view switcher
        ViewSwitcherSidebar(selectedView: $selectedView)
            .navigationTitle("Views")
    } detail: {
        // Detail: web content + recovery overlay
        ZStack {
            WebViewContainer(webView: webView!)
                .ignoresSafeArea()
            if bridgeManager.showingRecoveryOverlay {
                recoveryOverlay
            }
        }
    }
    .toolbar {
        // Sidebar toggle — iPad/macOS only
        if sizeClass != .compact {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
                } label: {
                    Image(systemName: "sidebar.left")
                }
            }
        }
        // Import button
        ToolbarItem(placement: .navigationBarTrailing) {
            Button { bridgeManager.showingImporter = true } label: {
                Image(systemName: "square.and.arrow.down")
            }
        }
        // View picker (compact iPhone only)
        if sizeClass == .compact {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showingViewPicker = true } label: {
                    Image(systemName: "rectangle.3.group")
                }
            }
        }
    }
    .fileImporter(
        isPresented: $bridgeManager.showingImporter,
        allowedContentTypes: [.json, .plainText, .commaSeparatedText, .xlsx],
        allowsMultipleSelection: false
    ) { result in
        handleFileImport(result)
    }
}
```

### Pattern 2: fileImporter Security-Scoped Resource + Size Check

**What:** After fileImporter returns a URL, you must call `startAccessingSecurityScopedResource()` before reading, check size, read bytes, stop access. Use `defer` to guarantee cleanup.

**When to use:** Every time a file URL arrives from fileImporter or NSOpenPanel on macOS sandbox.

**Example:**

```swift
private func handleFileImport(_ result: Result<[URL], Error>) {
    switch result {
    case .failure(let error):
        print("[FileImport] Picker error: \(error)")
    case .success(let urls):
        guard let url = urls.first else { return }
        guard url.startAccessingSecurityScopedResource() else {
            print("[FileImport] Access denied to: \(url)")
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }
        importFile(at: url)
    }
}

private func importFile(at url: URL) {
    // Size check (FILE-04)
    let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
    let fileSize = resourceValues?.fileSize ?? 0
    let maxBytes = 50 * 1024 * 1024  // 50MB
    guard fileSize <= maxBytes else {
        showFileTooLargeAlert = true
        return
    }

    // Read bytes and encode
    guard let data = try? Data(contentsOf: url) else {
        print("[FileImport] Failed to read file: \(url)")
        return
    }

    let base64 = data.base64EncodedString()
    let ext = url.pathExtension.lowercased()
    let source = etlSource(for: ext)  // "json" | "markdown" | "csv" | "excel"
    let filename = url.lastPathComponent

    // Send via bridge (native:action)
    bridgeManager.sendFileImport(base64: base64, source: source, filename: filename)
}

private func etlSource(for ext: String) -> String {
    switch ext {
    case "json":           return "json"
    case "md", "txt":     return "markdown"
    case "csv":           return "csv"
    case "xlsx":          return "excel"
    default:              return "json"
    }
}
```

### Pattern 3: macOS NSOpenPanel (synchronous, no NSViewRepresentable)

**What:** NSOpenPanel is an NSPanel (a window), not a view — it can be called synchronously from any Swift context without wrapping in NSViewRepresentable.

**When to use:** macOS only, triggered from Commands menu item or toolbar button. On iOS use fileImporter exclusively.

**Example:**

```swift
#if os(macOS)
func showOpenPanel() {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = [.json, .plainText, .commaSeparatedText, .xlsx]
    panel.allowsMultipleSelection = false
    panel.canChooseFiles = true
    panel.canChooseDirectories = false

    guard panel.runModal() == .OK, let url = panel.url else { return }
    importFile(at: url)  // same importFile() as iOS path — no security scope needed on macOS
}
#endif
```

Note: On macOS, NSOpenPanel URLs do NOT require `startAccessingSecurityScopedResource()` — that is iOS/sandboxed-app-specific. macOS open panels grant access implicitly.

### Pattern 4: macOS Commands with NotificationCenter Bridge

**What:** SwiftUI Commands structs cannot access `@EnvironmentObject` or `@State` from ContentView. The canonical pattern is to post a Notification that ContentView or BridgeManager observes.

**When to use:** Any macOS menu item that needs to trigger view-layer behavior.

**Example:**

```swift
// Extension for notification name
extension Notification.Name {
    static let importFile = Notification.Name("works.isometry.importFile")
}

// IsometryApp.swift
struct IsometryApp: App {
    ...
    var body: some Scene {
        WindowGroup {
            ContentView(bridgeManager: bridgeManager)
        }
        #if os(macOS)
        .commands {
            IsometryCommands()
        }
        #endif
    }
}

// IsometryCommands.swift (macOS only)
#if os(macOS)
struct IsometryCommands: Commands {
    var body: some Commands {
        CommandGroup(after: .newItem) {
            Button("Import File...") {
                NotificationCenter.default.post(name: .importFile, object: nil)
            }
            .keyboardShortcut("I", modifiers: .command)
        }

        CommandGroup(replacing: .undoRedo) {
            Button("Undo") {
                NotificationCenter.default.post(name: .undo, object: nil)
            }
            .keyboardShortcut("Z", modifiers: .command)

            Button("Redo") {
                NotificationCenter.default.post(name: .redo, object: nil)
            }
            .keyboardShortcut("Z", modifiers: [.command, .shift])
        }
    }
}
#endif

// ContentView.swift — observe and respond
.onReceive(NotificationCenter.default.publisher(for: .importFile)) { _ in
    #if os(macOS)
    showOpenPanel()
    #else
    bridgeManager.showingImporter = true
    #endif
}
```

### Pattern 5: native:action Bridge Message for File Import

**What:** BridgeManager posts `native:action` with `{ kind: 'importFile', base64, source, filename }` payload. NativeBridge.ts receives it in the `native:action` case and routes to `WorkerBridge.importFile()`.

**When to use:** After Swift has read and validated the file bytes — this is the hand-off from Swift to the ETL pipeline.

**Swift side:**

```swift
// BridgeManager.swift — new method
func sendFileImport(base64: String, source: String, filename: String) {
    let js = """
    window.__isometry.receive({
      type: 'native:action',
      payload: {
        kind: 'importFile',
        base64: '\(base64)',
        source: '\(source)',
        filename: '\(filename)'
      }
    });
    """
    logger.info("Sending file import to JS: \(filename) (\(source))")
    Task {
        try? await webView?.evaluateJavaScript(js)
    }
}
```

**JS side (NativeBridge.ts update):**

```typescript
// In initNativeBridge, extend the receive handler:
case 'native:action': {
    const payload = message.payload as {
        kind: string;
        base64: string;
        source: string;
        filename: string;
    };
    if (payload.kind === 'importFile') {
        handleNativeFileImport(bridge, payload).catch(err =>
            console.error('[NativeBridge] File import failed:', err)
        );
    }
    break;
}

async function handleNativeFileImport(
    bridge: WorkerBridge,
    payload: { base64: string; source: string; filename: string }
): Promise<void> {
    // base64 is already the text content (for text files) or raw bytes (for xlsx)
    // WorkerBridge.importFile() accepts string data
    const result = await bridge.importFile(
        payload.source as SourceType,
        payload.base64,  // ETL parsers handle base64 decode internally for binary (xlsx)
        { filename: payload.filename }
    );
    console.log('[NativeBridge] File import complete:', result);
    // ImportToast handles progress display — no action needed here
}
```

**CRITICAL NOTE on base64 to ETL:** The existing `WorkerBridge.importFile(source, data, options)` takes `data` as a string. For text-based formats (json, markdown, csv), Swift should decode the file bytes to UTF-8 text first and send the text string (not base64). For xlsx (binary), base64 is appropriate. Check WorkerBridge.ts ETL handler to confirm what the `data` parameter expects per source type.

### Pattern 6: UTType Definitions

```swift
import UniformTypeIdentifiers

extension UTType {
    /// XLSX — Microsoft Excel Open XML Spreadsheet
    /// UTType.spreadsheet is the base type; xlsx uses the IANA identifier.
    static let xlsx = UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")
}

// Usage in fileImporter:
allowedContentTypes: [.json, .plainText, .commaSeparatedText, .xlsx]
```

Note: `.plainText` covers both `.md` and `.txt` extensions. `.commaSeparatedText` is the built-in Apple type for CSV. `.json` is a built-in type. `.xlsx` requires the custom extension above.

### Anti-Patterns to Avoid

- **Putting fileImporter on a Button**: Put `.fileImporter()` on the outermost container view (NavigationSplitView or ZStack), not on the Button that triggers it. The modifier only presents once, regardless of where it's attached.
- **Reading file bytes without security scope (iOS)**: Always call `startAccessingSecurityScopedResource()` before `Data(contentsOf:)` on iOS. Forgetting causes a silent empty Data result or access denied error.
- **String interpolating base64 in JS**: Large base64 strings inside `evaluateJavaScript` string interpolation can overflow. For files >1MB, use `postMessage` pattern (post via `nativeBridge.postMessage`) instead of `evaluateJavaScript`. Since we already have `native:action` going JS→Swift, invert: Swift evaluateJavaScript calls `window.__isometry.receive()` which is the established pattern (LaunchPayload uses this). Should be fine up to a few MB; test with 10MB xlsx files.
- **Calling NSOpenPanel on a background thread**: Must be called on main thread. The existing `@MainActor` on BridgeManager handles this.
- **Security scope on macOS**: NSOpenPanel on macOS does NOT need `startAccessingSecurityScopedResource()`. Only iOS/iPadOS requires this. Guard with `#if os(iOS)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker UI | Custom file browser | `.fileImporter()` / `NSOpenPanel` | System UI matches platform, handles iCloud Drive, Files app integration for free |
| UTType for xlsx | String-matching file extensions | `UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")` | System file picker uses UTTypes for filtering, not string matching |
| Binary data bridge transport | Custom encoding scheme | `Data.base64EncodedString()` + established bridge pattern | Already proven in LaunchPayload and checkpoint — no new pattern needed |
| Sidebar toggle animation | Custom animation | `columnVisibility` binding on NavigationSplitView | System handles animation, accessibility, keyboard shortcuts automatically |
| macOS menu keyboard shortcuts | `.keyboardShortcut()` in Commands | Same | Built-in, correct, handles focus management |

**Key insight:** Swift's job in this phase is minimal glue. System APIs handle file picking, security scoping, and data reading. The ETL pipeline is already built in TypeScript. Zero new parsing logic.

---

## Common Pitfalls

### Pitfall 1: String Interpolation Overflow for Large Base64 Payloads

**What goes wrong:** `evaluateJavaScript` with a string containing >5MB base64 data may fail silently or cause the WKWebView to reject the JS evaluation.

**Why it happens:** WKWebView has internal limits on evaluateJavaScript string length (undocumented, approximately 50MB but varies by OS). For large xlsx files (up to 50MB raw = ~67MB base64), this is a real risk.

**How to avoid:** For the 50MB cap, the base64-encoded payload will be up to ~67MB. Rather than embedding the full base64 in the JS string, consider chunking or using the existing `postMessage` direction. However, since our bridge sends Swift→JS via `evaluateJavaScript(window.__isometry.receive(...))`, and LaunchPayload already uses this pattern for the database, test with 10–20MB files first. If JS evaluation fails, switch to posting via `nativeBridge.postMessage` direction (JS→Swift is already that direction) — or split the payload into chunks.

**Warning signs:** `evaluateJavaScript` completion returns `nil` without error, or JS throws RangeError.

### Pitfall 2: fileImporter Not Triggering on macOS When .commands is Present

**What goes wrong:** On macOS, `.fileImporter()` sometimes fails to present when triggered from a Commands menu item via state mutation.

**Why it happens:** Commands execute outside the view hierarchy; state changes don't propagate correctly.

**How to avoid:** Use `NotificationCenter.default.post(name: .importFile, object: nil)` from Commands, received by `.onReceive` in ContentView, which then calls `NSOpenPanel.runModal()` directly. This completely bypasses the fileImporter state management problem on macOS.

### Pitfall 3: NavigationSplitView Interferes with WebView Safe Area Insets

**What goes wrong:** Adding NavigationSplitView changes the safe area insets that BridgeManager.sendLaunchPayload() reads from `webView?.safeAreaInsets`. The values may be stale or incorrect if read before the layout pass settles.

**Why it happens:** NavigationSplitView adds toolbar chrome that changes the safe area. The webView frame is set before the NavigationSplitView sidebar is measured.

**How to avoid:** CHRM-04 notes safe area insets are "already sent" — they are read from `webView.safeAreaInsets` at LaunchPayload send time. This should still be correct since `sendLaunchPayload()` runs after JS signals `native:ready`, which fires after the view is fully laid out. Validate by logging inset values in DEBUG builds.

### Pitfall 4: Security Scope Not Released on Error Path

**What goes wrong:** If the size check or byte reading throws, `stopAccessingSecurityScopedResource()` is never called, leaking kernel resources. After enough leaks, the app loses all sandbox bypass ability until restart.

**Why it happens:** Forgetting `defer` for cleanup.

**How to avoid:** Always use `defer { url.stopAccessingSecurityScopedResource() }` immediately after the `guard url.startAccessingSecurityScopedResource()` check. The `defer` runs even when early-return guards fire.

### Pitfall 5: WorkerBridge.importFile() Expects Text, Not Base64, for Text Formats

**What goes wrong:** Sending base64-encoded text to `WorkerBridge.importFile()` for JSON/CSV/Markdown causes the ETL parsers to fail — they expect decoded UTF-8 text strings, not base64.

**Why it happens:** Confusing the transport encoding with the payload format.

**How to avoid:** For text formats (json, markdown, csv): read `Data`, decode to `String(data: data, encoding: .utf8)`, send the text string. For xlsx (binary): send base64-encoded bytes. Check `WorkerBridge.ts` `importFile()` signature — the `data: string` parameter is the actual file content for text parsers. Only xlsx receives base64 for binary-to-text decoding on the Worker side.

### Pitfall 6: UTType.xlsx May Not Exist on Older OS

**What goes wrong:** `UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")` returns a non-nil value on all OS versions (importedAs always succeeds), but the system file picker may not filter correctly if the UTType is not in the system's type database.

**Why it happens:** UTType conformance data is populated from installed apps; on a device with no Office apps, xlsx may not be registered.

**How to avoid:** Use `UTType(filenameExtension: "xlsx") ?? UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")` as the fallback chain. This ensures extension-based filtering works even without Office installed.

---

## Code Examples

Verified patterns from official sources and the existing codebase:

### Complete fileImporter Trigger + Security Scope Pattern

```swift
// Source: serialcoder.dev + Apple Developer Forums thread/688402

@State private var showingImporter = false
@State private var showingFileTooLargeAlert = false

// Modifier on container view:
.fileImporter(
    isPresented: $showingImporter,
    allowedContentTypes: [.json, .plainText, .commaSeparatedText, .xlsx],
    allowsMultipleSelection: false
) { result in
    switch result {
    case .failure(let error):
        print("[FileImport] \(error)")
    case .success(let urls):
        guard let url = urls.first else { return }
        #if os(iOS)
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        #endif
        processImportedFile(url: url)
    }
}
.alert("File Too Large", isPresented: $showingFileTooLargeAlert) {
    Button("OK", role: .cancel) {}
} message: {
    Text("Please select a file smaller than 50 MB.")
}
```

### NavigationSplitView Sidebar Collapse Pattern

```swift
// Source: nilcoalescing.com/blog/ProgrammaticallyHideAndShowSidebarInSplitView/

@State private var columnVisibility = NavigationSplitViewVisibility.detailOnly

NavigationSplitView(columnVisibility: $columnVisibility) {
    sidebarContent
} detail: {
    detailContent
}

// Toggle:
columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
```

### macOS Commands with NotificationCenter

```swift
// Source: research synthesis from hackingwithswift.com forums + serialcoder.dev

extension Notification.Name {
    static let importFile = Notification.Name("works.isometry.importFile")
}

// In Commands struct:
Button("Import File...") {
    NotificationCenter.default.post(name: .importFile, object: nil)
}
.keyboardShortcut("I", modifiers: .command)

// In ContentView:
.onReceive(NotificationCenter.default.publisher(for: .importFile)) { _ in
    #if os(macOS)
    showOpenPanel()
    #else
    showingImporter = true
    #endif
}
```

### File Size Check via URLResourceValues

```swift
// Source: Foundation URLResourceValues API

let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
let fileSize = resourceValues?.fileSize ?? 0
let maxBytes = 50 * 1024 * 1024  // 50 MB
guard fileSize <= maxBytes else {
    showingFileTooLargeAlert = true
    return
}
```

### Text File: Decode to String Before Bridge

```swift
// For JSON, CSV, Markdown — ETL parsers expect UTF-8 text
guard let data = try? Data(contentsOf: url),
      let text = String(data: data, encoding: .utf8) else {
    print("[FileImport] Failed to decode as UTF-8")
    return
}
// Send text string to bridge

// For XLSX — ETL parser expects base64-encoded binary
guard let data = try? Data(contentsOf: url) else { return }
let base64 = data.base64EncodedString()
// Send base64 to bridge
```

### App Icon Placeholder (Swift/Xcode approach)

The `AppIcon.appiconset/Contents.json` already exists with correct entries for iOS (1024x1024) and macOS (16–512@2x). Only the actual image files are missing. For a placeholder, add a simple solid-color PNG (e.g., a 1024x1024 dark gray square) as `AppIcon.png`, `AppIcon-mac.png`, etc., and reference them in `Contents.json`.

### Launch Screen via UILaunchScreen Info.plist Key

```xml
<!-- Info.plist addition -->
<key>UILaunchScreen</key>
<dict>
    <key>UIColorName</key>
    <string>LaunchBackground</string>
</dict>
```

Add a `LaunchBackground` Color Set in `Assets.xcassets` matching the web runtime's background color. The web runtime uses a dark background (~`#1a1a2e` or similar) — check the CSS `body { background-color }` in the built bundle.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UIDocumentPickerViewController (UIKit) | `.fileImporter()` (SwiftUI) | iOS 14 / macOS 12 | Single modifier, no UIKit wrapper needed |
| NavigationView with split behavior | NavigationSplitView | iOS 16 / macOS 13 | Explicit column control, `columnVisibility` binding |
| Direct @State access from Commands | @FocusedObject / NotificationCenter | iOS 14 (Commands added) | Commands are not in view hierarchy; must bridge via notification or focus system |
| Launch screen storyboard | UILaunchScreen Info.plist key | iOS 14 | Simpler, no IB required |

**Deprecated/outdated:**
- `allowedFileTypes: [String]` on NSOpenPanel: replaced by `allowedContentTypes: [UTType]` in macOS 12+. Use UTType array — the project targets macOS 26.2.
- `@State var showSidebar` + custom toggle: replaced by `NavigationSplitViewVisibility` binding on NavigationSplitView.

---

## Open Questions

1. **WorkerBridge.importFile() data format for xlsx**
   - What we know: `WorkerBridge.importFile(source, data, options)` — `data: string`
   - What's unclear: Does the Excel ETL parser in the Worker expect base64 or a different encoding for binary xlsx data?
   - Recommendation: Read `src/worker/ETLWorker.ts` or the excel parser to confirm. If it expects raw binary as a typed array, the Swift side needs to chunk-post or use a different transport. Most likely it expects base64 since the bridge already uses that convention.

2. **evaluateJavaScript size limit for 50MB xlsx files**
   - What we know: Base64 of 50MB = ~67MB JS string. WKWebView has undocumented size limits.
   - What's unclear: Whether 67MB string in evaluateJavaScript succeeds on all OS versions.
   - Recommendation: Test with a 30–50MB xlsx file during development. If it fails, implement chunked posting: Swift posts the base64 in 1MB chunks via separate evaluateJavaScript calls, JS reassembles. This is a fallback only — test first.

3. **Undo/Redo — does the web runtime have an undo stack?**
   - What we know: The web runtime has D3-based data management; TDD-built mutation pipeline.
   - What's unclear: Whether `WorkerBridge` exposes an undo/redo operation.
   - Recommendation: Search `src/` for "undo" before deciding. If none exists, stub Undo/Redo menu items as disabled buttons (no-op). If a stack exists, route via `evaluateJavaScript("window.__isometry.undo()")` or a new `native:action` kind.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in config.json (only `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `workflow.auto_advance`) — this section is included based on the verifier being enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Swift Testing (`import Testing`) — already in use (BridgeManagerTests.swift) |
| Config file | None — Swift Testing is built into Xcode |
| Quick run command | `xcodebuild test -project native/Isometry/Isometry.xcodeproj -scheme Isometry -destination 'platform=macOS'` |
| Full suite command | Same — run on both macOS and iOS Simulator |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHRM-01 | NavigationSplitView renders sidebar in regular size class | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| CHRM-02 | Toolbar items appear on correct platforms | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| CHRM-03 | macOS Commands struct registered; Cmd+I posts notification | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| CHRM-04 | LaunchPayload safe area insets survive NavigationSplitView restructure | Integration | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| CHRM-05 | App icon asset entries present; launch screen color asset present | Manual | Visual check in Xcode | ❌ Wave 0 |
| FILE-01 | showingImporter state triggers correctly on all platforms | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| FILE-02 | UTType array includes all 4 types (json, plainText, commaSeparatedText, xlsx) | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| FILE-03 | sendFileImport() posts correct native:action JS string | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |
| FILE-04 | Files >50MB rejected with alert; files <=50MB proceed | Unit | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |

Note: CHRM-05 (app icon + launch screen) is manual-only — visual assets cannot be unit tested.

### Wave 0 Gaps

- [ ] `IsometryTests/ContentViewTests.swift` — CHRM-01, CHRM-02, CHRM-04
- [ ] `IsometryTests/FileImportTests.swift` — FILE-01, FILE-02, FILE-03, FILE-04
- [ ] `IsometryTests/CommandsTests.swift` — CHRM-03 (NotificationCenter posting)

---

## Sources

### Primary (HIGH confidence)

- Apple Developer Documentation (fetched via WebFetch) — NavigationSplitView, fileImporter, UTType, NSOpenPanel
- [serialcoder.dev — fileImporter tutorial](https://serialcoder.dev/text-tutorials/swiftui/the-file-importer-in-swiftui/) — security scope pattern, fileImporter code
- [nilcoalescing.com — NavigationSplitView programmatic hide/show](https://nilcoalescing.com/blog/ProgrammaticallyHideAndShowSidebarInSplitView/) — columnVisibility binding pattern
- [serialcoder.dev — NSOpenPanel in SwiftUI macOS](https://serialcoder.dev/text-tutorials/macos-tutorials/save-and-open-panels-in-swiftui-based-macos-apps/) — NSOpenPanel.runModal() pattern
- [avanderlee.com — Launch screen options](https://www.avanderlee.com/xcode/launch-screen/) — UILaunchScreen Info.plist key
- [Apple Dev Forums thread/688402 — Custom UTType for xlsx](https://developer.apple.com/forums/thread/688402) — UTType(importedAs:) for xlsx
- Existing codebase: `BridgeManager.swift`, `NativeBridge.ts`, `WorkerBridge.ts`, `ContentView.swift` — integration points confirmed by direct file reading

### Secondary (MEDIUM confidence)

- [hackingwithswift.com — fileImporter from macOS File menu](https://www.hackingwithswift.com/forums/swiftui/fileexporter-fileimporter-from-macos-file-menu/10532) — Commands limitation and NotificationCenter workaround
- WebSearch results for NavigationSplitView compact column behavior — corroborates columnVisibility API
- WebSearch results for UTType xlsx identifiers — `org.openxmlformats.spreadsheetml.sheet` corroborated by multiple sources

### Tertiary (LOW confidence)

- evaluateJavaScript size limit for large base64 payloads — mentioned in community discussion, not officially documented; flagged as open question

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are system frameworks, confirmed in official documentation and existing codebase
- Architecture: HIGH — patterns verified from official docs and existing Phase 12 code; Commands/NotificationCenter pattern is well-established workaround
- Pitfalls: HIGH for security scope and text vs binary encoding; MEDIUM for evaluateJavaScript size limits (undocumented)

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (stable Apple APIs — 90 days)
