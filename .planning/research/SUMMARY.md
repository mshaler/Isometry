# Project Research Summary

**Project:** Isometry v5 — Web Runtime (v1.0 milestone)
**Domain:** Local-first polymorphic data projection platform (TypeScript/D3.js, sql.js WASM, WKWebView)
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

Isometry v5 is a local-first macOS/iOS application that renders an in-browser SQLite database (sql.js via WASM) through nine D3.js projection views inside a WKWebView native shell. The v0.1 Data Foundation milestone is already complete and validated with 151 passing tests covering the sql.js database, card CRUD, connection CRUD, FTS5 search, graph traversal, and performance benchmarks on 10K cards. The v1.0 Web Runtime milestone adds the entire rendering and interaction stack on top: a typed async Worker Bridge connecting the main thread to the Worker-hosted sql.js instance, a provider system that compiles UI state to SQL fragments, a MutationManager for undo/redo, nine D3.js views with animated transitions, and the signature SuperGrid multidimensional projection view. Only three dependencies need to be added to the existing stack (D3 umbrella package, @types/d3, @vitest/web-worker) plus a one-line tsconfig change.

The recommended architecture follows strict layered separation enforced by six non-negotiable patterns: (1) no parallel entity store — D3 data joins are state management, sql.js is the single source of truth; (2) providers compile SQL fragments, views assemble final SQL, the Worker executes it — providers never call the bridge directly; (3) MutationManager is the sole write gate — all entity writes go through `MutationManager.exec()`, which generates inverse SQL for undo, sets the dirty flag, and schedules frame-batched notification; (4) every D3 `.data()` call must supply a key function (`d => d.id`) for correct animated transitions and element identity; (5) Worker initialization uses a message queue to prevent lost messages during WASM load; (6) every pending promise in the bridge has a configurable timeout to prevent silent hangs on Worker errors.

