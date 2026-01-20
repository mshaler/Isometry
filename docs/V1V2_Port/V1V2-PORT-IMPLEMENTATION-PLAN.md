# CardBoard v1/v2 → v3 Port Implementation Plan

*Comprehensive handoff document for Claude Code*

**Created:** January 16, 2026  
**Status:** Ready for Implementation  
**Priority:** High Value Features First

---

## Executive Summary

This document provides a complete implementation plan for porting high-value features from CardBoard v1/v2 to v3. The analysis identified **10 reusable modules** across three priority tiers. V3 already has substantial implementations of SuperGrid, FilterNav, and Graph analytics—this plan focuses on **enhancing existing modules** and **filling gaps**.

### Key Repositories
- **Source (v1/v2):** `/Users/mshaler/Developer/Projects/CardBoard/`
- **Target (v3):** `/Users/mshaler/Developer/Projects/CardBoard-v3/`

### Guiding Principles
1. TDD is non-negotiable — tests before implementation
2. D3.js for visualization (no React in v3)
3. SQLite + better-sqlite3 for data layer
4. Boring stack wins — no unnecessary dependencies

---

## Current State Analysis

### What V3 Already Has ✅

| Module | Location | Status |
|--------|----------|--------|
| SuperGrid core | `src/views/supergrid/` | Functional, needs enhancement |
| Virtual scrolling | `src/views/supergrid/components/virtual-grid-2d.ts` | Complete |
| MiniNav | `src/views/supergrid/components/mini-nav.ts` | Basic implementation |
| PAFV Headers | `src/views/supergrid/components/pafv-header.ts` | Needs spanning overlays |
| FilterNav accordion | `src/filternav/` | Complete system |
| Graph centrality | `src/graph/aggregate/centrality.ts` | Complete |
| Graph clustering | `src/graph/cluster/algorithms/` | Louvain, label-prop, etc. |
| LATCH operations | `src/latch/` | Filter, sort, group complete |
| Time analytics | `src/analytics/` | Time-series, rolling window |

### What Needs To Be Ported/Enhanced 🚧

| Feature | Source | Target | Priority |
|---------|--------|--------|----------|
| Header spanning overlays | `SuperGrid.tsx` | `pafv-header.ts` | P1 |
| Shift+drag bulk resize | `SuperGrid.tsx` | `virtual-grid-2d.ts` | P1 |
| Resize undo/redo | `SuperGrid.tsx` | New: `resize-history.ts` | P1 |
| DimensionNavigator DnD | `DimensionNavigator.tsx` | New: `axis-navigator.ts` | P1 |
| SuperDensitySparsity | spec only | New: `density-control.ts` | P1 |
| Connection suggestions | `graph-service.ts` | New: `suggestions.ts` | P2 |
| Query result caching | `graph-service.ts` | New: `query-cache.ts` | P2 |
| Conflict resolution | `ConflictResolutionService.ts` | Future: sync layer | P3 |
| Offline sync queue | `OfflineSyncService.ts` | Future: sync layer | P3 |

---

## Phase 1: SuperGrid Enhancement

**Duration:** 3-5 days  
**Dependencies:** None (enhances existing module)

### Task 1.1: Header Spanning Visual Overlays

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/supergrid/src/SuperGrid.tsx` (lines 350-500)

**Target:** `src/views/supergrid/components/pafv-header.ts`

**Implementation:**

```typescript
// Add to src/views/supergrid/components/pafv-header.ts

interface HeaderSpan {
  dimIndex: number;
  startIndex: number;
  endIndex: number;
  value: string;
  spanAcrossDimensions?: boolean;
}

/**
 * Calculate header spans for visual overlays
 * This is the signature feature from v1/v2 SuperGrid
 */
export function calculateHeaderSpans(
  combinations: string[][],
  dimensions: { id: string; name: string }[]
): HeaderSpan[] {
  const spans: HeaderSpan[] = [];

  // For each dimension column, calculate basic spans
  dimensions.forEach((_, dimIndex) => {
    let currentValue: string | null = null;
    let startIndex = 0;

    combinations.forEach((combo, index) => {
      const cellValue = combo[dimIndex];
      
      // Check if any parent dimension changed
      let parentChanged = false;
      if (dimIndex > 0) {
        for (let parentDimIndex = 0; parentDimIndex < dimIndex; parentDimIndex++) {
          if (index > 0 && 
              combinations[index][parentDimIndex] !== combinations[index - 1][parentDimIndex]) {
            parentChanged = true;
            break;
          }
        }
      }
      
      if (cellValue !== currentValue || parentChanged) {
        // End previous span if exists
        if (currentValue !== null && startIndex < index) {
          spans.push({
            dimIndex,
            startIndex,
            endIndex: index - 1,
            value: currentValue,
            spanAcrossDimensions: startIndex < index - 1
          });
        }
        // Start new span
        currentValue = cellValue;
        startIndex = index;
      }
      
      // Handle last item
      if (index === combinations.length - 1 && currentValue !== null) {
        spans.push({
          dimIndex,
          startIndex,
          endIndex: index,
          value: currentValue,
          spanAcrossDimensions: startIndex < index
        });
      }
    });
  });

  return spans;
}
```

**Tests Required:**
```typescript
// tests/unit/views/supergrid/header-spans.test.ts

