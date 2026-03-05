# Isometry v5

## What This Is

A local-first, polymorphic data projection platform where LATCH separates, GRAPH joins, and any axis maps to any plane. Ships as a native SwiftUI multiplatform app (iOS 17+ / macOS 14+) hosting the TypeScript/D3.js web runtime inside WKWebView, with sql.js as the in-memory database and system of record. Imports from 6 sources (Apple Notes, Markdown, Excel, CSV, JSON, HTML) with idempotent dedup and exports to 3 formats. Database persists across sessions via atomic checkpoint writes, syncs across devices via iCloud Documents, and enforces Free/Pro/Workbench feature tiers via StoreKit 2. SuperGrid is now a fully dynamic, interactive PAFV projection surface with drag-and-drop axis transpose, zoom/scroll navigation, column resize, lasso selection, 4-level density control, sort, filter, FTS5 search, smart time hierarchy, and aggregation cards.

## Core Value

SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins. The database is the truth, the view is a projection, and switching views changes the SQL, not the data.

## Requirements

### Validated

- ✓ sql.js database with canonical schema (cards, connections, FTS5, ui_state) — v0.1
- ✓ Card CRUD with soft delete and parameterized queries — v0.1
- ✓ Connection CRUD with via_card_id pattern for rich relationships — v0.1
- ✓ FTS5 search with rowid joins and ranked results — v0.1
- ✓ Performance thresholds: insert <10ms, bulk insert <1s, FTS <100ms, graph <500ms — v0.1
- ✓ Provider system (Filter, PAFV, Selection, Density) with SQL-safe allowlisted compilation — v0.5
- ✓ SQL safety: double-validation (addFilter + compile), allowlisted fields/operators, injection rejection — v0.5
- ✓ Mutation Manager with command-pattern undo/redo and rAF-batched notifications — v0.5
- ✓ Three-tier state persistence (Durable via StateManager, Session via providers, Ephemeral via SelectionProvider) — v0.5
- ✓ Nine D3 views (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid) with stable key functions — v0.5/v1.0
- ✓ View transitions: SVG morph (list/grid/timeline) and crossfade (LATCH/GRAPH boundary) — v0.5
- ✓ KanbanView drag-drop with undoable mutations (Cmd+Z) — v0.5
- ✓ Worker Bridge with typed message protocol, correlation IDs, init queuing, and timeouts — v1.0
- ✓ NetworkView: force-directed graph with simulation running in Worker (not main thread) — v1.0
- ✓ TreeView: hierarchical layout from contains/parent connections with collapsible nodes — v1.0
- ✓ SuperGrid: nested dimensional headers with PAFV stacked axis assignments (SuperStack) — v1.0

- ✓ Full ETL pipeline with CanonicalCard/CanonicalConnection canonical type contract — v1.1
- ✓ Six source parsers: Apple Notes, Markdown, Excel, CSV, JSON, HTML — v1.1
- ✓ DedupEngine with source+source_id idempotent re-import classification — v1.1
- ✓ SQLiteWriter with 100-card batched parameterized writes and FTS trigger optimization — v1.1
- ✓ ImportOrchestrator with progress reporting via WorkerNotification protocol — v1.1
- ✓ ExportOrchestrator for Markdown (YAML frontmatter), JSON, CSV (RFC 4180) — v1.1
- ✓ Data Catalog schema (import_sources, import_runs) with CatalogWriter provenance tracking — v1.1
- ✓ ImportToast UI with progress/finalizing/success/error states — v1.1

- ✓ Xcode multiplatform project (iOS 17/macOS 14) with WKURLSchemeHandler serving WASM via `app://` scheme — v2.0
- ✓ Bidirectional Swift↔JS bridge (5 message types: LaunchPayload, checkpoint, mutated, native:action, sync) with WeakScriptMessageHandler — v2.0
- ✓ DatabaseManager actor with atomic checkpoint persistence, 30s autosave, crash recovery — v2.0
- ✓ NavigationSplitView shell with 9-view sidebar, platform-adaptive toolbars, macOS Commands — v2.0
- ✓ Native file picker (iOS fileImporter + macOS NSOpenPanel) feeding existing ETL pipeline — v2.0
- ✓ iCloud Documents path resolution with NSFileCoordinator-wrapped writes and auto-migration — v2.0
- ✓ StoreKit 2 SubscriptionManager with Free/Pro/Workbench tiers and FeatureGate enforcement — v2.0
- ✓ PaywallView with purchase flow, restore purchases, and SettingsView with tier display — v2.0

