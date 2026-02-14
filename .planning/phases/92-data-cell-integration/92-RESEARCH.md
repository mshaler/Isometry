# Phase 92: Data Cell Integration - Research

**Researched:** 2026-02-14
**Domain:** D3.js data cell rendering, scroll coordination, density-aware rendering
**Confidence:** HIGH

## Summary

Phase 92 bridges the gap between the interactive header system (Phase 91) and the actual data display. The goal is to render data cells at correct positions aligned with leaf headers, coordinate scroll behavior between fixed headers and scrollable data area, implement density-aware cell rendering (counts vs card chips), and synchronize selection state between headers and cells.

The existing codebase provides strong foundations: `GridBlock4_DataCells.tsx` demonstrates D3 data cell rendering patterns, `SuperGridScroll.test.tsx` documents the CSS sticky header scroll architecture (SCROLL-01 through SCROLL-05), `coordinate-system.ts` provides logical-to-screen position mapping, and `RenderModes.ts` shows density-based rendering patterns (grid/matrix/hybrid modes). Phase 92 is primarily about integration and coordination rather than building new primitives.

**Key findings:**
- CSS sticky positioning handles header freeze, NOT D3 transforms (SCROLL-01, SCROLL-02)
- D3 zoom is scale-only; CSS scroll handles pan (SCROLL-05 - eliminates competing systems)
- Coordinate system maps logical (row/col indices) to screen pixels accounting for header offsets
- Density level determines rendering mode: sparse = individual cards, dense = count badges/chips
- Selection state lives in SelectionContext, synchronized via header click handlers and cell click handlers

**Primary recommendation:** Build a `DataCellRenderer` service that queries for visible cell data based on scroll viewport, uses the coordinate system to position cells relative to leaf headers, switches rendering mode based on JanusDensityState, and wires selection events to SelectionContext. Use CSS Grid layout with sticky headers, not D3 pan transforms.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Data cell rendering via .join() | Already used for headers; same data binding pattern |
| React | 18 | Scroll container and density controls | UI chrome layer; manages JanusDensityState |
| CSS Grid | Native | Layout structure with sticky headers | Browser-native sticky positioning; no competing D3 transforms |
| TypeScript | 5.x (strict) | Type-safe coordinate calculations | Project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-selection | v7 (part of D3) | .join() for enter/update/exit | All data cell rendering |
| d3-transition | v7 (part of D3) | Smooth density transitions | When switching sparse ↔ dense |
| Coordinate System | Custom (in codebase) | Logical → screen position mapping | All cell positioning calculations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS sticky headers | D3 transform with scroll sync | CSS is browser-native, faster, no competing systems (SCROLL-05) |
| Custom scroll sync | Third-party scrollgrid library | Adds dependency; existing pattern works (SuperGridScroll tests prove it) |
| Manual position calculation | CSS Grid auto-placement | CSS Grid handles header alignment automatically |
| Separate header/data containers | Single scroll container | Would violate SCROLL-05 (single source of truth for pan) |

**Installation:**
```bash
# All dependencies already in package.json
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── d3/
│   └── grid-rendering/
│       ├── GridRenderingEngine.ts        # ✅ Existing, extend with cell rendering
│       ├── NestedHeaderRenderer.ts       # ✅ Existing, header rendering
│       └── DataCellRenderer.ts           # 🆕 Phase 92 data cell renderer
├── services/
│   └── supergrid/
│       ├── HeaderLayoutService.ts        # ✅ Existing, header positioning
│       └── CellDataService.ts            # 🆕 Phase 92 cell data queries
├── components/
│   ├── GridBlock4_DataCells.tsx          # ✅ Existing pattern to extend
│   └── supergrid/
│       └── SuperGridScroll.tsx           # 🆕 Phase 92 scroll container
├── utils/
│   └── coordinate-system/
│       └── coordinate-system.ts          # ✅ Existing, logical ↔ screen mapping
└── types/
    ├── grid.ts                           # ✅ DataCellData, D3CoordinateSystem
    └── density-control.ts                # ✅ JanusDensityState
```

### Pattern 1: CSS Sticky Header Layout

