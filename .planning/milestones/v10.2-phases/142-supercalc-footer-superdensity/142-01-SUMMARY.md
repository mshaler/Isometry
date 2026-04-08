---
phase: 142-supercalc-footer-superdensity
plan: "01"
subsystem: ui
tags: [pivot, plugins, supercalc, superdensity, dom, tdd]

# Dependency graph
requires:
  - phase: 141
    provides: afterRender root changed to _scrollContainer
provides:
  - SuperCalcFooter mounts inside scroll container (root.appendChild)
  - SuperDensityModeSwitch applies density class to root element directly
affects: [pivot, plugins, cross-plugin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "afterRender root parameter is the scroll container — plugins must operate within it"
    - "_rootRef module-level variable captures root for deferred click handler use"

key-files:
  created: []
  modified:
    - src/views/pivot/plugins/SuperCalcFooter.ts
    - src/views/pivot/plugins/SuperDensityModeSwitch.ts
    - tests/views/pivot/SuperCalc.test.ts
    - tests/views/pivot/SuperDensity.test.ts
    - tests/views/pivot/CrossPluginBehavioral.test.ts

key-decisions:
  - "SuperCalcFooter: footer is a direct child of root (scroll container), not root.parentElement — sticky positioning works because scroll container has overflow:auto"
  - "SuperDensityModeSwitch: density class applied to root (scroll container); cascade to .pv-data-cell descendants works because they are inside the scroll container"
  - "_rootRef pattern: store root reference in closure so click handler can apply density class after afterRender returns"

patterns-established:
  - "Plugin root = scroll container: all afterRender plugins must query/append within root, not root.parentElement"

requirements-completed:
  - CALC-FIX-01
  - DENS-FIX-01

# Metrics
duration: 8min
completed: 2026-04-08
---

# Phase 142 Plan 01: SuperCalc Footer + SuperDensity Fix Summary

**Fixed SuperCalcFooter (mounts inside scroll container) and SuperDensityModeSwitch (applies density class to root element) broken by Phase 141's afterRender root change**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-08T03:39:00Z
- **Completed:** 2026-04-08T03:44:48Z
- **Tasks:** 2 (TDD)
- **Files modified:** 5

## Accomplishments
- SuperCalcFooter now appends `.pv-calc-footer` inside root (scroll container) — sticky footer works because scroll container has `overflow:auto`
- SuperDensityModeSwitch now applies `pv-density--compact` (etc.) to root directly — CSS cascade to `.pv-data-cell` descendants works because cells are inside scroll container
- Added `_rootRef` to capture root for click handler use after `afterRender` returns
- Updated CrossPluginBehavioral tests to match corrected DOM targets

## Task Commits

Each task was committed atomically (TDD: test → fix):

1. **Task 1 RED: SuperCalcFooter tests for root-child positioning** - `c8e80bc2` (test)
2. **Task 1 GREEN: SuperCalcFooter fix** - `28213a45` (fix)
3. **Task 2 RED: SuperDensityModeSwitch tests for root-class behavior** - `6a3a8ca6` (test)
4. **Task 2 GREEN: SuperDensityModeSwitch fix** - `04fabd1c` (fix)
5. **Deviation auto-fix: CrossPluginBehavioral test updates** - `c11e0c0f` (fix)

## Files Created/Modified
- `src/views/pivot/plugins/SuperCalcFooter.ts` - Removed gridWrapper lookup, append footer to root directly
- `src/views/pivot/plugins/SuperDensityModeSwitch.ts` - Removed .pv-grid-wrapper lookup, apply class to root + _rootRef for click handler
- `tests/views/pivot/SuperCalc.test.ts` - Added 3 new tests: footer as direct child of root, sibling of table, destroy removes from root
- `tests/views/pivot/SuperDensity.test.ts` - Added 3 new tests: compact class on root, removal on normal, click changes class on root
- `tests/views/pivot/CrossPluginBehavioral.test.ts` - Updated footer querySelector and density class assertion targets

## Decisions Made
- Footer uses `root.querySelector` + `root.appendChild` — no parentElement traversal needed or wanted
- Density class on root (scroll container) cascades correctly because all `.pv-data-cell` elements are inside the scroll container
- `_rootRef` stored in closure so density button click handlers can apply class asynchronously

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CrossPluginBehavioral tests checked old DOM targets**
- **Found during:** Full pivot test suite run (post-Task 2 green)
- **Issue:** `CrossPluginBehavioral.test.ts` had 3 assertions checking old DOM targets: footer via `rootEl.parentElement.querySelector` (3 tests) and density class on `.pv-grid-wrapper` (1 test)
- **Fix:** Changed footer queries to `rootEl.querySelector` (footer now inside rootEl); changed density assertion to check `root.classList` directly. Also removed stale comment in `makeCtx()`
- **Files modified:** `tests/views/pivot/CrossPluginBehavioral.test.ts`
- **Verification:** 84/84 CrossPluginBehavioral tests pass; 458/458 total across all 3 test files
- **Committed in:** `c11e0c0f`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: stale test assertions for changed DOM behavior)
**Impact on plan:** Auto-fix necessary for correctness — tests were testing the old broken behavior.

## Issues Encountered
- SuperStackSpans VPOL-02 tests (3 failures) in the full pivot suite — pre-existing failures from parallel agent work (Phase 141 SuperStackSpans changes + new tests not yet wired). Out of scope for this plan. Not introduced by this plan's changes.
- TypeScript errors in `tests/providers/FilterProvider.test.ts` — pre-existing from another agent's MembershipFilter work. Out of scope.

## Next Phase Readiness
- Both CALC-FIX-01 and DENS-FIX-01 complete
- SuperCalcFooter sticky footer works correctly within scroll container
- SuperDensityModeSwitch CSS cascade to .pv-data-cell restored
- Phase 142 Plan 02 (if any) can proceed with correct DOM structure

## Self-Check: PASSED
- FOUND: src/views/pivot/plugins/SuperCalcFooter.ts
- FOUND: src/views/pivot/plugins/SuperDensityModeSwitch.ts
- FOUND: .planning/phases/142-supercalc-footer-superdensity/142-01-SUMMARY.md
- FOUND: c8e80bc2 (test RED - SuperCalcFooter)
- FOUND: 28213a45 (fix GREEN - SuperCalcFooter)
- FOUND: 6a3a8ca6 (test RED - SuperDensityModeSwitch)
- FOUND: 04fabd1c (fix GREEN - SuperDensityModeSwitch)
- FOUND: c11e0c0f (fix - CrossPluginBehavioral test updates)

---
*Phase: 142-supercalc-footer-superdensity*
*Completed: 2026-04-08*
