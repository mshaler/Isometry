/**
 * HeaderInteractionManager - Handles all header user interactions
 *
 * Extracted from SuperGridHeaders.old.ts to manage mouse interactions,
 * click handling, and column resizing behavior.
 */

import * as d3 from 'd3';
import type {
  HeaderNode,
  ResizeHandleConfig,
  ResizeOperationState
} from '../../types/grid';
import { DEFAULT_RESIZE_CONFIG } from '../../types/grid';
import { superGridLogger } from '../../utils/dev-logger';

export interface InteractionCallbacks {
  onNodeToggle?: (nodeId: string, isExpanded: boolean) => void;
  onColumnResize?: (nodeId: string, newWidth: number) => void;
  onAnimationTrigger?: (node: HeaderNode) => void;
}

export class HeaderInteractionManager {
  private callbacks: InteractionCallbacks;
  private resizeConfig: ResizeHandleConfig;
  private resizeState: ResizeOperationState;
  private resizeBehavior: d3.DragBehavior<SVGGElement, HeaderNode, any> | null = null;

  // Animation frame tracking for smooth resizing
  private animationFrameId: number | null = null;
  private pendingResizeUpdate: (() => void) | null = null;

  constructor(
    _container: d3.Selection<SVGElement, unknown, null, undefined>,
    callbacks: InteractionCallbacks = {},
    resizeConfig: Partial<ResizeHandleConfig> = {}
  ) {
    this.callbacks = callbacks;
    this.resizeConfig = { ...DEFAULT_RESIZE_CONFIG, ...resizeConfig };
    this.resizeState = {
      isActive: false,
      startX: 0,
      startY: 0,
      startWidth: 0,
      targetNodeId: '',
      affectedNodes: []
    };

    this.initializeColumnResizeBehavior();
  }

  /**
   * Add interaction handlers to header nodes
   */
  public addInteractionHandlers(
    nodeSelection: d3.Selection<SVGGElement, HeaderNode, any, any>
  ): void {
    // Remove existing resize behavior
    if (this.resizeBehavior) {
      nodeSelection.call(this.resizeBehavior);
    }

    // Add mouse interaction handlers
    nodeSelection
      .on('mouseenter', (event, node) => this.handleMouseEnter(event, node))
      .on('mousemove', (event, node) => this.handleMouseMove(event, node))
      .on('mouseleave', (event, node) => this.handleMouseLeave(event, node))
      .on('click', (event, node) => this.handleClick(event, node));
  }

  /**
   * Update callbacks for interaction responses
   */
  public updateCallbacks(callbacks: Partial<InteractionCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clean up any pending operations
   */
  public cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.pendingResizeUpdate = null;
  }

  /**
   * Handle mouse enter events
   */
  private handleMouseEnter(event: MouseEvent, _node: HeaderNode): void {
    // Add hover styling
    d3.select(event.currentTarget as SVGGElement)
      .classed('header-hover', true);
  }

  /**
   * Handle mouse move events for cursor updates
   */
  private handleMouseMove(event: MouseEvent, node: HeaderNode): void {
    this.updateCursorForZone(event, node);
  }

  /**
   * Update cursor based on interaction zone
   */
  private updateCursorForZone(event: MouseEvent, node: HeaderNode): void {
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const isInResizeZone = mouseX >= node.width - this.resizeConfig.handleWidth;

    if (isInResizeZone) {
      d3.select(event.currentTarget as SVGGElement)
        .style('cursor', this.resizeConfig.cursor || 'col-resize');
    } else {
      d3.select(event.currentTarget as SVGGElement)
        .style('cursor', node.isLeaf ? 'default' : 'pointer');
    }
  }

  /**
   * Handle mouse leave events
   */
  private handleMouseLeave(event: MouseEvent, _node: HeaderNode): void {
    d3.select(event.currentTarget as SVGGElement)
      .classed('header-hover', false)
      .style('cursor', null);
  }

