# Canvas D3 Integration - Data Flow Architecture

**Date:** 2026-01-26
**Phase:** 11-01 Data Flow Task

## Executive Summary

Complete data flow pipeline from raw Node data through PAFV transformations to D3 rendering with reactive updates, cache optimization, and performance monitoring. Designed for smooth user interactions and efficient handling of large datasets.

---

## Data Flow Pipeline Overview

```
Raw Data → PAFV Transform → D3 Scales → Spatial Layout → Canvas Render
   ↓            ↓              ↓            ↓              ↓
Node[]   → GroupedData → ScaledDomains → Positions → VisualElements

Performance Monitoring: 📊 Cache Layer: 💾 Error Handling: ⚠️
```

### Pipeline Stages

1. **Data Source:** `useMockData()` / `useSQLiteQuery()`
2. **PAFV Transform:** Group by wells configuration
3. **Scale Generation:** Create D3 scales from PAFV chips
4. **Spatial Layout:** Calculate pixel positions
5. **Render Preparation:** Prepare canvas drawing commands
6. **Visual Output:** Canvas/SVG rendering

---

## Stage 1: Data Source Integration

### Current Mock Data Structure
```typescript
interface MockDataSource {
  nodes: Node[];           // 6 sample nodes
  loading: boolean;        // Async simulation
  error: Error | null;     // Error state
}

// Node structure from mock data
interface Node {
  id: string;              // "1", "2", "3", ...
  name: string;            // "Project Alpha", "Meeting Notes", ...
  content: string;         // "Initial project planning", ...
  folder: string;          // "Projects", "Meetings", "Research", ...
  status: string;          // "active", "completed", "pending", "draft"
  priority: string;        // "high", "medium", "low"
  createdAt: string;       // ISO date string
  modifiedAt: string;      // ISO date string
  deletedAt: null;         // Always null in mock
}
```

### Data Source Abstraction
```typescript
interface DataSource<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Unified data source hook
const useCanvasData = (): DataSource<Node> => {
  // Environment-based data source selection
  if (USE_MOCK_DATA) {
    return useMockData();
  } else {
    return useNodes(); // From useSQLiteQuery
  }
};
```

---

## Stage 2: PAFV Data Transformation

### PAFV Wells → Data Grouping

```typescript
interface PAFVTransform {
  wells: Wells;              // From PAFVContext
  nodes: Node[];             // Source data
  grouped: GroupedData;      // Result
}

interface GroupedData {
  rows: RowGroup[];          // Grouped by wells.rows
  columns: ColumnGroup[];    // Grouped by wells.columns
  layers: LayerGroup[];      // Grouped by wells.zLayers
  matrix: CellMatrix;        // Cross-tabulated data
}

interface CellMatrix {
  cells: Map<string, CellData>; // "colKey|rowKey" → CellData
  rowKeys: string[];            // Unique row combinations
  colKeys: string[];            // Unique column combinations
}
```

### PAFV Chip Value Extraction
```typescript
// Enhanced field mapping with type inference
interface FieldExtractor {
  extract(node: Node, chip: Chip): FieldValue;
  inferType(chip: Chip): 'temporal' | 'categorical' | 'numerical' | 'text';
  getDomain(nodes: Node[], chip: Chip): unknown[];
}

const createFieldExtractor = (): FieldExtractor => ({
  extract: (node: Node, chip: Chip): FieldValue => {
    const field = FIELD_MAP[chip.id] || 'folder';
    const rawValue = node[field];

    // Type-specific extraction
    switch (chip.id) {
      case 'year':
        return new Date(rawValue as string).getFullYear();
      case 'month':
        return new Date(rawValue as string).toLocaleString('default', { month: 'short' });
      case 'priority':
        return priorityToNumber(rawValue as string); // "high"→3, "medium"→2, "low"→1
      default:
        return String(rawValue ?? 'Unknown');
    }
  },

  inferType: (chip: Chip) => {
    if (['year'].includes(chip.id)) return 'temporal';
    if (['priority'].includes(chip.id)) return 'numerical';
    return 'categorical';
  },

  getDomain: (nodes: Node[], chip: Chip) => {
    const values = nodes.map(node => this.extract(node, chip));
    return Array.from(new Set(values)).sort();
  }
});
```

