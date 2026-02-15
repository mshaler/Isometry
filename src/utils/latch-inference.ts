import type { LATCHAxis } from '@/types/pafv';

/**
 * Infer LATCH dimension from facet name
 * Used when dragging axes in SuperDynamic
 */
export function inferDimensionFromFacet(facet: string): LATCHAxis {
  const lowerFacet = facet.toLowerCase();

  // Time-related facets
  if (['created_at', 'modified_at', 'date', 'year', 'month', 'quarter', 'week', 'day']
      .some(t => lowerFacet.includes(t))) {
    return 'time';
  }

  // Location-related facets
  if (['location', 'place', 'address', 'city', 'country', 'region']
      .some(l => lowerFacet.includes(l))) {
    return 'location';
  }

  // Hierarchy-related facets
  if (['folder', 'path', 'parent', 'priority', 'level']
      .some(h => lowerFacet.includes(h))) {
    return 'hierarchy';
  }

  // Alphabet-related facets
  if (['name', 'title', 'alphabetical']
      .some(a => lowerFacet.includes(a))) {
    return 'alphabet';
  }

  // Default to category (status, tags, type, etc.)
  return 'category';
}
