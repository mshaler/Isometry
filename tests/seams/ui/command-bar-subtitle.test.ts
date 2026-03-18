// @vitest-environment jsdom
/**
 * Isometry v7.0 — Phase 89 Plan 03
 * CommandBar subtitle seam tests.
 *
 * Verifies that:
 *   - setSubtitle(text) sets subtitle element textContent and makes it visible
 *   - setSubtitle(null) hides subtitle element
 *   - setSubtitle('') hides subtitle element
 *   - Subtitle element starts hidden before any setSubtitle call
 *   - setSubtitle('Loading...') shows 'Loading...' text
 *
 * Requirements: SGFX-03
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBar, type CommandBarConfig } from '../../../src/ui/CommandBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<CommandBarConfig>): CommandBarConfig {
	return {
		onOpenPalette: vi.fn(),
		onCycleTheme: vi.fn(),
		onCycleDensity: vi.fn(),
		onToggleHelp: vi.fn(),
		getThemeLabel: () => 'Dark',
		getDensityLabel: () => 'Compact',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// SGFX-03: CommandBar subtitle show/hide behavior
// ---------------------------------------------------------------------------

describe('SGFX-03: CommandBar subtitle', () => {
	let container: HTMLElement;
	let bar: CommandBar;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		bar = new CommandBar(makeConfig());
		bar.mount(container);
	});

	afterEach(() => {
		bar.destroy();
		container.remove();
	});

	it('Test 1: setSubtitle("MyDataset") sets textContent and shows element', () => {
		bar.setSubtitle('MyDataset');

		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle') as HTMLElement;
		expect(subtitleEl).not.toBeNull();
		expect(subtitleEl.textContent).toBe('MyDataset');
		expect(subtitleEl.style.display).not.toBe('none');
	});

	it('Test 2: setSubtitle(null) hides subtitle element', () => {
		// First show it
		bar.setSubtitle('SomeDataset');
		// Then hide it
		bar.setSubtitle(null);

		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle') as HTMLElement;
		expect(subtitleEl).not.toBeNull();
		expect(subtitleEl.style.display).toBe('none');
	});

	it('Test 3: setSubtitle("") hides subtitle element', () => {
		// First show it
		bar.setSubtitle('SomeDataset');
		// Then clear with empty string
		bar.setSubtitle('');

		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle') as HTMLElement;
		expect(subtitleEl).not.toBeNull();
		expect(subtitleEl.style.display).toBe('none');
	});

	it('Test 4: subtitle element starts hidden before any setSubtitle call', () => {
		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle') as HTMLElement;
		expect(subtitleEl).not.toBeNull();
		expect(subtitleEl.style.display).toBe('none');
	});

	it('Test 5: setSubtitle("Loading...") shows "Loading..." text', () => {
		bar.setSubtitle('Loading...');

		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle') as HTMLElement;
		expect(subtitleEl).not.toBeNull();
		expect(subtitleEl.textContent).toBe('Loading...');
		expect(subtitleEl.style.display).not.toBe('none');
	});
});
