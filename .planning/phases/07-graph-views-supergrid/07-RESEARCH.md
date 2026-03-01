# Phase 7: Graph Views + SuperGrid - Research

**Researched:** 2026-02-28
**Domain:** D3 force simulation (off-main-thread), d3-hierarchy collapsible tree, CSS Grid nested header spanning (SuperStack)
**Confidence:** HIGH (core stack), MEDIUM (SuperStack spanning algorithm)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Network Graph Rendering:**
- Nodes rendered as colored circles with card name label below
- Node size scales by connection count (degree) — hubs visually stand out
- Edges rendered as straight lines between node centers
- Edge (connection) labels shown on hover only — graph stays clean by default
- Full zoom + pan via d3-zoom: scroll wheel + trackpad pinch gesture to zoom, click-drag to pan

**Force Simulation Strategy:**
- Final snapshot only — Worker runs simulation to convergence, posts one `{id, x, y}[]` array to main thread
- No per-tick updates cross the postMessage boundary
- Warm start on data updates — keep previous positions for persisted nodes, place new nodes near neighbors
- No graph algorithms beyond basic force layout in v1.0 — no PageRank, no community detection, no Dijkstra

**Tree Hierarchy:**
- User-selectable connection label defines the tree axis (e.g. 'contains', 'parent', 'belongs_to') — not hardcoded to a single label
- Click a node to toggle expand/collapse its children
- Cards with no connections of the selected label (orphans) appear in a separate flat list below the tree
- TreeView nodes expand/collapse without full re-render
- Layout orientation: Claude's discretion

**Graph View Interactions:**
- Click a node to select it via SelectionProvider (Tier 3 ephemeral) — highlights node and direct connections; shift-click for multi-select
- Drag a node to pin it at a new position — pinned nodes stay fixed (fx/fy), other nodes continue to float
- Hover a node dims all non-connected nodes and edges — immediate, no transition delay

**SuperGrid Header Spanning (SuperStack):**
- Nested header levels rendered as horizontal bands — pivot table style
- Parent headers visually span their child column groups with visible borders
- Up to 3 stacked axis levels maximum (primary + secondary + tertiary)
- Stacked axes on BOTH row and column dimensions — full cross-tabulation
- Headers are collapsible — click parent to collapse/expand children
- Cardinality explosion handled by collapsing small groups into an "Other" column
- Axis state management approach is Claude's discretion

**SuperGrid Cell Rendering:**
- Cell content style is Claude's discretion (count badges, mini cards, or heatmap)
- Empty cells rendered with subtle border/background — never collapse empty rows/columns
- Render technology is Claude's discretion (HTML CSS Grid vs SVG)

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

### Deferred Ideas (OUT OF SCOPE)
- SuperDynamic (drag-and-drop axis repositioning) — future phase
- SuperDensity (orthogonal density controls) — future phase
- GraphExplorer algorithm panel (PageRank, Louvain, Dijkstra, centrality) — future phase
- SuperGrid virtualization for very large datasets — v1.1 if collapse-to-Other proves insufficient
- Radial/sunburst tree layout option — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-07 | Gallery view renders cards as visual thumbnails | Already shipped in Phase 6 — no work needed here |
| VIEW-08 | Network view renders cards as force-directed graph nodes | d3-force in Worker (static layout), d3-zoom on SVG, D3 data join for nodes/links |
| REND-01 | Tree view renders cards in hierarchy layout | d3-hierarchy + d3-stratify, collapsible _children pattern, d3.tree() layout |
| REND-02 | SuperGrid renders cards with nested dimensional headers via PAFV projection | CSS Grid `grid-column` spanning algorithm, multi-axis GROUP BY query, AxisProvider extension |
| REND-05 | All views use D3 data join with key function (d => d.id) | Mandatory per project convention — apply to graph nodes/links and SuperGrid cells |
| REND-06 | View render completes in <16ms for 100 visible cards (SuperGrid) | Vitest `bench()` measurement using `performance.now()`, CSS Grid layout performance |

**Note on requirement IDs:** The ROADMAP.md uses VIEW-07, VIEW-08, REND-01, REND-02, REND-05, REND-06 for Phase 7. Cross-referencing with REQUIREMENTS-v5-CORRECTED.md: VIEW-08 = Network view, VIEW-09 = Tree view, VIEW-01 = SuperGrid, VIEW-11 = D3 key function, VIEW-13 / PERF-05 = render <16ms. The REND-* IDs are roadmap-internal labels; the canonical requirement text is what matters for planning.
</phase_requirements>

