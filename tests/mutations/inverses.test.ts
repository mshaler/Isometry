// Isometry v5 — Phase 4 Inverse SQL Generator Tests
// Tests for createCardMutation, updateCardMutation, deleteCardMutation,
// createConnectionMutation, deleteConnectionMutation, batchMutation.

import { describe, it, expect } from 'vitest';
import {
  createCardMutation,
  updateCardMutation,
  deleteCardMutation,
  createConnectionMutation,
  deleteConnectionMutation,
  batchMutation,
} from '../../src/mutations/inverses';
import type { Card } from '../../src/database/queries/types';
import type { Connection } from '../../src/database/queries/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FULL_CARD: Card = {
  id: 'card-001',
  card_type: 'note',
  name: 'Test Card',
  content: 'Some content',
  summary: 'A summary',
  latitude: 37.7749,
  longitude: -122.4194,
  location_name: 'San Francisco',
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  due_at: '2026-01-10T00:00:00Z',
  completed_at: null,
  event_start: null,
  event_end: null,
  folder: 'work',
  tags: ['alpha', 'beta'],
  status: 'open',
  priority: 2,
  sort_order: 5,
  url: 'https://example.com',
  mime_type: 'text/plain',
  is_collective: false,
  source: 'manual',
  source_id: 'src-001',
  source_url: 'https://source.example.com',
  deleted_at: null,
};

const FULL_CONNECTION: Connection = {
  id: 'conn-001',
  source_id: 'card-001',
  target_id: 'card-002',
  via_card_id: 'card-003',
  label: 'relates to',
  weight: 1.5,
  created_at: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// createCardMutation
// ---------------------------------------------------------------------------

describe('createCardMutation', () => {
  it('produces a Mutation with id, timestamp, description', () => {
    const m = createCardMutation({ name: 'Test' });
    expect(m.id).toBeTypeOf('string');
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.timestamp).toBeTypeOf('number');
    expect(m.description).toContain('Create card');
    expect(m.description).toContain('Test');
  });

  it('forward has INSERT INTO cards', () => {
    const m = createCardMutation({ name: 'My Card' });
    expect(m.forward).toHaveLength(1);
    expect(m.forward[0].sql).toMatch(/INSERT INTO cards/i);
  });

  it('inverse has DELETE FROM cards WHERE id = ?', () => {
    const m = createCardMutation({ name: 'My Card' });
    expect(m.inverse).toHaveLength(1);
    expect(m.inverse[0].sql).toMatch(/DELETE FROM cards WHERE id = \?/i);
  });

  it('generated card UUID appears in both forward and inverse params', () => {
    const m = createCardMutation({ name: 'UUID test' });
    const forwardId = m.forward[0].params[0] as string;
    expect(forwardId).toBeTypeOf('string');
    expect(forwardId).toMatch(/^[0-9a-f-]{36}$/);
    // Inverse DELETE uses same ID
    expect(m.inverse[0].params[0]).toBe(forwardId);
  });

  it('forward INSERT includes card_type defaulting to note', () => {
    const m = createCardMutation({ name: 'Note card' });
    // card_type column should be 'note'
    const sql = m.forward[0].sql;
    expect(sql).toMatch(/card_type/i);
    expect(m.forward[0].params).toContain('note');
  });

  it('respects provided card_type', () => {
    const m = createCardMutation({ name: 'Task card', card_type: 'task' });
    expect(m.forward[0].params).toContain('task');
  });

  it('tags are serialized to JSON string in forward params', () => {
    const m = createCardMutation({ name: 'Tagged', tags: ['a', 'b'] });
    const params = m.forward[0].params;
    const tagsParam = params.find(p => typeof p === 'string' && p.startsWith('['));
    expect(tagsParam).toBe('["a","b"]');
  });
});

// ---------------------------------------------------------------------------
// updateCardMutation
// ---------------------------------------------------------------------------

