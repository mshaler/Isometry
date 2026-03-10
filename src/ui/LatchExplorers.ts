// Isometry v5 — Phase 67
// LatchExplorers: LATCH axis filter sections with mount/update/destroy lifecycle.
//
// Requirements: LTCH-01, LTCH-02, LTPB-03, LTPB-04
//
// Design:
//   - 5 CollapsibleSection sub-sections (L, A, T, C, H) inside .latch-explorers root
//   - Location (L): empty state placeholder
//   - Alphabet (A): text search input with 300ms debounce -> FilterProvider.addFilter({contains})
//   - Time (T): preset range buttons (Today, This Week, This Month, This Year) -> FilterProvider.addFilter({gte/lte})
//   - Category (C): chip pills for folder, status, card_type -> FilterProvider.setAxisFilter()
//   - Hierarchy (H): chip pills for priority, sort_order -> FilterProvider.setAxisFilter()
//   - Count badges update reactively via FilterProvider.subscribe()
//   - "Clear all" button visible only when filters active
//   - Coordinator subscription sets dirty flag for lazy distinct value + count re-fetch

import '../styles/latch-explorers.css';

import * as d3 from 'd3';
import type { FilterProvider } from '../providers/FilterProvider';
import { LATCH_LABELS, LATCH_ORDER, type LatchFamily } from '../providers/latch';
import type { AxisField, Filter, FilterField } from '../providers/types';
import { CollapsibleSection } from './CollapsibleSection';
import { HistogramScrubber } from './HistogramScrubber';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Narrow interface for StateCoordinator — only needs subscribe. */
export interface StateCoordinatorLike {
	subscribe(cb: () => void): () => void;
}

/** Narrow interface for WorkerBridge — only needs send. */
export interface WorkerBridgeLike {
	send(type: string, payload: unknown): Promise<unknown>;
}

export interface LatchExplorersConfig {
	filter: FilterProvider;
	bridge: WorkerBridgeLike;
	coordinator: StateCoordinatorLike;
}

// ---------------------------------------------------------------------------
// LATCH family -> fields mapping
// ---------------------------------------------------------------------------

const CATEGORY_FIELDS: AxisField[] = ['folder', 'status', 'card_type'];
const HIERARCHY_FIELDS: AxisField[] = ['priority', 'sort_order'];
const TIME_FIELDS: AxisField[] = ['created_at', 'modified_at', 'due_at'];

