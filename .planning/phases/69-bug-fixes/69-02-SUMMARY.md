---
phase: 69-bug-fixes
plan: 02
subsystem: views
tags: [sql, sqlite, connections, network-view, tree-view, bug-fix]

# Dependency graph
requires:
  - phase: 69-01
    provides: "SVG text CSS reset for view rendering"
provides:
  - "Fixed NetworkView connection query (no deleted_at on connections table)"
  - "Fixed TreeView connection query (no deleted_at on connections table)"
  - "Regression tests verifying SQL correctness for both views"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "connections table uses CASCADE deletion, not soft-delete -- never query deleted_at on connections"

key-files:
  created: []
  modified:
    - "src/views/NetworkView.ts"
    - "src/views/TreeView.ts"
    - "tests/views/NetworkView.test.ts"
    - "tests/views/TreeView.test.ts"

key-decisions:
  - "Removed invalid deleted_at clause rather than adding column -- connections table design (CASCADE) is correct"

patterns-established:
  - "Connections table queries must never reference deleted_at -- cards are soft-deleted, connections are CASCADE-deleted"

requirements-completed: [BUGF-03, BUGF-04]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 69 Plan 02: deleted_at Null-Safety Bug Fixes Summary

**Removed invalid deleted_at IS NULL clauses from NetworkView and TreeView connection queries that caused SQLite "no such column" errors breaking edge rendering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T05:29:38Z
- **Completed:** 2026-03-11T05:31:30Z
- **Tasks:** 1 (TDD: red-green)
- **Files modified:** 4

## Accomplishments
- Fixed NetworkView connection query: removed `AND c.deleted_at IS NULL` from db:exec SQL
- Fixed TreeView connection query: removed `AND deleted_at IS NULL` from db:query SQL, retained valid `AND label IS NOT NULL`
- Added 5 regression tests across NetworkView.test.ts and TreeView.test.ts verifying SQL correctness
- Verified BUGF-04: FilterProvider cards query still correctly uses `deleted_at IS NULL` (read-only check)
- All 900 view tests pass with zero regressions

## Task Commits

Each task was committed atomically (TDD red-green):

1. **Task 1 RED: Add failing tests for connection query bugs** - `cbf9981f` (test)
2. **Task 1 GREEN: Fix connection queries** - `25b2a954` (fix)

_TDD task: RED committed failing tests, GREEN committed the fix._

## Files Created/Modified
- `src/views/NetworkView.ts` - Removed `AND c.deleted_at IS NULL` from connections query (line 252)
- `src/views/TreeView.ts` - Removed `AND deleted_at IS NULL` from connections query (line 441)
- `tests/views/NetworkView.test.ts` - Added 2 regression tests: no deleted_at in SQL, source/target IN placeholders
- `tests/views/TreeView.test.ts` - Added 3 regression tests: no deleted_at in SQL, label IS NOT NULL preserved, source/target IN placeholders

## Decisions Made
- Removed the invalid clause rather than adding a deleted_at column to connections -- the CASCADE deletion design is correct per D-001 architecture decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 69 bug fixes complete (both plans executed)
- All connection queries across views are now correct
- Ready for Phase 70+ planning

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 69-bug-fixes*
*Completed: 2026-03-11*
