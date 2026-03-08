// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommandBar, type CommandBarConfig } from '../../src/ui/CommandBar';

function createConfig(overrides: Partial<CommandBarConfig> = {}): CommandBarConfig {
  return {
    onOpenPalette: vi.fn(),
    onCycleTheme: vi.fn(),
    onCycleDensity: vi.fn(),
    onToggleHelp: vi.fn(),
    getThemeLabel: vi.fn(() => 'Dark'),
    getDensityLabel: vi.fn(() => 'Comfortable'),
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

  // --- Mount / Destroy lifecycle (INTG-01) ---

  describe('mount/destroy lifecycle', () => {
    it('mount() appends command bar DOM to container', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const el = container.querySelector('.workbench-command-bar');
      expect(el).not.toBeNull();
    });

    it('destroy() removes DOM from container', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      bar.destroy();
      const el = container.querySelector('.workbench-command-bar');
      expect(el).toBeNull();
    });

    it('destroy() is safe to call twice', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      bar.destroy();
      bar.destroy(); // should not throw
      expect(container.querySelector('.workbench-command-bar')).toBeNull();
    });
  });

  // --- App icon trigger ---

  describe('app icon trigger', () => {
    it('renders app icon button', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const btn = container.querySelector('.workbench-command-bar__app-icon');
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute('aria-label')).toBe('Open command palette');
    });

    it('click on app icon calls onOpenPalette', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const btn = container.querySelector('.workbench-command-bar__app-icon') as HTMLButtonElement;
      btn.click();
      expect(config.onOpenPalette).toHaveBeenCalledOnce();
    });
  });

  // --- Command input placeholder ---

  describe('command input placeholder', () => {
    it('renders command input button with placeholder text', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const btn = container.querySelector('.workbench-command-bar__input');
      expect(btn).not.toBeNull();
      const text = btn?.querySelector('.workbench-command-bar__input-text');
      expect(text?.textContent).toBe('Command palette...');
    });

    it('shows keyboard hint', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const hint = container.querySelector('.workbench-command-bar__input-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('K');
    });

    it('click on command input calls onOpenPalette', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const btn = container.querySelector('.workbench-command-bar__input') as HTMLButtonElement;
      btn.click();
      expect(config.onOpenPalette).toHaveBeenCalledOnce();
    });
  });

  // --- Settings dropdown ---

  describe('settings dropdown', () => {
    it('renders settings trigger button', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const btn = container.querySelector('.workbench-command-bar__settings-trigger');
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute('aria-label')).toBe('Settings');
      expect(btn?.getAttribute('aria-haspopup')).toBe('menu');
      expect(btn?.getAttribute('aria-expanded')).toBe('false');
    });

    it('dropdown is hidden by default', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const dropdown = container.querySelector('.workbench-settings-dropdown') as HTMLElement;
      expect(dropdown).not.toBeNull();
      expect(dropdown.style.display).toBe('none');
    });

    it('clicking settings trigger toggles dropdown visibility', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      const dropdown = container.querySelector('.workbench-settings-dropdown') as HTMLElement;

      trigger.click();
      expect(dropdown.style.display).toBe('');
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      trigger.click();
      expect(dropdown.style.display).toBe('none');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    // --- ARIA roles ---

    it('dropdown has role="menu"', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const dropdown = container.querySelector('.workbench-settings-dropdown');
      expect(dropdown?.getAttribute('role')).toBe('menu');
    });

    it('each item has role="menuitem"', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const items = container.querySelectorAll('.workbench-settings-item');
      expect(items.length).toBeGreaterThanOrEqual(4);
      for (const item of items) {
        expect(item.getAttribute('role')).toBe('menuitem');
      }
    });

    // --- Dropdown dismiss behavior ---

    it('Escape key closes dropdown', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click(); // open

      const dropdown = container.querySelector('.workbench-settings-dropdown') as HTMLElement;
      expect(dropdown.style.display).toBe('');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(dropdown.style.display).toBe('none');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('click outside closes dropdown', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click(); // open

      const dropdown = container.querySelector('.workbench-settings-dropdown') as HTMLElement;
      expect(dropdown.style.display).toBe('');

      // Click on the container (outside the dropdown)
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(dropdown.style.display).toBe('none');
    });

    it('clicking a menu item closes the dropdown', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click(); // open

      const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
      // Click the Help item (3rd item after theme and density)
      const helpItem = items[2]!;
      helpItem.click();

      const dropdown = container.querySelector('.workbench-settings-dropdown') as HTMLElement;
      expect(dropdown.style.display).toBe('none');
    });
  });

  // --- Item callbacks ---

  describe('item callbacks', () => {
    it('theme item calls onCycleTheme and updates label', () => {
      let themeLabel = 'Dark';
      config = createConfig({
        onCycleTheme: vi.fn(() => { themeLabel = 'Light'; }),
        getThemeLabel: vi.fn(() => themeLabel),
      });
      bar = new CommandBar(config);
      bar.mount(container);

      // Open dropdown first
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click();

      const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
      const themeItem = items[0]!;
      expect(themeItem.textContent).toContain('Theme');
      expect(themeItem.textContent).toContain('Dark');

      themeItem.click();
      expect(config.onCycleTheme).toHaveBeenCalledOnce();
    });

    it('density item calls onCycleDensity and updates label', () => {
      let densityLabel = 'Comfortable';
      config = createConfig({
        onCycleDensity: vi.fn(() => { densityLabel = 'Compact'; }),
        getDensityLabel: vi.fn(() => densityLabel),
      });
      bar = new CommandBar(config);
      bar.mount(container);

      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click();

      const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
      const densityItem = items[1]!;
      expect(densityItem.textContent).toContain('Density');
      expect(densityItem.textContent).toContain('Comfortable');

      densityItem.click();
      expect(config.onCycleDensity).toHaveBeenCalledOnce();
    });

    it('help item calls onToggleHelp', () => {
      bar = new CommandBar(config);
      bar.mount(container);

      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click();

      const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
      const helpItem = items[2]!;
      expect(helpItem.textContent).toContain('Keyboard Shortcuts');

      helpItem.click();
      expect(config.onToggleHelp).toHaveBeenCalledOnce();
    });

    it('about item shows about information', () => {
      bar = new CommandBar(config);
      bar.mount(container);

      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click();

      const items = container.querySelectorAll('.workbench-settings-item') as NodeListOf<HTMLButtonElement>;
      const aboutItem = items[3]!;
      expect(aboutItem.textContent).toContain('About Isometry');
    });
  });

  // --- Event listener cleanup ---

  describe('event listener cleanup', () => {
    it('destroy() cleans up document listeners (Escape does nothing after destroy)', () => {
      bar = new CommandBar(config);
      bar.mount(container);
      const trigger = container.querySelector('.workbench-command-bar__settings-trigger') as HTMLButtonElement;
      trigger.click(); // open dropdown

      bar.destroy();

      // This should not throw
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
  });
});
