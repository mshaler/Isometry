# Project Research Summary

**Project:** Isometry v2.0 Native Shell
**Domain:** Native SwiftUI app shell hosting TypeScript/D3.js/sql.js web runtime via WKWebView (hybrid architecture)
**Researched:** 2026-03-02
**Confidence:** HIGH for stack and features (canonical spec + Apple docs); MEDIUM for hybrid data layer performance at scale

---

## Executive Summary

Isometry v2.0 wraps the existing, complete TypeScript/D3.js/sql.js web runtime in a native SwiftUI multiplatform app for iOS and macOS. The guiding architectural constraint is explicit and non-negotiable: as much JavaScript as possible, as little Swift as possible. Swift handles exactly five concerns — serving the Vite bundle with correct MIME types, bridging 5 message types between JS and native, persisting the sql.js database as a file blob, providing a native file picker that feeds bytes to the existing ETL pipeline, and app lifecycle integration (background saves, CloudKit sync trigger). Everything else — all 9 D3 views, all providers, all ETL parsing, all graph traversal — remains unchanged in the web runtime.

The recommended approach is a single multiplatform Xcode target using Swift 6, iOS 16+/macOS 13+, with a `WKURLSchemeHandler` serving the Vite `dist/` bundle via a custom `app://` scheme. This scheme handler is the critical path gating item: WASM fails to load via `file://` URLs due to WebKit's strict MIME type enforcement, and without WASM there is no sql.js, and without sql.js there is no product. The hybrid data layer keeps sql.js as the session working database and uses native `FileManager` + iCloud Documents for persistence — no GRDB, no CoreData, no parallel SQL schema. A 2-second debounce triggers `db.export()` on every mutation cycle; Swift writes the resulting binary blob atomically and queues CloudKit sync.

The key risks are: (1) WASM MIME rejection in WKWebView — mitigated by `WKURLSchemeHandler` as Phase 1's first deliverable; (2) data loss from in-memory sql.js Worker termination — mitigated by aggressive checkpoint on every app background event and post-ETL-import save; (3) IPC performance for large databases — mitigated by 2-second debounce and base64 encoding (not JSON serialization). CloudKit subscription-based sync is explicitly deferred per PROJECT.md; iCloud Document container sync (file-level, last-writer-wins) provides cross-device sync in v2.0 without custom CloudKit API code.

---

## Key Findings

### Recommended Stack

The v2.0 native shell requires zero new npm packages — the TypeScript runtime is locked and unchanged. On the Swift side, all capabilities come from Apple system frameworks: `WebKit` (WKWebView, WKURLSchemeHandler, WKScriptMessageHandler), `CloudKit` (CKContainer, CKRecord, CKAsset), `StoreKit` (Product, Transaction via StoreKit 2), `SwiftUI`, and `Foundation` (FileManager, Data). No GRDB, no SQLite.swift, no GCDWebServer — the architecture decision that JavaScript owns data access means Swift never executes SQL.

Deployment targets are iOS 16+ / macOS 13+ (not iOS 15/macOS 12 as originally suggested in the spec). The bump is justified by three converging constraints: `SharedArrayBuffer` availability in WebKit, `NavigationSplitView` requiring iOS 16+/macOS 13+, and cleaner Swift 6 concurrency behavior for WKWebView APIs. Swift 6 / Xcode 16+ is required for Swift Testing (`@Test` macro). The project uses a single multiplatform Xcode target — not Mac Catalyst, not separate iOS + macOS targets — with `#if os(iOS)` / `#if os(macOS)` guards for platform-specific code.

