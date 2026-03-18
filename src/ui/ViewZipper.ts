// Isometry v5 — Phase 87 Plan 01
// ViewZipper: horizontal tab strip for switching between 9 views, with
// auto-cycle Play/Stop control and screen reader announcements.
//
// Design:
//   - Mounts into the Visualization Explorer panel content slot (not menubar)
//   - 9 tabs with UAT labels: List, Gallery, Kanban, Grid, SuperGrid, Map, Timeline, Charts, Graphs
//   - Roving tabindex keyboard navigation (ArrowLeft/Right, Home, End)
//   - Play/Stop auto-cycle at 2000ms interval with crossfade signal
//   - Announcer integration for all state changes (view switch, cycle start, cycle stop)
//
// Requirements: VZIP-01, VZIP-02, VZIP-06, VZIP-07

import type { ViewType } from '../providers/types';
import type { Announcer } from '../accessibility/Announcer';
import '../styles/view-zipper.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewZipperConfig {
	/** Mount target element — ViewZipper appends its nav here */
	container: HTMLElement;
	/** Called on tab click or keyboard-triggered activation or cycle step */
	onSwitch: (viewType: ViewType) => void;
	/** Announcer for screen reader messages */
	announcer: Announcer;
}

// ---------------------------------------------------------------------------
// Tab definitions — UAT spec labels (NOT ViewTabBar labels)
// Cycle sequence: List → Gallery → Kanban → Grid → SuperGrid → Map → Timeline → Charts → Graphs → (loop)
// Note: 'calendar' type uses label "Map", 'network' uses "Charts", 'tree' uses "Graphs" per UAT spec.
// ---------------------------------------------------------------------------

const VIEW_TABS: { type: ViewType; label: string }[] = [
	{ type: 'list', label: 'List' },
	{ type: 'gallery', label: 'Gallery' },
	{ type: 'kanban', label: 'Kanban' },
	{ type: 'grid', label: 'Grid' },
	{ type: 'supergrid', label: 'SuperGrid' },
	{ type: 'calendar', label: 'Map' },
	{ type: 'timeline', label: 'Timeline' },
	{ type: 'network', label: 'Charts' },
	{ type: 'tree', label: 'Graphs' },
];

// ---------------------------------------------------------------------------
// ViewZipper
// ---------------------------------------------------------------------------

/**
 * ViewZipper renders a horizontal tab strip inside the Visualization Explorer
 * panel with 9 view tabs, Play/Stop auto-cycle, and full keyboard accessibility.
 *
 * Public API: constructor, setActive, startCycle, stopCycle, destroy,
 *             getActiveType, isCycling
 */
export class ViewZipper {
	private _el: HTMLElement;
	private _buttons: Map<ViewType, HTMLButtonElement>;
	private _playStopBtn: HTMLButtonElement;
	private _activeType: ViewType;
	private _cycling: boolean;
	private _cycleTimer: ReturnType<typeof setInterval> | null;
	private readonly _config: ViewZipperConfig;

	// Bound keydown handler stored for cleanup
	private _keydownHandler: (e: KeyboardEvent) => void;

