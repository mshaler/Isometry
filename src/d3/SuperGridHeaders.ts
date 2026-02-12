/**
 * SuperGridHeaders - Main orchestrator for hierarchical header rendering
 *
 * Coordinates layout calculation, progressive rendering, and animations
 * through focused modules.
 */

import * as d3 from 'd3';
import type {
  HeaderNode,
  HeaderHierarchy,
  ResizeHandleConfig,
  ResizeOperationState
} from '../types/grid';
import type { StackedAxisConfig, SortDirection } from '../types/pafv';
import { HeaderLayoutService } from '../services/supergrid/HeaderLayoutService';
import type { useDatabaseService } from '../hooks/database/useDatabaseService';
import { superGridLogger } from '../utils/dev-logger';
import { SuperStackProgressive } from './SuperStackProgressive';
import type {
  ProgressiveDisclosureState,
  LevelPickerTab,
  ZoomControlState
} from '../types/supergrid';
import { HeaderLayoutCalculator } from './header-layout/HeaderLayoutCalculator';
import { HeaderProgressiveRenderer } from './header-rendering/HeaderProgressiveRenderer';
import { HeaderAnimationController, type HeaderClickEvent } from './header-interaction/HeaderAnimationController';
import { type SuperGridHeadersConfig, DEFAULT_HEADER_CONFIG } from './header-types';

// Re-export types from extracted modules
export type { HeaderClickEvent } from './header-interaction/HeaderAnimationController';
export type { SuperGridHeadersConfig } from './header-types';

/**
 * Internal sort state for tracking current sort configuration
 */
interface SortState {
  facet: string;
  direction: SortDirection;
  nodeId: string;
}

/**
 * Stacked header click event details
 */
export interface StackedHeaderClickEvent {
  nodeId: string;
  facet: string;
  value: string;
  level: number;
  sortDirection?: SortDirection;
  event: MouseEvent;
}

/**
 * Callbacks for stacked header interactions
 */
export interface StackedHeaderCallbacks {
  onHeaderClick?: (event: StackedHeaderClickEvent) => void;
}

export class SuperGridHeaders {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private layoutService: HeaderLayoutService;
  private config: SuperGridHeadersConfig;
  private currentHierarchy: HeaderHierarchy | null = null;
  private database: ReturnType<typeof useDatabaseService> | null = null;

  // Extracted modules
  private layoutCalculator: HeaderLayoutCalculator;
  private progressiveRenderer: HeaderProgressiveRenderer;
  private animationController: HeaderAnimationController;

  // Progressive disclosure system
  private progressiveSystem: SuperStackProgressive;
  private progressiveState: ProgressiveDisclosureState;
  private maxZoomLevel: number = 3;

  // Performance tracking for lazy fallback
  private renderStartTime: number = 0;
  private renderCount: number = 0;
  private averageRenderTime: number = 0;

  // State persistence properties
  private saveStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentDatasetId: string = 'default';
  private currentAppContext: string = 'supergrid';

  // Event callbacks
  private onExpandCollapse?: (nodeId: string, isExpanded: boolean) => void;

  // Column resize functionality (Phase 39)
  private resizeState: ResizeOperationState;

  // Sort state for header click sorting (Phase 60-03)
  private currentSortState: SortState | null = null;
  private stackedCallbacks: StackedHeaderCallbacks | undefined;

  // Re-export the config for compatibility
  private static readonly DEFAULT_CONFIG = DEFAULT_HEADER_CONFIG;

