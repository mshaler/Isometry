// Isometry v5 — Phase 93 Plan 02
// CardPropertyFields: typed property input panel with 24 fields in 5 collapsible groups,
// tag chip editor with datalist autocomplete, per-field undo via updateCardMutation,
// and inline validation error feedback.
//
// Requirements: PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, PROP-06, PROP-08

import '../styles/card-editor-panel.css';
import type { Card, CardInput, CardType } from '../database/queries/types';
import { updateCardMutation } from '../mutations/inverses';
import type { MutationManager } from '../mutations/MutationManager';
import type { WorkerBridge } from '../worker/WorkerBridge';
import { coerceFieldValue, isCoercionError } from '../utils/card-coerce';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CardPropertyFieldsConfig {
	mutations: MutationManager;
	bridge: WorkerBridge;
}

// ---------------------------------------------------------------------------
// Field group definitions
// ---------------------------------------------------------------------------

type FieldDef = {
	field: string;
	label: string;
	inputType: 'text' | 'url' | 'datetime-local' | 'number' | 'select' | 'toggle' | 'tags' | 'readonly';
	placeholder?: string;
	step?: string;
	min?: string;
	max?: string;
};

const GROUPS: Array<{ title: string; id: string; fields: FieldDef[] }> = [
	{
		title: 'Identity',
		id: 'identity',
		fields: [
			{ field: 'card_type', label: 'Card Type', inputType: 'select' },
			{ field: 'summary', label: 'Summary', inputType: 'text', placeholder: 'Brief summary\u2026' },
		],
	},
	{
		title: 'Organization',
		id: 'organization',
		fields: [
			{ field: 'folder', label: 'Folder', inputType: 'text', placeholder: 'Folder name\u2026' },
			{ field: 'status', label: 'Status', inputType: 'text', placeholder: 'Status\u2026' },
			{ field: 'tags', label: 'Tags', inputType: 'tags' },
			{ field: 'is_collective', label: 'Collective', inputType: 'toggle' },
			{ field: 'priority', label: 'Priority', inputType: 'number', step: '1', min: '0' },
			{ field: 'sort_order', label: 'Sort Order', inputType: 'number', step: '1', min: '0' },
		],
	},
	{
		title: 'Time',
		id: 'time',
		fields: [
			{ field: 'due_at', label: 'Due At', inputType: 'datetime-local' },
			{ field: 'completed_at', label: 'Completed At', inputType: 'datetime-local' },
			{ field: 'event_start', label: 'Event Start', inputType: 'datetime-local' },
			{ field: 'event_end', label: 'Event End', inputType: 'datetime-local' },
			{ field: 'created_at', label: 'Created At', inputType: 'readonly' },
			{ field: 'modified_at', label: 'Modified At', inputType: 'readonly' },
		],
	},
	{
		title: 'Location',
		id: 'location',
		fields: [
			{ field: 'latitude', label: 'Latitude', inputType: 'number', step: '0.000001', min: '-90', max: '90' },
			{ field: 'longitude', label: 'Longitude', inputType: 'number', step: '0.000001', min: '-180', max: '180' },
			{ field: 'location_name', label: 'Location', inputType: 'text', placeholder: 'Location name\u2026' },
		],
	},
	{
		title: 'Source',
		id: 'source',
		fields: [
			{ field: 'url', label: 'URL', inputType: 'url', placeholder: 'https://\u2026' },
			{ field: 'mime_type', label: 'MIME Type', inputType: 'text', placeholder: 'e.g. text/plain' },
			{ field: 'source', label: 'Source', inputType: 'text', placeholder: 'Source name\u2026' },
			{ field: 'source_id', label: 'Source ID', inputType: 'text', placeholder: 'Source ID\u2026' },
			{ field: 'source_url', label: 'Source URL', inputType: 'url', placeholder: 'https://\u2026' },
		],
	},
];

const CARD_TYPES: CardType[] = ['note', 'task', 'event', 'resource', 'person', 'reference', 'message', 'media'];
const CARD_TYPE_LABELS: Record<CardType, string> = {
	note: 'Note',
	task: 'Task',
	event: 'Event',
	resource: 'Resource',
	person: 'Person',
	reference: 'Reference',
	message: 'Message',
	media: 'Media',
};

// ---------------------------------------------------------------------------
// CardPropertyFields
// ---------------------------------------------------------------------------

/**
 * CardPropertyFields renders 24 card property fields (all except name and content)
 * in 5 collapsible groups with appropriate input controls, tag chip editor,
 * per-field undo via updateCardMutation, and inline validation feedback.
 */