const TIME_PRESETS = ['Today', 'This Week', 'This Month', 'This Year'] as const;
type TimePreset = (typeof TIME_PRESETS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldDisplayName(field: string): string {
	return field
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function computeRange(preset: TimePreset): { start: string; end: string } {
	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	switch (preset) {
		case 'Today':
			return {
				start: startOfDay.toISOString(),
				end: new Date(startOfDay.getTime() + 86400000).toISOString(),
			};
		case 'This Week': {
			const dayOfWeek = startOfDay.getDay();
			const weekStart = new Date(startOfDay.getTime() - dayOfWeek * 86400000);
			return {
				start: weekStart.toISOString(),
				end: new Date(weekStart.getTime() + 7 * 86400000).toISOString(),
			};
		}
		case 'This Month': {
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
			return {
				start: monthStart.toISOString(),
				end: nextMonthStart.toISOString(),
			};
		}
		case 'This Year': {
			const yearStart = new Date(now.getFullYear(), 0, 1);
			const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
			return {
				start: yearStart.toISOString(),
				end: nextYearStart.toISOString(),
			};
		}
	}
}

/** Chip datum for category/hierarchy chip pills. */
interface ChipDatum {
	value: string;
	count: number;
}

async function fetchDistinctValuesWithCounts(bridge: WorkerBridgeLike, field: string): Promise<ChipDatum[]> {
	const result = (await bridge.send('db:query', {
		sql: `SELECT ${field}, COUNT(*) AS count FROM cards WHERE deleted_at IS NULL AND ${field} IS NOT NULL GROUP BY ${field} ORDER BY ${field}`,
		params: [],
	})) as { rows: Record<string, unknown>[] };
	const rows = result.rows ?? [];
	return rows
		.map((r) => ({
			value: String(r[field] ?? ''),
			count: Number(r['count'] ?? 0),
		}))
		.filter((d) => d.value !== '');
}

// ---------------------------------------------------------------------------
// LatchExplorers
// ---------------------------------------------------------------------------

export class LatchExplorers {
	private readonly _config: LatchExplorersConfig;
	private _rootEl: HTMLElement | null = null;
	private _clearAllBtn: HTMLElement | null = null;
	private _sections: CollapsibleSection[] = [];
	private _unsubFilter: (() => void) | null = null;
	private _unsubCoordinator: (() => void) | null = null;
	private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private _valuesDirty = true;

	// Per-field state for chip pill lists (Phase 67)
	private _chipContainers = new Map<string, HTMLElement>();

	// Per-field active preset tracking for time sections
	private _activePresets = new Map<string, TimePreset | null>();

	// Per-field histogram scrubbers (Phase 66)
	private _histograms = new Map<string, HistogramScrubber>();

	constructor(config: LatchExplorersConfig) {
		this._config = config;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	mount(container: HTMLElement): void {
		const { filter, coordinator } = this._config;

		// Root element
		const root = document.createElement('div');
		root.className = 'latch-explorers';
		this._rootEl = root;

		// "Clear all" button
		const clearAllBtn = document.createElement('button');
		clearAllBtn.className = 'latch-explorers__clear-all';
		clearAllBtn.textContent = 'Clear all';
		clearAllBtn.type = 'button';
		clearAllBtn.style.display = 'none';
		clearAllBtn.addEventListener('click', () => this._handleClearAll());
		this._clearAllBtn = clearAllBtn;
		root.appendChild(clearAllBtn);

		// Create 5 CollapsibleSection sub-sections
		for (const family of LATCH_ORDER) {
			const section = new CollapsibleSection({
				title: LATCH_LABELS[family],
				icon: '',
				storageKey: `latch-${family}`,
				defaultCollapsed: family === 'L',
			});
			section.mount(root);
			this._sections.push(section);

			const body = section.getBodyEl();
			if (!body) continue;

			this._populateFamilyBody(family, body);
		}

		container.appendChild(root);

		// Subscribe to FilterProvider for reactive badge + clear button updates
		this._unsubFilter = filter.subscribe(() => this._onFilterChange());

		// Subscribe to coordinator for data changes — self-driving update.
		// The coordinator fires ~16ms after any registered provider change
		// (imports, sync, mutations). Setting dirty + calling update() ensures
		// both chip values AND histogram scrubbers re-fetch.
		this._unsubCoordinator = coordinator.subscribe(() => {
			this._valuesDirty = true;
			this.update();
		});

		// Fetch initial distinct values
		void this._fetchAllDistinctValues();
	}

	update(): void {
		if (this._valuesDirty) {
			this._valuesDirty = false;
			void this._fetchAllDistinctValues();
			this._histograms.forEach((h) => h.update());
		}
	}

	destroy(): void {
		// Unsubscribe from providers
		if (this._unsubFilter) {
			this._unsubFilter();
			this._unsubFilter = null;
		}
		if (this._unsubCoordinator) {
			this._unsubCoordinator();
			this._unsubCoordinator = null;
		}

		// Clear debounce timer
		if (this._debounceTimer !== null) {
			clearTimeout(this._debounceTimer);
			this._debounceTimer = null;
		}

		// Destroy all histogram scrubbers
		this._histograms.forEach((h) => h.destroy());
		this._histograms.clear();

		// Destroy all CollapsibleSections
		for (const section of this._sections) {
			section.destroy();
		}
		this._sections = [];
		this._chipContainers.clear();
		this._activePresets.clear();

		// Remove root from DOM
		if (this._rootEl) {
			this._rootEl.remove();
			this._rootEl = null;
		}
		this._clearAllBtn = null;
	}

	// ---------------------------------------------------------------------------
	// Family-specific body population
	// ---------------------------------------------------------------------------

	private _populateFamilyBody(family: LatchFamily, body: HTMLElement): void {
		switch (family) {
			case 'L':
				this._populateLocation(body);
				break;
			case 'A':
				this._populateAlphabet(body);
				break;
			case 'T':
				this._populateTime(body);
				break;
			case 'C':
				this._populateCategory(body);
				break;
			case 'H':
				this._populateHierarchy(body);
				break;
		}
	}

	private _populateLocation(body: HTMLElement): void {
		const empty = document.createElement('div');
		empty.className = 'latch-empty';
		empty.textContent = 'No location properties available';
		body.appendChild(empty);
	}

	private _populateAlphabet(body: HTMLElement): void {
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'latch-search-input';
		input.placeholder = 'Filter by name...';
		input.addEventListener('input', () => {
			if (this._debounceTimer !== null) {
				clearTimeout(this._debounceTimer);
			}
			this._debounceTimer = setTimeout(() => {
				this._handleSearchInput(input.value);
				this._debounceTimer = null;
			}, 300);
		});
		body.appendChild(input);
	}

	private _populateTime(body: HTMLElement): void {
		for (const field of TIME_FIELDS) {
			this._activePresets.set(field, null);
			const group = document.createElement('div');
			group.className = 'latch-field-group';

			const label = document.createElement('div');
			label.className = 'latch-field-label';
			label.textContent = fieldDisplayName(field);
			group.appendChild(label);

			const presetsContainer = document.createElement('div');
			presetsContainer.className = 'latch-time-presets';

			for (const preset of TIME_PRESETS) {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'latch-time-preset';
				btn.textContent = preset;
				btn.dataset['field'] = field;
				btn.dataset['preset'] = preset;
				btn.addEventListener('click', () => this._handleTimePresetClick(field, preset, presetsContainer));
				presetsContainer.appendChild(btn);
			}

			group.appendChild(presetsContainer);

			// Phase 66: mount histogram scrubber after presets
			const histogram = new HistogramScrubber({
				field,
				fieldType: 'date',
				filter: this._config.filter,
				bridge: this._config.bridge,
				bins: 12,
			});
			histogram.mount(group);
			this._histograms.set(field, histogram);

			body.appendChild(group);
		}
	}

	private _populateCategory(body: HTMLElement): void {
		for (const field of CATEGORY_FIELDS) {
			this._createChipGroup(body, field);
		}
	}

	private _populateHierarchy(body: HTMLElement): void {
		for (const field of HIERARCHY_FIELDS) {
			this._createChipGroup(body, field);

			// Phase 66: mount histogram scrubber after chip group
			// The chip group was just appended as last child of body
			const group = body.lastElementChild as HTMLElement | null;
			if (group) {
				const histogram = new HistogramScrubber({
					field,
					fieldType: 'numeric',
					filter: this._config.filter,
					bridge: this._config.bridge,
					bins: 10,
				});
				histogram.mount(group);
				this._histograms.set(field, histogram);
			}
		}
	}

	private _createChipGroup(body: HTMLElement, field: AxisField): void {
		const group = document.createElement('div');
		group.className = 'latch-field-group';

		const label = document.createElement('div');
		label.className = 'latch-field-label';
		label.textContent = fieldDisplayName(field);
		group.appendChild(label);

		const chipContainer = document.createElement('div');
		chipContainer.className = 'latch-chip-list';
		chipContainer.dataset['field'] = field;
		group.appendChild(chipContainer);

		this._chipContainers.set(field, chipContainer);
		body.appendChild(group);
	}

	// ---------------------------------------------------------------------------
	// Chip rendering via D3 selection.join (Phase 67)
	// ---------------------------------------------------------------------------

	private _renderChips(field: string, chips: ChipDatum[]): void {
		const containerEl = this._chipContainers.get(field);
		if (!containerEl) return;

		const activeValues = this._config.filter.getAxisFilter(field);

		d3.select(containerEl)
			.selectAll<HTMLButtonElement, ChipDatum>('.latch-chip')
			.data(chips, (d) => d.value)
			.join(
				(enter) =>
					enter
						.append('button')
						.attr('type', 'button')
						.attr('class', (d) => (activeValues.includes(d.value) ? 'latch-chip latch-chip--active' : 'latch-chip'))
						.each(function (d) {
							// Label span
							const labelSpan = document.createElement('span');
							labelSpan.className = 'latch-chip__label';
							labelSpan.textContent = d.value;
							this.appendChild(labelSpan);
							// Count span
							const countSpan = document.createElement('span');
							countSpan.className = 'latch-chip__count';
							countSpan.textContent = String(d.count);
							this.appendChild(countSpan);
						})
						.on('click', (_event, d) => this._handleChipClick(field as FilterField, d.value)),
				(update) =>
					update
						.attr('class', (d) => (activeValues.includes(d.value) ? 'latch-chip latch-chip--active' : 'latch-chip'))
						.each(function (d) {
							const countSpan = this.querySelector('.latch-chip__count');
							if (countSpan) countSpan.textContent = String(d.count);
						}),
				(exit) => exit.remove(),
			);
	}

	// ---------------------------------------------------------------------------
	// Event handlers
	// ---------------------------------------------------------------------------

	private _handleSearchInput(value: string): void {
		const { filter } = this._config;

		// Remove any existing name contains filter (reverse iteration for index stability)
		const filters = filter.getFilters();
		for (let i = filters.length - 1; i >= 0; i--) {
			if (filters[i]!.field === 'name' && filters[i]!.operator === 'contains') {
				filter.removeFilter(i);
			}
		}

		// Add new filter if non-empty
		if (value.trim() !== '') {
			filter.addFilter({ field: 'name', operator: 'contains', value: value.trim() });
		}
	}

	private _handleChipClick(field: FilterField, value: string): void {
		const { filter } = this._config;
		const current = filter.getAxisFilter(field);
		const idx = current.indexOf(value);
		if (idx >= 0) {
			// Toggle off — remove value from array
			const next = [...current];
			next.splice(idx, 1);
			filter.setAxisFilter(field, next);
		} else {
			// Toggle on — add value to array
			filter.setAxisFilter(field, [...current, value]);
		}
	}

	private _handleTimePresetClick(field: string, preset: TimePreset, presetsContainer: HTMLElement): void {
		const { filter } = this._config;
		const currentActive = this._activePresets.get(field);

		// Remove any existing gte/lte filters for this field (reverse iteration)
		const filters = filter.getFilters();
		for (let i = filters.length - 1; i >= 0; i--) {
			const f = filters[i]!;
			if (f.field === field && (f.operator === 'gte' || f.operator === 'lte')) {
				filter.removeFilter(i);
			}
		}

		// Toggle off if clicking the already-active preset
		if (currentActive === preset) {
			this._activePresets.set(field, null);
			this._updateTimePresetUI(presetsContainer, field);
			return;
		}

		// Compute and apply new range
		const range = computeRange(preset);
		filter.addFilter({ field: field as FilterField, operator: 'gte', value: range.start });
		filter.addFilter({ field: field as FilterField, operator: 'lte', value: range.end });
		this._activePresets.set(field, preset);
		this._updateTimePresetUI(presetsContainer, field);
	}

	private _updateTimePresetUI(presetsContainer: HTMLElement, field: string): void {
		const active = this._activePresets.get(field);
		const buttons = presetsContainer.querySelectorAll<HTMLButtonElement>('.latch-time-preset');
		for (const btn of buttons) {
			if (btn.dataset['preset'] === active) {
				btn.classList.add('latch-time-preset--active');
			} else {
				btn.classList.remove('latch-time-preset--active');
			}
		}
	}

	private _handleClearAll(): void {
		const { filter } = this._config;

		// Clear all axis filters (chip-based)
		filter.clearAllAxisFilters();

		// Remove all time range filters (gte/lte on time fields)
		const filters = filter.getFilters();
		for (let i = filters.length - 1; i >= 0; i--) {
			const f = filters[i]!;
			if (TIME_FIELDS.includes(f.field as AxisField) && (f.operator === 'gte' || f.operator === 'lte')) {
				filter.removeFilter(i);
			}
		}

		// Remove name contains filters
		const updatedFilters = filter.getFilters();
		for (let i = updatedFilters.length - 1; i >= 0; i--) {
			if (updatedFilters[i]!.field === 'name' && updatedFilters[i]!.operator === 'contains') {
				filter.removeFilter(i);
			}
		}

		// Phase 66: clear all histogram brush selections and range filters
		this._histograms.forEach((h) => h.clearBrush());
		for (const field of [...TIME_FIELDS, ...HIERARCHY_FIELDS]) {
			filter.clearRangeFilter(field);
		}

		// Reset active presets
		for (const field of TIME_FIELDS) {
			this._activePresets.set(field, null);
		}

		// Clear search input
		const searchInput = this._rootEl?.querySelector('.latch-search-input') as HTMLInputElement | null;
		if (searchInput) searchInput.value = '';
	}

	// ---------------------------------------------------------------------------
	// Filter subscription callback
	// ---------------------------------------------------------------------------

	private _onFilterChange(): void {
		this._updateBadgeCounts();
		this._updateClearAllVisibility();
		this._syncChipStates();
		this._syncTimePresetStates();
	}

	private _updateBadgeCounts(): void {
		const { filter } = this._config;
		const filters = filter.getFilters();

		for (let i = 0; i < LATCH_ORDER.length; i++) {
			const family = LATCH_ORDER[i]!;
			const section = this._sections[i];
			if (!section) continue;

			const count = this._computeFamilyFilterCount(family, filter, filters);
			section.setCount(count);
		}
	}

	private _computeFamilyFilterCount(family: LatchFamily, filter: FilterProvider, filters: readonly Filter[]): number {
		switch (family) {
			case 'L':
				return 0;
			case 'A': {
				// Count name contains filters
				return filters.some((f) => f.field === 'name' && f.operator === 'contains') ? 1 : 0;
			}
			case 'T': {
				// Count time fields that have gte/lte filters or range filters
				let count = 0;
				for (const field of TIME_FIELDS) {
					const hasPreset = filters.some((f) => f.field === field && (f.operator === 'gte' || f.operator === 'lte'));
					const hasRange = filter.hasRangeFilter(field);
					if (hasPreset || hasRange) count++;
				}
				return count;
			}
			case 'C': {
				// Count category fields with active axis filters
				let count = 0;
				for (const field of CATEGORY_FIELDS) {
					if (filter.hasAxisFilter(field)) count++;
				}
				return count;
			}
			case 'H': {
				// Count hierarchy fields with active axis filters or range filters
				let count = 0;
				for (const field of HIERARCHY_FIELDS) {
					if (filter.hasAxisFilter(field) || filter.hasRangeFilter(field)) count++;
				}
				return count;
			}
		}
	}

	private _updateClearAllVisibility(): void {
		if (!this._clearAllBtn) return;
		const { filter } = this._config;
		const filters = filter.getFilters();

		const hasAxisFilters = [...CATEGORY_FIELDS, ...HIERARCHY_FIELDS].some((f) => filter.hasAxisFilter(f));
		const hasTimeFilters = filters.some(
			(f) => TIME_FIELDS.includes(f.field as AxisField) && (f.operator === 'gte' || f.operator === 'lte'),
		);
		const hasNameFilter = filters.some((f) => f.field === 'name' && f.operator === 'contains');
		// Phase 66: check for active range filters from histogram scrubbers
		const hasRangeFilters = [...TIME_FIELDS, ...HIERARCHY_FIELDS].some((f) => filter.hasRangeFilter(f));

		const anyActive = hasAxisFilters || hasTimeFilters || hasNameFilter || hasRangeFilters;
		this._clearAllBtn.style.display = anyActive ? '' : 'none';
	}

	private _syncChipStates(): void {
		const { filter } = this._config;
		for (const field of [...CATEGORY_FIELDS, ...HIERARCHY_FIELDS]) {
			const containerEl = this._chipContainers.get(field);
			if (!containerEl) continue;

			const activeValues = filter.getAxisFilter(field);
			const chips = containerEl.querySelectorAll<HTMLButtonElement>('.latch-chip');
			for (const chip of chips) {
				const datum = d3.select<HTMLButtonElement, ChipDatum>(chip).datum();
				if (datum) {
					if (activeValues.includes(datum.value)) {
						chip.classList.add('latch-chip--active');
					} else {
						chip.classList.remove('latch-chip--active');
					}
				}
			}
		}
	}

	private _syncTimePresetStates(): void {
		const { filter } = this._config;
		const filters = filter.getFilters();

		for (const field of TIME_FIELDS) {
			const hasTimeFilter = filters.some((f) => f.field === field && (f.operator === 'gte' || f.operator === 'lte'));
			if (!hasTimeFilter) {
				this._activePresets.set(field, null);
			}
		}

		// Update UI for all time preset containers
		if (!this._rootEl) return;
		for (const field of TIME_FIELDS) {
			const presetsContainer = this._rootEl.querySelector(
				`.latch-time-presets:has(button[data-field="${field}"])`,
			) as HTMLElement | null;
			if (presetsContainer) {
				this._updateTimePresetUI(presetsContainer, field);
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Async data fetching
	// ---------------------------------------------------------------------------

	private async _fetchAllDistinctValues(): Promise<void> {
		const { bridge } = this._config;
		const allFields = [...CATEGORY_FIELDS, ...HIERARCHY_FIELDS];

		const promises = allFields.map(async (field) => {
			const chips = await fetchDistinctValuesWithCounts(bridge, field);
			this._renderChips(field, chips);
		});

		await Promise.all(promises);
	}
}
