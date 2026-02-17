# Architecture: Grid Continuum & Polymorphic Views

**Domain:** Multi-view data projection system (Gallery/List/Kanban/Grid/SuperGrid/Network/Timeline)
**Researched:** 2026-02-16
**Architecture Pattern:** PAFV axis controller → view renderers → D3.js/CSS → sql.js

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  5. User Interface Layer                                             │
│  ├─ GridContinuumSwitcher.tsx (View mode buttons)                  │
│  ├─ ThreeCanvasLayout.tsx (Resizable pane container)               │
│  └─ ViewComponentRegistry (maps mode to renderer)                  │
├─────────────────────────────────────────────────────────────────────┤
│  4. View Controllers & State Management                              │
│  ├─ GridContinuumController (PAFV axis allocation, mode dispatch)  │
│  ├─ SelectionContext (cross-view selection sync)                   │
│  ├─ ViewTransitionManager (scroll/zoom state preservation)         │
│  └─ ViewStateStore (localStorage for pane sizes, zoom, scroll)     │
├─────────────────────────────────────────────────────────────────────┤
│  3. View Renderers (Query-Agnostic, Data-Driven)                    │
│  ├─ GalleryRenderer (CSS Masonry + TanStack Virtual)               │
│  ├─ ListRenderer (React tree with expand/collapse)                 │
│  ├─ KanbanRenderer (CSS columns + dnd-kit drag-drop)               │
│  ├─ GridRenderer (CSS Grid with sticky headers)                    │
│  ├─ SuperGridRenderer (Nested headers, already built)              │
│  ├─ NetworkRenderer (D3 force simulation)                          │
│  └─ TimelineRenderer (D3 time scale + event positioning)           │
├─────────────────────────────────────────────────────────────────────┤
│  2. Data Query Layer (SQL-Driven)                                    │
│  ├─ ViewQueryBuilder (generates VIEW-SPECIFIC SQL)                 │
│  │  ├─ SELECT * FROM nodes WHERE ... (Gallery/List/Network)        │
│  │  ├─ SELECT ... GROUP BY row_facet, col_facet (Grid/Kanban)      │
│  │  ├─ SELECT ... ORDER BY event_date (Timeline)                   │
│  │  └─ SELECT ... with UNION to include edges (Network)            │
│  ├─ HeaderDiscoveryService (facet detection for columns/rows)      │
│  ├─ useSQLiteQuery hook (React hook for live query results)        │
│  └─ Data subscription (re-render on query change)                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Database Layer (sql.js + SQLite)                                │
│  ├─ nodes table (with LATCH columns)                               │
│  ├─ edges table (LINK, NEST, SEQUENCE, AFFINITY)                   │
│  ├─ facets table (available LATCH dimensions)                      │
│  ├─ FTS5 virtual tables (full-text search)                         │
│  └─ Recursive CTEs (graph traversal)                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Components & Responsibilities

### GridContinuumController (The Hub)

**Purpose:** Central dispatcher for PAFV axis allocation. Decides which axis maps to which plane (x, y, color, size, shape) based on view mode and user selections.

**Inputs:**
- Current view mode (gallery, list, kanban, grid, supergrid, network, timeline)
- Selected row facet (for Grid/Kanban)
- Selected column facet (for Grid)
- LATCH filters (location, alphabet, time, category, hierarchy)
- Color/size/shape plane assignments

**Outputs:**
- SQL query (passed to QueryBuilder)
- Axis configuration (x-axis facet, y-axis facet, etc.)
- Render hints (sort order, grouping, sparsity)

