---
phase: 12-bridge-data-persistence
plan: 03
subsystem: bridge
tags: [swift, wkwebview, wknavigationdelegate, lifecycle, autosave, crash-recovery, scenePhase, NSApplicationDelegateAdaptor]

# Dependency graph
requires:
  - phase: 12-bridge-data-persistence plan 01
    provides: BridgeManager.swift with WKScriptMessageHandler dispatch, register(with:), requestCheckpoint(), showingRecoveryOverlay
  - phase: 12-bridge-data-persistence plan 02
    provides: DatabaseManager actor with loadDatabase(), saveCheckpoint(), isDirty, markDirty(), clearDirty()

provides:
  - BridgeManager WKNavigationDelegate with webViewWebContentProcessDidTerminate crash recovery
  - BridgeManager.configure(webView:) setting weak ref + navigationDelegate
  - BridgeManager autosave timer (30s, Timer.scheduledTimer on main run loop)
  - BridgeManager.saveIfDirty() for lifecycle events (fire-and-forget background save)
  - BridgeManager.checkForSilentCrash() for webkit bug #176855 workaround
  - ContentView with @ObservedObject bridgeManager, recovery overlay ZStack, DatabaseManager wiring
  - IsometryApp with scenePhase observer, iOS performBackgroundSave (beginBackgroundTask), macOS NSApplicationDelegateAdaptor
  - Single BridgeManager instance shared between IsometryApp (lifecycle) and ContentView (webView)

affects:
  - 13-file-picker (uses BridgeManager.native:action stub already wired)
  - 14-cloudkit-sync (uses BridgeManager.sendSyncNotification already wired)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scenePhase .active starts autosave; .background stops autosave + triggers iOS background save"
    - "Timer.scheduledTimer on main run loop auto-pauses on background — no extra scenePhase handling needed"
    - "NSApplicationDelegateAdaptor for macOS termination — ScenePhase.background does NOT fire on cmd-Q"
    - "beginBackgroundTask wraps iOS background save with proper expiration handler calling endBackgroundTask"
    - "BridgeManager shared via @StateObject in App, @ObservedObject in ContentView (Option A — explicit dependency)"
    - "WKNavigationDelegate on BridgeManager with nonisolated + Task @MainActor bridge for Swift 6 compliance"
    - "Recovery overlay auto-dismisses when native:ready fires after WebContent reload"

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/BridgeManager.swift
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/IsometryApp.swift

key-decisions:
  - "BridgeManager shared between IsometryApp and ContentView via init parameter (Option A) not @EnvironmentObject — explicit dependency, no magic"
  - "Timer.scheduledTimer on main run loop chosen over Task.sleep loop — auto-pauses on background satisfying DATA-05 without extra code"
  - "NSApplicationDelegateAdaptor for macOS quit save — ScenePhase.background doesn't fire on cmd-Q (Pitfall 2)"
  - "beginBackgroundTask expiration handler must call endBackgroundTask to prevent watchdog kill — fixed with proper closure capture"
  - "webViewWebContentProcessDidTerminate is nonisolated — bridges to @MainActor via Task for Swift 6 compliance"
  - "2-second grace period in performBackgroundSave allows JS→Swift checkpoint round-trip before suspension"

patterns-established:
  - "App-level lifecycle: IsometryApp owns bridgeManager @StateObject, passes to ContentView as @ObservedObject"
  - "Recovery flow: process crash → showingRecoveryOverlay=true + reload → native:ready → showingRecoveryOverlay=false"
  - "Autosave tick: isDirty check → requestCheckpoint → JS export → checkpoint postMessage → databaseManager.saveCheckpoint"

requirements-completed: [DATA-04, DATA-05, SHELL-05]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 12 Plan 03: App Lifecycle Integration Summary

**BridgeManager wired into iOS/macOS app lifecycle with 30-second autosave timer, background save via beginBackgroundTask, macOS NSApplicationDelegateAdaptor for quit save, and WebContent crash recovery overlay that auto-dismisses on JS ready signal**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T16:55:49Z
- **Completed:** 2026-03-03T17:00:04Z
- **Tasks:** 3 (Tasks 2+3 committed together as they are tightly coupled)
- **Files modified:** 3

