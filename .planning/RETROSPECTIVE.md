# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v9.2 — Alto Index Import

**Shipped:** 2026-03-26
**Phases:** 4 (123-126) | **Plans:** 7

### What Was Built
- Native file picker with auto-discovery of 11 alto-index subdirectory types
- DirectoryDiscoverySheet modal with Select All/Deselect All and per-directory import progress
- Per-directory dataset partitioning with source-tagged cards and binary exclusion
- CatalogSuperGrid dataset lifecycle: action buttons, delete-by-dataset, two-phase re-import with diff preview
- directoryPath pipeline fix for seamless stored-path re-import (Phase 126 gap closure)

### What Worked
- Milestone audit identified the exact 2 gaps (DSET-03 directoryPath not stored, DSET-04 missing refresh) — Phase 126 closed both surgically in 2 tasks / 10 minutes
- Integration checker verified all 14 cross-phase connections and 3 E2E flows end-to-end
- Binary exclusion decision (metadata only) avoided the entire binary storage problem space

### What Was Inefficient
- Phase 125 built the re-import handler assuming directoryPath would be present in the database, but the upstream pipeline (Swift → NativeBridge → WorkerBridge) didn't thread it. This created a gap that needed a separate Phase 126. Could have been caught during Phase 124 planning with better upstream-to-downstream wiring analysis
- SUMMARY.md frontmatter inconsistency: some plans used different field names, making automated extraction fragile

### Patterns Established
- `activeDirectoryPath` accumulator pattern in NativeBridge: module-level variable captured on chunk 0, forwarded on final chunk — reusable for any per-import metadata that needs to survive across chunked messages
- `COALESCE(excluded.directory_path, directory_path)` SQL pattern: safely adds new metadata without overwriting existing values on re-upsert

### Key Lessons
- Cross-phase pipeline wiring deserves explicit verification during planning, not just at milestone audit time
- Gap closure phases (like 126) work well when audit precisely identifies the fix — 2 tasks, 10 minutes, done

---

## Milestone: v8.4 — Consolidate View Navigation

**Shipped:** 2026-03-22
**Phases:** 1 (108) | **Plans:** 2

### What Was Built
- ViewZipper horizontal tab strip deleted; SidebarNav Visualization Explorer as sole view-switch UI
- Play/Stop auto-cycle button with screen reader announcements
- Crossfade transition unified across all 3 view-switch paths (sidebar, Cmd+1-9, command palette)

### What Worked
- Surgical deletion: ViewZipper removed cleanly with zero side effects — no test failures introduced
- e.stopPropagation() pattern for Play/Stop button prevents header collapse without complex event plumbing

### What Was Inefficient
- Nothing notable — clean 2-plan removal + replacement

### Patterns Established
- SidebarNav as single source of truth for view navigation (no secondary view-switch UI)

### Key Lessons
- Auto-cycling belongs to persistent navigation, not carousel UI — sidebar is always visible

---

## Milestone: v8.3 — Plugin E2E Test Suite

**Shipped:** 2026-03-22
**Phases:** 4 (104–107) | **Plans:** 8

### What Was Built
- makePluginHarness(), usePlugin() auto-destroy, mockContainerDimensions() shared test infrastructure
- HarnessShell ?harness=1 entry point with window.__harness programmatic API
- 27-plugin lifecycle coverage with PluginLifecycleCompleteness permanent guard
- Cross-plugin interaction matrix: full smoke, 7 pairwise, 2 triple combos, ordering, isolation
- 15 Playwright E2E specs with 7 screenshot baselines, CI hard gate

### What Worked
- E2E testing found 4 production bugs (data-col-start, .pv-toolbar, onSort, SuperSortChain cleanup) — validating the investment in browser-level testing
- expect.poll() discipline: zero waitForTimeout across all specs made tests deterministic
- page.evaluate() + PointerEvent pattern reliably bypasses overlay pointer-events:none — reusable pattern for future overlay interactions
- LIFECYCLE_COVERAGE Record pattern provides compile-time enforcement without test runner awareness

### What Was Inefficient
- Phase ordering: 105/106 sequential but could have run in parallel since both only depend on 104

### Patterns Established
- ?harness=1 URL branch with dynamic import tree-shaking — test entry points with zero production footprint
- FEATURE_CATALOG.map() as canonical ordering source — self-updating expectation
- Test A/B isolation by construction — fresh harness per test, no shared state cleanup needed

### Key Lessons
- E2E tests are the most effective bug finders — 4 silent production bugs discovered that unit tests missed
- Overlay pointer-events:none is an E2E testing hazard — always plan for programmatic event dispatch
- CI hard gate for E2E: browser caching saves 30-60s per run, making it practical for PR checks

---

## Milestone: v8.2 — SuperCalc v2

**Shipped:** 2026-03-22
**Phases:** 1 (103) | **Plans:** 2

### What Was Built
- NullMode/CountMode/ScopeMode type system with structured AggResult return
- computeAggregate with 3 null handling modes (exclude/zero/strict) and 2 count modes (column/all)
- Scope radio toggle for filter-aware vs full-dataset aggregation
- Per-column UI controls: null mode select, count mode select

### What Worked
- AggResult structured return eliminated all call-site type narrowing — clean API boundary
- CalcConfig replaces aggFunctions Map — single typed config object for all SuperCalc state
- TDD approach caught SUM backward compat regression immediately (null→0 vs filter-then-sum)

### What Was Inefficient
- 14 test files needed allRows: [] added to ctx factories — cascading interface change across test suite

### Patterns Established
- AggResult { value, warning? } pattern for functions that may produce partial results

### Key Lessons
- Adding a required field to a shared interface (RenderContext) cascades to every test file — consider optional fields or builder pattern for frequently-extended interfaces

---

## Milestone: v8.1 — Plugin Registry Complete

**Shipped:** 2026-03-22
**Phases:** 2 (101–102) | **Plans:** 6 | **Sessions:** 1

### What Was Built
- Base plugin extraction: grid cell rendering, header spanning, DnD config panel as PluginHook factories
- SuperStack catalog migration: collapse + aggregate from HarnessShell closures to registerCatalog() with shared state
- SuperDensity: mode-switch toolbar, mini-cards compact layout, count-badge display (15 tests)
- SuperSearch: debounced input + cell highlight with shared SearchState (13 tests)
- SuperSelect: click, lasso drag, keyboard range selection with shared SelectionState (28 tests)
- SuperAudit: change tracking overlay + source provenance coloring with shared AuditPluginState (14 tests)
- FeatureCatalog: 27/27 real factory implementations, zero stubs remaining

### What Worked
- 4-way parallel execution in Wave 1 — all 4 plugin category plans ran concurrently with zero conflicts (separate files, separate test files)
- Shared state pattern proven at scale — DensityState, SearchState, SelectionState, AuditPluginState all follow ZoomState/SuperStackState pattern established in v8.0
- registerCatalog() as single source of truth — all shared state created in one closure, eliminating HarnessShell setFactory overrides
- TDD per plugin: each factory accompanied by behavioral tests before catalog registration
- Completeness guard as permanent regression test — getStubIds() mechanically enforces zero stubs

### What Was Inefficient
- Parallel agents had minor merge friction on FeatureCatalog.ts and FeatureCatalogCompleteness.test.ts (shared files updated by all 4 plans)
- Summary one_liner extraction still returns null — structured field not consistently populated

### Patterns Established
- registerCatalog() closure pattern for shared state across plugin siblings
- 4-way parallel plan execution for independent plugin categories

### Key Lessons
- Shared state objects scale cleanly: 6 different state types now use the same reference-passing pattern
- Parallel execution at plan level works when file ownership is clear per category
- Stub count as mechanical TDD gate ensures completeness without human checking

### Cost Observations
- Model mix: 100% sonnet (executor + verifier)
- Sessions: 1 (single execution run)
- Notable: Entire milestone executed in one session — smallest milestone to date (2 phases, 6 plans)

---

## Milestone: v8.0 — SuperGrid Redesign

**Shipped:** 2026-03-21
**Phases:** 4 (97–100) | **Plans:** 7 | **Sessions:** ~4

### What Was Built
- PivotGrid D3 rendering with two-layer header spanning from Figma design (mock data)
- PluginRegistry with typed PluginMeta + PluginHook interfaces, auto-dependency enforcement, pipeline hooks
- FeatureCatalog: 10 categories, 27 sub-features, dependency graph, noop-first registration
- HarnessShell sidebar for independent plugin toggling during development
- SuperStack plugins: spanning, collapse, aggregate (shared SuperStackState via setFactory closures)
- Plugin-grid bridge: PivotGrid.setRegistry() + runAfterRender() + pointer event routing
- SuperSize (3 plugins): col-resize with shift+drag normalize/dblclick auto-fit, header-resize, uniform scale
- SuperZoom (2 plugins): Ctrl+wheel zoom with shared ZoomState, slider synced via listener pattern
- SuperSort (2 plugins): header-click asc/desc/null cycle, chain sort with Shift+click (max 3)
- SuperScroll (2 plugins): virtual data windowing (SCROLL_BUFFER=2), CSS sticky headers
- SuperCalc (2 plugins): footer aggregates (SUM/AVG/COUNT/MIN/MAX) with glyphs, config panel
- 14 total plugin factories shipped, stub count 26→15, 199 pivot tests

### What Worked
- Figma-first design before code — visual prototype surfaced layout decisions that written specs hide
- noop-first registration with setFactory() replacement — full registry shape exists before implementations, enabling completeness testing from day one
- Architect review session caught the registry completeness gap before it could cause silent regressions
- Behavioral seam test discipline from v6.1 carried forward cleanly — pivot tests assert on contracts, not internals
- Wave-based parallel execution for Phase 100 — plans 100-01 and 100-02 ran in parallel with zero conflicts (different plugin categories, different test files)
- Shared state object pattern (ZoomState, SuperStackState, aggFunctions Map) — simple reference passing without external state manager, scales to any number of cross-plugin syncs

### What Was Inefficient
- v8.0 decisions (D-012..D-020) recorded in STATE.md during development — promotion to CLAUDE-v5.md and PROJECT.md deferred to milestone completion (now done)
- Collapse/aggregate plugins wired via HarnessShell closures rather than registerCatalog() — creates a two-tier system that needs monitoring
- No REQUIREMENTS.md for v8.0 — requirement IDs were inline in ROADMAP.md, making traceability checks impossible during milestone audit
- No milestone audit run before completion — YOLO mode skipped it, but the gap should be noted

### Patterns Established
- **Registry Completeness Suite** — 6-assertion reusable pattern for any registry: (1) presence, (2) count, (3) order, (4) uniqueness, (5) referential integrity, (6) stub detection. Named pattern for replication to future registries (ETL adapters, view types, facet definitions)
- **NOOP_FACTORY branded sentinel** — put the stub marker on the factory function (`__isNoopStub` brand), not the metadata. `setFactory()` clears stub status automatically with zero bookkeeping. Sentinel at the implementation boundary prevents flag/factory inconsistency
- **Progression ratchet test** — a test with a count that must *decrease* over time (stub count 26→0). Distinct from anti-patching rule (which says "never weaken") — this says "must move forward." Mechanical TDD enforcement via `getStubIds()`
- **Architectural decisions in STATE.md, not conversation history** — constraints that live only in chat don't exist for future CC sessions. Binding rules (TDD constraint, migration TODOs) must be in files CC reads at session start
- **Shared state objects** — mutable reference objects with listener arrays (ZoomState.listeners, aggFunctions Map) passed to multiple plugin factories via closure. Simpler than pub/sub, no external dependency, proven for cross-plugin sync

### Key Lessons
1. **Sentinels belong at the implementation boundary, not the metadata layer** — isStub on PluginMeta would create a second source of truth that drifts from the factory. Brand on the factory means one source of truth
2. **Named patterns enable replication** — "Registry Completeness Suite" is easier for CC to find and apply than "that 6-test thing we did for plugins"
3. **Test comments are invisible during handoff; STATE.md entries are not** — migration paths and architectural watch items belong in planning docs, not inline code comments alone
4. **Parallel plugin development scales** — independent categories (SuperSize vs SuperSort) can be developed simultaneously without merge conflicts when file ownership is disjoint

### Cost Observations
- Model mix: opus (planner, architect review), sonnet (executor, verifier)
- Sessions: ~4 (3 building + 1 review)
- Notable: Phase 100 executed 3 plans across 2 waves in ~20 minutes total — parallel execution of Wave 1 cut wall-clock time nearly in half

---

## Milestone: v7.0 — Design Workbench

**Shipped:** 2026-03-18
**Phases:** 6 | **Plans:** 17 | **Sessions:** ~2

### What Was Built
- Fixed CSS specificity regression where `:has()` rules overrode collapsed sections; dataset eviction pipeline for zero-bleed switching
- Shell restructure: centered wordmark menubar, 8-section sidebar with 3-state toggles, leaf-launcher sub-items
- ViewZipper: view-type tabs in Visualization Explorer with Play/Stop auto-cycle crossfade transitions
- Data Explorer panel with self-reflecting Catalog (SuperGrid bound to datasets registry), DB Utilities recent-cards viewer
- SuperGrid depth control wired via setter injection; drag-resizable row headers with persistence
- Three named design themes (NeXTSTEP, Modern, Material 3) with unified picker and cross-reload persistence

### What Worked
- UAT-driven milestone definition — handoff doc translated directly to phase structure, no speculative work
- Gap closure cycle (Plans 88-04, 89-04, 90-03) caught real integration issues that weren't visible in individual plan testing
- Setter injection pattern (setDepthGetter, setLatchSchemaProvider) continues to solve late-binding dependencies cleanly
- Phase parallelization within waves kept the 6-phase milestone to ~2 days despite 17 plans
- no-transition CSS class pattern for instant theme switching — simple, effective, zero JS complexity

### What Was Inefficient
- SUMMARY.md one-liner extraction remains inconsistent — some use `**One-liner:**` field, others rely on `# Phase N Plan M:` title
- v7.0 had no REQUIREMENTS.md (deleted after v6.1) — requirement IDs were inline in ROADMAP.md, making traceability manual
- Milestone audit was skipped — should be added to the workflow as a default step before completion

### Patterns Established
- UAT handoff document as phase blueprint — translate field notes directly to implementation spec
- Self-reflecting data patterns (Catalog renders through same PAFV engine it manages)
- no-transition guard pattern for theme switching prevents flash of intermediate states

