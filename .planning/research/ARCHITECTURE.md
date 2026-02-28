# Architecture Research

**Domain:** Local-first TypeScript/D3.js in-browser SQLite data projection platform (Isometry v5)
**Researched:** 2026-02-28 (updated for v1.0 Web Runtime milestone)
**Confidence:** HIGH — architecture is fully specified in canonical docs (CLAUDE-v5.md, Contracts.md, Core/WorkerBridge.md, Core/Providers.md). This research documents integration points, data flows, and build order for the new components.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NATIVE SHELL (Swift/WKWebView)                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         WEB RUNTIME (TypeScript)                   │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │                    MAIN THREAD                              │   │  │
│  │  │                                                             │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │  │
│  │  │  │  D3.js Views │  │  Providers   │  │  State           │  │   │  │
│  │  │  │  (9 views)   │  │  (UI state)  │  │  Coordinator     │  │   │  │
│  │  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │   │  │
│  │  │         │                 │                   │             │   │  │
│  │  │         └─────────────────┴───────────────────┘             │   │  │
│  │  │                           │                                 │   │  │
│  │  │             ┌─────────────▼──────────────┐                  │   │  │
│  │  │             │       MutationManager       │                  │   │  │
│  │  │             │  (single write gate + undo) │                  │   │  │
│  │  │             └─────────────┬──────────────┘                  │   │  │
│  │  │                           │                                 │   │  │
│  │  │                  ┌────────▼────────┐                        │   │  │
│  │  │                  │  WorkerBridge   │ ← singleton, promises  │   │  │
│  │  │                  │  (proxy layer)  │                        │   │  │
│  │  │                  └────────┬────────┘                        │   │  │
│  │  └───────────────────────────┼─────────────────────────────────┘   │  │
│  │                              │ postMessage / structured clone        │  │
│  │  ┌───────────────────────────┼─────────────────────────────────┐   │  │
│  │  │                    WEB WORKER                                │   │  │
│  │  │                           │                                 │   │  │
│  │  │                  ┌────────▼────────┐                        │   │  │
│  │  │                  │ Message Router  │                        │   │  │
│  │  │                  └────────┬────────┘                        │   │  │
│  │  │          ┌────────────────┼────────────────┐                │   │  │
│  │  │          ▼                ▼                ▼                │   │  │
│  │  │  ┌──────────────┐ ┌────────────┐ ┌──────────────┐          │   │  │
│  │  │  │  sql.js      │ │ Graph      │ │  ETL         │          │   │  │
│  │  │  │  (WASM SQLite│ │ Algorithms │ │  (v1.1)      │          │   │  │
│  │  │  │  + FTS5)     │ │            │ │              │          │   │  │
│  │  │  └──────────────┘ └────────────┘ └──────────────┘          │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What Already Exists (v0.1 — COMPLETE)

The v0.1 Data Foundation is complete and validated with 151 passing tests:

| Component | File | Status |
|-----------|------|--------|
| sql.js WASM wrapper | `src/database/Database.ts` | Done |
| Schema (cards, connections, FTS5, ui_state) | `src/database/schema.sql` | Done |
| Card CRUD | `src/database/queries/cards.ts` | Done |
| Connection CRUD | `src/database/queries/connections.ts` | Done |
| FTS5 search (rowid join) | `src/database/queries/search.ts` | Done |
| Graph traversal | `src/database/queries/graph.ts` | Done |

**Known technical debt from v0.1:**
- `withStatement` pattern stubbed (throws). Database.prepare() deferred to Phase 3 of v1.0.
- Schema loading uses conditional dynamic import (node:fs vs ?raw). Works but adds branching.

---

## New Components: v1.0 Web Runtime

These components do not yet exist. The v1.0 milestone builds them in dependency order.

| Component | File | Depends On |
|-----------|------|------------|
| Worker entry | `src/worker/worker.ts` | Database.ts (query modules) |
| Message handlers | `src/worker/handlers/{db,graph}.ts` | Database.ts |
| Worker Bridge (main thread) | `src/worker/WorkerBridge.ts` | worker.ts |
| MutationManager | `src/mutations/MutationManager.ts` | WorkerBridge |
| FilterProvider | `src/providers/FilterProvider.ts` | WorkerBridge (test round-trips) |
| PAFVProvider (was AxisProvider) | `src/providers/PAFVProvider.ts` | FilterProvider |
| SelectionProvider | `src/providers/SelectionProvider.ts` | none |
| DensityProvider | `src/providers/DensityProvider.ts` | none |
| StateCoordinator | `src/providers/StateCoordinator.ts` | All providers |
| ViewManager | `src/views/ViewManager.ts` | StateCoordinator |
| SuperGrid | `src/views/SuperGrid.ts` | ViewManager, all providers |
| Remaining 8 views | `src/views/{List,Kanban,...}View.ts` | SuperGrid pattern |
| Card component | `src/components/Card.ts` | D3.js |
| Header component | `src/components/Header.ts` | D3.js |
| Explorer (LATCH filter UI) | `src/components/Explorer.ts` | FilterProvider |

