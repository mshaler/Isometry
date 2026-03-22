# Pitfalls Research

**Domain:** Graph Algorithms — Adding shortest path, clustering, centrality, community detection, spanning tree, and PageRank to Isometry's Worker+sql.js+D3 NetworkView stack
**Researched:** 2026-03-22
**Confidence:** HIGH (derived from Isometry codebase source analysis + algorithm complexity literature + graphology library docs + verified via web search)

---

## Critical Pitfalls

### Pitfall 1: Stale Algorithm Results Painted Over a Newer Render

**What goes wrong:**
The Worker sends a `graph:simulate` result for render-call N, and before it arrives the user changes a filter or view, triggering render-call N+1. When the N result arrives it is applied to the SVG that already shows N+1 data — node positions or algorithm overlays from an older graph snapshot visually corrupt the current view. This is distinct from the force-simulation race already handled by the existing `positionMap` warm-start pattern; algorithm results (PageRank scores, community IDs, centrality values) are keyed to a specific graph snapshot and are silently wrong when applied to a different snapshot.

**Why it happens:**
`WorkerBridge.send()` returns a Promise. Two concurrent in-flight Promises to the same handler (e.g., two `graph:algorithm` requests) both resolve and both call the render-update callback. There is no cancellation mechanism for in-flight Worker requests. The bridge uses correlation IDs for routing but not for result-is-still-relevant gating.

**How to avoid:**
Track a `currentRenderToken` (monotonically incrementing integer) on NetworkView. Stamp each algorithm request with the token value at time of issue. In the response handler, discard the result if `response.token !== this.currentRenderToken`. Never apply algorithm results without first checking token freshness. This is the same pattern used by `ViewManager._fetchAndRender()` timer cancellation (v4.2 fix) — adapt it for async Worker responses.

**Warning signs:**
- Algorithm overlay colors "jump" briefly to wrong values then correct themselves on the next filter change
- Community-detection colors persist on nodes that are no longer in the filtered card set
- PageRank circles resize after the user has already navigated to a different view

**Phase to address:**
Algorithm Worker integration phase — define the render-token pattern in the protocol before any algorithm handlers are wired.

---

### Pitfall 2: Betweenness Centrality O(n*m) Timeout at 10K+ Nodes

**What goes wrong:**
Brandes' exact betweenness centrality algorithm runs in O(n * m) time — at 10,000 nodes and 50,000 edges that is 500 million operations, requiring 30-120 seconds in a single-threaded JS Worker. The Worker does not time out (no internal watchdog), but the main thread's `bridge.send()` timeout fires (currently 10 seconds in WorkerBridge), leaving the algorithm running orphaned in the Worker while the UI shows an error. The next request to the Worker then queues behind the still-running algorithm, stalling all DB operations.

**Why it happens:**
Developers prototype betweenness centrality on small test graphs (100-500 nodes) where it completes in milliseconds. They do not test at the scale Isometry users actually hit (1,000-10,000 imported cards from Apple Notes). The theoretical O(n*m) cost is easy to forget when the unit test passes instantly.

**How to avoid:**
Implement sampling-based approximate betweenness (Brandes with k-pivot sampling). Use k=√n pivots — at 10K nodes k≈100, reducing runtime to O(k * m) ≈ 5M operations. Surface the approximation clearly in the UI ("approximate, ±5% at 10K nodes"). Add a hard node-count guard: if `nodes.length > 2000`, auto-switch to approximate mode. Gate all centrality algorithm tests with a benchmark at n=5000 — fail if runtime exceeds 2 seconds.

**Warning signs:**
- Algorithm unit tests only use fixture graphs with fewer than 200 nodes
- No performance benchmark exists for the algorithm at n=5000
- Worker bridge timeout fires during centrality computation on a developer's real imported data

**Phase to address:**
Algorithm implementation phase — choose sampling-vs-exact strategy before writing any centrality code, not after hitting timeout in testing.

---