### Key Lessons
- CSS specificity bugs are best caught with integration-level tests, not unit tests — `:has()` interactions span component boundaries
- Dataset eviction requires clearing every provider and view in sequence — forgetting one (SchemaProvider, ProjectionExplorer) causes stale data bleed
- Theme persistence requires both StateCoordinator (runtime) AND StateManager (persistence) registration

### Cost Observations
- Model mix: 100% sonnet (balanced profile)
- Sessions: ~2
- Notable: UAT-driven approach eliminated all research phases — fastest milestone per plan count

---

## Milestone: v6.1 — Test Harness

**Shipped:** 2026-03-17
**Phases:** 6 | **Plans:** 14 | **Sessions:** ~3

### What Was Built
- Shared test infrastructure: `realDb()` in-memory sql.js factory + `makeProviders()` wired provider stack with real SchemaProvider
- 14 seam test files (2,767 LOC) covering 10 cross-component integration gaps across 4 domains (filter, coordinator, ui, etl)
- Filter-to-SQL seam tests for 9 filter types against real sql.js
- PAFV-to-CellDatum shape verification with `__agg__` prefix regression guard
- Coordinator-to-bridge re-query propagation with rapid-change batching
- UI control seams: ViewTabBar, HistogramScrubber, CommandBar, WorkbenchShell, CalcExplorer lifecycle
- ETL-to-FTS5 round-trip verification (trigger path + 502-card bulk rebuild + soft-delete exclusion)
- 6 UI polish fixes: aggregation wiring, data-attribute-over-has, AppDialog, roving tabindex, histogram error, section state

### What Worked
- Anti-patching rule ("fix the app, never weaken the assertion") caught real correctness issues — SQLite LIKE case sensitivity, GROUP_CONCAT ordering, FTS trigger behavior
- realDb() + makeProviders() factories made every subsequent phase a one-liner to set up — zero boilerplate in 80+ seam tests
- Domain subdirectory tree (tests/seams/filter/coordinator/ui/etl) mirrors production module boundaries — easy to find and extend
- jsdom+WASM coexistence via per-file @vitest-environment annotation avoided test infrastructure conflicts
- Phase 84 UI polish ran in parallel with test phases — no dependencies, no conflicts

### What Was Inefficient
- Some SUMMARY.md files still lack structured one_liner field — summary extraction continues to be manual
- Phase 81 research was needed to discover coordinator callback timing, could have been covered in Phase 79 research
- 502-card threshold for FTS bulk path is a magic number — should be exported as BULK_THRESHOLD constant from SQLiteWriter

### Patterns Established
- Bridge spy captures state at fire-time (inside coordinator callback) — matches production synchronous read pattern
- flushMicrotasks via `await Promise.resolve()` for queueMicrotask-batched subscriber notifications
- isConnected over parentElement for DOM disconnection assertions (parentElement stays non-null in memory)
- data-attribute-over-has: dataset attributes for behavioral DOM queries, :has() only for CSS progressive enhancement

### Key Lessons
1. **Seam tests catch bugs that unit tests and E2E miss** — filter-to-SQL tests found SQLite LIKE ASCII limitation, FTS trigger timing, GROUP_CONCAT ordering behavior
2. **Test factories are worth a dedicated phase** — Phase 79 infrastructure made Phases 80-83 dramatically faster (one-line setup vs. per-test boilerplate)
3. **Anti-patching rule keeps tests honest** — never weakening assertions forces understanding of actual production behavior
4. **jsdom+WASM coexistence is per-file, not per-project** — @vitest-environment annotation is the escape hatch
5. **Regression guards (GREEN on arrival) validate architectural stability** — density seams confirmed coordinator propagation works correctly before anyone worried about it

### Cost Observations
- Model mix: 100% sonnet (executor + verifier)
- Sessions: ~3
- Notable: 6 phases, 14 plans in 2 days; test-only milestone with zero production regressions

---

## Milestone: v0.1 — Data Foundation

**Shipped:** 2026-02-28
**Phases:** 2 | **Plans:** 10 | **Sessions:** ~2

### What Was Built
- Custom sql.js WASM with FTS5 enabled (Emscripten build, 756KB artifact)
- Canonical schema with three-trigger FTS sync, foreign key cascade, soft delete
- Full Card and Connection CRUD with shared type system
- FTS5 search with BM25 ranking, rowid joins, highlighted snippets
- Graph traversal with recursive CTEs (connectedCards, shortestPath)
- Performance benchmark suite verified on 10K cards / 50K connections
- Production build pipeline (Vite lib mode + WASM asset copy)

### What Worked
- TDD enforcement paid off immediately — 151 tests caught deviations early (e.g., tsconfig rootDir conflict, Vitest 4 API changes)
- Pre-declaring all Phase 2 exports in index.ts prevented cross-plan file ownership conflicts
- Dual bench/assertion approach for performance: human-readable bench() output + automated CI-gate assertions
- Yolo mode with auto-advance kept velocity high — 10 plans in ~27 minutes total execution

### What Was Inefficient
- SUMMARY.md files lack structured `one_liner` field — milestone extraction had to read full files
- Phase 2 Plan 06 (gap closure) was necessary because ROADMAP.md accuracy wasn't maintained during execution — should update docs incrementally
- Custom WASM build required Docker fallback to local emcc — could have been caught in research

### Patterns Established
- Query module pattern: `src/database/queries/{module}.ts` with Database instance passed to every function (no module-level state)
- SQL_WASM_PATH env var as the contract between test globalSetup and Database.ts
- p99 as conservative p95 proxy (tinybench limitation)
- seedDatabase() as reusable 10K-card benchmark dataset generator
- Soft delete with `deleted_at IS NULL` guard in all non-admin queries

### Key Lessons
1. Pre-declare all module exports in index.ts at the start of each phase to prevent file ownership conflicts between plans
2. Vitest 4 removed several APIs (describe timeout 3rd arg, test.setTimeout) — always check framework version compatibility during research
3. Schema loading in dual-context (Node test vs Vite production) requires conditional dynamic imports — plan for this complexity early
4. Gap closure plans are a sign that docs weren't maintained during execution — bake doc updates into each plan

### Cost Observations
- Model mix: ~80% opus, ~20% haiku (research + execution)
- Sessions: ~2 (one for Phase 1, one for Phase 2)
- Notable: Average plan duration 2.7 minutes — research-to-execution pipeline is fast when specs are complete

---

## Milestone: v0.5 — Providers + Views

**Shipped:** 2026-02-28
**Phases:** 3 (4-6) | **Plans:** 14 | **Sessions:** ~4

### What Was Built
- Provider system: FilterProvider, PAFVProvider, SelectionProvider, DensityProvider with SQL-safe compilation
- MutationManager with command-pattern undo/redo, rAF-batched notifications, inverse pre-ordering
- QueryBuilder (sole SQL assembly point) + StateManager (Tier 2 debounced persistence)
- Six D3 views: ListView, GridView, KanbanView, CalendarView, TimelineView, GalleryView
- KanbanView HTML5 drag-drop with undoable mutations
- View transition system: SVG morph (list/grid/timeline) and crossfade (LATCH/GRAPH boundary)
- CardDatum expanded with due_at and body_text fields

### What Worked
- Provider double-validation pattern: addFilter() rejects bad input AND compile() re-validates — catches corrupt restored state
- MutationBridge / WorkerBridgeLike / PAFVProviderLike interface extraction pattern — enables clean test mocking across all subsystems
- SVG_VIEWS / HTML_VIEWS classification made transition boundary detection trivial
- ViewManager teardown ordering (unsubscribe → cancel timer → destroy) prevents coordinator firing into half-torn-down views
- GalleryView skipping D3 entirely for simple tile layout — right tool for the job, not dogmatic D3 usage
- TDD continued to catch issues early: jsdom DragEvent missing, D3 parseSvg crashes, RAF timing issues

### What Was Inefficient
- Phase 3 (Worker Bridge) was done but not tracked on disk — plans were executed in a previous milestone context and never archived, creating confusion about completion status
- SUMMARY.md files still lack a structured `one_liner` field (same issue as v0.1) — extraction requires reading full files
- Progress table in ROADMAP.md had formatting drift (missing milestone column for Phases 4-6)
- jsdom limitations required multiple workarounds (DragEvent polyfill, clientWidth stubbing, transition duration=0) — worth documenting as a pattern catalog

### Patterns Established
- SQL safety standard: error messages start with 'SQL safety violation:' for grep-ability
- Two-tier batching: providers use queueMicrotask (self-notify), StateCoordinator uses setTimeout(16) (cross-provider)
- VIEW_DEFAULTS map: each view type gets default axis/groupBy configuration on first mount
- IView contract: mount(container) / render(cards) / destroy() — strict lifecycle for all views
- CardRenderer dual mode: renderSvgCard() for SVG views, renderHtmlCard() for HTML views
- CSS design tokens in isometry.css (dark theme variables: --iso-bg, --iso-text, --iso-accent, etc.)
- dataset guard pattern: `data-drag-setup` / `data-drop-setup` flags prevent duplicate event listeners on D3 re-render

### Key Lessons
1. D3 `.transition()` on SVG transform attributes crashes jsdom via parseSvg — use direct `.attr()` for transforms, only `.transition()` for opacity
2. HTML5 drag-drop and d3.drag are incompatible — d3.drag intercepts dragstart and corrupts dataTransfer; use native addEventListener
3. structuredClone() is the right tool for deep state snapshots across provider family boundaries — prevents reference aliasing bugs
4. CalendarView tests must use dynamic dates (new Date()) not hardcoded month strings — otherwise tests break when month changes
5. computeSubRows() extracted as pure function enables unit testing without DOM — greedy algorithms should always be extractable

### Cost Observations
- Model mix: ~85% opus, ~15% haiku (research + execution)
- Sessions: ~4 (one for Phase 4, one for Phase 5, two for Phase 6)
- Notable: 14 plans in one day — provider/view pipeline velocity high when architectural decisions are pre-locked

---

## Milestone: v1.0 — Web Runtime

**Shipped:** 2026-03-01
**Phases:** 2 (3, 7) | **Plans:** 7 | **Sessions:** ~3

### What Was Built
- Worker Bridge: typed async RPC over postMessage with UUID correlation IDs, init queue replay, configurable timeouts
- NetworkView: force-directed graph with d3-force simulation running in Worker (stop+tick loop, stable positions only)
- TreeView: collapsible hierarchy via d3-stratify/d3-tree, multi-root forest with synthetic root, _children stash pattern
- SuperGrid: nested PAFV dimensional headers with run-length SuperStackHeader spanning algorithm, CSS Grid layout
- Full 9-view D3 suite operational — all LATCH and GRAPH view types implemented

### What Worked
- Phase 3 and Phase 7 ran in parallel (no dependency between them) — allowed concurrent execution
- d3-force stop()+tick() loop pattern avoids per-tick postMessage overhead — clean separation of Worker compute and main thread render
- SuperStackHeader run-length spanning algorithm elegantly handles arbitrary nesting depth via recursive leaf-count
- Gap closure workflow (03-03) was surgical — single test addition, no production code changes, 158 seconds total
- @vitest/web-worker environment worked well for Worker integration testing despite shared module state limitation

### What Was Inefficient
- Phase 3 Worker Bridge was largely complete from v0.5 era — only gap closure (03-03) and verification (03-02) were new work; the initial plan (03-01) was a re-run
- ROADMAP.md Progress table formatting drifted again (milestone column missing for Phases 3 and 7) — same issue as v0.5
- @vitest/web-worker shares Worker module state between instances, preventing fresh WorkerBridge creation in tests — workaround documented but constrains future test isolation

### Patterns Established
- Force simulation Worker pattern: stop()+tick() convergence loop, return only stable {id, x, y} positions
- _children stash for tree expand/collapse: never re-stratify, just move children to/from hidden slot
- SuperStackHeader spanning: run-length encode repeated headers, use CSS Grid `grid-column: span N`
- Synthetic __forest_root__ node pattern for multi-root tree rendering (invisible in DOM)
- SVGGElement.click() absent in jsdom — use dispatchEvent(new MouseEvent('click')) for SVG click tests

### Key Lessons
1. Worker integration tests with @vitest/web-worker should use a shared bridge instance — fresh Worker creation fails due to shared module state
2. d3-force simulation benefits from batch convergence (stop+tick loop) over per-tick messaging — eliminates main thread jank
3. SuperGrid cardinality needs hard limits (MAX_HEADERS=50) to prevent DOM explosion from high-cardinality axes
4. Gap closure plans are most efficient when they're test-only — no production code changes means minimal risk
5. Verification reports should be updated immediately by the gap closure plan, not deferred to a separate step

### Cost Observations
- Model mix: ~70% sonnet (executors), ~30% opus (orchestration)
- Sessions: ~3 (Phase 3 gap closure, Phase 7 execution, milestone completion)
- Notable: 7 plans across 2 days — Worker Bridge was mostly done, Phase 7 was the real new work

---

## Milestone: v1.1 — ETL Importers

**Shipped:** 2026-03-02
**Phases:** 3 (8-10) | **Plans:** 12 | **Sessions:** ~4

### What Was Built
- Full ETL import pipeline: CanonicalCard/CanonicalConnection type contract, DedupEngine, SQLiteWriter, ImportOrchestrator
- Six source parsers: Apple Notes (alto-index), Markdown (gray-matter), Excel (SheetJS dynamic import), CSV (PapaParse), JSON (auto-field detection), HTML (regex-based Worker-safe)
- Three export formats: Markdown (YAML frontmatter), JSON (pretty-printed), CSV (RFC 4180) via ExportOrchestrator
- Data Catalog provenance: import_sources + import_runs tables with CatalogWriter
- Worker Bridge notifications: WorkerNotification protocol, per-request timeout override, ImportToast UI component
- Critical safety mitigations: P22 (100-card batch OOM prevention), P23 (db.prepare() SQL injection prevention), P24 (FTS trigger optimization), P25 (in-memory Map dedup)

### What Worked
- CanonicalCard as integration seam made adding parsers trivially parallel — 5 parsers in Phase 9 (Wave 1) with zero cross-parser dependencies
- Research phase identified all 4 critical pitfalls (P22-P25) upfront — zero production safety incidents during execution
- TDD cycle continued strong: ~536 new tests across 12 plans, catching PapaParse BOM handling, SheetJS date formats, and HTML script stripping edge cases
- Dynamic import pattern for SheetJS deferred ~1MB bundle load successfully — no startup penalty
- Regex-based HTML parsing eliminated the linkedom/readability DOM library risk flagged in research (P29 safer default proved correct)
- Wave-based plan ordering enabled Phase 9 Wave 1 parsers to execute in parallel (09-01, 09-02, 09-03 independent)
- gray-matter reused for both import and export — round-trip fidelity guaranteed

