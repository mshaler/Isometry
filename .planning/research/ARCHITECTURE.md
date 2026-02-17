# Architecture Patterns: Polymorphic Views Integration

**Project:** Isometry v6.9 — Gallery/List/Kanban, Network/Timeline, Three-Canvas Notebook
**Mode:** Ecosystem Research
**Researched:** 2026-02-16
**Overall confidence:** HIGH

---

## Executive Summary

Isometry's view architecture is built on **provider composition** (React contexts) + **renderer dispatch** (D3.js). The system separates state management (React) from visualization (D3.js). Polymorphic view switching (Gallery → List → Kanban → Grid → SuperGrid → Network → Timeline) works by:

1. **AppStateContext** tracks `activeView` (which view to render)
2. **PAFVContext** tracks axis mappings (which data dimensions to display)
3. **SelectionContext** tracks selected cards (cross-canvas synchronization)
4. **FilterContext** tracks LATCH filters (which rows to include)
5. D3 renderers consume these contexts and re-render on state changes

**Key insight:** View switching does NOT require view-specific SQL queries. All views query the same filtered dataset via `useSQLiteQuery()`, then each renderer projects it differently. This eliminates duplication and ensures data consistency.

---

## Existing Architecture (HIGH CONFIDENCE)

### State Management Hierarchy

```
<App>
  ├─ DatabaseProvider (sql.js instance)
  ├─ FilterProvider (LATCH filters + compiled SQL WHERE clauses)
  ├─ PAFVProvider (axis mappings for planes x/y/z)
  ├─ SelectionProvider (selected card IDs + anchor for range select)
  ├─ AppStateProvider (activeView + activeDataset + activeApp)
  ├─ ThemeProvider (light/dark mode, CSS themes)
  └─ NotebookProvider (THREE-CANVAS, being added)
```

**All contexts are peer-level.** No hierarchy beyond database access. This keeps contexts decoupled and prevents cascading re-renders.

### Data Binding Pattern (Core)

Current pattern observed in SuperGrid and will extend to all views:

```typescript
// 1. React component reads state
function MyViewRenderer() {
  const { state: pafvState } = usePAFV();
  const { filters } = useFilterContext();
  const { db } = useSQLite();

  // 2. Compute SQL WHERE/ORDER BY from React state
  const sqlWhere = compileLatchFilters(filters);
  const sqlOrderBy = compilePafvToOrderBy(pafvState);

  // 3. Query data once
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${sqlWhere}
    ORDER BY ${sqlOrderBy}
  `);

  // 4. Effect: re-render D3 on data change
  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Pure function: D3 renderer consumes React-managed state
    renderD3Visualization(containerRef.current, data, {
      viewMode: 'list', // from activeView
      pafvProjection: pafvState.mappings,
      selectedIds: selection.selectedIds,
    });
  }, [data, pafvState, selection]);

  return <div ref={containerRef} />;
}
```

**Pattern name:** "React controls what to render; D3 renders it"

### Current View Type System

From `AppStateContext.tsx`:

```typescript
export type ViewName =
  | 'List'
  | 'Gallery'
  | 'Timeline'
  | 'Calendar'
  | 'Tree'
  | 'Kanban'
  | 'Grid'
  | 'Charts'
  | 'Graphs'
  | 'SuperGrid';
