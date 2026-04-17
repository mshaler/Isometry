---
phase: 151-paneldrawer-removal-inline-container-scaffolding
plan: "01"
subsystem: ui-layout
tags: [paneldrawer-removal, workbench-shell, layout-refactor, slot-scaffolding]
dependency_graph:
  requires: []
  provides: [workbench-slot-top, workbench-slot-bottom, getPanelRegistry]
  affects: [src/ui/WorkbenchShell.ts, src/main.ts, src/styles/workbench.css]
tech_stack:
  added: []
  patterns: [vertical-flex-stack, slot-scaffolding, inline-embedding-container]
key_files:
  created: []
  modified:
    - src/ui/WorkbenchShell.ts
    - src/styles/workbench.css
    - src/ui/panels/index.ts
    - src/main.ts
    - tests/ui/WorkbenchShell.test.ts
    - tests/seams/ui/workbench-shell.test.ts
  deleted:
    - src/ui/panels/PanelDrawer.ts
    - src/styles/panel-drawer.css
decisions:
  - "top/bottom slot display:none set inline in JS (not CSS), matching prior data-explorer pattern"
  - "PanelDrawer barrel exports removed from panels/index.ts as part of deletion"
  - "main.ts toggle logic replaced with direct panelRegistry.enable/disable (no scrollToPanel)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-16"
  tasks_completed: 2
  files_modified: 8
  files_deleted: 2
---

# Phase 151 Plan 01: PanelDrawer Removal + Inline Container Scaffolding Summary

**One-liner:** Deleted PanelDrawer side drawer system, restructured WorkbenchShell from flex-row (panel-drawer + view-content) to flex-column vertical stack (slot-top + view-content + slot-bottom) to scaffold v11.1 inline explorer embedding.

## What Was Built

### Task 1: Delete PanelDrawer, restructure WorkbenchShell layout, update CSS

- Deleted `src/ui/panels/PanelDrawer.ts` — 596 lines of dead code (icon strip, collapsible drawer, resize handle, drag-to-reorder, keyboard nav, width persistence)
- Deleted `src/styles/panel-drawer.css` — 130 lines of panel drawer styles
- Rewrote `WorkbenchShell.ts`: removed `_panelDrawer` and `_dataExplorerEl` fields; added `_topSlotEl`, `_bottomSlotEl`, `_panelRegistry`; new accessors `getTopSlotEl()`, `getBottomSlotEl()`, `getPanelRegistry()`; removed `getPanelDrawer()` and `getDataExplorerEl()`
- Updated `src/styles/workbench.css`: `.workbench-main__content` changed from `flex-direction: row` to `flex-direction: column`; removed `.workbench-data-explorer` rule; added `.workbench-slot-top` and `.workbench-slot-bottom` rules
- Removed PanelDrawer barrel exports from `src/ui/panels/index.ts`

### Task 2: Update main.ts wiring and clean up tests

- `src/main.ts` line 632: `shell.getDataExplorerEl()` → `shell.getTopSlotEl()`
- `src/main.ts` lines 1025-1029: replaced `drawer.togglePanel()` + `drawer.scrollToPanel()` with direct `panelRegistry.enable()/disable()` toggle
- `src/main.ts` lines 1587-1588: removed `await shell.getPanelDrawer().init()` call
- `tests/ui/WorkbenchShell.test.ts`: removed 4 old PanelDrawer/DataExplorer tests; added 3 new slot/registry accessor tests
- `tests/seams/ui/workbench-shell.test.ts`: updated WBSH-01b (slot assertions), WBSH-01c (panel-drawer/icon-strip absent assertions), WBSH-01d (slot-top instead of data-explorer), WBSH-02b (slot removal on destroy)

## Verification

- TypeScript: clean compile (`npx tsc --noEmit` — 0 errors)
- WorkbenchShell tests: 13/13 passing
- Seam tests: 8/8 passing (both WBSH-01 and WBSH-02 suites)
- Full test suite: 8,679 passing; 0 failures in main project files (failures only in parallel agent worktree directories)
- PanelDrawer reference scan: only intentional "assert not present" assertions remain in seam tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] panels/index.ts also exported PanelDrawer**

- **Found during:** Task 1 TypeScript compile check
- **Issue:** `src/ui/panels/index.ts` had `export { PanelDrawer }` and `export type { PanelDrawerConfig }` referencing the deleted file
- **Fix:** Removed both PanelDrawer exports from the barrel index
- **Files modified:** `src/ui/panels/index.ts`
- **Commit:** 83c6e406

**2. Task 1 TypeScript compile not fully clean (expected)**

- Task 1's acceptance criteria required clean TypeScript, but main.ts still referenced `getPanelDrawer()` and `getDataExplorerEl()` — these are cleaned in Task 2. The plan's tasks are sequential and interdependent; Task 1 cannot compile clean independently. Both tasks were committed and the final compile result is clean.

## Known Stubs

- `.workbench-slot-top` and `.workbench-slot-bottom` are scaffolded but empty (`display: none`). This is intentional — Phase 152 populates the top slot, Phase 153 populates the bottom slot. The plan goal (clean vertical layout with slot scaffolding) is achieved.

## Self-Check: PASSED

- `src/ui/WorkbenchShell.ts` — exists, contains `getTopSlotEl`, `getBottomSlotEl`, `getPanelRegistry`, no `PanelDrawer` or `getDataExplorerEl`
- `src/ui/panels/PanelDrawer.ts` — deleted (confirmed)
- `src/styles/panel-drawer.css` — deleted (confirmed)
- `src/styles/workbench.css` — contains `flex-direction: column`, `.workbench-slot-top`, `.workbench-slot-bottom`, no `.workbench-data-explorer`
- Commits `83c6e406` and `e7d65e08` — both present in git log
