# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data. v5.0 replaces the flat view layout with a Figma-designed Workbench shell -- a vertical stack of collapsible explorer panels (Properties, Projection, Visual, LATCH, Notebook) that drive SuperGrid through existing providers with zero new dependencies. v5.1 makes SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet through CSS visual baseline tokens, value-first cell rendering, row index gutter, and active cell focus model. v5.2 adds SQL-driven aggregate calculations to SuperGrid footer rows, completes the Workbench notebook with formatting toolbar + embedded D3 charts + database persistence, and ships LATCH Phase B subpanes (histogram scrubbers + category chips). v5.3 replaces all hardcoded schema assumptions with runtime PRAGMA introspection, fixes SVG and deleted_at bugs, migrates persisted state to handle dynamic fields, and enables user-configurable LATCH family mappings. v6.0 makes the app ship-ready at 20K-card scale: profile-first instrumentation across all 4 performance domains, targeted optimization of the dominant bottlenecks identified by data, and automated regression guards that prevent future PRs from silently regressing performance. v6.1 hardens every critical data seam with integration tests that exercise real sql.js and real providers -- the quality gate for v7.0 entry. v7.0 delivers the Design Workbench: a production shell with centered menubar, 8-section sidebar, ViewZipper auto-cycling, self-reflecting Data Explorer catalog, and three named themes. v7.1 wires the Notebook panel into MutationManager as a full card editor: inline title/content editing with shadow-buffer undo safety, start-typing card creation, typed property inputs for all 26 schema fields, and CSS-driven card dimension rendering. v7.2 retrofits Alto Index import infrastructure and ETL test harness (shipped ad-hoc), then migrates all remaining HTML5 DnD surfaces to pointer events so every drag interaction works in WKWebView. v8.0 rebuilds SuperGrid from a simplified Figma design using modular composable feature plugins -- each Super* capability (Stack, Zoom, Size, Density, Calc, Scroll, Search, Select, Audit, Sort) is a toggleable plugin with sub-feature granularity, tested incrementally via a visual feature harness. Data source progresses from mock data through alto-index JSON to full sql.js. v8.1 completes the FeatureCatalog by extracting base rendering into plugin factories, migrating SuperStack from HarnessShell closures to registerCatalog(), and implementing all remaining plugin categories (SuperDensity, SuperSearch, SuperSelect, SuperAudit) in a parallel wave -- every FeatureCatalog stub replaced with a working factory. v8.2 extends SuperCalc with user-configurable null handling modes, aggregation scope toggle, COUNT semantics, and structured AggResult return type. v8.3 hardens the plugin system with a complete test suite -- shared jsdom test infrastructure for all 27 plugins, per-hook lifecycle coverage, cross-plugin interaction matrix, and Playwright E2E specs wired into CI. v8.4 removes ViewZipper and makes SidebarNav Visualization Explorer the sole view-switch UI with Play/Stop auto-cycle. v8.5 closes the ETL E2E gap: shared test infrastructure first, then E2E coverage of all four import surfaces (alto-index, native Apple adapters, file-based parsers, and TCC permission lifecycle). v9.0 adds six graph algorithms (Dijkstra shortest path, betweenness centrality, Louvain community detection, clustering coefficient, Kruskal MST, PageRank) powered by graphology inside the Worker, persisted to a new graph_metrics sql.js table, projected as dynamic PAFV axes via SchemaProvider injection, and visualized in NetworkView through a dual-circle encoding layer with legend, source/target picker, and full algorithm controls in a new AlgorithmExplorer sidebar section. v9.1 prepares for TestFlight: fixes SubscriptionManager tier bug and NotebookExplorer card creation, hardens FeatureGate for Release builds, validates provisioning and StoreKit configuration, and extends graph algorithms with shortest path hop badges, single-source distance coloring, edge betweenness thickness, and weighted Dijkstra. v9.2 adds full lifecycle management for alto-index directory imports: native file picker picks a root directory, auto-discovery enumerates all 11 known subdirectory types, selective import with checkbox UI creates per-directory dataset partitions with source-tagged cards and per-directory progress reporting, and dataset management enables delete-by-dataset and re-import-with-diff-preview -- with binary attachment content explicitly excluded (metadata only). v9.3 fixes broken view rendering across all 9 views: SuperGrid via its unique BridgeDataAdapter path, Timeline and NetworkView via their ViewManager paths with view-specific issues, and the remaining six views plus cross-view navigation through the shared ViewManager data pipeline.

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
- ✅ **v8.5 ETL E2E Test Suite** -- Phases 109-113 (shipped 2026-03-25)
- ✅ **v9.0 Graph Algorithms** -- Phases 114-119 (shipped 2026-03-25)
- ✅ **v9.1 Ship Prep** -- Phases 120-122 (shipped 2026-03-25)
- ✅ **v9.2 Alto Index Import** -- Phases 123-126 (shipped 2026-03-26)
- 🚧 **v9.3 View Wiring Fixes** -- Phases 127-129 (in progress)

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

