---
phase: 11-xcode-shell-wkurlschemehandler
plan: 02
subsystem: native
tags: [xcode, swift, wkwebview, wkurlschemehandler, wasm, native-shell]

# Dependency graph
requires:
  - phase: 11-xcode-shell-wkurlschemehandler
    plan: 01
    provides: dist-native/ bundle with index.html, JS chunks, worker, WASM
provides:
  - native/Isometry.xcodeproj — Multiplatform Xcode project (iOS 17 / macOS 14)
  - native/Isometry/IsometryApp.swift — @main SwiftUI entry point
  - native/Isometry/ContentView.swift — Root view hosting WKWebView with console forwarding
  - native/Isometry/WebViewContainer.swift — Multiplatform WKWebView wrapper
  - native/Isometry/AssetsSchemeHandler.swift — WKURLSchemeHandler serving WebBundle with correct MIME types
  - src/worker/worker.ts — Message-driven initialization (no auto-init race condition)
  - src/worker/protocol.ts — db:query message type for SELECT queries
  - src/worker/handlers/ui-state.handler.ts — handleDbQuery for ViewManager SELECT execution
affects:
  - 12 (Native Bridge — uses window.__isometry and bridge.send())

# Tech tracking
tech-stack:
  added:
    - "SwiftUI (iOS 17+ / macOS 14+)"
    - "WKWebView + WKURLSchemeHandler"
    - "WKScriptMessageHandler (JS console forwarding)"
  patterns:
    - "Message-driven Worker initialization: main thread sends init/wasm-init, Worker waits (no auto-init)"
    - "WASM pre-loading: main thread fetches via scheme handler, transfers ArrayBuffer to Worker"
    - "JS console forwarding: WKUserScript + WKScriptMessageHandler for Xcode debug console"
    - "db:query handler: uses db.exec() for SELECT queries, returns {columns, rows} keyed objects"

key-files:
  created:
    - native/Isometry.xcodeproj/project.pbxproj
    - native/Isometry/Isometry/IsometryApp.swift
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/WebViewContainer.swift
    - native/Isometry/Isometry/AssetsSchemeHandler.swift
  modified:
    - src/worker/worker.ts (message-driven init, removed auto-init)
    - src/worker/WorkerBridge.ts (sends init/wasm-init in constructor)
    - src/worker/protocol.ts (added db:query type)
    - src/worker/handlers/ui-state.handler.ts (added handleDbQuery)
    - src/views/ViewManager.ts (uses db:query instead of db:exec)
    - src/main.ts (cleaned up diagnostic logging)

key-decisions:
  - "ContentView always uses app:// scheme (both DEBUG and RELEASE); DEBUG adds console forwarding + isInspectable"
  - "Message-driven Worker init eliminates race condition between auto-init and wasm-init"
  - "db:query added as separate message type (not merged with db:exec) to preserve MutationManager contract"
  - "ConsoleLogHandler and console forwarding script conditionally compiled (#if DEBUG)"

patterns-established:
  - "Worker initializes only on explicit init/wasm-init message from main thread"
  - "Native shell WASM flow: main thread fetch → ArrayBuffer transfer → Worker initSqlJs({wasmBinary})"
  - "db:query returns {columns, rows} where rows are Record<string, unknown>[] (keyed by column name)"

requirements-completed:
  - SHELL-01
  - SHELL-02
  - SHELL-04

# Metrics
duration: ~90min (including debugging)
completed: 2026-03-02
---

# Phase 11 Plan 02: Xcode Project + Swift Files Summary

**Xcode multiplatform project with WKURLSchemeHandler serving bundled web runtime, WASM pre-loading for Worker, and JS console forwarding to Xcode**

## Performance

- **Duration:** ~90 min (iterative debugging of race conditions and SQLite query issues)
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 3 (1 human-action, 1 auto, 1 human-verify)
- **Files created:** 5 Swift files + Xcode project
- **Files modified:** 6 TypeScript files
- **Tests:** 1163 passing (all green)

## Accomplishments

### Native Shell (Swift)
- Created Xcode multiplatform project at `native/Isometry.xcodeproj` targeting iOS 17+ / macOS 14+
- `AssetsSchemeHandler.swift` serves files from `WebBundle/` with correct MIME types including `application/wasm` override
- `WebViewContainer.swift` wraps WKWebView for both iOS (UIViewRepresentable) and macOS (NSViewRepresentable)
- `ContentView.swift` loads `app://localhost/index.html`, with DEBUG-only JS console forwarding to Xcode via WKScriptMessageHandler
- Run Script build phase executes `npm run build:native` → `rsync` to `WebBundle/`

