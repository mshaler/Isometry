# Phase 7: Graph Views + SuperGrid - Context

**Gathered:** 2026-02-28
**Updated:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can explore connection data through Network and Tree graph views (with off-main-thread force simulation) and project any dataset through SuperGrid's nested dimensional headers. The force simulation runs in the Worker and posts only stable position snapshots. SuperGrid renders nested PAFV-projected headers with visual spanning — the signature PAFV differentiator.

**Out of scope:** SuperDynamic (drag-and-drop axis repositioning), SuperDensity controls, GraphExplorer algorithm panel (PageRank/Louvain/Dijkstra UI), real-time streaming graph updates.

</domain>

<decisions>
## Implementation Decisions

### Network Graph Rendering
- Nodes rendered as colored circles with card name label below
- Node size scales by connection count (degree) — hubs visually stand out
- Edges rendered as straight lines between node centers
- Edge (connection) labels shown on hover only — graph stays clean by default
- Full zoom + pan via d3-zoom: scroll wheel + trackpad pinch gesture to zoom, click-drag to pan

### Force Simulation Strategy
- Final snapshot only — Worker runs simulation to convergence, posts one `{id, x, y}[]` array to main thread
- No per-tick updates cross the postMessage boundary (matches success criteria: "never per-tick updates")
- Warm start on data updates — keep previous positions for persisted nodes, place new nodes near neighbors
- No graph algorithms beyond basic force layout in v1.0 — no PageRank, no community detection, no Dijkstra

### Tree Hierarchy
- User-selectable connection label defines the tree axis (e.g. 'contains', 'parent', 'belongs_to') — not hardcoded to a single label
- Click a node to toggle expand/collapse its children — simple, direct interaction
- Cards with no connections of the selected label (orphans) appear in a separate flat list below the tree — keeps the hierarchy clean
- TreeView nodes expand/collapse without full re-render (success criteria #2)
- Layout orientation: Claude's discretion (top-down vertical vs left-to-right horizontal based on typical data shapes)

### Graph View Interactions
- Click a node to select it via SelectionProvider (Tier 3 ephemeral) — highlights the node and its direct connections; shift-click for multi-select
- Drag a node to pin it at a new position — pinned nodes stay fixed, other nodes continue to float in the force simulation
- Hover a node dims all non-connected nodes and edges — connected neighbors and edges stay bright, showing the local neighborhood

### SuperGrid Header Spanning (SuperStack)
- Nested header levels rendered as horizontal bands — pivot table style
- Parent headers visually span their child column groups with visible borders
- Up to 3 stacked axis levels maximum (primary + secondary + tertiary)
- Stacked axes on BOTH row and column dimensions — full cross-tabulation
- Headers are collapsible — click parent to collapse/expand children
- Cardinality explosion handled by collapsing small groups into an "Other" column — keeps the grid usable under the <16ms render threshold
- Axis state management approach is Claude's discretion (extend PAFVProvider vs SuperGrid-local state)

### SuperGrid Cell Rendering
- Cell content style is Claude's discretion (count badges, mini cards, or heatmap — optimize for <16ms budget)
- Empty cells are rendered with subtle border/background — preserve grid dimensional structure, never collapse empty rows/columns
- Render technology is Claude's discretion (HTML CSS Grid vs SVG — spanning algorithm needs drive this)

### Claude's Discretion
- Tree layout orientation (top-down vertical vs left-to-right horizontal)
- Node color scheme (by card_type, by folder, or single color)
- Node circle sizing scale and label positioning
- Edge color/dash mapping per connection type
- Force simulation parameters (charge strength, link distance, convergence threshold)
- Whether to extend PAFVProvider with stacked axis arrays or use SuperGrid-local state
- SuperGrid cell content format (count badge vs mini cards vs heatmap)
- SuperGrid render technology (CSS Grid vs SVG)
- Exact "Other" collapse threshold for SuperGrid cardinality
- Transition animations between graph states (expand/collapse, pin/unpin)
- Loading skeleton design for graph simulation wait time
- Error state handling for force simulation failures
- Exact spacing, typography, and color palette for both views

</decisions>

<specifics>
## Specific Ideas

- Network view should feel like a standard force-directed graph — think D3 force layout demos, not custom physics
- SuperGrid nested headers should feel like a pivot table in Excel or Google Sheets — familiar to data-oriented users
- Tree orphan list should be visually distinct from the tree itself (below, with a separator)
- Hover dimming in network view should be immediate (no transition delay) for responsiveness
- Force simulation must match success criteria exactly: "main thread receives only stable `{id, x, y}` positions after the simulation converges, never per-tick updates"
- SuperGrid is the "signature PAFV differentiator" — the z-axis stacked headers create dimensional depth that no existing tool handles well
- Empty cells must always render to preserve dimensional integrity — "where did Q3 go?" must never happen

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IView` interface (mount/render/destroy): NetworkView, TreeView, and SuperGrid must implement this contract
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
- SuperGrid virtualization for very large datasets — v1.1 if collapse-to-Other proves insufficient
- Radial/sunburst tree layout option — future phase

</deferred>

---

*Phase: 07-graph-views-supergrid*
*Context gathered: 2026-02-28*
*Updated: 2026-02-28 — revised nesting depth to 3 levels, added user-selectable tree label, added drag-to-pin, added collapse-to-Other cardinality strategy*
