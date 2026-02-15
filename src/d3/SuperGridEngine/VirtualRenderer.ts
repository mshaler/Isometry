/**
 * VirtualRenderer - Delegates to DataCellRenderer for virtualized rendering
 *
 * Part of Phase 93 - Polish & Performance (PERF-01)
 *
 * This class wraps DataCellRenderer to render only visible cells from
 * virtualized scrolling. It does NOT re-implement cell rendering logic -
 * all visual rendering is delegated to DataCellRenderer for consistency.
 */

import * as d3 from 'd3';
import { DataCellRenderer, type CellDensityState, type DataCellRenderOptions } from '@/d3/grid-rendering/DataCellRenderer';
import type { DataCellData, D3CoordinateSystem } from '@/types/grid';
import type { Node } from '@/types/node';

interface VirtualRendererConfig {
  /** Coordinate system for cell positioning */
  coordinateSystem: D3CoordinateSystem;
  /** Density state for rendering mode (leaf vs collapsed) */
  densityState: CellDensityState;
  /** Set of selected node IDs for visual highlighting */
  selectedIds: Set<string>;
  /** Callback when a cell is clicked */
  onCellClick?: (node: Node, event: MouseEvent) => void;
}

/**
 * VirtualRenderer - Delegates to DataCellRenderer for consistent cell rendering
 *
 * This class is a thin wrapper that:
 * 1. Receives visible cells from TanStack Virtual
 * 2. Delegates rendering to DataCellRenderer
 * 3. Handles config updates (density, selection)
 *
 * @example
 * ```typescript
 * const renderer = new VirtualRenderer(svgGroup, {
 *   coordinateSystem,
 *   densityState: { valueDensity: 'leaf' },
 *   selectedIds: new Set(),
 * });
 *
 * // Render only visible cells
 * renderer.render(visibleCells);
 *
 * // Update when selection changes
 * renderer.updateConfig({ selectedIds: newSelection });
 * ```
 */
export class VirtualRenderer {
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: VirtualRendererConfig;
  private dataCellRenderer: DataCellRenderer;

  constructor(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: VirtualRendererConfig
  ) {
    this.container = container;
    this.config = config;
    // Create DataCellRenderer instance with coordinate system
    this.dataCellRenderer = new DataCellRenderer(config.coordinateSystem);
  }

  /**
   * Render only visible cells by delegating to DataCellRenderer
   * Uses the same D3 join pattern and rendering logic as non-virtualized mode
   *
   * @param visibleCells - Cells that are currently visible in the viewport
   */
  render(visibleCells: DataCellData[]): void {
    if (!visibleCells || visibleCells.length === 0) {
      this.clear();
      return;
    }

    const { densityState, selectedIds, onCellClick } = this.config;

    // Build render options for DataCellRenderer
    const renderOptions: DataCellRenderOptions = {
      densityState,
      selectedIds,
      onCellClick,
      transitionDuration: 150, // Shorter transitions for virtualized scrolling
    };

    // Delegate to DataCellRenderer - it handles all D3 join logic
    this.dataCellRenderer.render(this.container, visibleCells, renderOptions);
  }

  /**
   * Update configuration (e.g., density state, selection changes)
   *
   * @param config - Partial config to merge with existing
   */
  updateConfig(config: Partial<VirtualRendererConfig>): void {
    this.config = { ...this.config, ...config };

    // Re-create DataCellRenderer if coordinate system changed
    if (config.coordinateSystem) {
      this.dataCellRenderer = new DataCellRenderer(config.coordinateSystem);
    }
  }

  /**
   * Clear all rendered cells
   * Called when scrolling causes all cells to exit viewport
   */
  clear(): void {
    this.container.selectAll('.data-cell').remove();
  }

  /**
   * Get current configuration for debugging
   */
  getConfig(): VirtualRendererConfig {
    return { ...this.config };
  }
}