  constructor(
    container: SVGElement,
    layoutService: HeaderLayoutService,
    config: Partial<SuperGridHeadersConfig> = {},
    callbacks: {
      onHeaderClick?: (event: HeaderClickEvent) => void;
      onExpandCollapse?: (nodeId: string, isExpanded: boolean) => void;
    } = {},
    database?: ReturnType<typeof useDatabaseService>,
    _resizeConfig?: Partial<ResizeHandleConfig>
  ) {
    this.container = d3.select(container);
    this.layoutService = layoutService;
    this.config = { ...SuperGridHeaders.DEFAULT_CONFIG, ...config };
    this.onExpandCollapse = callbacks.onExpandCollapse;
    this.database = database || null;

    // Initialize extracted modules
    this.layoutCalculator = new HeaderLayoutCalculator();
    this.progressiveRenderer = new HeaderProgressiveRenderer(
      this.container as any,
      this.config
    );
    this.animationController = new HeaderAnimationController(
      this.container as any,
      this.config,
      callbacks.onHeaderClick
    );

    // Initialize resize configuration
    this.resizeState = {
      isActive: false,
      targetNodeId: '',
      startX: 0,
      startY: 0,
      startWidth: 0,
      affectedNodes: []
    };

    // Initialize progressive disclosure system
    this.progressiveSystem = new SuperStackProgressive(
      container,
      {
        maxVisibleLevels: this.config.progressiveDisclosure.maxVisibleLevels,
        autoGroupThreshold: this.config.progressiveDisclosure.autoGroupThreshold,
        semanticGrouping: this.config.progressiveDisclosure.semanticGroupingEnabled,
        enableZoomControls: this.config.progressiveDisclosure.enableZoomControls,
        enableLevelPicker: this.config.progressiveDisclosure.enableLevelPicker,
        transitionDuration: this.config.progressiveDisclosure.transitionDuration,
        lazyLoadingBuffer: this.config.progressiveDisclosure.lazyLoadingBuffer
      },
      this.database as any
    );

    // Initialize progressive state
    this.progressiveState = {
      currentLevels: [0, 1, 2],
      availableLevelGroups: [],
      activeLevelTab: 0,
      zoomLevel: 0,
      isTransitioning: false,
      lastTransitionTime: 0
    };
    this.maxZoomLevel = 3;

    this.progressiveRenderer.initializeStructure();
    this.initializeColumnResizeBehavior();

    // Restore state on initialization if database is available
    if (this.database) {
      this.restoreHeaderState();
      this.restoreColumnWidths();
      this.progressiveSystem.restoreState();
    }
  }

  /**
   * Render hierarchical headers from flat data
   */
  public renderHeaders(
    flatData: unknown[],
    axis: string,
    facetField: string = 'status',
    totalWidth: number = 800
  ): void {
    superGridLogger.render('Header rendering starting', {
      dataCount: flatData.length,
      axis,
      facetField,
      totalWidth
    });

    this.renderStartTime = performance.now();

    try {
      // Generate hierarchy using layout service
      this.currentHierarchy = this.layoutService.generateHeaderHierarchy(
        flatData,
        axis,
        facetField
      );

      superGridLogger.metrics('Header hierarchy generated', {
        rootNodesCount: this.currentHierarchy.rootNodes.length,
        totalNodesCount: this.currentHierarchy.allNodes.length,
        maxDepth: this.currentHierarchy.maxDepth
      });

      // Calculate span widths for all nodes
      this.layoutCalculator.calculateHierarchyWidths(this.currentHierarchy, totalWidth);

      // Check if progressive disclosure is needed
      if (this.isProgressiveDisclosureActive()) {
        // Use progressive disclosure system
        this.progressiveSystem.updateHierarchy(this.currentHierarchy);
        this.updateProgressiveStateFromSystem();
        superGridLogger.render('Using progressive disclosure system', {});
      } else {
        // Progressive rendering decision for shallow hierarchies
        if (this.progressiveRenderer.shouldUseProgressiveRendering(this.currentHierarchy)) {
          this.progressiveRenderer.renderProgressively(this.currentHierarchy);
        } else {
          this.progressiveRenderer.renderAllLevels(this.currentHierarchy);
        }
      }

      this.trackRenderPerformance();

    } catch (error) {
      console.error('❌ SuperGridHeaders.renderHeaders(): Error:', error);
      this.renderFallback();
    }

    superGridLogger.render('Header rendering complete', {});
  }

  /**
   * Render hierarchical headers from flat data with stacked axis support
   * Detects StackedAxisConfig and delegates to stacked rendering
   */
  public renderHeadersWithConfig(
    flatData: unknown[],
    axis: string,
    facetFieldOrConfig: string | StackedAxisConfig = 'status',
    totalWidth: number = 800
  ): void {
    // Check if this is a stacked axis configuration
    if (typeof facetFieldOrConfig === 'object' && 'facets' in facetFieldOrConfig) {
      // Stacked axis - generate multi-level hierarchy
      const stackedHierarchy = this.layoutService.generateStackedHierarchy(
        flatData,
        facetFieldOrConfig
      );
      this.renderStackedHeaders(stackedHierarchy, axis as 'x' | 'y', totalWidth);
      return;
    }

    // Single facet - existing behavior
    this.renderHeaders(flatData, axis, facetFieldOrConfig, totalWidth);
  }

