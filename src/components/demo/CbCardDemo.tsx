import { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { cbCard } from '@/d3/components/cb-card';
import { nodeToCardValue } from '@/types/lpg';
import type { CardVariant } from '@/types/lpg';
import { sampleNodes } from './data/sampleData';

export function CbCardDemo() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const cardData = useMemo(() => sampleNodes.slice(0, 4).map(nodeToCardValue), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    container.selectAll('*').remove();

    // Create cards for each variant
    const variants: CardVariant[] = ['default', 'glass', 'elevated', 'outline'];

    variants.forEach((variant, i) => {
      const cardWrapper = container
        .append('div')
        .attr('class', 'inline-block mr-4 mb-4')
        .style('width', '200px');

      // Add variant label
      cardWrapper
        .append('div')
        .attr('class', `text-xs mb-2 ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`)
        .text(`variant="${variant}"`);

      // Create card component
      const card = cbCard()
        .variant(variant)
        .size('md')
        .interactive(true)
        .on('click', (event) => {
          if (event.data) {
            setSelectedIds((prev) =>
              prev.includes(event.data!.id)
                ? prev.filter((id) => id !== event.data!.id)
                : [...prev, event.data!.id]
            );
          }
        });

      // Render card
      cardWrapper
        .append('div')
        .datum(cardData[i])
        .call(card);
    });
  }, [cardData, theme]);

  return (
    <div>
      <div ref={containerRef} className="flex flex-wrap" />
      <div className={`mt-4 text-sm ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>
        Selected: {selectedIds.length > 0 ? selectedIds.join(', ') : 'None'} (click cards to select)
      </div>
    </div>
  );
}