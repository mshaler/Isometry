/**
 * GridSqlHeaderAdapter - Coordinates SQL-driven header rendering
 *
 * This adapter bridges the HeaderDiscoveryService (SQL data) with the existing
 * NestedHeaderRenderer (D3 rendering) without modifying the oversized GridRenderingEngine.
 * Uses NestedHeaderRenderer directly since GridRenderingEngine.renderNestedAxisHeaders is private.
 *
 * Why this adapter exists:
 * - GridRenderingEngine.ts is 2014 lines (exceeds 500-line structural limit)
 * - renderNestedAxisHeaders method is PRIVATE in GridRenderingEngine
 * - NestedHeaderRenderer is exported and has public render() method
 * - Avoids modifying oversized engine class
 *
 * Phase 90-02: Tree Builder from Query Results
 */

import type { HeaderTree, HeaderNode } from '../../superstack/types/superstack';
import { NestedHeaderRenderer } from './NestedHeaderRenderer';
import type { NestedHeaderConfig, NestedHeaderData } from './NestedHeaderRenderer';
import { superGridLogger } from '../../utils/dev-logger';
import * as d3 from 'd3';

/**
 * Configuration for GridSqlHeaderAdapter.
 * Subset of NestedHeaderConfig with sensible defaults.
 */
export interface SqlHeaderAdapterConfig {
  rowHeaderWidth: number;
  headerHeight: number;
  cellWidth: number;
  cellHeight: number;
  padding?: number;
  animationDuration?: number;
  /** Callback when header collapse state is toggled */
  onHeaderToggle?: (headerId: string, collapsed: boolean) => void;
  /** Callback when header is clicked for filtering */
  onHeaderFilter?: (node: HeaderNode) => void;
  /** Callback when header is selected (visual highlight) */
  onHeaderSelect?: (nodeId: string | null) => void;
}

/**
 * Adapter that coordinates SQL-driven header trees with D3 rendering.
 * Instantiates NestedHeaderRenderer and feeds it HeaderTree data.
 */
export class GridSqlHeaderAdapter {
  private nestedHeaderRenderer: NestedHeaderRenderer;
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: SqlHeaderAdapterConfig;