The most significant risks are WKWebView-specific (WASM MIME type rejection on local file URLs, data loss if the Worker is terminated without exporting the in-memory database) and D3-specific (missing key functions causing broken transitions, provider subscriber leaks from views that don't call `destroy()`). All critical pitfalls have documented prevention patterns and must be tested from the first phase they are introduced. The build sequence is dictated by a strict dependency DAG: WorkerBridge first, then providers and MutationManager, then D3 views from simplest to most complex, with SuperGrid (the most complex view) built after simpler views prove the pattern.

## Key Findings

### Recommended Stack

The v0.1 stack (TypeScript 5.9.x strict, sql.js 1.14.0 custom FTS5 WASM, Vite 7.3.1, Vitest 4.0.18) is already configured and passing 151 tests. The only additions required for v1.0 are minimal: `d3@7.9.0` (runtime), `@types/d3@7.4.3` (dev), and `@vitest/web-worker@4.0.18` (dev, for WorkerBridge unit testing). One tsconfig change is required: add `"WebWorker"` to the `lib` array to enable `self.onmessage` and `self.postMessage` types in worker.ts. No changes are needed to vite.config.ts beyond what already exists.

**Core technologies:**
- `d3@7.9.0`: Data visualization, DOM data joins, force simulation, transitions, zoom, hierarchy — covers all nine views via named imports (Vite tree-shakes from the umbrella package). Import named exports from sub-modules, never `import * as d3` (prevents ~570KB bundle).
- `@types/d3@7.4.3`: TypeScript strict-mode types for all D3 sub-modules. Requires explicit generic parameters on selections (`select<SVGSVGElement, unknown>`). Works with `skipLibCheck: false`.
- `@vitest/web-worker@4.0.18`: Worker simulation in Vitest node environment for WorkerBridge correlation ID integration tests. Must match installed Vitest version exactly.
- `TypeScript "WebWorker" lib`: Zero-cost tsconfig addition enabling `DedicatedWorkerGlobalScope`, `self.postMessage`, and `MessageEvent<T>` inside worker.ts. With both DOM and WebWorker libs, some shared types have overloaded signatures — LOW risk.
- D3 force simulation in Worker: `d3-force` has zero DOM dependencies, runs synchronously via `simulation.tick(n)`, posts only stable `{id, x, y}` positions to main thread — never per-tick updates.

**What NOT to add:** React/Vue/Svelte (fight D3's DOM ownership model), MobX/Zustand/Redux (D-001 explicitly forbids parallel entity state), GSAP/Framer Motion (fight D3's transition lifecycle), AG Grid/Handsontable (own their DOM, incompatible with D3 data joins), Observable Plot (hides the data join model), PIXI.js (overkill for <500 visible nodes — SVG + off-thread simulation is sufficient).

### Expected Features

The v1.0 Web Runtime milestone must deliver the full stack that makes data already in SQLite visible and interactive. Users coming from Notion, Airtable, and NocoDB have formed expectations this milestone must meet.

**Must have (table stakes):**
- Non-blocking database access — Worker Bridge with typed correlation IDs; any blocking UI operation destroys perceived quality
- Filter state persists across navigation — three-tier persistence: FilterProvider state → Tier 1 SQLite `app_state`; Airtable and NocoDB both do this, users are confused when filters reset
- View switching without data loss — PAFVProvider suspends/restores view family state; LATCH state survives a GRAPH detour
- Keyboard undo/redo (Cmd+Z / Cmd+Shift+Z) — absence is trust-destroying for any desktop-class tool; Notion's undo is notoriously partial
- Multi-select (Cmd+click toggle, Shift+click range) — consistent with every macOS desktop application
- Sort controls — users expect ascending/descending sort on any field (PAFVProvider compiles to SQL ORDER BY)
- Density controls — DensityProvider 4-level model that changes SQL GROUP BY expressions, not just CSS class

**Should have (competitive differentiators):**
- PAFV spatial projection (any LATCH axis to any screen plane) — no competitor allows arbitrary axis-to-plane mapping with nested SQL GROUP BY compilation
- SuperGrid with nested dimensional headers and spanning parent headers — unique; all competitors group by one field at a time
- Animated D3 view transitions — Notion, Airtable, NocoDB all replace content instantly; cards morphing between projections makes the "same data, different view" insight visceral
- Full command log undo/redo with inverse SQL — most in-browser tools have no undo; every mutation is undoable without server round-trips
- Force simulation off main thread for network view — critical for usability at 200+ nodes (blocks UI if run on main thread)
- Graph algorithm suite (PageRank, Louvain community detection, centrality) running client-side on local data
- Allowlist-enforced SQL safety without ORM — column names allowlisted at compile time, values always parameterized

**Defer to v1.x or v2+:**
- Table view (Workbench tier) — virtual scroll + editable cells + column resize; explicitly deferred per FEATURES.md
- ETL importers — v1.1 milestone; runtime must be stable before importing real data
- Native Swift shell beyond basic WKWebView integration spike
- CloudKit sync, EAV card_properties, semantic/vector search, collaborative features

**Feature build order (P1 = blocks all else, P2 = part of milestone after P1):**
WorkerBridge → SQL allowlist → FilterProvider + PAFVProvider + SelectionProvider + DensityProvider + MutationManager + StateCoordinator → List view (establishes pattern) → Grid + Kanban + View transitions → Calendar + Timeline + Gallery → Network + Tree → SuperGrid

### Architecture Approach

The architecture follows a strict layered model. D3 views and Providers on the main thread communicate exclusively through the WorkerBridge to a Web Worker running sql.js (WASM). No entity data persists on the main thread beyond the current render cycle — D3's data join IS state management. The StateCoordinator batches cross-provider updates within 16ms frames. All mutations flow through MutationManager which generates inverse SQL for undo, sets the dirty flag, and notifies subscribers via requestAnimationFrame batching.

**Major components (in build order):**
1. **WorkerBridge** (`src/worker/WorkerBridge.ts`) — Main-thread promise proxy over postMessage; UUID `pending` Map with per-entry timeout; singleton initialized once; exposes `isReady` promise that all public methods await internally
2. **Message Router + Handlers** (`src/worker/worker.ts`, `src/worker/handlers/`) — Worker-side switch on message type; calls existing pure query functions from `src/database/queries/`; queues messages during WASM initialization to prevent lost messages
3. **FilterProvider** (`src/providers/FilterProvider.ts`) — LATCH filter state compiled to `{where, params}` with column allowlist enforcement; never calls bridge directly
4. **PAFVProvider** (`src/providers/PAFVProvider.ts`) — Axis-to-plane mappings compiled to GROUP BY + ORDER BY fragments; view family suspension/restoration across LATCH/GRAPH boundary
5. **SelectionProvider** (`src/providers/SelectionProvider.ts`) — Tier 3 ephemeral only; `Set<string>` in-memory; never persisted to SQLite by explicit decision (D-005)
6. **DensityProvider** (`src/providers/DensityProvider.ts`) — 4-level density model compiled to strftime() SQL expressions; controls GROUP BY granularity, not just CSS
7. **StateCoordinator** (`src/providers/StateCoordinator.ts`) — 16ms batch window; orchestrates Tier 1/2 persistence; explicitly excludes SelectionProvider (Tier 3)
8. **MutationManager** (`src/mutations/MutationManager.ts`) — Single write gate; `Command` with `forward` and `inverse` SQL; in-memory undo/redo stack (Tier 3); requestAnimationFrame-batched subscriber notification
9. **D3 Views** (`src/views/*.ts`) — Nine views; every `.data()` call requires key function `d => d.id`; ListView establishes the canonical pattern; SuperGrid is most complex (built last)
10. **ViewManager** (`src/views/ViewManager.ts`) — Mounts/unmounts active view; calls `view.destroy()` before mounting next view to prevent subscriber leaks

**Key architectural rules that cannot be violated:**
- Providers never call `workerBridge.query()` — they compile fragments only
- All entity writes go through `MutationManager.exec()` — never through bridge directly from a view
- Selection is Tier 3 only — never persisted (D-005 is final)
- D3 key function is mandatory on every `.data()` call — non-negotiable for transitions

### Critical Pitfalls

1. **WKWebView WASM MIME rejection** — WKWebView's `fetch()` enforces strict MIME type validation on local file:// URLs; `initSqlJs()` hangs silently. Prevention: use `WKURLSchemeHandler` for native URL serving with correct Content-Type, or a scoped XMLHttpRequest fallback for the WASM asset only. Test in WKWebView on day one — Vite dev server masks this problem entirely.

2. **Worker initialization race condition** — Messages arriving at the Worker during WASM initialization (200-500ms) are lost; calls to `workerBridge.query()` before `init()` resolves fail. Prevention: register `self.onmessage` immediately but queue messages until `db` is initialized; expose an `isReady` promise on WorkerBridge that all public methods await implicitly.

3. **Missing D3 key function causes broken transitions** — Every `.data()` call without a key function uses index-based matching; on sort/filter changes, cards animate to wrong positions and DOM nodes are unnecessarily destroyed. Prevention: enforce key function from the very first view written; it cannot be retrofitted without rewriting all join logic.

4. **Provider subscriber leak accumulates across view switches** — Views that subscribe on mount but fail to call the returned unsubscribe function on `destroy()` accumulate dead callbacks. After N view switches, N bridge queries fire per state change. Prevention: every view exposes `destroy()`; ViewManager calls it before mounting the next view; test subscriber count before and after 10 mount/destroy cycles.

5. **Pending promise map unbounded growth on silent Worker error** — If a Worker message handler throws an error that doesn't crash the Worker, the promise is never resolved or rejected and hangs forever. Prevention: every `pending.set()` call sets a timeout that rejects after a configurable duration (5s for queries, 30s for graph operations, 60s for PageRank).

6. **sql.js in-memory data loss on Worker termination** — sql.js has no automatic persistence; all data exists only in the Worker's WASM heap. Prevention: implement D-010 dirty flag immediately on every mutation; wire `db.export()` to app-backgrounding signals from the native shell, not only to the 2-second debounce.

7. **Empty provider fragment produces invalid SQL** — When FilterProvider or PAFVProvider returns empty strings for optional clauses, `WHERE ` or `ORDER BY ` (bare clauses) cause SQLite syntax errors on first load before any user interaction. Prevention: QueryCompiler must treat all fragments as potentially absent and provide safe defaults; test with all providers at initial default state.

## Implications for Roadmap

Based on combined research, the natural phase structure follows the component dependency DAG with a clear bottom-up build order. The architecture is fully specified with no ambiguous dependency relationships — phase boundaries are determined by technical prerequisites, not arbitrary feature grouping.

### Phase 1: Worker Bridge + Runtime Foundation

**Rationale:** WorkerBridge is the mandatory prerequisite for every other component in this milestone. No provider, view, or mutation manager can function without it. This phase also resolves the two highest-risk pitfalls: WKWebView WASM loading and Worker initialization race conditions. Failing to address these early invalidates all subsequent work.

**Delivers:** Working async RPC layer over postMessage; Worker initialization with message queuing during WASM load; `isReady` promise pattern on WorkerBridge; timeout on every pending promise entry; `@vitest/web-worker` integration; integration test proving main thread → Worker → sql.js → main thread round-trip under concurrency. Also includes `tsconfig.json` "WebWorker" lib addition.

**Features addressed:** Non-blocking database access (table-stakes foundation); loading state during initialization; consistent card identity across views.

**Pitfalls avoided:** WKWebView WASM MIME rejection (Pitfall 1); Vite production build WASM path (Pitfall 3); Worker initialization race condition (Pitfall 11); pending promise map unbounded growth (Pitfall 12).

**Research flag:** STANDARD — WorkerBridge with correlation ID promises is well-documented in the spec; implementation is specified with no ambiguity.

### Phase 2: Provider System + MutationManager

**Rationale:** All five providers plus MutationManager form a single coherent system that must exist before any D3 view can function. FilterProvider and SelectionProvider are independent and can be built in parallel. DensityProvider is also independent. MutationManager is parallel to providers (both depend only on WorkerBridge). StateCoordinator requires all providers. The SQL column allowlist is a security prerequisite — it must be built before FilterProvider generates any dynamic SQL.

**Delivers:** Complete provider system with SQL compilation; SQL column allowlist enforced at compile time; three-tier state persistence end-to-end; MutationManager with undo/redo command log and inverse SQL generation; frame-batched subscriber notification; full test suite for SQL compilation and injection rejection.

**Features addressed:** Filter state persists across navigation; view switching without data loss; keyboard undo/redo; density controls that compile to SQL; allowlist-enforced SQL safety; mutation notification batched at frame boundary.

**Pitfalls avoided:** Subscriber leak (Pitfall 13 — establish mount/destroy contract in provider interface before any view uses it); getState() mutation bypass (Pitfall 14 — enforce Readonly<T> return types from the start); empty provider fragment produces invalid SQL (Pitfall 15 — test with all providers at default state); undo batch inverse SQL ordering (Pitfall 16).

**Research flag:** STANDARD — provider architecture is fully specified in Contracts.md and Providers.md; MutationManager command log pattern is well-understood from first principles.

### Phase 3: Core D3 Views (List, Grid, Kanban) + View Transitions

**Rationale:** ListView is the simplest D3 view and establishes the canonical pattern all other views follow: key function, data join enter/update/exit, requery-on-notification, SelectionProvider CSS overlay. Building ListView correctly — especially with the stable key function — is the prerequisite for view transitions working at all. Grid proves "same data, different projection." Kanban adds MutationManager integration (drag-drop is a mutation). View transitions require at least two views with stable card identity.

**Delivers:** Three working D3 views (list, grid, kanban with drag-drop); Card component shared across all views; animated view transitions with `d3-transition` and stable `d => d.id` key functions; drag-drop in kanban updating status via MutationManager (undoable); view transition strategies (morph for LATCH-to-LATCH, crossfade for LATCH-to-GRAPH family boundary).

**Features addressed:** View transitions (keystone differentiator); LATCH/GRAPH view family duality; kanban drag-drop; view-specific defaults; instant filter response visible end-to-end; select multiple items across views.

**Pitfalls avoided:** Missing D3 key function (Pitfall from ARCHITECTURE.md anti-patterns — enforce from first view, cannot retrofit); subscriber leak (ViewManager calls `destroy()` before mounting next view, verified in this phase with mount/destroy cycle test).

**Research flag:** STANDARD — D3 data join with stable key functions and d3-transition are extensively documented; kanban drag-drop uses `d3-drag` with established patterns.

### Phase 4: Time + Visual Views (Calendar, Timeline, Gallery)

**Rationale:** Calendar and Timeline both depend on DensityProvider's time hierarchy (day/week/month/quarter/year → strftime expressions) and d3-time-format. These were built in Phase 2 but not yet exercised by any view. Gallery is the simplest of the three (same 2D tile layout as Grid). These three views share time-axis SQL patterns and can be developed together.

**Delivers:** Calendar view with month/week/day DensityProvider integration; Timeline view with continuous `d3.scaleTime()` and PAFVProvider swim lane assignment; Gallery view with image/cover tile rendering for resource card types. DensityProvider time SQL fragments exercised at all five granularity levels.

**Features addressed:** Calendar and Timeline complete the LATCH view family; Gallery provides visual richness for resource cards; density controls exercised at real SQL granularity.

**Pitfalls avoided:** Ensure time-axis DensityProvider SQL fragments produce valid GROUP BY expressions at every density level; test with all five density levels (day/week/month/quarter/year) before advancing.

**Research flag:** STANDARD — time-axis D3 views follow documented d3-time and d3-time-format patterns; DensityProvider SQL compilation for time hierarchies is straightforward strftime expression mapping.

### Phase 5: Graph Views (Network, Tree) + SuperGrid

**Rationale:** Network and Tree views require populated connection data (seeded from test data for v1.0, ETL in v1.1), GRAPH view family state suspension in PAFVProvider, and d3-force simulation running in the Worker. SuperGrid is the most complex view in the milestone — it requires PAFVProvider axis stacking, DensityProvider group collapse, and custom nested header rendering unlike any standard D3 pattern. Building SuperGrid after simpler views prove the pattern reduces risk significantly.

**Delivers:** Network view with D3 force-directed layout computed in the Worker (never on main thread), PageRank node sizing, Louvain community coloring, pan/zoom; Tree view with d3-hierarchy layout from contains/parent connections, collapsible nodes; SuperGrid with nested dimensional headers, spanning parent headers, sticky headers, collapsible groups, and SQL GROUP BY compiled from stacked PAFV axes.

**Features addressed:** PAFV spatial projection (signature differentiator); SuperGrid nested dimensional headers; force simulation off main thread; graph algorithm suite; LATCH/GRAPH view family duality exercised end-to-end; SuperStack spanning headers.

**Pitfalls avoided:** Force simulation on main thread (blocks UI at 200+ nodes — must run in Worker, post only stable `{id, x, y}` positions). SuperGrid sticky header implementation needs careful CSS position:sticky scoping.

**Research flag:** NEEDS RESEARCH for SuperGrid SuperStack nested header spanning algorithm — the spec defines the behavior (parent headers visually span children in D3 SVG) but the specific D3 implementation is not analogous to any standard documented example. Flag for `gsd:research-phase` when planning Phase 5. Graph algorithm implementations (PageRank, Louvain) may also need sourcing if pure-TypeScript implementations are needed.

### Phase Ordering Rationale

- **WorkerBridge absolutely first:** No other component can function without it. Also resolves the highest-risk WKWebView pitfalls before any feature work is invested.
- **Providers before views:** Every view depends on compiled SQL fragments from providers. Building views without providers would require throwaway mock implementations that would be replaced anyway.
- **MutationManager in Phase 2 (parallel to providers):** Both depend only on WorkerBridge. Kanban drag-drop in Phase 3 requires MutationManager, so it must complete before Phase 3.
- **ListView before SuperGrid:** Establishes the D3 data join pattern. SuperGrid builds on that pattern but adds 4x complexity. Attempting SuperGrid first conflates architectural decisions with view-specific complexity.
- **Graph views in Phase 5 (last):** Network and Tree require populated connection data (primarily from ETL, which is v1.1). For v1.0, test data suffices, but graph views are GRAPH family which requires LATCH views to exist first for PAFVProvider family suspension to have a target to return to.
- **Table view deferred:** Explicitly deferred per FEATURES.md. Virtual scroll + editable cells + column resize is out of scope for v1.0.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (SuperGrid):** SuperStack nested header spanning algorithm — parent headers visually spanning children across D3 SVG elements — is custom to this project with no documented analogue. Flag for `gsd:research-phase` when planning Phase 5.
- **Phase 5 (Graph algorithms):** PageRank and Louvain community detection are specified as Worker-side operations, but no specific TypeScript implementation is identified in the research. At Phase 5 planning, evaluate whether to implement from scratch or source a pure-JS library that runs in a Worker context without DOM dependencies.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (WorkerBridge):** Promise correlation over postMessage is a standard pattern; canonical spec provides the implementation. `@vitest/web-worker` is straightforward to configure.
- **Phase 2 (Provider system):** SQL compilation from UI state is fully specified in Contracts.md and Providers.md. MutationManager inverse SQL pattern follows standard command pattern.
- **Phase 3 (List, Grid, Kanban, transitions):** D3 data join with stable key functions and d3-transition are extensively documented with Observable examples.
- **Phase 4 (Calendar, Timeline, Gallery):** d3-time and d3-time-format are standard D3 modules; time-axis views follow established documented patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified via npm registry (2026-02-28). D3 7.9.0 confirmed current stable (no v8 exists). @vitest/web-worker 4.0.18 matches installed Vitest. Only 3 new dependencies needed. |
| Features | HIGH | Architecture is locked in CLAUDE-v5.md (D-001 through D-010 are final decisions, not hypotheses). Competitor analysis (Notion, Airtable, NocoDB) confirms table-stakes features. Dependency graph is explicit and logical. |
| Architecture | HIGH | Fully specified across six canonical spec documents. Integration points, data flows, and build order are explicit in ARCHITECTURE.md. The existing v0.1 codebase validates the database layer works as specified. |
| Pitfalls | MEDIUM-HIGH | WKWebView WASM pitfalls verified via WebKit issue reports and community evidence. Worker initialization race condition verified from first principles. D3 key function pitfall is HIGH confidence from D3 issue tracker evidence. Undo batch ordering pitfall is HIGH from SQL semantics. View transition and subscriber leak pitfalls are MEDIUM (community evidence, not official). |

**Overall confidence:** HIGH

### Gaps to Address

- **WKWebView integration test environment:** The v0.1 tests run in Node/Vitest. No WKWebView-in-iOS-simulator test has been run against the completed web runtime. Pitfall 1 (WASM MIME) will only manifest when loading a production Vite build into a real WKWebView. This must be validated in Phase 1 with a native shell integration spike before Phase 3 commits to the rendering architecture.

- **SuperGrid SuperStack header spanning algorithm:** The spec describes the visual behavior (parent headers span children) but does not prescribe the D3 SVG implementation. No documented analogous example exists. Options include: absolute-positioned overlay SVG elements, `foreignObject` elements, or nested `<g>` with calculated widths derived from child cell counts. This needs resolution during Phase 5 planning — flag for `gsd:research-phase`.

- **Graph algorithm implementations:** PageRank and Louvain community detection are specified as Worker-side operations but no specific TypeScript implementation is identified. At Phase 5, evaluate pure-TypeScript implementations vs. sourcing a library. The library must have zero DOM dependencies to run in a Worker context.

- **`db.export()` performance at scale:** sql.js's `db.export()` returns a `Uint8Array` of the full database binary. At 10K+ cards, this may take measurable time. Profile before wiring to the D-010 CloudKit debounce trigger. If slow, it may need to be asynchronous with the dirty flag held open during export.

- **DOM + WebWorker lib type conflicts:** Adding `"WebWorker"` to tsconfig alongside `"DOM"` produces overlapping type signatures for shared types like `MessageEvent`. Research flags this as LOW risk, but validate when the tsconfig change is made in Phase 1 — if TypeScript produces ambiguous type errors, the approach may need to be a separate tsconfig for the worker file.

## Sources

### Primary (HIGH confidence — canonical project specifications)
- `CLAUDE-v5.md` — D-001 through D-010 locked architectural decisions, milestone definitions
- `v5/Modules/Core/Contracts.md` — TypeScript interfaces, schema, safety rules, allowlist pattern
- `v5/Modules/Core/WorkerBridge.md` — Canonical WorkerBridge protocol and implementation
- `v5/Modules/Core/Providers.md` — Provider pattern, StateCoordinator, MutationManager
- `v5/Modules/SuperGrid.md` — PAFV projection, SuperStack headers, density model
- `v5/Modules/Views.md` — Nine view types, D3 patterns, view transition strategies
- `v5/Modules/D3Components.md` — Design system, component patterns

### Primary (HIGH confidence — official documentation)
- npm registry — d3@7.9.0, @types/d3@7.4.3, @vitest/web-worker@4.0.18 — versions verified 2026-02-28
- d3js.org — D3 v7 module listing, force simulation API (`simulation.tick(n)` no-DOM), hierarchy, zoom, transition docs
- vite.dev — Web worker configuration, `worker.format: 'es'`, `optimizeDeps.exclude`
- TypeScript tsconfig reference — `lib: ["WebWorker"]` behavior, DOM + WebWorker coexistence
- SQLite FTS5 documentation — external content tables, trigger patterns, rowid join, integrity-check
- d3/d3 GitHub issue #1053 — d3-force confirmed zero DOM dependencies (Worker-safe)

### Secondary (MEDIUM confidence — community and issue tracker)
- Observable — Force-directed web worker example, animated transitions, effective animation examples
- Stanford Vis Group — Animated Transitions in Statistical Data Graphics (view transition strategy research)
- WebKit behavior — WKWebView fetch() MIME validation on local file:// URLs
- Airtable docs — Filter persistence per saved view, multi-select behavior
- Notion/Airtable/NocoDB competitor comparison — view state behavior, undo/redo limitations

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
