/**
 * ClickZoneManager - Zone-based hit testing for SuperGrid headers
 *
 * Different areas of a header have different behaviors:
 * - Parent label zone (~32px): Structural operations (expand/collapse)
 * - Child body zone: Data selection (select all children)
 * - Resize edge (4px): Column/row resizing
 *
 * Plan 73-04: Header Click Zones
 */

import type { HeaderDescriptor, CellDescriptor, GridDimensions } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Click zones for header interaction.
 * Each zone triggers different behavior on click.
 */
export type ClickZone = 'parent-label' | 'child-body' | 'resize-edge' | 'data-cell' | 'none';

/**
 * Result of hit testing a point against the grid.
 */
export interface HitTestResult {
  /** The zone that was hit */
  zone: ClickZone;
  /** The header that was hit (if any) */
  header?: HeaderDescriptor;
  /** The data cell that was hit (if any) */
  cell?: CellDescriptor;
}

/**
 * Configuration for hit testing.
 */
export interface HitTestConfig {
  /** Height of the parent label zone (default: 32px) */
  labelHeight: number;
  /** Width of the resize edge zone (default: 4px) */
  resizeEdgeWidth: number;
  /** Grid dimensions for cell lookup */
  gridDimensions: GridDimensions;
}

// ============================================================================
// Cursor Mapping
// ============================================================================

/**
 * Map click zones to cursor styles.
 */
const ZONE_CURSORS: Record<ClickZone, string> = {
  'parent-label': 'pointer',
  'child-body': 'cell',
  'resize-edge': 'col-resize',
  'data-cell': 'default',
  'none': 'default',
};

/**
 * Get the appropriate cursor style for a click zone.
 *
 * @param zone - The click zone
 * @returns CSS cursor value
 */
export function getCursorForZone(zone: ClickZone): string {
  return ZONE_CURSORS[zone];
}

// ============================================================================
// Hit Testing Implementation
// ============================================================================

/**
 * Check if a point is within a given rectangular bounds.
 */
function isPointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

/**
 * Check if a point is near the resize edge of a header.
 *
 * @param point - The point to test
 * @param header - The header to check against
 * @param edgeWidth - Width of the resize edge zone
 * @param orientation - Whether this is a column or row header
 * @returns true if point is in resize edge zone
 */
function isInResizeEdge(
  point: { x: number; y: number },
  header: HeaderDescriptor,
  edgeWidth: number,
  orientation: 'column' | 'row'
): boolean {
  if (orientation === 'column') {
    // For column headers, check right edge
    const rightEdge = header.position.x + header.position.width;
    return (
      point.x >= rightEdge - edgeWidth &&
      point.x < rightEdge &&
      point.y >= header.position.y &&
      point.y < header.position.y + header.position.height
    );
  } else {
    // For row headers, check bottom edge
    const bottomEdge = header.position.y + header.position.height;
    return (
      point.y >= bottomEdge - edgeWidth &&
      point.y < bottomEdge &&
      point.x >= header.position.x &&
      point.x < header.position.x + header.position.width
    );
  }
}

/**
 * Check if a point is in the parent label zone of a header.
 *
 * The parent label zone is the top portion of non-leaf headers.
 *
 * @param point - The point to test
 * @param header - The header to check against
 * @param labelHeight - Height of the label zone
 * @returns true if point is in parent label zone
 */
function isInParentLabelZone(
  point: { x: number; y: number },
  header: HeaderDescriptor,
  labelHeight: number
): boolean {
  // Only non-leaf headers have a distinct parent label zone
  if (header.isLeaf) {
    return false;
  }

  // Check if point is within the top labelHeight pixels of the header
  const labelBounds = {
    x: header.position.x,
    y: header.position.y,
    width: header.position.width,
    height: Math.min(labelHeight, header.position.height),
  };

  return isPointInBounds(point, labelBounds);
}

/**
 * Find which column header contains a point.
 *
 * @param point - The point to test (already offset for header area)
 * @param headers - Array of column headers
 * @param config - Hit test configuration
 * @returns HitTestResult with zone and header, or null if no hit
 */
function hitTestColumnHeaders(
  point: { x: number; y: number },
  headers: HeaderDescriptor[],
  config: HitTestConfig
): HitTestResult | null {
  // Sort headers by level (deepest first) to prioritize leaf headers
  const sortedHeaders = [...headers].sort((a, b) => b.level - a.level);

  for (const header of sortedHeaders) {
    const bounds = {
      x: header.position.x,
      y: header.position.y,
      width: header.position.width,
      height: header.position.height,
    };

    if (isPointInBounds(point, bounds)) {
      // Check resize edge first (highest priority)
      if (isInResizeEdge(point, header, config.resizeEdgeWidth, 'column')) {
        return { zone: 'resize-edge', header };
      }

      // Check parent label zone
      if (isInParentLabelZone(point, header, config.labelHeight)) {
        return { zone: 'parent-label', header };
      }

      // Default to child-body zone
      return { zone: 'child-body', header };
    }
  }

  return null;
}