  /**
   * Handle click events for expansion/collapse
   */
  private handleClick(event: MouseEvent, node: HeaderNode): void {
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    // Check if click is on expand/collapse icon (left 32px)
    if (!node.isLeaf && mouseX <= 32) {
      event.stopPropagation();

      // Toggle the node and trigger callback
      const newExpandedState = !node.isExpanded;

      if (this.callbacks.onNodeToggle) {
        this.callbacks.onNodeToggle(node.id, newExpandedState);
      }

      // Trigger animation if callback provided
      if (this.callbacks.onAnimationTrigger) {
        this.callbacks.onAnimationTrigger(node);
      }

      superGridLogger.debug('Node toggled', {
        nodeId: node.id,
        isExpanded: newExpandedState,
        level: node.level
      });
    }
  }

  /**
   * Initialize column resize drag behavior
   */
  private initializeColumnResizeBehavior(): void {
    this.resizeBehavior = d3.drag<SVGGElement, HeaderNode, any>()
      .filter((event, node) => this.isResizeZone(event, node))
      .on('start', (event, node) => this.handleResizeStart(event, node))
      .on('drag', (event, node) => this.handleResizeDrag(event, node))
      .on('end', (event, node) => this.handleResizeEnd(event, node));
  }

  /**
   * Check if event is in resize zone
   */
  private isResizeZone(event: d3.D3DragEvent<SVGGElement, HeaderNode, any>, node: HeaderNode): boolean {
    const mouseX = event.sourceEvent.offsetX;
    return mouseX >= node.width - this.resizeConfig.handleWidth;
  }

  /**
   * Handle resize start
   */
  private handleResizeStart(event: d3.D3DragEvent<SVGGElement, HeaderNode, any>, node: HeaderNode): void {
    this.resizeState = {
      isActive: true,
      startX: event.x,
      startY: event.y,
      startWidth: node.width,
      targetNodeId: node.id,
      affectedNodes: [node]
    };

    superGridLogger.debug('Resize started', {
      nodeId: node.id,
      startWidth: node.width,
      startX: event.x
    });
  }

  /**
   * Handle resize drag
   */
  private handleResizeDrag(event: d3.D3DragEvent<SVGGElement, HeaderNode, any>, node: HeaderNode): void {
    if (!this.resizeState.isActive || this.resizeState.targetNodeId !== node.id) {
      return;
    }

    const deltaX = event.x - this.resizeState.startX;
    const newWidth = Math.max(
      this.resizeConfig.minWidth,
      Math.min(this.resizeConfig.maxWidth, this.resizeState.startWidth + deltaX)
    );

    // Store the pending update
    this.pendingResizeUpdate = () => {
      if (this.callbacks.onColumnResize) {
        this.callbacks.onColumnResize(node.id, newWidth);
      }
    };

    // Use animation frame for smooth updates if enabled
    if (!this.animationFrameId && this.resizeConfig.enableSmoothing) {
      this.animationFrameId = requestAnimationFrame(() => {
        this.applyResizeUpdate();
      });
    } else if (!this.resizeConfig.enableSmoothing) {
      this.applyResizeUpdate();
    }
  }

  /**
   * Handle resize end
   */
  private handleResizeEnd(event: d3.D3DragEvent<SVGGElement, HeaderNode, any>, node: HeaderNode): void {
    if (!this.resizeState.isActive || this.resizeState.targetNodeId !== node.id) {
      return;
    }

    // Apply any pending updates
    if (this.pendingResizeUpdate) {
      this.applyResizeUpdate();
    }

    // Clean up animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const deltaX = event.x - this.resizeState.startX;
    const finalWidth = Math.max(
      this.resizeConfig.minWidth,
      Math.min(this.resizeConfig.maxWidth, this.resizeState.startWidth + deltaX)
    );

    superGridLogger.debug('Resize completed', {
      nodeId: node.id,
      finalWidth,
      deltaX,
      startWidth: this.resizeState.startWidth
    });

    // Reset resize state
    this.resizeState = {
      isActive: false,
      startX: 0,
      startY: 0,
      startWidth: 0,
      targetNodeId: '',
      affectedNodes: []
    };
  }

  /**
   * Apply pending resize update
   */
  private applyResizeUpdate(): void {
    if (this.pendingResizeUpdate) {
      this.pendingResizeUpdate();
      this.pendingResizeUpdate = null;
    }
    this.animationFrameId = null;
  }
}