/**
 * SuperGridEngine Types - Core type definitions for the unified grid engine
 */

// Core Data Types
export interface Node {
  id: string;
  name: string;
  created_at: string;
  modified_at: string;
  due_date?: string;
  status: string;
  priority: number;
  folder: string;
  tags: string[];
  location?: string;
  [key: string]: unknown;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
  weight?: number;
  label?: string;
}

// PAFV Types
export type LATCHAxis = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy';

export interface AxisMapping {
  axis: LATCHAxis;
  plane: 'x' | 'y' | 'z';
  facet?: string; // Specific attribute within axis (e.g., 'due_date' within Time)
}

export interface PAFVConfiguration {
  xMapping?: AxisMapping;
  yMapping?: AxisMapping;
  zMapping?: AxisMapping;
  originPattern: 'anchor' | 'bipolar';
}

// Cell & Grid Types
export interface CellDescriptor {
  id: string;
  gridX: number;
  gridY: number;
  xValue: string;
  yValue: string;
  nodeIds: string[];
  nodeCount: number;
  aggregateData?: {
    avgPriority: number;
    statusCounts: Record<string, number>;
    tagCounts: Record<string, number>;
  };
}

export interface HeaderDescriptor {
  id: string;
  level: number;
  value: string;
  axis: LATCHAxis;
  facet?: string;
  span: number;
  position: { x: number; y: number; width: number; height: number };
  childCount: number;
  isLeaf: boolean;
}

export interface HeaderTree {
  columns: HeaderDescriptor[];
  rows: HeaderDescriptor[];
  maxColumnLevels: number;
  maxRowLevels: number;
}

export interface GridDimensions {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  headerHeight: number;
  headerWidth: number;
  totalWidth: number;
  totalHeight: number;
}

export interface SelectionState {
  selectedCells: Set<string>;
  selectedHeaders: Set<string>;
  focusedCell?: CellDescriptor;
  selectionMode: 'single' | 'multiple' | 'range';
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  visibleCells: CellDescriptor[];
  visibleHeaders: HeaderDescriptor[];
}

// Progressive Disclosure Types
export interface ProgressiveState {
  zoomLevel: number;
  visibleLevels: number[];
  collapsedHeaders: Set<string>;
  levelGroups: LevelGroup[];
  activeLevelTab: number;
}

export interface LevelGroup {
  id: string;
  name: string;
  levels: number[];
  description?: string;
}

// Multi-level Header Hierarchy Types (SuperStack)
export interface HeaderNode {
  /** The display value for this header (e.g., "Q1", "Jan", "Week 1") */
  value: string;
  /** Hierarchy level (0 = root, 1 = child of root, etc.) */
  level: number;
  /** Number of leaf cells this header spans */
  span: number;
  /** Child header nodes */
  children: HeaderNode[];
  /** Index of the first leaf this header contains (0-based) */
  startIndex: number;
  /** Index of the last leaf this header contains (0-based) */
  endIndex: number;
  /** Whether this header's children are collapsed */
  isCollapsed: boolean;
}

// Event Types
export type SuperGridEvent =
  | 'cellClick'
  | 'cellHover'
  | 'headerClick'
  | 'selectionChange'
  | 'axisChange'
  | 'viewportChange'
  | 'renderComplete'
  | 'dataChange'
  | 'error';

export interface SuperGridEventData {
  cellClick: { cell: CellDescriptor; nodes: Node[] };
  cellHover: { cell: CellDescriptor | null; nodes: Node[] | null };
  headerClick: { header: HeaderDescriptor };
  selectionChange: { selection: SelectionState };
  axisChange: { pafv: PAFVConfiguration };
  viewportChange: { viewport: ViewportState };
  renderComplete: { renderTime: number; cellCount: number };
  dataChange: { nodeCount: number; edgeCount: number };
  error: { error: Error; context: string };
}

// Configuration Types
export interface SuperGridConfig {
  width: number;
  height: number;
  cellMinWidth: number;
  cellMinHeight: number;
  headerMinHeight: number;
  headerMinWidth: number;
  enableProgressive: boolean;
  enableZoomPan: boolean;
  enableSelection: boolean;
  maxHeaderLevels: number;
  colorScheme: 'default' | 'status' | 'priority' | 'custom';
  animationDuration: number;
}