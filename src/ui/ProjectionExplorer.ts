// Isometry v5 — Phase 55 Plan 03
// ProjectionExplorer: 4 projection wells (Available, X, Y, Z)
// with HTML5 DnD, duplicate rejection, minimum enforcement, D3 selection.join.
//
// Requirements: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-07
//
// Design:
//   - 4 horizontal wells: Available (wider), X, Y, Z
//   - Chips render with D3 selection.join (INTG-03)
//   - HTML5 native DnD (not d3.drag) -- follows KanbanView pattern
//   - Module-level DnD state for cross-handler communication
//   - Distinct MIME type (text/x-projection-field) prevents collision with SuperGrid
//   - All axis mutations flow through PAFVProvider only

import { select } from 'd3-selection';
import '../styles/projection-explorer.css';
import { ALLOWED_AXIS_FIELDS, isValidAxisField } from '../providers/allowlist';
import { getLatchFamily, LATCH_COLORS } from '../providers/latch';
import { AppDialog } from './AppDialog';
import { resolveDefaults } from '../providers/ViewDefaultsRegistry';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { AggregationMode, AxisField, AxisMapping, TimeGranularity, ViewMode } from '../providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Well identifiers for the 4 projection wells. */
export type WellId = 'available' | 'x' | 'y' | 'z';

/** Configuration for ProjectionExplorer constructor. */
export interface ProjectionExplorerConfig {
	pafv: {
		getState(): {
			colAxes: AxisMapping[];
			rowAxes: AxisMapping[];
		};
		getAggregation(): AggregationMode;
		setAggregation(mode: AggregationMode): void;
		setColAxes(axes: AxisMapping[]): void;
		setRowAxes(axes: AxisMapping[]): void;
		reorderColAxes(fromIndex: number, toIndex: number): void;
		reorderRowAxes(fromIndex: number, toIndex: number): void;
		subscribe(callback: () => void): () => void;
	};
	alias: {
		getAlias(field: AxisField): string;
		subscribe(callback: () => void): () => void;
	};
	superDensity: {
		getState(): {
			displayField?: AxisField;
			viewMode: ViewMode;
			axisGranularity: TimeGranularity | null;
		};
		setDisplayField(field: AxisField): void;
		setViewMode(mode: ViewMode): void;
		setGranularity(granularity: TimeGranularity | null): void;
		subscribe(callback: () => void): () => void;
	};
	auditState: {
		toggle(): void;
		get enabled(): boolean;
		subscribe(cb: () => void): () => void;
	};
	actionToast: { show(msg: string): void };
	container: HTMLElement;
	enabledFieldsGetter: () => ReadonlySet<AxisField>;
	/** Optional SchemaProvider for dynamic field discovery (DYNM-06). */
	schema?: SchemaProvider;
	/** Returns the active dataset's source type, or null if none active (SGDF-05). */
	getSourceType?: () => string | null;
}

/** Internal chip data for D3 join. */
interface ChipDatum {
	field: AxisField;
	index: number;
}

// ---------------------------------------------------------------------------
// Module-level pointer-based drag state
// ---------------------------------------------------------------------------
// Uses pointer events (pointerdown/pointermove/pointerup) instead of HTML5 DnD
// because WKWebView on macOS intercepts HTML5 drag events for native drag sessions.
// Pointer events work reliably in all contexts (browser, WKWebView, iOS).

let _dragSourceWell: WellId | null = null;
let _dragField: AxisField | null = null;
let _dragIndex: number | null = null;
let _ghostEl: HTMLElement | null = null;
let _wellBodiesRef: Map<WellId, HTMLElement> | null = null;
let _dropTargetWell: WellId | null = null;

/**
 * Test helper: set drag state for simulated DnD in tests.
 * @internal
 */
export function _setDragState(sourceWell: WellId, field: AxisField, index: number): void {
	_dragSourceWell = sourceWell;
	_dragField = field;
	_dragIndex = index;
}

// ---------------------------------------------------------------------------
// Well configuration
// ---------------------------------------------------------------------------

const WELL_CONFIGS: Array<{ id: WellId; label: string }> = [
	{ id: 'available', label: 'Available' },
	{ id: 'x', label: 'X' },
	{ id: 'y', label: 'Y' },
	{ id: 'z', label: 'Z' },
];

