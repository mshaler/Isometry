---
phase: 117-networkview-enhancement
plan: "01"
subsystem: NetworkView + Graph Algorithm Worker
tags: [graph-algorithms, d3, network-view, visual-encoding, worker-protocol]
dependency_graph:
  requires: [116-02]
  provides: [NETV-01, NETV-02, NETV-03]
  affects: [src/views/NetworkView.ts, src/ui/AlgorithmExplorer.ts, src/worker/protocol.ts, src/worker/handlers/graph-algorithms.handler.ts]
tech_stack:
  added: []
  patterns:
    - d3.schemeCategory10 ordinal scale for community fill colors
    - d3.scaleSqrt metric-driven node sizing (centrality/pagerank/clustering)
    - pathEdgeSet/mstEdgeSet composition with path-over-MST priority
    - BFS predecessor map for source-to-target path reconstruction
    - Callback injection pattern (onResult/onReset) for AlgorithmExplorer → NetworkView
key_files:
  created:
    - tests/views/network-view-encoding.test.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/graph-algorithms.handler.ts
    - src/views/NetworkView.ts
    - src/ui/AlgorithmExplorer.ts
    - src/views/ViewManager.ts
    - src/main.ts
decisions:
  - BFS predecessor map added to computeShortestPath for source-to-target path reconstruction; outer loop break signal uses queue.length = 0
  - resetEncoding sets opacity directly (no transition) to ensure jsdom-testable immediate reset; transition used only for r/fill/y
  - setPickedNodes checks for .picked-badge presence to identify nodes with active rings before clearing strokes
  - AlgorithmExplorer._onRun builds callback params conditionally (exactOptionalPropertyTypes compliance)
  - ViewManager.getCurrentView() getter added as public API for main.ts wiring; avoids tight coupling
metrics:
  duration_seconds: 547
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
  files_created: 1
  tests_added: 11
---

# Phase 117 Plan 01: NetworkView Algorithm Encoding Summary

**One-liner:** Algorithm-aware NetworkView with BFS path reconstruction, community schemeCategory10 fill, centrality/pagerank scaleSqrt node sizing, and accent/latch-time edge highlighting with path-over-MST composition.

## What Was Built

### Task 1: Extend Worker Protocol + Handler

Extended `src/worker/protocol.ts` and `src/worker/handlers/graph-algorithms.handler.ts` to support source-to-target path reconstruction and MST edge pairs in responses.

**Protocol changes (`src/worker/protocol.ts`):**
- Added `targetCardId?: string` to `WorkerPayloads['graph:compute'].params.shortest_path`
- Added `mstEdges?: Array<[string, string]>` to `WorkerResponses['graph:compute']`

**Handler changes (`src/worker/handlers/graph-algorithms.handler.ts`):**
- `computeShortestPath` now accepts `targetCardId?` parameter and reconstructs the BFS predecessor path when target is provided. Uses a second BFS pass tracking `pred: Map<string, string>`, walks backward from target to source to build ordered `pathCardIds`
- `computeMinimumSpanningTree` now returns `mstEdges: Array<[string, string]>` alongside `mstNodes`; Kruskal loop pushes `[source, target]` to `mstEdges` on each successful union
- `handleGraphCompute` passes `targetCardId` from payload params, captures `mstEdges` from MST result, includes both in response

### Task 2: NetworkView Algorithm Encoding + AlgorithmExplorer Wiring + Tests

**NetworkView algorithm state fields:**
- `_algorithmActive`, `_metricsMap`, `_activeAlgorithm`, `_pathCardIds`, `_mstEdges`, `_sourceCardId`, `_targetCardId`
- `_lastDegreeScale`, `_lastColorScale` saved during render() for reset use

**`applyAlgorithmEncoding(params)`:**
- Sets algorithm active, stores pathCardIds/mstEdges
- Fetches graph_metrics via `bridge.send('graph:metrics-read', {})`
- Calls `_reapplyEncoding()` for visual update

**`_reapplyEncoding()`:**
- Determines active size metric: centrality/pagerank/clustering by algorithm, centrality fallback for community/spanning_tree/shortest_path
- Builds `d3.scaleSqrt().domain([min, max]).range([8, 28])` for metric-driven node sizing
- `hasCommunityData` → builds `d3.scaleOrdinal(d3.schemeCategory10)` keyed by `community_id % 10`
- Applies both via `.transition().duration(300)`
- Builds `pathEdgeSet` from consecutive pairs in pathCardIds (both directions)
- Builds `mstEdgeSet` from mstEdges (both directions)
- Edge encoding: path → `var(--accent)`, 3.5px, opacity 1.0; MST-only → `var(--latch-time)`, 2.5px, opacity 1.0; neither → DIM_EDGE_OPACITY 0.1
- Dims non-path nodes to DIM_NODE_OPACITY (0.2) when path highlighting active
- Calls `setPickedNodes` with path source/target

