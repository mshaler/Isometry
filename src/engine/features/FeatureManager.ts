/**
 * FeatureManager - Manages SuperGrid feature flags and configuration
 *
 * Extracted from SuperGridEngine.ts to handle feature flag management,
 * configuration validation, and feature lifecycle coordination.
 */

/**
 * Feature flags controlling Super* feature availability
 */
export interface SuperFeatureFlags {
  // Core features
  superStack: boolean;        // Nested PAFV headers
  superDensity: boolean;      // Janus density controls
  superSize: boolean;         // Inline cell expansion
  superZoom: boolean;         // Cartographic navigation
  superDynamic: boolean;      // Drag-and-drop axis repositioning
  superCalc: boolean;         // Formula bar with PAFV functions
  superSearch: boolean;       // Cross-dimensional search
  superAudit: boolean;        // Computed cell visualization

  // Advanced features
  progressiveRendering: boolean;  // Progressive disclosure for deep hierarchies
  liveUpdates: boolean;          // Real-time data updates
  collaboration: boolean;        // Multi-user collaboration
  performance: boolean;          // Performance monitoring overlay
  accessibility: boolean;       // Enhanced accessibility features
  analytics: boolean;           // User interaction analytics
}

/**
 * Configuration for individual Super* features
 */
export interface SuperFeatureConfigs {
  superStack: SuperStackConfig;
  superCalc: SuperCalcConfig;
  superSearch: SuperSearchConfig;
  superAudit: SuperAuditConfig;
}

interface SuperStackConfig {
  maxLevels?: number;
  enableDragDrop?: boolean;
  animationDuration?: number;
  compactMode?: boolean;
}

interface SuperCalcConfig {
  enableFormulas?: boolean;
  showFormulaBar?: boolean;
  supportedFunctions?: string[];
  autoComplete?: boolean;
}

interface SuperSearchConfig {
  enableFTS?: boolean;
  highlightMatches?: boolean;
  searchDelay?: number;
  maxResults?: number;
}

interface SuperAuditConfig {
  highlightColor?: string;
  showComputedBadges?: boolean;
  auditTrail?: boolean;
  exportAuditLog?: boolean;
}

/**
 * Events for feature state changes
 */
export interface FeatureEvents {
  onFeatureToggled: (feature: keyof SuperFeatureFlags, enabled: boolean) => void;
  onConfigChanged: (feature: string, config: unknown) => void;
  onFeatureError: (feature: string, error: Error) => void;
  onPerformanceWarning: (feature: string, metrics: unknown) => void;
}

export class FeatureManager {
  private features: SuperFeatureFlags;
  private configs: SuperFeatureConfigs;
  private events: FeatureEvents;
  private performanceMetrics: Map<string, any> = new Map();

  constructor(
    initialFeatures: Partial<SuperFeatureFlags> = {},
    configs: Partial<SuperFeatureConfigs> = {},
    events: Partial<FeatureEvents> = {}
  ) {
    this.features = this.createDefaultFeatures(initialFeatures);
    this.configs = this.createDefaultConfigs(configs);
    this.events = {
      onFeatureToggled: () => {},
      onConfigChanged: () => {},
      onFeatureError: () => {},
      onPerformanceWarning: () => {},
      ...events
    };
  }

  /**
   * Check if a feature is enabled
   */
  public isEnabled(feature: keyof SuperFeatureFlags): boolean {
    return this.features[feature];
  }

  /**
   * Toggle a feature on/off
   */
  public toggle(feature: keyof SuperFeatureFlags, enabled?: boolean): void {
    const newState = enabled !== undefined ? enabled : !this.features[feature];

    // Validate feature dependencies
    if (newState && !this.validateFeatureDependencies(feature)) {
      const error = new Error(`Cannot enable ${feature}: missing dependencies`);
      this.events.onFeatureError(feature, error);
      return;
    }

    const oldState = this.features[feature];
    this.features[feature] = newState;

    if (oldState !== newState) {
      this.events.onFeatureToggled(feature, newState);

      // Handle feature lifecycle
      if (newState) {
        this.onFeatureEnabled(feature);
      } else {
        this.onFeatureDisabled(feature);
      }
    }
  }

  /**
   * Update configuration for a feature
   */
  public updateConfig<T extends keyof SuperFeatureConfigs>(
    feature: T,
    config: Partial<SuperFeatureConfigs[T]>
  ): void {
    this.configs[feature] = {
      ...this.configs[feature],
      ...config
    };

    this.events.onConfigChanged(feature, this.configs[feature]);
  }

  /**
   * Get configuration for a feature
   */
  public getConfig<T extends keyof SuperFeatureConfigs>(feature: T): SuperFeatureConfigs[T] {
    return this.configs[feature];
  }

  /**
   * Get all enabled features
   */
  public getEnabledFeatures(): (keyof SuperFeatureFlags)[] {
    return Object.entries(this.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature as keyof SuperFeatureFlags);
  }

  /**
   * Get all feature flags
   */
  public getAllFeatures(): SuperFeatureFlags {
    return { ...this.features };
  }

