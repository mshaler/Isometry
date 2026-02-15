import { useMemo } from 'react';
import { useSQLiteQuery } from '@/hooks';

export interface FacetOption {
  id: string;
  label: string;
  description: string;
}

// Columns to exclude from facet list (internal/system columns)
const EXCLUDED_COLUMNS = [
  'id',
  'content',
  'deleted_at',
  'created_at',
  'modified_at',
  'version',
  'sync_status',
  'source_id',
  'source_url',
  'grid_x',
  'grid_y',
  'rowid',
];

/**
 * Discover available facets from node schema
 * Queries SQLite pragma to get column names and formats them for SuperDynamic
 */
export function useAvailableFacets(): FacetOption[] {
  // Query PRAGMA to get column names
  const { data: columns } = useSQLiteQuery<{ name: string }>(
    "SELECT name FROM pragma_table_info('nodes')",
    []
  );

  return useMemo(() => {
    if (!columns) return [];

    return columns
      .filter(col => !EXCLUDED_COLUMNS.includes(col.name))
      .map(col => ({
        id: col.name,
        label: formatFacetLabel(col.name),
        description: `Group by ${formatFacetLabel(col.name)}`,
      }));
  }, [columns]);
}

/**
 * Format snake_case column name to Title Case label
 */
function formatFacetLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
