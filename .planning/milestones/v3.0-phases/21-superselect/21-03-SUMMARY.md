---
phase: 21-superselect
plan: "03"
subsystem: ui
tags: [supergrid, selection, lasso, bbox-cache, d3, typescript]

# Dependency graph
requires:
  - phase: 21-superselect Plan 01
    provides: SuperGridBBoxCache — post-render DOM snapshot for O(1) hit-testing
  - phase: 21-superselect Plan 02
    provides: SuperGridSelect SVG lasso overlay + classifyClickZone discriminator

provides:
  - Full selection wiring in SuperGrid: click, Cmd+click, Shift+click 2D range, header select-all, Escape clear
  - Floating selection badge showing card count
  - _updateSelectionVisuals() direct DOM walk with blue tint + outline (#1a56f0)
  - SelectionProvider adapter in main.ts wiring SelectionProvider to SuperGridSelectionLike
  - BBoxCache.scheduleSnapshot() called at end of every _renderCells()
  - SuperGridSelect lasso attached in mount(), detached in destroy()

affects: [27-supercards, 22-supertime, 26-supernight, main.ts, TreeView, NetworkView]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "capture `self = this` before D3 `.each(function(d))` to preserve class instance reference in onclick handlers"
    - "SuperGridSelectionLike adapter in main.ts bridges cell-level (card_ids[]) API to flat SelectionProvider"
    - "Selection visuals via direct DOM walk (_updateSelectionVisuals) not D3 re-render — avoids full join cost"
    - "Shift+click 2D range uses ordered row/col keys from _lastCells to compute rectangle bounds"
    - "jsdom SIZE tests stub setPointerCapture/releasePointerCapture on .supergrid-view root (SuperGridSelect wires to root)"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/main.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "self = this pattern captures class instance before D3 .each(function(d)) — arrow function inside function() captures DOM element as this"
  - "SuperGridSelectionLike adapter lives in main.ts not SuperGrid constructor — keeps SuperGrid decoupled from concrete SelectionProvider"
  - "isSelectedCell in main.ts adapter returns false — SuperGrid manages cell→card mapping internally via _updateSelectionVisuals"
  - "Shift+click without anchor falls back to plain select (no crash, no stale range)"
  - "SuperGridSelect.attach() called inside _fetchAndRender().then() — ensures grid has content before lasso overlay activates"

patterns-established:
  - "Phase 21 self=this pattern: capture class ref before D3 .each(function(d)) for onclick handlers"
  - "SuperGridSelectionLike adapter pattern: bridge cell-level selection to card-level provider in main.ts"

requirements-completed: [SLCT-01, SLCT-02, SLCT-03, SLCT-05, SLCT-07]

# Metrics
duration: 8min
completed: 2026-03-05
---

# Phase 21 Plan 03: SuperSelect Integration Wiring Summary

**Full SuperGrid selection wiring: click/Cmd+click/Shift+click 2D range, header select-all, Escape clear, floating badge, BBoxCache snapshot, and SuperGridSelect lasso lifecycle with SelectionProvider adapter in main.ts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-05T02:24:32Z
- **Completed:** 2026-03-05T02:32:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Wired all 5 SLCT requirements (01/02/03/05/07) into SuperGrid.ts with 21 new integration tests
- SuperGrid now accepts optional 6th constructor arg (SuperGridSelectionLike) with no-op default for backward-compat
- Selection visual updates via direct DOM walk (_updateSelectionVisuals) using #1a56f0 accent color
- Floating selection badge (sticky, bottom-right) shows "N cards selected" when selection is non-empty
- BBoxCache.scheduleSnapshot() called at end of every _renderCells() for O(1) lasso hit-testing
- SuperGridSelect attached in mount().then() callback, detached in destroy()
- SelectionProvider adapter in main.ts maps SelectionProvider's flat card-ID API to SuperGridSelectionLike

## Task Commits

Each task was committed atomically:

1. **Task 1: SuperGrid selection adapter, click handlers, visual updates, badge, Escape key** - `5a947c3a` (feat)
2. **Task 2: Wire SelectionProvider into main.ts as 6th SuperGrid arg** - `5ed9d7db` (feat)

## Files Created/Modified

- `src/views/SuperGrid.ts` — Added 6th constructor param, BBoxCache/SuperGridSelect lifecycle, click handlers (SLCT-01/02/03), header Cmd+click (SLCT-05), Escape handler (SLCT-07), _updateSelectionVisuals, _getCellCardIds, _getRectangularRangeCardIds helpers, floating badge, scheduleSnapshot call
- `src/main.ts` — Added SuperGridSelectionLike import, created adapter over SelectionProvider, passed as 6th arg to SuperGrid factory
- `tests/views/SuperGrid.test.ts` — Added 21 SLCT integration tests, fixed SIZE-01/SIZE-04 tests to stub setPointerCapture/releasePointerCapture on root element

## Decisions Made

- **self = this pattern:** D3's `.each(function(d))` changes `this` to the DOM element. Arrow functions inside it capture `this` from the enclosing function scope (the DOM element). Fixed by capturing `const self = this` before the D3 chain.
- **Adapter in main.ts:** SuperGridSelectionLike adapter lives in main.ts rather than inside SuperGrid constructor. This keeps SuperGrid decoupled from the concrete SelectionProvider class — SuperGrid only knows about the interface.
- **isSelectedCell returns false in adapter:** The adapter's `isSelectedCell` returns false because SuperGrid manages cell→card mapping internally in `_updateSelectionVisuals` (it calls `isSelectedCell` on `_selectionAdapter` using `_lastCells`). The adapter's `isSelectedCell` is not called in the default flow.
- **SuperGridSelect.attach() in .then():** Lasso overlay attached inside `_fetchAndRender().then()` to ensure grid has content before lasso activates. No functional difference but semantically cleaner.
- **Shift+click fallback:** Without a prior plain-click anchor, Shift+click falls back to plain select (calls `select()` not range). No crash, no stale state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `this` context in D3 `.each()` onclick handler**
- **Found during:** Task 1 (GREEN phase — tests failing with "this._getCellCardIds is not a function")
- **Issue:** D3's `.each(function(d))` rebinds `this` to the DOM element. Arrow function inside it captured the DOM element's `this`, not the class instance.
- **Fix:** Added `const self = this` before the D3 chain; updated onclick handler to use `self._getCellCardIds`, `self._selectionAdapter`, `self._selectionAnchor`.
- **Files modified:** `src/views/SuperGrid.ts`
- **Verification:** All 122 tests pass after fix
- **Committed in:** `5a947c3a` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed SIZE-01/SIZE-04 tests broken by SuperGridSelect pointer event wiring**
- **Found during:** Task 2 (full test suite run)
- **Issue:** SIZE tests dispatch bubbling PointerEvents on `.col-resize-handle`. These bubble to `.supergrid-view` root, triggering SuperGridSelect._handlePointerDown which calls `root.setPointerCapture()` — a method jsdom doesn't define. This was harmless before (no lasso), but now SuperGridSelect is wired in mount().
- **Fix:** Added `setPointerCapture` / `releasePointerCapture` stubs directly on `.supergrid-view` element in SIZE-01 and SIZE-04 tests (jsdom pattern from STATE.md).
- **Files modified:** `tests/views/SuperGrid.test.ts`
- **Verification:** All 122 tests pass with exit code 0
- **Committed in:** `5ed9d7db` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — bugs)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep. Plan executed as specified apart from the `self=this` D3 context issue.

## Issues Encountered

- TypeScript strict mode correctly caught return-type mismatch on `subscribe` mock — fixed by typing the adapter as `SuperGridSelectionLike` instead of `ReturnType<typeof makeMockSelectionAdapter>`.

## Next Phase Readiness

- All 8 SLCT requirements satisfied across Plans 21-01, 21-02, 21-03
- Phase 21 SuperSelect is complete
- Selection state flows: SelectionProvider → SuperGridSelectionLike adapter → SuperGrid visuals + badge
- SuperGridSelect lasso + BBoxCache fully integrated with SuperGrid lifecycle
- Ready for Phase 22+ or whatever comes next in v3.0

---
*Phase: 21-superselect*
*Completed: 2026-03-05*
