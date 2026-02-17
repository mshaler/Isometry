# SuperGrid React + CSS Grid Specification

*Version 1.0 — Pure React Implementation*

---

## Executive Summary

SuperGrid is a polymorphic pivot table component that renders hierarchical LATCH data as a spreadsheet-style grid. This specification replaces the D3.js-based rendering approach with **pure React + CSS Grid**, enabling simpler code, better accessibility, and native browser layout handling for cell spanning.

**Key Decision: D3.js is removed from SuperGrid rendering.** D3 remains available for Charts, Network views, and force simulations—but tabular grid rendering uses CSS Grid exclusively.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SuperGrid Component                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    useGridLayout Hook                        │   │
│  │  • Computes grid dimensions from hierarchical data           │   │
│  │  • Calculates rowspan/colspan for each header cell           │   │
│  │  • Returns CSS Grid template strings                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Grid Container                           │   │
│  │  display: grid                                               │   │
│  │  grid-template-columns: [computed]                           │   │
│  │  grid-template-rows: [computed]                              │   │
│  │                                                              │   │
│  │  ┌──────────┬──────────┬────────────────────────────────┐   │   │
│  │  │ MiniNav  │ MiniNav  │    ColumnHeaders               │   │   │
│  │  │ Corner   │ Corner   │    (spanning cells)            │   │   │
│  │  ├──────────┼──────────┼────────────────────────────────┤   │   │
│  │  │          │          │                                │   │   │
│  │  │   Row    │   Row    │                                │   │   │
│  │  │ Headers  │ Headers  │        Data Cells              │   │   │
│  │  │(spanning)│(spanning)│     (grid of values)           │   │   │
│  │  │          │          │                                │   │   │
│  │  └──────────┴──────────┴────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Zone Definitions (from Reference Image)

| Zone ID | Name | Grid Position | Purpose | Background |
|---------|------|---------------|---------|------------|
| `corner` | MiniNav Corner | rows 1→R, cols 1→C | Navigation controls, facet selectors | Cyan (`#00CED1`) |
| `col-headers` | Column Headers | rows 1→R, cols C+1→end | Time/Category hierarchy (horizontal) | Yellow→Orange gradient |
| `row-headers` | Row Headers | rows R+1→end, cols 1→C | Category hierarchy (vertical) | Green (`#90EE90`) |
| `data` | Data Cells | rows R+1→end, cols C+1→end | Actual values/cards | Orange (`#FFA500`) |

Where:
- `R` = number of column header rows (depth of column hierarchy)
- `C` = number of row header columns (depth of row hierarchy)

---

## Data Model

### Input: HierarchicalData

```typescript
// The PAFV-aligned data structure SuperGrid consumes

interface SuperGridProps {
  /** Row axis hierarchy (maps to Y plane) */
  rowAxis: AxisConfig;
  
  /** Column axis hierarchy (maps to X plane) */
  columnAxis: AxisConfig;
  
  /** The actual data values */
  data: DataCell[];
  
  /** Optional: Custom cell renderer */
  renderCell?: (cell: DataCell, row: RowPath, col: ColPath) => React.ReactNode;
  
  /** Optional: Theme configuration */
  theme?: SuperGridTheme;
}

interface AxisConfig {
  /** LATCH axis type */
  type: 'L' | 'A' | 'T' | 'C' | 'H';
  
  /** Facet being displayed */
  facet: string;
  
  /** Hierarchical tree of values */
  tree: AxisNode;
}

interface AxisNode {
  /** Display label */
  label: string;
  
  /** Unique identifier */
  id: string;
  
  /** Child nodes (if any) */
  children?: AxisNode[];
  
  /** Leaf count (computed) - used for spanning */
  leafCount?: number;
  
  /** Is this expandable? (has hidden children) */
  expandable?: boolean;
}

interface DataCell {
  /** Row path: array of IDs from root to leaf */
  rowPath: string[];
  
  /** Column path: array of IDs from root to leaf */
  colPath: string[];
  
  /** Cell value (display) */
  value: string | number | null;
  
  /** Optional: Raw value for calculations */
  rawValue?: unknown;
  
  /** Optional: Cell-specific styling */
  style?: React.CSSProperties;
}

type RowPath = string[];
type ColPath = string[];
```

### Example Data (from Reference Image)

