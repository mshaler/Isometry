/**
 * SuperDensityRenderer Render Modes - Grid, Matrix, and Hybrid rendering
 */

import type {
  DensityRenderConfig,
  RendererComponents,
  RendererScales,
  DensityAggregatedRow,
  RenderTiming
} from './types';
import { superGridLogger } from '@/utils/logging/dev-logger';

export class RenderModes {
  private config: DensityRenderConfig;
  private components: RendererComponents;
  private scales: RendererScales;

  constructor(
    config: DensityRenderConfig,
    components: RendererComponents,
    scales: RendererScales
  ) {
    this.config = config;
    this.components = components;
    this.scales = scales;
  }

  /**
   * Render in grid mode - traditional grid layout
   */
  async renderGridMode(data: DensityAggregatedRow[]): Promise<RenderTiming> {
    const startTime = performance.now();

    await this.renderDataAsGrid(data, 'grid-cells');

    const endTime = performance.now();
    const timing = {
      startTime,
      endTime,
      duration: endTime - startTime,
      cellCount: data.length,
      mode: 'grid'
    };

    superGridLogger.performance('Grid mode render complete', timing);
    return timing;
  }

  /**
   * Render in matrix mode - density-optimized matrix visualization
   */
  async renderMatrixMode(data: DensityAggregatedRow[]): Promise<RenderTiming> {
    const startTime = performance.now();

    await this.renderDataAsMatrix(data, 'matrix-cells');

    const endTime = performance.now();
    const timing = {
      startTime,
      endTime,
      duration: endTime - startTime,
      cellCount: data.length,
      mode: 'matrix'
    };

    superGridLogger.performance('Matrix mode render complete', timing);
    return timing;
  }

  /**
   * Render in hybrid mode - adaptive visualization based on density
   */
  async renderHybridMode(data: DensityAggregatedRow[]): Promise<RenderTiming> {
    const startTime = performance.now();

    // Split data based on aggregation level
    const gridData = data.filter(row => row.aggregationCount <= 5);
    const matrixData = data.filter(row => row.aggregationCount > 5);

    // Render both modes
    await Promise.all([
      this.renderDataAsGrid(gridData, 'hybrid-grid-cells'),
      this.renderDataAsMatrix(matrixData, 'hybrid-matrix-cells')
    ]);

    const endTime = performance.now();
    const timing = {
      startTime,
      endTime,
      duration: endTime - startTime,
      cellCount: data.length,
      mode: 'hybrid'
    };

    superGridLogger.performance('Hybrid mode render complete', timing);
    return timing;
  }

  /**
   * Render data as grid cells
   */
  private async renderDataAsGrid(data: DensityAggregatedRow[], className: string): Promise<void> {
    const cells = this.components.gridGroup
      .selectAll<SVGRectElement, DensityAggregatedRow>(`.${className}`)
      .data(data, (d: DensityAggregatedRow) => d.cellId);

    const cellEnter = cells.enter()
      .append('rect')
      .attr('class', className)
      .attr('x', d => this.scales.xScale(d.x))
      .attr('y', d => this.scales.yScale(d.y))
      .attr('width', 0)
      .attr('height', 0)
      .attr('fill', d => this.getColorValue(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');

    const cellUpdate = cells.merge(cellEnter);

    // Animate to final size
    cellUpdate
      .transition()
      .duration(this.config.transitionDuration)
      .attr('x', d => this.scales.xScale(d.x))
      .attr('y', d => this.scales.yScale(d.y))
      .attr('width', d => this.config.cellWidth * this.getSizeMultiplier(d))
      .attr('height', d => this.config.cellHeight * this.getSizeMultiplier(d))
      .attr('fill', d => this.getColorValue(d));

    cells.exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('width', 0)
      .attr('height', 0)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Render data as matrix cells with density-based sizing
   */
  private async renderDataAsMatrix(data: DensityAggregatedRow[], className: string): Promise<void> {
    const cells = this.components.gridGroup
      .selectAll<SVGCircleElement, DensityAggregatedRow>(`.${className}`)
      .data(data, (d: DensityAggregatedRow) => d.cellId);

    const cellEnter = cells.enter()
      .append('circle')
      .attr('class', className)
      .attr('cx', d => this.scales.xScale(d.x) + this.config.cellWidth / 2)
      .attr('cy', d => this.scales.yScale(d.y) + this.config.cellHeight / 2)
      .attr('r', 0)
      .attr('fill', d => this.getColorValue(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');

    const cellUpdate = cells.merge(cellEnter);

    // Animate to final size
    cellUpdate
      .transition()
      .duration(this.config.transitionDuration)
      .attr('cx', d => this.scales.xScale(d.x) + this.config.cellWidth / 2)
      .attr('cy', d => this.scales.yScale(d.y) + this.config.cellHeight / 2)
      .attr('r', d => Math.min(this.config.cellWidth, this.config.cellHeight) / 3 * this.getSizeMultiplier(d))
      .attr('fill', d => this.getColorValue(d));

    cells.exit()
      .transition()
      .duration(this.config.transitionDuration)
      .attr('r', 0)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Get color value for a row based on aggregation state
   */
  private getColorValue(row: DensityAggregatedRow): string {
    if (row.aggregationCount === 1) return this.scales.colorScale('leaf');
    if (row.aggregationCount <= 5) return this.scales.colorScale('collapsed');
    if (row.sparsityRatio < 0.5) return this.scales.colorScale('populated');
    return this.scales.colorScale('sparse');
  }

  /**
   * Get size multiplier based on aggregation count
   */
  private getSizeMultiplier(row: DensityAggregatedRow): number {
    return this.scales.sizeScale(row.aggregationCount);
  }

  /**
   * Map view density to render mode
   */
  mapViewDensityToRenderMode(viewDensity: string): 'grid' | 'matrix' | 'hybrid' {
    switch (viewDensity) {
      case 'ultra-sparse':
      case 'sparse':
        return 'grid';
      case 'dense':
      case 'ultra-dense':
        return 'matrix';
      case 'medium':
      default:
        return 'hybrid';
    }
  }

  /**
   * Check if labels should be shown for a row
   */
  shouldShowLabel(row: DensityAggregatedRow): boolean {
    // Show labels only for single items or important aggregations
    return row.aggregationCount === 1 ||
           (row.aggregationCount <= 3 && row.sparsityRatio < 0.3);
  }

  /**
   * Format cell label
   */
  formatCellLabel(row: DensityAggregatedRow): string {
    if (row.aggregationCount === 1) {
      return row.label || `(${row.x}, ${row.y})`;
    }
    return `${row.aggregationCount} items`;
  }
}