**What:** CSS Grid layout with sticky headers, single scroll container, upper-left anchor
**When to use:** All SuperGrid scroll scenarios (SCROLL-01 through SCROLL-05 requirements)
**Example:**
```typescript
// Source: SuperGridScroll.test.tsx lines 28-114 (existing test pattern)
<div className="supergrid" style={{
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gridTemplateRows: 'auto 1fr',
  overflow: 'auto', // Single scroll container (SCROLL-05)
  width: '100%',
  height: '100%'
}}>
  {/* Corner cell - sticky at top-left */}
  <div className="supergrid__corner" style={{
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 3
  }} />

  {/* Column headers - sticky at top */}
  <div className="supergrid__column-headers" style={{
    position: 'sticky',
    top: 0,
    zIndex: 2
  }}>
    {/* D3 renders headers here */}
  </div>

  {/* Row headers - sticky at left */}
  <div className="supergrid__row-headers" style={{
    position: 'sticky',
    left: 0,
    zIndex: 1,
    gridRow: 2
  }}>
    {/* D3 renders headers here */}
  </div>

  {/* Data grid - scrollable content */}
  <div className="supergrid__data-grid" style={{
    gridRow: 2,
    gridColumn: 2,
    transformOrigin: '0 0' // Upper-left anchor for zoom (SCROLL-04)
  }}>
    {/* D3 renders data cells here */}
  </div>
</div>
```

### Pattern 2: Logical to Screen Position Mapping

**What:** Convert logical cell coordinates (row/col indices) to screen pixels accounting for header offsets
**When to use:** Positioning every data cell relative to leaf headers
**Example:**
```typescript
// Source: coordinate-system.ts lines 97-111 (existing implementation)
const coordinateSystem: D3CoordinateSystem = createCoordinateSystem(
  'anchor', // Upper-left origin pattern
  cellWidth,
  cellHeight,
  {
    headerOffsetX: 150, // Row header width
    headerOffsetY: 40,  // Column header height
  }
);

// Position cell at logical (2, 5) - 3rd column, 6th row
const { x, y } = coordinateSystem.logicalToScreen(2, 5);
// Returns: { x: 150 + (2 * cellWidth), y: 40 + (5 * cellHeight) }

// Use in D3 data binding
cellGroups.select('.cell-bg')
  .attr('x', d => coordinateSystem.logicalToScreen(d.logicalX, d.logicalY).x)
  .attr('y', d => coordinateSystem.logicalToScreen(d.logicalX, d.logicalY).y);
```

### Pattern 3: Density-Aware Cell Rendering

**What:** Switch rendering mode based on density state: sparse = individual cards, dense = count badges
**When to use:** CELL-03 requirement - density affects rendering
**Example:**
```typescript
// Source: RenderModes.ts lines 100-139 (existing density rendering)
function renderCellsByDensity(
  cells: DataCellData[],
  densityState: JanusDensityState,
  container: d3.Selection<SVGGElement, unknown, null, undefined>
) {
  // Aggregate cells when in dense mode
  const aggregatedCells = densityState.valueDensity === 'collapsed'
    ? aggregateCellsByPosition(cells)
    : cells;

  const cellGroups = container
    .selectAll('.data-cell')
    .data(aggregatedCells, d => d.id)
    .join('g')
      .attr('class', 'data-cell');

  if (densityState.valueDensity === 'leaf') {
    // Sparse mode: render individual card with text
    cellGroups.append('rect')
      .attr('class', 'cell-bg')
      .attr('width', cellWidth - 2)
      .attr('height', cellHeight - 2);

    cellGroups.append('text')
      .attr('class', 'cell-text')
      .text(d => d.value);
  } else {
    // Dense mode: render count badge (chip)
    cellGroups.append('circle')
      .attr('class', 'cell-chip')
      .attr('r', 12);

    cellGroups.append('text')
      .attr('class', 'cell-count')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .text(d => d.aggregationCount || 1);
  }
}

function aggregateCellsByPosition(cells: DataCellData[]): DataCellData[] {
  const grouped = d3.group(cells, d => `${d.logicalX},${d.logicalY}`);
  return Array.from(grouped.values()).map(group => ({
    ...group[0],
    aggregationCount: group.length,
    value: `${group.length} cards`
  }));
}
```

### Pattern 4: Selection Synchronization

