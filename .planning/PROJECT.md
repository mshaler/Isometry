# Isometry v5

## What This Is

A local-first, polymorphic data projection platform where LATCH separates, GRAPH joins, and any axis maps to any plane. Ships as a native SwiftUI multiplatform app (iOS 17+ / macOS 14+) hosting the TypeScript/D3.js web runtime inside WKWebView, with sql.js as the in-memory database and system of record. Imports from 9 sources -- 6 file-based (Apple Notes JSON, Markdown, Excel, CSV, JSON, HTML) via TypeScript ETL pipeline plus 3 native macOS sources (Apple Notes, Reminders, Calendar) via Swift adapters reading system databases directly. Exports to 3 formats. Database persists across sessions via atomic checkpoint writes in Application Support, syncs across devices via CloudKit record-level sync (CKSyncEngine with offline queue, last-writer-wins conflict resolution, push notifications), and enforces Free/Pro/Workbench feature tiers via StoreKit 2. SuperGrid is a fully dynamic, interactive PAFV projection surface with N-level axis stacking, drag-and-drop axis transpose and reorder, collapsible headers (aggregate/hide modes with deepest-wins suppression), zoom/scroll navigation with virtual scrolling at 10K+ scale, column resize, lasso selection, 4-level density control, sort, filter, FTS5 search, smart time hierarchy, aggregation cards, and visual audit overlay (change tracking, source provenance, calculated field distinction). The Workbench shell features a centered wordmark menubar, an 8-section sidebar with 3-state toggles (hidden/visible/collapsed) and leaf-launcher sub-items, with the Visualization Explorer serving as the sole view-switch UI (Play/Stop auto-cycle button, crossfade transitions). It wraps SuperGrid in a vertical panel stack of collapsible explorers -- Properties (LATCH-grouped toggles with inline rename and depth control), Projection (4-well DnD chip assignment driving PAFVProvider), Visual (zoom rail slider), LATCH (histogram scrubbers with d3.brushX drag-to-filter range selection, category chips with GROUP BY COUNT badges, checkbox/time-preset/text-search filters wired to FilterProvider), Data Explorer (import/export, self-reflecting Catalog rendered through PAFV engine, DB Utilities with recent-cards viewer), and Notebook (undo-safe formatting toolbar, per-card Markdown persistence with auto-save, embedded D3 chart blocks reflecting live filtered data, DOMPurify-sanitized preview) -- all built with pure TypeScript + D3/DOM, zero new dependencies. SuperCalc adds SQL-driven aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) per group via parallel supergrid:calc Worker query, with CalcExplorer panel configuration. UX polish includes five design themes (light, dark, system, NeXTSTEP, Material 3) with CSS custom property palettes and instant mid-session switching, WCAG 2.1 AA accessibility (contrast-validated tokens, composite widget keyboard navigation, ARIA landmarks, screen reader announcements), Cmd+K command palette with fuzzy search and FTS5 card results, sample data for first-time exploration, contextual empty states for all 9 views, ErrorBanner with categorized recovery actions, and CI pipeline (GitHub Actions with typecheck + lint + test + bench).

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

- ✓ NativeImportAdapter protocol with AsyncStream batch yielding and 200-card chunked bridge dispatch — v4.0
- ✓ Apple Notes SQLite adapter: direct NoteStore.sqlite reads with gzip+protobuf body extraction and three-tier fallback — v4.0
- ✓ Reminders EventKit adapter: incomplete + 30-day completed with priority mapping, recurrence metadata, dedup — v4.0
- ✓ Calendar EventKit adapter: events with attendee person cards, recurring expansion, synthesized content — v4.0
- ✓ Native adapters output CanonicalCard[] JSON through WKWebView bridge to Worker handler (bypass ImportOrchestrator parse) — v4.0
- ✓ PermissionManager actor with TCC deep links and security-scoped bookmark caching — v4.0
- ✓ Schema version detection and branching for NoteStore.sqlite cross-OS-version compatibility — v4.0
- ✓ Protobuf body text extraction with three-tier fallback, attachment metadata, note-to-note link connections — v4.0
- ✓ normalizeNativeCard() fix for Swift JSONEncoder nil-skipping across all native adapters — v4.0

- ✓ N-Level Foundation: PAFVProvider depth limit removed, compound D3 keys with \x1f/\x1e separators, multi-level cell placement, asymmetric depth validation — v3.1
- ✓ Multi-level row header rendering: nested row headers at all levels with CSS Grid spanning, cascading sticky offsets, symmetric col/row behavior — v3.1
- ✓ Collapse system: independent expand/collapse at any level with aggregate (count badge + summary cells) and hide (zero footprint) modes, context menu mode switching, Tier 2 persistence — v3.1
- ✓ Drag reorder within dimension: reorderColAxes/reorderRowAxes with collapse key remapping, visual DnD UX with insertion line, source dimming, FLIP animation — v3.1
- ✓ Cross-session persistence validation: backward-compatibility matrix across 4 prior phase shapes, StateManager round-trip, deepest-wins aggregation suppression, aggregate proxy selection -- v3.1

- ✓ SuperAudit: Session-only change tracking (new/modified/deleted) across all 9 views with CSS audit overlay, source provenance color coding (9 import types), calculated field visual distinction, toggle button + legend panel -- v4.1
- ✓ Virtual scrolling: SuperGridVirtualizer data windowing with CSS content-visibility, 60fps at 10K+ rows, frozen headers, sentinel spacer -- v4.1
- ✓ CloudKit bidirectional sync: CKSyncEngine with custom record zone, JSONEncoder state serialization, offline queue, SyncMerger bridge protocol, last-writer-wins conflict resolution -- v4.1
- ✓ CloudKit push + poll: Remote push notification registration (macOS + iOS), foreground polling on scenePhase .active, SyncStatusPublisher toolbar icon -- v4.1
- ✓ CloudKit connection sync: Connections sync alongside cards with batch ordering for FK constraints, export-all for initial upload and encryptedDataReset recovery -- v4.1
- ✓ Database storage migration: iCloud ubiquity container to Application Support with reverse migration -- v4.1

- ✓ Build health: Biome 2.4.6 linter, tsc strict mode zero errors, Xcode Run Script fixed, GitHub Actions CI (3 parallel jobs), branch protection -- v4.2
- ✓ Empty states: Welcome panel with import CTAs, filtered-empty with Clear Filters, view-specific messages for all 9 views, density-aware SuperGrid empty state -- v4.2
- ✓ Keyboard shortcuts: ShortcutRegistry centralized handlers, Cmd+1-9 view switching, ? help overlay, macOS View menu with shortcuts -- v4.2
- ✓ Visual polish: CSS design token system (typography scale + derived colors), :focus-visible keyboard navigation, zero hardcoded inline styles across all views -- v4.2
- ✓ Stability: ErrorBanner with 5-category auto-classification and recovery actions, JSONParser unrecognized structure warning, ActionToast undo/redo feedback -- v4.2
- ✓ ETL validation: 100+ card fixtures for 9 sources, 81-combo source x view rendering matrix, dedup regression suite, DedupEngine connection dedup fix -- v4.2

- ✓ Excel ArrayBuffer web import path -- binary formats (.xlsx/.xls) read as ArrayBuffer instead of text -- v4.3
- ✓ Plain-key shortcut shiftKey bypass -- ? help overlay fires on real US keyboards (Shift+/) -- v4.3
- ✓ Undo/redo ActionToast wired into MutationManager via setToast() single wiring point -- v4.3
- ✓ Biome lint gate closure -- zero diagnostics across 190 files, fixed ParsedFile import path -- v4.3
- ✓ Planning doc reconciliation -- ROADMAP/PROJECT/STATE consistent with shipped state -- v4.3

