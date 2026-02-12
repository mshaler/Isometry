/**
 * GridRenderingEngine - Handles all grid visualization and rendering
 *
 * Extracted from SuperGrid.ts to manage card rendering, header rendering,
 * and grid structure setup.
 */

import * as d3 from 'd3';
import type {
  GridData,
} from '../../types/grid-core';
import type {
  PAFVProjection,
  GridHeaders,
} from '../../types/grid';
import type { EncodingConfig } from '../../types/pafv';
import { SuperGridHeaders, type HeaderClickEvent } from '../SuperGridHeaders';
import { HeaderLayoutService } from '../../services/supergrid/HeaderLayoutService';
import { superGridLogger } from '../../utils/dev-logger';

export interface RenderingConfig {
  cardWidth: number;
  cardHeight: number;
  padding: number;
  headerHeight: number;
  rowHeaderWidth: number;
  enableHeaders: boolean;
  enableAnimations: boolean;
  animationDuration: number;
}

export interface RenderingCallbacks {
  onHeaderClick?: (event: HeaderClickEvent) => void;
  onCardRender?: (selection: d3.Selection<any, any, any, any>) => void;
  onGridResize?: (width: number, height: number) => void;
}

export class GridRenderingEngine {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: RenderingConfig;
  private callbacks: RenderingCallbacks;

  // Header system
  private superGridHeaders: SuperGridHeaders | null = null;
  private headerLayoutService: HeaderLayoutService;

  // Current rendering state
  private currentData: GridData | null = null;
  private currentProjection: PAFVProjection | null = null;
  private currentHeaders: GridHeaders | null = null;
  private isHeadersInitialized = false;

  // Encoding state
  private colorEncoding: EncodingConfig | null = null;
  private sizeEncoding: EncodingConfig | null = null;

  // Color scales for encoding
  private colorScale: d3.ScaleOrdinal<string, string> | d3.ScaleSequential<string> | null = null;

  constructor(
    container: d3.Selection<SVGElement, unknown, null, undefined>,
    config: RenderingConfig,
    callbacks: RenderingCallbacks = {}
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;

    this.headerLayoutService = new HeaderLayoutService();
  }

  /**
   * Set the current grid data for rendering
   */
  public setGridData(data: GridData): void {
    this.currentData = data;
  }

