/**
 * Virtual list component for linear datasets with smooth scrolling
 *
 * Provides optimized rendering for large lists using TanStack Virtual
 * with proper item sizing estimation and responsive design. Enhanced with live
 * data support through SQL queries and real-time updates.
 */

import React, { useCallback, forwardRef } from 'react';
import { useVirtualizedList } from '@/hooks';
import { useVirtualLiveQuery, type VirtualLiveQueryOptions } from '@/hooks';
import { Node, Edge } from '../../types/node';

// Type guard functions for safe type casting
function isNode(item: unknown): item is Node {
  return typeof item === 'object' && item !== null && 'id' in item && 'nodeType' in item;
}

function isEdge(item: unknown): item is Edge {
  return typeof item === 'object' && item !== null && 'id' in item && 'edgeType' in item && 'sourceId' in item && 'targetId' in item;
}

export interface VirtualizedListProps<T = unknown> {
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

  // List configuration
  /** Height of the list container (defaults to 400px) */
  height?: number;
  /** Estimated height of each item */
  estimateItemSize?: number;
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
  /** Horizontal scrolling instead of vertical */
  horizontal?: boolean;
  /** Number of items to render outside viewport for smooth scrolling */
  overscan?: number;
  /** Item separator component */
  separator?: React.ReactNode;
}

/**
 * High-performance virtual list component with live data support
 */
