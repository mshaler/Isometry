// D3.js utility hooks for Isometry
// Extracts common D3 patterns into reusable hooks

import { useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { getTheme, type ThemeName } from '@/styles/themes';

// ============================================================================
// Types
// ============================================================================

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface D3Dimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margins;
}

export interface D3SVGContext {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  dimensions: D3Dimensions;
}

// Default margins
const DEFAULT_MARGINS: Margins = { top: 40, right: 20, bottom: 20, left: 100 };

// ============================================================================
// useD3Dimensions - Calculate dimensions from container
// ============================================================================

export function useD3Dimensions(
  containerRef: React.RefObject<HTMLDivElement>,
  margin: Partial<Margins> = {}
): D3Dimensions | null {
  const finalMargin = { ...DEFAULT_MARGINS, ...margin };

  if (!containerRef.current) return null;

  const width = containerRef.current.clientWidth;
  const height = containerRef.current.clientHeight;
  const innerWidth = width - finalMargin.left - finalMargin.right;
  const innerHeight = height - finalMargin.top - finalMargin.bottom;

  return {
    width,
    height,
    innerWidth,
    innerHeight,
    margin: finalMargin,
  };
}

// ============================================================================
// useD3SVG - Initialize SVG with standard setup
// ============================================================================

export function initD3SVG(
  svgRef: React.RefObject<SVGSVGElement>,
  containerRef: React.RefObject<HTMLDivElement>,
  margin: Partial<Margins> = {}
): D3SVGContext | null {
  if (!svgRef.current || !containerRef.current) return null;

  const finalMargin = { ...DEFAULT_MARGINS, ...margin };
  const width = containerRef.current.clientWidth;
  const height = containerRef.current.clientHeight;
  const innerWidth = width - finalMargin.left - finalMargin.right;
  const innerHeight = height - finalMargin.top - finalMargin.bottom;

  const svg = d3.select(svgRef.current);
  svg.selectAll('*').remove();
  svg.attr('width', width).attr('height', height);

  const g = svg
    .append('g')
    .attr('transform', `translate(${finalMargin.left},${finalMargin.top})`);

  return {
    svg,
    g,
    dimensions: {
      width,
      height,
      innerWidth,
      innerHeight,
      margin: finalMargin,
    },
  };
}

// ============================================================================
// useD3ColorScale - Theme-aware color scale
// ============================================================================

export function useD3ColorScale(domain: string[]): d3.ScaleOrdinal<string, string> {
  const { theme } = useTheme();
  const themeValues = getTheme(theme as ThemeName);

  return useMemo(() => {
    const scale = d3.scaleOrdinal<string>();
    scale.domain(domain);

    if (themeValues.chart.palette) {
      scale.range(themeValues.chart.palette);
    } else {
      scale.range(d3.schemeTableau10);
    }

    return scale;
  }, [domain, themeValues]);
}

// Standalone function version for use in useEffect
export function createColorScale(
  domain: string[],
  theme: ThemeName
): d3.ScaleOrdinal<string, string> {
  const themeValues = getTheme(theme);
  const scale = d3.scaleOrdinal<string>();
  scale.domain(domain);

  if (themeValues.chart.palette) {
    scale.range(themeValues.chart.palette);
  } else {
    scale.range(d3.schemeTableau10);
  }

  return scale;
}

// ============================================================================
// useD3Zoom - Add zoom behavior to SVG
// ============================================================================

export interface ZoomOptions {
  scaleExtent?: [number, number];
  translateExtent?: [[number, number], [number, number]];
  onZoom?: (transform: d3.ZoomTransform) => void;
}

export function setupZoom(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  options: ZoomOptions = {}
): d3.ZoomBehavior<SVGSVGElement, unknown> {
  const { scaleExtent = [0.2, 4], translateExtent, onZoom } = options;

  // Direct container usage - now properly typed as SVGGElement selection

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent(scaleExtent)
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
      onZoom?.(event.transform);
    });

  if (translateExtent) {
    zoom.translateExtent(translateExtent);
  }

  svg.call(zoom);

  return zoom;
}

// ============================================================================
// D3 Axis Styling - Theme-aware axis styling
// ============================================================================

export interface AxisStyleOptions {
  textRotation?: number;
  textAnchor?: 'start' | 'middle' | 'end';
}

export function styleAxis(
  axisGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  theme: ThemeName,
  options: AxisStyleOptions = {}
): void {
  const themeValues = getTheme(theme);
  const { textRotation, textAnchor } = options;

  axisGroup.selectAll('text')
    .attr('fill', themeValues.chart.axisText);

  if (textRotation !== undefined) {
    axisGroup.selectAll('text')
      .attr('transform', `rotate(${textRotation})`)
      .attr('text-anchor', textAnchor || 'end');
  }

  axisGroup.selectAll('line, path')
    .attr('stroke', themeValues.chart.axis);
}

