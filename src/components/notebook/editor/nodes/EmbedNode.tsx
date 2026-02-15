/**
 * EmbedNode - React NodeView for Isometry Embeds
 *
 * Renders live D3.js visualizations within TipTap documents.
 * SuperGrid embeds are the table replacement - live PAFV projections.
 *
 * Performance optimizations (Phase 98-04):
 * - Debounced resize handling (100ms) to prevent rapid re-renders
 * - requestAnimationFrame batching for D3 renders
 * - Update callback in EmbedExtension prevents re-renders on unrelated edits
 *
 * @see Phase 98: Isometry Embeds
 * @see Phase 98-02: Live Data Updates
 * @see Phase 98-04: Performance Optimizations
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import * as d3 from 'd3';
import { useEmbedData } from '../../../../hooks/embed/useEmbedData';
import { EmbedType, DEFAULT_EMBED_DIMENSIONS, type EmbedAttributes } from '../extensions/embed-types';
import { EmbedToolbar } from './EmbedToolbar';

/** Minimum debounce interval for resize handling (ms) */
const RESIZE_DEBOUNCE_MS = 100;

interface EmbedDimensions {
  width: number;
  height: number;
}

/**
 * Main EmbedNode component - dispatches to type-specific renderers
 */
export function EmbedNode({ node, updateAttributes }: NodeViewProps) {
  const embedType = node.attrs.type as EmbedType;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<EmbedDimensions>({
    width: node.attrs.width || DEFAULT_EMBED_DIMENSIONS.width,
    height: node.attrs.height || DEFAULT_EMBED_DIMENSIONS.height,
  });

  // Debounced ResizeObserver for responsive width (Phase 98-04)
  // Prevents rapid dimension updates during resize which would cause D3 thrashing
  useEffect(() => {
    if (!containerRef.current) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      // Clear any pending update
      if (debounceTimer) clearTimeout(debounceTimer);
      if (rafId) cancelAnimationFrame(rafId);

      // Debounce resize events
      debounceTimer = setTimeout(() => {
        // Batch dimension update with RAF for smooth rendering
        rafId = requestAnimationFrame(() => {
          setDimensions({
            width: entry.contentRect.width,
            height: node.attrs.height || DEFAULT_EMBED_DIMENSIONS.height,
          });
        });
      }, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [node.attrs.height]);

  // Height adjustment controls
  const handleExpandHeight = useCallback(() => {
    const newHeight = Math.min(
      (node.attrs.height || DEFAULT_EMBED_DIMENSIONS.height) + 100,
      DEFAULT_EMBED_DIMENSIONS.maxHeight
    );
    updateAttributes({ height: newHeight });
  }, [node.attrs.height, updateAttributes]);

  const handleShrinkHeight = useCallback(() => {
    const newHeight = Math.max(
      (node.attrs.height || DEFAULT_EMBED_DIMENSIONS.height) - 100,
      DEFAULT_EMBED_DIMENSIONS.minHeight
    );
    updateAttributes({ height: newHeight });
  }, [node.attrs.height, updateAttributes]);

  // Handle embed type changes from toolbar (Phase 98-03)
  const handleTypeChange = useCallback((newType: EmbedType) => {
    updateAttributes({ type: newType });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className={`embed embed--${embedType}`}>
      <div ref={containerRef} className="embed__container">
        {/* View switching toolbar (Phase 98-03) */}
        <EmbedToolbar
          currentType={embedType}
          onTypeChange={handleTypeChange}
          attrs={node.attrs as Partial<EmbedAttributes>}
        />

        {/* Height controls */}
        <div className="embed__header" contentEditable={false}>
          <span className="embed__type-label">
            {getEmbedLabel(embedType)}
          </span>
          <div className="embed__controls">
            <button
              onClick={handleShrinkHeight}
              className="embed__control-btn"
              title="Shrink"
            >
              {'\u2212'}
            </button>
            <button
              onClick={handleExpandHeight}
              className="embed__control-btn"
              title="Expand"
            >
              +
            </button>
          </div>
        </div>

        {/* Type-specific content */}
        <div
          className="embed__content"
          style={{ height: dimensions.height }}
        >
          <EmbedContent
            type={embedType}
            dimensions={dimensions}
            attrs={node.attrs}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Get display label for embed type
 */
function getEmbedLabel(type: EmbedType): string {
  switch (type) {
    case 'supergrid':
      return 'SuperGrid';
    case 'network':
      return 'Network Graph';
    case 'timeline':
      return 'Timeline';
    default:
      return 'Embed';
  }
}

/**
 * Type-specific embed content renderer
 */
function EmbedContent({
  type,
  dimensions,
  attrs,
}: {
  type: EmbedType;
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  switch (type) {
    case 'supergrid':
      return <SuperGridEmbed dimensions={dimensions} attrs={attrs} />;
    case 'network':
      return <NetworkEmbed dimensions={dimensions} attrs={attrs} />;
    case 'timeline':
      return <TimelineEmbed dimensions={dimensions} attrs={attrs} />;
    default:
      return <div className="embed__error">Unknown embed type</div>;
  }
}

/**
 * SuperGrid Embed - Live PAFV projection (replaces tables)
 *
 * Uses useEmbedData for live data updates via dataVersion reactivity.
 * Renders a grid visualization showing cards grouped by PAFV axes.
 */
function SuperGridEmbed({
  dimensions,
  attrs,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter from attrs (set in 98-03 via toolbar)
  const filter = (attrs.filter as string) || '';

  // Live data from useEmbedData - automatically updates when dataVersion changes
  const { nodes, loading, error } = useEmbedData({
    type: 'supergrid',
    filter,
    limit: 200,
  });
  const nodeCount = nodes.length;

  // D3 rendering effect with RAF batching (Phase 98-04)
  // Uses requestAnimationFrame to batch D3 DOM operations for 60fps
  useEffect(() => {
    if (!svgRef.current || loading || nodes.length === 0) return;

    let rafId: number | null = null;

    // Batch D3 render with RAF for smooth performance
    rafId = requestAnimationFrame(() => {
      const svg = d3.select(svgRef.current);
      const margin = { top: 40, right: 20, bottom: 40, left: 20 };
      const width = dimensions.width - margin.left - margin.right;
      const height = dimensions.height - margin.top - margin.bottom;

      // Clear previous content
      svg.selectAll('*').remove();

      // Create container group
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Grid pattern background
      const defs = svg.append('defs');
      defs.append('pattern')
        .attr('id', 'embed-grid')
        .attr('width', 40)
        .attr('height', 40)
        .attr('patternUnits', 'userSpaceOnUse')
        .append('path')
        .attr('d', 'M 40 0 L 0 0 0 40')
        .attr('fill', 'none')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 1);

      g.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'url(#embed-grid)');

      // Calculate grid layout
      const cellSize = 80;
      const cellPadding = 8;
      const cols = Math.max(1, Math.floor(width / (cellSize + cellPadding)));
      const displayNodes = nodes.slice(0, 20); // Show max 20 nodes in embed

      // Render node cells using D3 join pattern
      g.selectAll('.embed-cell')
        .data(displayNodes, (d) => (d as { id: string }).id)
        .join(
          enter => enter.append('g')
            .attr('class', 'embed-cell')
            .attr('transform', (_, i) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              return `translate(${col * (cellSize + cellPadding)},${row * (cellSize + cellPadding)})`;
            })
            .call(enterG => {
              enterG.append('rect')
                .attr('width', cellSize)
                .attr('height', cellSize - 20)
                .attr('rx', 4)
                .attr('fill', '#f3f4f6')
                .attr('stroke', '#d1d5db')
                .attr('stroke-width', 1);
              enterG.append('text')
                .attr('x', cellSize / 2)
                .attr('y', (cellSize - 20) / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', 11)
                .attr('fill', '#374151')
                .text(d => (d.name || '').slice(0, 12) + ((d.name || '').length > 12 ? '...' : ''));
            }),
          update => update,
          exit => exit.remove()
        );

      // Info text
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9ca3af')
        .attr('font-size', 12)
        .text(`Showing ${displayNodes.length} of ${nodeCount} cards`);
    });

    // Cleanup on unmount
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
    };
  }, [nodes, loading, dimensions, nodeCount]);

  if (loading) {
    return (
      <div className="embed__loading">
        <div className="embed__spinner" />
        <span>Loading SuperGrid...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="embed__error">
        <span>Error: {error.message}</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="embed__empty">
        <svg width={dimensions.width} height={dimensions.height} className="embed__svg">
          <text
            x={dimensions.width / 2}
            y={dimensions.height / 2}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="14"
          >
            No cards match filter
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="embed__supergrid">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      />
    </div>
  );
}

/**
 * Network Embed - Force-directed graph visualization
 *
 * Uses useEmbedData for live node and edge data.
 * Renders a force-directed network graph using D3.
 */
function NetworkEmbed({
  dimensions,
  attrs,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);

  const filter = (attrs.filter as string) || '';

  // Live data with edges for network
  const { nodes, edges, loading, error } = useEmbedData({
    type: 'network',
    filter,
    includeEdges: true,
    limit: 100,
  });

  // D3 force-directed graph with RAF batching (Phase 98-04)
  // Uses requestAnimationFrame to batch initial render
  useEffect(() => {
    if (!svgRef.current || loading) return;

    let rafId: number | null = null;

    // Stop any existing simulation before starting new one
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Batch initial D3 render with RAF
    rafId = requestAnimationFrame(() => {
      const svg = d3.select(svgRef.current);
      const width = dimensions.width;
      const height = dimensions.height;

      // Clear previous content
      svg.selectAll('*').remove();

      if (nodes.length === 0) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#9ca3af')
          .text('No nodes to display');
        return;
      }

      // Transform data for D3 force simulation
      const graphNodes = nodes.slice(0, 50).map(n => ({
        id: n.id,
        name: n.name,
        folder: n.folder,
      }));

      // Build node id set for filtering edges
      const nodeIdSet = new Set(graphNodes.map(n => n.id));

      // Filter edges to only include those between visible nodes
      const graphLinks = edges
        .filter(e => nodeIdSet.has(e.source_id) && nodeIdSet.has(e.target_id))
        .map(e => ({
          source: e.source_id,
          target: e.target_id,
          type: e.edge_type,
        }));

      // Create force simulation
      const simulation = d3.forceSimulation(graphNodes as d3.SimulationNodeDatum[])
        .force('link', d3.forceLink(graphLinks).id((d: unknown) => (d as { id: string }).id).distance(60))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(25));

      simulationRef.current = simulation;

      // Draw links
      const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(graphLinks)
        .join('line')
        .attr('stroke', '#93c5fd')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6);

      // Draw nodes
      const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(graphNodes)
        .join('g');

      node.append('circle')
        .attr('r', 15)
        .attr('fill', '#dbeafe')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2);

      node.append('title')
        .text(d => d.name || d.id);

      // Update positions on tick
      // D3 simulation mutates nodes to add x/y properties
      type SimNode = { x?: number; y?: number };
      simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as unknown as SimNode).x ?? 0)
          .attr('y1', d => (d.source as unknown as SimNode).y ?? 0)
          .attr('x2', d => (d.target as unknown as SimNode).x ?? 0)
          .attr('y2', d => (d.target as unknown as SimNode).y ?? 0);

        node.attr('transform', d => `translate(${(d as unknown as SimNode).x ?? 0},${(d as unknown as SimNode).y ?? 0})`);
      });

      // Info text
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9ca3af')
        .attr('font-size', 12)
        .text(`${graphNodes.length} nodes, ${graphLinks.length} edges`);
    });

    // Cleanup
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
    };
  }, [nodes, edges, loading, dimensions]);

  if (loading) {
    return (
      <div className="embed__loading">
        <div className="embed__spinner" />
        <span>Loading Network...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="embed__error">
        <span>Error: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="embed__network">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      />
    </div>
  );
}