---

## Summary

Phase 7 has three distinct implementation problems: (1) running d3-force simulation off-main-thread in the Worker, (2) rendering a collapsible d3-hierarchy tree, and (3) the SuperStack nested header spanning algorithm for SuperGrid. The first two are well-understood problems with documented D3 patterns. The third — SuperStack — is the research flag item and requires a custom algorithm, but the approach is resolved: CSS Grid `grid-column: span N` with a leaf-count computation.

The key architectural insight for NetworkView is that d3-force has zero DOM dependencies and runs cleanly in a Web Worker. The simulation is run synchronously (manual `tick()` loop) rather than via the timer, then the final node positions are posted to the main thread as a flat `{id, x, y}[]` array. The main thread renders SVG using D3 data join with those stable positions — no per-tick postMessage calls.

For SuperGrid, the SuperStack spanning algorithm works by computing, for each header at each axis level, how many leaf columns (or rows) it spans. That leaf count becomes the CSS `grid-column: span N` value. The grid itself is a single CSS Grid container with `grid-template-columns` set to `N` equal-width columns where N is the total leaf count. HTML `<div>` elements for parent headers use `grid-column-start` and `grid-column-end` (or equivalently `span N`) to span the appropriate number of leaf columns.

**Primary recommendation:** Use d3-force (already bundled in d3@7.9.0) in the Worker for NetworkView; use d3-hierarchy (also in d3@7.9.0) in the main thread for TreeView; build SuperGrid with HTML CSS Grid using explicit column-span assignments computed from a recursive leaf-count algorithm.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3` (d3-force submodule) | 7.9.0 (installed) | Force simulation in Worker | Zero DOM dependency, official Worker support in d3 docs |
| `d3` (d3-hierarchy submodule) | 7.9.0 (installed) | Tree layout + stratify | Official D3 hierarchy layout — no alternative |
| `d3` (d3-zoom submodule) | 7.9.0 (installed) | Pan/zoom on NetworkView SVG | Official D3 zoom with transform event |
| `d3` (d3-drag submodule) | 7.9.0 (installed) | Node drag-to-pin in NetworkView | Official D3 drag with fx/fy pinning |
| CSS Grid (native browser API) | Baseline | SuperGrid nested header layout | `grid-column: span N` is the only viable spanning approach |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` bench() | 4.0.18 (installed) | SuperGrid <16ms benchmark | Use `bench()` function with `performance.now()` internally |
| `d3-selection` | (in d3@7.9.0) | SVG data joins for graph rendering | Only on main thread — NOT in Worker |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force in Worker | Custom physics engine | d3-force is already installed, has well-defined convergence via alphaMin, no reason to hand-roll |
| CSS Grid spanning | SVG foreignObject / pure SVG | CSS Grid is declarative, performant, and trivially testable; SVG spanning requires manual coordinate math |
| d3-hierarchy tree | Custom tree BFS layout | d3.tree() handles variable branch counts, arbitrary depth, and provides x/y coordinates — use it |

**No new npm dependencies required.** d3@7.9.0 (already installed) includes d3-force, d3-hierarchy, d3-zoom, and d3-drag as submodules.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── views/
│   ├── NetworkView.ts          # IView impl — SVG force graph, zoom/pan
│   ├── TreeView.ts             # IView impl — collapsible hierarchy
│   ├── SuperGrid.ts            # IView impl — CSS Grid nested headers
│   └── supergrid/
│       ├── SuperStackHeader.ts # Header spanning algorithm
│       └── SuperGridQuery.ts   # Multi-axis GROUP BY query builder
├── worker/
│   ├── handlers/
│   │   └── simulate.handler.ts # graph:simulate handler (NEW)
│   └── protocol.ts             # Add 'graph:simulate' to WorkerRequestType
└── providers/
    └── PAFVProvider.ts         # May extend with stackedRowAxes/stackedColAxes
```

### Pattern 1: Force Simulation in Worker (Static Layout)

**What:** The Worker runs the force simulation synchronously to convergence (300 manual tick() calls), then posts the final `{id, x, y}[]` snapshot to the main thread.

**When to use:** All NetworkView data fetches. The main thread NEVER runs the force simulation.

```typescript
// Source: d3js.org/d3-force/simulation + observablehq.com/@d3/force-directed-web-worker

