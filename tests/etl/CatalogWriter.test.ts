// Isometry v5 — Phase 8 CatalogWriter Tests
// Tests for import provenance tracking

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CatalogWriter } from '../../src/etl/CatalogWriter';
import { Database } from '../../src/database/Database';
import type { ImportRunRecord } from '../../src/etl/CatalogWriter';

describe('CatalogWriter', () => {
  let db: Database;
  let writer: CatalogWriter;

  beforeEach(async () => {
    // Create a temporary database for testing
    db = new Database();
    await db.initialize();
    writer = new CatalogWriter(db);
  });

  afterEach(() => {
    // Clean up
    db.close();
  });

  it('creates new import source on first run', () => {
    const record: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      result: {
        inserted: 10,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        connections_created: 5,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    const runId = writer.recordImportRun(record);

    expect(runId).toBeDefined();
    expect(typeof runId).toBe('string');

    // Verify source was created
    const sources = db
      .prepare<{ id: string; name: string; source_type: string }>(
        'SELECT id, name, source_type FROM import_sources WHERE source_type = ?'
      )
      .all('apple_notes');

    expect(sources.length).toBe(1);
    expect(sources[0]?.name).toBe('Apple Notes Export');
  });

  it('reuses existing import source on subsequent runs', () => {
    const record1: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      result: {
        inserted: 10,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        connections_created: 5,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    const record2: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-02T00:00:00Z',
      completed_at: '2026-01-02T00:05:00Z',
      result: {
        inserted: 5,
        updated: 3,
        unchanged: 2,
        skipped: 0,
        errors: 0,
        connections_created: 2,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    writer.recordImportRun(record1);
    writer.recordImportRun(record2);

    // Should only have one source
    const sources = db
      .prepare<{ id: string }>('SELECT id FROM import_sources')
      .all();

    expect(sources.length).toBe(1);

    // Should have two runs
    const runs = db
      .prepare<{ id: string }>('SELECT id FROM import_runs')
      .all();

    expect(runs.length).toBe(2);
  });

  it('records import run with all counts', () => {
    const record: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      filename: 'notes-export.zip',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      result: {
        inserted: 10,
        updated: 3,
        unchanged: 5,
        skipped: 2,
        errors: 1,
        connections_created: 15,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [
          {
            index: 7,
            source_id: 'note-123',
            message: 'Invalid frontmatter',
          },
        ],
      },
    };

    const runId = writer.recordImportRun(record);

    // Verify run record
    const run = db
      .prepare<{
        id: string;
        filename: string | null;
        started_at: string;
        completed_at: string;
        cards_inserted: number;
        cards_updated: number;
        cards_unchanged: number;
        cards_skipped: number;
        connections_created: number;
        errors_json: string | null;
      }>('SELECT * FROM import_runs WHERE id = ?')
      .all(runId);

    expect(run.length).toBe(1);
    const runRecord = run[0];
    expect(runRecord?.filename).toBe('notes-export.zip');
    expect(runRecord?.started_at).toBe('2026-01-01T00:00:00Z');
    expect(runRecord?.completed_at).toBe('2026-01-01T00:05:00Z');
    expect(runRecord?.cards_inserted).toBe(10);
    expect(runRecord?.cards_updated).toBe(3);
    expect(runRecord?.cards_unchanged).toBe(5);
    expect(runRecord?.cards_skipped).toBe(2);
    expect(runRecord?.connections_created).toBe(15);

    const errorsDetail = JSON.parse(runRecord?.errors_json ?? '[]');
    expect(errorsDetail).toEqual([
      {
        index: 7,
        source_id: 'note-123',
        message: 'Invalid frontmatter',
      },
    ]);
  });

  it('retrieves runs for a source type', () => {
    const record1: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      result: {
        inserted: 10,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        connections_created: 5,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    const record2: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-02T00:00:00Z',
      completed_at: '2026-01-02T00:05:00Z',
      result: {
        inserted: 5,
        updated: 3,
        unchanged: 2,
        skipped: 0,
        errors: 0,
        connections_created: 2,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    const record3: ImportRunRecord = {
      source: 'markdown',
      sourceName: 'Markdown Files',
      started_at: '2026-01-03T00:00:00Z',
      completed_at: '2026-01-03T00:05:00Z',
      result: {
        inserted: 7,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        connections_created: 3,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    writer.recordImportRun(record1);
    writer.recordImportRun(record2);
    writer.recordImportRun(record3);

    const appleNotesRuns = writer.getRunsForSource('apple_notes');

    expect(appleNotesRuns.length).toBe(2);
    // Should be sorted by completed_at DESC (most recent first)
    expect(appleNotesRuns[0]?.completed_at).toBe('2026-01-02T00:05:00Z');
    expect(appleNotesRuns[1]?.completed_at).toBe('2026-01-01T00:05:00Z');
  });

  it('handles empty errors_detail array', () => {
    const record: ImportRunRecord = {
      source: 'apple_notes',
      sourceName: 'Apple Notes Export',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:05:00Z',
      result: {
        inserted: 10,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        connections_created: 5,
        insertedIds: [],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [],
      },
    };

    const runId = writer.recordImportRun(record);

    const run = db
      .prepare<{ errors_json: string | null }>(
        'SELECT errors_json FROM import_runs WHERE id = ?'
      )
      .all(runId);

    expect(run[0]?.errors_json).toBe('[]');
  });
});