```

From `types/view.ts`:

```typescript
export type GridContinuumMode = 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid';
export type ViewType = GridContinuumMode | 'timeline' | 'calendar' | 'network' | 'tree';
```

**Note:** Two type systems exist. `ViewName` in AppStateContext (capitalized, app-level) and `GridContinuumMode` + `ViewType` in types/view.ts (lowercase, renderer-level). These should be unified.

### Existing Renderers

| View | Location | Type | Status | SQL Pattern |
|------|----------|------|--------|------------|
| **SuperGrid** | `src/components/supergrid/SuperGrid.tsx` | React + CSS Grid | Active | `useHeaderDiscovery()` + `useGridDataCells()` |
| **D3 Network** | `src/d3/visualizations/network/ForceGraphRenderer.ts` | D3.js | Active | Custom `createGraphData()` + force simulation |
| **D3 Timeline** | `src/d3/visualizations/timeline/TimelineRenderer.ts` | D3.js | Active | Custom `createTimelineEvents()` |
| **Kanban** | `src/d3/KanbanView.ts` | D3.js | Active | Facet grouping + data processor |
| **List** | `src/d3/ListView.ts` | D3.js | Active | Hierarchical tree view |
| **Gallery** | (In planning) | React or D3? | Not yet built | Should be simple layout grid |

---

## Integration Architecture (RECOMMENDED)

### 1. Gallery/List/Kanban — CSS Grid vs D3

**Question:** Should these use CSS Grid (like SuperGrid) or D3.js (like current renderers)?

**Recommendation:** Use **React + CSS Grid for tabular layouts** (Gallery, List, Kanban), **D3.js for spacial/network layouts** (Network, Timeline, and SuperGrid).

**Rationale:**

| Consideration | CSS Grid | D3.js |
|---------------|----------|-------|
| **Virtualization** | Good (CSS Grid native) | Manual (D3's approach) |
| **Drag-drop** | Good (React DnD) | Good (D3 drag behavior) |
| **Responsive** | Native CSS media queries | Requires resize handler |
| **Performance** | DOM-based, fast updates | SVG-based, slower with many items |
| **Consistency** | Matches SuperGrid approach | Consistent with Network/Timeline |

**Decision matrix:**

- **Gallery** (masonry, no axes) → React + CSS Grid + Masonry library
- **List** (single axis, hierarchical) → React + CSS Grid or D3.js (either works)
- **Kanban** (facet columns) → React + CSS Grid (cards in columns)
- **Network** (GRAPH edges) → D3.js (force simulation requires SVG)
- **Timeline** (time × track) → D3.js (scaleTime for X-axis, scales for spatial layout)
- **SuperGrid** (n-dimensional headers) → React + CSS Grid + D3 (hybrid: CSS for grid, D3 for headers)

**Implementation:** Build Gallery/List/Kanban as **React components that consume the same `useSQLiteQuery()` hook**, not as separate D3 renderers.

### 2. Component Structure: New Views

#### Gallery View Component

```typescript
// src/components/views/GalleryView.tsx
import { useSQLiteQuery } from '@/hooks';
import { usePAFV } from '@/hooks/usePAFV';
import { useSelection } from '@/state/SelectionContext';
import { useFilterContext } from '@/contexts/FilterContext';
import { Masonry } from 'react-grid-masonry'; // or framer-motion

export function GalleryView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const { state: pafvState } = usePAFV();
  const { select, toggle } = useSelection();

  // Query: same pattern as SuperGrid
  const sqlWhere = compileLatchFilters(filters);
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${sqlWhere}
    ORDER BY modified_at DESC
  `);

  // Render: React JSX with masonry layout
  return (
    <Masonry columns={[1, 2, 3]} gap={16}>
      {data?.map(card => (
        <GalleryCard
          key={card.id}
          card={card}
          isSelected={selection.selectedIds.has(card.id)}
          onSelect={() => select(card.id)}
          onToggle={() => toggle(card.id)}
        />
      ))}
    </Masonry>
  );
}
```

**Key pattern:** Same `useSQLiteQuery()` hook, different layout component.

#### List View Component