- ✓ PAFVProvider stacked row/column axes with validated setters, getStackedGroupBySQL(), and serialization round-trip — v3.0
- ✓ SuperGridQuery Worker wiring with rAF coalescing (4 calls → 1 request) and db:distinct-values handler — v3.0
- ✓ SuperGrid dynamic axis reads: live provider-driven rendering replacing all hardcoded constants — v3.0
- ✓ SuperDynamic: drag-and-drop axis transpose between row and column dimensions with 300ms D3 transitions — v3.0
- ✓ SuperPosition + SuperZoom: CSS Custom Property zoom with frozen sticky headers and scroll position restore — v3.0
- ✓ SuperSize: Pointer Events column resize with auto-fit, Shift+drag bulk normalize, and Tier 2 persistence — v3.0
- ✓ SuperSelect: Z-axis aware lasso/Cmd+click/Shift+click 2D range selection with bounding box cache — v3.0
- ✓ SuperDensity: 4-level Janus density model (Value time hierarchy, Extent hide empty, View spreadsheet/matrix, Region stub) — v3.0
- ✓ SuperSort: per-group header sort with multi-sort priority, visual indicators, and SQL ORDER BY injection — v3.0
- ✓ SuperFilter: auto-filter dropdowns populated from current query with Select All/Clear and Cmd+click "only this" — v3.0
- ✓ SuperSearch: FTS5 in-grid search with 300ms debounce, compound supergrid:query, D3-managed mark highlights — v3.0
- ✓ SuperTime: smart time hierarchy auto-detection with segmented pills and non-contiguous period selection — v3.0
- ✓ SuperCards + Polish: aggregation cards at group intersections, help overlay, context menu, performance benchmarks — v3.0

### Active

<!-- Next milestone TBD — use /gsd:new-milestone -->

- [ ] SuperCalc: HyperFormula PAFV-scoped calculations (deferred from v3.0 — formula reference syntax unsolved, ~500KB bundle)
- [ ] SuperAudit: Computed value visual distinction (deferred from v3.0 — requires SuperCalc)
- [ ] CloudKit subscription sync with custom zones and change tokens
- [ ] Multi-level axis stacking (3+ levels) for SuperGrid
- [ ] Virtual scrolling or windowing for extremely large grids

### Out of Scope

- Conflict resolution for concurrent edits across devices — future
- Push notification for remote changes — future
- Deep links (`isometry://view/network`) for direct navigation — future
- Share extension (share-to-Isometry) for clipping web content — future
- WidgetKit extension showing card count and recent imports — future
- Haptic feedback integration for drag-drop and import success — future
- Schema-on-read extras (EAV table) — deferred per D-008
- Designer Workbench / App Builder — future tier
- Android/Windows native shells — future
- DuckDB swap — future optimization
- Collaborative features — future
- Real OAuth credential flows — web runtime uses bridge to native Keychain
- Column mapping UI for Excel/CSV — auto-detection covers 80% of exports
- Markdown wikilink extraction → connections — future
- Cross-source fuzzy entity resolution — false positive risk
- Import undo via MutationManager (use DELETE by import_run_id instead)
- Base64 attachment binary storage (OOM risk — metadata only)
- Streaming XLSX reads (ZIP central directory at EOF — architecturally impossible)
- In-grid cell editing — cards have rich content; double-click opens card detail view
- Virtual scrolling for 100K+ rows — grid renders group intersections (max 2,500 cells)
- Arbitrary column pinning (mid-grid freeze) — PAFV axis model handles header pinning via SuperZoom
- Conditional formatting rules — requires formula engine (SuperCalc deferred)
- HyperFormula in v3.0 — formula reference syntax for PAFV coordinates unsolved, ~500KB bundle (deferred to v3.1+)

## Context

Shipped v3.0 SuperGrid Complete with ~20,608 TypeScript LOC + 2,573 Swift LOC, across 6 milestones (v0.1, v0.5, v1.0, v1.1, v2.0, v3.0).
1,893 tests passing. 144 commits in v3.0 alone (+44,330 / -645 lines across 158 files).
Web runtime stack: TypeScript 5.9 (strict), sql.js 1.14 (custom FTS5 WASM 756KB), D3.js v7.9, Vite 7.3, Vitest 4.0.
Native stack: Swift (iOS 17+ / macOS 14+), SwiftUI, WKWebView, WKURLSchemeHandler, StoreKit 2.
ETL dependencies: gray-matter (YAML frontmatter), PapaParse (CSV), xlsx/SheetJS (Excel, dynamic import).

