---
phase: 136-sql-time-bucketing
plan: 01
subsystem: database
tags: [sql, supergrid, time-bucketing, strftime, coalesce, tdd]

requires:
  - phase: 71-dynamic-schema
    provides: timeFields parameter wiring from SchemaProvider through SuperGridQueryConfig

provides:
  - COALESCE-wrapped compileAxisExpr for all 5 time granularities
  - NO_DATE_SENTINEL exported constant ('__NO_DATE__')
  - Auto-default granularity to 'month' when time axis present and granularity is null/undefined
  - NULL time values produce '__NO_DATE__' bucket instead of being excluded

affects:
  - 136-02 (join tests)
  - 137-time-bucket-rendering (consumes NO_DATE_SENTINEL for "No Date" display label)
  - SuperDensityProvider (granularity state feeds query builder)
  - BridgeDataAdapter (passes granularity to buildSuperGridQuery)

tech-stack:
  added: []
  patterns:
    - "COALESCE(strftime('%Y-%m', field), '__NO_DATE__') pattern for NULL-safe time bucketing in SQL"
    - "Auto-default granularity: compileAxisExpr resolves null granularity to 'month' when field is a time field"
    - "Sentinel constant pattern: NO_DATE_SENTINEL exported for downstream consumers to compare against"

key-files:
  created: []
  modified:
    - src/views/supergrid/SuperGridQuery.ts
    - tests/views/supergrid/SuperGridQuery.test.ts

key-decisions:
  - "COALESCE wrapping added at compileAxisExpr() level, not at STRFTIME_PATTERNS level — single wrapping point for all call sites"
  - "Auto-default granularity logic lives inside compileAxisExpr() per-field, not globally in buildSuperGridQuery — only triggers for actual time fields on axes"
  - "Existing test 'granularity=null produces SELECT without strftime wrapping' updated to use non-time axes — test intent preserved but reflects new auto-default behavior for time fields"

patterns-established:
  - "COALESCE(strftime(...), '__NO_DATE__') — D-01: all time axis SQL expressions wrapped in COALESCE"
  - "effectiveGranularity = granularity ?? 'month' — D-06/D-07: per-field auto-default inside compileAxisExpr"

requirements-completed: [TIME-01, TIME-02, TIME-04, TIME-06]

duration: 3min
completed: 2026-04-01
---

# Phase 136 Plan 01: SQL Time Bucketing — COALESCE Wrapping + Auto-Default Summary

**COALESCE(strftime(...), '__NO_DATE__') wrapping added to compileAxisExpr() with auto-default 'month' granularity for all 5 time hierarchies, exporting NO_DATE_SENTINEL constant for downstream rendering**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-01T16:10:17Z
- **Completed:** 2026-04-01T16:12:43Z
- **Tasks:** 1 (TDD: RED + GREEN phases)
- **Files modified:** 2

## Accomplishments
- Added `export const NO_DATE_SENTINEL = '__NO_DATE__'` to SuperGridQuery.ts for downstream consumers
- Modified `compileAxisExpr()` to wrap all time field strftime expressions in `COALESCE(..., '__NO_DATE__')` — NULL cards now produce a named bucket instead of being excluded
- Auto-default granularity to `'month'` when field is a time field and granularity is null/undefined (D-06, D-07)
- Added 28 new TDD tests covering all 5 granularities, auto-default, NULL bucketing, custom timeFields, and fallback set behavior
- Zero regressions: 102 total tests passing in SuperGridQuery.test.ts + DataAdapter.test.ts

## Task Commits

1. **Task 1: TDD — COALESCE wrapping + auto-default granularity tests and implementation** - `225a83d0` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/views/supergrid/SuperGridQuery.ts` — Added NO_DATE_SENTINEL constant; modified compileAxisExpr() with COALESCE wrapping and auto-default granularity
- `tests/views/supergrid/SuperGridQuery.test.ts` — Added 28 new tests across 3 describe blocks (COALESCE time bucketing, auto-default granularity, NULL bucketing); updated 1 existing test

## Decisions Made
- COALESCE wrapping added at `compileAxisExpr()` level — the single wrapping point propagates automatically to all SELECT, GROUP BY, and ORDER BY call sites in both `buildSuperGridQuery()` and `buildSuperGridCalcQuery()`
- Auto-default granularity (`granularity ?? 'month'`) computed per-field inside `compileAxisExpr()`, not globally — only fires for actual time fields on axes, backward-compatible for non-time fields
- Updated existing test "granularity=null produces SELECT without strftime wrapping" to use non-time axes — preserves test intent (non-time fields unaffected by null granularity) while reflecting the new time-field auto-default behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed misleading existing test assertion**
- **Found during:** Task 1 (GREEN phase — updating existing tests)
- **Issue:** Test "granularity=null produces SELECT without strftime wrapping" used `created_at` as col axis, which now auto-defaults to month. Test assertion `not.toContain('strftime')` would always fail with new correct behavior.
- **Fix:** Changed test to use non-time axes (`folder`, `status`) — preserves original test intent (non-time fields produce no strftime) without contradicting the new auto-default behavior for time fields
- **Files modified:** tests/views/supergrid/SuperGridQuery.test.ts
- **Verification:** All 102 tests pass
- **Committed in:** 225a83d0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed incorrect assertion in mixed-axes test**
- **Found during:** Task 1 (RED phase — writing new tests)
- **Issue:** Mixed time+non-time test asserted `selectPart` (which starts with COALESCE for created_at) doesn't contain `COALESCE(strftime` — incorrect; the assertion should check folder specifically doesn't get wrapped
- **Fix:** Changed assertion to `not.toContain("COALESCE(strftime('%Y-%m', folder)")` — verifies folder is not wrapped while allowing created_at to be correctly wrapped
- **Files modified:** tests/views/supergrid/SuperGridQuery.test.ts
- **Verification:** All 102 tests pass
- **Committed in:** 225a83d0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - test assertion bugs in new tests written during RED phase)
**Impact on plan:** Both fixes were necessary for correct test semantics. No scope creep.

## Issues Encountered
None — implementation straightforward. The minimal change to `compileAxisExpr()` (4 lines changed) naturally propagated COALESCE wrapping through all existing call sites.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `NO_DATE_SENTINEL` exported and ready for Phase 137 rendering layer to consume
- COALESCE wrapping in place for both `buildSuperGridQuery()` and `buildSuperGridCalcQuery()`
- Phase 136 Plan 02 (join tests) can proceed

---
*Phase: 136-sql-time-bucketing*
*Completed: 2026-04-01*
