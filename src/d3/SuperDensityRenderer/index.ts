/**
 * SuperDensityRenderer - Modular D3.js Density Visualization
 *
 * Main orchestrator that coordinates setup, rendering modes, and interactions.
 * Split from monolithic implementation for better maintainability.
 */

import * as d3 from 'd3';
import type {
  DensityRenderConfig,
  DensityVisualState,
  DensityAggregationResult,
  DensityAggregatedRow,
  JanusDensityState,
  RenderTiming,
  RendererComponents,
  RendererScales
} from './types';
import { RendererSetup } from './Setup';
import { RenderModes } from './RenderModes';
import { InteractionManager } from './InteractionManager';
import { superGridLogger } from '@/utils/logging/dev-logger';

// Re-export types
export * from './types';

export class SuperDensityRenderer {
  private setup: RendererSetup;
  private renderModes: RenderModes;
  private interactionManager: InteractionManager;

  private components?: RendererComponents;
  private scales?: RendererScales;

  private currentData: DensityAggregatedRow[] = [];
  private currentState: JanusDensityState;
  private visualState: DensityVisualState;
  private config: DensityRenderConfig;

  constructor(config: DensityRenderConfig, initialState: JanusDensityState) {
    this.config = config;
    this.currentState = initialState;
    this.visualState = {
      mode: 'grid',
      selectedCells: new Set(),
      hoveredCell: null,
      zoomLevel: 1,
      panOffset: { x: 0, y: 0 },
      isAnimating: false,
      lastRenderTime: 0,
      renderCount: 0
    };

    // Initialize modules
    this.setup = new RendererSetup(config);

    // Other modules will be initialized after DOM setup
    this.renderModes = null as any;
    this.interactionManager = null as any;

    superGridLogger.lifecycle('SuperDensityRenderer initialized');
  }

  /**
   * Initialize renderer with DOM container
   */
  initialize(containerElement: HTMLElement): void {
    // Setup DOM and scales
    this.components = this.setup.initializeD3Elements(containerElement);
    this.scales = this.setup.initializeScales(this.currentData);

    // Initialize other modules now that we have components and scales
    this.renderModes = new RenderModes(this.config, this.components, this.scales);
    this.interactionManager = new InteractionManager(this.config, this.components, this.visualState);

    // Setup zoom behavior
    this.setup.setupZoomBehavior(
      this.components.svg,
      this.components.container,
      (transform: d3.ZoomTransform) => {
        this.visualState.zoomLevel = transform.k;
        this.visualState.panOffset = { x: transform.x, y: transform.y };
      }
    );

    superGridLogger.lifecycle('SuperDensityRenderer DOM initialized');
  }

