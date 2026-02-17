/**
 * Timeline Zoom Module
 *
 * D3 zoom behavior for timeline panning and zooming.
 * Supports wheel zoom and drag pan with configurable scale extent.
 */

import * as d3 from 'd3';
import { getAdaptiveTickFormat } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TimelineZoomConfig {
  /** Minimum zoom scale (default: 0.5) */
  minScale?: number;
  /** Maximum zoom scale (default: 10) */
  maxScale?: number;
}

export interface TimelineZoomResult {
  /** The D3 zoom behavior */
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  /** Reset zoom to identity transform */
  resetZoom: () => void;
  /** Get current transform */
  getTransform: () => d3.ZoomTransform;
}

// ============================================================================
// Zoom Factory
// ============================================================================

/**
 * Create timeline zoom behavior
 *
 * @param svg - SVG element selection to attach zoom to
 * @param xScale - Original X scale (time scale) to rescale
 * @param onZoom - Callback when zoom/pan occurs
 * @param config - Zoom configuration
 */
export function createTimelineZoom(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  xScale: d3.ScaleTime<number, number>,
  onZoom: (transform: d3.ZoomTransform, newXScale: d3.ScaleTime<number, number>) => void,
  config: TimelineZoomConfig = {}
): TimelineZoomResult {
  const { minScale = 0.5, maxScale = 10 } = config;

  // Store the original scale for reset
  const originalXScale = xScale.copy();

  // Current transform state
  let currentTransform = d3.zoomIdentity;

  // Create zoom behavior
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([minScale, maxScale])
    .translateExtent([
      [-Infinity, -Infinity],
      [Infinity, Infinity],
    ])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      currentTransform = event.transform;

      // Rescale X axis
      const newXScale = event.transform.rescaleX(originalXScale);

      // Call the callback with the new scale
      onZoom(event.transform, newXScale);
    });

  // Apply zoom behavior to SVG
  svg.call(zoom);

  // Reset zoom function
  function resetZoom(): void {
    svg
      .transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  }

  // Get current transform
  function getTransform(): d3.ZoomTransform {
    return currentTransform;
  }

  return {
    zoom,
    resetZoom,
    getTransform,
  };
}

/**
 * Apply zoom transform to timeline elements
 *
 * This function updates the timeline visualization based on the
 * current zoom transform. Call this from the onZoom callback.
 *
 * @param container - SVG group containing timeline elements
 * @param newXScale - Rescaled X scale from zoom transform
 * @param xAxisGroup - X axis group element to update
 */
// Track pending rAF for zoom updates to avoid multiple frames queuing
let pendingZoomFrame: number | null = null;

export function applyTimelineZoom(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  newXScale: d3.ScaleTime<number, number>,
  xAxisGroup: d3.Selection<SVGGElement, unknown, null, undefined>
): void {
  // Cancel any pending frame to prevent queuing multiple updates
  if (pendingZoomFrame !== null) {
    cancelAnimationFrame(pendingZoomFrame);
  }

  // Use requestAnimationFrame for smooth 60 FPS zoom/pan updates
  pendingZoomFrame = requestAnimationFrame(() => {
    pendingZoomFrame = null;

    // Use adaptive tick format based on current visible domain
    const [domainStart, domainEnd] = newXScale.domain() as [Date, Date];
    const adaptiveFormat = getAdaptiveTickFormat([domainStart, domainEnd]);

    // Update X axis with adaptive tick labels
    const xAxis = d3
      .axisBottom(newXScale)
      .ticks(Math.max(3, 6))
      .tickFormat(d => d3.timeFormat(adaptiveFormat)(d as Date));

    xAxisGroup.call(xAxis);

    // Style axis
    xAxisGroup.selectAll('text').attr('fill', '#6b7280').attr('font-size', '11px');
    xAxisGroup.selectAll('line, path').attr('stroke', '#d1d5db');

    // Update event positions — only render events within visible domain
    const [visStart, visEnd] = newXScale.domain() as [Date, Date];
    container
      .selectAll<SVGCircleElement, { timestamp: Date }>('circle.event')
      .style('display', d =>
        d.timestamp >= visStart && d.timestamp <= visEnd ? null : 'none'
      )
      .attr('cx', d => newXScale(d.timestamp));
  });
}

