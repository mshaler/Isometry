/**
 * cb-canvas - The Root Container
 *
 * Root container for CardBoard visualizations.
 * Manages view projections, zoom/pan, and child component rendering.
 *
 * @example
 * ```ts
 * const canvas = cbCanvas()
 *   .viewType('grid')
 *   .projection({ xAxis: 'category', yAxis: 'time' })
 *   .zoomable(true);
 *
 * d3.select('#app')
 *   .datum(cards)
 *   .call(canvas);
 *
 * // Render cards into canvas content area
 * canvas.getContentArea()
 *   .selectAll('.card-wrapper')
 *   .data(cards, d => d.id)
 *   .join('div')
 *   .call(card);
 * ```
 */

import * as d3 from 'd3';
import {
  createAccessors,
  cx,
  generateInstanceId,
  debounce,
} from '../factory';
import type {
  BackgroundPattern,
  CanvasDimensions,
  CanvasPadding,
  CardValue,
  D3Selection,
  ViewProjection,
  ViewType,
} from '../types';

// ============================================
// Types
// ============================================

export interface CanvasProps {
  /** Unique canvas identifier */
  id: string;
  /** Canvas width (px or 'auto' for container width) */
  width: number | 'auto';
  /** Canvas height (px or 'auto' for container height) */
  height: number | 'auto';
  /** Minimum dimensions */
  minWidth: number;
  minHeight: number;
  /** Current view type */
  viewType: ViewType;
  /** LATCH axis projection */
  projection: ViewProjection;
  /** Padding inside canvas */
  padding: CanvasPadding;
  /** Enable zoom/pan */
  zoomable: boolean;
  /** Zoom extent [min, max] */
  zoomExtent: [number, number];
  /** Pan extent (null for infinite) */
  panExtent: [[number, number], [number, number]] | null;
  /** Grid snap size (0 = disabled) */
  gridSnap: number;
  /** Background pattern */
  background: BackgroundPattern;
  /** Custom class names */
  className: string;
}

// ============================================
// Default Props
// ============================================

const defaultProps: CanvasProps = {
  id: '',
  width: 'auto',
  height: 'auto',
  minWidth: 200,
  minHeight: 200,
  viewType: 'grid',
  projection: { xAxis: 'category', yAxis: 'time' },
  padding: { top: 24, right: 24, bottom: 24, left: 24 },
  zoomable: true,
  zoomExtent: [0.1, 4],
  panExtent: null,
  gridSnap: 0,
  background: 'dots',
  className: '',
};

// ============================================
// Component
// ============================================

