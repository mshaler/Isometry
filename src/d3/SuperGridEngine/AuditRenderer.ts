/**
 * AuditRenderer - Visual distinction for computed values and CRUD operations
 *
 * SuperAudit features:
 * - Computed cells: blue tint (calculated values)
 * - Enriched cells: green tint (ETL-derived data)
 * - Formula cells: purple tint (spreadsheet-like formulas)
 * - CRUD flash: green (create), blue (update), red (delete)
 * - Recent changes cleaned up after 2 seconds
 *
 * Part of the Super* feature family for SuperGrid.
 */

// ============================================================================
// Types
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

// ============================================================================
// Constants
// ============================================================================

/**
 * Tint colors for audit overlays (semi-transparent backgrounds).
 */
export const AUDIT_TINT_COLORS = {
  computed: 'rgba(59, 130, 246, 0.1)',   // Blue tint
  enriched: 'rgba(16, 185, 129, 0.1)',   // Green tint
  formula: 'rgba(139, 92, 246, 0.1)',    // Purple tint
} as const;

/**
 * Solid indicator colors for audit dots.
 */
const INDICATOR_COLORS = {
  computed: '#3B82F6',   // Blue
  enriched: '#10B981',   // Green
  formula: '#8B5CF6',    // Purple
  raw: 'transparent',
} as const;

/**
 * Flash colors for CRUD operations.
 */
export const CRUD_FLASH_COLORS = {
  create: '#10B981',   // Green
  update: '#3B82F6',   // Blue
  delete: '#EF4444',   // Red
} as const;

/**
 * Duration for recent change cleanup (milliseconds).
 */
const CHANGE_CLEANUP_DURATION = 2000;

// ============================================================================
// Helper Functions (Pure, Exported for Testing)
// ============================================================================

/**
 * Create a new audit state with default values.
 */
export function createAuditState(): AuditState {
  return {
    enabled: false,
    showFormulas: false,
    recentChanges: new Map(),
  };
}

/**
 * Get the tint color for a cell based on its source type.
 *
 * @param source - The value source type
 * @returns CSS color string for the tint overlay
 */
export function getAuditTintColor(source: ValueSource): string {
  if (source === 'raw') {
    return 'transparent';
  }
  return AUDIT_TINT_COLORS[source] ?? 'transparent';
}

/**
 * Get the indicator dot color for a cell based on its source type.
 *
 * @param source - The value source type
 * @returns CSS color string for the indicator dot
 */
export function getIndicatorColor(source: ValueSource): string {
  return INDICATOR_COLORS[source] ?? 'transparent';
}

/**
 * Get the flash color for a CRUD operation.
 *
 * @param type - The CRUD operation type
 * @returns CSS color string for the flash animation
 */
export function getCRUDFlashColor(type: 'create' | 'update' | 'delete'): string {
  return CRUD_FLASH_COLORS[type];
}

// ============================================================================
// AuditRenderer Class
// ============================================================================

/**
 * Manages audit overlays and CRUD flash animations for SuperGrid cells.
 *
 * Usage:
 * 1. Create instance: `const renderer = new AuditRenderer()`
 * 2. Set audit info for cells: `renderer.setAuditInfo('cell-1', { source: 'computed' })`
 * 3. Enable audit mode: `renderer.setEnabled(true)`
 * 4. Track changes: `renderer.trackChange('cell-1', 'update')`
 * 5. Query state: `renderer.shouldRenderOverlay('cell-1')`
 */
export class AuditRenderer {
  private state: AuditState;
  private cellAuditInfo: Map<string, CellAuditInfo>;
  private cleanupTimeouts: Map<string, ReturnType<typeof setTimeout>>;

  constructor() {
    this.state = createAuditState();
    this.cellAuditInfo = new Map();
    this.cleanupTimeouts = new Map();
  }

  // ==========================================================================
  // State Accessors
  // ==========================================================================

  /**
   * Get current audit state.
   */
  getState(): AuditState {
    return {
      enabled: this.state.enabled,
      showFormulas: this.state.showFormulas,
      recentChanges: new Map(this.state.recentChanges),
    };
  }

  /**
   * Set audit mode enabled/disabled.
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
  }

  /**
   * Set formula display mode.
   */
  setShowFormulas(showFormulas: boolean): void {
    this.state.showFormulas = showFormulas;
  }

  // ==========================================================================
  // Cell Audit Info Management
  // ==========================================================================

  /**
   * Set audit information for a cell.
   */
  setAuditInfo(cellId: string, info: CellAuditInfo): void {
    this.cellAuditInfo.set(cellId, info);
  }

  /**
   * Get audit information for a cell.
   */
  getAuditInfo(cellId: string): CellAuditInfo | undefined {
    return this.cellAuditInfo.get(cellId);
  }

  /**
   * Clear all cell audit info.
   */
  clearAllAuditInfo(): void {
    this.cellAuditInfo.clear();
  }

  // ==========================================================================
  // CRUD Change Tracking
  // ==========================================================================

  /**
   * Track a CRUD change for a cell.
   * Sets up automatic cleanup after CHANGE_CLEANUP_DURATION.
   */
  trackChange(cellId: string, type: 'create' | 'update' | 'delete'): void {
    // Clear existing timeout for this cell
    const existingTimeout = this.cleanupTimeouts.get(cellId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Record the change
    this.state.recentChanges.set(cellId, {
      type,
      timestamp: Date.now(),
    });

    // Set up cleanup
    const timeoutId = setTimeout(() => {
      this.state.recentChanges.delete(cellId);
      this.cleanupTimeouts.delete(cellId);
    }, CHANGE_CLEANUP_DURATION);

    this.cleanupTimeouts.set(cellId, timeoutId);
  }

  /**
   * Check if a cell has a recent change.
   */
  hasRecentChange(cellId: string): boolean {
    return this.state.recentChanges.has(cellId);
  }

  /**
   * Get the type of recent change for a cell.
   */
  getRecentChangeType(cellId: string): 'create' | 'update' | 'delete' | undefined {
    return this.state.recentChanges.get(cellId)?.type;
  }

  // ==========================================================================
  // Rendering Decisions
  // ==========================================================================

  /**
   * Check if overlay should be rendered for a cell.
   * Returns true if audit is enabled AND cell is not raw data.
   */
  shouldRenderOverlay(cellId: string): boolean {
    if (!this.state.enabled) {
      return false;
    }

    const info = this.cellAuditInfo.get(cellId);
    if (!info || info.source === 'raw') {
      return false;
    }

    return true;
  }

  /**
   * Get the tint color for a cell's overlay.
   */
  getOverlayColor(cellId: string): string {
    const info = this.cellAuditInfo.get(cellId);
    if (!info) {
      return 'transparent';
    }
    return getAuditTintColor(info.source);
  }

  /**
   * Get the indicator color for a cell.
   */
  getCellIndicatorColor(cellId: string): string {
    const info = this.cellAuditInfo.get(cellId);
    if (!info) {
      return 'transparent';
    }
    return getIndicatorColor(info.source);
  }

  /**
   * Get the flash color for a cell's recent change.
   */
  getFlashColor(cellId: string): string | undefined {
    const change = this.state.recentChanges.get(cellId);
    if (!change) {
      return undefined;
    }
    return getCRUDFlashColor(change.type);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clear all state and cancel pending timeouts.
   */
  destroy(): void {
    // Cancel all pending cleanups
    for (const timeout of this.cleanupTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.cleanupTimeouts.clear();
    this.state.recentChanges.clear();
    this.cellAuditInfo.clear();
  }
}
