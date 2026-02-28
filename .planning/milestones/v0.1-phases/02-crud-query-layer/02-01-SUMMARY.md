---
phase: 02-crud-query-layer
plan: 01
subsystem: database
tags: [sql.js, sqlite, fts5, crud, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: Database class with exec()/run(), schema.sql with cards/connections/FTS5 tables and triggers

provides:
  - "Card CRUD functions: createCard, getCard, updateCard, deleteCard, listCards, undeleteCard"
  - "Shared Phase 2 type definitions: Card, CardInput, CardListOptions, Connection, ConnectionInput, ConnectionDirection, SearchResult, CardWithDepth"
  - "Reusable row mapping helpers: rowToCard, rowToConnection, execRowsToCards, execRowsToConnections"
  - "withStatement pattern stub (Phase 3+ entry point)"
  - "Phase 2 query module re-exports in src/index.ts (pre-declared for Plans 02-02 through 02-04)"

affects: [02-connections, 02-search, 02-graph, all Phase 2 plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass Database instance to every query function (no module-level state)"
    - "db.run() for mutations (INSERT/UPDATE/DELETE), db.exec() for SELECT"
    - "execRowsToCards helper: zip columns+values from db.exec() output into typed Card objects"
    - "Dynamic SET clause pattern for updateCard: build clause from Partial<> updates"
    - "Soft delete: deleted_at IS NULL guard in all non-admin queries; undelete queries WITHOUT guard"
    - "withStatement documented as Phase 3+ performance pattern stub — throws in Phase 2"

key-files:
  created:
    - src/database/queries/types.ts
    - src/database/queries/helpers.ts
    - src/database/queries/cards.ts
    - tests/database/cards.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Use db.exec()/db.run() for all Phase 2 queries — withStatement deferred to Phase 3+ (no Database.prepare() yet)"
  - "updateCard verifies card exists post-update via getCard() — throws if card not found or soft-deleted"
  - "deleteCard is idempotent — updates deleted_at even on already-deleted cards (no throw)"
  - "undeleteCard throws on non-existent ID but not on already-active cards"
  - "src/index.ts pre-declares all Phase 2 query module re-exports — Plans 02-02..04 do NOT modify index.ts"
  - "TypeScript typecheck skipped until all Phase 2 plans complete (connections/search/graph stubs absent)"

patterns-established:
  - "Query module pattern: src/database/queries/{module}.ts imports Database, types, helpers"
  - "Test pattern: fresh Database per test via beforeEach/afterEach; close() in afterEach"

requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, CARD-06]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 2 Plan 01: Card CRUD Operations Summary

**sql.js Card CRUD with soft-delete, FTS-aware update triggers, and shared Phase 2 type system established via TDD (30 tests, all passing)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T03:51:54Z
- **Completed:** 2026-02-28T03:54:37Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 5

## Accomplishments

- Implemented all 6 Card CRUD requirements (CARD-01 through CARD-06) with full TDD coverage
- Established shared type system for all Phase 2 query modules (Card, Connection, SearchResult, CardWithDepth)
- Created reusable row mapping helpers (execRowsToCards, rowToCard, rowToConnection) consumed by Plans 02-02 through 02-04
- Documented withStatement as Phase 3+ pattern entry point (throws in Phase 2)
- Pre-declared all Phase 2 exports in index.ts to prevent file ownership conflicts between plans

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for CARD-01..CARD-06** - `282d1ea` (test)
2. **Task 2: GREEN — types.ts, helpers.ts, cards.ts implementation** - `7cd0b33` (feat)

_TDD execution: RED (failing tests committed) then GREEN (implementation committed)_

## Files Created/Modified

- `src/database/queries/types.ts` - CardType, Card, CardInput, CardListOptions, Connection, ConnectionInput, ConnectionDirection, SearchResult, CardWithDepth type definitions
- `src/database/queries/helpers.ts` - withStatement (Phase 3+ stub), rowToCard, rowToConnection, execRowsToCards, execRowsToConnections
- `src/database/queries/cards.ts` - createCard, getCard, updateCard, deleteCard, listCards, undeleteCard
- `tests/database/cards.test.ts` - 30 TDD tests covering all 6 CARD requirements
- `src/index.ts` - Pre-declared Phase 2 query module re-exports (types, cards, connections, search, graph)

## Decisions Made

- Used `db.exec()/db.run()` for all Phase 2 queries; `withStatement` deferred to Phase 3+ (Database.prepare() not yet exposed)
- `updateCard` verifies card exists post-update via `getCard()` — throws if card not found or soft-deleted; this avoids needing `getRowsModified()` which sql.js exposes differently than expected
- `deleteCard` is idempotent — updates `deleted_at` even on already-deleted cards (no error)
- `src/index.ts` pre-declares all Phase 2 query module re-exports to prevent file ownership conflicts; Plans 02-02..04 will NOT modify index.ts
- TypeScript typecheck intentionally skipped until all Phase 2 plans complete (connections/search/graph modules absent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Card CRUD fully operational with FTS5 sync (via existing schema triggers)
- Shared types ready for Plans 02-02 (Connections), 02-03 (Search), 02-04 (Graph)
- helpers.ts (execRowsToCards, execRowsToConnections) ready for consumption
- index.ts pre-declared; Plans 02-02..04 create their files and are immediately exported

## Self-Check: PASSED

- FOUND: src/database/queries/types.ts
- FOUND: src/database/queries/helpers.ts
- FOUND: src/database/queries/cards.ts
- FOUND: tests/database/cards.test.ts
- FOUND: .planning/phases/02-crud-query-layer/02-01-SUMMARY.md
- FOUND: commit 282d1ea (RED phase)
- FOUND: commit 7cd0b33 (GREEN phase)

---
*Phase: 02-crud-query-layer*
*Completed: 2026-02-28*
