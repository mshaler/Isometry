---
phase: 115-algorithm-engine
plan: 01
subsystem: database
tags: [graphology, graph-algorithms, worker, pagerank, betweenness-centrality, louvain, clustering-coefficient, kruskal-mst, shortest-path, sql.js]

# Dependency graph
requires:
  - phase: 114-storage-foundation
    provides: handleGraphCompute stub, graph_metrics DDL, writeGraphMetrics, sanitizeAlgorithmResult, UndirectedGraph construction
provides:
  - 6 graph algorithm implementations inside handleGraphCompute (ALGO-01 through ALGO-06)
  - Extended WorkerResponses['graph:compute'] with componentCount, pathCardIds?, reachable?
  - graphology-shortest-path, graphology-metrics, graphology-communities-louvain installed
  - 37 new algorithm tests covering 4 canonical fixture graphs
affects: [116-schema-integration, 117-networkview-enhancement, 118-polish-e2e]

# Tech tracking
tech-stack:
  added: [graphology-shortest-path, graphology-metrics, graphology-communities-louvain]
  patterns:
    - "sqrt(n)-pivot sampling for betweenness centrality when n>2000 (avoids O(n*m) timeout)"
    - "Louvain seeded RNG (rng: () => 0.5) for deterministic test assertions"
    - "Isolated node null convention: degree-0 nodes get community_id=null (not singleton community)"
    - "All-or-nothing batch write: all algorithms compute before writeGraphMetrics() call"
    - "countComponents() BFS always runs for componentCount regardless of algorithms requested"

key-files:
  created:
    - tests/worker/graph-algorithms-phase115.test.ts
  modified:
    - src/worker/handlers/graph-algorithms.handler.ts
    - src/worker/protocol.ts
    - package.json
    - package-lock.json
    - tests/worker/graph-algorithms-handler.test.ts

key-decisions:
  - "graphology-metrics betweenness centrality has no built-in nodeSampling option — implemented manual sqrt(n)-pivot BFS sampling using Brandes decomposition"
  - "graphology-metrics has no clustering coefficient — implemented manually via neighbor triangle counting"
  - "Louvain subgraph approach: build UndirectedGraph without isolated nodes before calling louvain(), then assign null back — avoids singleton community flood"
  - "exactOptionalPropertyTypes requires building response object then conditionally assigning pathCardIds and reachable rather than inline ternary"
  - "Phase 114 stub test updated: 'returns empty algorithmsComputed array (Phase 114 stub)' changed to validate actual execution"

patterns-established:
  - "Algorithm isolation: each algorithm is a pure function (UndirectedGraph in, Map/Record out) before merging into GraphMetricsRow[]"
  - "Single sanitization point: sanitizeAlgorithmResult() applied per-row after merge, before writeGraphMetrics()"
  - "Component count always computed (countComponents BFS) even when no algorithms requested"

requirements-completed: [ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05, ALGO-06]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 115 Plan 01: Algorithm Engine Summary

**6 graph algorithms (shortest path, betweenness centrality, Louvain, clustering coefficient, Kruskal MST, PageRank) implemented in handleGraphCompute with sqrt(n) sampling, isolated-node null handling, and transactional batch write to graph_metrics**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T21:41:27Z
- **Completed:** 2026-03-22T21:47:01Z
- **Tasks:** 2 (Task 1: packages + protocol, Task 2: TDD algorithm implementation)
- **Files modified:** 5

## Accomplishments

- Installed graphology-shortest-path, graphology-metrics, graphology-communities-louvain
- Extended WorkerResponses['graph:compute'] with componentCount, pathCardIds?, reachable?
- Implemented all 6 algorithms as pure functions inside the handler with single transactional writeGraphMetrics() call
- Betweenness centrality auto-switches to sqrt(n)-pivot BFS sampling above 2000 nodes
- Louvain uses seeded RNG and assigns null to isolated nodes (degree 0)
- 37 new tests covering triangle, star, two-component, and linear chain fixture graphs

## Task Commits

1. **Task 1: Install graphology algorithm packages and extend protocol response type** - `b765c901` (feat)
2. **Task 2 RED: Failing tests for all 6 algorithms** - `aed6507e` (test)
3. **Task 2 GREEN: All 6 algorithm implementations** - `24018e43` (feat)

## Files Created/Modified

- `src/worker/handlers/graph-algorithms.handler.ts` - Full algorithm implementations (computeShortestPath, computeBetweennessCentrality, computeLouvainCommunity, computeClusteringCoefficient, computeMinimumSpanningTree, computePageRank) + updated orchestrator
- `src/worker/protocol.ts` - Extended WorkerResponses['graph:compute'] with componentCount, pathCardIds?, reachable?
- `package.json` / `package-lock.json` - Three graphology algorithm sub-packages added
- `tests/worker/graph-algorithms-phase115.test.ts` - 37 new algorithm tests (created)
- `tests/worker/graph-algorithms-handler.test.ts` - Updated Phase 114 stub test to reflect actual execution

## Decisions Made

- graphology-metrics betweenness centrality has no built-in nodeSampling option — implemented manual sqrt(n)-pivot BFS sampling using Brandes decomposition pattern
- graphology-metrics has no clustering coefficient — implemented manually via neighbor triangle counting (triangleEdges / possibleTriangles)
- Louvain subgraph approach: build UndirectedGraph without isolated nodes before calling louvain(), then assign null back — avoids singleton community flood that would overwhelm color scales
- exactOptionalPropertyTypes constraint requires building response object then conditionally assigning pathCardIds and reachable (not inline ternary `undefined`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Phase 114 stub test to match actual implementation**
- **Found during:** Task 2 GREEN (running test suite)
- **Issue:** `graph-algorithms-handler.test.ts` had a test asserting `algorithmsComputed` returns `[]` (Phase 114 stub behavior). After implementing algorithms, this failed with `['pagerank']`
- **Fix:** Updated test description and assertion to validate algorithm execution rather than stub behavior
- **Files modified:** `tests/worker/graph-algorithms-handler.test.ts`
- **Verification:** All 54 tests pass
- **Committed in:** `24018e43` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - obsolete stub test)
**Impact on plan:** Essential — the Phase 114 test was testing stub behavior, not algorithm correctness. Update was necessary.

## Issues Encountered

- graphology-metrics has no clustering coefficient or `nodeSampling` option for betweenness — both implemented manually (~40 LOC each). Betweenness uses Brandes BFS decomposition with Fisher-Yates-like sampling (interval-based pivot selection). Clustering coefficient uses neighbor set triangle counting.
- TypeScript `exactOptionalPropertyTypes` prevented inline `undefined` assignment for `pathCardIds` and `reachable` — resolved with conditional property assignment on response object.

## Next Phase Readiness

- All 6 algorithms write correct results to graph_metrics via handleGraphCompute
- componentCount, pathCardIds, reachable fields available for NetworkView (Phase 117)
- Phase 116 (Schema Integration) can LEFT JOIN graph_metrics columns into SuperGridQuery
- Pre-existing TypeScript error in `tests/seams/ui/dataset-eviction.test.ts` (unknown[] BindParams mismatch) — pre-dates this phase, not introduced here

---
*Phase: 115-algorithm-engine*
*Completed: 2026-03-22*
