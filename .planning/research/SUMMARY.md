# Project Research Summary

**Project:** Isometry v5
**Domain:** Local-first polymorphic data projection platform (TypeScript/D3.js, WKWebView)
**Researched:** 2026-02-27
**Confidence:** HIGH — architecture is fully specified in canonical docs; stack research verified via official sources; pitfalls confirmed via issue trackers and SQLite forum

## Executive Summary

Isometry v5 is a local-first data projection platform where a single SQLite dataset renders through PAFV (Plane-Axis-Facet-View) spatial projection as nine different views — grid, kanban, network, timeline, and more — with zero serialization between the database and the visualization layer. The core insight is that switching views changes the SQL projection, not the data. Research confirms this architecture is sound and achievable with vanilla TypeScript + D3.js + sql.js running in a Web Worker inside a WKWebView native shell. There are no fundamental blockers, but there are three non-negotiable infrastructure requirements: a custom sql.js WASM build to enable FTS5, a Swift `WKURLSchemeHandler` to serve assets with correct MIME types, and a precise FTS5 three-trigger pattern to prevent silent index corruption.

The recommended build sequence follows a strict dependency graph: database schema first, CRUD and query functions second, Worker Bridge third, then Providers and ETL in parallel, then D3 views, and finally the native shell wrapper. This ordering is not stylistic — it reflects hard dependencies. Providers cannot compile SQL without the allowlist infrastructure, views cannot render without Providers and the Bridge, and ETL cannot import without both the CRUD layer and the Bridge. The architecture deliberately eliminates parallel state (no Redux/MobX/Zustand) by making D3's data join the state management layer, with sql.js as the single source of truth.

The most significant risk is the WKWebView WASM loading failure (fetch() MIME type rejection), which must be addressed in Phase 1 before any other feature work. A closely related risk is the FTS5 trigger ordering bug, which causes intermittent index corruption that is difficult to diagnose after the fact. Both are fully preventable with known workarounds documented in research. The second tier of risk involves D3 SVG performance ceilings at ~500 visible elements and Worker Bridge serialization overhead — both require discipline in query projection and LIMIT enforcement from Phase 5 onward.

## Key Findings

### Recommended Stack

The stack is locked for the web runtime: TypeScript 5.8, sql.js 1.14.0 (custom FTS5 WASM build), D3.js v7 sub-module imports, Vite 7, and Vitest 4. All are current stable releases. No version should be advanced beyond these (TypeScript 6 beta and Vite 8 beta are both production-unready as of Feb 2026). The single most important stack finding is that **sql.js v1.14.0 does not ship FTS5** — only FTS3. A custom Emscripten build adding `-DSQLITE_ENABLE_FTS5` is required and must be completed before any database work begins. The resulting WASM is ~106KB larger (638K → 744K), acceptable for a desktop app. The WASM must be served via a custom Swift `WKURLSchemeHandler` (`app://` scheme) to avoid WKWebView's `fetch()` MIME type rejection of local `.wasm` files.

