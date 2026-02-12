/**
 * Database Insertion Utilities for ETL
 *
 * Provides functions to insert CanonicalNode arrays into sql.js database
 * with proper field mapping, transaction support, and EAV property storage.
 *
 * @module etl/database/insertion
 */

import type { Database } from 'sql.js';
import { CanonicalNode, toSQLRecord, SQL_COLUMN_MAP } from '../types/canonical';

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
 * Build parameterized INSERT SQL for nodes table.
 *
 * Uses deterministic column ordering based on SQL_COLUMN_MAP.
 *
 * @param record - SQL record with snake_case keys from toSQLRecord()
 * @returns Object with SQL string and ordered parameter values
 */
function buildInsertSQL(record: Record<string, unknown>): { sql: string; params: unknown[] } {
  // Get columns in deterministic order from SQL_COLUMN_MAP
  const columns = Object.values(SQL_COLUMN_MAP);
  const placeholders = columns.map(() => '?').join(', ');

  // Build params in same order as columns
  const params = columns.map(col => record[col]);

  const sql = `INSERT INTO nodes (${columns.join(', ')}) VALUES (${placeholders})`;

  return { sql, params };
}

/**
 * Insert an array of CanonicalNodes into the sql.js database.
 *
 * Handles:
 * - camelCase to snake_case field mapping via toSQLRecord()
 * - Tags array serialization to JSON string
 * - Properties storage to node_properties EAV table
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
        // Convert CanonicalNode to SQL record (snake_case keys, tags serialized)
        const record = toSQLRecord(node);

        // Build and execute INSERT for nodes table
        const { sql, params } = buildInsertSQL(record);
        db.run(sql, params as (string | number | Uint8Array | null)[]);

        // Store properties to node_properties EAV table (if any)
        if (node.properties && Object.keys(node.properties).length > 0) {
          for (const [key, value] of Object.entries(node.properties)) {
            const valueType = Array.isArray(value)
              ? 'array'
              : value === null
                ? 'null'
                : typeof value;
            const propId = `prop-${node.id}-${key}`;
            db.run(
              `
              INSERT OR REPLACE INTO node_properties (id, node_id, key, value, value_type)
              VALUES (?, ?, ?, ?, ?)
            `,
              [propId, node.id, key, JSON.stringify(value), valueType]
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
