# Milestones

## v10.0 Smart Defaults + Layout Presets (Shipped: 2026-04-08)

**Phases completed:** 11 phases, 26 plans, 34 tasks

**Key accomplishments:**

- SubscriptionManager dot-segment tier fix, FeatureGate enforced-mode test coverage, StoreKit config validated, NotebookExplorer card creation flow fixed end-to-end
- Graph algorithm visualization extended with hop badge, d3.interpolateWarm distance coloring, edge betweenness stroke thickness, and weighted Dijkstra via numeric attribute picker
- PrivacyInfo.xcprivacy
- SyncErrorBanner with exponential backoff countdown, SyncError CKError mapping, Re-sync All Data settings, and 58 new Swift tests covering 8 CKSyncEngine scenarios plus EventKit adapter transforms (ratio 0.49:1)
- One-liner:
- Task 1: ProductionSuperGrid
- One-liner:
- Task 1: StateManager scoped/global registration, namespaced persist/restore, preset guard, migration
- `_isSwitching` flag with try/finally in ViewManager.switchTo() drops coordinator notifications during view transitions, preventing duplicate renders against a partially mounted view
- ViewDefaultsRegistry with 10 source-type entries + resolveDefaults using SchemaProvider.isValidColumn() wired into both import paths via PAFVProvider.applySourceDefaults()
- First-import flag gate (SGDF-06) + override detection + Reset to Defaults button in ProjectionExplorer footer (SGDF-05)
- ViewRecommendation registry with 5 source-type-to-view mappings and auto-switch wiring in both import paths, applying view-specific axis config (groupBy) after switchTo resolves via .then() callback
- Accent-colored ✦ recommendation badge in SidebarNav visualization items, updating dynamically on import and dataset switch via resolveRecommendation() from Plan 01's registry
- LayoutPresetManager with 4 built-in presets (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics), custom CRUD via ui_state bridge, and Record<storageKey, boolean> serialization
- One-liner:
- One-liner:
- One-liner:
- TourPromptToast + main.ts wiring: PAFVProvider axis substitution, tour:completed:v1 persistence, "Restart Tour" command in new Help category, and first-import opt-in toast gated by dual ui_state flags.
- All 20 dataset types verified — auto-switch, axis defaults, recommendation badges correct. Two critical native-app bugs fixed: Excel base64 import and double-undo.
- 1. [Rule 1 - Bug] Fixed double-apply in presetCommands.ts
- One-liner:
- SuperGrid CSS reconnected to design tokens; zoom wired via --sg-zoom CSS cascade from VisualExplorer; density 1x/2x/5x levels apply row height and padding via [data-dimension] rules
- One-liner:
- One-liner:
- One-liner:

---

## v9.3 View Wiring Fixes (Shipped: 2026-03-27)

**Phases:** 127-129 | **Plans:** 6 | **Requirements:** 18/18 (SGRD/TMLN/NETW/VIEW/CVUX)
**Timeline:** 2026-03-26 → 2026-03-27 (2 days)

**Key accomplishments:**

1. Fixed SuperGrid data path — FetchDataResult pattern derives row/col combinations from query results, PivotGrid renders real sql.js data through BridgeDataAdapter
2. Two-state empty states in PivotTable (no-axes vs no-data) with error banner and Retry Query button
3. SuperCalcFooter aggregate row styling with monospace alignment, tooltips, and row-header spacer pattern
4. TimelineView contextual empty state for zero due_at cards, today-line dashed marker, and swimlane background rects
5. Verified NetworkView + AlgorithmExplorer wiring — force simulation, edge filtering, algorithm controls all functional without code changes
6. Confirmed all 9 views render correctly through ViewManager with consistent empty state typography (--text-lg/--text-base) and cross-view switching tests

**Tech debt:** PivotTable empty state typography diverges from views.css contract (low), CVUX-01 test covers 6/9 views (info)

---

## v9.2 Alto Index Import (Shipped: 2026-03-26)

**Phases completed:** 7 phases, 15 plans, 12 tasks

**Key accomplishments:**

- (none recorded)

---

## v9.0 Graph Algorithms (Shipped: 2026-03-25)

