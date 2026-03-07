// Isometry v5 — Phase 6 TimelineView
// SVG-based D3 timeline with scaleUtc() horizontal axis and swimlane grouping.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Horizontal time axis using d3.scaleUtc() positioned at the top of the swimlane area
//   - Fixed left column (120px) for swimlane row labels
//   - Cards grouped into swimlane rows by groupByField (default: 'status')
//   - Overlapping cards within same swimlane stack vertically (sub-rows)
//   - g.card CSS class matches ListView/GridView for morphTransition compatibility
//   - Cards with null due_at are excluded from timeline display
//   - Fixed card width (80px) for point-in-time cards (multi-day spans deferred)
//
// Requirements: VIEW-05

import * as d3 from 'd3';
import type { DensityProvider } from '../providers/DensityProvider';
import { CARD_DIMENSIONS, renderSvgCard } from './CardRenderer';
import type { CardDatum, IView } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_COL_WIDTH = 120;
const AXIS_HEIGHT = 40;
const SWIMLANE_HEIGHT = 60;
const CARD_WIDTH = 80; // fixed width for point-in-time cards
const CARD_HEIGHT = CARD_DIMENSIONS.height; // 48px
const SWIMLANE_PADDING = 8;

// ---------------------------------------------------------------------------
// TimelineViewOptions
// ---------------------------------------------------------------------------

export interface TimelineViewOptions {
	/** Field to group cards into swimlane rows. Defaults to 'status'. */
	groupByField?: string;
	/** Optional DensityProvider for subscribing to time granularity changes. */
	densityProvider?: DensityProvider;
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

/**
 * Compute sub-row assignments for a set of cards within a single swimlane.
 *
 * Cards with overlapping x-positions are assigned to different sub-rows,
 * stacking vertically to avoid visual collisions.
 *
 * Overlap definition: two cards overlap if their x-centers are within CARD_WIDTH
 * of each other (both are rendered with fixed CARD_WIDTH).
 *
 * @param xPositions - Map from card id to x pixel position
 * @returns Map from card id to sub-row index (0-based)
 */
export function computeSubRows(xPositions: Map<string, number>): Map<string, number> {
	const subRows = new Map<string, number>();
	// Track the rightmost x used in each sub-row
	const rowEdges: number[] = [];

	for (const [id, x] of xPositions) {
		// Find first sub-row where this card does not overlap with the rightmost card
		let assigned = false;
		for (let row = 0; row < rowEdges.length; row++) {
			const edge = rowEdges[row] ?? -Infinity;
			if (x >= edge + CARD_WIDTH) {
				// No overlap with rightmost card in this row
				subRows.set(id, row);
				rowEdges[row] = x;
				assigned = true;
				break;
			}
		}
		if (!assigned) {
			// Need a new sub-row
			const newRow = rowEdges.length;
			subRows.set(id, newRow);
			rowEdges.push(x);
		}
	}

	return subRows;
}

// ---------------------------------------------------------------------------
// TimelineView implementation
// ---------------------------------------------------------------------------

/**
 * SVG-based D3 timeline view with scaleUtc() time axis and swimlane grouping.
 *
 * Renders cards as g.card groups positioned along a horizontal time axis.
 * Cards are grouped into swimlane rows by the groupByField, and overlapping
 * cards within the same swimlane are stacked into sub-rows vertically.
 *
 * @implements IView
 */
export class TimelineView implements IView {
	private container: HTMLElement | null = null;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	private axisG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private swimlaneG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private groupByField: string;
	private densityProvider: DensityProvider | undefined;
	private densityUnsub: (() => void) | null = null;
	private lastCards: CardDatum[] = [];