---

## Component Responsibilities

| Component | What It Owns | What It Does NOT Own |
|-----------|-------------|----------------------|
| **WorkerBridge** | Promise correlation map, postMessage framing | Any sql.js logic; query assembly |
| **Message Router** | Switch on message type, call correct handler | SQL assembly; business rules |
| **sql.js (Worker)** | SQLite WASM execution, FTS5, triggers | Any UI state; serialization format |
| **FilterProvider** | LATCH filter state, WHERE clause compilation, allowlist validation | Card data; network calls |
| **PAFVProvider** | Axis-to-plane mappings, GROUP BY / ORDER BY fragments, view family suspension | Card data; SQL execution |
| **SelectionProvider** | Selected card IDs (Set), mode, anchor, focus | Persistence (Tier 3 — never writes SQLite) |
| **DensityProvider** | Density level per axis, collapsed group IDs, strftime() SQL fragment | Card data |
| **StateCoordinator** | Batches multi-provider updates, orchestrates Tier 1/2 persistence | Individual provider logic |
| **MutationManager** | Single exec() gate, undo/redo command log, dirty flag, notification scheduling | SQL assembly (delegates to callers) |
| **D3 Views** | SVG rendering, user event handling, data join lifecycle | Data storage; SQL compilation |
| **SuperGrid** | PAFV-projected nested grid, SuperStack headers, density controls | Simple list/kanban rendering |

---

## Data Flow: User Interaction to Rendered View

### Full Flow Diagram

```
User Action
(click filter, drag axis, adjust density, search)
    │
    ▼
Provider.setState()
(FilterProvider.setFilter() / PAFVProvider.setPlaneAxis() / etc.)
    │
    ▼
Provider compiles state to SQL fragment:
  FilterProvider  → { where: "folder IN (?, ?)", params: ["Work", "Inbox"] }
  PAFVProvider    → getProjectionSQL() → "GROUP BY folder, strftime('%Y-%m', created_at)"
  DensityProvider → getDensitySQL('time') → "strftime('%Y-%m', created_at)"
    │
    ▼
Provider notifies subscribers (pub/sub callback)
    │
    ▼
StateCoordinator.scheduleUpdate(source)  ← batches within 16ms frame
    │
    ▼
StateCoordinator notifies D3 Views with sources: ['filter', 'pafv', 'density']
    │
    ▼
D3 View decides action based on sources:
  'filter' or 'pafv' → requery()       ← full SQL re-execution
  'density'          → rerender()       ← re-layout with same data
  'selection'        → updateVisuals()  ← CSS class toggle, no requery
    │
    ▼ (if requery)
D3 View assembles final SQL from fragments:
  SELECT folder, strftime('%Y-%m', created_at) as month, COUNT(*) as count
  FROM cards
  WHERE [compiled where] AND deleted_at IS NULL
  GROUP BY folder, month
  ORDER BY month DESC
  LIMIT 100
    │
    ▼
WorkerBridge.query(sql, params)
  Assigns UUID, stores { resolve, reject } in pending Map
  Posts { id: UUID, type: 'db:query', payload: { sql, params } }
    │
    │ [postMessage → structured clone → Web Worker]
    │
    ▼
Message Router in worker.ts:
  switch (type) { case 'db:query': handleQuery(payload) }
    │
    ▼
sql.js execution:
  const stmt = db.prepare(sql)
  stmt.bind(params)
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()  // mandatory — prevents WASM heap leak
    │
    │ [postMessage response → structured clone → Main thread]
    │
    ▼
WorkerBridge.handleResponse():
  Looks up pending[id], resolves Promise
    │
    ▼
D3 View receives data array
    │
    ▼
D3 data join:
  svg.selectAll('g.card')
    .data(results, d => d.id)    // key function is mandatory
    .join(
      enter  => enter.append('g').call(enterCard),
      update => update.call(updateCard),
      exit   => exit.remove()
    )
    │
    ▼
Frame renders at ≤16ms
```

