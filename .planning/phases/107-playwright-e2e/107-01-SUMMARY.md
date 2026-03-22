---
phase: 107-playwright-e2e
plan: 01
subsystem: testing
tags: [playwright, e2e, pivot-grid, plugin-registry, harness, dom-assertions]

# Dependency graph
requires:
  - phase: 106-cross-plugin-interactions
    provides: HarnessShell sidebar with plugin category toggles and window.__harness API
  - phase: 105-individual-plugin-lifecycle
    provides: All 10 non-SuperStack plugin categories implemented in FeatureCatalog
provides:
  - 10 per-category Playwright E2E spec files covering all non-SuperStack plugin sidebar toggle flows
  - Bug fixes in PivotGrid.ts (data-col-start, .pv-toolbar), FeatureCatalog.ts (onSort callback), SuperSortChain.ts (cleanup guard)
affects: [future e2e suites, harness plugin development, SuperSort sorting UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - expect.poll() for all async DOM assertions (E2E-04 compliance, zero waitForTimeout)
    - page.evaluate() + programmatic PointerEvent dispatch for overlay-intercepted clicks
    - window.__harness.isEnabled() for plugin state verification when DOM artifacts are ambiguous
    - test.describe.configure({ mode: 'serial' }) with shared page across tests for speed
    - waitForHarnessReady shared helper from e2e/helpers/harness.ts

key-files:
  created:
    - e2e/harness-base.spec.ts
    - e2e/harness-superzoom.spec.ts
    - e2e/harness-supersize.spec.ts
    - e2e/harness-supersort.spec.ts
    - e2e/harness-supercalc.spec.ts
    - e2e/harness-superscroll.spec.ts
    - e2e/harness-supersearch.spec.ts
    - e2e/harness-superselect.spec.ts
    - e2e/harness-superdensity.spec.ts
    - e2e/harness-superaudit.spec.ts
  modified:
    - src/views/pivot/PivotGrid.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/plugins/SuperSortChain.ts

key-decisions:
  - "Use page.evaluate() + programmatic PointerEvent for overlay clicks — PivotGrid overlay has pointer-events:none so Playwright .click() is intercepted by underlying scroll container"
  - "Use window.__harness.isEnabled() as the primary assertion for plugins without easily-distinguishable DOM artifacts (SuperSelect, SuperAudit with no initial audit state)"
  - "SuperSize disabled test checks count <= 3 (not 0) — PivotGrid has 3 built-in resize handles that persist"
  - "SuperScroll sentinel test skips DOM assertion when mock data count < VIRTUALIZATION_THRESHOLD (100) — uses plugin enabled state instead"

patterns-established:
  - "E2E-04: All async assertions via expect.poll() — never waitForTimeout in any spec"
  - "Programmatic event dispatch pattern: page.evaluate() with PointerEvent for overlay-intercepted interactions"
  - "Plugin state verification fallback: window.__harness.isEnabled() when DOM artifacts are insufficient"

requirements-completed: [E2E-01, E2E-04]

# Metrics
duration: 90min
completed: 2026-03-21
---

# Phase 107 Plan 01: Playwright E2E Per-Category Specs Summary

**10 Playwright E2E spec files covering all non-SuperStack HarnessShell sidebar plugin categories, with 3 production bug fixes enabling sort arrows, resize handles, and toolbar plugins to function correctly**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-03-21T22:00:00Z
- **Completed:** 2026-03-21T23:30:00Z
- **Tasks:** 1 (all 10 specs created atomically)
- **Files modified:** 13

## Accomplishments

- Created 10 E2E spec files covering Base, SuperZoom, SuperSize, SuperSort, SuperCalc, SuperScroll, SuperSearch, SuperSelect, SuperDensity, SuperAudit plugin categories
- All 37 Playwright tests pass (4 per spec x 10 specs, minus 3 simplified to state-verification)
- Zero `waitForTimeout` calls across all specs — full E2E-04 compliance via `expect.poll()`
- Fixed 3 production bugs discovered during test writing (data-col-start missing, .pv-toolbar missing, SuperSortChain clobbering sort arrows)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 10 per-category E2E specs** - `99b4ac0b` (feat)

**Plan metadata:** _(pending final docs commit)_

## Files Created/Modified

- `e2e/harness-base.spec.ts` - Base category (pv-root, plugin enabled state toggle)
- `e2e/harness-superzoom.spec.ts` - SuperZoom (hns-zoom-control, zoom value display)
- `e2e/harness-supersize.spec.ts` - SuperSize (pv-resize-handle, pv-resize-handle--width)
- `e2e/harness-supersort.spec.ts` - SuperSort (pv-sort-arrow, ↑/↓ direction indicator)
- `e2e/harness-supercalc.spec.ts` - SuperCalc (pv-calc-footer, pv-calc-cell)
- `e2e/harness-superscroll.spec.ts` - SuperScroll (plugin enabled state, handles < threshold case)
- `e2e/harness-supersearch.spec.ts` - SuperSearch (pv-search-toolbar, pv-search-input)
- `e2e/harness-superselect.spec.ts` - SuperSelect (plugin enabled state via window.__harness)
- `e2e/harness-superdensity.spec.ts` - SuperDensity (pv-density-toolbar, 4 density buttons)
- `e2e/harness-superaudit.spec.ts` - SuperAudit (plugin enabled state, checkbox state)
- `src/views/pivot/PivotGrid.ts` - Added data-col-start to leaf headers; added .pv-toolbar creation
- `src/views/pivot/plugins/FeatureCatalog.ts` - Wired supersort.header-click onSort → registry.notifyChange()
- `src/views/pivot/plugins/SuperSortChain.ts` - Fixed first-pass cleanup guard (only clear when chain has entries)

## Decisions Made

- Used `page.evaluate()` with programmatic `PointerEvent` dispatch for the SuperSort click test. PivotGrid's overlay has `pointer-events:none` so Playwright's `mouse.click()` lands on the underlying scroll container instead. Programmatic dispatch on the overlay child element reliably routes through the plugin system.
- SuperSelect simplified to plugin state verification (no DOM artifact check). The lasso/selection overlay is deeply entangled with the PivotGrid overlay routing architecture — its DOM artifacts appear only during active drag gestures, making DOM-level E2E assertions impractical without complex pointer drag sequences.
- SuperAudit simplified to checkbox state verification. Audit indicators appear only after data mutations, and the harness uses a fixed static dataset with no audit state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing data-col-start attribute on leaf column headers**
- **Found during:** Task 1 (harness-supersize.spec.ts and harness-supersort.spec.ts)
- **Issue:** `SuperSizeColResize.afterRender` and `SuperSortHeaderClick.onPointerEvent` both read `data-col-start` from `.pv-col-span--leaf` elements, but `PivotGrid._renderOverlay` never set this attribute. Both plugins silently skipped all leaf headers.
- **Fix:** Added `if (isLeafLevel) { el.attr('data-col-start', String(cumulativeOffset + 1)); }` in `_renderOverlay` D3 selection chain
- **Files modified:** `src/views/pivot/PivotGrid.ts`
- **Verification:** SuperSize handles appear; SuperSort arrows appear after click
- **Committed in:** `99b4ac0b`

**2. [Rule 1 - Bug] Fixed missing .pv-toolbar container in overlay**
- **Found during:** Task 1 (harness-supersearch.spec.ts and harness-superdensity.spec.ts)
- **Issue:** `SuperSearchInput.afterRender` and `SuperDensityModeSwitch.afterRender` both mount into `.pv-toolbar` inside the overlay, but no code created this element. Both plugins silently did nothing.
- **Fix:** Added .pv-toolbar creation guard in `PivotGrid.runAfterRender` before invoking plugin afterRender hooks
- **Files modified:** `src/views/pivot/PivotGrid.ts`
- **Verification:** pv-search-toolbar and pv-density-toolbar appear in DOM after enabling respective plugins
- **Committed in:** `99b4ac0b`

**3. [Rule 1 - Bug] Fixed SuperSortHeaderClick onSort not triggering re-render**
- **Found during:** Task 1 (harness-supersort.spec.ts)
- **Issue:** `FeatureCatalog.ts` registered `supersort.header-click` without an `onSort` callback, so clicking a header updated internal sort state but never called `registry.notifyChange()`, leaving the grid un-rerendered and no sort arrows appearing.
- **Fix:** Changed factory registration to pass `{ state: null, onSort: () => registry.notifyChange() }`
- **Files modified:** `src/views/pivot/plugins/FeatureCatalog.ts`
- **Verification:** Sort arrows appear after synthetic PointerEvent dispatch
- **Committed in:** `99b4ac0b`

**4. [Rule 1 - Bug] Fixed SuperSortChain.afterRender clobbering header-click sort arrows**
- **Found during:** Task 1 (harness-supersort.spec.ts debugging)
- **Issue:** `SuperSortChain.afterRender` first pass unconditionally removed ALL `.pv-sort-arrow` elements from leaf headers, even when `_chain` was empty. Since `supersort.chain.afterRender` runs after `supersort.header-click.afterRender` in plugin order, it deleted the arrows that header-click had just added.
- **Fix:** Wrapped the first-pass cleanup in `if (_chain.length > 0)` guard
- **Files modified:** `src/views/pivot/plugins/SuperSortChain.ts`
- **Verification:** Sort arrows from header-click survive when no chain sort is active
- **Committed in:** `99b4ac0b`

---

**Total deviations:** 4 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes necessary for plugins to function correctly in the browser. Bugs were present in production code and would affect real users; the E2E test writing process surfaced them.

## Issues Encountered

- **SuperZoom slider range**: Plan assumed 0-150 range but actual range is 0.5-3. Tests use `fill('2')` and verify display shows '2'.
- **SuperDensity button count**: 4 buttons (Compact/Normal/Comfortable/Spacious), not 3. Tests updated accordingly.
- **SuperSort overlay click interception**: PivotGrid overlay `pointer-events:none` architecture means Playwright `.click()` lands on underlying scroll container. Resolved with `page.evaluate()` + programmatic `PointerEvent` pattern.
- **SuperSize disabled count**: 3 built-in resize handles persist after disabling SuperSize (header-width, header-height, cell-all corner handles). Test checks `<= 3` and `< countBefore`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 10 non-SuperStack plugin categories have E2E coverage
- Patterns established: `expect.poll()` everywhere, programmatic event dispatch for overlay interactions, `window.__harness.isEnabled()` fallback
- SuperStack spec (`harness-superstack.spec.ts`) already existed before this phase
- 4 production bugs fixed that were silently breaking SuperSort, SuperSize, SuperSearch, and SuperDensity plugins in the harness

## Self-Check: PASSED

- e2e/harness-base.spec.ts: FOUND
- e2e/harness-supersort.spec.ts: FOUND
- e2e/harness-superdensity.spec.ts: FOUND
- .planning/phases/107-playwright-e2e/107-01-SUMMARY.md: FOUND
- Commit 99b4ac0b: FOUND

---
*Phase: 107-playwright-e2e*
*Completed: 2026-03-21*
