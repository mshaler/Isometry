import * as d3 from 'd3';
import type { Chip } from '../contexts/PAFVContext';
import type { Node } from '../types/node';

// ============================================================================
// Scale Type Definitions
// ============================================================================

export type ScaleType = 'temporal' | 'categorical' | 'numerical' | 'ordinal';

export interface ScaleConfig {
  type: ScaleType;
  domain: unknown[];
  range: [number, number];
  padding?: number;
  nice?: boolean;
}

export interface D3Scale {
  scale: d3.ScaleTime<number, number> | d3.ScaleBand<string> | d3.ScaleLinear<number, number> | d3.ScaleOrdinal<string, unknown>;
  type: ScaleType;
  config: ScaleConfig;
}

export interface ScaleSystemConfig {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerHeights: {
    column: number;
    row: number;
  };
}

export interface HierarchicalScale {
  levels: D3Scale[];
  composite: d3.ScaleBand<string>;
  totalHeight: number;
  totalWidth: number;
}

// ============================================================================
// Field Analysis & Type Inference
// ============================================================================

const FIELD_MAP: Record<string, keyof Node> = {
  folder: 'folder',
  subfolder: 'status',
  tags: 'folder',
  year: 'createdAt',
  month: 'createdAt',
  category: 'folder',
  status: 'status',
  priority: 'priority',
};

/**
 * Extract field value from node based on chip configuration
 */
export const extractFieldValue = (node: Node, chip: Chip): unknown => {
  const field = FIELD_MAP[chip.id] || 'folder';
  const value = node[field];

  if (field === 'createdAt' && value) {
    const date = new Date(value as string);
    if (chip.id === 'year') {
      return date.getFullYear();
    }
    if (chip.id === 'month') {
      return date.getMonth(); // 0-11 for proper temporal scale
    }
    return date; // Full date for temporal scales
  }

  if (chip.id === 'priority' && typeof value === 'string') {
    // Convert priority to numerical value for proper ordering
    const priorityMap: Record<string, number> = {
      'high': 3,
      'medium': 2,
      'low': 1
    };
    return priorityMap[value.toLowerCase()] || 1;
  }

  return value ?? 'Unknown';
};

/**
 * Infer optimal scale type from chip and data characteristics
 */
export const inferScaleType = (chip: Chip, domain: unknown[]): ScaleType => {
  // Explicit temporal indicators
  if (['year', 'month', 'date', 'time'].includes(chip.id)) {
    return 'temporal';
  }

  // Check if domain contains dates
  if (domain.length > 0 && domain[0] instanceof Date) {
    return 'temporal';
  }

  // Check if domain is numerical
  if (domain.length > 0 && typeof domain[0] === 'number') {
    // For continuous numerical data, use linear scale
    if (domain.length > 10 || chip.id === 'priority') {
      return 'numerical';
    }
    // For discrete numerical data, use ordinal
    return 'ordinal';
  }

  // Check for ordered categorical data
  if (['priority', 'status', 'rating'].includes(chip.id)) {
    return 'ordinal';
  }

  // Default to categorical for text/string data
  return 'categorical';
};

/**
 * Extract domain values from nodes for a specific chip
 */
export const extractDomain = (nodes: Node[], chip: Chip): unknown[] => {
  const values = nodes.map(node => extractFieldValue(node, chip));
  const uniqueValues = Array.from(new Set(values));

  const scaleType = inferScaleType(chip, uniqueValues);

  switch (scaleType) {
    case 'temporal':
      // Sort dates chronologically
      return uniqueValues.filter(v => v instanceof Date || typeof v === 'number').sort();

    case 'numerical':
      // Sort numbers numerically
      return uniqueValues.filter(v => typeof v === 'number').sort((a, b) => (a as number) - (b as number));

    case 'ordinal':
      // Custom sorting for ordered categories
      if (chip.id === 'priority') {
        return [1, 2, 3]; // low, medium, high
      }
      if (chip.id === 'status') {
        return ['draft', 'pending', 'active', 'completed']; // Workflow order
      }
      return uniqueValues.sort();

    case 'categorical':
    default:
      // Alphabetical sorting for categories
      return uniqueValues.map(v => String(v)).sort();
  }
};

// ============================================================================
// Scale Factory Functions
// ============================================================================

/**
 * Create a D3 scale from chip configuration and domain
 */
