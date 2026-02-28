# Isometry v5 Providers Specification

## Overview

Providers are the reactive state layer between sql.js (data) and D3.js (rendering). They compile user intent into SQL, manage cross-component state, and emit change notifications that trigger D3 re-renders.

**Guiding principle:** Providers hold *projection state*, not *data*. Data lives in SQLite. Providers hold the instructions for how to query and display that data.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Interactions                             │
│   (click filter, drag axis, select card, adjust density slider)     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Provider Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ ┌─────────────┐  │
│  │  Filter     │ │    PAFV     │ │   Selection   │ │   Density   │  │
│  │  Provider   │ │   Provider  │ │   Provider    │ │   Provider  │  │
│  └──────┬──────┘ └──────┬──────┘ └───────┬───────┘ └──────┬──────┘  │
│         │               │                │                │         │
│         └───────────────┴────────────────┴────────────────┘         │
│                                  │                                   │
│                                  ▼                                   │
│                    ┌─────────────────────────┐                      │
│                    │     QueryCompiler       │                      │
│                    │  (combines all state    │                      │
│                    │   into executable SQL)  │                      │
│                    └────────────┬────────────┘                      │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Worker Bridge                                   │
│                   db.exec(compiledSQL)                              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      D3.js Rendering                                 │
│              .data(results).join() → enter/update/exit              │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Provider Interface

All providers implement this base interface:

```typescript
interface Provider<T> {
  // Current state
  getState(): T;
  
  // Update state (triggers subscribers)
  setState(partial: Partial<T>): void;
  
  // Subscribe to changes
  subscribe(callback: (state: T) => void): () => void;
  
  // Compile state to SQL fragment
  toSQL(): SQLFragment;
  
  // Serialize for persistence
  serialize(): string;
  
  // Restore from persistence
  deserialize(json: string): void;
}

interface SQLFragment {
  select?: string;      // SELECT clause additions
  where?: string;       // WHERE clause
  groupBy?: string;     // GROUP BY clause
  orderBy?: string;     // ORDER BY clause
  params?: any[];       // Parameterized values
}
```

### State Tiers (from SuperGrid spec)

Providers respect the three-tier state model:

| Tier | Providers | Persistence |
|------|-----------|-------------|
| **Tier 1: Global** | FilterProvider, SelectionProvider, DensityProvider | Survives all view transitions |
| **Tier 2: View Family** | PAFVProvider (per LATCH/GRAPH family) | Suspends across families, restores on return |
| **Tier 3: Ephemeral** | (not in providers — pixel positions, hover, etc.) | Resets on any transition |

---

## FilterProvider

Manages LATCH filter state and compiles to SQL WHERE clauses.

### State Shape

```typescript
interface FilterState {
  // Active filters by facet
  filters: Map<string, FilterPredicate>;
  
  // FTS5 search query (if active)
  searchQuery: string | null;
  
  // Geo bounds (from MapExplorer)
  geoBounds: GeoBounds | null;
  
  // Time range (from TimeExplorer)
  timeRange: TimeRange | null;
}

type FilterPredicate = 
  | { type: 'equals'; field: string; value: any }
  | { type: 'in'; field: string; values: any[] }
  | { type: 'range'; field: string; min?: any; max?: any }
  | { type: 'contains'; field: string; substring: string }
  | { type: 'hasTag'; tag: string }
  | { type: 'isNull'; field: string; negated?: boolean }
  | { type: 'fts'; query: string }
  | { type: 'geo'; bounds: GeoBounds }
  | { type: 'formula'; expression: string; compiledSQL: string };

interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TimeRange {
  field: 'created_at' | 'modified_at' | 'due_at' | 'event_start';
  start: string | null;  // ISO 8601
  end: string | null;    // ISO 8601
}
```

### Implementation

