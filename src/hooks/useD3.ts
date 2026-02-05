import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';

type D3Selection<T extends Element> = d3.Selection<T, unknown, null, undefined>;

export interface UseD3Options {
  enableErrorBoundary?: boolean;
  onError?: (error: Error) => void;
  dependencies?: unknown[];
}

export function useD3<T extends Element = SVGSVGElement>(
  renderFn: (selection: D3Selection<T>) => void | (() => void),
  deps: unknown[] = [],
  options: UseD3Options = {}
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { enableErrorBoundary = true, onError } = options;

  const handleError = useCallback((error: Error) => {
    console.error('[useD3] Render error:', error);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  useEffect(() => {
    if (!ref.current) return;

    try {
      // Clean up previous render
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      const selection = d3.select(ref.current);
      const cleanup = renderFn(selection as D3Selection<T>);

      // Store cleanup function
      if (typeof cleanup === 'function') {
        cleanupRef.current = cleanup;
      }

    } catch (error) {
      if (enableErrorBoundary) {
        handleError(error instanceof Error ? error : new Error('Unknown D3 render error'));
      } else {
        throw error;
      }
    }

    return () => {
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch (error) {
          console.warn('[useD3] Cleanup error:', error);
        }
        cleanupRef.current = null;
      }
    };
  }, deps);

  return ref;
}

// Hook for managing resize observations
export function useResizeObserver(
  ref: React.RefObject<Element>,
  callback: (entry: ResizeObserverEntry) => void,
  options: { debounceMs?: number } = {}
): void {
  const { debounceMs = 100 } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback((entry: ResizeObserverEntry) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(entry);
    }, debounceMs);
  }, [callback, debounceMs]);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        debouncedCallback(entries[0]);
      }
    });

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [ref, debouncedCallback]);
}

// Hook for D3 data updates with performance optimization
export function useD3Data<T>(
  data: T[],
  options: {
    maxItems?: number;
    enableVirtualization?: boolean;
    onDataChange?: (data: T[]) => void;
  } = {}
): { optimizedData: T[]; isDataLimited: boolean } {
  const { maxItems = 1000, onDataChange } = options;
  const [optimizedData, setOptimizedData] = useState<T[]>([]);
  const [isDataLimited, setIsDataLimited] = useState(false);

  useEffect(() => {
    let processedData = data;
    let limited = false;

    // Limit data for performance
    if (processedData.length > maxItems) {
      processedData = processedData.slice(0, maxItems);
      limited = true;
    }

    setOptimizedData(processedData);
    setIsDataLimited(limited);

    if (onDataChange) {
      onDataChange(processedData);
    }
  }, [data, maxItems, onDataChange]);

  return { optimizedData, isDataLimited };
}

// Hook for D3 zoom and pan state management
export function useD3Zoom<T extends Element = SVGSVGElement>(
  ref: React.RefObject<T>,
  options: {
    scaleExtent?: [number, number];
    onZoom?: (transform: d3.ZoomTransform) => void;
    initialTransform?: d3.ZoomTransform;
  } = {}
) {
  const { scaleExtent = [0.1, 10], onZoom, initialTransform } = options;
  const [transform, setTransform] = useState<d3.ZoomTransform>(
    initialTransform || d3.zoomIdentity
  );
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<T, unknown> | null>(null);

  const resetZoom = useCallback(() => {
    if (ref.current && zoomBehaviorRef.current) {
      d3.select(ref.current)
        .transition()
        .duration(500)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  }, [ref]);

  const zoomToFit = useCallback((
    bounds: { x: number; y: number; width: number; height: number },
    padding = 50
  ) => {
    if (!ref.current || !zoomBehaviorRef.current) return;

    const element = ref.current;
    const { clientWidth, clientHeight } = element as any;

    const scale = Math.min(
      (clientWidth - padding * 2) / bounds.width,
      (clientHeight - padding * 2) / bounds.height
    );

    const clampedScale = Math.max(scaleExtent[0], Math.min(scaleExtent[1], scale));

    const translateX = (clientWidth - bounds.width * clampedScale) / 2 - bounds.x * clampedScale;
    const translateY = (clientHeight - bounds.height * clampedScale) / 2 - bounds.y * clampedScale;

    const newTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(clampedScale);

    d3.select(element)
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform, newTransform);
  }, [ref, scaleExtent]);

  useEffect(() => {
    if (!ref.current) return;

    const element = ref.current;

    zoomBehaviorRef.current = d3.zoom<T, unknown>()
      .scaleExtent(scaleExtent)
      .on('zoom', (event) => {
        const newTransform = event.transform;
        setTransform(newTransform);
        if (onZoom) {
          onZoom(newTransform);
        }
      });

    d3.select(element).call(zoomBehaviorRef.current);

    if (initialTransform) {
      d3.select(element).call(
        zoomBehaviorRef.current.transform,
        initialTransform
      );
    }

    return () => {
      d3.select(element).on('.zoom', null);
    };
  }, [ref, scaleExtent, onZoom, initialTransform]);

  return {
    transform,
    resetZoom,
    zoomToFit,
    zoomBehavior: zoomBehaviorRef.current
  };
}
