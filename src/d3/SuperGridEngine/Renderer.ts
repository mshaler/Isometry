/**
 * SuperGridEngine Renderer - Handles D3.js rendering of grids
 *
 * SuperZoom: Pinned upper-left anchor for spreadsheet-like zoom behavior.
 * - Scroll wheel zoom anchors to (0,0) instead of cursor position
 * - Pan constrained to grid boundaries (can't scroll past edges)
 */

import type { CellDescriptor, HeaderTree, HeaderDescriptor, GridDimensions, SelectionState, Node } from './types';
import { devLogger } from '../../utils/logging';
import {
  hitTest,
  getCursorForZone,
  getHoverHighlightStyle,
  createZoneClickHandler,
  type HitTestConfig,
  type ClickZone,
  type HitTestResult,
  type HoverHighlightStyle,
} from './ClickZoneManager';

// ============================================================================
// Exported Types for Pinned Zoom Transform
// ============================================================================

/**
 * Input transform representing current zoom/pan state.
 * Compatible with D3's ZoomTransform structure.
 */
export interface ZoomTransformInput {
  x: number;   // Translation X
  y: number;   // Translation Y
  k: number;   // Scale factor
}

/**
 * Grid bounds for constraining pan/zoom.
 */
export interface GridBounds {
  width: number;
  height: number;
}

/**
 * Viewport size for calculating pan limits.
 */
export interface ViewportSize {
  width: number;
  height: number;
}

// ============================================================================
// Pinned Zoom Transform Functions
// ============================================================================

/**
 * Calculate transform for pinned upper-left zoom.
 *
 * Unlike D3's default (zoom centered on cursor), this scales from the origin.
 * The upper-left corner (0,0) stays fixed while the grid expands/contracts.
 *
 * Algorithm:
 * 1. Compute scale ratio (newScale / currentScale)
 * 2. Scale translation proportionally to maintain relative position
 *
 * @param current - Current transform state
 * @param newScale - New scale factor
 * @returns New transform with scaled translation
 */
export function calculatePinnedZoomTransform(
  current: ZoomTransformInput,
  newScale: number
): ZoomTransformInput {
  const scaleRatio = newScale / current.k;

  return {
    x: current.x * scaleRatio,
    y: current.y * scaleRatio,
    k: newScale
  };
}

/**
 * Constrain transform to grid boundaries.
 *
 * Prevents panning past grid edges:
 * - x <= 0 (can't pan past left edge)
 * - y <= 0 (can't pan past top edge)
 * - x >= -(scaledWidth - viewportWidth) (can't pan past right edge)
 * - y >= -(scaledHeight - viewportHeight) (can't pan past bottom edge)
 *
 * @param transform - Transform to constrain
 * @param gridBounds - Total grid dimensions
 * @param viewportSize - Visible viewport dimensions
 * @returns Constrained transform
 */
export function constrainToBounds(
  transform: ZoomTransformInput,
  gridBounds: GridBounds,
  viewportSize: ViewportSize
): ZoomTransformInput {
  const scaledWidth = gridBounds.width * transform.k;
  const scaledHeight = gridBounds.height * transform.k;

  // Calculate min values (how far left/up we can pan)
  // If grid is smaller than viewport, min = 0 (no panning needed)
  const minX = Math.min(0, viewportSize.width - scaledWidth);
  const minY = Math.min(0, viewportSize.height - scaledHeight);

  // Clamp x: 0 (left edge) to minX (right edge visible)
  const clampedX = Math.max(minX, Math.min(0, transform.x));

  // Clamp y: 0 (top edge) to minY (bottom edge visible)
  const clampedY = Math.max(minY, Math.min(0, transform.y));

  return {
    x: clampedX,
    y: clampedY,
    k: transform.k
  };
}

