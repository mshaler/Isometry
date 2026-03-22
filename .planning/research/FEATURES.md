# Feature Research

**Domain:** Plugin E2E test suite — composable plugin interaction testing for a D3/TypeScript pivot grid
**Researched:** 2026-03-21
**Confidence:** HIGH (grounded in existing codebase, established patterns, and cross-referenced against combinatorial testing literature)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any credible plugin test suite must have. Missing these = regression gaps are guaranteed.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Individual lifecycle coverage (all 27 plugins) | Each plugin has transformData/transformLayout/afterRender/destroy — all 4 hooks must be exercised per plugin | MEDIUM | Pattern already established in BasePlugins.test.ts, SuperSort.test.ts, SuperSearch.test.ts etc. Needs to extend to every catalog entry with a consistent factory-return-shape + hook-callable-without-throwing contract |
| Shared state isolation between test cases | ZoomState, SuperStackState, DensityState, SearchState, SelectionState, AuditPluginState are all shared objects — tests must not bleed state | LOW | Use `beforeEach` factory reconstruction (createSearchState(), createZoomState(), etc.) per test; same pattern as existing search/select tests |
| Full-matrix smoke test (all 27 enabled simultaneously) | Verifies no plugin crashes when the full catalog is live — critical for HarnessShell default-all-on scenario | LOW | Single Vitest integration test: registerCatalog(), enable all 27, run pipeline with mock cells, assert no throws |
| destroy() cleanup verification | Removing a plugin mid-session must not leave orphaned DOM/event listeners | LOW | Already demonstrated for single plugins (PluginRegistry.test.ts line 298-312). Needs explicit assertion pattern for all 10 categories |
| Pipeline execution order (transformData chain) | Incorrect ordering causes data corruption — sort before filter vs. after filter produces different results | MEDIUM | Chain order is registration order in PluginRegistry; tests must assert that transformData passes output of step N as input to step N+1 |
| Re-enable creates fresh instance (no stale closure) | Plugin is disabled then re-enabled — old state must not survive | LOW | Pattern established in PluginRegistry.test.ts line 314-330. Needs category-level variants for stateful plugins (SuperSort sort state, SuperSearch term) |
| Playwright smoke against HarnessShell | Toggle checkboxes in sidebar, assert grid changes visually — basic HarnessShell wiring | MEDIUM | `e2e/` dir does not yet exist. playwright.config.ts targets `./e2e`. Standard Page Object pattern. Requires `npm run dev` webserver. |

### Differentiators (Competitive Advantage)

