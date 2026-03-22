---
phase: 103-supercalc-v2-null-handling-filter-scope
plan: "02"
subsystem: pivot-plugins
tags: [supercalc, null-handling, aggregate, filter-scope, ui-controls, config-sidebar]
dependency_graph:
  requires: [103-01]
  provides: [scope-radio-toggle, null-mode-select, count-mode-select, getColConfig-tests]
  affects: [SuperCalcConfig, SuperCalc.test]
tech_stack:
  added: []
  patterns:
    - Scope fieldset with radio inputs for filter-aware vs full-dataset aggregation
    - Conditional select visibility (nullMode hidden for NONE, countMode shown only for COUNT)
    - Fn change handler drives both select visibility toggles atomically
key_files:
  created: []
  modified:
    - src/views/pivot/plugins/SuperCalcConfig.ts
    - tests/views/pivot/SuperCalc.test.ts
decisions:
  - "Scope fieldset persisted across re-renders (only col rows removed); radio state synced to sharedConfig.scope on each afterRender"
  - "nullSelect and countSelect appended inline with fn select in same row — no separate DOM rebuild required"
  - "getColConfig tests added to SuperCalc.test.ts (6 tests covering default, stored, and mixed lookups)"
metrics:
  duration_seconds: 180
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 2
requirements: [SC2-08, SC2-11, SC2-12, SC2-13, SC2-14, SC2-15]
---

# Phase 103 Plan 02: SuperCalc v2 UI Controls + Wiring Summary

SuperCalc v2 UI controls wired: scope radio fieldset, per-column null mode select, and COUNT sub-mode select added to SuperCalcConfig sidebar; 6 getColConfig tests added covering default and stored config retrieval.

## Tasks

### Task 1: FeatureCatalog wiring + SuperCalcConfig UI controls

**Status:** Complete
**Commit:** `311ce48d`
**Files:** `src/views/pivot/plugins/SuperCalcConfig.ts`

**What was built:**

SuperCalcConfig.ts additions:
- `NullMode`, `CountMode`, `ScopeMode` type imports from SuperCalcFooter
- `NULL_MODE_OPTIONS` and `COUNT_MODE_OPTIONS` constant arrays
- Scope toggle fieldset (`.hns-calc-scope`) with two radio inputs (`name="calc-scope"`) for 'view' and 'all' modes
- Fieldset inserted after section label on first render; radio checked state synced on subsequent renders
- Per-column null mode select (`.hns-calc-null-mode`): 3 options (Exclude nulls / Nulls as zero / Strict), hidden when fn === 'NONE'
- Per-column count mode select (`.hns-calc-count-mode`): 2 options (Non-null values / All rows), shown only when fn === 'COUNT'
- Fn select change handler: updates `sharedConfig.cols`, toggles both select visibility, calls `onConfigChange()`

Note: FeatureCatalog.ts was already updated in Plan 01 (CalcConfig construction with cols Map and scope 'view') — no changes needed.

### Task 2: Factory shape tests + config interaction tests

**Status:** Complete
**Commit:** `5131502a`
**Files:** `tests/views/pivot/SuperCalc.test.ts`

**What was built:**

- Added `getColConfig` import to test file
- Added `CalcConfig shape — getColConfig` describe block with 6 tests:
  - Returns default `{ fn: 'SUM', nullMode: 'exclude', countMode: 'column' }` for missing colIdx
  - Returns stored config when colIdx is present in map
  - Mixed scenario: missing entry returns default, present entry returns stored
  - Default nullMode is 'exclude'
  - Default countMode is 'column'

Note: Factory tests using CalcConfig were already present from Plan 01 — only getColConfig tests were new.

## Test Results

- SuperCalc.test.ts: 59/59 passing (6 new getColConfig tests + 53 from Plan 01)
- All pivot tests: 313/313 passing (+6 new tests from Plan 01's 307)
- TypeScript: 0 errors

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

Note: FeatureCatalog.ts Task 1 changes were already completed in Plan 01 as part of that plan's auto-fix scope migration. Verified existing state matched spec and skipped redundant changes.

## Self-Check: PASSED

- FOUND: src/views/pivot/plugins/SuperCalcConfig.ts (hns-calc-scope: 2 matches, hns-calc-null-mode: 1 match, hns-calc-count-mode: 1 match)
- FOUND: src/views/pivot/plugins/SuperCalcFooter.ts (WARNING_GLYPH: 2 matches, pv-warning: 2 matches)
- FOUND: tests/views/pivot/SuperCalc.test.ts (getColConfig tests: 6 new tests)
- FOUND: commit 311ce48d (Task 1 — UI controls)
- FOUND: commit 5131502a (Task 2 — tests)
- All 313 pivot tests passing, TypeScript 0 errors