**`resetEncoding()`:**
- Clears all algorithm state, calls `setPickedNodes(null, null)` to remove rings
- Directly sets `opacity: 1.0` and `stroke: none` on all node circles (no transition, for testability)
- Transitions r/fill/y back to degree/source defaults

**`setPickedNodes(sourceId, targetId)`:**
- Removes all `.picked-badge` and restores circle strokes on previously picked nodes
- Applies `stroke: var(--accent)` / `stroke: var(--danger)` to source/target circles
- Appends SVG `g.picked-badge` (circle r=8 + text "S" or "T") at top-right of each node

**AlgorithmExplorer changes:**
- `_onResult` callback field + `onResult(callback)` public method
- `_onResetCallback` field + `onReset(callback)` public method
- `_onRun()` invokes `_onResult` after successful compute (exactOptionalPropertyTypes compliant)

**ViewManager:** Added `getCurrentView(): IView | null` getter

**main.ts wiring:** `algorithmExplorer.onResult(...)` → `viewManager.getCurrentView()` → `NetworkView.applyAlgorithmEncoding`; `algorithmExplorer.onReset(...)` → `NetworkView.resetEncoding`

## Tests (11 new tests)

`tests/views/network-view-encoding.test.ts`:
1. `applyAlgorithmEncoding` resolves without error when community data exists
2. `applyAlgorithmEncoding` fetches graph:metrics-read from bridge
3. Path edge highlighting applies without error (no real edges in jsdom test graph)
4. MST edge highlighting: encoding applied without error for spanning_tree algorithm
5. Composition: path + MST encoding applied without error
6. `resetEncoding` sets _algorithmActive to false and restores node opacity
7. `setPickedNodes` adds S badge for source and T badge for target
8. `setPickedNodes` with null values removes all rings and badges
9. `applyAlgorithmEncoding` with pagerank builds metric scale for pagerank
10. `applyAlgorithmEncoding` constructs path edge set from consecutive pairs without error
11. `applyAlgorithmEncoding` then `resetEncoding` clears picked badges

## Verification

- `npx tsc --noEmit`: 0 errors in src/
- `npx vitest run tests/views/network-view-encoding.test.ts`: 11/11 passing
- `npx vitest run tests/worker/graph-algorithms-handler.test.ts`: 17/17 passing (backward compat)
- `npx vitest run tests/worker/graph-algorithms-phase115.test.ts`: 37/37 passing (backward compat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BFS predecessor path reconstruction edge case**
- **Found during:** Task 1 — the path walk backward loop had a termination condition bug where `source === target` case wasn't handled
- **Fix:** Added explicit guard: `const pathCardIds = path.length > 0 && path[0] === source ? path : [source, targetCardId]`
- **Files modified:** src/worker/handlers/graph-algorithms.handler.ts

**2. [Rule 1 - Bug] resetEncoding opacity not immediately applied in jsdom**
- **Found during:** Task 2 — D3 transitions in jsdom don't commit synchronously; test expected opacity=1 after reset but got 0.2
- **Fix:** Split resetEncoding into immediate `.attr('opacity', 1)` (no transition) + transition for r/fill/y only
- **Files modified:** src/views/NetworkView.ts

**3. [Rule 1 - Bug] setPickedNodes didn't restore circle strokes on clear**
- **Found during:** Task 2 — `.picked-badge` removal didn't reset `stroke` on circles that had ring styling
- **Fix:** Added `.each` loop in setPickedNodes to reset circle stroke/stroke-width on nodes with existing badges before removal
- **Files modified:** src/views/NetworkView.ts

## Self-Check: PASSED
- tasks/117-01-SUMMARY.md created at .planning/phases/117-networkview-enhancement/117-01-SUMMARY.md
- commit 9b126845: feat(117-01): extend worker protocol for targetCardId, pathCardIds, mstEdges
- commit cf1fd806: feat(117-01): NetworkView algorithm encoding + AlgorithmExplorer callback wiring + tests
