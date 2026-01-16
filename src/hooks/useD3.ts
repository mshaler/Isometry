import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

type D3Selection<T extends SVGElement> = d3.Selection<T, unknown, null, undefined>;

export function useD3<T extends SVGElement = SVGSVGElement>(
  renderFn: (selection: D3Selection<T>) => void | (() => void),
  deps: unknown[] = []
): React.RefObject<T> {
  const ref = useRef<T>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const selection = d3.select(ref.current);
    const cleanup = renderFn(selection as D3Selection<T>);
    
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, deps);
  
  return ref;
}

// Hook for managing resize observations
export function useResizeObserver(
  ref: React.RefObject<Element>,
  callback: (entry: ResizeObserverEntry) => void
): void {
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        callback(entries[0]);
      }
    });
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, callback]);
}
