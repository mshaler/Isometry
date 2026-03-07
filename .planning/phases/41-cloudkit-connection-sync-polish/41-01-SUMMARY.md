---
phase: 41-cloudkit-connection-sync-polish
plan: 01
subsystem: sync
tags: [cloudkit, extractChangeset, soft-delete, batch-ordering, FK-constraints, TDD]

# Dependency graph
requires:
  - phase: 40-cloudkit-card-sync
    provides: "Card sync pipeline, extractChangeset function, handleNativeSync, installMutationHook"
provides:
  - "Fixed extractChangeset: card:delete returns update with deleted_at (not CKRecord delete)"
  - "Fixed extractChangeset: card:create and connection:create use Worker-generated result.id"
  - "Fixed extractChangeset: connection:create includes fields (source_id, target_id, label, weight, via_card_id)"
  - "Batch ordering in handleNativeSync: cards processed before connections for FK constraint satisfaction"
  - "TDD test suite for extractChangeset and handleNativeSync (13 new tests)"
affects: [41-02, cloudkit-sync, connection-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Partition-based batch ordering (filter + concat) for FK constraint satisfaction"
    - "extractChangeset receives result as third parameter for Worker-generated ids"

key-files:
  created: []
  modified:
    - src/native/NativeBridge.ts
    - tests/NativeBridge.test.ts

key-decisions:
  - "extractChangeset exported for direct unit testing (pure function, no side effects)"
  - "handleNativeSync exported for direct unit testing with mock dbExec"
  - "Partition (two filter passes + concat) chosen over sort for batch ordering -- O(n), stable, readable"
  - "globalThis.window mock in tests for Node environment compatibility"

patterns-established:
  - "extractChangeset(type, payload, result) -- third parameter carries Worker return value"
  - "Batch ordering via partition: cardRecords first, connectionRecords second"

requirements-completed: [SYNC-02, SYNC-07]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 41 Plan 01: extractChangeset Bug Fixes + Batch Ordering Summary

**Fixed three extractChangeset bugs (soft-delete operation mapping, create-id sourcing, connection field propagation) and added partition-based batch ordering in handleNativeSync for FK constraint satisfaction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T14:20:57Z
- **Completed:** 2026-03-07T14:24:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- card:delete mutations now sync as CKRecord field UPDATE with deleted_at (not CKRecord DELETE), preserving soft-delete semantics in CloudKit (SYNC-07)
- card:create and connection:create mutations use Worker-generated result.id instead of undefined payload.id (SYNC-02)
- connection:create mutations include all connection fields (source_id, target_id, label, weight, via_card_id) for CloudKit sync
- Incoming sync batches partition Card records before Connection records, satisfying PRAGMA foreign_keys = ON FK constraints
- 13 new TDD tests covering all bug fixes, batch ordering, and FK failure handling (22 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD tests for extractChangeset fixes and batch ordering** - `78a28fab` (test)
2. **Task 2: Fix extractChangeset bugs, pass result in mutation hook, add batch ordering** - `1d8af77b` (feat)

## Files Created/Modified
- `src/native/NativeBridge.ts` - Fixed extractChangeset (3 bugs), added result parameter to mutation hook, added batch ordering in handleNativeSync, exported extractChangeset and handleNativeSync
- `tests/NativeBridge.test.ts` - 13 new tests: extractChangeset (9 tests), batch ordering (2 tests), FK failure handling (2 tests)

## Decisions Made
- Exported extractChangeset and handleNativeSync for direct unit testing -- both are pure/testable functions with no side effects beyond their parameters
- Used partition (two filter + concat) over Array.sort for batch ordering -- O(n), guaranteed stable, more readable than a sort comparator
- Used globalThis.window mock in handleNativeSync tests for Node test environment compatibility (vitest runs in Node, not jsdom)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added globalThis.window mock for handleNativeSync tests**
- **Found during:** Task 1 (TDD test creation)
- **Issue:** handleNativeSync uses window.dispatchEvent internally, but vitest runs in Node environment (no window global)
- **Fix:** Added beforeEach/afterEach blocks that create/destroy a minimal window mock on globalThis
- **Files modified:** tests/NativeBridge.test.ts
- **Verification:** All handleNativeSync tests run without ReferenceError
- **Committed in:** 78a28fab (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- test infrastructure fix required for Node environment compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- extractChangeset correctly maps all mutation types to CKRecord operations
- Batch ordering ensures FK constraints are satisfied for incoming sync batches
- Ready for Plan 02: export-all connection extension and end-to-end validation

---
*Phase: 41-cloudkit-connection-sync-polish*
*Completed: 2026-03-07*
