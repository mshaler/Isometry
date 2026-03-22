# Project Research Summary

**Project:** Isometry v9.0 — Graph Algorithms Layer
**Domain:** Graph algorithm visualization integrated into an existing TypeScript/D3.js/sql.js platform
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

Isometry v9.0 adds six graph algorithms (Dijkstra shortest path, betweenness centrality, Louvain community detection, k-means clustering, Kruskal minimum spanning tree, PageRank) to the existing NetworkView. The platform already has a Worker Bridge, sql.js WASM database, D3 force simulation running off-thread, and a WorkbenchShell sidebar pattern — the algorithm layer is purely additive. The recommended approach is to use the graphology standard library (graphology 0.26.0, graphology-shortest-path, graphology-metrics, graphology-communities-louvain) for all graph operations except MST (custom 50-line Kruskal's), with a new `graph_metrics` sql.js table as the persistence and query layer that integrates naturally with the existing PAFV projection system.

The architecture follows a strict "Worker-side compute + sql.js persistence" pattern: all six algorithms run inside the Worker against a graphology Graph object built from the live database, write results to `graph_metrics` (a new flat per-node score table), and are surfaced to main thread only via stored metrics. This design is non-negotiable — it keeps the main thread unblocked, makes algorithm results queryable via SuperGrid GROUP BY, and prevents JS-side Maps from becoming a shadow system of record. The only significantly complex integration point is the SuperGridQuery LEFT JOIN injection when metric columns appear as PAFV axes; all other integrations follow existing patterns exactly.

The dominant risks are performance-related: betweenness centrality is O(n*m) and will time out on real user graphs of 5K+ nodes; synchronous Louvain on dense graphs blocks the entire Worker event loop; and adjacency matrix representations exhaust the WASM heap at 10K nodes. All three risks have concrete preventions — sampling-based approximate betweenness (k=√n pivots), chunked 500ms execution budget for Louvain, and adjacency list-only representation with a `_validateGraphScale()` guard — but they must be addressed at algorithm design time, not discovered during testing.

## Key Findings

### Recommended Stack

The graphology ecosystem is the correct choice for this milestone. graphology 0.26.0 introduced ESM support required for Vite 7's strict ESM bundling, bundles its own TypeScript declarations, and has zero runtime dependencies. Its standard library packages (graphology-shortest-path, graphology-metrics, graphology-communities-louvain) cover five of six algorithms as 2-5 line function calls. MST has no maintained graphology standard library implementation — custom Kruskal's with union-find is ~50 LOC and trivially testable. The graphology Graph object cannot cross postMessage (has method prototypes), so it must be built and consumed entirely within the Worker; only plain serializable results return to the main thread.

**Core technologies:**
- **graphology 0.26.0** — in-memory typed graph data structure — ESM-first, TypeScript bundled, Worker-compatible, zero deps; the foundation for all algorithm computation
- **graphology-shortest-path ~1.4.0** — Dijkstra (weighted) + BFS — replaces the existing unweighted SQL CTE shortestPath with a correct weighted implementation
- **graphology-metrics ~2.4.0** — betweenness centrality, PageRank, clustering coefficient, closeness, eigenvector — one package covers all centrality algorithms
- **graphology-communities-louvain (latest)** — Louvain community detection with resolution parameter and seeded RNG for reproducibility
- **ml-kmeans ~7.0.0** — k-means clustering on node attribute vectors — graphology has no k-means; mljs is the best-maintained TypeScript option (19K weekly downloads, Jan 2026)
- **Custom Kruskal's MST (~50 LOC)** — no maintained graphology-spanning-tree exists; Kruskal with union-find operates directly on sql.js edge rows without needing a graphology Graph object

New packages import only inside Worker handler files and are automatically split into the worker chunk by Vite. Net new worker chunk addition: ~94 KB (negligible vs. 2 MB sql.js WASM). Main thread bundle is unaffected.

### Expected Features

All six algorithms need a first-class UI surface. The graphology packages make algorithm computation trivial — the real implementation work is in the UI layer (algorithm selector, parameter controls, visual encoding, stale management) and the sql.js write-back integration.

**Must have (table stakes — Phase 1):**
- Algorithm selector panel (AlgorithmExplorer section in WorkbenchShell) — without a named UI surface algorithms are undiscoverable
- Node visual encoding of results — centrality/PageRank to node size via scaleSqrt; community_id to fill color via ordinal palette
- Shortest path source/target click picker + path highlight overlay — the primary UX for shortest path; two-click selection
- Community coloring via Louvain — most visually impactful output; immediately reveals graph structure
- PageRank with node size encoding — "most important cards" is a universally understood output
- Spanning tree MST edge overlay — MST edges thickened/colored, non-MST edges dimmed
- Clustering coefficient as hover tooltip score — supporting metric, no new DOM elements needed
- Algorithm result reset / clear — mandatory; without it the view gets stuck in algorithm mode
- `graph_metrics` table DDL + Worker compute handler — the persistence foundation for everything above

**Should have (differentiators — Phase 2):**
- sql.js write-back making algorithm scores queryable as PAFV axes and SuperGrid GROUP BY dimensions
- SchemaProvider column injection exposing centrality/PageRank/community_id as dynamic fields
- Multi-algorithm overlay (community color + centrality size simultaneously)
- Louvain resolution slider + PageRank damping factor parameter controls
- Filtered-graph algorithm execution respecting FilterProvider card scope

**Defer (Phase 3+):**
- Shortest path hop count badge on target node
- Single-source shortest path (source to all reachable, colored by distance)
- Edge betweenness centrality (edge thickness encoding)
- Step-by-step algorithm animation — anti-feature; never build this

### Architecture Approach

The architecture is a 5-phase layered build: storage foundation first (graph_metrics DDL + protocol types), then algorithm engine (Worker handler with all 6 algorithms), then schema integration (SchemaProvider injection + SuperGridQuery LEFT JOIN), then NetworkView visual encoding (dual-circle overlay, encoding layer, legend), then polish (stale indicator persistence, Worker re-init recovery, E2E specs). This order is strict — each phase unblocks the next. The AlgorithmControlsPanel acts as the orchestrator connecting all layers: it triggers compute, receives the response, calls `schemaProvider.injectGraphMetricsColumns()`, and calls `networkView.setMetrics()`. NetworkView stays dumb (render-only).

**Major components:**
1. `graph-algorithms.handler.ts` (new Worker handler) — all 6 algorithms + `graph_metrics` read/write; isolated to prevent graph.handler.ts from becoming a monolith
2. `graph_metrics` sql.js table — flat per-node score table (centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree, computed_at); PRIMARY KEY on card_id for idempotent re-runs
3. `AlgorithmControlsPanel.ts` (new UI component) — algorithm selector, parameter inputs, Run button, stale indicator; orchestrates compute to schema injection to NetworkView encoding
4. `SchemaProvider.injectGraphMetricsColumns()` (new method) — appends synthetic ColumnInfo entries after compute so metric columns become PAFV-eligible without modifying PRAGMA introspection
5. `NetworkView` (modified) — dual-circle overlay pattern, `_metricsMap` + `_activeEncoding` state, encoding layer replacing degree/card_type defaults when an algorithm is active; legend panel
6. `SuperGridQuery` (modified) — LEFT JOIN `graph_metrics` detection when a metric column appears in requested axes; the single most complex modification in this milestone

### Critical Pitfalls

1. **Stale algorithm results painted over a newer render** — Use a monotonically incrementing `currentRenderToken` on NetworkView; stamp each algorithm request; discard response if `response.token !== currentRenderToken`. Define this in protocol.ts before any algorithm handler is wired.

2. **Betweenness centrality O(n*m) timeout at 10K+ nodes** — Use sampling-based approximate betweenness (k=√n pivots) automatically when `nodes.length > 2000`. Gate with a performance benchmark at n=5000 (must complete < 2 seconds). Decide sampling-vs-exact at design time, not after hitting timeout in CI.

3. **Disconnected graph propagates NaN/Infinity into SVG attributes** — Write `sanitizeAlgorithmResult()` before any algorithm code. Isolated nodes (degree 0 or 1) produce NaN in clustering coefficient, Infinity in shortest path scales, singleton communities in Louvain. All six algorithms must pipe through this guard before any D3 attribute assignment.

4. **Worker blocking all DB operations during algorithm compute** — Chunk heavy algorithms across multiple Worker turns with a 500ms time budget per turn. Louvain's each modularity-optimization pass is one chunk. Never block the Worker for more than 500ms. Do NOT spawn nested Workers (unsupported in WKWebView's WKContentWorld).

