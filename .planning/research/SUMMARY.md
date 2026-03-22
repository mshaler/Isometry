# Project Research Summary

**Project:** Isometry — Plugin E2E Test Suite (v8.2 milestone)
**Domain:** Composable plugin integration and E2E testing — 27 plugins, shared state, D3.js, Vitest + Playwright
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

This milestone adds a comprehensive test layer to the Isometry pivot grid's composable plugin system. The project already has a well-established two-tier testing approach (Vitest + jsdom for unit/integration, Playwright for browser-level E2E) and a mature plugin architecture (PluginRegistry + FeatureCatalog with 27 plugins across 10 categories). The central research finding is clear: no new packages are needed. All infrastructure to build a thorough plugin test suite exists in the current dependency set — the work is purely about applying correct patterns, not adding tooling.

The recommended approach is a three-layer structure: (1) Vitest jsdom tests covering every plugin's lifecycle in isolation, (2) Vitest integration tests in a new `tests/harness/` directory covering cross-plugin interactions using the canonical `registerCatalog()` shared-state injection pattern, and (3) Playwright E2E tests verifying that HarnessShell sidebar interactions produce correct DOM effects. NIST combinatorial testing research confirms that targeted pairwise tests (not an exhaustive 27x27 matrix) catch 70-95% of interaction bugs — the 7 identified coupling pairs are the only ones with real interaction surfaces worth targeted testing.

The dominant risk is shared mutable state leaking between tests. Seven shared state objects (SuperStackState, zoomState, calcConfig, densityState, searchState, selectionState, auditPluginState) are captured by plugin factory closures and will corrupt adjacent tests if not freshly constructed in `beforeEach`. Establishing the shared-state isolation pattern in Phase 1 infrastructure is the single highest-leverage action for preventing flaky tests throughout the milestone.

## Key Findings

### Recommended Stack

The existing stack is exactly right for this work. Vitest 4.0.18 with per-file `// @vitest-environment jsdom` annotation is the established pattern for DOM-touching plugin tests across 17 existing test files. Playwright 1.58.2 is current and already configured with a `./e2e` testDir and `npm run dev` webserver. No new packages are warranted — libraries like `@testing-library/dom` add a React-oriented abstraction layer that conflicts with D3's imperative DOM manipulation style.

**Core technologies:**
- `vitest@4.0.18` + `jsdom@28.1.0`: Plugin hook unit and integration tests — per-file `// @vitest-environment jsdom` annotation; do not upgrade jsdom independently (version pairing is load-bearing in this monorepo)
- `@playwright/test@1.58.2`: HarnessShell E2E tests — `toContainClass()` (added v1.53) and CSS custom property `evaluate()` pattern available without upgrade
- `typescript@5.9.3` strict mode: No changes needed; all plugin types are correct and sufficient

**What NOT to use:** `@testing-library/dom` (React abstraction layer), Vitest Browser Mode (experimental as of 2025-06, creates an unnecessary third test tier), `playwright-testing-library` (wraps functionality Playwright provides natively), per-plugin Playwright files (27 files x slow E2E = poor CI ROI).

### Expected Features

The feature set is grounded in the existing codebase and PROJECT.md v8.2 milestone requirements, not speculation.

**Must have (table stakes):**
- Individual lifecycle coverage for all 27 plugins — factory return shape + all 4 hooks callable without throwing
- Full-matrix smoke test — all 27 enabled simultaneously, no crash, `destroyAll()` clean
- Targeted pairwise tests for the 7 identified coupling pairs (sort+density, search+select, scroll+zoom, stack+calc, sort+scroll, audit+search CSS coexistence, density+select DOM structure)
- Shared state isolation — `beforeEach` fresh construction for all 6 shared state types
- Playwright HarnessShell wiring — 1 test per category (10 tests) verifying sidebar toggle produces DOM effect

