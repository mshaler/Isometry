---
phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction
plan: 01
subsystem: workbench-ui
tags: [bug-fix, css, specificity, collapsible-section, regression-test]
dependency_graph:
  requires: []
  provides: [CHEV-01, CHEV-02, CHEV-03, CHEV-04, CHEV-05]
  affects: [src/styles/workbench.css, tests/ui/CollapsibleSection.test.ts]
tech_stack:
  added: []
  patterns: [css-specificity-guard, tdd-regression]
key_files:
  created: []
  modified:
    - src/styles/workbench.css
    - tests/ui/CollapsibleSection.test.ts
decisions:
  - "Use :not(.collapsible-section--collapsed) guard on :has() rules to prevent same-specificity source-order override of collapsed max-height: 0"
  - "Add explicit .collapsible-section--collapsed .collapsible-section__body--has-explorer { max-height: 0 } override to beat class-based has-explorer rule"
metrics:
  duration: 1m
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_changed: 2
---

# Phase 85 Plan 01: Chevron Collapse CSS Specificity Fix Summary

**One-liner:** Fixed CSS specificity bug where `:has()` explorer rules (0,2,0 specificity) overrode the collapsed `max-height: 0` rule (also 0,2,0) via source order, by adding `:not(.collapsible-section--collapsed)` guards and an explicit `--has-explorer` collapsed override.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Fix CSS specificity so collapsed state overrides explorer max-height | 75cba183 | src/styles/workbench.css |
| 2 | Add regression test for explorer-backed section collapse | 36cdc8e6 | tests/ui/CollapsibleSection.test.ts |

## What Was Built

**Task 1 — CSS fix:**

The root cause was a CSS specificity conflict in `workbench.css`:

- `.collapsible-section--collapsed .collapsible-section__body { max-height: 0 }` — specificity 0,2,0
- `.collapsible-section__body:has(> .properties-explorer)` etc. — specificity 0,2,0 — appeared LATER in source order, so it won

Fix applied:
1. Added `:not(.collapsible-section--collapsed) >` prefix on all five `:has()` explorer rules — these now only apply when not collapsed
2. Added `.collapsible-section--collapsed .collapsible-section__body--has-explorer { max-height: 0 }` — explicit override beats the class-based `--has-explorer` rule (0,2,0 vs 0,1,0)

**Task 2 — Regression tests (TDD GREEN — implementation already correct, CSS was the only bug):**

Three new tests in `describe('explorer-backed collapse regression (Phase 85)')`:
1. Collapsing a section with explorer content adds collapsed class to root
2. Expanding a collapsed explorer section removes collapsed class
3. Body retains `--has-explorer` class when collapsed (CSS uses both classes together)

All 42 tests pass.

## Verification

- `npx vitest run tests/ui/CollapsibleSection.test.ts` — 42/42 pass
- CSS contains correct specificity chain: collapsed state always overrides explorer max-height
- Pre-existing TypeScript errors in unrelated test files (calc-explorer, GalleryView) — out of scope

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/styles/workbench.css` modified with correct specificity chain
- [x] `tests/ui/CollapsibleSection.test.ts` contains `explorer-backed collapse regression` describe block
- [x] Commit 75cba183 exists (CSS fix)
- [x] Commit 36cdc8e6 exists (regression tests)