describe('calculateHeaderSpans', () => {
  it('should detect single-row spans', () => {
    const combinations = [['Q1', 'Jan'], ['Q1', 'Feb'], ['Q2', 'Mar']];
    const dimensions = [{ id: 'quarter', name: 'Quarter' }, { id: 'month', name: 'Month' }];
    
    const spans = calculateHeaderSpans(combinations, dimensions);
    
    // Q1 should span indices 0-1
    expect(spans.find(s => s.value === 'Q1')).toMatchObject({
      dimIndex: 0,
      startIndex: 0,
      endIndex: 1,
      spanAcrossDimensions: true
    });
  });

  it('should break child spans when parent changes', () => {
    // When Q1 → Q2, month spans should reset even if values repeat
  });

  it('should handle empty dimensions gracefully', () => {
    const spans = calculateHeaderSpans([], []);
    expect(spans).toEqual([]);
  });
});
```

**D3.js Rendering:**
```typescript
// Add to renderHeaderSpans() in pafv-header.ts

function renderHeaderSpans(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  spans: HeaderSpan[],
  orientation: 'horizontal' | 'vertical',
  cellSize: number,
  getCumulativeOffset: (index: number) => number
): void {
  const spanGroup = container.selectAll<SVGGElement, HeaderSpan>('.header-span')
    .data(spans, d => `${d.dimIndex}-${d.startIndex}-${d.value}`)
    .join(
      enter => enter.append('g')
        .attr('class', 'header-span')
        .call(g => {
          g.append('rect')
            .attr('class', 'span-background')
            .attr('fill', 'rgba(248, 248, 248, 0.95)')
            .attr('stroke', '#999')
            .attr('stroke-width', 1);
          
          g.append('text')
            .attr('class', 'span-label')
            .attr('text-anchor', orientation === 'horizontal' ? 'middle' : 'start')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold');
        }),
      update => update,
      exit => exit.remove()
    );

  spanGroup.each(function(span) {
    const g = d3.select(this);
    const startOffset = getCumulativeOffset(span.startIndex);
    const endOffset = getCumulativeOffset(span.endIndex + 1);
    const spanSize = endOffset - startOffset;

    if (orientation === 'horizontal') {
      g.select('.span-background')
        .attr('x', startOffset)
        .attr('y', span.dimIndex * cellSize)
        .attr('width', spanSize)
        .attr('height', cellSize);
      
      g.select('.span-label')
        .attr('x', startOffset + spanSize / 2)
        .attr('y', span.dimIndex * cellSize + cellSize / 2)
        .text(span.value);
    } else {
      g.select('.span-background')
        .attr('x', span.dimIndex * cellSize)
        .attr('y', startOffset)
        .attr('width', cellSize)
        .attr('height', spanSize);
      
      g.select('.span-label')
        .attr('x', span.dimIndex * cellSize + 12)
        .attr('y', startOffset + spanSize / 2)
        .text(span.value);
    }
  });
}
```

---

### Task 1.2: Bulk Resize with Shift+Drag

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/supergrid/src/SuperGrid.tsx` (lines 200-350)

**Target:** New file `src/views/supergrid/interactions/resize-handler.ts`

**Implementation:**

```typescript
// src/views/supergrid/interactions/resize-handler.ts

export interface ResizeState {
  isResizing: boolean;
  type: 'row' | 'column' | 'rowHeader' | 'columnHeader' | null;
  index: number;
  startPos: number;
  startSize: number;
  isShiftPressed: boolean;
  initialSizes: number[];
}

export interface ResizeOperation {
  type: 'resize_change';
  description: string;
  undo: () => void;
  redo: () => void;
}

export interface ResizeHandlerOptions {
  minColumnWidth?: number;
  minRowHeight?: number;
  onResizeStart?: (state: ResizeState) => void;
  onResize?: (state: ResizeState, newSize: number) => void;
  onResizeEnd?: (operation: ResizeOperation) => void;
}

export function createResizeHandler(
  options: ResizeHandlerOptions = {}
): {
  startResize: (e: MouseEvent, type: ResizeState['type'], index: number, currentSize: number, allSizes: number[]) => void;
  getState: () => ResizeState;
  destroy: () => void;
} {
  const { 
    minColumnWidth = 50, 
    minRowHeight = 20,
    onResizeStart,
    onResize,
    onResizeEnd 
  } = options;

  let state: ResizeState = {
    isResizing: false,
    type: null,
    index: -1,
    startPos: 0,
    startSize: 0,
    isShiftPressed: false,
    initialSizes: []
  };

  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  let mouseUpHandler: ((e: MouseEvent) => void) | null = null;

  function startResize(
    e: MouseEvent,
    type: ResizeState['type'],
    index: number,
    currentSize: number,
    allSizes: number[]
  ): void {
    e.preventDefault();
    
    state = {
      isResizing: true,
      type,
      index,
      startPos: type === 'column' || type === 'rowHeader' ? e.clientX : e.clientY,
      startSize: currentSize,
      isShiftPressed: e.shiftKey,
      initialSizes: [...allSizes]
    };

    document.body.style.cursor = type === 'column' || type === 'rowHeader' 
      ? 'col-resize' 
      : 'row-resize';

    onResizeStart?.(state);

    mouseMoveHandler = (moveEvent: MouseEvent) => {
      const isHorizontal = state.type === 'column' || state.type === 'rowHeader';
      const delta = isHorizontal 
        ? moveEvent.clientX - state.startPos 
        : moveEvent.clientY - state.startPos;
      
      const minSize = isHorizontal ? minColumnWidth : minRowHeight;
      const newSize = Math.max(minSize, state.startSize + delta);

      onResize?.(state, newSize);
    };

    mouseUpHandler = () => {
      if (onResizeEnd && state.type) {
        const finalSizes = [...state.initialSizes]; // Would be updated by onResize
        const initialSizes = state.initialSizes;
        const resizeType = state.type;
        const wasShiftPressed = state.isShiftPressed;

        onResizeEnd({
          type: 'resize_change',
          description: `Resize ${resizeType}${wasShiftPressed ? ' (all)' : ''}`,
          undo: () => {
            // Caller implements actual size restoration
          },
          redo: () => {
            // Caller implements actual size application
          }
        });
      }

      state = {
        isResizing: false,
        type: null,
        index: -1,
        startPos: 0,
        startSize: 0,
        isShiftPressed: false,
        initialSizes: []
      };

      document.body.style.cursor = 'default';
      cleanup();
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  }

  function cleanup(): void {
    if (mouseMoveHandler) {
      document.removeEventListener('mousemove', mouseMoveHandler);
      mouseMoveHandler = null;
    }
    if (mouseUpHandler) {
      document.removeEventListener('mouseup', mouseUpHandler);
      mouseUpHandler = null;
    }
  }

  return {
    startResize,
    getState: () => state,
    destroy: cleanup
  };
}
```

