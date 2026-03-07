---
phase: 40-cloudkit-card-sync
plan: 01
subsystem: sync
tags: [cloudkit, cksyncengine, conflict-resolution, push-notifications, sync-status, swiftui]

# Dependency graph
requires:
  - phase: 39-cloudkit-architecture
    plan: 02
    provides: "SyncManager actor with CKSyncEngineDelegate, offline queue, state persistence"
  - phase: 39-cloudkit-architecture
    plan: 03
    provides: "SyncMerger in NativeBridge.ts, bidirectional bridge wiring"
provides:
  - "Server-wins conflict resolution in SyncManager.handleSentRecordZoneChanges"
  - "fetchChanges() method for foreground polling from scenePhase .active"
  - "Remote notification registration on both macOS and iOS for CKSyncEngine push"
  - "SyncStatusPublisher ObservableObject with idle/syncing/error states"
  - "SyncStatusView SwiftUI toolbar icon with error popover"
  - "First-launch and encryptedDataReset re-upload flags via consumeReuploadFlag()"
affects: [40-02-card-sync, 41-connection-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SyncStatusPublisher @MainActor ObservableObject wrapping actor state for SwiftUI", "nonisolated(unsafe) property for cross-isolation status publishing", "CKSyncEngine.fetchChanges() wrapped in Task with try/await"]

key-files:
  created:
    - "native/Isometry/Isometry/SyncStatusView.swift"
  modified:
    - "native/Isometry/Isometry/SyncManager.swift"
    - "native/Isometry/Isometry/IsometryApp.swift"
    - "native/Isometry/Isometry/BridgeManager.swift"
    - "native/Isometry/Isometry/ContentView.swift"

key-decisions:
  - "SyncStatusPublisher defined in SyncManager.swift (same file) with Combine import for ObservableObject conformance"
  - "CKSyncEngine.fetchChanges() is async throws in Xcode 26 SDK -- wrapped in Task with do/catch inside actor method"
  - "Used .pulse symbolEffect instead of .rotate for syncing animation (broader SF Symbol compatibility)"
  - "iOS app delegate added via @UIApplicationDelegateAdaptor for remote notification registration alongside macOS NSApplicationDelegate"

patterns-established:
  - "SyncStatusPublisher: @MainActor ObservableObject bridging actor-isolated SyncManager state to SwiftUI toolbar"
  - "Cross-isolation status update: capture nonisolated(unsafe) publisher reference, update via Task { @MainActor in }"
  - "Platform-conditional app delegates: #if os(macOS) NSApplicationDelegateAdaptor / #else UIApplicationDelegateAdaptor"

requirements-completed: [SYNC-04, SYNC-05, SYNC-06, SYNC-09]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 40 Plan 01: Swift-Side Sync Engine Completion Summary

**Server-wins conflict resolution, foreground polling on .active, push notification registration, and 3-state SwiftUI sync status toolbar icon with error popover**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T04:43:36Z
- **Completed:** 2026-03-07T04:48:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Server-wins conflict resolution in handleSentRecordZoneChanges: accepts server record, archives system fields, forwards resolved record to JS SyncMerger via BridgeManager (SYNC-04)
- fetchChanges() method triggers CKSyncEngine remote fetch, called from IsometryApp on every scenePhase .active transition (SYNC-05)
- Remote notification registration at app launch on both macOS (NSApplication) and iOS (UIApplication) so CKSyncEngine receives push updates (SYNC-06)
- SyncStatusPublisher ObservableObject with 3 states (idle/syncing/error) updated via CKSyncEngine lifecycle events (willFetchChanges/didFetchChanges/willSendChanges/didSendChanges) (SYNC-09)
- SyncStatusView SwiftUI toolbar icon: checkmark.icloud (idle), arrow.triangle.2.circlepath.icloud with pulse (syncing), exclamationmark.icloud with tap-for-error-popover (error)
- First-launch and encryptedDataReset re-upload flags with consumeReuploadFlag() for Plan 40-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Conflict resolution, foreground poll, and push notification registration** - `3761edae` (feat)
2. **Task 2: SyncStatusView toolbar icon with error popover** - `73a9d0d0` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `native/Isometry/Isometry/SyncManager.swift` - SyncStatusPublisher class, fetchChanges(), consumeReuploadFlag(), server-wins conflict resolution, lifecycle status publishing, encryptedDataReset re-upload flag
- `native/Isometry/Isometry/IsometryApp.swift` - Foreground fetchChanges() in .active handler, iOS AppDelegateIOS for registerForRemoteNotifications, macOS applicationDidFinishLaunching for registerForRemoteNotifications, SyncStatusPublisher wiring in initializeSyncManager()
- `native/Isometry/Isometry/BridgeManager.swift` - Added syncStatusPublisher @Published property for SwiftUI toolbar access
- `native/Isometry/Isometry/SyncStatusView.swift` - New file: 3-state sync icon with SF Symbols, error popover on tap
- `native/Isometry/Isometry/ContentView.swift` - Added SyncStatusView toolbar item after sidebar toggle, before import menu

## Decisions Made
- SyncStatusPublisher defined in SyncManager.swift (not a separate file) with explicit Combine import -- keeps the publisher close to its producer
- CKSyncEngine.fetchChanges() is async throws in the current Xcode 26 SDK (not documented in Apple sample) -- wrapped in Task with do/catch error logging
- Used .pulse symbolEffect instead of .rotate for the syncing animation -- .rotate is not available for the chosen SF Symbol; .pulse provides clear visual feedback
- iOS remote notification registration uses a separate AppDelegateIOS class via @UIApplicationDelegateAdaptor alongside the existing macOS NSApplicationDelegateAdaptor

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CKSyncEngine.fetchChanges() is async throws**
- **Found during:** Task 1 (fetchChanges method)
- **Issue:** Plan specified `syncEngine?.fetchChanges()` as a synchronous call, but Xcode 26 SDK declares it as `async throws`
- **Fix:** Wrapped in `Task { do { try await syncEngine?.fetchChanges() } catch { ... } }` inside the actor method
- **Files modified:** native/Isometry/Isometry/SyncManager.swift
- **Verification:** Xcode build succeeds with zero errors
- **Committed in:** 3761edae (Task 1 commit)

**2. [Rule 3 - Blocking] SyncStatusPublisher requires Combine import**
- **Found during:** Task 1 (SyncStatusPublisher class)
- **Issue:** SyncManager.swift only imported CloudKit and os. ObservableObject/@Published require Combine.
- **Fix:** Added `import Combine` to SyncManager.swift
- **Files modified:** native/Isometry/Isometry/SyncManager.swift
- **Verification:** Xcode build succeeds with zero errors
- **Committed in:** 3761edae (Task 1 commit)

**3. [Rule 1 - Bug] nonisolated(unsafe) property access in nonisolated async context**
- **Found during:** Task 1 (handleEvent lifecycle status updates)
- **Issue:** Plan used `await self.statusPublisher` to access the nonisolated(unsafe) property, but `await` is invalid for nonisolated(unsafe) properties
- **Fix:** Access statusPublisher directly without await (nonisolated(unsafe) allows synchronous access from any context)
- **Files modified:** native/Isometry/Isometry/SyncManager.swift
- **Verification:** Xcode build succeeds with zero errors
- **Committed in:** 3761edae (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for Swift 6 strict concurrency and Xcode 26 SDK compliance. No scope creep.

## Issues Encountered
- Pre-existing npm Run Script build phase fails (package.json not at expected path) -- unrelated to this plan's Swift changes. Swift compilation succeeds with zero errors and zero warnings.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SyncManager is fully wired for conflict resolution, foreground polling, and push notifications
- SyncStatusPublisher drives the toolbar icon -- status updates happen automatically on sync lifecycle events
- consumeReuploadFlag() is ready for Plan 40-02 to trigger initial full upload and encryptedDataReset recovery
- Plan 40-02 can implement the JS-side sync loop closure: export-all-cards bridge message, post-merge refresh event, mutation hook bypass
- Note: Pre-existing npm build phase issue does not block Swift development

## Self-Check: PASSED

- SyncStatusView.swift: FOUND
- SyncManager.swift: FOUND
- IsometryApp.swift: FOUND
- ContentView.swift: FOUND
- BridgeManager.swift: FOUND
- 40-01-SUMMARY.md: FOUND
- Commit 3761edae: FOUND
- Commit 73a9d0d0: FOUND

---
*Phase: 40-cloudkit-card-sync*
*Completed: 2026-03-07*
