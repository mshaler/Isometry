# Architecture Patterns: SuperGrid Integration

**Domain:** Polymorphic data projection platform
**Researched:** 2026-02-05
**Confidence:** HIGH

## Recommended Architecture

SuperGrid integrates with Isometry's existing sql.js + D3.js bridge elimination architecture as a **three-layer z-axis system** that preserves the core architectural principles while extending functionality.

### Core Integration Points

| Integration Layer | Existing Component | SuperGrid Extension |
|------------------|-------------------|-------------------|
| **Data Layer** | DatabaseService.ts | Direct sql.js queries with PAFV-aware SQL generation |
| **Context Layer** | PAFVContext.tsx | Grid coordinate mapping and axis allocation |
| **Rendering Layer** | D3 SuperGrid.ts | Extended with GridBlock rendering system |
| **UI Layer** | React Components | New density controls + existing filter navigation |

### Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SuperGrid Architecture                          │
│                                                                    │
│   z=2 OVERLAY    │   React Components (NEW)                       │
│   Layer          │   • Cards (expanded values)                    │
│                  │   • Overlays (audit, modals)                   │
│   ──────────────────────────────────────────────────────────────  │
│   z=1 DENSITY    │   React Controls (MIXED)                       │
│   Layer          │   • MiniNav (NEW GridBlock 1)                  │
│                  │   • FilterNav (EXISTING, enhanced)             │
│                  │   • Header spanning logic (NEW)               │
│   ──────────────────────────────────────────────────────────────  │
│   z=0 SPARSITY   │   D3.js Data Floor (ENHANCED)                 │
│   Layer          │   • Column Headers (NEW GridBlock 2)           │
│                  │   • Row Headers (NEW GridBlock 3)              │
│                  │   • Data Cells (ENHANCED GridBlock 4)          │
│                  │   • Uses existing D3 SuperGrid.ts patterns     │
│   ──────────────────────────────────────────────────────────────  │
│   DATA           │   sql.js + DatabaseService (UNCHANGED)         │
│   Foundation     │   • Same synchronous query pattern             │
│                  │   • Enhanced SQL with PAFV coordinate queries  │
└──────────────────────────────────────────────────────────────────┘
```

## Patterns to Follow

### Pattern 1: z-Axis Layer Separation
**What:** Three distinct rendering layers with clear responsibilities
**When:** Always - this is the core SuperGrid architectural pattern
**Example:**
```typescript
// z=0: D3 renders raw cells individually
const cells = this.db.query(`
  SELECT x, y, value, node_id, col_path, row_path
  FROM grid_cells WHERE view_id = ?
`);

// z=1: React adds spanning and navigation
<MiniNav gridConfig={config} />
<HeaderSpanning cells={cells} axis="column" />

// z=2: React overlays cards and modals
<CardOverlay node={selectedNode} position={cellPosition} />
```

### Pattern 2: PAFV Coordinate Mapping
**What:** Transform LATCH dimensions into grid coordinates via PAFVContext
**When:** Any view transition or axis reassignment
**Example:**
```typescript
// Existing PAFVContext wells become grid axes
const coordinateQuery = generateCoordinateQuery(wells.rows, wells.columns);

// Query returns positioned data for D3
SELECT
  ${rowAxisToX(wells.rows)} as x,
  ${colAxisToY(wells.columns)} as y,
  value,
  row_header_path,
  col_header_path
FROM pafv_projection
WHERE ...
```

### Pattern 3: Direct sql.js Binding Preservation
**What:** Keep existing zero-serialization D3 ← sql.js data flow
**When:** All SuperGrid rendering operations
**Example:**
```typescript
// EXISTING pattern (unchanged)
const cards = this.db.query(`SELECT id, name FROM nodes`);
d3.selectAll('.card').data(cards, d => d.id).join('div');

// ENHANCED pattern for SuperGrid
const gridCells = this.db.query(`
  SELECT x, y, value, node_id FROM grid_cells
`);
d3.selectAll('.grid-cell').data(gridCells, d => `${d.x},${d.y}`).join('rect');
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: React Rendering Grid Data
**What goes wrong:** React components directly rendering grid cells
**Why bad:** Violates z-axis separation, breaks sql.js → D3 direct binding
**Instead:** React controls density (navigation, spanning), D3 renders sparsity (cells)

### Anti-Pattern 2: Merged Cell Data Models
**What goes wrong:** Trying to implement header spanning by merging database cells
**Why bad:** Breaks coordinate system integrity
**Instead:** Visual spanning via React overlays on top of individual D3 cells

### Anti-Pattern 3: Breaking Bridge Elimination
**What goes wrong:** Adding serialization layers between sql.js and SuperGrid
**Why bad:** Loses the core performance advantage of the v4 architecture
**Instead:** Direct DatabaseService queries with enhanced SQL for coordinates

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **DatabaseService** | ENHANCED: Add PAFV coordinate queries | PAFVContext via SQL generation |
| **PAFVContext** | ENHANCED: Grid axis mapping + wells management | SuperGridView, DatabaseService |
| **SuperGrid (D3)** | NEW: GridBlock 2,3,4 rendering (headers + cells) | DatabaseService, React overlays |
| **SuperGridView** | NEW: Integration component orchestrating layers | All other components |
| **GridMiniNav** | NEW: GridBlock 1 navigation controls | PAFVContext, FilterNav |
| **HeaderSpanning** | NEW: Visual spanning logic for headers | SuperGrid D3 output |
| **CardOverlay** | NEW: GridBlock 5 expanded card display | SuperGridView, Node selection |

