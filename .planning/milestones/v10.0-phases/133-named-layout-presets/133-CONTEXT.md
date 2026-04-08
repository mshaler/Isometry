# Phase 133: Named Layout Presets - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can save their current Workbench panel arrangement as a named preset and restore it instantly. 4 built-in presets cover common workflows. Presets are accessible from the command palette (Cmd+K). Applying a preset is undoable. Datasets remember their last-applied preset and prompt on switch. Six requirements: PRST-01 through PRST-06.

</domain>

<decisions>
## Implementation Decisions

### Built-in Preset Content
- **D-01:** Built-in presets define panel state only (which of the 6 CollapsibleSections are expanded/collapsed). No PAFV axis override — axes stay as whatever the current dataset defaults are. Keeps presets generic across all dataset types.
- **D-02:** Claude determines sensible panel arrangements for each of the 4 presets (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics) based on their purpose.
- **D-03:** Built-in presets are immutable — always available, never editable. Users create custom presets to customize. No "reset to factory" needed.

### Preset Picker UI
- **D-04:** Command palette only — new 'Presets' category added to PaletteCommand category union (`'Views' | 'Actions' | 'Cards' | 'Settings' | 'Presets'`). Both built-in and custom presets listed under this category. No new UI surface.
- **D-05:** No dedicated dropdown or floating picker. Consistent with how views and actions are already accessed via Cmd+K.

### Save Custom Preset Flow
- **D-06:** User triggers 'Save Layout as Preset' from command palette, types a name via CommandPalette's input field. Minimal new UI — reuses existing palette text input infrastructure.
- **D-07:** Custom presets can be deleted via command palette ('Delete Preset: {name}'). No rename — delete and re-save. Keeps management simple.

### Dataset-to-Preset Association
- **D-08:** Auto-associate on apply — when a user applies a preset to a dataset, the association is remembered automatically. No explicit "pin" action needed.
- **D-09:** On dataset switch, if an association exists, show a non-blocking toast: 'This dataset uses the "{name}" preset. [Apply]'. Toast dismisses automatically after ~5s. User can ignore.

### Serialization
- **D-10:** Key-based dict serialization using `Record<storageKey, boolean>` as specified in PRST-04 and STATE.md. Forward/backward compatible — new sections added later don't break existing presets.

### Undo
- **D-11:** Preset apply registered as undoable mutation via MutationManager. Cmd+Z restores previous panel arrangement. Captures `getSectionStates()` before apply, restores via `restoreSectionStates()` on undo.

### Claude's Discretion
- Specific panel arrangements for each of the 4 built-in presets
- Storage key naming convention for custom presets (following existing `preset:name:{presetName}` convention from STATE.md)
- Whether LayoutPresetManager is a class or module of pure functions
- How the CommandPalette text input is reused for preset naming (inline or via a callback)
- Toast message wording and duration for dataset-preset suggestion

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `CLAUDE-v5.md` — Canonical architectural decisions D-001 through D-010
- `.planning/PROJECT.md` — Project-level decisions and constraints

### Prerequisite Phases
- `.planning/phases/131-supergrid-defaults/131-CONTEXT.md` — ViewDefaultsRegistry pattern, DefaultMapping interface, resolveDefaults() (D-01..D-07)
- `.planning/phases/132-other-view-defaults/132-CONTEXT.md` — View recommendation pattern, SidebarNav badge, auto-switch toast, first-import flag gate (D-01..D-11)
- `.planning/phases/130-foundation/130-CONTEXT.md` — Per-dataset ui_state namespacing (D-01..D-04)

### Panel System
- `src/ui/WorkbenchShell.ts` — SECTION_CONFIGS (6 sections), getSectionStates(), restoreSectionStates(), collapseAll()
- `src/ui/CollapsibleSection.ts` — CollapsibleSectionConfig, storageKey, getCollapsed()/setCollapsed(), localStorage persistence

### Command Palette
- `src/palette/CommandRegistry.ts` — PaletteCommand interface, category union, register()/registerAll(), search()
- `src/palette/CommandPalette.ts` — Palette UI, input field, keyboard navigation

### Mutations
- `src/mutations/MutationManager.ts` — execute()/undo()/redo(), Mutation interface, UndoRedoToast
- `src/mutations/types.ts` — Mutation type definition

### State Management
- `src/providers/StateManager.ts` — ui_state persistence, registerProvider(), preset: namespace rejection

### Requirements
- `.planning/REQUIREMENTS.md` — PRST-01 through PRST-06 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkbenchShell.getSectionStates()` — Returns `Map<storageKey, boolean>` of all 6 sections' collapsed state. Direct serialization source for presets.
- `WorkbenchShell.restoreSectionStates()` — Accepts `Map<storageKey, boolean>` and applies. Direct deserialization target for preset apply.
- `CommandRegistry` — Category-based command registration with fuzzy search. Adding 'Presets' category is a union type extension + registerAll() call.
- `MutationManager` — Existing undo/redo infrastructure. Preset apply needs a Mutation with forward (apply preset) and inverse (restore previous states) commands.

### Established Patterns
- `workbench:${storageKey}` localStorage keys for section state persistence
- `Record<storageKey, boolean>` dict pattern already decided in STATE.md for forward compat
- `preset:name:{presetName}` namespace in StateManager (rejected for registerProvider but usable for ui_state keys)
- PaletteCommand with `visible()` predicate for contextual commands

### Integration Points
- `WorkbenchShell` — getSectionStates/restoreSectionStates are the read/write API for panel state
- `CommandRegistry` — registerAll() for preset commands at bootstrap
- `MutationManager` — execute() for undoable preset apply
- `StateManager` / ui_state table — persistence of custom presets and dataset-to-preset associations

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 133-named-layout-presets*
*Context gathered: 2026-03-27*
