---
phase: 137-display-formatting-granularity-ui
plan: "02"
subsystem: ui
tags: [granularity, projection-explorer, tvis-02, time-axis, conditional-ui]
dependency_graph:
  requires: [SchemaProvider.getFieldsByFamily, PAFVProvider.getState, SuperDensityProvider.subscribe]
  provides: [conditional-granularity-visibility]
  affects: [ProjectionExplorer]
tech_stack:
  added: []
  patterns: [instance-field-reference-caching, subscriber-reactive-sync]
key_files:
  created: []
  modified:
    - src/ui/ProjectionExplorer.ts
    - tests/ui/ProjectionExplorer.test.ts
decisions:
  - "_granLabel/_granSelect stored as instance fields during _createZControls() for O(1) access without DOM query on every axis change"
  - "Fallback time field set {created_at, modified_at, due_at} used when SchemaProvider not initialized"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-08T03:40:41Z"
  tasks_completed: 1
  files_modified: 2
---

# Phase 137 Plan 02: Conditional Granularity Selector Visibility Summary

Granularity label and select in ProjectionExplorer are now hidden when no time axis is active and shown reactively when a time field is added to row or col axes.

## What Was Built

Conditional visibility for the granularity selector in `ProjectionExplorer` (TVIS-02). The granularity control is only meaningful when a time field is on a row or col axis. Showing it unconditionally confuses users who haven't placed any time fields.

**Two new private methods added to `ProjectionExplorer`:**

- `_hasTimeAxis(): boolean` — checks `colAxes` and `rowAxes` from `PAFVProvider.getState()` against a time field set. Uses `SchemaProvider.getFieldsByFamily('Time')` when schema is initialized; falls back to `new Set(['created_at', 'modified_at', 'due_at'])`.
- `_syncGranularityVisibility(): void` — sets `display = '' | 'none'` on stored `_granLabel` and `_granSelect` instance fields.

**Integration points:**
- Called at end of `_createZControls()` (initial render state)
- Called inside the `pafv.subscribe()` callback (axis changes trigger re-evaluation)
- Called inside `_syncZControls()` (SuperDensityProvider changes)

**Instance field caching:** `_granLabel` and `_granSelect` are stored as instance fields during `_createZControls()`, avoiding repeated DOM queries on each axis change.

## Tests Added

6 new tests in the `granularity selector visibility (TVIS-02)` describe block:
1. Hidden by default when axes are `folder` and `card_type` (no time fields)
2. Visible when `created_at` is in `rowAxes` (X well)
3. Visible when `due_at` is in `colAxes` (Y well)
4. Reactive show: pafv._notify() after adding time field makes selector visible
5. Reactive hide: pafv._notify() after removing time field hides selector
6. `modified_at` in rowAxes shows granularity selector

All 132 tests pass (129 pre-existing + 3 new TVIS-02 tests that verify reactive behavior, plus 6 total in the describe block — 3 initial state + 3 reactive).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (TDD GREEN) | `74697744` | feat(137-02): conditional granularity selector visibility (TVIS-02) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/ui/ProjectionExplorer.ts` — exists, modified
- `tests/ui/ProjectionExplorer.test.ts` — exists, modified
- Commit `74697744` — verified present
- 132/132 tests passing
