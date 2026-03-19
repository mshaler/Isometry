// Isometry v5 — Phase 5 KanbanView
// HTML-based D3 kanban view with column grouping and pointer-event drag-drop MutationManager integration.
//
// Design:
//   - Uses HTML divs (not SVG) for pointer-event drag-drop compatibility
//   - D3 data join with key function d => d.id for DOM stability
//   - Groups cards by configurable field (defaults to 'status')
//   - Columns sorted alphabetically; empty columns from columnDomain still show
//   - Drop fires updateCardMutation via MutationManager (undoable via Cmd+Z)
//   - Phase 96: Migrated from HTML5 DnD to pointer events (WKWebView compatibility)
//   - Ghost card follows cursor; column body highlights with .drag-over during drag
//
// Requirements: VIEW-03, VIEW-12, DND-03

import * as d3 from 'd3';
import type { Card } from '../database/queries/types';
import { updateCardMutation } from '../mutations/inverses';
import type { MutationManager } from '../mutations/MutationManager';
import { openDetailOverlay, renderDimensionCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Module-level pointer DnD state (Phase 96 — WKWebView-compatible drag)
// ---------------------------------------------------------------------------

let _kanbanGhostEl: HTMLElement | null = null;
let _kanbanDragCardId: string | null = null;
let _kanbanDragSourceEl: HTMLElement | null = null;

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
 * HTML-based Kanban board view with pointer-event drag-drop between columns.
 *
 * Lifecycle:
 *   1. mount(container) — creates div.kanban-board
 *   2. render(cards) — groups cards, runs D3 data join, wires drag-drop
 *   3. destroy() — removes board, clears references
 *
 * Drag-drop flow (Phase 96 — pointer events, WKWebView-compatible):
 *   - pointerdown: setPointerCapture, create ghost card, dim source card
 *   - pointermove: update ghost position, hit-test column bodies for highlighting
 *   - pointerup: remove ghost, releasePointerCapture, call onMutation(cardId, targetColumnValue)
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
				case ' ': {
					e.preventDefault();
					// Open 10x detail overlay for focused card
					const focusedCard = this.board?.querySelector<HTMLElement>('.card--focused, .card:focus');
					if (focusedCard) {
						const cardId = focusedCard.dataset['id'];
						const card = this.currentCards.find((c) => c.id === cardId);
						if (card && this.mountContainer) {
							openDetailOverlay(card, this.mountContainer, () => {
								focusedCard.focus();
							});
						}
					}
					break;
				}
			}
		};
		this.board.addEventListener('keydown', this._onKeydown);

		// --- 10x double-click trigger ---
		this.board.addEventListener('dblclick', (e: MouseEvent) => {
			const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
			if (!cardEl) return;
			const cardId = cardEl.dataset['id'];
			const card = this.currentCards.find((c) => c.id === cardId);
			if (card && this.mountContainer) {
				openDetailOverlay(card, this.mountContainer, () => {
					cardEl.focus();
				});
			}
		});
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
								// Create each card via renderDimensionCard — each receives its own datum
								return enter.append((d) => renderDimensionCard(d));
							},
							(update) => update,
							(exit) => exit.remove(),
						)
						.each(function (d) {
							const cardEl = this as HTMLDivElement;
							self.setupCardDragListeners(cardEl, d, columnValue, grouped);
						});
				}

				// Note: column drop is handled by pointerup hit-testing on card elements.
				// data-column-value is set above on columnBody for hit-test identification.
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
	 * Wire pointer events onto a card element for WKWebView-compatible drag-drop.
	 * Phase 96: Replaces HTML5 DnD (dragstart/dragover/drop) with pointer events.
	 *
	 * Pattern: pointerdown → setPointerCapture + create ghost
	 *          pointermove → update ghost position + hit-test column bodies
	 *          pointerup   → releasePointerCapture + commit mutation
	 *          pointercancel → cleanup (system interruption)
	 */
	private setupCardDragListeners(
		cardEl: HTMLDivElement,
		d: CardDatum,
		_columnValue: string,
		_grouped: Map<string, CardDatum[]>,
	): void {
		cardEl.dataset['id'] = d.id;
		// Pointer events replace HTML5 DnD — no draggable attribute needed

		// Guard against duplicate listeners
		if (cardEl.dataset['dragSetup'] === 'true') return;
		cardEl.dataset['dragSetup'] = 'true';
		cardEl.style.cursor = 'grab';

		cardEl.addEventListener('pointerdown', (e: PointerEvent) => {
			// Only primary button
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			cardEl.setPointerCapture?.(e.pointerId);
			_kanbanDragCardId = d.id;
			_kanbanDragSourceEl = cardEl;

			// Create ghost element (clone of card)
			_kanbanGhostEl = cardEl.cloneNode(true) as HTMLElement;
			_kanbanGhostEl.className = 'card kanban-card--ghost';
			const rect = cardEl.getBoundingClientRect();
			_kanbanGhostEl.style.width = `${rect.width}px`;
			_kanbanGhostEl.style.left = `${e.clientX - rect.width / 2}px`;
			_kanbanGhostEl.style.top = `${e.clientY - 12}px`;
			document.body.appendChild(_kanbanGhostEl);
			document.body.style.cursor = 'grabbing';

			// Dim source card
			cardEl.classList.add('dragging');
		});

		cardEl.addEventListener('pointermove', (e: PointerEvent) => {
			if (!_kanbanGhostEl || !_kanbanDragCardId) return;
			_kanbanGhostEl.style.left = `${e.clientX - _kanbanGhostEl.offsetWidth / 2}px`;
			_kanbanGhostEl.style.top = `${e.clientY - 12}px`;

			// Hit-test column bodies for drop target highlighting
			if (this.board) {
				const columnBodies = this.board.querySelectorAll<HTMLElement>('.kanban-column-body');
				for (const cb of columnBodies) {
					const r = cb.getBoundingClientRect();
					if (
						e.clientX >= r.left &&
						e.clientX <= r.right &&
						e.clientY >= r.top &&
						e.clientY <= r.bottom
					) {
						cb.classList.add('drag-over');
					} else {
						cb.classList.remove('drag-over');
					}
				}
			}
		});

		cardEl.addEventListener('pointerup', async (e: PointerEvent) => {
			cardEl.releasePointerCapture?.(e.pointerId);

			// Clean up ghost
			_kanbanGhostEl?.remove();
			_kanbanGhostEl = null;
			document.body.style.cursor = '';

			// Restore source card
			if (_kanbanDragSourceEl) {
				_kanbanDragSourceEl.classList.remove('dragging');
				_kanbanDragSourceEl = null;
			}

			const cardId = _kanbanDragCardId;
			_kanbanDragCardId = null;

			// Clear all column highlights
			if (this.board) {
				this.board.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
			}

			if (!cardId) return;

			// Hit-test which column body the pointer is over.
			// Test escape hatch: set data-kanban-drop-target on a column body to force-select it
			// when getBoundingClientRect() returns zero-sized rects in jsdom.
			let targetColumnValue: string | null = null;
			if (this.board) {
				const columnBodies = this.board.querySelectorAll<HTMLElement>('.kanban-column-body');
				// First pass: check for test-injected target marker
				for (const cb of columnBodies) {
					if (cb.dataset['kanbanDropTarget']) {
						targetColumnValue = cb.dataset['columnValue'] ?? null;
						delete cb.dataset['kanbanDropTarget'];
						break;
					}
				}
				// Second pass: real getBoundingClientRect hit-testing (production path)
				if (!targetColumnValue) {
					for (const cb of columnBodies) {
						const r = cb.getBoundingClientRect();
						if (
							e.clientX >= r.left &&
							e.clientX <= r.right &&
							e.clientY >= r.top &&
							e.clientY <= r.bottom
						) {
							targetColumnValue = cb.dataset['columnValue'] ?? null;
							break;
						}
					}
				}
			}

			if (!targetColumnValue) return;

			// Same-column drop is no-op
			const card = this.currentCards.find((c) => c.id === cardId);
			if (!card) return;
			const currentColumnValue = (card[this.groupByField as keyof CardDatum] as string | null) ?? 'none';
			if (currentColumnValue === targetColumnValue) return;

			await this.mutationCallback(cardId, targetColumnValue);
		});

		cardEl.addEventListener('pointercancel', () => {
			_kanbanGhostEl?.remove();
			_kanbanGhostEl = null;
			_kanbanDragCardId = null;
			document.body.style.cursor = '';
			if (_kanbanDragSourceEl) {
				_kanbanDragSourceEl.classList.remove('dragging');
				_kanbanDragSourceEl = null;
			}
			if (this.board) {
				this.board.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
			}
		});
	}
}