**Should have (competitive):**
- transformData pipeline contract assertions via spy wrappers — catches ordering bugs silently corrupting data
- Triple interaction stress tests (sort+search+density, stack+zoom+scroll, select+audit+search) — diminishing returns after pairwise but covers known risky triples
- localStorage persistence round-trip verification for HarnessShell state restore

**Defer (v2+):**
- Playwright visual regression snapshots for SuperStack/SuperZoom layout — defer until layout is frozen post-polish
- Automated pairwise matrix generation via PICT/ACTS — revisit only if catalog grows past 50 plugins
- Full 27x27 exhaustive matrix — do not build; false completeness signal with high CI cost

### Architecture Approach

The test architecture mirrors the production component hierarchy. Vitest tests at `tests/harness/` operate against the PluginRegistry + FeatureCatalog integration layer using `makeFullRegistry()` (which calls `registerCatalog()` to get correct shared-state injection). Playwright tests access HarnessShell via a `?harness=1` query parameter branch in `src/main.ts`. The critical architectural constraint is that cross-plugin interaction tests must always route through `registry.runTransformData/Layout/AfterRender()` — not manual hook chaining — because Map insertion order enforces execution sequence and is load-bearing for correctness.

**Major components:**
1. `tests/harness/helpers.ts` (NEW) — `makeCtx()`, `makeRegistry()`, `makeFullRegistry()`, `makeLayout()`, `mockContainerDimensions()` shared factories; the single integration seam for all interaction tests
2. `tests/harness/*.test.ts` (NEW) — Full-matrix smoke, pairwise interactions, pipeline order verification; pure Vitest, zero production code changes
3. `src/main.ts` (MODIFIED) — `?harness=1` query param branch to mount HarnessShell; hard dependency for all Playwright harness specs
4. `e2e/harness/*.spec.ts` (NEW) — Playwright sidebar toggle to DOM effect tests; requires `src/main.ts` modification and `e2e/` directory creation

### Critical Pitfalls

1. **Shared state object leaks between tests** — All 7 shared state objects must be constructed fresh in `beforeEach`, never at describe or module scope. Warning sign: tests pass individually but fail when the full suite runs. Prevention: establish `makeZoomState`, `makeSelectionState` etc. helpers in Phase 1 infrastructure before any test file is written.

2. **jsdom returns zero for all layout measurements** — `clientHeight`, `clientWidth`, `getBoundingClientRect()`, and `scrollTop` are always 0 in jsdom. SuperScrollVirtual falls back to `DEFAULT_CONTAINER_HEIGHT = 600`. Tests asserting scroll behavior must use `Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })` or test the pure-function export (`getVisibleRange()`) directly. Real scroll behavior belongs in Playwright.

3. **PluginRegistry `defaultEnabled` bleeding** — Several plugins have `defaultEnabled: true` and auto-enable on registration. Unit tests must NEVER import `createPivotRegistry()`; always use `new PluginRegistry()` and register only required plugins explicitly.

4. **`afterRender` document listener accumulation** — SuperZoomWheel and SuperSelectKeyboard attach `document`-level event listeners. If `plugin.destroy()` is not called in `afterEach`, listeners accumulate across tests (jsdom does not isolate `document` between tests in a file). Always use the `usePlugin()` wrapper helper or explicit `afterEach(() => plugin.destroy())`.

5. **Cross-plugin interaction tests using wrong pipeline order** — PluginRegistry runs hooks in Map insertion (registration) order. Manual `plugin.transformData() → plugin2.transformData()` chaining in tests may invert this order, producing results that do not match production. All cross-plugin tests must use `registry.runTransformData()` through a registry that mirrors `FeatureCatalog.ts` registration order.

## Implications for Roadmap

The build order is driven by two hard dependencies: (a) shared infrastructure must exist before any interaction test can be written correctly, and (b) `src/main.ts` must be modified before any Playwright harness spec can run. Vitest layers (Phases 1-3) involve zero production code changes and can proceed independently of the Playwright layer (Phase 4).