export class CardPropertyFields {
	private readonly _mutations: MutationManager;
	private readonly _bridge: WorkerBridge;

	// DOM
	private _rootEl: HTMLElement | null = null;
	private _tagDatalistEl: HTMLDataListElement | null = null;
	private _tagsContainerEl: HTMLElement | null = null;
	private _tagInputEl: HTMLInputElement | null = null;

	// State
	private _snapshot: Card | null = null;
	private _tagSuggestions: string[] = [];

	// Input and error element registries, keyed by field name
	private _inputElements: Map<string, HTMLInputElement | HTMLSelectElement> = new Map();
	private _errorElements: Map<string, HTMLElement> = new Map();

	// Bound event handlers (for cleanup)
	private _boundHandlers: Array<{ el: EventTarget; type: string; handler: EventListenerOrEventListenerObject }> = [];

	constructor(config: CardPropertyFieldsConfig) {
		this._mutations = config.mutations;
		this._bridge = config.bridge;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'card-editor-panel';

		// Shared datalist for tag autocomplete
		this._tagDatalistEl = document.createElement('datalist');
		this._tagDatalistEl.id = 'cpf-tag-suggestions';
		this._rootEl.appendChild(this._tagDatalistEl);

		// Build 5 collapsible groups
		for (const group of GROUPS) {
			const groupEl = this._createGroup(group.title, group.id, group.fields);
			this._rootEl.appendChild(groupEl);
		}

		container.appendChild(this._rootEl);
	}

	update(card: Card): void {
		this._snapshot = card;

		// Populate all input elements from card data
		for (const [field, inputEl] of this._inputElements) {
			const value = (card as unknown as Record<string, unknown>)[field];
			if (inputEl instanceof HTMLInputElement && inputEl.type === 'checkbox') {
				inputEl.checked = Boolean(value);
			} else if (inputEl instanceof HTMLInputElement && inputEl.type === 'datetime-local') {
				// Format ISO date string for datetime-local input: YYYY-MM-DDTHH:mm
				if (value != null && typeof value === 'string') {
					// Strip seconds and timezone — datetime-local expects YYYY-MM-DDTHH:mm
					inputEl.value = value.substring(0, 16);
				} else {
					inputEl.value = '';
				}
			} else {
				inputEl.value = value != null ? String(value) : '';
			}
		}

		// Clear all error states
		for (const [field, inputEl] of this._inputElements) {
			inputEl.classList.remove('cpf-input--error');
			const errorEl = this._errorElements.get(field);
			if (errorEl) errorEl.style.display = 'none';
		}

		// Re-render tag chips
		this._renderTagChips(card.tags ?? []);

		// Load tag autocomplete suggestions (async fire-and-forget)
		void this._loadTagSuggestions();
	}

	destroy(): void {
		// Remove all registered event handlers
		for (const { el, type, handler } of this._boundHandlers) {
			el.removeEventListener(type, handler);
		}
		this._boundHandlers = [];

		// Remove from DOM
		this._rootEl?.remove();

		// Clear registries
		this._inputElements.clear();
		this._errorElements.clear();

		// Null out references
		this._rootEl = null;
		this._tagDatalistEl = null;
		this._tagsContainerEl = null;
		this._tagInputEl = null;
		this._snapshot = null;
		this._tagSuggestions = [];
	}

	// -----------------------------------------------------------------------
	// Group creation
	// -----------------------------------------------------------------------

	private _createGroup(title: string, id: string, fields: FieldDef[]): HTMLElement {
		const groupEl = document.createElement('div');
		groupEl.className = 'cpf-group';

		const bodyId = `cpf-body-${id}`;

		// Header button
		const headerEl = document.createElement('button');
		headerEl.type = 'button';
		headerEl.className = 'cpf-group__header';
		headerEl.setAttribute('aria-expanded', 'true');
		headerEl.setAttribute('aria-controls', bodyId);

		const titleEl = document.createElement('span');
		titleEl.className = 'cpf-group__title';
		titleEl.textContent = title;

		const chevronEl = document.createElement('span');
		chevronEl.className = 'cpf-group__chevron';
		chevronEl.textContent = '\u25BC'; // ▼ down arrow

		headerEl.appendChild(titleEl);
		headerEl.appendChild(chevronEl);

		const toggleHandler = () => {
			const isCollapsed = groupEl.classList.contains('cpf-group--collapsed');
			groupEl.classList.toggle('cpf-group--collapsed', !isCollapsed);
			headerEl.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
		};
		this._addListener(headerEl, 'click', toggleHandler);

		// Body container
		const bodyEl = document.createElement('div');
		bodyEl.className = 'cpf-group__body';
		bodyEl.id = bodyId;

		// Field rows
		for (const fieldDef of fields) {
			const rowEl = this._createFieldRow(fieldDef);
			bodyEl.appendChild(rowEl);
		}

		groupEl.appendChild(headerEl);
		groupEl.appendChild(bodyEl);

		return groupEl;
	}

