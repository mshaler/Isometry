# Architecture Research

**Domain:** Native Swift shell hosting an existing TypeScript/D3.js web runtime in WKWebView with hybrid SQLite persistence (Isometry v2.0 milestone)
**Researched:** 2026-03-01
**Confidence:** HIGH for integration patterns and build pipeline; MEDIUM for hybrid data layer sync timing (no known prior art for exactly this sql.js + native SQLite pairing)

> **Note:** This document supersedes the v1.1 ARCHITECTURE.md for the v2.0 milestone. The v1.1 document (covering ETL pipeline) remains valid for context — those components are not modified by the native shell work. This document covers only new components and the integration points with the existing v1.1 web runtime architecture.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Native SwiftUI Shell                                  │
│                                                                                  │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  NavigationSplitView │  │  Toolbar (native) │  │  UIDocumentPicker /      │   │
│  │  sidebar (SwiftUI)   │  │  macOS / iOS      │  │  NSOpenPanel (ETL entry) │   │
│  └──────────────┬───────┘  └──────────┬────────┘  └─────────────┬────────────┘   │
│                 │                     │                          │               │
│  ┌──────────────┴─────────────────────┴──────────────────────────┴────────────┐  │
│  │                         NativeBridge (Swift)                               │  │
│  │  WKScriptMessageHandlerWithReply  •  evaluateJavaScript  •  actor-safe     │  │
│  └──────────────────────────────────────────────────────────────────────────┬─┘  │
│                                                                             │    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │                      WKWebView                                        │   │    │
│  │  (loaded via WKURLSchemeHandler serving Vite dist/ bundle)           │   │    │
│  └──────────────────────────────────────────────────────────────────────┘   │    │
│                                                                             │    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │    │
│  │                IsometryDatabase (Swift Actor)                         │   │    │
│  │  Persistent SQLite  •  WAL mode  •  FTS5  •  CloudKit sync queue     │◄──┘    │
│  └──────────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         │  WKURLSchemeHandler ("app://")
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Web Runtime (in WKWebView)                          │
│                                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  D3.js Views  │  │  Providers    │  │  UI / Events    │  │  NativeBridge   │ │
│  │  (rendering)  │  │  (SQL state)  │  │  (no file pick) │  │  JS client      │ │
│  └───────────────┘  └───────────────┘  └─────────────────┘  └────────┬────────┘ │
│                                                                        │         │
│               postMessage (structured clone / transferable)            │         │
│                                                                        ▼         │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Web Worker                                              │  │
│  │  Message Router → handlers (cards, connections, search, graph, ETL)       │  │
│  │                                                                            │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                  sql.js (WASM in-memory database)                    │  │  │
│  │  │  cards  connections  cards_fts  ui_state  import_history  sources    │  │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### The Two Databases

The v2.0 architecture has **two SQLite databases with distinct roles**:

| Database | Location | Owner | Purpose |
|----------|----------|-------|---------|
| `sql.js` | WASM heap (in-memory) | Web Worker | Query execution, D3 rendering, ETL pipeline, FTS5 search |
| `IsometryDatabase.sqlite` | `Documents/` (persistent) | Swift Actor | Durable storage, CloudKit sync source of truth |

The in-memory sql.js database is the **working copy**. The native SQLite file is the **persistent record**. The bridge between them is a serialized `ArrayBuffer` (the raw SQLite file bytes), exported from sql.js and written to disk by Swift — or loaded from disk by Swift and injected into the Worker on startup.

---

## Component Responsibilities

| Component | Location | Responsibility | Status |
|-----------|----------|----------------|--------|
| `SwiftUIApp` | Native | Entry point; configures WKWebView, registers `NativeBridge`, starts `IsometryDatabase` actor | **New** |
| `ContentView` | Native | `NavigationSplitView` shell; sidebar items, toolbar buttons, `WebViewContainer` as detail | **New** |
| `WebViewContainer` | Native | `UIViewRepresentable` / `NSViewRepresentable` wrapping WKWebView; owns WKWebViewConfiguration | **New** |
| `AssetsSchemeHandler` | Native | `WKURLSchemeHandler` serving Vite `dist/` bundle; maps `app://localhost/` to bundle resources; injects correct MIME types (including `application/wasm`) | **New** |
| `NativeBridge` (Swift) | Native | `WKScriptMessageHandlerWithReply`; receives typed messages from JS; dispatches to `IsometryDatabase`, `UIDocumentPicker`, `Keychain`; sends responses back via reply handler | **New** |
| `IsometryDatabase` | Native | `actor`; persistent SQLite via `SQLite3` C API; WAL mode; FTS5; schema mirrors sql.js schema; CloudKit sync queue; exports `db.sqlite` bytes on demand | **New** |
| `CloudKitSyncManager` | Native | `actor`; bidirectional sync; change tokens; conflict resolution; triggered by D-010 dirty flag on app background/foreground | **New** |
| `NativeBridge` (JS client) | Web | TypeScript module in main thread; `window.webkit.messageHandlers[*].postMessage`; request-response correlation with UUID; sends `native:*` typed messages; exposes `onNativeMessage` callback | **New** |
| `WorkerBridge` | Web | **Unchanged** — existing typed RPC; `db:export` method added to request native persistence | **Modified (one method)** |
| `worker.ts` router | Web Worker | **Unchanged** — `db:export` handler already exists; no new cases needed for v2.0 | **Unchanged** |
| All ETL handlers | Web Worker | **Unchanged** | **Unchanged** |
| All D3 views | Web | **Unchanged** | **Unchanged** |
| All Providers | Web | **Unchanged** | **Unchanged** |

---

