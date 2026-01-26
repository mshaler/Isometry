# Canvas D3 Integration - Current Implementation Analysis

**Date:** 2026-01-26
**Phase:** 11-01 Analysis Task

## Executive Summary

Current Canvas implementation uses CSS Grid and react-window for visualization, bypassing D3 entirely. PAFV context exists but only partially integrated. Conversion to D3 canvas rendering requires complete architectural shift from DOM-based layouts to programmatic SVG/Canvas rendering with D3 data binding.

---

## Current Data Flow Analysis

### 1. Canvas Component Flow
```
Canvas.tsx
├── useMockData() → Node[] (6 mock items)
├── useAppState() → activeView (string)
├── usePAFV() → wells (columns, rows, zLayers)
└── renderView() → switches to specific view components

Data Path: Mock Data → Canvas → View Component → DOM
```

### 2. GridView Current Implementation

**Technology:** CSS Grid + hierarchical headers

**PAFV Integration Points:**
```typescript
// Current PAFV usage in GridView
const colChips = wells.columns.length > 0 ? wells.columns : [{ id: 'year', label: 'Year' }];
const rowChips = wells.rows.length > 0 ? wells.rows : [{ id: 'folder', label: 'Folder' }];

// Data grouping by PAFV axes
const colKey = getCompositeKey(node, colChips);
const rowKey = getCompositeKey(node, rowChips);
```

**Current Layout Strategy:**
- CSS Grid with dynamic template columns/rows
- Hierarchical headers calculated via tree structures
- Cell positioning through grid coordinates
- No transitions or animations

**Performance Characteristics:**
- Static CSS layout (no reflow optimization)
- No virtualization (all cells rendered)
- Header calculation on every render
- Manual position management

### 3. ListView Current Implementation

**Technology:** react-window virtualization + search/filtering

**Key Features:**
```typescript
- VariableSizeList with 100px item height
- Search filtering by name/content/tags
- Grouping by PAFV Y-axis (optional)
- Sort direction toggle
```

**Performance Characteristics:**
- Virtual scrolling for 10,000+ items
- Debounced search (planned, immediate now)
- Group header height: 44px, item height: 100px
- Memory efficient for large datasets

---

## PAFV Framework Integration Analysis

### Current PAFV State
```typescript
DEFAULT_WELLS = {
  rows: [
    { id: 'folder', label: 'Folder' },
    { id: 'subfolder', label: 'Sub-folder' },
    { id: 'tags', label: 'Tags' }
  ],
  columns: [
    { id: 'year', label: 'Year' },
    { id: 'month', label: 'Month' }
  ],
  zLayers: [
    { id: 'auditview', label: 'Audit View', hasCheckbox: true, checked: false }
  ]
}
```

### PAFV → Node Field Mapping
```typescript
FIELD_MAP = {
  folder: 'folder',        // Node.folder
  subfolder: 'status',     // Node.status (aliased)
  tags: 'folder',          // Node.folder (reused)
  year: 'createdAt',       // Node.createdAt → extract year
  month: 'createdAt',      // Node.createdAt → extract month
  category: 'folder',      // Node.folder
  status: 'status',        // Node.status
  priority: 'priority'     // Node.priority
}
```

### Integration Gaps

**GridView:**
- ✅ Wells used for row/column headers
- ✅ Composite key generation from PAFV chips
- ❌ No zLayers support (audit view ignored)
- ❌ No dynamic axis swapping
- ❌ No visual feedback for PAFV changes

**ListView:**
- ✅ Grouping by Y-axis facet
- ❌ No column axes integration
- ❌ No spatial positioning
- ❌ No zLayers support

---

## CSS Grid → D3 Conversion Analysis

### Current CSS Grid Pattern
```css
grid-template-columns: repeat(${numColHeaders}, 80px) repeat(${numDataCols}, minmax(100px, 1fr))
grid-template-rows: repeat(${numRowHeaders}, 28px) repeat(${numDataRows}, minmax(40px, 1fr))
```

### D3 Spatial Layout Requirements

**1. Coordinate System:**
```
Grid Layout (CSS) → Spatial Layout (D3)
- Column headers → X-axis scales
- Row headers → Y-axis scales
- Cell positioning → (x,y) coordinates
- Hierarchical headers → Nested coordinate spaces
```

**2. Scale Types:**
```typescript
// PAFV Chip → D3 Scale mapping
const scaleMap = {
  'year': d3.scaleTime(),      // Temporal scale
  'month': d3.scaleBand(),     // Ordinal scale
  'folder': d3.scaleBand(),    // Categorical scale
  'priority': d3.scaleOrdinal(), // Discrete values
  'status': d3.scaleBand()     // Categorical scale
}
```