```typescript
class FilterProvider implements Provider<FilterState> {
  private state: FilterState = {
    filters: new Map(),
    searchQuery: null,
    geoBounds: null,
    timeRange: null,
  };
  
  private subscribers: Set<(state: FilterState) => void> = new Set();

  // Add or update a filter
  setFilter(key: string, predicate: FilterPredicate): void {
    this.state.filters.set(key, predicate);
    this.notify();
  }

  // Remove a filter
  removeFilter(key: string): void {
    this.state.filters.delete(key);
    this.notify();
  }

  // Clear all filters
  clearAll(): void {
    this.state.filters.clear();
    this.state.searchQuery = null;
    this.state.geoBounds = null;
    this.state.timeRange = null;
    this.notify();
  }

  // Set FTS5 search
  setSearch(query: string | null): void {
    this.state.searchQuery = query;
    this.notify();
  }

  // Compile to SQL WHERE clause
  toSQL(): SQLFragment {
    const conditions: string[] = [];
    const params: any[] = [];

    // Always exclude soft-deleted
    conditions.push('deleted_at IS NULL');

    // Process each filter
    for (const [key, predicate] of this.state.filters) {
      const { sql, values } = this.compilePredicate(predicate);
      conditions.push(sql);
      params.push(...values);
    }

    // FTS5 search
    if (this.state.searchQuery) {
      conditions.push(`id IN (
        SELECT rowid FROM cards_fts 
        WHERE cards_fts MATCH ?
      )`);
      params.push(this.formatFTSQuery(this.state.searchQuery));
    }

    // Geo bounds
    if (this.state.geoBounds) {
      const { north, south, east, west } = this.state.geoBounds;
      conditions.push(`(
        latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      )`);
      params.push(south, north, west, east);
    }

    // Time range
    if (this.state.timeRange) {
      const { field, start, end } = this.state.timeRange;
      if (start) {
        conditions.push(`${field} >= ?`);
        params.push(start);
      }
      if (end) {
        conditions.push(`${field} <= ?`);
        params.push(end);
      }
    }

    return {
      where: conditions.join(' AND '),
      params,
    };
  }

  private compilePredicate(pred: FilterPredicate): { sql: string; values: any[] } {
    switch (pred.type) {
      case 'equals':
        return { sql: `${pred.field} = ?`, values: [pred.value] };
      
      case 'in':
        const placeholders = pred.values.map(() => '?').join(', ');
        return { sql: `${pred.field} IN (${placeholders})`, values: pred.values };
      
      case 'range':
        const rangeConds: string[] = [];
        const rangeVals: any[] = [];
        if (pred.min !== undefined) {
          rangeConds.push(`${pred.field} >= ?`);
          rangeVals.push(pred.min);
        }
        if (pred.max !== undefined) {
          rangeConds.push(`${pred.field} <= ?`);
          rangeVals.push(pred.max);
        }
        return { sql: rangeConds.join(' AND '), values: rangeVals };
      
      case 'contains':
        return { sql: `${pred.field} LIKE ?`, values: [`%${pred.substring}%`] };
      
      case 'hasTag':
        return { 
          sql: `EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`,
          values: [pred.tag]
        };
      
      case 'isNull':
        return { 
          sql: pred.negated ? `${pred.field} IS NOT NULL` : `${pred.field} IS NULL`,
          values: []
        };
      
      case 'formula':
        return { sql: pred.compiledSQL, values: [] };
      
      default:
        return { sql: '1=1', values: [] };
    }
  }

  private formatFTSQuery(query: string): string {
    // Add prefix matching for better UX
    return query
      .trim()
      .split(/\s+/)
      .map(term => `"${term}"*`)
      .join(' ');
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      callback(this.state);
    }
  }

  subscribe(callback: (state: FilterState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getState(): FilterState {
    return this.state;
  }

  setState(partial: Partial<FilterState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  serialize(): string {
    return JSON.stringify({
      filters: Array.from(this.state.filters.entries()),
      searchQuery: this.state.searchQuery,
      geoBounds: this.state.geoBounds,
      timeRange: this.state.timeRange,
    });
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.state.filters = new Map(data.filters);
    this.state.searchQuery = data.searchQuery;
    this.state.geoBounds = data.geoBounds;
    this.state.timeRange = data.timeRange;
    this.notify();
  }
}
```

### Usage