**Tests Required:**
```typescript
// tests/unit/views/supergrid/resize-handler.test.ts

describe('createResizeHandler', () => {
  it('should track resize state during drag', () => {
    const handler = createResizeHandler();
    // Mock mouse events...
  });

  it('should respect minimum column width', () => {
    const handler = createResizeHandler({ minColumnWidth: 100 });
    // Verify constraints...
  });

  it('should apply resize to all when shift pressed', () => {
    // Verify isShiftPressed flag propagates
  });

  it('should generate undo/redo operations', () => {
    const operations: ResizeOperation[] = [];
    const handler = createResizeHandler({
      onResizeEnd: (op) => operations.push(op)
    });
    // Verify operation structure
  });
});
```

---

### Task 1.3: Axis Navigator (Dimension Drag-Drop)

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/dimension-navigator/src/DimensionNavigator.tsx`

**Target:** New file `src/views/supergrid/components/axis-navigator.ts`

**Implementation:**

```typescript
// src/views/supergrid/components/axis-navigator.ts

import * as d3 from 'd3';
import type { AxisSelection, PlaneType } from '../types.js';

export interface AxisNavigatorConfig {
  width: number;
  height: number;
  onAxisAssign: (axis: AxisSelection, plane: PlaneType) => void;
  onAxisRemove: (axisId: string) => void;
  onAxisReorder: (axisId: string, newIndex: number, plane: PlaneType) => void;
}

export interface AxisNavigatorInstance {
  update: (state: {
    rowAxes: AxisSelection[];
    colAxes: AxisSelection[];
    availableAxes: AxisSelection[];
  }) => void;
  destroy: () => void;
}

