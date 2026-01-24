import { useMemo } from 'react';
import { useFilters } from '../state/FilterContext';
import { useNodes, type QueryState } from './useSQLiteQuery';
import { compileFilters } from '../filters/compiler';
import type { Node } from '../types/node';

/**
 * Hook that combines FilterContext with useNodes to return filtered data.
 * Automatically recompiles SQL when filters change.
 */
export function useFilteredNodes(): QueryState<Node> {
  const { activeFilters } = useFilters();

  // Compile filters to SQL WHERE clause
  const { whereClause, params } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    // compileFilters always includes 'deleted_at IS NULL',
    // but useNodes also adds it, so we need to handle this
    // The compiler output is the full WHERE clause content
    return {
      whereClause: compiled.sql || '1=1',
      params: compiled.params,
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
  const { activeFilters, activeCount } = useFilters();

  const description = useMemo(() => {
    const parts: string[] = [];

    if (activeFilters.time?.preset) {
      parts.push(activeFilters.time.preset.replace(/-/g, ' '));
    } else if (activeFilters.time?.type === 'range') {
      parts.push('custom date range');
    }

    if (activeFilters.category?.folders?.length) {
      const count = activeFilters.category.folders.length;
      parts.push(`${count} folder${count > 1 ? 's' : ''}`);
    }

    if (activeFilters.hierarchy?.minPriority != null || activeFilters.hierarchy?.maxPriority != null) {
      parts.push('priority filtered');
    }

    return parts.length > 0 ? parts.join(', ') : 'no filters';
  }, [activeFilters]);

  return { activeCount, description };
}
