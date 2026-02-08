/**
 * useGridCoordinates - React hook for axis-based node positioning
 *
 * Maps nodes to grid coordinates based on PAFV axis mappings.
 * Memoizes coordinate calculations for performance.
 *
 * @module hooks/useGridCoordinates
 */

import { useMemo } from 'react';
import type { Node } from '../../types/node';
import type { LATCHAxis } from '../../types/pafv';
import type { OriginPattern } from '../../types/coordinates';
import { extractAxisValue, getAxisLabel } from '../../utils/database/axis-value-extractor';

export interface GridCoordinate {
  x: number;
  y: number;
  xLabel: string;
  yLabel: string;
}

export interface UseGridCoordinatesOptions {
  /** Nodes to position */
  nodes: Node[];
  /** X-axis LATCH type */
  xAxis: LATCHAxis;
  /** X-axis facet (e.g., 'year', 'tag') */
  xFacet: string;
  /** Y-axis LATCH type */
  yAxis: LATCHAxis;
  /** Y-axis facet */
  yFacet: string;
  /** Origin pattern for coordinate transformation */
  originPattern: OriginPattern;
}

/**
 * Calculate grid coordinates for nodes based on PAFV axis mappings
 *
 * @param options - Configuration options
 * @returns Map of node IDs to grid coordinates
 *
 * @example
 * ```tsx
 * const coords = useGridCoordinates({
 *   nodes: data,
 *   xAxis: 'time',
 *   xFacet: 'year',
 *   yAxis: 'category',
 *   yFacet: 'tag',
 *   originPattern: 'anchor',
 * });
 *
 * const nodeCoord = coords.get(node.id);
 * // => { x: 2024, y: 42, xLabel: '2024', yLabel: 'Project' }
 * ```
 */
export function useGridCoordinates(
  options: UseGridCoordinatesOptions
): Map<string, GridCoordinate> {
  const { nodes, xAxis, xFacet, yAxis, yFacet, originPattern } = options;

  return useMemo(() => {
    const coordinateMap = new Map<string, GridCoordinate>();

    // Early return for empty data
    if (!nodes || nodes.length === 0) {
      return coordinateMap;
    }

    // Extract all coordinate values first to find domain
    const xValues: number[] = [];
    const yValues: number[] = [];

    nodes.forEach(node => {
      const xVal = extractAxisValue(node, xAxis, xFacet);
      const yVal = extractAxisValue(node, yAxis, yFacet);

      if (xVal !== null) xValues.push(xVal);
      if (yVal !== null) yValues.push(yVal);
    });

    // Calculate domain (min/max) for each axis
    const xMin = xValues.length > 0 ? Math.min(...xValues) : 0;
    const xMax = xValues.length > 0 ? Math.max(...xValues) : 0;
    const yMin = yValues.length > 0 ? Math.min(...yValues) : 0;
    const yMax = yValues.length > 0 ? Math.max(...yValues) : 0;

    // Calculate center points for Bipolar pattern
    const xCenter = (xMin + xMax) / 2;
    const yCenter = (yMin + yMax) / 2;

    // Map each node to grid coordinates
    nodes.forEach(node => {
      const rawX = extractAxisValue(node, xAxis, xFacet) ?? 0;
      const rawY = extractAxisValue(node, yAxis, yFacet) ?? 0;

      // Apply origin transformation
      const x = applyOriginTransform(rawX, xMin, xCenter, originPattern);
      const y = applyOriginTransform(rawY, yMin, yCenter, originPattern);

      // Get display labels
      const xLabel = getAxisLabel(node, xAxis, xFacet);
      const yLabel = getAxisLabel(node, yAxis, yFacet);

      coordinateMap.set(node.id, { x, y, xLabel, yLabel });
    });

    return coordinateMap;
  }, [nodes, xAxis, xFacet, yAxis, yFacet, originPattern]);
}

/**
 * Apply origin pattern transformation to raw coordinate
 *
 * - Anchor: Origin at (min, min) - top-left corner, all values positive
 * - Bipolar: Origin at (center, center) - center point, values can be negative
 */
function applyOriginTransform(
  rawValue: number,
  min: number,
  center: number,
  pattern: OriginPattern
): number {
  switch (pattern) {
    case 'anchor':
      // Anchor pattern: shift so min becomes 0
      return rawValue - min;

    case 'bipolar':
      // Bipolar pattern: shift so center becomes 0
      return rawValue - center;

    default:
      // Default to anchor
      return rawValue - min;
  }
}

/**
 * Get unique axis values for header generation
 *
 * @param coordinates - Map of node coordinates
 * @param axis - 'x' or 'y'
 * @returns Sorted array of unique values with labels
 */
export function getUniqueAxisValues(
  coordinates: Map<string, GridCoordinate>,
  axis: 'x' | 'y'
): Array<{ value: number; label: string }> {
  const valuesMap = new Map<number, string>();

  coordinates.forEach(coord => {
    if (axis === 'x') {
      valuesMap.set(coord.x, coord.xLabel);
    } else {
      valuesMap.set(coord.y, coord.yLabel);
    }
  });

  return Array.from(valuesMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value - b.value);
}
