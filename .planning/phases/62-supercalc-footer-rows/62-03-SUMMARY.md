---
phase: 62-supercalc-footer-rows
plan: 03
subsystem: views
tags: [supergrid, footer, aggregate, calc, css, intl, worker-bridge]

# Dependency graph
requires:
  - phase: 62-supercalc-footer-rows
    provides: "supergrid:calc Worker query (Plan 01), CalcExplorer panel with getConfig() API (Plan 02)"
  - phase: 16-supergrid
    provides: SuperGrid _renderCells pipeline, SuperGridBridgeLike interface
  - phase: 38-virtual-scrolling
    provides: SuperGridVirtualizer (footer rows bypass windowing)
provides:
  - "Footer row rendering in SuperGrid _renderCells() with grand total aggregates"
  - "Parallel supergrid:calc query in _fetchAndRender() via Promise.all"
  - "CalcQueryResult/CalcQueryPayload types on SuperGridBridgeLike interface"
  - "calcQuery() method on WorkerBridge (typed wrapper for supergrid:calc)"
  - "Footer CSS: .sg-footer, .sg-footer-label, .sg-footer-value classes"
  - "Number formatting via Intl.NumberFormat (locale-aware SUM/AVG/COUNT/MIN/MAX)"
  - "Gutter sigma symbol and row header total label on footer rows"
