// Isometry v9.0 — Phase 116 Plan 02
// AlgorithmExplorer: sidebar panel for graph algorithm selection and execution.
//
// Requirements: CTRL-01, CTRL-02
//
// Design:
//   - Renders inside WorkbenchShell 6th CollapsibleSection ("Algorithm")
//   - Shows radio group for 6 algorithms + conditional parameter controls
//   - Run button dispatches graph:compute through WorkerBridge
//   - After successful compute, calls SchemaProvider.addGraphMetricColumns()
//   - FilterProvider-scoped computation: queries filtered card IDs before compute

import '../styles/algorithm-explorer.css';

import type { FilterProvider } from '../providers/FilterProvider';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { WorkerBridge } from '../worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlgorithmId = 'pagerank' | 'centrality' | 'community' | 'clustering' | 'spanning_tree' | 'shortest_path';

export interface AlgorithmExplorerConfig {
	bridge: WorkerBridge;
	schema: SchemaProvider;
	filter: FilterProvider;
	container: HTMLElement;
	coordinator: { scheduleUpdate(): void };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHMS: { id: AlgorithmId; label: string }[] = [
	{ id: 'shortest_path', label: 'Shortest Path' },
	{ id: 'centrality', label: 'Betweenness Centrality' },
	{ id: 'community', label: 'Community (Louvain)' },
	{ id: 'clustering', label: 'Clustering Coefficient' },
	{ id: 'spanning_tree', label: 'Minimum Spanning Tree' },
	{ id: 'pagerank', label: 'PageRank' },
];

// ---------------------------------------------------------------------------
// AlgorithmExplorer
// ---------------------------------------------------------------------------

export class AlgorithmExplorer {
	private readonly _bridge: WorkerBridge;
	private readonly _schema: SchemaProvider;
	private readonly _filter: FilterProvider;
	private readonly _container: HTMLElement;
	private readonly _coordinator: { scheduleUpdate(): void };

	private _selectedAlgorithm: AlgorithmId = 'pagerank';
	private _running = false;
	private _louvainResolution = 1.0;
	private _pagerankAlpha = 0.85;
	private _centralitySamplingThreshold = 2000;

	private _wrapperEl: HTMLElement | null = null;
	private _paramsContainer: HTMLElement | null = null;
	private _runButton: HTMLButtonElement | null = null;
	private _statusEl: HTMLElement | null = null;

