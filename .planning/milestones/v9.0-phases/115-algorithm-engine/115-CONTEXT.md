# Phase 115: Algorithm Engine - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement all 6 graph algorithms (shortest path, betweenness centrality, Louvain community, clustering coefficient, MST, PageRank) inside the existing stub `handleGraphCompute` handler. Each algorithm runs against the graphology UndirectedGraph already constructed in Phase 114, writes results to graph_metrics via idempotent INSERT OR REPLACE, and is independently testable against known small fixture graphs. No UI, no PAFV integration, no NetworkView changes — pure Worker-side compute + persistence.

</domain>

<decisions>
## Implementation Decisions

### Result Granularity & Batch Model
- Single `graph:compute` call executes ALL requested algorithms in one batch — one UndirectedGraph construction per call
- Response shape is summary only: `{algorithmsComputed, durationMs, cardCount, edgeCount, renderToken, componentCount, pathCardIds?, reachable?}` — caller uses `graph:metrics-read` to fetch per-card rows on demand
- Transactional batch write: all algorithms compute first, collect results into a single GraphMetricRow[] array, sanitize once via `sanitizeAlgorithmResult()`, then one `writeGraphMetrics()` call. Consistent `computed_at` timestamp. If any algorithm throws, no partial writes
- Partial runs preserve existing metrics: only overwrite columns for requested algorithms. If centrality was computed last time and user now runs pagerank+community, centrality values stay intact

### Disconnected Graph Behavior
- Isolated nodes (degree 0) get `community_id = null` — D3 color scale skips them, semantically correct ("not computed")
- Clustering coefficient: nodes with degree < 2 get `clustering_coeff = 0` — mathematically defensible (no triangles possible), consistent with graphology-metrics default
- MST produces a minimum spanning forest for disconnected graphs — `in_spanning_tree = 1` for forest edges, 0 otherwise. Response includes `componentCount`. Edge count = n - components (not n - 1)
- Handler sanitizes once: each algorithm returns raw values, handler merges into GraphMetricRow[], runs `sanitizeAlgorithmResult()` on each row, then batch writes. Single sanitization point

### Shortest Path UX Contract
- ALGO-01 runs as part of `graph:compute` when `'shortest_path'` is in the algorithms array — coexists with old `graph:shortestPath` BFS handler (different use cases: old = UI breadcrumb traversal, new = algorithm overlay with sp_depth persistence)
- Unreachable source/target: `sp_depth = null` for all cards, `pathCardIds: []`, `reachable: false` in response. Never store Infinity
- Response includes `pathCardIds: string[]` (ordered sequence) and `reachable: boolean` when shortest_path was requested — Phase 117 NetworkView needs the path sequence for edge highlighting
- sp_depth written ONLY for cards on the actual source-to-target path — other cards get `sp_depth = null`. Single-source distances to all reachable cards deferred to GALG-02 (Future Requirements)

### Testing Strategy
- 4 canonical fixture graphs with hand-computed expected values for all 6 algorithms:
  1. **Triangle** (3 nodes, 3 edges) — fully connected
  2. **Star** (5 nodes, 4 edges) — one hub node
  3. **Two-component** (5 nodes: one 3-clique + one disconnected pair) — tests disconnected behavior
  4. **Linear chain** (5 nodes, 4 edges) — tests path depth and MST = full graph
- Seeded RNG for Louvain (graphology-communities-louvain `rng` option) + tolerance assertions for PageRank (sum within 0.01 of 1.0, relative ordering over exact values)
- Performance benchmark at n=2000: generate random graph, assert betweenness centrality completes in < 2 seconds (validates sqrt(n) sampling kicks in). Separate benchmark file following v6.0 pattern
- One handler test file: extend existing `tests/worker/graph-algorithms-handler.test.ts` with describe blocks per algorithm. Separate benchmark file for n=2000 perf test

