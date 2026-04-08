---
phase: 136-sql-time-bucketing
plan: 02
subsystem: database
tags: [sql, supergrid, time-bucketing, sort, order-by, case-when, tdd]

requires:
  - phase: 136-01
    provides: NO_DATE_SENTINEL constant and COALESCE-wrapped compileAxisExpr for time fields

provides:
  - CASE WHEN sentinel sort-last ORDER BY for time axes in buildSuperGridQuery
  - CASE WHEN sentinel sort-last ORDER BY for time axes in buildSuperGridCalcQuery
  - compileTimeAxisOrderBy() helper function encapsulating the sort-last pattern

affects:
  - 137-time-bucket-rendering (ORDER BY ensures "No Date" bucket is always last in data)
  - SuperGrid rendering (rows ordered with dated buckets first, sentinel last)

tech-stack:
  added: []
  patterns:
    - "CASE WHEN expr = '__NO_DATE__' THEN 1 ELSE 0 END, expr DIR — sentinel sort-last independent of ASC/DESC"
    - "effectiveTimeFields.has(ax.field) check at ORDER BY build time to gate CASE WHEN injection"

key-files:
  created: []
  modified:
    - src/views/supergrid/SuperGridQuery.ts
    - tests/views/supergrid/SuperGridQuery.test.ts

key-decisions:
  - "compileTimeAxisOrderBy() helper keeps CASE WHEN logic in one place; called from both ORDER BY builders"
  - "effectiveTimeFieldsForOrder reuses same fallback set as compileAxisExpr — consistent time field detection"
  - "Sort overrides remain unwrapped — they use raw field names, not time-bucketed expressions (existing behavior preserved)"

requirements-completed: [TIME-05]

duration: 3min
completed: 2026-04-01
---

# Phase 136 Plan 02: SQL Time Bucketing — Sort-Last ORDER BY Summary

**CASE WHEN sentinel sort-last trick added to ORDER BY for time axes in both buildSuperGridQuery and buildSuperGridCalcQuery, ensuring '__NO_DATE__' bucket always appears after all dated buckets regardless of sort direction**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-01T16:16:14Z
- **Completed:** 2026-04-01T16:19:44Z
- **Tasks:** 1 (TDD: RED + GREEN phases)
- **Files modified:** 2

## Accomplishments

- Added `compileTimeAxisOrderBy(expr, direction)` helper to `SuperGridQuery.ts` generating `CASE WHEN expr = '__NO_DATE__' THEN 1 ELSE 0 END, expr DIR` — pushes sentinel last regardless of ASC or DESC
- Modified `buildSuperGridQuery()` axisOrderByParts construction: time axis fields use `compileTimeAxisOrderBy`, non-time axis fields use existing plain `expr DIR`
- Modified `buildSuperGridCalcQuery()` orderByParts construction with identical CASE WHEN pattern
- Sort overrides remain unwrapped — existing behavior preserved
- Added 7 new TDD tests covering ASC sort-last, DESC sort-last, non-time axis unaffected, mixed axes, sort override unaffected, and both calc query directions
- Zero regressions: 109 total tests in SuperGridQuery.test.ts + 38 in DataAdapter.test.ts

## Task Commits

1. **Task 1: TDD — __NO_DATE__ sort-last ORDER BY for both query builders** - `f7ba29ea` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/views/supergrid/SuperGridQuery.ts` — Added `compileTimeAxisOrderBy()` helper; added `effectiveTimeFieldsForOrder` check in both ORDER BY build loops
- `tests/views/supergrid/SuperGridQuery.test.ts` — Added 7 new tests across 2 describe blocks (buildSuperGridQuery sort-last, buildSuperGridCalcQuery sort-last)

## Decisions Made

- `compileTimeAxisOrderBy()` defined as module-private helper — encapsulates the CASE WHEN pattern in one place, called from both ORDER BY builders (DRY without premature abstraction)
- `effectiveTimeFieldsForOrder` reuses the same `timeFieldSet ?? ALLOWED_TIME_FIELDS_FALLBACK` pattern already used in `compileAxisExpr` — single source of truth for time field membership
- Dotall-flag regex assertions (`/CASE WHEN.*field/s`) in tests were fixed to use positional/count-based assertions — the dotall flag caused false matches when field names appeared later in the ORDER BY string

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 test assertions using over-broad dotall regex**
- **Found during:** Task 1 (GREEN phase — tests unexpectedly failing after correct implementation)
- **Issue:** Tests `not.toMatch(/CASE WHEN.*folder/s)` and `not.toMatch(/CASE WHEN.*name/s)` used dotall flag (`s`), causing the regex to match across the entire ORDER BY string. The field names appear legitimately after the CASE WHEN expression (as plain sort parts), not inside it. The assertion intent was correct but the regex was too broad.
- **Fix:** Replaced broad dotall regex assertions with positional checks: `[...matchAll(/CASE WHEN/g)].length === 1` (counts only one CASE WHEN per query) and `toMatch(/,\s*field ASC\s*$/)` (verifies field appears as trailing plain sort part)
- **Files modified:** tests/views/supergrid/SuperGridQuery.test.ts
- **Verification:** All 109 tests pass
- **Committed in:** f7ba29ea (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test assertion bug in RED-phase-written tests)
**Impact on plan:** Fix was necessary for correct test semantics. No scope creep.

## Issues Encountered

None beyond the assertion fix. The implementation was a surgical 20-line addition.

## User Setup Required

None.

## Next Phase Readiness

- `NO_DATE_SENTINEL` sort-last behavior complete for both query builders
- Phase 137 (time-bucket rendering) can render "No Date" label knowing it will always sort last
- Phase 136 complete (Plan 01 + Plan 02 both shipped)

## Known Stubs

None.

---

## Self-Check

**Files exist:**
- `src/views/supergrid/SuperGridQuery.ts` — FOUND
- `tests/views/supergrid/SuperGridQuery.test.ts` — FOUND

**Commits exist:**
- `f7ba29ea` — feat(136-02): add __NO_DATE__ sentinel sort-last to ORDER BY (TIME-05) — FOUND

## Self-Check: PASSED

---
*Phase: 136-sql-time-bucketing*
*Completed: 2026-04-01*
