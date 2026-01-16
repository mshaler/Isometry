/**
 * GridViewV2 - Isometry-powered Grid View
 *
 * Proof-of-concept view using Isometry D3 component patterns:
 * - D3ViewWrapper for React-D3 bridging
 * - iso-canvas for canvas structure
 * - CSS custom properties for theming
 * - LATCH data adapters
 *
 * Note: This view uses SVG-based card rendering. For HTML-based cards
 * with the full iso-card component, use a foreignObject or overlay layer.
 */

import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/contexts/PAFVContext';
import { D3ViewWrapper } from '@/d3/components/D3ViewWrapper';
import { nodeToCardValue } from '@/types/lpg';
import type { Node } from '@/types/node';
import type { NodeValue, CanvasDimensions } from '@/types/lpg';
import type { D3ViewCallbacks } from '@/d3/components/D3ViewWrapper';

// ============================================
// Types
// ============================================

interface GridViewV2Props {
  data: Node[];
  onNodeClick?: (node: Node) => void;
}

interface CellCard {
  node: Node;
  cardValue: NodeValue;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Map chip IDs to Node fields for PAFV axis mapping
const FIELD_MAP: Record<string, keyof Node> = {
  folder: 'folder',
  subfolder: 'status',
  tags: 'folder',
  year: 'createdAt',
  month: 'createdAt',
  category: 'folder',
  status: 'status',
  priority: 'priority',
};

// ============================================
// Helper Functions
// ============================================

function getFieldValue(node: Node, chipId: string): string {
  const field = FIELD_MAP[chipId] || 'folder';
  const value = node[field];

  if (field === 'createdAt' && value) {
    if (chipId === 'year') {
      return new Date(value as string).getFullYear().toString();
    }
    if (chipId === 'month') {
      return new Date(value as string).toLocaleString('default', { month: 'short' });
    }
  }

  return String(value ?? 'Unknown');
}

// ============================================
// Component
// ============================================

export function GridViewV2({ data, onNodeClick }: GridViewV2Props) {
  const { theme } = useTheme();
  const { wells } = usePAFV();

  // Get axis assignments from PAFV wells
  const xAxis = wells.xRows[0]?.id || 'folder';
  const yAxis = wells.yColumns[0]?.id || 'priority';

  // Convert Node[] to NodeValue[] for Isometry D3 components
  const cardData = useMemo(() => data.map(nodeToCardValue), [data]);

  // Create lookup map from NodeValue.id back to Node for click handling
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    data.forEach((node) => map.set(node.id, node));
    return map;
  }, [data]);

  // Group data by x and y axes
  const { xValues, yValues, grouped } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    const map = new Map<string, Node[]>();

    data.forEach((node) => {
      const xVal = getFieldValue(node, xAxis);
      const yVal = getFieldValue(node, yAxis);
      xSet.add(xVal);
      ySet.add(yVal);

      const key = `${xVal}|${yVal}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    });

    return {
      xValues: Array.from(xSet).sort(),
      yValues: Array.from(ySet).sort(),
      grouped: map,
    };
  }, [data, xAxis, yAxis]);

  // Render content callback for D3ViewWrapper
  const renderContent = useCallback(
    (
      contentArea: d3.Selection<SVGGElement, unknown, null, undefined>,
      _cardData: NodeValue[],
      dims: CanvasDimensions,
      _callbacks: D3ViewCallbacks<NodeValue>
    ) => {
      const margin = { top: 40, right: 20, bottom: 20, left: 100 };
      const innerWidth = dims.width - margin.left - margin.right;
      const innerHeight = dims.height - margin.top - margin.bottom;

      // Clear previous content
      contentArea.selectAll('*').remove();

      // Apply margin transform
      const g = contentArea
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales
      const xScale = d3
        .scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.1);

      const yScale = d3
        .scaleBand()
        .domain(yValues)
        .range([0, innerHeight])
        .padding(0.1);

      // Grid lines - using CSS custom properties for theming
      g.append('g')
        .attr('class', 'grid-lines')
        .selectAll('line.h')
        .data(yValues)
        .join('line')
        .attr('class', 'h')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => (yScale(d) || 0) + yScale.bandwidth())
        .attr('y2', (d) => (yScale(d) || 0) + yScale.bandwidth())
        .attr('stroke', 'var(--cb-border-subtle)')
        .attr('stroke-width', 1);

      g.selectAll('line.v')
        .data(xValues)
        .join('line')
        .attr('class', 'v')
        .attr('x1', (d) => (xScale(d) || 0) + xScale.bandwidth())
        .attr('x2', (d) => (xScale(d) || 0) + xScale.bandwidth())
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', 'var(--cb-border-subtle)')
        .attr('stroke-width', 1);

      // X axis labels (top)
      g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,-10)')
        .selectAll('text')
        .data(xValues)
        .join('text')
        .attr('x', (d) => (xScale(d) || 0) + xScale.bandwidth() / 2)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', 'var(--cb-fg-secondary)')
        .text((d) => d);

      // Y axis labels (left)
      g.append('g')
        .attr('class', 'y-axis')
        .selectAll('text')
        .data(yValues)
        .join('text')
        .attr('x', -10)
        .attr('y', (d) => (yScale(d) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', 'var(--cb-fg-secondary)')
        .text((d) => d);

      // Cell dimensions
      const cellWidth = xScale.bandwidth();
      const cellHeight = yScale.bandwidth();
      const cardWidth = Math.min(cellWidth * 0.9, 120);
      const cardHeight = Math.min(cellHeight * 0.8, 60);

      // Flatten all cards for D3 data binding
      const allCards: CellCard[] = [];

      xValues.forEach((xVal) => {
        yValues.forEach((yVal) => {
          const nodes = grouped.get(`${xVal}|${yVal}`) || [];
          const cellX = xScale(xVal) || 0;
          const cellY = yScale(yVal) || 0;

          // Position nodes in a mini-grid within the cell
          const cols = Math.max(1, Math.floor(cellWidth / (cardWidth + 4)));

          nodes.forEach((node, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = cellX + 4 + col * (cardWidth + 4);
            const y = cellY + 4 + row * (cardHeight + 4);

            allCards.push({
              node,
              cardValue: nodeToCardValue(node),
              x,
              y,
              width: cardWidth,
              height: cardHeight,
            });
          });
        });
      });

      // Render all cards using D3 data join
      const cardGroups = g
        .selectAll<SVGGElement, CellCard>('.card-group')
        .data(allCards, (d) => d.node.id)
        .join(
          (enter) =>
            enter
              .append('g')
              .attr('class', 'card-group')
              .attr('transform', (d) => `translate(${d.x},${d.y})`),
          (update) =>
            update
              .transition()
              .duration(300)
              .attr('transform', (d) => `translate(${d.x},${d.y})`),
          (exit) =>
            exit
              .transition()
              .duration(200)
              .style('opacity', 0)
              .remove()
        );

      // Card background - uses CSS custom properties
      cardGroups
        .selectAll<SVGRectElement, CellCard>('.card-rect')
        .data((d) => [d])
        .join('rect')
        .attr('class', 'card-rect')
        .attr('width', (d) => d.width)
        .attr('height', (d) => d.height)
        .attr('rx', theme === 'NeXTSTEP' ? 0 : 'var(--cb-radius-sm)')
        .attr('fill', theme === 'NeXTSTEP' ? 'var(--cb-bg-raised)' : 'var(--cb-bg-glass)')
        .attr('stroke', 'var(--cb-border-default)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', function (_event, d) {
          if (onNodeClick) {
            onNodeClick(d.node);
          }
        })
        .on('mouseenter', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('fill', theme === 'NeXTSTEP' ? '#c8c8c8' : 'var(--cb-bg-raised)');
        })
        .on('mouseleave', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('fill', theme === 'NeXTSTEP' ? 'var(--cb-bg-raised)' : 'var(--cb-bg-glass)');
        });

      // Card title
      cardGroups
        .selectAll<SVGTextElement, CellCard>('.card-title')
        .data((d) => [d])
        .join('text')
        .attr('class', 'card-title')
        .attr('x', 6)
        .attr('y', 16)
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .attr('fill', 'var(--cb-fg-primary)')
        .style('pointer-events', 'none')
        .text((d) =>
          d.node.name.length > 15 ? d.node.name.slice(0, 15) + '...' : d.node.name
        );

      // Priority badge
      cardGroups
        .selectAll<SVGTextElement, CellCard>('.card-priority')
        .data((d) => [d])
        .join('text')
        .attr('class', 'card-priority')
        .attr('x', (d) => d.width - 6)
        .attr('y', 16)
        .attr('text-anchor', 'end')
        .attr('font-size', '11px')
        .attr('fill', 'var(--cb-fg-muted)')
        .style('pointer-events', 'none')
        .text((d) => `P${d.node.priority}`);

      // Return cleanup function
      return () => {
        contentArea.selectAll('*').remove();
      };
    },
    [xValues, yValues, grouped, onNodeClick, theme]
  );

  return (
    <D3ViewWrapper<NodeValue>
      data={cardData}
      viewType="grid"
      background="solid"
      zoomable={false}
      renderContent={renderContent}
      onNodeClick={(nodeValue) => {
        const node = nodeMap.get(nodeValue.id);
        if (node && onNodeClick) {
          onNodeClick(node);
        }
      }}
      emptyMessage="No items to display"
      className="grid-view-v2"
    />
  );
}

export default GridViewV2;
