---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: milestone
status: unknown
last_updated: "2026-02-28T11:13:46Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 2 - CRUD + Query Layer

## Current Position

Phase: 2 of 7 (CRUD + Query Layer) -- COMPLETE
Plan: 5 of 5 in current phase -- 02-01..02-05 all done
Status: Phase 2 Complete -- 02-05 done (performance benchmarks, 151/151 tests passing, all 4 PERF thresholds verified)
Last activity: 2026-02-28 -- Plan 02-05 complete (seed utility + bench suite + p95 assertions)

Progress: [########..] 36% (9/25 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 2.63 min
- Total execution time: 0.35 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-database-foundation | 4 | 11 min | 2.75 min |
| 02-crud-query-layer | 5 | 14 min | 2.8 min |

**Recent Trend:**
- Last 5 plans: 3 min, 2 min, 4 min, 2 min, 3 min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- D-001..D-010: All architectural decisions locked and decided
- TDD enforcement: Non-negotiable red-green-refactor for every feature
- Research flexibility: Open to better tooling within locked architecture
- [Phase 01-database-foundation]: Removed rootDir from tsconfig.json to allow tests/ in include path; rootDir conflicts with includes outside src/ when using tsc --noEmit
- [Phase 01-database-foundation]: wasm-init.ts uses custom FTS5 WASM fallback to node_modules sql.js dist so config-validation tests run before Plan 02 WASM build
- [Phase 01-database-foundation]: SQL_WASM_PATH bracket notation used in wasm-init.ts to satisfy noPropertyAccessFromIndexSignature strict rule
- [01-02]: Custom FTS5 WASM built with local emcc 5.0.0 (Docker unavailable) -- build script now supports Docker-first + local emcc fallback
- [01-02]: WASM stored at src/assets/sql-wasm-fts5.wasm (not node_modules override) -- survives npm install
- [01-02]: macOS sha3sum workaround in build script -- pre-extract zip, touch target dir to satisfy make dependency
- [01-03]: Database.ts uses BindParams type (not unknown[]) for exec/run params to satisfy strict TypeScript
- [01-03]: UNIQUE constraint test uses non-NULL via_card_id -- SQLite treats NULL as distinct in UNIQUE constraints (SQL standard)
- [01-03]: applySchema() uses readFileSync + fileURLToPath(import.meta.url) for schema.sql path resolution in Node context
- [01-03]: Vite ?url import deferred to Plan 04 -- requires vite-env.d.ts declaration; locateFile uses SQL_WASM_PATH env or node_modules fallback for now
- [RESOLVED in 01-04]: vite-env.d.ts added; ?raw import used for schema.sql in production context
- [Phase 01-database-foundation]: Vite lib mode (not app mode): src/index.ts entry, ES format, sql.js externalized — produces dist/isometry.js for Phase 2+ consumers
- [Phase 01-database-foundation]: Schema loading: conditional dynamic import — node:fs in test context (SQL_WASM_PATH set), ?raw in Vite production context; removes static Node imports that blocked Vite bundling
- [02-01]: withStatement deferred to Phase 3+ — Database.prepare() not yet exposed; db.exec()/db.run() used for all Phase 2 queries
- [02-01]: updateCard verifies card exists post-update via getCard() — throws if not found or soft-deleted (avoids getRowsModified() complexity)
- [02-01]: deleteCard is idempotent — updates deleted_at on already-deleted cards without throwing
- [02-01]: src/index.ts pre-declares all Phase 2 query module re-exports — Plans 02-02..04 do NOT modify index.ts to prevent conflicts
- [02-03]: ORDER BY rank (FTS5 virtual column) used instead of ORDER BY bm25() — pre-computed, faster with LIMIT
- [02-03]: Test uses 'nonexistentxyzabc' (no hyphens) for no-match test — FTS5 MATCH throws on hyphenated terms (hyphen is an FTS5 minus operator)
- [02-03]: snippet column_index -1 auto-selects best matching column across all FTS5 columns
- [Phase 02-crud-query-layer]: UNIQUE constraint test uses non-NULL via_card_id — SQLite treats NULLs as distinct in UNIQUE (ISO SQL standard, same as [01-03] decision for cards)
- [Phase 02-crud-query-layer]: CONN-05 cascade behavior requires no implementation code — schema ON DELETE CASCADE/SET NULL handles it; tests verify using raw db.run DELETE
- [Phase 02-crud-query-layer]: Connections use hard delete (idempotent DELETE WHERE id=?) — no soft-delete on connections
- [02-04]: min_depth subquery required in connectedCards — UNION deduplicates (card_id, depth) pairs not just card_id; same card reachable at multiple depths via bidirectional traversal
- [02-04]: shortestPath uses path string accumulation with LIKE-based visited-node guard (not UNION dedup which collapses BFS branches)
- [02-04]: shortestPath hard-limited to depth 10 to prevent unbounded recursion on large graphs
- [02-05]: p99 used as conservative proxy for p95 in bench() — tinybench exposes p99 not p95; if p99 < threshold then p95 necessarily passes
- [02-05]: Dual bench/assertion approach — bench() for human reporting, assertion test for CI gate (bench() has no expect() API)
- [02-05]: Vitest 4 removed describe(name, fn, {timeout}) — timeout must be 2nd arg to it() instead

### Pending Todos

None yet.

### Blockers/Concerns

- [RESOLVED] sql.js FTS5 WASM -- custom WASM built and committed (src/assets/sql-wasm-fts5.wasm, 756KB, FTS5 verified)
- [RESOLVED] Database Foundation -- Database.ts, schema.sql, wasm-compat.ts implemented; 34/34 tests passing
- WKWebView WASM MIME type rejection -- wasm-compat.ts integration spike created (Phase 1); full solution (Swift WKURLSchemeHandler) in Phase 7
- [RESOLVED in 01-04] Vite ?url import for WASM -- vite-env.d.ts added; production build verified with viteStaticCopy
- alto-index JSON schema format needs verification before Phase 6 planning

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 02-crud-query-layer 02-05-PLAN.md (Performance benchmarks — seed utility + bench suite + p95 assertions; 151 total tests passing; Phase 2 complete)
Resume file: .planning/phases/03-providers/ (Phase 3: Providers — FilterProvider, AxisProvider, SelectionProvider, DensityProvider, ViewProvider)