Features that make this test suite meaningfully more useful than per-plugin behavioral tests alone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Targeted pairwise interaction tests (known coupling points) | 70-95% of multi-feature bugs involve exactly 2 plugins (NIST combinatorial research). Targeted pairwise covers the highest-risk couplings at manageable cost | HIGH | Highest-priority pairs: (1) sort+density — SuperSort reorders cells before density mode computes count badges; (2) search+select — filtering cells changes SelectionState validity; (3) scroll+zoom — virtual windowing must recalculate visible range when zoom changes cellHeight; (4) stack+calc — collapsed groups suppress rows that SuperCalc footer would otherwise aggregate; (5) sort+scroll — sorted row order must be stable after virtual windowing truncates rows |
| Triple-interaction stress tests for known risky triples | Some bugs only surface with 3 plugins active — sort+search+density is the highest-risk triple | HIGH | Limit to 3-4 triples max. Candidates: sort+search+density, stack+zoom+scroll, select+audit+search. Each needs an assertion about end-state data correctness, not just "no throw" |
| transformData pipeline contract assertions | Each plugin in the chain must receive the output of the prior plugin. Asserting this prevents ordering bugs silently corrupting data | MEDIUM | Use spy wrappers: spy on each plugin's transformData, assert the input to step N+1 equals the output of step N. One test per risky ordering (sort before/after search) |
| Playwright HarnessShell toggle to DOM assertion tests | Toggle a sidebar checkbox, assert the DOM reflects the plugin's effect (e.g., enable SuperZoom slider, assert `.pv-zoom-slider` appears) | MEDIUM | Covers 10 categories x 1 representative plugin per category = 10 E2E tests. Enough to validate HarnessShell wiring without exhaustive coverage |
| Permanent regression guard for interaction coupling | A dedicated `PluginInteractions.test.ts` file with `PERMANENT GUARD` comment matching the FeatureCatalogCompleteness.test.ts pattern — any new plugin must declare its coupling points | MEDIUM | Single file, 15-20 focused interaction assertions. Guards against future plugin additions breaking existing combos silently |
| Data integrity assertions (not just "no throw") | Cross-plugin tests must verify that cell values after the full pipeline are correct, not just that no exception was thrown | HIGH | Requires a reference dataset: known input cells to known expected output after N plugins applied. PivotMockData.ts already provides fixture data |
| localStorage persistence round-trip for HarnessShell state | HarnessShell persists toggle state to localStorage. Tests should verify: (1) state serializes, (2) reload restores enabled set, (3) dependency enforcement fires on restore | LOW | Vitest-only, no Playwright needed. Mock localStorage with vi.stubGlobal or jsdom's built-in |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full 27x27 exhaustive matrix test | "Test every plugin pair" sounds comprehensive | 27x27 = 729 combinations x test setup cost = slow CI, false confidence. Most pairs have no coupling (SuperZoom and SuperAudit share no state or data). NIST research shows pairwise (2-way) coverage already catches 70-95% of interaction bugs | Targeted pairwise based on shared state objects and data pipeline coupling. Only test pairs that share state or data flow |
| Playwright visual regression screenshots for every plugin combo | Screenshot diffs catch unintended layout changes | 27 combos x browser x viewport = hundreds of baseline images to maintain. Any CSS token change fails unrelated tests. High maintenance, low signal | Reserve Playwright snapshots for layout-critical plugins only: SuperStack spans (header spanning) and SuperZoom scale (cell dimensions). Use DOM assertions for all others |
| Per-plugin Playwright tests (27 separate E2E files) | Matches unit test structure | E2E tests are slow (60s timeout in playwright.config.ts). 27 files x multiple assertions = multi-minute CI. Playwright is for cross-cutting wiring verification, not per-plugin behavior | Keep Playwright to HarnessShell wiring verification (one test per category, ~10 tests total). Per-plugin behavior belongs in Vitest |
| Mocking shared state objects in interaction tests | "True unit test isolation" | Mocking ZoomState or SearchState defeats the purpose of interaction testing — the test is verifying that two real plugins communicate correctly through shared state | Use real createZoomState(), createSearchState() etc. in interaction tests. Mock only at the DOM boundary (jsdom) |
| Real database queries in plugin interaction tests | "Test the full stack" | Plugin pipeline operates on CellPlacement[] — it never touches sql.js. Pulling in realDb() adds WASM initialization cost and couples unrelated layers | Plugin interaction tests are pure TypeScript array transforms. Only seam tests (tests/seams/) need realDb(). Keep layers separate |

---

## Feature Dependencies

```
Individual lifecycle tests (all 27)
    └──prerequisite for──> Targeted pairwise tests
                               └──prerequisite for──> Triple interaction tests

Shared state isolation pattern
    └──prerequisite for──> All interaction tests

transformData pipeline contracts
    └──enhances──> Pairwise interaction tests (data integrity assertions)

Playwright HarnessShell smoke
    └──requires──> e2e/ directory creation + webserver config

localStorage persistence tests
    └──depends on──> HarnessShell saveState/restoreState API (already exists in PluginRegistry)

Full-matrix smoke test (all 27)
    └──prerequisite for──> CI gate registration
```

### Dependency Notes

- **Individual lifecycle tests prerequisite for pairwise:** You cannot confidently assert that sort+density interaction is correct if sort's own transformData behavior is not separately verified. Run individual tests first.
- **Shared state isolation prerequisite for all interaction:** Without explicit per-test state construction (createSearchState() fresh each test), shared state bleeds between test cases. This is the most common failure mode in plugin test suites.
- **Playwright requires e2e/ directory:** playwright.config.ts already references `./e2e` but the directory does not exist. No E2E tests can run without it.
- **Full-matrix smoke vs. targeted pairwise:** Full-matrix (all 27 enabled) confirms no hard crash. Targeted pairwise confirms correct behavior. Both are needed; full-matrix is faster to write and run.

---

## MVP Definition

### Launch With (v1)

Minimum to call the milestone complete and land in CI.

- [ ] Individual lifecycle tests for all 27 plugins — every plugin's factory return shape and hook callability verified
- [ ] Shared state isolation: explicit state construction in beforeEach for all 6 shared state types
- [ ] Full-matrix smoke test: all 27 enabled, pipeline runs without throw
- [ ] Targeted pairwise tests for top 5 coupling points: sort+density, search+select, scroll+zoom, stack+calc, sort+scroll
- [ ] Playwright HarnessShell: e2e/ directory, 1 test per category (10 tests) asserting sidebar toggle wires to DOM

### Add After Validation (v1.x)

- [ ] Triple interaction tests: sort+search+density, stack+zoom+scroll, select+audit+search — add once pairwise tests are green and stable
- [ ] Data integrity assertions with reference dataset — add once PivotMockData.ts provides stable fixture
- [ ] transformData pipeline contract assertions via spy wrappers — add once ordering is locked

