---
phase: 80-filter-pafv-seams
plan: 01
subsystem: testing
tags: [vitest, sql.js, FilterProvider, allowlist, FTS5, seam-tests]

requires:
  - phase: 79-test-infrastructure
    provides: realDb() factory, makeProviders() factory, seedCards() helper

provides:
  - 19 filter-to-SQL seam tests covering all filter types (eq/neq/in/contains/isNull, FTS, range, axis, compound)
  - Allowlist injection attack validation tests
  - Soft-delete exclusion tests against real sql.js

affects:
  - phase 81 (PAFV seam tests will follow same pattern)
  - any future FilterProvider changes (regression guard)

tech-stack:
  added: []
  patterns:
    - "queryWithFilter() helper: executes compile() output directly against real db — the seam test pattern"
    - "Standard 6-card seed set with 1 soft-deleted card supports all filter assertions without per-test re-seeding"

key-files:
  created:
    - tests/seams/filter/filter-sql.test.ts
  modified: []

key-decisions:
  - "SQLite LIKE is case-insensitive for ASCII only — 'Epsilon' has no letter 'a' so it correctly does not match %a%"
  - "FTS trigger (cards_fts_ai) fires on INSERT regardless of deleted_at — exclusion happens at query time via deleted_at IS NULL in compile().where"

patterns-established:
  - "queryWithFilter(db, filter): compiles filter state and executes WHERE against real db — reusable across all seam test files"
  - "Standard seed set pattern: 6 cards with distinct values covering all filter axes, 1 soft-deleted — eliminates per-test seeding noise"

requirements-completed: [FSQL-01, FSQL-02, FSQL-03, FSQL-04, FSQL-05]

duration: 4min
completed: 2026-03-16
---

# Phase 80 Plan 01: Filter-to-SQL Seam Tests Summary

**19-test seam suite proving FilterProvider.compile() selects correct rows against real sql.js for all filter types, with allowlist injection blocking and soft-delete exclusion**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-16T05:06:24Z
- **Completed:** 2026-03-16T05:10:34Z
- **Tasks:** 1
- **Files modified:** 1 created, 1 deleted (.gitkeep)

## Accomplishments
- Created `tests/seams/filter/filter-sql.test.ts` with 19 passing tests
- Verified all 5 FSQL requirements against real sql.js (zero mocks for database layer)
- Established `queryWithFilter()` helper pattern and standard 6-card seed set for future seam test reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Write filter-to-SQL seam tests** - `bca65e74` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `tests/seams/filter/filter-sql.test.ts` - 19 seam tests: eq/neq/in/contains/isNull, FTS, range, axis, allowlist, soft-delete
- `tests/seams/filter/.gitkeep` - removed (replaced by test file)

## Decisions Made
- SQLite LIKE case-insensitivity for ASCII only: "Epsilon" does not contain 'a' so it correctly does not match `%a%` — adjusted test assertion to match actual SQLite behavior rather than weakening the assertion
- FTS trigger fires on INSERT regardless of `deleted_at` value; compile().where's `deleted_at IS NULL` clause is what excludes soft-deleted rows from FTS results — documented as a test note for future maintainers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `contains` test expected result**
- **Found during:** Task 1 (first test run)
- **Issue:** Test expected "Epsilon" to be returned by `name LIKE %a%`, but "Epsilon" contains no letter 'a' — SQLite LIKE is case-insensitive for ASCII only
- **Fix:** Updated expected array from `['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']` to `['Alpha', 'Beta', 'Delta', 'Gamma']` — correct result per SQLite behavior
- **Files modified:** tests/seams/filter/filter-sql.test.ts
- **Verification:** All 19 tests pass after fix
- **Committed in:** bca65e74 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - incorrect test expectation)
**Impact on plan:** Fix corrects the assertion to match actual SQLite LIKE semantics. No scope creep.

## Issues Encountered
None - infrastructure from Phase 79 worked as expected.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Filter seam tests complete and passing; ready for Phase 80 Plan 02 (PAFV seam tests)
- `queryWithFilter()` helper pattern established for reuse in PAFV tests if needed

## Self-Check: PASSED
- tests/seams/filter/filter-sql.test.ts: FOUND
- .planning/phases/80-filter-pafv-seams/80-01-SUMMARY.md: FOUND
- Commit bca65e74: FOUND

---
*Phase: 80-filter-pafv-seams*
*Completed: 2026-03-16*