describe('updateCardMutation', () => {
  it('forward has UPDATE cards SET ... WHERE id = ?', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { name: 'New Name' });
    expect(m.forward[0].sql).toMatch(/UPDATE cards SET/i);
    expect(m.forward[0].sql).toMatch(/WHERE id = \?/i);
  });

  it('inverse has UPDATE cards SET ... WHERE id = ? with OLD values', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { name: 'New Name' });
    expect(m.inverse[0].sql).toMatch(/UPDATE cards SET/i);
    expect(m.inverse[0].sql).toMatch(/WHERE id = \?/i);
    // inverse should contain the OLD name
    const inverseParams = m.inverse[0].params;
    expect(inverseParams).toContain('Test Card'); // old name
    expect(inverseParams).toContain('card-001');  // WHERE id
  });

  it('forward params contain new values', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { name: 'New Name', status: 'done' });
    const forwardParams = m.forward[0].params;
    expect(forwardParams).toContain('New Name');
    expect(forwardParams).toContain('done');
    expect(forwardParams).toContain('card-001');
  });

  it('only includes changed fields — not all 25 columns', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { name: 'New Name' });
    // Only name and id (WHERE) in forward
    expect(m.forward[0].sql).toMatch(/name/i);
    expect(m.forward[0].sql).not.toMatch(/content/i);
    expect(m.forward[0].sql).not.toMatch(/summary/i);
  });

  it('handles multiple changed fields', () => {
    const m = updateCardMutation('card-001', FULL_CARD, {
      name: 'New Name',
      status: 'active',
    });
    expect(m.forward[0].sql).toMatch(/name/i);
    expect(m.forward[0].sql).toMatch(/status/i);
    // Both new values in forward
    expect(m.forward[0].params).toContain('New Name');
    expect(m.forward[0].params).toContain('active');
  });

  it('inverse contains old values for all changed fields', () => {
    const m = updateCardMutation('card-001', FULL_CARD, {
      name: 'New Name',
      status: 'active',
    });
    // Old values: name='Test Card', status='open'
    expect(m.inverse[0].params).toContain('Test Card');
    expect(m.inverse[0].params).toContain('open');
  });

  it('serializes tags to JSON string when tags are updated', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { tags: ['x', 'y'] });
    const forwardParams = m.forward[0].params;
    expect(forwardParams).toContain('["x","y"]');
    // inverse should restore old tags as JSON
    const inverseParams = m.inverse[0].params;
    expect(inverseParams).toContain('["alpha","beta"]');
  });

  it('has correct mutation id, timestamp, description', () => {
    const m = updateCardMutation('card-001', FULL_CARD, { name: 'X' });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.timestamp).toBeTypeOf('number');
    expect(m.description).toContain('Update card');
  });
});

// ---------------------------------------------------------------------------
// deleteCardMutation
// ---------------------------------------------------------------------------

describe('deleteCardMutation', () => {
  it('forward has DELETE FROM cards WHERE id = ?', () => {
    const m = deleteCardMutation(FULL_CARD);
    expect(m.forward[0].sql).toMatch(/DELETE FROM cards WHERE id = \?/i);
    expect(m.forward[0].params[0]).toBe('card-001');
  });

  it('inverse has INSERT INTO cards with ALL columns', () => {
    const m = deleteCardMutation(FULL_CARD);
    expect(m.inverse[0].sql).toMatch(/INSERT INTO cards/i);
  });

  it('inverse INSERT includes all 25 columns (id, card_type, name, ... deleted_at)', () => {
    const m = deleteCardMutation(FULL_CARD);
    const sql = m.inverse[0].sql;
    // Check key columns present
    const columns = [
      'id', 'card_type', 'name', 'content', 'summary',
      'latitude', 'longitude', 'location_name',
      'created_at', 'modified_at', 'due_at', 'completed_at',
      'event_start', 'event_end', 'folder', 'tags',
      'status', 'priority', 'sort_order', 'url',
      'mime_type', 'is_collective', 'source', 'source_id',
      'source_url', 'deleted_at',
    ];
    for (const col of columns) {
      expect(sql).toMatch(new RegExp(col, 'i'));
    }
  });

  it('inverse INSERT params include all field values from card', () => {
    const m = deleteCardMutation(FULL_CARD);
    const params = m.inverse[0].params;
    expect(params).toContain('card-001');
    expect(params).toContain('note');
    expect(params).toContain('Test Card');
    expect(params).toContain('Some content');
    expect(params).toContain(37.7749);
  });

  it('tags are serialized to JSON string in inverse INSERT', () => {
    const m = deleteCardMutation(FULL_CARD);
    const params = m.inverse[0].params;
    expect(params).toContain('["alpha","beta"]');
  });

  it('is_collective is stored as 0/1 in inverse INSERT', () => {
    const m = deleteCardMutation(FULL_CARD); // is_collective = false
    const params = m.inverse[0].params;
    expect(params).toContain(0);
    expect(params).not.toContain(false);

    const collective = deleteCardMutation({ ...FULL_CARD, is_collective: true });
    expect(collective.inverse[0].params).toContain(1);
    expect(collective.inverse[0].params).not.toContain(true);
  });

  it('has description mentioning card name', () => {
    const m = deleteCardMutation(FULL_CARD);
    expect(m.description).toContain('Delete card');
    expect(m.description).toContain('Test Card');
  });
});

// ---------------------------------------------------------------------------
// createConnectionMutation
// ---------------------------------------------------------------------------

