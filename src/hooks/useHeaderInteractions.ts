/**
 * useHeaderInteractions - React hook for SuperStack header interactions
 *
 * Bridges D3 event handlers to React state management for:
 * - Collapse/expand toggle with tree recalculation
 * - Click-to-filter path extraction
 * - Header selection with visual highlighting
 *
 * Key design decision: Collapse state is LOCAL to this hook (not in Context API)
 * to prevent re-render cascade when toggling individual headers.
 *
 * Phase 91-01: Interactions
 */

import { useState, useCallback, useMemo } from 'react';
import type { HeaderTree, HeaderNode } from '../superstack/types/superstack';
import { recalculateTree } from '../superstack/builders/header-tree-builder';

/**
 * Filter constraint for click-to-filter functionality.
 * Represents a single facet=value condition.
 */
export interface FilterConstraint {
  /** Facet/column name to filter on */
  facet: string;
  /** Comparison operator */
  operator: 'equals' | 'contains' | 'in';
  /** Value to filter for */
  value: string;
}

/**
 * Configuration for useHeaderInteractions hook.
 */
export interface UseHeaderInteractionsConfig {
  /** Column header tree (from useHeaderDiscovery) */
  columnTree: HeaderTree | null;
  /** Row header tree (from useHeaderDiscovery) */
  rowTree: HeaderTree | null;
  /** Callback when filter path is built from header click */
  onFilterChange?: (path: FilterConstraint[]) => void;
}

/**
 * Return type for useHeaderInteractions hook.
 */
export interface UseHeaderInteractionsReturn {
  /** Set of currently collapsed header IDs */
  collapsedIds: Set<string>;
  /** Currently selected header ID (for visual highlight) */
  selectedHeaderId: string | null;
  /** Handler for collapse/expand toggle */
  handleHeaderToggle: (headerId: string, collapsed: boolean) => void;
  /** Handler for header click (triggers filter) */
  handleHeaderClick: (node: HeaderNode) => void;
  /** Handler for header selection (visual highlight only) */
  handleHeaderSelect: (nodeId: string | null) => void;
  /** Column tree with collapse state applied */
  columnTree: HeaderTree | null;
  /** Row tree with collapse state applied */
  rowTree: HeaderTree | null;
}

/**
 * React hook that bridges D3 header events to React state management.
 *
 * Provides:
 * - Local collapse state (avoids Context API re-render cascade)
 * - Tree cloning with structuredClone for immutable React updates
 * - Click-to-filter path building
 * - Header selection state
 *
 * @param config - Configuration with trees and callbacks
 * @returns Interactive state and handlers
 *
 * @example
 * ```tsx
 * const { columnTree, handleHeaderToggle, handleHeaderClick } = useHeaderInteractions({
 *   columnTree: discoveredColumnTree,
 *   rowTree: discoveredRowTree,
 *   onFilterChange: (constraints) => applyFilters(constraints),
 * });
 * ```
 */
export function useHeaderInteractions(
  config: UseHeaderInteractionsConfig
): UseHeaderInteractionsReturn {
  const { columnTree: inputColumnTree, rowTree: inputRowTree, onFilterChange } = config;

  // Local collapse state (Set<string> of collapsed header IDs)
  // Kept LOCAL to prevent Context re-render cascade
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Selected header ID for visual highlighting
  const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);

  // Internal trees with collapse state applied
  const [internalColumnTree, setInternalColumnTree] = useState<HeaderTree | null>(null);
  const [internalRowTree, setInternalRowTree] = useState<HeaderTree | null>(null);

  // Sync internal trees when input trees change
  useMemo(() => {
    if (inputColumnTree) {
      // Clone tree for immutable state management
      const cloned = structuredClone(inputColumnTree);
      // Apply existing collapsed state
      applyCollapsedState(cloned, collapsedIds);
      recalculateTree(cloned);
      setInternalColumnTree(cloned);
    } else {
      setInternalColumnTree(null);
    }
  }, [inputColumnTree, collapsedIds]);

  useMemo(() => {
    if (inputRowTree) {
      // Clone tree for immutable state management
      const cloned = structuredClone(inputRowTree);
      // Apply existing collapsed state
      applyCollapsedState(cloned, collapsedIds);
      recalculateTree(cloned);
      setInternalRowTree(cloned);
    } else {
      setInternalRowTree(null);
    }
  }, [inputRowTree, collapsedIds]);

  /**
   * Handle collapse/expand toggle on a header.
   * Clones tree via structuredClone before mutation (React requires immutable updates).
   */
  const handleHeaderToggle = useCallback((headerId: string, collapsed: boolean) => {
    // Update collapsed IDs set
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (collapsed) {
        next.add(headerId);
      } else {
        next.delete(headerId);
      }
      return next;
    });
  }, []);

  /**
   * Handle header click for filtering.
   * Builds FilterConstraint[] from node.path and calls onFilterChange.
   */
  const handleHeaderClick = useCallback((node: HeaderNode) => {
    if (!onFilterChange) return;

    // Build filter path from node's path array and facets
    const constraints: FilterConstraint[] = [];

    // Walk up the path to build constraints
    // node.path contains values, we need to match with facets
    // The facet at each depth corresponds to the path segment
    let currentNode: HeaderNode | null = node;

    // Build constraints from leaf to root, then reverse
    while (currentNode) {
      constraints.unshift({
        facet: currentNode.facet.sourceColumn,
        operator: 'equals',
        value: currentNode.value,
      });
      currentNode = currentNode.parent;
    }

    onFilterChange(constraints);
  }, [onFilterChange]);

  /**
   * Handle header selection (visual highlight only).
   */
  const handleHeaderSelect = useCallback((nodeId: string | null) => {
    setSelectedHeaderId(nodeId);
  }, []);

  return {
    collapsedIds,
    selectedHeaderId,
    handleHeaderToggle,
    handleHeaderClick,
    handleHeaderSelect,
    columnTree: internalColumnTree,
    rowTree: internalRowTree,
  };
}

/**
 * Apply collapsed state to all nodes in a tree.
 * Mutates the tree in place (caller should clone first).
 */
function applyCollapsedState(tree: HeaderTree, collapsedIds: Set<string>): void {
  function traverse(nodes: HeaderNode[]): void {
    for (const node of nodes) {
      node.collapsed = collapsedIds.has(node.id);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree.roots);
}