// ---------------------------------------------------------------------------
// ProjectionExplorer
// ---------------------------------------------------------------------------

/**
 * ProjectionExplorer renders 4 horizontal projection wells (Available, X, Y, Z)
 * where users drag property chips between wells to configure SuperGrid axes.
 *
 * - Available well auto-populates with enabled fields not in X/Y/Z
 * - X well shows PAFVProvider.rowAxes (SuperGrid rows on x-plane)
 * - Y well shows PAFVProvider.colAxes (SuperGrid columns on y-plane)
 * - Z well is initially empty (deferred to Plan 04)
 * - HTML5 DnD with duplicate rejection and min-1 enforcement for X/Y
 * - All mutations flow through PAFVProvider.setColAxes/setRowAxes only
 */
export class ProjectionExplorer {
	private readonly _config: ProjectionExplorerConfig;
	private _root: HTMLElement | null = null;
	private _wellBodies: Map<WellId, HTMLElement> = new Map();
	private _unsubPafv: (() => void) | null = null;
	private _unsubAlias: (() => void) | null = null;
	private _unsubSuperDensity: (() => void) | null = null;
	private _unsubAudit: (() => void) | null = null;
	private _zAxes: AxisField[] = [];
	private _enabledFieldsGetter: () => ReadonlySet<AxisField>;
	private _auditToggleBtn: HTMLButtonElement | null = null;
	private _resetBtn: HTMLButtonElement | null = null;
	private _granLabel: HTMLElement | null = null;
	private _granSelect: HTMLSelectElement | null = null;