## Recommended Project Structure

```
Isometry/                           # Existing TypeScript project root
├── src/                            # Unchanged web runtime
├── tests/                          # Unchanged web tests
├── vite.config.ts                  # Modified: base: './' for relative asset paths
├── package.json                    # Modified: add "build:native" script
│
├── IsometryApp/                    # NEW: Xcode project / Swift Package root
│   ├── IsometryApp.xcodeproj
│   ├── Sources/
│   │   └── IsometryApp/
│   │       ├── App/
│   │       │   ├── IsometryApp.swift           # @main entry point
│   │       │   ├── ContentView.swift           # NavigationSplitView shell
│   │       │   └── WebViewContainer.swift      # UIViewRepresentable wrapper
│   │       ├── Bridge/
│   │       │   ├── NativeBridge.swift          # WKScriptMessageHandlerWithReply
│   │       │   ├── BridgeMessage.swift         # Codable message/response types
│   │       │   └── AssetsSchemeHandler.swift   # WKURLSchemeHandler for dist/
│   │       ├── Database/
│   │       │   ├── IsometryDatabase.swift      # Actor-based SQLite wrapper
│   │       │   ├── DatabaseSchema.swift        # Schema init SQL (mirrors web schema)
│   │       │   ├── RowDecoder.swift            # SQLite row → Swift struct
│   │       │   └── DatabaseError.swift         # Typed error enum
│   │       ├── Sync/
│   │       │   ├── CloudKitSyncManager.swift   # Bidirectional CK sync
│   │       │   └── ConflictResolver.swift      # Last-write-wins + field merge
│   │       └── UI/
│   │           ├── SidebarView.swift           # Navigation items
│   │           ├── ToolbarView.swift           # Native toolbar actions
│   │           └── SyncStatusView.swift        # CloudKit sync indicator
│   ├── Resources/
│   │   └── WebBundle/              # Vite dist/ output (copied by build script)
│   │       ├── index.html
│   │       ├── assets/
│   │       │   ├── index-[hash].js
│   │       │   ├── index-[hash].css
│   │       │   └── sql-wasm.wasm
│   │       └── ...
│   └── Scripts/
│       └── build-web.sh            # Run Vite build, copy dist/ → Resources/WebBundle/
│
└── src/
    ├── bridge/
    │   └── NativeBridgeClient.ts   # NEW: JS-side native bridge (main thread only)
    └── worker/
        └── WorkerBridge.ts         # Modified: add requestNativePersist() method
```

### Structure Rationale

- **`IsometryApp/` at project root** — keeps Swift and TypeScript projects co-located in a single git repo without coupling their toolchains. The Xcode project is a sibling to the npm project, not nested inside `src/`.
- **`Resources/WebBundle/`** — the Vite build output is a static snapshot embedded in the app bundle. The `build-web.sh` script runs `npm run build` and copies `dist/` here before every Xcode build. Xcode treats the folder as a resource bundle item.
- **`Bridge/` Swift package** — groups the two halves of the native bridge: the `WKURLSchemeHandler` (file serving) and the `WKScriptMessageHandlerWithReply` (message routing). These are tightly coupled — both attach to the same `WKWebViewConfiguration`.
- **`src/bridge/NativeBridgeClient.ts`** — new TypeScript file that lives alongside existing `src/worker/WorkerBridge.ts`. It runs on the main thread (not in the Worker) and handles `window.webkit.messageHandlers.*` communication. The existing `WorkerBridge` is unchanged.

---

## Architectural Patterns

### Pattern 1: WKURLSchemeHandler for WASM-Safe Asset Serving

**What:** Register a custom URL scheme (`app://`) with WKWebView that intercepts all asset requests and returns file data from the embedded `Resources/WebBundle/` directory. This scheme handler must explicitly set the MIME type for `.wasm` files to `application/wasm` because `UTType` on macOS/iOS returns `application/octet-stream` for unknown extensions — and WebKit rejects WASM files that lack the correct MIME type.

**Why:** WKWebView cannot use `file://` URLs to load WASM with `fetch()` (CORS restrictions). Serving from `http://` or `https://` requires a local web server. A custom scheme handler is the clean solution: it runs in-process, requires no server, and gives full control over response headers including MIME type.

**When to use:** This is the only viable approach for this project. The `file://` workaround (overriding `fetch` with `XMLHttpRequest`) would require modifying the web runtime. The scheme handler approach is transparent to the TypeScript code.

**Trade-offs:** The custom scheme is not a "secure context" by default. WKWebView may refuse SharedArrayBuffer (required for WASM threads) unless the scheme is marked as secure. On iOS 16.4+ and macOS 13.3+, use `WKWebViewConfiguration.defaultWebpagePreferences` to enable secure context for custom schemes. For this project (sql.js uses single-threaded WASM), this is not an immediate blocker.

**Example:**

```swift
// AssetsSchemeHandler.swift
import Foundation
import UniformTypeIdentifiers
import WebKit

final class AssetsSchemeHandler: NSObject, WKURLSchemeHandler {

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL)); return
        }

        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let resourcePath = path.isEmpty ? "index.html" : path

        guard let bundleURL = Bundle.main.url(
            forResource: nil, withExtension: nil,
            subdirectory: "WebBundle"
        )?.appendingPathComponent(resourcePath),
        let data = try? Data(contentsOf: bundleURL) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }

        let mimeType = Self.mimeType(for: url)
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": "\(data.count)",
                // WASM requires cross-origin isolation for SharedArrayBuffer
                // sql.js uses single-threaded WASM so these are not required for v2.0
                // "Cross-Origin-Opener-Policy": "same-origin",
                // "Cross-Origin-Embedder-Policy": "require-corp",
            ]
        )!

        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    static func mimeType(for url: URL) -> String {
        // Explicit WASM override — UTType returns application/octet-stream for .wasm
        if url.pathExtension == "wasm" { return "application/wasm" }

        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }
}

// Registration in WebViewContainer.swift
let config = WKWebViewConfiguration()
config.setURLSchemeHandler(AssetsSchemeHandler(), forURLScheme: "app")
let webView = WKWebView(frame: .zero, configuration: config)
webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
```

