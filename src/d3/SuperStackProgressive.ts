/**
 * SuperStack Progressive Disclosure System
 *
 * Manages visual complexity when hierarchical headers get deep (depth > threshold).
 * Implements Section 2.1 of SuperGrid specification.
 *
 * Key Features:
 * - Level picker tabs (show only 2-3 levels at once)
 * - Zoom controls for header navigation
 * - Auto-grouping when depth exceeds threshold (semantic grouping first, then data density)
 * - 3D camera stairstepping down hierarchy
 * - Per-dataset, per-app state persistence via sql.js
 * - Progressive rendering with lazy loading fallback
 * - Smooth D3 transitions for level changes
 */

import * as d3 from 'd3';
import type { HeaderNode, HeaderHierarchy } from '../types/grid';
import type { useDatabaseService } from '../hooks/database/useDatabaseService';
import { superGridLogger } from '../utils/dev-logger';

// Progressive disclosure configuration
export interface SuperStackProgressiveConfig {
  maxVisibleLevels: number;          // Maximum levels visible at once (default: 3)
  autoGroupThreshold: number;        // Depth threshold for auto-grouping (default: 5)
  semanticGrouping: boolean;         // Enable semantic grouping (default: true)
  enableZoomControls: boolean;       // Enable zoom in/out controls (default: true)
  enableLevelPicker: boolean;        // Enable level picker tabs (default: true)
  transitionDuration: number;        // Animation duration for level changes (ms)
  lazyLoadingBuffer: number;         // Number of levels to pre-load (default: 2)
}

// Level group for organizing deep hierarchies
export interface LevelGroup {
  id: string;                        // Unique group identifier
  name: string;                      // Display name for the group
  levels: number[];                  // Array of levels in this group
  type: 'semantic' | 'density';     // Grouping strategy used
  expanded: boolean;                 // Whether this group is expanded
  nodeCount: number;                 // Total nodes in this group
}

// Level picker tab state
export interface LevelPickerTab {
  id: string;                        // Tab identifier
  label: string;                     // Tab display label
  levels: number[];                  // Levels shown in this tab
  isActive: boolean;                 // Currently active tab
  nodeCount: number;                 // Total nodes in these levels
}

// Zoom control state
export interface ZoomControlState {
  canZoomIn: boolean;                // Whether zoom in is possible
  canZoomOut: boolean;               // Whether zoom out is possible
  currentLevel: number;              // Current zoom level (0 = most detailed)
  maxLevel: number;                  // Maximum zoom level available
  levelLabels: string[];             // Labels for each zoom level
}

// Progressive state for persistence
export interface ProgressiveState {
  datasetId: string;                 // Dataset context
  appContext: string;                // App context
  visibleLevels: number[];           // Currently visible levels
  currentTab: number;                // Active level picker tab
  zoomLevel: number;                 // Current zoom level
  groups: LevelGroup[];              // Computed level groups
  lastUpdated: string;               // ISO timestamp
}

export class SuperStackProgressive {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: SuperStackProgressiveConfig;
  private database: ReturnType<typeof useDatabaseService> | null = null;

  // State management
  private currentHierarchy: HeaderHierarchy | null = null;
  private visibleLevels: number[] = [0, 1, 2];
  private levelGroups: LevelGroup[] = [];
  private levelPickerTabs: LevelPickerTab[] = [];
  private loadedLevels: Set<number> = new Set();
  private currentTab: number = 0;
  private zoomLevel: number = 0;

  // State persistence properties
  private currentDatasetId: string = 'default';
  private currentAppContext: string = 'supergrid';
  private saveStateDebounceTimer: NodeJS.Timeout | null = null;

  // Animation tracking
  private runningTransitions: Set<string> = new Set();

  // Default configuration
  private static readonly DEFAULT_CONFIG: SuperStackProgressiveConfig = {
    maxVisibleLevels: 3,
    autoGroupThreshold: 5,
    semanticGrouping: true,
    enableZoomControls: true,
    enableLevelPicker: true,
    transitionDuration: 300,
    lazyLoadingBuffer: 2
  };

  // Semantic grouping patterns
  private static readonly SEMANTIC_PATTERNS = {
    time: {
      facets: ['year', 'quarter', 'month', 'week', 'day'],
      groupName: 'Time',
      maxLevelsPerGroup: 3
    },
    location: {
      facets: ['country', 'region', 'state', 'city', 'neighborhood'],
      groupName: 'Location',
      maxLevelsPerGroup: 3
    },
    hierarchy: {
      facets: ['department', 'team', 'role', 'person'],
      groupName: 'Organization',
      maxLevelsPerGroup: 2
    },
    category: {
      facets: ['category', 'subcategory', 'type', 'subtype'],
      groupName: 'Categories',
      maxLevelsPerGroup: 2
    }
  };

