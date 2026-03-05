// Isometry v5 — Phase 4 Plan 01 (Task 2)
// Tests for FilterProvider: SQL compilation, subscriber pattern, serialization.
//
// Requirements: PROV-01, PROV-02, PROV-11
// TDD Phase: RED → GREEN → REFACTOR

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilterProvider } from '../../src/providers/FilterProvider';
import type { Filter } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// compile() — base behavior
// ---------------------------------------------------------------------------

describe('FilterProvider.compile() — base', () => {
  it('empty provider returns { where: "deleted_at IS NULL", params: [] }', () => {
    const provider = new FilterProvider();
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
    expect(result.params).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// compile() — operator mappings
// ---------------------------------------------------------------------------

describe('FilterProvider.compile() — eq operator', () => {
  it('produces field = ? with correct param', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Projects' });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND folder = ?');
    expect(result.params).toEqual(['Projects']);
  });
});

describe('FilterProvider.compile() — neq operator', () => {
  it('produces field != ?', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'status', operator: 'neq', value: 'archived' });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND status != ?');
    expect(result.params).toEqual(['archived']);
  });
});

describe('FilterProvider.compile() — gt operator', () => {
  it('produces field > ?', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'priority', operator: 'gt', value: 3 });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND priority > ?');
    expect(result.params).toEqual([3]);
  });
});

describe('FilterProvider.compile() — gte operator', () => {
  it('produces field >= ?', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'sort_order', operator: 'gte', value: 0 });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND sort_order >= ?');
    expect(result.params).toEqual([0]);
  });
});

describe('FilterProvider.compile() — lt operator', () => {
  it('produces field < ?', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'priority', operator: 'lt', value: 5 });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND priority < ?');
    expect(result.params).toEqual([5]);
  });
});

describe('FilterProvider.compile() — lte operator', () => {
  it('produces field <= ?', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'priority', operator: 'lte', value: 10 });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND priority <= ?');
    expect(result.params).toEqual([10]);
  });
});

describe('FilterProvider.compile() — contains operator', () => {
  it('produces field LIKE ? with %value% wrapping', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'name', operator: 'contains', value: 'test' });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND name LIKE ?');
    expect(result.params).toEqual(['%test%']);
  });
});

describe('FilterProvider.compile() — startsWith operator', () => {
  it('produces field LIKE ? with value% wrapping', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'startsWith', value: 'Work' });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND folder LIKE ?');
    expect(result.params).toEqual(['Work%']);
  });
});

describe('FilterProvider.compile() — in operator', () => {
  it('produces field IN (?, ?) with array params spread', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'card_type', operator: 'in', value: ['note', 'task'] });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND card_type IN (?, ?)');
    expect(result.params).toEqual(['note', 'task']);
  });
});

describe('FilterProvider.compile() — isNull operator', () => {
  it('produces field IS NULL with no param', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'due_at', operator: 'isNull', value: undefined });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND due_at IS NULL');
    expect(result.params).toEqual([]);
  });
});

describe('FilterProvider.compile() — isNotNull operator', () => {
  it('produces field IS NOT NULL with no param', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'completed_at', operator: 'isNotNull', value: undefined });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND completed_at IS NOT NULL');
    expect(result.params).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// compile() — multiple filters
// ---------------------------------------------------------------------------

describe('FilterProvider.compile() — multiple filters', () => {
  it('joins multiple filters with AND', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.addFilter({ field: 'status', operator: 'eq', value: 'active' });
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND folder = ? AND status = ?');
    expect(result.params).toEqual(['Work', 'active']);
  });
});

// ---------------------------------------------------------------------------
// SQL safety validation
// ---------------------------------------------------------------------------

