// Isometry v5 — Phase 70 Plan 01
// Unit tests for SchemaProvider class.
//
// Tests cover:
//   - initialize() stores ColumnInfo arrays and builds validation Sets
//   - Typed accessors: getColumns, isValidColumn, getFilterableColumns, getAxisColumns
//   - getNumericColumns, getFieldsByFamily, getLatchFamilies
//   - subscribe/notify fires once after initialize() via queueMicrotask
//   - Idempotent re-initialization
//   - allowlist delegation: setSchemaProvider wires dynamic validation
//   - allowlist fallback: frozen sets work without SchemaProvider

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSchemaProvider } from '../../src/providers/allowlist';
import { isValidAxisField, isValidFilterField } from '../../src/providers/allowlist';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import type { ColumnInfo } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CARD_COLUMNS: ColumnInfo[] = [
	{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'folder', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
	{ name: 'status', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
	{ name: 'card_type', type: 'TEXT', notnull: true, latchFamily: 'Category', isNumeric: false },
	{ name: 'created_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
	{ name: 'modified_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
	{ name: 'due_at', type: 'TEXT', notnull: false, latchFamily: 'Time', isNumeric: false },
	{ name: 'priority', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'sort_order', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'latitude', type: 'REAL', notnull: false, latchFamily: 'Location', isNumeric: true },
	{ name: 'longitude', type: 'REAL', notnull: false, latchFamily: 'Location', isNumeric: true },
	{ name: 'location_name', type: 'TEXT', notnull: false, latchFamily: 'Location', isNumeric: false },
	{ name: 'content', type: 'TEXT', notnull: false, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'source', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
];

const CONN_COLUMNS: ColumnInfo[] = [
	{ name: 'source_id', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'target_id', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'label', type: 'TEXT', notnull: false, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'weight', type: 'REAL', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'created_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
];

// ---------------------------------------------------------------------------
// Helper to flush microtasks
// ---------------------------------------------------------------------------
async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests: initialize and accessors
// ---------------------------------------------------------------------------

describe('SchemaProvider', () => {
	let sp: SchemaProvider;

	beforeEach(() => {
		sp = new SchemaProvider();
	});

	describe('initialization', () => {
		it('starts uninitialized', () => {
			expect(sp.initialized).toBe(false);
		});

		it('initialize() marks as initialized', () => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			expect(sp.initialized).toBe(true);
		});

		it('initialize() is idempotent — second call replaces state', () => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			const singleCol: ColumnInfo[] = [{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false }];
			sp.initialize({ cards: singleCol, connections: [] });
			expect(sp.getColumns('cards')).toHaveLength(1);
		});
	});

	describe('getColumns()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns cards columns', () => {
			expect(sp.getColumns('cards')).toHaveLength(CARD_COLUMNS.length);
		});

		it('returns connections columns', () => {
			expect(sp.getColumns('connections')).toHaveLength(CONN_COLUMNS.length);
		});

		it('returns readonly array (does not leak internal reference)', () => {
			const cols = sp.getColumns('cards');
			expect(cols).not.toBe(CARD_COLUMNS); // Different reference
		});
	});

	describe('isValidColumn()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns true for known card column', () => {
			expect(sp.isValidColumn('name', 'cards')).toBe(true);
			expect(sp.isValidColumn('created_at', 'cards')).toBe(true);
		});

		it('returns false for unknown card column', () => {
			expect(sp.isValidColumn('nonexistent', 'cards')).toBe(false);
		});

		it('defaults table to cards when not specified', () => {
			expect(sp.isValidColumn('name')).toBe(true);
			expect(sp.isValidColumn('nonexistent')).toBe(false);
		});

		it('returns true for known connection column', () => {
			expect(sp.isValidColumn('weight', 'connections')).toBe(true);
		});

		it('returns false for unknown connection column', () => {
			expect(sp.isValidColumn('nonexistent', 'connections')).toBe(false);
		});
	});

	describe('getFilterableColumns()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns all card columns (all are filterable)', () => {
			expect(sp.getFilterableColumns()).toHaveLength(CARD_COLUMNS.length);
		});

		it('includes all expected columns', () => {
			const names = sp.getFilterableColumns().map((c) => c.name);
			expect(names).toContain('name');
			expect(names).toContain('folder');
			expect(names).toContain('created_at');
		});
	});

	describe('getAxisColumns()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns all card columns (all are axis-eligible)', () => {
			expect(sp.getAxisColumns()).toHaveLength(CARD_COLUMNS.length);
		});
	});

	describe('getNumericColumns()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns only columns with isNumeric === true', () => {
			const cols = sp.getNumericColumns();
			expect(cols.every((c) => c.isNumeric)).toBe(true);
		});

		it('includes priority, sort_order, latitude, longitude', () => {
			const names = sp.getNumericColumns().map((c) => c.name);
			expect(names).toContain('priority');
			expect(names).toContain('sort_order');
			expect(names).toContain('latitude');
			expect(names).toContain('longitude');
		});

		it('excludes text columns', () => {
			const names = sp.getNumericColumns().map((c) => c.name);
			expect(names).not.toContain('name');
			expect(names).not.toContain('folder');
		});
	});

	describe('getFieldsByFamily()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns Time columns (_at suffix)', () => {
			const timeCols = sp.getFieldsByFamily('Time');
			const names = timeCols.map((c) => c.name);
			expect(names).toContain('created_at');
			expect(names).toContain('modified_at');
			expect(names).toContain('due_at');
		});

		it('returns Category columns', () => {
			const catCols = sp.getFieldsByFamily('Category');
			const names = catCols.map((c) => c.name);
			expect(names).toContain('folder');
			expect(names).toContain('status');
			expect(names).toContain('card_type');
		});

		it('returns Location columns', () => {
			const locCols = sp.getFieldsByFamily('Location');
			const names = locCols.map((c) => c.name);
			expect(names).toContain('latitude');
			expect(names).toContain('longitude');
			expect(names).toContain('location_name');
		});

		it('returns empty array for family with no columns', () => {
			const singleCol: ColumnInfo[] = [
				{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
			];
			const sp2 = new SchemaProvider();
			sp2.initialize({ cards: singleCol, connections: [] });
			expect(sp2.getFieldsByFamily('Time')).toHaveLength(0);
		});
	});

	describe('getLatchFamilies()', () => {
		beforeEach(() => {
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		});

		it('returns a Map', () => {
			const families = sp.getLatchFamilies();
			expect(families).toBeInstanceOf(Map);
		});

		it('Time family contains _at columns', () => {
			const families = sp.getLatchFamilies();
			const time = families.get('Time') ?? [];
			expect(time).toContain('created_at');
			expect(time).toContain('modified_at');
		});

		it('Category family contains categorical columns', () => {
			const families = sp.getLatchFamilies();
			const cat = families.get('Category') ?? [];
			expect(cat).toContain('folder');
			expect(cat).toContain('status');
		});
	});

	describe('subscribe/notify', () => {
		it('fires once after initialize() via queueMicrotask', async () => {
			const callback = vi.fn();
			sp.subscribe(callback);
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			expect(callback).not.toHaveBeenCalled(); // Not yet — batched
			await flushMicrotasks();
			expect(callback).toHaveBeenCalledOnce();
		});

		it('batches multiple initialize calls into one notification', async () => {
			const callback = vi.fn();
			sp.subscribe(callback);
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			await flushMicrotasks();
			expect(callback).toHaveBeenCalledOnce();
		});

		it('returns an unsubscribe function', async () => {
			const callback = vi.fn();
			const unsub = sp.subscribe(callback);
			unsub();
			sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
			await flushMicrotasks();
			expect(callback).not.toHaveBeenCalled();
		});
	});
});

