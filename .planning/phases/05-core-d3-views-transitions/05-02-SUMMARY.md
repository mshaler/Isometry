---
phase: 05-core-d3-views-transitions
plan: 02
subsystem: ui
tags: [d3, views, typescript, jsdom, svg, list-view, grid-view]

# Dependency graph
requires:
  - phase: 05-01
    provides: IView interface, CardDatum type, CardRenderer.renderSvgCard(), CARD_DIMENSIONS, ViewManager

provides:
  - ListView class implementing IView — SVG single-column list with sort toolbar
  - GridView class implementing IView — SVG responsive grid with column wrapping
  - sortCards() module-level helper (extracted from ListView)
  - computeGridPosition() module-level helper (extracted from GridView)

affects:
  - 05-03 (KanbanView — shares IView contract, CardRenderer pattern)
  - 05-04 (transitions plan — ListView and GridView are the first SVG views to wire up transitions)
  - ViewManager.switchTo() — can now factory-construct ListView or GridView

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D3 transform via direct .attr() (no .transition() on transform) — D3 SVG transform interpolation (parseSvg) crashes in jsdom; opacity transitions still use .transition()"
    - "Object.defineProperty(el, 'clientWidth', ...) pattern for jsdom container width control in GridView tests"
    - "Sync exit.remove() — avoids async jsdom RAF issues with D3 opacity-then-remove transition chains"

key-files:
  created:
    - src/views/ListView.ts
    - src/views/GridView.ts
    - tests/views/ListView.test.ts
    - tests/views/GridView.test.ts
  modified: []

key-decisions:
  - "D3 .transition() on 'transform' attr crashes jsdom via parseSvg in d3-interpolate — set transform directly with .attr(); use transition only for opacity"
  - "GridView.render() reads container.clientWidth at call time — tests set width via Object.defineProperty before mount"
  - "exit uses .remove() synchronously — avoids async RAF in jsdom causing unhandled exceptions"
  - "sortCards() extracted as module-level pure function in ListView — clean separation of sort logic from render loop"
  - "computeGridPosition() extracted as module-level pure function in GridView — named, testable grid math"

# Metrics
duration: ~4 min
completed: 2026-02-28
---

# Phase 05 Plan 02: ListView + GridView Summary

**ListView (SVG single-column list with sort toolbar) and GridView (SVG responsive grid with Math.max(1, floor(width/180)) columns) implement the IView contract with stable d => d.id key functions — 30 new tests passing, 715 total**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-28T21:23:47Z
- **Completed:** 2026-02-28T21:28:05Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- ListView implements IView with SVG single-column layout: sort toolbar (field dropdown + asc/desc toggle), D3 data join with `d => d.id`, cards at `translate(0, i * 48)`, date text right-aligned, SVG height auto-updates to `cards.length * 48 + 16`
- GridView implements IView with responsive SVG grid: `Math.max(1, Math.floor(containerWidth / 180))` columns, `computeGridPosition(i, cols)` for row/col math, SVG height = `ceil(cards/cols) * 120 + 16`
- Both views: enter adds g.card with opacity fade-in, exit removes synchronously (not async), destroy() clears all DOM
- 17 ListView tests + 13 GridView tests = 30 new tests added (715 total, all passing)
- Key D3/jsdom discovery: `d3-interpolate`'s `parseSvg` requires actual `baseVal` on SVG transforms — jsdom doesn't provide this, so `transform` attrs must be set directly (not via `.transition()`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement ListView with sort controls** - `9a923db` (feat)
2. **Task 2: Implement GridView with responsive column wrapping** - `654110a` (feat)

## Files Created/Modified

- `src/views/ListView.ts` — ListView class: IView implementation, sort toolbar, D3 data join, sortCards() helper, formatDate() helper
- `src/views/GridView.ts` — GridView class: IView implementation, responsive grid, computeGridPosition() helper
- `tests/views/ListView.test.ts` — 17 tests: mount, render, key function, sort controls, enter/exit, destroy
- `tests/views/GridView.test.ts` — 13 tests: mount, render, key function, grid positions, width adaptation, enter/exit, destroy

## Decisions Made

- D3 `.transition()` on `transform` attribute crashes jsdom via `parseSvg` in `d3-interpolate` — set `transform` via direct `.attr()` call; use `.transition()` only for `opacity` (style, not attribute, so no SVG interpolation involved)
- GridView reads `container.clientWidth` at render time — tests control width via `Object.defineProperty(container, 'clientWidth', { configurable: true, value: N })` before calling `view.mount()`
- Exit uses synchronous `.remove()` — async opacity-then-remove chains via D3 transitions fire RAF callbacks that attempt SVG interpolation after the test completes, causing unhandled exceptions in jsdom
- `sortCards()` extracted as module-level function in ListView — keeps render() focused on D3 join logic
- `computeGridPosition()` extracted as module-level function in GridView — named function makes grid math clear and testable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D3 transform transition crashes jsdom via parseSvg**
- **Found during:** Task 1 (ListView GREEN phase, first test run)
- **Issue:** The plan's action called for `.transition().attr('transform', ...)` on all groups after the join. In jsdom, `d3-interpolate`'s `parseSvg` reads `el.transform.baseVal` which jsdom doesn't implement — throws `TypeError: Cannot read properties of undefined (reading 'baseVal')`
- **Fix:** Set `transform` attribute directly with `.attr()` (no transition); apply `.transition()` only to `style('opacity')` which doesn't require SVG DOM APIs
- **Files modified:** src/views/ListView.ts, src/views/GridView.ts
- **Applied to both:** GridView was pre-emptively implemented with the same pattern

**2. [Rule 1 - Bug] Fixed incorrect test assertion (`.toBe(3)` after rendering 5 cards)**
- **Found during:** Task 1 (ListView RED → first implementation run)
- **Issue:** First test in `render` describe block called `makeCards()` (returns 5) but asserted `groups.length.toBe(3)` with stale comment "3 cards by default"
- **Fix:** Changed expectation to `.toBe(5)` matching actual `makeCards()` output
- **Files modified:** tests/views/ListView.test.ts

**3. [Rule 1 - Bug] Missing `afterEach` import in ListView test**
- **Found during:** Task 1 (tsc --noEmit)
- **Issue:** `afterEach` used in test file but not imported from vitest
- **Fix:** Added `afterEach` to the vitest import
- **Files modified:** tests/views/ListView.test.ts

---

**Total deviations:** 3 auto-fixed (1 D3/jsdom compat, 2 test bugs)
**Impact on plan:** All auto-fixes necessary for correctness. The jsdom fix is now documented as a pattern for all future D3 view tests.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — all dependencies were installed in Phase 5 Plan 01.

## Next Phase Readiness

- ListView and GridView are ready for ViewManager.switchTo() integration — both implement IView correctly
- The `d3 transform via direct .attr()` pattern is established — Plan 03 (KanbanView) and Plan 04 (transitions) should follow this pattern
- jsdom grid width pattern documented: `Object.defineProperty(container, 'clientWidth', { configurable: true, value: N })`
- No blockers for Phase 5 continuation (KanbanView next)

---
*Phase: 05-core-d3-views-transitions*
*Completed: 2026-02-28*
