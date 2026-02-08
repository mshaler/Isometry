/**
 * React hook for virtual scrolling with TanStack Virtual
 *
 * Provides optimized rendering for large datasets with 60fps performance,
 * dynamic sizing support, and proper TypeScript types.
 */

import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualizedListOptions {
  /** Height of the scrolling container */
  containerHeight: number;
  /** Estimated size of each item (height for vertical, width for horizontal) */
  estimateSize: number;
  /** Number of items to render outside visible area for smooth scrolling */
  overscan?: number;
  /** Whether to enable horizontal scrolling */
  horizontal?: boolean;
  /** Custom size measurement function */
  measureElement?: (element: Element, entry?: ResizeObserverEntry) => number;
  /** Padding at start and end of the virtual list */
  paddingStart?: number;
  paddingEnd?: number;
  /** Enable dynamic sizing based on content */
  enableDynamicSizing?: boolean;
}

export interface VirtualizedListResult {
  /** Ref for the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Virtual items to render */
  virtualItems: Array<{
    key: string;
    index: number;
    start: number;
    size: number;
    end: number;
    measureElement?: (node: Element) => void;
  }>;
  /** Total size of the virtual list */
  totalSize: number;
  /** Scroll to specific item */
  scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void;
  /** Scroll to specific offset */
  scrollToOffset: (offset: number) => void;
  /** Whether list is currently scrolling */
  isScrolling: boolean;
}

/**
 * Hook for virtual scrolling large datasets with TanStack Virtual
 *
 * @param itemCount Total number of items in the dataset
 * @param options Virtual scrolling configuration
 * @returns Virtual scrolling utilities and state
 */
export function useVirtualizedList(
  itemCount: number,
  options: VirtualizedListOptions
): VirtualizedListResult {
  const {
    estimateSize,
    overscan = 10,
    horizontal = false,
    measureElement,
    paddingStart = 0,
    paddingEnd = 0,
    enableDynamicSizing = true
  } = options;

  // Container ref for the scrollable element
  const containerRef = useRef<HTMLDivElement>(null);

  // Configure virtualizer with research-recommended settings
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    horizontal,
    paddingStart,
    paddingEnd,
    measureElement: enableDynamicSizing ? measureElement : undefined,
    // Enable smooth scrolling optimizations
    getItemKey: (index) => index
  });

  // Transform virtual items to include measurement callback
  const virtualItems = useMemo(() => {
    return virtualizer.getVirtualItems().map(item => ({
      key: `virtual-item-${item.key}`,
      index: item.index,
      start: item.start,
      size: item.size,
      end: item.end,
      measureElement: enableDynamicSizing && measureElement
        ? (node: Element) => virtualizer.measureElement(node)
        : undefined
    }));
  }, [virtualizer, enableDynamicSizing, measureElement]);

  // Scroll control functions
  const scrollToIndex = useCallback((
    index: number,
    options?: { align?: 'start' | 'center' | 'end' | 'auto' }
  ) => {
    virtualizer.scrollToIndex(index, { align: options?.align ?? 'auto' });
  }, [virtualizer]);

  const scrollToOffset = useCallback((offset: number) => {
    virtualizer.scrollToOffset(offset);
  }, [virtualizer]);

  return {
    containerRef,
    virtualItems,
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex,
    scrollToOffset,
    isScrolling: virtualizer.isScrolling
  };
}

/**
 * Hook for virtual grid scrolling (2D virtualization)
 *
 * @param itemCount Total number of items
 * @param columnCount Number of columns in the grid
 * @param options Grid virtualization options
 */
export function useVirtualizedGrid(
  itemCount: number,
  columnCount: number,
  options: VirtualizedListOptions & {
    /** Width of the container */
    containerWidth: number;
    /** Estimated width of each column */
    estimateColumnWidth: number;
  }
) {
  const {
    estimateSize: estimateRowHeight,
    estimateColumnWidth,
    overscan = 2,
    measureElement,
    enableDynamicSizing = true
  } = options;

  // Calculate row count from total items and column count
  const rowCount = Math.ceil(itemCount / columnCount);

  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Row virtualizer (vertical)
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    measureElement: enableDynamicSizing ? measureElement : undefined
  });

  // Column virtualizer (horizontal)
  const columnVirtualizer = useVirtualizer({
    count: columnCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateColumnWidth,
    horizontal: true,
    measureElement: enableDynamicSizing ? measureElement : undefined
  });

  // Calculate visible grid cells
  const virtualGridItems = useMemo(() => {
    const items: Array<{
      key: string;
      rowIndex: number;
      columnIndex: number;
      itemIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    const virtualRows = rowVirtualizer.getVirtualItems();
    const virtualColumns = columnVirtualizer.getVirtualItems();

    for (const virtualRow of virtualRows) {
      for (const virtualColumn of virtualColumns) {
        const itemIndex = virtualRow.index * columnCount + virtualColumn.index;

        // Only include items that exist in the dataset
        if (itemIndex < itemCount) {
          items.push({
            key: `grid-${virtualRow.index}-${virtualColumn.index}`,
            rowIndex: virtualRow.index,
            columnIndex: virtualColumn.index,
            itemIndex,
            x: virtualColumn.start,
            y: virtualRow.start,
            width: virtualColumn.size,
            height: virtualRow.size
          });
        }
      }
    }

    return items;
  }, [rowVirtualizer, columnVirtualizer, columnCount, itemCount]);

  return {
    containerRef,
    virtualGridItems,
    totalHeight: rowVirtualizer.getTotalSize(),
    totalWidth: columnVirtualizer.getTotalSize(),
    scrollToIndex: (index: number) => {
      const rowIndex = Math.floor(index / columnCount);
      const columnIndex = index % columnCount;
      rowVirtualizer.scrollToIndex(rowIndex);
      columnVirtualizer.scrollToIndex(columnIndex);
    },
    isScrolling: rowVirtualizer.isScrolling || columnVirtualizer.isScrolling
  };
}