**What:** Sync selection state between header clicks and cell clicks via SelectionContext
**When to use:** CELL-04 requirement - selection syncs between headers and cells
**Example:**
```typescript
// Source: Inferred from Phase 91 header click patterns + SelectionContext
import { useSelection } from '@/state/SelectionContext';

function DataCellRenderer() {
  const { selectedIds, toggleSelection, selectRange } = useSelection();

  function renderCells(cells: DataCellData[]) {
    const cellGroups = container
      .selectAll('.data-cell')
      .data(cells, d => d.id)
      .join('g')
        .attr('class', 'data-cell')
        .classed('selected', d => selectedIds.has(d.node.id))
        .on('click', (event, d) => {
          event.stopPropagation();
          if (event.shiftKey) {
            selectRange(d.node.id); // Select range from last to current
          } else if (event.metaKey || event.ctrlKey) {
            toggleSelection(d.node.id); // Add/remove from selection
          } else {
            toggleSelection(d.node.id, true); // Replace selection
          }
        });

    // Update visual selection state
    cellGroups.select('.cell-bg')
      .attr('stroke', d => selectedIds.has(d.node.id) ? '#3b82f6' : '#e5e7eb')
      .attr('stroke-width', d => selectedIds.has(d.node.id) ? 2 : 1)
      .attr('fill', d => selectedIds.has(d.node.id) ? '#dbeafe' : '#ffffff');
  }
}

// Header click selects all cells in that column/row
function onHeaderClick(header: HeaderNode) {
  const cellsInHeader = findCellsForHeader(header);
  const cellIds = cellsInHeader.map(c => c.node.id);
  setSelection(new Set(cellIds));
}
```

### Pattern 5: Viewport-Based Cell Data Query

**What:** Query only visible cells based on scroll position to optimize rendering
**When to use:** Performance optimization for large grids (>1000 cells)
**Example:**
```typescript
// Source: Derived from coordinate-system.ts calculateLogicalBounds + sql.js patterns
function queryVisibleCells(
  db: Database,
  scrollTop: number,
  scrollLeft: number,
  viewportWidth: number,
  viewportHeight: number,
  coordinateSystem: D3CoordinateSystem,
  projection: PAFVProjection
): DataCellData[] {
  // Calculate logical bounds for visible area
  const bounds = calculateLogicalBounds(coordinateSystem, {
    left: scrollLeft,
    top: scrollTop,
    right: scrollLeft + viewportWidth,
    bottom: scrollTop + viewportHeight
  });

  // Build SQL query for visible cells only
  const xFacet = projection.xAxis?.facet || 'folder';
  const yFacet = projection.yAxis?.facet || 'status';

  const results = db.exec(`
    SELECT
      n.id,
      n.${xFacet} as x_value,
      n.${yFacet} as y_value,
      n.name,
      n.*
    FROM nodes n
    WHERE n.deleted_at IS NULL
      AND n.${xFacet} IS NOT NULL
      AND n.${yFacet} IS NOT NULL
    -- Add bounds filtering here after mapping values to indices
    ORDER BY n.${xFacet}, n.${yFacet}
  `);

  // Transform to DataCellData with logical coordinates
  return results[0]?.values.map((row, idx) => ({
    id: row[0] as string,
    node: rowToNode(row),
    logicalX: mapValueToIndex(row[1], projection.xAxis),
    logicalY: mapValueToIndex(row[2], projection.yAxis),
    value: row[3] as string
  })) || [];
}
```

### Anti-Patterns to Avoid

- **Using D3 transforms for pan:** CSS scroll is the single source of truth (SCROLL-05). D3 zoom is scale-only.
- **Multiple scroll containers:** Only the main grid container should have `overflow: auto`. Headers and data grid should NOT scroll independently.
- **Center-origin zoom:** Must use `transformOrigin: '0 0'` for upper-left anchor (SCROLL-04).
- **Rendering all cells:** Query and render only visible cells based on viewport bounds for large datasets.
- **Manual header alignment:** CSS Grid + sticky positioning automatically align headers with data columns/rows.
- **Ignoring density state:** Cell rendering must switch modes based on JanusDensityState (CELL-03 requirement).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sticky header positioning | Custom scroll sync with D3 transforms | CSS `position: sticky` | Browser-native, faster, no competing systems (SCROLL-05) |
| Logical ↔ screen mapping | Manual pixel calculations | Existing `createCoordinateSystem()` | Handles header offsets, scale, bipolar patterns |
| Density-based aggregation | Custom cell grouping logic | D3 `d3.group()` + existing RenderModes | Battle-tested, handles edge cases |
| Selection state management | Local React state | SelectionContext | Syncs across headers, cells, and other views |
| Viewport bounds calculation | Manual scroll position math | `calculateLogicalBounds()` | Accounts for coordinate system transforms |
| Scroll performance | Custom virtualization | CSS `will-change: transform` + query filtering | Browser-optimized, simpler than virtual scroll |