```typescript
const exampleRowAxis: AxisConfig = {
  type: 'C',
  facet: 'category',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'FutureME',
        id: 'futureme',
        children: [
          {
            label: 'Learning',
            id: 'learning',
            children: [
              { label: 'Tools', id: 'tools' },
              { label: 'Progress', id: 'progress' },
              { label: 'Reference', id: 'reference' },
              { label: 'Community', id: 'community' },
            ]
          },
          {
            label: 'Growth',
            id: 'growth',
            children: [
              { label: 'Fitness', id: 'fitness' },
              { label: 'Health', id: 'health' },
              { label: 'Play', id: 'play' },
              { label: 'Travel', id: 'travel' },
            ]
          },
          {
            label: 'Writing',
            id: 'writing',
            children: [
              { label: 'Novels', id: 'novels' },
              { label: 'Poetry', id: 'poetry' },
              { label: 'Essays', id: 'essays' },
              { label: 'Photos', id: 'photos' },
            ]
          }
        ]
      },
      {
        label: 'Home',
        id: 'home',
        children: [
          {
            label: 'Family',
            id: 'family',
            children: [
              { label: 'Alex', id: 'alex' },
              { label: 'Stacey', id: 'stacey' },
              { label: 'Extended family', id: 'extended' },
              { label: 'Friends', id: 'friends' },
            ]
          },
          {
            label: 'House',
            id: 'house',
            children: [
              { label: 'Garage+', id: 'garage' },
              { label: 'Interior+', id: 'interior' },
              { label: 'Kitchen+', id: 'kitchen' },
              { label: 'HVAC+', id: 'hvac' },
              { label: 'Bathrooms+', id: 'bathrooms' },
            ]
          },
          {
            label: 'Money+',
            id: 'money',
            children: [
              { label: 'Mortgage', id: 'mortgage' },
              { label: 'Retirement', id: 'retirement' },
              { label: 'Tuition', id: 'tuition' },
            ]
          }
        ]
      },
      {
        label: 'Work',
        id: 'work',
        children: [
          {
            label: 'PlanB',
            id: 'planb',
            children: [
              { label: 'Executive', id: 'executive' },
              { label: 'Consulting', id: 'consulting' },
            ]
          },
          {
            label: 'BairesDev',
            id: 'bairesdev',
            children: [
              { label: 'Opportunities', id: 'opportunities' },
              { label: 'Operations', id: 'operations' },
            ]
          }
        ]
      }
    ]
  }
};

const exampleColumnAxis: AxisConfig = {
  type: 'T',
  facet: 'year_quarter',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: '2022',
        id: '2022',
        children: [
          { label: 'Q1', id: '2022-q1' },
          { label: 'Q2', id: '2022-q2' },
          { label: 'Q3', id: '2022-q3' },
          { label: 'Q4', id: '2022-q4' },
        ]
      }
    ]
  }
};
```

---

## Grid Layout Algorithm

### Step 1: Compute Tree Metrics

```typescript
interface TreeMetrics {
  /** Maximum depth of the tree (for header row/column count) */
  depth: number;
  
  /** Total leaf count (for data row/column count) */
  leafCount: number;
  
  /** Flattened nodes with computed positions */
  flatNodes: FlatNode[];
}

interface FlatNode {
  node: AxisNode;
  depth: number;           // 0-indexed depth in tree
  leafStart: number;       // First leaf index this node spans
  leafCount: number;       // Number of leaves this node spans
  path: string[];          // ID path from root
}

function computeTreeMetrics(root: AxisNode): TreeMetrics {
  const flatNodes: FlatNode[] = [];
  
  function traverse(
    node: AxisNode, 
    depth: number, 
    leafStart: number,
    path: string[]
  ): number {
    const currentPath = [...path, node.id];
    
    if (!node.children || node.children.length === 0) {
      // Leaf node
      flatNodes.push({
        node,
        depth,
        leafStart,
        leafCount: 1,
        path: currentPath
      });
      return 1;
    }
    
    // Internal node - traverse children
    let totalLeaves = 0;
    for (const child of node.children) {
      totalLeaves += traverse(child, depth + 1, leafStart + totalLeaves, currentPath);
    }
    
    flatNodes.push({
      node,
      depth,
      leafStart,
      leafCount: totalLeaves,
      path: currentPath
    });
    
    return totalLeaves;
  }
  
  // Skip the virtual root, start with its children
  let leafStart = 0;
  let maxDepth = 0;
  
  for (const child of root.children || []) {
    const leaves = traverse(child, 0, leafStart, []);
    leafStart += leaves;
  }
  
  // Find max depth
  for (const fn of flatNodes) {
    maxDepth = Math.max(maxDepth, fn.depth);
  }
  
  return {
    depth: maxDepth + 1,  // Convert 0-indexed to count
    leafCount: leafStart,
    flatNodes
  };
}
```

### Step 2: Generate CSS Grid Placement