export class SuperGridRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  // Viewport and grid tracking for pinned zoom constraints
  private viewportSize: ViewportSize = { width: 0, height: 0 };
  private gridBounds: GridBounds = { width: 0, height: 0 };
  private currentTransform: ZoomTransformInput = { x: 0, y: 0, k: 1 };
  private d3Module: typeof import('d3') | null = null;
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

  // Event callbacks
  private onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
  private onHeaderClick?: (header: HeaderDescriptor) => void;
  private onHeaderExpandCollapse?: (header: HeaderDescriptor) => void;
  private onHeaderSelectChildren?: (header: HeaderDescriptor) => void;
  private onRenderComplete?: (renderTime: number, cellCount: number) => void;

  // State for hit testing
  private currentColumnHeaders: HeaderDescriptor[] = [];
  private currentRowHeaders: HeaderDescriptor[] = [];
  private currentCells: CellDescriptor[] = [];
  private currentZone: ClickZone = 'none';

  // Configuration for hit testing
  private hitTestConfig: HitTestConfig = {
    labelHeight: 32,
    resizeEdgeWidth: 4,
    gridDimensions: {
      rows: 0,
      cols: 0,
      cellWidth: 100,
      cellHeight: 80,
      headerHeight: 40,
      headerWidth: 120,
      totalWidth: 0,
      totalHeight: 0,
    },
  };

  constructor(_animationDuration: number = 250) {
    // Animation duration stored for future use
  }

  /**
   * Initialize SVG and set up basic structure
   */
  async setupSVG(container: HTMLElement, width: number, height: number, enableZoomPan: boolean): Promise<void> {
    // Import d3 dynamically to avoid module loading issues
    const d3 = await import('d3');
    this.d3Module = d3;

    // Store viewport dimensions for zoom constraints
    this.viewportSize = { width, height };

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'supergrid-engine');

    // Create main groups with proper z-ordering
    const mainGroup = this.svg.append('g').attr('class', 'supergrid-main');
    mainGroup.append('g').attr('class', 'headers');
    mainGroup.append('g').attr('class', 'cells');
    mainGroup.append('g').attr('class', 'selection');
    mainGroup.append('g').attr('class', 'hover-highlight');

    if (enableZoomPan) {
      this.setupZoomBehavior(d3);
    }

    // Set up mousemove handler for cursor zone changes and hover highlighting
    this.setupMouseMoveHandler();

    // Set up click handler for zone-based actions
    this.setupClickHandler();
  }

  /**
   * Set up mousemove handler for zone-based cursor updates and hover highlighting.
   * Cursor changes based on which zone the mouse is over:
   * - parent-label: pointer (expand/collapse)
   * - child-body: cell (select children)
   * - resize-edge: col-resize (resize column/row)
   * - data-cell: default
   */
  private setupMouseMoveHandler(): void {
    if (!this.svg) return;

    const svgElement = this.svg.node();
    if (!svgElement) return;

    svgElement.addEventListener('mousemove', (event: MouseEvent) => {
      // Get point relative to SVG
      const rect = svgElement.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Perform hit test
      const result = hitTest(
        point,
        this.currentColumnHeaders,
        this.currentRowHeaders,
        this.currentCells,
        this.hitTestConfig
      );

      // Update cursor if zone changed
      if (result.zone !== this.currentZone) {
        this.currentZone = result.zone;
        svgElement.style.cursor = getCursorForZone(result.zone);
      }

      // Update hover highlighting
      this.updateHoverHighlight(result);
    });

    // Clear highlight on mouse leave
    svgElement.addEventListener('mouseleave', () => {
      this.clearHoverHighlight();
      this.currentZone = 'none';
    });
  }

  /**
   * Update hover highlight based on hit test result.
   */
  private updateHoverHighlight(result: HitTestResult): void {
    if (!this.svg) return;

    const highlightGroup = this.svg.select('.hover-highlight');

    // Get highlight style for this zone
    const style = getHoverHighlightStyle(result.zone, result.header);

    if (!style) {
      this.clearHoverHighlight();
      return;
    }

    // Create or update highlight rectangle
    let highlight = highlightGroup.select<SVGRectElement>('.hover-rect');

    if (highlight.empty()) {
      highlight = highlightGroup
        .append('rect')
        .attr('class', 'hover-rect')
        .style('pointer-events', 'none');
    }

    // Apply style based on highlight type
    const { headerWidth, headerHeight } = this.hitTestConfig.gridDimensions;
    const isColumnHeader = result.header?.id.startsWith('column_');

    highlight
      .attr('x', style.x + (isColumnHeader ? headerWidth : 0))
      .attr('y', style.y + (isColumnHeader ? 0 : headerHeight))
      .attr('width', style.width)
      .attr('height', style.height)
      .attr('fill', this.getHighlightFill(style.type))
      .attr('stroke', this.getHighlightStroke(style.type))
      .attr('stroke-width', style.type === 'resize' ? 2 : 1)
      .attr('opacity', 0.3);
  }

  /**
   * Get fill color for highlight based on type.
   */
  private getHighlightFill(type: HoverHighlightStyle['type']): string {
    switch (type) {
      case 'span':
        return '#007acc'; // Blue for span (expand/collapse)
      case 'cell':
        return '#28a745'; // Green for cell selection
      case 'resize':
        return 'none';
      default:
        return 'none';
    }
  }

  /**
   * Get stroke color for highlight based on type.
   */
  private getHighlightStroke(type: HoverHighlightStyle['type']): string {
    switch (type) {
      case 'span':
        return '#005a9e';
      case 'cell':
        return '#1e7e34';
      case 'resize':
        return '#6c757d';
      default:
        return 'none';
    }
  }

  /**
   * Clear hover highlight.
   */
  private clearHoverHighlight(): void {
    if (!this.svg) return;

    this.svg.select('.hover-highlight').selectAll('.hover-rect').remove();
  }

  /**
   * Set up click handler for zone-based actions.
   */
  private setupClickHandler(): void {
    if (!this.svg) return;

    const svgElement = this.svg.node();
    if (!svgElement) return;

    // Create zone click handler with callbacks
    const zoneClickHandler = createZoneClickHandler({
      onExpandCollapse: (header) => {
        if (this.onHeaderExpandCollapse) {
          this.onHeaderExpandCollapse(header);
        }
      },
      onSelectChildren: (header) => {
        if (this.onHeaderSelectChildren) {
          this.onHeaderSelectChildren(header);
        } else if (this.onHeaderClick) {
          // Fallback to generic header click
          this.onHeaderClick(header);
        }
      },
      onSelectCell: (cell) => {
        if (this.onCellClick) {
          // Find nodes for this cell
          const nodes: Node[] = []; // Would need allNodes reference
          this.onCellClick(cell, nodes);
        }
      },
    });

    // Listen for clicks and dispatch based on current hover state
    svgElement.addEventListener('click', (event: MouseEvent) => {
      // Get point relative to SVG
      const rect = svgElement.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Perform hit test to get current zone
      const result = hitTest(
        point,
        this.currentColumnHeaders,
        this.currentRowHeaders,
        this.currentCells,
        this.hitTestConfig
      );

      // Dispatch to zone-specific handler
      zoneClickHandler(result);
    });
  }

  /**
   * Update grid bounds for zoom constraints.
   * Called when grid dimensions change (e.g., after data load).
   */
  setGridBounds(width: number, height: number): void {
    this.gridBounds = { width, height };
  }

  /**
   * Set up zoom and pan behavior with pinned upper-left anchor.
   *
   * SuperZoom features:
   * - Scroll wheel zoom anchors to (0,0) instead of cursor position
   * - Pan constrained to grid boundaries
   * - Grid expands/contracts from upper-left corner
   */
  private setupZoomBehavior(d3: typeof import('d3')): void {
    if (!this.svg) return;

    const mainGroup = this.svg.select('.supergrid-main');

    // Create zoom behavior with custom transform handling
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        // Allow wheel events (zoom) and drag events (pan)
        // Block double-click zoom to avoid confusion with cell selection
        return !event.ctrlKey && event.type !== 'dblclick';
      })
      .on('zoom', (event) => {
        const { transform, sourceEvent } = event;

        // Detect if this is a zoom (scale change) vs pan (drag)
        const isZooming = sourceEvent?.type === 'wheel' ||
          Math.abs(transform.k - this.currentTransform.k) > 0.001;

        let newTransform: ZoomTransformInput;

        if (isZooming) {
          // Pinned zoom: scale from origin (0,0)
          newTransform = calculatePinnedZoomTransform(
            this.currentTransform,
            transform.k
          );
        } else {
          // Panning: use D3's calculated translation
          newTransform = {
            x: transform.x,
            y: transform.y,
            k: transform.k
          };
        }

        // Apply boundary constraints if grid bounds are set
        if (this.gridBounds.width > 0 && this.gridBounds.height > 0) {
          newTransform = constrainToBounds(
            newTransform,
            this.gridBounds,
            this.viewportSize
          );
        }

        // Store current transform for next calculation
        this.currentTransform = newTransform;

        // Apply transform to main group
        mainGroup.attr(
          'transform',
          `translate(${newTransform.x}, ${newTransform.y}) scale(${newTransform.k})`
        );

        // Sync D3's internal transform state to our constrained values
        // This prevents D3 from fighting our constraints on next event
        if (this.svg && this.zoomBehavior) {
          const constrainedD3Transform = d3.zoomIdentity
            .translate(newTransform.x, newTransform.y)
            .scale(newTransform.k);
          this.svg.property('__zoom', constrainedD3Transform);
        }
      });

    (this.svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(this.zoomBehavior);
  }

  /**
   * Programmatically set zoom level (for external controls).
   */
  setZoom(scale: number): void {
    if (!this.svg || !this.d3Module || !this.zoomBehavior) return;

    const newTransform = calculatePinnedZoomTransform(this.currentTransform, scale);
    const constrained = constrainToBounds(newTransform, this.gridBounds, this.viewportSize);

    this.currentTransform = constrained;

    const d3Transform = this.d3Module.zoomIdentity
      .translate(constrained.x, constrained.y)
      .scale(constrained.k);

    this.svg
      .transition()
      .duration(250)
      .call(this.zoomBehavior.transform, d3Transform);
  }

  /**
   * Reset zoom to initial state (scale 1, position 0,0).
   */
  resetZoom(): void {
    this.setZoom(1);
    this.currentTransform = { x: 0, y: 0, k: 1 };

    if (this.svg && this.d3Module && this.zoomBehavior) {
      this.svg
        .transition()
        .duration(250)
        .call(this.zoomBehavior.transform, this.d3Module.zoomIdentity);
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
    onHeaderClick?: (header: HeaderDescriptor) => void;
    onHeaderExpandCollapse?: (header: HeaderDescriptor) => void;
    onHeaderSelectChildren?: (header: HeaderDescriptor) => void;
    onRenderComplete?: (renderTime: number, cellCount: number) => void;
  }): void {
    this.onCellClick = callbacks.onCellClick;
    this.onHeaderClick = callbacks.onHeaderClick;
    this.onHeaderExpandCollapse = callbacks.onHeaderExpandCollapse;
    this.onHeaderSelectChildren = callbacks.onHeaderSelectChildren;
    this.onRenderComplete = callbacks.onRenderComplete;
  }

  /**
   * Render complete grid with headers and cells
   */
  async render(
    currentCells: CellDescriptor[],
    headerTree: HeaderTree,
    gridDimensions: GridDimensions,
    allNodes: Node[]
  ): Promise<void> {
    if (!this.svg) return;

    const startTime = performance.now();

    // Store current state for hit testing
    this.currentColumnHeaders = headerTree.columns;
    this.currentRowHeaders = headerTree.rows;
    this.currentCells = currentCells;

    // Update hit test config with current grid dimensions
    this.hitTestConfig.gridDimensions = gridDimensions;

    // Import d3 for rendering
    const d3 = await import('d3');

    // Render headers
    this.renderHeaders(d3, headerTree, gridDimensions);

    // Render cells
    this.renderCells(d3, currentCells, gridDimensions, allNodes);

    const renderTime = performance.now() - startTime;

    if (this.onRenderComplete) {
      this.onRenderComplete(renderTime, currentCells.length);
    }

    devLogger.render('SuperGridRenderer completed render', {
      cellCount: currentCells.length,
      renderTime
    });
  }

  /**
   * Get fill color based on header level for visual hierarchy.
   * Deeper levels get lighter shades.
   * @internal Reserved for future progressive disclosure feature
   */
  private _getHeaderFillByLevel(level: number): string {
    const fills = ['#e0e0e0', '#ebebeb', '#f5f5f5', '#fafafa'];
    return fills[Math.min(level, fills.length - 1)];
  }

  /**
   * Get font size based on header level.
   * Root headers are larger, deeper levels are smaller.
   * @internal Reserved for future progressive disclosure feature
   */
  private _getHeaderFontSize(level: number): string {
    const sizes = ['13px', '12px', '11px', '10px'];
    return sizes[Math.min(level, sizes.length - 1)];
  }

  /**
   * Render grid headers (columns and rows) using D3 .join() pattern.
   * Supports multi-level nested headers with visual spanning.
   */
  private renderHeaders(
    _d3: typeof import('d3'),
    headerTree: HeaderTree,
    gridDimensions: GridDimensions
  ): void {
    if (!this.svg) return;

    const headersGroup = this.svg.select('.headers');
    const onHeaderClick = this.onHeaderClick;

    // Calculate total header height for multi-level columns
    const totalColumnHeaderHeight = headerTree.maxColumnLevels > 1
      ? gridDimensions.headerHeight
      : gridDimensions.headerHeight;

    // Calculate total header width for multi-level rows
    const totalRowHeaderWidth = headerTree.maxRowLevels > 1
      ? gridDimensions.headerWidth
      : gridDimensions.headerWidth;

    // Column headers - using .join() pattern
    headersGroup
      .selectAll<SVGGElement, HeaderDescriptor>('.column-header')
      .data(headerTree.columns, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'column-header')
            .style('cursor', 'pointer');

          g.append('rect')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1);

          g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('user-select', 'none');

          // Add click handler for header selection
          g.on('click', (_event, d) => {
            if (onHeaderClick) {
              onHeaderClick(d);
            }
          });

          return g;
        },
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => `translate(${d.position.x + totalRowHeaderWidth}, ${d.position.y})`)
      .each(function(d) {
        const g = _d3.select(this);

        g.select('rect')
          .attr('width', d.position.width)
          .attr('height', d.position.height)
          .attr('fill', d.isLeaf ? '#f5f5f5' : '#e8e8e8');

        g.select('text')
          .attr('x', d.position.width / 2)
          .attr('y', d.position.height / 2)
          .style('font-size', d.isLeaf ? '11px' : '12px')
          .style('font-weight', d.isLeaf ? 'normal' : '500')
          .text(d.value);
      });

    // Row headers - using .join() pattern
    headersGroup
      .selectAll<SVGGElement, HeaderDescriptor>('.row-header')
      .data(headerTree.rows, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'row-header')
            .style('cursor', 'pointer');

          g.append('rect')
            .attr('stroke', '#bbb')
            .attr('stroke-width', 1);

          g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('user-select', 'none');

          // Add click handler for header selection
          g.on('click', (_event, d) => {
            if (onHeaderClick) {
              onHeaderClick(d);
            }
          });

          return g;
        },
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => `translate(${d.position.x}, ${d.position.y + totalColumnHeaderHeight})`)
      .each(function(d) {
        const g = _d3.select(this);

        g.select('rect')
          .attr('width', d.position.width)
          .attr('height', d.position.height)
          .attr('fill', d.isLeaf ? '#f5f5f5' : '#e8e8e8');

        g.select('text')
          .attr('x', d.position.width / 2)
          .attr('y', d.position.height / 2)
          .style('font-size', d.isLeaf ? '11px' : '12px')
          .style('font-weight', d.isLeaf ? 'normal' : '500')
          .text(d.value);
      });
  }

  /**
   * Render grid cells with data
   */
  private renderCells(
    _d3: typeof import('d3'),
    currentCells: CellDescriptor[],
    gridDimensions: GridDimensions,
    allNodes: Node[]
  ): void {
    if (!this.svg) return;

    const cellsGroup = this.svg.select('.cells');

    const cells = cellsGroup
      .selectAll<SVGGElement, CellDescriptor>('.cell')
      .data(currentCells, d => d.id);

    const cellEnter = cells.enter()
      .append('g')
      .attr('class', 'cell');

    cellEnter.append('rect')
      .attr('fill', '#ffffff')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    cellEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px');

    // Set up click handlers
    cellEnter
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        if (this.onCellClick) {
          const nodes = allNodes.filter(n => d.nodeIds.includes(n.id));
          this.onCellClick(d, nodes);
        }
      });

    cells.merge(cellEnter)
      .attr('transform', d => `translate(${d.gridX * gridDimensions.cellWidth + gridDimensions.headerWidth}, ${d.gridY * gridDimensions.cellHeight + gridDimensions.headerHeight})`)
      .select('rect')
      .attr('width', gridDimensions.cellWidth - 2)
      .attr('height', gridDimensions.cellHeight - 2);

    cells.merge(cellEnter)
      .select('text')
      .attr('x', gridDimensions.cellWidth / 2)
      .attr('y', gridDimensions.cellHeight / 2)
      .text(d => `${d.nodeCount} items`);

    cells.exit().remove();
  }

  /**
   * Update selection indicators
   */
  async updateSelection(
    currentCells: CellDescriptor[],
    selectionState: SelectionState,
    gridDimensions: GridDimensions
  ): Promise<void> {
    if (!this.svg) return;

    await import('d3');
    const selectionGroup = this.svg.select('.selection');

    // Clear existing selection indicators
    selectionGroup.selectAll('.selection-indicator').remove();

    // Add selection indicators for selected cells
    const selectedCells = currentCells.filter(c => selectionState.selectedCells.has(c.id));

    selectionGroup
      .selectAll('.selection-indicator')
      .data(selectedCells)
      .enter()
      .append('rect')
      .attr('class', 'selection-indicator')
      .attr('x', d => d.gridX * gridDimensions.cellWidth + gridDimensions.headerWidth)
      .attr('y', d => d.gridY * gridDimensions.cellHeight + gridDimensions.headerHeight)
      .attr('width', gridDimensions.cellWidth - 2)
      .attr('height', gridDimensions.cellHeight - 2)
      .attr('fill', 'none')
      .attr('stroke', '#007acc')
      .attr('stroke-width', 2)
      .style('pointer-events', 'none');
  }

  /**
   * Update viewport transform
   */
  updateViewport(x: number, y: number, scale: number): void {
    if (!this.svg) return;

    this.svg.select('.supergrid-main')
      .attr('transform', `translate(${x}, ${y}) scale(${scale})`);
  }

  /**
   * Clean up and remove SVG
   */
  destroy(): void {
    if (this.svg) {
      this.svg.remove();
    }
    this.svg = null;
  }
}