### What Was Inefficient
- SUMMARY.md files still lack structured `one_liner` field (4th milestone noting this) — gsd-tools summary-extract returned null for all 12 files
- Phase 10 was small (2 plans) but required separate research/planning overhead — could have been folded into Phase 9 as a Wave 3
- xlsx package had version compatibility issues — ended up on 0.18.5 instead of the 0.20.3 CDN tarball planned in research
- Integration test determinism required explicit timestamp control (Phase 09-05 fix) — dedup tests with Date.now() were flaky

### Patterns Established
- CanonicalCard/CanonicalConnection as universal ETL integration seam — all parsers output, all writers consume
- HEADER_SYNONYMS pattern: shared field name detection across JSON/Excel/CSV parsers for consistent auto-mapping
- Parser function signature: `(data: string | ArrayBuffer, options?: ParseOptions) => {cards, connections}` — pure function, no side effects
- FTS trigger disable/rebuild for bulk imports (>500 cards) with optimize post-rebuild
- Per-request timeout override on WorkerBridge.send() instead of mutating shared config
- isNotification type guard checked BEFORE isResponse in message handler (notifications have no id/success fields)
- Exponential moving average (0.7/0.3 weighting) for smoothed progress rate display

### Key Lessons
1. Research flags should be resolved during research, not deferred to implementation — HTML parser DOM library question was correctly resolved to regex fallback before coding started
2. Integration seam types (CanonicalCard) should be the FIRST thing built — they unblock all parallel work streams
3. Dynamic imports for large dependencies (xlsx ~1MB) should always include a bundle size threshold test
4. Round-trip testing (import → export → re-import) catches format issues that unit tests miss (tag serialization, date formats)
5. Per-request timeout override is safer than config mutation — avoids race conditions in concurrent bridge usage
6. BOM handling must be the FIRST test case for any CSV/text parser — real-world Excel exports always include BOM

### Cost Observations
- Model mix: ~75% sonnet (executors), ~25% opus (planning/orchestration)
- Sessions: ~4 (Phase 8 execution, Phase 9 execution, Phase 10 execution, milestone completion)
- Notable: 12 plans in 1 day — fastest milestone by plan density; CanonicalCard integration seam enabled maximum parallelism

---

## Milestone: v2.0 — Native Shell

**Shipped:** 2026-03-03
**Phases:** 4 (11-14) | **Plans:** 11 | **Sessions:** ~3

### What Was Built
- Xcode multiplatform project (iOS 17+ / macOS 14+) with WKURLSchemeHandler serving WASM via `app://` scheme
- Bidirectional Swift↔JS bridge (5 message types) with WeakScriptMessageHandler retain cycle prevention
- DatabaseManager Swift actor with atomic checkpoint persistence (.tmp/.bak/.db rotation), 30s autosave, crash recovery
- NavigationSplitView shell with sidebar, platform-adaptive toolbars, macOS Commands (Cmd+I, Cmd+Z/⇧Z)
- Native file picker (iOS fileImporter + macOS NSOpenPanel) feeding existing ETL pipeline via JSONSerialization bridge
- iCloud Documents path resolution with NSFileCoordinator-wrapped writes and auto-migration from local
- StoreKit 2 SubscriptionManager (Free/Pro/Workbench) with FeatureGate enforcement and PaywallView

### What Worked
- **Five-concern Swift boundary** prevented scope creep — Swift only handles MIME serving, bridge, persistence, file picker, lifecycle. Zero Swift parsing code.
- **Research phase caught key pitfalls** — WASM MIME rejection (Phase 11 gating risk), scenePhase unreliable on macOS cmd-Q, beginBackgroundTask expiration handler capture, StoreKit Transaction.updates listener ordering
- **Message-driven Worker init** eliminated the auto-init race condition discovered in Phase 11 — Worker waits for explicit wasm-init message with pre-loaded ArrayBuffer
- **db:query separate from db:exec** preserved MutationManager contract while enabling ViewManager SELECTs — clean separation discovered during Xcode debugging
- **Two-phase native launch** (waitForLaunchPayload → createWorkerBridge) ensured checkpoint bytes arrive before WASM init — elegant async coordination
- **DatabaseManager actor** used Swift's concurrency model correctly — natural thread safety for file I/O without manual locks
- **Timer.scheduledTimer** on main run loop auto-pauses on background — simpler than Task.sleep loop, satisfies DATA-05 without explicit lifecycle code
- **4 plans auto-fixed blocking issues** (Rule 3) in-flight — tsc pre-existing errors, Combine import, @MainActor for tests, macOS sheet sizing

### What Was Inefficient
- **REQUIREMENTS.md bookkeeping lagged** — SHELL-01, SHELL-02, SHELL-04 unchecked despite Phase 11 complete. Checkboxes should update as each plan completes.
- **Phase 14 plan ordering confusion** — Plan 14-01 (iCloud) was logically first but Plan 14-02 (StoreKit) was executed first by a prior agent. The dependency graph resolved correctly but caused SUMMARY ordering confusion.
- **Provisioning profile mismatch** for iCloud Documents — entitlement changes require Apple Developer Portal regeneration. Not automatable, but should be noted in plan as "external dependency: manual action required."
- **Pre-existing TypeScript errors** still block `tsc --noEmit` — build:native works around this by skipping tsc, but the root cause (ETL test type errors) should be fixed.
- **SUMMARY.md one_liner field** still not populated (5th milestone noting this) — gsd-tools summary-extract returned null for all 11 files.

### Patterns Established
- **WKURLSchemeHandler + WASM pre-loading**: Main thread fetches WASM via scheme handler, transfers ArrayBuffer to Worker — standard pattern for WKWebView WASM apps
- **WeakScriptMessageHandler nested class**: Prevents retain cycle in WKUserContentController — private nested class delegates to weak outer reference
- **native:action kind discriminator**: Extensible action dispatch via `{type:'native:action', payload:{kind:'importFile',...}}` — future actions add cases, not message types
- **NSFileCoordinator for full atomic rotation**: Wraps entire .tmp/.bak/.db sequence, not just final write — prevents iCloud sync daemon observing partial state
- **BridgeManager as @StateObject owner**: App creates, ContentView observes — explicit dependency injection, no @EnvironmentObject magic
- **FeatureGate pure static functions**: Zero state, Comparable Tier ordering — trivially testable and composable

### Key Lessons
1. **WASM MIME type is a gating risk** for any WKWebView app — must be validated in Phase 11 Plan 01 before any other native work proceeds
2. **scenePhase.background is unreliable on macOS** — always add NSApplicationDelegateAdaptor for termination saves
3. **Swift actors are the right abstraction for file I/O** — DatabaseManager proves actor isolation prevents concurrent write corruption without manual locking
4. **Base64 transport through WKScriptMessageHandler is mandatory** — raw Uint8Array arrives as dictionary `{0:byte,...}` which destroys data integrity
5. **Two-phase native launch is the correct startup pattern** — fetch resources in parallel (WASM + checkpoint), then hand both to WorkerBridge constructor
6. **StoreKit Transaction.updates listener must start before product loading** — prevents missed transactions during the startup race
7. **JSONSerialization for bridge payloads** is safer than template literals — file content with quotes/newlines/backslashes breaks string interpolation

### Cost Observations
- Model mix: ~60% sonnet (executors), ~40% opus (research/planning/orchestration)
- Sessions: ~3 (Phase 11-12, Phase 13, Phase 14)
- Notable: 11 plans in 2 days — fastest per-plan velocity yet; Swift TDD cycle is extremely tight (4-24 min per plan). Phase 11 Plan 02 at 90 min was the outlier (debugging Worker race condition and SQLite query type mismatch). All other plans were ≤24 min.

---

## Milestone: v3.0 — SuperGrid Complete

**Shipped:** 2026-03-05
**Phases:** 13 (15-27) | **Plans:** 35 | **Sessions:** ~6

### What Was Built
- Dynamic PAFV Foundation: PAFVProvider stacked row/column axes, SuperGridQuery Worker wiring with rAF coalescing, live provider-driven rendering
- SuperDynamic: HTML5 DnD axis transpose between row and column dimensions with 300ms D3 transitions
- SuperPosition + SuperZoom: CSS Custom Property zoom with frozen sticky headers, scroll position restore
- SuperSize: Pointer Events column resize with auto-fit, Shift+drag bulk normalize, Tier 2 persistence
- SuperSelect: Z-axis aware lasso/Cmd+click/Shift+click 2D range selection with bounding box cache
- SuperDensity: 4-level Janus density model (Value time hierarchy, Extent hide empty, View spreadsheet/matrix, Region stub)
- SuperSort: per-group header sort with multi-sort priority and visual indicators
- SuperFilter: auto-filter dropdowns populated from current query, Select All/Clear, Cmd+click "only this"
- SuperSearch: FTS5 in-grid search with 300ms debounce, compound supergrid:query, D3-managed mark highlights
- SuperTime: smart time hierarchy auto-detection with segmented pills and non-contiguous period selection
- SuperCards + Polish: aggregation cards at group intersections, help overlay, context menu, performance benchmarks

### What Worked
- **Narrow interface pattern** (SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike, SuperGridSelectionLike, SuperGridPositionLike, SuperGridDensityLike) enabled each Super* feature to be developed and tested in isolation — all 6 interfaces defined in types.ts, zero concrete class imports in SuperGrid.ts
- **rAF coalescing for superGridQuery** turned the StateCoordinator 16ms batch problem into a non-issue — 4 simultaneous provider changes → 1 Worker request, proven by FOUN-11 integration test
- **Research phase correctly identified 7 architectural constraints** upfront (CSS Custom Property zoom, SuperPositionProvider NOT in coordinator, dragPayload singleton, FTS highlights via data join, lasso bounding box cache, gridColumn/gridRow in both callbacks, all axis state in PAFVProvider) — zero architectural pivots during execution
- **Cascade pattern** for phases 22-27 (SuperDensity → SuperSort, SuperFilter, SuperSearch, SuperTime → SuperCards) meant each feature could build on the density toolbar without coordination overhead
- **TDD cycle was exceptionally tight** — most plans completed in 2-12 minutes; Phase 18 Plan 01 (44 min) and Phase 27 Plan 01 (45 min) were outliers due to complex DnD and SuperCard rendering
- **Phase 27 performance assertion tests** (PLSH-01/02/03) used deterministic mulberry32 PRNG seed=42 and p95 timing — reproducible in CI without flaky benchmarks
- **Audit found and fixed one gap** (PLSH-05 context menu hide column) during audit, not in production — milestone audit workflow proved its value

### What Was Inefficient
- **SUMMARY.md one_liner field** still not populated (6th milestone noting this) — gsd-tools summary-extract returns null for all files. This is now a systemic GSD tooling issue, not a project issue.
- **Phase 19 required a Plan 03 gap closure** (_isInitialMount scroll reset) — scroll behavior edge case not caught by Plans 01/02. Gap was surgical (2 min) but existence indicates the plan underspecified the mount lifecycle.
- **Phase 21 required a Plan 04 gap closure** (live lasso highlight during drag) — visual feedback during lasso was specified but not covered by Plans 01-03. Again, the plan could have included this in Plan 02.
- **PLSH-01 performance test adapted** from 50×50 to 10×10 grid in jsdom — jsdom DOM operations are ~100× slower than Chrome, making the spec budget impossible in test. Algorithmic guard preserved but spec validation requires real browser.
- **20 human verification items** identified in audit across 6 phases (zoom, resize, density, filter, time, context menu) — all require browser-based visual testing that jsdom cannot perform.
- **Pre-existing TS2345 type errors** at SuperGrid.ts lines 1518/1522 carried across all phases without being fixed — low risk but noisy.

### Patterns Established
- **Narrow interface per dependency**: each SuperGrid constructor arg gets a minimal `*Like` interface in types.ts — production wires real classes, tests use 10-line mocks
- **rAF coalescing for high-frequency Worker calls**: schedule on first call, overwrite resolve/reject on subsequent, fire single send() in rAF callback
- **CSS Custom Property zoom** over CSS transform: set `--sg-col-width` and `--sg-row-height`, grid template re-evaluates
- **Module-level singleton for drag payload**: `export const _dragPayload: AxisDragPayload = {}` — dataTransfer.getData() blocked during dragover
- **Hybrid density routing**: granularity → Worker re-query; hideEmpty/viewMode → client-side transform only
- **D3 .each() after .join()** for positional CSS Grid properties — ensures both enter and update paths set gridColumn/gridRow
- **self=this capture** before D3 `.each(function(d))` for class method access inside data join callbacks
- **parseDateString sequential fallback** with US/EU disambiguation guard (day > 12 → unambiguously EU)
- **Event delegation** for context menus and keyboard shortcuts (one listener via `.closest()`, not per-render wiring)

### Key Lessons
1. **Narrow interfaces are the single most impactful testing pattern for complex views** — SuperGrid has 6 dependencies, each with a 3-5 method interface. Tests create inline mocks in seconds. (v3.0-validated, builds on v0.5 interface extraction lesson)
2. **Research constraints that would be architectural pivots must be identified at research time** — v3.0 research identified 7 constraints that would have caused rewrites if discovered during execution
3. **rAF coalescing should be the default for any Worker method called from StateCoordinator subscriptions** — the 16ms batch can fire 4+ provider callbacks synchronously
4. **CSS position:sticky frozen headers require overflow on a single scroll container** — d3.zoom's transform:translate conflicts with this; the CSS Custom Property approach is the only correct solution
5. **Lasso selection MUST use bounding box cache** — live getBoundingClientRect() per mousemove is O(N×M) layout thrash; cache once per render, read from cache during drag
6. **D3 data join enter+update both need positional CSS** — any property that changes on re-render (gridColumn, gridRow) must be set in both paths; missing update path causes silent misalignment
7. **Performance assertion tests (not benchmarks) for CI** — run as `test()` with hard threshold, not `bench()` with statistical output; CI blocks on regression

### Cost Observations
- Model mix: ~70% sonnet (executors), ~30% opus (planning/research/orchestration)
- Sessions: ~6 (Phases 15-17, Phase 18-19, Phase 20-21, Phase 22-23, Phase 24-26, Phase 27 + milestone)
- Notable: 35 plans in 2 days — highest plan density across all milestones (17.5 plans/day). Average plan duration ~8 min. The narrow interface pattern enabled true TDD velocity — mock setup takes seconds, not minutes.