	constructor(config: ProjectionExplorerConfig) {
		this._config = config;
		this._enabledFieldsGetter = config.enabledFieldsGetter;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	/**
	 * Create DOM, render chips, subscribe to providers, append to container.
	 */
	mount(): void {
		this._root = document.createElement('div');
		this._root.className = 'projection-explorer';

		const wellsContainer = document.createElement('div');
		wellsContainer.className = 'projection-explorer__wells';
		this._root.appendChild(wellsContainer);

		// Create 4 wells
		for (const { id, label } of WELL_CONFIGS) {
			const well = document.createElement('div');
			well.className = 'projection-explorer__well';
			well.dataset['well'] = id;

			const labelEl = document.createElement('div');
			labelEl.className = 'projection-explorer__well-label';
			labelEl.textContent = label;
			well.appendChild(labelEl);

			const body = document.createElement('div');
			body.className = 'projection-explorer__well-body';
			body.setAttribute('role', 'listbox');
			well.appendChild(body);

			this._wellBodies.set(id, body);
			wellsContainer.appendChild(well);
		}

		// Z-plane controls row
		this._root.appendChild(this._createZControls());

		// Footer with Reset to Defaults button (SGDF-05)
		if (this._config.getSourceType) {
			const footer = document.createElement('div');
			footer.className = 'projection-explorer__footer';

			const resetBtn = document.createElement('button');
			resetBtn.className = 'projection-explorer__reset-btn';
			resetBtn.textContent = 'Reset to defaults';
			resetBtn.dataset['testid'] = 'projection-explorer-reset-btn';
			resetBtn.style.display = 'none'; // Hidden by default
			resetBtn.addEventListener('click', () => { void this._handleResetDefaults(); });

			footer.appendChild(resetBtn);
			this._root.appendChild(footer);
			this._resetBtn = resetBtn;
		}

		// Render chips from current state
		this._renderChips();

		// Subscribe to providers for re-render
		this._unsubPafv = this._config.pafv.subscribe(() => {
			this._renderChips();
			this._syncGranularityVisibility();
		});
		this._unsubAlias = this._config.alias.subscribe(() => this._renderChips());
		this._unsubSuperDensity = this._config.superDensity.subscribe(() => this._syncZControls());
		this._unsubAudit = this._config.auditState.subscribe(() => this._syncAuditToggle());

		// Append to container
		this._config.container.appendChild(this._root);
	}

	/**
	 * Re-render all wells from current provider state (called externally).
	 */
	update(): void {
		this._renderChips();
	}

	/**
	 * Update the enabled fields getter and re-render.
	 */
	setEnabledFieldsGetter(getter: () => ReadonlySet<AxisField>): void {
		this._enabledFieldsGetter = getter;
		this._renderChips();
	}

	/**
	 * Remove DOM, unsubscribe from providers, null out references.
	 */
	destroy(): void {
		this._unsubPafv?.();
		this._unsubAlias?.();
		this._unsubSuperDensity?.();
		this._unsubAudit?.();
		this._unsubPafv = null;
		this._unsubAlias = null;
		this._unsubSuperDensity = null;
		this._unsubAudit = null;

		this._root?.remove();
		this._root = null;
		this._wellBodies.clear();
		this._zAxes = [];
		this._auditToggleBtn = null;
		this._resetBtn = null;
		this._granLabel = null;
		this._granSelect = null;
	}

	// -----------------------------------------------------------------------
	// Chip rendering via D3 selection.join (INTG-03)
	// -----------------------------------------------------------------------

	/**
	 * Re-render all wells from current provider state using D3 selection.join.
	 */
	private _renderChips(): void {
		const state = this._config.pafv.getState();
		const colAxes = state.colAxes;
		const rowAxes = state.rowAxes;
		const enabledFields = this._enabledFieldsGetter();

		// Compute assigned fields
		const assignedFields = new Set<AxisField>();
		for (const a of colAxes) assignedFields.add(a.field);
		for (const a of rowAxes) assignedFields.add(a.field);
		for (const f of this._zAxes) assignedFields.add(f);

		// Compute Available: axis-eligible enabled fields NOT in X/Y/Z
		// Only fields that pass isValidAxisField() can be GROUP BY targets.
		const availableFields: ChipDatum[] = [];
		let idx = 0;
		for (const field of enabledFields) {
			if (!assignedFields.has(field) && isValidAxisField(field as string)) {
				availableFields.push({ field, index: idx++ });
			}
		}

		// Build well data map
		// X-plane = rows, Y-plane = columns (spatial metaphor: x is horizontal spread, y is vertical)
		const wellData: Record<WellId, ChipDatum[]> = {
			available: availableFields,
			x: rowAxes.map((a, i) => ({ field: a.field, index: i })),
			y: colAxes.map((a, i) => ({ field: a.field, index: i })),
			z: this._zAxes.map((f, i) => ({ field: f, index: i })),
		};

		// Render each well
		for (const [wellId, body] of this._wellBodies) {
			const data = wellData[wellId] ?? [];
			this._renderWellChips(body, wellId, data);
		}

		// Update Reset button visibility based on override detection (D-05, SGDF-05)
		this._updateResetButtonVisibility();
	}

	// -----------------------------------------------------------------------
	// Reset to defaults (SGDF-05)
	// -----------------------------------------------------------------------

	/**
	 * Show or hide the Reset button based on whether current axes differ from registry defaults (D-05).
	 */
	private _updateResetButtonVisibility(): void {
		if (!this._resetBtn || !this._config.getSourceType) return;
		const sourceType = this._config.getSourceType();
		if (!sourceType) {
			this._resetBtn.style.display = 'none';
			return;
		}
		const defaults = resolveDefaults(sourceType, this._config.schema ?? null);
		const state = this._config.pafv.getState();

		const colMatch = JSON.stringify(state.colAxes) === JSON.stringify(defaults.colAxes);
		const rowMatch = JSON.stringify(state.rowAxes) === JSON.stringify(defaults.rowAxes);
		const hasDefaults = defaults.colAxes.length > 0 || defaults.rowAxes.length > 0;

		this._resetBtn.style.display = (!colMatch || !rowMatch) && hasDefaults ? '' : 'none';
	}

	/**
	 * Handle Reset to Defaults button click — confirm via AppDialog then restore registry defaults.
	 */
	private async _handleResetDefaults(): Promise<void> {
		const confirmed = await AppDialog.show({
			variant: 'confirm',
			title: 'Reset to Defaults',
			message: 'Restore source-type default axes and layout for this dataset?',
			confirmLabel: 'Reset Axes',
			cancelLabel: 'Keep Current',
		});
		if (!confirmed) return;

		const sourceType = this._config.getSourceType?.();
		if (!sourceType) return;
		const defaults = resolveDefaults(sourceType, this._config.schema ?? null);
		if (defaults.colAxes.length > 0) this._config.pafv.setColAxes(defaults.colAxes);
		if (defaults.rowAxes.length > 0) this._config.pafv.setRowAxes(defaults.rowAxes);
		// Button hides automatically via _renderChips() triggered by pafv subscription
	}

	/**
	 * Render chips inside a single well using D3 selection.join.
	 */
	private _renderWellChips(body: HTMLElement, wellId: WellId, data: ChipDatum[]): void {
		const alias = this._config.alias;
		const enabledFields = this._enabledFieldsGetter();

		select(body)
			.selectAll<HTMLDivElement, ChipDatum>('.projection-explorer__chip')
			.data(data, (d) => d.field)
			.join(
				(enter) =>
					enter
						.append('div')
						.attr('class', (d) => {
							let cls = 'projection-explorer__chip';
							if (!enabledFields.has(d.field)) {
								cls += ' projection-explorer__chip--disabled';
							}
							return cls;
						})
						.attr('role', 'option')
						.attr('data-field', (d) => d.field)
						.each(function (d) {
							// Colored LATCH border
							const borderEl = document.createElement('span');
							borderEl.className = 'projection-explorer__chip-border';
							const family = getLatchFamily(d.field);
							borderEl.style.backgroundColor = LATCH_COLORS[family];
							this.appendChild(borderEl);

							// Label
							const labelEl = document.createElement('span');
							labelEl.className = 'projection-explorer__chip-label';
							labelEl.textContent = alias.getAlias(d.field);
							this.appendChild(labelEl);
						})
						.on('pointerdown', (e: PointerEvent, d: ChipDatum) => {
							console.log('[PE] pointerdown', d.field, wellId);
							e.preventDefault();
							const chip = e.currentTarget as HTMLElement;
							chip.setPointerCapture(e.pointerId);
							_dragSourceWell = wellId;
							_dragField = d.field;
							_dragIndex = d.index;
							_wellBodiesRef = this._wellBodies;

							// Create ghost element
							_ghostEl = chip.cloneNode(true) as HTMLElement;
							_ghostEl.className = 'projection-explorer__chip projection-explorer__chip--ghost';
							_ghostEl.style.position = 'fixed';
							_ghostEl.style.pointerEvents = 'none';
							_ghostEl.style.zIndex = '9999';
							_ghostEl.style.opacity = '0.8';
							_ghostEl.style.transform = 'scale(1.05)';
							const rect = chip.getBoundingClientRect();
							_ghostEl.style.width = `${rect.width}px`;
							_ghostEl.style.left = `${e.clientX - rect.width / 2}px`;
							_ghostEl.style.top = `${e.clientY - 12}px`;
							document.body.appendChild(_ghostEl);

							chip.classList.add('dragging');
						})
						.on('pointermove', (e: PointerEvent) => {
							if (!_ghostEl || !_dragField) return;
							_ghostEl.style.left = `${e.clientX - _ghostEl.offsetWidth / 2}px`;
							_ghostEl.style.top = `${e.clientY - 12}px`;

							// Hit-test wells to highlight drop target
							_dropTargetWell = null;
							if (_wellBodiesRef) {
								for (const [wId, wBody] of _wellBodiesRef) {
									const r = wBody.getBoundingClientRect();
									if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
										if (!this._isFieldInWell(_dragField!, wId) || wId === _dragSourceWell) {
											_dropTargetWell = wId;
											wBody.classList.add('projection-explorer__well--dragover');
										}
									} else {
										wBody.classList.remove('projection-explorer__well--dragover');
									}
								}
							}
						})
						.on('pointerup', (e: PointerEvent) => {
							const chip = e.currentTarget as HTMLElement;
							chip.classList.remove('dragging');
							chip.releasePointerCapture(e.pointerId);

							// Remove ghost
							_ghostEl?.remove();
							_ghostEl = null;

							// Clear all well highlights
							if (_wellBodiesRef) {
								for (const [, wBody] of _wellBodiesRef) {
									wBody.classList.remove('projection-explorer__well--dragover');
								}
							}

							const field = _dragField;
							const sourceWell = _dragSourceWell;
							const targetWell = _dropTargetWell;

							// Clear state
							_dragField = null;
							_dragSourceWell = null;
							_dragIndex = null;
							_dropTargetWell = null;

							if (!field || !sourceWell || !targetWell) return;
							if (sourceWell === targetWell) return; // Within-well reorder TBD

							this._handleBetweenWellMove(field, sourceWell, targetWell);
						}),
				(update) =>
					update
						.attr('class', (d) => {
							let cls = 'projection-explorer__chip';
							if (!enabledFields.has(d.field)) {
								cls += ' projection-explorer__chip--disabled';
							}
							return cls;
						})
						.each(function (d) {
							// Update label text (alias may have changed)
							const labelEl = this.querySelector('.projection-explorer__chip-label');
							if (labelEl) {
								labelEl.textContent = alias.getAlias(d.field);
							}
						}),
				(exit) => exit.remove(),
			);
	}