### Phase 1: Test Infrastructure Setup
**Rationale:** All downstream tests depend on correct shared-state isolation helpers. Writing any interaction test before these helpers exist risks building on the most dangerous pitfall (state leakage). Zero production code changes — this is pure test infrastructure that unblocks all subsequent phases.
**Delivers:** `tests/harness/helpers.ts` with `makeCtx()`, `makeFullRegistry()`, `makeLayout()`, `mockContainerDimensions()`, `usePlugin()` helpers; ESLint/code-review rule documenting `beforeEach` requirement for all shared state factories
**Addresses:** Shared state isolation (P1 must-have), individual lifecycle coverage prerequisite
**Avoids:** Pitfalls 1, 3, 4 (shared state leaks, defaultEnabled bleeding, listener accumulation)

### Phase 2: Individual Plugin Lifecycle Tests
**Rationale:** Individual plugin correctness is a prerequisite for pairwise interaction tests — you cannot confidently assert that sort+density interaction is correct if sort's own `transformData` has not been separately verified. Extends established patterns from `SuperSort.test.ts` and `PluginRegistry.test.ts`.
**Delivers:** Complete lifecycle coverage for all 27 plugins — factory return shape, hook callability, `destroy()` cleanup; full-matrix all-27-enabled smoke test; above-threshold and below-threshold SuperScroll datasets
**Uses:** Vitest jsdom, `// @vitest-environment jsdom` per-file annotation, helpers from Phase 1
**Implements:** `tests/harness/all-plugins.test.ts` + extensions to `tests/views/pivot/`
**Avoids:** Pitfall 5 (SuperScroll virtualization threshold bypass — must have both above/below threshold datasets)

### Phase 3: Cross-Plugin Interaction Tests
**Rationale:** After individual plugin correctness is established, targeted pairwise tests covering the 7 identified coupling pairs provide 70-95% interaction bug coverage at manageable cost. Pipeline order tests lock in execution sequence as a regression guard against future plugin additions.
**Delivers:** `tests/harness/plugin-interactions.test.ts` (7 coupling pairs with data integrity assertions, not just "no throw"); `tests/harness/pipeline-order.test.ts`; P2 items (transformData spy wrappers, triple interaction tests, localStorage persistence)
**Implements:** All cross-plugin interaction via `registry.runTransformData/Layout/AfterRender()` — no direct hook chaining
**Avoids:** Pitfall 6 (wrong pipeline order); Pitfall 2 (jsdom zero layout — use `mockContainerDimensions` for scroll/zoom tests)

### Phase 4: Playwright HarnessShell E2E
**Rationale:** Browser-level tests verify that HarnessShell sidebar wiring produces real DOM effects — something Vitest jsdom cannot test due to zero layout measurements. This is the only phase requiring a production code change (`src/main.ts`). Keep Playwright to DOM/visual assertions only; all logic testing stays in Vitest.
**Delivers:** `src/main.ts` modified with `?harness=1` branch; `e2e/` directory created; `e2e/harness/feature-panel.spec.ts` (10 tests, 1 per category); `e2e/harness/all-plugins-matrix.spec.ts`; extracted `e2e/helpers/harness.ts` with shared helper functions
**Uses:** Playwright 1.58.2, CSS custom property `evaluate()` pattern, `expect.poll()` instead of `waitForTimeout` for D3 transition settling
**Avoids:** Playwright flakiness from D3 transition timing (use `expect.poll`, never `waitForTimeout`); overuse of Playwright for logic that belongs in Vitest

### Phase Ordering Rationale

