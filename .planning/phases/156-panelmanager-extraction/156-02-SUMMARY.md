---
phase: 156-panelmanager-extraction
plan: 02
subsystem: ui
tags: [panels, panel-manager, main-ts, extraction, surgical]

requires:
  - phase: 156-01
    provides: PanelManager class with show/hide/toggle/showGroup/hideGroup/isVisible/isGroupVisible

provides:
  - main.ts rewired to use PanelManager for all explorer panel orchestration
  - DataExplorer registered with PanelRegistry as 'data-explorer' panel
  - Dock onActivateItem is a thin routing layer delegating to PanelManager

affects: [main.ts, 156-03]

tech-stack:
  added: []
  patterns:
    - "Delegate panel orchestration: dock callback calls panelManager.show/hide/toggle/showGroup/hideGroup"
    - "PanelRegistry factory: DataExplorer construction moved into panelRegistry.register() factory closure"
    - "Mount-once via PanelManager: panels stay mounted after first show(), re-show only toggles display"

key-files:
  created: []
  modified:
    - src/main.ts

key-decisions:
  - "DataExplorer registered with PanelRegistry so PanelManager can manage its lifecycle (defaultEnabled: false)"
  - "integrate coupling group pairs data-explorer + properties for atomic show/hide (per D-02)"
  - "panelManager declared as let and assigned after all panelRegistry.register() calls to ensure data-explorer factory closure captures correct scope variables"

patterns-established:
  - "Dock callback is a pure router: no show/hide logic, only PanelManager delegation and view switching"

requirements-completed: [BEHV-03]

duration: 3min
completed: 2026-04-17
---

# Phase 156 Plan 02: main.ts Rewire Summary

**Surgical extraction of ~320 LOC from main.ts — 10 hand-rolled show/hide functions and 8 tracking booleans replaced with PanelManager delegation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T22:27:48Z
- **Completed:** 2026-04-17T22:30:36Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed 10 hand-rolled show/hide functions: showDataExplorer, hideDataExplorer, showPropertiesExplorer, hidePropertiesExplorer, showProjectionExplorer, hideProjectionExplorer, showLatchFilters, hideLatchFilters, showFormulasExplorer, hideFormulasExplorer
- Removed 8 tracking booleans: dataExplorerMounted, propertiesExplorerMounted, projectionExplorerMounted, latchFiltersMounted, latchFiltersVisible, formulasMounted, formulasVisible, dataExplorerVisible
- Registered DataExplorer as 'data-explorer' with PanelRegistry (factory contains all former showDataExplorer mount logic)
- Instantiated PanelManager with 5 slot configs (data-explorer/properties/projection in top slot, latch/formulas in bottom slot) and integrate coupling group
- Dock onActivateItem callback rewritten as thin router: integrate group toggling, visualize view-switching, analyze filter/formula toggles — all delegating to panelManager

## Task Commits

1. **Task 1: Replace hand-rolled show/hide functions with PanelManager in main.ts** - `85a27ab8` (feat)

## Files Created/Modified

- `src/main.ts` - 320 lines removed, 215 lines added (net -105 LOC). PanelManager import, DataExplorer PanelRegistry registration, PanelManager instantiation, rewired dock callback.

## Decisions Made

- DataExplorer registered with PanelRegistry with `defaultEnabled: false` — PanelManager.show() will enable+mount on first activation.
- `panelManager` declared as `let panelManager!: PanelManager` near slot containers (before the dock callback) and assigned after all `panelRegistry.register()` calls. This ensures the dock callback closure captures the `panelManager` variable (by reference) and the assignment happens before any user interaction triggers the callback.
- `SlotConfig` and `CouplingGroup` type imports removed — TypeScript infers them from constructor parameter shapes, avoiding unused import errors.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

---
*Phase: 156-panelmanager-extraction*
*Completed: 2026-04-17*