### Mutation Flow (Write Path)

```
User action (create, update, delete card)
    │
    ▼
MutationManager.exec(sql, params, meta)
    │
    ├──→ Generate Command:
    │       { forward: { sql, params },
    │         inverse: { /* undo SQL */ } }
    │       Push to undo stack (Tier 3, in-memory)
    │
    ├──→ WorkerBridge.exec(sql, params)
    │       posts { id: UUID, type: 'db:exec', payload: { sql, params } }
    │       sql.js: db.run(sql, params)
    │       FTS5 triggers fire automatically (insert/update/delete)
    │       Returns { changes: N }
    │
    ├──→ Set dirty flag (D-010 CloudKit debounce starts)
    │
    └──→ scheduleNotify() via requestAnimationFrame
            │
            ▼
        All subscribers notified:
          - D3 Views → requery → rerender
          - StateCoordinator → schedulePersist (Tier 1/2 state only)
```

### FTS Search Flow

```
User types in search box (debounced 150ms)
    │
    ▼
FilterProvider.setSearchQuery("project plan")
    │
    ▼
compileFilters() adds FTS clause:
  "rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)"
  params: ['"project"* "plan"*']   ← porter stemmer prefix tokens
    │
    ▼
D3 View assembles:
  SELECT c.*, bm25(cards_fts) AS rank
  FROM cards_fts
  JOIN cards c ON c.rowid = cards_fts.rowid   ← rowid join (CRITICAL)
  WHERE cards_fts MATCH ?
    AND c.deleted_at IS NULL
  ORDER BY rank
  LIMIT 50
    │
    ▼
WorkerBridge.query(sql, ['"project"* "plan"*'])
    │
    ▼
sql.js executes, returns ranked results
    │
    ▼
D3 View renders ordered by relevance
```

**FTS Critical Rule:** Join on `c.rowid = cards_fts.rowid` (INTEGER = INTEGER). Never join on `c.id = cards_fts.rowid` (TEXT = INTEGER — type mismatch, wrong results).

### Selection Flow (Ephemeral, No Requery)

```
User clicks card (with or without modifier key)
    │
    ▼
D3 View click handler:
  selectionProvider.select(d.id, {
    toggle: event.metaKey || event.ctrlKey,
    extend: event.shiftKey
  })
    │
    ▼
SelectionProvider updates Set<string> (in-memory only, Tier 3)
    │
    ▼
SelectionProvider notifies subscribers
    │
    ▼
D3 View.updateSelectionVisuals():
  svg.selectAll('g.card')
    .classed('selected', d => selectionProvider.isSelected(d.id))
    // No requery — selection is a visual overlay, not a data filter
```

### View Switch Flow

```
User clicks view type button (e.g., List → Kanban)
    │
    ▼
PAFVProvider.setViewType('kanban')
    │
    ├── If crossing LATCH ↔ GRAPH boundary:
    │     suspend current family state in Map
    │     restore target family state (or apply view defaults)
    │
    ▼
View defaults applied:
  kanban: { x: { axis: 'category', facet: 'status' },
             sort: { field: 'sort_order', direction: 'asc' } }
    │
    ▼
StateCoordinator notifies all D3 Views
    │
    ▼
ViewManager unmounts old view's D3 selections:
  .exit().transition().duration(300).attr('opacity', 0).remove()
    │
    ▼
New view queries with updated PAFVProvider SQL:
  SELECT status, id, name, priority FROM cards
  WHERE [filter where]
  ORDER BY sort_order ASC
    │
    ▼
New view renders (D3 enter selection):
  .enter().append('g').attr('opacity', 0)
    .transition().attr('opacity', 1)
    │
    ▼
Cards that survived between views animate:
  .update().transition().attr('transform', d => newPosition(d))
```

---

## Integration Points: Existing → New Components

### Database.ts Integration with Worker

The existing `Database.ts` was built for direct test access (Vitest, Node environment). In the v1.0 runtime, sql.js runs inside `worker.ts` using the same schema via `db:init` message. The `Database.ts` class is **not used** by the Web Worker — the Worker initializes sql.js directly.

| Connection | How | Notes |
|------------|-----|-------|
| `schema.sql` → Worker | Worker calls `initializeSchema()` function that runs the same DDL | Worker does not import Database.ts; it duplicates the init pattern |
| `queries/cards.ts` → Worker | Worker handlers call these pure query functions, passing the worker-local `db` instance | Query functions take a `db` param — compatible with both test and worker contexts |
| `queries/search.ts` → Worker | FTS search handler calls `search(db, query, limit)` | Same rowid join pattern works identically in both contexts |
| `queries/graph.ts` → Worker | Graph handlers call `connectedCards`, `shortestPath` | Graph algorithms run in the Worker (CPU-intensive, correct place) |