**Phases:** 114-119 | **Plans:** 13 | **Requirements:** 23/23 (GFND/ALGO/PAFV/NETV/CTRL/SWFT)
**Timeline:** 2026-03-22 → 2026-03-25

**Key accomplishments:**

1. graph_metrics sql.js table with 6 algorithm score columns, sanitizeAlgorithmResult NaN/Infinity guard, 4 typed Worker protocol messages
2. All 6 graph algorithms (Dijkstra, betweenness centrality, Louvain, clustering coefficient, Kruskal MST, PageRank) via graphology in Worker with √n sampling at >2000 nodes
3. SchemaProvider graph metric injection as dynamic PAFV axes + SuperGridQuery LEFT JOIN + FilterProvider-scoped computation
4. AlgorithmExplorer sidebar section with radio group, Run button, Louvain resolution slider, PageRank damping factor, centrality sampling threshold
5. NetworkView full-replacement encoding: community schemeCategory10 fill, centrality scaleSqrt sizing, path/MST edge highlighting, two-click source/target picker with dropdown fallback
6. Multi-algorithm overlay (community color + metric size), hover tooltip with exact scores, stale indicator badge, combined legend, Playwright E2E regression guard
7. Swift critical path tests: ProtobufToMarkdown Tier 1, SyncManager state persistence, NotesAdapter fixture DB tests

---

## v8.5 ETL E2E Test Suite (Shipped: 2026-03-25)

**Phases:** 109-113 | **Plans:** 12 | **Requirements:** INFR/ALTO/NATV/FILE/TCC (30 reqs)
**Timeline:** 2026-03-22 → 2026-03-24

**Key accomplishments:**

1. ETL E2E helper library (importNativeCards, assertCatalogRow, resetDatabase) + queryAll/exec bridge API for Playwright SQL introspection
2. All 11 alto-index subdirectory types verified end-to-end with 500-card fixtures, dedup idempotency, and FTS5 bulk rebuild
3. Notes/Reminders/Calendar native adapter seam tests with CatalogWriter provenance, NoteStore multi-schema branching, and protobuf fallback tiers
4. All 6 file-based parsers verified through ImportOrchestrator with malformed input recovery, export round-trip fidelity, and cross-format dedup collision detection
5. TCC permission lifecycle E2E (9 test cases) covering grant/deny/revoke across all 3 native adapters via __mockPermission bridge hook

---

## v8.4 Consolidate View Navigation (Shipped: 2026-03-22)

**Phases:** 108 | **Plans:** 2 | **Tasks:** 9
**Timeline:** 2026-03-21 → 2026-03-22

**Key accomplishments:**

1. Deleted ViewZipper horizontal tab strip — SidebarNav Visualization Explorer is now the sole view-switch UI
2. Unified crossfade transition across all 3 view-switch paths (sidebar click, Cmd+1-9, command palette)
3. Added Play/Stop auto-cycle button to Visualization Explorer header with screen reader announcements
4. Visualization Explorer defaults to expanded, eliminating one click to discover views

---

## v8.3 Plugin E2E Test Suite (Shipped: 2026-03-22)

**Phases:** 104-107 | **Plans:** 8 | **Requirements:** 20/20
**Timeline:** 2026-03-22

**Key accomplishments:**

1. Shared test infrastructure — makePluginHarness(), usePlugin() auto-destroy, mockContainerDimensions(), HarnessShell ?harness=1 entry point with window.__harness API
2. 27-plugin lifecycle coverage — All plugins verified through transformData/transformLayout/afterRender/destroy hooks with PluginLifecycleCompleteness permanent guard
3. Cross-plugin interaction matrix — Full 27-plugin smoke test, 7 pairwise coupling pairs, 2 triple combos, pipeline ordering assertions from FEATURE_CATALOG.map(), shared-state isolation proofs
4. 10 Playwright E2E specs — Per-category sidebar toggle DOM assertions + 5 multi-plugin combo specs with 7 screenshot baselines, wired into CI as 5th parallel hard gate
5. 4 production bugs fixed — missing data-col-start on leaf headers, missing .pv-toolbar container, SuperSort onSort callback, SuperSortChain cleanup guard

---