	// -----------------------------------------------------------------------
	// Z-plane controls
	// -----------------------------------------------------------------------

	/**
	 * Create the Z-plane controls row with 4 controls:
	 * 1. Display field select
	 * 2. Audit toggle button
	 * 3. Density controls (view mode + granularity)
	 * 4. Aggregation mode select
	 */
	private _createZControls(): HTMLElement {
		const row = document.createElement('div');
		row.className = 'projection-explorer__z-controls';

		const { superDensity, auditState, pafv, alias } = this._config;
		const densityState = superDensity.getState();

		// 1. Display field select
		const displayLabel = document.createElement('span');
		displayLabel.className = 'projection-explorer__z-label';
		displayLabel.textContent = 'Display';
		row.appendChild(displayLabel);

		const displaySelect = document.createElement('select');
		displaySelect.className = 'projection-explorer__z-display-field';
		const displayFields: AxisField[] = this._config.schema?.initialized
			? this._config.schema.getAxisColumns().map((c) => c.name as AxisField)
			: [...ALLOWED_AXIS_FIELDS];
		for (const field of displayFields) {
			const opt = document.createElement('option');
			opt.value = field;
			opt.textContent = alias.getAlias(field);
			if (field === (densityState.displayField ?? 'name')) {
				opt.selected = true;
			}
			displaySelect.appendChild(opt);
		}
		displaySelect.addEventListener('change', () => {
			superDensity.setDisplayField(displaySelect.value as AxisField);
		});
		row.appendChild(displaySelect);

		// 2. Audit toggle button
		const auditBtn = document.createElement('button');
		auditBtn.className = 'projection-explorer__z-audit-toggle';
		auditBtn.textContent = 'Audit';
		auditBtn.type = 'button';
		if (auditState.enabled) {
			auditBtn.classList.add('projection-explorer__z-audit-toggle--active');
		}
		auditBtn.addEventListener('click', () => {
			auditState.toggle();
		});
		this._auditToggleBtn = auditBtn;
		row.appendChild(auditBtn);

		// 3. Density controls: view mode select + granularity select
		const viewModeLabel = document.createElement('span');
		viewModeLabel.className = 'projection-explorer__z-label';
		viewModeLabel.textContent = 'Mode';
		row.appendChild(viewModeLabel);

		const viewModeSelect = document.createElement('select');
		viewModeSelect.className = 'projection-explorer__z-density';
		for (const mode of ['spreadsheet', 'matrix'] as const) {
			const opt = document.createElement('option');
			opt.value = mode;
			opt.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
			if (mode === densityState.viewMode) opt.selected = true;
			viewModeSelect.appendChild(opt);
		}
		viewModeSelect.addEventListener('change', () => {
			superDensity.setViewMode(viewModeSelect.value as ViewMode);
		});
		row.appendChild(viewModeSelect);

		const granLabel = document.createElement('span');
		granLabel.className = 'projection-explorer__z-label';
		granLabel.textContent = 'Granularity';
		row.appendChild(granLabel);
		this._granLabel = granLabel;

		const granSelect = document.createElement('select');
		granSelect.className = 'projection-explorer__z-density';
		this._granSelect = granSelect;
		const granOptions: Array<{ value: string; label: string }> = [
			{ value: '', label: 'None' },
			{ value: 'day', label: 'Day' },
			{ value: 'week', label: 'Week' },
			{ value: 'month', label: 'Month' },
			{ value: 'quarter', label: 'Quarter' },
			{ value: 'year', label: 'Year' },
		];
		for (const { value, label } of granOptions) {
			const opt = document.createElement('option');
			opt.value = value;
			opt.textContent = label;
			const currentGran = densityState.axisGranularity;
			if ((currentGran === null && value === '') || currentGran === value) {
				opt.selected = true;
			}
			granSelect.appendChild(opt);
		}
		granSelect.addEventListener('change', () => {
			const val = granSelect.value;
			superDensity.setGranularity(val === '' ? null : (val as TimeGranularity));
		});
		row.appendChild(granSelect);

		// 4. Aggregation mode select
		const aggLabel = document.createElement('span');
		aggLabel.className = 'projection-explorer__z-label';
		aggLabel.textContent = 'Aggregation';
		row.appendChild(aggLabel);

		const aggSelect = document.createElement('select');
		aggSelect.className = 'projection-explorer__z-aggregation';
		for (const mode of ['count', 'sum', 'avg', 'min', 'max'] as const) {
			const opt = document.createElement('option');
			opt.value = mode;
			opt.textContent = mode.toUpperCase();
			if (mode === pafv.getAggregation()) opt.selected = true;
			aggSelect.appendChild(opt);
		}
		aggSelect.addEventListener('change', () => {
			pafv.setAggregation(aggSelect.value as AggregationMode);
		});
		row.appendChild(aggSelect);

		this._syncGranularityVisibility();

		return row;
	}