The existing query modules in `src/database/queries/` should be directly importable from `worker.ts` without modification because they take a db instance as a parameter (pure functions).

### Provider System Integration Points

```
Provider              SQL Fragment Output          Consumed By
─────────────────────────────────────────────────────────────
FilterProvider        WHERE clause                 D3 Views (assembled into SELECT)
PAFVProvider          GROUP BY + ORDER BY          D3 Views
DensityProvider       strftime() expression        D3 Views (used in SELECT and GROUP BY)
SelectionProvider     Set<string> (no SQL)         D3 Views (CSS class toggle only)
```

Providers never call `workerBridge.query()` directly. They compile SQL fragments. D3 Views receive fragments from providers, assemble the final SQL, then call `workerBridge.query()`.

### WorkerBridge Integration Points

```
WorkerBridge.query()   ← D3 Views (read data for rendering)
WorkerBridge.exec()    ← MutationManager ONLY (write path)
WorkerBridge.init()    ← App bootstrap (src/index.ts, once on startup)
WorkerBridge.export()  ← NativeShell trigger (CloudKit sync, db backup)
WorkerBridge.import()  ← NativeShell trigger (CloudKit restore)
```

### MutationManager Integration Points

```
MutationManager.exec(sql, params, meta)
  ← D3 Views (card drag-drop creates connection)
  ← Explorer component (filter UI creates/updates cards)
  ← ETL importers (batch insert via transaction)

MutationManager.subscribe(callback)
  ← All D3 Views (re-query on mutation)
  ← StateCoordinator (persist app_state after mutation)

MutationManager.undo()
  ← Keyboard handler (Cmd+Z)
MutationManager.redo()
  ← Keyboard handler (Cmd+Shift+Z)
```

---

## Recommended Project Structure

```
src/
├── index.ts                         # Entry: WorkerBridge.init(), bootstrap, app mount
│
├── database/                        # EXISTING — v0.1 complete
│   ├── schema.sql                   # Canonical DDL
│   ├── Database.ts                  # sql.js wrapper (test-only direct access)
│   └── queries/                     # Named SQL functions — pure, take (db, ...) params
│       ├── cards.ts
│       ├── connections.ts
│       ├── search.ts
│       └── graph.ts
│
├── worker/                          # NEW — v1.0
│   ├── worker.ts                    # Worker entry: sql.js init + message router switch
│   ├── WorkerBridge.ts              # Main-thread proxy: pending Map, send(), handleResponse()
│   └── handlers/                    # Message type handlers
│       ├── db.ts                    # db:init, db:query, db:exec, db:transaction, db:export
│       └── graph.ts                 # graph:shortestPath, graph:pageRank, graph:louvain
│
├── providers/                       # NEW — v1.0
│   ├── FilterProvider.ts            # LATCH filter state → WHERE clause (allowlist validated)
│   ├── PAFVProvider.ts              # Axis → plane mappings → GROUP BY + ORDER BY fragments
│   ├── SelectionProvider.ts         # Tier 3: Set<string> selected IDs (in-memory only)
│   ├── DensityProvider.ts           # Density model → strftime() SQL fragments
│   └── StateCoordinator.ts          # Batches all provider changes, orchestrates persistence
│
├── mutations/                       # NEW — v1.0
│   └── MutationManager.ts           # Single write gate: exec() + undo log + dirty flag + notify
│
├── views/                           # NEW — v1.0
│   ├── ViewManager.ts               # Mounts/unmounts active view, owns container element
│   ├── SuperGrid.ts                 # PAFV-projected nested grid (build first — most complex)
│   ├── ListView.ts                  # 1D list (build second — simplest)
│   ├── KanbanView.ts                # Category-axis columns
│   ├── CalendarView.ts              # Time-axis month view
│   ├── TimelineView.ts              # Time-axis linear
│   ├── GalleryView.ts               # Visual tile cards
│   ├── GraphView.ts                 # Force-directed (GRAPH family — separate state suspension)
│   ├── TableView.ts                 # Raw tabular (Workbench tier)
│   └── GridView.ts                  # 2D spatial tiles
│
├── components/                      # NEW — v1.0
│   ├── Card.ts                      # D3 card renderer (shared by all views)
│   ├── Header.ts                    # SuperStack dimensional headers
│   └── Explorer.ts                  # LATCH filter chrome (left sidebar)
│
└── styles/
    └── design-tokens.css            # CSS variables from D3Components.md

tests/
├── database/                        # EXISTING — 151 tests passing
├── providers/                       # NEW — FilterProvider SQL compilation, injection rejection
├── mutations/                       # NEW — MutationManager notify, command log
├── worker/                          # NEW — Message Router handlers (mock sql.js db)
├── views/                           # NEW — D3 data join correctness, key functions
└── integration/                     # NEW — WorkerBridge → sql.js round trips
```