affects: [supergrid-views, calc-explorer, future-inline-group-footers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel Promise.all for cell + calc queries with identical filter params"
    - "Footer rows appended after D3 join, outside virtualizer windowing"
    - "Intl.NumberFormat for locale-aware aggregate value formatting"
    - "CalcExplorer wired via setCalcExplorer() setter (factory closure pattern)"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/views/types.ts
    - src/worker/WorkerBridge.ts
    - src/main.ts
    - src/styles/supergrid.css
    - tests/views/SuperGrid.test.ts
    - tests/views/SuperGrid.perf.test.ts
    - tests/views/SuperGrid.bench.ts
    - tests/etl-validation/source-view-matrix.test.ts

key-decisions:
  - "Grand total footer (one row at bottom) instead of per-group inline footers -- simpler implementation, avoids data cell gridRow renumbering"
  - "CalcExplorer wired via setCalcExplorer() setter on SuperGrid (not constructor) -- SuperGrid created by ViewManager factory, CalcExplorer created after shell"
  - "calcQuery() added as typed method on SuperGridBridgeLike (not generic send()) -- keeps narrow interface focused"
  - "Forward-declared calcExplorer with let in main.ts -- captured by supergrid factory closure"
  - "SUM/COUNT use integer format (maximumFractionDigits:0); AVG/MIN/MAX use up to 2 decimals"
  - "Grand total SUM/COUNT = sum of group values; AVG = mean of group averages; MIN/MAX = min/max across groups"

patterns-established:
  - "Footer rows removed and re-created on each _renderCells call (not managed by D3 join)"
  - "color-mix(in srgb, var(--sg-header-bg) 50%, transparent) for footer tint background"
  - "content-visibility: visible on footer rows to prevent virtualizer hiding"

requirements-completed: [CALC-01, CALC-05, CALC-06]

# Metrics
duration: 11min
completed: 2026-03-09
---

# Phase 62 Plan 03: SuperCalc Footer Rows Summary

**Parallel supergrid:calc Worker query with grand-total footer row rendering, Intl.NumberFormat locale formatting, and 50% tinted header background CSS**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-09T14:45:14Z
- **Completed:** 2026-03-09T14:56:59Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Parallel cell + calc queries in _fetchAndRender() via Promise.all with identical WHERE/params
- Grand-total footer row rendered after D3 data join with label prefix (SUM: 42, AVG: 3.7)
- Footer gutter cell shows sigma symbol; row header footer shows "sigma Total" label
- Footer CSS with tinted background (50% header-bg), bold text, 2px top border, dark mode variant
- CalcExplorer wired into SuperGrid via setCalcExplorer() setter for live aggregate config
- Footer rows bypass SuperGridVirtualizer (content-visibility: visible)
- All 401 SuperGrid tests pass + 20 supergrid-calc tests pass (0 regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Parallel supergrid:calc query + footer rendering** - `bbbd0a75` (feat)
2. **Task 2: Footer row CSS styling** - `d7ef0d8f` (feat)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Parallel calc query in _fetchAndRender, footer row rendering in _renderCells, _formatAggValue helper, setCalcExplorer setter
- `src/views/types.ts` - CalcQueryResult, CalcQueryPayload types, calcQuery method on SuperGridBridgeLike
- `src/worker/WorkerBridge.ts` - calcQuery() typed wrapper for supergrid:calc
- `src/main.ts` - Forward-declared calcExplorer, wired into SuperGrid factory via setCalcExplorer
- `src/styles/supergrid.css` - .sg-footer, .sg-footer-label, .sg-footer-value CSS classes with dark mode and matrix mode variants
- `tests/views/SuperGrid.test.ts` - Added calcQuery mock to all 15+ mock bridge objects
- `tests/views/SuperGrid.perf.test.ts` - Added calcQuery mock to mock bridges
- `tests/views/SuperGrid.bench.ts` - Added calcQuery mock to mock bridge
- `tests/etl-validation/source-view-matrix.test.ts` - Added calcQuery mock to mock bridge

## Decisions Made
- Grand total footer (one row) instead of per-group inline footers: avoids complex gridRow renumbering of all data cells. Per-group inline footers can be added in a future polish pass.
- CalcExplorer wired via setter (not constructor): SuperGrid is created by ViewManager factory before CalcExplorer exists, so a setter with closure-captured forward reference is the cleanest pattern.
- CalcQueryPayload/CalcQueryResult types added to SuperGridBridgeLike as specific typed method (calcQuery) rather than exposing generic send(): maintains the narrow interface principle.
- Aggregate grand totals: SUM/COUNT values sum across all groups. AVG values compute mean of group averages. MIN/MAX take min/max across groups.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added calcQuery mock to all test mock bridges**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Adding calcQuery to SuperGridBridgeLike broke all test files with mock bridges missing the new required method (15+ locations across 4 test files)
- **Fix:** Added `calcQuery: vi.fn().mockResolvedValue({ rows: [] })` to every mock bridge object
- **Files modified:** tests/views/SuperGrid.test.ts, tests/views/SuperGrid.perf.test.ts, tests/views/SuperGrid.bench.ts, tests/etl-validation/source-view-matrix.test.ts
- **Verification:** npx tsc --noEmit compiles cleanly, all 401 SuperGrid tests pass
- **Committed in:** bbbd0a75 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed pre-existing type assertion on mock bridge cast**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Line 480 of SuperGrid.test.ts cast bridge directly to `{ superGridQuery: Mock }` which broke after SuperGridBridgeLike gained calcQuery
- **Fix:** Changed `as { superGridQuery: ... }` to `as unknown as { superGridQuery: ... }` (double cast)
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** TypeScript compiles without error
- **Committed in:** bbbd0a75 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for TypeScript compilation with the new calcQuery interface member. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 62 complete: Worker foundation (Plan 01) + CalcExplorer panel (Plan 02) + footer rendering (Plan 03) all wired together
- Footer row appears at bottom of SuperGrid with aggregate values from parallel calc query
- CalcExplorer config changes trigger coordinator.scheduleUpdate() which re-fetches both cell and calc data
- Pre-existing test failures in WorkbenchShell (expects 4 sections, now has 5) and SuperGridSelect (inline style assertion) are out of scope

## Self-Check: PASSED

- [x] src/views/SuperGrid.ts exists and contains _renderFooterRow
- [x] src/views/types.ts exists and contains CalcQueryResult
- [x] src/worker/WorkerBridge.ts exists and contains calcQuery
- [x] src/styles/supergrid.css exists and contains .sg-footer
- [x] src/main.ts exists and contains setCalcExplorer
- [x] Commit bbbd0a75 found (Task 1)
- [x] Commit d7ef0d8f found (Task 2)
- [x] All 401 SuperGrid tests pass, 20 supergrid-calc tests pass

---
*Phase: 62-supercalc-footer-rows*
*Completed: 2026-03-09*
