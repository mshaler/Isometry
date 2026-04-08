---
phase: 133-named-layout-presets
plan: "02"
subsystem: preset-commands
tags: [presets, command-palette, palette-commands, layout, ux]
dependency_graph:
  requires: [133-01]
  provides: [preset-palette-commands, save-custom-flow, delete-custom-flow]
  affects: [src/palette/CommandRegistry.ts, src/palette/CommandPalette.ts, src/main.ts]
tech_stack:
  added: []
  patterns: [factory-function, tdd-red-green, dynamic-command-refresh, prompt-mode]
key_files:
  created:
    - src/presets/presetCommands.ts
    - tests/presets/presetCommands.test.ts
  modified:
    - src/palette/CommandRegistry.ts
    - src/palette/CommandPalette.ts
    - src/main.ts
decisions:
  - "promptForInput uses palette's own input + prompt mode flag — no browser dialog, no custom event dispatch"
  - "unregisterByPrefix splices commands array + byId map in-place for O(n) dynamic refresh"
  - "refreshCommands() is closure-internal — not exported — avoids leaking internal state to callers"
  - "Save onConfirm closes palette before calling saveCustom (avoids stale UI)"
metrics:
  duration_seconds: 131
  completed_date: "2026-03-27"
  tasks_completed: 2
  files_changed: 5
---

# Phase 133 Plan 02: Preset Commands Palette Wiring Summary

**One-liner:** Preset apply/save/delete commands wired into command palette via createPresetCommands factory with promptForInput naming flow and dynamic command refresh after mutations.

## What Was Built

Extended the command palette with a 'Presets' category containing:
- `Apply Preset: {name}` commands for all 4 built-ins + any custom presets
- `Delete Preset: {name}` commands for custom presets only (built-ins protected)
- `Save Layout as Preset` command that re-opens palette in prompt mode for name input

### Key Design: promptForInput

The save flow needed a name-input UX without a browser dialog. Solution: `promptForInput(placeholder, onConfirm)` on `CommandPalette`:
- Opens palette, hides listbox, sets custom placeholder
- On Enter: calls `onConfirm(value)` and closes
- On Escape: cancels and closes
- `_promptMode` flag prevents search-as-you-type from interfering

### Key Design: refreshCommands

After save or delete, `refreshCommands()` (internal closure):
1. Calls `registry.unregisterByPrefix('preset:')` — new `unregisterByPrefix` method on `CommandRegistry`
2. Rebuilds all preset commands from `presetManager.listAll()`
3. Re-registers — new presets/deletions are immediately visible in palette

### main.ts wiring

`LayoutPresetManager` constructed after `WorkbenchShell` (needs `shell.getSectionStates/restoreSectionStates`), with `loadCustomPresets()` awaited before `createPresetCommands` called.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend command palette category union | c6976ba7 | CommandRegistry.ts, CommandPalette.ts |
| 2 | Preset commands factory and save-custom flow | cf92b1fc | presetCommands.ts, CommandRegistry.ts, CommandPalette.ts, main.ts |

## Verification

- `npx vitest run tests/presets/` — 33 tests pass (14 new + 19 existing)
- `npx tsc --noEmit` — 0 errors
- Command palette CATEGORY_ORDER: `['Recents', 'Views', 'Actions', 'Cards', 'Settings', 'Presets']`
- All 4 built-in presets accessible as `Apply Preset: {name}` in palette
- Custom presets appear immediately after save via `refreshCommands()`
- Built-in presets have no Delete commands
- Toast feedback on apply (`Applied preset "…"`), save (`Preset "…" saved`), delete (`Preset "…" deleted`)

## Deviations from Plan

None — plan executed exactly as written. The `promptForInput` approach described in the plan's action section was followed directly.

## Known Stubs

None — all preset commands fully wired with real LayoutPresetManager integration.

## Self-Check: PASSED

Files verified present:
- src/presets/presetCommands.ts: EXISTS
- src/palette/CommandRegistry.ts: EXISTS (contains `unregisterByPrefix`)
- src/palette/CommandPalette.ts: EXISTS (contains `promptForInput`)
- src/main.ts: EXISTS (contains `createPresetCommands`, `new LayoutPresetManager`, `loadCustomPresets`)
- tests/presets/presetCommands.test.ts: EXISTS (14 test cases)

Commits verified:
- c6976ba7: feat(133-02): extend command palette with Presets category
- 6ef042d4: test(133-02): add failing tests for preset commands factory
- cf92b1fc: feat(133-02): implement preset commands factory and palette wiring
