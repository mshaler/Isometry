/**
 * SuperStack - Nested PAFV Headers with Visual Spanning
 *
 * The keystone SuperGrid feature that creates hierarchical column/row headers
 * with visual spanning across hierarchy levels. This is what makes SuperGrid
 * polymorphic - the same data renders differently based on PAFV axis mappings.
 *
 * Features:
 * - Multi-level hierarchical headers (e.g., Year > Quarter > Month)
 * - Visual spanning - parent headers span across their children
 * - Dynamic PAFV axis binding - headers adapt to axis assignments
 * - D3.js driven with sql.js direct data binding
 * - Drag-and-drop axis repositioning (SuperDynamic)
 */

import React, { useMemo, useCallback } from 'react';
import { usePAFV } from '@/hooks';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type { Node } from '@/types/node';
import type { HeaderTree, HeaderNode as TreeHeaderNode } from '@/superstack/types/superstack';
import { superGridLogger } from '@/utils/dev-logger';

interface SuperStackProps {
  /** Orientation: column headers (horizontal) or row headers (vertical) */
  orientation: 'horizontal' | 'vertical';
  /** Nodes data to create hierarchy from (legacy mode) */
  nodes?: Node[];
  /** SQL-driven HeaderTree (Phase 99 - preferred) */
  headerTree?: HeaderTree | null;
  /** Callback when header cell is clicked */
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
  /** Callback when header node is toggled (collapse/expand) */
  onHeaderToggle?: (headerId: string, collapsed: boolean) => void;
  /** Set of collapsed header IDs */
  collapsedIds?: Set<string>;
  /** Enable drag-and-drop axis reordering */
  enableDragDrop?: boolean;
  /** Maximum nesting levels to display */
  maxLevels?: number;
}

interface HeaderLevel {
  level: number;
  axis: LATCHAxis;
  facet: string;
  values: HeaderValue[];
}

interface HeaderValue {
  value: string;
  span: number; // How many columns/rows this header spans
  children: string[]; // Child values for next level
  count: number; // Number of nodes with this value
}

/**
 * SuperStack: Multi-level hierarchical headers with visual spanning
 *
 * Core algorithm:
 * 1. Extract active PAFV mappings for this orientation
 * 2. Build hierarchy tree from SQL data grouping
 * 3. Calculate spans for each level (parent spans across children)
 * 4. Render nested headers with D3.js data binding
 */
