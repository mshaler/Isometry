import { useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, ArrowUpDown, Wifi, WifiOff, Loader } from 'lucide-react';
import { VirtualizedList } from '../VirtualizedList';
import { useSelection } from '../../state/SelectionContext';
import { ListItem } from '../ListItem';
import { useNetworkAwareSync } from '../../hooks/useNetworkAwareSync';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import type { Node } from '../../types/node';
import type { VirtualLiveQueryOptions } from '../../hooks/useVirtualLiveQuery';

// Item heights for virtualization
const ITEM_HEIGHT = 100; // Regular list item height
const SEARCH_BAR_HEIGHT = 60; // Search controls height

interface ListViewProps {
  /** SQL query to execute and observe for live data */
  sql: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Live query options for virtual scrolling */
  liveOptions?: VirtualLiveQueryOptions;
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}

/**
 * List View - Vertical list alternative to SuperGrid.
 *
 * Features:
 * - React-window virtualization for 10,000+ items
 * - PAFV-based sorting (Y-axis determines order)
 * - Collapsible grouping by facet value
 * - Search/filter controls
 * - Sort direction toggle
 * - Integrates with SelectionContext for Card Overlay
 */
export function ListView({
  sql,
  queryParams = [],
  liveOptions: _liveOptions = { containerHeight: 600 },
  onNodeClick
}: ListViewProps) {
  const { selection, select } = useSelection();
  const listRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(false);

  // Augment SQL query with search and sort criteria
  const enhancedSql = useMemo(() => {
    let query = sql;

    // Add search filtering if query exists
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase();
      query += ` AND (
        LOWER(name) LIKE '%${searchTerm}%' OR
        LOWER(content) LIKE '%${searchTerm}%' OR
        LOWER(summary) LIKE '%${searchTerm}%' OR
        id IN (
          SELECT node_id FROM node_tags nt
          JOIN tags t ON nt.tag_id = t.id
          WHERE LOWER(t.name) LIKE '%${searchTerm}%'
        )
      )`;
    }

    // Add sorting
    const sortOrder = sortAscending ? 'ASC' : 'DESC';
    query += ` ORDER BY modified_at ${sortOrder}, created_at ${sortOrder}`;

    return query;
  }, [sql, searchQuery, sortAscending]);

  // Live query for real-time data updates
  const {
    data: nodes,
    loading,
    error,
    isLive,
    connectionState
  } = useLiveQuery<Node>(enhancedSql, {
    params: queryParams,
    autoStart: true,
    enableCache: true,
    debounceMs: 100, // Moderate debounce for list
    onError: (err) => {
      console.error('[ListView] Live query error:', err);
    }
  });

  // Network-aware sync for adaptive performance - now using connection state from useLiveQuery
  const networkQuality = connectionState?.quality === 'fast' ? 'high' :
                         connectionState?.quality === 'slow' ? 'medium' : 'low';
  const isOnline = connectionState?.quality !== 'offline';

  const {
    adaptationMetrics,
    isProcessing
  } = useNetworkAwareSync({
    enableRealTimeSync: {
      high: true,
      medium: true,
      low: false
    },
    syncFrequency: {
      high: 5000, // 5 seconds
      medium: 15000, // 15 seconds
      low: 60000 // 1 minute
    },
    autoAdjustPriority: true,
    degradeOnSlowConnection: true
  });

  // Handle item click
  const handleItemClick = useCallback(
    (node: Node) => {
      select(node.id);
      onNodeClick?.(node);
    },
    [select, onNodeClick]
  );

  // Render individual list item for VirtualizedList
  const renderItem = useCallback((node: Node, _index: number) => {
    return (
      <ListItem
        node={node}
        onClick={handleItemClick}
        isSelected={selection.selectedIds.has(node.id)}
      />
    );
  }, [handleItemClick, selection.selectedIds]);


  // Network status indicator
  const getNetworkIcon = () => {
    if (!isOnline) return <WifiOff size={14} className="text-red-500" />;
    if (isProcessing) return <Loader size={14} className="text-blue-500 animate-spin" />;
    return <Wifi size={14} className={
      networkQuality === 'high' ? 'text-green-500' :
      networkQuality === 'medium' ? 'text-yellow-500' :
      'text-red-500'
    } />;
  };

  const getNetworkTooltip = () => {
    if (!isOnline) return 'Offline';
    const qualityText = networkQuality.charAt(0).toUpperCase() + networkQuality.slice(1);
    const adaptedText = adaptationMetrics ? ` (${adaptationMetrics.adaptedSyncFrequency / 1000}s refresh)` : '';
    return `Network: ${qualityText}${adaptedText}`;
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Toggle sort direction
  const toggleSort = () => {
    setSortAscending(!sortAscending);
  };

  return (
    <div className="list-view flex flex-col h-full w-full bg-white dark:bg-gray-900">
      {/* Search and Sort Controls */}
      <div
        className="search-controls flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700"
        style={{ height: SEARCH_BAR_HEIGHT }}
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, content, or tags..."
            className={
              "w-full pl-10 pr-10 py-2 text-sm border border-gray-300 " +
              "dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 " +
              "focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            }
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className={
                "absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 " +
                "hover:text-gray-600 dark:hover:text-gray-200"
              }
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort Toggle */}
        <button
          onClick={toggleSort}
          className={
            "flex items-center gap-2 px-3 py-2 text-sm font-medium " +
            "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 " +
            "hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          }
          aria-label={`Sort ${sortAscending ? 'descending' : 'ascending'}`}
        >
          <ArrowUpDown size={16} />
          <span>{sortAscending ? '↑' : '↓'}</span>
        </button>

        {/* Live Data Indicator */}
        <div className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${
          isLive
            ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 ' +
              'border-green-200 dark:border-green-800'
            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="font-medium">{isLive ? 'LIVE' : 'OFFLINE'}</span>
        </div>

        {/* Network Status Indicator */}
        <div
          className={
            "flex items-center gap-1 px-2 py-1 text-xs text-gray-600 " +
            "dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded border"
          }
          title={getNetworkTooltip()}
        >
          {getNetworkIcon()}
          <span className="uppercase font-medium">{networkQuality}</span>
          {connectionState && (
            <span className="text-xs">({connectionState.latency}ms)</span>
          )}
        </div>
      </div>

      {/* Virtualized List with Live Data */}
      <div className="flex-1">
        {loading && !nodes ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-sm text-gray-500">Loading live data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2 p-4">
              <p className="text-red-600">Live data error: {error}</p>
              <p className="text-xs text-gray-500">Check console for details</p>
            </div>
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-gray-500">No nodes found</p>
              {searchQuery && (
                <p className="text-xs text-gray-400">Try adjusting your search</p>
              )}
            </div>
          </div>
        ) : (
          <VirtualizedList
            ref={listRef}
            items={nodes}
            height={window.innerHeight - SEARCH_BAR_HEIGHT - 100} // Adjust for header/footer
            renderItem={(item: unknown, index: number) => renderItem(item as Node, index)}
            estimateItemSize={ITEM_HEIGHT}
            onItemClick={(item: unknown, _index: number) => handleItemClick(item as Node)}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