### Structure Rationale

- **`worker/WorkerBridge.ts` in the `worker/` folder:** Both the bridge (main thread) and the worker entry point live together because they are tightly coupled by the message protocol. They share type definitions.
- **`mutations/MutationManager.ts` separate from providers:** MutationManager is the single write gate for all entity mutations — it is not a UI state provider. Keeping it separate prevents accidental direct writes from provider code.
- **`providers/StateCoordinator.ts` owns persistence:** StateCoordinator reads from Filter/PAFV/Density providers but does not own their state. It observes all providers and persists to SQLite. Selection is explicitly excluded.
- **`queries/` pure functions:** Query modules take `(db: Database, ...)` parameters. This makes them directly importable from `worker.ts` without any wrapper, and testable without a Worker.

---

## Architectural Patterns

### Pattern 1: Query-on-Demand (No Parallel Store)

**What:** D3 views do not maintain a JS-side copy of card data. They query sql.js fresh on every relevant state change and bind results directly to D3 data joins.

**When to use:** Always. Maintaining a JS-side card store that mirrors SQLite creates two sources of truth.

**Trade-offs:** All data reads are async. No synchronous card lookup from the main thread. Acceptable because WorkerBridge query latency is <5ms for typical result sets.

**Example:**
```typescript
class ListView {
  private data: Card[] = [];

  constructor(
    private coordinator: StateCoordinator,
    private filterProvider: FilterProvider,
    private bridge: WorkerBridge
  ) {
    coordinator.subscribe(async (sources) => {
      if (sources.includes('filter') || sources.includes('pafv')) {
        await this.requery();
      }
      if (sources.includes('selection')) {
        this.updateSelectionVisuals();
      }
    });
  }

  private async requery(): Promise<void> {
    const { where, params } = this.filterProvider.getCompiledSQL();
    this.data = await this.bridge.query<Card>(
      `SELECT id, name, folder, status, priority, modified_at
       FROM cards WHERE ${where}
       ORDER BY modified_at DESC LIMIT 100`,
      params
    );
    this.render();
  }

  private render(): void {
    this.svg.selectAll<SVGGElement, Card>('g.card')
      .data<Card>(this.data, (d: Card) => d.id)  // key function mandatory
      .join('g');
  }
}
```

### Pattern 2: Providers Compile, Views Assemble, Workers Execute

**What:** Providers produce SQL fragments (`{ where, params }`, `GROUP BY ...`, strftime expressions). D3 Views are responsible for assembling the final SQL from multiple fragments. The Web Worker executes the final SQL.

**When to use:** Always. Never let providers call workerBridge.query() for rendering data.

**Trade-offs:** Views contain query assembly logic. This is intentional — each view knows its own SELECT shape, aggregation, and LIMIT.

**Example:**
```typescript
// Provider produces fragment
const { where, params } = filterProvider.getCompiledSQL();
// → { where: "deleted_at IS NULL AND folder IN (?)", params: ["Work"] }

const densityExpr = densityProvider.getDensitySQL('time');
// → "strftime('%Y-%m', created_at)"

// View assembles final SQL
const results = await bridge.query<AggregatedCell>(
  `SELECT folder, ${densityExpr} as month, COUNT(*) as count
   FROM cards WHERE ${where}
   GROUP BY folder, month
   ORDER BY month DESC`,
  params
);
```

### Pattern 3: MutationManager as Single Write Gate

**What:** All entity writes go through `MutationManager.exec()`. This is the only component that calls `workerBridge.exec()` (the write method). D3 Views must not call `workerBridge.exec()` directly.

**When to use:** Any INSERT / UPDATE / DELETE on `cards` or `connections`.

**Trade-offs:** One extra call per write. Necessary for undo/redo command log, dirty flag, and batched subscriber notification.

