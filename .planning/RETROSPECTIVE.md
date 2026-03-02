# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v0.1 | ~2 | 2 | Established TDD workflow, yolo mode |
| v0.5 | ~4 | 3 | Provider/view pipeline, interface extraction for testability |
| v1.0 | ~3 | 2 | Parallel phase execution, Worker-hosted compute patterns |
| v1.1 | ~4 | 3 | Integration seam (CanonicalCard) enables max parser parallelism |

### Cumulative Quality

| Milestone | Tests | LOC | Deviations |
|-----------|-------|-----|------------|
| v0.1 | 151 | 3,378 | 5 auto-fixed (all Rule 1/3) |
| v0.5 | 774 | 20,468 | jsdom workarounds (DragEvent, parseSvg, clientWidth) |
| v1.0 | 897 | 24,298 | @vitest/web-worker shared module state workaround |
| v1.1 | ~1,433 | 70,123 | xlsx version downgrade (0.20.3 → 0.18.5), timestamp determinism fix |

### Top Lessons (Verified Across Milestones)

1. TDD catches framework API changes and environment issues (Vitest API, jsdom limitations, D3 parseSvg, @vitest/web-worker, PapaParse BOM, SheetJS dates)
2. Pre-declaring exports prevents cross-plan conflicts
3. Interface extraction (MutationBridge, WorkerBridgeLike, PAFVProviderLike) is the key enabler for testable architecture
4. SUMMARY.md files need a structured `one_liner` field — manual extraction is error-prone (noted in v0.1, v0.5, v1.0, v1.1 — all 4 milestones)
5. Gap closure plans are most effective when surgical (test-only changes) — v1.0 Phase 3 gap closed in 158 seconds with zero production code changes
6. Integration seam types (CanonicalCard) should be built FIRST — they unblock all parallel work streams (verified v1.1)
7. Research flags resolved upfront prevent implementation surprises — all 4 critical pitfalls (P22-P25) caught pre-coding (verified v1.1)
