# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data. v5.0 replaces the flat view layout with a Figma-designed Workbench shell -- a vertical stack of collapsible explorer panels (Properties, Projection, Visual, LATCH, Notebook) that drive SuperGrid through existing providers with zero new dependencies. v5.1 makes SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet through CSS visual baseline tokens, value-first cell rendering, row index gutter, and active cell focus model. v5.2 adds SQL-driven aggregate calculations to SuperGrid footer rows, completes the Workbench notebook with formatting toolbar + embedded D3 charts + database persistence, and ships LATCH Phase B subpanes (histogram scrubbers + category chips). v5.3 replaces all hardcoded schema assumptions with runtime PRAGMA introspection, fixes SVG and deleted_at bugs, migrates persisted state to handle dynamic fields, and enables user-configurable LATCH family mappings. v6.0 makes the app ship-ready at 20K-card scale: profile-first instrumentation across all 4 performance domains, targeted optimization of the dominant bottlenecks identified by data, and automated regression guards that prevent future PRs from silently regressing performance. v6.1 hardens every critical data seam with integration tests that exercise real sql.js and real providers -- the quality gate for v7.0 entry. v7.0 delivers the Design Workbench: a production shell with centered menubar, 8-section sidebar, ViewZipper auto-cycling, self-reflecting Data Explorer catalog, and three named themes. v7.1 wires the Notebook panel into MutationManager as a full card editor: inline title/content editing with shadow-buffer undo safety, start-typing card creation, typed property inputs for all 26 schema fields, and CSS-driven card dimension rendering. v7.2 retrofits Alto Index import infrastructure and ETL test harness (shipped ad-hoc), then migrates all remaining HTML5 DnD surfaces to pointer events so every drag interaction works in WKWebView. v8.0 rebuilds SuperGrid from a simplified Figma design using modular composable feature plugins -- each Super* capability (Stack, Zoom, Size, Density, Calc, Scroll, Search, Select, Audit, Sort) is a toggleable plugin with sub-feature granularity, tested incrementally via a visual feature harness. Data source progresses from mock data through alto-index JSON to full sql.js. v8.1 completes the FeatureCatalog by extracting base rendering into plugin factories, migrating SuperStack from HarnessShell closures to registerCatalog(), and implementing all remaining plugin categories (SuperDensity, SuperSearch, SuperSelect, SuperAudit) in a parallel wave -- every FeatureCatalog stub replaced with a working factory. v8.2 extends SuperCalc with user-configurable null handling modes, aggregation scope toggle, COUNT semantics, and structured AggResult return type. v8.3 hardens the plugin system with a complete test suite -- shared jsdom test infrastructure for all 27 plugins, per-hook lifecycle coverage, cross-plugin interaction matrix, and Playwright E2E specs wired into CI. v8.4 removes ViewZipper and makes SidebarNav Visualization Explorer the sole view-switch UI with Play/Stop auto-cycle. v8.5 closes the ETL E2E gap: shared test infrastructure first, then E2E coverage of all four import surfaces (alto-index, native Apple adapters, file-based parsers, and TCC permission lifecycle). v9.0 adds six graph algorithms (Dijkstra shortest path, betweenness centrality, Louvain community detection, clustering coefficient, Kruskal MST, PageRank) powered by graphology inside the Worker, persisted to a new graph_metrics sql.js table, projected as dynamic PAFV axes via SchemaProvider injection, and visualized in NetworkView through a dual-circle encoding layer with legend, source/target picker, and full algorithm controls in a new AlgorithmExplorer sidebar section.

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
- ✅ **v8.2 SuperCalc v2** -- Phase 103 (shipped 2026-03-22)
- ✅ **v8.3 Plugin E2E Test Suite** -- Phases 104-107 (shipped 2026-03-22)
- ✅ **v8.4 Consolidate View Navigation** -- Phase 108 (shipped 2026-03-22)
- 🚧 **v8.5 ETL E2E Test Suite** -- Phases 109-113 (in progress)
- 📋 **v9.0 Graph Algorithms** -- Phases 114-118 (planned)

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

- [x] Phase 15-27 (13 phases) -- completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.1 SuperStack (Phases 28-32) -- SHIPPED 2026-03-06</summary>

