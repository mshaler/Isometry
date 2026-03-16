// Isometry v5 — Phase 55 Plan 02
// PropertiesExplorer: LATCH-grouped property catalog with toggles and inline rename.
//
// Requirements: PROP-01, PROP-03, PROP-04, PROP-05, INTG-03
//
// Design:
//   - Displays all 9 AxisField values grouped into 5 LATCH columns (L, A, T, C, H)
//   - Each column header is clickable to collapse/expand independently
//   - Per-property toggle checkbox enables/disables axis availability
//   - Single click on property name enters inline edit mode (span-to-input swap)
//   - D3 selection.join for property rows within each column body (INTG-03)
//   - Subscribable: external components react to toggle state changes

import { select } from 'd3-selection';
import type { AliasProvider } from '../providers/AliasProvider';
import { ALLOWED_AXIS_FIELDS } from '../providers/allowlist';
import type { FilterProvider } from '../providers/FilterProvider';
import type { LatchFamily } from '../providers/latch';
import { getLatchFamily, LATCH_LABELS, LATCH_ORDER, toFullName, toLetter } from '../providers/latch';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { AxisField } from '../providers/types';
import type { LatchFamily as SchemaLatchFamily } from '../worker/protocol';
import type { WorkerBridgeLike } from './LatchExplorers';
import '../styles/properties-explorer.css';
import { AppDialog } from './AppDialog';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PropertiesExplorerConfig {
	/** AliasProvider for display name persistence. */
	alias: AliasProvider;
	/** Container element (e.g., from WorkbenchShell.getSectionBody('properties')). */
	container: HTMLElement;
	/** Optional callback when total enabled count changes. */
	onCountChange?: (count: number) => void;
	/** Optional SchemaProvider for dynamic field discovery (DYNM-05). */
	schema?: SchemaProvider;
	/** Optional WorkerBridge for ui:set/ui:get persistence (UCFG-01). */
	bridge?: WorkerBridgeLike;
	/** Optional FilterProvider for clearing filters on field disable (UCFG-02). */
	filter?: FilterProvider;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ColumnState {
	family: LatchFamily;
	fields: AxisField[];
	headerEl: HTMLElement;
	bodyEl: HTMLElement;
	badgeEl: HTMLElement;
	chevronEl: HTMLElement;
	columnEl: HTMLElement;
}

// ---------------------------------------------------------------------------
// PropertiesExplorer
// ---------------------------------------------------------------------------

/**
 * PropertiesExplorer displays all available data properties grouped by
 * LATCH axis families in 5 columns, with per-property toggle checkboxes,
 * inline display name editing, and individually collapsible column headers.
 *
 * mount() creates the DOM structure.
 * update() re-renders all columns.
 * destroy() removes DOM and unsubscribes from providers.
 */
export class PropertiesExplorer {
	private readonly _config: PropertiesExplorerConfig;
	private _enabledFields: Set<AxisField>;
	private _columnCollapsed: Map<LatchFamily, boolean> = new Map();
	private _editingField: AxisField | null = null;
	private _subscribers: Set<() => void> = new Set();
	private _unsubAlias: (() => void) | null = null;
	private _unsubSchema: (() => void) | null = null;
	private _rootEl: HTMLElement | null = null;
	private _footerEl: HTMLElement | null = null;
	private _columns: ColumnState[] = [];

	// Track edit state to prevent double-commit on blur after Enter
	private _editCommitted = false;

	constructor(config: PropertiesExplorerConfig) {
		this._config = config;

		// All axis fields start enabled (dynamic or fallback)
		const initialFields = config.schema?.initialized
			? config.schema.getAxisColumns().map((c) => c.name as AxisField)
			: [...ALLOWED_AXIS_FIELDS];
		this._enabledFields = new Set(initialFields);

		// If schema has disabled fields already (restored from persistence), exclude them
		if (config.schema?.initialized) {
			for (const f of config.schema.getDisabledFields()) {
				this._enabledFields.delete(f as AxisField);
			}
		}

		// Restore per-column collapse state from localStorage
		for (const family of LATCH_ORDER) {
			const stored = localStorage.getItem(`workbench:prop-col-${family}`);
			this._columnCollapsed.set(family, stored === 'true');
		}
	}

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	/**
	 * Create DOM structure and append to container.
	 */
	mount(): void {
		const root = document.createElement('div');
		root.className = 'properties-explorer';

		const columnsContainer = document.createElement('div');
		columnsContainer.className = 'properties-explorer__columns';

		// Build LATCH columns
		for (const family of LATCH_ORDER) {
			const colState = this._createColumn(family);
			this._columns.push(colState);
			columnsContainer.appendChild(colState.columnEl);
		}

		root.appendChild(columnsContainer);
		this._rootEl = root;

		// Initial render of property rows via D3 selection.join
		this._renderColumns();

		// Subscribe to alias changes to re-render display names
		this._unsubAlias = this._config.alias.subscribe(() => {
			this._renderColumns();
		});

		// Subscribe to schema changes (override/disabled) — UCFG-01, UCFG-02
		if (this._config.schema) {
			this._unsubSchema = this._config.schema.subscribe(() => {
				this._rebuildColumnFields();
				this._renderColumns();
				this._renderFooter();
			});
		}

		// Footer with Reset/Enable buttons — UCFG-01, UCFG-02
		const footer = document.createElement('div');
		footer.className = 'properties-explorer__footer';

		const resetBtn = document.createElement('button');
		resetBtn.type = 'button';
		resetBtn.className = 'properties-explorer__footer-btn properties-explorer__reset-btn';
		resetBtn.textContent = 'Reset all LATCH mappings';
		resetBtn.addEventListener('click', () => {
			void this._handleResetAll();
		});

		const enableBtn = document.createElement('button');
		enableBtn.type = 'button';
		enableBtn.className = 'properties-explorer__footer-btn properties-explorer__enable-btn';
		enableBtn.textContent = 'Enable all';
		enableBtn.addEventListener('click', () => this._handleEnableAll());

		footer.appendChild(resetBtn);
		footer.appendChild(enableBtn);
		root.appendChild(footer);
		this._footerEl = footer;

		this._config.container.appendChild(root);

		// Initial footer visibility
		this._renderFooter();
	}

	/**
	 * Re-render all columns (called externally after provider state changes).
	 */
	update(): void {
		this._renderColumns();
	}

	/**
	 * Get the set of currently enabled AxisField values.
	 */
	getEnabledFields(): ReadonlySet<AxisField> {
		return this._enabledFields;
	}

	/**
	 * Subscribe to toggle state changes. Returns an unsubscribe function.
	 */
	subscribe(cb: () => void): () => void {
		this._subscribers.add(cb);
		return () => {
			this._subscribers.delete(cb);
		};
	}

	/**
	 * Remove DOM and clean up subscriptions.
	 */
	destroy(): void {
		if (this._unsubAlias) {
			this._unsubAlias();
			this._unsubAlias = null;
		}

		if (this._unsubSchema) {
			this._unsubSchema();
			this._unsubSchema = null;
		}

		if (this._rootEl) {
			this._rootEl.remove();
			this._rootEl = null;
		}

		this._columns = [];
		this._footerEl = null;
		this._subscribers.clear();
		this._editingField = null;
	}

	// -----------------------------------------------------------------------
	// Private — Column creation
	// -----------------------------------------------------------------------

	/**
	 * Create a single LATCH column with header (chevron + label + badge) and body.
	 */
	private _createColumn(family: LatchFamily): ColumnState {
		// Determine which fields belong to this family
		const fields: AxisField[] = [];
		const allFields: AxisField[] = this._config.schema?.initialized
			? this._config.schema.getAxisColumns().map((c) => c.name as AxisField)
			: [...ALLOWED_AXIS_FIELDS];
		for (const f of allFields) {
			if (getLatchFamily(f) === family) {
				fields.push(f);
			}
		}

		// Column root
		const columnEl = document.createElement('div');
		columnEl.className = 'properties-explorer__column';
		columnEl.setAttribute('data-family', family);

		if (this._columnCollapsed.get(family)) {
			columnEl.classList.add('properties-explorer__column--collapsed');
		}

		// Header
		const headerEl = document.createElement('div');
		headerEl.className = 'properties-explorer__column-header';
		headerEl.setAttribute('data-family', family);

		const chevronEl = document.createElement('span');
		chevronEl.className = 'properties-explorer__chevron';
		chevronEl.textContent = this._columnCollapsed.get(family) ? '\u25B8' : '\u25BE';

		const labelEl = document.createElement('span');
		labelEl.textContent = LATCH_LABELS[family];

		const badgeEl = document.createElement('span');
		badgeEl.className = 'properties-explorer__badge';

		headerEl.appendChild(chevronEl);
		headerEl.appendChild(labelEl);
		headerEl.appendChild(badgeEl);

		// Header click toggles collapse
		headerEl.addEventListener('click', () => {
			this._toggleColumn(family);
		});

		// Body
		const bodyEl = document.createElement('div');
		bodyEl.className = 'properties-explorer__column-body';

		// Empty state for columns with 0 fields
		if (fields.length === 0) {
			const emptyEl = document.createElement('div');
			emptyEl.className = 'properties-explorer__empty';
			emptyEl.textContent = 'No properties';
			bodyEl.appendChild(emptyEl);
		}

		columnEl.appendChild(headerEl);
		columnEl.appendChild(bodyEl);

		return { family, fields, headerEl, bodyEl, badgeEl, chevronEl, columnEl };
	}

	// -----------------------------------------------------------------------
	// Private — Column toggle
	// -----------------------------------------------------------------------

	private _toggleColumn(family: LatchFamily): void {
		const collapsed = !this._columnCollapsed.get(family);
		this._columnCollapsed.set(family, collapsed);
		localStorage.setItem(`workbench:prop-col-${family}`, String(collapsed));

		const col = this._columns.find((c) => c.family === family);
		if (!col) return;

		if (collapsed) {
			col.columnEl.classList.add('properties-explorer__column--collapsed');
			col.chevronEl.textContent = '\u25B8'; // right arrow
		} else {
			col.columnEl.classList.remove('properties-explorer__column--collapsed');
			col.chevronEl.textContent = '\u25BE'; // down arrow
		}
	}

	// -----------------------------------------------------------------------
	// Private — Render via D3 selection.join (INTG-03)
	// -----------------------------------------------------------------------

	/**
	 * Render property rows in each column using D3 selection.join.
	 * Updates badges and fires onCountChange callback.
	 */
	private _renderColumns(): void {
		for (const col of this._columns) {
			this._renderColumnProperties(col);
		}

		// Fire onCountChange with total enabled count
		if (this._config.onCountChange) {
			this._config.onCountChange(this._enabledFields.size);
		}
	}

	/**
	 * Render property rows for a single column using D3 selection.join.
	 */
	private _renderColumnProperties(col: ColumnState): void {
		const { fields, bodyEl, badgeEl } = col;

		// Update badge: "(enabled/total)"
		if (fields.length === 0) {
			badgeEl.textContent = '(0/0)';
		} else {
			const enabledCount = fields.filter((f) => this._enabledFields.has(f)).length;
			badgeEl.textContent = `(${enabledCount}/${fields.length})`;
		}

		// Skip D3 join for columns with no fields (empty state already rendered)
		if (fields.length === 0) return;

		// D3 selection.join for property rows (INTG-03)
		const self = this;
		select(bodyEl)
			.selectAll<HTMLDivElement, AxisField>('.properties-explorer__property')
			.data(fields, (d: AxisField) => d)
			.join(
				(enter) =>
					enter.append('div').each(function (field: AxisField) {
						const row = this as HTMLDivElement;
						row.className = 'properties-explorer__property';
						row.setAttribute('data-field', field);

						if (!self._enabledFields.has(field)) {
							row.classList.add('properties-explorer__property--disabled');
						}

						// Disabled greyed-out styling
						const isDisabled = self._config.schema?.getDisabledFields().has(field) ?? false;
						row.classList.toggle('properties-explorer__row--disabled', isDisabled);

						// Checkbox
						const checkbox = document.createElement('input');
						checkbox.type = 'checkbox';
						checkbox.checked = self._enabledFields.has(field);
						checkbox.addEventListener('change', () => {
							self._handleToggle(field);
						});
						row.appendChild(checkbox);

						// LATCH chip badge with dropdown
						row.appendChild(self._createLatchChip(field));

						// Name span
						const nameSpan = document.createElement('span');
						nameSpan.className = 'properties-explorer__property-name';
						nameSpan.textContent = self._config.alias.getAlias(field);
						nameSpan.addEventListener('click', () => {
							self._handleNameClick(field, row);
						});
						row.appendChild(nameSpan);
					}),
				(update) =>
					update.each(function (field: AxisField) {
						const row = this as HTMLDivElement;

						// Sync disabled class
						if (self._enabledFields.has(field)) {
							row.classList.remove('properties-explorer__property--disabled');
						} else {
							row.classList.add('properties-explorer__property--disabled');
						}

						// Disabled greyed-out styling
						const isDisabled = self._config.schema?.getDisabledFields().has(field) ?? false;
						row.classList.toggle('properties-explorer__row--disabled', isDisabled);

						// If not currently editing this field, rebuild row content
						if (self._editingField !== field) {
							// Clear row and rebuild (handles transition from edit mode back to display)
							row.textContent = '';

							// Checkbox
							const checkbox = document.createElement('input');
							checkbox.type = 'checkbox';
							checkbox.checked = self._enabledFields.has(field);
							checkbox.addEventListener('change', () => {
								self._handleToggle(field);
							});
							row.appendChild(checkbox);

							// LATCH chip badge with dropdown
							row.appendChild(self._createLatchChip(field));

							// Name span
							const nameSpan = document.createElement('span');
							nameSpan.className = 'properties-explorer__property-name';
							nameSpan.textContent = self._config.alias.getAlias(field);
							nameSpan.addEventListener('click', () => {
								self._handleNameClick(field, row);
							});
							row.appendChild(nameSpan);
						}
					}),
				(exit) => exit.remove(),
			);
	}

	// -----------------------------------------------------------------------
	// Private — Footer rendering + handlers (UCFG-01, UCFG-02)
	// -----------------------------------------------------------------------

	/**
	 * Show/hide footer buttons based on override/disabled state.
	 * Reset button visible only when overrides exist.
	 * Enable button visible only when disabled fields exist.
	 */
	private _renderFooter(): void {
		if (!this._footerEl) return;
		const resetBtn = this._footerEl.querySelector('.properties-explorer__reset-btn') as HTMLElement | null;
		const enableBtn = this._footerEl.querySelector('.properties-explorer__enable-btn') as HTMLElement | null;
		if (resetBtn) {
			resetBtn.style.display = this._config.schema?.hasAnyOverride() ? '' : 'none';
		}
		if (enableBtn) {
			enableBtn.style.display = this._config.schema?.hasAnyDisabled() ? '' : 'none';
		}
	}

	/**
	 * Reset all LATCH family overrides to defaults with confirmation dialog.
	 */
	private async _handleResetAll(): Promise<void> {
		const count = this._config.schema?.getOverrides().size ?? 0;
		if (count === 0) return;
		const confirmed = await AppDialog.show({
			variant: 'confirm',
			title: 'Reset Mappings',
			message: `Reset ${count} custom mapping${count > 1 ? 's' : ''} to defaults?`,
			confirmLabel: 'Reset',
		});
		if (!confirmed) return;
		this._config.schema!.setOverrides(new Map());
		void this._persistOverrides();
	}

	/**
	 * Re-enable all disabled fields.
	 */
	private _handleEnableAll(): void {
		this._config.schema?.setDisabled(new Set());
		// Re-enable all fields in local set
		if (this._config.schema?.initialized) {
			for (const c of this._config.schema.getAxisColumns()) {
				this._enabledFields.add(c.name as AxisField);
			}
		}
		void this._persistDisabled();
		this._renderColumns();
		for (const cb of this._subscribers) cb();
	}

	// -----------------------------------------------------------------------
	// Private — Rebuild column fields from SchemaProvider (UCFG-01)
	// -----------------------------------------------------------------------

	/**
	 * Re-derive which fields belong to each LATCH column.
	 * CRITICAL: Uses getAllAxisColumns() (NOT getAxisColumns()) so that disabled
	 * fields remain visible in their LATCH column with greyed-out styling.
	 */
	private _rebuildColumnFields(): void {
		const allFields: AxisField[] = this._config.schema?.initialized
			? (this._config.schema.getAllAxisColumns().map((c) => c.name) as AxisField[])
			: [...ALLOWED_AXIS_FIELDS];

		for (const col of this._columns) {
			// getAllAxisColumns() returns override-applied latchFamily — use it for grouping
			if (this._config.schema?.initialized) {
				const allCols = this._config.schema.getAllAxisColumns();
				col.fields = allCols.filter((c) => toLetter(c.latchFamily) === col.family).map((c) => c.name as AxisField);
			} else {
				col.fields = allFields.filter((f) => getLatchFamily(f) === col.family);
			}

			// Update empty state
			const emptyEl = col.bodyEl.querySelector('.properties-explorer__empty');
			if (col.fields.length === 0 && !emptyEl) {
				const e = document.createElement('div');
				e.className = 'properties-explorer__empty';
				e.textContent = 'No properties';
				col.bodyEl.appendChild(e);
			} else if (col.fields.length > 0 && emptyEl) {
				emptyEl.remove();
			}
		}

		// Sync _enabledFields set from SchemaProvider disabled state
		if (this._config.schema?.initialized) {
			const disabled = this._config.schema.getDisabledFields();
			const allCols = this._config.schema.getAllAxisColumns();
			for (const c of allCols) {
				if (!disabled.has(c.name)) {
					this._enabledFields.add(c.name as AxisField);
				}
			}
			for (const f of disabled) {
				this._enabledFields.delete(f as AxisField);
			}
		}
	}

	// -----------------------------------------------------------------------
	// Private — Toggle handling
	// -----------------------------------------------------------------------

	private _handleToggle(field: AxisField): void {
		if (this._enabledFields.has(field)) {
			this._enabledFields.delete(field);
			// Sync to SchemaProvider disabled set
			if (this._config.schema) {
				const disabled = new Set(this._config.schema.getDisabledFields());
				disabled.add(field);
				this._config.schema.setDisabled(disabled);
			}
			// Clear active filters for this field
			if (this._config.filter) {
				const filters = this._config.filter.getFilters();
				for (let i = filters.length - 1; i >= 0; i--) {
					if (filters[i]!.field === field) this._config.filter.removeFilter(i);
				}
				this._config.filter.clearRangeFilter(field);
				if (this._config.filter.hasAxisFilter(field)) {
					this._config.filter.setAxisFilter(field, []);
				}
			}
			void this._persistDisabled();
		} else {
			this._enabledFields.add(field);
			if (this._config.schema) {
				const disabled = new Set(this._config.schema.getDisabledFields());
				disabled.delete(field);
				this._config.schema.setDisabled(disabled);
			}
			void this._persistDisabled();
		}

		this._renderColumns();

		// Fire subscribers synchronously
		for (const cb of this._subscribers) {
			cb();
		}
	}

	// -----------------------------------------------------------------------
	// Private — LATCH chip badge + family change (UCFG-01)
	// -----------------------------------------------------------------------

	/**
	 * Create a LATCH chip badge with a <select> dropdown for family reassignment.
	 */
	private _createLatchChip(field: AxisField): HTMLElement {
		const chip = document.createElement('span');
		chip.className = 'prop-latch-chip';

		const sel = document.createElement('select');
		sel.className = 'prop-latch-chip__select';

		const heuristicFamily = this._config.schema?.getHeuristicFamily(field);
		const effectiveFamily = this._config.schema?.initialized
			? toLetter(
					this._config.schema.getLatchOverride(field) ?? this._config.schema.getHeuristicFamily(field) ?? 'Alphabet',
				)
			: getLatchFamily(field);
		const hasOverride = this._config.schema?.getLatchOverride(field) !== undefined;

		// Add 5 LATCH family options
		for (const letter of LATCH_ORDER) {
			const opt = document.createElement('option');
			const fullName = toFullName(letter);
			opt.value = fullName;
			const isDefault = heuristicFamily ? toLetter(heuristicFamily) === letter : getLatchFamily(field) === letter;
			opt.textContent = `[${letter}]${isDefault ? ' (default)' : ''}`;
			if (letter === effectiveFamily) {
				opt.selected = true;
			}
			sel.appendChild(opt);
		}

		if (hasOverride) {
			chip.setAttribute('data-overridden', 'true');
		}

		sel.addEventListener('change', () => {
			this._handleFamilyChange(field, sel.value as SchemaLatchFamily);
		});

		chip.appendChild(sel);
		return chip;
	}

	/**
	 * Handle LATCH family reassignment from chip dropdown.
	 */
	private _handleFamilyChange(field: AxisField, newFamily: SchemaLatchFamily): void {
		if (!this._config.schema) return;

		const heuristic = this._config.schema.getHeuristicFamily(field);
		const overrides = new Map(this._config.schema.getOverrides());

		if (heuristic === newFamily) {
			// Selecting default: clear override
			overrides.delete(field);
		} else {
			overrides.set(field, newFamily);
		}

		this._config.schema.setOverrides(overrides);
		void this._persistOverrides();
	}

	// -----------------------------------------------------------------------
	// Private — Persistence helpers (UCFG-01, UCFG-02)
	// -----------------------------------------------------------------------

	private async _persistOverrides(): Promise<void> {
		if (!this._config.bridge || !this._config.schema) return;
		const record: Record<string, string> = {};
		for (const [field, family] of this._config.schema.getOverrides()) {
			record[field] = family;
		}
		await this._config.bridge.send('ui:set', {
			key: 'latch:overrides',
			value: JSON.stringify(record),
		});
	}

	private async _persistDisabled(): Promise<void> {
		if (!this._config.bridge || !this._config.schema) return;
		const arr = [...this._config.schema.getDisabledFields()];
		await this._config.bridge.send('ui:set', {
			key: 'latch:disabled',
			value: JSON.stringify(arr),
		});
	}

	// -----------------------------------------------------------------------
	// Private — Inline rename
	// -----------------------------------------------------------------------

	/**
	 * Enter inline edit mode: swap name span for input + clear button.
	 */
	private _handleNameClick(field: AxisField, row: HTMLElement): void {
		// If already editing another field, commit that edit first
		if (this._editingField && this._editingField !== field) {
			this._commitCurrentEdit();
		}

		this._editingField = field;
		this._editCommitted = false;

		const currentAlias = this._config.alias.getAlias(field);

		// Remove the name span
		const nameSpan = row.querySelector('.properties-explorer__property-name');
		if (nameSpan) {
			nameSpan.remove();
		}

		// Create edit container
		const editContainer = document.createElement('span');
		editContainer.className = 'properties-explorer__edit-container';
		editContainer.style.display = 'flex';
		editContainer.style.alignItems = 'center';
		editContainer.style.gap = '2px';
		editContainer.style.flex = '1';

		// Input
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'properties-explorer__edit-input';
		input.value = currentAlias;

		// Clear/reset button
		const clearBtn = document.createElement('button');
		clearBtn.className = 'properties-explorer__clear-btn';
		clearBtn.textContent = '\u00D7'; // multiplication sign (x)
		clearBtn.title = 'Reset to original name';
		clearBtn.type = 'button';

		editContainer.appendChild(input);
		editContainer.appendChild(clearBtn);
		row.appendChild(editContainer);

		// Focus and select all text
		input.focus();
		input.select();

		// Keydown listener
		input.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this._commitEdit(field, input.value);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this._cancelEdit(field);
			}
		});

		// Blur listener — confirms edit
		input.addEventListener('blur', () => {
			// Only commit if not already committed (prevents double-commit after Enter)
			if (!this._editCommitted && this._editingField === field) {
				this._commitEdit(field, input.value);
			}
		});

		// Clear button click
		clearBtn.addEventListener('click', (e: Event) => {
			e.stopPropagation();
			this._editCommitted = true;
			this._editingField = null;
			this._config.alias.clearAlias(field);
			this._renderColumns();
		});
	}

	/**
	 * Commit the current edit for the given field.
	 */
	private _commitEdit(field: AxisField, value: string): void {
		if (this._editCommitted) return;
		this._editCommitted = true;
		this._editingField = null;

		const trimmed = value.trim();
		if (trimmed && trimmed !== field) {
			this._config.alias.setAlias(field, trimmed);
		} else {
			// Empty or same as original field name: clear alias
			this._config.alias.clearAlias(field);
		}

		this._renderColumns();
	}

	/**
	 * Cancel the current edit (Escape key).
	 */
	private _cancelEdit(_field: AxisField): void {
		this._editCommitted = true;
		this._editingField = null;
		this._renderColumns();
	}

	/**
	 * Commit the currently active edit (if any) before switching to a new field.
	 */
	private _commitCurrentEdit(): void {
		if (!this._editingField) return;

		const row = this._rootEl?.querySelector(`.properties-explorer__property[data-field="${this._editingField}"]`);
		if (!row) return;

		const input = row.querySelector('.properties-explorer__edit-input') as HTMLInputElement | null;
		if (input) {
			this._commitEdit(this._editingField, input.value);
		}
	}
}
