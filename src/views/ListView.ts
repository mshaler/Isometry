// Isometry v5 — Phase 5 ListView
// SVG-based single-column list view with sort controls.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Sort toolbar above SVG: dropdown for field, button for direction toggle
//   - Cards render as SVG g.card groups at translate(0, i * ROW_HEIGHT)
//   - Enter: opacity fade in; Exit: opacity fade out then remove
//   - ROW_HEIGHT = 48 to match CARD_DIMENSIONS.height
//
// Requirements: VIEW-01

import * as d3 from 'd3';
import { renderSvgCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 48;
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
 * SVG-based single-column list view with sort controls.
 *
 * Renders cards as rows in a vertical list. Each row shows:
 *   - Card name (left-aligned, via renderSvgCard)
 *   - Modified date (right-aligned)
 *   - Type badge (via renderSvgCard)
 *
 * Sort toolbar above SVG provides:
 *   - Dropdown for sort field: name, created_at, modified_at, priority
 *   - Toggle button for asc/desc direction
 *
 * @implements IView
 */
export class ListView implements IView {
	private container: HTMLElement | null = null;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
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

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container element.
	 * Creates sort toolbar above the SVG canvas.
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
		// Only first interactive element is in Tab order; arrow keys rove between
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

		// --- SVG canvas ---
		this.svg = d3
			.select<HTMLElement, unknown>(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', PADDING)
			.attr('role', 'img')
			.attr('aria-label', 'List view, 0 cards')
			.attr('tabindex', '0') as d3.Selection<SVGSVGElement, unknown, null, undefined>;

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		const svgNode = this.svg.node()!;
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
				case ' ':
					e.preventDefault();
					// Activate = select the focused card (no-op if no selection provider)
					break;
			}
		};
		svgNode.addEventListener('keydown', this._onKeydown);
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards using a D3 data join with key function `d => d.id`.
	 *
	 * Sort is applied before the data join.
	 * SVG height is updated to match card count * ROW_HEIGHT.
	 *
	 * @param cards - Array of CardDatum to render.
	 */
	render(cards: CardDatum[]): void {
		if (!this.svg) return;

		this.currentCards = [...cards];
		const sorted = sortCards(cards, this.sortState);

		// Update ARIA label for screen readers (A11Y-03)
		this.svg.attr('aria-label', `List view, ${cards.length} cards`);

		// Update SVG height
		const svgHeight = sorted.length * ROW_HEIGHT + PADDING;
		this.svg.attr('height', svgHeight);

		// D3 data join with mandatory key function d => d.id (VIEW-09)
		this.svg
			.selectAll<SVGGElement, CardDatum>('g.card')
			.data(sorted, (d) => d.id)
			.join(
				(enter) => {
					const g = enter
						.append('g')
						.attr('class', 'card')
						.attr('transform', (_, i) => `translate(0, ${i * ROW_HEIGHT})`)
						.style('opacity', '0');
					g.each(function (d) {
						renderSvgCard(d3.select<SVGGElement, CardDatum>(this as SVGGElement), d);
					});
					// Add date text right-aligned
					g.append('text')
						.attr('class', 'card-date')
						.attr('x', 260)
						.attr('y', PADDING + 12)
						.attr('fill', 'var(--text-secondary)')
						.attr('font-size', '10px')
						.attr('text-anchor', 'end')
						.text((d) => formatDate(d.modified_at));
					// Fade in (opacity only — no transform interpolation to avoid jsdom SVG issues)
					g.transition().duration(200).style('opacity', '1');
					return g;
				},
				(update) => {
					// Update date text in case it changed
					update.select('text.card-date').text((d) => formatDate(d.modified_at));
					return update;
				},
				(exit) => {
					// Sync remove — D3 transform transitions fail in jsdom; exit is immediate
					exit.remove();
					return exit;
				},
			)
			// Set final positions directly (no transition on transform — avoids parseSvg jsdom crash)
			.attr('transform', (_, i) => `translate(0, ${i * ROW_HEIGHT})`);
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
		if (this.svg && this._onKeydown) {
			this.svg.node()?.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
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

		if (this.svg) {
			this.svg.remove();
			this.svg = null;
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
		if (!this.svg) return;
		// Remove previous focus class
		this.svg.selectAll('g.card').classed('card--focused', false);
		// Apply focus class to the card at _focusedIndex
		if (this._focusedIndex >= 0) {
			this.svg
				.selectAll<SVGGElement, CardDatum>('g.card')
				.filter((_, i) => i === this._focusedIndex)
				.classed('card--focused', true);
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

/**
 * Format an ISO date string to a short display format (YYYY-MM-DD).
 * Returns empty string for empty/invalid inputs.
 */
function formatDate(iso: string): string {
	if (!iso) return '';
	// Extract date part from ISO timestamp: "2026-01-15T12:00:00Z" → "2026-01-15"
	return iso.slice(0, 10);
}
