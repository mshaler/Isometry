# Feature Research

**Domain:** Native Swift App Shell — WKWebView hosting, Swift↔JS bridge, hybrid data layer (Isometry v2.0 milestone)
**Researched:** 2026-03-01
**Confidence:** HIGH — derived from `v5/Modules/NativeShell.md` (canonical spec), Apple Developer documentation, WWDC sessions, and community sources for platform-specific behavior

---

## Context: This Milestone's Scope

v1.1 shipped the full ETL pipeline running in the TypeScript/sql.js/D3.js Web Runtime. The runtime is complete and self-contained — all product logic lives in JavaScript.

v2.0 wraps that runtime in a native SwiftUI app for iOS and macOS. The guiding constraint from `NativeShell.md` is explicit: **as much TypeScript/JavaScript as possible, as little Swift as possible.** Swift handles only platform integration. Everything else stays in JavaScript.

The web runtime does not change. The Swift shell provides:
- A WKWebView container that serves the existing Vite-built bundle
- WKURLSchemeHandler to solve WASM MIME type rejection
- A Swift↔JS bridge for 5 message types
- A native file picker (Swift reads the file, passes bytes to the Web Worker)
- A native SQLite actor as the persistence layer (sql.js is still the runtime database)
- App lifecycle hooks to trigger database checkpoint and CloudKit sync
- SwiftUI chrome: sidebar + toolbar, multiplatform for iOS and macOS

**Scope boundary:** CloudKit sync implementation is explicitly listed as "out of scope" in PROJECT.md — the shell handles persistence and handoff, not the full sync. Native app chrome, WKWebView hosting, bridge, file picker, and the hybrid data layer are all in scope.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any native iOS/macOS app. Missing these = product feels like a web wrapper, not a real app.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| WKWebView hosting the web runtime | Every hybrid app (Notion, Linear, Figma) hosts a WebView. Users expect the web runtime to appear and function without visible loading delays. | MEDIUM | Use `loadFileURL(_:allowingReadAccessTo:)` with the Vite-built bundle in the app bundle. WKURLSchemeHandler is mandatory — WASM `application/wasm` MIME type is rejected when serving via `file://` scheme. Register a custom scheme (`isometry://`) and serve all assets through it. This is the known spike from PROJECT.md technical debt. |
| Web app loads on launch without visible delay | Cold launch <2s per `NativeShell.md` targets. Any loading indicator that runs >500ms looks broken. | MEDIUM | Pre-warm WKWebView during app init. Use `WKWebView.load()` before first display. The database ArrayBuffer can be sent in `webView(_:didFinish navigation:)` callback — JS defers render until `launch` payload arrives. Do not block the native UI on JS init. |
| App does not lose data on crash or forced quit | Users treat native apps as crash-safe. A web app in a WKWebView does not auto-persist — the developer must implement persistence. Missing this = data loss = App Store rejection risk. | MEDIUM | Autosave timer (30s interval) sends `checkpoint` message from JS to Swift. Swift writes `isometry.db` atomically using write-then-move pattern. Swift also checkpoints on `scenePhase == .background`. |
| Native file picker for import | iOS users expect the Files app sheet. macOS users expect an NSOpenPanel. A custom file picker built in JS/WebView looks wrong and cannot access the full file system. | LOW | `.fileImporter` SwiftUI modifier handles both iOS (`UIDocumentPickerViewController`) and macOS (`NSOpenPanel`) with one declaration. Content types: `.json`, `.text`, `.commaSeparatedText`, `UTType(filenameExtension: "xlsx")`, `UTType(filenameExtension: "md")`. Swift reads file as `Data`, passes `base64EncodedString()` to Web Worker via `nativeAction` response. |
| Keyboard shortcuts on macOS | macOS users expect Cmd+Z (undo), Cmd+Shift+I (import), etc. Menus with no keyboard shortcuts feel unfinished. | LOW | `Commands` modifier in SwiftUI app. Undo/redo posts `NotificationCenter` notifications that JS `window.nativebridge.receive()` handles. `NativeShell.md` has `MacCommands.swift` pattern ready. |
| App icon + launch screen | Expected by all native apps. Absence triggers App Store review rejection. | LOW | Standard Xcode asset catalog. SF Symbols for toolbar items. |
| macOS toolbar with File menu | macOS apps have menus for File > Import, Edit > Undo. WKWebView-only macOS apps with no native menus look like web wrappers. | LOW | `WindowGroup.commands { IsometryCommands() }` pattern from `NativeShell.md`. |
| iOS bottom toolbar / tab bar for view switching | iOS users expect native navigation chrome. The web runtime renders 9 views — iOS needs a way to switch without the WKWebView being the only touch target. | LOW | ToolbarItemGroup at `.bottomBar` placement. Posts `NativeActionRequest` to JS bridge for view switching — or JS handles its own view switching while toolbar buttons trigger WKScriptMessage. Both approaches work; bridge-mediated is simpler. |
| Safe area inset awareness | On iPhone with notch/Dynamic Island, content behind the notch looks broken. | LOW | `LaunchPayload.safeAreaInsets` sends `{ top, bottom, left, right }` to JS. JS insets its content container by these values. This is already designed in `NativeShell.md`. |