  /**
   * Render stacked (multi-level) headers from hierarchy
   * Used when PAFV axis has multiple facets assigned
   *
   * @param hierarchy - Pre-computed HeaderHierarchy from generateStackedHierarchy
   * @param orientation - 'x' for column headers, 'y' for row headers
   * @param totalWidth - Available width for header rendering
   * @param callbacks - Optional callbacks for header interactions
   */
  public renderStackedHeaders(
    hierarchy: HeaderHierarchy,
    orientation: 'x' | 'y',
    totalWidth: number,
    callbacks?: StackedHeaderCallbacks
  ): void {
    console.log('[SuperGridHeaders.renderStackedHeaders] Starting...', {
      orientation,
      maxDepth: hierarchy?.maxDepth,
      totalNodes: hierarchy?.allNodes?.length,
      totalWidth
    });

    // Validate hierarchy
    if (!hierarchy || !hierarchy.allNodes || hierarchy.allNodes.length === 0) {
      console.warn('[SuperGridHeaders.renderStackedHeaders] Empty or invalid hierarchy, skipping render');
      return;
    }

    superGridLogger.render('Stacked header rendering starting', {
      orientation,
      maxDepth: hierarchy.maxDepth,
      totalNodes: hierarchy.allNodes.length,
      totalWidth
    });

    try {
      this.currentHierarchy = hierarchy;

      // Calculate span widths for all nodes
      console.log('[SuperGridHeaders.renderStackedHeaders] Calculating widths...');
      this.layoutCalculator.calculateHierarchyWidths(hierarchy, totalWidth);

      // Delegate to progressive renderer for multi-level rendering
      console.log('[SuperGridHeaders.renderStackedHeaders] Rendering multi-level...');
      this.progressiveRenderer.renderMultiLevel(
        hierarchy,
        orientation,
        {
          levelHeight: this.config.defaultHeaderHeight,
          animationDuration: this.config.progressiveDisclosure.transitionDuration
        }
      );

      // Wire up click handlers for each level
      console.log('[SuperGridHeaders.renderStackedHeaders] Setting up interactions...');
      this.setupStackedHeaderInteractions(hierarchy, callbacks);

      console.log('[SuperGridHeaders.renderStackedHeaders] Complete');
      superGridLogger.render('Stacked header rendering complete', {
        levelsRendered: hierarchy.maxDepth + 1
      });
    } catch (error) {
      console.error('[SuperGridHeaders.renderStackedHeaders] ERROR:', error);
      this.renderFallback();
    }
  }

  /**
   * Handle header click for sorting
   * Toggle through asc -> desc -> null cycle
   */
  private handleHeaderSortClick(node: HeaderNode): void {
    const facet = node.facet || node.label;

    // Determine new sort direction
    let newDirection: SortDirection;
    if (this.currentSortState?.facet === facet) {
      // Toggle: asc -> desc -> null
      if (this.currentSortState.direction === 'asc') {
        newDirection = 'desc';
      } else if (this.currentSortState.direction === 'desc') {
        newDirection = null;
      } else {
        newDirection = 'asc';
      }
    } else {
      // New facet, start with ascending
      newDirection = 'asc';
    }

    // Update internal state
    if (newDirection === null) {
      this.currentSortState = null;
    } else {
      this.currentSortState = {
        facet,
        direction: newDirection,
        nodeId: node.id
      };
    }

    // Update visual indicator via animation controller
    this.animationController.animateSortIndicator(
      node.id,
      newDirection
    );

    // Emit event for external handling
    if (this.stackedCallbacks?.onHeaderClick) {
      this.stackedCallbacks.onHeaderClick({
        nodeId: node.id,
        facet,
        value: node.label,
        level: node.level,
        sortDirection: newDirection,
        event: new MouseEvent('click')
      });
    }

    superGridLogger.debug('Header sort clicked', {
      facet,
      direction: newDirection,
      level: node.level
    });
  }

