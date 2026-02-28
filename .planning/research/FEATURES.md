# Feature Research

**Domain:** Local-first polymorphic data projection platform — Web Runtime milestone (v1.0)
**Researched:** 2026-02-28
**Confidence:** HIGH — architecture is locked in CLAUDE-v5.md and Core/Contracts.md; competitor patterns drawn from Notion, Airtable, Obsidian, NocoDB; D3/Worker patterns verified via official docs and Observable examples

---

## Context: This Milestone's Scope

The v0.1 Data Foundation shipped 151 tests, 3,378 LOC TypeScript: sql.js database, card CRUD, connection CRUD, FTS5 search, graph traversal, and performance benchmarks on 10K cards. Everything works and is tested. The database layer is complete.

The v1.0 Web Runtime milestone adds the entire rendering and interaction stack on top: Worker Bridge (communication layer), Provider system (state → SQL), Mutation Manager (undo/redo), nine D3.js views, SuperGrid with PAFV projection, view transitions, and three-tier state persistence.

The research question: **What do users of Notion, Airtable, and data visualization tools expect from these systems?** What is table stakes, what differentiates, and what should be explicitly avoided?

**Scope boundary:** ETL importers, native Swift shell, CloudKit sync, and credentials are out of scope for this milestone.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Non-blocking database access | Any blocking operation in a data app kills perceived quality. Users expect instant UI response even during queries | HIGH | Worker Bridge: all sql.js operations in Web Worker. Main thread never blocked. WorkerMessage/WorkerResponse envelope with correlation IDs. Pending request Map resolves promises. |
| Filter state persists across navigation | Airtable persists filters per saved view. Notion persists database filters within a page session. Users are confused when filters reset unexpectedly | MEDIUM | Three-tier persistence: FilterProvider state → Tier 2 SQLite `app_state`. Restored on app launch. Selection stays Tier 3 (ephemeral). |
| View switching without data loss | Users expect that switching from list to kanban does not clear their work or lose their filters | LOW | PAFVProvider suspends/restores view family state. LATCH state persists when switching between LATCH views. Switching to GRAPH suspends LATCH state and restores it on return. |
| Keyboard shortcuts for undo/redo | Cmd+Z / Cmd+Shift+Z on macOS. Absence is jarring and trust-destroying for any desktop-class tool. Notion's undo is partial and unreliable. | HIGH | Command log with inverse SQL operations. In-memory stack (Tier 3, ephemeral). Cmd+Z calls MutationManager.undo(). Stack cleared on sync conflict. |
| Instant filter response | Users type in filter inputs and expect results to update responsively. Debounce exists but should not feel laggy. | MEDIUM | FilterProvider compiles state → SQL. WorkerBridge executes query. D3 renderer re-queries on provider notification. Debounce 150ms for text inputs. |
| Select multiple items | Cmd+click (toggle), Shift+click (range), select-all. Consistent with every desktop application on macOS. | MEDIUM | SelectionProvider: `select(id, {toggle, extend})`. Anchor ID for Shift+click range calculation. `orderedIdsGetter()` injected from current view. Ephemeral (Tier 3). |
| View-specific defaults | A calendar view should default to date-based axis. A kanban view should default to status-based columns. | LOW | VIEW_DEFAULTS map in PAFVProvider. Each ViewType has a default PAFVState. Applied when switching to a view with no prior state. |
| Graceful error handling in views | A failed SQL query should show a message, not a blank or crashed screen. | LOW | WorkerResponse always has `success` flag. Views check before rendering. WorkerBridge `onerror` propagates to all pending promises. |
| Loading state during initialization | sql.js WASM load takes 200–500ms. Blank screen during this period is alarming to users. | LOW | Show skeleton/loading state immediately. Initialize db asynchronously. Bridge emits 'ready' event. |
| Consistent card identity across views | A card in list view is the same object in kanban. Its ID is stable. Switching views should feel like changing the lens, not reloading data. | HIGH | D3 data join key function `d => d.id`. Stable identity enables transitions and selection preservation across view switches. |
| Sort controls | Notion, Airtable, NocoDB all provide column-level sort. Users expect ascending/descending sort on any field. | LOW | PAFVProvider compiles sort config → SQL ORDER BY. Primary + secondary sort supported. `toggleSort(field)` flips direction. |
| Density / zoom levels | Users with large datasets need to compress the view. Airtable has compact/expanded row heights. Notion has database density toggles. | MEDIUM | DensityProvider: 4-level model (Value, Extent, View, Region). `setAxisDensity()` compiles to SQL strftime patterns for time, IN clauses for category. |

