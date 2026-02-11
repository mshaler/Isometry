/**
 * SuperStack Progressive Disclosure System
 *
 * Manages visual complexity when hierarchical headers get deep (depth > threshold).
 * Implements Section 2.1 of SuperGrid specification.
 *
 * This is the main coordinator that orchestrates the various specialized modules.
 */

import * as d3 from 'd3';
import type { HeaderHierarchy } from '../types/grid';
import type { useDatabaseService } from '../hooks/database/useDatabaseService';
import { superGridLogger } from '../utils/dev-logger';

// Import extracted modules
import {
  SuperStackProgressiveConfig,
  LevelGroup,
  LevelPickerTab,
  ZoomControlState,
  ProgressiveState,
  DEFAULT_SUPERSTACK_CONFIG
} from './superstack/types';
import { LevelGroupManager } from './superstack/levelGroupManager';
import { LevelPickerManager } from './superstack/levelPickerManager';
import { ZoomControlManager } from './superstack/zoomControlManager';
import { ProgressiveRenderer } from './superstack/progressiveRenderer';
import { StateManager } from './superstack/stateManager';

export class SuperStackProgressive {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: SuperStackProgressiveConfig;
  private currentHierarchy: HeaderHierarchy | null = null;
  private visibleLevels: number[] = [0, 1, 2];

  // Specialized managers
  private levelGroupManager: LevelGroupManager;
  private levelPickerManager: LevelPickerManager;
  private zoomControlManager: ZoomControlManager;
  private renderer: ProgressiveRenderer;
  private stateManager: StateManager;

  constructor(
    container: HTMLElement | SVGElement,
    config: Partial<SuperStackProgressiveConfig> = {},
    database: ReturnType<typeof useDatabaseService> | null = null
  ) {
    this.config = { ...DEFAULT_SUPERSTACK_CONFIG, ...config };
    this.container = d3.select(container) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;

    // Initialize specialized managers
    this.levelGroupManager = new LevelGroupManager();
    this.levelPickerManager = new LevelPickerManager();
    this.zoomControlManager = new ZoomControlManager(this.config);
    this.renderer = new ProgressiveRenderer(this.container, this.config);
    this.stateManager = new StateManager(database);

    this.initializeStructure();

    // Restore state on initialization if database is available
    if (database) {
      this.restoreState();
    }

    superGridLogger.setup('SuperStack Progressive Disclosure initialized', {});
  }

  /**
   * Update the hierarchy and trigger progressive disclosure analysis
   */
  public updateHierarchy(hierarchy: HeaderHierarchy): void {
    this.currentHierarchy = hierarchy;

    superGridLogger.render('Progressive disclosure analysis starting', {
      maxDepth: hierarchy.maxDepth,
      nodeCount: hierarchy.allNodes.length
    });

    // Determine if progressive disclosure is needed
    if (this.shouldUseProgressiveDisclosure()) {
      this.analyzeHierarchy();
    } else {
      // Hierarchy is shallow enough, show all levels
      this.visibleLevels = Array.from({ length: hierarchy.maxDepth + 1 }, (_, i) => i);
      this.renderer.renderAllLevels(hierarchy);
    }

    this.saveState();
    superGridLogger.render('Progressive disclosure analysis complete', {});
  }

  /**
   * Set which levels are currently visible
   */
  public setVisibleLevels(levels: number[]): void {
    if (!this.currentHierarchy) return;

    // Validate levels are within hierarchy bounds
    const validLevels = levels.filter(level =>
      level >= 0 && level <= this.currentHierarchy!.maxDepth
    );

    // Limit to max visible levels
    if (validLevels.length > this.config.maxVisibleLevels) {
      validLevels.splice(this.config.maxVisibleLevels);
    }

    const oldLevels = [...this.visibleLevels];
    this.visibleLevels = validLevels;

    // Animate transition between levels
    this.renderer.animateLevelTransition(this.currentHierarchy, oldLevels, validLevels);

    // Update level picker state
    this.levelPickerManager.updateActiveTab(this.visibleLevels);

    this.saveState();

    superGridLogger.state('Visible levels changed', {
      oldLevels,
      newLevels: validLevels
    });
  }

  /**
   * Get currently visible levels
   */
  public getVisibleLevels(): number[] {
    return [...this.visibleLevels];
  }