```typescript
// Add a status filter
filterProvider.setFilter('status', { 
  type: 'in', 
  field: 'status', 
  values: ['active', 'pending'] 
});

// Add a priority filter
filterProvider.setFilter('priority', {
  type: 'range',
  field: 'priority',
  min: 3,
});

// Add FTS search
filterProvider.setSearch('kubernetes deploy');

// Compile and execute
const { where, params } = filterProvider.toSQL();
const sql = `SELECT * FROM cards WHERE ${where}`;
const results = await db.exec(sql, params);
```

---

## PAFVProvider

Manages PAFV axis mappings — which LATCH dimensions map to which spatial planes.

### State Shape

```typescript
interface PAFVState {
  // Current view type
  viewType: ViewType;
  
  // Axis assignments
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  zAxis: AxisMapping | null;  // Depth/layering
  
  // Sort configuration
  sort: SortConfig[];
  
  // Aggregation (for density levels)
  aggregation: AggregationConfig | null;
  
  // Header expand/collapse state
  headerStates: Map<string, 'expanded' | 'collapsed'>;
}

type ViewType = 
  | 'list' | 'grid' | 'kanban' | 'calendar' | 'timeline' 
  | 'map' | 'supergrid' | 'graph' | 'table';

interface AxisMapping {
  axis: LATCHAxis;
  facet: string;         // e.g., 'created_at' for Time axis
  direction?: 'asc' | 'desc';
}

type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  nullsLast?: boolean;
}

interface AggregationConfig {
  level: 'day' | 'week' | 'month' | 'quarter' | 'year';  // Time
  groupBy?: string;  // Category
}
```

### Implementation