```typescript
interface GridPlacement {
  gridRowStart: number;
  gridRowEnd: number;
  gridColumnStart: number;
  gridColumnEnd: number;
}

// For ROW headers (vertical spanning)
function computeRowHeaderPlacement(
  flatNode: FlatNode,
  colHeaderDepth: number,  // R: number of column header rows
  rowHeaderDepth: number   // C: number of row header columns
): GridPlacement {
  // Row headers start after column headers
  const dataRowStart = colHeaderDepth + 1;
  
  return {
    // Column position: based on node depth (0 → col 1, 1 → col 2, etc.)
    gridColumnStart: flatNode.depth + 1,
    gridColumnEnd: flatNode.depth + 2,
    
    // Row position: based on leaf span
    gridRowStart: dataRowStart + flatNode.leafStart,
    gridRowEnd: dataRowStart + flatNode.leafStart + flatNode.leafCount
  };
}

// For COLUMN headers (horizontal spanning)  
function computeColHeaderPlacement(
  flatNode: FlatNode,
  rowHeaderDepth: number  // C: number of row header columns
): GridPlacement {
  // Column headers start after row header columns
  const dataColStart = rowHeaderDepth + 1;
  
  return {
    // Row position: based on node depth (0 → row 1, 1 → row 2, etc.)
    gridRowStart: flatNode.depth + 1,
    gridRowEnd: flatNode.depth + 2,
    
    // Column position: based on leaf span
    gridColumnStart: dataColStart + flatNode.leafStart,
    gridColumnEnd: dataColStart + flatNode.leafStart + flatNode.leafCount
  };
}

// For DATA cells
function computeDataCellPlacement(
  rowLeafIndex: number,
  colLeafIndex: number,
  colHeaderDepth: number,  // R
  rowHeaderDepth: number   // C
): GridPlacement {
  return {
    gridRowStart: colHeaderDepth + 1 + rowLeafIndex,
    gridRowEnd: colHeaderDepth + 2 + rowLeafIndex,
    gridColumnStart: rowHeaderDepth + 1 + colLeafIndex,
    gridColumnEnd: rowHeaderDepth + 2 + colLeafIndex
  };
}
```

### Step 3: Generate Grid Template

```typescript
function generateGridTemplate(
  rowMetrics: TreeMetrics,
  colMetrics: TreeMetrics,
  options: {
    headerColumnWidth?: string;
    headerRowHeight?: string;
    dataColumnWidth?: string;
    dataRowHeight?: string;
  } = {}
): { columns: string; rows: string } {
  const {
    headerColumnWidth = '120px',
    headerRowHeight = '32px',
    dataColumnWidth = '80px',
    dataRowHeight = '32px'
  } = options;
  
  // Columns: [rowHeaderDepth header columns] + [colLeafCount data columns]
  const columns = [
    ...Array(rowMetrics.depth).fill(headerColumnWidth),
    ...Array(colMetrics.leafCount).fill(dataColumnWidth)
  ].join(' ');
  
  // Rows: [colHeaderDepth header rows] + [rowLeafCount data rows]
  const rows = [
    ...Array(colMetrics.depth).fill(headerRowHeight),
    ...Array(rowMetrics.leafCount).fill(dataRowHeight)
  ].join(' ');
  
  return { columns, rows };
}
```

---

## React Component Implementation

### File Structure

```
src/components/SuperGrid/
├── index.ts                    # Public exports
├── SuperGrid.tsx               # Main component
├── SuperGridContext.tsx        # Context for theme/callbacks
├── hooks/
│   ├── useGridLayout.ts        # Layout computation hook
│   └── useGridSelection.ts     # Selection state hook
├── components/
│   ├── GridContainer.tsx       # CSS Grid container
│   ├── CornerCell.tsx          # MiniNav corner cells
│   ├── RowHeader.tsx           # Row header cell
│   ├── ColHeader.tsx           # Column header cell
│   ├── DataCell.tsx            # Data cell
│   └── ResizeHandle.tsx        # Column/row resize
├── utils/
│   ├── treeMetrics.ts          # Tree computation functions
│   └── gridPlacement.ts        # CSS Grid placement functions
├── types.ts                    # TypeScript interfaces
└── styles/
    ├── SuperGrid.module.css    # Scoped styles
    └── themes/
        ├── nextstep.css        # NeXTSTEP theme
        └── modern.css          # Modern theme
```

### SuperGrid.tsx (Main Component)

