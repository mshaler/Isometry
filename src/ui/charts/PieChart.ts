// Isometry v5 -- Phase 65 Plan 02
// PieChart: D3 donut chart with d3.pie + d3.arc.
//
// Requirements: NOTE-06, NOTE-07, NOTE-08
//
// Design:
//   - Square SVG (1:1 aspect ratio)
//   - Donut: innerRadius = radius * 0.5
//   - D3 data join keyed on d.data.label (D-003)
//   - 300ms arc transitions via d3.interpolate
//   - Hover tooltip showing "label: value (percentage%)"

import * as d3 from 'd3';
import type { ChartConfig } from './ChartParser';

/**
 * Render a donut/pie chart into the given container.
 *
 * Data join keyed on `d.data.label` (D-003). Arcs animate on enter
 * and update via startAngle/endAngle interpolation.
 */
export function renderPieChart(
	container: HTMLDivElement,
	data: { label: string; value: number }[],
	config: ChartConfig,
): void {
	const width = container.clientWidth || 300;
	const height = width; // Square
	const radius = Math.min(width, height) / 2 - 10;

	// Ensure tooltip exists
	let tooltip = container.querySelector<HTMLDivElement>('.notebook-chart-tooltip');
	if (!tooltip) {
		tooltip = document.createElement('div');
		tooltip.className = 'notebook-chart-tooltip';
		container.appendChild(tooltip);
	}

	const totalValue = d3.sum(data, (d) => d.value);

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
	let g = svg.select<SVGGElement>('g.pie-root');
	if (g.empty()) {
		g = svg.append('g')
			.attr('class', 'pie-root')
			.attr('transform', `translate(${width / 2},${height / 2})`);
	}

	// Pie layout
	const pie = d3.pie<{ label: string; value: number }>()
		.value((d) => d.value)
		.sort(null); // Preserve data order

	const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>()
		.innerRadius(radius * 0.5)
		.outerRadius(radius);

	const arcs = pie(data);
	const color = d3.scaleOrdinal<string>().domain(data.map((d) => d.label)).range(d3.schemeTableau10);

	// Data join (D-003: key function on d.data.label)
	g.selectAll<SVGPathElement, d3.PieArcDatum<{ label: string; value: number }>>('path.arc')
		.data(arcs, (d) => d.data.label)
		.join(
			(enter) =>
				enter
					.append('path')
					.attr('class', 'arc')
					.attr('fill', (d) => color(d.data.label))
					.on('mouseover', function (event: MouseEvent, d) {
						const pct = totalValue > 0 ? ((d.data.value / totalValue) * 100).toFixed(1) : '0';
						tooltip!.textContent = `${d.data.label}: ${d.data.value} (${pct}%)`;
						tooltip!.classList.add('notebook-chart-tooltip--visible');
						const [px, py] = d3.pointer(event, container);
						tooltip!.style.left = `${px + 10}px`;
						tooltip!.style.top = `${py - 10}px`;
					})
					.on('mouseout', function () {
						tooltip!.classList.remove('notebook-chart-tooltip--visible');
					})
					.each(function (d) {
						// Store initial angles for transition
						(this as any).__prev = { startAngle: d.startAngle, endAngle: d.startAngle };
					})
					.call((sel) =>
						sel
							.transition()
							.duration(300)
							.attrTween('d', function (d) {
								const prev = (this as any).__prev || { startAngle: 0, endAngle: 0 };
								const interp = d3.interpolate(prev, { startAngle: d.startAngle, endAngle: d.endAngle });
								return (t: number) => {
									(this as any).__prev = interp(t);
									return arc(interp(t) as any) ?? '';
								};
							}),
					),
			(update) =>
				update.call((sel) =>
					sel
						.transition()
						.duration(300)
						.attrTween('d', function (d) {
							const prev = (this as any).__prev || { startAngle: 0, endAngle: 0 };
							const interp = d3.interpolate(prev, { startAngle: d.startAngle, endAngle: d.endAngle });
							return (t: number) => {
								(this as any).__prev = interp(t);
								return arc(interp(t) as any) ?? '';
							};
						}),
				),
			(exit) =>
				exit.call((sel) =>
					sel
						.transition()
						.duration(300)
						.style('opacity', 0)
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
