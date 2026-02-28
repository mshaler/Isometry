---
phase: 04-providers-mutationmanager
plan: 04
subsystem: ui
tags: [selection, provider, coordinator, batching, microtask, settimeout, tier3, ephemeral]

# Dependency graph
requires:
  - phase: 04-01
    provides: "PersistableProvider interface and provider type system (types.ts, allowlist.ts)"

provides:
  - "SelectionProvider: Tier 3 ephemeral selection state with toggle/range/selectAll"
  - "StateCoordinator: cross-provider change batching via setTimeout(16)"
  - "providers/index.ts: re-exports for SelectionProvider and StateCoordinator"

affects:
  - 04-05 (QueryBuilder uses StateCoordinator to trigger view updates)
  - 05-views (views use SelectionProvider for Cmd+click/Shift+click patterns)
  - 04-06 (StateManager integrates StateCoordinator for view lifecycle)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tier 3 ephemeral provider: SelectionProvider has no toJSON/setState/resetToDefaults — omission is intentional D-005 enforcement"
    - "Two-tier batching: providers use queueMicrotask (self-notification); StateCoordinator uses setTimeout(16) (cross-provider)"
    - "range(id, allIds) pattern: views pass their current sorted list — avoids orderedIdsGetter complexity in Phase 4"

key-files:
  created:
    - src/providers/SelectionProvider.ts
    - src/providers/StateCoordinator.ts
    - tests/providers/SelectionProvider.test.ts
    - tests/providers/StateCoordinator.test.ts
  modified:
    - src/providers/index.ts

key-decisions:
  - "queueMicrotask for SelectionProvider self-notification batches rapid same-frame changes to one subscriber call"
  - "setTimeout(16) for StateCoordinator ensures all provider microtasks drain before views are notified"
  - "range() accepts allIds as parameter (not a getter callback) — Phase 5 views will pass their current sort order"
  - "PAFVProvider/DensityProvider index.ts re-exports deferred: those files don't exist yet (Plan 03 not yet executed)"

patterns-established:
  - "Tier 3 provider pattern: no PersistableProvider implementation, no persistence methods, pure in-memory"
  - "Coordinator pattern: StateCoordinator is the only class aware of all providers; providers don't know each other"

requirements-completed: [PROV-05, PROV-06, PROV-09, PROV-11]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 4 Plan 04: SelectionProvider + StateCoordinator Summary

**Tier 3 ephemeral selection (toggle/range/select-all via queueMicrotask) and cross-provider setTimeout(16) batching coordinator**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-28T20:15:21Z
- **Completed:** 2026-02-28T20:18:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- SelectionProvider: in-memory selection with toggle (Cmd+click), range (Shift+click), select-all — no persistence (D-005)
- StateCoordinator: subscribes to any SubscribableProvider, batches change notifications via setTimeout(16)
- Both return unsubscribe cleanup functions from subscribe() (PROV-11)
- 46 new tests (31 SelectionProvider + 15 StateCoordinator), 185 total across all providers

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: SelectionProvider failing tests** - `4f01378` (test)
2. **Task 1 GREEN: SelectionProvider implementation** - `576406a` (feat)
3. **Task 2 RED: StateCoordinator failing tests** - `3f1a3b0` (test)
4. **Task 2 GREEN: StateCoordinator + index.ts + bug fixes** - `916bc5b` (feat)

_Note: TDD tasks have separate test (RED) and implementation (GREEN) commits_

## Files Created/Modified

- `src/providers/SelectionProvider.ts` - Tier 3 ephemeral selection; toggle/range/selectAll/clear; queueMicrotask batching
- `src/providers/StateCoordinator.ts` - Cross-provider batching via setTimeout(16); registerProvider/unregisterProvider/destroy
- `src/providers/index.ts` - Added re-exports for SelectionProvider and StateCoordinator
- `tests/providers/SelectionProvider.test.ts` - 31 tests covering all selection modes and Tier 3 enforcement
- `tests/providers/StateCoordinator.test.ts` - 15 tests covering batching, multi-provider, subscribe/destroy lifecycle

