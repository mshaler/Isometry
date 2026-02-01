# SuperGrid Architecture Deep Dive

## Architectural Vision

**SuperGrid represents the pinnacle of the PAFV view continuum** - a multi-dimensional data grid that transcends traditional 2D limitations through intelligent hierarchical organization and cross-dimensional positioning.

## Core Architectural Principles

### 1. Four-Grid Spatial Organization

```
┌─────────┬─────────────────────────────┐
│ MiniNav │    Column Headers           │
│   (1)   │        (3)                  │
│         │  [Axis B₁] [Axis B₂]        │
├─────────┼─────────────────────────────┤
│  Row    │                             │
│ Headers │      Data Cells             │
│   (2)   │        (4)                  │
│[Axis A₁]│                             │
│[Axis A₂]│                             │
└─────────┴─────────────────────────────┘
```

**Quadrant Responsibilities:**
- **MiniNav (1):** Axis control interface and navigation center
- **Row Headers (2):** Hierarchical Y-axis organization with spanning
- **Column Headers (3):** Hierarchical X-axis organization with spanning
- **Data Cells (4):** Value display with intelligent aggregation

### 2. Z-Axis Layering Architecture

```
z=2: Overlay Layer (React)
     ├── Card overlays
     ├── Modals and dialogs
     └── Interaction feedback

z=1: Density Layer (React)
     ├── Controls and UI elements
     ├── Headers and navigation
     └── User interaction handlers

z=0: Sparsity Layer (D3 SVG)
     ├── Data visualization
     ├── Grid rendering
     └── Performance-optimized display
```

**Layer Coordination:**
- **Sparsity Layer:** High-performance D3 rendering for large datasets
- **Density Layer:** React components for user interactions and controls
- **Overlay Layer:** Context-sensitive information and editing interfaces

### 3. PAFV Integration Architecture

**P**lanes → **A**xes → **F**acets → **V**alues mapping:

```typescript
interface PAFVMapping {
  plane: 'x' | 'y' | 'z' | 'filter';
  axis: LATCHAxis; // Location | Alphabet | Time | Category | Hierarchy
  facet: string;   // Specific attribute within axis
  values: string[]; // Actual data values
}
```

**SuperGrid PAFV Extensions:**
- **X-Plane:** Column hierarchy mapping (multiple axes supported)
- **Y-Plane:** Row hierarchy mapping (multiple axes supported)
- **Z-Plane:** Stacked header depth (SuperStack architecture)
- **Filter-Plane:** Data filtering (inherited from FilterContext)

## Component Architecture

### Core Component Hierarchy

```
SuperGrid
├── SuperGridProvider (Context)
├── SuperGridContainer
│   ├── QuadrantLayout
│   │   ├── MiniNavQuadrant
│   │   │   └── AxisNavigator
│   │   ├── ColumnHeadersQuadrant
│   │   │   └── PAFVHeader (recursive)
│   │   ├── RowHeadersQuadrant
│   │   │   └── PAFVHeader (recursive)
│   │   └── DataCellsQuadrant
│   │       └── SuperGridCell[]
│   └── D3SparsityLayer (existing)
└── PerformanceMonitor
```

### Recursive Header Architecture

```typescript
interface PAFVHeaderProps {
  axis: LATCHAxis;
  facetPath: string;
  depth: number;
  maxDepth: number;
  orientation: 'row' | 'column';
  span: number;
  children?: PAFVHeader[];
}
```

**Recursive Pattern Benefits:**
- Unlimited hierarchy depth support
- Consistent spanning calculation
- Uniform interaction patterns
- Reusable component logic

## Data Flow Architecture

### Primary Data Pipeline

```
SQLite Database
    ↓ (useFilteredNodes)
Filtered Node Array
    ↓ (useSupergridData)
Grid Cell Mapping
    ↓ (Aggregation Functions)
Aggregated Cell Values
    ↓ (useSupergridHierarchy)
Hierarchical Structure
    ↓ (Header Spanning Calculator)
Visual Layout Coordinates
    ↓ (Component Rendering)
SuperGrid Display
```

### Context Integration Flow

```
PAFVContext ──→ Axis Mappings ──→ Hierarchy Builder
FilterContext ──→ Node Filtering ──→ Cell Mapping
SelectionContext ──→ Cell Selection ──→ Overlay System
```

## Algorithm Architecture

### 1. Header Spanning Algorithm

**Problem:** Calculate visual spans for hierarchical headers

```typescript
interface SpanCalculation {
  facetPath: string;
  span: number;
  visualWidth: number;
  children: SpanCalculation[];
}

class HeaderSpanningCalculator {
  calculateSpans(
    hierarchy: HierarchyNode[],
    availableSpace: number
  ): SpanCalculation[] {
    // Recursive depth-first calculation
    // Parent span = sum of children spans
    // Proportional space allocation
    // Performance optimization with caching
  }
}
```

**Key Insights:**
- Bottom-up calculation for accuracy
- Caching for performance optimization
- Proportional sizing for responsive behavior
- Edge case handling for empty categories

### 2. Node-to-Cell Mapping Algorithm

**Problem:** Position nodes in grid based on PAFV facet values

