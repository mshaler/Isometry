---
phase: 130-foundation
plan: 01
subsystem: StateManager
tags: [namespacing, persistence, dataset-isolation, migration, preset-guard]
dependency_graph:
  requires: []
  provides: [per-dataset-ui-state-isolation, flat-key-migration, preset-prefix-guard, setActiveDataset-api]
  affects: [src/providers/StateManager.ts, src/main.ts]
tech_stack:
  added: []
  patterns: [scoped-vs-global-provider-registry, storage-key-namespacing, flat-key-migration, dataset-switch-lifecycle]
key_files:
  created:
    - tests/providers/StateManager.namespace.test.ts
  modified:
    - src/providers/StateManager.ts
    - src/main.ts
decisions:
  - "Scoped keys use {providerKey}:{datasetId} format (e.g., pafv:ds1) in ui_state table"
  - "initActiveDataset() sets ID at boot without triggering persist/restore (synchronous)"
  - "setActiveDataset() does full lifecycle: persist-current, reset-scoped, restore-new"
  - "flat legacy key migration happens in restore() and _restoreScoped() transparently"
  - "Global providers (theme) are never touched during dataset switch"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-27T16:34:20Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 130 Plan 01: StateManager Dataset-Scoped Key Namespacing Summary

Per-dataset ui_state key namespacing in StateManager with flat-key migration and preset prefix guard, enabling v10.0 dataset state isolation.

## What Was Built

**Task 1: StateManager scoped/global registration, namespaced persist/restore, preset guard, migration**

Extended `StateManager` with:
- `registerProvider(key, provider, options?)` — optional `{ scoped: true }` marks provider as dataset-scoped; throws if key starts with `preset:`
- `_scopedKeys: Set<string>` — tracks which providers use namespaced storage
- `_activeDatasetId: string | null` — tracks current dataset context
- `initActiveDataset(id)` — synchronous boot-time setter (no persist/restore side effects)
- `setActiveDataset(id)` — async lifecycle: persists current scoped state, resets scoped providers to defaults, restores new dataset's scoped state
- `_storageKey(key)` — computes `{key}:{datasetId}` for scoped, `{key}` for global
- `_persist()` — now uses `_storageKey()` for namespace-aware writes
- `restore()` — namespace-aware: scoped providers match `{key}:{datasetId}`, with flat-key migration (writes namespaced, deletes flat)
- `_restoreScoped()` — private helper used by `setActiveDataset()` to restore only scoped providers

**Task 2: Wire into main.ts boot and dataset switch**

- All 5 scoped providers registered with `{ scoped: true }`: filter, pafv, density, superDensity, alias
- `theme` remains global (no option)
- Boot sequence: query active dataset ID via bridge → `sm.initActiveDataset(id)` → `sm.restore()`
- `handleDatasetSwitch()`: replaced manual `filter.resetToDefaults()` + `pafv.resetToDefaults()` with `await sm.setActiveDataset(datasetId)`

## Tests

16 new tests in `tests/providers/StateManager.namespace.test.ts`:
- preset guard: throws for `preset:foo`, `preset:`, not for `pafv`
- scoped registration: persist uses `pafv:ds1` key
- global registration: persist uses flat `theme` key
- markDirty: namespaced for scoped, flat for global
- restore: matches correct dataset's namespaced row only
- restore: flat-key migration writes namespaced + deletes flat
- restore: no re-migration when namespaced key already exists
- setActiveDataset: persists old dataset state
- setActiveDataset: resets scoped providers before restoring new
- setActiveDataset: global providers untouched during switch
- setActiveDataset: no persist when switching from null

142 total StateManager tests pass (31 existing + 11 migration + 16 namespace + 84 from other test files).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/providers/StateManager.ts: FOUND
- tests/providers/StateManager.namespace.test.ts: FOUND
- src/main.ts: FOUND
- commit 79c76d7c: FOUND
- commit c3696605: FOUND
