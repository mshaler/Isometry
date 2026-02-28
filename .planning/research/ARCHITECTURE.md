# Architecture Research

**Domain:** Local-first in-browser SQLite + D3.js visualization platform (Isometry v5)
**Researched:** 2026-02-27
**Confidence:** HIGH — architecture is fully specified in canonical docs (CLAUDE-v5.md, Contracts.md, WorkerBridge.md, Providers.md). This research validates and documents those decisions.

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
│  │  │  │  (11 views)  │  │  (UI state)  │  │  Coordinator     │  │   │  │
│  │  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │   │  │
│  │  │         │                 │                   │             │   │  │
│  │  │         └─────────────────┴───────────────────┘             │   │  │
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
│  │  │  │  (WASM SQLite│ │ Algorithms │ │  Importers   │          │   │  │
│  │  │  │  + FTS5)     │ │            │ │              │          │   │  │
│  │  │  └──────────────┘ └────────────┘ └──────────────┘          │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### What Talks to What

| Component | Responsibility | Communicates With | Layer |
|-----------|----------------|-------------------|-------|
| **D3.js Views** | Render cards as SVG/canvas, handle user input events | WorkerBridge (queries), Providers (UI state subscription) | Main thread |
| **FilterProvider** | Hold LATCH filter state, compile WHERE clauses, validate columns against allowlist | StateCoordinator (subscription), WorkerBridge (indirectly via views) | Main thread |
| **PAFVProvider** | Hold axis-to-plane mapping state, generate GROUP BY / ORDER BY SQL fragments | StateCoordinator (subscription) | Main thread |
| **SelectionProvider** | Hold selected card IDs (Tier 3, ephemeral) — never queries or persists | D3 views (subscribe to visual updates) | Main thread |
| **DensityProvider** | Hold density model state, generate strftime() SQL fragments | StateCoordinator (subscription) | Main thread |
| **StateCoordinator** | Batch cross-provider updates in 16ms frame, orchestrate persistence | All Providers (subscribes), WorkerBridge (persists app_state) | Main thread |
| **MutationManager** | Single write path: exec() then notify subscribers | WorkerBridge (delegates exec), D3 views (subscribers) | Main thread |
| **WorkerBridge** | Promise-based proxy to Web Worker. Correlates requests/responses by UUID | Web Worker (postMessage) | Main thread |
| **Message Router** | Dispatch incoming messages to correct handler by type | sql.js, Graph handlers, ETL handlers | Web Worker |
| **sql.js (WASM)** | Execute all SQL: SELECT, INSERT, UPDATE, DELETE, FTS5 MATCH | Message Router | Web Worker |
| **Graph Algorithms** | PageRank, Louvain, shortest path (BFS via recursive CTE or JS) | sql.js (read-only queries), Message Router | Web Worker |
| **ETL Importers** | Map source data (Apple Notes, Slack, etc.) to CanonicalCard, batch insert | sql.js (batch writes), Message Router | Web Worker |
| **NativeShell (Swift)** | WKWebView host, Keychain credential storage, CloudKit sync | WorkerBridge (db:export/import messages), JavaScript message handlers | Native |

### Strict Boundary Rules

1. **No raw SQL crosses the WorkerBridge.** Providers compile SQL fragments; the Message Router assembles them with hardcoded table names only.
2. **No entity data lives on the main thread long-term.** D3 views hold current query results only until the next render cycle.
3. **No parallel store.** D3's data join IS state management. MobX/Redux/Zustand must not duplicate SQLite data.
4. **Credentials never in sql.js.** NativeShell Keychain bridge only.
5. **Selection never in sql.js.** SelectionProvider is in-memory Tier 3 only.

---

## Where sql.js Lives: Worker Thread

**Decision: sql.js runs entirely in the Web Worker.** This is locked (D-002).

### Implications

