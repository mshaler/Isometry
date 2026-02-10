/**
 * D3ViewWrapper - React-D3 Bridge Component
 *
 * React wrapper that bridges to iso-canvas for D3 visualizations.
 * React owns the container, D3 (via iso-canvas) owns the visualization.
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { cbCanvas, type CbCanvas } from './cb-canvas';
import type {
  CardValue,
  D3ViewType,
  BackgroundPattern,
  CanvasDimensions,
  CanvasPadding,
} from '@/types/lpg';

// ============================================
// Types
// ============================================

/** D3 selection type for content group */
type ContentAreaSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

/** Callback functions passed to renderContent */
export interface D3ViewCallbacks<T> {
  /** Called when a node is clicked */
  onNodeClick?: (node: T) => void;
  /** Called when a node is hovered */
  onNodeHover?: (node: T | null) => void;
  /** Called when selection changes */
  onSelectionChange?: (selected: T[]) => void;
}

/** Props for D3ViewWrapper component */
export interface D3ViewWrapperProps<T extends CardValue = CardValue> {
  /** Data to render */
  data: T[];
  /** View type for cb-canvas configuration */
  viewType: D3ViewType;
  /** Render function that receives D3 context */
  renderContent: (
    contentArea: ContentAreaSelection,
    data: T[],
    dimensions: CanvasDimensions,
    callbacks: D3ViewCallbacks<T>
  ) => void | (() => void);
  /** Background pattern */
  background?: BackgroundPattern;
  /** Enable zoom/pan */
  zoomable?: boolean;
  /** Canvas padding */
  padding?: CanvasPadding;
  /** Node click handler */
  onNodeClick?: (node: T) => void;
  /** Node hover handler */
  onNodeHover?: (node: T | null) => void;
  /** Selection change handler */
  onSelectionChange?: (selected: T[]) => void;
  /** Additional CSS class */
  className?: string;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Additional dependencies for the render effect */
  dependencies?: unknown[];
}

// ============================================
// Default Props
// ============================================

const defaultPadding: CanvasPadding = { top: 0, right: 0, bottom: 0, left: 0 };

// ============================================
// Component
// ============================================

/**
 * D3ViewWrapper bridges React and D3 via cb-canvas.
 *
 * @example
 * ```tsx
 * <D3ViewWrapper
 *   data={cards}
 *   viewType="grid"
 *   background="dots"
 *   zoomable={true}
 *   renderContent={(contentArea, data, dims, callbacks) => {
 *     const card = cbCard()
 *       .variant('glass')
 *       .interactive(true)
 *       .on('click', (e) => callbacks.onNodeClick?.(e.data));
 *
 *     contentArea
 *       .selectAll('.card-wrapper')
 *       .data(data, d => d.id)
 *       .join('g')
 *       .attr('class', 'card-wrapper')
 *       .call(card);
 *   }}
 *   onNodeClick={(node) => console.warn('Clicked:', node)}
 * />
 * ```
 */
export function D3ViewWrapper<T extends CardValue = CardValue>({
  data,
  viewType,
  renderContent,
  background = 'solid',
  zoomable = false,
  padding = defaultPadding,
  onNodeClick,
  onNodeHover,
  onSelectionChange,
  className = '',
  emptyMessage,
  dependencies = [],
}: D3ViewWrapperProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CbCanvas | null>(null);
  const cleanupRef = useRef<(() => void) | void>(undefined);
  const { theme } = useTheme();

  // Create callbacks object (stable reference via refs)
  const callbacksRef = useRef<D3ViewCallbacks<T>>({
    onNodeClick,
    onNodeHover,
    onSelectionChange,
  });

  // Update callbacks ref when props change
  useEffect(() => {
    callbacksRef.current = { onNodeClick, onNodeHover, onSelectionChange };
  }, [onNodeClick, onNodeHover, onSelectionChange]);

  // Main effect: Initialize canvas and render content
  useEffect(() => {
    if (!containerRef.current) return;

    // Skip rendering if no data and empty message is provided
    if (data.length === 0 && emptyMessage) {
      // Cleanup any existing canvas
      if (canvasRef.current) {
        canvasRef.current.destroy();
        canvasRef.current = null;
      }
      return;
    }

    // Initialize canvas once (or reconfigure if viewType changes)
    if (!canvasRef.current) {
      canvasRef.current = cbCanvas()
        .viewType(viewType)
        .background(background)
        .zoomable(zoomable)
        .padding(padding);
    } else {
      // Update canvas configuration
      canvasRef.current
        .viewType(viewType)
        .background(background)
        .zoomable(zoomable)
        .padding(padding);
    }

    // Render canvas into container
    d3.select(containerRef.current).call(canvasRef.current);

    // Get content area for rendering
    const contentArea = canvasRef.current.getContentArea();
    if (!contentArea) return;

    // Get dimensions
    const dimensions = canvasRef.current.getDimensions();

    // Cleanup previous render
    if (typeof cleanupRef.current === 'function') {
      cleanupRef.current();
    }

    // Call render function with stable callbacks
    cleanupRef.current = renderContent(
      contentArea,
      data,
      dimensions,
      callbacksRef.current
    );

    // Cleanup function
    return () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
  }, [data, viewType, background, zoomable, padding, renderContent, emptyMessage, ...dependencies]);

  // Cleanup canvas on unmount
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current.destroy();
        canvasRef.current = null;
      }
    };
  }, []);

  // Render empty state if needed
  const showEmptyState = emptyMessage && data.length === 0;

  return (
    <div
      ref={containerRef}
      className={`cb-view-wrapper w-full h-full relative ${className}`}
      data-theme={theme}
    >
      {showEmptyState && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`text-sm ${
              theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'
            }`}
          >
            {emptyMessage}
          </div>
        </div>
      )}
    </div>
  );
}

export default D3ViewWrapper;
