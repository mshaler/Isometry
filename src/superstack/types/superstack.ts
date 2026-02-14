/**
 * SuperStack Type Definitions
 *
 * SuperStack is the nested header system that transforms SuperGrid from a flat grid
 * into a true dimensional pivot table. Headers form trees where:
 * - Parent headers span their children visually
 * - Depth indicates hierarchy level (0 = root/outermost)
 * - Path enables click-to-filter navigation
 * - Collapsed state controls visibility of children
 */

/**
 * Configuration for a LATCH facet used in headers.
 * Maps to a column in SQLite for grouping and filtering.
 */
export interface FacetConfig {
  /** Unique facet identifier */
  id: string;

  /** Display name for UI */
  name: string;

  /** LATCH axis: Location, Alphabet, Time, Category, Hierarchy */
  axis: 'L' | 'A' | 'T' | 'C' | 'H';

  /** Source column in SQLite cards table */
  sourceColumn: string;

  /** Data type for rendering and sorting */
  dataType: 'text' | 'number' | 'date' | 'select' | 'multi_select';

  /** For time facets: strftime format (e.g., '%Y' for year) */
  timeFormat?: string;

  /** For select facets: predefined option values */
  options?: string[];

  /** Sort order for header values */
  sortOrder: 'asc' | 'desc' | 'custom';
}

/**
 * Aggregate data computed for a header's scope.
 * Accumulated up the tree from leaves to root.
 */
export interface HeaderAggregate {
  /** Total cards in this header's scope */
  count: number;

  /** Sum of numeric facet values (if applicable) */
  sum?: number;

  /** Average of numeric facet values (if applicable) */
  avg?: number;

  /** Sparkline trend data for mini-visualization */
  trend?: number[];
}

/**
 * A single header node in the hierarchy.
 * Headers can be row headers (left side) or column headers (top).
 */
export interface HeaderNode {
  /** Unique identifier combining path values (e.g., "Work|#meetings") */
  id: string;

  /** The LATCH facet this header represents */
  facet: FacetConfig;

  /** The actual value from the data (e.g., "Work", "2024", "January") */
  value: string;

  /** Display label (may be formatted differently from value) */
  label: string;

  /** Depth in the tree (0 = root/outermost level) */
  depth: number;

  /** Number of leaf nodes this header spans */
  span: number;

  /** Starting index in the leaf array for positioning */
  startIndex: number;

  /** Child headers (next facet level) */
  children: HeaderNode[];

  /** Parent reference for tree traversal */
  parent: HeaderNode | null;

  /** Is this header currently collapsed? */
  collapsed: boolean;

  /** Path from root to this node (for filtering) */
  path: string[];

  /** Aggregation data for this header's scope */
  aggregate?: HeaderAggregate;
}

/**
 * Complete header tree for one axis (row or column).
 * Contains the full hierarchy and computed metadata.
 */
export interface HeaderTree {
  /** Axis type: row (left side) or column (top) */
  axis: 'row' | 'column';

  /** Ordered facets defining the hierarchy levels */
  facets: FacetConfig[];

  /** Root nodes (first facet level) */
  roots: HeaderNode[];

  /** Maximum depth of the tree (number of facet levels) */
  maxDepth: number;

  /** Total visible leaf count (used for layout calculations) */
  leafCount: number;

  /** Flattened visible leaf nodes for cell positioning */
  leaves: HeaderNode[];
}

/**
 * Pixel dimensions for SuperStack layout.
 * Controls header and cell sizing.
 */
export interface SuperStackDimensions {
  /** Width of each row header level in pixels */
  rowHeaderLevelWidth: number;

  /** Height of each column header level in pixels */
  colHeaderLevelHeight: number;

  /** Minimum width of a data cell in pixels */
  cellMinWidth: number;

  /** Minimum height of a data cell in pixels */
  cellMinHeight: number;

  /** Current zoom level multiplier (1.0 = 100%) */
  zoom: number;
}

/**
 * Complete SuperStack configuration and state.
 * Combines tree structure with rendering configuration.
 */
export interface SuperStackState {
  /** Row header facet configuration (left axis) */
  rowFacets: FacetConfig[];

  /** Column header facet configuration (top axis) */
  colFacets: FacetConfig[];

  /** Built row header tree */
  rowTree: HeaderTree;

  /** Built column header tree */
  colTree: HeaderTree;

  /** Set of currently collapsed header IDs */
  collapsedIds: Set<string>;

  /** Currently selected/highlighted header ID */
  selectedId: string | null;

  /** Pixel dimensions for rendering */
  dimensions: SuperStackDimensions;
}

/**
 * Raw query row from SQLite header discovery query.
 * Contains facet values and card count for tree building.
 */
export interface QueryRow {
  /** Dynamic facet value columns */
  [key: string]: string | number;

  /** Count of cards for this facet combination */
  card_count: number;
}

/**
 * Callback types for SuperStack interactions.
 */
export interface SuperStackCallbacks {
  /** Called when a header is clicked (for filtering) */
  onHeaderClick?: (node: HeaderNode) => void;

  /** Called when a header's collapse state changes */
  onHeaderCollapse?: (node: HeaderNode) => void;

  /** Called when a header is selected */
  onHeaderSelect?: (node: HeaderNode | null) => void;

  /** Called when header dimensions change (resize) */
  onDimensionsChange?: (dimensions: SuperStackDimensions) => void;
}