  private columnHeaderTree: HeaderTree | null = null;
  private rowHeaderTree: HeaderTree | null = null;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: SqlHeaderAdapterConfig
  ) {
    this.container = container;
    this.config = config;

    // Instantiate NestedHeaderRenderer directly (exported class)
    const rendererConfig: NestedHeaderConfig = {
      rowHeaderWidth: config.rowHeaderWidth,
      headerHeight: config.headerHeight,
      cardWidth: config.cellWidth,
      cardHeight: config.cellHeight,
      padding: config.padding ?? 4,
      animationDuration: config.animationDuration ?? 300,
    };

    this.nestedHeaderRenderer = new NestedHeaderRenderer(
      container,
      rendererConfig
    );
  }

  /**
   * Set column header tree from SQL discovery.
   */
  public setColumnHeaderTree(tree: HeaderTree | null): void {
    this.columnHeaderTree = tree;
    superGridLogger.debug('[GridSqlHeaderAdapter] Column header tree set', {
      leafCount: tree?.leafCount ?? 0,
      maxDepth: tree?.maxDepth ?? 0,
    });
  }

  /**
   * Set row header tree from SQL discovery.
   */
  public setRowHeaderTree(tree: HeaderTree | null): void {
    this.rowHeaderTree = tree;
    superGridLogger.debug('[GridSqlHeaderAdapter] Row header tree set', {
      leafCount: tree?.leafCount ?? 0,
      maxDepth: tree?.maxDepth ?? 0,
    });
  }

  /**
   * Check if SQL-driven header trees are available.
   */
  public hasSqlDrivenHeaders(): boolean {
    return this.columnHeaderTree !== null || this.rowHeaderTree !== null;
  }

  /**
   * Render SQL-driven headers (called by SuperGrid component).
   * Handles empty datasets with graceful UI (SQL-05).
   */
  public renderSqlDrivenHeaders(): void {
    const headerContainer = this.container.select('.headers');
    headerContainer.selectAll('*').remove();

    // Empty state handling (SQL-05)
    if (this.isEmptyDataset()) {
      this.renderEmptyHeaderState(headerContainer);
      return;
    }

    // Use NestedHeaderRenderer directly (not engine's private method)
    if (this.columnHeaderTree && this.columnHeaderTree.leafCount > 0) {
      const compositeKeys = this.columnHeaderTree.leaves.map((leaf) =>
        leaf.path.join('|')
      );
      this.nestedHeaderRenderer.render('x', compositeKeys);
    }

    if (this.rowHeaderTree && this.rowHeaderTree.leafCount > 0) {
      const compositeKeys = this.rowHeaderTree.leaves.map((leaf) =>
        leaf.path.join('|')
      );
      this.nestedHeaderRenderer.render('y', compositeKeys);
    }

    superGridLogger.debug('[GridSqlHeaderAdapter] SQL-driven headers rendered', {
      columns: this.columnHeaderTree?.leafCount ?? 0,
      rows: this.rowHeaderTree?.leafCount ?? 0,
    });

    // Attach event handlers after rendering
    this.attachHeaderEventHandlers();
  }

  /**
   * Attach click event handlers to all header elements.
   * Must be called AFTER renderSqlDrivenHeaders().
   *
   * Click handling:
   * - Click on collapse icon (.collapse-icon) -> toggles collapse
   * - Click elsewhere on header -> selects and filters
   */
  public attachHeaderEventHandlers(): void {
    const container = this.container;

    // Select all header groups (both row and column)
    const headers = container.selectAll('.row-header, .col-header');

    headers.on('click', (event: MouseEvent) => {
      event.stopPropagation();

      // Get the header data from the element
      const target = event.currentTarget as SVGGElement;
      const selection = d3.select(target);
      const headerData = selection.datum() as NestedHeaderData | undefined;

      if (!headerData) return;

      const headerId = headerData.key;

      // Determine click intent based on target
      // For now: all clicks go to filter (collapse icons not yet rendered)
      // Future: detect .collapse-icon class on event.target

      // Map NestedHeaderData back to HeaderNode for filter callback
      const node = this.findHeaderNodeByKey(headerId);
      if (node) {
        // Select this header
        this.config.onHeaderSelect?.(headerId);
        // Trigger filter callback
        this.config.onHeaderFilter?.(node);
      }

      superGridLogger.debug('[GridSqlHeaderAdapter] Header clicked', {
        headerId,
        nodeFound: !!node,
      });
    });
  }

  /**
   * Find HeaderNode from key (path-based lookup in stored trees).
   * Key format from NestedHeaderRenderer: "{axis}_{level}_{pathJoinedByPipe}"
   */
  private findHeaderNodeByKey(key: string): HeaderNode | null {
    // Key format: "x_0_Work" or "y_1_Work|Active"
    const isColumn = key.startsWith('x_');
    const tree = isColumn ? this.columnHeaderTree : this.rowHeaderTree;
    if (!tree) return null;

    // Extract the path portion from key: skip axis prefix and level
    // "x_0_Work" -> "Work", "y_1_Work|Active" -> "Work|Active"
    const keyParts = key.split('_');
    if (keyParts.length < 3) return null;

    // Rejoin everything after axis and level (handles values containing underscores)
    const pathPart = keyParts.slice(2).join('_');
    const pathSegments = pathPart.split('|');

    return this.searchTreeByPath(tree.roots, pathSegments);
  }

  /**
   * Search tree for node matching path segments.
   */
  private searchTreeByPath(nodes: HeaderNode[], pathParts: string[]): HeaderNode | null {
    if (pathParts.length === 0) return null;

    for (const node of nodes) {
      if (node.value === pathParts[0]) {
        // If this is the last path segment, we found our node
        if (pathParts.length === 1) return node;
        // Otherwise, search children for remaining path
        return this.searchTreeByPath(node.children, pathParts.slice(1));
      }
    }
    return null;
  }

  /**
   * Update visual highlight for selected header.
   * Adds 'selected' class and updates stroke styling.
   */
  public updateSelectedHeader(selectedId: string | null): void {
    this.container.selectAll('.row-header, .col-header')
      .classed('selected', function() {
        const data = d3.select(this).datum() as NestedHeaderData | undefined;
        return data?.key === selectedId;
      })
      .select('rect')
      .attr('stroke', function() {
        const parent = d3.select((this as SVGRectElement).parentElement);
        const data = parent.datum() as NestedHeaderData | undefined;
        return data?.key === selectedId ? '#2563eb' : '#cbd5e1';
      })
      .attr('stroke-width', function() {
        const parent = d3.select((this as SVGRectElement).parentElement);
        const data = parent.datum() as NestedHeaderData | undefined;
        return data?.key === selectedId ? 2 : 1;
      });
  }

  /**
   * Check if both trees are empty (no data for selected axes).
   */
  private isEmptyDataset(): boolean {
    const colEmpty =
      !this.columnHeaderTree || this.columnHeaderTree.leafCount === 0;
    const rowEmpty = !this.rowHeaderTree || this.rowHeaderTree.leafCount === 0;
    return colEmpty && rowEmpty;
  }

  /**
   * Render empty state message when no data available (SQL-05).
   */
  private renderEmptyHeaderState(
    container: d3.Selection<d3.BaseType, unknown, null, undefined>
  ): void {
    const g = container
      .append('g')
      .attr('class', 'empty-state')
      .attr(
        'transform',
        `translate(${this.config.rowHeaderWidth + 20}, ${this.config.headerHeight / 2})`
      );

    g.append('text')
      .attr('class', 'empty-state-text')
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .attr('fill', '#9ca3af')
      .text('No data for selected axes');

    superGridLogger.debug('[GridSqlHeaderAdapter] Empty state rendered');
  }
}