| Concern | Impact | Mitigation |
|---------|--------|------------|
| All queries are async | No synchronous reads from D3 views | Promise-based WorkerBridge; views subscribe to notifications then re-query |
| postMessage serialization overhead | ~2.5ms per 10K-row result transfer (structured clone) | Return only projected fields, paginate large results, use LIMIT in queries |
| WASM initialization | sql.js WASM loads once in worker thread on `db:init` | Initialize before any view rendering; show loading state |
| ArrayBuffer export for CloudKit | Database export transfers large binary | Use transferable objects (transfer list) instead of structured clone copy |
| Worker crash | Pending promises reject | WorkerBridge onerror handler; attempt restart, reject pending |
| Testing | Workers not available in Node.js/Vitest by default | Test handlers in isolation with mocked db; integration test via worker mock |

### Why Worker (Not Main Thread)

sql.js WASM executes CPU-intensive operations — graph traversals, FTS matching, bulk ETL inserts. Running on the main thread would block the browser's rendering pipeline, causing dropped frames and frozen UI. The Worker thread keeps rendering at 60fps while queries execute. The postMessage overhead (sub-millisecond for typical row counts) is acceptable because queries are batched within animation frames via the StateCoordinator.

---

## Data Flow

### 1. Query Execution Flow

```
User action (click filter, change view)
    │
    ▼
Provider.setState()          ← e.g., FilterProvider.setFilter()
    │
    ▼
StateCoordinator             ← batches changes within 16ms frame
    │
    ▼
notify(sources: string[])    ← sources = ['filter', 'pafv', etc.]
    │
    ▼
D3 View.requery()            ← triggered only for relevant source changes
    │
    ▼
FilterProvider.getCompiledSQL()    ← { where: "folder IN (?, ?)", params: ["Work", "Inbox"] }
PAFVProvider.getProjectionSQL()    ← GROUP BY + ORDER BY fragment
DensityProvider.getDensitySQL()    ← strftime('%Y-%m', created_at) fragment
    │
    ▼
WorkerBridge.query(sql, params)    ← assembles final SQL, sends postMessage
    │
    ▼
  [postMessage → Web Worker]
    │
    ▼
Message Router (type: 'db:query')
    │
    ▼
sql.js db.prepare(sql).bind(params).getAsObject()  ← WASM execution
    │
    ▼
  [postMessage response → Main thread]
    │
    ▼
WorkerBridge resolves Promise
    │
    ▼
D3 View.render(data)               ← .data(results, d => d.id).join(...)
```

### 2. Mutation + Notification Flow

```
User action (create card, update card)
    │
    ▼
MutationManager.exec(sql, params, meta)
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
WorkerBridge.exec()                   Command generated
(db:exec message)                     { forward, inverse } for undo stack
    │
    ▼
sql.js db.run()                       FTS triggers fire automatically
    │                                 (cards_fts_insert, _update, _delete)
    ▼
WorkerBridge resolves { changes: N }
    │
    ▼
MutationManager.scheduleNotify()      ← batches with requestAnimationFrame
    │
    ▼
All subscribers notified              ← D3 views, StateCoordinator
    │
    ▼
D3 Views re-query and re-render
    │
    ▼
StateCoordinator.schedulePersist()    ← writes app_state to SQLite after 16ms
    │
    ▼
MutationManager dirty flag set        ← triggers CloudKit debounce (2s)
```

### 3. FTS Search Flow

```
User types in search box
    │
    ▼
FilterProvider.setSearchQuery(query)
    │
    ▼
compileFilters() adds clause:
  "rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)"
  params: ['"query"*']           ← porter stemmer prefix match
    │
    ▼
WorkerBridge.query(assembledSQL, params)
    │
    ▼
sql.js executes:
  SELECT c.*, bm25(cards_fts) AS rank
  FROM cards_fts
  JOIN cards c ON cards_fts.rowid = c.rowid   ← CRITICAL: rowid not id
  WHERE cards_fts MATCH ?
    AND c.deleted_at IS NULL
  ORDER BY rank
  LIMIT ?
    │
    ▼
Results returned, ranked by relevance
    │
    ▼
D3 View renders ranked results
```

**FTS Critical Rule:** Always join on `rowid` (INTEGER), never on `id` (TEXT). The FTS5 content table uses rowid as the link to the source table. Joining on `id` produces a type mismatch.

### 4. View Transition Flow

