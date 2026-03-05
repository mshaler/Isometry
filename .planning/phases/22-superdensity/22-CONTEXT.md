# Phase 22: SuperDensity - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users control grid information density at 4 levels: Value (time hierarchy collapse), Extent (hide empty intersections), View (spreadsheet vs matrix mode), and Region (data structure stub only — no UI in v3.0). Density changes must never misalign cells (DENS-06: gridColumn/gridRow set in both D3 enter AND update callbacks).

</domain>

<decisions>
## Implementation Decisions

### Density control architecture
- Independent toggles for each active density level (Value, Extent, View) — NOT named presets
- Density state persists across sessions via Tier 2 persistence (extend PAFVState or create new persisted provider)
- Hybrid query strategy: Value-level changes (time hierarchy collapse) trigger Worker re-query via supergrid:query; Extent-level (hide empty) and View-level (spreadsheet/matrix) reprocess client-side from cached cells

### Time hierarchy collapse (DENS-01, DENS-05)
- Aggregate counts display directly in collapsed header cells: "January (47)" format
- Only applies to time field axes (created_at, modified_at, due_at) — DensityProvider's STRFTIME_PATTERNS drive the GROUP BY rewrite
- Non-time axes (folder, status, card_type) are unaffected by granularity changes
- Granularity control hidden when no time field is assigned to any active axis
- Direct jump granularity picker (dropdown/segmented control: day/week/month/quarter/year) — NOT sequential cycling

### Empty intersections (DENS-02)
- Remove entire rows and columns where every cell has count=0 — not just individual cells
- Simple toggle: one "Hide empty" control (no separate row/column toggles)
- Reactive behavior: when hide-empty is enabled, empties are re-evaluated on every data change (filter, axis transpose, granularity change) — newly empty rows/columns auto-hide
- Subtle indicator showing how many rows/columns are hidden ("+3 hidden" badge) — empty dimensions don't silently disappear

### Spreadsheet vs matrix mode (DENS-03)
- Spreadsheet mode: card pills showing name + type icon per card in each cell
- Cell overflow: truncate visible cards + "+N more" badge at bottom (no scrollable cells)
- Matrix mode: count numbers with heat map color intensity (low count = light, high count = saturated background)
- Heat map provides instant data distribution visualization — classic pivot table feature

### Claude's Discretion
- Density control UI placement and layout (toolbar dropdown, sidebar, or inline)
- Mode switch animation (snap vs 300ms crossfade)
- Heat map color palette and intensity scale
- Region density (Level 4) data structure design — stub only, no UI
- Loading state during Worker re-query on granularity change

</decisions>

<specifics>
## Specific Ideas

- Heat map in matrix mode echoes pivot table tools (Excel, Google Sheets) — users expect this pattern
- "+N more" overflow badge is the Gmail/calendar pattern — familiar, no scroll-within-scroll issues
- Granularity picker should feel like a direct-access control, not a cycle-through stepper
- Hidden row/column indicator prevents user confusion about "where did my data go?"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DensityProvider` (src/providers/DensityProvider.ts): Already has STRFTIME_PATTERNS for day/week/month/quarter/year, timeField validation, and Tier 2 persistence (toJSON/setState). Drives GROUP BY expression compilation for time granularity.
- `SuperStackHeader.buildHeaderCells()`: Run-length encoding for header spanning — empty row/column removal must filter the axis value tuples BEFORE passing to buildHeaderCells.
- `SuperStackHeader.buildGridTemplateColumns()`: Per-column px widths with zoom scaling — empty column removal changes the leafColKeys array input.
- `SuperGridQuery.buildSuperGridQuery()`: Parameterized GROUP BY SQL — time hierarchy collapse changes the SELECT/GROUP BY fields from raw column names to strftime() expressions.

### Established Patterns
- Subscriber notification via `queueMicrotask` batching (DensityProvider, PAFVProvider, FilterProvider)
- Tier 2 persistence: `toJSON()`/`setState()`/`resetToDefaults()` implementing PersistableProvider interface
- StateCoordinator batches multiple provider changes into one 16ms cycle — density changes participate in existing coordination
- SuperGrid `_fetchAndRender()` reads provider state, compiles filter, calls bridge.superGridQuery() — density changes follow same pipeline
- SuperGrid `_renderCells()` sets gridColumn/gridRow on both header and data cell elements — DENS-06 requires both enter AND update callbacks set positions

### Integration Points
- DensityProvider already registered with StateCoordinator — granularity changes already trigger re-render
- SuperGrid constructor injection: will need a new `SuperGridDensityLike` narrow interface (following existing SuperGridProviderLike, SuperGridFilterLike pattern)
- PAFVState may need extension for new density fields (hideEmpty, viewMode) — or SuperDensityState as a new PersistableProvider
- supergrid.handler.ts: may need to accept strftime()-wrapped axis fields in the query config (currently raw column names only)
- Worker protocol (protocol.ts): CellDatum may need extension if spreadsheet mode requires card detail fields beyond count/card_ids

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-superdensity*
*Context gathered: 2026-03-04*