	constructor(options?: TimelineViewOptions) {
		this.groupByField = options?.groupByField ?? 'status';
		this.densityProvider = options?.densityProvider;
	}

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container element.
	 * Creates the root SVG with axis group and swimlane container.
	 * Called once by ViewManager before the first render.
	 */
	mount(container: HTMLElement): void {
		this.container = container;

		// Create root SVG
		this.svg = d3
			.select<HTMLElement, unknown>(container)
			.append('svg')
			.attr('width', '100%')
			.attr('height', AXIS_HEIGHT) as d3.Selection<SVGSVGElement, unknown, null, undefined>;

		// Time axis group — positioned to the right of the label column
		this.axisG = this.svg
			.append('g')
			.attr('class', 'timeline-axis')
			.attr('transform', `translate(${LABEL_COL_WIDTH}, ${AXIS_HEIGHT})`) as d3.Selection<
			SVGGElement,
			unknown,
			null,
			undefined
		>;

		// Swimlane container group — positioned below the axis
		this.swimlaneG = this.svg
			.append('g')
			.attr('class', 'swimlanes')
			.attr('transform', `translate(${LABEL_COL_WIDTH}, ${AXIS_HEIGHT + 10})`) as d3.Selection<
			SVGGElement,
			unknown,
			null,
			undefined
		>;

		// Subscribe to density provider if provided
		if (this.densityProvider) {
			this.densityUnsub = this.densityProvider.subscribe(() => {
				if (this.lastCards.length > 0) {
					this.render(this.lastCards);
				}
			});
		}
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards using D3 data joins with key function `d => d.id`.
	 *
	 * Steps:
	 *   1. Filter out cards with null due_at
	 *   2. Build d3.scaleUtc() from date extent
	 *   3. Render time axis with d3.axisBottom()
	 *   4. Group cards into swimlanes by groupByField
	 *   5. Compute sub-row positions for overlapping cards in each swimlane
	 *   6. Render swimlane rows with labels and g.card elements
	 *   7. Update SVG height to fit all content
	 *
	 * @param cards - Array of CardDatum to render. Cards without due_at are excluded.
	 */
	render(cards: CardDatum[]): void {
		if (!this.svg || !this.axisG || !this.swimlaneG || !this.container) return;

		this.lastCards = cards;

		// Filter: only cards with a due_at date
		const timeCards = cards.filter((c) => c.due_at != null);

		if (timeCards.length === 0) {
			this.svg.attr('height', AXIS_HEIGHT);
			// Clear swimlanes
			this.swimlaneG.selectAll('g.swimlane').remove();
			return;
		}

		// Compute chart width (available horizontal space, excluding label column)
		const chartWidth = Math.max(this.container.clientWidth - LABEL_COL_WIDTH, 200);

		// Build time scale
		const dates = timeCards.map((c) => new Date(c.due_at!));
		const [minDate, maxDate] = d3.extent(dates) as [Date, Date];
		const xScale = d3.scaleUtc().domain([minDate, maxDate]).range([0, chartWidth]).nice();

		// Render time axis
		this.axisG.call(d3.axisBottom(xScale).ticks(6));

		// Group cards into swimlanes by groupByField
		const grouped = d3.group(timeCards, (c) =>
			String((c as unknown as Record<string, unknown>)[this.groupByField] ?? 'None'),
		);

		// Compute total SVG height based on swimlane sub-rows
		let totalHeight = AXIS_HEIGHT + 10; // axis area + gap

		// Pre-compute sub-rows for each swimlane (needed for height calculation)
		const swimlaneData: Array<{
			label: string;
			cards: CardDatum[];
			subRows: Map<string, number>;
			numSubRows: number;
			yOffset: number;
		}> = [];

		for (const [label, laneCards] of grouped) {
			// Build x-positions map for this lane
			const _xPositions = new Map<string, number>(laneCards.map((c) => [c.id, xScale(new Date(c.due_at!))]));

			// Sort by date for consistent sub-row assignment
			const sorted = [...laneCards].sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

			// Build sorted x-positions for sub-row computation
			const sortedXPositions = new Map<string, number>(sorted.map((c) => [c.id, xScale(new Date(c.due_at!))]));
			const subRows = computeSubRows(sortedXPositions);
			const numSubRows = Math.max(1, Math.max(...subRows.values()) + 1);

			swimlaneData.push({
				label,
				cards: laneCards,
				subRows,
				numSubRows,
				yOffset: totalHeight - (AXIS_HEIGHT + 10), // offset within swimlanes group
			});

			totalHeight += SWIMLANE_HEIGHT * numSubRows + SWIMLANE_PADDING;
		}

		// Update SVG height
		this.svg.attr('height', totalHeight);

		// Render swimlane rows using D3 data join keyed by label
		const swimlanes = this.swimlaneG
			.selectAll<SVGGElement, (typeof swimlaneData)[number]>('g.swimlane')
			.data(swimlaneData, (d) => d.label)
			.join(
				(enter) => enter.append('g').attr('class', 'swimlane'),
				(update) => update,
				(exit) => {
					exit.remove();
					return exit;
				},
			)
			.attr('transform', (d) => `translate(0, ${d.yOffset})`);

		// Render label for each swimlane
		swimlanes
			.selectAll<SVGTextElement, (typeof swimlaneData)[number]>('text.swimlane-label')
			.data(
				(d) => [d],
				(d) => d.label,
			)
			.join('text')
			.attr('class', 'swimlane-label')
			.attr('x', -LABEL_COL_WIDTH + 8)
			.attr('y', SWIMLANE_HEIGHT / 2)
			.attr('fill', 'var(--text-secondary)')
			.attr('font-size', '12px')
			.attr('dominant-baseline', 'middle')
			.text((d) => d.label);

		// Render cards within each swimlane using D3 data join keyed by d.id (VIEW-09)
		swimlanes.each(function (laneData) {
			const lane = d3.select<SVGGElement, (typeof swimlaneData)[number]>(this);

			lane
				.selectAll<SVGGElement, CardDatum>('g.card')
				.data(laneData.cards, (d: CardDatum) => d.id)
				.join(
					(enter) => {
						const g = enter
							.append('g')
							.attr('class', 'card')
							.attr('opacity', 0)
							.attr('transform', (d: CardDatum) => {
								const x = xScale(new Date(d.due_at!));
								const subRow = laneData.subRows.get(d.id) ?? 0;
								const y = subRow * CARD_HEIGHT;
								return `translate(${x}, ${y})`;
							});
						g.each(function (d) {
							renderSvgCard(d3.select<SVGGElement, CardDatum>(this as SVGGElement), d);
						});
						g.transition().duration(200).attr('opacity', 1);
						return g;
					},
					(update) => {
						update.attr('transform', (d: CardDatum) => {
							const x = xScale(new Date(d.due_at!));
							const subRow = laneData.subRows.get(d.id) ?? 0;
							const y = subRow * CARD_HEIGHT;
							return `translate(${x}, ${y})`;
						});
						return update;
					},
					(exit) => {
						exit.remove();
						return exit;
					},
				);
		});
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove SVG, unsubscribe from densityProvider.
	 * Called by ViewManager before mounting the next view.
	 */
	destroy(): void {
		// Unsubscribe from density provider
		if (this.densityUnsub) {
			this.densityUnsub();
			this.densityUnsub = null;
		}

		// Remove SVG from DOM
		if (this.svg) {
			this.svg.remove();
			this.svg = null;
		}

		// Clear all references
		this.axisG = null;
		this.swimlaneG = null;
		this.container = null;
		this.densityProvider = undefined;
		this.lastCards = [];
	}
}
