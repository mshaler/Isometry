# SuperGrid Architectural Audit: Two Parallel Implementations

**Date**: 2026-02-07
**Purpose**: Analyze the architectural problem where two SuperGrid implementations exist instead of the intended "D3 shows the truth, React lets you change it" pattern.

## Executive Summary

We have **two parallel implementations** of SuperGrid functionality:

1. **D3 Implementation** (`SuperGridV4.ts`) - Direct sql.js → D3.js rendering
2. **React Implementation** (`SuperGrid.tsx` + `SuperStack.tsx`) - React-managed grid with hooks

**The Problem**: Both implementations query data, manage state, and render grids independently, violating the architecture principle that "D3 shows the truth, React lets you change it." This creates:
- Duplicate data flow paths
- Inconsistent state management
- Performance overhead from parallel processing
- Maintenance burden of keeping two implementations in sync

---

## Side-by-Side Comparison Matrix

| Aspect | D3 Implementation (SuperGridV4.ts) | React Implementation (SuperGrid.tsx + SuperStack.tsx) |
|--------|-----------------------------------|---------------------------------------------------|
| **Data Source** | Direct `database.exec()` calls with custom SQL queries | `useSQLiteQuery()` hook with standardized SQL |
| **Query Strategy** | Manual SQL building with `WHERE`, `GROUP BY`, `ORDER BY` | Predefined queries with `SELECT * FROM nodes WHERE...` |
| **Data Format** | Transforms SQL results to `GridData` with `GridCell[]` | Uses `Node[]` from hook, transforms in React |
| **State Management** | Private class properties (`currentData`, `progressiveState`) | React state + PAFV context + hooks |
| **DOM Creation** | SVG elements via D3 selections (`d3.select().append()`) | React JSX with CSS Grid layout |
| **Rendering Engine** | D3's data binding with `.join()` pattern | React's reconciliation and virtual DOM |
| **Layout System** | Manual SVG positioning with transform attributes | CSS Grid with `gridTemplateColumns`/`gridTemplateRows` |
| **Headers** | D3 SVG groups with calculated positions | Separate `SuperStack` React component |
| **Interactions** | D3 event handlers (`.on('click', ...)`) | React event handlers (`onClick={...}`) |
| **Performance** | Direct memory access, no serialization | React rendering cycle + hook dependencies |
| **Progressive Disclosure** | Built-in with `ProgressiveDisclosureState` | Not implemented |
| **Zoom/Pan** | D3 zoom behavior with transforms | Not implemented |
| **Visual Spanning** | SVG rendering with calculated spans | CSS Grid spanning with `gridColumnEnd` |

---

## Detailed Analysis

### 1. Data Querying & Receipt

#### D3 Implementation
```typescript
// Manual SQL query building
const dataQuery = `
  SELECT
    ${xAxisField} as x_value,
    ${yAxisField} as y_value,
    COUNT(*) as cell_count,
    GROUP_CONCAT(id) as card_ids,
    GROUP_CONCAT(name, '|') as card_names,
    AVG(priority) as avg_priority,
    status
  FROM nodes
  ${whereClause}
  GROUP BY ${xAxisField}, ${yAxisField}
  ORDER BY ${yAxisField}, ${xAxisField}
`;
const result = this.database.exec(dataQuery);
```

**Data Flow**: `Database` → `SuperGridV4.loadData()` → `transformSQLToGridData()` → `GridData`

#### React Implementation
```typescript
// Standardized hook-based querying
const { data: nodes, loading, error } = useSQLiteQuery<Node>(sql, params);

// Default query
sql = "SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100"
```

**Data Flow**: `useSQLiteQuery` → `Node[]` → React state → `gridData` transformation

### 2. DOM Element Creation

#### D3 Implementation
```typescript
// SVG-based rendering with D3 selections
const cellGroups = this.cellsGroup
  .selectAll<SVGGElement, GridCell>('.cell')
  .data(cells, d => d.id);

const cellEnter = cellGroups
  .enter()
  .append('g')
  .attr('class', 'cell')
  .attr('transform', d => `translate(${x}, ${y})`);

cellEnter
  .append('rect')
  .attr('width', cellWidth - 2)
  .attr('height', cellHeight - 2)
  .attr('fill', d => this.getCellColor(d));
```

