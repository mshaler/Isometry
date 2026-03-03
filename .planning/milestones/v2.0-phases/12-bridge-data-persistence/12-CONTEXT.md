# Phase 12: Bridge + Data Persistence - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The web runtime persists its database across sessions — data survives app restarts, background transitions, and WebContent process terminations. Swift and JavaScript exchange all 5 bridge message types (LaunchPayload, CheckpointRequest, NativeActionRequest, NativeResponse, SyncNotification) without retain cycles or memory leaks. This phase does NOT include native chrome/UI (Phase 13), iCloud sync (Phase 14), or file import (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Bridge message flow
- Single `nativeBridge` WKScriptMessageHandler receives all JS→Swift messages; Swift dispatches on a `type` field in the message envelope
- Swift→JS messages use `webView.evaluateJavaScript()` calling `window.__isometry.receive({type, payload})` — JS registers this global callback at startup
- LaunchPayload (dbData + platform + tier + viewport + safeAreaInsets) is sent via evaluateJavaScript AFTER JS signals ready, not injected as WKUserScript at document start
- BridgeManager class owns the webView (weak ref), registers handlers, dispatches incoming, sends outgoing — WeakScriptMessageHandler is a private nested class inside BridgeManager
- Bridge reuses the existing Worker envelope pattern `{ id, type, payload, timestamp }` for consistency

### Checkpoint strategy
- Swift-side timer fires every 30 seconds; Swift asks JS to export the database via the bridge, receives bytes back, writes to disk
- Timer pauses during background and resumes when app becomes active
- Atomic write: write to `isometry.db.tmp` in the same directory, then `rename()` — guaranteed atomic on APFS/HFS+ (same volume)
- Dirty flag: JS sends a lightweight `{ type: 'mutated' }` message via nativeBridge after any INSERT/UPDATE/DELETE; Swift sets `isDirty = true`
- Background save (scenePhase → .background): only runs checkpoint if isDirty; uses the same checkpoint code path as autosave
- After successful checkpoint write, isDirty resets to false

### Crash recovery
- On `webViewWebContentProcessDidTerminate`: show a native SwiftUI overlay ("Restoring...") during reload, auto-dismiss after JS signals ready again
- Checkpoint-level granularity accepted — max 30 seconds of potential data loss since last autosave. No WAL-style mutation log.
- One-level backup: before each checkpoint write, rename current `isometry.db` to `isometry.db.bak`, then write new file
- On launch corruption cascade: try primary `isometry.db` → try `isometry.db.bak` → start fresh with empty database. Log failures for debugging.

### Database file location
- Application Support/Isometry/isometry.db — standard Apple-recommended location for app data
- Phase 14 handles migration to iCloud ubiquity container; no iCloud path logic in Phase 12
- File is NOT excluded from backup (isExcludedFromBackup = false) — user data should survive device restore
- DatabaseManager is a Swift actor — provides built-in serialization for concurrent checkpoint requests and lifecycle events
- First launch (no file): Swift sends null dbData in LaunchPayload; JS creates a fresh database with schema only, no seed data

### Claude's Discretion
- Exact SwiftUI overlay design for crash recovery indicator
- Timer implementation details (Timer vs Task.sleep loop)
- Error logging mechanism (os_log vs print vs custom logger)
- Exact bridge message type names and payload shapes (following the established patterns)
- How to detect "JS ready" signal (callback, postMessage, or polling)

</decisions>

<specifics>
## Specific Ideas

- Bridge should feel consistent with the existing Worker protocol — same envelope structure `{ id, type, payload, timestamp }` used internally in the web runtime
- The `wasm-init` message flow in worker.ts is the closest existing pattern to how LaunchPayload should work — JS waits for an init message before proceeding
- ConsoleLogHandler in ContentView.swift is the existing WKScriptMessageHandler pattern to follow for the nativeBridge handler

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContentView.swift`: WKWebView setup with WKWebViewConfiguration, WKScriptMessageHandler registration pattern (consoleLog handler)
- `AssetsSchemeHandler.swift`: WKURLSchemeHandler serving bundled web assets via `app://` scheme — complete and tested
- `WebViewContainer.swift`: Platform-agnostic SwiftUI wrapper (NSViewRepresentable / UIViewRepresentable)
- `WorkerBridge.ts` + `protocol.ts`: Full typed Worker protocol with `db:export` returning `Uint8Array` — JS-side export path exists
- `worker.ts`: `wasm-init` message handling pattern — external init data injected into Worker before startup

### Established Patterns
- Worker uses typed envelope `{ id, type, payload, timestamp }` for all request/response
- `db:export` returns raw `Uint8Array` of the SQLite database — this is the bytes path for checkpoint
- WKScriptMessageHandler receives `message.body` as Any (typically String or Dictionary from JS postMessage)
- Platform conditional compilation via `#if os(macOS)` / `#if os(iOS)` already used in WebViewContainer

### Integration Points
- `ContentView.makeWebView()` is where WKWebViewConfiguration is built — bridge handler registration goes here (or moves to BridgeManager)
- `IsometryApp.swift` is where `@Environment(\.scenePhase)` lifecycle observation would be added
- JS entry point needs to register `window.__isometry.receive()` and signal readiness
- Worker's `db:export` handler already exports the database — bridge checkpoint calls this existing path

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-bridge-data-persistence*
*Context gathered: 2026-03-03*