export function SuperStack({
  orientation,
  nodes,
  headerTree,
  onHeaderClick,
  onHeaderToggle,
  collapsedIds = new Set(),
  enableDragDrop = false,
  maxLevels = 4
}: SuperStackProps) {
  const { state: pafvState } = usePAFV();

  // Map LATCH axis letter to full name
  const axisLetterToName: Record<string, LATCHAxis> = {
    'L': 'location',
    'A': 'alphabet',
    'T': 'time',
    'C': 'category',
    'H': 'hierarchy',
  };

  // Debug logging for header tree
  superGridLogger.debug(`headerTree (${orientation})`, {
    hasTree: !!headerTree,
    rootCount: headerTree?.roots?.length ?? 0,
    facetCount: headerTree?.facets?.length ?? 0,
    leafCount: headerTree?.leafCount ?? 0,
  });

  // Extract active axis mappings for this orientation
  const activeMappings = useMemo(() => {
    const mappings = pafvState.mappings.filter((m: AxisMapping) =>
      (orientation === 'horizontal' && (m.plane === 'x' || m.plane === 'color')) ||
      (orientation === 'vertical' && (m.plane === 'y' || m.plane === 'size'))
    );

    return mappings.slice(0, maxLevels).sort((a: AxisMapping, b: AxisMapping) => {
      // Sort by priority: x/y first, then color/size
      const priorityA = a.plane === 'x' || a.plane === 'y' ? 0 : 1;
      const priorityB = b.plane === 'x' || b.plane === 'y' ? 0 : 1;
      return priorityA - priorityB;
    });
  }, [pafvState.mappings, orientation, maxLevels]);

  // Build hierarchical header data from nodes
  const headerLevels = useMemo(() => {
    if (!activeMappings.length || !nodes?.length) return [];

    // Group nodes by hierarchy levels
    const levels: HeaderLevel[] = [];

    activeMappings.forEach((mapping: AxisMapping, levelIndex: number) => {
      const level: HeaderLevel = {
        level: levelIndex,
        axis: mapping.axis,
        facet: mapping.facet,
        values: []
      };

      // Get unique values for this axis/facet from nodes
      const valueGroups = new Map<string, { nodes: Node[], children: Set<string> }>();

      nodes?.forEach(node => {
        const value = extractNodeValue(node, mapping.axis, mapping.facet);
        if (!valueGroups.has(value)) {
          valueGroups.set(value, { nodes: [], children: new Set() });
        }
        valueGroups.get(value)!.nodes.push(node);
      });

      // Calculate children for each value (for next level)
      if (levelIndex < activeMappings.length - 1) {
        const nextMapping = activeMappings[levelIndex + 1];
        valueGroups.forEach((group) => {
          group.nodes.forEach(node => {
            const childValue = extractNodeValue(node, nextMapping.axis, nextMapping.facet);
            group.children.add(childValue);
          });
        });
      }

      // Create header values with spans
      valueGroups.forEach((group, value) => {
        const span = levelIndex === activeMappings.length - 1 ? 1 : group.children.size || 1;
        level.values.push({
          value,
          span,
          children: Array.from(group.children).sort(),
          count: group.nodes.length
        });
      });

      // Sort header values alphabetically to match data grid cell ordering
      level.values.sort((a, b) => a.value.localeCompare(b.value));

      levels.push(level);
    });

    return levels;
  }, [activeMappings, nodes]);

  // Handle header cell click
  const handleHeaderClick = useCallback((level: number, value: string, axis: LATCHAxis) => {
    onHeaderClick?.(level, value, axis);
  }, [onHeaderClick]);

  // Handle drag start for axis reordering
  const handleDragStart = useCallback((e: React.DragEvent, level: number) => {
    if (!enableDragDrop) return;
    e.dataTransfer.setData('text/plain', `superstack-level-${level}`);
    e.dataTransfer.effectAllowed = 'move';
  }, [enableDragDrop]);

  // ============================================================
  // HeaderTree-based rendering (Phase 99 - SQL-driven headers)
  // ============================================================
  if (headerTree && headerTree.roots.length > 0) {
    // Flatten tree by depth for level-based rendering
    const flattenByDepth = (treeNodes: TreeHeaderNode[]): Map<number, TreeHeaderNode[]> => {
      const result = new Map<number, TreeHeaderNode[]>();

      const traverse = (node: TreeHeaderNode, currentDepth: number) => {
        if (!result.has(currentDepth)) {
          result.set(currentDepth, []);
        }
        result.get(currentDepth)!.push(node);

        // Only traverse children if not collapsed
        if (!collapsedIds.has(node.id) && node.children.length > 0) {
          node.children.forEach(child => traverse(child, currentDepth + 1));
        }
      };

      treeNodes.forEach(root => traverse(root, 0));
      return result;
    };

    const nodesByDepth = flattenByDepth(headerTree.roots);
    const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    superGridLogger.debug(`SQL-driven rendering (${orientation})`, {
      depths,
      nodesAtDepth0: nodesByDepth.get(0)?.length ?? 0,
      firstFewLabels: nodesByDepth.get(0)?.slice(0, 10).map(n => n.label),
      totalLeaves: headerTree.leafCount,
    });

    // Debug: Log when rendering a large number of headers
    const headerCount = nodesByDepth.get(0)?.length ?? 0;
    if (headerCount > 1000) {
      superGridLogger.debug(`High header count (${orientation})`, { headerCount, threshold: 1000 });
    }

    // Force horizontal text rendering
    const forceHorizontalText: React.CSSProperties = {
      writingMode: 'horizontal-tb',
      textOrientation: 'mixed',
      direction: 'ltr',
    };

    // Handle toggle click
    const handleToggleClick = (e: React.MouseEvent, node: TreeHeaderNode) => {
      e.stopPropagation();
      const isCollapsed = collapsedIds.has(node.id);
      onHeaderToggle?.(node.id, !isCollapsed);
    };

    return (
      <div
        className={`supergrid-stack supergrid-stack--${orientation} supergrid-stack--sql-driven`}
        style={forceHorizontalText}
      >
        {depths.map(depth => {
          const nodesAtDepth = nodesByDepth.get(depth) || [];
          // Get facet info from first node at this depth
          const facet = nodesAtDepth[0]?.facet;
          const axisName = facet ? axisLetterToName[facet.axis] || 'category' : 'category';

          return (
            <div
              key={`depth-${depth}`}
              className={`supergrid-stack__level supergrid-stack__level--${depth}`}
              data-axis={axisName}
              data-facet={facet?.sourceColumn}
              style={forceHorizontalText}
            >
              {nodesAtDepth.map((node, index) => {
                const hasChildren = node.children.length > 0;
                const isCollapsed = collapsedIds.has(node.id);

                return (
                  <div
                    key={`${depth}-${node.id}-${index}`}
                    className={`supergrid-stack__header ${hasChildren ? 'supergrid-stack__header--expandable' : ''} ${isCollapsed ? 'supergrid-stack__header--collapsed' : ''}`}
                    style={{
                      [orientation === 'horizontal' ? 'gridColumnEnd' : 'gridRowEnd']: `span ${node.span}`,
                      ...forceHorizontalText
                    }}
                    draggable={enableDragDrop}
                    onDragStart={(e) => handleDragStart(e, depth)}
                    onClick={() => onHeaderClick?.(depth, node.value, axisName)}
                  >
                    {/* Collapse/expand toggle */}
                    {hasChildren && (
                      <button
                        className="supergrid-stack__toggle"
                        onClick={(e) => handleToggleClick(e, node)}
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                    )}
                    <span className="supergrid-stack__header-text" style={forceHorizontalText}>
                      {node.label}
                    </span>
                    {node.aggregate?.count && node.aggregate.count > 0 && (
                      <span className="supergrid-stack__header-count">
                        {node.aggregate.count}
                      </span>
                    )}
                    <span className="supergrid-stack__header-axis">
                      {facet?.axis || 'C'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // Legacy rendering (nodes-based, kept for backward compatibility)
  // ============================================================

  // Render nothing if no mappings (and no headerTree)
  if (!headerLevels.length) {
    return (
      <div className={`supergrid-stack supergrid-stack--${orientation} supergrid-stack--empty`}>
        <div className="supergrid-stack__empty-state">
          <span className="text-xs text-gray-400">
            {orientation === 'horizontal' ? 'Drop axis to create columns' : 'Drop axis to create rows'}
          </span>
        </div>
      </div>
    );
  }

  // Force horizontal text rendering to prevent garbled characters
  // This is a nuclear fix that overrides any cached CSS with vertical writing-mode
  const forceHorizontalText: React.CSSProperties = {
    writingMode: 'horizontal-tb',
    textOrientation: 'mixed',
    direction: 'ltr',
  };

  return (
    <div
      className={`supergrid-stack supergrid-stack--${orientation}`}
      style={forceHorizontalText}
    >
      {headerLevels.map(level => (
        <div
          key={`level-${level.level}`}
          className={`supergrid-stack__level supergrid-stack__level--${level.level}`}
          data-axis={level.axis}
          data-facet={level.facet}
          style={forceHorizontalText}
        >
          {level.values.map((headerValue, index) => (
            <div
              key={`${level.level}-${headerValue.value}-${index}`}
              className={`supergrid-stack__header`}
              style={{
                [orientation === 'horizontal' ? 'gridColumnEnd' : 'gridRowEnd']: `span ${headerValue.span}`,
                ...forceHorizontalText
              }}
              draggable={enableDragDrop}
              onDragStart={(e) => handleDragStart(e, level.level)}
              onClick={() => handleHeaderClick(level.level, headerValue.value, level.axis)}
            >
              <span className="supergrid-stack__header-text" style={forceHorizontalText}>
                {headerValue.value}
              </span>
              {headerValue.count > 1 && (
                <span className="supergrid-stack__header-count">
                  {headerValue.count}
                </span>
              )}
              <span className="supergrid-stack__header-axis">
                {level.axis.charAt(0).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Helper functions for extracting node values by LATCH axis

function extractLocationValue(node: Node, facet: string): string {
  switch (facet) {
    case 'location_name': return node.locationName || 'Unknown';
    case 'latitude': return node.latitude?.toString() || '0';
    case 'longitude': return node.longitude?.toString() || '0';
    default: return node.locationName || 'Unknown';
  }
}

function extractAlphabetValue(node: Node, facet: string): string {
  const name = node.name || '';
  switch (facet) {
    case 'name': return name.charAt(0).toUpperCase() || 'A';
    case 'summary': return (node.summary || '').charAt(0).toUpperCase() || 'A';
    default: return name.charAt(0).toUpperCase() || 'A';
  }
}

function extractTimeValue(node: Node, facet: string): string {
  // Handle missing or invalid date values
  const record = node as unknown as Record<string, unknown>;
  const dateStr = record[facet] || record.created_at || node.createdAt || record.modified_at || node.modifiedAt;

  if (!dateStr) return 'Unknown';

  const date = new Date(dateStr as string);

  // Check for invalid date
  if (isNaN(date.getTime())) return 'Unknown';

  switch (facet) {
    case 'year': return date.getFullYear().toString();
    case 'month': return date.toLocaleDateString('en-US', { month: 'long' });
    case 'quarter': return `Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'day': return date.toLocaleDateString('en-US', { weekday: 'long' });
    default: return date.getFullYear().toString();
  }
}

function extractCategoryValue(node: Node, facet: string): string {
  switch (facet) {
    case 'folder': return node.folder || 'Uncategorized';
    case 'status': return node.status || 'None';
    case 'tags': {
      const tags = node.tags || [];
      return Array.isArray(tags) && tags.length > 0 ? tags[0] : 'Untagged';
    }
    default: return node.folder || 'Uncategorized';
  }
}

function extractHierarchyValue(node: Node, facet: string): string {
  switch (facet) {
    case 'priority': {
      const p = node.priority || 0;
      if (p >= 3) return 'High';
      if (p >= 2) return 'Medium';
      if (p >= 1) return 'Low';
      return 'None';
    }
    case 'importance': {
      const imp = node.importance || 0;
      if (imp >= 3) return 'Critical';
      if (imp >= 2) return 'Important';
      if (imp >= 1) return 'Normal';
      return 'Low';
    }
    default: return 'None';
  }
}

/**
 * Extract value from node for given axis and facet
 * Maps LATCH axes to node properties
 */
function extractNodeValue(node: Node, axis: LATCHAxis, facet: string): string {
  switch (axis) {
    case 'location': return extractLocationValue(node, facet);
    case 'alphabet': return extractAlphabetValue(node, facet);
    case 'time': return extractTimeValue(node, facet);
    case 'category': return extractCategoryValue(node, facet);
    case 'hierarchy': return extractHierarchyValue(node, facet);
    default: return 'Unknown';
  }
}