### Composite Key Generation
```typescript
interface CompositeKeyGenerator {
  generateRowKey(node: Node, rowChips: Chip[]): string;
  generateColKey(node: Node, colChips: Chip[]): string;
  generateCellKey(rowKey: string, colKey: string): string;
}

const createCompositeKey = (node: Node, chips: Chip[]): string => {
  return chips
    .map(chip => fieldExtractor.extract(node, chip))
    .join('|');
};

// Example with mock data:
// Node: { folder: "Projects", createdAt: "2024-01-15", ... }
// Row chips: [folder, status] → "Projects|active"
// Col chips: [year, month] → "2024|Jan"
// Cell key: "Projects|active||2024|Jan"
```

---

## Stage 3: D3 Scale Generation

### Scale Type Inference
```typescript
interface ScaleFactory {
  createScale(chip: Chip, domain: unknown[], range: [number, number]): D3Scale;
  inferOptimalScale(chip: Chip, domain: unknown[]): ScaleType;
}

const createScaleFromChip = (chip: Chip, domain: unknown[], range: [number, number]) => {
  const scaleType = fieldExtractor.inferType(chip);

  switch (scaleType) {
    case 'temporal':
      return d3.scaleTime()
        .domain(domain as Date[])
        .range(range)
        .nice();

    case 'numerical':
      return d3.scaleLinear()
        .domain(domain as number[])
        .range(range)
        .nice();

    case 'categorical':
      return d3.scaleBand()
        .domain(domain as string[])
        .range(range)
        .padding(0.1);

    default:
      return d3.scaleOrdinal()
        .domain(domain)
        .range(d3.range(range[0], range[1], (range[1] - range[0]) / domain.length));
  }
};
```

### Multi-Axis Scale System
```typescript
interface ScaleSystem {
  x: ScaleAxis;           // Column scales (hierarchical)
  y: ScaleAxis;           // Row scales (hierarchical)
  color: d3.ScaleOrdinal; // Color encoding
  size: d3.ScaleLinear;   // Size encoding
  opacity: d3.ScaleLinear; // Opacity encoding (zLayers)
}

interface ScaleAxis {
  scales: D3Scale[];      // One scale per chip in axis
  composite: D3Scale;     // Combined scale for positioning
  domains: unknown[][];   // Domain for each scale
  ranges: [number, number][]; // Range for each scale
}

// Example: Row axis with [folder, status]
const rowScales = {
  scales: [
    d3.scaleBand().domain(['Projects', 'Meetings', 'Research', 'Development', 'Documentation']).range([0, 500]),
    d3.scaleBand().domain(['active', 'completed', 'pending', 'draft']).range([0, 100])
  ],
  composite: createCompositeScale(['folder', 'status'], [0, 600])
};
```

---

## Stage 4: Spatial Layout Calculation

### Position Calculation Engine
```typescript
interface PositionCalculator {
  calculateCellBounds(cellKey: string, scaleSystem: ScaleSystem): Rect;
  calculateHeaderBounds(header: HeaderNode, axis: 'x' | 'y'): Rect;
  calculateViewport(container: DOMRect, padding: Padding): Viewport;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const calculateCellPosition = (cellData: CellData, scaleSystem: ScaleSystem): Rect => {
  const { rowKey, colKey } = cellData;
  const rowValues = rowKey.split('|');
  const colValues = colKey.split('|');

  // Hierarchical positioning
  const x = scaleSystem.x.composite(colValues);
  const y = scaleSystem.y.composite(rowValues);
  const width = scaleSystem.x.composite.bandwidth();
  const height = scaleSystem.y.composite.bandwidth();

  return { x, y, width, height };
};
```