---

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected from competitors, but highly valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PAFV spatial projection — any axis to any plane | No existing tool lets users map arbitrary LATCH dimensions to screen axes and stack them in nested headers. Airtable groups are fixed. Notion views are preset. | HIGH | PAFVProvider: `setPlaneAxis(plane, assignment)`, `addRowAxis()`, `addColAxis()`. SuperGrid renders nested headers based on stacked row/col axis assignments. SQL GROUP BY compiled from axis config. |
| SuperGrid: nested dimensional headers with spanning | Multidimensional grids (Quarter → Month → Week as nested rows) with parent headers spanning child groups. No competitor does this. | HIGH | SuperStack feature: multi-level headers. Parent headers visually span children. Collapsible groups via DensityProvider. Sticky headers for scroll. |
| View transitions that animate cards between projections | Notion replaces content instantly. Airtable replaces content instantly. Animated card morphing makes the "same data, different view" insight visceral — users see their data flow from one arrangement to another. | HIGH | D3 `.transition().duration(300)` on data join update selection. Stable `d => d.id` key function. Cards animate from prior position to new position. Enter/exit animate in/out. |
| LATCH/GRAPH view family duality | One schema, two viewing families. FilterProvider (LATCH) and graph traversal (GRAPH) operate on identical tables. PAFVProvider tracks view family and suspends/restores state when switching families. | MEDIUM | `getViewFamily(viewType)` returns 'latch' or 'graph'. State suspension map keyed by family. Switching to graph view does not destroy LATCH projection state. |
| SQL-compiled provider state with zero entity duplication | No React state, no Redux, no Zustand holding card data. D3's data join IS state management. Providers hold only UI state (filters, axes, selection) and compile it to SQL. sql.js is the single source of truth. | HIGH | MutationManager: all writes go through it; subscribers notified via requestAnimationFrame batching. No parallel card store. D3 queries sql.js fresh on each notification. |
| Command log undo/redo with inverse SQL | Most in-browser tools have no undo. Notion's undo is partial. Every card and connection mutation records its inverse SQL, enabling full undo/redo without event sourcing infrastructure or server round-trips. | HIGH | `Command` interface: `forward` and `inverse` SQL + params. In-memory stack (Tier 3). Undo replays inverse. Redo replays forward. `type: 'batch'` for multi-mutation commands. |
| Mutation notification batched at frame boundary | Rapid mutations (e.g., bulk field updates) coalesce into a single re-render notification per animation frame. No cascading re-queries. | MEDIUM | MutationManager `scheduleNotify()` uses `requestAnimationFrame`. Multiple mutations in the same frame = one subscriber notification. |
| Force simulation off main thread (network view) | D3 force simulations block the main thread. The network view runs the simulation in the Web Worker and posts stable positions to the main thread. | HIGH | Force simulation computes in Worker. Only `{id, x, y}` positions posted to main thread when stable (not every tick). D3 renders from final positions. Critical for 200+ node graphs. |
| Graph algorithm suite on local data | PageRank, Louvain community detection, degree/betweenness/closeness centrality — running client-side on your own data without cloud API calls. | HIGH | All graph algorithms run in the Web Worker against the sql.js database. Results fed directly to D3 network/tree views for node sizing, coloring, community grouping. |
| Typed WorkerBridge with correlation IDs | No fire-and-forget mutations. No lost responses. Every Worker request has a UUID, every response matches it. Bridge is a proper async RPC layer over postMessage. | MEDIUM | `WorkerMessage`: `{id, type, payload, timestamp}`. `WorkerResponse`: `{id, status, payload, duration}`. `pending` Map tracks unresolved requests. `onerror` rejects all pending. |
| Allowlist-enforced SQL safety without ORM | The allowlist IS the security boundary. No ORM overhead, no injection risk. Column names allowlisted at compile time. Values always parameterized. Tested with injection attempts. | MEDIUM | `ALLOWED_FILTER_COLUMNS` Set. `validateColumn()` throws on unknown fields. `?` placeholders for all values. Table names hardcoded. Tests include `'; DROP TABLE` injection attempts. |
| Density controls that compile to SQL | Density is not just a visual toggle — it compiles to a different SQL expression. Switching time density from 'day' to 'month' changes `strftime('%Y-%m-%d', created_at)` to `strftime('%Y-%m', created_at)` in the GROUP BY. | MEDIUM | DensityProvider `getDensitySQL(axis)` returns the appropriate strftime pattern. Default hierarchies: `['timestamp', 'day', 'week', 'month', 'quarter', 'year']` for time axis. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this architecture.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Parallel entity store (MobX/Redux/Zustand) | Developers reach for these automatically. Standard React/Vue practice. | Duplicates SQLite data into JS memory. Two sources of truth diverge. Cache invalidation bugs. Double memory usage (WASM heap + JS heap). | D3's data join IS state. Query sql.js on notification. Providers compile UI state to SQL. No entity mirroring in JS. |
| Raw SQL from UI layer | Seems powerful for "advanced users." | Creates SQL injection surface. Column names cannot be parameterized. Breaks the allowlist safety model entirely. | FilterProvider + AxisProvider compile UI state to validated, parameterized SQL. Advanced users get filter chains, not raw SQL strings. |
| Persisting selection to SQLite | "Remember what I had selected" seems convenient. | Selection is inherently ephemeral. Multi-device conflicts (which device's selection is right?). Stale state on restart confuses users. CloudKit sync would propagate selection state. | SelectionProvider is Tier 3 (in-memory only). Explicitly by D-005. Selection clears on app restart — this is correct and expected behavior. |
| Running D3 force simulation on main thread | Simpler code, less messaging overhead. | Blocks UI during simulation cooling. At 200+ nodes, layout computation takes seconds. Frame rate drops to 0 during convergence. | Force simulation runs in the Web Worker. Only stable `{id, x, y}` positions are posted to main thread. Rendering happens once, not per tick. |
| Transitions between all view pairs using the same animation | "Consistent" feel across all view switches. | A list-to-network transition and a grid-to-kanban transition have fundamentally different semantic relationships. Same animation for both is disorienting. | Different transition strategies per view family pair: morphing for compatible layout families (list↔grid↔kanban), crossfade for incompatible (LATCH↔GRAPH). Cards animate within the same family; cross-family switches fade. |
| Posting full card objects across Worker bridge | Simple bridge contract. Bridge returns everything. | Structured Clone Algorithm runs on every postMessage. Full card objects include `content` field (potentially large text). Serialization overhead grows linearly with card count and content size. At 500 cards with content, this is measurable. | Project minimal fields in SQL before posting: `SELECT id, name, status, priority, folder FROM cards WHERE...`. Fetch `content` field only for detail views on demand. |
| SELECT * queries in bridge | Simple to write. Returns all data. | Content field alone can be kilobytes per card. At 10K cards, SELECT * returns megabytes of text that will never be rendered by list/grid/kanban views. | Field projection in SQL: each view specifies exactly which columns it needs. ViewManager knows the minimal column set per view type. |
| Debounce-free filter inputs | Seems more responsive. | Every keystroke triggers a Worker bridge round-trip. At 150ms per query, rapid typing queues up 10+ queries. Each cancels the previous. Bridge fills with stale requests. | 150ms debounce on text inputs. FTS queries especially: each MATCH query is O(n log n). Show previous results while new query is in-flight. |
| Global state that persists selection | "Power users" want to return to their selection. | Selection is Tier 3 by explicit decision (D-005). Persisting selection introduces cross-view, cross-restart, and cross-device semantic ambiguity. | SelectionProvider clears on view change and app restart. This matches every desktop application convention (Finder, Excel, Notion all clear selection on navigation). |
| Synchronous Worker bridge calls | Simpler code; no async/await boilerplate. | Worker communication is inherently async (postMessage). Synchronous worker calls block the main thread (SharedArrayBuffer approach), violating the non-blocking requirement. | Promise-based bridge. `async/await` throughout. Every bridge method returns a Promise. `pending` Map handles concurrency. |

---

## Feature Dependencies

```
[sql.js Database + Schema] (COMPLETED in v0.1)
    └──required-by──> [WorkerBridge] (Worker initializes db)
                          └──required-by──> [MutationManager]
                          └──required-by──> [Provider system (all)]
                          └──required-by──> [D3 Views (all queries)]

[WorkerBridge]
    └──requires──> [Web Worker entry (worker.ts)]
    └──requires──> [Message Router (switch on type)]
    └──requires──> [Correlation ID Map (pending requests)]

[SQL Allowlist + validateColumn()]
    └──must-precede──> [FilterProvider compilation]
    └──must-precede──> [any dynamic SQL generation]

[FilterProvider]
    └──requires──> [SQL Allowlist + validateColumn()]
    └──requires──> [WorkerBridge] (to execute compiled queries)
    └──compiles-to──> [SQL WHERE clauses]

[PAFVProvider (AxisProvider)]
    └──requires──> [WorkerBridge] (view defaults query db)
    └──compiles-to──> [SQL ORDER BY / GROUP BY clauses]

[DensityProvider]
    └──requires──> [PAFVProvider] (density applies per-axis)
    └──compiles-to──> [SQL strftime() / GROUP BY expressions]

[SelectionProvider]
    └──requires──> [ordered IDs from current view] (injected for range selection)
    └──is Tier 3──> [never persisted]

[StateCoordinator]
    └──requires──> [FilterProvider + PAFVProvider + SelectionProvider + DensityProvider]
    └──batches──> [notifications within 16ms frame]
    └──persists──> [Filter + PAFV + Density state to SQLite app_state]
    └──skips──> [SelectionProvider] (Tier 3)

[MutationManager]
    └──requires──> [WorkerBridge] (executes mutations)
    └──generates──> [Command log entries with inverse SQL]
    └──notifies──> [StateCoordinator subscribers on write]
    └──enables──> [Undo/Redo] (Command stack)

[D3 List View]
    └──requires──> [WorkerBridge] (card queries)
    └──requires──> [FilterProvider compiled SQL]
    └──requires──> [PAFVProvider sort config]
    └──implements──> [D3 data join with d => d.id key function]

[D3 Grid View]
    └──requires──> [D3 List View patterns] (same card identity approach)
    └──requires──> [DensityProvider] (columns per row)

[D3 Kanban View]
    └──requires──> [FilterProvider] (filter within columns)
    └──requires──> [PAFVProvider] (x-axis = status category)
    └──enables──> [Drag-drop mutation] (updates status field via MutationManager)

[D3 Calendar View]
    └──requires──> [DensityProvider] (day/week/month granularity)
    └──requires──> [PAFVProvider time axis assignment]
    └──requires──> [d3-time-format] (date bucketing)

[D3 Timeline View]
    └──requires──> [Calendar View patterns] (time axis)
    └──requires──> [d3-scale scaleTime()] (continuous time scale)
    └──requires──> [PAFVProvider] (swim lane y-axis assignment)

[D3 Gallery View]
    └──requires──> [Grid View patterns] (2D tile layout)
    └──requires──> [image/attachment card_type metadata]

[D3 Network View (force-directed)]
    └──requires──> [Connection CRUD] (connections table populated)
    └──requires──> [D3 force simulation in Web Worker] (off main thread)
    └──requires──> [PAFVProvider graph family state]
    └──enables──> [Graph algorithms: PageRank, Louvain, centrality]

[D3 Tree View (hierarchy)]
    └──requires──> [Connection CRUD] (contains/parent-child connections)
    └──requires──> [d3-hierarchy layout]
    └──requires──> [PAFVProvider graph family state]

[D3 Table View]
    └──requires──> [All other views] (Workbench tier, implemented last)
    └──requires──> [Virtual scrolling for large datasets]
    └──requires──> [Editable cell mutations via MutationManager]

[SuperGrid]
    └──requires──> [PAFVProvider] (row/col axis stacking)
    └──requires──> [DensityProvider] (nested header collapse)
    └──requires──> [FilterProvider compiled SQL]
    └──requires──> [SQL GROUP BY compilation from stacked axes]
    └──requires──> [Sticky header implementation] (CSS position: sticky)

[View Transitions]
    └──requires──> [At least 2 views sharing the same card data]
    └──requires──> [D3 data join with stable d => d.id key function]
    └──requires──> [D3 .transition() on update selection]
    └──requires──> [PAFVProvider view switch notification]

[Three-Tier State Persistence]
    └──requires──> [WorkerBridge] (SQLite writes for Tier 1+2)
    └──requires──> [StateCoordinator persist() / restore()]
    └──Tier 3──> [SelectionProvider] (in-memory only, no persistence)
```

### Dependency Notes

- **Worker Bridge must come before all else**: No provider, view, or mutation manager can function without the bridge. It is the first thing built in this milestone.
- **SQL allowlist before FilterProvider**: The allowlist is a security prerequisite. FilterProvider cannot safely compile dynamic SQL without it. Build the allowlist first, then the provider.
- **PAFVProvider before SuperGrid**: SuperGrid's nested headers are driven entirely by the axis stacking config in PAFVProvider. SuperGrid without PAFVProvider has no data to display.
- **Force simulation off main thread for Network view**: This is not optional. Force simulations at 200+ nodes block the UI. The Web Worker already hosts sql.js — adding force simulation there is natural.
- **View transitions require stable key functions**: D3 transitions only animate correctly when `.data(items, d => d.id)` key functions are present on every data join. Without them, every view switch is a full DOM replacement. This is the most common mistake and must be enforced from the first view written.
- **Kanban drag-drop requires MutationManager**: Dropping a card into a new column must update `status` in SQLite via MutationManager (so it's undoable and notifies subscribers). Kanban depends on MutationManager, not just WorkerBridge directly.
- **Network and Tree views require populated connections**: The graph views are meaningless with no connections. ETL (v1.1 milestone) is the primary connection populator. For v1.0, connections are seeded from test data.
- **Table view is last**: Workbench tier only. High complexity (virtual scroll, editable cells, column resize). Implement after all other views are validated.

---

## MVP Definition

### Launch With (v1.0 — Web Runtime)

Minimum viable for this milestone: the runtime stack that makes data already in SQLite visible and interactive.

- [ ] **Worker Bridge with typed correlation IDs** — Everything else depends on this. Non-blocking database access is the foundation.
- [ ] **SQL allowlist + validateColumn()** — Security prerequisite. Must exist before any FilterProvider code is written.
- [ ] **FilterProvider with SQL compilation** — Users need to filter their data. LATCH filters (location, alphabet, time, category, hierarchy) compiled to safe SQL.
- [ ] **PAFVProvider with view family state** — Axis-to-plane mapping for all views. View family suspension/restoration.
- [ ] **SelectionProvider (Tier 3 only)** — Multi-select for all views. Cmd+click, Shift+click, keyboard navigation.
- [ ] **DensityProvider with SQL-compiled density** — Time hierarchy (day/week/month/quarter/year). Show/hide empty cells.
- [ ] **StateCoordinator with persist/restore** — Filter + PAFV + Density persist across sessions (Tier 2). Selection does not.
- [ ] **MutationManager with command log** — All writes go through this. Inverse SQL generated for every mutation. Undo/redo stack. Cmd+Z / Cmd+Shift+Z.
- [ ] **List view** — First D3 view. Establishes the pattern all others follow: key function, data join, enter/update/exit.
- [ ] **Grid view (2D tile layout)** — Second view. Proves the "same data, different projection" insight.
- [ ] **Kanban view with drag-drop** — Category axis view. Drag-drop updates status via MutationManager (undoable).
- [ ] **Calendar view** — Time axis view. Date bucketing via DensityProvider.
- [ ] **Timeline view** — Continuous time scale with swim lanes.
- [ ] **Gallery view** — Visual card rendering for resource/photo card types.
- [ ] **Network view (force-directed, off main thread)** — GRAPH family. Force simulation in Worker.
- [ ] **Tree view (d3-hierarchy)** — GRAPH family. Hierarchy from contains/parent connections.
- [ ] **SuperGrid with nested headers** — Signature view. Stacked PAFV axes. Spanning parent headers. Collapsible groups.
- [ ] **View transitions (D3 animated)** — Cards animate between view positions. The keystone differentiator.
- [ ] **Performance threshold: <16ms render for 100 visible cards in SuperGrid** — Required quality gate.

### Deliberately Deferred (Not in v1.0)

- [ ] **Table view** — Workbench tier. Complex (virtual scroll, editable cells). Deferred to v1.x or v2.
- [ ] **ETL importers** — v1.1 milestone. Runtime must be stable before importing real data.
- [ ] **Native Swift shell** — Separate effort. WKWebView integration is a spike, not milestone scope.
- [ ] **CloudKit sync** — Depends on native shell.
- [ ] **EAV card_properties** — Deferred by D-008.
- [ ] **Semantic/vector search** — v2.
- [ ] **Collaborative features** — v2.

---

## Feature Prioritization Matrix

This milestone only. Priority reflects build order within the Web Runtime milestone.

| Feature | User Value | Implementation Cost | Priority | Build After |
|---------|------------|---------------------|----------|-------------|
| Worker Bridge with typed correlation IDs | HIGH | MEDIUM | P1 | sql.js database (done) |
| SQL allowlist + validateColumn() | HIGH | LOW | P1 | Worker Bridge |
| FilterProvider (LATCH filters → SQL) | HIGH | MEDIUM | P1 | SQL allowlist |
| PAFVProvider (axis mapping, view family) | HIGH | MEDIUM | P1 | Worker Bridge |
| MutationManager + Command log | HIGH | HIGH | P1 | Worker Bridge |
| StateCoordinator persist/restore | MEDIUM | MEDIUM | P1 | All providers |
| SelectionProvider (Tier 3) | MEDIUM | LOW | P1 | PAFVProvider |
| DensityProvider (SQL-compiled density) | MEDIUM | MEDIUM | P1 | FilterProvider |
| List view (first D3 view) | HIGH | LOW | P1 | All providers |
| Grid view | HIGH | LOW | P1 | List view |
| Kanban view with drag-drop | HIGH | MEDIUM | P1 | Grid view, MutationManager |
| View transitions (D3 animated) | HIGH | HIGH | P1 | 2+ views |
| Calendar view | MEDIUM | MEDIUM | P2 | DensityProvider |
| Timeline view | MEDIUM | MEDIUM | P2 | Calendar view |
| Gallery view | MEDIUM | LOW | P2 | Grid view |
| Network view (force in Worker) | MEDIUM | HIGH | P2 | Connection data available |
| Tree view | MEDIUM | HIGH | P2 | Network view patterns |
| SuperGrid with nested headers | HIGH | HIGH | P2 | PAFVProvider + DensityProvider |
| Table view | LOW | HIGH | P3 | All other views |

**Priority key:**
- P1: Required for milestone completion — blocks other phases
- P2: Part of milestone, but can follow P1 without blocking
- P3: Milestone stretch or explicitly deferred

---

## Competitor Feature Analysis

Context: what users who switch from these tools to Isometry will expect.

| Feature | Notion | Airtable | NocoDB | Obsidian | Isometry v5 Approach |
|---------|--------|----------|--------|----------|----------------------|
| View switching | Instant content replace | Instant content replace | Instant content replace | N/A (graph only) | Animated card transitions. Cards morph between positions. Same data, different SQL projection. |
| Filter persistence | Per-database-block session | Per saved view (persistent) | Per view (persistent) | N/A | Three-tier: FilterProvider state → Tier 2 SQLite `app_state`. Restored on launch. More robust than Notion, similar to Airtable. |
| State when switching views | Filters lost on view switch | Filters preserved per view | Filters preserved per view | N/A | PAFVProvider preserves filter state within a view family (LATCH or GRAPH). Switching families suspends/restores state. |
| Multi-select | Checkbox column only | Row checkboxes + click | Row checkboxes | Link selection | SelectionProvider: Cmd+click toggle, Shift+click range, keyboard arrow navigation. Works in all views. |
| Undo/redo | Partial (inconsistent, text only) | Limited | Limited | Full (file-based) | Full command log. Inverse SQL for every mutation. All card + connection operations undoable. |
| Database operations | Cloud (server-side) | Cloud (server-side) | Server or local | Local (files) | In-browser WASM (sql.js). Non-blocking via Web Worker. Sub-16ms renders for 100 visible cards. |
| View types | Table, Board, Calendar, Timeline, Gallery, List (6) | Grid, Kanban, Calendar, Gantt, Gallery (5) | Grid, Kanban, Gallery, Calendar, Map (5) | Graph, Files (2) | Nine views: list, grid, kanban, calendar, timeline, gallery, network, tree, table. All from same SQL schema. |
| Grouping / dimensions | Flat group by one field | Flat group by one field | Flat group by one field | N/A | SuperGrid: n-dimensional nested headers. Stack multiple axes per dimension. SQL GROUP BY compiled dynamically. |
| Drag to reorder | In board/kanban view | In grid view (records) | In kanban view | N/A | Kanban drag-drop: updates `status` field via MutationManager. Undoable. |
| Density / zoom | Compact/expanded rows | Compact/expanded rows | Row height options | N/A | DensityProvider: 4 levels. Time hierarchy collapses months to quarters. Empty cell show/hide. Value density per axis. |
| Graph/network view | No | No | No | Yes (backlinks) | Network view: D3 force-directed, force simulation in Worker. PageRank sizing, Louvain community coloring. |
| Animated transitions | No | No | No | No | Yes. D3 `.transition()` on update selection with `d => d.id` key. 300ms ease-in-out. |
| Selection persistence | Cleared on navigation | Per view, ephemeral | Ephemeral | N/A | Ephemeral (Tier 3). SelectionProvider is in-memory only. Cleared on navigation. Consistent with desktop conventions. |

---

## What Users Expect: Behavior Details

### Worker Bridge: User-Facing Behavior

Users never see the Worker Bridge directly, but they feel it. Expected behaviors:

- **Instant response**: Filters update results in <150ms (debounce) + query time. The UI does not stall.
- **Concurrent queries**: Typing fast while filters update should not cause errors. Correlation IDs handle concurrent in-flight queries.
- **Error recovery**: A failed Worker query shows a message. The Worker does not crash the app. `onerror` handler propagates errors to the pending promise Map and resolves them as rejections.
- **No frozen UI**: The tab does not freeze during any database operation. If it does, the Worker Bridge architecture is broken.

### Provider System: User-Facing Behavior

Users interact with providers through filter chips, axis dropdowns, and density sliders. Expected behaviors:

- **Filter chips update results immediately** (after 150ms debounce for text inputs). Adding a filter narrows the result set. Removing a filter expands it.
- **Switching views preserves filter state** within a view family (LATCH views share state; switching kanban → calendar keeps the active filters).
- **Switching to graph view suspends LATCH state**. When returning to a LATCH view, the previously active filters and axis assignments are restored. Users do not have to re-configure after exploring the graph.
- **Selection is per-session**. Cmd+click selects cards across all view types. Selection clears when the app restarts. This is expected — no desktop tool persists selection across sessions.
- **Density controls change what SQL group by means**, not just what CSS class is applied. Collapsing "month" granularity to "quarter" changes the GROUP BY expression and re-queries the database.

### Mutation Manager + Undo/Redo: User-Facing Behavior

From Notion, Airtable, and general desktop app conventions:

- **Cmd+Z undoes the last mutation**. Every card create, update, delete, and connection create/delete is undoable.
- **Cmd+Shift+Z redoes**. After undoing, redo replays the forward operation.
- **Undo stack does not survive app restart**. This is consistent with Finder, Excel, and Notion. History is session-scoped.
- **Bulk operations (ETL import) are one undo step**. Importing 500 cards should be undoable as a single Cmd+Z, not 500 Cmd+Zs.
- **Undo is fast**. The inverse SQL is already generated and stored. Undo execution is a single Worker bridge call.
- **Sync conflict clears the undo stack**. This is disclosed to the user. The stack references a pre-conflict state that may no longer exist.

### Nine D3 Views: User-Facing Behavior

Based on NocoDB, Airtable, Notion, and research into view mental models:

| View | Expected Interaction Model | Key Behavior Requirement |
|------|---------------------------|--------------------------|
| List | Scan rows. Click to open detail. Keyboard arrows to navigate. | Virtual scrolling for large datasets. Rows stay stable during filter changes (stable key function). |
| Grid | Scan tiles. Click to select/open. Resize density. | Tile count per row determined by container width and DensityProvider. |
| Kanban | Columns = status values. Drag card between columns. Click to open. | Drag-drop updates status field via MutationManager (undoable). Column order from STATUS_ORDER config. |
| Calendar | Month/week/day granularity from DensityProvider. Click day to see cards. | Cards placed by `event_start` or `due_at`. Day cells show card count. Click cell to expand. |
| Timeline | Horizontal time axis. Swim lanes by category. Zoom controls. | `d3.scaleTime()` with pan/zoom. Cards positioned by date field from PAFVProvider. |
| Gallery | Cards as visual tiles with image/cover. Infinite scroll. | Image loaded from `url` field for `resource` card type. Fallback to color-coded tile for others. |
| Network | Nodes = cards. Edges = connections. Force-directed layout. | Simulation runs in Worker. Zoom/pan. Click node to select. Node size from PageRank. Color from Louvain community. Stable positions persisted to `view_state` after convergence. |
| Tree | Hierarchy from `contains`/`parent` connections. Collapsible nodes. | `d3.hierarchy()` from connection data. Expand/collapse via DensityProvider `collapseGroup()`. |
| Table | Columns = fields. Rows = cards. Sortable headers. Editable cells. | Virtual scrolling (mandatory at 10K cards). Editable cells write via MutationManager. Column resize. Filter per column. Workbench tier only. |

### SuperGrid: User-Facing Behavior

SuperGrid is the signature view and the highest complexity item in this milestone. Expected behaviors from the spec:

- **Nested dimensional headers**: Row headers can be 3 levels deep (Q1 > January > Week 1). Parent headers span their children visually.
- **Axis stacking via drag-drop**: Users drag properties from the Properties Explorer into X-PLANE ROWS or Y-PLANE COLUMNS wells. Each dropped axis adds a dimension level.
- **Collapsible groups**: Clicking a parent header collapses/expands its children (via DensityProvider `toggleGroup()`).
- **Sticky headers**: Row and column headers stay visible during horizontal/vertical scroll.
- **Cell content**: Cells show card previews (up to 2 visible) with "+N more" overflow indicator.
- **SQL projection**: `GROUP BY folder, strftime('%Y-%m', created_at)` — both dimensions compiled from active axis stack.
- **Empty cells**: DensityProvider `showEmpty` toggle determines whether cells with 0 cards are rendered.

### View Transitions: User-Facing Behavior

Based on the research findings on animated transitions in data visualization:

- **Smooth, not jarring**: 300ms duration with `d3.easeCubicInOut`. Fast enough to feel snappy; slow enough to track card movement.
- **Same data, different arrangement**: A card in the list view should be visually traceable to its position in the kanban column when switching. This is the core insight made visceral.
- **Incompatible transitions fade**: Switching from a LATCH view (list/grid/kanban) to a GRAPH view (network/tree) cannot morph cards — the structural layouts are incompatible. Use a crossfade/opacity transition instead.
- **Exit elements animate out**: Cards that are filtered out during a view switch animate down in opacity and scale, not disappear instantly.
- **Enter elements animate in**: New cards in the new view's result set fade in with a subtle translate-up entrance.
- **Batch transitions**: All cards in the update selection transition simultaneously, not sequentially. Sequential transitions at 100+ cards look like a waterfall effect — unintentional.

---

## State Persistence Details

Three-tier model — what persists, what doesn't, and why.

| Tier | What | Where | Restored On | Notes |
|------|------|-------|-------------|-------|
| Tier 1: Global | FilterProvider state, DensityProvider state | SQLite `app_state` table | App launch | `StateCoordinator.persist()` writes JSON blob. `restore()` reads on init. Does not sync via CloudKit. |
| Tier 2: Family | PAFVProvider state per view family | SQLite `view_state` table | View family switch | `UNIQUE(family)` so only one LATCH state and one GRAPH state stored. Swapped when switching families. |
| Tier 3: Ephemeral | SelectionProvider (selectedIds, anchorId, focusedId, hoveredId) | In-memory only | Never | Selection clears on app restart. This is correct. No exceptions. |

---

## Sources

- Project specification: `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md`
- Core contracts: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`
- WorkerBridge spec: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md`
- Providers spec: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md`
- Views spec: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Views.md`
- SuperGrid spec: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SuperGrid.md`
- D3 Components spec: `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/D3Components.md`
- Competitor feature analysis: [Airtable vs Notion (Jotform 2026)](https://www.jotform.com/blog/airtable-vs-notion/), [NocoDB views (DeepWiki)](https://deepwiki.com/nocodb/nocodb/4.4-dashboard-and-map-views)
- Airtable filter persistence: [Airtable filter docs](https://support.airtable.com/docs/filtering-records-using-conditions), [Saving filter settings community](https://community.airtable.com/t5/interface-designer/saving-filter-settings-in-airtable-interface/td-p/168803)
- Animated transitions research: [Stanford Vis Group — Animated Transitions in Statistical Data Graphics](http://vis.stanford.edu/papers/animated-transitions), [Observable — Five ways to effectively use animation](https://observablehq.com/blog/effective-animation)
- D3 force simulation in Web Worker: [Observable — Force-directed web worker](https://observablehq.com/@d3/force-directed-web-worker), [D3 force simulation docs](https://d3js.org/d3-force/simulation)
- Undo/redo patterns: [Wikipedia — Undo](https://en.wikipedia.org/wiki/Undo), [Tableau undo/redo](https://help.tableau.com/current/pro/desktop/en-us/inspectdata_undo.htm)
- Kanban and multi-view behavior: [Baserow Kanban docs](https://baserow.io/user-docs/guide-to-kanban-view), [Upwave multi-view](https://help.upwave.io/en/articles/5131013-board-views-kanban-table-timeline-and-calendar)

---

*Feature research for: local-first polymorphic data projection platform — Web Runtime (v1.0 milestone)*
*Researched: 2026-02-28*