// In worker/handlers/simulate.handler.ts
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceX, forceY } from 'd3-force';
// Note: import from 'd3-force' subpackage — no DOM imports

export interface SimulatePayload {
  nodes: Array<{ id: string; x?: number; y?: number; fx?: number | null; fy?: number | null }>;
  links: Array<{ source: string; target: string }>;
  width: number;
  height: number;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

export function handleGraphSimulate(payload: SimulatePayload): NodePosition[] {
  const { nodes, links, width, height } = payload;

  const simulation = forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-300))
    .force('link', forceLink(links).id((d: any) => d.id).distance(80))
    .force('x', forceX(width / 2).strength(0.05))
    .force('y', forceY(height / 2).strength(0.05))
    .stop(); // Do NOT use internal timer — run manually

  // Run to convergence: Math.ceil(log(alphaMin) / log(1 - alphaDecay)) = ~300
  const iterations = Math.ceil(
    Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
  );
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Return only stable positions — nodes array was mutated in-place
  return nodes.map(n => ({
    id: n.id,
    x: n.x ?? width / 2,
    y: n.y ?? height / 2,
    fx: n.fx ?? null,
    fy: n.fy ?? null,
  }));
}
```

### Pattern 2: Warm Start for Data Updates

**What:** When the graph data changes (filter applied, new connection created), pass previous node positions into the new simulation so nodes don't jump.

**When to use:** Any `graph:simulate` request where the main thread has a `positionMap` from the previous render.

```typescript
// Main thread — in NetworkView.ts
// Before sending graph:simulate, inject previous positions
const positionedNodes = nodes.map(node => {
  const prev = this.positionMap.get(node.id);
  return prev
    ? { ...node, x: prev.x, y: prev.y }  // warm start: preserve position
    : { ...node };                         // new node: no position (simulation initializes)
});

await this.bridge.send('graph:simulate', {
  nodes: positionedNodes,
  links,
  width: this.container.clientWidth,
  height: this.container.clientHeight,
});
```

### Pattern 3: NetworkView Main Thread Rendering

**What:** The main thread receives the position snapshot and uses D3 data join to render SVG circles (nodes) and lines (edges).

**When to use:** Every time the Worker returns positions from `graph:simulate`.

```typescript
// In NetworkView.ts — render() called with positions from Worker response

// D3 key function MANDATORY (VIEW-09 / REND-05)
const nodeUpdate = this.svg.select('g.nodes')
  .selectAll<SVGCircleElement, NodePosition>('circle.node')
  .data(positions, d => d.id)
  .join(
    enter => enter.append('circle')
      .attr('class', 'node')
      .attr('r', d => nodeRadius(d))   // scales by degree
      .attr('cx', d => d.x)
      .attr('cy', d => d.y),
    update => update.attr('cx', d => d.x).attr('cy', d => d.y),
    exit => exit.remove()
  );
```

### Pattern 4: d3-zoom Pan + Zoom on SVG

**What:** Attach d3-zoom to the outer SVG, apply transform to an inner `<g>` element that contains nodes + edges.

**When to use:** NetworkView mount() — set up once, zoom persists across renders.

```typescript
// Source: d3js.org/d3-zoom

// In NetworkView.mount()
const g = this.svg.append('g').attr('class', 'graph-layer');

const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 8])
  .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
    g.attr('transform', event.transform.toString());
  });

this.svg.call(zoom);
// Store g reference for data joins in render()
this.graphLayer = g;
```

### Pattern 5: Node Drag-to-Pin with fx/fy

**What:** d3-drag on SVG circles sets `fx`/`fy` on node data to pin position. On next `graph:simulate` call, pinned nodes are preserved by the Worker.

**When to use:** NetworkView — drag handler on node circles.

```typescript
// Source: d3js.org/d3-force/simulation + observablehq.com/@d3/sticky-force-layout

// In NetworkView — attach drag to node circles
const drag = d3.drag<SVGCircleElement, NodePosition>()
  .on('start', (event, d) => {
    // Update local position immediately for visual responsiveness
    d.fx = event.x;
    d.fy = event.y;
  })
  .on('drag', (event, d) => {
    d.fx = event.x;
    d.fy = event.y;
    d3.select(event.sourceEvent.target as SVGCircleElement)
      .attr('cx', d.fx)
      .attr('cy', d.fy);
  })
  .on('end', (event, d) => {
    // fx/fy remains set — node stays pinned
    // Update positionMap so next simulate call passes fx/fy
    this.positionMap.set(d.id, { x: d.fx!, y: d.fy!, fx: d.fx, fy: d.fy });
  });
