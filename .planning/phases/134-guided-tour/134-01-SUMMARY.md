---
phase: 134
plan: 01
subsystem: tour
tags: [driver.js, guided-tour, tour-engine, css, data-attributes]
dependency_graph:
  requires: []
  provides: [TourEngine, TOUR_STEPS, tour.css, data-tour-target selectors]
  affects: [src/ui/SidebarNav.ts, src/ui/WorkbenchShell.ts, src/ui/CommandBar.ts, src/views/pivot/PivotTable.ts, src/views/pivot/plugins/SuperDensityModeSwitch.ts]
tech_stack:
  added: [driver.js]
  patterns: [data-tour-target selector anchoring, requestAnimationFrame view-switch recovery, CSS design token overrides]
key_files:
  created:
    - src/tour/TourEngine.ts
    - src/tour/tourSteps.ts
    - src/styles/tour.css
  modified:
    - package.json
    - src/ui/SidebarNav.ts
    - src/ui/WorkbenchShell.ts
    - src/ui/CommandBar.ts
    - src/views/pivot/PivotTable.ts
    - src/views/pivot/plugins/SuperDensityModeSwitch.ts
decisions:
  - driver.js Driver.refresh() used for spotlight reposition on view-switch hit; moveTo(i) advances to next valid step when target missing
  - showButtons cast to Array<'next'|'previous'|'close'> to satisfy driver.js mutable array type constraint
  - data-tour-target on pv-root (PivotTable), pv-density-toolbar (SuperDensityModeSwitch), nav (SidebarNav), CollapsibleSection root elements (WorkbenchShell), app-icon button (CommandBar) — all surgical setAttribute additions
metrics:
  duration_seconds: 738
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 6
---

# Phase 134 Plan 01: TourEngine Infrastructure Summary

**One-liner:** driver.js guided tour with 7 steps, axis-name template substitution, view-switch recovery via requestAnimationFrame, and data-tour-target anchors on 6 existing DOM elements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install driver.js, create TourEngine + step definitions + CSS | 50259620 | package.json, src/tour/TourEngine.ts, src/tour/tourSteps.ts, src/styles/tour.css |
| 2 | Add data-tour-target attributes to 6 existing DOM elements | c24474ac | SidebarNav.ts, WorkbenchShell.ts, CommandBar.ts, PivotTable.ts, SuperDensityModeSwitch.ts |

## What Was Built

### TourEngine (`src/tour/TourEngine.ts`)

A class wrapping driver.js with:
- `start()`: builds DriveStep array from TOUR_STEPS, resolves `{rowAxis}`/`{columnAxis}` placeholders via `getAxisNames()` config callback, filters missing DOM targets (D-07), drives from step 0
- `destroy()`: tears down active driver instance
- `isActive()`: delegates to driver.js
- `handleViewSwitch()`: waits one rAF after view switch, re-queries active step's target, calls `refresh()` if found or `moveTo(nextValidIndex)` if not — destroys if no valid steps remain
- `onComplete` setter: stored callback fired in driver.js `onDestroyed` hook

### TOUR_STEPS (`src/tour/tourSteps.ts`)

7 steps in order: sidebar-nav, supergrid (PAFV explanation with axis templates), supergrid-density, latch-explorers, notebook-explorer, command-palette-trigger, supergrid (completion).

### tour.css (`src/styles/tour.css`)

Full driver.js popover override using design tokens (`--bg-surface`, `--accent`, `--text-primary`, etc.), `.tour-prompt-toast` fixed bottom-center toast ready for Plan 02, `@media (prefers-reduced-motion: reduce)` block.

### data-tour-target attributes

Six surgical `setAttribute` additions on existing elements:
- `sidebar-nav` — nav element in SidebarNav.mount()
- `supergrid` — pv-root div in PivotTable.mount()
- `supergrid-density` — pv-density-toolbar div in SuperDensityModeSwitch.afterRender()
- `latch-explorers` — CollapsibleSection root for `latch` storageKey in WorkbenchShell constructor
- `notebook-explorer` — CollapsibleSection root for `notebook` storageKey in WorkbenchShell constructor
- `command-palette-trigger` — app icon button in CommandBar.mount()

## Decisions Made

1. **showButtons readonly cast**: driver.js types require `AllowedButtons[]` (mutable), but TypeScript infers `readonly` for array literals with `as const`. Used `as Array<'next'|'previous'|'close'>` to satisfy the type constraint without runtime cost.

2. **data-tour-target placement for supergrid**: The `pv-root` div (outermost PivotTable container) is the right anchor — it encompasses the entire SuperGrid and is stable across renders.

3. **supergrid-density timing**: The density toolbar is created lazily in `afterRender` (only when `.pv-toolbar` exists). The attribute is added at toolbar creation time and already present on idempotent re-render, so no re-attribution needed.

## Verification

- `npm run typecheck`: PASS (0 errors)
- `node -e "require.resolve('driver.js')"`: PASS
- `grep -r "data-tour-target" src/`: 6 unique target values across 5 source files
- Pre-existing test failures (performance budget timing, e2e Playwright, production-build) are unaffected by this plan's changes.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — TourEngine is fully functional infrastructure. Plan 02 wires it into app lifecycle (main.ts, post-import hook, command palette).

## Self-Check: PASSED

- [x] src/tour/TourEngine.ts exists
- [x] src/tour/tourSteps.ts exists
- [x] src/styles/tour.css exists
- [x] Commits 50259620 and c24474ac exist
- [x] TypeScript compiles cleanly
