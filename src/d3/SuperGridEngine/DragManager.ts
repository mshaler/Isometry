/**
 * DragManager — Handles drag-and-drop axis repositioning for SuperGrid
 *
 * Enables SuperDynamic feature: drag column headers to row area (or vice versa)
 * to transpose the grid axes.
 */
import * as d3 from 'd3';

export interface DropZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragManagerConfig {
  /** Height of column headers */
  headerHeight: number;
  /** Width of row headers */
  rowHeaderWidth: number;
  /** Callback when axes are swapped */
  onAxisSwap: (fromAxis: 'x' | 'y', toAxis: 'x' | 'y') => void;
}

interface DragState {
  active: boolean;
  source: 'x' | 'y' | null;
  startX: number;
  startY: number;
  ghostElement: SVGGElement | null;
}

export class DragManager {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private config: DragManagerConfig;
  private dragState: DragState;

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    config: DragManagerConfig
  ) {
    this.svg = svg;
    this.config = config;
    this.dragState = {
      active: false,
      source: null,
      startX: 0,
      startY: 0,
      ghostElement: null,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DragManagerConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DragManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a drag operation is in progress
   */
  isDragging(): boolean {
    return this.dragState.active;
  }

  /**
   * Get the source axis of the current drag
   */
  getDragSource(): 'x' | 'y' | null {
    return this.dragState.source;
  }

  /**
   * Get SVG dimensions
   */
  private getSvgDimensions(): { width: number; height: number } {
    const svgNode = this.svg.node();
    if (!svgNode) {
      return { width: 800, height: 600 };
    }
    return {
      width: parseFloat(svgNode.getAttribute('width') || '800'),
      height: parseFloat(svgNode.getAttribute('height') || '600'),
    };
  }

  /**
   * Get drop zone bounds for an axis
   */
  getDropZone(axis: 'x' | 'y'): DropZone {
    const { width, height } = this.getSvgDimensions();

    if (axis === 'x') {
      // X-axis drop zone is the column header area
      return {
        x: this.config.rowHeaderWidth,
        y: 0,
        width: width - this.config.rowHeaderWidth,
        height: this.config.headerHeight,
      };
    } else {
      // Y-axis drop zone is the row header area
      return {
        x: 0,
        y: this.config.headerHeight,
        width: this.config.rowHeaderWidth,
        height: height - this.config.headerHeight,
      };
    }
  }

  /**
   * Setup drag behavior on header elements
   */
  setupHeaderDrag(selector: string): void {
    const headers = this.svg.selectAll(selector);

    const drag = d3
      .drag<SVGGElement, unknown>()
      .on('start', (event, d) => this.handleDragStart(event, d, selector))
      .on('drag', (event, d) => this.handleDrag(event, d))
      .on('end', (event, d) => this.handleDragEnd(event, d));

    headers.call(drag as unknown as (selection: d3.Selection<d3.BaseType, unknown, SVGSVGElement, unknown>) => void);
  }

  /**
   * Handle drag start
   */
  private handleDragStart(
    event: d3.D3DragEvent<SVGGElement, unknown, unknown>,
    _d: unknown,
    selector: string
  ): void {
    this.dragState.active = true;
    this.dragState.source = selector.includes('col') ? 'x' : 'y';
    this.dragState.startX = event.x;
    this.dragState.startY = event.y;

    // Create ghost element for drag visualization
    this.createGhost(event.sourceEvent.target as SVGElement);
  }

  /**
   * Handle drag movement
   */
  private handleDrag(
    event: d3.D3DragEvent<SVGGElement, unknown, unknown>,
    _d: unknown
  ): void {
    if (!this.dragState.active || !this.dragState.ghostElement) return;

    // Move ghost element with cursor
    const ghost = d3.select(this.dragState.ghostElement);
    ghost.attr(
      'transform',
      `translate(${event.x - this.dragState.startX}, ${event.y - this.dragState.startY})`
    );

    // Check if over opposite drop zone and highlight
    this.updateDropZoneHighlight(event.x, event.y);
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(
    event: d3.D3DragEvent<SVGGElement, unknown, unknown>,
    _d: unknown
  ): void {
    if (!this.dragState.active) return;

    const targetAxis = this.getDropZoneAtPoint(event.x, event.y);

    // If dropped in opposite zone, trigger swap
    if (targetAxis && targetAxis !== this.dragState.source) {
      this.triggerAxisSwap(this.dragState.source!, targetAxis);
    }

    // Cleanup
    this.removeGhost();
    this.clearDropZoneHighlight();
    this.dragState.active = false;
    this.dragState.source = null;
  }

  /**
   * Create a ghost element for drag visualization
   */
  private createGhost(sourceElement: SVGElement): void {
    const clone = sourceElement.cloneNode(true) as SVGGElement;
    clone.setAttribute('class', 'drag-ghost');
    clone.style.opacity = '0.5';
    clone.style.pointerEvents = 'none';

    this.svg.node()?.appendChild(clone);
    this.dragState.ghostElement = clone;
  }

  /**
   * Remove the ghost element
   */
  private removeGhost(): void {
    if (this.dragState.ghostElement) {
      this.dragState.ghostElement.remove();
      this.dragState.ghostElement = null;
    }
  }

  /**
   * Check which drop zone contains a point
   */
  private getDropZoneAtPoint(x: number, y: number): 'x' | 'y' | null {
    const xZone = this.getDropZone('x');
    const yZone = this.getDropZone('y');

    if (
      x >= xZone.x &&
      x <= xZone.x + xZone.width &&
      y >= xZone.y &&
      y <= xZone.y + xZone.height
    ) {
      return 'x';
    }

    if (
      x >= yZone.x &&
      x <= yZone.x + yZone.width &&
      y >= yZone.y &&
      y <= yZone.y + yZone.height
    ) {
      return 'y';
    }

    return null;
  }

  /**
   * Update drop zone visual highlight
   */
  private updateDropZoneHighlight(x: number, y: number): void {
    const targetAxis = this.getDropZoneAtPoint(x, y);

    // Clear existing highlights
    this.svg.selectAll('.drop-zone-highlight').remove();

    // Only highlight opposite zone
    if (targetAxis && targetAxis !== this.dragState.source) {
      const zone = this.getDropZone(targetAxis);
      this.svg
        .append('rect')
        .attr('class', 'drop-zone-highlight')
        .attr('x', zone.x)
        .attr('y', zone.y)
        .attr('width', zone.width)
        .attr('height', zone.height)
        .attr('fill', 'rgba(59, 130, 246, 0.2)')
        .attr('stroke', 'rgba(59, 130, 246, 0.5)')
        .attr('stroke-width', 2)
        .style('pointer-events', 'none');
    }
  }

  /**
   * Clear drop zone highlights
   */
  private clearDropZoneHighlight(): void {
    this.svg.selectAll('.drop-zone-highlight').remove();
  }

  /**
   * Trigger axis swap via callback
   */
  triggerAxisSwap(fromAxis: 'x' | 'y', toAxis: 'x' | 'y'): void {
    this.config.onAxisSwap(fromAxis, toAxis);
  }

  /**
   * Handle escape key to cancel drag
   */
  cancelDrag(): void {
    if (this.dragState.active) {
      this.removeGhost();
      this.clearDropZoneHighlight();
      this.dragState.active = false;
      this.dragState.source = null;
    }
  }
}
