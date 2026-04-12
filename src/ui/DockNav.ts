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
import { renderMinimap, clearMinimap, attachLoupeInteraction } from './MinimapRenderer';
import type { CardDatum } from '../views/types';
import type { AxisMapping } from '../providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollapseState = 'hidden' | 'icon-only' | 'icon-thumbnail';

export interface DockNavConfig {
	onActivateItem: (sectionKey: string, itemKey: string) => void;
	onActivateSection: (sectionKey: string) => void;
	announcer?: { announce: (message: string) => void };
	bridge: { send(cmd: string, payload: unknown): Promise<unknown> };
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
	// Bound keydown handler for cleanup
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	// Ordered dock item buttons (source of truth for arrow key navigation, section headers excluded)
	private _orderedItems: HTMLButtonElement[] = [];
	// Current roving tabindex focus index
	private _focusIndex: number = 0;
	// Collapse state
	private _collapseState: CollapseState = 'icon-only';
	private _toggleEl: HTMLButtonElement | null = null;
	private _contentEl: HTMLDivElement | null = null;
	private _sidebarEl: HTMLElement | null = null;
	// Thumbnail rendering
	private _idleCallbackIds: number[] = [];
	private _thumbnailDataSource: (() => { cards: CardDatum[]; pafvAxes: { xAxis: AxisMapping | null; yAxis: AxisMapping | null; groupBy: AxisMapping | null; colAxes: AxisMapping[]; rowAxes: AxisMapping[] } }) | null = null;
	private _reRenderTimer: ReturnType<typeof setTimeout> | null = null;
	private _loupeCleanups: (() => void)[] = [];
	private _onNavigate: ((normX: number, normY: number) => void) | null = null;

	constructor(config: DockNavConfig) {
		this._config = config;
	}

	/**
	 * Build the dock DOM and append to container.
	 */
	mount(container: HTMLElement): void {
		this._sidebarEl = container;

		const nav = document.createElement('nav');
		nav.className = 'dock-nav';
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', 'Main navigation');

		// Toggle button — always visible, pinned at top of nav
		const toggle = document.createElement('button');
		toggle.className = 'dock-nav__toggle';
		toggle.type = 'button';
		toggle.setAttribute('aria-label', 'Toggle navigation');
		toggle.setAttribute('aria-expanded', 'true');
		toggle.innerHTML = iconSvg('panel-left', 20);
		nav.appendChild(toggle);
		this._toggleEl = toggle;

		const list = document.createElement('ul');
		list.className = 'dock-nav__list';
		list.setAttribute('role', 'tablist');
		list.setAttribute('aria-orientation', 'vertical');

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

				const iconEl = document.createElement('span');
				iconEl.className = 'dock-nav__item-icon';
				iconEl.setAttribute('aria-hidden', 'true');
				iconEl.innerHTML = iconSvg(itemDef.icon, 20);

				const labelEl = document.createElement('span');
				labelEl.className = 'dock-nav__item-label';
				labelEl.textContent = itemDef.label;

				// Thumbnail placeholder (hidden by default, visible in icon-thumbnail state)
				const thumb = document.createElement('div');
				thumb.className = 'dock-nav__item-thumb';
				thumb.setAttribute('aria-hidden', 'true');

				btn.appendChild(iconEl);
				btn.appendChild(labelEl);
				btn.appendChild(thumb);
				li.appendChild(btn);
				itemsList.appendChild(li);

				const compositeKey = `${sectionDef.key}:${itemDef.key}`;
				this._itemEls.set(compositeKey, btn);
				this._orderedItems.push(btn);
			}

