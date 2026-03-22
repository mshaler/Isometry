# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data. v5.0 replaces the flat view layout with a Figma-designed Workbench shell -- a vertical stack of collapsible explorer panels (Properties, Projection, Visual, LATCH, Notebook) that drive SuperGrid through existing providers with zero new dependencies. v5.1 makes SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet through CSS visual baseline tokens, value-first cell rendering, row index gutter, and active cell focus model. v5.2 adds SQL-driven aggregate calculations to SuperGrid footer rows, completes the Workbench notebook with formatting toolbar + embedded D3 charts + database persistence, and ships LATCH Phase B subpanes (histogram scrubbers + category chips). v5.3 replaces all hardcoded schema assumptions with runtime PRAGMA introspection, fixes SVG and deleted_at bugs, migrates persisted state to handle dynamic fields, and enables user-configurable LATCH family mappings. v6.0 makes the app ship-ready at 20K-card scale: profile-first instrumentation across all 4 performance domains, targeted optimization of the dominant bottlenecks identified by data, and automated regression guards that prevent future PRs from silently regressing performance. v6.1 hardens every critical data seam with integration tests that exercise real sql.js and real providers -- the quality gate for v7.0 entry. v7.0 delivers the Design Workbench: a production shell with centered menubar, 8-section sidebar, ViewZipper auto-cycling, self-reflecting Data Explorer catalog, and three named themes. v7.1 wires the Notebook panel into MutationManager as a full card editor: inline title/content editing with shadow-buffer undo safety, start-typing card creation, typed property inputs for all 26 schema fields, and CSS-driven card dimension rendering. v7.2 retrofits Alto Index import infrastructure and ETL test harness (shipped ad-hoc), then migrates all remaining HTML5 DnD surfaces to pointer events so every drag interaction works in WKWebView. v8.0 rebuilds SuperGrid from a simplified Figma design using modular composable feature plugins -- each Super* capability (Stack, Zoom, Size, Density, Calc, Scroll, Search, Select, Audit, Sort) is a toggleable plugin with sub-feature granularity, tested incrementally via a visual feature harness. Data source progresses from mock data through alto-index JSON to full sql.js. v8.1 completes the FeatureCatalog by extracting base rendering into plugin factories, migrating SuperStack from HarnessShell closures to registerCatalog(), and implementing all remaining plugin categories (SuperDensity, SuperSearch, SuperSelect, SuperAudit) in a parallel wave -- every FeatureCatalog stub replaced with a working factory. v8.2 extends SuperCalc with user-configurable null handling modes, aggregation scope toggle, COUNT semantics, and structured AggResult return type. v8.3 hardens the plugin system with a complete test suite -- shared jsdom test infrastructure for all 27 plugins, per-hook lifecycle coverage, cross-plugin interaction matrix, and Playwright E2E specs wired into CI.

## Milestones

- ✅ **v0.1 Data Foundation** -- Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** -- Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** -- Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** -- Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** -- Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** -- Phases 15-27 (shipped 2026-03-05)
- ✅ **v4.0 Native ETL** -- Phases 33-36 (shipped 2026-03-06)
- ✅ **v3.1 SuperStack** -- Phases 28-32 (shipped 2026-03-06)
- ✅ **v4.1 Sync + Audit** -- Phases 37-41 (shipped 2026-03-07)
- ✅ **v4.2 Polish + QoL** -- Phases 42-47 (shipped 2026-03-07)
- ✅ **v4.3 Review Fixes** -- Phase 48 (shipped 2026-03-07)
- ✅ **v4.4 UX Complete** -- Phases 49-52 (shipped 2026-03-08)
- ✅ **v5.0 Designer Workbench** -- Phases 54-57 (shipped 2026-03-08)
- ✅ **v5.1 SuperGrid Spreadsheet UX** -- Phases 58-61 (shipped 2026-03-08)
- ✅ **v5.2 SuperCalc + Workbench Phase B** -- Phases 62-68 (shipped 2026-03-10)
- ✅ **v5.3 Dynamic Schema** -- Phases 69-73 (shipped 2026-03-11)
- ✅ **v6.0 Performance** -- Phases 74-78 (shipped 2026-03-13)
- ✅ **v6.1 Test Harness** -- Phases 79-84 (shipped 2026-03-17)
- ✅ **v7.0 Design Workbench** -- Phases 85-90 (shipped 2026-03-18)
- ✅ **v7.1 Notebook Card Editor** -- Phases 91-94 (shipped 2026-03-19)
- ✅ **v7.2 Alto Index + DnD Migration** -- Phases 95-96 (shipped 2026-03-21)
- ✅ **v8.0 SuperGrid Redesign** -- Phases 97-100 (shipped 2026-03-21)
- ✅ **v8.1 Plugin Registry Complete** -- Phases 101-102 (shipped 2026-03-22)
- 🚧 **v8.2 SuperCalc v2** -- Phase 103
- 🚧 **v8.3 Plugin E2E Test Suite** -- Phases 104-107

