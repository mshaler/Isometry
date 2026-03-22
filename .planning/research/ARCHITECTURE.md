# Architecture Research

**Domain:** Graph algorithm integration — v9.0 Graph Algorithms milestone
**Researched:** 2026-03-22
**Confidence:** HIGH (full codebase read, confirmed against existing patterns)

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           Main Thread (UI)                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐   │
│  │  NetworkView       │  │  AlgorithmControls │  │  WorkbenchShell        │   │
│  │  (enhanced)        │  │  (new panel)       │  │  (sidebar + explorers) │   │
│  └────────┬───────────┘  └────────┬───────────┘  └────────────────────────┘   │
│           │                       │                                            │
│  ┌────────┴───────────────────────┴───────────────────────────┐                │
│  │               StateCoordinator                             │                │
│  │  (batches provider changes into single rAF notification)   │                │
│  └────────┬────────────────────────────────────────────────────┘               │
│           │                                                                    │
│  ┌────────▼──────────────────────────────────────────────────────┐             │
│  │  Provider Layer                                               │             │
│  │  FilterProvider │ PAFVProvider │ SchemaProvider (+ metrics)   │             │
│  │  SelectionProvider │ SuperDensityProvider │ AliasProvider     │             │
│  └────────┬──────────────────────────────────────────────────────┘             │
│           │                                                                    │
│  ┌────────▼──────────────────────────────────────────────────────┐             │
│  │  WorkerBridge (singleton)                                     │             │
│  │  Typed messages, correlation IDs, rAF coalescing              │             │
│  └────────┬──────────────────────────────────────────────────────┘             │
└───────────┼────────────────────────────────────────────────────────────────────┘
            │ postMessage (structured clone boundary)
┌───────────▼────────────────────────────────────────────────────────────────────┐
│                           Web Worker                                           │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐              │
│  │  Worker Router (switch on WorkerRequestType)                 │              │
│  └──────────────┬───────────────────────────────────────────────┘              │
│                 │                                                              │
│  ┌──────────────▼───────────────────────────────────────────────┐              │
│  │  Handler Layer                                               │              │
│  │  graph.handler │ simulate.handler │ graph-algorithms.handler │              │
│  │  (NEW) computeAlgorithm(), writeMetrics(), readMetrics()     │              │
│  └──────────────┬───────────────────────────────────────────────┘              │
│                 │                                                              │
│  ┌──────────────▼───────────────────────────────────────────────┐              │
│  │  sql.js Database (WASM)                                      │              │
│  │  cards | connections | graph_metrics (NEW) | ui_state | FTS5 │              │
│  └──────────────────────────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `graph-algorithms.handler.ts` (new) | Run all 6 algorithms against live sql.js graph, write results to `graph_metrics` | NEW |
| `graph_metrics` table (new) | Persist algorithm output per card as flat numeric/string columns — queryable by PAFV | NEW |
| `SchemaProvider` (modified) | After metrics write, include `graph_metrics.*` columns in `getAxisColumns()` and `getFilterableColumns()` | MODIFIED |
| `WorkerBridge` (modified) | Add `graph:compute`, `graph:metrics-read`, `graph:metrics-stale` typed methods | MODIFIED |
| `protocol.ts` (modified) | Add 3 new `WorkerRequestType` entries + `WorkerPayloads` + `WorkerResponses` shapes | MODIFIED |
| `NetworkView` (modified) | Consume `graph_metrics` data for visual encodings: node size (centrality), fill color (community), path highlight (shortest path), edge weight (spanning tree) | MODIFIED |
| `AlgorithmControlsPanel` (new) | Workbench sidebar panel — algorithm selector, parameter inputs, Run button, stale indicator | NEW |
| `GraphMetricsExplorer` (new, optional) | Sidebar section showing per-algorithm metric summaries; histogram scrubber for centrality/PageRank distributions | NEW |

---

## Recommended Project Structure