---

### Differentiators (Competitive Advantage)

Features that go beyond "working hybrid app" and provide real user value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Native file picker passes bytes directly to Web Worker | ETL parsers already exist in the web runtime. A naive implementation would re-implement parsing in Swift. The differentiator is Swift reads the file → passes raw bytes → Web Worker runs the existing TypeScript parsers. Zero new Swift parsing code. | LOW | `NativeActionRequest` with `kind: 'importAppleApp'`. Swift reads `Data`, encodes base64, sends via `NativeResponse`. JS decodes to `ArrayBuffer`, passes to `WorkerBridge.importFile()`. The ETL pipeline is already built. Bridge is the seam. |
| WKURLSchemeHandler for WASM — serves assets with correct MIME types | `sql.js` requires the WASM file (`sql-wasm.wasm`) to be served with `application/wasm` MIME type. `file://` scheme does not set MIME types, causing WASM instantiation to fail silently. The scheme handler resolves this — the web runtime actually works, including FTS5 search and all 9 views. | HIGH | This is the critical path. Register `isometry://` scheme. Handler reads from bundle, sets `mimeType` based on file extension: `.wasm → application/wasm`, `.js → text/javascript`, `.html → text/html`. Web Workers require the bundle to be served from the same scheme (not `file://`). SharedArrayBuffer requires COOP/COEP headers — add them in the scheme handler response if sql.js threading is needed. |
| Hybrid data layer: sql.js is the runtime, native SQLite is the persistence | The web runtime already has a complete, tested sql.js database with FTS5, graph traversal, and all ETL. Adding a native SQLite layer would duplicate all this. Instead: sql.js is the runtime database (fast in-memory, fully featured), native file persistence is the checkpoint target. CloudKit syncs the file. One database format, zero duplication. | HIGH | `DatabaseManager.loadDatabase()` reads `isometry.db` on launch → sends as base64 ArrayBuffer to JS → `workerBridge.importDatabase()` loads it into sql.js. On checkpoint: `workerBridge.exportDatabase()` → base64 → `DatabaseManager.saveDatabase()`. Atomic write: write `.tmp`, then move to `.db`. This pattern is fully spec'd in `NativeShell.md`. |
| Feature-gated tier system | Users install one app. Free/Pro/Workbench tiers unlock features without separate apps. `LaunchPayload.tier` tells the JS runtime which features to expose. StoreKit handles purchases. The web runtime already has `D-006` view tier gating — the native shell activates it. | MEDIUM | `FeatureGate.swift` from `NativeShell.md`. StoreKit 2 for subscription management. Tier value in `LaunchPayload` is the bridge signal. JS `FeatureGate.setTier()` gates view rendering and ETL access. |
| iCloud document container for database | The `isometry.db` file lives in the iCloud ubiquity container (`FileManager.default.url(forUbiquityContainerIdentifier:)`). iCloud Document sync moves the file automatically — users get their data on all devices without CloudKit API code. | MEDIUM | `DatabaseManager.databasePath` already checks for ubiquity container in `NativeShell.md`. This is the free-tier sync strategy (no CloudKit subscriptions, no custom zones, no change tokens). Works across iOS and macOS. CloudKit API-based sync (custom zones, subscriptions) is deferred per PROJECT.md. |
| Haptic feedback integration | JS triggers `hapticFeedback` native action for interactions like drag-drop completion in KanbanView or import success. Adds tactile feedback that a pure web app cannot provide. | LOW | `NativeActionRequest` with `kind: 'hapticFeedback'`, style: `'light' | 'medium' | 'heavy'`. `UIImpactFeedbackGenerator` on iOS. macOS: no-op (haptics not available). Guard with `#if os(iOS)`. |
| Deep link to specific views | `isometry://view/network` opens the app and navigates directly to NetworkView. Enables share-to-Isometry workflows and Shortcuts app integration. | MEDIUM | `onOpenURL` modifier in SwiftUI. Pass URL to JS bridge as `NativeActionRequest` with a new `kind: 'navigate'`. JS bridge routes to the appropriate view. Requires adding `navigate` to the bridge contract. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like obvious additions but create problems for this architecture or user experience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Native SQLite as the runtime database (replacing sql.js) | "SQLite performance is better native." Users and developers assume the native Actor-based SQLite from `CLAUDE.md` should replace sql.js in the web runtime. | The entire web runtime — FTS5 schema, graph traversal, all 9 D3 views, all providers, the ETL pipeline, MutationManager — is built on sql.js. Replacing sql.js with a Swift-bridged native SQLite would require rewriting every query through the bridge (async, serialized, no transactions). Zero code reuse. This is the architecture decision that was resolved before this milestone. | Keep sql.js as the runtime database. Use native SQLite (or iCloud Document sync of the `.db` file) exclusively for persistence. The hybrid data layer: sql.js runtime + native file persistence. |
| Service Workers for offline caching | Service Workers cache assets and enable offline use without app launch. Web developers reach for them automatically. | WKWebView Service Worker support requires `limitsNavigationsToAppBoundDomains = true` and App-Bound Domains entitlement. This adds App Store review complexity and App-Bound Domain registration requirements. The app bundle already contains all assets — the `WKURLSchemeHandler` serves them from the bundle without network requests. Offline works by default. | Serve all assets via `WKURLSchemeHandler` from the app bundle. No network requests, no Service Worker needed. Assets are always available. |
| Two-way real-time sync with WKWebView state | "Keep native SQLite in sync with sql.js in real-time." Every mutation in JS triggers a Swift SQLite write. | sql.js runs in a Web Worker. Every mutation would require: Worker → main thread JS → WKWebView message → Swift → native SQLite. At 60 mutations/minute, this is 60 cross-process round-trips. Latency compounds. The bridge is not a message bus. | Checkpoint on app background and every 30s. The database file is authoritative. The web Worker is the fast in-memory working copy. Sync is coarse-grained (file-level), not fine-grained (row-level). |
| Native UITableView/NSTableView for data display | "Native views are faster and look more native." Replace D3.js views with UITableView on iOS. | The entire product value — 9 view types, PAFV projection, LATCH/GRAPH duality, SuperGrid — exists in the D3.js web runtime. Building even one equivalent native view duplicates months of work and creates a maintenance burden of two rendering stacks. The hybrid approach is explicit: D3 renders, Swift wraps. | D3.js renders everything. SwiftUI provides the chrome (toolbar, sidebar). The WKWebView is full-screen and `ignoresSafeArea()`. |
| Separate Swift build pipeline for Vite artifacts | "Build the web runtime separately and copy to the app bundle manually." Developers reach for this when they're not sure how to integrate web and native builds. | A disconnected build pipeline means manual steps before every Xcode build. CI breaks when a developer forgets the web build. Asset hashes change but the Swift bundle reference is stale. | Xcode Run Script Build Phase: `cd $SRCROOT && npm run build && cp -r dist/ IsometryApp/WebApp/`. The Vite output is in `dist/`. A single `Build for Running` invocation does both. Add the `dist/` directory to the Xcode bundle as a folder reference (not group). |
| WKWebView with `file://` scheme (no custom scheme handler) | "Simpler to not bother with WKURLSchemeHandler." `loadFileURL(_:allowingReadAccessTo:)` is easier to implement. | WASM files must be served with `application/wasm` MIME type. `file://` does not set MIME types. sql.js WASM instantiation fails with `TypeError: Failed to execute 'compile' on 'WebAssembly'`. Web Workers loaded from `file://` also have cross-origin restrictions. Both are showstoppers. | WKURLSchemeHandler is mandatory. Register `isometry://`. The handler is ~50 lines of Swift and is the only way to get WASM working in WKWebView. |
| Bidirectional CloudKit sync with field-level merge | Users want "real sync," meaning concurrent editing on two devices merges gracefully at the field level. | Field-level CloudKit merge is complex (see `PITFALLS-NATIVE.md` patterns N1-N5). The sql.js database is a single binary file — not a row-per-record CloudKit schema. Field-level merge would require restructuring CloudKit as a normalized record store, then reconciling with the sql.js schema. | iCloud Document sync moves the whole `isometry.db` file. Last-writer-wins at the file level. For v2.0, this is correct — the app is single-user personal use. Real-time multi-device sync is explicitly out of scope per PROJECT.md. |
| Push to web (WKWebView observes NSUserDefaults) | "Bridge changes via shared NSUserDefaults between app targets." | NSUserDefaults has a 4KB limit on some platforms. JSON serialization of card data overflows it. App Groups require additional entitlements. | Use the JS bridge (`evaluateJavaScript` with `window.nativebridge.receive(...)`) for all Swift → JS communication. The bridge is already designed for this. |

