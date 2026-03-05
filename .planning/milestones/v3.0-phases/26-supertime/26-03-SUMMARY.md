---
phase: 26-supertime
plan: 03
subsystem: ui
tags: [supergrid, time-axis, period-selection, filter-provider, cmd-click, tdd, d3]

# Dependency graph
requires:
  - phase: 26-supertime
    plan: 02
    provides: "Segmented pills (A|D|W|M|Q|Y), _isAutoGranularity, _computeSmartHierarchy() in SuperGrid — required for granularity-aware Cmd+click routing"
provides:
  - "_periodSelection: Set<string> — Tier 3 ephemeral non-contiguous period selection state in SuperGrid"
  - "_showAllBtnEl: Show All button in toolbar, visible when period selection active"
  - "_clearPeriodSelection(): clears set, calls filter.clearAxis(), hides Show All button"
  - "Modified Cmd+click handler: routes to period selection for time axes with active granularity, SLCT-05 otherwise"
  - "Teal accent background (rgba(0,150,136,0.18)) on selected period col headers"
  - "Escape key clears period selection first, card selection on second press"
  - "Axis-change cleanup in _wireDropZone: stale period selection cleared when time axis removed"
affects:
  - "Future phases using FilterProvider axis filters or period-based time navigation"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_periodSelection Set<string> pattern: Tier 3 ephemeral state for non-contiguous period selection; keys are strftime-formatted values from CellDatum[colField] to match FilterProvider IN (?) compilation"
    - "Immediate _renderCells() after period toggle: provides instant visual feedback before FilterProvider subscriber fires _fetchAndRender()"
    - "_clearPeriodSelection() immediate button update: directly sets _showAllBtnEl.style.display='none' without waiting for _renderCells() cycle"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Immediate _renderCells() after period toggle (not relying on FilterProvider subscriber): Cmd+click updates _periodSelection, calls filter.setAxisFilter(), then immediately calls _renderCells() for teal accent and Show All button visibility. FilterProvider subscriber fires _fetchAndRender() asynchronously for full re-query. This prevents visual lag without requiring the FilterProvider mock to implement real subscriber behavior in tests."
  - "_clearPeriodSelection() also directly hides Show All button: Because _clearPeriodSelection() is called from Show All click and Escape handlers (which are synchronous), the button is hidden immediately rather than waiting for the next _renderCells() call — necessary for correct test behavior with mocked FilterProvider."
  - "strftime-formatted values in no-granularity fallthrough test: The test for Cmd+click → SLCT-05 when axisGranularity=null uses strftime-bucketed cell values ('2026-01') rather than ISO dates ('2026-01-01'). This ensures _computeSmartHierarchy returns null (parseDateString('2026-01')=null) and _fetchAndRender() renders normally without triggering the auto-detection setGranularity/return-early path."
  - "Axis-change cleanup in cross-dimension transpose only: _wireDropZone handles both same-dimension reorder and cross-dimension transpose. Period selection cleanup is applied to cross-dimension transpose (where the time field can move off colAxes) using the post-mutation axis arrays to detect field absence."

patterns-established:
  - "Pattern: period key = cell.value from HeaderCell — this is exactly the strftime-formatted value from CellDatum[colField], ensuring FilterProvider IN (?) compilation matches query results without additional transformation"
  - "Pattern: time field routing in Cmd+click — check isTimeField AND hasGranularity before period selection path; both conditions required to avoid SLCT-05 regression on non-time or no-granularity axes"

requirements-completed:
  - TIME-04
  - TIME-05

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 26 Plan 03: SuperGrid Non-Contiguous Period Selection Summary

**`_periodSelection: Set<string>` with Cmd+click toggle on time col headers compiling to FilterProvider.setAxisFilter() IN (?) clause, with Show All button, Escape key clear, teal accent rendering, and axis-change cleanup.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T16:55:41Z
- **Completed:** 2026-03-05T17:02:40Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- `_periodSelection: Set<string>` field added to SuperGrid — Tier 3 ephemeral non-contiguous period selection (not persisted per D-005)
- Modified Cmd+click handler in `_createColHeaderCell()`: routes to period selection when axis is a time field (`ALLOWED_COL_TIME_FIELDS`) with active granularity (`axisGranularity !== null`); falls through to SLCT-05 card selection for non-time axes or null granularity
- Teal accent background (`rgba(0, 150, 136, 0.18)`) applied to selected period col headers on every `_renderCells()` rebuild — distinct from blue card selection accent
- "Show All" button in toolbar (`.show-all-periods-btn`): hidden by default, shown when `_periodSelection.size > 0`, clicking calls `_clearPeriodSelection()`
- Escape key handler updated: first Escape clears period selection (returns early), second Escape clears card selection
- `_wireDropZone` cross-dimension drop handler: detects time field absence after transpose → calls `_clearPeriodSelection()` to prevent stale FilterProvider axis filter
- 9 new TDD tests GREEN, 1838 total tests passing (↑9 from 1829)