**Core technologies:**
- **TypeScript 5.8**: Application language — strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` required; prevents FTS array access bugs and D3 datum type bugs
- **sql.js 1.14.0 (custom FTS5 build)**: In-browser SQLite — in-memory model is architecturally correct for WKWebView (no OPFS, no SharedArrayBuffer needed); custom WASM committed as versioned artifact
- **D3.js v7.9.0 (sub-module imports)**: Visualization + DOM state management — `.data(items, d => d.id).join()` pattern eliminates parallel state; tree-shakeable sub-module imports avoid 570KB umbrella bundle
- **Vite 7.3.1**: Build tooling — `optimizeDeps: { exclude: ['sql.js'] }` mandatory; `?url` import for WASM path resolution; `assetsInlineLimit: 0` to prevent WASM inlining
- **Vitest 4.0**: Testing — `pool: 'forks'` with `isolate: true` required for sql.js WASM state isolation between test files; `environment: 'node'` for database tests (not jsdom)

### Expected Features

Research confirms the feature set is well-specified in canonical docs. The dependency graph is clear and sequential.

**Must have (table stakes — v1 launch):**
- sql.js database with canonical schema (cards, connections, FTS5, app_state, view_state) — foundation for everything
- Card CRUD with soft delete — `deleted_at` column, parameterized queries only
- WorkerBridge with typed correlation IDs — all db operations off main thread, non-negotiable for UI responsiveness
- SQL allowlist + FilterProvider + AxisProvider — security boundary must precede any dynamic SQL generation
- FTS5 search with BM25 ranked results and snippets — debounced 150ms, porter+unicode61 tokenizer, rowid join
- Three views: list, grid, kanban — proves "same data, different view" insight with animated transitions
- Apple Notes ETL importer — primary data source; demonstrates graph extraction from real data
- Undo/redo command log with inverse SQL — trust feature; in-memory Tier 3 stack
- Three-tier state persistence — Tier 1/2 SQLite, Tier 3 in-memory only (selection, undo stack)

**Should have (competitive differentiators — v1.x):**
- PAFV SuperGrid with full axis-swapping — keystone differentiator; axis change recompiles SQL projection, not data
- Faceted search refinement — facet counts derived from FTS result set; Notion does not have this
- Calendar, Timeline, Gallery views — requires calendar/visual content user validation before prioritizing
- Connection CRUD UI — graph emerges from ETL first; manual linking is v1.x
- Network (force-directed) view — requires connections to exist first
- Markdown and Excel ETL importers — for non-Apple Notes users

**Defer (v2+):**
- EAV `card_properties` table — explicitly deferred by D-008; fixed schema sufficient for v5
- Semantic/vector search — requires embedding pipeline; FTS5 BM25 covers table stakes
- Block-level editor (Notebook module) — a product in itself; Markdown in content field is v5 sufficient
- Collaborative features — requires CRDTs; fundamentally changes local-first architecture
- Formula fields — requires formula parser and AST; SQL GROUP BY expressions cover 80% of grouping use cases
- Extended ETL sources (Slack, Reminders, Calendar, Contacts) — high native integration complexity; validate Apple Notes model first

### Architecture Approach

The architecture follows a strict layered model: D3 views and Providers on the main thread communicate exclusively through the WorkerBridge to a Web Worker running sql.js (WASM). No entity data persists on the main thread beyond the current render cycle — D3's data join IS state management. All mutations flow through a single MutationManager which generates inverse SQL for undo, sets the CloudKit dirty flag, and notifies subscribers. The StateCoordinator batches cross-provider updates within 16ms frames to prevent redundant queries. The native Swift shell wraps the web runtime in WKWebView and handles Keychain credentials and CloudKit sync via binary database export/import — credentials never enter sql.js.

**Major components:**
1. **WorkerBridge** — promise-based proxy with UUID correlation IDs; single postMessage boundary between main thread and Worker; all db access is async
2. **FilterProvider + PAFVProvider + DensityProvider** — compile UI state to SQL fragments (`{ where, params }`); never produce full SQL strings; column allowlist is the security boundary
3. **MutationManager** — single write gate; generates `{ forward, inverse }` command pairs for undo stack; sets CloudKit dirty flag; notifies subscribers via requestAnimationFrame batching
4. **Message Router (Web Worker)** — dispatches incoming messages to sql.js handlers, graph algorithm handlers, or ETL handlers by message type
5. **StateCoordinator** — batches cross-provider state changes within 16ms frames; persists Tier 1/2 state to `app_state` table; explicitly excludes Tier 3 (selection, undo stack) from persistence
6. **D3 Views (11 views)** — subscribe to providers; re-query via WorkerBridge on notification; render with mandatory key functions (`d => d.id`) for animated view transitions

### Critical Pitfalls

1. **WKWebView fetch() rejects WASM with wrong MIME type** — patch `window.fetch` to use XHR for `.wasm` URLs before calling `initSqlJs()`, OR implement `WKURLSchemeHandler` in Swift to serve all app assets via `app://` scheme with correct `Content-Type: application/wasm`. Must be solved in Phase 1 before any other work. Test in iOS simulator on first integration spike.

2. **FTS5 update trigger causes silent index corruption** — use the exact three-trigger pattern (separate INSERT/DELETE/UPDATE triggers, each doing one atomic operation). A single combined UPDATE trigger causes intermittent corruption (~10% of updates) because FTS5 re-reads the content row during the delete step. Add `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')` to the test suite after every mutation batch.

3. **sql.js WASM path breaks in Vite production build** — add `optimizeDeps: { exclude: ['sql.js'] }` to `vite.config.ts` (prevents esbuild from stripping WASM loading code) and use `import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'` with `locateFile: () => sqlWasmUrl` in `initSqlJs()`. Run production build smoke test alongside dev testing from Phase 1.

4. **sql.js is entirely in-memory — data lost on Worker termination or crash** — implement D-010's dirty flag immediately on every mutation; wire `db.export()` to native shell backgrounding events (not only to the 2-second debounce). Profile export time for large databases before shipping ETL import.