---

## Milestone: v4.0 — Native ETL

**Shipped:** 2026-03-06
**Phases:** 4 (33-36) | **Plans:** 9 | **Sessions:** ~2

### What Was Built
- Native ETL Foundation: NativeImportAdapter protocol, PermissionManager actor, CoreDataTimestampConverter, NativeImportCoordinator with 200-card chunked base64 dispatch, MockAdapter E2E validation (3-card + 5K stress test)
- RemindersAdapter via EventKit: incomplete + 30-day completed reminders with priority mapping, recurrence metadata, list-as-folder, calendarItemIdentifier dedup
- CalendarAdapter via EventKit: events with attendee person cards as link cards, all-day handling, recurring event expansion, synthesized content for noteless events, is_collective flag
- NotesAdapter via SQLite3 C API: direct NoteStore.sqlite reading with copy-then-read WAL safety, runtime schema version detection, folder hierarchy self-join, encrypted note filtering, hashtag extraction
- Protobuf body text extraction: SwiftProtobuf gzip decompression + AttributeRun walker, three-tier fallback (full Markdown / plain text / ZSNIPPET), attachment metadata batch lookup, note-to-note link connections with bidirectional weights
- normalizeNativeCard() cross-language interop fix for Swift JSONEncoder nil-skipping

### What Worked
- **Additive-only architecture** prevented scope creep — native adapters output CanonicalCard JSON through existing bridge, TypeScript ETL pipeline untouched except for a new Worker handler and 3 SourceType values
- **MockAdapter-first validation** caught the Swift JSONEncoder nil-skipping bug before any real adapter was tested — the normalizeNativeCard() fix applied to all subsequent adapters automatically
- **etl:import-native Worker handler** bypassing ImportOrchestrator parse was the correct design — pre-parsed cards don't need string-to-object conversion, just DedupEngine + SQLiteWriter directly
- **Merged parallel execution** of Phases 34+35 was efficient — EventKit adapters and Notes adapter have no dependency on each other, parallel work saved ~30 min
- **Three-tier fallback** for protobuf extraction maximized data capture — partial failures produce snippet fallback, not import errors
- **Link card convention** (attendee-of: and note-link: source_url prefixes) generalized cleanly from Calendar attendees to Notes note-links — TypeScript handler has a simple prefix switch