  /**
   * Main render method - processes aggregation result and renders visualization
   */
  async render(aggregationResult: DensityAggregationResult): Promise<void> {
    if (!this.components || !this.scales || !this.renderModes) {
      throw new Error('Renderer not initialized. Call initialize() first.');
    }

    this.visualState.isAnimating = true;

    try {
      // Update state and data
      this.currentState = aggregationResult.janusState;
      this.currentData = aggregationResult.aggregatedRows;

      // Update scales with new data
      this.setup.updateScales(this.currentData, this.scales);

      // Determine render mode based on density state
      const renderMode = this.renderModes.mapViewDensityToRenderMode(
        this.currentState.viewDensity
      );
      this.visualState.mode = renderMode;

      // Render based on mode
      let timing: RenderTiming;
      switch (renderMode) {
        case 'grid':
          timing = await this.renderModes.renderGridMode(this.currentData);
          break;
        case 'matrix':
          timing = await this.renderModes.renderMatrixMode(this.currentData);
          break;
        case 'hybrid':
          timing = await this.renderModes.renderHybridMode(this.currentData);
          break;
        default:
          throw new Error(`Unknown render mode: ${renderMode}`);
      }

      // Setup interactions on rendered cells
      this.setupInteractions();

      // Render labels if appropriate
      await this.renderCellLabels();

      // Update performance indicators
      this.updatePerformanceIndicator(timing);

      this.visualState.lastRenderTime = timing.duration;
      this.visualState.renderCount++;

      superGridLogger.render('Render complete', {
        mode: renderMode,
        cellCount: this.currentData.length,
        duration: timing.duration
      });

    } catch (error) {
      superGridLogger.error('Render failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      this.visualState.isAnimating = false;
    }
  }

  /**
   * Setup interaction handlers on rendered cells
   */
  private setupInteractions(): void {
    if (!this.components || !this.interactionManager) return;

    // Setup interactions on all cell types
    const allCells = this.components.gridGroup.selectAll(
      '.grid-cells, .matrix-cells, .hybrid-grid-cells, .hybrid-matrix-cells'
    );

    this.interactionManager.setupCellInteractions(allCells);
  }

  /**
   * Render cell labels
   */
  private async renderCellLabels(): Promise<void> {
    if (!this.components || !this.scales || !this.renderModes) return;

    // Filter data that should have labels
    const labelData = this.currentData.filter(row =>
      this.renderModes.shouldShowLabel(row)
    );

    const labels = this.components.overlayGroup
      .selectAll<SVGTextElement, DensityAggregatedRow>('.cell-label')
      .data(labelData, (d: DensityAggregatedRow) => d.cellId);

    const labelsEnter = labels.enter()
      .append('text')
      .attr('class', 'cell-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '10px')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    const labelsUpdate = labels.merge(labelsEnter);

    labelsUpdate
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', d => this.scales!.xScale(d.x) + this.config.cellWidth / 2)
      .attr('y', d => this.scales!.yScale(d.y) + this.config.cellHeight / 2)
      .text(d => this.renderModes!.formatCellLabel(d))
      .style('opacity', 1);

    labels.exit()
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Update performance indicator
   */
  private updatePerformanceIndicator(timing: RenderTiming): void {
    if (!this.config.showPerformanceMetrics || !this.components) return;

    const indicator = this.components.overlayGroup.select('.performance-indicator');
    if (indicator.empty()) return;

    const fps = timing.duration > 0 ? Math.round(1000 / timing.duration) : 0;
    const text = `${timing.cellCount} cells | ${timing.duration.toFixed(1)}ms | ${fps} fps | ${timing.mode}`;

    indicator.text(text);
  }

  /**
   * Set interaction callbacks
   */
  setCallbacks(callbacks: {
    onCellClick?: (row: DensityAggregatedRow) => void;
    onCellHover?: (row: DensityAggregatedRow | null) => void;
    onSelectionChange?: (selectedCells: Set<string>) => void;
  }): void {
    if (this.interactionManager) {
      this.interactionManager.setCallbacks(callbacks);
    }
  }

  /**
   * Get current visual state
   */
  getVisualState(): DensityVisualState {
    return { ...this.visualState };
  }

  /**
   * Get selected cells
   */
  getSelectedCells(): Set<string> {
    return this.interactionManager?.getSelectedCells() || new Set();
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.interactionManager?.clearSelection();
  }

  /**
   * Select cells programmatically
   */
  selectCells(cellIds: string[]): void {
    this.interactionManager?.selectCells(cellIds);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DensityRenderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setup = new RendererSetup(this.config);

    if (this.components && this.scales) {
      this.renderModes = new RenderModes(this.config, this.components, this.scales);
      this.interactionManager = new InteractionManager(this.config, this.components, this.visualState);
    }
  }

  /**
   * Destroy renderer and cleanup resources
   */
  destroy(): void {
    if (this.components) {
      this.components.svg.remove();
      this.components.tooltipDiv.remove();
    }

    superGridLogger.lifecycle('SuperDensityRenderer destroyed');
  }
}

export default SuperDensityRenderer;