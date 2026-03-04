---
phase: 19-superposition-superzoom
plan: 03
subsystem: ui
tags: [supergrid, scroll-position, coordinator, typescript]

# Dependency graph
requires:
  - phase: 19-superposition-superzoom (P02)
    provides: SuperPositionProvider, SuperZoom, sticky headers, restorePosition in mount()
provides:
  - _isInitialMount flag in SuperGrid distinguishing initial render from coordinator re-renders
  - Scroll reset to (0,0) on coordinator-triggered re-renders (filter change, axis transpose)
  - savePosition called after scroll reset so provider state stays consistent
  - 3 new tests verifying scroll reset behavior (Verification Gap 1 + Gap 2 resolved)
affects: [20-supersize, future supergrid phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_isInitialMount boolean flag pattern for distinguishing mount from subsequent coordinator callbacks"
    - "scrollTop/scrollLeft = 0 reset with immediate savePosition() call after coordinator re-render"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "_isInitialMount = false set BEFORE restorePosition() in mount() .then() — ensures subsequent coordinator callbacks will reset scroll while initial mount still calls restorePosition"
  - "Scroll reset runs synchronously after _renderCells() and BEFORE D3 opacity transition — position is set before user sees the new content"
  - "_isInitialMount reset to true in destroy() — defensive guard for hypothetical remount without new construction"

patterns-established:
  - "mount-vs-coordinator distinction: _isInitialMount flag gates scroll reset logic in _fetchAndRender()"

requirements-completed: [POSN-01, POSN-02, POSN-03, ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 19 Plan 03: _isInitialMount Scroll Reset Summary

**Coordinator-triggered SuperGrid re-renders now reset scroll to (0,0) via _isInitialMount flag, resolving Verification Gaps 1 and 2 from Phase 19 Plan 02**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T20:52:05Z
- **Completed:** 2026-03-04T20:54:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `_isInitialMount` private boolean flag to SuperGrid (defaults `true`, set `false` after first render completes in mount())
- Coordinator-triggered `_fetchAndRender()` calls now reset `scrollTop` and `scrollLeft` to 0 and call `positionProvider.savePosition()` to persist the reset position
- Initial mount render does NOT reset scroll — `restorePosition()` still runs after first render to restore saved position
- `_isInitialMount` reset to `true` in `destroy()` as defensive guard
- 3 new TDD tests added to POSN-02 + POSN-03 describe block; all 94 SuperGrid tests and full suite of 1397 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add _isInitialMount flag and scroll reset logic to SuperGrid, with tests** - `fa4aba89` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD task — tests written first (RED), then implementation (GREEN)._

## Files Created/Modified

- `src/views/SuperGrid.ts` — Added `_isInitialMount` flag (line 131), scroll reset block in `_fetchAndRender()` (lines 373-377), `_isInitialMount = false` in `mount()` (line 270), `_isInitialMount = true` in `destroy()` (line 330)
- `tests/views/SuperGrid.test.ts` — Added 3 new test cases at end of POSN-02 + POSN-03 describe block

## Decisions Made

- `_isInitialMount = false` set BEFORE `restorePosition()` in mount() `.then()` — this is the critical ordering: the flag must transition before restorePosition runs so that if a coordinator callback fires during restorePosition, it correctly resets scroll instead of calling restorePosition again
- Scroll reset runs synchronously after `_renderCells()` and before the D3 opacity transition — position is set to (0,0) before the crossfade reveals new content to the user
- `_isInitialMount` reset to `true` in `destroy()` — defensive guard for hypothetical remount without constructing a new instance (forward compatibility)

## Deviations from Plan

None - plan executed exactly as written. TDD cycle ran as specified (RED: 2 failing tests, GREEN: implementation, full suite verified).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 19 is now fully complete: SuperPositionProvider, SuperZoom, sticky headers, scroll position restore, zoom toast, SuperPositionProvider in main.ts, and scroll reset on coordinator re-renders all implemented
- Verification Gaps 1 (filter change resets scroll) and Gap 2 (axis transpose resets scroll visually) are both resolved
- Ready for Phase 20 (SuperSize) planning

## Self-Check: PASSED

- `fa4aba89` exists in git log: confirmed
- `src/views/SuperGrid.ts` contains `_isInitialMount`: confirmed (grep verified)
- `scrollTop.*=.*0` present in SuperGrid.ts: confirmed
- `scrollLeft.*=.*0` present in SuperGrid.ts: confirmed
- `savePosition` called after scroll reset: confirmed
- All 1397 tests pass: confirmed

---
*Phase: 19-superposition-superzoom*
*Completed: 2026-03-04*
