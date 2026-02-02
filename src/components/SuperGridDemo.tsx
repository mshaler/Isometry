import { useState, useCallback } from 'react';
import { D3SparsityLayer } from './D3SparsityLayer';
import { MiniNav } from './MiniNav';
import { createCoordinateSystem } from '@/utils/coordinate-system';
import { useFilteredNodes } from '@/hooks/useFilteredNodes';
import { useCardOverlay } from '@/state/CardOverlayContext';
import { usePAFV } from '@/hooks/usePAFV';
import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
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
  const [originPattern, setOriginPattern] = useState<OriginPattern>('anchor');
  const { selectedNode, setSelectedNode } = useCardOverlay();

  // SuperGrid rendering - debug logs removed after successful fix

  // Get PAFV context for axis mappings
  const pafv = usePAFV();
  const pafvState = pafv.state;

  // Fetch filtered nodes from SQLite (respects FilterContext)
  const { data: nodes, loading, error } = useFilteredNodes();

  // Extract X and Y axis mappings from PAFV state
  const xMapping = pafvState.mappings.find(m => m.plane === 'x');
  const yMapping = pafvState.mappings.find(m => m.plane === 'y');

  const xAxis: LATCHAxis = xMapping?.axis || 'time';
  const xFacet = xMapping?.facet || 'year';
  const yAxis: LATCHAxis = yMapping?.axis || 'category';
  const yFacet = yMapping?.facet || 'tag';

  // Create coordinate system with current origin pattern
  const d3CoordinateSystem = createCoordinateSystem(originPattern, 120, 60);

  // Extract simple coordinate system properties for MiniNav
  const coordinateSystem: import('@/types/coordinates').CoordinateSystem = {
    pattern: d3CoordinateSystem.pattern || originPattern,
    scale: d3CoordinateSystem.scale || 1,
    viewportWidth: d3CoordinateSystem.viewportWidth || window.innerWidth,
    viewportHeight: d3CoordinateSystem.viewportHeight || window.innerHeight,
  };

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
      {/* MiniNav - Left sidebar for axis control */}
      <div className="absolute left-0 top-0 h-full z-20">
        <MiniNav
          coordinateSystem={coordinateSystem}
          pafvState={pafvState}
          onPAFVChange={(newState) => {
            // Handle view mode changes
            if (newState.viewMode !== pafvState.viewMode) {
              pafv.setViewMode(newState.viewMode);
              return;
            }

            // Handle mapping changes
            const currentMappingKeys = new Set(
              pafvState.mappings.map((m) => `${m.plane}:${m.axis}:${m.facet}`)
            );
            const newMappingKeys = new Set(
              newState.mappings.map((m) => `${m.plane}:${m.axis}:${m.facet}`)
            );

            // Find added/changed mappings
            newState.mappings.forEach((mapping) => {
              const key = `${mapping.plane}:${mapping.axis}:${mapping.facet}`;
              if (!currentMappingKeys.has(key)) {
                pafv.setMapping(mapping);
              }
            });

            // Find removed mappings
            pafvState.mappings.forEach((mapping) => {
              const key = `${mapping.plane}:${mapping.axis}:${mapping.facet}`;
              if (!newMappingKeys.has(key)) {
                pafv.removeMapping(mapping.plane);
              }
            });
          }}
          onOriginChange={setOriginPattern}
          onZoom={setZoomLevel}
        />
      </div>

      {/* Info Panel */}
      <div className="absolute top-4 left-64 z-10 bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <h2 className="text-lg font-semibold mb-2">SuperGrid Demo</h2>
        <div className="text-sm space-y-1">
          <div>
            <span className="font-medium">Nodes:</span> {nodes.length}
          </div>
          <div>
            <span className="font-medium">X-Axis:</span> {xAxis} ({xFacet})
          </div>
          <div>
            <span className="font-medium">Y-Axis:</span> {yAxis} ({yFacet})
          </div>
          <div>
            <span className="font-medium">Origin:</span> {originPattern}
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
          <li>• <strong>Drag axes:</strong> Map to X/Y planes in MiniNav</li>
          <li>• <strong>Change facet:</strong> Use dropdown in axis chip</li>
          <li>• <strong>Mouse wheel:</strong> Zoom in/out</li>
          <li>• <strong>Click + drag:</strong> Pan viewport</li>
          <li>• <strong>Click cell:</strong> Select node</li>
        </ul>
      </div>

      {/* D3 Sparsity Layer - now driven by PAFV axis mappings */}
      <D3SparsityLayer
        data={nodes}
        coordinateSystem={d3CoordinateSystem}
        xAxis={xAxis}
        xAxisFacet={xFacet}
        yAxis={yAxis}
        yAxisFacet={yFacet}
        originPattern={originPattern}
        onCellClick={handleCellClick}
        onZoomChange={handleZoomChange}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
}
