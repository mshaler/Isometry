/**
 * VirtualizedNodeList Component using TanStack Virtual v3
 *
 * Replaces react-window with TanStack Virtual for superior performance.
 * Optimized for large datasets with dynamic item sizing, scroll restoration,
 * and intelligent virtualization thresholds.
 */

import React, { useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Types for node data structure
interface Node {
  id: string;
  title: string;
  content?: string;
  folder?: string;
  created_at: string;
  updated_at: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface VirtualizedNodeListProps {
  /** Node data to render */
  nodes: Node[];
  /** Item renderer component */
  renderItem: (props: { node: Node; index: number; style: React.CSSProperties }) => React.ReactElement;
  /** Container height (default: 400px) */
  height?: number;
  /** Estimated item size for virtualization (default: 60px) */
  estimateSize?: number;
  /** Overscan count for smooth scrolling (default: 10) */
  overscan?: number;
  /** Threshold for enabling virtualization (default: 100 items) */
  virtualizationThreshold?: number;
  /** Whether to enable dynamic sizing */
  dynamicSizing?: boolean;
  /** Scroll restoration key */
  scrollRestorationKey?: string;
  /** Custom item size getter */
  getItemSize?: (index: number) => number;
  /** Loading state for skeleton items */
  loading?: boolean;
  /** Error state */
  error?: string | null;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className for container */
  className?: string;
  /** Performance monitoring callback */
  onPerformanceMetric?: (metric: { scrolling: boolean; frameTime: number }) => void;
}

export interface VirtualizedNodeListRef {
  scrollToItem: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  getScrollElement: () => HTMLDivElement | null;
}

/**
 * Virtualized list component with TanStack Virtual v3
 */
export const VirtualizedNodeList = forwardRef<VirtualizedNodeListRef, VirtualizedNodeListProps>(
  ({
    nodes,
    renderItem,
    height = 400,
    estimateSize = 60,
    overscan = 10,
    virtualizationThreshold = 100,
    dynamicSizing = true,
    scrollRestorationKey,
    getItemSize,
    loading = false,
    error = null,
    emptyMessage = 'No items found',
    className = '',
    onPerformanceMetric
  }, ref) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const lastFrameTime = useRef<number>(0);
    const scrollingRef = useRef<boolean>(false);

    // Determine if virtualization should be enabled
    const shouldVirtualize = useMemo(() => {
      return nodes.length > virtualizationThreshold;
    }, [nodes.length, virtualizationThreshold]);

    // Performance monitoring
    const trackPerformance = useCallback((isScrolling: boolean) => {
      if (!onPerformanceMetric) return;

      const now = performance.now();
      const frameTime = lastFrameTime.current ? now - lastFrameTime.current : 0;
      lastFrameTime.current = now;
      scrollingRef.current = isScrolling;

      onPerformanceMetric({
        scrolling: isScrolling,
        frameTime
      });
    }, [onPerformanceMetric]);

    // TanStack Virtual configuration
    const virtualizer = useVirtualizer({
      count: nodes.length,
      getScrollElement: () => parentRef.current,
      estimateSize: useCallback(() => estimateSize, [estimateSize]),
      overscan,
      // Dynamic sizing support
      ...(dynamicSizing && {
        measureElement: (el, entry) => {
          // Use ResizeObserver for accurate sizing
          if (entry && entry.borderBoxSize) {
            const size = entry.borderBoxSize[0];
            return size ? size.blockSize : estimateSize;
          }
          return el.getBoundingClientRect().height;
        }
      }),
      // Custom item size if provided
      ...(getItemSize && {
        getItemSize: (index) => getItemSize(index)
      }),
      // Scroll restoration
      ...(scrollRestorationKey && {
        initialOffset: () => {
          const saved = sessionStorage.getItem(`scroll-${scrollRestorationKey}`);
          return saved ? parseInt(saved, 10) : 0;
        }
      }),
      // Performance tracking
      onChange: (instance) => {
        trackPerformance(instance.scrollDirection !== null);

        // Save scroll position for restoration
        if (scrollRestorationKey && parentRef.current) {
          const scrollTop = parentRef.current.scrollTop;
          sessionStorage.setItem(`scroll-${scrollRestorationKey}`, scrollTop.toString());
        }
      }
    });

    // Imperative handle for external scroll control
    useImperativeHandle(ref, () => ({
      scrollToItem: (index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
        virtualizer.scrollToIndex(index, { align });
      },
      scrollToTop: () => {
        virtualizer.scrollToOffset(0);
      },
      scrollToBottom: () => {
        const totalSize = virtualizer.getTotalSize();
        virtualizer.scrollToOffset(totalSize);
      },
      getScrollElement: () => parentRef.current
    }), [virtualizer]);

    // Error state
    if (error) {
      return (
        <div
          className={`flex items-center justify-center h-32 text-red-500 ${className}`}
          style={{ height }}
        >
          Error: {error}
        </div>
      );
    }

    // Loading state
    if (loading) {
      return (
        <div
          className={`space-y-2 p-4 ${className}`}
          style={{ height }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-200 rounded h-12"
              style={{ height: estimateSize - 8 }}
            />
          ))}
        </div>
      );
    }

    // Empty state
    if (nodes.length === 0) {
      return (
        <div
          className={`flex items-center justify-center h-32 text-gray-500 ${className}`}
          style={{ height }}
        >
          {emptyMessage}
        </div>
      );
    }

    // Non-virtualized rendering for small lists
    if (!shouldVirtualize) {
      return (
        <div
          ref={parentRef}
          className={`overflow-auto ${className}`}
          style={{ height }}
        >
          <div className="space-y-1">
            {nodes.map((node, index) => (
              <div key={node.id}>
                {renderItem({
                  node,
                  index,
                  style: {} // No positioning needed for non-virtualized
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Virtualized rendering for large lists
    const items = virtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className={`overflow-auto ${className}`}
        style={{ height }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {items.map((virtualItem) => {
            const node = nodes[virtualItem.index];
            if (!node) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderItem({
                  node,
                  index: virtualItem.index,
                  style: {
                    height: '100%',
                    width: '100%'
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

VirtualizedNodeList.displayName = 'VirtualizedNodeList';

/**
 * Simple node card component for demonstration
 */
export function NodeCard({ node, style }: { node: Node; style: React.CSSProperties }) {
  return (
    <div
      style={style}
      className="p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {node.title || 'Untitled'}
        </h3>
        <time className="text-xs text-gray-500">
          {new Date(node.updated_at).toLocaleDateString()}
        </time>
      </div>
      {node.content && (
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
          {node.content.slice(0, 100)}...
        </p>
      )}
      {node.folder && (
        <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
          {node.folder}
        </span>
      )}
    </div>
  );
}

/**
 * Hook for managing virtualized list performance
 */
export function useVirtualizedListPerformance() {
  const metrics = useRef({
    averageFrameTime: 0,
    frameCount: 0,
    scrollingFrameTime: 0,
    scrollingFrameCount: 0
  });

  const onPerformanceMetric = useCallback((metric: { scrolling: boolean; frameTime: number }) => {
    const { scrolling, frameTime } = metric;

    // Update overall metrics
    metrics.current.frameCount++;
    metrics.current.averageFrameTime =
      (metrics.current.averageFrameTime * (metrics.current.frameCount - 1) + frameTime)
      / metrics.current.frameCount;

    // Update scrolling-specific metrics
    if (scrolling && frameTime > 0) {
      metrics.current.scrollingFrameCount++;
      metrics.current.scrollingFrameTime =
        (metrics.current.scrollingFrameTime * (metrics.current.scrollingFrameCount - 1) + frameTime)
        / metrics.current.scrollingFrameCount;
    }
  }, []);

  const getMetrics = useCallback(() => ({
    averageFrameTime: metrics.current.averageFrameTime,
    scrollingFrameTime: metrics.current.scrollingFrameTime,
    isPerformant: metrics.current.scrollingFrameTime < 16.67, // 60fps threshold
    frameCount: metrics.current.frameCount
  }), []);

  return { onPerformanceMetric, getMetrics };
}

/**
 * Example usage component demonstrating VirtualizedNodeList
 */
export function VirtualizedNodeListExample() {
  const { onPerformanceMetric, getMetrics } = useVirtualizedListPerformance();

  // Mock data
  const nodes = useMemo(() =>
    Array.from({ length: 1000 }, (_, i) => ({
      id: `node-${i}`,
      title: `Node ${i + 1}`,
      content: `This is the content for node ${i + 1}. It contains some sample text that might be longer or shorter depending on the actual content.`,
      folder: i % 3 === 0 ? 'Important' : i % 2 === 0 ? 'Projects' : undefined,
      created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      updated_at: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
    }))
  , []);

  const renderItem = useCallback(({ node, index, style }: {
    node: Node;
    index: number;
    style: React.CSSProperties
  }) => (
    <NodeCard key={node.id} node={node} style={style} />
  ), []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Virtualized Node List Demo</h2>
      <VirtualizedNodeList
        nodes={nodes}
        renderItem={renderItem}
        height={400}
        onPerformanceMetric={onPerformanceMetric}
        scrollRestorationKey="demo-list"
      />
      <div className="mt-4 text-sm text-gray-600">
        Performance: {getMetrics().averageFrameTime.toFixed(2)}ms avg frame time
      </div>
    </div>
  );
}