/**
 * Types and interfaces for SuperStack Progressive Disclosure System
 */

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
  currentLevel: number;              // Current zoom level (0 = most detailed)
  maxLevel: number;                  // Maximum available zoom level
  canZoomIn: boolean;                // Whether zoom in is possible
  canZoomOut: boolean;               // Whether zoom out is possible
  levelLabels: string[];             // Human-readable labels for zoom levels
}

// Overall progressive state for persistence
export interface ProgressiveState {
  visibleLevels: number[];           // Currently visible levels
  currentTab: number;                // Active level picker tab
  zoomLevel: number;                 // Current zoom level
  levelGroups: LevelGroup[];         // Current level groups
  loadedLevels: number[];           // Levels currently loaded
}

// Default configuration
export const DEFAULT_SUPERSTACK_CONFIG: SuperStackProgressiveConfig = {
  maxVisibleLevels: 3,
  autoGroupThreshold: 5,
  semanticGrouping: true,
  enableZoomControls: true,
  enableLevelPicker: true,
  transitionDuration: 300,
  lazyLoadingBuffer: 2,
};