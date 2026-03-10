// Isometry v5 -- Phase 65 Plan 02
// BarChart: D3 vertical bar chart with scaleBand + scaleLinear.
//
// Requirements: NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - Aspect ratio 5:3 (height = width * 0.6)
//   - D3 data join with key function (D-003 mandatory)
//   - 300ms transitions on enter/update/exit
//   - Hover tooltip via shared tooltip pattern
//   - d3.schemeTableau10 color palette

import * as d3 from 'd3';
import type { ChartConfig } from './ChartParser';

const MARGINS = { top: 20, right: 20, bottom: 40, left: 50 };

/**
 * Render a vertical bar chart into the given container.
 *
 * Data join keyed on `d.label` (D-003). Enter bars grow from y=0,
 * update bars morph, exit bars shrink and remove.
 */
export function renderBarChart(
	container: HTMLDivElement,
	data: { label: string; value: number }[],
	config: ChartConfig,
): void {
	const width = container.clientWidth || 300;
	const height = width * 0.6;
	const innerW = width - MARGINS.left - MARGINS.right;
	const innerH = height - MARGINS.top - MARGINS.bottom;

	// Ensure tooltip exists
	let tooltip = container.querySelector<HTMLDivElement>('.notebook-chart-tooltip');
	if (!tooltip) {
		tooltip = document.createElement('div');
		tooltip.className = 'notebook-chart-tooltip';
		container.appendChild(tooltip);
	}

	// Create or select SVG
	let svg = d3.select(container).select<SVGSVGElement>('svg');
	if (svg.empty()) {
		svg = d3.select(container)
			.append('svg')
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('preserveAspectRatio', 'xMidYMid meet');
	} else {
		svg.attr('viewBox', `0 0 ${width} ${height}`);
	}

	// Ensure root <g>
	let g = svg.select<SVGGElement>('g.bar-root');
	if (g.empty()) {
		g = svg.append('g')
			.attr('class', 'bar-root')
			.attr('transform', `translate(${MARGINS.left},${MARGINS.top})`);
		g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);
		g.append('g').attr('class', 'y-axis');
	}

	// Scales
	const x = d3.scaleBand<string>()
		.domain(data.map((d) => d.label))
		.range([0, innerW])
		.padding(0.2);

	const y = d3.scaleLinear()
		.domain([0, d3.max(data, (d) => d.value) ?? 1])
		.nice()
		.range([innerH, 0]);

	// Axes
	const xAxis = d3.axisBottom(x).tickSizeOuter(0);
	const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'));

	g.select<SVGGElement>('.x-axis')
		.transition()
		.duration(300)
		.call(xAxis as any);

	// Rotate labels if many categories
	if (data.length > 6) {
		g.select('.x-axis').selectAll('text')
			.attr('transform', 'rotate(-30)')
			.style('text-anchor', 'end');
	}

	g.select<SVGGElement>('.y-axis')
		.transition()
		.duration(300)
		.call(yAxis as any);

	// Fill color
	const fill = config.color ?? d3.schemeTableau10[0];

	// Data join (D-003: key function mandatory)
	g.selectAll<SVGRectElement, { label: string; value: number }>('rect.bar')
		.data(data, (d) => d.label)
		.join(
			(enter) =>
				enter
					.append('rect')
					.attr('class', 'bar')
					.attr('x', (d) => x(d.label) ?? 0)
					.attr('y', innerH)
					.attr('width', x.bandwidth())
					.attr('height', 0)
					.attr('fill', fill!)
					.on('mouseover', function (event: MouseEvent, d) {
						tooltip!.textContent = `${d.label}: ${d.value}`;
						tooltip!.classList.add('notebook-chart-tooltip--visible');
						const [px, py] = d3.pointer(event, container);
						tooltip!.style.left = `${px + 10}px`;
						tooltip!.style.top = `${py - 10}px`;
					})
					.on('mouseout', function () {
						tooltip!.classList.remove('notebook-chart-tooltip--visible');
					})
					.call((sel) =>
						sel
							.transition()
							.duration(300)
							.attr('y', (d) => y(d.value))
							.attr('height', (d) => innerH - y(d.value)),
					),
			(update) =>
				update.call((sel) =>
					sel
						.transition()
						.duration(300)
						.attr('x', (d) => x(d.label) ?? 0)
						.attr('width', x.bandwidth())
						.attr('y', (d) => y(d.value))
						.attr('height', (d) => innerH - y(d.value)),
				),
			(exit) =>
				exit.call((sel) =>
					sel
						.transition()
						.duration(300)
						.attr('y', innerH)
						.attr('height', 0)
						.remove(),
				),
		);

	// Title
	svg.selectAll('text.notebook-chart-title').remove();
	if (config.title) {
		svg
			.append('text')
			.attr('class', 'notebook-chart-title')
			.attr('x', width / 2)
			.attr('y', 14)
			.text(config.title);
	}
}
