/**
 * NodeWriter Service Tests
 *
 * Tests for CanonicalNode/CanonicalEdge persistence to sql.js database.
 * Uses in-memory sql.js for fast, isolated test runs.
 *
 * Phase 117-02
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'sql.js-fts5';

import { createTestDB, cleanupTestDB, execTestQuery } from '../../../test/db-utils';
import { createNodeWriter } from '../NodeWriter';
import { CanonicalNode, CanonicalEdge } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function makeCanonicalNode(overrides: Partial<CanonicalNode> = {}): CanonicalNode {
  return {
    id: 'apple-notes:1001',
    source: 'apple-notes',
    sourceId: '1001',
    sourceUrl: 'x-coredata://apple-notes/1001',
    nodeType: 'note',
    name: 'Test Note',
    content: '# Test Note\n\nSome content here.',
    summary: 'Some content here.',
    time: {
      created: new Date('2024-01-15T10:00:00Z'),
      modified: new Date('2024-01-16T11:00:00Z'),
    },
    category: {
      hierarchy: ['Family', 'Stacey'],
      tags: ['important', 'review'],
      status: 'active',
    },
    hierarchy: {
      priority: 2,
      importance: 3,
      sortOrder: 0,
    },
    ...overrides,
  };
}

function makeCanonicalEdge(overrides: Partial<CanonicalEdge> = {}): CanonicalEdge {
  return {
    id: 'nest:apple-notes:folder:Family/Stacey:apple-notes:1001',
    edgeType: 'NEST',
    sourceId: 'apple-notes:folder:Family/Stacey',
    targetId: 'apple-notes:1001',
    label: 'contains',
    weight: 1.0,
    directed: true,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('NodeWriter', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  // ---------------------------------------------------------------------------
  // upsertNodes
  // ---------------------------------------------------------------------------

  describe('upsertNodes', () => {
    it('inserts new nodes correctly', () => {
      const writer = createNodeWriter(db);
      const node = makeCanonicalNode();

      const result = writer.upsertNodes([node]);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify the node is in the database
      const rows = execTestQuery(db, 'SELECT * FROM nodes WHERE id = ?', [node.id]);
      expect(rows).toHaveLength(1);

      const row = rows[0] as Record<string, unknown>;
      expect(row['id']).toBe('apple-notes:1001');
      expect(row['name']).toBe('Test Note');
      expect(row['source']).toBe('apple-notes');
      expect(row['source_id']).toBe('1001');
    });

    it('updates existing nodes with same source_id', () => {
      const writer = createNodeWriter(db);
      const node = makeCanonicalNode();

      // Insert first
      writer.upsertNodes([node]);

      // Update with same node (different name)
      const updatedNode = makeCanonicalNode({ name: 'Updated Test Note' });
      const result = writer.upsertNodes([updatedNode]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify updated name in DB
      const rows = execTestQuery(db, 'SELECT name FROM nodes WHERE id = ?', [node.id]);
      expect(rows).toHaveLength(1);
      expect((rows[0] as Record<string, unknown>)['name']).toBe('Updated Test Note');
    });

    it('maps folder hierarchy from category.hierarchy', () => {
      const writer = createNodeWriter(db);
      const node = makeCanonicalNode({
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: ['tag1'],
          status: 'active',
        },
      });

      writer.upsertNodes([node]);

      const rows = execTestQuery(db, 'SELECT folder FROM nodes WHERE id = ?', [node.id]);
      expect((rows[0] as Record<string, unknown>)['folder']).toBe('Family/Stacey');
    });

    it('maps tags as JSON array', () => {
      const writer = createNodeWriter(db);
      const node = makeCanonicalNode({
        category: {
          hierarchy: ['Work'],
          tags: ['important', 'review', 'urgent'],
          status: 'active',
        },
      });

      writer.upsertNodes([node]);

      const rows = execTestQuery(db, 'SELECT tags FROM nodes WHERE id = ?', [node.id]);
      const tagsJson = (rows[0] as Record<string, unknown>)['tags'] as string;
      const tags = JSON.parse(tagsJson) as string[];
      expect(tags).toEqual(['important', 'review', 'urgent']);
    });

    it('maps created_at and modified_at correctly', () => {
      const writer = createNodeWriter(db);
      const created = new Date('2024-01-15T10:00:00.000Z');
      const modified = new Date('2024-01-16T11:00:00.000Z');
      const node = makeCanonicalNode({
        time: { created, modified },
      });

      writer.upsertNodes([node]);

      const rows = execTestQuery(db, 'SELECT created_at, modified_at FROM nodes WHERE id = ?', [node.id]);
      const row = rows[0] as Record<string, unknown>;
      expect(row['created_at']).toBe(created.toISOString());
      expect(row['modified_at']).toBe(modified.toISOString());
    });

    it('inserts multiple nodes in a single call', () => {
      const writer = createNodeWriter(db);
      const nodes = [
        makeCanonicalNode({ id: 'apple-notes:1001', sourceId: '1001', name: 'Note 1' }),
        makeCanonicalNode({ id: 'apple-notes:1002', sourceId: '1002', name: 'Note 2' }),
        makeCanonicalNode({ id: 'apple-notes:1003', sourceId: '1003', name: 'Note 3' }),
      ];

      const result = writer.upsertNodes(nodes);

      expect(result.inserted).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      const rows = execTestQuery(db, 'SELECT COUNT(*) as cnt FROM nodes WHERE source = ?', ['apple-notes']);
      // Count includes pre-existing test data, so check >= 3
      const cnt = (rows[0] as Record<string, unknown>)['cnt'] as number;
      expect(cnt).toBeGreaterThanOrEqual(3);
    });

    it('returns empty WriteResult for empty array', () => {
      const writer = createNodeWriter(db);
      const result = writer.upsertNodes([]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertEdges
  // ---------------------------------------------------------------------------

  describe('upsertEdges', () => {
    it('inserts NEST edges correctly', () => {
      const writer = createNodeWriter(db);

      // First insert the nodes that the edge references
      const folderNode = makeCanonicalNode({
        id: 'apple-notes:folder:Family/Stacey',
        sourceId: 'Family/Stacey',
        nodeType: 'project',
        name: 'Stacey',
        category: { hierarchy: ['Family'], tags: [], status: 'active' },
      });
      const noteNode = makeCanonicalNode();
      writer.upsertNodes([folderNode, noteNode]);

      const edge = makeCanonicalEdge();
      const result = writer.upsertEdges([edge]);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      const rows = execTestQuery(db, 'SELECT * FROM edges WHERE id = ?', [edge.id]);
      expect(rows).toHaveLength(1);
      const row = rows[0] as Record<string, unknown>;
      expect(row['edge_type']).toBe('NEST');
      expect(row['source_id']).toBe('apple-notes:folder:Family/Stacey');
      expect(row['target_id']).toBe('apple-notes:1001');
    });

    it('updates existing edges on re-upsert', () => {
      const writer = createNodeWriter(db);

      // Insert prerequisite nodes
      const folderNode = makeCanonicalNode({
        id: 'apple-notes:folder:Family/Stacey',
        sourceId: 'Family/Stacey',
        nodeType: 'project',
        name: 'Stacey',
        category: { hierarchy: ['Family'], tags: [], status: 'active' },
      });
      const noteNode = makeCanonicalNode();
      writer.upsertNodes([folderNode, noteNode]);

      const edge = makeCanonicalEdge();
      writer.upsertEdges([edge]);

      const result = writer.upsertEdges([edge]);
      expect(result.updated).toBe(1);
      expect(result.inserted).toBe(0);
    });

    it('returns empty WriteResult for empty array', () => {
      const writer = createNodeWriter(db);
      const result = writer.upsertEdges([]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // softDeleteBySource
  // ---------------------------------------------------------------------------

  describe('softDeleteBySource', () => {
    it('marks stale nodes as deleted', () => {
      const writer = createNodeWriter(db);

      // Insert 3 nodes
      writer.upsertNodes([
        makeCanonicalNode({ id: 'apple-notes:1001', sourceId: '1001', name: 'Note 1' }),
        makeCanonicalNode({ id: 'apple-notes:1002', sourceId: '1002', name: 'Note 2' }),
        makeCanonicalNode({ id: 'apple-notes:1003', sourceId: '1003', name: 'Note 3' }),
      ]);

      // Keep only notes 1001 and 1002, soft-delete 1003
      const deleted = writer.softDeleteBySource('apple-notes', [
        'apple-notes:1001',
        'apple-notes:1002',
      ]);

      expect(deleted).toBe(1);

      // Verify 1003 is soft-deleted
      const rows = execTestQuery(db, 'SELECT deleted_at FROM nodes WHERE id = ?', ['apple-notes:1003']);
      expect((rows[0] as Record<string, unknown>)['deleted_at']).not.toBeNull();

      // Verify 1001 and 1002 are NOT soft-deleted
      const activeRows = execTestQuery(
        db,
        'SELECT id FROM nodes WHERE source = ? AND deleted_at IS NULL',
        ['apple-notes']
      );
      const activeIds = activeRows.map(r => (r as Record<string, unknown>)['id']);
      expect(activeIds).toContain('apple-notes:1001');
      expect(activeIds).toContain('apple-notes:1002');
      expect(activeIds).not.toContain('apple-notes:1003');
    });

    it('soft-deletes all nodes when keepIds is empty', () => {
      const writer = createNodeWriter(db);

      writer.upsertNodes([
        makeCanonicalNode({ id: 'apple-notes:2001', sourceId: '2001', name: 'Note A' }),
        makeCanonicalNode({ id: 'apple-notes:2002', sourceId: '2002', name: 'Note B' }),
      ]);

      const deleted = writer.softDeleteBySource('apple-notes', []);
      expect(deleted).toBeGreaterThanOrEqual(2);

      const activeRows = execTestQuery(
        db,
        'SELECT id FROM nodes WHERE source = ? AND deleted_at IS NULL',
        ['apple-notes']
      );
      expect(activeRows).toHaveLength(0);
    });

    it('does not affect nodes from other sources', () => {
      const writer = createNodeWriter(db);

      writer.upsertNodes([
        makeCanonicalNode({ id: 'apple-notes:3001', sourceId: '3001', source: 'apple-notes' }),
        makeCanonicalNode({ id: 'obsidian:3001', sourceId: '3001', source: 'obsidian', name: 'Obsidian Note' }),
      ]);

      writer.softDeleteBySource('apple-notes', []);

      const obsidianRows = execTestQuery(
        db,
        'SELECT deleted_at FROM nodes WHERE id = ?',
        ['obsidian:3001']
      );
      expect((obsidianRows[0] as Record<string, unknown>)['deleted_at']).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Transaction rollback
  // ---------------------------------------------------------------------------

  describe('transaction rollback', () => {
    it('rolls back and populates errors on transaction failure', () => {
      const writer = createNodeWriter(db);

      // Insert a node with an invalid field that causes SQL error by directly
      // overriding the db.run to fail mid-transaction
      const originalRun = db.run.bind(db);
      let callCount = 0;
      const failingRun = (...args: Parameters<typeof db.run>) => {
        callCount++;
        // BEGIN is call 1, first node INSERT is call 2 — fail on node insert
        if (callCount === 2) {
          throw new Error('Simulated SQL error mid-batch');
        }
        return originalRun(...args);
      };
      db.run = failingRun as typeof db.run;

      const node = makeCanonicalNode({ id: 'apple-notes:fail-1', sourceId: 'fail-1' });
      const result = writer.upsertNodes([node]);

      // Restore original
      db.run = originalRun;

      // Transaction should have rolled back
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);

      // Verify no partial writes
      const rows = execTestQuery(db, 'SELECT id FROM nodes WHERE id = ?', ['apple-notes:fail-1']);
      expect(rows).toHaveLength(0);
    });
  });
});
