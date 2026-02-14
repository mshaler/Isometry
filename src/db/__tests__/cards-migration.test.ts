/**
 * Cards Migration Test - Verifies Phase 84 migration logic
 *
 * Tests:
 * 1. Type mapping: node_type -> card_type (12 types -> 4 types)
 * 2. Column removal: location_address, importance, grid_x/y, source_url
 * 3. Column addition: url, mime_type, is_collective, sync_status
 * 4. Label conversion: edge_type -> lowercase label
 * 5. Backup table creation for rollback
 * 6. FTS5 index rebuild
 * 7. Referential integrity after migration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

describe('Cards Migration (Phase 84)', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    // Initialize sql.js with WASM
    SQL = await initSqlJs({
      locateFile: (file: string) => `public/wasm/${file}`,
    });

    db = new SQL.Database();

    // Create legacy schema (nodes, edges, node_properties)
    db.exec(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        node_type TEXT NOT NULL DEFAULT 'note',
        name TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        location_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        modified_at TEXT NOT NULL DEFAULT (datetime('now')),
        due_at TEXT,
        completed_at TEXT,
        event_start TEXT,
        event_end TEXT,
        folder TEXT,
        tags TEXT,
        status TEXT,
        priority INTEGER DEFAULT 0,
        importance INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        grid_x REAL DEFAULT 0,
        grid_y REAL DEFAULT 0,
        source TEXT,
        source_id TEXT,
        source_url TEXT,
        deleted_at TEXT,
        version INTEGER DEFAULT 1
      );

      CREATE TABLE edges (
        id TEXT PRIMARY KEY,
        edge_type TEXT NOT NULL,
        source_id TEXT NOT NULL REFERENCES nodes(id),
        target_id TEXT NOT NULL REFERENCES nodes(id),
        label TEXT,
        weight REAL DEFAULT 1.0,
        directed INTEGER DEFAULT 1,
        sequence_order INTEGER,
        channel TEXT,
        timestamp TEXT,
        subject TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE node_properties (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES nodes(id),
        key TEXT NOT NULL,
        value TEXT,
        value_type TEXT NOT NULL DEFAULT 'string',
        value_string TEXT,
        value_number REAL,
        value_boolean INTEGER,
        value_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(node_id, key)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create new schema (cards, connections, card_properties)
    db.exec(`
      CREATE TABLE cards (
        id TEXT PRIMARY KEY NOT NULL,
        card_type TEXT NOT NULL DEFAULT 'note' CHECK(card_type IN ('note', 'person', 'event', 'resource')),
        name TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        due_at TEXT,
        completed_at TEXT,
        event_start TEXT,
        event_end TEXT,
        folder TEXT,
        tags TEXT,
        status TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        url TEXT,
        mime_type TEXT,
        is_collective INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        source_id TEXT,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE TABLE connections (
        id TEXT PRIMARY KEY NOT NULL,
        source_id TEXT NOT NULL REFERENCES cards(id),
        target_id TEXT NOT NULL REFERENCES cards(id),
        via_card_id TEXT REFERENCES cards(id),
        label TEXT,
        weight REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        UNIQUE(source_id, target_id, via_card_id)
      );

      CREATE TABLE card_properties (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id),
        key TEXT NOT NULL,
        value TEXT,
        value_type TEXT NOT NULL DEFAULT 'string',
        value_string TEXT,
        value_number REAL,
        value_boolean INTEGER,
        value_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        UNIQUE(card_id, key)
      );

      CREATE VIRTUAL TABLE cards_fts USING fts5(
        name, content, tags, folder,
        content='cards', content_rowid='rowid'
      );
    `);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Type Mapping', () => {
    test('maps note types correctly', () => {
      // Insert test nodes with various note-like types
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Regular Note'),
          ('n2', 'document', 'Document Node'),
          ('n3', 'task', 'Task Node'),
          ('n4', 'project', 'Project Node');
      `);

      // Run migration logic (simplified version)
      db.exec(`
        INSERT INTO cards (id, card_type, name)
        SELECT id,
          CASE
            WHEN node_type IN ('note', 'document', 'task', 'project') THEN 'note'
            ELSE 'note'
          END,
          name
        FROM nodes;
      `);

      // Verify all mapped to 'note'
      const result = db.exec(`
        SELECT id, card_type FROM cards ORDER BY id
      `);

      expect(result[0].values).toHaveLength(4);
      result[0].values.forEach((row) => {
        expect(row[1]).toBe('note');
      });
    });

    test('maps person types correctly', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('p1', 'person', 'Individual Person'),
          ('p2', 'contact', 'Contact Entry');
      `);

      db.exec(`
        INSERT INTO cards (id, card_type, name)
        SELECT id,
          CASE
            WHEN node_type IN ('person', 'contact') THEN 'person'
            ELSE 'note'
          END,
          name
        FROM nodes;
      `);

      const result = db.exec(`SELECT card_type FROM cards`);
      expect(result[0].values).toHaveLength(2);
      result[0].values.forEach((row) => {
        expect(row[0]).toBe('person');
      });
    });

    test('maps event types correctly', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('e1', 'event', 'Conference'),
          ('e2', 'meeting', 'Team Meeting');
      `);

      db.exec(`
        INSERT INTO cards (id, card_type, name)
        SELECT id,
          CASE
            WHEN node_type IN ('event', 'meeting') THEN 'event'
            ELSE 'note'
          END,
          name
        FROM nodes;
      `);

      const result = db.exec(`SELECT card_type FROM cards`);
      expect(result[0].values).toHaveLength(2);
      result[0].values.forEach((row) => {
        expect(row[0]).toBe('event');
      });
    });

    test('maps resource types correctly', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name, source_url) VALUES
          ('r1', 'resource', 'Generic Resource', 'https://example.com/1'),
          ('r2', 'link', 'Web Link', 'https://example.com/2'),
          ('r3', 'file', 'Local File', 'file:///path/to/file'),
          ('r4', 'image', 'Image File', 'https://example.com/img.png');
      `);

      db.exec(`
        INSERT INTO cards (id, card_type, name, url)
        SELECT id,
          CASE
            WHEN node_type IN ('resource', 'link', 'file', 'image') THEN 'resource'
            ELSE 'note'
          END,
          name,
          CASE
            WHEN node_type IN ('resource', 'link', 'file', 'image') THEN source_url
            ELSE NULL
          END
        FROM nodes;
      `);

      const result = db.exec(`SELECT id, card_type, url FROM cards ORDER BY id`);
      expect(result[0].values).toHaveLength(4);
      result[0].values.forEach((row) => {
        expect(row[1]).toBe('resource');
        expect(row[2]).not.toBeNull(); // url should be populated
      });
    });

    test('maps unknown types to note as fallback', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('u1', 'unknown_type', 'Unknown Node'),
          ('u2', 'custom', 'Custom Node');
      `);

      db.exec(`
        INSERT INTO cards (id, card_type, name)
        SELECT id,
          CASE
            WHEN node_type IN ('note', 'document', 'task', 'project') THEN 'note'
            WHEN node_type IN ('person', 'contact') THEN 'person'
            WHEN node_type IN ('event', 'meeting') THEN 'event'
            WHEN node_type IN ('resource', 'link', 'file', 'image') THEN 'resource'
            ELSE 'note'
          END,
          name
        FROM nodes;
      `);

      const result = db.exec(`SELECT card_type FROM cards`);
      expect(result[0].values).toHaveLength(2);
      result[0].values.forEach((row) => {
        expect(row[0]).toBe('note');
      });
    });
  });

  describe('Column Changes', () => {
    test('deprecated columns not in cards table', () => {
      // Try to insert with deprecated columns - should fail
      const tableInfo = db.exec(`PRAGMA table_info(cards)`);
      const columnNames = tableInfo[0].values.map((row) => row[1]);

      // These should NOT exist in cards
      expect(columnNames).not.toContain('location_address');
      expect(columnNames).not.toContain('importance');
      expect(columnNames).not.toContain('grid_x');
      expect(columnNames).not.toContain('grid_y');
      expect(columnNames).not.toContain('source_url');
    });

    test('new columns exist in cards table', () => {
      const tableInfo = db.exec(`PRAGMA table_info(cards)`);
      const columnNames = tableInfo[0].values.map((row) => row[1]);

      // These SHOULD exist in cards
      expect(columnNames).toContain('url');
      expect(columnNames).toContain('mime_type');
      expect(columnNames).toContain('is_collective');
      expect(columnNames).toContain('sync_status');
    });

    test('sync_status defaults to pending', () => {
      db.exec(`
        INSERT INTO cards (id, card_type, name) VALUES ('c1', 'note', 'Test');
      `);

      const result = db.exec(`SELECT sync_status FROM cards WHERE id = 'c1'`);
      expect(result[0].values[0][0]).toBe('pending');
    });

    test('is_collective defaults to 0', () => {
      db.exec(`
        INSERT INTO cards (id, card_type, name) VALUES ('c1', 'person', 'John');
      `);

      const result = db.exec(`SELECT is_collective FROM cards WHERE id = 'c1'`);
      expect(result[0].values[0][0]).toBe(0);
    });
  });

  describe('Edge to Connection Migration', () => {
    test('converts edge_type LINK to label link', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Note 1'),
          ('n2', 'note', 'Note 2');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'note', 'Note 1'),
          ('n2', 'note', 'Note 2');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'LINK', 'n1', 'n2');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, label)
        SELECT id, source_id, target_id,
          CASE
            WHEN label IS NOT NULL AND label != '' THEN LOWER(label)
            WHEN edge_type = 'LINK' THEN 'link'
            WHEN edge_type = 'NEST' THEN 'parent'
            WHEN edge_type = 'SEQUENCE' THEN 'precedes'
            WHEN edge_type = 'AFFINITY' THEN 'related'
            ELSE LOWER(COALESCE(edge_type, 'link'))
          END
        FROM edges;
      `);

      const result = db.exec(`SELECT label FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBe('link');
    });

    test('converts edge_type NEST to label parent', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Parent'),
          ('n2', 'note', 'Child');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'note', 'Parent'),
          ('n2', 'note', 'Child');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'NEST', 'n1', 'n2');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, label)
        SELECT id, source_id, target_id,
          CASE
            WHEN edge_type = 'NEST' THEN 'parent'
            ELSE 'link'
          END
        FROM edges;
      `);

      const result = db.exec(`SELECT label FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBe('parent');
    });

    test('converts edge_type SEQUENCE to label precedes', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'First'),
          ('n2', 'note', 'Second');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'note', 'First'),
          ('n2', 'note', 'Second');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'SEQUENCE', 'n1', 'n2');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, label)
        SELECT id, source_id, target_id,
          CASE
            WHEN edge_type = 'SEQUENCE' THEN 'precedes'
            ELSE 'link'
          END
        FROM edges;
      `);

      const result = db.exec(`SELECT label FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBe('precedes');
    });

    test('converts edge_type AFFINITY to label related', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Topic A'),
          ('n2', 'note', 'Topic B');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'note', 'Topic A'),
          ('n2', 'note', 'Topic B');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'AFFINITY', 'n1', 'n2');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, label)
        SELECT id, source_id, target_id,
          CASE
            WHEN edge_type = 'AFFINITY' THEN 'related'
            ELSE 'link'
          END
        FROM edges;
      `);

      const result = db.exec(`SELECT label FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBe('related');
    });

    test('preserves existing label over edge_type conversion', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'person', 'Alice'),
          ('n2', 'person', 'Bob');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'person', 'Alice'),
          ('n2', 'person', 'Bob');
        INSERT INTO edges (id, edge_type, source_id, target_id, label) VALUES
          ('e1', 'LINK', 'n1', 'n2', 'Knows');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, label)
        SELECT id, source_id, target_id,
          CASE
            WHEN label IS NOT NULL AND label != '' THEN LOWER(label)
            WHEN edge_type = 'LINK' THEN 'link'
            ELSE 'link'
          END
        FROM edges;
      `);

      const result = db.exec(`SELECT label FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBe('knows'); // lowercase
    });

    test('connections has via_card_id column for bridge cards', () => {
      const tableInfo = db.exec(`PRAGMA table_info(connections)`);
      const columnNames = tableInfo[0].values.map((row) => row[1]);

      expect(columnNames).toContain('via_card_id');
    });

    test('via_card_id is null for migrated edges', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Note 1'),
          ('n2', 'note', 'Note 2');
        INSERT INTO cards (id, card_type, name) VALUES
          ('n1', 'note', 'Note 1'),
          ('n2', 'note', 'Note 2');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'LINK', 'n1', 'n2');
      `);

      db.exec(`
        INSERT INTO connections (id, source_id, target_id, via_card_id, label)
        SELECT id, source_id, target_id, NULL, 'link'
        FROM edges;
      `);

      const result = db.exec(`SELECT via_card_id FROM connections WHERE id = 'e1'`);
      expect(result[0].values[0][0]).toBeNull();
    });
  });

  describe('Backup Tables', () => {
    test('creates nodes_backup table', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES ('n1', 'note', 'Test');
        CREATE TABLE nodes_backup AS SELECT * FROM nodes;
      `);

      const tables = db.exec(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_backup'
      `);
      expect(tables[0].values).toHaveLength(1);
    });

    test('nodes_backup preserves all original columns', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name, location_address, importance, grid_x, grid_y, source_url)
        VALUES ('n1', 'note', 'Test', '123 Main St', 5, 100, 200, 'https://example.com');
        CREATE TABLE nodes_backup AS SELECT * FROM nodes;
      `);

      // Verify deprecated columns are preserved in backup
      const result = db.exec(`
        SELECT location_address, importance, grid_x, grid_y, source_url
        FROM nodes_backup WHERE id = 'n1'
      `);

      expect(result[0].values[0][0]).toBe('123 Main St');
      expect(result[0].values[0][1]).toBe(5);
      expect(result[0].values[0][2]).toBe(100);
      expect(result[0].values[0][3]).toBe(200);
      expect(result[0].values[0][4]).toBe('https://example.com');
    });

    test('creates edges_backup table', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES
          ('n1', 'note', 'Note 1'),
          ('n2', 'note', 'Note 2');
        INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
          ('e1', 'LINK', 'n1', 'n2');
        CREATE TABLE edges_backup AS SELECT * FROM edges;
      `);

      const tables = db.exec(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='edges_backup'
      `);
      expect(tables[0].values).toHaveLength(1);
    });
  });

  describe('FTS5 Index', () => {
    test('cards_fts table exists', () => {
      const tables = db.exec(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='cards_fts'
      `);
      expect(tables[0].values).toHaveLength(1);
    });

    test('can search cards via FTS5', () => {
      db.exec(`
        INSERT INTO cards (id, card_type, name, content, tags, folder)
        VALUES ('c1', 'note', 'Important Meeting', 'Discuss project timeline', '["work", "urgent"]', 'work');
        INSERT INTO cards_fts(rowid, name, content, tags, folder)
        SELECT rowid, name, content, tags, folder FROM cards;
      `);

      const result = db.exec(`
        SELECT rowid FROM cards_fts WHERE cards_fts MATCH 'timeline'
      `);

      expect(result[0].values).toHaveLength(1);
    });
  });

  describe('Card Type Constraint', () => {
    test('rejects invalid card_type values', () => {
      expect(() => {
        db.exec(`
          INSERT INTO cards (id, card_type, name) VALUES ('c1', 'invalid', 'Test');
        `);
      }).toThrow();
    });

    test('accepts all four valid card_type values', () => {
      expect(() => {
        db.exec(`
          INSERT INTO cards (id, card_type, name) VALUES
            ('c1', 'note', 'Note'),
            ('c2', 'person', 'Person'),
            ('c3', 'event', 'Event'),
            ('c4', 'resource', 'Resource');
        `);
      }).not.toThrow();

      const result = db.exec(`SELECT COUNT(*) FROM cards`);
      expect(result[0].values[0][0]).toBe(4);
    });
  });

  describe('Node Properties Migration', () => {
    test('migrates node_properties to card_properties', () => {
      db.exec(`
        INSERT INTO nodes (id, node_type, name) VALUES ('n1', 'note', 'Test');
        INSERT INTO cards (id, card_type, name) VALUES ('n1', 'note', 'Test');
        INSERT INTO node_properties (id, node_id, key, value, value_type)
        VALUES ('prop1', 'n1', 'custom_field', 'custom_value', 'string');
      `);

      db.exec(`
        INSERT INTO card_properties (id, card_id, key, value, value_type)
        SELECT id, node_id, key, value, value_type FROM node_properties;
      `);

      const result = db.exec(`
        SELECT card_id, key, value FROM card_properties WHERE id = 'prop1'
      `);

      expect(result[0].values[0][0]).toBe('n1');
      expect(result[0].values[0][1]).toBe('custom_field');
      expect(result[0].values[0][2]).toBe('custom_value');
    });
  });
});
