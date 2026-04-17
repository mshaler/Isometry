---
phase: 152-integrate-visualize-inline-embedding
plan: "01"
subsystem: ui
tags: [docknav, explorer, inline-embedding, top-slot, supergrid]

# Dependency graph
requires:
  - phase: 151-paneldrawer-removal-inline-container-scaffolding
    provides: top-slot and bottom-slot container scaffolding in WorkbenchShell

provides:
  - Data Explorer + Properties Explorer stacked in .workbench-slot-top on integrate:catalog dock click
  - Projections Explorer auto-shown in .workbench-slot-top when SuperGrid is active
  - syncTopSlotVisibility() helper that collapses parent when all children hidden
  - DockNav.setItemPressed() for aria-pressed toggle state on non-navigation items

affects: [153-bottom-slot-embedding, future-dock-items, projections-explorer, properties-explorer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Child div pattern — one div per explorer inside .workbench-slot-top; each managed independently
    - syncTopSlotVisibility — collapse parent when all children hidden (inspects display style)
    - Lazy mount with mounted flag — explorer instantiated on first show, reused on subsequent shows
    - setItemPressed — separate from _setActive; toggles aria-pressed for non-navigation dock items

key-files:
  created: []
  modified:
    - src/main.ts
    - src/styles/workbench.css
    - src/ui/DockNav.ts

key-decisions:
  - "setItemPressed is separate from _setActive — navigation items use aria-selected, toggle items use aria-pressed"
  - "Projections auto-visibility is triggered directly in the visualize branch, not via a dock item"
  - "Properties Explorer PanelRegistry registration left in place (inert) — direct instantiation in showPropertiesExplorer() takes precedence"
  - "syncTopSlotVisibility inspects style.display on all three child divs (no extra state variable)"

patterns-established:
  - "showXxxExplorer/hideXxxExplorer pattern: show/hide child div, lazy-mount on first show, always call syncTopSlotVisibility"
  - "projectionExplorerMounted / propertiesExplorerMounted flags prevent double-instantiation"

requirements-completed: [INTG-01, INTG-02]

# Metrics
duration: 15min
completed: 2026-04-17
---

# Phase 152 Plan 01: Integrate + Visualize Inline Embedding Summary

**Data Explorer + Properties Explorer stacked in top slot on dock click, Projections Explorer auto-shown for SuperGrid view, with parent slot collapse via syncTopSlotVisibility**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T02:32:00Z
- **Completed:** 2026-04-17T02:47:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migrated DataExplorer from mounting into `.workbench-slot-top` parent to its own child div `slot-top__data-explorer`
- Added `showPropertiesExplorer`/`hidePropertiesExplorer` with lazy mount into `slot-top__properties-explorer`
- Both Data + Properties Explorers toggle together on `integrate:catalog` dock click
- Added `syncTopSlotVisibility()` — parent `.workbench-slot-top` collapses to `display:none` when all children hidden
- Added `DockNav.setItemPressed()` public method for `aria-pressed` toggle state
- Added `showProjectionExplorer`/`hideProjectionExplorer` — Projections auto-shown for SuperGrid, auto-hidden otherwise
- TypeScript compiles with 0 errors; 8681 unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Child divs, DataExplorer migration, syncTopSlotVisibility, Properties toggle, DockNav setItemPressed** - `9dc48283` (feat)
2. **Task 2: Wire Projections Explorer auto-visibility on view switch** - `df911c48` (feat)

## Files Created/Modified
- `src/main.ts` - Child div creation, syncTopSlotVisibility, showPropertiesExplorer/hidePropertiesExplorer, showProjectionExplorer/hideProjectionExplorer, updated integrate:catalog toggle, updated visualize branch
- `src/styles/workbench.css` - CSS rules for `.slot-top__data-explorer`, `.slot-top__properties-explorer`, `.slot-top__projection-explorer`
- `src/ui/DockNav.ts` - Added `setItemPressed(compositeKey, pressed)` public method

## Decisions Made
- `setItemPressed` is a separate public method from `_setActive` — navigation items use `aria-selected` (for keyboard/screen reader tab semantics), toggle items like `integrate:catalog` use `aria-pressed` (toggle button semantics). Per D-02 in UI-SPEC.
- Projections auto-visibility triggered in the `sectionKey === 'visualize'` branch, not via a dock item. Per D-03 — no manual toggle for Projections.
- Properties Explorer PanelRegistry registration left in place (Option A) — it is now inert but safe. Direct instantiation in `showPropertiesExplorer()` takes the real path.
- `syncTopSlotVisibility` inspects `style.display` directly on all three child divs rather than maintaining a separate counter — simpler and always correct.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly on first pass with no unexpected type errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- INTG-01, INTG-02 delivered: Data + Properties Explorer toggle wired and working
- VIZ-01, VIZ-02, VIZ-03 delivered: Projections auto-visibility for SuperGrid wired
- Phase 153 (bottom-slot embedding for LATCH Filters + Formulas) can proceed — bottom slot infrastructure is in place from Phase 151

---
*Phase: 152-integrate-visualize-inline-embedding*
*Completed: 2026-04-17*
