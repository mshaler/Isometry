---
phase: 164-projection-rendering
plan: 01
subsystem: ui
tags: [superwidget, canvas, projection, typescript, vitest]

# Dependency graph
requires:
  - phase: 163-projection-state-machine
    provides: "Projection type, validateProjection, transition functions"
  - phase: 162-substrate-layout
    provides: "SuperWidget class skeleton with mount/destroy lifecycle, four slots"
provides:
  - "CanvasComponent interface in projection.ts (mount/destroy plug-in contract)"
  - "CanvasFactory type exported from SuperWidget.ts"
  - "SuperWidget constructor requires canvasFactory parameter"
  - "data-render-count='0' initialized on all four slots at construction"
  - "_currentCanvas and _currentProjection private fields on SuperWidget (Plan 02 prereqs)"
  - "Updated Phase 162 tests with stubFactory passing all 32 tests"
affects: [164-02, 165-canvas-stubs-registry, 166-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constructor injection for canvas factory dependency (avoids import coupling to concrete implementations)"
    - "data-render-count data attribute pattern for slot-scoped render tracking"
    - "CanvasComponent interface as plug-in seam (SuperWidget.ts imports only the interface, never concrete classes)"

key-files:
  created: []
  modified:
    - "src/superwidget/projection.ts"
    - "src/superwidget/SuperWidget.ts"
    - "tests/superwidget/SuperWidget.test.ts"

key-decisions:
  - "CanvasComponent interface placed in projection.ts (co-located with Projection type it works alongside)"
  - "CanvasFactory exported from SuperWidget.ts as public type alias for test stub authoring"
  - "destroy() calls _currentCanvas.destroy() before nulling — prevents canvas leak on widget teardown"

patterns-established:
  - "CanvasFactory type: (canvasId: string) => CanvasComponent | undefined — undefined means no canvas registered"
  - "All four slots get data-render-count='0' in constructor; Plan 02 commitProjection will increment per slot"
  - "stubFactory pattern in tests: const stubFactory: CanvasFactory = () => ({ mount: () => {}, destroy: () => {} })"

requirements-completed: [RNDR-01]

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 164 Plan 01: CanvasComponent Interface + Factory Injection Summary

**CanvasComponent interface added to projection.ts and SuperWidget constructor now requires a canvasFactory, with data-render-count initialized on all four slots and 32 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-21T13:43:00Z
- **Completed:** 2026-04-21T13:44:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `CanvasComponent` interface to `projection.ts` — the plug-in contract that canvas implementations must satisfy
- Changed `SuperWidget` constructor from zero-arg to `constructor(canvasFactory: CanvasFactory)` with private field storage
- Added `_currentCanvas: CanvasComponent | null` and `_currentProjection: Projection | null` private fields for Plan 02
- Initialized `data-render-count='0'` on all four slots (header, canvas, status, tabs) in the constructor
- Updated `destroy()` to call `_currentCanvas.destroy()` and null both canvas/projection references
- Updated all 4 `new SuperWidget()` calls in tests to `new SuperWidget(stubFactory)` and added render-count assertion test

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: CanvasComponent interface, factory injection, and test updates** - `e45e507e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/superwidget/projection.ts` - Added `CanvasComponent` interface after `ValidationResult` type
- `src/superwidget/SuperWidget.ts` - Added `CanvasFactory` export, updated constructor, added private fields, updated destroy()
- `tests/superwidget/SuperWidget.test.ts` - Added stubFactory, updated all 4 constructor calls, added render-count test

## Decisions Made
- Placed `CanvasComponent` in `projection.ts` (co-located with `Projection`, both are the canvas-facing contracts)
- Exported `CanvasFactory` as a named type from `SuperWidget.ts` to enable typed stub authoring in tests
- The `destroy()` cleanup calls `_currentCanvas.destroy()` first (canvas teardown before DOM removal)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (`commitProjection` implementation) has all prerequisites satisfied:
  - `CanvasComponent` interface is the canvas mount/destroy contract
  - `_canvasFactory` is stored on the instance
  - `_currentCanvas` and `_currentProjection` are initialized to null, ready for Plan 02 to manage
  - All four slots have `data-render-count='0'` ready for incrementing

---
*Phase: 164-projection-rendering*
*Completed: 2026-04-21*