**Core technologies:**
- `Swift 6 / Xcode 16+` — app language with full concurrency checking; required for Swift Testing and actor-based patterns
- `WKURLSchemeHandler (app:// scheme)` — serves Vite dist/ bundle with correct MIME types; critical path for WASM instantiation; explicit `.wasm` → `application/wasm` override required (UTType returns octet-stream for .wasm)
- `WKScriptMessageHandler + evaluateJavaScript` — bidirectional JS↔Swift bridge; manual correlation ID pattern preferred over `WKScriptMessageHandlerWithReply` (Swift 6 Sendable issues with the latter)
- `Foundation FileManager + Data` — atomic write/read of sql.js database blob; write-to-temp then rename pattern; no SQL library needed on Swift side
- `iCloud Documents (NSUbiquitousItemDownloadingStatus)` — cross-device file sync via ubiquity container; zero CloudKit API code for v2.0
- `StoreKit 2` — async/await subscription management for Free/Pro/Workbench tiers; local testing via Xcode StoreKit config files
- `Swift Testing (@Test, #expect)` — modern parallel test framework; XCTest retained only for UI tests
- `UIViewRepresentable / NSViewRepresentable` — wraps WKWebView in SwiftUI via single `typealias WebViewRepresentable` pattern for both platforms

### Expected Features

The web runtime does not change. The Swift shell delivers exactly what is needed to make the web runtime behave as a first-class native app. Features were derived from the canonical `NativeShell.md` spec and confirmed against Apple developer documentation.

**Must have (table stakes — v2.0 launch):**
- `WKURLSchemeHandler` serving Vite bundle — without WASM working, nothing else matters; highest-risk item, resolve first
- `WKWebView container (IsometryWebView)` — full-screen, `ignoresSafeArea()`, iOS + macOS via typealias pattern
- `Swift↔JS bridge` — exactly 5 message types: LaunchPayload, CheckpointRequest, NativeActionRequest, NativeResponse, SyncNotification
- `DatabaseManager` — atomic read/write of `isometry.db` blob on launch and checkpoint; write-then-rename pattern
- `Launch payload delivery` — `dbData + platform + tier + viewport + safeAreaInsets` after `webView(_:didFinish navigation:)`
- `scenePhase background save` — iOS: `onChange(of: scenePhase)`; macOS: `applicationWillTerminate` (scenePhase unreliable on macOS)
- `Native file picker (.fileImporter)` — Swift reads file bytes, passes base64 to Web Worker; zero new Swift parsing code (ETL pipeline already built in v1.1)
- `SwiftUI chrome` — NavigationSplitView, iOS bottom toolbar, macOS Commands + menus
- `Xcode Run Script build phase` — `npm run build && cp -r dist/ IsometryApp/Resources/WebApp/`; vite.config.ts `base: './'` for relative asset paths

**Should have (v2.0 if time permits):**
- `iCloud Document container path` — switch `DatabaseManager.databasePath` to ubiquity container URL; ~2-line change; automatic cross-device sync
- `Feature-gated tier via StoreKit 2` — Pro/Workbench subscription purchases; tier field in LaunchPayload
- `WKWebView inspector in DEBUG` — `webView.isInspectable = true`; ships DEBUG only

**Defer (v2+):**
- CloudKit subscription sync (custom zones, change tokens, field-level merge) — explicitly out of scope per PROJECT.md
- Deep links (`isometry://view/network`) — Shortcuts app integration
- App Extension (share-to-Isometry) — requires App Group + database sharing
- Widgets (WidgetKit) — requires App Group, validated user interest needed
- macOS menu bar app — fundamentally different foreground app model

### Architecture Approach

The v2.0 architecture introduces two SQLite databases with distinct roles: sql.js (WASM in-memory, owned by Web Worker) is the session working database handling all queries, ETL, FTS5 search, and D3 rendering; `IsometryDatabase.sqlite` (owned by a Swift Actor via raw `FileManager`) is the durable persistence layer and CloudKit sync source of truth. The bridge between them is a serialized `ArrayBuffer` — the raw SQLite file bytes exported from sql.js and written to disk by Swift, or loaded from disk and injected into the Worker on startup. Option A (sql.js as source of truth, native as write-through checkpoint target) is locked; Option B (native SQLite as source of truth with every query routed through the bridge) would require rewriting the entire mutation/provider/query path and is explicitly rejected.

