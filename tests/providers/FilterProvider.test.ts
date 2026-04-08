// Isometry v5 — Phase 4 Plan 01 (Task 2)
// Tests for FilterProvider: SQL compilation, subscriber pattern, serialization.
//
// Requirements: PROV-01, PROV-02, PROV-11
// TDD Phase: RED → GREEN → REFACTOR

import { describe, expect, it, vi } from 'vitest';
import { FilterProvider } from '../../src/providers/FilterProvider';
import type { Filter, MembershipFilter } from '../../src/providers/types';

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
			'deleted_at IS NULL AND folder = ? AND status = ? AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)',
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
	it("removes only that field's axis filter", () => {
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
		expect(() => provider.setState({ filters: [], searchQuery: null, axisFilters: 'bad' })).toThrowError(
			/invalid state shape/,
		);
	});

	it('setState() with non-array values in axisFilters throws', () => {
		const provider = new FilterProvider();
		expect(() => provider.setState({ filters: [], searchQuery: null, axisFilters: { card_type: 'bad' } })).toThrowError(
			/invalid state shape/,
		);
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

// ---------------------------------------------------------------------------
// Phase 66 — Range filter API (LTPB-01)
// ---------------------------------------------------------------------------

describe('FilterProvider.setRangeFilter() — basic storage and compile', () => {
	it('setRangeFilter stores a range and compile() produces field >= ? AND field <= ?', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		const result = provider.compile();
		expect(result.where).toContain('priority >= ?');
		expect(result.where).toContain('priority <= ?');
		expect(result.params).toContain(1);
		expect(result.params).toContain(5);
	});

	it('calling setRangeFilter again REPLACES the previous range (not appends)', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		provider.setRangeFilter('priority', 2, 8);
		const result = provider.compile();
		// Should only have one pair of range clauses for priority
		const matches = result.where.match(/priority >= \?/g);
		expect(matches).toHaveLength(1);
		expect(result.params).toContain(2);
		expect(result.params).toContain(8);
		expect(result.params).not.toContain(1);
		expect(result.params).not.toContain(5);
	});

	it('setRangeFilter with min only (max=null) produces field >= ? only', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 3, null);
		const result = provider.compile();
		expect(result.where).toContain('priority >= ?');
		expect(result.where).not.toContain('priority <= ?');
		expect(result.params).toContain(3);
	});

	it('setRangeFilter with max only (min=null) produces field <= ? only', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', null, 7);
		const result = provider.compile();
		expect(result.where).not.toContain('priority >= ?');
		expect(result.where).toContain('priority <= ?');
		expect(result.params).toContain(7);
	});

	it('setRangeFilter with both null removes the entry (equivalent to clear)', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		provider.setRangeFilter('priority', null, null);
		const result = provider.compile();
		expect(result.where).not.toContain('priority >= ?');
		expect(result.where).not.toContain('priority <= ?');
		expect(result.where).toBe('deleted_at IS NULL');
	});
});

describe('FilterProvider.clearRangeFilter()', () => {
	it('removes the range without affecting other filters or axis filters', () => {
		const provider = new FilterProvider();
		provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
		provider.setAxisFilter('card_type', ['note']);
		provider.setRangeFilter('priority', 1, 5);
		provider.clearRangeFilter('priority');
		const result = provider.compile();
		expect(result.where).not.toContain('priority >= ?');
		expect(result.where).not.toContain('priority <= ?');
		expect(result.where).toContain('folder = ?');
		expect(result.where).toContain('card_type IN (?)');
	});
});

describe('FilterProvider.hasRangeFilter()', () => {
	it('returns true when set', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		expect(provider.hasRangeFilter('priority')).toBe(true);
	});

	it('returns false when not set', () => {
		const provider = new FilterProvider();
		expect(provider.hasRangeFilter('priority')).toBe(false);
	});

	it('returns false after clearRangeFilter', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		provider.clearRangeFilter('priority');
		expect(provider.hasRangeFilter('priority')).toBe(false);
	});
});

