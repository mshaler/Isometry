---
phase: 159-dataexplorer-catalog-completion
plan: "01"
subsystem: DataExplorer / CatalogSuperGrid
tags: [catalog, supergrid, pivot-table, css, dom, mutation-observer]
dependency_graph:
  requires: [156-01, 156-02]
  provides: [EXPX-04, EXPX-07]
  affects: [src/views/CatalogSuperGrid.ts, src/styles/data-explorer.css]
tech_stack:
  added: []
  patterns: [MutationObserver disconnect/reconnect, D3 datum binding, data-attribute stamping]
key_files:
  created:
    - tests/views/CatalogSuperGrid.test.ts
  modified:
    - src/views/CatalogSuperGrid.ts
    - src/styles/data-explorer.css
decisions:
  - "CATALOG_FIELD_LABELS const added to CatalogSuperGrid.ts for header label mapping; avoids modifying PivotGrid colDim values"
  - "_renderColumnHeaders targets PivotGrid's real .pv-overlay (querySelector returns first match inside container)"
  - "CSS.escape guarded with typeof CSS check for jsdom compatibility"
  - "Tests use setLastDatasets() type assertion to bypass PivotTable hasAxes guard in test environment"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-18"
  tasks: 2
  files_modified: 3
requirements: [EXPX-04, EXPX-07]
---

# Phase 159 Plan 01: CatalogSuperGrid Field Value Rendering + Active Row CSS Fix Summary

**One-liner:** CatalogSuperGrid cells now display human-readable field values (name, source, card count, date) instead of raw numeric 0/1 counts, column headers show friendly labels, and the active row left-border CSS selector correctly targets .pv-data-cell instead of the nonexistent .sg-cell.

## Tasks Completed

| Task | Description | Commit | Files |
| ---- | ----------- | ------ | ----- |
| 1    | Add CATALOG_FIELD_LABELS, _renderFieldValues, _renderColumnHeaders, data-col-key stamping | `94bebee3` | CatalogSuperGrid.ts, CatalogSuperGrid.test.ts |
| 2    | Fix active row CSS selector from .sg-cell to .pv-data-cell | `a6c8dc99` | data-explorer.css |

## What Was Built

### Task 1: Field Value Rendering (TDD)

**CATALOG_FIELD_LABELS constant** — maps raw CATALOG_FIELDS names to display labels:
- `name` → 'Name', `source_type` → 'Source', `card_count` → 'Cards', `connection_count` → 'Connections', `last_imported_at` → 'Imported', `actions` → ''

**_stampRowKeys() extension** — now also stamps `data-col-key` on each `.pv-data-cell` by reading `cell.dataset['col']` as an index into `CATALOG_FIELDS`. Previously only stamped `data-row-key`.

**_renderFieldValues() method** — iterates tbody rows, looks up the dataset from `lastDatasets` by `data-row-key`, and replaces each cell's numeric textContent with the actual field value:
- name, source_type, card_count, connection_count: direct field → string
- last_imported_at: formatted via `new Date(...).toLocaleDateString()` or `—` (em dash) for null
- actions: set to '' (buttons rendered by `_renderActionButtons`)

**_renderColumnHeaders() method** — finds `.pv-overlay` in the container (PivotGrid's overlay element), iterates span elements, and replaces any span whose text matches a CATALOG_FIELDS entry with the corresponding CATALOG_FIELD_LABELS value.

**MutationObserver callback updated** to call: `_stampRowKeys` → `_renderFieldValues` → `_renderColumnHeaders` → `_applyActiveRowHighlight` → `_renderActionButtons`.

**CSS.escape guard** — added `typeof CSS !== 'undefined' && CSS.escape` check before calling `CSS.escape()` in `_applyActiveRowHighlight`. Fixes jsdom test environment compatibility.

**9 unit tests** in `tests/views/CatalogSuperGrid.test.ts` covering:
- CATALOG_FIELD_LABELS: source_type → Source, actions → ''
- data-col-key stamping on all 6 CATALOG_FIELDS columns
- data-row-key stamping on tr and cell children
- _renderFieldValues: name, source_type, card_count, last_imported_at (locale), null date (em dash), actions cell empty

### Task 2: CSS Selector Fix

Changed the broken `sg-cell` selector to the correct `pv-data-cell` in `data-explorer.css`:

```css
/* Before */
.data-explorer__catalog-row--active .sg-cell:first-child { ... }

/* After */
.data-explorer__catalog-row--active .pv-data-cell:first-child { ... }
```

`.sg-cell` is a SuperGrid class that doesn't exist in PivotTable's DOM. PivotTable renders `.pv-data-cell` elements.

## Verification

- `npx vitest run tests/views/CatalogSuperGrid.test.ts` — 9/9 pass
- `npx tsc --noEmit` — 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] CSS.escape jsdom guard in _applyActiveRowHighlight**
- **Found during:** Task 1 tests
- **Issue:** `CSS.escape()` is undefined in jsdom environment, causing test failures
- **Fix:** Added `typeof CSS !== 'undefined' && CSS.escape` guard with fallback quote escaping
- **Files modified:** src/views/CatalogSuperGrid.ts
- **Commit:** 94bebee3

**2. [Rule 1 - Bug] Test approach: PivotTable hasAxes guard prevents fetchData in test environment**
- **Found during:** Task 1 tests
- **Issue:** CatalogDataAdapter.getRowDimensions() returns [] at construction, so PivotTable's `hasAxes` check skips fetchData, never populating lastDatasets
- **Fix:** Tests use `setLastDatasets()` type assertion to directly populate `_bridgeAdapter.lastDatasets`, bypassing the async chain. This is a test-only workaround; production behavior is unaffected (real datasets populate via coordinator refresh after first render)
- **Files modified:** tests/views/CatalogSuperGrid.test.ts

## Known Stubs

None — all functionality is wired to real data.

## Self-Check: PASSED

Files exist:
- src/views/CatalogSuperGrid.ts — FOUND
- src/styles/data-explorer.css — FOUND
- tests/views/CatalogSuperGrid.test.ts — FOUND

Commits exist:
- 94bebee3 — feat(159-01): add CATALOG_FIELD_LABELS...
- a6c8dc99 — fix(159-01): fix active row CSS selector...
