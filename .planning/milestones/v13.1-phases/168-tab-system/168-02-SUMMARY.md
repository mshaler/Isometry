---
phase: 168-tab-system
plan: "02"
subsystem: superwidget/ExplorerCanvas
tags: [tab-system, tests, tdd, jsdom, vitest]
dependency_graph:
  requires: [168-01]
  provides: [tab-system-tests]
  affects: [tests/superwidget/ExplorerCanvas.test.ts]
tech_stack:
  added: []
  patterns: [vi.fn spy, jsdom DOM assertion, MouseEvent dispatch]
key_files:
  created: []
  modified:
    - tests/superwidget/ExplorerCanvas.test.ts
decisions:
  - "11 tab system tests added inside describe('tab system') block — zero existing tests removed"
  - "baseProj constant defined at module scope for shared use across all tab test cases"
  - "MouseEvent with bubbles:true used to trigger tab bar event delegation listener"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-21T18:32:50Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 168 Plan 02: Tab System Tests Summary

11 unit tests for the ExplorerCanvas tab system covering container rendering, CSS class toggling, button active state, click → commitProjection dispatch, Apps stacking, and destroy cleanup — all using jsdom with vi.fn() spy.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add tab system tests to ExplorerCanvas.test.ts | e9cd21b9 | tests/superwidget/ExplorerCanvas.test.ts |

## What Was Built

- `describe('tab system')` block added to `tests/superwidget/ExplorerCanvas.test.ts` with 11 test cases
- `baseProj: Projection` constant at module scope (canvasType Explorer, activeTabId 'import-export', 3 enabledTabIds)
- `vi.fn()` commitProjection spy wired into each test's `ExplorerCanvas` constructor
- Tests cover:
  - 3 `[data-tab-container]` elements exist after mount
  - `[data-slot="tab-bar"]` has 3 `[data-tab-id]` buttons
  - `onProjectionChange(baseProj)` → import-export container has `.active` class
  - `onProjectionChange(baseProj)` → catalog and db-utilities containers do NOT have `.active`
  - `onProjectionChange({...activeTabId:'catalog'})` → catalog active, others not
  - `onProjectionChange({...activeTabId:'db-utilities'})` → db-utilities active, others not
  - `onProjectionChange({...activeTabId:'catalog'})` → `[data-tab-id="catalog"]` gets `data-tab-active="true"`, others lose it
  - Click on `[data-tab-id="catalog"]` → `commitSpy` called once with `{activeTabId:'catalog'}`
  - Click on already-active `[data-tab-id="import-export"]` → `commitSpy` NOT called
  - `[data-tab-container="import-export"]` contains >= 2 `.collapsible-section` elements (Import/Export + Apps per D-01)
  - `destroy()` → `.explorer-canvas`, `[data-slot="tab-bar"]`, `[data-tab-container]` all removed

## Decisions Made

- **baseProj at module scope** — shared across all tab tests to avoid repetition
- **beforeEach mounts canvas** — all tab tests start with a mounted canvas, reducing boilerplate
- **MouseEvent with bubbles:true** — required to trigger the tab-bar event delegation listener registered on `tabBar` element

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npx vitest run tests/superwidget/ExplorerCanvas.test.ts` — 20 tests pass (9 existing + 11 new)
- `npx vitest run tests/superwidget/` — 179 tests pass across 10 test files (zero regressions)
- ExplorerCanvas.test.ts contains `describe('tab system'` — confirmed
- ExplorerCanvas.test.ts contains `data-tab-container` assertions — confirmed
- ExplorerCanvas.test.ts contains `data-tab-active` assertions — confirmed
- ExplorerCanvas.test.ts contains `commitProjection` spy assertions — confirmed
- ExplorerCanvas.test.ts contains `.collapsible-section` assertion for Apps stacking — confirmed
- Test count in tab system block: 11 (> 8 minimum required)

## Known Stubs

None — tests exercise real ExplorerCanvas implementation with real DataExplorerPanel DOM.

## Self-Check: PASSED