**Key insight:** The codebase already has primitives for all four requirements (CELL-01 through CELL-04). Phase 92 is about wiring them together, not building from scratch. CSS sticky positioning eliminates the need for complex scroll synchronization logic that plagued earlier grid implementations.

## Common Pitfalls

### Pitfall 1: Competing Scroll/Pan Systems

**What goes wrong:** D3 zoom pan and CSS scroll both try to control viewport position, causing jitter, lag, or incorrect header alignment.

**Why it happens:** Default D3 zoom includes both scale and translate. Enabling both creates competing pan systems.

**How to avoid:** Configure D3 zoom with `translateExtent([[0, 0], [0, 0]])` to lock translate to (0,0). Only allow wheel events for zoom. Pan is CSS scroll only. This is the SCROLL-05 architecture.

**Warning signs:** Headers drift out of alignment with columns during scroll. Diagonal scroll feels laggy or jumpy.

### Pitfall 2: Forgetting Header Offsets in Coordinate System

**What goes wrong:** Data cells render overlapping headers instead of starting after them.

**Why it happens:** Coordinate system origin defaults to (0,0), but headers occupy space at top and left.

**How to avoid:** Always configure coordinate system with `headerOffsetX` (row header width) and `headerOffsetY` (column header height). Anchor pattern should start data grid at (offsetX, offsetY), not (0, 0).

**Warning signs:** First data cell is hidden under headers. Scrolling right reveals cells in wrong columns.

### Pitfall 3: Rendering All Cells Without Viewport Filtering

**What goes wrong:** Grid with 10K cards renders all cells, causing lag and memory issues.

**Why it happens:** SQL query returns all cards, D3 binds all to DOM, browser struggles to render 10K SVG elements.

**How to avoid:** Use `calculateLogicalBounds()` to determine visible cell range, query only those cells from SQLite, render only visible cells with D3 .join(). Add `will-change: transform` for zoom performance.

**Warning signs:** Initial render takes >1 second. Scroll frame rate drops below 30fps. Browser DevTools shows 10K+ DOM nodes.

### Pitfall 4: Ignoring Density State for Cell Rendering

**What goes wrong:** Grid always shows individual cards even when density slider is set to "collapsed". Count badges never appear.

**Why it happens:** Render function doesn't check `JanusDensityState.valueDensity` before choosing rendering mode.

**How to avoid:** Always check density state in render function. If `valueDensity === 'collapsed'`, aggregate cells at same (x,y) position and render count badge. If `valueDensity === 'leaf'`, render individual card text.

**Warning signs:** Density controls don't affect grid appearance. CELL-03 acceptance tests fail.

### Pitfall 5: Selection State Out of Sync

**What goes wrong:** Clicking a header selects it visually, but cells don't show selection. Or clicking cell selects it, but header stays unselected.

**Why it happens:** Header click handler and cell click handler write to different state (local vs context), or forget to update visual selection classes.

**How to avoid:** Both header and cell click handlers must call SelectionContext methods. After state update, re-render both headers and cells with `.classed('selected', d => selectedIds.has(d.id))`.

**Warning signs:** CELL-04 acceptance test fails. Selection appears inconsistent across grid. Shift-click range select doesn't work.

## Code Examples

Verified patterns from official sources and existing codebase:

### CSS Sticky Header Grid Layout

```tsx
// Source: SuperGridScroll.test.tsx pattern (existing tests)
function SuperGridScrollContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="supergrid" style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr', // Row headers | Data grid
      gridTemplateRows: 'auto 1fr',    // Column headers | Data grid
      overflow: 'auto',                // Single scroll container (SCROLL-05)
      width: '100%',
      height: '100%',
      position: 'relative',
    }}>
      {/* Corner cell */}
      <div className="supergrid__corner" style={{
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 3,
        background: '#f5f5f5',
      }}>
        {/* Filter controls, etc. */}
      </div>

      {/* Column headers - sticky at top */}
      <div className="supergrid__column-headers" style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: '#f5f5f5',
      }}>
        <svg id="column-headers-svg" width="100%" height="40" />
      </div>

      {/* Row headers - sticky at left */}
      <div className="supergrid__row-headers" style={{
        position: 'sticky',
        left: 0,
        zIndex: 1,
        gridRow: 2,
        background: '#f5f5f5',
      }}>
        <svg id="row-headers-svg" width="150" height="100%" />
      </div>

      {/* Data grid - scrollable content */}
      <div className="supergrid__data-grid" style={{
        gridRow: 2,
        gridColumn: 2,
        transformOrigin: '0 0', // Upper-left anchor (SCROLL-04)
      }}>
        <svg id="data-cells-svg" width="100%" height="100%" />
      </div>
    </div>
  );
}
```

