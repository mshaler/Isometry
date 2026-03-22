# Feature Research

**Domain:** Graph Algorithm Visualization — adding 6 algorithms (shortest path, clustering, centrality, community detection, spanning tree, PageRank) to an existing force-directed network view in a local-first data projection platform
**Researched:** 2026-03-22
**Confidence:** HIGH (grounded in direct codebase inspection of NetworkView.ts, web research on Graphology standard library, Gephi/Cytoscape UX patterns, and D3.js algorithm visualization practices)

---

## Context: What Already Exists

This is an additive milestone on top of a shipped product. The graph infrastructure is not being built — it is being extended.

**Already shipped in NetworkView.ts:**
- Force-directed layout via `graph:simulate` Worker message (D3 force simulation off-thread)
- Nodes sized by degree, colored by card_type via CSS tokens
- Drag-to-pin (fx/fy), zoom/pan, hover dimming of non-connected nodes
- Click-to-select with SelectionProvider integration
- Keyboard navigation with spatial nearest-neighbor arrow movement
- Audit overlays (new/modified/deleted) and source provenance coloring

**Already shipped in Worker (protocol.ts):**
- `graph:simulate` message type with `SimulatePayload` (nodes + links + viewport)
- Node position warm-start via `positionMap`

**Algorithm library available:** Graphology standard library (`graphology-shortest-path`, `graphology-metrics`, `graphology-communities-louvain`) covers 5 of 6 algorithms natively. Spanning tree requires a custom Kruskal/Prim implementation or a lightweight npm package. All algorithms run in the Worker — main thread receives only results.