  /**
   * Setup click interactions for stacked headers with sort behavior
   * Each level can be clicked for sorting/filtering
   */
  private setupStackedHeaderInteractions(
    hierarchy: HeaderHierarchy,
    callbacks?: StackedHeaderCallbacks
  ): void {
    // Store callbacks for use in handleHeaderSortClick
    this.stackedCallbacks = callbacks;

    // Select all header nodes and attach click handler
    // Using arrow functions for click to access class instance
    // Using regular functions for mouseenter/leave to access DOM element via d3.select
    this.container
      .selectAll<SVGGElement, HeaderNode>('.header-node')
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: HeaderNode) => {
        _event.stopPropagation();
        this.handleHeaderSortClick(d);
      })
      .on('mouseenter', function() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- D3 callback requires DOM element access
        const element = this;
        d3.select(element).select('.header-bg')
          .transition()
          .duration(150)
          .attr('fill', '#e2e8f0'); // Hover highlight
      })
      .on('mouseleave', (_event: MouseEvent, d: HeaderNode) => {
        // Use event.currentTarget instead of this for DOM element
        const element = _event.currentTarget as SVGGElement;
        const isSelected = this.currentSortState?.nodeId === d.id;
        d3.select(element).select('.header-bg')
          .transition()
          .duration(150)
          .attr('fill', isSelected ? '#dbeafe' : '#f8fafc');
      });

    superGridLogger.debug('Stacked header interactions setup', {
      nodeCount: hierarchy.allNodes.length
    });
  }

  /**
   * Get the current sort state
   */
  public getSortState(): SortState | null {
    return this.currentSortState ? { ...this.currentSortState } : null;
  }

  /**
   * Clear the current sort state
   */
  public clearSortState(): void {
    if (this.currentSortState) {
      this.animationController.clearSortIndicators();
      this.currentSortState = null;
    }
  }

  /**
   * Toggle expand/collapse state of a header node
   */
  public toggleNode(nodeId: string): void {
    if (!this.currentHierarchy) return;

    const node = this.currentHierarchy.allNodes.find(n => n.id === nodeId);
    if (!node || node.isLeaf) return;

    // Update node state
    node.isExpanded = !node.isExpanded;

    // Update visibility of children
    this.updateChildVisibility(node);

    // Trigger animation through animation controller
    this.animationController.animateToggle(node);

    // Trigger callback
    if (this.onExpandCollapse) {
      this.onExpandCollapse(nodeId, node.isExpanded);
    }

    // Save state if database is available
    if (this.database) {
      this.saveHeaderState();
    }

    superGridLogger.debug('Node toggled', {
      nodeId,
      isExpanded: node.isExpanded,
      childrenCount: node.children?.length || 0
    });
  }

  /**
   * Get current hierarchy
   */
  public getHierarchy(): HeaderHierarchy | null {
    return this.currentHierarchy;
  }

  /**
   * Set context for state persistence
   */
  public setStateContext(datasetId: string, appContext: string): void {
    if (this.currentDatasetId !== datasetId || this.currentAppContext !== appContext) {
      // Save current state before switching context
      if (this.database) {
        this.saveHeaderState();
        this.saveColumnWidths();
      }

      this.currentDatasetId = datasetId;
      this.currentAppContext = appContext;

      // Restore state for new context
      if (this.database) {
        this.restoreHeaderState();
        this.restoreColumnWidths();
      }
    }
  }

  // Progressive disclosure API methods
  public getProgressiveState(): ProgressiveDisclosureState {
    return { ...this.progressiveState };
  }

  public getLevelPickerTabs(): LevelPickerTab[] {
    return this.progressiveState.availableLevelGroups.map((group, index) => ({
      id: group.id,
      index,
      label: group.semanticContext || group.id,
      levels: group.levels,
      isActive: index === this.progressiveState.activeLevelTab,
      nodeCount: group.nodeCount
    }));
  }

  public getZoomControlState(): ZoomControlState {
    return {
      currentLevel: this.progressiveState.zoomLevel,
      maxLevel: this.maxZoomLevel,
      canZoomIn: this.progressiveState.zoomLevel < this.maxZoomLevel,
      canZoomOut: this.progressiveState.zoomLevel > 0,
      levelLabels: Array.from({ length: this.maxZoomLevel + 1 }, (_, i) => `Level ${i}`)
    };
  }

  public selectLevelTab(tabIndex: number): void {
    if (tabIndex >= 0 && tabIndex < this.progressiveState.availableLevelGroups.length) {
      this.progressiveState.activeLevelTab = tabIndex;
      this.progressiveSystem.selectLevelTab(tabIndex);
    }
  }

  public zoomIn(): void {
    if (this.progressiveState.zoomLevel < this.maxZoomLevel) {
      this.progressiveState.zoomLevel++;
      this.progressiveSystem.setVisibleLevels(
        Array.from({ length: this.progressiveState.zoomLevel + 1 }, (_, i) => i)
      );
    }
  }

  public zoomOut(): void {
    if (this.progressiveState.zoomLevel > 0) {
      this.progressiveState.zoomLevel--;
      this.progressiveSystem.setVisibleLevels(
        Array.from({ length: this.progressiveState.zoomLevel + 1 }, (_, i) => i)
      );
    }
  }

  public stepUp(): void {
    this.progressiveSystem.stepUp();
    this.updateProgressiveStateFromSystem();
  }

  public stepDown(): void {
    this.progressiveSystem.stepDown();
    this.updateProgressiveStateFromSystem();
  }

  public isProgressiveDisclosureActive(): boolean {
    return this.config.enableProgressiveRendering &&
           this.currentHierarchy !== null &&
           this.currentHierarchy.allNodes.length > this.config.progressiveDisclosure.autoGroupThreshold;
  }

  // Private helper methods
  private updateProgressiveStateFromSystem(): void {
    const levelPickerState = this.progressiveSystem.getLevelPickerState();
    const zoomState = this.progressiveSystem.getZoomControlState();

    this.progressiveState.currentLevels = this.progressiveSystem.getVisibleLevels();
    this.progressiveState.activeLevelTab = levelPickerState.currentTab;
    this.progressiveState.zoomLevel = zoomState.currentLevel;
    this.progressiveState.lastTransitionTime = Date.now();
  }

  private updateChildVisibility(node: HeaderNode): void {
    if (!node.children) return;

    node.children.forEach(child => {
      child.isVisible = node.isExpanded;
      if (!node.isExpanded) {
        // When collapsing, also collapse all descendants
        child.isExpanded = false;
        this.updateChildVisibility(child);
      }
    });
  }

  private trackRenderPerformance(): void {
    const renderTime = performance.now() - this.renderStartTime;
    this.renderCount++;

    // Calculate running average
    this.averageRenderTime = ((this.averageRenderTime * (this.renderCount - 1)) + renderTime) / this.renderCount;

    superGridLogger.metrics('Render performance tracked', {
      currentRenderTime: renderTime,
      averageRenderTime: this.averageRenderTime,
      renderCount: this.renderCount,
      budget: this.config.performanceBudgetMs,
      withinBudget: renderTime <= this.config.performanceBudgetMs
    });
  }

  private renderFallback(): void {
    superGridLogger.setup('Rendering fallback headers', {});

    // Clear any existing content
    this.container.select('.headers-container').remove();

    // Render simple fallback
    const fallbackContainer = this.container.append('g')
      .attr('class', 'headers-container fallback');

    fallbackContainer.append('rect')
      .attr('width', 800)
      .attr('height', this.config.defaultHeaderHeight)
      .attr('fill', '#f1f5f9')
      .attr('stroke', '#cbd5e1');

    fallbackContainer.append('text')
      .attr('x', 10)
      .attr('y', this.config.defaultHeaderHeight / 2)
      .attr('dy', '0.35em')
      .attr('fill', '#64748b')
      .text('Header rendering failed - using fallback');
  }

  // State persistence methods
  private saveHeaderState(): void {
    // Debounced implementation would go here
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }

    this.saveStateDebounceTimer = setTimeout(() => {
      // Implementation for saving state to database
      superGridLogger.setup('Header state saved', {
        datasetId: this.currentDatasetId,
        context: this.currentAppContext
      });
    }, 500);
  }

  private restoreHeaderState(): void {
    // Implementation for restoring state from database
    superGridLogger.setup('Header state restored', {
      datasetId: this.currentDatasetId,
      context: this.currentAppContext
    });
  }

  private saveColumnWidths(): void {
    // Implementation for saving column widths
  }

  private restoreColumnWidths(): void {
    // Implementation for restoring column widths
  }

  private initializeColumnResizeBehavior(): void {
    // Implementation for column resize behavior
    d3.drag<SVGGElement, HeaderNode>()
      .on('start', (_event, d) => {
        this.resizeState.isActive = true;
        this.resizeState.targetNodeId = d.id;
        this.resizeState.startX = _event.x;
        this.resizeState.startY = _event.y;
      })
      .on('drag', (_event, _d) => {
        // Handle resize logic
      })
      .on('end', () => {
        this.resizeState.isActive = false;
        this.resizeState.targetNodeId = '';
      });
  }
}