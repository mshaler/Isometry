// Isometry v5 — Phase 86 Plan 02
// SidebarNav: 8-section persistent sidebar navigation for the workbench.
//
// Requirements: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05
//
// Design:
//   - 8 top-level sections matching the UI-SPEC hierarchy
//   - 3-state toggle per section: hidden / collapsed / visible
//   - Leaf items with accent-colored active state
//   - Stub panels for GRAPH/Formula/Interface Builder using existing .collapsible-section__stub classes
//   - Full keyboard accessibility: tab between headers, enter/space to toggle,
//     roving tabindex with arrow keys within expanded sections
//   - mount(container) / destroy() lifecycle

import '../styles/sidebar-nav.css';
import { resolveRecommendation } from '../providers/ViewDefaultsRegistry';
import { iconSvg } from './icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarItemDef {
	key: string;
	label: string;
	icon: string;
}

interface SidebarSectionDef {
	key: string;
	label: string;
	icon: string;
	items?: SidebarItemDef[];
	stub?: { icon: string; heading: string; body: string };
}

export interface SidebarNavConfig {
	onActivateItem: (sectionKey: string, itemKey: string) => void;
	onActivateSection: (sectionKey: string) => void;
	announcer?: { announce: (message: string) => void };
}

// ---------------------------------------------------------------------------
// Section definitions — exactly matching UI-SPEC table
// ---------------------------------------------------------------------------

const SECTION_DEFS: SidebarSectionDef[] = [
	{
		key: 'data-explorer',
		label: 'Data Explorer',
		icon: 'database',
		items: [
			{ key: 'catalog', label: 'Catalog / CAS', icon: 'folder-open' },
			{ key: 'extensions', label: 'Extensions', icon: 'plug' },
		],
	},
	{
		key: 'properties',
		label: 'Properties Explorer',
		icon: 'sliders',
		items: [], // leaf — clicking header activates
	},
	{
		key: 'projection',
		label: 'Projection Explorer',
		icon: 'layout-template',
		items: [], // leaf — clicking header activates
	},
	{
		key: 'visualization',
		label: 'Visualization Explorer',
		icon: 'bar-chart-2',
		items: [
			{ key: 'list', label: 'List', icon: 'list' },
			{ key: 'gallery', label: 'Gallery', icon: 'image' },
			{ key: 'kanban', label: 'Kanban', icon: 'columns' },
			{ key: 'grid', label: 'Grid', icon: 'grid' },
			{ key: 'supergrid', label: 'SuperGrid', icon: 'table-2' },
			{ key: 'calendar', label: 'Map', icon: 'map' },
			{ key: 'timeline', label: 'Timeline', icon: 'clock' },
			{ key: 'network', label: 'Charts', icon: 'trending-up' },
			{ key: 'tree', label: 'Graphs', icon: 'git-branch' },
		],
	},
	{
		key: 'latch',
		label: 'LATCH Explorers',
		icon: 'tag',
		items: [
			{ key: 'location', label: 'Location Explorer', icon: 'map-pin' },
			{ key: 'alphanumeric', label: 'Alphanumeric Explorer', icon: 'a-large-small' },
			{ key: 'time', label: 'Time Explorer', icon: 'calendar-clock' },
			{ key: 'category', label: 'Category Explorer', icon: 'tags' },
			{ key: 'hierarchy', label: 'Hierarchy Explorer', icon: 'folder-tree' },
		],
	},
	{
		key: 'graph',
		label: 'GRAPH Explorers',
		icon: 'share-2',
		items: [
			{ key: 'path', label: 'Path', icon: 'route' },
			{ key: 'centrality', label: 'Centrality', icon: 'star' },
			{ key: 'community', label: 'Community', icon: 'users' },
			{ key: 'similarity', label: 'Similarity', icon: 'git-merge' },
			{ key: 'link', label: 'Link', icon: 'link' },
			{ key: 'embed', label: 'Embed', icon: 'box' },
		],
		stub: {
			icon: 'share-2',
			heading: 'GRAPH Explorers',
			body: 'Graph analysis tools \u2014 coming soon.',
		},
	},
	{
		key: 'formula',
		label: 'Formula Explorer',
		icon: 'function-square',
		items: [
			{ key: 'dsl', label: 'DSL Formulas', icon: 'function-square' },
			{ key: 'sql', label: 'SQL Queries', icon: 'database' },
			{ key: 'graph-queries', label: 'Graph Queries', icon: 'share-2' },
			{ key: 'audit', label: 'Audit View', icon: 'search' },
		],
		stub: {
			icon: 'function-square',
			heading: 'Formula Explorer',
			body: 'DSL formulas, SQL queries, and graph queries \u2014 coming soon.',
		},
	},
	{
		key: 'interface-builder',
		label: 'Interface Builder',
		icon: 'puzzle',
		items: [
			{ key: 'formats', label: 'Formats', icon: 'file-text' },
			{ key: 'templates', label: 'Templates', icon: 'folder' },
			{ key: 'apps', label: 'Apps', icon: 'smartphone' },
		],
		stub: {
			icon: 'puzzle',
			heading: 'Interface Builder',
			body: 'Formats, templates, and apps \u2014 coming soon.',
		},
	},
];

