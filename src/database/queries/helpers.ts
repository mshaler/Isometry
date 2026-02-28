// Isometry v5 — Phase 2 Query Helpers
// Reusable utilities for row mapping and query helpers.

import type { Database } from '../Database';
import type { Card, CardType, Connection } from './types';
import type { SqlValue } from 'sql.js';

// ---------------------------------------------------------------------------
// withStatement — Prepared statement wrapper
//
// Guarantees stmt.free() via try/finally for performance-critical hot paths
// with repeated statement execution.
//
// NOTE: Database.ts does not expose prepare() yet (deferred to Phase 3+).
// For Phase 2, prefer db.exec() for SELECT and db.run() for mutations.
// withStatement is defined here as the documented Phase 3+ pattern entry point.
// ---------------------------------------------------------------------------
export function withStatement<T>(
  _db: Database,
  _sql: string,
  _fn: (stmt: unknown) => T
): T {
  // Phase 2: Database.prepare() is not yet exposed.
  // Use db.exec() for SELECT and db.run() for INSERT/UPDATE/DELETE.
  // withStatement will be wired up in Phase 3+ performance optimization.
  throw new Error(
    'withStatement requires Database.prepare() — use db.exec()/db.run() for Phase 2'
  );
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map a sql.js row object (column name → SqlValue) to a typed Card.
 * Handles JSON parsing for `tags` and INTEGER → boolean mapping for `is_collective`.
 */
export function rowToCard(row: Record<string, SqlValue>): Card {
  return {
    id: row['id'] as string,
    card_type: row['card_type'] as CardType,
    name: row['name'] as string,
    content: (row['content'] as string | null) ?? null,
    summary: (row['summary'] as string | null) ?? null,
    latitude: (row['latitude'] as number | null) ?? null,
    longitude: (row['longitude'] as number | null) ?? null,
    location_name: (row['location_name'] as string | null) ?? null,
    created_at: row['created_at'] as string,
    modified_at: row['modified_at'] as string,
    due_at: (row['due_at'] as string | null) ?? null,
    completed_at: (row['completed_at'] as string | null) ?? null,
    event_start: (row['event_start'] as string | null) ?? null,
    event_end: (row['event_end'] as string | null) ?? null,
    folder: (row['folder'] as string | null) ?? null,
    tags: row['tags'] ? (JSON.parse(row['tags'] as string) as string[]) : [],
    status: (row['status'] as string | null) ?? null,
    priority: (row['priority'] as number | null) ?? 0,
    sort_order: (row['sort_order'] as number | null) ?? 0,
    url: (row['url'] as string | null) ?? null,
    mime_type: (row['mime_type'] as string | null) ?? null,
    is_collective: (row['is_collective'] as number) === 1,
    source: (row['source'] as string | null) ?? null,
    source_id: (row['source_id'] as string | null) ?? null,
    source_url: (row['source_url'] as string | null) ?? null,
    deleted_at: (row['deleted_at'] as string | null) ?? null,
  };
}

/**
 * Map a sql.js row object (column name → SqlValue) to a typed Connection.
 */
export function rowToConnection(row: Record<string, SqlValue>): Connection {
  return {
    id: row['id'] as string,
    source_id: row['source_id'] as string,
    target_id: row['target_id'] as string,
    via_card_id: (row['via_card_id'] as string | null) ?? null,
    label: (row['label'] as string | null) ?? null,
    weight: (row['weight'] as number | null) ?? 1.0,
    created_at: row['created_at'] as string,
  };
}

/**
 * Convert db.exec() output (column array + values matrix) to a typed Card array.
 * Zips column names with row values to produce row objects, then maps to Card.
 */
export function execRowsToCards(
  result: { columns: string[]; values: unknown[][] }[]
): Card[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return rowToCard(obj as Record<string, SqlValue>);
  });
}

/**
 * Convert db.exec() output (column array + values matrix) to a typed Connection array.
 * Zips column names with row values to produce row objects, then maps to Connection.
 */
export function execRowsToConnections(
  result: { columns: string[]; values: unknown[][] }[]
): Connection[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return rowToConnection(obj as Record<string, SqlValue>);
  });
}
