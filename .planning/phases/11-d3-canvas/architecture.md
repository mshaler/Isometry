# Canvas D3 Integration - Architecture Design

**Date:** 2026-01-26
**Phase:** 11-01 Architecture Task

## Executive Summary

Hybrid SVG/Canvas architecture for optimal performance and accessibility. PAFV wells map to D3 scales with data-driven spatial positioning. Component-based architecture maintains React patterns while leveraging D3's data binding for smooth animations and high-performance rendering.

---

## D3 Integration Architecture

### 1. Hybrid Rendering Strategy

**Decision: SVG + Canvas + DOM Layers**

```typescript
interface CanvasLayers {
  dom: HTMLElement;      // Accessibility, complex controls
  svg: SVGElement;       // Interactive headers, axes, overlays
  canvas: HTMLCanvasElement; // High-performance data rendering
}
```

**Layer Responsibilities:**
- **DOM Layer:** Search controls, accessibility tree, complex text input
- **SVG Layer:** Headers, axes, grid lines, interactive elements, transitions
- **Canvas Layer:** Data cells/items, high-frequency updates, performance-critical rendering

**Benefits:**
- Best performance for data rendering (Canvas)
- Full accessibility support (DOM)
- Smooth animations and interactions (SVG)
- Manageable complexity (layered approach)

### 2. PAFV → D3 Scale Architecture

```typescript
interface D3ScaleSystem {
  x: D3ScaleConfig;      // From wells.columns
  y: D3ScaleConfig;      // From wells.rows
  z: D3LayerConfig[];    // From wells.zLayers
  color: D3ColorScale;   // From data attributes
  size: D3SizeScale;     // From data attributes
}

interface D3ScaleConfig {
  type: 'band' | 'linear' | 'time' | 'ordinal';
  domain: unknown[];     // Data values
  range: [number, number]; // Pixel coordinates
  padding: number;       // Scale padding
  nice?: boolean;        // Nice ticks
}
```

**PAFV Wells → D3 Scale Mapping:**
```typescript
const createScaleFromChips = (chips: Chip[], range: [number, number]) => {
  const scaleType = inferScaleType(chips);
  const domain = extractDomainFromData(chips, data);

  switch(scaleType) {
    case 'temporal':
      return d3.scaleTime().domain(domain).range(range);
    case 'categorical':
      return d3.scaleBand().domain(domain).range(range).padding(0.1);
    case 'ordinal':
      return d3.scaleOrdinal().domain(domain).range(range);
    case 'continuous':
      return d3.scaleLinear().domain(domain).range(range).nice();
  }
};
```

### 3. Component Architecture

```typescript
// Main D3 Canvas wrapper
<D3Canvas>
  <D3GridRenderer />     // Grid view with spatial layout
  <D3ListRenderer />     // List view with virtualization
  <D3Overlay />          // Interactive overlay layer
</D3Canvas>

// Hook-based state management
interface UseD3CanvasState {
  scales: D3ScaleSystem;
  viewport: Viewport;
  selection: Selection;
  animation: AnimationManager;
  performance: PerformanceMonitor;
}
```

---

## GridView D3 Architecture

### 1. Spatial Layout System

**Current CSS Grid → D3 Coordinate System:**
```typescript
// Before: CSS Grid positioning
style={{
  gridColumn: `${colStart} / span ${colSpan}`,
  gridRow: `${rowStart} / span ${rowSpan}`
}}

// After: D3 spatial positioning
.attr('x', d => xScale(d.colValue))
.attr('y', d => yScale(d.rowValue))
.attr('width', d => xScale.bandwidth())
.attr('height', d => yScale.bandwidth())
```

**Hierarchical Header System:**
```typescript
interface HeaderHierarchy {
  levels: HeaderLevel[];     // Depth-based organization
  tree: HeaderNode;          // Hierarchical structure
  flattened: FlatHeader[];   // Positioning data
}

interface HeaderLevel {
  depth: number;
  headers: HeaderNode[];
  height: number;            // SVG height allocation
  yOffset: number;           // Cumulative offset
}
```

### 2. Data Cell Rendering

**Canvas-based Cell Rendering:**
```typescript
interface CellRenderer {
  drawCell(ctx: CanvasRenderingContext2D, cell: DataCell): void;
  drawText(ctx: CanvasRenderingContext2D, text: string, bounds: Rect): void;
  drawMultipleNodes(ctx: CanvasRenderingContext2D, nodes: Node[], bounds: Rect): void;
}

interface DataCell {
  nodes: Node[];           // Data in this cell
  bounds: Rect;            // Pixel boundaries
  colPath: string[];       // Column hierarchy path
  rowPath: string[];       // Row hierarchy path
  isEmpty: boolean;        // No data indicator
}
```

**Benefits of Canvas Rendering:**
- High performance for many cells (1000+ data points)
- Custom visual styling without DOM overhead
- Smooth animations and transitions
- Pixel-perfect control