## v8.2 SuperCalc v2 (Shipped: 2026-03-22)

**Phases:** 103 | **Plans:** 2 | **Requirements:** SC2-01..SC2-15 (15/15)
**Timeline:** 2026-03-21 → 2026-03-22

**Key accomplishments:**

1. NullMode/CountMode/ScopeMode type system with structured AggResult return type (value + optional warning)
2. computeAggregate with null handling modes: exclude (backward compat), zero (substitution), strict (warning on incomplete data)
3. Scope radio toggle for filter-aware (view) vs full-dataset (all) aggregation via RenderContext.allRows
4. Per-column UI controls: null mode select (hidden for NONE), count mode select (shown only for COUNT)

---

## v8.1 Plugin Registry Complete (Shipped: 2026-03-22)

**Phases completed:** 2 phases, 6 plans, 2 tasks

**Key accomplishments:**

- (none recorded)

---

## v8.0 SuperGrid Redesign (Shipped: 2026-03-21)

**Phases:** 97-100 | **Plans:** 7 | **LOC:** ~46.7K TS src + ~68.3K TS tests + ~6.0K CSS + ~7.3K Swift (total)
**Timeline:** 2 days (2026-03-20 → 2026-03-21)
**Git range:** `feat(phase-97)` to `docs(phase-100)`
**Files changed:** 51 (+9,596 / -15)

**Key accomplishments:**

1. D3 Pivot Table from Figma (Phase 97) — Standalone D3.js two-layer grid renderer with pointer-event DnD config panel (4 zones: Available/Rows/Columns/Z), run-length header spanning with parent-boundary awareness, --pv-* design tokens, transpose/hide-empty toggles (2,953 LOC, 36 tests)
2. PluginRegistry + Feature Harness (Phase 98) — Composable PluginRegistry with register/enable/disable and transitive dependency enforcement, 3-hook pipeline (transformData/transformLayout/afterRender), FeatureCatalog with 10 categories and 27 sub-features, HarnessShell with sidebar toggle tree and data source selector (1,866 LOC, 18 tests)
3. SuperStack Plugins (Phase 99) — N-level header spanning via afterRender DOM replacement, click-to-collapse with shared SuperStackState, SUM aggregate on collapsed groups, pointer event routing via runOnPointerEvent one-time wiring (3 plugin factories, 108 tests)
4. Plugin Registry Wave 1 (Phase 100) — 11 plugin factories: SuperSize (col-resize with shift+drag normalize, header-resize, uniform scale), SuperZoom (wheel zoom with shared ZoomState, slider synced via listeners), SuperSort (header-click asc/desc/null cycle, chain sort max 3), SuperScroll (virtual data windowing with sentinel spacers, sticky headers), SuperCalc (footer aggregates with ∑/x̄/#/↓/↑ glyphs, config panel). All wired into FeatureCatalog, stub count 26→15 (199 total pivot tests)

---

## v7.2 Alto Index + DnD Migration (Shipped: 2026-03-21)

**Phases completed:** 5 phases, 7 plans, 4 tasks

**Timeline:** 2 days (2026-03-19 → 2026-03-20)
**LOC:** ~43.9K TS src + ~65.8K TS tests + ~5.9K CSS + ~8.1K Swift (total)

**Key accomplishments:**

1. Alto Index import adapter for 11 subdirectory types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos) with YAML frontmatter parser and file-path source dedup
2. ETL load test harness with 15-assertion integration test + 20K-card full-scale test validating SuperGrid GROUP BY, aggregates, FTS, dedup, and catalog
3. Projection Explorer pointer DnD — chip drag between X/Y wells works in Chrome, Safari, and WKWebView with ghost element and hit-test highlighting
4. SuperGrid axis grip pointer DnD — same-dimension reorder via _lastReorderTargetIndex fallback, cross-dimension transpose with 40px enlarged drop zones, pointer-events toggle to prevent z-index occlusion
5. KanbanView card drag migrated to pointer events with ghost chip and drop zone highlighting
6. Native file import bridge — BridgeManager.swift handles native:request-file-import + Kanban horizontal column CSS layout

---

## v7.0 Design Workbench (Shipped: 2026-03-18)

