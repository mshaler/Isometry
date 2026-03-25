---
phase: 114-storage-foundation
plan: 02
subsystem: worker
tags: [graphology, worker-bridge, render-token, graph-algorithms, tdd]

# Dependency graph
requires:
  - phase: 114-01
    provides: graph-metrics DDL, protocol types (graph:compute, graph:metrics-read, graph:metrics-clear), GRAPH_ALGO_TIMEOUT
provides:
  - graph-algorithms.handler.ts with handleGraphCompute (graphology UndirectedGraph stub), handleGraphMetricsRead, handleGraphMetricsClear
  - WorkerBridge.computeGraph() / readGraphMetrics() / clearGraphMetrics() public methods + _renderToken mechanism
  - Worker router cases for all 3 graph message types
  - graph_metrics DDL wired into Worker init sequence (idempotent CREATE TABLE IF NOT EXISTS)
  - 17-test handler suite covering empty/connected/disconnected/parallel-edge graphs
affects: [115-algorithm-engine, 116-schema-integration, 117-networkview-enhancement, 118-polish-e2e]

# Tech tracking
tech-stack:
  added:
    - graphology 0.26.0 (runtime dependency) + graphology-types
  patterns:
    - "Named UndirectedGraph import from graphology (default export is Graph, not UndirectedGraph)"
    - "mergeEdge() for parallel edge deduplication — both (A,B) and (B,A) reduce to 1 undirected edge"
    - "_renderToken private field incremented in computeGraph, echoed back in response for staleness detection"
    - "exactOptionalPropertyTypes guard: build payload object conditionally, never spread undefined into optional fields"

key-files:
  created:
    - src/worker/handlers/graph-algorithms.handler.ts
    - tests/worker/graph-algorithms-handler.test.ts
  modified:
    - src/worker/handlers/index.ts
    - src/worker/worker.ts
    - src/worker/WorkerBridge.ts
    - package.json

key-decisions:
  - "Named import { UndirectedGraph } from 'graphology' required — default export is Graph (mixed), not UndirectedGraph"
  - "handleGraphMetricsRead when cardIds=[] returns [] (explicit empty filter), not all rows"
  - "computeGraph() does not discard stale responses internally — caller (AlgorithmControlsPanel) compares currentRenderToken"

patterns-established:
  - "_renderToken monotonically increments per computeGraph call — Phase 116/117 callers can detect stale responses"
  - "Stub handler pattern: Phase 114 builds UndirectedGraph, returns counts, no algorithm execution — Phase 115 adds algorithms inline"

requirements-completed: [GFND-02]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 114 Plan 02: Worker Plumbing Summary

**graphology UndirectedGraph stub handler + 3 Worker router cases + graph_metrics DDL at init + WorkerBridge methods with render token mechanism**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T09:35:26Z
- **Completed:** 2026-03-22T09:41:34Z
- **Tasks:** 2
- **Files modified:** 6 (2 new src/, 1 new test/, 3 modified)

## Accomplishments

- Installed graphology 0.26.0 + graphology-types as runtime dependencies
- Created graph-algorithms.handler.ts: stub handleGraphCompute builds UndirectedGraph from live sql.js data and returns node/edge counts; handleGraphMetricsRead reads from graph_metrics; handleGraphMetricsClear deletes all rows
- Wired graph_metrics DDL migration into Worker initialize() sequence (idempotent, runs alongside existing table DDL)
- Added 3 router cases to worker.ts switch (graph:compute, graph:metrics-read, graph:metrics-clear) — exhaustive switch now satisfied
- Added WorkerBridge.computeGraph() with _renderToken increment + GRAPH_ALGO_TIMEOUT, readGraphMetrics(), clearGraphMetrics(), currentRenderToken getter
- 17 handler unit tests covering all edge cases: empty graph, 5-node chain, disconnected components, parallel edges, read/clear round-trips

## Task Commits

Each task was committed atomically:

1. **Task 1: Install graphology, create stub handler, wire Worker router and init DDL** - `0f1d56db` (feat)
2. **Task 2: Add WorkerBridge methods with render token, and handler integration tests** - `42bf8dff` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: Task 2 used TDD (red-green-refactor)_

## Files Created/Modified

- `src/worker/handlers/graph-algorithms.handler.ts` — handleGraphCompute (graphology stub), handleGraphMetricsRead, handleGraphMetricsClear
- `src/worker/handlers/index.ts` — Export 3 handler functions from graph-algorithms.handler
- `src/worker/worker.ts` — GRAPH_METRICS_DDL migration + 3 router cases
- `src/worker/WorkerBridge.ts` — _renderToken, computeGraph(), readGraphMetrics(), clearGraphMetrics(), currentRenderToken getter, GRAPH_ALGO_TIMEOUT import
- `package.json` — graphology + graphology-types added as runtime dependencies
- `tests/worker/graph-algorithms-handler.test.ts` — 17 tests covering all handler behavior

## Decisions Made

- Named `{ UndirectedGraph }` import required from graphology — the default export is the mixed `Graph` class, not `UndirectedGraph`. Using default import would silently build a directed/multi graph causing incorrect edge deduplication.
- `handleGraphMetricsRead` with explicit empty `cardIds: []` returns `[]` (not all rows) — the `readGraphMetrics` function already handles this via its own empty-array early-exit guard.
- `computeGraph()` doesn't internally discard stale responses — it returns the result regardless of token freshness, and callers compare `result.renderToken` against `bridge.currentRenderToken` for staleness detection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Default graphology export is Graph, not UndirectedGraph**
- **Found during:** Task 2 (TDD GREEN phase — test "counts reverse-direction edges" failed with edgeCount=2 instead of 1)
- **Issue:** `import UndirectedGraph from 'graphology'` imports the mixed `Graph` class. Mixed graphs treat `mergeEdge(A, B)` and `mergeEdge(B, A)` as distinct edges; `UndirectedGraph` deduplicates them.
- **Fix:** Changed to named import `import { UndirectedGraph } from 'graphology'`
- **Files modified:** src/worker/handlers/graph-algorithms.handler.ts
- **Commit:** `42bf8dff`

**2. [Rule 1 - Bug] handleGraphMetricsRead with empty cardIds returned all rows**
- **Found during:** Task 2 (TDD GREEN phase — test "returns empty array when cardIds is empty array" failed)
- **Issue:** Handler logic `payload.cardIds !== undefined && payload.cardIds.length > 0` fell through to `readAllGraphMetrics` when cardIds was `[]`. Caller intent is empty filter = empty result.
- **Fix:** Changed condition to `payload.cardIds !== undefined` — delegates to `readGraphMetrics(db, [])` which already returns `[]` via its early-exit guard
- **Files modified:** src/worker/handlers/graph-algorithms.handler.ts
- **Commit:** `42bf8dff`

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Both bugs found during TDD GREEN phase. Fixes required changing 4 lines in graph-algorithms.handler.ts. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `tests/seams/ui/dataset-eviction.test.ts` (BindParams type mismatch) — out of scope, carried from Phase 114 Plan 01.

## Next Phase Readiness

- Phase 115 (Algorithm Engine): All plumbing complete. Drop 6 algorithm implementations into handleGraphCompute — no protocol/bridge/router/DDL changes needed.
- graph:compute round-trip validated: WorkerBridge.computeGraph() → Worker router → handleGraphCompute() → UndirectedGraph construction → response with renderToken
- All 52 tests pass (graph-metrics: 19, sanitize: 16, handler: 17); TypeScript clean except pre-existing out-of-scope error

## Self-Check: PASSED

Files verified present:
- src/worker/handlers/graph-algorithms.handler.ts — FOUND
- src/worker/WorkerBridge.ts (modified) — FOUND
- tests/worker/graph-algorithms-handler.test.ts — FOUND
- Commit 0f1d56db — verified in git log
- Commit 42bf8dff — verified in git log

---
*Phase: 114-storage-foundation*
*Completed: 2026-03-22*