- ✓ Three-way light/dark/system theming with CSS custom property palettes, ThemeProvider, SwiftUI shell sync -- v4.4
- ✓ WCAG 2.1 AA accessibility: contrast-validated tokens, MotionProvider, Announcer, skip-to-content, ARIA landmarks, composite widget keyboard navigation -- v4.4
- ✓ Command palette (Cmd+K) with fuzzy search, FTS5 card results, WAI-ARIA combobox, recent commands -- v4.4
- ✓ Sample data with 3 curated datasets, SampleDataManager, welcome panel split-button CTA, sync boundary guard -- v4.4
- ✓ WorkbenchShell vertical panel stack with CollapsibleSection primitive, CommandBar, ViewManager re-root -- v5.0
- ✓ PropertiesExplorer with LATCH-grouped columns, toggle checkboxes, inline rename via AliasProvider -- v5.0
- ✓ ProjectionExplorer with 4 wells, HTML5 DnD chip assignment, PAFVProvider aggregation extension -- v5.0
- ✓ VisualExplorer wrapping SuperGrid with vertical zoom rail slider bidirectionally synced to SuperPositionProvider -- v5.0
- ✓ LatchExplorers with 5 LATCH family sections, checkbox/time-preset/text-search filters wired to FilterProvider -- v5.0
- ✓ NotebookExplorer v1 with textarea + DOMPurify-sanitized Markdown preview, session-only persistence -- v5.0
- ✓ SuperGrid Spreadsheet UX: --sg-* design tokens, 7 semantic CSS classes, value-first plain text cells with +N badge, row index gutter, active cell focus ring with crosshair highlights -- v5.1
- ✓ SuperCalc: SQL DSL-based aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) per group via parallel supergrid:calc Worker query with GROUP BY, CalcExplorer Workbench panel, grand-total footer -- v5.2
- ✓ Notebook formatting toolbar: undo-safe Markdown formatting via contentEditable + execCommand, 8-button toolbar (bold/italic/heading/list/link/code/chart) -- v5.2
- ✓ Notebook persistence: per-card content via ui_state table (notebook:{cardId} key), 500ms debounced auto-save, flush-on-switch, CloudKit checkpoint flow -- v5.2
- ✓ D3 chart blocks in notebook: 4 chart types (bar/pie/line/scatter) via custom marked extension, two-pass DOMPurify + D3 mount, live filter subscription -- v5.2
- ✓ LATCH histogram scrubbers: D3 SVG mini bar charts with d3.brushX drag-to-filter, atomic setRangeFilter() on FilterProvider -- v5.2
- ✓ Category chips: interactive pill buttons with GROUP BY COUNT badges for categorical multi-select filtering -- v5.2
- ✓ SVG text CSS reset (letter-spacing: normal scoped to SVG text contexts) fixing chart/histogram rendering -- v5.3
- ✓ deleted_at null-safe connection queries with explicit IS NOT NULL guards -- v5.3
- ✓ SchemaProvider runtime PRAGMA table_info introspection with LATCH heuristic classification (name patterns + type affinity) -- v5.3
- ✓ All 15 hardcoded field lists replaced with dynamic SchemaProvider reads; AxisField/FilterField widened with (string & {}) trick -- v5.3
- ✓ StateManager field migration: unknown fields filtered before provider setState(); FilterProvider/PAFVProvider graceful degradation -- v5.3
- ✓ User-configurable LATCH family overrides: chip badge dropdown, disable/enable toggle, boot persistence via ui_state -- v5.3

- ✓ PerfTrace instrumentation utility with __PERF_INSTRUMENTATION__ compile-time gate, hooks across Worker Bridge, render path, and ETL pipeline -- v6.0
- ✓ Vitest bench files measuring SQL query, SuperGrid render, and ETL import throughput at 1K/5K/20K card scale -- v6.0
- ✓ Bundle analysis via rollup-plugin-visualizer with production build treemap -- v6.0
- ✓ PerfBudget.ts typed constants derived from measured Phase 74 data; failing budget tests as TDD red step -- v6.0
- ✓ 6 covering/expression indexes eliminating TEMP B-TREE for SuperGrid GROUP BY (folder, card_type, status, created_at, modified_at) -- v6.0
- ✓ Event delegation replacing 5000+ per-cell onclick closures; card_ids/card_names truncated to 50 per cell -- v6.0
- ✓ ETL batchSize=1000 at ~49K cards/s (1.9x uplift); FTS rebuild 10.5% of 20K import -- v6.0
- ✓ WKWebView warm-up in IsometryApp.task{} before ContentView.onAppear; 100ms debounced checkpoint autosave -- v6.0
- ✓ Heap RSS growth ~10% across 3 import-delete-reimport cycles; webViewWebContentProcessDidTerminate wired to checkpoint restore -- v6.0
- ✓ 4th GitHub Actions CI bench job with 11 budget assertions; .benchmarks/main.json baseline committed; promotion procedure documented -- v6.0

- ✓ realDb() in-memory sql.js factory + makeProviders() wired provider stack factory with real PRAGMA-derived SchemaProvider -- v6.1
- ✓ 9 filter types (eq/neq/in/range/axis/FTS/FTS+field/allowlist/soft-delete) tested against real sql.js -- v6.1
- ✓ PAFV-to-CellDatum shape verification (1/2-axis counts, __agg__ prefix regression guard, hideEmpty, sortOverrides) -- v6.1
- ✓ Coordinator-to-bridge re-query propagation with rapid-change batching and destroy teardown safety -- v6.1
- ✓ Density hideEmpty/viewMode regression guards confirmed GREEN on arrival -- v6.1
- ✓ ViewTabBar-to-PAFVProvider + HistogramScrubber-to-FilterProvider + CommandBar destroy seam tests -- v6.1
- ✓ ETL-to-FTS5 round-trip (trigger path + bulk rebuild at 502 cards + soft-delete exclusion) -- v6.1
- ✓ WorkbenchShell mount/destroy wiring + CalcExplorer lifecycle seam tests -- v6.1
- ✓ UI Polish: aggregation wiring, :has() → data-attribute pattern, AppDialog, roving tabindex keyboard nav, histogram error state, section state -- v6.1

- ✓ MutationManager.editCard with shadow-buffer undo safety for inline title/content editing -- v7.1
- ✓ Start-typing card creation: first keydown in empty card editor triggers addCard via MutationManager -- v7.1
- ✓ Typed property inputs for all 26 schema fields (date, number, tag tokenizer, dropdown) -- v7.1
- ✓ CSS-driven card dimension rendering in Notebook panel preview -- v7.1

- ✓ AltoIndexAdapter: 11 subdirectory types with YAML frontmatter parser and file-path source dedup -- v7.2
- ✓ ETL load test harness: 15-assertion integration test + 20K-card full-scale test -- v7.2
- ✓ Projection Explorer pointer DnD: chip drag between X/Y wells works in Chrome, Safari, WKWebView -- v7.2
- ✓ SuperGrid axis grip pointer DnD: same-dimension reorder + cross-dimension transpose via pointer events -- v7.2
- ✓ KanbanView card drag migrated to pointer events with ghost chip and drop zone highlighting -- v7.2
- ✓ DataExplorerPanel file import: native:request-file-import bridge handler + click-to-browse fallback -- v7.2
- ✓ Kanban horizontal column CSS layout (.kanban-board flex, .kanban-column sizing) -- v7.2

