import React from 'react';
import { D3Canvas } from '../D3Canvas';
import type { Node } from '../../types/node';

interface D3GridViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

/**
 * D3-powered Grid View component
 *
 * This is a placeholder implementation that uses the D3Canvas component
 * to render a grid visualization. The full GridView D3 implementation
 * will be completed in the next phase.
 */
export function D3GridView({ data, onNodeClick }: D3GridViewProps) {
  const handleCellClick = (cellData: { nodes: Node[]; rowKey: string; colKey: string }) => {
    // For now, click the first node in the cell
    if (cellData.nodes.length > 0 && onNodeClick) {
      onNodeClick(cellData.nodes[0]);
    }
  };

  const handleError = (error: string) => {
    console.error('D3GridView error:', error);
  };

  return (
    <div className="d3-grid-view w-full h-full">
      <D3Canvas
        className="d3-grid-canvas"
        onCellClick={handleCellClick}
        onError={handleError}
        showPerformanceOverlay={process.env.NODE_ENV === 'development'}
      />
    </div>
  );
}

export default D3GridView;