```tsx
import React, { useMemo } from 'react';
import { useGridLayout } from './hooks/useGridLayout';
import { GridContainer } from './components/GridContainer';
import { CornerCell } from './components/CornerCell';
import { RowHeader } from './components/RowHeader';
import { ColHeader } from './components/ColHeader';
import { DataCell } from './components/DataCell';
import { SuperGridProvider } from './SuperGridContext';
import type { SuperGridProps } from './types';
import styles from './styles/SuperGrid.module.css';

export const SuperGrid: React.FC<SuperGridProps> = ({
  rowAxis,
  columnAxis,
  data,
  renderCell,
  theme = 'nextstep',
  onCellClick,
  onHeaderClick,
  onSelectionChange,
}) => {
  // Compute grid layout from hierarchical data
  const layout = useGridLayout(rowAxis, columnAxis);
  
  // Build lookup map for data cells
  const dataMap = useMemo(() => {
    const map = new Map<string, DataCell>();
    for (const cell of data) {
      const key = `${cell.rowPath.join('/')}::${cell.colPath.join('/')}`;
      map.set(key, cell);
    }
    return map;
  }, [data]);
  
  // Get data cell by path
  const getCell = (rowPath: string[], colPath: string[]) => {
    const key = `${rowPath.join('/')}::${colPath.join('/')}`;
    return dataMap.get(key);
  };
  
  return (
    <SuperGridProvider theme={theme} onCellClick={onCellClick}>
      <div 
        className={`${styles.superGrid} ${styles[theme]}`}
        role="grid"
        aria-label="SuperGrid data view"
      >
        <GridContainer
          columns={layout.gridTemplate.columns}
          rows={layout.gridTemplate.rows}
        >
          {/* Corner cells (MiniNav) */}
          {layout.cornerCells.map((cell, i) => (
            <CornerCell
              key={`corner-${i}`}
              placement={cell.placement}
              label={cell.label}
            />
          ))}
          
          {/* Column headers */}
          {layout.colHeaders.map((header) => (
            <ColHeader
              key={`col-${header.node.id}`}
              node={header.node}
              placement={header.placement}
              depth={header.depth}
              onClick={() => onHeaderClick?.('column', header.path)}
            />
          ))}
          
          {/* Row headers */}
          {layout.rowHeaders.map((header) => (
            <RowHeader
              key={`row-${header.node.id}`}
              node={header.node}
              placement={header.placement}
              depth={header.depth}
              onClick={() => onHeaderClick?.('row', header.path)}
            />
          ))}
          
          {/* Data cells */}
          {layout.dataCells.map(({ rowLeaf, colLeaf, placement }) => {
            const cell = getCell(rowLeaf.path, colLeaf.path);
            return (
              <DataCell
                key={`data-${rowLeaf.path.join('-')}-${colLeaf.path.join('-')}`}
                placement={placement}
                cell={cell}
                rowPath={rowLeaf.path}
                colPath={colLeaf.path}
                renderCell={renderCell}
              />
            );
          })}
        </GridContainer>
      </div>
    </SuperGridProvider>
  );
};
```

### useGridLayout.ts (Core Hook)

```typescript
import { useMemo } from 'react';
import { computeTreeMetrics, type TreeMetrics, type FlatNode } from '../utils/treeMetrics';
import { 
  computeRowHeaderPlacement, 
  computeColHeaderPlacement,
  computeDataCellPlacement,
  generateGridTemplate,
  type GridPlacement 
} from '../utils/gridPlacement';
import type { AxisConfig } from '../types';

interface HeaderCell {
  node: AxisNode;
  placement: GridPlacement;
  depth: number;
  path: string[];
  isLeaf: boolean;
}

interface CornerCell {
  placement: GridPlacement;
  label: string;
  row: number;
  col: number;
}

interface DataCellPosition {
  rowLeaf: FlatNode;
  colLeaf: FlatNode;
  placement: GridPlacement;
}

interface GridLayout {
  rowMetrics: TreeMetrics;
  colMetrics: TreeMetrics;
  gridTemplate: { columns: string; rows: string };
  cornerCells: CornerCell[];
  rowHeaders: HeaderCell[];
  colHeaders: HeaderCell[];
  dataCells: DataCellPosition[];
}

export function useGridLayout(
  rowAxis: AxisConfig,
  colAxis: AxisConfig
): GridLayout {
  return useMemo(() => {
    // Step 1: Compute metrics for both axes
    const rowMetrics = computeTreeMetrics(rowAxis.tree);
    const colMetrics = computeTreeMetrics(colAxis.tree);
    
    const rowHeaderDepth = rowMetrics.depth;  // C: columns for row headers
    const colHeaderDepth = colMetrics.depth;  // R: rows for column headers
    
    // Step 2: Generate grid template
    const gridTemplate = generateGridTemplate(rowMetrics, colMetrics);
    
    // Step 3: Generate corner cells
    const cornerCells: CornerCell[] = [];
    for (let r = 0; r < colHeaderDepth; r++) {
      for (let c = 0; c < rowHeaderDepth; c++) {
        cornerCells.push({
          placement: {
            gridRowStart: r + 1,
            gridRowEnd: r + 2,
            gridColumnStart: c + 1,
            gridColumnEnd: c + 2
          },
          label: 'MiniNav',
          row: r,
          col: c
        });
      }
    }
    
    // Step 4: Generate row headers
    const rowHeaders: HeaderCell[] = rowMetrics.flatNodes
      .filter(fn => fn.path.length > 1) // Exclude virtual root
      .map(fn => ({
        node: fn.node,
        placement: computeRowHeaderPlacement(fn, colHeaderDepth, rowHeaderDepth),
        depth: fn.depth,
        path: fn.path,
        isLeaf: !fn.node.children || fn.node.children.length === 0
      }));
    
    // Step 5: Generate column headers
    const colHeaders: HeaderCell[] = colMetrics.flatNodes
      .filter(fn => fn.path.length > 1) // Exclude virtual root
      .map(fn => ({
        node: fn.node,
        placement: computeColHeaderPlacement(fn, rowHeaderDepth),
        depth: fn.depth,
        path: fn.path,
        isLeaf: !fn.node.children || fn.node.children.length === 0
      }));
    
    // Step 6: Generate data cell positions
    const rowLeaves = rowMetrics.flatNodes.filter(
      fn => !fn.node.children || fn.node.children.length === 0
    );
    const colLeaves = colMetrics.flatNodes.filter(
      fn => !fn.node.children || fn.node.children.length === 0
    );
    
    const dataCells: DataCellPosition[] = [];
    for (let ri = 0; ri < rowLeaves.length; ri++) {
      for (let ci = 0; ci < colLeaves.length; ci++) {
        dataCells.push({
          rowLeaf: rowLeaves[ri],
          colLeaf: colLeaves[ci],
          placement: computeDataCellPlacement(ri, ci, colHeaderDepth, rowHeaderDepth)
        });
      }
    }
    
    return {
      rowMetrics,
      colMetrics,
      gridTemplate,
      cornerCells,
      rowHeaders,
      colHeaders,
      dataCells
    };
  }, [rowAxis, colAxis]);
}
```

