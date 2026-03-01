# Phase 7: Graph Views + SuperGrid - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can explore connection data through Network and Tree graph views (with off-main-thread force simulation) and project any dataset through SuperGrid's nested dimensional headers. The force simulation runs in the Worker and posts only stable position snapshots. SuperGrid renders nested PAFV-projected headers with visual spanning — the signature PAFV differentiator.

**Out of scope:** SuperDynamic (drag-and-drop axis repositioning), SuperDensity controls, GraphExplorer algorithm panel (PageRank/Louvain/Dijkstra UI), real-time streaming graph updates.

</domain>

<decisions>
## Implementation Decisions

### Graph View Rendering
- Circles with labels for NetworkView nodes — circle sized by degree, card name as text label
- Straight lines between node centers for edges — edge type distinguished via color or dash pattern
- Full zoom + pan via d3-zoom with SVG transforms
- Top-down vertical layout for TreeView using d3-hierarchy tree() — root at top, children below
- TreeView nodes expand/collapse without full re-render (success criteria #2)

### Force Simulation Strategy
- Final snapshot only — Worker runs simulation to convergence, posts one `{id, x, y}[]` array to main thread
- No per-tick updates cross the postMessage boundary (matches success criteria: "never per-tick updates")
- Warm start on data updates — keep previous positions for persisted nodes, place new nodes near neighbors
- No graph algorithms beyond basic force layout in v1.0 — no PageRank, no community detection, no Dijkstra
- Click node selects (via SelectionProvider) AND highlights directly connected neighbors, dims non-neighbors

### SuperGrid Header Spanning
- 2-level nesting in v1.0 (e.g., folder → status, or quarter → month)
- Headers are collapsible — click parent to collapse/expand children with morphing boundary animation
- Stacked axes on BOTH row and column dimensions — full SuperGrid signature behavior
- Axis state management approach is Claude's discretion (extend PAFVProvider vs SuperGrid-local state)

### SuperGrid Cell Rendering
- Cell content style is Claude's discretion (count badges, mini cards, or heatmap — optimize for <16ms budget)
- Empty cells are rendered with subtle border/background — preserve grid dimensional structure, never collapse empty rows/columns
- Render technology is Claude's discretion (HTML CSS Grid vs SVG — spanning algorithm needs drive this)
- Cardinality limit approach is Claude's discretion (hard limit vs soft with virtualization — must prevent DOM explosion per pitfall P18)

### Claude's Discretion
- Node circle sizing scale and label positioning
- Edge color/dash mapping per connection type (Link, Nest, Sequence, Affinity)
- Force simulation parameters (charge strength, link distance, convergence threshold)
- Whether to extend PAFVProvider with stacked axis arrays or use SuperGrid-local state
- SuperGrid cell content format (count badge vs mini cards vs heatmap)
- SuperGrid render technology (CSS Grid vs SVG)
- Cardinality explosion mitigation strategy (hard limit vs virtualization)
- Loading skeleton design for graph simulation wait time
- Error state handling for force simulation failures
- Exact spacing, typography, and color palette for both views

</decisions>

<specifics>
## Specific Ideas

- Force simulation must match success criteria exactly: "main thread receives only stable `{id, x, y}` positions after the simulation converges, never per-tick updates"
- SuperGrid is the "signature PAFV differentiator" — the z-axis stacked headers create dimensional depth that no existing tool handles well
- TreeView uses d3-hierarchy with Nest connections (parent-child containment) as the hierarchy source
- NetworkView uses all four GRAPH edge types (Link, Nest, Sequence, Affinity) with visual distinction
- Empty cells must always render to preserve dimensional integrity — "where did Q3 go?" must never happen

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IView` interface (mount/render/destroy): Both NetworkView and TreeView must implement this contract
- `ViewConfig` (container, coordinator, queryBuilder, bridge): Dependency injection pattern for new views
- `ViewManager`: Already handles LATCH↔GRAPH crossfade transitions and coordinator subscription
- `PAFVProvider`: Already classifies 'network'/'tree' as 'graph' family with suspension/restoration
- `CardDatum` + `toCardDatum()`: Row mapping helper for Worker response data
- `CardRenderer`: Existing card rendering for LATCH views — may inform SuperGrid cell design
- `transitions.ts`: shouldUseMorph() + crossfadeTransition() already implemented
- `SelectionProvider`: Click-to-select pattern ready for graph node interaction
- Worker handlers: `graph.handler.ts` already handles `graph:connected` and `graph:shortestPath`

### Established Patterns
- D3 key function `d => d.id` mandatory on every .data() call (VIEW-09)
- Subscriber notifications batched via queueMicrotask
- Worker protocol: typed request/response envelopes with UUID correlation IDs
- View family suspension: PAFVProvider deep-copies state via structuredClone on LATCH↔GRAPH boundary
- Loading spinner after 200ms delay, error banner with retry button

### Integration Points
- `ViewManager.switchTo()`: Will call `createView('network')` / `createView('tree')` / `createView('supergrid')` — need factory registration
- `WorkerBridge.send()`: New message types may be needed for force simulation (e.g., `graph:simulate`)
- `PAFVProvider`: May need `stackedRowAxes`/`stackedColAxes` arrays if extended for SuperGrid
- `QueryBuilder.buildCardQuery()`: SuperGrid needs grouped/pivoted queries, not flat card lists
- `protocol.ts`: May need new `WorkerRequestType` entries for simulation and grouped queries
- `ViewType` union in `types.ts`: 'network' and 'tree' already present; 'supergrid' is NOT in the union yet — needs adding

</code_context>

<deferred>
## Deferred Ideas

- SuperDynamic (drag-and-drop axis repositioning) — future phase
- SuperDensity (orthogonal density controls) — future phase
- GraphExplorer algorithm panel (PageRank, Louvain, Dijkstra, centrality) — future phase
- 3+ level nesting depth for SuperStack — v1.1 or later
- SuperGrid virtualization for very large datasets — v1.1 if hard limits prove insufficient
- Radial/sunburst tree layout option — future phase

</deferred>

---

*Phase: 07-graph-views-supergrid*
*Context gathered: 2026-02-28*
