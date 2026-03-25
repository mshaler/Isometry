---
phase: 114-storage-foundation
plan: 01
subsystem: database
tags: [sql.js, graph-metrics, worker-protocol, typescript, tdd]

# Dependency graph
requires:
  - phase: 108-consolidate-view-navigation
    provides: stable WorkerBridge and protocol.ts pattern to extend
provides:
  - graph_metrics DDL string (GRAPH_METRICS_DDL) with 8-column schema and 3 indexes
  - GraphMetricsRow typed interface for typed row access
  - writeGraphMetrics / readGraphMetrics / readAllGraphMetrics / clearGraphMetrics query helpers
  - 3 new WorkerRequestType entries: graph:compute, graph:metrics-read, graph:metrics-clear
  - Typed WorkerPayloads and WorkerResponses for all 3 new graph message types
  - GRAPH_ALGO_TIMEOUT = 60_000 constant
  - sanitizeAlgorithmResult utility converting NaN/Infinity to null for 6 metric fields
affects: [115-algorithm-engine, 116-schema-integration, 117-networkview-enhancement, 118-polish-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "graph_metrics one-file-per-table convention matching cards.ts / connections.ts / graph.ts"
    - "INSERT OR REPLACE for idempotent upsert (matching ui_state, import catalog patterns)"
    - "db.transaction() wrapping batch writes at BATCH_SIZE = 1000"
    - "Empty-array early return guard for readGraphMetrics (avoids invalid IN () SQL)"
    - "sanitizeAlgorithmResult shallow-copy + METRIC_FIELDS constant array pattern"

key-files:
  created:
    - src/database/queries/graph-metrics.ts
    - src/worker/utils/sanitize.ts
    - tests/database/graph-metrics.test.ts
    - tests/worker/sanitize.test.ts
  modified:
    - src/worker/protocol.ts

key-decisions:
  - "computed_at optional on GraphMetricsRow input; writeGraphMetrics supplies new Date().toISOString() when not provided"
  - "mapResultToRows internal helper avoids code duplication between readGraphMetrics and readAllGraphMetrics"
  - "worker.ts exhaustive switch error on 3 new types is expected until Plan 02 adds handler cases"
  - "dataset-eviction.test.ts TypeScript error is pre-existing (before Phase 114), out of scope"

patterns-established:
  - "METRIC_FIELDS as const array in sanitize.ts — single source of truth for which fields need NaN/Infinity sanitization"
  - "sanitizeAlgorithmResult returns shallow copy — never mutates input (safe for pipeline reuse)"

requirements-completed: [GFND-01, GFND-03]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 114 Plan 01: Storage Foundation Summary

**graph_metrics sql.js DDL + 4 typed query helpers + sanitizeAlgorithmResult guard + 3 new WorkerRequestType entries with typed payloads and responses**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T09:28:14Z
- **Completed:** 2026-03-22T09:33:15Z
- **Tasks:** 2
- **Files modified:** 5 (2 new src/, 2 new tests/, 1 modified protocol.ts)

## Accomplishments
- Created graph_metrics DDL with 8-column schema (card_id + 6 metrics + computed_at) and 3 indexes (community_id, pagerank, centrality)
- Implemented 4 typed query helpers (writeGraphMetrics, readGraphMetrics, readAllGraphMetrics, clearGraphMetrics) following the one-file-per-table convention
- Extended protocol.ts with graph:compute, graph:metrics-read, graph:metrics-clear — fully typed payloads and responses
- Created sanitizeAlgorithmResult utility to convert NaN/Infinity/-Infinity to null for all 6 metric fields before DB writes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create graph-metrics.ts query module with DDL and typed helpers** - `c10cd4f8` (feat)
2. **Task 2: Extend protocol.ts with 3 graph algorithm message types and create sanitize utility** - `66024e46` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: Task 1 used TDD (red-green-refactor)_

## Files Created/Modified
- `src/database/queries/graph-metrics.ts` - GRAPH_METRICS_DDL constant, GraphMetricsRow interface, 4 typed query functions
- `src/worker/utils/sanitize.ts` - sanitizeAlgorithmResult function (NaN/Infinity → null for 6 metric fields)
- `src/worker/protocol.ts` - Added 3 WorkerRequestType entries, WorkerPayloads shapes, WorkerResponses shapes, GRAPH_ALGO_TIMEOUT constant
- `tests/database/graph-metrics.test.ts` - 19 TDD tests: DDL structure + write/read/clear operations
- `tests/worker/sanitize.test.ts` - 16 tests: all 6 metric fields × NaN/Infinity/-Infinity/null/valid, non-mutation

## Decisions Made
- `computed_at` optional on `GraphMetricsRow` input; `writeGraphMetrics` supplies `new Date().toISOString()` when not provided — matches existing import_runs timestamp pattern
- Internal `mapResultToRows()` helper avoids code duplication between `readGraphMetrics` and `readAllGraphMetrics`
- Worker.ts exhaustive switch TypeError on 3 new types is expected behavior until Plan 02 adds handler cases (per plan spec)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate `row` identifier and exactOptionalPropertyTypes conflict in mapResultToRows**
- **Found during:** Task 1 (TDD GREEN phase, post-implementation tsc --noEmit)
- **Issue:** `mapResultToRows` used `row` as both the `.map()` callback parameter and an internal variable name; `computed_at: string | undefined` incompatible with `exactOptionalPropertyTypes: true` in tsconfig
- **Fix:** Renamed map parameter to `rawRow`, output variable to `mapped`; conditionally set `computed_at` only when value is a string (avoids `string | undefined` on typed interface)
- **Files modified:** src/database/queries/graph-metrics.ts, tests/database/graph-metrics.test.ts
- **Verification:** tsc --noEmit passes (0 errors from plan-114 files)
- **Committed in:** `66024e46` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for TypeScript strict mode compliance. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `tests/seams/ui/dataset-eviction.test.ts` (BindParams type mismatch) — out of scope, not introduced by this plan, deferred.

## Next Phase Readiness
- Plan 02 (114-02): WorkerBridge 3 new public methods + worker.ts handler cases + graphology UndirectedGraph stub can proceed
- graph_metrics DDL must be run in worker.ts init sequence after existing table creation (Plan 02 task)
- All 35 tests pass; TypeScript clean except expected exhaustive switch gap in worker.ts

## Self-Check: PASSED

All files and commits verified present.

---
*Phase: 114-storage-foundation*
*Completed: 2026-03-22*
