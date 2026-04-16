---
phase: 149-explorer-decoupling-panel-stubs
plan: 01
subsystem: ui/shell
tags: [panel-drawer, dock-nav, explorer-decoupling, layout]
dependency_graph:
  requires: []
  provides: [visible-panel-drawer, dock-panel-toggle-routing]
  affects: [WorkbenchShell, DockNav, PanelDrawer, main.ts onActivateItem]
tech_stack:
  added: []
  patterns: [dock-to-panel-map composite key routing, public togglePanel/scrollToPanel API]
key_files:
  created: []
  modified:
    - src/ui/WorkbenchShell.ts
    - src/styles/workbench.css
    - src/ui/panels/PanelDrawer.ts
    - src/main.ts
decisions:
  - PanelDrawer icon strip hidden via inline display:none (stays in DOM for future flexibility)
  - CollapsibleSection.getElement() used for scrollToPanel (no getHeaderEl exists)
  - integrate block restructured to let properties/projection fall through to panel toggle branch
metrics:
  duration_seconds: 240
  completed: "2026-04-16T15:21:59Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 149 Plan 01: Explorer Decoupling — PanelDrawer Relocation and DockNav Wiring Summary

PanelDrawer relocated from hidden tray into `.workbench-main` as a visible VS Code-style side drawer, with DockNav item clicks wired to toggle explorer panels via PanelRegistry.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Relocate PanelDrawer into .workbench-main as visible side drawer | 2dee4127 | WorkbenchShell.ts, workbench.css, PanelDrawer.ts |
| 2 | Wire onActivateItem to toggle explorer panels via PanelRegistry | fba47335 | main.ts |

## What Was Built

**Task 1 — PanelDrawer relocation:**
- Removed hidden `.workbench-panel-tray` div from WorkbenchShell.ts
- Added `.workbench-main__content` flex-row wrapper inside `.workbench-main`; PanelDrawer mounts there, followed by `.workbench-view-content`
- Replaced `.workbench-panel-tray { display: none }` CSS rule with `.workbench-main__content` flex-row rule
- Hidden PanelDrawer icon strip via `strip.style.display = 'none'` (DockNav is sole activation surface)
- Added public `togglePanel(panelId)` and `scrollToPanel(panelId)` methods to PanelDrawer

**Task 2 — DockNav wiring:**
- Added `dockToPanelMap` mapping composite keys (`integrate:properties`, `integrate:projection`, `analyze:filter`, `activate:notebook`) to PanelRegistry panel IDs
- Added panel toggle branch in `onActivateItem` after visualize handling
- Restructured `integrate` block: `catalog` returns early, explorer items fall through to panel toggle branch
- `integrate:catalog` (DataExplorer) and `visualize:*` (view switch) behaviors unchanged

## Verification

- `npx tsc --noEmit`: zero errors
- `npx vitest run`: 8680 unit tests pass (40 pre-existing E2E/bench failures unrelated to this plan)

## Deviations from Plan

**1. [Rule 1 - Bug] integrate block early return restructured**
- **Found during:** Task 2
- **Issue:** Original `integrate` block had a single `return` at the end covering all itemKeys. This prevented `integrate:properties` and `integrate:projection` from reaching the panel toggle branch.
- **Fix:** Added `return` after `catalog` case only; other integrate items fall through to the panel toggle logic
- **Files modified:** src/main.ts
- **Commit:** fba47335

**2. [Rule 1 - Bug] scrollToPanel uses getElement() not getRootEl()**
- **Found during:** Task 1
- **Issue:** Plan referenced `entry.section.getRootEl?.()` but CollapsibleSection exposes `getElement()` not `getRootEl()`
- **Fix:** Used `entry.section.getElement()` (non-optional since it always exists post-mount)
- **Files modified:** src/ui/panels/PanelDrawer.ts
- **Commit:** 2dee4127

## Known Stubs

None — all wiring is functional. Explorer content renders via existing PanelRegistry/PanelHook factories.

## Self-Check: PASSED