```
User clicks view switcher (e.g., List → Kanban)
    │
    ▼
PAFVProvider.setViewType('kanban')
    │
    ├── If crossing LATCH↔GRAPH boundary:
    │   suspend current family state
    │   restore target family state (or defaults)
    │
    ▼
PAFVProvider applies view defaults:
  kanban: { x: { axis: 'category', facet: 'status' }, sort: 'sort_order ASC' }
    │
    ▼
StateCoordinator notifies D3 Views
    │
    ▼
Old view exits (D3 exit selection):
  selection.exit()
    .transition().duration(300)
    .attr('opacity', 0)
    .remove()
    │
    ▼
WorkerBridge.query() with new SQL projection
    │
    ▼
New view enters with data (D3 enter + update selection):
  selection.data(newData, d => d.id)   ← key function: stable card identity
    .join(
      enter => enter.append('g').attr('opacity', 0)
                    .transition().attr('opacity', 1),
      update => update.transition()   ← cards that persist animate to new position
                      .attr('transform', d => newPosition(d)),
      exit => exit.transition().remove()
    )
```

**D3 Key Function Rule:** Always supply `d => d.id` as the key function. Without it, D3 assigns elements by index position, causing wrong cards to animate to wrong positions during view transitions.

### 5. Provider-to-SQL Compilation Flow

```
FilterProvider state:
  { filters: { category: { field: 'folder', values: ['Work'] },
               time: { field: 'created_at', relative: 'this_week' } },
    searchQuery: 'project' }
    │
    ▼
compileFilters() → validates each field against ALLOWED_FILTER_COLUMNS set
    │
    ├── 'folder' → allowed ✓ → "folder IN (?)"   params: ['Work']
    ├── 'created_at' → allowed ✓ → "created_at >= ?"   params: ['2026-02-20']
    └── searchQuery → "rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)"
                       params: ['"project"*']
    │
    ▼
{ where: "deleted_at IS NULL AND folder IN (?) AND created_at >= ? AND rowid IN (...)",
  params: ['Work', '2026-02-20', '"project"*'] }
    │
    ▼
PAFVProvider.getProjectionSQL() → "GROUP BY folder, strftime('%Y-%m', created_at)"
DensityProvider.getDensitySQL() → strftime expression for current density level
    │
    ▼
Final query assembled in D3 View:
  SELECT folder, strftime('%Y-%m', created_at) as month, COUNT(*) as count
  FROM cards
  WHERE [compiled where clause]
  GROUP BY folder, month
  ORDER BY modified_at DESC
  LIMIT 100
    │
    ▼
WorkerBridge.query(finalSQL, compiledParams)
```

**SQL Safety Boundary:** Providers produce fragments; they never produce full SQL strings. Column names come from a validated allowlist (`ALLOWED_FILTER_COLUMNS`). Values are always `?` placeholders. Table names are hardcoded in the D3 view or Message Router — never derived from user input.

---

## Recommended Project Structure

