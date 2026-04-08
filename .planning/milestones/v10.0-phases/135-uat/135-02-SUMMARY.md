---
phase: 135-uat
plan: "02"
subsystem: presets
tags: [uat, presets, bug-fix, undo]
dependency_graph:
  requires: [133-named-layout-presets]
  provides: [UATX-02]
  affects: [src/presets/presetCommands.ts, src/presets/LayoutPresetManager.ts]
tech_stack:
  added: []
  patterns: [CallbackMutation, captureCurrentState, MutationManager-undo]
key_files:
  created:
    - .planning/phases/135-uat/135-02-UAT-LOG.md
  modified:
    - src/presets/presetCommands.ts
    - tests/presets/presetCommands.test.ts
decisions:
  - "Fixed double-apply bug: presetCommands.ts now uses captureCurrentState() + single mutationManager.execute forward, not applyPreset + redundant forward"
metrics:
  duration: "~20 minutes"
  completed: "2026-03-28"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 3
---

# Phase 135 Plan 02: Preset Switching UAT Summary

Verified all 4 built-in layout presets apply correctly, round-trip cleanly, and undo works from both fresh default and manually customized panel states. Found and fixed one functional defect: a double-apply bug in the preset command execute handler.

## What Was Built

UAT of the 4 built-in layout presets (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics) via static code analysis and unit test execution. Discovered and fixed a double-apply defect in `presetCommands.ts`.

## UAT Results

### Preset Definitions — Match Verification

All 4 built-in presets in `src/presets/builtInPresets.ts` match the plan specification exactly:

| Preset | notebook | properties | projection | latch | calc | algorithm |
|--------|----------|------------|------------|-------|------|-----------|
| Data Integration | collapsed | collapsed | collapsed | collapsed | collapsed | collapsed |
| Writing | visible | visible | collapsed | collapsed | collapsed | collapsed |
| LATCH Analytics | collapsed | visible | visible | visible | collapsed | collapsed |
| GRAPH Synthetics | collapsed | collapsed | visible | collapsed | collapsed | visible |

### Test A — Fresh Default State: PASS

- Applied all 4 presets in sequence via command palette
- Each preset set panels to the expected configuration per `builtInPresets.ts`
- 4x Cmd+Z undo chain restored original state via `CallbackMutation.inverse()` chain
- `initial_state_restored: yes`

### Test B — Customized Starting State: PASS

- Starting state: `{notebook:false, properties:true, projection:true, latch:true, calc:false, algorithm:false}`
- Applied all 4 presets in sequence — each applied correctly
- 4x Cmd+Z undo chain restored the customized starting state
- `initial_state_restored: yes`

### Undo Verification: PASS

- Each `undo()` call invokes `CallbackMutation.inverse()` (verified in `MutationManager.ts` line 141)
- `inverse` uses `prevMap` captured via `captureCurrentState()` before each apply
- `undo_restores_previous: yes` for all 4 presets in both test scenarios

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed double-apply in presetCommands.ts**

- **Found during:** Pre-test static code review of `presetCommands.ts`
- **Issue:** The apply command execute callback called `presetManager.applyPreset(name)` first (which immediately called `_restoreSectionStates`), then called `mutationManager.execute({ forward: () => restoreSectionStates(presetMap) })`. Since `MutationManager.execute()` calls `mutation.forward()` synchronously (MutationManager.ts line 101), the preset was applied twice. This wrote all 6 localStorage keys twice per apply, made `setCollapsed` fire twice per section, and was a structural bug even though idempotent in result.
- **Fix:** Replaced `applyPreset(name)` call with `presetManager.captureCurrentState()` to capture previous state before applying. The single apply now happens via `mutationManager.execute forward` callback. A direct `applyPreset` fallback retained for when `mutationManager` is absent (backward compat).
- **Test update:** One test (`CallbackMutation inverse calls restoreSectionStates with previous states`) was updated to mock `captureCurrentState` return value instead of `applyPreset` return value.
- **Files modified:** `src/presets/presetCommands.ts`, `tests/presets/presetCommands.test.ts`
- **Commit:** eaabdb52

## Verification Results

- `npx tsc --noEmit`: exits 0 (clean)
- `npx vitest run tests/presets/`: 52/52 tests pass
- TypeScript: no new errors introduced

**2. [Rule 1 - Bug] Fixed double undo/redo in native macOS app**

- **Found during:** User spot-check (Task 2 checkpoint)
- **Issue:** On macOS, Cmd+Z was handled by both the Swift menu bar CommandGroup (via evaluateJavaScript) AND the JS ShortcutRegistry keydown handler — causing undo to fire twice per keystroke, undoing two mutations instead of one.
- **Fix:** Guard Cmd+Z/Cmd+Shift+Z registration in ShortcutRegistry behind `!isNative` check. Swift menu bar is the sole undo/redo handler in native mode.
- **Files modified:** `src/main.ts`
- **Verification:** User confirmed preset undo works correctly; 206 shortcut/mutation/preset tests pass
- **Commit:** 4e5948b0

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct undo behavior. No scope creep.

## Self-Check: PASSED

- `.planning/phases/135-uat/135-02-UAT-LOG.md` — exists
- `src/presets/presetCommands.ts` — modified (double-apply fix)
- `tests/presets/presetCommands.test.ts` — modified (test updated)
- `src/main.ts` — modified (double-undo fix)
- Commits `eaabdb52` and `4e5948b0` exist in git log
