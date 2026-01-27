import { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { cbCanvas } from '@/d3/components/cb-canvas';
import { nodeToCardValue } from '@/types/lpg';
import type { BackgroundPattern } from '@/types/lpg';
import { sampleNodes } from './data/sampleData';

// ============================================
// Types for D3 Component Integration
// ============================================

// CardRenderer interface removed - using D3 component type inference instead

export function CbCanvasDemo() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern>('grid');

  const cardData = useMemo(() => sampleNodes.slice(0, 6).map(nodeToCardValue), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = d3.select(containerRef.current);
    container.selectAll('*').remove();

    // Create canvas
    const canvas = cbCanvas()
      .viewType('grid')
      .background(backgroundPattern)
      .zoomable(true);

    // Render canvas
    const canvasContainer = container
      .append('div')
      .style('width', '100%')
      .style('height', '400px')
      .style('border', theme === 'NeXTSTEP'
        ? '2px solid #707070'
        : '1px solid #e5e7eb')
      .style('border-radius', '8px')
      .style('overflow', 'hidden');

    canvasContainer.call(canvas);

    // Get content layer and add SVG cards
    const contentLayer = canvas.getContentArea();
    if (contentLayer) {
      // Position cards in a grid using SVG elements
      cardData.forEach((data, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 100 + col * 250;
        const y = 100 + row * 200;
        const cardWidth = 200;
        const cardHeight = 150;

        const cardGroup = contentLayer
          .append('g')
          .attr('transform', `translate(${x}, ${y})`)
          .attr('class', 'svg-card')
          .style('cursor', 'pointer');

        // Card background
        cardGroup
          .append('rect')
          .attr('width', cardWidth)
          .attr('height', cardHeight)
          .attr('rx', 8)
          .attr('fill', theme === 'NeXTSTEP' ? '#f0f0f0' : 'white')
          .attr('stroke', theme === 'NeXTSTEP' ? '#707070' : '#e5e7eb')
          .attr('stroke-width', 1);

        // Card title
        cardGroup
          .append('text')
          .attr('x', 12)
          .attr('y', 20)
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', theme === 'NeXTSTEP' ? '#404040' : '#374151')
          .text(data.name);

        // Card type badge
        cardGroup
          .append('text')
          .attr('x', 12)
          .attr('y', 40)
          .attr('font-size', '12px')
          .attr('fill', theme === 'NeXTSTEP' ? '#606060' : '#6b7280')
          .text(data.nodeType);

        // Card content
        cardGroup
          .append('text')
          .attr('x', 12)
          .attr('y', 65)
          .attr('font-size', '12px')
          .attr('fill', theme === 'NeXTSTEP' ? '#606060' : '#6b7280')
          .text(data.content?.substring(0, 60) + (data.content && data.content.length > 60 ? '...' : ''));

        // Add hover effects
        cardGroup
          .on('mouseenter', function() {
            d3.select(this).select('rect')
              .attr('fill', theme === 'NeXTSTEP' ? '#e0e0e0' : '#f9fafb');
          })
          .on('mouseleave', function() {
            d3.select(this).select('rect')
              .attr('fill', theme === 'NeXTSTEP' ? '#f0f0f0' : 'white');
          });
      });
    }

    // Get overlay layer and add title
    const overlayLayer = canvas.getOverlayArea();
    if (overlayLayer) {
      overlayLayer
        .append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', 'var(--cb-fg-secondary)')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .text('cb-canvas with content and overlay layers');
    }
  }, [cardData, backgroundPattern, theme]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <span className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>
          Background:
        </span>
        {(['none', 'dots', 'grid'] as BackgroundPattern[]).map((pattern) => (
          <label key={pattern} className="flex items-center gap-1">
            <input
              type="radio"
              value={pattern}
              checked={backgroundPattern === pattern}
              onChange={(e) => setBackgroundPattern(e.target.value as BackgroundPattern)}
              className="form-radio text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'}`}>
              {pattern}
            </span>
          </label>
        ))}
      </div>
      <div ref={containerRef} />
      <p className={`mt-2 text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
        Canvas supports zoom/pan interaction, background patterns, and separate content/overlay layers
      </p>
    </div>
  );
}