```

### Pattern 6: d3-hierarchy Collapsible Tree

**What:** Build a hierarchy from flat card+connection data using `d3.stratify()`, then toggle `node.children`/`node._children` for expand/collapse without full re-render.

**When to use:** TreeView — every render cycle rebuilds the visible hierarchy layout; collapse state is preserved in the `_children` convention.

```typescript
// Source: observablehq.com/@d3/collapsible-tree + d3js.org/d3-hierarchy/tree

// Build hierarchy from cards filtered to the selected connection label
// Orphans (no parent via selected label) collected separately

interface TreeNode {
  id: string;
  parentId: string | null;
  name: string;
  card_type: string;
}

// Stratify: convert flat array to hierarchy
const root = d3.stratify<TreeNode>()
  .id(d => d.id)
  .parentId(d => d.parentId)(treeNodes);

// Apply layout (top-down vertical — recommended for contains hierarchies)
const treeLayout = d3.tree<TreeNode>()
  .nodeSize([NODE_WIDTH, NODE_HEIGHT])
  .separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

treeLayout(root);

// Toggle collapse
function toggleNode(node: d3.HierarchyNode<TreeNode>): void {
  if (node.children) {
    // Collapse: stash children
    (node as any)._children = node.children;
    node.children = undefined;
  } else {
    // Expand: restore children
    node.children = (node as any)._children;
    (node as any)._children = undefined;
  }
  // Recompute layout and update — do NOT re-stratify (preserves collapse state)
  treeLayout(root);
  updateTreeRender(root);
}
```

### Pattern 7: SuperStack Nested Header Spanning Algorithm

**What:** Compute the leaf-count for each axis value at each level, then use that count as the CSS `grid-column: span N` value. The CSS Grid `grid-template-columns` is set to `N` equal columns where N is the total leaf count.

**When to use:** SuperGrid header rendering — executed whenever the axis configuration or data changes.

**This is the core algorithm with no D3 analogue.** Verified approach based on how all pivot table implementations (AG Grid, Handsontable) handle nested column spanning.

```typescript
// SuperStackHeader.ts — core spanning algorithm

/**
 * A header cell in the nested header structure.
 * span = how many leaf columns this header covers (its CSS grid-column span).
 */
interface HeaderCell {
  value: string;         // axis value label
  level: number;         // 0 = outermost (primary), 1 = secondary, 2 = tertiary
  colStart: number;      // 1-based CSS grid column start
  colSpan: number;       // CSS grid-column: span N
  isCollapsed: boolean;  // user collapsed this header
}

/**
 * Build the header cell array for a single dimension (e.g., column axis).
 *
 * @param axisValues - Ordered array of [primaryValue, secondaryValue?, tertiaryValue?] tuples
 *                     representing each leaf column of the grid
 * @param collapsedSet - Set of "level:value" strings the user has collapsed
 *
 * Steps:
 * 1. Walk through leaf tuples left-to-right
 * 2. For each level, detect when the value changes vs. previous leaf
 * 3. Assign colStart = current position, colSpan = length until value changes
 * 4. For collapsed parents, merge all children into one span
 */
export function buildHeaderCells(
  axisValues: string[][],  // Each inner array = [primaryVal, secondaryVal?, tertiaryVal?]
  collapsedSet: Set<string>
): { headers: HeaderCell[][]; leafCount: number } {
  // axisValues is already ordered by primary, secondary, tertiary
  // Each entry in axisValues represents ONE leaf column

  const levels = axisValues[0]?.length ?? 0;
  const headersByLevel: HeaderCell[][] = Array.from({ length: levels }, () => []);
  let colPosition = 1; // 1-based CSS grid column

  let i = 0;
  while (i < axisValues.length) {
    const currentTuple = axisValues[i];

    // For each level, find run length (how many consecutive leaves share this value)
    for (let level = 0; level < levels; level++) {
      const currentValue = currentTuple[level];
      const levelKey = `${level}:${currentValue}`;
      const isCollapsed = collapsedSet.has(levelKey);

      // Count how many leaf columns this value spans at this level
      let spanCount = 0;
      let j = i;
      while (j < axisValues.length && axisValues[j][level] === currentValue) {
        spanCount++;
        j++;
      }

      // Only emit a new HeaderCell at level when the value changes
      const lastHeader = headersByLevel[level].at(-1);
      if (!lastHeader || lastHeader.value !== currentValue) {
        headersByLevel[level].push({
          value: currentValue,
          level,
          colStart: colPosition,
          colSpan: spanCount,
          isCollapsed,
        });
      }
    }

    colPosition++;
    i++;
  }

  return {
    headers: headersByLevel,
    leafCount: axisValues.length,
  };
}

