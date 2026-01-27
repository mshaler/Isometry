/**
 * LATCH Scale Factories
 *
 * PAFV-aware scale factories for mapping LATCH axes to visual planes.
 * Each LATCH axis type maps to an appropriate D3 scale:
 *
 * - Location → Band scale (for named locations) or Point scale (for coordinates)
 * - Alphabet → Band scale (sorted alphabetically)
 * - Time → Time scale (continuous)
 * - Category → Band scale (discrete categories)
 * - Hierarchy → Linear scale (ordinal ranking)
 */

import * as d3 from 'd3';
import type { CardValue, D3LATCHAxis } from '@/types/lpg';

// ============================================
// Types
// ============================================

/** Options for scale creation */
export interface ScaleOptions {
  /** Padding for band scales (0-1) */
  padding?: number;
  /** Whether to invert the scale (higher values map to lower positions) */
  invert?: boolean;
  /** Apply nice rounding to continuous scale domains */
  nice?: boolean;
}

/** Extended scale with LATCH metadata and helpers */
export interface LATCHScale<TDomain = string | number | Date, TRange = number> {
  /** The underlying D3 scale function */
  (value: TDomain): TRange | undefined;
  /** The LATCH axis this scale represents */
  axis: D3LATCHAxis;
  /** The scale type identifier */
  type: D3LATCHAxis;
  /** Get the scale domain */
  domain(): TDomain[];
  /** Get the scale range */
  range(): TRange[];
  /** Get bandwidth for band scales */
  bandwidth?(): number;
  /** Copy method for D3 axis compatibility */
  copy?(): LATCHScale<TDomain, TRange>;
  /** Ticks method for continuous scales */
  ticks?(...args: unknown[]): TDomain[];
  /** Tick format method for continuous scales */
  tickFormat?(...args: unknown[]): (d: TDomain) => string;
  /** Get LATCH value from a CardValue */
  getValue(card: CardValue): TDomain | undefined;
  /** Get the scaled position for a CardValue */
  getPosition(card: CardValue): TRange | undefined;
}

// ============================================
// Category Scale
// ============================================

/**
 * Create a band scale for category axis.
 * Extracts unique categories from data and maps them to positions.
 */
export function createCategoryScale(
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): d3.ScaleBand<string> {
  const { padding = 0.1 } = options;

  // Extract all categories (flatten arrays)
  const categories = new Set<string>();
  for (const card of data) {
    const cat = card.latch.category;
    if (cat) {
      if (Array.isArray(cat)) {
        cat.forEach((c) => categories.add(c));
      } else {
        categories.add(cat);
      }
    }
  }

  // Create band scale
  return d3
    .scaleBand<string>()
    .domain(Array.from(categories).sort())
    .range(range)
    .padding(padding);
}

// ============================================
// Time Scale
// ============================================

/**
 * Create a time scale for time axis.
 * Extracts time extent from data and maps to continuous range.
 */
export function createTimeScale(
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): d3.ScaleTime<number, number> {
  const { nice = false } = options;

  // Extract all time values
  const times: Date[] = [];
  for (const card of data) {
    const time = card.latch.time;
    if (time) {
      times.push(time instanceof Date ? time : new Date(time));
    }
  }

  // Compute extent (with fallback for empty data)
  let extent: [Date, Date];
  if (times.length === 0) {
    extent = [new Date(), new Date()];
  } else if (times.length === 1) {
    extent = [times[0], times[0]];
  } else {
    const [min, max] = d3.extent(times) as [Date, Date];
    extent = [min, max];
  }

  // Create time scale
  const scale = d3.scaleTime<number>().domain(extent).range(range);

  if (nice) {
    scale.nice();
  }

  return scale;
}

// ============================================
// Hierarchy Scale
// ============================================

/**
 * Create a linear scale for hierarchy axis.
 * Maps ordinal rankings (priority, importance) to positions.
 */
export function createHierarchyScale(
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): d3.ScaleLinear<number, number> {
  const { invert = false } = options;

  // Extract all hierarchy values
  const values: number[] = [];
  for (const card of data) {
    const hier = card.latch.hierarchy;
    if (hier !== undefined) {
      values.push(hier);
    }
  }

  // Compute extent (with fallback for empty data)
  let extent: [number, number];
  if (values.length === 0) {
    extent = [0, 0];
  } else {
    const [min, max] = d3.extent(values) as [number, number];
    extent = [min, max];
  }

  // Create linear scale (optionally inverted)
  const actualRange = invert ? [range[1], range[0]] : range;

  return d3.scaleLinear<number>().domain(extent).range(actualRange);
}

// ============================================
// Alphabet Scale
// ============================================

/**
 * Create a band scale for alphabet axis.
 * Sorts items alphabetically and maps to positions.
 */
export function createAlphabetScale(
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): d3.ScaleBand<string> {
  const { padding = 0.1 } = options;

  // Extract all alphabet values (typically names)
  const names = new Set<string>();
  for (const card of data) {
    const name = card.latch.alphabet;
    if (name) {
      names.add(name);
    }
  }

  // Sort alphabetically
  const sortedNames = Array.from(names).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  // Create band scale
  return d3.scaleBand<string>().domain(sortedNames).range(range).padding(padding);
}

// ============================================
// Location Scale
// ============================================

/**
 * Create a band scale for location axis.
 * Maps named locations and coordinate strings to positions.
 */
