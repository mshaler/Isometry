---
phase: 177-tab-persistence
plan: "02"
subsystem: superwidget-persistence
tags: [persistence, state-manager, superwidget, tab-persistence]
dependency_graph:
  requires: [177-01]
  provides: [SuperWidget.onTabStateChange, SuperWidget.restoreTabs, main.ts tab persistence wiring]
  affects: [SuperWidget, main.ts boot sequence]
tech_stack:
  added: []
  patterns: [callback injection, delayed restore, idempotent re-subscribe]
key_files:
  created: []
  modified:
    - src/superwidget/SuperWidget.ts
    - src/main.ts
decisions:
  - restoreTabs does NOT call _notifyTabStateChange to prevent persist-on-restore echo loop (same as PAFVProvider setState pattern)
  - sm.enableAutoPersist() called a second time after canvas registration to pick up the late-registered tab provider (idempotent — clears and re-wires subscribers)
  - Delayed restoreKey pattern: tabStateProvider registered early but restored after all canvases are registered to avoid canvasId reference errors
metrics:
  duration: 120s
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 2
---

# Phase 177 Plan 02: main.ts Wiring — Tab Persistence End-to-End Summary

**One-liner:** SuperWidget tab mutation notifications wired to SuperWidgetStateProvider via callback injection, with delayed restoreKey after canvas registry population.

## What Was Built

**SuperWidget tab mutation notification** (`src/superwidget/SuperWidget.ts`)

- `onTabStateChange?` optional public callback injected from main.ts (TABS-10 pattern)
- `_notifyTabStateChange()` private helper called at end of `_switchToTab`, `_createTab`, `_closeTab`, `_reorderTabs`
- `restoreTabs(tabs, activeTabSlotId)` bulk-set method for restore path — does NOT call `_notifyTabStateChange` to prevent persist-on-restore echo loop

**main.ts boot sequence wiring** (`src/main.ts`)

- Import `SuperWidgetStateProvider` and `TabSlot` type
- Create `tabStateProvider` and register under `sw:zone:primary:tabs` after initial `sm.enableAutoPersist()`
- Wire `superWidget.onTabStateChange` callback to `tabStateProvider.setTabs()` after `superWidget.mount()`
- Delayed `sm.restoreKey('sw:zone:primary:tabs')` after all canvas registrations (editor-1 is last) — ensures canvas registry is populated before tab state referencing canvasIds is restored (PRST-03)
- Second `sm.enableAutoPersist()` call after delayed restore block — picks up the late-registered tab provider's subscriber (idempotent)

## Test Coverage

359 tests passing (19 test files in tests/superwidget/ + tests/providers/StateManager.restoreKey.test.ts). No new tests required — behavior is wiring of Plan 01 primitives.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/superwidget/SuperWidget.ts` contains `onTabStateChange?:`
- [x] `src/superwidget/SuperWidget.ts` contains `_notifyTabStateChange()`
- [x] `src/superwidget/SuperWidget.ts` contains `restoreTabs(`
- [x] `_notifyTabStateChange()` appears in _switchToTab, _createTab, _closeTab, _reorderTabs
- [x] `restoreTabs` does NOT contain `_notifyTabStateChange` (no echo loop)
- [x] `src/main.ts` contains `import { SuperWidgetStateProvider }`
- [x] `src/main.ts` contains `new SuperWidgetStateProvider()`
- [x] `src/main.ts` contains `sm.registerProvider('sw:zone:primary:tabs', tabStateProvider)`
- [x] `src/main.ts` contains `sm.restoreKey('sw:zone:primary:tabs')`
- [x] `src/main.ts` contains `superWidget.restoreTabs(`
- [x] `src/main.ts` contains `superWidget.onTabStateChange =`
- [x] `src/main.ts` contains second `sm.enableAutoPersist()` call after canvas registration
- [x] `sw:zone:primary:tabs` appears 2 times in main.ts (register + restoreKey)
- [x] 359 tests pass
- [x] Commits 038f478e and 1388b24a exist

## Self-Check: PASSED
