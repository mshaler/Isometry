/**
 * useDataCellRenderer - React hook for managing DataCellRenderer lifecycle
 *
 * Part of Phase 92 - Data Cell Integration (CELL-02)
 * Connects DataCellRenderer to React component lifecycle and density state
 */

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { DataCellRenderer, type CellDensityState } from '@/d3/grid-rendering/DataCellRenderer';
import type { DataCellData, D3CoordinateSystem } from '@/types/grid';
import type { Node } from '@/types/node';

/**
 * Options for useDataCellRenderer hook
 */
export interface UseDataCellRendererOptions {
  /** D3 coordinate system configuration */
  coordinateSystem: D3CoordinateSystem;
  /** Array of data cells to render */
  cells: DataCellData[];
  /** Density state for density-aware rendering (leaf vs collapsed) */
  densityState?: CellDensityState;
  /** Set of selected node IDs for visual highlighting */
  selectedIds?: Set<string>;
  /** Callback when a cell is clicked */
  onCellClick?: (node: Node, event: MouseEvent) => void;
  /** Transition duration in milliseconds */
  transitionDuration?: number;
}

/**
 * React hook that manages DataCellRenderer lifecycle
 *
 * Creates and manages a D3-based DataCellRenderer instance, automatically
 * re-rendering when cells or density state changes.
 *
 * @param containerRef - Ref to the SVG group element for rendering
 * @param options - Renderer configuration options
 *
 * @example
 * ```tsx
 * const dataGridRef = useRef<SVGGElement>(null);
 * useDataCellRenderer(dataGridRef, {
 *   coordinateSystem,
 *   cells: dataCells,
 *   densityState,
 *   onCellClick: handleCellClick
 * });
 * ```
 */
export function useDataCellRenderer(
  containerRef: React.RefObject<SVGGElement>,
  options: UseDataCellRendererOptions
): void {
  const {
    coordinateSystem,
    cells,
    densityState,
    selectedIds,
    onCellClick,
    transitionDuration = 300,
  } = options;

  // Store renderer instance across renders
  const rendererRef = useRef<DataCellRenderer | null>(null);

  // Initialize renderer when coordinate system is available
  useEffect(() => {
    if (!coordinateSystem) return;

    // Create renderer instance if it doesn't exist
    if (!rendererRef.current) {
      rendererRef.current = new DataCellRenderer(coordinateSystem);
    }
  }, [coordinateSystem]);

  // Re-render when cells, density state, or selection changes
  useEffect(() => {
    if (!containerRef.current || !rendererRef.current || !cells) return;

    const container = d3.select(containerRef.current);

    // Render cells with current density state and selection
    rendererRef.current.render(container, cells, {
      densityState,
      selectedIds,
      onCellClick,
      transitionDuration,
    });
  }, [containerRef, cells, densityState, selectedIds, onCellClick, transitionDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      rendererRef.current = null;
    };
  }, []);
}
