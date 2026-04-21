// Isometry v13.2 — Phase 171 ViewCanvas
// Production CanvasComponent wrapping ViewManager with status slot and sidecar signaling.
// Requirements: VCNV-01, VCNV-02, VCNV-03, VCNV-04, VCNV-05

import type { Announcer } from '../accessibility/Announcer';
import type { QueryBuilder } from '../providers/QueryBuilder';
import type { StateCoordinator } from '../providers/StateCoordinator';
import type { ViewType } from '../providers/types';
import type { IView, PAFVProviderLike, WorkerBridgeLike } from '../views/types';
import type { FilterProviderLike, ViewManagerConfig } from '../views/ViewManager';
import { ViewManager } from '../views/ViewManager';
import type { CanvasComponent, Projection } from './projection';

// ---------------------------------------------------------------------------
// VIEW_DISPLAY_NAMES — human-readable names per ViewType (VCNV-03)
// ---------------------------------------------------------------------------

export const VIEW_DISPLAY_NAMES: Record<ViewType, string> = {
  list: 'List',
  grid: 'Grid',
  kanban: 'Kanban',
  calendar: 'Calendar',
  timeline: 'Timeline',
  gallery: 'Gallery',
  network: 'Network Graph',
  tree: 'Tree',
  supergrid: 'SuperGrid',
};

// ---------------------------------------------------------------------------
// VIEW_SIDECAR_MAP — per-view sidecar explorer IDs (VCNV-04)
// Only supergrid gets a sidecar; all other views have none.
// ---------------------------------------------------------------------------

const VIEW_SIDECAR_MAP: Partial<Record<ViewType, string>> = {
  supergrid: 'explorer-1',
};

// ---------------------------------------------------------------------------
// ViewCanvasConfig
// ---------------------------------------------------------------------------

export interface ViewCanvasConfig {
  canvasId: string;
  coordinator: StateCoordinator;
  queryBuilder: QueryBuilder;
  bridge: WorkerBridgeLike;
  pafv: PAFVProviderLike;
  filter: FilterProviderLike;
  viewFactory: Record<ViewType, () => IView>;
  onSidecarChange: (explorerId: string | null) => void;
  announcer?: Announcer;
  getDimension?: () => '1x' | '2x' | '5x';
}

// ---------------------------------------------------------------------------
// ViewCanvas
// ---------------------------------------------------------------------------

/**
 * Production CanvasComponent that wraps ViewManager.
 *
 * Isolation: ViewManager receives a wrapper div, never the raw canvas slot element
 * directly (wrapper-div isolation per D-10 — prevents container.innerHTML corruption).
 *
 * Per CANV-06: This file must NOT be imported by SuperWidget.ts.
 * Wired via registry.ts and main.ts only.
 */
export class ViewCanvas implements CanvasComponent {
  private _config: ViewCanvasConfig;
  private _viewManager: ViewManager | null = null;
  private _wrapperEl: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _currentViewType: ViewType | null = null;

  constructor(config: ViewCanvasConfig) {
    this._config = config;
  }

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'view-canvas';
    this._wrapperEl = wrapper;

    const vmConfig: ViewManagerConfig = {
      container: wrapper,
      coordinator: this._config.coordinator,
      queryBuilder: this._config.queryBuilder,
      bridge: this._config.bridge,
      pafv: this._config.pafv,
      filter: this._config.filter,
      announcer: this._config.announcer,
      getDimension: this._config.getDimension,
    };

    this._viewManager = new ViewManager(vmConfig);
    this._viewManager.onViewSwitch = (viewType: ViewType) => {
      this._currentViewType = viewType;
      this._updateStatus(viewType);
      this._notifySidecar(viewType);
    };

    container.appendChild(wrapper);

    // DOM traversal: status slot is sibling of canvas slot inside SuperWidget root
    const statusEl = container.parentElement?.querySelector<HTMLElement>('[data-slot="status"]');
    if (statusEl) this.setStatusEl(statusEl);
  }

  onProjectionChange(proj: Projection): void {
    if (!(proj.activeTabId in VIEW_DISPLAY_NAMES)) {
      console.error(`[ViewCanvas] Unknown tab ID: ${proj.activeTabId}`);
      return;
    }

    const viewType = proj.activeTabId as ViewType;
    if (viewType === this._currentViewType) return;

    const factory = this._config.viewFactory[viewType];
    if (!factory) {
      console.error(`[ViewCanvas] No factory for view: ${viewType}`);
      return;
    }

    void this._viewManager!.switchTo(viewType, factory);
  }

  setStatusEl(el: HTMLElement): void {
    this._statusEl = el;
    if (this._currentViewType !== null) {
      this._updateStatus(this._currentViewType);
    }
  }

  destroy(): void {
    if (this._viewManager) {
      this._viewManager.destroy();
      this._viewManager = null;
    }
    if (this._wrapperEl) {
      this._wrapperEl.remove();
      this._wrapperEl = null;
    }
    this._statusEl = null;
    this._currentViewType = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _updateStatus(viewType: ViewType): void {
    if (!this._statusEl) return;

    // Idempotent DOM setup
    if (!this._statusEl.querySelector('.sw-view-status-bar')) {
      const bar = document.createElement('div');
      bar.className = 'sw-view-status-bar';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'sw-status-bar__item';
      nameSpan.dataset['stat'] = 'view-name';

      const sep = document.createElement('span');
      sep.className = 'sw-status-bar__sep';
      sep.textContent = '\u00B7';

      const countSpan = document.createElement('span');
      countSpan.className = 'sw-status-bar__item';
      countSpan.dataset['stat'] = 'card-count';

      bar.appendChild(nameSpan);
      bar.appendChild(sep);
      bar.appendChild(countSpan);
      this._statusEl.appendChild(bar);
    }

    const nameSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="view-name"]');
    const countSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="card-count"]');

    if (nameSpan) nameSpan.textContent = VIEW_DISPLAY_NAMES[viewType];

    if (countSpan && this._viewManager) {
      const count = this._viewManager.getLastCards().length;
      countSpan.textContent = count === 1 ? '1 card' : `${count.toLocaleString('en-US')} cards`;
    }
  }

  private _notifySidecar(viewType: ViewType): void {
    const explorerId = VIEW_SIDECAR_MAP[viewType] ?? null;
    this._config.onSidecarChange(explorerId);
  }
}
