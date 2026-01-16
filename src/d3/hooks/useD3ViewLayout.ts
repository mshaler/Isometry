/**
 * useD3ViewLayout Hook
 *
 * Combines common D3 view setup patterns into a single hook:
 * - SVG initialization with margins
 * - Responsive dimensions
 * - Theme-aware styling
 * - Optional zoom behavior
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { getTheme, type ThemeName } from '@/styles/themes';
import type { Margins, D3Dimensions, D3SVGContext, ZoomOptions } from '../hooks';
import { setupZoom } from '../hooks';

// ============================================
// Types
// ============================================

export interface UseD3ViewLayoutOptions {
  /** Margins around the content area */
  margin?: Partial<Margins>;
  /** Enable zoom/pan behavior */
  zoomable?: boolean;
  /** Zoom behavior options */
  zoomOptions?: ZoomOptions;
  /** Callback when dimensions change */
  onResize?: (dimensions: D3Dimensions) => void;
}

export interface D3ViewLayout {
  /** Ref to attach to container div */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Ref to attach to SVG element */
  svgRef: React.RefObject<SVGSVGElement>;
  /** Current SVG context (null before initialization) */
  context: D3SVGContext | null;
  /** Current dimensions */
  dimensions: D3Dimensions | null;
  /** Current theme values */
  themeValues: ReturnType<typeof getTheme>;
  /** Reset zoom to identity transform */
  resetZoom: () => void;
  /** Clear all SVG content */
  clear: () => void;
}

// Default margins
const DEFAULT_MARGINS: Margins = { top: 40, right: 20, bottom: 20, left: 100 };

// ============================================
// Hook Implementation
// ============================================

export function useD3ViewLayout(options: UseD3ViewLayoutOptions = {}): D3ViewLayout {
  const { margin = {}, zoomable = false, zoomOptions = {}, onResize } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [context, setContext] = useState<D3SVGContext | null>(null);
  const [dimensions, setDimensions] = useState<D3Dimensions | null>(null);

  const { theme } = useTheme();
  const themeValues = getTheme(theme as ThemeName);

  // Initialize SVG and dimensions
  const initializeSVG = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

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
      .attr('class', 'content-group')
      .attr('transform', `translate(${finalMargin.left},${finalMargin.top})`);

    const newDimensions: D3Dimensions = {
      width,
      height,
      innerWidth,
      innerHeight,
      margin: finalMargin,
    };

    const newContext: D3SVGContext = { svg, g, dimensions: newDimensions };

    // Setup zoom if enabled
    if (zoomable) {
      zoomBehaviorRef.current = setupZoom(svg, g, zoomOptions);
    }

    setContext(newContext);
    setDimensions(newDimensions);
    onResize?.(newDimensions);
  }, [margin, zoomable, zoomOptions, onResize]);

  // Reset zoom to identity
  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, []);

  // Clear all SVG content
  const clear = useCallback(() => {
    if (!context) return;
    context.g.selectAll('*').remove();
  }, [context]);

  // Initialize on mount and handle resize
  useEffect(() => {
    initializeSVG();

    // Setup resize observer
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      initializeSVG();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [initializeSVG]);

  return {
    containerRef,
    svgRef,
    context,
    dimensions,
    themeValues,
    resetZoom,
    clear,
  };
}

export default useD3ViewLayout;
