// Isometry v5 -- Phase 66 Plan 03
// HistogramScrubber: D3 mini bar chart with d3.brushX overlay for LATCH explorer.
//
// Requirements: LTPB-01, LTPB-02
//
// Design:
//   - Self-contained component with mount/update/destroy lifecycle
//   - Fetches bin data via WorkerBridge histogram:query
//   - D3 data join with key function (D-003 mandatory)
//   - d3.brushX maps pixel selection to data domain, calls setRangeFilter()
//   - clearBrush() for programmatic reset (Clear All button)
//   - CSS classes for all visual styling (no inline colors)

import * as d3 from 'd3';
import type { FilterProvider } from '../providers/FilterProvider';
import type { WorkerBridgeLike } from './LatchExplorers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistogramScrubberConfig {
	field: string;
	fieldType: 'numeric' | 'date';
	filter: FilterProvider;
	bridge: WorkerBridgeLike;
	bins?: number;
}

interface BinDatum {
	binStart: number | string;
	binEnd: number | string;
	count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BINS = 10;
const WIDTH = 200;
const HEIGHT = 48;
const MARGINS = { top: 2, right: 4, bottom: 14, left: 4 };

// ---------------------------------------------------------------------------
// HistogramScrubber
// ---------------------------------------------------------------------------

export class HistogramScrubber {
	private readonly _config: HistogramScrubberConfig;
	private _wrapperEl: HTMLElement | null = null;
	private _svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	private _rootG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private _xAxisG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private _brush: d3.BrushBehavior<unknown> | null = null;
	private _brushG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private _bins: BinDatum[] = [];
	private _isBrushing = false;
	private _errorEl: HTMLElement | null = null;

	constructor(config: HistogramScrubberConfig) {
		this._config = config;
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	mount(container: HTMLElement): void {
		const innerW = WIDTH - MARGINS.left - MARGINS.right;
		const innerH = HEIGHT - MARGINS.top - MARGINS.bottom;

		// Wrapper div
		const wrapper = document.createElement('div');
		wrapper.className = 'latch-histogram';
		this._wrapperEl = wrapper;

		// SVG with viewBox for responsive sizing
		this._svg = d3
			.select(wrapper)
			.append('svg')
			.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');

		// Root <g> with margin transform
		this._rootG = this._svg.append('g').attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);

		// X-axis group at bottom
		this._xAxisG = this._rootG.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);

		// Brush group (appended after bars are rendered in _render)
		// Created here but brush behavior attached in _render after scales are built
		this._brushG = this._rootG.append('g').attr('class', 'brush');

		// Create brush behavior
		this._brush = d3
			.brushX()
			.extent([
				[0, 0],
				[innerW, innerH],
			])
			.on('end', (event: d3.D3BrushEvent<unknown>) => this._onBrushEnd(event));

		// Attach brush to group
		this._brushG.call(this._brush);

		container.appendChild(wrapper);

		// Fetch initial data
		void this._fetchAndRender();
	}

	update(): void {
		void this._fetchAndRender();
	}

	destroy(): void {
		// Remove brush
		if (this._brushG) {
			this._brushG.remove();
			this._brushG = null;
		}
		this._brush = null;

		// Remove SVG
		if (this._svg) {
			this._svg.remove();
			this._svg = null;
		}

		// Remove wrapper
		if (this._wrapperEl) {
			this._wrapperEl.remove();
			this._wrapperEl = null;
		}

		this._rootG = null;
		this._xAxisG = null;
		this._bins = [];
	}

	/**
	 * Programmatically clear the brush selection (visual only).
	 * Does NOT call clearRangeFilter -- the caller handles filter state.
	 */
	clearBrush(): void {
		if (this._brushG && this._brush) {
			this._isBrushing = true;
			this._brushG.call(this._brush.move, null);
			this._isBrushing = false;
		}
	}

	// -----------------------------------------------------------------------
	// Data fetching
	// -----------------------------------------------------------------------

	private async _fetchAndRender(): Promise<void> {
		const { field, fieldType, filter, bridge } = this._config;
		const bins = this._config.bins ?? DEFAULT_BINS;

		try {
			const { where, params } = filter.compile();
			const response = (await bridge.send('histogram:query', {
				field,
				fieldType,
				bins,
				where,
				params,
			})) as { bins: BinDatum[] };

			this._clearError();
			this._bins = response.bins;
			this._render(response.bins);
		} catch (err) {
			console.error(`[HistogramScrubber] ${field} (${fieldType}):`, err);
			this._showError('Failed to load data');
		}
	}

	// -----------------------------------------------------------------------
	// Error state
	// -----------------------------------------------------------------------

	private _showError(message: string): void {
		this._render([]); // clear stale chart
		if (!this._errorEl) {
			const errorEl = document.createElement('div');
			errorEl.className = 'histogram-scrubber__error';

			const msgSpan = document.createElement('span');
			msgSpan.className = 'histogram-scrubber__error-msg';
			errorEl.appendChild(msgSpan);

			const retryBtn = document.createElement('button');
			retryBtn.className = 'histogram-scrubber__retry';
			retryBtn.type = 'button';
			retryBtn.textContent = 'Retry';
			retryBtn.addEventListener('click', () => {
				this._clearError();
				void this._fetchAndRender();
			});
			errorEl.appendChild(retryBtn);

			this._wrapperEl?.appendChild(errorEl);
			this._errorEl = errorEl;
		}

		const msgSpan = this._errorEl.querySelector<HTMLElement>('.histogram-scrubber__error-msg');
		if (msgSpan) msgSpan.textContent = message;
		this._errorEl.style.display = '';
	}