```typescript
// src/components/views/ListView.tsx
export function ListView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
    ORDER BY hierarchy, name
  `);

  // Render: hierarchical tree using React recursion or CSS Grid
  return (
    <div className="list-view">
      {data?.map(card => (
        <ListItem key={card.id} card={card} level={getHierarchyLevel(card)} />
      ))}
    </div>
  );
}
```

#### Kanban View Component

```typescript
// src/components/views/KanbanView.tsx
export function KanbanView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const { state: pafvState } = usePAFV();
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
    ORDER BY ${getFacetColumn(pafvState.mappings[0])}, name
  `);

  // Group by facet (e.g., status)
  const grouped = groupBy(data, getFacetColumn(pafvState.mappings[0]));

  return (
    <div className="kanban-view">
      {Object.entries(grouped).map(([facetValue, cards]) => (
        <KanbanColumn key={facetValue} title={facetValue}>
          {cards.map(card => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </KanbanColumn>
      ))}
    </div>
  );
}
```

### 3. Network/Timeline — Wiring D3 to SQL Hooks

Current pattern in ForceGraphRenderer and TimelineRenderer is **standalone** — they don't use SQL hooks. Need to wire them into the data flow.

#### Pattern: D3 Renderer as Effect

```typescript
// src/components/views/NetworkView.tsx
export function NetworkView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const containerRef = useRef<SVGGElement>(null);

  // Query nodes
  const nodeData = useSQLiteQuery(db, `
    SELECT * FROM nodes WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
  `);

  // Query edges (relationships)
  const edgeData = useSQLiteQuery(db, `
    SELECT * FROM edges WHERE deleted_at IS NULL
  `);

  // Render D3 on data change
  useEffect(() => {
    if (!containerRef.current || !nodeData || !edgeData) return;

    const graphData = {
      nodes: nodeData.map(n => ({ id: n.id, label: n.name, ...n })),
      links: edgeData.map(e => ({ source: e.source_id, target: e.target_id, ...e })),
    };

    createForceGraph(containerRef.current, graphData.nodes, graphData.links, {
      width: 1200,
      height: 600,
    });
  }, [nodeData, edgeData]);

  return <svg ref={containerRef} />;
}
```

#### Pattern: Timeline Renderer

```typescript
// src/components/views/TimelineView.tsx
export function TimelineView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const containerRef = useRef<SVGGElement>(null);

  // Query events with time dimension
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL
      AND (created_at IS NOT NULL OR modified_at IS NOT NULL)
      ${compileLatchFilters(filters)}
    ORDER BY created_at ASC
  `);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const timelineEvents = data.map(card => ({
      id: card.id,
      timestamp: new Date(card.created_at || card.modified_at || Date.now()),
      track: card.folder || 'Uncategorized',
      title: card.name,
    }));

    createTimeline(containerRef.current, timelineEvents, {
      width: 1200,
      height: 400,
      margin: { top: 20, right: 20, bottom: 20, left: 100 },
    });
  }, [data]);

  return <svg ref={containerRef} />;
}
```

### 4. Three-Canvas Notebook Integration

The Three-Canvas (Capture, Shell, Preview) is a **layout container**, not a view renderer. It coordinates view switching within the Preview pane.

#### Architecture

```
<NotebookLayout>
  ├─ <CapturePane>          ← TipTap editor, /save-card command
  ├─ <ShellPane>            ← Terminal tabs (Claude AI, Claude Code, GSD)
  └─ <PreviewPane>
      ├─ Tabs: SuperGrid | Network | Timeline | List | Gallery
      └─ <ViewDispatcher>    ← Mounts correct view based on activeView
          └─ <SuperGridView /> or <NetworkView /> or <TimelineView />
