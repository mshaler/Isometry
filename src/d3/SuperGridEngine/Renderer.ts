/**
 * SuperGridEngine Renderer - Handles D3.js rendering of grids
 *
 * SuperZoom: Pinned upper-left anchor for spreadsheet-like zoom behavior.
 * - Scroll wheel zoom anchors to (0,0) instead of cursor position
 * - Pan constrained to grid boundaries (can't scroll past edges)
 *
 * SuperSize: Column/row resize via drag handles.
 * - Drag right edge of header to resize single column
 * - Shift+drag for bulk resize of siblings
 * - Double-click resize edge for auto-fit to content
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
import { DragManager, type DragManagerConfig } from './DragManager';
import { ResizeManager, type ResizeManagerConfig } from './ResizeManager';
import { SelectManager, type SelectManagerConfig } from './SelectManager';
import { SortManager, type SortLevel } from './SortManager';
import { FilterManager } from './FilterManager';
import { AuditRenderer } from './AuditRenderer';

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

  // DragManager for axis repositioning (SuperDynamic)
  private dragManager: DragManager | null = null;
  private onAxisSwap?: (fromAxis: 'x' | 'y', toAxis: 'x' | 'y') => void;

  // ResizeManager for column/row resizing (SuperSize)
  private resizeManager: ResizeManager | null = null;
  private onResize?: (headerId: string, newWidth: number) => void;
  private onResizeEnd?: (headerId: string, finalWidth: number) => void;
  private resizeMouseMoveHandler: ((event: MouseEvent) => void) | null = null;
  private resizeMouseUpHandler: (() => void) | null = null;

  // SelectManager for multi-selection (SuperSelect)
  private selectManager: SelectManager | null = null;
  private onSelectionChange?: (selectedIds: Set<string>) => void;
  private isSelected: (id: string) => boolean = () => false;

  // SortManager for multi-level sorting (SuperSort)
  private sortManager: SortManager | null = null;
  private onSortChange?: (sortState: { levels: SortLevel[] }) => void;

  // FilterManager for header filtering (SuperFilter)
  private filterManager: FilterManager | null = null;
  private onFilterIconClick?: (header: HeaderDescriptor) => void;

  // AuditRenderer for computed value highlighting (SuperAudit)
  private auditRenderer: AuditRenderer | null = null;

  // Event callbacks
  private onCellClick?: (cell: CellDescriptor, nodes: Node[]) => void;
  private onCellClickWithEvent?: (cell: CellDescriptor, nodes: Node[], event: MouseEvent) => void;
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
    filterIconSize: 16,
    filterIconPadding: 4,
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

    // Set up keyboard handler for drag cancellation
    this.setupKeyboardHandler();
  }

  /**
   * Set up keyboard handler for escape key drag cancellation.
   */
  private setupKeyboardHandler(): void {
    // Add global keydown listener for escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Handle keydown events for drag cancellation.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.dragManager?.isDragging()) {
        this.dragManager.cancelDrag();
      }
      if (this.resizeManager?.isResizing()) {
        this.resizeManager.cancelResize();
      }
    }
  };

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
    onCellClickWithEvent?: (cell: CellDescriptor, nodes: Node[], event: MouseEvent) => void;
    onHeaderClick?: (header: HeaderDescriptor) => void;
    onHeaderExpandCollapse?: (header: HeaderDescriptor) => void;
    onHeaderSelectChildren?: (header: HeaderDescriptor) => void;
    onRenderComplete?: (renderTime: number, cellCount: number) => void;
    onAxisSwap?: (fromAxis: 'x' | 'y', toAxis: 'x' | 'y') => void;
    onResize?: (headerId: string, newWidth: number) => void;
    onResizeEnd?: (headerId: string, finalWidth: number) => void;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    isSelected?: (id: string) => boolean;
    onSortChange?: (sortState: { levels: SortLevel[] }) => void;
    onFilterIconClick?: (header: HeaderDescriptor) => void;
  }): void {
    this.onCellClick = callbacks.onCellClick;
    this.onCellClickWithEvent = callbacks.onCellClickWithEvent;
    this.onHeaderClick = callbacks.onHeaderClick;
    this.onHeaderExpandCollapse = callbacks.onHeaderExpandCollapse;
    this.onHeaderSelectChildren = callbacks.onHeaderSelectChildren;
    this.onRenderComplete = callbacks.onRenderComplete;
    this.onAxisSwap = callbacks.onAxisSwap;
    this.onResize = callbacks.onResize;
    this.onResizeEnd = callbacks.onResizeEnd;
    this.onSelectionChange = callbacks.onSelectionChange;
    this.isSelected = callbacks.isSelected ?? (() => false);
    this.onSortChange = callbacks.onSortChange;
    this.onFilterIconClick = callbacks.onFilterIconClick;
  }

  /**
   * Set up DragManager for SuperDynamic axis repositioning.
   * Call after SVG is set up and grid dimensions are known.
   */
  setupDragManager(gridDimensions: GridDimensions): void {
    if (!this.svg) return;

    const config: DragManagerConfig = {
      headerHeight: gridDimensions.headerHeight,
      rowHeaderWidth: gridDimensions.headerWidth,
      onAxisSwap: (fromAxis, toAxis) => {
        if (this.onAxisSwap) {
          this.onAxisSwap(fromAxis, toAxis);
        }
      },
    };

    this.dragManager = new DragManager(this.svg, config);

    // Set up drag on both column and row headers
    this.dragManager.setupHeaderDrag('.column-header');
    this.dragManager.setupHeaderDrag('.row-header');
  }

  /**
   * Update DragManager configuration when grid dimensions change.
   */
  updateDragManagerConfig(gridDimensions: GridDimensions): void {
    if (!this.dragManager) return;

    this.dragManager.updateConfig({
      headerHeight: gridDimensions.headerHeight,
      rowHeaderWidth: gridDimensions.headerWidth,
    });
  }

  /**
   * Set up ResizeManager for SuperSize column/row resizing.
   * Call after SVG is set up.
   */
  setupResizeManager(): void {
    if (!this.svg) return;

    const config: ResizeManagerConfig = {
      minSize: 40,
      onResize: (headerId, newWidth) => {
        if (this.onResize) {
          this.onResize(headerId, newWidth);
        }
      },
      onResizeEnd: (headerId, finalWidth) => {
        if (this.onResizeEnd) {
          this.onResizeEnd(headerId, finalWidth);
        }
      },
    };

    this.resizeManager = new ResizeManager(this.svg, config);

    // Set up resize event handlers on SVG
    this.setupResizeEventHandlers();
  }

  /**
   * Set up SelectManager for SuperSelect multi-selection.
   * Call after SVG is set up.
   */
  setupSelectManager(): void {
    if (!this.svg) return;

    const config: SelectManagerConfig = {
      onSelectionChange: (selectedIds) => {
        if (this.onSelectionChange) {
          this.onSelectionChange(selectedIds);
        }
      },
      onLassoStart: () => {
        // Optional: visual feedback when lasso starts
      },
      onLassoEnd: (selectedIds) => {
        if (this.onSelectionChange) {
          this.onSelectionChange(new Set(selectedIds));
        }
      },
    };

    this.selectManager = new SelectManager(this.svg, config);
  }

  /**
   * Get the SelectManager instance for external access.
   */
  getSelectManager(): SelectManager | null {
    return this.selectManager;
  }

  /**
   * Set the SortManager instance for SuperSort functionality.
   * Call this before rendering to enable sort indicators.
   */
  setSortManager(sortManager: SortManager): void {
    this.sortManager = sortManager;
  }

  /**
   * Get the SortManager instance for external access.
   */
  getSortManager(): SortManager | null {
    return this.sortManager;
  }

  /**
   * Set the FilterManager instance for SuperFilter functionality.
   * Call this before rendering to enable filter icons.
   */
  setFilterManager(filterManager: FilterManager): void {
    this.filterManager = filterManager;
  }

  /**
   * Get the FilterManager instance for external access.
   */
  getFilterManager(): FilterManager | null {
    return this.filterManager;
  }

  /**
   * Set the AuditRenderer instance for SuperAudit functionality.
   * Call this before rendering to enable audit overlays.
   */
  setAuditRenderer(auditRenderer: AuditRenderer): void {
    this.auditRenderer = auditRenderer;
  }

  /**
   * Get the AuditRenderer instance for external access.
   */
  getAuditRenderer(): AuditRenderer | null {
    return this.auditRenderer;
  }

  /**
   * Set up resize event handlers for mousedown, mousemove, mouseup, and dblclick.
   */
  private setupResizeEventHandlers(): void {
    if (!this.svg) return;

    const svgElement = this.svg.node();
    if (!svgElement) return;

    // Handle mousedown on resize-edge zone to start resize
    svgElement.addEventListener('mousedown', (event: MouseEvent) => {
      if (!this.resizeManager) return;

      const rect = svgElement.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const result = hitTest(
        point,
        this.currentColumnHeaders,
        this.currentRowHeaders,
        this.currentCells,
        this.hitTestConfig
      );

      if (result.zone === 'resize-edge' && result.header) {
        this.resizeManager.startResize(result.header, event);
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // Handle global mousemove during resize (to track outside SVG)
    this.resizeMouseMoveHandler = (event: MouseEvent) => {
      if (this.resizeManager?.isResizing()) {
        this.resizeManager.updateResize(event);
      }
    };

    // Handle global mouseup to end resize
    this.resizeMouseUpHandler = () => {
      if (this.resizeManager?.isResizing()) {
        this.resizeManager.endResize();
      }
    };

    // Add global listeners for mouse tracking during resize
    document.addEventListener('mousemove', this.resizeMouseMoveHandler);
    document.addEventListener('mouseup', this.resizeMouseUpHandler);

    // Handle double-click for auto-fit
    svgElement.addEventListener('dblclick', (event: MouseEvent) => {
      if (!this.resizeManager) return;

      const rect = svgElement.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const result = hitTest(
        point,
        this.currentColumnHeaders,
        this.currentRowHeaders,
        this.currentCells,
        this.hitTestConfig
      );

      if (result.zone === 'resize-edge' && result.header) {
        // Calculate auto-fit width
        const measureText = this.resizeManager.createTextMeasurer();
        const autoFitWidth = this.resizeManager.calculateAutoFitWidth(
          result.header,
          this.currentCells,
          measureText
        );
        this.resizeManager.cleanupMeasurer();

        // Notify callback with auto-fit result
        if (this.onResizeEnd) {
          this.onResizeEnd(result.header.id, autoFitWidth);
        }

        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  /**
   * Get the ResizeManager instance for external access.
   */
  getResizeManager(): ResizeManager | null {
    return this.resizeManager;
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

  // Reserved for future progressive disclosure feature:
  // _getHeaderFillByLevel(level): fills by depth level
  // _getHeaderFontSize(level): font sizes by depth level

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
    const sortManager = this.sortManager;
    const onSortChange = this.onSortChange;

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

          // Add click handler for sort and selection
          g.on('click', (event: MouseEvent, d: HeaderDescriptor) => {
            // Handle sort with SortManager if available
            if (sortManager && d.facet) {
              const newState = sortManager.handleHeaderClick(
                d.id,
                d.axis,
                d.facet,
                event.shiftKey
              );
              if (onSortChange) {
                onSortChange(newState);
              }
            }
            // Also call onHeaderClick for selection behavior
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

    // Render sort indicators for column headers
    this.renderSortIndicators(_d3, headersGroup, headerTree.columns);

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

          // Add click handler for sort and selection
          g.on('click', (event: MouseEvent, d: HeaderDescriptor) => {
            // Handle sort with SortManager if available
            if (sortManager && d.facet) {
              const newState = sortManager.handleHeaderClick(
                d.id,
                d.axis,
                d.facet,
                event.shiftKey
              );
              if (onSortChange) {
                onSortChange(newState);
              }
            }
            // Also call onHeaderClick for selection behavior
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

    // Render sort indicators for row headers
    this.renderSortIndicators(_d3, headersGroup, headerTree.rows);

    // Render filter icons for both column and row headers
    this.renderFilterIcons(_d3, headersGroup, headerTree.columns, 'column');
    this.renderFilterIcons(_d3, headersGroup, headerTree.rows, 'row');
  }

  /**
   * Render sort indicators (arrows and priority badges) on sorted headers.
   *
   * SuperSort visual indicators:
   * - Arrow shows sort direction (up for asc, down for desc)
   * - Priority badge (1, 2, 3) shown for multi-sort
   */
  private renderSortIndicators(
    _d3: typeof import('d3'),
    headersGroup: d3.Selection<d3.BaseType, unknown, null, undefined>,
    headers: HeaderDescriptor[]
  ): void {
    if (!this.sortManager) return;

    const sortManager = this.sortManager;
    const sortCount = sortManager.getSortCount();

    // Update each header with sort indicator
    headers.forEach(header => {
      const sortLevel = sortManager.getSortLevel(header.id);
      const isColumnHeader = header.id.startsWith('column_');
      const headerSelector = isColumnHeader ? '.column-header' : '.row-header';

      // Find the header group element
      const headerGroup = headersGroup
        .selectAll<SVGGElement, HeaderDescriptor>(headerSelector)
        .filter(d => d.id === header.id);

      // Remove existing sort indicator
      headerGroup.selectAll('.sort-indicator').remove();

      if (!sortLevel) return;

      // Create sort indicator group
      const indicator = headerGroup.append('g')
        .attr('class', 'sort-indicator')
        .attr('transform', `translate(${header.position.width - 24}, 6)`);

      // Draw arrow based on direction
      const arrowPath = sortLevel.direction === 'asc'
        ? 'M0,6 L4,0 L8,6 Z'    // Up arrow (ascending)
        : 'M0,0 L4,6 L8,0 Z';   // Down arrow (descending)

      indicator.append('path')
        .attr('d', arrowPath)
        .attr('fill', '#3B82F6')  // Blue color
        .attr('stroke', 'none');

      // Add priority badge for multi-sort (only if more than one sort)
      if (sortCount > 1) {
        // Badge circle
        indicator.append('circle')
          .attr('cx', 16)
          .attr('cy', 3)
          .attr('r', 6)
          .attr('fill', '#3B82F6');

        // Badge number
        indicator.append('text')
          .attr('x', 16)
          .attr('y', 6)
          .attr('text-anchor', 'middle')
          .attr('fill', 'white')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .text(sortLevel.priority.toString());
      }
    });
  }

  /**
   * Render filter icons (funnel) on headers for SuperFilter.
   *
   * Filter icons are positioned in the top-right corner of each header.
   * Active filters (not all values selected) show the icon in blue.
   * Inactive filters show a gray funnel icon.
   *
   * @param _d3 - D3 module
   * @param headersGroup - D3 selection for headers group
   * @param headers - Array of header descriptors
   * @param headerType - 'column' or 'row' to determine CSS class
   */
  private renderFilterIcons(
    _d3: typeof import('d3'),
    headersGroup: d3.Selection<d3.BaseType, unknown, null, undefined>,
    headers: HeaderDescriptor[],
    headerType: 'column' | 'row'
  ): void {
    const filterManager = this.filterManager;
    const onFilterIconClick = this.onFilterIconClick;

    // Filter icon dimensions and position
    const iconSize = 16;
    const iconPadding = 4;

    // Funnel icon path (simplified filter funnel shape)
    const funnelPath = 'M1,0 L15,0 L10,6 L10,14 L6,14 L6,6 Z';

    // Update each header with filter icon
    headers.forEach(header => {
      const headerSelector = headerType === 'column' ? '.column-header' : '.row-header';

      // Find the header group element
      const headerGroup = headersGroup
        .selectAll<SVGGElement, HeaderDescriptor>(headerSelector)
        .filter(d => d.id === header.id);

      // Remove existing filter icon
      headerGroup.selectAll('.filter-icon').remove();

      // Calculate if this header has an active filter
      const hasActiveFilter = filterManager?.hasActiveFilter(header.id) ?? false;

      // Create filter icon group
      const iconGroup = headerGroup.append('g')
        .attr('class', 'filter-icon')
        .attr('transform', `translate(${header.position.width - iconPadding - iconSize}, ${iconPadding})`)
        .style('cursor', 'pointer');

      // Add hover highlight background
      iconGroup.append('rect')
        .attr('class', 'filter-icon-bg')
        .attr('width', iconSize)
        .attr('height', iconSize)
        .attr('rx', 2)
        .attr('fill', 'transparent');

      // Draw funnel icon
      iconGroup.append('path')
        .attr('class', 'filter-icon-path')
        .attr('d', funnelPath)
        .attr('fill', hasActiveFilter ? '#3B82F6' : '#9CA3AF')  // Blue if active, gray if not
        .attr('stroke', 'none');

      // Add click handler for filter icon
      iconGroup.on('click', (event: MouseEvent) => {
        event.stopPropagation(); // Prevent header click
        if (onFilterIconClick) {
          onFilterIconClick(header);
        }
      });

      // Add hover effect
      iconGroup
        .on('mouseenter', function() {
          _d3.select(this).select('.filter-icon-bg')
            .attr('fill', 'rgba(59, 130, 246, 0.1)');
        })
        .on('mouseleave', function() {
          _d3.select(this).select('.filter-icon-bg')
            .attr('fill', 'transparent');
        });
    });
  }

  /**
   * Render grid cells with data and selection checkboxes
   *
   * SuperSelect: Each cell includes a checkbox for selection.
   * Click handling respects modifier keys:
   * - Plain click: select single (replaces selection)
   * - Cmd/Ctrl+click: toggle selection (add/remove)
   * - Shift+click: range select from anchor to target
   */
  private renderCells(
    _d3: typeof import('d3'),
    currentCells: CellDescriptor[],
    gridDimensions: GridDimensions,
    allNodes: Node[]
  ): void {
    if (!this.svg) return;

    const cellsGroup = this.svg.select('.cells');
    const isSelected = this.isSelected;

    const cells = cellsGroup
      .selectAll<SVGGElement, CellDescriptor>('.cell')
      .data(currentCells, d => d.id);

    const cellEnter = cells.enter()
      .append('g')
      .attr('class', 'cell');

    // Cell background rect
    cellEnter.append('rect')
      .attr('class', 'cell-bg')
      .attr('fill', '#ffffff')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1);

    // Audit overlay (SuperAudit) - tint for computed/enriched/formula cells
    cellEnter.append('rect')
      .attr('class', 'audit-overlay')
      .attr('fill', 'transparent')
      .attr('pointer-events', 'none');

    // Audit indicator dot (SuperAudit) - corner indicator for computed cells
    cellEnter.append('circle')
      .attr('class', 'audit-indicator')
      .attr('r', 3)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'none');

    // CRUD flash overlay (SuperAudit) - animated flash for create/update/delete
    cellEnter.append('rect')
      .attr('class', 'crud-flash')
      .attr('fill', 'transparent')
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    // Cell text
    cellEnter.append('text')
      .attr('class', 'cell-text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px');

    // Selection checkbox group
    const checkboxGroup = cellEnter.append('g')
      .attr('class', 'cell-checkbox')
      .attr('transform', 'translate(4, 4)');

    // Checkbox background
    checkboxGroup.append('rect')
      .attr('class', 'checkbox-bg')
      .attr('width', 14)
      .attr('height', 14)
      .attr('rx', 2)
      .attr('stroke', '#999')
      .attr('stroke-width', 1);

    // Checkbox checkmark (hidden by default)
    checkboxGroup.append('path')
      .attr('class', 'checkbox-mark')
      .attr('d', 'M3,7 L6,10 L11,4')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

    // Set up click handlers with modifier key detection
    cellEnter
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: CellDescriptor) => {
        // Call enhanced handler with event for modifier key detection
        if (this.onCellClickWithEvent) {
          const nodes = allNodes.filter(n => d.nodeIds.includes(n.id));
          this.onCellClickWithEvent(d, nodes, event);
        } else if (this.onCellClick) {
          // Fallback to basic handler
          const nodes = allNodes.filter(n => d.nodeIds.includes(n.id));
          this.onCellClick(d, nodes);
        }
      });

    // Update all cells (enter + update)
    const cellsAll = cells.merge(cellEnter);

    cellsAll
      .attr('transform', d => `translate(${d.gridX * gridDimensions.cellWidth + gridDimensions.headerWidth}, ${d.gridY * gridDimensions.cellHeight + gridDimensions.headerHeight})`);

    // Update background
    cellsAll.select('.cell-bg')
      .attr('width', gridDimensions.cellWidth - 2)
      .attr('height', gridDimensions.cellHeight - 2);

    // Update text
    cellsAll.select('.cell-text')
      .attr('x', gridDimensions.cellWidth / 2)
      .attr('y', gridDimensions.cellHeight / 2)
      .text(d => `${d.nodeCount} items`);

    // Update checkbox state
    cellsAll.select('.checkbox-bg')
      .attr('fill', d => isSelected(d.id) ? '#4a90d9' : '#fff');

    cellsAll.select('.checkbox-mark')
      .style('opacity', d => isSelected(d.id) ? 1 : 0);

    // Update audit overlays (SuperAudit)
    const auditRenderer = this.auditRenderer;
    if (auditRenderer) {
      // Update audit overlay tint
      cellsAll.select('.audit-overlay')
        .attr('width', gridDimensions.cellWidth - 2)
        .attr('height', gridDimensions.cellHeight - 2)
        .attr('fill', d => auditRenderer.shouldRenderOverlay(d.id)
          ? auditRenderer.getOverlayColor(d.id)
          : 'transparent'
        );

      // Update audit indicator dot
      cellsAll.select('.audit-indicator')
        .attr('cx', 8)
        .attr('cy', 8)
        .attr('fill', d => auditRenderer.shouldRenderOverlay(d.id)
          ? auditRenderer.getCellIndicatorColor(d.id)
          : 'transparent'
        );

      // Update CRUD flash overlay
      cellsAll.select('.crud-flash')
        .attr('width', gridDimensions.cellWidth - 2)
        .attr('height', gridDimensions.cellHeight - 2)
        .each(function(d) {
          const flashColor = auditRenderer.getFlashColor(d.id);
          if (flashColor) {
            // Trigger flash animation
            _d3.select(this)
              .attr('fill', flashColor)
              .attr('opacity', 0.4)
              .transition()
              .duration(500)
              .attr('opacity', 0)
              .on('end', function() {
                _d3.select(this).attr('fill', 'transparent');
              });
          }
        });
    }

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
    // Remove keyboard handler
    document.removeEventListener('keydown', this.handleKeyDown);

    // Remove resize event handlers
    if (this.resizeMouseMoveHandler) {
      document.removeEventListener('mousemove', this.resizeMouseMoveHandler);
    }
    if (this.resizeMouseUpHandler) {
      document.removeEventListener('mouseup', this.resizeMouseUpHandler);
    }

    // Clean up managers
    this.dragManager = null;
    this.resizeManager = null;
    this.selectManager = null;

    if (this.svg) {
      this.svg.remove();
    }
    this.svg = null;
  }
}