```typescript
class PAFVProvider implements Provider<PAFVState> {
  private state: PAFVState = {
    viewType: 'grid',
    xAxis: null,
    yAxis: null,
    zAxis: null,
    sort: [],
    aggregation: null,
    headerStates: new Map(),
  };

  private subscribers: Set<(state: PAFVState) => void> = new Set();

  // Set view type (triggers axis defaults)
  setViewType(viewType: ViewType): void {
    this.state.viewType = viewType;
    this.applyViewDefaults(viewType);
    this.notify();
  }

  // Map an axis to a plane
  setAxisMapping(plane: 'x' | 'y' | 'z', mapping: AxisMapping | null): void {
    const key = `${plane}Axis` as 'xAxis' | 'yAxis' | 'zAxis';
    this.state[key] = mapping;
    this.notify();
  }

  // Swap two axes (transpose)
  swapAxes(plane1: 'x' | 'y' | 'z', plane2: 'x' | 'y' | 'z'): void {
    const key1 = `${plane1}Axis` as const;
    const key2 = `${plane2}Axis` as const;
    const temp = this.state[key1];
    this.state[key1] = this.state[key2];
    this.state[key2] = temp;
    this.notify();
  }

  // Set sort order
  setSort(sort: SortConfig[]): void {
    this.state.sort = sort;
    this.notify();
  }

  // Toggle header expand/collapse
  toggleHeader(headerId: string): void {
    const current = this.state.headerStates.get(headerId) || 'expanded';
    this.state.headerStates.set(headerId, current === 'expanded' ? 'collapsed' : 'expanded');
    this.notify();
  }

  // Compile to SQL clauses
  toSQL(): SQLFragment {
    const select: string[] = ['*'];
    const groupBy: string[] = [];
    const orderBy: string[] = [];

    // Add axis fields for grouping
    if (this.state.xAxis) {
      const field = this.getAxisField(this.state.xAxis);
      select.push(`${field} as _x_axis`);
      groupBy.push(field);
    }

    if (this.state.yAxis) {
      const field = this.getAxisField(this.state.yAxis);
      select.push(`${field} as _y_axis`);
      groupBy.push(field);
    }

    // Time aggregation
    if (this.state.aggregation && this.state.xAxis?.axis === 'time') {
      const timeField = this.state.xAxis.facet;
      const formatStr = this.getTimeFormat(this.state.aggregation.level);
      select.push(`strftime('${formatStr}', ${timeField}) as _time_bucket`);
      groupBy.push(`strftime('${formatStr}', ${timeField})`);
    }

    // Sort
    for (const s of this.state.sort) {
      const nulls = s.nullsLast ? ' NULLS LAST' : '';
      orderBy.push(`${s.field} ${s.direction.toUpperCase()}${nulls}`);
    }

    return {
      select: select.join(', '),
      groupBy: groupBy.length > 0 ? groupBy.join(', ') : undefined,
      orderBy: orderBy.length > 0 ? orderBy.join(', ') : undefined,
    };
  }

  private getAxisField(mapping: AxisMapping): string {
    return mapping.facet;
  }

  private getTimeFormat(level: string): string {
    switch (level) {
      case 'year': return '%Y';
      case 'quarter': return '%Y-Q' + "|| ((CAST(strftime('%m', date) AS INTEGER) - 1) / 3 + 1)";
      case 'month': return '%Y-%m';
      case 'week': return '%Y-W%W';
      case 'day': return '%Y-%m-%d';
      default: return '%Y-%m-%d';
    }
  }

  private applyViewDefaults(viewType: ViewType): void {
    // Apply sensible defaults per view type
    switch (viewType) {
      case 'list':
        this.state.xAxis = null;
        this.state.yAxis = { axis: 'time', facet: 'modified_at', direction: 'desc' };
        break;
      
      case 'kanban':
        this.state.xAxis = { axis: 'category', facet: 'status' };
        this.state.yAxis = { axis: 'hierarchy', facet: 'priority', direction: 'desc' };
        break;
      
      case 'calendar':
        this.state.xAxis = { axis: 'time', facet: 'event_start' };
        this.state.yAxis = null;
        break;
      
      case 'grid':
      case 'supergrid':
        // Keep existing or set defaults
        if (!this.state.xAxis) {
          this.state.xAxis = { axis: 'category', facet: 'folder' };
        }
        if (!this.state.yAxis) {
          this.state.yAxis = { axis: 'time', facet: 'created_at' };
        }
        break;
      
      case 'graph':
        // Graph uses edges, not LATCH axes
        this.state.xAxis = null;
        this.state.yAxis = null;
        break;
    }
  }

  // Provider interface
  getState(): PAFVState { return this.state; }
  
  setState(partial: Partial<PAFVState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  subscribe(callback: (state: PAFVState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      callback(this.state);
    }
  }

  serialize(): string {
    return JSON.stringify({
      viewType: this.state.viewType,
      xAxis: this.state.xAxis,
      yAxis: this.state.yAxis,
      zAxis: this.state.zAxis,
      sort: this.state.sort,
      aggregation: this.state.aggregation,
      headerStates: Array.from(this.state.headerStates.entries()),
    });
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.state = {
      ...data,
      headerStates: new Map(data.headerStates),
    };
    this.notify();
  }
}
```

---

## SelectionProvider

Manages card selection state across all views.

### State Shape

```typescript
interface SelectionState {
  // Selected card IDs
  selectedIds: Set<string>;
  
  // Focus card (keyboard navigation)
  focusId: string | null;
  
  // Last selected (for shift-click range)
  anchorId: string | null;
  
  // Selection mode
  mode: 'single' | 'multi' | 'range';
}
```

### Implementation