/**
 * CSS template for the grid container.
 * Each leaf column gets equal width (minmax(60px, 1fr)).
 */
export function buildGridTemplateColumns(leafCount: number): string {
  // Header area columns + N data columns
  return `[headers] auto repeat(${leafCount}, minmax(60px, 1fr))`;
}
```

### Pattern 8: SuperGrid SQL Query (Multi-Axis GROUP BY)

**What:** SuperGrid needs a query that returns one row per (rowAxisValue, colAxisValue) intersection with a count of cards at that intersection.

**When to use:** SuperGrid render() — replaces the flat `buildCardQuery()` with a grouped aggregation query.

```typescript
// SuperGridQuery.ts — pivot-style aggregation

// Example for 2-axis SuperGrid: status (col) x folder (row)
// SELECT status, folder, COUNT(*) as count
// FROM cards
// WHERE deleted_at IS NULL [+ filter fragments]
// GROUP BY status, folder

// For SuperStack with 3 column levels: card_type, status, priority
// SELECT card_type, status, priority, folder, COUNT(*) as count
// FROM cards WHERE deleted_at IS NULL
// GROUP BY card_type, status, priority, folder
// ORDER BY card_type, status, priority, folder

// The QueryBuilder will need a new buildSuperGridQuery() method or
// SuperGrid builds the query itself using the axis configuration.
```

### Anti-Patterns to Avoid

- **Per-tick postMessage:** Never call `postMessage()` inside a `simulation.on('tick')` callback. Each tick fires up to 300 times. The Worker will flood the main thread's message queue. Use `stop()` + manual `tick()` loop.
- **Running d3-selection in Worker:** `d3.select()`, `d3.selectAll()`, and any DOM-touching D3 method throws in a Worker context. Only `d3-force`, `d3-hierarchy`, `d3-array`, `d3-scale`, `d3-shape` are safe in Workers.
- **Missing key function:** Graph nodes and SuperGrid cells MUST use `.data(items, d => d.id)`. Missing key = index-based matching = visual corruption on filter changes.
- **Collapsing empty SuperGrid cells:** The CONTEXT.md is explicit — empty cells must render. The spanning algorithm must allocate columns for values with zero cards.
- **Re-stratifying on every expand/collapse toggle:** `d3.stratify()` rebuilds the tree from scratch. For collapse-only (not data changes), toggle `node.children`/`node._children` and re-run `treeLayout(root)` on the EXISTING root. Only re-stratify when the underlying data changes.
- **Importing d3 monolith in Worker:** The d3 package includes DOM-dependent modules. In the Worker, import only `d3-force` — either by subpackage name or via selective named imports. Verify no DOM-touching code path is reached.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force layout physics | Custom velocity Verlet integrator | `d3-force` (already installed) | Alpha decay, force composition, convergence detection — all handled |
| Tree coordinate assignment | Custom BFS position calculator | `d3.tree()` from d3-hierarchy | Handles variable branch counts, separation functions, nodeSize |
| Pan/zoom on SVG | Custom wheel/pointer event handler | `d3.zoom()` (in d3@7.9.0) | Handles scroll, pinch, touch, programmatic zoom; scaleExtent; transform state |
| Node drag interaction | Custom mousedown/mousemove handler | `d3.drag()` (in d3@7.9.0) | Handles touch, pointer capture, event normalization |
| Hierarchy from flat data | Manual tree-building loop | `d3.stratify()` from d3-hierarchy | Handles forest roots, cycle detection, parentId lookup |
| Vitest perf benchmark | Manual timing with `Date.now()` | `bench()` from vitest | Statistical analysis (hz, p99, rme) for meaningful threshold testing |

**Key insight:** The d3 monorepo's force, hierarchy, zoom, and drag packages are all pure data/math operations with no DOM dependencies individually — except that d3-zoom and d3-drag DO use browser event APIs and must run on the main thread. Only d3-force and d3-hierarchy are safe in Workers.

---

## Common Pitfalls

### Pitfall 1: d3-selection imported in Worker causes crash

**What goes wrong:** Importing the d3 monolith (`import * as d3 from 'd3'`) in the Worker pulls in d3-selection which calls `document.createElementNS`. Worker has no `document` — throws immediately.

**Why it happens:** The Worker handler file imports d3 for convenience. d3-force does NOT need the DOM but the d3 bundle loads d3-selection regardless.

**How to avoid:** In `simulate.handler.ts`, import only from `d3-force`:
```typescript
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceX, forceY } from 'd3-force';
// OR: from the d3 bundle but only named force imports (tree-shaking ensures no DOM code executes)
```

**Warning signs:** Worker logs `ReferenceError: document is not defined` on first use. TypeScript compiles fine, runtime crashes.

### Pitfall 2: Per-tick postMessage flooding

**What goes wrong:** Main thread receives 300 position updates per simulation, UI jank, message queue overflow, eventual crash.

**Why it happens:** Developer adds `postMessage()` inside `simulation.on('tick')` callback to "show progress."

**How to avoid:** Use `simulation.stop()` before starting, call `simulation.tick()` manually in a loop, call `postMessage()` once at the end. The CONTEXT.md is explicit: "Final snapshot only."

**Warning signs:** `bridge.send('graph:simulate', ...)` resolves slowly; profiling shows hundreds of postMessage calls.

### Pitfall 3: SuperStack wrong column count (cardinality explosion)

**What goes wrong:** SuperGrid renders 500+ leaf columns when an axis has high cardinality (e.g., card name as column axis). CSS Grid layout takes >16ms, browser hangs.

**Why it happens:** No cardinality guard on axis selection.

**How to avoid:** Before rendering, count distinct values per axis level. If total leaf count > MAX_LEAF_COLUMNS (recommend: 50), collapse excess values into an "Other" bucket:
```typescript
const MAX_LEAF_COLUMNS = 50;
if (distinctValues.length > MAX_LEAF_COLUMNS) {
  const top = distinctValues.slice(0, MAX_LEAF_COLUMNS - 1);
  distinctValues = [...top, 'Other'];
  // 'Other' bucket aggregates remaining values
}
```

**Warning signs:** SuperGrid render time suddenly >16ms when switching to a high-cardinality axis.

### Pitfall 4: Tree re-stratify destroying collapse state

**What goes wrong:** Click to expand a node → TreeView re-stratifies from scratch → all nodes reset to expanded state.

**Why it happens:** `render()` calls `d3.stratify()` every time, discarding the `_children` stash on existing nodes.

**How to avoid:** Separate stratification (data changes) from layout update (collapse toggle). Store the root hierarchy object on the view instance. Only re-stratify when `cards` array changes. For toggle, mutate the existing root node and re-run `treeLayout(root)`.

**Warning signs:** Collapsed nodes re-expand spontaneously on any re-render.

### Pitfall 5: 'supergrid' missing from ViewType union

**What goes wrong:** TypeScript error — `'supergrid' is not assignable to type ViewType`. ViewManager.switchTo() rejects the view type.

**Why it happens:** The CONTEXT.md explicitly notes: "'supergrid' is NOT in the ViewType union yet — needs adding."

**How to avoid:** Wave 0 task — add `'supergrid'` to the `ViewType` union in `src/providers/types.ts` and add default state to `VIEW_DEFAULTS` in `PAFVProvider.ts`. Do this first.

**Warning signs:** TypeScript compile error on `ViewManager.switchTo('supergrid', ...)`.

### Pitfall 6: Worker `graph:simulate` type not registered in protocol

**What goes wrong:** `WorkerBridge.send('graph:simulate', payload)` throws at runtime because the type is not in the exhaustive switch, or TypeScript rejects the type string.

**Why it happens:** `WorkerRequestType` union in `protocol.ts` doesn't include `'graph:simulate'`. The router in `worker.ts` has no case for it.

**How to avoid:** Wave 0 task — add `'graph:simulate'` to `WorkerRequestType`, `WorkerPayloads`, and `WorkerResponses` in `protocol.ts`. Add case to the router in `worker.ts`. Register `handleGraphSimulate` in `handlers/index.ts`.

---

## Code Examples

Verified patterns from research:

### Force Simulation Convergence Calculation

```typescript
// Source: d3js.org/d3-force/simulation — default 300 iterations
// This formula computes the number of ticks until alpha < alphaMin