---

### Pattern 2: NativeBridge — Request/Response Over WKScriptMessageHandlerWithReply

**What:** A typed bidirectional bridge between the TypeScript main thread and Swift native code. JavaScript calls `window.webkit.messageHandlers.native.postMessage(message)` and receives a Promise that Swift resolves asynchronously via `WKScriptMessageHandlerWithReply`. Swift calls `webView.evaluateJavaScript(...)` for native-initiated events (e.g., "database loaded from disk").

**Why `WKScriptMessageHandlerWithReply`:** The older `WKScriptMessageHandler` is fire-and-forget — Swift cannot return a value to the JS call site. The `WithReply` variant (iOS 14+, macOS 11+) returns a Promise to the JavaScript caller, eliminating the need for manual request-ID-to-callback bookkeeping on the JS side.

**How it complements the existing Worker Bridge:** The existing `WorkerBridge` handles JS main thread ↔ Web Worker communication (same-process). The `NativeBridge` handles JS main thread ↔ Swift communication (cross-process, via WKWebView IPC). The two bridges are parallel, not nested. The Worker never communicates with Swift directly.

**Message protocol — new `native:*` namespace:**

```typescript
// src/bridge/NativeBridgeClient.ts (NEW — main thread only, never imported in Worker)

export type NativeMessageType =
  | 'native:persist'        // JS → Swift: save current db state to disk
  | 'native:load'           // Swift → JS: inject db bytes on startup
  | 'native:filePicker'     // JS → Swift: open native file picker
  | 'native:filePickerResult' // Swift → JS: file bytes back to Worker
  | 'native:syncStatus'     // Swift → JS: CloudKit sync state change
  | 'native:getKeychain'    // JS → Swift: retrieve stored credential
  | 'native:setKeychain';   // JS → Swift: store credential

export interface NativeRequest {
  id: string;               // UUID — correlates response
  type: NativeMessageType;
  payload: unknown;
}

export interface NativeResponse {
  id: string;
  status: 'ok' | 'error';
  payload: unknown;
}
```

```swift
// NativeBridge.swift
import WebKit

actor NativeBridge: NSObject, WKScriptMessageHandlerWithReply {

    private weak var webView: WKWebView?
    private let database: IsometryDatabase

    init(webView: WKWebView, database: IsometryDatabase) {
        self.webView = webView
        self.database = database
    }

    // Called on arbitrary thread — use MainActor.assumeIsolated carefully
    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard let body = message.body as? [String: Any],
              let typeStr = body["type"] as? String,
              let id = body["id"] as? String else {
            replyHandler(nil, "Invalid message format")
            return
        }

        Task {
            do {
                let result = try await dispatch(type: typeStr, id: id, payload: body["payload"])
                replyHandler(result, nil)
            } catch {
                replyHandler(nil, error.localizedDescription)
            }
        }
    }

    private func dispatch(type: String, id: String, payload: Any?) async throws -> Any? {
        switch type {
        case "native:persist":
            return try await handlePersist(payload: payload)
        case "native:filePicker":
            return try await handleFilePicker(payload: payload)
        case "native:getKeychain":
            return try await handleGetKeychain(payload: payload)
        case "native:setKeychain":
            return try await handleSetKeychain(payload: payload)
        default:
            throw BridgeError.unknownMessageType(type)
        }
    }
}
```

---

### Pattern 3: Hybrid Data Layer — Startup Hydration and Persistence Flow

**What:** On startup, Swift loads the SQLite file from disk (if it exists) and injects the raw bytes into the Web Worker via `db:import`. On mutation events, the web runtime periodically exports the sql.js database as an `ArrayBuffer` and sends it to Swift for native persistence. Swift writes it to disk and queues it for CloudKit sync.

**This is the critical integration decision.** There are two possible architectures:

**Option A: sql.js as source of truth, native SQLite as write-through cache (RECOMMENDED)**

- sql.js in the Worker is the working database (queries, ETL, search)
- On `db:export`, worker serializes database as `ArrayBuffer` → sent to Swift
- Swift writes bytes to `IsometryDatabase.sqlite` using raw `Data.write(to:)`
- Swift reads from native SQLite *only* for CloudKit sync (extracting changed records)
- On app launch, Swift reads `IsometryDatabase.sqlite` → injects `ArrayBuffer` into Worker via `db:import`
- **Benefit:** Zero schema duplication; no ORM required; sql.js schema is the single schema
- **Risk:** Native SQLite is always slightly behind the in-memory state (export is debounced)

**Option B: Native SQLite as source of truth, sql.js as read cache (NOT recommended)**

- Native SQLite is the persistent record; sql.js is populated by querying native SQLite
- Every mutation goes: JS → bridge → Swift actor → SQLite → export rows → Worker
- **Problem:** All existing Provider/MutationManager/WorkerBridge patterns are built around sql.js being the authority. This would require a fundamental rewrite of the mutation path.

**Option A is the locked recommendation.** The existing `db:export` message type already handles Worker-to-main-thread byte serialization. The only new work is the Swift persistence layer.

**Data flow — startup hydration:**

