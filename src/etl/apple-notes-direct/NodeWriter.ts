/**
 * NodeWriter Service
 *
 * Persists CanonicalNode[] and CanonicalEdge[] to Isometry's sql.js nodes/edges tables.
 * Uses INSERT OR REPLACE for upsert semantics with deduplication via source+source_id.
 *
 * IMPORTANT: This service targets sql.js (WASM/browser runtime).
 * The AppleNotesAdapter (better-sqlite3) runs in Node.js backend.
 * Production wiring via Tauri IPC is deferred to 117-04.
 *
 * Phase 117-02
 */

import type { Database } from 'sql.js';

import { CanonicalNode, CanonicalEdge } from './types';
import {
  canonicalNodeToIsometryNode,
  canonicalEdgeToIsometryEdge,
  generateNodeUpsertSQL,
  generateEdgeUpsertSQL,
} from './type-mapping';

// =============================================================================
// Types
// =============================================================================

export interface WriteResult {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export interface NodeWriter {
  /**
   * Upsert an array of CanonicalNodes into the nodes table.
   * Uses INSERT OR REPLACE — deduplication happens via UNIQUE on (source, source_id).
   */
  upsertNodes(nodes: CanonicalNode[]): WriteResult;

  /**
   * Upsert an array of CanonicalEdges into the edges table.
   * Uses INSERT OR REPLACE — deduplication happens via UNIQUE on (source_id, target_id, edge_type).
   */
  upsertEdges(edges: CanonicalEdge[]): WriteResult;

  /**
   * Soft-delete nodes from a source that are NOT in keepIds.
   * Used during incremental sync to mark stale records as deleted.
   *
   * @param source - Source type (e.g., 'apple-notes')
   * @param keepIds - Node IDs to preserve (all others get deleted_at set)
   * @returns Number of nodes soft-deleted
   */
  softDeleteBySource(source: string, keepIds: string[]): number;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create a NodeWriter backed by a sql.js Database instance.
 */
export function createNodeWriter(db: Database): NodeWriter {
  return {
    upsertNodes(nodes: CanonicalNode[]): WriteResult {
      const result: WriteResult = {
        inserted: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
      };

      if (nodes.length === 0) return result;

      try {
        db.run('BEGIN');

        for (const node of nodes) {
          try {
            // Check if node exists before upsert to track insert vs update
            const existing = db.exec(
              'SELECT id FROM nodes WHERE id = ?',
              [node.id]
            );
            const existed = existing.length > 0 && existing[0].values.length > 0;

            const isometryNode = canonicalNodeToIsometryNode(node);
            const { sql, params } = generateNodeUpsertSQL(isometryNode);
            db.run(sql, params as (string | number | Uint8Array | null)[]);

            if (existed) {
              result.updated++;
            } else {
              result.inserted++;
            }
          } catch (nodeError) {
            const message = nodeError instanceof Error ? nodeError.message : String(nodeError);
            result.errors.push(`Node ${node.id}: ${message}`);
          }
        }

        db.run('COMMIT');
      } catch (txError) {
        try {
          db.run('ROLLBACK');
        } catch {
          // Ignore rollback errors
        }
        const message = txError instanceof Error ? txError.message : String(txError);
        result.errors.push(`Transaction failed: ${message}`);
        // Reset counts since transaction was rolled back
        result.inserted = 0;
        result.updated = 0;
      }

      return result;
    },

    upsertEdges(edges: CanonicalEdge[]): WriteResult {
      const result: WriteResult = {
        inserted: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
      };

      if (edges.length === 0) return result;

      try {
        db.run('BEGIN');

        for (const edge of edges) {
          try {
            // Check if edge exists before upsert
            const existing = db.exec(
              'SELECT id FROM edges WHERE id = ?',
              [edge.id]
            );
            const existed = existing.length > 0 && existing[0].values.length > 0;

            const isometryEdge = canonicalEdgeToIsometryEdge(edge);
            const { sql, params } = generateEdgeUpsertSQL(isometryEdge);
            db.run(sql, params as (string | number | Uint8Array | null)[]);

            if (existed) {
              result.updated++;
            } else {
              result.inserted++;
            }
          } catch (edgeError) {
            const message = edgeError instanceof Error ? edgeError.message : String(edgeError);
            result.errors.push(`Edge ${edge.id}: ${message}`);
          }
        }

        db.run('COMMIT');
      } catch (txError) {
        try {
          db.run('ROLLBACK');
        } catch {
          // Ignore rollback errors
        }
        const message = txError instanceof Error ? txError.message : String(txError);
        result.errors.push(`Transaction failed: ${message}`);
        // Reset counts since transaction was rolled back
        result.inserted = 0;
        result.updated = 0;
      }

      return result;
    },

    softDeleteBySource(source: string, keepIds: string[]): number {
      const now = new Date().toISOString();

      try {
        if (keepIds.length === 0) {
          // Soft-delete ALL nodes for this source
          db.run(
            `UPDATE nodes SET deleted_at = ? WHERE source = ? AND deleted_at IS NULL`,
            [now, source]
          );
        } else {
          // Use placeholders for the keepIds list
          const placeholders = keepIds.map(() => '?').join(', ');
          db.run(
            `UPDATE nodes SET deleted_at = ?
             WHERE source = ? AND deleted_at IS NULL AND id NOT IN (${placeholders})`,
            [now, source, ...keepIds] as (string | number | Uint8Array | null)[]
          );
        }

        // Return count of soft-deleted nodes
        const result = db.exec(
          `SELECT COUNT(*) FROM nodes WHERE source = ? AND deleted_at = ?`,
          [source, now]
        );
        const count = result[0]?.values[0]?.[0];
        return typeof count === 'number' ? count : 0;
      } catch (error) {
        console.error('[NodeWriter] softDeleteBySource failed:', error);
        return 0;
      }
    },
  };
}
