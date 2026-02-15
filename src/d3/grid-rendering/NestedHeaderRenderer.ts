/**
 * NestedHeaderRenderer - Data-driven nested header rendering with D3 .join()
 *
 * POLISH-01: Uses D3's .join() pattern for proper enter/update/exit transitions
 * POLISH-02: Handles deep nesting (>5 levels) with collapse
 * POLISH-03: Implements performance degradation for >100 headers
 */

import * as d3 from 'd3';
import { superGridLogger } from '../../utils/dev-logger';

// POLISH-02: Maximum nesting depth before collapsing intermediate levels
export const MAX_NESTING_DEPTH = 5;

// POLISH-03: Maximum visible headers before performance degradation
export const MAX_VISIBLE_HEADERS = 100;

export interface NestedHeaderData {
  key: string;        // Unique identifier for D3 data binding
  value: string;      // Display text
  level: number;      // Nesting level (0 = root)
  span: number;       // Number of leaf descendants
  startIndex: number; // Starting leaf index
  parentKey: string | null; // Parent header key for hierarchy
  isCollapsed: boolean;     // POLISH-02: True if this represents collapsed levels
  originalLevels?: number[]; // Original levels if collapsed
  axis: 'x' | 'y';
  // Computed layout properties (set during render)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface NestedHeaderConfig {
  rowHeaderWidth: number;
  cardHeight: number;
  cardWidth: number;
  headerHeight: number;
  padding: number;
  animationDuration: number;
}

/**
 * Parse composite keys into hierarchical header data.
 * Handles deep nesting collapse and performance limits.
 */
