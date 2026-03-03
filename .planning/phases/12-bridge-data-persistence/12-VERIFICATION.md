---
phase: 12-bridge-data-persistence
verified: 2026-03-03T17:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create a card, background the app on iOS, then relaunch"
    expected: "Card is present after relaunch — database persisted to disk and checkpoint bytes hydrated into sql.js on launch"
    why_human: "Requires physical iOS device or simulator run with actual WKWebView lifecycle events"
  - test: "Force-quit the app on iOS after performing a mutation, then relaunch within 30 seconds"
    expected: "Data is not lost — autosave checkpoint fired within 30-second window; database rehydrates on launch"
    why_human: "Requires timed interaction with live simulator to verify autosave fires and persists before kill"
  - test: "Simulate WebContent process crash (via Xcode Debug menu or memory pressure)"
    expected: "Recovery overlay ('Restoring... Your data is safe') appears briefly, then app fully reloads from last checkpoint with data intact"
    why_human: "Requires Xcode debugger to simulate process termination; visual overlay verification"
  - test: "Press cmd-Q on macOS with unsaved data"
    expected: "Accepted tradeoff: last autosave checkpoint (max 30s old) is the recovery point; data since last autosave is lost (documented intentional behavior)"
    why_human: "Requires macOS app with live data to verify applicationWillTerminate fires"
---

# Phase 12: Bridge + Data Persistence Verification Report

**Phase Goal:** The web runtime persists its database across sessions — data survives app restarts, background transitions, and WebContent process terminations
**Verified:** 2026-03-03T17:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User creates a card, backgrounds the app, and relaunches — the card is still present (database persisted and rehydrated) | VERIFIED (automated) + NEEDS HUMAN (end-to-end) | DatabaseManager.loadDatabase() + saveCheckpoint() exist and are wired; db hydration path in Database.ts confirmed; full round-trip needs device |
| 2 | User backgrounds the app on iOS and the database is saved within the background execution window without data loss | VERIFIED (automated) + NEEDS HUMAN | `performBackgroundSave()` in IsometryApp.swift calls `beginBackgroundTask` + `saveIfDirty()`; end-to-end requires simulator |
| 3 | Autosave timer writes a checkpoint every 30 seconds while the app is active, with no user-visible jank | VERIFIED | `Timer.scheduledTimer(withTimeInterval: 30, repeats: true)` on main run loop in BridgeManager.startAutosave(); timer auto-pauses on background; isDirty guard prevents spurious checkpoints |
| 4 | After a simulated WebContent process crash (memory pressure), the app reloads and restores from the last saved checkpoint | VERIFIED (automated) + NEEDS HUMAN | `webViewWebContentProcessDidTerminate` in BridgeManager.WKNavigationDelegate sets showingRecoveryOverlay=true, reloads webView; overlay driven by @Published flag in ContentView; end-to-end verification requires Xcode |
| 5 | Swift and JavaScript can exchange all 5 bridge message types without retain cycles or memory leaks | VERIFIED | WeakScriptMessageHandler proxy confirmed; all 5 types dispatched: native:ready, checkpoint, mutated, native:action (stub), native:sync (sendSyncNotification stub); BridgeManagerTests.weakScriptMessageHandler_deallocation() validates no retain cycle |

**Score:** 5/5 truths verified (4 have human verification components for the full end-to-end path)

---

## Required Artifacts

### Plan 12-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/BridgeManager.swift` | WeakScriptMessageHandler, 5-type dispatch, LaunchPayload, checkpoint receiver | VERIFIED | 327 lines; @MainActor final class; WeakScriptMessageHandler nested class; WKNavigationDelegate extension; autosave timer; saveIfDirty; isDirty computed property delegating to DatabaseManager |
| `src/native/NativeBridge.ts` | waitForLaunchPayload, initNativeBridge, sendCheckpoint, uint8ArrayToBase64 | VERIFIED | 284 lines; all exports present; guard on `app:` protocol; mutation hook wraps bridge.send() |
| `src/main.ts` | Two-phase native launch: waitForLaunchPayload → createWorkerBridge(dbData) → initNativeBridge | VERIFIED | Lines 35-151; `waitForLaunchPayload()` called before WorkerBridge creation; `initNativeBridge(bridge)` called after bootstrap |
| `tests/NativeBridge.test.ts` | Unit tests for base64 round-trip | VERIFIED | 85 lines; 9 tests covering uint8ArrayToBase64, base64ToUint8Array, empty arrays, null bytes, guard behavior |
| `native/Isometry/IsometryTests/BridgeManagerTests.swift` | Unit tests for WeakScriptMessageHandler deallocation (BRDG-05) | VERIFIED | 4 tests: deallocation, isDirty nil safety, isJSReady initial state, showingRecoveryOverlay initial state |

