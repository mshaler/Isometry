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

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedIndex = -1;
	private _flatCardOrder: CardDatum[] = [];
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;

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
			.attr('height', AXIS_HEIGHT)
			.attr('role', 'img')
			.attr('aria-label', 'Timeline view, 0 cards')
			.attr('tabindex', '0') as d3.Selection<SVGSVGElement, unknown, null, undefined>;

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

		// --- Keyboard navigation (A11Y-08 composite widget) ---
		const svgNode = this.svg.node()!;
		this._onKeydown = (e: KeyboardEvent) => {
			const count = this._flatCardOrder.length;
			if (count === 0) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					this._focusedIndex = Math.min(this._focusedIndex + 1, count - 1);
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
	 * Render cards using D3 data joins with key function `d => d.id`.
	 *
	 * Steps:
	 *   1. Filter out cards with null time field (configurable via DensityProvider)
	 *   2. Build d3.scaleUtc() from date extent
	 *   3. Render time axis with d3.axisBottom()
	 *   4. Group cards into swimlanes by groupByField
	 *   5. Compute sub-row positions for overlapping cards in each swimlane
	 *   6. Render swimlane rows with labels and g.card elements
	 *   7. Update SVG height to fit all content
	 *
	 * @param cards - Array of CardDatum to render. Cards without the active time field are excluded.
	 */
	render(cards: CardDatum[]): void {
		if (!this.svg || !this.axisG || !this.swimlaneG || !this.container) return;

		this.lastCards = cards;
		const timeField = this._getTimeField();

		// Remove any existing empty state and restore SVG visibility
		const existingEmpty = this.container.querySelector('.view-empty');
		if (existingEmpty) existingEmpty.remove();
		this.svg.style('display', null);

		// Update ARIA label for screen readers (A11Y-03)
		this.svg.attr('aria-label', `Timeline view, ${cards.length} cards`);

		// Filter: only cards with the configured time field set
		const timeCards = cards.filter((c) => (c as unknown as Record<string, unknown>)[timeField] != null);

		// Track flat card order for keyboard navigation (A11Y-08)
		this._flatCardOrder = timeCards;

		if (timeCards.length === 0) {
			this.svg.attr('height', AXIS_HEIGHT);
			// Clear swimlanes
			this.swimlaneG.selectAll('g.swimlane').remove();

			// Show contextual empty state (TMLN-02)
			this.svg.style('display', 'none');
			const emptyDiv = document.createElement('div');
			emptyDiv.className = 'view-empty';
			const panel = document.createElement('div');
			panel.className = 'view-empty-panel';
			const icon = document.createElement('span');
			icon.className = 'view-empty-icon';
			icon.textContent = '🕐';
			const heading = document.createElement('h3');
			heading.className = 'view-empty-heading';
			heading.textContent = 'No scheduled cards';
			const desc = document.createElement('p');
			desc.className = 'view-empty-description';
			desc.textContent = 'Add a date to any card to see it on the timeline.';
			panel.appendChild(icon);
			panel.appendChild(heading);
			panel.appendChild(desc);
			emptyDiv.appendChild(panel);
			this.container.appendChild(emptyDiv);
			return;
		}

		// Compute chart width (available horizontal space, excluding label column)
		const chartWidth = Math.max(this.container.clientWidth - LABEL_COL_WIDTH, 200);

		// Build time scale
		const dates = timeCards.map((c) => new Date((c as unknown as Record<string, unknown>)[timeField] as string));
		const [minDate, maxDate] = d3.extent(dates) as [Date, Date];
		const xScale = d3.scaleUtc().domain([minDate, maxDate]).range([0, chartWidth]).nice();

		// Render time axis — use granularity-driven D3 time interval if available
		const interval = this._getGranularityInterval();
		const axis = interval
			? d3.axisBottom(xScale).ticks(interval)
			: d3.axisBottom(xScale).ticks(6);
		this.axisG.call(axis);

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
			const _xPositions = new Map<string, number>(
				laneCards.map((c) => [c.id, xScale(new Date((c as unknown as Record<string, unknown>)[timeField] as string))]),
			);

			// Sort by date for consistent sub-row assignment
			const sorted = [...laneCards].sort(
				(a, b) =>
					new Date((a as unknown as Record<string, unknown>)[timeField] as string).getTime() -
					new Date((b as unknown as Record<string, unknown>)[timeField] as string).getTime(),
			);

			// Build sorted x-positions for sub-row computation
			const sortedXPositions = new Map<string, number>(
				sorted.map((c) => [c.id, xScale(new Date((c as unknown as Record<string, unknown>)[timeField] as string))]),
			);
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

		// Render swimlane background rect for each swimlane
		swimlanes
			.selectAll<SVGRectElement, (typeof swimlaneData)[number]>('rect.swimlane-bg')
			.data(
				(d) => [d],
				(d) => d.label,
			)
			.join('rect')
			.attr('class', 'swimlane-bg')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', chartWidth)
			.attr('height', (d) => SWIMLANE_HEIGHT * d.numSubRows)
			.attr('fill', 'var(--bg-secondary)');

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
			.attr('font-size', 'var(--text-sm)')
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
								const x = xScale(new Date((d as unknown as Record<string, unknown>)[timeField] as string));
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
							const x = xScale(new Date((d as unknown as Record<string, unknown>)[timeField] as string));
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

		// Render today-line marker (UI-SPEC: dashed accent-colored vertical rule at current date)
		const today = new Date();
		const [domainMin, domainMax] = xScale.domain() as [Date, Date];
		const todayInRange = today >= domainMin && today <= domainMax;
		const todayData: Date[] = todayInRange ? [today] : [];

		this.svg
			.selectAll<SVGLineElement, Date>('line.timeline-today')
			.data(todayData, () => 'today')
			.join(
				(enter) => {
					const line = enter
						.append('line')
						.attr('class', 'timeline-today')
						.attr('stroke', 'var(--accent)')
						.attr('stroke-width', 1)
						.attr('stroke-dasharray', '4 2');
					line.append('title').text('Today');
					return line;
				},
				(update) => update,
				(exit) => {
					exit.remove();
					return exit;
				},
			)
			.attr('x1', (d) => xScale(d) + LABEL_COL_WIDTH)
			.attr('x2', (d) => xScale(d) + LABEL_COL_WIDTH)
			.attr('y1', 0)
			.attr('y2', totalHeight - AXIS_HEIGHT);
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove SVG, unsubscribe from densityProvider.
	 * Called by ViewManager before mounting the next view.
	 */
	destroy(): void {
		// Remove keyboard listener (A11Y-08)
		if (this.svg && this._onKeydown) {
			this.svg.node()?.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		this._focusedIndex = -1;
		this._flatCardOrder = [];

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

	// ---------------------------------------------------------------------------
	// Private: focus visual (A11Y-08)
	// ---------------------------------------------------------------------------

	/** Returns active time field from densityProvider, or 'due_at' as fallback. */
	private _getTimeField(): string {
		return this.densityProvider?.getState().timeField ?? 'due_at';
	}

	/** Maps DensityProvider granularity to a D3 time interval, or null for fallback. */
	private _getGranularityInterval(): d3.TimeInterval | null {
		const granularity = this.densityProvider?.getState().granularity;
		if (!granularity) return null;
		switch (granularity) {
			case 'year':    return d3.timeYear;
			case 'quarter': return d3.timeMonth.every(3)!;
			case 'month':   return d3.timeMonth;
			case 'week':    return d3.timeWeek;
			case 'day':     return d3.timeDay;
			default:        return null;
		}
	}

	/** Update visual focus indicator on the currently focused card. */
	private _updateFocusVisual(): void {
		if (!this.swimlaneG) return;
		this.swimlaneG.selectAll('g.card').classed('card--focused', false);
		if (this._focusedIndex >= 0 && this._focusedIndex < this._flatCardOrder.length) {
			const focusedId = this._flatCardOrder[this._focusedIndex]!.id;
			this.swimlaneG
				.selectAll<SVGGElement, CardDatum>('g.card')
				.filter((d: CardDatum) => d.id === focusedId)
				.classed('card--focused', true);
		}
	}
}