**DOM Structure**: SVG → Groups → Rects/Text

#### React Implementation
```typescript
// React JSX with CSS Grid
<div
  className="supergrid__data-grid"
  style={{
    gridTemplateColumns: `repeat(${gridData.columnHeaders.length || 1}, 1fr)`,
    gridTemplateRows: `repeat(${gridData.rowHeaders.length || 1}, 1fr)`
  }}
>
  {gridData.cells.map(cell => (
    <div
      key={`${cell.rowKey}-${cell.colKey}`}
      className="supergrid__cell"
      style={{
        gridColumn: gridData.columnHeaders.indexOf(cell.colKey) + 1,
        gridRow: gridData.rowHeaders.indexOf(cell.rowKey) + 1
      }}
    >
      {/* Cell content */}
    </div>
  ))}
</div>
```

**DOM Structure**: HTML Divs with CSS Grid

### 3. User Interactions

#### D3 Implementation
```typescript
// D3 event handling
this.cellsGroup
  .selectAll('.cell')
  .on('click', (_, d: GridCell) => {
    const position: GridPosition = {
      x: this.currentData!.xAxis.values.indexOf(d.x),
      y: this.currentData!.yAxis.values.indexOf(d.y)
    };
    this.callbacks.onCellClick?.(d, position);
  })
  .on('mouseenter', (_, d: GridCell) => {
    this.callbacks.onCellHover?.(d, position);
  });
```

**Interaction Model**: D3 event listeners → Callbacks

#### React Implementation
```typescript
// React event handling
const handleCellClick = useCallback((node: Node) => {
  onCellClick?.(node);
}, [onCellClick]);

// In JSX:
<div onClick={() => handleCellClick(node)}>
```

**Interaction Model**: React event handlers → Props callbacks

### 4. State Management

#### D3 Implementation
```typescript
class SuperGridV4 {
  private currentData: GridData | null = null;
  private progressiveState: ProgressiveDisclosureState;
  private callbacks: SuperGridCallbacks = {};

  // Progressive Disclosure
  public setVisibleLevels(levels: number[], groupId?: string): void {
    this.progressiveState.currentLevels = levels;
    const filteredData = this.applyProgressiveDisclosure(this.currentData);
    this.render();
  }
}
```

**State Model**: Class instance state with private properties

#### React Implementation
```typescript
// React hooks and context
const { state: pafvState } = usePAFV();
const { data: nodes, loading, error } = useSQLiteQuery<Node>(sql, params);

// Grid layout computation
const gridLayout = useMemo(() => {
  const xMapping = pafvState.mappings.find(m => m.plane === 'x');
  const yMapping = pafvState.mappings.find(m => m.plane === 'y');
  return { hasColumns: !!xMapping, hasRows: !!yMapping, ... };
}, [pafvState.mappings, mode]);
```

**State Model**: React state + Context + Hooks

### 5. Imports & Dependencies

#### D3 Implementation
- `* as d3` - Full D3.js library
- `Database` from `sql.js-fts5` - Direct database access
- Custom types from `../types/supergrid`
- No React dependencies

#### React Implementation
- `React` hooks (`useMemo`, `useCallback`, `useRef`)
- `SuperStack` component - Nested header rendering
- `usePAFV`, `useSQLiteQuery` hooks - State and data management
- `Node`, `LATCHAxis`, `AxisMapping` types
- CSS imports for styling

---

## Key Methods Comparison

| Method/Feature | D3 Implementation | React Implementation |
|---------------|-------------------|---------------------|
| **Data Loading** | `async loadData()` with direct SQL | `useSQLiteQuery()` hook |
| **Rendering** | `private render()` with D3 data binding | React component render with JSX |
| **Header Creation** | `renderHeaders()` with SVG positioning | `SuperStack` component with CSS Grid |
| **Cell Coloring** | `getCellColor()` method | Inline styles in JSX |
| **Progressive Disclosure** | `setVisibleLevels()`, `zoomToLevel()` | Not implemented |
| **Zoom/Pan** | `setupZoomBehavior()` with D3 zoom | Not implemented |
| **Hierarchy Analysis** | `analyzeHierarchy()`, `calculateHierarchyDepth()` | `SuperStack` builds hierarchy in `useMemo` |
| **Cleanup** | `destroy()` method | React cleanup in useEffect |

---