- [x] Phase 28-32 (5 phases) -- completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.0 Native ETL (Phases 33-36) -- SHIPPED 2026-03-06</summary>

- [x] Phase 33-36 (4 phases) -- completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.1 Sync + Audit (Phases 37-41) -- SHIPPED 2026-03-07</summary>

- [x] Phase 37-41 (5 phases) -- completed 2026-03-07

See: `.planning/milestones/v4.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.2 Polish + QoL (Phases 42-47) -- SHIPPED 2026-03-07</summary>

- [x] Phase 42-47 (6 phases) -- completed 2026-03-07

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

- [x] Phase 54: WorkbenchShell + AliasProvider (3/3 plans) -- completed 2026-03-08
- [x] Phase 55: PropertiesExplorer + ProjectionExplorer (3/3 plans) -- completed 2026-03-08
- [x] Phase 56: LATCHExplorer + NotebookExplorer (2/2 plans) -- completed 2026-03-08
- [x] Phase 57: VisualExplorer + DnD (3/3 plans) -- completed 2026-03-08

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
<summary>v8.2 SuperCalc v2 (Phase 103) -- SHIPPED 2026-03-22</summary>

- [x] Phase 103: SuperCalc v2 — Null Handling + Filter Scope (2/2 plans) -- completed 2026-03-22

See: `.planning/milestones/v8.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v8.3 Plugin E2E Test Suite (Phases 104-107) -- SHIPPED 2026-03-22</summary>

- [x] Phase 104: Test Infrastructure (2/2 plans) -- completed 2026-03-22
- [x] Phase 105: Individual Plugin Lifecycle (2/2 plans) -- completed 2026-03-22
- [x] Phase 106: Cross-Plugin Interactions (2/2 plans) -- completed 2026-03-22
- [x] Phase 107: Playwright E2E (2/2 plans) -- completed 2026-03-22