// Sections with empty items[] are "leaf sections" — header IS the navigation trigger
const LEAF_SECTION_KEYS = new Set(
	SECTION_DEFS.filter((s) => s.items !== undefined && s.items.length === 0).map((s) => s.key),
);

// ---------------------------------------------------------------------------
// SidebarNav
// ---------------------------------------------------------------------------

/**
 * SidebarNav renders an 8-section navigation tree in the workbench sidebar.
 *
 * Each section has a 3-state toggle (hidden | collapsed | visible).
 * Leaf items fire onActivateItem; leaf sections (properties, projection) fire onActivateSection.
 * External view changes are synced via setActiveItem().
 */
export class SidebarNav {
	private readonly _config: SidebarNavConfig;
	private _navEl: HTMLElement | null = null;
	// Map from sectionKey -> section root element
	private _sectionEls: Map<string, HTMLElement> = new Map();
	// Map from sectionKey -> items list element (for roving tabindex)
	private _itemListEls: Map<string, HTMLElement> = new Map();
	// Map from "sectionKey:itemKey" -> item button element
	private _itemEls: Map<string, HTMLButtonElement> = new Map();
	// Currently active item key: "sectionKey:itemKey"
	private _activeKey: string | null = null;

	// Auto-cycle state
	private _cycling: boolean = false;
	private _cycleTimer: ReturnType<typeof setInterval> | null = null;
	private _playStopBtn: HTMLButtonElement | null = null;

	// Bound event handlers for cleanup
	private _headerClickHandlers: Map<string, () => void> = new Map();
	private _headerKeydownHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();
	private _itemClickHandlers: Map<string, () => void> = new Map();
	private _itemKeydownHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

	constructor(config: SidebarNavConfig) {
		this._config = config;
	}

	/**
	 * Build the nav DOM and append to container.
	 */
	mount(container: HTMLElement): void {
		const nav = document.createElement('nav');
		nav.className = 'workbench-sidebar__nav';
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', 'Workbench navigation');
		nav.setAttribute('data-tour-target', 'sidebar-nav');

		for (const sectionDef of SECTION_DEFS) {
			const sectionEl = this._buildSection(sectionDef);
			nav.appendChild(sectionEl);
			this._sectionEls.set(sectionDef.key, sectionEl);
		}

		this._navEl = nav;
		container.appendChild(nav);
	}

	/**
	 * Programmatically set the active sidebar item (e.g. after Cmd+1..9 shortcut).
	 * Auto-expands the section if it is collapsed.
	 */
	setActiveItem(sectionKey: string, itemKey: string): void {
		const compositeKey = `${sectionKey}:${itemKey}`;
		if (this._activeKey === compositeKey) return;

		// Deactivate previous item
		this._clearActive();

		// Activate target item
		const itemEl = this._itemEls.get(compositeKey);
		if (!itemEl) return;

		itemEl.classList.add('sidebar-item--active');
		itemEl.setAttribute('aria-current', 'page');
		this._activeKey = compositeKey;

		// Ensure section is expanded so the active item is visible
		const sectionEl = this._sectionEls.get(sectionKey);
		if (sectionEl && sectionEl.getAttribute('data-state') === 'collapsed') {
			this._setState(sectionKey, 'visible');
		}
	}

	/**
	 * Start auto-cycling through visualization section views at 2000ms intervals.
	 */
	startCycle(): void {
		if (this._cycling) return;
		this._cycling = true;
		this._updatePlayStopButton();
		this._config.announcer?.announce('Auto-cycle started');

		const vizSection = SECTION_DEFS.find((s) => s.key === 'visualization');
		const viewKeys = vizSection?.items?.map((i) => i.key) ?? [];
		if (viewKeys.length === 0) return;

		this._cycleTimer = setInterval(() => {
			const currentItemKey = this._activeKey?.startsWith('visualization:')
				? this._activeKey.split(':')[1]!
				: viewKeys[0]!;
			const currentIndex = viewKeys.indexOf(currentItemKey);
			const nextIndex = (currentIndex + 1) % viewKeys.length;
			const nextKey = viewKeys[nextIndex]!;
			this._activateItem('visualization', nextKey);
		}, 2000);
	}

