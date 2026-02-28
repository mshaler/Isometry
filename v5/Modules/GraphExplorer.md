# GraphExplorer

> Graph algorithms and relationship analysis — GRAPH layer operations

## Purpose

GraphExplorer provides graph-theoretic operations on the connection network: path finding, centrality analysis, clustering, and influence propagation. It operates on the **GRAPH layer** (Link, Nest, Sequence, Affinity edges).

## GRAPH Edge Types

| Type | Meaning | Algorithm Use |
|------|---------|---------------|
| **Link** | Direct reference | Shortest path, PageRank |
| **Nest** | Parent-child containment | Tree traversal, hierarchy depth |
| **Sequence** | Ordered succession | Timeline ordering, dependency chains |
| **Affinity** | Similarity/grouping | Clustering, community detection |

## Architecture

```
┌─────────────────────────────────────────────┐
│              GraphExplorer                   │
├─────────────────────────────────────────────┤
│  Algorithm Selector                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ Path    │ │ Rank    │ │ Cluster     │   │
│  └─────────┘ └─────────┘ └─────────────┘   │
│                                              │
│  Parameters                                  │
│  ┌─────────────────────────────────────┐    │
│  │ Source: [Card A    ▼]               │    │
│  │ Target: [Card B    ▼]               │    │
│  │ Max depth: [3      ]                │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Results                                     │
│  ┌─────────────────────────────────────┐    │
│  │ Path found: A → C → D → B           │    │
│  │ Distance: 3 hops                    │    │
│  │ [Highlight Path]                    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Core Algorithms

### Shortest Path (Dijkstra)

```javascript
function dijkstra(graph, source, target) {
  const dist = new Map([[source, 0]]);
  const prev = new Map();
  const queue = new MinHeap([[0, source]]);

  while (!queue.empty()) {
    const [d, u] = queue.pop();
    if (u === target) return reconstructPath(prev, target);

    for (const [v, weight] of graph.neighbors(u)) {
      const alt = d + weight;
      if (!dist.has(v) || alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
        queue.push([alt, v]);
      }
    }
  }
  return null; // No path
}
```

### PageRank

```javascript
function pageRank(graph, damping = 0.85, iterations = 20) {
  const N = graph.nodeCount();
  let rank = new Map(graph.nodes().map(n => [n, 1/N]));

  for (let i = 0; i < iterations; i++) {
    const newRank = new Map();
    for (const node of graph.nodes()) {
      let sum = 0;
      for (const inbound of graph.inEdges(node)) {
        sum += rank.get(inbound) / graph.outDegree(inbound);
      }
      newRank.set(node, (1 - damping) / N + damping * sum);
    }
    rank = newRank;
  }
  return rank;
}
```

### Community Detection (Louvain)

```javascript
function louvainCommunities(graph) {
  // Phase 1: Local modularity optimization
  let communities = new Map(graph.nodes().map(n => [n, n]));
  let improved = true;

  while (improved) {
    improved = false;
    for (const node of graph.nodes()) {
      const best = findBestCommunity(node, communities, graph);
      if (best !== communities.get(node)) {
        communities.set(node, best);
        improved = true;
      }
    }
  }

  // Phase 2: Aggregate and repeat
  return aggregateCommunities(communities);
}
```

### Centrality Measures

| Measure | SQL + Post-processing |
|---------|----------------------|
| **Degree** | `SELECT card_id, COUNT(*) FROM connections GROUP BY card_id` |
| **Betweenness** | All-pairs shortest path, count traversals |
| **Closeness** | Average distance to all other nodes |
| **Eigenvector** | Power iteration on adjacency matrix |

## SQL Foundations

Graph algorithms start with SQL queries:

```sql
-- Build adjacency list
SELECT
  from_card_id,
  to_card_id,
  edge_type,
  CASE edge_type
    WHEN 'link' THEN 1.0
    WHEN 'nest' THEN 0.5
    WHEN 'sequence' THEN 0.8
    WHEN 'affinity' THEN json_extract(context, '$.strength')
  END as weight
FROM connections
WHERE edge_type IN ('link', 'nest', 'sequence', 'affinity');
```

## Algorithm Results

Results stored as temporary node attributes:

```javascript
// After running PageRank
cards.forEach(card => {
  card._pagerank = rankMap.get(card.id);
});

// D3 can now use for sizing/coloring
svg.selectAll('circle')
  .attr('r', d => Math.sqrt(d._pagerank) * 50)
  .attr('fill', d => colorScale(d._pagerank));
```

## Interactions

| Action | Result |
|--------|--------|
| Select algorithm | Show parameter panel |
| Set source/target | Click cards in main view |
| Run algorithm | Compute and highlight results |
| "Apply to view" | Use results for sizing/coloring |
| Export | Download results as CSV |

## Integration with Views

GraphExplorer results enhance views:

```javascript
// Size nodes by PageRank
projection.sizeAxis = {
  field: '_pagerank',
  scale: d3.scaleSqrt().domain([0, maxRank]).range([4, 40])
};

// Color by community
projection.colorAxis = {
  field: '_community',
  scale: d3.scaleOrdinal(d3.schemeCategory10)
};
```

## Performance

| Operation | 10K nodes | 100K nodes |
|-----------|-----------|------------|
| Shortest path | < 10ms | < 100ms |
| PageRank (20 iter) | < 100ms | < 2s |
| Community detection | < 500ms | < 10s |

For large graphs, use Web Workers to avoid blocking UI.

## State

| State | Stored In |
|-------|-----------|
| Selected algorithm | Local component state |
| Algorithm parameters | Local component state |
| Computed results | Card._* temporary attributes |
| Highlighted path | Main view selection |

## Not Building

- Real-time streaming graph updates
- GPU-accelerated graph algorithms
- Machine learning on graph embeddings
- Graph database backend (staying with SQLite)
