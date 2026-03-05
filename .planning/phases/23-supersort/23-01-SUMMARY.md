---
phase: 23-supersort
plan: "01"
subsystem: supergrid-sort
tags: [sort-state, pafv-provider, persistence, interfaces, tdd]
dependency_graph:
  requires: []
  provides:
    - SortState class with cycle/addOrCycle semantics
    - SortEntry type exported from SortState.ts
    - PAFVProvider.getSortOverrides/setSortOverrides methods
    - PAFVProvider sortOverrides persistence round-trip
    - SuperGridProviderLike interface extended with getSortOverrides/setSortOverrides
  affects:
    - src/views/types.ts (SuperGridProviderLike interface extended)
    - src/providers/PAFVProvider.ts (state shape + methods added)
tech_stack:
  added: []
  patterns:
    - defensive copy pattern (SortState.getSorts(), PAFVProvider.getSortOverrides())
    - atomic validation before mutation (setSortOverrides validates all fields first)
    - backward-compat restoration (missing sortOverrides defaults to [])
    - axis-change state clear (setColAxes/setRowAxes reset sortOverrides)
key_files:
  created:
    - src/views/supergrid/SortState.ts
    - tests/views/supergrid/SortState.test.ts
  modified:
    - src/providers/PAFVProvider.ts
    - src/views/types.ts
    - tests/providers/PAFVProvider.test.ts
decisions:
  - "SortEntry defined in SortState.ts (not providers/types.ts) — SortState owns the type; PAFVProvider imports it"
  - "setSortOverrides is atomic — validates ALL fields before modifying state to prevent partial corrupt state"
  - "setColAxes/setRowAxes reset sortOverrides to [] — stale sorts meaningless after axis change (same pattern as colWidths)"
  - "isPAFVState reuses isAxisMapping guard for sortOverrides — SortEntry has identical shape to AxisMapping"
metrics:
  duration: "6 min"
  completed: "2026-03-05"
  tasks_completed: 2
  files_modified: 5
---

# Phase 23 Plan 01: SortState and PAFVProvider Sort Persistence Summary

SortState class (cycle/addOrCycle multi-sort with maxSorts cap) and PAFVProvider sortOverrides field with full JSON persistence round-trip and axis-change clearing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | SortState class with cycle and multi-sort semantics | bb985d65 | SortState.ts, SortState.test.ts |
| 2 | PAFVProvider sortOverrides + SuperGridProviderLike extension + persistence | 39bbd182 | PAFVProvider.ts, types.ts, PAFVProvider.test.ts |

## What Was Built

### Task 1: SortState

`src/views/supergrid/SortState.ts` provides:

- `SortEntry` interface: `{ field: AxisField; direction: 'asc' | 'desc' }`
- `SortState` class with two interaction modes:
  - `cycle(field)`: plain-click single-sort — `asc -> desc -> none`, replaces all existing sorts
  - `addOrCycle(field)`: cmd+click multi-sort — appends new fields, cycles existing in-place, removes on desc
- `maxSorts` cap (default 3) — silently blocks new fields when at capacity
- `getPriority(field)`: 1-indexed position, 0 if not sorted
- `getDirection(field)`: `'asc' | 'desc' | null`
- `hasActiveSorts()`: true when any sorts are active
- `getSorts()`: defensive copy
- `clear()`: removes all sorts
- Constructor accepts initial `SortEntry[]` for session restore

33 unit tests covering all behaviors.

### Task 2: PAFVProvider sortOverrides + SuperGridProviderLike

`src/providers/PAFVProvider.ts` updated with:

- `PAFVState.sortOverrides?: SortEntry[]` — optional field for backward compat
- `VIEW_DEFAULTS.supergrid.sortOverrides: []` — explicit default
- `getSortOverrides()`: returns `[...(this._state.sortOverrides ?? [])]`
- `setSortOverrides(sorts)`: validates all fields via `validateAxisField` (atomic), stores copy, calls `_scheduleNotify`
- `setColAxes()` + `setRowAxes()`: both reset `sortOverrides = []` after existing colWidths reset
- `setState()`: backward-compat restore — `Array.isArray` check, defaults to `[]`
- `isPAFVState()`: validates `sortOverrides` as optional array using existing `isAxisMapping` guard

`src/views/types.ts` updated with:
- `import type { SortEntry } from './supergrid/SortState'`
- `SuperGridProviderLike` extended with `getSortOverrides(): SortEntry[]` and `setSortOverrides(sorts: SortEntry[]): void`

15 new PAFVProvider tests (120 total passing).

## Decisions Made

1. `SortEntry` type lives in `src/views/supergrid/SortState.ts` (not `providers/types.ts`) because SortState owns the type. PAFVProvider imports it. This avoids circular imports since `AxisField` is already imported from `providers/types.ts` into `SortState.ts`.

2. `setSortOverrides` is atomic: validates ALL fields before modifying state. If any field is invalid, state is unchanged. This prevents partial corrupt state.

3. `setColAxes`/`setRowAxes` both reset `sortOverrides = []` — stale sorts are meaningless after axis changes produce different grouping columns. Same pattern and reasoning as `colWidths` reset.

4. `isPAFVState` reuses the existing `isAxisMapping` guard for `sortOverrides` validation — `SortEntry` has identical shape to `AxisMapping` (`{ field: string, direction: string }`), so no new guard needed.

## Deviations from Plan

None — plan executed exactly as written.

## Test Coverage

- SortState: 33 tests (all behaviors: cycle, addOrCycle, getPriority, getDirection, clear, hasActiveSorts, getSorts defensive copy, constructor session restore)
- PAFVProvider: 120 tests total (105 pre-existing + 15 new sort tests)
- All 153 tests pass with no regressions

## Self-Check

Files created/modified:
- src/views/supergrid/SortState.ts: FOUND
- tests/views/supergrid/SortState.test.ts: FOUND
- src/providers/PAFVProvider.ts: FOUND (modified)
- src/views/types.ts: FOUND (modified)
- tests/providers/PAFVProvider.test.ts: FOUND (modified)

Commits:
- bb985d65: feat(23-01): SortState class with cycle/addOrCycle multi-sort semantics
- 39bbd182: feat(23-01): PAFVProvider sortOverrides + SuperGridProviderLike extension

## Self-Check: PASSED

All files and commits verified present on disk.
