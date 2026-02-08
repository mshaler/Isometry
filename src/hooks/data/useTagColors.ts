/**
 * useTagColors hook - Fetch all unique tags from database with counts
 */

import { useMemo } from 'react';
import { useSQLiteQuery } from '../database/useSQLiteQuery';

interface TagRow {
  tag: string;
  count: number;
}

/**
 * Fetch all unique tags from the database with usage counts
 */
export function useAllTags() {
  const { data, loading, error } = useSQLiteQuery<TagRow>(
    `
      -- Extract all tags from JSON arrays and count occurrences
      -- SQLite json_each() extracts array elements
      WITH tag_values AS (
        SELECT json_each.value AS tag
        FROM nodes, json_each(nodes.tags)
        WHERE deleted_at IS NULL
      )
      SELECT
        tag,
        COUNT(*) as count
      FROM tag_values
      WHERE tag IS NOT NULL AND tag != ''
      GROUP BY tag
      ORDER BY count DESC
    `,
    [],
    {
      transform: (rows: Record<string, unknown>[]) =>
        rows.map((row: Record<string, unknown>) => ({
          tag: row.tag as string,
          count: row.count as number,
        })),
    }
  );

  // Extract just the tag names
  const tags = useMemo(() => {
    return data?.map((row: { tag: string; count: number }) => row.tag) || [];
  }, [data]);

  // Create a Map of tag counts
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    data?.forEach((row: { tag: string; count: number }) => {
      map.set(row.tag, row.count);
    });
    return map;
  }, [data]);

  return {
    tags,
    tagCounts,
    loading,
    error,
  };
}
