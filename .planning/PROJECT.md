# Isometry v5

## What This Is

A local-first, polymorphic data projection platform where LATCH separates, GRAPH joins, and any axis maps to any plane. The TypeScript/D3.js web runtime runs inside a WKWebView, with sql.js as the in-memory database and system of record. This is a ground-up rethink — fresh start, no legacy code.

## Core Value

SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins. The database is the truth, the view is a projection, and switching views changes the SQL, not the data.

## Requirements

### Validated

- ✓ sql.js database with canonical schema (cards, connections, FTS5, ui_state) — v0.1
- ✓ Card CRUD with soft delete and parameterized queries — v0.1 (30 tests)
- ✓ Connection CRUD with via_card_id pattern for rich relationships — v0.1 (23 tests)
- ✓ FTS5 search with rowid joins and ranked results — v0.1 (21 tests)
- ✓ Performance thresholds: insert <10ms, bulk insert <1s, FTS <100ms, graph <500ms — v0.1 (10K-card dataset)
- ✓ Provider system (Filter, PAFV, Selection, Density) with SQL-safe allowlisted compilation — v0.5
- ✓ SQL safety: double-validation (addFilter + compile), allowlisted fields/operators, injection rejection — v0.5
- ✓ Mutation Manager with command-pattern undo/redo and rAF-batched notifications — v0.5
- ✓ Three-tier state persistence (Durable via StateManager, Session via providers, Ephemeral via SelectionProvider) — v0.5
- ✓ Six D3 views (list, grid, kanban, calendar, timeline, gallery) with stable key functions — v0.5
- ✓ View transitions: SVG morph (list/grid/timeline) and crossfade (LATCH/GRAPH boundary) — v0.5
- ✓ KanbanView drag-drop with undoable mutations (Cmd+Z) — v0.5

### Active — Current Milestone: v1.0 Web Runtime

**Goal:** Complete the web runtime — Worker Bridge for off-main-thread SQL, Graph views (network, tree), and SuperGrid with nested dimensional headers.

- [ ] Worker Bridge with typed message protocol, correlation IDs, init queuing, and timeouts
- [ ] NetworkView: force-directed graph with simulation running in Worker (not main thread)
- [ ] TreeView: hierarchical layout from contains/parent connections with collapsible nodes
- [ ] SuperGrid: nested dimensional headers with PAFV stacked axis assignments (SuperStack)
- [ ] Performance threshold: render <16ms (100 visible cards, SuperGrid)

### Out of Scope

- ETL importers (Apple Notes, etc.) — v1.1 milestone, runtime-first
- Native Swift shell — separate effort, not in this build
- CloudKit sync implementation — native shell handles this
- Schema-on-read extras (EAV table) — deferred per D-008
- Designer Workbench / App Builder — future tier
- Android/Windows/Web native shells — v2
- DuckDB swap — v2 optimization
- Collaborative features — v2
- Real OAuth credential flows — web runtime uses bridge to native Keychain

## Context

Shipped v0.5 Providers + Views with 20,468 LOC TypeScript, 774 tests passing.
Tech stack: TypeScript 5.9 (strict), sql.js 1.14 (custom FTS5 WASM), D3.js v7.9, Vite 7.3, Vitest 4.0.

Isometry v5 has extensive pre-existing specification:
- `CLAUDE-v5.md` — canonical architectural decisions (D-001 through D-010), all final
- `Isometry v5 SPEC.md` — product vision, foundational concepts (LATCH, GRAPH, PAFV)
- `Modules/Core/Contracts.md` — schema and type definitions
- `Modules/Core/WorkerBridge.md` — canonical message protocol

10 architectural decisions are resolved and locked. The spec is unusually complete — implementation should follow it closely, with research providing guidance on tooling/library choices within the locked architecture.

The fundamental insight: LATCH (Location, Alphabet, Time, Category, Hierarchy) covers every way to *separate* information. GRAPH covers every way to *connect* it. PAFV (Planes, Axes, Facets, Values) maps any dimension to any screen coordinate.

