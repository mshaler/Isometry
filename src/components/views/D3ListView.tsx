import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';
import { usePAFV } from '../../hooks/usePAFV';
import { useTheme } from '../../contexts/ThemeContext';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import type { Node } from '../../types/node';
import * as d3 from 'd3';

interface D3ListViewProps {
  /** SQL query to execute and observe for live data */
  sql: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
}

interface ListItem {
  id: string;
  node: Node;
  index: number;
  groupKey?: string;
  isGroupHeader?: boolean;
  groupLabel?: string;
  groupCount?: number;
  isVisible?: boolean;
}

interface ListGroup {
  key: string;
  label: string;
  nodes: Node[];
  collapsed: boolean;
}

interface ListState {
  searchQuery: string;
  sortDirection: 'asc' | 'desc';
  groupingEnabled: boolean;
  collapsedGroups: Set<string>;
  selectedItems: Set<string>;
  hoveredItem: string | null;
}

const ITEM_HEIGHT = 80;
const GROUP_HEADER_HEIGHT = 40;
const SEARCH_BAR_HEIGHT = 60;

/**
 * Enhanced D3-powered List View component
 *
 * Features:
 * - D3-based virtual scrolling for efficient rendering
 * - Animated search result filtering and highlighting
 * - Group headers with expand/collapse functionality
 * - Sort animations and smooth list reordering
 * - Performance optimized for large datasets
 * - Smooth transitions and visual feedback
 */
