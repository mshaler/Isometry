---
phase: 145-section-defs-extraction-regression-baseline
plan: "01"
subsystem: ui-navigation
tags: [extraction, refactor, regression-tests, keyboard-shortcuts, section-defs]
dependency_graph:
  requires: []
  provides: [section-defs-module, shortcut-regression-suite]
  affects: [SidebarNav, main-entry, phase-146-docknav]
tech_stack:
  added: [src/ui/section-defs.ts]
  patterns: [module-extraction, two-level-regression-tests]
key_files:
  created:
    - src/ui/section-defs.ts
    - tests/shortcuts/shortcut-regression.test.ts
  modified:
    - src/ui/SidebarNav.ts
    - src/main.ts
decisions:
  - "SidebarItemDef and SidebarSectionDef moved to section-defs.ts as exported interfaces (D-02)"
  - "viewOrder typed as readonly ViewType[] in section-defs.ts; main.ts uses top-level import (D-03)"
  - "DOCK_DEFS defined alongside SECTION_DEFS in same module for Phase 146 consumption (D-04, D-05)"
  - "Integration tests mock switchTo(viewType) directly — factory not replicated in test context (D-06)"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 145 Plan 01: SECTION_DEFS Extraction + Regression Baseline Summary

**One-liner:** Mechanical extraction of SECTION_DEFS/viewOrder into dedicated section-defs.ts module with DOCK_DEFS taxonomy stub and 20 individual Cmd+1-9 regression tests at unit+integration levels.

## What Was Built

### Task 1: section-defs.ts extraction

Created `src/ui/section-defs.ts` as the single source of truth for all navigation constants:
- `SidebarItemDef` and `SidebarSectionDef` interfaces (moved from SidebarNav.ts)
- `SECTION_DEFS` array (moved from SidebarNav.ts, typed `readonly SidebarSectionDef[]`)
- `viewOrder` array (moved from main.ts, typed `readonly ViewType[]`)
- `DockSectionDef` interface and `DOCK_DEFS` array (new — Phase 146 verb-noun taxonomy)

Updated `src/ui/SidebarNav.ts`:
- Removed local `SidebarItemDef`, `SidebarSectionDef` interfaces and `SECTION_DEFS` const
- Added `import { SECTION_DEFS, type SidebarItemDef, type SidebarSectionDef } from './section-defs'`
- Zero local key string literals or section definitions remain

Updated `src/main.ts`:
- Removed local `viewOrder: ViewType[]` const array
- Added `import { viewOrder } from './ui/section-defs'`
- Shortcut loop and command loop continue referencing `viewOrder` unchanged

### Task 2: Cmd+1-9 regression tests

Created `tests/shortcuts/shortcut-regression.test.ts` with 20 test cases:
- 2 `viewOrder` alignment checks (length=9, exact order)
- 9 unit tests (one per Cmd+N): verifies exactly one handler fires, all other 8 silent
- 9 integration tests (one per Cmd+N): verifies `setActiveItem('visualization', viewType)` and `switchTo(viewType)` called with correct args

## Verification

- `npx tsc --noEmit` exits 0 (zero TypeScript errors)
- `npx vitest run tests/shortcuts/shortcut-regression.test.ts` — 20/20 pass
- `grep -c 'const SECTION_DEFS' src/ui/SidebarNav.ts` = 0
- `grep -c 'const viewOrder' src/main.ts` = 0
- All pre-existing unit tests continue to pass (failures are pre-existing bench/e2e/build tests)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | dbcd425c | feat(145-01): extract SECTION_DEFS, viewOrder, DOCK_DEFS into section-defs.ts |
| 2 | b0bc6d85 | test(145-01): add Cmd+1-9 shortcut regression tests (unit + integration) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully populated data constants. DOCK_DEFS is intentionally forward-declared for Phase 146 consumption and is complete per the plan specification.

## Self-Check: PASSED

- `src/ui/section-defs.ts` exists: FOUND
- `tests/shortcuts/shortcut-regression.test.ts` exists: FOUND
- Commit dbcd425c: FOUND
- Commit b0bc6d85: FOUND
