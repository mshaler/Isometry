/**
 * HierarchicalHeaderRenderer - Bridge between flat folder paths and NestedHeaderRenderer
 *
 * Part of Phase 92 - SuperStack hierarchical headers
 *
 * Converts folder paths like "Growth/Fitness" into nested hierarchical headers
 * where "Growth" is a parent spanning all "Growth/*" children.
 */

import { RefObject, useEffect } from 'react';
import * as d3 from 'd3';
import { buildNestedHeaderData, type NestedHeaderData } from '@/d3/grid-rendering/NestedHeaderRenderer';

/**
 * Parse folder paths into composite keys for NestedHeaderRenderer.
 * Converts "/" separators to "|" separators.
 *
 * Example: "BairesDev/Operations" -> "BairesDev|Operations"
 */
export function parseFolderHierarchy(folders: string[]): string[] {
  return folders.map(folder => folder.replace(/\//g, '|'));
}

/**
 * Calculate header levels from parsed composite keys.
 * Returns max depth and structured data for rendering.
 */
export function calculateHeaderLevels(compositeKeys: string[], axis: 'x' | 'y'): {
  maxDepth: number;
  headers: NestedHeaderData[];
} {
  const headers = buildNestedHeaderData(compositeKeys, axis);
  const maxDepth = headers.length > 0
    ? Math.max(...headers.map(h => h.level)) + 1
    : 1;

  return { maxDepth, headers };
}

interface HierarchicalHeaderRendererProps {
  folders: string[];
  axis: 'x' | 'y';
  cellSize: number;
  headerHeight: number;
  svgRef: RefObject<SVGSVGElement>;
  headerWidth?: number; // For Y-axis headers (row headers)
}

/**
 * HierarchicalHeaderRenderer component
 *
 * Renders folder paths as nested hierarchical headers using D3 and NestedHeaderRenderer.
 * Parents span their children visually.
 */
export function HierarchicalHeaderRenderer({
  folders,
  axis,
  cellSize,
  headerHeight,
  svgRef,
  headerWidth = 200,
}: HierarchicalHeaderRendererProps): JSX.Element {
  useEffect(() => {
    if (!svgRef.current || folders.length === 0) return;

    // Parse folder paths to composite keys
    const compositeKeys = parseFolderHierarchy(folders);
    const { headers } = calculateHeaderLevels(compositeKeys, axis);

    // Select SVG and clear previous content
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create container group
    const g = svg.append('g').attr('class', 'hierarchical-headers');

    // Render headers by level
    if (axis === 'x') {
      renderXAxisHeaders(g, headers, cellSize, headerHeight);
    } else {
      renderYAxisHeaders(g, headers, cellSize, headerHeight, headerWidth);
    }
  }, [folders, axis, cellSize, headerHeight, svgRef, headerWidth]);

  return <></>;
}

/**
 * Render X-axis (column) hierarchical headers
 */
function renderXAxisHeaders(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  headers: NestedHeaderData[],
  cellSize: number,
  headerHeight: number
): void {
  // Group headers by level
  const levels = new Map<number, NestedHeaderData[]>();
  headers.forEach(h => {
    if (!levels.has(h.level)) {
      levels.set(h.level, []);
    }
    levels.get(h.level)!.push(h);
  });

  const maxLevel = Math.max(...headers.map(h => h.level));

  // Calculate positions for each header
  const positioned: NestedHeaderData[] = [];

  // Start with leaf level (bottom)
  const leafHeaders = levels.get(maxLevel) || [];
  leafHeaders.forEach((header, index) => {
    header.x = index * cellSize;
    header.y = maxLevel * headerHeight;
    header.width = cellSize - 1;
    header.height = headerHeight - 1;
    positioned.push(header);
  });

  // Process parent levels from bottom to top
  for (let level = maxLevel - 1; level >= 0; level--) {
    const levelHeaders = levels.get(level) || [];

    levelHeaders.forEach(header => {
      // Find children at next level
      const children = positioned.filter(h =>
        h.level === level + 1 && h.parentKey === header.key
      );

      if (children.length > 0) {
        // Parent spans all children
        const minX = Math.min(...children.map(c => c.x!));
        const maxX = Math.max(...children.map(c => c.x! + c.width!));

        header.x = minX;
        header.y = level * headerHeight;
        header.width = maxX - minX - 1;
        header.height = headerHeight - 1;
      } else {
        // No children found - fallback positioning
        header.x = 0;
        header.y = level * headerHeight;
        header.width = cellSize - 1;
        header.height = headerHeight - 1;
      }

      positioned.push(header);
    });
  }

  // Render all headers with D3 data join
  const selection = container
    .selectAll<SVGGElement, NestedHeaderData>('.col-header')
    .data(positioned, d => d.key);

  selection.join(
    enter => {
      const g = enter.append('g')
        .attr('class', d => `col-header col-header--level-${d.level}`)
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

      // Background rect with depth-based styling
      g.append('rect')
        .attr('width', d => d.width!)
        .attr('height', d => d.height!)
        .attr('fill', d => d.level === 0 ? '#e2e8f0' : '#f1f5f9')
        .attr('stroke', d => d.level === 0 ? '#cbd5e1' : '#e2e8f0')
        .attr('rx', 4);

      // Label text
      g.append('text')
        .attr('x', d => d.width! / 2)
        .attr('y', d => d.height! / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', d => d.level === 0 ? '11px' : '10px')
        .attr('font-weight', d => d.level === 0 ? '600' : '400')
        .attr('fill', d => d.level === 0 ? '#334155' : '#64748b')
        .text(d => {
          // Truncate long labels
          const maxChars = Math.max(8, Math.floor(d.width! / 8));
          return d.value.length > maxChars
            ? d.value.slice(0, maxChars) + '...'
            : d.value;
        });

      return g;
    }
  );
}

/**
 * Render Y-axis (row) hierarchical headers
 */
function renderYAxisHeaders(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  headers: NestedHeaderData[],
  cellSize: number,
  _headerHeight: number,
  headerWidth: number
): void {
  // Group headers by level
  const levels = new Map<number, NestedHeaderData[]>();
  headers.forEach(h => {
    if (!levels.has(h.level)) {
      levels.set(h.level, []);
    }
    levels.get(h.level)!.push(h);
  });

  const maxLevel = Math.max(...headers.map(h => h.level));

  // Calculate positions for each header
  const positioned: NestedHeaderData[] = [];

  // Start with leaf level (rightmost)
  const leafHeaders = levels.get(maxLevel) || [];
  leafHeaders.forEach((header, index) => {
    const levelWidth = headerWidth / (maxLevel + 1);
    header.x = maxLevel * levelWidth;
    header.y = index * cellSize;
    header.width = levelWidth - 2;
    header.height = cellSize - 1;
    positioned.push(header);
  });

  // Process parent levels from right to left
  for (let level = maxLevel - 1; level >= 0; level--) {
    const levelHeaders = levels.get(level) || [];
    const levelWidth = headerWidth / (maxLevel + 1);

    levelHeaders.forEach(header => {
      // Find children at next level
      const children = positioned.filter(h =>
        h.level === level + 1 && h.parentKey === header.key
      );

      if (children.length > 0) {
        // Parent spans all children vertically
        const minY = Math.min(...children.map(c => c.y!));
        const maxY = Math.max(...children.map(c => c.y! + c.height!));

        header.x = level * levelWidth;
        header.y = minY;
        header.width = levelWidth - 2;
        header.height = maxY - minY - 1;
      } else {
        // No children found - fallback positioning
        header.x = level * levelWidth;
        header.y = 0;
        header.width = levelWidth - 2;
        header.height = cellSize - 1;
      }

      positioned.push(header);
    });
  }

  // Render all headers with D3 data join
  const selection = container
    .selectAll<SVGGElement, NestedHeaderData>('.row-header')
    .data(positioned, d => d.key);

  selection.join(
    enter => {
      const g = enter.append('g')
        .attr('class', d => `row-header row-header--level-${d.level}`)
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

      // Background rect with depth-based styling
      g.append('rect')
        .attr('width', d => d.width!)
        .attr('height', d => d.height!)
        .attr('fill', d => d.level === 0 ? '#e2e8f0' : '#f1f5f9')
        .attr('stroke', d => d.level === 0 ? '#cbd5e1' : '#e2e8f0')
        .attr('rx', 4);

      // Label text
      g.append('text')
        .attr('x', d => d.width! / 2)
        .attr('y', d => d.height! / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', d => d.level === 0 ? '11px' : '10px')
        .attr('font-weight', d => d.level === 0 ? '600' : '400')
        .attr('fill', d => d.level === 0 ? '#334155' : '#64748b')
        .text(d => {
          // Truncate long labels
          const maxChars = Math.max(6, Math.floor(d.width! / 7));
          return d.value.length > maxChars
            ? d.value.slice(0, maxChars) + '...'
            : d.value;
        });

      return g;
    }
  );
}