## Accomplishments
- BridgeManager gains WKNavigationDelegate with webViewWebContentProcessDidTerminate for crash recovery
- Autosave timer (30s, Timer.scheduledTimer on main run loop) automatically pauses on background
- scenePhase .active starts autosave + secondary crash detection; .background stops + triggers save
- iOS background save uses beginBackgroundTask for ~30s execution window with proper expiration handler
- macOS termination handled via NSApplicationDelegateAdaptor (ScenePhase unreliable on cmd-Q)
- ContentView recovery overlay shown on WebContent crash, auto-dismisses when JS signals native:ready
- Single BridgeManager instance shared between IsometryApp (@StateObject) and ContentView (@ObservedObject)
- Both macOS and iOS builds pass; 1172 TypeScript tests still passing

## Task Commits

1. **Task 1: Extend BridgeManager with WKNavigationDelegate, autosave timer, saveIfDirty** - `d9af6c19` (feat)
2. **Tasks 2+3: ContentView + IsometryApp lifecycle wiring** - `33eca3f6` (feat)

_Note: Tasks 2 and 3 committed together because ContentView requires IsometryApp's bridgeManager parameter to compile — they form a single atomic compilation unit._

## Files Created/Modified
- `native/Isometry/Isometry/BridgeManager.swift` - Added WKNavigationDelegate extension, configure(webView:), startAutosave/stopAutosave, autosaveTick, saveIfDirty, checkForSilentCrash; updated native:ready to dismiss overlay
- `native/Isometry/Isometry/ContentView.swift` - Rewritten to accept @ObservedObject bridgeManager, add recovery overlay ZStack, setupWebView() in onAppear with DatabaseManager wiring
- `native/Isometry/Isometry/IsometryApp.swift` - Rewritten with scenePhase observer, @StateObject bridgeManager, iOS performBackgroundSave with beginBackgroundTask, macOS NSApplicationDelegateAdaptor + IsometryAppDelegate

## Decisions Made
- BridgeManager shared via init parameter (Option A) not @EnvironmentObject — explicit, no hidden dependency
- Timer.scheduledTimer chosen over Task.sleep loop — auto-pauses on background without extra lifecycle code
- NSApplicationDelegateAdaptor for macOS termination — ScenePhase.background doesn't fire on cmd-Q
- webViewWebContentProcessDidTerminate is `nonisolated` with `Task { @MainActor }` bridge for Swift 6
- Tasks 2 and 3 committed together: ContentView(@ObservedObject bridgeManager) and IsometryApp(@StateObject) must compile together

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 2 and 3 committed atomically (not separately)**
- **Found during:** Task 2 (ContentView rewrite)
- **Issue:** ContentView rewritten to accept `bridgeManager: BridgeManager` parameter, but old IsometryApp still called `ContentView()` with no args — build failed after Task 2 alone
- **Fix:** Proceeded immediately to Task 3 (IsometryApp rewrite) and committed both files in one atomic commit
- **Files modified:** ContentView.swift, IsometryApp.swift
- **Verification:** BUILD SUCCEEDED macOS + iOS Simulator after combined commit
- **Committed in:** 33eca3f6 (Tasks 2+3 combined commit)

---

**Total deviations:** 1 auto-handled (1 blocking — intermediate build failure during multi-file refactor)
**Impact on plan:** Tasks 2 and 3 logically committed as one unit instead of separately. No scope creep. All plan requirements met.

## Issues Encountered
- Tasks 2 and 3 are tightly coupled: ContentView no longer compiles without the IsometryApp changes. Handled by committing both together as a single atomic unit per deviation Rule 3.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BridgeManager is fully integrated into the app lifecycle — autosave, background save, crash recovery all active
- Data persistence pipeline is complete: JS mutations → mutated signal → markDirty → autosave → requestCheckpoint → JS exports → checkpoint postMessage → saveCheckpoint → disk
- ContentView recovery overlay ready to be tested manually in Xcode Simulator
- Phase 13 (file picker) uses BridgeManager.native:action stub already in place
- Phase 14 (CloudKit sync) uses BridgeManager.sendSyncNotification already in place
- No blockers for subsequent phases

## Self-Check: PASSED

- BridgeManager.swift: FOUND at native/Isometry/Isometry/BridgeManager.swift
- ContentView.swift: FOUND at native/Isometry/Isometry/ContentView.swift
- IsometryApp.swift: FOUND at native/Isometry/Isometry/IsometryApp.swift
- Task 1 commit d9af6c19: FOUND in git log
- Tasks 2+3 commit 33eca3f6: FOUND in git log
- macOS BUILD SUCCEEDED: verified
- iOS Simulator BUILD SUCCEEDED: verified
- 1172 TypeScript tests: PASSING

---
*Phase: 12-bridge-data-persistence*
*Completed: 2026-03-03*