### Viewport Management
```typescript
interface ViewportManager {
  current: Viewport;
  zoom: ZoomTransform;
  pan: PanTransform;
  visibleCells: CellData[];
  culling: CullingStrategy;
}

interface Viewport {
  x: number;           // Left bound
  y: number;           // Top bound
  width: number;       // Visible width
  height: number;      // Visible height
  scale: number;       // Zoom level
}

// Viewport culling for performance
const calculateVisibleCells = (cells: CellData[], viewport: Viewport): CellData[] => {
  return cells.filter(cell => {
    const bounds = cell.bounds;
    return (
      bounds.x < viewport.x + viewport.width &&
      bounds.x + bounds.width > viewport.x &&
      bounds.y < viewport.y + viewport.height &&
      bounds.y + bounds.height > viewport.y
    );
  });
};
```

---

## Stage 5: Render Preparation

### Canvas Drawing Commands
```typescript
interface RenderCommands {
  cells: CellDrawCommand[];
  headers: HeaderDrawCommand[];
  overlays: OverlayDrawCommand[];
}

interface CellDrawCommand {
  type: 'cell';
  bounds: Rect;
  nodes: Node[];
  style: CellStyle;
  interactive: boolean;
}

interface CellStyle {
  fill: string;         // Background color
  stroke: string;       // Border color
  strokeWidth: number;  // Border width
  opacity: number;      // Transparency
  textStyle: TextStyle; // Text rendering
}

const prepareCellDrawing = (cellData: CellData): CellDrawCommand => {
  const nodeCount = cellData.nodes.length;
  const style: CellStyle = {
    fill: nodeCount === 0 ? '#f9f9f9' : d3.schemeCategory10[0],
    stroke: '#e0e0e0',
    strokeWidth: 1,
    opacity: Math.min(1, nodeCount / 10), // Opacity indicates density
    textStyle: {
      font: '12px sans-serif',
      fill: '#333',
      textAlign: 'center',
      textBaseline: 'middle'
    }
  };

  return {
    type: 'cell',
    bounds: cellData.bounds,
    nodes: cellData.nodes,
    style,
    interactive: nodeCount > 0
  };
};
```

### Hierarchical Header Rendering
```typescript
interface HeaderRenderPlan {
  levels: HeaderLevel[];
  totalHeight: number;
  totalWidth: number;
}

const prepareHeaderRendering = (headerTree: HeaderNode, axis: 'x' | 'y'): HeaderRenderPlan => {
  const levels = flattenHeaderTree(headerTree);

  return {
    levels: levels.map(level => ({
      headers: level.headers,
      bounds: level.bounds,
      interactive: true,
      style: {
        fill: '#f5f5f5',
        stroke: '#ccc',
        textStyle: {
          font: '11px sans-serif',
          fontWeight: 'bold',
          fill: '#555'
        }
      }
    })),
    totalHeight: levels.reduce((sum, level) => sum + level.height, 0),
    totalWidth: levels.reduce((max, level) => Math.max(max, level.width), 0)
  };
};
```

---

## Stage 6: Reactive Update Management

### State Change Detection
```typescript
interface StateChanges {
  data: boolean;         // New nodes or node updates
  pafv: boolean;         // Wells configuration changed
  viewport: boolean;     // Pan, zoom, or resize
  selection: boolean;    // User selection changed
  filters: boolean;      // Search or filter changes
}

const detectChanges = (prev: D3CanvasState, next: D3CanvasState): StateChanges => {
  return {
    data: prev.rawData !== next.rawData,
    pafv: !isEqual(prev.pafvWells, next.pafvWells),
    viewport: !isEqual(prev.viewport, next.viewport),
    selection: !isEqual(prev.selection, next.selection),
    filters: prev.searchQuery !== next.searchQuery
  };
};
```

