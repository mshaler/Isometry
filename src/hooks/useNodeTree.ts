import { useMemo } from 'react';
import type { Node } from '@/types/node';

export interface TreeNode {
  id: string;
  name: string;
  priority: number;
  folder: string | null;
  children: TreeNode[];
  node: Node;
}

export interface Tree {
  roots: TreeNode[];
  nodeMap: Map<string, TreeNode>;
}

/**
 * Build tree structure from nodes using NEST edges for parent-child relationships
 *
 * Algorithm:
 * 1. Create Map<id, TreeNode> for O(1) lookup
 * 2. Query edges table for NEST relationships (source_id = parent, target_id = child)
 * 3. Build children arrays by connecting parent -> child
 * 4. Nodes without parents become roots
 * 5. Detect and break circular references
 *
 * @param nodes - Array of nodes from database
 * @param edges - Array of NEST edges (source_id = parent, target_id = child)
 * @returns Tree structure with roots and nodeMap
 */
export function buildNodeTree(
  nodes: Node[],
  edges: Array<{ source_id: string; target_id: string }>
): Tree {
  // Create map for O(1) lookup
  const nodeMap = new Map<string, TreeNode>();

  // Initialize all nodes with empty children arrays
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      id: node.id,
      name: node.name,
      priority: node.priority,
      folder: node.folder,
      children: [],
      node,
    });
  });

  // Track which nodes have parents (to identify roots)
  const hasParent = new Set<string>();

  // Cycle detection: track path from root to current node
  // const visited = new Set<string>(); // Reserved for future cycle detection

  // Build parent-child relationships from NEST edges
  edges.forEach(edge => {
    const parent = nodeMap.get(edge.source_id);
    const child = nodeMap.get(edge.target_id);

    if (!parent || !child) {
      // Edge references non-existent node, skip
      return;
    }

    // Detect cycles: if child is already in path to parent, skip edge
    if (isAncestor(child, parent, nodeMap)) {
      console.warn(
        `Cycle detected: ${child.id} -> ${parent.id}. Skipping edge.`
      );
      return;
    }

    // Add child to parent's children array
    parent.children.push(child);
    hasParent.add(child.id);
  });

  // Roots are nodes without parents
  const roots: TreeNode[] = [];
  nodeMap.forEach(node => {
    if (!hasParent.has(node.id)) {
      roots.push(node);
    }
  });

  return {
    roots,
    nodeMap,
  };
}

/**
 * Check if potentialAncestor is an ancestor of node
 * Used for cycle detection
 */
function isAncestor(
  potentialAncestor: TreeNode,
  node: TreeNode,
  _nodeMap: Map<string, TreeNode>
): boolean {
  const visited = new Set<string>();

  function traverse(current: TreeNode): boolean {
    if (visited.has(current.id)) {
      return false; // Already checked this branch
    }
    visited.add(current.id);

    if (current.id === potentialAncestor.id) {
      return true; // Found ancestor in children
    }

    return current.children.some(child => traverse(child));
  }

  return traverse(node);
}

/**
 * Hook to build tree from nodes and edges with memoization
 *
 * @param nodes - Array of nodes from database
 * @param edges - Array of NEST edges (optional, defaults to empty)
 * @returns Memoized tree structure
 */
export function useNodeTree(
  nodes: Node[],
  edges: Array<{ source_id: string; target_id: string }> = []
): Tree {
  return useMemo(() => {
    return buildNodeTree(nodes, edges);
  }, [nodes, edges]);
}
