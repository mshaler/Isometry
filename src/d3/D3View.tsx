// D3View - Generic wrapper component for D3 visualizations
// Handles SVG setup, dimensions, and theme integration

import { useEffect, useRef, ReactNode } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { initD3SVG, type Margins } from './hooks';
import { type ThemeName } from '@/styles/themes';

// ============================================================================
// Types
// ============================================================================

export interface D3ViewRenderContext {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margins;
  theme: ThemeName;
}

export interface D3ViewProps<D> {
  /** Data to render */
  data: D[];
  /** Render function that receives D3 context */
  render: (context: D3ViewRenderContext, data: D[]) => void | (() => void);
  /** Optional margins */
  margin?: Partial<Margins>;
  /** Additional dependencies for the render effect */
  dependencies?: unknown[];
  /** Additional content to render (controls, legends, etc.) */
  children?: ReactNode;
  /** CSS class for container */
  className?: string;
  /** Minimum data length to render (default: 0) */
  minDataLength?: number;
  /** Empty state message */
  emptyMessage?: string;
}

// ============================================================================
// D3View Component
// ============================================================================

export function D3View<D>({
  data,
  render,
  margin,
  dependencies = [],
  children,
  className = '',
  minDataLength = 0,
  emptyMessage,
}: D3ViewProps<D>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Check minimum data requirements
    if (data.length < minDataLength) return;

    // Initialize D3 SVG context
    const context = initD3SVG(svgRef, containerRef, margin);
    if (!context) return;

    // Create render context
    const renderContext: D3ViewRenderContext = {
      svg: context.svg,
      g: context.g,
      width: context.dimensions.width,
      height: context.dimensions.height,
      innerWidth: context.dimensions.innerWidth,
      innerHeight: context.dimensions.innerHeight,
      margin: context.dimensions.margin,
      theme: theme as ThemeName,
    };

    // Call render function and capture cleanup
    const cleanup = render(renderContext, data);

    // Return cleanup function if provided
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [data, theme, margin, ...dependencies]);

  const showEmptyState = emptyMessage && data.length < minDataLength;

  return (
    <div ref={containerRef} className={`w-full h-full relative ${className}`}>
      {children}
      <svg ref={svgRef} className="w-full h-full" />
      {showEmptyState && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-sm ${
            theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'
          }`}>
            {emptyMessage}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// D3ViewWithControls - D3View with a controls header
// ============================================================================

export interface D3ViewWithControlsProps<D> extends D3ViewProps<D> {
  /** Controls to render in header */
  controls?: ReactNode;
  /** Header height (default: 48px) */
  headerHeight?: number;
}

export function D3ViewWithControls<D>({
  controls,
  headerHeight = 48,
  className = '',
  ...viewProps
}: D3ViewWithControlsProps<D>) {
  const { theme } = useTheme();

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {controls && (
        <div
          className={`flex items-center gap-4 px-4 ${
            theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-50'
          }`}
          style={{ height: headerHeight }}
        >
          {controls}
        </div>
      )}
      <div className="flex-1">
        <D3View {...viewProps} />
      </div>
    </div>
  );
}

// ============================================================================
// useD3ViewRef - Hook for when you need refs outside the component
// ============================================================================

export function useD3ViewRefs() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return { svgRef, containerRef };
}

export default D3View;
