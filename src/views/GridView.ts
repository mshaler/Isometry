// Isometry v5 — Phase 5 GridView
// SVG-based responsive grid view.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Column count = Math.max(1, Math.floor(containerWidth / CELL_WIDTH))
//   - Cards wrap to next row: position = translate(col * CELL_WIDTH, row * CELL_HEIGHT)
//   - Fixed CELL_WIDTH = 180, CELL_HEIGHT = 120 (uniform tiles, no masonry)
//   - SVG height = Math.ceil(cards.length / cols) * CELL_HEIGHT + PADDING
//   - Enter: opacity fade in; Exit: sync remove (avoids d3 SVG transform interpolation in jsdom)
//
// Requirements: VIEW-02

import * as d3 from 'd3';
import { renderSvgCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_WIDTH = 180;
const CELL_HEIGHT = 120;
const CELL_GAP = 12;
const PADDING = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the grid position for a card at index `i` given `cols` columns.
 *
 * @param i - Zero-based index of the card in the sorted array
 * @param cols - Number of columns
 * @returns SVG transform string with gap spacing between cells
 */
function computeGridPosition(i: number, cols: number): string {
	const col = i % cols;
	const row = Math.floor(i / cols);
	return `translate(${col * (CELL_WIDTH + CELL_GAP)}, ${row * (CELL_HEIGHT + CELL_GAP)})`;
}

// ---------------------------------------------------------------------------
// GridView implementation
// ---------------------------------------------------------------------------

/**
 * SVG-based responsive grid view.
 *
 * Renders cards as uniform tiles in a grid layout.
 * Column count adapts to container width via Math.max(1, Math.floor(containerWidth / CELL_WIDTH)).
 *
 * @implements IView
 */
export class GridView implements IView {
	private container: HTMLElement | null = null;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedIndex = -1;
	private _lastCols = 1;
	private _lastCardCount = 0;
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container element.
	 * Creates the SVG canvas.
	 * Called once by ViewManager before the first render.
	 */
	mount(container: HTMLElement): void {
		this.container = container;

		this.svg = d3
			.select<HTMLElement, unknown>(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', PADDING)
			.attr('role', 'img')
			.attr('aria-label', 'Grid view, 0 cards')
			.attr('tabindex', '0') as d3.Selection<SVGSVGElement, unknown, null, undefined>;

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		const svgNode = this.svg.node()!;
		this._onKeydown = (e: KeyboardEvent) => {
			if (this._lastCardCount === 0) return;
			const cols = this._lastCols;
			const count = this._lastCardCount;

			switch (e.key) {
				case 'ArrowRight':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + 1, count - 1);
					this._updateFocusVisual();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - 1, 0);
					this._updateFocusVisual();
					break;
				case 'ArrowDown':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + cols, count - 1);
					this._updateFocusVisual();
					break;
				case 'ArrowUp':
					e.preventDefault();
					this._focusedIndex = Math.max(this._focusedIndex - cols, 0);
					this._updateFocusVisual();
					break;
				case 'Home':
					e.preventDefault();
					this._focusedIndex = 0;
					this._updateFocusVisual();
					break;
				case 'End':
					e.preventDefault();
					this._focusedIndex = count - 1;
					this._updateFocusVisual();
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
		svgNode.addEventListener('keydown', this._onKeydown);
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards in a responsive grid using a D3 data join with key function `d => d.id`.
	 *
	 * Column count is computed from container.clientWidth.
	 * Cards are positioned by row and column index.
	 *
	 * @param cards - Array of CardDatum to render.
	 */
	render(cards: CardDatum[]): void {
		if (!this.svg || !this.container) return;

		// Update ARIA label for screen readers (A11Y-03)
		this.svg.attr('aria-label', `Grid view, ${cards.length} cards`);

		// Compute grid dimensions
		const containerWidth = this.container.clientWidth;
		const cols = Math.max(1, Math.floor((containerWidth + CELL_GAP) / (CELL_WIDTH + CELL_GAP)));

		// Track for keyboard navigation (A11Y-08)
		this._lastCols = cols;
		this._lastCardCount = cards.length;
		const rows = Math.ceil(cards.length / cols);

		// Update SVG height
		const svgHeight = rows * (CELL_HEIGHT + CELL_GAP) - CELL_GAP + PADDING;
		this.svg.attr('height', svgHeight);

		// D3 data join with mandatory key function d => d.id (VIEW-09)
		this.svg
			.selectAll<SVGGElement, CardDatum>('g.card')
			.data(cards, (d) => d.id)
			.join(
				(enter) => {
					const g = enter
						.append('g')
						.attr('class', 'card')
						.attr('transform', (_, i) => computeGridPosition(i, cols))
						.style('opacity', '0');
					g.each(function (d) {
						renderSvgCard(d3.select<SVGGElement, CardDatum>(this as SVGGElement), d);
					});
					// Fade in (opacity only — no transform interpolation to avoid jsdom SVG parse issues)
					g.transition().duration(200).style('opacity', '1');
					return g;
				},
				(update) => {
					// Update card content if data changed
					update.each(function (d) {
						renderSvgCard(d3.select<SVGGElement, CardDatum>(this as SVGGElement), d);
					});
					return update;
				},
				(exit) => {
					// Sync remove — avoids D3 SVG transform interpolation crash in jsdom
					exit.remove();
					return exit;
				},
			)
			// Set positions directly (no D3 transition on transform)
			.attr('transform', (_, i) => computeGridPosition(i, cols));
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove the SVG element.
	 * Called by ViewManager before mounting the next view.
	 */
	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this.svg && this._onKeydown) {
			this.svg.node()?.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		this._focusedIndex = -1;

		if (this.svg) {
			this.svg.remove();
			this.svg = null;
		}
		this.container = null;
	}

	// ---------------------------------------------------------------------------
	// Private: focus visual (A11Y-08)
	// ---------------------------------------------------------------------------

	/** Update visual focus indicator on the currently focused card. */
	private _updateFocusVisual(): void {
		if (!this.svg) return;
		this.svg.selectAll('g.card').classed('card--focused', false);
		if (this._focusedIndex >= 0) {
			this.svg
				.selectAll<SVGGElement, CardDatum>('g.card')
				.filter((_, i) => i === this._focusedIndex)
				.classed('card--focused', true);
		}
	}
}
