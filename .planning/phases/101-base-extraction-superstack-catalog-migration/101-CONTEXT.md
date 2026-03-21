# Phase 101: Base Extraction + SuperStack Catalog Migration - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract core rendering into plugin factories (base.grid, base.headers, base.config) and migrate SuperStack plugins (superstack.collapse, superstack.aggregate) from HarnessShell closure wiring into registerCatalog(). After this phase, all 5 plugins are registered via registerCatalog() with real factories, HarnessShell has zero post-hoc setFactory() overrides for shared-state plugins, and the stub count drops from 15 to 10.

</domain>

<decisions>
## Implementation Decisions

### Shared State Injection
- Factory-with-args pattern: registerCatalog() creates shared state objects (SuperStackState, ZoomState, calcConfig) internally and passes them to factory closures
- No HarnessShell override needed — registerCatalog() is the single source of truth for all shared-state plugins
- Export state constructors (createSuperStackState(), createZoomState(), etc.) for test isolation — tests create their own state instances
- Rerender callback: plugins trigger re-render through registry's onChange mechanism — PivotTable already subscribes to registry.onChange(), so no new API needed

### HarnessShell Cleanup
- Remove ALL existing setFactory() override blocks in HarnessShell (SuperStack, SuperZoom, SuperCalc)
- Clean break: HarnessShell just calls registerCatalog(registry) with no post-hoc wiring
- This applies to all shared-state plugins, not just the 2 SuperStack plugins in scope

### Base Extraction Scope
- **base.grid**: Thin wrapper — PivotGrid keeps its D3 data join logic, the plugin integrates it into the PluginHook lifecycle (transformData/transformLayout as passthroughs, afterRender delegates to PivotGrid.render())
- **base.headers**: Single-level headers only — renders basic column/row headers. superstack.spanning takes over for multi-level. Clean separation: base is foundation, SuperStack extends it
- **base.config**: afterRender mounts PivotConfigPanel into grid's config area, destroy() removes it — plugin lifecycle controls panel lifecycle

### Stub Count Correction
- Roadmap says "26 to 21" but actual FeatureCatalogCompleteness.test.ts shows 15 stubs today (27 total − 12 implemented in registerCatalog)
- Correct numbers: 15 stubs → 10 stubs after this phase (5 new real factories)
- Update FeatureCatalogCompleteness.test.ts: add 5 IDs to `implemented` list, update stub count assertion from 15 to 10

### Testing Strategy
- Unit tests with mock RenderContext for each of the 5 plugins — fast, isolated, follows existing SuperSize/SuperSort test pattern
- Base plugins (grid/headers/config): lifecycle verification only — test that factory creates valid PluginHook, afterRender is callable, destroy cleans up. Don't re-test PivotGrid/PivotConfigPanel rendering (already tested elsewhere)
- SuperStack plugins (collapse/aggregate): behavioral tests verifying shared state interaction (click header → collapsedSet updates, aggregate sums appear)
- FeatureCatalogCompleteness.test.ts updated in same phase: stub count 15→10, 5 new IDs in implemented list (D-020 mechanical TDD enforcement)

### Claude's Discretion
- Exact thin-wrapper implementation details for base.grid/base.headers
- How registerCatalog() structures its internal shared state creation (ordering, variable naming)
- Mock RenderContext shape for tests (minimal fields needed for each plugin)
- Whether to create a shared test factory helper or inline per test file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin Architecture
- `src/views/pivot/plugins/PluginRegistry.ts` — Registry API: register(), setFactory(), enable/disable, pipeline execution (runTransformData/runTransformLayout/runAfterRender/runOnPointerEvent)
- `src/views/pivot/plugins/FeatureCatalog.ts` — Full 27-feature taxonomy, NOOP_FACTORY sentinel, registerCatalog() function (THIS IS THE PRIMARY FILE BEING MODIFIED)
- `src/views/pivot/plugins/PluginTypes.ts` — PluginHook interface, PluginFactory type, PluginMeta type, RenderContext, CellPlacement, GridLayout

### HarnessShell (override removal target)
- `src/views/pivot/harness/HarnessShell.ts` — Current shared-state wiring via setFactory() closures (lines 47-80). ALL override blocks removed after migration.

### SuperStack Plugins (migration targets)
- `src/views/pivot/plugins/SuperStackCollapse.ts` — Existing collapse implementation with SuperStackState interface, buildCollapseKey(), afterRender/onPointerEvent hooks
- `src/views/pivot/plugins/SuperStackAggregate.ts` — Existing aggregate implementation, reads shared collapsedSet, afterRender hook with SUM computation
- `src/views/pivot/plugins/SuperStackSpans.ts` — Already registered in registerCatalog(), uses same SuperStackState — reference for shared state pattern

### Base Components (extraction sources)
- `src/views/pivot/PivotGrid.ts` — Core cell rendering via D3 data join (base.grid extraction source)
- `src/views/pivot/PivotTable.ts` — Orchestrator managing dimensions, grid, config panel (base.headers extraction source)
- `src/views/pivot/PivotConfigPanel.ts` — DnD axis assignment panel (base.config extraction source)

### Testing
- `tests/views/pivot/FeatureCatalogCompleteness.test.ts` — Completeness guard: 6-assertion suite, stub count (currently 15, target 10), implemented list
- `tests/views/pivot/SuperSize.test.ts` — Reference pattern for plugin unit tests with mock RenderContext
- `tests/views/pivot/SuperZoom.test.ts` — Reference pattern for shared-state plugin tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PluginRegistry.setFactory()` — hot-swap factory for registered plugins, handles destroy+recreate if enabled
- `NOOP_FACTORY` with `__isNoopStub` brand — sentinel for stub detection via `getStubIds()`
- `SuperStackState` interface — shared collapsedSet already defined in SuperStackCollapse.ts
- `createZoomState()` — shared zoom state factory already exported from SuperZoomWheel.ts

### Established Patterns
- Factory function naming: `create{PluginName}Plugin` (e.g., createSuperStackSpansPlugin)
- Plugin files: one file per plugin in `src/views/pivot/plugins/`
- Test files: `tests/views/pivot/{PluginName}.test.ts`
- Shared state: plain objects/Maps passed to factory closures (not classes)
- Registration order in FeatureCatalog: dependencies registered before dependents (enforced by completeness test)

### Integration Points
- `registerCatalog()` is the single function called by HarnessShell constructor
- PivotTable subscribes to `registry.onChange()` for re-render triggers
- `FeaturePanel` reads `registry.getByCategory()` for toggle UI — adding real factories doesn't change the panel

</code_context>

<specifics>
## Specific Ideas

- The shared state creation in registerCatalog() should mirror the exact pattern currently in HarnessShell (lines 51-79) — same state shape, same factory closure signatures
- SuperZoom and SuperCalc override removal is "bonus cleanup" — it's included because shared state moves into registerCatalog(), not because those plugins are in scope
- The rerender callback for superstack.collapse should use registry.onChange() rather than a direct PivotTable reference — this decouples the plugin from the host component

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 101-base-extraction-superstack-catalog-migration*
*Context gathered: 2026-03-21*
