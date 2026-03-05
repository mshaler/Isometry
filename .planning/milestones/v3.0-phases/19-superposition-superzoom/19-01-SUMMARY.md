---
phase: 19-superposition-superzoom
plan: "01"
subsystem: ui
tags: [supergrid, zoom, css-custom-properties, wheel-event, position-provider, ephemeral-state]

# Dependency graph
requires:
  - phase: 18-superdynamic
    provides: SuperGrid DnD axis swap foundation that SuperZoom attaches wheel listeners to
provides:
  - SuperPositionProvider: Tier 3 ephemeral scroll/zoom cache with save/restore/reset API
  - SuperZoom: WheelEvent zoom handler with CSS Custom Property updates on gridEl
  - buildGridTemplateColumns: updated to fixed CSS var columns (var(--sg-col-width, 120px))
  - ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT constants for shared use
affects:
  - 19-02 (Plan 02 wires SuperPositionProvider and SuperZoom into SuperGrid as 5th DI dependency)
  - 20+ (all SuperGrid plans consume the zoom/position infrastructure built here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tier 3 ephemeral provider: plain class with no subscribe/notify, NOT registered with StateCoordinator"
    - "CSS Custom Property zoom: --sg-col-width, --sg-row-height, --sg-zoom updated via setProperty() on gridEl"
    - "Non-passive WheelEvent listener: { passive: false } required for ctrlKey pinch preventDefault"
    - "Asymmetric zoom formula: zoom-in 1-(SPEEDUP*dy)/100, zoom-out 1/(1+(SPEEDUP*dy)/100)"
    - "Defensive copies: getCoordinates() returns [...array] copies to prevent external mutation"

key-files:
  created:
    - src/providers/SuperPositionProvider.ts
    - src/views/supergrid/SuperZoom.ts
    - tests/providers/SuperPositionProvider.test.ts
    - tests/views/supergrid/SuperZoom.test.ts
  modified:
    - src/views/supergrid/SuperStackHeader.ts (buildGridTemplateColumns: minmax -> CSS var)
    - tests/views/SuperStackHeader.test.ts (updated 4 tests + added 1 for new column format)

key-decisions:
  - "SuperPositionProvider has NO subscribe/notify methods and MUST NOT register with StateCoordinator — would trigger 60fps worker calls during scroll"
  - "reset() preserves zoomLevel — zoom is a view preference that outlives individual grid sessions (filter changes, axis reorders)"
  - "buildGridTemplateColumns uses var(--sg-col-width, 120px) not minmax(60px, 1fr) — fixed-width columns required for zoom scaling; flexible columns expand to fill viewport instead"
  - "leafCount=0 in buildGridTemplateColumns returns '${rowHeaderWidth}px' only (no repeat clause) to avoid syntactically valid but semantically empty repeat(0, ...)"
  - "Non-passive wheel listener required: ctrlKey pinch events need preventDefault() which passive listeners cannot call"
  - "WHEEL_SCALE_SPEEDUP=2.0 chosen for natural zoom feel; asymmetric formula keeps zoom-in/zoom-out as approximate inverses"
  - "CSS spy test fix: addEventListener spy must be set on the target element BEFORE attach() is called"

patterns-established:
  - "Tier 3 Ephemeral Provider: plain class, no StateCoordinator, no subscribe, in-memory only"
  - "CSS Custom Property Zoom: single --sg-zoom drives font/padding scaling via calc(); --sg-col-width and --sg-row-height set explicitly in pixels"
  - "WheelEvent normalization: deltaMode-aware cap at +-24 prevents zoom jumps from high-resolution trackpads"

requirements-completed: [POSN-01, POSN-02, ZOOM-01, ZOOM-03]

# Metrics
duration: 4min
completed: "2026-03-04"
---

# Phase 19 Plan 01: SuperPosition + SuperZoom Infrastructure Summary

**SuperPositionProvider (Tier 3 ephemeral scroll/zoom cache) and SuperZoom (WheelEvent handler with CSS Custom Property scaling) with buildGridTemplateColumns updated from flexible 1fr to fixed var(--sg-col-width, 120px) columns**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T19:55:31Z
- **Completed:** 2026-03-04T20:00:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- SuperPositionProvider class with scrollTop/scrollLeft/zoomLevel Tier 3 ephemeral state, clamped zoom [0.5, 3.0], defensive copy getCoordinates(), reset() preserves zoom, no StateCoordinator integration (38 tests)
- SuperZoom class with non-passive WheelEvent interception, ctrlKey pinch detection, CSS Custom Property updates (--sg-col-width, --sg-row-height, --sg-zoom), Cmd+0 reset, detach cleanup (37 tests)
- buildGridTemplateColumns updated from `minmax(60px, 1fr)` to `var(--sg-col-width, 120px)` — required architectural change for zoom to scale data columns linearly
- Full test suite: 1,377 tests passing, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SuperPositionProvider** - `5b0c84e2` (feat)
2. **Task 2: Create SuperZoom + update buildGridTemplateColumns** - `69a6c020` (feat)

## Files Created/Modified

- `src/providers/SuperPositionProvider.ts` - Tier 3 ephemeral scroll/zoom state cache with ZOOM_MIN/MAX/DEFAULT constants
- `src/views/supergrid/SuperZoom.ts` - WheelEvent zoom handler with CSS Custom Property updates and Cmd+0 keyboard shortcut
- `src/views/supergrid/SuperStackHeader.ts` - buildGridTemplateColumns updated to fixed CSS var columns for zoom compatibility
- `tests/providers/SuperPositionProvider.test.ts` - 38 unit tests for all SuperPositionProvider behavior
- `tests/views/supergrid/SuperZoom.test.ts` - 37 unit tests for pure functions and DOM interaction (jsdom environment)
- `tests/views/SuperStackHeader.test.ts` - 4 tests updated + 1 new test for var(--sg-col-width) column format

## Decisions Made

- SuperPositionProvider is a plain class with no subscribe/notify — NOT a StateProvider. Registering with StateCoordinator would trigger 60fps worker calls during scroll/zoom.
- reset() preserves zoomLevel because zoom is a view preference (like font size) that outlives individual grid sessions — filter changes and axis reorders should not reset the user's zoom level.
- buildGridTemplateColumns for leafCount=0 returns `${rowHeaderWidth}px` (no repeat) rather than `${rowHeaderWidth}px repeat(0, var(...))` — both valid CSS but the former is cleaner.
- WHEEL_SCALE_SPEEDUP=2.0 with asymmetric formula (inverse formula for zoom-out) gives natural pinch feel where zoom-in and zoom-out are approximate inverses of each other.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test spy ordering for addEventListener verification**
- **Found during:** Task 2 (SuperZoom test execution)
- **Issue:** Test spy was placed on `rootEl` (from beforeEach) but test created a new `newRoot` element and called `attach(newRoot, newGrid)`. Spy on wrong element — 0 calls detected.
- **Fix:** Moved spy to be placed on `newRoot` before calling `attach(newRoot, newGrid)`
- **Files modified:** tests/views/supergrid/SuperZoom.test.ts
- **Verification:** Test passed after fix
- **Committed in:** 69a6c020 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test ordering bug)
**Impact on plan:** Minor test fix. No scope creep. All planned behavior tested correctly.

## Issues Encountered

- Import path in SuperZoom.ts was `../providers/SuperPositionProvider` but file is at `src/views/supergrid/SuperZoom.ts` — needed `../../providers/SuperPositionProvider`. Fixed during implementation before first test run.

## Next Phase Readiness

- SuperPositionProvider and SuperZoom modules ready for Plan 02 integration into SuperGrid as 5th constructor dependency
- buildGridTemplateColumns is already compatible with CSS Custom Property zoom scaling
- Plan 02 should: instantiate SuperPositionProvider in SuperGrid constructor, create SuperZoom in mount(), call applyZoom() after initial render, wire scroll listener for savePosition()

---
*Phase: 19-superposition-superzoom*
*Completed: 2026-03-04*