---

## Feature Dependencies

```
[WKURLSchemeHandler — WASM MIME type fix]
    └──required-by──> [WKWebView hosting the web runtime]
                          └──required-by──> [ALL other features]

[WKWebView hosting the web runtime]
    └──required-by──> [Swift↔JS bridge — 5 message types]
    └──required-by──> [Launch payload delivery (dbData + tier + platform)]
    └──required-by──> [Checkpoint request handler]
    └──required-by──> [Native action request handler]

[Swift↔JS bridge]
    └──required-by──> [Native file picker → Web Worker passthrough]
    └──required-by──> [Feature-gated tier activation]
    └──required-by──> [Haptic feedback]
    └──required-by──> [Sync notification delivery]

[Launch payload delivery]
    └──required-by──> [Hybrid data layer — load database on launch]
    └──required-by──> [iCloud container database path resolution]

[Hybrid data layer — DatabaseManager]
    └──required-by──> [Checkpoint handler]
    └──required-by──> [App lifecycle save on background]
    └──enhances──> [iCloud Document container (automatic file sync)]

[Native file picker]
    └──requires──> [Swift↔JS bridge (NativeActionRequest/NativeResponse)]
    └──requires──> [ETL pipeline (already built in v1.1 web runtime)]
    └──does-NOT-require──> [Any new Swift parsing code]

[SwiftUI chrome — sidebar + toolbar]
    └──requires──> [WKWebView hosting (WebView is the content area)]
    └──independent-of──> [Bridge (toolbar buttons can post WKScriptMessages directly)]

[Feature-gated tier system]
    └──requires──> [Launch payload delivery (tier field)]
    └──requires──> [StoreKit 2 (for purchase flow)]
    └──enhances──> [All 9 D3 views (already tier-gated in v1.0)]
```

