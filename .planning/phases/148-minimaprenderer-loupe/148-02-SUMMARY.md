---
phase: 148-minimaprenderer-loupe
plan: "02"
subsystem: ui
tags: [minimap, loupe, interaction, pointer-events, docknav, thumbnail, viewmanager]
dependency_graph:
  requires: ["148-01"]
  provides: [renderLoupe, attachLoupeInteraction, DockNav.requestThumbnailUpdate, ViewManager.getLastCards]
  affects: [src/ui/MinimapRenderer.ts, src/ui/DockNav.ts, src/views/ViewManager.ts, src/main.ts, src/styles/dock-nav.css]
tech_stack:
  added: []
  patterns: [SVG pointer capture for drag-to-pan, inverted dimming loupe pattern, debounced re-render guard on collapse state]
key_files:
  created: []
  modified:
    - src/ui/MinimapRenderer.ts
    - src/ui/DockNav.ts
    - src/views/ViewManager.ts
    - src/main.ts
    - src/styles/dock-nav.css
    - tests/ui/MinimapRenderer.test.ts
decisions:
  - "getContainer() added to ViewManager rather than accessing private container field directly from main.ts"
  - "dragMoved flag tracks 3px threshold to distinguish click from drag — prevents double-fire on click after drag"
  - "coordinator.subscribe added in main.ts (not DockNav) — DockNav stays free of direct coordinator coupling"
metrics:
  duration_seconds: 346
  completed_date: "2026-04-12"
  tasks_completed: 1
  files_created: 0
  files_modified: 6
---

# Phase 148 Plan 02: Loupe Overlay and Minimap Interaction Wiring Summary

Loupe viewport overlay with inverted dimming, click-to-jump, drag-to-pan via SVG pointer capture, wired to ViewManager.getLastCards() and DockNav.requestThumbnailUpdate() debounced re-render lifecycle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add loupe overlay to MinimapRenderer + wire data source and re-render lifecycle | 29d3199b | src/ui/MinimapRenderer.ts, src/ui/DockNav.ts, src/views/ViewManager.ts, src/main.ts, src/styles/dock-nav.css, tests/ui/MinimapRenderer.test.ts |

## What Was Built

### MinimapRenderer.ts — renderLoupe + attachLoupeInteraction

- `renderLoupe(thumbEl, viewportRect)`: finds `.minimap-svg`, removes existing `.minimap-loupe` group, creates new group with 4 dimming rects (top/bottom/left/right, fill `var(--overlay-bg)`) and 1 viewport outline rect (stroke `var(--accent)`, fill none, rx=1). Converts 0-1 normalized coords to SVG pixels (clamped). Sets `svg.style.cursor = 'crosshair'`.
- `attachLoupeInteraction(thumbEl, onNavigate)`: attaches `pointerdown`/`pointermove`/`pointerup`/`click` listeners to `.minimap-svg`. Uses `svg.setPointerCapture(e.pointerId)` for capture-based drag. Tracks 3px drag threshold via `dragMoved` flag to suppress click-after-drag double-fire. Returns cleanup function removing all 4 listeners.

### DockNav.ts

- Added fields: `_reRenderTimer`, `_loupeCleanups`, `_onNavigate`
- `setNavigateCallback(fn)`: stores navigate callback for loupe interaction
- `requestThumbnailUpdate()`: guard-returns if `_collapseState !== 'icon-thumbnail'`; 300ms debounced call to `_renderAllThumbnails()`
- `_renderAllThumbnails()`: cleans up previous loupe listeners before each batch render, attaches `attachLoupeInteraction` per thumbnail if `_onNavigate` is set
- `destroy()`: clears `_reRenderTimer`, calls all `_loupeCleanups`, nulls `_onNavigate`

### ViewManager.ts

