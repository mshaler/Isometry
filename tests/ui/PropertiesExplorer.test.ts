// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 02 (Task 1)
// Tests for PropertiesExplorer: LATCH-grouped property catalog with toggles and inline rename.
//
// Requirements: PROP-01, PROP-03, PROP-04, PROP-05, INTG-03
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AliasProvider } from '../../src/providers/AliasProvider';
import type { AxisField } from '../../src/providers/types';

// Dynamic import to allow RED phase to fail gracefully
let PropertiesExplorer: typeof import('../../src/ui/PropertiesExplorer').PropertiesExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/PropertiesExplorer');
	PropertiesExplorer = mod.PropertiesExplorer;
});

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
		const tColumn = container.querySelector(
			'.properties-explorer__column[data-family="T"]',
		) as HTMLElement;

		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		tHeader.click();
		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(true);

		tHeader.click();
		expect(tColumn.classList.contains('properties-explorer__column--collapsed')).toBe(false);

		explorer.destroy();
	});

	it('collapse state persists to localStorage', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const tHeader = container.querySelector(
			'.properties-explorer__column[data-family="T"] .properties-explorer__column-header',
		) as HTMLElement;
		tHeader.click();

		expect(localStorage.getItem('workbench:prop-col-T')).toBe('true');

		explorer.destroy();
	});

	it('restores collapse state from localStorage', () => {
		localStorage.setItem('workbench:prop-col-C', 'true');

		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const cColumn = container.querySelector(
			'.properties-explorer__column[data-family="C"]',
		) as HTMLElement;
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

		const aColumn = container.querySelector(
			'.properties-explorer__column[data-family="A"]',
		) as HTMLElement;
		const tColumn = container.querySelector(
			'.properties-explorer__column[data-family="T"]',
		) as HTMLElement;

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

		const checkboxes = container.querySelectorAll(
			'.properties-explorer__property input[type="checkbox"]',
		);
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
		const tColumn = container.querySelector(
			'.properties-explorer__column[data-family="T"]',
		) as HTMLElement;
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
		const aColumn = container.querySelector(
			'.properties-explorer__column[data-family="A"]',
		) as HTMLElement;
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

		const tColumn = container.querySelector(
			'.properties-explorer__column[data-family="T"]',
		) as HTMLElement;
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

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		nameSpan.click();

		const input = container.querySelector(
			'.properties-explorer__edit-input',
		) as HTMLInputElement;
		expect(input).not.toBeNull();
		expect(input.value).toBe(nameSpan.textContent);

		explorer.destroy();
	});

	it('Enter key confirms rename and calls aliasProvider.setAlias', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		nameSpan.click();

		const input = container.querySelector(
			'.properties-explorer__edit-input',
		) as HTMLInputElement;
		input.value = 'My Custom Name';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		// Wait for alias provider microtask
		await Promise.resolve();

		// Should have set alias on the aliasProvider
		// The first property in A column is "name"
		expect(alias.getAlias('name')).toBe('My Custom Name');

		// Should show span with new alias
		const updatedSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		expect(updatedSpan).not.toBeNull();
		expect(updatedSpan.textContent).toBe('My Custom Name');

		explorer.destroy();
	});

	it('Escape key cancels edit without changing alias', () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		const originalText = nameSpan.textContent;
		nameSpan.click();

		const input = container.querySelector(
			'.properties-explorer__edit-input',
		) as HTMLInputElement;
		input.value = 'Changed Name';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		// Alias should not have changed
		expect(alias.getAlias('name')).toBe('name');

		// Should show original span text
		const restoredSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		expect(restoredSpan.textContent).toBe(originalText);

		explorer.destroy();
	});

	it('blur confirms rename', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		nameSpan.click();

		const input = container.querySelector(
			'.properties-explorer__edit-input',
		) as HTMLInputElement;
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

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		expect(nameSpan.textContent).toBe('Custom Title');

		nameSpan.click();

		const clearBtn = container.querySelector(
			'.properties-explorer__clear-btn',
		) as HTMLElement;
		expect(clearBtn).not.toBeNull();
		clearBtn.click();

		await Promise.resolve();

		expect(alias.getAlias('name')).toBe('name');

		// Should show original field name
		const restoredSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		expect(restoredSpan.textContent).toBe('name');

		explorer.destroy();
	});

	it('empty input on confirm reverts to original field name', async () => {
		const explorer = new PropertiesExplorer({ alias, container });
		explorer.mount();

		const nameSpan = container.querySelector(
			'.properties-explorer__property-name',
		) as HTMLElement;
		nameSpan.click();

		const input = container.querySelector(
			'.properties-explorer__edit-input',
		) as HTMLInputElement;
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
		const cColumn = container.querySelector(
			'.properties-explorer__column[data-family="C"]',
		) as HTMLElement;
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