- ✓ CSS specificity fix for CollapsibleSection collapse (`:not()` guard + explicit `--has-explorer` override) -- v7.0
- ✓ Dataset eviction pipeline with SchemaProvider reintrospection, ProjectionExplorer axis clearing, zero-bleed switching -- v7.0
- ✓ Shell restructure: centered wordmark menubar, 8-section sidebar with 3-state toggle, leaf-launcher sub-items, GRAPH/Formula/InterfaceBuilder stubs -- v7.0
- ✓ ViewZipper: 9 view-type tabs with auto-cycle crossfade (v7.0) — replaced by SidebarNav Visualization Explorer in v8.4
- ✓ Data Explorer panel with Import/Export, self-reflecting Catalog (SuperGrid bound to datasets registry table), Apps, DB Utilities sections -- v7.0
- ✓ Datasets registry table auto-populated on import with CatalogWriter extension; active row CSS highlighting -- v7.0
- ✓ SuperGrid depth control: PropertiesExplorer depth dropdown wired into render path via setDepthGetter() setter injection -- v7.0
- ✓ SuperGrid row headers: full text with ellipsis overflow and drag-resizable width with localStorage persistence -- v7.0
- ✓ CommandBar dataset name subtitle with brief loading state on Command-K load -- v7.0
- ✓ DB Utilities recent-cards viewer with click-to-select, empty state, refreshDataExplorer() on all load paths -- v7.0
- ✓ Three named design themes (NeXTSTEP, Modern, Material 3) with distinct color palettes, typography, and border-radius tokens -- v7.0
- ✓ Five-option radiogroup theme picker in CommandBar with instant switching (no-transition flash guard) and StateManager persistence -- v7.0

- ✓ D3 Pivot Table from Figma: standalone two-layer grid renderer with pointer-event DnD config panel, run-length header spanning, --pv-* design tokens -- v8.0
- ✓ PluginRegistry: composable register/enable/disable with transitive dependency enforcement, 3-hook pipeline (transformData/transformLayout/afterRender) -- v8.0
- ✓ FeatureCatalog: 10 categories, 27 sub-features, NOOP_FACTORY sentinel with __isNoopStub brand for mechanical TDD enforcement -- v8.0
- ✓ HarnessShell: sidebar toggle tree with categorized checkboxes, data source selector, localStorage persistence -- v8.0
- ✓ SuperStack plugins: N-level header spanning, click-to-collapse with shared SuperStackState, SUM aggregate on collapsed groups -- v8.0
- ✓ SuperSize plugins: col-resize with shift+drag normalize/dblclick auto-fit, header-resize [24-120px], uniform scale [0.5-3.0] -- v8.0
- ✓ SuperZoom plugins: Ctrl+wheel zoom with Cmd+0 reset via shared ZoomState, slider synced via listeners pattern -- v8.0
- ✓ SuperSort plugins: header-click asc/desc/null cycle, chain sort with Shift+click (max 3 entries) -- v8.0
- ✓ SuperScroll plugins: virtual data windowing (SCROLL_BUFFER=2, VIRTUALIZATION_THRESHOLD=100), CSS sticky headers -- v8.0
- ✓ SuperCalc plugins: footer aggregate rows (SUM/AVG/COUNT/MIN/MAX) with per-column glyphs, config panel with shared aggFunctions Map -- v8.0

- ✓ Base plugin factories: grid cell rendering, header spanning, DnD config panel extracted into PluginHook lifecycle -- v8.1
- ✓ SuperStack catalog migration: collapse + aggregate plugins moved from HarnessShell closures to registerCatalog() with shared SuperStackState -- v8.1
- ✓ SuperDensity plugins: mode-switch toolbar (compact/normal/comfortable/spacious), mini-cards compact layout, count-badge display with shared DensityState -- v8.1
- ✓ SuperSearch plugins: debounced search input with client-side filtering, cell highlight with CSS class application, shared SearchState -- v8.1
- ✓ SuperSelect plugins: click selection (Cmd+click multi), lasso drag selection, keyboard range selection (Shift+arrow), shared SelectionState -- v8.1
- ✓ SuperAudit plugins: change tracking overlay (new/modified/deleted CSS classes), source provenance (colored left-border stripes by import source), shared AuditPluginState -- v8.1
- ✓ FeatureCatalog 27/27: all plugin categories fully implemented with zero stubs, registerCatalog() as single source of truth -- v8.1

- ✓ SuperCalc v2: NullMode/CountMode/ScopeMode types, AggResult structured return, per-column null handling UI, scope radio toggle for filter-aware aggregation -- v8.2
- ✓ Shared test infrastructure: makePluginHarness(), usePlugin() auto-destroy, mockContainerDimensions(), HarnessShell ?harness=1 entry point -- v8.3
- ✓ 27-plugin lifecycle coverage with PluginLifecycleCompleteness permanent guard -- v8.3
- ✓ Cross-plugin interaction matrix: full 27-plugin smoke, 7 pairwise coupling pairs, 2 triple combos, pipeline ordering, state isolation -- v8.3
- ✓ 10 Playwright E2E specs + 5 multi-plugin combo specs with screenshot baselines, CI hard gate -- v8.3
- ✓ 4 production bugs fixed via E2E testing: data-col-start, .pv-toolbar, onSort callback, SuperSortChain cleanup -- v8.3
- ✓ ViewZipper removed, SidebarNav Visualization Explorer consolidated as sole view-switch UI -- v8.4
- ✓ Auto-cycle Play/Stop button with screen reader announcements, crossfade unified across all 3 view-switch paths -- v8.4

- ✓ ETL E2E test infrastructure: bridge queryAll/exec API, importNativeCards/assertCatalogRow/resetDatabase helpers, WASM/jsdom boundary enforcement -- v8.5
- ✓ Alto-index E2E: 11 subdirectory types verified end-to-end with 500-card fixtures, dedup idempotency, FTS5 bulk rebuild -- v8.5
- ✓ Native Apple adapter E2E: Notes/Reminders/Calendar seam tests with CatalogWriter provenance, NoteStore multi-schema, protobuf fallback tiers -- v8.5
- ✓ File-based format E2E: 6 parsers through ImportOrchestrator, malformed input recovery, export round-trip, cross-format dedup -- v8.5
- ✓ TCC permission lifecycle E2E: grant/deny/revoke across 3 adapters via __mockPermission bridge hook -- v8.5

- ✓ graph_metrics sql.js table with 6 algorithm score columns, sanitizeAlgorithmResult NaN/Infinity guard, 4 typed Worker protocol messages -- v9.0
- ✓ Six graph algorithms (Dijkstra, betweenness centrality, Louvain community, clustering coefficient, Kruskal MST, PageRank) via graphology in Worker with √n sampling -- v9.0
- ✓ SchemaProvider graph metric injection as dynamic PAFV axes + SuperGridQuery LEFT JOIN + FilterProvider-scoped computation -- v9.0
- ✓ AlgorithmExplorer sidebar section with algorithm radio group, Run button, parameter controls (Louvain resolution, PageRank damping, centrality sampling) -- v9.0
- ✓ NetworkView full-replacement encoding: community schemeCategory10 fill, centrality scaleSqrt sizing, path/MST edge highlighting, legend panel -- v9.0
- ✓ Two-click source/target node picker for shortest path with keyboard-accessible dropdown fallback -- v9.0
- ✓ Multi-algorithm overlay (community color + metric size simultaneously), hover tooltip with exact numeric scores, stale indicator badge -- v9.0
- ✓ Graph algorithms E2E Playwright spec (4 tests) as CI hard gate -- v9.0
- ✓ Swift critical path tests: ProtobufToMarkdown Tier 1, SyncManager state persistence, NotesAdapter fixture DB -- v9.0