### Incremental Update Strategy
```typescript
interface UpdateStrategy {
  fullRebuild: () => void;           // Complete recreation
  dataUpdate: () => void;            // Data-only changes
  pafvUpdate: () => void;            // Scale/layout changes
  viewportUpdate: () => void;        // Pan/zoom changes
  selectionUpdate: () => void;       // Selection changes
}

const createUpdateStrategy = (changes: StateChanges): UpdateStrategy => {
  if (changes.pafv) {
    // PAFV changes require scale regeneration
    return { type: 'fullRebuild' };
  } else if (changes.data) {
    // Data changes require position recalculation
    return { type: 'dataUpdate' };
  } else if (changes.viewport) {
    // Viewport changes only need culling update
    return { type: 'viewportUpdate' };
  } else {
    // Selection changes need visual updates only
    return { type: 'selectionUpdate' };
  }
};
```

---

## Performance & Caching Architecture

### Cache Strategy
```typescript
interface CacheManager {
  scales: Map<string, D3Scale>;        // Memoized scales
  positions: Map<string, Rect>;       // Calculated positions
  renderCommands: Map<string, RenderCommands>; // Drawing instructions
  hitTestIndex: spatial.RTree;         // Spatial index for interactions
}

// Cache key generation
const createCacheKey = (type: string, inputs: unknown[]): string => {
  return `${type}:${JSON.stringify(inputs)}`;
};

// Example cache usage
const getCachedScale = (chip: Chip, domain: unknown[], range: [number, number]): D3Scale => {
  const cacheKey = createCacheKey('scale', [chip.id, domain, range]);

  if (!scaleCache.has(cacheKey)) {
    const scale = createScaleFromChip(chip, domain, range);
    scaleCache.set(cacheKey, scale);
  }

  return scaleCache.get(cacheKey)!;
};
```

### Performance Monitoring
```typescript
interface PerformanceMonitor {
  metrics: PerformanceMetrics;
  start(operation: string): void;
  end(operation: string): void;
  report(): PerformanceReport;
}

interface PerformanceMetrics {
  dataTransform: number;    // Stage 2 duration
  scaleGeneration: number;  // Stage 3 duration
  layoutCalculation: number; // Stage 4 duration
  renderPrep: number;       // Stage 5 duration
  canvasRender: number;     // Stage 6 duration
  totalPipeline: number;    // End-to-end time
  memoryUsage: number;      // Heap size
  frameRate: number;        // Animation FPS
}

// Usage in data flow
const processWithMonitoring = (nodes: Node[], wells: Wells): ProcessedData => {
  monitor.start('dataTransform');
  const grouped = transformPAFVData(nodes, wells);
  monitor.end('dataTransform');

  monitor.start('scaleGeneration');
  const scales = generateScales(grouped, wells);
  monitor.end('scaleGeneration');

  // ... continue for all stages

  return processedData;
};
```

---

## Error Handling & Recovery

### Error Categories
```typescript
interface ErrorHandling {
  dataErrors: DataErrorStrategy;     // Malformed nodes, missing fields
  scaleErrors: ScaleErrorStrategy;   // Invalid domains, empty ranges
  renderErrors: RenderErrorStrategy; // Canvas failures, memory issues
  cacheErrors: CacheErrorStrategy;   // Cache corruption, memory pressure
}

interface DataErrorStrategy {
  missingFields: 'use-default' | 'skip-node' | 'throw-error';
  invalidDates: 'use-fallback' | 'skip-node';
  emptyGroups: 'show-placeholder' | 'hide-group';
}
```

### Graceful Degradation
```typescript
const createFallbackState = (error: Error, lastKnownGood?: D3CanvasState): D3CanvasState => {
  console.warn('D3 Canvas error, falling back:', error);

  return {
    // Use minimal viable state
    rawData: lastKnownGood?.rawData || [],
    scales: createDefaultScales(),
    viewport: createDefaultViewport(),
    renderCommands: [],
    error: error.message
  };
};
```

