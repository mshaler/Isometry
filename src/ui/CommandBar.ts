/**
 * CommandBar — always-visible top bar of the workbench shell.
 *
 * Provides two elements:
 * 1. App icon (left) — Figma-style dropdown mirroring macOS menu bar
 * 2. Wordmark (center) — "Isometry" in American Typewriter
 *
 * Menu structure is data-driven from menuDefinitions.ts (single source of truth).
 * All triggers delegate to existing provider methods via callback config.
 * CommandBar introduces zero new business logic (INTG-02).
 *
 * Requirements: SHEL-03, INTG-01, INTG-02, INTG-04, MENU-01, MENU-02, MENU-03
 */

import '../styles/workbench.css';
import appIconUrl from '../../assets/Isometry.png';
import { APP_MENU_DEFS, isSeparator, type MenuActionKey } from './menuDefinitions';

export interface CommandBarConfig {
	/** Dispatches a menu action by key. Single handler for all menu items. */
	onMenuAction: (action: MenuActionKey) => void;
}

export class CommandBar {
	private readonly _config: CommandBarConfig;
	private _el: HTMLElement | null = null;
	private _triggerEl: HTMLButtonElement | null = null;
	private _appMenuEl: HTMLElement | null = null;
	private _appMenuOpen = false;

	// Bound listeners for cleanup
	private _onDocumentClick: ((e: MouseEvent) => void) | null = null;
	private _onDocumentKeydown: ((e: KeyboardEvent) => void) | null = null;

	constructor(config: CommandBarConfig) {
		this._config = config;
	}

	mount(container: HTMLElement): void {
		const bar = document.createElement('div');
		bar.className = 'workbench-command-bar';

		// --- App icon with Figma-style dropdown menu ---
		const appIconWrapper = document.createElement('div');
		appIconWrapper.className = 'workbench-command-bar__app-icon-wrapper';

		const appIcon = document.createElement('button');
		appIcon.className = 'workbench-command-bar__app-icon';
		appIcon.setAttribute('aria-label', 'Isometry menu');
		appIcon.setAttribute('aria-haspopup', 'menu');
		appIcon.setAttribute('aria-expanded', 'false');
		appIcon.setAttribute('data-tour-target', 'command-palette-trigger');
		const img = document.createElement('img');
		img.src = appIconUrl;
		img.alt = '';
		img.draggable = false;
		appIcon.appendChild(img);
		appIcon.addEventListener('click', (e) => {
			e.stopPropagation();
			this._toggleAppMenu();
		});
		this._triggerEl = appIcon;
		appIconWrapper.appendChild(appIcon);

		// App menu dropdown — data-driven from menuDefinitions.ts
		const appMenu = document.createElement('div');
		appMenu.className = 'workbench-app-menu';
		appMenu.setAttribute('role', 'menu');
		appMenu.style.display = 'none';
		this._appMenuEl = appMenu;

		for (const entry of APP_MENU_DEFS) {
			if (isSeparator(entry)) {
				const hr = document.createElement('hr');
				hr.className = 'workbench-settings-divider';
				hr.setAttribute('role', 'separator');
				appMenu.appendChild(hr);
				continue;
			}
			const heading = document.createElement('div');
			heading.className = 'workbench-settings-heading';
			heading.textContent = entry.heading;
			appMenu.appendChild(heading);

			for (const item of entry.items) {
				if (isSeparator(item)) {
					const hr = document.createElement('hr');
					hr.className = 'workbench-settings-divider';
					hr.setAttribute('role', 'separator');
					appMenu.appendChild(hr);
					continue;
				}
				const action = item.action;
				appMenu.appendChild(
					this._createMenuItem(item.label, () => this._config.onMenuAction(action), item.shortcut),
				);
			}
		}

		appIconWrapper.appendChild(appMenu);
		bar.appendChild(appIconWrapper);

		// --- Center wrapper: wordmark only ---
		const centerWrapper = document.createElement('div');
		centerWrapper.className = 'workbench-command-bar__center';

		const wordmark = document.createElement('span');
		wordmark.className = 'workbench-command-bar__wordmark';
		wordmark.textContent = 'Isometry';
		centerWrapper.appendChild(wordmark);

		bar.appendChild(centerWrapper);

		container.appendChild(bar);
		this._el = bar;

		this._onDocumentClick = (e: MouseEvent) => {
			if (this._appMenuOpen && !appIconWrapper.contains(e.target as Node)) {
				this._closeAppMenu();
			}
		};

		this._onDocumentKeydown = (e: KeyboardEvent) => {
			if (!this._appMenuOpen) return;
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
					this._closeAppMenu();
					this._triggerEl?.focus();
					break;
			}
		};

		document.addEventListener('click', this._onDocumentClick);
		document.addEventListener('keydown', this._onDocumentKeydown);
	}

	setSubtitle(_text: string | null): void {
		// No-op: subtitle removed from command bar
	}

	destroy(): void {
		if (this._onDocumentClick) {
			document.removeEventListener('click', this._onDocumentClick);
			this._onDocumentClick = null;
		}
		if (this._onDocumentKeydown) {
			document.removeEventListener('keydown', this._onDocumentKeydown);
			this._onDocumentKeydown = null;
		}
		if (this._el) {
			this._el.remove();
			this._el = null;
		}
		this._appMenuEl = null;
		this._triggerEl = null;
		this._appMenuOpen = false;
	}

	// --- Private ---

	private _createMenuItem(text: string, onClick: () => void, shortcut?: string): HTMLButtonElement {
		const item = document.createElement('button');
		item.className = 'workbench-settings-item';
		item.setAttribute('role', 'menuitem');
		item.setAttribute('tabindex', '-1');

		const labelSpan = document.createElement('span');
		labelSpan.textContent = text;
		item.appendChild(labelSpan);

		if (shortcut) {
			const shortcutSpan = document.createElement('span');
			shortcutSpan.className = 'workbench-settings-item__shortcut';
			shortcutSpan.textContent = shortcut;
			item.appendChild(shortcutSpan);
		}

		item.addEventListener('click', (e) => {
			e.stopPropagation();
			onClick();
			this._closeAppMenu();
		});
		return item;
	}

	private _getMenuItems(): HTMLElement[] {
		return Array.from(this._appMenuEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
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

	private _toggleAppMenu(): void {
		if (this._appMenuOpen) {
			this._closeAppMenu();
		} else {
			this._openAppMenu();
		}
	}

	private _openAppMenu(): void {
		if (!this._appMenuEl || !this._triggerEl) return;
		this._appMenuOpen = true;
		this._appMenuEl.style.display = '';
		this._triggerEl.setAttribute('aria-expanded', 'true');
		const items = this._getMenuItems();
		items.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
		items[0]?.focus();
	}

	private _closeAppMenu(): void {
		if (!this._appMenuEl || !this._triggerEl) return;
		this._appMenuOpen = false;
		this._appMenuEl.style.display = 'none';
		this._triggerEl.setAttribute('aria-expanded', 'false');
	}
}