// ---------------------------------------------------------------------------
// Tests: Phase 73 — LATCH override layer
// ---------------------------------------------------------------------------

describe('Phase 73 -- LATCH override layer', () => {
	let sp: SchemaProvider;

	beforeEach(() => {
		sp = new SchemaProvider();
		sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
	});

	it('getFieldsByFamily reflects override (UCFG-05)', () => {
		// priority is Hierarchy by default
		sp.setOverrides(new Map([['priority', 'Category']]));
		const catNames = sp.getFieldsByFamily('Category').map((c) => c.name);
		expect(catNames).toContain('priority');
		const hierNames = sp.getFieldsByFamily('Hierarchy').map((c) => c.name);
		expect(hierNames).not.toContain('priority');
	});

	it('getAxisColumns applies override to latchFamily', () => {
		sp.setOverrides(new Map([['priority', 'Category']]));
		const col = sp.getAxisColumns().find((c) => c.name === 'priority');
		expect(col?.latchFamily).toBe('Category');
	});

	it('disabled fields excluded from getAxisColumns, getFieldsByFamily, getFilterableColumns, getNumericColumns', () => {
		sp.setDisabled(new Set(['priority']));

		const axisNames = sp.getAxisColumns().map((c) => c.name);
		expect(axisNames).not.toContain('priority');

		const hierNames = sp.getFieldsByFamily('Hierarchy').map((c) => c.name);
		expect(hierNames).not.toContain('priority');

		const filterNames = sp.getFilterableColumns().map((c) => c.name);
		expect(filterNames).not.toContain('priority');

		// sort_order is numeric and Hierarchy
		sp.setDisabled(new Set(['sort_order']));
		const numericNames = sp.getNumericColumns().map((c) => c.name);
		expect(numericNames).not.toContain('sort_order');
	});

	it('getColumns("cards") NOT affected by disabled', () => {
		sp.setDisabled(new Set(['priority']));
		const colNames = sp.getColumns('cards').map((c) => c.name);
		expect(colNames).toContain('priority');
		expect(sp.isValidColumn('priority')).toBe(true);
	});

	it('getHeuristicFamily returns original, not override', () => {
		sp.setOverrides(new Map([['priority', 'Category']]));
		expect(sp.getHeuristicFamily('priority')).toBe('Hierarchy');
		expect(sp.getLatchOverride('priority')).toBe('Category');
	});

	it('hasAnyOverride / hasAnyDisabled return correct booleans', () => {
		expect(sp.hasAnyOverride()).toBe(false);
		expect(sp.hasAnyDisabled()).toBe(false);

		sp.setOverrides(new Map([['priority', 'Category']]));
		expect(sp.hasAnyOverride()).toBe(true);
		expect(sp.hasAnyDisabled()).toBe(false);

		sp.setDisabled(new Set(['folder']));
		expect(sp.hasAnyOverride()).toBe(true);
		expect(sp.hasAnyDisabled()).toBe(true);

		sp.setOverrides(new Map());
		expect(sp.hasAnyOverride()).toBe(false);
		expect(sp.hasAnyDisabled()).toBe(true);
	});

	it('initialize() does not reset overrides or disabled', () => {
		sp.setOverrides(new Map([['priority', 'Category']]));
		sp.setDisabled(new Set(['folder']));

		// Re-initialize
		sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });

		expect(sp.hasAnyOverride()).toBe(true);
		expect(sp.hasAnyDisabled()).toBe(true);
		expect(sp.getLatchOverride('priority')).toBe('Category');
		expect(sp.getDisabledFields().has('folder')).toBe(true);
	});

	it('getLatchFamilies() reflects overrides and disabled', () => {
		// priority=Hierarchy, folder=Category by default
		sp.setOverrides(new Map([['priority', 'Category']]));
		sp.setDisabled(new Set(['folder']));

		const families = sp.getLatchFamilies();
		const catFields = families.get('Category') ?? [];
		expect(catFields).toContain('priority');
		expect(catFields).not.toContain('folder'); // disabled

		const hierFields = families.get('Hierarchy') ?? [];
		expect(hierFields).not.toContain('priority'); // overridden away
	});

	it('subscriber notification fires on setOverrides and setDisabled', async () => {
		const cb1 = vi.fn();
		sp.subscribe(cb1);
		sp.setOverrides(new Map([['priority', 'Category']]));
		await Promise.resolve();
		expect(cb1).toHaveBeenCalledOnce();

		const cb2 = vi.fn();
		sp.subscribe(cb2);
		sp.setDisabled(new Set(['folder']));
		await Promise.resolve();
		expect(cb2).toHaveBeenCalledOnce();
	});

	it('getAllAxisColumns includes disabled fields with override-applied latchFamily', () => {
		sp.setOverrides(new Map([['priority', 'Category']]));
		sp.setDisabled(new Set(['priority']));

		// getAllAxisColumns includes disabled
		const allCols = sp.getAllAxisColumns();
		const priorityAll = allCols.find((c) => c.name === 'priority');
		expect(priorityAll).toBeDefined();
		expect(priorityAll?.latchFamily).toBe('Category'); // override applied

		// getAxisColumns excludes disabled
		const axisCols = sp.getAxisColumns();
		const priorityAxis = axisCols.find((c) => c.name === 'priority');
		expect(priorityAxis).toBeUndefined();
	});

	it('getOverrides returns readonly map', () => {
		sp.setOverrides(new Map([['priority', 'Category']]));
		const overrides = sp.getOverrides();
		expect(overrides.get('priority')).toBe('Category');
		expect(overrides.size).toBe(1);
	});

	it('getDisabledFields returns readonly set', () => {
		sp.setDisabled(new Set(['folder', 'status']));
		const disabled = sp.getDisabledFields();
		expect(disabled.has('folder')).toBe(true);
		expect(disabled.has('status')).toBe(true);
		expect(disabled.size).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Tests: allowlist delegation
// ---------------------------------------------------------------------------

describe('allowlist delegation via setSchemaProvider', () => {
	afterEach(() => {
		// Reset: clear SchemaProvider from allowlist after each test
		// to prevent test pollution. Pass null via cast to reset.
		// We use setSchemaProvider(null as any) — setSchemaProvider accepts SchemaProvider only,
		// but for test cleanup we need to reset the module-level reference.
		// Use the exported resetSchemaProvider if available, otherwise use type cast.
		setSchemaProvider(null as unknown as SchemaProvider);
	});

	it('isValidFilterField delegates to SchemaProvider when wired', () => {
		const sp = new SchemaProvider();
		sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		setSchemaProvider(sp);

		// 'name' is in SchemaProvider cards — should be valid
		expect(isValidFilterField('name')).toBe(true);
		// 'nonexistent' is not — should be invalid
		expect(isValidFilterField('nonexistent')).toBe(false);
	});

	it('isValidAxisField delegates to SchemaProvider when wired', () => {
		const sp = new SchemaProvider();
		sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
		setSchemaProvider(sp);

		expect(isValidAxisField('created_at')).toBe(true);
		expect(isValidAxisField('nonexistent')).toBe(false);
	});

	it('isValidFilterField falls back to frozen set without SchemaProvider', () => {
		// No setSchemaProvider called — should use frozen set
		expect(isValidFilterField('folder')).toBe(true); // In frozen set
		expect(isValidFilterField('nonexistent')).toBe(false); // Not in frozen set
	});

	it('isValidAxisField falls back to frozen set without SchemaProvider', () => {
		expect(isValidAxisField('created_at')).toBe(true);
		expect(isValidAxisField('nonexistent')).toBe(false);
	});

	it('SchemaProvider with dynamic column validates correctly', () => {
		// Column not in frozen set but in PRAGMA-derived schema
		const customCols: ColumnInfo[] = [
			...CARD_COLUMNS,
			{ name: 'custom_field', type: 'TEXT', notnull: false, latchFamily: 'Alphabet', isNumeric: false },
		];
		const sp = new SchemaProvider();
		sp.initialize({ cards: customCols, connections: CONN_COLUMNS });
		setSchemaProvider(sp);

		// custom_field is NOT in the static frozen set
		// With SchemaProvider wired, it should be valid
		expect(isValidFilterField('custom_field')).toBe(true);
	});
});