```
src/
├── worker/
│   ├── handlers/
│   │   ├── graph-algorithms.handler.ts    # NEW — 6 algorithm implementations + metrics I/O
│   │   ├── graph.handler.ts               # EXISTING — add graph:compute routing
│   │   └── index.ts                       # MODIFIED — export new handler
│   └── protocol.ts                        # MODIFIED — 3 new request/response types
├── database/
│   ├── queries/
│   │   ├── graph.ts                       # EXISTING — connectedCards/shortestPath
│   │   └── graph-metrics.ts               # NEW — CREATE TABLE, write, read helpers
│   └── migrations.ts                      # MODIFIED — add graph_metrics DDL (or inline in handler init)
├── views/
│   └── NetworkView.ts                     # MODIFIED — algorithm visual encoding layer
├── ui/
│   └── AlgorithmControlsPanel.ts          # NEW — algorithm parameter UI + Run button
└── providers/
    └── SchemaProvider.ts                  # MODIFIED — expose graph_metrics columns post-compute
```

### Structure Rationale

- **`graph-algorithms.handler.ts` is new and isolated:** The 6 algorithms are heavy compute — keeping them in a dedicated handler prevents graph.handler.ts from becoming a monolith. The handler owns both the computation and the `graph_metrics` write, which is the correct single-responsibility boundary.
- **`graph-metrics.ts` in `queries/`:** Follows the established pattern (cards.ts, connections.ts, graph.ts). DDL helper + typed read/write functions, all accepting a `Database` parameter (no module-level state).
- **`AlgorithmControlsPanel.ts` in `ui/`:** Follows CalcExplorer/DataExplorerPanel pattern — pure TypeScript + D3/DOM, no external dependencies.
- **`SchemaProvider` modification is minimal:** One new method `injectGraphMetricsColumns()` — called after a successful `graph:compute` to append `graph_metrics.*` columns to the PRAGMA-derived schema without full re-introspection.

---

## Architectural Patterns

### Pattern 1: Worker-Side Compute + sql.js Persistence

**What:** All 6 algorithm computations run inside the Worker. The Worker reads the full graph from `connections` (via sql.js), computes results in JS, then writes back to `graph_metrics` via parameterized INSERTs. Main thread never sees raw algorithm output — only the stored metrics.

**When to use:** Any heavy computation that produces structured results consumed by PAFV. This matches how `supergrid:calc` runs GROUP BY aggregates in the Worker and never exposes intermediate SQL rows to the main thread.

**Trade-offs:** Adds ~1-30s latency for initial compute on large graphs. Acceptable because computation is on-demand (not reactive), and the stale indicator communicates staleness clearly.

**Example:**
```typescript
// In graph-algorithms.handler.ts
export function handleGraphCompute(
  db: Database,
  payload: WorkerPayloads['graph:compute'],
): WorkerResponses['graph:compute'] {
  const { algorithms, params } = payload;

  // 1. Read full graph from sql.js (no JS-side cache needed)
  const nodes = readAllCards(db);
  const edges = readAllConnections(db);

  // 2. Compute requested algorithms (pure JS, no DOM)
  const metrics = computeAlgorithms(nodes, edges, algorithms, params);

  // 3. Write results to graph_metrics (UPSERT by card_id)
  writeMetrics(db, metrics);

  // 4. Return summary counts — main thread informs SchemaProvider
  return { cardCount: nodes.length, algorithmsComputed: algorithms };
}
```

### Pattern 2: SchemaProvider Column Injection Post-Compute

**What:** After a successful `graph:compute`, the main thread calls `schemaProvider.injectComputedColumns(columnNames)`, which appends synthetic `ColumnInfo` entries for `graph_metrics` columns (e.g., `centrality`, `community_id`, `pagerank`) into the provider's column list. These immediately become available in `getAxisColumns()` and `getFilterableColumns()`, making them projectable via PAFV.

**When to use:** Computed columns that don't exist until an algorithm runs. This avoids modifying PRAGMA introspection (which only reads physical table columns) while still integrating with the allowlist/axis machinery.

