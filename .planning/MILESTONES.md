# Milestones

## v4.1 Sync + Audit (Shipped: 2026-03-07)

**Phases:** 37-41 | **Plans:** 12 | **Tasks:** 24 | **Commits:** 20 | **LOC:** 23,535 TypeScript src + 37,554 tests + 7,166 Swift (total)
**Timeline:** 1 day (2026-03-06 to 2026-03-07)
**Git range:** `feat(37-01)` to `feat(41-02)`
**Files changed:** 87 (+12,430 / -266 lines)

**Key accomplishments:**
1. SuperAudit (Phase 37) -- AuditState session-only change tracking (new/modified/deleted) across all 9 views with source provenance color coding (9 import source pastels), calculated field visual distinction for SuperGrid aggregation cells, CSS audit overlay with toggle button (Shift+A), floating legend panel, and auto-wiring to import pipeline
2. Virtual Scrolling (Phase 38) -- SuperGridVirtualizer data windowing module filtering rows before D3 join (not DOM virtualization), CSS content-visibility progressive enhancement, sentinel spacer for accurate scrollbar, 60fps at 10K+ rows with O(1) getVisibleRange computation and bounded 15-30 row DOM count
3. CloudKit Architecture (Phase 39) -- Database migrated from iCloud ubiquity container to Application Support, CKSyncEngine actor with JSONEncoder state serialization, offline queue persisted as sync-queue.json, SyncMerger in NativeBridge.ts merging incoming records via INSERT OR REPLACE, enhanced mutated message carrying changesets
4. CloudKit Card Sync (Phase 40) -- Server-wins conflict resolution with system fields archival, foreground polling on scenePhase .active, remote push notification registration (macOS + iOS), SyncStatusPublisher ObservableObject with 3-state toolbar icon, unwrapped send pattern preventing sync echo loops, export-all-cards for initial upload and encryptedDataReset recovery
5. CloudKit Connection Sync (Phase 41) -- Fixed extractChangeset bugs (soft-delete as field update, create ops with Worker-generated result.id, connection field propagation), partition-based batch ordering for FK constraint satisfaction, export-all extended to include connections for complete data re-upload

**Requirements completed:** 23/23 (AUDIT-01..08, SYNC-01..10, VSCR-01..05)

---

## v3.1 SuperStack (Shipped: 2026-03-06)

**Phases:** 28-32 | **Plans:** 12 | **Tasks:** 22 | **Commits:** 89 | **LOC:** ~21,962 TypeScript src + ~36,656 tests (total)
**Timeline:** 2 days (2026-03-05 to 2026-03-06)
**Git range:** `feat(28-01)` to `feat(32-02)`
**Tests:** ~2,037 passing (~144 new since v3.0/v4.0)
**Files changed:** 23 source/test files (+9,847 / -4,281 lines)

**Key accomplishments:**
1. N-Level Foundation (Phase 28) -- Removed PAFVProvider 3-axis depth limit, created shared compound key utility (keys.ts) with \x1f/\x1e separator convention matching SuperStackHeader parentPath, validated N-level GROUP BY correctness with 8-test STAK-05 suite
2. Multi-Level Row Headers (Phase 29) -- N-level row header rendering with CSS Grid spanning, cascading sticky offsets (L0=0px, L1=80px, L2=160px), symmetric col/row header behavior, grip data-axis-index encoding
3. Collapse System (Phase 30) -- Independent expand/collapse at any level with aggregate (count badge + summary cells with heat-map) and hide (zero visual footprint) modes, context menu mode switching, Tier 2 persistence via PAFVProvider
4. Drag Reorder (Phase 31) -- Within-dimension level reorder via reorderColAxes/reorderRowAxes with collapse key remapping (level swap for 2-axis, clear for 3+), visual DnD UX with insertion line, source dimming, and FLIP animation (200ms WAAPI ease-out)
5. Polish and Performance (Phase 32) -- Backward-compatibility matrix across 4 prior phase shapes (pre-15/20/23/30), cross-session round-trip validation via StateManager, deepest-wins aggregation suppression preventing double-counting in multi-level collapse, aggregate proxy selection, 4 N-level render benchmarks

**Requirements completed:** 20 (STAK-01..05, RHDR-01..04, CLPS-01..06, DRAG-REORDER-BACKEND/VISUAL, PRST-ROUNDTRIP/COMPAT, DWIN-AGGREGATION, ASEL-COMPOUND, BNCH-RENDER)

---

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

