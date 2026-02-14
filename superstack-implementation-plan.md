# SuperStack Implementation Plan

*The Foundation of SuperGrid: Nested Hierarchical Headers*

**Version:** 1.0  
**Date:** February 2025  
**Status:** Ready for Implementation

---

## Executive Summary

SuperStack is the nested header system that transforms SuperGrid from a flat grid into a true dimensional pivot table. It renders hierarchical LATCH facets as multi-level row and column headers, enabling users to see data organized by Folder → Tags (rows) and Year → Month (columns) simultaneously.

**What SuperStack Delivers:**
- Multi-level nested headers on both axes
- Collapsible hierarchy (expand/collapse levels)
- Span calculation (parent headers span child headers)
- Click-to-filter (click header to filter to that subset)
- Foundation for all SuperGrid interactions

**Architecture Alignment:**
- **PAFV**: Maps Facets to Planes via header trees
- **LATCH**: Headers ARE the separation (Category, Time, Hierarchy)
- **D3.js**: enter/update/exit for header state management
- **SQLite**: Query drives header structure

---

## Table of Contents

1. [Conceptual Model](#1-conceptual-model)
2. [Data Structures](#2-data-structures)
3. [SQL Query Strategy](#3-sql-query-strategy)
4. [D3.js Rendering](#4-d3js-rendering)
5. [Interactions](#5-interactions)
6. [Implementation Phases](#6-implementation-phases)
7. [Testing Strategy](#7-testing-strategy)
8. [File Structure](#8-file-structure)
9. [Success Criteria](#9-success-criteria)

---

## 1. Conceptual Model

### What SuperStack Renders

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                         2024                            │
                    ├──────────────────────────┬──────────────────────────────┤
                    │          Q3              │            Q4                │
                    ├────────┬────────┬────────┼────────┬────────┬────────────┤
                    │  Jul   │  Aug   │  Sep   │  Oct   │  Nov   │   Dec      │
┌───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│ Work              │        │        │        │        │        │            │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│   #meetings       │   5    │   8    │   6    │  12    │   8    │     5      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│   #planning       │   2    │   3    │   4    │   4    │   7    │     3      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│   #ideas          │   8    │   6    │   5    │   8    │   5    │     9      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│ Personal          │        │        │        │        │        │            │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│   #journal        │  31    │  31    │  30    │  28    │  30    │    31      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│   #reading        │   4    │   3    │   2    │   3    │   2    │     4      │
└───────────────────┴────────┴────────┴────────┴────────┴────────┴────────────┘
```

### Header Tree Structure

Headers form trees, not flat lists:

```
Column Headers (Time):                 Row Headers (Category):
          2024                                 Work
         /    \                              /  |  \
       Q3      Q4                    #meetings #planning #ideas
      /|\      /|\                             
   Jul Aug Sep Oct Nov Dec                   Personal
                                              /    \
                                        #journal  #reading
```

### Key Properties

| Property | Description |
|----------|-------------|
| **Depth** | Levels in hierarchy (Year→Quarter→Month = 3) |
| **Span** | Leaf columns/rows this header covers |
| **Path** | Ancestry chain for filtering |
| **Collapsed** | Whether children are hidden |

---

## 2. Data Structures

### 2.1 Core Types

```typescript
// types/superstack.ts

/**
 * A single header node in the hierarchy.
 * Headers can be row headers (left side) or column headers (top).
 */
export interface HeaderNode {
  /** Unique identifier for this header */
  id: string;
  
  /** The LATCH facet this header represents */
  facet: FacetConfig;
  
  /** The actual value displayed ("Work", "2024", "January") */
  value: string;
  
  /** Display label (may differ from value) */
  label: string;
  
  /** Depth in the tree (0 = root/outermost) */
  depth: number;
  
  /** Number of leaf nodes this header spans */
  span: number;
  
  /** Starting index in the leaf array */
  startIndex: number;
  
  /** Child headers (next facet level) */
  children: HeaderNode[];
  
  /** Parent reference for traversal */
  parent: HeaderNode | null;
  
  /** Is this header currently collapsed? */
  collapsed: boolean;
  
  /** Path from root to this node (for filtering) */
  path: string[];
  
  /** Aggregation data for this header's scope */
  aggregate?: HeaderAggregate;
}

/**
 * Aggregate data for a header's span
 */
export interface HeaderAggregate {
  /** Total cards in this header's scope */
  count: number;
  
  /** Sum of numeric facet (if applicable) */
  sum?: number;
  
  /** Optional sparkline data */
  trend?: number[];
}

/**
 * Configuration for a LATCH facet used in headers
 */
export interface FacetConfig {
  /** Facet identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** LATCH axis: L, A, T, C, H */
  axis: 'L' | 'A' | 'T' | 'C' | 'H';
  
  /** Source column in SQLite */
  sourceColumn: string;
  
  /** Data type for rendering/sorting */
  dataType: 'text' | 'number' | 'date' | 'select' | 'multi_select';
  
  /** For time facets: strftime format */
  timeFormat?: string;
  
  /** For select facets: predefined options */
  options?: string[];
  
  /** Sort order */
  sortOrder: 'asc' | 'desc' | 'custom';
}

/**
 * Complete header tree for one axis (row or column)
 */
export interface HeaderTree {
  /** Axis type */
  axis: 'row' | 'column';
  
  /** Ordered facets defining the hierarchy */
  facets: FacetConfig[];
  
  /** Root nodes (first facet level) */
  roots: HeaderNode[];
  
  /** Maximum depth of the tree */
  maxDepth: number;
  
  /** Total leaf count (spans of all roots) */
  leafCount: number;
  
  /** Flattened leaf nodes for positioning */
  leaves: HeaderNode[];
}

/**
 * SuperStack configuration and state
 */
export interface SuperStackState {
  /** Row header configuration */
  rowFacets: FacetConfig[];
  
  /** Column header configuration */
  colFacets: FacetConfig[];
  
  /** Built row header tree */
  rowTree: HeaderTree;
  
  /** Built column header tree */
  colTree: HeaderTree;
  
  /** Currently collapsed header IDs */
  collapsedIds: Set<string>;
  
  /** Currently selected/highlighted header ID */
  selectedId: string | null;
  
  /** Pixel dimensions for rendering */
  dimensions: SuperStackDimensions;
}

/**
 * Pixel dimensions for SuperStack layout
 */
export interface SuperStackDimensions {
  /** Width of each row header level */
  rowHeaderLevelWidth: number;
  
  /** Height of each column header level */
  colHeaderLevelHeight: number;
  
  /** Minimum width of a data cell */
  cellMinWidth: number;
  
  /** Minimum height of a data cell */
  cellMinHeight: number;
  
  /** Current zoom level (affects cell size) */
  zoom: number;
}
```

### 2.2 Default Configurations

```typescript
// config/superstack-defaults.ts

export const DEFAULT_DIMENSIONS: SuperStackDimensions = {
  rowHeaderLevelWidth: 120,
  colHeaderLevelHeight: 28,
  cellMinWidth: 80,
  cellMinHeight: 28,
  zoom: 1.0,
};

export const COMMON_FACETS: Record<string, FacetConfig> = {
  folder: {
    id: 'folder',
    name: 'Folder',
    axis: 'C',
    sourceColumn: 'folder',
    dataType: 'select',
    sortOrder: 'asc',
  },
  tags: {
    id: 'tags',
    name: 'Tags',
    axis: 'C',
    sourceColumn: 'tags',
    dataType: 'multi_select',
    sortOrder: 'asc',
  },
  status: {
    id: 'status',
    name: 'Status',
    axis: 'C',
    sourceColumn: 'status',
    dataType: 'select',
    options: ['inbox', 'active', 'waiting', 'completed', 'archived'],
    sortOrder: 'custom',
  },
  priority: {
    id: 'priority',
    name: 'Priority',
    axis: 'H',
    sourceColumn: 'priority',
    dataType: 'number',
    sortOrder: 'desc',
  },
  year: {
    id: 'year',
    name: 'Year',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%Y',
    sortOrder: 'asc',
  },
  quarter: {
    id: 'quarter',
    name: 'Quarter',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: 'Q%Q',  // Custom: will need post-processing
    sortOrder: 'asc',
  },
  month: {
    id: 'month',
    name: 'Month',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%m',
    sortOrder: 'asc',
  },
  week: {
    id: 'week',
    name: 'Week',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%W',
    sortOrder: 'asc',
  },
};
```

---

## 3. SQL Query Strategy

### 3.1 Header Discovery Query

Before rendering, we need to know what header values exist:

```typescript
// queries/header-discovery.ts

/**
 * Build SQL to discover all unique values for each facet level.
 * Returns the Cartesian product of facet values that have data.
 */
export function buildHeaderDiscoveryQuery(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[],
  filters: Filter[] = []
): string {
  const allFacets = [...rowFacets, ...colFacets];
  
  const selects = allFacets.map(facet => {
    if (facet.axis === 'T' && facet.timeFormat) {
      return `strftime('${facet.timeFormat}', ${facet.sourceColumn}) AS ${facet.id}`;
    }
    if (facet.dataType === 'multi_select') {
      // Will need json_each for tags
      return `json_each.value AS ${facet.id}`;
    }
    return `${facet.sourceColumn} AS ${facet.id}`;
  });
  
  const groupBy = allFacets.map(f => f.id);
  
  const whereClause = filters.length > 0
    ? `AND ${filters.map(f => f.toSQL()).join(' AND ')}`
    : '';
  
  // Handle multi_select facets with json_each
  const hasMultiSelect = allFacets.some(f => f.dataType === 'multi_select');
  const jsonJoin = hasMultiSelect
    ? `CROSS JOIN json_each(nodes.tags)`
    : '';
  
  return `
    SELECT 
      ${selects.join(',\n      ')},
      COUNT(*) AS card_count
    FROM nodes
    ${jsonJoin}
    WHERE deleted_at IS NULL
      ${whereClause}
    GROUP BY ${groupBy.join(', ')}
    HAVING card_count > 0
    ORDER BY ${groupBy.join(', ')}
  `;
}
```

### 3.2 Example Query

For Rows: `[folder, tags]` and Columns: `[year, month]`:

```sql
SELECT 
  folder,
  json_each.value AS tags,
  strftime('%Y', created_at) AS year,
  strftime('%m', created_at) AS month,
  COUNT(*) AS card_count
FROM nodes
CROSS JOIN json_each(nodes.tags)
WHERE deleted_at IS NULL
GROUP BY folder, tags, year, month
HAVING card_count > 0
ORDER BY folder, tags, year, month;
```

Result:
```
folder   | tags       | year | month | card_count
---------|------------|------|-------|------------
Personal | #journal   | 2024 | 07    | 31
Personal | #journal   | 2024 | 08    | 31
Personal | #reading   | 2024 | 07    | 4
Work     | #ideas     | 2024 | 07    | 8
Work     | #meetings  | 2024 | 07    | 5
Work     | #planning  | 2024 | 07    | 2
...
```

### 3.3 Tree Builder

Transform flat query results into header trees:

```typescript
// builders/header-tree-builder.ts

export function buildHeaderTree(
  rows: QueryRow[],
  facets: FacetConfig[],
  axis: 'row' | 'column'
): HeaderTree {
  const facetKeys = facets.map(f => f.id);
  const roots: HeaderNode[] = [];
  const nodeMap = new Map<string, HeaderNode>();
  
  // Build tree by iterating through unique paths
  for (const row of rows) {
    let currentLevel = roots;
    let parentNode: HeaderNode | null = null;
    const currentPath: string[] = [];
    
    for (let depth = 0; depth < facets.length; depth++) {
      const facet = facets[depth];
      const value = row[facet.id] as string;
      currentPath.push(value);
      
      const nodeId = currentPath.join('|');
      
      let node = nodeMap.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          facet,
          value,
          label: formatLabel(facet, value),
          depth,
          span: 0,  // Will calculate after
          startIndex: 0,  // Will calculate after
          children: [],
          parent: parentNode,
          collapsed: false,
          path: [...currentPath],
          aggregate: { count: 0 },
        };
        nodeMap.set(nodeId, node);
        currentLevel.push(node);
      }
      
      // Accumulate counts
      node.aggregate!.count += row.card_count as number;
      
      parentNode = node;
      currentLevel = node.children;
    }
  }
  
  // Calculate spans and indices
  calculateSpansAndIndices(roots);
  
  // Collect leaves
  const leaves = collectLeaves(roots);
  
  return {
    axis,
    facets,
    roots,
    maxDepth: facets.length,
    leafCount: leaves.length,
    leaves,
  };
}

function calculateSpansAndIndices(nodes: HeaderNode[], startIndex = 0): number {
  let currentIndex = startIndex;
  
  for (const node of nodes) {
    node.startIndex = currentIndex;
    
    if (node.children.length === 0) {
      // Leaf node: span is 1
      node.span = 1;
      currentIndex += 1;
    } else {
      // Parent node: span is sum of children's spans
      node.span = calculateSpansAndIndices(node.children, currentIndex);
      currentIndex += node.span;
    }
  }
  
  return currentIndex - startIndex;
}

function collectLeaves(nodes: HeaderNode[]): HeaderNode[] {
  const leaves: HeaderNode[] = [];
  
  function traverse(node: HeaderNode) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return leaves;
}

function formatLabel(facet: FacetConfig, value: string): string {
  if (facet.axis === 'T') {
    // Format time values nicely
    if (facet.id === 'month') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = parseInt(value, 10) - 1;
      return monthNames[monthIndex] || value;
    }
  }
  return value;
}
```

---

## 4. D3.js Rendering

### 4.1 SuperStack Renderer Class

```typescript
// renderers/superstack-renderer.ts

import * as d3 from 'd3';
import type {
  HeaderTree,
  HeaderNode,
  SuperStackDimensions,
} from '../types/superstack';

export class SuperStackRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private rowHeaderGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private colHeaderGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private dimensions: SuperStackDimensions;
  
  // Callbacks
  private onHeaderClick?: (node: HeaderNode) => void;
  private onHeaderCollapse?: (node: HeaderNode) => void;
  
  constructor(
    container: HTMLElement,
    dimensions: SuperStackDimensions
  ) {
    this.dimensions = dimensions;
    
    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('class', 'superstack');
    
    // Create header groups
    this.rowHeaderGroup = this.svg.append('g')
      .attr('class', 'row-headers');
    
    this.colHeaderGroup = this.svg.append('g')
      .attr('class', 'col-headers');
  }
  
  /**
   * Render the complete SuperStack headers
   */
  render(rowTree: HeaderTree, colTree: HeaderTree): void {
    // Calculate total dimensions
    const rowHeaderWidth = rowTree.maxDepth * this.dimensions.rowHeaderLevelWidth;
    const colHeaderHeight = colTree.maxDepth * this.dimensions.colHeaderLevelHeight;
    const dataWidth = colTree.leafCount * this.dimensions.cellMinWidth * this.dimensions.zoom;
    const dataHeight = rowTree.leafCount * this.dimensions.cellMinHeight * this.dimensions.zoom;
    
    // Size SVG
    this.svg
      .attr('width', rowHeaderWidth + dataWidth)
      .attr('height', colHeaderHeight + dataHeight);
    
    // Position header groups
    this.colHeaderGroup.attr('transform', `translate(${rowHeaderWidth}, 0)`);
    this.rowHeaderGroup.attr('transform', `translate(0, ${colHeaderHeight})`);
    
    // Render headers
    this.renderColumnHeaders(colTree);
    this.renderRowHeaders(rowTree);
  }
  
  /**
   * Render column headers (horizontal, multi-level)
   */
  private renderColumnHeaders(tree: HeaderTree): void {
    const levelHeight = this.dimensions.colHeaderLevelHeight;
    const cellWidth = this.dimensions.cellMinWidth * this.dimensions.zoom;
    
    // Flatten all nodes with their depths
    const allNodes = this.flattenTree(tree.roots);
    
    // Bind data
    const headers = this.colHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.col-header')
      .data(allNodes, d => d.id);
    
    // Enter
    const headersEnter = headers.enter()
      .append('g')
      .attr('class', 'col-header')
      .attr('data-depth', d => d.depth)
      .attr('data-id', d => d.id);
    
    headersEnter.append('rect')
      .attr('class', 'header-bg');
    
    headersEnter.append('text')
      .attr('class', 'header-label');
    
    headersEnter.append('text')
      .attr('class', 'header-count');
    
    // Collapse indicator for non-leaf nodes
    headersEnter.filter(d => d.children.length > 0)
      .append('path')
      .attr('class', 'collapse-indicator');
    
    // Enter + Update
    const headersMerge = headersEnter.merge(headers);
    
    headersMerge
      .attr('transform', d => {
        const x = d.startIndex * cellWidth;
        const y = d.depth * levelHeight;
        return `translate(${x}, ${y})`;
      })
      .classed('collapsed', d => d.collapsed)
      .classed('selected', d => d.id === this.selectedId);
    
    headersMerge.select('.header-bg')
      .attr('width', d => d.span * cellWidth)
      .attr('height', levelHeight)
      .attr('fill', d => this.getHeaderColor(d))
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);
    
    headersMerge.select('.header-label')
      .attr('x', d => (d.span * cellWidth) / 2)
      .attr('y', levelHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .text(d => this.truncateLabel(d.label, d.span * cellWidth - 20));
    
    headersMerge.select('.header-count')
      .attr('x', d => d.span * cellWidth - 8)
      .attr('y', levelHeight - 6)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', '#888')
      .text(d => d.aggregate?.count || '');
    
    // Collapse indicator
    headersMerge.select('.collapse-indicator')
      .attr('d', d => d.collapsed ? 'M4,0 L8,4 L4,8' : 'M0,4 L8,4')
      .attr('transform', `translate(4, ${levelHeight/2 - 4})`)
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);
    
    // Exit
    headers.exit().remove();
    
    // Event handlers
    headersMerge.on('click', (event, d) => {
      event.stopPropagation();
      if (d.children.length > 0 && event.target.classList.contains('collapse-indicator')) {
        this.onHeaderCollapse?.(d);
      } else {
        this.onHeaderClick?.(d);
      }
    });
  }
  
  /**
   * Render row headers (vertical, multi-level)
   */
  private renderRowHeaders(tree: HeaderTree): void {
    const levelWidth = this.dimensions.rowHeaderLevelWidth;
    const cellHeight = this.dimensions.cellMinHeight * this.dimensions.zoom;
    
    const allNodes = this.flattenTree(tree.roots);
    
    const headers = this.rowHeaderGroup
      .selectAll<SVGGElement, HeaderNode>('.row-header')
      .data(allNodes, d => d.id);
    
    const headersEnter = headers.enter()
      .append('g')
      .attr('class', 'row-header')
      .attr('data-depth', d => d.depth)
      .attr('data-id', d => d.id);
    
    headersEnter.append('rect')
      .attr('class', 'header-bg');
    
    headersEnter.append('text')
      .attr('class', 'header-label');
    
    headersEnter.append('text')
      .attr('class', 'header-count');
    
    headersEnter.filter(d => d.children.length > 0)
      .append('path')
      .attr('class', 'collapse-indicator');
    
    const headersMerge = headersEnter.merge(headers);
    
    headersMerge
      .attr('transform', d => {
        const x = d.depth * levelWidth;
        const y = d.startIndex * cellHeight;
        return `translate(${x}, ${y})`;
      })
      .classed('collapsed', d => d.collapsed)
      .classed('selected', d => d.id === this.selectedId);
    
    headersMerge.select('.header-bg')
      .attr('width', levelWidth)
      .attr('height', d => d.span * cellHeight)
      .attr('fill', d => this.getHeaderColor(d))
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);
    
    // Row labels are left-aligned with padding
    headersMerge.select('.header-label')
      .attr('x', 8)
      .attr('y', d => Math.min(14, (d.span * cellHeight) / 2))
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .text(d => this.truncateLabel(d.label, levelWidth - 24));
    
    // Count badge on the right
    headersMerge.select('.header-count')
      .attr('x', levelWidth - 8)
      .attr('y', d => Math.min(14, (d.span * cellHeight) / 2))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#888')
      .text(d => d.aggregate?.count || '');
    
    // Collapse indicator (rotated for row headers)
    headersMerge.select('.collapse-indicator')
      .attr('d', d => d.collapsed ? 'M0,4 L4,0 L8,4' : 'M0,0 L4,4 L8,0')
      .attr('transform', d => `translate(${levelWidth - 16}, ${Math.min(10, (d.span * cellHeight) / 2 - 4)})`)
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);
    
    headers.exit().remove();
    
    headersMerge.on('click', (event, d) => {
      event.stopPropagation();
      if (d.children.length > 0 && event.target.classList.contains('collapse-indicator')) {
        this.onHeaderCollapse?.(d);
      } else {
        this.onHeaderClick?.(d);
      }
    });
  }
  
  /**
   * Flatten tree for D3 data binding
   */
  private flattenTree(nodes: HeaderNode[]): HeaderNode[] {
    const result: HeaderNode[] = [];
    
    function traverse(node: HeaderNode) {
      result.push(node);
      if (!node.collapsed) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    
    for (const node of nodes) {
      traverse(node);
    }
    
    return result;
  }
  
  /**
   * Get background color based on depth
   */
  private getHeaderColor(node: HeaderNode): string {
    const colors = ['#f8f9fa', '#f1f3f4', '#e8eaed', '#dadce0', '#d2d5d9'];
    return colors[Math.min(node.depth, colors.length - 1)];
  }
  
  /**
   * Truncate label to fit width
   */
  private truncateLabel(label: string, maxWidth: number): string {
    // Rough estimate: 7px per character
    const maxChars = Math.floor(maxWidth / 7);
    if (label.length <= maxChars) return label;
    return label.substring(0, maxChars - 1) + '…';
  }
  
  /**
   * Set callbacks
   */
  setCallbacks(callbacks: {
    onHeaderClick?: (node: HeaderNode) => void;
    onHeaderCollapse?: (node: HeaderNode) => void;
  }): void {
    this.onHeaderClick = callbacks.onHeaderClick;
    this.onHeaderCollapse = callbacks.onHeaderCollapse;
  }
  
  /**
   * Update dimensions and re-render
   */
  setDimensions(dimensions: SuperStackDimensions): void {
    this.dimensions = dimensions;
  }
  
  /**
   * Track selected header
   */
  private selectedId: string | null = null;
  
  setSelected(id: string | null): void {
    this.selectedId = id;
    // Trigger visual update
    this.rowHeaderGroup.selectAll('.row-header')
      .classed('selected', d => (d as HeaderNode).id === id);
    this.colHeaderGroup.selectAll('.col-header')
      .classed('selected', d => (d as HeaderNode).id === id);
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.svg.remove();
  }
}
```

### 4.2 CSS Styles

```css
/* styles/superstack.css */

.superstack {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Headers */
.row-header,
.col-header {
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.row-header:hover .header-bg,
.col-header:hover .header-bg {
  filter: brightness(0.95);
}

.row-header.selected .header-bg,
.col-header.selected .header-bg {
  fill: #e3f2fd !important;
  stroke: #1976d2 !important;
  stroke-width: 2px !important;
}

.header-label {
  pointer-events: none;
  user-select: none;
}

.header-count {
  pointer-events: none;
  user-select: none;
  opacity: 0.7;
}

/* Collapse indicator */
.collapse-indicator {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.collapse-indicator:hover {
  stroke: #1976d2;
}

.collapsed .collapse-indicator {
  transform: rotate(0deg);
}

/* Depth-based indentation visual */
.row-header[data-depth="1"] .header-label {
  font-size: 11px;
}

.row-header[data-depth="2"] .header-label {
  font-size: 10px;
}

/* Subtle depth hierarchy */
.col-header[data-depth="0"] .header-bg {
  fill: #e8eaed;
}

.col-header[data-depth="1"] .header-bg {
  fill: #f1f3f4;
}

.col-header[data-depth="2"] .header-bg {
  fill: #f8f9fa;
}
```

---

## 5. Interactions

### 5.1 Collapse/Expand

```typescript
// interactions/collapse.ts

export function handleCollapse(
  node: HeaderNode,
  tree: HeaderTree,
  setState: (tree: HeaderTree) => void
): void {
  // Toggle collapsed state
  node.collapsed = !node.collapsed;
  
  // Recalculate spans and indices
  recalculateTree(tree);
  
  // Trigger re-render
  setState({ ...tree });
}

function recalculateTree(tree: HeaderTree): void {
  let currentIndex = 0;
  
  function traverse(node: HeaderNode): number {
    node.startIndex = currentIndex;
    
    if (node.collapsed || node.children.length === 0) {
      // Collapsed or leaf: span is 1
      node.span = 1;
      currentIndex += 1;
      return 1;
    }
    
    // Not collapsed: sum children
    let totalSpan = 0;
    for (const child of node.children) {
      totalSpan += traverse(child);
    }
    node.span = totalSpan;
    return totalSpan;
  }
  
  for (const root of tree.roots) {
    traverse(root);
  }
  
  tree.leafCount = currentIndex;
  tree.leaves = collectVisibleLeaves(tree.roots);
}

function collectVisibleLeaves(nodes: HeaderNode[]): HeaderNode[] {
  const leaves: HeaderNode[] = [];
  
  function traverse(node: HeaderNode) {
    if (node.collapsed || node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return leaves;
}
```

### 5.2 Click-to-Filter

```typescript
// interactions/filter.ts

export function handleHeaderClick(
  node: HeaderNode,
  currentFilters: Filter[],
  setFilters: (filters: Filter[]) => void
): void {
  // Build filter from header path
  const pathFilters: Filter[] = node.path.map((value, index) => {
    const facet = node.facet;  // Need to track facet at each level
    return {
      facetId: facet.id,
      operator: 'eq',
      value,
    };
  });
  
  // Replace or add to filters
  // Option 1: Replace all filters with this path
  setFilters(pathFilters);
  
  // Option 2: Toggle filter (if clicking same header, remove filter)
  // ... more complex logic
}

export interface Filter {
  facetId: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'between';
  value: string | number | [number, number];
}
```

### 5.3 Resize Columns/Rows

```typescript
// interactions/resize.ts

export function setupResizeHandlers(
  renderer: SuperStackRenderer,
  onDimensionsChange: (dims: SuperStackDimensions) => void
): void {
  // Add resize handles to leaf headers
  // ... implementation with d3.drag()
}
```

---

## 6. Implementation Phases

### Phase 1: Static Headers (Week 1)

**Goal:** Render non-interactive headers from hardcoded data.

**Tasks:**
1. [ ] Create type definitions (`types/superstack.ts`)
2. [ ] Create tree builder from mock data (`builders/header-tree-builder.ts`)
3. [ ] Create basic renderer (`renderers/superstack-renderer.ts`)
4. [ ] Render column headers with correct spans
5. [ ] Render row headers with correct spans
6. [ ] Add basic CSS styling

**Verification:**
```typescript
// test/superstack-static.test.ts
test('renders 3-level column headers', () => {
  const tree = buildHeaderTree(mockData, [yearFacet, quarterFacet, monthFacet], 'column');
  expect(tree.maxDepth).toBe(3);
  expect(tree.roots[0].span).toBe(12);  // Year spans 12 months
});
```

**Deliverable:** Visual rendering of nested headers with correct positioning.

---

### Phase 2: SQL Integration (Week 2)

**Goal:** Build headers from live SQLite queries.

**Tasks:**
1. [ ] Create header discovery query builder
2. [ ] Integrate with sql.js database layer
3. [ ] Handle multi_select facets (json_each)
4. [ ] Handle time facets (strftime)
5. [ ] Add loading states
6. [ ] Add error handling

**Verification:**
```typescript
test('discovers headers from SQLite', async () => {
  const query = buildHeaderDiscoveryQuery(
    [COMMON_FACETS.folder, COMMON_FACETS.tags],
    [COMMON_FACETS.year, COMMON_FACETS.month]
  );
  const rows = await db.query(query);
  const tree = buildHeaderTree(rows, ...);
  expect(tree.roots.length).toBeGreaterThan(0);
});
```

**Deliverable:** Headers built from actual database content.

---

### Phase 3: Interactions (Week 3)

**Goal:** Click, collapse, and filter behaviors.

**Tasks:**
1. [ ] Collapse/expand headers
2. [ ] Recalculate spans on collapse
3. [ ] Click header to filter data cells
4. [ ] Highlight selected header
5. [ ] Keyboard navigation (arrow keys)
6. [ ] Touch support

**Verification:**
```typescript
test('collapse updates spans correctly', () => {
  const tree = buildHeaderTree(mockData, facets, 'row');
  const workNode = tree.roots.find(n => n.value === 'Work');
  
  expect(workNode.span).toBe(3);  // 3 tags
  
  handleCollapse(workNode, tree, () => {});
  
  expect(workNode.span).toBe(1);  // Collapsed
  expect(tree.leafCount).toBeLessThan(originalLeafCount);
});
```

**Deliverable:** Interactive headers with collapse and filter.

---

### Phase 4: Integration with Data Cells (Week 4)

**Goal:** SuperStack + Data Cells = SuperGrid.

**Tasks:**
1. [ ] Create data cell renderer
2. [ ] Position data cells relative to leaf headers
3. [ ] Coordinate scroll between headers and data
4. [ ] Handle density-based rendering (counts vs cards)
5. [ ] Sync selection between headers and cells

**Verification:**
```typescript
test('data cells align with headers', () => {
  const colLeaves = colTree.leaves;
  const rowLeaves = rowTree.leaves;
  
  const cell = getDataCell(rowLeaves[0], colLeaves[0]);
  expect(cell.x).toBe(colLeaves[0].startIndex * cellWidth);
  expect(cell.y).toBe(rowLeaves[0].startIndex * cellHeight);
});
```

**Deliverable:** Complete SuperGrid with headers and data cells.

---

### Phase 5: Polish (Week 5)

**Goal:** Performance, accessibility, edge cases.

**Tasks:**
1. [ ] Virtual scrolling for large datasets
2. [ ] Sticky headers while scrolling
3. [ ] ARIA labels for accessibility
4. [ ] Empty state handling
5. [ ] Performance profiling (>1000 cells)
6. [ ] Animation on collapse/expand
7. [ ] Drag-to-resize headers

**Deliverable:** Production-ready SuperStack.

---

## 7. Testing Strategy

### Unit Tests

```typescript
// test/header-tree-builder.test.ts

describe('HeaderTreeBuilder', () => {
  describe('buildHeaderTree', () => {
    it('creates roots for each unique first-level value', () => {
      const rows = [
        { folder: 'Work', tags: '#meetings', year: '2024', month: '01', card_count: 5 },
        { folder: 'Work', tags: '#planning', year: '2024', month: '01', card_count: 3 },
        { folder: 'Personal', tags: '#journal', year: '2024', month: '01', card_count: 31 },
      ];
      
      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');
      
      expect(tree.roots).toHaveLength(2);
      expect(tree.roots[0].value).toBe('Personal');
      expect(tree.roots[1].value).toBe('Work');
    });
    
    it('calculates spans correctly', () => {
      const rows = [
        { folder: 'Work', tags: '#a', year: '2024', month: '01', card_count: 1 },
        { folder: 'Work', tags: '#b', year: '2024', month: '01', card_count: 1 },
        { folder: 'Work', tags: '#c', year: '2024', month: '01', card_count: 1 },
      ];
      
      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');
      
      expect(tree.roots[0].span).toBe(3);
      expect(tree.roots[0].children[0].span).toBe(1);
    });
    
    it('accumulates counts up the tree', () => {
      const rows = [
        { folder: 'Work', tags: '#a', year: '2024', month: '01', card_count: 10 },
        { folder: 'Work', tags: '#b', year: '2024', month: '01', card_count: 20 },
      ];
      
      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');
      
      expect(tree.roots[0].aggregate?.count).toBe(30);
    });
  });
});
```

### Visual Tests

```typescript
// test/superstack-renderer.visual.test.ts

import { toMatchImageSnapshot } from 'jest-image-snapshot';

describe('SuperStackRenderer', () => {
  it('renders column headers correctly', async () => {
    const container = document.createElement('div');
    const renderer = new SuperStackRenderer(container, DEFAULT_DIMENSIONS);
    
    renderer.render(mockRowTree, mockColTree);
    
    const screenshot = await takeScreenshot(container);
    expect(screenshot).toMatchImageSnapshot();
  });
});
```

### Integration Tests

```typescript
// test/superstack-integration.test.ts

describe('SuperStack Integration', () => {
  let db: Database;
  
  beforeEach(async () => {
    db = await initializeTestDatabase();
    await seedTestData(db);
  });
  
  it('builds headers from database and renders', async () => {
    const rows = await db.query(buildHeaderDiscoveryQuery(...));
    const rowTree = buildHeaderTree(rows, rowFacets, 'row');
    const colTree = buildHeaderTree(rows, colFacets, 'column');
    
    const container = document.createElement('div');
    const renderer = new SuperStackRenderer(container, DEFAULT_DIMENSIONS);
    renderer.render(rowTree, colTree);
    
    expect(container.querySelectorAll('.row-header').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.col-header').length).toBeGreaterThan(0);
  });
});
```

---

## 8. File Structure

```
src/
├── superstack/
│   ├── types/
│   │   └── superstack.ts           # All type definitions
│   │
│   ├── config/
│   │   └── superstack-defaults.ts  # Default dimensions, common facets
│   │
│   ├── queries/
│   │   └── header-discovery.ts     # SQL query builders
│   │
│   ├── builders/
│   │   └── header-tree-builder.ts  # Transform rows → tree
│   │
│   ├── renderers/
│   │   └── superstack-renderer.ts  # D3.js rendering
│   │
│   ├── interactions/
│   │   ├── collapse.ts             # Expand/collapse logic
│   │   ├── filter.ts               # Click-to-filter
│   │   └── resize.ts               # Resize headers
│   │
│   ├── styles/
│   │   └── superstack.css          # Styles
│   │
│   └── index.ts                    # Public exports
│
├── test/
│   ├── superstack/
│   │   ├── header-tree-builder.test.ts
│   │   ├── superstack-renderer.test.ts
│   │   └── superstack-integration.test.ts
│   │
│   └── fixtures/
│       └── mock-data.ts            # Test data
```

---

## 9. Success Criteria

### Phase 1 Complete When:
- [ ] Static headers render with correct nested structure
- [ ] Column headers span correctly (Year spans 12 months)
- [ ] Row headers span correctly (Folder spans all tags)
- [ ] Visual appearance matches mockup
- [ ] No console errors

### Phase 2 Complete When:
- [ ] Headers build from SQLite query results
- [ ] Time facets extract correctly (year, month)
- [ ] Multi-select facets (tags) explode correctly
- [ ] Empty facets handled gracefully
- [ ] Query completes in <100ms for 10K cards

### Phase 3 Complete When:
- [ ] Click header highlights it
- [ ] Click collapse icon collapses children
- [ ] Spans recalculate on collapse
- [ ] Filter callback fires with correct path
- [ ] Keyboard navigation works

### Phase 4 Complete When:
- [ ] Data cells render in correct positions
- [ ] Cells align with leaf headers
- [ ] Scrolling keeps headers visible
- [ ] Density slider affects cell rendering
- [ ] Click cell shows cards

### Phase 5 Complete When:
- [ ] 10K cells render smoothly (>30fps)
- [ ] ARIA attributes present
- [ ] Empty states display message
- [ ] Collapse/expand animates
- [ ] Headers resize with drag

---

## Appendix A: Mock Data for Testing

```typescript
// test/fixtures/mock-data.ts

export const MOCK_QUERY_ROWS = [
  { folder: 'Work', tags: '#meetings', year: '2024', month: '07', card_count: 5 },
  { folder: 'Work', tags: '#meetings', year: '2024', month: '08', card_count: 8 },
  { folder: 'Work', tags: '#meetings', year: '2024', month: '09', card_count: 6 },
  { folder: 'Work', tags: '#planning', year: '2024', month: '07', card_count: 2 },
  { folder: 'Work', tags: '#planning', year: '2024', month: '08', card_count: 3 },
  { folder: 'Work', tags: '#ideas', year: '2024', month: '07', card_count: 8 },
  { folder: 'Personal', tags: '#journal', year: '2024', month: '07', card_count: 31 },
  { folder: 'Personal', tags: '#journal', year: '2024', month: '08', card_count: 31 },
  { folder: 'Personal', tags: '#reading', year: '2024', month: '07', card_count: 4 },
];

export const ROW_FACETS: FacetConfig[] = [
  COMMON_FACETS.folder,
  COMMON_FACETS.tags,
];

export const COL_FACETS: FacetConfig[] = [
  COMMON_FACETS.year,
  COMMON_FACETS.month,
];
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **SuperStack** | The nested header system for SuperGrid |
| **Header Tree** | Hierarchical structure of HeaderNodes |
| **Span** | Number of leaf cells a header covers |
| **Depth** | Level in hierarchy (0 = root) |
| **Leaf** | Bottom-level header with no children |
| **Facet** | LATCH attribute used for grouping |
| **Path** | Array of values from root to node |

---

*End of SuperStack Implementation Plan*
