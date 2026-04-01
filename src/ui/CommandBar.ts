/**
 * CommandBar — always-visible top bar of the workbench shell.
 *
 * Provides three elements:
 * 1. App icon (left) — opens CommandPalette via Isometry PNG icon
 * 2. Wordmark (center) — static "Isometry" text, non-interactive
 * 3. Settings gear (right) — opens lightweight dropdown for theme/density/help/about
 *
 * All triggers delegate to existing provider methods via callback config.
 * CommandBar introduces zero new business logic (INTG-02).
 *
 * Requirements: SHEL-03, INTG-01, INTG-02, INTG-04, MENU-01, MENU-02, MENU-03
 */

import '../styles/workbench.css';
import { AppDialog } from './AppDialog';
import appIconUrl from '../../assets/Isometry.png';

export interface CommandBarConfig {
	/** Callback when app icon or command input is clicked — opens CommandPalette */
	onOpenPalette: () => void;
	/** Callback when a specific theme is selected */
	onSetTheme: (theme: string) => void;
	/** Callback when density item is clicked — cycles compact/comfortable/spacious */
	onCycleDensity: () => void;
	/** Callback when help item is clicked — toggles HelpOverlay */
	onToggleHelp: () => void;
	/** Returns current theme value (e.g., 'dark', 'light', 'system', 'nextstep', 'material') */
	getTheme: () => string;
	/** Returns current density label for display (e.g., "Compact", "Comfortable", "Spacious") */
	getDensityLabel: () => string;
}

const THEME_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: 'dark', label: 'Modern Dark' },
	{ value: 'light', label: 'Modern Light' },
	{ value: 'system', label: 'Modern System' },
	{ value: 'nextstep', label: 'NeXTSTEP' },
	{ value: 'material', label: 'Material 3' },
];

export class CommandBar {
	private readonly _config: CommandBarConfig;
	private _el: HTMLElement | null = null;
	private _subtitleEl: HTMLElement | null = null;
	private _dropdownEl: HTMLElement | null = null;
	private _triggerEl: HTMLButtonElement | null = null;
	private _themeGroupEl: HTMLElement | null = null;
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
		appIcon.setAttribute('data-tour-target', 'command-palette-trigger');
		const img = document.createElement('img');
		img.src = appIconUrl;
		img.alt = ''; // Decorative — button already has aria-label
		img.style.width = '20px';
		img.style.height = '20px';
		img.draggable = false;
		appIcon.appendChild(img);
		appIcon.addEventListener('click', () => this._config.onOpenPalette());
		bar.appendChild(appIcon);

		// --- Center wrapper: wordmark + subtitle (stacked vertically) ---
		const centerWrapper = document.createElement('div');
		centerWrapper.className = 'workbench-command-bar__center';

		const wordmark = document.createElement('span');
		wordmark.className = 'workbench-command-bar__wordmark';
		wordmark.textContent = 'Isometry';
		centerWrapper.appendChild(wordmark);

		const subtitle = document.createElement('span');
		subtitle.className = 'workbench-command-bar__subtitle';
		subtitle.style.display = 'none';
		this._subtitleEl = subtitle;
		centerWrapper.appendChild(subtitle);

		bar.appendChild(centerWrapper);

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

		// Appearance heading
		const themeHeading = document.createElement('div');
		themeHeading.className = 'workbench-settings-heading';
		themeHeading.textContent = 'Appearance';
		themeHeading.id = 'theme-picker-label';
		dropdown.appendChild(themeHeading);

		// Theme radiogroup
		const themeGroup = document.createElement('div');
		themeGroup.setAttribute('role', 'radiogroup');
		themeGroup.setAttribute('aria-labelledby', 'theme-picker-label');
		themeGroup.className = 'workbench-theme-picker';
		this._themeGroupEl = themeGroup;

		for (const opt of THEME_OPTIONS) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'workbench-theme-option';
			btn.setAttribute('role', 'radio');
			btn.setAttribute('aria-checked', opt.value === this._config.getTheme() ? 'true' : 'false');
			btn.dataset['theme'] = opt.value;
			btn.textContent = opt.label;
			btn.addEventListener('click', () => {
				this._config.onSetTheme(opt.value);
				this._updateThemePicker();
			});
			themeGroup.appendChild(btn);
		}

		themeGroup.addEventListener('keydown', (e) => {
			const buttons = Array.from(themeGroup.querySelectorAll<HTMLElement>('.workbench-theme-option'));
			const idx = buttons.indexOf(document.activeElement as HTMLElement);
			if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
				e.preventDefault();
				buttons[(idx + 1) % buttons.length]?.focus();
			} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
				e.preventDefault();
				buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
			} else if (e.key === 'Escape') {
				this._closeDropdown();
			}
		});

		dropdown.appendChild(themeGroup);

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
			void AppDialog.show({
				variant: 'info',
				title: 'About Isometry',
				message: 'Version 5 — Local-first polymorphic data projection platform',
			});
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
				case 'ArrowDown':
					e.preventDefault();
					this._moveFocus(1);
					break;
				case 'ArrowUp':
					e.preventDefault();
					this._moveFocus(-1);
					break;
				case 'Home':
					e.preventDefault();
					this._focusItem(0);
					break;
				case 'End':
					e.preventDefault();
					this._focusItem(this._getMenuItems().length - 1);
					break;
				case 'Escape':
					this._closeDropdown();
					this._triggerEl?.focus();
					break;
			}
		};

		document.addEventListener('click', this._onDocumentClick);
		document.addEventListener('keydown', this._onDocumentKeydown);
	}

	/**
	 * Show or hide the dataset name subtitle below the wordmark.
	 * Pass null or '' to hide; pass a non-empty string to display.
	 */
	setSubtitle(text: string | null): void {
		if (!this._subtitleEl) return;
		if (text === null || text === '') {
			this._subtitleEl.style.display = 'none';
			this._subtitleEl.textContent = '';
		} else {
			this._subtitleEl.style.display = '';
			this._subtitleEl.textContent = text;
		}
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

		this._subtitleEl = null;
		this._dropdownEl = null;
		this._triggerEl = null;
		this._themeGroupEl = null;
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
		return Array.from(this._dropdownEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
	}

	private _focusItem(index: number): void {
		const items = this._getMenuItems();
		items.forEach((el, i) => el.setAttribute('tabindex', i === index ? '0' : '-1'));
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
		this._updateThemePicker();
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

	private _updateThemePicker(): void {
		if (!this._themeGroupEl) return;
		const current = this._config.getTheme();
		for (const btn of this._themeGroupEl.querySelectorAll<HTMLElement>('.workbench-theme-option')) {
			const isActive = btn.dataset['theme'] === current;
			btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
			btn.classList.toggle('workbench-theme-option--active', isActive);
		}
	}

	private _updateDensityLabel(): void {
		if (this._densityItemEl) {
			this._densityItemEl.textContent = `Density: ${this._config.getDensityLabel()}`;
		}
	}
}