<details>
<summary>v8.5 ETL E2E Test Suite (Phases 109-113) -- SHIPPED 2026-03-25</summary>

- [x] Phase 109: ETL Test Infrastructure (3/3 plans) -- completed 2026-03-22
- [x] Phase 110: Alto-Index E2E (3/3 plans) -- completed 2026-03-23
- [x] Phase 111: Native Apple Adapter E2E (2/2 plans) -- completed 2026-03-24
- [x] Phase 112: File-Based Format E2E (3/3 plans) -- completed 2026-03-24
- [x] Phase 113: TCC Permission Lifecycle (1/1 plan) -- completed 2026-03-24

See: `.planning/milestones/v8.5-ROADMAP.md` for full details.

</details>

<details>
<summary>v9.0 Graph Algorithms (Phases 114-119) -- SHIPPED 2026-03-25</summary>

- [x] Phase 114: Storage Foundation (2/2 plans) -- completed 2026-03-22
- [x] Phase 115: Algorithm Engine (2/2 plans) -- completed 2026-03-22
- [x] Phase 116: Schema Integration (2/2 plans) -- completed 2026-03-24
- [x] Phase 117: NetworkView Enhancement (2/2 plans) -- completed 2026-03-24
- [x] Phase 118: Polish + E2E (2/2 plans) -- completed 2026-03-25
- [x] Phase 119: Swift Critical Path Tests (3/3 plans) -- completed 2026-03-24

See: `.planning/milestones/v9.0-ROADMAP.md` for full details.

</details>

### v9.1 Ship Prep (Phases 120-122)

- [x] **Phase 120: Ship Prep** - Bug fixes, release readiness, and graph algorithm Phase 2 (completed 2026-03-25)
- [x] **Phase 121: Ship Hardening** - Privacy manifest, CKSyncEngine tests, device validation, sync UX, MetricKit, welcome sheet, ASC metadata, docs reconciliation (completed 2026-03-25)
- [x] **Phase 122: SuperGrid Convergence** - Replace monolithic SuperGrid.ts with plugin-based PivotGrid architecture; wire PluginRegistry into production data flow; retire duplicate code (completed 2026-03-25)


<details>
<summary>v9.2 Alto Index Import (Phases 123-126) -- SHIPPED 2026-03-26</summary>

- [x] Phase 123: Directory Discovery (2/2 plans) -- completed 2026-03-26
- [x] Phase 124: Selective Import + Partitioning (2/2 plans) -- completed 2026-03-26
- [x] Phase 125: Dataset Lifecycle Management (2/2 plans) -- completed 2026-03-26
- [x] Phase 126: Wire Directory Path + Re-Import Refresh (1/1 plan) -- completed 2026-03-26

See: `.planning/milestones/v9.2-ROADMAP.md` for full details.

</details>

### v9.3 View Wiring Fixes (Phases 127-129)

**Milestone Goal:** All 9 views render correctly with real data from sql.js; view switching works from all entry points; empty states are contextually appropriate.

- [ ] **Phase 127: SuperGrid Data Path** - Fix PivotGrid cell rendering, empty state, and CalcExplorer footer rows via BridgeDataAdapter
- [ ] **Phase 128: Timeline + Network** - Fix TimelineView rendering and empty-state logic; fix NetworkView nodes, graph overlays, and AlgorithmExplorer controls
- [ ] **Phase 129: Other Views + Cross-View UX** - Fix List/Grid/Kanban/Calendar/Gallery/Tree rendering via ViewManager; fix view switching and per-view empty states