	// -----------------------------------------------------------------------
	// Field row creation
	// -----------------------------------------------------------------------

	private _createFieldRow(fieldDef: FieldDef): HTMLElement {
		const rowEl = document.createElement('div');
		rowEl.className = 'cpf-row';

		// Tags field gets special treatment — no standard label/control pair
		if (fieldDef.inputType === 'tags') {
			const labelEl = document.createElement('label');
			labelEl.className = 'cpf-row__label';
			labelEl.textContent = fieldDef.label;
			rowEl.appendChild(labelEl);

			const controlEl = document.createElement('div');
			controlEl.className = 'cpf-row__control';

			const tagsContainer = this._createTagsContainer();
			controlEl.appendChild(tagsContainer);
			rowEl.appendChild(controlEl);

			// Error element (rarely shown for tags but included for consistency)
			const errorEl = document.createElement('p');
			errorEl.className = 'cpf-row__error';
			errorEl.setAttribute('aria-live', 'polite');
			errorEl.style.display = 'none';
			this._errorElements.set(fieldDef.field, errorEl);
			rowEl.appendChild(errorEl);

			return rowEl;
		}

		// Toggle (is_collective) — no standard label
		if (fieldDef.inputType === 'toggle') {
			const controlEl = document.createElement('div');
			controlEl.className = 'cpf-row__control';

			const toggleWrapper = document.createElement('div');
			toggleWrapper.className = 'cpf-toggle';

			const checkboxId = `cpf-${fieldDef.field}`;
			const checkboxEl = document.createElement('input');
			checkboxEl.type = 'checkbox';
			checkboxEl.className = 'cpf-toggle__checkbox';
			checkboxEl.id = checkboxId;

			const checkLabelEl = document.createElement('label');
			checkLabelEl.className = 'cpf-toggle__label';
			checkLabelEl.htmlFor = checkboxId;
			checkLabelEl.textContent = fieldDef.label;

			const changeHandler = () => {
				this._commitField(fieldDef.field, checkboxEl.checked);
			};
			this._addListener(checkboxEl, 'change', changeHandler);

			toggleWrapper.appendChild(checkboxEl);
			toggleWrapper.appendChild(checkLabelEl);
			controlEl.appendChild(toggleWrapper);

			// Store checkbox in inputElements map for update()
			this._inputElements.set(fieldDef.field, checkboxEl);

			// Error element
			const errorEl = document.createElement('p');
			errorEl.className = 'cpf-row__error';
			errorEl.setAttribute('aria-live', 'polite');
			errorEl.style.display = 'none';
			this._errorElements.set(fieldDef.field, errorEl);

			rowEl.appendChild(controlEl);
			rowEl.appendChild(errorEl);

			return rowEl;
		}

		// Standard label
		const labelId = `cpf-${fieldDef.field}`;
		const labelEl = document.createElement('label');
		labelEl.className = 'cpf-row__label';
		labelEl.htmlFor = labelId;
		labelEl.textContent = fieldDef.label;
		rowEl.appendChild(labelEl);

		// Control container
		const controlEl = document.createElement('div');
		controlEl.className = 'cpf-row__control';

		let inputEl: HTMLInputElement | HTMLSelectElement;

		if (fieldDef.inputType === 'select') {
			// card_type select
			const selectEl = document.createElement('select');
			selectEl.className = 'cpf-select';
			selectEl.id = labelId;

			for (const ct of CARD_TYPES) {
				const option = document.createElement('option');
				option.value = ct;
				option.textContent = CARD_TYPE_LABELS[ct];
				selectEl.appendChild(option);
			}

			const changeHandler = () => {
				this._commitField(fieldDef.field, selectEl.value);
			};
			this._addListener(selectEl, 'change', changeHandler);

			inputEl = selectEl;
			controlEl.appendChild(selectEl);
		} else if (fieldDef.inputType === 'datetime-local') {
			// Date input — native datetime-local
			const dateInputEl = document.createElement('input');
			dateInputEl.type = 'datetime-local';
			dateInputEl.className = 'cpf-input cpf-input--date';
			dateInputEl.id = labelId;

			const changeHandler = () => {
				this._commitField(fieldDef.field, dateInputEl.value);
			};
			this._addListener(dateInputEl, 'change', changeHandler);

			inputEl = dateInputEl;
			controlEl.appendChild(dateInputEl);
		} else if (fieldDef.inputType === 'number') {
			const numInputEl = document.createElement('input');
			numInputEl.type = 'number';
			numInputEl.className = 'cpf-input cpf-input--number';
			numInputEl.id = labelId;
			if (fieldDef.step !== undefined) numInputEl.step = fieldDef.step;
			if (fieldDef.min !== undefined) numInputEl.min = fieldDef.min;
			if (fieldDef.max !== undefined) numInputEl.max = fieldDef.max;

			const blurHandler = () => {
				this._commitField(fieldDef.field, numInputEl.value);
			};
			this._addListener(numInputEl, 'blur', blurHandler);

			inputEl = numInputEl;
			controlEl.appendChild(numInputEl);
		} else if (fieldDef.inputType === 'readonly') {
			const roInputEl = document.createElement('input');
			roInputEl.type = 'text';
			roInputEl.className = 'cpf-input';
			roInputEl.id = labelId;
			roInputEl.disabled = true;

			inputEl = roInputEl;
			controlEl.appendChild(roInputEl);
		} else {
			// text or url
			const textInputEl = document.createElement('input');
			textInputEl.type = fieldDef.inputType === 'url' ? 'url' : 'text';
			textInputEl.className = 'cpf-input';
			textInputEl.id = labelId;
			if (fieldDef.placeholder) textInputEl.placeholder = fieldDef.placeholder;

			const blurHandler = () => {
				this._commitField(fieldDef.field, textInputEl.value);
			};
			this._addListener(textInputEl, 'blur', blurHandler);

			inputEl = textInputEl;
			controlEl.appendChild(textInputEl);
		}

		this._inputElements.set(fieldDef.field, inputEl);
		rowEl.appendChild(controlEl);

		// Error element (hidden by default)
		const errorEl = document.createElement('p');
		errorEl.className = 'cpf-row__error';
		errorEl.setAttribute('aria-live', 'polite');
		errorEl.style.display = 'none';
		this._errorElements.set(fieldDef.field, errorEl);
		rowEl.appendChild(errorEl);

		return rowEl;
	}

