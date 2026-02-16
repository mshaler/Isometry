/**
 * Unit tests for HeaderTree to AxisConfig adapter
 */

import { describe, it, expect } from 'vitest';
import { headerTreeToAxisConfig, convertHeaderNode } from '../headerTreeAdapter';
import type { HeaderTree, HeaderNode, FacetConfig } from '@/superstack/types/superstack';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockFacet: FacetConfig = {
  id: 'folder-facet',
  name: 'Folder',
  axis: 'C',
  sourceColumn: 'folder',
  dataType: 'text',
  sortOrder: 'asc',
};

const mockLeafNode: HeaderNode = {
  id: 'work',
  facet: mockFacet,
  value: 'Work',
  label: 'Work',
  depth: 0,
  span: 1,
  startIndex: 0,
  children: [],
  parent: null,
  collapsed: false,
  path: ['Work'],
};

const mockParentNode: HeaderNode = {
  id: 'projects',
  facet: mockFacet,
  value: 'Projects',
  label: 'Projects',
  depth: 0,
  span: 2,
  startIndex: 0,
  children: [
    {
      id: 'projects/active',
      facet: mockFacet,
      value: 'Active',
      label: 'Active',
      depth: 1,
      span: 1,
      startIndex: 0,
      children: [],
      parent: null as unknown as HeaderNode, // Will be set if needed
      collapsed: false,
      path: ['Projects', 'Active'],
    },
    {
      id: 'projects/archived',
      facet: mockFacet,
      value: 'Archived',
      label: 'Archived',
      depth: 1,
      span: 1,
      startIndex: 1,
      children: [],
      parent: null as unknown as HeaderNode,
      collapsed: false,
      path: ['Projects', 'Archived'],
    },
  ],
  parent: null,
  collapsed: false,
  path: ['Projects'],
};

const mockCollapsedNode: HeaderNode = {
  id: 'collapsed-parent',
  facet: mockFacet,
  value: 'Collapsed',
  label: 'Collapsed',
  depth: 0,
  span: 3,
  startIndex: 0,
  children: [
    {
      id: 'collapsed-parent/child1',
      facet: mockFacet,
      value: 'Child1',
      label: 'Child1',
      depth: 1,
      span: 1,
      startIndex: 0,
      children: [],
      parent: null as unknown as HeaderNode,
      collapsed: false,
      path: ['Collapsed', 'Child1'],
    },
  ],
  parent: null,
  collapsed: true, // Collapsed parent
  path: ['Collapsed'],
};

const mockHeaderTree: HeaderTree = {
  axis: 'row',
  facets: [mockFacet],
  roots: [mockParentNode],
  maxDepth: 2,
  leafCount: 2,
  leaves: [],
};

// ============================================================================
// Tests
// ============================================================================

