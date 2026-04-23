---
phase: 180-horizontal-ribbon-layout
plan: "01"
subsystem: superwidget
tags: [css-grid, layout, ribbon, docknav]
dependency_graph:
  requires: []
  provides: [superwidget-ribbon-slot, ribbon-grid-area]
  affects: [src/styles/superwidget.css, src/superwidget/SuperWidget.ts, src/main.ts]
tech_stack:
  added: []
  patterns: [css-grid-area-rename, slot-rename]
key_files:
  created: []
  modified:
    - src/styles/superwidget.css
    - src/superwidget/SuperWidget.ts
    - src/main.ts
decisions:
  - "Ribbon slot replaces sidebar slot — DockNav mounts into [data-slot='ribbon'] at ribbonEl accessor"
  - "CSS Grid now 2-column (1fr + 0) with 5 rows — sidebar column removed, ribbon row added between tabs and canvas"
  - "All thumbnail/minimap wiring (setThumbnailDataSource, setNavigateCallback, requestThumbnailUpdate) removed from main.ts"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 180 Plan 01: SuperWidget Grid Restructure and Ribbon Slot Summary

SuperWidget CSS Grid restructured to remove sidebar column and add a ribbon row between tabs and canvas; DockNav mounts into the new [data-slot="ribbon"] element via `superWidget.ribbonEl`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restructure SuperWidget CSS Grid and slot element | 390c7a75 | src/styles/superwidget.css, src/superwidget/SuperWidget.ts |
| 2 | Update main.ts DockNav mount point and remove thumbnail wiring | 1764664a | src/main.ts |

## What Was Built

**Task 1 — superwidget.css + SuperWidget.ts:**
- Added `--sw-ribbon-height: 56px` token to the `[data-component="superwidget"]` block
- Changed `grid-template-columns` from `auto 1fr 0` to `1fr 0` (removed sidebar column)
- Changed `grid-template-rows` from `auto auto 1fr auto` to `auto auto auto 1fr auto` (added ribbon row)
- Updated `grid-template-areas` to use 5 rows: header / tabs / ribbon / canvas / status — all paired with `sidecar`
- Updated sidecar-visible override to match: `1fr var(--sw-sidecar-width)` (no `auto` prefix)
- Replaced `[data-slot="sidebar"]` CSS block (with `.sw-sidebar--icon-only` and `.sw-sidebar--icon-thumbnail` variants) with a single `[data-slot="ribbon"]` block containing `grid-area: ribbon`, `height: var(--sw-ribbon-height)`, surface background, bottom border, and `overflow: hidden`
- Renamed `_sidebarEl` private field to `_ribbonEl` in SuperWidget.ts
- Changed slot dataset from `'sidebar'` to `'ribbon'`
- Renamed public accessor from `get sidebarEl()` to `get ribbonEl()`

**Task 2 — main.ts:**
- Changed `dockNav.mount(superWidget.sidebarEl)` to `dockNav.mount(superWidget.ribbonEl)`
- Updated section 11 comment from "Sidebar navigation" to "Ribbon navigation"
- Removed `setThumbnailDataSource(...)` callback block (14 lines)
- Removed `setNavigateCallback(...)` callback block (8 lines)
- Removed `coordinator.subscribe(() => { dockNav.requestThumbnailUpdate(); })` — replaced with empty no-op to preserve coordinator subscription structure
- Removed `dockNav.requestThumbnailUpdate()` from `viewManager.onViewSwitch` callback
- Updated 11a comment from "sidebar active state" to "ribbon active state"

## Verification

All success criteria met:
- `npx tsc --noEmit` — zero src/ errors (pre-existing test file errors unrelated to plan changes)
- `grep -r "sidebarEl\|data-slot=\"sidebar\"" src/` — no matches in SuperWidget.ts or main.ts (DockNav.ts retains internal `_sidebarEl` field for its own mount container tracking — unrelated to the SuperWidget accessor)
- `grep "ribbon" src/styles/superwidget.css` — shows `--sw-ribbon-height`, `grid-area: ribbon`, `[data-slot="ribbon"]` rule
- `grep "ribbonEl" src/superwidget/SuperWidget.ts` — shows private field, slot creation, appendChild, renderCount init, and public accessor

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no UI rendering stubs introduced. The ribbon slot exists in the DOM but DockNav will be wired into horizontal ribbon layout in Plan 02.

## Self-Check: PASSED

- [x] src/styles/superwidget.css modified with ribbon grid area
- [x] src/superwidget/SuperWidget.ts contains `get ribbonEl()` and `data-slot='ribbon'`
- [x] src/main.ts contains `dockNav.mount(superWidget.ribbonEl)` and no thumbnail wiring
- [x] Commits 390c7a75 and 1764664a exist in git log
