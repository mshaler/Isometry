# Phase 105: Individual Plugin Lifecycle - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every one of the 27 plugins is verified to correctly execute each hook (transformData, transformLayout, afterRender, destroy) in isolation and clean up all listeners after destroy. Does NOT add new plugins, test cross-plugin interactions (Phase 106), or create E2E specs (Phase 107).

</domain>

<decisions>
## Implementation Decisions

### Test organization
- Extend existing test files (SuperSort.test.ts, SuperCalc.test.ts, etc.) with lifecycle describe blocks — keeps all tests for a plugin family together
- Migrate all existing inline makeCtx() usage to makePluginHarness() from Phase 104 — single shared factory, eliminate duplication
- Replace overlapping tests: when a new harness-based lifecycle test covers the same assertion as an old inline-makeCtx test, remove the old one. Net fewer tests but all on shared factory
- Registry completeness test: a single test asserts every FEATURE_CATALOG ID has a corresponding describe block or test case across the suite (mirrors D-019 pattern from v8.0)

### Hook coverage depth
- **transformData**: assert returned array preserves keys, length is correct (e.g., SuperScroll filters rows), no data corruption. Shape + invariants, not just no-throw
- **transformLayout**: verify expected mutations — e.g., SuperZoom multiplies cellWidth by zoom factor, SuperSize sets colWidths. Tests the actual contract
- **afterRender**: DOM assertions — assert expected elements exist (e.g., .pv-calc-footer for SuperCalc, input for SuperSearch). Catches render regressions
- **Undefined hooks**: for plugins that don't implement a given hook (e.g., base.grid has no transformData), explicitly assert the hook is undefined — documents the contract and catches accidental additions

### Destroy verification
- Spy on addEventListener/removeEventListener: vi.spyOn(element, 'addEventListener') before init, then after destroy() assert removeEventListener was called for each add. Precise leak detection
- No-listener plugins (render-only like SuperStackSpans, SuperDensityCountBadge): assert destroy() is defined and callable, no-throw. Listener spy shows zero pairs — that's correct
- Double-destroy safety: call destroy() twice per plugin, assert no throw on second call. One test per plugin to catch missing null guards

### SuperScroll threshold (LIFE-05)
- Boundary pair testing: exactly 99 rows (no windowing) and exactly 100 rows (windowing activates)
- Below threshold: assert all CellPlacement rows survive transformData (no filtering) AND no sentinel spacer elements in DOM after afterRender
- Above threshold: assert transformData returns fewer rows than input AND sentinel spacer elements exist in DOM. Proves windowing activated without testing exact visible range
- Uses mockContainerDimensions() from Phase 104 for jsdom layout

### Claude's Discretion
- Exact DOM selector strings for afterRender assertions per plugin
- Whether to use dynamic import or static import per test file (follow existing convention)
- Internal test helper organization within each test file
- How to structure the completeness guard test (loop over FEATURE_CATALOG vs explicit ID list)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 104 test infrastructure (consume these)
- `tests/views/pivot/helpers/makePluginHarness.ts` — Shared harness factory returning { registry, catalog, ctx, enable, disable, runPipeline }
- `tests/views/pivot/helpers/usePlugin.ts` — Auto-destroy wrapper with afterEach cleanup
- `tests/views/pivot/helpers/mockContainerDimensions.ts` — jsdom layout helper for SuperScroll
- `tests/views/pivot/helpers/pluginHarness.test.ts` — Reference tests for harness itself

### Plugin implementations (test targets)
- `src/views/pivot/plugins/FeatureCatalog.ts` — Full 27-plugin taxonomy + registerCatalog() with shared state creation
- `src/views/pivot/plugins/PluginRegistry.ts` — Registry lifecycle: register, enable, disable, pipeline execution (runTransformData, runTransformLayout, runAfterRender)
- `src/views/pivot/plugins/PluginTypes.ts` — PluginHook, RenderContext, GridLayout, CellPlacement interfaces

### Existing test files (extend with lifecycle coverage)
- `tests/views/pivot/BasePlugins.test.ts` — base.grid, base.headers, base.config
- `tests/views/pivot/SuperSort.test.ts` — supersort.header-click, supersort.chain
- `tests/views/pivot/SuperCalc.test.ts` — supercalc.footer, supercalc.config
- `tests/views/pivot/SuperScroll.test.ts` — superscroll.virtual, superscroll.sticky-headers
- `tests/views/pivot/SuperSize.test.ts` — supersize.col-resize, supersize.header-resize, supersize.uniform-resize
- `tests/views/pivot/SuperZoom.test.ts` — superzoom.slider, superzoom.scale
- `tests/views/pivot/SuperDensity.test.ts` — superdensity.mode-switch, superdensity.mini-cards, superdensity.count-badge
- `tests/views/pivot/SuperSearch.test.ts` — supersearch.input, supersearch.highlight
- `tests/views/pivot/SuperSelect.test.ts` — superselect.click, superselect.lasso, superselect.keyboard
- `tests/views/pivot/SuperAudit.test.ts` — superaudit.overlay, superaudit.source
- `tests/views/pivot/SuperStackSpans.test.ts` — superstack.spanning
- `tests/views/pivot/SuperStackCollapse.test.ts` — superstack.collapse
- `tests/views/pivot/SuperStackAggregate.test.ts` — superstack.aggregate

### Completeness pattern (mirror this)
- `tests/views/pivot/FeatureCatalogCompleteness.test.ts` — D-019 registry completeness suite pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- makePluginHarness(): fully wired factory with all 27 plugins registered, none enabled by default — tests call harness.enable('plugin-id')
- usePlugin(): auto-destroy wrapper that registers afterEach cleanup — prevents listener accumulation
- mockContainerDimensions(): sets clientHeight/scrollTop/getBoundingClientRect on jsdom elements
- FEATURE_CATALOG array: iterable list of all 27 plugin IDs for completeness guards

### Established Patterns
- @vitest-environment jsdom annotation per test file (v6.1 convention)
- Anti-patching rule: if a test fails, fix the app — never weaken assertions
- Dynamic import pattern for plugin factories (avoids circular dependency issues)
- vi.spyOn for event listener tracking (used in SuperSelect.test.ts for pointer events)
- D-019 completeness guard: 6-assertion pattern ensuring all catalog entries have corresponding tests

### Integration Points
- Each existing test file gets new lifecycle describe blocks added
- All inline makeCtx() calls replaced with makePluginHarness() imports
- Overlapping old tests removed when new harness-based tests cover same assertion
- New PluginLifecycleCompleteness.test.ts (or added to existing completeness file) for the 27-plugin coverage guard

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

*Phase: 105-individual-plugin-lifecycle*
*Context gathered: 2026-03-21*
