import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { VirtualizedGrid } from '../VirtualizedGrid';
import { useNetworkAwareSync } from '../../hooks/useNetworkAwareSync';
import { useCleanupEffect, createCleanupStack, MemoryLeakDetector } from '../../utils/memoryManagement';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import type { Node } from '@/types/node';
import type { VirtualLiveQueryOptions } from '../../hooks/useVirtualLiveQuery';

interface GridViewProps {
  /** SQL query to execute and observe for live data */
  sql: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Live query options for virtual scrolling */
  liveOptions?: VirtualLiveQueryOptions;
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}


export function GridView({
  sql,
  queryParams = [],
  liveOptions: _liveOptions = { containerHeight: 600 },
  onNodeClick
}: GridViewProps) {
  const { theme } = useTheme();

  // Live query for real-time data updates
  const {
    data: nodes,
    loading,
    error,
    isLive,
    connectionState
  } = useLiveQuery<Node>(sql, {
    params: queryParams,
    autoStart: true,
    enableCache: true,
    debounceMs: 50, // Fast updates for grid
    onError: (err) => {
      console.error('[GridView] Live query error:', err);
    }
  });

  // Network-aware sync for adaptive performance - now using connection state from useLiveQuery
  const networkQuality = connectionState?.quality === 'fast' ? 'high' :
                         connectionState?.quality === 'slow' ? 'medium' : 'low';

  useNetworkAwareSync({
    enableRealTimeSync: {
      high: true,
      medium: true,
      low: false
    },
    syncFrequency: {
      high: 3000, // 3 seconds for grid updates
      medium: 10000, // 10 seconds
      low: 30000 // 30 seconds
    },
    autoAdjustPriority: true,
    degradeOnSlowConnection: true,
    enablePayloadOptimization: true
  });

  // Memory management with cleanup stack
  const cleanupStack = useMemo(() => createCleanupStack(), []);
  const gridRef = useRef<HTMLDivElement>(null);
  const imageLoadingRef = useRef<Set<string>>(new Set());

  // Network-aware grid configuration
  const gridConfig = useMemo(() => {
    let columnCount: number;
    let itemHeight: number;
    let enableImageLoading: boolean;
    let updateInterval: number;

    switch (networkQuality) {
      case 'high':
        columnCount = 4; // More columns for faster connections
        itemHeight = 220; // Taller items with more detail
        enableImageLoading = true;
        updateInterval = 100;
        break;
      case 'medium':
        columnCount = 3; // Standard layout
        itemHeight = 200; // Standard height
        enableImageLoading = true;
        updateInterval = 250;
        break;
      case 'low':
        columnCount = 2; // Fewer columns to reduce data
        itemHeight = 180; // Shorter items, less content
        enableImageLoading = false; // Disable image loading
        updateInterval = 500;
        break;
      default:
        columnCount = 3;
        itemHeight = 200;
        enableImageLoading = true;
        updateInterval = 250;
    }

    return { columnCount, itemHeight, enableImageLoading, updateInterval };
  }, [networkQuality]);

  // Calculate grid dimensions
  const containerWidth = useMemo(() => {
    // Use a reasonable default width, in a real app this would come from a container ref
    return window.innerWidth - 400; // Account for sidebars
  }, []);

  const containerHeight = useMemo(() => {
    // Use available height minus header space
    return window.innerHeight - 200; // Account for headers/footers
  }, []);

  // Memory leak tracking for development
  useEffect(() => {
    MemoryLeakDetector.track('GridView');
    return () => {
      MemoryLeakDetector.untrack('GridView');
    };
  }, []);

  // Network-aware image loading management
  const handleImageLoad = useCallback((nodeId: string) => {
    if (gridConfig.enableImageLoading) {
      imageLoadingRef.current.add(nodeId);

      // Clean up loaded images when they're no longer visible
      cleanupStack.add(() => {
        imageLoadingRef.current.delete(nodeId);
      });
    }
  }, [gridConfig.enableImageLoading, cleanupStack]);

  // Grid item styling based on theme and network quality
  const getThemeClasses = useCallback(() => {
    const baseClasses = theme === 'NeXTSTEP' ? {
      card: 'bg-white border border-[#c0c0c0] hover:bg-[#f0f0f0]',
      title: 'text-gray-900',
      subtitle: 'text-gray-600',
      content: 'text-gray-700'
    } : {
      card: 'bg-white border border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow-md',
      title: 'text-gray-900',
      subtitle: 'text-gray-500',
      content: 'text-gray-600'
    };

    // Adjust styling based on network quality
    if (networkQuality === 'low') {
      return {
        ...baseClasses,
        card: baseClasses.card + ' transition-none', // Disable animations on slow connections
        content: baseClasses.content + ' line-clamp-2' // Reduce content on slow connections
      };
    }

    return baseClasses;
  }, [theme, networkQuality]);

  // Render individual grid item
  const renderGridItem = useCallback((node: Node, index: number) => {
    const themeClasses = getThemeClasses();

    // Track item rendering for memory management
    MemoryLeakDetector.track(`GridItem-${node.id}`);

    return (
      <div
        className={`${themeClasses.card} rounded-lg cursor-pointer p-4 flex flex-col h-full`}
        onClick={() => {
          // Clean up the item tracker when clicked (user interaction)
          MemoryLeakDetector.untrack(`GridItem-${node.id}`);
          onNodeClick?.(node);
        }}
        onLoad={() => handleImageLoad(node.id)}
      >
        {/* Node header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium ${themeClasses.title} truncate`}>
              {node.name || `Node ${node.id}`}
            </h3>
            <p className={`text-xs ${themeClasses.subtitle} uppercase tracking-wide`}>
              {node.nodeType}
            </p>
          </div>
          <div className="text-xs text-gray-400">
            #{index + 1}
          </div>
        </div>

        {/* Node content preview - network aware */}
        {node.content && (
          <div className="flex-1 min-h-0 mb-2">
            <p className={`text-xs ${themeClasses.content} ${
              networkQuality === 'low' ? 'line-clamp-2' : 'line-clamp-3'
            }`}>
              {typeof node.content === 'string'
                ? node.content.slice(0, networkQuality === 'low' ? 80 : 120)
                : JSON.stringify(node.content).slice(0, networkQuality === 'low' ? 60 : 120)
              }{networkQuality !== 'low' && '...'}
            </p>
          </div>
        )}

        {/* Node metadata */}
        <div className="mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Modified: {new Date(node.modifiedAt).toLocaleDateString()}</span>
            {node.tags && node.tags.length > 0 && (
              <div className="flex space-x-1">
                {node.tags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="bg-gray-100 px-1 rounded text-gray-600">
                    {tag}
                  </span>
                ))}
                {node.tags.length > 2 && (
                  <span className="text-gray-400">+{node.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [onNodeClick, getThemeClasses, networkQuality, handleImageLoad]);

  // Cleanup effect for memory management
  useCleanupEffect(() => {
    // Clean up image loading tracking
    cleanupStack.add(() => {
      imageLoadingRef.current.clear();
    });

    return () => {
      cleanupStack.destroy();
    };
  }, [cleanupStack], 'GridView:MemoryCleanup');


  // Show loading state while fetching initial data
  if (loading && !nodes) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-sm text-gray-500">Loading live data...</p>
        </div>
      </div>
    );
  }

  // Show error state if live query failed
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-2 p-4">
          <p className="text-red-600">Live data error: {error}</p>
          <p className="text-xs text-gray-500">Check console for details</p>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!nodes || nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-gray-500">No nodes found</p>
          <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
            isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            {isLive ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden" ref={gridRef}>
      {/* Live data status indicator */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${
          isLive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></div>
          {isLive ? 'LIVE' : 'OFFLINE'}
        </div>
        {connectionState && (
          <div
            className={
              "inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 " +
              "text-gray-700 rounded border border-gray-200"
            }
          >
            {connectionState.quality.toUpperCase()} ({connectionState.latency}ms)
          </div>
        )}
      </div>

      <VirtualizedGrid
        items={nodes}
        height={containerHeight}
        width={containerWidth}
        columnCount={gridConfig.columnCount}
        estimateRowHeight={gridConfig.itemHeight}
        estimateColumnWidth={containerWidth / gridConfig.columnCount - 16}
        renderItem={(item: unknown, index: number) => renderGridItem(item as Node, index)}
        gap={networkQuality === 'low' ? 8 : 16} // Smaller gap on slow connections
        onItemClick={(item: unknown, _index: number) => onNodeClick?.(item as Node)}
        enableDynamicSizing={networkQuality !== 'low'} // Disable dynamic sizing on slow connections
        className="w-full h-full"
      />
    </div>
  );
}
