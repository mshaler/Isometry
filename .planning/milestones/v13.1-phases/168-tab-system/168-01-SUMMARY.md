---
phase: 168-tab-system
plan: "01"
subsystem: superwidget/ExplorerCanvas
tags: [tab-system, explorer-canvas, projection-state, css-hide-show]
dependency_graph:
  requires: [167-explorercanvas-core]
  provides: [tab-bar, onProjectionChange, tab-container-switching]
  affects: [src/superwidget/ExplorerCanvas.ts, src/superwidget/projection.ts, src/superwidget/SuperWidget.ts, src/main.ts, src/styles/superwidget.css]
tech_stack:
  added: []
  patterns: [css-class-toggle, event-delegation, closure-forward-reference]
key_files:
  created: []
  modified:
    - src/superwidget/ExplorerCanvas.ts
    - src/superwidget/projection.ts
    - src/superwidget/SuperWidget.ts
    - src/main.ts
    - src/styles/superwidget.css
    - tests/superwidget/ExplorerCanvas.test.ts
decisions:
  - "Apps section merged into import-export tab container (D-01, D-02) — enabledTabIds drops 'apps'"
  - "CSS class toggle (.active) used for hide/show — avoids inline style conflicts"
  - "onProjectionChange is optional on CanvasComponent — non-breaking extension"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-21T18:30:33Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 168 Plan 01: Tab System Summary

Tab bar with 3 tabs (Import/Export, Catalog, DB Utilities) inside ExplorerCanvas using CSS class-toggle hide/show driven by Projection.activeTabId through the commitProjection state machine.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add onProjectionChange to CanvasComponent and wire SuperWidget | ab441d65 | projection.ts, SuperWidget.ts |
| 2 | Rewrite ExplorerCanvas with tab bar, 3 containers, CSS hide/show, wire main.ts | 4459eecc | ExplorerCanvas.ts, main.ts, superwidget.css, ExplorerCanvas.test.ts |

## What Was Built

- `CanvasComponent` interface extended with optional `onProjectionChange?(proj: Projection): void`
- `SuperWidget.commitProjection` calls `onProjectionChange` after new canvas mount and on tab switch
- `ExplorerCanvas` rewritten: constructor takes `(config, commitProjection)`, creates tab bar with event delegation, 3 tab containers (`[data-tab-container]`), and implements `onProjectionChange` for CSS `.active` class toggling
- Apps section (index 2 from DataExplorerPanel) stacked inside import-export tab container per D-01/D-02
- `main.ts` passes `(proj) => superWidget.commitProjection(proj)` as second ExplorerCanvas arg; `enabledTabIds` trimmed to `['import-export', 'catalog', 'db-utilities']`
- CSS added: `[data-slot="tab-bar"]`, `[data-tab-id]` button styles, `[data-tab-container]` hidden-by-default, `[data-tab-container].active { display: flex }`

## Decisions Made

- **Apps section merged into import-export** — enabledTabIds no longer contains 'apps'; the Apps CollapsibleSection renders inside the import-export tab container
- **CSS `.active` class toggle** — chosen over inline `style.display` to avoid specificity conflicts and keep layout in CSS
- **Optional `onProjectionChange`** — backward-compatible interface extension; stub canvases ignore it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated ExplorerCanvas.test.ts for new 2-arg constructor**
- **Found during:** Task 2 TypeScript check
- **Issue:** Existing tests called `new ExplorerCanvas(makeConfig())` with 1 argument; constructor now requires 2
- **Fix:** Added `() => {}` as noop commitProjection in both `beforeEach` blocks
- **Files modified:** tests/superwidget/ExplorerCanvas.test.ts
- **Commit:** 4459eecc

**2. [Rule 1 - Bug] Updated test checking for `.data-explorer` DOM element**
- **Found during:** Task 2 test run
- **Issue:** New DOM structure extracts sections from `.data-explorer` root; root is no longer appended to container, so `.data-explorer` query returns null
- **Fix:** Updated test to query `[data-tab-container]` instead (still verifies real DataExplorerPanel content is present)
- **Files modified:** tests/superwidget/ExplorerCanvas.test.ts
- **Commit:** 4459eecc

## Verification Results

- `npx tsc --noEmit` — exits 0 (clean)
- `npx vitest run tests/superwidget/` — 168 tests pass, 10 test files
- `grep -c 'ExplorerCanvas' src/superwidget/SuperWidget.ts` — returns 0 (CANV-06 preserved)
- ExplorerCanvas.ts contains `onProjectionChange`, `TAB_DEFS`, `data-slot="tab-bar"`, `data-tab-container`
- superwidget.css contains `[data-tab-id]` and `[data-tab-container].active` selectors

## Known Stubs

None — all tab containers receive real DataExplorerPanel section DOM.

## Self-Check: PASSED
