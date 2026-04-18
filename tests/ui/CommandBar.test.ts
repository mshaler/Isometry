// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBar, type CommandBarConfig } from '../../src/ui/CommandBar';

function createConfig(overrides: Partial<CommandBarConfig> = {}): CommandBarConfig {
	return {
		onMenuAction: vi.fn(),
		...overrides,
	};
}

describe('CommandBar', () => {
	let container: HTMLElement;
	let bar: CommandBar;
	let config: CommandBarConfig;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		config = createConfig();
	});

	afterEach(() => {
		bar?.destroy();
		container.remove();
	});

	describe('mount/destroy lifecycle', () => {
		it('mount() appends command bar DOM to container', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			expect(container.querySelector('.workbench-command-bar')).not.toBeNull();
		});

		it('destroy() removes DOM from container', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			bar.destroy();
			expect(container.querySelector('.workbench-command-bar')).toBeNull();
		});

		it('destroy() is safe to call twice', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			bar.destroy();
			bar.destroy();
			expect(container.querySelector('.workbench-command-bar')).toBeNull();
		});
	});

	describe('app icon trigger', () => {
		it('renders app icon button with menu role', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const btn = container.querySelector('.workbench-command-bar__app-icon');
			expect(btn).not.toBeNull();
			expect(btn?.getAttribute('aria-label')).toBe('Isometry menu');
			expect(btn?.getAttribute('aria-haspopup')).toBe('menu');
		});

		it('click on app icon toggles app menu', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const btn = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;

			btn.click();
			expect(menu.style.display).toBe('');
			expect(btn.getAttribute('aria-expanded')).toBe('true');

			btn.click();
			expect(menu.style.display).toBe('none');
			expect(btn.getAttribute('aria-expanded')).toBe('false');
		});
	});

	describe('wordmark', () => {
		it('renders wordmark with "Isometry" text', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const wordmark = container.querySelector('.workbench-command-bar__wordmark');
			expect(wordmark).not.toBeNull();
			expect(wordmark?.textContent).toBe('Isometry');
		});
	});

	describe('app menu', () => {
		it('app menu is hidden by default', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;
			expect(menu).not.toBeNull();
			expect(menu.style.display).toBe('none');
		});

		it('app menu has role="menu"', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const menu = container.querySelector('.workbench-app-menu');
			expect(menu?.getAttribute('role')).toBe('menu');
		});

		it('has menu items with role="menuitem"', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const items = container.querySelectorAll('.workbench-settings-item');
			expect(items.length).toBeGreaterThanOrEqual(4); // Import File, Import from, Undo, Redo + views
			for (const item of items) {
				expect(item.getAttribute('role')).toBe('menuitem');
			}
		});

		it('Escape key closes app menu', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;
			expect(menu.style.display).toBe('');

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			expect(menu.style.display).toBe('none');
			expect(trigger.getAttribute('aria-expanded')).toBe('false');
		});

		it('click outside closes app menu', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;
			expect(menu.style.display).toBe('');

			document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			expect(menu.style.display).toBe('none');
		});

		it('clicking a menu item closes the app menu', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
			items[0]!.click();

			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;
			expect(menu.style.display).toBe('none');
		});
	});

	describe('item callbacks', () => {
		it('clicking Import File calls onMenuAction with importFile', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
			const importItem = Array.from(items).find(el => el.textContent?.includes('Import File'));
			expect(importItem).toBeTruthy();
			importItem!.click();
			expect(config.onMenuAction).toHaveBeenCalledWith('importFile');
		});

		it('clicking Undo calls onMenuAction with undo', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
			const undoItem = Array.from(items).find(el => el.textContent?.includes('Undo'));
			expect(undoItem).toBeTruthy();
			undoItem!.click();
			expect(config.onMenuAction).toHaveBeenCalledWith('undo');
		});

		it('clicking a view item calls onMenuAction with switchView:viewType', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();

			const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
			const listItem = Array.from(items).find(el => el.textContent?.includes('List'));
			expect(listItem).toBeTruthy();
			listItem!.click();
			expect(config.onMenuAction).toHaveBeenCalledWith('switchView:list');
		});
	});

	describe('event listener cleanup', () => {
		it('destroy() cleans up document listeners', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();
			bar.destroy();
			expect(() => {
				document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			}).not.toThrow();
		});
	});

	describe('keyboard navigation', () => {
		function openAppMenu() {
			bar = new CommandBar(config);
			bar.mount(container);
			const trigger = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
			trigger.click();
			return trigger;
		}

		it('ArrowDown moves focus to next menu item', () => {
			openAppMenu();
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			expect(items[1]?.getAttribute('tabindex')).toBe('0');
			expect(items[0]?.getAttribute('tabindex')).toBe('-1');
		});

		it('ArrowUp wraps to last item when on first item', () => {
			openAppMenu();
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
			const lastIndex = items.length - 1;
			expect(items[lastIndex]?.getAttribute('tabindex')).toBe('0');
			expect(items[0]?.getAttribute('tabindex')).toBe('-1');
		});

		it('Home focuses first menu item', () => {
			openAppMenu();
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
			expect(items[0]?.getAttribute('tabindex')).toBe('0');
		});

		it('End focuses last menu item', () => {
			openAppMenu();
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
			const lastIndex = items.length - 1;
			expect(items[lastIndex]?.getAttribute('tabindex')).toBe('0');
		});

		it('Escape closes menu and returns focus to trigger', () => {
			const trigger = openAppMenu();
			const menu = container.querySelector('.workbench-app-menu') as HTMLElement;
			expect(menu.style.display).toBe('');
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			expect(menu.style.display).toBe('none');
			expect(trigger.getAttribute('aria-expanded')).toBe('false');
		});

		it('menu items have tabindex=-1 initially', () => {
			bar = new CommandBar(config);
			bar.mount(container);
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			for (const item of items) {
				expect(item.getAttribute('tabindex')).toBe('-1');
			}
		});

		it('first menu item gets tabindex=0 when menu opens', () => {
			openAppMenu();
			const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
			expect(items[0]?.getAttribute('tabindex')).toBe('0');
			for (const item of Array.from(items).slice(1)) {
				expect(item.getAttribute('tabindex')).toBe('-1');
			}
		});
	});
});