**Trade-offs:** Injected columns are ephemeral — they survive in-session but require re-injection after Worker restart (new dataset load). The `graph_metrics` table persists to the checkpoint file, so re-injection on init is done by querying `PRAGMA table_info(graph_metrics)` on Worker ready, same as `cards`/`connections`.

**Example:**
```typescript
// In SchemaProvider.ts — new method
injectGraphMetricsColumns(columns: ColumnInfo[]): void {
  // Filter out any already-injected columns (idempotent)
  const existing = new Set(this._cards.map(c => c.name));
  const newCols = columns.filter(c => !existing.has(c.name));
  this._cards = [...this._cards, ...newCols];
  this._validCardColumns = new Set(this._cards.map(c => c.name));
  this._scheduleNotify(); // triggers PropertiesExplorer refresh
}
```

### Pattern 3: Stale Indicator via ui_state Timestamp

**What:** After `graph:compute`, the Worker writes `ui_state['graph_metrics:computed_at'] = ISO timestamp`. After any card/connection mutation, the main thread compares the metrics timestamp against the last mutation timestamp. If mutations occurred after the last compute, a stale banner renders in `AlgorithmControlsPanel`.

**When to use:** Any computed-derived UI state that can become stale due to data changes. Simpler than a reactive subscription because algorithm output is expensive to recompute — the user explicitly triggers recomputation.

**Trade-offs:** Does not automatically recompute. The stale indicator is an advisory, not a blocker. Users can project on stale metrics if they choose. This is the correct UX tradeoff for expensive graph algorithms.

**Example:**
```typescript
// In AlgorithmControlsPanel.ts
private _checkStale(): void {
  const computedAt = this._lastComputedAt;
  const mutatedAt = this._mutationManager.lastMutatedAt;
  const isStale = computedAt !== null && mutatedAt > computedAt;
  this._staleIndicator.classList.toggle('stale', isStale);
}
```

### Pattern 4: NetworkView Algorithm Layer (Visual Encoding)

**What:** After metrics are computed, `NetworkView.render()` uses a `_metricsMap` set by `AlgorithmControlsPanel` to map metric values to visual properties: centrality or pagerank → node radius, community_id → fill color (ordinal scale), shortest path IDs → highlighted stroke, spanning tree edges → thickened edges.

**When to use:** Any per-node scalar or categorical output that maps naturally to D3 visual channels. The existing `degreeScale` (d3.scaleSqrt) and `colorScale` (d3.scaleOrdinal) are already present — algorithm metrics slot directly into the same encoding pipeline.

**Trade-offs:** NetworkView must handle the "no metrics yet" state gracefully — fall back to degree-based sizing and card_type coloring when `graph_metrics` is empty. The `metricsAvailable` flag on the view controls this branching.

---

## Data Flow

### Algorithm Compute Flow

```
User clicks "Run" in AlgorithmControlsPanel
    ↓
AlgorithmControlsPanel.handleRun()
    ↓
bridge.send('graph:compute', { algorithms: ['pagerank', 'community', ...], params })
    ↓ (Worker)
handleGraphCompute(db, payload)
    ├── readAllCards(db)           — SELECT id FROM cards WHERE deleted_at IS NULL
    ├── readAllConnections(db)     — SELECT source_id, target_id FROM connections
    ├── computePageRank(nodes, edges, params)
    ├── computeCommunity(nodes, edges, params)
    ├── computeCentrality(nodes, edges)
    ├── computeClusteringCoefficient(nodes, edges, params)
    ├── computeShortestPathAll(nodes, edges)
    ├── computeSpanningTree(nodes, edges)
    └── writeMetrics(db, results)  — INSERT OR REPLACE INTO graph_metrics
    ↓ (response to main thread)
bridge resolves: { cardCount, algorithmsComputed }
    ↓
schemaProvider.injectGraphMetricsColumns(metricColumns)
    → StateCoordinator fires → PropertiesExplorer re-renders with new columns available
    ↓
AlgorithmControlsPanel updates stale timestamp + "last computed" label
    ↓
NetworkView.setMetrics(metricsMap, encoding) called by AlgorithmControlsPanel
    → D3 data join updates node sizes, colors, edge weights
```

