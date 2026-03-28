---
phase: 134-guided-tour
plan: 02
subsystem: tour
tags: [driver.js, guided-tour, tour-engine, command-palette, toast, ui-state]

dependency_graph:
  requires:
    - phase: 134-01
      provides: TourEngine class, TOUR_STEPS, tour.css styles, data-tour-target anchors
    - phase: 133
      provides: PresetSuggestionToast pattern for TourPromptToast, CommandRegistry with category union
    - phase: 130
      provides: bridge.send ui:get/ui:set for tour:prompted and tour:completed:v1 persistence
  provides:
    - TourPromptToast class with 8s auto-dismiss and Start Tour/Dismiss buttons
    - TourEngine wired in main.ts with PAFVProvider axis names for dataset-aware copy
    - tour:completed:v1 persistence on tour completion (TOUR-04)
    - "Restart Tour" command in Help category of command palette (TOUR-05)
    - Opt-in tour prompt toast on first-ever import, gated by tour:prompted and tour:completed:v1 (TOUR-06)
    - handleViewSwitch wired to viewManager.onViewSwitch for view-switch survival
  affects: [src/main.ts, src/palette/CommandRegistry.ts]

tech-stack:
  added: []
  patterns:
    - Forward-declared let null pattern for tourEngine/tourPromptToast in main.ts (matching presetManager pattern)
    - ui:get/ui:set dual flag gate (tour:prompted AND tour:completed:v1) before showing one-time toast
    - 1500ms setTimeout on tour prompt ensures import-success toast displays first (following 500ms auto-switch toast pattern)

key-files:
  created:
    - src/tour/TourPromptToast.ts
  modified:
    - src/palette/CommandRegistry.ts
    - src/main.ts

key-decisions:
  - "TourPromptToast button CSS classes use tour-prompt-toast__action--start and tour-prompt-toast__action--dismiss (matching Plan 01 tour.css — not __start/__dismiss as in plan spec)"
  - "Restart Tour registered in Help category (new union member), not Actions — cleaner separation"
  - "tour:prompted flag written BEFORE setTimeout delay so no second prompt fires even if user navigates away during 1.5s window"

patterns-established:
  - "tour:prompted written immediately on show decision (not on toast render) per D-10"

requirements-completed: [TOUR-02, TOUR-04, TOUR-05, TOUR-06]

duration: 8min
completed: 2026-03-28
---

# Phase 134 Plan 02: Tour Wiring Summary

**TourPromptToast + main.ts wiring: PAFVProvider axis substitution, tour:completed:v1 persistence, "Restart Tour" command in new Help category, and first-import opt-in toast gated by dual ui_state flags.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T02:12:00Z
- **Completed:** 2026-03-28T02:20:40Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created TourPromptToast with 8-second auto-dismiss, "New here? Take a quick tour." copy, Start Tour and Dismiss buttons
- Wired TourEngine into main.ts with live PAFVProvider axis names for dataset-aware step 2 copy (TOUR-02)
- Tour completion persists `tour:completed:v1` to ui_state (TOUR-04)
- "Restart Tour" registered in new 'Help' category in CommandRegistry, findable by typing "tour" (TOUR-05)
- First-ever import shows tour prompt toast, gated by both `tour:prompted` AND `tour:completed:v1` absence (TOUR-06)
- `tourEngine.handleViewSwitch()` wired to `viewManager.onViewSwitch` for view-switch survival

## Task Commits

1. **Task 1: Create TourPromptToast and wire tour lifecycle into main.ts** - `fc552a1e` (feat)

## Files Created/Modified

- `src/tour/TourPromptToast.ts` — Opt-in tour prompt toast with Start Tour and Dismiss buttons, 8s auto-dismiss, role="status"
- `src/palette/CommandRegistry.ts` — Extended category union to include 'Help'
- `src/main.ts` — TourEngine instantiation, PAFVProvider getAxisNames wiring, onComplete persistence, tourPromptToast, "Restart Tour" command registration, import hook tour prompt logic, handleViewSwitch wired to onViewSwitch

## Decisions Made

- TourPromptToast button CSS classes match Plan 01's tour.css exactly: `tour-prompt-toast__action--start` and `tour-prompt-toast__action--dismiss`. The plan spec showed `__start`/`__dismiss` but the actual CSS file uses `__action--start`/`__action--dismiss`. Used the CSS file's names.
- "Restart Tour" placed in 'Help' category (new union member in CommandRegistry) rather than 'Actions', following D-12's intent of discoverability without mixing with data operations.
- `tour:prompted` flag written immediately at decision time (before the 1500ms setTimeout), ensuring no second prompt fires during the display delay window (D-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS class names corrected to match Plan 01 tour.css**
- **Found during:** Task 1 (creating TourPromptToast)
- **Issue:** Plan 02 action spec used `tour-prompt-toast__start` and `tour-prompt-toast__dismiss` for button classes, but Plan 01's tour.css (read as required context) defined `tour-prompt-toast__action--start` and `tour-prompt-toast__action--dismiss`
- **Fix:** Used the CSS file's actual class names so buttons receive correct styling without adding new CSS
- **Files modified:** src/tour/TourPromptToast.ts
- **Verification:** TypeScript compiles cleanly; CSS selectors match DOM class names
- **Committed in:** fc552a1e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — CSS class name mismatch)
**Impact on plan:** Essential correction; without it buttons would render unstyled. No scope creep.

## Issues Encountered

None beyond the CSS class name correction above.

## Known Stubs

None — all tour wiring is fully functional. TourEngine receives live axis names, toast shows on first import, completion is persisted, and "Restart Tour" command is registered.

## Next Phase Readiness

Phase 134 (guided-tour) is complete. Both plans executed:
- Plan 01: TourEngine infrastructure (driver.js, 7 steps, CSS, data-tour-target anchors)
- Plan 02: App lifecycle wiring (toast prompt, command palette, axis substitution, persistence)

The guided tour feature is fully functional end-to-end.

## Self-Check: PASSED

- [x] src/tour/TourPromptToast.ts exists
- [x] src/palette/CommandRegistry.ts contains 'Help' category
- [x] src/main.ts contains tour:prompted, tour:completed:v1, action:restart-tour, getAxisNames, handleViewSwitch
- [x] Commit fc552a1e exists

---
*Phase: 134-guided-tour*
*Completed: 2026-03-28*
