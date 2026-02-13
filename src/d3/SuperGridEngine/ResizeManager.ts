/**
 * ResizeManager — Handles column/row resizing for SuperGrid
 *
 * Enables SuperSize feature: drag to resize single headers,
 * Shift+drag for bulk resize, double-click for auto-fit.
 */
import * as d3 from 'd3';
import type { HeaderDescriptor } from './types';

export interface ResizeManagerConfig {
  /** Minimum column/row size in pixels */
  minSize: number;
  /** Callback during resize (for live preview) */
  onResize: (headerId: string, newWidth: number) => void;
  /** Callback when resize completes */
  onResizeEnd: (headerId: string, finalWidth: number) => void;
}

export interface ResizeState {
  headerId: string;
  orientation: 'column' | 'row';
  startWidth: number;
  startX: number;
  isShiftHeld: boolean;
  currentWidth: number;
}

export interface ResizeResult {
  headerId: string;
  newWidth: number;
}

export class ResizeManager {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private config: ResizeManagerConfig;
  private state: ResizeState | null = null;

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    config: ResizeManagerConfig
  ) {
    this.svg = svg;
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): ResizeManagerConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ResizeManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a resize operation is in progress
   */
  isResizing(): boolean {
    return this.state !== null;
  }

  /**
   * Get current resize state
   */
  getResizeState(): ResizeState | null {
    return this.state;
  }

  /**
   * Start a resize operation
   */
  startResize(header: HeaderDescriptor, event: MouseEvent): void {
    // Use ID prefix to determine orientation (matches pattern in SuperGridEngine index.ts)
    const isColumnHeader = header.id.startsWith('col') || header.axis === 'Category' || header.axis === 'Alphabet';
    this.state = {
      headerId: header.id,
      orientation: isColumnHeader ? 'column' : 'row',
      startWidth: header.position.width,
      startX: event.clientX,
      isShiftHeld: event.shiftKey,
      currentWidth: header.position.width,
    };

    // Add resize cursor to body during resize
    document.body.style.cursor = 'col-resize';

    // Prevent text selection during resize
    if (event.preventDefault) {
      event.preventDefault();
    }
  }

  /**
   * Update resize based on mouse movement
   * @returns New width after applying delta
   */
  updateResize(event: MouseEvent): number {
    if (!this.state) return 0;

    const delta = event.clientX - this.state.startX;
    const newWidth = this.constrainSize(this.state.startWidth + delta);
    this.state.currentWidth = newWidth;

    // Notify callback for live preview
    this.config.onResize(this.state.headerId, newWidth);

    return newWidth;
  }

  /**
   * Constrain size to minimum
   */
  constrainSize(width: number): number {
    return Math.max(this.config.minSize, width);
  }

  /**
   * End resize operation
   * @returns Final dimensions or null if not resizing
   */
  endResize(): ResizeResult | null {
    if (!this.state) return null;

    const result: ResizeResult = {
      headerId: this.state.headerId,
      newWidth: this.state.currentWidth,
    };

    // Notify callback
    this.config.onResizeEnd(this.state.headerId, this.state.currentWidth);

    // Reset cursor
    document.body.style.cursor = '';

    // Clear state
    this.state = null;

    return result;
  }

  /**
   * Cancel resize without applying changes
   */
  cancelResize(): void {
    if (this.state) {
      // Restore original width via callback
      this.config.onResize(this.state.headerId, this.state.startWidth);
    }

    document.body.style.cursor = '';
    this.state = null;
  }

  /**
   * Calculate bulk resize widths for all siblings
   * @param headers All headers at the same level
   * @param targetHeader The header being resized
   * @param ratio The resize ratio to apply (newWidth / originalWidth)
   * @returns Map of header IDs to new widths
   */
  calculateBulkResize(
    headers: HeaderDescriptor[],
    targetHeader: HeaderDescriptor,
    ratio: number
  ): Map<string, number> {
    const newWidths = new Map<string, number>();

    // Filter to same level (siblings)
    const siblings = headers.filter((h) => h.level === targetHeader.level);

    for (const sibling of siblings) {
      const newWidth = this.constrainSize(sibling.position.width * ratio);
      newWidths.set(sibling.id, newWidth);
    }

    return newWidths;
  }

  /**
   * Calculate auto-fit width for a header based on content
   * @param header The header to auto-fit
   * @param cells All cells (filtered internally to this column)
   * @param measureText Function to measure text width
   * @returns Optimal width for the header
   */
  calculateAutoFitWidth(
    header: HeaderDescriptor,
    cells: unknown[],
    measureText: (text: string) => number
  ): number {
    const PADDING = 16;

    // Start with header text width
    let maxWidth = measureText(header.value) + PADDING;

    // Find cells in this column (between startIndex and endIndex)
    const columnCells = cells.filter((cell) => {
      const c = cell as { gridX?: number };
      return (
        c.gridX !== undefined &&
        c.gridX >= header.startIndex &&
        c.gridX <= header.endIndex
      );
    });

    // Measure each cell's primary text
    for (const cell of columnCells) {
      const c = cell as { primaryText?: string };
      if (c.primaryText) {
        const contentWidth = measureText(c.primaryText) + PADDING;
        maxWidth = Math.max(maxWidth, contentWidth);
      }
    }

    return this.constrainSize(maxWidth);
  }

  /**
   * Create a text measurement function using SVG
   */
  createTextMeasurer(): (text: string) => number {
    // Create a hidden text element for measurement
    const measureGroup = this.svg
      .append('g')
      .attr('class', 'text-measurer')
      .style('visibility', 'hidden');

    const measureText = measureGroup
      .append('text')
      .style('font-size', '12px')
      .style('font-family', 'system-ui, sans-serif');

    return (text: string): number => {
      measureText.text(text);
      const bbox = measureText.node()?.getBBox();
      return bbox?.width ?? 0;
    };
  }

  /**
   * Clean up measurement elements
   */
  cleanupMeasurer(): void {
    this.svg.selectAll('.text-measurer').remove();
  }
}