	/**
	 * Sync Z-controls with current SuperDensityProvider state.
	 * Called on SuperDensityProvider subscriber notification.
	 */
	private _syncZControls(): void {
		if (!this._root) return;
		const state = this._config.superDensity.getState();

		const displaySelect = this._root.querySelector<HTMLSelectElement>('.projection-explorer__z-display-field');
		if (displaySelect) {
			displaySelect.value = state.displayField ?? 'name';
		}

		const viewModeSelect = this._root.querySelector<HTMLSelectElement>('.projection-explorer__z-density');
		if (viewModeSelect) {
			viewModeSelect.value = state.viewMode;
		}

		// Granularity is the second .projection-explorer__z-density select
		const densitySelects = this._root.querySelectorAll<HTMLSelectElement>('.projection-explorer__z-density');
		if (densitySelects.length >= 2) {
			densitySelects[1]!.value = state.axisGranularity ?? '';
		}

		this._syncGranularityVisibility();
	}

	/**
	 * Sync audit toggle button with current AuditState.
	 */
	private _syncAuditToggle(): void {
		if (!this._auditToggleBtn) return;
		if (this._config.auditState.enabled) {
			this._auditToggleBtn.classList.add('projection-explorer__z-audit-toggle--active');
		} else {
			this._auditToggleBtn.classList.remove('projection-explorer__z-audit-toggle--active');
		}
	}

