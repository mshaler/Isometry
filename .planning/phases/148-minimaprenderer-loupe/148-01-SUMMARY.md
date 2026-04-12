---
phase: 148-minimaprenderer-loupe
plan: "01"
subsystem: ui
tags: [minimap, svg, docknav, thumbnail, pafv, animation]
dependency_graph:
  requires: []
  provides: [MinimapRenderer.ts, DockNav thumbnail rendering]
  affects: [src/ui/DockNav.ts, src/styles/dock-nav.css]
tech_stack:
  added: []
  patterns: [SVG DOM manipulation, requestIdleCallback staggering, lazy data injection via callback]
key_files:
  created:
    - src/ui/MinimapRenderer.ts
    - tests/ui/MinimapRenderer.test.ts
  modified:
    - src/ui/DockNav.ts
    - src/styles/dock-nav.css
decisions:
  - "PafvAxes interface defined in MinimapRenderer.ts rather than importing from providers to avoid circular dependency"
  - "clearMinimap imported in DockNav.ts for future caller use, not invoked in destroy() since nav removal clears DOM"
  - "Caption bar shows 2 axis pairs max (P+A) to fit 96px width — F and V omitted"
metrics:
  duration_seconds: 582
  completed_date: "2026-04-12"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 148 Plan 01: MinimapRenderer Module and DockNav Thumbnail Wiring Summary

MinimapRenderer module with per-view SVG sketch functions (supergrid/timeline/network/tree), PAFV caption bar overlay, and lazy requestIdleCallback-staggered rendering triggered by DockNav icon-thumbnail collapse state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MinimapRenderer module with sketch functions and PAFV caption bar | e8cce8e7 | src/ui/MinimapRenderer.ts, tests/ui/MinimapRenderer.test.ts |
| 2 | Wire lazy thumbnail rendering into DockNav collapse state transitions | 0c455aba | src/ui/DockNav.ts, src/styles/dock-nav.css |

## What Was Built

### MinimapRenderer.ts

- `renderMinimap(thumbEl, viewKey, cards, pafvAxes)`: Creates/reuses a 96x48 SVG inside `thumbEl`. Bails out early for non-visualization view keys (only `supergrid`, `timeline`, `network`, `tree` produce output).
- `clearMinimap(thumbEl)`: Removes `.minimap-svg` element from container.
- Four sketch functions using card_type hue mapping (note=210, bookmark=30, task=120, contact=280, event=60):
  - `_sketchGrid`: 6x3 grid of 14x9px colored rects
  - `_sketchTimeline`: 8 horizontal bars at staggered widths (20-80px)
  - `_sketchNetwork`: Up to 20 circles with deterministic positions from card.id hash, connected by lines
  - `_sketchTree`: Root at (10,8) fanning to 3-4 children at y=22
- PAFV caption bar at y=34, 14px tall: shows P+A axis glyph/field pairs with em dash for null axes. Supergrid uses rowAxes[0]/colAxes[0]; other views use xAxis/yAxis.

### DockNav.ts changes

- Imported `renderMinimap`, `clearMinimap` from `./MinimapRenderer`
- New fields: `_idleCallbackIds: number[]`, `_thumbnailDataSource` callback
- New public method `setThumbnailDataSource(fn)` — lazy data injection seam for main.ts (Plan 02)
- `_applyCollapseState` now cancels pending callbacks and triggers `_renderAllThumbnails()` on `icon-thumbnail` transition
- `_renderAllThumbnails()` iterates `visualize:*` items, staggered via requestIdleCallback in batches of 3
- `destroy()` cancels all idle callbacks and nulls data source

### dock-nav.css changes

- `.dock-nav--icon-thumbnail .dock-nav__item-thumb`: changed to solid border, added `overflow: hidden`, `border-radius: 2px`
- Added `.dock-nav__item-thumb .minimap-svg { display: block; width: 96px; height: 48px; }`

## Verification

- `npx tsc --noEmit`: passes (0 errors)
- `npx vitest run tests/ui/MinimapRenderer.test.ts`: 17/17 tests pass
- Pre-existing failures (E2E Playwright specs requiring running server, etl-alto-index-full requiring real dataset files, performance budget bench) are unrelated to this plan's changes

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/ui/MinimapRenderer.ts` exists
- [x] `tests/ui/MinimapRenderer.test.ts` exists (17 tests)
- [x] Commits e8cce8e7 and 0c455aba confirmed in git log
- [x] All acceptance criteria strings verified in source files
