---
phase: 155-css-namespace-design-token-audit
plan: "03"
subsystem: css-test-alignment
tags:
  - css
  - BEM
  - test-selectors
  - design-tokens
dependency_graph:
  requires:
    - 155-01
    - 155-02
  provides:
    - VCSS-01
    - VCSS-02
    - VCSS-03
    - VCSS-04
  affects:
    - tests/ui/NotebookExplorer.test.ts
    - tests/ui/algorithm-explorer.test.ts
    - tests/views/network-view-legend.test.ts
    - tests/seams/ui/notebook-creation-flow.test.ts
    - tests/seams/ui/notebook-creation-shortcuts.test.ts
    - tests/seams/ui/notebook-shadow-buffer.test.ts
    - src/styles/notebook-explorer.css
tech_stack:
  patterns:
    - BEM CSS namespace (notebook-explorer__, algorithm-explorer__)
    - structural annotation convention for sub-token px values
key_files:
  modified:
    - tests/ui/NotebookExplorer.test.ts
    - tests/ui/algorithm-explorer.test.ts
    - tests/views/network-view-legend.test.ts
    - tests/seams/ui/notebook-creation-flow.test.ts
    - tests/seams/ui/notebook-creation-shortcuts.test.ts
    - tests/seams/ui/notebook-shadow-buffer.test.ts
    - src/styles/notebook-explorer.css
decisions:
  - "Auto-updated toolbar class names (notebook-toolbar* -> notebook-explorer__toolbar*) in NotebookExplorer.test.ts — these were also stale and causing failures, same pattern as the plan-specified renames"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-17"
  tasks_completed: 2
  files_modified: 7
requirements:
  - VCSS-01
  - VCSS-02
  - VCSS-03
  - VCSS-04
---

# Phase 155 Plan 03: CSS Test Selector Alignment Summary

**One-liner:** Aligned 6 test files to BEM-namespaced CSS selectors (notebook-explorer__/algorithm-explorer__) and annotated 3 sub-token px values in notebook-explorer.css.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update test selectors to match new BEM namespaces | 69cd6295 | 6 test files |
| 2 | Add structural annotations to sub-token px values | 05b1c9e3 | src/styles/notebook-explorer.css |

## What Was Done

### Task 1: Test Selector Alignment

Replaced stale pre-migration class names with BEM-namespaced equivalents across 6 test files:

**Notebook test files** (4 files):
- `.notebook-segmented-control` → `.notebook-explorer__segmented-control`
- `.notebook-tab` → `.notebook-explorer__tab`
- `notebook-tab--active` (classList.contains) → `notebook-explorer__tab--active`
- `.notebook-body` → `.notebook-explorer__body`
- `.notebook-textarea` → `.notebook-explorer__textarea`
- `.notebook-preview` → `.notebook-explorer__preview`
- `.notebook-new-card-btn` → `.notebook-explorer__new-card-btn`
- `.notebook-title-input` → `.notebook-explorer__title-input`
- `.notebook-chart-card` → `.notebook-explorer__chart-card`
- `.notebook-chart-preview` → `.notebook-explorer__chart-preview`
- `.notebook-idle` → `.notebook-explorer__idle`
- `.notebook-idle-hint` → `.notebook-explorer__idle-hint`

**Algorithm/Network test files** (2 files):
- `.nv-pick-instruction` → `.algorithm-explorer__pick-instruction`
- `.nv-pick-dropdowns` → `.algorithm-explorer__pick-dropdowns`

Result: 250 tests pass across all 6 files (was 62 failures before).

### Task 2: Structural Annotations

Added `/* structural: below token scale */` comment to 3 hardcoded px values in `src/styles/notebook-explorer.css`:
- Line 101: `gap: 2px` in `.notebook-explorer__segmented-control`
- Line 152: `gap: 2px` in `.notebook-explorer__toolbar-group`
- Line 273: `padding: 1px 4px` in `.notebook-explorer__preview code`

## Verification

```
grep -rn "\.notebook-segmented-control|\.notebook-tab[^-]|..." tests/ → 0 matches
grep -rn "\.nv-pick-" tests/ → 0 matches
grep -c "structural: below token scale" src/styles/notebook-explorer.css → 3
npx vitest run [6 target files] → 250 passed, 0 failed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended toolbar class rename scope in NotebookExplorer.test.ts**
- **Found during:** Task 1
- **Issue:** The plan listed notebook element classes but not toolbar classes. The test file also used `.notebook-toolbar`, `.notebook-toolbar-btn`, `.notebook-toolbar-group`, `.notebook-toolbar-divider` (old names). The source uses `notebook-explorer__toolbar*` BEM names. These caused test failures.
- **Fix:** Applied same BEM rename pattern to toolbar classes during Task 1 replacement pass.
- **Files modified:** tests/ui/NotebookExplorer.test.ts
- **Commit:** 69cd6295

**2. [Rule 1 - Bug] Fixed string literal assertion for chart-card class**
- **Found during:** Task 1 verification
- **Issue:** One test assertion checked `expect(html).toContain('class="notebook-chart-card"')` — a string literal, not a querySelector, so the perl regex didn't catch it.
- **Fix:** Updated string literal to `'class="notebook-explorer__chart-card"'`.
- **Files modified:** tests/ui/NotebookExplorer.test.ts
- **Commit:** 69cd6295

## Known Stubs

None. All test selectors are now aligned with the live BEM-namespaced class names in the DOM.

## Self-Check: PASSED

- tests/ui/NotebookExplorer.test.ts: FOUND (modified)
- tests/ui/algorithm-explorer.test.ts: FOUND (modified)
- tests/views/network-view-legend.test.ts: FOUND (modified)
- tests/seams/ui/notebook-creation-flow.test.ts: FOUND (modified)
- tests/seams/ui/notebook-creation-shortcuts.test.ts: FOUND (modified)
- tests/seams/ui/notebook-shadow-buffer.test.ts: FOUND (modified)
- src/styles/notebook-explorer.css: FOUND (modified)
- Commit 69cd6295: FOUND
- Commit 05b1c9e3: FOUND
