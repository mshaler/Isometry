/**
 * LATCH Axis Scale Factories
 *
 * Creates D3 scales for each LATCH axis type.
 * Used by view components to map data values to screen coordinates.
 */

import * as d3 from 'd3';
import type { CardValue, LATCHAxis, LATCHCoordinates } from '../components/types';

// ============================================
// Scale Types
// ============================================

export type LATCHScale =
  | d3.ScaleLinear<number, number>
  | d3.ScalePoint<string>
  | d3.ScaleBand<string>
  | d3.ScaleTime<number, number>;

export interface ScaleConfig {
  axis: LATCHAxis;
  domain?: unknown[];
  range: [number, number];
  padding?: number;
}

// ============================================
// Scale Factories
// ============================================

/**
 * Create a scale for the Location axis
 * Returns a linear scale for coordinate-based location
 */
export function createLocationScale(
  data: CardValue[],
  range: [number, number],
): d3.ScaleLinear<number, number> {
  const locations = data
    .map((d) => d.latch?.location)
    .filter((loc): loc is [number, number] => Array.isArray(loc));

  if (locations.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range(range);
  }

  const xExtent = d3.extent(locations, (loc) => loc[0]) as [number, number];
  const yExtent = d3.extent(locations, (loc) => loc[1]) as [number, number];

  // Use the larger extent for uniform scaling
  const maxExtent = Math.max(xExtent[1] - xExtent[0], yExtent[1] - yExtent[0]);

  return d3.scaleLinear().domain([0, maxExtent || 1]).range(range).nice();
}

/**
 * Create a scale for the Alphabet axis
 * Returns a band scale for categorical string values
 */
export function createAlphabetScale(
  data: CardValue[],
  range: [number, number],
  padding: number = 0.1,
): d3.ScaleBand<string> {
  const values = data
    .map((d) => d.latch?.alphabet ?? (d.type === 'node' ? d.name : d.label))
    .filter((v): v is string => typeof v === 'string')
    .sort();

  const uniqueValues = [...new Set(values)];

  return d3.scaleBand<string>().domain(uniqueValues).range(range).padding(padding);
}

/**
 * Create a scale for the Time axis
 * Returns a time scale for date values
 */
export function createTimeScale(
  data: CardValue[],
  range: [number, number],
  facet: 'createdAt' | 'updatedAt' | 'time' = 'createdAt',
): d3.ScaleTime<number, number> {
  const dates = data
    .map((d) => {
      if (facet === 'time' && d.latch?.time) {
        return new Date(d.latch.time);
      }
      return d[facet] as Date;
    })
    .filter((d): d is Date => d instanceof Date);

  if (dates.length === 0) {
    const now = new Date();
    return d3.scaleTime().domain([now, now]).range(range);
  }

  const extent = d3.extent(dates) as [Date, Date];

  return d3.scaleTime().domain(extent).range(range).nice();
}

/**
 * Create a scale for the Category axis
 * Returns a band scale for category values
 */
export function createCategoryScale(
  data: CardValue[],
  range: [number, number],
  padding: number = 0.2,
): d3.ScaleBand<string> {
  const categories = data
    .flatMap((d) => {
      const cat = d.latch?.category;
      if (Array.isArray(cat)) return cat;
      if (typeof cat === 'string') return [cat];
      return [];
    })
    .filter((c): c is string => typeof c === 'string');

  const uniqueCategories = [...new Set(categories)].sort();

  // Add 'Uncategorized' if there are items without category
  const hasUncategorized = data.some((d) => !d.latch?.category);
  if (hasUncategorized) {
    uniqueCategories.push('Uncategorized');
  }

  return d3.scaleBand<string>().domain(uniqueCategories).range(range).padding(padding);
}

/**
 * Create a scale for the Hierarchy axis
 * Returns a linear scale for numeric hierarchy values (1-5 typically)
 */
export function createHierarchyScale(
  data: CardValue[],
  range: [number, number],
): d3.ScaleLinear<number, number> {
  const values = data
    .map((d) => d.latch?.hierarchy)
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) {
    return d3.scaleLinear().domain([1, 5]).range(range);
  }

  const extent = d3.extent(values) as [number, number];

  return d3.scaleLinear().domain(extent).range(range);
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a scale for any LATCH axis
 */
export function createLATCHScale(
  axis: LATCHAxis,
  data: CardValue[],
  range: [number, number],
  options: { padding?: number; timeFacet?: 'createdAt' | 'updatedAt' | 'time' } = {},
): LATCHScale {
  switch (axis) {
    case 'location':
      return createLocationScale(data, range);
    case 'alphabet':
      return createAlphabetScale(data, range, options.padding);
    case 'time':
      return createTimeScale(data, range, options.timeFacet);
    case 'category':
      return createCategoryScale(data, range, options.padding);
    case 'hierarchy':
      return createHierarchyScale(data, range);
    default:
      throw new Error(`Unknown LATCH axis: ${axis}`);
  }
}

/**
 * Get the value for a LATCH axis from a CardValue
 */
export function getLATCHValue(
  card: CardValue,
  axis: LATCHAxis,
): string | number | Date | [number, number] | undefined {
  switch (axis) {
    case 'location':
      return card.latch?.location as [number, number] | undefined;
    case 'alphabet':
      return card.latch?.alphabet ?? (card.type === 'node' ? card.name : card.label);
    case 'time':
      return card.latch?.time ? new Date(card.latch.time) : card.createdAt;
    case 'category':
      const cat = card.latch?.category;
      return Array.isArray(cat) ? cat[0] : cat;
    case 'hierarchy':
      return card.latch?.hierarchy;
    default:
      return undefined;
  }
}
