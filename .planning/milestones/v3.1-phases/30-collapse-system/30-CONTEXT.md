# Phase 30: Collapse System - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can independently collapse any header at any stacking level with a choice between aggregate summaries (count/sum visible) and complete hiding (group disappears). Both row and column headers support collapse. Collapse state persists within a session via Tier 2 (PAFVProvider serialization). Requirements: CLPS-01 through CLPS-06.

</domain>

<decisions>
## Implementation Decisions

### Aggregate Mode Display
- Collapsed header in aggregate mode shows inline count badge on the header label: "Engineering (5)" — matches existing time-axis header pattern (`January (47)`)
- Additionally, a single summary row (for collapsed row groups) or summary column (for collapsed column groups) remains visible in the grid body
- Summary cells show aggregated card count per cross-axis position (e.g., if 3 rows collapse and a column had 2, 0, 1 cards → summary cell shows "3")
- Summary cells also apply the existing `d3.interpolateBlues` heat map coloring — visual density information survives the collapse

### Mode Switching UX
- Per-header only — no global "Collapse All" / "Expand All" action in Phase 30 scope
- Each header independently tracks its own mode (aggregate vs hide) — "Engineering" can be in aggregate while "Marketing" is in hide

### Collapse Visual Treatment
- Full row/column symmetry: same click behavior, visual indicators, and aggregate/hide modes on both row and column headers

### Claude's Discretion
- Mode switching mechanism (context menu, toggle icon, click cycle, or hybrid)
- Default collapse mode on first click (aggregate-first vs hide-first)
- Visual indicator type (chevron, plus/minus, or none)
- Animation vs instant snap on collapse/expand
- Collapsed header background treatment (subtle tint vs same as expanded)
- Summary cell click behavior (expand group, select cards, or no special action)
- Persistence storage location (inside PAFVProvider state vs separate CollapseProvider)
- Whether collapse state survives view type transitions (grid→calendar→grid)
- Axis change invalidation strategy (invalidate affected keys vs clear all)
- Whether collapse state persists across full app reloads (Tier 2 round-trip) or is session-only

</decisions>

<specifics>
## Specific Ideas

- Inline count badge on collapsed headers should match the existing "January (47)" pattern used by time-axis column headers — consistent visual language
- Summary row/column in aggregate mode should participate in heat map coloring so density information is not lost when groups are collapsed
- Per-header mode tracking allows maximum flexibility — user can have some groups summarized and others fully hidden in the same view

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_collapsedSet` (SuperGrid.ts): Already exists as `Set<string>` with `level\x1fparentPath\x1fvalue` key format — basic collapse/expand toggle is functional
- `buildHeaderCells()` (SuperStackHeader.ts): Already processes `collapsedSet` parameter to compute visibility slots and spanning — core algorithm exists
- `HeaderCell.isCollapsed` (SuperStackHeader.ts): Boolean flag on header cells indicating collapse state — ready for rendering logic
- Time-axis aggregate count pattern (SuperGrid.ts line 1279-1296): Existing code computes aggregate counts for time-axis headers with granularity — can serve as template for aggregate summary cells
- `PAFVProvider.toJSON()/setState()`: Established Tier 2 serialization pattern with backward-compatible restoration — model for adding collapse state persistence
- `StateManager` (StateManager.ts): Tier 2 persistence coordinator that registers providers and saves state to `ui_state` table

### Established Patterns
- Collapse key format: `${level}\x1f${parentPath}\x1f${value}` — already used for both column and row headers via shared `buildHeaderCells()`
- Click handler at SuperGrid.ts line 3064: Plain click toggles `_collapsedSet`, then re-renders from cached `_lastCells` (no re-query)
- `_renderCells()` re-render from cache: Collapse toggle avoids Worker round-trip by re-rendering from `_lastCells`/`_lastColAxes`/`_lastRowAxes`
- Heat map coloring via `d3.interpolateBlues` applied to cell backgrounds based on card count
- Tier 2 providers implement `PersistableProvider` interface: `toJSON()`, `setState()`, `resetToDefaults()`, `subscribe()`

### Integration Points
- `_collapsedSet` in SuperGrid: Currently ephemeral (`new Set()` on init, cleared on `teardown()`) — needs to be connected to Tier 2 persistence
- `buildHeaderCells()`: Already accepts `collapsedSet` and computes visible slots — needs mode awareness (aggregate vs hide produces different slot output)
- `_renderCells()`: Cell rendering loop needs aggregate summary row/column insertion when a group is collapsed in aggregate mode
- `_createColHeaderCell()`: Header cell DOM creation — needs collapse indicator and mode-switching affordance
- Phase 29 row headers: Will use the same `buildHeaderCells()` and collapse key format — collapse system should work symmetrically

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-collapse-system*
*Context gathered: 2026-03-05*
