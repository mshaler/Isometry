---
phase: 161-explorer-layout-constraints
plan: "02"
subsystem: ui/panels
tags: [panel-manager, dismiss-bar, forward-declarations, LAYT-03, LAYT-04]
dependency_graph:
  requires: []
  provides: [dismiss-bar-injection, forward-declaration-block]
  affects: [src/ui/panels/PanelManager.ts, src/styles/workbench.css, src/main.ts]
tech_stack:
  added: []
  patterns: [mount-once dismiss bar, forward-declaration TDZ guard]
key_files:
  created: []
  modified:
    - src/ui/panels/PanelManager.ts
    - src/styles/workbench.css
    - src/main.ts
    - tests/seams/ui/PanelManager.test.ts
decisions:
  - "Dismiss bar uses .panel-dismiss-bar / .panel-dismiss-bar__close class names (matching existing worktree implementation)"
  - "Dismiss bar prepended as first child of slot.container inside the !_mounted guard (mount-once, no double-inject)"
  - "viewManager, calcExplorer, algorithmExplorer consolidated into FORWARD DECLARATIONS block before viewFactory"
metrics:
  duration: "pre-committed"
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_changed: 4
---

# Phase 161 Plan 02: Dismiss Bar + Forward Declaration Consolidation Summary

PanelManager.show() injects a .panel-dismiss-bar with close button on first mount (mount-once guard), and viewManager/calcExplorer/algorithmExplorer moved into the FORWARD DECLARATIONS block.

## What Was Built

### Task 1: Inject dismiss bar in PanelManager.show() + CSS + tests

Modified `PanelManager.show()` to inject a dismiss bar as the first child of `slot.container` inside the `!this._mounted.has(id)` guard. The dismiss bar contains a close button that calls `this.hide(id)` on click. Since injection happens inside the mount-once guard, no duplicate bars are created on re-show.

Added CSS in `workbench.css` for `.panel-dismiss-bar` and `.panel-dismiss-bar__close` with hover and focus-visible styles.

Added 3 new tests to `PanelManager.test.ts`:
- Test 9: show() injects exactly one .panel-dismiss-bar on first mount
- Test 10: show() called twice does NOT inject a second dismiss bar
- Test 11: clicking dismiss bar close button calls hide(id)

### Task 2: Consolidate forward declarations in main.ts

Moved `let viewManager: ViewManager`, `let calcExplorer: CalcExplorer | null = null`, and `let algorithmExplorer: AlgorithmExplorer | null = null` into the existing FORWARD DECLARATIONS block (lines ~317-335), consolidating all closure-captured variables in one place with the TDZ prevention rule comment.

## Verification

- All 13 PanelManager tests pass (10 existing + 3 new dismiss bar tests)
- TypeScript compiles with no errors (`npx tsc --noEmit` clean)
- grep confirms dismiss bar injection in PanelManager.show(): `bar.className = 'panel-dismiss-bar'`
- grep confirms calcExplorer and algorithmExplorer in FORWARD DECLARATIONS block
- No duplicate dismiss bars on show-hide-show cycle

## Deviations from Plan

None - plan executed exactly as written. The CSS class names used are `panel-dismiss-bar` / `panel-dismiss-bar__close` (matching the worktree implementation) vs the plan's suggested `panel-dismiss` / `panel-dismiss__close` — both naming conventions are functionally equivalent and the tests validate the actual implementation.

## Key Commits

- `0de83906`: feat(161-02): dismiss bar on explorer panels + forward declaration consolidation

## Self-Check: PASSED

- src/ui/panels/PanelManager.ts — FOUND (has `panel-dismiss-bar` class injection)
- src/styles/workbench.css — FOUND (has `.panel-dismiss-bar` styles)
- src/main.ts — FOUND (has calcExplorer, algorithmExplorer in FORWARD DECLARATIONS block)
- tests/seams/ui/PanelManager.test.ts — FOUND (has 3 dismiss bar tests)
- commit 0de83906 — FOUND
