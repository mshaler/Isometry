import { useState, useCallback } from 'react';
import { D3SparsityLayer } from './D3SparsityLayer';
import { createCoordinateSystem } from '@/utils/coordinate-system';
import { useNodes } from '@/hooks/useSQLiteQuery';
import { useCardOverlay } from '@/state/CardOverlayContext';
import type { Node } from '@/types/node';
import type { ZoomTransform } from '@/hooks/useD3Zoom';

/**
 * SuperGridDemo - Test component for D3 Sparsity Layer
 *
 * Demonstrates:
 * - D3SparsityLayer with real SQLite data
 * - Pan/zoom behavior
 * - Cell click handling
 * - Coordinate system integration
 *
 * This component can be used for:
 * 1. Manual testing of the sparsity layer
 * 2. Performance benchmarking with large datasets
 * 3. Integration testing with PAFV state
 */
export function SuperGridDemo() {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const { selectedNode, setSelectedNode } = useCardOverlay();

  // Fetch nodes from SQLite
  const { data: nodes, loading, error } = useNodes();

  // Create coordinate system (Anchor origin for now)
  const coordinateSystem = createCoordinateSystem('anchor', 120, 60);

  // Handle cell clicks - open card overlay
  const handleCellClick = useCallback((node: Node) => {
    setSelectedNode(node);
    console.log('Cell clicked, opening card overlay:', node.name);
  }, [setSelectedNode]);

  // Handle zoom changes
  const handleZoomChange = useCallback((transform: ZoomTransform) => {
    setZoomLevel(transform.k);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-600">Loading nodes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400">No nodes found</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-50">
      {/* Info Panel */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h2 className="text-lg font-semibold mb-2">SuperGrid Demo</h2>
        <div className="text-sm space-y-1">
          <div>
            <span className="font-medium">Nodes:</span> {nodes.length}
          </div>
          <div>
            <span className="font-medium">Zoom:</span> {(zoomLevel * 100).toFixed(0)}%
          </div>
          {selectedNode && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="font-medium">Selected:</div>
              <div className="text-xs text-gray-600 truncate">
                {selectedNode.name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="text-sm font-semibold mb-2">Controls</h3>
        <ul className="text-xs space-y-1 text-gray-600">
          <li>• <strong>Mouse wheel:</strong> Zoom in/out</li>
          <li>• <strong>Click + drag:</strong> Pan viewport</li>
          <li>• <strong>Click cell:</strong> Select node</li>
          <li>• <strong>Trackpad pinch:</strong> Zoom</li>
        </ul>
      </div>

      {/* D3 Sparsity Layer */}
      <D3SparsityLayer
        data={nodes}
        coordinateSystem={coordinateSystem}
        xAxisFacet="folder"
        yAxisFacet="modifiedAt"
        onCellClick={handleCellClick}
        onZoomChange={handleZoomChange}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
}
