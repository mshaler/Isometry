import { useMemo } from 'react';
import { useFilters } from '../contexts/FilterContext';
import { useNodes, type QueryState } from './useSQLiteQuery';
import type { Node } from '../types/node';

/**
 * Hook that combines FilterContext with useNodes to return filtered data.
 * Automatically recompiles SQL when filters change.
 */
export function useFilteredNodes(): QueryState<Node> {
  const { filters: activeFilters } = useFilters();

  // Compile filters to SQL WHERE clause - simplified for basic Filter[]
  const { whereClause, params } = useMemo(() => {
    if (activeFilters.length === 0) {
      return { whereClause: '1=1', params: [] };
    }

    const conditions: string[] = [];
    const filterParams: (string | number | boolean)[] = [];

    activeFilters.forEach(filter => {
      const field = filter.field;
      const op = filter.operator;
      const value = filter.value;

      switch (op) {
        case '=':
          conditions.push(`${field} = ?`);
          filterParams.push(value);
          break;
        case '!=':
          conditions.push(`${field} != ?`);
          filterParams.push(value);
          break;
        case '>':
          conditions.push(`${field} > ?`);
          filterParams.push(value);
          break;
        case '<':
          conditions.push(`${field} < ?`);
          filterParams.push(value);
          break;
        case 'contains':
          conditions.push(`${field} LIKE ?`);
          filterParams.push(`%${value}%`);
          break;
        default:
          conditions.push(`${field} = ?`);
          filterParams.push(value);
      }
    });

    return {
      whereClause: conditions.join(' AND '),
      params: filterParams,
    };
  }, [activeFilters]);

  // useNodes will append 'AND deleted_at IS NULL', but our compiler
  // already includes it. We'll adjust to avoid duplication.
  const adjustedWhereClause = useMemo(() => {
    // Remove 'deleted_at IS NULL' from our compiled SQL since useNodes adds it
    return whereClause
      .replace(/^deleted_at IS NULL\s*(AND\s*)?/i, '')
      .replace(/\s*AND\s*deleted_at IS NULL$/i, '')
      .trim() || '1=1';
  }, [whereClause]);

  return useNodes(adjustedWhereClause, params);
}

/**
 * Hook to get filter summary for display
 */
export function useFilterSummary(): {
  activeCount: number;
  description: string;
} {
  const { filters } = useFilters();

  const activeCount = filters.length;

  const description = useMemo(() => {
    if (filters.length === 0) {
      return 'no filters';
    }

    const parts = filters.map(filter =>
      `${filter.field} ${filter.operator} ${filter.value}`
    );

    return parts.join(', ');
  }, [filters]);

  return { activeCount, description };
}