### Pitfall 3: Disconnected Graph Propagates NaN/Infinity Into SVG Attributes

**What goes wrong:**
All six algorithms have undefined or degenerate outputs for disconnected graphs:
- **Shortest path**: returns `null` or `Infinity` for unreachable node pairs — if used as an edge weight for D3 color scale, `d3.scaleSequential([0, Infinity])` maps everything to the same color
- **Clustering coefficient**: undefined (division by zero) for nodes with degree 0 or 1 — naive implementations return `NaN`, which becomes `"NaN"` in SVG `fill` and `r` attributes, visually breaking the affected nodes
- **PageRank**: converges correctly with teleportation for most disconnected structures, but dangling nodes (no outgoing edges) cause rank to drain to zero without teleportation, making an entire connected component invisible in the ranking
- **Community detection (Louvain)**: isolated nodes with no edges are assigned to singleton communities by default — this produces `n` communities for `n` isolated nodes, overwhelming the color scale with distinct community IDs
- **Spanning tree**: Prim/Kruskal silently produce a forest (multiple trees) for disconnected graphs — if the UI expects exactly n-1 edges for n nodes, the count assertion fails silently, and edges from unreachable components are simply absent
- **Betweenness centrality**: nodes in isolated components score exactly 0 — correct but visually indistinguishable from nodes that are genuinely non-central in a connected region

**Why it happens:**
Isometry's cards come from 11 import sources. Most real-world import sessions produce partially connected or completely disconnected graphs (e.g., 500 Apple Notes with no connections, 50 Reminders, 20 Calendar events, and 30 connections between a subset of notes). The graph is disconnected by design. Algorithm implementations borrowed from examples always assume connected graphs.

**How to avoid:**
Before running any algorithm, compute connected components (BFS/DFS in O(n+m)) and branch:
1. For shortest path: return a sentinel `{reachable: false}` for pairs in different components; never pass `Infinity` to a D3 scale.
2. For clustering coefficient: return 0 for degree-0 nodes, 0 for degree-1 nodes; never divide when `degree < 2`.
3. For PageRank: always use the teleportation term (damping factor 0.85); treat dangling nodes as having a uniform outgoing edge to all nodes.
4. For community detection: pre-filter isolated nodes, assign them to a dedicated `singleton` community ID, merge them back after Louvain completes.
5. For spanning tree: explicitly compute minimum spanning *forest*, not just minimum spanning tree; report component count in the result.
6. For centrality: normalize scores to [0, 1] range clipped to the computed min/max to absorb zero-valued isolated nodes.

All algorithm results must pass through a `sanitizeAlgorithmResult()` guard that rejects NaN, Infinity, and null before they reach D3 attribute assignment.

**Warning signs:**
- `SVGCircleElement` with `r="NaN"` in the DOM
- Algorithm overlay renders correctly on test fixtures but breaks on real imports
- Console shows `d3.scaleSequential` receiving Infinity domain
- Color scale shows all nodes in the same hue after running an algorithm on a sparsely connected graph

**Phase to address:**
Algorithm implementation phase — write `sanitizeAlgorithmResult()` and connected-component pre-check BEFORE writing algorithm-specific code. Make it a mandatory utility that all six algorithms must use.

---

### Pitfall 4: Directed vs. Undirected Mismatch Silently Produces Wrong Results

**What goes wrong:**
Isometry's connections table stores directional edges (`source_id`, `target_id`) but NetworkView renders them as undirected lines (no arrowhead, degree = in-degree + out-degree). When graph algorithms receive these edges:
- **Shortest path** on a directed graph may find no path from A→B even when B→A exists
- **Spanning tree** (Kruskal/Prim) is undefined for directed graphs — these algorithms require undirected edge weights; running them on directed edges produces wrong or non-spanning results. For directed graphs, the correct algorithm is Chu-Liu/Edmonds (minimum spanning arborescence) which is O(E log V)
- **PageRank** is specifically designed for directed graphs and is wrong when edges are treated as undirected (the directionality is the entire semantic of the algorithm)
- **Community detection (Louvain)** requires explicit directed-mode toggle — using undirected mode on directed data conflates in-edges and out-edges into symmetric modularity
- **Clustering coefficient** has two variants: undirected (triangles) and directed (considering in/out edge directions) — mixing them produces coefficients outside [0,1] range on some directed graph topologies

