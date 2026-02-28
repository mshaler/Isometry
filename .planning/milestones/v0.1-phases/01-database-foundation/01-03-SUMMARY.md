---
phase: 01-database-foundation
plan: 03
subsystem: database
tags: [sql.js, sqlite, fts5, tdd, schema, typescript, wasm]

# Dependency graph
requires:
  - 01-01 (TypeScript scaffold, Vitest pool:forks, SQL_WASM_PATH env contract)
  - 01-02 (custom FTS5 WASM artifact at src/assets/sql-wasm-fts5.wasm)
provides:
  - "Database class with initialize(), exec(), run(), close() (src/database/Database.ts)"
  - "Canonical SQLite schema: cards, connections, cards_fts, ui_state (src/database/schema.sql)"
  - "WKWebView WASM fetch() patch (src/database/wasm-compat.ts)"
  - "Full test suite for DB-01 through DB-06 (tests/database/Database.test.ts)"
affects:
  - all-phases (every subsequent phase uses Database class)
  - 01-04 (Vite production smoke test depends on Database.ts + schema.sql)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD red-green: write failing tests first, then implement to pass"
    - "sql.js locateFile: SQL_WASM_PATH env var (test) -> node_modules fallback"
    - "Schema via readFileSync(schema.sql) relative to import.meta.url"
    - "BindParams type used for exec/run params (not unknown[])"
    - "Three-trigger FTS sync: cards_fts_ai, cards_fts_ad, cards_fts_au (separate triggers required)"

key-files:
  created:
    - src/database/Database.ts
    - src/database/schema.sql
    - src/database/wasm-compat.ts
    - tests/database/Database.test.ts
  modified: []

key-decisions:
  - "Database.ts uses BindParams type (not unknown[]) for exec/run params to satisfy strict TypeScript"
  - "UNIQUE constraint test uses non-NULL via_card_id: SQLite treats NULL as distinct in UNIQUE constraints (SQL standard)"
  - "applySchema() uses readFileSync + fileURLToPath(import.meta.url) for schema.sql path resolution in Node context"
  - "Removed Vite ?url import from Database.ts top-level: avoids TypeScript TS2307 (no declaration for ?url syntax in tsc)"
  - "WKWebView detection casts window via (window as unknown as Record<string,unknown>) to satisfy noUncheckedIndexedAccess"

requirements-completed: [DB-01, DB-02, DB-03, DB-04, DB-06]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 1 Plan 03: Database Foundation Summary

**sql.js wrapper with FTS5-enabled schema, three-trigger sync, and 34-test TDD suite verifying DB-01 through DB-06 including cascade delete and FTS integrity-check**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T06:05:08Z
- **Completed:** 2026-02-28T06:08:51Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 4

## Accomplishments

- Wrote 34 failing tests covering all Database Foundation requirements (DB-01 through DB-06) — RED phase committed first
- Created `src/database/schema.sql` with full canonical DDL from Contracts.md: cards (25 columns, CHECK constraint on card_type), connections (UNIQUE on source/target/via/label, CASCADE + SET NULL foreign keys), cards_fts virtual table (porter unicode61 tokenizer), ui_state; all 9 required indexes (6 on cards, 3 on connections)
- Created `src/database/Database.ts`: sql.js wrapper with `initialize()` (locateFile callback for test/browser contexts, PRAGMA foreign_keys = ON, applySchema via readFileSync), `exec()`, `run()`, `close()`
- Created `src/database/wasm-compat.ts`: WKWebView fetch() patch (Approach A from research Pattern 6) — gated behind WKWebView detection, XHR fallback for WASM MIME type rejection; Phase 7 will replace with Swift WKURLSchemeHandler
- All 34 tests pass; `npm run typecheck` exits 0 with zero errors

## Task Commits

Each task committed atomically:

1. **TDD RED - Failing tests** - `d8f699b` (test) — 34 failing tests for DB-01 through DB-06
2. **TDD GREEN - Implementation** - `5e45b8f` (feat) — Database.ts, schema.sql, wasm-compat.ts; all 34 pass

## Files Created/Modified

- `src/database/schema.sql` — Canonical DDL: cards, connections, cards_fts (FTS5 porter/unicode61), ui_state; 9 indexes; 3 FTS sync triggers
- `src/database/Database.ts` — sql.js wrapper class with initialize/exec/run/close; foreign_keys=ON; schema via readFileSync
- `src/database/wasm-compat.ts` — WKWebView fetch() patch for WASM MIME type (Phase 1 integration spike)
- `tests/database/Database.test.ts` — 34-test suite covering DB-01 (FTS5 init), DB-02 (schema + indexes), DB-03 (FTS triggers), DB-04 (integrity-check), DB-06 (foreign keys + cascade)

## Decisions Made

