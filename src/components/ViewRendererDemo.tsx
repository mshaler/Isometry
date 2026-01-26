import React, { useState } from 'react';
import { useMockData } from '../hooks/useMockData';
import { EnhancedViewSwitcher } from './views/EnhancedViewSwitcher';
import { viewRegistry, useViewRegistry } from './views/ViewRegistry';
import type { Node } from '@/types/node';
import type { ViewType } from '@/types/view';

/**
 * ViewRendererDemo - Component to test and demonstrate the ViewRenderer system
 *
 * Features:
 * - Interactive view switching
 * - State preservation testing
 * - Performance metrics
 * - Debug information
 */
export function ViewRendererDemo() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [transitionMetrics, setTransitionMetrics] = useState<{
    lastTransitionTime: number;
    totalTransitions: number;
  }>({
    lastTransitionTime: 0,
    totalTransitions: 0
  });

  // Get data for testing
  const { data: nodes, loading, error } = useMockData();

  // Get view registry info
  const {
    getCurrentRenderer,
    getAvailableViews,
    getViewInfo
  } = useViewRegistry();

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    console.log('ViewRendererDemo - Node clicked:', node);
  };

  const handleViewChange = (viewType: ViewType) => {
    const startTime = performance.now();

    // Update transition metrics
    setTransitionMetrics(prev => ({
      lastTransitionTime: startTime,
      totalTransitions: prev.totalTransitions + 1
    }));

    console.log('ViewRendererDemo - View changed to:', viewType);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="view-renderer-demo p-6">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">ViewRenderer System Demo</h2>
          <div className="flex items-center justify-center h-32 text-gray-500">
            Loading demo data...
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="view-renderer-demo p-6">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6">
          <h2 className="text-xl font-bold mb-4 text-red-600">ViewRenderer System Demo - Error</h2>
          <div className="text-red-500">
            Error loading demo data: {error.message}
          </div>
        </div>
      </div>
    );
  }

  // Render main demo
  const availableViews = getAvailableViews();
  const currentRenderer = getCurrentRenderer();

  return (
    <div className="view-renderer-demo p-6 space-y-6">
      {/* Demo Header */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">ViewRenderer System Demo</h2>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            Testing seamless view switching with state preservation
          </div>

          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>

        {/* Debug Information */}
        {showDebug && (
          <div className="bg-gray-50 rounded p-4 mb-4 text-sm">
            <h3 className="font-medium mb-2">Debug Information</h3>
            <div className="space-y-1">
              <div><strong>Available Views:</strong> {availableViews.join(', ')}</div>
              <div><strong>Current Renderer:</strong> {currentRenderer?.name || 'None'}</div>
              <div><strong>Render Mode:</strong> {currentRenderer?.renderMode || 'None'}</div>
              <div><strong>Data Count:</strong> {nodes?.length || 0} items</div>
              <div><strong>Total Transitions:</strong> {transitionMetrics.totalTransitions}</div>
              <div><strong>Last Transition:</strong> {transitionMetrics.lastTransitionTime > 0
                ? `${Math.round(performance.now() - transitionMetrics.lastTransitionTime)}ms ago`
                : 'None'}</div>
            </div>

            {/* View Registry Status */}
            <div className="mt-3">
              <strong>Registered Views:</strong>
              <div className="mt-1 space-y-1">
                {availableViews.map(viewType => {
                  const viewInfo = getViewInfo(viewType);
                  return (
                    <div key={viewType} className="pl-2">
                      • {viewInfo?.name} ({viewInfo?.renderMode})
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Demo Area */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        {nodes && nodes.length > 0 ? (
          <EnhancedViewSwitcher
            availableViews={['grid', 'list']}
            initialView="grid"
            data={nodes}
            onNodeClick={handleNodeClick}
            onViewChange={handleViewChange}
            transitionConfig={{
              duration: 300,
              easing: 'ease-out'
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No demo data available
          </div>
        )}
      </div>

      {/* Selected Node Display */}
      {selectedNode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Selected Node</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <div><strong>ID:</strong> {selectedNode.id}</div>
            <div><strong>Name:</strong> {selectedNode.name}</div>
            <div><strong>Type:</strong> {selectedNode.nodeType}</div>
            <div><strong>Folder:</strong> {selectedNode.folder || 'None'}</div>
            <div><strong>Tags:</strong> {selectedNode.tags.join(', ') || 'None'}</div>
            <div><strong>Created:</strong> {new Date(selectedNode.createdAt).toLocaleString()}</div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="mt-3 px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Performance Notes */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">Performance Testing</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <div>• Switch between views to test transition smoothness</div>
          <div>• Scroll within views to test state preservation</div>
          <div>• Select items to test selection state management</div>
          <div>• Enable debug mode to monitor renderer state</div>
          <div>• Check browser console for detailed logs</div>
        </div>
      </div>
    </div>
  );
}

export default ViewRendererDemo;