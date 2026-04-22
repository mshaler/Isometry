// Isometry v5 — View Tab Bar
// Onscreen buttons for switching between the 9 views.
//
// Design:
//   - Horizontal tab bar below the view toolbar
//   - Each tab is a button with the view name
//   - Active view tab is highlighted
//   - Clicking a tab switches to that view
//   - Listens for view changes to update active state
//
// Follows existing DOM patterns: pure TypeScript, CSS variables from design-tokens.css

import type { ViewType } from '../providers/types';
import '../styles/view-tab-bar.css';

interface ViewTabBarConfig {
	container: HTMLElement;
	onSwitch: (viewType: ViewType) => void;
	/** Target element to append the tab bar into (required for SuperWidget slot mounting) */
	mountTarget?: HTMLElement;
}

const VIEW_LABELS: { type: ViewType; label: string; shortcut: string }[] = [
	{ type: 'list', label: 'List', shortcut: '⌘1' },
	{ type: 'grid', label: 'Grid', shortcut: '⌘2' },
	{ type: 'kanban', label: 'Kanban', shortcut: '⌘3' },
	{ type: 'calendar', label: 'Calendar', shortcut: '⌘4' },
	{ type: 'timeline', label: 'Timeline', shortcut: '⌘5' },
	{ type: 'gallery', label: 'Gallery', shortcut: '⌘6' },
	{ type: 'network', label: 'Network', shortcut: '⌘7' },
	{ type: 'tree', label: 'Tree', shortcut: '⌘8' },
	{ type: 'supergrid', label: 'SuperGrid', shortcut: '⌘9' },
];

export class ViewTabBar {
	private _el: HTMLElement;
	private _buttons = new Map<ViewType, HTMLButtonElement>();
	private _activeType: ViewType = 'list';

	constructor(config: ViewTabBarConfig) {
		this._el = document.createElement('nav');
		this._el.className = 'view-tab-bar';
		this._el.setAttribute('role', 'tablist');
		this._el.setAttribute('aria-label', 'View switcher');

		for (const view of VIEW_LABELS) {
			const btn = document.createElement('button');
			btn.className = 'view-tab';
			btn.setAttribute('role', 'tab');
			btn.setAttribute('aria-selected', 'false');
			// Roving tabindex: first tab starts as '0', rest are '-1'
			btn.setAttribute('tabindex', view === VIEW_LABELS[0] ? '0' : '-1');
			btn.title = `${view.label} (${view.shortcut})`;
			btn.textContent = view.label;
			btn.addEventListener('click', () => {
				config.onSwitch(view.type);
			});
			this._buttons.set(view.type, btn);
			this._el.appendChild(btn);
		}

		// Arrow key navigation
		this._el.addEventListener('keydown', (e: KeyboardEvent) => {
			const types = VIEW_LABELS.map((v) => v.type);
			const currentIndex = types.indexOf(this._activeType);
			let nextIndex: number | null = null;
			if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % types.length;
			else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + types.length) % types.length;
			else if (e.key === 'Home') nextIndex = 0;
			else if (e.key === 'End') nextIndex = types.length - 1;

			if (nextIndex !== null) {
				e.preventDefault();
				config.onSwitch(types[nextIndex]!);
				this._buttons.get(types[nextIndex]!)?.focus();
			}
		});

		// Mount the tab bar into the DOM.
		// If mountTarget is provided, append directly to it (SuperWidget slot).
		// If no mountTarget, insert before the container element as a fallback.
		if (config.mountTarget) {
			config.mountTarget.appendChild(this._el);
		} else {
			config.container.parentElement?.insertBefore(this._el, config.container);
		}
	}

	/**
	 * Update the active tab visually. Call this after view switch completes.
	 */
	setActive(viewType: ViewType): void {
		// Deactivate previous
		const prevBtn = this._buttons.get(this._activeType);
		if (prevBtn) {
			prevBtn.classList.remove('view-tab--active');
			prevBtn.setAttribute('aria-selected', 'false');
			prevBtn.setAttribute('tabindex', '-1');
		}
		// Activate new
		const nextBtn = this._buttons.get(viewType);
		if (nextBtn) {
			nextBtn.classList.add('view-tab--active');
			nextBtn.setAttribute('aria-selected', 'true');
			nextBtn.setAttribute('tabindex', '0');
		}
		this._activeType = viewType;
	}

	destroy(): void {
		this._el.remove();
	}
}
