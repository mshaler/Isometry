/**
 * Property Classifier Service
 *
 * Schema-on-read property classification into LATCH+GRAPH buckets.
 * This is Task 0.1 from the Navigators GSD Plan.
 *
 * The classifier reads the facets table and automatically routes each property
 * to its LATCH bucket based on the axis field. GRAPH properties (edge types
 * and computed metrics) are added programmatically.
 */

import type { Database } from 'sql.js';

// ============================================================================
// Types
// ============================================================================

/** LATCH axis buckets */
export type LATCHBucket = 'L' | 'A' | 'T' | 'C' | 'H';

/** All property buckets including GRAPH */
export type PropertyBucket = LATCHBucket | 'GRAPH';

/** A single classified property */
export interface ClassifiedProperty {
  /** Unique identifier (facet id or computed id) */
  id: string;
  /** Display name */
  name: string;
  /** Which bucket this property belongs to */
  bucket: PropertyBucket;
  /** Column in nodes/edges table */
  sourceColumn: string;
  /** Type: text, number, date, select, multi_select, location */
  facetType: string;
  /** Whether this property is enabled for filtering */
  enabled: boolean;
  /** Sort order within the bucket */
  sortOrder: number;
  /** True for GRAPH bucket items that represent edge properties */
  isEdgeProperty: boolean;
}

/** Complete property classification by bucket */
export interface PropertyClassification {
  L: ClassifiedProperty[]; // Location
  A: ClassifiedProperty[]; // Alphabet
  T: ClassifiedProperty[]; // Time
  C: ClassifiedProperty[]; // Category
  H: ClassifiedProperty[]; // Hierarchy
  GRAPH: ClassifiedProperty[]; // Edge types + metrics
}

// ============================================================================
// Constants
// ============================================================================

/** The four GRAPH edge types from the LPG model */
const GRAPH_EDGE_TYPES = ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY'] as const;

/** Computed GRAPH metrics */
const GRAPH_METRICS = [
  { id: 'metric_degree', name: 'Degree', sourceColumn: 'degree' },
  { id: 'metric_weight', name: 'Weight', sourceColumn: 'weight' },
] as const;

// ============================================================================
// Implementation
// ============================================================================

/**
 * Classify properties from the facets table into LATCH+GRAPH buckets.
 *
 * @param db - sql.js Database instance
 * @returns PropertyClassification with all properties grouped by bucket
 */
export function classifyProperties(db: Database): PropertyClassification {
  // Initialize empty classification
  const classification: PropertyClassification = {
    L: [],
    A: [],
    T: [],
    C: [],
    H: [],
    GRAPH: [],
  };

  // Query enabled facets ordered by axis and sort_order
  const result = db.exec(`
    SELECT id, name, facet_type, axis, source_column, enabled, sort_order
    FROM facets
    WHERE enabled = 1
    ORDER BY axis, sort_order
  `);

  // Process facet rows
  if (result.length > 0 && result[0].values) {
    const columns = result[0].columns;
    const idIdx = columns.indexOf('id');
    const nameIdx = columns.indexOf('name');
    const facetTypeIdx = columns.indexOf('facet_type');
    const axisIdx = columns.indexOf('axis');
    const sourceColumnIdx = columns.indexOf('source_column');
    const enabledIdx = columns.indexOf('enabled');
    const sortOrderIdx = columns.indexOf('sort_order');

    for (const row of result[0].values) {
      const axis = row[axisIdx] as string;
      const property: ClassifiedProperty = {
        id: row[idIdx] as string,
        name: row[nameIdx] as string,
        bucket: axis as LATCHBucket,
        sourceColumn: row[sourceColumnIdx] as string,
        facetType: row[facetTypeIdx] as string,
        enabled: (row[enabledIdx] as number) === 1,
        sortOrder: row[sortOrderIdx] as number,
        isEdgeProperty: false,
      };

      // Route to appropriate LATCH bucket
      if (axis === 'L' || axis === 'A' || axis === 'T' || axis === 'C' || axis === 'H') {
        classification[axis].push(property);
      }
    }
  }

  // Add GRAPH edge types (display as Capitalized, not UPPERCASE)
  let sortOrder = 0;
  for (const edgeType of GRAPH_EDGE_TYPES) {
    // Convert "LINK" → "Link", "NEST" → "Nest", etc.
    const displayName = edgeType.charAt(0) + edgeType.slice(1).toLowerCase();
    classification.GRAPH.push({
      id: `edge_type_${edgeType}`,
      name: displayName,
      bucket: 'GRAPH',
      sourceColumn: 'edge_type',
      facetType: 'edge_type',
      enabled: true,
      sortOrder: sortOrder++,
      isEdgeProperty: true,
    });
  }

  // Add GRAPH computed metrics
  for (const metric of GRAPH_METRICS) {
    classification.GRAPH.push({
      id: metric.id,
      name: metric.name,
      bucket: 'GRAPH',
      sourceColumn: metric.sourceColumn,
      facetType: 'computed',
      enabled: true,
      sortOrder: sortOrder++,
      isEdgeProperty: false,
    });
  }

  return classification;
}

/**
 * Get all properties as a flat array (useful for iteration)
 */
export function flattenClassification(classification: PropertyClassification): ClassifiedProperty[] {
  return [
    ...classification.L,
    ...classification.A,
    ...classification.T,
    ...classification.C,
    ...classification.H,
    ...classification.GRAPH,
  ];
}

/**
 * Get properties for a specific bucket
 */
export function getPropertiesForBucket(
  classification: PropertyClassification,
  bucket: PropertyBucket
): ClassifiedProperty[] {
  return classification[bucket];
}
