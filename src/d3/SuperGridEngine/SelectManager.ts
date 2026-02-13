/**
 * SelectManager — Handles selection operations for SuperGrid
 *
 * Implements SuperSelect feature: single-click, Cmd+click multi-select,
 * Shift+click range select, and lasso select — all z-layer aware.
 */
import * as d3 from 'd3';
import type { CellDescriptor } from './types';

export interface SelectManagerConfig {
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<string>) => void;
  /** Callback when lasso starts */
  onLassoStart?: () => void;
  /** Callback when lasso ends */
  onLassoEnd?: (selectedIds: string[]) => void;
}

export interface LassoState {
  active: boolean;
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  previewIds: Set<string>;
}

/**
 * Calculate which cells fall within a rectangular range between anchor and target
 */
export function calculateRangeSelection(
  anchorCell: CellDescriptor,
  targetCell: CellDescriptor,
  allCells: CellDescriptor[]
): string[] {
  const minX = Math.min(anchorCell.gridX, targetCell.gridX);
  const maxX = Math.max(anchorCell.gridX, targetCell.gridX);
  const minY = Math.min(anchorCell.gridY, targetCell.gridY);
  const maxY = Math.max(anchorCell.gridY, targetCell.gridY);

  return allCells
    .filter(
      (cell) =>
        cell.gridX >= minX &&
        cell.gridX <= maxX &&
        cell.gridY >= minY &&
        cell.gridY <= maxY
    )
    .map((cell) => cell.id);
}

export class SelectManager {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private config: SelectManagerConfig;
  private selectedIds: Set<string> = new Set();
  private anchorId: string | null = null;
  private lassoState: LassoState | null = null;
  private cells: CellDescriptor[] = [];

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    config: SelectManagerConfig
  ) {
    this.svg = svg;
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): SelectManagerConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelectManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set available cells for range/lasso selection
   */
  setCells(cells: CellDescriptor[]): void {
    this.cells = cells;
  }

  /**
   * Get currently selected IDs
   */
  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

  /**
   * Get the current anchor ID (for range selection)
   */
  getAnchorId(): string | null {
    return this.anchorId;
  }

  /**
   * Check if a specific cell is selected
   */
  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /**
   * Select a single cell, replacing any existing selection
   */
  selectSingle(id: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.anchorId = id;
    this.notifyChange();
  }

  /**
   * Toggle selection of a cell (Cmd+click behavior)
   */
  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.anchorId = id;
    this.notifyChange();
  }

  /**
   * Select a range from anchor to target (Shift+click behavior)
   */
  selectRange(targetId: string): void {
    if (!this.anchorId) return;

    const anchorCell = this.cells.find((c) => c.id === this.anchorId);
    const targetCell = this.cells.find((c) => c.id === targetId);

    if (!anchorCell || !targetCell) return;

    const rangeIds = calculateRangeSelection(anchorCell, targetCell, this.cells);

    this.selectedIds.clear();
    rangeIds.forEach((id) => this.selectedIds.add(id));
    this.notifyChange();
  }

  /**
   * Select multiple cells by ID (header click or lasso result)
   */
  selectMultiple(ids: string[]): void {
    this.selectedIds.clear();
    ids.forEach((id) => this.selectedIds.add(id));
    this.anchorId = null;
    this.notifyChange();
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedIds.clear();
    this.anchorId = null;
    this.notifyChange();
  }

  /**
   * Handle a click event with modifier key detection
   */
  handleClick(cellId: string, event: MouseEvent): void {
    const cmdKey = event.metaKey || event.ctrlKey;

    if (event.shiftKey && this.anchorId) {
      this.selectRange(cellId);
    } else if (cmdKey) {
      this.toggleSelection(cellId);
    } else {
      this.selectSingle(cellId);
    }
  }

  // ========================================================================
  // Lasso Selection
  // ========================================================================

  /**
   * Get current lasso state
   */
  getLassoState(): LassoState | null {
    return this.lassoState;
  }

  /**
   * Start a lasso selection
   */
  startLasso(x: number, y: number): void {
    this.lassoState = {
      active: true,
      startPoint: { x, y },
      currentPoint: { x, y },
      previewIds: new Set(),
    };

    if (this.config.onLassoStart) {
      this.config.onLassoStart();
    }
  }

  /**
   * Update lasso during drag
   */
  updateLasso(x: number, y: number): void {
    if (!this.lassoState) return;

    this.lassoState.currentPoint = { x, y };

    // Calculate preview selection
    const bounds = this.calculateLassoBounds();
    const previewIds = this.cellsInBounds(bounds);
    this.lassoState.previewIds = new Set(previewIds);
  }

  /**
   * End lasso and return selected cell IDs
   */
  endLasso(): string[] {
    if (!this.lassoState) return [];

    const bounds = this.calculateLassoBounds();
    const selectedIds = this.cellsInBounds(bounds);

    // Apply selection
    this.selectMultiple(selectedIds);

    if (this.config.onLassoEnd) {
      this.config.onLassoEnd(selectedIds);
    }

    this.lassoState = null;
    return selectedIds;
  }

  /**
   * Cancel lasso without applying selection
   */
  cancelLasso(): void {
    this.lassoState = null;
  }

  /**
   * Calculate the bounding rectangle of the lasso
   */
  private calculateLassoBounds(): DOMRect {
    if (!this.lassoState) {
      return new DOMRect(0, 0, 0, 0);
    }

    const { startPoint, currentPoint } = this.lassoState;

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    return new DOMRect(x, y, width, height);
  }

  /**
   * Find cells that intersect with the given bounds
   */
  private cellsInBounds(bounds: DOMRect): string[] {
    return this.cells
      .filter((cell) => {
        // Check if cell has position data
        const cellWithPos = cell as CellDescriptor & {
          position?: { x: number; y: number; width: number; height: number };
        };

        if (!cellWithPos.position) {
          // If no position, use grid coordinates (assume 100px cells)
          const cellX = cell.gridX * 100;
          const cellY = cell.gridY * 100;
          const cellWidth = 100;
          const cellHeight = 100;

          return this.rectIntersects(
            bounds,
            new DOMRect(cellX, cellY, cellWidth, cellHeight)
          );
        }

        return this.rectIntersects(
          bounds,
          new DOMRect(
            cellWithPos.position.x,
            cellWithPos.position.y,
            cellWithPos.position.width,
            cellWithPos.position.height
          )
        );
      })
      .map((cell) => cell.id);
  }

  /**
   * Check if two rectangles intersect
   */
  private rectIntersects(a: DOMRect, b: DOMRect): boolean {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  /**
   * Notify config callback of selection change
   */
  private notifyChange(): void {
    this.config.onSelectionChange(new Set(this.selectedIds));
  }

  // ========================================================================
  // Visual Feedback (for lasso rectangle)
  // ========================================================================

  /**
   * Render the lasso rectangle
   */
  renderLassoRect(): void {
    if (!this.lassoState) {
      this.svg.selectAll('.lasso-rect').remove();
      return;
    }

    const bounds = this.calculateLassoBounds();

    const lassoRect = this.svg.selectAll('.lasso-rect').data([bounds]);

    lassoRect
      .join('rect')
      .attr('class', 'lasso-rect')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width)
      .attr('height', (d) => d.height)
      .attr('fill', 'rgba(59, 130, 246, 0.1)')
      .attr('stroke', 'rgba(59, 130, 246, 0.5)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,2')
      .style('pointer-events', 'none');
  }

  /**
   * Remove the lasso rectangle
   */
  removeLassoRect(): void {
    this.svg.selectAll('.lasso-rect').remove();
  }
}
