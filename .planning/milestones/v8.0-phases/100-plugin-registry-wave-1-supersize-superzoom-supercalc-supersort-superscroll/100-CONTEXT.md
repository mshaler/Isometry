# Phase 100: Plugin Registry Wave 1 — SuperSize, SuperZoom, SuperCalc, SuperSort, SuperScroll - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire real PluginHook factories for 5 categories (10 sub-features) replacing noop stubs in FeatureCatalog: SuperSize (3), SuperZoom (2), SuperCalc (2), SuperSort (2), SuperScroll (2). Each plugin follows the same factory + TDD pattern established in Phase 99 for SuperStack.

</domain>

<decisions>
## Implementation Decisions

### Porting strategy
- Port algorithm, new DOM — extract core logic (zoom math, resize drag state machine, virtualizer windowing) from old SuperGrid modules but rewrite all DOM interaction to target PivotGrid two-layer architecture
- Same approach used for SuperStackSpans in Phase 99 — proven pattern
- Old modules are reference only: SuperZoom.ts (196 LOC), SuperGridSizer.ts (375 LOC), SuperGridVirtualizer.ts (127 LOC)

### CSS namespace
- All plugins use --pv-* shared CSS namespace (per D-016)
- No per-plugin namespaces — e.g., --pv-zoom, --pv-col-width-N, --pv-footer-height

### Resize handles
- Column resize handles render on Layer 2 overlay headers (not invisible Layer 1 table)
- onPointerEvent hook handles drag interaction
- Consistent with how users see and interact with headers

### Zoom UI
- Zoom slider control in HarnessShell sidebar under SuperZoom toggles
- Plugin's afterRender applies CSS scaling; sidebar provides the slider input
- Wheel zoom via onPointerEvent (Ctrl+wheel / pinch gesture from old SuperZoom)

### Implementation order
- Visual first: SuperSize → SuperZoom → SuperScroll → SuperSort → SuperCalc
- Start with resize/zoom (instant visual feedback, no data dependency), then scroll (visual + performance), then sort/calc (need data interaction)
- All 10 sub-features ship in this phase — each plugin is small (50-150 LOC)

### File organization
- One file per sub-feature in src/views/pivot/plugins/
- 10 new files: SuperSizeColResize.ts, SuperSizeHeaderResize.ts, SuperSizeUniformResize.ts, SuperZoomSlider.ts, SuperZoomScale.ts, SuperCalcFooter.ts, SuperCalcConfig.ts, SuperSortHeaderClick.ts, SuperSortChain.ts, SuperScrollVirtual.ts, SuperScrollStickyHeaders.ts (11 counting sticky-headers)
- Matches Phase 99 pattern (SuperStackSpans.ts, SuperStackCollapse.ts, SuperStackAggregate.ts)

### Data interaction
- In-memory computation — plugins compute aggregates/sort/windowing directly on CellPlacement[] array in transformData hooks
- No Worker, no SQL — JS array operations on mock data, sufficient for 100-1000 cell datasets
- Real SQL integration deferred to data source progression phases

### SuperCalc rendering
- afterRender overlay — sticky-positioned div below the grid, managed by supercalc.footer plugin's afterRender hook
- Consistent with two-layer overlay pattern, survives scroll
- supercalc.config adds a per-column dropdown to pick aggregate function (SUM/AVG/COUNT/MIN/MAX)

### Sort state
- Session-only — sort resets on page refresh
- Consistent with how SuperStack collapse works
- Real persistence comes when integrated with full app's StateManager

### Harness additions
- Minimal — toggle on/off sufficient for most plugins
- Only add harness sidebar UI where the plugin can't be used without it (supercalc.config dropdown)
- Zoom and sort work via direct grid interaction (wheel/click)

### Stub gate
- After Phase 100, 5 categories must have zero stubs: SuperSize, SuperZoom, SuperCalc, SuperSort, SuperScroll
- Remaining categories (SuperDensity, SuperSearch, SuperSelect, SuperAudit) stay stubbed for future waves
- FeatureCatalogCompleteness.test.ts stub count assertion updated accordingly

### Claude's Discretion
- Exact zoom clamping range (old code used ZOOM_MIN/ZOOM_MAX from SuperPositionProvider)
- Auto-fit behavior on double-click resize
- Virtual scrolling sentinel/spacer implementation details
- Sort indicator styling (arrows, opacity, position)
- Footer row sticky positioning CSS
- Edge case handling (zero data, single column/row, all-collapsed + sort interaction)
- Test file organization within tests/views/pivot/

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin system (Phase 98)
- `src/views/pivot/plugins/PluginRegistry.ts` — register/enable/disable, pipeline hooks, onChange, saveState/restoreState
- `src/views/pivot/plugins/PluginTypes.ts` — PluginHook interface (transformData/transformLayout/afterRender/onPointerEvent/onScroll/destroy), PluginFactory, GridLayout, CellPlacement, RenderContext
- `src/views/pivot/plugins/FeatureCatalog.ts` — 27 sub-features with noop factories; 10 sub-features targeted in this phase

