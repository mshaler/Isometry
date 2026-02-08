/**
 * ViewportService - Viewport boundary management and constraint handling
 *
 * Manages viewport bounds, calculates constraints, and handles elastic
 * boundary behavior for cartographic navigation systems.
 *
 * Features:
 * - Dynamic boundary calculation based on grid and viewport dimensions
 * - Header and sidebar offset integration
 * - Elastic resistance near boundaries
 * - Performance-optimized constraint checking
 * - Integration with SuperGrid systems
 */

import type {
  BoundaryConstraints,
  CartographicConfig,
  CartographicState
} from '../types/supergrid';

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface GridDimensions {
  width: number;
  height: number;
}

export interface LayoutOffsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface ElasticBehavior {
  enabled: boolean;
  resistance: number; // 0-1, how much resistance near boundaries
  bounceStrength: number; // 0-1, strength of bounce-back
  resistanceZone: number; // pixels from boundary where resistance starts
}

export interface ConstraintResult {
  x: number;
  y: number;
  hitBoundary: boolean;
  boundaryDirection?: 'left' | 'right' | 'top' | 'bottom';
  elasticResistance?: number;
  bounceStrength?: number;
}

export class ViewportService {
  private viewport: ViewportDimensions;
  private grid: GridDimensions;
  private offsets: LayoutOffsets;
  private elasticBehavior: ElasticBehavior;

  // Cached boundary constraints for performance
  private cachedConstraints: BoundaryConstraints | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 100; // ms

  constructor(
    viewport: ViewportDimensions,
    grid: GridDimensions,
    offsets: LayoutOffsets = { top: 0, left: 0, right: 0, bottom: 0 },
    elasticBehavior: ElasticBehavior = {
      enabled: true,
      resistance: 0.3,
      bounceStrength: 0.5,
      resistanceZone: 50
    }
  ) {
    this.viewport = viewport;
    this.grid = grid;
    this.offsets = offsets;
    this.elasticBehavior = elasticBehavior;
  }

  // ========================================================================
  // Boundary Constraint Calculation
  // ========================================================================

  /**
   * Calculate boundary constraints for given scale
   */
  calculateBoundaryConstraints(scale: number = 1.0): BoundaryConstraints {
    const now = performance.now();

    // Use cached constraints if still valid and scale hasn't changed significantly
    if (this.cachedConstraints &&
        (now - this.cacheTimestamp) < this.CACHE_DURATION &&
        Math.abs(this.cachedConstraints.right / this.grid.width - scale) < 0.01) {
      return this.cachedConstraints;
    }

    const scaledGridWidth = this.grid.width * scale;
    const scaledGridHeight = this.grid.height * scale;

    // Calculate effective viewport area after offsets
    const effectiveViewport = {
      width: this.viewport.width - this.offsets.left - this.offsets.right,
      height: this.viewport.height - this.offsets.top - this.offsets.bottom
    };

    // Calculate boundaries
    // Grid should not pan beyond viewport edges
    const constraints: BoundaryConstraints = {
      // Left: Grid's right edge should not go past viewport's left edge
      left: Math.min(0, effectiveViewport.width - scaledGridWidth),

      // Right: Grid's left edge should not go past viewport's right edge
      right: Math.max(0, this.offsets.left),

      // Top: Grid's bottom edge should not go past viewport's top edge
      top: Math.min(0, effectiveViewport.height - scaledGridHeight),

      // Bottom: Grid's top edge should not go past viewport's bottom edge
      bottom: Math.max(0, this.offsets.top),

      // Offsets for other systems
      topOffset: this.offsets.top,
      leftOffset: this.offsets.left
    };

    // Cache the result
    this.cachedConstraints = constraints;
    this.cacheTimestamp = now;

    return constraints;
  }

