// Isometry v5 — Phase 5 ViewManager
// View lifecycle management: mount/destroy, loading/error/empty states, subscriber leak prevention.
//
// Design:
//   - switchTo() calls destroy() on current view before mounting next (VIEW-10)
//   - switchTo() calls pafv.setViewType() to apply VIEW_DEFAULTS (VIEW-11)
//   - Loading spinner appears only after 200ms delay to avoid flash for fast queries
//   - Error banner with retry button on query failure
//   - Empty state when query returns zero results
//   - Coordinator unsubscribe called on every switchTo() and destroy() — no leaks
//
// Requirements: VIEW-09, VIEW-10, VIEW-11, REND-07, REND-08

import type { IView, CardDatum, WorkerBridgeLike, PAFVProviderLike } from './types';
import { toCardDatum } from './types';
import type { StateCoordinator } from '../providers/StateCoordinator';
import type { QueryBuilder } from '../providers/QueryBuilder';
import type { ViewType } from '../providers/types';

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

  private currentView: IView | null = null;
  private coordinatorUnsub: (() => void) | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingEl: HTMLElement | null = null;

  constructor(config: ViewManagerConfig) {
    this.container = config.container;
    this.coordinator = config.coordinator;
    this.queryBuilder = config.queryBuilder;
    this.bridge = config.bridge;
    this.pafv = config.pafv;
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
    // 1. Tear down current view (prevents subscriber leaks)
    this._teardownCurrentView();

    // 2. Clear container
    this.container.innerHTML = '';
    this.loadingEl = null;

    // 3. Apply VIEW_DEFAULTS for the new view type (VIEW-11)
    this.pafv.setViewType(viewType);

    // 4. Mount new view
    const view = createView(viewType);
    view.mount(this.container);
    this.currentView = view;

    // 5. Subscribe to coordinator for re-render notifications
    this.coordinatorUnsub = this.coordinator.subscribe(() => {
      void this._fetchAndRender();
    });

    // 6. Initial data fetch
    await this._fetchAndRender();
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
    this.container.innerHTML = '';
    this.loadingEl = null;
  }

  // ---------------------------------------------------------------------------
  // Private: data fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch card data from the Worker and render it into the current view.
   * Manages loading/error/empty states around the async operation.
   */
  private async _fetchAndRender(): Promise<void> {
    // Remove any previous error/empty state
    this._clearErrorAndEmpty();

    // Schedule loading spinner after 200ms (avoid flash for fast queries)
    let spinnerShown = false;
    this.loadingTimer = setTimeout(() => {
      this.loadingTimer = null;
      spinnerShown = true;
      this._showLoading();
    }, 200);

    try {
      const compiled = this.queryBuilder.buildCardQuery({ limit: 500 });
      const result = await this.bridge.send('db:exec', {
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

      if (cards.length === 0) {
        this._showEmpty();
      } else {
        this.currentView?.render(cards);
      }
    } catch (err) {
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
    const banner = document.createElement('div');
    banner.className = 'view-error-banner';

    const msgEl = document.createElement('span');
    msgEl.className = 'error-message';
    msgEl.textContent = message;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', onRetry);

    banner.appendChild(msgEl);
    banner.appendChild(retryBtn);

    this.container.appendChild(banner);
  }

  // ---------------------------------------------------------------------------
  // Private: empty state
  // ---------------------------------------------------------------------------

  private _showEmpty(): void {
    const empty = document.createElement('div');
    empty.className = 'view-empty';
    empty.textContent = 'No cards match current filters';
    this.container.appendChild(empty);
  }

  // ---------------------------------------------------------------------------
  // Private: clear transient states
  // ---------------------------------------------------------------------------

  private _clearErrorAndEmpty(): void {
    const toRemove = this.container.querySelectorAll(
      '.view-error-banner, .view-empty'
    );
    toRemove.forEach(el => el.remove());
  }
}

// ---------------------------------------------------------------------------
// Private: row extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract row array from Worker bridge response.
 * Worker returns `{ rows: Record<string, unknown>[] }` from db:exec calls.
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
