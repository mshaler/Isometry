---
phase: 177-tab-persistence
plan: "01"
subsystem: superwidget-persistence
tags: [tdd, persistence, state-manager, superwidget]
dependency_graph:
  requires: [176-02]
  provides: [SuperWidgetStateProvider, StateManager.restoreKey]
  affects: [StateManager, SuperWidget boot sequence]
tech_stack:
  added: []
  patterns: [PersistableProvider, queueMicrotask batching, per-key delayed restore]
key_files:
  created:
    - src/superwidget/SuperWidgetStateProvider.ts
    - tests/superwidget/SuperWidgetStateProvider.test.ts
    - tests/providers/StateManager.restoreKey.test.ts
  modified:
    - src/providers/StateManager.ts
decisions:
  - SuperWidgetStateProvider uses queueMicrotask batching (same as PAFVProvider) for subscriber notifications
  - setState/resetToDefaults do NOT notify subscribers (snap-to-state pattern on restore)
  - restoreKey() fetches all ui_state rows via ui:getAll then picks the single key — minimal bridge calls
  - isTabStateShape type guard validates tab entries have tabId (string), label (string), and projection (object)
metrics:
  duration: 142s
  completed: "2026-04-22"
  tasks_completed: 1
  files_changed: 4
---

# Phase 177 Plan 01: SuperWidgetStateProvider + StateManager.restoreKey Summary

**One-liner:** PersistableProvider for tab state with queueMicrotask-batched notifications and per-key delayed StateManager restore.

## What Was Built

**SuperWidgetStateProvider** (`src/superwidget/SuperWidgetStateProvider.ts`)

A `PersistableProvider` implementation wrapping `TabSlot[] + activeTabSlotId`. Follows the PAFVProvider template exactly:
- `toJSON()` serializes `{ tabs, activeTabSlotId }` to JSON string
- `setState(state)` type-guards via `isTabStateShape()`, throws on invalid shape, does NOT notify (snap-to-state)
- `resetToDefaults()` creates one tab via `makeTabSlot()`, does NOT notify
- `subscribe(callback)` / `_scheduleNotify()` with `queueMicrotask` batching — multiple synchronous `setTabs()` calls produce one subscriber notification per tick
- `setTabs(tabs, activeId)` / `getTabs()` / `getActiveTabSlotId()` mutation and accessor API

**StateManager.restoreKey** (`src/providers/StateManager.ts`)

New public `async restoreKey(key: string): Promise<void>` method placed after `restore()`. Restores a single named provider without touching others — enables delayed boot sequencing where tab providers register early but restore after canvas registration. Follows the same try/catch/warn/resetToDefaults pattern as `restore()`.

## Test Coverage

29 tests passing across 2 test files:
- `SuperWidgetStateProvider.test.ts`: toJSON shape, setState validation (8 error cases), resetToDefaults, subscribe batching, unsubscribe, round-trip
- `StateManager.restoreKey.test.ts`: single-key restore, other-provider isolation, no-op on missing value, corrupt JSON reset, setState throw reset, unregistered key no-op, corruption isolation

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/superwidget/SuperWidgetStateProvider.ts` exists and exports `SuperWidgetStateProvider`
- [x] Implements `PersistableProvider` with `toJSON`, `setState`, `resetToDefaults`, `subscribe`, `setTabs`
- [x] `src/providers/StateManager.ts` contains `async restoreKey(key: string): Promise<void>`
- [x] Both test files exit 0 (29/29 tests pass)
- [x] No new TypeScript errors in modified/created files (pre-existing errors unrelated to this plan)
- [x] Commit 7ab3c275 exists

## Self-Check: PASSED