  /**
   * Step down one level in the hierarchy (3D camera effect)
   */
  public stepDown(): void {
    if (!this.currentHierarchy) return;

    this.zoomControlManager.stepDown(
      this.visibleLevels,
      this.currentHierarchy,
      (newLevels) => this.setVisibleLevels(newLevels)
    );
  }

  /**
   * Step up one level in the hierarchy (3D camera effect)
   */
  public stepUp(): void {
    if (!this.currentHierarchy) return;

    this.zoomControlManager.stepUp(
      this.visibleLevels,
      (newLevels) => this.setVisibleLevels(newLevels)
    );
  }

  /**
   * Select a level picker tab
   */
  public selectLevelTab(tabIndex: number): void {
    const tab = this.levelPickerManager.selectTab(tabIndex);
    if (tab) {
      // Set visible levels to tab's levels
      this.setVisibleLevels(tab.levels);
    }
  }

  /**
   * Get level picker state for UI rendering
   */
  public getLevelPickerState(): { tabs: LevelPickerTab[]; currentTab: number } {
    return this.levelPickerManager.getState();
  }

  /**
   * Get zoom control state for UI rendering
   */
  public getZoomControlState(): ZoomControlState {
    return this.zoomControlManager.getZoomControlState(this.currentHierarchy);
  }

  /**
   * Get semantic groups if available
   */
  public getSemanticGroups(): LevelGroup[] {
    return this.levelGroupManager.getSemanticGroups();
  }

  /**
   * Get data density groups
   */
  public getDataDensityGroups(): LevelGroup[] {
    return this.levelGroupManager.getDataDensityGroups();
  }

  /**
   * Check if auto-grouping is being used
   */
  public hasAutoGrouping(): boolean {
    if (!this.currentHierarchy) return false;
    return this.levelGroupManager.hasAutoGrouping(this.currentHierarchy, this.config);
  }

  /**
   * Get loaded levels
   */
  public getLoadedLevels(): number[] {
    return this.renderer.getLoadedLevels();
  }

  /**
   * Set state context for persistence
   */
  public setStateContext(datasetId: string, appContext: string): void {
    this.stateManager.setStateContext(datasetId, appContext);

    // Restore state for new context
    this.restoreState();
  }

  /**
   * Restore progressive disclosure state from database
   */
  public restoreState(): void {
    const state = this.stateManager.restoreState();
    if (state) {
      this.visibleLevels = state.visibleLevels;
      this.zoomControlManager.setZoomLevel(state.zoomLevel);

      if (this.currentHierarchy) {
        // Recreate level groups and tabs with restored state
        this.levelGroupManager.buildLevelGroups(this.currentHierarchy, this.config);
        this.levelPickerManager.createTabs(
          this.currentHierarchy,
          state.levelGroups,
          this.config,
          state.currentTab
        );
      }
    }
  }

  /**
   * Initialize progressive disclosure structure
   */
  private initializeStructure(): void {
    this.renderer.initializeStructure();
  }

  /**
   * Check if progressive disclosure should be used
   */
  private shouldUseProgressiveDisclosure(): boolean {
    if (!this.currentHierarchy) return false;
    return this.currentHierarchy.maxDepth >= this.config.autoGroupThreshold;
  }

  /**
   * Analyze hierarchy and set up progressive disclosure
   */
  private analyzeHierarchy(): void {
    if (!this.currentHierarchy) return;

    // Build level groups
    this.levelGroupManager.buildLevelGroups(this.currentHierarchy, this.config);

    // Create level picker tabs
    this.levelPickerManager.createTabs(
      this.currentHierarchy,
      this.levelGroupManager.getAllGroups(),
      this.config
    );

    // Render progressively
    this.renderer.renderProgressively(this.currentHierarchy, this.visibleLevels);
  }

  /**
   * Save current state
   */
  private saveState(): void {
    const currentTab = this.levelPickerManager.getState().currentTab;
    const zoomLevel = this.zoomControlManager.getZoomLevel();
    const levelGroups = this.levelGroupManager.getAllGroups();
    const loadedLevels = this.renderer.getLoadedLevels();

    this.stateManager.saveState(
      this.visibleLevels,
      currentTab,
      zoomLevel,
      levelGroups,
      loadedLevels
    );
  }
}

// Re-export types for convenience
export type {
  SuperStackProgressiveConfig,
  LevelGroup,
  LevelPickerTab,
  ZoomControlState,
  ProgressiveState
};