### 3. Interactive Layer

**SVG Overlay for Interactions:**
```typescript
interface InteractiveLayer {
  hitZones: HitZone[];        // Invisible interaction areas
  tooltips: TooltipManager;   // Hover information
  selection: SelectionManager; // Multi-select support
  zoom: ZoomManager;          // Pan/zoom behavior
}

interface HitZone {
  bounds: Rect;              // Interaction area
  nodes: Node[];             // Associated data
  handlers: EventHandlers;   // Click, hover, etc.
}
```

---

## ListView D3 Architecture

### 1. Virtual Scrolling with D3

**Data-Driven Virtualization:**
```typescript
interface D3VirtualList {
  viewport: Viewport;        // Current scroll position
  itemHeight: (d: ListItem) => number; // Dynamic sizing
  visibleData: ListItem[];   // Currently rendered items
  bufferSize: number;        // Overscan items
}

// Viewport calculation
const calculateViewport = (scrollTop: number, containerHeight: number) => ({
  startIndex: Math.floor(scrollTop / avgItemHeight) - bufferSize,
  endIndex: Math.ceil((scrollTop + containerHeight) / avgItemHeight) + bufferSize,
  yOffset: scrollTop
});
```

**Smooth Scroll Animations:**
```typescript
// D3 transition-based scrolling
svg.selectAll('.list-item')
   .data(visibleData, d => d.id)
   .transition()
   .duration(200)
   .ease(d3.easeQuadOut)
   .attr('transform', d => `translate(0, ${getItemY(d)})`);
```

### 2. Search and Filtering

**Animated Search Results:**
```typescript
interface SearchRenderer {
  highlightText(text: string, query: string): TextHighlight[];
  animateFilterResults(items: ListItem[]): void;
  updateGroupHeaders(groups: ItemGroup[]): void;
}

// Search highlighting with Canvas text
const drawHighlightedText = (ctx: CanvasRenderingContext2D,
                            text: string,
                            highlights: TextHighlight[],
                            bounds: Rect) => {
  // Draw base text
  ctx.fillStyle = '#333';
  ctx.fillText(text, bounds.x, bounds.y);

  // Overlay highlights
  highlights.forEach(h => {
    ctx.fillStyle = '#ffeb3b66';
    ctx.fillRect(h.x, h.y, h.width, h.height);
  });
};
```

### 3. Grouping Visualization

**PAFV-based Grouping:**
```typescript
interface GroupRenderer {
  createGroupHeaders(facet: Chip): GroupHeader[];
  animateGroupCollapse(groupKey: string): void;
  renderGroupSeparators(): void;
}

// Group header with expand/collapse
const renderGroupHeader = (group: ItemGroup) => {
  return {
    height: GROUP_HEADER_HEIGHT,
    collapsible: true,
    itemCount: group.items.length,
    facetValue: group.facetValue
  };
};
```

---

## Data Flow Architecture

### 1. Data Transformation Pipeline

```typescript
// Complete data flow from source to rendering
interface DataPipeline {
  source: Node[];                    // Raw node data
  filtered: Node[];                  // After search/filters
  grouped: GroupedData;              // PAFV facet grouping
  scaled: ScaledData;                // D3 scale application
  positioned: PositionedData;        // Final coordinates
  rendered: VisualElements;          // Canvas/SVG elements
}

// Pipeline stages
const transformData = (nodes: Node[], pafvWells: Wells): DataPipeline => {
  const filtered = applySearchFilters(nodes);
  const grouped = groupByPAFVFacets(filtered, pafvWells);
  const scaled = applyD3Scales(grouped, scaleSystem);
  const positioned = calculatePositions(scaled, viewport);
  return { source: nodes, filtered, grouped, scaled, positioned };
};
```

### 2. Reactive State Management

```typescript
interface D3CanvasState {
  data: DataPipeline;
  scales: D3ScaleSystem;
  viewport: Viewport;
  interaction: InteractionState;
  animation: AnimationState;
  performance: PerformanceMetrics;
}

// State updates trigger efficient re-rendering
const useD3CanvasState = () => {
  const [state, setState] = useState<D3CanvasState>(initialState);

  // Reactive data updates
  useEffect(() => {
    const newPipeline = transformData(rawData, pafvWells);
    setState(prev => ({ ...prev, data: newPipeline }));
  }, [rawData, pafvWells]);

  // Scale updates
  useEffect(() => {
    const newScales = createScalesFromPAFV(pafvWells, viewport);
    setState(prev => ({ ...prev, scales: newScales }));
  }, [pafvWells, viewport]);
};
```

### 3. Cache and Performance