### Claude's Discretion
- Internal algorithm function signatures (pure functions taking UndirectedGraph, returning partial metric maps)
- graphology-metrics vs graphology-shortest-path vs custom implementation choices per algorithm
- Exact sqrt(n) sampling implementation for betweenness centrality
- Benchmark graph generation strategy (Erdos-Renyi, Barabasi-Albert, etc.)
- Error handling within individual algorithms (try/catch granularity)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Research
- `.planning/research/ARCHITECTURE.md` — Full system architecture, Worker-side compute pattern, component responsibilities
- `.planning/research/STACK.md` — graphology 0.26.0 dependency, algorithm-to-library mapping (graphology-shortest-path, graphology-metrics, graphology-communities-louvain), bundle size analysis
- `.planning/research/PITFALLS.md` — NaN/Infinity sanitization, disconnected graph handling, sqrt(n) sampling thresholds, seeded RNG testing

### Requirements
- `.planning/REQUIREMENTS.md` — ALGO-01 through ALGO-06 acceptance criteria, out-of-scope items (no step-by-step animation, no all-pairs shortest path, no manual edge weights)

### Phase 114 Context (upstream decisions)
- `.planning/phases/114-storage-foundation/114-CONTEXT.md` — DDL schema, render token mechanism, graphology integration decisions, handler file structure

### Existing Code (integration points)
- `src/worker/handlers/graph-algorithms.handler.ts` — Phase 114 stub handler to extend with algorithm implementations
- `src/worker/protocol.ts` — WorkerPayloads['graph:compute'] already typed with algorithms array and params
- `src/database/queries/graph-metrics.ts` — DDL, writeGraphMetrics(), readGraphMetrics(), clearGraphMetrics()
- `src/worker/utils/sanitize.ts` — sanitizeAlgorithmResult() utility (GFND-03)
- `tests/worker/graph-algorithms-handler.test.ts` — Existing handler tests to extend

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handleGraphCompute()` stub: Already constructs UndirectedGraph from connections table, returns cardCount/edgeCount/renderToken. Phase 115 adds algorithm execution inside this function
- `writeGraphMetrics()`: Batch upsert accepting GraphMetricRow[]. Ready for algorithm results
- `sanitizeAlgorithmResult()`: NaN/Infinity guard. Already tested with 15+ test cases
- `readGraphMetrics()` / `readAllGraphMetrics()`: Query helpers for graph:metrics-read handler

### Established Patterns
- `domain:action` naming for WorkerRequestType (`graph:compute`, not `computeGraph`)
- Handler files export a single `handle*` function per message type
- INSERT OR REPLACE for idempotent writes (used in ui_state, import catalog, graph_metrics)
- Performance benchmarks follow v6.0 pattern: separate .bench.ts file, assertion on duration

### Integration Points
- `handleGraphCompute()` in `graph-algorithms.handler.ts` — drop algorithm logic here
- Protocol response type `WorkerResponses['graph:compute']` needs `componentCount`, `pathCardIds?`, `reachable?` fields added
- Worker router in `worker.ts` already routes `graph:compute` to handler — no new routing needed
- `package.json` — add graphology algorithm sub-packages (graphology-shortest-path, graphology-metrics, graphology-communities-louvain)

</code_context>

<specifics>
## Specific Ideas

- Success criteria require verification against a 5-node test graph with known shortest path of length 3 — the "Two-component" or "Linear chain" fixture should satisfy this
- Betweenness centrality must auto-switch to sqrt(n)-pivot sampling above 2000 nodes — this is a hard threshold, not configurable by the user in Phase 115 (CTRL-02 adds the threshold control in Phase 116)
- PageRank scores across all cards must sum to approximately 1.0 (within 0.01 tolerance) — use damping factor 0.85 with teleportation for dangling nodes
- MST edge count = node count - component count (not n-1) for disconnected graphs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 115-algorithm-engine*
*Context gathered: 2026-03-22*
