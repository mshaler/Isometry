---
phase: 04-providers-mutationmanager
plan: 01
subsystem: providers
tags: [typescript, sql-safety, allowlist, filter-provider, parameterized-sql, subscriber-pattern]

# Dependency graph
requires:
  - phase: 03-worker-bridge
    provides: WorkerBridge singleton, protocol.ts (already includes ui:* and db:exec types from Phase 3 forward planning)

provides:
  - FilterField, FilterOperator, AxisField, SortDirection, TimeGranularity, ViewType, ViewFamily union types
  - Filter, CompiledFilter, AxisMapping, CompiledAxis, CompiledDensity, PersistableProvider interfaces
  - ALLOWED_FILTER_FIELDS, ALLOWED_OPERATORS, ALLOWED_AXIS_FIELDS frozen ReadonlySets
  - isValid*/validate* dual-validation pattern (type guard + assertion)
  - FilterProvider: addFilter/removeFilter/clearFilters/setSearchQuery/compile/subscribe/toJSON/fromJSON/setState/resetToDefaults
  - Public providers barrel export (src/providers/index.ts)

affects:
  - 04-02 (PAFVProvider uses AxisField, CompiledAxis, PersistableProvider from this plan)
  - 04-03 (SelectionProvider uses Filter types)
  - 04-04 (DensityProvider uses TimeGranularity, PersistableProvider)
  - 04-07 (StateManager uses PersistableProvider interface)
  - 04-08 (QueryBuilder composes CompiledFilter from FilterProvider)
  - Phase 5 views (subscribe to FilterProvider for re-query triggers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-validation pattern: TypeScript union types (compile-time) + frozen ReadonlySet assertions (runtime)
    - queueMicrotask batching: multiple sync mutations → one subscriber notification
    - Compile + subscribe provider pattern: synchronous compile(), Set<fn> subscribers, unsubscribe fn returned
    - PersistableProvider interface: toJSON/setState/resetToDefaults for Tier 2 persistence

key-files:
  created:
    - src/providers/types.ts
    - src/providers/allowlist.ts
    - src/providers/FilterProvider.ts
    - src/providers/index.ts
    - tests/providers/allowlist.test.ts
    - tests/providers/FilterProvider.test.ts
  modified: []

key-decisions:
  - "FilterProvider validates field/operator at both addFilter() (fail-fast) and compile() (handles JSON-restored state) — double validation is correct"
  - "Private internal state field named _filters (not #filters) to allow test access for injection test scenario"
  - "FTS tokenization: query.split(/\\s+/).map(t => `\"${t}\"*`).join(' ') — phrase prefix matching per D-004"
  - "Error messages start with 'SQL safety violation:' for grep-ability and consistency"

patterns-established:
  - "Provider compile() pattern: initialize clauses=['deleted_at IS NULL'], iterate filters with validate+compile, append FTS if set, return {where: clauses.join(' AND '), params}"
  - "queueMicrotask batching: pendingNotify flag prevents duplicate notifications for same sync batch"
  - "Allowlist dual validation: isValid*() type guards for conditionals, validate*() assertions for throw-on-invalid"
  - "Frozen ReadonlySet pattern: Object.freeze(new Set<T>([...])) for runtime-immutable allowlists"

requirements-completed: [PROV-01, PROV-02, PROV-11]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 4 Plan 01: Provider Types, Allowlist, and FilterProvider Summary

**Frozen allowlist sets with dual TypeScript/runtime SQL safety validation and FilterProvider compiling all 11 filter operators to parameterized WHERE fragments with queueMicrotask-batched subscriber notifications**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T20:07:31Z
- **Completed:** 2026-02-28T20:13:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Type system established: 7 union types (FilterField, FilterOperator, AxisField, SortDirection, TimeGranularity, ViewType, ViewFamily) + 7 interfaces (Filter, CompiledFilter, AxisMapping, CompiledAxis, CompiledDensity, PersistableProvider, and AxisMapping)
- Runtime SQL safety: frozen ReadonlySets + isValid*/validate* dual-validation pattern prevents SQL injection at both addFilter and compile time
- FilterProvider: all 11 operators compiled correctly (eq, neq, gt, gte, lt, lte, contains, startsWith, in, isNull, isNotNull) + FTS with rowid joins + queueMicrotask batching + subscribe/unsubscribe (PROV-11) + PersistableProvider interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Provider types and allowlist validation** - `ef655c9` (test + feat)
2. **Task 2: FilterProvider with SQL compilation and subscriber pattern** - `f0e68b7` (test + feat)

_Note: TDD tasks have combined RED+GREEN commits per task_

## Files Created/Modified

- `src/providers/types.ts` — FilterField, FilterOperator, AxisField, SortDirection, TimeGranularity, ViewType, ViewFamily unions + Filter, CompiledFilter, AxisMapping, CompiledAxis, CompiledDensity, PersistableProvider interfaces
- `src/providers/allowlist.ts` — ALLOWED_FILTER_FIELDS, ALLOWED_OPERATORS, ALLOWED_AXIS_FIELDS frozen ReadonlySets; isValid*/validate* type guards and assertion functions
- `src/providers/FilterProvider.ts` — FilterProvider class implementing full compile+subscribe pattern + PersistableProvider
- `src/providers/index.ts` — public barrel re-exports
- `tests/providers/allowlist.test.ts` — 62 tests covering sets, type guards, assertions, SQL injection attempts
- `tests/providers/FilterProvider.test.ts` — 35 tests covering all operators, FTS, safety, subscribe/unsubscribe, serialization

## Decisions Made

- **Double validation in FilterProvider:** Validates at `addFilter()` (fail-fast, prevents bad state accumulation) AND at `compile()` (handles JSON-restored state that bypassed addFilter). Both validation points are required.
- **_filters naming vs #filters:** Used `_filters` (underscore convention) instead of native private `#filters` to allow the test for JSON-restore corruption to inject a bad filter directly into state without TypeScript errors.
- **FTS tokenization:** `split(/\s+/).map(t => `"${t}"*`).join(' ')` produces phrase prefix matching consistent with D-004 and Pitfall P21 guidance.

## Deviations from Plan

None — plan executed exactly as written. TypeScript already compiled cleanly (protocol.ts and worker.ts had Phase 4 types pre-wired from Phase 3's forward planning).

## Issues Encountered

None.

## Next Phase Readiness

- All type exports from `src/providers/index.ts` ready for PAFVProvider (Plan 04-02), SelectionProvider (04-03), DensityProvider (04-04)
- PersistableProvider interface ready for StateManager (04-07)
- FilterProvider reference implementation establishes the compile+subscribe pattern for all subsequent providers
- 97 provider tests passing (62 allowlist + 35 FilterProvider)

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*
