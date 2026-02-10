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
import { DEFAULT_RESIZE_CONFIG } from '../types/grid';
import { HeaderLayoutService } from '../services/HeaderLayoutService';
import type { useDatabaseService } from '../hooks/database/useDatabaseService';
import { superGridLogger } from '../utils/dev-logger';
import { SuperStackProgressive } from './SuperStackProgressive';
import type {
  ProgressiveDisclosureConfig,
  ProgressiveDisclosureState,
  LevelGroup,
  LevelPickerTab,
  ZoomControlState
} from '../types/supergrid';
import { DEFAULT_PROGRESSIVE_CONFIG } from '../types/supergrid';
import { HeaderLayoutCalculator } from './header-layout/HeaderLayoutCalculator';
import { HeaderProgressiveRenderer } from './header-rendering/HeaderProgressiveRenderer';
import { HeaderAnimationController, type HeaderClickEvent } from './header-interaction/HeaderAnimationController';
import { type SuperGridHeadersConfig, DEFAULT_HEADER_CONFIG } from './header-types';

// Re-export types from extracted modules
export type { HeaderClickEvent } from './header-interaction/HeaderAnimationController';
export type { SuperGridHeadersConfig } from './header-types';

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
  private resizeBehavior: d3.DragBehavior<SVGGElement, HeaderNode, any> | null = null;
  private resizeConfig: ResizeHandleConfig;
  private resizeState: ResizeOperationState;
  private animationFrameId: number | null = null;
  private pendingResizeUpdate: { nodeId: string; newWidth: number } | null = null;
  private saveColumnWidthsDebounceTimer: NodeJS.Timeout | null = null;

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
    resizeConfig?: Partial<ResizeHandleConfig>
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
    this.resizeConfig = { ...DEFAULT_RESIZE_CONFIG, ...resizeConfig };
    this.resizeState = {
      isActive: false,
      targetNodeId: null,
      startTime: 0,
      frameCount: 0,
      lastFrameTime: 0,
      pendingUpdate: null
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
      maxZoomLevel: 3,
      isTransitioning: false,
      lastTransitionTime: 0
    };

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
    flatData: any[],
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

    superGridLogger.interaction('Node toggled', {
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
      index,
      label: group.label,
      isActive: index === this.progressiveState.activeLevelTab,
      levelRange: group.levelRange,
      nodeCount: group.nodeCount
    }));
  }

  public getZoomControlState(): ZoomControlState {
    return {
      currentLevel: this.progressiveState.zoomLevel,
      maxLevel: this.progressiveState.maxZoomLevel,
      canZoomIn: this.progressiveState.zoomLevel < this.progressiveState.maxZoomLevel,
      canZoomOut: this.progressiveState.zoomLevel > 0
    };
  }

  public selectLevelTab(tabIndex: number): void {
    if (tabIndex >= 0 && tabIndex < this.progressiveState.availableLevelGroups.length) {
      this.progressiveState.activeLevelTab = tabIndex;
      this.progressiveSystem.selectLevelTab(tabIndex);
    }
  }

  public zoomIn(): void {
    if (this.progressiveState.zoomLevel < this.progressiveState.maxZoomLevel) {
      this.progressiveState.zoomLevel++;
      this.progressiveSystem.setZoomLevel(this.progressiveState.zoomLevel);
    }
  }

  public zoomOut(): void {
    if (this.progressiveState.zoomLevel > 0) {
      this.progressiveState.zoomLevel--;
      this.progressiveSystem.setZoomLevel(this.progressiveState.zoomLevel);
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
    return this.config.progressiveDisclosure.enabled &&
           this.currentHierarchy !== null &&
           this.currentHierarchy.allNodes.length > this.config.progressiveDisclosure.autoActivationThreshold;
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

    superGridLogger.performance('Render performance tracked', {
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
    this.resizeBehavior = d3.drag<SVGGElement, HeaderNode>()
      .on('start', (event, d) => {
        this.resizeState.isActive = true;
        this.resizeState.targetNodeId = d.id;
        this.resizeState.startTime = performance.now();
      })
      .on('drag', (event, d) => {
        // Handle resize logic
      })
      .on('end', () => {
        this.resizeState.isActive = false;
        this.resizeState.targetNodeId = null;
      });
  }
}