// ============================================================================
// D3 Transitions - Standardized enter/update/exit animations
// ============================================================================

export const TRANSITION_DURATIONS = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

export function transitionEnter<GElement extends d3.BaseType, Datum>(
  selection: d3.Selection<GElement, Datum, d3.BaseType, unknown>,
  duration = TRANSITION_DURATIONS.slow
): d3.Transition<GElement, Datum, d3.BaseType, unknown> {
  return selection
    .style('opacity', 0)
    .transition()
    .duration(duration)
    .style('opacity', 1);
}

export function transitionExit<GElement extends d3.BaseType, Datum>(
  selection: d3.Selection<GElement, Datum, d3.BaseType, unknown>,
  duration = TRANSITION_DURATIONS.normal
): d3.Transition<GElement, Datum, d3.BaseType, unknown> {
  return selection
    .transition()
    .duration(duration)
    .style('opacity', 0)
    .remove();
}

export function transitionUpdate<GElement extends d3.BaseType, Datum>(
  selection: d3.Selection<GElement, Datum, d3.BaseType, unknown>,
  duration = TRANSITION_DURATIONS.normal
): d3.Transition<GElement, Datum, d3.BaseType, unknown> {
  return selection
    .transition()
    .duration(duration);
}

// ============================================================================
// D3 Event Handlers - Common interaction patterns
// ============================================================================

export function setupHoverEffect<GElement extends d3.BaseType, Datum>(
  selection: d3.Selection<GElement, Datum, d3.BaseType, unknown>,
  options: {
    hoverOpacity?: number;
    normalOpacity?: number;
    scale?: number;
  } = {}
): void {
  const { hoverOpacity = 0.8, normalOpacity = 1, scale } = options;

  selection
    .on('mouseenter', function () {
      const el = d3.select(this);
      el.attr('opacity', hoverOpacity);
      if (scale) {
        el.attr('transform', function () {
          const current = d3.select(this).attr('transform') || '';
          return `${current} scale(${scale})`;
        });
      }
    })
    .on('mouseleave', function () {
      const el = d3.select(this);
      el.attr('opacity', normalOpacity);
      if (scale) {
        el.attr('transform', function () {
          const current = d3.select(this).attr('transform') || '';
          return current.replace(/\s*scale\([^)]+\)/, '');
        });
      }
    });
}

// ============================================================================
// D3 Grid Lines - Theme-aware grid
// ============================================================================

export function drawGridLines(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  options: {
    xScale?: d3.ScaleBand<string> | d3.ScaleLinear<number, number> | d3.ScaleTime<number, number>;
    yScale?: d3.ScaleBand<string> | d3.ScaleLinear<number, number>;
    width: number;
    height: number;
    theme: ThemeName;
  }
): void {
  const { xScale, yScale, width, height, theme } = options;
  const themeValues = getTheme(theme);

  // Horizontal grid lines
  if (yScale && 'ticks' in yScale) {
    g.append('g')
      .attr('class', 'grid-lines-h')
      .selectAll('line')
      .data((yScale as d3.ScaleLinear<number, number>).ticks())
      .join('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => (yScale as d3.ScaleLinear<number, number>)(d))
      .attr('y2', d => (yScale as d3.ScaleLinear<number, number>)(d))
      .attr('stroke', themeValues.chart.grid)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');
  }

  // Vertical grid lines
  if (xScale && 'ticks' in xScale) {
    g.append('g')
      .attr('class', 'grid-lines-v')
      .selectAll('line')
      .data((xScale as d3.ScaleLinear<number, number>).ticks())
      .join('line')
      .attr('x1', d => (xScale as d3.ScaleLinear<number, number>)(d))
      .attr('x2', d => (xScale as d3.ScaleLinear<number, number>)(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', themeValues.chart.grid)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');
  }
}

// ============================================================================
// D3 Tooltip - Basic tooltip utilities (for future use)
// ============================================================================

export function createTooltip(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  theme: ThemeName
): d3.Selection<HTMLDivElement, unknown, null, undefined> {
  const themeValues = getTheme(theme);

  return container
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', theme === 'NeXTSTEP' ? '#d4d4d4' : 'white')
    .style('border', theme === 'NeXTSTEP' ? '2px solid #707070' : '1px solid #e5e7eb')
    .style('border-radius', theme === 'NeXTSTEP' ? '0' : '0.5rem')
    .style('padding', '0.5rem')
    .style('font-size', '0.75rem')
    .style('color', themeValues.text.primary)
    .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
    .style('pointer-events', 'none')
    .style('z-index', '1000');
}

export function showTooltip(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  content: string,
  event: MouseEvent
): void {
  tooltip
    .style('visibility', 'visible')
    .html(content)
    .style('left', `${event.pageX + 10}px`)
    .style('top', `${event.pageY - 10}px`);
}

export function hideTooltip(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>
): void {
  tooltip.style('visibility', 'hidden');
}
