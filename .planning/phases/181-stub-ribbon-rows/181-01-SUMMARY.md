---
phase: 181-stub-ribbon-rows
plan: 01
subsystem: superwidget-layout
tags: [stub-ribbon, layout, css-grid, icons, disabled-ui]
dependency_graph:
  requires: []
  provides: [stories-ribbon-slot, datasets-ribbon-slot, stub-ribbon-css, STORIES_STUB_DEFS, DATASETS_STUB_DEFS]
  affects: [SuperWidget, superwidget.css, section-defs.ts, icons.ts]
tech_stack:
  added: [stub-ribbon.css]
  patterns: [data-definition-driven-rendering, presentational-only-slots, css-grid-area-expansion]
key_files:
  created:
    - src/styles/stub-ribbon.css
  modified:
    - src/ui/section-defs.ts
    - src/ui/icons.ts
    - src/styles/superwidget.css
    - src/superwidget/SuperWidget.ts
decisions:
  - stub-ribbon.css is a separate file (not in dock-nav.css) to avoid specificity conflicts with active nav ribbon
  - Stub rows imported via SuperWidget.ts (not DockNav.ts) since they are rendered directly in SuperWidget
  - No click handlers or event delegation added — pointer-events: none + button[disabled] enforce non-interaction
metrics:
  duration: ~15 minutes
  completed: 2026-04-23
  tasks_completed: 2
  files_modified: 5
---

# Phase 181 Plan 01: Stub Ribbon Rows Summary

Two disabled stub ribbon rows (Stories and Datasets) added to SuperWidget CSS grid with Lucide placeholder icons, rendered from data definitions, permanently non-interactive.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add stub definitions, icons, CSS grid rows, stub-ribbon.css | e3348587 | src/ui/section-defs.ts, src/ui/icons.ts, src/styles/superwidget.css, src/styles/stub-ribbon.css |
| 2 | Create and mount stub ribbon slot elements in SuperWidget.ts | 069dae3c | src/superwidget/SuperWidget.ts |

## What Was Built

**section-defs.ts:** Exported `STORIES_STUB_DEFS` (story-new/New Story, story-play/Present, story-share/Publish) and `DATASETS_STUB_DEFS` (dataset-import/Import, dataset-export/Export, dataset-browse/Browse) as `readonly SidebarItemDef[]` arrays.

**icons.ts:** Added 6 Lucide SVG icon entries: `file-plus`, `presentation`, `send`, `upload`, `download`, `hard-drive`. All follow existing pattern (stroke="currentColor", stroke-width="1.5", fill="none", aria-hidden="true", focusable="false", no width/height).

**superwidget.css:** Expanded CSS grid from 5 rows to 7 rows. New `grid-template-rows: auto auto auto auto auto 1fr auto`. New areas `stories sidecar` and `datasets sidecar` between ribbon and canvas. Added `[data-slot="stories-ribbon"]` and `[data-slot="datasets-ribbon"]` slot rules (opacity: 0.5, cursor: not-allowed).

**stub-ribbon.css:** New stylesheet with `.stub-ribbon__*` class family. Mirrors `dock-nav.css` naming conventions. `.stub-ribbon__item` uses `pointer-events: none` + `cursor: not-allowed`. Uses project design tokens exclusively.

**SuperWidget.ts:** Imports `stub-ribbon.css`, `STORIES_STUB_DEFS`, `DATASETS_STUB_DEFS`, and `iconSvg`. New `_storiesRibbonEl` and `_datasetsRibbonEl` private fields. Constructor creates both slots and calls `_renderStubRibbon()`. `_renderStubRibbon()` builds `div.stub-ribbon > ul.stub-ribbon__list > li.stub-ribbon__section > [header + ul.stub-ribbon__section-items > li > button.stub-ribbon__item[disabled]]` structure. Public accessors `storiesRibbonEl` and `datasetsRibbonEl` added. No click handlers, event delegation, or state management.

## Decisions Made

1. **Separate stub-ribbon.css** — Not co-located in dock-nav.css. Avoids specificity conflicts with active nav ribbon hover/active states. CSS isolation is correct even though the visual treatment mirrors dock-nav.css naming.

2. **CSS import in SuperWidget.ts** — dock-nav.css is imported in DockNav.ts (where DockNav renders). stub-ribbon.css follows the same pattern: imported in SuperWidget.ts where stub ribbons are rendered.

3. **No event wiring** — `pointer-events: none` on items + `button[disabled]` is double protection. No `addEventListener` calls exist on stub elements. This satisfies STOR-03, DSET-03, and CANV-06 (SuperWidget must have zero canvas-related side effects).

## Verification

- TypeScript: zero errors in `src/` (pre-existing test-file errors unchanged)
- Tests: 4375 passed, 2 pre-existing failures (production-build dist/ scan, etl-alto-index data count) — unrelated to this plan

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The Stories and Datasets rows are intentionally stub/disabled. This is by design per Phase 181 requirements (STOR-01..03, DSET-01..03). No data wiring is deferred — these rows are meant to be permanently disabled placeholders communicating future capability.

## Self-Check: PASSED