- ✓ Native directory picker (NSOpenPanel/fileImporter) with auto-discovery of 11 known alto-index subdirectory types -- v9.2
- ✓ DirectoryDiscoverySheet modal with Select All/Deselect All toggle, type badges, and per-directory import progress -- v9.2
- ✓ Per-directory dataset partitioning with source-tagged cards (alto_index_{dirName}) and binary attachment exclusion -- v9.2
- ✓ CatalogSuperGrid dataset lifecycle: action buttons per row (re-import ↺, delete ✕), AppDialog danger confirmation -- v9.2
- ✓ Two-phase re-import with DedupEngine dedup-without-write, DiffPreviewDialog (new/modified/deleted counts), and commit-on-confirm -- v9.2
- ✓ directoryPath threaded through Swift sendChunk → NativeBridge → WorkerBridge → CatalogWriter for seamless stored-path re-import -- v9.2
- ✓ refreshDataExplorer() wired after all import/delete/re-import commit operations -- v9.2

- ✓ SuperGrid FetchDataResult pattern — BridgeDataAdapter derives row/col combinations from query results, PivotGrid renders real sql.js data -- v9.3
- ✓ Two-state empty states in PivotTable (no-axes vs no-data) with error banner and Retry Query button -- v9.3
- ✓ SuperCalcFooter aggregate row styling with monospace alignment, tooltips, and row-header spacer pattern -- v9.3
- ✓ TimelineView contextual empty state for zero due_at cards, today-line dashed marker, swimlane background rects -- v9.3
- ✓ NetworkView + AlgorithmExplorer wiring verified — force simulation, edge filtering, algorithm controls all functional -- v9.3
- ✓ All 9 views render correctly through ViewManager with consistent empty state typography (--text-lg/--text-base) and cross-view switching -- v9.3

### Active

<!-- Current scope: v10.1 Time Hierarchies -->

- [ ] SQL strftime() time bucketing for SuperGrid GROUP BY (year/month/week/day)
- [ ] D3 d3.timeFormat() locale-aware labels replacing raw ISO timestamps
- [ ] NULL/"No Date" bucket for undated cards (sorted last, not hidden)
- [ ] Configurable granularity selector in density panel
- [ ] Projection vs membership filter separation for time fields
- [ ] Multi-field OR-semantics time filtering across all time columns
- [ ] Timeline view configurable time field with D3 scaleTime axis


### Out of Scope

- Conflict resolution UI for manual merge -- last-writer-wins is the shipping strategy (v4.1)
- UI state sync (Tier 2 settings) across devices -- device-local by design (D-005)
- Deep links (`isometry://view/network`) for direct navigation — future
- Share extension (share-to-Isometry) for clipping web content — future
- WidgetKit extension showing card count and recent imports — future
- Haptic feedback integration for drag-drop and import success — future
- Schema-on-read extras (EAV table) — deferred per D-008
- Designer Workbench / App Builder — Phase A shipped in v5.0; Phase B shipped in v5.2
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
- HyperFormula in v3.0 -- formula reference syntax for PAFV coordinates unsolved, ~500KB bundle (deferred to v3.1+)
- Full onboarding wizard -- power user tool, single welcome panel sufficient (v4.2)
- Sample/demo data at first launch -- shipped in v4.4 Phase 52
- Custom keyboard shortcut remapping -- ~15 actions, standard platform shortcuts sufficient (v4.2)
- Tooltip system -- SF Symbols + title attributes sufficient (v4.2)
- HyperFormula for SuperCalc -- permanently replaced by SQL DSL (GROUP BY via supergrid:calc Worker query, v5.2)
- Full command palette (Cmd+K) -- shipped in v4.4 Phase 51
- React/Tailwind/shadcn runtime dependencies for Workbench UI -- pure TypeScript + D3/DOM per spec
- Notebook formatting toolbar -- shipped in v5.2
- D3 chart block rendering in notebook -- shipped in v5.2
- Notebook persistence to IsometryDatabase -- shipped in v5.2
- LATCH Phase B subpanes (histogram scrubber, category chips) -- shipped in v5.2
- Secondary visualization in Visual Explorer -- SuperGrid only

## Current State

**Latest milestone shipped:** v9.3 View Wiring Fixes (shipped 2026-03-27)
**Total milestones shipped:** 32 (v0.1, v0.5, v1.0, v1.1, v2.0, v3.0, v3.1, v4.0, v4.1, v4.2, v4.3, v4.4, v5.0, v5.1, v5.2, v5.3, v6.0, v6.1, v7.0, v7.1, v7.2, v8.0, v8.1, v8.2, v8.3, v8.4, v8.5, v9.0, v9.1, v9.2, v9.3)
**Current milestone:** v10.0 Smart Defaults + Layout Presets

## Context

Shipped v9.3 View Wiring Fixes with ~124K TypeScript + ~12K Swift + ~7.6K CSS LOC, across 32 milestones and 129 phases.
Web runtime stack: TypeScript 5.9 (strict), sql.js 1.14 (custom FTS5 WASM 756KB), D3.js v7.9, Vite 7.3, Vitest 4.0, Biome 2.4.6, Playwright.
Native stack: Swift (iOS 17+ / macOS 14+), SwiftUI, WKWebView, WKURLSchemeHandler, StoreKit 2, SwiftProtobuf 1.28+, CKSyncEngine.
ETL dependencies: gray-matter (YAML frontmatter), PapaParse (CSV), xlsx/SheetJS (Excel, dynamic import).
Native ETL dependencies: EventKit (Reminders + Calendar), SQLite3 C API (Apple Notes), zlib (gzip decompression), SwiftProtobuf (protobuf deserialization).
Graph algorithm dependencies: graphology, graphology-metrics, graphology-communities-louvain, graphology-shortest-path, graphology-traversal (Worker-side only).
Workbench dependencies: marked (Markdown rendering), DOMPurify (XSS sanitization).
CI: GitHub Actions with 5 parallel jobs (typecheck, lint, test, bench, e2e) + branch protection on main.

v9.0 added six graph algorithms (Dijkstra, betweenness centrality, Louvain community detection, clustering coefficient, Kruskal MST, PageRank) powered by graphology inside the Worker, persisted to graph_metrics sql.js table, projected as dynamic PAFV axes via SchemaProvider injection, and visualized in NetworkView through full-replacement encoding (community color, centrality sizing, path/MST edge highlighting) with legend panel, two-click source/target picker, multi-algorithm overlay, hover tooltip, stale indicator badge, and Playwright E2E regression guard. Swift critical path tests covered ProtobufToMarkdown Tier 1, SyncManager state persistence, and NotesAdapter fixture DB. All 23 v9.0 requirements validated.

v9.2 added full lifecycle management for alto-index directory imports: native file picker picks a root directory, auto-discovery enumerates 11 known subdirectory types, DirectoryDiscoverySheet modal with checkbox selection creates per-directory dataset partitions with source-tagged cards and per-directory progress reporting. Dataset management in CatalogSuperGrid enables delete-by-dataset and two-phase re-import with diff preview (DedupEngine dedup-without-write → DiffPreviewDialog → commit-on-confirm). directoryPath threaded end-to-end through Swift sendChunk → NativeBridge → WorkerBridge → CatalogWriter for seamless stored-path re-import without re-opening picker. Binary attachment content explicitly excluded (metadata only). 13 requirements validated.

v8.5 closed the ETL E2E coverage gap: shared test infrastructure (bridge queryAll/exec, importNativeCards/assertCatalogRow/resetDatabase helpers, WASM/jsdom boundary enforcement), all 11 alto-index subdirectory types verified end-to-end, Notes/Reminders/Calendar native adapter seam tests with CatalogWriter provenance and protobuf fallback tiers, all 6 file-based parsers through ImportOrchestrator with malformed input recovery and export round-trip, and TCC permission lifecycle E2E (grant/deny/revoke × 3 adapters). 30 requirements validated.