### PAFV Projection Flow (After Compute)

```
User drags 'pagerank' column chip from PropertiesExplorer into ProjectionExplorer Y-axis well
    ↓
PAFVProvider.setColAxes(['pagerank'])
    → StateCoordinator fires
    → SuperGridQuery sends supergrid:query to Worker
    → Worker: SELECT gm.pagerank, COUNT(*) FROM cards c
              LEFT JOIN graph_metrics gm ON gm.card_id = c.id
              WHERE c.deleted_at IS NULL AND {FilterProvider.compile()}
              GROUP BY gm.pagerank
    → CellDatum[] returned to SuperGrid renderer
    → Nodes grouped by PageRank decile, sortable/filterable
```

### Staleness Detection Flow

```
User edits a card (MutationManager.updateCard)
    ↓
MutationManager records mutation timestamp
    ↓
AlgorithmControlsPanel subscribes to MutationManager notifications
    → compares mutation timestamp vs. graph_metrics:computed_at from ui_state
    → if mutations_after_compute: show stale banner, dim "last computed" label
```

---

## graph_metrics Table Schema

```sql
CREATE TABLE IF NOT EXISTS graph_metrics (
  card_id         TEXT PRIMARY KEY REFERENCES cards(id),

  -- Degree centrality (normalized 0..1 by graph size)
  centrality      REAL DEFAULT NULL,

  -- PageRank score (normalized, convergence at alpha=0.85, 100 iterations)
  pagerank        REAL DEFAULT NULL,

  -- Community/cluster assignment (integer label from Louvain/label propagation)
  community_id    INTEGER DEFAULT NULL,

  -- Clustering coefficient (fraction of neighbor pairs that are connected)
  clustering_coeff REAL DEFAULT NULL,

  -- Shortest path tree depth from the most-connected node (or user-selected source)
  -- NULL for nodes unreachable from source
  sp_depth        INTEGER DEFAULT NULL,

  -- Minimum spanning tree membership flag (1 = this node is in the MST)
  in_spanning_tree INTEGER DEFAULT NULL,

  -- Computed at (ISO-8601 timestamp for staleness detection)
  computed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for community grouping (PAFV GROUP BY community_id)
CREATE INDEX IF NOT EXISTS idx_gm_community ON graph_metrics(community_id);

-- Index for PageRank sorting (ORDER BY pagerank DESC)
CREATE INDEX IF NOT EXISTS idx_gm_pagerank ON graph_metrics(pagerank);
```

**Design notes:**
- `card_id` is PRIMARY KEY — `INSERT OR REPLACE` semantics keep re-runs idempotent.
- All metric columns are `DEFAULT NULL` — partial algorithm runs (e.g., only PageRank requested) leave other columns untouched.
- The table is a flat "score card" per node — no per-edge metrics rows. Edge metrics (spanning tree membership, path edges) are encoded as bitmasks or stored in `ui_state` as JSON path arrays.
- `computed_at` per row allows mixed-staleness detection if desired in future (currently all rows share one batch timestamp).
- The table must be included in `db:export` / checkpoint — it persists across sessions just like `cards` and `connections`.

---

## New Worker Message Types

Add to `WorkerRequestType` union in `src/worker/protocol.ts`:

```typescript
// Graph Algorithm Operations (v9.0)
| 'graph:compute'          // Run algorithms, write graph_metrics
| 'graph:metrics-read'     // Read metrics for given card IDs
| 'graph:metrics-clear'    // DROP + recreate graph_metrics (reset)
```

