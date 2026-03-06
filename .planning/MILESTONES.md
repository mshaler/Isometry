# Milestones

## v4.0 Native ETL (Shipped: 2026-03-06)

**Phases:** 33-36 | **Plans:** 9 | **Commits:** 39 | **LOC:** 6,103 Swift + 21,467 TypeScript (total)
**Timeline:** 2 days (2026-03-05 to 2026-03-06)
**Git range:** `feat(33-01)` to `docs(phase-36)`
**Files changed:** 57 (+8,360 / -139 lines)

**Key accomplishments:**
1. Native ETL Foundation (Phase 33) -- NativeImportAdapter protocol with AsyncStream batch yielding, 200-card chunked base64 bridge dispatch, PermissionManager actor with security-scoped bookmark caching, CoreDataTimestampConverter with XCTest-verified epoch offset, and MockAdapter end-to-end pipeline validation (5K stress test)
2. Reminders Adapter (Phase 34) -- EventKit-based RemindersAdapter importing incomplete + last-30-days completed reminders with priority mapping, recurrence metadata, list-as-folder, and dedup via calendarItemIdentifier
3. Calendar Adapter (Phase 34) -- CalendarAdapter with attendee person cards as link cards, all-day event handling, recurring event expansion, synthesized content for noteless events, and is_collective for multi-attendee events
4. Notes Title + Metadata (Phase 35) -- Direct SQLite3 C API reading of NoteStore.sqlite with runtime schema version detection, folder hierarchy self-join, encrypted note filtering, hashtag extraction, and dedup via ZIDENTIFIER
5. Notes Content Extraction (Phase 36) -- SwiftProtobuf gzip decompression + protobuf body text extraction with three-tier fallback (full Markdown / plain text / ZSNIPPET), attachment metadata, note-to-note link connections with bidirectional weights, and FTS5 searchability
6. normalizeNativeCard() cross-language fix -- Discovered and fixed Swift JSONEncoder nil-skipping bug (encodeIfPresent omits nil keys) with TypeScript-side normalization for all native adapters

**Requirements completed:** 30/30 (FNDX-01..08, RMDR-01..05, CALR-01..06, NOTE-01..06, BODY-01..05)

---

## v3.0 SuperGrid Complete (Shipped: 2026-03-05)

**Phases:** 15-27 | **Plans:** 35 | **Tasks:** 71 | **Commits:** 144 | **LOC:** ~20,608 TypeScript (total)
**Timeline:** 2 days (2026-03-04 to 2026-03-05)
**Git range:** `feat(15-01)` to `feat(27-03)`
**Tests:** 1,893 passing (~460 new since v2.0)
**Files changed:** 158 (+44,330 / -645 lines)

**Key accomplishments:**
1. Dynamic PAFV Foundation (Phases 15-17) — PAFVProvider stacked row/column axes, SuperGridQuery Worker wiring with rAF coalescing (4 calls → 1 request), live provider-driven rendering replacing all hardcoded constants
2. Drag-and-Drop Axis Transpose (Phase 18) — HTML5 DnD axis header repositioning between row and column dimensions with 300ms D3 transition animations and cross-session persistence
3. Cartographic Navigation (Phases 19-20) — CSS Custom Property zoom with frozen sticky headers, Pointer Events column resize with auto-fit and Shift+drag bulk normalize, cross-session width persistence
4. Z-axis Selection System (Phase 21) — Lasso, Cmd+click, Shift+click 2D rectangular range selection with bounding box cache, click zone discrimination (header/data/SuperCard), and Escape clear
5. Data Operations Suite (Phases 22-26) — 4-level Janus density model (Value/Extent/View/Region stub), per-group sort with multi-sort priority, auto-filter dropdowns from current query, FTS5 in-grid search with D3-managed highlights, smart time hierarchy with non-contiguous period selection
6. SuperCards + Polish (Phase 27) — Aggregation cards at group intersections with dashed border visual, keyboard shortcut help overlay, right-click context menu, performance benchmarks (<16ms render, <100ms query, <300ms transpose)

**Requirements completed:** 71/71 (FOUN-01..11, DYNM-01..05, POSN-01..03, ZOOM-01..04, SIZE-01..04, SLCT-01..08, DENS-01..06, SORT-01..04, FILT-01..05, SRCH-01..06, TIME-01..05, CARD-01..05, PLSH-01..05)

---

## v2.0 Native Shell (Shipped: 2026-03-03)

**Phases:** 11-14 | **Plans:** 11 | **Commits:** 45 | **LOC:** 2,573 Swift + 34,211 TypeScript (total)
**Timeline:** 2 days (2026-03-02 to 2026-03-03)
**Git range:** `feat(11-01)` to `feat(14-03)`
**Files changed:** 82 (+13,598 / -163 lines)

**Key accomplishments:**
1. Xcode multiplatform project (iOS 17/macOS 14) with WKURLSchemeHandler serving Vite bundle via `app://` scheme — solved the long-deferred WASM MIME type rejection issue
2. Bidirectional Swift↔JS bridge (5 message types) with WeakScriptMessageHandler retain cycle prevention and two-phase native launch flow (waitForLaunchPayload → createWorkerBridge)
3. DatabaseManager actor with atomic checkpoint persistence (.tmp → rotate .bak → rename), 30-second autosave timer, iOS background save via beginBackgroundTask, and WebContent crash recovery overlay
4. NavigationSplitView shell with 9-view sidebar, platform-adaptive toolbars, macOS Commands (File > Import, Edit > Undo/Redo with Cmd+Z/⇧Z)
5. Native file picker (iOS fileImporter + macOS NSOpenPanel) feeding existing ETL pipeline via JSONSerialization bridge — zero new Swift parsing code
6. iCloud Documents path resolution with NSFileCoordinator-wrapped writes, auto-migration from local to ubiquity container, StoreKit 2 SubscriptionManager (Free/Pro/Workbench tiers), and FeatureGate enforcement

