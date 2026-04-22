---
phase: 175-shell-replacement
plan: "02"
subsystem: superwidget
tags: [shell-replacement, big-bang-swap, workbench-shell-deleted, css-cleanup, smoke-test]
dependency_graph:
  requires: [superwidget-5-slot-layout, sidebar-slot, command-bar-injection, explorer-passthrough-accessors]
  provides: [superwidget-as-root, workbench-shell-deleted, shell-replacement-complete]
  affects:
    - src/main.ts
    - src/ui/WorkbenchShell.ts (deleted)
    - src/styles/workbench.css
    - src/presets/LayoutPresetManager.ts
    - src/presets/presetCommands.ts
    - tests/superwidget/shellReplacement.test.ts
tech_stack:
  added: []
  patterns: [constructor-parameter-injection, big-bang-swap]
key_files:
  created:
    - tests/superwidget/shellReplacement.test.ts
  modified:
    - src/main.ts
    - src/styles/workbench.css
    - src/presets/LayoutPresetManager.ts
    - src/presets/presetCommands.ts
    - src/ui/PropertiesExplorer.ts
    - src/ui/CalcExplorer.ts
    - src/ui/AlgorithmExplorer.ts
    - src/ui/icons.ts
    - src/ui/ViewTabBar.ts
    - src/presets/builtInPresets.ts
  deleted:
    - src/ui/WorkbenchShell.ts
decisions:
  - "topSlot/bottomSlot placed via prepend/append on superWidget.canvasEl so order is [topSlot, viewContentEl, bottomSlot]"
  - "LayoutPresetManager constructor simplified to (bridge) only — section state params removed (D-04)"
  - "presetCommands.ts forward/inverse mutations now no-ops since section states are gone"
  - "commandBar declared as local const in main.ts — setSubtitle called directly (not via superWidget.getCommandBar())"
metrics:
  duration: 720s
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_modified: 11
---

# Phase 175 Plan 02: Shell Replacement Big-Bang Swap Summary

SuperWidget is now the sole top-level app container. All 17 WorkbenchShell wiring points rewired, WorkbenchShell.ts deleted, workbench.css cleaned of shell layout rules, LayoutPresetManager dead code removed, 7-test smoke suite passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewire main.ts — SuperWidget as #app root, remove WorkbenchShell wiring | 261dc052 | main.ts, LayoutPresetManager.ts, presetCommands.ts |
| 2 | Delete WorkbenchShell, clean CSS, remove dead code, write smoke test | d7d5fa96 | WorkbenchShell.ts (deleted), workbench.css, shellReplacement.test.ts + 7 comment files |

## What Was Built

**main.ts changes:**
- Removed `import { WorkbenchShell } from './ui/WorkbenchShell'`; added `import { CommandBar } from './ui/CommandBar'`
- `CommandBar` created standalone at step 9 (extracted from WorkbenchShellConfig)
- `SuperWidget(getCanvasFactory(), shortcuts, commandBar)` created and `superWidget.mount(container)` mounts on `#app`
- `viewContentEl` (`div.workbench-view-content`) created inside `superWidget.canvasEl`
- `topSlotEl = superWidget.getTopSlotEl()` prepended to canvasEl (before viewContentEl)
- `bottomSlotEl = superWidget.getBottomSlotEl()` appended to canvasEl (after viewContentEl)
- All 8 `shell.getViewContentEl()` calls replaced with `viewContentEl`
- `dockNav.mount(superWidget.sidebarEl)` replaces `dockNav.mount(shell.getSidebarEl())`
- All 3 `shell.getCommandBar().setSubtitle()` calls replaced with `commandBar.setSubtitle()`
- Old SuperWidget creation block at ~line 1641 removed (was `superWidget.mount(dataExplorerChildEl)`)
- `dataExplorerChildEl` div removed (no longer needed — SuperWidget mounts on #app)
- `LayoutPresetManager(bridge)` — constructor simplified (dead section state params removed)
- `createPresetCommands` — `restoreSectionStates` param removed from deps
- `window.__isometry` exposes `superWidget` instead of `shell`

**WorkbenchShell.ts:** Deleted (131 LOC).

**workbench.css changes:**
- Removed: `.workbench-shell`, `.workbench-body`, `.workbench-sidebar*`, `.workbench-main*`, `.workbench-slot-top`, `.workbench-slot-bottom`, `.slot-top__data-explorer`
- Kept: `.workbench-command-bar*`, `.workbench-app-menu*`, `.workbench-settings-*`, `.workbench-theme-*`, `.collapsible-section*`, `.calc-row*`, `.calc-select`, `.view-crossfade`, `.panel-dismiss-bar*`, `.slot-top__properties-explorer`, `.slot-top__projection-explorer`, `.slot-bottom__latch-filters`, `.slot-bottom__formulas-explorer`, `.workbench-view-content`

**LayoutPresetManager.ts:**
- Constructor: `(bridge: Bridge)` — removed `getSectionStates` and `restoreSectionStates` params
- `applyPreset()`: section state restore removed (returns empty prev record)
- `captureCurrentState()`: returns `{}` (section states no longer tracked — D-04)

**presetCommands.ts:**
- `restoreSectionStates` removed from `PresetCommandsDeps` interface
- `forward`/`inverse` mutation callbacks are no-ops (section states gone)

**Comment references updated:** PropertiesExplorer.ts, CalcExplorer.ts, AlgorithmExplorer.ts, icons.ts, ViewTabBar.ts, builtInPresets.ts — all WorkbenchShell mentions replaced with SuperWidget equivalents.

**shellReplacement.test.ts:** 7 smoke tests covering SHEL-01..SHEL-06:
1. WorkbenchShell.ts does not exist
2. workbench.css has no .workbench-shell rule
3. SuperWidget with commandBar produces correct 5-slot DOM
4. sidebarEl is DOM-attached after mount
5. getCommandBar() returns injected CommandBar
6. getTopSlotEl()/getBottomSlotEl() return HTMLElements
7. Ordering guarantee: fully wired synchronously (SHEL-05 / D-08)

## Test Results

- 7/7 tests pass in `tests/superwidget/shellReplacement.test.ts`
- 328/328 tests pass across 17 files in `tests/superwidget/` — zero regressions

## Deviations from Plan

None — plan executed exactly as written. All 17 shell.* call sites rewired per the plan's line number map.

## Known Stubs

None — all wiring is live. The `forward`/`inverse` no-ops in presetCommands.ts are intentional (D-04: section states dropped entirely from LayoutPresetManager).

## Self-Check: PASSED

Files exist:
- src/main.ts — FOUND
- src/styles/workbench.css — FOUND
- tests/superwidget/shellReplacement.test.ts — FOUND

Files deleted:
- src/ui/WorkbenchShell.ts — CONFIRMED DELETED

Commits:
- 261dc052 (Task 1 — main.ts rewire) — FOUND
- d7d5fa96 (Task 2 — WorkbenchShell deleted, smoke test) — FOUND