## Task Commits

Each task was committed atomically (TDD):

1. **RED — Failing tests** - `974ae295` (test): 8 failing tests for TIME-04/TIME-05 period selection
2. **GREEN — Implementation** - `459da0f4` (feat): period selection with 1838 tests passing

_Note: TDD task has two commits (test → feat). No REFACTOR needed — implementation was clean._

## Files Created/Modified

- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — Added _periodSelection field, _showAllBtnEl, Show All button in mount(), _clearPeriodSelection() method, modified Cmd+click handler with period selection routing, teal accent in _createColHeaderCell, Escape key period-first clear, axis-change cleanup in _wireDropZone, _renderCells Show All visibility update, destroy() cleanup
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` — 9 new tests in TIME-04/TIME-05 describe block covering toggle, deselect, multi-select, SLCT-05 non-regression, teal accent, Show All button, Show All click, Escape clear, no-granularity fallthrough

## Decisions Made

**Immediate _renderCells() after period toggle:** After updating `_periodSelection` and calling `filter.setAxisFilter()`, the handler immediately calls `_renderCells(this._lastCells, ...)` for instant visual feedback (teal accent, Show All button). FilterProvider subscriber fires `_fetchAndRender()` asynchronously for the full re-query. This avoids visual lag and makes tests work correctly with mocked FilterProvider.

**_clearPeriodSelection() directly hides Show All button:** The button is hidden synchronously inside `_clearPeriodSelection()` rather than waiting for the next `_renderCells()` call. Required because Show All click and Escape are synchronous handlers where the FilterProvider mock doesn't trigger a re-render cycle.

**No-granularity test uses strftime-bucketed cell values:** The test verifying Cmd+click → SLCT-05 fallthrough when `axisGranularity=null` uses `'2026-01'` (strftime output) not `'2026-01-01'` (ISO date). ISO dates trigger `_computeSmartHierarchy()` → `setGranularity()` → early return, preventing `_renderCells()` from ever running. Strftime values parse as null → no auto-detection → grid renders normally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three test design corrections**

- **Found during:** GREEN phase (tests failing after implementation)
- **Issue 1 — No immediate re-render after period toggle:** The plan's action spec described calling `filter.setAxisFilter()` and relying on "FilterProvider subscriber → StateCoordinator → _fetchAndRender()" for visual updates. But with mocked FilterProvider in tests, no subscriber fires. Teal accent and Show All button visibility tests failed.
- **Fix 1:** Added `this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes)` after the period toggle in the Cmd+click handler — provides immediate visual feedback independent of the subscriber chain.
- **Issue 2 — _clearPeriodSelection() needed to directly hide Show All:** The test for "Show All button click removes accent" checked `showAllBtn.style.display` immediately after click. Without direct DOM update in `_clearPeriodSelection()`, the button stayed visible until the next `_renderCells()` from FilterProvider subscriber.
- **Fix 2:** Added `if (this._showAllBtnEl) { this._showAllBtnEl.style.display = 'none'; }` directly in `_clearPeriodSelection()`.
- **Issue 3 — No-granularity test used ISO dates:** The test `'TIME-04: Cmd+click on time header with NO granularity falls through to SLCT-05'` used `{ created_at: '2026-01-01' }` cells. Auto-detection computed `'day'` for the single-date range, called `setGranularity()`, and returned early — so no headers were ever rendered.
- **Fix 3:** Updated test to use `{ created_at: '2026-01' }` (strftime-formatted) so `parseDateString` returns null → no auto-detection → grid renders → headers exist for the Cmd+click test.
- **Files modified:** src/views/SuperGrid.ts, tests/views/SuperGrid.test.ts
- **Verification:** All 252 SuperGrid tests pass; all 1838 total tests pass
- **Committed in:** 459da0f4 (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, 3 sub-issues all in implementation/test alignment)
**Impact on plan:** All fixes necessary for correct test behavior with mocked dependencies. No scope creep. The core period selection logic matched the plan exactly; fixes were in the layer between FilterProvider mocking and visual update timing.

## Issues Encountered

None — the core implementation was straightforward. The test failures were caused by interaction between mocked FilterProvider (no real subscriber chain) and the implementation's reliance on that chain for visual updates. All resolved by adding immediate DOM updates in the handler.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TIME-04, TIME-05 complete — non-contiguous period selection fully implemented
- Phase 26 (SuperTime) is now COMPLETE: TIME-01 through TIME-05 all satisfied
- Phase 27 can proceed: v3.0 SuperGrid Complete milestone final phase

---
*Phase: 26-supertime*
*Completed: 2026-03-05*