describe('FilterProvider — SQL safety', () => {
  it('throws SQL safety violation for unknown field', () => {
    const provider = new FilterProvider();
    expect(() => {
      provider.addFilter({
        field: 'DROP TABLE' as never,
        operator: 'eq',
        value: 'test',
      });
    }).toThrowError(/SQL safety violation/);
  });

  it('throws SQL safety violation for unknown operator', () => {
    const provider = new FilterProvider();
    expect(() => {
      provider.addFilter({
        field: 'name',
        operator: 'UNION' as never,
        value: 'test',
      });
    }).toThrowError(/SQL safety violation/);
  });

  it('SQL injection value is parameterized, never interpolated', () => {
    const provider = new FilterProvider();
    provider.addFilter({
      field: 'name',
      operator: 'eq',
      value: "'; DROP TABLE cards; --",
    });
    const result = provider.compile();
    // WHERE clause should NOT contain the injection attempt
    expect(result.where).not.toContain("'; DROP TABLE");
    // But the value IS in params (parameterized, not interpolated)
    expect(result.params).toContain("'; DROP TABLE cards; --");
  });

  it('compile() re-validates field from state (handles JSON-restored invalid state)', () => {
    const provider = new FilterProvider();
    // Inject an invalid filter directly into internal state by bypassing addFilter
    // Simulate what happens if JSON-restored state has an evil field
    const badFilter = { field: 'evil_column', operator: 'eq', value: 'test' } as unknown as Filter;
    (provider as unknown as { _filters: Filter[] })._filters = [badFilter];
    expect(() => provider.compile()).toThrowError(/SQL safety violation/);
  });
});

// ---------------------------------------------------------------------------
// FTS search
// ---------------------------------------------------------------------------

describe('FilterProvider.setSearchQuery()', () => {
  it('adds FTS clause: rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)', () => {
    const provider = new FilterProvider();
    provider.setSearchQuery('hello');
    const result = provider.compile();
    expect(result.where).toContain('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
  });

  it('tokenizes multi-word query: "hello world" → \'"hello"* "world"*\'', () => {
    const provider = new FilterProvider();
    provider.setSearchQuery('hello world');
    const result = provider.compile();
    expect(result.params).toContain('"hello"* "world"*');
  });

  it('combines FTS with regular filters via AND', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setSearchQuery('hello');
    const result = provider.compile();
    expect(result.where).toContain('deleted_at IS NULL AND folder = ?');
    expect(result.where).toContain('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
  });

  it('setSearchQuery(null) clears the search', () => {
    const provider = new FilterProvider();
    provider.setSearchQuery('hello');
    provider.setSearchQuery(null);
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
    expect(result.where).not.toContain('cards_fts');
  });
});

// ---------------------------------------------------------------------------
// removeFilter / clearFilters
// ---------------------------------------------------------------------------

describe('FilterProvider.removeFilter()', () => {
  it('removes filter at the given index', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.addFilter({ field: 'status', operator: 'eq', value: 'active' });
    provider.removeFilter(0);
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL AND status = ?');
    expect(result.params).toEqual(['active']);
  });
});

