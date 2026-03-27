// Isometry v5 — Phase 5+43 ViewManager
// View lifecycle management: mount/destroy, loading/error/empty states, subscriber leak prevention.
// Phase 43: Contextual empty states — welcome panel, filtered-empty, view-specific messages.
//
// Design:
//   - switchTo() calls destroy() on current view before mounting next (VIEW-10)
//   - switchTo() calls pafv.setViewType() to apply VIEW_DEFAULTS (VIEW-11)
//   - Loading spinner appears only after 200ms delay to avoid flash for fast queries
//   - Error banner with retry button on query failure
//   - Contextual empty states: welcome (zero cards), filtered (filters hide all), view-specific messages
//   - Coordinator unsubscribe called on every switchTo() and destroy() — no leaks
//
// Requirements: VIEW-09, VIEW-10, VIEW-11, REND-07, REND-08, EMPTY-01, EMPTY-02, EMPTY-03

import type { Announcer } from '../accessibility/Announcer';
import { endTrace, startTrace } from '../profiling/PerfTrace';
import type { QueryBuilder } from '../providers/QueryBuilder';
import type { StateCoordinator } from '../providers/StateCoordinator';
import type { ViewType } from '../providers/types';
import { categorizeError, createErrorBanner } from '../ui/ErrorBanner';
import { crossfadeTransition, shouldUseMorph } from './transitions';
import type { CardDatum, IView, PAFVProviderLike, WorkerBridgeLike } from './types';
import { toCardDatum } from './types';

// ---------------------------------------------------------------------------
// FilterProviderLike — narrow interface for empty state Clear Filters action
// ---------------------------------------------------------------------------

/**
 * Minimal interface for FilterProvider as needed by ViewManager.
 * Only the resetToDefaults() method is needed for the "Clear Filters" CTA.
 * Concrete FilterProvider satisfies this interface.
 */
export interface FilterProviderLike {
	resetToDefaults(): void;
}

// ---------------------------------------------------------------------------
// View-specific empty state messages (EMPTY-03)
// ---------------------------------------------------------------------------

interface ViewEmptyMessage {
	icon: string;
	heading: string;
	description: string;
}

const VIEW_EMPTY_MESSAGES: Record<string, ViewEmptyMessage> = {
	list: { icon: '\u2630', heading: 'No cards to list', description: 'Import data to see your cards in list view' },
	grid: { icon: '\u25A6', heading: 'No cards to display', description: 'Import data to see cards arranged in a grid' },
	kanban: {
		icon: '\u2759\u2759\u2759',
		heading: 'No cards to organize',
		description: 'Import data to see cards sorted by status columns',
	},
	calendar: {
		icon: '\uD83D\uDCC5',
		heading: 'No dated cards',
		description: 'Cards need due dates to appear on the calendar',
	},
	timeline: {
		icon: '\u2500\u25CF\u2500',
		heading: 'No timeline events',
		description: 'Cards need dates to appear on the timeline',
	},
	gallery: {
		icon: '\uD83D\uDDBC',
		heading: 'No cards to browse',
		description: 'Import data to see cards in gallery view',
	},
	network: {
		icon: '\u25C9',
		heading: 'No cards to display',
		description: 'Import data or adjust your filters to see connections in the network.',
	},
	tree: {
		icon: '\uD83C\uDF33',
		heading: 'No hierarchy found',
		description: 'Import data with folder structure to see the tree',
	},
	supergrid: {
		icon: '\u25A6',
		heading: 'No data to project',
		description: 'Import data to see the SuperGrid projection',
	},
};

// ---------------------------------------------------------------------------
// ViewManager config
// ---------------------------------------------------------------------------

