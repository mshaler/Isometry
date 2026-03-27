// Tests for ViewDefaultsRegistry — source-type axis defaults with schema validation
// Covers: registry lookup, fallback resolution, prefix match, null schema, all entries exist

import { describe, expect, it } from 'vitest';
import type { SchemaProvider } from '../../src/providers/SchemaProvider';
import { VIEW_DEFAULTS_REGISTRY, resolveDefaults } from '../../src/providers/ViewDefaultsRegistry';

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
	it('has exactly 10 entries', () => {
		expect(VIEW_DEFAULTS_REGISTRY.size).toBe(10);
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

	it('matches alto_index_contacts via startsWith prefix to alto_index entry', () => {
		const schema = makeSchema(['company', 'folder', 'name', 'card_type', 'title']);
		const result = resolveDefaults('alto_index_contacts', schema);
		expect(result.colAxes).toEqual([{ field: 'company', direction: 'asc' }]);
		expect(result.rowAxes).toEqual([{ field: 'name', direction: 'asc' }]);
	});

	it('matches alto_index_organizations via startsWith prefix to alto_index entry', () => {
		const schema = makeSchema(['company', 'name']);
		const result = resolveDefaults('alto_index_organizations', schema);
		expect(result.colAxes).toEqual([{ field: 'company', direction: 'asc' }]);
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
		const validCols = ['folder', 'card_type', 'title', 'name', 'status'];
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
			'card_type',
			'title',
			'name',
			'status',
			'company',
		]);
		for (const sourceType of VIEW_DEFAULTS_REGISTRY.keys()) {
			const result = resolveDefaults(sourceType, schema);
			for (const axis of [...result.colAxes, ...result.rowAxes]) {
				expect(axis.direction).toBe('asc');
			}
		}
	});
});