/**
 * Find which row header contains a point.
 *
 * @param point - The point to test (already offset for header area)
 * @param headers - Array of row headers
 * @param config - Hit test configuration
 * @returns HitTestResult with zone and header, or null if no hit
 */
function hitTestRowHeaders(
  point: { x: number; y: number },
  headers: HeaderDescriptor[],
  config: HitTestConfig
): HitTestResult | null {
  // Sort headers by level (deepest first) to prioritize leaf headers
  const sortedHeaders = [...headers].sort((a, b) => b.level - a.level);

  for (const header of sortedHeaders) {
    const bounds = {
      x: header.position.x,
      y: header.position.y,
      width: header.position.width,
      height: header.position.height,
    };

    if (isPointInBounds(point, bounds)) {
      // Check resize edge first (highest priority)
      if (isInResizeEdge(point, header, config.resizeEdgeWidth, 'row')) {
        return { zone: 'resize-edge', header };
      }

      // Check parent label zone (for row headers, this is the left portion)
      if (!header.isLeaf && point.x < header.position.x + config.labelHeight) {
        return { zone: 'parent-label', header };
      }

      // Default to child-body zone
      return { zone: 'child-body', header };
    }
  }

  return null;
}

/**
 * Find which data cell contains a point.
 *
 * @param point - The point to test (in grid coordinates)
 * @param cells - Array of data cells
 * @param config - Hit test configuration
 * @returns HitTestResult with data-cell zone, or null if no hit
 */
function hitTestDataCells(
  point: { x: number; y: number },
  cells: CellDescriptor[],
  config: HitTestConfig
): HitTestResult | null {
  const { cellWidth, cellHeight, headerWidth, headerHeight } = config.gridDimensions;

  // Calculate grid position from pixel coordinates
  const gridX = Math.floor((point.x - headerWidth) / cellWidth);
  const gridY = Math.floor((point.y - headerHeight) / cellHeight);

  // Check if within valid grid bounds
  if (gridX < 0 || gridY < 0) {
    return null;
  }

  // Find matching cell
  const cell = cells.find(c => c.gridX === gridX && c.gridY === gridY);

  if (cell) {
    return { zone: 'data-cell', cell };
  }

  return null;
}

/**
 * Perform hit testing to determine which zone a point falls into.
 *
 * Priority order:
 * 1. Column headers (with resize edge highest priority within)
 * 2. Row headers (with resize edge highest priority within)
 * 3. Data cells
 * 4. None (outside grid)
 *
 * @param point - The point to test (in SVG coordinates)
 * @param columnHeaders - Array of column headers
 * @param rowHeaders - Array of row headers
 * @param cells - Array of data cells
 * @param config - Hit test configuration
 * @returns HitTestResult indicating the zone and associated element
 */
export function hitTest(
  point: { x: number; y: number },
  columnHeaders: HeaderDescriptor[],
  rowHeaders: HeaderDescriptor[],
  cells: CellDescriptor[],
  config: HitTestConfig
): HitTestResult {
  const { headerWidth, headerHeight } = config.gridDimensions;

  // Check column headers first (they're at the top)
  // Column headers are offset by headerWidth on x-axis
  if (point.y < headerHeight) {
    const columnPoint = { x: point.x - headerWidth, y: point.y };
    const columnResult = hitTestColumnHeaders(columnPoint, columnHeaders, config);
    if (columnResult) {
      return columnResult;
    }
  }

  // Check row headers (they're on the left side)
  // Row headers are offset by headerHeight on y-axis
  if (point.x < headerWidth) {
    const rowPoint = { x: point.x, y: point.y - headerHeight };
    const rowResult = hitTestRowHeaders(rowPoint, rowHeaders, config);
    if (rowResult) {
      return rowResult;
    }
  }

  // Check data cells
  if (point.x >= headerWidth && point.y >= headerHeight) {
    const cellResult = hitTestDataCells(point, cells, config);
    if (cellResult) {
      return cellResult;
    }
  }

  // No hit
  return { zone: 'none' };
}

// ============================================================================
// Cursor Update Utility
// ============================================================================

/**
 * Update the cursor style on an SVG element based on the current zone.
 *
 * @param zone - The current click zone
 * @param element - The SVG element to update
 */
export function updateCursor(zone: ClickZone, element: SVGSVGElement | HTMLElement): void {
  element.style.cursor = getCursorForZone(zone);
}
