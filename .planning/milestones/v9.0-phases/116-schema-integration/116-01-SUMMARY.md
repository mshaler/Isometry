---
phase: 116-schema-integration
plan: 01
subsystem: database, providers, views
tags: [SchemaProvider, SuperGridQuery, LEFT JOIN, graph_metrics, PAFV, filtered compute]

requires:
  - phase: 114-storage-foundation
    provides: graph_metrics DDL, writeGraphMetrics/readGraphMetrics helpers
  - phase: 115-algorithm-engine
    provides: handleGraphCompute with 6 algorithm implementations
provides:
  - SchemaProvider graph metric column injection (addGraphMetricColumns/removeGraphMetricColumns)
  - SuperGridQuery LEFT JOIN graph_metrics when metric columns used as axes
  - Filtered graph:compute via cardIds payload parameter
affects: [116-02, 117-networkview-enhancement, 118-polish-e2e]

tech-stack:
  added: []
  patterns:
    - "Graph metric column injection via SchemaProvider._graphMetricColumns private array"
    - "ALLOWED_METRIC_COLUMNS frozen set for SuperGridQuery metric column validation"
    - "graph_metrics. table prefix on metric columns in SELECT/GROUP BY/ORDER BY"
    - "cardIds filter on graph:compute for FilterProvider-scoped computation"

key-files:
  created:
    - tests/providers/schema-graph-metrics.test.ts
    - tests/views/supergrid-query-join.test.ts
    - tests/worker/graph-compute-filtered.test.ts
  modified:
    - src/providers/SchemaProvider.ts
    - src/views/supergrid/SuperGridQuery.ts
    - src/worker/protocol.ts
    - src/worker/handlers/graph-algorithms.handler.ts
    - src/worker/handlers/supergrid.handler.ts

key-decisions:
  - "community_id classified as Hierarchy+non-numeric (categorical GROUP BY axis); other 5 metrics as Hierarchy+numeric"
  - "ALLOWED_METRIC_COLUMNS frozen set in SuperGridQuery rather than delegating to SchemaProvider for JOIN validation — explicit safety layer"
  - "Edge filtering via JS Set membership check after full connections query — avoids complex parameterized IN clause for edge table"
  - "cards.id/cards.name explicit GROUP_CONCAT when JOIN active — prevents ambiguous column reference"

patterns-established:
  - "Graph metric columns as virtual ColumnInfo injected into SchemaProvider accessor chain"
  - "metricsColumns?: string[] on SuperGridQueryConfig for opt-in LEFT JOIN"
  - "qualifyField() helper for table-prefixing metric columns in SQL builder"

requirements-completed: [PAFV-01, PAFV-02, PAFV-03]

duration: 6min
completed: 2026-03-24
---

# Phase 116 Plan 01: Schema Integration Summary

**SchemaProvider graph metric injection + SuperGridQuery LEFT JOIN + filtered graph:compute with 34 TDD tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T03:01:56Z
- **Completed:** 2026-03-24T03:08:00Z
- **Tasks:** 2 (TDD)
- **Files modified:** 8 (5 src + 3 test)

## Accomplishments
- SchemaProvider dynamically injects/removes 6 graph metric ColumnInfo entries with proper LATCH classification
- SuperGridQuery LEFT JOINs graph_metrics only when metricsColumns is non-empty (zero overhead otherwise)
- graph:compute accepts optional cardIds for FilterProvider-scoped computation
- handleSuperGridCellDetail LEFT JOINs when axis field is a metric column

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: SchemaProvider graph metric injection + filtered compute**
   - `2d18ad01` (test: failing tests)
   - `82be8e23` (feat: implementation — 23 tests passing)
2. **Task 2: SuperGridQuery LEFT JOIN + handler metricsColumns**
   - `bebcd336` (test: failing tests)
   - `0c97c6fa` (feat: implementation — 11 tests passing)

## Files Created/Modified
- `src/providers/SchemaProvider.ts` — addGraphMetricColumns, removeGraphMetricColumns, hasGraphMetrics + accessor chain updates
- `src/views/supergrid/SuperGridQuery.ts` — ALLOWED_METRIC_COLUMNS, metricsColumns param, LEFT JOIN + qualifyField
- `src/worker/protocol.ts` — cardIds on graph:compute, metricsColumns on supergrid:calc
- `src/worker/handlers/graph-algorithms.handler.ts` — cardIds filter with node Set + edge filtering
- `src/worker/handlers/supergrid.handler.ts` — handleSuperGridCellDetail LEFT JOIN for metric axes
- `tests/providers/schema-graph-metrics.test.ts` — 18 tests covering injection, removal, idempotency, subscribers
- `tests/views/supergrid-query-join.test.ts` — 11 tests covering JOIN/no-JOIN, mixed axes, calc query
- `tests/worker/graph-compute-filtered.test.ts` — 5 tests covering filtered compute and backward compat

## Decisions Made
- community_id is categorical (isNumeric=false) — for GROUP BY axis usage, not numeric aggregation
- Edge filtering uses JS Set membership after full connections query — simpler than parameterized SQL
- ALLOWED_METRIC_COLUMNS is a separate frozen set from SchemaProvider — explicit validation at SQL builder level

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (AlgorithmExplorer) can wire SchemaProvider.addGraphMetricColumns after compute
- Phase 117 (NetworkView) can read graph_metrics via LEFT JOIN for visual encoding
- Phase 118 (Polish) can add stale indicator when filters change after computation

---
*Phase: 116-schema-integration*
*Completed: 2026-03-24*
