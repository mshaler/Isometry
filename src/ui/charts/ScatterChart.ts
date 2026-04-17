// Isometry v5 -- Phase 65 Plan 02
// ScatterChart: D3 scatter plot with dual scaleLinear axes.
//
// Requirements: NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - 1:1 aspect ratio (square)
//   - d3.scaleLinear for both x and y axes
//   - Circles (r=4) positioned at (x, y) with opacity 0.7
//   - D3 data join keyed on `${d.x},${d.y}` (D-003)
//   - 300ms transitions, hover tooltips on circles

import * as d3 from 'd3';
import type { ChartConfig } from './ChartParser';

const MARGINS = { top: 20, right: 20, bottom: 40, left: 50 };

/**
 * Render a scatter chart into the given container.
 *
 * Data join keyed on `${d.x},${d.y}` (D-003). Circles animate
 * to position on enter, morph on update, fade on exit.
 */
export function renderScatterChart(
	container: HTMLDivElement,
	data: { x: number; y: number }[],
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
		empty.textContent = 'No data — check x and y fields match columns with values';
		return;
	}
	container.querySelector('.notebook-explorer__chart-empty')?.remove();

	const width = container.clientWidth || 300;
	const height = width; // Square
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
	let g = svg.select<SVGGElement>('g.scatter-root');
	if (g.empty()) {
		g = svg.append('g').attr('class', 'scatter-root').attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);
		g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);
		g.append('g').attr('class', 'y-axis');
	}

	// Scales
	const xExtent = d3.extent(data, (d) => d.x) as [number, number];
	const yExtent = d3.extent(data, (d) => d.y) as [number, number];

	const xScale = d3
		.scaleLinear()
		.domain(data.length > 0 ? xExtent : [0, 1])
		.nice()
		.range([0, innerW]);

	const yScale = d3
		.scaleLinear()
		.domain(data.length > 0 ? yExtent : [0, 1])
		.nice()
		.range([innerH, 0]);

	// Axes
	const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('~s'));
	const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('~s'));

	g.select<SVGGElement>('.x-axis')
		.transition()
		.duration(300)
		.call(xAxis as any);

	g.select<SVGGElement>('.y-axis')
		.transition()
		.duration(300)
		.call(yAxis as any);

	// Axis labels from config field names
	svg.selectAll('text.axis-label').remove();
	if (config.x) {
		svg
			.append('text')
			.attr('class', 'axis-label')
			.attr('x', width / 2)
			.attr('y', height - 4)
			.attr('text-anchor', 'middle')
			.attr('font-size', '11')
			.attr('fill', 'currentColor')
			.text(config.x);
	}
	if (config.y) {
		svg
			.append('text')
			.attr('class', 'axis-label')
			.attr('x', -(height / 2))
			.attr('y', 12)
			.attr('text-anchor', 'middle')
			.attr('transform', 'rotate(-90)')
			.attr('font-size', '11')
			.attr('fill', 'currentColor')
			.text(config.y);
	}

	// Fill color
	const fill = config.color ?? d3.schemeTableau10[0];

	// Data join (D-003: key function)
	g.selectAll<SVGCircleElement, { x: number; y: number }>('circle.dot')
		.data(data, (d) => `${d.x},${d.y}`)
		.join(
			(enter) =>
				enter
					.append('circle')
					.attr('class', 'dot')
					.attr('cx', (d) => xScale(d.x))
					.attr('cy', innerH)
					.attr('r', 4)
					.attr('fill', fill!)
					.attr('opacity', 0.7)
					.on('mouseover', (event: MouseEvent, d) => {
						tooltip!.textContent = `x: ${d.x}, y: ${d.y}`;
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
							.attr('cy', (d) => yScale(d.y)),
					),
			(update) =>
				update.call((sel) =>
					sel
						.transition()
						.duration(300)
						.attr('cx', (d) => xScale(d.x))
						.attr('cy', (d) => yScale(d.y)),
				),
			(exit) => exit.call((sel) => sel.transition().duration(300).style('opacity', 0).remove()),
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
