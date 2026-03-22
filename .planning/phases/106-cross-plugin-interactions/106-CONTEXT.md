# Phase 106: Cross-Plugin Interactions - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify that multiple plugins active simultaneously do not crash, corrupt shared state, or produce wrong pipeline output. Does NOT add new plugins, modify plugin implementations, or create E2E specs (Phase 107). Pure test coverage for cross-plugin correctness.

</domain>

<decisions>
## Implementation Decisions

### Coupling pair identification
- Derive the 7 coupling pairs from FeatureCatalog dependency graph + shared state imports — Claude reads the actual code to identify pairs that share data or pipeline output
- Test only shared hooks per pair: if both plugins implement transformData, test that combo; skip hooks where only one plugin participates
- Assert expected combined behavior, not just no-crash — e.g., sort+scroll: sorted data through virtual window should contain a sorted subset
- Triple combos (sort+filter+density, search+select+scroll) are additional tests beyond the pairwise suite, not replacements for pairs

### Shared state isolation
- Each test gets fresh state via makePluginHarness() — isolation by construction
- Add a dedicated isolation test: Test A mutates shared state objects (ZoomState, SelectionState, etc.), Test B asserts all are clean defaults. Proves no leakage between tests
- Whether to cover all states in one test or one per state type is Claude's discretion

### Pipeline ordering
- Assert getRegistrationOrder() matches expected sequence — uses existing PluginRegistry API
- Derive expected sequence from FEATURE_CATALOG array order (import + map to IDs), not hard-coded — stays in sync automatically if catalog order changes intentionally

### Test file organization
- One file per concern:
  - CrossPluginPairs.test.ts (7 pairwise tests)
  - CrossPluginTriples.test.ts (2 triple combo tests)
  - CrossPluginSmoke.test.ts (all-27 smoke test)
  - CrossPluginOrdering.test.ts (ordering assertions + state isolation)
- All files in tests/views/pivot/ alongside existing plugin tests (flat, not subdirectory)
- Claude generates representative test data for the all-27 smoke test — enough variety (multiple rows/columns, different types) to exercise all plugins

### Claude's Discretion
- Exact identification of the 7 coupling pairs from dependency graph analysis
- Representative test data shape and values for smoke test
- Whether state isolation covers all states in one test or per-state-type
- Internal describe block structure within each test file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 104 test infrastructure (consume these)
- `tests/views/pivot/helpers/makePluginHarness.ts` — Shared harness factory returning { registry, catalog, ctx, enable, disable, runPipeline }
- `tests/views/pivot/helpers/usePlugin.ts` — Auto-destroy wrapper with afterEach cleanup
- `tests/views/pivot/helpers/mockContainerDimensions.ts` — jsdom layout helper for SuperScroll
- `tests/views/pivot/helpers/pluginHarness.test.ts` — Reference tests for harness itself

### Plugin implementations (analyze for coupling pairs)
- `src/views/pivot/plugins/FeatureCatalog.ts` — Full 27-plugin taxonomy with dependency graph + shared state creation functions (createZoomState, createSelectionState, createSearchState, createDensityState, createAuditPluginState)
- `src/views/pivot/plugins/PluginRegistry.ts` — Registry lifecycle: register, enable, disable, pipeline execution (runTransformData, runTransformLayout, runAfterRender), getRegistrationOrder()
- `src/views/pivot/plugins/PluginTypes.ts` — PluginHook, RenderContext, GridLayout, CellPlacement interfaces

### Shared state objects (test for isolation)
- `src/views/pivot/plugins/SuperZoomWheel.ts` — createZoomState()
- `src/views/pivot/plugins/SuperSelectClick.ts` — createSelectionState()
- `src/views/pivot/plugins/SuperSearchInput.ts` — createSearchState()
- `src/views/pivot/plugins/SuperDensityModeSwitch.ts` — createDensityState()
- `src/views/pivot/plugins/SuperAuditOverlay.ts` — createAuditPluginState()
- `src/views/pivot/plugins/SuperStackCollapse.ts` — SuperStackState

### Phase 105 completeness pattern
- `tests/views/pivot/PluginLifecycleCompleteness.test.ts` — D-019 completeness guard pattern to mirror

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- makePluginHarness(): fully wired factory with all 27 plugins registered, none enabled by default — tests call harness.enable('plugin-id') to selectively activate
- usePlugin(): auto-destroy wrapper that registers afterEach cleanup
- PluginRegistry.getRegistrationOrder(): returns plugin IDs in Map insertion order — directly testable
- FEATURE_CATALOG array: iterable for deriving expected ordering sequence

### Established Patterns
- @vitest-environment jsdom annotation per test file (v6.1 convention)
- Anti-patching rule: if a test fails, fix the app — never weaken assertions
- vi.spyOn for event listener tracking (used in Phase 105 destroy tests)
- D-019 completeness guard: ensures all catalog entries have corresponding tests

### Integration Points
- Each shared state factory (createZoomState, createSelectionState, etc.) is called in registerCatalog() and passed to plugin factories via closures
- Pipeline execution follows Map insertion order — order is set by FEATURE_CATALOG array position during registerCatalog()
- Dependencies field in PluginMeta determines auto-enable cascading

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

*Phase: 106-cross-plugin-interactions*
*Context gathered: 2026-03-21*
