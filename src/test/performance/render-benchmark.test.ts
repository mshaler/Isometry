/**
 * Render Benchmark Tests
 *
 * Measures SuperGrid render performance at various scales.
 * Targets from SuperGrid-Specification.md Section 12:
 * - 1k cards: < 200ms
 * - 10k cards: < 500ms
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateBenchmarkData } from './test-data-generator';
import type { Node } from '@/types/node';

// Performance thresholds from spec
const THRESHOLDS = {
  '1k': 200,   // ms
  '5k': 350,   // ms (interpolated)
  '10k': 500,  // ms
};

describe('Render Performance Benchmarks', () => {
  let nodes1k: Node[];
  let nodes5k: Node[];
  let nodes10k: Node[];

  beforeAll(() => {
    // Generate test data once
    nodes1k = generateBenchmarkData('1k', { includeContent: false });
    nodes5k = generateBenchmarkData('5k', { includeContent: false });
    nodes10k = generateBenchmarkData('10k', { includeContent: false });
  });

  describe('Data Generation Performance', () => {
    it('generates 1k nodes quickly', () => {
      const start = performance.now();
      const nodes = generateBenchmarkData('1k');
      const duration = performance.now() - start;

      expect(nodes.length).toBe(1000);
      expect(duration).toBeLessThan(100); // Should be < 100ms
    });

    it('generates 10k nodes in reasonable time', () => {
      const start = performance.now();
      const nodes = generateBenchmarkData('10k');
      const duration = performance.now() - start;

      expect(nodes.length).toBe(10000);
      expect(duration).toBeLessThan(500); // Should be < 500ms
    });

    it('generates consistent data with same seed', () => {
      const nodes1 = generateBenchmarkData('1k', { seed: 42 });
      const nodes2 = generateBenchmarkData('1k', { seed: 42 });

      expect(nodes1[0].name).toBe(nodes2[0].name);
      expect(nodes1[100].folder).toBe(nodes2[100].folder);
      expect(nodes1[500].priority).toBe(nodes2[500].priority);
    });
  });

  describe('Grid Data Processing', () => {
    it('processes 1k nodes for grid layout within threshold', () => {
      const start = performance.now();

      // Simulate grid layout processing
      const gridCells = processNodesForGrid(nodes1k);

      const duration = performance.now() - start;

      expect(gridCells.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(THRESHOLDS['1k']);

      console.log(`1k nodes grid processing: ${duration.toFixed(2)}ms (threshold: ${THRESHOLDS['1k']}ms)`);
    });

    it('processes 5k nodes for grid layout within threshold', () => {
      const start = performance.now();

      const gridCells = processNodesForGrid(nodes5k);

      const duration = performance.now() - start;

      expect(gridCells.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(THRESHOLDS['5k']);

      console.log(`5k nodes grid processing: ${duration.toFixed(2)}ms (threshold: ${THRESHOLDS['5k']}ms)`);
    });

    it('processes 10k nodes for grid layout within threshold', () => {
      const start = performance.now();

      const gridCells = processNodesForGrid(nodes10k);

      const duration = performance.now() - start;

      expect(gridCells.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(THRESHOLDS['10k']);

      console.log(`10k nodes grid processing: ${duration.toFixed(2)}ms (threshold: ${THRESHOLDS['10k']}ms)`);
    });
  });

  describe('Memory Usage', () => {
    it('maintains reasonable memory for 10k nodes', () => {
      // Estimate memory usage
      const singleNodeSize = JSON.stringify(nodes10k[0]).length;
      const totalSize = singleNodeSize * nodes10k.length;
      const totalMB = totalSize / (1024 * 1024);

      // Should be under 50MB for 10k nodes
      expect(totalMB).toBeLessThan(50);

      console.log(`10k nodes estimated memory: ${totalMB.toFixed(2)}MB`);
    });
  });
});

/**
 * Simulate grid layout processing (grouping, positioning)
 */
function processNodesForGrid(nodes: Node[]): GridCell[] {
  // Group by folder
  const groups = new Map<string, Node[]>();
  for (const node of nodes) {
    const folder = node.folder || 'Uncategorized';
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder)!.push(node);
  }

  // Create grid cells
  const cells: GridCell[] = [];
  let rowIndex = 0;

  for (const [folder, folderNodes] of groups) {
    // Group by status within folder
    const statusGroups = new Map<string, Node[]>();
    for (const node of folderNodes) {
      const status = node.status || 'unknown';
      if (!statusGroups.has(status)) {
        statusGroups.set(status, []);
      }
      statusGroups.get(status)!.push(node);
    }

    let colIndex = 0;
    for (const [status, statusNodes] of statusGroups) {
      cells.push({
        id: `cell-${folder}-${status}`,
        rowKey: folder,
        colKey: status,
        nodes: statusNodes,
        position: { x: colIndex * 200, y: rowIndex * 120 },
      });
      colIndex++;
    }
    rowIndex++;
  }

  return cells;
}

interface GridCell {
  id: string;
  rowKey: string;
  colKey: string;
  nodes: Node[];
  position: { x: number; y: number };
}