**3. Data Binding Pattern:**
```typescript
// Current: Static DOM generation
<div style={{ gridColumn: x, gridRow: y }}>

// D3 Target: Data-driven positioning
svg.selectAll('.cell')
   .data(cellData)
   .enter().append('rect')
   .attr('x', d => xScale(d.colValue))
   .attr('y', d => yScale(d.rowValue))
```

---

## ListView → D3 Virtualization Strategy

### Current react-window Implementation
```typescript
<VariableSizeList
  height={containerHeight}
  itemCount={items.length}
  itemSize={getItemSize}
  overscanCount={5}
/>
```

### D3 Virtual Scrolling Equivalent
```typescript
// D3 viewport-based rendering
const visibleRange = calculateVisibleItems(scrollTop, containerHeight);
const visibleData = items.slice(visibleRange.start, visibleRange.end);

svg.selectAll('.item')
   .data(visibleData, d => d.id)
   .enter().append('g')
   .attr('transform', d => `translate(0, ${getItemY(d)})`)
```

**Benefits of D3 approach:**
- Smooth scroll animations
- Custom item rendering (not just DOM)
- Better performance for complex visualizations
- Seamless zoom/pan integration

---

## Performance Analysis

### Current Performance Characteristics

**GridView:**
- Header calculation: O(n) on every render
- No memoization of header structures
- CSS Grid reflow on data changes
- Memory: All cells rendered simultaneously

**ListView:**
- Virtual scrolling: O(viewport) rendering
- Search filtering: O(n) on input change
- React re-renders on scroll
- Memory efficient for large datasets

### D3 Performance Targets

**GridView D3:**
- Header calculation: Memoized, O(1) after initial
- Canvas/SVG rendering: 60fps target
- Smooth transitions: 300ms duration max
- Memory: Viewport-based rendering only

**ListView D3:**
- Virtual scrolling: Maintain O(viewport) efficiency
- Smooth animations: Accelerated transforms
- Search highlighting: Canvas-based text rendering
- Memory: < 50MB for 10,000 items

---

## Technical Debt & Constraints

### Current Technical Debt
1. **GridView header recalculation:** No memoization strategy
2. **PAFV partial integration:** zLayers ignored in both views
3. **No transition animations:** Static layout changes
4. **Performance monitoring:** No metrics collection
5. **Accessibility:** Limited screen reader support

### D3 Integration Constraints
1. **Accessibility:** Canvas/SVG requires manual ARIA implementation
2. **Text rendering:** CSS text rendering vs Canvas text performance
3. **Hit testing:** Manual event handling vs automatic DOM events
4. **Browser compatibility:** Canvas performance varies
5. **Development complexity:** D3 learning curve for maintenance

---

## Recommended D3 Architecture

### 1. Hybrid Approach: SVG + Canvas
- **SVG:** Interactive elements (headers, controls, overlays)
- **Canvas:** High-performance data rendering (cells, items)
- **DOM:** Accessibility layer and complex text

### 2. PAFV Integration Strategy
```typescript
interface D3CanvasState {
  xScale: d3.Scale;     // From wells.columns
  yScale: d3.Scale;     // From wells.rows
  zLayers: Layer[];     // From wells.zLayers
  viewport: Viewport;   // Current view bounds
  transitions: AnimationManager;
}
```

### 3. Data Flow Architecture
```
Mock Data → PAFV Transform → D3 Scales → Canvas Rendering
     ↓            ↓             ↓            ↓
  Node[]    → ScaledData → D3 Selection → Visual Output
```

---

## Integration Readiness Assessment

### ✅ Ready for D3 Integration
- PAFV context architecture
- Mock data structure
- Basic view routing
- useD3 hook foundation

### ⚠️ Needs Development
- D3 data binding patterns
- PAFV → D3 scale conversion
- Canvas rendering performance
- Transition management

### ❌ Blockers
- No zLayers implementation
- Missing accessibility layer
- No performance monitoring
- Limited error boundaries

---

## Next Steps

1. **Task 2:** Design D3 architecture with SVG/Canvas hybrid approach
2. **Task 3:** Map data flow from useMockData to D3 rendering
3. **Implementation:** Start with GridView D3 conversion
4. **Performance:** Establish monitoring and optimization

**Critical Decision:** SVG vs Canvas vs Hybrid approach for optimal performance and accessibility.