5. **Community color scale collision with source-provenance colors** — Never assign `circle.attr('fill', ...)` on the base node circle for algorithm overlays. Use a dual-circle pattern: base circle retains source-provenance fill at all times; a `.algorithm-overlay` circle (fill-opacity: 0 by default) carries algorithm color. Toggling off sets fill-opacity: 0, restoring the base circle.

6. **Louvain non-determinism causes flaky tests** — All Louvain tests must pass a seeded RNG (`{ rng: () => 0.5 }`). Assert community membership invariants (connected nodes share community), never specific integer community IDs.

## Implications for Roadmap

Research strongly supports a 5-phase structure that mirrors the Architecture research build order. Dependencies are strict and each phase is independently testable.

### Phase A: Storage Foundation
**Rationale:** Everything else requires the `graph_metrics` table, Worker message types, and WorkerBridge methods to exist first. Zero UI — purely infrastructure. Can be verified with unit tests before any visual work begins.
**Delivers:** `graph-metrics.ts` DDL helpers, `graph_metrics` CREATE TABLE in Worker init, 3 new WorkerRequestTypes in protocol.ts (graph:compute, graph:metrics-read, graph:metrics-clear), Worker router case branches wired to stub handlers, WorkerBridge 3 new public methods
**Addresses:** Render token protocol defined here; graphVersion cache key designed here
**Avoids:** Retrofitting the protocol after algorithms are written; all downstream components depend on these types

