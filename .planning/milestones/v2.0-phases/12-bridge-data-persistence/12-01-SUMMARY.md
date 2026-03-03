---
phase: 12-bridge-data-persistence
plan: 01
subsystem: bridge
tags: [swift, wkwebview, wkscriptmessagehandler, typescript, native-bridge, base64, checkpoint]

# Dependency graph
requires:
  - phase: 11-xcode-shell
    provides: WKWebView setup, AssetsSchemeHandler, ContentView.makeWebView() pattern
  - phase: 12-bridge-data-persistence-02
    provides: DatabaseManager actor for dirty tracking and checkpoint persistence
provides:
  - BridgeManager.swift with WeakScriptMessageHandler retain cycle prevention
  - 5-message-type dispatch (native:ready, checkpoint, mutated, native:action, native:sync)
  - LaunchPayload sender (dbData, platform, tier, viewport, safeAreaInsets)
  - NativeBridge.ts with waitForLaunchPayload/initNativeBridge/sendCheckpoint
  - Two-phase native startup flow in main.ts
  - Checkpoint hydration via dbData in WorkerBridge/worker.ts/Database.ts
  - uint8ArrayToBase64/base64ToUint8Array utilities for binary transport
affects:
  - 12-03 (ContentView integration wires BridgeManager.webView and databaseManager)
  - 12-04 (autosave timer uses BridgeManager.requestCheckpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - WeakScriptMessageHandler proxy for WKUserContentController retain cycle prevention
    - Two-phase native launch: waitForLaunchPayload -> createWorkerBridge(dbData) -> initNativeBridge
    - Base64 transport for binary Uint8Array through WKScriptMessageHandler
    - Mutation hook wraps WorkerBridge.send() to detect writes and post mutated signal
    - MUTATING_TYPES Set for precise write-vs-read classification

key-files:
  created:
    - native/Isometry/Isometry/BridgeManager.swift
    - native/Isometry/IsometryTests/BridgeManagerTests.swift
    - src/native/NativeBridge.ts
    - tests/NativeBridge.test.ts
  modified:
    - src/main.ts
    - src/worker/protocol.ts
    - src/worker/WorkerBridge.ts
    - src/worker/worker.ts
    - src/database/Database.ts

key-decisions:
  - "WeakScriptMessageHandler as private nested class inside BridgeManager prevents WKUserContentController retain cycle (BRDG-05)"
  - "Two-phase launch: waitForLaunchPayload() blocks before WorkerBridge creation so dbData bytes arrive before WASM init"
  - "Binary data always base64-encoded through nativeBridge — WKScriptMessageHandler receives raw Uint8Array as {0:byte,...} dictionary"
  - "isDirty is computed property delegating to DatabaseManager — no dual flags, single source of truth"
  - "MUTATING_TYPES Set excludes read operations to avoid spurious dirty signals"
  - "dbData added to WorkerBridgeConfig for checkpoint hydration — existing db loaded without re-running schema"
  - "DEFAULT_WORKER_CONFIG narrowed to Pick<WorkerBridgeConfig, timeout|debug> — wasmBinary/dbData are init-time only"

patterns-established:
  - "BridgeManager pattern: @MainActor class, weak webView ref, var databaseManager, register(with:) before WKWebView creation"
  - "NativeBridge two-phase: waitForLaunchPayload (startup) + initNativeBridge (ongoing handlers after bootstrap)"
  - "All Swift to JS messages via evaluateJavaScript calling window.__isometry.receive({type, payload})"
  - "All JS to Swift messages via window.webkit.messageHandlers.nativeBridge.postMessage({id, type, payload, timestamp})"

requirements-completed: [BRDG-01, BRDG-02, BRDG-03, BRDG-04, BRDG-05]

# Metrics
duration: 24min
completed: 2026-03-03
---

# Phase 12 Plan 01: BridgeManager.swift + NativeBridge.ts Summary

**Bidirectional WKWebView bridge with WeakScriptMessageHandler retain cycle prevention, two-phase native launch flow (waitForLaunchPayload + initNativeBridge), and base64 checkpoint transport**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-03T16:27:10Z
- **Completed:** 2026-03-03T16:51:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 files across Swift + TypeScript

## Accomplishments
- BridgeManager.swift dispatches all 5 bridge message types: native:ready, checkpoint, mutated, native:action, native:sync (stub)
- WeakScriptMessageHandler prevents WKUserContentController retain cycle — validated by deallocation test
- NativeBridge.ts implements two-phase launch: waitForLaunchPayload blocks before WorkerBridge creation so checkpoint bytes arrive before WASM init
- Database.ts supports checkpoint hydration: existing db bytes loaded via new Uint8Array(dbData) instead of fresh schema
- 4 BridgeManagerTests pass; 9 NativeBridge.test.ts pass; 1172 total TypeScript tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: BridgeManager.swift + BridgeManagerTests.swift** - `1321040e` (feat)
2. **Task 2: NativeBridge.ts + main.ts + protocol.ts + WorkerBridge.ts + worker.ts + Database.ts** - `6b1a67ae` (feat)

**Plan metadata:** (created in this commit)

## Files Created/Modified
- `native/Isometry/Isometry/BridgeManager.swift` - Swift-side bridge: WeakScriptMessageHandler, 5-type dispatch, LaunchPayload sender, checkpoint receiver
- `native/Isometry/IsometryTests/BridgeManagerTests.swift` - 4 unit tests: deallocation, isDirty, isJSReady, showingRecoveryOverlay
- `src/native/NativeBridge.ts` - JS-side bridge: waitForLaunchPayload, initNativeBridge, sendCheckpoint, uint8ArrayToBase64, base64ToUint8Array
- `tests/NativeBridge.test.ts` - 9 unit tests: base64 round-trip, empty array edge cases, guard behavior
- `src/main.ts` - Two-phase native launch flow: fetch WASM + waitForLaunchPayload in parallel, then createWorkerBridge(dbData)
- `src/worker/protocol.ts` - Added dbData to WorkerBridgeConfig; narrowed DEFAULT_WORKER_CONFIG type
- `src/worker/WorkerBridge.ts` - Transfers dbData ArrayBuffer in wasm-init message; narrowed config type
- `src/worker/worker.ts` - Passes dbData to Database.initialize() for checkpoint hydration
- `src/database/Database.ts` - initialize() accepts optional dbData for checkpoint hydration vs fresh schema

## Decisions Made
- Used private nested class for WeakScriptMessageHandler to keep the retain cycle pattern encapsulated in BridgeManager
- Two-phase launch (waitForLaunchPayload before WorkerBridge) instead of post-init db:hydrate message — cleaner: dbData arrives before Worker starts
- Narrowed DEFAULT_WORKER_CONFIG from Required<WorkerBridgeConfig> to Pick<..., timeout|debug> — wasmBinary/dbData are init-time only, not runtime config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DatabaseManager stub removed — real implementation already existed**
- **Found during:** Task 1 (BridgeManager.swift)
- **Issue:** Plan said to add DatabaseManager stub to BridgeManager.swift, but DatabaseManager.swift already existed (committed in a prior plan checker run as 12-02)
- **Fix:** Removed stub from BridgeManager.swift; referenced the real DatabaseManager.swift
- **Files modified:** native/Isometry/Isometry/BridgeManager.swift
- **Verification:** BUILD SUCCEEDED, no duplicate type errors
- **Committed in:** 1321040e (Task 1 commit)

**2. [Rule 1 - Bug] Missing Combine import for @Published**
- **Found during:** Task 1 (BridgeManager.swift compilation)
- **Issue:** @Published property required explicit Combine import in explicit module mode
- **Fix:** Added import Combine to BridgeManager.swift
- **Files modified:** native/Isometry/Isometry/BridgeManager.swift
- **Verification:** BUILD SUCCEEDED
- **Committed in:** 1321040e (Task 1 commit)

**3. [Rule 1 - Bug] DEFAULT_WORKER_CONFIG type incompatibility with new optional fields**
- **Found during:** Task 2 (protocol.ts TypeScript check)
- **Issue:** Adding optional fields to WorkerBridgeConfig broke Required<WorkerBridgeConfig> type for DEFAULT_WORKER_CONFIG
- **Fix:** Narrowed DEFAULT_WORKER_CONFIG type to Pick<WorkerBridgeConfig, 'timeout' | 'debug'>; narrowed config field in WorkerBridge.ts
- **Files modified:** src/worker/protocol.ts, src/worker/WorkerBridge.ts
- **Verification:** tsc --noEmit clean for modified files
- **Committed in:** 6b1a67ae (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — compile-time bugs)
**Impact on plan:** All fixes necessary for compilation. No scope creep. Plan intent preserved.

## Issues Encountered
- Plan checker had already committed DatabaseManager.swift and BridgeManagerTests.swift before plan executor ran 12-01 — adapted cleanly by skipping the stub
- Test environment is node (not jsdom) — NativeBridge guard test refactored to not require window.location

## Next Phase Readiness
- BridgeManager.swift ready for integration in ContentView.makeWebView() (Plan 12-03)
- NativeBridge.ts wired into main.ts — activates automatically in native shell
- Database.ts checkpoint hydration path ready for end-to-end testing
- No blockers for Phase 12-03 (autosave timer, scenePhase lifecycle)

## Self-Check: PASSED

- BridgeManager.swift: FOUND at native/Isometry/Isometry/BridgeManager.swift
- NativeBridge.ts: FOUND at src/native/NativeBridge.ts
- 12-01-SUMMARY.md: FOUND at .planning/phases/12-bridge-data-persistence/12-01-SUMMARY.md
- Task 1 commit 1321040e: FOUND in git log
- Task 2 commit 6b1a67ae: FOUND in git log

---
*Phase: 12-bridge-data-persistence*
*Completed: 2026-03-03*
