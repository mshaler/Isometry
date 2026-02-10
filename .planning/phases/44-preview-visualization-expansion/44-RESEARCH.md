# Phase 44: Preview Visualization Expansion - Research

**Researched:** 2026-02-10
**Domain:** D3.js interactive visualizations (force-directed graphs, timelines, SQL query interfaces)
**Confidence:** HIGH

## Summary

Phase 44 completes the Preview pane from 50% to fully functional by adding three missing visualization types: (1) Network Graph for GRAPH relationships using D3 force-directed layout, (2) Data Inspector for SQL query exploration, and (3) Timeline for temporal LATCH facets. The existing Preview component already has tab structure and SuperGrid integration; this phase fills in the placeholder tabs with functional D3.js visualizations.

**Architecture context:** Isometry uses sql.js (SQLite in WASM) for synchronous data access, D3.js v7 for all visualizations with `.join()` data binding, and React for UI chrome only. The LPG schema includes nodes (cards) and edges (LINK, NEST, SEQUENCE, AFFINITY types) with full LATCH metadata for temporal, category, and hierarchy filtering.

**Primary recommendation:** Use D3 force simulation with Canvas rendering for large graphs (>1000 nodes), implement progressive loading for network layout, build a simple SQL textarea + results table for Data Inspector (avoid heavy query builder libraries), and adapt CardBoard-v3's Timeline view patterns with zoom/pan behavior and temporal scales.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3 | 7.9.0 | All visualizations | Already in use, v7 `.join()` pattern, force simulation built-in |
| sql.js | 1.13.0 | SQLite WASM | Already in use, synchronous queries, FTS5 + recursive CTEs |
| React | 18.2.0 | UI chrome | Already in use, controls only (not data rendering) |
| TypeScript | 5.2.2 | Type safety | Already in use, strict mode enforced |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-virtual | 3.13.18 | Virtual scrolling | Already in use; use for Data Inspector results table if >100 rows |
| @uiw/react-md-editor | 4.0.11 | Markdown rendering | Already in use; reuse for query help/documentation if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D3 force simulation | cytoscape.js, vis.js | D3 already in stack, more control, force simulation is canonical |
| SQL textarea | react-querybuilder | Query builder adds 200KB+ bundle size, SQL textarea is simpler for expert users |
| Custom timeline | d3-timeline library | Custom allows PAFV integration, LATCH facet mapping, matches SuperGrid architecture |
| Canvas rendering | SVG only | Canvas performs 5x faster for >1000 nodes but loses easy interactivity; use SVG <500 nodes, hybrid >500 |

**Installation:**
No new dependencies required. All visualization needs met by existing d3, sql.js, React stack.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── notebook/
│       ├── PreviewComponent.tsx          # Already exists - tab container
│       ├── D3VisualizationRenderer.tsx   # Already exists - general D3 wrapper
│       └── preview-tabs/                 # NEW - specific tab implementations
│           ├── NetworkGraphTab.tsx       # Force-directed graph (PREV-01, PREV-02)
│           ├── DataInspectorTab.tsx      # SQL query interface (PREV-03, PREV-04, PREV-05)
│           └── TimelineTab.tsx           # Temporal visualization (PREV-06, PREV-07)
├── d3/
│   └── visualizations/                   # NEW - D3 renderers
│       ├── network/
│       │   ├── ForceGraphRenderer.ts     # Core force simulation
│       │   ├── types.ts                  # Node, Link, SimulationConfig types
│       │   └── interactions.ts           # Drag, click, hover handlers
│       └── timeline/
│           ├── TimelineRenderer.ts       # Temporal scale + event rendering
│           ├── types.ts                  # TimelineEvent, TimelineConfig types
│           └── zoom.ts                   # Zoom/pan behavior
├── hooks/
│   └── visualization/
│       ├── useForceGraph.ts              # Manages force simulation state
│       ├── useDataInspector.ts           # SQL query execution + results
│       └── useTimeline.ts                # Timeline data + filtering
└── services/
    └── query-executor.ts                 # SQL execution with error handling
