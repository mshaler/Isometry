import { useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useFilters } from '@/contexts/FilterContext';
import { useNodes } from '@/hooks/useSQLiteQuery';
import {
  ListView,
  GridView,
  KanbanView,
  TimelineView,
  CalendarView,
  ChartsView,
  NetworkView,
  TreeView,
} from './views';
import { FilterBar } from './FilterBar';
import type { Node } from '@/types/node';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { activeView } = useAppState();
  const { compiledQuery } = useFilters();

  // Query nodes from SQLite with filters applied
  const { data: nodes, loading, error } = useNodes(
    compiledQuery.sql,
    compiledQuery.params
  );

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  }, []);

  // Render the appropriate view based on activeView
  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading notes...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-500">
          Error: {error.message}
        </div>
      );
    }

    if (!nodes || nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No notes found
        </div>
      );
    }

    switch (activeView) {
      case 'List':
        return <ListView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Gallery':
      case 'Grid':
        return <GridView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Kanban':
        return <KanbanView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Timeline':
        return <TimelineView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Calendar':
        return <CalendarView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Charts':
        return <ChartsView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Graphs':
        return <NetworkView data={nodes} onNodeClick={handleNodeClick} />;

      case 'Tree':
        return <TreeView data={nodes} onNodeClick={handleNodeClick} />;

      default:
        // Default to Grid view for MVP
        return <GridView data={nodes} onNodeClick={handleNodeClick} />;
    }
  };

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Filter Bar */}
      <FilterBar />

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>

      {/* Selected Node Info (optional mini-display) */}
      {selectedNode && (
        <div className={`h-8 flex items-center px-3 text-xs ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t border-[#808080]'
            : 'bg-gray-50 border-t border-gray-200'
        }`}>
          <span className="font-medium mr-2">Selected:</span>
          <span className="truncate">{selectedNode.name}</span>
          <button
            onClick={() => setSelectedNode(null)}
            className={`ml-auto px-2 ${
              theme === 'NeXTSTEP' ? 'hover:bg-[#c0c0c0]' : 'hover:bg-gray-200 rounded'
            }`}
          >
            ×
          </button>
        </div>
      )}

      {/* Sheet Tabs */}
      <div className={theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#808080] flex items-end gap-0.5 px-2 pb-1 pt-2'
        : 'bg-gray-50 border-t border-gray-200 flex items-end gap-1 px-2 pb-1 pt-2'
      }>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={theme === 'NeXTSTEP'
              ? `px-4 py-1.5 text-sm rounded-t ${
                  activeTab === index
                    ? 'bg-white border-t-2 border-l-2 border-r-2 border-[#808080]'
                    : 'bg-[#b0b0b0] border-t-2 border-l-2 border-r-2 border-[#707070] hover:bg-[#b8b8b8]'
                }`
              : `px-4 py-1.5 text-sm rounded-t-lg ${
                  activeTab === index
                    ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
            }
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
