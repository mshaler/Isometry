/**
 * GridCell - Janus Density Grid Cell Component
 *
 * Implements the core grid cell rendering with morphing transitions
 * between density states. Integrates with D3.js data binding using
 * proper key functions and supports the Janus model's orthogonal
 * Pan × Zoom density controls.
 *
 * Architecture: D3.js handles data binding and transitions,
 * React handles complex UI controls when needed.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  type CellData,
  type DensityMorphConfig,
  type CellTransitionState,
  DEFAULT_DENSITY_CONFIG,
  isCellData
} from '../../types/grid';
import { type Node } from '../../types/node';

export interface GridCellProps {
  cellData: CellData;
  onCellClick?: (cell: CellData, event: MouseEvent) => void;
  onCellHover?: (cell: CellData | null) => void;
  morphConfig?: Partial<DensityMorphConfig>;
  className?: string;
}

/**
 * Hook for managing cell density state and morphing transitions
 */
function useCellDensityInternal(
  cellData: CellData,
  morphConfig: DensityMorphConfig = DEFAULT_DENSITY_CONFIG
) {
  const currentDensity = cellData.densityLevel ?? 0;
  const previousDensity = useRef<number>(currentDensity);
  const transitionState = useRef<CellTransitionState | null>(null);

  // Detect density changes and initiate transitions
  useEffect(() => {
    if (previousDensity.current !== currentDensity) {
      transitionState.current = {
        cellId: cellData.id,
        fromMode: String(previousDensity.current),
        toMode: String(currentDensity),
        isAnimating: true,
        isTransitioning: true,
        fromDensity: previousDensity.current,
        toDensity: currentDensity,
        progress: 0,
        easing: 'ease-out',
        duration: morphConfig.transitions.duration
      };
      previousDensity.current = currentDensity;
    }
  }, [currentDensity, cellData.id, morphConfig.transitions.duration]);

  // Determine render mode based on card count and density level
  const renderMode = useMemo(() => {
    const cardCount = cellData.cards.length;

    if (cardCount === 0) return 'empty';
    if (cardCount === 1) return 'single';
    if (cardCount <= morphConfig.thresholds.sparseToGroup) return 'sparse';
    if (cardCount <= morphConfig.thresholds.groupToRollup) return 'group';
    if (cardCount <= morphConfig.thresholds.rollupToCollapse) return 'rollup';
    return 'collapsed';
  }, [cellData.cards.length, morphConfig.thresholds]);

  return {
    renderMode,
    transitionState: transitionState.current,
    shouldShowCount: cellData.cards.length > 1,
    cardCount: cellData.cards.length
  };
}

/**
 * GridCell component with D3.js integration and morphing transitions
 */
export function GridCell({
  cellData,
  onCellClick,
  onCellHover,
  morphConfig = DEFAULT_DENSITY_CONFIG,
  className = ''
}: GridCellProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Merge partial config with defaults
  const fullMorphConfig: DensityMorphConfig = {
    thresholds: { ...DEFAULT_DENSITY_CONFIG.thresholds, ...morphConfig?.thresholds },
    transitions: { ...DEFAULT_DENSITY_CONFIG.transitions, ...morphConfig?.transitions },
    visual: { ...DEFAULT_DENSITY_CONFIG.visual, ...morphConfig?.visual }
  };

  const { renderMode, cardCount } = useCellDensityInternal(cellData, fullMorphConfig);

  // D3.js rendering with proper data binding
  const renderCellContent = useCallback(() => {
    if (!svgRef.current || !isCellData(cellData)) return;

    const svg = d3.select(svgRef.current);
    const cellGroup = svg.select('.cell-group');

    // Clear existing content for re-render
    cellGroup.selectAll('*').remove();

    // Render based on current mode with proper D3.js patterns
    switch (renderMode) {
      case 'empty':
        renderEmptyCell(cellGroup);
        break;
      case 'single':
        renderSingleCard(cellGroup, cellData.cards[0], cellData);
        break;
      case 'sparse':
        renderCardStack(cellGroup, cellData.cards, cellData, fullMorphConfig);
        break;
      case 'group':
      case 'rollup':
      case 'collapsed':
        renderCountBadge(cellGroup, cardCount, cellData, fullMorphConfig);
        break;
    }
  }, [renderMode, cellData, cardCount, fullMorphConfig]);

  // Set up D3.js container and event handlers
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Create main cell group if it doesn't exist
    if (svg.select('.cell-group').empty()) {
      const cellGroup = svg.append('g').attr('class', 'cell-group');

      // Add interaction handlers
      cellGroup
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          onCellClick?.(cellData, event);
        })
        .on('mouseenter', () => {
          onCellHover?.(cellData);
        })
        .on('mouseleave', () => {
          onCellHover?.(null);
        });
    }

    // Render cell content
    renderCellContent();
  }, [cellData, renderCellContent, onCellClick, onCellHover]);

  // Handle morphing transitions when density changes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const cellGroup = svg.select('.cell-group');

    // Apply morphing transition animation
    cellGroup
      .transition()
      .duration(fullMorphConfig.transitions.duration)
      .ease(d3.easeBackOut)
      .attr('transform', `translate(0, 0)`) // Reset any transform
      .on('end', () => {
        // Ensure final state is rendered correctly
        renderCellContent();
      });
  }, [renderMode, fullMorphConfig.transitions.duration, renderCellContent]);

  return (
    <svg
      ref={svgRef}
      width="120"
      height="80"
      viewBox="0 0 120 80"
      className={`grid-cell ${className}`}
      style={{ overflow: 'visible' }}
    />
  );
}

