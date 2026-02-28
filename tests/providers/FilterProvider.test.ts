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
