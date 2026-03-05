---
phase: 21-superselect
plan: "02"
subsystem: ui
tags: [svg, lasso, pointer-events, tdd, vitest, jsdom]

# Dependency graph
requires:
  - phase: 21-01
    provides: SuperGridBBoxCache.hitTest() and SuperGridSelectionLike interface
provides:
  - SuperGridSelect class: SVG lasso overlay with attach/detach lifecycle and pointer event handling
  - classifyClickZone pure function: discriminates header/data-cell/supergrid-card/grid zones
  - 40 unit tests covering both classifyClickZone and lasso lifecycle
affects: [21-03, SuperGrid.ts lasso wiring, Phase 27 supergrid-card zone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SVG overlay via createElementNS (not createElement) — critical for correct SVG namespace
    - 4px drag threshold guard before activating lasso (prevents click misclassification)
    - setPointerCapture/releasePointerCapture for reliable cross-element tracking
    - getCellCardIds callback parameter decouples SuperGridSelect from CellDatum internals
    - jsdom setPointerCapture workaround: define function directly on element before vi.spyOn

key-files:
  created:
    - src/views/supergrid/SuperGridSelect.ts
    - tests/views/supergrid/SuperGridSelect.test.ts
  modified: []

key-decisions:
  - "classifyClickZone priority order: header > supergrid-card > data-cell > grid (first match wins)"
  - "getCellCardIds injected as callback parameter — keeps SuperGridSelect decoupled from CellDatum"
  - "jsdom doesn't define setPointerCapture/releasePointerCapture natively — define as vi.fn() directly on element (not vi.spyOn which requires existing property)"
  - "hitTest called with client coordinates in both pointermove and pointerup — matches BBoxCache which stores client coords from getBoundingClientRect"

patterns-established:
  - "SuperGridSelect follows attach/detach lifecycle matching SuperZoom/SuperGridSizer/SuperGridBBoxCache"
  - "All SVG elements created with document.createElementNS('http://www.w3.org/2000/svg', ...) not createElement"
  - "Lasso rect SVG attributes (x/y/width/height) use container-relative coords; hitTest uses client coords"

requirements-completed: [SLCT-04, SLCT-06]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 21 Plan 02: SuperGridSelect Summary

**SVG lasso overlay with classifyClickZone zone discrimination: attach/detach lifecycle, 4px threshold guard, BBoxCache hit-testing, Cmd+lasso addToSelection, 40 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T02:16:25Z
- **Completed:** 2026-03-05T02:20:35Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `classifyClickZone()` pure function discriminates 4 zones (header/data-cell/supergrid-card/grid) by walking DOM upward via `.closest()`
- `SuperGridSelect` class with full attach/detach lifecycle: creates SVG overlay via `createElementNS`, wires pointerdown/move/up/cancel
- Lasso visual: blue dashed rect (`rgba(26,86,240,0.08)` fill, `#1a56f0` stroke, `4 3` dasharray, `1.5` stroke-width)
- 4px drag threshold prevents click-to-lasso misclassification; header/supergrid-card zones block lasso start
- `getCellCardIds` callback decouples lasso from `CellDatum` — SuperGrid provides its `_lastCells` cache via lambda
- 40 passing tests: 10 classifyClickZone, 10 lifecycle, 20 lasso interaction; no regressions (pre-existing 5 failures unaffected)

## Task Commits

Each task was committed atomically:

1. **Task 1: classifyClickZone pure function + SuperGridSelect lasso with TDD** - `8aa4d86f` (feat)

**Plan metadata:** (pending docs commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor). This task collapsed RED and GREEN into one implementation pass after fixture issue (jsdom setPointerCapture) was resolved inline._

## Files Created/Modified
- `src/views/supergrid/SuperGridSelect.ts` - SuperGridSelect class (attach/detach/pointer handlers) and classifyClickZone pure function (299 lines)
- `tests/views/supergrid/SuperGridSelect.test.ts` - 40 unit tests covering classifyClickZone, lifecycle, and lasso interactions (539 lines)

## Decisions Made
- `classifyClickZone` priority order is header > supergrid-card > data-cell > grid — header wins over everything since header clicks should never start a lasso
- `getCellCardIds` injected as callback parameter so SuperGridSelect doesn't import or know about `CellDatum` — follows narrow-interface pattern established in Phase 17
- `hitTest` is called in both `pointermove` (for live highlight) and `pointerup` (for final selection) using client coordinates — consistent with BBoxCache which stores client coords
- jsdom workaround: `setPointerCapture` and `releasePointerCapture` are not defined in jsdom by default; assigned directly as `vi.fn()` before `vi.spyOn` (which requires an existing property)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed jsdom setPointerCapture test setup**
- **Found during:** Task 1 (GREEN phase — running tests)
- **Issue:** `vi.spyOn(rootEl, 'setPointerCapture')` throws "property not defined" in jsdom because jsdom doesn't implement PointerEvent capture APIs
- **Fix:** Changed test setup to assign `rootEl.setPointerCapture = vi.fn()` and `rootEl.releasePointerCapture = vi.fn()` directly on the element before attaching SuperGridSelect
- **Files modified:** `tests/views/supergrid/SuperGridSelect.test.ts`
- **Verification:** All 40 tests pass after fix
- **Committed in:** `8aa4d86f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test fixture bug in jsdom environment)
**Impact on plan:** Minimal — only test setup affected, no production code change required.

## Issues Encountered
- jsdom PointerEvent API gap: `setPointerCapture`/`releasePointerCapture` not defined. Resolved by direct assignment as vi.fn() rather than vi.spyOn (documented as jsdom pattern for future phases using pointer capture).

## Next Phase Readiness
- `SuperGridSelect` is ready to be integrated in Plan 21-03 (SuperGrid wiring)
- `classifyClickZone` export ready for click/Cmd+click handling in Plan 21-03
- `getCellCardIds` callback signature defined — Plan 21-03 provides implementation via `SuperGrid._lastCells`
- Pre-existing test failure in `tests/worker/supergrid.handler.test.ts` (5 tests, `db.prepare`) is out of scope — pre-dates this phase

---
*Phase: 21-superselect*
*Completed: 2026-03-05*

## Self-Check: PASSED

- FOUND: src/views/supergrid/SuperGridSelect.ts
- FOUND: tests/views/supergrid/SuperGridSelect.test.ts
- FOUND: .planning/phases/21-superselect/21-02-SUMMARY.md
- FOUND: commit 8aa4d86f