### D3 Data Cell Rendering with Density Modes

```typescript
// Source: GridBlock4_DataCells.tsx + RenderModes.ts patterns
function renderDataCells(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  cells: DataCellData[],
  coordinateSystem: D3CoordinateSystem,
  densityState: JanusDensityState,
  selectedIds: Set<string>,
  onCellClick: (node: Node) => void
) {
  const { cellWidth, cellHeight } = coordinateSystem;

  // Aggregate cells if in collapsed (dense) mode
  const displayCells = densityState.valueDensity === 'collapsed'
    ? aggregateCellsByPosition(cells)
    : cells;

  // D3 data binding with key function
  const cellGroups = container
    .selectAll<SVGGElement, DataCellData>('.data-cell')
    .data(displayCells, d => d.id)
    .join(
      enter => {
        const group = enter.append('g')
          .attr('class', 'data-cell')
          .attr('data-node-id', d => d.node.id)
          .style('cursor', 'pointer');

        if (densityState.valueDensity === 'leaf') {
          // Sparse mode: individual card
          group.append('rect')
            .attr('class', 'cell-bg')
            .attr('fill', '#ffffff')
            .attr('stroke', '#e5e7eb')
            .attr('rx', 2);

          group.append('text')
            .attr('class', 'cell-text')
            .attr('font-size', '11px')
            .attr('fill', '#1f2937');
        } else {
          // Dense mode: count chip
          group.append('circle')
            .attr('class', 'cell-chip')
            .attr('r', 12)
            .attr('fill', '#e0e7ff')
            .attr('stroke', '#6366f1');

          group.append('text')
            .attr('class', 'cell-count')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', '#4338ca');
        }

        return group;
      },
      update => update,
      exit => exit.remove()
    );

  // Position all cells
  cellGroups.each(function(d) {
    const group = d3.select(this);
    const { x, y } = coordinateSystem.logicalToScreen(d.logicalX, d.logicalY);

    if (densityState.valueDensity === 'leaf') {
      // Position rectangle
      group.select('.cell-bg')
        .attr('x', x)
        .attr('y', y)
        .attr('width', cellWidth - 2)
        .attr('height', cellHeight - 2)
        .attr('stroke', selectedIds.has(d.node.id) ? '#3b82f6' : '#e5e7eb')
        .attr('stroke-width', selectedIds.has(d.node.id) ? 2 : 1);

      group.select('.cell-text')
        .attr('x', x + 6)
        .attr('y', y + 6)
        .text(d.value);
    } else {
      // Position chip at center of cell
      group.select('.cell-chip')
        .attr('cx', x + cellWidth / 2)
        .attr('cy', y + cellHeight / 2)
        .attr('stroke', selectedIds.has(d.node.id) ? '#3b82f6' : '#6366f1');

      group.select('.cell-count')
        .attr('x', x + cellWidth / 2)
        .attr('y', y + cellHeight / 2)
        .text(d.aggregationCount || 1);
    }
  });

  // Click handler
  cellGroups.on('click', (event, d) => {
    event.stopPropagation();
    onCellClick(d.node);
  });
}

function aggregateCellsByPosition(cells: DataCellData[]): DataCellData[] {
  const grouped = d3.group(cells, d => `${d.logicalX},${d.logicalY}`);
  return Array.from(grouped.values()).map(group => ({
    ...group[0],
    id: `agg-${group[0].logicalX}-${group[0].logicalY}`,
    aggregationCount: group.length,
    value: `${group.length} cards`
  }));
}
```

### Scroll-Based Viewport Querying