export function createAxisNavigator(
  container: HTMLElement,
  config: AxisNavigatorConfig
): AxisNavigatorInstance {
  const { width, height, onAxisAssign, onAxisRemove, onAxisReorder } = config;

  // Create SVG container
  const svg = d3.select(container)
    .append('svg')
    .attr('class', 'axis-navigator')
    .attr('width', width)
    .attr('height', height);

  // Drop zones
  const rowZone = svg.append('g')
    .attr('class', 'drop-zone row-zone')
    .attr('data-type', 'y');

  const colZone = svg.append('g')
    .attr('class', 'drop-zone col-zone')
    .attr('data-type', 'x');

  const filterZone = svg.append('g')
    .attr('class', 'drop-zone filter-zone')
    .attr('data-type', 'filter');

  // Drag state
  let draggedAxis: AxisSelection | null = null;
  let dragStartPlane: PlaneType | null = null;

  function renderDropZone(
    zone: d3.Selection<SVGGElement, unknown, null, undefined>,
    title: string,
    axes: AxisSelection[],
    x: number,
    y: number,
    zoneWidth: number,
    zoneHeight: number,
    plane: PlaneType
  ): void {
    // Background
    zone.selectAll('.zone-bg').data([1]).join('rect')
      .attr('class', 'zone-bg')
      .attr('x', x)
      .attr('y', y)
      .attr('width', zoneWidth)
      .attr('height', zoneHeight)
      .attr('fill', '#ffffff')
      .attr('stroke', '#dee2e6')
      .attr('rx', 4);

    // Title
    zone.selectAll('.zone-title').data([1]).join('text')
      .attr('class', 'zone-title')
      .attr('x', x + 8)
      .attr('y', y + 16)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#6c757d')
      .text(`${title} (${axes.length})`);

    // Axis chips
    const chips = zone.selectAll<SVGGElement, AxisSelection>('.axis-chip')
      .data(axes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'axis-chip')
            .attr('cursor', 'grab')
            .call(setupDragBehavior, plane);

          g.append('rect')
            .attr('class', 'chip-bg')
            .attr('rx', 4)
            .attr('fill', '#ffffff')
            .attr('stroke', '#ddd');

          g.append('text')
            .attr('class', 'chip-label')
            .attr('font-size', '12px')
            .attr('font-weight', '500');

          g.append('text')
            .attr('class', 'chip-count')
            .attr('font-size', '11px')
            .attr('fill', '#666');

          return g;
        },
        update => update,
        exit => exit.remove()
      );

    // Position chips
    let chipX = x + 8;
    const chipY = y + 28;
    const chipHeight = 24;
    const chipPadding = 8;

    chips.each(function(axis, i) {
      const g = d3.select(this);
      const labelWidth = axis.id.length * 7 + 30; // Rough estimate

      g.attr('transform', `translate(${chipX}, ${chipY})`);

      g.select('.chip-bg')
        .attr('width', labelWidth)
        .attr('height', chipHeight);

      g.select('.chip-label')
        .attr('x', chipPadding)
        .attr('y', chipHeight / 2 + 4)
        .text(axis.id);

      g.select('.chip-count')
        .attr('x', labelWidth - chipPadding - 20)
        .attr('y', chipHeight / 2 + 4)
        .text(`(${axis.values?.length || 0})`);

      chipX += labelWidth + 4;
    });
  }

  function setupDragBehavior(
    selection: d3.Selection<SVGGElement, AxisSelection, SVGGElement, unknown>,
    sourcePlane: PlaneType
  ): void {
    selection.call(
      d3.drag<SVGGElement, AxisSelection>()
        .on('start', function(event, d) {
          draggedAxis = d;
          dragStartPlane = sourcePlane;
          d3.select(this).raise().attr('opacity', 0.7);
        })
        .on('drag', function(event) {
          d3.select(this)
            .attr('transform', `translate(${event.x}, ${event.y})`);
        })
        .on('end', function(event, d) {
          d3.select(this).attr('opacity', 1);

          // Find drop target
          const dropTarget = document.elementFromPoint(event.sourceEvent.clientX, event.sourceEvent.clientY);
          const zone = dropTarget?.closest('[data-type]');
          
          if (zone) {
            const targetPlane = zone.getAttribute('data-type') as PlaneType;
            
            if (targetPlane !== dragStartPlane) {
              // Inter-axis move
              onAxisAssign(d, targetPlane);
            } else {
              // Intra-axis reorder - calculate new index
              const chipElements = zone.querySelectorAll('.axis-chip');
              let newIndex = chipElements.length;

              chipElements.forEach((chip, index) => {
                const rect = chip.getBoundingClientRect();
                if (event.sourceEvent.clientY < rect.top + rect.height / 2) {
                  newIndex = Math.min(newIndex, index);
                }
              });

              if (newIndex !== axes.findIndex(a => a.id === d.id)) {
                onAxisReorder(d.id, newIndex, targetPlane);
              }
            }
          }

          draggedAxis = null;
          dragStartPlane = null;
        })
    );
  }

  // Store current state for axes reference
  let currentRowAxes: AxisSelection[] = [];
  let currentColAxes: AxisSelection[] = [];

  function update(state: {
    rowAxes: AxisSelection[];
    colAxes: AxisSelection[];
    availableAxes: AxisSelection[];
  }): void {
    currentRowAxes = state.rowAxes;
    currentColAxes = state.colAxes;

    const zoneWidth = (width - 24) / 3;
    const zoneHeight = height - 16;

    renderDropZone(rowZone, 'Rows', state.rowAxes, 8, 8, zoneWidth, zoneHeight, 'y');
    renderDropZone(colZone, 'Columns', state.colAxes, zoneWidth + 12, 8, zoneWidth, zoneHeight, 'x');
    renderDropZone(filterZone, 'Filters', [], zoneWidth * 2 + 16, 8, zoneWidth, zoneHeight, 'filter');
  }

  function destroy(): void {
    svg.remove();
  }

  return { update, destroy };
}
```

**Tests Required:**
```typescript
// tests/unit/views/supergrid/axis-navigator.test.ts

describe('createAxisNavigator', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should render drop zones for rows, columns, and filters', () => {
    const navigator = createAxisNavigator(container, {
      width: 600,
      height: 80,
      onAxisAssign: vi.fn(),
      onAxisRemove: vi.fn(),
      onAxisReorder: vi.fn()
    });

    navigator.update({
      rowAxes: [{ id: 'category', type: 'C', plane: 'y' }],
      colAxes: [{ id: 'status', type: 'C', plane: 'x' }],
      availableAxes: []
    });

    expect(container.querySelectorAll('.drop-zone')).toHaveLength(3);
    expect(container.querySelectorAll('.axis-chip')).toHaveLength(2);
  });

  it('should call onAxisAssign when dragging between zones', () => {
    const onAxisAssign = vi.fn();
    // Simulate drag...
  });

  it('should call onAxisReorder for intra-zone reordering', () => {
    const onAxisReorder = vi.fn();
    // Simulate reorder...
  });
});
```

---

### Task 1.4: SuperDensitySparsity Control

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/specs/SuperGrid.md` (spec document)

**Target:** New file `src/views/supergrid/controls/density-control.ts`

**Implementation:**

