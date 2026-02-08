import type { Node } from '@/types/node';
import type { ColumnHeaderData, RowHeaderData, DataCellData } from '@/types/grid';

/**
 * D3 Helper Functions for SuperGrid
 *
 * Utilities for mapping Node data to grid coordinates based on PAFV axis mappings.
 */

/**
 * Get cell position from node data based on axis facets
 *
 * @param node - Node (card) data
 * @param xAxisFacet - X-axis facet name (e.g., 'folder', 'createdAt')
 * @param yAxisFacet - Y-axis facet name (e.g., 'modifiedAt', 'priority')
 * @returns Logical coordinates { x, y }
 */
export function getCellPosition(
  node: Node,
  xAxisFacet: string,
  yAxisFacet: string
): { x: number; y: number } {
  // Extract values from node based on facet names
  const xValue = getNodeValue(node, xAxisFacet);
  const yValue = getNodeValue(node, yAxisFacet);

  // Convert values to logical coordinates
  // For MVP, use simple hashing/bucketing
  // Future: Use proper facet value mapping from LATCH dimensions
  const x = hashToCoordinate(xValue);
  const y = hashToCoordinate(yValue);

  return { x, y };
}

/**
 * Get display data for a cell
 *
 * @param node - Node (card) data
 * @param xAxisFacet - X-axis facet name
 * @param yAxisFacet - Y-axis facet name
 * @returns Cell data including position and display value
 */
export function getCellData(
  node: Node,
  xAxisFacet: string,
  yAxisFacet: string
): DataCellData {
  const { x, y } = getCellPosition(node, xAxisFacet, yAxisFacet);

  return {
    id: node.id,
    node,
    logicalX: x,
    logicalY: y,
    value: node.name || node.summary || '(untitled)',
  };
}

/**
 * Format cell value based on axis type
 *
 * @param value - Raw value from node
 * @param axisType - Type of axis ('text', 'number', 'date', etc.)
 * @returns Formatted display string
 */
export function formatCellValue(value: unknown, axisType: string): string {
  if (value == null) return '';

  switch (axisType) {
    case 'date':
      return formatDate(value as string);
    case 'number':
      return formatNumber(value as number);
    case 'text':
    default:
      return String(value);
  }
}

/**
 * Extract column headers from unique x-axis facet values
 *
 * @param nodes - Array of nodes
 * @param xAxisFacet - X-axis facet name
 * @returns Array of column header data
 */
export function extractColumnHeaders(
  nodes: Node[],
  xAxisFacet: string
): ColumnHeaderData[] {
  // Get unique values for the x-axis facet
  const uniqueValues = new Map<string, number>();

  nodes.forEach(node => {
    const value = getNodeValue(node, xAxisFacet);
    const key = String(value);
    if (!uniqueValues.has(key)) {
      uniqueValues.set(key, hashToCoordinate(value));
    }
  });

  // Convert to column header data
  return Array.from(uniqueValues.entries()).map(([label, logicalX]) => ({
    id: `col-${logicalX}`,
    label: label === 'null' ? '(none)' : label,
    logicalX,
    width: 1, // Each column is 1 logical unit wide
  }));
}

/**
 * Extract row headers from unique y-axis facet values
 *
 * @param nodes - Array of nodes
 * @param yAxisFacet - Y-axis facet name
 * @returns Array of row header data
 */
export function extractRowHeaders(
  nodes: Node[],
  yAxisFacet: string
): RowHeaderData[] {
  // Get unique values for the y-axis facet
  const uniqueValues = new Map<string, number>();

  nodes.forEach(node => {
    const value = getNodeValue(node, yAxisFacet);
    const key = String(value);
    if (!uniqueValues.has(key)) {
      uniqueValues.set(key, hashToCoordinate(value));
    }
  });

  // Convert to row header data
  return Array.from(uniqueValues.entries()).map(([label, logicalY]) => ({
    id: `row-${logicalY}`,
    label: label === 'null' ? '(none)' : label,
    logicalY,
    height: 1, // Each row is 1 logical unit tall
  }));
}

// ============================================================================
// Internal helper functions
// ============================================================================

/**
 * Get node value by facet name (supports nested paths)
 */
function getNodeValue(node: Node, facetName: string): unknown {
  // Handle common LATCH facets
  switch (facetName) {
    case 'folder':
      return node.folder;
    case 'tags':
      return node.tags.join(', ');
    case 'priority':
      return node.priority;
    case 'importance':
      return node.importance;
    case 'createdAt':
      return node.createdAt;
    case 'modifiedAt':
      return node.modifiedAt;
    case 'status':
      return node.status;
    case 'nodeType':
      return node.nodeType;
    default:
      // Fallback: use folder for unknown facets
      return node.folder || 'unknown';
  }
}

/**
 * Hash a value to a coordinate (simple bucketing)
 * Future: Replace with proper facet dimension mapping
 */
function hashToCoordinate(value: unknown): number {
  if (value == null) return 0;

  const str = String(value);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Map to coordinate range (0-99 for now)
  return Math.abs(hash % 100);
}

/**
 * Format date string for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format number for display
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}