  constructor(
    container: SVGElement,
    config: Partial<SuperStackProgressiveConfig> = {},
    database?: ReturnType<typeof useDatabaseService>
  ) {
    this.container = d3.select(container);
    this.config = { ...SuperStackProgressive.DEFAULT_CONFIG, ...config };
    this.database = database || null;

    this.initializeStructure();

    // Restore state on initialization if database is available
    if (this.database) {
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
      this.buildLevelGroups();
      this.createLevelPickerTabs();
      this.renderProgressively();
    } else {
      // Hierarchy is shallow enough, show all levels
      this.visibleLevels = Array.from({ length: hierarchy.maxDepth + 1 }, (_, i) => i);
      this.renderAllLevels();
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
    this.animateLevelTransition(oldLevels, validLevels);

    // Update level picker state
    this.updateLevelPickerState();

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

    const maxLevel = this.currentHierarchy.maxDepth;
    const currentMax = Math.max(...this.visibleLevels);

    // Check if we can step down
    if (currentMax >= maxLevel) return;

    // Calculate new levels by shifting down one
    const newLevels = this.visibleLevels.map(level => level + 1);
    this.setVisibleLevels(newLevels);

    superGridLogger.state('Stepped down hierarchy', {
      from: this.visibleLevels,
      to: newLevels
    });
  }

  /**
   * Step up one level in the hierarchy (3D camera effect)
   */
  public stepUp(): void {
    if (!this.currentHierarchy) return;

    const currentMin = Math.min(...this.visibleLevels);

    // Check if we can step up
    if (currentMin <= 0) return;

    // Calculate new levels by shifting up one
    const newLevels = this.visibleLevels.map(level => level - 1);
    this.setVisibleLevels(newLevels);

    superGridLogger.state('Stepped up hierarchy', {
      from: this.visibleLevels,
      to: newLevels
    });
  }

  /**
   * Select a specific level picker tab
   */
  public selectLevelTab(tabIndex: number): void {
    if (tabIndex < 0 || tabIndex >= this.levelPickerTabs.length) return;

    this.currentTab = tabIndex;
    const tab = this.levelPickerTabs[tabIndex];

    // Update tab states
    this.levelPickerTabs.forEach((t, i) => {
      t.isActive = i === tabIndex;
    });

    // Set visible levels to tab's levels
    this.setVisibleLevels(tab.levels);

    superGridLogger.state('Level tab selected', {
      tabIndex,
      tabLabel: tab.label,
      levels: tab.levels
    });
  }

  /**
   * Get level picker state for UI rendering
   */
  public getLevelPickerState(): { tabs: LevelPickerTab[]; currentTab: number } {
    return {
      tabs: [...this.levelPickerTabs],
      currentTab: this.currentTab
    };
  }

  /**
   * Get zoom control state for UI rendering
   */
  public getZoomControlState(): ZoomControlState {
    if (!this.currentHierarchy) {
      return {
        canZoomIn: false,
        canZoomOut: false,
        currentLevel: 0,
        maxLevel: 0,
        levelLabels: []
      };
    }

    const maxLevel = Math.max(0, Math.ceil(this.currentHierarchy.maxDepth / this.config.maxVisibleLevels) - 1);

    return {
      canZoomIn: this.zoomLevel > 0,
      canZoomOut: this.zoomLevel < maxLevel,
      currentLevel: this.zoomLevel,
      maxLevel,
      levelLabels: this.generateZoomLevelLabels(maxLevel + 1)
    };
  }

  /**
   * Get semantic groups if available
   */
  public getSemanticGroups(): LevelGroup[] {
    return this.levelGroups.filter(group => group.type === 'semantic');
  }

  /**
   * Get data density groups
   */
  public getDataDensityGroups(): LevelGroup[] {
    return this.levelGroups.filter(group => group.type === 'density');
  }

  /**
   * Check if auto-grouping is active
   */
  public hasAutoGrouping(): boolean {
    return this.levelGroups.length > 0;
  }

  /**
   * Get currently loaded levels (for lazy loading)
   */
  public getLoadedLevels(): number[] {
    return Array.from(this.loadedLevels).sort((a, b) => a - b);
  }

  /**
   * Set state context for persistence
   */
  public setStateContext(datasetId: string, appContext: string): void {
    this.currentDatasetId = datasetId;
    this.currentAppContext = appContext;

    // Restore state for new context
    if (this.database) {
      this.restoreState();
    }
  }

  /**
   * Restore progressive disclosure state from database
   */
  public restoreState(): void {
    const db = this.database;
    if (!db) return;

    try {
      const savedState = db.loadProgressiveState?.(
        this.currentDatasetId,
        this.currentAppContext
      );

      if (savedState) {
        this.visibleLevels = savedState.visibleLevels || [0, 1, 2];
        this.currentTab = savedState.currentTab || 0;
        this.zoomLevel = (savedState as any).zoomLevel || 0;

        if ((savedState as any).groups) {
          this.levelGroups = (savedState as any).groups;
        }

        superGridLogger.state('Progressive state restored', {
          datasetId: this.currentDatasetId,
          appContext: this.currentAppContext,
          visibleLevels: this.visibleLevels
        });
      }

      // Also restore level visibility state
      const levelVisibility = db.loadLevelVisibility?.(
        this.currentDatasetId,
        this.currentAppContext
      );

      if (levelVisibility?.visibleLevels) {
        this.visibleLevels = levelVisibility.visibleLevels;
      }

    } catch (error) {
      console.error('❌ Error restoring progressive state:', error);
    }
  }

  // Private methods

  private initializeStructure(): void {
    // Create progressive container
    this.container.select('.progressive-container').remove();

    const progressiveContainer = this.container.append('g')
      .attr('class', 'progressive-container');

    // Create level containers for visible levels
    for (let i = 0; i < this.config.maxVisibleLevels; i++) {
      progressiveContainer.append('g')
        .attr('class', `progressive-level-${i}`)
        .style('opacity', 0); // Start hidden
    }

    superGridLogger.setup('Progressive structure initialized', {});
  }

  private shouldUseProgressiveDisclosure(): boolean {
    if (!this.currentHierarchy) return false;

    return this.currentHierarchy.maxDepth >= this.config.autoGroupThreshold;
  }

  private analyzeHierarchy(): void {
    if (!this.currentHierarchy) return;

    // Reset state
    this.levelGroups = [];
    this.levelPickerTabs = [];

    superGridLogger.metrics('Analyzing hierarchy for progressive disclosure', {
      maxDepth: this.currentHierarchy.maxDepth,
      nodeCount: this.currentHierarchy.allNodes.length,
      autoGroupThreshold: this.config.autoGroupThreshold
    });
  }

  private buildLevelGroups(): void {
    if (!this.currentHierarchy) return;

    if (this.config.semanticGrouping) {
      this.buildSemanticGroups();
    }

    // Always build data density groups as fallback
    this.buildDataDensityGroups();

    superGridLogger.metrics('Level groups built', {
      semanticGroups: this.getSemanticGroups().length,
      densityGroups: this.getDataDensityGroups().length
    });
  }

  private buildSemanticGroups(): void {
    if (!this.currentHierarchy) return;

    // Group levels by facet patterns
    const facetsByLevel = this.currentHierarchy.allNodes.reduce((acc, node) => {
      if (!acc[node.level]) acc[node.level] = new Set();
      acc[node.level].add(node.facet);
      return acc;
    }, {} as Record<number, Set<string>>);

    // Find semantic patterns
    for (const [patternKey, pattern] of Object.entries(SuperStackProgressive.SEMANTIC_PATTERNS)) {
      const matchingLevels: number[] = [];

      for (let level = 0; level <= this.currentHierarchy.maxDepth; level++) {
        const facetsAtLevel = facetsByLevel[level];
        if (facetsAtLevel) {
          const hasPatternFacet = pattern.facets.some(facet => facetsAtLevel.has(facet));
          if (hasPatternFacet) {
            matchingLevels.push(level);
          }
        }
      }

      // Create groups if we found matching levels
      if (matchingLevels.length >= 2) {
        // Split into chunks of maxLevelsPerGroup
        const chunks = this.chunkArray(matchingLevels, pattern.maxLevelsPerGroup);

        chunks.forEach((levels, index) => {
          const groupName = chunks.length > 1
            ? `${pattern.groupName} ${index + 1}`
            : pattern.groupName;

          const nodeCount = levels.reduce((sum, level) => {
            return sum + this.currentHierarchy!.allNodes.filter(n => n.level === level).length;
          }, 0);

          this.levelGroups.push({
            id: `${patternKey}-${index}`,
            name: groupName,
            levels,
            type: 'semantic',
            expanded: false,
            nodeCount
          });
        });
      }
    }
  }

  private buildDataDensityGroups(): void {
    if (!this.currentHierarchy) return;

    // Group levels by node density
    const nodeCountsByLevel = this.currentHierarchy.allNodes.reduce((acc, node) => {
      acc[node.level] = (acc[node.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const levels = Object.keys(nodeCountsByLevel).map(Number).sort((a, b) => a - b);

    // Create density groups
    const densityGroups = this.chunkArray(levels, this.config.maxVisibleLevels);

    densityGroups.forEach((groupLevels, index) => {
      const nodeCount = groupLevels.reduce((sum, level) => {
        return sum + (nodeCountsByLevel[level] || 0);
      }, 0);

      const avgDensity = Math.round(nodeCount / groupLevels.length);
      const densityLabel = avgDensity < 5 ? 'Light' : avgDensity < 15 ? 'Medium' : 'Dense';

      this.levelGroups.push({
        id: `density-${index}`,
        name: `${densityLabel} Detail`,
        levels: groupLevels,
        type: 'density',
        expanded: index === 0, // First group expanded by default
        nodeCount
      });
    });
  }

  private createLevelPickerTabs(): void {
    if (!this.currentHierarchy) return;

    // Create tabs from level groups or default chunking
    if (this.levelGroups.length > 0) {
      // Use level groups to create tabs
      this.levelPickerTabs = this.levelGroups.map((group, index) => ({
        id: group.id,
        label: group.name,
        levels: group.levels,
        isActive: index === this.currentTab,
        nodeCount: group.nodeCount
      }));
    } else {
      // Default chunking by maxVisibleLevels
      const allLevels = Array.from({ length: this.currentHierarchy.maxDepth + 1 }, (_, i) => i);
      const chunks = this.chunkArray(allLevels, this.config.maxVisibleLevels);

      this.levelPickerTabs = chunks.map((levels, index) => {
        const nodeCount = levels.reduce((sum, level) => {
          return sum + this.currentHierarchy!.allNodes.filter(n => n.level === level).length;
        }, 0);

        return {
          id: `tab-${index}`,
          label: `Levels ${levels[0]}-${levels[levels.length - 1]}`,
          levels,
          isActive: index === this.currentTab,
          nodeCount
        };
      });
    }

    // Update current tab state
    if (this.currentTab >= this.levelPickerTabs.length) {
      this.currentTab = 0;
    }

    this.levelPickerTabs.forEach((tab, index) => {
      tab.isActive = index === this.currentTab;
    });
  }

  private renderProgressively(): void {
    if (!this.currentHierarchy) return;

    superGridLogger.render('Progressive rendering started', {});

    // Load visible levels immediately
    this.visibleLevels.forEach(level => this.loadLevel(level));

    // Lazy load buffer levels
    this.lazyLoadBufferLevels();

    // Render visible levels with transitions
    this.renderVisibleLevels();

    superGridLogger.render('Progressive rendering complete', {});
  }

  private renderAllLevels(): void {
    if (!this.currentHierarchy) return;

    // Simple fallback: render all levels directly
    const allLevels = Array.from({ length: this.currentHierarchy.maxDepth + 1 }, (_, i) => i);
    allLevels.forEach(level => this.loadLevel(level));
    this.renderVisibleLevels();
  }

  private loadLevel(level: number): void {
    if (this.loadedLevels.has(level)) return;

    this.loadedLevels.add(level);

    superGridLogger.metrics(`Level ${level} loaded`, {
      loadedCount: this.loadedLevels.size
    });
  }

  private lazyLoadBufferLevels(): void {
    if (!this.currentHierarchy) return;

    const minVisible = Math.min(...this.visibleLevels);
    const maxVisible = Math.max(...this.visibleLevels);

    // Load buffer levels around visible range
    for (let i = 0; i < this.config.lazyLoadingBuffer; i++) {
      const beforeLevel = minVisible - i - 1;
      const afterLevel = maxVisible + i + 1;

      if (beforeLevel >= 0) {
        setTimeout(() => this.loadLevel(beforeLevel), i * 50);
      }

      if (afterLevel <= this.currentHierarchy.maxDepth) {
        setTimeout(() => this.loadLevel(afterLevel), i * 50);
      }
    }
  }

  private renderVisibleLevels(): void {
    if (!this.currentHierarchy) return;

    const progressiveContainer = this.container.select('.progressive-container');

    // Update level containers
    this.visibleLevels.forEach((level, index) => {
      const levelContainer = progressiveContainer.select(`.progressive-level-${index}`);

      if (!levelContainer.empty()) {
        levelContainer
          .attr('transform', `translate(0, ${index * 40})`) // 40px per level
          .style('opacity', 1);

        // Render nodes for this level
        this.renderLevelNodes(levelContainer, level);
      }
    });

    // Hide non-visible level containers
    for (let i = this.visibleLevels.length; i < this.config.maxVisibleLevels; i++) {
      progressiveContainer.select(`.progressive-level-${i}`)
        .style('opacity', 0);
    }
  }

  private renderLevelNodes(container: d3.Selection<any, unknown, null, undefined>, level: number): void {
    if (!this.currentHierarchy) return;

    const nodesAtLevel = this.currentHierarchy.allNodes.filter(node => node.level === level);

    // Use D3 data join pattern for nodes at this level
    const nodeGroups = container
      .selectAll<SVGGElement, HeaderNode>('.progressive-node')
      .data(nodesAtLevel, (d: HeaderNode) => d.id);

    // Enter new nodes
    const entering = nodeGroups.enter()
      .append('g')
      .attr('class', 'progressive-node')
      .attr('transform', (d: HeaderNode) => `translate(${d.x}, 0)`)
      .style('opacity', 0);

    // Add node visuals (simplified for now)
    entering.append('rect')
      .attr('class', 'progressive-node-bg')
      .attr('width', (d: HeaderNode) => d.width)
      .attr('height', 40)
      .attr('fill', '#f8fafc')
      .attr('stroke', '#e2e8f0');

    entering.append('text')
      .attr('class', 'progressive-node-label')
      .attr('x', (d: HeaderNode) => d.width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text((d: HeaderNode) => d.label);

    // Update all nodes
    const allNodes = nodeGroups.merge(entering as any);

    allNodes
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 1)
      .attr('transform', (d: HeaderNode) => `translate(${d.x}, 0)`);

    // Exit old nodes
    nodeGroups.exit()
      .transition()
      .duration(this.config.transitionDuration)
      .style('opacity', 0)
      .remove();
  }

  private animateLevelTransition(oldLevels: number[], newLevels: number[]): void {
    const transitionId = `level-transition-${Date.now()}`;
    this.runningTransitions.add(transitionId);

    // Animate smooth transition between level sets
    const progressiveContainer = this.container.select('.progressive-container');

    // Fade out old levels not in new set
    oldLevels.forEach((level, index) => {
      if (!newLevels.includes(level)) {
        progressiveContainer.select(`.progressive-level-${index}`)
          .transition()
          .duration(this.config.transitionDuration)
          .style('opacity', 0);
      }
    });

    // Fade in new levels
    setTimeout(() => {
      this.renderVisibleLevels();
      this.runningTransitions.delete(transitionId);
    }, this.config.transitionDuration / 2);

    superGridLogger.state('Level transition animated', {
      from: oldLevels,
      to: newLevels,
      transitionId
    });
  }

  private updateLevelPickerState(): void {
    // Update which tab should be active based on current visible levels
    this.levelPickerTabs.forEach((tab, index) => {
      const hasOverlap = tab.levels.some(level => this.visibleLevels.includes(level));
      if (hasOverlap && index !== this.currentTab) {
        this.currentTab = index;
      }
      tab.isActive = index === this.currentTab;
    });
  }

  private generateZoomLevelLabels(count: number): string[] {
    const labels = [];
    for (let i = 0; i < count; i++) {
      if (i === 0) labels.push('Detail');
      else if (i === count - 1) labels.push('Overview');
      else labels.push(`Level ${i}`);
    }
    return labels;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private saveState(): void {
    const db = this.database;
    if (!db) return;

    // Clear existing debounce timer
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }

    // Debounce saves to prevent excessive database writes
    this.saveStateDebounceTimer = setTimeout(() => {
      const state: ProgressiveState = {
        datasetId: this.currentDatasetId,
        appContext: this.currentAppContext,
        visibleLevels: this.visibleLevels,
        currentTab: this.currentTab,
        zoomLevel: this.zoomLevel,
        groups: this.levelGroups,
        lastUpdated: new Date().toISOString()
      };

      try {
        // Save progressive state
        const result = db.saveProgressiveState?.(this.currentDatasetId, this.currentAppContext, state);

        // Also save level visibility for compatibility
        const levelResult = db.saveLevelVisibility?.(
          this.currentDatasetId,
          this.currentAppContext,
          this.visibleLevels
        );

        if (result?.success || levelResult?.success) {
          superGridLogger.state('Progressive state saved', {
            datasetId: this.currentDatasetId,
            appContext: this.currentAppContext,
            visibleLevels: this.visibleLevels
          });
        }
      } catch (error) {
        console.error('❌ Error saving progressive state:', error);
      }
    }, 300); // 300ms debounce
  }
}