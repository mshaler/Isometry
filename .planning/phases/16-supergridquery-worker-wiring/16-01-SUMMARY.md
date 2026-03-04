---
phase: 16-supergridquery-worker-wiring
plan: 01
subsystem: worker
tags: [supergrid, worker-protocol, group-by, distinct-values, sql-safety]

# Dependency graph
requires:
  - phase: 15-pafvprovider-stacked-axes
    provides: "getStackedGroupBySQL() axis state for SuperGrid query configuration"
provides:
  - "supergrid:query Worker message type with CellDatum[] response"
  - "db:distinct-values Worker message type with sorted string[] response"
  - "CellDatum interface exported from protocol.ts"
  - "SQL safety violation -> INVALID_REQUEST error classification"
affects: [17-supergrid-render-pipeline, 18-supergrid-header-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "columnarToRows helper for db.exec() result conversion"
    - "GROUP_CONCAT comma-string to string[] split with filter(Boolean)"

key-files:
  created:
    - src/worker/handlers/supergrid.handler.ts
    - tests/worker/supergrid.handler.test.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/worker.ts

key-decisions:
  - "classifyError maps 'sql safety violation' to INVALID_REQUEST error code (not UNKNOWN)"
  - "handleSuperGridQuery uses columnarToRows helper (db.exec pattern) rather than db.prepare pattern"
  - "Empty axes (no colAxes and no rowAxes) return single cell with total count, not an error"

patterns-established:
  - "SuperGrid handler pattern: buildSuperGridQuery validates axes internally (DRY), handler only transforms results"
  - "Distinct values pattern: validateAxisField FIRST, then interpolate column into SQL string"

requirements-completed: [FOUN-05, FOUN-06]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 16 Plan 01: SuperGrid Worker Handler Summary

**supergrid:query and db:distinct-values Worker handlers wiring buildSuperGridQuery into the Worker router with card_ids split, null guards, and SQL safety classification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T04:43:14Z
- **Completed:** 2026-03-04T04:45:53Z
- **Tasks:** 1 (TDD: red-green-refactor)
- **Files modified:** 4

## Accomplishments
- Two new Worker message types (supergrid:query, db:distinct-values) fully functional with 11 handler tests
- buildSuperGridQuery() is no longer dead code -- called from Worker handler via supergrid:query
- SQL safety violation errors now classified as INVALID_REQUEST (not UNKNOWN) in classifyError
- TypeScript compiles cleanly with exhaustive switch satisfied (all 1234 tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing handler tests** - `b462ce63` (test)
2. **Task 1 GREEN: Handler implementation + protocol + router** - `71d6d66b` (feat)

_TDD task: RED phase committed failing tests, GREEN phase committed implementation. No refactor needed._

## Files Created/Modified
- `src/worker/protocol.ts` - Added supergrid:query, db:distinct-values to WorkerRequestType/Payloads/Responses; CellDatum interface; SuperGridQueryConfig re-export
- `src/worker/handlers/supergrid.handler.ts` - handleSuperGridQuery and handleDistinctValues pure functions with columnarToRows helper
- `src/worker/worker.ts` - Added switch cases for both message types; SQL safety violation classification in classifyError
- `tests/worker/supergrid.handler.test.ts` - 11 unit tests covering happy path, empty axes, invalid fields, null/empty card_ids, WHERE filter, null filtering

## Decisions Made
- classifyError maps "sql safety violation" (lowercase) to INVALID_REQUEST so both handlers' validation errors produce the correct error code without extra handler-level try/catch
- Used columnarToRows helper (db.exec pattern) rather than db.prepare pattern because handleSuperGridQuery needs the columnar result from buildSuperGridQuery's compiled SQL
- Empty axes gracefully return total count (single cell) rather than erroring -- Phase 17 render pipeline expects this for "no grouping" state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- supergrid:query and db:distinct-values are ready for Phase 17 (SuperGrid render pipeline) to connect
- CellDatum interface exported from protocol.ts for SuperGrid view consumption
- Phase 16 Plan 02 (integration/regression testing) can proceed

## Self-Check: PASSED

All files verified present, all commit hashes verified in git log.

---
*Phase: 16-supergridquery-worker-wiring*
*Completed: 2026-03-04*
