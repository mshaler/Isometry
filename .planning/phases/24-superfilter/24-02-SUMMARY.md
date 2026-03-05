---
phase: 24-superfilter
plan: "02"
subsystem: ui
tags: [supergrid, filter, dropdown, checkbox, dom, d3, typescript]

# Dependency graph
requires:
  - phase: 24-superfilter Plan 01
    provides: SuperGridFilterLike interface with hasAxisFilter/getAxisFilter/setAxisFilter/clearAxis/clearAllAxisFilters methods; FilterProvider axis filter API

provides:
  - Filter icon DOM (span.filter-icon) on every leaf col/row header with hover-reveal opacity pattern
  - _createFilterIcon() private method — icon with data-filter-field attribute, opacity 0/1 based on active state
  - _getAxisValues() private method — distinct values + aggregated counts from _lastCells (no Worker round-trip)
  - _openFilterDropdown() private method — .sg-filter-dropdown appended to _rootEl, z-index 20, checkbox list
  - _closeFilterDropdown() private method — removes dropdown from DOM, cleans up event listeners
  - Click-outside and Escape-key dismiss for dropdown
  - Single-dropdown-at-a-time enforcement
  - 17 new TDD tests: FILT-01 (icons on headers) + FILT-02 (values from _lastCells)
affects:
  - 24-superfilter Plan 03 (Clear filters button, active state indicator)
  - SuperGrid view rendering pipeline (dropdown must survive _renderCells DOM clearing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Filter icon placed after sort icon in flex header containers ([grip][label][sort-icon][filter-icon])
    - Dropdown appended to _rootEl (not _gridEl) to survive _renderCells clearing
    - _getAxisValues reads _lastCells directly — no Worker round-trip on dropdown open (FILT-02)
    - rAF-deferred click-outside listener to prevent immediate self-dismiss on open click
    - Stored listener references (_boundFilterOutsideClick, _boundFilterEscapeHandler) for removeEventListener cleanup

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Dropdown appended to _rootEl (not _gridEl) — must survive _renderCells DOM clearing which empties _gridEl on every render"
  - "_getAxisValues() aggregates counts from _lastCells at open time — no Worker round-trip (FILT-02 constraint)"
  - "Filter icon Escape dismiss coexists with selection Escape dismiss — both fire, both safe (filter closes dropdown, selection clears)"
  - "rAF-deferred click-outside listener prevents the same click that opens the dropdown from immediately dismissing it"
  - "z-index 20 for dropdown — above z-index 2 (col/row headers), z-index 3 (corner), z-index 10 (drop zones/toolbar)"

patterns-established:
  - "Filter icon hover-reveal: same rAF-deferred parent mouseenter/mouseleave pattern as sort icon (opacity 0→0.5→1)"
  - "Single dropdown at a time: _openFilterDropdown() calls _closeFilterDropdown() first"

requirements-completed:
  - FILT-01
  - FILT-02

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 24 Plan 02: Filter Icon + Dropdown Summary

**Filter icon DOM wired into all leaf col/row headers with hover-reveal; dropdown checkbox list populated from _lastCells without Worker round-trip (FILT-01, FILT-02)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T08:06:02Z
- **Completed:** 2026-03-05T08:11:31Z
- **Tasks:** 1 (TDD: RED → GREEN → done)
- **Files modified:** 2

## Accomplishments

- Filter icons (span.filter-icon) present on every leaf col header and every row header with hover-reveal (opacity 0 → 0.5 on hover, 1 when active)
- Clicking filter icon opens .sg-filter-dropdown populated from _lastCells with "value (count)" checkbox rows (FILT-02: no Worker round-trip on open)
- Checking/unchecking a checkbox immediately calls filter.setAxisFilter() (live-update, no Apply button)
- Dropdown closes on click-outside (capture-phase listener, rAF-deferred) and Escape key
- Only one dropdown open at a time (second open closes first)
- Dropdown appended to _rootEl, not _gridEl — survives _renderCells DOM clearing
- destroy() calls _closeFilterDropdown() for full lifecycle cleanup
- 17 new tests all passing; 188 total SuperGrid tests passing

## Task Commits

1. **Task 1: Filter icon creation and dropdown with checkbox list** - `faa2cd9f` (feat)

## Files Created/Modified

- `src/views/SuperGrid.ts` — Added _filterDropdownEl/_boundFilterOutsideClick/_boundFilterEscapeHandler fields; _createFilterIcon(), _getAxisValues(), _openFilterDropdown(), _closeFilterDropdown() methods; filter icons wired into col/row header rendering; _closeFilterDropdown() called in destroy()
- `tests/views/SuperGrid.test.ts` — Updated makeMockFilter with full SuperGridFilterLike axis filter methods; fixed inline interface compliance test; added FILT-01 (5 tests) and FILT-02 (12 tests) suites; fixed TypeScript strict null on args access

## Decisions Made

- Dropdown appended to _rootEl (not _gridEl) — must survive _renderCells which empties _gridEl innerHTML on every bridge response
- _getAxisValues() aggregates from _lastCells at dropdown open time — satisfies FILT-02 (no Worker round-trip)
- rAF-deferred click-outside listener — prevents the opening click from immediately triggering outside-click dismiss
- Filter Escape handler coexists safely with selection Escape handler — both are document keydown listeners, both fire independently without conflict
- z-index 20 for dropdown exceeds all header z-index values (2, 3) and drop zone/toolbar z-index (10)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated SuperGridFilterLike interface compliance test with full method signatures**
- **Found during:** Task 1
- **Issue:** Inline test `SuperGridFilterLike interface is satisfied by object with compile method` only passed `compile` — TypeScript reported TS2739 (missing required properties hasAxisFilter/getAxisFilter/setAxisFilter/clearAxis/clearAllAxisFilters) since Plan 01 extended the interface
- **Fix:** Added all 5 axis filter methods to the inline test object
- **Files modified:** tests/views/SuperGrid.test.ts (line 350)
- **Verification:** TypeScript error TS2739 resolved; test still passes
- **Committed in:** faa2cd9f (Task 1 commit)

**2. [Rule 2 - Missing Critical] Fixed TypeScript strict null on mock.calls access in test**
- **Found during:** Task 1 (post-implementation typecheck)
- **Issue:** `args = setAxisFilterSpy.mock.calls[0]` — TypeScript TS18048 reported `args` is possibly `undefined`
- **Fix:** Added explicit type annotation `[string, string[]] | undefined` and used optional chaining `args?.[0]`
- **Files modified:** tests/views/SuperGrid.test.ts (line 4902-4904)
- **Verification:** TypeScript errors resolved; test still passes
- **Committed in:** faa2cd9f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 2 — missing critical fixes for TypeScript correctness)
**Impact on plan:** Both fixes correct pre-existing TypeScript strict mode violations introduced by Plan 01's interface extension. No scope creep.

## Issues Encountered

Pre-existing test failures in `tests/worker/supergrid.handler.test.ts` (5 tests, `TypeError: db.prepare is not a function`) were confirmed pre-existing before Plan 24-02 execution via git stash. Logged to `deferred-items.md` in phase directory.

## Next Phase Readiness

- Filter icon + dropdown UI complete (FILT-01, FILT-02 satisfied)
- Plan 24-03 can wire: Clear filters button in toolbar, active filter indicator in icons, hasAxisFilter→icon color updates on re-render
- Filter dropdown can be tested end-to-end by mounting SuperGrid with a real FilterProvider

---
*Phase: 24-superfilter*
*Completed: 2026-03-05*