### Phase B: Algorithm Engine
**Rationale:** With storage and protocol in place, all 6 algorithms can be implemented and tested in Worker isolation. No UI dependency. Each algorithm is testable against known small graphs with verifiable output (path length 3, community count 2, PageRank sum approximately 1.0).
**Delivers:** `graph-algorithms.handler.ts` with all 6 algorithms using graphology; `sanitizeAlgorithmResult()` utility; `_validateGraphScale()` guard; sampling-based betweenness centrality; directed/undirected flag routing; custom Kruskal's MST
**Uses:** graphology 0.26.0, graphology-shortest-path, graphology-metrics, graphology-communities-louvain, ml-kmeans
**Avoids:** NaN/Infinity sanitization pitfall, directed vs. undirected mismatch, Worker blocking via chunked execution, WASM heap exhaustion via adjacency list only

### Phase C: Schema Integration
**Rationale:** Once algorithms compute and write to `graph_metrics`, SchemaProvider injection unlocks PAFV projection of metric columns. SuperGridQuery LEFT JOIN is the most complex single change in this milestone — it deserves its own phase with dedicated seam tests.
**Delivers:** `SchemaProvider.injectGraphMetricsColumns()` (idempotent injection), SuperGridQuery LEFT JOIN detection for metric axes, `AlgorithmControlsPanel` Run button + parameter inputs + stale indicator (wires the full compute flow)
**Implements:** PAFV projection flow for community_id/pagerank/centrality as SuperGrid GROUP BY dimensions
**Avoids:** Adjacency reconstruction overhead via graphVersion cache; schema injection before compute produces empty axis lists