### GridContainer.tsx

```tsx
import React from 'react';
import styles from '../styles/SuperGrid.module.css';

interface GridContainerProps {
  columns: string;
  rows: string;
  children: React.ReactNode;
}

export const GridContainer: React.FC<GridContainerProps> = ({
  columns,
  rows,
  children
}) => {
  return (
    <div
      className={styles.gridContainer}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
      }}
    >
      {children}
    </div>
  );
};
```

### Cell Components

```tsx
// CornerCell.tsx
import React from 'react';
import type { GridPlacement } from '../utils/gridPlacement';
import styles from '../styles/SuperGrid.module.css';

interface CornerCellProps {
  placement: GridPlacement;
  label: string;
}

export const CornerCell: React.FC<CornerCellProps> = ({ placement, label }) => {
  return (
    <div
      className={styles.cornerCell}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
      }}
      role="columnheader"
    >
      {label}
    </div>
  );
};

// RowHeader.tsx
import React from 'react';
import type { AxisNode } from '../types';
import type { GridPlacement } from '../utils/gridPlacement';
import styles from '../styles/SuperGrid.module.css';

interface RowHeaderProps {
  node: AxisNode;
  placement: GridPlacement;
  depth: number;
  onClick?: () => void;
}

export const RowHeader: React.FC<RowHeaderProps> = ({ 
  node, 
  placement, 
  depth,
  onClick 
}) => {
  const isExpandable = node.expandable || (node.children && node.children.length > 0);
  
  return (
    <div
      className={`${styles.rowHeader} ${styles[`depth${depth}`]}`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
      }}
      role="rowheader"
      onClick={onClick}
      data-expandable={isExpandable}
    >
      <span className={styles.headerLabel}>{node.label}</span>
      {isExpandable && (
        <span className={styles.expandIcon}>▶</span>
      )}
    </div>
  );
};

// ColHeader.tsx
import React from 'react';
import type { AxisNode } from '../types';
import type { GridPlacement } from '../utils/gridPlacement';
import styles from '../styles/SuperGrid.module.css';

interface ColHeaderProps {
  node: AxisNode;
  placement: GridPlacement;
  depth: number;
  onClick?: () => void;
}

export const ColHeader: React.FC<ColHeaderProps> = ({ 
  node, 
  placement, 
  depth,
  onClick 
}) => {
  return (
    <div
      className={`${styles.colHeader} ${styles[`depth${depth}`]}`}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
      }}
      role="columnheader"
      onClick={onClick}
    >
      <span className={styles.headerLabel}>{node.label}</span>
    </div>
  );
};

// DataCell.tsx
import React from 'react';
import type { DataCell as DataCellType } from '../types';
import type { GridPlacement } from '../utils/gridPlacement';
import { useSuperGridContext } from '../SuperGridContext';
import styles from '../styles/SuperGrid.module.css';

interface DataCellProps {
  placement: GridPlacement;
  cell?: DataCellType;
  rowPath: string[];
  colPath: string[];
  renderCell?: (cell: DataCellType | undefined, rowPath: string[], colPath: string[]) => React.ReactNode;
}

export const DataCell: React.FC<DataCellProps> = ({
  placement,
  cell,
  rowPath,
  colPath,
  renderCell
}) => {
  const { onCellClick } = useSuperGridContext();
  
  const handleClick = () => {
    onCellClick?.(cell, rowPath, colPath);
  };
  
  const content = renderCell 
    ? renderCell(cell, rowPath, colPath)
    : cell?.value ?? '';
  
  return (
    <div
      className={styles.dataCell}
      style={{
        gridRowStart: placement.gridRowStart,
        gridRowEnd: placement.gridRowEnd,
        gridColumnStart: placement.gridColumnStart,
        gridColumnEnd: placement.gridColumnEnd,
        ...cell?.style
      }}
      role="gridcell"
      onClick={handleClick}
      tabIndex={0}
    >
      {content}
    </div>
  );
};
```