	/**
	 * Return true if any active row or col axis field is a time-classified field.
	 * Uses SchemaProvider.getFieldsByFamily('Time') when available; falls back to
	 * a hardcoded set of known time fields.
	 */
	private _hasTimeAxis(): boolean {
		const { colAxes, rowAxes } = this._config.pafv.getState();
		const timeFields: ReadonlySet<string> = this._config.schema?.initialized
			? new Set(this._config.schema.getFieldsByFamily('Time').map((c) => c.name))
			: new Set(['created_at', 'modified_at', 'due_at']);
		return (
			colAxes.some((a) => timeFields.has(a.field)) ||
			rowAxes.some((a) => timeFields.has(a.field))
		);
	}

	/**
	 * Show or hide the granularity label and select based on whether a time axis is active.
	 */
	private _syncGranularityVisibility(): void {
		if (!this._granLabel || !this._granSelect) return;
		const display = this._hasTimeAxis() ? '' : 'none';
		this._granLabel.style.display = display;
		this._granSelect.style.display = display;
	}

	// -----------------------------------------------------------------------
	// Drop zone setup
	// -----------------------------------------------------------------------

	// Drop zone setup is no longer needed — pointer events on chips handle
	// hit-testing via getBoundingClientRect() in pointermove handler.
	// Wells are identified by their body elements stored in _wellBodiesRef.

	// -----------------------------------------------------------------------
	// Within-well reorder
	// -----------------------------------------------------------------------