Add to `WorkerPayloads`:
```typescript
'graph:compute': {
  algorithms: Array<'pagerank' | 'centrality' | 'community' | 'clustering' | 'spanning_tree' | 'shortest_path'>;
  params?: {
    pagerank?: { alpha?: number; iterations?: number };   // defaults: 0.85, 100
    community?: { resolution?: number };                  // Louvain resolution
    clustering?: { threshold?: number };
    shortest_path?: { sourceCardId?: string };            // null = auto-select hub
  };
};

'graph:metrics-read': {
  cardIds: string[];    // IDs to fetch — subset visible in NetworkView
};

'graph:metrics-clear': Record<string, never>;
```

Add to `WorkerResponses`:
```typescript
'graph:compute': {
  cardCount: number;
  algorithmsComputed: string[];
  durationMs: number;    // for PerfTrace budget tracking
};

'graph:metrics-read': Array<{
  card_id: string;
  centrality: number | null;
  pagerank: number | null;
  community_id: number | null;
  clustering_coeff: number | null;
  sp_depth: number | null;
  in_spanning_tree: number | null;
}>;

'graph:metrics-clear': { success: boolean };
```

Add to `WorkerBridge`:
```typescript
async computeGraph(payload: WorkerPayloads['graph:compute']): Promise<WorkerResponses['graph:compute']> {
  // Extended timeout — large graphs can take 10-30s
  return this.send('graph:compute', payload, GRAPH_ALGO_TIMEOUT);  // 60_000ms
}

async readGraphMetrics(cardIds: string[]): Promise<WorkerResponses['graph:metrics-read']> {
  return this.send('graph:metrics-read', { cardIds });
}

async clearGraphMetrics(): Promise<void> {
  return this.send('graph:metrics-clear', {});
}
```

---

## SchemaProvider Integration

After `graph:compute` resolves, the main thread must inject synthetic `ColumnInfo` entries so `graph_metrics.*` columns appear in PropertiesExplorer and become assignable as PAFV axes.

The metrics columns classify into LATCH families:
- `centrality`, `pagerank`, `clustering_coeff` → `latchFamily: 'Hierarchy'` (numeric gradients — appropriate for row axes / ordering)
- `community_id` → `latchFamily: 'Category'` (discrete group label — appropriate for column axis grouping)
- `sp_depth` → `latchFamily: 'Hierarchy'`
- `in_spanning_tree` → `latchFamily: 'Attribute'` (boolean flag)

The injected `ColumnInfo` objects must have `isNumeric: true` for the REAL columns, enabling SuperCalc aggregate operations (AVG centrality, AVG pagerank across groups).

**New SchemaProvider method:**
```typescript
// Called once after graph:compute response
injectGraphMetricsColumns(): void {
  const METRIC_COLUMNS: ColumnInfo[] = [
    { name: 'centrality',       type: 'REAL',    isNumeric: true,  latchFamily: 'Hierarchy' },
    { name: 'pagerank',         type: 'REAL',    isNumeric: true,  latchFamily: 'Hierarchy' },
    { name: 'community_id',     type: 'INTEGER', isNumeric: false, latchFamily: 'Category'  },
    { name: 'clustering_coeff', type: 'REAL',    isNumeric: true,  latchFamily: 'Hierarchy' },
    { name: 'sp_depth',         type: 'INTEGER', isNumeric: true,  latchFamily: 'Hierarchy' },
    { name: 'in_spanning_tree', type: 'INTEGER', isNumeric: false, latchFamily: 'Attribute' },
  ];
  const existing = new Set(this._cards.map(c => c.name));
  const newCols = METRIC_COLUMNS.filter(c => !existing.has(c.name));
  if (newCols.length === 0) return; // already injected
  this._cards = [...this._cards, ...newCols];
  this._validCardColumns = new Set(this._cards.map(c => c.name));
  this._scheduleNotify();
}
```

**Critical:** `graph_metrics.*` columns need a JOIN when used in `supergrid:query`. The SuperGridQuery Worker handler currently queries only the `cards` table. It must be extended to LEFT JOIN `graph_metrics` when any metric column appears in the requested axes:

