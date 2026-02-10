/**
 * HeaderLayoutCalculator - Handles width calculations and positioning for SuperGrid headers
 *
 * Separated from SuperGridHeaders to focus on layout computation logic.
 */

import type { HeaderNode, HeaderHierarchy } from '../../types/grid';
import { HeaderLayoutService } from '../../services/supergrid/HeaderLayoutService';
import { superGridLogger } from '../../utils/dev-logger';

export class HeaderLayoutCalculator {
  private layoutService: HeaderLayoutService;

  constructor() {
    this.layoutService = new HeaderLayoutService();
  }

  /**
   * Calculate widths for all nodes in the hierarchy
   */
  calculateHierarchyWidths(hierarchy: HeaderHierarchy, totalWidth: number): void {
    if (!hierarchy) return;

    // Calculate widths for leaf nodes (bottom level)
    const leafNodes = hierarchy.allNodes.filter(node => node.isLeaf);
    const widthMap = this.layoutService.calculateSpanWidths(leafNodes, totalWidth);

    // Apply calculated widths
    leafNodes.forEach(node => {
      const width = widthMap.get(node.id) || 100;
      node.width = width;
    });

    // Calculate parent widths from children (bottom-up)
    this.calculateParentWidths(hierarchy);

    // Update total width
    hierarchy.totalWidth = totalWidth;
  }

  /**
   * Calculate parent node widths by summing their children
   */
  private calculateParentWidths(hierarchy: HeaderHierarchy): void {
    // Process levels bottom-up
    for (let level = hierarchy.maxDepth; level >= 0; level--) {
      const nodesAtLevel = hierarchy.allNodes.filter(node => node.level === level);

      nodesAtLevel.forEach(node => {
        if (!node.isLeaf) {
          // Calculate width as sum of children
          const childWidth = node.children.reduce((sum, child) => sum + child.width, 0);
          node.width = Math.max(childWidth, 50); // Minimum width

          // Update x position for children
          this.updateChildPositions(node);
        }
      });
    }
  }

  /**
   * Update x positions of child nodes based on parent position
   */
  private updateChildPositions(parentNode: HeaderNode): void {
    let currentX = parentNode.x;

    parentNode.children.forEach(child => {
      child.x = currentX;
      currentX += child.width;
    });
  }

  /**
   * Update click zones for interaction based on current layout
   */
  updateClickZones(node: HeaderNode): void {
    if (!node.clickZones) {
      node.clickZones = {
        expand: { x: 0, y: 0, width: 0, height: 0 },
        resize: { x: 0, y: 0, width: 0, height: 0 },
        select: { x: 0, y: 0, width: 0, height: 0 }
      };
    }

    const headerHeight = 24; // Default header height
    const expandIconSize = 16;
    const resizeHandleWidth = 4;

    // Expand/collapse zone (left side for non-leaf nodes)
    if (!node.isLeaf) {
      node.clickZones.expand = {
        x: node.x + 4,
        y: 2,
        width: expandIconSize,
        height: headerHeight - 4
      };
    }

    // Resize zone (right edge)
    node.clickZones.resize = {
      x: node.x + node.width - resizeHandleWidth,
      y: 0,
      width: resizeHandleWidth,
      height: headerHeight
    };

    // Selection zone (remaining area)
    const selectX = node.x + (node.isLeaf ? 0 : expandIconSize + 8);
    node.clickZones.select = {
      x: selectX,
      y: 0,
      width: node.x + node.width - resizeHandleWidth - selectX,
      height: headerHeight
    };
  }

  /**
   * Validate layout consistency across the hierarchy
   */
  validateLayout(hierarchy: HeaderHierarchy): boolean {
    try {
      // Check all nodes have valid dimensions
      const invalidNodes = hierarchy.allNodes.filter(node =>
        node.width <= 0 || isNaN(node.width) || isNaN(node.x)
      );

      if (invalidNodes.length > 0) {
        superGridLogger.setup('Invalid node dimensions found', {
          count: invalidNodes.length,
          nodes: invalidNodes.map(n => ({ id: n.id, width: n.width, x: n.x }))
        });
        return false;
      }

      // Check parent-child width consistency
      for (const node of hierarchy.allNodes) {
        if (!node.isLeaf) {
          const childrenWidth = node.children.reduce((sum, child) => sum + child.width, 0);
          if (Math.abs(node.width - childrenWidth) > 1) { // Allow 1px tolerance
            superGridLogger.setup('Parent-child width mismatch', {
              nodeId: node.id,
              nodeWidth: node.width,
              childrenWidth
            });
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      superGridLogger.setup('Layout validation error', { error });
      return false;
    }
  }
}