---

## Integration Points

### React Hook Integration
```typescript
// Main hook for D3 Canvas integration
const useD3Canvas = (containerRef: RefObject<HTMLDivElement>) => {
  const { data: nodes, loading, error } = useCanvasData();
  const { wells } = usePAFV();

  // Data flow pipeline state
  const [canvasState, setCanvasState] = useState<D3CanvasState>(initialState);
  const [performance, setPerformance] = useState<PerformanceMetrics>({});

  // Process data through pipeline
  useEffect(() => {
    if (!nodes || loading) return;

    monitor.start('totalPipeline');

    try {
      const processed = processDataPipeline(nodes, wells);
      setCanvasState(processed);
    } catch (error) {
      setCanvasState(createFallbackState(error, canvasState));
    } finally {
      monitor.end('totalPipeline');
      setPerformance(monitor.getMetrics());
    }
  }, [nodes, wells, loading]);

  return {
    canvasState,
    performance,
    error: error || canvasState.error
  };
};
```

### Canvas Component Usage
```typescript
// Usage in Canvas.tsx
const Canvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasState, performance, error } = useD3Canvas(containerRef);
  const { activeView } = useAppState();

  return (
    <div ref={containerRef} className="canvas-container">
      {error ? (
        <ErrorDisplay error={error} />
      ) : activeView === 'Grid' ? (
        <D3GridView state={canvasState} />
      ) : activeView === 'List' ? (
        <D3ListView state={canvasState} />
      ) : (
        <FallbackView />
      )}

      {process.env.NODE_ENV === 'development' && (
        <PerformanceOverlay metrics={performance} />
      )}
    </div>
  );
};
```

---

## Data Flow Verification

### Mock Data Pipeline Test
```typescript
// Test complete pipeline with mock data
const testMockDataFlow = () => {
  const mockNodes = MOCK_NODES; // 6 test nodes
  const mockWells = DEFAULT_WELLS; // Default PAFV configuration

  // Stage 1: Data source ✓
  console.log('Stage 1:', mockNodes.length, 'nodes');

  // Stage 2: PAFV transform ✓
  const grouped = transformPAFVData(mockNodes, mockWells);
  console.log('Stage 2:', grouped.matrix.cells.size, 'cells');

  // Stage 3: Scale generation ✓
  const scales = generateScales(grouped, mockWells);
  console.log('Stage 3:', Object.keys(scales), 'scales');

  // Stage 4: Spatial layout ✓
  const positioned = calculateLayout(grouped, scales);
  console.log('Stage 4:', positioned.cells.length, 'positioned cells');

  // Stage 5: Render prep ✓
  const commands = prepareRenderCommands(positioned);
  console.log('Stage 5:', commands.cells.length, 'draw commands');

  return { mockNodes, grouped, scales, positioned, commands };
};

// Expected results with mock data:
// Stage 1: 6 nodes
// Stage 2: ~12 cells (3 folders × 4 time periods)
// Stage 3: { x, y, color, size } scales
// Stage 4: 12 positioned cells with bounds
// Stage 5: 12 cell draw commands + headers
```

---

## Summary

**Data Flow Architecture Complete:**

✅ **Six-stage pipeline** from raw data to visual output
✅ **Reactive updates** with change detection and incremental updates
✅ **Performance optimization** with caching and monitoring
✅ **Error handling** with graceful degradation
✅ **Integration patterns** for React hooks and components

**Ready for Implementation:**

1. **useD3Canvas hook** - Main pipeline coordination
2. **D3GridView component** - Canvas rendering for grid layout
3. **D3ListView component** - Virtual scrolling with D3
4. **Performance monitoring** - Real-time metrics and optimization

**Next:** Begin implementing the core D3 Canvas infrastructure.