**Example:**
```typescript
// Correct: always goes through MutationManager
await mutations.exec(
  'UPDATE cards SET status = ?, modified_at = datetime("now") WHERE id = ?',
  ['done', cardId],
  { tables: new Set(['cards']), operation: 'update', affectedIds: [cardId] }
);
// Automatically: inverse command generated, dirty flag set, subscribers notified
```

### Pattern 4: WorkerBridge Promise Correlation

**What:** Every outgoing message gets a UUID stored in a `pending` Map. Incoming responses look up the UUID and resolve the stored promise. Multiple concurrent queries are safe.

**When to use:** Internal WorkerBridge implementation. Callers just `await bridge.query()`.

**Example:**
```typescript
private send<T>(type: MessageType, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    this.pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
      startTime: performance.now()
    });
    this.worker.postMessage({ id, type, payload, timestamp: Date.now() });
  });
}

private handleResponse(response: WorkerResponse): void {
  const handler = this.pending.get(response.id);
  if (!handler) return;
  this.pending.delete(response.id);
  if (response.status === 'success') handler.resolve(response.payload);
  else handler.reject(new Error(String(response.payload)));
}
```

### Pattern 5: D3 Data Join with Stable Key Function

**What:** Every `.data()` call supplies a key function. For card arrays it is `d => d.id`. For aggregated cells it is `d => d.groupKey`.

**When to use:** Every D3 rendering call in the entire codebase without exception.

**Trade-offs:** Slightly more code. Essential for correct animated transitions between views and filter changes.

**Example:**
```typescript
// Correct — stable element identity across renders
svg.selectAll<SVGGElement, Card>('g.card')
  .data<Card>(cards, (d: Card) => d.id)
  .join(
    enter => enter.append('g').call(enterCard),
    update => update.call(updateCard),
    exit => exit.remove()
  );

// Wrong — index-based matching causes cards to animate to wrong positions
svg.selectAll('g.card')
  .data(cards)  // missing key function
  .join('g');
```

### Pattern 6: Three-Tier Notification Routing

**What:** The StateCoordinator passes the `sources` array to view callbacks. Views use this to decide what action to take: full requery, re-render only, or visual-only update. This avoids unnecessary SQL round-trips.

**When to use:** Always route through StateCoordinator. Never subscribe directly to individual providers from views.

**Example:**
```typescript
coordinator.subscribe(async (sources) => {
  if (sources.includes('filter') || sources.includes('pafv')) {
    await this.requery();      // new SQL, new data
  } else if (sources.includes('density')) {
    this.rerender();            // same data, new layout
  } else if (sources.includes('selection')) {
    this.updateSelectionVisuals();  // CSS class toggle only
  }
});
```

---

## Component Dependency Graph (Build Order)

The components form a strict dependency DAG. Build bottom-up.

```
[EXISTING]
src/database/schema.sql
src/database/Database.ts
src/database/queries/{cards,connections,search,graph}.ts
        │
        │  ← all new components depend on these
        ▼
[PHASE 1 — Worker Entry + Bridge]
src/worker/worker.ts              ← imports query modules
src/worker/handlers/{db,graph}.ts ← query handlers call query functions
src/worker/WorkerBridge.ts        ← main-thread proxy, depends on worker.ts at runtime
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
[PHASE 2A — Providers]             [PHASE 2B — MutationManager]
src/providers/FilterProvider.ts    src/mutations/MutationManager.ts
src/providers/PAFVProvider.ts
src/providers/SelectionProvider.ts
src/providers/DensityProvider.ts
src/providers/StateCoordinator.ts
        │
        ▼
[PHASE 3 — Views]
src/views/ViewManager.ts
src/views/SuperGrid.ts     ← build first (most complex)
src/views/ListView.ts      ← build second (simplest)
src/views/KanbanView.ts
src/views/CalendarView.ts
src/views/TimelineView.ts
src/views/GalleryView.ts
src/views/GraphView.ts
src/views/TableView.ts
src/views/GridView.ts
src/components/{Card,Header,Explorer}.ts
        │
        ▼
[PHASE 4 — Native Shell]
native/swift/...  ← wraps completed web runtime
```

### Parallel Build Opportunities

Within Phase 2, `FilterProvider` and `SelectionProvider` have no dependency on each other. `DensityProvider` is also independent. These can be built in parallel once `WorkerBridge` exists.

Within Phase 3, view order is flexible after `SuperGrid`. The view pattern is established by `SuperGrid` and `ListView`. Remaining views are incremental.

---

## Data Flow Summary: State Types