  /**
   * Get performance metrics for features
   */
  public getPerformanceMetrics(): Map<string, any> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Record performance metrics for a feature
   */
  public recordPerformance(feature: string, metrics: unknown): void {
    this.performanceMetrics.set(feature, {
      ...this.performanceMetrics.get(feature),
      ...metrics,
      timestamp: Date.now()
    });

    // Check performance thresholds
    if (this.isPerformanceWarning(feature, metrics)) {
      this.events.onPerformanceWarning(feature, metrics);
    }
  }

  /**
   * Export feature configuration
   */
  public exportConfiguration(): {
    features: SuperFeatureFlags;
    configs: SuperFeatureConfigs;
    timestamp: number;
  } {
    return {
      features: { ...this.features },
      configs: JSON.parse(JSON.stringify(this.configs)),
      timestamp: Date.now()
    };
  }

  /**
   * Import feature configuration
   */
  public importConfiguration(configuration: {
    features: Partial<SuperFeatureFlags>;
    configs: Partial<SuperFeatureConfigs>;
  }): void {
    // Update features
    Object.entries(configuration.features).forEach(([feature, enabled]) => {
      if (enabled !== undefined) {
        this.toggle(feature as keyof SuperFeatureFlags, enabled);
      }
    });

    // Update configs
    Object.entries(configuration.configs).forEach(([feature, config]) => {
      if (config) {
        this.updateConfig(feature as keyof SuperFeatureConfigs, config);
      }
    });
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.features = this.createDefaultFeatures();
    this.configs = this.createDefaultConfigs();
    this.performanceMetrics.clear();
  }

  /**
   * Validate feature dependencies
   */
  private validateFeatureDependencies(feature: keyof SuperFeatureFlags): boolean {
    const dependencies: { [K in keyof SuperFeatureFlags]?: (keyof SuperFeatureFlags)[] } = {
      superCalc: ['superStack'], // SuperCalc requires SuperStack for formula targets
      superAudit: ['superStack'], // SuperAudit requires SuperStack for computed cells
      superDynamic: ['superStack'], // SuperDynamic requires headers to reposition
      progressiveRendering: ['superStack'] // Progressive rendering needs SuperStack
    };

    const requiredFeatures = dependencies[feature] || [];
    return requiredFeatures.every(required => this.features[required]);
  }

  /**
   * Handle feature being enabled
   */
  private onFeatureEnabled(feature: keyof SuperFeatureFlags): void {
    // Feature-specific initialization logic could go here
    switch (feature) {
      case 'superCalc':
        // Initialize formula engine
        break;
      case 'superSearch':
        // Initialize search index
        break;
      case 'analytics':
        // Start analytics tracking
        break;
    }
  }

  /**
   * Handle feature being disabled
   */
  private onFeatureDisabled(feature: keyof SuperFeatureFlags): void {
    // Feature-specific cleanup logic could go here
    switch (feature) {
      case 'superCalc':
        // Cleanup formula engine
        break;
      case 'superSearch':
        // Clear search index
        break;
      case 'analytics':
        // Stop analytics tracking
        break;
    }
  }

  /**
   * Check if performance metrics indicate a warning
   */
  private isPerformanceWarning(_feature: string, metrics: unknown): boolean {
    const thresholds = {
      renderTime: 100, // ms
      memoryUsage: 50, // MB
      frameRate: 30 // fps
    };

    return (
      (metrics.renderTime && metrics.renderTime > thresholds.renderTime) ||
      (metrics.memoryUsage && metrics.memoryUsage > thresholds.memoryUsage) ||
      (metrics.frameRate && metrics.frameRate < thresholds.frameRate)
    );
  }

  /**
   * Create default feature flags
   */
  private createDefaultFeatures(partial: Partial<SuperFeatureFlags> = {}): SuperFeatureFlags {
    return {
      superStack: true,
      superDensity: true,
      superSize: true,
      superZoom: true,
      superDynamic: false, // Disabled by default due to complexity
      superCalc: false,    // Disabled by default - requires formula engine
      superSearch: true,
      superAudit: false,   // Disabled by default - performance impact
      progressiveRendering: true,
      liveUpdates: false,  // Disabled by default - requires WebSocket
      collaboration: false, // Disabled by default - requires backend
      performance: false,   // Disabled by default - debug mode
      accessibility: true,
      analytics: false,    // Disabled by default - privacy
      ...partial
    };
  }

  /**
   * Create default feature configurations
   */
  private createDefaultConfigs(partial: Partial<SuperFeatureConfigs> = {}): SuperFeatureConfigs {
    return {
      superStack: {
        maxLevels: 5,
        enableDragDrop: false,
        animationDuration: 300,
        compactMode: false
      },
      superCalc: {
        enableFormulas: false,
        showFormulaBar: false,
        supportedFunctions: ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'],
        autoComplete: true
      },
      superSearch: {
        enableFTS: true,
        highlightMatches: true,
        searchDelay: 300,
        maxResults: 100
      },
      superAudit: {
        highlightColor: '#ffeb3b',
        showComputedBadges: true,
        auditTrail: false,
        exportAuditLog: false
      },
      ...partial
    };
  }
}