```typescript
interface GridPosition {
  x: number;
  y: number;
  facetPaths: {
    x: string;
    y: string;
  };
}

class NodeCellMapper {
  mapNodesToGrid(
    nodes: Node[],
    xMapping: PAFVMapping,
    yMapping: PAFVMapping
  ): Map<string, GridCell> {
    // Extract facet values from nodes
    // Map to grid coordinates
    // Aggregate multi-node cells
    // Handle sparse data gracefully
  }
}
```

**Algorithm Characteristics:**
- O(n) complexity for n nodes
- Deterministic positioning
- Graceful sparse data handling
- Efficient aggregation support

### 3. Janus Translation Algorithm

**Problem:** Maintain position consistency across view transitions

```typescript
interface CanonicalPosition {
  nodeId: number;
  facetPaths: Record<LATCHAxis, string>;
  customSortOrder?: number;
  viewSpecificData?: Record<string, any>;
}

class JanusTranslator {
  preservePosition(
    node: Node,
    fromView: ViewMode,
    toView: ViewMode,
    newMappings: PAFVMapping[]
  ): GridPosition | null {
    // Extract canonical position data
    // Translate to new view coordinate system
    // Handle mapping conflicts
    // Provide fallback positioning
  }
}
```

**Translation Strategy:**
- Canonical position storage per node
- Context-aware coordinate transformation
- Conflict resolution algorithms
- Performance optimization with caching

## Performance Architecture

### Optimization Strategies

**1. Rendering Performance**
```typescript
// Virtual scrolling for large datasets
const VirtualizedDataCells = useMemo(() => {
  return virtualizeGrid(visibleCells, viewportBounds);
}, [visibleCells, viewportBounds]);

// Memoized span calculations
const headerSpans = useMemo(() => {
  return calculateSpans(hierarchy, availableWidth);
}, [hierarchy, availableWidth]);
```

**2. Memory Management**
```typescript
// Cache with TTL for expensive calculations
const spanCache = new Map<string, { spans: SpanCalculation[], timestamp: number }>();

// Cleanup on component unmount
useEffect(() => {
  return () => {
    spanCache.clear();
    coordinateCache.clear();
  };
}, []);
```

**3. Update Optimization**
```typescript
// Incremental updates for data changes
const updateStrategy = useMemo(() => {
  return shouldFullRebuild(previousData, newData) ? 'full' : 'incremental';
}, [previousData, newData]);
```

### Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|---------|
| Initial Render (100 nodes) | < 2s | TBD | 🎯 |
| Grid Update (filter change) | < 500ms | TBD | 🎯 |
| Memory Usage (1000 nodes) | < 100MB | TBD | 🎯 |
| Scroll Performance | 60fps | TBD | 🎯 |

## Integration Architecture

### Context System Integration

```typescript
// SuperGrid-specific context layer
interface SuperGridContextValue {
  // Configuration
  gridConfig: GridConfig;
  coordinateSystem: CoordinateSystem;

  // State management
  selectedCells: Set<string>;
  highlightedHeaders: Set<string>;

  // Performance tracking
  performanceMetrics: PerformanceMetrics;

  // Event handlers
  onCellClick: (cell: GridCell) => void;
  onHeaderResize: (axis: LATCHAxis, newSize: number) => void;
}
```

### External System Interfaces

**SQLite Integration:**
```typescript
// Existing patterns maintained
const { data: nodes, loading, error } = useFilteredNodes();
```

**PAFV Integration:**
```typescript
// Bidirectional communication
const { state: pafvState, setMapping, removeMapping } = usePAFV();
```

**Filter Integration:**
```typescript
// Reactive data filtering
const { filters, updateFilter } = useFilter();
```

## Security & Reliability Architecture

### Error Handling Strategy

```typescript
// Graceful degradation for complex features
const FallbackGrid = ({ reason }: { reason: string }) => {
  return <SimpleGrid message={`Advanced features disabled: ${reason}`} />;
};

// Error boundaries for component isolation
<ErrorBoundary fallback={<FallbackGrid reason="Component error" />}>
  <SuperGrid />
</ErrorBoundary>
```

### Type Safety Architecture

```typescript
// Comprehensive type coverage
interface SuperGridProps {
  data?: Node[];
  config: GridConfig;
  onError?: (error: SuperGridError) => void;
}

// Runtime validation for critical paths
const validateGridConfig = (config: GridConfig): config is ValidGridConfig => {
  return config.xAxisRange.count > 0 && config.yAxisRange.count > 0;
};
```

## Future Architecture Considerations

### Scalability Enhancements
- **Web Workers:** For heavy calculation offloading
- **Canvas Rendering:** For extreme performance requirements
- **Incremental Loading:** For very large datasets

### Mobile Architecture
- **Touch Interactions:** Gesture-based axis manipulation
- **Responsive Layout:** Adaptive quadrant sizing
- **Performance:** Battery and memory optimization

### Native Integration
- **SwiftUI Bridge:** For iOS/macOS implementation
- **State Synchronization:** Cross-platform consistency
- **Platform Optimization:** Native performance characteristics

---

**Architecture Status:** Foundation Design Complete
**Next Phase:** Implementation (Phase 30.1)
**Review Cycle:** After each major phase completion