// Isometry v5 — Phase 98 HarnessShell
// Main layout for the SuperGrid feature harness.
//
// Design:
//   - Left sidebar: FeaturePanel toggle tree + data source selector
//   - Main area: PivotTable grid (renders with active plugins)
//   - Persists toggle state to localStorage on every change
//   - Restores toggle state on mount
//
// Requirements: HAR-05, HAR-07, HAR-08, HAR-09

import { PivotTable } from '../PivotTable';
import { registerCatalog } from '../plugins/FeatureCatalog';
import { PluginRegistry } from '../plugins/PluginRegistry';
import { FeaturePanel } from './FeaturePanel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'isometry:harness:toggles';

// ---------------------------------------------------------------------------
// HarnessShell
// ---------------------------------------------------------------------------

export class HarnessShell {
	private _rootEl: HTMLDivElement | null = null;
	private _registry: PluginRegistry;
	private _featurePanel: FeaturePanel;
	private _pivotTable: PivotTable;
	private _unsubscribe: (() => void) | null = null;
	private _gridContainer: HTMLDivElement | null = null;

	constructor() {
		this._registry = new PluginRegistry();
		registerCatalog(this._registry);

		this._featurePanel = new FeaturePanel(this._registry);
		this._pivotTable = new PivotTable({ registry: this._registry });
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'hns-root';

		// ---- Sidebar ----
		const sidebar = document.createElement('aside');
		sidebar.className = 'hns-sidebar';

		// Title
		const title = document.createElement('div');
		title.className = 'hns-title';
		title.innerHTML = '<h1>SuperGrid Harness</h1>';
		sidebar.appendChild(title);

		// Data source selector
		const dataSection = document.createElement('div');
		dataSection.className = 'hns-data-section';

		const dataLabel = document.createElement('label');
		dataLabel.className = 'hns-data-label';
		dataLabel.textContent = 'Data Source';
		dataSection.appendChild(dataLabel);

		const dataSelect = document.createElement('select');
		dataSelect.className = 'hns-data-select';
		for (const opt of ['mock', 'alto-json', 'sqlite']) {
			const option = document.createElement('option');
			option.value = opt;
			option.textContent = opt === 'mock' ? 'Mock Data' : opt === 'alto-json' ? 'Alto Index (JSON)' : 'SQLite (sql.js)';
			if (opt !== 'mock') option.disabled = true; // only mock available initially
			dataSelect.appendChild(option);
		}
		dataSection.appendChild(dataSelect);
		sidebar.appendChild(dataSection);

		// Separator
		const sep = document.createElement('hr');
		sep.className = 'hns-separator';
		sidebar.appendChild(sep);

		// Feature panel
		this._featurePanel.mount(sidebar);
		this._rootEl.appendChild(sidebar);

		// ---- Main area ----
		const main = document.createElement('main');
		main.className = 'hns-main';

		this._gridContainer = document.createElement('div');
		this._gridContainer.className = 'hns-grid-container';
		this._pivotTable.mount(this._gridContainer);
		main.appendChild(this._gridContainer);

		this._rootEl.appendChild(main);
		container.appendChild(this._rootEl);

		// Restore persisted state
		this._restoreState();

		// Persist and re-render on every toggle change
		this._unsubscribe = this._registry.onChange(() => {
			this._persistState();
			this._pivotTable.rerender();
		});

		// Expose programmatic API for E2E tests (window.__harness)
		(window as any).__harness = {
			enable: (id: string) => {
				this._registry.enable(id);
			},
			disable: (id: string) => {
				this._registry.disable(id);
			},
			isEnabled: (id: string) => {
				return this._registry.isEnabled(id);
			},
			getAll: () => {
				return this._registry.getAll();
			},
			getEnabled: () => {
				return this._registry.getEnabled();
			},
			// TCC permission simulation for Phase 113 ETL adapter tests.
			// Stores per-adapter permission state on window for the bridge to read
			// before attempting native adapter reads.
			// State: 'granted' | 'denied' | 'revoked'
			// Convention: window.__mock_permission_{adapter}
			mockPermission: (adapter: string, state: 'granted' | 'denied' | 'revoked') => {
				const key = `__mock_permission_${adapter}`;
				if (state === 'revoked') {
					delete (window as any)[key];
				} else {
					(window as any)[key] = state;
				}
			},
			getPermissionState: (adapter: string): string | null => {
				const key = `__mock_permission_${adapter}`;
				return (window as any)[key] ?? null;
			},
		};
		(window as any).__harnessReady = true;
	}

	destroy(): void {
		this._unsubscribe?.();
		this._featurePanel.destroy();
		this._pivotTable.destroy();
		this._registry.destroyAll();
		this._rootEl?.remove();
		this._rootEl = null;
		this._gridContainer = null;
		// Clean up mock permission state keys set via __harness.mockPermission()
		for (const key of Object.keys(window as any)) {
			if (key.startsWith('__mock_permission_')) {
				delete (window as any)[key];
			}
		}
		delete (window as any).__harness;
		delete (window as any).__harnessReady;
	}

	// -----------------------------------------------------------------------
	// State persistence
	// -----------------------------------------------------------------------

	private _persistState(): void {
		try {
			const state = this._registry.saveState();
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// localStorage may be unavailable in some contexts
		}
	}

	private _restoreState(): void {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const state = JSON.parse(raw);
				if (state && Array.isArray(state.enabled)) {
					this._registry.restoreState(state);
				}
			}
		} catch {
			// Ignore parse errors
		}
	}
}
