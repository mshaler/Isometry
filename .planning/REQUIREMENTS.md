# Requirements: Isometry v9.0 Graph Algorithms

**Defined:** 2026-03-22
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v9.0 Requirements

Requirements for graph algorithm computation, PAFV integration, and NetworkView visual encoding. Each maps to roadmap phases.

### Graph Foundation

- [ ] **GFND-01**: User can see a `graph_metrics` sql.js table with per-card columns for all 6 algorithm scores (centrality, pagerank, community_id, clustering_coeff, sp_depth, in_spanning_tree)
- [ ] **GFND-02**: Worker constructs graphology Graph from sql.js connections table on `graph:compute` message
- [ ] **GFND-03**: `sanitizeAlgorithmResult()` utility guards all 6 algorithms against NaN/Infinity from disconnected graphs before D3 rendering
- [ ] **GFND-04**: Stale indicator shows when graph_metrics results are outdated after card/connection data changes

### Algorithms

- [ ] **ALGO-01**: User can compute shortest path between two cards using Dijkstra (graphology-shortest-path)
- [ ] **ALGO-02**: User can compute betweenness centrality for all cards (graphology-metrics, with √n sampling above 2000 nodes)
- [ ] **ALGO-03**: User can compute community assignments via Louvain method (graphology-communities-louvain)
- [ ] **ALGO-04**: User can compute local clustering coefficient for all cards (graphology-metrics)
- [ ] **ALGO-05**: User can compute minimum spanning tree via Kruskal's algorithm (custom ~50 LOC)
- [ ] **ALGO-06**: User can compute PageRank scores for all cards (graphology-metrics)

### PAFV Integration

- [ ] **PAFV-01**: SchemaProvider exposes graph metric columns as dynamic PAFV-eligible fields after computation
- [ ] **PAFV-02**: SuperGridQuery LEFT JOINs graph_metrics when metric columns are used as axes
- [ ] **PAFV-03**: Algorithms run on currently filtered card set (respects FilterProvider scope)
- [ ] **PAFV-04**: User can apply community color AND centrality size simultaneously (multi-algorithm overlay)

### NetworkView Enhancement

- [ ] **NETV-01**: Nodes sized by centrality/PageRank and colored by community when algorithm active (replaces degree/card_type defaults)
- [ ] **NETV-02**: Shortest path edges highlighted with distinct stroke; non-path edges dimmed
- [ ] **NETV-03**: Spanning tree edges thickened/colored; non-MST edges dimmed
- [ ] **NETV-04**: Legend panel shows active algorithm, color/size encoding scale, community palette
- [ ] **NETV-05**: Two-click source/target node picker for shortest path with dropdown keyboard fallback

### Controls

- [ ] **CTRL-01**: Algorithm Explorer sidebar section with algorithm selector radio group and Run button
- [ ] **CTRL-02**: Louvain resolution slider, PageRank damping factor input, centrality sampling threshold control
- [ ] **CTRL-03**: Hover tooltip shows exact numeric scores (PageRank, centrality, clustering coefficient)
- [ ] **CTRL-04**: Clear/Reset button returns to default degree sizing and source coloring

## Future Requirements

### Graph Algorithms Phase 2

- **GALG-01**: Shortest path hop count badge on target node
- **GALG-02**: Single-source shortest path (one source to all reachable targets, colored by distance)
- **GALG-03**: Edge betweenness centrality with edge thickness encoding
- **GALG-04**: Weighted shortest path via connection attribute derivation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Step-by-step algorithm animation | Anti-feature — Isometry is a data analysis tool, not an educational algorithm visualizer. Worker architecture incompatible with step-by-step execution. |
| All-pairs shortest path matrix | O(N²) catastrophic at >100 nodes; single-source provides 80% of value at O(N) cost |
| Manual edge weight entry | No numeric weight field in connections schema; unweighted Dijkstra correct for knowledge graphs |
| Custom algorithm selection (Leiden, Walktrap, InfoMap) | Louvain with resolution slider covers the use case; additional libraries add bundle cost |
| Real-time algorithm re-execution on node drag | Topology unchanged by position — drag does not invalidate algorithm results |
| Export algorithm results as separate file | Write-back to graph_metrics + existing ExportOrchestrator covers the use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GFND-01 | — | Pending |
| GFND-02 | — | Pending |
| GFND-03 | — | Pending |
| GFND-04 | — | Pending |
| ALGO-01 | — | Pending |
| ALGO-02 | — | Pending |
| ALGO-03 | — | Pending |
| ALGO-04 | — | Pending |
| ALGO-05 | — | Pending |
| ALGO-06 | — | Pending |
| PAFV-01 | — | Pending |
| PAFV-02 | — | Pending |
| PAFV-03 | — | Pending |
| PAFV-04 | — | Pending |
| NETV-01 | — | Pending |
| NETV-02 | — | Pending |
| NETV-03 | — | Pending |
| NETV-04 | — | Pending |
| NETV-05 | — | Pending |
| CTRL-01 | — | Pending |
| CTRL-02 | — | Pending |
| CTRL-03 | — | Pending |
| CTRL-04 | — | Pending |

**Coverage:**
- v9.0 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