	/**
	 * Stop auto-cycling and announce to screen readers.
	 */
	stopCycle(): void {
		if (!this._cycling) return;
		if (this._cycleTimer !== null) {
			clearInterval(this._cycleTimer);
			this._cycleTimer = null;
		}
		this._cycling = false;
		this._updatePlayStopButton();

		const activeLabel = this._activeKey?.startsWith('visualization:')
			? (SECTION_DEFS.find((s) => s.key === 'visualization')?.items?.find(
					(i) => i.key === this._activeKey!.split(':')[1],
				)?.label ?? 'current')
			: 'current';
		this._config.announcer?.announce(`Auto-cycle stopped on ${activeLabel} view`);
	}

	/**
	 * Returns true if auto-cycle is currently running.
	 */
	isCycling(): boolean {
		return this._cycling;
	}

	/**
	 * Update recommendation badges on visualization section items.
	 * Adds a ✦ badge (with tooltip) to the recommended view item for the current dataset,
	 * and removes badges from all other items. Pass null to clear all badges.
	 */
	updateRecommendations(sourceType: string | null): void {
		const recommendation = sourceType ? resolveRecommendation(sourceType) : null;

		for (const [compositeKey, btn] of this._itemEls) {
			if (!compositeKey.startsWith('visualization:')) continue;
			const itemKey = compositeKey.split(':')[1]!;

			// Remove existing badge (idempotent)
			const existingBadge = btn.querySelector('.sidebar-item__badge');
			if (existingBadge) existingBadge.remove();
			btn.removeAttribute('title');

			// Add badge if this item is the recommended view
			if (recommendation && itemKey === recommendation.recommendedView) {
				const badge = document.createElement('span');
				badge.className = 'sidebar-item__badge';
				badge.setAttribute('aria-hidden', 'true');
				badge.setAttribute('data-testid', 'sidebar-badge-recommended');
				badge.textContent = '\u2736'; // ✦ U+2736 SIX POINTED BLACK STAR
				btn.appendChild(badge);
				btn.setAttribute('title', recommendation.tooltipText);
			}
		}
	}

	/**
	 * Remove nav element and all event listeners.
	 */
	destroy(): void {
		// Stop auto-cycle before cleanup
		this.stopCycle();
		this._playStopBtn = null;

		// Remove header handlers
		for (const [sectionKey, handler] of this._headerClickHandlers) {
			const sectionEl = this._sectionEls.get(sectionKey);
			const headerEl = sectionEl?.querySelector<HTMLButtonElement>('.sidebar-section__header');
			if (headerEl) headerEl.removeEventListener('click', handler);
		}
		for (const [sectionKey, handler] of this._headerKeydownHandlers) {
			const sectionEl = this._sectionEls.get(sectionKey);
			const headerEl = sectionEl?.querySelector<HTMLButtonElement>('.sidebar-section__header');
			if (headerEl) headerEl.removeEventListener('keydown', handler);
		}

		// Remove item handlers
		for (const [compositeKey, handler] of this._itemClickHandlers) {
			const itemEl = this._itemEls.get(compositeKey);
			if (itemEl) itemEl.removeEventListener('click', handler);
		}
		for (const [compositeKey, handler] of this._itemKeydownHandlers) {
			const itemEl = this._itemEls.get(compositeKey);
			if (itemEl) itemEl.removeEventListener('keydown', handler);
		}

		this._navEl?.remove();
		this._navEl = null;
		this._sectionEls.clear();
		this._itemListEls.clear();
		this._itemEls.clear();
		this._headerClickHandlers.clear();
		this._headerKeydownHandlers.clear();
		this._itemClickHandlers.clear();
		this._itemKeydownHandlers.clear();
		this._activeKey = null;
	}

	// ---------------------------------------------------------------------------
	// Private — DOM construction
	// ---------------------------------------------------------------------------