	// -----------------------------------------------------------------------
	// Tag chip editor
	// -----------------------------------------------------------------------

	private _createTagsContainer(): HTMLElement {
		const tagsContainer = document.createElement('div');
		tagsContainer.className = 'cpf-tags';
		this._tagsContainerEl = tagsContainer;

		// Tag input (datalist attached)
		const tagInput = document.createElement('input');
		tagInput.type = 'text';
		tagInput.className = 'cpf-tag-input';
		tagInput.placeholder = 'Add tag\u2026';
		tagInput.setAttribute('list', 'cpf-tag-suggestions');
		this._tagInputEl = tagInput;

		const keydownHandler = (e: Event) => {
			const ke = e as KeyboardEvent;
			const val = tagInput.value;
			if (ke.key === 'Enter' || ke.key === 'Tab') {
				if (ke.key === 'Tab' && val.trim() === '') return; // Let Tab propagate when empty
				ke.preventDefault();
				const trimmed = val.trim();
				if (trimmed) {
					this._addTag(trimmed);
					tagInput.value = '';
				}
			} else if (ke.key === 'Backspace' && val === '') {
				const tags = this._snapshot?.tags ?? [];
				if (tags.length > 0) {
					ke.preventDefault();
					this._removeTag(tags[tags.length - 1]!);
				}
			}
		};
		this._addListener(tagInput, 'keydown', keydownHandler);

		const blurHandler = () => {
			const trimmed = tagInput.value.trim();
			if (trimmed) {
				this._addTag(trimmed);
				tagInput.value = '';
			}
		};
		this._addListener(tagInput, 'blur', blurHandler);

		// Chips will be rendered by _renderTagChips; append input last
		tagsContainer.appendChild(tagInput);

		return tagsContainer;
	}

	private _renderTagChips(tags: string[]): void {
		if (!this._tagsContainerEl || !this._tagInputEl) return;

		// Remove all chip elements (keep only the tag input)
		const container = this._tagsContainerEl;
		const tagInput = this._tagInputEl;

		// Remove all children except the input
		const children = Array.from(container.children);
		for (const child of children) {
			if (child !== tagInput) {
				child.remove();
			}
		}

		// Prepend chips before the input
		for (const tag of tags) {
			const chipEl = this._createTagChip(tag);
			container.insertBefore(chipEl, tagInput);
		}
	}

