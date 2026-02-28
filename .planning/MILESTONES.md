# Milestones

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

