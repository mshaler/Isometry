# Stack Research

**Domain:** Graph algorithms layer — adding 6 algorithms to existing TypeScript/D3.js/sql.js platform
**Researched:** 2026-03-22
**Confidence:** HIGH (graphology ecosystem), MEDIUM (k-means library choice), HIGH (spanning tree: implement from scratch)

---

## Context: What Already Exists (DO NOT RE-RESEARCH)

The Isometry platform already has:
- Worker Bridge with typed `WorkerRequestType` message routing and correlation IDs
- sql.js WASM database (cards + connections tables) running inside the Worker
- D3.js NetworkView with force simulation running in the Worker via `graph:simulate`
- Two SQL-based graph handlers: `graph:connected` (recursive CTE BFS) and `graph:shortestPath` (recursive CTE path accumulation)
- `src/database/queries/graph.ts` — the existing SQL graph query module

**The SQL-based `graph:shortestPath` handler performs unweighted BFS only.** It ignores connection weights and hard-limits depth to 10. Dijkstra is a replacement, not an addition.

The new algorithms (PageRank, betweenness centrality, Louvain community detection, k-means, minimum spanning tree, weighted shortest path) **cannot be expressed as SQL queries** — they require iterative convergence loops over an in-memory graph object. A JS graph data structure library is required.

**Stack additions are purely additive.** No existing source file changes except extending `WorkerRequestType`, `WorkerPayloads`, and `WorkerResponses` in `protocol.ts` with new message types.

---

## Recommended Stack — New Additions Only

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **graphology** | 0.26.0 | In-memory typed graph data structure (directed, undirected, mixed) | TypeScript-native with bundled type declarations (no separate `@types` install). ESM support added in 0.26.0 — critical for Vite 7's ESM-first bundling. Zero dependencies (removed `obliterator` in 0.26). Browser/Worker-compatible. Serializes via `graph.export()` to plain JSON for `postMessage` round-trips. Standard interface used by all graphology algorithm packages. |
| **graphology-shortest-path** | ~1.4.0 | Dijkstra (weighted) + BFS (unweighted) + A* | Replaces the existing SQL CTE `graph:shortestPath` with a proper weighted implementation. API: `dijkstra.bidirectional(graph, source, target, weightAttr)` returns node path or null. `singleSource()` for all-pairs from one node. `getEdgeWeight` option accepts attribute name string or getter function. |
| **graphology-metrics** | ~2.4.0 | Betweenness centrality, PageRank, degree/closeness/eigenvector centrality | One package covers all centrality algorithms needed. `betweennessCentrality(graph)` returns `Record<nodeId, score>`. `pagerank(graph, options)` same shape. Both support `.assign()` variant to write scores directly to node attributes. `getEdgeWeight` option for weighted variants. Published ~Feb 2026 at v2.4.0. |
| **graphology-communities-louvain** | latest | Louvain community detection | Official graphology standard library Louvain implementation. Works on undirected and directed graphs using appropriate modularity computation for each. `louvain.assign(graph, options)` writes community IDs to node attributes. `resolution` parameter controls community coarseness (higher = more communities). `fastLocalMoves` flag for performance. |
| **ml-kmeans** | ~7.0.0 | K-means clustering on node attribute vectors | graphology has no k-means — k-means is a general ML algorithm, not a graph-topology algorithm. ml-kmeans from the mljs ecosystem is the best-maintained TypeScript option (19K weekly downloads, published Jan 2026 at v7.0.0). Includes K-means++ initialization for stable centroids. Use after computing centrality scores to cluster cards by multi-dimensional attribute vectors (e.g., `[degree, betweenness, normalizedYear]`). |

### Implement from Scratch (No New Package)

| Algorithm | Rationale | Complexity |
|-----------|-----------|------------|
| **Minimum Spanning Tree (Kruskal)** | No `graphology-spanning-tree` package exists. Kruskal with union-find is ~50 LOC — trivially testable. Sort connection edges by weight, iterate with union-find to select non-cycle edges. Operates on the raw `SELECT source_id, target_id, weight FROM connections` result; no graphology Graph object needed. | ~50 LOC in `src/worker/handlers/graph-spanning-tree.handler.ts` |

### Supporting Libraries (No New Installs)

The following are already installed and serve the integration layer:

