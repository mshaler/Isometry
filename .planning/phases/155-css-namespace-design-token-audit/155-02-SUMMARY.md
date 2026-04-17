---
phase: 155-css-namespace-design-token-audit
plan: 02
subsystem: css-namespacing
tags: [css, bem, design-tokens, refactor]
dependency_graph:
  requires: []
  provides: [VCSS-01, VCSS-02]
  affects: [projection-explorer, latch-explorers, properties-explorer, data-explorer, notebook-explorer, catalog-actions]
tech_stack:
  added: [--danger-text token]
  patterns: [BEM component namespace, design token replacement, fallback stripping]
key_files:
  created: []
  modified:
    - src/styles/projection-explorer.css
    - src/styles/latch-explorers.css
    - src/styles/properties-explorer.css
    - src/styles/data-explorer.css
    - src/styles/notebook-explorer.css
    - src/styles/catalog-actions.css
    - src/styles/design-tokens.css
    - src/ui/ProjectionExplorer.ts
    - src/ui/LatchExplorers.ts
    - src/ui/HistogramScrubber.ts
    - src/ui/PropertiesExplorer.ts
    - src/ui/DataExplorerPanel.ts
    - src/ui/NotebookExplorer.ts
    - src/ui/charts/PieChart.ts
    - src/ui/charts/BarChart.ts
    - src/ui/charts/LineChart.ts
    - src/ui/charts/ScatterChart.ts
    - src/ui/charts/ChartRenderer.ts
    - src/views/CatalogSuperGrid.ts
    - tests/ui/LatchExplorers.test.ts
    - tests/ui/HistogramScrubber.test.ts
decisions:
  - "Added --danger-text token to design-tokens.css (dark=#ff4a4a, light/system=#b91c1c) to support stripped fallback in notebook-explorer.css"
  - "Updated NeXTSTEP and Material theme selectors in design-tokens.css from dexp-* to data-explorer__*"
  - "Non-standard tokens --border-secondary, --bg-secondary, --bg-tertiary, --accent-primary in properties-explorer.css mapped to standard tokens: --border-muted, --bg-surface, --cell-hover, --accent"
  - "CatalogSuperGrid.ts updated alongside catalog-actions.css since it owns the dset-* class references"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-17T21:16:31Z"
  tasks: 2
  files: 21
---

# Phase 155 Plan 02: CSS Namespace and Design Token Migration (6 Explorers) Summary

Migrated all 6 remaining explorer CSS files to BEM-compliant component-scoped namespaces and replaced hardcoded spacing/color values with design tokens. Completing VCSS-01 and VCSS-02 for the full set of 8 explorer panels.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ProjectionExplorer, LatchExplorers, PropertiesExplorer migration | 015c6148 | projection-explorer.css, latch-explorers.css, properties-explorer.css, ProjectionExplorer.ts, LatchExplorers.ts, HistogramScrubber.ts, PropertiesExplorer.ts |
| 2 | DataExplorer, NotebookExplorer, CatalogActions migration | da6564eb | data-explorer.css, notebook-explorer.css, catalog-actions.css, design-tokens.css, DataExplorerPanel.ts, NotebookExplorer.ts, 4 chart files, CatalogSuperGrid.ts |
| 2b | Test fixes | c70b4630 | tests/ui/LatchExplorers.test.ts, tests/ui/HistogramScrubber.test.ts |

## What Was Done

### Task 1: ProjectionExplorer, LatchExplorers, PropertiesExplorer

**ProjectionExplorer (projection-explorer.css + ProjectionExplorer.ts):**
- Renamed `.z-controls__*` selectors to `.projection-explorer__z-*` (7 selector families, 15 TS references)
- Replaced hardcoded `8px` with `var(--space-sm)` in footer `gap`, `padding`, `margin-top`
- Replaced `padding: 2px 4px` with `padding: 2px var(--space-xs)` in well-label
- Replaced `padding: 2px 8px` with `padding: 2px var(--space-sm)` in reset-btn

**LatchExplorers (latch-explorers.css + LatchExplorers.ts + HistogramScrubber.ts):**
- Renamed `.latch-field-group`, `.latch-chip`, `.latch-search-input`, `.latch-time-preset`, `.latch-empty`, `.latch-histogram`, `.histogram-scrubber__*` to `.latch-explorers__*` equivalents
- Stripped `var(--danger, #c0392b)` fallbacks from scrubber error selectors
- Added `.latch-explorers__scrubber-error-msg` selector (was missing from CSS)
- Updated ~25 TS string literals in LatchExplorers.ts
- Updated 9 TS string literals in HistogramScrubber.ts

**PropertiesExplorer (properties-explorer.css + PropertiesExplorer.ts):**
- Renamed `.prop-latch-chip` to `.properties-explorer__latch-chip`, `.prop-latch-chip__select` to `.properties-explorer__latch-select`
- Replaced non-standard tokens: `--border-secondary` → `--border-muted`, `--bg-secondary` → `--bg-surface`, `--bg-tertiary` → `--cell-hover`, `--accent-primary` → `--accent`
- Replaced hardcoded `8px` with `var(--space-sm)` in footer
- Replaced `padding: var(--space-xs) 6px` with `padding: var(--space-xs)` in column-header
- Replaced `margin-right: 4px` with `margin-right: var(--space-xs)` in latch-chip
- Added `/* structural: below token scale */` comment to 8px chevron font-size (intentional)
- Updated 2 TS string literals in PropertiesExplorer.ts

