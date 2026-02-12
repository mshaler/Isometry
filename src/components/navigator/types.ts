/**
 * Navigator Type Mappings
 *
 * Type definitions and constants for drag-and-drop Navigator components.
 * Maps LATCH buckets (single-letter) to full LATCHAxis names for PAFV integration.
 */

import type { LATCHBucket, PropertyBucket } from '@/services/property-classifier';
import type { LATCHAxis, Plane } from '@/types/pafv';

// ============================================================================
// Constants
// ============================================================================

/** Drag item type identifier for react-dnd (facets from LATCH buckets) */
export const FACET_ITEM_TYPE = 'FACET';

/** Drag item type identifier for chips within a well (for reordering) */
export const WELL_CHIP_ITEM_TYPE = 'WELL_CHIP';

/**
 * Maps single-letter LATCH buckets to full axis names.
 * Used when dropping a facet onto a plane to create an AxisMapping.
 */
export const BUCKET_TO_AXIS: Record<LATCHBucket, LATCHAxis> = {
  L: 'location',
  A: 'alphabet',
  T: 'time',
  C: 'category',
  H: 'hierarchy',
};

// ============================================================================
// Types
// ============================================================================

/**
 * Data transferred during a facet drag operation.
 * Contains all metadata needed by PlaneDropZone to create an AxisMapping.
 */
export interface DraggedFacetItem {
  /** Unique identifier from ClassifiedProperty */
  id: string;
  /** Display name of the facet */
  name: string;
  /** LATCH bucket or GRAPH */
  bucket: PropertyBucket;
  /** Column name in nodes/edges table */
  sourceColumn: string;
  /** Type: text, number, date, select, multi_select, location, edge_type, computed */
  facetType: string;
}

/**
 * Data transferred during a within-well chip drag operation.
 * Used for reordering chips within the same plane.
 */
export interface DraggedWellChipItem {
  /** Index of the chip in the plane's mappings array */
  index: number;
  /** The plane this chip belongs to */
  plane: Plane;
  /** The facet name */
  facet: string;
  /** The LATCH axis */
  axis: string;
}
