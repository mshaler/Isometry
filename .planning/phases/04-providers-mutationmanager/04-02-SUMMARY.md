---
phase: 04-providers-mutationmanager
plan: 02
subsystem: worker
tags: [sql.js, worker, protocol, ui-state, undo-redo, tdd]

requires:
  - phase: 03-worker-bridge
    provides: WorkerBridge typed protocol (WorkerRequestType, WorkerPayloads, WorkerResponses) and exhaustive router pattern

provides:
  - Extended WorkerRequestType union with ui:get/set/delete/getAll and db:exec (18 total types)
  - ui-state.handler.ts with handleUiGet/Set/Delete/GetAll/DbExec
  - Generic db:exec surface for MutationManager inverse SQL (undo/redo)
  - Updated handlers/index.ts re-exporting all Phase 4 handlers

affects:
  - 04-03 (StateManager — consumes ui:get/set/delete/getAll via WorkerBridge)
  - 04-06 (MutationManager — consumes db:exec for inverse SQL undo/redo)

tech-stack:
  added: []
  patterns:
    - Handler thin-wrapper pattern extended to Phase 4 (same style as Phase 3)
    - db.exec('SELECT changes()') idiom for row-change count after db.run()
    - INSERT OR REPLACE with explicit updated_at strftime() for ui_state upsert

key-files:
  created:
    - src/worker/handlers/ui-state.handler.ts
    - tests/worker/ui-state.handler.test.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/index.ts
    - src/worker/worker.ts

key-decisions:
  - "Used db.exec('SELECT changes()') after db.run() to retrieve row-change count — Database class does not expose getRowsModified() directly, sql.js changes() SQL function is the correct approach"
  - "INSERT OR REPLACE with explicit strftime updated_at — ensures updated_at is refreshed on replace, not just on initial insert"
  - "handleDbExec accepts unknown[] params cast to BindParams — type safety at call site (MutationManager), not at handler boundary"

patterns-established:
  - "Protocol extension: add to WorkerRequestType union, WorkerPayloads, WorkerResponses in that order"
  - "Void handlers: return undefined as unknown as WorkerResponses['type'] cast pattern in router"
  - "ui_state read: db.exec() returns [{columns, values}] — check results.length and results[0].values.length before indexing"

requirements-completed: [PROV-10]

duration: 2min
completed: 2026-02-28
---

# Phase 4 Plan 02: UI State Worker Protocol Summary

**Typed ui_state CRUD handlers (ui:get/set/delete/getAll) and generic db:exec surface wired into the Phase 3 exhaustive worker router**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T20:07:43Z
- **Completed:** 2026-02-28T20:09:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended WorkerRequestType union from 13 to 18 types with zero breaking changes to Phase 3
- Created ui-state.handler.ts with 5 handler functions: handleUiGet/Set/Delete/GetAll/DbExec
- Wired all 5 new types into worker.ts exhaustive switch — TypeScript still compiles with never check intact
- 21 new handler tests added; 111 total worker tests pass with 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend protocol types and create ui-state handler** - `75e6dcc` (feat)
2. **Task 2: Wire ui-state and db:exec handlers into worker router** - `dd50dda` (feat)

**Plan metadata:** (pending final docs commit)

_Note: Task 1 used TDD — tests written first (RED), then handler implemented (GREEN), 21/21 pass._

## Files Created/Modified
- `src/worker/protocol.ts` - Added ui:get/set/delete/getAll and db:exec to WorkerRequestType, WorkerPayloads, WorkerResponses
- `src/worker/handlers/ui-state.handler.ts` - New: 5 handler functions for ui_state CRUD and db:exec
- `src/worker/handlers/index.ts` - Added re-export for ui-state.handler
- `src/worker/worker.ts` - Added import and 5 switch cases for new request types
- `tests/worker/ui-state.handler.test.ts` - New: 21 tests covering all handler behaviors and protocol type shapes

## Decisions Made
- Used `db.exec('SELECT changes()')` after `db.run()` to retrieve the row change count in `handleDbExec`. The `Database` class does not expose `getRowsModified()` directly; the sql.js `changes()` SQL function is the correct approach within the existing API surface.
- Used `INSERT OR REPLACE ... strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` explicitly for `updated_at` in handleUiSet, ensuring the timestamp updates on every upsert (schema DEFAULT only fires on INSERT, not on REPLACE).
- Cast `payload.params` to `BindParams` in handleDbExec — type safety is enforced at the call site (MutationManager), which will always pass validated inverse SQL parameters.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (StateManager) can now use `ui:get/set/delete/getAll` via WorkerBridge to persist Tier 2 provider state
- Plan 06 (MutationManager) can use `db:exec` to execute inverse SQL for undo/redo stacks
- TypeScript exhaustive switch in worker.ts is still intact — future protocol extensions follow the same pattern

## Self-Check: PASSED

- src/worker/handlers/ui-state.handler.ts: FOUND
- tests/worker/ui-state.handler.test.ts: FOUND
- 04-02-SUMMARY.md: FOUND
- Commit 75e6dcc: FOUND
- Commit dd50dda: FOUND

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*
