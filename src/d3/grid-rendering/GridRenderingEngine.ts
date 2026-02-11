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
import { SuperGridHeaders, type HeaderClickEvent } from '../SuperGridHeaders';
import { HeaderLayoutService } from '../../services/supergrid/HeaderLayoutService';
import { superGridLogger } from '../../utils/dev-logger';

export interface RenderingConfig {
  cardWidth: number;
  cardHeight: number;
  padding: number;
  headerHeight: number;
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

    const xFacet = this.currentProjection.xAxis?.facet;
    const yFacet = this.currentProjection.yAxis?.facet;

    // Extract unique X-axis values
    const columns: string[] = xFacet
      ? [
          ...new Set(
            cards
              .map((c) => (c as Record<string, unknown>)[xFacet])
              .filter((v) => v != null)
              .map((v) => String(v))
          ),
        ].sort()
      : [];

    // Extract unique Y-axis values
    const rows: string[] = yFacet
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

    const xFacet = this.currentProjection.xAxis?.facet;
    const yFacet = this.currentProjection.yAxis?.facet;
    const cardRecord = card as Record<string, unknown>;

    // Get X position
    let col = -1;
    if (xFacet) {
      const xValue = cardRecord[xFacet];
      col =
        xValue != null
          ? headers.columns.indexOf(String(xValue))
          : headers.columns.indexOf('Unassigned');
    }

    // Get Y position
    let row = -1;
    if (yFacet) {
      const yValue = cardRecord[yFacet];
      row =
        yValue != null
          ? headers.rows.indexOf(String(yValue))
          : headers.rows.indexOf('Unassigned');
    }

    return { row, col };
  }

  /**
   * Compute positions for all cards based on projection
   */
  private computeAllPositions(cards: unknown[]): void {
    if (!this.currentProjection) {
      return;
    }

    // Generate headers from unique values
    this.currentHeaders = this.generateProjectionHeaders(cards);

    // Compute position for each card
    cards.forEach((card) => {
      const pos = this.computeCellPosition(card, this.currentHeaders!);
      const cardRecord = card as Record<string, unknown>;
      cardRecord._projectedRow = pos.row;
      cardRecord._projectedCol = pos.col;
    });

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
   * Main render method
   */
  public render(activeFilters: unknown[] = []): void {
    this.setupGridStructure();

    if (!this.currentData) {
      this.renderEmptyState();
      return;
    }

    // Compute positions from projection
    if (this.currentProjection && this.currentData.cards) {
      this.computeAllPositions(this.currentData.cards);
    }

    this.updateGridLayout();

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
    return maxX + this.config.cardWidth + this.config.padding * 2;
  }

  /**
   * Calculate grid height based on content
   */
  private getGridHeight(): number {
    if (!this.currentData) return 600; // Default height

    const cardsPerRow = Math.floor((this.getGridWidth() - this.config.padding) /
                                  (this.config.cardWidth + this.config.padding));
    const rows = Math.ceil(this.currentData.cards.length / cardsPerRow);

    return rows * (this.config.cardHeight + this.config.padding) +
           this.config.padding + this.config.headerHeight;
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
    if (!this.currentData?.cards || !this.currentHeaders) return;

    const headerOffset = this.config.headerHeight + this.config.padding;
    const rowHeaderWidth = 120; // Width for row labels

    this.currentData.cards.forEach((card: unknown) => {
      const cardRecord = card as Record<string, unknown>;
      const row = cardRecord._projectedRow as number;
      const col = cardRecord._projectedCol as number;

      // Calculate position in grid
      if (col >= 0) {
        cardRecord.x =
          rowHeaderWidth +
          this.config.padding +
          col * (this.config.cardWidth + this.config.padding);
      }
      if (row >= 0) {
        cardRecord.y =
          headerOffset + row * (this.config.cardHeight + this.config.padding);
      }
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
   * Render headers from projection (column + row labels)
   */
  private renderProjectionHeaders(): void {
    if (!this.currentHeaders) return;

    const headerContainer = this.container.select('.headers');
    headerContainer.selectAll('*').remove();

    const rowHeaderWidth = 120;
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
   * Setup basic grid structure (containers, etc.)
   */
  private setupGridStructure(): void {
    // Clear existing content
    this.container.selectAll('*').remove();

    // Create main containers
    this.container.append('g').attr('class', 'headers');
    this.container.append('g').attr('class', 'grid-content');

    // Set up viewport
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
      );

    // Add card background
    cardEnter
      .append('rect')
      .attr('width', this.config.cardWidth)
      .attr('height', this.config.cardHeight)
      .attr('rx', 8)
      .attr('fill', 'white')
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

    // Update existing cards
    const cardUpdate = cardSelection
      .attr('transform', (d: CardRecord) =>
        `translate(${(d.x as number) || 0}, ${(d.y as number) || 0})`
      );

    // Remove old cards
    cardSelection
      .exit()
      .remove();

    // Merge enter and update for final customization
    const cardMerged = cardEnter.merge(cardUpdate);

    // Allow external customization
    if (this.callbacks.onCardRender) {
      this.callbacks.onCardRender(cardMerged);
    }

    superGridLogger.debug('Cards rendered', {
      total: this.currentData.cards.length,
      new: cardEnter.size(),
      updated: cardUpdate.size()
    });
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