### Task 2: DataExplorer, NotebookExplorer, CatalogActions

**DataExplorer (data-explorer.css + DataExplorerPanel.ts + CatalogSuperGrid.ts):**
- Renamed `.dexp-*` selectors to `.data-explorer__*` (25 selector families, 20+ TS references)
- Replaced `#fff` with `var(--bg-primary)` on import-btn
- Updated NeXTSTEP and Material theme overrides in design-tokens.css
- Updated `.dexp-catalog-row--active` reference in CatalogSuperGrid.ts

**NotebookExplorer (notebook-explorer.css + NotebookExplorer.ts + 4 chart files + ChartRenderer.ts):**
- Renamed `.notebook-title-input`, `.notebook-idle*`, `.notebook-segmented-control`, `.notebook-tab*`, `.notebook-toolbar*`, `.notebook-body`, `.notebook-textarea`, `.notebook-preview`, `.notebook-chart-*` to `.notebook-explorer__*`
- Stripped `var(--danger-text, #b91c1c)` and `var(--danger-bg, #fef2f2)` fallbacks (added `--danger-text` token)
- Replaced `padding: 4px 8px` with `padding: var(--space-xs) var(--space-sm)` in tooltip
- Added `--danger-text` token to design-tokens.css (dark: `#ff4a4a`, light/system: `#b91c1c`)
- Updated template literal `class="notebook-chart-card"` in NotebookExplorer.ts
- Updated all 4 chart files (BarChart, LineChart, ScatterChart, PieChart) + ChartRenderer.ts

**CatalogActions (catalog-actions.css + CatalogSuperGrid.ts):**
- Renamed `.dset-actions-cell`, `.dset-actions-wrapper`, `.dset-action-btn`, `.dset-action-btn--reimport`, `.dset-action-btn--delete` to `.catalog-actions__*`
- Replaced `color: #fff` with `color: var(--bg-primary)` in `.app-dialog__btn--delete`
- Updated 5 TS references in CatalogSuperGrid.ts

## Verification Results

All 3 audit queries from the plan return zero matches:
1. **Namespace audit:** Zero non-namespaced selectors across all 8 explorer CSS files
2. **Fallback audit:** Zero `var(--token, fallback)` patterns (excluding `transition` properties)
3. **Hardcoded hex audit:** Zero `#rrggbb` values in any explorer CSS file

TypeScript: `npx tsc --noEmit` passes with zero errors.
Tests: LatchExplorers.test.ts (46 tests) and HistogramScrubber.test.ts (10 tests) pass after updating selectors to match new class names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Test files not mentioned in plan but required for correctness**
- **Found during:** Task 2 verification (test run)
- **Issue:** `tests/ui/LatchExplorers.test.ts` and `tests/ui/HistogramScrubber.test.ts` referenced old CSS class names (116 test failures)
- **Fix:** Updated all old selectors in both test files to use new namespaced class names
- **Files modified:** tests/ui/LatchExplorers.test.ts, tests/ui/HistogramScrubber.test.ts
- **Commit:** c70b4630

**2. [Rule 1 - Bug] design-tokens.css referenced old dexp-* selectors**
- **Found during:** Task 2 CSS review
- **Issue:** NeXTSTEP and Material 3 theme sections in design-tokens.css referenced `.dexp-import-btn` etc. — stale after data-explorer.css migration
- **Fix:** Updated all theme-specific selectors in design-tokens.css to `.data-explorer__*`
- **Commit:** da6564eb (included in Task 2)

**3. [Rule 2 - Missing token] --danger-text not in design-tokens.css**
- **Found during:** Task 2 notebook-explorer.css review
- **Issue:** Notebook chart-error used `var(--danger-text, #b91c1c)` fallback; plan says strip fallback, but `--danger-text` didn't exist
- **Fix:** Added `--danger-text` to dark theme (`#ff4a4a`), light theme (`#b91c1c`), and system theme (light value)
- **Commit:** da6564eb (included in Task 2)

**4. [Rule 1 - Bug] CatalogSuperGrid.ts owned dset-* references not listed in plan files_modified**
- **Found during:** Task 2 grep for dset-action in TS files
- **Issue:** Plan listed only DataExplorerPanel.ts for dset- references, but CatalogSuperGrid.ts had 5 dset-action-* class references
- **Fix:** Updated CatalogSuperGrid.ts alongside catalog-actions.css
- **Commit:** da6564eb (included in Task 2)

## Known Stubs

None — all selectors are wired to production component rendering.

## Self-Check: PASSED

- projection-explorer.css: present, contains `.projection-explorer__z-label` ✓
- latch-explorers.css: present, contains `.latch-explorers__chip` ✓
- properties-explorer.css: present, contains `.properties-explorer__latch-chip` ✓
- data-explorer.css: present, contains `.data-explorer__import-btn` ✓
- notebook-explorer.css: present, contains `.notebook-explorer__chart-card` ✓
- catalog-actions.css: present, contains `.catalog-actions__btn` ✓
- Commits 015c6148, da6564eb, c70b4630: exist in git log ✓
