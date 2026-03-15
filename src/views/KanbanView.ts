// Isometry v5 — Phase 5 KanbanView
// HTML-based D3 kanban view with column grouping and drag-drop MutationManager integration.
//
// Design:
//   - Uses HTML divs (not SVG) for HTML5 drag-drop compatibility
//   - D3 data join with key function d => d.id for DOM stability
//   - Groups cards by configurable field (defaults to 'status')
//   - Columns sorted alphabetically; empty columns from columnDomain still show
//   - Drop fires updateCardMutation via MutationManager (undoable via Cmd+Z)
//   - IMPORTANT: Does NOT use d3.drag — it intercepts dragstart and breaks dataTransfer
//
// Requirements: VIEW-03, VIEW-12

import * as d3 from 'd3';
import type { Card } from '../database/queries/types';
import { updateCardMutation } from '../mutations/inverses';
import type { MutationManager } from '../mutations/MutationManager';
import { renderHtmlCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// KanbanView options
// ---------------------------------------------------------------------------

export interface KanbanViewOptions {
	/** Field to group cards by. Defaults to 'status'. */
	groupByField?: string;
	/** Pre-defined column domain. If provided, empty columns will still render. */
	columnDomain?: string[];
	/** MutationManager for executing undoable mutations on drop. */
	mutationManager: MutationManager;
	/**
	 * Optional override for the mutation callback.
	 * Defaults to calling updateCardMutation + mutationManager.execute.
	 * Inject in tests to capture drag-drop behavior without real SQL.
	 */
	onMutation?: (cardId: string, newValue: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// KanbanView
// ---------------------------------------------------------------------------

/**
 * HTML-based Kanban board view with drag-drop between columns.
 *
 * Lifecycle:
 *   1. mount(container) — creates div.kanban-board
 *   2. render(cards) — groups cards, runs D3 data join, wires drag-drop
 *   3. destroy() — removes board, clears references
 *
 * Drag-drop flow:
 *   - dragstart: stores card ID in dataTransfer
 *   - column dragover: preventDefault + visual feedback
 *   - column drop: calls onMutation(cardId, targetColumnValue) which fires undoable mutation
 */
export class KanbanView implements IView {
	private board: HTMLDivElement | null = null;
	private mountContainer: HTMLElement | null = null;
	private currentCards: CardDatum[] = [];

	private readonly groupByField: string;
	private readonly staticColumnDomain: string[] | undefined;
	private readonly mutationManager: MutationManager;
	private readonly mutationCallback: (cardId: string, newValue: string) => Promise<void>;

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedColIndex = 0;
	private _focusedCardIndex = 0;
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;

	constructor(options: KanbanViewOptions) {
		this.groupByField = options.groupByField ?? 'status';
		this.staticColumnDomain = options.columnDomain;
		this.mutationManager = options.mutationManager;

		// Default onMutation uses updateCardMutation for undo support
		this.mutationCallback =
			options.onMutation ??
			(async (cardId: string, newValue: string) => {
				const beforeCard = this.currentCards.find((c) => c.id === cardId);
				if (!beforeCard) return;
				const mutation = updateCardMutation(
					cardId,
					beforeCard as unknown as Card,
					{ [this.groupByField]: newValue } as Partial<Card>,
				);
				await this.mutationManager.execute(mutation);
			});
	}

	// ---------------------------------------------------------------------------
	// IView lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Mount the kanban board into the given container.
	 * Creates the root div.kanban-board element.
	 */
	mount(container: HTMLElement): void {
		this.mountContainer = container;
		this.board = document.createElement('div');
		this.board.className = 'kanban-board';
		this.board.setAttribute('tabindex', '0');
		container.appendChild(this.board);

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		this._onKeydown = (e: KeyboardEvent) => {
			if (!this.board) return;
			const columns = this.board.querySelectorAll<HTMLElement>('.kanban-column');
			if (columns.length === 0) return;

			switch (e.key) {
				case 'ArrowRight':
					e.preventDefault();
					this._focusedColIndex = Math.min(this._focusedColIndex + 1, columns.length - 1);
					this._focusedCardIndex = 0;
					this._updateKanbanFocus(columns);
					break;
				case 'ArrowLeft':
					e.preventDefault();
					this._focusedColIndex = Math.max(this._focusedColIndex - 1, 0);
					this._focusedCardIndex = 0;
					this._updateKanbanFocus(columns);
					break;
				case 'ArrowDown': {
					e.preventDefault();
					const col = columns[this._focusedColIndex];
					if (col) {
						const cards = col.querySelectorAll('.kanban-column-body .card');
						this._focusedCardIndex = Math.min(this._focusedCardIndex + 1, cards.length - 1);
					}
					this._updateKanbanFocus(columns);
					break;
				}
				case 'ArrowUp':
					e.preventDefault();
					this._focusedCardIndex = Math.max(this._focusedCardIndex - 1, 0);
					this._updateKanbanFocus(columns);
					break;
				case 'Escape':
					e.preventDefault();
					document.querySelector<HTMLElement>('[role="navigation"]')?.focus();
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					break;
			}
		};
		this.board.addEventListener('keydown', this._onKeydown);
	}

	/**
	 * Render cards grouped by groupByField using D3 data join.
	 *
	 * VIEW-09 compliance: Every .data() call uses key function d => d.id.
	 */
	render(cards: CardDatum[]): void {
		if (!this.board) return;

		this.currentCards = cards;

		// Group cards by the configured field (null values map to 'none')
		const grouped = d3.group(cards, (d) => (d[this.groupByField as keyof CardDatum] as string | null) ?? 'none');

		// Compute sorted column domain: merge static domain with dynamic keys
		const dynamicKeys = Array.from(grouped.keys());
		const allKeys = this.staticColumnDomain
			? Array.from(new Set([...this.staticColumnDomain, ...dynamicKeys]))
			: dynamicKeys;
		const sortedDomain = allKeys.slice().sort();

		// D3 data join on columns — key is the column value string
		const self = this;
		d3.select(this.board)
			.selectAll<HTMLDivElement, string>('.kanban-column')
			.data(sortedDomain, (d) => d)
			.join(
				(enter) => {
					const col = enter.append('div').attr('class', 'kanban-column');

					// Column header
					const header = col.append('div').attr('class', 'kanban-column-header');
					header.append('span').attr('class', 'kanban-column-title');
					header.append('span').attr('class', 'kanban-column-count');

					// Column body (scrollable)
					col.append('div').attr('class', 'kanban-column-body').style('overflow-y', 'auto');

					return col;
				},
				(update) => update,
				(exit) => exit.remove(),
			)
			.each(function (columnValue) {
				const colEl = this as HTMLDivElement;
				const columnCards = grouped.get(columnValue) ?? [];

				// Update header
				const header = colEl.querySelector('.kanban-column-header')!;
				header.querySelector('.kanban-column-title')!.textContent = columnValue;
				header.querySelector('.kanban-column-count')!.textContent = `(${columnCards.length})`;

				// Column body
				const columnBody = colEl.querySelector('.kanban-column-body') as HTMLElement;
				columnBody.dataset['columnValue'] = columnValue;

				if (columnCards.length === 0) {
					// Show empty state
					d3.select(columnBody)
						.selectAll<HTMLDivElement, CardDatum>('.card')
						.data([], (d) => d.id)
						.join('div');

					if (!columnBody.querySelector('.kanban-empty')) {
						const emptyEl = document.createElement('div');
						emptyEl.className = 'kanban-empty';
						emptyEl.textContent = 'No cards';
						columnBody.appendChild(emptyEl);
					}
				} else {
					// Remove empty state if present
					const emptyEl = columnBody.querySelector('.kanban-empty');
					if (emptyEl) columnBody.removeChild(emptyEl);

					// D3 data join on cards within column — key function d => d.id (VIEW-09 mandatory)
					d3.select(columnBody)
						.selectAll<HTMLDivElement, CardDatum>('.card')
						.data(columnCards, (d) => d.id)
						.join(
							(enter) => {
								// Create each card via renderHtmlCard — each receives its own datum
								return enter.append((d) => renderHtmlCard(d));
							},
							(update) => update,
							(exit) => exit.remove(),
						)
						.each(function (d) {
							const cardEl = this as HTMLDivElement;
							self.setupCardDragListeners(cardEl, d, columnValue, grouped);
						});
				}

				// Wire column drag-drop listeners
				self.setupColumnDropListeners(columnBody);
			});
	}

	/**
	 * Tear down this view — remove board element, clear all references.
	 */
	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this.board && this._onKeydown) {
			this.board.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		this._focusedColIndex = 0;
		this._focusedCardIndex = 0;

		if (this.board && this.mountContainer) {
			this.mountContainer.removeChild(this.board);
		}
		this.board = null;
		this.mountContainer = null;
		this.currentCards = [];
	}

	// ---------------------------------------------------------------------------
	// Private: focus visual (A11Y-08)
	// ---------------------------------------------------------------------------

	/** Update visual focus indicator on the focused kanban card. */
	private _updateKanbanFocus(columns: NodeListOf<HTMLElement>): void {
		// Remove all existing focus classes
		if (this.board) {
			this.board.querySelectorAll('.card--focused').forEach((el) => el.classList.remove('card--focused'));
			this.board
				.querySelectorAll('.kanban-column--focused')
				.forEach((el) => el.classList.remove('kanban-column--focused'));
		}

		const col = columns[this._focusedColIndex];
		if (!col) return;
		col.classList.add('kanban-column--focused');

		const cards = col.querySelectorAll<HTMLElement>('.kanban-column-body .card');
		const card = cards[this._focusedCardIndex];
		if (card) {
			card.classList.add('card--focused');
		}
	}

	// ---------------------------------------------------------------------------
	// Private: Drag-drop setup
	// ---------------------------------------------------------------------------

	/**
	 * Wire HTML5 drag events onto a card element.
	 * Does NOT use d3.drag — it intercepts dragstart and breaks dataTransfer.
	 */
	private setupCardDragListeners(
		cardEl: HTMLDivElement,
		d: CardDatum,
		_columnValue: string,
		_grouped: Map<string, CardDatum[]>,
	): void {
		cardEl.setAttribute('draggable', 'true');
		cardEl.dataset['id'] = d.id;

		// Remove old listeners by replacing with cloneNode if already has listeners
		// Since D3 re-runs .each() on each render, we guard against duplicate listeners
		if (cardEl.dataset['dragSetup'] === 'true') return;
		cardEl.dataset['dragSetup'] = 'true';

		cardEl.addEventListener('dragstart', (e: DragEvent) => {
			if (!e.dataTransfer) return;
			e.dataTransfer.setData('text/x-kanban-card-id', d.id);
			e.dataTransfer.effectAllowed = 'move';
			cardEl.classList.add('dragging');
		});

		cardEl.addEventListener('dragend', () => {
			cardEl.classList.remove('dragging');
		});
	}

	/**
	 * Wire HTML5 drop events onto a column body element.
	 * Fires onMutation callback when card is dropped onto a different column.
	 */
	private setupColumnDropListeners(columnBody: HTMLElement): void {
		// Guard against duplicate listeners
		if (columnBody.dataset['dropSetup'] === 'true') return;
		columnBody.dataset['dropSetup'] = 'true';

		columnBody.addEventListener('dragover', (e: DragEvent) => {
			if (e.dataTransfer?.types.includes('text/x-kanban-card-id')) {
				e.preventDefault();
				columnBody.classList.add('drag-over');
			}
		});

		columnBody.addEventListener('dragleave', () => {
			columnBody.classList.remove('drag-over');
		});

		columnBody.addEventListener('drop', async (e: DragEvent) => {
			e.preventDefault();
			columnBody.classList.remove('drag-over');

			const cardId = e.dataTransfer?.getData('text/x-kanban-card-id');
			if (!cardId) return;

			const targetColumn = columnBody.dataset['columnValue']!;

			// Find card in current data — check if same column (no-op)
			const card = this.currentCards.find((c) => c.id === cardId);
			if (!card) return;

			const currentColumnValue = (card[this.groupByField as keyof CardDatum] as string | null) ?? 'none';
			if (currentColumnValue === targetColumn) return; // same-column drop is no-op

			await this.mutationCallback(cardId, targetColumn);
		});
	}
}