```

### Pattern 1: Force-Directed Graph with D3 Force Simulation

**What:** Interactive network graph using D3's built-in force simulation with drag, click, and hover interactions.

**When to use:** Visualizing GRAPH relationships (edges table) between nodes with types LINK, NEST, SEQUENCE, AFFINITY.

**Example:**
```typescript
// Source: https://observablehq.com/@d3/force-directed-graph-component + D3 v7 official docs
import * as d3 from 'd3';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  group?: string;
  fx?: number | null; // Fixed x during drag
  fy?: number | null; // Fixed y during drag
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
  weight: number;
}

function createForceGraph(
  container: SVGGElement,
  nodes: GraphNode[],
  links: GraphLink[],
  width: number,
  height: number
) {
  // Create simulation with multiple forces
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<GraphNode, GraphLink>(links)
      .id(d => d.id)
      .distance(d => 100 / d.weight) // Closer for higher weight
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(30));

  const g = d3.select(container);

  // Render links
  const link = g.selectAll('.link')
    .data(links, d => `${d.source}-${d.target}`)
    .join('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-width', d => Math.sqrt(d.weight));

  // Render nodes
  const node = g.selectAll('.node')
    .data(nodes, d => d.id)
    .join('circle')
      .attr('class', 'node')
      .attr('r', 8)
      .attr('fill', d => d3.schemeCategory10[d.group % 10])
      .call(drag(simulation));

  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => (d.source as GraphNode).x!)
      .attr('y1', d => (d.source as GraphNode).y!)
      .attr('x2', d => (d.target as GraphNode).x!)
      .attr('y2', d => (d.target as GraphNode).y!);

    node
      .attr('cx', d => d.x!)
      .attr('cy', d => d.y!);
  });

  return simulation;
}

// Drag behavior with simulation restart
function drag(simulation: d3.Simulation<GraphNode, undefined>) {
  return d3.drag<SVGCircleElement, GraphNode>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; // Release fixed position
      d.fy = null;
    });
}
```

### Pattern 2: SQL Data Inspector with Results Table

**What:** Simple SQL textarea + execute button + sortable results table. No query builder UI (too heavy for this use case).

**When to use:** PREV-03, PREV-04, PREV-05 requirements - exploring SQLite schema and data.

**Example:**
```typescript
// Using existing useSQLiteQuery hook + React state
import { useState } from 'react';
import { useSQLite } from '@/db/SQLiteProvider';

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
}

