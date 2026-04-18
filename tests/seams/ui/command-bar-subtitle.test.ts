// @vitest-environment jsdom
/**
 * CommandBar subtitle seam tests.
 * Subtitle element removed from command bar UI.
 * setSubtitle() is now a no-op for backward compatibility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBar, type CommandBarConfig } from '../../../src/ui/CommandBar';

function makeConfig(): CommandBarConfig {
	return { onMenuAction: vi.fn() };
}

describe('SGFX-03: CommandBar subtitle (deprecated)', () => {
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

	it('setSubtitle() is a no-op and does not throw', () => {
		expect(() => bar.setSubtitle('MyDataset')).not.toThrow();
		expect(() => bar.setSubtitle(null)).not.toThrow();
		expect(() => bar.setSubtitle('')).not.toThrow();
	});

	it('no subtitle element exists in the DOM', () => {
		const subtitleEl = container.querySelector('.workbench-command-bar__subtitle');
		expect(subtitleEl).toBeNull();
	});
});
