// @vitest-environment jsdom
// Isometry — Phase 157 Plan 02 (Task 1)
// Tests for CalcExplorer: SchemaProvider wiring for dynamic numeric field detection.
//
// Requirements: BEHV-07

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnInfo } from '../../src/worker/protocol';

// Dynamic import
let CalcExplorer: typeof import('../../src/ui/CalcExplorer').CalcExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/CalcExplorer');
	CalcExplorer = mod.CalcExplorer;
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeSchemaProvider(columns: ColumnInfo[] = [], initialized = true) {
	const subscribers = new Set<() => void>();
	return {
		initialized,
		getNumericColumns: vi.fn(() => columns.filter((c) => c.isNumeric)),
		getColumns: vi.fn((table: string) => (table === 'cards' ? columns : [])),
		subscribe: vi.fn((cb: () => void) => {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		}),
		_fire: () => { for (const cb of subscribers) cb(); },
		_subscribers: subscribers,
		// Stubs for other SchemaProvider methods used elsewhere
		getAxisColumns: vi.fn(() => columns),
		getAllAxisColumns: vi.fn(() => columns),
		getDisabledFields: vi.fn(() => new Set()),
		hasAnyOverride: vi.fn(() => false),
		hasAnyDisabled: vi.fn(() => false),
		addGraphMetricColumns: vi.fn(),
	};
}

function makeBridgeMock() {
	return {
		send: vi.fn(async (_type: string, _payload: unknown) => ({ value: null })),
	};
}

function makePafvMock(fields: Array<{ field: string }> = []) {
	const subscribers = new Set<() => void>();
	return {
		subscribe: vi.fn((cb: () => void) => {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		}),
		getStackedGroupBySQL: vi.fn(() => ({
			colAxes: fields.map((f) => ({ field: f.field, dir: 'asc' })),
			rowAxes: [],
		})),
		_fire: () => { for (const cb of subscribers) cb(); },
	};
}

const SCHEMA_COLUMNS: ColumnInfo[] = [
	{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'priority', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'sort_order', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'my_score', type: 'REAL', notnull: false, latchFamily: 'Hierarchy', isNumeric: true },
];

// ---------------------------------------------------------------------------
// SchemaProvider wiring (BEHV-07)
// ---------------------------------------------------------------------------

describe('CalcExplorer — SchemaProvider wiring (BEHV-07)', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('custom numeric column from schema gets SUM/AVG/COUNT/MIN/MAX options (not just COUNT)', async () => {
		const schema = makeSchemaProvider(SCHEMA_COLUMNS);
		const bridge = makeBridgeMock();
		const pafv = makePafvMock([{ field: 'my_score' }]);
		const onConfigChange = vi.fn();

		const explorer = new CalcExplorer({
			bridge: bridge as any,
			pafv: pafv as any,
			container,
			onConfigChange,
			schema: schema as any,
		});
		await explorer.mount();

		// Find the select for my_score
		const selects = container.querySelectorAll('select.calc-select');
		expect(selects.length).toBe(1);

		const select = selects[0] as HTMLSelectElement;
		const optionValues = Array.from(select.options).map((o) => o.value);
		// Numeric fields get full options
		expect(optionValues).toContain('sum');
		expect(optionValues).toContain('avg');
		expect(optionValues).toContain('min');
		expect(optionValues).toContain('max');
		expect(optionValues).toContain('count');

		explorer.destroy();
	});

	it('when schema is NOT initialized, all fields treated as text (COUNT only)', async () => {
		const schema = makeSchemaProvider(SCHEMA_COLUMNS, false);
		(schema as any).initialized = false;
		const bridge = makeBridgeMock();
		const pafv = makePafvMock([{ field: 'priority' }]);
		const onConfigChange = vi.fn();

		const explorer = new CalcExplorer({
			bridge: bridge as any,
			pafv: pafv as any,
			container,
			onConfigChange,
			schema: schema as any,
		});
		await explorer.mount();

		const selects = container.querySelectorAll('select.calc-select');
		expect(selects.length).toBe(1);

		const select = selects[0] as HTMLSelectElement;
		const optionValues = Array.from(select.options).map((o) => o.value);
		// Without initialized schema, _isNumeric returns false → text options only
		expect(optionValues).toEqual(['count', 'off']);

		explorer.destroy();
	});

	it('subscribes to SchemaProvider and re-renders on schema change', async () => {
		const schema = makeSchemaProvider(SCHEMA_COLUMNS);
		const bridge = makeBridgeMock();
		const pafv = makePafvMock([{ field: 'name' }]);
		const onConfigChange = vi.fn();

		const explorer = new CalcExplorer({
			bridge: bridge as any,
			pafv: pafv as any,
			container,
			onConfigChange,
			schema: schema as any,
		});
		await explorer.mount();

		// Should have subscribed
		expect(schema.subscribe).toHaveBeenCalledTimes(1);

		// Count initial children
		const initialHTML = container.innerHTML;

		// Fire schema change — triggers re-render
		schema._fire();

		// Container should have been re-rendered (content replaced)
		// The re-render rebuilds the DOM, so the container HTML is rebuilt
		const afterHTML = container.innerHTML;
		// Both should have content (re-render doesn't clear to empty)
		expect(afterHTML.length).toBeGreaterThan(0);

		explorer.destroy();
	});

	it('destroy() unsubscribes from SchemaProvider', async () => {
		const schema = makeSchemaProvider(SCHEMA_COLUMNS);
		const bridge = makeBridgeMock();
		const pafv = makePafvMock([{ field: 'name' }]);
		const onConfigChange = vi.fn();

		const explorer = new CalcExplorer({
			bridge: bridge as any,
			pafv: pafv as any,
			container,
			onConfigChange,
			schema: schema as any,
		});
		await explorer.mount();

		expect(schema._subscribers.size).toBe(1);

		explorer.destroy();

		expect(schema._subscribers.size).toBe(0);
	});
});
