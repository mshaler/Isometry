---
phase: 149-explorer-decoupling-panel-stubs
plan: 02
subsystem: ui/panels
tags: [panel-stubs, dock-nav, coming-soon, accessibility]
dependency_graph:
  requires: [149-01]
  provides: [maps-stub-panel, formulas-stub-panel, stories-stub-panel, synthesize-dock-section]
  affects: [PanelRegistry, DockNav, main.ts, section-defs.ts]
tech_stack:
  added: []
  patterns: [PanelMeta/PanelFactory stub pattern, role=status accessibility, Coming soon placeholder]
key_files:
  created:
    - src/ui/panels/MapsPanelStub.ts
    - src/ui/panels/FormulasPanelStub.ts
    - src/ui/panels/StoriesPanelStub.ts
  modified:
    - src/ui/section-defs.ts
    - src/ui/icons.ts
    - src/main.ts
decisions:
  - globe icon added to icons.ts (missing from prior art); follows existing Lucide SVG pattern
  - synthesize section added to DOCK_DEFS (was dropped in fed8fce3 but plan 149-02 re-adds it for maps stub)
metrics:
  duration_seconds: 360
  completed: "2026-04-16T15:26:57Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 149 Plan 02: Stub Panel Factories and Dock Routing Summary

Three "Coming soon" stub panel factories (Maps, Formulas, Stories) registered in PanelRegistry with globe/code/book-open icons, and a new `synthesize` dock section added to DOCK_DEFS for the Maps stub entry.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create stub panel factories and add Maps dock entry | a2cf75b0 | MapsPanelStub.ts, FormulasPanelStub.ts, StoriesPanelStub.ts, section-defs.ts, icons.ts |
| 2 | Register stubs in PanelRegistry and add to dock routing | b4b4ef6c | main.ts |

## What Was Built

**Task 1 — Stub panel factories:**
- Created `MapsPanelStub.ts` (id: `maps-stub`, globe icon, "Coming soon" placeholder with `role="status"`)
- Created `FormulasPanelStub.ts` (id: `formulas-stub`, code icon, "Coming soon" placeholder with `role="status"`)
- Created `StoriesPanelStub.ts` (id: `stories-stub`, book-open icon, "Coming soon" placeholder with `role="status"`)
- Added `globe` Lucide SVG to `icons.ts` (was missing, required by MapsPanelStub)
- Added `synthesize` section to DOCK_DEFS with `maps` (globe) and `graph` (share-2) items

**Task 2 — PanelRegistry wiring:**
- Imported all three stub meta/factory pairs in `main.ts`
- Registered `MAPS_PANEL_META`, `FORMULAS_PANEL_META`, `STORIES_PANEL_META` via `panelRegistry.register()`
- Added `synthesize:maps -> maps-stub`, `analyze:formula -> formulas-stub`, `activate:stories -> stories-stub` to `dockToPanelMap`

## Verification

- `npx tsc --noEmit`: zero errors (both tasks)
- `npx vitest run`: 8680 unit tests pass (40 pre-existing E2E/bench failures, same as Plan 01 baseline)

## Deviations from Plan

**1. [Rule 3 - Blocking] Added globe icon to icons.ts**
- **Found during:** Task 1
- **Issue:** `iconSvg('globe', 32)` called in MapsPanelStub.ts but `globe` key was missing from ICONS map. `iconSvg()` returns `''` for unknown keys — icon would silently not render.
- **Fix:** Added standard Lucide globe SVG to `icons.ts` following existing Lucide pattern (stroke="currentColor", aria-hidden, focusable="false")
- **Files modified:** src/ui/icons.ts
- **Commit:** a2cf75b0

## Known Stubs

The following stub panels are intentional placeholders awaiting future implementation:
- `src/ui/panels/MapsPanelStub.ts` — Maps geospatial feature (id: maps-stub) — renders "Coming soon" with globe icon
- `src/ui/panels/FormulasPanelStub.ts` — Formulas DSL/SQL feature (id: formulas-stub) — renders "Coming soon" with code icon
- `src/ui/panels/StoriesPanelStub.ts` — Stories presentation feature (id: stories-stub) — renders "Coming soon" with book-open icon

These stubs ARE the plan's goal — they exist as clean extension points, not incomplete work. Future phases will replace each stub with a full implementation.

## Self-Check: PASSED