- Infrastructure before interaction: shared-state helpers are load-bearing for correctness of all subsequent tests; writing interaction tests without them creates a hidden pitfall that won't manifest until the full suite runs
- Individual before pairwise: FEATURES.md documents this as an explicit prerequisite; pairwise assertions are only meaningful when individual plugin behavior is separately verified
- Vitest before Playwright: Phases 1-3 require zero production code changes and can ship to CI immediately; Phase 4 requires the `src/main.ts` modification which has a real risk surface (must not break the non-harness app entry point)
- No exhaustive 27x27 matrix: the 7 coupling pairs are identified from shared state objects and data pipeline ordering — the only pairs with real interaction surfaces; NIST research supports targeted pairwise as sufficient

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Cross-Plugin Interaction):** The 7 coupling pairs are identified but the exact assertion shapes (what DOM state to assert for each interaction outcome) need design during planning. The `superaudit.overlay` + `supersearch.highlight` CSS specificity interaction is the least-characterized pair and may need inspection of both plugins' CSS class lists.
- **Phase 4 (Playwright HarnessShell):** The `?harness=1` entry point wiring in `src/main.ts` needs careful implementation to avoid breaking the main app load path. Verify whether HarnessShell is already conditionally mounted (from Feature Harness Phase 98) before writing the spec.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** Entirely documented patterns from existing codebase — no research needed, just implementation
- **Phase 2 (Individual Lifecycle):** Extends established pattern from `SuperSort.test.ts` and `PluginRegistry.test.ts`; 27 plugins x same pattern = implementation work, not design work

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection — no new packages, versions locked and verified against package.json |
| Features | HIGH | Grounded in PROJECT.md v8.2 milestone requirements + direct code inspection of 27-plugin catalog and FeatureCatalog.ts coupling graph |
| Architecture | HIGH | Source-verified against PluginRegistry.ts, FeatureCatalog.ts, PivotGrid.ts, HarnessShell.ts, playwright.config.ts — all component boundaries confirmed |
| Pitfalls | HIGH | Derived from direct codebase inspection of shared state objects + jsdom/Playwright community sources (multiple corroborating references per pitfall) |

**Overall confidence:** HIGH

### Gaps to Address

- **HarnessShell `?harness=1` mount wiring:** Specified in ARCHITECTURE.md but not yet verified against the current `src/main.ts`. During Phase 4 planning, confirm whether HarnessShell is already conditionally mounted (from Phase 98 Feature Harness work) or needs to be added fresh.
- **Exact assertion shapes for audit+search CSS coexistence:** Research identifies this as a coupling pair but does not specify which CSS classes conflict or what the correct coexistence assertion looks like. Resolve during Phase 3 interaction test design by inspecting `superaudit.source` and `supersearch.highlight` plugin implementations.
- **`e2e/` directory existence:** STACK.md confirms `playwright.config.ts` references `./e2e` testDir but the directory does not yet exist. Phase 4 must create the directory structure before any spec can run.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `PluginRegistry.ts`, `FeatureCatalog.ts`, `PluginTypes.ts`, `PivotGrid.ts`, `PivotTable.ts`, `HarnessShell.ts`, `FeaturePanel.ts`, `playwright.config.ts`, `vitest.config.ts`, `package.json`, all files in `tests/views/pivot/` — definitive source of truth for all architecture and pattern decisions
- Playwright release notes — `toContainClass()` confirmed since v1.53; v1.58.2 verified as current release
- Playwright assertions API — `toHaveCSS`, `toContainClass`, `toMatchAriaSnapshot` API verified

### Secondary (MEDIUM confidence)
- NIST combinatorial testing research — 70-95% of bugs involve 2-factor interactions; pairwise coverage effectiveness
- All-pairs testing methodology (Wikipedia, pairwise.org, TestRail) — pairwise vs. exhaustive matrix cost/benefit analysis
- Vitest Browser Mode Guide (vitest.dev) — experimental status confirmed as of 2025-06

### Tertiary (MEDIUM confidence, community-validated)
- jsdom `getBoundingClientRect` always-zero: jsdom issues #653, #1590 — well-known limitation, multiple corroborating sources
- Playwright flakiness from D3 transitions: BetterStack, BrowserStack, Medium (Feb 2026) — consistent `expect.poll` recommendation across sources
- Shared state test isolation: DEV Community, oneuptime.com 2026 — consistent `beforeEach` factory pattern recommendation

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
