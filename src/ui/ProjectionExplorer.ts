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
import { ALLOWED_AXIS_FIELDS } from '../providers/allowlist';
import { LATCH_COLORS, getLatchFamily } from '../providers/latch';
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
}

/** Internal chip data for D3 join. */
interface ChipDatum {
	field: AxisField;
	index: number;
}

// ---------------------------------------------------------------------------
// Module-level DnD state (not on dataTransfer due to async limitations)
// ---------------------------------------------------------------------------

let _dragSourceWell: WellId | null = null;
let _dragField: AxisField | null = null;
let _dragIndex: number | null = null;

/** Custom MIME type for projection field DnD -- prevents collision with SuperGrid. */
const MIME_PROJECTION = 'text/x-projection-field';

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
 * - X well shows PAFVProvider.colAxes
 * - Y well shows PAFVProvider.rowAxes
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

			// Set up drop listeners on each well body
			this._setupDropListeners(body, id);

			this._wellBodies.set(id, body);
			wellsContainer.appendChild(well);
		}

		// Z-plane controls row
		this._root.appendChild(this._createZControls());

		// Render chips from current state
		this._renderChips();

		// Subscribe to providers for re-render
		this._unsubPafv = this._config.pafv.subscribe(() => this._renderChips());
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

		// Compute Available: enabled fields NOT in X/Y/Z
		const availableFields: ChipDatum[] = [];
		let idx = 0;
		for (const field of enabledFields) {
			if (!assignedFields.has(field)) {
				availableFields.push({ field, index: idx++ });
			}
		}

		// Build well data map
		const wellData: Record<WellId, ChipDatum[]> = {
			available: availableFields,
			x: colAxes.map((a, i) => ({ field: a.field, index: i })),
			y: rowAxes.map((a, i) => ({ field: a.field, index: i })),
			z: this._zAxes.map((f, i) => ({ field: f, index: i })),
		};

		// Render each well
		for (const [wellId, body] of this._wellBodies) {
			const data = wellData[wellId] ?? [];
			this._renderWellChips(body, wellId, data);
		}
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
						.attr('draggable', 'true')
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
						.on('dragstart', (e: DragEvent, d: ChipDatum) => {
							if (!e.dataTransfer) return;
							e.dataTransfer.setData(MIME_PROJECTION, d.field);
							e.dataTransfer.effectAllowed = 'move';
							_dragSourceWell = wellId;
							_dragField = d.field;
							_dragIndex = d.index;
							(e.currentTarget as HTMLElement)?.classList.add('dragging');
						})
						.on('dragend', (e: DragEvent) => {
							(e.currentTarget as HTMLElement)?.classList.remove('dragging');
							_dragSourceWell = null;
							_dragField = null;
							_dragIndex = null;
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
		displayLabel.className = 'z-controls__label';
		displayLabel.textContent = 'Display';
		row.appendChild(displayLabel);

		const displaySelect = document.createElement('select');
		displaySelect.className = 'z-controls__display-field';
		for (const field of ALLOWED_AXIS_FIELDS) {
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
		auditBtn.className = 'z-controls__audit-toggle';
		auditBtn.textContent = 'Audit';
		auditBtn.type = 'button';
		if (auditState.enabled) {
			auditBtn.classList.add('z-controls__audit-toggle--active');
		}
		auditBtn.addEventListener('click', () => {
			auditState.toggle();
		});
		this._auditToggleBtn = auditBtn;
		row.appendChild(auditBtn);

		// 3. Density controls: view mode select + granularity select
		const viewModeLabel = document.createElement('span');
		viewModeLabel.className = 'z-controls__label';
		viewModeLabel.textContent = 'Mode';
		row.appendChild(viewModeLabel);

		const viewModeSelect = document.createElement('select');
		viewModeSelect.className = 'z-controls__density';
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
		granLabel.className = 'z-controls__label';
		granLabel.textContent = 'Granularity';
		row.appendChild(granLabel);

		const granSelect = document.createElement('select');
		granSelect.className = 'z-controls__density';
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
		aggLabel.className = 'z-controls__label';
		aggLabel.textContent = 'Aggregation';
		row.appendChild(aggLabel);

		const aggSelect = document.createElement('select');
		aggSelect.className = 'z-controls__aggregation';
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

		return row;
	}

	/**
	 * Sync Z-controls with current SuperDensityProvider state.
	 * Called on SuperDensityProvider subscriber notification.
	 */
	private _syncZControls(): void {
		if (!this._root) return;
		const state = this._config.superDensity.getState();

		const displaySelect = this._root.querySelector<HTMLSelectElement>('.z-controls__display-field');
		if (displaySelect) {
			displaySelect.value = state.displayField ?? 'name';
		}

		const viewModeSelect = this._root.querySelector<HTMLSelectElement>('.z-controls__density');
		if (viewModeSelect) {
			viewModeSelect.value = state.viewMode;
		}

		// Granularity is the second .z-controls__density select
		const densitySelects = this._root.querySelectorAll<HTMLSelectElement>('.z-controls__density');
		if (densitySelects.length >= 2) {
			densitySelects[1]!.value = state.axisGranularity ?? '';
		}
	}

	/**
	 * Sync audit toggle button with current AuditState.
	 */
	private _syncAuditToggle(): void {
		if (!this._auditToggleBtn) return;
		if (this._config.auditState.enabled) {
			this._auditToggleBtn.classList.add('z-controls__audit-toggle--active');
		} else {
			this._auditToggleBtn.classList.remove('z-controls__audit-toggle--active');
		}
	}

	// -----------------------------------------------------------------------
	// Drop zone setup
	// -----------------------------------------------------------------------

	/**
	 * Wire dragover/dragleave/drop listeners onto a well body.
	 */
	private _setupDropListeners(body: HTMLElement, wellId: WellId): void {
		body.addEventListener('dragover', (e: DragEvent) => {
			if (!e.dataTransfer?.types.includes(MIME_PROJECTION)) return;

			// Duplicate check: reject if field already in this well
			if (_dragField && this._isFieldInWell(_dragField, wellId)) {
				// Same-well reorder is allowed
				if (_dragSourceWell === wellId) {
					e.preventDefault();
					body.classList.add('projection-explorer__well--dragover');
				}
				// Cross-well duplicate: do not preventDefault (invalid drop)
				return;
			}

			e.preventDefault();
			body.classList.add('projection-explorer__well--dragover');
		});

		body.addEventListener('dragleave', () => {
			body.classList.remove('projection-explorer__well--dragover');
		});

		body.addEventListener('drop', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation(); // Prevent DnD collision with SuperGrid

			body.classList.remove('projection-explorer__well--dragover');

			const field = (e.dataTransfer?.getData(MIME_PROJECTION) as AxisField) ?? _dragField;
			if (!field) return;

			const sourceWell = _dragSourceWell;
			const sourceIndex = _dragIndex;

			// Clear drag state
			_dragSourceWell = null;
			_dragField = null;
			_dragIndex = null;

			if (!sourceWell) return;

			// WITHIN-WELL REORDER
			if (sourceWell === wellId) {
				this._handleWithinWellReorder(wellId, sourceIndex ?? 0, e, body);
				return;
			}

			// BETWEEN-WELL MOVE
			this._handleBetweenWellMove(field, sourceWell, wellId);
		});
	}

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

		if (wellId === 'x') {
			this._config.pafv.reorderColAxes(fromIndex, toIndex);
		} else if (wellId === 'y') {
			this._config.pafv.reorderRowAxes(fromIndex, toIndex);
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
		if (sourceWell === 'x' && colAxes.length <= 1) {
			this._config.actionToast.show('X axis requires at least one property');
			return;
		}
		if (sourceWell === 'y' && rowAxes.length <= 1) {
			this._config.actionToast.show('Y axis requires at least one property');
			return;
		}

		// Remove field from source well
		let needColUpdate = false;
		let needRowUpdate = false;

		if (sourceWell === 'x') {
			const idx = colAxes.findIndex((a) => a.field === field);
			if (idx >= 0) {
				colAxes.splice(idx, 1);
				needColUpdate = true;
			}
		} else if (sourceWell === 'y') {
			const idx = rowAxes.findIndex((a) => a.field === field);
			if (idx >= 0) {
				rowAxes.splice(idx, 1);
				needRowUpdate = true;
			}
		} else if (sourceWell === 'z') {
			const idx = this._zAxes.indexOf(field);
			if (idx >= 0) this._zAxes.splice(idx, 1);
		}
		// If source is 'available': nothing to remove (Available is derived)

		// Add field to target well
		if (targetWell === 'x') {
			colAxes.push({ field, direction: 'asc' });
			needColUpdate = true;
		} else if (targetWell === 'y') {
			rowAxes.push({ field, direction: 'asc' });
			needRowUpdate = true;
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
		switch (wellId) {
			case 'x':
				return state.colAxes.some((a) => a.field === field);
			case 'y':
				return state.rowAxes.some((a) => a.field === field);
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