```

#### ViewDispatcher Pattern

```typescript
// src/components/views/ViewDispatcher.tsx
export function ViewDispatcher() {
  const { activeView } = useAppState();
  const viewMode: GridContinuumMode = mapViewNameToMode(activeView);

  // Map view name to React component
  const viewComponents: Record<ViewType, React.ComponentType> = {
    gallery: GalleryView,
    list: ListView,
    kanban: KanbanView,
    grid: GridView,
    supergrid: SuperGridView,
    network: NetworkView,
    timeline: TimelineView,
  };

  const ViewComponent = viewComponents[viewMode] || SuperGridView;

  return <ViewComponent />;
}
```

**Important:** ViewDispatcher is always mounted in PreviewPane, so view switching simply unmounts old component and mounts new one. State preservation handled by AppStateContext + url-synced state.

### 5. Mode Switching: GridContinuumController

**Current state:** GridContinuumSwitcher exists as UI. Need GridContinuumController (non-UI logic) that:

1. Receives view switch request
2. Validates axis configurations for new mode
3. Calls `setActiveView()` in AppStateContext
4. Preserves selection if possible (cross-canvas sync)

```typescript
// src/components/supergrid/GridContinuumController.ts
export class GridContinuumController {
  /**
   * Switch grid mode, validating axis requirements
   * - gallery: 0 axes required
   * - list: 1 axis (Y)
   * - kanban: 1 axis (facet grouping)
   * - grid: 2 axes (X, Y)
   * - supergrid: 3+ axes (X, Y, Z+)
   */
  switchMode(newMode: GridContinuumMode, pafvState: PAFVState): boolean {
    const requiredAxes = {
      gallery: 0,
      list: 1,
      kanban: 1,
      grid: 2,
      supergrid: 3,
    }[newMode];

    const currentAxes = pafvState.mappings.length;

    if (currentAxes < requiredAxes) {
      // Prompt user to add axes
      console.warn(`${newMode} requires at least ${requiredAxes} axes, current: ${currentAxes}`);
      return false;
    }

    return true;
  }
}
```

---

## Data Flow: Four Scenarios

### Scenario 1: User Clicks View Switcher (Gallery → List)

```
1. GridContinuumSwitcher button click
   └─> onModeChange('list')

2. ViewDispatcher receives activeView = 'List'
   └─> mounts ListView component

3. ListView:
   a. Calls useFilterContext() → gets current filters
   b. Calls useSQLiteQuery() → queries filtered nodes
   c. Renders list items with React JSX

4. Selection state preserved:
   a. SelectionContext still has selectedIds
   b. ListView can highlight selected items
```

**SQL execution:** 1 query per render (batched in useSQLiteQuery hook)

### Scenario 2: User Changes PAFV Axis (Grid → Network Projection)

```
1. PAFVNavigator shows "X-axis: folder, Y-axis: status"
2. User clicks "X-axis: author" → setMapping('x', 'alphabet', 'author')

3. PAFVContext updates:
   a. state.mappings = [{dimension: 'alphabet', field: 'author', plane: 'x'}, ...]
   b. Notifies subscribers

