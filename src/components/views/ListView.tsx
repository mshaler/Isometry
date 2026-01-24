import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import { Search, X, ArrowUpDown } from 'lucide-react';
import { useListData } from '../../hooks/useListData';
import { usePAFV } from '../../hooks/usePAFV';
import { useSelection } from '../../state/SelectionContext';
import { ListItem } from '../ListItem';
import { ListGroup } from '../ListGroup';
import type { Node } from '../../types/node';

// Item heights for virtualization
const ITEM_HEIGHT = 100; // Regular list item height
const GROUP_HEADER_HEIGHT = 44; // Group header height
const SEARCH_BAR_HEIGHT = 60; // Search controls height

interface ListViewProps {
  data?: Node[]; // Optional: if provided, bypasses useListData hook
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
export function ListView({ data: externalData, onNodeClick }: ListViewProps) {
  const { state } = usePAFV();
  const { selection, select } = useSelection();
  const listRef = useRef<List>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(false);

  // Grouping enabled by default (can be toggled in MiniNav in Wave 4)
  const [groupingEnabled, setGroupingEnabled] = useState(true);

  // Get list data from hook (unless external data provided)
  const hookData = useListData(groupingEnabled);
  const listData = externalData
    ? {
        groups: null,
        flatNodes: externalData,
        sortAxis: null,
        sortFacet: null,
        isGrouped: false,
      }
    : hookData;

  // Filter nodes by search query (debounced in the future, but immediate for now)
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return listData.flatNodes;
    }

    const query = searchQuery.toLowerCase();
    return listData.flatNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.content?.toLowerCase().includes(query) ||
        node.summary?.toLowerCase().includes(query) ||
        node.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [listData.flatNodes, searchQuery]);

  // Sort filtered nodes
  const sortedNodes = useMemo(() => {
    const sorted = [...filteredNodes];
    if (sortAscending) {
      sorted.reverse();
    }
    return sorted;
  }, [filteredNodes, sortAscending]);

  // Build virtualized list items (groups + nodes)
  const listItems = useMemo(() => {
    if (!listData.isGrouped || !listData.groups) {
      // Flat list (no grouping)
      return sortedNodes.map((node) => ({
        type: 'node' as const,
        node,
        groupKey: null,
      }));
    }

    // Grouped list
    const items: Array<
      | { type: 'group'; groupKey: string; label: string; count: number }
      | { type: 'node'; node: Node; groupKey: string }
    > = [];

    listData.groups.forEach((group) => {
      // Filter group nodes by search
      const groupNodes = group.nodes.filter((node) =>
        filteredNodes.includes(node)
      );

      if (groupNodes.length === 0) {
        return; // Skip empty groups
      }

      // Add group header
      items.push({
        type: 'group',
        groupKey: group.key,
        label: group.label,
        count: groupNodes.length,
      });

      // Add group nodes
      groupNodes.forEach((node) => {
        items.push({
          type: 'node',
          node,
          groupKey: group.key,
        });
      });
    });

    return items;
  }, [listData, sortedNodes, filteredNodes]);

  // Handle item click
  const handleItemClick = useCallback(
    (node: Node) => {
      select(node.id);
      onNodeClick?.(node);
    },
    [select, onNodeClick]
  );

  // Get item height for virtualization
  const getItemSize = (index: number) => {
    const item = listItems[index];
    return item.type === 'group' ? GROUP_HEADER_HEIGHT : ITEM_HEIGHT;
  };

  // Render individual list item
  const renderItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = listItems[index];

    if (item.type === 'group') {
      return (
        <div style={style}>
          <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {item.label}
              </h2>
              <span className="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded">
                {item.count}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={style}>
        <ListItem
          node={item.node}
          onClick={handleItemClick}
          isSelected={selection.selectedIds.has(item.node.id)}
        />
      </div>
    );
  };

  // Scroll to top when search changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0, 'start');
    }
  }, [searchQuery]);

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
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort Toggle */}
        <button
          onClick={toggleSort}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          aria-label={`Sort ${sortAscending ? 'descending' : 'ascending'}`}
        >
          <ArrowUpDown size={16} />
          <span>{sortAscending ? '↑' : '↓'}</span>
        </button>

        {/* Grouping Toggle */}
        <button
          onClick={() => setGroupingEnabled(!groupingEnabled)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            groupingEnabled
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label={`${groupingEnabled ? 'Disable' : 'Enable'} grouping`}
        >
          {groupingEnabled ? 'Grouped' : 'Flat'}
        </button>
      </div>

      {/* Virtualized List */}
      <div className="flex-1">
        {listItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>No items found</p>
          </div>
        ) : (
          <List
            ref={listRef}
            height={window.innerHeight - SEARCH_BAR_HEIGHT - 100} // Adjust for header/footer
            itemCount={listItems.length}
            itemSize={getItemSize}
            width="100%"
            overscanCount={5} // Render 5 items above/below viewport for smooth scrolling
          >
            {renderItem}
          </List>
        )}
      </div>
    </div>
  );
}
