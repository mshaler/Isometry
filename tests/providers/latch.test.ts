// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 01 (Task 1)
// Tests for LATCH family classification map.
//
// Requirements: PROP-02
// TDD Phase: RED -> GREEN -> REFACTOR

import { describe, expect, it } from 'vitest';
import {
	LATCH_COLORS,
	LATCH_FAMILIES,
	LATCH_LABELS,
	LATCH_ORDER,
	type LatchFamily,
} from '../../src/providers/latch';
import type { AxisField } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// LATCH_FAMILIES — maps all 9 AxisField values to LatchFamily letters
// ---------------------------------------------------------------------------

describe('LATCH_FAMILIES', () => {
	it('maps name to Alphabet (A)', () => {
		expect(LATCH_FAMILIES.name).toBe('A');
	});

	it('maps created_at to Time (T)', () => {
		expect(LATCH_FAMILIES.created_at).toBe('T');
	});

	it('maps modified_at to Time (T)', () => {
		expect(LATCH_FAMILIES.modified_at).toBe('T');
	});

	it('maps due_at to Time (T)', () => {
		expect(LATCH_FAMILIES.due_at).toBe('T');
	});

	it('maps folder to Category (C)', () => {
		expect(LATCH_FAMILIES.folder).toBe('C');
	});

	it('maps status to Category (C)', () => {
		expect(LATCH_FAMILIES.status).toBe('C');
	});

	it('maps card_type to Category (C)', () => {
		expect(LATCH_FAMILIES.card_type).toBe('C');
	});

	it('maps priority to Hierarchy (H)', () => {
		expect(LATCH_FAMILIES.priority).toBe('H');
	});

	it('maps sort_order to Hierarchy (H)', () => {
		expect(LATCH_FAMILIES.sort_order).toBe('H');
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