v9.3 fixed broken view rendering across all 9 views. SuperGrid data path repaired via FetchDataResult pattern — BridgeDataAdapter now derives row/col combinations from query results instead of static generation, with two-state empty states (no-axes vs no-data) and error banner. SuperCalcFooter aggregate rows styled with monospace alignment and tooltips. TimelineView gained contextual empty state for zero due_at cards, today-line marker, and swimlane background rects. NetworkView + AlgorithmExplorer wiring verified functional without code changes. All 6 remaining views (List, Grid, Kanban, Calendar, Gallery, Tree) confirmed working through ViewManager with consistent empty state typography and cross-view switching tests. 18 requirements validated.

v8.4 consolidated view navigation by removing ViewZipper and making SidebarNav Visualization Explorer the sole view-switch UI. Added Play/Stop auto-cycle button with screen reader announcements. Crossfade unified across all 3 paths (sidebar, Cmd+1-9, command palette).

v8.3 hardened the plugin system with comprehensive testing: shared jsdom infrastructure (makePluginHarness, usePlugin auto-destroy, mockContainerDimensions), HarnessShell ?harness=1 entry point with window.__harness API, lifecycle coverage for all 27 plugins with permanent completeness guard, cross-plugin interaction matrix (smoke, 7 pairwise, 2 triple combos, ordering assertions, state isolation), and 15 Playwright E2E specs (10 per-category + 5 multi-plugin combos) with screenshot baselines wired into CI as hard gate. 4 production bugs found and fixed via E2E testing. 20 requirements validated.

v8.2 extended SuperCalc with NullMode/CountMode/ScopeMode types and structured AggResult return type. Per-column null handling UI controls and scope radio toggle for filter-aware vs full-dataset aggregation. 15 requirements validated.

v8.1 completed the FeatureCatalog by extracting base rendering into plugin factories, migrating SuperStack from HarnessShell closures to registerCatalog(), and implementing all remaining plugins (SuperDensity, SuperSearch, SuperSelect, SuperAudit). All 27 entries with zero stubs. 15 requirements validated.

v8.0 rebuilt SuperGrid from simplified Figma design using modular composable plugins. PluginRegistry with dependency enforcement, FeatureCatalog with 10 categories/27 sub-features, and 14 plugin factories shipped.

v7.2 retrofitted documentation for Alto Index import infrastructure (11 subdirectory types, YAML frontmatter parser, source dedup, ETL load test harness) and migrated all remaining HTML5 DnD surfaces to pointer events for WKWebView compatibility (SuperGrid axis grip reorder/transpose, KanbanView card drag, DataExplorerPanel file import). 20 requirements validated.

v7.1 wired the Notebook panel into MutationManager as a full card editor: inline title/content editing with shadow-buffer undo safety, start-typing card creation, typed property inputs for all 26 schema fields, and CSS-driven card dimension rendering.

v7.0 restructured the Workbench shell based on UAT feedback: fixed two cross-cutting regressions (chevron collapse CSS specificity, dataset bleed across views), reorganized the menubar and sidebar into a full 8-section navigation control with 3-state toggles, introduced ViewZipper for auto-cycling view transitions, added a self-reflecting Data Explorer Catalog that renders the internal dataset registry through the same PAFV engine, fixed SuperGrid display/depth/row-header issues, added DB Utilities for card creation verification, and shipped three full named design themes (NeXTSTEP, Modern, Material 3) with instant switching and persistence.

v6.1 hardened every critical data seam as quality gate for v7.0 entry: (1) realDb() + makeProviders() shared test infrastructure with real PRAGMA-derived SchemaProvider; (2) Filter-to-SQL seam tests covering 9 filter types against real sql.js; (3) PAFV-to-CellDatum shape verification with __agg__ regression guard; (4) coordinator-to-bridge re-query propagation with rapid-change batching; (5) UI control seams — ViewTabBar, HistogramScrubber, CommandBar destroy verification; (6) ETL-to-FTS5 round-trip with trigger and bulk rebuild paths; (7) WorkbenchShell/CalcExplorer lifecycle tests; (8) UI polish — aggregation wiring, data-attribute-over-has pattern, AppDialog, roving tabindex, histogram error state, section state. All 30 requirements validated.

v6.0 made the app ship-ready at 20K-card scale with profile-first methodology: PerfTrace instrumentation, 6 SQL covering indexes, event delegation, batchSize=1000, WKWebView warm-up, debounced checkpoint, heap stability, CI bench job. All 24 requirements validated.

v5.3 replaced all hardcoded schema assumptions with runtime PRAGMA introspection and added user-configurable LATCH family overrides. All 33 requirements validated.

v5.2 added SQL-driven SuperCalc, completed notebook with charts, shipped LATCH histogram scrubbers and category chips. All 18 requirements validated.

v5.1 made SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet. All 21 requirements validated.

v5.0 replaced flat view layout with Workbench shell. All 32 requirements validated.

v4.4 made the app fully accessible and discoverable. All 33 requirements validated.

The fundamental insight: LATCH (Location, Alphabet, Time, Category, Hierarchy) covers every way to *separate* information. GRAPH covers every way to *connect* it. PAFV (Planes, Axes, Facets, Values) maps any dimension to any screen coordinate.

Key specifications:
- `CLAUDE-v5.md` -- canonical architectural decisions (D-001 through D-010), all final
- `Isometry v5 SPEC.md` -- product vision, foundational concepts (LATCH, GRAPH, PAFV)
- `Modules/Core/Contracts.md` -- schema and type definitions
- `Modules/Core/WorkerBridge.md` -- canonical message protocol
- `Modules/DataExplorer.md` -- ETL spec (parsers, dedup, export, catalog)