**Requirements completed:** 28/28 (SHELL-01..05, BRDG-01..05, DATA-01..05, CHRM-01..05, FILE-01..04, TIER-01..04)

---

## v1.1 ETL Importers (Shipped: 2026-03-02)

**Phases:** 8-10 | **Plans:** 12 | **Commits:** 75 | **LOC:** 70,123 TypeScript (total)
**Timeline:** 1 day (2026-03-01 to 2026-03-02)
**Git range:** `feat(08-01)` to `docs(phase-10)`
**Tests:** ~1,433 test cases (~536 new since v1.0)

**Key accomplishments:**
1. Full ETL pipeline with canonical type contract (CanonicalCard/CanonicalConnection), DedupEngine for idempotent re-imports, and SQLiteWriter with 100-card batched parameterized writes
2. Six source parsers: Apple Notes (alto-index JSON), Markdown (YAML frontmatter via gray-matter), Excel (dynamic SheetJS import), CSV (PapaParse with BOM handling), JSON (auto-field detection), HTML (regex-based Worker-safe with XSS prevention)
3. Three export formats: Markdown (YAML frontmatter round-trip), JSON (pretty-printed with tags as arrays), CSV (RFC 4180 via PapaParse) with ExportOrchestrator
4. Import provenance tracking: Data Catalog schema (import_sources + import_runs) with CatalogWriter for full audit trail
5. Worker Bridge progress reporting: WorkerNotification protocol with per-request timeout override, ImportToast UI component, and card-import-highlight CSS animation
6. Critical safety mitigations active: P22 (OOM via 100-card batches), P23 (SQL injection via db.prepare()), P24 (FTS trigger disable/rebuild for bulk), P25 (in-memory Map for DedupEngine)

**Requirements completed:** 19/19 (ETL-01..ETL-19)

---

## v1.0 Web Runtime (Shipped: 2026-03-01)

**Phases:** 3, 7 | **Plans:** 7 | **Commits:** ~24 | **LOC:** 24,298 TypeScript
**Timeline:** 2 days (2026-02-28 to 2026-03-01)
**Git range:** `feat(03-01)` to `docs(v1.0)`
**Tests:** 897 passing (123 new since v0.5)

**Key accomplishments:**
1. Worker Bridge with typed async RPC, UUID correlation IDs, init queue replay, and configurable timeouts (BRIDGE-01..07)
2. NetworkView: force-directed graph with Worker-hosted d3-force simulation, zoom/pan, drag pinning, hover dimming
3. TreeView: collapsible hierarchy via d3-stratify/d3-tree, multi-root forest support, _children stash pattern
4. SuperGrid: nested PAFV dimensional headers with run-length SuperStackHeader spanning algorithm, CSS Grid layout
5. Full 9-view D3 suite operational (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid)

**Requirements completed:** BRIDGE-01..07, VIEW-07..08, REND-01..02, REND-05..06

---

## v0.5 Providers + Views (Shipped: 2026-02-28)

**Phases:** 4-6 | **Plans:** 14 | **Commits:** 55 | **LOC:** 20,468 TypeScript
**Timeline:** 1 day (2026-02-28)
**Git range:** `feat(04-02)` to `docs(phase-06)`
**Tests:** 774 passing (623 new since v0.1)

**Key accomplishments:**
1. Provider system (Filter, PAFV, Selection, Density) with SQL-safe allowlisted compilation and double-validation
2. MutationManager with command-pattern undo/redo, rAF batching, and inverse pre-ordering
3. QueryBuilder sole SQL assembly point + StateManager Tier 2 persistence with debounced save
4. Six D3 views (List, Grid, Kanban, Calendar, Timeline, Gallery) with stable key functions
5. KanbanView HTML5 drag-drop with undoable mutations (Cmd+Z)
6. Animated view transitions: SVG morph (list/grid/timeline) and crossfade (LATCH/GRAPH boundary)

**Requirements completed:** 31/31 milestone-scoped (PROV-01..11, MUT-01..07, VIEW-01..06, VIEW-09..12, REND-03..04, REND-07..08)

---

## v0.1 Data Foundation (Shipped: 2026-02-28)

**Phases:** 1-2 | **Plans:** 10 | **Commits:** 19 | **LOC:** 3,378 TypeScript
**Timeline:** 1 day (2026-02-27 to 2026-02-28)
**Git range:** `chore(01-01)` to `fix(02-06)`
**Tests:** 151 passing

**Key accomplishments:**
1. Custom sql.js WASM with FTS5 (Emscripten build, 756KB)
2. Canonical schema (cards, connections, cards_fts, ui_state) with three-trigger FTS sync
3. Card CRUD with soft delete, FTS-aware triggers, and shared type system (30 tests)
4. Connection CRUD with via_card_id, cascade delete, and bidirectional queries (23 tests)
5. FTS5 search with BM25 ranking, rowid joins, and highlighted snippets (21 tests)
6. Graph traversal with recursive CTEs, depth-limited, shortest path (19 tests)
7. Performance benchmarks verified on 10K cards / 50K connections — all 4 thresholds pass
8. Production build pipeline: Vite lib mode + WASM asset copy

**Requirements completed:** 25/25 milestone-scoped (DB-01..06, CARD-01..06, CONN-01..05, SRCH-01..04, PERF-01..04)

---