const iterations = Math.ceil(
  Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
);
// With defaults: alphaMin=0.001, alphaDecay=0.0228 → ~300 iterations
```

### d3-hierarchy Stratify + Tree Layout

```typescript
// Source: d3js.org/d3-hierarchy/tree + observablehq.com/@d3/collapsible-tree

// Build hierarchy from flat array with parentId
const root = d3.stratify<TreeNode>()
  .id(d => d.id)
  .parentId(d => d.parentId)(flatNodes);  // flatNodes have parentId=null for roots

// Apply tree layout
const layout = d3.tree<TreeNode>()
  .nodeSize([NODE_WIDTH, NODE_HEIGHT]);

layout(root);  // Assigns root.descendants().forEach(n => { n.x, n.y })

// Collapsible toggle pattern
function toggle(node: d3.HierarchyNode<TreeNode>): void {
  if (node.children) {
    (node as any)._children = node.children;
    node.children = undefined;
  } else {
    node.children = (node as any)._children;
    (node as any)._children = undefined;
  }
  layout(root);   // Recompute positions on existing hierarchy
  updateRender(); // D3 data join — does NOT re-stratify
}
```

### d3-zoom Applied to SVG with Inner g Element

```typescript
// Source: d3js.org/d3-zoom

// Mount time: create zoom, attach to SVG, store inner g reference
const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 8])
  .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
    this.graphLayer.attr('transform', event.transform.toString());
  });
