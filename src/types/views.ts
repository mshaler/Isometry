/**
 * View Types - View Continuum State and Type Definitions
 *
 * This module provides type definitions for the view continuum system
 * that enables seamless transitions between list, kanban, and SuperGrid
 * projections with preserved user context.
 *
 * Architecture: PAFV axis-to-plane remappings, not data changes.
 * View transitions preserve LATCH filters, selection state, and focus position.
 */

import type { Node } from './node';

/**
 * Supported view types in the grid continuum
 *
 * Each view type represents a different PAFV axis allocation:
 * - list: 1-axis projection (single LATCH axis drives ordering/grouping)
 * - kanban: 1-facet column projection (Category facet drives columns)
 * - supergrid: Full PAFV 2D projection with hierarchical headers
 * - grid: Alias for supergrid
 * - timeline: Time-based linear projection
 * - network: Graph-based connection projection
 * - calendar: Time-grid hybrid projection
 */
export enum ViewType {
  LIST = 'list',
  KANBAN = 'kanban',
  SUPERGRID = 'supergrid',
  GRID = 'grid',
  TIMELINE = 'timeline',
  NETWORK = 'network',
  CALENDAR = 'calendar'
}

/**
 * PAFV axis-to-plane mapping for each view type
 *
 * Defines how LATCH dimensions map to spatial planes (x, y, z).
 * Different views use different axis allocations for the same data.
 */
export interface ViewAxisMapping {
  // Primary axes (required)
  xAxis?: {
    latchDimension: 'L' | 'A' | 'T' | 'C' | 'H';  // LATCH axis
    facet: string;                                 // Specific facet within the axis
    label: string;                                 // Display label for the axis
  };

  yAxis?: {
    latchDimension: 'L' | 'A' | 'T' | 'C' | 'H';
    facet: string;
    label: string;
  };

  // Z-axis for nested hierarchies (SuperGrid depth)
  zAxis?: {
    latchDimension: 'L' | 'A' | 'T' | 'C' | 'H';
    facet: string;
    label: string;
    depth: number;                                 // Maximum nesting depth
  };

  // Sort/order configuration for primary axis
  primarySort?: {
    facet: string;                                 // Facet to sort by
    direction: 'asc' | 'desc';                     // Sort direction
  };
}

/**
 * View-specific state that persists across view switches
 *
 * Each view type maintains its own state independently.
 * Focus position is tracked semantically by card ID, not pixel coordinates.
 */
export interface ViewSpecificState {
  // Axis assignment for this view
  axisMapping: ViewAxisMapping;

  // Scroll/viewport position (semantic, not pixel-based)
  focusedCardId?: string;                          // Card to keep in focus
  scrollPosition?: {
    semanticAnchor: string;                        // Card ID or group identifier
    offsetRatio: number;                           // 0-1 position within viewport
  };

  // View-specific zoom/density state
  zoomState?: {
    level: 'leaf' | 'grouped' | 'collapsed';      // Zoom level for this view
    scale?: number;                                // Optional scale factor
  };

  // Expansion/collapse state for hierarchical elements
  expandedGroups?: Set<string>;                    // Expanded group/header IDs

  // Last update timestamp for cache validation
  lastUpdated: number;
}

/**
 * Complete view state for all view types
 *
 * Tracks current view, per-view states, selection, and LATCH filters.
 * Selection and filters persist across all view transitions.
 */
export interface ViewState {
  // Current view configuration
  currentView: ViewType;                           // Active view type
  canvasId: string;                                // Canvas/dataset identifier for persistence

  // Per-view state storage
  viewStates: Record<ViewType, ViewSpecificState>; // State for each view type

  // Cross-view persistent state
  selectionState: {
    selectedCardIds: Set<string>;                  // Selected card IDs (view-independent)
    lastSelectedId?: string;                       // Most recently selected card
    anchorId?: string;                             // Anchor for range selection
  };

  // LATCH filter state (persists across all views)
  activeFilters: Array<{
    latchDimension: 'L' | 'A' | 'T' | 'C' | 'H';
    facet: string;
    value: unknown;
    operator: 'equals' | 'contains' | 'range' | 'exists';
  }>;