## Phase Details

### Phase 120: Ship Prep
**Goal**: App is TestFlight-ready with production FeatureGate, fixed tier/notebook bugs, and extended graph algorithm visualization
**Depends on**: Phase 119
**Requirements**: BUGF-01, BUGF-02, SHIP-01, SHIP-02, SHIP-03, SHIP-04, GALG-01, GALG-02, GALG-03, GALG-04
**Success Criteria** (what must be TRUE):
  1. SubscriptionManager returns `.free` for unknown product IDs and FeatureGate enforces tier restrictions in Release builds (no DEBUG bypass)
  2. NotebookExplorer "New Card" action creates a card via MutationManager, selects it, and the Recent Cards list refreshes to show it
  3. TestFlight build archives, uploads, and installs on a physical device with CloudKit entitlement and StoreKit products validated
  4. NetworkView shortest path target displays hop count badge; single-source shortest path colors all reachable nodes by distance; edge betweenness renders as stroke thickness; weighted Dijkstra uses connection attribute cost
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [ ] 120-01: Bug Fixes + Release Readiness (BUGF-01, BUGF-02, SHIP-01..04)
- [ ] 120-02: Graph Algorithms Phase 2 (GALG-01..04)

### Phase 121: Ship Hardening
**Goal**: Close remaining gaps between current state and shippable TestFlight MVP — compliance, native test coverage, crash reporting, sync error UX, first-run experience, and documentation accuracy
**Depends on**: Phase 120
**Requirements**: PRIV-01, SYNC-T01..T08, DVAL-01, SUXR-01, SUXR-02, SUXR-03, MKIT-01, MKIT-02, WLCM-01, ASCI-01, DOCS-01
**Success Criteria** (what must be TRUE):
  1. PrivacyInfo.xcprivacy present with all required reason APIs; Xcode build produces no privacy warnings
  2. CKSyncEngine event handler routing tested for 8 scenarios (signIn/signOut/switchAccounts/purged/encryptedDataReset/deleted/serverRecordChanged/non-conflict error); Swift test ratio ≥ 0.20:1
  3. Critical path validated on physical iPhone (Release config) + CloudKit sync verified on two devices; test log committed
  4. Sync error banner with human-readable messages + retry action + "Re-sync All Data" in Settings
  5. MetricKit crash/hang/metric reporting on both macOS and iOS; diagnostics exportable from Settings
  6. Welcome sheet on first launch with sample data CTA; VoiceOver navigable
  7. App Store Connect metadata sufficient for TestFlight external group
  8. Native CLAUDE.md reflects v9.0 CKSyncEngine architecture (no stale v2.0 claims)
**Plans**: 3 plans (Wave 1: 121-01 + 121-02 parallel; Wave 2: 121-03 sequential after both)

Plans:
- [ ] 121-01: Compliance + Crash Reporting (PRIV-01, MKIT-01, MKIT-02, DOCS-01)
- [ ] 121-02: CKSyncEngine Test Pass + Sync Error UX (SYNC-T01..T08, SUXR-01..03)
- [ ] 121-03: Device Validation + Welcome Sheet + ASC Metadata (DVAL-01, WLCM-01, ASCI-01)

### Phase 122: SuperGrid Convergence
**Goal**: Replace the monolithic production SuperGrid.ts (~5K LOC) with the plugin-based PivotGrid architecture (PluginRegistry + 27 plugins) wired to real WorkerBridge data — one SuperGrid codebase, not two
**Depends on**: Phase 121
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07
**Success Criteria** (what must be TRUE):
  1. Production SuperGrid renders via PivotGrid + PluginRegistry (not monolithic SuperGrid.ts)
  2. All 27 plugins receive real data from WorkerBridge/providers instead of PivotMockData
  3. ViewManager factory instantiates PivotGrid-based SuperGrid; CatalogSuperGrid adapts accordingly
  4. Old monolithic SuperGrid.ts deleted; no dead code remains
  5. All existing SuperGrid tests pass against the new implementation
  6. E2E Playwright specs for SuperGrid pass unchanged
  7. HarnessShell (`?harness=1`) still works for isolated plugin development with mock data
