---
phase: 40-cloudkit-card-sync
plan: 02
subsystem: sync
tags: [cloudkit, sync-merger, mutation-hook, custom-event, export-all-cards, bridge-protocol]

# Dependency graph
requires:
  - phase: 40-cloudkit-card-sync
    plan: 01
    provides: "Server-wins conflict resolution, fetchChanges(), push notifications, SyncStatusPublisher, consumeReuploadFlag()"
  - phase: 39-cloudkit-architecture
    plan: 03
    provides: "SyncMerger in NativeBridge.ts, bidirectional bridge wiring, CodableValue.from()"
provides:
  - "SyncMerger bypass of mutation hook via unwrapped bridge.send (prevents sync echo loops)"
  - "JS-internal CustomEvent 'isometry:sync-complete' for post-merge view refresh"
  - "exportAllCards handler on window.__isometry for initial upload and encryptedDataReset recovery"
  - "StateCoordinator.scheduleUpdate() public API for external sync-complete trigger"
  - "BridgeManager native:export-all-cards handler queuing cards as PendingChange entries"
  - "Initial upload trigger after JS ready via consumeReuploadFlag()"
affects: [41-connection-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Unwrapped send pattern: capture bridge.send before mutation hook wraps it for sync-safe operations", "JS-internal CustomEvent for cross-module sync-to-view signaling without bridge coupling", "Public scheduleUpdate() for non-provider external triggers"]

key-files:
  created: []
  modified:
    - "src/native/NativeBridge.ts"
    - "src/providers/StateCoordinator.ts"
    - "src/main.ts"
    - "native/Isometry/Isometry/BridgeManager.swift"

key-decisions:
  - "unwrappedSend captured before installMutationHook for both SyncMerger and exportAllCards -- defensive bypass even for db:query"
  - "scheduleUpdate() made public (single word change) rather than adding a new forceUpdate() method -- existing deduplication logic already handles it"
  - "0.5s Task.sleep delay after sendLaunchPayload before checking consumeReuploadFlag -- pragmatic timing for JS database load"

patterns-established:
  - "Unwrapped send: save bridge.send.bind(bridge) BEFORE mutation hook, pass to sync-related handlers"
  - "CustomEvent signaling: window.dispatchEvent for JS-internal sync-complete, window.addEventListener in main.ts"
  - "Initial upload gating: BridgeManager checks consumeReuploadFlag() after sendLaunchPayload with delay"

requirements-completed: [SYNC-01]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 40 Plan 02: JS-Side Sync Loop Closure Summary

**SyncMerger bypasses mutation hook via unwrapped bridge.send, dispatches JS-internal CustomEvent for view refresh, and exportAllCards enables initial CloudKit upload via native:export-all-cards bridge message**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T04:51:29Z
- **Completed:** 2026-03-07T04:54:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SyncMerger now uses unwrapped bridge.send (captured before mutation hook installation) so incoming CloudKit records do NOT trigger the mutated message back to Swift -- prevents sync echo loops (Pitfall 1 and 6 from research)
- Post-merge CustomEvent `isometry:sync-complete` dispatched after successful merge, triggering StateCoordinator -> ViewManager -> D3 data join pipeline for view refresh
- exportAllCards handler on window.__isometry queries all non-deleted cards via unwrapped send and posts them to Swift as native:export-all-cards
- BridgeManager handles native:export-all-cards by iterating cards, converting fields via CodableValue.from(), and queuing each as a PendingChange entry for CKSyncEngine
- Initial upload triggers automatically after JS ready when SyncManager's re-upload flag is set (first launch or encryptedDataReset recovery)
- StateCoordinator.scheduleUpdate() made public for external sync-complete trigger

## Task Commits

Each task was committed atomically:

1. **Task 1: SyncMerger mutation hook bypass and post-merge refresh event** - `74472bb9` (feat)
2. **Task 2: native:export-all-cards bridge handler and initial upload trigger** - `85a8af05` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/native/NativeBridge.ts` - unwrappedSend capture, handleNativeSync uses dbExec parameter, CustomEvent dispatch, exportAllCards handler
- `src/providers/StateCoordinator.ts` - scheduleUpdate() made public (was private)
- `src/main.ts` - sync-complete event listener inside if (isNative) block triggers coordinator.scheduleUpdate()
- `native/Isometry/Isometry/BridgeManager.swift` - native:export-all-cards case handler, initial upload trigger after JS ready with consumeReuploadFlag check

## Decisions Made
- Captured unwrappedSend before installMutationHook and used it for both SyncMerger (dbExec parameter) and exportAllCards (db:query call) -- defensive bypass even though db:query is not in MUTATING_TYPES
- Made scheduleUpdate() public instead of adding a new forceUpdate() method -- the existing method already handles deduplication (no-ops if already scheduled), making a separate method unnecessary
- Used 0.5s Task.sleep delay after sendLaunchPayload before checking consumeReuploadFlag -- pragmatic approach to ensure JS has loaded the database from the launch payload before requesting card export

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing npm Run Script build phase fails (package.json not at expected path) -- unrelated to this plan's Swift changes. Swift compilation succeeds with zero errors and zero warnings.
- Pre-existing TypeScript errors in normalizeNativeCard (line 553+) and ETL test files are not related to this plan's changes -- documented as known technical debt from earlier phases.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete bidirectional sync loop is now closed: incoming CloudKit records merge without echo loops, views refresh automatically, and initial upload path is functional
- Phase 40 (CloudKit Card Sync) is fully complete -- both plans delivered
- Phase 41 (Connection Sync) can leverage the same SyncMerger infrastructure for connection records
- The exportAllCards handler queries only cards (WHERE deleted_at IS NULL) -- connection export for Phase 41 will need a similar handler
- Note: Pre-existing npm build phase issue and provisioning profile regeneration remain as known technical debt

## Self-Check: PASSED

- NativeBridge.ts: FOUND
- StateCoordinator.ts: FOUND
- main.ts: FOUND
- BridgeManager.swift: FOUND
- 40-02-SUMMARY.md: FOUND
- Commit 74472bb9: FOUND
- Commit 85a8af05: FOUND

---
*Phase: 40-cloudkit-card-sync*
*Completed: 2026-03-07*