  // Cached query results for consistent projection
  cachedQuery?: {
    sql: string;                                   // SQL query string
    parameters: unknown[];                             // Query parameters
    results: Node[];                               // Cached card results
    timestamp: number;                             // Cache timestamp
    hash: string;                                  // Query hash for validation
  };

  // Transition animation state
  transitionState?: {
    fromView: ViewType;
    toView: ViewType;
    isAnimating: boolean;
    progress: number;                              // 0-1 animation progress
    startTime: number;
  };

  // Configuration
  config: {
    enableAnimations: boolean;                     // Enable FLIP transitions
    animationDuration: number;                     // Animation duration (ms)
    persistenceEnabled: boolean;                   // Enable state persistence
    autoFocusOnSwitch: boolean;                    // Auto-scroll to focused card
  };

  // Metadata
  lastModified: number;                            // Last state modification timestamp
  version: string;                                 // State schema version
}

/**
 * Card position data for FLIP animation transitions
 *
 * Captured before and after view transitions to enable smooth animations.
 */
export interface CardPosition {
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;                                  // Optional scale factor
  rotation?: number;                               // Optional rotation in degrees
  opacity?: number;                                // Optional opacity
}

/**
 * FLIP animation configuration
 *
 * Controls how view transitions are animated using the FLIP technique.
 */
export interface FlipAnimationConfig {
  duration: number;                                // Animation duration in milliseconds
  easing: 'ease-out' | 'ease-in-out' | 'cubic';   // Easing function
  stagger?: number;                                // Stagger delay between cards (ms)
  interruptible: boolean;                          // Whether animations can be interrupted

  // Visual effects during transition
  effects?: {
    enableFade: boolean;                           // Fade in/out during transition
    enableScale: boolean;                          // Scale cards during transition
    enableRotation: boolean;                       // Rotate cards during transition
  };
}

/**
 * View transition event data
 *
 * Emitted during view transitions for external listeners.
 */
export interface ViewTransitionEvent {
  fromView: ViewType;
  toView: ViewType;
  timestamp: number;
  trigger: 'user' | 'programmatic' | 'keyboard';   // How the transition was triggered
  preservedState: {
    selectionCount: number;
    focusedCardId?: string;
    filterCount: number;
  };
}

/**
 * Default view axis mappings for each view type
 *
 * Provides sensible defaults based on UX conventions and LATCH principles.
 */
export const DEFAULT_VIEW_MAPPINGS: Record<ViewType, ViewAxisMapping> = {
  [ViewType.LIST]: {
    // Single axis: Hierarchy for nesting structure
    yAxis: {
      latchDimension: 'H',
      facet: 'modified_at',
      label: 'Last Modified'
    },
    primarySort: {
      facet: 'modified_at',
      direction: 'desc'
    }
  },

  [ViewType.KANBAN]: {
    // X-axis: Category for columns, Y-axis: Time for ordering within columns
    xAxis: {
      latchDimension: 'C',
      facet: 'status',
      label: 'Status'
    },
    yAxis: {
      latchDimension: 'T',
      facet: 'modified_at',
      label: 'Last Modified'
    },
    primarySort: {
      facet: 'modified_at',
      direction: 'desc'
    }
  },

  [ViewType.SUPERGRID]: {
    // Full 2D: Category × Time with optional depth
    xAxis: {
      latchDimension: 'C',
      facet: 'folder',
      label: 'Folder'
    },
    yAxis: {
      latchDimension: 'T',
      facet: 'modified_at',
      label: 'Modified Date'
    },
    zAxis: {
      latchDimension: 'H',
      facet: 'priority',
      label: 'Priority',
      depth: 3
    },
    primarySort: {
      facet: 'modified_at',
      direction: 'desc'
    }
  },

  [ViewType.GRID]: {
    // Alias for SUPERGRID
    xAxis: {
      latchDimension: 'C',
      facet: 'folder',
      label: 'Folder'
    },
    yAxis: {
      latchDimension: 'T',
      facet: 'modified_at',
      label: 'Modified Date'
    },
    primarySort: {
      facet: 'modified_at',
      direction: 'desc'
    }
  },

  [ViewType.TIMELINE]: {
    // Time-based linear projection
    xAxis: {
      latchDimension: 'T',
      facet: 'created_at',
      label: 'Created Date'
    },
    primarySort: {
      facet: 'created_at',
      direction: 'asc'
    }
  },

  [ViewType.NETWORK]: {
    // Graph-based connection projection
    primarySort: {
      facet: 'name',
      direction: 'asc'
    }
  },

  [ViewType.CALENDAR]: {
    // Time-grid hybrid projection
    xAxis: {
      latchDimension: 'T',
      facet: 'due_at',
      label: 'Due Date'
    },
    yAxis: {
      latchDimension: 'C',
      facet: 'status',
      label: 'Status'
    },
    primarySort: {
      facet: 'due_at',
      direction: 'asc'
    }
  }
};