```typescript
interface CacheStrategy {
  scaleCache: Map<string, D3Scale>;     // Memoized scales
  positionCache: Map<string, Position>; // Layout calculations
  renderCache: OffscreenCanvas;         // Pre-rendered elements
  hitTestCache: spatial.RTree;          // Spatial index for interactions
}

// Efficient updates with minimal recalculation
const optimizedUpdate = (changes: StateChanges) => {
  if (changes.data && !changes.scales) {
    // Data-only update: reuse scales, recalculate positions
    return updatePositionsOnly(changes.data);
  }

  if (changes.scales && !changes.data) {
    // Scale-only update: reapply scales to existing data
    return updateScalesOnly(changes.scales);
  }

  // Full update: recalculate everything
  return fullUpdate(changes);
};
```

---

## Performance Architecture

### 1. Rendering Performance

**Target Metrics:**
```typescript
interface PerformanceTargets {
  frameRate: 60;              // FPS for animations
  renderTime: 16;             // Max ms per frame
  interactionDelay: 100;      // Max ms for user interactions
  memoryUsage: 50;            // Max MB for 10k items
  initialLoad: 2000;          // Max ms for first render
}
```

**Optimization Strategies:**
```typescript
interface OptimizationStrategy {
  viewport: 'render-only-visible';     // Viewport culling
  canvas: 'double-buffer';             // Smooth animations
  layout: 'incremental-update';        // Partial recalculation
  memory: 'pool-objects';              // Object reuse
  interaction: 'spatial-index';        // Fast hit testing
}
```

### 2. Animation Architecture

**Smooth Transitions:**
```typescript
interface AnimationManager {
  transitions: Map<string, Transition>; // Active animations
  timeline: AnimationTimeline;          // Coordination
  easing: EasingFunctions;              // Motion curves
}

// PAFV axis changes with smooth transitions
const animatePAFVChange = (oldWells: Wells, newWells: Wells) => {
  const transition = d3.transition()
    .duration(300)
    .ease(d3.easeCubicInOut);

  // Animate scale changes
  updateScales(newWells, transition);

  // Animate position changes
  updatePositions(transition);

  // Animate appearance/disappearance
  updateVisibility(transition);
};
```

### 3. Memory Management

**Efficient Object Lifecycle:**
```typescript
interface MemoryManager {
  objectPool: ObjectPool;        // Reusable objects
  textureCache: TextureCache;    // Canvas texture atlas
  eventCache: EventCache;        // Event handler reuse
}

// Object pooling for high-frequency updates
class CanvasElementPool {
  private available: CanvasElement[] = [];

  acquire(): CanvasElement {
    return this.available.pop() || new CanvasElement();
  }

  release(element: CanvasElement): void {
    element.reset();
    this.available.push(element);
  }
}
```

---

## Error Handling & Accessibility

### 1. Error Boundaries

```typescript
interface D3ErrorHandling {
  scaleErrors: 'fallback-to-default';    // Invalid domain/range
  dataErrors: 'show-error-state';        // Missing/malformed data
  renderErrors: 'graceful-degradation';  // Canvas failures
  performanceErrors: 'reduce-quality';   // Frame rate issues
}
```

### 2. Accessibility Layer

**Screen Reader Support:**
```typescript
interface AccessibilityLayer {
  ariaTree: ARIATreeNode[];        // Screen reader tree
  focusManager: FocusManager;      // Keyboard navigation
  announcements: LiveRegion;       // Dynamic updates
}

// Maintain DOM accessibility tree parallel to Canvas
const buildAccessibilityTree = (data: PositionedData): ARIATreeNode[] => {
  return data.groups.map(group => ({
    role: 'group',
    label: group.label,
    children: group.items.map(item => ({
      role: 'gridcell',
      label: `${item.name} in ${group.label}`,
      tabindex: 0,
      onClick: () => selectItem(item)
    }))
  }));
};
```

---

## Implementation Priority

### Phase 1: Core D3 Infrastructure
1. ✅ Analysis complete
2. ✅ Architecture design complete
3. 🔄 **Next:** D3 hook creation (`useD3Canvas`)
4. 🔄 **Next:** PAFV → D3 scale conversion
5. 🔄 **Next:** Basic Canvas rendering

### Phase 2: GridView D3 Integration
1. SVG header rendering
2. Canvas cell rendering
3. Interactive overlay layer
4. Performance optimization

### Phase 3: ListView D3 Integration
1. Virtual scrolling with D3
2. Search result animations
3. Group visualization
4. Performance validation

### Phase 4: Polish & Optimization
1. Smooth animations
2. Accessibility implementation
3. Error handling
4. Performance monitoring

---

## Technical Decisions Summary

| Decision | Chosen Option | Rationale |
|----------|---------------|-----------|
| **Rendering** | SVG + Canvas Hybrid | Performance + Accessibility |
| **Scale System** | PAFV → D3 Scales | Leverage D3's scale ecosystem |
| **State Management** | Hook-based | Integrate with React patterns |
| **Performance** | Viewport + Caching | Handle large datasets efficiently |
| **Accessibility** | Parallel DOM Tree | Full screen reader support |
| **Animations** | D3 Transitions | Smooth, coordinated motion |

**Next Step:** Implement `useD3Canvas` hook and begin GridView D3 integration.