```sql
-- Modified supergrid:query: if any axis uses a metric column, add the JOIN
SELECT c.card_type, gm.community_id, COUNT(*) as count, ...
FROM cards c
LEFT JOIN graph_metrics gm ON gm.card_id = c.id
WHERE c.deleted_at IS NULL AND {FilterProvider.compile()}
GROUP BY c.card_type, gm.community_id
```

The SuperGridQuery builder must detect when a requested axis field name appears in the known metrics column set and inject the LEFT JOIN. This is the single most complex modification — a clean implementation adds a `metricsColumns: Set<string>` parameter to the query builder, populated from SchemaProvider.

---

## NetworkView Visual Encoding

NetworkView currently encodes:
- Node radius: `d3.scaleSqrt` on degree (edge count)
- Node color: `d3.scaleOrdinal` on `card_type`
- Edge opacity: constant

Post-algorithm, NetworkView gains a layered encoding strategy:

| Visual Channel | No Metrics | With Metrics |
|----------------|------------|--------------|
| Node radius | degree (scaleSqrt) | centrality or pagerank (scaleSqrt, user-selectable) |
| Node fill | card_type (ordinal) | community_id (ordinal, distinct palette) |
| Node stroke | selection highlight | path membership (highlighted gold, 3px) |
| Edge stroke-width | constant 1px | spanning tree edges: 2.5px; non-MST: 0.5px dimmed |
| Edge color | `var(--text-muted)` | path edges: `var(--accent)` |
| Node opacity | 1.0 | unreachable from source (sp_depth=NULL): 0.3 |

**New internal state in NetworkView:**
```typescript
private _metricsMap: Map<string, MetricsDatum> | null = null;
private _activeEncoding: 'default' | 'pagerank' | 'community' | 'path' | 'spanning_tree' = 'default';
```

After `graph:compute`, `AlgorithmControlsPanel` calls `networkView.setMetrics(metricsMap, encoding)` — the view does not fetch metrics itself. This keeps the view dumb (render-only) and the panel as the orchestrator.

**Legend panel** in NetworkView: a floating `<div class="network-legend">` appended inside the SVG container, not inside the SVG element itself (avoids coordinate system issues). Rendered via D3 data join on community colors + metric scale labels.

---

## Integration Points

### Existing Systems Modified

| Module | Change | Why |
|--------|--------|-----|
| `src/worker/protocol.ts` | +3 WorkerRequestTypes, +3 payload/response shapes | Typed bridge contract |
| `src/worker/WorkerBridge.ts` | +3 public methods: `computeGraph()`, `readGraphMetrics()`, `clearGraphMetrics()` | Client API surface |
| `src/worker/handlers/index.ts` | Export `graph-algorithms.handler.ts` | Handler registration |
| `src/worker/worker.ts` (router) | Add 3 new case branches | Route to new handler |
| `src/providers/SchemaProvider.ts` | `injectGraphMetricsColumns()` method | PAFV axis eligibility |
| `src/views/NetworkView.ts` | `setMetrics()` + encoding layer + legend | Visual encoding |
| `src/views/supergrid/SuperGridQuery.ts` | LEFT JOIN `graph_metrics` when axis field is metric column | PAFV query correctness |

### New Components

| Module | Depends On | Notes |
|--------|-----------|-------|
| `src/worker/handlers/graph-algorithms.handler.ts` | `src/database/queries/graph-metrics.ts` | All algorithm logic here |
| `src/database/queries/graph-metrics.ts` | sql.js `Database` interface | DDL + read/write helpers |
| `src/ui/AlgorithmControlsPanel.ts` | `WorkerBridge`, `SchemaProvider`, `NetworkView` | Orchestrator for compute |

---

## Suggested Build Order

Phase dependencies are strict — each step unblocks the next.