```typescript
class SelectionProvider implements Provider<SelectionState> {
  private state: SelectionState = {
    selectedIds: new Set(),
    focusId: null,
    anchorId: null,
    mode: 'multi',
  };

  private subscribers: Set<(state: SelectionState) => void> = new Set();

  // Select a single card (replaces selection)
  select(id: string): void {
    this.state.selectedIds = new Set([id]);
    this.state.focusId = id;
    this.state.anchorId = id;
    this.notify();
  }

  // Toggle selection (cmd+click)
  toggle(id: string): void {
    if (this.state.selectedIds.has(id)) {
      this.state.selectedIds.delete(id);
    } else {
      this.state.selectedIds.add(id);
      this.state.anchorId = id;
    }
    this.state.focusId = id;
    this.notify();
  }

  // Range select (shift+click)
  selectRange(id: string, orderedIds: string[]): void {
    if (!this.state.anchorId) {
      this.select(id);
      return;
    }

    const anchorIndex = orderedIds.indexOf(this.state.anchorId);
    const targetIndex = orderedIds.indexOf(id);

    if (anchorIndex === -1 || targetIndex === -1) {
      this.select(id);
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);

    this.state.selectedIds = new Set(orderedIds.slice(start, end + 1));
    this.state.focusId = id;
    this.notify();
  }

  // Select all (from current filtered set)
  selectAll(ids: string[]): void {
    this.state.selectedIds = new Set(ids);
    this.notify();
  }

  // Clear selection
  clear(): void {
    this.state.selectedIds = new Set();
    this.state.focusId = null;
    this.state.anchorId = null;
    this.notify();
  }

  // Move focus (keyboard navigation)
  moveFocus(direction: 'up' | 'down' | 'left' | 'right', orderedIds: string[]): void {
    if (!this.state.focusId || orderedIds.length === 0) {
      this.state.focusId = orderedIds[0];
      this.notify();
      return;
    }

    const currentIndex = orderedIds.indexOf(this.state.focusId);
    let newIndex = currentIndex;

    switch (direction) {
      case 'up':
      case 'left':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'down':
      case 'right':
        newIndex = Math.min(orderedIds.length - 1, currentIndex + 1);
        break;
    }

    this.state.focusId = orderedIds[newIndex];
    this.notify();
  }

  // Check if selected
  isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }

  // Get selected IDs as array
  getSelectedArray(): string[] {
    return Array.from(this.state.selectedIds);
  }

  // Compile to SQL (for operations on selection)
  toSQL(): SQLFragment {
    if (this.state.selectedIds.size === 0) {
      return { where: '1=0', params: [] };  // Match nothing
    }

    const placeholders = Array.from(this.state.selectedIds).map(() => '?').join(', ');
    return {
      where: `id IN (${placeholders})`,
      params: Array.from(this.state.selectedIds),
    };
  }

  // Provider interface
  getState(): SelectionState { return this.state; }
  
  setState(partial: Partial<SelectionState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  subscribe(callback: (state: SelectionState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      callback(this.state);
    }
  }

  serialize(): string {
    return JSON.stringify({
      selectedIds: Array.from(this.state.selectedIds),
      focusId: this.state.focusId,
      anchorId: this.state.anchorId,
      mode: this.state.mode,
    });
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.state = {
      selectedIds: new Set(data.selectedIds),
      focusId: data.focusId,
      anchorId: data.anchorId,
      mode: data.mode,
    };
    this.notify();
  }
}
```

---

## DensityProvider

Manages the 4-level density model from SuperGrid (Value, Extent, View, Region).

### State Shape

```typescript
interface DensityState {
  // Level 1: Value Density (hierarchy collapse)
  valueDensity: Map<LATCHAxis, DensityLevel>;
  
  // Level 2: Extent Density (show/hide empty)
  showEmptyIntersections: boolean;
  
  // Level 3: View Density (spreadsheet vs matrix)
  viewDensity: 'spreadsheet' | 'matrix';
  
  // Level 4: Region Density (per-column overrides)
  regionOverrides: Map<string, DensityLevel>;
}

type DensityLevel = 'leaf' | 'parent' | 'grandparent' | 'collapsed';

// Maps to Time hierarchy: day → week → month → quarter → year
const TIME_DENSITY_MAP: Record<DensityLevel, string> = {
  leaf: 'day',
  parent: 'week', 
  grandparent: 'month',
  collapsed: 'year',
};
```

### Implementation