	constructor(config: ViewZipperConfig) {
		this._config = config;
		this._activeType = 'list';
		this._cycling = false;
		this._cycleTimer = null;
		this._buttons = new Map<ViewType, HTMLButtonElement>();

		// --- Build nav element ---
		this._el = document.createElement('nav');
		this._el.className = 'vzip-strip';
		this._el.setAttribute('role', 'tablist');
		this._el.setAttribute('aria-label', 'View type');

		// --- Build 9 tab buttons ---
		for (const tab of VIEW_TABS) {
			const btn = document.createElement('button');
			btn.className = 'vzip-tab';
			btn.setAttribute('role', 'tab');
			btn.setAttribute('aria-selected', 'false');
			// Roving tabindex: first tab starts focusable, rest skip
			btn.setAttribute('tabindex', tab === VIEW_TABS[0] ? '0' : '-1');
			btn.textContent = tab.label;

			// Click: stop cycling first if active, then switch
			btn.addEventListener('click', () => {
				if (this._cycling) {
					this.stopCycle();
				}
				this._activateTab(tab.type);
				config.onSwitch(tab.type);
			});

			this._buttons.set(tab.type, btn);
			this._el.appendChild(btn);
		}

		// --- Build Play/Stop button ---
		this._playStopBtn = document.createElement('button');
		this._playStopBtn.className = 'vzip-play-btn';
		this._playStopBtn.textContent = '\u25B6 Play';
		this._playStopBtn.setAttribute('aria-label', 'Play auto-cycle');
		this._playStopBtn.setAttribute('aria-pressed', 'false');
		this._playStopBtn.setAttribute('type', 'button');
		this._playStopBtn.addEventListener('click', () => {
			if (this._cycling) {
				this.stopCycle();
			} else {
				this.startCycle();
			}
		});
		this._el.appendChild(this._playStopBtn);

		// --- Keyboard navigation on nav element (roving tabindex) ---
		this._keydownHandler = (e: KeyboardEvent) => {
			const types = VIEW_TABS.map((v) => v.type);
			const currentIndex = types.indexOf(this._activeType);
			let nextIndex: number | null = null;

			if (e.key === 'ArrowRight') {
				nextIndex = (currentIndex + 1) % types.length;
			} else if (e.key === 'ArrowLeft') {
				nextIndex = (currentIndex - 1 + types.length) % types.length;
			} else if (e.key === 'Home') {
				nextIndex = 0;
			} else if (e.key === 'End') {
				nextIndex = types.length - 1;
			}

			if (nextIndex !== null) {
				e.preventDefault();
				const nextType = types[nextIndex]!;
				this._activateTab(nextType);
				config.onSwitch(nextType);
				this._buttons.get(nextType)?.focus();
			}
		};
		this._el.addEventListener('keydown', this._keydownHandler);

		// --- Activate first tab initially ---
		this._activateTab('list');

		// --- Mount into container ---
		config.container.appendChild(this._el);
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	/**
	 * Programmatically set the active tab (e.g. after Cmd+1..9 shortcut).
	 * Updates visual state and announces the view switch to screen readers.
	 */
	setActive(viewType: ViewType): void {
		this._activateTab(viewType);
	}

	/**
	 * Start auto-cycling through views at 2000ms per step.
	 * Announces cycle start to screen readers.
	 */
	startCycle(): void {
		if (this._cycling) return;
		this._cycling = true;

		// Swap to Stop button appearance
		this._playStopBtn.className = 'vzip-stop-btn';
		this._playStopBtn.textContent = '\u25A0 Stop';
		this._playStopBtn.setAttribute('aria-label', 'Stop auto-cycle');
		this._playStopBtn.setAttribute('aria-pressed', 'true');

		this._config.announcer.announce('Auto-cycle started');

		// Advance view every 2000ms
		this._cycleTimer = setInterval(() => {
			const types = VIEW_TABS.map((v) => v.type);
			const currentIndex = types.indexOf(this._activeType);
			const nextIndex = (currentIndex + 1) % types.length;
			const nextType = types[nextIndex]!;
			this._activateTab(nextType);
			this._config.onSwitch(nextType);
		}, 2000);
	}

	/**
	 * Stop auto-cycling. Announces cycle stop with current view label.
	 */
	stopCycle(): void {
		if (!this._cycling) return;

		if (this._cycleTimer !== null) {
			clearInterval(this._cycleTimer);
			this._cycleTimer = null;
		}
		this._cycling = false;

		// Swap back to Play button appearance
		this._playStopBtn.className = 'vzip-play-btn';
		this._playStopBtn.textContent = '\u25B6 Play';
		this._playStopBtn.setAttribute('aria-label', 'Play auto-cycle');
		this._playStopBtn.setAttribute('aria-pressed', 'false');

		const label = this._getLabelForType(this._activeType);
		this._config.announcer.announce(`Auto-cycle stopped on ${label} view`);
	}

	/**
	 * Remove the ViewZipper nav from the DOM and clean up.
	 */
	destroy(): void {
		if (this._cycling) {
			this.stopCycle();
		}
		this._el.removeEventListener('keydown', this._keydownHandler);
		this._el.remove();
	}

	/** Returns the currently active view type. */
	getActiveType(): ViewType {
		return this._activeType;
	}

	/** Returns true if auto-cycling is currently active. */
	isCycling(): boolean {
		return this._cycling;
	}

	/** Returns the root nav element for DOM repositioning. */
	getElement(): HTMLElement {
		return this._el;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Deactivate the previous tab and activate the given view type.
	 * Updates ARIA attributes, roving tabindex, and announces to screen readers.
	 */
	private _activateTab(viewType: ViewType): void {
		// Deactivate previous tab
		const prevBtn = this._buttons.get(this._activeType);
		if (prevBtn) {
			prevBtn.classList.remove('vzip-tab--active');
			prevBtn.setAttribute('aria-selected', 'false');
			prevBtn.setAttribute('tabindex', '-1');
		}

		// Activate new tab
		const nextBtn = this._buttons.get(viewType);
		if (nextBtn) {
			nextBtn.classList.add('vzip-tab--active');
			nextBtn.setAttribute('aria-selected', 'true');
			nextBtn.setAttribute('tabindex', '0');
		}

		this._activeType = viewType;

		// Announce view switch
		const label = this._getLabelForType(viewType);
		this._config.announcer.announce(`Switched to ${label} view`);
	}

	/** Look up the UAT display label for a given ViewType. */
	private _getLabelForType(viewType: ViewType): string {
		return VIEW_TABS.find((t) => t.type === viewType)?.label ?? viewType;
	}
}
