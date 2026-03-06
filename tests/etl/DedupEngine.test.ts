// Isometry v5 — Phase 8 DedupEngine Tests
// Validates deduplication classification logic for idempotent re-import

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { DedupEngine } from '../../src/etl/DedupEngine';
import type { CanonicalCard, CanonicalConnection } from '../../src/etl/types';

describe('DedupEngine', () => {
  let db: Database;
  let engine: DedupEngine;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
    engine = new DedupEngine(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('card classification', () => {
    it('classifies new cards as insert', () => {
      const cards: CanonicalCard[] = [
        createCard('note-1', 'New Note', '2026-03-01T12:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.toInsert).toHaveLength(1);
      expect(result.toInsert[0].source_id).toBe('note-1');
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toSkip).toHaveLength(0);
    });

    it('classifies existing cards with newer timestamp as update', () => {
      // Insert existing card
      const existingId = 'existing-uuid';
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [existingId, 'note', 'Old Version', 'Old content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'New Version', '2026-03-01T12:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.toInsert).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe(existingId); // Should use existing UUID
      expect(result.toUpdate[0].source_id).toBe('note-1');
      expect(result.toSkip).toHaveLength(0);
    });

    it('classifies existing cards with same timestamp as skip', () => {
      // Insert existing card
      const timestamp = '2026-03-01T12:00:00Z';
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['existing-uuid', 'note', 'Same Version', 'Same content', timestamp, timestamp, 'apple_notes', 'note-1']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'Same Version', timestamp),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.toInsert).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toSkip).toHaveLength(1);
      expect(result.toSkip[0].source_id).toBe('note-1');
    });

    it('classifies existing cards with older timestamp as skip', () => {
      // Insert existing card with newer timestamp
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['existing-uuid', 'note', 'Newer Version', 'Newer content', '2026-03-01T10:00:00Z', '2026-03-01T14:00:00Z', 'apple_notes', 'note-1']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'Older Version', '2026-03-01T12:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.toInsert).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toSkip).toHaveLength(1);
    });

    it('handles mixed insert/update/skip in single batch', () => {
      // Insert two existing cards
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-1', 'note', 'Note 1', 'Content 1', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-2', 'note', 'Note 2', 'Content 2', '2026-03-01T10:00:00Z', '2026-03-01T12:00:00Z', 'apple_notes', 'note-2']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'Note 1 Updated', '2026-03-01T11:00:00Z'), // Update (newer)
        createCard('note-2', 'Note 2 Same', '2026-03-01T12:00:00Z'), // Skip (same)
        createCard('note-3', 'Note 3 New', '2026-03-01T13:00:00Z'), // Insert (new)
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.toInsert).toHaveLength(1);
      expect(result.toInsert[0].source_id).toBe('note-3');
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].source_id).toBe('note-1');
      expect(result.toSkip).toHaveLength(1);
      expect(result.toSkip[0].source_id).toBe('note-2');
    });
  });

  describe('sourceIdMap building', () => {
    it('builds sourceIdMap for new cards', () => {
      const cardId = 'temp-uuid-1';
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'New Note', '2026-03-01T12:00:00Z'), id: cardId },
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.sourceIdMap.get('note-1')).toBe(cardId);
    });

    it('builds sourceIdMap for existing cards', () => {
      const existingId = 'existing-uuid';
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [existingId, 'note', 'Existing Note', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'Same Note', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.sourceIdMap.get('note-1')).toBe(existingId);
    });

    it('builds sourceIdMap for all cards in batch', () => {
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'Note 1', '2026-03-01T12:00:00Z'), id: 'uuid-1' },
        { ...createCard('note-2', 'Note 2', '2026-03-01T12:00:00Z'), id: 'uuid-2' },
        { ...createCard('note-3', 'Note 3', '2026-03-01T12:00:00Z'), id: 'uuid-3' },
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.sourceIdMap.size).toBe(3);
      expect(result.sourceIdMap.get('note-1')).toBe('uuid-1');
      expect(result.sourceIdMap.get('note-2')).toBe('uuid-2');
      expect(result.sourceIdMap.get('note-3')).toBe('uuid-3');
    });
  });

  describe('connection resolution', () => {
    it('resolves connection source and target IDs via sourceIdMap', () => {
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'Note 1', '2026-03-01T12:00:00Z'), id: 'uuid-1' },
        { ...createCard('note-2', 'Note 2', '2026-03-01T12:00:00Z'), id: 'uuid-2' },
      ];

      const connections: CanonicalConnection[] = [
        {
          id: 'conn-1',
          source_id: 'note-1',
          target_id: 'note-2',
          via_card_id: null,
          label: 'links to',
          weight: 1.0,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];

      const result = engine.process(cards, connections, 'apple_notes');

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].source_id).toBe('uuid-1');
      expect(result.connections[0].target_id).toBe('uuid-2');
    });

    it('resolves via_card_id when present', () => {
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'Note 1', '2026-03-01T12:00:00Z'), id: 'uuid-1' },
        { ...createCard('note-2', 'Note 2', '2026-03-01T12:00:00Z'), id: 'uuid-2' },
        { ...createCard('note-3', 'Note 3', '2026-03-01T12:00:00Z'), id: 'uuid-3' },
      ];

      const connections: CanonicalConnection[] = [
        {
          id: 'conn-1',
          source_id: 'note-1',
          target_id: 'note-2',
          via_card_id: 'note-3',
          label: null,
          weight: 1.0,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];

      const result = engine.process(cards, connections, 'apple_notes');

      expect(result.connections[0].via_card_id).toBe('uuid-3');
    });

    it('drops connections with unresolvable source', () => {
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'Note 1', '2026-03-01T12:00:00Z'), id: 'uuid-1' },
      ];

      const connections: CanonicalConnection[] = [
        {
          id: 'conn-1',
          source_id: 'note-missing',
          target_id: 'note-1',
          via_card_id: null,
          label: null,
          weight: 1.0,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];

      const result = engine.process(cards, connections, 'apple_notes');

      expect(result.connections).toHaveLength(0);
    });

    it('drops connections with unresolvable target', () => {
      const cards: CanonicalCard[] = [
        { ...createCard('note-1', 'Note 1', '2026-03-01T12:00:00Z'), id: 'uuid-1' },
      ];

      const connections: CanonicalConnection[] = [
        {
          id: 'conn-1',
          source_id: 'note-1',
          target_id: 'note-missing',
          via_card_id: null,
          label: null,
          weight: 1.0,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];

      const result = engine.process(cards, connections, 'apple_notes');

      expect(result.connections).toHaveLength(0);
    });

    it('preserves connections with already-resolved UUIDs', () => {
      // Re-importing cards that already have connections
      const existingId1 = 'existing-uuid-1';
      const existingId2 = 'existing-uuid-2';
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [existingId1, 'note', 'Existing Note 1', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [existingId2, 'note', 'Existing Note 2', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-2']
      );

      // Re-import the same cards (no changes)
      const cards: CanonicalCard[] = [
        createCard('note-1', 'Existing Note 1', '2026-03-01T10:00:00Z'),
        createCard('note-2', 'Existing Note 2', '2026-03-01T10:00:00Z'),
      ];

      // Connection uses source_ids (not UUIDs)
      const connections: CanonicalConnection[] = [
        {
          id: 'conn-1',
          source_id: 'note-1',
          target_id: 'note-2',
          via_card_id: null,
          label: 'links to',
          weight: 1.0,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];

      const result = engine.process(cards, connections, 'apple_notes');

      // Connection should be resolved to existing UUIDs
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].source_id).toBe(existingId1);
      expect(result.connections[0].target_id).toBe(existingId2);
    });
  });

  describe('deleted card detection', () => {
    it('detects cards in DB for source type but absent from incoming set', () => {
      // Insert 3 existing cards for apple_notes
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-1', 'note', 'Note 1', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-2', 'note', 'Note 2', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-2']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-3', 'note', 'Note 3', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-3']
      );

      // Re-import only note-1 and note-2 (note-3 is missing -> deleted)
      const cards: CanonicalCard[] = [
        createCard('note-1', 'Note 1', '2026-03-01T10:00:00Z'),
        createCard('note-2', 'Note 2', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.deletedIds).toHaveLength(1);
      expect(result.deletedIds).toContain('uuid-3');
    });

    it('does NOT include cards from different source types in deletedIds', () => {
      // Insert cards for two different source types
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-an', 'note', 'Apple Note', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-md', 'note', 'Markdown Note', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'markdown', 'md-1']
      );

      // Import apple_notes with only note-1 (markdown card should NOT be in deletedIds)
      const cards: CanonicalCard[] = [
        createCard('note-1', 'Apple Note', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.deletedIds).toHaveLength(0);
    });

    it('does NOT include already soft-deleted cards in deletedIds', () => {
      // Insert an existing card and a soft-deleted card
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-1', 'note', 'Active Note', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-2', 'note', 'Deleted Note', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-2', '2026-03-01T11:00:00Z']
      );

      // Import only note-1 (note-2 is already deleted, should NOT appear again)
      const cards: CanonicalCard[] = [
        createCard('note-1', 'Active Note', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.deletedIds).toHaveLength(0);
    });

    it('returns empty deletedIds when all existing cards are in incoming set', () => {
      db.run(
        `INSERT INTO cards (id, card_type, name, content, created_at, modified_at, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['uuid-1', 'note', 'Note 1', 'Content', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'apple_notes', 'note-1']
      );

      const cards: CanonicalCard[] = [
        createCard('note-1', 'Note 1', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.deletedIds).toHaveLength(0);
    });

    it('returns empty deletedIds when no existing cards for source type', () => {
      const cards: CanonicalCard[] = [
        createCard('note-1', 'New Note', '2026-03-01T10:00:00Z'),
      ];

      const result = engine.process(cards, [], 'apple_notes');

      expect(result.deletedIds).toHaveLength(0);
    });
  });

  describe('SQL injection safety', () => {
    it('handles malicious source_id safely via parameterized query', () => {
      // Attempt SQL injection via source_id
      const maliciousSourceId = "'; DROP TABLE cards;--";
      const cards: CanonicalCard[] = [
        { ...createCard(maliciousSourceId, 'Malicious Note', '2026-03-01T12:00:00Z') },
      ];

      // Should not throw or corrupt database
      expect(() => {
        engine.process(cards, [], 'apple_notes');
      }).not.toThrow();

      // Verify cards table still exists
      const result = db.exec('SELECT COUNT(*) as count FROM cards');
      expect(result[0].values[0][0]).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper to create a minimal CanonicalCard
function createCard(sourceId: string, name: string, modifiedAt: string): CanonicalCard {
  return {
    id: `temp-${sourceId}`,
    card_type: 'note',
    name,
    content: `Content for ${name}`,
    summary: null,
    latitude: null,
    longitude: null,
    location_name: null,
    created_at: modifiedAt,
    modified_at: modifiedAt,
    due_at: null,
    completed_at: null,
    event_start: null,
    event_end: null,
    folder: null,
    tags: [],
    status: null,
    priority: 0,
    sort_order: 0,
    url: null,
    mime_type: null,
    is_collective: false,
    source: 'apple_notes',
    source_id: sourceId,
    source_url: null,
    deleted_at: null,
  };
}
