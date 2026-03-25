// Isometry v5 -- Phase 122 ProductionSuperGrid
// IView wrapper around PivotTable + BridgeDataAdapter for ViewManager integration.
//
// Design:
//   - Implements IView (mount/render/destroy) so ViewManager can manage lifecycle
//   - Creates PluginRegistry with all 27 plugins via registerCatalog()
//   - Creates BridgeDataAdapter wrapping all production providers
//   - PivotTable drives the render cycle; render(cards) is a no-op (self-managing)
//   - Exposes setCalcExplorer/setSchemaProvider/setDepthGetter for main.ts wiring
//
// Requirements: CONV-02

import type { CardDatum, IView, SuperGridBridgeLike, SuperGridDensityLike, SuperGridFilterLike, SuperGridProviderLike } from '../types';
import { BridgeDataAdapter } from './BridgeDataAdapter';
import { PivotTable } from './PivotTable';
import { PluginRegistry } from './plugins/PluginRegistry';
import { registerCatalog } from './plugins/FeatureCatalog';

export interface ProductionSuperGridConfig {
	provider: SuperGridProviderLike;
	filter: SuperGridFilterLike;
	bridge: SuperGridBridgeLike;
	coordinator: { subscribe(cb: () => void): () => void };
	positionProvider?: unknown;
	selectionAdapter?: unknown;
	densityProvider?: SuperGridDensityLike;
}

export class ProductionSuperGrid implements IView {
	private _pivotTable: PivotTable;
	private _adapter: BridgeDataAdapter;
	private _registry: PluginRegistry;

	constructor(config: ProductionSuperGridConfig) {
		this._registry = new PluginRegistry();
		registerCatalog(this._registry);

		this._adapter = new BridgeDataAdapter({
			bridge: config.bridge,
			provider: config.provider,
			filter: config.filter,
			density: config.densityProvider ?? _makeFallbackDensity(),
			coordinator: config.coordinator,
		});

		this._pivotTable = new PivotTable({
			registry: this._registry,
			adapter: this._adapter,
		});
	}

	// -- IView lifecycle --

	mount(container: HTMLElement): void {
		this._pivotTable.mount(container);
	}

	render(_cards: CardDatum[]): void {
		// No-op: PivotTable self-manages data via BridgeDataAdapter.
		// subscribe() wired in PivotTable.mount() triggers re-render on coordinator events.
	}

	destroy(): void {
		this._pivotTable.destroy();
	}

	// -- Post-construction wiring (same API as monolithic SuperGrid) --

	setCalcExplorer(explorer: { getConfig(): unknown }): void {
		this._adapter.setCalcExplorer(explorer);
	}

	setSchemaProvider(sp: unknown | null): void {
		this._adapter.setSchemaProvider(sp);
	}

	setDepthGetter(getter: () => number): void {
		this._adapter.setDepthGetter(getter);
	}
}

// ---------------------------------------------------------------------------
// Fallback density for optional densityProvider
// ---------------------------------------------------------------------------

import type { SuperDensityState } from '../../providers/types';

function _makeFallbackDensity(): SuperGridDensityLike {
	const state: SuperDensityState = {
		axisGranularity: null,
		hideEmpty: false,
		viewMode: 'matrix',
		regionConfig: null,
		displayField: 'name',
	};
	return {
		getState: () => state,
		setGranularity: () => {},
		setHideEmpty: () => {},
		setViewMode: () => {},
		subscribe: (_cb: () => void) => () => {},
	};
}
