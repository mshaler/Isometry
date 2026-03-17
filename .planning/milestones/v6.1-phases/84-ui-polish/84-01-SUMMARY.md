---
phase: 84-ui-polish
plan: 1
subsystem: ui
tags: [supergrid, pafv, aggregation, typescript]

# Dependency graph
requires:
  - phase: 84-ui-polish
    provides: Plan context for WA1 aggregation wiring
provides:
  - SuperGridProviderLike.getAggregation() interface method
  - projectionOpt spread in _fetchAndRender() for non-count aggregation modes
  - 3 behavioral tests for aggregation/displayField wiring
affects: [SuperGrid, PAFVProvider, ProjectionExplorer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "projectionOpt spread pattern: accumulate optional query fields, spread only when non-default"
    - "getAggregation() on SuperGridProviderLike: interface-first aggregation reading from provider"

key-files:
  created: []
  modified:
    - src/views/types.ts
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts
    - tests/etl-validation/source-view-matrix.test.ts
    - tests/profiling/budget-render.test.ts
    - tests/profiling/render-timing.test.ts
    - tests/profiling/supergrid-render.bench.ts
    - tests/views/SuperGrid.bench.ts
    - tests/views/SuperGrid.perf.test.ts

key-decisions:
  - "Spread projectionOpt only when aggregation !== 'count' to preserve backward compat for all existing tests"
  - "PAFVProvider.setAggregation() already calls _scheduleNotify() — no change needed (Task 4 was verify-only)"

patterns-established:
  - "projectionOpt accumulation: const obj = {}; if (nonDefault) obj.field = value; ...obj"

requirements-completed: [WA1]

# Metrics
duration: 15min
completed: 2026-03-15
---

# Phase 84 Plan 1: Wire aggregation and displayField into superGridQuery Summary

**ProjectionExplorer aggregation mode and SuperDensityProvider displayField now flow through _fetchAndRender() into superGridQuery via conditional projectionOpt spread**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-15T17:00:00Z
- **Completed:** 2026-03-15T17:15:00Z
- **Tasks:** 5
- **Files modified:** 9

## Accomplishments
- Added `getAggregation(): AggregationMode` to `SuperGridProviderLike` interface
- Wired projectionOpt spread in `_fetchAndRender()` reading aggregation from provider and displayField from densityState
- Confirmed PAFVProvider.setAggregation() already calls _scheduleNotify() — no code change needed
- Added 3 behavioral tests: sum passthrough, avg+displayField passthrough, count omit
- Fixed all 29 existing test/bench inline provider objects to include the new required method

## Task Commits

All tasks committed atomically:

1. **Tasks 1-5: Wire aggregation/displayField + tests** - `3a17c910` (feat)

## Files Created/Modified
- `src/views/types.ts` - Added getAggregation() to SuperGridProviderLike interface
- `src/views/SuperGrid.ts` - Added projectionOpt spread in _fetchAndRender()
- `tests/views/SuperGrid.test.ts` - Added getAggregation to makeMockProvider + 3 new behavioral tests
- `tests/etl-validation/source-view-matrix.test.ts` - Added getAggregation to inline mock
- `tests/profiling/budget-render.test.ts` - Added getAggregation to inline mock
- `tests/profiling/render-timing.test.ts` - Added getAggregation to inline mock
- `tests/profiling/supergrid-render.bench.ts` - Added getAggregation to inline mock
- `tests/views/SuperGrid.bench.ts` - Added getAggregation to inline mock
- `tests/views/SuperGrid.perf.test.ts` - Added getAggregation to inline mocks

## Decisions Made
- Spread projectionOpt only when `aggregation !== 'count'` to preserve backward compat — count is the default, so existing tests and queries are unaffected
- PAFVProvider.setAggregation() already had _scheduleNotify() — verified, no change needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added getAggregation mock to 29 inline provider stubs across 8 files**
- **Found during:** Task 1 (adding getAggregation to interface)
- **Issue:** Making getAggregation required in SuperGridProviderLike broke 29 inline mock objects in 8 test/bench files that did not include the new method
- **Fix:** Added `getAggregation: vi.fn().mockReturnValue('count')` to all inline provider stubs via Python regex replacement
- **Files modified:** All 8 test files listed above
- **Verification:** `npx tsc --noEmit` reports 0 errors; all 404 SuperGrid tests pass
- **Committed in:** 3a17c910 (consolidated task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing interface implementation in test stubs)
**Impact on plan:** Necessary to keep TypeScript clean. No scope creep — these are the same files the plan's `files_modified` listed.

## Issues Encountered
- Test stubs needed `vi.useFakeTimers()` investigation — resolved by using `await new Promise((r) => setTimeout(r, 0))` pattern consistent with existing SuperGrid tests
- Edit tool cannot match tab-indented strings directly; used Python for tab-aware replacements

## Self-Check: PASSED

All created/modified files verified present. Commit 3a17c910 confirmed in git log.

## Next Phase Readiness
- Aggregation wiring complete; changing Aggregation select in ProjectionExplorer now passes the mode into superGridQuery
- displayField from SuperDensityProvider also flows through when aggregation is non-count
- All 404 SuperGrid tests pass; TypeScript clean

---
*Phase: 84-ui-polish*
*Completed: 2026-03-15*
