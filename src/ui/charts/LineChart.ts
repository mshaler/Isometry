// Isometry v5 -- Phase 65 Plan 02
// LineChart: D3 line chart with scalePoint + scaleLinear.
//
// Requirements: NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - Aspect ratio 5:3 (height = width * 0.6)
//   - d3.scalePoint for categorical x-axis, d3.scaleLinear for y
//   - d3.line() with curveMonotoneX for smooth curves
//   - Data circles at each point (r=3) + line path
//   - 300ms transitions, hover tooltips on circles

import * as d3 from 'd3';
import type { ChartConfig } from './ChartParser';

const MARGINS = { top: 20, right: 20, bottom: 40, left: 50 };

/**
 * Render a line chart into the given container.
 *
 * Uses d3.scalePoint for categorical labels on x-axis.
 * Data circles keyed on `d.label` (D-003).
 */
export function renderLineChart(
	container: HTMLDivElement,
	data: { label: string; value: number }[],
	config: ChartConfig,
): void {
	// Empty data guard
	if (data.length === 0) {
		container.querySelector('svg')?.remove();
		let empty = container.querySelector<HTMLDivElement>('.notebook-explorer__chart-empty');
		if (!empty) {
			empty = document.createElement('div');
			empty.className = 'notebook-explorer__chart-empty';
			container.appendChild(empty);
		}
		empty.textContent = 'No data — check the x field matches a column with values';
		return;
	}
	container.querySelector('.notebook-explorer__chart-empty')?.remove();

	const width = container.clientWidth || 300;
	const height = width * 0.6;
	const innerW = width - MARGINS.left - MARGINS.right;
	const innerH = height - MARGINS.top - MARGINS.bottom;

	// Ensure tooltip exists
	let tooltip = container.querySelector<HTMLDivElement>('.notebook-explorer__chart-tooltip');
	if (!tooltip) {
		tooltip = document.createElement('div');
		tooltip.className = 'notebook-explorer__chart-tooltip';
		container.appendChild(tooltip);
	}

	// Create or select SVG
	let svg = d3.select(container).select<SVGSVGElement>('svg');
	if (svg.empty()) {
		svg = d3
			.select(container)
			.append('svg')
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');
	} else {
		svg.attr('viewBox', `0 0 ${width} ${height}`);
	}

	// Ensure root <g>
	let g = svg.select<SVGGElement>('g.line-root');
	if (g.empty()) {
		g = svg.append('g').attr('class', 'line-root').attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);
		g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);
		g.append('g').attr('class', 'y-axis');
		g.append('path').attr('class', 'line-path');
	}

	// Scales
	const x = d3
		.scalePoint<string>()
		.domain(data.map((d) => d.label))
		.range([0, innerW])
		.padding(0.5);

	const y = d3
		.scaleLinear()
		.domain([0, d3.max(data, (d) => d.value) ?? 1])
		.nice()
		.range([innerH, 0]);

	// Axes
	const xAxis = d3.axisBottom(x).tickSizeOuter(0);
	const yMax = d3.max(data, (d) => d.value) ?? 1;
	const yTickFormat = yMax < 10_000 ? d3.format(',.0f') : d3.format('~s');
	const yAxis = d3
		.axisLeft(y)
		.ticks(5)
		.tickFormat(yTickFormat as (d: d3.NumberValue) => string);

	g.select<SVGGElement>('.x-axis')
		.transition()
		.duration(300)
		.call(xAxis as any);

	if (data.length > 6) {
		g.select('.x-axis').selectAll('text').attr('transform', 'rotate(-30)').style('text-anchor', 'end');
	}

	g.select<SVGGElement>('.y-axis')
		.transition()
		.duration(300)
		.call(yAxis as any);

	// Line color
	const stroke = config.color ?? d3.schemeTableau10[0];

	// Line generator
	const line = d3
		.line<{ label: string; value: number }>()
		.x((d) => x(d.label) ?? 0)
		.y((d) => y(d.value))
		.curve(d3.curveMonotoneX);

	// Update line path
	g.select<SVGPathElement>('.line-path')
		.datum(data)
		.transition()
		.duration(300)
		.attr('d', line)
		.attr('fill', 'none')
		.attr('stroke', stroke!)
		.attr('stroke-width', 2);

	// Data circles (D-003: key function)
	g.selectAll<SVGCircleElement, { label: string; value: number }>('circle.point')
		.data(data, (d) => d.label)
		.join(
			(enter) =>
				enter
					.append('circle')
					.attr('class', 'point')
					.attr('cx', (d) => x(d.label) ?? 0)
					.attr('cy', innerH)
					.attr('r', 3)
					.attr('fill', stroke!)
					.on('mouseover', (event: MouseEvent, d) => {
						tooltip!.textContent = `${d.label}: ${d.value}`;
						tooltip!.classList.add('notebook-explorer__chart-tooltip--visible');
						const [px, py] = d3.pointer(event, container);
						tooltip!.style.left = `${px + 10}px`;
						tooltip!.style.top = `${py - 10}px`;
					})
					.on('mouseout', () => {
						tooltip!.classList.remove('notebook-explorer__chart-tooltip--visible');
					})
					.call((sel) =>
						sel
							.transition()
							.duration(300)
							.attr('cy', (d) => y(d.value)),
					),
			(update) =>
				update.call((sel) =>
					sel
						.transition()
						.duration(300)
						.attr('cx', (d) => x(d.label) ?? 0)
						.attr('cy', (d) => y(d.value)),
				),
			(exit) => exit.call((sel) => sel.transition().duration(300).attr('cy', innerH).remove()),
		);

	// Title
	svg.selectAll('text.notebook-explorer__chart-title').remove();
	if (config.title) {
		svg
			.append('text')
			.attr('class', 'notebook-explorer__chart-title')
			.attr('x', width / 2)
			.attr('y', 14)
			.text(config.title);
	}
}