export function buildNestedHeaderData(
  compositeKeys: string[],
  axis: 'x' | 'y'
): NestedHeaderData[] {
  if (compositeKeys.length === 0) {
    return [];
  }

  const allHeaders: NestedHeaderData[] = [];

  // Track all levels for each path
  const paths: string[][] = [];
  let maxDepth = 0;

  compositeKeys.forEach((key) => {
    const parts = key.split('|');
    paths.push(parts);
    maxDepth = Math.max(maxDepth, parts.length);
  });

  // Build headers for each level
  const processedParents = new Map<string, NestedHeaderData>();

  // Process leaf level first to get accurate spans
  const leafCounts = new Map<string, number>();

  paths.forEach((parts) => {
    // Build parent path key for counting leaves
    for (let level = 0; level < parts.length - 1; level++) {
      const pathKey = parts.slice(0, level + 1).join('|');
      leafCounts.set(pathKey, (leafCounts.get(pathKey) || 0) + 1);
    }
  });

  // Now build headers from root to leaf
  // POLISH-02: When depth > MAX_NESTING_DEPTH, keep first 2 levels and last 2 levels,
  // collapse everything in between into a single "..." indicator
  const collapsedLevelStart = 2; // After level 0, 1
  const collapsedLevelEnd = maxDepth - 2; // Before last 2 levels

  paths.forEach((parts, leafIndex) => {
    const isDeepPath = parts.length > MAX_NESTING_DEPTH;

    for (let level = 0; level < parts.length; level++) {
      const value = parts[level];
      const pathKey = parts.slice(0, level + 1).join('|');

      // POLISH-02: Skip intermediate levels if path is too deep
      if (isDeepPath && level >= collapsedLevelStart && level < collapsedLevelEnd) {
        continue; // Skip this level - will be represented by collapsed placeholder
      }

      // Calculate effective level after collapse
      let effectiveLevel = level;
      if (isDeepPath) {
        if (level < collapsedLevelStart) {
          // Keep first 2 levels as-is
          effectiveLevel = level;
        } else if (level === collapsedLevelEnd) {
          // This is where we insert the collapsed placeholder
          effectiveLevel = collapsedLevelStart;
        } else {
          // Last 2 levels: adjust to fit within MAX_NESTING_DEPTH
          effectiveLevel = collapsedLevelStart + 1 + (level - collapsedLevelEnd);
        }
      }

      if (processedParents.has(pathKey)) {
        continue; // Already processed this parent
      }

      const parentPathKey = level > 0 ? parts.slice(0, level).join('|') : null;
      const span = leafCounts.get(pathKey) || 1;
      const startIdx = leafIndex - (span - 1);

      // POLISH-02: Mark as collapsed if this represents skipped levels
      const isCollapsed = isDeepPath && level === collapsedLevelEnd;
      const collapsedCount = isCollapsed ? (collapsedLevelEnd - collapsedLevelStart) : 0;

      const headerData: NestedHeaderData = {
        key: `${axis}_${effectiveLevel}_${pathKey}`,
        value: isCollapsed ? `...${collapsedCount} levels...` : value,
        level: effectiveLevel,
        span: span > 0 ? span : 1,
        startIndex: startIdx >= 0 ? startIdx : leafIndex,
        parentKey: parentPathKey ? `${axis}_${effectiveLevel - 1}_${parentPathKey}` : null,
        isCollapsed,
        originalLevels: isCollapsed
          ? Array.from({ length: collapsedCount }, (_, i) => collapsedLevelStart + i)
          : undefined,
        axis,
      };

      processedParents.set(pathKey, headerData);
      allHeaders.push(headerData);
    }
  });

  // Fix spans and indices for parents based on children
  const levelGroups = new Map<number, NestedHeaderData[]>();
  allHeaders.forEach(h => {
    const level = h.level;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(h);
  });

  // Process from leaf to root to get accurate spans
  const maxLevel = Math.max(...allHeaders.map(h => h.level));
  for (let level = maxLevel; level >= 0; level--) {
    const headers = levelGroups.get(level) || [];
    let idx = 0;
    headers.forEach(h => {
      if (level === maxLevel) {
        // Leaf level: span = 1, sequential indices
        h.span = 1;
        h.startIndex = idx++;
      }
    });
  }

  // POLISH-03: Performance degradation - truncate if too many headers
  if (allHeaders.length > MAX_VISIBLE_HEADERS) {
    superGridLogger.debug('Headers truncated', {
      original: allHeaders.length,
      truncated: MAX_VISIBLE_HEADERS
    });

    // Prioritize parent headers (lower levels)
    const sorted = [...allHeaders].sort((a, b) => a.level - b.level);
    return sorted.slice(0, MAX_VISIBLE_HEADERS);
  }

  return allHeaders;
}

/**
 * NestedHeaderRenderer - Renders nested headers using D3's data-driven .join() pattern.
 *
 * Unlike imperative .append(), this approach:
 * 1. Binds data to selections using .data() with key functions
 * 2. Uses .join() for proper enter/update/exit handling
 * 3. Supports animated transitions between states
 */
