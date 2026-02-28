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

### Active

- [ ] Provider system (Filter, Axis, Selection, Density, View) with SQL compilation
- [ ] SQL safety: allowlisted fields, parameterized values, injection rejection
- [ ] Worker Bridge with typed message protocol and correlation IDs
- [ ] Mutation Manager with command log for undo/redo
- [ ] Nine D3.js views (list, grid, kanban, calendar, timeline, gallery, network, tree, table)
- [ ] SuperGrid: nested dimensional headers, PAFV projection, density controls
- [ ] View transitions that animate cards between projections
- [ ] ETL importers starting with Apple Notes
- [ ] Three-tier state persistence (Durable, Session, Ephemeral)
- [ ] Performance threshold: render <16ms (100 visible cards, SuperGrid)

### Out of Scope

- Native Swift shell — separate effort, not in this build
- CloudKit sync implementation — native shell handles this
- Schema-on-read extras (EAV table) — deferred to Phase 2 per D-008
- Designer Workbench / App Builder — future tier
- Android/Windows/Web native shells — v2
- DuckDB swap — v2 optimization
- Collaborative features — v2
- Real OAuth credential flows — web runtime uses bridge to native Keychain

## Context

Shipped v0.1 Data Foundation with 3,378 LOC TypeScript, 151 tests passing.
Tech stack: TypeScript 5.9 (strict), sql.js 1.14 (custom FTS5 WASM), Vite 7.3, Vitest 4.0.

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
- WKWebView WASM MIME type rejection spike created; full solution (Swift WKURLSchemeHandler) in Phase 7

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
| D-003: Allowlist + Parameters | SQL safety without ORM overhead | Decided ✓ |
| D-004: rowid FTS joins | Correct FTS5 content table usage | ✓ Good — v0.1 validated (21 search tests) |
| D-005: Three-tier persistence | Clear rules for what persists where | Decided ✓ |
| D-006: Nine views with tier gating | Free/Pro/Workbench feature gates | Decided ✓ |
| D-007: Keychain-only credentials | No secrets in SQLite | Decided ✓ |
| D-008: Defer schema-on-read extras | Fixed schema for v5, EAV in Phase 2 | Decided ✓ |
| D-009: Command log undo/redo | Inverse operations, in-memory stack | Decided ✓ |
| D-010: Dirty flag + debounce sync | Lifecycle-aware CloudKit triggers | Decided ✓ |
| TDD enforcement | Spec mandates red-green-refactor | ✓ Good — 151 tests in v0.1 |
| Research flexibility | Open to better tooling within locked architecture | ✓ Good — Vite 7/Vitest 4 chosen |
| Custom FTS5 WASM build | sql.js 1.14.0 lacks FTS5; Emscripten build needed | ✓ Good — 756KB, FTS5 verified |
| db.exec()/db.run() for Phase 2 | withStatement deferred to Phase 3 | ✓ Good — simple, 151 tests pass |
| p99 as p95 proxy | tinybench lacks p95; p99 < threshold implies p95 passes | ✓ Good — conservative |

---
*Last updated: 2026-02-28 after v0.1 milestone*
