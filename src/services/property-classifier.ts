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
  /** True for properties discovered from node_properties table */
  isDynamic?: boolean;
  /** Count of nodes with this property (for UI badge) */
  nodeCount?: number;
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

/** Dynamic property discovered from node_properties table */
interface DynamicProperty {
  key: string;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  nodeCount: number;
  sampleValue: string;
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
 * Discover dynamic properties from node_properties table.
 * Returns properties that appear in at least 3 nodes.
 *
 * @param db - sql.js Database instance
 * @returns Array of discovered dynamic properties
 */
function discoverDynamicProperties(db: Database): DynamicProperty[] {
  const result = db.exec(`
    SELECT
      key,
      value_type,
      COUNT(DISTINCT node_id) as node_count,
      MIN(value) as sample_value
    FROM node_properties
    GROUP BY key, value_type
    HAVING node_count >= 3
    ORDER BY node_count DESC
    LIMIT 50
  `);

  if (result.length === 0 || !result[0].values) {
    return [];
  }

  const columns = result[0].columns;
  const keyIdx = columns.indexOf('key');
  const valueTypeIdx = columns.indexOf('value_type');
  const nodeCountIdx = columns.indexOf('node_count');
  const sampleValueIdx = columns.indexOf('sample_value');

  return result[0].values.map((row) => ({
    key: row[keyIdx] as string,
    valueType: row[valueTypeIdx] as DynamicProperty['valueType'],
    nodeCount: row[nodeCountIdx] as number,
    sampleValue: row[sampleValueIdx] as string,
  }));
}

/**
 * Infer LATCH bucket from value type and key name.
 *
 * @param valueType - Type of the value (string, number, boolean, array, object, null)
 * @param key - Property key name
 * @param sampleValue - Optional sample value for pattern detection
 * @returns The inferred LATCH bucket
 */
function inferLATCHBucket(
  valueType: string,
  key: string,
  sampleValue?: string
): LATCHBucket {
  // Time (T): Date-related keys or ISO date values
  if (
    valueType === 'string' &&
    (/date|time|created|modified|due|start|end/i.test(key) ||
      (sampleValue && /^\d{4}-\d{2}-\d{2}/.test(sampleValue)))
  ) {
    return 'T';
  }

  // Location (L): Location-related keys
  if (/location|address|city|country|lat|lon|place/i.test(key)) {
    return 'L';
  }

  // Hierarchy (H): Numeric values
  if (valueType === 'number') {
    return 'H';
  }

  // Category (C): Arrays or booleans
  if (valueType === 'array' || valueType === 'boolean') {
    return 'C';
  }

  // Alphabet (A): Default for remaining strings
  return 'A';
}

/**
 * Convert property key to human-readable name.
 * Example: "contact_email" -> "Contact Email"
 *
 * @param key - Property key
 * @returns Humanized display name
 */
function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

  // Track existing schema facet source columns for collision detection
  const schemaSourceColumns = new Set<string>();

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
      const sourceColumn = row[sourceColumnIdx] as string;
      schemaSourceColumns.add(sourceColumn);

      const property: ClassifiedProperty = {
        id: row[idIdx] as string,
        name: row[nameIdx] as string,
        bucket: axis as LATCHBucket,
        sourceColumn,
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

  // Discover and add dynamic properties from node_properties table
  const dynamicProperties = discoverDynamicProperties(db);
  for (const dynProp of dynamicProperties) {
    const bucket = inferLATCHBucket(dynProp.valueType, dynProp.key, dynProp.sampleValue);
    let name = humanizeKey(dynProp.key);

    // Check for collision with existing schema facets
    if (schemaSourceColumns.has(dynProp.key)) {
      name += ' (custom)';
    }

    // Determine facet type based on value type
    let facetType = 'text';
    if (dynProp.valueType === 'number') {
      facetType = 'number';
    } else if (dynProp.valueType === 'boolean') {
      facetType = 'select';
    } else if (dynProp.valueType === 'array') {
      facetType = 'multi_select';
    } else if (/date|time/i.test(dynProp.key)) {
      facetType = 'date';
    }

    const property: ClassifiedProperty = {
      id: `dynamic-${dynProp.key}`,
      name,
      bucket,
      sourceColumn: `node_properties.${dynProp.key}`,
      facetType,
      enabled: true,
      sortOrder: 1000 + classification[bucket].length,
      isEdgeProperty: false,
      isDynamic: true,
      nodeCount: dynProp.nodeCount,
    };

    classification[bucket].push(property);
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
// Removed unused utility functions flattenClassification and getPropertiesForBucket
