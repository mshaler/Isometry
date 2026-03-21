---
phase: 100-plugin-registry-wave-1-supersize-superzoom-supercalc-supersort-superscroll
plan: "02"
subsystem: ui
tags: [pivot-table, plugin-registry, virtual-scroll, sort, typescript, d3]

requires:
  - phase: 100-01
    provides: SuperSize + SuperZoom plugins, PluginHook interface, pivot CSS namespace

provides:
  - SuperSortHeaderClick plugin — single-column sort via header click with asc/desc/null cycle
  - SuperSortChain plugin — multi-column chain sort via Shift+click (max 3 entries)
  - SuperScrollVirtual plugin — data windowing for rows > 100 with sentinel spacers
  - SuperScrollStickyHeaders plugin — CSS position:sticky on col-span header elements

affects:
  - 100-03
  - Any future plan wiring plugins into FeatureCatalog
  - HarnessShell integration of SORT and SCRL plugin categories

tech-stack:
  added: []
  patterns:
    - "Group-sort-reassign: group CellPlacement[] by rowIdx, sort groups, reassign rowIdx sequentially"
    - "Null-to-end sort: nulls treated as Infinity in comparator (sort to end in both asc and desc)"
    - "Chain max enforcement: _chain.length > MAX_CHAIN → shift() removes oldest entry"
    - "Bypass pattern: if totalRows <= VIRTUALIZATION_THRESHOLD return same reference (no allocation)"
    - "getVisibleRange pure export: enables isolated unit testing of scroll math without plugin factory"

key-files:
  created:
    - src/views/pivot/plugins/SuperSortHeaderClick.ts
    - src/views/pivot/plugins/SuperSortChain.ts
    - src/views/pivot/plugins/SuperScrollVirtual.ts
    - src/views/pivot/plugins/SuperScrollStickyHeaders.ts
    - tests/views/pivot/SuperSort.test.ts
    - tests/views/pivot/SuperScroll.test.ts
  modified:
    - src/styles/pivot.css

key-decisions:
  - "SCROLL_BUFFER=2 (not OVERSCAN_ROWS=5): pivot rows are typically wider, fewer rows visible than supergrid; lighter buffer avoids over-rendering"
  - "data-col-start is 1-based in the overlay DOM (grid column CSS); getColIdx() converts to 0-based for internal state"
  - "Chain cycle: asc→desc→remove (3 clicks to clear) — not asc→desc→null like single sort, preserving chain intent"
  - "SuperScrollStickyHeaders is a CSS-only enhancement — sticky works when overlay headers are within a scroll container; no JS scroll tracking needed"

patterns-established:
  - "Sort group pattern: group CellPlacement[] by rowIdx → sort groups by colIdx value → reassign rowIdx 0..N-1"
  - "Chain priority display: 1-based priority number appended to header as .pv-sort-priority span after .pv-sort-arrow"
  - "Virtual scroll threshold bypass: return same cells reference (not a copy) when below threshold — avoids allocation"

requirements-completed:
  - SORT-01
  - SORT-02
  - SCRL-01
  - SCRL-02

duration: 4min
completed: 2026-03-21
---

# Phase 100 Plan 02: SuperSort + SuperScroll Plugins Summary

**4 pivot plugin factories (SuperSortHeaderClick, SuperSortChain, SuperScrollVirtual, SuperScrollStickyHeaders) with header-click sort cycling, Shift+click chain sort priority, data windowing for large datasets, and CSS sticky headers — 43 tests all passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T20:54:32Z
- **Completed:** 2026-03-21T20:58:47Z
- **Tasks:** 2
- **Files modified:** 7 (4 new plugins, 2 test files, 1 CSS)

## Accomplishments

- SuperSortHeaderClick: click leaf header to cycle sort none→asc→desc→none; Shift+click passes through to chain plugin; ↑/↓ Unicode arrows injected in afterRender; transformData groups+sorts rows and reassigns rowIdx sequentially
- SuperSortChain: Shift+click builds multi-key sort chain (max 3 entries, 4th replaces oldest); cycling within chain is asc→desc→remove; priority numbers displayed alongside arrows
- SuperScrollVirtual: data windowing ports getVisibleRange() from SuperGridVirtualizer with SCROLL_BUFFER=2; threshold bypass returns same reference; sentinel spacers maintain scroll dimensions
- SuperScrollStickyHeaders: level-aware position:sticky with z-index:20 applied to all .pv-col-span elements; no-op destroy (CSS re-applied each render)

## Task Commits

1. **Task 1: SuperSort plugins** - `c56f22fc` (feat) — SuperSortHeaderClick + SuperSortChain + CSS additions + 25 tests
2. **Task 2: SuperScroll plugins** - `371b77d3` (feat) — SuperScrollVirtual + SuperScrollStickyHeaders + 18 tests

## Files Created/Modified

- `src/views/pivot/plugins/SuperSortHeaderClick.ts` — Single-column sort plugin with asc/desc/null cycle
- `src/views/pivot/plugins/SuperSortChain.ts` — Multi-column chain sort (max 3), Shift+click triggered
- `src/views/pivot/plugins/SuperScrollVirtual.ts` — Virtual scrolling data windowing + exported getVisibleRange()
- `src/views/pivot/plugins/SuperScrollStickyHeaders.ts` — CSS position:sticky for col-span headers
- `tests/views/pivot/SuperSort.test.ts` — 25 tests covering sort state cycling, transformData, afterRender, destroy
- `tests/views/pivot/SuperScroll.test.ts` — 18 tests covering getVisibleRange math, threshold bypass, windowing, sticky headers
- `src/styles/pivot.css` — Added .pv-col-span--sorted-asc/desc, .pv-sort-arrow, .pv-sort-priority, .pv-scroll-sentinel-top/bottom

## Decisions Made

- SCROLL_BUFFER=2 (vs OVERSCAN_ROWS=5 in supergrid): pivot table rows are typically wide spanning columns; fewer rows visible simultaneously; lighter buffer is appropriate
- data-col-start is 1-based in overlay DOM (CSS grid column start); getColIdx() subtracts 1 for internal 0-based colIdx
- Chain cycling behavior: asc→desc→remove (3 states) vs single-sort asc→desc→null — matches the mental model of "I want this in my chain" vs "take it out"
- SuperScrollStickyHeaders leaves `destroy` as no-op: the overlay is fully re-rendered on each PivotGrid.render() call, so inline styles are ephemeral

## Deviations from Plan

None — plan executed exactly as written. All 4 plugin factories created with correct signatures, all CSS classes added, all tests pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 4 plugins ready for wiring into FeatureCatalog.ts and HarnessShell in Phase 100 Plan 03
- SuperScrollVirtual's getVisibleRange() is exported as a pure function — can be tested independently by Plan 03 integration tests
- CSS sort indicator classes (.pv-col-span--sorted-asc/desc) now in pivot.css — harness can apply them immediately

---
*Phase: 100-plugin-registry-wave-1-supersize-superzoom-supercalc-supersort-superscroll*
*Completed: 2026-03-21*