**Plans**: 3 plans (Wave 1: 122-01; Wave 2: 122-02; Wave 3: 122-03)

Plans:
- [ ] 122-01: DataAdapter Interface + BridgeDataAdapter (CONV-01, CONV-03)
- [ ] 122-02: ViewManager + CatalogSuperGrid Wiring (CONV-02, CONV-04, CONV-07)
- [ ] 122-03: Test Migration + Dead Code Deletion (CONV-05, CONV-06)


### Phase 123: Directory Discovery
**Goal**: User can pick an alto-index root directory and see a labeled list of all discovered subdirectories before committing to any import
**Depends on**: Phase 122
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. User can open a native file picker (NSOpenPanel on macOS, fileImporter on iOS) and select an alto-index root directory
  2. After selecting a directory, the app enumerates and displays all 11 known subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) with their type labels
  3. Unrecognized subdirectories are ignored; only known types appear in the preview list
  4. The preview list is visible before any import begins — user can review and cancel
**Plans**: 2 plans (Wave 1 + Wave 2)

Plans:
- [ ] 123-01-PLAN.md — Native directory picker + Swift enumeration (DISC-01, DISC-02)
- [ ] 123-02-PLAN.md — DirectoryDiscoverySheet UI (DISC-03)

### Phase 124: Selective Import + Partitioning
**Goal**: User can select which discovered directories to import, each becoming an independent dataset partition with source-tagged cards, progress visible per directory, and binary attachment content never read
**Depends on**: Phase 123
**Requirements**: IMPT-01, IMPT-02, IMPT-03, IMPT-04, BEXL-01, BEXL-02
**Success Criteria** (what must be TRUE):
  1. Each discovered subdirectory has a checkbox; user can select any subset before importing
  2. Each imported directory creates a distinct import_sources row using the directory path as source identifier
  3. Cards imported from a directory carry a source tag identifying that directory, enabling partition-level queries
  4. During multi-directory import, progress reports show per-directory status (which directory is being processed, how many cards so far)
  5. Attachment metadata fields (path, filename, size, MIME type) appear in card content/metadata; no binary file bytes are read or stored
**Plans**: 2 plans (Wave 1 + Wave 2)

Plans:
- [ ] 124-01-PLAN.md — Per-directory Swift import pipeline + binary exclusion (Swift side)
- [ ] 124-02-PLAN.md — DirectoryDiscoverySheet import state machine + progress UI (TypeScript side)

### Phase 125: Dataset Lifecycle Management
**Goal**: User can manage imported directory datasets independently — viewing them in the catalog, deleting a single dataset without touching others, refreshing via re-import, and previewing changes before a re-import commits
**Depends on**: Phase 124
**Requirements**: DSET-01, DSET-02, DSET-03, DSET-04
**Success Criteria** (what must be TRUE):
  1. Data Explorer catalog shows each imported directory as a distinct dataset row with its name and card count
  2. User can delete all cards from one directory dataset; cards from other datasets are unaffected
  3. User can re-import a directory; existing cards with matching source+source_id are updated in place via DedupEngine (no duplicates created)
  4. Before a re-import commits, user sees a diff preview listing new cards, modified cards, and cards that would be deleted
**Plans**: 2 plans (Wave 1 + Wave 2)

Plans:
- [ ] 125-01-PLAN.md — Catalog actions column + delete-by-dataset (DSET-01, DSET-02)
- [ ] 125-02-PLAN.md — Re-import pipeline + diff preview (DSET-03, DSET-04)

### Phase 126: Wire Directory Path + Re-Import Refresh
**Goal**: Close audit gaps — directoryPath flows through import chunk pipeline so re-import uses stored path instead of falling back to picker; DataExplorer refreshes after re-import commit
**Depends on**: Phase 125
**Requirements**: DSET-03, DSET-04
**Gap Closure**: Closes gaps from v9.2-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. After importing via discovery flow, `datasets.directory_path` is non-NULL for every imported directory
  2. Clicking re-import (↺) on a dataset with stored path triggers seamless re-import without re-opening the picker
  3. After re-import commit, DataExplorer stats panel immediately reflects updated card counts
**Plans**: 1 plan

