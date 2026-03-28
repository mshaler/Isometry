---
phase: 133-named-layout-presets
plan: "03"
subsystem: presets
tags: [mutations, undo-redo, toast, preset, callback-mutation, dataset-switch]
dependency_graph:
  requires: [133-02]
  provides: [undoable-preset-apply, preset-suggestion-toast]
  affects: [src/mutations, src/presets, src/main.ts]
tech_stack:
  added: [CallbackMutation, AnyMutation, isSqlMutation, PresetSuggestionToast]
  patterns: [discriminated-union, type-guard, forward-declaration, jsdom-test]
key_files:
  created:
    - src/presets/PresetSuggestionToast.ts
    - src/styles/preset-suggestion-toast.css
    - tests/presets/PresetSuggestionToast.test.ts
  modified:
    - src/mutations/types.ts
    - src/mutations/MutationManager.ts
    - src/presets/presetCommands.ts
    - src/main.ts
    - tests/mutations/MutationManager.test.ts
    - tests/presets/presetCommands.test.ts
decisions:
  - "CallbackMutation forward/inverse are () => void — type-narrowed from AnyMutation via isSqlMutation(Array.isArray) guard"
  - "CallbackMutation does not set dirty flag — UI-only operations should not trigger CloudKit sync"
  - "presetManager and presetSuggestionToast forward-declared with let null before handleDatasetSwitch — assigned post-bootstrap per established main.ts pattern"
  - "500ms delay before getAssociation check lets import-success toast clear first (D-09 UI-SPEC)"
metrics:
  duration_seconds: 415
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 5
---

# Phase 133 Plan 03: Undoable Preset Apply + Suggestion Toast Summary

**One-liner:** CallbackMutation union type enables undo/redo for UI-only preset operations, and PresetSuggestionToast surfaces saved dataset-preset associations on dataset switch.

## Objective

Extend MutationManager to handle callback-based (non-SQL) mutations, register preset apply as an undoable CallbackMutation per D-11, and show a dataset-preset suggestion toast when switching to a dataset with a saved association.

## Tasks Completed

### Task 1: Callback-based mutation support and undoable preset apply (D-11)

**Commit:** `d2052181`

Extended the mutation type system with:
- `CallbackMutation` interface: `forward: () => void`, `inverse: () => void` (no SQL)
- `AnyMutation = Mutation | CallbackMutation` union
- `isSqlMutation(m)` type guard using `Array.isArray(m.forward)`

Updated `MutationManager.execute()`, `undo()`, `redo()` to branch on `isSqlMutation`:
- SQL mutations: bridge.exec + dirty=true (unchanged behavior)
- Callback mutations: call forward/inverse directly, no dirty flag

Updated `presetCommands.ts` apply handler:
- Calls `mutationManager.execute({ forward: () => restoreSectionStates(presetMap), inverse: () => restoreSectionStates(prevMap) })`
- Captures `previousStates` from `applyPreset()` return for inverse
- `mutationManager` and `restoreSectionStates` passed as optional deps for backward compat

Wired in `main.ts`: `mutationManager` and `restoreSectionStates` passed to `createPresetCommands`.

### Task 2: Dataset-preset suggestion toast

**Commit:** `7451b3ef`

Created `PresetSuggestionToast`:
- `show(presetName)`: sets text "Layout preset '{name}' was last used here.", adds `.is-visible`, schedules 5000ms auto-dismiss
- `dismiss()`: removes `.is-visible`, clears timer
- `destroy()`: removes from DOM
- `setOnApply(callback)`: wires Apply button
- `role="status"` + `aria-live="polite"` for accessibility

Created `preset-suggestion-toast.css`:
- `position: fixed; top: var(--space-lg); right: var(--space-lg);` matching import-toast pattern
- `border: 1px solid var(--accent-border)` accent styling
- `transform: translateY(-8px)` → `translateY(0)` entry animation via `.is-visible`

Wired in `main.ts`:
- Forward-declared `presetManager: LayoutPresetManager | null` and `presetSuggestionToast: PresetSuggestionToast | null` before `handleDatasetSwitch` (per established pattern)
- Assigned at bootstrap (section 14a-2 and 14a-3)
- `handleDatasetSwitch` checks association with 500ms delay, calls `presetSuggestionToast?.show(presetName)`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality wired through to runtime.

## Self-Check: PASSED
