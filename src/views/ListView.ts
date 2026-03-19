// Isometry v5 — Phase 94 ListView (HTML-based)
// HTML div-based single-column list view with sort controls and dimension-aware card rendering.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Sort toolbar above list container: dropdown for field, button for direction toggle
//   - Cards render as HTML div.card elements via renderDimensionCard()
//   - [data-dimension] CSS on parent container controls visual density (1x/2x/5x)
//   - Double-click or Enter on focused card opens 10x detail overlay
//   - Phase 94 DIMS-01: migrated from SVG to HTML
//
// Requirements: VIEW-01, DIMS-01

import * as d3 from 'd3';
import { openDetailOverlay, renderDimensionCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PADDING = 16;

type SortField = 'name' | 'created_at' | 'modified_at' | 'priority';
type SortDirection = 'asc' | 'desc';

interface SortState {
	field: SortField;
	direction: SortDirection;
}

// ---------------------------------------------------------------------------
// ListView implementation
// ---------------------------------------------------------------------------

/**
 * HTML-based single-column list view with sort controls and dimension-aware rendering.
 *
 * Renders cards as HTML div.card rows using renderDimensionCard().
 * Dimension level (1x/2x/5x) is controlled by [data-dimension] CSS attribute
 * on the parent view container — no JS toggling needed on dimension switch.
 *
 * @implements IView
 */
export class ListView implements IView {
	private container: HTMLElement | null = null;
	private _listEl: HTMLDivElement | null = null;
	private toolbar: HTMLDivElement | null = null;
	private currentCards: CardDatum[] = [];
	private sortState: SortState = { field: 'name', direction: 'asc' };

	// Bound event handlers (stored for removal in destroy)
	private onSelectChange: ((e: Event) => void) | null = null;
	private onDirectionClick: (() => void) | null = null;

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedIndex = -1;
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;
	private _onToolbarKeydown: ((e: KeyboardEvent) => void) | null = null;
	private _onDblClick: ((e: MouseEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container element.
	 * Creates sort toolbar above the HTML card list container.
	 * Called once by ViewManager before the first render.
	 */
	mount(container: HTMLElement): void {
		this.container = container;

		// --- Sort toolbar ---
		const toolbar = document.createElement('div');
		toolbar.className = 'sort-toolbar';
		toolbar.setAttribute('role', 'navigation');
		toolbar.setAttribute('aria-label', 'View toolbar');

		// Sort field dropdown
		const select = document.createElement('select');
		select.className = 'sort-field';
		const fields: { value: SortField; label: string }[] = [
			{ value: 'name', label: 'Name' },
			{ value: 'created_at', label: 'Created' },
			{ value: 'modified_at', label: 'Modified' },
			{ value: 'priority', label: 'Priority' },
		];
		for (const { value, label } of fields) {
			const opt = document.createElement('option');
			opt.value = value;
			opt.textContent = label;
			select.appendChild(opt);
		}
		select.value = this.sortState.field;

		this.onSelectChange = (e: Event) => {
			const target = e.target as HTMLSelectElement;
			this.sortState = { ...this.sortState, field: target.value as SortField };
			this._rerenderCurrentCards();
		};
		select.addEventListener('change', this.onSelectChange);

		// Direction toggle button
		const dirBtn = document.createElement('button');
		dirBtn.className = 'sort-direction';
		dirBtn.textContent = this.sortState.direction === 'asc' ? '\u2191 Asc' : '\u2193 Desc';

		this.onDirectionClick = () => {
			this.sortState = {
				...this.sortState,
				direction: this.sortState.direction === 'asc' ? 'desc' : 'asc',
			};
			dirBtn.textContent = this.sortState.direction === 'asc' ? '\u2191 Asc' : '\u2193 Desc';
			this._rerenderCurrentCards();
		};
		dirBtn.addEventListener('click', this.onDirectionClick);

		toolbar.appendChild(select);
		toolbar.appendChild(dirBtn);
		container.appendChild(toolbar);
		this.toolbar = toolbar;

		// --- Toolbar roving tabindex (A11Y-08) ---
		const toolbarItems = [select, dirBtn] as HTMLElement[];
		dirBtn.setAttribute('tabindex', '-1');
		this._onToolbarKeydown = (e: KeyboardEvent) => {
			const current = document.activeElement as HTMLElement | null;
			const idx = toolbarItems.indexOf(current!);
			if (idx < 0) return;

			let nextIdx = idx;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
				e.preventDefault();
				nextIdx = Math.min(idx + 1, toolbarItems.length - 1);
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
				e.preventDefault();
				nextIdx = Math.max(idx - 1, 0);
			}

			if (nextIdx !== idx) {
				toolbarItems[idx]!.setAttribute('tabindex', '-1');
				toolbarItems[nextIdx]!.setAttribute('tabindex', '0');
				toolbarItems[nextIdx]!.focus();
			}
		};
		toolbar.addEventListener('keydown', this._onToolbarKeydown);

		// --- HTML list container (replaces SVG canvas) ---
		const listEl = document.createElement('div');
		listEl.className = 'list-view';
		listEl.style.paddingTop = `${PADDING}px`;
		listEl.setAttribute('role', 'list');
		listEl.setAttribute('tabindex', '0');
		listEl.setAttribute('aria-label', 'List view, 0 cards');
		container.appendChild(listEl);
		this._listEl = listEl;

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		this._onKeydown = (e: KeyboardEvent) => {
			const cardCount = this.currentCards.length;
			if (cardCount === 0) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + 1, cardCount - 1);
					this._updateFocusVisual();
					break;
				case 'ArrowUp':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
					this._updateFocusVisual();
					break;
				case 'Home':
					e.preventDefault();
					this._focusedIndex = 0;
					this._updateFocusVisual();
					break;
				case 'End':
					e.preventDefault();
					this._focusedIndex = cardCount - 1;
					this._updateFocusVisual();
					break;
				case 'Escape':
					e.preventDefault();
					document.querySelector<HTMLElement>('[role="navigation"]')?.focus();
					break;
				case 'Enter':
				case ' ': {
					e.preventDefault();
					// Open 10x detail overlay for focused card
					const focusedCardEl = this._listEl?.querySelector<HTMLElement>('.card--focused, .card:focus');
					if (focusedCardEl) {
						const cardId = focusedCardEl.dataset['id'];
						const card = this.currentCards.find((c) => c.id === cardId);
						if (card && this.container) {
							openDetailOverlay(card, this.container, () => {
								focusedCardEl.focus();
							});
						}
					}
					break;
				}
			}
		};
		listEl.addEventListener('keydown', this._onKeydown);

		// --- 10x double-click trigger ---
		this._onDblClick = (e: MouseEvent) => {
			const cardEl = (e.target as HTMLElement).closest<HTMLElement>('.card');
			if (!cardEl) return;
			const cardId = cardEl.dataset['id'];
			const card = this.currentCards.find((c) => c.id === cardId);
			if (card && this.container) {
				openDetailOverlay(card, this.container, () => {
					cardEl.focus();
				});
			}
		};
		listEl.addEventListener('dblclick', this._onDblClick);
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards using a D3 data join with key function `d => d.id`.
	 *
	 * Sort is applied before the data join.
	 * Cards are rendered as HTML div.card elements via renderDimensionCard().
	 *
	 * @param cards - Array of CardDatum to render.
	 */
	render(cards: CardDatum[]): void {
		if (!this._listEl) return;

		this.currentCards = [...cards];
		const sorted = sortCards(cards, this.sortState);

		// Update ARIA label for screen readers (A11Y-03)
		this._listEl.setAttribute('aria-label', `List view, ${cards.length} cards`);

		// D3 data join with mandatory key function d => d.id (VIEW-09)
		d3.select(this._listEl)
			.selectAll<HTMLDivElement, CardDatum>('div.card')
			.data(sorted, (d) => d.id)
			.join(
				(enter) => {
					const card = enter.append((d) => renderDimensionCard(d));
					card.attr('role', 'listitem');
					return card;
				},
				(update) => {
					// Update card text content for changed cards
					update.each(function (d) {
						const el = this as HTMLDivElement;
						const titleEl = el.querySelector('.card__title');
						if (titleEl) titleEl.textContent = d.name || 'Untitled';
						const previewEl = el.querySelector('.card__preview');
						if (previewEl) previewEl.textContent = d.body_text ?? d.status ?? d.folder ?? '';
					});
					return update;
				},
				(exit) => {
					exit.remove();
					return exit;
				},
			);
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove event listeners, remove DOM elements.
	 * Called by ViewManager before mounting the next view.
	 */
	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this._listEl && this._onKeydown) {
			this._listEl.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		if (this._listEl && this._onDblClick) {
			this._listEl.removeEventListener('dblclick', this._onDblClick);
			this._onDblClick = null;
		}
		this._focusedIndex = -1;

		// Remove event listeners
		if (this.toolbar) {
			if (this._onToolbarKeydown) {
				this.toolbar.removeEventListener('keydown', this._onToolbarKeydown);
				this._onToolbarKeydown = null;
			}
			const select = this.toolbar.querySelector('select');
			const btn = this.toolbar.querySelector('.sort-direction') as HTMLButtonElement | null;
			if (select && this.onSelectChange) {
				select.removeEventListener('change', this.onSelectChange);
			}
			if (btn && this.onDirectionClick) {
				btn.removeEventListener('click', this.onDirectionClick);
			}
			this.toolbar.remove();
			this.toolbar = null;
		}

		if (this._listEl) {
			this._listEl.remove();
			this._listEl = null;
		}

		this.container = null;
		this.currentCards = [];
		this.onSelectChange = null;
		this.onDirectionClick = null;
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/** Re-render current cards after a sort state change. */
	private _rerenderCurrentCards(): void {
		this.render(this.currentCards);
	}

	/** Update visual focus indicator on the currently focused card (composite widget pattern). */
	private _updateFocusVisual(): void {
		if (!this._listEl) return;
		// Remove previous focus class from all cards
		d3.select(this._listEl).selectAll<HTMLDivElement, CardDatum>('div.card').classed('card--focused', false);
		// Apply focus class to the card at _focusedIndex
		if (this._focusedIndex >= 0) {
			d3.select(this._listEl)
				.selectAll<HTMLDivElement, CardDatum>('div.card')
				.filter((_, i) => i === this._focusedIndex)
				.classed('card--focused', true)
				.each(function () {
					(this as HTMLElement).focus();
				});
		}
	}
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Sort a CardDatum array by the given field and direction.
 * Returns a new sorted array — does not mutate input.
 */
function sortCards(cards: CardDatum[], sort: SortState): CardDatum[] {
	const sorted = [...cards];
	sorted.sort((a, b) => {
		let cmp = 0;
		if (sort.field === 'name') {
			cmp = a.name.localeCompare(b.name);
		} else if (sort.field === 'priority') {
			cmp = a.priority - b.priority;
		} else if (sort.field === 'created_at') {
			cmp = a.created_at.localeCompare(b.created_at);
		} else if (sort.field === 'modified_at') {
			cmp = a.modified_at.localeCompare(b.modified_at);
		}
		return sort.direction === 'asc' ? cmp : -cmp;
	});
	return sorted;
}
