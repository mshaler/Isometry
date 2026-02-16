/**
 * Unit tests for treeMetrics.ts
 *
 * Tests the tree traversal and metrics computation for CSS Grid spanning.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTreeMetrics,
  getLeafNodes,
  getHeaderNodes,
  findNodeById,
  findNodeByPath,
} from '../utils/treeMetrics';
import type { AxisNode } from '../types';

describe('computeTreeMetrics', () => {
  describe('flat list (depth 1)', () => {
    const flatTree: AxisNode = {
      label: 'Root',
      id: 'root',
      children: [
        { label: 'A', id: 'a' },
        { label: 'B', id: 'b' },
        { label: 'C', id: 'c' },
      ],
    };

    it('computes correct depth for flat list', () => {
      const metrics = computeTreeMetrics(flatTree);
      expect(metrics.depth).toBe(1);
    });

    it('computes correct leaf count for flat list', () => {
      const metrics = computeTreeMetrics(flatTree);
      expect(metrics.leafCount).toBe(3);
    });

    it('creates flat nodes for all leaves', () => {
      const metrics = computeTreeMetrics(flatTree);
      expect(metrics.flatNodes).toHaveLength(3);
    });

    it('assigns correct leafStart to each node', () => {
      const metrics = computeTreeMetrics(flatTree);
      const nodeA = metrics.flatNodes.find((n) => n.node.id === 'a');
      const nodeB = metrics.flatNodes.find((n) => n.node.id === 'b');
      const nodeC = metrics.flatNodes.find((n) => n.node.id === 'c');

      expect(nodeA?.leafStart).toBe(0);
      expect(nodeB?.leafStart).toBe(1);
      expect(nodeC?.leafStart).toBe(2);
    });

    it('marks all nodes as leaves', () => {
      const metrics = computeTreeMetrics(flatTree);
      expect(metrics.flatNodes.every((n) => n.isLeaf)).toBe(true);
    });
  });

  describe('nested hierarchy (depth 3)', () => {
    const nestedTree: AxisNode = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: 'Parent',
          id: 'parent',
          children: [
            {
              label: 'Child',
              id: 'child',
              children: [{ label: 'Grandchild', id: 'gc' }],
            },
          ],
        },
      ],
    };

    it('computes correct depth for nested hierarchy', () => {
      const metrics = computeTreeMetrics(nestedTree);
      expect(metrics.depth).toBe(3);
    });

    it('computes correct leaf count for single deep path', () => {
      const metrics = computeTreeMetrics(nestedTree);
      expect(metrics.leafCount).toBe(1);
    });

    it('includes internal nodes in flatNodes', () => {
      const metrics = computeTreeMetrics(nestedTree);
      // Grandchild (leaf), Child, Parent = 3 nodes (root is virtual)
      expect(metrics.flatNodes).toHaveLength(3);
    });

    it('assigns correct depths to nested nodes', () => {
      const metrics = computeTreeMetrics(nestedTree);
      const parent = metrics.flatNodes.find((n) => n.node.id === 'parent');
      const child = metrics.flatNodes.find((n) => n.node.id === 'child');
      const gc = metrics.flatNodes.find((n) => n.node.id === 'gc');

      expect(parent?.depth).toBe(0);
      expect(child?.depth).toBe(1);
      expect(gc?.depth).toBe(2);
    });

    it('computes correct paths for nested nodes', () => {
      const metrics = computeTreeMetrics(nestedTree);
      const gc = metrics.flatNodes.find((n) => n.node.id === 'gc');

      expect(gc?.path).toEqual(['root', 'parent', 'child', 'gc']);
    });
  });

  describe('reference image data (FutureME example)', () => {
    // FutureME has 12 leaves (4+4+4)
    const futureMETree: AxisNode = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: 'FutureME',
          id: 'futureme',
          children: [
            {
              label: 'Learning',
              id: 'learning',
              children: [
                { label: 'Tools', id: 'tools' },
                { label: 'Progress', id: 'progress' },
                { label: 'Reference', id: 'reference' },
                { label: 'Community', id: 'community' },
              ],
            },
            {
              label: 'Growth',
              id: 'growth',
              children: [
                { label: 'Fitness', id: 'fitness' },
                { label: 'Health', id: 'health' },
                { label: 'Play', id: 'play' },
                { label: 'Travel', id: 'travel' },
              ],
            },
            {
              label: 'Writing',
              id: 'writing',
              children: [
                { label: 'Novels', id: 'novels' },
                { label: 'Poetry', id: 'poetry' },
                { label: 'Essays', id: 'essays' },
                { label: 'Photos', id: 'photos' },
              ],
            },
          ],
        },
      ],
    };

    it('computes correct leaf count for FutureME (12 leaves)', () => {
      const metrics = computeTreeMetrics(futureMETree);
      expect(metrics.leafCount).toBe(12);
    });

    it('computes correct depth for 3-level hierarchy', () => {
      const metrics = computeTreeMetrics(futureMETree);
      expect(metrics.depth).toBe(3);
    });

    it('FutureME spans all 12 leaves starting at 0', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const futureME = metrics.flatNodes.find((n) => n.node.id === 'futureme');

      expect(futureME?.leafCount).toBe(12);
      expect(futureME?.leafStart).toBe(0);
    });

    it('Learning spans 4 leaves starting at 0', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const learning = metrics.flatNodes.find((n) => n.node.id === 'learning');

      expect(learning?.leafCount).toBe(4);
      expect(learning?.leafStart).toBe(0);
    });

    it('Growth spans 4 leaves starting at 4', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const growth = metrics.flatNodes.find((n) => n.node.id === 'growth');

      expect(growth?.leafCount).toBe(4);
      expect(growth?.leafStart).toBe(4);
    });

    it('Writing spans 4 leaves starting at 8', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const writing = metrics.flatNodes.find((n) => n.node.id === 'writing');

      expect(writing?.leafCount).toBe(4);
      expect(writing?.leafStart).toBe(8);
    });

    it('Tools is at leafStart 0 with leafCount 1', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const tools = metrics.flatNodes.find((n) => n.node.id === 'tools');

      expect(tools?.leafStart).toBe(0);
      expect(tools?.leafCount).toBe(1);
      expect(tools?.isLeaf).toBe(true);
    });

    it('Fitness is at leafStart 4 with leafCount 1', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const fitness = metrics.flatNodes.find((n) => n.node.id === 'fitness');

      expect(fitness?.leafStart).toBe(4);
      expect(fitness?.leafCount).toBe(1);
    });

    it('Novels is at leafStart 8 with leafCount 1', () => {
      const metrics = computeTreeMetrics(futureMETree);
      const novels = metrics.flatNodes.find((n) => n.node.id === 'novels');

      expect(novels?.leafStart).toBe(8);
      expect(novels?.leafCount).toBe(1);
    });
  });

  describe('full reference image row axis', () => {
    // Complete row axis from reference image
    const fullRowAxis: AxisNode = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: 'FutureME',
          id: 'futureme',
          children: [
            {
              label: 'Learning',
              id: 'learning',
              children: [
                { label: 'Tools', id: 'tools' },
                { label: 'Progress', id: 'progress' },
                { label: 'Reference', id: 'reference' },
                { label: 'Community', id: 'community' },
              ],
            },
            {
              label: 'Growth',
              id: 'growth',
              children: [
                { label: 'Fitness', id: 'fitness' },
                { label: 'Health', id: 'health' },
                { label: 'Play', id: 'play' },
                { label: 'Travel', id: 'travel' },
              ],
            },
            {
              label: 'Writing',
              id: 'writing',
              children: [
                { label: 'Novels', id: 'novels' },
                { label: 'Poetry', id: 'poetry' },
                { label: 'Essays', id: 'essays' },
                { label: 'Photos', id: 'photos' },
              ],
            },
          ],
        },
        {
          label: 'Home',
          id: 'home',
          children: [
            {
              label: 'Family',
              id: 'family',
              children: [
                { label: 'Alex', id: 'alex' },
                { label: 'Stacey', id: 'stacey' },
                { label: 'Extended family', id: 'extended' },
                { label: 'Friends', id: 'friends' },
              ],
            },
            {
              label: 'House',
              id: 'house',
              children: [
                { label: 'Garage+', id: 'garage' },
                { label: 'Interior+', id: 'interior' },
                { label: 'Kitchen+', id: 'kitchen' },
                { label: 'HVAC+', id: 'hvac' },
                { label: 'Bathrooms+', id: 'bathrooms' },
              ],
            },
            {
              label: 'Money+',
              id: 'money',
              children: [
                { label: 'Mortgage', id: 'mortgage' },
                { label: 'Retirement', id: 'retirement' },
                { label: 'Tuition', id: 'tuition' },
              ],
            },
          ],
        },
        {
          label: 'Work',
          id: 'work',
          children: [
            {
              label: 'PlanB',
              id: 'planb',
              children: [
                { label: 'Executive', id: 'executive' },
                { label: 'Consulting', id: 'consulting' },
              ],
            },
            {
              label: 'BairesDev',
              id: 'bairesdev',
              children: [
                { label: 'Opportunities', id: 'opportunities' },
                { label: 'Operations', id: 'operations' },
              ],
            },
          ],
        },
      ],
    };

    it('computes total 28 leaves (12+12+4)', () => {
      // FutureME: 4+4+4 = 12 leaves
      // Home: 4+5+3 = 12 leaves
      // Work: 2+2 = 4 leaves
      // Total = 28
      const metrics = computeTreeMetrics(fullRowAxis);
      expect(metrics.leafCount).toBe(28);
    });

    it('Home starts at leaf 12', () => {
      const metrics = computeTreeMetrics(fullRowAxis);
      const home = metrics.flatNodes.find((n) => n.node.id === 'home');
      // FutureME has 12 leaves, so Home starts at 12
      expect(home?.leafStart).toBe(12);
    });

    it('Home spans 12 leaves (4+5+3)', () => {
      const metrics = computeTreeMetrics(fullRowAxis);
      const home = metrics.flatNodes.find((n) => n.node.id === 'home');
      expect(home?.leafCount).toBe(12);
    });

    it('Work starts at leaf 24', () => {
      const metrics = computeTreeMetrics(fullRowAxis);
      const work = metrics.flatNodes.find((n) => n.node.id === 'work');
      // FutureME (12) + Home (12) = 24
      expect(work?.leafStart).toBe(24);
    });

    it('Work spans 4 leaves (2+2)', () => {
      const metrics = computeTreeMetrics(fullRowAxis);
      const work = metrics.flatNodes.find((n) => n.node.id === 'work');
      expect(work?.leafCount).toBe(4);
    });
  });

  describe('column axis (time)', () => {
    const columnAxis: AxisNode = {
      label: 'Root',
      id: 'root',
      children: [
        {
          label: '2022',
          id: '2022',
          children: [
            { label: 'Q1', id: '2022-q1' },
            { label: 'Q2', id: '2022-q2' },
            { label: 'Q3', id: '2022-q3' },
            { label: 'Q4', id: '2022-q4' },
          ],
        },
      ],
    };

    it('computes depth of 2 (year -> quarter)', () => {
      const metrics = computeTreeMetrics(columnAxis);
      expect(metrics.depth).toBe(2);
    });

    it('computes 4 leaf columns', () => {
      const metrics = computeTreeMetrics(columnAxis);
      expect(metrics.leafCount).toBe(4);
    });

    it('2022 spans all 4 quarters', () => {
      const metrics = computeTreeMetrics(columnAxis);
      const year2022 = metrics.flatNodes.find((n) => n.node.id === '2022');
      expect(year2022?.leafCount).toBe(4);
      expect(year2022?.leafStart).toBe(0);
    });
  });

  describe('empty tree', () => {
    it('handles tree with no children', () => {
      const emptyTree: AxisNode = {
        label: 'Root',
        id: 'root',
        children: [],
      };

      const metrics = computeTreeMetrics(emptyTree);
      // Empty tree has no nodes traversed, maxDepth stays 0
      // depth = maxDepth + 1 = 1 (reflects one level: the virtual root)
      expect(metrics.depth).toBe(1);
      expect(metrics.leafCount).toBe(0);
      expect(metrics.flatNodes).toHaveLength(0);
    });

    it('handles tree with undefined children', () => {
      const noChildrenTree: AxisNode = {
        label: 'Root',
        id: 'root',
      };

      const metrics = computeTreeMetrics(noChildrenTree);
      // Same as empty children - depth is 1, no leaves
      expect(metrics.depth).toBe(1);
      expect(metrics.leafCount).toBe(0);
    });
  });
});

describe('getLeafNodes', () => {
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'Parent',
        id: 'parent',
        children: [
          { label: 'A', id: 'a' },
          { label: 'B', id: 'b' },
        ],
      },
    ],
  };

  it('returns only leaf nodes', () => {
    const metrics = computeTreeMetrics(tree);
    const leaves = getLeafNodes(metrics);

    expect(leaves).toHaveLength(2);
    expect(leaves.every((n) => n.isLeaf)).toBe(true);
  });

  it('returns leaves in correct order', () => {
    const metrics = computeTreeMetrics(tree);
    const leaves = getLeafNodes(metrics);

    expect(leaves[0].node.id).toBe('a');
    expect(leaves[1].node.id).toBe('b');
  });
});

describe('getHeaderNodes', () => {
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'Parent',
        id: 'parent',
        children: [
          { label: 'A', id: 'a' },
          { label: 'B', id: 'b' },
        ],
      },
    ],
  };

  it('excludes virtual root from headers', () => {
    const metrics = computeTreeMetrics(tree);
    const headers = getHeaderNodes(metrics);

    // Should include Parent, A, B but not Root
    expect(headers).toHaveLength(3);
    expect(headers.find((n) => n.node.id === 'root')).toBeUndefined();
  });

  it('includes all non-root nodes', () => {
    const metrics = computeTreeMetrics(tree);
    const headers = getHeaderNodes(metrics);

    expect(headers.find((n) => n.node.id === 'parent')).toBeDefined();
    expect(headers.find((n) => n.node.id === 'a')).toBeDefined();
    expect(headers.find((n) => n.node.id === 'b')).toBeDefined();
  });
});

describe('findNodeById', () => {
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'Parent',
        id: 'parent',
        children: [{ label: 'Child', id: 'child' }],
      },
    ],
  };

  it('finds node by id', () => {
    const metrics = computeTreeMetrics(tree);
    const found = findNodeById(metrics, 'child');

    expect(found).toBeDefined();
    expect(found?.node.label).toBe('Child');
  });

  it('returns undefined for non-existent id', () => {
    const metrics = computeTreeMetrics(tree);
    const found = findNodeById(metrics, 'nonexistent');

    expect(found).toBeUndefined();
  });
});

describe('findNodeByPath', () => {
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'Parent',
        id: 'parent',
        children: [{ label: 'Child', id: 'child' }],
      },
    ],
  };

  it('finds node by path', () => {
    const metrics = computeTreeMetrics(tree);
    const found = findNodeByPath(metrics, ['root', 'parent', 'child']);

    expect(found).toBeDefined();
    expect(found?.node.label).toBe('Child');
  });

  it('returns undefined for non-existent path', () => {
    const metrics = computeTreeMetrics(tree);
    const found = findNodeByPath(metrics, ['root', 'other', 'path']);

    expect(found).toBeUndefined();
  });
});