### Future Consideration (v2+)

- [ ] Playwright visual regression snapshots for SuperStack and SuperZoom layout — defer until layout is frozen post-polish
- [ ] Automated pairwise matrix generation via PICT/ACTS tool — overkill at 27 plugins; revisit if catalog grows past 50

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Individual lifecycle coverage (all 27) | HIGH — baseline correctness | LOW — pattern already exists | P1 |
| Full-matrix smoke (all 27 enabled) | HIGH — catches hard crashes | LOW — 1 test | P1 |
| Targeted pairwise (top 5 pairs) | HIGH — catches 70-95% of interaction bugs | MEDIUM — 5 focused tests | P1 |
| Playwright HarnessShell toggle to DOM | HIGH — verifies wiring end-to-end | MEDIUM — e2e/ setup + 10 tests | P1 |
| Shared state isolation pattern | HIGH — prevents false passes | LOW — beforeEach factories | P1 |
| transformData pipeline contract assertions | MEDIUM — catches ordering bugs | MEDIUM — spy wrappers | P2 |
| Triple interaction tests | MEDIUM — diminishing returns after pairwise | HIGH — test design complexity | P2 |
| localStorage persistence round-trip | LOW — already tested indirectly | LOW — vi.stubGlobal | P2 |
| Playwright visual regression snapshots | LOW — high maintenance | HIGH — baseline churn | P3 |
| Full 27x27 exhaustive matrix | LOW — false completeness signal | HIGH — slow, unmaintainable | Do not build |

**Priority key:**
- P1: Must have for milestone exit
- P2: Should have, add in same milestone if time allows
- P3: Nice to have, future consideration

---

## Cross-Plugin Coupling Map

The following pairs share state objects or data-pipeline ordering. These are the only pairs worth targeted interaction tests.

| Plugin A | Plugin B | Coupling Type | Test Concern |
|----------|----------|---------------|--------------|
| supersort.header-click / supersort.chain | superdensity.count-badge | Data ordering | Sort reorders rows before density computes badges — badge counts must reflect sorted order, not original order |
| supersearch.input | superselect.click / superselect.lasso / superselect.keyboard | State independence | Filtering cells does not invalidate SelectionState — previously selected cells that are filtered out must handle gracefully |
| superscroll.virtual | superzoom.scale | Layout recalculation | Virtual window visible-range calculation uses cellHeight — zoom changes cellHeight, scroll must recalculate window |
| superstack.collapse | supercalc.footer | Data pipeline | Collapsed groups suppress rows — footer aggregate must only sum visible (non-collapsed) rows |
| supersort.chain | superscroll.virtual | Row ordering | Sorted row order must be stable after virtual windowing truncates the visible slice |
| superaudit.overlay | supersearch.highlight | CSS class collision | Both plugins apply CSS classes to cells — highlight's `.search-match` and audit's new/modified/deleted classes must coexist without specificity conflicts |
| superdensity.mini-cards | superselect.lasso | DOM structure | Mini-cards render different DOM inside cells — lasso selection bounding box calculation must still find correct cell elements |

---

## Sources

- Existing plugin test files at `/tests/views/pivot/` (BasePlugins.test.ts, PluginRegistry.test.ts, SuperSort.test.ts, SuperSearch.test.ts, FeatureCatalogCompleteness.test.ts) — HIGH confidence (direct code inspection)
- FeatureCatalog.ts dependency graph: 27 plugins across 10 categories with explicit `dependencies[]` declarations — HIGH confidence (source of truth for coupling map)
- PROJECT.md v8.2 milestone target: "Targeted pairwise/triple interaction tests for known coupling points (sort+filter+density, search+select+scroll, etc.)" — HIGH confidence (direct requirement)
- playwright.config.ts: references `./e2e` testDir, `./e2e/test-results` outputDir — HIGH confidence (code inspection confirms no e2e/ directory exists yet)
- NIST combinatorial testing research (via WebSearch): 70-95% of bugs involve 2-factor interactions — MEDIUM confidence (widely cited, multiple sources agree)
- All-pairs testing methodology ([Wikipedia](https://en.wikipedia.org/wiki/All-pairs_testing), [pairwise.org](https://www.pairwise.org/), [TestRail](https://www.testrail.com/blog/pairwise-testing/)): pairwise covers 2-way interactions at fraction of exhaustive cost — MEDIUM confidence (standard industry literature)

---
*Feature research for: Plugin E2E test suite (Isometry v8.2)*
*Researched: 2026-03-21*