export class NestedHeaderRenderer {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: NestedHeaderConfig;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: NestedHeaderConfig
  ) {
    this.container = container;
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NestedHeaderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Render nested headers for an axis using data-driven .join() pattern.
   */
  render(axis: 'x' | 'y', compositeKeys: string[]): void {
    const headerData = buildNestedHeaderData(compositeKeys, axis);

    if (axis === 'y') {
      this.renderYAxis(headerData);
    } else {
      this.renderXAxis(headerData);
    }

    superGridLogger.debug('[NestedHeaderRenderer] Rendered headers:', {
      axis,
      count: headerData.length,
      levels: [...new Set(headerData.map(h => h.level))],
    });
  }

  /**
   * Render Y-axis (row) headers with .join() pattern.
   */
  private renderYAxis(headerData: NestedHeaderData[]): void {
    const { rowHeaderWidth, cardHeight, padding, animationDuration } = this.config;
    const headerContainer = this.container.select('.headers');

    // Calculate positions for each header
    const headerOffset = this.config.headerHeight + padding;
    const cellHeight = cardHeight + padding;

    // Separate parents (level 0) and children (level > 0)
    const parents = headerData.filter(h => h.level === 0);
    const children = headerData.filter(h => h.level > 0);

    // Calculate cumulative Y positions for parents
    let yPos = 0;
    parents.forEach(parent => {
      parent.y = headerOffset + yPos * cellHeight;
      parent.x = 0;
      parent.width = rowHeaderWidth / 2 - 2;
      parent.height = parent.span * cellHeight - padding;
      yPos += parent.span;
    });

    // Calculate positions for children
    children.forEach(child => {
      const parent = parents.find(p => child.parentKey === p.key);
      if (parent) {
        const childIndexInParent = children
          .filter(c => c.parentKey === parent.key)
          .indexOf(child);
        child.y = parent.y! + childIndexInParent * cellHeight;
        child.x = rowHeaderWidth / 2 + 2;
        child.width = rowHeaderWidth / 2 - 4;
        child.height = cardHeight;
      }
    });

    // Render parent headers with .join()
    const parentSelection = headerContainer
      .selectAll<SVGGElement, NestedHeaderData>('.row-header--parent')
      .data(parents, d => d.key);

    parentSelection.join(
      // ENTER: Create new parent headers
      enter => {
        const g = enter.append('g')
          .attr('class', 'row-header row-header--parent')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .attr('opacity', 0);

        // Background rect
        g.append('rect')
          .attr('width', d => d.width!)
          .attr('height', d => d.height!)
          .attr('fill', '#e2e8f0')
          .attr('stroke', '#cbd5e1')
          .attr('rx', 4);

        // Label text
        g.append('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#334155')
          .text(d => d.value);

        // Fade in
        g.transition()
          .duration(animationDuration)
          .attr('opacity', 1);

        return g;
      },
      // UPDATE: Transition existing headers to new positions
      update => {
        update.transition()
          .duration(animationDuration)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        update.select('rect')
          .transition()
          .duration(animationDuration)
          .attr('width', d => d.width!)
          .attr('height', d => d.height!);

        update.select('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .text(d => d.value);

        return update;
      },
      // EXIT: Fade out and remove (immediate if no animation)
      exit => {
        if (animationDuration === 0) {
          exit.remove();
        } else {
          exit.transition()
            .duration(animationDuration)
            .attr('opacity', 0)
            .remove();
        }
        return exit;
      }
    );

    // Render child headers with .join()
    const childSelection = headerContainer
      .selectAll<SVGGElement, NestedHeaderData>('.row-header--child')
      .data(children, d => d.key);

    childSelection.join(
      enter => {
        const g = enter.append('g')
          .attr('class', 'row-header row-header--child')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .attr('opacity', 0);

        g.append('rect')
          .attr('width', d => d.width!)
          .attr('height', d => d.height!)
          .attr('fill', '#f1f5f9')
          .attr('stroke', '#e2e8f0')
          .attr('rx', 4);

        g.append('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#64748b')
          .text(d => d.value);

        g.transition()
          .duration(animationDuration)
          .attr('opacity', 1);

        return g;
      },
      update => {
        update.transition()
          .duration(animationDuration)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        update.select('rect')
          .transition()
          .duration(animationDuration)
          .attr('width', d => d.width!)
          .attr('height', d => d.height!);

        update.select('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .text(d => d.value);

        return update;
      },
      exit => {
        if (animationDuration === 0) {
          exit.remove();
        } else {
          exit.transition()
            .duration(animationDuration)
            .attr('opacity', 0)
            .remove();
        }
        return exit;
      }
    );
  }

  /**
   * Render X-axis (column) headers with .join() pattern.
   */
  private renderXAxis(headerData: NestedHeaderData[]): void {
    const { rowHeaderWidth, cardWidth, padding, animationDuration, headerHeight } = this.config;
    const headerContainer = this.container.select('.headers');

    const parentHeaderHeight = headerHeight * 0.6;
    const childHeaderHeight = headerHeight * 0.5;

    // Separate parents and children
    const parents = headerData.filter(h => h.level === 0);
    const children = headerData.filter(h => h.level > 0);

    // Calculate positions for parents
    let xPos = 0;
    parents.forEach(parent => {
      parent.x = rowHeaderWidth + padding + xPos * (cardWidth + padding);
      parent.y = 0;
      parent.width = parent.span * (cardWidth + padding) - padding;
      parent.height = parentHeaderHeight;
      xPos += parent.span;
    });

    // Calculate positions for children
    children.forEach(child => {
      const parent = parents.find(p => child.parentKey === p.key);
      if (parent) {
        const childIndexInParent = children
          .filter(c => c.parentKey === parent.key)
          .indexOf(child);
        child.x = parent.x! + childIndexInParent * (cardWidth + padding);
        child.y = parentHeaderHeight + 2;
        child.width = cardWidth;
        child.height = childHeaderHeight;
      }
    });

    // Render parent headers with .join()
    const parentSelection = headerContainer
      .selectAll<SVGGElement, NestedHeaderData>('.col-header--parent')
      .data(parents, d => d.key);

    parentSelection.join(
      enter => {
        const g = enter.append('g')
          .attr('class', 'col-header col-header--parent')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .attr('opacity', 0);

        g.append('rect')
          .attr('width', d => d.width!)
          .attr('height', d => d.height!)
          .attr('fill', '#e2e8f0')
          .attr('stroke', '#cbd5e1')
          .attr('rx', 4);

        g.append('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#334155')
          .text(d => d.value);

        g.transition()
          .duration(animationDuration)
          .attr('opacity', 1);

        return g;
      },
      update => {
        update.transition()
          .duration(animationDuration)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        update.select('rect')
          .transition()
          .duration(animationDuration)
          .attr('width', d => d.width!)
          .attr('height', d => d.height!);

        update.select('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .text(d => d.value);

        return update;
      },
      exit => {
        if (animationDuration === 0) {
          exit.remove();
        } else {
          exit.transition()
            .duration(animationDuration)
            .attr('opacity', 0)
            .remove();
        }
        return exit;
      }
    );

    // Render child headers with .join()
    const childSelection = headerContainer
      .selectAll<SVGGElement, NestedHeaderData>('.col-header--child')
      .data(children, d => d.key);

    childSelection.join(
      enter => {
        const g = enter.append('g')
          .attr('class', 'col-header col-header--child')
          .attr('transform', d => `translate(${d.x}, ${d.y})`)
          .attr('opacity', 0);

        g.append('rect')
          .attr('width', d => d.width!)
          .attr('height', d => d.height!)
          .attr('fill', '#f1f5f9')
          .attr('stroke', '#e2e8f0')
          .attr('rx', 4);

        g.append('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#64748b')
          .text(d => d.value);

        g.transition()
          .duration(animationDuration)
          .attr('opacity', 1);

        return g;
      },
      update => {
        update.transition()
          .duration(animationDuration)
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        update.select('rect')
          .transition()
          .duration(animationDuration)
          .attr('width', d => d.width!)
          .attr('height', d => d.height!);

        update.select('text')
          .attr('x', d => d.width! / 2)
          .attr('y', d => d.height! / 2 + 4)
          .text(d => d.value);

        return update;
      },
      exit => {
        if (animationDuration === 0) {
          exit.remove();
        } else {
          exit.transition()
            .duration(animationDuration)
            .attr('opacity', 0)
            .remove();
        }
        return exit;
      }
    );
  }

  /**
   * Clear all rendered headers
   */
  clear(): void {
    const headerContainer = this.container.select('.headers');
    headerContainer.selectAll('.row-header--parent').remove();
    headerContainer.selectAll('.row-header--child').remove();
    headerContainer.selectAll('.col-header--parent').remove();
    headerContainer.selectAll('.col-header--child').remove();
  }
}
