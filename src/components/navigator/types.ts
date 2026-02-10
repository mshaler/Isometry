/**
 * Navigator Type Mappings
 *
 * Type definitions and constants for drag-and-drop Navigator components.
 * Maps LATCH buckets (single-letter) to full LATCHAxis names for PAFV integration.
 */

import type { LATCHBucket, PropertyBucket } from '@/services/property-classifier';
import type { LATCHAxis } from '@/types/pafv';

// ============================================================================
// Constants
// ============================================================================

/** Drag item type identifier for react-dnd */
export const FACET_ITEM_TYPE = 'FACET';

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
