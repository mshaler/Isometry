---
phase: 21-superselect
plan: "01"
subsystem: ui
tags: [supergrid, selection, bounding-box, lasso, typescript, vitest, jsdom, tdd]

# Dependency graph
requires:
  - phase: 20-supersize
    provides: SuperGridSizer column resize pattern; SuperGridPositionLike interface precedent

provides:
  - SuperGridBBoxCache class with attach/detach/scheduleSnapshot/hitTest/getRect API
  - rectsIntersect() pure helper function exported for testability
  - SuperGridSelectionLike narrow interface in types.ts

affects:
  - 21-02 (lasso overlay will use BBoxCache.hitTest for hit-testing)
  - 21-03 (SuperGrid wiring will use SuperGridSelectionLike as its selection contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BBoxCache snapshot-then-read: schedule DOM reads in rAF after render; read from Map during mousemove (O(1), no layout thrash)"
    - "rectsIntersect uses b.x + b.width (not b.right) for jsdom DOMRect compatibility"
    - "Test uses vi.useFakeTimers() + vi.advanceTimersToNextTimer() to flush rAF in jsdom"
    - "vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(...)) for controlled rect injection"

key-files:
  created:
    - src/views/supergrid/SuperGridBBoxCache.ts
    - tests/views/supergrid/SuperGridBBoxCache.test.ts
  modified:
    - src/views/types.ts

key-decisions:
  - "BBoxCache.scheduleSnapshot() uses requestAnimationFrame (not microtask) to defer DOM measurement until after paint — matches render cycle correctly"
  - "rectsIntersect(a, b) signature: a uses {x,y,w,h} (lasso rect), b uses {x,y,width,height} (DOMRect shape) — avoids b.right/.bottom for jsdom safety"
  - "scheduleSnapshot() clears the entire cache then re-populates — implicit invalidation; no partial-update complexity"
  - "SuperGridSelectionLike follows the exact narrow-interface pattern established by SuperGridBridgeLike/ProviderLike/PositionLike in types.ts"

patterns-established:
  - "Snapshot-then-read: defer all DOM measurement to rAF, then read from Map cache during high-frequency events"
  - "jsdom DOMRect mock: vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, w, h)) + vi.useFakeTimers() + vi.advanceTimersToNextTimer() to flush rAF"

requirements-completed: [SLCT-08]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 21 Plan 01: SuperGridBBoxCache Summary

**Post-render bounding box cache (Map<string, DOMRect>) with hitTest() for O(1) lasso intersection — eliminates O(N*M) layout thrash during mousemove**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T02:09:40Z
- **Completed:** 2026-03-05T02:13:36Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Implemented `SuperGridBBoxCache` with full lifecycle: attach/detach, rAF-deferred snapshots, Map-only hitTest
- Exported `rectsIntersect()` as pure function (no DOM dependency, jsdom DOMRect safe)
- Added `SuperGridSelectionLike` narrow interface to `types.ts` following established pattern
- 24 unit tests covering all behaviors: rectsIntersect (7 cases), lifecycle, scheduleSnapshot, hitTest, getRect

## Task Commits

Each task was committed atomically:

1. **Task 1: SuperGridSelectionLike interface + SuperGridBBoxCache with TDD** - `9237c617` (feat)

## Files Created/Modified
- `src/views/supergrid/SuperGridBBoxCache.ts` - BBoxCache class with attach/detach/scheduleSnapshot/hitTest/getRect + rectsIntersect pure function
- `tests/views/supergrid/SuperGridBBoxCache.test.ts` - 24 unit tests (jsdom environment, vi.useFakeTimers for rAF flushing)
- `src/views/types.ts` - Added SuperGridSelectionLike interface (6-method narrow contract for selection)

## Decisions Made
- `scheduleSnapshot()` uses `requestAnimationFrame` to defer DOM measurement — matches D3 render cycle timing
- `rectsIntersect(a, b)` uses `b.x + b.width` (not `b.right`) for jsdom DOMRect compatibility — DOMRect getters may not be available in all jsdom versions
- Cache cleared entirely on each snapshot (no partial update) — simpler invariant; stale keys removed automatically when cells leave DOM
- `SuperGridSelectionLike` follows exact narrow-interface pattern of `SuperGridBridgeLike`/`SuperGridProviderLike`/`SuperGridPositionLike`

## Deviations from Plan

None — plan executed exactly as written.

The `// @vitest-environment jsdom` directive was required at the top of the test file (same as SuperGridSizer.test.ts) but this is standard project convention for DOM tests, not a deviation.

## Issues Encountered

None.

## Next Phase Readiness
- `SuperGridBBoxCache` is ready to be instantiated in Plan 21-02 (lasso overlay) — attach to grid element, call scheduleSnapshot after _renderCells, wire hitTest to mousemove handler
- `SuperGridSelectionLike` interface ready for Plan 21-03 (SuperGrid wiring) — concrete adapter over SelectionProvider
- 5 pre-existing failures in `tests/worker/supergrid.handler.test.ts` (db.prepare mock issue) are out of scope and unchanged

---
*Phase: 21-superselect*
*Completed: 2026-03-05*