  /**
   * Update rendering configuration
   */
  public updateConfig(config: Partial<RenderingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update rendering callbacks
   */
  public updateCallbacks(callbacks: Partial<RenderingCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set PAFV projection for axis-based layout
   * This will be used in Plan 56-02 for position computation
   */
  public setProjection(projection: PAFVProjection | null): void {
    this.currentProjection = projection;
    superGridLogger.debug('GridRenderingEngine: projection set', {
      xAxis: projection?.xAxis?.facet || 'none',
      yAxis: projection?.yAxis?.facet || 'none',
    });
  }

  /**
   * Get current projection
   */
  public getProjection(): PAFVProjection | null {
    return this.currentProjection;
  }

  /**
   * Set color encoding configuration
   * Updates color scale based on encoding type
   */
  public setColorEncoding(encoding: EncodingConfig | null): void {
    this.colorEncoding = encoding;
    this.updateColorScale();
    superGridLogger.debug('GridRenderingEngine: color encoding set', {
      property: encoding?.property || 'none',
      type: encoding?.type || 'none',
    });
  }

  /**
   * Set size encoding configuration
   */
  public setSizeEncoding(encoding: EncodingConfig | null): void {
    this.sizeEncoding = encoding;
    superGridLogger.debug('GridRenderingEngine: size encoding set', {
      property: encoding?.property || 'none',
      type: encoding?.type || 'none',
    });
  }

  /**
   * Update color scale based on current encoding and data
   */
  private updateColorScale(): void {
    if (!this.colorEncoding || !this.currentData?.cards) {
      this.colorScale = null;
      return;
    }

    const { property, type } = this.colorEncoding;
    const values = this.currentData.cards
      .map((c) => (c as Record<string, unknown>)[property])
      .filter((v) => v != null);

    if (type === 'numeric') {
      // Sequential color scale for numeric data
      const numericValues = values.map((v) => Number(v)).filter((v) => !isNaN(v));
      if (numericValues.length > 0) {
        const extent = d3.extent(numericValues) as [number, number];
        this.colorScale = d3.scaleSequential(d3.interpolateBlues)
          .domain(extent);
      }
    } else if (type === 'categorical' || type === 'ordinal') {
      // Ordinal color scale for categorical data
      const uniqueValues = [...new Set(values.map(String))];
      this.colorScale = d3.scaleOrdinal<string>()
        .domain(uniqueValues)
        .range(d3.schemeCategory10);
    }
  }

  /**
   * Get current computed headers
   */
  public getHeaders(): GridHeaders | null {
    return this.currentHeaders;
  }

  /**
   * Generate column and row headers from card data and projection
   */
  private generateProjectionHeaders(cards: unknown[]): GridHeaders {
    if (!this.currentProjection) {
      return { columns: [], rows: [] };
    }

    // NOTE: X-Plane (labeled "Rows" in Navigator) → rows (vertical headers on left)
    //       Y-Plane (labeled "Columns" in Navigator) → columns (horizontal headers at top)
    const xFacet = this.currentProjection.xAxis?.facet;
    const yFacet = this.currentProjection.yAxis?.facet;

    // X-Plane → rows (vertical headers on left side)
    const rows: string[] = xFacet
      ? [
          ...new Set(
            cards
              .map((c) => (c as Record<string, unknown>)[xFacet])
              .filter((v) => v != null)
              .map((v) => String(v))
          ),
        ].sort()
      : [];

    // Y-Plane → columns (horizontal headers at top)
    const columns: string[] = yFacet
      ? [
          ...new Set(
            cards
              .map((c) => (c as Record<string, unknown>)[yFacet])
              .filter((v) => v != null)
              .map((v) => String(v))
          ),
        ].sort()
      : [];

    // Add "Unassigned" bucket if there are cards with null values
    if (
      xFacet &&
      cards.some((c) => (c as Record<string, unknown>)[xFacet] == null)
    ) {
      columns.push('Unassigned');
    }
    if (
      yFacet &&
      cards.some((c) => (c as Record<string, unknown>)[yFacet] == null)
    ) {
      rows.push('Unassigned');
    }

    superGridLogger.debug('Generated projection headers:', {
      columns: columns.length,
      rows: rows.length,
    });

    return { columns, rows };
  }

  /**
   * Compute cell position for a card based on projection
   */
  private computeCellPosition(
    card: unknown,
    headers: GridHeaders
  ): { row: number; col: number } {
    if (!this.currentProjection) {
      return { row: -1, col: -1 };
    }

    // NOTE: X-Plane (labeled "Rows" in Navigator) → row position
    //       Y-Plane (labeled "Columns" in Navigator) → col position
    const xFacet = this.currentProjection.xAxis?.facet;
    const yFacet = this.currentProjection.yAxis?.facet;
    const cardRecord = card as Record<string, unknown>;

    // X-Plane → row position (vertical axis)
    let row = -1;
    if (xFacet) {
      const xValue = cardRecord[xFacet];
      row =
        xValue != null
          ? headers.rows.indexOf(String(xValue))
          : headers.rows.indexOf('Unassigned');
    }

    // Y-Plane → col position (horizontal axis)
    let col = -1;
    if (yFacet) {
      const yValue = cardRecord[yFacet];
      col =
        yValue != null
          ? headers.columns.indexOf(String(yValue))
          : headers.columns.indexOf('Unassigned');
    }

    return { row, col };
  }

  /**
   * Compute positions for all cards based on projection
   * Handles both single-facet and stacked (multi-facet) axes
   */
  private computeAllPositions(cards: unknown[]): void {
    if (!this.currentProjection) {
      return;
    }

    // Check if axes are stacked (multiple facets)
    const xFacets = this.currentProjection.xAxis?.facets;
    const yFacets = this.currentProjection.yAxis?.facets;
    const xIsStacked = xFacets && xFacets.length > 1;
    const yIsStacked = yFacets && yFacets.length > 1;

    // DIAGNOSTIC: Log stacked axis detection
    superGridLogger.debug('[computeAllPositions] Stacked axis detection:', {
      xIsStacked,
      yIsStacked,
      xFacets,
      yFacets,
      xFacet: this.currentProjection.xAxis?.facet,
      yFacet: this.currentProjection.yAxis?.facet,
    });

    // For stacked axes, compute positions based on composite keys
    if (xIsStacked || yIsStacked) {
      this.computeStackedPositions(cards, xFacets, yFacets);
    } else {
      // Single-facet axes: use existing header generation
      this.currentHeaders = this.generateProjectionHeaders(cards);

      // Compute position for each card
      cards.forEach((card) => {
        const pos = this.computeCellPosition(card, this.currentHeaders!);
        const cardRecord = card as Record<string, unknown>;
        cardRecord._projectedRow = pos.row;
        cardRecord._projectedCol = pos.col;
      });
    }

    superGridLogger.debug('Computed positions for cards:', {
      total: cards.length,
      withPosition: cards.filter((c) => {
        const r = c as Record<string, unknown>;
        return (
          (r._projectedRow as number) >= 0 || (r._projectedCol as number) >= 0
        );
      }).length,
    });
  }

  /**
   * Compute positions for stacked (multi-facet) axes
   * Creates composite keys from all facet values and positions cards at leaf nodes
   *
   * NOTE: X-Plane (labeled "Rows" in Navigator) → rows (vertical axis)
   *       Y-Plane (labeled "Columns" in Navigator) → columns (horizontal axis)
   */
  private computeStackedPositions(
    cards: unknown[],
    xFacets: string[] | undefined,
    yFacets: string[] | undefined
  ): void {
    // Build composite keys for rows (X-Plane → "Rows" in Navigator)
    const rowKeys = new Map<string, number>();
    if (xFacets && xFacets.length > 0) {
      const uniqueRowKeys = new Set<string>();
      cards.forEach((card) => {
        const key = this.buildCompositeKey(card, xFacets);
        uniqueRowKeys.add(key);
      });
      // Sort keys for consistent ordering
      const sortedKeys = Array.from(uniqueRowKeys).sort();
      sortedKeys.forEach((key, index) => {
        rowKeys.set(key, index);
      });
    } else if (this.currentProjection?.xAxis?.facet) {
      // Single facet fallback
      const facet = this.currentProjection.xAxis.facet;
      const uniqueValues = new Set<string>();
      cards.forEach((card) => {
        const value = (card as Record<string, unknown>)[facet];
        uniqueValues.add(value != null ? String(value) : 'Unassigned');
      });
      Array.from(uniqueValues).sort().forEach((value, index) => {
        rowKeys.set(value, index);
      });
    }

    // Build composite keys for columns (Y-Plane → "Columns" in Navigator)
    const columnKeys = new Map<string, number>();
    if (yFacets && yFacets.length > 0) {
      const uniqueColumnKeys = new Set<string>();
      cards.forEach((card) => {
        const key = this.buildCompositeKey(card, yFacets);
        uniqueColumnKeys.add(key);
      });
      // Sort keys for consistent ordering
      const sortedKeys = Array.from(uniqueColumnKeys).sort();
      sortedKeys.forEach((key, index) => {
        columnKeys.set(key, index);
      });
    } else if (this.currentProjection?.yAxis?.facet) {
      // Single facet fallback
      const facet = this.currentProjection.yAxis.facet;
      const uniqueValues = new Set<string>();
      cards.forEach((card) => {
        const value = (card as Record<string, unknown>)[facet];
        uniqueValues.add(value != null ? String(value) : 'Unassigned');
      });
      Array.from(uniqueValues).sort().forEach((value, index) => {
        columnKeys.set(value, index);
      });
    }

    // DIAGNOSTIC: Log computed keys
    superGridLogger.debug('[computeStackedPositions] Computed keys:', {
      rowKeys: Array.from(rowKeys.entries()),
      columnKeys: Array.from(columnKeys.entries()),
    });

    // Update currentHeaders with leaf values
    this.currentHeaders = {
      rows: Array.from(rowKeys.keys()),
      columns: Array.from(columnKeys.keys()),
    };

    // Compute position for each card based on composite keys
    cards.forEach((card) => {
      const cardRecord = card as Record<string, unknown>;

      // Row position (X-Plane → rows)
      if (xFacets && xFacets.length > 0) {
        const xKey = this.buildCompositeKey(card, xFacets);
        cardRecord._projectedRow = rowKeys.get(xKey) ?? -1;
      } else if (this.currentProjection?.xAxis?.facet) {
        const value = cardRecord[this.currentProjection.xAxis.facet];
        const key = value != null ? String(value) : 'Unassigned';
        cardRecord._projectedRow = rowKeys.get(key) ?? -1;
      } else {
        cardRecord._projectedRow = 0;
      }

      // Column position (Y-Plane → columns)
      if (yFacets && yFacets.length > 0) {
        const yKey = this.buildCompositeKey(card, yFacets);
        cardRecord._projectedCol = columnKeys.get(yKey) ?? -1;
      } else if (this.currentProjection?.yAxis?.facet) {
        const value = cardRecord[this.currentProjection.yAxis.facet];
        const key = value != null ? String(value) : 'Unassigned';
        cardRecord._projectedCol = columnKeys.get(key) ?? -1;
      } else {
        cardRecord._projectedCol = 0;
      }
    });
  }

  /**
   * Build a composite key from multiple facet values
   * Used for positioning cards in stacked axis hierarchies
   */
  private buildCompositeKey(card: unknown, facets: string[]): string {
    const cardRecord = card as Record<string, unknown>;
    const parts = facets.map((facet) => {
      const value = cardRecord[facet];
      return value != null ? String(value) : 'Unassigned';
    });
    return parts.join('|');
  }

  /**
   * Compute simple grid positions when no projection is set
   * Lays out cards in a grid pattern with configurable columns
   */
  private computeSimpleGridPositions(cards: unknown[]): void {
    const columnsPerRow = 4; // Default grid columns
    const { cardWidth, cardHeight, padding, headerHeight } = this.config;
    const gapX = 10;
    const gapY = 10;

    cards.forEach((card, index) => {
      const cardRecord = card as Record<string, unknown>;
      const col = index % columnsPerRow;
      const row = Math.floor(index / columnsPerRow);

      cardRecord.x = padding + col * (cardWidth + gapX);
      cardRecord.y = headerHeight + padding + row * (cardHeight + gapY);
    });
  }

  /**
   * Main render method
   */
  public render(activeFilters: unknown[] = []): void {
    this.setupGridStructure();

    if (!this.currentData) {
      this.renderEmptyState();
      return;
    }

    // Compute positions from projection or use simple grid layout
    if (this.currentData.cards) {
      if (this.currentProjection) {
        this.computeAllPositions(this.currentData.cards);
      } else {
        // Fallback: simple grid layout when no projection
        this.computeSimpleGridPositions(this.currentData.cards);
      }
    }

    this.updateGridLayout();

    // Update viewBox now that positions are computed
    this.updateViewBox();

    // Use projection headers if available, else fallback
    if (this.currentProjection && this.currentHeaders) {
      this.renderProjectionHeaders();
    } else if (this.config.enableHeaders) {
      this.renderHierarchicalHeaders(activeFilters);
    } else {
      this.renderSimpleFallbackHeader();
    }

    this.renderCards();
  }

  /**
   * Update SVG viewBox after positions are computed
   */
  private updateViewBox(): void {
    const dimensions = this.getGridDimensions();
    this.container
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
  }

  /**
   * Get current grid dimensions
   */
  public getGridDimensions(): { width: number; height: number } {
    return {
      width: this.getGridWidth(),
      height: this.getGridHeight()
    };
  }

  /**
   * Initialize header system with database service
   */
  public initializeHeaders(_database: unknown): void {
    if (this.config.enableHeaders && !this.isHeadersInitialized) {
      const headerNode = this.container.select('.headers').node() as SVGElement | null;
      if (headerNode) {
        this.superGridHeaders = new SuperGridHeaders(
          headerNode,
          this.headerLayoutService
        );
      }

      this.isHeadersInitialized = true;

      superGridLogger.debug('Headers initialized with database service');
    }
  }

  /**
   * Scroll to a specific card
   */
  public scrollToCard(cardId: string): void {
    const cardElement = this.container.select(`[data-card-id="${cardId}"]`);

    if (!cardElement.empty()) {
      // Get card position
      const transform = cardElement.attr('transform');
      const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);

      if (match) {
        const cardX = parseFloat(match[1]);
        const cardY = parseFloat(match[2]);

        // Calculate viewport center
        const containerNode = this.container.node() as SVGElement;
        const containerRect = containerNode.getBoundingClientRect();
        const viewportCenterX = containerRect.width / 2;
        const viewportCenterY = containerRect.height / 2;

        // Smooth scroll to card position
        const targetTransform = `translate(${viewportCenterX - cardX}, ${viewportCenterY - cardY})`;

        this.container
          .select('.grid-content')
          .transition()
          .duration(this.config.animationDuration)
          .attr('transform', targetTransform);

        superGridLogger.debug('Scrolled to card', {
          cardId,
          targetPosition: { x: cardX, y: cardY }
        });
      }
    }
  }

  /**
   * Cleanup rendering resources
   */
  public destroy(): void {
    this.superGridHeaders = null;

    if (this.headerLayoutService) {
      this.headerLayoutService.clearCache();
    }

    this.container.selectAll('*').remove();
    this.isHeadersInitialized = false;
  }

  /**
   * Calculate grid width based on content
   */
  private getGridWidth(): number {
    if (!this.currentData || !this.currentData.cards.length) return 800; // Default width

    const maxX = Math.max(...this.currentData.cards.map(
      card => ((card as Record<string, unknown>).x as number) || 0
    ));
    const width = Math.max(800, maxX + this.config.cardWidth + this.config.padding * 2);
    return width;
  }

  /**
   * Calculate grid height based on content
   */
  private getGridHeight(): number {
    if (!this.currentData || !this.currentData.cards.length) return 600; // Default height

    // Calculate based on actual card positions if available
    const maxY = Math.max(...this.currentData.cards.map(
      card => ((card as Record<string, unknown>).y as number) || 0
    ));

    // Ensure we have enough height for all cards
    const calculatedHeight = maxY + this.config.cardHeight + this.config.padding * 2;
    return Math.max(600, calculatedHeight);
  }

  /**
   * Update grid layout calculations
   */
  private updateGridLayout(): void {
    if (!this.currentData) return;

    // If we have projection and headers, use 2D grid layout
    if (this.currentProjection && this.currentHeaders) {
      this.updateProjectedGridLayout();
      return;
    }

    // Calculate positions for cards if they don't have them
    const cardsPerRow = Math.floor(
      (this.getGridWidth() - this.config.padding) /
        (this.config.cardWidth + this.config.padding)
    );

    this.currentData.cards?.forEach((card: unknown, index: number) => {
      const cardRecord = card as Record<string, unknown>;
      if (cardRecord.x === undefined || cardRecord.y === undefined) {
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;

        cardRecord.x =
          this.config.padding + col * (this.config.cardWidth + this.config.padding);
        cardRecord.y =
          this.config.headerHeight +
          this.config.padding +
          row * (this.config.cardHeight + this.config.padding);
      }
    });

    // Notify about grid size changes
    const dimensions = this.getGridDimensions();
    if (this.callbacks.onGridResize) {
      this.callbacks.onGridResize(dimensions.width, dimensions.height);
    }
  }

  /**
   * Update layout using projection-computed positions
   */
  private updateProjectedGridLayout(): void {
    if (!this.currentData?.cards || !this.currentHeaders) {
      console.warn('[updateProjectedGridLayout] Missing data or headers:', {
        hasCards: !!this.currentData?.cards,
        cardsLength: this.currentData?.cards?.length,
        hasHeaders: !!this.currentHeaders,
        columns: this.currentHeaders?.columns?.length,
        rows: this.currentHeaders?.rows?.length,
      });
      return;
    }

    const headerOffset = this.config.headerHeight + this.config.padding;
    const rowHeaderWidth = this.config.rowHeaderWidth;
    const cellWidth = this.config.cardWidth + this.config.padding;
    const cellHeight = this.config.cardHeight + this.config.padding;

    // DIAGNOSTIC: Log first card's position computation
    const firstCard = this.currentData.cards[0] as Record<string, unknown> | undefined;
    if (firstCard) {
      superGridLogger.debug('[updateProjectedGridLayout] First card positioning:', {
        id: firstCard.id,
        name: firstCard.name,
        _projectedRow: firstCard._projectedRow,
        _projectedCol: firstCard._projectedCol,
        headerOffset,
        rowHeaderWidth,
        cellWidth,
        cellHeight,
      });
    }

    let positionedCount = 0;
    this.currentData.cards.forEach((card: unknown) => {
      const cardRecord = card as Record<string, unknown>;
      const row = cardRecord._projectedRow as number ?? -1;
      const col = cardRecord._projectedCol as number ?? -1;

      // Calculate position in grid (default to 0 if not positioned)
      cardRecord.x = rowHeaderWidth + this.config.padding + Math.max(0, col) * cellWidth;
      cardRecord.y = headerOffset + Math.max(0, row) * cellHeight;

      if (row >= 0 && col >= 0) {
        positionedCount++;
      }
    });

    superGridLogger.debug('[updateProjectedGridLayout] Positioned cards:', {
      total: this.currentData.cards.length,
      positioned: positionedCount,
      columns: this.currentHeaders.columns.length,
      rows: this.currentHeaders.rows.length,
    });

    // Update grid dimensions
    const numCols = this.currentHeaders.columns.length || 1;
    const numRows = this.currentHeaders.rows.length || 1;

    const gridWidth =
      rowHeaderWidth +
      numCols * (this.config.cardWidth + this.config.padding) +
      this.config.padding;
    const gridHeight =
      headerOffset +
      numRows * (this.config.cardHeight + this.config.padding) +
      this.config.padding;

    if (this.callbacks.onGridResize) {
      this.callbacks.onGridResize(gridWidth, gridHeight);
    }

    superGridLogger.debug('Projected grid layout:', {
      columns: numCols,
      rows: numRows,
      gridWidth,
      gridHeight,
    });
  }

  /**
   * Render headers from projection - supports both single and stacked facets
   */
  private renderProjectionHeaders(): void {
    if (!this.currentProjection) return;

    // Check if X-axis has stacked facets (multiple facets assigned)
    const xAxisStacked = (this.currentProjection.xAxis?.facets?.length ?? 0) > 1;
    const yAxisStacked = (this.currentProjection.yAxis?.facets?.length ?? 0) > 1;

    // DIAGNOSTIC: Log stacked header detection (always visible)
    superGridLogger.debug('[SuperGrid Headers]', {
      xAxis: this.currentProjection.xAxis?.facet || 'none',
      xFacets: this.currentProjection.xAxis?.facets || [],
      xAxisStacked,
      yAxis: this.currentProjection.yAxis?.facet || 'none',
      yFacets: this.currentProjection.yAxis?.facets || [],
      yAxisStacked,
      willRenderStacked: xAxisStacked || yAxisStacked,
    });

    if (xAxisStacked || yAxisStacked) {
      this.renderStackedProjectionHeaders(xAxisStacked, yAxisStacked);
      return;
    }

    // Fall back to existing single-level header rendering
    if (!this.currentHeaders) return;

    const headerContainer = this.container.select('.headers');
    headerContainer.selectAll('*').remove();

    const rowHeaderWidth = this.config.rowHeaderWidth;
    const { columns, rows } = this.currentHeaders;
    const config = this.config;

    // Render column headers
    headerContainer
      .selectAll<SVGGElement, string>('.col-header')
      .data(columns)
      .join('g')
      .attr('class', 'col-header')
      .attr(
        'transform',
        (_, i) =>
          `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, 0)`
      )
      .each(function (d) {
        const g = d3.select(this);
        g.selectAll('*').remove();
        g.append('rect')
          .attr('width', config.cardWidth)
          .attr('height', config.headerHeight)
          .attr('fill', '#f0f0f0')
          .attr('stroke', '#ddd')
          .attr('rx', 4);
        g.append('text')
          .attr('x', config.cardWidth / 2)
          .attr('y', config.headerHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#333')
          .text(d);
      });

    // Render row headers
    const headerOffset = config.headerHeight + config.padding;
    headerContainer
      .selectAll<SVGGElement, string>('.row-header')
      .data(rows)
      .join('g')
      .attr('class', 'row-header')
      .attr(
        'transform',
        (_, i) =>
          `translate(0, ${headerOffset + i * (config.cardHeight + config.padding)})`
      )
      .each(function (d) {
        const g = d3.select(this);
        g.selectAll('*').remove();
        g.append('rect')
          .attr('width', rowHeaderWidth - 4)
          .attr('height', config.cardHeight)
          .attr('fill', '#f5f5f5')
          .attr('stroke', '#ddd')
          .attr('rx', 4);
        g.append('text')
          .attr('x', (rowHeaderWidth - 4) / 2)
          .attr('y', config.cardHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('fill', '#666')
          .text(d);
      });

    superGridLogger.debug('Rendered projection headers:', {
      columns: columns.length,
      rows: rows.length,
    });
  }

  /**
   * Render stacked (hierarchical) headers for multi-facet axes
   * Supports both flat and nested header rendering based on axis configuration
   */
  private renderStackedProjectionHeaders(
    xAxisStacked: boolean,
    yAxisStacked: boolean
  ): void {
    if (!this.currentHeaders) {
      console.warn('[renderStackedProjectionHeaders] No currentHeaders available');
      this.renderSimpleFallbackHeader();
      return;
    }

    superGridLogger.debug('[renderStackedProjectionHeaders] Rendering headers:', {
      xAxisStacked,
      yAxisStacked,
      columns: this.currentHeaders.columns.length,
      rows: this.currentHeaders.rows.length,
    });

    const headerContainer = this.container.select('.headers');
    headerContainer.selectAll('*').remove();

    // NOTE: X-Plane (labeled "Rows" in Navigator) → row headers (vertical, left side)
    //       Y-Plane (labeled "Columns" in Navigator) → column headers (horizontal, top)

    // Render row headers (X-Plane → "Rows")
    if (this.currentHeaders.rows.length > 0) {
      if (xAxisStacked) {
        this.renderNestedAxisHeaders('y', this.currentHeaders.rows);
      } else {
        this.renderSimpleAxisHeaders('y', this.currentHeaders.rows);
      }
    }

    // Render column headers (Y-Plane → "Columns")
    if (this.currentHeaders.columns.length > 0) {
      if (yAxisStacked) {
        this.renderNestedAxisHeaders('x', this.currentHeaders.columns);
      } else {
        this.renderSimpleAxisHeaders('x', this.currentHeaders.columns);
      }
    }

    superGridLogger.debug('[renderStackedProjectionHeaders] Complete - rendered', {
      columns: this.currentHeaders.columns.length,
      rows: this.currentHeaders.rows.length,
    });
  }

  /**
   * Render nested (hierarchical) headers for stacked axes
   * Parses composite keys and renders parent headers that span children
   *
   * For Y-axis (rows): Parent headers span multiple rows, children indented
   * For X-axis (columns): Parent headers span multiple columns, stacked vertically
   */
  private renderNestedAxisHeaders(
    axis: 'x' | 'y',
    compositeKeys: string[]
  ): void {
    const headerContainer = this.container.select('.headers');
    const config = this.config;
    const rowHeaderWidth = config.rowHeaderWidth;

    // Parse composite keys into hierarchy
    // Example: ["Personal|Active", "Personal|Complete", "Work|Active"]
    // Becomes: { "Personal": ["Active", "Complete"], "Work": ["Active"] }
    const hierarchy = new Map<string, { children: string[]; startIndex: number }>();
    const leafValues: string[] = [];

    compositeKeys.forEach((key, index) => {
      const parts = key.split('|');
      if (parts.length >= 2) {
        const [parent, ...rest] = parts;
        const child = rest.join('|'); // Handle deeper nesting

        if (!hierarchy.has(parent)) {
          hierarchy.set(parent, { children: [], startIndex: index });
        }
        hierarchy.get(parent)!.children.push(child);
        leafValues.push(child);
      } else {
        // Single value, treat as leaf
        leafValues.push(parts[0]);
      }
    });

    superGridLogger.debug('[renderNestedAxisHeaders] Parsed hierarchy:', {
      axis,
      totalKeys: compositeKeys.length,
      parentCount: hierarchy.size,
      leafCount: leafValues.length,
      parents: Array.from(hierarchy.keys()),
    });

    if (axis === 'y') {
      // ROWS: Parent headers span multiple rows vertically, children indented
      const headerOffset = config.headerHeight + config.padding;
      const cellHeight = config.cardHeight + config.padding;

      // Render parent headers (level 0)
      let rowIndex = 0;
      hierarchy.forEach((data, parent) => {
        const span = data.children.length;
        const yPos = headerOffset + rowIndex * cellHeight;
        const height = span * cellHeight - config.padding;

        // Parent header group
        const parentGroup = headerContainer
          .append('g')
          .attr('class', 'row-header row-header--parent')
          .attr('transform', `translate(0, ${yPos})`);

        // Parent background (spans multiple rows)
        parentGroup
          .append('rect')
          .attr('width', rowHeaderWidth / 2 - 2)
          .attr('height', height)
          .attr('fill', '#e2e8f0')
          .attr('stroke', '#cbd5e1')
          .attr('rx', 4);

        // Parent label (vertically centered)
        parentGroup
          .append('text')
          .attr('x', (rowHeaderWidth / 2 - 2) / 2)
          .attr('y', height / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#334155')
          .text(parent);

        // Render child headers (level 1)
        data.children.forEach((child, childIndex) => {
          const childYPos = childIndex * cellHeight;
          const childWidth = rowHeaderWidth / 2 - 4;
          const childXPos = rowHeaderWidth / 2 + 2;

          const childGroup = headerContainer
            .append('g')
            .attr('class', 'row-header row-header--child')
            .attr('transform', `translate(${childXPos}, ${yPos + childYPos})`);

          // Child background
          childGroup
            .append('rect')
            .attr('width', childWidth)
            .attr('height', config.cardHeight)
            .attr('fill', '#f1f5f9')
            .attr('stroke', '#e2e8f0')
            .attr('rx', 4);

          // Child label
          childGroup
            .append('text')
            .attr('x', childWidth / 2)
            .attr('y', config.cardHeight / 2 + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#64748b')
            .text(child);
        });

        rowIndex += span;
      });

      // Handle single-level values (no pipe separator)
      const singleLevelKeys = compositeKeys.filter(key => !key.includes('|'));
      if (singleLevelKeys.length > 0 && hierarchy.size === 0) {
        // Fall back to simple rendering if no hierarchy detected
        this.renderSimpleAxisHeaders('y', compositeKeys);
      }

    } else {
      // COLUMNS: Parent headers span multiple columns horizontally, stacked vertically
      const parentHeaderHeight = config.headerHeight * 0.6;
      const childHeaderHeight = config.headerHeight * 0.5;

      // Render parent headers (level 0) - top row
      let colIndex = 0;
      hierarchy.forEach((data, parent) => {
        const span = data.children.length;
        const xPos = rowHeaderWidth + config.padding + colIndex * (config.cardWidth + config.padding);
        const width = span * (config.cardWidth + config.padding) - config.padding;

        // Parent header group
        const parentGroup = headerContainer
          .append('g')
          .attr('class', 'col-header col-header--parent')
          .attr('transform', `translate(${xPos}, 0)`);

        // Parent background (spans multiple columns)
        parentGroup
          .append('rect')
          .attr('width', width)
          .attr('height', parentHeaderHeight)
          .attr('fill', '#e2e8f0')
          .attr('stroke', '#cbd5e1')
          .attr('rx', 4);

        // Parent label
        parentGroup
          .append('text')
          .attr('x', width / 2)
          .attr('y', parentHeaderHeight / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#334155')
          .text(parent);

        // Render child headers (level 1) - bottom row
        data.children.forEach((child, childIndex) => {
          const childXPos = childIndex * (config.cardWidth + config.padding);

          const childGroup = headerContainer
            .append('g')
            .attr('class', 'col-header col-header--child')
            .attr('transform', `translate(${xPos + childXPos}, ${parentHeaderHeight + 2})`);

          // Child background
          childGroup
            .append('rect')
            .attr('width', config.cardWidth)
            .attr('height', childHeaderHeight)
            .attr('fill', '#f1f5f9')
            .attr('stroke', '#e2e8f0')
            .attr('rx', 4);

          // Child label
          childGroup
            .append('text')
            .attr('x', config.cardWidth / 2)
            .attr('y', childHeaderHeight / 2 + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', '#64748b')
            .text(child);
        });

        colIndex += span;
      });

      // Handle single-level values (no pipe separator)
      const singleLevelKeys = compositeKeys.filter(key => !key.includes('|'));
      if (singleLevelKeys.length > 0 && hierarchy.size === 0) {
        // Fall back to simple rendering if no hierarchy detected
        this.renderSimpleAxisHeaders('x', compositeKeys);
      }
    }

    superGridLogger.debug('[renderNestedAxisHeaders] Rendered nested headers:', {
      axis,
      parentCount: hierarchy.size,
    });
  }

  // NOTE: updateHeadersFromHierarchy removed - using simplified approach
  // that computes headers in computeStackedPositions() instead

  /**
   * Render simple (single-level) headers for a single axis
   * Used when one axis is stacked and the other is not
   */
  private renderSimpleAxisHeaders(
    axis: 'x' | 'y',
    values: string[]
  ): void {
    const headerContainer = this.container.select('.headers');
    const rowHeaderWidth = this.config.rowHeaderWidth;
    const config = this.config;

    if (axis === 'x') {
      // Render column headers
      headerContainer
        .selectAll<SVGGElement, string>('.col-header')
        .data(values)
        .join('g')
        .attr('class', 'col-header')
        .attr(
          'transform',
          (_, i) =>
            `translate(${rowHeaderWidth + config.padding + i * (config.cardWidth + config.padding)}, 0)`
        )
        .each(function (d) {
          const g = d3.select(this);
          g.selectAll('*').remove();
          g.append('rect')
            .attr('width', config.cardWidth)
            .attr('height', config.headerHeight)
            .attr('fill', '#f0f0f0')
            .attr('stroke', '#ddd')
            .attr('rx', 4);
          g.append('text')
            .attr('x', config.cardWidth / 2)
            .attr('y', config.headerHeight / 2 + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(d);
        });
    } else {
      // Render row headers
      const headerOffset = config.headerHeight + config.padding;
      headerContainer
        .selectAll<SVGGElement, string>('.row-header')
        .data(values)
        .join('g')
        .attr('class', 'row-header')
        .attr(
          'transform',
          (_, i) =>
            `translate(0, ${headerOffset + i * (config.cardHeight + config.padding)})`
        )
        .each(function (d) {
          const g = d3.select(this);
          g.selectAll('*').remove();
          g.append('rect')
            .attr('width', rowHeaderWidth - 4)
            .attr('height', config.cardHeight)
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#ddd')
            .attr('rx', 4);
          g.append('text')
            .attr('x', (rowHeaderWidth - 4) / 2)
            .attr('y', config.cardHeight / 2 + 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#666')
            .text(d);
        });
    }

    superGridLogger.debug('Rendered simple axis headers:', {
      axis,
      count: values.length,
    });
  }

  /**
   * Setup basic grid structure (containers, etc.)
   */
  private setupGridStructure(): void {
    // Clear existing content
    this.container.selectAll('*').remove();

    // Create main containers
    this.container.append('g').attr('class', 'headers');
    this.container.append('g').attr('class', 'grid-content');

    // Set up viewport with minimum dimensions
    const dimensions = this.getGridDimensions();
    this.container
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
  }

  /**
   * Render hierarchical headers
   */
  private renderHierarchicalHeaders(_activeFilters: unknown[] = []): void {
    if (!this.config.enableHeaders || !this.currentData?.cards.length) {
      return;
    }

    try {
      // Generate headers from current data
      if (this.superGridHeaders && this.currentData.cards.length > 0) {
        this.superGridHeaders.renderHeaders(
          this.currentData.cards,
          'x',
          'status',
          this.getGridWidth()
        );

        superGridLogger.debug('Headers rendered', {
          cardCount: this.currentData.cards.length
        });
      } else {
        this.renderSimpleFallbackHeader();
      }
    } catch (error) {
      superGridLogger.error('Header rendering failed:', error);
      this.renderSimpleFallbackHeader();
    }
  }

  /**
   * Render simple fallback header
   */
  private renderSimpleFallbackHeader(): void {
    const headerContainer = this.container.select('.headers');

    headerContainer
      .append('rect')
      .attr('width', '100%')
      .attr('height', this.config.headerHeight)
      .attr('fill', '#f5f5f5')
      .attr('stroke', '#ddd');

    headerContainer
      .append('text')
      .attr('x', 10)
      .attr('y', this.config.headerHeight / 2 + 5)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '14px')
      .attr('fill', '#333')
      .text(`${this.currentData?.cards?.length || 0} cards`);

    superGridLogger.debug('Fallback header rendered');
  }

  // generateAxisData removed - header generation delegated to SuperGridHeaders.renderHeaders

  /**
   * Render grid cards
   */
  private renderCards(): void {
    const cardContainer = this.container.select('.grid-content');

    if (!this.currentData) {
      cardContainer.selectAll('*').remove();
      return;
    }

    type CardRecord = Record<string, unknown>;

    // Use D3's data join pattern
    const cardSelection = cardContainer
      .selectAll<SVGGElement, CardRecord>('.card')
      .data(
        this.currentData.cards as CardRecord[],
        (d: CardRecord) => String(d.id)
      );

    // Enter new cards
    const cardEnter = cardSelection
      .enter()
      .append('g')
      .attr('class', 'card')
      .attr('data-card-id', (d: CardRecord) => String(d.id))
      .attr('transform', (d: CardRecord) =>
        `translate(${(d.x as number) || 0}, ${(d.y as number) || 0})`
      )
      .attr('opacity', 0);

    // Add card background with optional color encoding
    cardEnter
      .append('rect')
      .attr('class', 'card-bg')
      .attr('width', this.config.cardWidth)
      .attr('height', this.config.cardHeight)
      .attr('rx', 8)
      .attr('fill', (d: CardRecord) => this.getCardColor(d))
      .attr('stroke', '#e1e5e9')
      .attr('stroke-width', 1);

    // Add card title
    cardEnter
      .append('text')
      .attr('x', 12)
      .attr('y', 24)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#1a1a1a')
      .text((d: CardRecord) =>
        String(d.title || d.name || `Card ${d.id}`)
      );

    // Add card content
    cardEnter
      .append('text')
      .attr('x', 12)
      .attr('y', 48)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text((d: CardRecord) =>
        String(d.description || d.content || '')
      );

    // Animate enter cards fading in
    cardEnter
      .transition()
      .duration(200)
      .attr('opacity', 1);

    // Update existing cards with FLIP animation
    cardSelection
      .transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .attr('transform', (d: CardRecord) =>
        `translate(${(d.x as number) || 0}, ${(d.y as number) || 0})`
      );

    // Update card background fill on existing cards
    cardSelection.select('.card-bg')
      .attr('fill', (d: CardRecord) => this.getCardColor(d));

    // Remove old cards with fade-out animation
    cardSelection
      .exit()
      .transition()
      .duration(200)
      .attr('opacity', 0)
      .remove();

    // Merge enter and update for final customization
    const cardMerged = cardEnter.merge(cardSelection);

    // Allow external customization
    if (this.callbacks.onCardRender) {
      this.callbacks.onCardRender(cardMerged);
    }

    superGridLogger.debug('Cards rendered', {
      total: this.currentData.cards.length,
      entered: cardEnter.size(),
      existing: cardSelection.size()
    });
  }

  /**
   * Get card color based on color encoding
   */
  private getCardColor(card: Record<string, unknown>): string {
    if (!this.colorEncoding || !this.colorScale) {
      return 'white';
    }

    const value = card[this.colorEncoding.property];
    if (value == null) {
      return 'white';
    }

    try {
      if (this.colorEncoding.type === 'numeric') {
        const sequentialScale = this.colorScale as d3.ScaleSequential<string>;
        return sequentialScale(Number(value)) || 'white';
      } else {
        const ordinalScale = this.colorScale as d3.ScaleOrdinal<string, string>;
        return ordinalScale(String(value)) || 'white';
      }
    } catch {
      return 'white';
    }
  }

  /**
   * Get card size multiplier based on size encoding
   * Returns a value between 0.7 and 1.0 to scale card dimensions
   *
   * @param card - The card record to get size for
   * @returns Size multiplier (0.7 to 1.0)
   */
  public getCardSizeMultiplier(card: Record<string, unknown>): number {
    if (!this.sizeEncoding) {
      return 1.0;
    }

    const value = card[this.sizeEncoding.property];
    if (value == null) {
      return 1.0;
    }

    // For numeric encoding, normalize to 0.7-1.0 range
    if (this.sizeEncoding.type === 'numeric' && this.currentData?.cards) {
      const numericValues = this.currentData.cards
        .map((c) => Number((c as Record<string, unknown>)[this.sizeEncoding!.property]))
        .filter((v) => !isNaN(v));

      if (numericValues.length > 0) {
        const [min, max] = d3.extent(numericValues) as [number, number];
        if (max > min) {
          const normalized = (Number(value) - min) / (max - min);
          return 0.7 + normalized * 0.3; // Scale between 0.7 and 1.0
        }
      }
    }

    return 1.0;
  }

  /**
   * Render empty state when no data
   */
  private renderEmptyState(): void {
    this.container.selectAll('*').remove();

    this.container
      .append('text')
      .attr('x', '50%')
      .attr('y', '50%')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '16px')
      .attr('fill', '#666')
      .text('No data to display');
  }
}