**Why it happens:**
The Worker's `graph:simulate` handler already treats connections symmetrically (it copies links without direction). Developers building new algorithm handlers copy this pattern without questioning whether the algorithm requires directed edges.

**How to avoid:**
Add a `directed: boolean` parameter to the algorithm Worker message payload. Derive this from an explicit user-facing "Treat connections as directed/undirected" toggle in the NetworkView toolbar. In the Worker handler: if `directed=false`, symmetrize the adjacency list before running any algorithm. If `directed=true`, pass edge directions as-is but guard MST with "directed graph detected: using arborescence algorithm." Document in the protocol.ts comment which algorithms are direction-sensitive. Never let an algorithm handler silently ignore the direction flag.

**Warning signs:**
- Shortest path returns "no path" between nodes the user can see are visually connected in the graph
- MST includes exactly n-1 edges for a directed graph even when the graph has no valid spanning arborescence
- PageRank scores are equal for all nodes in a symmetric bidirectional graph (correct behavior but looks wrong)
- Clustering coefficient returns values > 1.0 for some nodes

**Phase to address:**
Algorithm protocol design phase — add `directed` flag to the message type in protocol.ts before any algorithm is implemented.

---

### Pitfall 5: Algorithm Computation Blocks All DB Operations in the Worker

**What goes wrong:**
The Worker is the single-threaded WASM runtime for sql.js AND the computation host for all graph algorithms. A long-running algorithm (betweenness centrality on 5K nodes, Louvain on a dense graph) blocks the Worker's event loop. During this time, every `db:exec`, `db:query`, `supergrid:query`, and `ui:get` message queues behind the algorithm. The user can see the NetworkView "thinking" but cannot switch views, apply filters, or type in the search bar — the entire app freezes.

**Why it happens:**
The Worker router is synchronous: it `await`s each handler and sends a response before processing the next message. Long-running pure-computation tasks (graph algorithms) are synchronous CPU operations, not async I/O, so `await` does not yield. The existing `graph:simulate` handler already has this structure but runs in ~50ms for typical graphs, making the blocking invisible.

**How to avoid:**
Two complementary strategies:
1. **Chunk heavy algorithms**: Split algorithm computation across multiple Worker turns using `setTimeout(0, nextChunk)`. For Louvain, each "pass" of the modularity optimization is one chunk. For betweenness centrality sampling, each pivot is one chunk. Send progress notifications (`graph:algorithm:progress`) between chunks using the existing `WorkerNotification` pattern.
2. **Budget algorithm execution**: Set a hard time budget (500ms) per computation turn. If the algorithm has not converged within the budget, emit a partial result and continue in the next turn. Never block the Worker for more than 500ms.

Do NOT spawn a nested Worker inside the Worker — nested Workers are not supported in WKWebView's WKContentWorld.

**Warning signs:**
- FTS search stops responding while NetworkView is loading
- `supergrid:query` requests queue and arrive as a burst after algorithm completes
- WorkerBridge logs show correlation ID backlog > 3 during algorithm execution
- Switching views while NetworkView is computing results in a 3-5 second stall

**Phase to address:**
Algorithm Worker integration phase — implement chunked execution and time-budget gating before wiring any algorithm handler to the Worker router.

---

### Pitfall 6: sql.js Adjacency List Reconstruction Overhead on Every Algorithm Call