- **BindParams type instead of unknown[]:** The `@types/sql.js` `run()` and `exec()` signatures expect `BindParams = SqlValue[] | Record<string, SqlValue>`. Passing `unknown[]` fails strict TypeScript. Changed exec/run signatures to use `BindParams` directly.
- **UNIQUE constraint test with non-NULL via_card_id:** SQLite treats NULL as distinct in UNIQUE constraints per the SQL standard. Two rows with `(source, target, NULL, label)` are considered different even when all other values match. The test correctly verifies the UNIQUE constraint using a concrete via_card_id value.
- **readFileSync for schema.sql:** In the Vitest Node environment, the Vite `?url` import syntax (`schema.sql?raw`) is not available. Using `readFileSync` with `fileURLToPath(import.meta.url)` provides portable path resolution in Node and after Vite compilation.
- **Removed top-level ?url import:** `import sqlWasmUrl from '../assets/sql-wasm-fts5.wasm?url'` causes TypeScript TS2307 (no module declaration for Vite-specific ?url syntax). The locateFile callback handles browser context via `SQL_WASM_PATH` env var or node_modules fallback — the Vite `?url` pattern will be added in Plan 04 (production smoke test) with a proper `vite-env.d.ts` declaration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UNIQUE constraint test incorrectly used NULL via_card_id**
- **Found during:** TDD GREEN (first test run — 33/34 passing)
- **Issue:** Test inserted two connections with `via_card_id = NULL` and same `(source, target, label)`, expected UNIQUE violation. SQLite treats NULL as distinct in UNIQUE constraints per SQL standard, so no violation fires.
- **Fix:** Updated test to use a concrete via_card_id value for both rows. This correctly tests the UNIQUE constraint behavior documented in Contracts.md.
- **Files modified:** `tests/database/Database.test.ts`
- **Verification:** 34/34 tests pass after fix
- **Committed in:** `5e45b8f` (GREEN commit)

**2. [Rule 3 - Blocking] TypeScript errors in Database.ts and wasm-compat.ts**
- **Found during:** TDD GREEN (typecheck after tests passed)
- **Issue 1:** `exec()` and `run()` passed `unknown[]` to sql.js which expects `BindParams`. Strict TypeScript rejects the assignment.
- **Issue 2:** `wasm-compat.ts` cast `window` to `Record<string, unknown>` directly — TypeScript requires going through `unknown` first.
- **Issue 3:** Test array access `ids[i]` typed as `string | undefined` due to `noUncheckedIndexedAccess` — not assignable to `SqlValue`.
- **Fix:** Changed exec/run params to `BindParams`; changed window cast to `(window as unknown as Record<string, unknown>)`; added `!` non-null assertions in test for known-safe indexed access.
- **Files modified:** `src/database/Database.ts`, `src/database/wasm-compat.ts`, `tests/database/Database.test.ts`
- **Verification:** `npm run typecheck` exits 0 with zero errors
- **Committed in:** `5e45b8f` (GREEN commit)

### Deferred to Plan 04

- **Vite ?url import for WASM in browser context:** `Database.ts` currently falls back to `node_modules/sql.js/dist/<file>` when `SQL_WASM_PATH` is not set. The proper browser/production path uses `import sqlWasmUrl from '../assets/sql-wasm-fts5.wasm?url'` which requires a Vite environment declaration (`vite-env.d.ts` with `/// <reference types="vite/client" />`). Plan 04 (production smoke test) will add this and verify `vite build` succeeds.

## Coverage Summary

| Requirement | Status | Verified By |
|-------------|--------|-------------|
| DB-01: sql.js init + FTS5 | DONE | pragma_compile_options test |
| DB-02: Canonical schema | DONE | 16 schema tests (tables, indexes, constraints) |
| DB-03: Three FTS triggers | DONE | trigger existence + FTS search after insert/update/delete |
| DB-04: FTS integrity-check | DONE | 5 integrity-check tests (single, batch, update, delete, mixed) |
| DB-05: Vite config | DONE in Plan 01 | (not in scope for this plan) |
| DB-06: Foreign keys | DONE | PRAGMA check + cascade delete (source + target) + SET NULL (via) |

WKWebView verification: code path created (wasm-compat.ts with patchFetchForWasm()), verification deferred to Phase 7 (Native Shell — Swift WKWebView host does not exist yet).

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `Database` class is ready for use by all subsequent plans
- Plan 01-04 (Vite production smoke test) can verify `vite build` with Database.ts
- `wasm-compat.ts` is available to be called before `initSqlJs()` in browser entry point
- FTS5 three-trigger sync is verified correct via integrity-check tests

## Self-Check: PASSED

Files present:
- `src/database/Database.ts` — FOUND
- `src/database/schema.sql` — FOUND
- `src/database/wasm-compat.ts` — FOUND
- `tests/database/Database.test.ts` — FOUND

Commits present:
- `d8f699b` (TDD RED — failing tests) — FOUND
- `5e45b8f` (TDD GREEN — implementation) — FOUND

Test results: 34/34 passing
TypeScript: 0 errors

---
*Phase: 01-database-foundation*
*Completed: 2026-02-28*
