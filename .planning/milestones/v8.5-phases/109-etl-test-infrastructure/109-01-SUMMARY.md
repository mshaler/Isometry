---
phase: 109-etl-test-infrastructure
plan: 01
subsystem: testing
tags: [playwright, e2e, etl, better-sqlite3, sql.js, bridge]

# Dependency graph
requires:
  - phase: 108-view-navigation
    provides: window.__isometry bridge API established, coordinator.scheduleUpdate() available
provides:
  - ETL E2E helper library (importNativeCards, assertCatalogRow, resetDatabase)
  - window.__isometry.queryAll(sql, params?) for Playwright SQL introspection
  - window.__isometry.exec(sql) for DDL/DML from Playwright
  - better-sqlite3 and tmp devDependencies for fixture generation
affects: [110-native-notes-e2e, 111-native-reminders-e2e, 112-native-calendar-e2e, 113-alto-index-e2e]

# Tech tracking
tech-stack:
  added: [better-sqlite3@12.8.0, @types/better-sqlite3@7.6.13, tmp@0.2.5, @types/tmp]
  patterns: [page.evaluate wrapping bridge.send for E2E SQL access, CanonicalCard interface in E2E layer, catalog table assertion pattern]

key-files:
  created: [e2e/helpers/etl.ts]
  modified: [src/main.ts, package.json, package-lock.json]

key-decisions:
  - "CanonicalCard interface duplicated in e2e/helpers/etl.ts rather than imported from src/ to keep E2E helpers self-contained and avoid build tool boundary issues"
  - "assertCatalogRow uses three-table verification (import_sources + import_runs + cards) matching full ETL provenance chain"
  - "Catalog table deletions in resetDatabase wrapped in try/catch for table-may-not-exist safety"
  - "queryAll/exec exposed on window.__isometry with no debug flag gating — __isometry namespace is already dev/debug-only per CONTEXT.md"

patterns-established:
  - "ETL E2E test isolation pattern: resetDatabase() before each test, importNativeCards() to inject data, assertCatalogRow() to verify"
  - "Bridge-mediated SQL pattern: Playwright never queries DB directly, always routes through bridge.send('db:query') via queryAll/exec"

requirements-completed: [INFR-01, INFR-03, INFR-05]

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 109 Plan 01: ETL Test Infrastructure Summary

**ETL E2E helper library with importNativeCards/assertCatalogRow/resetDatabase plus queryAll/exec on window.__isometry for Playwright SQL introspection**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T09:00:00Z
- **Completed:** 2026-03-22T09:15:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed better-sqlite3, @types/better-sqlite3, tmp, @types/tmp as devDependencies for ETL fixture generation in phases 110-113
- Added `queryAll(sql, params?)` and `exec(sql)` to `window.__isometry`, wrapping `bridge.send('db:query')` — enables Playwright tests to query sql.js from `page.evaluate()`
- Created `e2e/helpers/etl.ts` with three exported helpers: `importNativeCards` (dispatch CanonicalCard[] through bridge), `assertCatalogRow` (verify import provenance in 3 catalog tables), `resetDatabase` (clear tables for test isolation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install devDependencies and add queryAll/exec to window.__isometry** - `a79345e0` (feat) — Note: committed as part of 109-02 context session by prior agent
2. **Task 2: Create e2e/helpers/etl.ts** - `0dcca926` (feat)

## Files Created/Modified
- `e2e/helpers/etl.ts` - ETL E2E helper library: importNativeCards, assertCatalogRow, resetDatabase, CanonicalCard interface
- `src/main.ts` - Added queryAll/exec methods to window.__isometry object (committed in a79345e0)
- `package.json` - Added better-sqlite3, @types/better-sqlite3, tmp, @types/tmp to devDependencies (committed in a79345e0)
- `package-lock.json` - Lock file updated for new devDependencies (committed in a79345e0)

## Decisions Made
- CanonicalCard interface duplicated in `e2e/helpers/etl.ts` rather than imported from `src/etl/types.ts` to keep E2E helpers self-contained
- Three-table assertion pattern for `assertCatalogRow`: import_sources + import_runs + cards covers the full ETL provenance chain
- No debug flag gating on `queryAll`/`exec` — `window.__isometry` is already dev/debug-only per CONTEXT.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 1 work (devDependencies installation + queryAll/exec) was already committed in a prior agent session (commit `a79345e0`) that ran plan 109-02 before 109-01. The changes were present in the working tree and passed all acceptance criteria. Task 2 (etl.ts creation) proceeded normally.
- Pre-existing TypeScript error in `tests/seams/ui/dataset-eviction.test.ts` (argument type mismatch on `db.run()`) exists before this plan's work — out of scope per deviation scope boundary rule, logged to deferred items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ETL E2E helper library ready for use in phases 110-113 (native ETL adapter E2E tests)
- `importNativeCards` is the primary injection mechanism for all native source types
- `assertCatalogRow` + `resetDatabase` pattern is established for test isolation
- TypeScript compiles clean for all new code