### Dependency Notes

- **WKURLSchemeHandler must be first.** Without it, WASM fails to instantiate and the entire web runtime does not load. All other features depend on the runtime working. This is the highest-risk item and should be the Phase 1 deliverable.
- **Bridge comes before file picker.** The file picker uses `NativeActionRequest`/`NativeResponse` message types. The bridge must be established and tested before native actions can flow.
- **Hybrid data layer depends on a working bridge.** The database is sent as a base64 string in the `LaunchPayload`. The bridge sends it. If the bridge is not working, the database never loads and the JS runtime starts with an empty database.
- **Native file picker requires zero new Swift parsing.** This is a key dependency inversion: the ETL pipeline from v1.1 handles all parsing. Swift's only job is reading bytes from the file system and passing them to JS. This is a one-sprint feature once the bridge is working.
- **iCloud document sync is independent of CloudKit subscription sync.** The document container approach (`forUbiquityContainerIdentifier`) uses iCloud Drive's file sync — no CloudKit API code needed. It is a free add-on once `DatabaseManager` uses the ubiquity container path.

---

## MVP Definition

### Launch With (v2.0 — Native Shell)

Minimum viable: the web runtime runs inside a native app, data persists across launches, and the native file picker feeds into the ETL pipeline.

- [ ] **WKURLSchemeHandler serving the Vite bundle** — Without this, WASM does not load. The entire web runtime depends on it. This is the spike that was deferred from v1.1.
- [ ] **WKWebView container (`IsometryWebView`)** — Full-screen, `ignoresSafeArea()`, in a SwiftUI app with `@main` entry point. iOS (`UIViewRepresentable`) and macOS (`NSViewRepresentable`).
- [ ] **Swift↔JS bridge — 5 message types** — `LaunchPayload`, `CheckpointRequest`, `NativeActionRequest`, `NativeResponse`, `SyncNotification`. The `NativeBridgeImpl` TypeScript class is fully spec'd in `NativeShell.md`.
- [ ] **DatabaseManager — load and save `isometry.db`** — Reads existing `.db` file on launch, sends base64 to JS. Writes `.db` atomically on checkpoint (write-then-move). Handles first-launch (no file) by sending `dbData: null`.
- [ ] **Launch payload delivery** — After `webView(_:didFinish navigation:)`, send `LaunchPayload` with `dbData`, `platform`, `tier`, `viewport`, `safeAreaInsets`.
- [ ] **Checkpoint handler** — Receives `CheckpointRequest` from JS (autosave every 30s + background). Writes `isometry.db` via `DatabaseManager.saveDatabase()`.
- [ ] **scenePhase background save** — `onChange(of: scenePhase)` triggers checkpoint when entering `.background`. On macOS, use `AppDelegate.applicationWillTerminate` instead (scenePhase is unreliable on macOS per `JesseSquires.com/blog/2024/06/29`).
- [ ] **SwiftUI chrome — minimal** — `NavigationSplitView` or `ZStack` with toolbar. `IsometryCommands` for macOS menus. iOS bottom toolbar. Neither is complex — they are thin wrappers around the WKWebView.
- [ ] **Native file picker — `.fileImporter` modifier** — Presents the system file picker. Swift reads `Data`, encodes as base64, sends via `NativeResponse`. JS decodes to `ArrayBuffer`, calls `workerBridge.importFile(buffer, sourceType)`. Supported types: `.json`, `.text`, `.commaSeparatedText`, `UTType(filenameExtension: "xlsx")`, `UTType(filenameExtension: "md")`.
- [ ] **Xcode Run Script Build Phase** — `npm run build && cp -r dist/ IsometryApp/WebApp/`. One command, reproducible builds.