```typescript
class DensityProvider implements Provider<DensityState> {
  private state: DensityState = {
    valueDensity: new Map([
      ['time', 'parent'],      // Default: week level
      ['category', 'leaf'],    // Default: individual categories
      ['hierarchy', 'leaf'],   // Default: individual priorities
    ]),
    showEmptyIntersections: false,
    viewDensity: 'spreadsheet',
    regionOverrides: new Map(),
  };

  private subscribers: Set<(state: DensityState) => void> = new Set();

  // Set density for an axis
  setAxisDensity(axis: LATCHAxis, level: DensityLevel): void {
    this.state.valueDensity.set(axis, level);
    this.notify();
  }

  // Toggle empty intersections
  setShowEmpty(show: boolean): void {
    this.state.showEmptyIntersections = show;
    this.notify();
  }

  // Set view density mode
  setViewDensity(mode: 'spreadsheet' | 'matrix'): void {
    this.state.viewDensity = mode;
    this.notify();
  }

  // Set region override
  setRegionDensity(regionId: string, level: DensityLevel): void {
    this.state.regionOverrides.set(regionId, level);
    this.notify();
  }

  // Compile to SQL (affects GROUP BY)
  toSQL(pafvState: PAFVState): SQLFragment {
    const groupBy: string[] = [];

    // Time axis density → GROUP BY with date truncation
    if (pafvState.xAxis?.axis === 'time' || pafvState.yAxis?.axis === 'time') {
      const timeAxis = pafvState.xAxis?.axis === 'time' ? pafvState.xAxis : pafvState.yAxis;
      const density = this.state.valueDensity.get('time') || 'leaf';
      const format = this.getTimeGroupFormat(density);
      groupBy.push(`strftime('${format}', ${timeAxis!.facet})`);
    }

    // Category axis density → different grouping granularity
    if (pafvState.xAxis?.axis === 'category' || pafvState.yAxis?.axis === 'category') {
      const catAxis = pafvState.xAxis?.axis === 'category' ? pafvState.xAxis : pafvState.yAxis;
      const density = this.state.valueDensity.get('category') || 'leaf';
      
      if (density === 'collapsed') {
        // Collapse to parent category (e.g., folder only, not subfolder)
        groupBy.push(catAxis!.facet);
      } else {
        groupBy.push(catAxis!.facet);
      }
    }

    // Extent density affects HAVING clause
    let having: string | undefined;
    if (!this.state.showEmptyIntersections) {
      having = 'COUNT(*) > 0';
    }

    return {
      groupBy: groupBy.length > 0 ? groupBy.join(', ') : undefined,
    };
  }

  private getTimeGroupFormat(density: DensityLevel): string {
    switch (density) {
      case 'leaf': return '%Y-%m-%d';           // Day
      case 'parent': return '%Y-W%W';           // Week
      case 'grandparent': return '%Y-%m';       // Month
      case 'collapsed': return '%Y';            // Year
      default: return '%Y-%m-%d';
    }
  }

  // Provider interface
  getState(): DensityState { return this.state; }
  
  setState(partial: Partial<DensityState>): void {
    Object.assign(this.state, partial);
    this.notify();
  }

  subscribe(callback: (state: DensityState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      callback(this.state);
    }
  }

  serialize(): string {
    return JSON.stringify({
      valueDensity: Array.from(this.state.valueDensity.entries()),
      showEmptyIntersections: this.state.showEmptyIntersections,
      viewDensity: this.state.viewDensity,
      regionOverrides: Array.from(this.state.regionOverrides.entries()),
    });
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.state = {
      valueDensity: new Map(data.valueDensity),
      showEmptyIntersections: data.showEmptyIntersections,
      viewDensity: data.viewDensity,
      regionOverrides: new Map(data.regionOverrides),
    };
    this.notify();
  }
}
```

---

## QueryCompiler

Combines all provider states into executable SQL.