- Added `_lastCards: CardDatum[] = []` private field
- `_fetchAndRender()` stores `this._lastCards = cards` after mapping rows
- `getLastCards()`: returns `[...this._lastCards]` copy
- `getContainer()`: exposes the private `container` element for loupe navigation scroll target

### main.ts wiring

- `dockNav.setThumbnailDataSource(...)`: returns `{ cards: viewManager.getLastCards(), pafvAxes: { ...pafv.getState() } }`
- `dockNav.setNavigateCallback(...)`: scrolls `viewManager.getContainer()` to `normX * maxScrollLeft` / `normY * maxScrollTop` with `behavior: 'instant'`
- `coordinator.subscribe(() => dockNav.requestThumbnailUpdate())`: triggers debounced re-render on state changes
- `viewManager.onViewSwitch`: chains `dockNav.requestThumbnailUpdate()` after existing `dockNav.setActiveItem()`

### dock-nav.css

- `.minimap-loupe rect { pointer-events: none }`: allows hover/drag to pass through dimming rects to SVG
- `.minimap-svg { cursor: crosshair }` / `.minimap-svg:active { cursor: grabbing }`

### tests/ui/MinimapRenderer.test.ts

6 new tests (23 total):
- renderLoupe creates 5 rects (4 dimming + 1 outline)
- Viewport outline stroke is `var(--accent)`, fill is `none`
- Full viewport (0,0,1,1) produces zero-area dimming rects
- renderLoupe with no SVG does not throw
- attachLoupeInteraction returns cleanup function
- attachLoupeInteraction with no SVG returns no-op cleanup

## Verification

- `npx tsc --noEmit`: 0 errors
- `npx vitest run tests/ui/MinimapRenderer.test.ts`: 23/23 tests pass
- `npx vitest run` (full suite): 8541/8554 unit tests pass; 13 failures are pre-existing (E2E Playwright requiring running server + performance budget timing tests)

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added `getContainer()` to ViewManager**
- Found during: Task 1, Part C
- Issue: `container` field is `private readonly` in ViewManager; plan said to "read ViewManager.ts to determine how the container is exposed" — no public accessor existed
- Fix: Added `getContainer(): HTMLElement` public method returning `this.container`
- Files modified: `src/views/ViewManager.ts`
- Commit: 29d3199b

## Known Stubs

None — all loupe interaction is fully wired. The `renderLoupe` function is exported and ready for callers to drive with real viewport data; the current implementation wires click-to-jump and drag-to-pan via `container.scrollTo` for DOM-based views (SuperGrid, list). SVG D3-zoom views (network, tree) have `scrollWidth === clientWidth` so navigation is a no-op — intentional for v1 as documented in the plan.

## Self-Check: PASSED

- [x] `src/ui/MinimapRenderer.ts` contains `export function renderLoupe(`
- [x] `src/ui/MinimapRenderer.ts` contains `export function attachLoupeInteraction(`
- [x] `src/ui/MinimapRenderer.ts` contains `minimap-loupe`
- [x] `src/ui/MinimapRenderer.ts` contains `overlay-bg`
- [x] `src/ui/MinimapRenderer.ts` contains `setPointerCapture`
- [x] `src/ui/DockNav.ts` contains `requestThumbnailUpdate`
- [x] `src/ui/DockNav.ts` contains `_reRenderTimer`
- [x] `src/ui/DockNav.ts` contains `setNavigateCallback`
- [x] `src/ui/DockNav.ts` contains `attachLoupeInteraction`
- [x] `src/views/ViewManager.ts` contains `getLastCards`
- [x] `src/views/ViewManager.ts` contains `_lastCards`
- [x] `src/main.ts` contains `setThumbnailDataSource`
- [x] `src/main.ts` contains `setNavigateCallback`
- [x] `src/main.ts` contains `requestThumbnailUpdate`
- [x] `src/main.ts` contains `scrollTo`
- [x] `src/styles/dock-nav.css` contains `.minimap-loupe`
- [x] Commit 29d3199b confirmed in git log