**Phases:** 85-90 | **Plans:** 17 | **LOC:** ~39.4K TS src + ~62.4K TS tests + ~4.2K CSS + ~7.6K Swift (total)
**Timeline:** 2 days (2026-03-17 → 2026-03-18)
**Git range:** `fix(85-01)` to `fix(90-03)`

**Key accomplishments:**

1. Bug Fixes (Phase 85) -- Fixed CSS specificity where `:has()` explorer rules overrode collapsed `max-height: 0`; dataset eviction pipeline with SchemaProvider reintrospection and ProjectionExplorer axis clearing for zero-bleed dataset switching
2. Shell Restructure (Phase 86) -- Centered "Isometry" wordmark in menubar, enlarged settings icon; 8-section sidebar with 3-state toggle (hidden/visible/collapsed), sub-items as leaf launchers with active state highlighting, GRAPH/Formula/Interface Builder stubs
3. ViewZipper (Phase 87) -- ViewSwitcher relocated from menubar to Visualization Explorer as ViewZipper; 9 view-type tabs with active state, Play/Stop auto-cycle with crossfade transitions (~2s hold per view)
4. Data Explorer + Catalog (Phase 88) -- Internal datasets registry table auto-populated on import; Catalog rendered as SuperGrid bound to datasets table (self-reflecting PAFV engine); dataset selection triggers eviction path; active row CSS highlighting
5. SuperGrid Fixes (Phase 89) -- Property Depth control wired to re-render at selected depth; row headers with full text ellipsis overflow and drag-resizable width with persistence; CommandBar dataset name subtitle with loading state
6. Design Themes (Phase 90) -- Three named themes (NeXTSTEP, Modern, Material 3) with distinct palettes and typography; unified 5-option radiogroup picker; instant switching with no-transition flash guard; theme persistence via StateManager

---

## v6.1 Test Harness (Shipped: 2026-03-17)

**Phases:** 79-84 | **Plans:** 14 | **LOC:** ~36.9K TS src + ~61K TS tests + ~3.4K CSS + ~7.4K Swift (total)
**Timeline:** 2 days (2026-03-15 → 2026-03-17)
**Git range:** `feat(79-01)` to `docs(phase-83)`
**Files changed:** 57 (+6,169 / -199)
**Requirements completed:** 30/30 (INFR-01..03, SCRP-01, FSQL-01..05, CELL-01..04, CORD-01..03, DENS-01..02, VTAB-01..02, HIST-01..02, CMDB-01..02, EFTS-01..02, WBSH-01..02, CALC-01..02, WA1..WA6)
**New test infrastructure:** 14 files, 2,767 LOC of seam + harness tests

**Key accomplishments:**

1. Test Infrastructure (Phase 79) -- `realDb()` in-memory sql.js factory + `makeProviders()` wired provider stack factory with real PRAGMA-derived SchemaProvider; `seedCards()`/`seedConnections()` helpers; smoke tests; `test:seams` and `test:harness` npm scripts
2. Filter + PAFV Seams (Phase 80) -- 9 filter types (eq/neq/in/range/axis/FTS/FTS+field/allowlist/soft-delete) tested against real sql.js; PAFV-to-CellDatum shape verification (1/2-axis counts, `__agg__` prefix regression guard, hideEmpty, sortOverrides)
3. Coordinator + Density Seams (Phase 81) -- Coordinator-to-bridge re-query propagation with spy capture at fire-time; rapid-change batching into exactly one re-query; destroy teardown safety; density hideEmpty/viewMode regression guards (all GREEN on arrival)
4. UI Control Seams A (Phase 82) -- ViewTabBar-to-PAFVProvider viewType wiring + LATCH-GRAPH axis round-trip; HistogramScrubber-to-FilterProvider setRangeFilter contract; CommandBar Cmd+F/K/Escape + ShortcutRegistry destroy teardown verification; jsdom+WASM coexistence via per-file @vitest-environment annotation
5. UI Control Seams B (Phase 83) -- ETL-to-FTS5 round-trip (SQLiteWriter trigger path + bulk rebuild path at 502 cards); soft-delete exclusion from FTS; WorkbenchShell mount/destroy wiring; CalcExplorer lifecycle with numeric/text field discrimination
6. UI Polish (Phase 84) -- Aggregation mode + displayField wired into superGridQuery; :has() replaced with data-attribute-over-has pattern; native alert/confirm replaced with AppDialog (<dialog>); roving tabindex keyboard nav for CommandBar + ViewTabBar; HistogramScrubber inline error with Retry; WorkbenchShell explicit section state (loading/ready/empty)