### Plan 12-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/DatabaseManager.swift` | Actor-based SQLite file persistence: load, save checkpoint, atomic rename, backup rotation | VERIFIED | 102 lines; `actor DatabaseManager`; loadDatabase() with corruption cascade; saveCheckpoint() with .tmp/.bak rotation; isDirty, markDirty(), clearDirty(); two initializers (production + test) |
| `native/Isometry/IsometryTests/DatabaseManagerTests.swift` | Unit tests for load, save, atomic write, backup rotation, corruption cascade, dirty flag | VERIFIED | 10 XCTests; isolated temp directories; covers all DATA-01/02/03 behaviors |

### Plan 12-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/IsometryApp.swift` | Lifecycle management: scenePhase observer, iOS beginBackgroundTask, macOS NSApplicationDelegateAdaptor | VERIFIED | `@NSApplicationDelegateAdaptor` present; scenePhase .active starts autosave; .background stops + calls performBackgroundSave; iOS beginBackgroundTask with proper expiration handler |
| `native/Isometry/Isometry/ContentView.swift` | BridgeManager integration, recovery overlay, WKNavigationDelegate wiring | VERIFIED | `@ObservedObject var bridgeManager`; ZStack with recovery overlay driven by showingRecoveryOverlay; bridgeManager.register(with:) called before WKWebView creation; bridgeManager.configure(webView:) sets navigationDelegate |
| `native/Isometry/Isometry/BridgeManager.swift` (extended) | WKNavigationDelegate for crash recovery, autosave timer, saveIfDirty | VERIFIED | WKNavigationDelegate extension with webViewWebContentProcessDidTerminate; Timer.scheduledTimer 30s; saveIfDirty; checkForSilentCrash |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/native/NativeBridge.ts` | `window.webkit.messageHandlers.nativeBridge.postMessage` | postMessage with typed envelope | WIRED | Lines 155, 236, 271 in NativeBridge.ts; all use `{id, type, payload, timestamp}` envelope |
| `native/Isometry/Isometry/BridgeManager.swift` | `window.__isometry.receive` | evaluateJavaScript | WIRED | Lines 188, 295 in BridgeManager.swift; LaunchPayload and sync notification both call `window.__isometry.receive(...)` |
| `src/native/NativeBridge.ts` | `src/worker/WorkerBridge.ts` | bridge.exportDatabase() | WIRED | NativeBridge.ts line 234: `const dbBytes = await bridge.exportDatabase()`; WorkerBridge.ts line 287: `return this.send('db:export', {})` |
| `native/Isometry/Isometry/DatabaseManager.swift` | `Application Support/Isometry/isometry.db` | FileManager file I/O | WIRED | Lines 19-21 (production init); .db, .tmp, .bak paths confirmed |
| `native/Isometry/Isometry/DatabaseManager.swift` | `native/Isometry/Isometry/BridgeManager.swift` | `var databaseManager: DatabaseManager?` | WIRED | BridgeManager.swift line 38; ContentView.swift line 114 wires it: `bridgeManager.databaseManager = try DatabaseManager()` |
| `native/Isometry/Isometry/IsometryApp.swift` | `native/Isometry/Isometry/BridgeManager.swift` | scenePhase .background triggers saveIfDirty() | WIRED | IsometryApp.swift lines 63, 87: `performBackgroundSave()` → `await bridgeManager.saveIfDirty()` |
| `native/Isometry/Isometry/IsometryApp.swift` | `native/Isometry/Isometry/BridgeManager.swift` | NSApplicationDelegateAdaptor.applicationWillTerminate | WIRED | IsometryApp.swift lines 23, 37-39: delegate wired via `.onAppear { appDelegate.bridgeManager = bridgeManager }` |
| `native/Isometry/Isometry/BridgeManager.swift` | `native/Isometry/Isometry/ContentView.swift` | showingRecoveryOverlay drives ZStack overlay | WIRED | BridgeManager.swift line 52 (@Published); ContentView.swift line 20 consumes it |
| `src/worker/WorkerBridge.ts` | `src/worker/worker.ts` | dbData in wasm-init message | WIRED | WorkerBridge.ts lines 120-124: posts wasm-init with dbData ArrayBuffer; worker.ts lines 146-148: receives and passes to initialize() |
| `src/worker/worker.ts` | `src/database/Database.ts` | initialize(wasmBinary, dbData) | WIRED | worker.ts line 83: `await db.initialize(wasmBinary, dbData)`; Database.ts lines 58-61: `new SQL.Database(new Uint8Array(dbData))` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BRDG-01 | 12-01 | Swift→JS bridge: LaunchPayload (dbData, platform, tier, viewport, safeAreaInsets) | SATISFIED | BridgeManager.sendLaunchPayload() sends all 5 fields via evaluateJavaScript; NativeBridge.waitForLaunchPayload() receives them |
| BRDG-02 | 12-01 | CheckpointRequest: binary data as base64 | SATISFIED | uint8ArrayToBase64() in NativeBridge.ts; base64 decode in BridgeManager.didReceive("checkpoint"); 9 unit tests pass |
| BRDG-03 | 12-01 | NativeActionRequest/NativeResponse messages | SATISFIED (stub) | case "native:action" dispatched in BridgeManager.didReceive(); logs placeholder; Phase 13 fills this — intentional stub per plan |
| BRDG-04 | 12-01 | SyncNotification (Swift→JS) | SATISFIED (stub) | sendSyncNotification() in BridgeManager; evaluates `window.__isometry.receive({type:'native:sync',...})`; Phase 14 fills JS handler |
| BRDG-05 | 12-01 | WeakScriptMessageHandler prevents retain cycle | SATISFIED | Private nested class WeakScriptMessageHandler with `weak var delegate: BridgeManager?`; deallocation test validates it |
| DATA-01 | 12-02 | DatabaseManager loads existing isometry.db and sends base64 to JS | SATISFIED | loadDatabase() reads .db file; BridgeManager.sendLaunchPayload() base64-encodes and sends; Database.ts hydrates from bytes |
| DATA-02 | 12-02 | First-launch: null dbData → fresh database | SATISFIED | loadDatabase() returns nil when no file exists; BridgeManager sends `dbData: null`; Database.ts creates fresh db when dbData is undefined |
| DATA-03 | 12-02 | Checkpoint writes isometry.db atomically (.tmp → rename) | SATISFIED | saveCheckpoint() writes to .tmp, rotates .db to .bak, renames .tmp to .db; 3 XCTests cover atomic write, rotation, and tmp cleanup |
| DATA-04 | 12-03 | Database saved on background (iOS: scenePhase, macOS: applicationWillTerminate) | SATISFIED | iOS: performBackgroundSave() with beginBackgroundTask/endBackgroundTask; macOS: NSApplicationDelegateAdaptor.applicationWillTerminate (accepted tradeoff: last autosave is recovery point) |
| DATA-05 | 12-03 | Autosave timer every 30 seconds while active | SATISFIED | Timer.scheduledTimer(withTimeInterval: 30) on main run loop; auto-pauses on background; isDirty guard prevents no-op checkpoints |
| SHELL-05 | 12-03 | Recovery from WebContent process termination | SATISFIED | webViewWebContentProcessDidTerminate sets showingRecoveryOverlay + reloads; native:ready dismisses overlay; ContentView ZStack renders overlay; secondary crash detection via checkForSilentCrash() |

All 11 requirements (BRDG-01..05, DATA-01..05, SHELL-05) are SATISFIED. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `BridgeManager.swift` | 134 | "Phase 13 placeholder" comment on native:action handler | Info | Intentional — Phase 13 fills this; the stub correctly logs and does not crash |
| `IsometryApp.swift` | 117 | applicationWillTerminate uses print() instead of os.Logger | Info | Cosmetic inconsistency — all other logging in phase uses Logger; does not affect functionality |

No blockers or warnings found. The stub behaviors for BRDG-03 (native:action) and BRDG-04 (native:sync JS side) are explicitly planned and documented in the roadmap.

---

## Human Verification Required

The following behaviors require device/simulator interaction to fully validate:

### 1. Full Persistence Round-Trip (Success Criterion 1)

**Test:** Create a card in the app, background it (Home button on iOS), wait 2 seconds, then relaunch
**Expected:** Card is present after relaunch; Xcode console shows "Loaded database (N bytes)" on second launch
**Why human:** Requires WKWebView running in native shell with actual file I/O and LaunchPayload exchange

### 2. iOS Background Save Window (Success Criterion 2)

**Test:** Create a card, immediately background the app, check Xcode console
**Expected:** Console shows "saveIfDirty: requesting checkpoint" followed by "Checkpoint saved (N bytes)" within 2 seconds
**Why human:** Requires timed iOS background task execution on simulator or device

### 3. Autosave No-Jank Verification (Success Criterion 3)

**Test:** Run the app for 30+ seconds while interacting, observe for any stutter at 30-second intervals
**Expected:** No visible jank; autosave tick fires asynchronously and does not block UI
**Why human:** Performance/jank is perceptible only at runtime; Timer on main run loop is correct architecture

### 4. WebContent Crash Recovery (Success Criterion 4)

**Test:** In Xcode, go to Debug menu > Simulate Memory Warning while app is running, or use `Debug > Terminate WebContent Process` if available
**Expected:** Overlay appears with "Restoring..." spinner, auto-dismisses after JS reinitializes, data from last checkpoint is present
**Why human:** WebContent crash simulation requires Xcode debugger; visual overlay verification is required

---

## Gaps Summary

No gaps found. All 5 success criteria are architecturally satisfied by the implementation. The 4 human verification items above are end-to-end integration tests that cannot be verified programmatically — they are behavioral validations requiring the live native shell.

The one design tradeoff to note: `applicationWillTerminate` on macOS cannot complete a JS→Swift checkpoint round-trip synchronously before the process exits. This is an intentional, documented limitation (per CONTEXT.md and RESEARCH.md Pitfall 2): the accepted behavior is that the last autosave checkpoint (max 30 seconds old) is the macOS quit recovery point.

---

_Verified: 2026-03-03T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
