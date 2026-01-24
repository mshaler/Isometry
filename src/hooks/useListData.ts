import { useMemo } from 'react';
import { usePAFV } from './usePAFV';
import { useNodes } from './useSQLiteQuery';
import type { Node } from '../types/node';
import type { LATCHAxis } from '../types/pafv';

export interface ListGroup {
  key: string;
  label: string;
  nodes: Node[];
}

export interface ListData {
  groups: ListGroup[] | null;
  flatNodes: Node[];
  sortAxis: LATCHAxis | null;
  sortFacet: string | null;
  isGrouped: boolean;
}

/**
 * Transform PAFV state into list data structure.
 *
 * - Reads PAFV state to determine sort axis (Y-axis mapping)
 * - Queries SQLite for all nodes with filters applied
 * - Sorts nodes by selected axis facet
 * - If grouping enabled, groups nodes by facet value
 */
export function useListData(groupingEnabled: boolean = true): ListData {
  const { state } = usePAFV();

  // Determine sort axis from PAFV state (use Y-axis mapping for list view)
  const yMapping = useMemo(() => {
    return state.mappings.find(m => m.plane === 'y');
  }, [state.mappings]);

  const sortAxis = yMapping?.axis ?? null;
  const sortFacet = yMapping?.facet ?? null;

  // Query all nodes (TODO: apply filters from FilterContext)
  const { data: nodes } = useNodes();

  // Sort nodes by the selected facet
  const sortedNodes = useMemo(() => {
    if (!nodes || !sortAxis || !sortFacet) return nodes ?? [];

    const sorted = [...nodes];

    // Sort based on axis type
    switch (sortAxis) {
      case 'time':
        // Sort by time facets (year, month, day, etc.)
        if (sortFacet === 'year') {
          sorted.sort((a, b) => {
            const yearA = new Date(a.createdAt).getFullYear();
            const yearB = new Date(b.createdAt).getFullYear();
            return yearB - yearA; // Descending (newest first)
          });
        } else if (sortFacet === 'month') {
          sorted.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
        } else {
          // Default: sort by createdAt descending
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        break;

      case 'category':
        // Sort by category facets (folder, tag, status)
        if (sortFacet === 'folder') {
          sorted.sort((a, b) => (a.folder ?? '').localeCompare(b.folder ?? ''));
        } else if (sortFacet === 'tag') {
          sorted.sort((a, b) => {
            const tagA = a.tags[0] ?? '';
            const tagB = b.tags[0] ?? '';
            return tagA.localeCompare(tagB);
          });
        } else if (sortFacet === 'status') {
          sorted.sort((a, b) => (a.status ?? '').localeCompare(b.status ?? ''));
        }
        break;

      case 'alphabet':
        // Sort by name alphabetically
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;

      case 'hierarchy':
        // Sort by priority/importance
        if (sortFacet === 'priority') {
          sorted.sort((a, b) => a.priority - b.priority);
        } else if (sortFacet === 'importance') {
          sorted.sort((a, b) => b.importance - a.importance);
        }
        break;

      case 'location':
        // Sort by location name
        sorted.sort((a, b) => (a.locationName ?? '').localeCompare(b.locationName ?? ''));
        break;

      default:
        // Default: sort by modifiedAt descending
        sorted.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    }

    return sorted;
  }, [nodes, sortAxis, sortFacet]);

  // Group nodes by facet value if grouping is enabled
  const groups = useMemo(() => {
    if (!groupingEnabled || !sortedNodes.length || !sortAxis || !sortFacet) {
      return null;
    }

    const groupMap = new Map<string, Node[]>();

    sortedNodes.forEach(node => {
      let groupKey = 'Uncategorized';

      // Determine group key based on axis and facet
      switch (sortAxis) {
        case 'time':
          if (sortFacet === 'year') {
            groupKey = new Date(node.createdAt).getFullYear().toString();
          } else if (sortFacet === 'month') {
            const date = new Date(node.createdAt);
            groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else {
            groupKey = new Date(node.createdAt).toISOString().split('T')[0];
          }
          break;

        case 'category':
          if (sortFacet === 'folder') {
            groupKey = node.folder ?? 'Uncategorized';
          } else if (sortFacet === 'tag') {
            groupKey = node.tags[0] ?? 'Untagged';
          } else if (sortFacet === 'status') {
            groupKey = node.status ?? 'No Status';
          }
          break;

        case 'alphabet':
          // Group by first letter
          groupKey = node.name.charAt(0).toUpperCase();
          break;

        case 'hierarchy':
          if (sortFacet === 'priority') {
            groupKey = `Priority ${node.priority}`;
          } else if (sortFacet === 'importance') {
            groupKey = `Importance ${node.importance}`;
          }
          break;

        case 'location':
          groupKey = node.locationName ?? 'No Location';
          break;
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(node);
    });

    // Convert map to array of groups, sorted by key
    return Array.from(groupMap.entries())
      .map(([key, nodes]) => ({
        key,
        label: key,
        nodes,
      }))
      .sort((a, b) => {
        // For year groups, sort descending (newest first)
        if (sortAxis === 'time' && sortFacet === 'year') {
          return b.key.localeCompare(a.key);
        }
        // Default: sort ascending
        return a.key.localeCompare(b.key);
      });
  }, [sortedNodes, groupingEnabled, sortAxis, sortFacet]);

  return {
    groups,
    flatNodes: sortedNodes,
    sortAxis,
    sortFacet,
    isGrouped: groupingEnabled && groups !== null,
  };
}