describe('FilterProvider range filter — integration with clearFilters/resetToDefaults/hasActiveFilters', () => {
	it('clearFilters() clears range filters alongside regular and axis filters', () => {
		const provider = new FilterProvider();
		provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
		provider.setAxisFilter('card_type', ['note']);
		provider.setRangeFilter('priority', 1, 5);
		provider.clearFilters();
		const result = provider.compile();
		expect(result.where).toBe('deleted_at IS NULL');
		expect(result.params).toEqual([]);
	});

	it('resetToDefaults() clears range filters', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		provider.resetToDefaults();
		expect(provider.hasRangeFilter('priority')).toBe(false);
		const result = provider.compile();
		expect(result.where).toBe('deleted_at IS NULL');
	});

	it('hasActiveFilters() returns true when range filters exist', () => {
		const provider = new FilterProvider();
		expect(provider.hasActiveFilters()).toBe(false);
		provider.setRangeFilter('priority', 1, 5);
		expect(provider.hasActiveFilters()).toBe(true);
	});
});

describe('FilterProvider range filter — compile order', () => {
	it('range filters compile AFTER axis filters, BEFORE FTS', () => {
		const provider = new FilterProvider();
		provider.setAxisFilter('card_type', ['note']);
		provider.setRangeFilter('priority', 1, 5);
		provider.setSearchQuery('hello');
		const result = provider.compile();
		const axisIdx = result.where.indexOf('card_type IN');
		const rangeIdx = result.where.indexOf('priority >= ?');
		const ftsIdx = result.where.indexOf('rowid IN');
		expect(axisIdx).toBeLessThan(rangeIdx);
		expect(rangeIdx).toBeLessThan(ftsIdx);
	});
});

describe('FilterProvider range filter — persistence round-trip', () => {
	it('toJSON() includes rangeFilters as Record<string, {min, max}>', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		const parsed = JSON.parse(provider.toJSON());
		expect(parsed.rangeFilters).toBeDefined();
		expect(parsed.rangeFilters['priority']).toEqual({ min: 1, max: 5 });
	});

	it('toJSON / fromJSON round-trip preserves range filter state', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		provider.setRangeFilter('sort_order', 0, 100);
		const json = provider.toJSON();

		const restored = FilterProvider.fromJSON(json);
		expect(restored.hasRangeFilter('priority')).toBe(true);
		expect(restored.hasRangeFilter('sort_order')).toBe(true);
		const result = restored.compile();
		expect(result.where).toContain('priority >= ?');
		expect(result.where).toContain('priority <= ?');
		expect(result.where).toContain('sort_order >= ?');
		expect(result.where).toContain('sort_order <= ?');
	});

	it('setState() with missing rangeFilters defaults to empty (backward compat)', () => {
		const provider = new FilterProvider();
		provider.setState({ filters: [], searchQuery: null });
		expect(provider.hasRangeFilter('priority')).toBe(false);
	});

	it('setState() validates rangeFilters shape (must be object with min/max per key)', () => {
		const provider = new FilterProvider();
		expect(() => provider.setState({ filters: [], searchQuery: null, rangeFilters: 'bad' })).toThrowError(
			/invalid state shape/,
		);
	});

	it('setState() rejects rangeFilters entries without min/max keys', () => {
		const provider = new FilterProvider();
		expect(() =>
			provider.setState({ filters: [], searchQuery: null, rangeFilters: { priority: { only_min: 1 } } }),
		).toThrowError(/invalid state shape/);
	});
});

describe('FilterProvider range filter — SQL safety', () => {
	it('setRangeFilter throws SQL safety violation for invalid field', () => {
		const provider = new FilterProvider();
		expect(() => provider.setRangeFilter('evil_field', 1, 5)).toThrowError(/SQL safety violation/);
	});

	it('clearRangeFilter throws SQL safety violation for invalid field', () => {
		const provider = new FilterProvider();
		expect(() => provider.clearRangeFilter('evil_field')).toThrowError(/SQL safety violation/);
	});
});

