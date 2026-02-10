/**
 * Progressive disclosure types for managing hierarchical header complexity.
 *
 * These types support the progressive disclosure system that manages
 * deep hierarchies by grouping levels and providing zoom/step navigation.
 *
 * @module types/progressive-disclosure
 */

/**
 * Progressive Disclosure Configuration
 *
 * Controls how progressive disclosure system handles deep hierarchies
 * by grouping levels and managing transition animations.
 */
export interface ProgressiveDisclosureConfig {
  maxVisibleLevels: number;          // Maximum header levels visible simultaneously (default: 3)
  autoGroupThreshold: number;        // Header depth threshold triggering progressive disclosure (default: 5)
  semanticGroupingEnabled: boolean;  // Enable semantic grouping (time/location patterns)
  dataGroupingFallback: boolean;     // Enable data density grouping as fallback
  transitionDuration: number;        // Animation duration for level changes (ms)
  lazyLoadingBuffer: number;         // Number of levels to pre-load off-screen
  enableZoomControls: boolean;       // Show zoom in/out controls
  enableLevelPicker: boolean;        // Show level picker tabs
  persistLevelState: boolean;        // Persist selected levels across sessions
}

/**
 * Progressive Disclosure State
 *
 * Tracks current state of progressive disclosure system for persistence
 * and UI coordination between React controls and D3 visualization.
 */
export interface ProgressiveDisclosureState {
  currentLevels: number[];           // Currently visible header levels
  availableLevelGroups: LevelGroup[]; // Computed level groups for navigation
  activeLevelTab: number;            // Active level picker tab index
  zoomLevel: number;                 // Current zoom level (0 = most detailed)
  isTransitioning: boolean;          // Whether level transition is in progress
  lastTransitionTime: number;        // Timestamp of last level change
}

/**
 * Level Group for organizing deep hierarchies
 *
 * Groups related header levels together for progressive navigation.
 * For example: "Q1 2024" might group Jan/Feb/Mar levels.
 */
export interface LevelGroup {
  id: string;                        // Unique identifier for this group
  levels: number[];                  // Header levels included in this group
  nodeCount: number;                 // Total nodes across all levels in group
  semanticContext?: string;          // Semantic meaning (e.g., "temporal", "geographical")
  isCollapsed: boolean;              // Whether group is collapsed in UI
  hasComputedNodes: boolean;         // Whether group contains computed/aggregated nodes
}

/**
 * Level Picker Tab
 *
 * UI representation for level group selection in progressive disclosure controls.
 */
export interface LevelPickerTab {
  id: string;                        // Unique tab identifier
  index: number;                     // Tab position index
  label: string;                     // Display text for tab
  levels: number[];                  // Header levels this tab represents
  isActive: boolean;                 // Whether tab is currently selected
  nodeCount: number;                 // Number of nodes across tab's levels
  tooltip?: string;                  // Optional tooltip text
}

/**
 * Zoom Control State
 *
 * State for zoom in/out controls in progressive disclosure system.
 */
export interface ZoomControlState {
  currentLevel: number;              // Current zoom level
  maxLevel: number;                  // Maximum zoom level available
  canZoomIn: boolean;                // Whether zoom in is available
  canZoomOut: boolean;               // Whether zoom out is available
  levelLabels: string[];             // Human-readable labels for each level
}

/**
 * Progressive Performance Metrics
 *
 * Performance tracking for progressive disclosure rendering decisions.
 */
export interface ProgressivePerformanceMetrics {
  // Render times by level
  levelRenderTimes: Map<number, number>;        // Level → render time (ms)
  averageRenderTime: number;                    // Average across all levels
  worstCaseRenderTime: number;                  // Slowest level render time

  // Memory usage tracking
  visibleNodeCount: number;                     // Currently rendered nodes
  hiddenNodeCount: number;                      // Nodes held in memory but not rendered
  totalMemoryUsageMB: number;                   // Estimated memory usage

  // User interaction metrics
  transitionCount: number;                      // Number of level changes
  averageTransitionTime: number;                // Average transition duration
  userPauseDurations: number[];                 // Time spent at each level

  // Performance thresholds
  renderBudgetMs: number;                       // Target render time per level
  memoryBudgetMB: number;                       // Target memory usage limit
  isWithinBudget: boolean;                      // Whether current metrics are acceptable

  // Adaptive behavior state
  hasReducedComplexity: boolean;                // Whether system has simplified rendering
  fallbackRenderingActive: boolean;            // Whether fallback rendering is in use
  lastOptimizationTime: number;                // Timestamp of last performance optimization
}

/**
 * Default progressive disclosure configuration
 */
export const DEFAULT_PROGRESSIVE_CONFIG: ProgressiveDisclosureConfig = {
  maxVisibleLevels: 3,
  autoGroupThreshold: 5,
  semanticGroupingEnabled: true,
  dataGroupingFallback: true,
  transitionDuration: 300,
  lazyLoadingBuffer: 2,
  enableZoomControls: true,
  enableLevelPicker: true,
  persistLevelState: true
};

/**
 * Progressive disclosure events for coordination between components
 */
export interface ProgressiveDisclosureEvents {
  onLevelChange: (newLevels: number[], oldLevels: number[]) => void;
  onZoomChange: (newLevel: number, oldLevel: number) => void;
  onTabChange: (newTab: number, oldTab: number) => void;
  onTransitionStart: (targetLevels: number[]) => void;
  onTransitionComplete: (completedLevels: number[]) => void;
  onPerformanceThresholdExceeded: (metrics: ProgressivePerformanceMetrics) => void;
}