**Key Method:**
```typescript
allocateAxes(mode: GridContinuumMode, selectedFacets: FacetSelection): AxisAllocation {
  switch (mode) {
    case 'gallery': return { x: null, y: null, facets: [] };  // 0-axis
    case 'list': return { x: facets[0], y: null, hierarchy: true };  // 1-axis
    case 'kanban': return { columns: selectedFacets.column, rows: null };  // 1-facet
    case 'grid': return { x: facets[0], y: facets[1] };  // 2-axis
    case 'supergrid': return { x: facets[0], y: facets[1], z: facets[2] };  // n-axis
    case 'network': return { topology: 'edges', filter: filters };  // topology-driven
    case 'timeline': return { x: 'event_date', y: null };  // temporal
  }
}
```

**Files:** `src/services/grid-continuum/GridContinuumController.ts`

### View Renderers (Pluggable)

**Registry Pattern:** Each view mode has a renderer that implements the `ViewRenderer` interface.

```typescript
interface ViewRenderer {
  readonly type: ViewType;
  readonly renderMode: 'react' | 'd3';

  render(container: HTMLElement | D3Container, data: Node[], config: RenderConfig): void;
  destroy(): void;

  // State management for view transitions
  getTransitionState(): ViewTransitionState;
  loadState(state: ViewTransitionState): void;

  // Event handlers
  onCardClick(node: Node): void;
  onDragDrop(source: Node, target: Dropzone): Promise<void>;
  onResize(dimensions: Dimensions): void;
}
```

**Renderer Locations:**
- Gallery: `src/d3/renderers/GalleryRenderer.tsx` (React + CSS Grid)
- List: `src/d3/renderers/ListRenderer.tsx` (React tree component)
- Kanban: `src/d3/renderers/KanbanRenderer.tsx` (CSS + dnd-kit)
- Grid: `src/d3/renderers/GridRenderer.tsx` (CSS Grid with D3 data binding)
- SuperGrid: `src/d3/renderers/SuperGridRenderer.tsx` (Already exists, v6.6)
- Network: `src/d3/renderers/NetworkRenderer.ts` (D3 SVG)
- Timeline: `src/d3/renderers/TimelineRenderer.ts` (D3 SVG)

---

## Data Flow Architecture

### 1. Mode Switch Flow

```
User clicks "Gallery" button
  ↓
GridContinuumSwitcher.tsx dispatches action
  ↓
GridContinuumController.allocateAxes(mode='gallery')
  ↓
Returns AxisAllocation { x: null, y: null, facets: [] }
  ↓
ViewQueryBuilder generates new SQL: SELECT * FROM nodes WHERE [LATCH filters]
  ↓
useSQLiteQuery hook executes query on sql.js
  ↓
Results → GalleryRenderer.render(container, data, config)
  ↓
GalleryRenderer saves view state (scroll position) and renders
  ↓
User sees gallery layout
```

### 2. Drag-Drop in Kanban Flow

```
User drags card from "To Do" column to "In Progress"
  ↓
dnd-kit onDragEnd handler fires
  ↓
KanbanRenderer.onDragDrop(sourceNode, targetColumn)
  ↓
Extract target column facet value (e.g., status='in_progress')
  ↓
db.run(UPDATE nodes SET status = ? WHERE id = ?, [targetValue, nodeId])
  ↓
SQL update triggers re-query
  ↓
useSQLiteQuery re-fetches: SELECT * FROM nodes WHERE [filters] GROUP BY status
  ↓
KanbanRenderer re-renders with new data
  ↓
D3 transitions card to new position
  ↓
User sees card move with animation
```

### 3. Cross-View Selection Sync Flow

```
User clicks card in SuperGrid
  ↓
GridRenderer dispatches SelectionContext.setSelectedIds([nodeId])
  ↓
SelectionContext updates global selection state
  ↓
ALL other renderers re-render, highlighting matching nodes
  ↓
TimelineRenderer highlights event with same ID
  ↓
NetworkRenderer highlights node with same ID
  ↓
Capture pane highlights matching block (if TipTap is linked)
```

### 4. Search/Filter in List View Flow