5. **Prepared statements leak memory and lock tables** — always use try/finally with `stmt.free()`. Prefer `db.exec()` / `db.run()` for one-shot queries. Establish the wrapper pattern in Phase 2 before any query module is written; retrofit is painful.

## Implications for Roadmap

Based on research, the dependency graph mandates a 7-phase build order. Each layer depends on everything below it. No phase can be safely reordered because the dependencies are hard (Providers cannot compile SQL without the allowlist; Views cannot render without Providers and Bridge).

### Phase 1: Database Foundation

**Rationale:** Everything in this project depends on sql.js with FTS5 loading correctly. The custom WASM build, WKWebView MIME type workaround, Vite production build path, and Vitest WASM test setup must all be solved before any feature work begins. Four of the ten documented pitfalls must be addressed in this phase.

**Delivers:** Working sql.js WASM (custom FTS5 build) that initializes correctly in dev, production build, WKWebView, and Vitest node environment. Canonical schema (cards, connections, cards_fts with three-trigger sync, app_state, view_state, indexes). Test infrastructure with `integrity-check` assertions.

**Addresses:** sql.js database with canonical schema (P1 table stake)

**Avoids:** Pitfall 1 (WKWebView MIME type), Pitfall 2 (FTS5 trigger corruption), Pitfall 3 (Vite production build path), Pitfall 10 (Vitest WASM setup)

**Research flag:** STANDARD — all solutions are documented with specific code patterns; no additional research needed

### Phase 2: CRUD + Query Functions

**Rationale:** Providers, Worker handlers, and ETL importers all need named query functions to build on. These are pure functions over a `Database` instance — testable without a Worker, enabling TDD before the Worker layer exists.

**Delivers:** `cards.ts`, `connections.ts`, `search.ts`, `graph.ts` query modules. Card CRUD with soft delete. FTS5 rowid-join search. DedupEngine (`source + source_id` lookup). Prepared statement wrapper pattern with mandatory `stmt.free()`.

**Addresses:** Card CRUD with soft delete (P1), FTS search (P1), connection CRUD (P2), import deduplication (table stake)

**Avoids:** Pitfall 5 (prepared statement leaks — establish wrapper pattern here)

**Research flag:** STANDARD — CRUD and FTS5 patterns are fully documented; rowid join rule is clear

### Phase 3: Worker Bridge

**Rationale:** The Bridge is the prerequisite for Providers and Views to execute queries asynchronously. It must exist before Phase 4 or Phase 6 can be tested end-to-end. WorkerBridge + Message Router + worker entry point form a single deployable unit.

**Delivers:** `WorkerBridge.ts` (main thread), `main.worker.ts` (worker entry + Message Router), handler modules (`db.ts`, `graph.ts`, `etl.ts`). UUID correlation ID tracking. Worker `onerror` propagation. Typed `WorkerMessage`/`WorkerResponse` envelope.

**Addresses:** WorkerBridge with correlation IDs (P1), performance (all db ops off main thread)

**Avoids:** Pitfall 8 (establish minimal projection pattern for query results before views consume bridge data)

**Research flag:** STANDARD — postMessage/UUID pattern is well-documented; typed correlation ID approach is specified in canonical docs

### Phase 4: Providers + State Coordination

**Rationale:** Providers compile UI state to SQL fragments — they are the safety boundary between user intent and raw SQL. SQL allowlist must be built before any dynamic SQL is generated anywhere in the codebase. StateCoordinator batching and three-tier persistence enable correct view rendering and CloudKit sync.

**Delivers:** `FilterProvider.ts` (LATCH → WHERE + allowlist validation), `PAFVProvider.ts` (axis → GROUP BY/ORDER BY), `SelectionProvider.ts` (Tier 3 ephemeral), `DensityProvider.ts` (density → strftime SQL), `StateCoordinator.ts` (16ms batch frame + Tier 1/2 persistence), `MutationManager.ts` (single write gate + undo command log + CloudKit dirty flag). SQL injection test suite.

**Addresses:** FilterProvider + AxisProvider + SQL allowlist (P1), three-tier persistence (P1), undo/redo command log (P1), SQL safety test suite (P1)

**Avoids:** Pitfall 4 (wire `db.export()` to native shell lifecycle here — before ETL ships)

**Research flag:** STANDARD for provider pattern; NEEDS RESEARCH for CloudKit dirty flag integration timing with native shell lifecycle events

### Phase 5: D3 Views