this.svg.call(zoom);

// Reset zoom programmatically
this.svg.transition().duration(300)
  .call(zoom.transform, d3.zoomIdentity);
```

### CSS Grid with Header Spanning

```typescript
// Source: MDN grid-column, CSS-Tricks Complete Guide CSS Grid

// Container: N leaf columns + frozen header column
container.style.gridTemplateColumns = `160px repeat(${leafCount}, minmax(60px, 1fr))`;
container.style.display = 'grid';

// Parent header spanning 3 leaf columns starting at column 2
const parentHeader = document.createElement('div');
parentHeader.style.gridColumn = `2 / span 3`;  // col-start / span N
parentHeader.style.gridRow = '1';               // level 0 row

// Leaf header (span 1)
const leafHeader = document.createElement('div');
leafHeader.style.gridColumn = `2 / span 1`;    // individual leaf
leafHeader.style.gridRow = '2';                 // level 1 row
```

### Vitest bench() for SuperGrid Performance

```typescript
// Source: vitest.dev/api/ — bench() function

import { bench, describe } from 'vitest';

describe('SuperGrid performance', () => {
  bench('render 100 cards <16ms', async () => {
    const start = performance.now();
    superGrid.render(cards100);
    const elapsed = performance.now() - start;
    // bench runs this multiple times; p99 available in results
  }, {
    time: 2000,      // Run for 2 seconds total
    iterations: 50,  // Minimum 50 iterations
  });
});
```

### Node Degree Calculation for Circle Sizing

```typescript
// Source: derived from GraphExplorer.md centrality patterns

// Query degree before rendering — add to the Worker response
// SELECT c.*, COUNT(conn.id) as degree
// FROM cards c
// LEFT JOIN connections conn ON (conn.source_id = c.id OR conn.target_id = c.id)
// WHERE c.deleted_at IS NULL
// GROUP BY c.id

// Node radius scales by degree
const MIN_RADIUS = 8;
const MAX_RADIUS = 28;
const degreeScale = d3.scaleSqrt()
  .domain([0, maxDegree])
  .range([MIN_RADIUS, MAX_RADIUS])
  .clamp(true);

const nodeRadius = (d: NodePosition) => degreeScale(d.degree ?? 0);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Run simulation on main thread with requestAnimationFrame | Run simulation synchronously in Worker, post final snapshot | d3 v5+ docs recommend Workers for large graphs | No main thread blocking, no per-tick cost |
| d3-zoom v1: `d3.event.transform` | d3-zoom v3: `event.transform` from event parameter | D3 v6+ | `d3.event` is removed — must use event parameter in handler |
| `d3.hierarchy()` with manual parent linking | `d3.stratify()` with id/parentId | D3 v4+ | Cleaner API for flat-to-tree conversion |
| SVG-only layouts | CSS Grid for tabular/spanning layouts | Broad CSS Grid support (2019+) | CSS Grid `span N` eliminates manual coordinate math for pivot headers |
| `simulation.on('end', callback)` for convergence | Manual `stop()` + `tick()` loop in Worker | Best practice for Worker context | `on('end')` uses internal timer (setTimeout) — not available in Worker; manual loop is always synchronous |