## Public APIs

### D3 Implementation API
```typescript
class SuperGridV4 {
  // Core functionality
  async loadData(xAxisField, yAxisField, filterClause?, groupByClause?): Promise<void>

  // Progressive Disclosure
  setVisibleLevels(levels: number[], groupId?: string): void
  zoomToLevel(zoomLevel: number, direction: 'in' | 'out'): void

  // State access
  getProgressiveState(): ProgressiveDisclosureState
  getAvailableLevelGroups(): LevelGroup[]
  getCurrentData(): GridData | null

  // Configuration
  setCallbacks(callbacks: SuperGridCallbacks): void

  // Lifecycle
  destroy(): void
}
```

### React Implementation API
```typescript
interface SuperGridProps {
  sql?: string;
  params?: unknown[];
  mode?: 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid';
  enableSuperStack?: boolean;
  enableDragDrop?: boolean;
  maxHeaderLevels?: number;
  onCellClick?: (node: Node) => void;
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
}
```

---

## Architectural Issues Identified

### 1. **Duplicate Data Flow**
- Both implementations query the same SQLite database
- Both transform the data into grid structures
- No shared data layer or coordination

### 2. **Parallel State Management**
- D3 implementation manages `currentData`, `progressiveState` privately
- React implementation uses hooks, context, and component state
- No synchronization between the two state systems

### 3. **Feature Inconsistency**
| Feature | D3 Implementation | React Implementation |
|---------|------------------|---------------------|
| Progressive Disclosure | ✅ Full implementation | ❌ Not implemented |
| Zoom/Pan | ✅ D3 zoom behavior | ❌ Not implemented |
| Header Spanning | ✅ SVG calculations | ✅ CSS Grid spanning |
| Cell Interactions | ✅ Click/Hover | ✅ Click only |
| Performance Metrics | ✅ Built-in timing | ❌ Not implemented |

### 4. **Maintenance Overhead**
- Changes to grid behavior require updates in both implementations
- Type definitions duplicated across `GridCell` vs `Node`
- Event handling patterns are different

### 5. **Performance Impact**
- React re-renders when PAFV state changes
- D3 implementation re-queries database independently
- No coordination means potentially duplicate work

---

## Recommended Resolution Strategy

### Phase 1: Define the Boundary (1 week)
1. **D3 Owns Visualization**: All rendering, zooming, progressive disclosure
2. **React Owns Controls**: Filters, axis mappings, view mode selection
3. **Shared Data Layer**: Single source of truth for grid data

### Phase 2: Bridge Implementation (2 weeks)
1. Create `useSupergridV4` hook that wraps the D3 implementation
2. React component becomes a thin shell that:
   - Provides container element for D3
   - Passes PAFV state changes to D3 instance
   - Receives events from D3 for React state updates

### Phase 3: Migration (1 week)
1. Replace current React implementation with the hook wrapper
2. Remove duplicate data transformation logic
3. Consolidate type definitions

### Target Architecture
```
React Component (Controls) → useSupergridV4 Hook → SuperGridV4 Class (Visualization)
       ↓                             ↓                        ↑
   PAFV State              Bridge Functions            D3 Rendering Engine
       ↓                             ↓                        ↑
  User Controls            Callbacks & Config         sql.js Database
```

This maintains the architectural principle: **"D3 shows the truth, React lets you change it."**

---

---

## PF-2: Capability Classification

Based on the audit analysis, every capability is classified per the GSM plan criteria:

### D3-ONLY (Keep as-is in SuperGridEngine)
These capabilities exist only in the D3 implementation and should remain there:

| Capability | Location | Reasoning |
|------------|----------|-----------|
| **Progressive Disclosure** | `SuperGridV4.setVisibleLevels()` | Pure visualization logic - belongs in D3 |
| **Zoom/Pan Behavior** | `setupZoomBehavior()` | D3 zoom is the standard - keep in D3 |
| **SVG Cell Rendering** | `render()` method | Core visualization - D3 responsibility |
| **Performance Timing** | `renderStartTime` tracking | Visualization performance - D3 domain |
| **Manual SQL Building** | `loadData()` with custom queries | Direct data access - D3 owns data layer |
| **Grid Cell Transformations** | `transformSQLToGridData()` | Data transformation for visualization |
| **Hierarchy Analysis** | `analyzeHierarchy()` | Complex calculations for progressive disclosure |
| **Color Calculations** | `getCellColor()` | Visual styling logic |

