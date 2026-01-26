import React from 'react';
import { D3Canvas } from '../D3Canvas';
import type { Node } from '../../types/node';

interface D3ListViewProps {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

/**
 * D3-powered List View component
 *
 * This is a placeholder implementation that uses the D3Canvas component
 * as a foundation. The full ListView D3 implementation with virtual scrolling
 * and advanced interactions will be completed in the next phase.
 *
 * For now, this renders using the same grid-based approach as D3GridView
 * but could be enhanced with list-specific optimizations.
 */
export function D3ListView({ data, onNodeClick }: D3ListViewProps) {
  const handleCellClick = (cellData: { nodes: Node[]; rowKey: string; colKey: string }) => {
    // For now, click the first node in the cell
    if (cellData.nodes.length > 0 && onNodeClick) {
      onNodeClick(cellData.nodes[0]);
    }
  };

  const handleError = (error: string) => {
    console.error('D3ListView error:', error);
  };

  return (
    <div className="d3-list-view w-full h-full">
      <D3Canvas
        className="d3-list-canvas"
        onCellClick={handleCellClick}
        onError={handleError}
        showPerformanceOverlay={process.env.NODE_ENV === 'development'}
      />

      {/* Future: Add list-specific controls and search interface */}
      <div className="list-controls hidden">
        {/* Search bar, sorting controls, etc. */}
      </div>
    </div>
  );
}

export default D3ListView;