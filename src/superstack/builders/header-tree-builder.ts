/**
 * Header Tree Builder
 *
 * Transforms flat SQL query results into hierarchical header trees.
 * The algorithm:
 * 1. Iterate through rows, building tree structure by facet path
 * 2. Accumulate counts up the tree
 * 3. Calculate spans (bottom-up: leaves have span=1, parents sum children)
 * 4. Calculate startIndex (left-to-right for columns, top-to-bottom for rows)
 */

import type {
  FacetConfig,
  HeaderNode,
  HeaderTree,
  QueryRow,
} from '../types/superstack';
import { formatLabel } from '../config/superstack-defaults';

/**
 * Build a header tree from flat query results.
 *
 * @param rows - Flat query results with facet values and card_count
 * @param facets - Ordered facet configurations defining hierarchy levels
 * @param axis - 'row' or 'column' for the tree type
 * @returns Complete HeaderTree with calculated spans and indices
 */
export function buildHeaderTree(
  rows: QueryRow[],
  facets: FacetConfig[],
  axis: 'row' | 'column'
): HeaderTree {
  const roots: HeaderNode[] = [];
  const nodeMap = new Map<string, HeaderNode>();

  // Build tree by iterating through unique paths
  for (const row of rows) {
    let currentLevel = roots;
    let parentNode: HeaderNode | null = null;
    const currentPath: string[] = [];

    for (let depth = 0; depth < facets.length; depth++) {
      const facet = facets[depth];
      const value = String(row[facet.id] ?? '');
      currentPath.push(value);

      const nodeId = currentPath.join('|');

      let node = nodeMap.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          facet,
          value,
          label: formatLabel(facet, value),
          depth,
          span: 0, // Calculated after tree is built
          startIndex: 0, // Calculated after tree is built
          children: [],
          parent: parentNode,
          collapsed: false,
          path: [...currentPath],
          aggregate: { count: 0 },
        };
        nodeMap.set(nodeId, node);
        currentLevel.push(node);
      }

      // Accumulate counts up the tree
      if (node.aggregate) {
        node.aggregate.count += (row.card_count as number) || 0;
      }

      parentNode = node;
      currentLevel = node.children;
    }
  }

  // Sort children at each level
  sortNodes(roots, facets);

  // Calculate spans and indices
  calculateSpansAndIndices(roots);

  // Collect leaf nodes
  const leaves = collectLeaves(roots);

  return {
    axis,
    facets,
    roots,
    maxDepth: facets.length,
    leafCount: leaves.length,
    leaves,
  };
}

/**
 * Sort nodes recursively based on facet sort order.
 */
function sortNodes(nodes: HeaderNode[], facets: FacetConfig[]): void {
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortNodes(node.children, facets);
    }
  }

  // Sort this level based on facet configuration
  if (nodes.length > 0) {
    const facet = nodes[0].facet;
    nodes.sort((a, b) => {
      if (facet.sortOrder === 'desc') {
        return b.value.localeCompare(a.value);
      }
      if (facet.sortOrder === 'custom' && facet.options) {
        const aIndex = facet.options.indexOf(a.value);
        const bIndex = facet.options.indexOf(b.value);
        return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
      }
      // Default: ascending
      return a.value.localeCompare(b.value);
    });
  }
}

/**
 * Calculate spans and startIndices for all nodes.
 * Spans are calculated bottom-up (leaves = 1, parents = sum of children).
 * Collapsed nodes have span=1 regardless of children.
 * startIndex is calculated left-to-right/top-to-bottom.
 *
 * @returns Total span (number of visible leaves)
 */
function calculateSpansAndIndices(nodes: HeaderNode[], startIndex = 0): number {
  let currentIndex = startIndex;

  for (const node of nodes) {
    node.startIndex = currentIndex;

    if (node.collapsed || node.children.length === 0) {
      // Leaf or collapsed node: span is 1
      node.span = 1;
      currentIndex += 1;
    } else {
      // Parent node (not collapsed): span is sum of children's spans
      const childrenSpan = calculateSpansAndIndices(node.children, currentIndex);
      node.span = childrenSpan;
      currentIndex += childrenSpan;
    }
  }

  return currentIndex - startIndex;
}

/**
 * Collect all leaf nodes (deepest level or collapsed nodes).
 */
function collectLeaves(nodes: HeaderNode[]): HeaderNode[] {
  const leaves: HeaderNode[] = [];

  function traverse(node: HeaderNode): void {
    if (node.children.length === 0 || node.collapsed) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return leaves;
}

/**
 * Recalculate tree after collapse/expand changes.
 * Updates spans, indices, and leaf array.
 */
export function recalculateTree(tree: HeaderTree): void {
  // Reset and recalculate spans/indices
  calculateSpansAndIndices(tree.roots);

  // Rebuild leaf array (respecting collapsed state)
  tree.leaves = collectVisibleLeaves(tree.roots);
  tree.leafCount = tree.leaves.length;
}

/**
 * Collect visible leaves (accounting for collapsed nodes).
 * A collapsed node becomes a pseudo-leaf for positioning.
 */
function collectVisibleLeaves(nodes: HeaderNode[]): HeaderNode[] {
  const leaves: HeaderNode[] = [];

  function traverse(node: HeaderNode): void {
    if (node.collapsed || node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return leaves;
}

/**
 * Toggle collapse state for a node and recalculate tree metrics.
 * This is a convenience wrapper that combines findNodeById + toggle + recalculate.
 *
 * @param tree - The HeaderTree to modify (mutates in place)
 * @param nodeId - ID of the node to toggle
 * @returns true if node was found and toggled, false otherwise
 */
export function toggleHeaderCollapse(tree: HeaderTree, nodeId: string): boolean {
  const node = findNodeById(tree, nodeId);
  if (!node) return false;

  node.collapsed = !node.collapsed;
  recalculateTree(tree);
  return true;
}

/**
 * Find a node by ID in the tree.
 */
export function findNodeById(tree: HeaderTree, id: string): HeaderNode | null {
  function search(nodes: HeaderNode[]): HeaderNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      const found = search(node.children);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return search(tree.roots);
}

/**
 * Flatten tree for D3 data binding (excluding hidden children).
 */
export function flattenTree(nodes: HeaderNode[]): HeaderNode[] {
  const result: HeaderNode[] = [];

  function traverse(node: HeaderNode): void {
    result.push(node);
    if (!node.collapsed) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}
