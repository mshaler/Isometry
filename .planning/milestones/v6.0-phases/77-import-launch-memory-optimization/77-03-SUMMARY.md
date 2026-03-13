---
phase: 77-import-launch-memory-optimization
plan: 03
subsystem: native
tags: [swift, wkwebview, wasm, launch-optimization, crash-recovery, testing]

requires:
  - phase: 77-import-launch-memory-optimization
    provides: Phase 77 CONTEXT.md and RESEARCH.md (warm-up and memory budget analysis)

provides:
  - WKWebView warm-up triggered from IsometryApp.task{} before ContentView.onAppear
  - setupWebViewIfNeeded(savedTheme:) on BridgeManager with double-init guard
  - Integration tests: webContent termination recovery + silent crash detection guards

affects:
  - Phase 78 (CI gates require post-optimization measurements)
  - Any future native shell lifecycle changes

tech-stack:
  added: []
  patterns:
    - "IsometryApp.task{} fires before ContentView.onAppear — use for eager platform init"
    - "setupWebViewIfNeeded guard pattern: check webView == nil before any WKWebView creation"
    - "MockMessage: WKScriptMessage subclass with override body/name for didReceive() testing"
    - "Task { @MainActor in } in nonisolated delegate requires 0.1s Task.sleep settle in tests"

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/BridgeManager.swift
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/IsometryApp.swift
    - native/Isometry/IsometryTests/BridgeManagerTests.swift

key-decisions:
  - "setupWebViewIfNeeded moved to BridgeManager (not ContentView) so IsometryApp.task{} can call it before ContentView is visible"
  - "webView stored as @Published strong ref on BridgeManager (no retain cycle: WKWebView.navigationDelegate is weak in WebKit)"
  - "ContentView.onAppear calls setupWebViewIfNeeded as fallback for cold-start race — guard prevents double-init"
  - "MockMessage subclasses WKScriptMessage with override body/name — cleanest approach for didReceive() isolation without protocol indirection"

requirements-completed: [LNCH-02, MMRY-03]

duration: 5min
completed: 2026-03-12
---

# Phase 77 Plan 03: WKWebView Warm-Up + Termination Recovery Tests Summary

**WKWebView setup moved to BridgeManager.setupWebViewIfNeeded() called from IsometryApp.task{} to hide WASM compile behind splash, with integration tests verifying isJSReady reset and recovery overlay on WebContent process termination**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T00:47:33Z
- **Completed:** 2026-03-13T00:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- WKWebView setup now triggers from IsometryApp.body `.task{}` before ContentView.onAppear, hiding WASM streaming compile behind the native launch animation
- `setupWebViewIfNeeded(savedTheme:)` extracted to BridgeManager with `webView == nil` guard — prevents double-initialization if .task{} and .onAppear race
- 3 new BridgeManager integration tests: termination recovery (isJSReady=false, overlay=true) + 2 silent crash detection guard tests — all 7 BridgeManager tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Move WKWebView setup earlier in app lifecycle** - `0620f24d` (feat)
2. **Task 2: Add WKWebView termination recovery integration test** - `238b87a5` (test)

## Files Created/Modified
- `native/Isometry/Isometry/BridgeManager.swift` - Added setupWebViewIfNeeded(savedTheme:), @Published webView
- `native/Isometry/Isometry/IsometryApp.swift` - Added .task{} modifier calling setupWebViewIfNeeded
- `native/Isometry/Isometry/ContentView.swift` - Removed local webView @State, use bridgeManager.webView; onAppear as fallback
- `native/Isometry/IsometryTests/BridgeManagerTests.swift` - Added 3 tests + MockMessage helper

## Decisions Made
- `setupWebViewIfNeeded` lives on BridgeManager (not ContentView) so IsometryApp can call it — ContentView's setupWebView() was private and inaccessible from the App struct
- `webView` promoted to `@Published` strong property on BridgeManager; no retain cycle because WKWebView.navigationDelegate is `weak var` in WebKit's implementation
- ContentView.onAppear remains as fallback to call `setupWebViewIfNeeded` in case .task{} hasn't fired — the guard inside prevents double-init
- `MockMessage` subclasses WKScriptMessage with `override var body` to inject test payloads into `didReceive()` without extracting an interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @Published cannot be combined with weak on webView**
- **Found during:** Task 1 (build failure after adding @Published weak var webView)
- **Issue:** Swift compiler error: "property with a wrapper cannot also be weak"
- **Fix:** Changed to strong @Published var webView; safe because WKWebView.navigationDelegate is a weak property in WebKit (no retain cycle)
- **Files modified:** BridgeManager.swift
- **Verification:** Build succeeded with no errors
- **Committed in:** 0620f24d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - compiler bug)
**Impact on plan:** Fix required for correctness. No scope creep — webView ownership model is correct.

## Issues Encountered
- File path in plan was `native/Isometry/Isometry/Bridge/BridgeManager.swift` (with Bridge/ subdirectory) but actual path is `native/Isometry/Isometry/BridgeManager.swift` — adapted automatically

## Next Phase Readiness
- WKWebView warm-up complete (LNCH-02 satisfied)
- Termination recovery integration test coverage complete (MMRY-03 satisfied)
- Ready for Phase 77 completion / Phase 78 CI gate

## Self-Check: PASSED

- FOUND: native/Isometry/Isometry/BridgeManager.swift
- FOUND: native/Isometry/IsometryTests/BridgeManagerTests.swift
- FOUND: 0620f24d (Task 1 commit)
- FOUND: 238b87a5 (Task 2 commit)
- FOUND: 80b999eb (docs commit)

---
*Phase: 77-import-launch-memory-optimization*
*Completed: 2026-03-12*
