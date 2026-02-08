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
import { usePAFV } from '@/hooks/usePAFV';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type { Node } from '@/types/node';

interface SuperStackProps {
  /** Orientation: column headers (horizontal) or row headers (vertical) */
  orientation: 'horizontal' | 'vertical';
  /** Nodes data to create hierarchy from */
  nodes: Node[];
  /** Callback when header cell is clicked */
  onHeaderClick?: (level: number, value: string, axis: LATCHAxis) => void;
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
  onHeaderClick,
  enableDragDrop = false,
  maxLevels = 4
}: SuperStackProps) {
  const { state: pafvState } = usePAFV();

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
    if (!activeMappings.length || !nodes.length) return [];

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

      nodes.forEach(node => {
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
          children: Array.from(group.children),
          count: group.nodes.length
        });
      });

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

  // Render nothing if no mappings
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

  return (
    <div className={`supergrid-stack supergrid-stack--${orientation}`}>
      {headerLevels.map(level => (
        <div
          key={`level-${level.level}`}
          className={`supergrid-stack__level supergrid-stack__level--${level.level}`}
          data-axis={level.axis}
          data-facet={level.facet}
        >
          {level.values.map((headerValue, index) => (
            <div
              key={`${level.level}-${headerValue.value}-${index}`}
              className={`supergrid-stack__header`}
              style={{
                [orientation === 'horizontal' ? 'gridColumnEnd' : 'gridRowEnd']: `span ${headerValue.span}`
              }}
              draggable={enableDragDrop}
              onDragStart={(e) => handleDragStart(e, level.level)}
              onClick={() => handleHeaderClick(level.level, headerValue.value, level.axis)}
            >
              <span className="supergrid-stack__header-text">
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

/**
 * Extract value from node for given axis and facet
 * Maps LATCH axes to node properties
 */
function extractNodeValue(node: Node, axis: LATCHAxis, facet: string): string {
  switch (axis) {
    case 'location':
      if (facet === 'location_name') return node.locationName || 'Unknown';
      if (facet === 'latitude') return node.latitude?.toString() || '0';
      if (facet === 'longitude') return node.longitude?.toString() || '0';
      return node.locationName || 'Unknown';

    case 'alphabet':
      if (facet === 'name') return node.name.charAt(0).toUpperCase();
      if (facet === 'summary') return (node.summary || '').charAt(0).toUpperCase() || 'A';
      return node.name.charAt(0).toUpperCase();

    case 'time': {
      const date = new Date(node.createdAt);
      if (facet === 'year') return date.getFullYear().toString();
      if (facet === 'month') return date.toLocaleDateString('en-US', { month: 'long' });
      if (facet === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1}`;
      if (facet === 'day') return date.toLocaleDateString('en-US', { weekday: 'long' });
      return date.getFullYear().toString();
    }

    case 'category':
      if (facet === 'folder') return node.folder || 'Uncategorized';
      if (facet === 'status') return node.status || 'None';
      if (facet === 'tags') {
        const tags = node.tags || [];
        return Array.isArray(tags) && tags.length > 0 ? tags[0] : 'Untagged';
      }
      return node.folder || 'Uncategorized';

    case 'hierarchy':
      if (facet === 'priority') {
        const p = node.priority || 0;
        if (p >= 3) return 'High';
        if (p >= 2) return 'Medium';
        if (p >= 1) return 'Low';
        return 'None';
      }
      if (facet === 'importance') {
        const imp = node.importance || 0;
        if (imp >= 3) return 'Critical';
        if (imp >= 2) return 'Important';
        if (imp >= 1) return 'Normal';
        return 'Low';
      }
      return 'None';

    default:
      return 'Unknown';
  }
}