## Phases

<details>
<summary>v0.1 Data Foundation (Phases 1-2) -- SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) -- completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.5 Providers + Views (Phases 4-6) -- SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) -- completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) -- completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.0 Web Runtime (Phases 3, 7) -- SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) -- completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) -- completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 ETL Importers (Phases 8-10) -- SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) -- completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) -- completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) -- completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v2.0 Native Shell (Phases 11-14) -- SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) -- completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) -- completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) -- completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) -- completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.0 SuperGrid Complete (Phases 15-27) -- SHIPPED 2026-03-05</summary>

- [x] Phase 15: PAFVProvider Stacked Axes (2/2 plans) -- completed 2026-03-04
- [x] Phase 16: SuperGridQuery Worker Wiring (2/2 plans) -- completed 2026-03-04
- [x] Phase 17: SuperGrid Dynamic Axis Reads (2/2 plans) -- completed 2026-03-04
- [x] Phase 18: SuperDynamic (2/2 plans) -- completed 2026-03-04
- [x] Phase 19: SuperPosition + SuperZoom (3/3 plans) -- completed 2026-03-04
- [x] Phase 20: SuperSize (2/2 plans) -- completed 2026-03-05
- [x] Phase 21: SuperSelect (4/4 plans) -- completed 2026-03-05
- [x] Phase 22: SuperDensity (3/3 plans) -- completed 2026-03-05
- [x] Phase 23: SuperSort (3/3 plans) -- completed 2026-03-05
- [x] Phase 24: SuperFilter (3/3 plans) -- completed 2026-03-05
- [x] Phase 25: SuperSearch (3/3 plans) -- completed 2026-03-05
- [x] Phase 26: SuperTime (3/3 plans) -- completed 2026-03-05
- [x] Phase 27: SuperCards + Polish (3/3 plans) -- completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.0 Native ETL (Phases 33-36) -- SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) -- completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) -- completed 2026-03-06
- [x] Phase 35: Notes Adapter -- Title + Metadata (1/1 plan) -- completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.1 SuperStack (Phases 28-32) -- SHIPPED 2026-03-06</summary>