```typescript
// src/views/supergrid/controls/density-control.ts

import * as d3 from 'd3';

export interface DensityLevel {
  id: string;
  name: string;
  aggregation: 'none' | 'group' | 'rollup';
  collapseDepth: number; // How many hierarchy levels to collapse
}

export interface DensityHierarchy {
  sparseValues: string[];
  denseValue: string;
  mapping: Map<string, string>; // sparse → dense
}

export interface DensityControlConfig {
  facetId: string;
  hierarchies?: DensityHierarchy[];
  initialLevel?: number;
  onChange: (facetId: string, level: number, hierarchy: DensityHierarchy | null) => void;
}

export interface DensityControlInstance {
  setLevel: (level: number) => void;
  getLevel: () => number;
  getHierarchy: () => DensityHierarchy | null;
  destroy: () => void;
}

/**
 * SuperDensitySparsity Control
 * 
 * Key insight from specs/SuperGrid.md:
 * - Sparse view = maximum granularity (each card visible)
 * - Dense view = aggregated representation (counts/rollups)
 * - Janus translation preserves accuracy across zoom levels
 * 
 * Example hierarchy:
 * Dense Stages:  TO DO   | Doing  | Done
 * Sparse Stages: Capture, Backlog, TO DO | Doing, Blocked, Review | Done, NOT TO DO, Archive
 */
export function createDensityControl(
  container: HTMLElement,
  config: DensityControlConfig
): DensityControlInstance {
  const { facetId, hierarchies = [], initialLevel = 0, onChange } = config;

  let currentLevel = initialLevel;
  const maxLevel = hierarchies.length;

  // Create slider UI
  const wrapper = d3.select(container)
    .append('div')
    .attr('class', 'density-control')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('gap', '8px')
    .style('padding', '4px 8px')
    .style('background', '#f8f9fa')
    .style('border-radius', '4px');

  // Label
  wrapper.append('span')
    .attr('class', 'density-label')
    .style('font-size', '11px')
    .style('color', '#6c757d')
    .text('Density:');

  // Sparse label
  wrapper.append('span')
    .style('font-size', '10px')
    .style('color', '#adb5bd')
    .text('Sparse');

  // Slider
  const slider = wrapper.append('input')
    .attr('type', 'range')
    .attr('min', 0)
    .attr('max', maxLevel)
    .attr('value', currentLevel)
    .attr('step', 1)
    .style('width', '80px')
    .style('cursor', 'pointer')
    .on('input', function() {
      const newLevel = parseInt(this.value, 10);
      setLevel(newLevel);
    });

  // Dense label
  wrapper.append('span')
    .style('font-size', '10px')
    .style('color', '#adb5bd')
    .text('Dense');

  // Current level indicator
  const indicator = wrapper.append('span')
    .attr('class', 'density-indicator')
    .style('font-size', '11px')
    .style('color', '#495057')
    .style('min-width', '60px');

  function updateIndicator(): void {
    if (currentLevel === 0) {
      indicator.text('Individual');
    } else if (hierarchies[currentLevel - 1]) {
      indicator.text(hierarchies[currentLevel - 1].denseValue);
    } else {
      indicator.text(`Level ${currentLevel}`);
    }
  }

  function setLevel(level: number): void {
    currentLevel = Math.max(0, Math.min(maxLevel, level));
    slider.property('value', currentLevel);
    updateIndicator();

    const hierarchy = currentLevel > 0 ? hierarchies[currentLevel - 1] : null;
    onChange(facetId, currentLevel, hierarchy);
  }

  function getLevel(): number {
    return currentLevel;
  }

  function getHierarchy(): DensityHierarchy | null {
    return currentLevel > 0 ? hierarchies[currentLevel - 1] : null;
  }

  function destroy(): void {
    wrapper.remove();
  }

  // Initialize
  updateIndicator();

  return { setLevel, getLevel, getHierarchy, destroy };
}

/**
 * Build a density hierarchy from category values
 * 
 * Example usage:
 * const hierarchy = buildDensityHierarchy(
 *   ['Capture', 'Backlog', 'TO DO', 'Doing', 'Blocked', 'Review', 'Done', 'NOT TO DO', 'Archive'],
 *   {
 *     'TO DO': ['Capture', 'Backlog', 'TO DO'],
 *     'Doing': ['Doing', 'Blocked', 'Review'],
 *     'Done': ['Done', 'NOT TO DO', 'Archive']
 *   }
 * );
 */
export function buildDensityHierarchy(
  sparseValues: string[],
  denseMapping: Record<string, string[]>
): DensityHierarchy {
  const mapping = new Map<string, string>();
  
  for (const [denseValue, sparseGroup] of Object.entries(denseMapping)) {
    for (const sparse of sparseGroup) {
      mapping.set(sparse, denseValue);
    }
  }

  return {
    sparseValues,
    denseValue: Object.keys(denseMapping).join(' | '),
    mapping
  };
}

/**
 * Apply density transformation to card data
 */
export function applyDensityTransform<T extends { [key: string]: unknown }>(
  cards: T[],
  facetKey: keyof T,
  hierarchy: DensityHierarchy | null
): T[] {
  if (!hierarchy) return cards;

  return cards.map(card => ({
    ...card,
    [facetKey]: hierarchy.mapping.get(card[facetKey] as string) || card[facetKey]
  }));
}
```

**Tests Required:**
```typescript
// tests/unit/views/supergrid/density-control.test.ts

describe('Density Control', () => {
  describe('buildDensityHierarchy', () => {
    it('should create mapping from sparse to dense values', () => {
      const hierarchy = buildDensityHierarchy(
        ['Capture', 'Backlog', 'TO DO', 'Doing', 'Review', 'Done'],
        {
          'TO DO': ['Capture', 'Backlog', 'TO DO'],
          'Doing': ['Doing', 'Review'],
          'Done': ['Done']
        }
      );

      expect(hierarchy.mapping.get('Capture')).toBe('TO DO');
      expect(hierarchy.mapping.get('Review')).toBe('Doing');
      expect(hierarchy.mapping.get('Done')).toBe('Done');
    });
  });

  describe('applyDensityTransform', () => {
    it('should transform cards at dense level', () => {
      const cards = [
        { id: '1', status: 'Capture' },
        { id: '2', status: 'Review' },
        { id: '3', status: 'Done' }
      ];

      const hierarchy = buildDensityHierarchy(
        ['Capture', 'Review', 'Done'],
        { 'TO DO': ['Capture'], 'Doing': ['Review'], 'Done': ['Done'] }
      );

      const transformed = applyDensityTransform(cards, 'status', hierarchy);

      expect(transformed[0].status).toBe('TO DO');
      expect(transformed[1].status).toBe('Doing');
      expect(transformed[2].status).toBe('Done');
    });

    it('should return unchanged cards when hierarchy is null', () => {
      const cards = [{ id: '1', status: 'Capture' }];
      const result = applyDensityTransform(cards, 'status', null);
      expect(result).toEqual(cards);
    });
  });
});
```

