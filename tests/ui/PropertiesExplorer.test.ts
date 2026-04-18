// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 02 (Task 1)
// Tests for PropertiesExplorer: LATCH-grouped property catalog with toggles and inline rename.
//
// Requirements: PROP-01, PROP-03, PROP-04, PROP-05, INTG-03
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasProvider } from '../../src/providers/AliasProvider';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import type { ColumnInfo } from '../../src/worker/protocol';

// Dynamic import to allow RED phase to fail gracefully
let PropertiesExplorer: typeof import('../../src/ui/PropertiesExplorer').PropertiesExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/PropertiesExplorer');
	PropertiesExplorer = mod.PropertiesExplorer;
});

// ---------------------------------------------------------------------------
// Phase 73 test fixtures
// ---------------------------------------------------------------------------

/** Minimal schema columns for LATCH config UI tests. */
const SCHEMA_COLUMNS: ColumnInfo[] = [
	{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'folder', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
	{ name: 'status', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
	{ name: 'card_type', type: 'TEXT', notnull: true, latchFamily: 'Category', isNumeric: false },
	{ name: 'created_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
	{ name: 'modified_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
	{ name: 'due_at', type: 'TEXT', notnull: false, latchFamily: 'Time', isNumeric: false },
	{ name: 'priority', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'sort_order', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
];

function makeSchemaProvider(): SchemaProvider {
	const sp = new SchemaProvider();
	sp.initialize({ cards: SCHEMA_COLUMNS, connections: [] });
	return sp;
}

function makeBridgeMock() {
	const calls: { type: string; payload: unknown }[] = [];
	return {
		send: vi.fn(async (type: string, payload: unknown) => {
			calls.push({ type, payload });
			return {};
		}),
		calls,
	};
}

function makeFilterMock() {
	return {
		getFilters: vi.fn(() => []),
		removeFilter: vi.fn(),
		clearRangeFilter: vi.fn(),
		setAxisFilter: vi.fn(),
		hasAxisFilter: vi.fn(() => false),
		hasActiveFilters: vi.fn(() => false),
		clearFilters: vi.fn(),
		compile: vi.fn(() => ''),
		subscribe: vi.fn(() => () => {}),
		addFilter: vi.fn(),
		setRangeFilter: vi.fn(),
		getAxisFilter: vi.fn(() => []),
		getRangeFilter: vi.fn(() => undefined),
	};
}

/** Flush queueMicrotask notifications. */
async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// LATCH column rendering — 5 columns with correct property assignments
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — LATCH columns', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('renders 5 LATCH columns in L, A, T, C, H order', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const columns = container.querySelectorAll('.properties-explorer__column');
		expect(columns.length).toBe(5);

		const headers = container.querySelectorAll('.properties-explorer__column-header');
		expect(headers.length).toBe(5);

		// Verify order via data-family attribute
		const families = Array.from(headers).map((h) => h.getAttribute('data-family'));
		expect(families).toEqual(['L', 'A', 'T', 'C', 'H']);

		explorer.destroy();
	});

	it('L column shows 0 properties with "(0/0)" badge and empty state text', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const lColumn = container.querySelector('.properties-explorer__column[data-family="L"]');
		expect(lColumn).not.toBeNull();

		const badge = lColumn!.querySelector('.properties-explorer__badge');
		expect(badge!.textContent).toBe('(0/0)');

		const empty = lColumn!.querySelector('.properties-explorer__empty');
		expect(empty).not.toBeNull();

		const props = lColumn!.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(0);

		explorer.destroy();
	});

	it('A column shows 1 property (name) with "(1/1)" badge', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const aColumn = container.querySelector('.properties-explorer__column[data-family="A"]');
		const badge = aColumn!.querySelector('.properties-explorer__badge');
		expect(badge!.textContent).toBe('(1/1)');

		const props = aColumn!.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(1);

		explorer.destroy();
	});

	it('T column shows 3 properties (created_at, modified_at, due_at)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]');
		const badge = tColumn!.querySelector('.properties-explorer__badge');
		expect(badge!.textContent).toBe('(3/3)');

		const props = tColumn!.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(3);

		explorer.destroy();
	});

	it('C column shows 3 properties (folder, status, card_type)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const cColumn = container.querySelector('.properties-explorer__column[data-family="C"]');
		const badge = cColumn!.querySelector('.properties-explorer__badge');
		expect(badge!.textContent).toBe('(3/3)');

		const props = cColumn!.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(3);

		explorer.destroy();
	});

	it('H column shows 2 properties (priority, sort_order)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const hColumn = container.querySelector('.properties-explorer__column[data-family="H"]');
		const badge = hColumn!.querySelector('.properties-explorer__badge');
		expect(badge!.textContent).toBe('(2/2)');

		const props = hColumn!.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(2);

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Column collapse — independently collapsible columns
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — column collapse', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('clicking column header toggles collapsed class', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const tHeader = container.querySelector(
			'.properties-explorer__column[data-family="T"] .properties-explorer__column-header',
		) as HTMLElement;
		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]') as HTMLElement;

		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		tHeader.click();
		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);

		tHeader.click();
		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		explorer.destroy();
	});

	it('collapse state persists to bridge ui:set', async () => {
		const bridge = {
			send: vi.fn(async (_type: string, _payload: unknown) => ({ value: null })),
		};
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		const tHeader = container.querySelector(
			'.properties-explorer__column[data-family="T"] .properties-explorer__column-header',
		) as HTMLElement;
		tHeader.click();

		expect(bridge.send).toHaveBeenCalledWith('ui:set', expect.objectContaining({ key: 'props:col-collapse' }));

		explorer.destroy();
	});

	it('restores collapse state from bridge ui:get', async () => {
		const bridge = {
			send: vi.fn(async (type: string, payload: { key: string }) => {
				if (type === 'ui:get' && payload.key === 'props:col-collapse') {
					return { value: JSON.stringify({ C: true }) };
				}
				return { value: null };
			}),
		};
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		const cColumn = container.querySelector('.properties-explorer__column[data-family="C"]') as HTMLElement;
		expect(cColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);

		explorer.destroy();
	});

	it('columns collapse independently', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const tHeader = container.querySelector(
			'.properties-explorer__column[data-family="T"] .properties-explorer__column-header',
		) as HTMLElement;
		tHeader.click();

		const aColumn = container.querySelector('.properties-explorer__column[data-family="A"]') as HTMLElement;
		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]') as HTMLElement;

		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);
		expect(aColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Toggle checkbox — enable/disable properties
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — toggle checkbox', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('all properties start enabled (checked)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const checkboxes = container.querySelectorAll('.properties-explorer__property input[type="checkbox"]');
		expect(checkboxes.length).toBe(9);
		for (const cb of checkboxes) {
			expect((cb as HTMLInputElement).checked).toBe(true);
		}

		explorer.destroy();
	});

	it('toggling OFF adds disabled class (dimmed opacity + strikethrough)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const firstCheckbox = container.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;
		const propertyRow = firstCheckbox.closest('.properties-explorer__property') as HTMLElement;

		firstCheckbox.click();

		expect(firstCheckbox.checked).toBe(false);
		expect(propertyRow.classList.contains('properties-explorer__property--disabled')).toBe(true);

		explorer.destroy();
	});

	it('toggling OFF remains visible (not removed from DOM)', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const firstCheckbox = container.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;
		firstCheckbox.click();

		const props = container.querySelectorAll('.properties-explorer__property');
		expect(props.length).toBe(9); // All still visible

		explorer.destroy();
	});

	it('count badge updates when toggle changes', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		// T column: 3 properties, toggle first one off
		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]') as HTMLElement;
		const tCheckbox = tColumn.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;

		tCheckbox.click();

		const badge = tColumn.querySelector('.properties-explorer__badge') as HTMLElement;
		expect(badge.textContent).toBe('(2/3)');

		explorer.destroy();
	});

	it('getEnabledFields returns Set of enabled AxisFields', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		expect(explorer.getEnabledFields().size).toBe(9);

		// Toggle off one field
		const aColumn = container.querySelector('.properties-explorer__column[data-family="A"]') as HTMLElement;
		const aCheckbox = aColumn.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;
		aCheckbox.click();

		expect(explorer.getEnabledFields().size).toBe(8);
		expect(explorer.getEnabledFields().has('name')).toBe(false);

		explorer.destroy();
	});

	it('subscribe fires when toggle state changes', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const callback = vi.fn();
		explorer.subscribe(callback);

		const firstCheckbox = container.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;
		firstCheckbox.click();

		expect(callback).toHaveBeenCalledTimes(1);

		explorer.destroy();
	});

	it('onCountChange callback fires with total enabled count', () => {
		const onCountChange = vi.fn();
		const explorer = new PropertiesExplorer({ alias, container, onCountChange });
		explorer.mount();

		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]') as HTMLElement;
		const tCheckbox = tColumn.querySelector(
			'.properties-explorer__property input[type="checkbox"]',
		) as HTMLInputElement;

		tCheckbox.click();

		expect(onCountChange).toHaveBeenCalledWith(8);

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Inline rename — click name to edit, Enter/Escape/blur/clear
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — inline rename', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('clicking property name swaps span to input', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		nameSpan.click();

		const input = container.querySelector('.properties-explorer__edit-input') as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.value).toBe(nameSpan.textContent);

		explorer.destroy();
	});

	it('Enter key confirms rename and calls aliasProvider.setAlias', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		nameSpan.click();

		const input = container.querySelector('.properties-explorer__edit-input') as HTMLInputElement;
		input.value = 'My Custom Name';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		// Wait for alias provider microtask
		await Promise.resolve();

		// Should have set alias on the aliasProvider
		// The first property in A column is "name"
		expect(alias.getAlias('name')).toBe('My Custom Name');

		// Should show span with new alias
		const updatedSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		expect(updatedSpan).not.toBeNull();
		expect(updatedSpan.textContent).toBe('My Custom Name');

		explorer.destroy();
	});

	it('Escape key cancels edit without changing alias', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		const originalText = nameSpan.textContent;
		nameSpan.click();

		const input = container.querySelector('.properties-explorer__edit-input') as HTMLInputElement;
		input.value = 'Changed Name';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		// Alias should not have changed
		expect(alias.getAlias('name')).toBe('name');

		// Should show original span text
		const restoredSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		expect(restoredSpan.textContent).toBe(originalText);

		explorer.destroy();
	});

	it('blur confirms rename', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		nameSpan.click();

		const input = container.querySelector('.properties-explorer__edit-input') as HTMLInputElement;
		input.value = 'Blurred Name';
		input.dispatchEvent(new Event('blur', { bubbles: true }));

		await Promise.resolve();

		expect(alias.getAlias('name')).toBe('Blurred Name');

		explorer.destroy();
	});

	it('clear/reset button reverts alias to original field name', async () => {
		alias.setAlias('name', 'Custom Title');
		await Promise.resolve();

		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		expect(nameSpan.textContent).toBe('Custom Title');

		nameSpan.click();

		const clearBtn = container.querySelector('.properties-explorer__clear-btn') as HTMLElement;
		expect(clearBtn).not.toBeNull();
		clearBtn.click();

		await Promise.resolve();

		expect(alias.getAlias('name')).toBe('name');

		// Should show original field name
		const restoredSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		expect(restoredSpan.textContent).toBe('name');

		explorer.destroy();
	});

	it('empty input on confirm reverts to original field name', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector('.properties-explorer__property-name') as HTMLElement;
		nameSpan.click();

		const input = container.querySelector('.properties-explorer__edit-input') as HTMLInputElement;
		input.value = '   '; // whitespace only
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		await Promise.resolve();

		// Should not set an alias of whitespace -- reverts to original
		expect(alias.getAlias('name')).toBe('name');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// D3 selection.join — INTG-03 compliance
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — D3 selection.join (INTG-03)', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('update() re-renders columns reflecting alias changes', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		alias.setAlias('folder', 'Project');
		await Promise.resolve(); // flush alias notification

		// The alias subscriber should have triggered a re-render
		const cColumn = container.querySelector('.properties-explorer__column[data-family="C"]') as HTMLElement;
		const names = Array.from(cColumn.querySelectorAll('.properties-explorer__property-name'));
		const nameTexts = names.map((n) => n.textContent);
		expect(nameTexts).toContain('Project');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// destroy — cleanup
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — destroy', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('removes DOM from container', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		expect(container.querySelector('.properties-explorer')).not.toBeNull();

		explorer.destroy();

		expect(container.querySelector('.properties-explorer')).toBeNull();
	});

	it('unsubscribes from aliasProvider', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();
		explorer.destroy();

		// After destroy, alias changes should not cause errors
		alias.setAlias('folder', 'Project');
		await Promise.resolve();
		// No error = success (would throw if trying to access destroyed DOM)
	});

	it('clears subscribers', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const callback = vi.fn();
		explorer.subscribe(callback);
		explorer.destroy();

		// After destroy, toggle should not fire callback
		// (no DOM to click, but the internal state should be cleaned)
		expect(callback).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Persistence migration (BEHV-04, BEHV-05) — bridge ui:set/ui:get replaces localStorage
// ---------------------------------------------------------------------------

describe('PropertiesExplorer — persistence migration (BEHV-04, BEHV-05)', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	function makePersistenceBridge(stored: Record<string, string | null> = {}) {
		const writes: { key: string; value: string }[] = [];
		return {
			send: vi.fn(async (type: string, payload: { key: string; value?: string }) => {
				if (type === 'ui:get') {
					return { value: stored[payload.key] ?? null };
				}
				if (type === 'ui:set') {
					writes.push({ key: payload.key, value: payload.value! });
				}
				return {};
			}),
			writes,
		};
	}

	it('mount() reads collapse state from bridge ui:get key "props:col-collapse"', async () => {
		const bridge = makePersistenceBridge({
			'props:col-collapse': JSON.stringify({ L: false, A: false, T: true, C: false, H: false }),
		});
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		// Verify ui:get was called for collapse
		expect(bridge.send).toHaveBeenCalledWith('ui:get', { key: 'props:col-collapse' });

		// T column should be collapsed
		const tColumn = container.querySelector('.properties-explorer__column[data-family="T"]') as HTMLElement;
		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);

		// Other columns should not be collapsed
		const aColumn = container.querySelector('.properties-explorer__column[data-family="A"]') as HTMLElement;
		expect(aColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		explorer.destroy();
	});

	it('mount() reads depth from bridge ui:get key "props:depth"', async () => {
		const bridge = makePersistenceBridge({ 'props:depth': '2' });
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		expect(bridge.send).toHaveBeenCalledWith('ui:get', { key: 'props:depth' });
		expect(explorer.getDepth()).toBe(2);

		explorer.destroy();
	});

	it('toggling column collapse writes to bridge ui:set key "props:col-collapse"', async () => {
		const bridge = makePersistenceBridge();
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		const tHeader = container.querySelector(
			'.properties-explorer__column[data-family="T"] .properties-explorer__column-header',
		) as HTMLElement;
		tHeader.click();

		// Should write to bridge, not localStorage
		const collapseWrite = bridge.writes.find((w) => w.key === 'props:col-collapse');
		expect(collapseWrite).toBeDefined();
		const parsed = JSON.parse(collapseWrite!.value);
		expect(parsed.T).toBe(true);

		// localStorage should NOT have the old key
		expect(localStorage.getItem('workbench:prop-col-T')).toBeNull();

		explorer.destroy();
	});

	it('changing depth writes to bridge ui:set key "props:depth"', async () => {
		const bridge = makePersistenceBridge();
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		const depthSelect = container.querySelector('#prop-depth-select') as HTMLSelectElement;
		depthSelect.value = '3';
		depthSelect.dispatchEvent(new Event('change', { bubbles: true }));

		const depthWrite = bridge.writes.find((w) => w.key === 'props:depth');
		expect(depthWrite).toBeDefined();
		expect(depthWrite!.value).toBe('3');

		// localStorage should NOT have the old key
		expect(localStorage.getItem('workbench:prop-depth')).toBeNull();

		explorer.destroy();
	});

	it('when bridge returns null for both keys, defaults apply (all expanded, depth=1)', async () => {
		const bridge = makePersistenceBridge(); // returns null for everything
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		// All columns expanded
		const collapsed = container.querySelectorAll('.properties-explorer__column--collapsed');
		expect(collapsed.length).toBe(0);

		// Depth defaults to 1
		expect(explorer.getDepth()).toBe(1);

		explorer.destroy();
	});

	it('no localStorage calls remain in PropertiesExplorer source', async () => {
		// This test validates at the source level — checked via grep in verification step
		// Here we just confirm the runtime behavior: bridge is used, not localStorage
		const bridge = makePersistenceBridge({
			'props:col-collapse': JSON.stringify({ C: true }),
			'props:depth': '0',
		});
		const explorer = new PropertiesExplorer({ alias, container, bridge });
		await explorer.mount();

		expect(explorer.getDepth()).toBe(0);
		const cColumn = container.querySelector('.properties-explorer__column[data-family="C"]') as HTMLElement;
		expect(cColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Phase 73 -- LATCH config UI (chip badge dropdown, disable/enable, footer)
// ---------------------------------------------------------------------------

describe('Phase 73 -- LATCH config UI', () => {
	let container: HTMLDivElement;
	let alias: AliasProvider;
	let schema: SchemaProvider;

	beforeEach(async () => {
		container = document.createElement('div');
		document.body.appendChild(container);
		alias = new AliasProvider();
		schema = makeSchemaProvider();
		await flushMicrotasks();
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
	});

	it('chip badge renders with <select> for each property', () => {
		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		const selects = container.querySelectorAll('select.properties-explorer__latch-select');
		// 9 fields = 9 selects
		expect(selects.length).toBe(9);

		explorer.destroy();
	});

	it('dropdown options include all 5 families with "(default)" on heuristic', () => {
		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		// "priority" is Hierarchy by default
		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		expect(priorityRow).not.toBeNull();
		const sel = priorityRow!.querySelector('select.properties-explorer__latch-select') as HTMLSelectElement;
		expect(sel).not.toBeNull();
		expect(sel.options.length).toBe(5);

		// Hierarchy option should have "(default)" suffix
		const hOption = Array.from(sel.options).find((o) => o.value === 'Hierarchy');
		expect(hOption!.textContent).toContain('(default)');

		// Other options should NOT have "(default)"
		const otherOptions = Array.from(sel.options).filter((o) => o.value !== 'Hierarchy');
		for (const opt of otherOptions) {
			expect(opt.textContent).not.toContain('(default)');
		}

		explorer.destroy();
	});

	it('selecting new family triggers override and persistence', async () => {
		const bridge = makeBridgeMock();
		const explorer = new PropertiesExplorer({ alias, schema, container, bridge });
		await explorer.mount();

		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		const sel = priorityRow!.querySelector('select.properties-explorer__latch-select') as HTMLSelectElement;

		sel.value = 'Category';
		sel.dispatchEvent(new Event('change', { bubbles: true }));

		// Check override was set on SchemaProvider
		expect(schema.getLatchOverride('priority')).toBe('Category');

		// Wait for async persistence
		await flushMicrotasks();

		// Check bridge received ui:set call
		const uiSetCalls = bridge.calls.filter((c) => c.type === 'ui:set');
		expect(uiSetCalls.length).toBeGreaterThanOrEqual(1);
		const overrideCall = uiSetCalls.find((c) => (c.payload as { key: string }).key === 'latch:overrides');
		expect(overrideCall).toBeDefined();

		explorer.destroy();
	});

	it('selecting default family clears override', async () => {
		// Pre-set override
		schema.setOverrides(new Map([['priority', 'Category']]));
		await flushMicrotasks();

		const bridge = makeBridgeMock();
		const explorer = new PropertiesExplorer({ alias, schema, container, bridge });
		await explorer.mount();

		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		const sel = priorityRow!.querySelector('select.properties-explorer__latch-select') as HTMLSelectElement;

		// Change back to Hierarchy (default for priority)
		sel.value = 'Hierarchy';
		sel.dispatchEvent(new Event('change', { bubbles: true }));

		expect(schema.getLatchOverride('priority')).toBeUndefined();

		explorer.destroy();
	});

	it('override indicator: chip has data-overridden="true"', async () => {
		schema.setOverrides(new Map([['priority', 'Category']]));
		await flushMicrotasks();

		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		// After schema subscriber fires and re-renders, find priority chip
		await flushMicrotasks();
		// Re-render triggered by schema subscriber
		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		const chip = priorityRow!.querySelector('.properties-explorer__latch-chip');
		expect(chip!.getAttribute('data-overridden')).toBe('true');

		explorer.destroy();
	});

	it('disable field: triggers SchemaProvider.setDisabled + FilterProvider cleanup', async () => {
		const filterMock = makeFilterMock();
		// Add a filter for "priority" to verify cleanup
		filterMock.getFilters.mockReturnValue([{ field: 'priority', op: 'eq', value: '1' }] as any);
		filterMock.hasAxisFilter.mockReturnValue(true);

		const bridge = makeBridgeMock();
		const explorer = new PropertiesExplorer({
			alias,
			schema,
			container,
			bridge,
			filter: filterMock as any,
		});
		await explorer.mount();

		// Find priority checkbox and uncheck it
		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		const checkbox = priorityRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkbox.checked).toBe(true);

		checkbox.click();

		expect(schema.getDisabledFields().has('priority')).toBe(true);
		expect(filterMock.removeFilter).toHaveBeenCalled();
		expect(filterMock.clearRangeFilter).toHaveBeenCalledWith('priority');

		explorer.destroy();
	});

	it('disabled field remains visible greyed-out in LATCH column', async () => {
		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		// Disable "priority" via checkbox (triggers SchemaProvider.setDisabled + _rebuildColumnFields)
		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		expect(priorityRow).not.toBeNull();
		const checkbox = priorityRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
		checkbox.click();

		// Wait for schema subscriber to fire _rebuildColumnFields + _renderColumns
		await flushMicrotasks();

		// "priority" row still exists (not removed from DOM)
		const priorityRowAfter = container.querySelector('.properties-explorer__property[data-field="priority"]');
		expect(priorityRowAfter).not.toBeNull();

		// Has disabled styling
		expect(priorityRowAfter!.classList.contains('properties-explorer__row--disabled')).toBe(true);

		// Checkbox is unchecked
		const checkboxAfter = priorityRowAfter!.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(checkboxAfter.checked).toBe(false);

		explorer.destroy();
	});

	it('column field rebuild: field moves between columns after override', async () => {
		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		// "priority" starts in Hierarchy column
		const hColumn = container.querySelector('.properties-explorer__column[data-family="H"]');
		let hFields = Array.from(hColumn!.querySelectorAll('.properties-explorer__property')).map((el) =>
			el.getAttribute('data-field'),
		);
		expect(hFields).toContain('priority');

		// Override priority to Category
		schema.setOverrides(new Map([['priority', 'Category']]));
		await flushMicrotasks();

		// After schema subscriber triggers rebuild, priority should move to C column
		const cColumn = container.querySelector('.properties-explorer__column[data-family="C"]');
		const cFields = Array.from(cColumn!.querySelectorAll('.properties-explorer__property')).map((el) =>
			el.getAttribute('data-field'),
		);
		expect(cFields).toContain('priority');

		// And no longer in H column
		hFields = Array.from(hColumn!.querySelectorAll('.properties-explorer__property')).map((el) =>
			el.getAttribute('data-field'),
		);
		expect(hFields).not.toContain('priority');

		explorer.destroy();
	});

	it('"Reset all LATCH mappings" button: visible only with overrides', async () => {
		const explorer = new PropertiesExplorer({ alias, schema, container });
		explorer.mount();

		// Reset button hidden when no overrides
		const resetBtn = container.querySelector('.properties-explorer__reset-btn') as HTMLElement;
		expect(resetBtn.style.display).toBe('none');

		// Set an override
		schema.setOverrides(new Map([['priority', 'Category']]));
		await flushMicrotasks();

		// Reset button should now be visible
		expect(resetBtn.style.display).not.toBe('none');

		explorer.destroy();
	});

	it('"Enable all" button: visible only with disabled fields, re-enables all', async () => {
		const bridge = makeBridgeMock();
		const explorer = new PropertiesExplorer({ alias, schema, container, bridge });
		await explorer.mount();

		// Enable button hidden when no disabled fields
		const enableBtn = container.querySelector('.properties-explorer__enable-btn') as HTMLElement;
		expect(enableBtn.style.display).toBe('none');

		// Disable a field via checkbox
		const priorityRow = container.querySelector('.properties-explorer__property[data-field="priority"]');
		const checkbox = priorityRow!.querySelector('input[type="checkbox"]') as HTMLInputElement;
		checkbox.click();
		await flushMicrotasks();

		// Enable button should now be visible
		expect(enableBtn.style.display).not.toBe('none');

		// Click enable all
		enableBtn.click();

		expect(schema.hasAnyDisabled()).toBe(false);

		explorer.destroy();
	});
});
