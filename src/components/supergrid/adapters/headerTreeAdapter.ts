/**
 * HeaderTree to AxisConfig Adapter
 *
 * Bridges HeaderDiscoveryService output (HeaderTree with HeaderNode children)
 * to SuperGridCSS input (AxisConfig with AxisNode children).
 *
 * This is the core type bridge for Phase 106 CSS Grid Integration.
 */

import type { HeaderTree, HeaderNode, FacetConfig } from '@/superstack/types/superstack';
import type { AxisConfig, AxisNode, LATCHAxisType } from '../types';

/**
 * Convert HeaderTree to AxisConfig for SuperGridCSS.
 *
 * Field mappings:
 * - headerTree.facets[0].axis → axisConfig.type (both use LATCH type)
 * - headerTree.facets[0].sourceColumn → axisConfig.facet
 * - headerTree.roots → axisConfig.tree.children (via convertHeaderNode)
 *
 * @param headerTree - Output from HeaderDiscoveryService
 * @returns AxisConfig suitable for SuperGridCSS
 * @throws {TypeError} If headerTree is null/undefined
 * @throws {Error} If facets array is empty (can't determine axis type)
 */
export function headerTreeToAxisConfig(headerTree: HeaderTree): AxisConfig {
  if (!headerTree) {
    throw new TypeError('headerTree cannot be null or undefined');
  }

  if (headerTree.facets.length === 0) {
    throw new Error('HeaderTree must have at least one facet to determine axis type');
  }

  // Extract primary facet (first facet defines the axis)
  const primaryFacet: FacetConfig = headerTree.facets[0];

  // Map LATCH axis type (both interfaces use 'L' | 'A' | 'T' | 'C' | 'H')
  const type: LATCHAxisType = primaryFacet.axis;

  // Convert root HeaderNodes to AxisNodes
  const children: AxisNode[] = headerTree.roots.map((node) => convertHeaderNode(node));

  // Create root AxisNode wrapping all roots
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: children.length > 0 ? children : [],
  };

  return {
    type,
    facet: primaryFacet.sourceColumn,
    tree,
  };
}

/**
 * Convert a single HeaderNode to AxisNode.
 *
 * Field mappings:
 * - node.label → axisNode.label (direct copy)
 * - node.id → axisNode.id (direct copy)
 * - node.span → axisNode.leafCount (numeric span for CSS Grid)
 * - node.collapsed → axisNode.expandable (inverted: !collapsed && hasChildren)
 * - node.collapsed → axisNode.expanded (inverted: !collapsed)
 * - node.children → axisNode.children (recursive, undefined if none)
 *
 * @param node - HeaderNode from HeaderTree
 * @returns Converted AxisNode
 */
export function convertHeaderNode(node: HeaderNode): AxisNode {
  const hasChildren = node.children.length > 0;

  const axisNode: AxisNode = {
    label: node.label,
    id: node.id,
    leafCount: node.span,
    expandable: hasChildren && !node.collapsed,
    expanded: !node.collapsed,
  };

  // Only set children if node has children (undefined for leaf nodes, not empty array)
  if (hasChildren) {
    axisNode.children = node.children.map((child) => convertHeaderNode(child));
  }

  return axisNode;
}
