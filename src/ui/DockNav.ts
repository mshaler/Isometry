// Isometry v5 — Phase 180 Plan 02
// DockNav: horizontal ribbon bar with verb-noun sections.
//
// Requirements: HRIB-01, HRIB-02, HRIB-03, HRIB-06, HRIB-07
//
// Design:
//   - 5 sections (Integrate, Visualize, Analyze, Activate, Settings & Help)
//   - 56px-tall horizontal ribbon with section labels above items
//   - Active item uses var(--accent) background fill (D-09)
//   - Event delegation: single click listener on nav element (v6.0 performance pattern)
//   - mount(container) / destroy() / setActiveItem() / updateRecommendations() lifecycle
//   - ArrowLeft/ArrowRight keyboard nav (horizontal orientation)

import '../styles/dock-nav.css';
import { iconSvg } from './icons';
import { DOCK_DEFS } from './section-defs';

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
 * DockNav renders a horizontal ribbon bar with 5 verb-noun sections.
 *
 * Items fire onActivateItem on click. External view changes are synced via setActiveItem().
 * Uses event delegation (single listener on nav) per v6.0 performance pattern.
 * Keyboard navigation uses ArrowLeft/ArrowRight (horizontal orientation).
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
	// Bound keydown handler for cleanup
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	// Bound scroll handler for overflow detection
	private _scrollHandler: (() => void) | null = null;
	// Ordered dock item buttons (source of truth for arrow key navigation, section headers excluded)
	private _orderedItems: HTMLButtonElement[] = [];
	// Current roving tabindex focus index
	private _focusIndex: number = 0;

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
		list.setAttribute('role', 'tablist');
		list.setAttribute('aria-orientation', 'horizontal');

		for (const sectionDef of DOCK_DEFS) {
			const sectionEl = document.createElement('li');
			sectionEl.className = 'dock-nav__section';

			const header = document.createElement('span');
			header.className = 'dock-nav__section-header';
			header.setAttribute('aria-hidden', 'true');
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
				btn.setAttribute('role', 'tab');
				btn.setAttribute('aria-label', itemDef.label);
				btn.setAttribute('aria-selected', 'false');
				btn.title = itemDef.label;

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
				this._orderedItems.push(btn);
			}

			sectionEl.appendChild(itemsList);
			list.appendChild(sectionEl);
		}

		nav.appendChild(list);

		// Initialize roving tabindex — first item is focusable, rest are -1
		this._orderedItems.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));

		// Keydown handler for arrow key navigation (event delegation)
		this._keydownHandler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains('dock-nav__item')) return;
			const items = this._orderedItems;
			const len = items.length;
			if (len === 0) return;

			let nextIndex = this._focusIndex;
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				nextIndex = (this._focusIndex + 1) % len;
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				nextIndex = (this._focusIndex - 1 + len) % len;
			} else if (e.key === 'Home') {
				e.preventDefault();
				nextIndex = 0;
			} else if (e.key === 'End') {
				e.preventDefault();
				nextIndex = len - 1;
			} else {
				return;
			}

			items[this._focusIndex]!.setAttribute('tabindex', '-1');
			items[nextIndex]!.setAttribute('tabindex', '0');
			items[nextIndex]!.focus();
			this._focusIndex = nextIndex;
		};
		nav.addEventListener('keydown', this._keydownHandler);

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

		this._navEl = nav;
		container.appendChild(nav);

		// Overflow scroll detection for CSS fade masks (UI-SPEC)
		const checkOverflow = () => {
			const sl = nav.scrollLeft;
			const sw = nav.scrollWidth;
			const cw = nav.clientWidth;
			nav.classList.toggle('dock-nav--has-overflow', sw > cw);
			nav.classList.toggle('dock-nav--overflow-left', sl > 0);
			nav.classList.toggle('dock-nav--overflow-right', sl + cw < sw - 1);
		};
		this._scrollHandler = checkOverflow;
		nav.addEventListener('scroll', checkOverflow, { passive: true });
		// Initial check after mount
		requestAnimationFrame(checkOverflow);
	}

	/**
	 * Programmatically sync active state without firing onActivateItem callback.
	 */
	setActiveItem(sectionKey: string, itemKey: string): void {
		this._setActive(sectionKey, itemKey);
	}

	/**
	 * Set aria-pressed on a toggle-type dock item (e.g., integrate:catalog).
	 * Separate from _setActive which manages aria-selected for navigation items.
	 */
	setItemPressed(compositeKey: string, pressed: boolean): void {
		const el = this._itemEls.get(compositeKey);
		if (!el) return;
		el.setAttribute('aria-pressed', String(pressed));
		if (pressed) {
			el.classList.add('dock-nav__item--active');
		} else {
			el.classList.remove('dock-nav__item--active');
		}
	}

	/**
	 * No-op stub — DockNav has no recommendation badges.
	 * Kept for API parity with SidebarNav so main.ts needs no changes.
	 */
	updateRecommendations(_sourceType: string | null): void {
		// intentional no-op
	}

	/**
	 * Remove nav element and clear event listeners.
	 */
	destroy(): void {
		if (this._navEl && this._clickHandler) {
			this._navEl.removeEventListener('click', this._clickHandler);
		}
		if (this._navEl && this._keydownHandler) {
			this._navEl.removeEventListener('keydown', this._keydownHandler);
		}
		if (this._navEl && this._scrollHandler) {
			this._navEl.removeEventListener('scroll', this._scrollHandler);
		}
		this._navEl?.remove();
		this._navEl = null;
		this._itemEls.clear();
		this._clickHandler = null;
		this._keydownHandler = null;
		this._scrollHandler = null;
		this._orderedItems = [];
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
				prevEl.setAttribute('aria-selected', 'false');
			}
		}

		// Activate target
		const itemEl = this._itemEls.get(compositeKey);
		if (!itemEl) return;

		itemEl.classList.add('dock-nav__item--active');
		itemEl.setAttribute('aria-current', 'page');
		itemEl.setAttribute('aria-selected', 'true');
		this._activeKey = compositeKey;
	}
}
