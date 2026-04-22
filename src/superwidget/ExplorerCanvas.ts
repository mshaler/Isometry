import type { CanvasComponent, Projection } from './projection';
import { switchTab } from './projection';
import { DataExplorerPanel } from '../ui/DataExplorerPanel';
import type { DataExplorerPanelConfig } from '../ui/DataExplorerPanel';
import { formatRelativeTime } from './statusSlot';

// Tab definitions (D-01, D-02) — 3 tabs; Apps is merged into import-export
const TAB_DEFS = [
  { id: 'import-export', label: 'Import / Export' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'db-utilities', label: 'DB Utilities' },
] as const;

export class ExplorerCanvas implements CanvasComponent {
  private _config: DataExplorerPanelConfig;
  private _commitProjection: (proj: Projection) => void;
  private _bridge: { send(type: string, payload: unknown): Promise<unknown> } | undefined;
  private _panel: DataExplorerPanel | null = null;
  private _wrapperEl: HTMLElement | null = null;
  private _tabBarEl: HTMLElement | null = null;
  private _containers: Map<string, HTMLElement> = new Map();
  private _currentProj: Projection | null = null;
  private _statusEl: HTMLElement | null = null;

  constructor(
    config: DataExplorerPanelConfig,
    commitProjection: (proj: Projection) => void,
    bridge?: { send(type: string, payload: unknown): Promise<unknown> },
  ) {
    this._config = config;
    this._commitProjection = commitProjection;
    this._bridge = bridge;
  }

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'explorer-canvas';
    this._wrapperEl = wrapper;

    // Tab bar with event delegation
    const tabBar = document.createElement('div');
    tabBar.dataset['slot'] = 'tab-bar';
    this._tabBarEl = tabBar;

    for (let i = 0; i < TAB_DEFS.length; i++) {
      const { id, label } = TAB_DEFS[i]!;
      const btn = document.createElement('button');
      btn.dataset['tabId'] = id;
      btn.textContent = label;
      if (i === 0) btn.dataset['tabActive'] = 'true';
      tabBar.appendChild(btn);
    }

    tabBar.addEventListener('click', (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-tab-id]') as HTMLElement | null;
      if (!target || !this._currentProj) return;
      const tabId = target.dataset['tabId']!;
      const newProj = switchTab(this._currentProj, tabId);
      if (newProj === this._currentProj) return;
      this._commitProjection(newProj);
    });

    // Mount DataExplorerPanel into a detached temp container to extract sections
    const tempContainer = document.createElement('div');
    const panel = new DataExplorerPanel(this._config);
    panel.mount(tempContainer);
    this._panel = panel;

    // The panel root is the first child (.data-explorer); its children are the 4 sections
    const panelRoot = tempContainer.firstElementChild as HTMLElement;
    const children = Array.from(panelRoot.children) as HTMLElement[];
    // children[0] = Import/Export section, [1] = Catalog, [2] = Apps, [3] = DB Utilities

    // Build 3 tab containers — Apps (index 2) stacked inside import-export (D-01, D-02)
    const importExportContainer = document.createElement('div');
    importExportContainer.dataset['tabContainer'] = 'import-export';
    importExportContainer.classList.add('active');
    if (children[0]) importExportContainer.appendChild(children[0]);
    if (children[2]) importExportContainer.appendChild(children[2]);

    const catalogContainer = document.createElement('div');
    catalogContainer.dataset['tabContainer'] = 'catalog';
    if (children[1]) catalogContainer.appendChild(children[1]);

    const dbUtilitiesContainer = document.createElement('div');
    dbUtilitiesContainer.dataset['tabContainer'] = 'db-utilities';
    if (children[3]) dbUtilitiesContainer.appendChild(children[3]);

    this._containers.set('import-export', importExportContainer);
    this._containers.set('catalog', catalogContainer);
    this._containers.set('db-utilities', dbUtilitiesContainer);

    wrapper.appendChild(tabBar);
    wrapper.appendChild(importExportContainer);
    wrapper.appendChild(catalogContainer);
    wrapper.appendChild(dbUtilitiesContainer);

    container.appendChild(wrapper);

    // DOM traversal: status slot is sibling of canvas slot inside SuperWidget root (STAT-03)
    const statusEl = container.parentElement?.querySelector<HTMLElement>('[data-slot="status"]');
    if (statusEl) {
      this._statusEl = statusEl;
      this._updateStatus();
    }
  }

  onProjectionChange(proj: Projection): void {
    this._currentProj = proj;

    // Toggle active container
    for (const [id, el] of this._containers) {
      if (id === proj.activeTabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }

    // Update tab bar active state
    if (!this._tabBarEl) return;
    const buttons = this._tabBarEl.querySelectorAll<HTMLElement>('[data-tab-id]');
    for (const btn of buttons) {
      if (btn.dataset['tabId'] === proj.activeTabId) {
        btn.dataset['tabActive'] = 'true';
      } else {
        delete btn.dataset['tabActive'];
      }
    }
  }

  destroy(): void {
    this._panel?.destroy();
    this._panel = null;
    this._wrapperEl?.remove();
    this._wrapperEl = null;
    this._tabBarEl = null;
    this._containers.clear();
    this._currentProj = null;
    this._statusEl = null;
  }

  getPanel(): DataExplorerPanel | null {
    return this._panel;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _updateStatus(): void {
    if (!this._statusEl) return;

    // Idempotent DOM setup
    if (!this._statusEl.querySelector('.sw-explorer-status-bar')) {
      const bar = document.createElement('div');
      bar.className = 'sw-explorer-status-bar';

      const datasetSpan = document.createElement('span');
      datasetSpan.className = 'sw-status-bar__item';
      datasetSpan.dataset['stat'] = 'dataset-name';

      const sep = document.createElement('span');
      sep.className = 'sw-status-bar__sep';
      sep.textContent = '\u00B7';

      const importSpan = document.createElement('span');
      importSpan.className = 'sw-status-bar__item';
      importSpan.dataset['stat'] = 'last-import';

      bar.appendChild(datasetSpan);
      bar.appendChild(sep);
      bar.appendChild(importSpan);
      this._statusEl.appendChild(bar);
    }

    // If no bridge available, show static label
    if (!this._bridge) {
      const datasetSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="dataset-name"]');
      if (datasetSpan) datasetSpan.textContent = 'Data Explorer';
      return;
    }

    // Query dataset stats via bridge (STAT-03)
    void this._bridge.send('datasets:stats', {}).then((stats: unknown) => {
      if (!this._statusEl) return;
      const s = stats as { dataset_count?: number; dataset_name?: string; last_import_at?: string | null };

      const datasetSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="dataset-name"]');
      if (datasetSpan) {
        if (s.dataset_name) {
          datasetSpan.textContent = s.dataset_name;
        } else if (s.dataset_count !== undefined) {
          datasetSpan.textContent = s.dataset_count === 1 ? '1 dataset' : `${s.dataset_count} datasets`;
        } else {
          datasetSpan.textContent = 'No datasets';
        }
      }

      const importSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="last-import"]');
      if (importSpan) {
        if (s.last_import_at) {
          importSpan.textContent = `Last import: ${formatRelativeTime(s.last_import_at)}`;
        } else {
          importSpan.textContent = 'No imports yet';
        }
      }
    });
  }
}