The Xcode project lives at `IsometryApp/` alongside the existing TypeScript root — same git repo, separate toolchains. `build-web.sh` (invoked by an Xcode Run Script phase) runs `npm run build` and copies `dist/` to `IsometryApp/Resources/WebBundle/` before Compile Sources. In DEBUG, `WebViewContainer` loads `http://localhost:5173` (Vite dev server, HMR works); in Release it loads `app://localhost/index.html` served by `AssetsSchemeHandler`. This means WASM MIME issues only surface in Release builds — test scheme handler MIME types explicitly in a Release build.

**Major components:**
1. `AssetsSchemeHandler` — WKURLSchemeHandler; intercepts `app://` requests; serves `WebBundle/` with explicit `application/wasm` MIME override; gating component for the entire milestone
2. `NativeBridge (Swift)` — WKScriptMessageHandler; receives typed messages (`native:persist`, `native:filePicker`, `native:getKeychain`, `native:setKeychain`); dispatches to IsometryDatabase actor, UIDocumentPicker, Keychain; sends responses via `evaluateJavaScript`
3. `NativeBridgeClient (TypeScript)` — new module in `src/bridge/`; main thread only (never imported in Worker); UUID correlation map; `requestPersist()` 2-second debounce
4. `IsometryDatabase (Swift Actor)` — persistent SQLite via raw SQLite3 C API; WAL mode; atomic write (write-to-temp then rename); CloudKit dirty flag; no GRDB
5. `CloudKitSyncManager (Swift Actor)` — bidirectional sync; change tokens; conflict resolution; triggered on app background
6. `WebViewContainer` — UIViewRepresentable/NSViewRepresentable wrapper; owns WKWebViewConfiguration; DEBUG vs Release URL switching

All existing web components (Worker handlers, all Providers, all D3 views, MutationManager, ETL pipeline, WorkerBridge protocol, schema.sql) are **unchanged**.

### Critical Pitfalls

1. **WASM MIME rejection in WKWebView (P1, CRITICAL)** — `fetch()` enforces `Content-Type: application/wasm`; `file://` scheme provides none. Prevention: `WKURLSchemeHandler` with explicit `.wasm` → `application/wasm` mapping. Must be Phase 1 spike. The existing JS XHR fallback (`fetch` override) is a temporary workaround to remove once the handler is in place. WASM MIME issues are only exposed in Release builds, not DEBUG (which uses the Vite dev server).

2. **sql.js in-memory data loss on Worker termination (P4, CRITICAL)** — No automatic persistence; entire database lives in WASM heap. Prevention: D-010 dirty flag fires `NativeBridgeClient.requestPersist()` 2s debounced after every mutation; immediate `db.export()` on every `scenePhase == .background` event. On macOS, use `applicationWillTerminate` — scenePhase is unreliable on macOS (JesseSquires.com 2024).

3. **WKScriptMessageHandler memory retain cycle** — WKWebView strongly retains message handler objects, creating a reference cycle. Prevention: `WeakScriptMessageHandler` proxy wrapper when registering handlers to avoid preventing deallocation of the Coordinator/NativeBridge.

4. **Worker init race condition (P11, HIGH)** — Messages sent before `initSqlJs()` resolves are silently lost. Prevention: queue messages in Worker until `db` is initialized; gate all `WorkerBridge` callers on `this.ready` Promise.

5. **IPC size limit for large databases** — `evaluateJavaScript` with large base64 strings (>50MB database = ~67MB base64) may be slow. Prevention: track `db.export()` timing in Phase 2 benchmarks; gzip before base64 if >10MB databases become common; document 50MB cap for native file picker imports.

---

## Implications for Roadmap

Based on combined research, the v2.0 milestone has a clear dependency ordering that dictates phase structure. The WASM MIME fix is the gating item for the entire milestone. The bridge must exist before file picker or tier features. The database layer must be wired to the bridge before any ETL import can persist. CloudKit sync is a background concern that can proceed in parallel once persistence is established.

