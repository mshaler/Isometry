---
phase: 31-drag-reorder
plan: 02
subsystem: supergrid
tags: [supergrid, dnd, flip, animation, visual-feedback, insertion-line]

# Dependency graph
requires:
  - phase: 31-drag-reorder
    provides: reorderColAxes/reorderRowAxes on PAFVProvider (Plan 01)
provides:
  - Midpoint-based target index calculation during dragover (_calcReorderTargetIndex)
  - Insertion line indicator (2px accent-colored, absolute-positioned) between header cells
  - Source header dimming to opacity 0.3 on dragstart, restore on dragend
  - Drop handler wired to call reorderColAxes/reorderRowAxes for same-dimension drops
  - FLIP animation infrastructure (snapshot before mutation, animate after _renderCells)
  - 14 new TDD tests for visual drag UX and FLIP animation
affects: [32-polish (final SuperStack phase)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Web Animations API (element.animate) for FLIP position transitions — 200ms ease-out"
    - "Module-level fireSameDimDrop helper for reuse across DnD test blocks"
    - "_lastReorderTargetIndex as production fallback when dataset['reorderTargetIndex'] not set"
    - "FLIP snapshot consumed once (null after playback) — prevents stale animations"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Same-dimension drop calls reorderColAxes/reorderRowAxes instead of setColAxes/setRowAxes to preserve collapse state, colWidths, and sortOverrides"
  - "FLIP captures snapshot synchronously before provider mutation; plays after _renderCells DOM rebuild"
  - "Insertion line uses dedicated DOM element (not pseudo-element) for programmatic positioning"
  - "FLIP animation uses Web Animations API (WAAPI) — 200ms ease-out — not D3 transitions"

patterns-established:
  - "dragend cleanup pattern: restore opacity + remove insertion line + reset _lastReorderTargetIndex"
  - "FLIP snapshot stored as instance variable, consumed once per drop event"

requirements-completed: [DRAG-REORDER-VISUAL]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 31 Plan 02: Visual Drag UX Summary

**Midpoint-based insertion line, source dimming, reorder method dispatch, and FLIP animation for headers + data cells on SuperGrid axis drag reorder**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T20:33:57Z
- **Completed:** 2026-03-06T20:42:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wired visual drag feedback: insertion line between headers during dragover, source header dims to 0.3 opacity
- Updated drop handler to call reorderColAxes/reorderRowAxes for same-dimension reorder (preserving collapse state, colWidths, sortOverrides)
- Implemented FLIP animation infrastructure: snapshot before mutation, animate after _renderCells (200ms ease-out via WAAPI)
- Updated existing DYNM-03 tests to verify reorderColAxes/reorderRowAxes dispatch instead of setColAxes/setRowAxes
- Added 14 new tests: 8 for visual DnD UX + 6 for FLIP animation (total 344 SuperGrid tests, 501 combined)

## Task Commits

Each task was committed atomically:

1. **Task 1: Midpoint calculation + insertion line + source dimming + drop handler wiring** - `bf54dcd2` (feat)
2. **Task 2: FLIP animation for headers and data cells after reorder/transpose** - `547cdd55` (test)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Added _calcReorderTargetIndex, _showInsertionLine, _removeInsertionLine, _getElementFlipKey, _captureFlipSnapshot, _playFlipAnimation; updated grip dragstart/dragend handlers; rewired _wireDropZone for reorder dispatch + FLIP; added _playFlipAnimation call at end of _renderCells; added cleanup in destroy()
- `tests/views/SuperGrid.test.ts` - Updated 3 DYNM-03 tests for reorderColAxes/reorderRowAxes assertions; added 8 Phase 31-02 visual DnD tests; added 6 FLIP animation tests; moved fireSameDimDrop to module scope

## Decisions Made
- Same-dimension drop calls reorderColAxes/reorderRowAxes (Plan 01's non-destructive methods) instead of setColAxes/setRowAxes — preserves collapse state, colWidths, and sortOverrides per CONTEXT.md requirement
- FLIP animation uses Web Animations API (WAAPI) rather than D3 transitions — SuperGrid uses DOM elements with CSS Grid, not SVG selections
- Insertion line implemented as dedicated 2px absolute-positioned DOM element with `var(--accent, #4a9eff)` background
- FLIP snapshot captured synchronously in drop handler before provider mutation, consumed once by _playFlipAnimation at end of _renderCells

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 31 (drag reorder) is fully complete: backend reorder logic (Plan 01) + visual drag UX (Plan 02)
- Phase 32 (polish) can proceed — all SuperGrid visual DnD feedback operational
- 344 SuperGrid tests passing, 157 PAFVProvider tests passing (501 combined)
- Pre-existing SuperGridSizer test failures (4 tests) unrelated to Phase 31 changes

## Self-Check: PASSED

- Both modified files exist on disk
- Commits bf54dcd2 and 547cdd55 verified in git log
- _calcReorderTargetIndex, _showInsertionLine, _removeInsertionLine, _captureFlipSnapshot, _playFlipAnimation confirmed in SuperGrid.ts
- 344 SuperGrid tests pass, 157 PAFVProvider tests pass

---
*Phase: 31-drag-reorder*
*Completed: 2026-03-06*
