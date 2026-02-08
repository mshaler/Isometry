/**
 * Virtual grid component for large datasets with node/edge visualization
 *
 * Provides smooth 60fps scrolling for thousands of items using TanStack Virtual
 * with proper positioning transforms and responsive design. Enhanced with live
 * data support through SQL queries and real-time updates.
 */

import React, { useCallback, forwardRef, useMemo } from 'react';
import { useVirtualizedGrid } from '@/hooks';
import { useVirtualLiveQuery, type VirtualLiveQueryOptions } from '@/hooks';
import { Node, Edge } from '../../types/node';

// Type guard functions for safe type casting
function isNode(item: unknown): item is Node {
  return typeof item === 'object' && item !== null && 'id' in item && 'nodeType' in item;
}

function isEdge(item: unknown): item is Edge {
  return typeof item === 'object' && item !== null && 'id' in item && 'edgeType' in item && 'sourceId' in item && 'targetId' in item;
}

export interface VirtualizedGridProps<T = unknown> {
  // Static data props (for backward compatibility)
  /** Array of items to render (optional if using sql) */
  items?: T[];

  // Live data props
  /** SQL query to execute and observe for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Live query options */
  liveOptions?: Partial<VirtualLiveQueryOptions>;

  // Grid configuration
  /** Height of the grid container (defaults to 400px) */
  height?: number;
  /** Width of the grid container (defaults to 100%) */
  width?: number;
  /** Number of columns in the grid */
  columnCount?: number;
  /** Estimated height of each row */
  estimateRowHeight?: number;
  /** Estimated width of each column */
  estimateColumnWidth?: number;
  /** Component to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional loading state */
  loading?: boolean;
  /** Optional empty state */
  emptyState?: React.ReactNode;
  /** CSS class name for styling */
  className?: string;
  /** Callback when item is clicked */
  onItemClick?: (item: T, index: number) => void;
  /** Enable dynamic sizing based on content */
  enableDynamicSizing?: boolean;
  /** Gap between grid items */
  gap?: number;
}

/**
 * High-performance virtual grid component with live data support
 */