/**
 * Timeline Embed - Chronological visualization
 *
 * Uses useEmbedData for live data.
 * Renders nodes on a timeline based on created_at timestamp.
 */
function TimelineEmbed({
  dimensions,
  attrs,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const filter = (attrs.filter as string) || '';

  const { nodes, loading, error } = useEmbedData({
    type: 'timeline',
    filter,
    limit: 100,
  });

  // Sort nodes by date and compute time range
  const sortedNodes = useMemo(() => {
    if (nodes.length === 0) return [];
    return [...nodes]
      .filter(n => n.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 50);
  }, [nodes]);

  // D3 timeline rendering with RAF batching (Phase 98-04)
  // Uses requestAnimationFrame to batch D3 DOM operations for 60fps
  useEffect(() => {
    if (!svgRef.current || loading || sortedNodes.length === 0) return;

    let rafId: number | null = null;

    // Batch D3 render with RAF
    rafId = requestAnimationFrame(() => {
      const svg = d3.select(svgRef.current);
      const margin = { top: 30, right: 40, bottom: 40, left: 40 };
      const width = dimensions.width - margin.left - margin.right;
      const height = dimensions.height - margin.top - margin.bottom;

      // Clear previous
      svg.selectAll('*').remove();

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Time scale
      const timeExtent = d3.extent(sortedNodes, d => new Date(d.createdAt)) as [Date, Date];
      const xScale = d3.scaleTime()
        .domain(timeExtent)
        .range([0, width]);

      // Draw timeline axis
      const lineY = height / 2;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', lineY)
        .attr('x2', width)
        .attr('y2', lineY)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 2);

      // Draw time markers (events)
      g.selectAll('.timeline-event')
        .data(sortedNodes, (d) => (d as { id: string }).id)
        .join('g')
        .attr('class', 'timeline-event')
        .attr('transform', d => `translate(${xScale(new Date(d.createdAt))},${lineY})`)
        .call(eventG => {
          eventG.append('circle')
            .attr('r', 8)
            .attr('fill', '#fef3c7')
            .attr('stroke', '#f59e0b')
            .attr('stroke-width', 2);

          eventG.append('line')
            .attr('y1', -15)
            .attr('y2', 15)
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1);

          eventG.append('title')
            .text(d => `${d.name}\n${new Date(d.createdAt).toLocaleDateString()}`);
        });

      // Draw axis
      const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => d3.timeFormat('%b %Y')(d as Date));

      g.append('g')
        .attr('transform', `translate(0,${height - 10})`)
        .call(xAxis)
        .selectAll('text')
        .attr('fill', '#6b7280')
        .attr('font-size', 11);

      // Info text
      svg.append('text')
        .attr('x', dimensions.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .attr('font-size', 12)
        .text(`${sortedNodes.length} events`);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
    };
  }, [sortedNodes, loading, dimensions]);

  if (loading) {
    return (
      <div className="embed__loading">
        <div className="embed__spinner" />
        <span>Loading Timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="embed__error">
        <span>Error: {error.message}</span>
      </div>
    );
  }

  if (sortedNodes.length === 0) {
    return (
      <div className="embed__empty">
        <svg width={dimensions.width} height={dimensions.height} className="embed__svg">
          <text
            x={dimensions.width / 2}
            y={dimensions.height / 2}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="14"
          >
            No events to display
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="embed__timeline">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      />
    </div>
  );
}
