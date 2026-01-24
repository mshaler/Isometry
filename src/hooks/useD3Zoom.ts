import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

export interface ZoomTransform {
  x: number;
  y: number;
  k: number; // scale factor
}

export interface UseD3ZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  onZoom?: (transform: ZoomTransform) => void;
}

/**
 * useD3Zoom - React hook for d3-zoom integration
 *
 * Manages pan and zoom behavior on an SVG element, with constrained zoom extents.
 * Emits zoom transforms to parent components for display (e.g., MiniNav zoom indicator).
 *
 * Usage:
 *   const svgRef = useD3Zoom({
 *     minZoom: 0.1,
 *     maxZoom: 10,
 *     onZoom: (transform) => console.log('Zoom:', transform.k)
 *   });
 *
 * @param options - Configuration for zoom behavior
 * @returns ref - React ref to attach to SVG element
 */
export function useD3Zoom<T extends SVGSVGElement>(
  options: UseD3ZoomOptions = {}
): React.RefObject<T> {
  const {
    minZoom = 0.1,
    maxZoom = 10,
    onZoom,
  } = options;

  const svgRef = useRef<T>(null);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const handleZoom = useCallback((event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
    const svg = d3.select(svgRef.current);
    const container = svg.select<SVGGElement>('.sparsity-container');

    // Apply transform to the container group
    container.attr('transform', event.transform.toString());

    // Emit transform to parent
    if (onZoomRef.current) {
      onZoomRef.current({
        x: event.transform.x,
        y: event.transform.y,
        k: event.transform.k,
      });
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Initialize d3-zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', handleZoom);

    // Attach zoom behavior to SVG
    svg.call(zoom);

    // Cleanup: remove zoom behavior on unmount
    return () => {
      svg.on('.zoom', null);
    };
  }, [minZoom, maxZoom, handleZoom]);

  return svgRef;
}
