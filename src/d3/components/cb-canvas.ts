/**
 * iso-canvas - Isometry Canvas Component
 *
 * Root container for D3 visualizations with zoom/pan support.
 * Follows factory + closure + fluent API pattern.
 */

import * as d3 from 'd3';
import { createAccessor, cx } from '../factory';
import type {
  D3ViewType,
  BackgroundPattern,
  CanvasDimensions,
  CanvasPadding,
} from '@/types/lpg';

// ============================================
// Types
// ============================================

/** Canvas component props */
interface CanvasProps {
  viewType: D3ViewType;
  background: BackgroundPattern;
  zoomable: boolean;
  padding: CanvasPadding;
  [key: string]: D3ViewType | BackgroundPattern | boolean | CanvasPadding;
}

/** D3 selection type for canvas container */
type CanvasContainerSelection = d3.Selection<HTMLDivElement, unknown, null, undefined>;

/** D3 selection type for SVG group */
type SVGGroupSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

// ============================================
// Default Props
// ============================================

const defaultProps: CanvasProps = {
  viewType: 'grid',
  background: 'solid',
  zoomable: false,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

// ============================================
// Component Factory
// ============================================

/**
 * Creates a cb-canvas component with fluent API.
 *
 * @example
 * ```ts
 * const canvas = cbCanvas()
 *   .viewType('grid')
 *   .background('dots')
 *   .zoomable(true)
 *   .padding({ top: 20, right: 20, bottom: 20, left: 20 });
 *
 * d3.select(container).call(canvas);
 *
 * const contentArea = canvas.getContentArea();
 * const dims = canvas.getDimensions();
 * ```
 */
export function cbCanvas() {
  // Private state (closure)
  const props: CanvasProps = { ...defaultProps };
  let containerEl: HTMLDivElement | null = null;
  let svgEl: SVGSVGElement | null = null;
  let contentGroup: SVGGroupSelection | null = null;
  let overlayGroup: SVGGroupSelection | null = null;
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let dimensions: CanvasDimensions = { width: 0, height: 0, innerWidth: 0, innerHeight: 0 };

  // ============================================
  // Render Function
  // ============================================

  function canvas(selection: CanvasContainerSelection): CanvasContainerSelection {
    selection.each(function () {
      containerEl = this;
      const containerSelection = d3.select(containerEl);

      // Build class list
      const classNames = cx(
        'cb-canvas',
        {
          dots: props.background === 'dots',
          grid: props.background === 'grid',
        },
        []
      );

      // Check if canvas already exists
      let canvasWrapper = containerSelection.select<HTMLDivElement>('.cb-canvas');

      if (canvasWrapper.empty()) {
        // Create canvas structure
        canvasWrapper = containerSelection.append('div');

        // Create SVG
        const svg = canvasWrapper
          .append('svg')
          .attr('class', 'cb-canvas__svg')
          .style('width', '100%')
          .style('height', '100%');

        svgEl = svg.node();

        // Create content group (for cards/shapes)
        contentGroup = svg.append('g').attr('class', 'cb-canvas__content');

        // Create overlay group (for selections/tooltips)
        overlayGroup = svg.append('g').attr('class', 'cb-canvas__overlay');
      } else {
        // Reuse existing elements
        svgEl = canvasWrapper.select<SVGSVGElement>('.cb-canvas__svg').node();
        contentGroup = canvasWrapper.select<SVGGElement>('.cb-canvas__content');
        overlayGroup = canvasWrapper.select<SVGGElement>('.cb-canvas__overlay');
      }

      // Update canvas
      canvasWrapper.attr('class', classNames);

      // Calculate dimensions
      updateDimensions();

      // Setup zoom if enabled
      if (props.zoomable && svgEl) {
        setupZoom();
      }

      // Apply padding transform to content group
      if (contentGroup) {
        contentGroup.attr(
          'transform',
          `translate(${props.padding.left}, ${props.padding.top})`
        );
      }
    });

    return selection;
  }

  // ============================================
  // Private Methods
  // ============================================

  function updateDimensions(): void {
    if (!containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    dimensions = {
      width: rect.width,
      height: rect.height,
      innerWidth: rect.width - props.padding.left - props.padding.right,
      innerHeight: rect.height - props.padding.top - props.padding.bottom,
    };
  }

  function setupZoom(): void {
    if (!svgEl || !contentGroup) return;

    zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        contentGroup?.attr('transform', event.transform.toString());
      });

    d3.select(svgEl).call(zoomBehavior);
  }

  // ============================================
  // Fluent API - Accessors
  // ============================================

  canvas.viewType = createAccessor<typeof canvas, D3ViewType>(
    canvas,
    props,
    'viewType'
  );
  canvas.background = createAccessor<typeof canvas, BackgroundPattern>(
    canvas,
    props,
    'background'
  );
  canvas.zoomable = createAccessor<typeof canvas, boolean>(canvas, props, 'zoomable');
  canvas.padding = createAccessor<typeof canvas, CanvasPadding>(canvas, props, 'padding');

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Get current canvas dimensions
   */
  canvas.getDimensions = function (): CanvasDimensions {
    updateDimensions();
    return { ...dimensions };
  };

  /**
   * Get the content area selection for rendering data
   */
  canvas.getContentArea = function (): SVGGroupSelection | null {
    return contentGroup;
  };

  /**
   * Get the overlay area selection for selections/tooltips
   */
  canvas.getOverlayArea = function (): SVGGroupSelection | null {
    return overlayGroup;
  };

  /**
   * Reset zoom to identity transform
   */
  canvas.resetZoom = function (): typeof canvas {
    if (svgEl && zoomBehavior) {
      d3.select(svgEl)
        .transition()
        .duration(300)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    }
    return canvas;
  };

  /**
   * Programmatically zoom to a specific transform
   */
  canvas.zoomTo = function (
    scale: number,
    x: number = 0,
    y: number = 0,
    animate: boolean = true
  ): typeof canvas {
    if (svgEl && zoomBehavior) {
      const transform = d3.zoomIdentity.translate(x, y).scale(scale);
      const svg = d3.select(svgEl);

      if (animate) {
        svg.transition().duration(300).call(zoomBehavior.transform, transform);
      } else {
        svg.call(zoomBehavior.transform, transform);
      }
    }
    return canvas;
  };

  /**
   * Destroy the canvas and cleanup
   */
  canvas.destroy = function (): void {
    if (containerEl) {
      d3.select(containerEl).select('.cb-canvas').remove();
    }

    // Clear references
    containerEl = null;
    svgEl = null;
    contentGroup = null;
    overlayGroup = null;
    zoomBehavior = null;
  };

  return canvas;
}

// ============================================
// Type Export for Component
// ============================================

export type CbCanvas = ReturnType<typeof cbCanvas>;