```
App launch
    │
    ▼
Swift: IsometryDatabase.load()
    │   reads Documents/isometry.db → Data (may be empty on first launch)
    ▼
Swift evaluateJavaScript("window.__injectDatabase(base64)")
    │
    ▼
JS main thread: NativeBridgeClient.onDatabaseReady(base64)
    │   atob(base64) → ArrayBuffer
    ▼
WorkerBridge.importDatabase(arrayBuffer)
    │   postMessage({ type: 'db:import', payload: buffer }, [buffer])
    ▼
Web Worker: handleImport → close existing db → new SQL.Database(bytes)
    │
    ▼
WorkerBridge.init() triggered (or via init queue replay)
    │   initializes schema if first launch (empty db)
    ▼
Providers re-query → D3 views render
```

**Data flow — persistence (export-on-mutation):**

```
User mutates data (card create/update/delete)
    │
    ▼
MutationManager executes command → WorkerBridge.exec()
    │
    ▼
Web Worker writes to sql.js database
    │
    ▼
MutationManager post-mutation callback (existing rAF-batched notification)
    │   NEW: after notification cycle, debounce trigger fires
    ▼
NativeBridgeClient.requestPersist()   [debounced, 2-second window]
    │   calls window.webkit.messageHandlers.native.postMessage({type:'native:persist'})
    ▼
WorkerBridge.exportDatabase() → ArrayBuffer
    │   postMessage({ type: 'db:export' })
    ▼
Web Worker: db.export() → Uint8Array → ArrayBuffer (transferred)
    │
    ▼
NativeBridge.handlePersist(base64)   [Swift receives base64-encoded bytes]
    │   Data(base64Encoded: base64) → write to Documents/isometry.db
    │   Mark CloudKit sync as dirty (D-010 pattern)
    ▼
CloudKitSyncManager queues sync (on app background or explicit trigger)
```

**Important constraint:** The `ArrayBuffer` transfer from Web Worker to main thread uses the Transferable interface (zero-copy). The main thread then base64-encodes the bytes before passing to Swift via `evaluateJavaScript`, because `WKScriptMessageHandler` cannot receive raw `ArrayBuffer` — only JSON-serializable types. A 50MB database serialized as base64 is ~67MB of string — this is a one-time startup cost and a debounced background export, not a hot path.

---

### Pattern 4: Native File Picker for ETL Imports