## Decisions Made

- **Two-tier batching architecture**: providers use `queueMicrotask` for self-notification (fires after current sync code, before macrotasks). StateCoordinator uses `setTimeout(16)` for cross-provider batching — fires after all microtasks drain, ensuring all providers settle before views receive one notification.
- **range(id, allIds) takes list as parameter**: Avoids needing an `orderedIdsGetter` callback in Phase 4 where views don't exist yet. Phase 5 views will pass their current sorted card list directly.
- **SubscribableProvider interface is local to StateCoordinator**: Only interface needed is `subscribe(cb: () => void): () => void` — no need to expose it in types.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `allIds[i]` array access in strict TypeScript**
- **Found during:** Task 1 GREEN (TypeScript compilation check)
- **Issue:** `allIds[i]` in `range()` loop is typed as `string | undefined` in strict mode (noUncheckedIndexedAccess not active but noImplicitAny strict checks caught it)
- **Fix:** Added `if (id !== undefined)` guard in the range loop
- **Files modified:** `src/providers/SelectionProvider.ts`
- **Verification:** `npx tsc --noEmit` passes (excluding pre-existing Plan 03 error)
- **Committed in:** `916bc5b` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Fixed TypeScript cast in Tier 3 enforcement tests**
- **Found during:** Task 2 GREEN (TypeScript compilation check)
- **Issue:** `(provider as Record<string, unknown>)` cast fails in strict mode — class without index signature cannot be directly cast
- **Fix:** Changed to `(provider as unknown as Record<string, unknown>)` (cast through unknown)
- **Files modified:** `tests/providers/SelectionProvider.test.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** `916bc5b` (Task 2 GREEN commit)

**3. [Rule 1 - Out of scope] DensityProvider.test.ts pre-existing failure**
- **Found during:** Overall verification (running all provider tests)
- **Issue:** `tests/providers/DensityProvider.test.ts` fails because Plan 03 committed RED tests but implementation hasn't been executed yet
- **Fix:** None — this is Plan 03's responsibility, out of scope for Plan 04
- **Deferred to:** Plan 03 (PAFVProvider + DensityProvider)

**4. PAFVProvider/DensityProvider re-exports deferred**
- **Context:** Plan 04 was supposed to add PAFVProvider and DensityProvider to index.ts (as Plan 03 avoids index.ts to prevent conflicts)
- **Issue:** Plan 03 hasn't been executed — those .ts files don't exist yet
- **Action:** Only SelectionProvider and StateCoordinator added to index.ts. PAFVProvider/DensityProvider re-exports will be added when Plan 03 executes, or can be done as a patch after Plan 03 completes.

---

**Total deviations:** 2 auto-fixed TypeScript bugs + 2 out-of-scope/deferred items
**Impact on plan:** Auto-fixes were strict-mode correctness requirements. Out-of-scope items are Plan 03 dependencies that will resolve when Plan 03 executes.

## Issues Encountered

- DensityProvider.test.ts pre-existing RED failure in the test suite (from Plan 03's RED commit) — ran targeted test commands excluding it for verification purposes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SelectionProvider ready for Phase 5 views (toggle/range/select-all patterns implemented)
- StateCoordinator ready for QueryBuilder integration (Phase 4 Plan 05)
- index.ts will need PAFVProvider/DensityProvider re-exports once Plan 03 executes
- 185 provider tests passing

## Self-Check: PASSED

All files present and all task commits verified:
- `src/providers/SelectionProvider.ts` - FOUND
- `src/providers/StateCoordinator.ts` - FOUND
- `tests/providers/SelectionProvider.test.ts` - FOUND
- `tests/providers/StateCoordinator.test.ts` - FOUND
- `.planning/phases/04-providers-mutationmanager/04-04-SUMMARY.md` - FOUND
- `4f01378` (RED SelectionProvider) - FOUND
- `576406a` (GREEN SelectionProvider) - FOUND
- `3f1a3b0` (RED StateCoordinator) - FOUND
- `916bc5b` (GREEN StateCoordinator) - FOUND

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*
