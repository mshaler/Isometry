// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewType } from '../../src/providers/types';
import { ViewTabBar } from '../../src/ui/ViewTabBar';

function createTabBar(onSwitch?: (v: ViewType) => void) {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const onSwitchFn = onSwitch ?? vi.fn();
	const bar = new ViewTabBar({ container, onSwitch: onSwitchFn });
	return { bar, container, onSwitchFn };
}

describe('ViewTabBar', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	// --- Mount / destroy ---

	describe('mount/destroy lifecycle', () => {
		it('renders a nav with role=tablist', () => {
			const { container } = createTabBar();
			const nav = container.parentElement?.querySelector('.view-tab-bar');
			expect(nav).not.toBeNull();
			expect(nav?.getAttribute('role')).toBe('tablist');
		});

		it('renders 9 tab buttons', () => {
			createTabBar();
			const tabs = document.querySelectorAll('.view-tab');
			expect(tabs.length).toBe(9);
		});

		it('destroy() removes the nav element', () => {
			const { bar } = createTabBar();
			bar.destroy();
			expect(document.querySelector('.view-tab-bar')).toBeNull();
		});
	});

	// --- Roving tabindex ---

	describe('roving tabindex', () => {
		it('active tab button has tabindex=0, others have tabindex=-1', () => {
			createTabBar();
			// Default active is 'list' (first tab)
			const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.view-tab'));
			expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
			for (const tab of tabs.slice(1)) {
				expect(tab.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('setActive() updates tabindex: new active tab gets 0, previous gets -1', () => {
			const { bar } = createTabBar();
			bar.setActive('grid');
			const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.view-tab'));
			// list (0) should be -1, grid (1) should be 0
			expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
			expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
		});
	});

	// --- Arrow key navigation ---

	describe('arrow key navigation', () => {
		it('ArrowRight switches to next tab and focuses its button', () => {
			const onSwitch = vi.fn();
			createTabBar(onSwitch);
			const nav = document.querySelector('.view-tab-bar') as HTMLElement;
			nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(onSwitch).toHaveBeenCalledWith('grid');
		});

		it('ArrowLeft wraps from first tab to last', () => {
			const onSwitch = vi.fn();
			createTabBar(onSwitch);
			const nav = document.querySelector('.view-tab-bar') as HTMLElement;
			// Active is 'list' (index 0), ArrowLeft should go to 'supergrid' (index 8)
			nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
			expect(onSwitch).toHaveBeenCalledWith('supergrid');
		});

		it('Home jumps to first tab', () => {
			const onSwitch = vi.fn();
			const { bar } = createTabBar(onSwitch);
			bar.setActive('supergrid');
			const nav = document.querySelector('.view-tab-bar') as HTMLElement;
			nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
			expect(onSwitch).toHaveBeenCalledWith('list');
		});

		it('End jumps to last tab', () => {
			const onSwitch = vi.fn();
			createTabBar(onSwitch);
			const nav = document.querySelector('.view-tab-bar') as HTMLElement;
			nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
			expect(onSwitch).toHaveBeenCalledWith('supergrid');
		});

		it('ArrowRight wraps from last tab to first', () => {
			const onSwitch = vi.fn();
			const { bar } = createTabBar(onSwitch);
			bar.setActive('supergrid');
			const nav = document.querySelector('.view-tab-bar') as HTMLElement;
			nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			expect(onSwitch).toHaveBeenCalledWith('list');
		});
	});
});