**Phase A — Storage Foundation (no UI, testable in isolation)**
1. `graph-metrics.ts` — DDL helpers, `createTable()`, `writeMetrics()`, `readMetrics()`
2. `graph_metrics` CREATE TABLE added to Worker init sequence
3. `protocol.ts` — 3 new types
4. Worker router — 3 new case branches wired to stub handlers
5. `WorkerBridge` — 3 new methods

Tests: Unit tests on `createTable()`, `writeMetrics()` round-trip, `readMetrics()` by card ID.

**Phase B — Algorithm Engine (Worker-only, no UI)**
6. `graph-algorithms.handler.ts` — all 6 algorithms + `handleGraphCompute()` + `handleGraphMetricsClear()`
7. `handleGraphMetricsRead()` — read by card IDs

Tests: Seam tests with `realDb()` factory. Each algorithm against known small graphs with verifiable expected output (path length 3, community count 2, PageRank sum approximately 1.0, etc.).

**Phase C — Schema Integration (PAFV projection)**
8. `SchemaProvider.injectGraphMetricsColumns()` — idempotent injection
9. `SuperGridQuery` — LEFT JOIN `graph_metrics` detection + injection
10. `AlgorithmControlsPanel` — Run button, parameter inputs, stale indicator (wires compute flow)

Tests: Seam test confirming `community_id` appears in `getAxisColumns()` post-injection. SuperGridQuery integration test with metric axis confirms JOIN is present in generated SQL.

**Phase D — NetworkView Enhancement**
11. `NetworkView.setMetrics()` + encoding layer (centrality scale, community palette, path highlight, MST edges)
12. Legend panel DOM construction
13. `AlgorithmControlsPanel` wired to `NetworkView.setMetrics()` after compute

Tests: NetworkView seam test with injected metricsMap confirms correct D3 attribute values on node circles. E2E: run PageRank, observe node radii change.

**Phase E — Polish + E2E**
14. Stale indicator persistence via `ui_state['graph_metrics:computed_at']`
15. On Worker re-init (new dataset load), re-inject columns from `PRAGMA table_info(graph_metrics)` if table has rows
16. E2E specs: compute flow, PAFV projection on community_id, NetworkView encoding toggle

---

## Anti-Patterns

### Anti-Pattern 1: Main-Thread Algorithm Computation

**What people do:** Run BFS/PageRank on the main thread because "it's just JavaScript."
**Why it's wrong:** Algorithm computation on large graphs (10K+ nodes, 50K+ edges) can block for 5-30 seconds. Main thread is the render thread — any block creates a frozen UI. The existing `graph:simulate` force simulation correctly runs in the Worker; algorithm computation must follow the same rule.
**Do this instead:** `graph:compute` message to Worker, extended timeout (60s), progress notifications if needed.

### Anti-Pattern 2: Storing Algorithm Results in WorkerBridge State

**What people do:** Cache algorithm results in a `Map` on the WorkerBridge or main-thread provider, skipping sql.js persistence.
**Why it's wrong:** sql.js is the system of record (D-001). Results in JS-side Maps are lost on page reload, Worker restart, dataset switch, and checkpoint restore. More critically, PAFV projection requires results to be queryable via SQL — a JS Map cannot be GROUP BY'd.
**Do this instead:** Write results to `graph_metrics` immediately. Main thread reads from the DB via `graph:metrics-read`.

### Anti-Pattern 3: Reactive Recomputation on Every Data Change

**What people do:** Subscribe to MutationManager and recompute algorithms after every card edit.
**Why it's wrong:** Algorithms are expensive (seconds to minutes on large graphs). Reactive recomputation would make every card edit 10x slower. Users don't need fresh algorithm output in real time — they need it on demand.
**Do this instead:** Stale indicator + explicit "Run" button. The stale indicator communicates that results are based on an older snapshot without blocking the user.

### Anti-Pattern 4: Modifying PRAGMA Introspection for Computed Columns