---

## CSS Styles

### SuperGrid.module.css

```css
/* ============================================================================
   SuperGrid CSS Module
   Pure CSS Grid implementation - no D3.js
   ============================================================================ */

/* Container */
.superGrid {
  --sg-border-color: #333;
  --sg-corner-bg: #00CED1;
  --sg-row-header-bg: #90EE90;
  --sg-col-header-bg-l0: #FFD700;
  --sg-col-header-bg-l1: #FFA500;
  --sg-data-bg: #FFA500;
  --sg-cell-padding: 4px 8px;
  --sg-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  --sg-font-size: 13px;
  --sg-header-font-weight: 500;
  
  font-family: var(--sg-font-family);
  font-size: var(--sg-font-size);
  overflow: auto;
  border: 1px solid var(--sg-border-color);
}

/* Grid Container */
.gridContainer {
  min-width: max-content;
}

/* All cells share border styling */
.cornerCell,
.rowHeader,
.colHeader,
.dataCell {
  border: 1px solid var(--sg-border-color);
  padding: var(--sg-cell-padding);
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  /* Prevent double borders */
  margin-right: -1px;
  margin-bottom: -1px;
}

/* Corner cells (MiniNav) */
.cornerCell {
  background: var(--sg-corner-bg);
  font-weight: var(--sg-header-font-weight);
  justify-content: center;
}

/* Row headers */
.rowHeader {
  background: var(--sg-row-header-bg);
  font-weight: var(--sg-header-font-weight);
  cursor: pointer;
  justify-content: flex-start;
}

.rowHeader:hover {
  filter: brightness(0.95);
}

.rowHeader[data-expandable="true"] {
  cursor: pointer;
}

.rowHeader .expandIcon {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.2s;
}

.rowHeader[data-expanded="true"] .expandIcon {
  transform: rotate(90deg);
}

/* Column headers - gradient by depth */
.colHeader {
  font-weight: var(--sg-header-font-weight);
  justify-content: center;
  text-align: center;
}

.colHeader.depth0 {
  background: var(--sg-col-header-bg-l0);
}

.colHeader.depth1 {
  background: var(--sg-col-header-bg-l1);
}

.colHeader.depth2 {
  background: color-mix(in srgb, var(--sg-col-header-bg-l1) 80%, #fff);
}

/* Data cells */
.dataCell {
  background: var(--sg-data-bg);
  justify-content: flex-start;
  cursor: cell;
}

.dataCell:hover {
  filter: brightness(0.95);
}

.dataCell:focus {
  outline: 2px solid #007AFF;
  outline-offset: -2px;
  z-index: 1;
}

/* Header label */
.headerLabel {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================================
   NeXTSTEP Theme
   ============================================================================ */

.nextstep {
  --sg-border-color: #000;
  --sg-corner-bg: #AAAAAA;
  --sg-row-header-bg: #CCCCCC;
  --sg-col-header-bg-l0: #BBBBBB;
  --sg-col-header-bg-l1: #DDDDDD;
  --sg-data-bg: #FFFFFF;
  --sg-font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.nextstep .cornerCell,
.nextstep .rowHeader,
.nextstep .colHeader {
  background-image: linear-gradient(to bottom, 
    rgba(255,255,255,0.3) 0%, 
    rgba(255,255,255,0) 50%,
    rgba(0,0,0,0.1) 100%
  );
}

.nextstep .dataCell {
  border-color: #999;
}

/* ============================================================================
   Modern Theme
   ============================================================================ */

.modern {
  --sg-border-color: #E5E5E5;
  --sg-corner-bg: #F5F5F5;
  --sg-row-header-bg: #FAFAFA;
  --sg-col-header-bg-l0: #F0F0F0;
  --sg-col-header-bg-l1: #F8F8F8;
  --sg-data-bg: #FFFFFF;
  --sg-font-family: 'Inter', -apple-system, sans-serif;
  
  border-radius: 8px;
  overflow: hidden;
}

.modern .cornerCell,
.modern .rowHeader,
.modern .colHeader,
.modern .dataCell {
  border-color: var(--sg-border-color);
}

/* ============================================================================
   Reference Image Debug Theme (for validation)
   ============================================================================ */

.debug {
  --sg-corner-bg: #00CED1;
  --sg-row-header-bg: #90EE90;
  --sg-col-header-bg-l0: #FFD700;
  --sg-col-header-bg-l1: #FFA500;
  --sg-data-bg: #FFA500;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/treeMetrics.test.ts
import { computeTreeMetrics } from '../utils/treeMetrics';

describe('computeTreeMetrics', () => {
  it('computes correct depth for flat list', () => {
    const tree = {
      label: 'Root',
      id: 'root',
      children: [
        { label: 'A', id: 'a' },
        { label: 'B', id: 'b' },
        { label: 'C', id: 'c' },
      ]
    };
    
    const metrics = computeTreeMetrics(tree);
    
    expect(metrics.depth).toBe(1);
    expect(metrics.leafCount).toBe(3);
  });
  
  it('computes correct depth for nested hierarchy', () => {
    const tree = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: 'Parent',
          id: 'parent',
          children: [
            {
              label: 'Child',
              id: 'child',
              children: [
                { label: 'Grandchild', id: 'gc' }
              ]
            }
          ]
        }
      ]
    };
    
    const metrics = computeTreeMetrics(tree);
    
    expect(metrics.depth).toBe(3);
    expect(metrics.leafCount).toBe(1);
  });
  
  it('computes correct leaf spans for reference image data', () => {
    // FutureME has 12 leaves (4+4+4)
    const futureMETree = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: 'FutureME',
          id: 'futureme',
          children: [
            {
              label: 'Learning',
              id: 'learning',
              children: [
                { label: 'Tools', id: 'tools' },
                { label: 'Progress', id: 'progress' },
                { label: 'Reference', id: 'reference' },
                { label: 'Community', id: 'community' },
              ]
            },
            {
              label: 'Growth',
              id: 'growth',
              children: [
                { label: 'Fitness', id: 'fitness' },
                { label: 'Health', id: 'health' },
                { label: 'Play', id: 'play' },
                { label: 'Travel', id: 'travel' },
              ]
            },
            {
              label: 'Writing',
              id: 'writing',
              children: [
                { label: 'Novels', id: 'novels' },
                { label: 'Poetry', id: 'poetry' },
                { label: 'Essays', id: 'essays' },
                { label: 'Photos', id: 'photos' },
              ]
            }
          ]
        }
      ]
    };
    
    const metrics = computeTreeMetrics(futureMETree);
    
    expect(metrics.leafCount).toBe(12);
    
    // Find FutureME node
    const futureME = metrics.flatNodes.find(n => n.node.id === 'futureme');
    expect(futureME?.leafCount).toBe(12);
    expect(futureME?.leafStart).toBe(0);
    
    // Find Learning node
    const learning = metrics.flatNodes.find(n => n.node.id === 'learning');
    expect(learning?.leafCount).toBe(4);
    expect(learning?.leafStart).toBe(0);
    
    // Find Growth node
    const growth = metrics.flatNodes.find(n => n.node.id === 'growth');
    expect(growth?.leafCount).toBe(4);
    expect(growth?.leafStart).toBe(4);
  });
});

// __tests__/gridPlacement.test.ts
import { 
  computeRowHeaderPlacement, 
  computeColHeaderPlacement,
  computeDataCellPlacement 
} from '../utils/gridPlacement';

describe('gridPlacement', () => {
  // Reference image: 3 row header columns, 2 col header rows
  const rowHeaderDepth = 3;  // C
  const colHeaderDepth = 2;  // R
  
  describe('computeRowHeaderPlacement', () => {
    it('places FutureME in column 1, spanning rows 3-14', () => {
      const futureME = {
        node: { label: 'FutureME', id: 'futureme' },
        depth: 0,
        leafStart: 0,
        leafCount: 12,
        path: ['root', 'futureme']
      };
      
      const placement = computeRowHeaderPlacement(futureME, colHeaderDepth, rowHeaderDepth);
      
      expect(placement.gridColumnStart).toBe(1);
      expect(placement.gridColumnEnd).toBe(2);
      expect(placement.gridRowStart).toBe(3);  // After 2 header rows
      expect(placement.gridRowEnd).toBe(15);   // 3 + 12
    });
    
    it('places Learning in column 2, spanning rows 3-6', () => {
      const learning = {
        node: { label: 'Learning', id: 'learning' },
        depth: 1,
        leafStart: 0,
        leafCount: 4,
        path: ['root', 'futureme', 'learning']
      };
      
      const placement = computeRowHeaderPlacement(learning, colHeaderDepth, rowHeaderDepth);
      
      expect(placement.gridColumnStart).toBe(2);
      expect(placement.gridColumnEnd).toBe(3);
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(7);    // 3 + 4
    });
    
    it('places Tools in column 3, row 3 only', () => {
      const tools = {
        node: { label: 'Tools', id: 'tools' },
        depth: 2,
        leafStart: 0,
        leafCount: 1,
        path: ['root', 'futureme', 'learning', 'tools']
      };
      
      const placement = computeRowHeaderPlacement(tools, colHeaderDepth, rowHeaderDepth);
      
      expect(placement.gridColumnStart).toBe(3);
      expect(placement.gridColumnEnd).toBe(4);
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(4);
    });
  });
  
  describe('computeColHeaderPlacement', () => {
    it('places 2022 in row 1, spanning columns 4-7', () => {
      const year2022 = {
        node: { label: '2022', id: '2022' },
        depth: 0,
        leafStart: 0,
        leafCount: 4,
        path: ['root', '2022']
      };
      
      const placement = computeColHeaderPlacement(year2022, rowHeaderDepth);
      
      expect(placement.gridRowStart).toBe(1);
      expect(placement.gridRowEnd).toBe(2);
      expect(placement.gridColumnStart).toBe(4);  // After 3 header cols
      expect(placement.gridColumnEnd).toBe(8);    // 4 + 4
    });
    
    it('places Q1 in row 2, column 4 only', () => {
      const q1 = {
        node: { label: 'Q1', id: '2022-q1' },
        depth: 1,
        leafStart: 0,
        leafCount: 1,
        path: ['root', '2022', '2022-q1']
      };
      
      const placement = computeColHeaderPlacement(q1, rowHeaderDepth);
      
      expect(placement.gridRowStart).toBe(2);
      expect(placement.gridRowEnd).toBe(3);
      expect(placement.gridColumnStart).toBe(4);
      expect(placement.gridColumnEnd).toBe(5);
    });
  });
  
  describe('computeDataCellPlacement', () => {
    it('places first data cell at row 3, column 4', () => {
      const placement = computeDataCellPlacement(0, 0, colHeaderDepth, rowHeaderDepth);
      
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(4);
      expect(placement.gridColumnStart).toBe(4);
      expect(placement.gridColumnEnd).toBe(5);
    });
    
    it('places cell at leaf indices (5, 2) at row 8, column 6', () => {
      const placement = computeDataCellPlacement(5, 2, colHeaderDepth, rowHeaderDepth);
      
      expect(placement.gridRowStart).toBe(8);   // 2 + 1 + 5
      expect(placement.gridRowEnd).toBe(9);
      expect(placement.gridColumnStart).toBe(6); // 3 + 1 + 2
      expect(placement.gridColumnEnd).toBe(7);
    });
  });
});
```