---

## v6.0 Performance (Shipped: 2026-03-13)

**Phases:** 74-78 | **Plans:** 13 | **LOC:** ~36.5K TS src + ~57.4K TS tests + ~3.3K CSS + ~7.4K Swift (total)
**Timeline:** 2 days (2026-03-11 → 2026-03-13)
**Git range:** `feat(74-01)` to `feat(78-02)`
**Files changed:** 87 (+10,105 / -401)
**Requirements completed:** 24/24 (PROF-01..07, RNDR-01..05, IMPT-01..03, LNCH-01..02, MMRY-01..03, RGRD-01..04)

**Key accomplishments:**

1. Baseline Profiling + Instrumentation (Phase 74) -- PerfTrace utility with `__PERF_INSTRUMENTATION__` compile-time gate for zero-cost production builds; hooks across Worker Bridge (wb:query), render path (sg:fetchAndRender), and ETL pipeline (etl:write:batch); Vitest bench files at 1K/5K/20K scale; bundle analysis via rollup-plugin-visualizer; ranked BOTTLENECKS.md with numeric evidence gating all optimization work
2. Performance Budgets + Benchmark Skeleton (Phase 75) -- PerfBudget.ts typed constants derived exclusively from Phase 74 measured data (not arbitrary guesses); failing budget tests as TDD red step for Phases 76/77; .benchmarks/main.json baseline committed for CI regression comparison
3. Render Optimization (Phase 76) -- 6 covering/expression indexes eliminating TEMP B-TREE for SuperGrid GROUP BY; event delegation replacing 5000+ per-cell onclick closures; card_ids/card_names truncated to 50 per cell; VIRTUALIZATION_THRESHOLD=100 and OVERSCAN_ROWS=5 validated; dual-axis 2500-cell budget met at 240ms jsdom (~18ms Chrome)
4. Import + Launch + Memory Optimization (Phase 77) -- batchSize=1000 at ~49K cards/s (1.9x over batchSize=100); FTS rebuild at 10.5% of 20K import; WKWebView warm-up in IsometryApp.task{} before ContentView.onAppear; 100ms debounced checkpoint autosave; heap RSS growth ~10% across 3 import-delete-reimport cycles
5. Regression Guard + CI Integration (Phase 78) -- 4th GitHub Actions job running npm run bench:budgets with 11 assertions; continue-on-error soft gate with documented promotion procedure (3 consecutive green → enforced); Performance Contracts section in PROJECT.md with locked table format for all 4 budget categories

---

## v5.3 Dynamic Schema (Shipped: 2026-03-11)

**Phases:** 69-73 | **Plans:** 12 | **LOC:** ~36K TS src + ~55K TS tests + ~3.2K CSS + ~7.4K Swift (total)
**Timeline:** 1 day (2026-03-11)
**Git range:** `feat(69-01)` to `docs(73-03)`
**Files changed:** 74 (+10,012 / -300)
**Requirements completed:** 33/33 (BUGF-01..04, SCHM-01..07, DYNM-01..13, PRST-01..04, UCFG-01..05)

**Key accomplishments:**