### Web Runtime Fixes (TypeScript)
- **Eliminated Worker race condition:** Removed auto-initialization from Worker. Worker now waits for explicit `init` or `wasm-init` message from main thread. This prevents the race where auto-init fails (WASM path wrong in Worker context) before the main thread can send pre-loaded WASM.
- **Fixed "datatype mismatch" error:** ViewManager was sending SELECT queries through `db:exec` (which uses `db.run()` — DML only). Added new `db:query` message type that uses `db.exec()` for SELECT queries and returns `{columns, rows}` with keyed objects.
- **WASM pre-loading:** Main thread fetches `sql-wasm-fts5.wasm` via scheme handler, transfers ArrayBuffer to Worker via `postMessage` with transferable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Deviation] ContentView always uses app:// scheme (not DEBUG dev server toggle)**
- **Found during:** Task 2/3 iterative debugging
- **Issue:** Plan specified `#if !DEBUG` for scheme handler and dev server loading in DEBUG. In practice, always using `app://` simplifies testing and ensures consistent behavior. Console forwarding provides the debugging capability instead.
- **Fix:** ContentView always registers AssetsSchemeHandler and loads from `app://localhost/index.html`. DEBUG adds console forwarding script + `isInspectable = true`. RELEASE omits both.
- **Impact:** Dev server HMR path deferred. Can be re-enabled later by uncommenting the DEBUG alternative.

**2. [Rule 1 - Bug] Worker auto-initialization race condition**
- **Found during:** Task 3 (Xcode testing)
- **Issue:** Worker called `initialize()` at script load, which failed because `locateFile` resolved to wrong WASM path under `app://` scheme. This sent `init-error` before main thread could send `wasm-init` with pre-loaded ArrayBuffer.
- **Fix:** Removed auto-init. Worker waits for `{type: 'init'}` or `{type: 'wasm-init', wasmBinary}` message. WorkerBridge sends one of these in its constructor.
- **Files modified:** `src/worker/worker.ts`, `src/worker/WorkerBridge.ts`
- **Verification:** 1163 tests pass, app boots successfully in Xcode

**3. [Rule 1 - Bug] ViewManager "datatype mismatch" SQLite error**
- **Found during:** Task 3 (Xcode testing — app showed error banner)
- **Issue:** `ViewManager._fetchAndRender()` sent SELECT queries via `bridge.send('db:exec', ...)`. The `handleDbExec` handler uses `db.run()` which is DML-only — throws "datatype mismatch" on SELECT.
- **Fix:** Added `db:query` message type to protocol, `handleDbQuery` handler using `db.exec()`, updated ViewManager to use `db:query`.
- **Files modified:** `src/worker/protocol.ts`, `src/worker/handlers/ui-state.handler.ts`, `src/worker/worker.ts`, `src/views/ViewManager.ts`
- **Verification:** 1163 tests pass, app renders empty state (no error banner)

---

**Total deviations:** 3 (1 deviation, 2 bugs)
**Impact on plan:** All fixes were necessary for the native shell to function. The deviation (always using app://) is actually simpler and more robust.

## Issues Encountered

- **Worker fetch() DOES route through WKURLSchemeHandler** (contrary to our original hypothesis), but resolves to double-nested paths (`assets/assets/...`) and wrong filenames. The WASM pre-loading approach is still the correct fix.
- **Xcode Run Script caching:** Build phases don't re-run when source files change outside Xcode. Requires manual `npm run build:native` from CLI, then Clean Build (Cmd+Shift+K) in Xcode to pick up fresh bundles.

## Verified Boot Sequence

The following console output confirms successful native app boot:
```
[JS] INIT: Console forwarding active
[JS] LOG: [Isometry] Native shell — pre-loading WASM for Worker
[JS] LOG: [Isometry] App ready
```

## Self-Check: PASSED

- native/Isometry.xcodeproj: FOUND
- native/Isometry/Isometry/AssetsSchemeHandler.swift: FOUND (contains "application/wasm")
- native/Isometry/Isometry/ContentView.swift: FOUND (contains "WebViewContainer")
- native/Isometry/Isometry/WebViewContainer.swift: FOUND
- native/Isometry/Isometry/IsometryApp.swift: FOUND (contains "@main")
- src/worker/worker.ts: message-driven init VERIFIED
- src/worker/protocol.ts: db:query type FOUND
- Tests: 1163 passing

---
*Phase: 11-xcode-shell-wkurlschemehandler*
*Completed: 2026-03-02*
