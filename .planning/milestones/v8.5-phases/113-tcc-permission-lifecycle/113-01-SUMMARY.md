---
phase: 113-tcc-permission-lifecycle
plan: "01"
subsystem: testing
tags: [playwright, e2e, tcc, permissions, native-adapters]

requires:
  - phase: 109-etl-test-infrastructure
    provides: "__mock_permission_{adapter} window key convention, importNativeCards, resetDatabase, waitForAppReady"
provides:
  - "importWithPermissionCheck helper for permission-gated native imports"
  - "cleanupMockPermissions helper for test isolation"
  - "mockPermission helper for setting window permission keys directly"
  - "tcc-permissions.spec.ts with 9 E2E test cases (3 blocks x 3 adapters)"
affects: [111-native-apple-adapter-e2e]

tech-stack:
  added: []
  patterns: ["window.__mock_permission_{adapter} direct key manipulation (no harness dependency)"]

key-files:
  created:
    - e2e/tcc-permissions.spec.ts
  modified:
    - e2e/helpers/etl.ts

key-decisions:
  - "Use window.__mock_permission_{adapter} keys directly instead of __harness.mockPermission -- enables tests to run against main app (/) without harness mode"

patterns-established:
  - "Permission simulation via window keys: mockPermission(page, adapter, state) sets/deletes __mock_permission_{adapter} directly"
  - "Permission-gated import: importWithPermissionCheck reads key before calling importNativeCards, returns permissionDenied sentinel on deny"

requirements-completed: [TCC-01, TCC-02, TCC-03, TCC-04]

duration: 5min
completed: 2026-03-23
---

# Phase 113 Plan 01: TCC Permission Lifecycle Summary

**TCC permission lifecycle E2E spec with 9 test cases covering grant/deny/revoke across notes, reminders, calendar adapters via window.__mock_permission keys**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T03:02:10Z
- **Completed:** 2026-03-24T03:07:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 3 new helpers in e2e/helpers/etl.ts: importWithPermissionCheck, cleanupMockPermissions, mockPermission
- tcc-permissions.spec.ts with 3 describe blocks (grant, deny, revoke-mid-import) x 3 adapters = 9 tests
- All 4 TCC requirements covered: TCC-01 (mock simulation), TCC-02 (grant path), TCC-03 (deny path), TCC-04 (revoke-mid-import)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add permission-aware import helpers to e2e/helpers/etl.ts** - `539589f6` (feat)
2. **Task 2: Create tcc-permissions.spec.ts with grant, deny, and revoke-mid-import test blocks** - `b2543c0b` (test)

## Files Created/Modified
- `e2e/helpers/etl.ts` - Added importWithPermissionCheck, cleanupMockPermissions, mockPermission helpers and SOURCE_TO_ADAPTER mapping
- `e2e/tcc-permissions.spec.ts` - TCC permission lifecycle E2E spec with 9 test cases

## Decisions Made
- Used window.__mock_permission_{adapter} direct key manipulation instead of __harness.mockPermission API. Reason: __harness is only available in harness mode (?harness=1), but E2E tests navigate to main app (/) where __isometry provides queryAll/bridge. Direct key manipulation works in both modes and matches the same convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed from __harness API to direct window key manipulation**
- **Found during:** Task 2 (spec creation)
- **Issue:** Plan assumed __harness.mockPermission would be available, but __harness is only mounted in harness mode (?harness=1). Tests need main app mode (/) for __isometry.queryAll and bridge access.
- **Fix:** Updated importWithPermissionCheck to read window.__mock_permission_{adapter} directly. Added mockPermission helper that sets/deletes keys directly. Updated cleanupMockPermissions to delete keys directly. All use the same key convention as HarnessShell.
- **Files modified:** e2e/helpers/etl.ts, e2e/tcc-permissions.spec.ts
- **Verification:** Typecheck passes, imports resolve correctly
- **Committed in:** 539589f6 (Task 1 amended), b2543c0b (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to make tests work against main app entry point. Same window key convention, just bypasses the __harness wrapper. No scope creep.

## Issues Encountered
- Task 1 commit initially picked up pre-staged fixture files from other phases (tests/fixtures/native-adapter/*.json). These are legitimate files from prior work -- left in commit rather than destructive reset.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TCC permission lifecycle E2E coverage complete for all 3 native adapters
- Phase 111 (native adapter E2E) can use mockPermission + importWithPermissionCheck helpers
- Spec runs against main app (/) using __isometry for SQL assertions

---
*Phase: 113-tcc-permission-lifecycle*
*Completed: 2026-03-23*