### Phase 1: Foundation — Xcode Project + WKURLSchemeHandler + Web Runtime Loads

**Rationale:** Nothing else works until WASM loads in WKWebView. This phase de-risks the entire milestone by resolving P1 (WASM MIME rejection) as the first deliverable before any other feature work. The custom scheme handler is ~50 lines of Swift but is novel, requires testing in Release builds, and gates all downstream features.
**Delivers:** Working Xcode multiplatform project; Vite bundle embedded and served via `app://` scheme; WKWebView renders the existing web runtime with FTS5 and all 9 views functional on iOS simulator and macOS Release build; Xcode Run Script build phase wired; `vite.config.ts` `base: './'` change applied.
**Addresses:** WKURLSchemeHandler (WASM MIME fix), WKWebView container (IsometryWebView), build pipeline integration.
**Avoids:** Pitfall 1 (WASM MIME — explicit .wasm override in scheme handler), Pitfall 3 (WASM Vite production path — `optimizeDeps.exclude: ['sql.js']` already in place). Must test Release build, not DEBUG dev server — scheme handler only active in Release.
**Research flag:** SKIP — WKURLSchemeHandler pattern fully documented in STACK.md with working code examples, verified against Apple docs and prior art.

### Phase 2: Bridge + Database — JS↔Swift Messaging + Persistent Storage

**Rationale:** With the runtime loading, the bridge and database layer are the next dependency layer. These two concerns are tightly coupled — database hydration requires a working bridge; checkpoint requires both. They ship together.
**Delivers:** Full 5-message bridge protocol operational; `IsometryDatabase` Swift Actor reads/writes `isometry.db` atomically; `DatabaseManager.loadDatabase()` injects existing db as base64 on launch; `CheckpointRequest` handler writes db atomically; `scenePhase` background save wired (iOS: `onChange(of:)`, macOS: `applicationWillTerminate`); `LaunchPayload` delivers `dbData + platform + tier + safeAreaInsets`.
**Uses:** `WKScriptMessageHandler` (not `WKScriptMessageHandlerWithReply` — avoids Swift 6 Sendable issues); `evaluateJavaScript`; `WeakScriptMessageHandler` proxy; `NativeBridgeClient.ts` (new module, main thread only, never imported in Worker).
**Avoids:** Pitfall 4 (in-memory data loss — aggressive checkpoint wiring on every background event), Pitfall 11 (Worker init race — bridge gates on ready Promise), Pitfall 12 (pending promise map leak — timeout on all bridge calls), retain cycle (WeakScriptMessageHandler proxy).
**Research flag:** SKIP — bridge pattern fully specified in NativeShell.md and ARCHITECTURE.md. Patterns are verified and deterministic.

### Phase 3: SwiftUI Chrome + Native File Picker

**Rationale:** With bridge and persistence working, the native UX layer can be built. File picker requires a functioning bridge (NativeActionRequest/NativeResponse) and the ETL pipeline it feeds is already built in v1.1 — making this a low-risk integration that leverages existing work.
**Delivers:** NavigationSplitView shell with sidebar and toolbar; iOS bottom toolbar; macOS Commands + menus (File > Import, keyboard shortcuts); `.fileImporter` modifier presenting UIDocumentPickerViewController/NSOpenPanel; Swift reads file bytes → base64 → `WorkerBridge.importFile()`; zero new Swift parsing code.
**Implements:** Pattern 4 (native file picker → ETL) and Pattern 5 (SwiftUI/WebView boundary) from ARCHITECTURE.md.
**Avoids:** Anti-pattern of re-implementing ETL parsing in Swift (all parsing stays in Worker); `file://` scheme for file loading (uses security-scoped URL + `startAccessingSecurityScopedResource`).
**Research flag:** SKIP — `.fileImporter` modifier pattern is standard SwiftUI; ETL integration path is fully specified in ARCHITECTURE.md Pattern 4.

