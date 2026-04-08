# Phase 140: Transform Pipeline Wiring - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing PluginRegistry pipeline hooks (`runTransformData`, `runTransformLayout`) into PivotGrid's `render()` method so all 27 plugins can participate in data and layout stages of the render cycle. Unify the duplicate `CellPlacement` type and refactor `_renderTable` to accept pre-built cells + transformed GridLayout.

</domain>

<decisions>
## Implementation Decisions

### Cell Array Construction (Discussed)
- **D-01:** Approach C — build flat `CellPlacement[]` in `render()`, run `runTransformData`, then pass the transformed array to `_renderTable`. Inside `_renderTable`, the existing per-row D3 join pattern stays intact — it looks up cells from a pre-grouped `Map<number, CellPlacement[]>` instead of building them inline with `visibleCols.map(...)`. Minimal refactor preserving the battle-tested D3 per-row join.
- **D-02:** Attach the canonical `CellPlacement[]` to `RenderContext` (e.g., `ctx.cells`) so any plugin (including future copy/export plugins) can access the pre-built cell data without reconstructing it. Zero cost now, enables future multi-format copy (flat grid, HTML table with spans, spreadsheet matrix) without pipeline changes.

### CellPlacement Type Unification
- **D-03:** Delete the private `CellPlacement` interface in PivotGrid.ts (line 47-52) and import from `PluginTypes.ts`. The canonical type includes the `meta?: Record<string, unknown>` field that plugins need for attaching arbitrary metadata during `transformData`.

### Layout Application Timing (Claude's Discretion)
- **D-04:** Build `GridLayout` in `render()` before `_renderTable`, run `runTransformLayout` on it, then pass the transformed layout as a parameter to `_renderTable` (and `_renderOverlay`). `_renderTable` reads sizing from the layout object parameter instead of `this._cellWidth` etc. The private fields remain as defaults/initial values only — the transformed layout is the source of truth for each render pass.

### Verification Scope (Claude's Discretion)
- **D-05:** Two end-to-end smoke tests per roadmap: SuperZoom slider at 1.5x produces visibly larger cells, SuperSort header click reorders data rows. Both verified in harness. No additional plugin behaviors need explicit verification — the "all 52 E2E harness specs pass" criterion covers the rest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PivotGrid (being refactored)
- `src/views/pivot/PivotGrid.ts` — Current `render()` method (line 186-283), `_renderTable` (line 291-403), private `CellPlacement` duplicate (line 47-52), GridLayout construction (line 260-267)

### Plugin Pipeline (already implemented, being wired in)
- `src/views/pivot/plugins/PluginTypes.ts` — Canonical `CellPlacement` (line 56-63), `GridLayout` (line 40-49), `RenderContext` (line 70-83), `PluginHook` with `transformData`/`transformLayout` signatures (line 90-103)
- `src/views/pivot/plugins/PluginRegistry.ts` — `runTransformData` (line 118-125), `runTransformLayout` (line 128-135), `runAfterRender` (line 138-143)

### Plugins that implement transformData/transformLayout (must work after wiring)
- `src/views/pivot/plugins/SuperScrollVirtual.ts` — `transformData` (filters rows for virtual scrolling)
- `src/views/pivot/plugins/SuperSortChain.ts` — `transformData` (reorders rows)
- `src/views/pivot/plugins/SuperSortHeaderClick.ts` — `transformData` (reorders rows via header click)
- `src/views/pivot/plugins/SuperSearchInput.ts` — `transformData` (filters rows by search)
- `src/views/pivot/plugins/SuperZoomWheel.ts` — `transformLayout` (scales dimensions)
- `src/views/pivot/plugins/SuperSizeColResize.ts` — `transformLayout` (per-column widths)
- `src/views/pivot/plugins/SuperSizeUniformResize.ts` — `transformLayout` (uniform resize)
- `src/views/pivot/plugins/SuperSizeHeaderResize.ts` — `transformLayout` (header resize)
- `src/views/pivot/plugins/SuperStackSpans.ts` — `transformLayout` (span adjustments)

### Test Harness
- `tests/views/pivot/helpers/makePluginHarness.ts` — Harness factory used by all plugin tests
- `tests/views/pivot/PluginRegistry.test.ts` — Registry pipeline tests
- `tests/views/pivot/CrossPluginBehavioral.test.ts` — Cross-plugin interaction tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PluginRegistry.runTransformData()` and `runTransformLayout()` — fully implemented, just not called from PivotGrid.render() yet
- `RenderContext` interface — already passed to afterRender, needs `cells` field addition for D-02
- `getCellKey()` from PivotMockData — used to build cell keys, stays as-is

### Established Patterns
- D3 per-row data join in `_renderTable` — `.data(cellData, d => d.key)` pattern. D-01 preserves this exactly.
- Plugin pipeline order: `transformData → transformLayout → render → afterRender` (documented in PluginRegistry header comment, line 7)
- GridLayout constructed as literal object, passed to ctx — same pattern continues, just moves earlier in render()

### Integration Points
- `render()` is the single entry point — called from ViewManager, resize handler, and plugin onChange. All callers are unaffected since the signature doesn't change.
- `_renderTable` signature changes: adds `cells: Map<number, CellPlacement[]>` and `layout: GridLayout` parameters, drops inline construction
- `_renderOverlay` signature changes: adds `layout: GridLayout` parameter so overlay uses transformed sizing too
- `RenderContext` gains `cells: CellPlacement[]` property — non-breaking addition (existing plugins ignore fields they don't use)

</code_context>

<specifics>
## Specific Ideas

- Future copy/export plugin will need access to cells at multiple pipeline stages (flat before transform, structured after). D-02's `ctx.cells` attachment is the forward-looking enabler for this. The actual copy formats (flat grid, HTML with spans, spreadsheet matrix) are a future phase — not specified yet.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-format copy/paste** — Copy cards/headers in multiple formats: flat grid (no spanning), HTML table (with group-by spanning + typography), spreadsheet matrix (Excel-pasteable). Needs its own phase with format specification. D-02 in this phase ensures the data will be accessible when that work begins.

</deferred>

---

*Phase: 140-transform-pipeline-wiring*
*Context gathered: 2026-04-07*