export function cbCanvas() {
  // Private state
  const instanceId = generateInstanceId('canvas');
  const props: CanvasProps = { ...defaultProps, id: instanceId };

  // Internal state
  let zoomBehavior: d3.ZoomBehavior<HTMLDivElement, unknown> | null = null;
  let currentTransform = d3.zoomIdentity;
  let dimensions: CanvasDimensions = {
    width: 0,
    height: 0,
    innerWidth: 0,
    innerHeight: 0,
  };
  let resizeObserver: ResizeObserver | null = null;

  // Render function
  function canvas(
    selection: D3Selection<HTMLElement, CardValue[], HTMLElement, unknown>,
  ): D3Selection<HTMLElement, CardValue[], HTMLElement, unknown> {
    selection.each(function (data) {
      const container = d3.select(this);

      // Compute dimensions
      dimensions = computeDimensions(container, props);

      // Create or select canvas element
      let canvasEl = container.select<HTMLDivElement>('.cb-canvas');

      if (canvasEl.empty()) {
        canvasEl = container
          .append('div')
          .attr('class', 'cb-canvas')
          .attr('id', props.id)
          .call(createCanvasStructure);

        // Setup resize observer
        setupResizeObserver(container.node()!, canvasEl);
      }

      // Update classes
      const className = cx(
        'cb-canvas',
        {
          zoomable: props.zoomable,
        },
        props.className ? [props.className] : [],
      );
      canvasEl.attr('class', className);

      // Update attributes
      canvasEl
        .attr('data-view-type', props.viewType)
        .attr('data-background', props.background)
        .style('width', dimensions.width + 'px')
        .style('height', dimensions.height + 'px');

      // Update content area padding
      const contentArea = canvasEl.select<HTMLDivElement>('.cb-canvas__content');
      contentArea.style(
        'padding',
        `${props.padding.top}px ${props.padding.right}px ${props.padding.bottom}px ${props.padding.left}px`,
      );

      // Setup or teardown zoom behavior
      if (props.zoomable) {
        setupZoom(canvasEl, contentArea);
      } else {
        teardownZoom(canvasEl);
      }

      // Store data and dimensions for child components
      canvasEl.datum({
        data,
        dimensions,
        transform: currentTransform,
      });
    });

    return selection;
  }

  // ============================================
  // Internal Functions
  // ============================================

  /**
   * Create canvas DOM structure
   */
  function createCanvasStructure(
    sel: D3Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  ): D3Selection<HTMLDivElement, unknown, HTMLElement, unknown> {
    // Background layer (dots/grid pattern)
    sel.append('div').attr('class', 'cb-canvas__background');

    // Content layer (where cards render)
    sel.append('div').attr('class', 'cb-canvas__content');

    // Overlay layer (selections, drag previews, etc.)
    sel.append('div').attr('class', 'cb-canvas__overlay');

    return sel;
  }

  /**
   * Compute canvas dimensions from container or explicit props
   */
  function computeDimensions(
    container: D3Selection<HTMLElement, unknown, null, undefined>,
    props: CanvasProps,
  ): CanvasDimensions {
    const node = container.node();
    const rect = node?.getBoundingClientRect() ?? { width: 800, height: 600 };

    let width = props.width === 'auto' ? rect.width : props.width;
    let height = props.height === 'auto' ? rect.height : props.height;

    // Apply minimum dimensions
    width = Math.max(width, props.minWidth);
    height = Math.max(height, props.minHeight);

    return {
      width,
      height,
      innerWidth: width - props.padding.left - props.padding.right,
      innerHeight: height - props.padding.top - props.padding.bottom,
    };
  }

  /**
   * Setup zoom behavior
   */
  function setupZoom(
    canvasEl: D3Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
    contentArea: D3Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  ): void {
    if (zoomBehavior) return; // Already setup

    zoomBehavior = d3
      .zoom<HTMLDivElement, unknown>()
      .scaleExtent(props.zoomExtent)
      .on('zoom', (event: d3.D3ZoomEvent<HTMLDivElement, unknown>) => {
        currentTransform = event.transform;

        // Apply transform to content area
        contentArea.style(
          'transform',
          `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`,
        );

        // Update stored transform
        canvasEl.datum((d: any) => ({ ...d, transform: currentTransform }));
      });

    // Apply pan extent if specified
    if (props.panExtent) {
      zoomBehavior.translateExtent(props.panExtent);
    }

    // Apply zoom behavior to canvas
    canvasEl.call(zoomBehavior);

    // Apply current transform
    canvasEl.call(zoomBehavior.transform, currentTransform);
  }

  /**
   * Teardown zoom behavior
   */
  function teardownZoom(
    canvasEl: D3Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  ): void {
    if (!zoomBehavior) return;

    canvasEl.on('.zoom', null);
    zoomBehavior = null;
  }

  /**
   * Setup resize observer for auto-sizing
   */
  function setupResizeObserver(
    containerNode: HTMLElement,
    canvasEl: D3Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  ): void {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    const handleResize = debounce(() => {
      if (props.width === 'auto' || props.height === 'auto') {
        const rect = containerNode.getBoundingClientRect();
        let newWidth = props.width === 'auto' ? rect.width : (props.width as number);
        let newHeight = props.height === 'auto' ? rect.height : (props.height as number);

        newWidth = Math.max(newWidth, props.minWidth);
        newHeight = Math.max(newHeight, props.minHeight);

        dimensions = {
          width: newWidth,
          height: newHeight,
          innerWidth: newWidth - props.padding.left - props.padding.right,
          innerHeight: newHeight - props.padding.top - props.padding.bottom,
        };

        canvasEl
          .style('width', dimensions.width + 'px')
          .style('height', dimensions.height + 'px');
      }
    }, 100);

    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerNode);
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Get the content area selection for rendering child components
   */
  canvas.getContentArea = function (): D3Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    unknown
  > | null {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (el.empty()) return null;
    return el.select('.cb-canvas__content');
  };

  /**
   * Get the overlay area selection
   */
  canvas.getOverlayArea = function (): D3Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    unknown
  > | null {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (el.empty()) return null;
    return el.select('.cb-canvas__overlay');
  };

  /**
   * Get computed dimensions
   */
  canvas.getDimensions = function (): CanvasDimensions {
    return { ...dimensions };
  };

  /**
   * Reset zoom to identity (1:1 scale, no pan)
   */
  canvas.resetZoom = function (transition: boolean = true): typeof canvas {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (!el.empty() && zoomBehavior) {
      if (transition) {
        el.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity);
      } else {
        el.call(zoomBehavior.transform, d3.zoomIdentity);
      }
      currentTransform = d3.zoomIdentity;
    }
    return canvas;
  };

  /**
   * Zoom to a specific scale
   */
  canvas.zoomTo = function (scale: number, transition: boolean = true): typeof canvas {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (!el.empty() && zoomBehavior) {
      if (transition) {
        el.transition().duration(300).call(zoomBehavior.scaleTo, scale);
      } else {
        el.call(zoomBehavior.scaleTo, scale);
      }
    }
    return canvas;
  };

  /**
   * Pan to a specific position
   */
  canvas.panTo = function (
    x: number,
    y: number,
    transition: boolean = true,
  ): typeof canvas {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (!el.empty() && zoomBehavior) {
      if (transition) {
        el.transition().duration(300).call(zoomBehavior.translateTo, x, y);
      } else {
        el.call(zoomBehavior.translateTo, x, y);
      }
    }
    return canvas;
  };

  /**
   * Get current transform
   */
  canvas.getTransform = function (): d3.ZoomTransform {
    return currentTransform;
  };

  /**
   * Fit content to view
   */
  canvas.fitToView = function (
    contentBounds: { x: number; y: number; width: number; height: number },
    paddingPercent: number = 0.1,
    transition: boolean = true,
  ): typeof canvas {
    const el = d3.select<HTMLDivElement, unknown>(`#${props.id}`);
    if (el.empty() || !zoomBehavior) return canvas;

    const { innerWidth, innerHeight } = dimensions;

    // Calculate scale to fit content
    const scaleX = innerWidth / (contentBounds.width * (1 + paddingPercent * 2));
    const scaleY = innerHeight / (contentBounds.height * (1 + paddingPercent * 2));
    const scale = Math.min(scaleX, scaleY, props.zoomExtent[1]);

    // Calculate center position
    const centerX = contentBounds.x + contentBounds.width / 2;
    const centerY = contentBounds.y + contentBounds.height / 2;

    // Create transform
    const transform = d3.zoomIdentity
      .translate(innerWidth / 2, innerHeight / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    if (transition) {
      el.transition().duration(500).call(zoomBehavior.transform, transform);
    } else {
      el.call(zoomBehavior.transform, transform);
    }

    currentTransform = transform;
    return canvas;
  };

  /**
   * Cleanup resources
   */
  canvas.destroy = function (): void {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    const el = d3.select(`#${props.id}`);
    if (!el.empty()) {
      el.on('.zoom', null);
      el.remove();
    }
    zoomBehavior = null;
  };

  // ============================================
  // Fluent API
  // ============================================

  const accessors = createAccessors(canvas, props);
  Object.assign(canvas, accessors);

  // Instance ID getter
  canvas.instanceId = function (): string {
    return instanceId;
  };

  return canvas;
}

export type CbCanvas = ReturnType<typeof cbCanvas>;