```typescript
class QueryCompiler {
  constructor(
    private filterProvider: FilterProvider,
    private pafvProvider: PAFVProvider,
    private densityProvider: DensityProvider,
  ) {}

  // Compile a full query for the current view
  compileViewQuery(): { sql: string; params: any[] } {
    const filter = this.filterProvider.toSQL();
    const pafv = this.pafvProvider.toSQL();
    const density = this.densityProvider.toSQL(this.pafvProvider.getState());

    const select = pafv.select || '*';
    const where = filter.where || '1=1';
    const groupBy = density.groupBy || pafv.groupBy;
    const orderBy = pafv.orderBy || 'modified_at DESC';

    let sql = `SELECT ${select} FROM cards WHERE ${where}`;
    
    if (groupBy) {
      sql += ` GROUP BY ${groupBy}`;
    }
    
    sql += ` ORDER BY ${orderBy}`;

    return {
      sql,
      params: filter.params || [],
    };
  }

  // Compile a count query (for facet counts)
  compileCountQuery(groupByField: string): { sql: string; params: any[] } {
    const filter = this.filterProvider.toSQL();
    const where = filter.where || '1=1';

    return {
      sql: `SELECT ${groupByField}, COUNT(*) as count 
            FROM cards 
            WHERE ${where} 
            GROUP BY ${groupByField} 
            ORDER BY count DESC`,
      params: filter.params || [],
    };
  }

  // Compile a graph query (for network view)
  compileGraphQuery(): { sql: string; params: any[] } {
    const filter = this.filterProvider.toSQL();
    const where = filter.where || '1=1';

    // Get nodes
    const nodesSql = `SELECT * FROM cards WHERE ${where}`;

    // Get edges between filtered nodes
    const edgesSql = `
      SELECT c.* FROM connections c
      WHERE c.source_id IN (SELECT id FROM cards WHERE ${where})
        AND c.target_id IN (SELECT id FROM cards WHERE ${where})
    `;

    return {
      sql: `${nodesSql}; ${edgesSql}`,
      params: [...(filter.params || []), ...(filter.params || []), ...(filter.params || [])],
    };
  }
}
```

---

## ProviderStore

Central store that coordinates all providers and persistence.

```typescript
class ProviderStore {
  readonly filter: FilterProvider;
  readonly pafv: PAFVProvider;
  readonly selection: SelectionProvider;
  readonly density: DensityProvider;
  readonly compiler: QueryCompiler;

  private persistenceKey = 'isometry_providers';

  constructor() {
    this.filter = new FilterProvider();
    this.pafv = new PAFVProvider();
    this.selection = new SelectionProvider();
    this.density = new DensityProvider();
    this.compiler = new QueryCompiler(this.filter, this.pafv, this.density);

    // Auto-persist on changes (debounced)
    this.setupAutoPersist();
  }

  // Execute compiled query via Worker
  async executeQuery(): Promise<any[]> {
    const { sql, params } = this.compiler.compileViewQuery();
    return await workerBridge.exec(sql, params);
  }

  // Persist Tier 1 state to SQLite
  async persistToDatabase(db: Database): Promise<void> {
    const state = {
      filter: this.filter.serialize(),
      selection: this.selection.serialize(),
      density: this.density.serialize(),
    };

    await db.exec(`
      INSERT OR REPLACE INTO view_state (id, dataset_id, app_id, family, state_json, updated_at)
      VALUES ('global', 'default', 'default', 'GLOBAL', ?, datetime('now'))
    `, [JSON.stringify(state)]);
  }

  // Persist Tier 2 state (view family)
  async persistViewFamily(family: 'LATCH' | 'GRAPH', db: Database): Promise<void> {
    const state = this.pafv.serialize();

    await db.exec(`
      INSERT OR REPLACE INTO view_state (id, dataset_id, app_id, family, state_json, updated_at)
      VALUES (?, 'default', 'default', ?, ?, datetime('now'))
    `, [`${family}_state`, family, state]);
  }

  // Restore from database
  async restoreFromDatabase(db: Database): Promise<void> {
    // Restore Tier 1
    const globalResult = await db.exec(`
      SELECT state_json FROM view_state WHERE id = 'global'
    `);
    
    if (globalResult.length > 0) {
      const state = JSON.parse(globalResult[0].state_json);
      this.filter.deserialize(state.filter);
      this.selection.deserialize(state.selection);
      this.density.deserialize(state.density);
    }
  }

  private setupAutoPersist(): void {
    let timeout: number;
    const debouncedPersist = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // Persist to localStorage as backup
        localStorage.setItem(this.persistenceKey, JSON.stringify({
          filter: this.filter.serialize(),
          pafv: this.pafv.serialize(),
          selection: this.selection.serialize(),
          density: this.density.serialize(),
        }));
      }, 500);
    };

    this.filter.subscribe(debouncedPersist);
    this.pafv.subscribe(debouncedPersist);
    this.selection.subscribe(debouncedPersist);
    this.density.subscribe(debouncedPersist);
  }
}

// Singleton export
export const providers = new ProviderStore();
```

