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
import '../styles/network-view.css';

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
	mutationManager?: { subscribe(cb: () => void): () => void };
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
	private readonly _mutationManager: { subscribe(cb: () => void): () => void } | null;

	private _selectedAlgorithm: AlgorithmId = 'pagerank';
	private _running = false;
	private _louvainResolution = 1.0;
	private _pagerankAlpha = 0.85;
	private _centralitySamplingThreshold = 2000;

	private _wrapperEl: HTMLElement | null = null;
	private _paramsContainer: HTMLElement | null = null;
	private _runButton: HTMLButtonElement | null = null;
	private _resetButton: HTMLButtonElement | null = null;
	private _statusEl: HTMLElement | null = null;

	// Phase 118 — stale indicator state
	private _stale = false;
	private _staleDotEl: HTMLElement | null = null;
	private _unsubscribeMutation: (() => void) | null = null;

	// Phase 117 — algorithm result callback for NetworkView encoding wiring
	private _onResult: ((params: {
		algorithm: string;
		pathCardIds?: string[];
		mstEdges?: Array<[string, string]>;
		reachable?: boolean;
	}) => void) | null = null;

	private _onResetCallback: (() => void) | null = null;

	// Phase 117-02 — shortest path pick mode
	private _pickMode: 'idle' | 'pick-source' | 'pick-target' | 'ready' = 'idle';
	private _sourceCardId: string | null = null;
	private _targetCardId: string | null = null;
	private _pickInstructionEl: HTMLElement | null = null;
	private _sourceSelect: HTMLSelectElement | null = null;
	private _targetSelect: HTMLSelectElement | null = null;
	private _onPickModeChange: ((mode: string, sourceId: string | null, targetId: string | null) => void) | null = null;
	private _cardNames: Array<{ id: string; name: string }> = [];

	constructor(config: AlgorithmExplorerConfig) {
		this._bridge = config.bridge;
		this._schema = config.schema;
		this._filter = config.filter;
		this._container = config.container;
		this._coordinator = config.coordinator;
		this._mutationManager = config.mutationManager ?? null;
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

		// Phase 118: stale indicator dot on section header
		this._staleDotEl = document.createElement('span');
		this._staleDotEl.className = 'algorithm-explorer__stale-dot';
		this._staleDotEl.setAttribute('aria-label', 'Graph metrics may be outdated \u2014 data changed since last compute');
		this._staleDotEl.style.display = 'none';
		legend.appendChild(this._staleDotEl);

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

		// Reset button
		this._resetButton = document.createElement('button');
		this._resetButton.className = 'algorithm-explorer__reset';
		this._resetButton.textContent = 'Reset';
		this._resetButton.setAttribute('data-testid', 'algorithm-reset');
		this._resetButton.addEventListener('click', () => {
			this._clearStale();
			this._onResetCallback?.();
			if (this._statusEl) this._statusEl.textContent = '';
			// Reset pick state (Phase 117-02)
			this._pickMode = 'idle';
			this._sourceCardId = null;
			this._targetCardId = null;
			this._onPickModeChange?.('idle', null, null);
			// Re-render params to clear instruction and dropdowns if shortest_path
			if (this._selectedAlgorithm === 'shortest_path') {
				this._renderParams();
			}
		});
		this._wrapperEl.appendChild(this._resetButton);

		// Status line
		this._statusEl = document.createElement('div');
		this._statusEl.className = 'algorithm-explorer__status';
		this._wrapperEl.appendChild(this._statusEl);

		this._container.appendChild(this._wrapperEl);

		// Phase 118: subscribe to MutationManager for stale detection
		if (this._mutationManager) {
			this._unsubscribeMutation = this._mutationManager.subscribe(() => {
				this.markStale();
			});
		}

		// Render initial params
		this._renderParams();
	}

	getSelectedAlgorithm(): AlgorithmId {
		return this._selectedAlgorithm;
	}

	/**
	 * Register a callback invoked after each successful algorithm computation.
	 * Used to wire NetworkView.applyAlgorithmEncoding (Phase 117).
	 */
	onResult(callback: (params: {
		algorithm: string;
		pathCardIds?: string[];
		mstEdges?: Array<[string, string]>;
		reachable?: boolean;
	}) => void): void {
		this._onResult = callback;
	}

	/**
	 * Register a callback invoked when encoding reset is requested (Phase 117).
	 * Wires to NetworkView.resetEncoding in main.ts.
	 */
	onReset(callback: () => void): void {
		this._onResetCallback = callback;
	}

	/**
	 * Mark algorithm results as stale (Phase 118 — GFND-04).
	 * Called by MutationManager subscription on any card/connection mutation.
	 */
	markStale(): void {
		this._stale = true;
		if (this._staleDotEl) this._staleDotEl.style.display = 'inline-block';
		if (this._statusEl) {
			this._statusEl.textContent = 'Results may be outdated';
			this._statusEl.classList.add('algorithm-explorer__status--stale');
		}
	}

	private _clearStale(): void {
		this._stale = false;
		if (this._staleDotEl) this._staleDotEl.style.display = 'none';
		if (this._statusEl) {
			this._statusEl.classList.remove('algorithm-explorer__status--stale');
		}
	}

	/**
	 * Register a callback invoked when pick mode or source/target changes (Phase 117-02).
	 * Used by main.ts to wire NetworkView.setPickMode and setPickedNodes.
	 */
	onPickModeChange(callback: (mode: string, sourceId: string | null, targetId: string | null) => void): void {
		this._onPickModeChange = callback;
	}

	/**
	 * Provide the full list of card names for the source/target dropdowns (Phase 117-02).
	 * Called from main.ts on each render when NetworkView is active.
	 */
	setCardNames(cards: Array<{ id: string; name: string }>): void {
		this._cardNames = [...cards].sort((a, b) => a.name.localeCompare(b.name));
		// Refresh dropdowns if they're currently shown
		if (this._sourceSelect && this._targetSelect) {
			this._populateDropdowns();
		}
	}

	/**
	 * Called by NetworkView when a node is clicked while pick mode is active (Phase 117-02).
	 * Advances pick mode state: idle -> pick-source, pick-source -> pick-target, pick-target -> ready.
	 */
	nodeClicked(cardId: string, _cardName: string): void {
		if (this._selectedAlgorithm !== 'shortest_path') return;

		if (this._pickMode === 'idle' || this._pickMode === 'pick-source') {
			this._sourceCardId = cardId;
			if (this._sourceSelect) this._sourceSelect.value = cardId;
			this._pickMode = this._targetCardId !== null ? 'ready' : 'pick-target';
		} else if (this._pickMode === 'pick-target') {
			this._targetCardId = cardId;
			if (this._targetSelect) this._targetSelect.value = cardId;
			this._pickMode = this._sourceCardId !== null ? 'ready' : 'pick-source';
		}

		this._updatePickInstruction();
		this._onPickModeChange?.(this._pickMode, this._sourceCardId, this._targetCardId);
	}

	destroy(): void {
		// Phase 118: unsubscribe mutation listener
		this._unsubscribeMutation?.();
		this._unsubscribeMutation = null;

		if (this._wrapperEl) {
			this._wrapperEl.remove();
			this._wrapperEl = null;
		}
		this._paramsContainer = null;
		this._runButton = null;
		this._resetButton = null;
		this._statusEl = null;
		this._staleDotEl = null;
	}

	// -----------------------------------------------------------------------
	// Pick mode helpers
	// -----------------------------------------------------------------------

	private _updatePickInstruction(): void {
		if (!this._pickInstructionEl) return;
		switch (this._pickMode) {
			case 'pick-source':
				this._pickInstructionEl.textContent = 'Click source node on graph';
				break;
			case 'pick-target':
				this._pickInstructionEl.textContent = 'Click target node on graph';
				break;
			case 'ready':
				this._pickInstructionEl.textContent = 'Ready \u2014 press Run';
				break;
			default:
				this._pickInstructionEl.textContent = 'Click source node on graph';
				break;
		}
	}

	private _populateDropdowns(): void {
		if (!this._sourceSelect || !this._targetSelect) return;

		const buildOptions = (select: HTMLSelectElement, currentValue: string | null) => {
			select.textContent = '';
			const blank = document.createElement('option');
			blank.value = '';
			blank.textContent = '-- Select --';
			select.appendChild(blank);
			for (const card of this._cardNames) {
				const opt = document.createElement('option');
				opt.value = card.id;
				opt.textContent = card.name;
				select.appendChild(opt);
			}
			if (currentValue) select.value = currentValue;
		};

		buildOptions(this._sourceSelect, this._sourceCardId);
		buildOptions(this._targetSelect, this._targetCardId);
	}

	// -----------------------------------------------------------------------
	// Parameter controls
	// -----------------------------------------------------------------------

	private _renderParams(): void {
		if (!this._paramsContainer) return;
		this._paramsContainer.textContent = '';

		// Reset pick-mode DOM references
		this._pickInstructionEl = null;
		this._sourceSelect = null;
		this._targetSelect = null;

		switch (this._selectedAlgorithm) {
			case 'shortest_path': {
				// Pick instruction
				const instruction = document.createElement('div');
				instruction.className = 'nv-pick-instruction';
				instruction.setAttribute('role', 'status');
				instruction.setAttribute('aria-live', 'polite');
				instruction.textContent = 'Click source node on graph';
				this._pickInstructionEl = instruction;
				this._paramsContainer.appendChild(instruction);

				// Dropdowns container
				const dropdownsEl = document.createElement('div');
				dropdownsEl.className = 'nv-pick-dropdowns';

				// Source label + select
				const sourceLabel = document.createElement('label');
				sourceLabel.htmlFor = 'sp-source';
				sourceLabel.textContent = 'Source';
				const sourceSelect = document.createElement('select');
				sourceSelect.id = 'sp-source';
				sourceSelect.setAttribute('aria-label', 'Source');
				this._sourceSelect = sourceSelect;
				sourceLabel.appendChild(sourceSelect);
				dropdownsEl.appendChild(sourceLabel);

				// Target label + select
				const targetLabel = document.createElement('label');
				targetLabel.htmlFor = 'sp-target';
				targetLabel.textContent = 'Target';
				const targetSelect = document.createElement('select');
				targetSelect.id = 'sp-target';
				targetSelect.setAttribute('aria-label', 'Target');
				this._targetSelect = targetSelect;
				targetLabel.appendChild(targetSelect);
				dropdownsEl.appendChild(targetLabel);

				this._paramsContainer.appendChild(dropdownsEl);

				// Populate dropdowns
				this._populateDropdowns();

				// Source select change
				sourceSelect.addEventListener('change', () => {
					this._sourceCardId = sourceSelect.value || null;
					if (this._sourceCardId) {
						this._pickMode = this._targetCardId !== null ? 'ready' : 'pick-target';
					} else {
						this._pickMode = 'pick-source';
					}
					this._updatePickInstruction();
					this._onPickModeChange?.(this._pickMode, this._sourceCardId, this._targetCardId);
				});

				// Target select change
				targetSelect.addEventListener('change', () => {
					this._targetCardId = targetSelect.value || null;
					if (this._targetCardId) {
						this._pickMode = this._sourceCardId !== null ? 'ready' : 'pick-source';
					} else if (this._sourceCardId) {
						this._pickMode = 'pick-target';
					} else {
						this._pickMode = 'pick-source';
					}
					this._updatePickInstruction();
					this._onPickModeChange?.(this._pickMode, this._sourceCardId, this._targetCardId);
				});

				// Enter pick-source mode when shortest_path selected (silent — no onPickModeChange)
				if (this._pickMode === 'idle') {
					this._pickMode = 'pick-source';
				}
				this._updatePickInstruction();
				break;
			}

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
				shortest_path?: { sourceCardId?: string; targetCardId?: string };
			} = {};
			if (this._selectedAlgorithm === 'community') {
				computeParams.community = { resolution: this._louvainResolution };
			} else if (this._selectedAlgorithm === 'pagerank') {
				computeParams.pagerank = { alpha: this._pagerankAlpha };
			} else if (this._selectedAlgorithm === 'shortest_path' && this._sourceCardId && this._targetCardId) {
				computeParams.shortest_path = {
					sourceCardId: this._sourceCardId,
					targetCardId: this._targetCardId,
				};
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

			// Phase 117: invoke NetworkView encoding callback with algorithm result
			if (this._onResult) {
				const callbackParams: {
					algorithm: string;
					pathCardIds?: string[];
					mstEdges?: Array<[string, string]>;
					reachable?: boolean;
				} = { algorithm: this._selectedAlgorithm };
				if (result.pathCardIds !== undefined) callbackParams.pathCardIds = result.pathCardIds;
				if (result.mstEdges !== undefined) callbackParams.mstEdges = result.mstEdges;
				if (result.reachable !== undefined) callbackParams.reachable = result.reachable;
				this._onResult(callbackParams);
			}

			// Phase 118: clear stale indicator after successful compute
			this._clearStale();

			// Check for unreachable shortest path target
			if (this._statusEl && result.reachable === false) {
				this._statusEl.textContent = 'No path found between selected nodes.';
				this._statusEl.style.color = 'var(--danger)';
			} else if (this._statusEl) {
				this._statusEl.style.color = '';
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
