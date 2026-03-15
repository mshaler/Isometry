/**
 * CommandBar — always-visible top bar of the workbench shell.
 *
 * Provides three triggers:
 * 1. App icon — opens CommandPalette
 * 2. Command input placeholder — opens CommandPalette
 * 3. Settings gear — opens lightweight dropdown for theme/density/help/about
 *
 * All triggers delegate to existing provider methods via callback config.
 * CommandBar introduces zero new business logic (INTG-02).
 *
 * Requirements: SHEL-03, INTG-01, INTG-02, INTG-04
 */

import '../styles/workbench.css';
import { AppDialog } from './AppDialog';

export interface CommandBarConfig {
	/** Callback when app icon or command input is clicked — opens CommandPalette */
	onOpenPalette: () => void;
	/** Callback when theme item is clicked — cycles dark/light/system */
	onCycleTheme: () => void;
	/** Callback when density item is clicked — cycles compact/comfortable/spacious */
	onCycleDensity: () => void;
	/** Callback when help item is clicked — toggles HelpOverlay */
	onToggleHelp: () => void;
	/** Returns current theme label for display (e.g., "Dark", "Light", "System") */
	getThemeLabel: () => string;
	/** Returns current density label for display (e.g., "Compact", "Comfortable", "Spacious") */
	getDensityLabel: () => string;
}

export class CommandBar {
	private readonly _config: CommandBarConfig;
	private _el: HTMLElement | null = null;
	private _dropdownEl: HTMLElement | null = null;
	private _triggerEl: HTMLButtonElement | null = null;
	private _themeItemEl: HTMLButtonElement | null = null;
	private _densityItemEl: HTMLButtonElement | null = null;
	private _dropdownOpen = false;

	// Bound listeners for cleanup
	private _onDocumentClick: ((e: MouseEvent) => void) | null = null;
	private _onDocumentKeydown: ((e: KeyboardEvent) => void) | null = null;

	constructor(config: CommandBarConfig) {
		this._config = config;
	}

	mount(container: HTMLElement): void {
		const bar = document.createElement('div');
		bar.className = 'workbench-command-bar';

		// --- App icon ---
		const appIcon = document.createElement('button');
		appIcon.className = 'workbench-command-bar__app-icon';
		appIcon.setAttribute('aria-label', 'Open command palette');
		appIcon.setAttribute('title', 'Open command palette (\u2318K)');
		appIcon.textContent = '\u25C6'; // ◆
		appIcon.addEventListener('click', () => this._config.onOpenPalette());
		bar.appendChild(appIcon);

		// --- Command input placeholder ---
		const input = document.createElement('button');
		input.className = 'workbench-command-bar__input';
		input.setAttribute('aria-label', 'Open command palette');

		const inputText = document.createElement('span');
		inputText.className = 'workbench-command-bar__input-text';
		inputText.textContent = 'Command palette...';
		input.appendChild(inputText);

		const inputHint = document.createElement('kbd');
		inputHint.className = 'workbench-command-bar__input-hint';
		inputHint.textContent = '\u2318K';
		input.appendChild(inputHint);

		input.addEventListener('click', () => this._config.onOpenPalette());
		bar.appendChild(input);

		// --- Settings wrapper ---
		const settingsWrapper = document.createElement('div');
		settingsWrapper.className = 'workbench-command-bar__settings-wrapper';

		// Settings trigger button
		const settingsTrigger = document.createElement('button');
		settingsTrigger.className = 'workbench-command-bar__settings-trigger';
		settingsTrigger.setAttribute('aria-label', 'Settings');
		settingsTrigger.setAttribute('aria-haspopup', 'menu');
		settingsTrigger.setAttribute('aria-expanded', 'false');
		settingsTrigger.textContent = '\u2699'; // ⚙
		settingsTrigger.addEventListener('click', (e) => {
			e.stopPropagation();
			this._toggleDropdown();
		});
		this._triggerEl = settingsTrigger;
		settingsWrapper.appendChild(settingsTrigger);

		// Settings dropdown menu
		const dropdown = document.createElement('div');
		dropdown.className = 'workbench-settings-dropdown';
		dropdown.setAttribute('role', 'menu');
		dropdown.style.display = 'none';
		this._dropdownEl = dropdown;

		// Theme item
		const themeItem = this._createMenuItem(`Theme: ${this._config.getThemeLabel()}`, () => {
			this._config.onCycleTheme();
			this._updateThemeLabel();
		});
		this._themeItemEl = themeItem;
		dropdown.appendChild(themeItem);

		// Density item
		const densityItem = this._createMenuItem(`Density: ${this._config.getDensityLabel()}`, () => {
			this._config.onCycleDensity();
			this._updateDensityLabel();
		});
		this._densityItemEl = densityItem;
		dropdown.appendChild(densityItem);

		// Divider
		const divider = document.createElement('hr');
		divider.className = 'workbench-settings-divider';
		divider.setAttribute('role', 'separator');
		dropdown.appendChild(divider);

		// Help item
		const helpItem = this._createMenuItem('Keyboard Shortcuts', () => {
			this._config.onToggleHelp();
		});
		dropdown.appendChild(helpItem);

		// About item
		const aboutItem = this._createMenuItem('About Isometry', () => {
			// Lightweight about action — show alert with version info
			alert('Isometry v5\nLocal-first polymorphic data projection platform');
		});
		dropdown.appendChild(aboutItem);

		settingsWrapper.appendChild(dropdown);
		bar.appendChild(settingsWrapper);

		container.appendChild(bar);
		this._el = bar;

		// Set up document-level listeners for dropdown dismiss
		this._onDocumentClick = (e: MouseEvent) => {
			if (this._dropdownOpen && !settingsWrapper.contains(e.target as Node)) {
				this._closeDropdown();
			}
		};

		this._onDocumentKeydown = (e: KeyboardEvent) => {
			if (!this._dropdownOpen) return;
			switch (e.key) {
				case 'ArrowDown': e.preventDefault(); this._moveFocus(1); break;
				case 'ArrowUp':   e.preventDefault(); this._moveFocus(-1); break;
				case 'Home':      e.preventDefault(); this._focusItem(0); break;
				case 'End':       e.preventDefault(); this._focusItem(this._getMenuItems().length - 1); break;
				case 'Escape':    this._closeDropdown(); this._triggerEl?.focus(); break;
			}
		};

		document.addEventListener('click', this._onDocumentClick);
		document.addEventListener('keydown', this._onDocumentKeydown);
	}

