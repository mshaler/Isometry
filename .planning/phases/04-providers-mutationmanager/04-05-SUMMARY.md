---
phase: 04-providers-mutationmanager
plan: 05
subsystem: providers
tags: [typescript, sql, query-builder, state-management, persistence, debounce, worker-bridge]

# Dependency graph
requires:
  - phase: 04-01
    provides: FilterProvider with compile() returning CompiledFilter
  - phase: 04-02
    provides: WorkerBridge with send() method and ui:* protocol types
  - phase: 04-03
    provides: PAFVProvider.compile() returning CompiledAxis, DensityProvider.compile() returning CompiledDensity

provides:
  - QueryBuilder: sole SQL assembly point composing FilterProvider/PAFVProvider/DensityProvider
  - StateManager: Tier 2 persistence coordinator via WorkerBridge ui:set/ui:getAll
  - WorkerBridge.send() is now public (accessible to StateManager and MutationManager)

affects:
  - 04-06-MutationManager (uses WorkerBridge.send() for db:exec operations)
  - Phase 5+ views (use QueryBuilder for all card queries)
  - App startup sequence (StateManager.restore() then enableAutoPersist())

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QueryBuilder airtight SQL boundary: all SQL fragments from provider compile() outputs — no raw SQL escape hatch"
    - "Debounced persistence: markDirty() → setTimeout(500ms) → bridge.send('ui:set') with timer reset on repeat calls"
    - "Corrupt JSON isolation: try/catch per provider — one failure resets only that provider, others restored normally"
    - "WorkerBridge.send() public API: StateManager and MutationManager use it directly for ui:* and db:* operations"

key-files:
  created:
    - src/providers/QueryBuilder.ts
    - src/providers/StateManager.ts
    - tests/providers/QueryBuilder.test.ts
    - tests/providers/StateManager.test.ts
  modified:
    - src/providers/index.ts
    - src/worker/WorkerBridge.ts

key-decisions:
  - "QueryBuilder: buildGroupedQuery() prefers axis.groupBy over density.groupExpr when both are non-empty"
  - "QueryBuilder: includeDeleted strips 'deleted_at IS NULL' from WHERE string produced by FilterProvider"
  - "StateManager: restore() skips providers with no stored key (leaves at defaults) — no setState called"
  - "WorkerBridge.send() made public so StateManager/MutationManager can use bridge.send() directly"
  - "StateManager.persistAll() clears any pending debounce timers before writing to avoid double-writes"

patterns-established:
  - "CompiledQuery shape: { sql: string; params: unknown[] } — consumed by WorkerBridge for db:exec"
  - "TDD RED→GREEN: tests committed before implementation for both QueryBuilder and StateManager"

requirements-completed: [PROV-01, PROV-03, PROV-07, PROV-10]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 4 Plan 05: QueryBuilder + StateManager Summary

**QueryBuilder airtight SQL assembly from provider compile() outputs with debounced StateManager persistence to ui_state via WorkerBridge**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T20:21:52Z
- **Completed:** 2026-02-28T20:25:57Z
- **Tasks:** 2 (4 commits via TDD)
- **Files modified:** 6

## Accomplishments

- QueryBuilder: the sole SQL assembly point that composes FilterProvider/PAFVProvider/DensityProvider compile() outputs into complete SELECT, COUNT, and GROUP BY queries — no raw SQL escape hatch possible
- StateManager: Tier 2 persistence coordinator with 500ms debounced writes, corrupt JSON isolation (one provider resets, others unaffected), and auto-persist subscription management
- WorkerBridge.send() made public — StateManager and MutationManager can now call bridge.send('ui:set', ...) directly
- Full provider test suite: 258 tests passing across 8 test files

## Task Commits

Each task was committed atomically with TDD RED → GREEN pattern:

1. **Task 1 RED: QueryBuilder failing tests** - `c1cf037` (test)
2. **Task 1 GREEN: QueryBuilder implementation** - `683f85f` (feat)
3. **Task 2 RED: StateManager failing tests** - `028abc6` (test)
4. **Task 2 GREEN: StateManager + WorkerBridge + index.ts** - `6e7ddea` (feat)

**Plan metadata:** (docs commit — see final_commit)

_Note: TDD tasks have multiple commits (test → feat)_

## Files Created/Modified

- `src/providers/QueryBuilder.ts` - Sole SQL assembly point; buildCardQuery/buildCountQuery/buildGroupedQuery
- `src/providers/StateManager.ts` - Tier 2 persistence coordinator; debounce, restore, auto-persist
- `src/worker/WorkerBridge.ts` - send() changed from private to public
- `src/providers/index.ts` - Added PAFVProvider, DensityProvider, QueryBuilder, StateManager, CompiledQuery exports
- `tests/providers/QueryBuilder.test.ts` - 20 tests covering all query shapes and edge cases
- `tests/providers/StateManager.test.ts` - 21 tests covering debounce, restore, corruption isolation, lifecycle

## Decisions Made

- **QueryBuilder includeDeleted**: strips 'deleted_at IS NULL' from FilterProvider's WHERE string rather than adding a compile-without-base parameter to FilterProvider — simpler, keeps FilterProvider unchanged
- **buildGroupedQuery priority**: axis.groupBy takes precedence over density.groupExpr when both are non-empty — axis is explicit user intent, density is time-bucketing fallback
- **WorkerBridge.send() public**: chose to make the method public rather than adding dedicated `setUiState()` / `getAllUiState()` wrapper methods — simpler and follows MutationManager's needs too (db:exec)
- **StateManager.persistAll()**: clears pending debounce timers before writing to prevent double-writes when called during app save/exit
- **restore() skips missing keys**: providers with no stored key in ui_state remain at their defaults — no setState call, no reset — intentional for fresh installs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript errors in `tests/mutations/` are pre-existing from Plan 04 (MutationManager test RED phase for Plan 06) — all out of scope per scope boundary rule. No new TypeScript errors introduced by this plan.

## Next Phase Readiness

- QueryBuilder ready for use in Phase 5 views — consumers call `qb.buildCardQuery()` and send result to WorkerBridge
- StateManager ready for app initialization sequence: `restore()` then `enableAutoPersist()`
- WorkerBridge.send() public enables MutationManager (Plan 06) to call `bridge.send('db:exec', {...})` directly
- All 258 provider tests passing — foundation stable for MutationManager

## Self-Check: PASSED

All created files verified present. All task commits verified in git history.

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*
