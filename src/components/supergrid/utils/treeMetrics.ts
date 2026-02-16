/**
 * Tree Metrics Computation
 *
 * Walks a hierarchical tree and computes layout metrics for CSS Grid spanning.
 * Each node gets: depth, leafStart (first leaf index), leafCount (span width).
 */

import type { AxisNode, FlatNode, TreeMetrics } from '../types';

/**
 * Compute tree metrics for an axis hierarchy.
 *
 * Traverses the tree depth-first and computes:
 * - depth: How deep this node is (0 = top level)
 * - leafStart: Index of first leaf this node covers
 * - leafCount: Number of leaves this node spans
 *
 * @param root - The root node of the axis tree (virtual root, children are actual data)
 * @returns TreeMetrics with depth, leafCount, and flattened nodes
 */
export function computeTreeMetrics(root: AxisNode): TreeMetrics {
  const flatNodes: FlatNode[] = [];

  /**
   * Recursive traversal that computes leaf spans.
   * Adds nodes to flatNodes array and returns total leaf count.
   */
  function traverse(
    node: AxisNode,
    depth: number,
    leafStart: number,
    path: string[]
  ): number {
    const currentPath = [...path, node.id];

    // Leaf node: no children
    if (!node.children || node.children.length === 0) {
      flatNodes.push({
        node,
        depth,
        leafStart,
        leafCount: 1,
        path: currentPath,
        isLeaf: true,
      });
      return 1;
    }

    // Internal node: traverse children first to compute their leaf counts
    let totalLeaves = 0;
    for (const child of node.children) {
      totalLeaves += traverse(child, depth + 1, leafStart + totalLeaves, currentPath);
    }

    // Add internal node after children (for correct leafCount)
    flatNodes.push({
      node,
      depth,
      leafStart,
      leafCount: totalLeaves,
      path: currentPath,
      isLeaf: false,
    });

    return totalLeaves;
  }

  // Skip the virtual root, start with its children
  let leafStart = 0;
  for (const child of root.children || []) {
    const leaves = traverse(child, 0, leafStart, [root.id]);
    leafStart += leaves;
  }

  // Find max depth across all nodes
  let maxDepth = 0;
  for (const fn of flatNodes) {
    maxDepth = Math.max(maxDepth, fn.depth);
  }

  // Count total leaves
  const totalLeafCount = flatNodes.filter((n) => n.isLeaf).length;

  return {
    depth: maxDepth + 1, // Convert 0-indexed to count
    leafCount: totalLeafCount,
    flatNodes,
  };
}

/**
 * Get only leaf nodes from tree metrics.
 * Useful for iterating over data cell rows/columns.
 */
export function getLeafNodes(metrics: TreeMetrics): FlatNode[] {
  return metrics.flatNodes.filter((n) => n.isLeaf);
}

/**
 * Get non-root nodes for rendering headers.
 * Filters out the virtual root node.
 */
export function getHeaderNodes(metrics: TreeMetrics, rootId: string = 'root'): FlatNode[] {
  return metrics.flatNodes.filter(
    (fn) => fn.path.length > 1 && fn.path[0] === rootId
  );
}

/**
 * Find a node by ID in the flat nodes array.
 */
export function findNodeById(metrics: TreeMetrics, id: string): FlatNode | undefined {
  return metrics.flatNodes.find((fn) => fn.node.id === id);
}

/**
 * Find a node by path in the flat nodes array.
 */
export function findNodeByPath(metrics: TreeMetrics, path: string[]): FlatNode | undefined {
  const pathKey = path.join('/');
  return metrics.flatNodes.find((fn) => fn.path.join('/') === pathKey);
}
