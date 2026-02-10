/**
 * GridRenderingEngine - Handles all grid visualization and rendering
 *
 * Extracted from SuperGrid.ts to manage card rendering, header rendering,
 * and grid structure setup.
 */

import * as d3 from 'd3';
import type { GridData, GridConfig, AxisData } from '../../types/grid';
import type { FilterCompilationResult } from '../../services/LATCHFilterService';
import { SuperGridHeaders, type HeaderClickEvent } from '../SuperGridHeaders';
import { HeaderLayoutService } from '../../services/HeaderLayoutService';
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
   * Main render method
   */
  public render(activeFilters: any[] = []): void {
    this.setupGridStructure();

    if (!this.currentData) {
      this.renderEmptyState();
      return;
    }

    this.updateGridLayout();

    if (this.config.enableHeaders) {
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
  public initializeHeaders(database: any): void {
    if (this.config.enableHeaders && !this.isHeadersInitialized) {
      this.superGridHeaders = new SuperGridHeaders(
        this.container.select('.headers'),
        this.headerLayoutService
      );

      if (database) {
        this.superGridHeaders.setDatabase(database);
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
    if (this.superGridHeaders) {
      this.superGridHeaders.clear();
      this.superGridHeaders = null;
    }

    if (this.headerLayoutService) {
      this.headerLayoutService.clear();
    }

    this.container.selectAll('*').remove();
    this.isHeadersInitialized = false;
  }

  /**
   * Calculate grid width based on content
   */
  private getGridWidth(): number {
    if (!this.currentData || !this.currentData.cards.length) return 800; // Default width

    const maxX = Math.max(...this.currentData.cards.map(card => card.x || 0));
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

    // Calculate positions for cards if they don't have them
    const cardsPerRow = Math.floor((this.getGridWidth() - this.config.padding) /
                                  (this.config.cardWidth + this.config.padding));

    this.currentData.cards.forEach((card, index) => {
      if (card.x === undefined || card.y === undefined) {
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;

        card.x = this.config.padding + col * (this.config.cardWidth + this.config.padding);
        card.y = this.config.headerHeight + this.config.padding +
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
  private renderHierarchicalHeaders(activeFilters: any[] = []): void {
    if (!this.config.enableHeaders || !this.currentData?.cards.length) {
      return;
    }

    try {
      // Generate headers from current data
      const headerData = this.generateHeaders(this.currentData.cards);

      if (headerData.length > 0 && this.superGridHeaders) {
        const hierarchy = this.headerLayoutService.buildHierarchy(headerData);
        this.superGridHeaders.renderHeaders(hierarchy);

        superGridLogger.debug('Headers rendered', {
          headerCount: headerData.length,
          maxDepth: hierarchy.maxDepth
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
      .text(`${this.currentData?.cards.length || 0} cards`);

    superGridLogger.debug('Fallback header rendered');
  }

  /**
   * Generate headers from card data
   */
  private generateHeaders(cards: any[]): AxisData[] {
    if (!this.config.enableHeaders) return [];

    // Group cards by status for header generation
    const groups: { [key: string]: any[] } = {};
    cards.forEach(card => {
      const status = card.status || 'Unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(card);
    });

    // Convert groups to header data
    return Object.entries(groups).map(([status, statusCards]) => ({
      facet: 'status',
      value: status,
      count: statusCards.length,
      cards: statusCards
    }));
  }

  /**
   * Handle hierarchical header clicks
   */
  private handleHierarchicalHeaderClick(event: HeaderClickEvent): void {
    const { action, nodeId, facet, value } = event;

    superGridLogger.debug('Header clicked', { action, nodeId, facet, value });

    if (this.callbacks.onHeaderClick) {
      this.callbacks.onHeaderClick(event);
    }

    if (action === 'select') {
      // Filter logic would go here
      superGridLogger.debug('Header filter applied', { facet, value });
    }
  }

  /**
   * Render grid cards
   */
  private renderCards(): void {
    const cardContainer = this.container.select('.grid-content');

    if (!this.currentData) {
      cardContainer.selectAll('*').remove();
      return;
    }

    // Use D3's data join pattern
    const cardSelection = cardContainer
      .selectAll('.card')
      .data(this.currentData.cards, (d: any) => d.id);

    // Enter new cards
    const cardEnter = cardSelection
      .enter()
      .append('g')
      .attr('class', 'card')
      .attr('data-card-id', d => d.id)
      .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);

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
      .text(d => d.title || d.name || `Card ${d.id}`);

    // Add card content
    cardEnter
      .append('text')
      .attr('x', 12)
      .attr('y', 48)
      .attr('font-family', 'system-ui, sans-serif')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text(d => d.description || d.content || '');

    // Update existing cards
    const cardUpdate = cardSelection
      .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);

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