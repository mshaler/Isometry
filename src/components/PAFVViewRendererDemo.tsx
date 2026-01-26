import React, { useState } from 'react';
import { useMockData } from '../hooks/useMockData';
import { PAFVViewSwitcher } from './views/PAFVViewSwitcher';
import { usePAFV } from '../hooks/usePAFV';
import type { Node } from '@/types/node';
import type { AxisMapping, LATCHAxis, Plane } from '@/types/pafv';

/**
 * PAFVViewRendererDemo - Test PAFV integration with ViewRenderer system
 *
 * Features:
 * - PAFV axis manipulation testing
 * - View switching with state preservation
 * - Axis mapping visualization
 * - Performance monitoring
 */
export function PAFVViewRendererDemo() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showAxisControls, setShowAxisControls] = useState(true);

  // Get data and PAFV state
  const { data: nodes, loading, error } = useMockData();
  const {
    state: pafvState,
    setMapping,
    removeMapping,
    resetToDefaults,
    getAxisForPlane
  } = usePAFV();

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    console.log('PAFVDemo - Node clicked:', node);
  };

  // Available facets for testing
  const availableFacets = [
    { id: 'year', name: 'Year', axis: 'time' as LATCHAxis },
    { id: 'month', name: 'Month', axis: 'time' as LATCHAxis },
    { id: 'folder', name: 'Folder', axis: 'category' as LATCHAxis },
    { id: 'tag', name: 'Tags', axis: 'category' as LATCHAxis },
    { id: 'location', name: 'Location', axis: 'location' as LATCHAxis },
    { id: 'priority', name: 'Priority', axis: 'hierarchy' as LATCHAxis }
  ];

  // Handle axis mapping changes
  const handleAxisMapping = (plane: Plane, facet: string) => {
    const facetInfo = availableFacets.find(f => f.id === facet);
    if (facetInfo) {
      const mapping: AxisMapping = {
        plane,
        axis: facetInfo.axis,
        facet: facet
      };
      setMapping(mapping);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="pafv-demo p-6">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">PAFV ViewRenderer Demo</h2>
          <div className="flex items-center justify-center h-32 text-gray-500">
            Loading PAFV demo data...
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="pafv-demo p-6">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6">
          <h2 className="text-xl font-bold mb-4 text-red-600">PAFV Demo - Error</h2>
          <div className="text-red-500">
            Error loading demo data: {error.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pafv-demo p-6 space-y-6">
      {/* Demo Header */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">PAFV ViewRenderer Integration Demo</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAxisControls(!showAxisControls)}
              className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
            >
              {showAxisControls ? 'Hide' : 'Show'} Axis Controls
            </button>

            <button
              onClick={resetToDefaults}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Reset PAFV
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Testing PAFV axis mappings with seamless view transitions and state preservation
        </div>
      </div>

      {/* Axis Controls */}
      {showAxisControls && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-4">PAFV Axis Mappings</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* X-Axis Control */}
            <div>
              <label className="block text-sm font-medium mb-2">X-Axis (Columns)</label>
              <select
                value={pafvState.mappings.find(m => m.plane === 'x')?.facet || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleAxisMapping('x', e.target.value);
                  } else {
                    removeMapping('x');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No mapping</option>
                {availableFacets.map(facet => (
                  <option key={facet.id} value={facet.id}>
                    {facet.name} ({facet.axis})
                  </option>
                ))}
              </select>
            </div>

            {/* Y-Axis Control */}
            <div>
              <label className="block text-sm font-medium mb-2">Y-Axis (Rows)</label>
              <select
                value={pafvState.mappings.find(m => m.plane === 'y')?.facet || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleAxisMapping('y', e.target.value);
                  } else {
                    removeMapping('y');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No mapping</option>
                {availableFacets.map(facet => (
                  <option key={facet.id} value={facet.id}>
                    {facet.name} ({facet.axis})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Mappings Display */}
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="text-sm">
              <div className="font-medium mb-2">Current Mappings:</div>
              {pafvState.mappings.length > 0 ? (
                <div className="space-y-1">
                  {pafvState.mappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <span className="font-mono bg-gray-200 px-2 py-1 rounded">
                        {mapping.plane.toUpperCase()}
                      </span>
                      <span>→</span>
                      <span className="text-blue-600">{mapping.axis}</span>
                      <span className="text-gray-500">({mapping.facet})</span>
                      <button
                        onClick={() => removeMapping(mapping.plane)}
                        className="ml-auto text-red-500 hover:text-red-700"
                        title="Remove mapping"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 italic text-xs">No axis mappings</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Demo Area */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        {nodes && nodes.length > 0 ? (
          <PAFVViewSwitcher
            data={nodes}
            onNodeClick={handleNodeClick}
            transitionConfig={{
              duration: 400,
              easing: 'ease-out'
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No PAFV demo data available
          </div>
        )}
      </div>

      {/* Selected Node Display */}
      {selectedNode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">Selected Node (with PAFV Context)</h3>
          <div className="text-sm text-green-700 space-y-1">
            <div><strong>ID:</strong> {selectedNode.id}</div>
            <div><strong>Name:</strong> {selectedNode.name}</div>
            <div><strong>Type:</strong> {selectedNode.nodeType}</div>
            <div><strong>Folder:</strong> {selectedNode.folder || 'None'}</div>
            <div><strong>Tags:</strong> {selectedNode.tags.join(', ') || 'None'}</div>
            <div><strong>Created:</strong> {new Date(selectedNode.createdAt).toLocaleString()}</div>

            {/* PAFV Context */}
            <div className="mt-2 pt-2 border-t border-green-200">
              <div><strong>Current View:</strong> {pafvState.viewMode}</div>
              <div><strong>X-Axis:</strong> {getAxisForPlane('x') || 'None'}</div>
              <div><strong>Y-Axis:</strong> {getAxisForPlane('y') || 'None'}</div>
            </div>
          </div>

          <button
            onClick={() => setSelectedNode(null)}
            className="mt-3 px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* PAFV Testing Instructions */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-medium text-purple-900 mb-2">PAFV Testing Instructions</h3>
        <div className="text-sm text-purple-700 space-y-1">
          <div>• Change axis mappings above to see views update automatically</div>
          <div>• Switch between Grid and List views to test state preservation</div>
          <div>• GridView uses axis mappings for hierarchical grouping</div>
          <div>• ListView maintains search/filter state during transitions</div>
          <div>• Selected nodes show current PAFV context</div>
          <div>• Reset button restores default axis configuration</div>
        </div>
      </div>
    </div>
  );
}

export default PAFVViewRendererDemo;