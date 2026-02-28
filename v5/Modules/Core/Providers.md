# Isometry v5 Providers Specification

> **Canonical Reference:** See [Contracts.md](./Contracts.md) for:
> - [State Persistence Tiers](./Contracts.md#6-state-persistence-tiers)
> - [SQL Safety Rules](./Contracts.md#7-sql-safety-rules)

## Overview

Providers are the reactive state management layer between sql.js (data) and D3.js (rendering). They maintain UI state, compile queries, and coordinate cross-component communication without framework dependencies.

**Design Principle:** Providers are thin orchestration layers, not data stores. SQLite is the source of truth. Providers translate user intent into SQL and broadcast state changes to subscribers.

---

## Critical Architecture Decision: sql.js IS the Reactive Store

### The Key Insight

sql.js runs SQLite entirely in WASM memory. It is already an in-memory database. **Do not build a parallel observable store that duplicates data from SQLite.**

### ❌ RED: Anti-Patterns to Avoid

```typescript
// ❌ WRONG: Maintaining a parallel store
class CardStore {
  private cards: Map<string, Card> = new Map();  // DON'T DO THIS
  private observers = new Set<() => void>();
  
  async sync() {
    // Fetches all cards from SQLite into memory
    const rows = await workerBridge.query('SELECT * FROM cards');
    this.cards = new Map(rows.map(r => [r.id, r]));
    this.notify();
  }
  
  getCard(id: string): Card | undefined {
    return this.cards.get(id);  // Reading from duplicate store
  }
}

// ❌ WRONG: Observable arrays that mirror database tables
import { observable, makeAutoObservable } from 'mobx';

class DataStore {
  @observable cards: Card[] = [];  // DON'T DO THIS
  @observable connections: Connection[] = [];
  
  // Now you have two sources of truth
}

// ❌ WRONG: Redux/Zustand store holding entity data
const useStore = create((set) => ({
  cards: [],  // DON'T DO THIS
  setCards: (cards) => set({ cards }),
}));

// ❌ WRONG: Normalizing data client-side
import { normalize, schema } from 'normalizr';

// SQL already normalizes. Don't re-normalize in JS.
```

**Why these are wrong:**
- **Double memory usage** — Data exists in WASM heap AND JS heap
- **Stale data risk** — Two sources of truth can diverge
- **Sync complexity** — Must keep parallel store updated
- **Wasted effort** — sql.js already indexes, filters, joins

### ✅ GREEN: Correct Pattern — Query on Demand + Notify on Mutation

```typescript
// ✅ CORRECT: Single mutation point with notification
class MutationManager {
  private subscribers = new Set<() => void>();
  private pendingNotify = false;
  
  // ALL writes go through here
  async exec(sql: string, params: any[] = []): Promise<void> {
    await workerBridge.exec(sql, params);
    this.scheduleNotify();
  }
  
  // Reads don't notify — they're just queries
  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return workerBridge.query<T>(sql, params);
  }
  
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  private scheduleNotify(): void {
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    
    // Batch within animation frame
    requestAnimationFrame(() => {
      this.pendingNotify = false;
      this.subscribers.forEach(cb => cb());
    });
  }
}

export const mutations = new MutationManager();
```

```typescript
// ✅ CORRECT: Providers hold UI state only, not entity data
class FilterProvider {
  // UI state: what filters are active
  private state: FilterState = { filters: {}, searchQuery: null };
  
  // NOT card data — just compiled SQL
  private cachedWhere: string | null = null;
  private cachedParams: any[] = [];
  
  setFilter(axis: LATCHAxis, filter: Filter): void {
    this.state.filters[axis] = filter;
    this.invalidateCache();
    this.notify();
  }
  
  // Compiles UI state to SQL — doesn't fetch data
  getCompiledSQL(): { where: string; params: any[] } {
    if (!this.cachedWhere) {
      const result = compileFilters(this.state);
      this.cachedWhere = result.where;
      this.cachedParams = result.params;
    }
    return { where: this.cachedWhere, params: this.cachedParams };
  }
}
```

```typescript
// ✅ CORRECT: D3 renderer queries fresh on notification
class SuperGridRenderer {
  private data: AggregatedCell[] = [];
  
  constructor() {
    // Re-query when mutations occur OR provider state changes
    mutations.subscribe(() => this.requery());
    filterProvider.subscribe(() => this.requery());
    pafvProvider.subscribe(() => this.requery());
    
    // Re-render (no query) for visual-only changes
    selectionProvider.subscribe(() => this.updateSelectionVisuals());
    densityProvider.subscribe(() => this.rerender());
  }
  
  private async requery(): Promise<void> {
    const { where, params } = filterProvider.getCompiledSQL();
    const groupBy = pafvProvider.getGroupBySQL();
    
    // Fresh query from sql.js — the ONLY source of truth
    this.data = await mutations.query(`
      SELECT ${groupBy}, COUNT(*) as count
      FROM cards
      WHERE ${where}
      GROUP BY ${groupBy}
    `, params);
    
    this.rerender();
  }
  
  private rerender(): void {
    // D3 binds to query results — no intermediate store
    this.svg.selectAll('g.cell')
      .data(this.data, d => d.groupKey)
      .join('g')
      // ...
  }
}
```

### The Data Flow

```
User Action
    │
    ▼
┌─────────────────┐
│    Provider     │  ← Holds UI state (filters, axes, selection)
│  (state change) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MutationManager │  ← If write: exec() then notify()
│   or direct     │  ← If read-only UI change: just notify()
└────────┬────────┘
         │
    notify()
         │
         ▼
┌─────────────────┐
│   D3 Renderer   │  ← Subscribes to changes
│                 │
│  1. Re-query    │  ← Fresh SQL query to sql.js
│     sql.js      │
│                 │
│  2. Bind data   │  ← Results go directly to D3
│     to DOM      │
└─────────────────┘
```

### What Each Layer Holds

| Layer | Holds | Doesn't Hold |
|-------|-------|--------------|
| **sql.js** | All entity data (cards, connections) | UI state |
| **Providers** | UI state (filters, axes, selection, density) | Entity data |
| **MutationManager** | Subscriber list | Any data |
| **D3 Renderer** | Current query results (ephemeral) | Cached entity copies |

### Fine-Grained Invalidation (Optional Optimization)

For large datasets, you can track which tables changed:

```typescript
// ✅ CORRECT: Fine-grained change tracking (optional)
interface MutationEvent {
  tables: Set<'cards' | 'connections' | 'app_state'>;
  operation: 'insert' | 'update' | 'delete';
  affectedIds?: string[];  // For surgical re-renders
}

class MutationManager {
  async exec(
    sql: string, 
    params: any[] = [],
    meta?: MutationEvent
  ): Promise<void> {
    await workerBridge.exec(sql, params);
    this.notify(meta);
  }
  
  subscribe(callback: (event?: MutationEvent) => void): () => void {
    // ...
  }
}

// Renderer can skip re-query if irrelevant tables changed
mutations.subscribe((event) => {
  if (!event || event.tables.has('cards')) {
    this.requery();
  }
});
```

### Testing the Pattern

```typescript
describe('MutationManager', () => {
  it('notifies subscribers after exec', async () => {
    const callback = jest.fn();
    mutations.subscribe(callback);
    
    await mutations.exec('INSERT INTO cards (id, name) VALUES (?, ?)', ['1', 'Test']);
    
    // Wait for requestAnimationFrame
    await new Promise(r => requestAnimationFrame(r));
    
    expect(callback).toHaveBeenCalledTimes(1);
  });
  
  it('batches rapid mutations into single notification', async () => {
    const callback = jest.fn();
    mutations.subscribe(callback);
    
    // Three rapid mutations
    mutations.exec('UPDATE cards SET name = ? WHERE id = ?', ['A', '1']);
    mutations.exec('UPDATE cards SET name = ? WHERE id = ?', ['B', '2']);
    mutations.exec('UPDATE cards SET name = ? WHERE id = ?', ['C', '3']);
    
    await new Promise(r => requestAnimationFrame(r));
    
    // Single batched notification
    expect(callback).toHaveBeenCalledTimes(1);
  });
  
  it('queries return fresh data without notification', async () => {
    const callback = jest.fn();
    mutations.subscribe(callback);
    
    const results = await mutations.query('SELECT * FROM cards');
    
    expect(callback).not.toHaveBeenCalled();
    expect(results).toBeDefined();
  });
});
```

### Summary

| Principle | Implementation |
|-----------|----------------|
| **sql.js is the store** | Don't duplicate entity data in JS objects |
| **Providers hold UI state** | Filters, axes, selection — not cards |
| **Notify on mutation** | MutationManager broadcasts "something changed" |
| **Query on demand** | D3 re-queries sql.js when notified |
| **No sync problem** | One source of truth eliminates staleness |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Provider Layer                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │FilterProvider│  │ PAFVProvider │  │SelectionProv │  │DensityProvider│ │
│  │              │  │              │  │              │  │              │ │
│  │ LATCH→WHERE  │  │ Axes→Planes  │  │ Card IDs     │  │ Zoom Levels  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                     │
│                                    ▼                                     │
│                         ┌───────────────────┐                            │
│                         │ StateCoordinator  │                            │
│                         │ • Batches updates │                            │
│                         │ • Notifies views  │                            │
│                         │ • Persists state  │                            │
│                         └───────────────────┘                            │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ┌──────────┐          ┌──────────┐          ┌──────────┐
        │ SuperGrid │          │ GraphView │          │ Explorers │
        │ (D3.js)   │          │ (D3.js)   │          │ (D3.js)   │
        └──────────┘          └──────────┘          └──────────┘
```

---

## 1. FilterProvider

Manages LATCH filter state and compiles filters to SQL WHERE clauses.

### State Shape

```typescript
interface FilterState {
  filters: {
    location?: LocationFilter;
    alphabet?: AlphabetFilter;
    time?: TimeFilter;
    category?: CategoryFilter;
    hierarchy?: HierarchyFilter;
  };
  searchQuery?: string;
  graphFilter?: { nodeIds: string[]; type: 'include' | 'exclude' };
  
  // Cached compilation
  _compiledWhere: string;
  _compiledParams: any[];
}

interface LocationFilter {
  type: 'bounds' | 'radius';
  bounds?: { north: number; south: number; east: number; west: number };
  center?: { lat: number; lng: number };
  radiusKm?: number;
}

interface AlphabetFilter {
  type: 'prefix' | 'contains' | 'exact';
  value: string;
  field: 'name' | 'content';
}

interface TimeFilter {
  type: 'range' | 'relative';
  field: 'created_at' | 'modified_at' | 'due_at' | 'event_start';
  start?: string;
  end?: string;
  relative?: 'today' | 'this_week' | 'this_month' | 'last_30_days';
}

interface CategoryFilter {
  type: 'include' | 'exclude';
  field: 'folder' | 'tags' | 'status' | 'card_type';
  values: string[];
}

interface HierarchyFilter {
  type: 'range' | 'exact';
  field: 'priority' | 'sort_order';
  min?: number;
  max?: number;
  value?: number;
}
```

### API

```typescript
class FilterProvider {
  private state: FilterState;
  private subscribers: Set<(state: FilterState) => void>;
  
  // Mutations
  setFilter(axis: LATCHAxis, filter: Filter | null): void;
  setSearchQuery(query: string | null): void;
  setGraphFilter(nodeIds: string[], type: 'include' | 'exclude'): void;
  clearAll(): void;
  clearAxis(axis: LATCHAxis): void;
  
  // Queries
  getCompiledSQL(): { where: string; params: any[] };
  getActiveFilters(): Filter[];
  hasActiveFilters(): boolean;
  
  // Subscription
  subscribe(callback: (state: FilterState) => void): () => void;
}
```

### SQL Compilation: `compileFilters()`

> **SQL Safety:** See [Contracts.md](./Contracts.md#7-sql-safety-rules) for allowlist.

```typescript
// CRITICAL: Column allowlist to prevent SQL injection
const ALLOWED_FILTER_COLUMNS = new Set([
  'id', 'card_type', 'name',
  'latitude', 'longitude', 'location_name',
  'created_at', 'modified_at', 'due_at', 'completed_at', 'event_start', 'event_end',
  'folder', 'status',
  'priority', 'sort_order',
  'source'
]);

function validateColumn(column: string): void {
  if (!ALLOWED_FILTER_COLUMNS.has(column)) {
    throw new Error(`SQL safety violation: "${column}" is not an allowed filter column`);
  }
}

function compileFilters(state: FilterState): { where: string; params: any[] } {
  const clauses: string[] = ['deleted_at IS NULL'];
  const params: any[] = [];
  
  // Location (bounding box)
  if (state.filters.location?.type === 'bounds') {
    const { north, south, east, west } = state.filters.location.bounds!;
    clauses.push('latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
    params.push(south, north, west, east);
  }
  
  // Alphabet
  if (state.filters.alphabet) {
    const { type, value, field } = state.filters.alphabet;
    validateColumn(field);  // SQL safety check
    if (type === 'prefix') {
      clauses.push(`${field} LIKE ? || '%'`);
    } else if (type === 'contains') {
      clauses.push(`${field} LIKE '%' || ? || '%'`);
    } else {
      clauses.push(`${field} = ?`);
    }
    params.push(value);
  }
  
  // Time
  if (state.filters.time) {
    const { type, field, start, end, relative } = state.filters.time;
    validateColumn(field);  // SQL safety check
    if (type === 'range') {
      if (start) { clauses.push(`${field} >= ?`); params.push(start); }
      if (end) { clauses.push(`${field} <= ?`); params.push(end); }
    } else if (relative) {
      const relativeStart = computeRelativeStart(relative);
      clauses.push(`${field} >= ?`);
      params.push(relativeStart);
    }
  }
  
  // Category
  if (state.filters.category) {
    const { type, field, values } = state.filters.category;
    validateColumn(field);  // SQL safety check
    const placeholders = values.map(() => '?').join(', ');
    
    if (field === 'tags') {
      // JSON array handling
      const op = type === 'include' ? 'EXISTS' : 'NOT EXISTS';
      clauses.push(`${op} (SELECT 1 FROM json_each(tags) WHERE value IN (${placeholders}))`);
    } else {
      const op = type === 'include' ? 'IN' : 'NOT IN';
      clauses.push(`${field} ${op} (${placeholders})`);
    }
    params.push(...values);
  }
  
  // Hierarchy
  if (state.filters.hierarchy) {
    const { type, field, min, max, value } = state.filters.hierarchy;
    validateColumn(field);  // SQL safety check
    if (type === 'range') {
      if (min !== undefined) { clauses.push(`${field} >= ?`); params.push(min); }
      if (max !== undefined) { clauses.push(`${field} <= ?`); params.push(max); }
    } else {
      clauses.push(`${field} = ?`);
      params.push(value);
    }
  }
  
  // FTS5 Search
  // CRITICAL: FTS uses rowid (INTEGER), join must use cards.rowid
  if (state.searchQuery) {
    clauses.push('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
    const ftsQuery = state.searchQuery.split(/\s+/).map(t => `"${t}"*`).join(' ');
    params.push(ftsQuery);
  }
  
  // Graph Filter
  if (state.graphFilter?.nodeIds.length) {
    const placeholders = state.graphFilter.nodeIds.map(() => '?').join(', ');
    const op = state.graphFilter.type === 'include' ? 'IN' : 'NOT IN';
    clauses.push(`id ${op} (${placeholders})`);
    params.push(...state.graphFilter.nodeIds);
  }
  
  return { where: clauses.join(' AND '), params };
}
```

---

## 2. PAFVProvider

Manages PAFV axis-to-plane mappings and view projection configuration.

### State Shape

```typescript
interface PAFVState {
  viewType: ViewType;
  
  planes: {
    x: AxisAssignment | null;
    y: AxisAssignment | null;
    z: AxisAssignment | null;
  };
  
  facets: Map<LATCHAxis, string>;  // axis → specific field
  
  sort: {
    primary: { field: string; direction: 'asc' | 'desc' };
    secondary?: { field: string; direction: 'asc' | 'desc' };
  };
  
  // SuperGrid stacking
  grouping: {
    rowAxes: AxisAssignment[];
    colAxes: AxisAssignment[];
  };
}

type ViewType = 'list' | 'grid' | 'gallery' | 'kanban' | 'calendar' 
              | 'timeline' | 'map' | 'graph' | 'supergrid' | 'table';

type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

interface AxisAssignment {
  axis: LATCHAxis;
  facet: string;  // e.g., 'created_at', 'folder', 'priority'
}
```

### API

```typescript
class PAFVProvider {
  private state: PAFVState;
  private suspendedStates: Map<'latch' | 'graph', PAFVState>;
  private subscribers: Set<(state: PAFVState) => void>;
  
  // View switching
  setViewType(viewType: ViewType): void;
  getViewFamily(viewType: ViewType): 'latch' | 'graph';
  
  // Axis manipulation
  setPlaneAxis(plane: 'x' | 'y' | 'z', assignment: AxisAssignment | null): void;
  swapAxes(planeA: 'x' | 'y' | 'z', planeB: 'x' | 'y' | 'z'): void;
  
  // SuperGrid stacking
  addRowAxis(assignment: AxisAssignment, position?: number): void;
  removeRowAxis(index: number): void;
  reorderRowAxes(fromIndex: number, toIndex: number): void;
  addColAxis(assignment: AxisAssignment, position?: number): void;
  removeColAxis(index: number): void;
  reorderColAxes(fromIndex: number, toIndex: number): void;
  
  // Facet selection
  setFacet(axis: LATCHAxis, facet: string): void;
  
  // Sort
  setSort(primary: SortConfig, secondary?: SortConfig): void;
  toggleSort(field: string): void;
  
  // Query generation
  getProjectionSQL(): string;
  
  // Subscription
  subscribe(callback: (state: PAFVState) => void): () => void;
}
```

### View Family State Management

Per SuperGrid spec Section 5 (three-tier state model):

```typescript
setViewType(viewType: ViewType): void {
  const currentFamily = this.getViewFamily(this.state.viewType);
  const newFamily = this.getViewFamily(viewType);
  
  if (currentFamily !== newFamily) {
    // Suspend current family state
    this.suspendedStates.set(currentFamily, { ...this.state });
    
    // Restore new family state if available
    const restored = this.suspendedStates.get(newFamily);
    if (restored) {
      this.state = { ...restored, viewType };
    } else {
      this.state = { ...VIEW_DEFAULTS[viewType], viewType };
    }
  } else {
    this.state.viewType = viewType;
    this.applyViewDefaults(viewType);
  }
  
  this.notify();
}

getViewFamily(viewType: ViewType): 'latch' | 'graph' {
  return viewType === 'graph' ? 'graph' : 'latch';
}
```

### View Defaults

```typescript
const VIEW_DEFAULTS: Record<ViewType, Partial<PAFVState>> = {
  list: {
    planes: { x: null, y: { axis: 'time', facet: 'modified_at' }, z: null },
    sort: { primary: { field: 'modified_at', direction: 'desc' } }
  },
  kanban: {
    planes: { x: { axis: 'category', facet: 'status' }, y: null, z: null },
    sort: { primary: { field: 'sort_order', direction: 'asc' } }
  },
  calendar: {
    planes: { x: null, y: { axis: 'time', facet: 'event_start' }, z: null }
  },
  supergrid: {
    grouping: {
      rowAxes: [{ axis: 'category', facet: 'folder' }],
      colAxes: [{ axis: 'time', facet: 'created_at' }]
    }
  },
  graph: {
    planes: { x: null, y: null, z: null }  // Force-directed layout
  }
};
```

---

## 3. SelectionProvider

Manages card selection state across all views.

### State Shape

```typescript
interface SelectionState {
  selectedIds: Set<string>;
  mode: 'single' | 'multi' | 'range';
  anchorId: string | null;      // For Shift+click range selection
  focusedId: string | null;     // Keyboard navigation target
  hoveredId: string | null;     // Hover preview (not selection)
}
```

### API

```typescript
class SelectionProvider {
  private state: SelectionState;
  private orderedIdsGetter: () => string[];  // Injected from current view
  private subscribers: Set<(state: SelectionState) => void>;
  
  // Selection
  select(id: string, options?: { toggle?: boolean; extend?: boolean }): void;
  selectAll(ids: string[]): void;
  selectNone(): void;
  
  // Focus (keyboard navigation)
  setFocus(id: string | null): void;
  moveFocus(direction: 'up' | 'down' | 'left' | 'right'): void;
  
  // Hover
  setHover(id: string | null): void;
  
  // Queries
  isSelected(id: string): boolean;
  getSelectedIds(): string[];
  getSelectedCount(): number;
  
  // Subscription
  subscribe(callback: (state: SelectionState) => void): () => void;
}
```

### Selection Logic

```typescript
select(id: string, options?: { toggle?: boolean; extend?: boolean }): void {
  if (options?.toggle) {
    // Cmd+click: toggle individual
    if (this.state.selectedIds.has(id)) {
      this.state.selectedIds.delete(id);
    } else {
      this.state.selectedIds.add(id);
    }
  } else if (options?.extend && this.state.anchorId) {
    // Shift+click: range selection
    const orderedIds = this.orderedIdsGetter();
    const anchorIndex = orderedIds.indexOf(this.state.anchorId);
    const targetIndex = orderedIds.indexOf(id);
    
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    
    for (let i = start; i <= end; i++) {
      this.state.selectedIds.add(orderedIds[i]);
    }
  } else {
    // Simple click: replace selection
    this.state.selectedIds = new Set([id]);
    this.state.anchorId = id;
  }
  
  this.state.focusedId = id;
  this.notify();
}
```

### D3 Integration

```typescript
// In any D3 view renderer
function renderCards(cards: Card[]) {
  svg.selectAll('g.card')
    .data(cards, d => d.id)
    .join('g')
      .classed('selected', d => selectionProvider.isSelected(d.id))
      .classed('focused', d => d.id === selectionProvider.state.focusedId)
      .on('click', (event, d) => {
        selectionProvider.select(d.id, {
          toggle: event.metaKey || event.ctrlKey,
          extend: event.shiftKey
        });
      });
}
```

---

## 4. DensityProvider

Manages the Janus density model — semantic zoom across LATCH dimensions.

### State Shape

```typescript
interface DensityState {
  axisDensity: Map<LATCHAxis, DensityLevel>;
  showEmpty: boolean;                    // Show empty grid intersections
  viewMode: 'spreadsheet' | 'matrix';    // 1 card/row vs cards at intersections
  collapsedGroups: Set<string>;          // Collapsed header group IDs
}

interface DensityLevel {
  level: number;                         // 0 = most expanded
  hierarchy: string[];                   // ['day', 'week', 'month', 'quarter', 'year']
  currentFacet: string;                  // Current level's facet
}
```

### 4-Level Density Model

| Level | Name | Control | Effect |
|-------|------|---------|--------|
| 1 | Value Density | Per-facet slider | Collapse hierarchy: Jan,Feb,Mar → Q1 |
| 2 | Extent Density | Toggle | Hide/show empty rows and columns |
| 3 | View Density | Selector | Spreadsheet (1/row) ↔ Matrix (intersections) |
| 4 | Region Density | Config | Mix sparse + dense columns |

### API

```typescript
class DensityProvider {
  private state: DensityState;
  private subscribers: Set<(state: DensityState) => void>;
  
  // Axis density
  setAxisDensity(axis: LATCHAxis, level: number): void;
  increaseAxisDensity(axis: LATCHAxis): void;
  decreaseAxisDensity(axis: LATCHAxis): void;
  
  // Extent
  setShowEmpty(show: boolean): void;
  toggleShowEmpty(): void;
  
  // View mode
  setViewMode(mode: 'spreadsheet' | 'matrix'): void;
  
  // Header collapse
  collapseGroup(groupId: string): void;
  expandGroup(groupId: string): void;
  toggleGroup(groupId: string): void;
  expandAll(): void;
  collapseAll(groupIds: string[]): void;
  isCollapsed(groupId: string): boolean;
  
  // SQL generation
  getDensitySQL(axis: LATCHAxis): string;
  
  // Subscription
  subscribe(callback: (state: DensityState) => void): () => void;
}
```

### Time Density SQL Generation

```typescript
getDensitySQL(axis: LATCHAxis): string {
  const density = this.state.axisDensity.get(axis);
  if (!density || axis !== 'time') return density?.currentFacet || '';
  
  const patterns: Record<string, string> = {
    'day': "strftime('%Y-%m-%d', created_at)",
    'week': "strftime('%Y-W%W', created_at)",
    'month': "strftime('%Y-%m', created_at)",
    'quarter': "strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1)",
    'year': "strftime('%Y', created_at)"
  };
  
  return patterns[density.currentFacet] || 'created_at';
}
```

### Default Hierarchies

```typescript
const DEFAULT_HIERARCHIES: Record<LATCHAxis, string[]> = {
  time: ['timestamp', 'day', 'week', 'month', 'quarter', 'year'],
  category: ['tag', 'status', 'folder'],
  hierarchy: ['individual', 'priority_group', 'all'],
  alphabet: ['character', 'word', 'all'],
  location: ['point', 'neighborhood', 'city', 'region', 'country']
};
```

---

## 5. StateCoordinator

Orchestrates cross-provider updates and persistence.

### Responsibilities

1. **Batch updates** — Coalesce rapid state changes (16ms frame)
2. **Cross-provider sync** — Notify all subscribers on any change
3. **Persistence** — Save to SQLite on checkpoint
4. **Restoration** — Load state on app launch

### Implementation

```typescript
class StateCoordinator {
  private providers: {
    filter: FilterProvider;
    pafv: PAFVProvider;
    selection: SelectionProvider;
    density: DensityProvider;
  };
  
  private pendingUpdates: Set<string> = new Set();
  private updateTimer: number | null = null;
  private globalSubscribers: Set<(sources: string[]) => void> = new Set();
  
  constructor(providers: typeof this.providers) {
    this.providers = providers;
    
    // Subscribe to all providers
    providers.filter.subscribe(() => this.scheduleUpdate('filter'));
    providers.pafv.subscribe(() => this.scheduleUpdate('pafv'));
    providers.selection.subscribe(() => this.scheduleUpdate('selection'));
    providers.density.subscribe(() => this.scheduleUpdate('density'));
  }
  
  private scheduleUpdate(source: string): void {
    this.pendingUpdates.add(source);
    
    if (this.updateTimer) clearTimeout(this.updateTimer);
    
    this.updateTimer = setTimeout(() => {
      const sources = Array.from(this.pendingUpdates);
      this.pendingUpdates.clear();
      this.updateTimer = null;
      
      this.globalSubscribers.forEach(cb => cb(sources));
      this.schedulePersist();
    }, 16);  // One frame
  }
  
  subscribe(callback: (sources: string[]) => void): () => void {
    this.globalSubscribers.add(callback);
    return () => this.globalSubscribers.delete(callback);
  }
  
  async persist(): Promise<void> {
    // Filter, PAFV, Density persist (Tier 1)
    // Selection does NOT persist (Tier 3)
    const state = {
      filter: this.providers.filter.getState(),
      pafv: this.providers.pafv.getState(),
      density: this.providers.density.getState()
    };
    
    await workerBridge.exec(`
      INSERT OR REPLACE INTO app_state (id, state_json, updated_at)
      VALUES ('current', ?, datetime('now'))
    `, [JSON.stringify(state)]);
  }
  
  async restore(): Promise<void> {
    const [row] = await workerBridge.query<{ state_json: string }>(
      `SELECT state_json FROM app_state WHERE id = 'current'`
    );
    
    if (row) {
      const state = JSON.parse(row.state_json);
      this.providers.filter.setState(state.filter);
      this.providers.pafv.setState(state.pafv);
      this.providers.density.setState(state.density);
    }
  }
}
```

---

## 6. State Persistence (Three-Tier Model)

> **Canonical Reference:** See [Contracts.md](./Contracts.md#6-state-persistence-tiers).

| Tier | Persists | Examples |
|------|----------|----------|
| **Tier 1: Global** | Always | Filters, density, sort |
| **Tier 2: Family** | Within LATCH/GRAPH | Axis assignments, header states |
| **Tier 3: Ephemeral** | Never | **Selection**, hover, drag, viewport |

**Note:** Selection is Tier 3 (ephemeral) — it does NOT persist across app restarts.

### SQLite Schema

```sql
CREATE TABLE app_state (
  id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE view_state (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  family TEXT NOT NULL,  -- 'latch' or 'graph'
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(dataset_id, app_id, family)
);
```

---

## 7. Usage Example

```typescript
// Initialize providers
const filterProvider = new FilterProvider();
const pafvProvider = new PAFVProvider();
const selectionProvider = new SelectionProvider();
const densityProvider = new DensityProvider();

const coordinator = new StateCoordinator({
  filter: filterProvider,
  pafv: pafvProvider,
  selection: selectionProvider,
  density: densityProvider
});

// In SuperGrid renderer
class SuperGridRenderer {
  constructor() {
    coordinator.subscribe(async (sources) => {
      if (sources.includes('filter') || sources.includes('pafv')) {
        await this.requery();
      }
      if (sources.includes('density')) {
        this.rerender();
      }
      if (sources.includes('selection')) {
        this.updateSelectionVisuals();
      }
    });
  }
  
  async requery() {
    const { where, params } = filterProvider.getCompiledSQL();
    const densitySQL = densityProvider.getDensitySQL('time');
    
    const results = await workerBridge.query(`
      SELECT ${densitySQL} as time_bucket, folder, COUNT(*) as count
      FROM cards
      WHERE ${where}
      GROUP BY time_bucket, folder
    `, params);
    
    this.data = results;
    this.rerender();
  }
  
  rerender() {
    // D3.js rendering
    this.svg.selectAll('g.cell')
      .data(this.data)
      .join('g')
        .classed('collapsed', d => densityProvider.isCollapsed(d.groupId));
  }
  
  updateSelectionVisuals() {
    this.svg.selectAll('g.card')
      .classed('selected', d => selectionProvider.isSelected(d.id));
  }
}
```

---

## 8. Testing Strategy

```typescript
describe('FilterProvider', () => {
  it('compiles category filter to SQL', () => {
    provider.setFilter('category', {
      type: 'include', field: 'folder', values: ['Inbox', 'Work']
    });
    
    const { where, params } = provider.getCompiledSQL();
    expect(where).toContain('folder IN (?, ?)');
    expect(params).toEqual(['Inbox', 'Work']);
  });
  
  it('combines multiple filters with AND', () => {
    provider.setFilter('category', { type: 'include', field: 'folder', values: ['Work'] });
    provider.setFilter('time', { type: 'relative', field: 'created_at', relative: 'this_week' });
    
    const { where } = provider.getCompiledSQL();
    expect(where).toContain(' AND ');
  });
});

describe('PAFVProvider', () => {
  it('suspends LATCH state when switching to GRAPH', () => {
    provider.setViewType('supergrid');
    provider.setPlaneAxis('x', { axis: 'time', facet: 'created_at' });
    
    provider.setViewType('graph');
    expect(provider.state.planes.x).toBeNull();
    
    provider.setViewType('supergrid');
    expect(provider.state.planes.x?.facet).toBe('created_at');
  });
});

describe('SelectionProvider', () => {
  it('handles Cmd+click toggle', () => {
    provider.select('card1');
    provider.select('card2', { toggle: true });
    
    expect(provider.isSelected('card1')).toBe(true);
    expect(provider.isSelected('card2')).toBe(true);
    
    provider.select('card1', { toggle: true });
    expect(provider.isSelected('card1')).toBe(false);
  });
});

describe('DensityProvider', () => {
  it('generates correct time density SQL', () => {
    provider.setAxisDensity('time', 2);  // month
    
    const sql = provider.getDensitySQL('time');
    expect(sql).toContain("strftime('%Y-%m'");
  });
});
```

---

## Key Principles

1. **Providers are thin** — Hold UI state, compile queries. SQLite holds data.
2. **Unidirectional flow** — User action → Provider mutation → SQL → D3 render
3. **Batched updates** — StateCoordinator coalesces within 16ms frame
4. **Tier-aware persistence** — Filter/PAFV/density persist; selection doesn't
5. **No framework dependency** — Plain TypeScript with subscription pattern
