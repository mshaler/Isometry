import { describe, expect, it } from 'vitest';
import type { AxisMapping } from '../../../src/providers/types';
import {
	buildCellKey,
	buildDimensionKey,
	findCellInData,
	parseCellKey,
	RECORD_SEP,
	UNIT_SEP,
} from '../../../src/views/supergrid/keys';
import type { CellDatum } from '../../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Separator constant exports
// ---------------------------------------------------------------------------

describe('keys — separator constants', () => {
	it('UNIT_SEP is \\x1f (U+001F)', () => {
		expect(UNIT_SEP).toBe('\x1f');
	});

	it('RECORD_SEP is \\x1e (U+001E)', () => {
		expect(RECORD_SEP).toBe('\x1e');
	});
});

// ---------------------------------------------------------------------------
// buildDimensionKey
// ---------------------------------------------------------------------------

describe('buildDimensionKey', () => {
	it('single axis: returns value as string', () => {
		const cell: CellDatum = { folder: 'Work', count: 1, card_ids: [] };
		const axes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		expect(buildDimensionKey(cell, axes)).toBe('Work');
	});

	it('two axes: joins values with \\x1f', () => {
		const cell: CellDatum = { folder: 'Work', status: 'Active', count: 1, card_ids: [] };
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		];
		expect(buildDimensionKey(cell, axes)).toBe('Work\x1fActive');
	});

	it('three axes: joins all three values with \\x1f', () => {
		const cell: CellDatum = {
			folder: 'Work',
			status: 'Active',
			priority: '1',
			count: 1,
			card_ids: [],
		};
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
		];
		expect(buildDimensionKey(cell, axes)).toBe('Work\x1fActive\x1f1');
	});

	it('four axes: joins all four values with \\x1f', () => {
		const cell: CellDatum = {
			folder: 'Work',
			status: 'Active',
			priority: '1',
			card_type: 'note',
			count: 2,
			card_ids: [],
		};
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		];
		expect(buildDimensionKey(cell, axes)).toBe('Work\x1fActive\x1f1\x1fnote');
	});

	it('null value coerces to "None"', () => {
		const cell: CellDatum = { folder: null, count: 1, card_ids: [] };
		const axes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		expect(buildDimensionKey(cell, axes)).toBe('None');
	});

	it('undefined value coerces to "None"', () => {
		const cell: CellDatum = { count: 1, card_ids: [] };
		const axes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		expect(buildDimensionKey(cell, axes)).toBe('None');
	});

	it('missing field coerces to "None"', () => {
		const cell: CellDatum = { count: 1, card_ids: [] };
		const axes: AxisMapping[] = [{ field: 'status', direction: 'asc' }];
		expect(buildDimensionKey(cell, axes)).toBe('None');
	});

	it('mixed null and present values: null becomes "None", present stays', () => {
		const cell: CellDatum = { folder: 'Work', status: null, count: 1, card_ids: [] };
		const axes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		];
		expect(buildDimensionKey(cell, axes)).toBe('Work\x1fNone');
	});

	it('empty axes array returns empty string', () => {
		const cell: CellDatum = { folder: 'Work', count: 1, card_ids: [] };
		expect(buildDimensionKey(cell, [])).toBe('');
	});

	it('numeric value is coerced to string', () => {
		const cell: CellDatum = { priority: 3, count: 1, card_ids: [] };
		const axes: AxisMapping[] = [{ field: 'priority', direction: 'asc' }];
		expect(buildDimensionKey(cell, axes)).toBe('3');
	});
});

// ---------------------------------------------------------------------------
// buildCellKey
// ---------------------------------------------------------------------------

describe('buildCellKey', () => {
	it('single row + single col: separated by \\x1e', () => {
		const cell: CellDatum = { folder: 'Work', card_type: 'note', count: 1, card_ids: [] };
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		expect(buildCellKey(cell, rowAxes, colAxes)).toBe('Work\x1enote');
	});

	it('two-level row + two-level col: compound keys separated by \\x1e', () => {
		const cell: CellDatum = {
			folder: 'Work',
			status: 'Active',
			card_type: 'note',
			priority: 'High',
			count: 1,
			card_ids: [],
		};
		const rowAxes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		];
		const colAxes: AxisMapping[] = [
			{ field: 'card_type', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
		];
		expect(buildCellKey(cell, rowAxes, colAxes)).toBe('Work\x1fActive\x1enote\x1fHigh');
	});

	it('three-level axes: full compound key', () => {
		const cell: CellDatum = {
			folder: 'Work',
			status: 'Active',
			priority: '1',
			card_type: 'note',
			sort_order: '5',
			name: 'Test',
			count: 1,
			card_ids: [],
		};
		const rowAxes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
		];
		const colAxes: AxisMapping[] = [
			{ field: 'card_type', direction: 'asc' },
			{ field: 'sort_order', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
		];
		expect(buildCellKey(cell, rowAxes, colAxes)).toBe('Work\x1fActive\x1f1\x1enote\x1f5\x1fTest');
	});

	it('four-level axes: N-level compound key', () => {
		const cell: CellDatum = {
			folder: 'Work',
			status: 'Active',
			priority: '1',
			card_type: 'note',
			sort_order: '5',
			name: 'Test',
			created_at: '2026-01-01',
			modified_at: '2026-02-01',
			count: 1,
			card_ids: [],
		};
		const rowAxes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
			{ field: 'card_type', direction: 'asc' },
		];
		const colAxes: AxisMapping[] = [
			{ field: 'sort_order', direction: 'asc' },
			{ field: 'name', direction: 'asc' },
			{ field: 'created_at', direction: 'asc' },
			{ field: 'modified_at', direction: 'asc' },
		];
		expect(buildCellKey(cell, rowAxes, colAxes)).toBe(
			'Work\x1fActive\x1f1\x1fnote\x1e5\x1fTest\x1f2026-01-01\x1f2026-02-01',
		);
	});

	it('null values in compound key coerce to "None"', () => {
		const cell: CellDatum = { folder: null, card_type: 'note', count: 1, card_ids: [] };
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		expect(buildCellKey(cell, rowAxes, colAxes)).toBe('None\x1enote');
	});
});