### Add After Validation (v2.0.x)

- [ ] **iCloud Document container path** — Switch `DatabaseManager.databasePath` from local documents to the ubiquity container URL. Requires iCloud capability in Xcode. Provides automatic cross-device sync via iCloud Drive with no CloudKit API code. Trigger: any user reports "my data isn't on my other devices."
- [ ] **Feature-gated tier via StoreKit 2** — `SubscriptionManager` for Pro/Workbench purchases. Trigger: the free tier card limit (500) is validated with users and monetization is ready.
- [ ] **Haptic feedback** — `UIImpactFeedbackGenerator` for import success, KanbanView drops. Trigger: user testing feedback identifies places where haptics feel natural.
- [ ] **WKWebView inspector in DEBUG** — `webView.isInspectable = true`. Already in `NativeShell.md`. Ships in DEBUG builds, not production.
- [ ] **Share sheet (`UIActivityViewController`)** — Export data to Files app, Mail, etc. `NativeActionRequest` with `kind: 'shareSheet'`. Trigger: users want to share exported data.

### Future Consideration (v2+)

- [ ] **CloudKit subscription sync** — Custom zones, change tokens, subscriptions, push notifications. All `PITFALLS-NATIVE.md` N1-N10 pitfalls apply. Deferred per PROJECT.md explicit out-of-scope. Trigger: iCloud Document sync proves inadequate for conflict resolution needs.
- [ ] **Deep links (`isometry://view/network`)** — `onOpenURL` modifier, JS navigation routing. Trigger: Shortcuts app integration requests.
- [ ] **App Extension (share-to-Isometry)** — Receives shared URLs from Safari/other apps, queues import. Requires App Group for database sharing. Trigger: users want to clip web pages directly.
- [ ] **Widgets** — WidgetKit extension showing card count, recent imports. Requires App Group. Trigger: validated user interest.
- [ ] **macOS menu bar app** — Background process with NSStatusItem. Very different from foreground app model. Trigger: power users want always-on sync status.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| WKURLSchemeHandler (WASM fix) | HIGH — nothing works without it | MEDIUM — ~50 lines Swift, but novel and requires testing | P1 | Phase 1 |
| WKWebView container (UIViewRepresentable) | HIGH | LOW — standard pattern | P1 | Phase 1 |
| Swift↔JS bridge (5 message types) | HIGH | MEDIUM — coordinate JS + Swift | P1 | Phase 1 |
| DatabaseManager (load/save .db) | HIGH — data persistence | LOW — file I/O, atomic write | P1 | Phase 1 |
| Launch payload delivery | HIGH — database hydration | LOW | P1 | Phase 1 |
| Checkpoint handler | HIGH — prevents data loss | LOW | P1 | Phase 2 |
| scenePhase background save | HIGH | LOW | P1 | Phase 2 |
| Native file picker (.fileImporter) | HIGH — primary ETL entry point | LOW — SwiftUI modifier | P1 | Phase 2 |
| SwiftUI chrome (toolbar, menus) | MEDIUM — UX polish | LOW | P1 | Phase 2 |
| Xcode build script integration | HIGH — developer workflow | LOW | P1 | Phase 1 |
| iCloud Document container | HIGH — cross-device sync | LOW — 2 lines to change path | P2 | Phase 3 |
| Feature-gated tier (StoreKit 2) | HIGH for monetization | MEDIUM — StoreKit setup | P2 | Phase 3 |
| Haptic feedback | LOW | LOW | P3 | v2.0.x |
| Deep links | MEDIUM | LOW | P3 | v2+ |
| CloudKit subscription sync | HIGH for multi-device | HIGH — see PITFALLS-NATIVE.md | P3 | v2+ |