export interface ViewManagerConfig {
	/** Root container element — ViewManager owns the innerHTML */
	container: HTMLElement;
	/** StateCoordinator for batched provider change notifications */
	coordinator: StateCoordinator;
	/** QueryBuilder for composing card queries */
	queryBuilder: QueryBuilder;
	/** WorkerBridge for executing queries */
	bridge: WorkerBridgeLike;
	/** PAFVProvider for applying VIEW_DEFAULTS on each switchTo() */
	pafv: PAFVProviderLike;
	/** FilterProvider for Clear Filters action in empty state (EMPTY-02) */
	filter: FilterProviderLike;
	/** Optional Announcer for screen reader announcements (A11Y-05) */
	announcer?: Announcer;
	/** Phase 94: Optional getter for current dimension level from VisualExplorer */
	getDimension?: () => '1x' | '2x' | '5x';
}

// ---------------------------------------------------------------------------
// ViewManager
// ---------------------------------------------------------------------------

/**
 * Manages view lifecycle: mounting, destroying, re-rendering on data changes.
 *
 * Caller calls `switchTo(viewType, createView)` to change the active view.
 * The factory function `createView` is called with the view type and should
 * return a fresh IView instance.
 *
 * Lifecycle guarantee: `currentView.destroy()` is always called before
 * `newView.mount()` — preventing subscriber leaks across view switches.
 */
export class ViewManager {
	private readonly container: HTMLElement;
	private readonly coordinator: StateCoordinator;
	private readonly queryBuilder: QueryBuilder;
	private readonly bridge: WorkerBridgeLike;
	private readonly pafv: PAFVProviderLike;
	private readonly filter: FilterProviderLike;
	private readonly announcer: Announcer | null;
	/** Phase 94: Optional getter for current dimension from VisualExplorer */
	private readonly getDimension: (() => '1x' | '2x' | '5x') | null;

	private currentView: IView | null = null;
	private currentViewType: ViewType | null = null;
	private coordinatorUnsub: (() => void) | null = null;
	private loadingTimer: ReturnType<typeof setTimeout> | null = null;

	/** Optional callback invoked after each view switch completes. */
	onViewSwitch: ((viewType: ViewType) => void) | null = null;

	/**
	 * Returns the currently active IView instance, or null if no view is mounted.
	 * Used by Phase 117 AlgorithmExplorer callback to reach the active NetworkView.
	 */
	getCurrentView(): IView | null {
		return this.currentView;
	}

	/** Import file callback — called directly from welcome panel button click.
	 *  Must be called synchronously from the user gesture to preserve Safari user activation. */
	onImportFile: (() => void) | null = null;

	/** Import native callback — called directly from welcome panel button click (native shell only). */
	onImportNative: (() => void) | null = null;

	/** Load sample data callback — fires with dataset ID when user clicks sample CTA. */
	onLoadSample: ((datasetId: string) => void) | null = null;

	/** Available sample datasets for the welcome panel CTA. First item is the default. */
	sampleDatasets: Array<{ id: string; name: string }> = [];

	private loadingEl: HTMLElement | null = null;
	private lastCardCount = 0;
	private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(config: ViewManagerConfig) {
		this.container = config.container;
		this.coordinator = config.coordinator;
		this.queryBuilder = config.queryBuilder;
		this.bridge = config.bridge;
		this.pafv = config.pafv;
		this.filter = config.filter;
		this.announcer = config.announcer ?? null;
		this.getDimension = config.getDimension ?? null;

		// Allow programmatic focus on the container (A11Y-08)
		// tabindex="-1" means focusable via JS but not in Tab order
		// (the view's own container inside will have tabindex="0")
		if (!this.container.hasAttribute('tabindex')) {
			this.container.setAttribute('tabindex', '-1');
		}
	}

	// ---------------------------------------------------------------------------
	// switchTo
	// ---------------------------------------------------------------------------