// ---------------------------------------------------------------------------
// parseCellKey
// ---------------------------------------------------------------------------

describe('parseCellKey', () => {
	it('single-level key: splits at \\x1e boundary', () => {
		expect(parseCellKey('Work\x1enote')).toEqual({ rowKey: 'Work', colKey: 'note' });
	});

	it('multi-level key: splits only at \\x1e, preserves \\x1f within parts', () => {
		expect(parseCellKey('Work\x1fActive\x1eNote\x1fHigh')).toEqual({
			rowKey: 'Work\x1fActive',
			colKey: 'Note\x1fHigh',
		});
	});

	it('three-level multi-axis key: correct boundary split', () => {
		expect(parseCellKey('Work\x1fActive\x1f1\x1enote\x1f5\x1fTest')).toEqual({
			rowKey: 'Work\x1fActive\x1f1',
			colKey: 'note\x1f5\x1fTest',
		});
	});

	it('no \\x1e separator: returns rowKey=cellKey, colKey=""', () => {
		expect(parseCellKey('Work')).toEqual({ rowKey: 'Work', colKey: '' });
	});

	it('splits only at the first \\x1e (in case col value somehow contained one)', () => {
		// If cellKey has two \x1e, only first is boundary; rest goes into colKey
		expect(parseCellKey('Work\x1enote\x1eextra')).toEqual({
			rowKey: 'Work',
			colKey: 'note\x1eextra',
		});
	});

	it('"None\\x1eNone" key: both parts are None', () => {
		expect(parseCellKey('None\x1eNone')).toEqual({ rowKey: 'None', colKey: 'None' });
	});
});

// ---------------------------------------------------------------------------
// findCellInData
// ---------------------------------------------------------------------------

describe('findCellInData', () => {
	it('finds cell matching compound key in single-axis case', () => {
		const cells: CellDatum[] = [
			{ folder: 'Work', card_type: 'note', count: 3, card_ids: ['a', 'b', 'c'] },
			{ folder: 'Personal', card_type: 'note', count: 1, card_ids: ['d'] },
		];
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		const result = findCellInData('Work\x1enote', cells, rowAxes, colAxes);
		expect(result).toBe(cells[0]);
	});

	it('finds correct cell in multi-axis case', () => {
		const cells: CellDatum[] = [
			{ folder: 'Work', status: 'Active', card_type: 'note', priority: 'High', count: 2, card_ids: [] },
			{ folder: 'Work', status: 'Done', card_type: 'note', priority: 'High', count: 1, card_ids: [] },
		];
		const rowAxes: AxisMapping[] = [
			{ field: 'folder', direction: 'asc' },
			{ field: 'status', direction: 'asc' },
		];
		const colAxes: AxisMapping[] = [
			{ field: 'card_type', direction: 'asc' },
			{ field: 'priority', direction: 'asc' },
		];
		const result = findCellInData('Work\x1fActive\x1enote\x1fHigh', cells, rowAxes, colAxes);
		expect(result).toBe(cells[0]);
	});

	it('returns undefined when no cell matches', () => {
		const cells: CellDatum[] = [{ folder: 'Work', card_type: 'note', count: 1, card_ids: [] }];
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		const result = findCellInData('Personal\x1enote', cells, rowAxes, colAxes);
		expect(result).toBeUndefined();
	});

	it('returns undefined for empty cells array', () => {
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		const result = findCellInData('Work\x1enote', [], rowAxes, colAxes);
		expect(result).toBeUndefined();
	});

	it('null/undefined cell field coerces to "None" for matching', () => {
		const cells: CellDatum[] = [{ folder: null, card_type: 'note', count: 1, card_ids: [] }];
		const rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }];
		const colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }];
		const result = findCellInData('None\x1enote', cells, rowAxes, colAxes);
		expect(result).toBe(cells[0]);
	});
});