```
src/
├── index.ts                         # Entry point, WorkerBridge init, app bootstrap
│
├── database/
│   ├── schema.sql                   # Canonical DDL (cards, connections, FTS5, indexes, triggers)
│   ├── Database.ts                  # sql.js wrapper (for test-only, direct db access)
│   └── queries/                     # Named SQL fragments (not classes — pure functions)
│       ├── cards.ts                 # createCard, getCard, updateCard, deleteCard, listCards
│       ├── connections.ts           # createConnection, getConnections, deleteConnection
│       ├── search.ts                # search() — FTS5 rowid join pattern
│       └── graph.ts                 # connectedCards, shortestPath (uses recursive CTE)
│
├── providers/
│   ├── FilterProvider.ts            # LATCH → WHERE clause + allowlist validation
│   ├── PAFVProvider.ts              # Axis → plane mapping, view family state suspension
│   ├── SelectionProvider.ts         # Tier 3: selected card IDs (in-memory only)
│   ├── DensityProvider.ts           # Janus density model, header collapse state
│   └── StateCoordinator.ts          # Batches updates, orchestrates persistence
│
├── mutations/
│   └── MutationManager.ts           # Single write path: exec() + notify + command log
│
├── worker/
│   ├── main.worker.ts               # Web Worker entry: sql.js init + message router
│   └── handlers/
│       ├── db.ts                    # db:init, db:exec, db:query, db:transaction, db:export
│       ├── graph.ts                 # graph:shortestPath, graph:pageRank, graph:louvain
│       └── etl.ts                   # etl:import, etl:export (dispatches to ETL modules)
│
├── bridge/
│   └── WorkerBridge.ts              # Main-thread proxy: pending Map, postMessage, promises
│
├── views/
│   ├── ViewManager.ts               # Mounts/unmounts views, owns SVG container
│   ├── SuperGrid.ts                 # PAFV-projected nested grid (primary view)
│   ├── ListView.ts                  # Single-axis LATCH list
│   ├── KanbanView.ts                # Category-axis status columns
│   ├── CalendarView.ts              # Time-axis month view
│   ├── TimelineView.ts              # Time-axis linear view
│   ├── GalleryView.ts               # Visual card tiles
│   ├── GraphView.ts                 # Force-directed D3 (GRAPH family)
│   ├── TableView.ts                 # Raw tabular (Workbench tier)
│   └── transitions/
│       └── ViewTransition.ts        # Enter/exit animations between views
│
├── components/
│   ├── Card.ts                      # D3 card rendering (shared across views)
│   ├── Header.ts                    # SuperStack dimensional headers
│   └── Explorer.ts                  # LATCH filter UI (FilterNav chrome)
│
└── etl/
    ├── AppleNotes.ts                # Apple Notes → CanonicalCard
    ├── AppleReminders.ts            # Apple Reminders → CanonicalCard (task type)
    ├── AppleCalendar.ts             # Calendar events → CanonicalCard (event type)
    ├── Slack.ts                     # Slack messages → CanonicalCard (note type)
    └── canonical.ts                 # CanonicalCard interface, shared mappers

tests/
├── database/                        # Unit: schema, CRUD, FTS, graph queries
├── providers/                       # Unit: SQL compilation, allowlist, tier behavior
├── mutations/                       # Unit: MutationManager notify + command log
├── worker/                          # Unit: Message Router handlers (mock sql.js)
├── views/                           # Unit: D3 data join correctness, key functions
└── integration/                     # Integration: WorkerBridge → sql.js round trips
```

### Structure Rationale

- **`database/queries/`:** Pure functions over a db instance, not classes. This makes them trivially testable without a Worker.
- **`bridge/WorkerBridge.ts` separate from `worker/`:** The bridge is main-thread code; the worker is a separate entry point compiled separately by Vite.
- **`mutations/MutationManager.ts` separate from providers:** MutationManager is the single write gate for all entity mutations — separate from UI state providers to prevent accidental direct writes.
- **`views/transitions/`:** Isolated because view transition logic involves cross-view coordination (knowing both old and new view shapes).

---

## Architectural Patterns

### Pattern 1: Query-on-Demand, Not Store-on-Sync

**What:** D3 views do not maintain a copy of entity data. They query sql.js fresh on each notification and bind the result directly to D3's data join.

**When to use:** Always. The anti-pattern (maintaining a JS-side card store that mirrors SQLite) creates two sources of truth and sync complexity.

**Trade-offs:** Slightly more async code paths; no lookup by ID from the main thread without a round-trip. Acceptable because sql.js query latency is <10ms for typical result sets.

**Example:**
```typescript
// Correct: re-query on every relevant state change
class ListView {
  constructor() {
    mutations.subscribe(() => this.requery());
    filterProvider.subscribe(() => this.requery());
  }

  private async requery(): Promise<void> {
    const { where, params } = filterProvider.getCompiledSQL();
    this.data = await workerBridge.query<Card>(
      `SELECT * FROM cards WHERE ${where} ORDER BY modified_at DESC LIMIT 100`,
      params
    );
    this.render();
  }

  private render(): void {
    this.svg.selectAll('g.card')
      .data(this.data, d => d.id)   // key function is mandatory
      .join('g');
  }
}
```

### Pattern 2: Providers Compile, Workers Execute

**What:** Providers hold UI state and compile it to SQL fragments. The Web Worker executes the assembled SQL. No business logic lives in the bridge itself.

**When to use:** Always. Providers never call workerBridge directly for data; they produce fragments that views pass to workerBridge.

**Trade-offs:** Views must assemble the final query by combining fragments from multiple providers. The assembly logic lives in the view, not the provider.