**Priority key:**
- P1: Required for v2.0 milestone completion
- P2: Should ship in v2.0, add if time permits
- P3: Explicitly deferred — do not implement in this milestone

---

## Platform-Specific Behavior Notes

### iOS

| Feature | iOS Behavior | Implementation |
|---------|--------------|----------------|
| NavigationSplitView | Collapses to stack on iPhone; sidebar on iPad | Adaptive by default — no special handling needed |
| Bottom toolbar | Standard for iPhone apps | `ToolbarItemGroup(placement: .bottomBar)` |
| File picker | Files app sheet (`UIDocumentPickerViewController`) | `.fileImporter` SwiftUI modifier wraps this |
| Haptics | `UIImpactFeedbackGenerator` | Wrap in `#if os(iOS)` |
| Safe area | Dynamic Island / notch insets | Pass via `LaunchPayload.safeAreaInsets` |
| Background time | ~30s before suspension | Must checkpoint fast; atomic write is critical |
| scenePhase | Works correctly on iOS | `onChange(of: scenePhase) { if phase == .background { checkpoint() } }` |

### macOS

| Feature | macOS Behavior | Implementation |
|---------|----------------|----------------|
| NavigationSplitView | Translucent sidebar, full-height | Default macOS behavior |
| Menu bar | `IsometryCommands` with `Commands` modifier | `CommandGroup(after: .newItem)` for Import |
| File picker | NSOpenPanel | `.fileImporter` wraps this on macOS |
| Haptics | Not available | No-op in Swift; JS `hapticFeedback` action returns immediately |
| scenePhase | Unreliable on macOS | Use `AppDelegate.applicationWillTerminate` for final save |
| Window chrome | Standard macOS window with toolbar | `WindowGroup` default behavior |
| WKWebView inspectable | Safari Web Inspector | `webView.isInspectable = true` in DEBUG |