export function D3ListView({ sql, queryParams = [], onNodeClick }: D3ListViewProps) {
  const { wells } = usePAFV();
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Component state
  const [listState, setListState] = useState<ListState>({
    searchQuery: '',
    sortDirection: 'desc',
    groupingEnabled: true,
    collapsedGroups: new Set(),
    selectedItems: new Set(),
    hoveredItem: null
  });

  // Augment SQL query with search and sort criteria
  const enhancedSql = useMemo(() => {
    let query = sql;

    // Add search filtering if query exists
    if (listState.searchQuery.trim()) {
      const searchTerm = listState.searchQuery.trim().toLowerCase();
      query += ` AND (
        LOWER(name) LIKE '%${searchTerm}%' OR
        LOWER(content) LIKE '%${searchTerm}%' OR
        LOWER(summary) LIKE '%${searchTerm}%' OR
        id IN (SELECT node_id FROM node_tags nt JOIN tags t ON nt.tag_id = t.id WHERE LOWER(t.name) LIKE '%${searchTerm}%')
      )`;
    }

    // Add sorting
    const sortOrder = listState.sortDirection === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY modified_at ${sortOrder}, created_at ${sortOrder}`;

    return query;
  }, [sql, listState.searchQuery, listState.sortDirection]);

  // Live query for real-time data updates
  const {
    data,
    loading: isLoading,
    error,
    isLive,
    connectionState
  } = useLiveQuery<Node>(enhancedSql, {
    params: queryParams,
    autoStart: true,
    enableCache: true,
    debounceMs: 100, // Moderate debounce for D3 list
    onError: (err) => {
      console.error('[D3ListView] Live query error:', err);
    }
  });

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [animating, setAnimating] = useState(false);

  // Create groups based on PAFV Y-axis
  const groups = useMemo((): ListGroup[] => {
    if (!data || !listState.groupingEnabled || wells.rows.length === 0) {
      return [{
        key: 'all',
        label: 'All Items',
        nodes: data || [],
        collapsed: false
      }];
    }

    const groupMap = new Map<string, Node[]>();
    const firstRowChip = wells.rows[0];

    (data || []).forEach(node => {
      const groupValue = getFieldValue(node, firstRowChip.id);
      const groupKey = String(groupValue);

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(node);
    });

    return Array.from(groupMap.entries()).map(([key, nodes]) => ({
      key,
      label: key,
      nodes: nodes.sort((a, b) => {
        const aTime = new Date(a.modifiedAt).getTime();
        const bTime = new Date(b.modifiedAt).getTime();
        return listState.sortDirection === 'desc' ? bTime - aTime : aTime - bTime;
      }),
      collapsed: listState.collapsedGroups.has(key)
    }));
  }, [data, wells.rows, listState.groupingEnabled, listState.collapsedGroups, listState.sortDirection]);

  // Filter nodes by search query
  const filteredGroups = useMemo((): ListGroup[] => {
    if (!listState.searchQuery.trim()) {
      return groups;
    }

    const query = listState.searchQuery.toLowerCase();
    return groups.map(group => ({
      ...group,
      nodes: group.nodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        node.content?.toLowerCase().includes(query) ||
        node.tags.some((tag: string) => tag.toLowerCase().includes(query))
      )
    })).filter(group => group.nodes.length > 0);
  }, [groups, listState.searchQuery]);

  // Create flat list of items for virtual scrolling
  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let globalIndex = 0;

    filteredGroups.forEach(group => {
      if (listState.groupingEnabled) {
        // Add group header
        items.push({
          id: `group-${group.key}`,
          node: {} as Node,
          index: globalIndex++,
          groupKey: group.key,
          isGroupHeader: true,
          groupLabel: group.label,
          groupCount: group.nodes.length,
          isVisible: true
        });
      }

      // Add group items (only if not collapsed)
      if (!group.collapsed) {
        group.nodes.forEach(node => {
          items.push({
            id: node.id,
            node,
            index: globalIndex++,
            groupKey: group.key,
            isGroupHeader: false,
            isVisible: true
          });
        });
      }
    });

    return items;
  }, [filteredGroups, listState.groupingEnabled]);

  // Calculate visible items for virtual scrolling
  const visibleItems = useMemo(() => {
    const startY = scrollTop;
    const endY = scrollTop + containerHeight;

    let currentY = 0;
    const visible: { item: ListItem; y: number; height: number }[] = [];

    for (const item of listItems) {
      const itemHeight = item.isGroupHeader ? GROUP_HEADER_HEIGHT : ITEM_HEIGHT;

      if (currentY + itemHeight >= startY && currentY <= endY) {
        visible.push({ item, y: currentY - scrollTop, height: itemHeight });
      }

      currentY += itemHeight;

      // Early exit if we're past the visible area
      if (currentY > endY) break;
    }

    return visible;
  }, [listItems, scrollTop, containerHeight]);

  // Helper function to get field value
  function getFieldValue(node: Node, chipId: string): string {
    const fieldMap: Record<string, keyof Node> = {
      folder: 'folder',
      status: 'status',
      priority: 'priority',
    };

    const field = fieldMap[chipId] || 'folder';
    return String(node[field] ?? 'Unknown');
  }

  // Event handlers
  const handleSearch = useCallback((query: string) => {
    setListState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const clearSearch = useCallback(() => {
    setListState(prev => ({ ...prev, searchQuery: '' }));
  }, []);

  const toggleSort = useCallback(() => {
    setAnimating(true);
    setListState(prev => ({
      ...prev,
      sortDirection: prev.sortDirection === 'desc' ? 'asc' : 'desc'
    }));

    // Clear animation flag after transition
    setTimeout(() => setAnimating(false), 300);
  }, []);

  const toggleGrouping = useCallback(() => {
    setListState(prev => ({
      ...prev,
      groupingEnabled: !prev.groupingEnabled,
      collapsedGroups: new Set() // Reset collapsed state
    }));
  }, []);

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setListState(prev => {
      const newCollapsed = new Set(prev.collapsedGroups);
      if (newCollapsed.has(groupKey)) {
        newCollapsed.delete(groupKey);
      } else {
        newCollapsed.add(groupKey);
      }
      return { ...prev, collapsedGroups: newCollapsed };
    });
  }, []);

  const handleItemClick = useCallback((item: ListItem) => {
    if (item.isGroupHeader) {
      toggleGroupCollapse(item.groupKey!);
    } else {
      onNodeClick?.(item.node);
    }
  }, [onNodeClick, toggleGroupCollapse]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // Handle container resize
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight - SEARCH_BAR_HEIGHT);
    }
  }, []);

  // Setup resize observer
  useEffect(() => {
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [handleResize]);

  // Render D3 list items
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svg.append('g').attr('class', 'list-container');

    // Create groups for items
    const itemGroups = container
      .selectAll('.list-item')
      .data(visibleItems, (d) => (d as { item: ListItem; y: number; height: number }).item.id)
      .enter()
      .append('g')
      .attr('class', 'list-item')
      .attr('transform', d => `translate(0, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => handleItemClick(d.item));

    // Render group headers
    const groupHeaders = itemGroups.filter(d => d.item.isGroupHeader ?? false);

    groupHeaders
      .append('rect')
      .attr('width', '100%')
      .attr('height', GROUP_HEADER_HEIGHT)
      .attr('fill', theme === 'NeXTSTEP' ? '#e8e8e8' : '#f3f4f6')
      .attr('stroke', theme === 'NeXTSTEP' ? '#c0c0c0' : '#e5e7eb')
      .attr('stroke-width', 1);

    groupHeaders
      .append('text')
      .attr('x', 12)
      .attr('y', GROUP_HEADER_HEIGHT / 2)
      .attr('dominant-baseline', 'central')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text(d => d.item.groupLabel || '');

    groupHeaders
      .append('text')
      .attr('x', 200)
      .attr('y', GROUP_HEADER_HEIGHT / 2)
      .attr('dominant-baseline', 'central')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280')
      .text(d => `${d.item.groupCount} items`);

    // Render regular items
    const regularItems = itemGroups.filter(d => !d.item.isGroupHeader);

    regularItems
      .append('rect')
      .attr('width', '100%')
      .attr('height', ITEM_HEIGHT)
      .attr('fill', 'white')
      .attr('stroke', theme === 'NeXTSTEP' ? '#c0c0c0' : '#e5e7eb')
      .attr('stroke-width', 0.5)
      .on('mouseenter', function(_event, d) {
        d3.select(this).attr('fill', theme === 'NeXTSTEP' ? '#f5f5f5' : '#f9fafb');
        setListState(prev => ({ ...prev, hoveredItem: d.item.id }));
      })
      .on('mouseleave', function(_event, _d) {
        d3.select(this).attr('fill', 'white');
        setListState(prev => ({ ...prev, hoveredItem: null }));
      });

    // Item title
    regularItems
      .append('text')
      .attr('x', 12)
      .attr('y', 20)
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#111827')
      .text(d => d.item.node.name || '');

    // Item content
    regularItems
      .append('text')
      .attr('x', 12)
      .attr('y', 38)
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text(d => {
        const content = d.item.node.content || '';
        return content.length > 60 ? content.substring(0, 60) + '...' : content;
      });

    // Item metadata
    regularItems
      .append('text')
      .attr('x', 12)
      .attr('y', 58)
      .attr('font-size', '10px')
      .attr('fill', '#9ca3af')
      .text(d => {
        const node = d.item.node;
        return `${node.folder} • ${node.status} • ${node.priority}`;
      });

    // Priority indicator
    regularItems
      .append('rect')
      .attr('x', '95%')
      .attr('y', 10)
      .attr('width', 4)
      .attr('height', ITEM_HEIGHT - 20)
      .attr('fill', d => {
        const priority = d.item.node.priority;
        return priority >= 7 ? '#ef4444' :
               priority >= 4 ? '#f59e0b' : '#10b981';
      });

    // Search highlighting
    if (listState.searchQuery) {
      regularItems.selectAll('text').each(function(_d) {
        const element = d3.select(this);
        const text = element.text();
        const query = listState.searchQuery.toLowerCase();

        if (text.toLowerCase().includes(query)) {
          // Simple highlight by changing color
          element.attr('fill', '#1f2937');
        }
      });
    }

    // Animations
    if (animating) {
      itemGroups
        .style('opacity', 0)
        .transition()
        .duration(300)
        .style('opacity', 1);
    }

  }, [visibleItems, theme, listState, animating, handleItemClick]);

  // Calculate total content height for scrollbar
  const totalHeight = listItems.reduce((sum, item) => {
    return sum + (item.isGroupHeader ? GROUP_HEADER_HEIGHT : ITEM_HEIGHT);
  }, 0);

  // Handle loading and error states
  if (error) {
    return (
      <div className="d3-list-view w-full h-full flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500">Error loading list data: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="d3-list-view w-full h-full flex flex-col bg-white">
      {/* Search and Controls Bar */}
      <div
        className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b ${
          theme === 'NeXTSTEP' ? 'border-[#c0c0c0]' : 'border-gray-200'
        }`}
        style={{ height: SEARCH_BAR_HEIGHT }}
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading && listState.searchQuery ? (
              <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : (
              <Search size={16} className="text-gray-400" />
            )}
          </div>
          <input
            type="text"
            value={listState.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by title, content, or metadata..."
            className={`w-full pl-10 pr-10 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              theme === 'NeXTSTEP'
                ? 'border-[#c0c0c0] bg-white'
                : 'border-gray-300 bg-white'
            }`}
          />
          {listState.searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort Toggle */}
        <button
          onClick={toggleSort}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            theme === 'NeXTSTEP'
              ? 'bg-[#e8e8e8] text-gray-700 hover:bg-[#d8d8d8]'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={`Sort ${listState.sortDirection === 'asc' ? 'ascending' : 'descending'}`}
        >
          <ArrowUpDown size={16} />
          {listState.sortDirection === 'asc' ? '↑' : '↓'}
        </button>

        {/* Grouping Toggle */}
        <button
          onClick={toggleGrouping}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            listState.groupingEnabled
              ? theme === 'NeXTSTEP'
                ? 'bg-[#0066cc] text-white'
                : 'bg-blue-600 text-white'
              : theme === 'NeXTSTEP'
                ? 'bg-[#e8e8e8] text-gray-700 hover:bg-[#d8d8d8]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {listState.groupingEnabled ? 'Grouped' : 'Flat'}
        </button>
      </div>

      {/* Virtual Scrolling Container */}
      <div
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        style={{ height: containerHeight }}
      >
        {/* Phantom content for scrollbar */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* SVG for D3 rendering */}
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full"
            style={{ height: containerHeight }}
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className={`flex-shrink-0 px-4 py-2 text-xs border-t ${
        theme === 'NeXTSTEP'
          ? 'border-[#c0c0c0] bg-[#f5f5f5] text-gray-600'
          : 'border-gray-200 bg-gray-50 text-gray-600'
      }`}>
        {listState.searchQuery ? (
          <span>
            {filteredGroups.reduce((sum, group) => sum + group.nodes.length, 0)} of {(data || []).length} items match "{listState.searchQuery}"
          </span>
        ) : (
          <span>
            {(data || []).length} items {listState.groupingEnabled ? `in ${groups.length} groups` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default D3ListView;