**Example:**
```typescript
// Provider produces fragment
const { where, params } = filterProvider.getCompiledSQL();
// { where: "deleted_at IS NULL AND folder IN (?)", params: ["Work"] }

const densityExpr = densityProvider.getDensitySQL('time');
// "strftime('%Y-%m', created_at)"

// View assembles final query
const cards = await workerBridge.query<Card>(
  `SELECT ${densityExpr} as bucket, COUNT(*) as count
   FROM cards WHERE ${where} GROUP BY bucket`,
  params
);
```

### Pattern 3: MutationManager as Single Write Gate

**What:** All entity writes go through `MutationManager.exec()`. This is the only place that calls `workerBridge.exec()` and notifies subscribers. Direct `workerBridge.exec()` calls from views are prohibited.

**When to use:** Any INSERT/UPDATE/DELETE on cards or connections.

**Trade-offs:** One extra function call per write. Necessary for: undo/redo command log, dirty flag for CloudKit sync, batched subscriber notification.

**Example:**
```typescript
// In any view or ETL importer
await mutations.exec(
  'UPDATE cards SET status = ?, modified_at = datetime("now") WHERE id = ?',
  ['done', cardId],
  { tables: new Set(['cards']), operation: 'update', affectedIds: [cardId] }
);
// Automatically: generates inverse command, sets dirty flag, notifies subscribers
```

### Pattern 4: WorkerBridge Promise Correlation

**What:** Every outgoing message gets a UUID. The pending Map holds `{ resolve, reject }` keyed by UUID. The Worker echoes the UUID on every response. This enables concurrent in-flight queries without race conditions.

**When to use:** This is the internal implementation of WorkerBridge — callers just await the returned Promise.

**Trade-offs:** Overhead of UUID generation and Map lookup per message. Negligible vs. query execution time.

**Example:**
```typescript
private send<T>(type: MessageType, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    this.worker.postMessage({ id, type, payload, timestamp: Date.now() });
  });
}
```

### Pattern 5: D3 Data Join with Stable Key Function

**What:** Every D3 selectAll/data/join call must supply a key function. The key is always `d => d.id` for cards and `d => d.groupKey` for aggregated cells.

**When to use:** Every D3 rendering call without exception.

**Trade-offs:** Slightly more code; essential for correct animated transitions between views. Without the key function, D3 matches by array index, causing cards to animate to wrong positions on sort/filter changes.

**Example:**
```typescript
// Correct
svg.selectAll('g.card')
  .data(cards, d => d.id)   // stable identity across renders
  .join(
    enter => enter.append('g').call(renderCard),
    update => update.call(updateCard),
    exit => exit.remove()
  );

// Wrong — causes DOM thrashing and incorrect transitions
svg.selectAll('g.card')
  .data(cards)   // no key function
  .join('g');
```

---

## Data Flow Summary

### State Types and Their Flows

| Data Type | Source of Truth | Flow Direction | Persistence |
|-----------|----------------|----------------|-------------|
| Cards, Connections | sql.js (Worker) | Worker → Main on query | Tier 1: SQLite |
| Filter/PAFV/Density state | Provider (Main) | Provider → StateCoordinator → sql.js | Tier 1/2: app_state table |
| Selection | SelectionProvider (Main) | Provider → D3 visual update only | Tier 3: none |
| Undo/Redo stack | MutationManager (Main) | Command log, in-memory | Tier 3: none |
| CloudKit dirty flag | MutationManager (Main) | MutationManager → NativeShell | Tier 3: none (debounce 2s) |

### Notification Topology

```
MutationManager (write)
    │ notify()
    ├──→ D3 View 1 → requery → render
    ├──→ D3 View 2 → requery → render
    └──→ StateCoordinator → persist app_state

FilterProvider (state change)
    │ notify()
    └──→ StateCoordinator → notify views
              │
              ├──→ D3 View 1 → requery → render
              └──→ D3 View 2 → requery → render

SelectionProvider (state change)
    │ notify()
    └──→ D3 View (selection visuals only — no requery)
```

---

## Anti-Patterns

### Anti-Pattern 1: Parallel Entity Store

**What people do:** Build a `cardStore = new Map<string, Card>()` on the main thread that mirrors cards from SQLite.