	destroy(): void {
		// Remove document listeners
		if (this._onDocumentClick) {
			document.removeEventListener('click', this._onDocumentClick);
			this._onDocumentClick = null;
		}
		if (this._onDocumentKeydown) {
			document.removeEventListener('keydown', this._onDocumentKeydown);
			this._onDocumentKeydown = null;
		}

		// Remove DOM
		if (this._el) {
			this._el.remove();
			this._el = null;
		}

		this._dropdownEl = null;
		this._triggerEl = null;
		this._themeItemEl = null;
		this._densityItemEl = null;
		this._dropdownOpen = false;
	}

	// --- Private ---

	private _createMenuItem(text: string, onClick: () => void): HTMLButtonElement {
		const item = document.createElement('button');
		item.className = 'workbench-settings-item';
		item.setAttribute('role', 'menuitem');
		item.setAttribute('tabindex', '-1');
		item.textContent = text;
		item.addEventListener('click', (e) => {
			e.stopPropagation();
			onClick();
			this._closeDropdown();
		});
		return item;
	}

	private _getMenuItems(): HTMLElement[] {
		return Array.from(
			this._dropdownEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
		);
	}

	private _focusItem(index: number): void {
		const items = this._getMenuItems();
		items.forEach((el, i) =>
			el.setAttribute('tabindex', i === index ? '0' : '-1')
		);
		items[index]?.focus();
	}

	private _moveFocus(delta: 1 | -1): void {
		const items = this._getMenuItems();
		const current = items.indexOf(document.activeElement as HTMLElement);
		const next = (current + delta + items.length) % items.length;
		this._focusItem(next);
	}

	private _toggleDropdown(): void {
		if (this._dropdownOpen) {
			this._closeDropdown();
		} else {
			this._openDropdown();
		}
	}

	private _openDropdown(): void {
		if (!this._dropdownEl || !this._triggerEl) return;
		this._dropdownOpen = true;
		this._dropdownEl.style.display = '';
		this._triggerEl.setAttribute('aria-expanded', 'true');

		// Update labels to reflect current state
		this._updateThemeLabel();
		this._updateDensityLabel();

		// Focus first item and set roving tabindex
		const items = this._getMenuItems();
		items.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
		items[0]?.focus();
	}

	private _closeDropdown(): void {
		if (!this._dropdownEl || !this._triggerEl) return;
		this._dropdownOpen = false;
		this._dropdownEl.style.display = 'none';
		this._triggerEl.setAttribute('aria-expanded', 'false');
	}

	private _updateThemeLabel(): void {
		if (this._themeItemEl) {
			this._themeItemEl.textContent = `Theme: ${this._config.getThemeLabel()}`;
		}
	}

	private _updateDensityLabel(): void {
		if (this._densityItemEl) {
			this._densityItemEl.textContent = `Density: ${this._config.getDensityLabel()}`;
		}
	}
}