Known technical debt:
- `withStatement` pattern stubbed (throws in Phase 2) — needs Database.prepare() in Phase 3
- Schema loading uses conditional dynamic import (node:fs vs ?raw) — works but adds code paths
- WKWebView WASM MIME type rejection spike created; full solution (Swift WKURLSchemeHandler) deferred
- D3 `.transition()` on SVG transform crashes jsdom (parseSvg) — direct `.attr()` used, transition only for opacity
- GalleryView uses pure HTML (no D3 data join) — tiles rebuilt on render(); no incremental update

## Constraints

- **Stack**: TypeScript (strict), sql.js (WASM), D3.js v7, Vite, Vitest — no React, no Redux, no framework
- **TDD**: Red-Green-Refactor is non-negotiable. Every feature starts with a failing test.
- **No parallel state**: D3's data join IS state management. No MobX/Redux/Zustand duplicating SQLite data.
- **SQL safety**: All dynamic queries use allowlisted fields + parameterized values. No raw SQL from UI.
- **Credentials**: Keychain only for tokens/secrets. SQLite stores metadata only.
- **Connections**: Lightweight relations table, not cards. Rich edges via `via_card_id`.
- **FTS**: Always join on rowid, never on id. Four indexed fields: name, content, tags, folder.
- **Selection**: Tier 3 (ephemeral). Never persisted to database.
- **Bridge protocol**: All Worker communication uses WorkerMessage/WorkerResponse envelope with correlation IDs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| D-001: Lightweight relations | Lower schema complexity for v5 | ✓ Good — v0.1 validated |
| D-002: Single WorkerBridge spec | Core/WorkerBridge.md is canonical | Decided ✓ |
| D-003: Allowlist + Parameters | SQL safety without ORM overhead | ✓ Good — v0.5 validated (double-validation, injection tests) |
| D-004: rowid FTS joins | Correct FTS5 content table usage | ✓ Good — v0.1 validated (21 search tests) |
| D-005: Three-tier persistence | Clear rules for what persists where | ✓ Good — v0.5 validated (SelectionProvider Tier 3, StateManager Tier 2) |
| D-006: Nine views with tier gating | Free/Pro/Workbench feature gates | ✓ Good — 6/9 views shipped in v0.5 |
| D-007: Keychain-only credentials | No secrets in SQLite | Decided ✓ |
| D-008: Defer schema-on-read extras | Fixed schema for v5, EAV in Phase 2 | Decided ✓ |
| D-009: Command log undo/redo | Inverse operations, in-memory stack | ✓ Good — v0.5 validated (MutationManager, batchMutation pre-reversal) |
| D-010: Dirty flag + debounce sync | Lifecycle-aware CloudKit triggers | Decided ✓ |
| TDD enforcement | Spec mandates red-green-refactor | ✓ Good — 774 tests through v0.5 |
| Research flexibility | Open to better tooling within locked architecture | ✓ Good — Vite 7/Vitest 4 chosen |
| Custom FTS5 WASM build | sql.js 1.14.0 lacks FTS5; Emscripten build needed | ✓ Good — 756KB, FTS5 verified |
| db.exec()/db.run() for Phase 2 | withStatement deferred to Phase 3 | ✓ Good — simple, 151 tests pass |
| p99 as p95 proxy | tinybench lacks p95; p99 < threshold implies p95 passes | ✓ Good — conservative |
| HTML5 DnD over d3.drag for KanbanView | d3.drag intercepts dragstart, corrupts dataTransfer | ✓ Good — native DnD works in jsdom with polyfill |
| SVG morph only for SVG_VIEWS pairs | list/grid/timeline share g.card elements | ✓ Good — crossfade handles all other transitions |
| QueryBuilder as sole SQL assembly | All SQL from provider compile() outputs, no escape hatch | ✓ Good — airtight boundary |
| Two-tier batching (microtask + setTimeout) | Providers self-notify; StateCoordinator cross-provider at 16ms | ✓ Good — no over-notification |
| GalleryView pure HTML (no D3) | Tiles rebuilt on render; no data join needed for simple grid | ✓ Good — simpler than SVG views |

---
*Last updated: 2026-02-28 after v0.5 milestone*
