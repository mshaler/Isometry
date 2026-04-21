import type { CanvasComponent, Projection } from './projection';
import { switchTab } from './projection';
import { DataExplorerPanel } from '../ui/DataExplorerPanel';
import type { DataExplorerPanelConfig } from '../ui/DataExplorerPanel';

// Tab definitions (D-01, D-02) — 3 tabs; Apps is merged into import-export
const TAB_DEFS = [
  { id: 'import-export', label: 'Import / Export' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'db-utilities', label: 'DB Utilities' },
] as const;

export class ExplorerCanvas implements CanvasComponent {
  private _config: DataExplorerPanelConfig;
  private _commitProjection: (proj: Projection) => void;
  private _panel: DataExplorerPanel | null = null;
  private _wrapperEl: HTMLElement | null = null;
  private _tabBarEl: HTMLElement | null = null;
  private _containers: Map<string, HTMLElement> = new Map();
  private _currentProj: Projection | null = null;

  constructor(config: DataExplorerPanelConfig, commitProjection: (proj: Projection) => void) {
    this._config = config;
    this._commitProjection = commitProjection;
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
  }

  getPanel(): DataExplorerPanel | null {
    return this._panel;
  }
}
