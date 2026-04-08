---
phase: 120-ship-prep
plan: 02
subsystem: ui
tags: [graph-algorithms, d3, network-view, graphology, dijkstra, edge-betweenness]

# Dependency graph
requires:
  - phase: 119
    provides: AlgorithmExplorer, NetworkView applyAlgorithmEncoding, graph:compute Worker handler

provides:
  - GALG-01: hop count badge on shortest path target node (nv-hop-badge SVG group with circle + text)
  - GALG-02: single-source distance coloring via d3.interpolateWarm keyed by spDepths
  - GALG-03: edge betweenness stroke thickness 1px-6px via scaleLinear keyed by edgeBetweenness map
  - GALG-04: weighted Dijkstra using numeric connection attribute as edge weight
  - edgeBetweenness and spDepths in graph:compute Worker response
  - weight picker (Edge weight select) in AlgorithmExplorer shortest_path params
  - CSS: .nv-hop-badge, .nv-legend__scale-bar--warm, .nv-legend__label-row

affects:
  - any future graph visualization work referencing NetworkView or AlgorithmExplorer

# Tech tracking
tech-stack:
  added:
    - graphology-metrics/centrality/edge-betweenness (was installed, now imported)
    - graphology-shortest-path/dijkstra (was installed, now imported)
  patterns:
    - AlgorithmEncodingParams extended with optional data maps (edgeBetweenness, spDepths)
    - Worker handler computes edge betweenness opportunistically when centrality/shortest_path runs
    - D3 fill overrides via null revert pattern (attr fill null = restore inherited default)

key-files:
  created: []
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/graph-algorithms.handler.ts
    - src/views/NetworkView.ts
    - src/ui/AlgorithmExplorer.ts
    - src/styles/network-view.css

key-decisions:
  - "edgeBetweenness returned as sourceId-targetId keyed Record (both directions) for O(1) NetworkView lookup"
  - "spDepths computed client-side from metricMap sp_depth column, returned inline in graph:compute response"
  - "Edge betweenness computed whenever centrality OR shortest_path runs (not a separate algorithm selection)"
  - "Weighted Dijkstra distance is cumulative sum of edge weights along path (not hop count)"
  - "Weight picker populates from _getNumericConnectionColumns() — returns [] by default since connections have fixed schema"

patterns-established:
  - "Phase 120: GALG encodings layered on top of existing path/MST encodings in _reapplyEncoding()"

requirements-completed:
  - GALG-01
  - GALG-02
  - GALG-03
  - GALG-04

# Metrics
duration: 25min
completed: 2026-03-25
---

# Phase 120 Plan 02: Graph Algorithms Phase 2 Summary

**Graph algorithm visualization extended with hop badge, d3.interpolateWarm distance coloring, edge betweenness stroke thickness, and weighted Dijkstra via numeric attribute picker**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-24T23:40:00Z
- **Completed:** 2026-03-25T00:05:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Worker handler now computes edge betweenness centrality automatically whenever centrality or shortest_path algorithm runs, returning both edgeBetweenness (Record<edgeKey, score>) and spDepths (Record<cardId, depth>) in the graph:compute response
- NetworkView renders a hop count badge (SVG circle + text) on the shortest path target node and colors all reachable nodes via d3.interpolateWarm keyed by distance
- Edge stroke-width scaled 1px-6px by edge betweenness score via d3.scaleLinear
- AlgorithmExplorer weight picker allows user to select a numeric connection attribute for weighted Dijkstra (defaults to Uniform weight=1)
- Legend updated with Distance from source gradient bar and Edge betweenness stroke preview sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Worker protocol + handler extensions** - `547b16bb` (feat)
2. **Task 2: NetworkView hop badge, distance coloring, edge thickness, weight picker** - `df0a1b04` (feat)

**Lint/format cleanup:** `5eb33aaa` (chore)

## Files Created/Modified

- `src/worker/protocol.ts` - Added weightAttribute to shortest_path params; added edgeBetweenness and spDepths to graph:compute response types
- `src/worker/handlers/graph-algorithms.handler.ts` - Added computeWeightedShortestPath (GALG-04), edge betweenness computation, edgeBetweenness/spDepths in response; removed unused bidirectional import
- `src/views/NetworkView.ts` - Extended AlgorithmEncodingParams; added _edgeBetweennessMap/_spDepths fields; hop badge (GALG-01), distance coloring (GALG-02), edge thickness (GALG-03), legend sections
- `src/ui/AlgorithmExplorer.ts` - Added _weightAttribute field, weight picker UI in shortest_path params, pass-through to onResult callback
- `src/styles/network-view.css` - Added .nv-hop-badge, .nv-legend__scale-bar--warm, .nv-legend__label-row

## Decisions Made

- Edge betweenness is computed opportunistically (when centrality or shortest_path runs) rather than as a standalone algorithm selection — this avoids a 7th radio button and keeps the feature lightweight
- spDepths is returned from the Worker response directly rather than re-reading from graph_metrics, enabling single-render-pass distance coloring without a second round-trip
- Distance coloring uses null-revert fill pattern so unreachable nodes keep their default source-colored fill
- Hop badge uses absolute SVG coordinates (d.x + r * 0.6, d.y - r * 0.6) rather than relative transform to avoid coordinate system conflicts with drag
- Weight picker returns empty columns by default (connections have fixed schema with no user-defined numeric attributes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Edit tool string matching failed for tab-indented TypeScript files in one case; resolved by using python3 string replacement for that block
- Pre-existing test failures: workbench-shell tests expect 5 sections but find 6 (not caused by this plan); benchmark test exceeds 2000ms budget on this machine (also pre-existing)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GALG-01..04 complete — Graph Algorithms Phase 2 visualization layer done
- AlgorithmExplorer weight picker wired end-to-end; adding real numeric connection attributes requires schema extension (future work if needed)
- All existing graph algorithm tests continue to pass

---
*Phase: 120-ship-prep*
*Completed: 2026-03-25*
