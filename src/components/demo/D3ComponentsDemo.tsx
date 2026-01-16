/**
 * D3 Components Demo
 *
 * Visual testing page for Isometry D3 components.
 * Showcases iso-card, iso-canvas, D3ViewWrapper, and LATCH scales.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/contexts/ThemeContext';
import { cbCard } from '@/d3/components/cb-card';
import { cbCanvas } from '@/d3/components/cb-canvas';
import { D3ViewWrapper } from '@/d3/components/D3ViewWrapper';
import { createLATCHScale } from '@/d3/scales';
import { nodeToCardValue } from '@/types/lpg';
import type { Node } from '@/types/node';
import type { NodeValue, CardVariant, CanvasDimensions, BackgroundPattern } from '@/types/lpg';
import type { D3ViewCallbacks } from '@/d3/components/D3ViewWrapper';

// ============================================
// Sample Data
// ============================================

const sampleNodes: Node[] = [
  {
    id: '1',
    nodeType: 'task',
    name: 'Design System Setup',
    content: 'Create foundational design tokens and component library',
    summary: 'Design tokens and components',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-15T10:00:00Z',
    modifiedAt: '2024-01-15T10:00:00Z',
    dueAt: '2024-02-01T10:00:00Z',
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Development',
    tags: ['design', 'ui'],
    status: 'active',
    priority: 1,
    importance: 5,
    sortOrder: 1,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  {
    id: '2',
    nodeType: 'task',
    name: 'API Integration',
    content: 'Connect frontend to backend REST API',
    summary: 'REST API connection',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-20T10:00:00Z',
    modifiedAt: '2024-01-20T10:00:00Z',
    dueAt: '2024-02-15T10:00:00Z',
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Development',
    tags: ['api', 'backend'],
    status: 'pending',
    priority: 2,
    importance: 4,
    sortOrder: 2,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  {
    id: '3',
    nodeType: 'note',
    name: 'Architecture Notes',
    content: 'Documentation for system architecture decisions',
    summary: 'Architecture docs',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-10T10:00:00Z',
    modifiedAt: '2024-01-10T10:00:00Z',
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Documentation',
    tags: ['docs', 'architecture'],
    status: null,
    priority: 3,
    importance: 3,
    sortOrder: 3,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  {
    id: '4',
    nodeType: 'task',
    name: 'User Testing',
    content: 'Conduct user testing sessions with beta users',
    summary: 'Beta testing',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-02-01T10:00:00Z',
    modifiedAt: '2024-02-01T10:00:00Z',
    dueAt: '2024-03-01T10:00:00Z',
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Research',
    tags: ['ux', 'testing'],
    status: 'pending',
    priority: 4,
    importance: 4,
    sortOrder: 4,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  {
    id: '5',
    nodeType: 'task',
    name: 'Performance Optimization',
    content: 'Optimize rendering performance for large datasets',
    summary: 'Performance work',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-25T10:00:00Z',
    modifiedAt: '2024-01-25T10:00:00Z',
    dueAt: '2024-02-20T10:00:00Z',
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Development',
    tags: ['performance', 'optimization'],
    status: 'active',
    priority: 2,
    importance: 5,
    sortOrder: 5,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  {
    id: '6',
    nodeType: 'task',
    name: 'Documentation Update',
    content: 'Update API documentation with new endpoints',
    summary: 'API docs update',
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-02-05T10:00:00Z',
    modifiedAt: '2024-02-05T10:00:00Z',
    dueAt: '2024-02-28T10:00:00Z',
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Documentation',
    tags: ['docs', 'api'],
    status: 'pending',
    priority: 5,
    importance: 2,
    sortOrder: 6,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
];

// ============================================
// Demo Section Components
// ============================================

function DemoSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <section className="mb-8">
      <h2
        className={`text-lg font-semibold mb-1 ${
          theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-800'
        }`}
      >
        {title}
      </h2>
      <p
        className={`text-sm mb-4 ${
          theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
        }`}
      >
        {description}
      </p>
      <div
        className={`rounded-lg p-4 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
            : 'bg-white border border-gray-200 shadow-sm'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

// ============================================
// cb-card Demo
// ============================================

function CbCardDemo() {
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

// ============================================
// cb-canvas Demo
// ============================================

function CbCanvasDemo() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [background, setBackground] = useState<BackgroundPattern>('dots');
  const [zoomable, setZoomable] = useState(true);
  const canvasRef = useRef<ReturnType<typeof cbCanvas> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create or update canvas
    if (!canvasRef.current) {
      canvasRef.current = cbCanvas();
    }

    canvasRef.current
      .viewType('grid')
      .background(background)
      .zoomable(zoomable)
      .padding({ top: 20, right: 20, bottom: 20, left: 20 });

    d3.select(containerRef.current).call(canvasRef.current);

    // Get content area and draw some shapes
    const contentArea = canvasRef.current.getContentArea();
    if (contentArea) {
      contentArea.selectAll('*').remove();

      // Draw sample content
      const data = [
        { x: 50, y: 50, r: 30, color: 'var(--cb-accent-blue)' },
        { x: 150, y: 80, r: 25, color: 'var(--cb-accent-purple)' },
        { x: 100, y: 150, r: 35, color: 'var(--cb-accent-green)' },
        { x: 200, y: 120, r: 20, color: 'var(--cb-accent-orange)' },
      ];

      contentArea
        .selectAll('circle')
        .data(data)
        .join('circle')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', (d) => d.r)
        .attr('fill', (d) => d.color)
        .attr('opacity', 0.8)
        .style('cursor', 'pointer')
        .on('mouseenter', function () {
          d3.select(this).transition().duration(150).attr('opacity', 1);
        })
        .on('mouseleave', function () {
          d3.select(this).transition().duration(150).attr('opacity', 0.8);
        });

      // Add connecting lines
      contentArea
        .selectAll('line')
        .data([
          { x1: 50, y1: 50, x2: 150, y2: 80 },
          { x1: 150, y1: 80, x2: 100, y2: 150 },
          { x1: 100, y1: 150, x2: 200, y2: 120 },
        ])
        .join('line')
        .attr('x1', (d) => d.x1)
        .attr('y1', (d) => d.y1)
        .attr('x2', (d) => d.x2)
        .attr('y2', (d) => d.y2)
        .attr('stroke', 'var(--cb-border-default)')
        .attr('stroke-width', 2);
    }

    return () => {
      canvasRef.current?.destroy();
      canvasRef.current = null;
    };
  }, [background, zoomable]);

  const handleResetZoom = () => {
    canvasRef.current?.resetZoom();
  };

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2">
          <span className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'}`}>
            Background:
          </span>
          <select
            value={background}
            onChange={(e) => setBackground(e.target.value as BackgroundPattern)}
            className={`text-sm px-2 py-1 rounded ${
              theme === 'NeXTSTEP'
                ? 'bg-white border border-[#707070]'
                : 'bg-white border border-gray-300'
            }`}
          >
            <option value="solid">Solid</option>
            <option value="dots">Dots</option>
            <option value="grid">Grid</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={zoomable}
            onChange={(e) => setZoomable(e.target.checked)}
          />
          <span className={`text-sm ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'}`}>
            Zoomable
          </span>
        </label>

        <button
          onClick={handleResetZoom}
          className={`text-sm px-3 py-1 rounded ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border border-[#707070] active:bg-[#b0b0b0]'
              : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
          }`}
        >
          Reset Zoom
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full h-64 rounded overflow-hidden"
        style={{ minHeight: '256px' }}
      />

      <p className={`mt-2 text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
        {zoomable ? 'Use mouse wheel to zoom, drag to pan' : 'Zoom/pan disabled'}
      </p>
    </div>
  );
}

// ============================================
// D3ViewWrapper Demo
// ============================================

function D3ViewWrapperDemo() {
  const { theme } = useTheme();
  const [clickedNode, setClickedNode] = useState<string | null>(null);

  const cardData = useMemo(() => sampleNodes.map(nodeToCardValue), []);

  const renderContent = useCallback(
    (
      contentArea: d3.Selection<SVGGElement, unknown, null, undefined>,
      data: NodeValue[],
      dims: CanvasDimensions,
      callbacks: D3ViewCallbacks<NodeValue>
    ) => {
      contentArea.selectAll('*').remove();

      const margin = { top: 20, right: 20, bottom: 20, left: 20 };
      const innerWidth = dims.width - margin.left - margin.right;

      const g = contentArea.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // Simple grid layout
      const cols = 3;
      const cardWidth = innerWidth / cols - 10;
      const cardHeight = 60;

      const cardGroups = g
        .selectAll('.card-group')
        .data(data)
        .join('g')
        .attr('class', 'card-group')
        .attr('transform', (_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return `translate(${col * (cardWidth + 10)},${row * (cardHeight + 10)})`;
        });

      cardGroups
        .append('rect')
        .attr('width', cardWidth)
        .attr('height', cardHeight)
        .attr('rx', theme === 'NeXTSTEP' ? 0 : 6)
        .attr('fill', theme === 'NeXTSTEP' ? 'var(--cb-bg-raised)' : 'var(--cb-bg-glass)')
        .attr('stroke', 'var(--cb-border-default)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', function (_, d) {
          callbacks.onNodeClick?.(d);
        })
        .on('mouseenter', function () {
          d3.select(this).attr('stroke', 'var(--cb-accent)').attr('stroke-width', 2);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('stroke', 'var(--cb-border-default)').attr('stroke-width', 1);
        });

      cardGroups
        .append('text')
        .attr('x', 10)
        .attr('y', 25)
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', 'var(--cb-fg-primary)')
        .style('pointer-events', 'none')
        .text((d) => (d.name.length > 20 ? d.name.slice(0, 20) + '...' : d.name));

      cardGroups
        .append('text')
        .attr('x', 10)
        .attr('y', 45)
        .attr('font-size', '11px')
        .attr('fill', 'var(--cb-fg-muted)')
        .style('pointer-events', 'none')
        .text((d) => d.nodeType);
    },
    [theme]
  );

  return (
    <div>
      <div className="w-full h-64 rounded overflow-hidden border border-gray-200">
        <D3ViewWrapper<NodeValue>
          data={cardData}
          viewType="grid"
          background="dots"
          zoomable={false}
          renderContent={renderContent}
          onNodeClick={(node) => setClickedNode(node.name)}
          emptyMessage="No data to display"
        />
      </div>
      <p className={`mt-2 text-sm ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>
        Last clicked: {clickedNode || 'None'}
      </p>
    </div>
  );
}

// ============================================
// LATCH Scales Demo
// ============================================

function LATCHScalesDemo() {
  const { theme } = useTheme();
  const containerRef = useRef<SVGSVGElement>(null);

  const cardData = useMemo(() => sampleNodes.map(nodeToCardValue), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const svg = d3.select(containerRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 300;
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales using LATCH factories
    const categoryScale = createLATCHScale('category', cardData, [0, innerWidth]);
    const hierarchyScale = createLATCHScale('hierarchy', cardData, [innerHeight, 0]); // Inverted for y-axis

    // Draw axes
    // X-axis (Category)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(categoryScale as unknown as d3.AxisScale<string>))
      .selectAll('text')
      .attr('fill', 'var(--cb-fg-secondary)')
      .attr('font-size', '11px');

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--cb-fg-primary)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text('Category (folder)');

    // Y-axis (Hierarchy/Priority)
    g.append('g')
      .call(d3.axisLeft(hierarchyScale as unknown as d3.AxisScale<number>).ticks(5))
      .selectAll('text')
      .attr('fill', 'var(--cb-fg-secondary)')
      .attr('font-size', '11px');

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
          .text(d.name);
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

// ============================================
// Main Demo Component
// ============================================

export function D3ComponentsDemo() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-gray-50'
      }`}
      data-theme={theme}
    >
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1
            className={`text-2xl font-bold ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-900'
            }`}
          >
            CardBoard D3 Components Demo
          </h1>
          <p
            className={`text-sm mt-1 ${
              theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
            }`}
          >
            Visual testing for cb-card, cb-canvas, D3ViewWrapper, and LATCH scales
          </p>
        </div>

        <button
          onClick={() => setTheme(theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP')}
          className={`px-4 py-2 text-sm font-medium rounded ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
              : 'bg-white border border-gray-300 hover:bg-gray-100 shadow-sm'
          }`}
        >
          Switch to {theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP'} Theme
        </button>
      </header>

      <div className="max-w-4xl">
        <DemoSection
          title="cb-card Component"
          description="Card component with four variants: default, glass, elevated, outline. Click to toggle selection."
        >
          <CbCardDemo />
        </DemoSection>

        <DemoSection
          title="cb-canvas Component"
          description="Canvas container with zoom/pan and background patterns. Supports content and overlay layers."
        >
          <CbCanvasDemo />
        </DemoSection>

        <DemoSection
          title="D3ViewWrapper Component"
          description="React-D3 bridge component. Wraps cb-canvas with React lifecycle and callbacks."
        >
          <D3ViewWrapperDemo />
        </DemoSection>

        <DemoSection
          title="LATCH Scale Factories"
          description="Scale factories for mapping LATCH axes (Location, Alphabet, Time, Category, Hierarchy) to visual dimensions."
        >
          <LATCHScalesDemo />
        </DemoSection>
      </div>
    </div>
  );
}

export default D3ComponentsDemo;
