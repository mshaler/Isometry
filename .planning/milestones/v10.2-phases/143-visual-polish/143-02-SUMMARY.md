---
phase: 143-visual-polish
plan: "02"
subsystem: ui
tags: [pivot, supergrid, supersize, row-header-resize, plugin]

requires:
  - phase: 143-visual-polish
    plan: "01"
    provides: pv-span-label wrapper and GridLayout foundation from Wave 1

provides:
  - VPOL-03: Per-level row header column width resize — drag handle on right edge of each row header column, widths persist within session, clamped to [60, 400]

affects:
  - GridLayout interface (new rowHeaderWidths field)
  - PivotGrid render() (per-level totalRowHeaderWidth calculation)
  - PivotGrid _renderTable (per-level corner + row spacer <th> widths)
  - PivotGrid _renderOverlay (cumulative left offset + per-level widths for row spans)
  - SuperStackSpans.afterRender (reads rowHeaderWidths, precomputes cumulative offsets)
  - FeatureCatalog (28th plugin registered)

tech-stack:
  added: []
  patterns:
    - "Per-level width resolver pattern: getRowHeaderWidth(level) => map.get(level) ?? defaultWidth"
    - "Cumulative offset array pattern: rowHeaderLeftOffsets precomputed before the row header loop"
    - "_lastTotalRowHeaderWidth cached field for _centerSpanLabels() scroll reuse without re-running transform pipeline"

key-files:
  created:
    - src/views/pivot/plugins/SuperSizeRowHeaderResize.ts
    - tests/views/pivot/SuperSizeRowHeaderResize.test.ts
  modified:
    - src/views/pivot/plugins/PluginTypes.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/plugins/SuperStackSpans.ts
    - src/views/pivot/PivotGrid.ts
    - src/styles/pivot.css
    - tests/views/pivot/helpers/makePluginHarness.ts
    - tests/views/pivot/SuperSize.test.ts
    - tests/views/pivot/SuperZoom.test.ts
    - tests/views/pivot/PluginRegistry.test.ts
    - tests/views/pivot/CrossPluginBehavioral.test.ts
    - tests/views/pivot/SuperStackSpans.test.ts
    - tests/views/pivot/FeatureCatalogCompleteness.test.ts
    - tests/views/pivot/CrossPluginOrdering.test.ts
    - tests/views/pivot/PluginLifecycleCompleteness.test.ts

key-decisions:
  - "getRowHeaderWidth() helper at call site (not stored on instance) — keeps render() self-contained and avoids extra field on PivotGrid"
  - "Optional chaining layout.rowHeaderWidths?.get(level) in SuperStackSpans for backward compat with any caller that passes layout without the new field"
  - "_lastTotalRowHeaderWidth cached on PivotGrid instance so _centerSpanLabels() (called on scroll) uses accurate total without re-running the plugin transform pipeline"
  - "Completeness guards updated 27→28 (FeatureCatalogCompleteness, CrossPluginOrdering, PluginLifecycleCompleteness) — intentional count change per guard pattern"

requirements-completed: [VPOL-03]

duration: 7min
completed: 2026-04-08
---

# Phase 143 Plan 02: Visual Polish Summary

**Per-level row header resize plugin — drag right edge of each row header column to resize independently, with clamp [60, 400] and full PivotGrid/SuperStackSpans integration**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-08T03:50:45Z
- **Completed:** 2026-04-08T03:58:01Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- VPOL-03: New `SuperSizeRowHeaderResize` plugin with TDD test suite (11 tests, all passing)
- `GridLayout.rowHeaderWidths: Map<number, number>` added — maps level index to pixel width
- Plugin registered as 28th entry in `FeatureCatalog` (category: SuperSize)
- `PivotGrid.render()` computes `totalRowHeaderWidth` as sum of per-level widths, not uniform `headerWidth * count`
- `_renderTable` uses D3 `.each()` to size corner and row spacer `<th>` per level
- `_renderOverlay` precomputes `rowHeaderLeftOffsets[]` cumulative array for row span `left` positioning
- `SuperStackSpans.afterRender` reads `layout.rowHeaderWidths` and uses same cumulative offset pattern
- `_centerSpanLabels()` uses cached `_lastTotalRowHeaderWidth` (accurate after resize)
- All 1174 pivot tests pass, TypeScript compiles clean (0 errors)

## Task Commits

1. **Task 1: GridLayout + plugin + tests (TDD red→green)** - `5c917ec9` (feat)
2. **Task 2: Wire into PivotGrid + SuperStackSpans** - `4747a29b` (feat)

## Files Created/Modified

- `src/views/pivot/plugins/PluginTypes.ts` — Added `rowHeaderWidths: Map<number, number>` to GridLayout
- `src/views/pivot/plugins/SuperSizeRowHeaderResize.ts` — New plugin (factory, clamp, drag flow)
- `src/views/pivot/plugins/FeatureCatalog.ts` — Added 28th plugin entry + factory registration
- `src/views/pivot/plugins/SuperStackSpans.ts` — Reads rowHeaderWidths, cumulative offset array for row spans
- `src/views/pivot/PivotGrid.ts` — Per-level total width, _renderTable/.renderOverlay updated, _lastTotalRowHeaderWidth cached
- `src/styles/pivot.css` — `.pv-resize-handle--row-header-width` CSS rule
- `tests/views/pivot/SuperSizeRowHeaderResize.test.ts` — 11 tests (clamp, transformLayout, afterRender, drag flow, catalog)
- Fixture updates: makePluginHarness.ts, SuperSize.test.ts, SuperZoom.test.ts, PluginRegistry.test.ts, CrossPluginBehavioral.test.ts, SuperStackSpans.test.ts
- Guard updates: FeatureCatalogCompleteness.test.ts, CrossPluginOrdering.test.ts, PluginLifecycleCompleteness.test.ts

## Decisions Made

- `getRowHeaderWidth(level)` helper is created inline in `render()` as a closure — not stored as a method to keep the per-render transform self-contained
- Optional chaining (`layout.rowHeaderWidths?.get(level)`) in SuperStackSpans handles any caller passing a layout without the new field
- Cached `_lastTotalRowHeaderWidth` field on PivotGrid avoids re-running the plugin transform pipeline on scroll
- Completeness guard counts updated 27→28 as per the guard pattern (intentional, documented)

## Deviations from Plan

**[Rule 2 - Missing critical functionality] Updated all GridLayout construction sites in test fixtures**

- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** All test files constructing GridLayout objects were missing `rowHeaderWidths: new Map()` after the interface was extended. This broke the TypeScript build.
- **Fix:** Added `rowHeaderWidths: new Map()` to 9 test fixture files and 4 GridLayout construction sites in PivotGrid.ts. Also updated the 3 completeness guard tests (27→28 count).
- **Commit:** `5c917ec9`

**[Rule 2 - Missing critical functionality] Updated FeatureCatalogCompleteness stub detection list**

- **Found during:** Task 1
- **Issue:** `supersize.row-header-resize` was in FEATURE_CATALOG but not in the "implemented" list in the stub detection test — would have falsely appeared as a stub.
- **Fix:** Added `'supersize.row-header-resize'` to the `implemented` array in FeatureCatalogCompleteness.test.ts.
- **Commit:** `5c917ec9`

## Known Stubs

None. The plugin is fully wired: factory registered, handles injected, layout read, render applies per-level widths.

---
*Phase: 143-visual-polish*
*Plan: 02*
*Completed: 2026-04-08*