4. Affected views re-render:
   a. SuperGrid: re-calculates header tree with new X-axis
   b. List: re-orders items by author
   c. Network: unchanged (doesn't use PAFV axes, uses GRAPH edges)

5. Selection preserved across views
```

**Pattern:** Axis change is orthogonal to view mode. Both can change independently.

### Scenario 3: User Filters by Category (All Views Updated)

```
1. FilterBar checkbox: "status: done"
   └─> setFilter({ axis: 'category', facet: 'status', value: 'done' })

2. FilterContext compiles to SQL:
   WHERE status = 'done' AND deleted_at IS NULL

3. All mounted views re-query:
   a. useFilterContext() detects filter change
   b. useSQLiteQuery() re-executes with new WHERE clause
   c. React re-renders children with new data

4. Selection auto-cleaned:
   - If selected card filtered out, deselect it
   - Keeps consistency across views
```

**Pattern:** Filters flow through useSQLiteQuery hook, affecting all views simultaneously.

### Scenario 4: User Creates Card in Capture Pane

```
1. CapturePane TipTap editor: "/save-card"
   └─> NotebookContext.createCard(type, templateId?)

2. NotebookContext.createCard():
   a. Generates unique id
   b. db.execute(INSERT INTO nodes ...)
   c. db.execute(INSERT INTO notebook_cards ...)
   d. Triggers notification to dependent queries

3. All preview views re-query:
   a. useSQLiteQuery() hook detects database change
   b. Re-executes SELECT query
   c. React renders new card

4. New card appears in SuperGrid, Network, Timeline, etc. immediately
```

**Pattern:** Direct sql.js mutations → all views via query invalidation.

---

## Component Boundaries

### New Components to Build

| Component | Location | Responsibility | Depends On |
|-----------|----------|-----------------|-----------|
| **GalleryView** | `src/components/views/GalleryView.tsx` | Masonry layout, card grid | useSQLiteQuery, useSelection, useFilterContext |
| **ListView** | `src/components/views/ListView.tsx` | Hierarchical tree list | useSQLiteQuery, useSelection, usePAFV |
| **KanbanView** | `src/components/views/KanbanView.tsx` | Facet-based columns | useSQLiteQuery, usePAFV, useSelection |
| **NetworkView** | `src/components/views/NetworkView.tsx` | D3 force graph | useSQLiteQuery, D3 ForceGraphRenderer |
| **TimelineView** | `src/components/views/TimelineView.tsx` | D3 timeline | useSQLiteQuery, D3 TimelineRenderer |
| **ViewDispatcher** | `src/components/views/ViewDispatcher.tsx` | Routes to correct view component | useAppState, all view components |
| **GridContinuumController** | `src/d3/GridContinuumController.ts` | Mode validation logic (non-UI) | PAFVState |

### Modified Components

| Component | Change | Impact |
|-----------|--------|--------|
| **PreviewPane** | Mount ViewDispatcher instead of hardcoded SuperGrid | Enables view switching in notebook |
| **IntegratedLayout** | Adopt ViewDispatcher if not using three-canvas | Enables mode switching in main app |
| **AppStateContext** | Rename/unify ViewName with ViewType enums | Eliminates type confusion |

### Unchanged

- FilterContext (keeps compiling LATCH → SQL)
- PAFVContext (keeps managing axis mappings)
- SelectionContext (keeps tracking selected IDs)
- DatabaseProvider (sql.js instance)

---

## SQL Hook Pattern: useSQLiteQuery

**Core hook that all views use.** Already exists but needs to be consistent across new views.

```typescript
// src/hooks/useSQLiteQuery.ts
export function useSQLiteQuery(
  db: Database | null,
  query: string,
  params?: unknown[],
  options?: { enabled?: boolean }
): QueryResult[] | null {
  const [data, setData] = useState<QueryResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db || options?.enabled === false) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = db.exec(query, params);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [db, query, JSON.stringify(params)]);

  return data;
}
```

**Usage pattern across all views:**

```typescript
// Every new view follows this pattern
function MyView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();

  const sqlWhere = compileLatchFilters(filters);
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${sqlWhere}
    ORDER BY name
  `);

  return <div>{data && renderData(data)}</div>;
}
```

---

## Density & Sparsity (Janus Model)

SuperGrid's Janus Density Model (Value × Extent) should NOT apply to all views.

| View | Pan (Extent) | Zoom (Value) | Control | Example |
|------|--------------|--------------|---------|---------|
| **Gallery** | ✓ Sparse-only (show all cards) | ✗ N/A | No density control | Show all as tiles |
| **List** | ✗ N/A | ✓ Expandable (levels) | Hierarchy depth slider | Show Level 1, 2, 3 |
| **Kanban** | ✓ Sparse/Full | ✗ N/A | Extent slider | Show non-empty columns only |
| **SuperGrid** | ✓ Both | ✓ Both | Janus controls | Full density matrix |
| **Network** | ✗ N/A | ✓ Zoom | D3 zoom behavior | Pinch/scroll zoom |
| **Timeline** | ✓ Date range | ✓ Zoom | Time scrubber | Pan timeline, zoom events |

**Pattern:** Density controls are view-specific, not global. SuperGrid defines the full Janus model; others implement subset.