describe('headerTreeToAxisConfig', () => {
  it('converts single-level tree correctly', () => {
    const tree: HeaderTree = {
      axis: 'row',
      facets: [mockFacet],
      roots: [mockLeafNode],
      maxDepth: 1,
      leafCount: 1,
      leaves: [mockLeafNode],
    };

    const result = headerTreeToAxisConfig(tree);

    expect(result.type).toBe('C');
    expect(result.facet).toBe('folder');
    expect(result.tree.id).toBe('root');
    expect(result.tree.label).toBe('Root');
    expect(result.tree.children).toHaveLength(1);
    expect(result.tree.children![0].label).toBe('Work');
  });

  it('maps HeaderNode.span to AxisNode.leafCount', () => {
    const result = headerTreeToAxisConfig(mockHeaderTree);

    // Parent node has span=2, should map to leafCount=2
    const parentAxisNode = result.tree.children![0];
    expect(parentAxisNode.leafCount).toBe(2);

    // Child nodes have span=1, should map to leafCount=1
    expect(parentAxisNode.children![0].leafCount).toBe(1);
    expect(parentAxisNode.children![1].leafCount).toBe(1);
  });

  it('recursively converts nested children', () => {
    const result = headerTreeToAxisConfig(mockHeaderTree);

    const rootChildren = result.tree.children!;
    expect(rootChildren).toHaveLength(1);

    const parentNode = rootChildren[0];
    expect(parentNode.label).toBe('Projects');
    expect(parentNode.children).toHaveLength(2);

    // Check nested children
    expect(parentNode.children![0].label).toBe('Active');
    expect(parentNode.children![1].label).toBe('Archived');
  });

  it('handles empty roots array', () => {
    const emptyTree: HeaderTree = {
      axis: 'column',
      facets: [mockFacet],
      roots: [],
      maxDepth: 0,
      leafCount: 0,
      leaves: [],
    };

    const result = headerTreeToAxisConfig(emptyTree);

    expect(result.tree.children).toEqual([]);
  });

  it('throws on empty facets array', () => {
    const invalidTree: HeaderTree = {
      axis: 'row',
      facets: [], // Empty facets!
      roots: [mockLeafNode],
      maxDepth: 1,
      leafCount: 1,
      leaves: [mockLeafNode],
    };

    expect(() => headerTreeToAxisConfig(invalidTree)).toThrow(
      'HeaderTree must have at least one facet to determine axis type'
    );
  });

  it('throws on null/undefined headerTree', () => {
    expect(() => headerTreeToAxisConfig(null as unknown as HeaderTree)).toThrow(
      'headerTree cannot be null or undefined'
    );

    expect(() => headerTreeToAxisConfig(undefined as unknown as HeaderTree)).toThrow(
      'headerTree cannot be null or undefined'
    );
  });

  it('maps collapsed=true to expandable=false', () => {
    const tree: HeaderTree = {
      axis: 'row',
      facets: [mockFacet],
      roots: [mockCollapsedNode],
      maxDepth: 2,
      leafCount: 3,
      leaves: [],
    };

    const result = headerTreeToAxisConfig(tree);

    const collapsedAxisNode = result.tree.children![0];

    // Collapsed parent with children should have expandable=false, expanded=false
    expect(collapsedAxisNode.expandable).toBe(false);
    expect(collapsedAxisNode.expanded).toBe(false);
  });

  it('preserves id and label through conversion', () => {
    const result = headerTreeToAxisConfig(mockHeaderTree);

    const parentNode = result.tree.children![0];
    expect(parentNode.id).toBe('projects');
    expect(parentNode.label).toBe('Projects');

    const childNode = parentNode.children![0];
    expect(childNode.id).toBe('projects/active');
    expect(childNode.label).toBe('Active');
  });

  it('returns undefined children for leaf nodes', () => {
    const tree: HeaderTree = {
      axis: 'row',
      facets: [mockFacet],
      roots: [mockLeafNode],
      maxDepth: 1,
      leafCount: 1,
      leaves: [mockLeafNode],
    };

    const result = headerTreeToAxisConfig(tree);

    const leafAxisNode = result.tree.children![0];

    // Leaf nodes should have undefined children, not empty array
    expect(leafAxisNode.children).toBeUndefined();
  });
});

describe('convertHeaderNode', () => {
  it('converts leaf node correctly', () => {
    const axisNode = convertHeaderNode(mockLeafNode);

    expect(axisNode.id).toBe('work');
    expect(axisNode.label).toBe('Work');
    expect(axisNode.leafCount).toBe(1);
    expect(axisNode.expandable).toBe(false);
    expect(axisNode.expanded).toBe(true);
    expect(axisNode.children).toBeUndefined();
  });

  it('converts parent node with children', () => {
    const axisNode = convertHeaderNode(mockParentNode);

    expect(axisNode.id).toBe('projects');
    expect(axisNode.label).toBe('Projects');
    expect(axisNode.leafCount).toBe(2);
    expect(axisNode.expandable).toBe(true);
    expect(axisNode.expanded).toBe(true);
    expect(axisNode.children).toHaveLength(2);
  });

  it('handles collapsed parent correctly', () => {
    const axisNode = convertHeaderNode(mockCollapsedNode);

    expect(axisNode.id).toBe('collapsed-parent');
    expect(axisNode.expandable).toBe(false); // Has children but collapsed
    expect(axisNode.expanded).toBe(false); // Inverted from collapsed=true
    expect(axisNode.children).toHaveLength(1); // Children still converted
  });

  it('maps LATCH axis types correctly', () => {
    const latchTypes: Array<'L' | 'A' | 'T' | 'C' | 'H'> = ['L', 'A', 'T', 'C', 'H'];

    latchTypes.forEach((axis) => {
      const facet: FacetConfig = { ...mockFacet, axis };
      const tree: HeaderTree = {
        axis: 'row',
        facets: [facet],
        roots: [mockLeafNode],
        maxDepth: 1,
        leafCount: 1,
        leaves: [mockLeafNode],
      };

      const result = headerTreeToAxisConfig(tree);
      expect(result.type).toBe(axis);
    });
  });
});
