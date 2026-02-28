---
phase: 02-crud-query-layer
plan: 02
subsystem: database
tags: [sql.js, sqlite, connections, graph, crud, typescript, vitest, tdd, fk-cascade]

# Dependency graph
requires:
  - phase: 02-crud-query-layer
    plan: 01
    provides: "Database class, types.ts (Connection/ConnectionInput/ConnectionDirection), helpers.ts (execRowsToConnections), cards.ts (createCard for test data setup)"

provides:
  - "Connection CRUD functions: createConnection, getConnections, deleteConnection"
  - "Direction-based graph edge queries: outgoing/incoming/bidirectional"
  - "Via card bridge pattern storage and retrieval"
  - "FK cascade verification: ON DELETE CASCADE for source/target, ON DELETE SET NULL for via_card"

affects: [02-graph, 02-search, 03-providers, 05-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass Database instance to every connection query function (no module-level state)"
    - "execRowsToConnections helper: converts db.exec() columns+values matrix to typed Connection[]"
    - "Switch-case direction routing: three SQL branches for outgoing/incoming/bidirectional"
    - "Hard delete pattern for connections: db.run() with DELETE FROM — no soft-delete on connections"
    - "Cascade testing pattern: raw db.run('DELETE FROM cards') to trigger ON DELETE CASCADE/SET NULL"

key-files:
  created:
    - src/database/queries/connections.ts
    - tests/database/connections.test.ts
  modified: []

key-decisions:
  - "UNIQUE constraint test uses non-NULL via_card_id — SQLite treats NULLs as distinct in UNIQUE (ISO SQL standard, same as [01-03] decision for cards)"
  - "CONN-05 cascade behavior requires no implementation code — schema ON DELETE CASCADE/SET NULL handles it; tests verify using raw db.run('DELETE FROM cards')"
  - "Connections use hard delete (no soft-delete) — deleteConnection is idempotent via plain DELETE WHERE id=?"
  - "Production build test pre-existing failure (graph.ts absent) is out of scope per STATE.md — typecheck deferred until all Phase 2 plans complete"

patterns-established:
  - "Test cascade behavior with raw SQL hard delete — not the soft-delete API in cards.ts"
  - "Verify ON DELETE SET NULL by checking via_card_id column value after card deletion"

requirements-completed: [CONN-01, CONN-02, CONN-03, CONN-04, CONN-05]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 2 Plan 02: Connection CRUD Operations Summary

**sql.js Connection CRUD with direction-filtered graph traversal, via_card bridge pattern, FK cascade verification — 23 TDD tests passing, CONN-01 through CONN-05 complete**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-28T10:58:18Z
- **Completed:** 2026-02-28T11:02:00Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 2

## Accomplishments

- Implemented all 5 Connection CRUD requirements (CONN-01 through CONN-05) with full TDD coverage
- createConnection generates UUID, enforces FK constraints on source/target/via_card references
- getConnections supports three directions (outgoing/incoming/bidirectional) with ORDER BY created_at DESC
- deleteConnection is idempotent (safe to call with non-existent IDs)
- CONN-05 cascade behavior (ON DELETE CASCADE on source/target, ON DELETE SET NULL on via_card) verified via tests using raw SQL card deletion
- 23 connection tests pass with zero regressions in cards (30) and Database (34) test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for CONN-01..CONN-05** - `9823b34` (test)
2. **Task 2: GREEN — connections.ts implementation** - `89fc75a` (feat)

_TDD execution: RED (failing tests committed, module missing) then GREEN (implementation + auto-fixed UNIQUE test)_

## Files Created/Modified

- `src/database/queries/connections.ts` - createConnection, getConnections, deleteConnection (93 lines)
- `tests/database/connections.test.ts` - 23 TDD tests covering all 5 CONN requirements (385 lines)

## Decisions Made

- UNIQUE constraint test uses non-NULL `via_card_id` — SQLite treats NULLs as distinct in UNIQUE constraints (ISO SQL standard). When `via_card_id=NULL` and `label=NULL`, two otherwise identical rows are NOT considered duplicates. This is the same behavior documented in decision [01-03] for cards.
- CONN-05 requires no implementation code — the schema's `ON DELETE CASCADE` on `source_id`/`target_id` and `ON DELETE SET NULL` on `via_card_id` handle cascade behavior automatically. Tests use raw `db.run('DELETE FROM cards WHERE id = ?')` to trigger the cascade.
- Connections use hard delete (idempotent DELETE WHERE id=?). No soft-delete on connections — they are ephemeral graph edges.
- TypeScript typecheck produces pre-existing errors (graph.ts absent, search.test.ts issues from Plan 02-03). These are out of scope per STATE.md: "typecheck skipped until all Phase 2 plans complete."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed UNIQUE constraint test expectation to use non-NULL via_card_id**
- **Found during:** Task 2 (GREEN phase — running tests after implementation)
- **Issue:** Test `throws UNIQUE constraint violation on duplicate (same source, target, via_card_id=null, label=null)` expected an error, but SQLite does NOT enforce UNIQUE when all NULL columns differ — each NULL is treated as distinct (ISO SQL standard). Same as documented decision [01-03] in STATE.md.
- **Fix:** Updated test to use `via_card_id: cardC.id` (non-NULL) and `label: 'duplicate-label'` (non-NULL) so UNIQUE enforcement triggers reliably. Added comment explaining SQLite NULL behavior.
- **Files modified:** tests/database/connections.test.ts
- **Verification:** All 23 tests pass including the UNIQUE violation test
- **Committed in:** `89fc75a` (Task 2 GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test expectation)
**Impact on plan:** Auto-fix necessary for correct test semantics. No scope creep. SQLite NULL behavior is the documented standard (consistent with [01-03]).

## Issues Encountered

- SQLite UNIQUE constraint with all-NULL columns: SQLite (ISO SQL standard) treats NULL as distinct in UNIQUE constraints. When `via_card_id=NULL` and `label=NULL`, duplicate rows pass the UNIQUE check. Fixed by using non-NULL values in the UNIQUE violation test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Connection CRUD fully operational with FK cascade verification
- Shared types (Connection, ConnectionInput, ConnectionDirection) from Plan 01 consumed without modification
- execRowsToConnections helper from Plan 01 consumed correctly
- Ready for Plan 02-04 (Graph traversal) — connectedCards and shortestPath will build on getConnections
- Production build still failing (graph.ts absent) — this resolves when Plan 02-04 completes

## Self-Check: PASSED

- FOUND: src/database/queries/connections.ts
- FOUND: tests/database/connections.test.ts
- FOUND: .planning/phases/02-crud-query-layer/02-02-SUMMARY.md
- FOUND: commit 9823b34 (RED phase)
- FOUND: commit 89fc75a (GREEN phase)

---
*Phase: 02-crud-query-layer*
*Completed: 2026-02-28*
