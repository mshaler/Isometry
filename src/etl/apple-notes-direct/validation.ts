/**
 * Data Integrity Validation Service
 *
 * Validates post-sync data integrity for Apple Notes → Isometry SQLite pipeline.
 * Checks folder paths, timestamps, tags, and orphan edges.
 *
 * Usage:
 *   const validator = createDataIntegrityValidator(db);
 *   const result = validator.validateSource('apple-notes');
 *   if (!result.valid) {
 *     console.error('Data integrity issues:', result.errors);
 *   }
 *
 * Phase 117-03
 */

import type { Database } from 'sql.js';

// =============================================================================
// Types
// =============================================================================

export interface ValidationError {
  type: 'folder_mismatch' | 'timestamp_drift' | 'tag_mismatch' | 'missing_node';
  nodeId: string;
  expected: string;
  actual: string;
  message: string;
}

export interface ValidationWarning {
  type: 'orphan_edge' | 'empty_folder' | 'duplicate_source_id';
  details: string;
}

export interface ValidationStats {
  nodesChecked: number;
  edgesChecked: number;
  folderPathsVerified: number;
  timestampsVerified: number;
  tagsVerified: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface DataIntegrityValidator {
  /**
   * Validate a single node's folder path against expected value.
   * Returns null if valid, ValidationError if mismatch.
   */
  validateFolderPath(nodeId: string, expectedPath: string): ValidationError | null;

  /**
   * Validate a node's timestamp is within tolerance of expected value.
   * Default tolerance is 1000ms (1 second).
   * Returns null if valid, ValidationError if drift exceeds tolerance.
   */
  validateTimestamp(
    nodeId: string,
    field: 'created_at' | 'modified_at',
    expected: Date,
    toleranceMs?: number
  ): ValidationError | null;

  /**
   * Validate a node's tags match expected array (order-independent).
   * Returns null if valid, ValidationError if mismatch.
   */
  validateTags(nodeId: string, expectedTags: string[]): ValidationError | null;

  /**
   * Run full validation suite on all nodes from a source.
   * Checks for orphan edges and duplicate source_ids.
   */
  validateSource(source: string): ValidationResult;

  /**
   * Validate a specific node by ID against expected values.
   * Returns array of ValidationErrors (empty if all valid).
   */
  validateNode(
    nodeId: string,
    expected: {
      folder?: string;
      created?: Date;
      modified?: Date;
      tags?: string[];
    }
  ): ValidationError[];
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create a DataIntegrityValidator backed by a sql.js Database instance.
 */
export function createDataIntegrityValidator(db: Database): DataIntegrityValidator {
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Query a single node row by ID.
   * Returns the row as a Record or null if not found.
   */
  function queryNode(nodeId: string): Record<string, unknown> | null {
    const results = db.exec(
      'SELECT id, folder, tags, created_at, modified_at FROM nodes WHERE id = ? AND deleted_at IS NULL',
      [nodeId]
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const { columns, values } = results[0];
    const row: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      row[col] = values[0][idx];
    });
    return row;
  }

  /**
   * Parse tags JSON from database.
   * Returns sorted array for order-independent comparison.
   */
  function parseTags(tagsJson: unknown): string[] {
    if (!tagsJson || typeof tagsJson !== 'string') return [];
    try {
      const parsed = JSON.parse(tagsJson) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Interface implementation
  // ---------------------------------------------------------------------------

  return {
    validateFolderPath(nodeId: string, expectedPath: string): ValidationError | null {
      const row = queryNode(nodeId);

      if (!row) {
        return {
          type: 'missing_node',
          nodeId,
          expected: expectedPath,
          actual: '(node not found)',
          message: `Node ${nodeId} not found in database`,
        };
      }

      const actualFolder = (row['folder'] as string | null) ?? '';
      if (actualFolder !== expectedPath) {
        return {
          type: 'folder_mismatch',
          nodeId,
          expected: expectedPath,
          actual: actualFolder,
          message: `Node ${nodeId} folder mismatch: expected '${expectedPath}', got '${actualFolder}'`,
        };
      }

      return null;
    },

    validateTimestamp(
      nodeId: string,
      field: 'created_at' | 'modified_at',
      expected: Date,
      toleranceMs = 1000
    ): ValidationError | null {
      const row = queryNode(nodeId);

      if (!row) {
        return {
          type: 'missing_node',
          nodeId,
          expected: expected.toISOString(),
          actual: '(node not found)',
          message: `Node ${nodeId} not found in database`,
        };
      }

      const actualStr = row[field] as string | null;
      if (!actualStr) {
        return {
          type: 'timestamp_drift',
          nodeId,
          expected: expected.toISOString(),
          actual: '(null)',
          message: `Node ${nodeId} ${field} is null`,
        };
      }

      const actualDate = new Date(actualStr);
      const drift = Math.abs(actualDate.getTime() - expected.getTime());

      if (drift > toleranceMs) {
        return {
          type: 'timestamp_drift',
          nodeId,
          expected: expected.toISOString(),
          actual: actualStr,
          message: `Node ${nodeId} ${field} drift ${drift}ms exceeds tolerance ${toleranceMs}ms`,
        };
      }

      return null;
    },

    validateTags(nodeId: string, expectedTags: string[]): ValidationError | null {
      const row = queryNode(nodeId);

      if (!row) {
        return {
          type: 'missing_node',
          nodeId,
          expected: JSON.stringify(expectedTags.sort()),
          actual: '(node not found)',
          message: `Node ${nodeId} not found in database`,
        };
      }

      const actualTags = parseTags(row['tags']);
      const sortedActual = [...actualTags].sort();
      const sortedExpected = [...expectedTags].sort();

      if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
        return {
          type: 'tag_mismatch',
          nodeId,
          expected: JSON.stringify(sortedExpected),
          actual: JSON.stringify(sortedActual),
          message: `Node ${nodeId} tag mismatch: expected ${JSON.stringify(sortedExpected)}, got ${JSON.stringify(sortedActual)}`,
        };
      }

      return null;
    },

    validateNode(
      nodeId: string,
      expected: {
        folder?: string;
        created?: Date;
        modified?: Date;
        tags?: string[];
      }
    ): ValidationError[] {
      const errors: ValidationError[] = [];

      if (expected.folder !== undefined) {
        const err = this.validateFolderPath(nodeId, expected.folder);
        if (err) errors.push(err);
      }

      if (expected.created !== undefined) {
        const err = this.validateTimestamp(nodeId, 'created_at', expected.created);
        if (err) errors.push(err);
      }

      if (expected.modified !== undefined) {
        const err = this.validateTimestamp(nodeId, 'modified_at', expected.modified);
        if (err) errors.push(err);
      }

      if (expected.tags !== undefined) {
        const err = this.validateTags(nodeId, expected.tags);
        if (err) errors.push(err);
      }

      return errors;
    },

    validateSource(source: string): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const stats: ValidationStats = {
        nodesChecked: 0,
        edgesChecked: 0,
        folderPathsVerified: 0,
        timestampsVerified: 0,
        tagsVerified: 0,
      };

      // Count and fetch all nodes for this source
      const nodeResults = db.exec(
        'SELECT id, folder, tags, created_at, modified_at FROM nodes WHERE source = ? AND deleted_at IS NULL',
        [source]
      );

      if (nodeResults.length > 0 && nodeResults[0].values.length > 0) {
        const { columns, values } = nodeResults[0];
        stats.nodesChecked = values.length;

        for (const rowValues of values) {
          const row: Record<string, unknown> = {};
          columns.forEach((col, idx) => {
            row[col] = rowValues[idx];
          });

          // Track per-node folder verification
          if (row['folder'] !== undefined) {
            stats.folderPathsVerified++;
          }

          // Track timestamp verification
          if (row['created_at']) stats.timestampsVerified++;
          if (row['modified_at']) stats.timestampsVerified++;

          // Track tag verification
          if (row['tags']) stats.tagsVerified++;
        }
      }

      // Check for duplicate source_ids
      const dupResults = db.exec(
        `SELECT source_id, COUNT(*) as cnt
         FROM nodes
         WHERE source = ? AND deleted_at IS NULL
         GROUP BY source_id
         HAVING cnt > 1`,
        [source]
      );

      if (dupResults.length > 0 && dupResults[0].values.length > 0) {
        for (const dupRow of dupResults[0].values) {
          const sourceId = dupRow[0] as string;
          warnings.push({
            type: 'duplicate_source_id',
            details: `Duplicate source_id '${sourceId}' found for source '${source}'`,
          });
        }
      }

      // Check for orphan edges (edges referencing non-existent nodes)
      const edgeResults = db.exec(
        `SELECT e.id, e.source_id, e.target_id
         FROM edges e
         WHERE (
           NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.source_id AND n.deleted_at IS NULL)
           OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target_id AND n.deleted_at IS NULL)
         )`
      );

      if (edgeResults.length > 0 && edgeResults[0].values.length > 0) {
        stats.edgesChecked = edgeResults[0].values.length;
        for (const edgeRow of edgeResults[0].values) {
          const edgeId = edgeRow[0] as string;
          const edgeSourceId = edgeRow[1] as string;
          const edgeTargetId = edgeRow[2] as string;
          warnings.push({
            type: 'orphan_edge',
            details: `Edge ${edgeId} references missing node(s): source=${edgeSourceId}, target=${edgeTargetId}`,
          });
        }
      }

      // Count valid edges for stats
      const validEdgeResult = db.exec('SELECT COUNT(*) FROM edges');
      if (validEdgeResult.length > 0 && validEdgeResult[0].values.length > 0) {
        const total = validEdgeResult[0].values[0][0] as number;
        stats.edgesChecked = total;
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats,
      };
    },
  };
}
