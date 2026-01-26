import { useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { D3ViewWrapper } from '@/d3/components/D3ViewWrapper';
import { cbCard } from '@/d3/components/cb-card';
import { nodeToCardValue } from '@/types/lpg';
import type { CardValue } from '@/types/lpg';
import { sampleNodes } from './data/sampleData';

// ============================================
// Types for D3 View Component Integration
// ============================================

/** View renderer interface for D3 view wrapper calls */
interface ViewRenderer {
  (selection: d3.Selection<SVGGElement, CardValue, null, undefined>): void;
}

export function D3ViewWrapperDemo() {
  const { theme } = useTheme();
  const [lastEvent, setLastEvent] = useState<string>('None');

  const cardData = useMemo(() => sampleNodes.slice(0, 3).map(nodeToCardValue), []);

  const onNodeClick = useCallback((node: CardValue) => {
    setLastEvent(`Node clicked: ${(node.type === 'node' ? node.name : node.id) || 'Unknown'}`);
  }, []);

  const onNodeHover = useCallback((node: CardValue | null) => {
    if (node) {
      setLastEvent(`Node hovered: ${(node.type === 'node' ? node.name : node.id) || 'Unknown'}`);
    }
  }, []);

  const onSelectionChange = useCallback((selected: CardValue[]) => {
    setLastEvent(`Selection changed: ${selected.length} items`);
  }, []);

  const renderContent = useCallback(
    (
      contentArea: d3.Selection<SVGGElement, unknown, null, undefined>,
      data: CardValue[]
    ) => {
      // Create card component
      const card = cbCard()
        .variant('default')
        .size('md')
        .interactive(true);

      // Position cards horizontally
      data.forEach((cardValue, i) => {
        const x = 50 + i * 200;
        const y = 200;

        const cardGroup = contentArea
          .append('g')
          .attr('transform', `translate(${x}, ${y})`)
          .datum(cardValue);

        // Use .call() correctly for d3 components
        cardGroup.call(card as ViewRenderer);
      });

      // Add connecting lines
      for (let i = 0; i < data.length - 1; i++) {
        const x1 = 150 + i * 200;
        const x2 = x1 + 100;
        const y = 250;

        contentArea
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
    []
  );


  return (
    <div>
      <D3ViewWrapper
        data={cardData}
        viewType="grid"
        background="dots"
        renderContent={renderContent}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        onSelectionChange={onSelectionChange}
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