---

## Phase 2: Graph Intelligence

**Duration:** 3-4 days  
**Dependencies:** Phase 1 (header spanning uses graph for connections)

### Task 2.1: Connection Suggestion Engine

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/graph-analytics/src/graph-service.ts` (suggestCardConnections method)

**Target:** New file `src/graph/suggestions/index.ts`

**Implementation:**

```typescript
// src/graph/suggestions/index.ts

import type { Database } from 'better-sqlite3';
import type { Card } from '../../core/types.js';
import { getTopConnectedNodes } from '../aggregate/centrality.js';
import { getConnectedComponents } from '../cluster/algorithms/connected-components.js';

export interface ConnectionSuggestion {
  cardId: string;
  reason: string;
  confidence: number;
  type: 'similar_content' | 'same_community' | 'shared_tags' | 'mutual_connections';
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  minConfidence?: number;
  includeTypes?: ConnectionSuggestion['type'][];
}

/**
 * Suggest new connections for a card based on graph analysis
 * 
 * Ported from v1/v2 graph-service.ts with SQLite backend
 */
export function suggestConnections(
  db: Database,
  cardId: string,
  options: SuggestionOptions = {}
): ConnectionSuggestion[] {
  const {
    maxSuggestions = 10,
    minConfidence = 0.3,
    includeTypes = ['similar_content', 'same_community', 'shared_tags', 'mutual_connections']
  } = options;

  const suggestions: ConnectionSuggestion[] = [];

  // 1. Find cards with shared tags
  if (includeTypes.includes('shared_tags')) {
    const sharedTagSuggestions = findSharedTagConnections(db, cardId);
    suggestions.push(...sharedTagSuggestions);
  }

  // 2. Find cards in same community cluster
  if (includeTypes.includes('same_community')) {
    const communitySuggestions = findCommunityConnections(db, cardId);
    suggestions.push(...communitySuggestions);
  }

  // 3. Find cards through mutual connections
  if (includeTypes.includes('mutual_connections')) {
    const mutualSuggestions = findMutualConnections(db, cardId);
    suggestions.push(...mutualSuggestions);
  }

  // Deduplicate and sort
  const deduped = deduplicateSuggestions(suggestions);
  
  return deduped
    .filter(s => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxSuggestions);
}

function findSharedTagConnections(db: Database, cardId: string): ConnectionSuggestion[] {
  const query = `
    WITH card_tags AS (
      SELECT json_each.value as tag
      FROM nodes, json_each(nodes.tags)
      WHERE nodes.id = ? AND nodes.deleted_at IS NULL
    ),
    matching_cards AS (
      SELECT 
        n.id,
        COUNT(*) as shared_count
      FROM nodes n, json_each(n.tags) as t
      WHERE n.id != ?
        AND n.deleted_at IS NULL
        AND t.value IN (SELECT tag FROM card_tags)
        AND NOT EXISTS (
          SELECT 1 FROM edges e 
          WHERE (e.source_id = ? AND e.target_id = n.id)
             OR (e.source_id = n.id AND e.target_id = ?)
        )
      GROUP BY n.id
      HAVING shared_count > 0
    )
    SELECT id, shared_count FROM matching_cards
    ORDER BY shared_count DESC
    LIMIT 10
  `;

  const stmt = db.prepare(query);
  const results = stmt.all(cardId, cardId, cardId, cardId) as any[];

  return results.map(row => ({
    cardId: row.id,
    reason: `Shares ${row.shared_count} tag(s)`,
    confidence: Math.min(0.7, 0.3 + (row.shared_count * 0.1)),
    type: 'shared_tags' as const
  }));
}

function findCommunityConnections(db: Database, cardId: string): ConnectionSuggestion[] {
  // Use connected components to find cards in same cluster
  const components = getConnectedComponents(db, { minComponentSize: 2 });
  
  // Find which component contains our card
  let targetComponent: string[] | null = null;
  for (const component of components) {
    if (component.includes(cardId)) {
      targetComponent = component;
      break;
    }
  }

  if (!targetComponent) return [];

  // Get existing connections to filter out
  const existingQuery = `
    SELECT DISTINCT
      CASE WHEN source_id = ? THEN target_id ELSE source_id END as connected_id
    FROM edges
    WHERE (source_id = ? OR target_id = ?)
      AND deleted_at IS NULL
  `;
  const existingStmt = db.prepare(existingQuery);
  const existingConnections = new Set(
    (existingStmt.all(cardId, cardId, cardId) as any[]).map(r => r.connected_id)
  );

  return targetComponent
    .filter(id => id !== cardId && !existingConnections.has(id))
    .slice(0, 5)
    .map(id => ({
      cardId: id,
      reason: 'Same community cluster',
      confidence: 0.6,
      type: 'same_community' as const
    }));
}

