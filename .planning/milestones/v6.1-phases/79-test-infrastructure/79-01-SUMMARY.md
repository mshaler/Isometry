---
phase: 79-test-infrastructure
plan: 01
subsystem: test-infrastructure
tags: [test-harness, sql.js, providers, seam-tests, vitest]
dependency_graph:
  requires: []
  provides: [realDb, makeProviders, seedCards, seedConnections, test:harness, test:seams]
  affects: [phases/80, phases/81, phases/82, phases/83]
tech_stack:
  added: []
  patterns: [realDb-factory, makeProviders-factory, seed-helpers, seams-directory-tree]
key_files:
  created:
    - tests/harness/realDb.ts
    - tests/harness/seedCards.ts
    - tests/harness/seedConnections.ts
    - tests/harness/makeProviders.ts
    - tests/harness/smoke.test.ts
    - tests/seams/filter/.gitkeep
    - tests/seams/coordinator/.gitkeep
    - tests/seams/ui/.gitkeep
    - tests/seams/etl/.gitkeep
  modified:
    - package.json
decisions:
  - "seedConnections uses source_id/target_id (matching schema.sql) not from_card_id/to_card_id (plan spec)"
  - "test:seams uses --passWithNoTests flag so it exits 0 before Phase 80 adds any seam tests"
  - "ColumnInfo.notnull field included in buildColumnInfo — required by ColumnInfo interface in protocol.ts"
metrics:
  duration: "~12 minutes"
  completed: "2026-03-15"
  tasks_completed: 3
  files_created: 9
  files_modified: 1
---

# Phase 79 Plan 01: Test Infrastructure Summary

**One-liner:** In-memory sql.js Database factory + wired provider stack factory using real PRAGMA-derived SchemaProvider for seam test infrastructure.

## What Was Built

5 new files in `tests/harness/` giving all subsequent seam test phases (80-83) one-line database and provider setup:

- **`realDb()`** — async factory that returns a fresh in-memory `Database` with production schema applied. WASM path resolved by `SQL_WASM_PATH` env (set by existing globalSetup). Zero seed data.
- **`makeProviders(db)`** — synchronous factory returning `ProviderStack` with all 6 providers correctly wired. Builds `ColumnInfo[]` from `PRAGMA table_info()`, initializes `SchemaProvider`, wires both the allowlist module singleton and instance setters on `PAFVProvider`/`SuperDensityProvider`.
- **`seedCards(db, cards[])`** — partial-object seeder with sensible defaults. FTS5 populated automatically via `cards_fts_ai` trigger — no manual FTS inserts.
- **`seedConnections(db, connections[])`** — connection seeder with required `source_id`/`target_id` fields (matching actual schema columns).
- **`smoke.test.ts`** — 8 smoke tests proving both factories work end-to-end.

Also created `tests/seams/{filter,coordinator,ui,etl}/` directory tree for Phases 80-83 and added `test:harness`/`test:seams` npm scripts to `package.json`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | realDb, seedCards, seedConnections + seams tree | 23e5ee09 | realDb.ts, seedCards.ts, seedConnections.ts, 4x .gitkeep |
| 2 | makeProviders factory with SchemaProvider wiring | 2aaecdc1 | makeProviders.ts |
| 3 | Smoke tests + npm scripts | 592b7734 | smoke.test.ts, package.json |

## Verification Results

1. `npm run test:harness` — 8/8 tests pass green
2. `npm run test:seams` — exits with code 0, no test files (expected until Phase 80)
3. `npm run test` — 3348/3348 tests pass (no regressions)
4. `npx tsc --noEmit` — zero TypeScript errors in all new files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] connections table uses source_id/target_id, not from_card_id/to_card_id**
- **Found during:** Task 1 — reading schema.sql
- **Issue:** Plan spec specified `from_card_id` and `to_card_id` for `SeedConnection` interface, but `schema.sql` defines the connections table with `source_id` and `target_id` columns
- **Fix:** Used actual schema column names (`source_id`, `target_id`) in `SeedConnection` interface and INSERT statement
- **Files modified:** tests/harness/seedConnections.ts
- **Commit:** 23e5ee09

**2. [Rule 1 - Bug] ColumnInfo interface requires notnull field**
- **Found during:** Task 2 — reading protocol.ts ColumnInfo type
- **Issue:** `ColumnInfo` interface in `src/worker/protocol.ts` has a required `notnull: boolean` field not mentioned in the RESEARCH.md pattern
- **Fix:** Added `notnull` extraction from `PRAGMA table_info()` row[3] in `buildColumnInfo()`
- **Files modified:** tests/harness/makeProviders.ts
- **Commit:** 2aaecdc1

**3. [Rule 2 - Missing Functionality] test:seams needed --passWithNoTests flag**
- **Found during:** Task 3 — verification run
- **Issue:** Vitest exits with code 1 when no test files match the pattern. The plan requires `test:seams` to "exit cleanly with 0 test files"
- **Fix:** Added `--passWithNoTests` flag to the `test:seams` script
- **Files modified:** package.json
- **Commit:** 592b7734

**4. [Rule 1 - Bug] TypeScript strict mode errors in smoke.test.ts array indexing**
- **Found during:** Task 3 — `npx tsc --noEmit` verification
- **Issue:** Strict null checks flagged array index access (`rows[0].values[0][0]`) as potentially undefined
- **Fix:** Replaced direct indexing with optional chaining (`rows[0]?.values[0]?.[0]`) and non-null assertion on first ID
- **Files modified:** tests/harness/smoke.test.ts
- **Commit:** 592b7734 (amended)

## Self-Check: PASSED

Files exist:
- tests/harness/realDb.ts — FOUND
- tests/harness/seedCards.ts — FOUND
- tests/harness/seedConnections.ts — FOUND
- tests/harness/makeProviders.ts — FOUND
- tests/harness/smoke.test.ts — FOUND
- tests/seams/filter/.gitkeep — FOUND
- tests/seams/coordinator/.gitkeep — FOUND
- tests/seams/ui/.gitkeep — FOUND
- tests/seams/etl/.gitkeep — FOUND

Commits exist:
- 23e5ee09 — FOUND (realDb, seedCards, seedConnections, seams tree)
- 2aaecdc1 — FOUND (makeProviders)
- 592b7734 — FOUND (smoke tests, npm scripts, TypeScript fixes)