### Phase 4: iCloud + StoreKit — Sync + Monetization

**Rationale:** These are independent of each other but both depend on a working database layer (Phase 2). iCloud Documents is a 2-line change to `DatabaseManager.databasePath`. StoreKit 2 is additive. Both are independently verifiable.
**Delivers:** `DatabaseManager.databasePath` uses ubiquity container URL — automatic cross-device file sync via iCloud Drive with no CloudKit API code; `SubscriptionManager` using StoreKit 2 async/await; `FeatureGate.swift` tier enforcement; `LaunchPayload.tier` populated from StoreKit entitlements.
**Uses:** `FileManager.default.url(forUbiquityContainerIdentifier:)`, StoreKit 2 `Transaction.currentEntitlements`, Xcode StoreKit configuration file for local testing.
**Avoids:** Full CloudKit subscription sync (custom zones, change tokens, field-level merge) — explicitly deferred to v2+ per PROJECT.md.
**Research flag:** NEEDS deeper research for StoreKit 2 subscription configuration — product ID setup, entitlement refresh timing, sandbox testing workflow, App Store Connect state. The API itself is documented but the configuration workflow requires research specific to this project's tier model.

---

### Phase Ordering Rationale

- **WASM first** because every other feature depends on the runtime loading; P1 is the single highest-risk item and must be de-risked before any bridge or persistence work begins.
- **Bridge + database together** because they are mutually dependent (db hydration goes through bridge) and represent the novel architectural element (hybrid data layer) with the highest design risk.
- **File picker in Phase 3, not Phase 2** because it requires a stable, tested bridge before NativeActionRequest flows can be validated; also the ETL pipeline it feeds is already built, making Phase 3 integration low-risk.
- **iCloud + StoreKit last** because they are additive capabilities with no dependencies on bridge or file picker internals, and StoreKit requires App Store Connect setup (external dependency that can be parallelized with Phase 3).

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (StoreKit 2):** Product ID configuration, subscription group setup in App Store Connect, sandbox testing flow, entitlement refresh timing. API is documented; configuration workflow needs research against current App Store Connect state and this project's specific tier model (Free/Pro/Workbench).

Phases with standard patterns (skip research-phase):
- **Phase 1:** WKURLSchemeHandler fully documented in STACK.md with working code examples verified against Apple docs and prior art.
- **Phase 2:** Bridge pattern fully specified in NativeShell.md + ARCHITECTURE.md. Worker init race patterns are well-understood.
- **Phase 3:** `.fileImporter` is standard SwiftUI; ETL integration path is fully specified in ARCHITECTURE.md Pattern 4.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Swift/SwiftUI/WKWebView APIs verified via Apple docs; WASM MIME workaround confirmed via WebKit bug discussions and Pyodide prior art; deployment target bump (iOS 16/macOS 13) well-justified by three independent constraints; `WKScriptMessageHandler` vs `WKScriptMessageHandlerWithReply` recommendation confirmed via Apple Developer Forums |
| Features | HIGH | Derived directly from NativeShell.md canonical spec; all features confirmed against Apple Developer docs; dependency graph is clear and complete; MVP scope is tight and buildable |
| Architecture | HIGH (integration patterns) / MEDIUM (hybrid data layer performance) | Integration patterns (scheme handler, bridge, build pipeline, data flow) are HIGH — verified against spec and Apple docs with code examples. Hybrid data layer sync performance (`db.export()` timing, base64 IPC with large databases) is MEDIUM — no direct prior art for this exact sql.js + native SQLite pairing; performance profile at 10K+ cards is unvalidated |
| Pitfalls | HIGH for previously-known pitfalls (P1, P4, P11, P12); MEDIUM for native-specific pitfalls | P1 (WASM MIME) confirmed via multiple sources including working Pyodide example. WKScriptMessageHandler retain cycle is a known pattern with a well-documented solution. scenePhase macOS unreliability confirmed via JesseSquires.com 2024. ETL pitfalls from v1.1 research carry forward unchanged. |