export function createLocationScale(
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): d3.ScaleBand<string> {
  const { padding = 0.1 } = options;

  // Extract all locations (convert coordinates to strings)
  const locations = new Set<string>();
  for (const card of data) {
    const loc = card.latch.location;
    if (loc) {
      if (Array.isArray(loc)) {
        // Convert coordinates to string representation
        locations.add(`${loc[0].toFixed(2)}, ${loc[1].toFixed(2)}`);
      } else {
        locations.add(loc);
      }
    }
  }

  // Create band scale
  return d3
    .scaleBand<string>()
    .domain(Array.from(locations).sort())
    .range(range)
    .padding(padding);
}

// ============================================
// Universal LATCH Scale Factory
// ============================================

/**
 * Create a scale for any LATCH axis.
 * Returns an enhanced scale with LATCH metadata and helper methods.
 *
 * @example
 * ```ts
 * const { xAxis, yAxis } = usePAFV(); // From context
 *
 * const xScale = createLATCHScale(xAxis, data, [0, innerWidth]);
 * const yScale = createLATCHScale(yAxis, data, [0, innerHeight]);
 *
 * // Position cards
 * cards.attr('transform', d => {
 *   const x = xScale.getPosition(d) ?? 0;
 *   const y = yScale.getPosition(d) ?? 0;
 *   return `translate(${x}, ${y})`;
 * });
 * ```
 */
export function createLATCHScale(
  axis: D3LATCHAxis,
  data: CardValue[],
  range: [number, number],
  options: ScaleOptions = {}
): LATCHScale {
  // Create the appropriate scale based on axis type
  let baseScale:
    | d3.ScaleBand<string>
    | d3.ScaleTime<number, number>
    | d3.ScaleLinear<number, number>;

  switch (axis) {
    case 'category':
      baseScale = createCategoryScale(data, range, options);
      break;
    case 'time':
      baseScale = createTimeScale(data, range, options);
      break;
    case 'hierarchy':
      baseScale = createHierarchyScale(data, range, options);
      break;
    case 'alphabet':
      baseScale = createAlphabetScale(data, range, options);
      break;
    case 'location':
      baseScale = createLocationScale(data, range, options);
      break;
    default:
      throw new Error(`Unknown LATCH axis: ${axis}`);
  }

  // Helper to get LATCH value from a card
  function getValue(card: CardValue): string | number | Date | undefined {
    const value = card.latch[axis];

    // For location coordinates, convert to string
    if (axis === 'location' && Array.isArray(value)) {
      return `${(value as [number, number])[0].toFixed(2)}, ${(value as [number, number])[1].toFixed(2)}`;
    }

    // For category arrays, return first item for positioning
    if (axis === 'category' && Array.isArray(value)) {
      return (value as string[])[0];
    }

    return value as string | number | Date;
  }

  // Helper to get scaled position for a card
  function getPosition(card: CardValue): number | undefined {
    const value = getValue(card);
    if (value === undefined) return undefined;

    // Apply the scale with proper typing
    if ('bandwidth' in baseScale) {
      // Band scale
      return (baseScale as d3.ScaleBand<string>)(value as string);
    } else if (axis === 'time') {
      // Time scale
      return (baseScale as d3.ScaleTime<number, number>)(value as Date);
    } else {
      // Linear scale
      return (baseScale as d3.ScaleLinear<number, number>)(value as number);
    }
  }

  // Create the enhanced LATCH scale with proper typing
  const latchScale = Object.assign(
    (value: string | number | Date) => {
      if ('bandwidth' in baseScale) {
        return (baseScale as d3.ScaleBand<string>)(value as string);
      } else if (axis === 'time') {
        return (baseScale as d3.ScaleTime<number, number>)(value as Date);
      } else {
        return (baseScale as d3.ScaleLinear<number, number>)(value as number);
      }
    },
    {
      axis,
      type: axis,
      domain: () => baseScale.domain(),
      range: () => baseScale.range(),
      getValue,
      getPosition,
    }
  );

  // Forward copy method (required by D3 axis)
  if ('copy' in baseScale) {
    (latchScale as LATCHScale & { copy(): LATCHScale }).copy = () => createLATCHScale(axis, data, range, options);
  }

  // Forward ticks method if available (for continuous scales)
  if ('ticks' in baseScale) {
    (latchScale as LATCHScale & { ticks(count?: number): (string | number | Date)[] }).ticks = (...args: number[]) =>
      (baseScale as d3.ScaleLinear<number, number> | d3.ScaleTime<number, number>).ticks(args[0]) as unknown as (string | number | Date)[];
  }

  // Forward tickFormat if available
  if ('tickFormat' in baseScale) {
    (latchScale as LATCHScale & { tickFormat(count?: number, specifier?: string): (d: unknown) => string }).tickFormat = (count?: number, specifier?: string) =>
      (baseScale as d3.ScaleLinear<number, number> | d3.ScaleTime<number, number>).tickFormat(count, specifier) as unknown as (d: unknown) => string;
  }

  // Add bandwidth if available (band scales)
  if ('bandwidth' in baseScale) {
    (latchScale as LATCHScale & { bandwidth(): number }).bandwidth = () => (baseScale as d3.ScaleBand<string>).bandwidth();
  }

  return latchScale as LATCHScale;
}