function DataInspectorTab() {
  const [sql, setSql] = useState('SELECT * FROM nodes LIMIT 10');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { execute } = useSQLite();

  const executeQuery = () => {
    try {
      const start = performance.now();
      const rows = execute(sql, []); // Synchronous!
      const duration = performance.now() - start;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        setResult({ columns, rows, rowCount: rows.length, duration });
        setError(null);
      } else {
        setResult({ columns: [], rows: [], rowCount: 0, duration });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
      setResult(null);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const csv = [
      result.columns.join(','),
      ...result.rows.map(row =>
        result.columns.map(col => JSON.stringify(row[col])).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
  };

  return (
    <div className="data-inspector">
      <textarea
        value={sql}
        onChange={e => setSql(e.target.value)}
        className="sql-input"
      />
      <button onClick={executeQuery}>Execute</button>
      <button onClick={exportCSV} disabled={!result}>Export CSV</button>

      {error && <div className="error">{error}</div>}
      {result && (
        <table>
          <thead>
            <tr>{result.columns.map(col => <th key={col}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {result.columns.map(col => <td key={col}>{String(row[col])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### Pattern 3: Timeline with Temporal Scale and Zoom

**What:** D3 timeline with scaleTime for temporal LATCH facets, zoom/pan behavior, date range filtering.

**When to use:** PREV-06, PREV-07 requirements - visualizing cards by created_at, modified_at, due_at, event_start/end.

**Example:**
```typescript
// Adapted from CardBoard-v3 src/views/timeline/index.ts
import * as d3 from 'd3';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  label: string;
  track: string;
}

function createTimeline(
  container: SVGGElement,
  events: TimelineEvent[],
  width: number,
  height: number
) {
  const margin = { top: 20, right: 30, bottom: 40, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = d3.select(container)
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  // Time scale
  const xScale = d3.scaleTime()
    .domain(d3.extent(events, d => d.timestamp) as [Date, Date])
    .range([0, innerWidth]);

  // Track scale
  const tracks = [...new Set(events.map(e => e.track))];
  const yScale = d3.scaleBand()
    .domain(tracks)
    .range([0, innerHeight])
    .padding(0.1);

  // Axis
  const xAxis = d3.axisBottom(xScale).ticks(10);
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(xAxis);

  // Events
  const eventGroup = g.selectAll('.event')
    .data(events, d => d.id)
    .join('circle')
      .attr('class', 'event')
      .attr('cx', d => xScale(d.timestamp))
      .attr('cy', d => yScale(d.track)! + yScale.bandwidth() / 2)
      .attr('r', 5)
      .attr('fill', '#3498db');

  // Zoom behavior
  const zoom = d3.zoom<SVGGElement, unknown>()
    .scaleExtent([0.5, 10])
    .on('zoom', (event) => {
      const newXScale = event.transform.rescaleX(xScale);
      g.select('.x-axis').call(xAxis.scale(newXScale));
      eventGroup.attr('cx', d => newXScale(d.timestamp));
    });

  d3.select(container.parentElement).call(zoom);
}
```

### Anti-Patterns to Avoid

- **Large SVG graphs:** Don't render >500 nodes as SVG circles - use Canvas with hybrid SVG overlay for labels
- **Synchronous layout blocking:** Force simulation runs in main thread - stop after 300 ticks or use Web Worker for >1000 nodes
- **Missing key functions:** Always use `.data(items, d => d.id)` - required for D3 v7 `.join()` correctness
- **Heavy query builders:** Don't import react-querybuilder (200KB+) - SQL textarea is sufficient for power users
- **Timeline without zoom:** Timeline without zoom/pan is unusable for dense temporal data - always include d3.zoom()

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed layout | Custom spring physics | `d3.forceSimulation()` | Barnes-Hut optimization, collision detection, proven stable convergence |
| Graph collision detection | Bounding box math | `d3.forceCollide()` | Quadtree-based O(n log n) complexity, handles overlap prevention |
| Temporal scales | Manual date binning | `d3.scaleTime()` | Handles DST, leap years, timezone offset, optimized tick formatting |
| Zoom/pan behavior | Manual mouse handlers | `d3.zoom()` | Handles touch, trackpad gestures, inertia, extent clamping, transform composition |
| CSV export | String concatenation | Blob API + URL.createObjectURL | Handles special chars, large files, memory-efficient streaming |

**Key insight:** D3's force simulation and zoom behaviors have thousands of edge cases already solved (multi-touch, inertia, boundary constraints, stabilization). Custom implementations miss these and create buggy UX.

## Common Pitfalls

### Pitfall 1: Force Simulation Never Stops

**What goes wrong:** Simulation keeps running indefinitely, burning CPU even when graph is stable.

**Why it happens:** Default `alphaDecay` means simulation runs for ~300 ticks, but with `alphaTarget > 0` (set during drag), it never stops.

**How to avoid:**
```typescript
// Stop simulation after initial layout OR when alpha drops below threshold
simulation.on('tick', () => {
  // Update positions...
  if (simulation.alpha() < 0.01) {
    simulation.stop();
  }
});

// Alternative: Hard timeout
setTimeout(() => simulation.stop(), 3000); // 3 seconds max
```

**Warning signs:** High CPU usage when graph is idle, browser fan spinning, performance.now() shows continuous frame renders.

### Pitfall 2: SVG Performance Cliff at 500+ Nodes

**What goes wrong:** Graph becomes unresponsive, dragging is laggy, zoom stutters.

**Why it happens:** SVG DOM manipulation is O(n) per frame. Each tick updates x/y attributes on every node + link element.

**How to avoid:**
```typescript
// Use Canvas for nodes/links, SVG overlay for labels
const canvas = d3.select(container).append('canvas');
const context = canvas.node()!.getContext('2d')!;

simulation.on('tick', () => {
  context.clearRect(0, 0, width, height);

  // Draw links
  links.forEach(link => {
    context.beginPath();
    context.moveTo(link.source.x, link.source.y);
    context.lineTo(link.target.x, link.target.y);
    context.stroke();
  });

  // Draw nodes
  nodes.forEach(node => {
    context.beginPath();
    context.arc(node.x, node.y, 5, 0, 2 * Math.PI);
    context.fill();
  });
});
```

**Warning signs:** >500 nodes, lag on drag, requestAnimationFrame dropping frames, Chrome DevTools Performance shows "Recalculate Style" spikes.

### Pitfall 3: Missing `fx`/`fy` Cleanup After Drag

**What goes wrong:** Nodes stay fixed in place after drag ends, no longer respond to forces.

**Why it happens:** Setting `node.fx = event.x` during drag fixes position, but forgetting to set `fx = null` on drag end leaves it permanently fixed.

**How to avoid:**
```typescript
const drag = d3.drag<SVGCircleElement, GraphNode>()
  .on('end', (event, d) => {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; // CRITICAL: Release fixed position
    d.fy = null;
  });
```

**Warning signs:** Dragged nodes don't move with force changes, isolated nodes after drag, graph layout feels "broken".

### Pitfall 4: SQL Injection in Data Inspector

**What goes wrong:** User enters malicious SQL that corrupts database (e.g., `DROP TABLE nodes`).

**Why it happens:** Direct `execute(sql)` with user input, no sanitization or read-only mode.

**How to avoid:**
```typescript
// sql.js doesn't support prepared statements for DDL, so:
// 1. Prevent DDL statements
const ddlRegex = /^\s*(DROP|ALTER|CREATE|DELETE|UPDATE|INSERT|TRUNCATE)\s/i;
if (ddlRegex.test(sql)) {
  throw new Error('Only SELECT queries allowed in Data Inspector');
}

// 2. Wrap in transaction + rollback for safety
try {
  execute('BEGIN TRANSACTION');
  const results = execute(sql);
  execute('ROLLBACK'); // Don't persist changes
  return results;
} catch (err) {
  execute('ROLLBACK');
  throw err;
}
```

**Warning signs:** User can modify data from read-only view, accidental DELETE in inspector, lost data.

### Pitfall 5: Timeline with Invalid Date Ranges

**What goes wrong:** `scaleTime()` domain is `[undefined, undefined]` or `[NaN, NaN]`, entire timeline disappears.

**Why it happens:** Nodes with null `created_at` values, `d3.extent()` returns `[undefined, undefined]`.

**How to avoid:**
```typescript
const validTimestamps = events
  .map(e => e.timestamp)
  .filter(t => t instanceof Date && !isNaN(t.getTime()));

if (validTimestamps.length === 0) {
  // Fallback: show last 30 days
  const now = new Date();
  const month = new Date(now);
  month.setDate(month.getDate() - 30);
  xScale.domain([month, now]);
} else {
  xScale.domain(d3.extent(validTimestamps) as [Date, Date]);
}
```

**Warning signs:** Blank timeline, console errors "Invalid domain", axis shows no ticks.

## Code Examples

Verified patterns from official sources and CardBoard-v3:

### Network Graph with Edges Table Query

```typescript
// Query edges from sql.js and build D3 graph structure
import { useSQLite } from '@/db/SQLiteProvider';
import { useEffect, useState } from 'react';

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

function useGraphData(nodeIds?: string[]): GraphData {
  const { execute } = useSQLite();
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });

  useEffect(() => {
    // Query nodes and edges from LPG schema
    const nodeFilter = nodeIds
      ? `WHERE id IN (${nodeIds.map(() => '?').join(',')})`
      : 'WHERE deleted_at IS NULL LIMIT 100';

    const nodesQuery = `SELECT id, name, folder FROM nodes ${nodeFilter}`;
    const nodeRows = execute(nodesQuery, nodeIds || []);

    const edgesQuery = `
      SELECT e.id, e.source_id, e.target_id, e.edge_type, e.weight
      FROM edges e
      WHERE e.source_id IN (${nodeRows.map(() => '?').join(',')})
        AND e.target_id IN (${nodeRows.map(() => '?').join(',')})
    `;
    const nodeIdList = nodeRows.map(n => n.id);
    const edgeRows = execute(edgesQuery, [...nodeIdList, ...nodeIdList]);

    // Convert to D3 format
    const nodes = nodeRows.map(row => ({
      id: row.id as string,
      label: row.name as string,
      group: row.folder as string || 'default'
    }));

    const links = edgeRows.map(row => ({
      source: row.source_id as string,
      target: row.target_id as string,
      type: row.edge_type as 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY',
      weight: row.weight as number
    }));

    setData({ nodes, links });
  }, [execute, nodeIds]);

  return data;
}
```

### Timeline with LATCH Time Facets

```typescript
// Source: CardBoard-v3 src/views/timeline/index.ts patterns
import * as d3 from 'd3';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';

interface TimelineData {
  events: TimelineEvent[];
  dateRange: [Date, Date];
}

function useTimelineData(facet: 'created_at' | 'modified_at' | 'due_at'): TimelineData {
  // Query nodes with temporal facet
  const { data: rows } = useSQLiteQuery(
    `SELECT id, name, ${facet}, folder
     FROM nodes
     WHERE ${facet} IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY ${facet} DESC
     LIMIT 500`,
    []
  );

  // Convert to timeline events
  const events = (rows || []).map(row => ({
    id: row.id as string,
    timestamp: new Date(row[facet] as string),
    label: row.name as string,
    track: row.folder as string || 'default'
  }));

  // Calculate date range
  const timestamps = events.map(e => e.timestamp);
  const dateRange: [Date, Date] = timestamps.length > 0
    ? d3.extent(timestamps) as [Date, Date]
    : [new Date(), new Date()];

  return { events, dateRange };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3.enter().append() + update() + exit() | d3.join() | D3 v5 (2019) | Simpler API, automatic key binding, fewer bugs |
| Manual force layout | d3.forceSimulation() with composable forces | D3 v4 (2016) | Modular forces, better performance, easier customization |
| SVG for all visualizations | Canvas for >500 elements, SVG for interactivity | 2020+ best practices | 5x faster rendering, smooth 60fps for large graphs |
| Heavy query builders (Retool, Metabase) | Simple SQL textarea for power users | 2023+ minimalism | Faster UX, smaller bundle, expert-friendly |
| react-querybuilder | Direct SQL + schema autocomplete | 2024+ trend | Lower overhead, TypeScript integration, no library lock-in |

**Deprecated/outdated:**
- **d3.forceLayout()**: Replaced by `d3.forceSimulation()` in D3 v4 (2016)
- **d3.time.scale()**: Replaced by `d3.scaleTime()` in D3 v4
- **Manual enter/update/exit**: Replaced by `.join()` in D3 v5
- **jQuery for DOM manipulation**: D3 selections handle this natively

## Open Questions

1. **Canvas vs SVG threshold for network graphs**
   - What we know: Canvas performs better at >500 nodes, but loses easy click handlers
   - What's unclear: Best hybrid approach - Canvas for links, SVG for nodes? Or Canvas + hit detection via quadtree?
   - Recommendation: Start with pure SVG <500 nodes (PREV-01, PREV-02 only requires basic interaction). Optimize to Canvas later if performance issues arise.

2. **Timeline track assignment logic**
   - What we know: CardBoard-v3 uses `folder` for tracks, Timeline needs Y-axis grouping
   - What's unclear: Should tracks be user-configurable (select from LATCH facets) or hard-coded to `folder`?
   - Recommendation: Hard-code to `folder` for Phase 44. Make configurable in later phase if needed (not a requirement).

3. **Data Inspector query limits**
   - What we know: Unbounded `SELECT * FROM nodes` could return 100K+ rows and freeze UI
   - What's unclear: Should we enforce LIMIT, paginate results, or warn user?
   - Recommendation: Auto-append `LIMIT 1000` if query lacks LIMIT clause. Show warning: "Results limited to 1000 rows. Add LIMIT clause to override."

4. **Export format for query results**
   - What we know: PREV-05 requires JSON/CSV export
   - What's unclear: Export all columns or only visible? Include metadata (query, timestamp)?
   - Recommendation: Export all columns, include metadata as first row comment in CSV. JSON exports as `{ query: string, timestamp: string, results: [...] }`.

## Sources

### Primary (HIGH confidence)

- **D3.js Official Documentation**
  - [Force simulations API](https://d3js.org/d3-force/simulation) - Core simulation methods, alpha decay, forces
  - [d3-force GitHub](https://github.com/d3/d3-force) - Source code, issue discussions
- **Observable Notebooks**
  - [Force-directed graph component](https://observablehq.com/@d3/force-directed-graph-component) - Reference implementation with drag
- **CardBoard-v3 Source Code**
  - `/src/views/timeline/index.ts` - Timeline implementation patterns, zoom behavior, temporal scales
  - `/src/views/timeline.ts` - Timeline configuration and event handling
- **Isometry Codebase**
  - `/src/db/schema.sql` - LPG schema (nodes, edges tables)
  - `/src/hooks/database/useSQLiteQuery.ts` - Existing SQL query hook
  - `/src/components/notebook/PreviewComponent.tsx` - Tab structure (lines 15-110)
  - `/src/components/notebook/renderers/networkGraph.ts` - Basic network renderer (needs expansion)

### Secondary (MEDIUM confidence)

- **Web Search Results**
  - [Interactive Force-Directed Graphs with D3](https://medium.com/ninjaconcept/interactive-dynamic-force-directed-graphs-with-d3-da720c6d7811) - Drag interaction patterns
  - [D3 Selectable Force-Directed Graph](https://gist.github.com/pkerpedjiev/0389e39fad95e1cf29ce) - Selection implementation
  - [Optimizing D3.js Rendering](https://moldstud.com/articles/p-optimizing-d3js-rendering-best-practices-for-faster-graphics-performance) - Canvas vs SVG performance
  - [D3-Force Layout Optimization](https://www.nebula-graph.io/posts/d3-force-layout-optimization) - Barnes-Hut approximation, theta parameter

### Tertiary (LOW confidence - community patterns, verify before use)

- **Timeline Libraries** (evaluated but NOT recommended for adoption)
  - [d3-timeline](https://github.com/denisemauldin/d3-timeline) - Older library, pre-D3 v7
  - [patternfly-timeline](https://github.com/patternfly/patternfly-timeline) - Complex dependencies
- **Query Builders** (evaluated but NOT recommended)
  - [react-querybuilder](https://react-querybuilder.js.org/) - 200KB+, overengineered for expert users
  - [react-awesome-query-builder](https://github.com/ukrbublik/react-awesome-query-builder) - Heavy UI framework coupling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in package.json, versions verified, patterns established in codebase
- Architecture: HIGH - CardBoard-v3 reference code provides proven patterns, D3 v7 API is stable, sql.js integration is working
- Pitfalls: MEDIUM - Performance thresholds (500 nodes, 3s timeout) based on web search and experience, not empirical testing on Isometry data

**Research date:** 2026-02-10
**Valid until:** 2026-04-10 (60 days - D3.js is stable, no breaking changes expected)

**Coverage:**
- ✅ Network Graph (PREV-01, PREV-02) - Force simulation, drag, click patterns researched
- ✅ Data Inspector (PREV-03, PREV-04, PREV-05) - SQL execution, table rendering, CSV/JSON export patterns
- ✅ Timeline (PREV-06, PREV-07) - Temporal scales, zoom, date filtering patterns from CardBoard-v3
- ✅ Integration with existing Preview component tab structure
- ✅ Performance optimization strategies (Canvas threshold, simulation limits)
- ✅ sql.js query patterns for LPG schema (nodes, edges)

**Not researched (out of scope for Phase 44):**
- Web Workers for graph layout (optimization for later phase)
- Graph algorithm analytics (centrality, clustering) - covered by existing useGraphAnalytics hook
- Real-time graph updates via WebSocket - not a requirement
- Timeline animation/playback controls - not in requirements
- Advanced query features (autocomplete, syntax highlighting) - SQL textarea is sufficient
