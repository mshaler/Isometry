/**
 * Database Insertion Utilities for ETL
 *
 * Provides functions to insert CanonicalNode arrays into sql.js database
 * with proper field mapping, transaction support, and EAV property storage.
 *
 * Updated in Phase 84 to insert into cards table instead of nodes.
 *
 * @module etl/database/insertion
 */

import type { Database } from 'sql.js';
import {
  CanonicalNode,
  toCardsSQLRecord,
  CARDS_SQL_COLUMNS
} from '../types/canonical';

/**
 * Result of batch insertion operation.
 */
export interface InsertResult {
  /** Number of nodes successfully inserted */
  inserted: number;
  /** Number of nodes that failed to insert */
  failed: number;
  /** Details of each failed node */
  errors: Array<{ node: CanonicalNode; error: string }>;
}

/**
 * Options for insertion behavior.
 */
export interface InsertOptions {
  /**
   * Whether to wrap inserts in a transaction.
   * If true (default), all inserts succeed or all fail.
   * If false, each insert is independent.
   */
  transaction?: boolean;
}

/**
 * Build parameterized INSERT SQL for cards table (Phase 84+).
 *
 * Uses deterministic column ordering based on CARDS_SQL_COLUMNS.
 *
 * @param record - SQL record with snake_case keys from toCardsSQLRecord()
 * @returns Object with SQL string and ordered parameter values
 */
function buildCardsInsertSQL(record: Record<string, unknown>): { sql: string; params: unknown[] } {
  const columns = [...CARDS_SQL_COLUMNS];
  const placeholders = columns.map(() => '?').join(', ');

  // Build params in same order as columns
  const params = columns.map(col => record[col]);

  const sql = `INSERT INTO cards (${columns.join(', ')}) VALUES (${placeholders})`;

  return { sql, params };
}

/**
 * Insert an array of CanonicalNodes into the sql.js database.
 *
 * Updated in Phase 84 to insert into cards table instead of nodes.
 *
 * Handles:
 * - camelCase to snake_case field mapping via toCardsSQLRecord()
 * - Tags array serialization to JSON string
 * - nodeType to card_type mapping (note/person/event/resource)
 * - Properties storage to card_properties EAV table
 * - Transaction support with rollback on failure
 *
 * @param db - sql.js Database instance
 * @param nodes - Array of validated CanonicalNode objects
 * @param options - Insertion options (transaction: boolean)
 * @returns InsertResult with counts and error details
 *
 * @example
 * const result = await insertCanonicalNodes(db, nodes, { transaction: true });
 * if (result.failed > 0) {
 *   console.error('Some nodes failed:', result.errors);
 * }
 */
export async function insertCanonicalNodes(
  db: Database,
  nodes: CanonicalNode[],
  options?: InsertOptions
): Promise<InsertResult> {
  const useTransaction = options?.transaction !== false; // Default to true
  const result: InsertResult = {
    inserted: 0,
    failed: 0,
    errors: [],
  };

  if (nodes.length === 0) {
    return result;
  }

  // Start transaction if enabled
  if (useTransaction) {
    db.run('BEGIN TRANSACTION');
  }

  try {
    for (const node of nodes) {
      try {
        // Convert CanonicalNode to cards table SQL record
        // This handles nodeType -> card_type mapping
        const record = toCardsSQLRecord(node);

        // Build and execute INSERT for cards table (Phase 84+)
        const { sql, params } = buildCardsInsertSQL(record);
        db.run(sql, params as (string | number | Uint8Array | null)[]);

        // Store properties to card_properties EAV table (if any)
        // Renamed from node_properties in Phase 84
        if (node.properties && Object.keys(node.properties).length > 0) {
          for (const [key, value] of Object.entries(node.properties)) {
            const valueType = Array.isArray(value)
              ? 'array'
              : value === null
                ? 'null'
                : typeof value;
            const valueString = typeof value === 'string' ? value : null;
            const valueNumber = typeof value === 'number' ? value : null;
            const valueBoolean = typeof value === 'boolean' ? (value ? 1 : 0) : null;
            const valueJson =
              valueType === 'array' || valueType === 'object'
                ? JSON.stringify(value)
                : null;
            const legacyValue = JSON.stringify(value);
            const propId = `prop-${node.id}-${key}`;
            db.run(
              `
              INSERT OR REPLACE INTO card_properties (
                id, card_id, key, value, value_type,
                value_string, value_number, value_boolean, value_json
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
              [
                propId,
                node.id,
                key,
                legacyValue,
                valueType,
                valueString,
                valueNumber,
                valueBoolean,
                valueJson,
              ]
            );
          }
        }

        result.inserted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (useTransaction) {
          // In transaction mode, rollback on any failure
          db.run('ROLLBACK');
          result.failed = nodes.length - result.inserted;
          result.inserted = 0; // Transaction rolled back, nothing actually inserted
          result.errors.push({ node, error: errorMessage });
          // Return early - transaction mode fails atomically
          return result;
        } else {
          // In non-transaction mode, continue with remaining nodes
          result.failed++;
          result.errors.push({ node, error: errorMessage });
        }
      }
    }

    // Commit transaction if enabled and all succeeded
    if (useTransaction) {
      db.run('COMMIT');
    }

    return result;
  } catch (error) {
    // Unexpected error - rollback if in transaction
    if (useTransaction) {
      try {
        db.run('ROLLBACK');
      } catch {
        // Ignore rollback errors
      }
    }
    throw error;
  }
}
