// @vitest-environment jsdom
/**
 * Isometry v7.0 — Phase 89 Plan 02
 * PropertiesExplorer depth dropdown seam tests.
 *
 * Verifies that:
 *   - getDepth() returns 1 (Shallow) by default when localStorage is empty
 *   - getDepth() restores value from localStorage key `workbench:prop-depth`
 *   - Changing the depth <select> fires subscriber callbacks exactly once
 *   - Changing the depth <select> writes new value to localStorage
 *   - All 4 depth options render (Shallow, Medium, Deep, All)
 *   - getDepth() returns 0 when "All" option is selected
 *
 * Requirements: SGFX-01
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertiesExplorer } from '../../../src/ui/PropertiesExplorer';
import type { AliasProvider } from '../../../src/providers/AliasProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAliasStub(): AliasProvider {
	return {
		getAlias: (field: string) => field,
		setAlias: vi.fn(),
		clearAlias: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
	} as unknown as AliasProvider;
}

function makeExplorer(container: HTMLElement): PropertiesExplorer {
	return new PropertiesExplorer({
		alias: makeAliasStub(),
		container,
	});
}

// ---------------------------------------------------------------------------
// SGFX-01: Depth dropdown default and localStorage restore
// ---------------------------------------------------------------------------

describe('SGFX-01: PropertiesExplorer depth dropdown', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		container.remove();
		localStorage.clear();
	});

	it('SGFX-01a: getDepth() returns 1 by default when localStorage is empty', () => {
		const explorer = makeExplorer(container);
		expect(explorer.getDepth()).toBe(1);
		explorer.destroy();
	});

	it('SGFX-01b: getDepth() restores value from localStorage key workbench:prop-depth', () => {
		localStorage.setItem('workbench:prop-depth', '2');
		const explorer = makeExplorer(container);
		expect(explorer.getDepth()).toBe(2);
		explorer.destroy();
	});

	it('SGFX-01c: changing select fires subscriber callbacks exactly once', () => {
		const explorer = makeExplorer(container);
		explorer.mount();
		const cb = vi.fn();
		explorer.subscribe(cb);

		const select = container.querySelector<HTMLSelectElement>('#prop-depth-select');
		expect(select).not.toBeNull();

		select!.value = '2';
		select!.dispatchEvent(new Event('change'));

		expect(cb).toHaveBeenCalledTimes(1);
		explorer.destroy();
	});

	it('SGFX-01d: changing select writes new value to localStorage', () => {
		const explorer = makeExplorer(container);
		explorer.mount();

		const select = container.querySelector<HTMLSelectElement>('#prop-depth-select');
		expect(select).not.toBeNull();

		select!.value = '3';
		select!.dispatchEvent(new Event('change'));

		expect(localStorage.getItem('workbench:prop-depth')).toBe('3');
		explorer.destroy();
	});

	it('SGFX-01e: all 4 depth options render (Shallow, Medium, Deep, All)', () => {
		const explorer = makeExplorer(container);
		explorer.mount();

		const options = Array.from(container.querySelectorAll<HTMLOptionElement>('#prop-depth-select option'));
		const labels = options.map((o) => o.textContent ?? '');

		expect(labels.some((l) => l.includes('Shallow'))).toBe(true);
		expect(labels.some((l) => l.includes('Medium'))).toBe(true);
		expect(labels.some((l) => l.includes('Deep'))).toBe(true);
		expect(labels.some((l) => l.includes('All'))).toBe(true);
		explorer.destroy();
	});

	it('SGFX-01f: getDepth() returns 0 when "All" option is selected', () => {
		const explorer = makeExplorer(container);
		explorer.mount();

		const select = container.querySelector<HTMLSelectElement>('#prop-depth-select');
		expect(select).not.toBeNull();

		select!.value = '0';
		select!.dispatchEvent(new Event('change'));

		expect(explorer.getDepth()).toBe(0);
		explorer.destroy();
	});
});