### Visual Regression Test

```typescript
// __tests__/SuperGrid.visual.test.tsx
import { render } from '@testing-library/react';
import { SuperGrid } from '../SuperGrid';
import { exampleRowAxis, exampleColumnAxis } from '../fixtures/referenceImage';

describe('SuperGrid Visual', () => {
  it('renders reference image layout correctly', () => {
    const { container } = render(
      <SuperGrid
        rowAxis={exampleRowAxis}
        columnAxis={exampleColumnAxis}
        data={[]}
        theme="debug"
      />
    );
    
    const grid = container.querySelector('.gridContainer');
    
    // Verify grid dimensions
    const style = window.getComputedStyle(grid!);
    
    // 3 header columns + 4 data columns = 7 total
    expect(style.gridTemplateColumns.split(' ').length).toBe(7);
    
    // 2 header rows + 26 data rows = 28 total
    expect(style.gridTemplateRows.split(' ').length).toBe(28);
  });
  
  it('matches snapshot', () => {
    const { container } = render(
      <SuperGrid
        rowAxis={exampleRowAxis}
        columnAxis={exampleColumnAxis}
        data={[]}
        theme="debug"
      />
    );
    
    expect(container).toMatchSnapshot();
  });
});
```

---

## Migration Checklist

### Phase 1: Core Implementation
- [ ] Create file structure under `src/components/SuperGrid/`
- [ ] Implement `types.ts` with all interfaces
- [ ] Implement `utils/treeMetrics.ts` with tests
- [ ] Implement `utils/gridPlacement.ts` with tests
- [ ] Implement `useGridLayout.ts` hook
- [ ] Implement cell components (Corner, Row, Col, Data)
- [ ] Implement `GridContainer.tsx`
- [ ] Implement `SuperGrid.tsx` main component
- [ ] Create `SuperGrid.module.css` with all themes
- [ ] Write unit tests (aim for 100% coverage)

