---
phase: 158-explorer-accessibility-event-delegation
plan: "02"
subsystem: ui-accessibility
tags: [accessibility, aria, event-delegation, ProjectionExplorer, CalcExplorer, PropertiesExplorer]
dependency_graph:
  requires: []
  provides: [EXPX-02, EXPX-03, EXPX-10]
  affects: [src/ui/ProjectionExplorer.ts, src/ui/CalcExplorer.ts, src/ui/PropertiesExplorer.ts]
tech_stack:
  added: []
  patterns: [aria-label on role=listbox, htmlFor/id label association, event delegation via bubbling]
key_files:
  created:
    - tests/seams/ui/explorer-a11y.test.ts
  modified:
    - src/ui/ProjectionExplorer.ts
    - src/ui/CalcExplorer.ts
    - src/ui/PropertiesExplorer.ts
decisions:
  - "aria-label uses label + ' fields' pattern producing 'Available fields', 'X fields', 'Y fields', 'Z fields'"
  - "CalcExplorer select id uses 'calc-select-{field}' stable pattern; aria-label retained as fallback"
  - "PropertiesExplorer delegation reads data-field from closest .properties-explorer__property row"
metrics:
  duration_minutes: 21
  completed: "2026-04-18"
  tasks_completed: 2
  files_modified: 4
---

# Phase 158 Plan 02: Explorer Accessibility + Event Delegation Summary

One-liner: Accessible aria-labels on ProjectionExplorer wells, label/select id association in CalcExplorer, and single delegated change listener replacing per-checkbox handlers in PropertiesExplorer.

## What Was Built

### Task 1: ProjectionExplorer aria-labels + CalcExplorer label association (EXPX-02, EXPX-03)

**ProjectionExplorer** (`src/ui/ProjectionExplorer.ts`): Added `body.setAttribute('aria-label', label + ' fields')` immediately after the existing `role="listbox"` attribute in `mount()`. The `label` variable comes from `WELL_CONFIGS` (Available, X, Y, Z), producing "Available fields", "X fields", "Y fields", "Z fields".

**CalcExplorer** (`src/ui/CalcExplorer.ts`): In `_render()`, generated stable select id `'calc-select-' + field`, set `select.id = selectId` and `label.htmlFor = selectId`. The existing `aria-label` attribute is retained as a fallback for screen readers that do not follow htmlFor.

### Task 2: PropertiesExplorer checkbox event delegation (EXPX-10)

**PropertiesExplorer** (`src/ui/PropertiesExplorer.ts`): Added a single delegated `change` listener on `bodyEl` in `_createColumn()`. The listener:
1. Guards against non-INPUT or non-checkbox targets
2. Walks up to `.properties-explorer__property` via `closest()`
3. Reads `data-field` attribute and calls `_handleToggle(field)`

Removed the `checkbox.addEventListener('change', ...)` call from both the D3 `enter` path and the `update` path in `_renderColumnProperties()`. The checkbox `checked` state is still set from `_enabledFields.has(field)` on both paths.

## Tests

Created `tests/seams/ui/explorer-a11y.test.ts` (10 tests, 372 lines):
- `EXPX-02a-d`: 4 tests verifying each well body has correct `aria-label`
- `EXPX-03a-c`: 3 tests verifying label/select association via htmlFor/id, aria-label fallback, stable id pattern
- `EXPX-10a-c`: 3 tests verifying delegation triggers toggle, bubbling works, non-checkbox events are ignored

All 10 tests pass. Full unit suite: 8528 tests pass with 0 regressions (failures are pre-existing in `.claude/worktrees/` and profiling benchmarks).

## Verification

- `npx vitest run tests/seams/ui/explorer-a11y.test.ts`: 10/10 pass
- `npx tsc --noEmit`: 0 errors
- Full unit suite: 8528 passed, 0 new failures

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- tests/seams/ui/explorer-a11y.test.ts: FOUND
- src/ui/ProjectionExplorer.ts: FOUND (aria-label attribute added)
- src/ui/CalcExplorer.ts: FOUND (htmlFor/id added)
- src/ui/PropertiesExplorer.ts: FOUND (delegated listener added, per-checkbox removed)
- Commits: 6a70826c (RED test), 0de07553 (Task 1 GREEN), 6ebbeafc (Task 2 GREEN)
