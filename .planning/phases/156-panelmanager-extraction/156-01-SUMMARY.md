---
phase: 156-panelmanager-extraction
plan: 01
subsystem: ui
tags: [panels, panel-manager, visibility, coupling-groups, tdd]

requires:
  - phase: 135.2
    provides: PanelRegistry lifecycle management class
  - phase: 151
    provides: panels barrel index.ts

provides:
  - PanelManager class with mount-once visibility orchestration
  - SlotConfig and CouplingGroup types in PanelTypes.ts
  - PanelManager exported from src/ui/panels/index.ts barrel
  - 10 unit tests covering all show/hide/toggle/group/syncSlots behaviors

affects: [156-02, main.ts rewire]

tech-stack:
  added: []
  patterns:
    - "Mount-once visibility: panels are enabled+mounted on first show(), never destroyed on hide() — only display style toggled"
    - "Coupling groups: showGroup/hideGroup atomically show/hide named panel sets"
    - "Slot sync callback: PanelManager fires syncSlots after every visibility change for parent slot container updates"

key-files:
  created:
    - src/ui/panels/PanelManager.ts
    - tests/seams/ui/PanelManager.test.ts
  modified:
    - src/ui/panels/PanelTypes.ts
    - src/ui/panels/index.ts

key-decisions:
  - "PanelManager.hide() never calls registry.disable() — panels stay mounted for instant re-show (D-03)"
  - "syncSlots type cast (as () => void) required for vi.fn() compatibility with strict TypeScript"

patterns-established:
  - "Mount-once: _mounted Set tracks first-mount; subsequent shows only toggle display style"
  - "Visibility Set: _visible tracks current display state, separate from registry enabled state"

requirements-completed: [BEHV-01, BEHV-02]

duration: 12min
completed: 2026-04-17
---

# Phase 156 Plan 01: PanelManager Extraction Summary

**PanelManager class with mount-once visibility orchestration, coupling groups, and slot sync callback wrapping PanelRegistry**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-17T16:22:00Z
- **Completed:** 2026-04-17T16:34:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Created PanelManager class wrapping PanelRegistry with show/hide/toggle/showGroup/hideGroup/isVisible/isGroupVisible methods
- Added SlotConfig and CouplingGroup types to PanelTypes.ts
- Updated barrel index.ts to export PanelManager, SlotConfig, CouplingGroup
- 10 passing unit tests covering all 8 behaviors plus edge cases (hide-on-unmounted, isGroupVisible)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define PanelManager types and implement PanelManager class** - `f944276c` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/ui/panels/PanelManager.ts` - PanelManager orchestration class (mount-once, coupling groups, slot sync)
- `src/ui/panels/PanelTypes.ts` - Added SlotConfig and CouplingGroup interface types
- `src/ui/panels/index.ts` - Added PanelManager, SlotConfig, CouplingGroup to barrel exports
- `tests/seams/ui/PanelManager.test.ts` - 10 unit tests covering show/hide/toggle/group/syncSlots behaviors

## Decisions Made
- `PanelManager.hide()` never calls `registry.disable()` — panels stay mounted for instant re-show per D-03. This is a deliberate departure from the existing main.ts pattern where `hideDataExplorer` only toggles display but does not call registry at all.
- Used `as () => void` cast for `vi.fn()` to satisfy TypeScript strict type constraint on `syncSlots` parameter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript strict type error: `vi.fn()` returns `Mock<Procedure | Constructable>` which doesn't match `() => void` in PanelManager constructor. Fixed with `syncSlotsSpy as () => void` cast in test. Zero tsc errors after fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PanelManager class is ready for Phase 156 Plan 02 to rewire main.ts
- SlotConfig + CouplingGroup types available for building real slot registrations from existing child divs
- All 10 tests passing, zero TypeScript errors

---
*Phase: 156-panelmanager-extraction*
*Completed: 2026-04-17*
