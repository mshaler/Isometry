---
phase: 133-named-layout-presets
plan: 01
subsystem: ui
tags: [layout-presets, workbench, ui-state, persistence, vitest]

requires:
  - phase: 130-per-dataset-namespacing
    provides: ui_state bridge API (ui:get/ui:set/ui:delete/ui:getAll) used for preset persistence
  - phase: 54-workbench-shell
    provides: WorkbenchShell.getSectionStates/restoreSectionStates/collapseAll interface

provides:
  - BUILT_IN_PRESETS: 4 built-in panel layout definitions (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics)
  - LayoutPresetManager: CRUD for custom presets, applyPreset, dataset-to-preset association
  - Record<storageKey, boolean> serialization format for layout panel state

affects:
  - 133-02 (command palette wiring uses LayoutPresetManager.listAll/applyPreset)
  - 133-03 (undo integration uses applyPreset return value for prev state)

tech-stack:
  added: []
  patterns:
    - "LayoutPresetManager constructed with injected callbacks (getSectionStates, restoreSectionStates) — no direct WorkbenchShell dependency"
    - "Built-in presets defined as readonly BuiltInPreset[] — immutable, never persisted"
    - "Custom presets stored under preset:name:{name} keys in ui_state"
    - "loadCustomPresets() called once at boot to hydrate in-memory _custom Map"

key-files:
  created:
    - src/presets/builtInPresets.ts
    - src/presets/LayoutPresetManager.ts
    - tests/presets/LayoutPresetManager.test.ts
  modified: []

key-decisions:
  - "LayoutPresetManager accepts injected getSectionStates/restoreSectionStates callbacks (not a WorkbenchShell instance) to keep the preset layer decoupled from DOM"
  - "applyPreset returns previous states as Record<string, boolean> for undo — caller is responsible for undo stack"
  - "deleteCustom returns false (not throw) for built-in names per D-03 immutability constraint"
  - "loadCustomPresets uses ui:getAll and filters by preset:name: prefix — single round-trip at boot"

patterns-established:
  - "Preset serialization: Record<storageKey, boolean> stored as JSON string in ui_state"
  - "Storage key namespacing: preset:name:{name} for data, preset:association:{datasetId} for associations"

requirements-completed: [PRST-01, PRST-04]

duration: 8min
completed: 2026-03-27
---

# Phase 133 Plan 01: Named Layout Presets — Core Data Layer Summary

**LayoutPresetManager with 4 built-in presets (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics), custom CRUD via ui_state bridge, and Record<storageKey, boolean> serialization**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-27T17:48:00Z
- **Completed:** 2026-03-27T17:49:20Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 3

## Accomplishments
- Created `builtInPresets.ts` with 4 typed, immutable preset definitions covering all 6 WorkbenchShell panel keys
- Created `LayoutPresetManager.ts` with full CRUD: loadCustomPresets, listAll, getPreset, isBuiltIn, applyPreset, saveCustom, deleteCustom, setAssociation, getAssociation, captureCurrentState
- 19 unit tests passing, tsc --noEmit clean, no `any` types in production code

## Task Commits

TDD task committed in two phases:

1. **RED: Tests** - `6ca78aac` (test: add failing tests for LayoutPresetManager and built-in presets)
2. **GREEN: Implementation** - `616443cf` (feat: implement LayoutPresetManager with 4 built-in presets and custom CRUD)

## Files Created/Modified
- `src/presets/builtInPresets.ts` - BuiltInPreset interface + BUILT_IN_PRESETS const (4 presets, 6 keys each)
- `src/presets/LayoutPresetManager.ts` - Core manager class with all methods
- `tests/presets/LayoutPresetManager.test.ts` - 19 unit tests covering all behavior specs

## Decisions Made
- LayoutPresetManager accepts injected callbacks rather than a WorkbenchShell instance — keeps preset layer decoupled from DOM
- applyPreset returns previous states as Record for undo (caller owns undo stack)
- deleteCustom returns false for built-ins (no-op, not throw) per plan spec D-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness
- LayoutPresetManager is complete and fully tested — ready for 133-02 command palette wiring
- Serialization format (Record<storageKey, boolean>) is established and load-bearing for 133-03 undo integration

---
*Phase: 133-named-layout-presets*
*Completed: 2026-03-27*
