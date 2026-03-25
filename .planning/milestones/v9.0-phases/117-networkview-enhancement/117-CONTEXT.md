# Phase 117: NetworkView Enhancement - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Visually encode algorithm results in the existing NetworkView force graph: community color on nodes, centrality/PageRank sizing, shortest path edge highlighting, MST edge distinction, a floating legend panel, and a two-click source/target picker for shortest path. All 6 algorithm results from Phase 115 are already persisted in graph_metrics; this phase reads them and maps to D3 visual encodings. No new algorithms, no PAFV changes, no SuperGrid work.

</domain>

<decisions>
## Implementation Decisions

### Node Visual Encoding
- Auto-replace on compute: after `graph:compute` succeeds, nodes immediately switch from default encoding (degree->size, card_type->color) to algorithm encoding (metric->size, community->color). No extra toggle needed
- Full replacement style: entire circle changes fill and radius. No dual-circle/ring — clean, single circle per node
- Last-computed-wins for size metric: whatever algorithm was most recently run drives node radius (centrality, PageRank, or clustering coefficient). Running a new algorithm updates the size encoding
- Community color palette: d3.scaleOrdinal with D3 category10 (10 distinct colors). Communities beyond 10 recycle with modulo
- CTRL-04 Reset button restores default encoding: degree->size, card_type->color

### Edge Highlighting
- Shortest path edges: bright accent color (var(--accent) or distinct blue) + 3-4px stroke width. Non-path edges dim to 0.1 opacity. Source/target nodes get a ring highlight
- MST edges (when MST is the only edge algorithm): 2-3px stroke with accent color (green/teal). Non-MST edges: 1px, 0.1 opacity
- Composition priority: path edges override MST styling. MST edges not on the path show MST style. Non-MST non-path edges fully dimmed. Clear visual hierarchy: path > MST > default
- pathCardIds from graph:compute response used for path edge identification (compare edge source/target against adjacent pairs in pathCardIds array)

### Legend Panel
- Floating overlay, bottom-right of SVG canvas, semi-transparent background
- Auto-appears when algorithms are active, auto-hides on Reset
- Content: active algorithm name(s), community color swatches (community_0..N), size scale gradient (min->max for centrality/PageRank), path/MST stroke preview when applicable
- Does not consume sidebar real estate — overlaid on the graph

### Shortest Path Picker (NETV-05)
- Click-to-select on graph: when shortest path algorithm is selected in AlgorithmExplorer, enter pick mode
- First click sets source (green ring + 'S' badge), second click sets target (red ring + 'T' badge)
- Instruction text visible during pick mode: "Click source node" -> "Click target node" -> "Press Run"
- Keyboard-accessible dropdown fallback: two searchable dropdowns appear in AlgorithmExplorer when Shortest Path is selected
- Dropdowns synced with click-select — clicking a node updates the dropdown, selecting from dropdown highlights the node on graph
- Badges persist until Reset

### Claude's Discretion
- Exact CSS for floating legend (backdrop-filter, border-radius, padding)
- D3 transition durations for encoding switches
- How graph_metrics rows are fetched (single query or batched)
- Internal event/callback wiring between AlgorithmExplorer and NetworkView
- Search/filter implementation in source/target dropdowns
- Exact accent colors for path and MST edges

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — NETV-01 through NETV-05 (NetworkView Enhancement requirements), CTRL-03 (hover tooltip), CTRL-04 (Reset button)

### Prior Phase Context
- `.planning/phases/114-storage-foundation/114-CONTEXT.md` — graph_metrics DDL, render token mechanism, graphology integration decisions
- `.planning/phases/115-algorithm-engine/115-CONTEXT.md` — Algorithm response shape (pathCardIds, reachable, componentCount), disconnected graph behavior, sp_depth semantics
- `.planning/phases/116-schema-integration/116-CONTEXT.md` — AlgorithmExplorer architecture, SchemaProvider graph metric injection, FilterProvider scope for compute

### Existing Implementation
- `src/views/NetworkView.ts` — Current NetworkView (747 LOC): NodeDatum/EdgeDatum types, degree-based radius scale, card_type color scale, D3 enter/update/exit pattern, zoom/pan/drag
- `src/ui/AlgorithmExplorer.ts` — Sidebar panel with algorithm radio group, parameter controls, Run button
- `src/worker/handlers/graph-algorithms.handler.ts` — graph:compute handler returning summary + writing graph_metrics
- `src/database/queries/graph-metrics.ts` — readGraphMetrics/readAllGraphMetrics/writeGraphMetrics/clearGraphMetrics

### Research
- `.planning/research/ARCHITECTURE.md` — System architecture, Worker-side compute pattern
- `.planning/research/PITFALLS.md` — NaN/Infinity sanitization, disconnected graph handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NetworkView.ts` D3 data join pattern with `d => d.id` key function — extend NodeDatum/EdgeDatum with metric fields
- `d3.scaleSqrt()` already used for degree->radius — swap domain to centrality/PageRank range
- `d3.scaleOrdinal()` already used for card_type->color — swap to community_id->category10
- `AlgorithmExplorer` already wired to WorkerBridge with Run button — add source/target dropdowns and pick-mode signaling
- `SuperAuditOverlay` plugin pattern (CSS overlay layer) — similar floating panel approach for legend

### Established Patterns
- View receives data via `render(cards: CardDatum[])` — will need graph_metrics joined or fetched separately
- WorkerBridge `graph:compute` response includes `pathCardIds[]` — NetworkView can consume directly
- Hover dimming with opacity transitions already in NetworkView — extend for path/MST dimming
- CSS custom properties (`var(--text-primary)`, `var(--bg-card)`) — use for legend and overlay styling

### Integration Points
- AlgorithmExplorer -> NetworkView: need a callback/event to notify NetworkView that algorithm results are ready
- NetworkView.render() or new method to apply algorithm overlay after graph_metrics populated
- graph_metrics table read via WorkerBridge `graph:metrics-read` message (already exists from Phase 114)
- Reset button in AlgorithmExplorer needs to trigger NetworkView encoding restore

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following Gephi/Neo4j Bloom conventions for graph visualization encoding.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 117-networkview-enhancement*
*Context gathered: 2026-03-23*
