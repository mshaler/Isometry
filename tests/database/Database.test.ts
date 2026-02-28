import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';

// Helper: generate a unique ID for tests
function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

describe('Database Foundation', () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
  });

  afterEach(() => {
    db.close(); // Required: releases WASM heap, prevents leaks between tests
  });

  // ---------------------------------------------------------------------------
  // DB-01: sql.js initialization with FTS5
  // ---------------------------------------------------------------------------
  describe('DB-01: sql.js initialization', () => {
    it('initializes successfully without throwing', async () => {
      // If we get here, initialize() did not throw
      expect(db).toBeTruthy();
    });

    it('has FTS5 capability via pragma_compile_options', () => {
      const result = db.exec(
        "SELECT compile_options FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
      );
      expect(result[0]?.values.length).toBeGreaterThan(0);
    });

    it('provides exec(), run(), and close() methods', () => {
      expect(typeof db.exec).toBe('function');
      expect(typeof db.run).toBe('function');
      expect(typeof db.close).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // DB-02: Canonical schema creates all tables and indexes
  // ---------------------------------------------------------------------------
  describe('DB-02: Canonical schema', () => {
    it('creates the cards table', () => {
      const tables = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cards'"
      );
      expect(tables[0]?.values.flat()).toContain('cards');
    });

    it('creates the connections table', () => {
      const tables = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='connections'"
      );
      expect(tables[0]?.values.flat()).toContain('connections');
    });

    it('creates the cards_fts virtual table', () => {
      // Virtual tables appear in sqlite_master with type='table'
      const tables = db.exec(
        "SELECT name FROM sqlite_master WHERE name='cards_fts'"
      );
      expect(tables[0]?.values.flat()).toContain('cards_fts');
    });

    it('creates the ui_state table', () => {
      const tables = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ui_state'"
      );
      expect(tables[0]?.values.flat()).toContain('ui_state');
    });

    it('has idx_cards_type index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_type'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_type');
    });

    it('has idx_cards_folder index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_folder'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_folder');
    });

    it('has idx_cards_status index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_status'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_status');
    });

    it('has idx_cards_created index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_created'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_created');
    });

    it('has idx_cards_modified index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_modified'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_modified');
    });

    it('has idx_cards_source unique index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cards_source'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_cards_source');
    });

    it('has idx_conn_source index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_conn_source'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_conn_source');
    });

    it('has idx_conn_target index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_conn_target'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_conn_target');
    });

    it('has idx_conn_via index', () => {
      const idx = db.exec(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_conn_via'"
      );
      expect(idx[0]?.values.flat()).toContain('idx_conn_via');
    });

    it('enforces CHECK constraint on card_type — rejects invalid type', () => {
      expect(() => {
        db.run("INSERT INTO cards(id, card_type, name) VALUES('bad-type', 'invalid_type', 'Test')");
      }).toThrow();
    });

    it('enforces UNIQUE constraint on connections (source_id, target_id, via_card_id, label)', () => {
      const cardA = uid('card');
      const cardB = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardA, 'Card A']);
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardB, 'Card B']);
      db.run(
        "INSERT INTO connections(id, source_id, target_id, via_card_id, label) VALUES(?, ?, ?, NULL, 'links')",
        [uid('conn'), cardA, cardB]
      );
      expect(() => {
        db.run(
          "INSERT INTO connections(id, source_id, target_id, via_card_id, label) VALUES(?, ?, ?, NULL, 'links')",
          [uid('conn'), cardA, cardB]
        );
      }).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // DB-03: Three separate FTS5 sync triggers
  // ---------------------------------------------------------------------------
  describe('DB-03: FTS5 sync triggers', () => {
    it('trigger cards_fts_ai (AFTER INSERT) exists', () => {
      const triggers = db.exec(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='cards_fts_ai'"
      );
      expect(triggers[0]?.values.flat()).toContain('cards_fts_ai');
    });

    it('trigger cards_fts_ad (AFTER DELETE) exists', () => {
      const triggers = db.exec(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='cards_fts_ad'"
      );
      expect(triggers[0]?.values.flat()).toContain('cards_fts_ad');
    });

    it('trigger cards_fts_au (AFTER UPDATE) exists', () => {
      const triggers = db.exec(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='cards_fts_au'"
      );
      expect(triggers[0]?.values.flat()).toContain('cards_fts_au');
    });

    it('has exactly three FTS triggers (no extras)', () => {
      const triggers = db.exec(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'cards_fts_%'"
      );
      const names = triggers[0]?.values.flat() ?? [];
      expect(names).toHaveLength(3);
    });

    it('FTS search finds card by name after insert', () => {
      const cardId = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardId, 'Searchable Banana Card']);
      const result = db.exec(
        "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'Banana'"
      );
      const ids = result[0]?.values.flat() ?? [];
      expect(ids).toContain(cardId);
    });

    it('FTS search finds card by name after update, not old name', () => {
      const cardId = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardId, 'OldFruitName']);
      db.run("UPDATE cards SET name = 'NewFruitName' WHERE id = ?", [cardId]);

      // Should find new name
      const newResult = db.exec(
        "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'NewFruitName'"
      );
      const newIds = newResult[0]?.values.flat() ?? [];
      expect(newIds).toContain(cardId);

      // Should NOT find old name
      const oldResult = db.exec(
        "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'OldFruitName'"
      );
      const oldIds = oldResult[0]?.values.flat() ?? [];
      expect(oldIds).not.toContain(cardId);
    });

    it('FTS search does not find card after delete', () => {
      const cardId = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardId, 'TemporaryDeletedCard']);
      db.run("DELETE FROM cards WHERE id = ?", [cardId]);
      const result = db.exec(
        "SELECT c.id FROM cards_fts fts JOIN cards c ON c.rowid = fts.rowid WHERE cards_fts MATCH 'TemporaryDeletedCard'"
      );
      const ids = result[0]?.values.flat() ?? [];
      expect(ids).not.toContain(cardId);
    });
  });

  // ---------------------------------------------------------------------------
  // DB-04: FTS integrity-check passes after mutations
  // ---------------------------------------------------------------------------
  describe('DB-04: FTS integrity-check', () => {
    function assertFtsIntegrity(): void {
      // The FTS5 built-in integrity-check throws on corruption
      expect(() => {
        db.exec("INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')");
      }).not.toThrow();
    }

    it('passes after single insert', () => {
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [uid('card'), 'Single Card']);
      assertFtsIntegrity();
    });

    it('passes after batch of 100 inserts', () => {
      for (let i = 0; i < 100; i++) {
        db.run("INSERT INTO cards(id, name, content) VALUES(?, ?, ?)", [
          uid('card'),
          `Batch Card ${i}`,
          `Content for card number ${i}`,
        ]);
      }
      assertFtsIntegrity();
    });

    it('passes after update', () => {
      const cardId = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardId, 'Before Update']);
      db.run("UPDATE cards SET name = 'After Update' WHERE id = ?", [cardId]);
      assertFtsIntegrity();
    });

    it('passes after delete', () => {
      const cardId = uid('card');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardId, 'To Be Deleted']);
      db.run("DELETE FROM cards WHERE id = ?", [cardId]);
      assertFtsIntegrity();
    });

    it('passes after mixed insert/update/delete batch', () => {
      const ids: string[] = [];
      // Insert 10 cards
      for (let i = 0; i < 10; i++) {
        const id = uid('card');
        ids.push(id);
        db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [id, `Mixed Card ${i}`]);
      }
      // Update 5 of them
      for (let i = 0; i < 5; i++) {
        db.run("UPDATE cards SET name = ? WHERE id = ?", [`Updated Card ${i}`, ids[i]]);
      }
      // Delete 3 of them
      for (let i = 5; i < 8; i++) {
        db.run("DELETE FROM cards WHERE id = ?", [ids[i]]);
      }
      assertFtsIntegrity();
    });
  });

  // ---------------------------------------------------------------------------
  // DB-06: PRAGMA foreign_keys = ON
  // ---------------------------------------------------------------------------
  describe('DB-06: Foreign keys', () => {
    it('PRAGMA foreign_keys returns 1 (enabled)', () => {
      const result = db.exec('PRAGMA foreign_keys');
      expect(result[0]?.values[0]?.[0]).toBe(1);
    });

    it('cascade delete removes connections when source card is deleted', () => {
      const cardA = uid('card');
      const cardB = uid('card');
      const connId = uid('conn');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardA, 'Source Card']);
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardB, 'Target Card']);
      db.run(
        "INSERT INTO connections(id, source_id, target_id, label) VALUES(?, ?, ?, 'links')",
        [connId, cardA, cardB]
      );

      // Delete source card
      db.run("DELETE FROM cards WHERE id = ?", [cardA]);

      // Connection should be gone (CASCADE)
      const orphans = db.exec("SELECT id FROM connections WHERE id = ?", [connId]);
      expect(orphans.length).toBe(0);
    });

    it('cascade delete removes connections when target card is deleted', () => {
      const cardA = uid('card');
      const cardB = uid('card');
      const connId = uid('conn');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardA, 'Source Card']);
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardB, 'Target Card']);
      db.run(
        "INSERT INTO connections(id, source_id, target_id, label) VALUES(?, ?, ?, 'links')",
        [connId, cardA, cardB]
      );

      // Delete target card
      db.run("DELETE FROM cards WHERE id = ?", [cardB]);

      // Connection should be gone (CASCADE)
      const orphans = db.exec("SELECT id FROM connections WHERE id = ?", [connId]);
      expect(orphans.length).toBe(0);
    });

    it('deleting the via card sets via_card_id to NULL (SET NULL, not cascade)', () => {
      const cardA = uid('card');
      const cardB = uid('card');
      const cardVia = uid('card');
      const connId = uid('conn');
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardA, 'Card A']);
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardB, 'Card B']);
      db.run("INSERT INTO cards(id, name) VALUES(?, ?)", [cardVia, 'Via Card']);
      db.run(
        "INSERT INTO connections(id, source_id, target_id, via_card_id, label) VALUES(?, ?, ?, ?, 'through')",
        [connId, cardA, cardB, cardVia]
      );

      // Delete the via card
      db.run("DELETE FROM cards WHERE id = ?", [cardVia]);

      // Connection should still exist, but via_card_id should be NULL
      const result = db.exec(
        "SELECT id, via_card_id FROM connections WHERE id = ?",
        [connId]
      );
      expect(result[0]?.values).toHaveLength(1);
      expect(result[0]?.values[0]?.[1]).toBeNull();
    });
  });
});