```typescript
// Source: calculateLogicalBounds from coordinate-system.ts + sql.js query patterns
function useVisibleCells(
  db: Database | null,
  projection: PAFVProjection | null,
  coordinateSystem: D3CoordinateSystem
) {
  const [visibleCells, setVisibleCells] = useState<DataCellData[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!db || !projection || !scrollContainerRef.current) return;

    function updateVisibleCells() {
      const container = scrollContainerRef.current!;
      const bounds = calculateLogicalBounds(coordinateSystem, {
        left: container.scrollLeft,
        top: container.scrollTop,
        right: container.scrollLeft + container.clientWidth,
        bottom: container.scrollTop + container.clientHeight
      });

      // Query cells in visible bounds (with buffer for smooth scrolling)
      const buffer = 2; // Render 2 cells outside viewport
      const cells = queryCellsInBounds(db, projection, {
        minX: bounds.minX - buffer,
        maxX: bounds.maxX + buffer,
        minY: bounds.minY - buffer,
        maxY: bounds.maxY + buffer
      });

      setVisibleCells(cells);
    }

    // Initial query
    updateVisibleCells();

    // Update on scroll with debounce
    const handleScroll = debounce(updateVisibleCells, 100);
    scrollContainerRef.current.addEventListener('scroll', handleScroll);

    return () => {
      scrollContainerRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [db, projection, coordinateSystem]);

  return { visibleCells, scrollContainerRef };
}
```

### Selection Synchronization