1. Bug Fixes (Phase 69) -- SVG text CSS reset (`letter-spacing: normal` scoped to SVG text contexts) fixing D3 chart/histogram rendering across Safari/Chrome/Firefox; deleted_at null-safe connection queries with explicit IS NOT NULL guards
2. SchemaProvider Core (Phase 70) -- Runtime PRAGMA table_info(cards) introspection at Worker init with LATCH heuristic classification (name patterns + SQLite type affinity), typed ColumnInfo accessors, subscribe/notify with queueMicrotask batching, Worker-side validation Set for SQL injection prevention
3. Dynamic Schema Integration (Phase 71) -- Replaced all 15 hardcoded field lists across 8 files with SchemaProvider reads; KnownAxisField/KnownFilterField preserve literal unions while AxisField/FilterField widened with `(string & {})` trick; PropertiesExplorer, ProjectionExplorer, CalcExplorer, LatchExplorers, SuperGrid, SuperGridQuery all read from SchemaProvider
4. State Persistence Migration (Phase 72) -- StateManager.restore() filters unknown fields before provider setState(); FilterProvider/PAFVProvider gracefully degrade (remove invalid filters/axes instead of resetting all); AliasProvider orphan preservation (aliases survive schema changes)
5. User-Configurable LATCH Mappings (Phase 73) -- SchemaProvider override layer (`_latchOverrides` Map, `_disabledFields` Set) with override-first accessor pattern; PropertiesExplorer LATCH chip badge dropdown for family reassignment; disable/enable toggle with FilterProvider cleanup; boot-time persistence restore from ui_state; LatchExplorers remount + ProjectionExplorer update on schema change

---

## v5.2 SuperCalc + Workbench Phase B (Shipped: 2026-03-10)

**Phases:** 62-68 | **Plans:** 13 | **Tasks:** 24 | **Commits:** 70 | **LOC:** ~90.9K TypeScript + 7.4K Swift + 3.9K CSS (total)
**Timeline:** 2 days (2026-03-09 to 2026-03-10)
**Git range:** `feat(62-01)` to `test(66)`
**Tests:** 3,158 passing

**Key accomplishments:**

1. SuperCalc Footer Rows (Phase 62) -- SQL-driven aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) per group via parallel `supergrid:calc` Worker query with GROUP BY, configurable CalcExplorer Workbench panel, grand-total footer with sigma label, text column safety net downgrading invalid modes to COUNT
2. Notebook Formatting Toolbar (Phase 63) -- Undo-safe Markdown formatting using contentEditable + execCommand trick (GitHub markdown-toolbar-element pattern), 8-button toolbar (bold/italic/heading-cycle/bullet/numbered/link/code/chart), visible only in Write mode
3. Notebook Persistence (Phase 64) -- Per-card notebook content binding via SelectionProvider subscription, 500ms debounced auto-save to ui_state (`notebook:{cardId}` key convention), flush-on-switch guard against stale async responses, survives reload via CloudKit checkpoint flow
4. D3 Chart Blocks (Phase 65) -- 4 chart types (bar/pie/line/scatter) embedded in Markdown preview via custom marked extension, two-pass DOMPurify + D3 mount rendering, live filter subscription with 300ms debounced re-query, stale query generation guard, hover tooltips
5. LATCH Histogram Scrubbers (Phase 66) -- D3 SVG mini bar charts with d3.brushX drag-to-filter range selection, atomic setRangeFilter() on FilterProvider (Map-based O(1) replacement), CASE WHEN bin index SQL for single round-trip histogram computation, 3 date + 2 numeric histograms in LATCH explorer
6. Category Chips (Phase 67) -- Interactive chip pill buttons replacing checkbox lists for categorical fields (cardinality <20), GROUP BY COUNT query for single-round-trip count badges, D3 button.latch-chip join with enter/update/exit lifecycle
7. E2E Critical-Path Tests Tier 3 (Phase 68) -- 4 Playwright specs covering remaining critical flows (view-switch card count, projection axis reconfiguration, notebook binding round-trip, compound filter conjunction), critical sql.js bind param fix (db.prepare() for all parameterized SQL in Worker context)

**Requirements completed:** 18/18 (CALC-01..06, NOTE-01..08, LTPB-01..04)

---

## v5.1 SuperGrid Spreadsheet UX (Shipped: 2026-03-09)

**Phases:** 58-61 | **Plans:** 7 | **LOC:** 30,762 TS + 7,312 Swift + 2,848 CSS (total)
**Timeline:** 1 day (2026-03-08 to 2026-03-09)

**Key accomplishments:**