**Why it's wrong:** Double memory usage (WASM heap + JS heap); stale data risk when workers write; sync complexity. sql.js is already an optimized in-memory store with indexes.

**Do this instead:** Query sql.js fresh on each notification. The query round-trip via WorkerBridge is <10ms.

### Anti-Pattern 2: Raw SQL from Providers

**What people do:** Let FilterProvider produce full SQL strings like `"SELECT * FROM cards WHERE folder = 'Work'"`.

**Why it's wrong:** String interpolation of column names enables SQL injection even when values are parameterized. Injecting the column name `'; DROP TABLE cards; --` would execute.

**Do this instead:** Providers produce a `{ where: string; params: unknown[] }` fragment where column names are validated against `ALLOWED_FILTER_COLUMNS` before inclusion and values are always `?` placeholders.

### Anti-Pattern 3: FTS Join on `id` Column

**What people do:** `JOIN cards c ON c.id = fts.rowid` — joining on the string `id` column.

**Why it's wrong:** FTS5 `rowid` is an INTEGER. The `cards.id` column is TEXT (a UUID). The type mismatch causes incorrect or no results.

**Do this instead:** `JOIN cards c ON c.rowid = fts.rowid` — both sides are INTEGER.

### Anti-Pattern 4: Persisting Selection

**What people do:** Save selected card IDs to `ui_state` table so selection survives navigation.

**Why it's wrong:** Selection is Tier 3 (ephemeral) per D-005. Persisting it creates stale selection state that refers to cards that may have been deleted or moved.

**Do this instead:** `SelectionProvider` holds selection in memory only. Clear on navigation.

### Anti-Pattern 5: Many Small postMessage Calls in a Loop

**What people do:** Loop over 1000 cards calling `workerBridge.exec()` per card inside ETL.

**Why it's wrong:** Each postMessage round-trip incurs serialization overhead. 1000 calls × 2.5ms = 2.5 seconds blocked.

**Do this instead:** Use `workerBridge.transaction([...operations])` to batch all inserts into a single atomic postMessage round-trip. A 1000-card import becomes one message.

### Anti-Pattern 6: Missing D3 Key Function

**What people do:** `.data(cards).join('g')` without a key function.

**Why it's wrong:** D3 matches elements to data by array index. When data is sorted, filtered, or reordered, cards animate to the wrong positions. Elements are also unnecessarily destroyed and recreated.

**Do this instead:** Always supply `.data(cards, d => d.id)`.

---

## Build Order: 7 Phases

The phases map directly to the dependency graph. Each layer depends on everything below it.

### Dependency Graph

```
Phase 1: Database (sql.js + schema)
    │
    ▼
Phase 2: CRUD Queries (cards, connections, FTS, graph)
    │
    ▼
Phase 3: Worker Bridge (message protocol, handlers)
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
Phase 4: Providers                  Phase 6: ETL
(FilterProvider, PAFVProvider,      (Apple Notes, Slack, etc.)
 SelectionProvider, DensityProvider)
    │
    ▼
Phase 5: Views
(D3.js views: SuperGrid first, then others)
    │
    ▼