| Data Type | Source of Truth | Persists | Notes |
|-----------|----------------|---------|-------|
| Cards, Connections | sql.js (Worker) | Tier 1: SQLite `cards`/`connections` | Never duplicated in JS |
| Filter state | FilterProvider (Main) | Tier 1: `app_state` table | Column allowlist enforced on every compile |
| Axis/View state | PAFVProvider (Main) | Tier 2: `view_state` table (per LATCH/GRAPH family) | Suspended when switching families |
| Density state | DensityProvider (Main) | Tier 1: `app_state` table | strftime() expression level |
| Selection | SelectionProvider (Main) | NEVER — Tier 3 ephemeral | In-memory Set only |
| Undo/Redo stack | MutationManager (Main) | NEVER — Tier 3 ephemeral | Cleared on sync conflict |
| Dirty flag | MutationManager (Main) | NEVER — drives CloudKit debounce | 2s debounce, immediate on background |
| App_state JSON | StateCoordinator → sql.js | Tier 1: `app_state` table | Filter + PAFV + Density serialized |

### Notification Topology

```
MutationManager (write completes)
    │ scheduleNotify() via requestAnimationFrame
    ├──→ D3 View 1 → requery → render
    ├──→ D3 View 2 → requery → render (if mounted)
    └──→ StateCoordinator → persist app_state (Tier 1/2 only)

FilterProvider (state change)
    │ notify()
    └──→ StateCoordinator.scheduleUpdate('filter')
              │ 16ms batch window
              └──→ Views.callback(['filter']) → requery → render

SelectionProvider (state change)
    │ notify()
    └──→ StateCoordinator.scheduleUpdate('selection')
              │
              └──→ Views.callback(['selection']) → updateSelectionVisuals() only
```

---

## Anti-Patterns

### Anti-Pattern 1: Parallel Entity Store

**What people do:** Build a `cardStore = new Map<string, Card>()` on the main thread that mirrors SQLite data.

**Why it's wrong:** Double memory (WASM heap + JS heap); stale data when Worker writes; sync complexity that grows with every query path. sql.js is already an indexed in-memory store.

**Do this instead:** Query sql.js fresh on each notification. WorkerBridge latency is <5ms for typical result sets.

### Anti-Pattern 2: Raw SQL Strings from Providers

**What people do:** `FilterProvider.toSQL()` returns `"SELECT * FROM cards WHERE folder = 'Work'"` (a full SQL string with values embedded).

**Why it's wrong:** Even with parameterized values, passing unvalidated column names from user input enables SQL injection via column name. `filterProvider.setFilter({ field: "'; DROP TABLE cards;--", ...})` would produce malformed SQL that could be interpreted differently depending on db engine version.

**Do this instead:** Column names are validated against `ALLOWED_FILTER_COLUMNS` (a TypeScript `Set`) before any SQL fragment is produced. Values are always `?` placeholders. The fragment is `{ where: string; params: unknown[] }` — never a complete SQL string.

### Anti-Pattern 3: Providers Calling workerBridge.query() for Rendering

**What people do:** `FilterProvider.getFilteredCards()` calls `workerBridge.query(...)` and returns `Card[]` to views.

**Why it's wrong:** Providers would own both SQL compilation and data fetching. Views lose the ability to customize SELECT, aggregation, LIMIT, and joins. The separation between "what to query" (Provider) and "how to render it" (View) breaks down.

**Do this instead:** Providers produce SQL fragments only. Views call `workerBridge.query()` with the assembled SQL.

### Anti-Pattern 4: Direct workerBridge.exec() from Views

**What people do:** A view calls `workerBridge.exec('UPDATE cards SET status = ? WHERE id = ?', [...])` directly on user drag-drop.

**Why it's wrong:** Bypasses MutationManager, so: no undo command generated, no dirty flag set, no subscriber notification, no CloudKit debounce triggered.

**Do this instead:** All writes go through `MutationManager.exec()`. No exceptions.

### Anti-Pattern 5: FTS Join on `id` Column

**What people do:** `JOIN cards c ON c.id = fts.rowid`

**Why it's wrong:** `cards.id` is TEXT (UUID string). `cards_fts.rowid` is INTEGER. The type mismatch produces incorrect results silently in SQLite.

**Do this instead:** `JOIN cards c ON c.rowid = cards_fts.rowid` — both are INTEGER.

### Anti-Pattern 6: Persisting Selection

**What people do:** Save `selectionProvider.getSelectedIds()` to the `ui_state` or `app_state` table.

