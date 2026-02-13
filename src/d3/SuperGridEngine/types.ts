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
  depth: number;
  value: string;
  axis: LATCHAxis;
  facet?: string;
  span: number;
  position: { x: number; y: number; width: number; height: number };
  childCount?: number;
  isLeaf: boolean;
  /** Index of the first leaf cell this header spans (0-based) */
  startIndex: number;
  /** Index of the last leaf cell this header spans (0-based) */
  endIndex: number;
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
  /** Anchor cell for Shift+click range selection */
  anchorId?: string | null;
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

// Position Tracking Types (SuperPosition - Plan 74-04)
// Enables Janus polymorphic view transitions by tracking logical coordinates

/**
 * Represents a logical position on a single PAFV axis.
 * Decouples card positions from pixel coordinates.
 */
export interface PAFVCoordinate {
  /** The LATCH axis this coordinate belongs to (null if unmapped) */
  axis: LATCHAxis | null;
  /** Optional facet within the axis (e.g., 'due_date' within Time) */
  facet?: string;
  /** The actual value on this axis (e.g., "Work", "Q1", "High") */
  value: string | number | null;
}

/**
 * Represents a card's complete position in PAFV coordinate space.
 * These coordinates survive view transitions and enable smooth re-mapping.
 */
export interface CardPosition {
  /** Node ID this position belongs to */
  nodeId: string;
  /** X-axis logical coordinate */
  x: PAFVCoordinate;
  /** Y-axis logical coordinate */
  y: PAFVCoordinate;
  /** Z-axis logical coordinate (depth/layer) */
  z: PAFVCoordinate;
  /** Custom sort index within the card's group (for manual reordering) */
  customSortIndex?: number;
  /** ISO timestamp of last position update */
  lastUpdated: string;
}

/**
 * Represents the complete position state for all cards.
 * Serializable for SQLite persistence (Tier 2 state).
 */
export interface PositionState {
  /** Map of nodeId → CardPosition */
  positions: Map<string, CardPosition>;
  /** Custom sort orders by group key (groupKey → ordered nodeIds) */
  customSortOrders: Map<string, string[]>;
}

/**
 * Serialized form of PositionState for SQLite storage.
 */
export interface SerializedPositionState {
  positions: Array<{ nodeId: string; position: CardPosition }>;
  customSortOrders: Array<{ groupKey: string; nodeIds: string[] }>;
}

// Multi-Sort Types (SuperSort - Plan 75-02)
export interface SortLevel {
  /** Header ID for rendering indicators */
  headerId: string;
  /** LATCH axis this sort applies to */
  axis: LATCHAxis;
  /** Database column/facet to sort by */
  facet: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Priority (1 = primary, 2 = secondary, etc.) */
  priority: number;
}

export interface MultiSortState {
  /** Active sort levels in priority order */
  levels: SortLevel[];
  /** Maximum allowed sort levels (default 3) */
  maxLevels: number;
}

// SuperCard Types (SuperCards - Plan 75-03)
// Provides visual distinction for header cards and aggregation rows

/**
 * Card type distinguishes data cards from structural SuperCards.
 * - data: Regular user data cards
 * - header: Column/row header cards with chrome styling
 * - aggregation: Bottom-row count/sum/avg cells
 */
export type CardType = 'data' | 'header' | 'aggregation';

/**
 * Aggregation function type for SuperCard aggregation cells.
 */
export type AggregationType = 'count' | 'sum' | 'avg';

/**
 * SuperCard extends basic card with type-specific metadata.
 * SuperCards are excluded from FTS5 search results.
 */
export interface SuperCard {
  /** Unique identifier (prefixed with 'header-' or 'agg-' for SuperCards) */
  id: string;
  /** Card type: data, header, or aggregation */
  type: CardType;
  /** Reference to header descriptor ID (header cards only) */
  headerId?: string;
  /** Hierarchy level for nested headers (0 = root) */
  headerLevel?: number;
  /** Type of aggregation (aggregation cards only) */
  aggregationType?: AggregationType;
  /** Computed aggregation value (aggregation cards only) */
  aggregationValue?: number;
  /** Grid X position (column index) */
  gridX: number;
  /** Grid Y position (row index) */
  gridY: number;
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
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

// ============================================================================
// Audit Types (SuperAudit - Plan 75-04)
// ============================================================================

/**
 * Source type for cell values.
 * - raw: User-entered data, no computation
 * - computed: Derived value (aggregation, calculation)
 * - enriched: ETL-derived data from external source
 * - formula: Spreadsheet-style formula result
 */
export type ValueSource = 'raw' | 'computed' | 'enriched' | 'formula';

/**
 * Audit information for a single cell.
 */
export interface CellAuditInfo {
  /** Source type of the cell value */
  source: ValueSource;
  /** ISO timestamp of last computation (for computed/formula cells) */
  computedAt?: string;
  /** Formula string (for formula cells) */
  formula?: string;
  /** ETL source identifier (for enriched cells) */
  enrichedBy?: string;
}

/**
 * Recent CRUD operation on a cell.
 */
export interface RecentChange {
  /** Type of CRUD operation */
  type: 'create' | 'update' | 'delete';
  /** Timestamp of the operation */
  timestamp: number;
}

/**
 * Complete audit state for the grid.
 */
export interface AuditState {
  /** Whether audit highlighting is enabled */
  enabled: boolean;
  /** Whether to show formulas instead of values */
  showFormulas: boolean;
  /** Recent CRUD changes keyed by cell ID */
  recentChanges: Map<string, RecentChange>;
}