```
User types in List search box
  ↓
ListRenderer calls db.exec(FTS5_SEARCH_QUERY)
  ↓
FTS5 returns matching node IDs
  ↓
ListRenderer filters tree: only nodes with children containing matches
  ↓
Expands ancestor nodes to show matches
  ↓
Highlights matching nodes
```

---

## SQL Query Patterns by View Mode

### Gallery (0-Axis)

**Pattern:** Simple select, no grouping, order by user choice (or random/id)

```sql
SELECT * FROM nodes
WHERE deleted_at IS NULL
  AND [LATCH_filters]
ORDER BY COALESCE(sort_order, id)
LIMIT [virtualization_range]
```

**Execution:** Virtual scrolling; query executed in chunks as user scrolls.

### List (1-Axis Hierarchy)

**Pattern:** Select with hierarchy column, order by depth then hierarchy facet

```sql
WITH RECURSIVE hierarchy AS (
  SELECT id, parent_id, [hierarchy_facet], 0 as depth
  FROM nodes
  WHERE parent_id IS NULL AND [LATCH_filters]

  UNION ALL

  SELECT n.id, n.parent_id, n.[hierarchy_facet], h.depth + 1
  FROM nodes n
  JOIN hierarchy h ON n.parent_id = h.id
  WHERE [LATCH_filters] AND h.depth < 10
)
SELECT id, parent_id, depth FROM hierarchy
ORDER BY parent_id, [hierarchy_facet]
```

**Execution:** Load root nodes, lazy-load children on expand via `WHERE parent_id = ?`.

### Kanban (1-Facet Columns)

**Pattern:** Group by column facet, aggregate card count, include all facet values

```sql
SELECT
  [column_facet],
  COUNT(*) as card_count,
  JSON_ARRAYAGG(id) as card_ids
FROM nodes
WHERE deleted_at IS NULL AND [LATCH_filters]
GROUP BY [column_facet]
ORDER BY [column_facet]
```

**Execution:** One query groups data; React renders column containers from result.

### Grid (2-Axis Tabular)

**Pattern:** Group by row and column facets, sparse cells okay

```sql
SELECT
  [row_facet],
  [column_facet],
  JSON_ARRAYAGG(id) as card_ids,
  COUNT(*) as card_count
FROM nodes
WHERE deleted_at IS NULL AND [LATCH_filters]
GROUP BY [row_facet], [column_facet]
ORDER BY [row_facet], [column_facet]
```

**Execution:** Virtual scrolling on row×column cells; CSS Grid arranges visually.

### SuperGrid (n-Axis Nested)

**Pattern:** Group by all n dimensions, nested aggregation with header spanning

```sql
SELECT
  [dim1_facet],
  [dim2_facet],
  [dim3_facet],
  JSON_ARRAYAGG(id) as card_ids
FROM nodes
WHERE deleted_at IS NULL AND [LATCH_filters]
GROUP BY [dim1_facet], [dim2_facet], [dim3_facet]
ORDER BY [dim1_facet], [dim2_facet], [dim3_facet]
```

**Execution:** HeaderDiscoveryService analyzes GROUP BY results, generates spanning headers.

### Network (Topology)

**Pattern:** Fetch nodes + edges, include relationship metadata

```sql
SELECT
  n.id, n.name, n.[color_facet], n.[size_facet],
  JSON_ARRAYAGG(JSON_OBJECT(
    'target_id', e.target_id,
    'type', e.edge_type,
    'weight', e.weight
  )) as edges
FROM nodes n
LEFT JOIN edges e ON e.source_id = n.id
WHERE n.deleted_at IS NULL AND [LATCH_filters]
GROUP BY n.id
```

**Execution:** D3 force simulation on entire result set.

### Timeline (Temporal)

**Pattern:** Select by time range, order chronologically, include all facets for positioning

```sql
SELECT id, name, event_date, [end_date], [category_facet]
FROM nodes
WHERE deleted_at IS NULL
  AND event_date BETWEEN ? AND ?
  AND [LATCH_filters]
ORDER BY event_date, id
```

