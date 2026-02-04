import { useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useMockData } from '../hooks/useMockData';
import { PAFVViewSwitcher } from './views/PAFVViewSwitcher';
import { D3GridView } from './views/D3GridView';
import { D3ListView } from './views/D3ListView';
// Updated to support data prop
import { FilterBar } from './FilterBar';
import { usePAFV } from '../hooks/usePAFV';
import type { Node } from '@/types/node';

/**
 * CanvasV2 - Enhanced Canvas with ViewRenderer integration
 *
 * Features:
 * - Smooth view transitions using ViewRenderer system
 * - State preservation across view switches
 * - Improved performance with should-update checks
 * - Better integration with PAFV context
 */
export function CanvasV2() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [useD3Mode, setUseD3Mode] = useState(false);

  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { state: pafvState } = usePAFV();

  // Use mock data for MVP demonstration
  const { data: nodes, loading, error } = useMockData();

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node);
    console.log('Node clicked:', node);
  }, []);


  // Render loading state
  if (loading) {
    return (
      <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
        theme === 'NeXTSTEP'
          ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
          : 'bg-white rounded-lg shadow-lg border border-gray-200'
      }`}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading notes...
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
        theme === 'NeXTSTEP'
          ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
          : 'bg-white rounded-lg shadow-lg border border-gray-200'
      }`}>
        <div className="flex items-center justify-center h-full text-red-500">
          Error: {error.message}
        </div>
      </div>
    );
  }

  // Render empty state
  if (!nodes || nodes.length === 0) {
    return (
      <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
        theme === 'NeXTSTEP'
          ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
          : 'bg-white rounded-lg shadow-lg border border-gray-200'
      }`}>
        <div className="flex items-center justify-center h-full text-gray-400">
          No notes found
        </div>
      </div>
    );
  }

  // Render the main view based on mode
  const renderMainView = () => {
    if (useD3Mode) {
      // D3 Mode - Use existing D3 components
      switch (pafvState.viewMode) {
        case 'list':
          return <D3ListView data={nodes} onNodeClick={handleNodeClick} />;
        case 'grid':
        default:
          return <D3GridView data={nodes} onNodeClick={handleNodeClick} />;
      }
    } else {
      // Enhanced Mode - Use PAFV-integrated ViewRenderer system
      return (
        <PAFVViewSwitcher
          data={nodes}
          onNodeClick={handleNodeClick}
          transitionConfig={{
            duration: 300,
            easing: 'ease-out'
          }}
          showPerformanceMonitor={process.env.NODE_ENV === 'development'}
        />
      );
    }
  };

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Filter Bar with Mode Toggle */}
      <div className="flex items-center">
        <div className="flex-1">
          <FilterBar />
        </div>

        {/* D3 vs Enhanced Mode Toggle */}
        {process.env.NODE_ENV === 'development' && (
          <div className="px-3 py-2">
            <button
              onClick={() => setUseD3Mode(!useD3Mode)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                !useD3Mode
                  ? theme === 'NeXTSTEP'
                    ? 'bg-[#0066cc] text-white'
                    : 'bg-blue-600 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#e8e8e8] text-gray-700 hover:bg-[#d8d8d8]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={useD3Mode ? 'Switch to PAFV ViewRenderer mode' : 'Switch to D3 mode'}
            >
              {useD3Mode ? 'D3 Mode' : 'PAFV Mode'}
            </button>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-hidden">
        {renderMainView()}
      </div>

      {/* Selected Node Info */}
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

export default CanvasV2;