1. CSS Visual Baseline (Phase 58) -- --sg-* design token family (9 structural tokens), 7 semantic CSS classes (sg-cell, sg-header, sg-selected, sg-row--alt, sg-numeric, sg-row-index, sg-corner-cell), mode-scoped CSS overrides via [data-view-mode]
2. Value-First Rendering (Phase 59) -- Plain text cell rendering with +N overflow badge and hover tooltip, CSS appearance vs inline layout separation
3. Row Index Gutter (Phase 60) -- 28px gutter column with sequential row numbers, sticky corner cell (z-index 4), gutterOffset pattern (0 or 1) applied to all gridColumn calculations
4. Active Cell Focus (Phase 61) -- Focus ring via _activeCellKey tracking, crosshair highlights (sg-col--active-crosshair, sg-row--active-crosshair), fill handle affordance as real div

**Requirements completed:** 21/21 (CSSB-01..05, VFST-01..05, RGUT-01..05, ACEL-01..06)

---

## v5.0 Designer Workbench (Shipped: 2026-03-08)

**Phases:** 54-57 | **Plans:** 11 | **Tasks:** 19 | **Commits:** 17 | **LOC:** 30,385 TypeScript src + 48,747 tests + 7,312 Swift (total)
**Timeline:** 1 day (2026-03-08)
**Git range:** `feat(54-01)` to `docs(57-02)`

**Key accomplishments:**

1. Shell Scaffolding (Phase 54) -- WorkbenchShell vertical panel stack with flex-column layout, CollapsibleSection reusable primitive with ARIA disclosure pattern and localStorage persistence, CommandBar with app icon/command input/settings dropdown, ViewManager re-rooted to shell sub-element, overlays migrated to document.body
2. Properties + Projection Explorers (Phase 55) -- AliasProvider for property display names, PropertiesExplorer with LATCH-grouped columns and inline rename, ProjectionExplorer with 4 wells (available/x/y/z) and HTML5 DnD chip assignment, PAFVProvider aggregation extension (count/sum/avg/min/max), Z-plane controls for density/display field/audit toggle
3. Visual + LATCH Explorers (Phase 56) -- VisualExplorer wrapping SuperGrid with vertical zoom rail slider bidirectionally synced to SuperPositionProvider, LatchExplorers with 5 LATCH family sections (Category/Hierarchy checkbox lists via D3 join, Time preset range filters, Alphabet debounced text search), FilterProvider wiring
4. Notebook Explorer + Polish (Phase 57) -- NotebookExplorer with segmented Write/Preview modes, DOMPurify XSS sanitization with strict allowlist, GFM rendering (tables, task lists, strikethrough, code blocks), Cmd+B/I/K Markdown shortcuts, design token CSS polish across all explorer panels, focus-visible indicators

**Requirements completed:** 32/32 (SHEL-01..06, PROP-01..05, PROJ-01..07, VISL-01..03, LTCH-01..02, NOTE-01..04, INTG-01..05)

---

## v4.4 UX Complete (Shipped: 2026-03-08)

**Phases:** 49-52 | **Plans:** 10 | **Tasks:** 20 | **Commits:** 18 | **LOC:** 30,385 TypeScript src + 48,747 tests + 7,312 Swift (total)
**Timeline:** 1 day (2026-03-07 to 2026-03-08)
**Git range:** `feat(49-01)` to `docs(52-02)`

**Key accomplishments:**

1. Theme System (Phase 49) -- Three-way light/dark/system theme with CSS custom property palettes, ThemeProvider with matchMedia listener, SwiftUI shell sync via WKUserScript at-document-start FOWT prevention, Cmd+Shift+T shortcut
2. Accessibility (Phase 50) -- WCAG 2.1 AA contrast-validated design tokens (70 assertions), MotionProvider with prefers-reduced-motion detection, Announcer for screen reader notifications, skip-to-content link, ARIA landmarks, SVG view labels with card count, composite widget keyboard navigation across all 9 views
3. Command Palette (Phase 51) -- Cmd+K fuzzy search overlay with WAI-ARIA combobox pattern, dual-path search (instant fuzzy commands + debounced FTS5 card search), recent commands persistence, 9 view commands + contextual actions
4. Sample Data + Empty States (Phase 52) -- Three curated datasets (~25 cards each) with SampleDataManager class, split-button CTA in welcome panel, per-dataset command palette commands, source='sample' convention for audit identification and surgical deletion, sync boundary IS NULL guard

