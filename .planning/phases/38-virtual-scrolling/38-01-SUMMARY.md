---
phase: 38-virtual-scrolling
plan: 01
subsystem: ui
tags: [virtual-scrolling, content-visibility, css-grid, d3-data-join, supergrid]

# Dependency graph
requires:
  - phase: 15-supergrid
    provides: "CSS Grid render pipeline, _renderCells, D3 data join"
  - phase: 19-superzoom
    provides: "--sg-row-height CSS variable, zoom lifecycle"
  - phase: 20-supersizer
    provides: "attach/detach lifecycle pattern, column resize"
  - phase: 29-multi-level-row-headers
    provides: "N-level row header rendering, leafRowCells"
  - phase: 30-collapse-system
    provides: "visibleLeafRowCells, aggregate injection, hide-mode filtering"
provides:
  - "SuperGridVirtualizer module with row windowing computation"
  - "CSS content-visibility progressive enhancement for .data-cell elements"
  - "Virtual scroll integration in SuperGrid._renderCells pipeline"
  - "Sentinel spacer element for accurate scroll height"
affects: [38-02, performance-benchmarks]

# Tech tracking
tech-stack:
  added: []
  patterns: ["data windowing (filter data before D3 join, not DOM virtualization)", "sentinel spacer for virtual scroll height", "CSS content-visibility progressive enhancement"]

key-files:
  created:
    - "src/views/supergrid/SuperGridVirtualizer.ts"
    - "src/views/supergrid/SuperGridVirtualizer.test.ts"
    - "src/styles/supergrid.css"
  modified:
    - "src/views/SuperGrid.ts"
    - "index.html"

key-decisions:
  - "Data windowing approach: virtualizer filters data rows before D3 join rather than manipulating DOM"
  - "Row header rendering moved after virtualizer windowing to enable row header virtualization"
  - "getRowHeight callback reads --sg-row-height dynamically on every call (handles zoom changes per RESEARCH pitfall 6)"
  - "getColHeaderHeight callback uses this._lastColAxes.length for header level count"

patterns-established:
  - "SuperGridVirtualizer lifecycle: attach/detach mirrors SuperGridSizer/SuperZoom"
  - "windowedLeafRowCells: visible subset of visibleLeafRowCells for render loop"
  - "visibleRowKeySet: null when all rows visible, Set when windowing active"
  - "Sentinel spacer: absolute-positioned div in rootEl (not gridEl) survives DOM teardown"

requirements-completed: [VSCR-01, VSCR-02, VSCR-03, VSCR-04]

# Metrics
duration: 10min
completed: 2026-03-07
---

# Phase 38 Plan 01: Virtual Scrolling Foundation Summary

**SuperGridVirtualizer module with TDD (17 tests), CSS content-visibility progressive enhancement, and full SuperGrid integration for row-level data windowing at >100 leaf rows**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-07T01:07:46Z
- **Completed:** 2026-03-07T01:17:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SuperGridVirtualizer pure computation module with attach/detach lifecycle, getVisibleRange, isActive threshold, and getTotalHeight
- CSS content-visibility: auto on .data-cell elements as progressive enhancement (Safari 18+, Chrome 85+, Firefox 125+)
- Full integration into SuperGrid: constructor initialization, mount/destroy lifecycle, scroll handler range-change detection, _renderCells data windowing, sentinel spacer for scroll height
- Row headers virtualized alongside data rows -- both filtered by visibleRowKeySet when active
- All 360 existing SuperGrid tests pass without modification (zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: SuperGridVirtualizer module + CSS content-visibility rules** - `016027c9` (feat, TDD: red-green-refactor)
2. **Task 2: Integrate virtualizer into SuperGrid render pipeline** - `8cf55ebd` (feat)

_Note: Task 1 was TDD -- test file created first (RED), then module (GREEN)_

## Files Created/Modified
- `src/views/supergrid/SuperGridVirtualizer.ts` - Pure computation class: row windowing from scrollTop/rowHeight/viewport
- `src/views/supergrid/SuperGridVirtualizer.test.ts` - 17 unit tests covering all edge cases (inactive, active, clamping, zoom, detach)
- `src/styles/supergrid.css` - content-visibility: auto on .data-cell, visible on headers, sentinel spacer positioning
- `src/views/SuperGrid.ts` - Virtualizer lifecycle integration, data windowing in _renderCells, scroll handler, spacer management
- `index.html` - Added stylesheet link for supergrid.css

## Decisions Made
- Data windowing approach chosen over DOM virtualization -- virtualizer filters data before D3 join, preserving existing full-teardown render pattern
- Row header rendering block moved after virtualizer windowing code to enable row header filtering via visibleRowKeySet (fixes TDZ reference error)
- getRowHeight callback reads CSS custom property dynamically on every getVisibleRange() call -- never cached, handles zoom changes automatically
- Aggregate injection loops use windowedLeafRowCells to avoid creating cells for non-visible rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed temporal dead zone error in row header virtualization**
- **Found during:** Task 2 (SuperGrid integration)
- **Issue:** Plan specified adding visibleRowKeySet filter to the existing row header rendering loop, but the row header loop was positioned before the visibleRowKeySet variable declaration, causing a ReferenceError (TDZ violation) that was silently caught by _fetchAndRender's try/catch
- **Fix:** Moved row header rendering block after the virtualizer windowing code (after visibleLeafRowCells, windowedLeafRowCells, and visibleRowKeySet are all computed)
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** All 360 existing SuperGrid tests pass
- **Committed in:** 8cf55ebd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Code reordering was necessary for correctness. No scope creep -- same functionality, different execution order.

## Issues Encountered
- 4 pre-existing SuperGridSizer.test.ts failures unrelated to this plan (expect 160px default, get 80px after v3.1 depth change -- documented in MEMORY.md)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SuperGridVirtualizer module ready for Phase 38-02 (performance benchmarking and optimization)
- Virtualizer activates automatically at >100 leaf rows -- no configuration needed
- CSS content-visibility provides immediate benefit on supported browsers
- Sentinel spacer provides accurate scrollbar positioning for virtual scroll

---
*Phase: 38-virtual-scrolling*
*Completed: 2026-03-07*