**What goes wrong:**
Every algorithm call reconstructs the full adjacency list from scratch by querying `SELECT source_id, target_id FROM connections WHERE source_id IN (?) OR target_id IN (?)`. For 10K nodes and 50K connections, this produces a 100K-row result that is serialized through the Worker's structured-clone boundary, deserialized in the algorithm handler, and then converted into whatever in-memory graph structure the algorithm needs (adjacency matrix, neighbor list, etc.). At 10K nodes this reconstruction costs 100-300ms on every render — before the algorithm even starts.

**Why it happens:**
The existing NetworkView.render() already fetches connections with `bridge.send('db:exec', {...})` on every render. Adding algorithm computation on top of this without caching means the connection fetch runs twice per render (once for simulation, once for algorithm). The `positionMap` warm-start pattern caches positions but there is no equivalent cache for the graph topology.

**How to avoid:**
Cache the adjacency structure in the Worker, keyed by a `graphVersion` token. The token increments only when cards or connections are mutated (via the existing `MutationManager` notification path). The algorithm handler checks `if (payload.graphVersion === this._cachedVersion)` — if the version matches, skip the sql.js query and use the cached adjacency list. On token mismatch, rebuild and cache. This reduces per-render overhead from O(m) sql.js round-trip to O(1) cache hit for repeated algorithm invocations on an unchanged graph.

**Warning signs:**
- Algorithm appears slow even after the optimization phase
- Chrome Performance panel shows repeated identical `db:exec` calls within a single render cycle
- Connection fetch time dominates algorithm time in profiling traces
- Switching between algorithm types on the same graph is slow (each switch triggers a full reconnect)

**Phase to address:**
Algorithm Worker integration phase — design the `graphVersion` cache key protocol before implementing any algorithm, so all algorithms benefit from it automatically.

---

### Pitfall 7: WASM Heap Exhaustion on Adjacency Matrix Representation

**What goes wrong:**
Some algorithm implementations use an n×n adjacency matrix for O(1) edge lookup. At 10K nodes, an adjacency matrix requires 10,000 × 10,000 = 100M entries. Even as a boolean array (1 byte each), that is 100MB — exceeding the default sql.js WASM heap limit (32-64MB in most browser contexts). The WASM module throws a `RuntimeError: memory access out of bounds` or silently allocates into undefined memory, producing corrupted algorithm output.

**Why it happens:**
Adjacency matrix is the textbook representation taught in CS courses. Developers implementing shortest path or centrality algorithms copy the matrix approach from tutorials without checking memory cost at Isometry's actual graph scale.

**How to avoid:**
Exclusively use adjacency list (Map<string, string[]>) representation in all algorithm handlers. Never allocate an n×n structure. The sparse nature of Isometry's graphs (user data rarely exceeds average degree 5-10) means adjacency lists are also algorithmically preferable. Add a `_validateGraphScale(nodes, edges)` guard at the top of every algorithm handler that throws a descriptive error if `nodes.length * nodes.length > 10_000_000` (equivalent to a 3162×3162 matrix) — this prevents accidental matrix allocation.

**Warning signs:**
- `RuntimeError: memory access out of bounds` from WASM during algorithm computation
- Algorithm produces wrong results for graphs > 1000 nodes but correct results for smaller graphs
- Worker crashes silently (postMessage never fires after algorithm starts) on large graphs

**Phase to address:**
Algorithm implementation phase — add `_validateGraphScale()` as the first thing defined in each algorithm handler file.

---

### Pitfall 8: Community Color Scale Collision With Existing Source-Provenance Colors

**What goes wrong:**
NetworkView uses CSS custom properties (`--source-apple-notes`, `--source-markdown`, etc.) as its color scale for node fill, representing import source provenance. When community detection overlays community assignment, it needs a different color encoding — but both overlays use `circle.attr('fill', ...)`. If community detection simply reassigns the `fill` attribute, the source-provenance colors are destroyed and cannot be restored when the user toggles community detection off. There is no "stash and restore" mechanism for SVG attribute state.

