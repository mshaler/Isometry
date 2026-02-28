---
phase: 04-providers-mutationmanager
plan: "07"
subsystem: mutations-providers-integration
tags: [keyboard-shortcuts, sql-injection, persistence, public-api, integration]
dependency_graph:
  requires: [04-05, 04-06]
  provides: [MUT-07, PROV-02]
  affects: [src/index.ts, src/mutations/index.ts]
tech_stack:
  added: []
  patterns:
    - Platform-aware keyboard shortcut registration (Mac: metaKey, non-Mac: ctrlKey)
    - Input field guard (INPUT/TEXTAREA/contentEditable skip) on keyboard handlers
    - SQL safety model: allowlist validation at write-time + re-validation at compile-time
    - Persistence round-trip testing with mock WorkerBridge (no real Worker)
key_files:
  created:
    - src/mutations/shortcuts.ts
    - tests/mutations/shortcuts.test.ts
    - tests/providers/sql-injection.test.ts
    - tests/providers/persistence.test.ts
  modified:
    - src/mutations/index.ts
    - src/index.ts
decisions:
  - setupMutationShortcuts() reads navigator.platform at call time (not module load) allowing test stubs to override it
  - Test environment is 'node' not 'jsdom' — document stubbed via vi.stubGlobal() with a minimal object
  - SQL injection "double-validation" tests bypass addFilter via _filters (public property) to test compile() as second line of defence
  - persistence.test.ts uses StateManager.markDirty() + vi.runAllTimers() + vi.waitFor() pattern (matches StateManager debounce architecture)
metrics:
  duration_seconds: 275
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_changed: 7
---

# Phase 4 Plan 07: Keyboard Shortcuts, SQL Injection Suite, and Phase 4 Integration Summary

One-liner: Keyboard shortcut registration (Cmd+Z/Ctrl+Z undo, Cmd+Shift+Z/Ctrl+Y redo) with comprehensive SQL injection test suite and full Phase 4 public API wiring via src/index.ts.

## What Was Built

### Task 1: Keyboard Shortcuts + SQL Injection Suite (TDD)

**`src/mutations/shortcuts.ts`** — `setupMutationShortcuts(manager)`:
- Detects Mac vs non-Mac via `navigator.platform.includes('Mac')`
- Mac: `metaKey+Z` → undo, `metaKey+Shift+Z` → redo
- Non-Mac: `ctrlKey+Z` → undo, `ctrlKey+Shift+Z` or `ctrlKey+Y` → redo
- Calls `event.preventDefault()` on matched shortcuts
- Guards against INPUT, TEXTAREA, and `contentEditable` elements
- Returns cleanup function that removes the keydown listener

**`tests/mutations/shortcuts.test.ts`** — 22 tests:
- Listener registration and cleanup
- Mac shortcuts (metaKey)
- Non-Mac shortcuts (ctrlKey)
- Input field guard (INPUT, TEXTAREA, contentEditable)
- Unrelated keys (no false positives)

**`tests/providers/sql-injection.test.ts`** — 24 tests (PROV-02/SAFE-06):
- FilterProvider value safety: 7 cases (DROP TABLE, Bobby Tables, escaped quotes, double-dash, semicolons, UNION, nested quotes)
- FilterProvider field allowlist: 4 cases (unknown field, SQL injection as field, empty string, wildcard)
- FilterProvider operator allowlist: 3 cases (UNION SELECT, raw SQL as operator, injection string)
- PAFVProvider axis field allowlist: 4 cases (x-axis, y-axis, groupBy injection, JSON-restored bypass → compile() catches)
- DensityProvider strftime safety: 4 cases (valid strftime output, invalid timeField, invalid granularity, cross-product test)
- FilterProvider double-validation: 2 cases (compile() catches bypassed addFilter via direct _filters mutation)

### Task 2: Integration Wiring + Public API

**`src/mutations/index.ts`** — Added `setupMutationShortcuts` re-export

**`src/index.ts`** — Added Phase 4 re-exports:
- Providers: `FilterProvider`, `PAFVProvider`, `SelectionProvider`, `DensityProvider`, `StateCoordinator`, `StateManager`, `QueryBuilder`, plus allowlist utilities
- Provider types: `FilterField`, `FilterOperator`, `AxisField`, `SortDirection`, `TimeGranularity`, `ViewType`, `ViewFamily`, `Filter`, `AxisMapping`, `CompiledFilter`, `CompiledAxis`, `CompiledDensity`, `PersistableProvider`, `CompiledQuery`, `CardQueryOptions`
- Mutations: `MutationManager`, `setupMutationShortcuts`, `createCardMutation`, `updateCardMutation`, `deleteCardMutation`, `createConnectionMutation`, `deleteConnectionMutation`, `batchMutation`
- Mutation types: `MutationCommand`, `Mutation`, `MutationBridge`

**`tests/providers/persistence.test.ts`** — 6 integration tests:
- FilterProvider round-trip (persist + restore)
- Empty store handling (no stored key → defaults)
- PAFVProvider round-trip
- DensityProvider round-trip
- Multi-provider round-trip (3 providers simultaneously)
- Corruption isolation (corrupt filter JSON resets only filter, axis preserved)

## Test Results

| Domain | Tests | Status |
|--------|-------|--------|
| Shortcuts | 22 | PASS |
| SQL injection | 24 | PASS |
| Persistence | 6 | PASS |
| Full suite | 647 | PASS |
| TypeScript | tsc --noEmit | CLEAN |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Persistence integration test added (not in original task list)**
- **Found during:** Task 2
- **Issue:** Plan specified `tests/providers/persistence.test.ts` in `files_modified` but no explicit task for it
- **Fix:** Created as part of Task 2 integration wiring
- **Files modified:** `tests/providers/persistence.test.ts`
- **Commit:** bed5f60

**2. [Rule 1 - Bug] TypeScript type error in shortcuts.test.ts**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** `makeKeyEvent` target parameter typed as `Partial<HTMLElement>` which requires EventTarget properties
- **Fix:** Changed to `{ tagName?: string; isContentEditable?: boolean }` plain object type
- **Files modified:** `tests/mutations/shortcuts.test.ts`
- **Commit:** bed5f60

**3. [Rule 1 - Bug] SQL injection "double-validation" tests needed _filters direct access**
- **Found during:** Task 1 (RED phase)
- **Issue:** FilterProvider.setState() validates fields/operators before storing, so tests using setState() to inject invalid state threw in setState() not compile()
- **Fix:** Tests use `provider._filters.push()` directly (bypassing setState) to verify compile() as the second line of defence
- **Files modified:** `tests/providers/sql-injection.test.ts`
- **Commit:** 91b667f

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/mutations/shortcuts.ts | FOUND |
| tests/mutations/shortcuts.test.ts | FOUND |
| tests/providers/sql-injection.test.ts | FOUND |
| tests/providers/persistence.test.ts | FOUND |
| Commit 91b667f (Task 1) | FOUND |
| Commit bed5f60 (Task 2) | FOUND |
| 647 tests passing | VERIFIED |
| tsc --noEmit clean | VERIFIED |
