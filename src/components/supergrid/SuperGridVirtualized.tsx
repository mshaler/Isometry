/**
 * SuperGridVirtualized - Virtual scrolling wrapper for SuperGrid data cells
 *
 * Part of Phase 93 - Polish & Performance (PERF-01)
 *
 * Uses TanStack Virtual to render only visible cells, maintaining 30+ FPS
 * when scrolling grids with 10K+ cells. Delegates actual cell rendering
 * to VirtualRenderer → DataCellRenderer for visual consistency.
 *
 * Features:
 * - Virtual scrolling via TanStack Virtual
 * - FPS monitoring (development only)
 * - Delegates rendering to existing DataCellRenderer
 * - Smooth scrolling with configurable overscan
 */

import { useRef, useEffect } from 'react';
import { useVirtualizedGrid } from '@/hooks/useVirtualizedGrid';
import { useFPSMonitor } from '@/hooks/useFPSMonitor';
import { VirtualRenderer } from '@/d3/SuperGridEngine/VirtualRenderer';
import * as d3 from 'd3';
import type { DataCellData, D3CoordinateSystem } from '@/types/grid';
import type { CellDensityState } from '@/d3/grid-rendering/DataCellRenderer';
import type { Node } from '@/types/node';

interface SuperGridVirtualizedProps {
  /** All cells to render (only visible cells will actually render) */
  cells: DataCellData[];
  /** Coordinate system for cell positioning */
  coordinateSystem: D3CoordinateSystem;
  /** Density state for rendering mode */
  densityState: CellDensityState;
  /** Set of selected node IDs for highlighting */
  selectedIds: Set<string>;
  /** Callback when a cell is clicked */
  onCellClick?: (node: Node, event: MouseEvent) => void;
  /** Show FPS monitor in corner (dev only, default: true in dev) */
  showFPSMonitor?: boolean;
}

/**
 * SuperGridVirtualized - Virtualized data cell container
 *
 * This component:
 * 1. Uses useVirtualizedGrid to calculate visible cells
 * 2. Uses VirtualRenderer to render cells with D3
 * 3. Shows FPS monitor in development mode
 *
 * @example
 * ```tsx
 * <SuperGridVirtualized
 *   cells={dataCells}
 *   coordinateSystem={coordSystem}
 *   densityState={{ valueDensity: 'leaf' }}
 *   selectedIds={selection.selectedIds}
 *   onCellClick={handleCellClick}
 * />
 * ```
 */
export function SuperGridVirtualized({
  cells,
  coordinateSystem,
  densityState,
  selectedIds,
  onCellClick,
  showFPSMonitor = process.env.NODE_ENV === 'development',
}: SuperGridVirtualizedProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<VirtualRenderer | null>(null);

  // Virtual scrolling hook
  const { virtualRows, totalHeight, totalWidth, isVirtualizing, visibleCount, totalCount } = useVirtualizedGrid({
    cells,
    coordinateSystem,
    containerRef,
  });

  // FPS monitoring (dev-only)
  const { fps, isPerformant } = useFPSMonitor(showFPSMonitor);

  // Initialize VirtualRenderer
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    let g = svg.select<SVGGElement>('.virtual-cells');

    // Create group if it doesn't exist
    if (g.empty()) {
      g = svg.append('g').attr('class', 'virtual-cells');
    }

    rendererRef.current = new VirtualRenderer(g, {
      coordinateSystem,
      densityState,
      selectedIds,
      onCellClick,
    });

    return () => {
      rendererRef.current?.clear();
      rendererRef.current = null;
    };
  }, [coordinateSystem]); // Only recreate on coordinate system change

  // Update renderer config when props change
  useEffect(() => {
    rendererRef.current?.updateConfig({ densityState, selectedIds, onCellClick });
  }, [densityState, selectedIds, onCellClick]);

  // Render visible cells when virtualRows change
  useEffect(() => {
    if (!rendererRef.current) return;

    const visibleCells = virtualRows.map(row => row.cell);
    rendererRef.current.render(visibleCells);
  }, [virtualRows]);

  return (
    <div
      ref={containerRef}
      className="supergrid-virtualized"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/* FPS Monitor (dev-only) */}
      {showFPSMonitor && (
        <div
          className="supergrid-fps-monitor"
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            padding: '4px 8px',
            background: isPerformant ? '#10b981' : '#ef4444',
            color: 'white',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span>{fps} FPS {isVirtualizing ? '(virtualized)' : ''}</span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>
            {visibleCount}/{totalCount} cells
          </span>
        </div>
      )}

      {/* Virtualized content container */}
      <div
        style={{
          height: totalHeight,
          width: totalWidth,
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          width={totalWidth}
          height={totalHeight}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* VirtualRenderer appends to this group */}
          <g className="virtual-cells" />
        </svg>
      </div>
    </div>
  );
}