**Why it happens:**
The existing `_applyHoverDim` / `_clearHoverDim` pattern modifies `opacity` directly, not `fill`, and restores to a known constant (`DEFAULT_NODE_OPACITY`). Algorithm overlays that reassign `fill` do not have an equivalent constant to restore to — the original fill is source-color which varies per node and must be looked up again.

**How to avoid:**
Never modify the base `fill` attribute for algorithm overlays. Instead, add a second SVG element per node — a `circle.algorithm-overlay` with `fill-opacity: 0` by default, positioned identically to the base circle. Algorithm overlays set `fill` and `fill-opacity` on the overlay circle only. Toggling off simply sets `fill-opacity: 0` on the overlay circle. The base node circle retains its source-color fill at all times. This matches the existing `data-audit` attribute pattern (Phase 37) which uses CSS attribute selectors for overlays without touching base styles.

**Warning signs:**
- Source provenance colors disappear when toggling community detection on
- Node colors do not restore when algorithm overlay is turned off
- `circle.attr('fill', ...)` appears in algorithm code — any direct fill assignment to the base circle is the anti-pattern

**Phase to address:**
NetworkView integration phase — define the dual-circle overlay architecture in NetworkView before writing any algorithm color-mapping code.

---

### Pitfall 9: PageRank Scores Normalize Differently for Directed vs. Undirected, Causing Visual Discontinuity

**What goes wrong:**
PageRank on a directed graph distributes rank based on in-degree only (following incoming link semantics). On an undirected graph treated as directed (symmetric edges), every node has equal in-degree and PageRank converges to the uniform distribution (1/n for all nodes). This looks like the algorithm "didn't work" — all nodes display at the same size/color. If the user added the connections using Isometry's UI (which creates directed edges), PageRank is actually correct — but they see nothing visually interesting.

**Why it happens:**
PageRank was designed for the web's asymmetric link structure. Isometry connections are often created symmetrically (note A links to note B, note B links back to note A). When all edges are bidirectional, PageRank loses discriminating power entirely.

**How to avoid:**
Offer two modes explicitly labeled in the UI: "PageRank (follow link direction)" and "Influence score (undirected degree centrality)". For undirected graphs or graphs with mostly symmetric edges, route to a normalized degree centrality instead of PageRank. Add a convergence check: if the top-10 PageRank scores are within 5% of each other (indicating flat distribution), display a UI warning "Graph is too symmetric for PageRank — showing degree centrality instead" and switch algorithms automatically. Document this fallback in the algorithm panel.

**Warning signs:**
- All nodes display at the same size after running PageRank
- Standard deviation of PageRank scores is < 0.001
- Users report "PageRank doesn't seem to be doing anything"

**Phase to address:**
Algorithm UX design phase — design the mode-switching and flat-distribution fallback before implementing the PageRank Worker handler.

---

### Pitfall 10: Louvain Community Detection Non-Determinism Causes Flaky Algorithm Tests

**What goes wrong:**
The Louvain algorithm uses random node traversal order in its first phase. Two runs on the same graph with the same parameters produce different community assignments (different community IDs, possibly different community boundaries). Algorithm tests that assert specific community IDs (e.g., `expect(result.get('card-123')).toBe(2)`) fail randomly — passing 70% of the time and failing 30% of the time.

**Why it happens:**
Louvain is a greedy heuristic with random tie-breaking. `graphology-communities-louvain` exposes an optional `randomWalk` parameter and a `rng` seed parameter for reproducibility — but developers unfamiliar with the library skip these when writing tests.

**How to avoid:**
All algorithm tests that use Louvain must pass a seeded RNG: `{ rng: () => 0.5 }` or use a fixed numeric seed. Assert community structure invariants rather than specific IDs: assert that connected nodes have higher probability of sharing a community than random pairs, assert that modularity score exceeds a threshold, assert that no community is empty. Never assert `communityId === N` — assert `communityMap.get(node) === communityMap.get(neighborNode)` for known-connected nodes.