| Library | Existing Role | New Role |
|---------|---------------|----------|
| **sql.js** ^1.14.0 | System of record | Source of nodes/edges for graph construction: `SELECT id FROM cards WHERE deleted_at IS NULL` + `SELECT source_id, target_id, weight FROM connections WHERE deleted_at IS NULL` |
| **d3** ^7.9.0 | NetworkView rendering | Consume algorithm results: community colors via D3 color scales, centrality node sizing via D3 radius scales, spanning tree edge subset as link filter |
| **typescript** ^5.9.3 | Type checking | graphology exports full TypeScript declarations bundled with the package — no separate `@types/graphology` install |

---

## Integration Architecture

### Pattern: Materialize → Build → Compute → Return

All new algorithm handlers follow the same Worker pattern. The graphology `Graph` object **cannot cross `postMessage`** (it has methods). Build the graph inside the Worker, return only a plain serializable result.

```typescript
// src/worker/handlers/graph-centrality.handler.ts (example)
import { UndirectedGraph } from 'graphology';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';

export function handleGraphBetweenness(db: Database): Record<string, number> {
  // 1. Materialize from sql.js (already in Worker)
  const nodeRows = db.exec('SELECT id FROM cards WHERE deleted_at IS NULL')[0];
  const edgeRows = db.exec('SELECT source_id, target_id, weight FROM connections WHERE deleted_at IS NULL')[0];

  // 2. Build graphology Graph
  const g = new UndirectedGraph();
  nodeRows?.values.forEach(([id]) => g.addNode(id as string));
  edgeRows?.values.forEach(([src, tgt, w]) => {
    if (g.hasNode(src) && g.hasNode(tgt)) {
      g.addEdge(src as string, tgt as string, { weight: (w as number) ?? 1 });
    }
  });

  // 3. Compute — returns plain Record<nodeId, score>
  return betweennessCentrality(g);
  // 4. Return crosses postMessage boundary as plain object — no serialization needed
}
```

### New Worker Message Types

Add to `WorkerRequestType` union in `src/worker/protocol.ts`:

```
graph:dijkstra           → { path: string[] | null; weight: number | null }
graph:pagerank           → Record<string, number>   // nodeId → score
graph:betweenness        → Record<string, number>   // nodeId → score
graph:communities        → Record<string, number>   // nodeId → communityId
graph:spanning-tree      → Array<{ source: string; target: string; weight: number }>
graph:kmeans             → { assignments: Record<string, number>; k: number }  // nodeId → clusterIndex
```

### Serialization Constraint

Graphology `Graph` objects are NOT structured-clone-compatible (they have method prototypes). They must be built and consumed entirely within the Worker. The serialized form (`graph.export()`) is plain JSON and CAN cross `postMessage`, but there is no reason to transfer it — the Worker has direct access to sql.js and should build the Graph locally.

---

## Installation

```bash
# New runtime dependencies
npm install graphology graphology-shortest-path graphology-metrics graphology-communities-louvain

# K-means (only if k-means clustering feature is confirmed in scope)
npm install ml-kmeans
```

No `devDependencies` additions. No changes to `dependencies` other than the above. No Vite config changes — new packages import inside the Worker handler files only and will be automatically split into the worker chunk by Vite's `import.meta.url` Worker bundling.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| graphology | Cytoscape.js | Cytoscape bundles a full rendering engine (~300 KB). The project already uses D3 for rendering. Adding Cytoscape for algorithms only adds DOM-manipulation code that cannot run in a Worker context. Use Cytoscape only if you need its visual layout algorithms (no overlap, hierarchical) instead of D3 force. |
| graphology | ngraph.\* | ngraph.graph + ngraph.path work and are browser-compatible, but the ecosystem is fragmented (20+ separate packages with inconsistent maintenance). graphology has a unified standard library with coordinated releases. |
| graphology | Custom adjacency list | Viable for 1-2 algorithms but would require reimplementing directed/undirected edge handling, iteration, and serialization. graphology gives all of this for free at ~40 KB. |
| graphology-metrics (PageRank) | graphology-pagerank (standalone) | graphology-pagerank is deprecated. PageRank moved into graphology-metrics as `graphology-metrics/centrality/pagerank`. Do not install the standalone package. |
| Custom Kruskal (~50 LOC) | npm spanning tree package | No maintained `graphology-spanning-tree` package exists in the graphology standard library. Standalone MST packages on npm are low-maintenance and add a dependency for 50 LOC. Implement directly. |
| ml-kmeans | Louvain for clustering | Louvain finds topology-based communities (densely connected subgraphs). K-means clusters on attribute vectors (card metadata). They answer different questions. Both may be in scope; they are complementary, not alternatives. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `graphology-layout-forceatlas2` | NetworkView already runs d3-force simulation in the Worker. Adding a second layout engine creates competing simulations and doubles bundle size in the worker chunk | Existing `handleGraphSimulate` (`simulate.handler.ts`) |
| `graphology-pagerank` (standalone npm package) | Deprecated and unmaintained since 2022 | `graphology-metrics/centrality/pagerank` (subpath import from graphology-metrics) |
| SQL recursive CTEs for PageRank / betweenness / Louvain | These are iterative convergence algorithms. SQL cannot express them without custom UDFs or O(n³) workarounds. The existing SQL CTE graph handlers are correct for BFS traversal only. | graphology in Worker handler |
| Reusing existing `graph:shortestPath` for weighted paths | The current SQL CTE does unweighted BFS. It will silently return wrong (too-short) paths when connections have weights. | `graphology-shortest-path` Dijkstra with `getEdgeWeight` option |
| `graphology-types` as a separate install | Bundled with graphology 0.26+ as a peer dep. Installing separately risks version mismatch. | `npm install graphology` (types included) |
| `graphology-library` (aggregate bundle) | Imports all 22 standard library packages at once. Adds ~500 KB to worker chunk for algorithms not used. | Import individual packages: `graphology-metrics`, `graphology-shortest-path`, `graphology-communities-louvain` |