/**
 * Default view state configuration
 *
 * Used when initializing new view states or resetting to defaults.
 */
export const DEFAULT_VIEW_CONFIG = {
  enableAnimations: true,
  animationDuration: 300,                          // 300ms matches Phase 36 "quiet app" aesthetic
  persistenceEnabled: true,
  autoFocusOnSwitch: true
};

/**
 * Default FLIP animation configuration
 *
 * Optimized for smooth, interruptible transitions with subtle effects.
 */
export const DEFAULT_FLIP_CONFIG: FlipAnimationConfig = {
  duration: 300,                                   // Matches Phase 36 transition duration
  easing: 'ease-out',                              // Matches d3.easeCubicOut from Phase 36
  stagger: 50,                                     // 50ms stagger between cards
  interruptible: true,                             // Allow interruption mid-transition
  effects: {
    enableFade: true,
    enableScale: false,                            // Disable scale to avoid visual clutter
    enableRotation: false                          // Disable rotation for simplicity
  }
};

/**
 * Type guards for runtime validation
 */
export const isViewType = (value: unknown): value is ViewType => {
  return Object.values(ViewType).includes(value);
};

export const isViewAxisMapping = (obj: unknown): obj is ViewAxisMapping => {
  if (!obj) return false;

  const hasValidAxis = (axis: unknown) => {
    return axis &&
      typeof axis.latchDimension === 'string' &&
      ['L', 'A', 'T', 'C', 'H'].includes(axis.latchDimension) &&
      typeof axis.facet === 'string' &&
      typeof axis.label === 'string';
  };

  return (!obj.xAxis || hasValidAxis(obj.xAxis)) &&
         (!obj.yAxis || hasValidAxis(obj.yAxis)) &&
         (!obj.zAxis || (hasValidAxis(obj.zAxis) && typeof obj.zAxis.depth === 'number'));
};

export const isViewState = (obj: unknown): obj is ViewState => {
  return obj &&
    isViewType(obj.currentView) &&
    typeof obj.canvasId === 'string' &&
    obj.viewStates &&
    obj.selectionState &&
    obj.selectionState.selectedCardIds instanceof Set &&
    Array.isArray(obj.activeFilters) &&
    obj.config &&
    typeof obj.lastModified === 'number' &&
    typeof obj.version === 'string';
};

/**
 * Create a new view state with default configuration
 */
export const createDefaultViewState = (canvasId: string): ViewState => {
  const now = Date.now();

  return {
    currentView: ViewType.SUPERGRID,                // Default to SuperGrid
    canvasId,

    viewStates: {
      [ViewType.LIST]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.LIST],
        lastUpdated: now
      },
      [ViewType.KANBAN]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.KANBAN],
        lastUpdated: now
      },
      [ViewType.SUPERGRID]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.SUPERGRID],
        lastUpdated: now
      },
      [ViewType.GRID]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.GRID],
        lastUpdated: now
      },
      [ViewType.TIMELINE]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.TIMELINE],
        lastUpdated: now
      },
      [ViewType.NETWORK]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.NETWORK],
        lastUpdated: now
      },
      [ViewType.CALENDAR]: {
        axisMapping: DEFAULT_VIEW_MAPPINGS[ViewType.CALENDAR],
        lastUpdated: now
      }
    },

    selectionState: {
      selectedCardIds: new Set()
    },

    activeFilters: [],

    config: DEFAULT_VIEW_CONFIG,

    lastModified: now,
    version: '1.0.0'
  };
};

/**
 * Utility function to get localStorage key for view state persistence
 */
export const getViewStateStorageKey = (canvasId: string): string => {
  return `isometry-view-state-${canvasId}`;
};