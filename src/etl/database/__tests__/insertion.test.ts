/**
 * Tests for insertCanonicalNodes() database utility
 *
 * Updated in Phase 84 to verify cards table insertion.
 *
 * Verifies:
 * - Single card insertion with correct field mapping
 * - nodeType -> card_type mapping
 * - Batch insertion with transaction support
 * - Tags array serialization as JSON
 * - Properties storage via card_properties EAV table
 * - Transaction rollback on error
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createTestDB, cleanupTestDB, execTestQuery } from '@/test/db-utils';
import { insertCanonicalNodes, InsertResult } from '../insertion';
import { CanonicalNode } from '../../types/canonical';
import type { Database } from 'sql.js-fts5';

/**
 * Helper to create a valid CanonicalNode for testing.
 */
function createTestNode(overrides?: Partial<CanonicalNode>): CanonicalNode {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    nodeType: 'note',
    name: 'Test Node',
    content: 'Test content',
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: now,
    modifiedAt: now,
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: null,
    tags: [],
    status: null,
    priority: 0,
    importance: 0,
    sortOrder: 0,
    gridX: 0,
    gridY: 0,
    source: 'test',
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
    properties: {},
    ...overrides,
  };
}

describe('insertCanonicalNodes', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    if (db) {
      await cleanupTestDB(db);
    }
  });

  it('inserts single card with correct fields', async () => {
    const node = createTestNode({
      name: 'Single Card Test',
      content: 'Test content for single card',
      folder: 'test-folder',
      priority: 3,
    });

    const result = await insertCanonicalNodes(db, [node]);

    expect(result.inserted).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify card exists in database with correct fields (Phase 84: cards table)
    const rows = execTestQuery(db, 'SELECT * FROM cards WHERE id = ?', [node.id]);
    expect(rows).toHaveLength(1);

    const dbCard = rows[0] as Record<string, unknown>;
    expect(dbCard.name).toBe('Single Card Test');
    expect(dbCard.content).toBe('Test content for single card');
    expect(dbCard.folder).toBe('test-folder');
    expect(dbCard.priority).toBe(3);
    expect(dbCard.card_type).toBe('note'); // Phase 84: card_type not node_type
  });

  it('maps nodeType to card_type correctly', async () => {
    const testCases = [
      { nodeType: 'note', expected: 'note' },
      { nodeType: 'task', expected: 'note' },
      { nodeType: 'document', expected: 'note' },
      { nodeType: 'person', expected: 'person' },
      { nodeType: 'contact', expected: 'person' },
      { nodeType: 'event', expected: 'event' },
      { nodeType: 'meeting', expected: 'event' },
      { nodeType: 'resource', expected: 'resource' },
      { nodeType: 'link', expected: 'resource' },
      { nodeType: 'file', expected: 'resource' },
    ];

    for (const { nodeType, expected } of testCases) {
      const node = createTestNode({ nodeType });
      await insertCanonicalNodes(db, [node]);

      const rows = execTestQuery(db, 'SELECT card_type FROM cards WHERE id = ?', [node.id]);
      expect(rows).toHaveLength(1);
      expect((rows[0] as { card_type: string }).card_type).toBe(expected);
    }
  });

  it('handles batch insertion', async () => {
    const nodes: CanonicalNode[] = [];
    for (let i = 1; i <= 5; i++) {
      nodes.push(
        createTestNode({
          name: `Batch Card ${i}`,
          priority: i,
        })
      );
    }

    const result = await insertCanonicalNodes(db, nodes, { transaction: true });

    expect(result.inserted).toBe(5);
    expect(result.failed).toBe(0);

    // Verify all 5 exist in cards table (Phase 84)
    const rows = execTestQuery(db, 'SELECT COUNT(*) as count FROM cards');
    expect((rows[0] as { count: number }).count).toBe(5);
  });

  it('serializes tags as JSON', async () => {
    const node = createTestNode({
      tags: ['tag1', 'tag2', 'tag3'],
    });

    await insertCanonicalNodes(db, [node]);

    // Query back and verify tags column contains JSON string (Phase 84: cards table)
    const rows = execTestQuery(db, 'SELECT tags FROM cards WHERE id = ?', [node.id]);
    expect(rows).toHaveLength(1);

    const dbCard = rows[0] as { tags: string };
    expect(dbCard.tags).toBe('["tag1","tag2","tag3"]');
  });

  it('stores empty tags as null', async () => {
    const node = createTestNode({
      tags: [],
    });

    await insertCanonicalNodes(db, [node]);

    const rows = execTestQuery(db, 'SELECT tags FROM cards WHERE id = ?', [node.id]);
    expect(rows).toHaveLength(1);

    const dbCard = rows[0] as { tags: string | null };
    expect(dbCard.tags).toBeNull();
  });

  it('stores properties via card_properties EAV table', async () => {
    const node = createTestNode({
      properties: {
        custom_key: 'custom value',
        numeric_prop: 42,
        array_prop: [1, 2, 3],
      },
    });

    await insertCanonicalNodes(db, [node]);

    // Query card_properties table (Phase 84: renamed from node_properties)
    const rows = execTestQuery(
      db,
      'SELECT key, value, value_type FROM card_properties WHERE card_id = ? ORDER BY key',
      [node.id]
    );

    expect(rows).toHaveLength(3);

    const props = rows as Array<{ key: string; value: string; value_type: string }>;

    // array_prop
    expect(props[0].key).toBe('array_prop');
    expect(props[0].value).toBe('[1,2,3]');
    expect(props[0].value_type).toBe('array');

    // custom_key
    expect(props[1].key).toBe('custom_key');
    expect(props[1].value).toBe('"custom value"');
    expect(props[1].value_type).toBe('string');

    // numeric_prop
    expect(props[2].key).toBe('numeric_prop');
    expect(props[2].value).toBe('42');
    expect(props[2].value_type).toBe('number');
  });

  it('rolls back transaction on duplicate id error', async () => {
    const cardId = uuidv4();

    // First card
    const node1 = createTestNode({
      id: cardId,
      name: 'First Card',
    });

    // Second card with SAME id (will cause error)
    const node2 = createTestNode({
      id: cardId,
      name: 'Second Card',
    });

    // Insert in transaction mode
    const result = await insertCanonicalNodes(db, [node1, node2], { transaction: true });

    // Transaction should have rolled back
    expect(result.inserted).toBe(0);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('UNIQUE constraint failed');

    // Verify first card NOT in database (rollback) - Phase 84: cards table
    const rows = execTestQuery(db, 'SELECT * FROM cards WHERE id = ?', [cardId]);
    expect(rows).toHaveLength(0);
  });

  it('handles empty node array', async () => {
    const result = await insertCanonicalNodes(db, []);

    expect(result.inserted).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('continues on error in non-transaction mode', async () => {
    const cardId = uuidv4();

    const node1 = createTestNode({ name: 'Card 1' });
    const node2 = createTestNode({ id: cardId, name: 'Card 2' });
    const node3 = createTestNode({ id: cardId, name: 'Card 3 (dup)' }); // Duplicate
    const node4 = createTestNode({ name: 'Card 4' });

    const result = await insertCanonicalNodes(db, [node1, node2, node3, node4], {
      transaction: false,
    });

    // 3 should succeed, 1 should fail
    expect(result.inserted).toBe(3);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);

    // Verify cards 1, 2, and 4 exist (card 3 failed as duplicate) - Phase 84: cards table
    const count = execTestQuery(db, 'SELECT COUNT(*) as count FROM cards') as [{ count: number }];
    expect(count[0].count).toBe(3);
  });

  it('handles properties with null value', async () => {
    const node = createTestNode({
      properties: {
        null_prop: null,
      },
    });

    await insertCanonicalNodes(db, [node]);

    // Phase 84: card_properties table
    const rows = execTestQuery(
      db,
      'SELECT key, value, value_type FROM card_properties WHERE card_id = ?',
      [node.id]
    );

    expect(rows).toHaveLength(1);
    const prop = rows[0] as { key: string; value: string; value_type: string };
    expect(prop.key).toBe('null_prop');
    expect(prop.value).toBe('null');
    expect(prop.value_type).toBe('null');
  });

  it('handles object properties', async () => {
    const node = createTestNode({
      properties: {
        nested: { a: 1, b: 'two' },
      },
    });

    await insertCanonicalNodes(db, [node]);

    // Phase 84: card_properties table
    const rows = execTestQuery(
      db,
      'SELECT key, value, value_type FROM card_properties WHERE card_id = ?',
      [node.id]
    );

    expect(rows).toHaveLength(1);
    const prop = rows[0] as { key: string; value: string; value_type: string };
    expect(prop.key).toBe('nested');
    expect(prop.value).toBe('{"a":1,"b":"two"}');
    expect(prop.value_type).toBe('object');
  });
});