### What Was Inefficient
- **Phases 34+35 missing SUMMARY.md files** — merged parallel execution skipped the per-plan summary step. Commit history confirms completion but milestone completion has to reconstruct accomplishments from PLANs and commits.
- **SwiftProtobuf version mismatch** in plan (2.0.0 specified, doesn't exist; 1.35.1 is latest) — research didn't verify actual available versions
- **Provisioning profile issue** continues to block macOS builds — same pre-existing issue from v2.0, still not resolved
- **No XCTests for adapters** — only CoreDataTimestampConverter has unit tests; adapters rely on E2E validation through MockAdapter pattern
- **SUMMARY.md one_liner field** still not populated (7th milestone noting this)

### Patterns Established
- **NativeImportAdapter protocol**: AsyncStream<[CanonicalCard]> for backpressure-aware batch yielding — all future native adapters conform
- **Copy-then-read for system databases**: temp directory with UUID, copy .db + .wal + .shm, open copy read-only — prevents corruption of live databases
- **Link card convention**: source_url prefix (attendee-of:, note-link:) triggers auto-connection creation on TypeScript side
- **normalizeNativeCard()**: always normalize optional CanonicalCard fields from Swift before sql.js bind
- **Ack-before-process**: acknowledge bridge chunk receipt before expensive database operations to prevent Swift-side timeout
- **nonisolated struct + nonisolated extension**: required pattern for SwiftProtobuf types under MainActor default isolation
- **Schema version detection**: runtime column name branching for cross-OS-version compatibility

### Key Lessons
1. **MockAdapter-first validation is essential** — catches cross-language interop bugs (nil-skipping, type mismatches) before real data is involved
2. **Additive-only architecture scales** — v4.0 added 3 native adapters with zero changes to the TypeScript ETL pipeline (only 1 new handler + 3 SourceType values)
3. **Copy-then-read is the only safe approach** for live system databases — WAL-mode databases actively written by system apps cannot be opened directly
4. **SwiftProtobuf hand-written conformance works** for stable schemas — protoc-gen-swift dependency avoided; hand-written .pb.swift is readable and maintainable
5. **Three-tier fallback maximizes data capture** — users see partial results, not errors, when protobuf parsing encounters unknown fields
6. **Link card source_url prefix convention is extensible** — new relationship types add a prefix, not a new message type or handler rewrite
7. **Merged parallel execution should still write SUMMARY.md files** — skipping them creates milestone completion gaps

### Cost Observations
- Model mix: ~65% sonnet (executors), ~35% opus (research/planning/orchestration)
- Sessions: ~2 (Phase 33 foundation, Phases 34-36 adapters)
- Notable: 9 plans in 2 days (4.5 plans/day). Merged execution of Phases 34+35 was the key velocity booster. Phase 33 Plan 03 (20 min) was the longest due to E2E debugging.

---

## Milestone: v3.1 -- SuperStack

**Shipped:** 2026-03-06
**Phases:** 5 (28-32) | **Plans:** 12 | **Sessions:** ~3

### What Was Built
- N-Level Foundation: PAFVProvider depth limit removed, shared compound key utility (keys.ts) with \x1f/\x1e separator convention, N-level GROUP BY validation
- Multi-Level Row Headers: CSS Grid spanning at all depths, cascading sticky offsets (L0=0px, L1=80px, L2=160px), symmetric row/col header behavior
- Collapse System: aggregate mode (count badge + summary cells with heat-map) and hide mode (zero footprint), context menu mode switching, Tier 2 persistence
- Drag Reorder: within-dimension level reorder via reorderColAxes/reorderRowAxes, collapse key remapping (level swap for 2-axis, clear for 3+), visual insertion line, source dimming, FLIP animation (200ms WAAPI)
- Polish and Performance: backward-compatibility matrix across 4 prior phase shapes, cross-session round-trip via StateManager, deepest-wins aggregation suppression, aggregate proxy selection, 4 N-level benchmarks

### What Worked
- **keys.ts single source of truth** prevented key format fragmentation -- all SuperGrid key construction/parsing flows through one utility, zero inline separator literals across the codebase
- **No-notify accessor pattern** (collapseState, like colWidths) correctly identified collapse as layout-only state -- no unnecessary Worker re-queries on expand/collapse
- **Non-destructive reorder methods** (reorderColAxes/reorderRowAxes) preserved colWidths, sortOverrides, and collapseState across reorder operations -- existing v3.0 state survived without data loss
- **Deepest-wins render-time-only approach** kept the user model (_collapsedSet/_collapseModeMap) pure -- suppressedCollapseKeys recomputed fresh on every render, preventing stale suppression bugs
- **Backward-compatibility matrix testing** validated state shapes from 4 prior phases (pre-15/20/23/30) -- proving PAFVProvider can restore any historical checkpoint without data loss
- **v3.1 paused for v4.0 and resumed cleanly** -- Phases 28-30 completed before v4.0 insert, Phases 31-32 picked up exactly where left off with zero rework

### What Was Inefficient
- **Phase 32 Plan 02 took ~45 min** (longest plan in v3.1) due to deepest-wins combinatorial complexity -- aggregate injection refactoring from leaf-cell iteration to _collapsedSet iteration was a significant design pivot discovered during TDD RED phase
- **4 auto-fixes in Plan 32-02** -- summary cell detection, aggregate injection loop strategy, visibleColValueToStart entries for non-leaf headers, heat map test assertion correction -- all discovered during TDD GREEN phase
- **ROADMAP.md had formatting issues** -- Phase 32 plan checkboxes unchecked despite summaries existing, Progress table row 32 missing milestone column
- **SUMMARY.md one_liner field** still not populated (8th milestone noting this)

### Patterns Established
- **keys.ts compound key utility**: UNIT_SEP (\x1f) within dimension, RECORD_SEP (\x1e) between dimensions -- canonical for all SuperGrid key construction
- **No-notify accessor for layout-only state**: collapse, colWidths, and any future layout state use get/set without _scheduleNotify
- **visibleLeafCells filter pattern**: hide-mode filtering happens before cellPlacements construction (zero footprint rendering)
- **suppressedCollapseKeys pre-computation**: O(n^2) ancestor/descendant scan of _collapsedSet before aggregate injection
- **FLIP snapshot consumed once**: instance variable nulled after playback prevents stale animations
- **makePersistenceMock() factory**: reusable in-memory Map for cross-session persistence simulation tests

### Key Lessons
1. **Layout-only state should always use no-notify accessors** -- collapse toggle doesn't need Worker re-query, only DOM re-render (validated by CLPS-05 persistence tests)
2. **Aggregate injection must iterate the collapsed key set, not the header cell arrays** -- buildHeaderCells removes deeper cells when a parent is collapsed, making leaf-level iteration insufficient for non-leaf collapse
3. **Deepest-wins suppression must be render-time only** -- mutating _collapsedSet would corrupt toggle behavior; computed suppression set is the correct approach
4. **Backward-compatibility matrix testing should be standard for any provider with Tier 2 persistence** -- PAFVProvider accumulated 5 shape versions across Phases 15-32; testing all of them in one plan proved cross-session safety
5. **Pausing a milestone for a higher-priority insert works cleanly** -- v3.1 paused at Phase 30 for v4.0 (Phases 33-36), resumed at Phase 31 with zero rework
6. **Pragmatic collapse key clearing for 3+ axis reorder is acceptable** -- surgical remap is error-prone at 3+ levels; users lose collapsed state on deep reorder, which is rare

### Cost Observations
- Model mix: ~70% sonnet (executors), ~30% opus (planning/research)
- Sessions: ~3 (Phases 28-30 before v4.0 pause, Phase 31, Phase 32)
- Notable: 12 plans in 2 days (6 plans/day). Most plans completed in 3-8 min. Phase 32 Plan 02 (45 min) was the outlier due to deepest-wins combinatorial complexity. The v4.0 interleave added zero overhead to v3.1 completion.

---

## Milestone: v4.1 -- Sync + Audit

**Shipped:** 2026-03-07
**Phases:** 5 (37-41) | **Plans:** 12 | **Sessions:** ~2

### What Was Built
- SuperAudit: AuditState session-only change tracking across all 9 views, CSS audit overlay with data-attribute selectors, source provenance color coding (9 source type pastels), calculated field visual distinction, toggle button (Shift+A) with floating legend panel, auto-wiring to import pipeline
- Virtual Scrolling: SuperGridVirtualizer data windowing module (O(1) getVisibleRange), CSS content-visibility progressive enhancement, sentinel spacer for virtual scroll height, 60fps at 10K+ rows with bounded 15-30 DOM nodes
- CloudKit Architecture: Database migrated from iCloud ubiquity container to Application Support, CKSyncEngine actor with JSONEncoder state serialization, offline queue persisted as sync-queue.json, SyncMerger in NativeBridge.ts via INSERT OR REPLACE
- CloudKit Card Sync: Server-wins conflict resolution with system fields archival, foreground polling on scenePhase .active, push notification registration (macOS + iOS), SyncStatusPublisher 3-state toolbar icon, unwrapped send preventing sync echo loops
- CloudKit Connection Sync: extractChangeset bug fixes (soft-delete as field update, create ops with Worker-generated ids, connection field propagation), partition-based batch ordering for FK constraints, export-all extended to include connections

### What Worked
- **Data windowing approach** correctly preserved D3 data join ownership -- virtualizer filters rows before join, not DOM manipulation after join. Research identified this as the only safe approach (Pitfall 6).
- **BatchSnapshot pattern** solved Swift 6 strict concurrency for CKSyncEngine closures -- capturing actor-isolated state into a Sendable struct before synchronous closure consumption. Reusable for any actor-to-closure boundary.
- **Unwrapped send pattern** prevented sync echo loops cleanly -- capturing bridge.send before mutation hook installation means SyncMerger writes bypass the mutated message entirely. Elegant one-line fix.
- **Partition-based batch ordering** (cards before connections) solved FK constraint satisfaction with O(n) complexity -- simpler and more readable than sort comparator.
- **AuditState as CSS overlay (not StateCoordinator provider)** was correct -- toggle doesn't need Worker re-query, just CSS class toggle on root element. Kept audit decoupled from data pipeline.
- **TDD for extractChangeset** caught all 3 bugs before integration -- soft-delete operation mapping, create-id sourcing from result, connection field propagation. Pure function testing at its best.
- **Export-all-cards extension** (add connections to existing message type) was cleaner than a new bridge message type -- backward-compatible with `?? []` default on Swift side.

### What Was Inefficient
- **Phase 38-02 took 62 min** (longest plan in v4.1) -- mostly human verification checkpoint time, not code execution. The actual benchmarking tests were fast.
- **Three blocking deviations in Phase 39-02** from Swift 6 strict concurrency -- BatchSnapshot pattern, nonisolated CKRecord extensions, .sentDatabaseChanges event case -- all auto-fixed but indicate research didn't fully capture Xcode 26 concurrency requirements.
- **CKSyncEngine.fetchChanges() async throws** not documented in Apple sample code -- discovered during implementation, required Task wrapping. Research should have flagged the Xcode 26 SDK change.
- **Provisioning profile issue still unresolved** -- carried from v2.0 through v4.0 and v3.1, now blocking CloudKit in production. Must be resolved externally before v4.1 can be validated on device.
- **SUMMARY.md one_liner field** still not populated (9th milestone noting this).

### Patterns Established
- **AuditState subscribe/unsubscribe pattern**: matches SelectionProvider (Tier 3 ephemeral) -- change tracking is session-only
- **CSS audit data attribute pattern**: data-audit='new|modified|deleted', data-source='source_type' on renderable elements -- pure CSS overlay
- **SVG audit rects**: rect.audit-stripe (3px left), rect.source-stripe (2px bottom) for SVG views (SVG doesn't support CSS border)
- **Data windowing**: virtualizer filters data rows before D3 join, preserving join ownership and DOM lifecycle
- **Sentinel spacer**: absolute-positioned div in rootEl for accurate virtual scroll height
- **BatchSnapshot**: capture actor-isolated state into Sendable struct for CKSyncEngine synchronous closure
- **Unwrapped send**: capture bridge.send.bind(bridge) BEFORE mutation hook for sync-safe operations
- **Cross-isolation status publishing**: nonisolated(unsafe) publisher reference updated via Task { @MainActor in }
- **Platform-conditional app delegates**: #if os(macOS) NSApplicationDelegateAdaptor / #else UIApplicationDelegateAdaptor
- **Partition batch ordering**: filter + concat for FK constraint satisfaction (cards before connections)

### Key Lessons
1. **Data windowing is the only correct virtual scrolling approach for D3** -- DOM virtualization after data join breaks D3's exit/enter lifecycle and orphans elements
2. **Swift 6 strict concurrency requires BatchSnapshot pattern for CKSyncEngine** -- synchronous closures cannot access actor-isolated state; snapshot into Sendable struct first
3. **Sync echo prevention requires capturing send before hook installation** -- mutated message hook wraps all bridge sends; sync merger needs the original unwrapped send to avoid infinite loops
4. **CSS overlay (not provider) is correct for visual-only toggles** -- AuditState toggle changes CSS class, not data; no Worker re-query needed
5. **Partition-based ordering is better than sort for batch constraint satisfaction** -- O(n), stable, more readable than comparator function
6. **nonisolated marking is required for CKRecord extensions in Xcode 26** -- MainActor inference applies to all extension methods unless explicitly marked nonisolated
7. **Human verification checkpoints dominate wall-clock time** -- 38-02 was 62 min but only ~5 min of code execution; consider batching verifications

### Cost Observations
- Model mix: ~70% sonnet (executors), ~30% opus (planning/orchestration)
- Sessions: ~2 (Phases 37-38 audit+scrolling, Phases 39-41 CloudKit)
- Notable: 12 plans in 1 day (12 plans/day) -- highest single-day plan density. Average plan duration ~10 min (excluding 38-02 human verification). CloudKit phases (39-41) averaged 5 min/plan, proving that well-researched sync architecture executes fast.

---

## Milestone: v4.2 -- Polish + QoL

**Shipped:** 2026-03-07
**Phases:** 6 | **Plans:** 15 | **Sessions:** ~2

### What Was Built
- Biome 2.4.6 linter/formatter with 175-file bulk reformat, Makefile lint targets
- Fixed Xcode Run Script input paths and provisioning profile (CloudKit + iCloud Documents)
- GitHub Actions CI with 3 parallel jobs (typecheck, lint, test) + branch protection on main
- Contextual empty states for all 9 views (welcome panel, filtered-empty, view-specific, density-aware)
- ShortcutRegistry with centralized keyboard handlers, Cmd+1-9 view switching, ? help overlay
- macOS View menu with Cmd+1-9 shortcuts via ViewSwitchReceiver ViewModifier
- CSS design token system (typography scale --text-xs through --text-xl, derived color tokens)
- Zero hardcoded inline colors/font-sizes across all JS view files (NetworkView, TreeView, TimelineView, SuperGrid, SuperGridSelect)
- :focus-visible keyboard navigation for all interactive elements
- ErrorBanner with 5-category auto-classification and per-category recovery actions
- JSONParser unrecognized structure warning with key listing
- ActionToast for undo/redo visual feedback
- 100+ card snapshot fixtures for all 9 ETL sources
- 81-combo source x view rendering matrix (9 sources x 9 views)
- Dedup re-import regression suite + DedupEngine connection dedup fix

### What Worked
- Parallel phase execution (43, 44, 45, 46 all after 42) maximized throughput -- 15 plans in 1 day
- Design token approach (CSS custom properties) was the right abstraction level -- var(--token) in JS inline styles is testable and maintainable
- ShortcutRegistry centralization eliminated duplicated input field guard logic across multiple handlers
- ETL validation phase (47) as integration test confirming all prior phases was high-ROI
- 20-card subset per source kept 81-combo rendering matrix fast while maintaining coverage

### What Was Inefficient
- Biome lint drift -- files added after Phase 42 lint gate didn't get linted, requiring v4.3 cleanup
- Planning doc staleness -- ROADMAP and PROJECT Active sections went stale during parallel execution
- audit-colors.ts retains hardcoded hex values (documenting the mapping instead of migrating -- acceptable tech debt)

### Patterns Established
- CSS design token system: --text-xs..--text-xl typography scale, --danger-bg/--accent-bg/--selection-bg derived colors
- ShortcutRegistry pattern: single keydown listener, input field guard, Cmd modifier cross-platform mapping (metaKey vs ctrlKey)
- ViewSwitchReceiver ViewModifier extraction for SwiftUI type-checker performance (prevents timeout from N onReceive handlers)
- CustomEvent dispatch for loose coupling (isometry:import-file, isometry:import-native)
- FilterProviderLike narrow interface for ViewManager dependency injection
- ErrorBanner categorizeError() with ordered regex matching (first category wins)
- Snapshot fixture pattern: JSON row definitions with runtime generation for binary formats (Excel via SheetJS)

### Key Lessons
1. **Lint gates must auto-run on every commit, not just at lint setup time** -- CI enforces this, but files added between lint setup and CI setup drifted
2. **ViewModifier extraction is necessary for SwiftUI bodies with many onReceive handlers** -- type-checker timeout is a real limit
3. **CSS custom property var(--token) is testable in jsdom via string matching** -- jsdom can't resolve the property, but assertions on the string value work
4. **DedupEngine connection dedup requires explicit pre-check** -- SQLite UNIQUE constraint ignores NULL (NULL != NULL), so NULL via_card_id connections bypass uniqueness
5. **Parallel phase execution at the milestone level is the highest leverage** -- phases 43-46 had no dependencies on each other, enabling 4x parallelism after Phase 42

### Cost Observations
- Model mix: ~80% sonnet (executors), ~20% opus (planning)
- Sessions: ~2 (Phase 42 build health, Phases 43-47 parallel features + validation)
- Notable: 15 plans in 1 day (15 plans/day) -- new record. Parallel phase execution was key multiplier. Average plan duration ~8 min.

---

## Milestone: v4.3 -- Review Fixes

**Shipped:** 2026-03-07
**Phases:** 1 | **Plans:** 2 | **Sessions:** ~1

### What Was Built
- Fixed Excel web import to use ArrayBuffer for binary formats (.xlsx/.xls) -- silent parse failures resolved
- Fixed ? shortcut to fire on real US keyboards by skipping shiftKey matching for all plain-key shortcuts
- Wired undo/redo ActionToast into MutationManager.setToast() as single feedback wiring point
- Cleaned Biome lint gate to zero diagnostics across all 190 source and test files
- Reconciled all planning docs to reflect shipped state accurately

### What Worked
- Codex code review identified real runtime bugs that manual testing missed -- external review caught edge cases in browser keyboard events and binary file reading
- Tiny focused milestone (1 phase, 2 plans, 5 tasks) completed in under 10 minutes of execution time
- Biome --write --unsafe auto-fixed most lint issues, reducing manual effort to near-zero
- Fix-first approach: all 3 runtime bugs fixed in Plan 01, leaving Plan 02 purely for cleanup

### What Was Inefficient
- These bugs could have been caught by integration tests in v4.2 (no real-browser keyboard event tests, no ArrayBuffer import test)
- The ParsedFile import path error was pre-existing from v4.2 -- TypeScript --noEmit should have been part of the CI gate earlier
- Planning doc staleness accumulated because milestone completion didn't auto-update Active checkboxes

### Patterns Established
- MutationManager.setToast() interface pattern -- any object with `show(message)` works, decoupling from DOM implementation
- Plain-key shiftKey bypass -- universally skip shiftKey matching for shortcuts without Cmd/Alt modifiers
- Binary format detection by extension set -- consistent with existing sourceMap pattern

### Key Lessons
1. **External code review catches runtime correctness bugs that unit tests miss** -- Codex review found 3 bugs that only manifest in real browser contexts (ArrayBuffer, shiftKey, runtime toast wiring)
2. **TypeScript --noEmit should run in CI from day one** -- catches import path errors that don't surface until compilation
3. **MutationManager should own ALL side effects of mutations** -- toast, logging, analytics should all route through the mutation system, not be wired per-trigger
4. **Small focused milestones for bug fixes keep velocity high** -- 9 minutes total for 5 fixes vs context-switching overhead of folding into a larger milestone

### Cost Observations
- Model mix: ~90% sonnet (execution), ~10% opus (milestone planning)
- Sessions: ~1 (all 5 fixes in single session)
- Notable: 2 plans in 9 minutes total execution -- smallest and fastest milestone. External review input was the key catalyst.

---

## Milestone: v4.4 — UX Complete

**Shipped:** 2026-03-08
**Phases:** 4 | **Plans:** 10

### What Was Built
- Three-way light/dark/system theming with CSS custom property palettes, ThemeProvider, SwiftUI shell sync via WKUserScript FOWT prevention
- WCAG 2.1 AA accessibility: contrast-validated design tokens (70 assertions), MotionProvider, Announcer, skip-to-content link, ARIA landmarks, composite widget keyboard navigation across all 9 views
- Cmd+K command palette with fuzzy search, WAI-ARIA combobox pattern, dual-path search (instant commands + debounced FTS5 cards), recent commands persistence
- Sample data with 3 curated datasets, SampleDataManager, split-button welcome panel CTA, sync boundary IS NULL guard

### What Worked
- [data-theme] attribute approach maintained iOS 17.0 compatibility where CSS light-dark() would have required Safari 17.2
- Built-in fuzzy scorer (not fuse.js) kept bundle lean and prevented false positives from partial matches
- Composite widget pattern (single tabindex=0 on container) scaled cleanly to all 9 views with minimal per-view customization
- Theme research identified FOWT as a real risk -- WKUserScript at-document-start injection solved it cleanly
- Sample data source='sample' convention enabled surgical deletion, audit identification, AND sync filtering with a single column value

### What Was Inefficient
- v4.4 and v5.0 were planned as parallel milestones but executed sequentially -- the "parallel milestone" framing added complexity without benefit
- Accessibility phase required touching many files across all views -- horizontal concerns are inherently high-touch
- Command palette dual-path search needed a race condition guard -- could have been designed with cancellation from the start

### Patterns Established
- [data-theme] attribute pattern for cross-browser theme support (builds on CSS design token system from v4.2)
- Announcer pattern for centralized screen reader notifications (document.body-mounted for lifecycle safety)
- Composite widget keyboard navigation (single container tabindex, arrow keys within)
- Fuzzy scoring with word-boundary constraint for command search
- Source convention column values for multi-purpose data classification (audit, sync, deletion)

### Key Lessons
1. **Theme architecture must account for WKWebView context** -- native shell + web runtime dual theming requires script injection before CSS loads
2. **Accessibility is a horizontal concern** -- touches every view, every component; best done as dedicated phase, not sprinkled across feature work
3. **Command palette search benefits from cancellation-first design** -- async FTS5 results can arrive after palette closes or query changes
4. **Sample data needs explicit sync exclusion** -- IS NULL guard in SQL prevents NULL != 'sample' evaluation pitfall

### Cost Observations
- Model mix: ~90% sonnet (execution), ~10% opus (milestone planning)
- Sessions: ~2 (theme/accessibility/palette in session 1, sample data in session 2)
- Notable: 10 plans across 4 phases in ~1 day -- accessibility phase was most time-intensive due to cross-cutting nature

---

## Milestone: v5.0 — Designer Workbench

**Shipped:** 2026-03-08
**Phases:** 4 | **Plans:** 11

### What Was Built
- WorkbenchShell vertical panel stack replacing flat view layout, with CollapsibleSection reusable primitive, CommandBar, and ViewManager re-rooting
- PropertiesExplorer with LATCH-grouped columns, per-property toggles, inline rename via AliasProvider
- ProjectionExplorer with 4-well (available/x/y/z) DnD chip assignment, PAFVProvider aggregation (count/sum/avg/min/max), Z-plane controls
- VisualExplorer wrapping SuperGrid with vertical zoom rail slider bidirectionally synced to SuperPositionProvider
- LatchExplorers with 5 LATCH family filter sections (checkbox lists, time presets, text search) wired to FilterProvider
- NotebookExplorer v1 with textarea Write/Preview modes, DOMPurify XSS sanitization, GFM rendering, Cmd+B/I/K shortcuts

### What Worked
- Research identified ViewManager already accepts container via constructor config -- re-rooting was config change, not refactor
- Custom MIME type (text/x-projection-field) prevented DnD collision between ProjectionExplorer and existing SuperGrid/Kanban DnD
- Module-level DnD state avoided async dataTransfer.getData() limitations (consistent with existing SuperGrid dragPayload pattern)
- Single callback slot on SuperPositionProvider avoided 60fps pub/sub overhead for zoom sync
- D3 selection.join used for all repeated structures (properties rows, projection chips, LATCH checkboxes) maintaining INTG-03 compliance
- All explorer modules followed mount/update/destroy lifecycle -- consistent API made WorkbenchShell orchestration trivial

### What Was Inefficient
- CSS max-height: 500px needed override to 2000px for sections with real explorer content (should have used max-content from start)
- Undefined --bg-elevated token was never defined in design-tokens.css but used in projection-explorer -- caught in polish phase, should have been caught by CI
- Z-well axes stored locally until Plan 04 added PAFVProvider support -- temporary state management that could have been avoided with upfront provider design

### Patterns Established
- WorkbenchShell as thin DOM orchestrator (zero business logic, callback-based config)
- Overlays/toasts on document.body for z-index stacking above shell flex layout
- AliasProvider as orthogonal PersistableProvider (aliases independent of axis mapping state)
- writing-mode: vertical-lr + direction: rtl for cross-browser vertical slider
- DOMPurify strict allowlist for XSS prevention in WKWebView context
- Untyped config objects to avoid exactOptionalPropertyTypes conflicts with third-party types

### Key Lessons
1. **Thin orchestrators scale better** -- WorkbenchShell has zero business logic, making it trivial to extend with new sections
2. **Research that identifies existing extension points saves refactoring** -- ViewManager constructor config meant zero existing code changes for re-rooting
3. **Custom MIME types are the correct DnD collision solution** -- better than checking source element or using flags
4. **CSS token completeness should be CI-gated** -- undefined tokens that resolve to `initial` are silent failures
5. **Explorer-provider wiring via mount/update/destroy lifecycle creates consistent API** -- any new explorer fits the same pattern

### Cost Observations
- Model mix: ~90% sonnet (execution), ~10% opus (milestone planning)
- Sessions: ~3 (shell in session 1, explorers in session 2, notebook+polish in session 3)
- Notable: 11 plans across 4 phases in ~1 day -- all modules TDD, zero existing test regressions (all 2654 tests continue passing)

---

## Milestone: v5.1 — SuperGrid Spreadsheet UX

**Shipped:** 2026-03-08
**Phases:** 4 | **Plans:** 7 | **Sessions:** ~2

### What Was Built
- `--sg-*` design token family (9 structural tokens) and 7 semantic CSS classes replacing all inline visual styles
- Value-first plain text cell rendering with `+N` overflow badge and hover tooltip for multi-card cells
- 28px row index gutter column with sequential row numbers, sticky corner cell (z-index 4), and mode-aware visibility
- Active cell focus ring with row/column crosshair highlights, fill handle affordance, and independent `_activeCellKey` tracking
- Mode-scoped CSS overrides via `[data-view-mode]` for spreadsheet vs matrix visual differentiation

### What Worked
- CSS-first phase ordering (Phase 58 tokens/classes before TypeScript changes) meant later phases could reference established visual vocabulary
- gutterOffset pattern (0 or 1 applied to all gridColumn calculations) kept the header algorithm completely untouched while adding the gutter column
- Separation of appearance (CSS classes) vs layout (inline gridRow/gridColumn/sticky) created a clean rule: tokens control how things look, inline styles control where things go
- Each phase was small enough (1-2 plans) that wave execution completed quickly with zero rework

### What Was Inefficient
- SUMMARY.md `one_liner` field still not populated by executor agents -- summary-extract returns null, requiring manual `provides:` section parsing
- Phase 61 ROADMAP plan checkboxes not updated (show `[ ]` instead of `[x]`) despite plans being complete -- ROADMAP updater missed these

### Patterns Established
- CSS appearance vs inline layout separation rule: `sg-cell`/`sg-header` classes control visual properties; gridRow/gridColumn/sticky remain inline
- gutterOffset as additive column shift: a single offset value (0 or 1) applied to every gridColumn calculation -- header algorithm stays untouched
- cellKey string as lightweight active state: direct `dataset.key` comparison for O(1) lookup without maintaining a separate model object
- UNIT_SEP segment splitting for compound dimension key matching -- crosshair column identity extracted from stacked axis keys

### Key Lessons
1. **CSS token migration before TypeScript changes is the correct ordering** -- establishing visual vocabulary first means later code references stable class names
2. **Additive offset patterns preserve existing algorithms** -- gutterOffset shifted all column positions without modifying header spanning logic
3. **Real DOM elements over pseudo-elements for future interactivity** -- fill handle as real div enables future drag interaction without refactoring
4. **SUMMARY.md one_liner field remains unfilled** -- 15th milestone and still requiring manual parsing (NOTE: this has been flagged since v0.1)

### Cost Observations
- Model mix: ~95% sonnet (execution), ~5% opus (milestone planning)
- Sessions: ~2 (phases 58-60 in session 1, phase 61 + milestone in session 2)
- Notable: 7 plans across 4 phases in ~1 day -- all CSS + TypeScript changes TDD, zero existing test regressions

---

## Milestone: v5.2 — SuperCalc + Workbench Phase B

**Shipped:** 2026-03-10
**Phases:** 7 | **Plans:** 13 | **Sessions:** ~3

### What Was Built
- SQL-driven aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) via parallel `supergrid:calc` Worker query with CalcExplorer configuration panel
- Undo-safe Markdown formatting toolbar using contentEditable + execCommand trick (GitHub pattern)
- Per-card notebook persistence with 500ms debounced auto-save to ui_state, flush-on-switch, CloudKit checkpoint flow
- 4 D3 chart types (bar/pie/line/scatter) embedded in notebook Markdown preview via custom marked extension
- LATCH histogram scrubbers with d3.brushX drag-to-filter range selection for numeric/date fields
- Category chips with GROUP BY COUNT badges replacing checkbox lists for categorical filtering
- 4 Playwright E2E specs completing all 11 critical-path flows + critical sql.js bind param fix

### What Worked
- **SQL DSL over formula engine** — GROUP BY aggregation via Worker query replaced HyperFormula entirely, saving ~500KB bundle and avoiding unsolvable PAFV formula syntax
- **ui_state reuse for notebook persistence** — no schema migration, no new sync infrastructure, per-card keys just work
- **Two-pass DOMPurify + D3 mount** — XSS-safe chart rendering without expanding sanitizer allowlist; D3 mounts programmatically into placeholder divs
- **Atomic setRangeFilter()** — Map-based O(1) replacement prevents compounding range filters; compile order (axis → range → FTS) is correct
- **E2E specs caught a critical production bug** — db.prepare() for parameterized SQL in Worker context; db.exec()/db.run() silently ignore bind params
- **Parallel phase execution** — Phases 62, 63, 66, 67 had zero interdependencies; wave grouping allowed concurrent agent execution

### What Was Inefficient
- Phase 66 missing VERIFICATION.md — fast execution skipped formal verification step (caught by milestone audit)
- Phase 68 added as audit-triggered E2E phase — requirement IDs (E2E3-01..05) defined only in ROADMAP, not in REQUIREMENTS.md
- SUMMARY.md `one_liner` field still null in all summaries — 16th milestone and counting

### Patterns Established
- **CalcExplorer → SuperGrid setter wiring** — setCalcExplorer() for late binding when factory creates SuperGrid before CalcExplorer exists (same pattern as NotebookExplorer → SelectionProvider)
- **ChipDatum with GROUP BY COUNT** — single SQL round-trip per field for chip data; D3 button.latch-chip join for enter/update/exit
- **CASE WHEN bin index** — parameterized MIN/MAX/width in single SQL round-trip for histogram computation
- **Chart generation counter** — stale query guard discards results from concurrent filter changes
- **execCommand('insertText') for undo-safe textarea** — contentEditable trick preserves browser undo stack across all formatting operations

### Key Lessons
1. **db.prepare() is the only safe parameterized SQL path in Worker contexts** -- db.exec()/db.run() silently drop bind params; this bug went undetected through 5 milestones until E2E specs caught it
2. **Milestone audit catches process gaps that unit tests miss** -- missing VERIFICATION.md, orphaned requirement IDs, and pending visual verification were all flagged
3. **Parallel phase execution scales linearly when phases have zero interdependencies** -- 4 of 7 phases (62, 63, 66, 67) could run independently
4. **SUMMARY.md one_liner field STILL remains unfilled** -- 16th milestone, flagged since v0.1; summary-extract returns null for all files

### Cost Observations
- Model mix: ~95% sonnet (execution), ~5% opus (milestone planning/audit)
- Sessions: ~3 (planning + phases 62-64 in session 1, phases 65-68 in session 2, milestone completion in session 3)
- Notable: 13 plans across 7 phases in 2 days — 6.5 plans/day velocity

---

## Milestone: v5.3 — Dynamic Schema

**Shipped:** 2026-03-11
**Phases:** 5 | **Plans:** 12

### What Was Built
- SVG text CSS reset and deleted_at null safety bug fixes
- SchemaProvider runtime PRAGMA table_info introspection with LATCH heuristic classification
- Replaced all 15 hardcoded field lists across 8 files with dynamic SchemaProvider reads
- StateManager field migration for graceful degradation with unknown fields
- User-configurable LATCH family overrides with chip badge dropdown, disable/enable toggle, boot persistence

### What Worked
- **Setter injection pattern** — all 4 providers (SchemaProvider, StateManager, PAFVProvider, SuperDensityProvider) used setter injection to avoid breaking existing constructor call sites
- **(string & {}) type widening trick** — preserved IDE autocomplete for known fields while accepting dynamic schema fields at flow-through boundaries
- **Override-first accessor pattern** — `_latchOverrides.get(name) ?? c.latchFamily` gives users predictable override behavior with zero ambiguity
- **getAllAxisColumns for disabled field visibility** — separate accessor that includes disabled fields (with overrides applied) enabled PropertiesExplorer to show greyed-out fields in place without special-casing existing getAxisColumns
- **Sequential wave execution for dependent plans** — 73-01 → 73-02 → 73-03 dependency chain executed cleanly with each building on the prior

### What Was Inefficient
- SUMMARY.md `one_liner` field STILL null in all summaries — 17th milestone, flagged since v0.1
- Phase 70 plan checkboxes in ROADMAP.md not updated to [x] after execution (only caught during milestone archival)
- No milestone audit run before completion — proceeded based on 33/33 requirements checked

### Patterns Established
- **SchemaProvider as non-persistable provider** — PRAGMA-derived schema is read-only truth, not user state; override/disabled maps are separate Tier 2 persistence
- **Override + disabled as independent layers** — two separate maps on SchemaProvider with independent setters and persistence keys
- **Boot restore ordering** — overrides loaded from ui_state after setLatchSchemaProvider but before provider creation ensures correct initial state
- **Destroy+remount for structural UI changes** — LatchExplorers remounts on override change (acceptable for rare user-initiated events); ProjectionExplorer uses lighter update()

### Key Lessons
1. **Setter injection is the default for late-binding providers** — 4 instances in v5.3 confirm this as the standard pattern; constructor injection only when provider exists at construction time
2. **Type widening with (string & {}) preserves DX while enabling dynamism** — IDE autocomplete works for known fields, runtime validation handles dynamic ones
3. **Two accessor variants (filtered vs unfiltered) solve the disabled-field visibility problem** — getAxisColumns (excludes disabled) for functional consumers, getAllAxisColumns (includes disabled) for UI display

### Cost Observations
- Model mix: ~95% sonnet (execution), ~5% opus (milestone planning)
- Sessions: ~2 (planning + phases 69-72 in session 1, phase 73 + milestone completion in session 2)
- Notable: 12 plans across 5 phases in 1 day — 12 plans/day velocity (fastest milestone)

---

## Milestone: v6.0 — Performance

**Shipped:** 2026-03-13
**Phases:** 5 | **Plans:** 13 | **Sessions:** ~2

### What Was Built
- PerfTrace instrumentation utility with compile-time zero-cost gate across Worker Bridge, render, and ETL pipeline
- Vitest bench files measuring SQL, render, and ETL at 1K/5K/20K scale with BOTTLENECKS.md ranked evidence
- PerfBudget.ts typed constants derived from Phase 74 data; budget.test.ts and budget-render.test.ts as TDD red steps
- 6 covering/expression SQL indexes; event delegation; card_ids truncation; SuperGrid render optimizations
- batchSize=1000 (1.9x ETL uplift); WKWebView warm-up; debounced checkpoint; heap stability validation
- 4th CI bench job (11 assertions, soft gate with promotion procedure); Performance Contracts in PROJECT.md

### What Worked
- **Profile-first methodology** — measuring before optimizing prevented premature fixes; BOTTLENECKS.md ranked evidence ensured Phases 76/77 targeted real bottlenecks
- **TDD applied to performance** — failing budget tests in Phase 75 defined the "done" criteria for Phases 76/77; no ambiguity about what "fast enough" means
- **Phase dependency graph** — 74 gates 75, 75 gates 76/77 (independent), both gate 78; clean execution with no backtracking
- **Compile-time instrumentation gate** — `__PERF_INSTRUMENTATION__` Vite define means production pays zero cost for development tracing
- **Existing architecture held** — SQL indexes, event delegation, and batch size tuning required zero architectural changes

### What Was Inefficient
- **vitest bench v4 empty-samples bug** — significant time lost discovering forks pool returns empty benchmark samples in `--run` mode; had to fall back to `it() + performance.now()`
- **SUMMARY.md one_liner field still missing** — the summary-extract tool returned null for all 13 summaries; manual extraction needed for accomplishments (recurring issue since v0.1)
- **SQL budget tests CPU contention** — budget assertions pass in isolation but fail in full-suite parallel runs; pre-existing issue not related to v6.0 work but noted as recurring friction
- **jsdom render timing floor** — jsdom is 8-15x slower than Chrome for DOM operations, requiring large multiplier constants that reduce test sensitivity

### Patterns Established
- **PerfTrace/PerfBudget co-located in src/profiling/** — trace instrumentation and budget constants in the same module
- **CI bench job soft-to-hard promotion** — 3 consecutive green runs on main before enforcing as blocking gate
- **Performance Contracts in PROJECT.md** — locked table format with measured baseline / CI budget / Chrome estimate / source constant columns
- **Relative baselines only** — CI runner variance (±30-40%) makes absolute ms thresholds unreliable; `.benchmarks/main.json` committed for relative comparison

### Key Lessons
- **Measure before you optimize** — Phase 74's ranked bottleneck list changed optimization priorities (batch size mattered more than FTS; event delegation mattered more than DOM count)
- **Budget tests as TDD red step** — intentionally failing tests in Phase 75 made Phase 76/77 optimization work goal-directed, not open-ended
- **Compile-time gates enable permanent instrumentation** — PerfTrace hooks remain in source code permanently; `__PERF_INSTRUMENTATION__` means they cost nothing in production

### Cost Observations
- Model mix: ~95% sonnet (execution), ~5% opus (milestone planning)
- Sessions: ~2 (phases 74-76 in session 1, phases 77-78 + milestone completion in session 2)
- Notable: 13 plans across 5 phases in 2 days — 6.5 plans/day velocity

---

## Milestone: v7.1 — Notebook Card Editor

**Shipped:** 2026-03-19
**Phases:** 4 (91-94) | **Plans:** 8

### What Was Built
- MutationManager.editCard with shadow-buffer undo safety for inline title/content editing
- Start-typing card creation: first keydown in empty card editor triggers addCard
- Typed property inputs for all 26 schema fields (date, number, tag tokenizer, dropdown)
- CSS-driven card dimension rendering in Notebook panel preview

### What Worked
- Shadow-buffer pattern: snapshot before edit, undo restores entire card atomically
- Typed property inputs reuse existing SchemaProvider field metadata

### What Was Inefficient
- None significant — small focused milestone

### Key Lessons
- Card editor needs undo granularity at the field level, not just card level (acceptable for v7.1 scope)

---

## Milestone: v7.2 — Alto Index + DnD Migration

**Shipped:** 2026-03-21
**Phases:** 2 (95-96) | **Plans:** 5

### What Was Built
- Alto Index import adapter for 11 subdirectory types with YAML frontmatter parsing
- ETL load test harness (15 assertions + 20K-card full-scale test)
- Projection Explorer pointer DnD (chip drag between X/Y wells)
- SuperGrid axis grip pointer DnD (same-dimension reorder + cross-dimension transpose)
- KanbanView card drag migrated to pointer events
- Native file import bridge handler + Kanban horizontal column CSS layout

### What Worked
- Pointer events pattern established in Phase 95 (Projection Explorer) scaled cleanly to SuperGrid and KanbanView
- Gap closure cycle (verify → diagnose → plan → fix) caught 5 real issues that initial implementation missed
- _lastReorderTargetIndex fallback was the key insight — pointer rarely lands on 6px drop zone at pointerup

### What Was Inefficient
- Phase 95 was pure documentation retrofit — the code shipped ad-hoc before GSD tracking. Retrofitting planning docs after the fact is lower-value than planning before
- Three gap closure rounds needed (96-03, 96-04, 96-05) suggests initial plans 96-01/96-02 under-scoped edge cases

### Patterns Established
- Pointer events > HTML5 DnD for all WKWebView drag surfaces (decision D-012 candidate)
- Drop zone enlargement during active drag (40px) with pointer-events toggle
- Same-dimension reorder via midpoint index tracking (no drop zone hit needed)

### Key Lessons
- WKWebView intercepts HTML5 dragstart — pointer events are the only reliable path for drag in native shell
- 6px drop zones are too small for reliable user targeting — enlarge during active drag, restore after
- Gap closure is valuable but expensive — better to catch edge cases in initial UAT

### Cost Observations
- Model mix: 100% sonnet
- Sessions: ~2
- Notable: 5 plans across 2 phases in 2 days

---

## Milestone: v9.3 — View Wiring Fixes

**Shipped:** 2026-03-27
**Phases:** 3 (127-129) | **Plans:** 6

### What Was Built
- SuperGrid data path repaired: FetchDataResult pattern derives combinations from query results, two-state empty states, SuperCalcFooter styling
- TimelineView contextual empty state, today-line marker, swimlane background rects
- NetworkView + AlgorithmExplorer wiring verified functional without code changes
- All 9 views confirmed rendering through ViewManager with consistent empty state typography
- Cross-view switching tests (CVUX-01/02) covering sidebar, keyboard, and command palette paths

### What Worked
- Diagnostic-first approach: each phase started with test-driven investigation before assuming what was broken
- Phase 128-02 and 129-01 discovered that most views were already working correctly — no unnecessary code changes made
- UI-SPEC typography contract (--text-lg/--text-base) caught inconsistency between PivotTable inline tokens and views.css
- Milestone audit correctly identified the 2 tech debt items (typography divergence, test coverage gap) as low severity

### What Was Inefficient
- Phase 127-02 was scoped as a full SuperCalcFooter rebuild but actual changes were just CSS styling fixes — could have been a single task in Phase 127-01
- ROADMAP still contained Phase Details for Phases 120-126 (from v9.1/v9.2) that should have been cleaned up in those milestones

### Patterns Established
- FetchDataResult return type pattern — adapters extract unique combinations from query result keys, not static HeaderDimension.values
- Contextual empty state ownership: PivotTable owns SuperGrid empty state (no-axes vs no-data), TimelineView owns due_at empty state (hides SVG, shows DOM panel)
- ViewManager VIEW_EMPTY_MESSAGES per-view icon/heading/description for consistent empty states across all 9 views

### Key Lessons
- When investigating view rendering bugs, verify the data path works BEFORE assuming the view is broken — most of the 9 views were already correct
- Empty state ownership should be at the data-aware layer (PivotTable, not PivotGrid; TimelineView internal filter, not ViewManager)
- Smallest milestone scope (3 phases, 6 plans, 2 days) remains the most efficient — diagnose precisely, fix surgically

### Cost Observations
- Model mix: ~80% sonnet, ~20% haiku (no opus needed for fix-oriented milestone)
- Sessions: 2
- Notable: Phase 128-02 and 129-01 completed with zero code changes needed — pure verification

---

## Milestone: v11.1 — Dock/Explorer Inline Embedding

**Shipped:** 2026-04-17
**Phases:** 9 (145-154, Phase 150 deferred) | **Plans:** 13

### What Was Built
- DockNav 48px vertical icon strip replacing SidebarNav with verb-noun taxonomy (Integrate/Visualize/Analyze/Activate/Help), 3-state collapse (Hidden/Icon-only/Icon+Thumbnail), CSS animation, ARIA tablist, VoiceOver announcements
- MinimapRenderer with lazy 96×48 per-view thumbnails, loupe overlay with click-to-jump and drag-to-pan
- Explorer decoupling: all 8 explorers render in main panel; Maps/Formulas/Stories as stub dock entries
- PanelDrawer fully removed; vertical stack layout with top-slot and bottom-slot inline embedding containers
- Data Explorer + Properties Explorer toggle above active view; Projections Explorer auto-shown for SuperGrid only
- LATCH Filters + Formulas Explorer toggle below active view with cross-view filter persistence
- Regression guard: 210 files / 4342 tests green, 10 seam tests + 6 E2E Playwright specs

### What Worked
- v11.0 and v11.1 split was effective — v11.0 handled the navigation infrastructure (dock, collapse, thumbnails, decoupling) while v11.1 handled the layout transformation (PanelDrawer removal, inline embedding). Clear dependency chain prevented rework
- syncTopSlotVisibility/syncBottomSlotVisibility pattern (check if any child display !== 'none', set parent accordingly) kept the slot containers self-managing — no central state needed
- Lazy-mount pattern for explorers avoided DOM churn — create once on first toggle, then show/hide via display property
- Phase 154 regression guard as final phase caught 3 pre-existing test issues (sql.js worktree symlink, heap-cycle memory sensitivity, alto-index timeout) that had been silently accumulating

### What Was Inefficient
- Phase 150 (iOS Stories Splash) was planned as part of v11.0 but required a product decision about platform split (iOS vs macOS) that hadn't been made. This left a gap in the phase numbering and a deferred phase cluttering the roadmap. Better to have excluded it from scope entirely until the decision was made
- REQUIREMENTS.md traceability table had all entries as "Pending" status even after phases shipped — the automated tooling wasn't updating traceability rows. VIZ-01/02/03 appeared unchecked despite being implemented in Phase 152

### Patterns Established
- Inline embedding pattern: dock toggles control child display, sync function checks any-child-visible, parent slot follows. Reusable for future explorer additions
- Section-defs.ts as single source of truth for all dock section/item key constants — prevents string literal drift across DockNav, main.ts, and tests
- `data-section-key` + `data-item-key` attributes on dock buttons enable both CSS styling and E2E locator targeting

### Key Lessons
- Navigation infrastructure should be a separate milestone from layout transformation — mixing them risks scope creep
- Regression guard phases at milestone end are high-value: they catch accumulated test drift and provide confidence for archival
- Deferred phases should be moved to a backlog section rather than staying in the active roadmap as numbered phases

---

## Milestone: v13.0 — SuperWidget Substrate

**Shipped:** 2026-04-21
**Phases:** 5 (162-166) | **Plans:** 11

### What Was Built
- SuperWidget four-slot CSS Grid container (header, canvas, status, tabs) with --sw-* token namespace and mount/destroy lifecycle
- Pure projection state machine — Projection type with 5 transition functions enforcing strict reference equality contract
- commitProjection rendering with canvas lifecycle (validate → destroy-before-mount → slot-scoped updates)
- Three CanvasComponent stubs (Explorer/View/Editor) behind registry plug-in seam with zero concrete references from SuperWidget
- 10 cross-seam Vitest integration tests + Playwright WebKit CI smoke test covering full projection-to-DOM path
- 159 superwidget tests across 9 files, 33/33 requirements

### What Worked
- Research phase for projection state machine (Phase 163) prevented premature implementation — the reference equality contract emerged from research, not as an afterthought
- Registry plug-in seam (CANV-06) enforced via readFileSync source assertion in tests — mechanical verification stronger than code review
- Standalone HTML harness for Playwright WebKit smoke avoids main app boot overhead — component-level E2E is faster and more reliable
- Single-day milestone execution (5 phases in ~10 hours) — well-scoped, orthogonal phases with clear dependency chain

### What Was Inefficient
- Phase 165 Plan 3 (integration wiring) needed to be created after Plan 2 discovered that CanvasFactory didn't pass CanvasBinding — this was predictable from the Projection type definition and could have been caught during Phase 165 planning
- SUMMARY.md frontmatter requirements-completed field inconsistently populated (164-02 and 166-01 missing) — causes false "partial" in 3-source audit cross-reference

### Patterns Established
- CanvasFactory injection pattern: SuperWidget constructor takes a factory function, never concrete implementations — enables v13.1+ real canvas replacement without touching SuperWidget.ts
- ZONE_LABELS as module-level const map: simpler than static class property, no `this` binding issues
- Standalone HTML harness for component-level Playwright E2E: `window.__sw` API pattern reusable for future component smoke tests

### Key Lessons
42. **Reference equality as render optimization contract** — pure functions returning input reference on no-op enables O(1) bail-out in commitProjection; this must be documented as load-bearing, not an implementation detail (verified v13.0, new pattern)
43. **Registry abstraction with source-level enforcement** — readFileSync + grep assertions on production source files catch import leaks that TypeScript's type system cannot (verified v13.0, builds on v8.3 PluginLifecycleCompleteness guard)
44. **Standalone HTML harness for component E2E** — faster, more reliable, and more focused than booting the full app; `window.__sw` API pattern makes Playwright specs readable (verified v13.0, new pattern)

---

## Milestone: v13.1 — Data Explorer Canvas

**Shipped:** 2026-04-21
**Phases:** 4 (167-170) | **Plans:** 8

### What Was Built
- ExplorerCanvas production CanvasComponent wrapping DataExplorerPanel with mount/destroy lifecycle
- 3-tab system (Import/Export, Catalog, DB Utilities) driven by Projection state via commitProjection
- Live status slot showing card count, connection count, last import timestamp — slot-scoped updates only
- 8 cross-seam Vitest integration tests + Playwright WebKit E2E smoke with dedicated explorercanvas-harness.html

### What Worked
- Entire milestone shipped in a single day (4 phases, 8 plans) — clean dependency chain with no blockers
- Separate explorercanvas-harness.html avoided v13.0 INTG-07 regression (lesson 44 from v13.0 applied immediately)
- CANV-06 abstraction contract preserved through all 4 phases — SuperWidget.ts never imported ExplorerCanvas
- statusSlot.ts as standalone module with 3 pure functions — easy to test, wire, and verify slot-scoped isolation

### What Was Inefficient
- Some SUMMARY.md one-liners from extractors were malformed (168/169 returned partial or rule-reference text instead of clean one-liners)
- Phase 170 plans were highly prescriptive (exact code blocks in plan) — for a test-only phase this worked well, but the same approach for implementation phases would over-constrain

### Patterns Established
- Tab system via Projection state: `activeTabId` on Projection + CSS `.active` class toggle + `onProjectionChange` CanvasComponent extension — reusable for View and Editor canvases
- Status slot standalone module pattern: `render` + `update` + `format` pure functions, wired through a single `refreshDataExplorer()` callsite
- Dedicated E2E harness per canvas type (separate from v13.0 superwidget-harness.html) — prevents cross-canvas regression

### Key Lessons
45. **Tab switching via Projection state is cheaper than destroy/remount** — CSS `.active` class toggle with `onProjectionChange` callback avoids full canvas lifecycle cost while maintaining Projection as single source of truth (verified v13.1, builds on v13.0 commitProjection pattern)
46. **Slot-scoped DOM updates prove SuperWidget's 4-slot architecture** — status slot updates tested to not increment canvasEl renderCount, validating that slots are truly independent (verified v13.1, validates v13.0 architectural bet)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v0.1 | ~2 | 2 | Established TDD workflow, yolo mode |
| v0.5 | ~4 | 3 | Provider/view pipeline, interface extraction for testability |
| v1.0 | ~3 | 2 | Parallel phase execution, Worker-hosted compute patterns |
| v1.1 | ~4 | 3 | Integration seam (CanonicalCard) enables max parser parallelism |
| v2.0 | ~3 | 4 | Cross-language bridge (Swift<>JS), actor-based persistence, five-concern boundary |
| v3.0 | ~6 | 13 | Narrow interface pattern, rAF coalescing, CSS Custom Property zoom, 35 plans in 2 days |
| v4.0 | ~2 | 4 | Additive-only native adapters, MockAdapter-first validation, link card prefix convention |
| v3.1 | ~3 | 5 | keys.ts single source of truth, no-notify layout state, deepest-wins render-time suppression, milestone pause/resume |
| v4.1 | ~2 | 5 | Data windowing virtual scroll, BatchSnapshot for Swift 6, unwrapped send for sync echo prevention, CloudKit record sync |
| v4.2 | ~2 | 6 | CSS design token system, ShortcutRegistry centralization, parallel phase execution (4x), ETL validation matrix, CI pipeline |
| v4.3 | ~1 | 1 | External code review input, fix-first then cleanup, smallest focused milestone (9 min execution) |
| v4.4 | ~2 | 4 | Horizontal accessibility phase, theme architecture with FOWT prevention, composite widget pattern, source convention values |
| v5.0 | ~3 | 4 | Thin orchestrator pattern, mount/update/destroy lifecycle, custom MIME DnD collision prevention, DOMPurify XSS |
| v5.1 | ~2 | 4 | CSS-first phase ordering, gutterOffset additive pattern, appearance vs layout style separation |
| v5.2 | ~3 | 7 | SQL DSL over formula engine, db.prepare() fix via E2E, parallel independent phases, histogram brush filtering |
| v5.3 | ~2 | 5 | Setter injection pattern, (string & {}) type widening, override-first accessor, getAllAxisColumns for disabled visibility |
| v6.0 | ~2 | 5 | Profile-first methodology, PerfBudget TDD, compile-time instrumentation gate, CI bench soft-to-hard promotion |
| v6.1 | ~3 | 6 | Anti-patching rule, realDb/makeProviders factory pattern, domain-subdirectory seam tests, jsdom+WASM per-file annotation |
| v7.0 | ~3 | 6 | UAT-driven bug fixes, dataset eviction, 8-section sidebar, ViewZipper auto-cycle, named themes |
| v7.1 | ~2 | 4 | Shadow-buffer undo safety, start-typing card creation, typed property inputs |
| v7.2 | ~2 | 2 | Alto-index retrofit, pointer events DnD migration for WKWebView |
| v8.0 | ~3 | 4 | Figma-first plugin architecture, FeatureCatalog + PluginRegistry, 14 initial plugins |
| v8.1 | ~2 | 2 | Zero stubs, parallel wave plugin implementation, registerCatalog() migration |
| v8.2 | ~1 | 1 | NullMode/CountMode/ScopeMode, AggResult structured return |
| v8.3 | ~2 | 4 | makePluginHarness shared infrastructure, 27-plugin lifecycle, Playwright E2E CI gate |
| v8.4 | ~1 | 1 | ViewZipper removed, SidebarNav sole view-switch, crossfade unified |
| v8.5 | ~2 | 5 | ETL E2E infrastructure, 4 import surface coverage, TCC lifecycle |
| v9.0 | ~3 | 6 | graphology algorithms in Worker, SchemaProvider metric injection, NetworkView encoding |
| v9.1 | ~2 | 3 | FeatureGate hardening, SuperGrid convergence (PivotGrid replaces monolith) |
| v9.2 | ~2 | 4 | Directory auto-discovery, dataset partitioning, diff-preview re-import |
| v9.3 | ~2 | 3 | Diagnostic-first view debugging, FetchDataResult pattern, verify-before-fixing approach |
| v13.0 | ~2 | 5 | Reference equality contract, registry abstraction, standalone E2E harness pattern |
| v13.1 | ~1 | 4 | Tab-via-Projection, slot-scoped updates, dedicated per-canvas E2E harness |

### Cumulative Quality

| Milestone | Tests | LOC | Deviations |
|-----------|-------|-----|------------|
| v0.1 | 151 | 3,378 TS | 5 auto-fixed (all Rule 1/3) |
| v0.5 | 774 | 20,468 TS | jsdom workarounds (DragEvent, parseSvg, clientWidth) |
| v1.0 | 897 | 24,298 TS | @vitest/web-worker shared module state workaround |
| v1.1 | ~1,433 | 70,123 TS | xlsx version downgrade (0.20.3 -> 0.18.5), timestamp determinism fix |
| v2.0 | ~1,433 + 14 XC | 34,211 TS + 2,573 Swift | Worker race condition fix, db:query type addition, macOS sheet sizing |
| v3.0 | 1,893 | ~20,608 TS + 2,573 Swift | Phase 19/21 gap closures, PLSH-01 jsdom adaptation, PLSH-05 context menu fix |
| v4.0 | 1,893 + 19 XC | 21,467 TS + 6,103 Swift | SwiftProtobuf version mismatch, JSONEncoder nil-skipping fix, WebBundle rebuild |
| v3.1 | ~2,037 | ~21,962 TS + 6,103 Swift | Deepest-wins aggregate injection refactor, 4 auto-fixes in Plan 32-02, ROADMAP formatting drift |
| v4.1 | ~2,037+ | 23,535 TS + 7,166 Swift | 3 Swift 6 concurrency auto-fixes in 39-02, CKSyncEngine.fetchChanges() async throws discovery, scrollTop overflow clamp |
| v4.2 | ~2,100+ | 24,336 TS + 7,270 Swift | DedupEngine NULL via_card_id fix, Biome lint drift post-Phase 42, ViewSwitchReceiver type-checker timeout fix |
| v4.3 | ~2,405 | 27,065 TS + 7,270 Swift | Excel ArrayBuffer fix, ? shiftKey bypass, ParsedFile import fix, Biome zero-diagnostic gate |
| v4.4 | ~2,600+ | ~29,000 TS + 7,312 Swift | Zero regressions across theme/accessibility/palette horizontal changes |
| v5.0 | ~2,700+ | 30,385 TS + 7,312 Swift | Zero existing test regressions (all 2654 passing), 6 new explorer modules |
| v5.1 | ~2,800+ | 30,762 TS + 7,312 Swift + 2,848 CSS | Zero regressions, 5 ACEL + RGUT + VFST tests added, CSS token completeness |
| v5.2 | 3,158 | ~90.9K TS + 7.4K Swift + 3.9K CSS | Critical db.prepare() bind param fix, Phase 66 missing VERIFICATION.md |
| v5.3 | 3,180+ | ~36K TS src + ~55K TS tests + 3.2K CSS + 7.4K Swift | Zero regressions, 22 new Phase 73 tests, no milestone audit |
| v6.0 | 3,200+ | ~36.5K TS src + ~57.4K TS tests + 3.3K CSS + 7.4K Swift | vitest bench empty-samples workaround, SQL budget CPU contention |
| v6.1 | 3,200+ | ~36.9K TS src + ~61K TS tests + 3.4K CSS + 7.4K Swift | Zero production regressions, 2,767 LOC seam tests added |

| v7.0 | 3,200+ | ~39K TS src + ~62K TS tests + 3.4K CSS + 7.4K Swift | UAT-driven bug fixes before feature work, zero regressions |
| v7.1 | 3,200+ | ~41K TS src + ~63K TS tests + 3.5K CSS + 7.4K Swift | Shadow-buffer undo safety for inline editing |
| v7.2 | 3,200+ | ~44K TS src + ~66K TS tests + 3.6K CSS + 7.3K Swift | Pointer events universal WKWebView compatibility |
| v8.0 | 3,200+ | ~47K TS src + ~68K TS tests + 6.0K CSS + 7.3K Swift | 14 plugin factories, Figma-first design, 199 pivot tests |
| v8.1 | 3,200+ | ~48K TS src + ~70K TS tests + 6.2K CSS + 7.3K Swift | Zero stubs, 70 new behavioral tests, 4-way parallel execution |
| v8.2 | 3,200+ | ~48K TS src + ~71K TS tests + 6.2K CSS + 7.3K Swift | NullMode/CountMode/ScopeMode, AggResult structured return |
| v8.3 | 3,200+ | ~49K TS src + ~72K TS tests + 6.2K CSS + 7.3K Swift | 15 Playwright E2E specs, 4 production bugs found |
| v8.4 | 3,200+ | ~49K TS src + ~72K TS tests + 6.2K CSS + 7.3K Swift | ViewZipper removed, zero regressions |
| v8.5 | 3,200+ | ~50K TS src + ~73K TS tests + 6.2K CSS + 7.3K Swift | ETL E2E infrastructure, TCC lifecycle tests |
| v9.0 | 3,200+ | ~52K TS src + ~74K TS tests + 6.3K CSS + 7.4K Swift | 6 graph algorithms, Playwright E2E guard |
| v9.1 | 3,200+ | ~53K TS src + ~75K TS tests + 6.3K CSS + 7.4K Swift | SuperGrid convergence, FeatureGate production hardening |
| v9.2 | 3,200+ | ~54K TS src + ~76K TS tests + 6.3K CSS + 7.4K Swift | Directory discovery, dataset lifecycle |
| v9.3 | 3,200+ | ~124K TS + ~12K Swift + ~7.6K CSS | Zero regressions, 18/18 reqs verified, 3 low-severity tech debt |
| v13.0 | 3,200+ | ~52K TS src + ~73K TS tests + ~7.4K CSS + ~12K Swift | 159 superwidget tests, 33/33 reqs, Playwright CI gate |
| v13.1 | 3,200+ | ~53K TS src + ~77K TS tests + ~7.6K CSS + ~24K Swift | 206+ superwidget tests, 13/13 reqs, zero regressions |

### Top Lessons (Verified Across Milestones)

1. **TDD catches environment issues** — Vitest API changes, jsdom limitations, D3 parseSvg, @vitest/web-worker, PapaParse BOM, SheetJS dates, Worker WASM race condition (verified v0.1-v2.0)
2. **Pre-declaring exports prevents cross-plan conflicts** (verified v0.1-v1.1)
3. **Interface extraction enables testable architecture** — MutationBridge, WorkerBridgeLike, PAFVProviderLike, WeakScriptMessageHandler (verified v0.5-v2.0)
4. **SUMMARY.md files need a structured `one_liner` field** — manual extraction is error-prone (noted in ALL 7 milestones: v0.1-v4.0)
5. **Gap closure plans are most effective when surgical** — test-only changes (verified v1.0)
6. **Integration seam types should be built FIRST** — CanonicalCard (v1.1), native:action kind discriminator (v2.0), NativeImportAdapter protocol (v4.0)
7. **Research flags resolved upfront prevent implementation surprises** — P22-P25 (v1.1), WASM MIME gating risk and scenePhase unreliability (v2.0)
8. **Five-concern boundaries prevent scope creep** — Swift's role defined precisely as 5 concerns kept v2.0 focused and fast (verified v2.0)
9. **Narrow interfaces are the key to testing complex views** — SuperGrid proved 6 narrow `*Like` interfaces enable 10-line test mocks (verified v3.0, builds on v0.5 interface extraction)
10. **rAF coalescing should be default for Worker methods called from StateCoordinator** — 4+ provider callbacks fire synchronously in 16ms batch (verified v3.0)
11. **Research constraints that would be architectural pivots must be identified upfront** — v3.0 identified 7 constraints preventing rewrites during execution (verified v3.0, builds on v1.1/v2.0 research lessons)
12. **MockAdapter-first validation catches cross-language interop bugs** — Swift JSONEncoder nil-skipping, type mismatches discovered before real data involved (verified v4.0)
13. **Additive-only architecture scales** — v4.0 added 3 native adapters with zero TypeScript ETL pipeline changes (verified v4.0, builds on v1.1 CanonicalCard seam)
14. **Copy-then-read is mandatory for live system databases** — WAL-mode databases written by system apps cannot be opened directly (verified v4.0)
15. **Layout-only state uses no-notify accessors** — collapse, colWidths, and similar layout state skip _scheduleNotify to avoid unnecessary Worker re-queries (verified v3.1, builds on v3.0 colWidths pattern)
16. **Aggregate injection must iterate the collapsed set, not header cells** — buildHeaderCells removes deeper cells when parent collapsed (verified v3.1)
17. **Milestone pause/resume works cleanly when phase boundaries are respected** -- v3.1 paused at Phase 30, v4.0 inserted Phases 33-36, v3.1 resumed at Phase 31 with zero rework (verified v3.1)
18. **Data windowing is the only correct virtual scrolling for D3** -- DOM virtualization breaks exit/enter lifecycle; filter data before join (verified v4.1)
19. **BatchSnapshot pattern for Swift 6 strict concurrency with CKSyncEngine** -- actor-isolated state captured into Sendable struct before synchronous closure (verified v4.1)
20. **Unwrapped send prevents sync echo loops** -- capture bridge.send before mutation hook wraps it; sync merger uses original unwrapped path (verified v4.1)
21. **CSS overlay (not provider) for visual-only toggles** -- audit toggle changes CSS class, no Worker re-query needed (verified v4.1, builds on v3.0 SuperDensity hybrid routing)
22. **External code review catches runtime correctness bugs that unit tests miss** -- Codex review found 3 bugs (ArrayBuffer, shiftKey, toast wiring) that only manifest in real browser contexts (verified v4.3)
23. **MutationManager should own ALL mutation side effects** -- toast, logging, analytics route through mutation system via interface, not per-trigger wiring (verified v4.3, builds on v0.5 MutationManager pattern)
24. **Accessibility is a horizontal concern best done as a dedicated phase** -- touching every view is unavoidable; focused phase prevents cross-cutting changes from destabilizing feature work (verified v4.4)
25. **Thin orchestrators with callback-based config scale to N sections** -- WorkbenchShell has zero business logic, making extension trivial (verified v5.0)
26. **Research identifying existing extension points saves refactoring** -- ViewManager constructor config meant zero existing code changes for re-rooting (verified v5.0, builds on v3.0 research constraint lesson)
27. **Custom MIME types solve DnD collision between independent drag systems** -- text/x-projection-field prevents ProjectionExplorer chips from being interpreted as KanbanView or SuperGrid drags (verified v5.0)
28. **mount/update/destroy lifecycle creates composable UI modules** -- any new explorer fits the pattern with zero orchestrator changes (verified v5.0, builds on v4.2 CustomEvent decoupling pattern)
29. **CSS token migration before TypeScript changes is the correct ordering** -- establishing visual vocabulary (classes + tokens) first means later phases reference stable names without churn (verified v5.1, builds on v4.2 design token system)
30. **Additive offset patterns preserve existing algorithms** -- gutterOffset shifted all column positions without modifying header spanning logic; same philosophy as gutterOffset for row index (verified v5.1, builds on v3.1 non-destructive reorder pattern)
31. **db.prepare() is the ONLY safe parameterized SQL in Worker contexts** -- db.exec()/db.run() silently ignore bind params; this went undetected through 5 milestones until E2E specs caught it (verified v5.2, builds on v0.1 db.prepare() decision)
32. **E2E specs catch production bugs that unit tests miss** -- unit tests use mocked bridge; E2E specs exercise the full Worker → sql.js → DOM pipeline (verified v5.2, builds on v4.3 external review lesson)
33. **SQL DSL beats formula engines for PAFV aggregation** -- GROUP BY via Worker query is simpler, faster, and avoids ~500KB bundle; formula syntax for PAFV coordinates was unsolvable (verified v5.2, permanently validates v3.0 SuperCalc deferral)
34. **Profile-first methodology prevents premature optimization** -- measuring all 4 domains before fixing ensured optimization targeted real bottlenecks (batch size > FTS, event delegation > DOM count) (verified v6.0)
35. **Budget tests as TDD red step for performance** -- intentionally failing tests in Phase 75 made optimization phases goal-directed, not open-ended (verified v6.0, builds on v0.1 TDD enforcement)
36. **Compile-time instrumentation gates enable permanent tracing** -- PerfTrace hooks stay in source; __PERF_INSTRUMENTATION__ define means zero production cost (verified v6.0)
37. **Test factories are worth a dedicated phase** -- realDb() + makeProviders() eliminated per-test boilerplate across 80+ seam tests, making subsequent phases dramatically faster (verified v6.1, builds on v1.1 CanonicalCard seam type lesson)
38. **Anti-patching rule catches real production behavior** -- never weakening assertions forced understanding of SQLite LIKE ASCII-only case sensitivity, GROUP_CONCAT ordering, FTS trigger timing (verified v6.1, builds on v0.1 TDD enforcement)
39. **Regression guards validate architectural stability** -- density seams confirmed coordinator propagation worked correctly before optimization, providing confidence for v7.0 (verified v6.1, builds on v6.0 profile-first methodology)
40. **registerCatalog() closure creates natural shared state scope** -- sibling plugins that need coordination get their shared state from the same closure, avoiding global singletons and external state managers (verified v8.1, builds on v8.0 shared state pattern)
41. **Parallel execution at plan level works when categories own distinct files** -- 4 simultaneous agents writing to separate plugin/test files with minimal shared-file contention (verified v8.1, builds on v8.0 Wave-based parallel execution)
