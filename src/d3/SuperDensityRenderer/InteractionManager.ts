/**
 * SuperDensityRenderer Interaction Manager - Mouse events, tooltips, selection
 */

import * as d3 from 'd3';
import type {
  DensityRenderConfig,
  DensityVisualState,
  RendererComponents,
  DensityAggregatedRow
} from './types';
import { superGridLogger } from '@/utils/logging/dev-logger';

export class InteractionManager {
  private config: DensityRenderConfig;
  private components: RendererComponents;
  private visualState: DensityVisualState;

  // Event callbacks
  private onCellClick?: (row: DensityAggregatedRow) => void;
  private onCellHover?: (row: DensityAggregatedRow | null) => void;
  private onSelectionChange?: (selectedCells: Set<string>) => void;

  constructor(
    config: DensityRenderConfig,
    components: RendererComponents,
    visualState: DensityVisualState
  ) {
    this.config = config;
    this.components = components;
    this.visualState = visualState;
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onCellClick?: (row: DensityAggregatedRow) => void;
    onCellHover?: (row: DensityAggregatedRow | null) => void;
    onSelectionChange?: (selectedCells: Set<string>) => void;
  }): void {
    this.onCellClick = callbacks.onCellClick;
    this.onCellHover = callbacks.onCellHover;
    this.onSelectionChange = callbacks.onSelectionChange;
  }

  /**
   * Setup interaction handlers on cell elements
   */
  setupCellInteractions(cellSelection: d3.Selection<any, DensityAggregatedRow, any, any>): void {
    cellSelection
      .on('mouseenter', (event: MouseEvent, d: DensityAggregatedRow) => {
        this.handleCellMouseEnter(event, d);
      })
      .on('mouseleave', (event: MouseEvent, d: DensityAggregatedRow) => {
        this.handleCellMouseLeave(event, d);
      })
      .on('click', (event: MouseEvent, d: DensityAggregatedRow) => {
        this.handleCellClick(event, d);
      });
  }

  /**
   * Handle mouse enter on cell
   */
  private handleCellMouseEnter(event: MouseEvent, row: DensityAggregatedRow): void {
    if (!this.config.enableHoverDetails) return;

    this.visualState.hoveredCell = row.cellId;

    // Show tooltip
    if (this.components.tooltipDiv) {
      const tooltipContent = this.generateTooltipContent(row);

      this.components.tooltipDiv
        .style('opacity', 1)
        .html(tooltipContent)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    }

    // Trigger callback
    if (this.onCellHover) {
      this.onCellHover(row);
    }

    superGridLogger.debug('Cell hover enter', { action: 'interaction', cellId: row.cellId });
  }

  /**
   * Handle mouse leave on cell
   */
  private handleCellMouseLeave(_event: MouseEvent, _row: DensityAggregatedRow): void {
    this.visualState.hoveredCell = null;

    // Hide tooltip
    if (this.components.tooltipDiv) {
      this.components.tooltipDiv.style('opacity', 0);
    }

    // Trigger callback
    if (this.onCellHover) {
      this.onCellHover(null);
    }
  }

  /**
   * Handle click on cell
   */
  private handleCellClick(_event: MouseEvent, row: DensityAggregatedRow): void {
    // Toggle selection
    if (this.visualState.selectedCells.has(row.cellId)) {
      this.visualState.selectedCells.delete(row.cellId);
    } else {
      this.visualState.selectedCells.add(row.cellId);
    }

    // Update visual selection
    this.updateCellSelection();

    // Trigger callbacks
    if (this.onCellClick) {
      this.onCellClick(row);
    }
    if (this.onSelectionChange) {
      this.onSelectionChange(new Set(this.visualState.selectedCells));
    }

    superGridLogger.debug('Cell clicked', {
      action: 'interaction',
      cellId: row.cellId,
      selectedCount: this.visualState.selectedCells.size
    });
  }

  /**
   * Update cell selection visualization
   */
  private updateCellSelection(): void {
    // Add selection styling to selected cells
    this.components.gridGroup.selectAll('.grid-cells, .matrix-cells, .hybrid-grid-cells, .hybrid-matrix-cells')
      .classed('selected', (d: unknown) => this.visualState.selectedCells.has((d as DensityAggregatedRow).cellId))
      .style('stroke', (d: unknown) => this.visualState.selectedCells.has((d as DensityAggregatedRow).cellId) ? '#007acc' : '#ffffff')
      .style('stroke-width', (d: unknown) => this.visualState.selectedCells.has((d as DensityAggregatedRow).cellId) ? 3 : 1);
  }

  /**
   * Generate tooltip content for a cell
   */
  private generateTooltipContent(row: DensityAggregatedRow): string {
    const parts = [
      `<div class="tooltip-title">Cell (${row.x}, ${row.y})</div>`,
      `<div class="tooltip-field">Items: ${row.aggregationCount}</div>`
    ];

    if (row.label) {
      parts.push(`<div class="tooltip-field">Label: ${row.label}</div>`);
    }

    parts.push(`<div class="tooltip-field">Density: ${((row.sparsityRatio ?? 0) * 100).toFixed(1)}%</div>`);

    if (row.metadata?.totalValue !== undefined) {
      parts.push(`<div class="tooltip-field">Total: ${row.metadata.totalValue}</div>`);
    }

    if (row.metadata?.averageValue !== undefined) {
      parts.push(`<div class="tooltip-field">Average: ${row.metadata.averageValue.toFixed(2)}</div>`);
    }

    return parts.join('');
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.visualState.selectedCells.clear();
    this.updateCellSelection();

    if (this.onSelectionChange) {
      this.onSelectionChange(new Set());
    }
  }

  /**
   * Select multiple cells
   */
  selectCells(cellIds: string[]): void {
    cellIds.forEach(id => this.visualState.selectedCells.add(id));
    this.updateCellSelection();

    if (this.onSelectionChange) {
      this.onSelectionChange(new Set(this.visualState.selectedCells));
    }
  }

  /**
   * Get currently selected cells
   */
  getSelectedCells(): Set<string> {
    return new Set(this.visualState.selectedCells);
  }

  /**
   * Get currently hovered cell
   */
  getHoveredCell(): string | null {
    return this.visualState.hoveredCell;
  }
}