export const createScale = (chip: Chip, domain: unknown[], range: [number, number], padding: number = 0.1): D3Scale => {
  const scaleType = inferScaleType(chip, domain);
  const config: ScaleConfig = {
    type: scaleType,
    domain,
    range,
    padding
  };

  switch (scaleType) {
    case 'temporal': {
      const temporalDomain = domain as Date[] | number[];
      const scale = d3.scaleTime()
        .domain(d3.extent(temporalDomain) as [Date | number, Date | number])
        .range(range)
        .nice();

      return { scale, type: scaleType, config };
    }

    case 'numerical': {
      const numericalDomain = domain as number[];
      const scale = d3.scaleLinear()
        .domain(d3.extent(numericalDomain) as [number, number])
        .range(range)
        .nice();

      return { scale, type: scaleType, config };
    }

    case 'ordinal': {
      const ordinalDomain = domain.map(String);
      const scale = d3.scaleOrdinal()
        .domain(ordinalDomain)
        .range(d3.range(range[0], range[1], (range[1] - range[0]) / ordinalDomain.length));

      return { scale, type: scaleType, config };
    }

    case 'categorical':
    default: {
      const categoricalDomain = domain.map(String);
      const scale = d3.scaleBand()
        .domain(categoricalDomain)
        .range(range)
        .padding(padding);

      return { scale, type: scaleType, config };
    }
  }
};

// ============================================================================
// Hierarchical Scale System
// ============================================================================

/**
 * Create hierarchical scales for multi-chip axes
 */
export const createHierarchicalScales = (
  chips: Chip[],
  nodes: Node[],
  range: [number, number],
  systemConfig: ScaleSystemConfig
): HierarchicalScale => {
  if (chips.length === 0) {
    const emptyScale = d3.scaleBand<string>().domain([]).range(range);
    return {
      levels: [],
      composite: emptyScale,
      totalHeight: 0,
      totalWidth: 0
    };
  }

  if (chips.length === 1) {
    // Single level - create simple scale
    const domain = extractDomain(nodes, chips[0]);
    const d3Scale = createScale(chips[0], domain, range);
    const bandScale = d3Scale.scale as d3.ScaleBand<string>;

    return {
      levels: [d3Scale],
      composite: bandScale,
      totalHeight: systemConfig.headerHeights.row,
      totalWidth: systemConfig.headerHeights.column
    };
  }

  // Multi-level hierarchical scales
  const levels: D3Scale[] = [];
  const rangeSplit = (range[1] - range[0]) / chips.length;

  chips.forEach((chip, index) => {
    const levelRange: [number, number] = [
      range[0] + (index * rangeSplit),
      range[0] + ((index + 1) * rangeSplit)
    ];

    const domain = extractDomain(nodes, chip);
    const scale = createScale(chip, domain, levelRange, 0.05);
    levels.push(scale);
  });

  // Create composite scale for positioning
  const compositeKeys = new Set<string>();
  nodes.forEach(node => {
    const compositeKey = chips.map(chip => String(extractFieldValue(node, chip))).join('|');
    compositeKeys.add(compositeKey);
  });

  const composite = d3.scaleBand<string>()
    .domain(Array.from(compositeKeys).sort())
    .range(range)
    .padding(0.1);

  return {
    levels,
    composite,
    totalHeight: systemConfig.headerHeights.row * chips.length,
    totalWidth: systemConfig.headerHeights.column * chips.length
  };
};

// ============================================================================
// Scale System Cache
// ============================================================================

interface ScaleCacheEntry {
  scale: D3Scale;
  timestamp: number;
  chipId: string;
  domainHash: string;
  rangeHash: string;
}

class ScaleCache {
  private cache = new Map<string, ScaleCacheEntry>();
  private maxAge = 60000; // 1 minute
  private maxEntries = 100;

  private createCacheKey(chipId: string, domain: unknown[], range: [number, number]): string {
    const domainHash = JSON.stringify(domain);
    const rangeHash = `${range[0]},${range[1]}`;
    return `${chipId}:${domainHash}:${rangeHash}`;
  }

  private createHashes(domain: unknown[], range: [number, number]): { domainHash: string; rangeHash: string } {
    return {
      domainHash: JSON.stringify(domain),
      rangeHash: `${range[0]},${range[1]}`
    };
  }

  get(chipId: string, domain: unknown[], range: [number, number]): D3Scale | null {
    const key = this.createCacheKey(chipId, domain, range);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.scale;
  }