**Warning signs:**
- Community detection test passes on the first run but fails on rerun without code changes
- CI shows intermittent community test failures with no log differences
- Test asserts specific integer community IDs rather than community membership relationships

**Phase to address:**
Algorithm test design phase — define "assert community structure, not community IDs" as a testing rule before writing any Louvain tests.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synchronous algorithm execution (no chunking) | Simpler code | Worker blocks for 10-120s on large graphs; app freezes | Only for graphs guaranteed < 500 nodes |
| Exact betweenness centrality (no sampling) | Precise scores | O(n*m) timeout at 5K+ nodes; Worker bridge timeout fires | Never for user-facing graphs of unknown size |
| Adjacency matrix representation | O(1) edge lookup | 100MB+ WASM heap at 10K nodes; RuntimeError | Never — adjacency list is always appropriate for sparse graphs |
| Reassigning SVG fill for overlays | Simple one-liner | Source-provenance colors permanently destroyed on overlay toggle | Never |
| Omitting render token for algorithm results | Simpler plumbing | Stale results corrupt current view on fast filter changes | Never |
| Asserting specific community IDs in tests | Fast to write | 30-70% flaky failure rate from Louvain non-determinism | Never |
| Computing algorithm on every render() call | Always up to date | Redundant recomputation for unchanged graphs; dominates render cost | Only when caching is not yet implemented (Phase 1 prototype) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Worker + graph algorithms | Algorithm handler blocks entire Worker event loop | Chunk computation with 500ms time budget; emit progress notifications |
| sql.js + adjacency reconstruction | Re-fetching connections on every algorithm call | Cache adjacency list keyed by `graphVersion` token from MutationManager |
| D3 NetworkView + algorithm overlay | Setting `circle.attr('fill', ...)` for algorithm colors | Dual-circle pattern: base circle retains source color; `.algorithm-overlay` circle carries algorithm color |
| WorkerBridge + algorithm results | Applying result to a newer graph snapshot | Render-token guard: discard result if `response.token !== currentRenderToken` |
| Louvain + test assertions | Asserting specific community IDs | Seed RNG; assert community membership invariants, not integer IDs |
| MST + directed graphs | Running Prim/Kruskal on directed connections | Detect directed graph; use Chu-Liu/Edmonds arborescence or symmetrize edges first |
| PageRank + symmetric graphs | Running PageRank on bidirectional graphs | Auto-detect flat distribution; fall back to degree centrality with UI warning |
| Clustering coefficient + low-degree nodes | Dividing by `degree * (degree-1)` when degree < 2 | Return 0 for degree-0 and degree-1 nodes; never divide |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Exact betweenness centrality | Worker bridge timeout (>10s) | Sampling (k=√n pivots) for n>2000 | n > 2,000 nodes |
| Full adjacency reconstruction per render | 100-300ms overhead before algorithm starts | `graphVersion` cache; only rebuild on mutation | Any graph with >5K connections |
| Synchronous Louvain on dense graph | Worker unresponsive for 5-30s | Chunk each Louvain pass into separate turns | Graphs with >5,000 edges |
| Adjacency matrix allocation | `RuntimeError: memory access out of bounds` | Adjacency list only; `_validateGraphScale()` guard | n > ~3,000 nodes (depends on WASM heap) |
| Algorithm runs on every filter change | Continuous recomputation when user scrubs histogram | Debounce algorithm trigger (500ms) after filter stabilizes | Any real-time filter interaction |
| Rendering 10K node SVG with per-node algorithm attributes | SVG paint cost 200-500ms | Limit NetworkView to 2,500 nodes max; show "Reduce filters to see graph" for larger sets | NetworkView > 2,500 nodes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Running algorithm without feedback | User thinks app is frozen during 5-10s computation | Progress bar via `WorkerNotification` protocol; show "Computing..." badge on NetworkView |
| Flat PageRank distribution shown without explanation | User thinks feature is broken | Auto-detect flat distribution; show contextual tooltip "Graph connections are symmetric — showing degree centrality" |
| Community colors reset on every filter change | User loses mental model of communities when scrubbing histogram | Preserve community assignment until user explicitly re-runs; show "Outdated" badge on stale overlay |
| Disconnected graph silently drops edges from spanning tree | User expects spanning tree to cover all nodes | Explicitly label result as "Spanning Forest (N components)" when graph is disconnected |
| Algorithm overlay covers source-provenance color information | User loses ability to see where cards came from | Dual-circle overlay preserving base fill; toggle control to switch between source and algorithm color mode |
| No indicator that algorithm result is stale | User makes decisions based on outdated centrality scores after importing more cards | Show "Stale — recompute" badge on algorithm overlay panel whenever `graphVersion` changes since last computation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Disconnected graph handling:** Algorithm tested only on a fully-connected fixture — verify all six algorithms handle a graph with 3+ disconnected components and at least 5 isolated (degree-0) nodes
- [ ] **Directed/undirected toggle:** Algorithm tested without the `directed` flag — verify Worker handler reads `payload.directed` and routes to the correct algorithm variant
- [ ] **NaN/Infinity guard:** Algorithm result contains nodes with degree < 2 — verify `sanitizeAlgorithmResult()` is called before any D3 attribute assignment; no `NaN` or `Infinity` in SVG attributes
- [ ] **Render token freshness:** Algorithm tested with a single render call — verify that concurrent renders (filter change during algorithm execution) discard the stale result via token mismatch
- [ ] **Louvain non-determinism:** Community test asserts specific community IDs — verify all community tests use seeded RNG and assert membership invariants, not integer IDs
- [ ] **Worker blocking:** Algorithm unit test completes instantly on a 100-node fixture — verify algorithm is benchmarked at n=5000 and completes within 2 seconds (sampling mode) or is chunked
- [ ] **Overlay stacking:** Community color overlay tested in isolation — verify base `fill` (source-provenance color) is preserved when algorithm overlay is toggled off
- [ ] **MST on directed graph:** Spanning tree tested only on undirected fixture — verify directed-graph case is handled (Chu-Liu/Edmonds or explicit symmetrization)
- [ ] **PageRank symmetric fallback:** PageRank tested only on asymmetric fixture — verify flat-distribution detection and degree-centrality fallback work on a fully symmetric bidirectional graph
- [ ] **Adjacency cache invalidation:** Cache tested only with static graph — verify `graphVersion` increments correctly when cards are added, deleted, or connections are added/removed via MutationManager

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale algorithm results corrupting view | LOW | Add render-token guard to all algorithm response handlers; discard responses where token mismatches |
| Worker blocked by betweenness centrality | MEDIUM | Cancel by reloading Worker (costly — reinitializes WASM); add sampling and chunking to prevent recurrence |
| NaN in SVG attributes from disconnected graph | LOW | Add `sanitizeAlgorithmResult()` utility; scan all algorithm handlers and pipe through it |
| Source-provenance colors destroyed by fill override | MEDIUM | Refactor to dual-circle overlay pattern; audit all algorithm `attr('fill', ...)` calls |
| Louvain flaky tests | LOW | Add `rng` seed to all Louvain test calls; change assertions from ID equality to membership invariants |
| WASM heap exhaustion from adjacency matrix | MEDIUM | Replace matrix with adjacency list in affected handler; add `_validateGraphScale()` guard |
| PageRank flat distribution misleading users | LOW | Add flat-distribution detection and degree-centrality fallback; add contextual UI label |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stale algorithm results (render token) | Algorithm Worker integration — define token protocol in protocol.ts | Concurrent render test: send two algorithm requests, verify only second result applied |
| Betweenness centrality O(n*m) timeout | Algorithm implementation — choose sampling mode at design time | Benchmark at n=5000: runtime < 2 seconds for sampling mode |
| Disconnected graph NaN/Infinity | Algorithm implementation — write `sanitizeAlgorithmResult()` first | Unit test: graph with 5 isolated nodes produces no NaN in any algorithm output |
| Directed/undirected mismatch | Algorithm protocol design — add `directed` flag to message type | Each algorithm handler has a directed=true and directed=false unit test |
| Worker blocking all DB operations | Algorithm Worker integration — implement chunked execution | DB query latency during algorithm execution < 50ms (no queuing) |
| Adjacency reconstruction overhead | Algorithm Worker integration — design `graphVersion` cache | Connection fetch should not appear in profiling trace for repeated same-graph algorithm calls |
| WASM heap exhaustion (adjacency matrix) | Algorithm implementation — add `_validateGraphScale()` first line in every handler | Test at n=10000: no WASM RuntimeError |
| Community color vs. source-provenance collision | NetworkView integration — define dual-circle overlay architecture | Toggle community detection on/off: base source colors unchanged |
| PageRank flat distribution | Algorithm UX design — design fallback before implementing handler | Symmetric-graph fixture: PageRank shows "degree centrality" label, not uniform distribution |
| Louvain non-determinism in tests | Algorithm test design — define seeded-RNG + membership-invariant rule | Zero flaky runs across 20 consecutive CI executions of community detection tests |