Plans:
- [ ] 126-01-PLAN.md — directoryPath pipeline fix + refreshDataExplorer call (DSET-03, DSET-04)

### Phase 127: SuperGrid Data Path
**Goal**: PivotGrid renders real sql.js data through BridgeDataAdapter with correct cell counts, axis labels, CalcExplorer footer aggregates, and informative empty states
**Depends on**: Phase 126
**Requirements**: SGRD-01, SGRD-02, SGRD-03
**Success Criteria** (what must be TRUE):
  1. After importing cards, SuperGrid cells show correct counts and header cells show the configured axis label values
  2. CalcExplorer footer rows render SUM/AVG/COUNT/MIN/MAX aggregates below data cells when a column aggregate function is configured
  3. When no axes are configured, SuperGrid displays an actionable empty state prompting axis selection (not a blank screen)
  4. When axes are configured but no cards match the current filters, SuperGrid displays a "no results" empty state distinct from the no-axes state
**Plans**: 2 plans

Plans:
- [ ] 127-01-PLAN.md — Fix PivotGrid data path: derive row/col combinations from query results, add two-state empty states (SGRD-01, SGRD-02)
- [ ] 127-02-PLAN.md — Fix CalcExplorer footer aggregate row rendering and styling (SGRD-03)

### Phase 128: Timeline + Network
**Goal**: TimelineView renders cards with due_at dates on a positioned SVG timeline; NetworkView renders card nodes with connection edges and fully functional AlgorithmExplorer controls
**Depends on**: Phase 127
**Requirements**: TMLN-01, TMLN-02, TMLN-03, NETW-01, NETW-02, NETW-03, NETW-04
**Success Criteria** (what must be TRUE):
  1. TimelineView renders cards that have a due_at date as positioned markers on the SVG timeline with correct temporal spacing
  2. When all cards lack due_at, TimelineView shows a contextual empty state explaining the date requirement (not an empty SVG or spinner)
  3. Swimlane grouping by status or field produces distinct horizontal rows with correct overlap handling for concurrent cards
  4. NetworkView renders all cards as nodes with connection edges and a stable force-directed layout after graph:simulate completes
  5. AlgorithmExplorer radio group, Run button, and parameter sliders are visible and functional; running an algorithm updates node colors/sizes/edge styles in the graph
  6. Source/target picker and legend panel display correctly and update NetworkView on interaction
**Plans**: TBD

### Phase 129: Other Views + Cross-View UX
**Goal**: All six remaining views (List, Grid, Kanban, Calendar, Gallery, Tree) render cards via the ViewManager data path; view switching from all entry points works; each view has a correct contextual empty state
**Depends on**: Phase 128
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, CVUX-01, CVUX-02
**Success Criteria** (what must be TRUE):
  1. ListView, GridView, KanbanView, CalendarView, GalleryView, and TreeView each render cards from sql.js through ViewManager._fetchAndRender()
  2. KanbanView drag-drop moves a card between columns and persists the status change to sql.js
  3. TreeView expand/collapse toggles work correctly via the _children stash pattern without re-stratifying the hierarchy
  4. Switching views via SidebarNav, Cmd+1 through Cmd+9, and command palette all trigger the correct view render
  5. Each view shows its contextual empty state when no cards match current filters, not a spinner or blank container
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-126 complete across 29 milestones. Phase 53 is reserved.

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
| 109-113 | v8.5 | 12/12 | Complete | 2026-03-24 |
| 114-119 | v9.0 | 13/13 | Complete | 2026-03-25 |
| 120-122 | v9.1 | 8/8 | Complete | 2026-03-25 |
| 123-126 | v9.2 | 7/7 | Complete | 2026-03-26 |
| 127 | 1/2 | In Progress|  | - |
| 128 | v9.3 | 0/TBD | Not started | - |
| 129 | v9.3 | 0/TBD | Not started | - |

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
*v8.5 ETL E2E Test Suite shipped: 2026-03-25*
*v9.0 Graph Algorithms shipped: 2026-03-25*
*v9.1 roadmap created: 2026-03-25*
*v9.1 Ship Prep shipped: 2026-03-25*
*v9.2 Alto Index Import shipped: 2026-03-26*
*v9.3 View Wiring Fixes roadmap created: 2026-03-26*
