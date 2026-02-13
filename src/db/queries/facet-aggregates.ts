/**
 * Facet Aggregate Queries
 *
 * SQL query functions for counting cards by facet values.
 * Used by the Catalog Browser to display folder/tag/status counts.
 *
 * Phase 79-01: Facet aggregate queries for catalog browsing
 */

import type { Database } from 'sql.js';

export interface FacetCount {
  value: string;
  count: number;
}

export interface AllFacetCounts {
  folders: FacetCount[];
  statuses: FacetCount[];
  tags: FacetCount[];
}

/**
 * Get card counts grouped by folder.
 * Only non-deleted nodes are included.
 *
 * @param db - sql.js Database instance
 * @returns Array of folder values with their card counts, sorted by count DESC
 */
export function getFolderCounts(db: Database): FacetCount[] {
  const result = db.exec(`
    SELECT folder, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL AND folder IS NOT NULL AND folder != ''
    GROUP BY folder
    ORDER BY count DESC
  `);

  if (!result[0]) return [];
  return result[0].values.map(([value, count]) => ({
    value: value as string,
    count: count as number,
  }));
}

/**
 * Get card counts grouped by status.
 * Only non-deleted nodes are included.
 *
 * @param db - sql.js Database instance
 * @returns Array of status values with their card counts, sorted by count DESC
 */
export function getStatusCounts(db: Database): FacetCount[] {
  const result = db.exec(`
    SELECT status, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL AND status IS NOT NULL AND status != ''
    GROUP BY status
    ORDER BY count DESC
  `);

  if (!result[0]) return [];
  return result[0].values.map(([value, count]) => ({
    value: value as string,
    count: count as number,
  }));
}

/**
 * Get card counts grouped by tag.
 * Tags are stored as JSON arrays, so we use json_each to explode them.
 * Only non-deleted nodes are included.
 *
 * @param db - sql.js Database instance
 * @returns Array of tag values with their card counts, sorted by count DESC
 */
export function getTagCounts(db: Database): FacetCount[] {
  // Use json_each to explode tags array
  const result = db.exec(`
    SELECT json_each.value as tag, COUNT(*) as count
    FROM nodes, json_each(nodes.tags)
    WHERE nodes.deleted_at IS NULL AND nodes.tags IS NOT NULL AND nodes.tags != '[]'
    GROUP BY json_each.value
    ORDER BY count DESC
  `);

  if (!result[0]) return [];
  return result[0].values.map(([value, count]) => ({
    value: value as string,
    count: count as number,
  }));
}

/**
 * Get all facet counts at once.
 * More efficient than calling individual functions when all counts are needed.
 *
 * @param db - sql.js Database instance
 * @returns Object containing folder, status, and tag counts
 */
export function getAllFacetCounts(db: Database): AllFacetCounts {
  return {
    folders: getFolderCounts(db),
    statuses: getStatusCounts(db),
    tags: getTagCounts(db),
  };
}