Known technical debt:
- Schema loading uses conditional dynamic import (node:fs vs ?raw) -- works but adds code paths
- D3 `.transition()` on SVG transform crashes jsdom (parseSvg) -- direct `.attr()` used, transition only for opacity
- GalleryView uses pure HTML (no D3 data join) -- tiles rebuilt on render(); no incremental update
- @vitest/web-worker shares Worker module state between instances -- constrains test isolation
- Graph algorithms (PageRank, Louvain) deferred to future phase
- StoreKit 2 products need App Store Connect setup for production (works with .storekit sandbox locally)
- PLSH-01 adapted from 50x50 grid to 10x10 in jsdom (100x slower DOM ops) -- algorithmic guard preserved
- Note-to-note link URL format(s) not verified against actual user data -- multiple patterns supported
- Tables in Apple Notes render as [Table] placeholder -- CRDT-based MergableDataProto parsing deferred
- CSS content-visibility: auto requires Safari 18+ (iOS 18+) -- iOS 17 users get JS windowing fallback only
- FeatureGate bypassed in DEBUG builds (#if DEBUG return true) -- test tier gates before release
- audit-colors.ts retains hardcoded hex values (documented mapping to CSS custom properties)
- 9px sort badge and 8px chevron kept as literal px (below --text-xs 10px token scale)
- Test assertions check var(--token) strings directly (jsdom cannot resolve CSS custom properties)

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
- **Native Bridge protocol**: 6 message types -- LaunchPayload, checkpoint, mutated (with changeset), native:action, native:sync, native:export-all-cards. No per-mutation IPC.
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
| NativeImportAdapter AsyncStream protocol | Backpressure-aware batch yielding for all native adapters | Good -- v4.0 validated |
| 200-card chunked bridge dispatch | Prevents WKWebView process termination on large imports (5K stress test passed) | Good -- v4.0 validated |
| etl:import-native bypasses ImportOrchestrator | Pre-parsed cards skip parsing, use DedupEngine + SQLiteWriter directly | Good -- v4.0 validated |
| normalizeNativeCard() on TypeScript side | Swift JSONEncoder encodeIfPresent skips nil keys; normalize on receiver side | Good -- v4.0 validated |
| EventKit for Reminders + Calendar | Same API for iOS and macOS; no direct SQLite needed for EventKit sources | Good -- v4.0 validated |
| Raw SQLite3 C API for Notes (not GRDB) | Minimizes dependencies; copy-then-read for WAL-safe access | Good -- v4.0 validated |
| Schema version detection at runtime | NoteStore.sqlite column names vary by macOS version; no hardcoded assumptions | Good -- v4.0 validated |
| SwiftProtobuf 1.28+ hand-written conformance | protoc-gen-swift not installed; hand-written .pb.swift from stable schema | Good -- v4.0 validated |
| nonisolated struct pattern for SwiftProtobuf | Required for Sendable/Hashable under SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor | Good -- v4.0 validated |
| Three-tier body extraction fallback | Full Markdown / plain text + hashtags / ZSNIPPET -- maximizes extraction on partial failure | Good -- v4.0 validated |
| Colon-delimited source_id for note links | notelink:{sourceZID}:{targetZID} -- colons safe because ZIDs are UUIDs | Good -- v4.0 validated |
| Batch attachment metadata query | All ZTYPEUTI+ZFILENAME upfront vs per-note -- reduces SQLite round-trips | Good -- v4.0 validated |
| Link cards with source_url prefix convention | attendee-of: and note-link: prefixes trigger auto-connection creation on TS side | Good -- v4.0 validated |
| Compound key separators \x1f/\x1e | \x1f within dimension, \x1e between row/col -- matches SuperStackHeader parentPath | Good -- v3.1 validated |
| D-012: Plugin registry pattern | Each Super* is a PluginHook with transformData/transformLayout/afterRender hooks | ✓ Good — v8.0 validated (14 plugins) |
| D-013: Sub-feature granularity | 10 categories, 27 sub-features, independently toggleable | ✓ Good — v8.0 validated (FeatureCatalog) |
| D-014: Data source progression | mock → alto-index → sql.js via DataProvider interface | Decided ✓ |
| D-015: Two-layer grid rendering | Layer 1 invisible scroll sizing + Layer 2 floating overlay | ✓ Good — v8.0 validated |
| D-016: --pv-* CSS namespace | Pivot tokens separate from --sg-* supergrid tokens | ✓ Good — v8.0 validated |
| D-017: Pointer events only for DnD | No HTML5 DnD; ghost + elementsFromPoint hit-testing | ✓ Good — v8.0 validated |
| D-018: Feature harness extensible | Dev/test tool with production debug potential | Decided ✓ |
| D-019: Registry Completeness Suite | 6-assertion reusable pattern — permanent guard | ✓ Good — v8.0 validated |
| D-020: NOOP_FACTORY branded sentinel | __isNoopStub brand on factory function for mechanical TDD | ✓ Good — v8.0 validated |
| Shared state objects (ZoomState, SuperStackState) | Reference objects with listener arrays for cross-plugin sync | ✓ Good — v8.0 validated |
| SCROLL_BUFFER=2 for pivot | Pivot rows wider than supergrid — lighter buffer vs OVERSCAN=5 | ✓ Good — v8.0 validated |
| Chain sort max 3 entries | 3-click remove cycle (asc→desc→remove) distinct from single-sort | ✓ Good — v8.0 validated |
| keys.ts single source of truth | All SuperGrid key construction flows through one utility -- no inline separator literals | Good -- v3.1 validated |
| No-notify accessor for collapseState | Layout-only state (like colWidths) skips _scheduleNotify -- no Worker re-query | Good -- v3.1 validated |
| Aggregate-first collapse default | First click sets 'aggregate' mode (safer UX than hide-first) | Good -- v3.1 validated |
| reorderColAxes/reorderRowAxes non-destructive | Splice axes without resetting colWidths/sortOverrides/collapseState | Good -- v3.1 validated |
| Collapse key clear for 3+ axis reorder | Pragmatic -- parentPath encoding makes surgical remap error-prone at 3+ levels | Good -- v3.1 validated |
| FLIP animation via WAAPI | Web Animations API (200ms ease-out) -- SuperGrid uses DOM/CSS Grid, not SVG | Good -- v3.1 validated |
| Deepest-wins render-time only | suppressedCollapseKeys computed fresh each render, _collapsedSet never mutated | Good -- v3.1 validated |
| Aggregate injection iterates _collapsedSet | buildHeaderCells skips deeper-level cells when parent collapsed -- leaf iteration insufficient | Good -- v3.1 validated |
| AuditState as CSS overlay (not provider) | Audit toggle is pure CSS -- no Worker re-query needed | Good -- v4.1 validated |
| Data windowing (not DOM virtualization) | Virtualizer filters rows before D3 join, preserving data join ownership | Good -- v4.1 validated (60fps at 10K+) |
| CKSyncEngine replaces iCloud Documents | Dual sync causes silent data loss -- record-level sync is correct architecture | Good -- v4.1 validated |
| SyncManager on BridgeManager (not App) | Actors cannot be @StateObject; App structs are immutable | Good -- v4.1 validated |
| BatchSnapshot for CKSyncEngine closure | Swift 6 forbids actor-isolated state in synchronous closures | Good -- v4.1 validated |
| Unwrapped send pattern for SyncMerger | Capture bridge.send before mutation hook prevents sync echo loops | Good -- v4.1 validated |
| Server-wins conflict resolution | System fields archival + accept server record on conflict | Good -- v4.1 validated |
| Partition-based batch ordering | Cards before connections for FK constraint satisfaction -- O(n), stable | Good -- v4.1 validated |
| Biome 2.4.6 with 8 disabled rules | tsconfig strictness conflicts with Biome recommended rules | Good -- v4.2 validated |
| ShortcutRegistry single keydown listener | Eliminates duplicated input field guard logic across handlers | Good -- v4.2 validated |
| ViewSwitchReceiver ViewModifier | Prevents SwiftUI type-checker timeout from 9 onReceive handlers | Good -- v4.2 validated |
| CSS design token system | Typography scale + derived colors eliminate hardcoded inline values | Good -- v4.2 validated |
| ErrorBanner 5-category auto-classification | parse > database > network > import > unknown priority ordering | Good -- v4.2 validated |
| DedupEngine NULL via_card_id pre-check | SQLite UNIQUE ignores NULL; explicit pre-check prevents duplicates | Good -- v4.2 validated |
| 20-card subset for rendering matrix | Keeps 81-combo test suite fast while maintaining coverage | Good -- v4.2 validated |
| CustomEvent dispatch for import CTAs | Decouples ViewManager empty states from import infrastructure | Good -- v4.2 validated |
| GitHub Actions 3-job parallel CI | typecheck + lint (biomejs/setup-biome) + test run independently | Good -- v4.2 validated |
| Binary format detection by extension set | binaryFormats.has(ext) gates ArrayBuffer vs text read | Good -- v4.3 validated |
| Plain-key shortcuts skip shiftKey matching | Future-proofs for all shifted characters (?, !, @, #) | Good -- v4.3 validated |
| MutationManager.setToast() single wiring point | Replaces per-trigger toast logic with interface-based decoupling | Good -- v4.3 validated |
| Biome --write --unsafe for test file prefixes | Safe for test-only unused variables where side-effect matters | Good -- v4.3 validated |
| [data-theme] attribute (not CSS light-dark()) | iOS 17.0 compatibility -- light-dark() requires Safari 17.2 | Good -- v4.4 validated |
| Built-in fuzzy scorer (not fuse.js) | Word-boundary constraint prevents false positives on partial matches | Good -- v4.4 validated |
| Composite widget pattern for keyboard nav | Single tabindex=0 on container, arrow keys within -- standard WAI-ARIA | Good -- v4.4 validated |
| Announcer appended to document.body | Survives view lifecycle destroy/recreate cycles | Good -- v4.4 validated |
| SampleDataManager constructor injection | Datasets injected (not imported) for testability and wiring flexibility | Good -- v4.4 validated |
| Source='sample' convention | Enables surgical deletion and audit identification of demo data | Good -- v4.4 validated |
| IS NULL guard in exportAllCards SQL | NULL != 'sample' evaluates to NULL (falsy) in SQLite -- explicit guard needed | Good -- v4.4 validated |
| WorkbenchShell thin DOM orchestrator | Zero business logic -- only wires UI triggers to callbacks via config | Good -- v5.0 validated |
| Overlays migrated to document.body | Z-index stacking above shell flex layout for HelpOverlay, CommandPalette, toasts | Good -- v5.0 validated |
| AliasProvider standalone (not on PAFVProvider) | Aliases orthogonal to axis mapping state -- separate persistence lifecycle | Good -- v5.0 validated |
| Custom MIME text/x-projection-field for DnD | Prevents collision between ProjectionExplorer and SuperGrid/Kanban DnD | Good -- v5.0 validated |
| Single callback slot on SuperPositionProvider | Avoids 60fps pub/sub overhead for zoom sync | Good -- v5.0 validated |
| writing-mode: vertical-lr for zoom slider | Cross-browser vertical slider support (Safari 17+, Chrome, Firefox) | Good -- v5.0 validated |
| DOMPurify strict allowlist for notebook | Blocks script injection, event handlers, dangerous URIs in WKWebView | Good -- v5.0 validated |
| D3 selection.join for LATCH checkbox lists | Event delegation with single change handler on container | Good -- v5.0 validated |
| Active cell tracked as cellKey string | Direct dataset.key comparison for O(1) lookup | Good -- v5.1 validated |
| SQL DSL replaces HyperFormula permanently | GROUP BY aggregation via supergrid:calc Worker query -- no formula engine needed | Good -- v5.2 validated |
| ui_state for notebook persistence | Avoids schema migration and CloudKit merge complexity | Good -- v5.2 validated |
| Two-pass DOMPurify + D3 mount for chart blocks | Never add SVG to sanitizer allowlist | Good -- v5.2 validated |
| setRangeFilter() atomic replacement | Prevents compounding range filters on same field | Good -- v5.2 validated |
| execCommand('insertText') for undo-safe formatting | GitHub markdown-toolbar-element pattern preserves browser undo stack | Good -- v5.2 validated |
| db.prepare() for ALL parameterized SQL in Worker | db.exec()/db.run() silently ignore bind params -- critical correctness fix | Good -- v5.2 validated |
| ChipDatum with GROUP BY COUNT per field | Single SQL round-trip for chip data instead of N queries | Good -- v5.2 validated |
| CASE WHEN bin index for histograms | Parameterized MIN/MAX/width in single SQL query | Good -- v5.2 validated |
| Fill handle as real div (not pseudo-element) | Future drag interaction requires real DOM element | Good -- v5.1 validated |
| Crosshair column matching via UNIT_SEP splitting | Compound dimension keys need segment extraction for column identity | Good -- v5.1 validated |
| gutterOffset pattern (0 or 1) | Applied to all gridColumn calculations -- keeps header algorithm untouched | Good -- v5.1 validated |
| Inline positional styles remain inline | CSS = appearance, inline = layout (gridRow, gridColumn, sticky) | Good -- v5.1 validated |
| KnownAxisField/KnownFilterField + (string & {}) widening | Preserves literal unions for known fields while accepting dynamic schema fields | Good -- v5.3 validated |
| SchemaProvider setter injection (not constructor) | Avoids breaking existing instantiation sites across providers | Good -- v5.3 validated |
| Override-first accessor pattern | `_latchOverrides.get(c.name) ?? c.latchFamily` -- user always wins over heuristic | Good -- v5.3 validated |
| getAllAxisColumns includes disabled fields | PropertiesExplorer shows disabled fields greyed-out in place within LATCH column | Good -- v5.3 validated |
| _latchOverrides/_disabledFields survive initialize() | Override state independent of PRAGMA lifecycle -- persists through re-init | Good -- v5.3 validated |
| Boot restore after setLatchSchemaProvider | Overrides loaded from ui_state before provider creation ensures correct initial state | Good -- v5.3 validated |
| __PERF_INSTRUMENTATION__ Vite define guard | Tree-shaking eliminates all PerfTrace calls in production builds -- zero runtime cost | Good -- v6.0 validated |
| Vitest it() + performance.now() (not bench()) | vitest bench v4 forks pool returns empty samples in --run mode | Good -- v6.0 validated |
| Phase 74 as hard profiling gate | No optimization code ships until ranked bottleneck list with numeric evidence exists | Good -- v6.0 validated |
| PerfBudget.ts derived from measured data | Constants from Phase 74 BOTTLENECKS.md, not arbitrary guesses -- TDD red step | Good -- v6.0 validated |
| Composite covering index idx_cards_sg_folder_type | Eliminates TEMP B-TREE for folder+card_type GROUP BY | Good -- v6.0 validated |
| Event delegation on gridEl in mount() | Two handlers replace per-cell onclick closures (5000+ allocations eliminated) | Good -- v6.0 validated |
| batchSize=1000 default for SQLiteWriter | ~49K cards/s vs ~26K at 100 (1.9x speedup at 20K cards) | Good -- v6.0 validated |
| WKWebView warm-up in IsometryApp.task{} | Fires before ContentView.onAppear for first-paint latency reduction | Good -- v6.0 validated |
| 100ms trailing debounce on checkpoint save | Checkpoint at 20K cards costs ~714ms (base64 dominates); explicit calls remain un-debounced | Good -- v6.0 validated |
| CI bench job as continue-on-error soft gate | Promoted to enforced after 3 consecutive green runs on main | Good -- v6.0 validated |
| Relative baselines only in CI bench | Absolute ms thresholds banned due to ±30-40% runner variance | Good -- v6.0 validated |
| Anti-patching rule for seam tests | If a test fails, fix the app -- never weaken the assertion | Good -- v6.1 validated |
| realDb() factory over seed.ts | Lightweight in-memory DB from PRAGMA, not heavy seed fixtures | Good -- v6.1 validated |
| tests/seams/ domain subdirectory tree | filter/coordinator/ui/etl mirrors production module boundaries | Good -- v6.1 validated |
| jsdom+WASM coexistence via per-file annotation | @vitest-environment jsdom on files needing DOM; default node for sql.js | Good -- v6.1 validated |
| Bridge spy captures state at fire-time | Matches production pattern: coordinator callback reads provider state synchronously | Good -- v6.1 validated |
| 502-card bulk path threshold | >500 triggers FTS disable/rebuild; 502 = 501 loop + 1 unique for assertion | Good -- v6.1 validated |
| data-attribute-over-has pattern | dataset attributes for behavioral DOM queries; :has() CSS only for progressive enhancement | Good -- v6.1 validated |
| Roving tabindex for composite widgets | CommandBar ArrowDown/Up, ViewTabBar ArrowLeft/Right, single tabindex=0 per component | Good -- v6.1 validated |
| AppDialog via native \<dialog\> element | Built-in a11y + ::backdrop without extra markup; replaces all alert/confirm | Good -- v6.1 validated |
| flushMicrotasks for batched subscriber tests | await Promise.resolve() after PAFVProvider mutation for queueMicrotask notifications | Good -- v6.1 validated |
| :not(.collapsible-section--collapsed) CSS guard | Prevents :has() explorer rules from overriding collapsed max-height: 0 via source order | Good -- v7.0 validated |
| SidebarNav 3-state toggle (hidden/visible/collapsed) | Section headers toggle visibility; chevrons control content collapse independently | Good -- v7.0 validated |
| ViewZipper auto-cycle with crossfade | setInterval + CSS opacity transition; Play/Stop toggle in Visualization Explorer | Good -- v7.0 validated |
| Catalog as SuperGrid bound to datasets table | Self-reflecting — no bespoke picker widget; reuses existing PAFV view engine | Good -- v7.0 validated |
| Datasets registry table auto-populated on import | CatalogWriter extension hooks into import completion for zero-maintenance catalog | Good -- v7.0 validated |
| setDepthGetter() setter injection for SuperGrid | Avoids circular dependency; SuperGrid calls getter at render time | Good -- v7.0 validated |
| no-transition class for instant theme switch | Prevents flash of intermediate colors during theme attribute swap | Good -- v7.0 validated |
| sm.registerProvider('theme', theme) before restore | ThemeProvider joins StateManager persistence cycle for cross-reload theme memory | Good -- v7.0 validated |
| MutationManager.editCard shadow-buffer undo | Snapshot card content before edit; undo restores entire card atomically | Good -- v7.1 validated |
| Start-typing card creation without explicit "new card" button | First keydown in empty card editor creates card via MutationManager.addCard | Good -- v7.1 validated |
| Typed property inputs for all 26 schema fields | Date picker, number stepper, tag tokenizer, dropdown for enum fields | Good -- v7.1 validated |
| CSS card dimension rendering (not iframe/canvas) | Card preview as styled HTML div with CSS-driven layout | Good -- v7.1 validated |
| Pointer events over HTML5 DnD for all drag surfaces | WKWebView intercepts HTML5 dragstart; pointer events bypass native drag system | Good -- v7.2 validated |
| _lastReorderTargetIndex fallback for same-dimension reorder | Pointer rarely lands on 6px drop zone; midpoint index from pointermove is reliable | Good -- v7.2 validated |
| Drop zone pointer-events:none by default | Enable only during active drag; prevents z-index occlusion of header grips | Good -- v7.2 validated |
| 40px enlarged drop zones during active drag | 6px too small for reliable cross-dimension transpose targeting | Good -- v7.2 validated |
| native:request-file-import bridge handler | JS sends message; Swift posts .importFile notification to trigger native file picker | Good -- v7.2 validated |
| AggResult structured return (not number\|null) | Eliminates call-site type narrowing; warning field enables strict null handling UI | Good -- v8.2 validated |
| allRows on RenderContext (not CalcConfig) | Render-pipeline concern, not config — captured before hide-empty filter | Good -- v8.2 validated |
| getColConfig helper with lazy defaults | SUM/exclude/column defaults for missing col entries — no undefined checks at call sites | Good -- v8.2 validated |
| usePlugin bracket notation for registry._plugins | Test-only access avoids production API surface change | Good -- v8.3 validated |
| Early return harness branch in main.ts | URLSearchParams check + dynamic import tree-shakes harness from production bundle | Good -- v8.3 validated |
| LIFECYCLE_COVERAGE explicit Record (27 entries) | Deterministic coverage enforcement, mirrors FeatureCatalogCompleteness D-019 pattern | Good -- v8.3 validated |
| FEATURE_CATALOG.map() for expected ordering | Auto-updates if catalog order changes intentionally — no hard-coded string array | Good -- v8.3 validated |
| page.evaluate() + PointerEvent for overlay clicks | PivotGrid overlay pointer-events:none blocks Playwright .click() | Good -- v8.3 validated |
| Screenshot baselines force-committed with git add -f | e2e/.gitignore excludes screenshots/ but E2E-03 requires committed baselines | Good -- v8.3 validated |
| e2e CI job as 5th parallel hard gate | No needs:, no continue-on-error; browser cache keyed on Playwright version | Good -- v8.3 validated |
| ViewZipper removed, SidebarNav sole view-switch UI | Eliminates redundant horizontal tab strip; sidebar is persistent navigation | Good -- v8.4 validated |
| Play/Stop e.stopPropagation() in section header | Prevents header collapse when clicking play/stop button | Good -- v8.4 validated |
| ViewZipper replaced by SidebarNav | Previously v7.0 auto-cycle in ViewZipper → now Play/Stop button in Visualization Explorer section | Good -- v8.4 validated |

## Performance Contracts

All budgets are enforced in CI via `npm run bench:budgets`. The canonical source of truth is `src/profiling/PerfBudget.ts`. All thresholds are CI-relative — jsdom overhead is baked in (factor noted per category); Chrome estimates equal the CI budget divided by the jsdom overhead factor. The bench job is defined in `.github/workflows/ci.yml` under the `bench` job.

**Promotion procedure:** The bench job starts as a soft gate (`continue-on-error: true`). After 3 consecutive green runs on the `main` branch, promote it to a blocking gate by flipping `continue-on-error: true` to `false` in `.github/workflows/ci.yml`. There is no PR label or override mechanism — if benchmarks fail, fix the regression or update the budget constant in `PerfBudget.ts` with a comment justifying the new threshold.

### Render Budgets

Chrome 60fps frame budget = 16ms. jsdom overhead factor: 8x (single-axis), 15x conservative (dual-axis DOM-heavy).

| Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|------|-------------------|-----------|-------------|-----------------|
| Single axis, 20K cards | 37.8ms p99 jsdom | 128ms | ~16ms | `BUDGET_RENDER_JSDOM_MS` |
| Dual axis, 2500 cells (50×50) | 183ms mean jsdom | 240ms | ~18ms | `BUDGET_RENDER_DUAL_JSDOM_MS` |

### SQL Query Budgets

20K cards, p99 measurement.

| Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|------|-------------------|-----------|-------------|-----------------|
| GROUP BY folder, card_type | 24.93ms p99 | 12ms | ~1.5ms | `BUDGET_QUERY_GROUP_BY_20K_MS` |
| GROUP BY strftime month | 20.64ms p99 | 10ms | ~1ms | `BUDGET_QUERY_STRFTIME_20K_MS` |
| GROUP BY status | 1.87ms p99 | 5ms | ~0.2ms | `BUDGET_QUERY_STATUS_20K_MS` |
| FTS 3-word search | 1.70ms p99 | 5ms | ~0.2ms | `BUDGET_QUERY_FTS_20K_MS` |

### ETL Import Throughput

20K cards total elapsed.

| Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|------|-------------------|-----------|-------------|-----------------|
| All sources (shared budget) | json 1771ms worst-case | 1000ms | varies | `BUDGET_ETL_20K_MS` |

### Memory / Launch Baselines

These constants are defined in `PerfBudget.ts` but are **not enforced in CI**. They are device-only metrics — vitest values are reference baselines only, not CI-gated. Physical device measurement (WKWebView on-device) is required before treating these as hard gates.

| Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|------|-------------------|-----------|-------------|-----------------|
| Cold start | ~26ms vitest (WASM init + DB create + schema apply) | 3000ms device target | — | `BUDGET_LAUNCH_COLD_MS` |
| Heap steady-state | ~363MB RSS vitest at 20K cards | 150MB device target | — | `BUDGET_HEAP_STEADY_MB` |

---
*Last updated: 2026-03-29 — Milestone v10.1 Time Hierarchies started*