---

## Known Pitfalls & Avoidance

### Pitfall 1: Duplicate SQL Queries Per View

**Problem:** Each view independently compiles filters → multiple DB queries for same data.

**Prevention:**
- Use shared `useSQLiteQuery()` hook with same WHERE clause
- Query once at container level, pass data to views
- Or: use query result caching in hook

**Detection:** Run DevTools SQL profiler, count SELECT statements per filter change.

### Pitfall 2: Selection State Lost on View Switch

**Problem:** Switching from SuperGrid to Network loses selected cards.

**Prevention:**
- SelectionContext is global (lives in top provider)
- Each view's `registerScrollToNode()` on mount
- Selection survives view transitions by design

**Detection:** Switch views, verify selected IDs still present in SelectionContext.

### Pitfall 3: D3 Renderers Not Receiving React State Changes

**Problem:** Axis changes in PAFVContext don't propagate to D3 force graph.

**Prevention:**
- D3 renderer runs in useEffect that watches PAFV state
- Re-mount D3 simulation on state change (or update forces)
- Use D3 transitions to smooth changes

**Detection:** Change axis while viewing Network graph, verify node positions update.

### Pitfall 4: Three-Canvas Panes Unaware of Each Other

**Problem:** Creating card in Capture doesn't update Preview, or Preview change doesn't reflect in Shell.

**Prevention:**
- NotebookContext triggers database notifications
- All panes use same hooks (useSQLiteQuery, SelectionContext)
- Shell observes Preview selections for context

**Detection:** Create card, switch to Preview, verify new card appears.

### Pitfall 5: View Mode Requirements Not Validated

**Problem:** User tries to switch to Grid mode with only 1 axis, crashes.

**Prevention:**
- GridContinuumController validates before switching
- Show helpful error: "Grid requires 2 axes. Add Y-axis?"
- Prevent invalid transitions at UI level

**Detection:** Try to switch to Grid with <2 axes, verify graceful error.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| **Current architecture** | HIGH | Reviewed AppStateContext, SelectionContext, usePAFV, useSQLiteQuery in codebase |
| **CSS Grid for new views** | HIGH | Observed SuperGrid's CSS Grid + React pattern, matches performance needs |
| **D3 wiring pattern** | MEDIUM-HIGH | ForceGraphRenderer and TimelineRenderer exist but don't use sql hooks; pattern inferred from SuperGrid |
| **ViewDispatcher pattern** | MEDIUM | Follows React composition patterns, not yet built; needs validation |
| **Notebook integration** | MEDIUM | Architecture documented but implementation incomplete; PAFV/Selection contexts confirmed |
| **Three-canvas pane coordination** | LOW | NotebookContext structure inferred; actual implementation may reveal dependencies |

---

## Build Order (Recommended)

### Phase 1: Foundation (Week 1)
- [ ] Unify ViewName / ViewType / GridContinuumMode enums
- [ ] Build ViewDispatcher component
- [ ] Build GridContinuumController logic

### Phase 2: Simple Views (Week 2)
- [ ] Build GalleryView (React + CSS Grid + Masonry)
- [ ] Build ListView (React + CSS)
- [ ] Build KanbanView (React + CSS + groupBy logic)

### Phase 3: Complex Views (Week 3)
- [ ] Refactor NetworkView to use useSQLiteQuery
- [ ] Refactor TimelineView to use useSQLiteQuery
- [ ] Add PAFV support to Network (if needed)

### Phase 4: Integration (Week 4)
- [ ] Wire Three-Canvas PreviewPane with ViewDispatcher
- [ ] Test view switching with selections preserved
- [ ] Test PAFV changes across views
- [ ] Test filter changes across views

### Phase 5: Polish (Week 5)
- [ ] Keyboard shortcuts for view switching
- [ ] Smooth transitions between views (D3 transitions for compatible pairs)
- [ ] Performance benchmarks (DOM for React views, SVG for D3)
- [ ] Accessibility audit (ARIA labels for view switcher)