	private _clearError(): void {
		if (this._errorEl) this._errorEl.style.display = 'none';
	}

	// -----------------------------------------------------------------------
	// D3 rendering
	// -----------------------------------------------------------------------

	private _render(bins: BinDatum[]): void {
		if (!this._rootG || !this._xAxisG || !this._wrapperEl) return;

		const innerW = WIDTH - MARGINS.left - MARGINS.right;
		const innerH = HEIGHT - MARGINS.top - MARGINS.bottom;

		// Empty state
		if (bins.length === 0) {
			this._rootG.selectAll('rect.latch-histogram__bar').remove();
			this._xAxisG.selectAll('*').remove();

			// Show empty message
			let emptyEl = this._wrapperEl.querySelector('.latch-histogram__empty');
			if (!emptyEl) {
				emptyEl = document.createElement('div');
				emptyEl.className = 'latch-histogram__empty';
				emptyEl.textContent = 'No data';
				this._wrapperEl.appendChild(emptyEl);
			}
			return;
		}

		// Remove empty message if present
		this._wrapperEl.querySelector('.latch-histogram__empty')?.remove();

		// Build labels for scaleBand
		const labels = bins.map((b) => this._formatLabel(b.binStart));

		// X scale: scaleBand
		const x = d3.scaleBand<string>().domain(labels).range([0, innerW]).padding(0.1);

		// Y scale: scaleLinear
		const maxCount = d3.max(bins, (b) => b.count) ?? 1;
		const y = d3.scaleLinear().domain([0, maxCount]).range([innerH, 0]);

		// X-axis
		const xAxis = d3.axisBottom(x).tickSize(0);
		this._xAxisG.call(xAxis as any);
		// Hide domain line for compactness
		this._xAxisG.select('.domain').remove();
		// Rotate labels if many bins
		if (bins.length > 6) {
			this._xAxisG.selectAll('text').attr('transform', 'rotate(-30)').style('text-anchor', 'end');
		}

		// Data join (D-003 mandatory key function)
		this._rootG
			.selectAll<SVGRectElement, BinDatum>('rect.latch-histogram__bar')
			.data(bins, (d) => `${d.binStart}-${d.binEnd}`)
			.join(
				(enter) =>
					enter
						.append('rect')
						.attr('class', 'latch-histogram__bar')
						.attr('x', (_d, i) => x(labels[i]!) ?? 0)
						.attr('y', innerH)
						.attr('width', x.bandwidth())
						.attr('height', 0)
						.each(function (d) {
							// Native tooltip
							const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
							title.textContent = `${d.binStart}–${d.binEnd}: ${d.count}`;
							this.appendChild(title);
						})
						.call((sel) =>
							sel
								.transition()
								.duration(200)
								.attr('y', (d) => y(d.count))
								.attr('height', (d) => innerH - y(d.count)),
						),
				(update) =>
					update
						.each(function (d) {
							const title = this.querySelector('title');
							if (title) title.textContent = `${d.binStart}–${d.binEnd}: ${d.count}`;
						})
						.call((sel) =>
							sel
								.transition()
								.duration(200)
								.attr('x', (_d, i) => x(labels[i]!) ?? 0)
								.attr('width', x.bandwidth())
								.attr('y', (d) => y(d.count))
								.attr('height', (d) => innerH - y(d.count)),
						),
				(exit) => exit.call((sel) => sel.transition().duration(200).attr('y', innerH).attr('height', 0).remove()),
			);

		// Raise brush group so it's on top of bars
		if (this._brushG) {
			this._brushG.raise();
		}
	}

	// -----------------------------------------------------------------------
	// Brush handler
	// -----------------------------------------------------------------------

	private _onBrushEnd(event: d3.D3BrushEvent<unknown>): void {
		// Skip programmatic brush moves (from clearBrush)
		if (this._isBrushing) return;

		const { field, filter } = this._config;
		const selection = event.selection as [number, number] | null;

		if (selection === null) {
			// User clicked away to clear
			filter.clearRangeFilter(field);
			return;
		}

		if (this._bins.length === 0) return;

		const innerW = WIDTH - MARGINS.left - MARGINS.right;
		const [x0, x1] = selection;

		// Map pixel range to bin indices
		const labels = this._bins.map((b) => this._formatLabel(b.binStart));
		const xScale = d3.scaleBand<string>().domain(labels).range([0, innerW]).padding(0.1);

		const bandwidth = xScale.bandwidth();

		// Find bins covered by the selection
		let firstBinIdx = -1;
		let lastBinIdx = -1;

		for (let i = 0; i < labels.length; i++) {
			const bandStart = xScale(labels[i]!) ?? 0;
			const bandEnd = bandStart + bandwidth;

			// A bin is covered if any part of it intersects the selection
			if (bandEnd > x0 && bandStart < x1) {
				if (firstBinIdx === -1) firstBinIdx = i;
				lastBinIdx = i;
			}
		}

		if (firstBinIdx === -1 || lastBinIdx === -1) {
			filter.clearRangeFilter(field);
			return;
		}

		const min = this._bins[firstBinIdx]!.binStart;
		const max = this._bins[lastBinIdx]!.binEnd;

		filter.setRangeFilter(field, min, max);
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	private _formatLabel(value: number | string): string {
		if (typeof value === 'string') return value;
		// Format numeric: integer if whole, 1 decimal otherwise
		return Number.isInteger(value) ? String(value) : value.toFixed(1);
	}
}
