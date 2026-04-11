// Isometry v5 — Phase 146 Plan 01
// DockNav: 48px-wide vertical icon strip organized by verb-noun taxonomy.
//
// Requirements: DOCK-01, DOCK-02, DOCK-04, A11Y-03
//
// Design:
//   - 5 sections (Integrate, Visualize, Analyze, Activate, Help)
//   - 48x48px icon+label buttons from DOCK_DEFS
//   - Active item uses var(--accent) icon color only — no background fill (D-04)
//   - Event delegation: single click listener on nav element (v6.0 performance pattern)
//   - mount(container) / destroy() / setActiveItem() / updateRecommendations() lifecycle

import '../styles/dock-nav.css';
import { DOCK_DEFS } from './section-defs';
import { iconSvg } from './icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DockNavConfig {
	onActivateItem: (sectionKey: string, itemKey: string) => void;
	onActivateSection: (sectionKey: string) => void;
	announcer?: { announce: (message: string) => void };
}

// ---------------------------------------------------------------------------
// DockNav
// ---------------------------------------------------------------------------

/**
 * DockNav renders a 48px-wide vertical icon strip with section dividers.
 *
 * Items fire onActivateItem on click. External view changes are synced via setActiveItem().
 * Uses event delegation (single listener on nav) per v6.0 performance pattern.
 */
export class DockNav {
	private readonly _config: DockNavConfig;
	private _navEl: HTMLElement | null = null;
	// Map from "sectionKey:itemKey" -> button element for fast setActiveItem lookup
	private _itemEls: Map<string, HTMLButtonElement> = new Map();
	// Currently active composite key
	private _activeKey: string | null = null;
	// Bound click handler for cleanup
	private _clickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(config: DockNavConfig) {
		this._config = config;
	}

	/**
	 * Build the dock DOM and append to container.
	 */
	mount(container: HTMLElement): void {
		const nav = document.createElement('nav');
		nav.className = 'dock-nav';
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', 'Main navigation');

		const list = document.createElement('ul');
		list.className = 'dock-nav__list';

		for (const sectionDef of DOCK_DEFS) {
			const sectionEl = document.createElement('li');
			sectionEl.className = 'dock-nav__section';

			const header = document.createElement('span');
			header.className = 'dock-nav__section-header';
			header.textContent = sectionDef.label;
			sectionEl.appendChild(header);

			const itemsList = document.createElement('ul');
			itemsList.className = 'dock-nav__section-items';

			for (const itemDef of sectionDef.items) {
				const li = document.createElement('li');

				const btn = document.createElement('button');
				btn.className = 'dock-nav__item';
				btn.type = 'button';
				btn.setAttribute('data-section-key', sectionDef.key);
				btn.setAttribute('data-item-key', itemDef.key);
				btn.setAttribute('aria-label', itemDef.label);

				const iconEl = document.createElement('span');
				iconEl.className = 'dock-nav__item-icon';
				iconEl.setAttribute('aria-hidden', 'true');
				iconEl.innerHTML = iconSvg(itemDef.icon, 20);

				const labelEl = document.createElement('span');
				labelEl.className = 'dock-nav__item-label';
				labelEl.textContent = itemDef.label;

				btn.appendChild(iconEl);
				btn.appendChild(labelEl);
				li.appendChild(btn);
				itemsList.appendChild(li);

				const compositeKey = `${sectionDef.key}:${itemDef.key}`;
				this._itemEls.set(compositeKey, btn);
			}

			sectionEl.appendChild(itemsList);
			list.appendChild(sectionEl);
		}

		// Single click listener on nav (event delegation)
		this._clickHandler = (e: MouseEvent) => {
			const target = e.target as Element;
			const btn = target.closest<HTMLButtonElement>('.dock-nav__item');
			if (!btn) return;
			const sectionKey = btn.getAttribute('data-section-key');
			const itemKey = btn.getAttribute('data-item-key');
			if (sectionKey && itemKey) {
				this._activateItem(sectionKey, itemKey);
			}
		};
		nav.addEventListener('click', this._clickHandler);

		nav.appendChild(list);
		this._navEl = nav;
		container.appendChild(nav);
	}

	/**
	 * Programmatically sync active state without firing onActivateItem callback.
	 */
	setActiveItem(sectionKey: string, itemKey: string): void {
		this._setActive(sectionKey, itemKey);
	}

	/**
	 * No-op stub — DockNav has no recommendation badges.
	 * Kept for API parity with SidebarNav so main.ts needs no changes.
	 */
	updateRecommendations(_sourceType: string | null): void {
		// intentional no-op
	}

	/**
	 * Remove nav element and clear event listener.
	 */
	destroy(): void {
		if (this._navEl && this._clickHandler) {
			this._navEl.removeEventListener('click', this._clickHandler);
		}
		this._navEl?.remove();
		this._navEl = null;
		this._itemEls.clear();
		this._clickHandler = null;
		this._activeKey = null;
	}

	// ---------------------------------------------------------------------------
	// Private
	// ---------------------------------------------------------------------------

	/** Activate item and fire onActivateItem callback. */
	private _activateItem(sectionKey: string, itemKey: string): void {
		this._setActive(sectionKey, itemKey);
		this._config.onActivateItem(sectionKey, itemKey);
	}

	/** Update DOM active state without firing callback (shared by both public and private paths). */
	private _setActive(sectionKey: string, itemKey: string): void {
		const compositeKey = `${sectionKey}:${itemKey}`;
		if (this._activeKey === compositeKey) return;

		// Deactivate previous
		if (this._activeKey) {
			const prevEl = this._itemEls.get(this._activeKey);
			if (prevEl) {
				prevEl.classList.remove('dock-nav__item--active');
				prevEl.removeAttribute('aria-current');
			}
		}

		// Activate target
		const itemEl = this._itemEls.get(compositeKey);
		if (!itemEl) return;

		itemEl.classList.add('dock-nav__item--active');
		itemEl.setAttribute('aria-current', 'page');
		this._activeKey = compositeKey;
	}
}