v3.0 made SuperGrid a fully interactive PAFV projection surface: drag-and-drop axis transpose, CSS Custom Property zoom with frozen headers, Pointer Events column resize, lasso selection with bounding box cache, 4-level Janus density model, per-group sort with multi-sort, auto-filter dropdowns, FTS5 in-grid search with D3-managed highlights, smart time hierarchy with non-contiguous period selection, and aggregation cards. All 71 requirements validated.

The fundamental insight: LATCH (Location, Alphabet, Time, Category, Hierarchy) covers every way to *separate* information. GRAPH covers every way to *connect* it. PAFV (Planes, Axes, Facets, Values) maps any dimension to any screen coordinate.

Key specifications:
- `CLAUDE-v5.md` — canonical architectural decisions (D-001 through D-010), all final
- `Isometry v5 SPEC.md` — product vision, foundational concepts (LATCH, GRAPH, PAFV)
- `Modules/Core/Contracts.md` — schema and type definitions
- `Modules/Core/WorkerBridge.md` — canonical message protocol
- `Modules/DataExplorer.md` — ETL spec (parsers, dedup, export, catalog)

Known technical debt:
- Schema loading uses conditional dynamic import (node:fs vs ?raw) — works but adds code paths
- ~~WKWebView WASM MIME type rejection~~ — ✅ RESOLVED in v2.0 via WKURLSchemeHandler
- D3 `.transition()` on SVG transform crashes jsdom (parseSvg) — direct `.attr()` used, transition only for opacity
- GalleryView uses pure HTML (no D3 data join) — tiles rebuilt on render(); no incremental update
- @vitest/web-worker shares Worker module state between instances — constrains test isolation
- Graph algorithms (PageRank, Louvain) deferred to future phase
- Pre-existing TypeScript strict mode violations in ETL test files — tsc --noEmit blocked, Vite transpiles correctly
- build:native skips tsc due to ETL test type errors — TypeScript errors don't affect runtime
- Provisioning profile needs iCloud Documents entitlement regeneration in Apple Developer Portal
- StoreKit 2 products need App Store Connect setup for production (works with .storekit sandbox locally)
- Multi-level axis stacking (3+ levels) deferred — only primary axis field used for D3 keying (v3.0 Info debt)
- Pre-existing TS2345 type errors at SuperGrid.ts lines 1518/1522 — AxisMapping type mismatch from drag payload
- 5 pre-existing test failures in supergrid.handler.test.ts (db.prepare not a function) — present before v3.0
- PLSH-01 adapted from 50×50 grid to 10×10 in jsdom (100× slower DOM ops) — algorithmic guard preserved

## Constraints

