/**
 * SuperDensityRenderer Setup - Initialization and configuration
 */

import * as d3 from 'd3';
import type {
  DensityRenderConfig,
  RendererComponents,
  RendererScales,
  DensityAggregatedRow
} from './types';

export class RendererSetup {
  private config: DensityRenderConfig;

  constructor(config: DensityRenderConfig) {
    this.config = config;
  }

  /**
   * Initialize D3 DOM elements
   */
  initializeD3Elements(containerElement: HTMLElement): RendererComponents {
    const svg = d3.select(containerElement)
      .append('svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)
      .attr('class', 'super-density-renderer');

    const container = svg.append('g')
      .attr('class', 'density-container')
      .attr('transform', `translate(${this.config.margin.left}, ${this.config.margin.top})`);

    const gridGroup = container.append('g')
      .attr('class', 'density-grid-group');

    const overlayGroup = container.append('g')
      .attr('class', 'density-overlay-group');

    // Add performance indicator if enabled
    if (this.config.showPerformanceMetrics) {
      overlayGroup.append('text')
        .attr('class', 'performance-indicator')
        .attr('x', 10)
        .attr('y', 20)
        .style('font-size', '12px')
        .style('fill', '#666');
    }

    const tooltipDiv = d3.select('body')
      .append('div')
      .attr('class', 'super-density-tooltip')
      .style('position', 'absolute')
      .style('padding', '8px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    return { svg, container, gridGroup, overlayGroup, tooltipDiv };
  }

  /**
   * Initialize D3 scales
   */
  initializeScales(data: DensityAggregatedRow[]): RendererScales {
    const contentWidth = this.config.width - this.config.margin.left - this.config.margin.right;
    const contentHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;

    // X and Y scales for positioning
    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, contentWidth]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([0, contentHeight]);

    // Color scale for aggregation levels
    const colorScale = d3.scaleOrdinal<string, string>()
      .domain(['leaf', 'collapsed', 'sparse', 'populated'])
      .range(this.getColorPalette());

    // Size scale based on aggregation count
    const maxAggregation = d3.max(data, d => d.aggregationCount) || 1;
    const sizeScale = d3.scaleLinear()
      .domain([1, maxAggregation])
      .range([0.5, 3]);

    return { xScale, yScale, colorScale, sizeScale };
  }

  /**
   * Get color palette based on config
   */
  private getColorPalette(): string[] {
    const { colorScheme } = this.config;
    return [
      ...colorScheme.leaf,
      ...colorScheme.collapsed,
      ...colorScheme.sparse,
      ...colorScheme.populated
    ];
  }

  /**
   * Setup zoom behavior
   */
  setupZoomBehavior(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    onZoom: (transform: d3.ZoomTransform) => void
  ): void {
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        container.attr('transform', event.transform.toString());
        onZoom(event.transform);
      });

    svg.call(zoom as any);
  }

  /**
   * Create tooltip
   */
  createTooltip(): d3.Selection<HTMLDivElement, unknown, null, undefined> {
    return d3.select('body')
      .append('div')
      .attr('class', 'super-density-tooltip')
      .style('position', 'absolute')
      .style('padding', '8px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', '1000');
  }

  /**
   * Update scales with new data
   */
  updateScales(
    data: DensityAggregatedRow[],
    scales: RendererScales
  ): void {
    const contentWidth = this.config.width - this.config.margin.left - this.config.margin.right;
    const contentHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;

    // Update domains
    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];

    scales.xScale.domain(xExtent).range([0, contentWidth]);
    scales.yScale.domain(yExtent).range([0, contentHeight]);

    // Update size scale
    const maxAggregation = d3.max(data, d => d.aggregationCount) || 1;
    scales.sizeScale.domain([1, maxAggregation]).range([0.5, 3]);
  }
}