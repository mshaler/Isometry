# Phase 55: Properties + Projection Explorers - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see all available data properties grouped by LATCH axis families, toggle their visibility, rename them inline, and drag property chips between projection wells (available/x/y/z) to reconfigure what SuperGrid displays -- with every change flowing through providers to trigger a live re-render. Z-plane controls (display field, audit toggle, density, aggregation) are functional and produce real SQL/render changes.

</domain>

<decisions>
## Implementation Decisions

### Property display & grouping
- 5 LATCH columns (L, A, T, C, H) arranged horizontally side-by-side inside the Properties section body
- Each column header shows enabled/total count badge (e.g., "T (2/3)" meaning 2 of 3 time properties toggled ON)
- Each LATCH column is individually collapsible (independent of the parent Properties CollapsibleSection) -- collapses to just header + count badge
- Toggled-OFF properties remain visible with dimmed opacity + strikethrough text (not hidden)
- Per-property toggle checkboxes enable/disable axis availability

### Inline rename interaction
- Single click on property name text enters edit mode (span swaps to input)
- Rename is a display alias only -- does NOT alter the underlying database column name (e.g., 'folder' stays 'folder' in SQL but displays as 'Project')
- Display aliases persisted via ui_state table (Tier 2 persistence), consistent with PAFVProvider/FilterProvider pattern
- Renames propagate to all downstream UI: projection well chips and SuperGrid headers
- Clear/reset button appears in edit mode to revert alias back to original column name
- Confirmation via Enter or blur; cancellation via Escape

### Drag-drop & well design
- 4 projection wells arranged in a horizontal row: [Available] [X] [Y] [Z] -- Available well is wider
- Property chips show the user's display alias (renamed label), not the raw column name
- Each chip has a colored left border indicating its LATCH family (uses design token color system)
- Available well auto-populates with all properties toggled ON in PropertiesExplorer that are NOT already assigned to X, Y, or Z
- HTML5 drag-drop pattern (dragstart/dataTransfer/drop) -- NOT d3.drag -- consistent with KanbanView
- Valid target wells get dashed border highlight + subtle background color change during dragover; invalid wells stay unhighlighted
- Duplicate rejection: cannot drop a property into a well that already contains it
- Minimum enforcement: X and Y wells must retain at least 1 property -- removing the last chip snaps back + ActionToast ("X axis requires at least one property")
- Reordering chips within a well is live -- X well reorder calls PAFVProvider.reorderColAxes(), Y well calls reorderRowAxes(), SuperGrid re-renders immediately

### Z-plane controls
- Controls row appears below the Z well (not inline) -- display field select, audit toggle, density select, aggregation mode
- Aggregation modes: COUNT (default), SUM, AVG, MIN, MAX -- produces different SQL GROUP BY results via PAFVProvider
- Audit toggle wires into existing AuditState.enable()/disable() system (Phase 37 CSS overlay) -- no parallel audit state
- Density select surfaces both viewMode toggle (spreadsheet/matrix) AND axisGranularity dropdown (day/week/month/quarter/year when time axis active) -- both through SuperDensityProvider
- Display field select: dropdown populated from 9 allowlisted AxisFields, default 'name' -- changing it updates what text/value renders inside SuperGrid cells

### Claude's Discretion
- Exact chip sizing, padding, and typography
- LATCH family color assignments (within design token system)
- Transition/animation timing for collapse, drag feedback
- Internal architecture of the alias provider (new provider vs extending PAFVProvider)
- How display field selection wires into the SuperGrid rendering pipeline

</decisions>

<specifics>
## Specific Ideas

- Chips should carry their LATCH family color as a left border -- subtle but scannable
- Available well auto-populates (reactive to PropertiesExplorer toggle state) -- no manual "add to available" step
- ActionToast for constraint violations (min 1 in X/Y) -- reuses existing toast component
- Z controls are a secondary row below the wells, not crammed inline

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CollapsibleSection` (src/ui/CollapsibleSection.ts): mount/destroy lifecycle, ARIA disclosure, localStorage persistence, count badge, chevron state -- used as container for each LATCH column header within Properties
- `WorkbenchShell` (src/ui/WorkbenchShell.ts): Creates Properties and Projection sections with stub content ("coming soon") -- stubs will be replaced with real explorer content
- `PAFVProvider` (src/providers/PAFVProvider.ts): Already has `setColAxes()`, `setRowAxes()`, `reorderColAxes()`, `reorderRowAxes()`, allowlist validation, `getStackedGroupBySQL()` -- projection wells wire directly into these
- `SuperDensityProvider` (src/providers/SuperDensityProvider.ts): Already manages `viewMode`, `axisGranularity`, `hideEmpty` with PersistableProvider pattern -- Z density controls wire into this
- `AuditState` (src/audit/AuditState.ts): Session-only change tracking with CSS overlay -- Z audit toggle wires into this
- `allowlist.ts` (src/providers/allowlist.ts): 9 AxisField values (created_at, modified_at, due_at, folder, status, card_type, priority, sort_order, name) -- defines the universe of available properties
- `ActionToast`: Existing toast component for undo/redo feedback -- reused for constraint violation messages
- KanbanView drag-drop pattern: HTML5 dragstart/dataTransfer/drop (NOT d3.drag) -- reuse same approach for well chips
- Design token CSS system: `--text-xs..--text-xl`, derived color tokens -- chip styling uses these

### Established Patterns
- Provider subscriber pattern: `subscribe()` returns unsubscribe fn, notifications batched via `queueMicrotask`
- PersistableProvider interface: `toJSON()` / `setState()` / `resetToDefaults()` for Tier 2 persistence via ui_state table
- mount/destroy lifecycle: All UI components follow this pattern (CollapsibleSection, CommandBar, HelpOverlay)
- SQL safety: All axis fields validated against frozen allowlist sets before use in queries

### Integration Points
- WorkbenchShell.SECTION_CONFIGS: Properties and Projection sections exist with stub content -- replace stubs with real explorer DOM
- PAFVProvider.setColAxes/setRowAxes: X/Y well drops call these to update SuperGrid axes
- PAFVProvider.reorderColAxes/reorderRowAxes: Within-well reorder calls these for live grid update
- SuperDensityProvider.setViewMode/setAxisGranularity: Z density controls wire into these
- AuditState.enable/disable: Z audit toggle wires into this
- StateCoordinator: New alias provider (if separate) must register here for persistence

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 55-properties-projection-explorers*
*Context gathered: 2026-03-07*