**Deprecated/outdated:**
- `d3.event`: Removed in D3 v6. This project uses d3@7.9.0. All event handlers receive the event as the first parameter.
- `simulation.on('end', cb)` in Worker: The internal timer dispatch won't fire in Worker context reliably. Use synchronous tick loop.

---

## Open Questions

1. **Whether to import d3-force as subpackage or from d3 bundle in Worker**
   - What we know: `d3-force` has zero DOM dependencies. The full `d3` bundle includes `d3-selection` which requires `document`.
   - What's unclear: Whether Vite's tree-shaking ensures DOM code is NOT executed when only force exports are used from the `d3` bundle in a Worker context.
   - Recommendation: Explicitly import from `d3-force` subpackage in simulate.handler.ts (`import { forceSimulation } from 'd3-force'`) to eliminate any ambiguity. `d3-force` is already included in `node_modules` as a d3 dependency.

2. **SuperGrid axis state: extend PAFVProvider or SuperGrid-local**
   - What we know: PAFVProvider currently holds single `xAxis`/`yAxis`/`groupBy`. SuperGrid needs up to 3 stacked row axes and 3 stacked column axes.
   - What's unclear: Whether extending PAFVProvider adds unwanted complexity to a component that other views don't need.
   - Recommendation: Add `stackedRowAxes: AxisMapping[]` and `stackedColAxes: AxisMapping[]` to PAFVProvider state, guarded by view family (`graph` family ignores them; SuperGrid reads them). This keeps all axis state in one provider (Tier 2, persisted). Alternatively, SuperGrid-local state works but loses persistence between view switches.

3. **How to handle multi-root forests in TreeView**
   - What we know: `d3.stratify()` requires exactly one root (one node with `parentId = null`). If multiple cards have no parent via the selected label, stratify throws.
   - What's unclear: Best UX for multi-root case.
   - Recommendation: Inject a synthetic root node with id `'__forest_root__'` and make all true roots children of it. Render the synthetic root as invisible (zero size). Orphans (nodes with no connection of the selected label at all) go to the separate flat list below the tree.

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — skipping Validation Architecture section per instructions.

---

## Sources

### Primary (HIGH confidence)
- `d3js.org/d3-force/simulation` — forceSimulation API, tick(), stop(), alphaMin, alphaDecay, fx/fy pinning
- `d3js.org/d3-force` — available force types (forceManyBody, forceLink, forceCenter, forceX, forceY)
- `d3js.org/d3-hierarchy/tree` — d3.tree() API, size, nodeSize, separation
- `d3js.org/d3-zoom` — zoom behavior, scaleExtent, event.transform, call(zoom)
- `observablehq.com/@d3/force-directed-web-worker` — Worker pattern: stop() + tick() loop + postMessage once
- `observablehq.com/@d3/collapsible-tree` — _children toggle, treeLayout(root) recompute, update pattern
- `vitest.dev/api/` — bench() function, time/iterations options, p99 output

### Secondary (MEDIUM confidence)
- `d3js.org/d3-hierarchy/stratify` — stratify() API with id/parentId accessors
- MDN `grid-column` — CSS `span N` syntax, grid-column-start/end
- CSS-Tricks Complete Guide CSS Grid — gridTemplateColumns, spanning patterns

### Tertiary (LOW confidence)
- WebSearch: force simulation warm-start patterns (multiple concordant sources → raised to MEDIUM)
- AG Grid column spanning docs — confirms leaf-count-based span calculation is the industry standard approach for nested headers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — d3@7.9.0 already installed, all submodules confirmed present
- Architecture (NetworkView, TreeView): HIGH — official D3 docs + Observable examples verified
- SuperStack spanning algorithm: MEDIUM — derived from CSS Grid fundamentals + AG Grid pattern; no exact D3 analogue exists (as flagged in research note), but the CSS Grid approach is well-founded
- Pitfalls: HIGH — per-tick flooding, d3-selection in Worker, missing ViewType union confirmed from code inspection and docs

**Research date:** 2026-02-28
**Valid until:** 2026-06-01 (d3 API stable; CSS Grid stable)