**Why it's wrong:** Selection is Tier 3 (ephemeral) per D-005. Persisted selection references card IDs that may have been deleted or moved. Restoring stale selection is worse than having none.

**Do this instead:** `SelectionProvider` is in-memory only. On navigation or app restart, selection is empty.

### Anti-Pattern 7: Missing D3 Key Function

**What people do:** `.data(cards).join('g')` without a second argument.

**Why it's wrong:** D3 matches elements to data by array index. On any reorder, filter, or sort, cards animate to the wrong positions and DOM nodes are unnecessarily destroyed and recreated.

**Do this instead:** Always supply `.data(cards, d => d.id)`.

### Anti-Pattern 8: Many Small postMessage Calls in a Loop

**What people do:** ETL importer calls `workerBridge.exec()` per card inside a loop.

**Why it's wrong:** Each round-trip incurs serialization + scheduling overhead. 1000 calls x ~2ms = 2 seconds of overhead before any sql.js execution time.

**Do this instead:** `workerBridge.transaction([...operations])` to batch all inserts into one message.

---

## Integration Points Summary

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main thread ↔ Web Worker | postMessage / structured clone | WorkerBridge owns all crossing — no raw postMessage elsewhere |
| Provider → View | StateCoordinator pub/sub callbacks | 16ms batch window; callbacks receive `sources: string[]` |
| View → sql.js (reads) | `workerBridge.query()` (async) | Views hold query results only until next notification |
| View → sql.js (writes) | `mutations.exec()` → `workerBridge.exec()` | MutationManager is the mandatory intermediary |
| MutationManager → D3 Views | `requestAnimationFrame` batched notify | Coalesces rapid mutations into one notification cycle |
| StateCoordinator → sql.js | `workerBridge.exec('INSERT OR REPLACE INTO app_state...')` | Tier 1/2 state persists; Tier 3 (Selection) explicitly never persists |
| ETL → sql.js | `workerBridge.transaction([])` (batched) | Always batch, never per-row exec |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| CloudKit | `workerBridge.exportDatabase()` → ArrayBuffer → NativeShell | Worker exports binary db; Swift handles sync. Triggered by dirty flag + D-010 lifecycle |
| Apple Keychain | NativeShell message handler → WorkerBridge response | JavaScript requests credential via WKWebView messageHandler — never stores in SQLite |
| WKWebView | Swift injects JS handlers for native bridge messages | Used for Keychain, db import/export, app lifecycle events |
| Apple Notes / Slack / etc. | ETL parsers (v1.1 milestone) | Swift extracts data, passes to `etl:import` message |

---

## Scaling Considerations

This is a local-first single-user app. Scale means database size, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10K cards | Default approach — all queries <10ms, no optimization needed |
| 10K–100K cards | Enforce LIMIT in all view queries; use FTS for search (not LIKE); check partial index usage with EXPLAIN QUERY PLAN |
| 100K+ cards | Virtual scrolling in D3 views; paginate ETL inserts (chunks of 500); lazy-load graph traversal results |

### First Performance Bottleneck: D3 Visible Element Count

D3 SVG rendering degrades above ~500 actively animated elements. The `DensityProvider` and `LIMIT` clause naturally control this. SuperGrid aggregates cards into cells (typically 50–200 visible cells, not 10K cards). For the Graph view, run force simulation in the Worker and post only stable `{id, x, y}` positions to the main thread.

### Second Performance Bottleneck: WorkerBridge Serialization

Posting full card objects (including `content` text field) for list rendering is wasteful. Project minimal fields in SQL: `SELECT id, name, status, priority, modified_at FROM cards WHERE...`. Never select `content` for bulk view queries — fetch `content` on-demand for the detail/notebook view only.

---

## Sources

- Isometry v5 canonical specifications (HIGH confidence — project's own locked decisions):
  - `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md` (D-001 through D-010, all final)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md` (types, schema, safety rules)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md` (canonical protocol + implementation)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md` (provider pattern, StateCoordinator, MutationManager)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SuperGrid.md` (PAFV projection, SuperStack headers)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Views.md` (9 view types, D3 patterns)
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/D3Components.md` (design system, component patterns)
- `/Users/mshaler/Developer/Projects/Isometry/src/database/Database.ts` (existing implementation, v0.1)
- `.planning/research/PITFALLS.md` (integration gotchas, verified against official docs)

---

*Architecture research for: local-first TypeScript/D3.js data projection platform (Isometry v5 — v1.0 Web Runtime)*
*Researched: 2026-02-28*