  /**
   * Apply boundary constraints to a position with optional elastic behavior
   */
  applyConstraints(
    x: number,
    y: number,
    scale: number = 1.0,
    enableElastic: boolean = this.elasticBehavior.enabled
  ): ConstraintResult {
    const constraints = this.calculateBoundaryConstraints(scale);

    let constrainedX = x;
    let constrainedY = y;
    let hitBoundary = false;
    let boundaryDirection: 'left' | 'right' | 'top' | 'bottom' | undefined;
    let elasticResistance: number | undefined;

    // Apply elastic resistance if enabled and near boundaries
    if (enableElastic) {
      const elasticResult = this.applyElasticResistance(x, y, constraints);
      constrainedX = elasticResult.x;
      constrainedY = elasticResult.y;
      elasticResistance = elasticResult.resistance;
    }

    // Apply hard constraints
    if (constrainedX < constraints.left) {
      constrainedX = constraints.left;
      hitBoundary = true;
      boundaryDirection = 'left';
    } else if (constrainedX > constraints.right) {
      constrainedX = constraints.right;
      hitBoundary = true;
      boundaryDirection = 'right';
    }

    if (constrainedY < constraints.top) {
      constrainedY = constraints.top;
      hitBoundary = true;
      boundaryDirection = 'top';
    } else if (constrainedY > constraints.bottom) {
      constrainedY = constraints.bottom;
      hitBoundary = true;
      boundaryDirection = 'bottom';
    }

    return {
      x: constrainedX,
      y: constrainedY,
      hitBoundary,
      boundaryDirection,
      elasticResistance,
      bounceStrength: hitBoundary ? this.elasticBehavior.bounceStrength : undefined
    };
  }

  /**
   * Apply elastic resistance near boundaries
   */
  private applyElasticResistance(
    x: number,
    y: number,
    constraints: BoundaryConstraints
  ): { x: number; y: number; resistance: number } {
    let resistanceX = x;
    let resistanceY = y;
    let maxResistance = 0;

    const zone = this.elasticBehavior.resistanceZone;
    const resistance = this.elasticBehavior.resistance;

    // X-axis resistance
    if (x < constraints.left - zone) {
      const overshoot = constraints.left - zone - x;
      const resistanceFactor = Math.min(1, overshoot / zone);
      resistanceX = constraints.left - zone + overshoot * resistance;
      maxResistance = Math.max(maxResistance, resistanceFactor);
    } else if (x > constraints.right + zone) {
      const overshoot = x - (constraints.right + zone);
      const resistanceFactor = Math.min(1, overshoot / zone);
      resistanceX = constraints.right + zone + overshoot * resistance;
      maxResistance = Math.max(maxResistance, resistanceFactor);
    }

    // Y-axis resistance
    if (y < constraints.top - zone) {
      const overshoot = constraints.top - zone - y;
      const resistanceFactor = Math.min(1, overshoot / zone);
      resistanceY = constraints.top - zone + overshoot * resistance;
      maxResistance = Math.max(maxResistance, resistanceFactor);
    } else if (y > constraints.bottom + zone) {
      const overshoot = y - (constraints.bottom + zone);
      const resistanceFactor = Math.min(1, overshoot / zone);
      resistanceY = constraints.bottom + zone + overshoot * resistance;
      maxResistance = Math.max(maxResistance, resistanceFactor);
    }

    return {
      x: resistanceX,
      y: resistanceY,
      resistance: maxResistance
    };
  }

  // ========================================================================
  // Boundary Status Checking
  // ========================================================================

  /**
   * Check which boundaries are currently active
   */
  getBoundaryStatus(state: CartographicState): {
    atLeftBoundary: boolean;
    atRightBoundary: boolean;
    atTopBoundary: boolean;
    atBottomBoundary: boolean;
  } {
    const constraints = this.calculateBoundaryConstraints(state.scale);
    const tolerance = 1; // pixel tolerance for boundary detection

    return {
      atLeftBoundary: Math.abs(state.transform.x - constraints.left) < tolerance,
      atRightBoundary: Math.abs(state.transform.x - constraints.right) < tolerance,
      atTopBoundary: Math.abs(state.transform.y - constraints.top) < tolerance,
      atBottomBoundary: Math.abs(state.transform.y - constraints.bottom) < tolerance
    };
  }

  /**
   * Check if position is near any boundary
   */
  isNearBoundary(x: number, y: number, scale: number = 1.0, threshold: number = 20): boolean {
    const constraints = this.calculateBoundaryConstraints(scale);

    return (
      Math.abs(x - constraints.left) < threshold ||
      Math.abs(x - constraints.right) < threshold ||
      Math.abs(y - constraints.top) < threshold ||
      Math.abs(y - constraints.bottom) < threshold
    );
  }