	private _createTagChip(tag: string): HTMLElement {
		const chip = document.createElement('span');
		chip.className = 'cpf-tag-chip';

		const labelSpan = document.createElement('span');
		labelSpan.textContent = tag;
		chip.appendChild(labelSpan);

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'cpf-tag-chip__remove';
		removeBtn.textContent = '\u00D7'; // ×
		removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);

		const clickHandler = () => {
			this._removeTag(tag);
		};
		this._addListener(removeBtn, 'click', clickHandler);

		chip.appendChild(removeBtn);
		return chip;
	}

	private _addTag(tag: string): void {
		if (!this._snapshot) return;
		const currentTags = this._snapshot.tags ?? [];

		// Skip duplicate
		if (currentTags.includes(tag)) return;

		const newTags = [...currentTags, tag];
		this._commitTags(newTags);
	}

	private _removeTag(tag: string): void {
		if (!this._snapshot) return;
		const currentTags = this._snapshot.tags ?? [];
		const newTags = currentTags.filter((t) => t !== tag);
		this._commitTags(newTags);
	}

	private _commitTags(newTags: string[]): void {
		if (!this._snapshot) return;
		const mutation = updateCardMutation(this._snapshot.id, this._snapshot, { tags: newTags } as Partial<CardInput>);
		void this._mutations.execute(mutation);
		// Update snapshot
		this._snapshot = { ...this._snapshot, tags: newTags };
		// Re-render chips
		this._renderTagChips(newTags);
	}

	// -----------------------------------------------------------------------
	// Tag autocomplete
	// -----------------------------------------------------------------------

	private async _loadTagSuggestions(): Promise<void> {
		try {
			const result = await this._bridge.send('db:query', {
				sql: 'SELECT DISTINCT value FROM cards, json_each(cards.tags) WHERE cards.deleted_at IS NULL ORDER BY value',
				params: [],
			});
			this._tagSuggestions = result.rows.map((r: Record<string, unknown>) => r['value'] as string);

			// Populate datalist
			if (this._tagDatalistEl) {
				this._tagDatalistEl.innerHTML = '';
				for (const tag of this._tagSuggestions) {
					const opt = document.createElement('option');
					opt.value = tag;
					this._tagDatalistEl.appendChild(opt);
				}
			}
		} catch {
			// Autocomplete is non-critical — silently ignore errors
		}
	}

	// -----------------------------------------------------------------------
	// Commit handler — shared by all non-tag fields
	// -----------------------------------------------------------------------

	private _commitField(field: string, rawValue: unknown): void {
		if (!this._snapshot) return;

		const coerced = coerceFieldValue(field, rawValue);

		if (isCoercionError(coerced)) {
			// Show validation error: red border + inline error text
			const inputEl = this._inputElements.get(field);
			const errorEl = this._errorElements.get(field);
			if (inputEl) inputEl.classList.add('cpf-input--error');
			if (errorEl) {
				errorEl.textContent = (coerced as { error: string }).error;
				errorEl.style.display = '';
			}
			// Revert input to last committed value from snapshot
			if (inputEl && inputEl instanceof HTMLInputElement && inputEl.type !== 'checkbox') {
				const snapshotValue = (this._snapshot as unknown as Record<string, unknown>)[field];
				inputEl.value = snapshotValue != null ? String(snapshotValue) : '';
			}
			return;
		}

		// Clear any previous error state
		const inputEl = this._inputElements.get(field);
		const errorEl = this._errorElements.get(field);
		if (inputEl) inputEl.classList.remove('cpf-input--error');
		if (errorEl) errorEl.style.display = 'none';

		// No-op if value matches snapshot
		const currentValue = (this._snapshot as unknown as Record<string, unknown>)[field];
		if (coerced === currentValue) return;

		const mutation = updateCardMutation(this._snapshot.id, this._snapshot, {
			[field]: coerced,
		} as Partial<CardInput>);
		void this._mutations.execute(mutation);

		// Update snapshot to reflect committed state
		this._snapshot = { ...this._snapshot, [field]: coerced } as Card;
	}

	// -----------------------------------------------------------------------
	// Utility: register event listener for cleanup
	// -----------------------------------------------------------------------

	private _addListener(
		el: EventTarget,
		type: string,
		handler: EventListenerOrEventListenerObject,
	): void {
		el.addEventListener(type, handler);
		this._boundHandlers.push({ el, type, handler });
	}
}