**The 6 algorithms to add:**
1. Shortest Path (Dijkstra source-to-target, unweighted and optionally weighted)
2. Clustering Coefficient (local clustering per node)
3. Centrality (betweenness, closeness, degree, eigenvector — multiple metrics)
4. Community Detection (Louvain method via `graphology-communities-louvain`)
5. Spanning Tree (Kruskal's MST overlay)
6. PageRank (influence/authority scoring)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features expected in any network analysis tool that adds algorithm support. Missing these makes the feature feel incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Algorithm selector panel** — UI control to choose which algorithm is active (none, shortest path, centrality, community, spanning tree, PageRank) | Every graph tool (Gephi, Cytoscape, InfraNodus) has a discrete algorithm mode — users cannot discover algorithms without named controls | LOW | Fits as a new `AlgorithmExplorer` section in WorkbenchShell sidebar. One radio group or segmented control. Wires into a new `GraphAlgorithmProvider`. |
| **Node visual encoding of results** — algorithm scores mapped to node size or color (not just degree) | After running centrality or PageRank, users expect nodes to visually reflect scores — static degree sizing looks wrong alongside algorithm results | MEDIUM | Requires a `resultScale` that replaces `degreeScale` when an algorithm is active. CSS token approach (theme-aware) keeps colors consistent. |
| **Shortest path source/target node picker** — two-click or dropdown selection to specify path endpoints | Without source and target selection, shortest path is impossible to invoke; every shortest path UI has this (VisuAlgo, Pathfinding Visualizer, Gephi) | MEDIUM | Most natural UX: click one node to set "source" (highlighted in one color), click another to set "target" (different color), path auto-computes. Dropdown fallback for keyboard users. |
| **Path highlight overlay** — edges and nodes on the shortest path drawn distinctly from the rest of the graph | The key output of shortest path is the visual path trace — without highlighting it is invisible | MEDIUM | Add a `data-path="true"` attribute on path edges, style with a distinct color token. Non-path elements dim (same pattern as existing hover dimming). |
| **Community coloring** — each detected community assigned a distinct fill color | Community detection output is meaningless without color mapping; every community detection tool (Gephi Modularity, InfraNodus) uses color-per-community as the primary visual | MEDIUM | Map `communityId → CSS custom property` from a fixed palette of 8-12 community colors (CSS tokens). Node circles get `fill` from community color instead of card_type color. |
| **Result score display on hover** — hovering a node shows its algorithm score (PageRank value, centrality score, cluster coefficient) | Users expect to read numeric values; sizing gives relative sense but hover tooltip gives exact value | LOW | Add score to the SVG `<title>` tooltip on hover. No new DOM elements needed — update existing `mouseenter` handler. |
| **Algorithm result reset / clear** — returning to the default view (degree sizing, source coloring) without reloading | Users toggle algorithms on and off; no clear mechanism means the view gets stuck in algorithm mode | LOW | "Clear" button or selecting "None" in algorithm selector triggers a re-render with original degree/color encoding. |
| **Spanning tree edge overlay** — MST edges drawn with a distinct stroke on top of the normal graph | Users expect spanning tree to visually distinguish its edges from non-tree edges; the overlay model (keep all edges, highlight MST subset) is the standard UX (VisuAlgo MST, CySpanningTree) | MEDIUM | Add `data-mst="true"` on MST edge `<line>` elements. CSS rule makes them thicker/colored; non-MST edges dim. |

### Differentiators (Competitive Advantage)

Features that go beyond what basic graph analysis tools offer. These create the uniquely Isometry experience — algorithms integrated into the PAFV projection + sql.js system rather than as a bolt-on visualization layer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Algorithm results written back to sql.js** — PageRank, centrality, and community scores persisted as virtual columns via `ui_state` or a new `card_metrics` table | No graph tool writes algorithm results back to queryable SQL — this means results can be used as SuperGrid axes, filter criteria, or aggregation dimensions. A node's centrality score becomes a filterable field. | HIGH | Two options: (a) write scores to `ui_state` keyed as `algo_result:{algo}:{cardId}`, or (b) add a `card_metrics` SQL table with (card_id, algo_name, score, computed_at). Option (b) enables SuperGrid GROUP BY centrality buckets. SchemaProvider would need to expose these as dynamic fields. |
| **Multi-algorithm overlay** — show community coloring AND centrality sizing simultaneously | Gephi requires separate runs; Isometry can layer them because community color and centrality size are independent visual channels | MEDIUM | Node fill = community color, node radius = centrality score. Two independent visual encodings do not conflict. Requires AlgorithmProvider to track multiple active results. |
| **Filtered-graph algorithm execution** — algorithms run on the currently filtered card set (respecting FilterProvider), not the full graph | Most graph tools run on the entire graph; Isometry's FilterProvider already scopes the card set for all other views — applying the same scope to algorithms means "find shortest path between my Apple Notes cards" is possible | MEDIUM | Worker `graph:algorithm` message must receive filtered card IDs from the current render's card set (same filtering already used in `graph:simulate`). No new filter infrastructure needed. |
| **Algorithm Explorer panel** — collapsible WorkbenchShell section with algorithm-specific parameter controls below the selector | Isometry's WorkbenchShell pattern gives algorithm parameters a natural home alongside Projection, LATCH, and Calc explorers. Users can tune Louvain resolution slider and PageRank damping factor without leaving the workflow. | MEDIUM | Follows the `CollapsibleSection` pattern. Algorithm-specific sub-panels render conditionally when that algorithm is active (Louvain shows resolution slider; PageRank shows damping factor input). |
| **Shortest path hop count badge** — show hop count as a number overlay on the source or target node after path computation | Gephi and Cytoscape show path length in a statistics panel; an inline badge on the target node makes the result immediately readable in context | LOW | SVG `<text>` badge appended to target node circle. Shows "4 hops" after Dijkstra completes. |
| **PageRank / centrality as sort axis in other views** — computed scores usable as a sort dimension in ListView, GridView, KanbanView | Uniquely exploits Isometry's multi-view architecture — PageRank a network to find the most influential cards, then sort a list view by that score | HIGH | Requires sql.js write-back (see first differentiator row). Once scores are in `card_metrics`, SuperGrid/List/Grid can `ORDER BY` them. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Step-by-step algorithm animation** — showing Dijkstra's expanding frontier or Kruskal's edge-by-edge MST construction with play/pause controls | Algorithm visualizer tools (VisuAlgo, Pathfinding Visualizer, See Algorithms) animate steps; seems educational | Isometry is a data analysis tool, not an educational algorithm visualizer. Step-by-step animation requires a completely different execution model (halting mid-algorithm, storing intermediate state), adds substantial complexity, and provides zero analytical value to a user examining their own data. The Worker-based architecture (send payload, receive result) is deliberately incompatible with step-by-step execution. | Show the final result instantly. Add a subtle transition when new node/edge styles are applied (300ms CSS transition on fill and stroke). |
| **Weighted shortest path requiring manual edge weight entry** — UI for users to type a numeric weight on each connection | Edge weights seem essential for "real" shortest path analysis | Isometry's connection schema has no numeric weight field. Adding manual weight entry for N connections is prohibitive UX. The unweighted Dijkstra (treating all edges as weight=1) is the correct default for a knowledge graph. | Support weight derivation from existing connection fields (e.g., `label` parsed as a number, or a synthetic weight based on connection count). Make weighting opt-in and attribute-driven, not manual entry. |
| **All-pairs shortest path matrix** — compute and display the shortest path between every pair of nodes | Seems like a natural extension of single-pair shortest path | O(N²) computation is catastrophic for graphs with >100 nodes. At 1000 nodes, all-pairs = 500K path computations. Even in a Worker, this would freeze for seconds and produce a result too large to visualize usefully. | Offer single-source shortest path (one source → all reachable targets highlighted by distance), which provides 80% of the analytical value at O(N) cost. |
| **Custom community detection algorithm selection** — Louvain, Leiden, Girvan-Newman, Walktrap, InfoMap switchable by user | Power users know algorithm names and ask for their preferred one | Louvain is the industry standard for interactive graph tools (Gephi default, InfraNodus, NodeXL-Pro). The others require additional libraries with non-trivial bundle cost. Users asking for Leiden mean "better community detection" not literally "Leiden" — and Louvain with a tunable resolution parameter covers the use case. | Ship Louvain with an adjustable resolution slider (lower = more/smaller communities, higher = fewer/larger communities). Document the resolution parameter clearly. |
| **Real-time algorithm re-execution on node drag** — recompute PageRank/centrality every time a node is dragged to a new position | Seems responsive and dynamic | Graph algorithms compute on the topology (edges and connections), not on the visual positions. Dragging a node in the force layout does not change which connections exist — the algorithm result is unchanged. Re-running on every drag event would be 60fps algorithm execution with identical results. | Algorithms re-execute only when the card set changes (new import, filter change, or explicit "re-run" button). Position changes do not invalidate algorithm results. |
| **Export algorithm results as separate file** — download PageRank CSV, centrality JSON, community membership list | Users may want algorithm results outside Isometry | The sql.js write-back differentiator already covers the persistent use case. Separate file export adds format-specific code and maintenance burden for a narrow use case. | Write results back to `card_metrics` table (the differentiator), then let ExportOrchestrator export the full card+metrics dataset in any of the 3 existing export formats. Algorithm results ride along as additional fields. |

---

## Feature Dependencies

```
[GraphAlgorithmProvider (new)]
    └──required by──> [Algorithm selector panel]
    └──required by──> [Node visual encoding of results]
    └──required by──> [Community coloring]
    └──required by──> [Multi-algorithm overlay]
    └──required by──> [Algorithm Explorer panel]

[Worker graph:algorithm message handler (new)]
    └──required by──> [GraphAlgorithmProvider] (computes on worker thread)
    └──requires──> [Graphology graph construction from cards+connections SQL]

[Graphology graph construction from cards+connections SQL]
    └──required by──> [Worker graph:algorithm message handler]
    └──requires──> [db:exec in worker (already exists)]
    NOTE: NetworkView already fetches connections via db:exec — same SQL query
    can feed Graphology graph construction in the worker.

[Shortest path source/target picker]
    └──required by──> [Path highlight overlay]
    └──required by──> [Shortest path hop count badge]
    └──enhances──> [Algorithm Explorer panel] (source/target appear as sub-controls)

[Community Detection (Louvain)]
    └──required by──> [Community coloring]
    └──enhances──> [Multi-algorithm overlay] (community = color channel)

[Centrality metrics]
    └──enhances──> [Multi-algorithm overlay] (centrality = size channel)
    └──enhances──> [Algorithm results written back to sql.js]

[PageRank]
    └──enhances──> [Algorithm results written back to sql.js]
    └──enhances──> [PageRank / centrality as sort axis]

[Algorithm results written back to sql.js]
    └──required by──> [PageRank / centrality as sort axis in other views]
    NOTE: This is the HIGH complexity differentiator — build as Phase 2+

[Algorithm result reset / clear]
    └──requires──> [Node visual encoding of results] (must know what to reset to)

[Filtered-graph algorithm execution]
    └──requires──> [Worker graph:algorithm message handler]
    └──requires──> [existing FilterProvider card scoping (already exists)]
    NOTE: Filtered execution is free if graph construction uses the same card IDs
    that NetworkView.render() already receives — no new filtering infrastructure.
```

### Dependency Notes

- **Graphology graph construction is the key gating task:** All 6 algorithms need a `graphology.Graph` object built from the sql.js `connections` table. This construction belongs in the Worker. Once the graph object exists, each algorithm is a 2-10 line call to the graphology standard library.
- **GraphAlgorithmProvider is the single state owner:** It holds the active algorithm name, parameters (resolution, damping factor), and computed results. NetworkView reads from it to decide which visual encoding to apply. This mirrors the existing SelectionProvider / FilterProvider pattern.
- **sql.js write-back is a Phase 2 item:** It requires schema changes (`card_metrics` table) and SchemaProvider updates to expose new dynamic fields. It should be deferred to a second phase after core visual encoding is working.
- **Source/target picker conflicts with normal click-to-select:** When shortest path mode is active, the first click should set source (not select the card). This requires a mode guard in NetworkView's click handler that checks `GraphAlgorithmProvider.activeAlgorithm === 'shortest-path'`. The existing SelectionProvider click path is bypassed in algorithm mode.
- **Spanning tree requires edge weight concept:** Kruskal's MST needs edge weights. For Isometry's unweighted graph, treat all edges as weight=1 — producing an arbitrary spanning tree that shows one valid connected structure. This is sufficient for the "show backbone of the network" use case.

---

## MVP Definition

### Launch With (Phase 1 — algorithm visualizations working in NetworkView)

- [ ] Graphology graph construction in Worker from cards+connections SQL (prerequisite for all algorithms)
- [ ] GraphAlgorithmProvider with algorithm selector (none/shortest-path/centrality/community/spanning-tree/pagerank)
- [ ] Algorithm Explorer panel in WorkbenchShell (algorithm radio buttons + algorithm-specific sub-controls)
- [ ] Centrality computation (betweenness) with node size encoding
- [ ] Community detection (Louvain) with node color encoding by community
- [ ] PageRank with node size encoding
- [ ] Shortest path with source/target click picker + path highlight overlay
- [ ] Spanning tree MST overlay (highlighted MST edges, dimmed non-MST edges)
- [ ] Clustering coefficient displayed as hover tooltip score
- [ ] Algorithm result reset to return to default degree/source-color encoding

### Add After Validation (Phase 2 — algorithm results queryable in SQL)

- [ ] `card_metrics` table or `ui_state` write-back of algorithm scores
- [ ] SchemaProvider exposure of centrality/PageRank as dynamic fields
- [ ] Centrality/PageRank available as SuperGrid PAFV axes and sort dimensions
- [ ] Multi-algorithm overlay (community color + centrality size simultaneously)
- [ ] Louvain resolution slider + PageRank damping factor parameter controls

### Future Consideration (Phase 3+)

- [ ] Shortest path hop count badge on target node
- [ ] Single-source shortest path (source → all reachable, colored by distance)
- [ ] Filtered-graph algorithm execution with explicit "re-run on filter change" toggle
- [ ] Edge betweenness centrality (edge thickness encoding)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Graphology graph construction in Worker | HIGH — prerequisite for everything | LOW — 30-50 lines using existing db:exec | P1 |
| GraphAlgorithmProvider + algorithm selector | HIGH — the activation UI | LOW — mirrors SelectionProvider pattern | P1 |
| Community detection (Louvain) + color encoding | HIGH — most visually impactful result; immediately reveals structure | LOW — graphology-communities-louvain is 3 lines | P1 |
| PageRank + size encoding | HIGH — "most important cards" is a universally useful query | LOW — graphology-metrics pagerank is 3 lines | P1 |
| Centrality (betweenness) + size encoding | HIGH — reveals bridge nodes that aren't high-degree | LOW — graphology-metrics betweennessCentrality is 3 lines | P1 |
| Shortest path + source/target picker + path highlight | HIGH — "how are these two things connected?" is a primary user question | MEDIUM — picker mode change in click handler, path highlight via data attribute | P1 |
| Spanning tree MST overlay | MEDIUM — shows backbone structure; less universally understood than community/PageRank | MEDIUM — Kruskal's custom implementation ~50 lines, edge attribute approach | P1 |
| Clustering coefficient hover tooltip | MEDIUM — supporting metric; most useful as a drill-down detail | LOW — stored in result map, displayed in title/tooltip | P1 |
| Algorithm result reset | HIGH — without it the view gets stuck | LOW — rerender with original encoding | P1 |
| Algorithm Explorer panel (WorkbenchShell section) | HIGH — discoverability requires a named UI surface | LOW — follows CollapsibleSection pattern | P1 |
| Multi-algorithm overlay (community + centrality) | MEDIUM — power user feature; high visual impact | MEDIUM — two result maps, two independent visual channels | P2 |
| Louvain resolution + PageRank damping sliders | MEDIUM — parameter tuning separates power users from basic users | LOW — range inputs wired to provider | P2 |
| sql.js write-back of algorithm scores | HIGH — enables cross-view use of results | HIGH — schema change, SchemaProvider update, migration | P2 |
| PageRank / centrality as SuperGrid sort axis | HIGH — uniquely Isometry; cross-view analytics | HIGH — depends on write-back | P2 |
| Single-source shortest path | LOW — niche use case beyond single-pair path | MEDIUM — dijkstra.singleSource returns all paths | P3 |
| Edge betweenness encoding | LOW — edge-level insight is advanced | MEDIUM — edge attribute approach | P3 |

**Priority key:**
- P1: Must have for Phase 1 milestone completion
- P2: Phase 2 — add after core algorithms are working
- P3: Future consideration

---

## Competitor Feature Analysis

| Feature | Gephi | Cytoscape | InfraNodus | Isometry Approach |
|---------|-------|-----------|------------|-------------------|
| Algorithm selection UI | Statistics panel with Run buttons per algorithm | App Store plugins per algorithm type | Automatic on load, toggleable | Algorithm Explorer section in WorkbenchShell; algorithms are first-class not plugins |
| Community coloring | Partition module applies color after Modularity run | Node fill mapped from community attribute | Automatic color grouping | CSS token palette per community ID; theme-aware via CSS custom properties |
| Centrality node sizing | Ranking module maps betweenness to node size | Visual Mapper applet | Influence score mapped to node size | Replace degreeScale with resultScale when centrality is active |
| Shortest path | NetwokX plugin required; highlights in orange | Dijkstra via CytoPath app | Not available | Built-in; source/target via click picker; path highlighted with data attribute |
| Parameter controls | Modal dialogs per algorithm with form fields | Dialog per plugin | Not exposed | Inline in Algorithm Explorer panel; sliders update results live on blur |
| Result export | GEXF export includes node attributes | Export to CSV/JSON | Not available | Write back to sql.js card_metrics; then use existing ExportOrchestrator |
| Filter integration | None — always full graph | Optional on selection | None | Filtered card set from FilterProvider is the graph (Isometry-unique) |

---

## Algorithm Implementation Reference

Graphology provides all 5 non-spanning-tree algorithms as npm packages. All run synchronously in the Worker thread.

| Algorithm | Graphology Package | Key Function | Output Shape |
|-----------|-------------------|--------------|--------------|
| Shortest Path (Dijkstra) | `graphology-shortest-path` | `dijkstra.bidirectional(graph, source, target)` | `string[]` node ID path |
| Clustering Coefficient | `graphology-metrics` | `metrics.graph.density(graph)` / `metrics.node.clustering(graph, node)` | `number` per node |
| Betweenness Centrality | `graphology-metrics` | `metrics.centrality.betweenness(graph)` | `Record<string, number>` |
| Closeness Centrality | `graphology-metrics` | `metrics.centrality.closeness(graph)` | `Record<string, number>` |
| Eigenvector Centrality | `graphology-metrics` | `metrics.centrality.eigenvector(graph)` | `Record<string, number>` |
| Community Detection | `graphology-communities-louvain` | `louvain(graph, {resolution})` | `Record<string, number>` (communityId per node) |
| PageRank | `graphology-metrics` | `metrics.centrality.pagerank(graph, {dampingFactor})` | `Record<string, number>` |
| Spanning Tree | Custom Kruskal's ~50 lines | Iterates edges sorted by weight=1 with Union-Find | `Set<string>` edge IDs in MST |

**Confidence note:** Graphology packages verified against official documentation at graphology.github.io (HIGH confidence). Spanning tree confirmed not in Graphology standard library — custom Kruskal's required (HIGH confidence). All algorithms run synchronously in O(N log N) to O(N²) — appropriate for a Worker thread with typical knowledge graph sizes (<10K nodes).

---

## Sources

- [Graphology Standard Library](https://graphology.github.io/standard-library/) — algorithm package inventory (HIGH confidence — official docs, direct inspection)
- [Graphology Shortest Path](https://graphology.github.io/standard-library/shortest-path.html) — Dijkstra bidirectional, singleSource signatures (HIGH confidence — official docs)
- [Graphology Metrics](https://graphology.github.io/standard-library/metrics.html) — centrality, pagerank, clustering function signatures (HIGH confidence — official docs)
- [Gephi Network Analysis Guide](https://paldhous.github.io/NICAR/2016/gephi.html) — Modularity community coloring UX, Partition module pattern (MEDIUM confidence — WebSearch verified)
- [Cambridge Intelligence: Centrality Algorithms](https://cambridge-intelligence.com/keylines-faqs-social-network-analysis/) — table stakes for centrality display in graph tools (MEDIUM confidence — commercial graph tool documentation)
- [InfraNodus Network Visualization](https://infranodus.com/docs/network-visualization-software) — automatic community detection and influence scoring UX patterns (MEDIUM confidence — WebSearch, official product docs)
- [VisuAlgo MST](https://visualgo.net/en/mst) — MST overlay visual approach (MST edges colored, non-MST dimmed) (MEDIUM confidence — WebSearch)
- [Memgraph: 19 Graph Algorithms](https://memgraph.com/blog/graph-algorithms-list) — algorithm inventory and application patterns (MEDIUM confidence — WebSearch, reputable graph database vendor)
- Isometry `src/views/NetworkView.ts` — existing click handler, rendering, and Worker bridge patterns (HIGH confidence — direct code inspection)
- Isometry `.planning/PROJECT.md` — confirmed shipped infrastructure (cards/connections schema, WorkerBridge, WorkbenchShell panel pattern) (HIGH confidence — direct code inspection)

---

*Feature research for: Graph Algorithm Visualization (Isometry v9.0)*
*Researched: 2026-03-22*