**Requirements completed:** 33 (THME-01..07, A11Y-01..11, CMDK-01..08, SMPL-01..07)

---

## v4.3 Review Fixes (Shipped: 2026-03-07)

**Phases:** 48 | **Plans:** 2 | **Tasks:** 5 | **Commits:** 13 | **LOC:** 27,065 TypeScript src + 41,544 tests + 7,270 Swift (total)
**Timeline:** 1 day (2026-03-07)
**Git range:** `fix(48-01)` to `docs(phase-48)`
**Files changed:** 77 (+1,640 / -348 lines)

**Key accomplishments:**

1. Excel ArrayBuffer Import Fix (Plan 48-01) -- Web file picker now reads .xlsx/.xls as ArrayBuffer instead of text, fixing silent parse failures on binary Excel formats; 25MB file size guard prevents browser hangs
2. Keyboard Shortcut Fix (Plan 48-01) -- Plain-key shortcuts (?, !, @, #) skip shiftKey matching entirely, fixing ? help overlay on real US keyboards where browsers send shiftKey=true for Shift+/
3. Undo/Redo Toast Wiring (Plan 48-01) -- MutationManager.setToast() provides single wiring point for undo/redo feedback from any trigger (keyboard, programmatic), replacing per-trigger toast logic
4. Biome Lint Gate Closure (Plan 48-02) -- Zero diagnostics across all 190 src/ and test/ files; fixed pre-existing ParsedFile import path error in 2 ETL validation test files
5. Planning Doc Reconciliation (Plan 48-02) -- ROADMAP, PROJECT, and STATE consistently reflect v4.3 as current milestone with all Active items checked off

**Requirements completed:** 5/5 (RFIX-01..03, BFIX-01, DFIX-01)

---

## v4.2 Polish + QoL (Shipped: 2026-03-07)

**Phases:** 42-47 | **Plans:** 15 | **Commits:** 79 | **LOC:** 24,336 TypeScript src + 41,385 tests + 7,270 Swift (total)
**Timeline:** 1 day (2026-03-07)
**Git range:** `feat(42-01)` to `docs(phase-47)`
**Files changed:** 284 (+79,072 / -53,017 lines)

**Key accomplishments:**

1. Build Health (Phase 42) -- Biome 2.4.6 linter/formatter with 175-file bulk reformat, fixed Xcode Run Script input paths and provisioning profile (CloudKit + iCloud Documents), GitHub Actions CI with 3 parallel jobs (typecheck, lint, test) and branch protection on main
2. Empty States + First Launch (Phase 43) -- Contextual empty states in ViewManager (welcome panel with Import File/Import from Mac CTAs, filtered-empty with Clear Filters, view-specific messages for all 9 views), density-aware SuperGrid empty state with Show All CTA
3. Keyboard Shortcuts + Navigation (Phase 44) -- ShortcutRegistry with centralized keyboard handler management and input field guards, Cmd+1-9 view switching, HelpOverlay with ? toggle and category grouping, macOS View menu with Cmd+1-9 shortcuts, ViewSwitchReceiver ViewModifier pattern
4. Visual Polish (Phase 45) -- CSS design token system (typography scale --text-xs through --text-xl, derived color tokens), :focus-visible keyboard navigation, zero hardcoded colors/font-sizes in all JS inline styles across NetworkView, TreeView, TimelineView, SuperGrid, SuperGridSelect
5. Stability + Error Handling (Phase 46) -- ErrorBanner with 5-category auto-classification (parse/database/network/import/unknown) and recovery actions, JSONParser unrecognized structure warning with key listing, ActionToast for undo/redo feedback
6. ETL Validation (Phase 47) -- 100+ card snapshot fixtures for all 9 sources, 81-combo source x view rendering matrix, per-source error message validation (16 tests), dedup re-import regression suite (21 tests), DedupEngine connection dedup fix for NULL via_card_id

**Requirements completed:** 26/26 (BUILD-01..05, EMPTY-01..04, KEYS-01..04, VISU-01..04, STAB-01..04, ETLV-01..05)

---

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