---

## Bundle Size Impact

New packages import only inside Worker handler files (`src/worker/handlers/graph-*.handler.ts`). Vite splits them into the worker chunk. Main thread bundle size is unaffected.

Estimated additions to worker chunk (minified):
- graphology core: ~40 KB
- graphology-shortest-path: ~8 KB
- graphology-metrics: ~20 KB
- graphology-communities-louvain: ~15 KB
- ml-kmeans: ~10 KB
- Custom Kruskal: ~1 KB

Total new weight in worker chunk: **~94 KB**. Acceptable — the worker already contains sql.js WASM (~2 MB). Net impact on worker initialization time: negligible (WASM parse dominates).

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| graphology@0.26.0 | TypeScript ^5.9.3 | graphology-types bundled; types exported from main package entry point |
| graphology@0.26.0 | Vite ^7.3.1 | ESM support added in 0.26.0 — required for Vite 7's strict ESM bundling |
| graphology@0.26.0 | @vitest/web-worker ^4.0.18 | graphology is pure JS/TS; runs in Vitest worker test environment with no special config |
| graphology-metrics@~2.4.0 | graphology@0.26.x | Standard library packages track graphology major.minor; install together and run `npm ls graphology` to verify single version |
| ml-kmeans@~7.0.0 | TypeScript ^5.9.3 | mljs publishes full TypeScript declarations; published Jan 2026 |

---

## Sources

- [graphology npm](https://www.npmjs.com/package/graphology) — version 0.26.0, ESM support, last published ~Feb 2025 (HIGH confidence)
- [graphology standard library index](https://graphology.github.io/standard-library/) — complete package list; no spanning tree package confirmed (HIGH confidence)
- [graphology shortest-path docs](https://graphology.github.io/standard-library/shortest-path.html) — Dijkstra/BFS/A* API signatures (HIGH confidence)
- [graphology metrics docs](https://graphology.github.io/standard-library/metrics.html) — betweenness, PageRank, centrality algorithms; no clustering coefficient (HIGH confidence)
- [graphology-communities-louvain npm](https://www.npmjs.com/package/graphology-communities-louvain) — Louvain API, resolution/fastLocalMoves options (HIGH confidence)
- [graphology-metrics npm](https://www.npmjs.com/package/graphology-metrics) — v2.4.0 confirmed, PageRank at subpath `graphology-metrics/centrality/pagerank` (HIGH confidence)
- [ml-kmeans npm](https://www.npmjs.com/package/ml-kmeans) — v7.0.0, published ~Jan 2026, 19K weekly downloads (MEDIUM confidence — no Context7 verification)
- Isometry `src/worker/protocol.ts` — existing Worker message types, `postMessage` serialization constraints (HIGH confidence — read directly)
- Isometry `src/database/queries/graph.ts` — existing SQL-based `connectedCards` and `shortestPath` handlers; confirmed unweighted BFS only (HIGH confidence — read directly)
- Isometry `package.json` — current dependencies; no graph library installed (HIGH confidence — read directly)

---
*Stack research for: Graph algorithms layer (Dijkstra, BFS, k-means clustering, betweenness centrality, Louvain community detection, Kruskal/Prim spanning tree, PageRank)*
*Researched: 2026-03-22*
