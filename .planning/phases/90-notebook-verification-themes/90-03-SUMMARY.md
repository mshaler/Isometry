---
phase: 90-notebook-verification-themes
plan: "03"
subsystem: persistence
tags: [state-manager, theme-persistence, sample-data, refresh, ui-state]
dependency_graph:
  requires:
    - phase: 90-01
      provides: refreshDataExplorer() wired to DataExplorerPanel with recent cards
    - phase: 90-02
      provides: ThemeProvider with nextstep/material themes + ThemeMode type
  provides:
    - Theme preference persisted via StateManager/ui_state across page reload
    - DataExplorer recent cards updated after sample data load
  affects:
    - src/main.ts
tech_stack:
  added: []
  patterns:
    - "sm.registerProvider(key, provider) pattern extended to ThemeProvider — any PersistableProvider can join StateManager"
    - "void refreshDataExplorer() call pattern at end of all import/load paths for consistent post-load state"
key_files:
  created: []
  modified:
    - src/main.ts
decisions:
  - "ThemeProvider registered with StateManager (not just StateCoordinator) — StateManager writes to ui_state for persistence, StateCoordinator only signals reactivity"
  - "refreshDataExplorer() placed as last statement in onLoadSample block — same position as all other import paths (file drop, importFile, importNative, vacuum)"
metrics:
  duration: "4m"
  completed: "2026-03-18"
  tasks_completed: 1
  files_modified: 1
requirements_completed: [DBUT-02, DBUT-03, THME-03]
---

# Phase 90 Plan 03: Sample-Load Refresh + Theme Persistence Summary

Two targeted fixes in src/main.ts closing the 2 remaining UAT gaps: theme preference not persisting across reload, and Recent Cards list not updating after sample data load.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix sample-load refresh + theme persistence | f5867ed4 | src/main.ts |

## What Was Built

### Two Targeted Edits in src/main.ts

**Edit A — Theme Persistence (line 225):**

Added `sm.registerProvider('theme', theme)` in the StateManager registration block, immediately after `sm.registerProvider('alias', alias)` and before `await sm.restore()`.

Before this fix, `theme` was only registered with `coordinator` (StateCoordinator — reactive signaling) but not with `sm` (StateManager — ui_state persistence). The `sm.restore()` call on boot would never read ThemeProvider state, and `sm.enableAutoPersist()` would never write it. Adding the registration makes ThemeProvider a full participant in the persistence lifecycle.

**Edit B — Sample Load Refresh (line 903):**

Added `void refreshDataExplorer()` as the last statement inside the `onLoadSample` async IIFE, after the `viewManager.switchTo()` call.

Every other card-loading path in main.ts already called `refreshDataExplorer()`:
- File drop (~line 649)
- `importFile` wrapper (~line 1105)
- `importNative` wrapper (~line 1127)
- Vacuum (~line 628)

The `onLoadSample` path was the only one missing it. Adding it ensures DB Utilities stats and Recent Cards list update whenever a sample dataset is loaded.

## Acceptance Criteria Verification

- `grep "sm.registerProvider('theme', theme)" src/main.ts` — 1 match at line 225, before `await sm.restore()` at line 226 ✓
- `grep -n "refreshDataExplorer" src/main.ts | grep 903` — match at line 903 inside onLoadSample handler ✓
- `npx vitest run` — 3488 passed, 7 pre-existing failures (CommandBar input placeholder x3, dataset-eviction x4) — no new failures ✓
- TypeScript — my two additions are type-clean; pre-existing errors in test files and SuperGrid.ts are out of scope ✓

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Issues (Out of Scope)

- `tests/ui/CommandBar.test.ts > command input placeholder` (3 tests): Never-implemented feature, pre-existing since Phase 90-02
- `tests/seams/ui/dataset-eviction.test.ts` (4 tests): Pre-existing SQL constraint failures, documented in 90-02-SUMMARY.md
- TypeScript errors in tests/seams/ui/calc-explorer.test.ts, tests/seams/ui/supergrid-depth-wiring.test.ts, tests/views/GalleryView.test.ts, src/views/SuperGrid.ts, src/main.ts:772 — all pre-existing, unrelated to this plan's changes

## Self-Check: PASSED

- FOUND: src/main.ts (modified)
- FOUND commit: f5867ed4
- Verified: sm.registerProvider('theme', theme) at line 225, before sm.restore() at line 226
- Verified: void refreshDataExplorer() at line 903 inside onLoadSample handler
