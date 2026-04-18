---
phase: 161-explorer-layout-constraints
plan: 01
subsystem: ui
tags: [css, layout, workbench, explorers]

# Dependency graph
requires:
  - phase: 152-explorer-inline-embedding
    provides: workbench-slot-top and workbench-slot-bottom containers with overflow-y: auto
provides:
  - max-height: 50vh constraint on .workbench-slot-top preventing viewport starvation
  - max-height: 30vh constraint on .workbench-slot-bottom preventing viewport starvation
affects: [162-explorer-panel-polish, any phase adding explorers to top/bottom slots]

# Tech tracking
tech-stack:
  added: []
  patterns: [CSS viewport-relative max-height for slot height budgets]

key-files:
  created: []
  modified:
    - src/styles/workbench.css

key-decisions:
  - "50vh cap for top slot (Data/Properties/Projection explorers) leaves at least 50% viewport for view content"
  - "30vh cap for bottom slot (LATCH Filters/Formulas) is narrower since filter controls are compact"
  - "No overflow-y change needed — both slots already had overflow-y: auto"

patterns-established:
  - "Slot height budget pattern: max-height + overflow-y: auto on slot containers bounds explorer growth"

requirements-completed: [LAYT-01, LAYT-02]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 161 Plan 01: Explorer Layout Constraints Summary

**CSS viewport caps (50vh top, 30vh bottom) prevent explorer panels from starving the view content area when multiple explorers are open simultaneously**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T19:12:00Z
- **Completed:** 2026-04-17T19:12:53Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `max-height: 50vh` to `.workbench-slot-top` — caps Data Explorer, Properties Explorer, and Projection Explorer combined height
- Added `max-height: 30vh` to `.workbench-slot-bottom` — caps LATCH Filters and Formulas Explorer combined height
- Both slots already had `overflow-y: auto`; the max-height activates internal scroll automatically when explorers exceed the cap

## Task Commits

Each task was committed atomically:

1. **Task 1: Add max-height constraints to workbench slots** - `208e8a6` (feat)

## Files Created/Modified
- `src/styles/workbench.css` - Added max-height: 50vh to .workbench-slot-top and max-height: 30vh to .workbench-slot-bottom

## Decisions Made
- 50vh for top slot — balanced split; with three explorers open, this ensures at least half the viewport remains for the view
- 30vh for bottom slot — filter/formula controls are typically compact; 30vh is sufficient without wasting view space
- No overflow-y changes needed — both slots already had `overflow-y: auto` from Phase 152 inline embedding work

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LAYT-01 and LAYT-02 satisfied — slot height constraints are in place
- Plan 02 (dismiss bar + forward declaration consolidation) can proceed

---
*Phase: 161-explorer-layout-constraints*
*Completed: 2026-04-17*