**Rationale:** Views are the top layer of the web runtime — they depend on Providers and Bridge (both now complete). SuperGrid first because it exercises the most complex data join pattern (grouped aggregation, nested dimensional headers) and the full PAFV projection. If SuperGrid works, simpler views are straightforward.

**Delivers:** SuperGrid (PAFV nested grid), ListView, KanbanView, ViewManager, ViewTransition (enter/update/exit animations). Subsequent views: CalendarView, TimelineView, GalleryView, GraphView (force-directed). Mandatory key function enforcement (`d => d.id`) across all views.

**Addresses:** List + Grid + Kanban views (P1), view transitions (P1 — core differentiator), calendar/timeline/gallery (P2), network view (P2)

**Avoids:** Pitfall 6 (D3 key function — enforce as first-view pattern); Pitfall 7 (SVG performance — LIMIT enforcement from first view); Pitfall 9 (TypeScript D3 type patterns established in first view)

**Research flag:** NEEDS RESEARCH for SuperGrid PAFV projection SQL specifics and nested header rendering. Standard patterns apply for List and Kanban.

### Phase 6: ETL Importers

**Rationale:** ETL can be developed in parallel with Phase 4 (Providers) once Phase 3 (Bridge) is complete. ETL uses `workerBridge.transaction()` and existing CRUD functions — no dependency on Providers or Views. Apple Notes first because it is the primary data source and demonstrates graph extraction (mentions → person cards, links → connections).

**Delivers:** `AppleNotes.ts` ETL parser, `DedupEngine` integration, `CanonicalCard`/`CanonicalConnection` mapping. Idempotent re-import with `INSERT OR IGNORE` pattern. Batch transaction (500 cards per chunk with progress reporting). `ImportResult` interface surfaced in UI. Graph edges (mentions, links, contains) extracted automatically from import.

**Addresses:** Apple Notes ETL importer (P1), import deduplication (table stake), idempotent re-import (table stake), Markdown + Excel ETL (P2)

**Avoids:** Pitfall 4 (ETL must not ship without export-on-background wired in Phase 4 — importing 10K notes without a save path is a data-loss guarantee)

**Research flag:** STANDARD for Apple Notes JSON format parsing; NEEDS RESEARCH for alto-index JSON schema specifics if not fully documented in canonical spec

### Phase 7: Native Shell

**Rationale:** The Swift WKWebView shell wraps the completed web runtime. Database export format must be stable before CloudKit sync is implemented. `WKURLSchemeHandler` for the `app://` scheme is required to solve the WASM MIME type issue (can be solved in Phase 1 as an integration spike, but full native shell work belongs here).

**Delivers:** WKWebView container, `WKURLSchemeHandler` (app:// scheme with correct MIME types), Keychain integration for ETL credentials, CloudKit sync (dirty flag + debounce trigger + binary db export/import), app lifecycle event handling (background → db export).

**Addresses:** Performance (WKWebView responsiveness), security (credentials in Keychain not SQLite), CloudKit sync (D-010)

**Avoids:** Pitfall 1 (WKWebView MIME type — fully resolved in Swift scheme handler); Pitfall 4 (data loss — background export wired here)

**Research flag:** NEEDS RESEARCH for CloudKit conflict resolution semantics and how they interact with the undo stack clearing (D-009). WKWebView MessageHandler patterns are well-documented but CloudKit sync specifics for binary database blobs need validation.

### Phase Ordering Rationale

- **Phases 1-3 are strictly sequential**: Database → CRUD → Bridge is a hard dependency chain. No layer can be tested end-to-end without the layer below it.
- **Phase 4 and 6 are parallel**: Both depend only on Phase 3. Providers and ETL have no dependency on each other. Different workstreams can develop them simultaneously.
- **Phase 5 (Views) requires both 3 and 4**: Views subscribe to Providers and query via Bridge. Both must exist.
- **Phase 7 (Native Shell) requires all web phases**: Shell wraps the completed runtime; database export format must be stable.
- **SuperGrid before other views**: The most complex view proves the pattern; simpler views follow trivially.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Providers):** CloudKit dirty flag integration timing with native shell lifecycle — specifically, when and how the dirty flag triggers an export signal to Swift, and whether the 2-second debounce is configurable
- **Phase 5 (Views):** SuperGrid PAFV projection SQL specifics (GROUP BY with nested dimensional headers, density strftime expressions) and how the LATCH/GRAPH view family boundary suspension works in PAFVProvider
- **Phase 6 (ETL):** alto-index JSON schema format from Apple Notes export — verify this is fully specified in canonical docs before assuming; if underdocumented, a schema research spike is needed
- **Phase 7 (Native Shell):** CloudKit conflict resolution semantics and undo stack clearing interaction; binary SQLite blob CloudKit sync patterns