- **Web stack**: TypeScript (strict), sql.js (WASM), D3.js v7, Vite, Vitest — no React, no Redux, no framework
- **Native stack**: Swift (iOS 17+ / macOS 14+), SwiftUI, WKWebView — Swift owns exactly 5 concerns (MIME serving, bridge, db persistence, file picker, lifecycle)
- **TDD**: Red-Green-Refactor is non-negotiable. Every feature starts with a failing test.
- **No parallel state**: D3's data join IS state management. No MobX/Redux/Zustand duplicating SQLite data.
- **SQL safety**: All dynamic queries use allowlisted fields + parameterized values. No raw SQL from UI.
- **Credentials**: Keychain only for tokens/secrets. SQLite stores metadata only.
- **Connections**: Lightweight relations table, not cards. Rich edges via `via_card_id`.
- **FTS**: Always join on rowid, never on id. Four indexed fields: name, content, tags, folder.
- **Selection**: Tier 3 (ephemeral). Never persisted to database.
- **Worker Bridge protocol**: All Worker communication uses WorkerMessage/WorkerResponse envelope with correlation IDs.
- **Native Bridge protocol**: 5 message types only — LaunchPayload, checkpoint, mutated, native:action, sync. No per-mutation IPC.
- **Checkpoint pattern**: sql.js database saved as binary blob via base64 transport. No parallel native SQLite schema.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| D-001: Lightweight relations | Lower schema complexity for v5 | ✓ Good — v0.1 validated |
| D-002: Single WorkerBridge spec | Core/WorkerBridge.md is canonical | Decided ✓ |
| D-003: Allowlist + Parameters | SQL safety without ORM overhead | ✓ Good — v0.5 validated (double-validation, injection tests) |
| D-004: rowid FTS joins | Correct FTS5 content table usage | ✓ Good — v0.1 validated (21 search tests) |
| D-005: Three-tier persistence | Clear rules for what persists where | ✓ Good — v0.5 validated (SelectionProvider Tier 3, StateManager Tier 2) |
| D-006: Nine views with tier gating | Free/Pro/Workbench feature gates | ✓ Good — 9/9 views shipped (v0.5 + v1.0) |
| D-007: Keychain-only credentials | No secrets in SQLite | Decided ✓ |
| D-008: Defer schema-on-read extras | Fixed schema for v5, EAV in Phase 2 | Decided ✓ |
| D-009: Command log undo/redo | Inverse operations, in-memory stack | ✓ Good — v0.5 validated (MutationManager, batchMutation pre-reversal) |
| D-010: Dirty flag + debounce sync | Lifecycle-aware CloudKit triggers | Decided ✓ |
| TDD enforcement | Spec mandates red-green-refactor | ✓ Good — 897 tests through v1.0 |
| Research flexibility | Open to better tooling within locked architecture | ✓ Good — Vite 7/Vitest 4 chosen |
| Custom FTS5 WASM build | sql.js 1.14.0 lacks FTS5; Emscripten build needed | ✓ Good — 756KB, FTS5 verified |
| db.exec()/db.run() for Phase 2 | withStatement deferred to Phase 3 | ✓ Good — simple, 151 tests pass |
| p99 as p95 proxy | tinybench lacks p95; p99 < threshold implies p95 passes | ✓ Good — conservative |
| HTML5 DnD over d3.drag for KanbanView | d3.drag intercepts dragstart, corrupts dataTransfer | ✓ Good — native DnD works in jsdom with polyfill |
| SVG morph only for SVG_VIEWS pairs | list/grid/timeline share g.card elements | ✓ Good — crossfade handles all other transitions |
| QueryBuilder as sole SQL assembly | All SQL from provider compile() outputs, no escape hatch | ✓ Good — airtight boundary |
| Two-tier batching (microtask + setTimeout) | Providers self-notify; StateCoordinator cross-provider at 16ms | ✓ Good — no over-notification |
| GalleryView pure HTML (no D3) | Tiles rebuilt on render; no data join needed for simple grid | ✓ Good — simpler than SVG views |
| Force simulation in Worker | stop()+tick() loop off-thread, no per-tick postMessage | ✓ Good — v1.0 validated (stable positions only) |
| SuperStackHeader run-length spanning | CSS Grid `grid-column: span N` with recursive leaf-count | ✓ Good — v1.0 validated (SuperGrid) |
| TreeView _children stash | Never re-stratify on expand/collapse | ✓ Good — v1.0 validated (preserves root) |
| @vitest/web-worker shared module state | Fresh Worker instances share state; tests use shared bridge | ✓ Good — contract still verified |
| CanonicalCard as integration seam | All parsers output same type, all writers consume it | ✓ Good — v1.1 validated (6 parsers, 1 writer) |
| 100-card transaction batches | Prevent WASM OOM on large imports (P22) | ✓ Good — v1.1 validated (5K card test) |
| db.prepare() only write path | Prevent SQL injection in SQLiteWriter (P23) | ✓ Good — v1.1 validated |
| FTS trigger disable/rebuild for bulk | Avoid per-row trigger overhead on >500 card imports (P24) | ✓ Good — v1.1 validated |
| In-memory Map for DedupEngine | Prevent SQL injection from source_id values (P25) | ✓ Good — v1.1 validated |
| Regex-based HTML parsing | Worker-safe without DOM dependency; no linkedom needed | ✓ Good — v1.1 validated (XSS-safe) |
| Dynamic import for SheetJS | Defers ~1MB bundle load until first Excel parse (P27) | ✓ Good — v1.1 validated |
| WorkerNotification protocol | Broadcast messages (no correlation ID) for progress events | ✓ Good — v1.1 validated (ImportToast) |
| Per-request timeout override | Avoids mutating shared config state; 300s for ETL imports | ✓ Good — v1.1 validated |
| gray-matter for Markdown round-trip | Same library for import and export ensures frontmatter fidelity | ✓ Good — v1.1 validated |
| Semicolon-separated tags in CSV | Avoids comma conflicts while preserving single-field export | ✓ Good — v1.1 validated |
| WKURLSchemeHandler for WASM | app:// custom scheme with explicit MIME types | ✓ Good — v2.0 validated (WASM loads correctly) |
| WeakScriptMessageHandler | Private nested class prevents WKUserContentController retain cycle | ✓ Good — v2.0 validated (deallocation test) |
| Two-phase native launch | waitForLaunchPayload blocks before WorkerBridge so dbData arrives before WASM init | ✓ Good — v2.0 validated (checkpoint hydration works) |
| Base64 binary transport | WKScriptMessageHandler receives Uint8Array as dictionary — base64 encoding required | ✓ Good — v2.0 validated (round-trip test) |
| DatabaseManager actor | Swift actor for serialized file I/O with atomic .tmp/.bak/.db rotation | ✓ Good — v2.0 validated (10 XCTests) |
| Timer.scheduledTimer for autosave | Main run loop timer auto-pauses on background — simpler than Task.sleep | ✓ Good — v2.0 validated (DATA-05) |
| NSApplicationDelegateAdaptor | macOS quit save — ScenePhase.background doesn't fire on cmd-Q | ✓ Good — v2.0 validated |
| Message-driven Worker init | Eliminates race between auto-init and wasm-init in native context | ✓ Good — v2.0 validated (1163 tests) |
| db:query separate from db:exec | Preserves MutationManager DML contract; ViewManager SELECTs need db.exec() | ✓ Good — v2.0 validated |
| ContentView always uses app:// | Even in DEBUG — console forwarding replaces dev server HMR | ✓ Good — v2.0 validated |
| NavigationSplitView detailOnly | Maximises D3 canvas area; sidebar toggle reveals it | ✓ Good — v2.0 validated |
| JSONSerialization for bridge payloads | Handles quotes, newlines, special chars safely (no string interpolation) | ✓ Good — v2.0 validated |
| native:action kind discriminator | Extensible for future actions without new message types | ✓ Good — v2.0 validated (importFile) |
| iCloud ubiquity container root | Database hidden from iOS Files app (not in Documents/) | ✓ Good — v2.0 validated |
| NSFileCoordinator for full rotation | Sync daemon sees atomic transition, not partial state | ✓ Good — v2.0 validated |
| StoreKit 2 Transaction.updates first | Listener started before product loading per Apple best practice | ✓ Good — v2.0 validated |
| FeatureGate pure static functions | Zero state, easily testable tier enforcement | ✓ Good — v2.0 validated |
| CSS Custom Property zoom (not d3.zoom) | overflow:auto conflict with d3.zoom transform is architectural | ✓ Good — v3.0 validated (SuperZoom) |
| SuperPositionProvider NOT in StateCoordinator | Would trigger 60 supergrid:query calls/second during scroll | ✓ Good — v3.0 validated |
| HTML5 DnD dragPayload as module singleton | dataTransfer.getData() blocked during dragover | ✓ Good — v3.0 validated (SuperDynamic) |
| FTS highlights via D3 data join (not innerHTML) | Security and D3 ownership — no innerHTML injection outside data join | ✓ Good — v3.0 validated (SuperSearch) |
| Lasso bounding box cache | Live getBoundingClientRect() per mousemove = O(N×M) layout thrash | ✓ Good — v3.0 validated (SuperSelect) |
| gridColumn/gridRow in enter AND update | Density collapse misalignment if set only in enter callback | ✓ Good — v3.0 validated (DENS-06) |
| All axis state in PAFVProvider | SuperGrid instance state orphans on view destroy | ✓ Good — v3.0 validated (colAxes, rowAxes, sortOverrides, colWidths) |
| SuperDensityProvider as standalone provider | Density concerns orthogonal to axis assignments | ✓ Good — v3.0 validated |
| Hybrid density routing | Granularity changes → Worker re-query; hideEmpty/viewMode → client-side transform | ✓ Good — v3.0 validated |
| rAF coalescing for superGridQuery | 4 simultaneous StateCoordinator callbacks → 1 Worker request | ✓ Good — v3.0 validated (FOUN-11) |
| SuperCalc deferred to v3.1+ | Formula reference syntax for PAFV coordinates unsolved; ~500KB HyperFormula bundle | Decided ✓ |

---
*Last updated: 2026-03-05 after v3.0 milestone*