  /**
   * Get distance to nearest boundary
   */
  getDistanceToBoundary(x: number, y: number, scale: number = 1.0): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    nearest: number;
  } {
    const constraints = this.calculateBoundaryConstraints(scale);

    const distances = {
      left: Math.abs(x - constraints.left),
      right: Math.abs(x - constraints.right),
      top: Math.abs(y - constraints.top),
      bottom: Math.abs(y - constraints.bottom)
    };

    return {
      ...distances,
      nearest: Math.min(distances.left, distances.right, distances.top, distances.bottom)
    };
  }

  // ========================================================================
  // Configuration Management
  // ========================================================================

  /**
   * Update viewport dimensions
   */
  updateViewport(dimensions: ViewportDimensions): void {
    this.viewport = dimensions;
    this.invalidateCache();
  }

  /**
   * Update grid dimensions
   */
  updateGrid(dimensions: GridDimensions): void {
    this.grid = dimensions;
    this.invalidateCache();
  }

  /**
   * Update layout offsets (headers, sidebars, etc.)
   */
  updateOffsets(offsets: Partial<LayoutOffsets>): void {
    this.offsets = { ...this.offsets, ...offsets };
    this.invalidateCache();
  }

  /**
   * Update elastic behavior configuration
   */
  updateElasticBehavior(behavior: Partial<ElasticBehavior>): void {
    this.elasticBehavior = { ...this.elasticBehavior, ...behavior };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): {
    viewport: ViewportDimensions;
    grid: GridDimensions;
    offsets: LayoutOffsets;
    elasticBehavior: ElasticBehavior;
  } {
    return {
      viewport: { ...this.viewport },
      grid: { ...this.grid },
      offsets: { ...this.offsets },
      elasticBehavior: { ...this.elasticBehavior }
    };
  }

  // ========================================================================
  // Integration Helpers
  // ========================================================================

  /**
   * Create ViewportService from CartographicConfig
   */
  static fromCartographicConfig(config: CartographicConfig): ViewportService {
    return new ViewportService(
      config.viewportDimensions,
      config.gridDimensions,
      { top: 0, left: 0, right: 0, bottom: 0 },
      config.elasticBounds || {
        enabled: true,
        resistance: 0.3,
        bounceStrength: 0.5,
        resistanceZone: 50
      }
    );
  }

  /**
   * Update from header state (SuperGrid integration)
   */
  updateFromHeaderState(headerState: { totalHeight: number; isExpanded: boolean }): void {
    this.updateOffsets({ top: headerState.totalHeight });
  }

  /**
   * Update from sidebar state (if applicable)
   */
  updateFromSidebarState(sidebarState: { width: number; isVisible: boolean }): void {
    this.updateOffsets({ left: sidebarState.isVisible ? sidebarState.width : 0 });
  }

  /**
   * Calculate optimal viewport position for displaying specific content
   */
  calculateOptimalPosition(contentBounds: { x: number; y: number; width: number; height: number }): {
    x: number;
    y: number;
  } {
    const constraints = this.calculateBoundaryConstraints(1.0);

    // Center content in viewport if possible
    const targetX = -contentBounds.x + (this.viewport.width - contentBounds.width) / 2;
    const targetY = -contentBounds.y + (this.viewport.height - contentBounds.height) / 2;

    // Apply constraints
    const result = this.applyConstraints(targetX, targetY, 1.0, false);

    return { x: result.x, y: result.y };
  }

  // ========================================================================
  // Performance and Debugging
  // ========================================================================

  /**
   * Invalidate cached constraints
   */
  private invalidateCache(): void {
    this.cachedConstraints = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    cacheHitRate: number;
    lastCacheUpdate: number;
    constraintCalculations: number;
  } {
    // This would be enhanced with actual metrics tracking
    return {
      cacheHitRate: 0.85, // Placeholder
      lastCacheUpdate: this.cacheTimestamp,
      constraintCalculations: 0 // Would track actual calculations
    };
  }

  /**
   * Debug: Get detailed constraint information
   */
  debug(): {
    viewport: ViewportDimensions;
    grid: GridDimensions;
    offsets: LayoutOffsets;
    constraints: BoundaryConstraints;
    elasticBehavior: ElasticBehavior;
    cacheStatus: { valid: boolean; age: number };
  } {
    const now = performance.now();
    const constraints = this.calculateBoundaryConstraints();

    return {
      viewport: this.viewport,
      grid: this.grid,
      offsets: this.offsets,
      constraints,
      elasticBehavior: this.elasticBehavior,
      cacheStatus: {
        valid: this.cachedConstraints !== null && (now - this.cacheTimestamp) < this.CACHE_DURATION,
        age: now - this.cacheTimestamp
      }
    };
  }
}