describe('FilterProvider.clearFilters()', () => {
  it('removes all filters and search query', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setSearchQuery('hello');
    provider.clearFilters();
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
    expect(result.params).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getFilters()
// ---------------------------------------------------------------------------

describe('FilterProvider.getFilters()', () => {
  it('returns a readonly copy of the filters array', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    const filters = provider.getFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0]).toEqual({ field: 'folder', operator: 'eq', value: 'Work' });
  });

  it('mutating the returned array does not affect internal state', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    const filters = provider.getFilters();
    // @ts-expect-error — testing mutation resistance
    filters.push({ field: 'status', operator: 'eq', value: 'test' });
    // Internal state unchanged
    expect(provider.getFilters()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// subscribe() / unsubscribe pattern (PROV-11)
// ---------------------------------------------------------------------------

describe('FilterProvider.subscribe()', () => {
  it('returns an unsubscribe function', () => {
    const provider = new FilterProvider();
    const unsubscribe = provider.subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
  });

  it('calls subscriber after addFilter (via queueMicrotask)', async () => {
    const provider = new FilterProvider();
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    // queueMicrotask fires after current sync code — await one tick
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('two rapid addFilter calls produce only ONE notification', async () => {
    const provider = new FilterProvider();
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.addFilter({ field: 'status', operator: 'eq', value: 'active' });
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes the subscriber', async () => {
    const provider = new FilterProvider();
    const cb = vi.fn();
    const unsubscribe = provider.subscribe(cb);
    unsubscribe();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('multiple subscribers all notified', async () => {
    const provider = new FilterProvider();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    provider.subscribe(cb1);
    provider.subscribe(cb2);
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    await Promise.resolve();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Serialization (toJSON / fromJSON / setState / resetToDefaults)
// ---------------------------------------------------------------------------

describe('FilterProvider serialization', () => {
  it('toJSON() returns a JSON string', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    const json = provider.toJSON();
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('toJSON / fromJSON round-trips filter state', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.addFilter({ field: 'status', operator: 'eq', value: 'active' });
    provider.setSearchQuery('hello');
    const json = provider.toJSON();

    const restored = FilterProvider.fromJSON(json);
    const compiled = restored.compile();
    expect(compiled.where).toBe(
      'deleted_at IS NULL AND folder = ? AND status = ? AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)'
    );
    expect(compiled.params).toEqual(['Work', 'active', '"hello"*']);
  });

  it('fromJSON with corrupt JSON throws', () => {
    expect(() => FilterProvider.fromJSON('not valid json{')).toThrow();
  });

  it('setState() restores state from a plain object', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    const state = JSON.parse(provider.toJSON());

    const provider2 = new FilterProvider();
    provider2.setState(state);
    expect(provider2.getFilters()).toHaveLength(1);
    expect(provider2.getFilters()[0]).toEqual({ field: 'folder', operator: 'eq', value: 'Work' });
  });

  it('resetToDefaults() clears all state', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setSearchQuery('hello');
    provider.resetToDefaults();
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
    expect(result.params).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 24 — axis filter API (FILT-03, FILT-05)
// ---------------------------------------------------------------------------

describe('FilterProvider.setAxisFilter() — basic storage and compile', () => {
  it('setAxisFilter stores values and compile() includes field IN (?, ?)', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note', 'task']);
    const result = provider.compile();
    expect(result.where).toContain('card_type IN (?, ?)');
    expect(result.params).toContain('note');
    expect(result.params).toContain('task');
  });

  it('setAxisFilter with empty array removes the axis filter (FILT-05: empty = unfiltered)', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.setAxisFilter('card_type', []);
    const result = provider.compile();
    expect(result.where).not.toContain('card_type IN');
    expect(result.where).toBe('deleted_at IS NULL');
  });

  it('setAxisFilter replaces previous values for same field (last wins)', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('folder', ['Work']);
    provider.setAxisFilter('folder', ['Personal', 'Projects']);
    const result = provider.compile();
    expect(result.where).toContain('folder IN (?, ?)');
    expect(result.params).toContain('Personal');
    expect(result.params).toContain('Projects');
    expect(result.params).not.toContain('Work');
  });

  it('multiple axis filters on different fields both appear as AND clauses', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.setAxisFilter('status', ['active']);
    const result = provider.compile();
    expect(result.where).toContain('card_type IN (?)');
    expect(result.where).toContain('status IN (?)');
    expect(result.params).toContain('note');
    expect(result.params).toContain('active');
  });
});

describe('FilterProvider.hasAxisFilter()', () => {
  it('returns true when filter is set with non-empty values', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    expect(provider.hasAxisFilter('card_type')).toBe(true);
  });

  it('returns false when no filter set for that field', () => {
    const provider = new FilterProvider();
    expect(provider.hasAxisFilter('card_type')).toBe(false);
  });

  it('returns false after setAxisFilter with empty array', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.setAxisFilter('card_type', []);
    expect(provider.hasAxisFilter('card_type')).toBe(false);
  });
});

describe('FilterProvider.getAxisFilter()', () => {
  it('returns a defensive copy of values', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note', 'task']);
    const values = provider.getAxisFilter('card_type');
    expect(values).toEqual(['note', 'task']);
    // Mutate the returned copy — should not affect internal state
    values.push('event');
    expect(provider.getAxisFilter('card_type')).toEqual(['note', 'task']);
  });

  it('returns [] for unset field', () => {
    const provider = new FilterProvider();
    expect(provider.getAxisFilter('card_type')).toEqual([]);
  });
});

describe('FilterProvider.clearAxis()', () => {
  it('removes only that field\'s axis filter', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.setAxisFilter('status', ['active']);
    provider.clearAxis('card_type');
    const result = provider.compile();
    expect(result.where).not.toContain('card_type IN');
    expect(result.where).toContain('status IN (?)');
  });

  it('does not affect regular filters', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setAxisFilter('card_type', ['note']);
    provider.clearAxis('card_type');
    const result = provider.compile();
    expect(result.where).toContain('folder = ?');
  });
});

describe('FilterProvider.clearAllAxisFilters()', () => {
  it('removes all axis filters', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.setAxisFilter('status', ['active']);
    provider.clearAllAxisFilters();
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
  });

  it('does not affect regular filters', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setAxisFilter('card_type', ['note']);
    provider.clearAllAxisFilters();
    const result = provider.compile();
    expect(result.where).toContain('folder = ?');
    expect(result.where).not.toContain('card_type IN');
  });
});

describe('FilterProvider.clearFilters() — axis filter integration', () => {
  it('clearFilters() removes both regular filters and axis filters', () => {
    const provider = new FilterProvider();
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    provider.setAxisFilter('card_type', ['note']);
    provider.clearFilters();
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
    expect(result.params).toEqual([]);
  });
});

describe('FilterProvider.resetToDefaults() — axis filter integration', () => {
  it('resetToDefaults() clears axis filters too', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.resetToDefaults();
    expect(provider.hasAxisFilter('card_type')).toBe(false);
    const result = provider.compile();
    expect(result.where).toBe('deleted_at IS NULL');
  });
});

describe('FilterProvider axis filter — SQL safety', () => {
  it('setAxisFilter throws for invalid field', () => {
    const provider = new FilterProvider();
    expect(() => provider.setAxisFilter('evil_field', ['note'])).toThrowError(/SQL safety violation/);
  });

  it('clearAxis throws for invalid field', () => {
    const provider = new FilterProvider();
    expect(() => provider.clearAxis('evil_field')).toThrowError(/SQL safety violation/);
  });
});

describe('FilterProvider axis filter — compile order', () => {
  it('regular filters appear before axis filters in WHERE clause', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
    const result = provider.compile();
    const folderIdx = result.where.indexOf('folder = ?');
    const cardTypeIdx = result.where.indexOf('card_type IN');
    expect(folderIdx).toBeLessThan(cardTypeIdx);
  });
});

describe('FilterProvider axis filter — persistence round-trip', () => {
  it('toJSON() includes axisFilters as Record<string, string[]>', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note', 'task']);
    const parsed = JSON.parse(provider.toJSON());
    expect(parsed.axisFilters).toBeDefined();
    expect(parsed.axisFilters['card_type']).toEqual(['note', 'task']);
  });

  it('toJSON / fromJSON round-trips axis filter state', () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note', 'task']);
    provider.setAxisFilter('status', ['active']);
    const json = provider.toJSON();

    const restored = FilterProvider.fromJSON(json);
    expect(restored.hasAxisFilter('card_type')).toBe(true);
    expect(restored.getAxisFilter('card_type')).toEqual(['note', 'task']);
    expect(restored.hasAxisFilter('status')).toBe(true);
    expect(restored.getAxisFilter('status')).toEqual(['active']);
  });

  it('setState() with missing axisFilters defaults to {} (backward compat)', () => {
    const provider = new FilterProvider();
    // Old-format state without axisFilters field
    provider.setState({ filters: [], searchQuery: null });
    expect(provider.hasAxisFilter('card_type')).toBe(false);
  });

  it('setState() with invalid axisFilters shape (non-object) throws', () => {
    const provider = new FilterProvider();
    expect(() =>
      provider.setState({ filters: [], searchQuery: null, axisFilters: 'bad' })
    ).toThrowError(/invalid state shape/);
  });

  it('setState() with non-array values in axisFilters throws', () => {
    const provider = new FilterProvider();
    expect(() =>
      provider.setState({ filters: [], searchQuery: null, axisFilters: { card_type: 'bad' } })
    ).toThrowError(/invalid state shape/);
  });
});

describe('FilterProvider axis filter — subscriber notifications', () => {
  it('setAxisFilter fires _scheduleNotify', async () => {
    const provider = new FilterProvider();
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.setAxisFilter('card_type', ['note']);
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clearAxis fires _scheduleNotify', async () => {
    const provider = new FilterProvider();
    provider.setAxisFilter('card_type', ['note']);
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.clearAxis('card_type');
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clearAllAxisFilters fires _scheduleNotify', async () => {
    const provider = new FilterProvider();
    const cb = vi.fn();
    provider.subscribe(cb);
    provider.clearAllAxisFilters();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
