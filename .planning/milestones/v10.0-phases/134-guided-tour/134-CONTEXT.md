# Phase 134: Guided Tour - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

New users get an opt-in guided tour (driver.js) that walks through key UI surfaces with dataset-aware annotations. The tour survives view switches, persists completion state to ui_state, and can be re-triggered from the command palette. Six requirements: TOUR-01 through TOUR-06.

</domain>

<decisions>
## Implementation Decisions

### Tour Step Content
- **D-01:** 5-7 tour steps total. Claude determines exact count and ordering within this budget.
- **D-02:** Must-have stops: SuperGrid cells (explain PAFV rows/columns/cells), View switcher in sidebar (show recommendation badges and multiple views), Command palette (Cmd+K as the primary action surface). Claude fills remaining 2-4 stops from available UI surfaces (e.g., explorer panel, density controls, notebook).
- **D-03:** Tour stays on the current view — does not force view switches. The view switcher step points at the sidebar without actually changing views.

### Dataset-Aware Copy
- **D-04:** Active axis substitution only — template placeholders replaced with live PAFV axis names from the current state. E.g., "Your contacts are grouped by {columnAxis}" becomes "Your contacts are grouped by Company". No per-source-type hand-written variants.
- **D-05:** Falls back to generic copy if axis name is unavailable (e.g., "Your data is grouped by the column axis").

### View-Switch Survival
- **D-06:** After ViewManager.switchTo() completes, re-query the current step's `data-tour-target` selector. If found, reposition spotlight. If not found, advance to the next step whose target exists in the DOM.
- **D-07:** Tour does not pause, cancel, or show a "resume" button on view switch — it silently adapts by skipping steps with missing targets.

### Opt-In Prompt UX
- **D-08:** Non-blocking toast after first import using existing ActionToast pattern: "New here? Take a quick tour — [Start Tour] [Dismiss]". Auto-dismisses after ~8 seconds.
- **D-09:** First import ever only — one-time prompt. Gated by a single ui_state flag (`tour:prompted`). Once dismissed or tour completed, never shows again regardless of new datasets.
- **D-10:** Dismissing the toast persists the flag immediately (no second chances unless user explicitly restarts from command palette).

### Completion Persistence
- **D-11:** Tour completion persisted as `tour:completed:v1` in ui_state (per success criteria #4). Tour prompt gated by absence of both `tour:prompted` AND `tour:completed:v1`.

### Command Palette Integration
- **D-12:** "Restart Tour" action registered in CommandRegistry under a new or existing category. Typing "tour" finds it. Relaunches from step 1 regardless of completion state.

### Claude's Discretion
- Exact 5-7 step selection and ordering beyond the 3 must-haves
- `data-tour-target` attribute naming convention
- driver.js configuration (popover style, animation, overlay opacity)
- Template syntax for axis substitution in step descriptions
- Whether TourEngine is a class or module of pure functions
- Which command palette category "Restart Tour" belongs to (likely 'Actions' or new 'Help')
- Re-query timing after view switch (requestAnimationFrame, setTimeout, or ViewManager event)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `CLAUDE-v5.md` — Canonical architectural decisions D-001 through D-010
- `.planning/PROJECT.md` — Project-level decisions and constraints

### Prerequisite Phases
- `.planning/phases/130-foundation/130-CONTEXT.md` — Per-dataset ui_state namespacing, `{providerKey}:{datasetId}` format, isSwitching guard
- `.planning/phases/131-supergrid-defaults/131-CONTEXT.md` — ViewDefaultsRegistry pattern, source type awareness
- `.planning/phases/132-other-view-defaults/132-CONTEXT.md` — View recommendation badges, auto-switch toast, first-import flag gate
- `.planning/phases/133-named-layout-presets/133-CONTEXT.md` — Command palette as primary action surface, preset category, MutationManager undo

### Command Palette
- `src/palette/CommandRegistry.ts` — PaletteCommand interface, category union (`'Views' | 'Actions' | 'Cards' | 'Settings' | 'Presets'`), register()/search()
- `src/palette/CommandPalette.ts` — Palette UI, keyboard navigation

### View System
- `src/views/ViewManager.ts` — switchTo(), view lifecycle, isSwitching guard
- `src/ui/SidebarNav.ts` — View switcher with recommendation badges

### State Management
- `src/providers/StateManager.ts` — ui_state persistence, key conventions
- `src/providers/PAFVProvider.ts` — Live axis state (columnAxes, rowAxes) for template substitution
- `src/providers/ViewDefaultsRegistry.ts` — Source type to default mapping

### Toast Pattern
- `src/ui/WorkbenchShell.ts` — ActionToast pattern for non-blocking notifications

### Requirements
- `.planning/REQUIREMENTS.md` — TOUR-01 through TOUR-06 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ActionToast** (WorkbenchShell): Non-blocking toast with action button — reuse for opt-in prompt
- **CommandRegistry**: Register "Restart Tour" command alongside existing view/action/preset commands
- **PAFVProvider**: Live access to current axis names for template substitution
- **ViewDefaultsRegistry**: Source type detection for potential fallback copy
- **StateManager**: ui_state persistence for `tour:prompted` and `tour:completed:v1` flags

### Established Patterns
- **ui_state key convention**: `{namespace}:{qualifier}` (e.g., `tour:completed:v1`, `tour:prompted`)
- **Command palette categories**: Union type in CommandRegistry — may need extending or reuse 'Actions'
- **`data-*` attributes**: Used extensively for styling selectors (`data-view-mode`, `data-col-start`); `data-tour-target` follows this convention

### Integration Points
- **Post-import hook**: Where first-import toast is triggered (likely near `view:defaults:applied:{datasetId}` flag check)
- **ViewManager.switchTo()**: Tour must listen for view-switch completion to re-query selectors
- **main.ts**: driver.js initialization and TourEngine wiring

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

*Phase: 134-guided-tour*
*Context gathered: 2026-03-27*
