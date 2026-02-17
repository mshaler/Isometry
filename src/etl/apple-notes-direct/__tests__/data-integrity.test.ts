/**
 * Data Integrity Validation Tests
 *
 * Validates the DataIntegrityValidator service against an in-memory sql.js
 * database. Tests cover folder paths, timestamps, tags, source validation,
 * and the end-to-end Stacey success criterion.
 *
 * Phase 117-03
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'sql.js-fts5';

import { createTestDB, cleanupTestDB, execTestQuery } from '../../../test/db-utils';
import { createDataIntegrityValidator, DataIntegrityValidator } from '../validation';
import { createNodeWriter } from '../NodeWriter';
import { CanonicalNode } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function makeCanonicalNode(overrides: Partial<CanonicalNode> = {}): CanonicalNode {
  return {
    id: 'apple-notes:1001',
    source: 'apple-notes',
    sourceId: '1001',
    sourceUrl: 'x-coredata://note/1001',
    nodeType: 'note',
    name: 'Test Note',
    content: 'Test content',
    summary: 'Summary',
    time: {
      created: new Date('2026-02-17T10:00:00.000Z'),
      modified: new Date('2026-02-17T10:00:00.000Z'),
    },
    category: {
      hierarchy: ['Work'],
      tags: ['work', 'urgent'],
      status: 'active',
    },
    hierarchy: {
      priority: 0,
      importance: 0,
      sortOrder: 0,
    },
    ...overrides,
  };
}

/** Insert a node directly to nodes table for testing (bypasses NodeWriter mapping) */
function insertRawNode(db: Database, params: {
  id: string;
  name: string;
  folder: string | null;
  tags: string | null;
  created_at: string;
  modified_at: string;
  source?: string;
  source_id?: string;
}): void {
  db.run(
    `INSERT INTO nodes (
      id, node_type, name, folder, tags, created_at, modified_at,
      source, source_id, priority, importance, sort_order, version
    ) VALUES (?, 'note', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 1)`,
    [
      params.id,
      params.name,
      params.folder,
      params.tags,
      params.created_at,
      params.modified_at,
      params.source ?? 'apple-notes',
      params.source_id ?? params.id,
    ]
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('Data Integrity Validation', () => {
  let db: Database;
  let validator: DataIntegrityValidator;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
    validator = createDataIntegrityValidator(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  // ---------------------------------------------------------------------------
  // Folder Path Validation
  // ---------------------------------------------------------------------------

  describe('Folder Path Validation', () => {
    it('returns null for matching folder path', () => {
      insertRawNode(db, {
        id: 'apple-notes:100',
        name: 'Test Note',
        folder: 'Family/Stacey',
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      const error = validator.validateFolderPath('apple-notes:100', 'Family/Stacey');
      expect(error).toBeNull();
    });

    it('returns folder_mismatch error for wrong folder', () => {
      insertRawNode(db, {
        id: 'apple-notes:101',
        name: 'Test Note',
        folder: 'Family/Stacey',
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      const error = validator.validateFolderPath('apple-notes:101', 'Work/Projects');
      expect(error).not.toBeNull();
      expect(error!.type).toBe('folder_mismatch');
      expect(error!.expected).toBe('Work/Projects');
      expect(error!.actual).toBe('Family/Stacey');
      expect(error!.nodeId).toBe('apple-notes:101');
    });

    it('returns missing_node error for non-existent node', () => {
      const error = validator.validateFolderPath('apple-notes:nonexistent', 'Work');
      expect(error).not.toBeNull();
      expect(error!.type).toBe('missing_node');
    });

    it('returns null for null folder when expected path is empty string', () => {
      insertRawNode(db, {
        id: 'apple-notes:102',
        name: 'Unfiled Note',
        folder: null,
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      // null folder maps to empty string '' in validator (null ?? '')
      const error = validator.validateFolderPath('apple-notes:102', '');
      expect(error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp Validation
  // ---------------------------------------------------------------------------

  describe('Timestamp Validation', () => {
    const baseTime = '2026-02-17T10:00:00.000Z';
    const baseDate = new Date(baseTime);

    beforeEach(() => {
      insertRawNode(db, {
        id: 'apple-notes:200',
        name: 'Timestamp Test Note',
        folder: 'Work',
        tags: null,
        created_at: baseTime,
        modified_at: baseTime,
      });
    });

    it('returns null for exact timestamp match', () => {
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', baseDate);
      expect(error).toBeNull();
    });

    it('returns null within 500ms tolerance (within default 1000ms)', () => {
      const slightlyOff = new Date(baseDate.getTime() + 500);
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', slightlyOff);
      expect(error).toBeNull();
    });

    it('returns null within negative 500ms tolerance (within default 1000ms)', () => {
      const slightlyBefore = new Date(baseDate.getTime() - 500);
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', slightlyBefore);
      expect(error).toBeNull();
    });

    it('returns timestamp_drift error for 2000ms drift (exceeds 1000ms tolerance)', () => {
      const tooFar = new Date(baseDate.getTime() + 2000);
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', tooFar);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('timestamp_drift');
      expect(error!.nodeId).toBe('apple-notes:200');
    });

    it('returns timestamp_drift error for -2000ms drift', () => {
      const tooFarBefore = new Date(baseDate.getTime() - 2000);
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', tooFarBefore);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('timestamp_drift');
    });

    it('respects custom tolerance of 500ms', () => {
      const justOver = new Date(baseDate.getTime() + 600);
      const error = validator.validateTimestamp('apple-notes:200', 'created_at', justOver, 500);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('timestamp_drift');
    });

    it('validates modified_at field', () => {
      const exact = new Date(baseTime);
      const error = validator.validateTimestamp('apple-notes:200', 'modified_at', exact);
      expect(error).toBeNull();
    });

    it('returns missing_node error for non-existent node', () => {
      const error = validator.validateTimestamp('apple-notes:nonexistent', 'created_at', baseDate);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('missing_node');
    });
  });

  // ---------------------------------------------------------------------------
  // Tag Validation
  // ---------------------------------------------------------------------------

  describe('Tag Validation', () => {
    beforeEach(() => {
      insertRawNode(db, {
        id: 'apple-notes:300',
        name: 'Tag Test Note',
        folder: 'Work',
        tags: JSON.stringify(['work', 'urgent']),
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });
    });

    it('returns null for exact tag match', () => {
      const error = validator.validateTags('apple-notes:300', ['work', 'urgent']);
      expect(error).toBeNull();
    });

    it('returns null for same tags in different order (order-independent)', () => {
      const error = validator.validateTags('apple-notes:300', ['urgent', 'work']);
      expect(error).toBeNull();
    });

    it('returns tag_mismatch for missing tag', () => {
      const error = validator.validateTags('apple-notes:300', ['work']);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('tag_mismatch');
      expect(error!.nodeId).toBe('apple-notes:300');
    });

    it('returns tag_mismatch for extra tag', () => {
      const error = validator.validateTags('apple-notes:300', ['work', 'urgent', 'extra']);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('tag_mismatch');
    });

    it('returns null for empty tags when node has no tags', () => {
      insertRawNode(db, {
        id: 'apple-notes:301',
        name: 'No Tags Note',
        folder: 'Work',
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      const error = validator.validateTags('apple-notes:301', []);
      expect(error).toBeNull();
    });

    it('returns tag_mismatch when node has no tags but expected some', () => {
      insertRawNode(db, {
        id: 'apple-notes:302',
        name: 'No Tags Note 2',
        folder: 'Work',
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      const error = validator.validateTags('apple-notes:302', ['expected-tag']);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('tag_mismatch');
    });

    it('returns missing_node error for non-existent node', () => {
      const error = validator.validateTags('apple-notes:nonexistent', ['tag1']);
      expect(error).not.toBeNull();
      expect(error!.type).toBe('missing_node');
    });
  });

  // ---------------------------------------------------------------------------
  // validateNode (composite)
  // ---------------------------------------------------------------------------

  describe('validateNode', () => {
    const nodeTime = '2026-02-17T10:00:00.000Z';

    beforeEach(() => {
      insertRawNode(db, {
        id: 'apple-notes:400',
        name: 'Composite Test',
        folder: 'Family/Stacey',
        tags: JSON.stringify(['important']),
        created_at: nodeTime,
        modified_at: nodeTime,
      });
    });

    it('returns empty array when all fields match', () => {
      const errors = validator.validateNode('apple-notes:400', {
        folder: 'Family/Stacey',
        created: new Date(nodeTime),
        modified: new Date(nodeTime),
        tags: ['important'],
      });
      expect(errors).toHaveLength(0);
    });

    it('returns multiple errors when multiple fields mismatch', () => {
      const errors = validator.validateNode('apple-notes:400', {
        folder: 'Wrong/Folder',
        tags: ['wrong-tag'],
      });
      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.type)).toContain('folder_mismatch');
      expect(errors.map(e => e.type)).toContain('tag_mismatch');
    });

    it('validates only specified fields', () => {
      // Only validate folder, not tags or timestamps
      const errors = validator.validateNode('apple-notes:400', {
        folder: 'Family/Stacey',
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Full Source Validation
  // ---------------------------------------------------------------------------

  describe('Full Source Validation', () => {
    it('returns valid:true with correct stats for clean data', () => {
      // Insert 5 valid nodes
      for (let i = 1; i <= 5; i++) {
        insertRawNode(db, {
          id: `apple-notes:50${i}`,
          name: `Note ${i}`,
          folder: 'Work',
          tags: JSON.stringify(['tag1']),
          created_at: '2026-02-17T10:00:00.000Z',
          modified_at: '2026-02-17T10:00:00.000Z',
          source: 'apple-notes',
          source_id: `50${i}`,
        });
      }

      const result = validator.validateSource('apple-notes');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.nodesChecked).toBe(5);
      expect(result.stats.folderPathsVerified).toBe(5);
    });

    it('returns warnings (not errors) for orphan edges', () => {
      // Insert a node and an edge referencing a non-existent target
      insertRawNode(db, {
        id: 'apple-notes:600',
        name: 'Node with orphan edge',
        folder: 'Work',
        tags: null,
        created_at: '2026-02-17T10:00:00.000Z',
        modified_at: '2026-02-17T10:00:00.000Z',
      });

      // Disable FK enforcement to insert orphan edge for testing
      db.run(`PRAGMA foreign_keys = OFF`);
      db.run(
        `INSERT INTO edges (id, edge_type, source_id, target_id, weight, directed, created_at)
         VALUES ('orphan-edge-1', 'LINK', 'apple-notes:600', 'apple-notes:NONEXISTENT',
           1.0, 1, '2026-02-17T10:00:00.000Z')`
      );
      db.run(`PRAGMA foreign_keys = ON`);

      const result = validator.validateSource('apple-notes');

      // Orphan edges are warnings, not errors — result stays valid
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some(w => w.type === 'orphan_edge')).toBe(true);
    });

    it('returns valid:true for empty source', () => {
      const result = validator.validateSource('nonexistent-source');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.nodesChecked).toBe(0);
    });

    it('warns about duplicate source_ids', () => {
      // Insert two nodes with same source_id
      const dupCols = `id, node_type, name, folder, created_at, modified_at,
        source, source_id, priority, importance, sort_order, version`;
      const dupTime = '2026-02-17T10:00:00.000Z';
      db.run(
        `INSERT INTO nodes (${dupCols}) VALUES (
          'apple-notes:700a', 'note', 'Note A', 'Work', ?, ?, 'apple-notes', 'dup-id', 0, 0, 0, 1
        )`,
        [dupTime, dupTime]
      );
      db.run(
        `INSERT INTO nodes (${dupCols}) VALUES (
          'apple-notes:700b', 'note', 'Note B', 'Work', ?, ?, 'apple-notes', 'dup-id', 0, 0, 0, 1
        )`,
        [dupTime, dupTime]
      );

      const result = validator.validateSource('apple-notes');
      expect(result.warnings.some(w => w.type === 'duplicate_source_id')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Stacey Success Criterion E2E
  // ---------------------------------------------------------------------------

  describe('Stacey Success Criterion E2E', () => {
    it('confirms Family/Stacey folder path after NodeWriter persistence', () => {
      // Create CanonicalNode matching the real Apple Note
      const staceyNode = makeCanonicalNode({
        id: 'apple-notes:138083',
        source: 'apple-notes',
        sourceId: '138083',
        name: 'Under stress, Stacey channels mean Cindy',
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: [],
          status: 'active',
        },
        time: {
          created: new Date('2024-01-15T10:00:00.000Z'),
          modified: new Date('2024-01-16T11:00:00.000Z'),
        },
      });

      // Persist via NodeWriter (the full pipeline)
      const writer = createNodeWriter(db);
      const writeResult = writer.upsertNodes([staceyNode]);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.inserted).toBe(1);

      // Verify the node exists with correct folder
      const rows = execTestQuery(
        db,
        'SELECT folder, name, source FROM nodes WHERE id = ?',
        ['apple-notes:138083']
      );
      expect(rows).toHaveLength(1);

      const row = rows[0] as Record<string, unknown>;
      expect(row['name']).toBe('Under stress, Stacey channels mean Cindy');
      expect(row['source']).toBe('apple-notes');

      // THE CRITICAL ASSERTION: folder must be Family/Stacey
      expect(row['folder']).toBe('Family/Stacey');

      // Validate via DataIntegrityValidator
      const folderError = validator.validateFolderPath('apple-notes:138083', 'Family/Stacey');
      expect(folderError).toBeNull();

      // Validate it is NOT the alto-index.json bug folder
      const wrongFolderError = validator.validateFolderPath(
        'apple-notes:138083',
        'BairesDev/Operations'
      );
      expect(wrongFolderError).not.toBeNull();
      expect(wrongFolderError!.type).toBe('folder_mismatch');
    });

    it('validates Stacey note timestamps within tolerance', () => {
      const created = new Date('2024-01-15T10:00:00.000Z');
      const modified = new Date('2024-01-16T11:00:00.000Z');

      const staceyNode = makeCanonicalNode({
        id: 'apple-notes:138083',
        source: 'apple-notes',
        sourceId: '138083',
        name: 'Under stress, Stacey channels mean Cindy',
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: [],
          status: 'active',
        },
        time: { created, modified },
      });

      const writer = createNodeWriter(db);
      writer.upsertNodes([staceyNode]);

      // Timestamps should be within 1ms (exact ISO string round-trip)
      const createdError = validator.validateTimestamp(
        'apple-notes:138083',
        'created_at',
        created
      );
      const modifiedError = validator.validateTimestamp(
        'apple-notes:138083',
        'modified_at',
        modified
      );

      expect(createdError).toBeNull();
      expect(modifiedError).toBeNull();
    });

    it('validates full source after Stacey sync — valid:true', () => {
      const staceyNode = makeCanonicalNode({
        id: 'apple-notes:138083',
        source: 'apple-notes',
        sourceId: '138083',
        name: 'Under stress, Stacey channels mean Cindy',
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: [],
          status: 'active',
        },
      });

      const writer = createNodeWriter(db);
      writer.upsertNodes([staceyNode]);

      const result = validator.validateSource('apple-notes');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.nodesChecked).toBeGreaterThanOrEqual(1);
    });
  });
});