---

## Integration with D3.js

Providers connect to D3 rendering via subscriptions:

```typescript
// In view renderer
function initializeView(container: SVGElement) {
  // Subscribe to provider changes
  const unsubscribeFilter = providers.filter.subscribe(async () => {
    const cards = await providers.executeQuery();
    renderCards(container, cards);
  });

  const unsubscribePAFV = providers.pafv.subscribe(async () => {
    const cards = await providers.executeQuery();
    renderCards(container, cards);
  });

  const unsubscribeSelection = providers.selection.subscribe((state) => {
    // Update selection highlighting (no re-query needed)
    d3.select(container)
      .selectAll('.card')
      .classed('selected', d => state.selectedIds.has(d.id));
  });

  // Return cleanup function
  return () => {
    unsubscribeFilter();
    unsubscribePAFV();
    unsubscribeSelection();
  };
}

function renderCards(container: SVGElement, cards: Card[]) {
  const pafvState = providers.pafv.getState();
  const selectionState = providers.selection.getState();

  d3.select(container)
    .selectAll('.card')
    .data(cards, d => d.id)
    .join(
      enter => enter.append('g')
        .attr('class', 'card')
        .classed('selected', d => selectionState.selectedIds.has(d.id))
        .call(renderCardEnter),
      update => update
        .call(renderCardUpdate),
      exit => exit
        .transition()
        .duration(200)
        .style('opacity', 0)
        .remove()
    )
    .attr('transform', d => computePosition(d, pafvState));
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('FilterProvider', () => {
  it('compiles equals predicate to SQL', () => {
    const provider = new FilterProvider();
    provider.setFilter('status', { type: 'equals', field: 'status', value: 'active' });
    
    const { where, params } = provider.toSQL();
    
    expect(where).toContain('status = ?');
    expect(params).toContain('active');
  });

  it('combines multiple filters with AND', () => {
    const provider = new FilterProvider();
    provider.setFilter('status', { type: 'equals', field: 'status', value: 'active' });
    provider.setFilter('priority', { type: 'range', field: 'priority', min: 3 });
    
    const { where } = provider.toSQL();
    
    expect(where).toContain('AND');
    expect(where).toContain('status = ?');
    expect(where).toContain('priority >= ?');
  });

  it('formats FTS query with prefix matching', () => {
    const provider = new FilterProvider();
    provider.setSearch('kubernetes deploy');
    
    const { where, params } = provider.toSQL();
    
    expect(where).toContain('cards_fts MATCH ?');
    expect(params[params.length - 1]).toBe('"kubernetes"* "deploy"*');
  });
});

describe('SelectionProvider', () => {
  it('handles range selection', () => {
    const provider = new SelectionProvider();
    const orderedIds = ['a', 'b', 'c', 'd', 'e'];
    
    provider.select('b');  // Set anchor
    provider.selectRange('d', orderedIds);
    
    expect(provider.getSelectedArray()).toEqual(['b', 'c', 'd']);
  });
});

describe('QueryCompiler', () => {
  it('combines filter and PAFV into executable SQL', () => {
    const filter = new FilterProvider();
    const pafv = new PAFVProvider();
    const density = new DensityProvider();
    const compiler = new QueryCompiler(filter, pafv, density);

    filter.setFilter('folder', { type: 'equals', field: 'folder', value: 'Work' });
    pafv.setSort([{ field: 'priority', direction: 'desc' }]);

    const { sql, params } = compiler.compileViewQuery();

    expect(sql).toContain('SELECT');
    expect(sql).toContain('folder = ?');
    expect(sql).toContain('ORDER BY priority DESC');
    expect(params).toContain('Work');
  });
});
```

---

## Key Principles

1. **Providers hold projection state, not data** — Data lives in SQLite
2. **All state compiles to SQL** — Providers are query builders
3. **Subscribe pattern for reactivity** — No framework, just callbacks
4. **Three-tier persistence** — Global survives all, Family suspends/restores, Ephemeral resets
5. **D3 data join IS state management** — No Redux, no Zustand