	/**
	 * Switch to a new view type.
	 *
	 * Steps:
	 *   1. Destroy current view (unsubscribes coordinator)
	 *   2. Clear container
	 *   3. Apply VIEW_DEFAULTS via pafv.setViewType() (VIEW-11)
	 *   4. Mount new view
	 *   5. Subscribe to coordinator for re-render on provider changes
	 *   6. Initial data fetch
	 *
	 * @param viewType - The new view type to activate
	 * @param createView - Factory function that returns a fresh IView instance
	 */
	async switchTo(viewType: ViewType, createView: (type: ViewType) => IView): Promise<void> {
		// Capture outgoing view type for transition detection
		const previousViewType = this.currentViewType;
		const useMorph =
			previousViewType !== null && this.currentView !== null && shouldUseMorph(previousViewType, viewType);

		// Display name for announcer (capitalize first letter, e.g. 'list' → 'List')
		const viewDisplayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);

		if (useMorph) {
			// -----------------------------------------------------------------------
			// MORPH path: both views are SVG-based LATCH views (list↔grid)
			// -----------------------------------------------------------------------
			// The SVG container is preserved — d3 data join + transition animates cards
			// to new positions. We tear down lifecycle (coordinator unsub + view.destroy)
			// but keep the container DOM intact for the new view to inherit.

			// 1. Unsubscribe coordinator (prevents re-renders during transition)
			if (this.coordinatorUnsub !== null) {
				this.coordinatorUnsub();
				this.coordinatorUnsub = null;
			}
			// Cancel pending loading timer
			if (this.loadingTimer !== null) {
				clearTimeout(this.loadingTimer);
				this.loadingTimer = null;
			}
			// Destroy current view (lifecycle cleanup — not DOM)
			if (this.currentView !== null) {
				this.currentView.destroy();
				this.currentView = null;
			}
			// Do NOT clear container.innerHTML — SVG container preserved for morph

			// 3. Apply VIEW_DEFAULTS for the new view type (VIEW-11)
			this.pafv.setViewType(viewType);

			// 4. Mount new view (it will find and reuse the existing SVG or create a new one)
			const view = createView(viewType);
			view.mount(this.container);
			this.currentView = view;
			this.currentViewType = viewType;

			// Phase 94: Apply card dimension attribute for CSS (no re-query needed)
			const dim = this.getDimension?.() ?? '2x';
			this.container.dataset['dimension'] = dim;

			this.onViewSwitch?.(viewType);

			// 5. Subscribe to coordinator for re-render notifications
			this.coordinatorUnsub = this.coordinator.subscribe(() => {
				void this._fetchAndRender();
			});

			// 6. Initial data fetch (new view's render() calls morphTransition internally via D3 join)
			await this._fetchAndRender();

			// 7. Announce view switch to screen readers (A11Y-05)
			this.announcer?.announce(`Switched to ${viewDisplayName} view, ${this.lastCardCount} cards`);

			// 8. Move focus to container after switch (A11Y-08 — prevents focus loss)
			this._focusContainer();
		} else {
			// -----------------------------------------------------------------------
			// CROSSFADE path: SVG↔HTML boundary or LATCH↔GRAPH family switch
			// -----------------------------------------------------------------------

			// 1. Tear down current view (prevents subscriber leaks)
			this._teardownCurrentView();

			// 2. Clear container and perform crossfade if there's an existing view-root
			this.loadingEl = null;
			const hasExistingRoot = this.container.querySelector('.view-root') !== null;

			if (hasExistingRoot) {
				// Crossfade: fade out old, then mount new in a new .view-root
				await crossfadeTransition(
					this.container,
					() => {
						// This callback runs after old view-root fades out
						// The new .view-root has already been appended by crossfadeTransition
						// Apply VIEW_DEFAULTS and mount new view
					},
					0, // Use 0ms for non-browser environments; real browser uses CSS transitions
				);
				// Clear any remaining non-.view-root content (loading/error elements)
				this._clearErrorAndEmpty();
			} else {
				// No existing view-root — clean slate (first mount or after destroy)
				this.container.innerHTML = '';
			}

			// 3. Apply VIEW_DEFAULTS for the new view type (VIEW-11)
			this.pafv.setViewType(viewType);

			// 4. Mount new view
			const view = createView(viewType);
			view.mount(this.container);
			this.currentView = view;
			this.currentViewType = viewType;

			// Phase 94: Apply card dimension attribute for CSS (no re-query needed)
			const dimLevel = this.getDimension?.() ?? '2x';
			this.container.dataset['dimension'] = dimLevel;

			this.onViewSwitch?.(viewType);

			// 5. Subscribe to coordinator for re-render notifications
			this.coordinatorUnsub = this.coordinator.subscribe(() => {
				void this._fetchAndRender();
			});

			// 6. Initial data fetch
			await this._fetchAndRender();

			// 7. Announce view switch to screen readers (A11Y-05)
			this.announcer?.announce(`Switched to ${viewDisplayName} view, ${this.lastCardCount} cards`);

			// 8. Move focus to container after switch (A11Y-08 — prevents focus loss)
			this._focusContainer();
		}
	}

	// ---------------------------------------------------------------------------
	// Public: loading state
	// ---------------------------------------------------------------------------

	/**
	 * Immediately show the loading spinner (no delay).
	 * Used by the dataset eviction pipeline to prevent flash of stale data
	 * during the async evictAll() + load() sequence.
	 *
	 * Unlike the internal _showLoading() which is triggered by a 200ms timer
	 * inside _fetchAndRender(), this method shows the spinner immediately.
	 */
	showLoading(): void {
		this._showLoading();
	}

	// ---------------------------------------------------------------------------
	// Public: Phase 94 — Dimension attribute
	// ---------------------------------------------------------------------------

	/**
	 * Apply a card dimension level to the view container via data-dimension attribute.
	 * CSS rules `[data-dimension="1x"] .card { ... }` switch all cards at once.
	 * No re-query or D3 data join rebuild — purely CSS.
	 *
	 * @param level - Dimension level: '1x' | '2x' | '5x'
	 */
	setDimension(level: '1x' | '2x' | '5x'): void {
		this.container.dataset['dimension'] = level;
	}

	// ---------------------------------------------------------------------------
	// destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the ViewManager — destroys current view, unsubscribes coordinator,
	 * cancels any pending loading timers.
	 *
	 * Call this when the ViewManager is no longer needed.
	 */
	destroy(): void {
		this._teardownCurrentView();
		this._removeOutsideClickHandler();
		this.container.innerHTML = '';
		this.loadingEl = null;
		this.currentViewType = null;
	}

	// ---------------------------------------------------------------------------
	// Private: data fetching
	// ---------------------------------------------------------------------------

	/**
	 * Fetch card data from the Worker and render it into the current view.
	 * Manages loading/error/empty states around the async operation.
	 */
	private async _fetchAndRender(): Promise<void> {
		startTrace('sg:fetchAndRender');

		// Remove any previous error/empty state
		this._clearErrorAndEmpty();

		// Cancel any in-flight loading timer from a concurrent call.
		// Without this, concurrent _fetchAndRender() calls (e.g., initial fetch + coordinator
		// subscription firing from setViewType) can orphan a timer whose handle gets overwritten,
		// causing a spinner to show after all queries complete with no code path to hide it.
		if (this.loadingTimer !== null) {
			clearTimeout(this.loadingTimer);
			this.loadingTimer = null;
		}
		this._hideLoading();

		// Schedule loading spinner after 200ms (avoid flash for fast queries)
		let spinnerShown = false;
		this.loadingTimer = setTimeout(() => {
			this.loadingTimer = null;
			spinnerShown = true;
			this._showLoading();
		}, 200);

		try {
			const compiled = this.queryBuilder.buildCardQuery({ limit: 500 });
			const result = await this.bridge.send('db:query', {
				sql: compiled.sql,
				params: compiled.params,
			});

			// Cancel spinner if data arrived before 200ms
			if (this.loadingTimer !== null) {
				clearTimeout(this.loadingTimer);
				this.loadingTimer = null;
			}

			// Hide spinner if it was shown
			if (spinnerShown) {
				this._hideLoading();
			}

			// Parse rows from Worker response
			const rows = extractRows(result);
			const cards: CardDatum[] = rows.map(toCardDatum);

			// Track card count for announcer (A11Y-05)
			const previousCount = this.lastCardCount;
			this.lastCardCount = cards.length;

			if (cards.length === 0) {
				endTrace('sg:fetchAndRender');
				await this._showEmpty();
			} else {
				endTrace('sg:fetchAndRender');
				startTrace('sg:render');
				this.currentView?.render(cards);
				endTrace('sg:render');
			}

			// Announce card count change on filter updates (not on initial switchTo — that is handled separately)
			if (previousCount !== cards.length && previousCount > 0) {
				this.announcer?.announce(`${cards.length} cards`);
			}
		} catch (err) {
			endTrace('sg:fetchAndRender');
			// Cancel spinner
			if (this.loadingTimer !== null) {
				clearTimeout(this.loadingTimer);
				this.loadingTimer = null;
			}
			if (spinnerShown) {
				this._hideLoading();
			}

			const message = err instanceof Error ? err.message : String(err);
			this._showError(message, () => void this._fetchAndRender());
		}
	}

	// ---------------------------------------------------------------------------
	// Private: teardown
	// ---------------------------------------------------------------------------

	private _teardownCurrentView(): void {
		// Unsubscribe coordinator first
		if (this.coordinatorUnsub !== null) {
			this.coordinatorUnsub();
			this.coordinatorUnsub = null;
		}

		// Cancel pending loading timer
		if (this.loadingTimer !== null) {
			clearTimeout(this.loadingTimer);
			this.loadingTimer = null;
		}

		// Destroy current view
		if (this.currentView !== null) {
			this.currentView.destroy();
			this.currentView = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Private: loading state
	// ---------------------------------------------------------------------------

	private _showLoading(): void {
		// Only show if container is still managed by this ViewManager
		if (this.loadingEl) return;

		const loading = document.createElement('div');
		loading.className = 'view-loading is-visible';

		const spinner = document.createElement('div');
		spinner.className = 'spinner';

		const label = document.createElement('span');
		label.className = 'spinner-label';
		label.textContent = 'Loading...';

		loading.appendChild(spinner);
		loading.appendChild(label);

		this.container.prepend(loading);
		this.loadingEl = loading;
	}

	private _hideLoading(): void {
		if (this.loadingEl) {
			this.loadingEl.remove();
			this.loadingEl = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Private: error state
	// ---------------------------------------------------------------------------

	private _showError(message: string, onRetry: () => void): void {
		const categorized = categorizeError(message);
		const banner = createErrorBanner(categorized, onRetry);
		this.container.appendChild(banner);
	}

	// ---------------------------------------------------------------------------
	// Private: empty state (EMPTY-01, EMPTY-02, EMPTY-03)
	// ---------------------------------------------------------------------------

	/**
	 * Show a contextual empty state based on whether the DB is empty or filters are hiding cards.
	 *
	 * Three modes:
	 *   1. Welcome panel (EMPTY-01): DB has zero cards — show import CTAs
	 *   2. Filtered-empty (EMPTY-02): Filters hide all results — show Clear Filters + view-specific message
	 *   3. View-specific message (EMPTY-03): Always show the relevant icon/heading/description for the active view
	 */
	private async _showEmpty(): Promise<void> {
		// Query total unfiltered card count to distinguish welcome vs filtered-empty
		let totalCount = 0;
		try {
			const countResult = await this.bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			const countRows = extractRows(countResult);
			if (countRows.length > 0 && typeof countRows[0]!['count'] === 'number') {
				totalCount = countRows[0]!['count'] as number;
			}
		} catch {
			// If count query fails, fall back to filtered-empty (safest default)
			totalCount = 1;
		}

		if (totalCount === 0) {
			// EMPTY-01: Welcome panel — DB is completely empty
			this._showWelcome();
		} else {
			// EMPTY-02 + EMPTY-03: Filtered-empty with view-specific message
			this._showFilteredEmpty();
		}
	}

	/**
	 * Render the welcome panel for first-time users (EMPTY-01, SMPL-01, SMPL-04).
	 * Shows "Explore Isometry" heading with sample data hero CTA (split button).
	 * Import buttons shown below as secondary action.
	 * Import from Mac button shown only in native shell (app:// protocol).
	 */
	private _showWelcome(): void {
		// Clean up any previous outside-click listener
		this._removeOutsideClickHandler();

		const wrapper = document.createElement('div');
		wrapper.className = 'view-empty view-empty-welcome';

		const panel = document.createElement('div');
		panel.className = 'view-empty-panel';

		const heading = document.createElement('h2');
		heading.className = 'view-empty-heading';
		heading.textContent = 'Explore Isometry';

		const desc = document.createElement('p');
		desc.className = 'view-empty-description';
		desc.textContent = 'Try a sample dataset to see your data come alive, or import your own';

		panel.appendChild(heading);
		panel.appendChild(desc);

		// Sample data CTA — only when datasets are configured
		if (this.sampleDatasets.length > 0) {
			const defaultDs = this.sampleDatasets[0]!;
			const otherDatasets = this.sampleDatasets.slice(1);

			const cta = document.createElement('div');
			cta.className = 'sample-data-cta';

			// Main button — loads the default dataset immediately
			const mainBtn = document.createElement('button');
			mainBtn.className = 'sample-data-btn';
			mainBtn.textContent = `Try: ${defaultDs.name}`;
			mainBtn.addEventListener('click', () => {
				this.onLoadSample?.(defaultDs.id);
			});
			cta.appendChild(mainBtn);

			// Chevron button — toggles dropdown for alternative datasets
			if (otherDatasets.length > 0) {
				const chevronBtn = document.createElement('button');
				chevronBtn.className = 'sample-data-chevron';
				chevronBtn.textContent = '\u25BE';
				chevronBtn.setAttribute('aria-label', 'More sample datasets');

				const dropdown = document.createElement('div');
				dropdown.className = 'sample-data-dropdown';

				for (const ds of otherDatasets) {
					const option = document.createElement('button');
					option.className = 'sample-data-option';
					option.textContent = ds.name;
					option.dataset['datasetId'] = ds.id;
					option.addEventListener('click', () => {
						this.onLoadSample?.(ds.id);
						dropdown.classList.remove('open');
					});
					dropdown.appendChild(option);
				}

				chevronBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					dropdown.classList.toggle('open');
				});

				cta.appendChild(chevronBtn);
				cta.appendChild(dropdown);

				// Close dropdown on outside click
				this.outsideClickHandler = (e: MouseEvent) => {
					if (!cta.contains(e.target as Node)) {
						dropdown.classList.remove('open');
					}
				};
				document.addEventListener('click', this.outsideClickHandler);
			}

			panel.appendChild(cta);
		}

		// Separator
		const separator = document.createElement('p');
		separator.className = 'view-empty-separator';
		separator.textContent = 'Or import your own data';
		panel.appendChild(separator);

		// Import action buttons
		const actions = document.createElement('div');
		actions.className = 'view-empty-actions';

		const importFileBtn = document.createElement('button');
		importFileBtn.className = 'import-file-btn';
		importFileBtn.textContent = 'Import File';
		importFileBtn.addEventListener('click', () => {
			// Call handler directly (not via CustomEvent) to preserve Safari user activation
			// for the programmatic input.click() inside the handler.
			if (this.onImportFile) {
				this.onImportFile();
			} else {
				window.dispatchEvent(new CustomEvent('isometry:import-file'));
			}
		});
		actions.appendChild(importFileBtn);

		// Show native import button only when running in WKWebView (app:// protocol)
		if (window.location.protocol === 'app:') {
			const importNativeBtn = document.createElement('button');
			importNativeBtn.className = 'import-native-btn';
			importNativeBtn.textContent = 'Import from Mac';
			importNativeBtn.addEventListener('click', () => {
				if (this.onImportNative) {
					this.onImportNative();
				} else {
					window.dispatchEvent(new CustomEvent('isometry:import-native'));
				}
			});
			actions.appendChild(importNativeBtn);
		}

		panel.appendChild(actions);
		wrapper.appendChild(panel);
		this.container.appendChild(wrapper);
	}

	/**
	 * Remove outside-click listener for sample data dropdown.
	 * Called when welcome panel is replaced or ViewManager is destroyed.
	 */
	private _removeOutsideClickHandler(): void {
		if (this.outsideClickHandler) {
			document.removeEventListener('click', this.outsideClickHandler);
			this.outsideClickHandler = null;
		}
	}

	/**
	 * Render the filtered-empty panel with view-specific message (EMPTY-02 + EMPTY-03).
	 * Shows a view-specific icon/heading/description plus a "Clear Filters" button.
	 */
	private _showFilteredEmpty(): void {
		const viewType = this.currentViewType ?? 'list';
		const msg = VIEW_EMPTY_MESSAGES[viewType] ?? VIEW_EMPTY_MESSAGES['list']!;

		const wrapper = document.createElement('div');
		wrapper.className = 'view-empty view-empty-filtered';

		const panel = document.createElement('div');
		panel.className = 'view-empty-panel';

		const icon = document.createElement('span');
		icon.className = 'view-empty-icon';
		icon.textContent = msg.icon;

		const heading = document.createElement('h3');
		heading.className = 'view-empty-heading';
		heading.textContent = msg.heading;

		const desc = document.createElement('p');
		desc.className = 'view-empty-description';
		desc.textContent = msg.description;

		const clearBtn = document.createElement('button');
		clearBtn.className = 'clear-filters-btn';
		clearBtn.textContent = 'Clear Filters';
		clearBtn.addEventListener('click', () => {
			this.filter.resetToDefaults();
			this.coordinator.scheduleUpdate();
		});

		panel.appendChild(icon);
		panel.appendChild(heading);
		panel.appendChild(desc);
		panel.appendChild(clearBtn);
		wrapper.appendChild(panel);
		this.container.appendChild(wrapper);
	}

	// ---------------------------------------------------------------------------
	// Private: clear transient states
	// ---------------------------------------------------------------------------

	/**
	 * Move focus to the view container after a view switch.
	 * Prevents focus from being lost on body when views are swapped.
	 * Uses requestAnimationFrame to ensure DOM is settled before focusing.
	 */
	private _focusContainer(): void {
		requestAnimationFrame(() => {
			// Try to focus a child with tabindex="0" first (the view's own interactive container)
			const focusTarget = this.container.querySelector<HTMLElement>('[tabindex="0"]') ?? this.container;
			focusTarget.focus();
		});
	}

	private _clearErrorAndEmpty(): void {
		const toRemove = this.container.querySelectorAll('.view-error-banner, .view-empty');
		if (toRemove.length > 0) {
			this._removeOutsideClickHandler();
		}
		toRemove.forEach((el) => el.remove());
	}
}

// ---------------------------------------------------------------------------
// Private: row extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract row array from Worker bridge response.
 * Worker returns `{ columns: string[], rows: Record<string, unknown>[] }` from db:query calls.
 */
function extractRows(result: unknown): Record<string, unknown>[] {
	if (
		result !== null &&
		typeof result === 'object' &&
		'rows' in result &&
		Array.isArray((result as Record<string, unknown>)['rows'])
	) {
		return (result as { rows: Record<string, unknown>[] }).rows;
	}
	return [];
}
