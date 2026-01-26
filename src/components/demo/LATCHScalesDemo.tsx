import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { createLATCHScale } from '@/d3/scales';
import { nodeToCardValue } from '@/types/lpg';
import { sampleNodes } from './data/sampleData';

export function LATCHScalesDemo() {
  const { theme } = useTheme();
  const containerRef = useRef<SVGSVGElement>(null);

  const cardData = useMemo(() => sampleNodes.map(nodeToCardValue), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const svg = d3.select(containerRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 400;
    const margin = { top: 60, right: 40, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', width)
      .attr('height', height)
      .style('background', 'var(--cb-bg-primary)');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Create LATCH scales
    const categoryScale = createLATCHScale(
      'category',
      cardData,
      [0, innerWidth]
    );

    const hierarchyScale = createLATCHScale(
      'hierarchy',
      cardData,
      [innerHeight, 0] // Inverted for SVG coordinates
    );

    // Draw axes
    // X-axis (Category) - using the scale directly since it's already a proper D3 scale
    const xAxis = d3
      .axisBottom(categoryScale as d3.AxisScale<string>)
      .tickFormat((d) => String(d));

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', 'var(--cb-fg-secondary)')
      .attr('font-size', '11px');

    // Y-axis (Hierarchy)
    const yAxis = d3
      .axisLeft(hierarchyScale as d3.AxisScale<number>)
      .tickFormat((d) => `P${d}`);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', 'var(--cb-fg-secondary)')
      .attr('font-size', '11px');

    // Add axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--cb-fg-primary)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text('Category (folder)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--cb-fg-primary)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text('Priority (hierarchy)');

    // Plot data points
    g.selectAll('.data-point')
      .data(cardData)
      .join('circle')
      .attr('class', 'data-point')
      .attr('cx', (d) => {
        const pos = categoryScale.getPosition(d);
        const bandwidth = categoryScale.bandwidth?.() ?? 0;
        return (pos ?? 0) + bandwidth / 2;
      })
      .attr('cy', (d) => hierarchyScale.getPosition(d) ?? 0)
      .attr('r', 8)
      .attr('fill', 'var(--cb-accent-blue)')
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_, d) {
        d3.select(this).transition().duration(150).attr('r', 12).attr('opacity', 1);

        // Show tooltip
        g.append('text')
          .attr('class', 'tooltip')
          .attr('x', (categoryScale.getPosition(d) ?? 0) + (categoryScale.bandwidth?.() ?? 0) / 2)
          .attr('y', (hierarchyScale.getPosition(d) ?? 0) - 15)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--cb-fg-primary)')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .text(d.name ?? 'Unknown');
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('r', 8).attr('opacity', 0.8);
        g.selectAll('.tooltip').remove();
      });
  }, [cardData, theme]);

  return (
    <div>
      <svg ref={containerRef} className="w-full" />
      <p className={`mt-2 text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
        LATCH scales map Category (folder) to X-axis and Hierarchy (priority) to Y-axis
      </p>
    </div>
  );
}