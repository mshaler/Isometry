import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import {
  createCard,
  getCard,
  updateCard,
  deleteCard,
  listCards,
  undeleteCard,
} from '../../src/database/queries/cards';
import type { CardInput } from '../../src/database/queries/types';

// ---------------------------------------------------------------------------
// Shared setup: fresh DB per test
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(async () => {
  db = new Database();
  await db.initialize();
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// CARD-01: Create a card
// ---------------------------------------------------------------------------
describe('CARD-01: createCard', () => {
  it('createCard with name only returns a Card with generated UUID id', async () => {
    const card = createCard(db, { name: 'Test Card' });
    expect(card.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(card.name).toBe('Test Card');
    expect(card.card_type).toBe('note'); // default
  });

  it('createCard with all optional fields stores and returns them correctly', async () => {
    const input: CardInput = {
      card_type: 'task',
      name: 'Full Card',
      content: 'Some content',
      summary: 'A summary',
      folder: 'work',
      tags: ['tag1', 'tag2'],
      status: 'active',
      priority: 2,
      sort_order: 5,
      url: 'https://example.com',
      mime_type: 'text/plain',
      is_collective: true,
      source: 'import',
      source_id: 'ext-123',
      source_url: 'https://source.com',
      due_at: '2026-03-01T00:00:00Z',
      completed_at: null,
      event_start: null,
      event_end: null,
      latitude: 37.7749,
      longitude: -122.4194,
      location_name: 'San Francisco',
    };
    const card = createCard(db, input);
    expect(card.card_type).toBe('task');
    expect(card.name).toBe('Full Card');
    expect(card.content).toBe('Some content');
    expect(card.summary).toBe('A summary');
    expect(card.folder).toBe('work');
    expect(card.tags).toEqual(['tag1', 'tag2']);
    expect(card.status).toBe('active');
    expect(card.priority).toBe(2);
    expect(card.sort_order).toBe(5);
    expect(card.url).toBe('https://example.com');
    expect(card.mime_type).toBe('text/plain');
    expect(card.is_collective).toBe(true);
    expect(card.source).toBe('import');
    expect(card.source_id).toBe('ext-123');
    expect(card.source_url).toBe('https://source.com');
    expect(card.due_at).toBe('2026-03-01T00:00:00Z');
    expect(card.latitude).toBe(37.7749);
    expect(card.longitude).toBe(-122.4194);
    expect(card.location_name).toBe('San Francisco');
  });

  it('createCard with tags array stores as JSON string and retrieves as parsed array', async () => {
    const card = createCard(db, { name: 'Tagged Card', tags: ['alpha', 'beta', 'gamma'] });
    expect(Array.isArray(card.tags)).toBe(true);
    expect(card.tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('createCard sets created_at and modified_at to current timestamp', async () => {
    const before = new Date().toISOString();
    const card = createCard(db, { name: 'Timestamped Card' });
    const after = new Date().toISOString();
    expect(card.created_at >= before).toBe(true);
    expect(card.created_at <= after).toBe(true);
    expect(card.modified_at >= before).toBe(true);
    expect(card.modified_at <= after).toBe(true);
  });

  it('createCard with invalid card_type throws (CHECK constraint)', async () => {
    expect(() => {
      createCard(db, { name: 'Bad Type', card_type: 'invalid' as any });
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CARD-02: Retrieve a card by ID
// ---------------------------------------------------------------------------
describe('CARD-02: getCard', () => {
  it('getCard with valid ID returns the card', async () => {
    const created = createCard(db, { name: 'Retrievable Card' });
    const retrieved = getCard(db, created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.name).toBe('Retrievable Card');
  });

  it('getCard with non-existent ID returns null', async () => {
    const result = getCard(db, 'non-existent-id-12345');
    expect(result).toBeNull();
  });

  it('getCard with soft-deleted card ID returns null (excluded by default)', async () => {
    const card = createCard(db, { name: 'Soon Deleted' });
    deleteCard(db, card.id);
    const result = getCard(db, card.id);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CARD-03: Update card fields (modified_at auto-updates)
// ---------------------------------------------------------------------------
describe('CARD-03: updateCard', () => {
  it('updateCard changes the specified field (name)', async () => {
    const card = createCard(db, { name: 'Original Name' });
    updateCard(db, card.id, { name: 'Updated Name' });
    const updated = getCard(db, card.id);
    expect(updated!.name).toBe('Updated Name');
  });

  it('updateCard sets modified_at to a newer timestamp than created_at', async () => {
    const card = createCard(db, { name: 'Timestamp Test' });
    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 5));
    updateCard(db, card.id, { name: 'Modified Name' });
    const updated = getCard(db, card.id);
    expect(updated!.modified_at >= updated!.created_at).toBe(true);
  });

  it('updateCard with multiple fields updates all of them', async () => {
    const card = createCard(db, { name: 'Multi Field', status: 'draft' });
    updateCard(db, card.id, { name: 'New Name', status: 'published', priority: 3 });
    const updated = getCard(db, card.id);
    expect(updated!.name).toBe('New Name');
    expect(updated!.status).toBe('published');
    expect(updated!.priority).toBe(3);
  });

  it('updateCard on non-existent ID throws', async () => {
    expect(() => {
      updateCard(db, 'non-existent-id-12345', { name: 'Won\'t Work' });
    }).toThrow();
  });

  it('updateCard on soft-deleted card throws (WHERE deleted_at IS NULL)', async () => {
    const card = createCard(db, { name: 'Deleted Card' });
    deleteCard(db, card.id);
    expect(() => {
      updateCard(db, card.id, { name: 'Try to Update' });
    }).toThrow();
  });

  it('updateCard of name/content/folder/tags triggers FTS re-index (search finds new value)', async () => {
    const card = createCard(db, { name: 'OldUniqueName123' });
    updateCard(db, card.id, { name: 'NewUniqueName456' });

    // Should find new name
    const newResult = db.exec(
      "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'NewUniqueName456'"
    );
    const newIds = newResult[0]?.values.flat() ?? [];
    expect(newIds).toContain(card.id);

    // Should NOT find old name
    const oldResult = db.exec(
      "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'OldUniqueName123'"
    );
    const oldIds = oldResult[0]?.values.flat() ?? [];
    expect(oldIds).not.toContain(card.id);
  });
});

// ---------------------------------------------------------------------------
// CARD-04: Soft delete
// ---------------------------------------------------------------------------
describe('CARD-04: deleteCard (soft delete)', () => {
  it('deleteCard sets deleted_at to a timestamp', async () => {
    const card = createCard(db, { name: 'To Delete' });
    deleteCard(db, card.id);

    // Query directly to check deleted_at
    const result = db.exec('SELECT deleted_at FROM cards WHERE id = ?', [card.id]);
    const deletedAt = result[0]?.values[0]?.[0];
    expect(deletedAt).toBeTruthy();
    expect(typeof deletedAt).toBe('string');
  });

  it('after deleteCard, getCard returns null', async () => {
    const card = createCard(db, { name: 'Will Be Deleted' });
    deleteCard(db, card.id);
    expect(getCard(db, card.id)).toBeNull();
  });

  it('after deleteCard, listCards excludes the card', async () => {
    const card = createCard(db, { name: 'Excluded Card' });
    deleteCard(db, card.id);
    const cards = listCards(db);
    const ids = cards.map(c => c.id);
    expect(ids).not.toContain(card.id);
  });

  it('deleteCard on already-deleted card is idempotent (no error)', async () => {
    const card = createCard(db, { name: 'Double Delete' });
    deleteCard(db, card.id);
    expect(() => {
      deleteCard(db, card.id);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// CARD-05: List cards with filters
// ---------------------------------------------------------------------------
describe('CARD-05: listCards', () => {
  it('listCards returns all non-deleted cards', async () => {
    createCard(db, { name: 'Card A' });
    createCard(db, { name: 'Card B' });
    const cards = listCards(db);
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });

  it('listCards with folder filter returns only matching cards', async () => {
    createCard(db, { name: 'Work Card', folder: 'work' });
    createCard(db, { name: 'Personal Card', folder: 'personal' });
    const cards = listCards(db, { folder: 'work' });
    expect(cards.every(c => c.folder === 'work')).toBe(true);
  });

  it('listCards with status filter returns only matching cards', async () => {
    createCard(db, { name: 'Active Card', status: 'active' });
    createCard(db, { name: 'Draft Card', status: 'draft' });
    const cards = listCards(db, { status: 'active' });
    expect(cards.every(c => c.status === 'active')).toBe(true);
  });

  it('listCards with card_type filter returns only matching cards', async () => {
    createCard(db, { name: 'Task Card', card_type: 'task' });
    createCard(db, { name: 'Note Card', card_type: 'note' });
    const cards = listCards(db, { card_type: 'task' });
    expect(cards.every(c => c.card_type === 'task')).toBe(true);
  });

  it('listCards with source filter returns only matching cards', async () => {
    createCard(db, { name: 'Imported Card', source: 'slack', source_id: 'slack-001' });
    createCard(db, { name: 'Manual Card' });
    const cards = listCards(db, { source: 'slack' });
    expect(cards.every(c => c.source === 'slack')).toBe(true);
  });

  it('listCards with limit returns at most N cards', async () => {
    for (let i = 0; i < 5; i++) {
      createCard(db, { name: `Limit Card ${i}` });
    }
    const cards = listCards(db, { limit: 3 });
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('listCards with multiple filters applies all (AND logic)', async () => {
    createCard(db, { name: 'Match', folder: 'work', status: 'active' });
    createCard(db, { name: 'Wrong Folder', folder: 'personal', status: 'active' });
    createCard(db, { name: 'Wrong Status', folder: 'work', status: 'draft' });
    const cards = listCards(db, { folder: 'work', status: 'active' });
    expect(cards.every(c => c.folder === 'work' && c.status === 'active')).toBe(true);
  });

  it('listCards excludes soft-deleted cards', async () => {
    const card = createCard(db, { name: 'Delete Me' });
    deleteCard(db, card.id);
    const cards = listCards(db);
    const ids = cards.map(c => c.id);
    expect(ids).not.toContain(card.id);
  });
});

// ---------------------------------------------------------------------------
// CARD-06: Undelete
// ---------------------------------------------------------------------------
describe('CARD-06: undeleteCard', () => {
  it('undeleteCard clears deleted_at', async () => {
    const card = createCard(db, { name: 'Undeletable Card' });
    deleteCard(db, card.id);
    undeleteCard(db, card.id);

    const result = db.exec('SELECT deleted_at FROM cards WHERE id = ?', [card.id]);
    const deletedAt = result[0]?.values[0]?.[0];
    expect(deletedAt).toBeNull();
  });

  it('after undeleteCard, getCard returns the card again', async () => {
    const card = createCard(db, { name: 'Restored Card' });
    deleteCard(db, card.id);
    undeleteCard(db, card.id);
    const restored = getCard(db, card.id);
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(card.id);
  });

  it('after undeleteCard, listCards includes the card', async () => {
    const card = createCard(db, { name: 'Listed Again' });
    deleteCard(db, card.id);
    undeleteCard(db, card.id);
    const cards = listCards(db);
    const ids = cards.map(c => c.id);
    expect(ids).toContain(card.id);
  });

  it('undeleteCard on non-existent ID throws', async () => {
    expect(() => {
      undeleteCard(db, 'non-existent-id-12345');
    }).toThrow();
  });
});