### Phase D: NetworkView Enhancement
**Rationale:** Visual encoding is the last structural step because it depends on metrics being computable (Phase B) and the AlgorithmControlsPanel orchestrator existing (Phase C). NetworkView receives metrics via `setMetrics()` — it does not fetch data itself. This keeps NetworkView dumb and keeps Phase D independently testable.
**Delivers:** `NetworkView.setMetrics()` + encoding layer (centrality scaleSqrt, community ordinal palette, path highlight via data attributes, MST edge thickness), dual-circle overlay architecture, legend panel, AlgorithmControlsPanel wired to `NetworkView.setMetrics()` after compute
**Avoids:** Community color vs. source-provenance collision via dual-circle pattern; PageRank flat distribution detection + degree-centrality fallback

### Phase E: Polish + E2E
**Rationale:** Stale indicator persistence, Worker re-init column re-injection, and E2E specs are polish that must come last because they exercise the full end-to-end flow. E2E specs provide the hard gate for CI.
**Delivers:** Stale indicator via `ui_state['graph_metrics:computed_at']`, on-Worker-re-init PRAGMA-based column re-injection (only if table has rows), E2E specs (compute flow, PAFV projection on community_id, NetworkView encoding toggle, stale indicator cycle)
**Avoids:** Render token correctness verified in concurrent-render E2E; Louvain non-determinism verified across 20 CI runs

### Phase Ordering Rationale

- Storage first because protocol.ts types are required by every downstream component; retrofitting them causes cascading changes across all handler and bridge files
- Algorithms before UI because Worker-only implementation is cleanly testable; visual encoding depends on algorithm correctness and would produce misleading test results if algorithms are broken
- Schema integration before visual encoding because AlgorithmControlsPanel (the orchestrator) must exist for `NetworkView.setMetrics()` to be called correctly; the two components are tightly coupled
- Polish last because stale indicator correctness requires the full compute to mutate to re-detect cycle, which requires all prior phases to be stable
- This ordering also minimizes concurrent merge conflicts: each phase touches largely disjoint files (Worker, SchemaProvider, NetworkView are modified in separate phases)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase C (SuperGridQuery LEFT JOIN):** The SuperGridQuery builder currently has no JOIN infrastructure. Adding LEFT JOIN `graph_metrics` detection for metric axis fields may require a more significant refactor than anticipated. A targeted read of `src/views/supergrid/SuperGridQuery.ts` before writing Phase C requirements is strongly recommended.
- **Phase D (NetworkView dual-circle pattern):** The existing NetworkView D3 data join uses a single `<circle>` per node. Adding a second `.algorithm-overlay` circle requires modifying the D3 enter/update/exit pattern. Verify that key function approach and position sync work as expected before finalizing requirements.

Phases with standard patterns (skip research-phase):
- **Phase A (Storage Foundation):** sql.js DDL + WorkerBridge method additions follow identical patterns to existing graph.ts and simulate.handler.ts. No research needed.
- **Phase B (Algorithm Engine):** graphology APIs are thoroughly documented. Kruskal's union-find is textbook. `sanitizeAlgorithmResult()` is pure utility logic. No research needed.
- **Phase E (Polish + E2E):** Stale indicator follows existing MutationManager notification subscription pattern. E2E specs follow the v8.3 Playwright spec pattern. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | graphology packages verified against official docs + direct codebase read; ml-kmeans is MEDIUM (no Context7 verification but npm stats and Jan 2026 publish date support it) |
| Features | HIGH | Grounded in direct codebase inspection of NetworkView.ts + web research on Gephi/Cytoscape/InfraNodus UX patterns; all algorithm API signatures confirmed against graphology official docs |
| Architecture | HIGH | Full codebase read of WorkerBridge, protocol.ts, SchemaProvider, NetworkView, simulate.handler.ts, graph.ts; all proposed patterns are verified extensions of existing patterns |
| Pitfalls | HIGH | Derived from Isometry codebase source analysis + algorithm complexity literature + graphology library docs + precedent from prior v4.2 race-condition fix (ViewManager stale timer) |

**Overall confidence:** HIGH

### Gaps to Address