**Execution:** Render visible time range; re-query on zoom/pan.

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ GridContinuumSwitcher (React)                                       │
│ [Gallery] [List] [Kanban] [Grid] [SuperGrid] [Network] [Timeline]  │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ↓ mode change
        ┌────────────────────┐
        │ GridContinuum      │
        │ Controller         │
        │ allocateAxes()     │
        └────────┬───────────┘
                 │
        ┌────────▼──────────┐
        │ ViewQueryBuilder  │
        │ buildQuery()      │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ useSQLiteQuery    │
        │ (React hook)      │
        └────────┬──────────┘
                 │
        ┌────────▼──────────────────┐
        │ sql.js (SQLite WASM)      │
        │ db.exec(query)            │
        └────────┬──────────────────┘
                 │
        ┌────────▼─────────────────────────────┐
        │ ViewRenderer (pluggable)             │
        │ - GalleryRenderer                    │
        │ - ListRenderer                       │
        │ - KanbanRenderer                     │
        │ - GridRenderer                       │
        │ - SuperGridRenderer                  │
        │ - NetworkRenderer                    │
        │ - TimelineRenderer                   │
        └────────┬──────────────────────────────┘
                 │
        ┌────────▼──────────────────────┐
        │ DOM Rendering                │
        │ - React (Gallery, List, etc)  │
        │ - CSS Grid (Kanban, Grid)    │
        │ - D3 SVG (Network, Timeline)  │
        └───────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Cross-View State Sync (React Context)            │
│ ├─ SelectionContext (selected node IDs)          │
│ ├─ FilterContext (LATCH filters)                 │
│ ├─ ViewStateStore (scroll, zoom, pane sizes)    │
│ └─ PAFVContext (axis allocation)                 │
└──────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Single Data Source (sql.js) for All Views

**Decision:** All views query the same SQLite database, not in-memory JS objects.

