# Phase 141: Layer 1/2 Event Bridge - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add data-key/data-row/data-col attributes to Layer 1 data cells during render, bridge pointer events from the scroll container to the plugin pipeline, and fix SuperSelect/SuperAudit layer targeting so interactive plugins reach actual data cells. Apply user-select: none to prevent text selection during drag.

</domain>

<decisions>
## Implementation Decisions

### Data Attributes on Cells (Claude's Discretion)
- **D-01:** During the D3 enter+merge in `_renderTable`, set `data-key`, `data-row`, `data-col` attributes from the CellPlacement fields (`.key`, `.rowIdx`, `.colIdx`). These are already available on CellPlacement from PluginTypes.ts (Phase 140 D-03). The existing `.attr('data-row-parity', ...)` call is the natural insertion point.

### Event Bridge Strategy (Claude's Discretion)
- **D-02:** Add a single `pointerdown` listener on `_scrollContainer` (event delegation) that constructs a RenderContext and calls `this._registry.runOnPointerEvent('pointerdown', e, ctx)`. This matches the existing overlay pointerdown pattern (PivotGrid.ts line 120-146) and the v6.0 event delegation decision (two handlers on gridEl, not per-cell closures). The RenderContext should include real `visibleRows`, `allRows`, `visibleCols`, `cells`, and `data` — unlike the overlay handler which passes empty arrays.

### Audit Targeting (Claude's Discretion)
- **D-03:** SuperAuditOverlay and SuperAuditSource `afterRender` hooks should receive the table element (Layer 1) as their `rootEl` for querying data cells, NOT the overlay. This satisfies success criterion 4 ("audit classes to data cells, not overlay divs"). The `afterRender` dispatch in PluginRegistry should pass the appropriate root element — or plugins should query the scroll container / table directly.

### Text Selection Prevention (Claude's Discretion)
- **D-04:** Apply `user-select: none` via CSS on `.pv-data-cell` elements. This prevents browser text selection during lasso drag and shift+click range selection. CSS-only solution, no JS preventDefault needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PivotGrid (Layer 1 + Layer 2 rendering)
- `src/views/pivot/PivotGrid.ts` — `_renderTable` (line 395-438, data cell D3 join at line 427), overlay pointerdown handler (line 119-146), Layer 1/2 element setup (line 105-149)

### Plugin Pipeline
- `src/views/pivot/plugins/PluginTypes.ts` — `CellPlacement` (has `.key`, `.rowIdx`, `.colIdx`), `RenderContext`, `PluginHook.onPointerEvent` signature
- `src/views/pivot/plugins/PluginRegistry.ts` — `runOnPointerEvent` (line 153-157), `runAfterRender` (line 138-143)

### SuperSelect plugins (consumers of data-key/data-row/data-col)
- `src/views/pivot/plugins/SuperSelectClick.ts` — reads `data-key`, `data-row`, `data-col` from cells (line 92-94), sets `data-selected` (line 124)
- `src/views/pivot/plugins/SuperSelectLasso.ts` — reads `data-key` from cells (line 116)
- `src/views/pivot/plugins/SuperSelectKeyboard.ts` — keyboard navigation via onPointerEvent

### SuperAudit plugins (consumers of data-key)
- `src/views/pivot/plugins/SuperAuditOverlay.ts` — reads `data-key` from cells (line 75), applies audit CSS classes
- `src/views/pivot/plugins/SuperAuditSource.ts` — reads `data-key` (line 40), sets `data-source` attribute (line 45)

### Styles
- `src/styles/pivot.css` — existing data cell styles (`.pv-data-cell`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Overlay pointerdown pattern** (PivotGrid.ts line 120-146): Nearly identical structure needed for scroll container — build RenderContext, call runOnPointerEvent
- **CellPlacement fields**: `.key`, `.rowIdx`, `.colIdx` already populated by Phase 140 cell array construction — direct source for data attributes
- **Event delegation from v6.0**: Two handlers on container (not per-cell closures) — established pattern to follow

### Established Patterns
- D3 `.attr()` chaining in enter+merge for data attributes (see `data-row-parity` at line 436)
- Plugin `onPointerEvent` returns boolean (consumed) — first plugin to return true stops propagation
- Plugin `afterRender` receives `RenderContext` with `rootEl` — plugins query within that root

### Integration Points
- `_renderTable` enter+merge chain: add `.attr('data-key', d => d.key)` etc.
- `_scrollContainer` constructor: add pointerdown listener (parallel to overlay listener)
- `PluginRegistry.runAfterRender`: may need to pass table element as rootEl (or add tableEl to RenderContext)
- `pivot.css`: add `user-select: none` rule for `.pv-data-cell`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user confirmed existing patterns and success criteria are sufficient to guide implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 141-layer-event-bridge*
*Context gathered: 2026-04-07*
