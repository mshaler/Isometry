/**
 * Core ViewEngine interface for unified rendering architecture
 *
 * Defines the contract for all view renderers in the Isometry ecosystem.
 * Implements "D3 renders, React controls" principle for zero-serialization bridge.
 */

import type { Node } from '@/types/node';
import type { ViewConfig } from './ViewConfig';

/**
 * Core rendering interface for all view types
 */
export interface ViewEngine {
  /**
   * Primary render method - executes D3 visualization for given data and config
   *
   * @param container - DOM element to render into
   * @param data - Array of nodes to visualize
   * @param config - ViewConfig containing viewType, projection, filters, and styling
   * @returns Promise that resolves when rendering is complete
   */
  render(container: HTMLElement, data: Node[], config: ViewConfig): Promise<void>;

  /**
   * Animated transition between view configurations
   *
   * Enables seamless transitions between different PAFV projections,
   * view types, or filter states with preservation of selection state.
   *
   * @param fromConfig - Current view configuration
   * @param toConfig - Target view configuration
   * @param duration - Animation duration in milliseconds (default: 300)
   * @returns Promise that resolves when transition is complete
   */
  transition(fromConfig: ViewConfig, toConfig: ViewConfig, duration?: number): Promise<void>;

  /**
   * Clean up all D3 selections, event listeners, and allocated resources
   *
   * Must be called when view is unmounted to prevent memory leaks.
   * Should remove all DOM elements created during rendering.
   */
  destroy(): void;

  /**
   * Get current view configuration
   *
   * @returns Current ViewConfig state
   */
  getConfig(): ViewConfig | null;

  /**
   * Check if renderer can handle the specified view type
   *
   * @param viewType - View type to check compatibility for
   * @returns true if this renderer supports the view type
   */
  supportsViewType(viewType: string): boolean;
}

/**
 * Simplified renderer interface for single-view implementations
 *
 * Used by view-specific renderers (GridRenderer, ListView, etc.) that only
 * handle one view type. IsometryViewEngine uses this to dispatch to specific renderers.
 */
export interface ViewRenderer {
  /**
   * Render this specific view type
   *
   * @param container - DOM element to render into
   * @param data - Array of nodes to visualize
   * @param config - ViewConfig containing projection and styling
   */
  render(container: HTMLElement, data: Node[], config: ViewConfig): void;

  /**
   * Clean up this renderer's resources
   */
  destroy(): void;

  /**
   * Get the view type this renderer handles
   */
  getViewType(): string;
}


/**
 * Performance metrics for view rendering operations
 */
export interface ViewPerformanceMetrics {
  /** Time to complete last render operation (ms) */
  lastRenderTime: number;

  /** Average render time over recent operations */
  averageRenderTime: number;

  /** Number of nodes rendered in last operation */
  nodesRendered: number;

  /** Frame rate during last animation */
  frameRate: number;

  /** Memory usage estimate (MB) */
  memoryUsage: number;

  /** Whether last operation met performance targets */
  withinTarget: boolean;
}