- [x] Phase 28: N-Level Foundation (3/3 plans) -- completed 2026-03-05
- [x] Phase 29: Multi-Level Row Headers (2/2 plans) -- completed 2026-03-05
- [x] Phase 30: Collapse System (3/3 plans) -- completed 2026-03-06
- [x] Phase 31: Drag Reorder (2/2 plans) -- completed 2026-03-06
- [x] Phase 32: Polish and Performance (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.1 Sync + Audit (Phases 37-41) -- SHIPPED 2026-03-07</summary>

- [x] Phase 37: SuperAudit (3/3 plans) -- completed 2026-03-07
- [x] Phase 38: Virtual Scrolling (2/2 plans) -- completed 2026-03-07
- [x] Phase 39: CloudKit Architecture (3/3 plans) -- completed 2026-03-07
- [x] Phase 40: CloudKit Card Sync (2/2 plans) -- completed 2026-03-07
- [x] Phase 41: CloudKit Connection Sync + Polish (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.2 Polish + QoL (Phases 42-47) -- SHIPPED 2026-03-07</summary>

- [x] Phase 42: Build Health (3/3 plans) -- completed 2026-03-07
- [x] Phase 43: Empty States + First Launch (2/2 plans) -- completed 2026-03-07
- [x] Phase 44: Keyboard Shortcuts + Navigation (2/2 plans) -- completed 2026-03-07
- [x] Phase 45: Visual Polish (3/3 plans) -- completed 2026-03-07
- [x] Phase 46: Stability + Error Handling (2/2 plans) -- completed 2026-03-07
- [x] Phase 47: ETL Validation (3/3 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.3 Review Fixes (Phase 48) -- SHIPPED 2026-03-07</summary>

- [x] Phase 48: Review Fixes (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.4 UX Complete (Phases 49-52) -- SHIPPED 2026-03-08</summary>

- [x] Phase 49: Theme System (3/3 plans) -- completed 2026-03-08
- [x] Phase 50: Accessibility (3/3 plans) -- completed 2026-03-08
- [x] Phase 51: Command Palette (2/2 plans) -- completed 2026-03-08
- [x] Phase 52: Sample Data + Empty States (2/2 plans) -- completed 2026-03-08

See: `.planning/milestones/v4.4-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.0 Designer Workbench (Phases 54-57) -- SHIPPED 2026-03-08</summary>

- [x] Phase 54: Shell Scaffolding (3/3 plans) -- completed 2026-03-08
- [x] Phase 55: Properties + Projection Explorers (4/4 plans) -- completed 2026-03-08
- [x] Phase 56: Visual + LATCH Explorers (2/2 plans) -- completed 2026-03-08
- [x] Phase 57: Notebook Explorer + Polish (2/2 plans) -- completed 2026-03-08

See: `.planning/milestones/v5.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.1 SuperGrid Spreadsheet UX (Phases 58-61) -- SHIPPED 2026-03-08</summary>

- [x] Phase 58: CSS Visual Baseline (2/2 plans) -- completed 2026-03-08
- [x] Phase 59: Value-First Rendering (2/2 plans) -- completed 2026-03-08
- [x] Phase 60: Row Index Gutter (1/1 plan) -- completed 2026-03-08
- [x] Phase 61: Active Cell Focus (2/2 plans) -- completed 2026-03-09

See: `.planning/milestones/v5.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.2 SuperCalc + Workbench Phase B (Phases 62-68) -- SHIPPED 2026-03-10</summary>

- [x] Phase 62: SuperCalc Footer Rows (3/3 plans) -- completed 2026-03-09
- [x] Phase 63: Notebook Formatting Toolbar (1/1 plan) -- completed 2026-03-09
- [x] Phase 64: Notebook Persistence (1/1 plan) -- completed 2026-03-09
- [x] Phase 65: D3 Chart Blocks (2/2 plans) -- completed 2026-03-10
- [x] Phase 66: LATCH Histogram Scrubbers (3/3 plans) -- completed 2026-03-10
- [x] Phase 67: Category Chips (1/1 plan) -- completed 2026-03-10
- [x] Phase 68: E2E Critical-Path Tests Tier 3 (2/2 plans) -- completed 2026-03-10

See: `.planning/milestones/v5.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.3 Dynamic Schema (Phases 69-73) -- SHIPPED 2026-03-11</summary>

- [x] Phase 69: Bug Fixes (2/2 plans) -- completed 2026-03-11
- [x] Phase 70: SchemaProvider Core + Worker Integration (1/1 plan) -- completed 2026-03-11
- [x] Phase 71: Dynamic Schema Integration (4/4 plans) -- completed 2026-03-11
- [x] Phase 72: State Persistence Migration (2/2 plans) -- completed 2026-03-11
- [x] Phase 73: User-Configurable LATCH Mappings (3/3 plans) -- completed 2026-03-11

See: `.planning/milestones/v5.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v6.0 Performance (Phases 74-78) -- SHIPPED 2026-03-13</summary>

- [x] Phase 74: Baseline Profiling + Instrumentation (3/3 plans) -- completed 2026-03-12
- [x] Phase 75: Performance Budgets + Benchmark Skeleton (2/2 plans) -- completed 2026-03-12
- [x] Phase 76: Render Optimization (3/3 plans) -- completed 2026-03-12
- [x] Phase 77: Import + Launch + Memory Optimization (3/3 plans) -- completed 2026-03-13
- [x] Phase 78: Regression Guard + CI Integration (2/2 plans) -- completed 2026-03-13

See: `.planning/milestones/v6.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v6.1 Test Harness (Phases 79-84) -- SHIPPED 2026-03-17</summary>

- [x] Phase 79: Test Infrastructure (1/1 plan) -- completed 2026-03-16
- [x] Phase 80: Filter + PAFV Seams (2/2 plans) -- completed 2026-03-16
- [x] Phase 81: Coordinator + Density Seams (1/1 plan) -- completed 2026-03-17
- [x] Phase 82: UI Control Seams A (2/2 plans) -- completed 2026-03-17
- [x] Phase 83: UI Control Seams B (2/2 plans) -- completed 2026-03-17
- [x] Phase 84: UI Polish (6/6 plans) -- completed 2026-03-15

See: `.planning/milestones/v6.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v7.0 Design Workbench (Phases 85-90) -- SHIPPED 2026-03-18</summary>

- [x] Phase 85: Bug Fixes -- Chevron Collapse + Dataset Eviction (2/2 plans) -- completed 2026-03-18
- [x] Phase 86: Shell Restructure -- Menubar + Sidebar (2/2 plans) -- completed 2026-03-18
- [x] Phase 87: ViewZipper (2/2 plans) -- completed 2026-03-18
- [x] Phase 88: Data Explorer + Catalog (4/4 plans) -- completed 2026-03-18
- [x] Phase 89: SuperGrid Fixes (4/4 plans) -- completed 2026-03-18
- [x] Phase 90: Notebook Verification + Themes (3/3 plans) -- completed 2026-03-18

See: `.planning/milestones/v7.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v7.1 Notebook Card Editor (Phases 91-94) -- SHIPPED 2026-03-19</summary>

- [x] Phase 91: MutationManager + Notebook Migration (2/2 plans) -- completed 2026-03-19
- [x] Phase 92: Card Creation Flow (2/2 plans) -- completed 2026-03-19
- [x] Phase 93: Property Editors (2/2 plans) -- completed 2026-03-19
- [x] Phase 94: Card Dimension Rendering (2/2 plans) -- completed 2026-03-19

See: `.planning/milestones/v7.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v7.2 Alto Index + DnD Migration (Phases 95-96) -- SHIPPED 2026-03-20</summary>

- [x] Phase 95: Alto Index + ETL Test Harness + Projection DnD (0/0 plans -- retrofit docs) -- completed 2026-03-19
- [x] Phase 96: DnD Migration (5/5 plans) -- completed 2026-03-20

See: `.planning/milestones/v7.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v8.0 SuperGrid Redesign (Phases 97-100) -- SHIPPED 2026-03-21</summary>

- [x] Phase 97: D3 Pivot Table from Figma Design (1/1 plan) -- completed 2026-03-20
- [x] Phase 98: Plugin Registry + Feature Harness (1/1 plan) -- completed 2026-03-20
- [x] Phase 99: SuperStack Plugin (2/2 plans) -- completed 2026-03-21
- [x] Phase 100: Plugin Registry Wave 1 (3/3 plans) -- completed 2026-03-21

See: `.planning/milestones/v8.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v8.1 Plugin Registry Complete (Phases 101-102) -- SHIPPED 2026-03-22</summary>

- [x] Phase 101: Base Extraction + SuperStack Catalog Migration (2/2 plans) -- completed 2026-03-21
- [x] Phase 102: New Plugin Wave -- SuperDensity, SuperSearch, SuperSelect, SuperAudit (4/4 plans) -- completed 2026-03-22

See: `.planning/milestones/v8.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v8.2 SuperCalc v2 (Phase 103)</summary>

- [ ] Phase 103: SuperCalc v2 — Null Handling + Filter Scope (0/2 plans)

Plans:
- [ ] 103-01-PLAN.md — Types + computeAggregate logic + allRows (TDD)
- [ ] 103-02-PLAN.md — FeatureCatalog wiring + SuperCalcConfig UI controls

**Goal:** Extend SuperCalc with user-configurable null handling modes (exclude/zero/strict), aggregation scope (filter-aware vs full dataset), COUNT semantics (column vs all rows), and structured AggResult return type. Enhancement to existing plugin files only — no new plugins.

**Requirements:**
- SC2-01: NullMode, CountMode, ScopeMode, ColCalcConfig, CalcConfig, AggResult types exported from SuperCalcFooter.ts
- SC2-02: computeAggregate returns AggResult object with nullMode and countMode parameters
- SC2-03: nullMode 'zero' substitutes 0 for nulls before computing; AVG divides by total rows
- SC2-04: nullMode 'strict' returns { value: null, warning: 'incomplete-data' } when nulls present
- SC2-05: countMode 'all' returns total row count regardless of nulls
- SC2-06: countMode 'column' with nullMode 'zero' still counts original non-nulls
- SC2-07: RenderContext.allRows added to PluginTypes.ts and populated by PivotGrid.ts before hide-empty filter
- SC2-08: Scope toggle in SuperCalcConfig sidebar updates calcConfig.scope
- SC2-09: Footer reads ctx.allRows when scope 'all', ctx.visibleRows when scope 'view'
- SC2-10: WARNING_GLYPH constant centralized alongside GLYPHS record
- SC2-11: Warning cell renders with var(--pv-warning-fg/bg) tokens and tooltip
- SC2-12: Null mode select appears per column (hidden when fn === 'NONE')
- SC2-13: Count sub-mode select appears only when fn === 'COUNT'
- SC2-14: All existing pivot tests still pass
- SC2-15: No TypeScript errors (npx tsc --noEmit)

</details>

<details>
<summary>v8.3 Plugin E2E Test Suite (Phases 104-107)</summary>

- [ ] **Phase 104: Test Infrastructure** -- Shared harness factories and HarnessShell entry point (0/2 plans)
- [ ] **Phase 105: Individual Plugin Lifecycle** -- Per-hook coverage for all 27 plugins (0/0 plans)
- [ ] **Phase 106: Cross-Plugin Interactions** -- Matrix, pairwise, combo, isolation, ordering (0/0 plans)
- [ ] **Phase 107: Playwright E2E** -- Browser specs and CI integration (0/0 plans)

</details>

## Phase Details

### Phase 104: Test Infrastructure
**Goal**: Shared test helpers exist so every plugin test can spin up an isolated, realistic harness in one call
**Depends on**: Phase 103 (v8.2 SuperCalc v2 — test suite targets the completed plugin set)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. A single `makePluginHarness()` call returns a fully wired FeatureCatalog + PluginRegistry + fresh shared state, usable in any test file without additional setup boilerplate
  2. Any test using `usePlugin()` automatically calls plugin.destroy() after the test completes with no manual afterEach wiring required by the test author
  3. jsdom layout tests can set realistic container dimensions (clientHeight, scrollTop, getBoundingClientRect) via `mockContainerDimensions()` without patching globals by hand in each file
  4. All Playwright E2E helpers (waitForHarnessReady, togglePlugin, enablePlugin, disablePlugin) are importable from a single `e2e/helpers/harness.ts` path
  5. Navigating to `?harness=1` in a browser or Playwright loads the HarnessShell without a console error or white screen
**Plans**: 2 plans

Plans:
- [ ] 104-01-PLAN.md — Vitest helpers: makePluginHarness, usePlugin, mockContainerDimensions
- [ ] 104-02-PLAN.md — HarnessShell ?harness=1 entry point + E2E Playwright helpers

### Phase 105: Individual Plugin Lifecycle
**Goal**: Every one of the 27 plugins is verified to correctly execute each hook in isolation and clean up all listeners after destroy
**Depends on**: Phase 104
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05
**Success Criteria** (what must be TRUE):
  1. Running `registry.runTransformData()` with any of the 27 plugins enabled does not throw and returns a data array with the expected shape
  2. Running `registry.runTransformLayout()` with any of the 27 plugins enabled does not throw and returns a valid layout descriptor
  3. Running `registry.runAfterRender()` with any of the 27 plugins enabled does not throw and leaves DOM state consistent with that plugin's documented intent
  4. Calling plugin.destroy() for any of the 27 plugins removes all event listeners that were attached during init, verified via listener count assertion or spy
  5. SuperScroll with fewer than 100 rows renders all rows without sentinel spacers; with 100 or more rows it activates virtual windowing with sentinel spacers present in the DOM
**Plans**: 2 plans

Plans:
- [ ] 104-01-PLAN.md — Vitest helpers: makePluginHarness, usePlugin, mockContainerDimensions
- [ ] 104-02-PLAN.md — HarnessShell ?harness=1 entry point + E2E Playwright helpers

### Phase 106: Cross-Plugin Interactions
**Goal**: Multiple plugins active simultaneously do not crash, corrupt shared state, or produce wrong pipeline output
**Depends on**: Phase 105
**Requirements**: XPLG-01, XPLG-02, XPLG-03, XPLG-04, XPLG-05
**Success Criteria** (what must be TRUE):
  1. Calling `registerCatalog()` with all 27 plugins enabled and running the full three-hook pipeline completes without error on a representative data set
  2. Each of the 7 identified coupling pairs (e.g. sort+scroll, density+calc) produces correct combined output when tested pairwise through the registry pipeline rather than direct hook chaining
  3. The sort+filter+density triple and the search+select+scroll triple each produce correct combined output with no observable interaction bug
  4. After each test completes, ZoomState, SelectionState, and other shared state objects contain only values set within that test and none from prior tests
  5. The execution order of plugins within registry.runTransformData(), runTransformLayout(), and runAfterRender() matches the Map insertion order documented in FeatureCatalog, verified by an ordering assertion
**Plans**: 2 plans

Plans:
- [ ] 104-01-PLAN.md — Vitest helpers: makePluginHarness, usePlugin, mockContainerDimensions
- [ ] 104-02-PLAN.md — HarnessShell ?harness=1 entry point + E2E Playwright helpers

### Phase 107: Playwright E2E
**Goal**: Real-browser tests verify HarnessShell plugin toggle UI produces correct DOM output and the full Playwright suite runs in CI on every PR
**Depends on**: Phase 104
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05
**Success Criteria** (what must be TRUE):
  1. Toggling any plugin category sidebar switch in the HarnessShell produces the expected DOM change in the pivot grid, verified for all 10 plugin categories via separate per-category specs
  2. Enabling multiple plugin categories simultaneously renders a combined grid state matching each category's individual contribution, verified by 5 multi-category specs
  3. Screenshot baselines for key plugin states (e.g. SuperZoom at 150%, SuperSize with resized columns, SuperScroll with sentinel spacers visible) are captured and stored in the repository
  4. No E2E spec uses waitForTimeout -- all async assertions use expect.poll() or network/DOM-idle wait conditions
  5. The GitHub Actions pipeline includes a Playwright job that runs on every PR and fails the check if any E2E spec fails
**Plans**: 2 plans

Plans:
- [ ] 104-01-PLAN.md — Vitest helpers: makePluginHarness, usePlugin, mockContainerDimensions
- [ ] 104-02-PLAN.md — HarnessShell ?harness=1 entry point + E2E Playwright helpers

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-102 complete across 24 milestones. Phase 53 is reserved.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-48 | v0.1-v4.3 | 145/145 | Complete | 2026-02-28 to 2026-03-07 |
| 49-52 | v4.4 | 10/10 | Complete | 2026-03-08 |
| 54-57 | v5.0 | 11/11 | Complete | 2026-03-08 |
| 58-61 | v5.1 | 7/7 | Complete | 2026-03-08 |
| 62-68 | v5.2 | 13/13 | Complete | 2026-03-10 |
| 69-73 | v5.3 | 12/12 | Complete | 2026-03-11 |
| 74-78 | v6.0 | 13/13 | Complete | 2026-03-13 |
| 79-84 | v6.1 | 14/14 | Complete | 2026-03-17 |
| 85-90 | v7.0 | 17/17 | Complete | 2026-03-18 |
| 91-94 | v7.1 | 8/8 | Complete | 2026-03-19 |
| 95-96 | v7.2 | 5/5 | Complete | 2026-03-20 |
| 97-100 | v8.0 | 7/7 | Complete | 2026-03-21 |
| 101-102 | v8.1 | 6/6 | Complete | 2026-03-22 |
| 103 | 2/2 | Complete    | 2026-03-22 | — |
| 104 | v8.3 | 0/0 | Not started | — |
| 105 | v8.3 | 0/0 | Not started | — |
| 106 | v8.3 | 0/0 | Not started | — |
| 107 | v8.3 | 0/0 | Not started | — |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v4.0 Native ETL shipped: 2026-03-06*
*v3.1 SuperStack shipped: 2026-03-06*
*v4.1 Sync + Audit shipped: 2026-03-07*
*v4.2 Polish + QoL shipped: 2026-03-07*
*v4.3 Review Fixes shipped: 2026-03-07*
*v4.4 UX Complete shipped: 2026-03-08*
*v5.0 Designer Workbench shipped: 2026-03-08*
*v5.1 SuperGrid Spreadsheet UX shipped: 2026-03-08*
*v5.2 SuperCalc + Workbench Phase B shipped: 2026-03-10*
*v5.3 Dynamic Schema shipped: 2026-03-11*
*v6.0 Performance shipped: 2026-03-13*
*v6.1 Test Harness shipped: 2026-03-17*
*v7.0 Design Workbench shipped: 2026-03-18*
*v7.1 Notebook Card Editor shipped: 2026-03-19*
*v7.2 Alto Index + DnD Migration shipped: 2026-03-20*
*v8.0 SuperGrid Redesign shipped: 2026-03-21*
*v8.1 Plugin Registry Complete shipped: 2026-03-22*
*v8.3 Plugin E2E Test Suite roadmap created: 2026-03-22*