### Phase 2: Integration
- [ ] Create reference image fixture data
- [ ] Add visual regression test
- [ ] Integrate with existing Canvas/Card system
- [ ] Add keyboard navigation (arrow keys, enter to edit)
- [ ] Add selection state management

### Phase 3: Features
- [ ] Implement row/column resize handles
- [ ] Implement expand/collapse for hierarchies
- [ ] Implement cell editing mode
- [ ] Connect to SQLite data layer
- [ ] Add virtualization for large datasets (if needed)

### Phase 4: Polish
- [ ] Accessibility audit (ARIA roles, keyboard nav)
- [ ] Performance profiling
- [ ] Documentation
- [ ] Storybook stories

---

## Key Differences from D3 Approach

| Aspect | D3 Approach | CSS Grid Approach |
|--------|-------------|-------------------|
| **Layout** | Manual SVG coordinate math | Browser-native grid layout |
| **Spanning** | Calculate rects, clip paths | `grid-row`, `grid-column` |
| **Rendering** | D3 enter/update/exit | React reconciliation |
| **Styling** | Inline SVG attributes | CSS classes, variables |
| **Accessibility** | Manual ARIA | Semantic HTML roles |
| **Debugging** | SVG inspector | DOM inspector |
| **Learning curve** | D3-specific patterns | Standard React patterns |

---

*Specification Version: 1.0*
*Created: February 2025*
*For: Claude Code execution*
