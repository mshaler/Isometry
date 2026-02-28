---
phase: 04-providers-mutationmanager
plan: 06
subsystem: database
tags: [mutation, command-pattern, undo-redo, sql, sqlite, typescript]

# Dependency graph
requires:
  - phase: 04-02
    provides: WorkerBridge with db:exec protocol type and send() infrastructure
  - phase: 04-01
    provides: FilterProvider, SQL safety patterns, allowlist conventions
provides:
  - MutationCommand and Mutation interfaces (command pattern types)
  - createCardMutation, updateCardMutation, deleteCardMutation (card inverse generators)
  - createConnectionMutation, deleteConnectionMutation (connection inverse generators)
  - batchMutation helper (reversed inverse ordering for multi-step undo)
  - MutationManager class (sole write gate: execute/undo/redo/dirty/subscribe)
  - WorkerBridge.exec() public convenience method for MutationManager
  - mutations/index.ts public module surface
affects: [05-views, phase-5, phase-6, phase-7, view-rendering, undo-redo-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command pattern: forward/inverse SQL arrays captured at mutation creation time (not at undo time)"
    - "rAF batching: pendingNotify guard collapses rapid writes into one subscriber notification per frame"
    - "Inverse pre-ordering: batchMutation reverses mutation array so inverse array is already in undo order"
    - "Boolean-to-int: is_collective stored as 0/1, not true/false, for SQLite compatibility"
    - "tags JSON serialization: string[] stored as TEXT via JSON.stringify in all card SQL"

key-files:
  created:
    - src/mutations/types.ts
    - src/mutations/inverses.ts
    - src/mutations/MutationManager.ts
    - src/mutations/index.ts
    - tests/mutations/types.test.ts
    - tests/mutations/inverses.test.ts
    - tests/mutations/MutationManager.test.ts
  modified:
    - src/worker/WorkerBridge.ts

key-decisions:
  - "WorkerBridge.exec() added as public convenience method wrapping private send('db:exec') — avoids exposing generic send() while giving MutationManager typed access to db:exec"
  - "MutationBridge interface extracted in MutationManager.ts — decouples MutationManager from WorkerBridge concrete class, enabling clean test mocking with just exec()"
  - "Inverse pre-computed at creation time, not at undo time — RESEARCH Pitfall 3: deleteCardMutation requires full Card row for inverse INSERT"
  - "batchMutation reverses the mutations array for inverse assembly — RESEARCH Pitfall 4: forward [A,B,C] → inverse array already ordered [undoC, undoB, undoA]"
  - "History depth capped at MAX_HISTORY=100 with FIFO eviction — console.warn logged once at first overflow"
  - "requestAnimationFrame pendingNotify guard: two rapid execute() calls produce exactly one subscriber notification per animation frame"

patterns-established:
  - "MutationManager pattern: all entity writes MUST go through execute() — no direct bridge.exec() calls from views"
  - "CARD_COLUMNS tuple in inverses.ts defines canonical 26-column ordering for INSERT statements"
  - "Mock bridge interface: MutationBridge with exec() is the correct shape for test isolation"

requirements-completed: [MUT-01, MUT-02, MUT-03, MUT-04, MUT-05, MUT-06]

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 4 Plan 06: MutationManager Summary

**Command-pattern mutation system with pre-computed inverse SQL, undo/redo history (capped at 100), dirty flag for CloudKit sync, and rAF-batched subscriber notifications**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T20:22:14Z
- **Completed:** 2026-02-28T20:28:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- MutationManager is sole write gate — execute(), undo(), redo() all route SQL through WorkerBridge.exec()
- Five inverse generators (createCard, updateCard, deleteCard, createConnection, deleteConnection) each compute forward + inverse SQL at creation time
- batchMutation correctly reverses the inverse array per RESEARCH Pitfall 4
- rAF batching: `pendingNotify` guard collapses multiple rapid execute() calls into one subscriber notification per animation frame
- 75 tests across 3 test files — all green

## Task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **Task 1: Mutation types and inverse SQL generators (RED)** - `d12b071` (test)
2. **Task 1: Mutation types and inverse SQL generators (GREEN)** - `53c7017` (feat)
3. **Task 2: MutationManager with execute/undo/redo, dirty flag, rAF batching (RED)** - `f615838` (test)
4. **Task 2: MutationManager with execute/undo/redo, dirty flag, rAF batching (GREEN)** - `c72f489` (feat)

_Note: TDD tasks have two commits per task (test → feat)_

## Files Created/Modified

- `src/mutations/types.ts` - MutationCommand and Mutation interfaces
- `src/mutations/inverses.ts` - Five inverse generators + batchMutation helper
- `src/mutations/MutationManager.ts` - Sole write gate: execute/undo/redo, dirty, rAF subscribers
- `src/mutations/index.ts` - Public re-exports for the mutations module
- `src/worker/WorkerBridge.ts` - Added public exec() method wrapping db:exec
- `tests/mutations/types.test.ts` - Interface shape tests (4 tests)
- `tests/mutations/inverses.test.ts` - Inverse generator tests (36 tests)
- `tests/mutations/MutationManager.test.ts` - MutationManager behavior tests (35 tests)

## Decisions Made

- **WorkerBridge.exec() public method**: Since `send()` is private and Plan 05 (QueryBuilder) handles the broader access concern, added a typed `exec()` convenience method that only exposes `db:exec` — keeps send() private while giving MutationManager exactly what it needs.
- **MutationBridge interface**: Extracted `{ exec(sql, params): Promise<{changes}> }` interface so MutationManager can be tested without a real WorkerBridge instance.
- **Inverse computed at creation time**: Critical correctness constraint — if we computed inverse at undo time, the data could have changed. The `before: Card` parameter in updateCardMutation captures the snapshot at mutation creation.
- **batchMutation pre-reverses inverse**: Stores `[undoC, undoB, undoA]` so undo() simply iterates `mutation.inverse` in array order — no reversal logic in MutationManager itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added WorkerBridge.exec() public method**
- **Found during:** Task 2 (MutationManager implementation)
- **Issue:** `send()` is private in WorkerBridge; MutationManager needs to call `bridge.send('db:exec', ...)` per the plan. Plan notes "Plan 05 addresses making send() public" but Plan 05 hasn't run yet.
- **Fix:** Added public `exec(sql, params)` convenience method to WorkerBridge that wraps `send('db:exec', {sql, params})`. MutationBridge interface uses this narrower shape.
- **Files modified:** `src/worker/WorkerBridge.ts`
- **Verification:** TypeScript compiles cleanly; all 35 MutationManager tests pass.
- **Committed in:** `c72f489` (Task 2 feat commit)

**2. [Rule 1 - Bug] Fixed TypeScript strict-mode array indexing in test files**
- **Found during:** Post-Task-2 TypeScript compilation check
- **Issue:** Array indexing `arr[0]` returns `T | undefined` in strict TypeScript; test files accessed `.sql`, `.params` etc. without null guards, producing 49 TS errors.
- **Fix:** Added non-null assertions (`arr[0]!`) at all array index access sites in both test files.
- **Files modified:** `tests/mutations/inverses.test.ts`, `tests/mutations/MutationManager.test.ts`
- **Verification:** `npx tsc --noEmit` exits with 0.
- **Committed in:** `c72f489` (included in Task 2 feat commit as TypeScript compliance)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for TypeScript correctness and module access. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MutationManager complete and ready for Phase 5 view integration
- Views will call `mm.execute(createCardMutation(...))` to write cards — never bridge directly
- Plan 05 (QueryBuilder + StateManager) still pending — run `gsd:execute-phase 04-providers-mutationmanager 05` if QueryBuilder is needed before Phase 5
- All 6 MUT requirements satisfied (MUT-01 through MUT-06)

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*

## Self-Check: PASSED

All files verified present. All commits verified in git log.

| Item | Status |
|------|--------|
| src/mutations/types.ts | FOUND |
| src/mutations/inverses.ts | FOUND |
| src/mutations/MutationManager.ts | FOUND |
| src/mutations/index.ts | FOUND |
| tests/mutations/types.test.ts | FOUND |
| tests/mutations/inverses.test.ts | FOUND |
| tests/mutations/MutationManager.test.ts | FOUND |
| 04-06-SUMMARY.md | FOUND |
| d12b071 (test RED task 1) | VERIFIED |
| 53c7017 (feat GREEN task 1) | VERIFIED |
| f615838 (test RED task 2) | VERIFIED |
| c72f489 (feat GREEN task 2) | VERIFIED |