**What:** The web runtime cannot open native file pickers from inside WKWebView (WKWebView's `<input type="file">` is intentionally blocked in native-hosted web views). Instead, the SwiftUI toolbar provides a native "Import" button that opens `UIDocumentPickerViewController` (iOS) or `NSOpenPanel` (macOS). The selected file is read by Swift, base64-encoded, and sent to the Web Worker via the Native Bridge → WorkerBridge `etl:import` route.

**Why:** Native file pickers give access to Files app, iCloud Drive, third-party document providers, and security-scoped bookmarks. WKWebView's web file picker is limited to the browser's sandboxed file access.

**Data flow — ETL file import:**

```
User taps "Import" in native toolbar
    │
    ▼
SwiftUI: UIDocumentPickerViewController.present()  [iOS]
         NSOpenPanel.beginSheet()                  [macOS]
    │
    ▼
User selects file → Swift receives security-scoped URL
    │   url.startAccessingSecurityScopedResource()
    │   let data = try Data(contentsOf: url)
    │   url.stopAccessingSecurityScopedResource()
    │   let base64 = data.base64EncodedString()
    │   let source = detectSource(url.pathExtension)
    ▼
NativeBridge.sendToWeb("native:filePickerResult", {source, data: base64, filename})
    │   evaluateJavaScript("window.handleNativeMessage(...)")
    ▼
NativeBridgeClient.onNativeMessage → decode base64 → ArrayBuffer
    │
    ▼
WorkerBridge.importFile(arrayBuffer, source)   [existing ETL pipeline]
    │   postMessage({ type: 'etl:import', payload }) with Transferable
    ▼
Worker: ImportOrchestrator → parsers → DedupEngine → SQLiteWriter → CatalogWriter
    │
    ▼
ImportResult → WorkerBridge resolves → NativeBridgeClient receives result
    │
    ▼
Post-import persistence trigger fires (same as mutation path above)
```

**File size concern:** Apple Notes exports (`.alto` zip or folder structure) can be hundreds of MB. For large imports, the base64 path (Swift → WKWebView → Worker) creates memory pressure. For v2.0, cap native file picker imports at ~50MB with a UI warning. Future optimization: write large files to a temp path and have the Worker read via OPFS or a special `app://` asset URL.

---

### Pattern 5: SwiftUI Shell — Native/Web Boundary

**Where SwiftUI ends and WKWebView begins:**

```
SwiftUI territory:
  ├── App-level navigation (NavigationSplitView)
  ├── Sidebar: database selector, settings, sync status indicator
  ├── Toolbar: Import button, Export button, CloudKit sync status
  ├── Modal sheets: Settings, About, Import progress (for large files)
  └── Menu bar (macOS): File > Import, Edit, View menus

WKWebView territory (the "detail" column of NavigationSplitView):
  ├── All nine D3 views (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid)
  ├── View switching, PAFV controls, filter UI
  ├── Card creation/editing inline (via existing MutationManager)
  ├── ETL import progress toast (ImportToast component — already built in v1.1)
  └── Search UI
```

**Event routing — SwiftUI to Web:**

| Native Event | Swift Action | Web Effect |
|-------------|-------------|------------|
| Import button tap | UIDocumentPickerViewController | File bytes → Worker ETL |
| Export button tap | `evaluateJavaScript("window.triggerExport()")` | ExportOrchestrator → file save |
| Sync status change | `evaluateJavaScript("window.handleNativeMessage({type:'native:syncStatus', ...})")` | Status indicator update |
| Sidebar view selection | `evaluateJavaScript("window.navigateTo('{viewName}')")` | View switch in D3 runtime |
| App will enter background | `NativeBridgeClient.requestPersist()` triggered immediately | db:export → Swift writes to disk |

**Event routing — Web to Swift:**

| Web Event | JS Action | Swift Effect |
|-----------|-----------|-------------|
| Data mutation (debounced) | `NativeBridgeClient.requestPersist()` | IsometryDatabase writes SQLite file |
| ETL import complete | Auto-triggers persist | SQLite file updated |
| Credential request | `native:getKeychain` | Keychain lookup returns token |
| Credential store | `native:setKeychain` | Keychain write (not SQLite — D-007) |

---

## Data Flow

### Startup Sequence

```
App launch
  │
  ├─ 1. SwiftUI ContentView appears
  │
  ├─ 2. WebViewContainer creates WKWebView with:
  │       AssetsSchemeHandler registered for "app://"
  │       NativeBridge registered as WKScriptMessageHandlerWithReply
  │       WKWebView loads app://localhost/index.html
  │
  ├─ 3. IsometryDatabase.initialize() (async, parallel)
  │       Opens/creates Documents/isometry.db
  │       Applies WAL + foreign keys PRAGMAs
  │
  ├─ 4. Web runtime bootstraps:
  │       index.html → main.js → WorkerBridge.init() queued
  │       NativeBridgeClient registers onDatabaseReady handler
  │       JS posts "native:ready" to Swift
  │
  ├─ 5. NativeBridge receives "native:ready"
  │       Reads isometry.db → base64
  │       evaluateJavaScript("window.__injectDatabase(base64)")
  │
  ├─ 6. NativeBridgeClient receives injected bytes
  │       base64 → ArrayBuffer → WorkerBridge.importDatabase(buffer)
  │
  ├─ 7. Worker: db:import → sql.js loaded from bytes
  │       WorkerBridge.init() dequeued (schema migration if needed)
  │
  └─ 8. Providers requery → D3 views render with loaded data
```

### Mutation → Persistence Loop

```
[User edits card in D3 view]
  │
  ▼
MutationManager.exec(command)
  │
  ├─ WorkerBridge.exec(sql, params)  [existing path — unchanged]
  │
  ├─ rAF notification → Providers requery → views rerender  [existing path — unchanged]
  │
  └─ NEW: debounce timer (2s) fires → NativeBridgeClient.requestPersist()
              │
              ▼
          WorkerBridge.exportDatabase() → ArrayBuffer
              │
              ▼
          NativeBridge receives base64 bytes
              │
              ▼
          IsometryDatabase.persist(data: Data)
              │   writes Documents/isometry.db
              │   marks CloudKit dirty flag
              ▼
          CloudKitSyncManager queues (triggers on app background)
```

### CloudKit Sync (background)

```
App enters background  OR  explicit sync trigger
  │
  ▼
CloudKitSyncManager.sync()
  │
  ├─ Pull: fetchRecordZoneChanges(changeToken)
  │       for each changed CKRecord:
  │         IsometryDatabase.upsertFromCloud(record)
  │
  ├─ Resolve conflicts: ConflictResolver.resolve(local, remote)
  │                     last-write-wins on modified_at
  │
  ├─ Push: IsometryDatabase.getPendingSync()
  │         for each dirty record:
  │           CKRecord from row → container.privateCloudDatabase.save(record)
  │
  ├─ Update change token → IsometryDatabase.saveChangeToken(token)
  │
  └─ After sync completes: re-export SQLite → inject into Worker
        (Worker's in-memory state is now authoritative for the session)
```

---

## New vs. Modified Components Summary

| Component | File Path | Status | What Changes |
|-----------|-----------|--------|--------------|
| Vite config | `vite.config.ts` | **Modified** | `base: './'` for relative asset paths; output `dist/` for bundle copy |
| NativeBridgeClient | `src/bridge/NativeBridgeClient.ts` | **New** | JS main-thread side of native bridge; UUID correlation; `requestPersist()` debounce |
| WorkerBridge | `src/worker/WorkerBridge.ts` | **Modified** | Add `persistTrigger` hook called after each mutation (calls NativeBridgeClient) |
| SwiftUI App | `IsometryApp/Sources/.../App/` | **New** | Entry point, ContentView, WebViewContainer |
| AssetsSchemeHandler | `IsometryApp/Sources/.../Bridge/` | **New** | WKURLSchemeHandler; MIME type map; WASM override |
| NativeBridge (Swift) | `IsometryApp/Sources/.../Bridge/` | **New** | WKScriptMessageHandlerWithReply; message dispatch |
| IsometryDatabase | `IsometryApp/Sources/.../Database/` | **New** | Swift Actor; SQLite3; WAL; FTS5; CloudKit dirty flag |
| CloudKitSyncManager | `IsometryApp/Sources/.../Sync/` | **New** | CK zone setup; change token; conflict resolution; push/pull |
| build-web.sh | `IsometryApp/Scripts/build-web.sh` | **New** | `npm run build && cp -r dist/ Resources/WebBundle/` |
| Xcode Run Script | Xcode Build Phase | **New** | Invokes build-web.sh before Compile Sources |

**Unchanged components:** All web Worker handlers, all Providers, all D3 views, MutationManager, StateManager, ETL pipeline, WorkerBridge message protocol, schema.sql.

---

## Build Pipeline

### Development Build

Two processes run in parallel during development:

```bash
# Terminal 1: Vite dev server (web runtime)
npm run dev
# serves at http://localhost:5173 with HMR

# Terminal 2: Xcode (Swift/SwiftUI development)
# During dev, WebViewContainer points to http://localhost:5173
# (use #if DEBUG to switch between dev server and embedded bundle)
```

The debug `WebViewContainer` loads the Vite dev server URL instead of the embedded scheme handler. This preserves HMR during web runtime development without rebuilding the Swift app.

```swift
// WebViewContainer.swift
let startURL: URL = {
#if DEBUG
    URL(string: "http://localhost:5173")!
#else
    URL(string: "app://localhost/index.html")!
#endif
}()
```

**Note:** The `AssetsSchemeHandler` is not used in DEBUG mode. The Vite dev server provides MIME types correctly. This also means WASM MIME type issues are only exposed in Release builds — test scheme handler MIME types explicitly in a Release build or via a dedicated test scheme.

### Production Build

```bash
# Step 1: Build web bundle (manual or via Xcode Run Script)
npm run build
# Output: dist/

# Step 2: Xcode Build Phase (Run Script — before Compile Sources)
./IsometryApp/Scripts/build-web.sh
# Copies dist/ → IsometryApp/Resources/WebBundle/

# Step 3: Xcode compiles Swift, embeds WebBundle/ in .app bundle
# xcodebuild -project IsometryApp.xcodeproj -scheme IsometryApp -configuration Release
```

**Xcode Run Script Phase setup:**

```bash
# build-web.sh
#!/bin/bash
set -e

PROJECT_ROOT="$(dirname "$0")/../.."
WEB_BUNDLE_DIR="$(dirname "$0")/../Resources/WebBundle"

cd "$PROJECT_ROOT"
npm run build

rm -rf "$WEB_BUNDLE_DIR"
cp -r dist/ "$WEB_BUNDLE_DIR/"

echo "Web bundle copied to $WEB_BUNDLE_DIR"
```

**Xcode Input/Output files** (declare these in the Run Script phase to avoid spurious rebuilds):
- Input: `$(SRCROOT)/../src/**/*.ts` (triggers rebuild when TypeScript changes)
- Output: `$(SRCROOT)/Resources/WebBundle/index.html`

### Vite Config Changes for Native Embedding

```typescript
// vite.config.ts — changes for native bundle embedding
export default defineConfig({
  base: './',            // CHANGED from '/' to './' — relative asset paths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Stable file names — avoid hash churn for Xcode input file declarations
        // Only use hashes in production to bust caches
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  // ... existing config unchanged
});
```

**`base: './'` is critical.** With `base: '/'`, Vite emits absolute asset URLs (`/assets/index.js`). The `AssetsSchemeHandler` maps `app://localhost/assets/index.js` correctly, but the scheme's host must match. Using `base: './'` emits relative URLs (`./assets/index.js`), which resolve correctly regardless of scheme/host.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user, < 10K cards | Current architecture — no changes needed |
| Single user, 10–100K cards | db:export debounce window extends to 10s; consider gzip before base64 for large databases |
| Single user, 100K+ cards | Hybrid persistence becomes a bottleneck; evaluate moving CloudKit sync to operate on change deltas (WAL diff) rather than full db:export |
| Multi-device sync | CloudKit private database handles this; conflict resolution policy may need field-level merge if concurrent edits are frequent |

### Scaling Priorities

1. **First bottleneck: base64 encoding of large databases** — A 100MB database serializes to ~133MB base64 string, which must cross the WKWebView IPC boundary. Mitigation: gzip the bytes before base64 encoding; or switch to OPFS-backed sql.js (bypasses the export path entirely, but requires `SharedArrayBuffer` and cross-origin isolation headers).

2. **Second bottleneck: CloudKit batch limits** — CloudKit limits `CKModifyRecordsOperation` to 400 records per batch. At 10K+ cards, the initial sync requires pagination. `CloudKitSyncManager` must batch push/pull operations.

---

## Anti-Patterns

### Anti-Pattern 1: Running the Worker Bridge Through the Native Bridge

**What people do:** Route Worker queries through the native bridge (JS → Swift → SQLite → Swift → JS → Worker) to keep native SQLite as the single source of truth during a session.

**Why it's wrong:** Every Worker query adds two IPC hops (JS-to-Swift, Swift-to-JS) on top of the existing Worker IPC. The existing WorkerBridge latency is ~1–2ms per round trip. Adding native bridge hops pushes this to 10–50ms per query — unacceptable for D3 view renders that issue dozens of queries.

**Do this instead:** sql.js is the working database during a session. Native SQLite is only touched at startup (hydration) and on mutation persistence (debounced export). Never put native SQLite in the query hot path.

---

### Anti-Pattern 2: Injecting the Database via WKScriptMessageHandler Body

**What people do:** Serialize the SQLite file bytes in the `WKScriptMessageHandler` message body as a `Data` or `[UInt8]` to avoid base64 encoding overhead.

**Why it's wrong:** `WKScriptMessageHandler` message bodies are serialized to JavaScript via JSON. `Data` becomes a JSON array of integers — a 10MB database becomes a ~40MB JSON array, slower to serialize than base64.

**Do this instead:** Use `webView.evaluateJavaScript("window.__injectDatabase('\(base64)')")` directly. This bypasses the message handler protocol and avoids JSON serialization of binary data. The string argument is passed directly to the JavaScript engine. For very large databases (>50MB), consider a streaming approach using multiple smaller `evaluateJavaScript` calls that append to a JavaScript buffer.

---

### Anti-Pattern 3: Synchronizing Schema Changes Between Swift and JavaScript

**What people do:** Mirror the sql.js schema in the native SQLite schema and write migration logic for both when adding columns.

**Why it's wrong:** Any schema divergence between the two databases makes the `db:export` → native file write path invalid — the bytes from sql.js are incompatible with the Swift Actor's schema expectations. Schema maintenance cost doubles.

**Do this instead:** Treat the native SQLite file as a raw byte store, not a structured database. The Swift Actor writes and reads the SQLite file bytes as `Data`. It does NOT parse individual tables or run SQL queries against it, except for CloudKit sync. CloudKit sync accesses a minimal subset of columns (`id`, `modified_at`, `sync_status`) that are stable across versions. Schema migrations only exist in the web runtime (`schema.sql` + Worker initialization).

---

### Anti-Pattern 4: Calling evaluateJavaScript from a Background Thread

**What people do:** Call `webView.evaluateJavaScript(...)` from the CloudKit sync completion handler (which runs on an arbitrary dispatch queue).

**Why it's wrong:** `WKWebView` must be accessed from the main thread. Calling `evaluateJavaScript` from a background queue causes a crash or silent failure.

**Do this instead:**

```swift
// WRONG
cloudKitSync() {
    webView.evaluateJavaScript("window.handleSync()") // CRASH — off main thread
}

// CORRECT
Task { @MainActor in
    webView.evaluateJavaScript("window.handleNativeMessage(...)") { result, error in
        // handle result
    }
}
```

All `evaluateJavaScript` calls must be dispatched to `@MainActor`. The `NativeBridge` Swift actor handles this: dispatch Swift actor work on the actor's executor, then dispatch JavaScript calls on `@MainActor`.

---

### Anti-Pattern 5: Persisting on Every Mutation Without Debouncing

**What people do:** Trigger `db:export` → native write after every `WorkerBridge.exec()` call.

**Why it's wrong:** A typical user interaction (drag-drop in Kanban, typing in a card) generates 3–10 mutations per second. Exporting the full database on every mutation would serialize and IPC-transfer a 5–50MB database 10 times per second — saturating the main thread and causing visible UI jank.

**Do this instead:** Debounce the persistence trigger with a 2-second window. After the last mutation in a burst, wait 2 seconds, then export once. On `applicationWillResignActive` / `NSApplicationDidResignActiveNotification`, immediately flush the debounce (export now, don't wait). This guarantees data is persisted before the app is suspended.

```typescript
// NativeBridgeClient.ts
class NativeBridgeClient {
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  requestPersist(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.flushPersist(), 2000);
  }

  async flushPersist(): Promise<void> {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const buffer = await workerBridge.exportDatabase();
    const base64 = arrayBufferToBase64(buffer);
    await this.send('native:persist', { data: base64 });
  }
}
```

---

## Integration Points with Existing Architecture

### What the Native Shell Touches (and How)

| Existing System | v2.0 Interaction | Mechanism |
|-----------------|-----------------|-----------|
| `WorkerBridge.exportDatabase()` | Called by `NativeBridgeClient.flushPersist()` | Existing `db:export` message type — unchanged |
| `WorkerBridge.importDatabase()` | Called on startup with persisted bytes | Existing `db:import` message type — unchanged |
| `WorkerBridge.importFile()` | Called after native file picker returns bytes | Existing `etl:import` message type — unchanged |
| `MutationManager` | Post-mutation callback registers debounce trigger | New hook in `MutationManager.notify()` — one line |
| `StateManager` (Tier 2) | Unchanged — `ui_state` table still persisted via debounced save inside sql.js | Unchanged |
| `AssetsSchemeHandler` | Serves Vite `dist/` including `sql-wasm.wasm` with correct MIME type | New Swift component — no JS changes |
| `schema.sql` | Native SQLite schema initialized separately in `DatabaseSchema.swift` | Subset of columns for CloudKit sync only |

### What the Native Shell Does NOT Touch

- No changes to `FilterProvider`, `PAFVProvider`, `SelectionProvider`, `DensityProvider`
- No changes to any ETL parser, DedupEngine, SQLiteWriter, CatalogWriter
- No changes to any D3 view renderer
- No changes to `WorkerBridge` message protocol (types, payloads, responses)
- No changes to `worker.ts` message router
- No changes to `schema.sql` (web runtime schema is the authority)
- No changes to `MutationManager` command/undo logic (one hook added, not a structural change)

---

## Suggested Build Order for Implementation Phases

The dependency DAG for v2.0 follows a platform-setup-first approach: the WKWebView shell must serve the web bundle before any bridge or persistence work can be tested end-to-end.

### Phase 1: WKWebView Shell + Asset Serving (foundation)

1. **Xcode project setup** — multiplatform app target (iOS 16+, macOS 13+); no dependencies
2. **`vite.config.ts`** — set `base: './'`; verify `npm run build` produces `dist/` with relative URLs
3. **`build-web.sh`** + Xcode Run Script phase — automate `npm run build` → `Resources/WebBundle/` copy
4. **`AssetsSchemeHandler.swift`** — serve `WebBundle/` directory; WASM MIME type override; test with `assets://localhost/sql-wasm.wasm` returning `application/wasm`
5. **`WebViewContainer.swift`** — `UIViewRepresentable`/`NSViewRepresentable`; loads `app://localhost/index.html` in Release, `http://localhost:5173` in Debug
6. **`ContentView.swift`** + `IsometryApp.swift` — NavigationSplitView shell; WKWebView as detail column
7. **Smoke test** — app launches, web runtime renders in WKWebView, sql.js initializes (blank database), D3 views respond

**Rationale:** Everything else depends on a working WKWebView that serves the web bundle. Testing the scheme handler and WASM loading first surfaces the most common integration blocker (MIME type rejection) before any bridge code exists.

### Phase 2: NativeBridge — Message Protocol

8. **`BridgeMessage.swift`** — `Codable` structs for `NativeBridgeRequest` and `NativeBridgeResponse`
9. **`NativeBridgeClient.ts`** — TypeScript main-thread bridge client; UUID correlation; `onNativeMessage` dispatch
10. **`NativeBridge.swift`** — `WKScriptMessageHandlerWithReply`; register `"native"` handler; echo test case
11. **Round-trip test** — JS sends `{type: 'native:ping'}` → Swift replies `{status: 'ok', payload: 'pong'}` → JS Promise resolves

**Rationale:** Establish the bridge protocol with a trivial message before implementing any real operations. The echo test validates that: the message handler is registered, the reply handler resolves the JS Promise, and threading is correct (no main-thread violations).

### Phase 3: Database Persistence

12. **`IsometryDatabase.swift`** (Swift Actor) — `SQLite3` C API; WAL mode; `persist(data: Data)` writes to `Documents/isometry.db`; `load()` reads bytes
13. **`NativeBridge.handlePersist()`** — decodes base64 → `Data` → `IsometryDatabase.persist()`
14. **`NativeBridgeClient.requestPersist()`** + debounce — calls `WorkerBridge.exportDatabase()` → base64 → `native:persist` message
15. **`MutationManager` hook** — after notification cycle, call `NativeBridgeClient.requestPersist()`
16. **Startup hydration** — `NativeBridge` injects `isometry.db` bytes on `native:ready` via `evaluateJavaScript`
17. **Persistence test** — create card → quit app → relaunch → card still visible

**Rationale:** Persistence is the minimal viable product for the native shell. CloudKit sync adds value on top but data survival across app restarts is the threshold requirement.

### Phase 4: Native File Picker for ETL

18. **`UIDocumentPickerViewController` / `NSOpenPanel`** integration in `ToolbarView.swift` — supports `.alto`, `.md`, `.xlsx`, `.csv`, `.json`, `.html` UTTypes
19. **`NativeBridge.handleFilePicker()`** — presents picker; reads file bytes; base64-encodes; sends `native:filePickerResult`
20. **`NativeBridgeClient` file result handler** — decodes base64 → `ArrayBuffer` → `WorkerBridge.importFile(buffer, source)`
21. **ETL round-trip test via native picker** — import Markdown file via native button → cards appear in ListView

### Phase 5: CloudKit Sync

22. **`CloudKitSyncManager.swift`** — zone creation; push pending records; pull changes; change token
23. **`ConflictResolver.swift`** — last-write-wins on `modified_at` for v2.0; field-level merge deferred to v2.1
24. **`NativeBridge.handleSyncStatus()`** → `evaluateJavaScript` → `SyncStatusView` in web (or native `SyncStatusView.swift` in sidebar)
25. **Sync test** — data on device A appears on device B after sync

---

## Sources

- Apple Developer Documentation: [WKURLSchemeHandler](https://developer.apple.com/documentation/webkit/wkurlschemehandler) — confirmed iOS 11+ / macOS 10.13+
- Apple Developer Documentation: [WKScriptMessageHandlerWithReply](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply) — confirmed iOS 14+ / macOS 11+; async reply handler; main thread requirement for WKWebView
- Gualtiero Frigerio: [Custom URL schemes in a WKWebView](https://www.gfrigerio.com/custom-url-schemes-in-a-wkwebview/) — `AssetsSchemeHandler` implementation pattern; UTType MIME detection; HTTPURLResponse construction (MEDIUM confidence — blog post, implementation matches Apple documentation)
- GitHub gist: [WKWebView WASM MIME type issue](https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c) — confirms `fetch()` fails for `.wasm` without `application/wasm` MIME type in WKWebView; `XMLHttpRequest` workaround (MEDIUM confidence — reproduces known bug, scheme handler fix is the correct solution)
- Edd Mann: [Bridging the Gap Between iOS Native Functionality and JavaScript Web Applications](https://eddmann.com/posts/bridging-the-gap-between-ios-native-functionality-and-javascript-web-applications/) — request/response UUID correlation pattern; `evaluateJavaScript` for reply; retain cycle avoidance (MEDIUM confidence — blog post, pattern matches Apple's own documentation)
- DEV Community: [WWDC 2025 WebKit for SwiftUI](https://dev.to/arshtechpro/wwdc-2025-webkit-for-swiftui-2igc) — new `WebView` / `WebPage` API requires iOS 26+; v2.0 targets iOS 16+/macOS 13+, so WKWebView remains the correct choice for this milestone (HIGH confidence — WWDC announcement)
- v5/PITFALLS-NATIVE.md — Native platform pitfalls N1–N10 (CloudKit race conditions, WAL starvation, actor reentrancy) — companion to this document; all patterns applied in Phase 5 build order
- `.planning/PROJECT.md` — v2.0 milestone scope definition; deployment targets iOS 15+ / macOS 12+ (HIGH confidence — project spec; note CLAUDE.md says iOS 15+ but PROJECT.md matches; using iOS 16+ for WKScriptMessageHandlerWithReply which is iOS 14+)
- `v5/Modules/Core/WorkerBridge.md` — existing WorkerBridge protocol; confirms `db:export` and `db:import` message types already exist (HIGH confidence — canonical spec, confirmed in actual source)

---

*Architecture research for: Isometry v2.0 Native Shell (SwiftUI + WKWebView + native SQLite + CloudKit)*
*Researched: 2026-03-01*