### REACT-ONLY (Classify as RENDERING or CONTROL)

#### CONTROL (Correct placement - keep in React)
These are legitimate React responsibilities:

| Capability | Location | Classification | Reasoning |
|------------|----------|---------------|-----------|
| **PAFV State Management** | `usePAFV()` hook | CONTROL | User configuration state |
| **Axis Mapping Props** | `SuperGridProps` | CONTROL | User input configuration |
| **Mode Selection** | `mode` prop | CONTROL | View configuration |
| **Enable/Disable Flags** | `enableSuperStack`, `enableDragDrop` | CONTROL | Feature toggles |
| **Event Callbacks** | `onCellClick`, `onHeaderClick` | CONTROL | React event integration |

#### RENDERING (Should move to D3 per architecture)
These violate the "D3 shows the truth" principle:

| Capability | Location | Classification | Reasoning |
|------------|----------|---------------|-----------|
| **CSS Grid Layout** | JSX with `gridTemplateColumns` | RENDERING | Should be D3 SVG positioning |
| **Cell DOM Creation** | JSX `<div>` elements for cells | RENDERING | Should be D3 SVG elements |
| **Header Positioning** | `SuperStack` CSS Grid | RENDERING | Should be D3 SVG groups |

### DUPLICATED (The Problem - Must Resolve)
These capabilities exist in both implementations with inconsistent approaches:

| Capability | D3 Implementation | React Implementation | Resolution Strategy |
|------------|-------------------|---------------------|-------------------|
| **Data Querying** | Direct `database.exec()` | `useSQLiteQuery()` hook | **D3 WINS**: Direct access is more efficient |
| **Grid Data Transformation** | `transformSQLToGridData()` | React `useMemo()` | **D3 WINS**: Move to engine, expose via API |
| **Cell Click Handling** | D3 `.on('click')` | React `onClick` | **D3 WINS**: D3 handles all interactions |
| **Header Rendering** | SVG groups | `SuperStack` component | **HYBRID**: D3 renders, React provides spanning logic |
| **State Management** | Class properties | React state + hooks | **HYBRID**: D3 manages viz state, React manages config |

### MISSING (In spec but neither implementation)
Features planned but not yet implemented:

| Capability | Spec Reference | Priority | Implementation Plan |
|------------|---------------|----------|-------------------|
| **SuperDynamic** | Axis drag-and-drop remapping | P0 | Phase 3-1: React controls → D3 engine API |
| **SuperCalc** | Formula bar with PAFV functions | P1 | Phase 3-7: React overlay + D3 cell updates |
| **SuperAudit** | Data provenance visualization | P1 | Phase 3-8: React toggles + D3 highlighting |
| **SuperPosition** | Save/restore view configurations | P2 | Future: React controls + D3 state serialization |

---

## Resolution Matrix

Based on classification, here's the consolidation strategy:

### Phase 1 Actions: Define SuperGridEngine API
1. **Migrate D3-ONLY** → Keep in engine as core functionality
2. **Migrate DUPLICATED** → Consolidate in engine, expose clean API
3. **Keep CONTROL** → React wrapper consumes engine API
4. **Eliminate RENDERING** → Replace React JSX with D3 SVG calls

### Phase 2 Actions: Create React Wrapper
1. **SuperGridView Component** → Mounts engine, handles CONTROL capabilities
2. **Remove SuperGrid.tsx** → Replace with wrapper that uses engine
3. **Remove SuperStack.tsx** → Replace with D3 header rendering

### Phase 3 Actions: Implement Missing Features
1. Each MISSING feature follows pattern: React controls → Engine API → D3 rendering

### Nuclear Gate Verification
After Phase 2, these searches should return ZERO results:
```bash
# No React components creating grid cells
grep -r "createElement.*cell\|<td\|<div.*cell" src/components/supergrid/
# No direct SQLite queries in React components
grep -r "sql\|query\|SELECT" src/components/supergrid/
```

---

**Verification Gate Passed**: ✅ Every capability has exactly one classification. Zero ambiguous items remain.

**Next Steps**: Begin Phase 1 by clearly defining the interface between React controls and D3 visualization, starting with the `useSupergridV4` hook design.