function findMutualConnections(db: Database, cardId: string): ConnectionSuggestion[] {
  const query = `
    WITH my_connections AS (
      SELECT DISTINCT
        CASE WHEN source_id = ? THEN target_id ELSE source_id END as connected_id
      FROM edges
      WHERE (source_id = ? OR target_id = ?)
        AND deleted_at IS NULL
    ),
    mutual_paths AS (
      SELECT 
        CASE WHEN e.source_id IN (SELECT connected_id FROM my_connections) 
             THEN e.target_id ELSE e.source_id END as suggested_id,
        COUNT(*) as mutual_count
      FROM edges e
      WHERE e.deleted_at IS NULL
        AND (e.source_id IN (SELECT connected_id FROM my_connections)
             OR e.target_id IN (SELECT connected_id FROM my_connections))
        AND e.source_id != ? AND e.target_id != ?
        AND CASE WHEN e.source_id IN (SELECT connected_id FROM my_connections) 
                 THEN e.target_id ELSE e.source_id END NOT IN (SELECT connected_id FROM my_connections)
      GROUP BY suggested_id
      HAVING mutual_count > 0
    )
    SELECT suggested_id, mutual_count FROM mutual_paths
    ORDER BY mutual_count DESC
    LIMIT 5
  `;

  const stmt = db.prepare(query);
  const results = stmt.all(cardId, cardId, cardId, cardId, cardId) as any[];

  return results.map(row => ({
    cardId: row.suggested_id,
    reason: `${row.mutual_count} mutual connection(s)`,
    confidence: Math.min(0.6, 0.2 + (row.mutual_count * 0.1)),
    type: 'mutual_connections' as const
  }));
}

function deduplicateSuggestions(suggestions: ConnectionSuggestion[]): ConnectionSuggestion[] {
  const seen = new Map<string, ConnectionSuggestion>();

  for (const suggestion of suggestions) {
    const existing = seen.get(suggestion.cardId);
    if (!existing || suggestion.confidence > existing.confidence) {
      seen.set(suggestion.cardId, suggestion);
    }
  }

  return Array.from(seen.values());
}
```

**Tests Required:**
```typescript
// tests/unit/graph/suggestions.test.ts

describe('suggestConnections', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDatabase();
    // Seed with test graph data
  });

  it('should find cards with shared tags', () => {
    // Create cards with overlapping tags
    const suggestions = suggestConnections(db, 'card-1', {
      includeTypes: ['shared_tags']
    });
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe('shared_tags');
  });

  it('should find cards in same community', () => {
    // Create a cluster of connected cards
    const suggestions = suggestConnections(db, 'card-1', {
      includeTypes: ['same_community']
    });
    
    expect(suggestions.some(s => s.type === 'same_community')).toBe(true);
  });

  it('should exclude existing connections', () => {
    // Create direct connection card-1 → card-2
    const suggestions = suggestConnections(db, 'card-1');
    
    expect(suggestions.find(s => s.cardId === 'card-2')).toBeUndefined();
  });

  it('should respect confidence threshold', () => {
    const suggestions = suggestConnections(db, 'card-1', {
      minConfidence: 0.8
    });
    
    expect(suggestions.every(s => s.confidence >= 0.8)).toBe(true);
  });
});
```

---

### Task 2.2: Query Result Caching

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/graph-analytics/src/graph-service.ts` (queryCache pattern)

**Target:** New file `src/graph/cache/query-cache.ts`

**Implementation:**

```typescript
// src/graph/cache/query-cache.ts

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface QueryCacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
}

/**
 * Simple query result cache with TTL
 * Ported from v1/v2 graph-service.ts
 */
export class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttl: number;
  private maxSize: number;

  constructor(options: QueryCacheOptions = {}) {
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 100;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or compute cached value
   */
  async getOrCompute<T>(
    key: string,
    compute: () => T | Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const result = await compute();
    this.set(key, result);
    return result;
  }

  /**
   * Generate cache key from query and parameters
   */
  static createKey(queryName: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${queryName}:${sortedParams}`;
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton instance for graph queries
export const graphQueryCache = new QueryCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 200
});

// Usage example with graph queries:
// 
// import { graphQueryCache } from './cache/query-cache.js';
// 
// function getCentrality(db, nodeId) {
//   const key = QueryCache.createKey('centrality', { nodeId });
//   return graphQueryCache.getOrCompute(key, () => {
//     return calculateDegreeCentrality(db, nodeId);
//   });
// }
```

**Tests Required:**
```typescript
// tests/unit/graph/query-cache.test.ts