---

## Bridge Message Type Summary

The NativeShell.md spec defines exactly 5 message types. This is not negotiable — the bridge must stay minimal.

| Message | Direction | Trigger | Payload Size |
|---------|-----------|---------|--------------|
| `LaunchPayload` | Swift → JS | WKWebView load completion | Database: up to ~10MB as base64 |
| `CheckpointRequest` | JS → Swift | 30s autosave timer + background | Database: same |
| `NativeActionRequest` | JS → Swift | User action needing native capability | Small JSON (<1KB) |
| `NativeResponse` | Swift → JS | In response to NativeActionRequest | Small JSON or base64 file data |
| `SyncNotification` | Swift → JS | CloudKit change detected | Database: up to ~10MB as base64 |

**Serialization note:** All messages use JSON serialization via `JSONSerialization.data(withJSONObject:)` and `evaluateJavaScript("window.nativebridge.receive(\(jsonString))")`. ArrayBuffers (the database) are passed as base64 strings — not as true ArrayBuffer Transferables. WKWebView's `evaluateJavaScript` does not support Transferable transfer — base64 is the only option for binary data through this channel. The JS receiver decodes base64 to `ArrayBuffer` using `atob()`.

**Size limit:** `evaluateJavaScript` has no documented hard limit, but the structured clone algorithm and JS string construction may be slow for very large databases (>50MB). For v2.0, the typical database size (< 10MB for 10K cards) is within safe range.

---

## Sources

- `v5/Modules/NativeShell.md` — canonical Native Shell spec, SwiftUI patterns, bridge contract
- `v5/PITFALLS-NATIVE.md` — CloudKit, SQLite, Actor pitfalls
- `.planning/PROJECT.md` — v2.0 milestone scope, out-of-scope items
- Apple Developer Documentation: [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview), [WKURLSchemeHandler](https://developer.apple.com/documentation/webkit/wkurlschemehandler)
- SwiftUI NavigationSplitView: [NavigationSplitView docs](https://developer.apple.com/documentation/swiftui/navigationsplitview), [TN3154 Adopting split view](https://developer.apple.com/documentation/technotes/tn3154-adopting-swiftui-navigation-split-view)
- `.fileImporter` modifier: [useyourloaf.com — SwiftUI Importing and Exporting Files](https://useyourloaf.com/blog/swiftui-importing-and-exporting-files/), [swiftwithmajid.com — File importing and exporting](https://swiftwithmajid.com/2023/05/10/file-importing-and-exporting-in-swiftui/)
- scenePhase on macOS: [jessesquires.com — scenePhase issues](https://www.jessesquires.com/blog/2024/06/29/swiftui-scene-phase/)
- WKURLSchemeHandler security: [dev.to — Getting WKWebView to treat custom scheme as secure](https://dev.to/alastaircoote/getting-wkwebview-to-treat-a-custom-scheme-as-secure-3dl3)
- WASM + WKWebView: [Apple Developer Forums — wasm on iOS app](https://developer.apple.com/forums/thread/705778)

---

*Feature research for: Isometry v2.0 Native Shell (WKWebView hosting, Swift↔JS bridge, hybrid data layer, native file picker)*
*Researched: 2026-03-01*