**Rationale:**
- Eliminates data sync problems (different views showing different data)
- Enables real-time updates (SQLite change triggers refresh all views)
- Scales to 100K+ nodes (JS objects can't)
- Persistence is automatic (SQLite → disk)

**Implementation:** `useSQLiteQuery` hook wraps `db.exec()`, returns data + loading state.

### 2. PAFV Axis Allocation is Mode-Independent

**Decision:** Axis allocation logic (LATCH filter → SQL projection) is decoupled from view renderer.

**Rationale:**
- Different views need same data differently grouped (grid: GROUP BY 2 dims; kanban: GROUP BY 1 dim)
- Query builder is view-aware but axis controller is view-agnostic
- Enables adding new views without changing core PAFV logic

**Implementation:** `GridContinuumController.allocateAxes()` → `ViewQueryBuilder.buildQuery()` → renderer receives pre-grouped data.

### 3. React for Table-Like Views (Gallery, List, Kanban), D3 for Temporal/Network

**Decision:**
- React renders Gallery (CSS Masonry), List (tree), Kanban (columns) — these are component-based
- D3 renders Network (SVG force graph), Timeline (SVG axis) — these need physics simulation or precise coordinate math

**Rationale:**
- React excels at declarative component rendering (expandable trees, drag-drop columns)
- D3 excels at data binding to SVG/Canvas (simulation, force, precise positioning)
- Avoid "React doing D3" (D3 in React refs) — let each tool do what it's best at

**Implementation:**
- Gallery/List/Kanban: React components with `useEffect` hooks for data sync
- Network/Timeline: D3 with React mount/unmount for lifecycle

### 4. Virtual Scrolling is Mandatory for Large Lists

**Decision:** Gallery and List views use TanStack Virtual for scrolling 100+ items.

**Rationale:**
- Rendering 500 DOM nodes kills browser performance
- Virtual scrolling renders only visible + buffer, keeps 60 FPS
- Already used in SuperGrid; leverage existing pattern

**Implementation:** `useVirtualizer` from `@tanstack/react-virtual`, update virtual range on query result change.

### 5. Drag-Drop is dnd-kit, Not HTML5 API

**Decision:** Use `dnd-kit` library for Kanban and Timeline drag interactions.

**Rationale:**
- HTML5 API is low-level, requires manual touch handling
- `dnd-kit` handles mouse + touch, provides drag preview, works on mobile
- Integrates well with React; no need for manual RAF loops

**Implementation:**
- Kanban: `DndContext` wraps columns, cards are draggable
- Timeline: Drag event to reschedule with `dnd-kit` + time scale mapping

### 6. Cross-View Selection via React Context

**Decision:** Single `SelectionContext` syncs selected node IDs across all views.

**Rationale:**
- Selecting a card in SuperGrid should highlight matching nodes in Timeline, Network, etc.
- Context API is lightweight and doesn't require Redux
- D3 data binding updates when context changes (via useEffect)

**Implementation:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>();

// In renderer: dispatch selection
onCardClick = (node) => selectionContext.setSelectedIds(new Set([node.id]));

// In D3: bind selection state
d3.selectAll('circle')
  .style('opacity', d => selectedIds.has(d.id) ? 1 : 0.3);
```

### 7. View State Preservation (Scroll, Zoom, Selection)

**Decision:** Save view state (scroll position, zoom level, selection) when switching modes, restore on return.

**Rationale:**
- Users switch between views, expect to return to same position
- Reduces cognitive load (no need to re-navigate)
- Scroll position lost = data loss (users can't find where they were)

**Implementation:**
- `ViewStateStore` in localStorage per view mode
- `getTransitionState()` saves before switching
- `loadState()` restores after switching
- Uses View transitions API for smooth animation

### 8. Async Drag-Drop Persistence (Kanban)

**Decision:** On drag-drop, immediately show optimistic UI update, then persist to SQLite.

**Rationale:**
- Instant feedback (no lag waiting for db.run)
- If persist fails, show conflict dialog instead of losing user's action
- Prevents "feels slow" drag-drop UX

**Implementation:**
```typescript
onDragEnd = async (event) => {
  // 1. Optimistic update: update React state immediately
  setCards(prev => [...prev]); // move card to new column

  // 2. Persist: update SQLite
  try {
    db.run("UPDATE nodes SET status = ? WHERE id = ?", [newStatus, nodeId]);
  } catch (e) {
    // 3. Rollback if fail
    setCards(prev => [...prev]); // restore old order
    showError("Failed to save drag-drop");
  }
}
```

---

## Scaling Considerations

| Scenario | Data Size | Approach | Notes |
|----------|-----------|----------|-------|
| Small project | <1000 nodes | Single query, no optimization | Works fine, no special handling |
| Large list | 5000-10000 nodes | Virtual scrolling + pagination | Load chunks as user scrolls |
| Large grid | 100×100 cells | Virtual rendering (only visible) | CSS Grid with `calc()` positioning, hide offscreen |
| Large network | 2000+ nodes | Canvas rendering + culling | Switch from SVG to Canvas, remove far-away nodes |
| Large timeline | 2000+ events | Virtual rendering by visible range | Only render events in zoom range |
| All views combined | 50K nodes, 3 concurrent views | One view active at a time | Three-Canvas shows one view per pane |

---

## Technology Rationale

| Technology | Layer | Why |
|-----------|-------|-----|
| **React 18** | UI/Components | Component-based rendering for Gallery/List/Kanban; hooks for state management |
| **D3.js v7** | Visualization | Force simulation (Network), time scales (Timeline), data binding |
| **sql.js (SQLite WASM)** | Data | Single source of truth, FTS5 search, recursive CTEs for hierarchy |
| **TanStack Virtual** | Optimization | Virtual scrolling for 100+ items, proven 60 FPS performance |
| **dnd-kit** | Interaction | Drag-drop with touch support, accessibility built-in |
| **react-resizable-panels** | Layout | Resizable panes for Three-Canvas container |
| **CSS Grid** | Layout | Native spanning for grid/kanban, no JS needed for layout |
| **Tailwind CSS** | Styling | Utility-first, design tokens for theming |

---

## Error Handling & Edge Cases

### Query Execution Failure

```typescript
// In useSQLiteQuery hook
try {
  const results = db.exec(query);
  setData(results);
} catch (e) {
  // If query fails (bad facet name, SQL error):
  showError(`Failed to load view: ${e.message}`);
  setData([]);  // Render empty view
}
```

### Large Result Sets

```typescript
// If query returns 10K+ rows:
// 1. Virtual scrolling handles Gallery/List
// 2. Grid uses culling: only render visible rows
// 3. Network switches to Canvas at 2000+ nodes
// 4. Timeline lazy-loads events by zoom range
```

### Drag-Drop Failure

```typescript
// If db.run() fails during Kanban drag:
// 1. Show "Failed to save" toast
// 2. Offer "Retry" or "Discard" options
// 3. Don't leave card in invalid state
```

### View Mode Switching

```typescript
// When switching modes:
// 1. Save current view state (scroll, selection, zoom)
// 2. Destroy old renderer
// 3. Build new query for target mode
// 4. Execute new query
// 5. Create new renderer
// 6. Load saved state for target mode (if exists)
```

---

## File Structure

```
src/
├── d3/
│   ├── renderers/
│   │   ├── GalleryRenderer.tsx      (React + CSS)
│   │   ├── ListRenderer.tsx         (React tree)
│   │   ├── KanbanRenderer.tsx       (React + dnd-kit)
│   │   ├── GridRenderer.tsx         (CSS Grid + D3 binding)
│   │   ├── SuperGridRenderer.tsx    (Already exists)
│   │   ├── NetworkRenderer.ts       (D3 SVG)
│   │   └── TimelineRenderer.ts      (D3 SVG)
│   ├── ViewRendererRegistry.ts      (Maps mode to renderer)
│   └── ViewTransitionManager.ts     (State preservation)
│
├── services/
│   ├── grid-continuum/
│   │   ├── GridContinuumController.ts
│   │   ├── ViewQueryBuilder.ts
│   │   └── HeaderDiscoveryService.ts (already exists)
│   └── supergrid/
│       └── SuperGridService.ts       (already exists)
│
├── hooks/
│   ├── useSQLiteQuery.ts            (Query execution + caching)
│   ├── useGridContinuum.ts          (Axis allocation + mode switch)
│   └── useViewState.ts              (Load/save view state)
│
├── components/
│   ├── GridContinuumSwitcher.tsx    (View mode selector buttons)
│   ├── ThreeCanvasLayout.tsx        (Resizable panes)
│   ├── ViewContainer.tsx            (Wraps active renderer)
│   └── SelectionHighlight.tsx       (Cross-view highlight overlay)
│
├── contexts/
│   ├── SelectionContext.ts          (Cross-view selection)
│   ├── FilterContext.ts             (LATCH filters, already exists)
│   ├── PAFVContext.ts               (Axis allocation)
│   └── ViewStateStore.ts            (Scroll/zoom/pane sizes)
│
└── types/
    ├── view.ts                      (ViewType, ViewRenderer, etc.)
    ├── grid-continuum.ts            (AxisAllocation, RenderConfig)
    └── query.ts                     (QueryResult, QueryBuilder)
```

---

## Testing Strategy

### Unit Tests

- **GridContinuumController:** Test `allocateAxes()` for each mode
- **ViewQueryBuilder:** Test SQL generation for each mode with different LATCH filters
- **HeaderDiscoveryService:** Test facet detection with grouped query results

### Integration Tests

- **Query → Renderer:** Execute sample query, verify renderer receives correct data
- **Mode Switch:** Switch modes, verify old state saved, new state restored
- **Drag-Drop:** Drag card in Kanban, verify SQL UPDATE executed, data persisted
- **Cross-View Selection:** Select in SuperGrid, verify highlight in Timeline/Network

### Performance Tests

- **Gallery with 500 items:** Verify 60 FPS scroll with TanStack Virtual
- **List with 5000 items:** Verify lazy-load on expand, no jank
- **Network with 1000 nodes:** Verify force simulation converges in <2 seconds
- **Three-Canvas pane resize:** Verify all views repaint smoothly on resize

### Visual Tests

- **CSS Masonry breakdown:** Verify gallery adapts to 1/2/3/4 columns
- **Sticky headers:** Verify row/column headers stay visible while scrolling
- **Hover states:** Verify card hover effects work in all views
- **Animations:** Verify expand/collapse and drag-drop animate smoothly

---

## Deployment & Migration

### Phase 1: Gallery + List (Week 1)

- Implement GalleryRenderer with virtual scrolling
- Implement ListRenderer with expand/collapse
- Wire GridContinuumController to both

### Phase 2: Kanban (Week 1-2)

- Implement KanbanRenderer with dnd-kit
- Add drag-drop persistence to db layer
- Test SQL UPDATE on drop

### Phase 3: Network + Timeline (Week 2-3)

- Implement NetworkRenderer with D3 force
- Implement TimelineRenderer with D3 time scale
- Add zoom/pan interaction handlers

### Phase 4: Three-Canvas Integration (Week 3-4)

- Implement ThreeCanvasLayout with react-resizable-panels
- Wire SelectionContext across all renderers
- Add cross-view highlight overlay

---

## Sources

### PAFV Architecture
- Internal Isometry documentation (PAFV specification)
- Cartographic visualization principles (Pan vs Zoom model)

### React Rendering Patterns
- [React Official: Data Binding Best Practices](https://react.dev/learn/rendering-lists)
- [React: Refs and the DOM (for D3 integration)](https://react.dev/reference/react/useRef)

### D3 Integration with React
- [Observable: D3 and React](https://observablehq.com/@d3/data-driven-components)
- [Modern D3 with React (2026)](https://medium.com/nmc-techblog/using-react-with-d3-b34cc4cdf8a4)

### Virtual Scrolling
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest)
- [React Window Performance Guide](https://web.dev/virtualization/)

### Drag-Drop Architecture
- [dnd-kit Documentation](https://docs.dnd-kit.com/)
- [Draggable UI Patterns (2026)](https://www.eleken.co/blog-posts/drag-and-drop-ui)

### State Management in React
- [React Context API Guide](https://react.dev/reference/react/useContext)
- [Context vs Redux (2026 comparison)](https://medium.com/@jordanrabbit/context-vs-redux-in-2025-1f3d78a14c8b)

---

## Open Design Questions

1. **Canvas rendering threshold for Network:** Should we switch SVG→Canvas at 500 nodes or 2000? Answer: 1000 nodes is safe threshold, canvas fallback for >2000.

2. **Lazy-load children in List:** Should we paginate by depth (load all at depth 1, then depth 2) or by parent (load all children of one parent on expand)? Answer: By parent; more intuitive and faster.

3. **Timeline overlapping event layout:** Should overlapping events use swimlanes (separate rows per event) or stacking (events stacked horizontally within row)? Answer: Swimlanes; clearer and easier to click.

4. **View state persistence:** Save to localStorage or IndexedDB? Answer: localStorage for scroll/zoom (simple key-value), IndexedDB for complex state (selection, filters).

5. **Pane resize persistence:** Save pane sizes on every resize or only on app close? Answer: On resize with debounce (500ms); localStorage is fast, no need to wait.

---

*Architecture research for: Grid Continuum & Polymorphic Views (v6.9)*
*Researched: 2026-02-16*
*Pattern: PAFV Controller → Query Builder → sql.js → View Renderer → DOM*
