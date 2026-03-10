---
phase: 68-e2e-critical-path-tests-tier-3
plan: 01
subsystem: testing
tags: [playwright, e2e, view-switching, compound-filter, sql-ground-truth]

# Dependency graph
requires:
  - phase: 67-category-chips
    provides: "FilterProvider with setAxisFilter, setSearchQuery, setRangeFilter, clearFilters"
provides:
  - "E2E spec validating all 9 views preserve card count during switching (Flow 1)"
  - "E2E spec validating compound AND-conjunction filter narrowing and restoration (Flow 11)"
affects: [68-02]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SQL ground-truth card count via bridge.send('db:query') for all E2E assertions", "getFilteredCardCount helper using filter.compile() for parameterized SQL"]

key-files:
  created:
    - e2e/view-switch.spec.ts
    - e2e/compound-filter.spec.ts
  modified: []

key-decisions:
  - "SQL ground truth for all card counts — never count DOM cells for data integrity assertions"
  - "getFilteredCardCount helper compiles active filter into parameterized SQL for accurate filtered counts"

patterns-established:
  - "View switch loop pattern: programmatic switchTo + waitForFunction tab assertion + SQL count verification"
  - "Filter stacking pattern: incremental filter application with monotonic count assertions at each step"

requirements-completed: [E2E3-01, E2E3-04]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 68 Plan 01: E2E Specs for View Switch + Compound Filter Summary

**Two Playwright E2E specs covering view-switch card count preservation across all 9 views and compound AND-conjunction filter narrowing with 3 filter types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T14:52:09Z
- **Completed:** 2026-03-10T14:54:05Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Flow 1 E2E: iterates all 9 view types, asserts database card count equals baseline after each switch
- Flow 11 E2E: stacks category filter (folder=Film) + FTS5 search (Oscar) + range filter (priority 3..7), verifies monotonic narrowing, filter removal broadening, and full clearFilters restoration
- Both specs use shared baseline fixture from e2e/fixtures.ts (Meryl Streep dataset)

## Task Commits

Each task was committed atomically:

1. **Task 1: E2E spec for Flow 1 -- View Switch Card Count Preservation** - `bfd43a2b` (test)
2. **Task 2: E2E spec for Flow 11 -- Compound Filter Conjunction Correctness** - `a4f88540` (test)

## Files Created/Modified
- `e2e/view-switch.spec.ts` - Flow 1: loops 9 views, SQL card count assertion per view, no-spinner check
- `e2e/compound-filter.spec.ts` - Flow 11: 3-filter stacking with monotonic narrowing, compile() state verification, clearFilters restoration

## Decisions Made
- SQL ground truth for all card count assertions (never count DOM cells for data integrity checks)
- getFilteredCardCount helper uses filter.compile() to build parameterized SQL, ensuring the E2E test validates the exact same filter pipeline the app uses
- Network view gets extra 2000ms wait after tab assertion (force simulation stabilization) but SQL count is independent of render

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 2 of 4 Tier 3 E2E specs complete (Flow 1, Flow 11)
- Plan 68-02 will add Flow 3 (projection axis) and Flow 4 (notebook binding) specs + npm script update
- Total E2E suite will be 9 spec files (7 existing + 2 new from this plan)

## Self-Check: PASSED

- [x] e2e/view-switch.spec.ts exists
- [x] e2e/compound-filter.spec.ts exists
- [x] 68-01-SUMMARY.md exists
- [x] Commit bfd43a2b found
- [x] Commit a4f88540 found

---
*Phase: 68-e2e-critical-path-tests-tier-3*
*Completed: 2026-03-10*