---

## Sources

- `src/views/NetworkView.ts`: Existing D3 data join patterns, positionMap warm-start, `_applyHoverDim` overlay precedent, `data-audit` attribute pattern (Phase 37 overlay approach)
- `src/worker/handlers/simulate.handler.ts`: Worker graph computation pattern — synchronous stop/tick loop, no per-tick messages
- `src/worker/protocol.ts`: WorkerBridge message types, correlation ID design, WorkerNotification protocol
- `src/worker/worker.ts`: Worker router architecture — synchronous handler dispatch, message queuing before init
- `.planning/PROJECT.md`: v4.1 `ViewManager._fetchAndRender()` timer-cancellation race fix — precedent for stale-result token pattern
- Neo4j Graph Data Science — Betweenness Centrality: [https://neo4j.com/docs/graph-data-science/current/algorithms/betweenness-centrality/](https://neo4j.com/docs/graph-data-science/current/algorithms/betweenness-centrality/)
- Brandes 2001, "A Faster Algorithm for Betweenness Centrality": O(n*m) time complexity, O(n+m) space complexity confirmation
- Graphology communities-louvain docs: [https://graphology.github.io/standard-library/communities-louvain.html](https://graphology.github.io/standard-library/communities-louvain.html) — mixed graph limitation, directed modularity variant, seeded RNG option
- Graphology shortest-path docs: [https://graphology.github.io/standard-library/shortest-path.html](https://graphology.github.io/standard-library/shortest-path.html) — `null` return for unreachable nodes
- GeeksforGeeks — Why Prim's and Kruskal's MST fail for directed graphs: [https://www.geeksforgeeks.org/dsa/why-prims-and-kruskals-mst-algorithm-fails-for-directed-graph/](https://www.geeksforgeeks.org/dsa/why-prims-and-kruskals-mst-algorithm-fails-for-directed-graph/) — Chu-Liu/Edmonds alternative
- Langville & Meyer, "Deeper Inside PageRank": dangling node rank drain, teleportation guarantees convergence, 50-100 iterations to convergence
- Clustering coefficient Wikipedia — isolated node NaN/undefined behavior: [https://en.wikipedia.org/wiki/Clustering_coefficient](https://en.wikipedia.org/wiki/Clustering_coefficient)
- WebAssembly Limitations (qouteall.fun, 2025): WASM linear memory cannot shrink; freed memory not returned to OS — WASM heap exhaustion is permanent within a session
- Louvain method Wikipedia — internally disconnected communities defect, resolution limit: [https://en.wikipedia.org/wiki/Louvain_method](https://en.wikipedia.org/wiki/Louvain_method)

---
*Pitfalls research for: Graph Algorithms — Isometry NetworkView + Worker + sql.js integration*
*Researched: 2026-03-22*