  set(chipId: string, domain: unknown[], range: [number, number], scale: D3Scale): void {
    const key = this.createCacheKey(chipId, domain, range);
    const { domainHash, rangeHash } = this.createHashes(domain, range);

    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      scale,
      timestamp: Date.now(),
      chipId,
      domainHash,
      rangeHash
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { entries: number; oldestAge: number; newestAge: number } {
    if (this.cache.size === 0) {
      return { entries: 0, oldestAge: 0, newestAge: 0 };
    }

    const now = Date.now();
    const timestamps = Array.from(this.cache.values()).map(entry => entry.timestamp);
    const oldestAge = now - Math.min(...timestamps);
    const newestAge = now - Math.max(...timestamps);

    return {
      entries: this.cache.size,
      oldestAge,
      newestAge
    };
  }
}

// Global scale cache instance
const scaleCache = new ScaleCache();

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a cached D3 scale from chip configuration
 */
export const createCachedScale = (chip: Chip, domain: unknown[], range: [number, number], padding?: number): D3Scale => {
  // Check cache first
  const cachedScale = scaleCache.get(chip.id, domain, range);
  if (cachedScale) {
    return cachedScale;
  }

  // Create new scale
  const scale = createScale(chip, domain, range, padding);

  // Cache the result
  scaleCache.set(chip.id, domain, range, scale);

  return scale;
};

/**
 * Create complete scale system for PAFV visualization
 */
export const createScaleSystem = (
  rowChips: Chip[],
  colChips: Chip[],
  nodes: Node[],
  systemConfig: ScaleSystemConfig
): {
  x: HierarchicalScale;
  y: HierarchicalScale;
  color: d3.ScaleOrdinal<string, string>;
  size: d3.ScaleLinear<number, number>;
} => {
  // Create hierarchical scales for rows and columns
  const dataWidth = systemConfig.width - systemConfig.padding.left - systemConfig.padding.right;
  const dataHeight = systemConfig.height - systemConfig.padding.top - systemConfig.padding.bottom;

  const x = createHierarchicalScales(
    colChips,
    nodes,
    [systemConfig.padding.left, systemConfig.padding.left + dataWidth],
    systemConfig
  );

  const y = createHierarchicalScales(
    rowChips,
    nodes,
    [systemConfig.padding.top, systemConfig.padding.top + dataHeight],
    systemConfig
  );

  // Create supplementary scales
  const folders = Array.from(new Set(nodes.map(n => n.folder)));
  const color = d3.scaleOrdinal<string, string>()
    .domain(folders)
    .range(d3.schemeCategory10);

  const nodeCountExtent = d3.extent(
    Array.from(
      d3.group(nodes, n => `${extractFieldValue(n, colChips[0] || { id: 'folder', label: 'Folder' })}`).values(),
      group => group.length
    )
  ) as [number, number];

  const size = d3.scaleLinear()
    .domain(nodeCountExtent)
    .range([2, 10])
    .clamp(true);

  return { x, y, color, size };
};

/**
 * Clear scale cache (useful for testing or memory management)
 */
export const clearScaleCache = (): void => {
  scaleCache.clear();
};

/**
 * Get scale cache statistics
 */
export const getScaleCacheStats = () => {
  return scaleCache.getStats();
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a scale is a band scale (supports bandwidth method)
 */
export const isBandScale = (scale: unknown): scale is d3.ScaleBand<string> => {
  return typeof scale.bandwidth === 'function';
};

/**
 * Get the bandwidth of a scale, or default width for non-band scales
 */
export const getScaleBandwidth = (scale: unknown, defaultWidth: number = 100): number => {
  if (isBandScale(scale)) {
    return scale.bandwidth();
  }
  return defaultWidth;
};

/**
 * Format scale domain value for display
 */
export const formatDomainValue = (value: unknown, scaleType: ScaleType): string => {
  switch (scaleType) {
    case 'temporal':
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (typeof value === 'number') {
        return new Date(value).toLocaleDateString();
      }
      return String(value);

    case 'numerical':
      if (typeof value === 'number') {
        return value.toLocaleString();
      }
      return String(value);

    case 'ordinal':
      if (typeof value === 'number') {
        // Priority mapping
        const priorityLabels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
        return priorityLabels[value] || String(value);
      }
      return String(value);

    case 'categorical':
    default:
      return String(value);
  }
};

/**
 * Get optimal tick count for a scale based on available space
 */
export const getOptimalTickCount = (scale: unknown, availableSpace: number, minSpacing: number = 50): number => {
  const maxTicks = Math.floor(availableSpace / minSpacing);

  if (typeof scale.domain === 'function') {
    const domainLength = scale.domain().length;
    return Math.min(maxTicks, domainLength);
  }

  return Math.min(maxTicks, 10); // Default maximum
};