export const VirtualizedList = forwardRef<HTMLDivElement, VirtualizedListProps>(function VirtualizedList({
  items,
  sql,
  queryParams = [],
  liveOptions = {},
  height = 400,
  estimateItemSize = 50,
  renderItem,
  loading = false,
  emptyState,
  className = '',
  onItemClick,
  enableDynamicSizing = true,
  horizontal = false,
  overscan = 10,
  separator
}, ref) {
  // Determine if using live data or static data
  const usingLiveData = Boolean(sql);

  // Live query hook for SQL-based data
  const liveQuery = useVirtualLiveQuery<any>(
    sql || 'SELECT 1 WHERE 0', // Dummy query when not using live data
    queryParams,
    {
      containerHeight: height,
      estimateItemSize,
      horizontal,
      overscan,
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

  // Virtual list hook for static data fallback
  const staticVirtualList = useVirtualizedList(finalItems.length, {
    containerHeight: height,
    estimateSize: estimateItemSize,
    overscan,
    horizontal,
    enableDynamicSizing
  });

  // Use live virtual list if available, otherwise static virtual list
  const virtualList = usingLiveData ? {
    containerRef: liveQuery.containerRef,
    virtualItems: liveQuery.virtualItems,
    totalSize: liveQuery.totalSize,
    scrollToIndex: liveQuery.scrollToIndex,
    isScrolling: liveQuery.isScrolling
  } : staticVirtualList;

  // Handle item click
  const handleItemClick = useCallback((index: number) => {
    const item = finalItems[index];
    if (item && onItemClick) {
      onItemClick(item, index);
    }
  }, [finalItems, onItemClick]);


  // Error state for live queries
  if (finalError) {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
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
        ref={ref}
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
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
        ref={ref}
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
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
      className={`${className}`}
      style={{ height }}
    >
      <div
        ref={virtualList.containerRef}
        className="overflow-auto w-full h-full"
        style={{
          [horizontal ? 'width' : 'height']: '100%'
        }}
      >
        <div
          className="relative"
          style={{
            [horizontal ? 'width' : 'height']: virtualList.totalSize,
            [horizontal ? 'height' : 'width']: '100%'
          }}
        >
          {virtualList.virtualItems.map((virtualItem, listIndex) => {
            const item = finalItems[virtualItem.index];
            if (!item) return null;

            return (
              <div key={virtualItem.key}>
                <div
                  className={`absolute ${horizontal ? 'top-0' : 'left-0'} w-full ${onItemClick ? 'cursor-pointer' : ''}`}
                  style={{
                    [horizontal ? 'left' : 'top']: 0,
                    [horizontal ? 'top' : 'left']: 0,
                    [horizontal ? 'width' : 'height']: virtualItem.size,
                    [horizontal ? 'height' : 'width']: '100%',
                    transform: horizontal
                      ? `translateX(${virtualItem.start}px)`
                      : `translateY(${virtualItem.start}px)`
                  }}
                  onClick={() => handleItemClick(virtualItem.index)}
                  ref={usingLiveData && liveQuery.measureElement ? (el) => {
                    if (el) liveQuery.measureElement!(el);
                  } : undefined}
                >
                  {renderItem(item, virtualItem.index)}
                </div>

                {/* Separator */}
                {separator && listIndex < virtualList.virtualItems.length - 1 && (
                  <div
                    className="absolute"
                    style={{
                      [horizontal ? 'left' : 'top']: virtualItem.end,
                      [horizontal ? 'top' : 'left']: 0,
                      [horizontal ? 'height' : 'width']: '100%'
                    }}
                  >
                    {separator}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrolling indicator with live data status */}
      {virtualList.isScrolling && (
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
 * Specialized list component for Isometry nodes
 */
export interface NodeListProps extends Omit<VirtualizedListProps<Node>, 'renderItem'> {
  /** Custom node renderer */
  renderNode?: (node: Node, index: number) => React.ReactNode;
  /** Show node metadata */
  showMetadata?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

export function NodeList({
  items,
  renderNode,
  showMetadata = true,
  compact = false
}: NodeListProps) {
  const defaultRenderNode = useCallback((item: unknown, index: number) => {
    // Type guard to ensure item is a Node
    if (!isNode(item)) {
      return (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-sm">Invalid node data</span>
        </div>
      );
    }

    const node = item;
    if (compact) {
      return (
        <div className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 border-b border-gray-100">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-blue-600">
              {node.nodeType[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {node.name || `Node ${node.id}`}
            </h3>
            <p className="text-xs text-gray-500">
              {node.nodeType} • {new Date(node.modifiedAt).toLocaleDateString()}
            </p>
          </div>
          {showMetadata && (
            <div className="text-xs text-gray-400">
              #{index + 1}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mx-4 my-2 p-4">
        {/* Node header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {node.nodeType}
              </span>
              {showMetadata && (
                <span className="text-xs text-gray-400">#{index + 1}</span>
              )}
            </div>
            <h3 className="text-base font-medium text-gray-900">
              {node.name || `Node ${node.id}`}
            </h3>
          </div>
        </div>

        {/* Node content preview */}
        {node.content && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 line-clamp-2">
              {typeof node.content === 'string'
                ? node.content
                : JSON.stringify(node.content).slice(0, 200)}
            </p>
          </div>
        )}

        {/* Node metadata */}
        {showMetadata && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Modified: {new Date(node.modifiedAt).toLocaleDateString()}
            </div>
            {node.tags && (
              <div className="flex space-x-1">
                {node.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [showMetadata, compact]);

  const safeRenderNode = useCallback((item: unknown, index: number) => {
    if (renderNode && isNode(item)) {
      return renderNode(item, index);
    }
    return defaultRenderNode(item, index);
  }, [renderNode, defaultRenderNode]);

  return (
    <VirtualizedList
      items={items}
      renderItem={safeRenderNode}
      estimateItemSize={compact ? 60 : 150}
    />
  );
}

/**
 * Specialized list component for Isometry edges
 */
export interface EdgeListProps extends Omit<VirtualizedListProps<Edge>, 'renderItem'> {
  /** Custom edge renderer */
  renderEdge?: (edge: Edge, index: number) => React.ReactNode;
  /** Show edge details */
  showDetails?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

export function EdgeList({
  items,
  renderEdge,
  showDetails = true,
  compact = false
}: EdgeListProps) {
  const defaultRenderEdge = useCallback((item: unknown, index: number) => {
    // Type guard to ensure item is an Edge
    if (!isEdge(item)) {
      return (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded">
          <span className="text-red-600 text-sm">Invalid edge data</span>
        </div>
      );
    }

    const edge = item;
    if (compact) {
      return (
        <div className="flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 border-b border-gray-100">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-green-600">→</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {edge.label || `${edge.edgeType} Connection`}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {edge.sourceId} → {edge.targetId}
            </p>
          </div>
          <div className="text-xs text-gray-400">
            #{index + 1}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mx-4 my-2 p-4">
        {/* Edge header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {edge.edgeType || 'edge'}
              </span>
              <span className="text-xs text-gray-400">#{index + 1}</span>
            </div>
            <h3 className="text-base font-medium text-gray-900">
              Edge {edge.id}
            </h3>
          </div>
        </div>

        {/* Connection details */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Source:</span>
            <span className="font-mono text-gray-900 truncate ml-2">{edge.sourceId}</span>
          </div>
          <div className="flex items-center justify-center text-gray-400">
            <span className="text-lg">↓</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Target:</span>
            <span className="font-mono text-gray-900 truncate ml-2">{edge.targetId}</span>
          </div>
          {edge.weight && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Weight:</span>
              <span className="font-mono text-gray-900">{edge.weight}</span>
            </div>
          )}
        </div>

        {/* Edge metadata */}
        {showDetails && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Created: {new Date(edge.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    );
  }, [showDetails, compact]);

  const safeRenderEdge = useCallback((item: unknown, index: number) => {
    if (renderEdge && isEdge(item)) {
      return renderEdge(item, index);
    }
    return defaultRenderEdge(item, index);
  }, [renderEdge, defaultRenderEdge]);

  return (
    <VirtualizedList
      items={items}
      renderItem={safeRenderEdge}
      estimateItemSize={compact ? 60 : 180}
    />
  );
}