```typescript
// Source: SelectionContext patterns + Phase 91 header click handlers
import { useSelection } from '@/state/SelectionContext';

function DataCellRenderer({
  cells,
  coordinateSystem,
  densityState,
  onCellClick
}: DataCellRendererProps) {
  const { selectedIds, toggleSelection } = useSelection();

  useEffect(() => {
    renderCells();
  }, [cells, selectedIds, densityState]);

  function renderCells() {
    const cellGroups = container
      .selectAll('.data-cell')
      .data(cells, d => d.id)
      .join('g')
        .attr('class', 'data-cell')
        .classed('selected', d => selectedIds.has(d.node.id))
        .on('click', (event, d) => {
          event.stopPropagation();
          toggleSelection(d.node.id, !event.metaKey && !event.ctrlKey);
        });

    // Update selection visual state
    cellGroups.select('.cell-bg')
      .attr('stroke', d => selectedIds.has(d.node.id) ? '#3b82f6' : '#e5e7eb')
      .attr('stroke-width', d => selectedIds.has(d.node.id) ? 2 : 1)
      .attr('fill', d => selectedIds.has(d.node.id) ? '#dbeafe' : '#ffffff');
  }
}

// Header click selects all cells in that column/row
function onHeaderClick(header: HeaderNode, axis: 'x' | 'y') {
  const cellsInHeader = cells.filter(cell =>
    axis === 'x' ? cell.logicalX === header.index : cell.logicalY === header.index
  );
  const cellIds = cellsInHeader.map(c => c.node.id);
  setSelection(new Set(cellIds));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3 pan + custom scroll sync | CSS scroll only, D3 scale-only zoom | Phase 66 (2026) | Eliminates competing systems (SCROLL-05) |
| Render all cells | Viewport-based filtering | Current best practice | Performance: 10K cells → <1000 rendered |
| Manual header alignment | CSS Grid + sticky positioning | Phase 92 (2026) | Browser-native, no manual sync needed |
| Custom density rendering | D3 `d3.group()` + mode switching | Phase 92 (2026) | Declarative aggregation, easier to test |
| Local selection state | SelectionContext | Phase 91 (2026) | Cross-component selection sync |

**Deprecated/outdated:**
- D3 zoom with translate enabled: Now scale-only (SCROLL-05)
- Custom scroll position sync between headers and data: CSS sticky handles this
- Separate scroll containers for headers and data: Single container only

## Open Questions

1. **Virtual scrolling threshold**
   - What we know: Performance target is 30fps for >1000 cells (PERF-01)
   - What's unclear: At what cell count does viewport filtering become mandatory?
   - Recommendation: Start with viewport filtering always enabled (it's simpler than toggling). Profile with 10K cells to verify <100ms render time.

2. **Density transition animation**
   - What we know: UX-02 requires smooth collapse/expand transitions
   - What's unclear: Should density mode switching (leaf ↔ collapsed) animate or instant swap?
   - Recommendation: Instant swap for now (simpler), add D3 transition in Phase 93 polish if time allows.

3. **Aggregation count display format**
   - What we know: Dense mode shows count badges (chips)
   - What's unclear: Should it be "5" or "5 cards" or just a dot with size?
   - Recommendation: Show numeric count only (e.g., "5"). Size is redundant with count. Hover tooltip can show "5 cards" detail.

4. **Selection behavior for aggregated cells**
   - What we know: Dense mode aggregates multiple cards into one chip
   - What's unclear: Clicking aggregated chip - select all cards or expand to leaf?
   - Recommendation: Select all cards in that position. Separate expand/collapse control (Phase 91 behavior) to drill into detail.

5. **Scroll performance optimization strategy**
   - What we know: `will-change: transform` helps zoom performance
   - What's unclear: Should we use CSS transforms for cell positioning or SVG attributes?
   - Recommendation: SVG attributes (`x`, `y`, `width`, `height`) for correctness. Add `will-change` to container. If profiling shows <30fps, switch to CSS transforms in Phase 93.

## Sources

### Primary (HIGH confidence)
- Existing Codebase:
  - `src/components/GridBlock4_DataCells.tsx` - D3 data cell rendering pattern
  - `src/components/supergrid/__tests__/SuperGridScroll.test.tsx` - CSS sticky header architecture (SCROLL-01 through SCROLL-05)
  - `src/utils/coordinate-system/coordinate-system.ts` - Logical ↔ screen position mapping
  - `src/d3/SuperDensityRenderer/RenderModes.ts` - Density-based rendering modes
  - `src/types/grid.ts` - DataCellData, D3CoordinateSystem, HeaderNode types
  - `src/types/density-control.ts` - JanusDensityState type definitions
  - `src/state/SelectionContext.tsx` - Selection state management
  - `src/d3/SuperGridZoom.ts` - Scale-only zoom with CSS scroll pan (SCROLL-05)
- `.planning/REQUIREMENTS.md` - CELL-01 through CELL-04 requirements
- `specs/SuperGrid-Specification.md` - SuperDensitySparsity feature spec (Section 2.5)

### Secondary (MEDIUM confidence)
- [GitHub - PMSI-AlignAlytics/scrollgrid](https://github.com/PMSI-AlignAlytics/scrollgrid) - D3-based grid with sticky headers (reference architecture)
- [Scrollable, Sortable HTML Table with Static Headers Using d3.js](http://forrestcoward.github.io/examples/scrollable-table/index.html) - Nested table approach to sticky headers
- [D3 and CSS Grid with expanding content - Medium](https://medium.com/@andybarefoot/d3-and-css-grid-with-expanding-content-3c8aaf783cb1) - CSS Grid + D3 integration patterns
- [DataTables Sticky Headers Discussion](https://datatables.net/forums/discussion/68750/sticky-headers-horizontal-scrolling-sticky-headers-dont-scroll) - Common pitfalls with sticky headers and horizontal scroll

### Tertiary (LOW confidence)
- [10 Best JavaScript Plugins For Sticky Table Header (2026 Update)](https://www.jqueryscript.net/blog/best-sticky-table-header.html) - General sticky header patterns (not D3-specific, verify with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Existing codebase has all primitives (GridBlock4, SuperGridScroll tests, coordinate-system)
- Pitfalls: HIGH - SCROLL-05 architecture documented in tests, density rendering proven in RenderModes
- Code examples: HIGH - Derived from existing codebase patterns and official CSS/D3 documentation
- Integration approach: HIGH - Phase 91 provides header foundation, Phase 92 adds cells using same patterns

**Research date:** 2026-02-14
**Valid until:** 60 days (stable domain - CSS sticky, D3 v7 data join, and coordinate system unlikely to change)

**Key uncertainties:**
- Virtual scrolling threshold: Needs performance profiling with real data
- Density transition animation: Product decision (instant vs animated)
- Aggregated cell click behavior: UX decision (select all vs expand)

**Next steps for planner:**
1. Review existing patterns: GridBlock4_DataCells (rendering), SuperGridScroll tests (layout), coordinate-system (positioning)
2. Create `DataCellRenderer` service that composes these patterns
3. Wire density state from JanusDensityControls → cell rendering mode
4. Connect SelectionContext to both header and cell click handlers
5. Add viewport-based cell querying for performance
6. Test CELL-01 through CELL-04 requirements with acceptance criteria