			sectionEl.appendChild(itemsList);
			list.appendChild(sectionEl);
		}

		// Wrap list in grid animation container
		const content = document.createElement('div');
		content.className = 'dock-nav__content';
		content.appendChild(list);
		nav.appendChild(content);
		this._contentEl = content;

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
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				nextIndex = (this._focusIndex + 1) % len;
			} else if (e.key === 'ArrowUp') {
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
			// Toggle button click
			if (target.closest('.dock-nav__toggle')) {
				const cycle: Record<CollapseState, CollapseState> = {
					'hidden': 'icon-only',
					'icon-only': 'icon-thumbnail',
					'icon-thumbnail': 'hidden',
				};
				const next = cycle[this._collapseState];
				this._applyCollapseState(next);
				void this._config.bridge.send('ui:set', { key: 'dock:collapse-state', value: next });
				const announceText: Record<CollapseState, string> = {
					'hidden': 'Hidden',
					'icon-only': 'Icon only',
					'icon-thumbnail': 'Icon and thumbnail',
				};
				this._config.announcer?.announce(announceText[next]);
				return;
			}
			const btn = target.closest<HTMLButtonElement>('.dock-nav__item');
			if (!btn) return;
			const sectionKey = btn.getAttribute('data-section-key');
			const itemKey = btn.getAttribute('data-item-key');
			if (sectionKey && itemKey) {
				this._activateItem(sectionKey, itemKey);
			}
		};
		nav.addEventListener('click', this._clickHandler);

		// Apply default state
		nav.classList.add('dock-nav--icon-only');
		container.classList.add('workbench-sidebar--icon-only');

		this._navEl = nav;
		container.appendChild(nav);

		// Restore persisted collapse state
		void (async () => {
			try {
				const row = (await this._config.bridge.send('ui:get', { key: 'dock:collapse-state' })) as { value?: string | null } | null;
				if (row?.value && (['hidden', 'icon-only', 'icon-thumbnail'] as string[]).includes(row.value)) {
					this._applyCollapseState(row.value as CollapseState);
				}
			} catch { /* use default icon-only */ }
		})();
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
	 * Inject a data callback for thumbnail rendering.
	 * Called from main.ts to provide current cards and PAFV state without
	 * DockNav subscribing to StateCoordinator directly.
	 */
	setThumbnailDataSource(fn: typeof this._thumbnailDataSource): void {
		this._thumbnailDataSource = fn;
	}

	/**
	 * Store the navigate callback for loupe interaction.
	 * Called from main.ts to provide the scroll/pan handler.
	 */
	setNavigateCallback(fn: (normX: number, normY: number) => void): void {
		this._onNavigate = fn;
	}

	/**
	 * Request a debounced thumbnail re-render.
	 * No-op if dock is not in icon-thumbnail state (per MMAP-02/D-09).
	 * Debounced at 300ms to prevent flooding on rapid state changes.
	 */
	requestThumbnailUpdate(): void {
		if (this._collapseState !== 'icon-thumbnail') return;
		if (this._reRenderTimer !== null) clearTimeout(this._reRenderTimer);
		this._reRenderTimer = setTimeout(() => {
			this._reRenderTimer = null;
			this._renderAllThumbnails();
		}, 300);
	}

	/**
	 * Remove nav element and clear event listener.
	 */
	destroy(): void {
		if (this._navEl && this._clickHandler) {
			this._navEl.removeEventListener('click', this._clickHandler);
		}
		if (this._navEl && this._keydownHandler) {
			this._navEl.removeEventListener('keydown', this._keydownHandler);
		}
		for (const id of this._idleCallbackIds) cancelIdleCallback(id);
		this._idleCallbackIds = [];
		if (this._reRenderTimer !== null) {
			clearTimeout(this._reRenderTimer);
			this._reRenderTimer = null;
		}
		for (const cleanup of this._loupeCleanups) cleanup();
		this._loupeCleanups = [];
		this._thumbnailDataSource = null;
		this._onNavigate = null;
		this._navEl?.remove();
		this._navEl = null;
		this._itemEls.clear();
		this._clickHandler = null;
		this._keydownHandler = null;
		this._orderedItems = [];
		this._activeKey = null;
		this._toggleEl = null;
		this._contentEl = null;
		this._sidebarEl = null;
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

	/** Apply a collapse state: update CSS classes on nav and sidebar container, sync aria-expanded. */
	private _applyCollapseState(state: CollapseState): void {
		if (!this._navEl) return;
		this._navEl.classList.remove('dock-nav--hidden', 'dock-nav--icon-only', 'dock-nav--icon-thumbnail');
		this._navEl.classList.add(`dock-nav--${state}`);
		if (this._sidebarEl) {
			this._sidebarEl.classList.remove('workbench-sidebar--hidden', 'workbench-sidebar--icon-only', 'workbench-sidebar--icon-thumbnail');
			this._sidebarEl.classList.add(`workbench-sidebar--${state}`);
		}
		if (this._toggleEl) {
			this._toggleEl.setAttribute('aria-expanded', state === 'hidden' ? 'false' : 'true');
		}
		// Manage tabindex per collapse state: hidden removes all items from tab order
		if (state === 'hidden') {
			this._orderedItems.forEach(el => el.setAttribute('tabindex', '-1'));
		} else {
			// Restore roving tabindex — current focus index gets tabindex="0"
			this._orderedItems.forEach((el, i) => el.setAttribute('tabindex', i === this._focusIndex ? '0' : '-1'));
		}
		this._collapseState = state;

		// Cancel any pending thumbnail renders
		for (const id of this._idleCallbackIds) cancelIdleCallback(id);
		this._idleCallbackIds = [];

		if (state === 'icon-thumbnail') {
			this._renderAllThumbnails();
		}
	}

	/** Stagger thumbnail rendering for 'visualize' section items via requestIdleCallback. */
	private _renderAllThumbnails(): void {
		if (!this._thumbnailDataSource) return;
		const { cards, pafvAxes } = this._thumbnailDataSource();
		const vizItems = [...this._itemEls.entries()].filter(([key]) => key.startsWith('visualize:'));

		// Clean up previous loupe listeners before re-rendering
		for (const cleanup of this._loupeCleanups) cleanup();
		this._loupeCleanups = [];

		const BATCH_SIZE = 3;
		for (let i = 0; i < vizItems.length; i += BATCH_SIZE) {
			const batch = vizItems.slice(i, i + BATCH_SIZE);
			const id = requestIdleCallback(() => {
				for (const [compositeKey, btn] of batch) {
					const viewKey = compositeKey.split(':')[1]!;
					const thumbEl = btn.querySelector<HTMLDivElement>('.dock-nav__item-thumb');
					if (thumbEl) {
						renderMinimap(thumbEl, viewKey, cards, pafvAxes);
						if (this._onNavigate) {
							const cleanup = attachLoupeInteraction(thumbEl, this._onNavigate);
							this._loupeCleanups.push(cleanup);
						}
					}
				}
			});
			this._idleCallbackIds.push(id);
		}
	}
}