**Overall confidence:** HIGH for architecture decisions and feature scope; MEDIUM for performance characteristics at scale.

### Gaps to Address

- **`db.export()` performance at 10K+ cards:** The base64 IPC path for a large database is untested. Profile `db.export()` in Phase 2 with a 10K-card fixture and benchmark serialization time. If >500ms, investigate gzip before base64 or chunked transfer. ARCHITECTURE.md notes a potential bottleneck at 100MB+ databases.
- **scenePhase reliability on macOS:** Confirmed unreliable (JesseSquires.com 2024). Implement `AppDelegate.applicationWillTerminate` as the macOS save trigger and validate in Phase 2 integration tests. Do not rely solely on `scenePhase` on macOS.
- **iOS 15 vs iOS 16 minimum target:** STACK.md raises this as a potential business requirement gap. If iOS 15 support is required, Phase 1 must add `@available(iOS 16, *)` guards around `NavigationSplitView` and validate WASM MIME handling on the older WebKit build. Defer decision to roadmap but flag as a potential Phase 1 scope change.
- **`WKScriptMessageHandlerWithReply` vs `WKScriptMessageHandler` final choice:** ARCHITECTURE.md uses `WKScriptMessageHandlerWithReply` while STACK.md + FEATURES.md recommend manual correlation IDs with `WKScriptMessageHandler` (avoiding Swift 6 Sendable issues). STACK.md's recommendation is more conservative and should be the canonical choice; resolve this explicitly at Phase 2 kickoff before any bridge code is written.
- **Large file import memory pressure:** ARCHITECTURE.md caps native file picker imports at ~50MB with a UI warning for v2.0. This cap must be implemented and tested; a 200MB Apple Notes export passed to the Worker would cause OOM.

---

## Sources

### Primary (HIGH confidence)
- `v5/Modules/NativeShell.md` — canonical Native Shell spec; bridge contract; SwiftUI patterns; database hydration flow; 5-message protocol
- Apple Developer Documentation: WKURLSchemeHandler, WKWebView, WKScriptMessageHandler, NavigationSplitView, FileImporter modifier, StoreKit 2, CKAsset
- `.planning/PROJECT.md` — v2.0 scope and explicit out-of-scope items (CloudKit subscription sync deferred)
- `v5/PITFALLS-NATIVE.md` — native shell pitfall catalog (N1–N10)
- Apple Xcode Support page — Swift 6.2.3 in Xcode 26.3; deployment target matrix

### Secondary (MEDIUM confidence)
- GitHub gist (otmb) — WASM fetch() MIME error in WKWebView confirmed; XHR workaround verified for Pyodide on iOS
- Tauri discussion #6269 — SharedArrayBuffer in WKWebView confirmed available macOS 13.x / iOS 16.x
- Daniel Saidi blog — typealias UIViewRepresentable/NSViewRepresentable SwiftUI WebView pattern
- dev.to (Alastair Coote) — Getting WKWebView to treat custom scheme as secure context
- JesseSquires.com blog 2024 — scenePhase unreliable on macOS confirmed
- Swift Testing introduction (dev.to/raphacmartin) — @Test macro, #expect, SPM integration, Swift 6 requirement
- StoreHelper GitHub (russell-archer) — StoreKit 2 multiplatform iOS 15-17 / macOS 12-14 support
- WKScriptMessageHandlerWithReply Swift 6 concurrency — Apple Developer Forums #751086
- GRDB.swift GitHub (groue) — v7.10.0 confirmed NOT required for this architecture

### Tertiary (LOW confidence)
- `WKScriptMessageHandlerWithReply` Sendable issue — referenced in forum discussions; not directly reproduced; conservative avoidance (use `WKScriptMessageHandler`) is the safe path
- `db.export()` performance at 10K+ cards — extrapolated from sql.js GitHub issues; no benchmark data for this specific WASM build size; must be measured in Phase 2

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
