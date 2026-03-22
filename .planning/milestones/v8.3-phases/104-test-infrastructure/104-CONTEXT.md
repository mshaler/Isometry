# Phase 104: Test Infrastructure - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared test helpers exist so every plugin test can spin up an isolated, realistic harness in one call. Covers: makePluginHarness() factory, usePlugin() auto-destroy wrapper, mockContainerDimensions() layout helper, E2E Playwright helpers in e2e/helpers/harness.ts, and HarnessShell ?harness=1 entry point verification. Does NOT add new plugins, write plugin-specific tests (Phase 105), or create E2E specs (Phase 107).

</domain>

<decisions>
## Implementation Decisions

### Factory API design
- Structured harness object: makePluginHarness() returns { registry, catalog, sharedState, ctx, enable(id), disable(id), runPipeline() } — self-contained with convenience methods
- Real FeatureCatalog with all 27 plugins registered but none enabled by default — tests call harness.enable('super-sort') to activate what they need. Mirrors production boot path
- Optional overrides bag: makePluginHarness({ rows: 200, cols: ['A','B'], containerHeight: 600 }) — defaults for everything, override what you need
- Location: tests/views/pivot/helpers/makePluginHarness.ts — colocated with consumer test files

### Auto-cleanup pattern
- usePlugin(harness, 'super-sort') wrapper enables plugin AND registers afterEach(() => plugin.destroy()) automatically — test authors never write cleanup code
- Returns the PluginHook instance so tests can call hook.transformData(ctx) directly or spy on methods — essential for Phase 105 lifecycle tests

### E2E helper scope
- Separate e2e/helpers/harness.ts file — does NOT extend existing isometry.ts. Clean separation: harness specs import from harness.ts, app specs from isometry.ts
- waitForHarnessReady() uses window.__harnessReady flag (set by HarnessShell after mount), polled via page.waitForFunction(). Matches existing __isometry pattern
- togglePlugin/enablePlugin/disablePlugin use window.__harness.enable('super-sort') / disable() API exposed by HarnessShell — deterministic, no DOM coupling. Sidebar click tests reserved for Phase 107 E2E specs

### HarnessShell entry point
- Query param early branch in main.ts: check URLSearchParams for 'harness' before normal bootstrap, mount HarnessShell instead of normal app
- HarnessShell starts empty (zero rows) — Playwright tests inject data via window API. Keeps harness deterministic — each test controls its own data

### Claude's Discretion
- mockContainerDimensions() internal implementation (Object.defineProperty vs prototype patching)
- Exact shape of the overrides bag type (HarnessOptions interface)
- Whether runPipeline() returns void or the transformed data/layout
- Internal helper organization within tests/views/pivot/helpers/ (single file vs multiple)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing harness code (extend/verify)
- `src/views/pivot/harness/HarnessShell.ts` — Phase 98 browser entry point, needs window.__harnessReady + window.__harness API additions
- `src/views/pivot/harness/FeaturePanel.ts` — Sidebar toggle tree UI for the harness
- `src/views/pivot/plugins/FeatureCatalog.ts` — registerAllPlugins() with all 27 plugin registrations
- `src/views/pivot/plugins/PluginRegistry.ts` — Registry lifecycle (register, enable, disable, pipeline execution)
- `src/views/pivot/plugins/PluginTypes.ts` — RenderContext, PluginHook, PluginFactory, PluginMeta interfaces

### Existing test patterns (consolidate)
- `tests/views/pivot/BasePlugins.test.ts` — inline makeCtx() pattern to be replaced by shared factory
- `tests/views/pivot/PluginRegistry.test.ts` — inline makeMeta() helper, registry lifecycle tests
- `tests/views/pivot/SuperCalc.test.ts` — existing computeAggregate test with makeCtx()

### Existing E2E helpers (do NOT modify, create parallel file)
- `e2e/helpers/isometry.ts` — Main app Playwright helpers (waitForAppReady, importFixture, screenshot)

### Entry point
- `src/main.ts` — Needs ?harness=1 query param branch added before normal bootstrap

### Prior test infrastructure patterns
- `tests/harness/` — v6.1 realDb() + makeProviders() factory pattern (reference for factory design)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- HarnessShell class already exists with full sidebar toggle UI — needs window API additions, not a rewrite
- FeatureCatalog.registerAllPlugins() already wires all 27 plugins — factory calls this directly
- PivotMockData.ts exists for manual exploration but won't be auto-loaded (tests inject their own data)
- e2e/helpers/isometry.ts screenshot() and waitForAppReady() patterns to mirror in harness.ts

### Established Patterns
- @vitest-environment jsdom annotation per test file (v6.1 convention)
- Anti-patching rule: if a test fails, fix the app — never weaken assertions (v6.1)
- Inline makeCtx() duplicated across 17+ test files — this phase eliminates that duplication
- window.__isometry API pattern for E2E programmatic control (main app) — harness mirrors with window.__harness

### Integration Points
- main.ts: early URLSearchParams branch to route to HarnessShell
- HarnessShell: expose window.__harnessReady flag + window.__harness.enable/disable API
- tests/views/pivot/helpers/: new directory for shared Vitest factories
- e2e/helpers/harness.ts: new file parallel to existing isometry.ts

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

*Phase: 104-test-infrastructure*
*Context gathered: 2026-03-21*
