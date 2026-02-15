/**
 * EmbedNode - React NodeView for Isometry Embeds
 *
 * Renders live D3.js visualizations within TipTap documents.
 * SuperGrid embeds are the table replacement - live PAFV projections.
 *
 * @see Phase 98: Isometry Embeds
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useSQLite } from '../../../../db/SQLiteProvider';
import { EmbedType, DEFAULT_EMBED_DIMENSIONS } from '../extensions/embed-types';

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

  // ResizeObserver for responsive width
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: node.attrs.height || DEFAULT_EMBED_DIMENSIONS.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
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

  return (
    <NodeViewWrapper className={`embed embed--${embedType}`}>
      <div ref={containerRef} className="embed__container">
        {/* Embed header with type label and controls */}
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
              −
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
 */
function SuperGridEmbed({
  dimensions,
  attrs,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const { db } = useSQLite();
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);

  // Query data from database
  useEffect(() => {
    if (!db) return;

    setLoading(true);
    try {
      // Default query - all non-deleted nodes
      const sql = (attrs.sql as string) || 'SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL';
      const result = db.exec(sql);
      if (result.length > 0 && result[0].values.length > 0) {
        setNodeCount(result[0].values[0][0] as number);
      }
    } catch (error) {
      console.error('SuperGrid embed query error:', error);
    } finally {
      setLoading(false);
    }
  }, [db, attrs.sql]);

  if (loading) {
    return (
      <div className="embed__loading">
        <div className="embed__spinner" />
        <span>Loading SuperGrid...</span>
      </div>
    );
  }

  // For Phase 98-01: Show placeholder with data info
  // Full D3 integration in Phase 98-02
  return (
    <div className="embed__supergrid-placeholder">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      >
        {/* Placeholder grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Info text */}
        <text
          x={dimensions.width / 2}
          y={dimensions.height / 2 - 20}
          textAnchor="middle"
          className="embed__placeholder-title"
          fill="#6b7280"
          fontSize="16"
          fontWeight="500"
        >
          SuperGrid Embed
        </text>
        <text
          x={dimensions.width / 2}
          y={dimensions.height / 2 + 10}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize="14"
        >
          {nodeCount} nodes | {String(attrs.xAxis || 'category')}/{String(attrs.xFacet || 'folder')} × {String(attrs.yAxis || 'time')}/{String(attrs.yFacet || 'year')}
        </text>
        <text
          x={dimensions.width / 2}
          y={dimensions.height / 2 + 35}
          textAnchor="middle"
          fill="#d1d5db"
          fontSize="12"
        >
          Click to open full SuperGrid view
        </text>
      </svg>
    </div>
  );
}

/**
 * Network Embed - Force-directed graph visualization
 */
function NetworkEmbed({
  dimensions,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <div className="embed__network-placeholder">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      >
        {/* Placeholder network visualization */}
        <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r="30" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <circle cx={dimensions.width / 2 - 80} cy={dimensions.height / 2 - 60} r="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <circle cx={dimensions.width / 2 + 80} cy={dimensions.height / 2 - 40} r="25" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <circle cx={dimensions.width / 2 - 60} cy={dimensions.height / 2 + 70} r="22" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <circle cx={dimensions.width / 2 + 70} cy={dimensions.height / 2 + 50} r="18" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />

        {/* Connections */}
        <line x1={dimensions.width / 2} y1={dimensions.height / 2} x2={dimensions.width / 2 - 80} y2={dimensions.height / 2 - 60} stroke="#93c5fd" strokeWidth="2" />
        <line x1={dimensions.width / 2} y1={dimensions.height / 2} x2={dimensions.width / 2 + 80} y2={dimensions.height / 2 - 40} stroke="#93c5fd" strokeWidth="2" />
        <line x1={dimensions.width / 2} y1={dimensions.height / 2} x2={dimensions.width / 2 - 60} y2={dimensions.height / 2 + 70} stroke="#93c5fd" strokeWidth="2" />
        <line x1={dimensions.width / 2} y1={dimensions.height / 2} x2={dimensions.width / 2 + 70} y2={dimensions.height / 2 + 50} stroke="#93c5fd" strokeWidth="2" />

        <text
          x={dimensions.width / 2}
          y={dimensions.height - 20}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="14"
        >
          Network Graph Embed
        </text>
      </svg>
    </div>
  );
}

/**
 * Timeline Embed - Chronological visualization
 */
function TimelineEmbed({
  dimensions,
}: {
  dimensions: EmbedDimensions;
  attrs: Record<string, unknown>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineY = dimensions.height / 2;

  return (
    <div className="embed__timeline-placeholder">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="embed__svg"
      >
        {/* Timeline axis */}
        <line
          x1="40"
          y1={lineY}
          x2={dimensions.width - 40}
          y2={lineY}
          stroke="#d1d5db"
          strokeWidth="2"
        />

        {/* Timeline markers */}
        {[0.2, 0.4, 0.6, 0.8].map((pos, i) => {
          const x = 40 + (dimensions.width - 80) * pos;
          return (
            <g key={i}>
              <circle cx={x} cy={lineY} r="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
              <line x1={x} y1={lineY - 20} x2={x} y2={lineY + 20} stroke="#e5e7eb" strokeWidth="1" />
            </g>
          );
        })}

        <text
          x={dimensions.width / 2}
          y={dimensions.height - 20}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="14"
        >
          Timeline Embed
        </text>
      </svg>
    </div>
  );
}
