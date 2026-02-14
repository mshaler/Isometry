# SuperGrid GSD Implementation Plan

**Date:** February 12, 2026  
**Type:** GSD Executor Handoff Document  
**Target:** Claude Code  
**Scope:** Phase A — Core Grid MVP  

---

## Executive Summary

This document provides implementation guidance for the four critical MVP gaps identified in the gap analysis. It follows the GSD Executor pattern: comprehensive specs, algorithmic guidance, exact file locations, and verification gates.

**Pre-requisites for Claude Code:**
1. Read `specs/SuperGrid-Specification.md` — the authoritative feature spec
2. Read this document — the implementation guidance
3. Have the gap analysis context — what's done vs. what's missing

**Phase A Goal:** Get from 30% MVP readiness to 70% by implementing the four critical features that block everything else.

---

## Reference Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  React Chrome (FilterNav, density sliders, axis pickers)        │
│  Files: src/components/supergrid/*.tsx                          │
├─────────────────────────────────────────────────────────────────┤
│  SuperGridEngine (D3.js rendering + interaction)                │
│  Files: src/d3/SuperGridEngine/*.ts                             │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ index.ts    │ DataManager │ HeaderMgr   │ Renderer    │     │
│  │ (API)       │ (SQL→cells) │ (hierarchy) │ (D3 SVG)    │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│  sql.js (SQLite in WASM)                                        │
│  Files: src/db/*.ts                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task 1: SuperStack Multi-Level Headers

**Priority:** P0 — Critical path, blocks all other features  
**Estimated Effort:** 1-2 days  
**Files to Modify:**
- `src/d3/SuperGridEngine/HeaderManager.ts` (primary)
- `src/d3/SuperGridEngine/Renderer.ts` (header rendering)
- `src/d3/SuperGridEngine/types.ts` (may need type additions)

### 1.1 Problem Statement

Currently `HeaderManager.generateHeaderTree()` returns flat, single-level headers:

```typescript
// CURRENT (broken)
generateHeaderTree(): HeaderTree {
  return {
    columns,
    rows,
    maxColumnLevels: 1,  // ← HARDCODED
    maxRowLevels: 1      // ← HARDCODED
  };
}
```

The spec requires nested headers with visual spanning:

```
┌────────┬────────┬────────┐
│   Q1   │  Jan   │ Week 1 │  ← 3 levels deep
│        │        │ Week 2 │
│        │  Feb   │ Week 1 │
└────────┴────────┴────────┘
```

### 1.2 Algorithm: Build Hierarchy Tree

**Input:** Array of cells with PAFV coordinates (e.g., `{ yValues: ['Q1', 'Jan', 'Week 1'] }`)

**Output:** Nested header tree with span calculations

```typescript
interface HeaderNode {
  value: string;           // "Q1", "Jan", "Week 1"
  level: number;           // 0, 1, 2
  span: number;            // How many leaf cells this header spans
  children: HeaderNode[];  // Nested children
  startIndex: number;      // First leaf cell index
  endIndex: number;        // Last leaf cell index
  isCollapsed: boolean;    // Progressive disclosure state
}

function buildHeaderHierarchy(
  cells: CellDescriptor[],
  axisValues: string[][]  // e.g., [['Q1','Jan','Week1'], ['Q1','Jan','Week2'], ...]
): HeaderNode[] {
  // Step 1: Group by first level
  const groups = new Map<string, { cells: CellDescriptor[], subValues: string[][] }>();
  
  for (let i = 0; i < axisValues.length; i++) {
    const [first, ...rest] = axisValues[i];
    if (!groups.has(first)) {
      groups.set(first, { cells: [], subValues: [] });
    }
    groups.get(first)!.cells.push(cells[i]);
    groups.get(first)!.subValues.push(rest);
  }
  
  // Step 2: Recursively build children
  const result: HeaderNode[] = [];
  let currentIndex = 0;
  
  for (const [value, { cells, subValues }] of groups) {
    const startIndex = currentIndex;
    
    // Recurse if there are more levels
    const children = subValues[0]?.length > 0
      ? buildHeaderHierarchy(cells, subValues)
      : [];
    
    const span = children.length > 0
      ? children.reduce((sum, child) => sum + child.span, 0)
      : cells.length;
    
    result.push({
      value,
      level: 0,  // Will be adjusted by caller
      span,
      children,
      startIndex,
      endIndex: startIndex + span - 1,
      isCollapsed: false
    });
    
    currentIndex += span;
  }
  
  return result;
}
```

### 1.3 Algorithm: Calculate Visual Spans

Each header's visual width/height is determined by its span:

```typescript
function calculateHeaderDimensions(
  headers: HeaderNode[],
  cellSize: number,        // Base cell width/height
  headerDepth: number,     // How many levels deep
  orientation: 'column' | 'row'
): HeaderDescriptor[] {
  const descriptors: HeaderDescriptor[] = [];
  
  function traverse(node: HeaderNode, level: number, offset: number) {
    const size = node.span * cellSize;
    const position = offset;
    
    descriptors.push({
      id: `header-${level}-${node.value}`,
      value: node.value,
      level,
      span: node.span,
      // For columns: x = position, width = size
      // For rows: y = position, height = size
      ...(orientation === 'column' 
        ? { gridX: position, width: size }
        : { gridY: position, height: size }
      ),
      childCount: node.children.length,
      isLeaf: node.children.length === 0,
      isCollapsed: node.isCollapsed
    });
    
    // Recurse into children
    let childOffset = offset;
    for (const child of node.children) {
      traverse(child, level + 1, childOffset);
      childOffset += child.span * cellSize;
    }
  }
  
  let offset = 0;
  for (const header of headers) {
    traverse(header, 0, offset);
    offset += header.span * cellSize;
  }
  
  return descriptors;
}
```

### 1.4 Rendering: SVG Header Groups

In `Renderer.ts`, render headers as nested SVG groups:

```typescript
function renderHeaders(
  svg: d3.Selection<SVGGElement, unknown, null, undefined>,
  headers: HeaderDescriptor[],
  config: { headerHeight: number, orientation: 'column' | 'row' }
) {
  const headerGroup = svg.selectAll('.header-group')
    .data(headers, d => d.id)
    .join(
      enter => {
        const g = enter.append('g')
          .attr('class', d => `header-group header-level-${d.level}`)
          .attr('transform', d => {
            if (config.orientation === 'column') {
              // Column headers: stack vertically by level, spread horizontally by position
              return `translate(${d.gridX}, ${d.level * config.headerHeight})`;
            } else {
              // Row headers: stack horizontally by level, spread vertically by position
              return `translate(${d.level * config.headerHeight}, ${d.gridY})`;
            }
          });
        
        // Background rect for click target
        g.append('rect')
          .attr('class', 'header-bg')
          .attr('width', d => config.orientation === 'column' ? d.width : config.headerHeight)
          .attr('height', d => config.orientation === 'column' ? config.headerHeight : d.height)
          .attr('fill', d => d.level === 0 ? '#e0e0e0' : '#f0f0f0')
          .attr('stroke', '#ccc');
        
        // Label text
        g.append('text')
          .attr('class', 'header-label')
          .attr('x', d => (config.orientation === 'column' ? d.width : config.headerHeight) / 2)
          .attr('y', d => (config.orientation === 'column' ? config.headerHeight : d.height) / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(d => d.value);
        
        return g;
      },
      update => update
        .attr('transform', d => {
          if (config.orientation === 'column') {
            return `translate(${d.gridX}, ${d.level * config.headerHeight})`;
          } else {
            return `translate(${d.level * config.headerHeight}, ${d.gridY})`;
          }
        }),
      exit => exit.remove()
    );
}
```

### 1.5 Verification Gates

| Test | Command | Pass Criteria |
|------|---------|---------------|
| Unit: buildHeaderHierarchy | `npm run test -- HeaderManager` | Returns correct tree structure for 3-level input |
| Unit: calculateHeaderDimensions | `npm run test -- HeaderManager` | Spans sum to total cell count |
| Visual: 2-level render | Manual inspection in dev | Q1 header visually spans Jan+Feb+Mar |
| Visual: 3-level render | Manual inspection in dev | Year → Quarter → Month all span correctly |
| Integration: click parent header | Click Q1 | All Q1 children selected |

### 1.6 Commit Sequence

```bash
# Commit 1: Types and algorithm
feat(supergrid): add multi-level header tree building algorithm

# Commit 2: Rendering
feat(supergrid): render nested headers with visual spanning

# Commit 3: Interaction
feat(supergrid): wire header click to select children
```

---

## Task 2: SuperDensity — Value & Extent Controls

**Priority:** P0 — Core differentiator  
**Estimated Effort:** 1 day  
**Files to Modify:**
- `src/d3/SuperGridEngine/DataManager.ts` (SQL generation)
- `src/d3/SuperGridEngine/HeaderManager.ts` (level analysis)
- `src/components/supergrid/DensityControls.tsx` (NEW FILE)
- `src/components/supergrid/SuperGrid.tsx` (wire up controls)

### 2.1 Problem Statement

The Janus density model has two orthogonal controls:
- **Value Density (Zoom):** Collapse leaf values into parents (Jan,Feb,Mar → Q1)
- **Extent Density (Pan):** Hide/show empty cells

Currently: Types exist (`JanusDensityState`), no implementation.

### 2.2 Algorithm: Value Density (GROUP BY Generation)

Value density maps to SQL GROUP BY. Higher density = fewer rows, more aggregation.

```typescript
interface DensityLevel {
  level: number;           // 0 = leaf, 1 = parent, 2 = grandparent, etc.
  groupByColumns: string[]; // SQL columns to GROUP BY
  aggregations: string[];   // SUM, COUNT, AVG for numeric columns
}

function generateDensityQuery(
  baseQuery: string,
  densityLevel: number,
  axisHierarchy: string[]  // e.g., ['year', 'quarter', 'month', 'week']
): string {
  if (densityLevel === 0) {
    // Leaf level — no aggregation
    return baseQuery;
  }
  
  // Determine which columns to group by
  const groupByColumns = axisHierarchy.slice(0, -densityLevel);
  
  // Columns to aggregate (numeric ones)
  const aggregateColumns = ['priority', 'importance']; // Example
  
  const selectClauses = [
    ...groupByColumns,
    `COUNT(*) as _count`,
    ...aggregateColumns.map(col => `AVG(${col}) as ${col}`)
  ];
  
  return `
    SELECT ${selectClauses.join(', ')}
    FROM (${baseQuery}) AS base
    GROUP BY ${groupByColumns.join(', ')}
    ORDER BY ${groupByColumns.join(', ')}
  `;
}
```

**Example:**

```sql
-- Density level 0 (leaf): Show individual weeks
SELECT * FROM nodes WHERE folder = 'Work'

-- Density level 1: Collapse to months
SELECT year, quarter, month, COUNT(*) as _count, AVG(priority) as priority
FROM nodes WHERE folder = 'Work'
GROUP BY year, quarter, month

-- Density level 2: Collapse to quarters  
SELECT year, quarter, COUNT(*) as _count, AVG(priority) as priority
FROM nodes WHERE folder = 'Work'
GROUP BY year, quarter
```

### 2.3 Algorithm: Extent Density (Empty Cell Filtering)

Extent density controls whether empty intersections are shown:

```typescript
type ExtentMode = 'dense' | 'sparse' | 'ultra-sparse';

function filterEmptyCells(
  cells: CellDescriptor[],
  mode: ExtentMode
): CellDescriptor[] {
  switch (mode) {
    case 'dense':
      // Only show cells with data
      return cells.filter(cell => cell.nodeCount > 0);
    
    case 'sparse':
      // Show cells with data + immediate neighbors
      const populatedCoords = new Set(
        cells.filter(c => c.nodeCount > 0).map(c => `${c.gridX},${c.gridY}`)
      );
      return cells.filter(cell => {
        if (cell.nodeCount > 0) return true;
        // Check if any neighbor is populated
        const neighbors = [
          `${cell.gridX-1},${cell.gridY}`,
          `${cell.gridX+1},${cell.gridY}`,
          `${cell.gridX},${cell.gridY-1}`,
          `${cell.gridX},${cell.gridY+1}`
        ];
        return neighbors.some(n => populatedCoords.has(n));
      });
    
    case 'ultra-sparse':
      // Full Cartesian product — show all intersections
      return cells;
  }
}
```

### 2.4 React Control Component

Create `src/components/supergrid/DensityControls.tsx`:

```tsx
import { useState } from 'react';
import { Slider } from '@/components/ui/slider';

interface DensityControlsProps {
  maxValueLevel: number;  // How many hierarchy levels exist
  onValueDensityChange: (level: number) => void;
  onExtentDensityChange: (mode: 'dense' | 'sparse' | 'ultra-sparse') => void;
}

export function DensityControls({
  maxValueLevel,
  onValueDensityChange,
  onExtentDensityChange
}: DensityControlsProps) {
  const [valueLevel, setValueLevel] = useState(0);
  const [extentMode, setExtentMode] = useState<'dense' | 'sparse' | 'ultra-sparse'>('dense');
  
  return (
    <div className="density-controls flex gap-4 p-2 border-b">
      {/* Value Density (Zoom) */}
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">
          Value Density (Zoom)
        </label>
        <Slider
          value={[valueLevel]}
          min={0}
          max={maxValueLevel}
          step={1}
          onValueChange={([v]) => {
            setValueLevel(v);
            onValueDensityChange(v);
          }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Detail</span>
          <span>Summary</span>
        </div>
      </div>
      
      {/* Extent Density (Pan) */}
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">
          Extent Density (Pan)
        </label>
        <div className="flex gap-1">
          {(['dense', 'sparse', 'ultra-sparse'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setExtentMode(mode);
                onExtentDensityChange(mode);
              }}
              className={`px-2 py-1 text-xs rounded ${
                extentMode === mode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {mode === 'dense' ? 'Dense' : mode === 'sparse' ? 'Sparse' : 'Full'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 2.5 Verification Gates

| Test | Command | Pass Criteria |
|------|---------|---------------|
| Unit: generateDensityQuery | `npm run test -- DataManager` | Level 1 query has correct GROUP BY |
| Unit: filterEmptyCells dense | `npm run test -- DataManager` | Only populated cells returned |
| Visual: Value slider | Slide to level 1 | Grid collapses from weeks to months |
| Visual: Extent toggle | Click "Dense" | Empty cells disappear |
| Integration: Both controls | Value=1, Extent=dense | Collapsed AND filtered |

### 2.6 Commit Sequence

```bash
# Commit 1: Value density SQL generation
feat(supergrid): implement value density GROUP BY generation

# Commit 2: Extent density filtering
feat(supergrid): implement extent density cell filtering

# Commit 3: React controls
feat(supergrid): add DensityControls component with sliders
```

---

## Task 3: SuperZoom — Upper-Left Anchor

**Priority:** P1 — UX critical, quick win  
**Estimated Effort:** 2-4 hours  
**Files to Modify:**
- `src/d3/SuperGridEngine/Renderer.ts` (zoom behavior)

### 3.1 Problem Statement

D3's default zoom behavior centers on the cursor position. The spec requires pinning to the upper-left corner (like a spreadsheet).

### 3.2 Algorithm: Pinned Zoom Transform

```typescript
function setupZoomBehavior(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  bounds: { width: number; height: number }
) {
  let currentTransform = d3.zoomIdentity;
  
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 5])
    .on('zoom', (event) => {
      const { transform } = event;
      
      // Calculate the delta scale
      const scaleDelta = transform.k / currentTransform.k;
      
      if (scaleDelta !== 1) {
        // ZOOM: Pin to upper-left corner (0,0)
        // Instead of using cursor position, always scale from origin
        const newX = currentTransform.x * scaleDelta;
        const newY = currentTransform.y * scaleDelta;
        
        currentTransform = d3.zoomIdentity
          .translate(newX, newY)
          .scale(transform.k);
      } else {
        // PAN: Apply translation directly
        currentTransform = transform;
      }
      
      // Enforce boundaries
      currentTransform = constrainToBounds(currentTransform, bounds, transform.k);
      
      mainGroup.attr('transform', currentTransform.toString());
    });
  
  svg.call(zoom);
  
  return zoom;
}

function constrainToBounds(
  transform: d3.ZoomTransform,
  bounds: { width: number; height: number },
  scale: number
): d3.ZoomTransform {
  const scaledWidth = bounds.width * scale;
  const scaledHeight = bounds.height * scale;
  
  // Can't pan past left/top edge
  const x = Math.min(0, Math.max(transform.x, -(scaledWidth - bounds.width)));
  const y = Math.min(0, Math.max(transform.y, -(scaledHeight - bounds.height)));
  
  return d3.zoomIdentity.translate(x, y).scale(scale);
}
```

### 3.3 Verification Gates

| Test | Action | Pass Criteria |
|------|--------|---------------|
| Zoom in | Scroll wheel up | Upper-left cell stays pinned, grid expands down-right |
| Zoom out | Scroll wheel down | Upper-left cell stays pinned, grid contracts |
| Pan right | Drag right | Grid moves, can't pan past left edge |
| Pan down | Drag down | Grid moves, can't pan past top edge |
| Combined | Zoom then pan | Both behaviors work correctly |

### 3.4 Commit

```bash
feat(supergrid): pin zoom to upper-left corner with boundary constraints
```

---

## Task 4: Header Click Zones

**Priority:** P0 — Required for header interaction  
**Estimated Effort:** 1 day  
**Files to Modify:**
- `src/d3/SuperGridEngine/Renderer.ts` (hit detection)
- `src/d3/SuperGridEngine/ClickZoneManager.ts` (NEW FILE)

### 4.1 Problem Statement

Headers have multiple interactive zones with different behaviors:
- **Parent label zone** (~32px): Structural operations (expand/collapse)
- **Child body zone**: Data selection (select all children)
- **Resize edge** (4px): Column/row resizing

Currently: Single click handler for the entire header.

### 4.2 Zone Geometry

```
┌──────────────────────────────────────┐
│  PARENT LABEL ZONE (32px)            │ ← Click: expand/collapse
├──────────────────────────────────────┤
│                                      │
│  CHILD BODY ZONE                     │ ← Click: select children
│                                      │
│                                ┃     │ ← RESIZE EDGE (4px)
└──────────────────────────────────────┘
```

### 4.3 Algorithm: Hit Test

```typescript
type ClickZone = 'parent-label' | 'child-body' | 'resize-edge' | 'data-cell';

interface HitTestResult {
  zone: ClickZone;
  header?: HeaderDescriptor;
  cell?: CellDescriptor;
}

function hitTest(
  point: { x: number; y: number },
  headers: HeaderDescriptor[],
  cells: CellDescriptor[],
  config: { labelHeight: number; resizeEdgeWidth: number }
): HitTestResult {
  // Check headers first (they're on top)
  for (const header of headers) {
    const bounds = getHeaderBounds(header);
    
    if (pointInRect(point, bounds)) {
      // Check resize edge first (highest priority)
      if (isNearRightEdge(point, bounds, config.resizeEdgeWidth)) {
        return { zone: 'resize-edge', header };
      }
      
      // Check parent label zone
      if (point.y < bounds.y + config.labelHeight && header.childCount > 0) {
        return { zone: 'parent-label', header };
      }
      
      // Must be child body zone
      return { zone: 'child-body', header };
    }
  }
  
  // Check data cells
  for (const cell of cells) {
    if (pointInRect(point, getCellBounds(cell))) {
      return { zone: 'data-cell', cell };
    }
  }
  
  return { zone: 'data-cell' }; // Default to background
}

function isNearRightEdge(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  edgeWidth: number
): boolean {
  const rightEdge = bounds.x + bounds.width;
  return point.x >= rightEdge - edgeWidth && point.x <= rightEdge;
}
```

### 4.4 Cursor State Machine

```typescript
const ZONE_CURSORS: Record<ClickZone, string> = {
  'parent-label': 'pointer',
  'child-body': 'cell',
  'resize-edge': 'col-resize',
  'data-cell': 'default'
};

function updateCursor(zone: ClickZone, svg: SVGSVGElement) {
  svg.style.cursor = ZONE_CURSORS[zone];
}
```

### 4.5 Click Handlers by Zone

```typescript
function handleClick(result: HitTestResult, engine: SuperGridEngine) {
  switch (result.zone) {
    case 'parent-label':
      // Toggle expand/collapse
      engine.toggleHeaderCollapsed(result.header!.id);
      break;
    
    case 'child-body':
      // Select all descendant cells
      engine.selectHeaderChildren(result.header!.id);
      break;
    
    case 'resize-edge':
      // Handled by drag, not click
      break;
    
    case 'data-cell':
      if (result.cell) {
        engine.selectCells([result.cell.id]);
      }
      break;
  }
}
```

### 4.6 Verification Gates

| Test | Action | Pass Criteria |
|------|--------|---------------|
| Cursor: parent zone | Hover over "Q1" label | Cursor becomes pointer |
| Cursor: child zone | Hover over "Jan" body | Cursor becomes cell |
| Cursor: resize edge | Hover near right edge | Cursor becomes col-resize |
| Click: parent label | Click "Q1" label | Q1 expands/collapses |
| Click: child body | Click "Jan" body | All Jan cells selected |
| Drag: resize edge | Drag right edge | Column resizes |

### 4.7 Commit Sequence

```bash
# Commit 1: Hit test logic
feat(supergrid): implement header click zone hit testing

# Commit 2: Cursor state
feat(supergrid): add zone-based cursor state machine

# Commit 3: Click behaviors
feat(supergrid): wire click handlers to zone-specific actions
```

---

## Phase A Completion Checklist

Before moving to Phase B, all of these must be true:

- [ ] **SuperStack:** 2-level headers render with correct visual spanning
- [ ] **SuperStack:** Click parent header selects all children
- [ ] **SuperDensity:** Value slider changes SQL GROUP BY
- [ ] **SuperDensity:** Extent toggle filters empty cells
- [ ] **SuperZoom:** Zoom pins to upper-left corner
- [ ] **SuperZoom:** Cannot pan past grid boundaries
- [ ] **Click Zones:** Cursor changes per zone
- [ ] **Click Zones:** Parent label click toggles collapse
- [ ] **Click Zones:** Child body click selects children
- [ ] **All tests pass:** `npm run test`
- [ ] **Type check passes:** `npm run typecheck`
- [ ] **Lint passes:** `npm run check`

---

## Handoff Notes for Claude Code

### What to Read First

1. `specs/SuperGrid-Specification.md` — Full feature spec with acceptance criteria
2. `src/d3/SuperGridEngine/types.ts` — Current type definitions
3. `src/d3/SuperGridEngine/HeaderManager.ts` — Where multi-level logic goes
4. `src/d3/SuperGridEngine/Renderer.ts` — Where rendering changes go

### What NOT to Do

- ❌ Don't refactor unrelated code (stay focused on these 4 tasks)
- ❌ Don't add features beyond Phase A scope
- ❌ Don't change the sql.js integration pattern
- ❌ Don't introduce new state management (D3's data join IS the state)

### What TO Do

- ✅ Follow TDD — write failing test, implement, verify
- ✅ Use D3's `.join()` pattern with key functions
- ✅ Keep files under 500 lines (split if needed)
- ✅ Commit after each logical unit (see commit sequences above)
- ✅ Run `npm run check` before each commit

### Questions to Ask (Not Assume)

If you encounter any of these, pause and ask:
- "The spec says X but the types say Y — which is correct?"
- "This algorithm has O(n²) complexity — is that acceptable for 10k cards?"
- "Should collapse state persist to SQLite or stay in memory?"

---

## Success Metrics

After Phase A, the following acceptance criteria from the spec should pass:

| Criterion | Status |
|-----------|--------|
| 2D grid renders with correct PAFV axis mapping | Already works |
| **At least 2-level SuperStack headers render with correct visual spanning** | Phase A target |
| **Density slider collapses/expands one axis level** | Phase A target |
| **Extent slider hides/shows empty intersections** | Phase A target |
| **Zoom pins upper-left corner** | Phase A target |
| **Header click zones follow the geometric rule** | Phase A target |
| Cursor changes correctly across all zone boundaries | Phase A target |

**Phase A brings MVP from 30% → 70%**

---

*Document Version: 1.0*  
*Created: February 12, 2026*  
*For: Claude Code execution*