See: `.planning/milestones/v8.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v8.4 Consolidate View Navigation (Phase 108) -- SHIPPED 2026-03-22</summary>

- [x] Phase 108: Consolidate View Navigation (2/2 plans) -- completed 2026-03-22

See: `.planning/milestones/v8.4-ROADMAP.md` for full details.

</details>

### 🚧 v8.5 ETL E2E Test Suite (In Progress)

**Milestone Goal:** Close the ETL E2E coverage gap by adding shared test infrastructure and comprehensive end-to-end specs for all four import surfaces: alto-index, native Apple adapters, file-based parsers, and TCC permission lifecycle.

- [ ] **Phase 109: ETL Test Infrastructure** - Shared harness extensions, bridge API additions, alto-index fixture set, and WASM/jsdom boundary enforcement (gap closure pending)
- [ ] **Phase 110: Alto-Index E2E** - Full coverage of all 11 alto-index subdirectory types through parse-to-sql.js correctness, dedup, and 501+ card FTS assertion
- [ ] **Phase 111: Native Apple Adapter E2E** - Notes/Reminders/Calendar fixture injection, auto-connection synthesis, CatalogWriter provenance, NoteStore multi-schema, and protobuf fallback tiers
- [ ] **Phase 112: File-Based Format E2E** - All 6 parsers through ImportOrchestrator to sql.js, malformed input recovery, export round-trip, and cross-format dedup collision detection
- [ ] **Phase 113: TCC Permission Lifecycle** - Grant/deny/revoke/state-change paths via __mockPermission bridge hook with observable UI state transitions

### 📋 v9.0 Graph Algorithms (Planned)

**Milestone Goal:** Add six graph algorithms (Dijkstra shortest path, betweenness centrality, Louvain community detection, clustering coefficient, Kruskal MST, PageRank) powered by graphology inside the Worker, persisted to graph_metrics, projected as dynamic PAFV axes, and visualized through NetworkView's encoding layer with a full AlgorithmExplorer sidebar section.

- [ ] **Phase 114: Storage Foundation** - graph_metrics DDL, Worker protocol types, WorkerBridge methods, and render token design
- [ ] **Phase 115: Algorithm Engine** - All 6 algorithms in graphology Worker handler with sanitization, sampling, and graph scale guards
- [ ] **Phase 116: Schema Integration** - SchemaProvider injection, SuperGridQuery LEFT JOIN, AlgorithmControlsPanel Run flow, and FilterProvider scope
- [ ] **Phase 117: NetworkView Enhancement** - Dual-circle encoding layer, centrality/community visual encoding, path/MST overlays, legend, and source/target picker
- [ ] **Phase 118: Polish + E2E** - Stale indicator persistence, Worker re-init re-injection, multi-algorithm overlay, clear/reset, and E2E specs

## Phase Details

### Phase 109: ETL Test Infrastructure
**Goal**: All subsequent ETL test phases have a trusted foundation of shared helpers, bridge introspection API, CI-safe fixtures, and enforced environment boundaries
**Depends on**: Phase 108 (v8.4 complete)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. `e2e/helpers/etl.ts` exports `importNativeCards()`, `assertCatalogRow()`, and `resetDatabase()` callable from any Playwright spec
  2. `window.__isometry.queryAll()` and `window.__isometry.exec()` return live sql.js query results from within Playwright page context
  3. CI-safe JSON fixtures exist for all 11 alto-index subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) under `tests/fixtures/alto-index/`
  4. The WASM/jsdom boundary rule is documented in `tests/ENVIRONMENT.md` and any test file mixing `realDb()` with `@vitest-environment jsdom` fails CI lint
  5. `better-sqlite3` and `tmp` are installed as devDependencies and appear in `package.json`
**Plans:** 3 plans (2 complete + 1 gap closure)
Plans:
- [ ] 109-01-PLAN.md -- Bridge query API + E2E helpers + devDependencies
- [ ] 109-02-PLAN.md -- Environment boundary enforcement + __mockPermission + alto-index fixtures
- [ ] 109-03-PLAN.md -- Gap closure: fix WASM/jsdom boundary violations in pre-existing test files

### Phase 110: Alto-Index E2E
**Goal**: All 11 alto-index subdirectory types are verified end-to-end from fixture import through sql.js database state, with dedup idempotency and 501+ card FTS searchability confirmed
**Depends on**: Phase 109
**Requirements**: ALTO-01, ALTO-02, ALTO-03, ALTO-04, ALTO-05
**Success Criteria** (what must be TRUE):
  1. A Playwright spec imports each of the 11 alto-index subdirectory fixture types and asserts correct `card_type`, field mapping, and YAML frontmatter completeness for each
  2. Re-importing the same alto-index fixtures produces zero net-new cards (DedupEngine idempotency confirmed via `assertCatalogRow` row count)
  3. A 501+ card alto-index import triggers the FTS5 bulk rebuild path and cards are subsequently findable via CommandBar search
  4. The alto-index purge-then-replace behavior (all cards deleted before processing) is explicitly asserted: non-alto-index seed cards are absent after alto-index import
**Plans**: TBD

### Phase 111: Native Apple Adapter E2E
**Goal**: Notes, Reminders, and Calendar native adapter imports are verified through fixture injection at the bridge boundary, with auto-connections, CatalogWriter provenance, multi-schema branching, and protobuf fallback tiers all confirmed
**Depends on**: Phase 109
**Requirements**: NATV-01, NATV-02, NATV-03, NATV-04, NATV-05, NATV-06, NATV-07
**Success Criteria** (what must be TRUE):
  1. Vitest seam tests confirm `CatalogWriter` creates correct `import_sources`, `import_runs`, and `datasets` rows for each native adapter injection (Notes, Reminders, Calendar)
  2. Auto-connection synthesis is verified in-process: attendee-of person cards are created for Calendar events with attendees, and note-to-note link connections are created for Notes with internal links
  3. NoteStore schema branching is covered: macOS 13 (ZTITLE1) and macOS 14+ (ZTITLE2) fixture variants both yield correct title extraction
  4. Protobuf three-tier fallback is covered: ZDATA body extraction, ZSNIPPET fallback, and null content (no crash, empty string body) are all exercised with explicit assertions
**Plans**: TBD

### Phase 112: File-Based Format E2E
**Goal**: All 6 file-based parsers are verified end-to-end through ImportOrchestrator to sql.js, with malformed input recovery, export round-trip fidelity, and cross-format dedup collision detection confirmed
**Depends on**: Phase 109
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09
**Success Criteria** (what must be TRUE):
  1. Vitest integration tests confirm each of the 6 parsers (JSON, XLSX, CSV, Markdown, HTML, Apple Notes JSON) delivers correct card count, non-null required fields, and correct `source` tag after a full ImportOrchestrator run against the existing `tests/fixtures/` corpus
  2. Malformed/truncated input for each parser produces an ImportToast error state (not a crash) verified via Playwright
  3. Export round-trip (import → export → re-import) for Markdown, JSON, and CSV formats preserves all non-null fields with zero data loss, verified via Vitest
  4. A card imported from two different file formats (same title, different source) produces two distinct rows (cross-format dedup collision detection confirmed)
**Plans**: TBD

### Phase 113: TCC Permission Lifecycle
**Goal**: All four TCC permission state transitions (grant, deny, revoke mid-import, state-change notification) are exercised via the `__mockPermission` bridge hook and their effects are observable in the UI
**Depends on**: Phase 109
**Requirements**: TCC-01, TCC-02, TCC-03, TCC-04
**Success Criteria** (what must be TRUE):
  1. The `__mockPermission` debug hook exists in HarnessShell and can simulate grant, deny, and revoke states without touching real OS TCC dialogs
  2. A Playwright spec confirms the grant path: mock-grant a permission, trigger adapter read, assert cards appear in sql.js via `queryAll()`
  3. A Playwright spec confirms the deny path: mock-deny a permission, trigger adapter read, assert graceful error displayed to user with zero cards written
  4. A Playwright spec confirms revoke mid-import: permission revoked during active import, assert partial result is handled (no crash, ImportToast reflects partial state)
**Plans**: TBD

### Phase 114: Storage Foundation
**Goal**: The graph_metrics persistence layer, Worker protocol types, and render token design are in place so every downstream phase can build against stable interfaces
**Depends on**: Phase 108 (v8.4 complete) — runs in parallel with v8.5 (no file overlap)
**Requirements**: GFND-01, GFND-02, GFND-03
**Success Criteria** (what must be TRUE):
  1. A `graph_metrics` table exists in the sql.js database after Worker init with columns for card_id, centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree, and computed_at
  2. The Worker accepts a `graph:compute` message and constructs a graphology Graph object from the live connections table without crashing on empty or disconnected graphs
  3. `sanitizeAlgorithmResult()` converts NaN and Infinity values to null for all 6 algorithm output fields before any result reaches the main thread
  4. Three new WorkerRequestTypes (`graph:compute`, `graph:metrics-read`, `graph:metrics-clear`) exist in protocol.ts with typed payload and response shapes
  5. WorkerBridge exposes three public methods matching the new protocol types and a `currentRenderToken` increment mechanism is documented in protocol.ts
**Plans**: TBD

### Phase 115: Algorithm Engine
**Goal**: All six graph algorithms run correctly inside the Worker against graphology, write results to graph_metrics, and are independently testable against known small graphs
**Depends on**: Phase 114
**Requirements**: ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05, ALGO-06
**Success Criteria** (what must be TRUE):
  1. User can trigger a shortest path computation between two cards and receive a result with the correct intermediate card sequence (verified against a 5-node test graph with known shortest path of length 3)
  2. User can compute betweenness centrality for all cards; graphs above 2000 nodes automatically use √n-pivot sampling so the computation completes in under 2 seconds
  3. User can compute Louvain community assignments; connected nodes cluster into communities and PageRank scores across all cards sum to approximately 1.0 (within 0.01 tolerance)
  4. User can compute local clustering coefficient and minimum spanning tree; MST edge count equals node count minus 1 for a connected graph, and all six algorithm results are written to graph_metrics rows via idempotent INSERT OR REPLACE
**Plans**: TBD

### Phase 116: Schema Integration
**Goal**: Graph metric columns are queryable as PAFV axes in SuperGrid, the AlgorithmControlsPanel Run button triggers the full compute flow, and algorithms execute against the currently filtered card set
**Depends on**: Phase 115
**Requirements**: PAFV-01, PAFV-02, PAFV-03, CTRL-01, CTRL-02
**Success Criteria** (what must be TRUE):
  1. After running any algorithm, community_id, pagerank, and centrality appear as selectable axis options in the Projection Explorer well droppers
  2. A SuperGrid with community_id as a row axis produces correct grouped rows (cards in the same community are in the same group) via LEFT JOIN graph_metrics
  3. Running an algorithm with an active filter computes scores only over the filtered card set, and the graph_metrics table contains rows only for cards currently in the filter scope
  4. The AlgorithmExplorer sidebar section shows an algorithm radio group, a Run button, Louvain resolution slider, PageRank damping factor input, and centrality sampling threshold control
**Plans**: TBD

### Phase 117: NetworkView Enhancement
**Goal**: NetworkView visually encodes algorithm results through a dual-circle overlay layer so users can see community structure, centrality importance, path connections, and spanning tree topology directly in the graph
**Depends on**: Phase 116
**Requirements**: NETV-01, NETV-02, NETV-03, NETV-04, NETV-05
**Success Criteria** (what must be TRUE):
  1. When centrality or PageRank is active, node size reflects score magnitude via scaleSqrt and community color fills the overlay circle without altering the base source-provenance circle
  2. User can click two nodes in sequence to select a shortest path source and target; path edges render with a distinct highlight stroke and non-path edges are visually dimmed
  3. When MST is active, spanning tree edges are thickened and colored while non-MST edges are dimmed to 0.2 opacity
  4. A legend panel shows the active algorithm name, the color/size encoding scale, and the community palette when community detection is active
  5. A keyboard-accessible dropdown fallback allows source and target node selection for shortest path without requiring mouse clicks on specific nodes
**Plans**: TBD

### Phase 118: Polish + E2E
**Goal**: Algorithm results stay synchronized with data changes, multi-algorithm overlays compose correctly, reset returns NetworkView to its default state, and E2E specs provide a CI hard gate for the full compute-to-render pipeline
**Depends on**: Phase 117
**Requirements**: GFND-04, PAFV-04, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. A stale indicator badge appears in the AlgorithmExplorer section when cards or connections have been modified since the last compute run
  2. User can apply community color encoding and centrality size encoding simultaneously; both overlays are visible on nodes at the same time
  3. Hovering any node shows a tooltip with exact numeric scores for PageRank, centrality, and clustering coefficient
  4. Clicking the Clear/Reset button returns all nodes to default degree sizing and source-provenance coloring with the stale indicator cleared
  5. A Playwright E2E spec covers the full compute flow (run algorithm, assert graph_metrics rows via queryAll(), assert NetworkView encoding active) and runs as a CI hard gate
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-108 complete across 25 milestones. Phase 53 is reserved.

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
| 103 | v8.2 | 2/2 | Complete | 2026-03-22 |
| 104-107 | v8.3 | 8/8 | Complete | 2026-03-22 |
| 108 | v8.4 | 2/2 | Complete | 2026-03-22 |
| 109 | 2/2 | Complete   | 2026-03-22 | - |
| 110 | v8.5 | 0/TBD | Not started | - |
| 111 | v8.5 | 0/TBD | Not started | - |
| 112 | v8.5 | 0/TBD | Not started | - |
| 113 | v8.5 | 0/TBD | Not started | - |
| 114 | v9.0 | 0/TBD | Not started | - |
| 115 | v9.0 | 0/TBD | Not started | - |
| 116 | v9.0 | 0/TBD | Not started | - |
| 117 | v9.0 | 0/TBD | Not started | - |
| 118 | v9.0 | 0/TBD | Not started | - |

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
*v7.2 Alto Index + DnD Migration shipped: 2026-03-21*
*v8.0 SuperGrid Redesign shipped: 2026-03-21*
*v8.1 Plugin Registry Complete shipped: 2026-03-22*
*v8.2 SuperCalc v2 shipped: 2026-03-22*
*v8.3 Plugin E2E Test Suite shipped: 2026-03-22*
*v8.4 Consolidate View Navigation shipped: 2026-03-22*
*v9.0 Graph Algorithms roadmap created: 2026-03-22*
