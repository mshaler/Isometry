import type { TreeNode, Tree } from '@/hooks/visualization/useNodeTree';

/**
 * Get all descendant IDs for a subtree (including the node itself)
 *
 * @param node - Root node of subtree
 * @returns Array of all descendant IDs (including node.id)
 */
export function getSubtreeIds(node: TreeNode): string[] {
  const ids: string[] = [node.id];
  const visited = new Set<string>();

  function traverse(current: TreeNode) {
    // Prevent infinite loops from cycles
    if (visited.has(current.id)) {
      return;
    }
    visited.add(current.id);

    current.children.forEach(child => {
      ids.push(child.id);
      traverse(child);
    });
  }

  traverse(node);
  return ids;
}

/**
 * Get path from node to root (ancestor IDs)
 *
 * Note: Since tree is built bottom-up from edges, we need to traverse
 * the tree to find the path. This function finds the path by searching
 * from roots down to the target node.
 *
 * @param tree - Tree structure
 * @param nodeId - Target node ID
 * @returns Array of ancestor IDs from root to node (inclusive)
 */
export function getAncestorIds(tree: Tree, nodeId: string): string[] {
  const path: string[] = [];

  function findPath(current: TreeNode, targetId: string): boolean {
    path.push(current.id);

    if (current.id === targetId) {
      return true; // Found target
    }

    // Search in children
    for (const child of current.children) {
      if (findPath(child, targetId)) {
        return true; // Found in this subtree
      }
    }

    // Not found in this subtree, backtrack
    path.pop();
    return false;
  }

  // Search from each root
  for (const root of tree.roots) {
    if (findPath(root, nodeId)) {
      return path; // Found path from this root
    }
  }

  // Node not found or is isolated
  const node = tree.nodeMap.get(nodeId);
  return node ? [node.id] : [];
}

/**
 * Find a node in the tree by ID
 *
 * @param tree - Tree structure
 * @param id - Node ID to find
 * @returns TreeNode if found, null otherwise
 */
export function findNode(tree: Tree, id: string): TreeNode | null {
  return tree.nodeMap.get(id) || null;
}

/**
 * Get maximum depth of the tree
 *
 * @param tree - Tree structure
 * @returns Maximum depth (0 for empty tree, 1 for single level)
 */
export function getMaxDepth(tree: Tree): number {
  if (tree.roots.length === 0) return 0;

  function getDepth(node: TreeNode, currentDepth: number): number {
    if (node.children.length === 0) {
      return currentDepth;
    }

    return Math.max(
      ...node.children.map(child => getDepth(child, currentDepth + 1))
    );
  }

  return Math.max(...tree.roots.map(root => getDepth(root, 1)));
}

/**
 * Get total node count in the tree
 *
 * @param tree - Tree structure
 * @returns Total number of nodes
 */
export function getNodeCount(tree: Tree): number {
  return tree.nodeMap.size;
}

/**
 * Get all leaf nodes (nodes with no children)
 *
 * @param tree - Tree structure
 * @returns Array of leaf TreeNodes
 */
export function getLeafNodes(tree: Tree): TreeNode[] {
  const leaves: TreeNode[] = [];

  tree.nodeMap.forEach(node => {
    if (node.children.length === 0) {
      leaves.push(node);
    }
  });

  return leaves;
}

/**
 * Check if a node is a leaf (has no children)
 *
 * @param node - TreeNode to check
 * @returns true if node has no children
 */
export function isLeaf(node: TreeNode): boolean {
  return node.children.length === 0;
}

/**
 * Check if a node is a root (has no parent)
 *
 * @param tree - Tree structure
 * @param nodeId - Node ID to check
 * @returns true if node is a root
 */
export function isRoot(tree: Tree, nodeId: string): boolean {
  return tree.roots.some(root => root.id === nodeId);
}

/**
 * Filter tree nodes by priority range
 *
 * @param tree - Tree structure
 * @param minPriority - Minimum priority (inclusive)
 * @param maxPriority - Maximum priority (inclusive)
 * @returns Array of TreeNodes within priority range
 */
export function filterByPriority(
  tree: Tree,
  minPriority: number,
  maxPriority: number
): TreeNode[] {
  const filtered: TreeNode[] = [];

  tree.nodeMap.forEach(node => {
    if (node.priority >= minPriority && node.priority <= maxPriority) {
      filtered.push(node);
    }
  });

  return filtered;
}

/**
 * Search tree nodes by name (case-insensitive contains)
 *
 * @param tree - Tree structure
 * @param searchTerm - Search term (case-insensitive)
 * @returns Array of matching TreeNodes
 */
export function searchNodes(tree: Tree, searchTerm: string): TreeNode[] {
  const results: TreeNode[] = [];
  const lowerTerm = searchTerm.toLowerCase();

  tree.nodeMap.forEach(node => {
    if (node.name.toLowerCase().includes(lowerTerm)) {
      results.push(node);
    }
  });

  return results;
}
