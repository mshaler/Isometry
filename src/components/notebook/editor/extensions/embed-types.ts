/**
 * Isometry Embed Types
 *
 * Defines types for embedded visualizations in the Capture pane.
 * SuperGrid embeds replace traditional tables with live PAFV projections.
 *
 * @see Phase 98: Isometry Embeds
 */

/**
 * Available embed visualization types
 * - supergrid: Live SuperGrid with PAFV controls (replaces /table)
 * - network: Force-directed graph visualization
 * - timeline: Chronological timeline view
 */
export type EmbedType = 'supergrid' | 'network' | 'timeline';

/**
 * LATCH axis for data projection
 */
export type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

/**
 * Attributes stored on embed nodes
 */
export interface EmbedAttributes {
  /** Visualization type */
  type: EmbedType;

  /** Optional custom SQL query */
  sql?: string;

  /** LATCH axis for X/column dimension */
  xAxis?: LATCHAxis;

  /** LATCH axis for Y/row dimension */
  yAxis?: LATCHAxis;

  /** Specific facet for X axis (e.g., 'folder' within 'category') */
  xFacet?: string;

  /** Specific facet for Y axis (e.g., 'year' within 'time') */
  yFacet?: string;

  /** Embed width in pixels (responsive by default) */
  width?: number;

  /** Embed height in pixels */
  height?: number;

  /** Value density level (0-3 for SuperGrid) */
  valueDensity?: number;

  /** Extent density ('sparse' | 'dense') */
  extentDensity?: 'sparse' | 'dense';

  /** Optional title displayed above embed */
  title?: string;
}

/**
 * Default embed dimensions
 */
export const DEFAULT_EMBED_DIMENSIONS = {
  width: 600,
  height: 400,
  minHeight: 200,
  maxHeight: 800,
} as const;

/**
 * Default attributes for each embed type
 */
export const DEFAULT_EMBED_ATTRIBUTES: Record<EmbedType, Partial<EmbedAttributes>> = {
  supergrid: {
    xAxis: 'category',
    xFacet: 'folder',
    yAxis: 'time',
    yFacet: 'year',
    height: 400,
    valueDensity: 0,
    extentDensity: 'dense',
  },
  network: {
    height: 400,
  },
  timeline: {
    xAxis: 'time',
    xFacet: 'created_at',
    height: 300,
  },
};
