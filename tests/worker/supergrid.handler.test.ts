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

function createMockDb(execReturn: { columns: string[]; values: unknown[][] }[] = []) {
  return {
    exec: vi.fn().mockReturnValue(execReturn),
  } as unknown as Database;
}

// ---------------------------------------------------------------------------
// handleSuperGridQuery
// ---------------------------------------------------------------------------

describe('handleSuperGridQuery', () => {
  it('returns cells with card_ids split from comma-string to string[]', () => {
    const db = createMockDb([{
      columns: ['card_type', 'folder', 'count', 'card_ids'],
      values: [['note', 'Inbox', 2, 'id1,id2']],
    }]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toEqual({
      card_type: 'note',
      folder: 'Inbox',
      count: 2,
      card_ids: ['id1', 'id2'],
    });
  });

  it('returns single cell with total count when both axes are empty', () => {
    const db = createMockDb([{
      columns: ['NULL', 'count', 'card_ids'],
      values: [[null, 5, 'id1,id2,id3,id4,id5']],
    }]);

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
    const db = createMockDb();

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'EVIL_SQL' as never, direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    expect(() => handleSuperGridQuery(db, payload)).toThrow('SQL safety violation');
  });

  it('handles null card_ids (empty group) gracefully', () => {
    const db = createMockDb([{
      columns: ['card_type', 'count', 'card_ids'],
      values: [['note', 0, null]],
    }]);

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
    const db = createMockDb([{
      columns: ['card_type', 'count', 'card_ids'],
      values: [['note', 0, '']],
    }]);

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
    const db = createMockDb([]);

    const payload: WorkerPayloads['supergrid:query'] = {
      colAxes: [{ field: 'folder', direction: 'asc' }],
      rowAxes: [],
      where: '',
      params: [],
    };

    const result = handleSuperGridQuery(db, payload);

    expect(result.cells).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// handleDistinctValues
// ---------------------------------------------------------------------------

describe('handleDistinctValues', () => {
  it('returns sorted string values for valid column', () => {
    const db = createMockDb([{
      columns: ['folder'],
      values: [['Archive'], ['Inbox']],
    }]);

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
    const db = createMockDb([{
      columns: ['status'],
      values: [['active']],
    }]);

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
    const db = createMockDb([{
      columns: ['card_type'],
      values: [['note'], [null], ['task']],
    }]);

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'card_type',
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual(['note', 'task']);
  });

  it('returns empty values array when db returns no results', () => {
    const db = createMockDb([]);

    const payload: WorkerPayloads['db:distinct-values'] = {
      column: 'folder',
    };

    const result = handleDistinctValues(db, payload);

    expect(result.values).toEqual([]);
  });
});
