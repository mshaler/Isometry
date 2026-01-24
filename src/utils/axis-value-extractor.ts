/**
 * Axis Value Extractor - Maps node properties to LATCH axis values
 *
 * Handles extraction of values from nodes based on LATCH axes and converts them
 * to numeric coordinates for grid positioning.
 *
 * LATCH Axes:
 * - Location: Latitude/longitude coordinates
 * - Alphabet: Lexicographic sorting (first letter, full name)
 * - Time: Temporal values (year, month, day, timestamp)
 * - Category: Tag-based grouping
 * - Hierarchy: Priority/importance levels
 *
 * @module utils/axis-value-extractor
 */

import type { Node } from '@/types/node';
import type { LATCHAxis } from '@/types/pafv';

/**
 * Extract axis value from a node based on LATCH axis type
 *
 * @param node - Node to extract value from
 * @param axis - LATCH axis type
 * @param facet - Specific facet within the axis (e.g., 'year' for time axis)
 * @returns Numeric coordinate value, or null if value is missing
 */
export function extractAxisValue(
  node: Node,
  axis: LATCHAxis,
  facet: string
): number | null {
  switch (axis) {
    case 'location':
      return extractLocationValue(node, facet);
    case 'alphabet':
      return extractAlphabetValue(node, facet);
    case 'time':
      return extractTimeValue(node, facet);
    case 'category':
      return extractCategoryValue(node, facet);
    case 'hierarchy':
      return extractHierarchyValue(node, facet);
    default:
      return null;
  }
}

/**
 * Get domain (min/max range) for an axis across all nodes
 *
 * @param nodes - Array of nodes to analyze
 * @param axis - LATCH axis type
 * @param facet - Specific facet within the axis
 * @returns [min, max] tuple, or [0, 0] if no valid values
 */
export function getAxisDomain(
  nodes: Node[],
  axis: LATCHAxis,
  facet: string
): [number, number] {
  const values = nodes
    .map(node => extractAxisValue(node, axis, facet))
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return [0, 0];
  }

  return [Math.min(...values), Math.max(...values)];
}

/**
 * Get human-readable label for an axis value
 *
 * @param node - Node to get label from
 * @param axis - LATCH axis type
 * @param facet - Specific facet within the axis
 * @returns Display label for the axis value
 */
export function getAxisLabel(
  node: Node,
  axis: LATCHAxis,
  facet: string
): string {
  switch (axis) {
    case 'location':
      return getLocationLabel(node, facet);
    case 'alphabet':
      return getAlphabetLabel(node, facet);
    case 'time':
      return getTimeLabel(node, facet);
    case 'category':
      return getCategoryLabel(node, facet);
    case 'hierarchy':
      return getHierarchyLabel(node, facet);
    default:
      return '(unknown)';
  }
}

// ============================================================================
// Location Axis Extractors
// ============================================================================

function extractLocationValue(node: Node, facet: string): number | null {
  // For MVP, we don't have location data on nodes yet
  // Return null to position at origin
  return null;
}

function getLocationLabel(_node: Node, _facet: string): string {
  return '(no location)';
}

// ============================================================================
// Alphabet Axis Extractors
// ============================================================================

function extractAlphabetValue(node: Node, facet: string): number | null {
  const name = node.name || '';

  if (facet === 'letter') {
    // First letter: A=0, B=1, ..., Z=25
    const firstChar = name.charAt(0).toUpperCase();
    if (firstChar >= 'A' && firstChar <= 'Z') {
      return firstChar.charCodeAt(0) - 65; // 'A'.charCodeAt(0) = 65
    }
    return 0; // Default to 'A' for non-alphabetic
  }

  if (facet === 'word') {
    // First word: hash to coordinate
    const firstWord = name.split(' ')[0] || '';
    return hashStringToCoordinate(firstWord);
  }

  // Default: full name hash
  return hashStringToCoordinate(name);
}

function getAlphabetLabel(node: Node, facet: string): string {
  const name = node.name || '(untitled)';

  if (facet === 'letter') {
    return name.charAt(0).toUpperCase() || 'A';
  }

  if (facet === 'word') {
    return name.split(' ')[0] || '(untitled)';
  }

  return name;
}

// ============================================================================
// Time Axis Extractors
// ============================================================================

function extractTimeValue(node: Node, facet: string): number | null {
  // Use modifiedAt as primary time source, fallback to createdAt
  const dateStr = node.modifiedAt || node.createdAt;
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);

    switch (facet) {
      case 'year':
        return date.getFullYear();
      case 'month':
        // Encode as YYYYMM (e.g., 202401 for Jan 2024)
        return date.getFullYear() * 100 + (date.getMonth() + 1);
      case 'day':
        // Days since epoch / 86400000 (ms per day)
        return Math.floor(date.getTime() / 86400000);
      case 'hour':
        // Hours since epoch
        return Math.floor(date.getTime() / 3600000);
      default:
        // Default: timestamp in seconds
        return Math.floor(date.getTime() / 1000);
    }
  } catch {
    return null;
  }
}

function getTimeLabel(node: Node, facet: string): string {
  const dateStr = node.modifiedAt || node.createdAt;
  if (!dateStr) return '(no date)';

  try {
    const date = new Date(dateStr);

    switch (facet) {
      case 'year':
        return date.getFullYear().toString();
      case 'month':
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'hour':
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          hour12: true
        });
      default:
        return date.toLocaleDateString('en-US');
    }
  } catch {
    return '(invalid date)';
  }
}

// ============================================================================
// Category Axis Extractors
// ============================================================================

function extractCategoryValue(node: Node, facet: string): number | null {
  if (facet === 'tag') {
    // Use first tag, hash to coordinate
    const firstTag = node.tags?.[0];
    if (!firstTag) return 0;
    return hashStringToCoordinate(firstTag);
  }

  if (facet === 'folder') {
    return hashStringToCoordinate(node.folder || '');
  }

  if (facet === 'type') {
    return hashStringToCoordinate(node.nodeType || 'note');
  }

  // Default: use folder
  return hashStringToCoordinate(node.folder || '');
}

function getCategoryLabel(node: Node, facet: string): string {
  if (facet === 'tag') {
    return node.tags?.[0] || '(no tags)';
  }

  if (facet === 'folder') {
    return node.folder || '(no folder)';
  }

  if (facet === 'type') {
    return node.nodeType || 'note';
  }

  return node.folder || '(uncategorized)';
}

// ============================================================================
// Hierarchy Axis Extractors
// ============================================================================

function extractHierarchyValue(node: Node, facet: string): number | null {
  if (facet === 'level') {
    // Use priority as hierarchy level (1-10)
    return node.priority ?? 5; // Default to middle priority
  }

  if (facet === 'parent') {
    // Use folder as parent hierarchy
    return hashStringToCoordinate(node.folder || '');
  }

  // Default: use priority
  return node.priority ?? 5;
}

function getHierarchyLabel(node: Node, facet: string): string {
  if (facet === 'level') {
    return `Priority ${node.priority ?? 5}`;
  }

  if (facet === 'parent') {
    return node.folder || '(root)';
  }

  return `P${node.priority ?? 5}`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Hash a string to a stable numeric coordinate
 * Uses simple hash function for consistent mapping
 */
function hashStringToCoordinate(str: string): number {
  if (!str) return 0;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Map to positive coordinate range (0-99)
  return Math.abs(hash % 100);
}
