import { useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { D3ViewWrapper } from '@/d3/components/D3ViewWrapper';
import { cbCard } from '@/d3/components/cb-card';
import { nodeToCardValue } from '@/types/lpg';
import type { D3ViewCallbacks, CanvasDimensions } from '@/types/lpg';
import { sampleNodes } from './data/sampleData';

export function D3ViewWrapperDemo() {
  const { theme } = useTheme();
  const [lastEvent, setLastEvent] = useState<string>('None');
  const [selectedCount, setSelectedCount] = useState(0);

  const cardData = useMemo(() => sampleNodes.slice(0, 3).map(nodeToCardValue), []);

  const canvasDimensions: CanvasDimensions = {
    width: 600,
    height: 400,
    viewBox: { x: 0, y: 0, width: 600, height: 400 },
  };

  const callbacks: D3ViewCallbacks = {
    onCardClick: useCallback((event) => {
      setLastEvent(`Card clicked: ${event.data?.name || 'Unknown'}`);
    }, []),
    onCardHover: useCallback((event) => {
      setLastEvent(`Card hovered: ${event.data?.name || 'Unknown'}`);
    }, []),
    onCanvasClick: useCallback((event) => {
      setLastEvent(`Canvas clicked at (${event.x}, ${event.y})`);
    }, []),
    onSelectionChange: useCallback((selectedIds) => {
      setSelectedCount(selectedIds.length);
      setLastEvent(`Selection changed: ${selectedIds.length} items`);
    }, []),
  };

  const renderContent = useCallback(
    (contentLayer: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      // Create card component
      const card = cbCard()
        .variant('default')
        .size('md')
        .interactive(true);

      // Position cards horizontally
      cardData.forEach((data, i) => {
        const x = 50 + i * 200;
        const y = 200;

        const cardGroup = contentLayer
          .append('g')
          .attr('transform', `translate(${x}, ${y})`)
          .datum(data);

        cardGroup.call(card);
      });

      // Add connecting lines
      for (let i = 0; i < cardData.length - 1; i++) {
        const x1 = 150 + i * 200;
        const x2 = x1 + 100;
        const y = 250;

        contentLayer
          .append('line')
          .attr('x1', x1)
          .attr('y1', y)
          .attr('x2', x2)
          .attr('y2', y)
          .attr('stroke', 'var(--cb-accent-blue)')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('opacity', 0.5);
      }
    },
    [cardData]
  );

  const renderOverlay = useCallback(
    (overlayLayer: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      // Add title
      overlayLayer
        .append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', 'var(--cb-fg-secondary)')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .text('D3ViewWrapper Demo');

      // Add selection indicator
      overlayLayer
        .append('text')
        .attr('x', 20)
        .attr('y', 380)
        .attr('fill', 'var(--cb-fg-tertiary)')
        .attr('font-size', '12px')
        .text(`Selected: ${selectedCount} items`);
    },
    [selectedCount]
  );

  return (
    <div>
      <D3ViewWrapper
        dimensions={canvasDimensions}
        background="dots"
        callbacks={callbacks}
        renderContent={renderContent}
        renderOverlay={renderOverlay}
        className={`border rounded-lg ${
          theme === 'NeXTSTEP'
            ? 'border-[#707070]'
            : 'border-gray-200'
        }`}
      />
      <div className={`mt-4 text-sm ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>
        Last event: <span className="font-medium">{lastEvent}</span>
      </div>
      <p className={`mt-2 text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
        React-D3 bridge with lifecycle management, callbacks, and separate render functions
      </p>
    </div>
  );
}