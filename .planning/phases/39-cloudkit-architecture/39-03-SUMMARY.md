---
phase: 39-cloudkit-architecture
plan: 03
subsystem: sync
tags: [cloudkit, bridge-protocol, sync-merger, cksyncengine, bidirectional-sync]

# Dependency graph
requires:
  - phase: 39-cloudkit-architecture
    plan: 02
    provides: "SyncManager actor with CKSyncEngineDelegate, offline queue, state persistence"
provides:
  - "SyncMerger in NativeBridge.ts: incoming CloudKit records merged into sql.js via INSERT OR REPLACE"
  - "Enhanced mutated message: outgoing JS mutations carry changeset payloads for CKSyncEngine offline queue"
  - "Bidirectional wiring: SyncManager -> BridgeManager -> NativeBridge -> sql.js and JS mutations -> BridgeManager -> SyncManager"
affects: [40-card-sync, 41-connection-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SyncMerger pattern: incoming records as INSERT OR REPLACE via individual db:exec calls", "Changeset extraction: mutation type mapped to structured change data for sync queue", "MainActor hop from actor: Task { @MainActor in } for cross-isolation calls"]

key-files:
  created: []
  modified:
    - "src/native/NativeBridge.ts"
    - "native/Isometry/Isometry/BridgeManager.swift"
    - "native/Isometry/Isometry/SyncManager.swift"
    - "native/Isometry/Isometry/SyncTypes.swift"

key-decisions:
  - "db:exec takes single {sql, params} per call (not batched statements array) -- SyncMerger runs records sequentially with individual db:exec calls and per-statement error handling"
  - "CodableValue.from(_: Any) factory uses switch on Swift runtime types (String, Int, Double, Bool, NSNull) with String(describing:) fallback"
  - "Connection CKRecord.Reference fields dereferenced to recordName strings before dispatch to JS (JS has no CKRecord.Reference concept)"

patterns-established:
  - "SyncMerger: incoming CloudKit records merged via buildCardMergeSQL/buildConnectionMergeSQL helpers with full schema coverage"
  - "extractChangeset: mutation type -> structured change data for offline queue (undefined for bulk operations like db:exec, etl:import)"
  - "Cross-isolation BridgeManager call: Task { @MainActor in self.bridgeManager?.method() } from actor context"

requirements-completed: [SYNC-08]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 39 Plan 03: Bidirectional Bridge Protocol Summary

**SyncMerger merges incoming CloudKit records via INSERT OR REPLACE, enhanced mutated message carries changesets to CKSyncEngine offline queue**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T03:47:15Z
- **Completed:** 2026-03-07T03:52:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced Phase 14 native:sync stub with full SyncMerger implementation that runs INSERT OR REPLACE via db:exec for incoming CloudKit records (SYNC-08)
- Enhanced mutated message to carry optional changes array with recordType, recordId, operation, and fields for CKSyncEngine offline queue
- BridgeManager.mutated handler extracts changeset and forwards to SyncManager.addPendingChange
- SyncManager.handleFetchedRecordZoneChanges builds records array from CKRecord modifications/deletions and dispatches to JS via BridgeManager.sendSyncNotification
- Added CodableValue.from(_: Any) factory method for JSON-to-CodableValue conversion

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement SyncMerger in NativeBridge.ts and enhance mutated message** - `3e9b4195` (feat)
2. **Task 2: Wire SyncManager to BridgeManager for bidirectional sync flow** - `89c7e41b` (feat)

**Plan metadata:** `8608ba9d` (docs: complete plan)

## Files Created/Modified
- `src/native/NativeBridge.ts` - SyncMerger handler, buildCardMergeSQL, buildConnectionMergeSQL, extractChangeset, enhanced installMutationHook
- `native/Isometry/Isometry/BridgeManager.swift` - Enhanced mutated handler with changeset extraction, updated sendSyncNotification with record count logging
- `native/Isometry/Isometry/SyncManager.swift` - handleFetchedRecordZoneChanges now builds and dispatches records to JS via BridgeManager
- `native/Isometry/Isometry/SyncTypes.swift` - CodableValue.from(_: Any) factory method

## Decisions Made
- db:exec takes single {sql, params} per call (not batched statements array as plan suggested) -- adapted SyncMerger to run records sequentially with individual db:exec calls and per-statement error handling. This is a deviation from the plan's interface comment but matches the actual WorkerBridge protocol.
- CodableValue.from(_: Any) factory uses switch on Swift runtime types (String, Int, Double, Bool, NSNull) with String(describing:) fallback for unknown types
- Connection CKRecord.Reference fields dereferenced to recordName strings before dispatch to JS (JS has no CKRecord.Reference concept)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict mode bracket notation for Record index signatures**
- **Found during:** Task 1 (buildCardMergeSQL, buildConnectionMergeSQL, extractChangeset)
- **Issue:** TypeScript `noPropertyAccessFromIndexSignature` requires bracket notation (`fields['name']`) for `Record<string, unknown>` types, not dot notation (`fields.name`)
- **Fix:** Changed all property accesses on `Record<string, unknown>` parameters to use bracket notation
- **Files modified:** src/native/NativeBridge.ts
- **Verification:** `npx tsc --noEmit` shows no NativeBridge-specific errors
- **Committed in:** 3e9b4195 (Task 1 commit)

**2. [Rule 3 - Blocking] db:exec protocol mismatch: single statement, not batched array**
- **Found during:** Task 1 (SyncMerger implementation)
- **Issue:** Plan specified `db:exec` accepts `{ statements: Array<{sql, params}> }` but actual protocol takes `{ sql: string; params: unknown[] }` (single statement)
- **Fix:** SyncMerger loops over records and calls `bridge.send('db:exec', stmt)` individually for each statement with per-statement error handling
- **Files modified:** src/native/NativeBridge.ts
- **Verification:** TypeScript compiles, protocol type matches
- **Committed in:** 3e9b4195 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript strict mode compliance and correct protocol usage. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in normalizeNativeCard (line 515+) and test files are not related to this plan's changes -- documented as known technical debt from earlier phases.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete bidirectional sync data flow is operational: CloudKit -> SyncManager -> BridgeManager -> NativeBridge SyncMerger -> sql.js Worker
- Outgoing mutations flow: JS mutations -> enhanced mutated message -> BridgeManager -> SyncManager offline queue
- Phase 40 (Card Sync) can begin implementing actual card record creation/updates in CloudKit
- Phase 41 (Connection Sync) can leverage the same SyncMerger and changeset infrastructure
- Note: Provisioning profile may need regeneration for CloudKit capability (pre-existing technical debt)

## Self-Check: PASSED

- NativeBridge.ts: FOUND
- BridgeManager.swift: FOUND
- SyncManager.swift: FOUND
- SyncTypes.swift: FOUND
- 39-03-SUMMARY.md: FOUND
- Commit 3e9b4195: FOUND
- Commit 89c7e41b: FOUND

---
*Phase: 39-cloudkit-architecture*
*Completed: 2026-03-07*
