---
phase: 22-superdensity
plan: 02
subsystem: ui
tags: [supergrid, density, granularity, strftime, sql, d3, toolbar, typescript, tdd]

# Dependency graph
requires:
  - phase: 22-superdensity-plan01
    provides: SuperDensityProvider foundation, SuperGridDensityLike interface, hybrid density routing in SuperGrid

provides:
  - SuperGridQueryConfig extended with optional granularity field (TimeGranularity | null)
  - strftime() GROUP BY rewrite in buildSuperGridQuery for time-field axes (DENS-01)
  - STRFTIME_PATTERNS constant and compileAxisExpr() helper in SuperGridQuery.ts
  - Density toolbar in SuperGrid.mount() with granularity picker <select> element
  - _updateDensityToolbar() for picker visibility gating on time-field axes
  - Aggregate count headers in "2026-01 (8)" format for time-axis col headers (DENS-05)
  - granularity passed through _fetchAndRender() to bridge.superGridQuery() config
  - 13 SuperGridQuery granularity tests + 10 SuperGrid density toolbar tests

affects: [22-superdensity-plan03, future-supergrid-time-filtering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "compileAxisExpr(): validate raw field BEFORE strftime wrapping — prevents false SQL safety violations"
    - "Alias pattern: strftime('%Y-%m', created_at) AS created_at — downstream consumers see raw field name"
    - "Density toolbar visibility: always visible (for Plan 03 controls), granularity picker hidden when no time axis"
    - "Aggregate count for col headers: sum cells matching header value, format 'value (N)'"

key-files:
  created:
    - tests/views/supergrid/SuperGridQuery.test.ts
  modified:
    - src/views/supergrid/SuperGridQuery.ts
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "compileAxisExpr() validates raw field BEFORE strftime wrapping — prevents false SQL safety violations on valid time fields"
  - "Alias in SELECT: strftime('%Y-%m', created_at) AS created_at — downstream CellDatum consumers read raw field name created_at"
  - "Toolbar always visible (display:flex), granularity picker hidden (display:none) when no time axis — Plan 03 will add hide-empty + view-mode controls"
  - "Aggregate count computed client-side from cells array before buildHeaderCells() — no extra Worker query"
  - "ORDER BY uses compiled strftime expression for consistent ordering with GROUP BY"

patterns-established:
  - "ALLOWED_COL_TIME_FIELDS: shared constant between SuperGridQuery.ts and SuperGrid.ts for time-field detection"
  - "aggregateCount parameter on _createColHeaderCell — undefined = no count shown, number = 'value (N)' format"

requirements-completed: [DENS-01, DENS-05]

# Metrics
duration: 9min
completed: 2026-03-05
---

# Phase 22 Plan 02: SuperDensity Time Hierarchy Collapse Summary

**strftime() GROUP BY rewrite in buildSuperGridQuery with density toolbar granularity picker and "2026-01 (8)" aggregate count headers**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-05T03:52:55Z
- **Completed:** 2026-03-05T04:02:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended SuperGridQueryConfig with optional `granularity` field; buildSuperGridQuery wraps time-field axes (created_at/modified_at/due_at) in STRFTIME_PATTERNS expressions when granularity is set
- Validation ordering enforced: validateAxisField(rawField) BEFORE compileAxisExpr() — prevents false SQL safety violations on valid time fields
- SELECT uses `strftime('%Y-%m', created_at) AS created_at` alias pattern so CellDatum consumers use unchanged field names
- GROUP BY and ORDER BY use the same compiled strftime expression for consistency
- Density toolbar added in mount() with direct-jump granularity picker (day/week/month/quarter/year/None); picker hidden when no time axis assigned
- _fetchAndRender() passes density state granularity to bridge.superGridQuery() config
- Col headers show aggregate count in "2026-01 (8)" format when granularity active on time-field axis; non-time headers unaffected
- 23 new tests total (13 SuperGridQuery granularity tests + 10 SuperGrid density toolbar tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SuperGridQueryConfig with granularity + strftime GROUP BY rewrite (TDD)** - `9be81bad` (feat)
2. **Task 2: Density toolbar with granularity picker and aggregate count headers** - `01488318` (feat)

## Files Created/Modified

- `src/views/supergrid/SuperGridQuery.ts` - Added granularity field to SuperGridQueryConfig, STRFTIME_PATTERNS constant, ALLOWED_TIME_FIELDS set, compileAxisExpr() helper, updated buildSuperGridQuery() to use compiled expressions in SELECT/GROUP BY/ORDER BY
- `src/views/SuperGrid.ts` - Added density toolbar in mount(), _updateDensityToolbar() method, ALLOWED_COL_TIME_FIELDS constant, granularity in _fetchAndRender() bridge call, aggregate count param on _createColHeaderCell()
- `tests/views/supergrid/SuperGridQuery.test.ts` - Created: 13 new tests for granularity query compilation (all 5 granularities, all 3 time fields, non-time fields, allowlist ordering)
- `tests/views/SuperGrid.test.ts` - Added 10 DENS tests: toolbar creation, picker show/hide on time vs non-time axes, setGranularity calls, superGridQuery config pass-through, aggregate count headers

## Decisions Made

- compileAxisExpr() validates raw field BEFORE strftime wrapping — prevents false SQL safety violations on valid time fields that match ALLOWED_TIME_FIELDS
- Alias pattern in SELECT: `strftime('%Y-%m', created_at) AS created_at` — downstream CellDatum consumers see the raw field name as the column alias, no change needed in _renderCells()
- Toolbar always visible (display:flex per Plan 03 pre-populated logic), granularity picker hidden (display:none) when no time axis — aligns with Plan 03 which will add hide-empty + view-mode controls always visible
- Aggregate count computed client-side from cells array before buildHeaderCells() — no extra Worker query needed since GROUP BY already sums per time-bucket
- ORDER BY uses the same compiled strftime expression as SELECT/GROUP BY — consistent bucket-level ordering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Toolbar visibility implementation differs from plan spec**
- **Found during:** Task 2 (Density toolbar implementation)
- **Issue:** Plan spec said "HIDDEN when no time field is on any active axis" (hiding whole toolbar). The Plan 03 linter pre-populated `_updateDensityToolbar()` to always show toolbar (display:flex) and only hide granularity picker inside. Plan 03 adds hide-empty + view-mode controls to the same toolbar, so hiding the whole toolbar was incorrect.
- **Fix:** Updated test expectation to match correct behavior: toolbar always visible, granularity picker hidden via display:none when no time axis. CONTEXT.md decision honored (granularity control hidden when no time field).
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 150 tests pass
- **Committed in:** 01488318 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/test alignment)
**Impact on plan:** The toolbar visibility behavior matches the correct design (CONTEXT.md: "Granularity control hidden when no time field" — control, not toolbar). No scope creep.

## Issues Encountered

The linter pre-populated Plan 03 code (hide-empty filter, _updateHiddenBadge, _hiddenIndicatorEl) into SuperGrid.ts before Task 2 was committed. This caused the _updateDensityToolbar implementation to differ from my initial implementation. The linter's version is correct for the overall Plan 02+03 design — always-visible toolbar with control-level granularity picker hiding.

## Next Phase Readiness

- SuperGridQueryConfig granularity field ready for Plan 03 consumption
- Density toolbar framework in place — Plan 03 adds hide-empty checkbox + view-mode select to the same toolbar
- DENS-01 and DENS-05 requirements satisfied
- All 150 SuperGrid/SuperGridQuery tests pass

---
*Phase: 22-superdensity*
*Completed: 2026-03-05*

## Self-Check: PASSED

- `.planning/phases/22-superdensity/22-02-SUMMARY.md` - FOUND
- `src/views/supergrid/SuperGridQuery.ts` - FOUND
- `tests/views/supergrid/SuperGridQuery.test.ts` - FOUND
- `src/views/SuperGrid.ts` - FOUND
- `tests/views/SuperGrid.test.ts` - FOUND
- Task 1 commit `9be81bad` - FOUND
- Task 2 commit `01488318` - FOUND
- All 150 tests passing
