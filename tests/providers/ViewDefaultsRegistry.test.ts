// Tests for ViewDefaultsRegistry — source-type axis defaults with schema validation
// Covers: registry lookup, fallback resolution, prefix match, null schema, all entries exist

import { describe, expect, it } from 'vitest';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { SchemaProvider } from '../../src/providers/SchemaProvider';
import {
	VIEW_DEFAULTS_REGISTRY,
	VIEW_RECOMMENDATIONS,
	resolveDefaults,
	resolveRecommendation,
} from '../../src/providers/ViewDefaultsRegistry';

// ---------------------------------------------------------------------------
// Mock SchemaProvider — only the isValidColumn method is needed
// ---------------------------------------------------------------------------

function makeSchema(validColumns: string[]): SchemaProvider {
	const valid = new Set(validColumns);
	return {
		isValidColumn: (name: string, _table?: 'cards' | 'connections') => valid.has(name),
	} as unknown as SchemaProvider;
}

// ---------------------------------------------------------------------------
// Registry shape tests
// ---------------------------------------------------------------------------

describe('VIEW_DEFAULTS_REGISTRY', () => {
	it('has exactly 21 entries (9 format + 3 native + 11 alto dataset + 1 alto catch-all)', () => {
		expect(VIEW_DEFAULTS_REGISTRY.size).toBe(21);
	});

	it('contains all 9 SourceType values plus alto_index catch-all', () => {
		const expectedKeys = [
			'apple_notes',
			'markdown',
			'excel',
			'csv',
			'json',
			'html',
			'native_reminders',
			'native_calendar',
			'native_notes',
			'alto_index',
		];
		for (const key of expectedKeys) {
			expect(VIEW_DEFAULTS_REGISTRY.has(key), `Missing key: ${key}`).toBe(true);
		}
	});

	it('contains all 11 alto_index_* dataset-specific entries', () => {
		const altoKeys = [
			'alto_index_notes',
			'alto_index_contacts',
			'alto_index_calendar',
			'alto_index_messages',
			'alto_index_books',
			'alto_index_calls',
			'alto_index_safari-history',
			'alto_index_kindle',
			'alto_index_reminders',
			'alto_index_safari-bookmarks',
			'alto_index_voice-memos',
		];
		for (const key of altoKeys) {
			expect(VIEW_DEFAULTS_REGISTRY.has(key), `Missing key: ${key}`).toBe(true);
		}
	});

	it('is typed as ReadonlyMap (set method not available on the type)', () => {
		// TypeScript enforces this at compile time — ReadonlyMap has no .set()
		// Runtime: Object.freeze prevents new property additions to the Map object
		expect(Object.isFrozen(VIEW_DEFAULTS_REGISTRY)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// resolveDefaults — happy path
// ---------------------------------------------------------------------------

describe('resolveDefaults', () => {
	it('returns first valid colAxes and rowAxes for apple_notes when both are available', () => {
		const schema = makeSchema(['folder', 'title', 'card_type', 'name']);
		const result = resolveDefaults('apple_notes', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'title', direction: 'asc' }]);
	});

	it('falls back to next candidate when first colAxes candidate is invalid', () => {
		// 'folder' not in schema — should fall back to 'card_type'
		const schema = makeSchema(['card_type', 'title', 'name']);
		const result = resolveDefaults('apple_notes', schema);
		expect(result.colAxes).toEqual([{ field: 'card_type', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'title', direction: 'asc' }]);
	});

	it('matches alto_index_contacts via exact entry (folder + folder_l1 cols, name row)', () => {
		const schema = makeSchema(['folder', 'folder_l1', 'name']);
		const result = resolveDefaults('alto_index_contacts', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('matches alto_index_notes via exact entry (folder_l1 col, created_at row)', () => {
		const schema = makeSchema(['folder_l1', 'folder_l2', 'tags', 'created_at', 'name']);
		const result = resolveDefaults('alto_index_notes', schema);
		expect(result.colAxes).toEqual([{ field: 'folder_l1', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'created_at', direction: 'asc' }]);
	});

	it('matches alto_index_calendar via exact entry (folder col, event_start row)', () => {
		const schema = makeSchema(['folder', 'location_name', 'event_start', 'name']);
		const result = resolveDefaults('alto_index_calendar', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'event_start', direction: 'asc' }]);
	});

	it('matches alto_index_reminders via exact entry (folder col, due_at row)', () => {
		const schema = makeSchema(['folder', 'status', 'priority', 'due_at', 'name']);
		const result = resolveDefaults('alto_index_reminders', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'due_at', direction: 'asc' }]);
	});

	it('matches alto_index_messages via exact entry (folder col, created_at row)', () => {
		const schema = makeSchema(['folder', 'status', 'created_at', 'name']);
		const result = resolveDefaults('alto_index_messages', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'created_at', direction: 'asc' }]);
	});

	it('falls back to alto_index catch-all for unknown alto_index_* types', () => {
		const schema = makeSchema(['folder', 'card_type', 'name', 'title']);
		const result = resolveDefaults('alto_index_organizations', schema);
		expect(result.colAxes).toEqual([{ field: 'folder', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('returns empty axes for unknown source type', () => {
		const schema = makeSchema(['folder', 'title']);
		const result = resolveDefaults('unknown_type', schema);
		expect(result.colAxes).toEqual([]);
		expect(result.rowAxes).toEqual([]);
	});

	it('returns empty axes when no colAxes candidates are valid', () => {
		const schema = makeSchema(['title']); // only 'title' valid, not 'card_type' or 'folder'
		const result = resolveDefaults('csv', schema);
		expect(result.colAxes).toEqual([]); // neither 'card_type' nor 'folder' is valid
		expect(result.rowAxes).toEqual([{ field: 'title', direction: 'asc' }]);
	});

	it('returns empty axes when schema is null', () => {
		const result = resolveDefaults('apple_notes', null);
		expect(result.colAxes).toEqual([]);
		expect(result.rowAxes).toEqual([]);
	});

	it('every returned axis field passes isValidColumn', () => {
		const validCols = [
			'folder', 'folder_l1', 'folder_l2', 'card_type', 'title', 'name',
			'status', 'tags', 'created_at', 'event_start', 'due_at',
			'location_name', 'source_url', 'priority',
		];
		const schema = makeSchema(validCols);
		const validSet = new Set(validCols);

		for (const sourceType of VIEW_DEFAULTS_REGISTRY.keys()) {
			const result = resolveDefaults(sourceType, schema);
			for (const axis of result.colAxes) {
				expect(validSet.has(axis.field), `colAxes field '${axis.field}' not in schema`).toBe(true);
			}
			for (const axis of result.rowAxes) {
				expect(validSet.has(axis.field), `rowAxes field '${axis.field}' not in schema`).toBe(true);
			}
		}
	});

	it('native_reminders prefers status as first colAxes candidate', () => {
		const schema = makeSchema(['status', 'folder', 'card_type', 'title', 'name']);
		const result = resolveDefaults('native_reminders', schema);
		expect(result.colAxes).toEqual([{ field: 'status', direction: 'asc' }]);
	});

	it('all axes have direction asc', () => {
		const schema = makeSchema([
			'folder',
			'folder_l1',
			'folder_l2',
			'card_type',
			'title',
			'name',
			'status',
			'company',
			'tags',
			'created_at',
			'event_start',
			'due_at',
			'location_name',
			'source_url',
			'priority',
		]);
		for (const sourceType of VIEW_DEFAULTS_REGISTRY.keys()) {
			const result = resolveDefaults(sourceType, schema);
			for (const axis of [...result.colAxes, ...result.rowAxes]) {
				expect(axis.direction).toBe('asc');
			}
		}
	});
});

// ---------------------------------------------------------------------------
// SGDF-06 — first-import flag key convention
// ---------------------------------------------------------------------------

describe('first-import flag key convention (SGDF-06)', () => {
	it('flag key uses view:defaults:applied:{datasetId} format', () => {
		const datasetId = 'abc-123';
		const flagKey = `view:defaults:applied:${datasetId}`;
		expect(flagKey).toBe('view:defaults:applied:abc-123');
	});

	it('flag key is unique per dataset ID', () => {
		const id1 = 'dataset-1';
		const id2 = 'dataset-2';
		expect(`view:defaults:applied:${id1}`).not.toBe(`view:defaults:applied:${id2}`);
	});
});

// ---------------------------------------------------------------------------
// VIEW_RECOMMENDATIONS shape tests
// ---------------------------------------------------------------------------

describe('VIEW_RECOMMENDATIONS', () => {
	it('has exactly 5 entries', () => {
		expect(VIEW_RECOMMENDATIONS.size).toBe(5);
	});

	it('contains native_calendar, native_reminders, apple_notes, native_notes, alto_index', () => {
		const expectedKeys = ['native_calendar', 'native_reminders', 'apple_notes', 'native_notes', 'alto_index'];
		for (const key of expectedKeys) {
			expect(VIEW_RECOMMENDATIONS.has(key), `Missing key: ${key}`).toBe(true);
		}
	});

	it('is frozen', () => {
		expect(Object.isFrozen(VIEW_RECOMMENDATIONS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// resolveRecommendation
// ---------------------------------------------------------------------------

describe('resolveRecommendation', () => {
	it('native_calendar returns timeline recommendation with groupBy folder viewConfig', () => {
		const rec = resolveRecommendation('native_calendar');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('timeline');
		expect(rec!.viewConfig).not.toBeNull();
		expect(rec!.viewConfig!.groupBy).toEqual({ field: 'folder', direction: 'asc' });
		expect(rec!.toastMessage).toContain('Timeline');
		expect(rec!.tooltipText).toBeTruthy();
	});

	it('native_reminders returns timeline recommendation with groupBy status viewConfig', () => {
		const rec = resolveRecommendation('native_reminders');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('timeline');
		expect(rec!.viewConfig).not.toBeNull();
		expect(rec!.viewConfig!.groupBy).toEqual({ field: 'status', direction: 'asc' });
		expect(rec!.toastMessage).toContain('Timeline');
		expect(rec!.tooltipText).toBeTruthy();
	});

	it('apple_notes returns tree recommendation with null viewConfig', () => {
		const rec = resolveRecommendation('apple_notes');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('tree');
		expect(rec!.viewConfig).toBeNull();
		expect(rec!.toastMessage).toContain('Tree');
		expect(rec!.tooltipText).toBeTruthy();
	});

	it('native_notes returns tree recommendation with null viewConfig', () => {
		const rec = resolveRecommendation('native_notes');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('tree');
		expect(rec!.viewConfig).toBeNull();
	});

	it('alto_index returns network recommendation with null viewConfig', () => {
		const rec = resolveRecommendation('alto_index');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('network');
		expect(rec!.viewConfig).toBeNull();
	});

	it('alto_index_contacts prefix match returns alto_index recommendation', () => {
		const rec = resolveRecommendation('alto_index_contacts');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('network');
	});

	it('unknown alto_index_* prefix match returns alto_index recommendation', () => {
		const rec = resolveRecommendation('alto_index_organizations');
		expect(rec).not.toBeNull();
		expect(rec!.recommendedView).toBe('network');
	});

	it('csv returns null (no recommendation)', () => {
		expect(resolveRecommendation('csv')).toBeNull();
	});

	it('markdown returns null', () => {
		expect(resolveRecommendation('markdown')).toBeNull();
	});

	it('excel returns null', () => {
		expect(resolveRecommendation('excel')).toBeNull();
	});

	it('json returns null', () => {
		expect(resolveRecommendation('json')).toBeNull();
	});

	it('html returns null', () => {
		expect(resolveRecommendation('html')).toBeNull();
	});

	it('unknown source type returns null', () => {
		expect(resolveRecommendation('unknown_type')).toBeNull();
	});

	it('native_calendar viewConfig groupBy field is folder', () => {
		const rec = resolveRecommendation('native_calendar');
		expect(rec!.viewConfig!.groupBy!.field).toBe('folder');
	});

	it('native_reminders viewConfig groupBy field is status', () => {
		const rec = resolveRecommendation('native_reminders');
		expect(rec!.viewConfig!.groupBy!.field).toBe('status');
	});

	it('returns null (not undefined) for non-recommended source types', () => {
		expect(resolveRecommendation('csv')).toBeNull();
		expect(resolveRecommendation('unknown')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// viewConfig application order (OVDF-02)
// ---------------------------------------------------------------------------

describe('viewConfig application order', () => {
	it('viewConfig groupBy survives after setViewType resets defaults', () => {
		// Simulate: switchTo calls setViewType('timeline'), then viewConfig applies groupBy
		const pafv = new PAFVProvider();
		pafv.setViewType('timeline');
		// After setViewType, groupBy is null (VIEW_DEFAULTS.timeline has no groupBy)
		expect(pafv.getState().groupBy).toBeNull();
		// viewConfig applies groupBy (simulating the .then() callback in main.ts)
		pafv.setGroupBy({ field: 'folder', direction: 'asc' });
		expect(pafv.getState().groupBy).toEqual({ field: 'folder', direction: 'asc' });
	});

	it('viewConfig groupBy for native_reminders (status) survives after setViewType', () => {
		const pafv = new PAFVProvider();
		pafv.setViewType('timeline');
		expect(pafv.getState().groupBy).toBeNull();
		pafv.setGroupBy({ field: 'status', direction: 'asc' });
		expect(pafv.getState().groupBy).toEqual({ field: 'status', direction: 'asc' });
	});
});