describe('createConnectionMutation', () => {
  it('forward has INSERT INTO connections', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    expect(m.forward[0].sql).toMatch(/INSERT INTO connections/i);
  });

  it('inverse has DELETE FROM connections WHERE id = ?', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    expect(m.inverse[0].sql).toMatch(/DELETE FROM connections WHERE id = \?/i);
  });

  it('generated connection UUID appears in both forward and inverse', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    const forwardId = m.forward[0].params[0] as string;
    expect(forwardId).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.inverse[0].params[0]).toBe(forwardId);
  });

  it('includes source_id and target_id in forward params', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    expect(m.forward[0].params).toContain('a');
    expect(m.forward[0].params).toContain('b');
  });

  it('defaults optional fields (via_card_id, label, weight)', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    const params = m.forward[0].params;
    // Should have null for via_card_id and label, 1 for weight
    expect(params).toContain(null);
    expect(params).toContain(1);
  });

  it('has description mentioning connection', () => {
    const m = createConnectionMutation({ source_id: 'a', target_id: 'b' });
    expect(m.description).toMatch(/Create connection/i);
  });
});

// ---------------------------------------------------------------------------
// deleteConnectionMutation
// ---------------------------------------------------------------------------

describe('deleteConnectionMutation', () => {
  it('forward has DELETE FROM connections WHERE id = ?', () => {
    const m = deleteConnectionMutation(FULL_CONNECTION);
    expect(m.forward[0].sql).toMatch(/DELETE FROM connections WHERE id = \?/i);
    expect(m.forward[0].params[0]).toBe('conn-001');
  });

  it('inverse has INSERT INTO connections with all fields', () => {
    const m = deleteConnectionMutation(FULL_CONNECTION);
    expect(m.inverse[0].sql).toMatch(/INSERT INTO connections/i);
    const params = m.inverse[0].params;
    expect(params).toContain('conn-001');
    expect(params).toContain('card-001');
    expect(params).toContain('card-002');
    expect(params).toContain('card-003');
    expect(params).toContain('relates to');
    expect(params).toContain(1.5);
  });

  it('has description mentioning delete connection', () => {
    const m = deleteConnectionMutation(FULL_CONNECTION);
    expect(m.description).toMatch(/Delete connection/i);
  });
});

// ---------------------------------------------------------------------------
// batchMutation
// ---------------------------------------------------------------------------

describe('batchMutation', () => {
  it('concatenates all forward commands in order', () => {
    const m1 = createCardMutation({ name: 'Card A' });
    const m2 = createCardMutation({ name: 'Card B' });
    const batch = batchMutation('Create A and B', m1, m2);
    expect(batch.forward).toHaveLength(2);
    // forward[0] from m1, forward[1] from m2
    expect(batch.forward[0]).toEqual(m1.forward[0]);
    expect(batch.forward[1]).toEqual(m2.forward[0]);
  });

  it('concatenates inverse commands in REVERSED order', () => {
    const m1 = createCardMutation({ name: 'Card A' });
    const m2 = createCardMutation({ name: 'Card B' });
    const batch = batchMutation('Create A and B', m1, m2);
    // inverse: [undoB, undoA]
    expect(batch.inverse).toHaveLength(2);
    expect(batch.inverse[0]).toEqual(m2.inverse[0]); // undoB first
    expect(batch.inverse[1]).toEqual(m1.inverse[0]); // undoA second
  });

  it('handles three mutations in correct order', () => {
    const mA = createCardMutation({ name: 'A' });
    const mB = createCardMutation({ name: 'B' });
    const mC = createCardMutation({ name: 'C' });
    const batch = batchMutation('Create A, B, C', mA, mB, mC);
    expect(batch.forward).toHaveLength(3);
    expect(batch.forward[0]).toEqual(mA.forward[0]);
    expect(batch.forward[1]).toEqual(mB.forward[0]);
    expect(batch.forward[2]).toEqual(mC.forward[0]);
    // inverse: [undoC, undoB, undoA]
    expect(batch.inverse[0]).toEqual(mC.inverse[0]);
    expect(batch.inverse[1]).toEqual(mB.inverse[0]);
    expect(batch.inverse[2]).toEqual(mA.inverse[0]);
  });

  it('uses provided description', () => {
    const m = createCardMutation({ name: 'A' });
    const batch = batchMutation('Batch description', m);
    expect(batch.description).toBe('Batch description');
  });

  it('returns a Mutation with uuid and timestamp', () => {
    const m = createCardMutation({ name: 'A' });
    const batch = batchMutation('Batch', m);
    expect(batch.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(batch.timestamp).toBeTypeOf('number');
  });
});
