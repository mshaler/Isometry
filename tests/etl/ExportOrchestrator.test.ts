// Isometry v5 — ExportOrchestrator Tests
// Phase 09-04 ETL-17: Export coordinator with format dispatch

import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { ExportOrchestrator } from '../../src/etl/ExportOrchestrator';
import type { Card } from '../../src/database/queries/types';

describe('ExportOrchestrator', () => {
  let db: Database;
  let orchestrator: ExportOrchestrator;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Create cards table
    db.run(`
      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        card_type TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT,
        summary TEXT,
        latitude REAL,
        longitude REAL,
        location_name TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
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
        source_url TEXT,
        deleted_at TEXT
      )
    `);

    // Create connections table
    db.run(`
      CREATE TABLE connections (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        via_card_id TEXT,
        label TEXT,
        weight REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL
      )
    `);

    orchestrator = new ExportOrchestrator(db);
  });

  const insertCard = (card: Partial<Card>) => {
    const stmt = db.prepare(`
      INSERT INTO cards (
        id, card_type, name, content, created_at, modified_at,
        folder, tags, status, priority, source, source_id, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      card.id || 'card-001',
      card.card_type || 'note',
      card.name || 'Test Card',
      card.content || null,
      card.created_at || '2024-01-01T12:00:00Z',
      card.modified_at || '2024-01-01T12:00:00Z',
      card.folder || null,
      card.tags ? JSON.stringify(card.tags) : null,
      card.status || null,
      card.priority ?? 0,
      card.source || null,
      card.source_id || null,
      card.deleted_at || null,
    ]);
    stmt.free();
  };

  const insertConnection = (conn: any) => {
    const stmt = db.prepare(`
      INSERT INTO connections (id, source_id, target_id, via_card_id, label, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      conn.id,
      conn.source_id,
      conn.target_id,
      conn.via_card_id || null,
      conn.label || null,
      conn.weight ?? 1.0,
      conn.created_at || '2024-01-01T12:00:00Z',
    ]);
    stmt.free();
  };

  it('dispatches to MarkdownExporter for format=markdown', () => {
    insertCard({ id: 'card-001', name: 'Test Note' });

    const result = orchestrator.export('markdown');

    // Should contain markdown format indicators
    expect(result.format).toBe('markdown');
    expect(result.data).toContain('---'); // YAML frontmatter delimiter
    expect(result.data).toContain('title:');
  });

  it('dispatches to JSONExporter for format=json', () => {
    insertCard({ id: 'card-001', name: 'Test Note' });

    const result = orchestrator.export('json');

    // Should contain JSON
    expect(result.format).toBe('json');
    expect(result.data).toContain('"cards"');

    // Should parse as valid JSON
    const parsed = JSON.parse(result.data);
    expect(parsed.cards).toBeDefined();
  });

  it('dispatches to CSVExporter for format=csv', () => {
    insertCard({ id: 'card-001', name: 'Test Note' });

    const result = orchestrator.export('csv');

    // Should contain CSV
    expect(result.format).toBe('csv');
    expect(result.data).toContain('id');
    expect(result.data).toContain('card-001');
  });

  it('filters by cardIds when provided', () => {
    insertCard({ id: 'card-001', name: 'Card 1' });
    insertCard({ id: 'card-002', name: 'Card 2' });
    insertCard({ id: 'card-003', name: 'Card 3' });

    const result = orchestrator.export('json', {
      cardIds: ['card-001', 'card-003'],
    });

    const parsed = JSON.parse(result.data);

    // Should only include filtered cards
    expect(parsed.cards.length).toBe(2);
    expect(parsed.cards[0].id).toBe('card-001');
    expect(parsed.cards[1].id).toBe('card-003');
    expect(result.cardCount).toBe(2);
  });

  it('filters by cardTypes when provided', () => {
    insertCard({ id: 'card-001', card_type: 'note', name: 'Note' });
    insertCard({ id: 'card-002', card_type: 'task', name: 'Task' });
    insertCard({ id: 'card-003', card_type: 'note', name: 'Note 2' });

    const result = orchestrator.export('json', {
      cardTypes: ['note'],
    });

    const parsed = JSON.parse(result.data);

    // Should only include notes
    expect(parsed.cards.length).toBe(2);
    expect(parsed.cards.every((c: any) => c.card_type === 'note')).toBe(true);
    expect(result.cardCount).toBe(2);
  });

  it('excludes deleted cards by default', () => {
    insertCard({ id: 'card-001', name: 'Active Card', deleted_at: null });
    insertCard({ id: 'card-002', name: 'Deleted Card', deleted_at: '2024-01-01T12:00:00Z' });

    const result = orchestrator.export('json');

    const parsed = JSON.parse(result.data);

    // Should only include active card
    expect(parsed.cards.length).toBe(1);
    expect(parsed.cards[0].id).toBe('card-001');
    expect(result.cardCount).toBe(1);
  });

  it('generates timestamp filename with correct extension', () => {
    insertCard({ id: 'card-001', name: 'Test Card' });

    const mdResult = orchestrator.export('markdown');
    const jsonResult = orchestrator.export('json');
    const csvResult = orchestrator.export('csv');

    // Should have correct extensions
    expect(mdResult.filename).toMatch(/^isometry-export-.*\.md$/);
    expect(jsonResult.filename).toMatch(/^isometry-export-.*\.json$/);
    expect(csvResult.filename).toMatch(/^isometry-export-.*\.csv$/);

    // Should contain timestamp
    expect(mdResult.filename).toContain('isometry-export-');
  });

  it('returns ExportResult with data, filename, format, cardCount', () => {
    insertCard({ id: 'card-001', name: 'Test Card' });
    insertCard({ id: 'card-002', name: 'Test Card 2' });

    const result = orchestrator.export('json');

    // Should have all required fields
    expect(result.data).toBeDefined();
    expect(result.filename).toBeDefined();
    expect(result.format).toBe('json');
    expect(result.cardCount).toBe(2);
  });

  it('returns all non-deleted cards when no filters provided', () => {
    insertCard({ id: 'card-001', name: 'Card 1' });
    insertCard({ id: 'card-002', name: 'Card 2' });
    insertCard({ id: 'card-003', name: 'Card 3', deleted_at: '2024-01-01T12:00:00Z' });

    const result = orchestrator.export('json', {});

    const parsed = JSON.parse(result.data);

    // Should include all non-deleted cards
    expect(parsed.cards.length).toBe(2);
    expect(result.cardCount).toBe(2);
  });

  it('includes connections for markdown/json exports', () => {
    insertCard({ id: 'card-001', name: 'Card 1' });
    insertCard({ id: 'card-002', name: 'Card 2' });
    insertConnection({
      id: 'conn-001',
      source_id: 'card-001',
      target_id: 'card-002',
    });

    const jsonResult = orchestrator.export('json');
    const mdResult = orchestrator.export('markdown');

    // JSON should include connections
    const parsed = JSON.parse(jsonResult.data);
    expect(parsed.connections).toBeDefined();
    expect(parsed.connections.length).toBe(1);

    // Markdown should include wikilinks
    expect(mdResult.data).toContain('[[Card 2]]');
  });
});