## Data Flow Changes for SuperGrid

### Current Flow (Preserved)
```
FilterContext → DatabaseService → D3 SuperGrid → React UI
    ↑                                                ↓
    └──────────── User interactions ─────────────────┘
```

### Enhanced Flow for SuperGrid
```
PAFVContext → SQL generation → DatabaseService → GridBlocks
     ↓              ↓               ↓              ↓
Wells config → Coordinate → sql.js queries → D3 rendering
     ↓           mapping        ↓              ↓
FilterNav ←─────────────────────────────→ React overlays
     ↓                                       ↓
MiniNav controls ←─────────────────→ Header spanning
```

### New SQL Query Patterns

From IsometryKB architectural patterns, SuperGrid requires enhanced SQL:

```sql
-- Anchor Origin (corner): Traditional spreadsheet
SELECT
  col_index as x,
  row_index as y,
  value,
  col_header_path,
  row_header_path
FROM grid_cells
WHERE view_id = ?
ORDER BY y DESC, x ASC;

-- Bipolar Origin (center): Eisenhower Matrix
SELECT
  urgency_rank as x,      -- Can be negative
  importance_rank as y,   -- Can be negative
  task_id as value,
  'urgency' as col_header_path,
  'importance' as row_header_path
FROM nodes
WHERE node_type = 'task'
ORDER BY ABS(x) + ABS(y) DESC;
```

## Integration with Existing Systems

### PAFVContext Integration
**Status:** MODIFY existing component
**Changes needed:**
- Add `wells` to `coordinateMapping` transformation
- Generate grid-specific SQL from axis assignments
- Maintain existing `transpose()` and `moveChip()` functionality

### DatabaseService Integration
**Status:** EXTEND existing service
**Changes needed:**
- Add coordinate-aware query builders
- Support negative coordinates for bipolar origins
- Maintain existing synchronous query pattern

### D3 SuperGrid Integration
**Status:** ENHANCE existing renderer
**Changes needed:**
- Extract current card rendering into GridBlock 4 (Data Cells)
- Add GridBlock 2 (Column Headers) and GridBlock 3 (Row Headers)
- Support coordinate-based positioning instead of just auto-grid

### FilterNav Integration
**Status:** EXTEND existing navigation
**Changes needed:**
- Add axis assignment controls (which LATCH dimension maps to x/y)
- Add density controls (sparsity ↔ density slider)
- Maintain existing filter functionality

## Scalability Considerations

| Concern | Current (100 users) | With SuperGrid (100 users) | At Scale (10K users) |
|---------|---------------------|----------------------------|---------------------|
| Memory Usage | ~50MB sql.js WASM | ~60MB (grid coordinate cache) | ~100MB (optimized indices) |
| Query Performance | Direct sql.js | Enhanced with coordinate indexing | Partitioned grid queries |
| Rendering Performance | 1000 cards | 1000 cells in 4 GridBlocks | Virtual scrolling + LOD |
| Coordinate Complexity | O(n) linear | O(n) with spatial indexing | O(log n) with QuadTree |

## Build Order Based on Dependencies

### Phase 1: Foundation Components
1. **Enhanced PAFVContext** - Add grid coordinate mapping
2. **Grid SQL Generators** - Coordinate-aware queries in DatabaseService
3. **SuperGrid D3 Base** - Extract and enhance existing SuperGrid.ts

### Phase 2: GridBlock Implementation
1. **GridBlock System** - Define z-axis layer interfaces
2. **Column/Row Headers** - GridBlocks 2&3 with D3 rendering
3. **Data Cells Enhanced** - GridBlock 4 with coordinate positioning

### Phase 3: React Overlay System
1. **SuperGridView Integration** - Orchestration component
2. **MiniNav Controls** - GridBlock 1 navigation
3. **Header Spanning Logic** - React overlays on D3 headers

### Phase 4: Advanced Features
1. **Card Overlays** - GridBlock 5 expanded values
2. **Audit/Modal Overlays** - GridBlock 6 inspection tools
3. **Origin Pattern System** - Anchor vs Bipolar coordinate patterns

## IsometryKB Architectural Patterns Applied

### Four-Quadrant Layout (from SuperGrid.md)
Applied as MiniNav + Column Headers + Row Headers + Data Cells grid structure, directly matching the CardBoard v1/v2 pattern of treating SuperGrid as "4 grids."

### Janus Density Model (from supergrid-architecture-v4.md)
Implemented as z-axis separation where D3 shows sparsity (individual cells) and React controls density (spanning, aggregation, navigation).

### PAFV Spatial Projection (from CardBoard architecture)
Extended existing PAFVContext wells system to generate coordinate mappings, enabling same data to render as traditional grid, Eisenhower matrix, or any LATCH-based projection.

### Bridge Elimination Preservation
Maintains core v4 principle: sql.js ← DatabaseService → D3 direct binding with zero serialization overhead. SuperGrid enhances but never breaks this pattern.

## Ready for Implementation

SuperGrid integration preserves Isometry's bridge elimination architecture while adding polymorphic grid rendering through a proven three-layer z-axis system. All integration points are clearly defined, with existing components requiring enhancement rather than replacement.

**Key insight:** SuperGrid isn't a separate view - it's an enhanced rendering mode for the existing D3 + sql.js foundation, controlled by PAFV axis mappings and presented through layered React controls.