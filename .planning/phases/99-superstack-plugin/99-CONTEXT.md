# Phase 99: SuperStack Plugin - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire real PluginHook factories for the 3 SuperStack sub-features — `superstack.spanning`, `superstack.collapse`, and `superstack.aggregate` — replacing the noop factories registered in FeatureCatalog. Integrate the PluginRegistry pipeline into PivotGrid so all future plugins benefit from the same hooks.

</domain>

<decisions>
## Implementation Decisions

### Plugin-Grid bridge
- PivotGrid.render() calls registry pipeline hooks (runTransformData, runTransformLayout, runAfterRender) at the correct points in its render cycle — one integration, all future plugins benefit
- HarnessShell passes PluginRegistry into PivotTable via constructor injection; PivotTable stays self-contained (works without registry for tests/standalone use)
- On registry.onChange, PivotTable triggers a full re-render with the same data — simple, correct, clean slate for plugins each cycle
- base.headers keeps its noop factory — PivotGrid already renders grouped headers natively; SuperStack enhances what's there

### Spanning algorithm
- Port the old SuperStackHeader.buildHeaderCells() (Phase 7) into a new pivot/plugins/SuperStackSpans.ts — adapt output from CSS Grid positions to overlay-compatible absolute positioning
- When superstack.spanning is enabled, it replaces the default PivotSpans.calculateSpans() as the header span calculator; when disabled, base PivotSpans runs as normal
- Carry over the cardinality guard (MAX_LEAF_COLUMNS=50) — prevents rendering explosions with high-cardinality dimensions, excess values collapse into 'Other' bucket
- PivotSpans.ts stays untouched — simple base case preserved

### Collapse UX
- Single click anywhere on a non-leaf header cell toggles collapse/expand (onPointerEvent hook)
- Both row AND column headers are collapsible
- Visual indicator: inline chevron + hidden count — `▶ 2024 (12)` collapsed, `▼ 2024` expanded
- Collapse state is session-only, held in the superstack.collapse plugin instance's collapsedSet — survives re-renders but resets on disable/re-enable or page refresh
- collapsedSet uses the existing `"level\x1fparentPath\x1fvalue"` key format from old SuperStackHeader

### Aggregate display
- Default aggregate function is SUM for all collapsed groups (global, not per-group)
- When a column group is collapsed to 1 column, each row's data cell in that column shows the SUM of all hidden child values — true pivot table collapse behavior
- Same for row collapse: when a row group is collapsed, each column's data cell in that row shows the SUM
- Aggregated cells get a subtle background tint (CSS class) to distinguish computed values from raw data
- Per-group aggregate config deferred — SuperCalc category handles that separately

### Claude's Discretion
- Exact CSS color for aggregate tint
- How superstack.spanning plugin communicates collapse state to superstack.collapse (shared reference vs RenderContext)
- Error handling for edge cases (empty data, single-level dimensions, all-collapsed state)
- Test structure and file organization within tests/views/pivot/

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin system (Phase 98)
- `src/views/pivot/plugins/PluginRegistry.ts` — register/enable/disable, pipeline hooks (transformData/transformLayout/afterRender/onPointerEvent/onScroll)
- `src/views/pivot/plugins/PluginTypes.ts` — PluginHook interface, PluginFactory, GridLayout, CellPlacement, RenderContext
- `src/views/pivot/plugins/FeatureCatalog.ts` — 27 sub-features with noop factories; superstack.* entries define dependency chain

### Pivot rendering (Phase 97)
- `src/views/pivot/PivotGrid.ts` — Two-layer rendering (invisible table + floating overlay), header span rendering, scroll tracking, resize handles
- `src/views/pivot/PivotSpans.ts` — calculateSpans() run-length encoder (base case to preserve)
- `src/views/pivot/PivotTable.ts` — Orchestrator wiring config panel + grid; needs registry injection
- `src/views/pivot/PivotTypes.ts` — HeaderDimension, SpanInfo, PivotState types

### Old SuperStack (Phase 7 — port source)
- `src/views/supergrid/SuperStackHeader.ts` — buildHeaderCells() with collapse support, parent-path tracking, cardinality guard, HeaderCell type; PORT this algorithm to new module

### Harness (Phase 98)
- `src/views/pivot/harness/HarnessShell.ts` — Creates PluginRegistry + PivotTable; needs to pass registry into PivotTable

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperStackHeader.buildHeaderCells()`: Full collapse-aware spanning algorithm with parent-path, cardinality guard — port to new module
- `SuperStackHeader.HeaderCell` type: colStart, colSpan, isCollapsed, parentPath, level — adapt for overlay positioning
- `PivotSpans.calculateSpans()`: Simple run-length encoder — preserved as base case when SuperStack disabled
- `PluginRegistry` pipeline: transformData → transformLayout → afterRender → onPointerEvent → onScroll — all hooks available

### Established Patterns
- Two-layer rendering: invisible `<table>` for scroll sizing + absolute-positioned overlay `<div>` elements for visible headers
- D3 data join with stable key functions for all DOM updates
- Pointer events (not HTML5 DnD) for all interactions
- `--pv-*` CSS custom property namespace for pivot table design tokens
- `localStorage` persistence for toggle state via PluginRegistry.saveState()/restoreState()

### Integration Points
- `PivotTable` constructor — add optional `PluginRegistry` parameter
- `PivotGrid.render()` — insert registry pipeline calls between span calculation and DOM rendering
- `HarnessShell` constructor — pass existing registry instance to PivotTable
- `FeatureCatalog.registerCatalog()` — replace noop factories for superstack.* IDs with real factory functions

</code_context>

<specifics>
## Specific Ideas

- Working down the FeatureCatalog list in order: SuperStack first, then SuperZoom, SuperSize, etc. in subsequent phases
- The old SuperStackHeader is the proven reference — port its logic, don't reinvent
- collapsedSet key format `"level\x1fparentPath\x1fvalue"` is load-bearing from Phase 7 — preserve it exactly

</specifics>

<deferred>
## Deferred Ideas

- Per-group aggregate function config — belongs in SuperCalc category
- Collapse animation/transition — nice-to-have, not in scope for initial implementation
- Keyboard navigation for collapse/expand — belongs in accessibility pass
- Real data source integration (alto-index JSON, sql.js) — separate data source phase

</deferred>

---

*Phase: 99-superstack-plugin*
*Context gathered: 2026-03-20*