**What people do:** Try to get `graph_metrics.*` into SchemaProvider by modifying the PRAGMA query or Worker init schema message.
**Why it's wrong:** PRAGMA introspection runs before any data is loaded and before algorithms are computed. The `graph_metrics` table may be empty or non-existent at init. Adding PRAGMA results for an empty table confuses the allowlist (columns without data appear as valid axes).
**Do this instead:** `injectGraphMetricsColumns()` called only after a successful `graph:compute`. At startup, query `PRAGMA table_info(graph_metrics)` and inject only if the table has rows (i.e., a previous compute ran before checkpoint).

### Anti-Pattern 5: Encoding All Algorithms in NetworkView Simultaneously

**What people do:** Layer all visual channels at once (resize by centrality AND color by community AND highlight paths AND weight spanning tree edges) as a default.
**Why it's wrong:** Visual overload. The network becomes unreadable when four independent encodings compete. Community coloring and centrality sizing use the same visual channels as the existing card_type and degree encodings.
**Do this instead:** Single active encoding mode (`'default' | 'community' | 'pagerank' | 'path' | 'spanning_tree'`), toggled from `AlgorithmControlsPanel`. Only one mode active at a time.

---

## Scaling Considerations

| Scale | Architecture Adjustment |
|-------|------------------------|
| < 500 nodes | All 6 algorithms synchronous, no progress notifications needed. Full PageRank convergence in < 1s. |
| 500-5K nodes | PageRank / community detection may take 2-10s. Show progress spinner in `AlgorithmControlsPanel`. Consider chunked computation with `postMessage` progress notifications (matching `import_progress` pattern). |
| 5K-20K nodes | Louvain community detection is O(n log n) — stays manageable. Betweenness centrality is O(n * m) — may need to be omitted or sampled at this scale. Spanning tree (Kruskal/Prim) is O(m log m) — fine. |
| 20K+ nodes | Betweenness centrality should be approximate (random-walk approximation) or excluded from the algorithm menu. PageRank convergence may require iteration limit override. The existing 500ms graph traversal budget (PERF-04) does not apply to algorithm compute — establish a separate budget (30s hard timeout). |

### Scaling Priority

1. **First bottleneck:** Betweenness centrality on 5K+ node graphs. Solution: make it opt-in with a warning, or use degree centrality as a fast approximation (O(n) vs O(n*m)).
2. **Second bottleneck:** Writing 10K+ rows to `graph_metrics` at once. Solution: batch INSERTs in groups of 1000, same pattern as ETL `batchSize=1000`.

---

## Sources

- Codebase: `src/worker/WorkerBridge.ts` — typed message patterns, correlation IDs, extended timeout via `send()` third argument
- Codebase: `src/worker/protocol.ts` — WorkerRequestType union, WorkerPayloads/WorkerResponses shapes, existing `graph:connected` / `graph:shortestPath` / `graph:simulate` pattern
- Codebase: `src/worker/handlers/graph.handler.ts` — thin-wrapper handler pattern
- Codebase: `src/worker/handlers/simulate.handler.ts` — Worker-side compute pattern, zero DOM dependencies, pure JS algorithms
- Codebase: `src/database/queries/graph.ts` — sql.js recursive CTE patterns, parameter passing, `db.exec()` result shape
- Codebase: `src/views/NetworkView.ts` — existing visual channels (degree scale, card_type color), D3 data join with key, `positionMap`, `_metricsMap` integration point
- Codebase: `src/providers/SchemaProvider.ts` — `ColumnInfo` shape, `_cards` internal list, `_scheduleNotify()` pattern, `injectGraphMetricsColumns()` design
- Codebase: `src/providers/StateCoordinator.ts` — rAF-batched notification pattern
- PROJECT.md: v9.0 milestone requirements confirming `graph_metrics` table, PAFV integration, stale indicator, NetworkView visual encoding

---
*Architecture research for: v9.0 Graph Algorithms — integration with existing Worker Bridge, sql.js, Provider system, and NetworkView*
*Researched: 2026-03-22*