export const VirtualizedGrid = forwardRef<HTMLDivElement, VirtualizedGridProps>(function VirtualizedGrid({
  items,
  sql,
  queryParams = [],
  liveOptions = {},
  height = 400,
  width = 800,
  columnCount = 3,
  estimateRowHeight = 200,
  estimateColumnWidth = 300,
  renderItem,
  loading = false,
  emptyState,
  className = '',
  onItemClick,
  enableDynamicSizing = true,
  gap = 8
}, ref) {
  // Determine if using live data or static data
  const usingLiveData = Boolean(sql);

  // Live query hook for SQL-based data
  const liveQuery = useVirtualLiveQuery<any>(
    sql || 'SELECT 1 WHERE 0', // Dummy query when not using live data
    queryParams,
    {
      containerHeight: height,
      estimateItemSize: estimateRowHeight,
      enableDynamicSizing,
      autoStart: usingLiveData,
      enableCache: usingLiveData,
      ...liveOptions
    }
  );

  // Use live data if available, otherwise fall back to static items
  const finalItems = usingLiveData ? (liveQuery.data || []) : (items || []);
  const finalLoading = usingLiveData ? liveQuery.loading : loading;
  const finalError = usingLiveData ? liveQuery.error : null;

  // Calculate column width including gaps
  const actualColumnWidth = useMemo(() => {
    const totalGapWidth = (columnCount - 1) * gap;
    return Math.max((width - totalGapWidth) / columnCount, estimateColumnWidth);
  }, [width, columnCount, gap, estimateColumnWidth]);

  // Virtual grid hook for static data fallback - need to pass proper grid data structure
  const staticGridData = useMemo(() => {
    const rows: any[][] = [];
    for (let i = 0; i < finalItems.length; i += columnCount) {
      rows.push(finalItems.slice(i, i + columnCount));
    }
    return rows;
  }, [finalItems, columnCount]);

  const staticVirtualGrid = useVirtualizedGrid(staticGridData, {
    rowCount: Math.ceil(finalItems.length / columnCount),
    columnCount,
    containerHeight: height,
    containerWidth: width,
    estimatedItemHeight: estimateRowHeight,
    estimatedItemWidth: actualColumnWidth,
    enableDynamicSizing
  });

  // Use live virtual grid if available, otherwise static virtual grid
  const virtualGrid = usingLiveData ? {
    containerRef: liveQuery.containerRef,
    virtualItems: [], // Will be calculated from virtualItems
    totalHeight: liveQuery.totalSize,
    totalWidth: width,
    scrollToIndex: liveQuery.scrollToIndex,
    isScrolling: liveQuery.isScrolling
  } : staticVirtualGrid;

  // Convert live virtual items to grid format if using live data
  const virtualGridItems = useMemo(() => {
    if (!usingLiveData) {
      return staticVirtualGrid.virtualItems;
    }

    // Convert linear virtual items to grid layout
    return liveQuery.virtualItems.map((virtualItem) => {
      const rowIndex = Math.floor(virtualItem.index / columnCount);
      const columnIndex = virtualItem.index % columnCount;

      return {
        key: virtualItem.key,
        rowIndex,
        columnIndex,
        itemIndex: virtualItem.index,
        x: columnIndex * (actualColumnWidth + gap),
        y: virtualItem.start,
        width: actualColumnWidth,
        height: virtualItem.size
      };
    });
  }, [usingLiveData, liveQuery.virtualItems, staticVirtualGrid.virtualItems, columnCount, actualColumnWidth, gap]);

  // Handle item click
  const handleItemClick = useCallback((itemIndex: number) => {
    const item = finalItems[itemIndex];
    if (item && onItemClick) {
      onItemClick(item, itemIndex);
    }
  }, [finalItems, onItemClick]);

  // Error state for live queries
  if (finalError) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <div className="flex flex-col items-center space-y-4 text-red-500">
          <div className="text-xl">⚠️</div>
          <div className="text-center">
            <p className="text-sm font-medium">Query Error</p>
            <p className="text-xs text-gray-500">{finalError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (finalLoading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="text-sm text-gray-500">
            {usingLiveData ? 'Loading live data...' : 'Loading items...'}
          </span>
        </div>
      </div>
    );
  }

  // Empty state
  if (finalItems.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
      >
        {emptyState || (
          <div className="text-center text-gray-500">
            <span className="text-sm">No items to display</span>
            {usingLiveData && (
              <p className="text-xs mt-1">Query: {sql?.slice(0, 50)}...</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`overflow-auto ${className}`}
      style={{ height, width }}
    >
      <div
        ref={virtualGrid.containerRef}
        className="relative"
        style={{
          height: virtualGrid.totalHeight,
          width: virtualGrid.totalWidth
        }}
      >
        {virtualGridItems.map((virtualItem: any) => {
          const item = finalItems[virtualItem.itemIndex];
          if (!item) return null;

          return (
            <div
              key={virtualItem.key}
              className={`absolute top-0 left-0 ${onItemClick ? 'cursor-pointer' : ''}`}
              style={{
                height: virtualItem.height,
                width: virtualItem.width,
                transform: `translateX(${virtualItem.x}px) translateY(${virtualItem.y}px)`,
                padding: gap / 2
              }}
              onClick={() => handleItemClick(virtualItem.itemIndex)}
              ref={liveQuery.measureElement ? (el) => {
                if (el) liveQuery.measureElement!(el);
              } : undefined}
            >
              <div className="h-full w-full">
                {renderItem(item, virtualItem.itemIndex)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrolling indicator with live data status */}
      {virtualGrid.isScrolling && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          Scrolling...
          {usingLiveData && liveQuery.isLive && (
            <span className="ml-1 text-green-400">● Live</span>
          )}
        </div>
      )}

      {/* Performance metrics overlay (development only) */}
      {usingLiveData && liveQuery.performanceMetrics && process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          <div>Cache: {liveQuery.performanceMetrics.cacheEfficiency.combinedEfficiency.toFixed(1)}%</div>
          <div>FPS: {liveQuery.performanceMetrics.frameRate.toFixed(0)}</div>
        </div>
      )}
    </div>
  );
});

/**
 * Specialized grid component for Isometry nodes
 */
export interface NodeGridProps extends Omit<VirtualizedGridProps<Node>, 'renderItem'> {
  /** Custom node renderer */
  renderNode?: (node: Node, index: number) => React.ReactNode;
  /** Show node metadata */
  showMetadata?: boolean;
}

export function NodeGrid({
  items,
  renderNode,
  showMetadata = true
}: NodeGridProps) {
  const defaultRenderNode = useCallback((item: unknown, index: number) => {
    // Type guard to ensure item is a Node
    if (!isNode(item)) {
      return (
        <div className="h-full w-full bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-center">
          <span className="text-red-600 text-xs">Invalid node data</span>
        </div>
      );
    }

    const node = item;
    return (
      <div className="h-full w-full bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col">
        {/* Node header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {node.name || `Node ${node.id}`}
            </h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              {node.nodeType}
            </p>
          </div>
          {showMetadata && (
            <div className="text-xs text-gray-400">
              #{index + 1}
            </div>
          )}
        </div>

        {/* Node content preview */}
        {node.content && (
          <div className="flex-1 min-h-0">
            <p className="text-xs text-gray-600 line-clamp-3">
              {typeof node.content === 'string'
                ? node.content
                : JSON.stringify(node.content).slice(0, 100)}
            </p>
          </div>
        )}

        {/* Node metadata */}
        {showMetadata && (
          <div className="mt-auto pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Modified: {new Date(node.modifiedAt).toLocaleDateString()}</span>
              {node.tags && (
                <div className="flex space-x-1">
                  {node.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="bg-gray-100 px-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [showMetadata]);

  const safeRenderNode = useCallback((item: unknown, index: number) => {
    if (renderNode && isNode(item)) {
      return renderNode(item, index);
    }
    return defaultRenderNode(item, index);
  }, [renderNode, defaultRenderNode]);

  return (
    <VirtualizedGrid
      items={items}
      renderItem={safeRenderNode}
    />
  );
}

/**
 * Specialized grid component for Isometry edges
 */
export interface EdgeGridProps extends Omit<VirtualizedGridProps<Edge>, 'renderItem'> {
  /** Custom edge renderer */
  renderEdge?: (edge: Edge, index: number) => React.ReactNode;
  /** Show edge details */
  showDetails?: boolean;
}

export function EdgeGrid({
  items,
  renderEdge,
  showDetails = true
}: EdgeGridProps) {
  const defaultRenderEdge = useCallback((item: unknown, index: number) => {
    // Type guard to ensure item is an Edge
    if (!isEdge(item)) {
      return (
        <div className="h-full w-full bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-center">
          <span className="text-red-600 text-xs">Invalid edge data</span>
        </div>
      );
    }

    const edge = item;
    return (
      <div className="h-full w-full bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col">
        {/* Edge header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">
              {edge.label || `${edge.edgeType} Connection`}
            </h3>
            <p className="text-xs text-gray-500">
              Edge {edge.id}
            </p>
          </div>
          <div className="text-xs text-gray-400">
            #{index + 1}
          </div>
        </div>

        {/* Connection info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium">From:</span>
            <span className="ml-1 truncate">{edge.sourceId}</span>
          </div>
          <div className="flex items-center text-xs text-gray-600">
            <span className="font-medium">To:</span>
            <span className="ml-1 truncate">{edge.targetId}</span>
          </div>
          {edge.weight && (
            <div className="flex items-center text-xs text-gray-600">
              <span className="font-medium">Weight:</span>
              <span className="ml-1">{edge.weight}</span>
            </div>
          )}
        </div>

        {/* Edge metadata */}
        {showDetails && (
          <div className="mt-auto pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              Created: {new Date(edge.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    );
  }, [showDetails]);

  const safeRenderEdge = useCallback((item: unknown, index: number) => {
    if (renderEdge && isEdge(item)) {
      return renderEdge(item, index);
    }
    return defaultRenderEdge(item, index);
  }, [renderEdge, defaultRenderEdge]);

  return (
    <VirtualizedGrid
      items={items}
      renderItem={safeRenderEdge}
    />
  );
}