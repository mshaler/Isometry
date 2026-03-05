// Isometry v5 — Phase 16 SuperGrid Handler Tests
// Unit tests for handleSuperGridQuery and handleDistinctValues.
//
// Pattern: Direct function imports (no Worker, no bridge) — same as simulate.handler.test.ts
// Mock: Database with { exec: vi.fn() } returning columnar result sets

import { describe, it, expect, vi } from 'vitest';
import { handleSuperGridQuery, handleDistinctValues } from '../../src/worker/handlers/supergrid.handler';
import type { Database } from '../../src/database/Database';
import type { WorkerPayloads } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Helper: Create mock Database with exec returning columnar results
// ---------------------------------------------------------------------------

function createMockPrepareStmt(rows: Record<string, unknown>[]) {
  return {
    all: vi.fn().mockReturnValue(rows),
    free: vi.fn(),
  };
}

function createMockDb(
  prepareRows: Record<string, unknown>[] = [],
  execReturn: { columns: string[]; values: unknown[][] }[] = []
) {
  return {
    prepare: vi.fn().mockReturnValue(createMockPrepareStmt(prepareRows)),
    exec: vi.fn().mockReturnValue(execReturn),
  } as unknown as Database;
}

/** Legacy helper for tests that only care about prepare rows (no FTS exec) */
function createSimpleMockDb(rows: Record<string, unknown>[] = []) {
  return createMockDb(rows, []);
}

// ---------------------------------------------------------------------------
// handleSuperGridQuery
// ---------------------------------------------------------------------------

describe('handleSuperGridQuery', () => {
  it('returns cells with card_ids split from comma-string to string[]', () => {
    // prepare() returns row objects; exec() not called when no searchTerm
    const db = createSimpleMockDb([
      { card_type: 'note', folder: 'Inbox', count: 2, card_ids: 'id1,id2' },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]!.card_type).toBe('note');
    expect(result.cells[0]!.folder).toBe('Inbox');
    expect(result.cells[0]!.count).toBe(2);
    expect(result.cells[0]!.card_ids).toEqual(['id1', 'id2']);
  });

  it('returns single cell with total count when both axes are empty', () => {
    const db = createSimpleMockDb([
      { NULL: null, count: 5, card_ids: 'id1,id2,id3,id4,id5' },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]!.count).toBe(5);
    expect(result.cells[0]!.card_ids).toEqual(['id1', 'id2', 'id3', 'id4', 'id5']);
  });

  it('throws SQL safety violation for invalid axis field', () => {
    const db = createSimpleMockDb();

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'EVIL_SQL' as never, direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    expect(() => handleSuperGridQuery(db, payload)).toThrow('SQL safety violation');
  });

  it('handles null card_ids (empty group) gracefully', () => {
    const db = createSimpleMockDb([
      { card_type: 'note', count: 0, card_ids: null },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]!.count).toBe(0);
    expect(result.cells[0]!.card_ids).toEqual([]);
  });

  it('handles empty string card_ids gracefully', () => {
    const db = createSimpleMockDb([
      { card_type: 'note', count: 0, card_ids: '' },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]!.count).toBe(0);
    expect(result.cells[0]!.card_ids).toEqual([]);
  });

  it('returns empty cells array when db returns no results', () => {
    const db = createSimpleMockDb([]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'folder', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Phase 25 Plan 01 — SRCH-04: matchedCardIds and searchTerms
  // ---------------------------------------------------------------------------

  it('with searchTerm: annotates cells with matchedCardIds (FTS secondary query)', () => {
    // Primary query: 2 cells, each with some card_ids
    // Secondary FTS exec: returns id1 and id3 as matching
    const db = createMockDb(
      // prepare() rows (primary query)
      [
        { card_type: 'note', folder: 'Inbox', count: 2, card_ids: 'id1,id2' },
        { card_type: 'task', folder: 'Work', count: 2, card_ids: 'id3,id4' },
      ],
      // exec() result (secondary FTS query)
      [{ columns: ['id'], values: [['id1'], ['id3']] }]
    );

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
      searchTerm: 'hello',
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(2);
    // Cell 0: id1 matched, id2 did not
    expect(result.cells[0]!['matchedCardIds']).toEqual(['id1']);
    // Cell 1: id3 matched, id4 did not
    expect(result.cells[1]!['matchedCardIds']).toEqual(['id3']);
  });

  it('with searchTerm: returns searchTerms array in response', () => {
    const db = createMockDb(
      [{ card_type: 'note', count: 1, card_ids: 'id1' }],
      [{ columns: ['id'], values: [['id1']] }]
    );

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
      searchTerm: 'world',
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.searchTerms).toEqual(['world']);
  });

  it('without searchTerm: does NOT add matchedCardIds to cells', () => {
    const db = createSimpleMockDb([
      { card_type: 'note', count: 1, card_ids: 'id1' },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells[0]!['matchedCardIds']).toBeUndefined();
  });

  it('without searchTerm: returns response without searchTerms field', () => {
    const db = createSimpleMockDb([
      { card_type: 'note', count: 1, card_ids: 'id1' },
    ]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.searchTerms).toBeUndefined();
  });

  it('with empty searchTerm: does NOT run secondary FTS query', () => {
    const execSpy = vi.fn().mockReturnValue([]);
    const db = {
      prepare: vi.fn().mockReturnValue(createMockPrepareStmt([{ card_type: 'note', count: 1, card_ids: 'id1' }])),
      exec: execSpy,
    } as unknown as Database;

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
      searchTerm: '',
    };

    handleSuperGridQuery(db, payload);

    expect(execSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleDistinctValues
// ---------------------------------------------------------------------------

describe('handleDistinctValues', () => {
  it('returns sorted string values for valid column', () => {
    // handleDistinctValues uses db.exec (not prepare)
    const db = createMockDb(
      [], // prepare rows (unused)
      [{ columns: ['folder'], values: [['Archive'], ['Inbox']] }]
    );

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'folder',
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual(['Archive', 'Inbox']);
    // Verify the SQL uses ORDER BY for sorted results
    expect(db.exec).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY folder ASC'),
      expect.any(Array)
    );
  });

  it('throws SQL safety violation for invalid column', () => {
    const db = createMockDb();

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'EVIL_SQL',
    };

    expect(() => handleDistinctValues(db, payload)).toThrow('SQL safety violation');
  });

  it('respects WHERE filter and params', () => {
    const db = createMockDb(
      [], // prepare rows (unused)
      [{ columns: ['status'], values: [['active']] }]
    );

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'status',
      where: 'folder = ?',
      params: ['Inbox'],
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual(['active']);
    expect(db.exec).toHaveBeenCalledWith(
      expect.stringContaining('AND folder = ?'),
      ['Inbox']
    );
  });

  it('filters null values from results', () => {
    const db = createMockDb(
      [], // prepare rows (unused)
      [{ columns: ['card_type'], values: [['note'], [null], ['task']] }]
    );

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'card_type',
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual(['note', 'task']);
  });

  it('returns empty values array when db returns no results', () => {
    const db = createMockDb(
      [], // prepare rows (unused)
      [] // exec returns nothing
    );

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'folder',
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual([]);
  });
});