- **ml-kmeans v7.0.0 API surface:** Not verified via Context7. Confirm that `KMeans(k, dataset)` interface matches expected usage in graph-algorithms.handler.ts before implementing the k-means algorithm. Low risk — the library is well-documented on npm.
- **SuperGridQuery refactor scope:** Architecture research proposes adding a `metricsColumns: Set<string>` parameter to the query builder. The actual complexity depends on how SuperGridQuery currently builds its SELECT and GROUP BY clauses. A 15-minute code read before Phase C planning will confirm whether this is a localized change or a larger refactor.
- **WKWebView chunked Worker execution:** Nested Workers are unsupported in WKWebView's WKContentWorld. The recommended chunked execution approach (`setTimeout(0, nextChunk)` inside Worker) must be verified as functional in WKWebView specifically before relying on it. This is a Phase B pre-flight check.
- **Directed graph UI toggle scope:** Research recommends an explicit "Treat connections as directed/undirected" toggle. The v9.0 requirements should specify whether this is in scope for Phase D or deferred. Defaulting to undirected (symmetrized edges) is safe for Phase 1 with the toggle added later.

## Sources

### Primary (HIGH confidence)
- Isometry `src/worker/protocol.ts` — existing WorkerRequestType union, WorkerPayloads/WorkerResponses shapes, correlation ID design
- Isometry `src/worker/handlers/simulate.handler.ts` — Worker-side compute pattern, zero DOM dependencies
- Isometry `src/database/queries/graph.ts` — sql.js recursive CTE patterns, confirmed unweighted BFS only
- Isometry `src/views/NetworkView.ts` — existing D3 data join patterns, positionMap warm-start, overlay precedents
- Isometry `src/providers/SchemaProvider.ts` — ColumnInfo shape, _cards internal list, _scheduleNotify() pattern
- [graphology npm](https://www.npmjs.com/package/graphology) — v0.26.0, ESM support, bundled types
- [graphology standard library](https://graphology.github.io/standard-library/) — complete package list; spanning tree confirmed absent
- [graphology-shortest-path docs](https://graphology.github.io/standard-library/shortest-path.html) — Dijkstra/BFS/A* API signatures
- [graphology-metrics docs](https://graphology.github.io/standard-library/metrics.html) — betweenness, PageRank, centrality algorithms
- [graphology-communities-louvain npm](https://www.npmjs.com/package/graphology-communities-louvain) — Louvain API, resolution/fastLocalMoves, seeded RNG option

### Secondary (MEDIUM confidence)
- [Gephi Network Analysis Guide](https://paldhous.github.io/NICAR/2016/gephi.html) — community coloring UX, Partition module pattern
- [Cambridge Intelligence: Centrality Algorithms](https://cambridge-intelligence.com/keylines-faqs-social-network-analysis/) — table stakes for centrality display in graph tools
- [InfraNodus Network Visualization](https://infranodus.com/docs/network-visualization-software) — automatic community detection and influence scoring UX patterns
- [VisuAlgo MST](https://visualgo.net/en/mst) — MST overlay visual approach (MST edges colored, non-MST dimmed)
- [Memgraph: 19 Graph Algorithms](https://memgraph.com/blog/graph-algorithms-list) — algorithm inventory and application patterns
- [ml-kmeans npm](https://www.npmjs.com/package/ml-kmeans) — v7.0.0, 19K weekly downloads, Jan 2026 publish
- Neo4j Graph Data Science — Betweenness Centrality O(n*m) complexity confirmation
- Brandes 2001, "A Faster Algorithm for Betweenness Centrality" — O(n*m) time and O(n+m) space complexity confirmation
- GeeksforGeeks — Why Prim's and Kruskal's MST algorithms fail for directed graphs; Chu-Liu/Edmonds arborescence alternative

### Tertiary (LOW confidence)
- WebAssembly Limitations (qouteall.fun, 2025) — WASM heap exhaustion behavior; needs validation against actual sql.js WASM heap limits in WKWebView context

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