describe('QueryCache', () => {
  it('should cache and retrieve values', () => {
    const cache = new QueryCache();
    cache.set('test', { value: 42 });
    
    expect(cache.get('test')).toEqual({ value: 42 });
  });

  it('should expire entries after TTL', async () => {
    const cache = new QueryCache({ ttl: 100 });
    cache.set('test', { value: 42 });
    
    await new Promise(r => setTimeout(r, 150));
    
    expect(cache.get('test')).toBeNull();
  });

  it('should evict oldest when at capacity', () => {
    const cache = new QueryCache({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('should invalidate by pattern', () => {
    const cache = new QueryCache();
    cache.set('user:1', 'a');
    cache.set('user:2', 'b');
    cache.set('post:1', 'c');
    
    cache.invalidate(/^user:/);
    
    expect(cache.get('user:1')).toBeNull();
    expect(cache.get('user:2')).toBeNull();
    expect(cache.get('post:1')).toBe('c');
  });

  describe('getOrCompute', () => {
    it('should compute on cache miss', async () => {
      const cache = new QueryCache();
      const compute = vi.fn().mockReturnValue(42);
      
      const result = await cache.getOrCompute('test', compute);
      
      expect(result).toBe(42);
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should return cached on cache hit', async () => {
      const cache = new QueryCache();
      const compute = vi.fn().mockReturnValue(42);
      
      await cache.getOrCompute('test', compute);
      await cache.getOrCompute('test', compute);
      
      expect(compute).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

## Phase 3: Sync Infrastructure (Future)

**Duration:** 5-7 days  
**Dependencies:** Phases 1-2, native Swift shell
**Deferred until:** Native shell implementation begins

### Task 3.1: Conflict Resolution Service

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/storage/src/ConflictResolutionService.ts`

**Target:** Future `src/sync/conflict-resolution.ts`

**Key Patterns to Port:**
- Auto-resolution strategies (last-write-wins, merge, keep-both)
- Field-level conflict detection
- User notification for manual resolution
- Conflict history tracking

### Task 3.2: Offline Sync Queue

**Source:** `/Users/mshaler/Developer/Projects/CardBoard/packages/storage/src/OfflineSyncService.ts`

**Target:** Future `src/sync/offline-queue.ts`

**Key Patterns to Port:**
- Pending operation queue
- Exponential backoff on failure
- Operation deduplication
- Background sync triggers

---

## File Checklist

### New Files to Create

```
src/views/supergrid/
├── interactions/
│   └── resize-handler.ts          # Task 1.2
├── components/
│   └── axis-navigator.ts          # Task 1.3
├── controls/
│   └── density-control.ts         # Task 1.4

src/graph/
├── suggestions/
│   └── index.ts                   # Task 2.1
├── cache/
│   └── query-cache.ts             # Task 2.2

tests/unit/views/supergrid/
├── header-spans.test.ts           # Task 1.1
├── resize-handler.test.ts         # Task 1.2
├── axis-navigator.test.ts         # Task 1.3
├── density-control.test.ts        # Task 1.4

tests/unit/graph/
├── suggestions.test.ts            # Task 2.1
├── query-cache.test.ts            # Task 2.2
```

### Existing Files to Modify

```
src/views/supergrid/components/pafv-header.ts
  - Add calculateHeaderSpans()
  - Add renderHeaderSpans()

src/views/supergrid/index.ts
  - Export new components
  - Integrate resize handler
  - Integrate density control

src/graph/index.ts
  - Export suggestions module
  - Export cache module
```

---

## Integration Points

### SuperGrid ↔ FilterNav

```typescript
// When axis assignment changes in AxisNavigator:
axisNavigator.on('assign', (axis, plane) => {
  superGrid.setAxisAssignment(axis.id, plane);
  filterNav.updateState({ ... });
});
```

### SuperGrid ↔ Density Control

```typescript
// When density level changes:
densityControl.onChange = (facetId, level, hierarchy) => {
  const transformed = applyDensityTransform(cards, facetId, hierarchy);
  superGrid.setCards(transformed);
};
```

### Graph Suggestions ↔ UI

```typescript
// Show suggestions in card detail panel:
const suggestions = suggestConnections(db, selectedCardId);
cardPanel.setSuggestions(suggestions);
```

---

## Test Coverage Requirements

| Module | Unit | Integration | E2E |
|--------|------|-------------|-----|
| Header spans | 90% | - | - |
| Resize handler | 85% | - | - |
| Axis navigator | 80% | 70% | - |
| Density control | 90% | - | - |
| Connection suggestions | 85% | 75% | - |
| Query cache | 95% | - | - |

Run tests with:
```bash
npm run test:unit -- --coverage
```

---

## Commit Strategy

Follow conventional commits:

```
feat(supergrid): add header spanning visual overlays
feat(supergrid): implement shift+drag bulk resize
feat(supergrid): add axis navigator with DnD reordering
feat(supergrid): add SuperDensitySparsity control
feat(graph): add connection suggestion engine
feat(graph): add query result caching
test(supergrid): add header span calculation tests
test(graph): add suggestion engine tests
docs: add V1V2 port implementation plan
```

---

## Reference Files

### From v1/v2 Repository

| Feature | File Path |
|---------|-----------|
| Header Spanning | `/Users/mshaler/Developer/Projects/CardBoard/packages/supergrid/src/SuperGrid.tsx` |
| Resize Logic | Same as above |
| DimensionNavigator | `/Users/mshaler/Developer/Projects/CardBoard/packages/dimension-navigator/src/DimensionNavigator.tsx` |
| Graph Service | `/Users/mshaler/Developer/Projects/CardBoard/packages/graph-analytics/src/graph-service.ts` |
| SuperGrid Spec | `/Users/mshaler/Developer/Projects/CardBoard-v3/specs/SuperGrid.md` |
| Core Data Models | `/Users/mshaler/Developer/Projects/CardBoard/packages/core/src/dataModels.ts` |
| Storage Patterns | `/Users/mshaler/Developer/Projects/CardBoard/packages/storage/src/` |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Header spanning overlays render correctly in SuperGrid
- [ ] Shift+drag resizes all rows/columns simultaneously
- [ ] Resize operations support undo/redo
- [ ] Axis navigator allows drag-drop between row/col/filter zones
- [ ] Density slider collapses/expands category hierarchies
- [ ] All Phase 1 tests pass at required coverage

### Phase 2 Complete When:
- [ ] Connection suggestions API returns relevant results
- [ ] Query cache reduces redundant computations
- [ ] Suggestions integrate with card detail UI
- [ ] All Phase 2 tests pass at required coverage

### Phase 3 Complete When:
- [ ] Conflict resolution handles all auto-resolvable cases
- [ ] User notification system works for manual conflicts
- [ ] Offline queue persists pending operations
- [ ] Background sync triggers on network change

---

*Document Version: 1.0*  
*Ready for Claude Code handoff*