---

## Architecture Decisions

### Decision 1: React Components for Tabular Views

**Chosen:** React (CSS Grid) for Gallery, List, Kanban
**Rejected:** D3.js for all views (would be inconsistent with SuperGrid's React approach)
**Rationale:** Faster DOM updates, simpler DnD, native virtualization

### Decision 2: Shared useSQLiteQuery Hook

**Chosen:** All views use same `useSQLiteQuery()` with compiled filters
**Rejected:** Each view implements its own SQL query (would duplicate logic)
**Rationale:** Single source of truth for data, easier filter/PAFV propagation

### Decision 3: ViewDispatcher as Route Component

**Chosen:** ViewDispatcher mounts/unmounts view components on mode change
**Rejected:** Conditional rendering inside one mega-component
**Rationale:** Cleaner component boundaries, easier to test individual views

### Decision 4: GlobalSelection (SelectionContext) Not View-Specific

**Chosen:** SelectionContext is global, survives view transitions
**Rejected:** Each view manages its own selection (separate Set<id> per view)
**Rationale:** Cross-canvas sync (create card in Capture, select it in Preview), operations apply to multiple views

---

## Integration Points Summary

| Integration Point | Current | New | Impact |
|------------------|---------|-----|--------|
| **View list** | SuperGrid only | SuperGrid + Gallery/List/Kanban/Network/Timeline | ViewDispatcher routes, AppStateContext tracks activeView |
| **SQL queries** | useHeaderDiscovery + useGridDataCells (SuperGrid-specific) | Unified useSQLiteQuery | Consistency across views |
| **PAFV integration** | Axis mappings → SuperGrid headers | Axis mappings → all views | PAFV changes affect all views simultaneously |
| **Selection sync** | SelectionContext → SuperGrid | SelectionContext → all views | Selection preserved across view transitions |
| **Filter propagation** | FilterContext → SuperGrid | FilterContext → all views via useSQLiteQuery | Single filter query, all views update |
| **Three-Canvas** | Not present | PreviewPane + ViewDispatcher | Notebook layout coordinates view switching |

---

## Gaps & Phase-Specific Research

**To be addressed in Phase implementation:**

1. **Keyboard navigation:** How do List/Network/Timeline implement keyboard selection? Need unified keyboard controller.
2. **Virtualization:** List and Kanban need virtualization for 10K+ items. Research React Window integration.
3. **Drag-drop:** Gallery/Kanban need drag-drop. How to sync with D3 Network/Timeline drag?
4. **Transitions:** Can D3 transitions smoothly morph SuperGrid → Network? Test D3 morphs.
5. **Shell integration:** How does Claude Code terminal in Shell pane interact with view changes?

---

## References

- **Existing:**
  - `src/components/supergrid/SuperGrid.tsx` — SuperStack + CSS Grid + PAFV pattern
  - `src/contexts/AppStateContext.tsx` — activeView + URL syncing
  - `src/state/SelectionContext.tsx` — multi-view selection sync
  - `src/d3/visualizations/network/ForceGraphRenderer.ts` — D3 network renderer (needs SQL hook wiring)
  - `src/d3/visualizations/timeline/TimelineRenderer.ts` — D3 timeline renderer (needs SQL hook wiring)

- **To be created:**
  - `src/components/views/ViewDispatcher.tsx`
  - `src/components/views/GalleryView.tsx`
  - `src/components/views/ListView.tsx`
  - `src/components/views/KanbanView.tsx`
  - `src/components/views/NetworkView.tsx`
  - `src/components/views/TimelineView.tsx`
  - `src/d3/GridContinuumController.ts`

---

*Research completed 2026-02-16 by Claude Code*
*Architecture patterns HIGH confidence; implementation details MEDIUM confidence pending phase work*