describe('FilterProvider range filter — subscriber notifications', () => {
	it('setRangeFilter fires subscriber notification via _scheduleNotify', async () => {
		const provider = new FilterProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setRangeFilter('priority', 1, 5);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('clearRangeFilter fires subscriber notification', async () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('priority', 1, 5);
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.clearRangeFilter('priority');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('two rapid setRangeFilter calls produce only ONE notification (batching)', async () => {
		const provider = new FilterProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setRangeFilter('priority', 1, 5);
		provider.setRangeFilter('sort_order', 0, 100);
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// TFLT-01 — Time range filters (ISO string min/max for time fields)
// ---------------------------------------------------------------------------

describe('FilterProvider — time range filters (TFLT-01)', () => {
	it('setRangeFilter with ISO string min+max compiles to field >= ? AND field <= ? with correct params', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('created_at', '2026-01-01', '2026-03-31');
		const result = provider.compile();
		expect(result.where).toContain('created_at >= ?');
		expect(result.where).toContain('created_at <= ?');
		expect(result.params).toContain('2026-01-01');
		expect(result.params).toContain('2026-03-31');
	});

	it('setRangeFilter with ISO string min only (max=null) compiles to field >= ? only (open-ended max)', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('due_at', '2026-06-01', null);
		const result = provider.compile();
		expect(result.where).toContain('due_at >= ?');
		expect(result.where).not.toContain('due_at <= ?');
		expect(result.params).toContain('2026-06-01');
	});

	it('setRangeFilter with ISO string max only (min=null) compiles to field <= ? only (open-ended min)', () => {
		const provider = new FilterProvider();
		provider.setRangeFilter('modified_at', null, '2026-12-31');
		const result = provider.compile();
		expect(result.where).not.toContain('modified_at >= ?');
		expect(result.where).toContain('modified_at <= ?');
		expect(result.params).toContain('2026-12-31');
	});
});

// ---------------------------------------------------------------------------
// TFLT-03 — Multi-field OR-semantics membership filter
// ---------------------------------------------------------------------------

describe('FilterProvider — multi-field membership filter (TFLT-03)', () => {
	// Test 1: three-field membership filter compiles to parenthesized OR clause with 6 params
	it('setMembershipFilter with 3 fields compiles to ((f1 >= ? AND f1 <= ?) OR (f2 >= ? AND f2 <= ?) OR (f3 >= ? AND f3 <= ?)) with 6 params', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at', 'modified_at', 'due_at'], '2026-01-01', '2026-03-31');
		const result = provider.compile();
		expect(result.where).toContain('(created_at >= ? AND created_at <= ?)');
		expect(result.where).toContain('(modified_at >= ? AND modified_at <= ?)');
		expect(result.where).toContain('(due_at >= ? AND due_at <= ?)');
		// Outer parentheses wrapping the OR clause
		expect(result.where).toMatch(/\(\(created_at >= \? AND created_at <= \?\) OR \(modified_at >= \? AND modified_at <= \?\) OR \(due_at >= \? AND due_at <= \?\)\)/);
		expect(result.params).toEqual(['2026-01-01', '2026-03-31', '2026-01-01', '2026-03-31', '2026-01-01', '2026-03-31']);
	});

	// Test 2: single-field membership filter compiles to parenthesized clause (no OR)
	it('setMembershipFilter with single field compiles to (field >= ? AND field <= ?) — still parenthesized', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		const result = provider.compile();
		expect(result.where).toContain('(created_at >= ? AND created_at <= ?)');
		expect(result.where).not.toContain(' OR ');
		expect(result.params).toContain('2026-01-01');
		expect(result.params).toContain('2026-03-31');
	});

	// Test 3: min only (max=null) produces open-ended OR clause
	it('setMembershipFilter with min only (max=null) compiles to (f1 >= ?) OR (f2 >= ?) — open-ended', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at', 'modified_at'], '2026-01-01', null);
		const result = provider.compile();
		expect(result.where).toContain('(created_at >= ?)');
		expect(result.where).toContain('(modified_at >= ?)');
		expect(result.where).not.toContain('created_at <= ?');
		expect(result.where).not.toContain('modified_at <= ?');
		expect(result.params).toContain('2026-01-01');
	});

	// Test 4: max only (min=null) produces open-ended OR clause
	it('setMembershipFilter with max only (min=null) compiles to (f1 <= ?) OR (f2 <= ?) — open-ended', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at', 'modified_at'], null, '2026-12-31');
		const result = provider.compile();
		expect(result.where).toContain('(created_at <= ?)');
		expect(result.where).toContain('(modified_at <= ?)');
		expect(result.where).not.toContain('created_at >= ?');
		expect(result.where).not.toContain('modified_at >= ?');
		expect(result.params).toContain('2026-12-31');
	});

	// Test 5: clearMembershipFilter removes the membership filter
	it('clearMembershipFilter() removes the membership filter from compile() output', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at', 'modified_at'], '2026-01-01', '2026-03-31');
		provider.clearMembershipFilter();
		const result = provider.compile();
		expect(result.where).toBe('deleted_at IS NULL');
		expect(result.params).toEqual([]);
	});

	// Test 6: hasMembershipFilter returns true when set, false when cleared
	it('hasMembershipFilter() returns true when set, false when cleared', () => {
		const provider = new FilterProvider();
		expect(provider.hasMembershipFilter()).toBe(false);
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		expect(provider.hasMembershipFilter()).toBe(true);
		provider.clearMembershipFilter();
		expect(provider.hasMembershipFilter()).toBe(false);
	});

	// Test 7: empty fields array is a no-op (clears any existing membership filter)
	it('setMembershipFilter with empty fields array clears any existing membership filter', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		provider.setMembershipFilter([], '2026-01-01', '2026-03-31');
		expect(provider.hasMembershipFilter()).toBe(false);
		expect(provider.compile().where).toBe('deleted_at IS NULL');
	});

	// Test 8: both min and max null clears the membership filter
	it('setMembershipFilter with both min and max null clears the membership filter', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		provider.setMembershipFilter(['created_at'], null, null);
		expect(provider.hasMembershipFilter()).toBe(false);
		expect(provider.compile().where).toBe('deleted_at IS NULL');
	});

	// Test 9: SQL safety — invalid field throws
	it('setMembershipFilter with invalid field throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => provider.setMembershipFilter(['evil_field'], '2026-01-01', '2026-03-31')).toThrowError(/SQL safety violation/);
	});

	// Test 10: membership filter coexists with regular filters and range filters (AND-joined)
	it('membership filter coexists with regular filters and range filters (AND-joined)', () => {
		const provider = new FilterProvider();
		provider.addFilter({ field: 'folder', operator: 'eq', value: 'Work' });
		provider.setRangeFilter('priority', 1, 5);
		provider.setMembershipFilter(['created_at', 'due_at'], '2026-01-01', '2026-03-31');
		const result = provider.compile();
		expect(result.where).toContain('folder = ?');
		expect(result.where).toContain('priority >= ?');
		expect(result.where).toContain('priority <= ?');
		expect(result.where).toContain('(created_at >= ? AND created_at <= ?)');
		expect(result.where).toContain('(due_at >= ? AND due_at <= ?)');
	});

	// Test 11: persistence round-trip
	it('toJSON includes membershipFilter, fromJSON restores it', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at', 'modified_at'], '2026-01-01', '2026-03-31');
		const json = provider.toJSON();
		const parsed = JSON.parse(json);
		expect(parsed.membershipFilter).toBeDefined();
		expect(parsed.membershipFilter.fields).toEqual(['created_at', 'modified_at']);
		expect(parsed.membershipFilter.min).toBe('2026-01-01');
		expect(parsed.membershipFilter.max).toBe('2026-03-31');

		const restored = FilterProvider.fromJSON(json);
		expect(restored.hasMembershipFilter()).toBe(true);
		const result = restored.compile();
		expect(result.where).toContain('(created_at >= ? AND created_at <= ?)');
		expect(result.where).toContain('(modified_at >= ? AND modified_at <= ?)');
	});

	// Test 12: setState with missing membershipFilter defaults to null (backward compat)
	it('setState with missing membershipFilter defaults to null (backward compat)', () => {
		const provider = new FilterProvider();
		provider.setState({ filters: [], searchQuery: null });
		expect(provider.hasMembershipFilter()).toBe(false);
		expect(provider.compile().where).toBe('deleted_at IS NULL');
	});

	// Test 13: clearFilters() also clears membership filter
	it('clearFilters() also clears membership filter', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		provider.clearFilters();
		expect(provider.hasMembershipFilter()).toBe(false);
		expect(provider.compile().where).toBe('deleted_at IS NULL');
	});

	// Test 14: resetToDefaults() clears membership filter
	it('resetToDefaults() clears membership filter', () => {
		const provider = new FilterProvider();
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		provider.resetToDefaults();
		expect(provider.hasMembershipFilter()).toBe(false);
		expect(provider.compile().where).toBe('deleted_at IS NULL');
	});

	// Test 15: hasActiveFilters() returns true when membership filter exists
	it('hasActiveFilters() returns true when membership filter exists', () => {
		const provider = new FilterProvider();
		expect(provider.hasActiveFilters()).toBe(false);
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		expect(provider.hasActiveFilters()).toBe(true);
	});

	// Test 16: subscriber notification fires on setMembershipFilter
	it('subscriber notification fires on setMembershipFilter', async () => {
		const provider = new FilterProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setMembershipFilter(['created_at'], '2026-01-01', '2026-03-31');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// Suppress unused import warning for MembershipFilter — used by tests above
const _mf: MembershipFilter | null = null;
void _mf;