	private _buildSection(def: SidebarSectionDef): HTMLElement {
		const section = document.createElement('div');
		section.className = 'sidebar-section';
		// Default visualization section to expanded so view items are immediately visible
		const initialState = def.key === 'visualization' ? 'visible' : 'collapsed';
		section.setAttribute('data-state', initialState);
		section.setAttribute('data-section-key', def.key);

		// Header button
		const header = document.createElement('button');
		header.className = 'sidebar-section__header';
		header.type = 'button';
		header.setAttribute('aria-expanded', String(initialState === 'visible'));

		// Icon
		const iconEl = document.createElement('span');
		iconEl.className = 'sidebar-section__icon';
		iconEl.setAttribute('aria-hidden', 'true');
		iconEl.innerHTML = iconSvg(def.icon, 14);

		// Label
		const labelEl = document.createElement('span');
		labelEl.className = 'sidebar-section__label';
		labelEl.textContent = def.label;

		// Chevron — U+25B8 right-pointing triangle (rotates 90deg when visible)
		const chevronEl = document.createElement('span');
		chevronEl.className = 'sidebar-section__chevron';
		chevronEl.setAttribute('aria-hidden', 'true');
		chevronEl.textContent = '\u25B8';

		header.appendChild(iconEl);
		header.appendChild(labelEl);

		// Auto-cycle Play/Stop button — only for visualization section
		if (def.key === 'visualization') {
			const playStopBtn = document.createElement('button');
			playStopBtn.className = 'sidebar-cycle-btn sidebar-cycle-btn--play';
			playStopBtn.type = 'button';
			playStopBtn.textContent = '\u25B6';
			playStopBtn.setAttribute('aria-label', 'Play auto-cycle');
			playStopBtn.setAttribute('aria-pressed', 'false');
			// Stop event propagation so clicking play/stop doesn't toggle the section
			playStopBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (this._cycling) {
					this.stopCycle();
				} else {
					this.startCycle();
				}
			});
			this._playStopBtn = playStopBtn;
			// Insert before chevron so layout is: icon | label | play/stop | chevron
			header.appendChild(playStopBtn);
		}

		header.appendChild(chevronEl);
		section.appendChild(header);

		// Items list (always present; max-height 0 when collapsed)
		const itemsList = document.createElement('ul');
		itemsList.className = 'sidebar-section__items';
		itemsList.setAttribute('role', 'list');

		if (def.items && def.items.length > 0) {
			def.items.forEach((itemDef, index) => {
				const li = document.createElement('li');
				const btn = this._buildItem(def.key, itemDef, index);
				li.appendChild(btn);
				itemsList.appendChild(li);
			});

			// If section has a stub, add it after the items list for "coming soon" display
			if (def.stub) {
				const stubEl = this._buildStub(def.stub);
				itemsList.appendChild(stubEl);
			}
		}

		section.appendChild(itemsList);
		this._itemListEls.set(def.key, itemsList);

		// Wire header click handler
		const clickHandler = () => this._toggleSection(def.key);
		this._headerClickHandlers.set(def.key, clickHandler);
		header.addEventListener('click', clickHandler);

		// Wire header keydown for Enter/Space toggle
		const keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this._toggleSection(def.key);
			}
		};
		this._headerKeydownHandlers.set(def.key, keydownHandler);
		header.addEventListener('keydown', keydownHandler);

		return section;
	}

	private _buildItem(sectionKey: string, itemDef: SidebarItemDef, index: number): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.className = 'sidebar-item';
		btn.type = 'button';
		// Roving tabindex: first item focusable, rest skip in tab order
		btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
		btn.setAttribute('data-item-key', itemDef.key);

		const iconEl = document.createElement('span');
		iconEl.className = 'sidebar-item__icon';
		iconEl.setAttribute('aria-hidden', 'true');
		iconEl.innerHTML = iconSvg(itemDef.icon, 12);

		const labelEl = document.createElement('span');
		labelEl.className = 'sidebar-item__label';
		labelEl.textContent = itemDef.label;

		btn.appendChild(iconEl);
		btn.appendChild(labelEl);

		const compositeKey = `${sectionKey}:${itemDef.key}`;
		this._itemEls.set(compositeKey, btn);

		// Click handler
		const clickHandler = () => this._activateItem(sectionKey, itemDef.key);
		this._itemClickHandlers.set(compositeKey, clickHandler);
		btn.addEventListener('click', clickHandler);

		// Keydown handler: ArrowDown/ArrowUp for roving tabindex, Enter to activate
		const keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this._activateItem(sectionKey, itemDef.key);
			} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				this._roveFocus(sectionKey, btn, e.key === 'ArrowDown' ? 1 : -1);
			}
		};
		this._itemKeydownHandlers.set(compositeKey, keydownHandler);
		btn.addEventListener('keydown', keydownHandler);

		return btn;
	}

	private _buildStub(stub: { icon: string; heading: string; body: string }): HTMLElement {
		// Reuse existing .collapsible-section__stub* classes from workbench.css
		const stubEl = document.createElement('div');
		stubEl.className = 'collapsible-section__stub';

		const stubIcon = document.createElement('span');
		stubIcon.className = 'collapsible-section__stub-icon';
		stubIcon.innerHTML = iconSvg(stub.icon, 14);

		const stubText = document.createElement('span');
		stubText.className = 'collapsible-section__stub-text';
		stubText.textContent = `${stub.heading} \u2014 ${stub.body}`;

		stubEl.appendChild(stubIcon);
		stubEl.appendChild(stubText);
		return stubEl;
	}

	// ---------------------------------------------------------------------------
	// Private — state management
	// ---------------------------------------------------------------------------

	private _toggleSection(sectionKey: string): void {
		const sectionEl = this._sectionEls.get(sectionKey);
		if (!sectionEl) return;

		const currentState = sectionEl.getAttribute('data-state');

		if (LEAF_SECTION_KEYS.has(sectionKey)) {
			// Leaf sections toggle AND call onActivateSection
			const newState = currentState === 'visible' ? 'collapsed' : 'visible';
			this._setState(sectionKey, newState);
			if (newState === 'visible') {
				this._config.onActivateSection(sectionKey);
			}
		} else {
			// Regular sections toggle collapsed <-> visible
			const newState = currentState === 'visible' ? 'collapsed' : 'visible';
			this._setState(sectionKey, newState);
		}
	}

	private _setState(sectionKey: string, state: 'hidden' | 'collapsed' | 'visible'): void {
		const sectionEl = this._sectionEls.get(sectionKey);
		if (!sectionEl) return;

		sectionEl.setAttribute('data-state', state);

		const headerEl = sectionEl.querySelector<HTMLButtonElement>('.sidebar-section__header');
		if (headerEl) {
			headerEl.setAttribute('aria-expanded', String(state === 'visible'));
		}
	}

	private _activateItem(sectionKey: string, itemKey: string): void {
		const compositeKey = `${sectionKey}:${itemKey}`;

		// Manual item activation stops auto-cycle
		if (this._cycling && sectionKey === 'visualization') {
			this.stopCycle();
		}

		// Deactivate previous
		this._clearActive();

		// Activate target
		const itemEl = this._itemEls.get(compositeKey);
		if (!itemEl) return;

		itemEl.classList.add('sidebar-item--active');
		itemEl.setAttribute('aria-current', 'page');
		this._activeKey = compositeKey;

		// Notify caller
		this._config.onActivateItem(sectionKey, itemKey);
	}

	private _clearActive(): void {
		if (!this._activeKey) return;
		const prevEl = this._itemEls.get(this._activeKey);
		if (prevEl) {
			prevEl.classList.remove('sidebar-item--active');
			prevEl.removeAttribute('aria-current');
		}
		this._activeKey = null;
	}

	/**
	 * Sync the play/stop button visual state with current _cycling state.
	 */
	private _updatePlayStopButton(): void {
		if (!this._playStopBtn) return;
		if (this._cycling) {
			this._playStopBtn.className = 'sidebar-cycle-btn sidebar-cycle-btn--stop';
			this._playStopBtn.textContent = '\u25A0';
			this._playStopBtn.setAttribute('aria-label', 'Stop auto-cycle');
			this._playStopBtn.setAttribute('aria-pressed', 'true');
		} else {
			this._playStopBtn.className = 'sidebar-cycle-btn sidebar-cycle-btn--play';
			this._playStopBtn.textContent = '\u25B6';
			this._playStopBtn.setAttribute('aria-label', 'Play auto-cycle');
			this._playStopBtn.setAttribute('aria-pressed', 'false');
		}
	}

	/**
	 * Move focus within a section's item list using roving tabindex pattern.
	 * direction: +1 = next, -1 = previous
	 */
	private _roveFocus(sectionKey: string, currentBtn: HTMLButtonElement, direction: 1 | -1): void {
		const listEl = this._itemListEls.get(sectionKey);
		if (!listEl) return;

		const buttons = Array.from(listEl.querySelectorAll<HTMLButtonElement>('button.sidebar-item'));
		const currentIndex = buttons.indexOf(currentBtn);
		if (currentIndex === -1) return;

		const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
		const nextBtn = buttons[nextIndex];
		if (!nextBtn) return;

		// Update roving tabindex
		for (const btn of buttons) {
			btn.setAttribute('tabindex', '-1');
		}
		nextBtn.setAttribute('tabindex', '0');
		nextBtn.focus();
	}
}