	/**
	 * Handle reorder within the same well.
	 * Computes drop index from mouse position relative to chip positions.
	 */
	private _handleWithinWellReorder(wellId: WellId, fromIndex: number, e: DragEvent, body: HTMLElement): void {
		const chips = body.querySelectorAll<HTMLElement>('.projection-explorer__chip');
		let toIndex = chips.length - 1;

		// Find insertion point based on mouse position
		for (let i = 0; i < chips.length; i++) {
			const rect = chips[i]!.getBoundingClientRect();
			const midX = rect.left + rect.width / 2;
			if (e.clientX < midX) {
				toIndex = i;
				break;
			}
		}

		// Adjust if dragging forward (D3 list shift)
		if (toIndex > fromIndex) {
			toIndex = Math.min(toIndex, chips.length - 1);
		}

		if (fromIndex === toIndex) return;

		// X-plane = rowAxes, Y-plane = colAxes
		if (wellId === 'x') {
			this._config.pafv.reorderRowAxes(fromIndex, toIndex);
		} else if (wellId === 'y') {
			this._config.pafv.reorderColAxes(fromIndex, toIndex);
		}
		// Available and Z: reorder is visual only (no provider call)
	}

	// -----------------------------------------------------------------------
	// Between-well move
	// -----------------------------------------------------------------------

	/**
	 * Handle move from one well to another.
	 * Validates duplicates and minimum constraints before mutating.
	 */
	private _handleBetweenWellMove(field: AxisField, sourceWell: WellId, targetWell: WellId): void {
		// Duplicate check
		if (this._isFieldInWell(field, targetWell)) return;

		const state = this._config.pafv.getState();
		const colAxes = [...state.colAxes];
		const rowAxes = [...state.rowAxes];

		// Minimum enforcement: X and Y must retain at least 1 property
		// X-plane = rowAxes, Y-plane = colAxes
		if (sourceWell === 'x' && rowAxes.length <= 1) {
			this._config.actionToast.show('X axis requires at least one property');
			return;
		}
		if (sourceWell === 'y' && colAxes.length <= 1) {
			this._config.actionToast.show('Y axis requires at least one property');
			return;
		}

		// Remove field from source well
		// X-plane = rowAxes, Y-plane = colAxes
		let needColUpdate = false;
		let needRowUpdate = false;

		if (sourceWell === 'x') {
			const idx = rowAxes.findIndex((a) => a.field === field);
			if (idx >= 0) {
				rowAxes.splice(idx, 1);
				needRowUpdate = true;
			}
		} else if (sourceWell === 'y') {
			const idx = colAxes.findIndex((a) => a.field === field);
			if (idx >= 0) {
				colAxes.splice(idx, 1);
				needColUpdate = true;
			}
		} else if (sourceWell === 'z') {
			const idx = this._zAxes.indexOf(field);
			if (idx >= 0) this._zAxes.splice(idx, 1);
		}
		// If source is 'available': nothing to remove (Available is derived)

		// Add field to target well
		// X-plane = rowAxes, Y-plane = colAxes
		if (targetWell === 'x') {
			rowAxes.push({ field, direction: 'asc' });
			needRowUpdate = true;
		} else if (targetWell === 'y') {
			colAxes.push({ field, direction: 'asc' });
			needColUpdate = true;
		} else if (targetWell === 'z') {
			this._zAxes.push(field);
		}
		// If target is 'available': nothing to add (Available is derived)

		// Apply mutations to PAFVProvider
		if (needColUpdate) {
			this._config.pafv.setColAxes(colAxes);
		}
		if (needRowUpdate) {
			this._config.pafv.setRowAxes(rowAxes);
		}

		// If only Z or Available changed, just re-render locally
		if (!needColUpdate && !needRowUpdate) {
			this._renderChips();
		}
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	/**
	 * Check if a field is already present in a given well.
	 */
	private _isFieldInWell(field: AxisField, wellId: WellId): boolean {
		const state = this._config.pafv.getState();
		// X-plane = rowAxes, Y-plane = colAxes
		switch (wellId) {
			case 'x':
				return state.rowAxes.some((a) => a.field === field);
			case 'y':
				return state.colAxes.some((a) => a.field === field);
			case 'z':
				return this._zAxes.includes(field);
			case 'available': {
				const enabledFields = this._enabledFieldsGetter();
				const assignedFields = new Set<AxisField>();
				for (const a of state.colAxes) assignedFields.add(a.field);
				for (const a of state.rowAxes) assignedFields.add(a.field);
				for (const f of this._zAxes) assignedFields.add(f);
				return enabledFields.has(field) && !assignedFields.has(field);
			}
		}
	}
}
