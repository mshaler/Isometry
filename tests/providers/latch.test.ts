// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 01 (Task 1) + Phase 71 Plan 01 (Task 1)
// Tests for LATCH family classification map.
//
// Requirements: PROP-02, DYNM-01, DYNM-02, DYNM-03, DYNM-04
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, describe, expect, it } from 'vitest';
import {
	LATCH_COLORS,
	LATCH_FAMILIES,
	LATCH_LABELS,
	LATCH_ORDER,
	getLatchFamily,
	setLatchSchemaProvider,
	toLetter,
	toFullName,
} from '../../src/providers/latch';
import type { AxisField } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// LATCH_FAMILIES — maps all 9 AxisField values to LatchFamily letters
// ---------------------------------------------------------------------------

describe('LATCH_FAMILIES', () => {
	it('maps name to Alphabet (A)', () => {
		expect(LATCH_FAMILIES['name']).toBe('A');
	});

	it('maps created_at to Time (T)', () => {
		expect(LATCH_FAMILIES['created_at']).toBe('T');
	});

	it('maps modified_at to Time (T)', () => {
		expect(LATCH_FAMILIES['modified_at']).toBe('T');
	});

	it('maps due_at to Time (T)', () => {
		expect(LATCH_FAMILIES['due_at']).toBe('T');
	});

	it('maps folder to Category (C)', () => {
		expect(LATCH_FAMILIES['folder']).toBe('C');
	});

	it('maps status to Category (C)', () => {
		expect(LATCH_FAMILIES['status']).toBe('C');
	});

	it('maps card_type to Category (C)', () => {
		expect(LATCH_FAMILIES['card_type']).toBe('C');
	});

	it('maps priority to Hierarchy (H)', () => {
		expect(LATCH_FAMILIES['priority']).toBe('H');
	});

	it('maps sort_order to Hierarchy (H)', () => {
		expect(LATCH_FAMILIES['sort_order']).toBe('H');
	});

	it('covers all 9 AxisField values', () => {
		const allFields: AxisField[] = [
			'created_at',
			'modified_at',
			'due_at',
			'folder',
			'status',
			'card_type',
			'priority',
			'sort_order',
			'name',
		];
		for (const field of allFields) {
			expect(LATCH_FAMILIES[field]).toBeDefined();
		}
		expect(Object.keys(LATCH_FAMILIES)).toHaveLength(9);
	});

	it('is frozen (immutable)', () => {
		expect(Object.isFrozen(LATCH_FAMILIES)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// LATCH_ORDER — canonical family display order
// ---------------------------------------------------------------------------

describe('LATCH_ORDER', () => {
	it('has 5 entries', () => {
		expect(LATCH_ORDER).toHaveLength(5);
	});

	it('is ordered L, A, T, C, H', () => {
		expect(LATCH_ORDER).toEqual(['L', 'A', 'T', 'C', 'H']);
	});

	it('is frozen (immutable)', () => {
		expect(Object.isFrozen(LATCH_ORDER)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// LATCH_LABELS — human-readable family names
// ---------------------------------------------------------------------------

describe('LATCH_LABELS', () => {
	it('has 5 entries', () => {
		expect(Object.keys(LATCH_LABELS)).toHaveLength(5);
	});

	it('maps L to Location', () => {
		expect(LATCH_LABELS.L).toBe('Location');
	});

	it('maps A to Alphabet', () => {
		expect(LATCH_LABELS.A).toBe('Alphabet');
	});

	it('maps T to Time', () => {
		expect(LATCH_LABELS.T).toBe('Time');
	});

	it('maps C to Category', () => {
		expect(LATCH_LABELS.C).toBe('Category');
	});

	it('maps H to Hierarchy', () => {
		expect(LATCH_LABELS.H).toBe('Hierarchy');
	});

	it('is frozen (immutable)', () => {
		expect(Object.isFrozen(LATCH_LABELS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// LATCH_COLORS — CSS custom property references per family
// ---------------------------------------------------------------------------

describe('LATCH_COLORS', () => {
	it('has 5 entries', () => {
		expect(Object.keys(LATCH_COLORS)).toHaveLength(5);
	});

	it('each value is a CSS var() reference', () => {
		for (const family of LATCH_ORDER) {
			expect(LATCH_COLORS[family]).toMatch(/^var\(--latch-/);
		}
	});

	it('maps L to var(--latch-location)', () => {
		expect(LATCH_COLORS.L).toBe('var(--latch-location)');
	});

	it('maps A to var(--latch-alphabet)', () => {
		expect(LATCH_COLORS.A).toBe('var(--latch-alphabet)');
	});

	it('maps T to var(--latch-time)', () => {
		expect(LATCH_COLORS.T).toBe('var(--latch-time)');
	});

	it('maps C to var(--latch-category)', () => {
		expect(LATCH_COLORS.C).toBe('var(--latch-category)');
	});

	it('maps H to var(--latch-hierarchy)', () => {
		expect(LATCH_COLORS.H).toBe('var(--latch-hierarchy)');
	});

	it('is frozen (immutable)', () => {
		expect(Object.isFrozen(LATCH_COLORS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// toLetter — maps protocol LatchFamily (full name) to UI LatchFamily (letter)
// ---------------------------------------------------------------------------

describe('toLetter', () => {
	it('maps Location to L', () => {
		expect(toLetter('Location')).toBe('L');
	});

	it('maps Alphabet to A', () => {
		expect(toLetter('Alphabet')).toBe('A');
	});

	it('maps Time to T', () => {
		expect(toLetter('Time')).toBe('T');
	});

	it('maps Category to C', () => {
		expect(toLetter('Category')).toBe('C');
	});

	it('maps Hierarchy to H', () => {
		expect(toLetter('Hierarchy')).toBe('H');
	});
});

// ---------------------------------------------------------------------------
// toFullName — maps UI LatchFamily (letter) to protocol LatchFamily (full name)
// ---------------------------------------------------------------------------

describe('toFullName', () => {
	it('maps L to Location', () => {
		expect(toFullName('L')).toBe('Location');
	});

	it('maps A to Alphabet', () => {
		expect(toFullName('A')).toBe('Alphabet');
	});

	it('maps T to Time', () => {
		expect(toFullName('T')).toBe('Time');
	});

	it('maps C to Category', () => {
		expect(toFullName('C')).toBe('Category');
	});

	it('maps H to Hierarchy', () => {
		expect(toFullName('H')).toBe('Hierarchy');
	});
});

// ---------------------------------------------------------------------------
// getLatchFamily — dynamic LATCH family lookup with optional SchemaProvider
// ---------------------------------------------------------------------------

describe('getLatchFamily', () => {
	afterEach(() => {
		// Always reset after each test to avoid cross-test contamination
		setLatchSchemaProvider(null);
	});

	it('returns T for created_at when SchemaProvider is NOT wired (fallback)', () => {
		setLatchSchemaProvider(null);
		expect(getLatchFamily('created_at')).toBe('T');
	});

	it('returns A for name when SchemaProvider is NOT wired (fallback)', () => {
		setLatchSchemaProvider(null);
		expect(getLatchFamily('name')).toBe('A');
	});

	it('returns C for folder when SchemaProvider is NOT wired (fallback)', () => {
		setLatchSchemaProvider(null);
		expect(getLatchFamily('folder')).toBe('C');
	});

	it('returns A (default) for unknown custom_field when SchemaProvider is NOT wired', () => {
		setLatchSchemaProvider(null);
		expect(getLatchFamily('custom_field')).toBe('A');
	});

	it('returns correct letter when SchemaProvider IS wired with mock data', () => {
		const mockSchemaProvider = {
			initialized: true,
			getColumns: (_table: 'cards' | 'connections') => [
				{ name: 'custom_field', type: 'TEXT', notnull: false, dflt_value: null, pk: false, isNumeric: false, latchFamily: 'Category' as const },
				{ name: 'geo_zone', type: 'TEXT', notnull: false, dflt_value: null, pk: false, isNumeric: false, latchFamily: 'Location' as const },
			],
			isValidColumn: (_name: string) => true,
			getFilterableColumns: () => [],
			getAxisColumns: () => [],
			getNumericColumns: () => [],
			getFieldsByFamily: () => [],
			getLatchFamilies: () => new Map(),
			subscribe: (_cb: () => void) => () => {},
		};
		setLatchSchemaProvider(mockSchemaProvider as any);
		expect(getLatchFamily('custom_field')).toBe('C');
		expect(getLatchFamily('geo_zone')).toBe('L');
	});

	it('falls back to A for field not found in SchemaProvider columns', () => {
		const mockSchemaProvider = {
			initialized: true,
			getColumns: (_table: 'cards' | 'connections') => [
				{ name: 'other_field', type: 'TEXT', notnull: false, dflt_value: null, pk: false, isNumeric: false, latchFamily: 'Alphabet' as const },
			],
			isValidColumn: (_name: string) => true,
			getFilterableColumns: () => [],
			getAxisColumns: () => [],
			getNumericColumns: () => [],
			getFieldsByFamily: () => [],
			getLatchFamilies: () => new Map(),
			subscribe: (_cb: () => void) => () => {},
		};
		setLatchSchemaProvider(mockSchemaProvider as any);
		// 'missing_field' not in columns -> falls back to A
		expect(getLatchFamily('missing_field')).toBe('A');
	});

	it('resets to fallback behavior after setLatchSchemaProvider(null)', () => {
		const mockSchemaProvider = {
			initialized: true,
			getColumns: (_table: 'cards' | 'connections') => [
				{ name: 'custom_field', type: 'TEXT', notnull: false, dflt_value: null, pk: false, isNumeric: false, latchFamily: 'Hierarchy' as const },
			],
			isValidColumn: (_name: string) => true,
			getFilterableColumns: () => [],
			getAxisColumns: () => [],
			getNumericColumns: () => [],
			getFieldsByFamily: () => [],
			getLatchFamilies: () => new Map(),
			subscribe: (_cb: () => void) => () => {},
		};
		setLatchSchemaProvider(mockSchemaProvider as any);
		expect(getLatchFamily('custom_field')).toBe('H'); // from SchemaProvider

		setLatchSchemaProvider(null);
		// After reset, custom_field is unknown -> fallback to A
		expect(getLatchFamily('custom_field')).toBe('A');
	});
});