Phases with standard patterns (skip research-phase):
- **Phase 1 (Database Foundation):** All workarounds are documented with specific code; custom WASM build is a one-time Emscripten build
- **Phase 2 (CRUD + Queries):** Standard SQLite CRUD, FTS5 rowid join pattern is fully documented
- **Phase 3 (Worker Bridge):** postMessage + UUID correlation pattern is well-established; typed WorkerMessage envelope is specified in canonical docs

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via official sources; FTS5 gap confirmed via sql.js Makefile and GitHub issue tracker; WKWebView WASM issue confirmed via gist and issue reports |
| Features | HIGH | Architecture is locked in CLAUDE-v5.md; feature scope derived from spec + competitor analysis; dependency graph is explicit and logical |
| Architecture | HIGH | Architecture is fully specified in canonical docs (CLAUDE-v5.md, Contracts.md, WorkerBridge.md, Providers.md, SuperGrid.md); research validates those decisions |
| Pitfalls | MEDIUM-HIGH | Most pitfalls verified via official docs, GitHub issues, SQLite forum; WKWebView-specific findings are MEDIUM due to sparse public documentation; FTS5 trigger corruption verified via SQLite forum thread |

**Overall confidence:** HIGH

### Gaps to Address

- **FTS5 custom build process**: The custom Emscripten build of sql.js with FTS5 is required but has never been done for this project. Build once immediately in Phase 1; commit the WASM artifact. If Docker build fails (Emscripten version mismatch), fall back to manual Makefile modification on local emsdk install.

- **WKWebView `app://` scheme vs. fetch() patch**: Two workarounds exist for the MIME type issue. The Swift `WKURLSchemeHandler` approach (app:// scheme) is cleaner and preferred. The fetch() patch is a JavaScript-side fallback. Choose one approach in Phase 1 and document it — mixing both creates confusion.

- **db.export() performance for large databases**: Research flags that `db.export()` on a 10K+ card database takes measurable time. Profile this in Phase 4 before wiring it to the backgrounding event. If too slow, a VACUUM INTO equivalent or chunked export may be needed — but this is a known risk, not an unknown.

- **CloudKit binary blob sync reliability**: The spec mandates CloudKit sync via binary database export (D-010). Research did not validate the CloudKit side of this integration. The Swift implementation of CloudKit sync for large binary blobs (CloudKit records have a 1MB asset size limit by default) needs investigation in Phase 7. This could require splitting the database or using CloudKit large file APIs.

- **alto-index JSON format completeness**: The Apple Notes ETL assumes access to alto-index JSON format. If the canonical spec does not fully document this format, a format research spike is needed before Phase 6 begins.

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md` — canonical architecture and decisions (D-001 through D-010)
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md` — CanonicalCard, WorkerMessage, WorkerResponse interfaces
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md` — Bridge architecture
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md` — Provider system spec
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SuperGrid.md` — PAFV projection and SuperGrid spec
- https://sqlite.org/fts5.html — FTS5 official docs; trigger patterns; integrity-check
- https://github.com/sql-js/sql.js/blob/master/Makefile — FTS3-only build confirmed
- https://github.com/sql-js/sql.js/pull/594 — FTS5 PR blocked by maintainer
- https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/ — TypeScript 5.8 release notes
- https://vite.dev/blog/announcing-vite7 — Vite 7 stable announcement
- https://vitest.dev/blog/vitest-4 — Vitest 4.0 release notes
- https://d3js.org/d3-selection/joining — D3 data join and key function docs

### Secondary (MEDIUM confidence)
- https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c — WKWebView fetch() vs XHR for local WASM
- https://github.com/sql-js/sql.js/issues/393 — WASM MIME type error reports
- https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e — FTS5 trigger corruption report
- https://www.powersync.com/blog/sqlite-persistence-on-the-web — OPFS/SharedArrayBuffer WKWebView gap
- https://web.dev/articles/off-main-thread — off-main-thread WASM workers
- https://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/ — postMessage serialization performance
- https://blog.scottlogic.com/2020/05/01/rendering-one-million-points-with-d3.html — SVG performance wall

### Tertiary (LOW confidence — for competitive context only)
- https://www.nuclino.com/solutions/obsidian-vs-notion — competitor feature comparison
- https://thetoolchief.com/comparisons/airtable-vs-notion/ — competitor feature comparison

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
