/**
 * SuperGridEngine - Refactored orchestration system for Super* features
 *
 * Coordinates Super* features using extracted modules:
 * - FeatureManager for feature flag management
 * - StateManager for state coordination
 * - Performance monitoring and interaction coordination
 */

import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping } from '@/types/pafv';
import type {
  JanusDensityState,
  CartographicState
} from '@/types/supergrid';
import type { CellExpansionState } from '@/components/supergrid/SuperSize';

// Import extracted modules
import { FeatureManager, type SuperFeatureFlags, type FeatureEvents } from './features/FeatureManager';
import { StateManager, type SuperGridState, type StateEventHandlers } from './state/StateManager';

/**
 * Configuration for the SuperGrid engine
 */
export interface SuperGridConfig {
  // Feature configuration
  features: Partial<SuperFeatureFlags>;

  // Performance settings
  performanceMonitoring: boolean;
  performanceThresholds: {
    renderTime: number;
    frameRate: number;
    memoryUsage: number;
  };

  // State persistence
  persistState: boolean;
  persistenceKey: string;

  // Debugging
  debugMode: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Event handlers for SuperGrid engine
 */
export interface SuperGridEventHandlers {
  onStateChange?: (state: SuperGridState) => void;
  onFeatureChange?: (feature: keyof SuperFeatureFlags, enabled: boolean) => void;
  onPerformanceIssue?: (metrics: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Interaction context for coordinating between features
 */
export interface InteractionContext {
  currentFeature: keyof SuperFeatureFlags | null;
  isInteracting: boolean;
  lastInteractionTime: number;
  interactionData: unknown;
}

export class SuperGridEngine {
  private featureManager: FeatureManager;
  private stateManager: StateManager;
  private config: SuperGridConfig;
  private eventHandlers: SuperGridEventHandlers;
  private interactionContext: InteractionContext;

  constructor(
    config: Partial<SuperGridConfig> = {},
    eventHandlers: Partial<SuperGridEventHandlers> = {}
  ) {
    this.config = this.createDefaultConfig(config);
    this.eventHandlers = eventHandlers;

    this.initializeManagers();
    this.initializeInteractionContext();
    this.setupEventHandlers();
  }

  // Public API Methods

  /**
   * Update nodes in the system
   */
  public updateNodes(nodes: Node[]): void {
    this.stateManager.updateNodes(nodes);
    this.logDebug('Nodes updated', { count: nodes.length });
  }

  /**
   * Get current system state
   */
  public getState(): SuperGridState {
    return this.stateManager.getState();
  }

  /**
   * Update partial state
   */
  public updateState(partialState: Partial<SuperGridState>): void {
    this.stateManager.updateState(partialState);
  }

  /**
   * Toggle a feature on/off
   */
  public toggleFeature(feature: keyof SuperFeatureFlags, enabled?: boolean): void {
    this.featureManager.toggle(feature, enabled);
    this.logDebug('Feature toggled', { feature, enabled });
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof SuperFeatureFlags): boolean {
    return this.featureManager.isEnabled(feature);
  }

  /**
   * Update density configuration
   */
  public updateDensity(density: Partial<JanusDensityState>): void {
    this.stateManager.updateDensity(density);
    this.recordPerformance('density', { updateTime: Date.now() });
  }

  /**
   * Update cell expansion state
   */
  public updateCellExpansion(expansion: Partial<CellExpansionState>): void {
    this.stateManager.updateCellExpansion(expansion);
  }

  /**
   * Update cartographic state
   */
  public updateCartographic(cartographic: Partial<CartographicState>): void {
    this.stateManager.updateCartographic(cartographic);
  }

  /**
   * Update search query
   */
  public updateSearch(query: string): void {
    this.stateManager.updateSearch(query);
    this.recordPerformance('search', {
      query,
      searchTime: Date.now()
    });
  }

  /**
   * Reorder axis in PAFV mapping
   */
  public reorderAxis(fromAxis: LATCHAxis, toAxis: LATCHAxis): void {
    const currentMapping = this.stateManager.getState().axisMapping;

    // Simple axis swapping logic
    const newMapping: AxisMapping = { ...currentMapping };

    // Find which planes these axes are currently mapped to
    let fromPlane: keyof AxisMapping | null = null;
    let toPlane: keyof AxisMapping | null = null;

    Object.entries(currentMapping).forEach(([plane, mapping]) => {
      if (mapping.axis === fromAxis) fromPlane = plane as keyof AxisMapping;
      if (mapping.axis === toAxis) toPlane = plane as keyof AxisMapping;
    });

    // Swap if both found
    if (fromPlane && toPlane) {
      const temp = newMapping[fromPlane];
      newMapping[fromPlane] = newMapping[toPlane];
      newMapping[toPlane] = temp;
    }

    this.stateManager.updateAxisMapping(newMapping);
    this.logDebug('Axis reordered', { fromAxis, toAxis, fromPlane, toPlane });
  }

  /**
   * Toggle audit mode
   */
  public toggleAuditMode(enabled?: boolean): void {
    this.stateManager.toggleAuditMode(enabled);
    const isEnabled = enabled !== undefined ? enabled :
                     !this.stateManager.getState().audit.enabled;
    this.logDebug('Audit mode toggled', { enabled: isEnabled });
  }

  /**
   * Get filtered nodes based on current state
   */
  public getFilteredNodes(): Node[] {
    return this.stateManager.getVisibleNodes();
  }

  /**
   * Create interaction context for feature coordination
   */
  public createInteractionContext(): InteractionContext {
    return { ...this.interactionContext };
  }

  /**
   * Update interaction context
   */
  public updateInteractionContext(update: Partial<InteractionContext>): void {
    this.interactionContext = {
      ...this.interactionContext,
      ...update,
      lastInteractionTime: Date.now()
    };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): unknown {
    return {
      features: this.featureManager.getPerformanceMetrics(),
      state: this.stateManager.getState().performance,
      engine: {
        enabledFeatures: this.featureManager.getEnabledFeatures().length,
        interactionCount: this.interactionContext.lastInteractionTime > 0 ? 1 : 0,
        uptime: Date.now() - this.initializationTime
      }
    };
  }

  /**
   * Export configuration and state
   */
  public exportConfiguration(): unknown {
    return {
      features: this.featureManager.exportConfiguration(),
      state: this.stateManager.exportState(),
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
   * Import configuration and state
   */
  public importConfiguration(configuration: unknown): void {
    if (configuration.features) {
      this.featureManager.importConfiguration(configuration.features);
    }
    if (configuration.state) {
      this.stateManager.importState(configuration.state);
    }
    this.logDebug('Configuration imported');
  }

  /**
   * Cleanup and destroy engine
   */
  public destroy(): void {
    this.stateManager.destroy();
    this.logDebug('SuperGrid engine destroyed');
  }

  // Private methods

  private initializationTime = Date.now();

  /**
   * Initialize feature and state managers
   */
  private initializeManagers(): void {
    // Initialize feature manager
    const featureEvents: FeatureEvents = {
      onFeatureToggled: (feature, enabled) => {
        this.handleFeatureToggled(feature, enabled);
      },
      onConfigChanged: (feature, config) => {
        this.logDebug('Feature config changed', { feature, config });
      },
      onFeatureError: (feature, error) => {
        this.handleError(new Error(`Feature ${feature}: ${error.message}`));
      },
      onPerformanceWarning: (feature, metrics) => {
        this.handlePerformanceWarning(feature, metrics);
      }
    };

    this.featureManager = new FeatureManager(
      this.config.features,
      {},
      featureEvents
    );

    // Initialize state manager
    const stateHandlers: StateEventHandlers = {
      onNodesChanged: (nodes) => {
        this.logDebug('Nodes changed', { count: nodes.length });
      },
      onDensityChanged: (density) => {
        this.logDebug('Density changed', { density });
      },
      onCartographicChanged: (cartographic) => {
        this.logDebug('Cartographic changed', { cartographic });
      },
      onSearchChanged: (query, results) => {
        this.logDebug('Search changed', { query, resultCount: results.length });
      },
      onAxisMappingChanged: (mapping) => {
        this.logDebug('Axis mapping changed', { mapping });
      },
      onFeatureToggled: (feature, enabled) => {
        this.handleFeatureToggled(feature, enabled);
      },
      onSelectionChanged: (selectedIds) => {
        this.logDebug('Selection changed', { count: selectedIds.size });
      },
      onError: (error) => {
        this.handleError(new Error(error));
      },
      onPerformanceUpdate: (metrics) => {
        this.checkPerformanceThresholds(metrics);
      }
    };

    this.stateManager = new StateManager(
      {}, // Initial state
      stateHandlers,
      {
        enabled: this.config.persistState,
        storageKey: this.config.persistenceKey
      }
    );
  }

  /**
   * Initialize interaction context
   */
  private initializeInteractionContext(): void {
    this.interactionContext = {
      currentFeature: null,
      isInteracting: false,
      lastInteractionTime: 0,
      interactionData: null
    };
  }

  /**
   * Setup event handlers between managers
   */
  private setupEventHandlers(): void {
    // Additional cross-manager event coordination could go here
  }

  /**
   * Handle feature toggle events
   */
  private handleFeatureToggled(feature: keyof SuperFeatureFlags, enabled: boolean): void {
    // Update state to reflect feature change
    const currentState = this.stateManager.getState();
    currentState.features[feature] = enabled;
    this.stateManager.updateState({ features: currentState.features });

    // Notify external handlers
    if (this.eventHandlers.onFeatureChange) {
      this.eventHandlers.onFeatureChange(feature, enabled);
    }

    this.recordPerformance('feature_toggle', { feature, enabled, timestamp: Date.now() });
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.stateManager.setError(error.message);

    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(error);
    }

    if (this.config.logLevel !== 'none') {
      console.error('SuperGrid error:', error);
    }
  }

  /**
   * Handle performance warnings
   */
  private handlePerformanceWarning(feature: string, metrics: unknown): void {
    if (this.eventHandlers.onPerformanceIssue) {
      this.eventHandlers.onPerformanceIssue({ feature, metrics });
    }

    this.logWarn('Performance warning', { feature, metrics });
  }

  /**
   * Record performance metrics
   */
  private recordPerformance(feature: string, metrics: unknown): void {
    if (this.config.performanceMonitoring) {
      this.featureManager.recordPerformance(feature, metrics);
    }
  }

  /**
   * Check performance against thresholds
   */
  private checkPerformanceThresholds(metrics: unknown): void {
    const thresholds = this.config.performanceThresholds;

    if (metrics.renderTime > thresholds.renderTime ||
        metrics.frameRate < thresholds.frameRate ||
        metrics.memoryUsage > thresholds.memoryUsage) {
      this.handlePerformanceWarning('engine', metrics);
    }
  }

  /**
   * Logging methods
   */
  private logDebug(message: string, data?: unknown): void {
    if (this.config.logLevel === 'debug') {
      console.warn(`[SuperGrid] ${message}`, data);
    }
  }

  private logWarn(message: string, data?: unknown): void {
    if (['warn', 'info', 'debug'].includes(this.config.logLevel)) {
      console.warn(`[SuperGrid] ${message}`, data);
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(partial: Partial<SuperGridConfig>): SuperGridConfig {
    return {
      features: {},
      performanceMonitoring: true,
      performanceThresholds: {
        renderTime: 100, // ms
        frameRate: 30,   // fps
        memoryUsage: 50  // MB
      },
      persistState: true,
      persistenceKey: 'supergrid-engine',
      debugMode: false,
      logLevel: 'warn',
      ...partial
    };
  }
}

/**
 * Factory function for creating SuperGrid engine instances
 */
export function createSuperGridEngine(
  config?: Partial<SuperGridConfig>,
  handlers?: Partial<SuperGridEventHandlers>
): SuperGridEngine {
  return new SuperGridEngine(config, handlers);
}

export default SuperGridEngine;