Phase 7: Native Shell
(WKWebView container, CloudKit sync, Keychain)
```

### Phase-by-Phase Build Order

| Phase | Deliverable | Depends On | Why This Order |
|-------|-------------|------------|----------------|
| **1: Database** | schema.sql, Database.ts, sql.js WASM init | Nothing | Everything needs a working database |
| **2: CRUD + Queries** | cards.ts, connections.ts, search.ts, graph.ts | Phase 1 | Providers and Workers need named query functions to build on |
| **3: Worker Bridge** | main.worker.ts, handlers/, WorkerBridge.ts | Phase 2 | Bridge must exist before any Provider or View can execute queries asynchronously |
| **4: Providers** | FilterProvider, PAFVProvider, SelectionProvider, DensityProvider, StateCoordinator | Phase 3 | Providers compile SQL fragments; they need the bridge to test query round-trips |
| **5: Views** | SuperGrid first, then List, Kanban, Calendar, etc. | Phases 3 + 4 | Views subscribe to Providers and query via Bridge; both must exist |
| **6: ETL** | AppleNotes, Slack importers | Phase 3 (bridge), Phase 2 (CRUD) | ETL uses `workerBridge.transaction()` and existing CRUD functions; can be built in parallel with Phase 4 once Phase 3 is done |
| **7: Native Shell** | WKWebView, CloudKit, Keychain | All web phases | Shell wraps completed web runtime; exported database format must be stable |

### Phase 4 + 6 Parallel Option

Phase 4 (Providers) and Phase 6 (ETL) have no dependency on each other. Both depend only on Phase 3 (Worker Bridge). They can be developed in parallel by different workstreams after Phase 3 is complete.

### SuperGrid First Within Phase 5

Start with SuperGrid as the first view because:
1. It exercises the most complex data join pattern (grouped aggregation, nested headers)
2. It requires the most from PAFVProvider (PAFV projection SQL)
3. If SuperGrid works, simpler views (List, Kanban) will work trivially
4. List view uses a simpler version of the same rendering pattern — proving SuperGrid proves the pattern

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main thread ↔ Web Worker | postMessage / structured clone | WorkerBridge manages all crossing; no direct postMessage calls outside bridge |
| Provider → View | Subscription callbacks (pub/sub) | StateCoordinator batches within 16ms frame |
| View → sql.js | WorkerBridge.query() (async) | Views must handle async; no synchronous data access |
| MutationManager → StateCoordinator | requestAnimationFrame batching | Coalesces rapid mutations into single notification |
| StateCoordinator → sql.js | WorkerBridge.exec() (app_state persistence) | Only Tier 1/2 state persists; Tier 3 (Selection) explicitly excluded |
| ETL → sql.js | workerBridge.transaction() (batched) | Always batch, never per-row exec |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| CloudKit | db:export ArrayBuffer → NativeShell → CloudKit | Worker exports binary db; Swift handles sync |
| Apple Keychain | NativeShell message handler → WorkerBridge response | JavaScript requests credential, never stores it |
| WKWebView MessageHandler | Swift injects JS handler for native bridge messages | Used for Keychain, lifecycle events, db import/export |
| Apple Notes / Reminders / Calendar | ETL parsers read native app export files | Swift extracts data, passes ArrayBuffer to etl:import |

---

## Scaling Considerations

This is a local-first single-user app. "Scaling" means database size, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10K cards | Default approach — all queries <10ms, no optimization needed |
| 10K–100K cards | Add LIMIT to all view queries; use FTS for search rather than LIKE; ensure partial indexes are used |
| 100K+ cards | Consider virtual scrolling in D3 views; lazy-load graph traversal results; paginate ETL inserts via chunked transactions |

### First Bottleneck: View Render for Large Datasets

The first performance constraint will be D3 rendering too many DOM elements (>1000 visible nodes causes frame drops). Mitigation: always LIMIT queries to visible viewport capacity (typically 50–200 cards). SuperGrid's density model naturally controls this by aggregating cards into cells.

### Second Bottleneck: ETL Bulk Import

Importing 10K+ Apple Notes in one transaction. Mitigation: chunk into batches of 500 via multiple `workerBridge.transaction()` calls with progress reporting between batches.

---

## Sources

- Isometry v5 canonical docs (HIGH confidence — project's own spec):
  - `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SuperGrid.md`
- [sql.js GitHub — Web Worker architecture](https://github.com/sql-js/sql.js) (MEDIUM confidence)
- [HackerNoon — sql.js + Web Workers performance](https://hackernoon.com/execute-millions-of-sql-statements-in-milliseconds-in-the-browser-with-webassembly-and-web-workers-3e0b25c3f1a6) (MEDIUM confidence)
- [web.dev — Off-main-thread WASM workers](https://web.dev/articles/off-main-thread) (MEDIUM confidence)
- [D3.js — Data joins and key functions](https://d3js.org/d3-selection/joining) (HIGH confidence)
- [postMessage serialization cost benchmarks](https://www.jameslmilner.com/posts/web-worker-performance/) (MEDIUM confidence — benchmarks vary by browser/hardware)

---

*Architecture research for: local-first TypeScript/D3.js data projection platform (Isometry v5)*
*Researched: 2026-02-27*