	constructor(config: AlgorithmExplorerConfig) {
		this._bridge = config.bridge;
		this._schema = config.schema;
		this._filter = config.filter;
		this._container = config.container;
		this._coordinator = config.coordinator;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(): void {
		// Create wrapper
		this._wrapperEl = document.createElement('div');
		this._wrapperEl.className = 'algorithm-explorer';

		// Radio group
		const fieldset = document.createElement('fieldset');
		fieldset.className = 'algorithm-explorer__radios';
		const legend = document.createElement('legend');
		legend.textContent = 'Algorithm';
		fieldset.appendChild(legend);

		for (const algo of ALGORITHMS) {
			const label = document.createElement('label');
			label.className = 'algorithm-explorer__radio-label';

			const radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = 'algorithm';
			radio.value = algo.id;
			if (algo.id === this._selectedAlgorithm) {
				radio.checked = true;
			}

			radio.addEventListener('change', () => {
				this._selectedAlgorithm = algo.id;
				this._renderParams();
			});

			const span = document.createElement('span');
			span.textContent = algo.label;

			label.appendChild(radio);
			label.appendChild(span);
			fieldset.appendChild(label);
		}

		this._wrapperEl.appendChild(fieldset);

		// Params container
		this._paramsContainer = document.createElement('div');
		this._paramsContainer.className = 'algorithm-explorer__params';
		this._wrapperEl.appendChild(this._paramsContainer);

		// Run button
		this._runButton = document.createElement('button');
		this._runButton.className = 'algorithm-explorer__run';
		this._runButton.textContent = 'Run';
		this._runButton.setAttribute('data-testid', 'algorithm-run');
		this._runButton.addEventListener('click', () => {
			void this._onRun();
		});
		this._wrapperEl.appendChild(this._runButton);

		// Status line
		this._statusEl = document.createElement('div');
		this._statusEl.className = 'algorithm-explorer__status';
		this._wrapperEl.appendChild(this._statusEl);

		this._container.appendChild(this._wrapperEl);

		// Render initial params
		this._renderParams();
	}

	getSelectedAlgorithm(): AlgorithmId {
		return this._selectedAlgorithm;
	}

	destroy(): void {
		if (this._wrapperEl) {
			this._wrapperEl.remove();
			this._wrapperEl = null;
		}
		this._paramsContainer = null;
		this._runButton = null;
		this._statusEl = null;
	}

	// -----------------------------------------------------------------------
	// Parameter controls
	// -----------------------------------------------------------------------

	private _renderParams(): void {
		if (!this._paramsContainer) return;
		this._paramsContainer.textContent = '';

		switch (this._selectedAlgorithm) {
			case 'community': {
				const label = document.createElement('label');
				label.textContent = 'Resolution';

				const input = document.createElement('input');
				input.type = 'range';
				input.min = '0.1';
				input.max = '10.0';
				input.step = '0.1';
				input.value = String(this._louvainResolution);
				input.setAttribute('data-testid', 'louvain-resolution');

				const valueSpan = document.createElement('span');
				valueSpan.className = 'algorithm-explorer__param-value';
				valueSpan.textContent = String(this._louvainResolution);

				input.addEventListener('input', () => {
					this._louvainResolution = Number.parseFloat(input.value);
					valueSpan.textContent = String(this._louvainResolution);
				});

				label.appendChild(input);
				label.appendChild(valueSpan);
				this._paramsContainer.appendChild(label);
				break;
			}

			case 'pagerank': {
				const label = document.createElement('label');
				label.textContent = 'Damping Factor';

				const input = document.createElement('input');
				input.type = 'number';
				input.min = '0.1';
				input.max = '0.99';
				input.step = '0.01';
				input.value = String(this._pagerankAlpha);
				input.setAttribute('data-testid', 'pagerank-alpha');

				input.addEventListener('input', () => {
					this._pagerankAlpha = Number.parseFloat(input.value);
				});

				label.appendChild(input);
				this._paramsContainer.appendChild(label);
				break;
			}

			case 'centrality': {
				const label = document.createElement('label');
				label.textContent = 'Sampling Threshold';

				const input = document.createElement('input');
				input.type = 'number';
				input.min = '100';
				input.max = '100000';
				input.step = '100';
				input.value = String(this._centralitySamplingThreshold);
				input.setAttribute('data-testid', 'centrality-threshold');

				input.addEventListener('input', () => {
					this._centralitySamplingThreshold = Number.parseInt(input.value, 10);
				});

				const helpText = document.createElement('div');
				helpText.className = 'algorithm-explorer__param-help';
				helpText.textContent = 'Nodes > this value use sqrt(n) sampling';

				label.appendChild(input);
				this._paramsContainer.appendChild(label);
				this._paramsContainer.appendChild(helpText);
				break;
			}

			default:
				// No parameter controls for other algorithms
				break;
		}
	}

	// -----------------------------------------------------------------------
	// Run computation
	// -----------------------------------------------------------------------

	private async _onRun(): Promise<void> {
		if (this._running) return;
		this._running = true;
		if (this._runButton) this._runButton.disabled = true;
		if (this._statusEl) this._statusEl.textContent = 'Running...';

		try {
			// Get filtered card IDs from FilterProvider
			const compiled = this._filter.compile();
			let cardIds: string[] | undefined;

			// If there are active filters beyond the base deleted_at IS NULL
			if (compiled.where !== 'deleted_at IS NULL') {
				const result = await this._bridge.send('db:query', {
					sql: `SELECT id FROM cards WHERE ${compiled.where}`,
					params: compiled.params,
				});
				cardIds = result.rows.map((r) => r['id'] as string);
			}

			// Build params
			const computeParams: {
				pagerank?: { alpha?: number; iterations?: number };
				community?: { resolution?: number };
				shortest_path?: { sourceCardId?: string };
			} = {};
			if (this._selectedAlgorithm === 'community') {
				computeParams.community = { resolution: this._louvainResolution };
			} else if (this._selectedAlgorithm === 'pagerank') {
				computeParams.pagerank = { alpha: this._pagerankAlpha };
			}

			// Dispatch compute — build payload conditionally to satisfy exactOptionalPropertyTypes
			const computePayload: Parameters<WorkerBridge['computeGraph']>[0] = {
				algorithms: [this._selectedAlgorithm],
			};
			if (Object.keys(computeParams).length > 0) {
				computePayload.params = computeParams;
			}
			if (cardIds) {
				computePayload.cardIds = cardIds;
			}
			const result = await this._bridge.computeGraph(computePayload);

			// After success: inject metric columns into SchemaProvider
			this._schema.addGraphMetricColumns();
			this._coordinator.scheduleUpdate();

			// Update status
			if (this._statusEl) {
				this._statusEl.textContent = `${result.algorithmsComputed.join(', ')} — ${result.cardCount} cards, ${result.edgeCount} edges, ${result.durationMs}ms`;
			}
		} catch (err) {
			if (this._statusEl) {
				this._statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
			}
		} finally {
			this._running = false;
			if (this._runButton) this._runButton.disabled = false;
		}
	}
}