### Phase 99 reference pattern
- `src/views/pivot/plugins/SuperStackSpans.ts` — Canonical example of porting old algorithm to new plugin factory
- `src/views/pivot/plugins/SuperStackCollapse.ts` — onPointerEvent hook pattern for click-to-interact
- `src/views/pivot/plugins/SuperStackAggregate.ts` — afterRender hook pattern for computed overlay content

### Old SuperGrid modules (port sources)
- `src/views/supergrid/SuperZoom.ts` — Wheel zoom math, normalizeWheelDelta, wheelDeltaToScaleFactor, CSS custom property updates
- `src/views/supergrid/SuperGridSizer.ts` — Column resize pointer events state machine, auto-fit, Shift+drag normalize, MIN_COL_WIDTH/AUTO_FIT_PADDING constants
- `src/views/supergrid/SuperGridVirtualizer.ts` — Data windowing, getVisibleRange(), sentinel spacer
- `src/views/supergrid/SuperGridQuery.ts` — SQL ORDER BY injection for sort (reference for sort logic concept only)

### Pivot rendering (Phase 97)
- `src/views/pivot/PivotGrid.ts` — Two-layer rendering, scroll tracking, resize handles, plugin pipeline call sites
- `src/views/pivot/PivotSpans.ts` — calculateSpans() base case
- `src/views/pivot/PivotTable.ts` — Orchestrator; registry injection point
- `src/views/pivot/PivotTypes.ts` — HeaderDimension, SpanInfo, PivotState types

### Test pattern
- `tests/views/pivot/FeatureCatalogCompleteness.test.ts` — Registry completeness suite (D-019), stub count assertion to update

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperZoom.normalizeWheelDelta()` / `wheelDeltaToScaleFactor()`: Pure functions — port directly, no DOM dependency
- `SuperGridSizer` drag state machine: DragState interface with startX/startWidth/pointerId — adapt for overlay positioning
- `SuperGridVirtualizer.getVisibleRange()`: Pure windowing math — port to transformData filter
- `PluginRegistry` pipeline: transformData → transformLayout → afterRender → onPointerEvent → onScroll — all hooks available
- `GridLayout.colWidths` Map and `GridLayout.zoom` already exist in PluginTypes.ts — designed for SuperSize and SuperZoom

### Established Patterns
- Two-layer rendering: invisible table for scroll sizing + absolute-positioned overlay for visible headers
- Plugin factory pattern: export `createXxxPlugin: PluginFactory` function, register via `registry.setFactory(id, factory)`
- D3 data join with stable key functions for all DOM updates
- Pointer events (not HTML5 DnD) for all interactions (D-017)
- `--pv-*` CSS custom property namespace (D-016)
- NOOP_FACTORY sentinel with `__isNoopStub` brand (D-020)

### Integration Points
- `FeatureCatalog.registerCatalog()` — add `registry.setFactory()` calls for each new plugin (like line 289 for SuperStack)
- `PivotGrid.render()` — plugin pipeline already wired from Phase 99
- `HarnessShell` sidebar — toggle tree auto-reflects registered plugins; minimal additions needed
- `GridLayout` interface — colWidths and zoom properties already exist for SuperSize/SuperZoom consumption

</code_context>

<specifics>
## Specific Ideas

- Working down the FeatureCatalog list in category order: SuperSize → SuperZoom → SuperScroll → SuperSort → SuperCalc
- Each plugin should be self-contained — enable/disable via toggle without affecting others (beyond declared dependencies)
- The old SuperZoom asymmetric scale formula gives a natural zoom feel — preserve that specific math
- Column resize auto-fit (dblclick) measures content width + padding — same UX as old SuperGridSizer
- Virtual scrolling is data windowing (transformData filters rows), NOT DOM virtualization — preserves D3 data join ownership

</specifics>

<deferred>
## Deferred Ideas

- SuperDensity, SuperSearch, SuperSelect, SuperAudit plugins — future Wave 2 phase
- Real SQL data source integration (alto-index JSON, sql.js Worker queries) — separate data source phase
- localStorage persistence for sort/zoom state — deferred until full app StateManager integration
- Large dataset harness option (1K+ cells) — add when virtual scrolling needs visual stress testing
- Keyboard shortcuts for zoom (Cmd+=/Cmd+-) — belongs in accessibility pass

</deferred>

---

*Phase: 100-plugin-registry-wave-1-supersize-superzoom-supercalc-supersort-superscroll*
*Context gathered: 2026-03-21*
