import type { Node } from '../types/node';
import type { LATCHAxis } from '../types/pafv';

export interface GroupedNodes {
  [facetValue: string]: Node[];
}

/**
 * Group nodes by a LATCH axis facet.
 *
 * @param nodes - Array of nodes to group
 * @param axis - LATCH axis to group by (time, category, alphabet, hierarchy, location)
 * @param facet - Specific facet within the axis (e.g., 'year', 'tag', 'priority')
 * @returns Object mapping facet values to arrays of nodes
 *
 * @example
 * groupByFacet(nodes, 'time', 'year')
 * // Returns: { '2024': [...], '2023': [...], '2022': [...] }
 *
 * @example
 * groupByFacet(nodes, 'category', 'tag')
 * // Returns: { 'work': [...], 'personal': [...], 'Untagged': [...] }
 */
export function groupByFacet(
  nodes: Node[],
  axis: LATCHAxis,
  facet: string
): GroupedNodes {
  const groups: GroupedNodes = {};

  nodes.forEach(node => {
    const groupKey = getGroupKey(node, axis, facet);

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(node);
  });

  return groups;
}

/**
 * Get the group key for a node based on axis and facet.
 *
 * Handles missing values gracefully by returning appropriate defaults.
 */
function getGroupKey(node: Node, axis: LATCHAxis, facet: string): string {
  switch (axis) {
    case 'time':
      return getTimeGroupKey(node, facet);

    case 'category':
      return getCategoryGroupKey(node, facet);

    case 'alphabet':
      return getAlphabetGroupKey(node, facet);

    case 'hierarchy':
      return getHierarchyGroupKey(node, facet);

    case 'location':
      return getLocationGroupKey(node, facet);

    default:
      return 'Uncategorized';
  }
}

/**
 * Get time-based group key (year, month, day, etc.)
 */
function getTimeGroupKey(node: Node, facet: string): string {
  const date = new Date(node.createdAt);

  switch (facet) {
    case 'year':
      return date.getFullYear().toString();

    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    case 'day':
    case 'date':
      return date.toISOString().split('T')[0];

    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()} Q${quarter}`;

    case 'week':
      // Simple week calculation (ISO week would be more complex)
      const weekNum = Math.ceil(date.getDate() / 7);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')} Week ${weekNum}`;

    default:
      return date.getFullYear().toString();
  }
}

/**
 * Get category-based group key (folder, tag, status, etc.)
 */
function getCategoryGroupKey(node: Node, facet: string): string {
  switch (facet) {
    case 'folder':
      return node.folder ?? 'Uncategorized';

    case 'tag':
      // Use first tag, or 'Untagged' if no tags
      return node.tags[0] ?? 'Untagged';

    case 'tags':
      // For multi-tag grouping, join all tags
      return node.tags.length > 0 ? node.tags.join(', ') : 'Untagged';

    case 'status':
      return node.status ?? 'No Status';

    case 'type':
    case 'nodeType':
      return node.nodeType;

    default:
      return 'Uncategorized';
  }
}

/**
 * Get alphabet-based group key (first letter, etc.)
 */
function getAlphabetGroupKey(node: Node, facet: string): string {
  switch (facet) {
    case 'first-letter':
    case 'letter':
      const firstChar = node.name.charAt(0).toUpperCase();
      return /[A-Z]/.test(firstChar) ? firstChar : '#';

    case 'name':
      return node.name;

    default:
      const char = node.name.charAt(0).toUpperCase();
      return /[A-Z]/.test(char) ? char : '#';
  }
}

/**
 * Get hierarchy-based group key (priority, importance, etc.)
 */
function getHierarchyGroupKey(node: Node, facet: string): string {
  switch (facet) {
    case 'priority':
      return `Priority ${node.priority}`;

    case 'importance':
      // Group by importance range (0-3: Low, 4-7: Medium, 8-10: High)
      if (node.importance >= 8) return 'High Importance';
      if (node.importance >= 4) return 'Medium Importance';
      return 'Low Importance';

    case 'sortOrder':
      return `Order ${node.sortOrder}`;

    default:
      return `Priority ${node.priority}`;
  }
}

/**
 * Get location-based group key
 */
function getLocationGroupKey(node: Node, facet: string): string {
  switch (facet) {
    case 'name':
    case 'locationName':
      return node.locationName ?? 'No Location';

    case 'address':
      return node.locationAddress ?? 'No Location';

    case 'city':
      // Extract city from address (simplistic approach)
      if (node.locationAddress) {
        const parts = node.locationAddress.split(',');
        return parts[parts.length - 2]?.trim() ?? 'Unknown City';
      }
      return 'No Location';

    default:
      return node.locationName ?? 'No Location';
  }
}

/**
 * Sort groups by key.
 *
 * @param groups - Grouped nodes object
 * @param axis - LATCH axis (determines sort strategy)
 * @param descending - Sort descending (default: false)
 * @returns Array of [key, nodes] tuples sorted appropriately
 */
export function sortGroups(
  groups: GroupedNodes,
  axis: LATCHAxis,
  descending: boolean = false
): [string, Node[]][] {
  const entries = Object.entries(groups);

  // Sort based on axis type
  switch (axis) {
    case 'time':
      // Time groups should be sorted chronologically (newest first by default)
      entries.sort((a, b) => {
        const comparison = b[0].localeCompare(a[0]);
        return descending ? -comparison : comparison;
      });
      break;

    case 'hierarchy':
      // Hierarchy groups should be sorted numerically
      entries.sort((a, b) => {
        const numA = parseInt(a[0].match(/\d+/)?.[0] ?? '0');
        const numB = parseInt(b[0].match(/\d+/)?.[0] ?? '0');
        const comparison = descending ? numB - numA : numA - numB;
        return comparison;
      });
      break;

    default:
      // Alphabetical sort for category, alphabet, location
      entries.sort((a, b) => {
        const comparison = a[0].localeCompare(b[0]);
        return descending ? -comparison : comparison;
      });
  }

  return entries;
}

/**
 * Get a human-readable label for a group key.
 *
 * @param key - Group key
 * @param axis - LATCH axis
 * @param facet - Facet name
 * @returns Formatted label
 */
export function getGroupLabel(key: string, axis: LATCHAxis, facet: string): string {
  // For month keys (YYYY-MM), format as "Month Year"
  if (axis === 'time' && facet === 'month' && /^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  // For quarter keys, already formatted
  if (axis === 'time' && facet === 'quarter') {
    return key;
  }

  // For day keys (YYYY-MM-DD), format as "Month Day, Year"
  if (axis === 'time' && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const date = new Date(key);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Default: return key as-is
  return key;
}