/**
 * Render empty cell state
 */
function renderEmptyCell(group: d3.Selection<d3.BaseType, unknown, null, undefined>) {
  group.append('rect')
    .attr('width', 120)
    .attr('height', 80)
    .attr('rx', 6)
    .attr('fill', '#f9fafb')
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.5);

  group.append('text')
    .attr('x', 60)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'system-ui, sans-serif')
    .attr('font-size', '12px')
    .attr('fill', '#9ca3af')
    .text('Empty');
}

/**
 * Render single card with full details (sparse state)
 */
function renderSingleCard(
  group: d3.Selection<d3.BaseType, unknown, null, undefined>,
  card: Node,
  _cellData: CellData
) {
  // Card background
  group.append('rect')
    .attr('width', 120)
    .attr('height', 80)
    .attr('rx', 6)
    .attr('fill', '#ffffff')
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 1)
    .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))');

  // Card title
  group.append('text')
    .attr('x', 8)
    .attr('y', 20)
    .attr('font-family', 'system-ui, sans-serif')
    .attr('font-size', '14px')
    .attr('font-weight', '600')
    .attr('fill', '#111827')
    .text(truncateText(card.name || 'Untitled', 14));

  // Metadata (folder/category)
  if (card.folder) {
    group.append('text')
      .attr('x', 8)
      .attr('y', 40)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280')
      .text(truncateText(card.folder, 16));
  }

  // Status indicator
  group.append('circle')
    .attr('cx', 108)
    .attr('cy', 12)
    .attr('r', 4)
    .attr('fill', getStatusColor(card.status || 'default'));

  // Hover effect
  group
    .on('mouseenter', function() {
      d3.select(this)
        .select('rect')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .select('rect')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1);
    });
}

/**
 * Render stacked cards (group state)
 */
function renderCardStack(
  group: d3.Selection<d3.BaseType, unknown, null, undefined>,
  cards: Node[],
  _cellData: CellData,
  morphConfig: DensityMorphConfig
) {
  const maxVisible = Math.min(cards.length, morphConfig.visual.cardStackMaxVisible);
  const stackOffset = morphConfig.visual.cardStackOffset;

  // Render stack of cards with offset
  for (let i = maxVisible - 1; i >= 0; i--) {
    const card = cards[i];
    const offset = i * stackOffset;

    const cardGroup = group.append('g')
      .attr('transform', `translate(${offset}, ${offset})`);

    // Card background
    cardGroup.append('rect')
      .attr('width', 120 - offset * 2)
      .attr('height', 80 - offset * 2)
      .attr('rx', 6)
      .attr('fill', i === 0 ? '#ffffff' : '#f9fafb')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('opacity', 1 - i * 0.2);

    // Only show content on top card
    if (i === 0) {
      cardGroup.append('text')
        .attr('x', 8)
        .attr('y', 20)
        .attr('font-family', 'system-ui, sans-serif')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .attr('fill', '#111827')
        .text(truncateText(card.name || 'Untitled', 12));

      // Count badge in corner
      const countBadge = cardGroup.append('g')
        .attr('transform', 'translate(90, 8)');

      countBadge.append('circle')
        .attr('r', 12)
        .attr('fill', '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);

      countBadge.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-family', 'system-ui, sans-serif')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('fill', '#ffffff')
        .text(cards.length.toString());
    }
  }
}

/**
 * Render count badge (dense states: rollup/collapsed)
 */
function renderCountBadge(
  group: d3.Selection<d3.BaseType, unknown, null, undefined>,
  count: number,
  _cellData: CellData,
  morphConfig: DensityMorphConfig
) {
  const badgeSize = Math.min(
    morphConfig.visual.countBadgeMaxSize,
    Math.max(morphConfig.visual.countBadgeMinSize, 16 + Math.log10(count) * 8)
  );

  // Background circle
  group.append('circle')
    .attr('cx', 60)
    .attr('cy', 40)
    .attr('r', badgeSize)
    .attr('fill', '#3b82f6')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 3)
    .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))');

  // Count text
  group.append('text')
    .attr('x', 60)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-family', 'system-ui, sans-serif')
    .attr('font-size', `${Math.min(18, badgeSize * 0.7)}px`)
    .attr('font-weight', '700')
    .attr('fill', '#ffffff')
    .text(formatCount(count));

  // Pulse animation for large counts
  if (count > 20) {
    group.select('circle')
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('r', badgeSize * 1.1)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr('r', badgeSize)
      .on('end', function repeat() {
        d3.select(this)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('r', badgeSize * 1.1)
          .transition()
          .duration(2000)
          .ease(d3.easeLinear)
          .attr('r', badgeSize)
          .on('end', repeat);
      });
  }

  // Hover effect for count badge
  group
    .on('mouseenter', function() {
      d3.select(this)
        .select('circle')
        .transition()
        .duration(150)
        .attr('r', badgeSize * 1.2);
    })
    .on('mouseleave', function() {
      d3.select(this)
        .select('circle')
        .transition()
        .duration(150)
        .attr('r', badgeSize);
    });
}

/**
 * Helper Functions
 */

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#10b981';
    case 'completed': return '#6b7280';
    case 'blocked': return '#ef4444';
    case 'in_progress': return '#f59e0b';
    default: return '#9ca3af';
  }
}

function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${Math.round(count / 100) / 10}k`;
  return `${Math.round(count / 100000) / 10}M`;
}

/**
 * Export hook for external use in D3.js SuperGrid integration
 */
export const useCellDensity = useCellDensityInternal;