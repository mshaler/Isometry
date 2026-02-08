/**
 * ViewConfig interface for rendering configuration
 *
 * Drives all rendering decisions in the unified ViewEngine architecture.
 * Contains view type, PAFV projection, filters, and styling configuration.
 */

import type { PAFVProjection } from './PAFVProjection';

/**
 * Event callbacks for view interaction
 *
 * Handles user interactions within the D3 visualization and
 * communicates back to React components for state management.
 */
export interface ViewEventHandlers {
  /** Called when user clicks on a node/cell */
  onNodeClick?: (node: any, position?: { x: number; y: number }) => void;

  /** Called when user hovers over a node/cell */
  onNodeHover?: (node: any | null, position?: { x: number; y: number } | null) => void;

  /** Called when user selects multiple nodes */
  onSelectionChange?: (nodes: any[]) => void;

  /** Called when user changes PAFV axis assignment via drag-drop */
  onAxisChange?: (axis: 'x' | 'y' | 'z', facet: string) => void;

  /** Called when user changes zoom/pan state */
  onViewportChange?: (transform: { x: number; y: number; scale: number }) => void;

  /** Called when view needs to update filters */
  onFilterChange?: (filters: any[]) => void;
}

/**
 * Supported view types in the Grid Continuum
 */
export type ViewType = 'list' | 'grid' | 'kanban' | 'graph' | 'timeline' | 'calendar' | 'charts' | 'supergrid';

/**
 * LATCH filter for data selection
 */
export interface LATCHFilter {
  /** LATCH axis: Location, Alphabet, Time, Category, Hierarchy */
  axis: 'L' | 'A' | 'T' | 'C' | 'H';

  /** Facet within the axis (e.g., 'status', 'priority', 'created_at') */
  facet: string;

  /** Filter operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';

  /** Filter value(s) */
  value: string | number | boolean | string[] | number[];

  /** Whether filter is currently enabled */
  enabled: boolean;
}

/**
 * Sort configuration for data ordering
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;

  /** Sort direction */
  direction: 'asc' | 'desc';

  /** Data type for proper sorting */
  type: 'string' | 'number' | 'date';
}

/**
 * Zoom state for cartographic navigation
 */
export interface ZoomState {
  /** Current zoom scale (1.0 = 100%) */
  scale: number;

  /** Pan offset in grid coordinates */
  offset: { x: number; y: number };

  /** Whether zoom is currently constrained by boundaries */
  constrained: boolean;
}

/**
 * Selection state for multi-select operations
 */
export interface SelectionState {
  /** Array of selected node IDs */
  selectedIds: string[];

  /** Last clicked node ID (for range selection) */
  lastClickedId?: string;

  /** Selection mode */
  mode: 'single' | 'multiple' | 'range';
}

/**
 * Styling configuration for view appearance
 */
export interface ViewStyling {
  /** Color scheme */
  colorScheme: 'light' | 'dark' | 'auto';

  /** Cell dimensions for grid-based views */
  cellSize?: {
    width: number;
    height: number;
  };

  /** Header dimensions */
  headerSize?: {
    width: number;
    height: number;
  };

  /** Animation preferences */
  animations?: {
    enabled: boolean;
    duration: number;
    easing: string;
  };

  /** Grid-specific styling */
  grid?: {
    showGridLines: boolean;
    gridLineColor: string;
    cellBorderRadius: number;
  };
}

/**
 * Complete view configuration
 *
 * This interface drives all rendering decisions in the ViewEngine system.
 * Changes to this config trigger re-renders or transitions as appropriate.
 */
export interface ViewConfig {
  /** View type determines which renderer to use */
  viewType: ViewType;

  /** PAFV projection maps LATCH axes to visual planes */
  projection: PAFVProjection;

  /** Data filters for LATCH-based selection */
  filters: LATCHFilter[];

  /** Sort configuration */
  sort: SortConfig[];

  /** Current zoom/pan state */
  zoom: ZoomState;

  /** Multi-select state */
  selection: SelectionState;

  /** Visual styling preferences */
  styling: ViewStyling;

  /** Event handlers for user interactions */
  eventHandlers: ViewEventHandlers;

  /** Performance preferences */
  performance?: {
    maxNodes: number;
    enableVirtualization: boolean;
    targetFps: number;
  };

  /** Debug settings */
  debug?: {
    enabled: boolean;
    showMetrics: boolean;
    logPerformance: boolean;
  };
}

/**
 * Default ViewConfig for new views
 */
export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  viewType: 'grid',
  projection: {
    x: { axis: 'time', facet: 'created_at' },
    y: { axis: 'category', facet: 'status' },
    color: { axis: 'hierarchy', facet: 'priority' },
  },
  filters: [],
  sort: [
    { field: 'created_at', direction: 'desc', type: 'date' }
  ],
  zoom: {
    scale: 1.0,
    offset: { x: 0, y: 0 },
    constrained: true
  },
  selection: {
    selectedIds: [],
    mode: 'multiple'
  },
  styling: {
    colorScheme: 'light',
    cellSize: { width: 120, height: 80 },
    headerSize: { width: 150, height: 40 },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'ease-in-out'
    },
    grid: {
      showGridLines: true,
      gridLineColor: '#e2e8f0',
      cellBorderRadius: 4
    }
  },
  eventHandlers: {},
  performance: {
    maxNodes: 10000,
    enableVirtualization: true,
    targetFps: 60
  },
  debug: {
    enabled: false,
    showMetrics: false,
    logPerformance: false
  }
};

/**
 * Type guard for ViewConfig validation
 */
export const isViewConfig = (obj: any): obj is ViewConfig => {
  return obj &&
    typeof obj.viewType === 'string' &&
    obj.projection &&
    Array.isArray(obj.filters) &&
    Array.isArray(obj.sort) &&
    obj.zoom &&
    obj.selection &&
    obj.styling &&
    obj.eventHandlers;
};

/**
 * Type guard for LATCHFilter validation
 */
export const isLATCHFilter = (obj: any): obj is LATCHFilter => {
  return obj &&
    ['L', 'A', 'T', 'C', 'H'].includes(obj.axis) &&
    typeof obj.facet === 'string' &&
    typeof obj.operator === 'string' &&
    obj.value !== undefined &&
    typeof obj.enabled === 'boolean';
};