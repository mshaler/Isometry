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
const PADDING = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the grid position for a card at index `i` given `cols` columns.
 *
 * @param i - Zero-based index of the card in the sorted array
 * @param cols - Number of columns
 * @returns SVG transform string: `translate(col * CELL_WIDTH, row * CELL_HEIGHT)`
 */
function computeGridPosition(i: number, cols: number): string {
	const col = i % cols;
	const row = Math.floor(i / cols);
	return `translate(${col * CELL_WIDTH}, ${row * CELL_HEIGHT})`;
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
			.attr('height', PADDING) as d3.Selection<SVGSVGElement, unknown, null, undefined>;
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

		// Compute grid dimensions
		const containerWidth = this.container.clientWidth;
		const cols = Math.max(1, Math.floor(containerWidth / CELL_WIDTH));
		const rows = Math.ceil(cards.length / cols);

		// Update SVG height
		const svgHeight = rows * CELL_HEIGHT + PADDING;
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
		if (this.svg) {
			this.svg.remove();
			this.svg = null;
		}
		this.container = null;
	}
}
