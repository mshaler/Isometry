---
phase: 62-supercalc-footer-rows
plan: 01
subsystem: worker
tags: [sql, aggregation, group-by, worker-protocol, supergrid]

# Dependency graph
requires:
  - phase: 16-supergrid
    provides: buildSuperGridQuery, handleSuperGridQuery, compileAxisExpr, SuperGridQueryConfig
provides:
  - "'supergrid:calc' Worker message type with typed payload and response"
  - "buildSuperGridCalcQuery() SQL GROUP BY aggregation query builder"
  - "handleSuperGridCalc() Worker handler with groupKey/values response transform"
  - "Worker router case dispatching supergrid:calc to handler"
  - "NUMERIC_FIELDS set for column type classification (priority, sort_order)"
affects: [62-02 footer rendering, 62-03 calc explorer panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-column aggregate config via Record<string, AggregationMode | 'off'>"
    - "Text column safety net: non-numeric fields forced to COUNT regardless of requested mode"
    - "Separate calc query parallel to cell query (not operating on pre-grouped counts)"

key-files:
  created:
    - tests/worker/handlers/supergrid-calc.test.ts
  modified:
    - src/worker/protocol.ts
    - src/views/supergrid/SuperGridQuery.ts
    - src/worker/handlers/supergrid.handler.ts
    - src/worker/worker.ts

key-decisions:
  - "NUMERIC_FIELDS = {priority, sort_order} -- date fields (created_at, modified_at, due_at) classified as text (COUNT+OFF only)"
  - "COUNT always uses COUNT(*) for all fields -- counts all rows including NULLs"
  - "Text column safety net -- non-numeric fields requesting SUM/AVG/MIN/MAX silently downgraded to COUNT"

patterns-established:
  - "buildSuperGridCalcQuery reuses compileAxisExpr and validateAxisField from same module (no duplication)"
  - "Handler separates SQL row columns into groupKey (row axis fields) and values (aggregate results)"

requirements-completed: [CALC-03, CALC-04]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 62 Plan 01: SuperCalc Worker Foundation Summary

**supergrid:calc Worker message with SQL GROUP BY aggregation query builder, per-column aggregate config, and text column safety net**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T14:36:13Z
- **Completed:** 2026-03-09T14:40:51Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 test file created)

## Accomplishments
- Added `supergrid:calc` protocol type to WorkerRequestType with typed payload (rowAxes, where, params, granularity, searchTerm, aggregates) and response ({rows: Array<{groupKey, values}>})
- Implemented `buildSuperGridCalcQuery()` that generates SQL GROUP BY queries with per-column SUM/AVG/COUNT/MIN/MAX, reusing existing `compileAxisExpr` for time granularity and `validateAxisField` for D-003 SQL safety
- Implemented `handleSuperGridCalc()` handler that executes the query and transforms results into groupKey/values separation
- Wired `supergrid:calc` into worker router (exhaustive switch maintained)
- Text column safety net prevents meaningless SUM/AVG/MIN/MAX on non-numeric fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Protocol + Query Builder** - `2916236c` (feat) -- TDD: 15 tests RED then GREEN
2. **Task 2: Handler + Router** - `cf47e5c0` (feat) -- 5 handler tests added

## Files Created/Modified
- `src/worker/protocol.ts` - Added 'supergrid:calc' to type union, payload, and response interfaces
- `src/views/supergrid/SuperGridQuery.ts` - Added buildSuperGridCalcQuery(), NUMERIC_FIELDS set, isNumericField()
- `src/worker/handlers/supergrid.handler.ts` - Added handleSuperGridCalc() with groupKey/values transform
- `src/worker/worker.ts` - Added router case for 'supergrid:calc'
- `tests/worker/handlers/supergrid-calc.test.ts` - 20 tests covering query builder and handler

## Decisions Made
- NUMERIC_FIELDS restricted to {priority, sort_order} -- date fields classified as text (COUNT+OFF only) per research recommendation. MIN/MAX on dates deferred to SuperCalc Extended.
- COUNT always uses COUNT(*) rather than COUNT(column) -- counts all rows including NULLs in each group
- Text column safety net silently downgrades invalid aggregation modes to COUNT rather than throwing -- prevents UI configuration errors from crashing

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Worker foundation complete -- `bridge.send('supergrid:calc', payload)` ready for SuperGrid to call
- Plan 02 can fire calc query in parallel with cell query in `_fetchAndRender()` and render footer rows
- Plan 03 can mount CalcExplorer panel with per-column dropdown that writes to `aggregates` config

## Self-Check: PASSED

- All 6 files verified as existing on disk
- Both task commits (2916236c, cf47e5c0) verified in git log
- 20 tests passing, 0 regressions in existing 59 supergrid tests

---
*Phase: 62-supercalc-footer-rows*
*Completed: 2026-03-09*
