/**
 * Dynamic interaction types for SuperGrid drag & drop and axis manipulation.
 *
 * These types support SuperDynamic features including drag-and-drop axis
 * repositioning, animated grid reflow, and real-time layout changes.
 *
 * @module types/dynamic-interaction
 */

import type { CellPosition } from './grid-core';

/**
 * SuperDynamic Configuration
 *
 * Controls dynamic axis repositioning and animated reflow behavior.
 * Enables drag-and-drop axis changes with smooth visual transitions.
 */
export interface SuperDynamicConfig {
  enableAxisDragging: boolean;              // Allow dragging axes between slots
  enableAnimatedReflow: boolean;            // Animate grid layout changes
  showDropZones: boolean;                   // Highlight valid drop targets
  enableAxisSwapping: boolean;              // Allow swapping axes between X/Y/Z
  enableAxisRemoval: boolean;               // Allow removing axes to reduce dimensions
  snapToGrid: boolean;                      // Snap dragged axes to grid positions
  animationDuration: number;                // Duration of reflow animations (ms)
  dragFeedbackDelay: number;                // Delay before showing drag feedback (ms)
  showPreviewDuringDrag: boolean;           // Show preview of new layout during drag
  enableKeyboardAxisNavigation: boolean;    // Allow keyboard-based axis manipulation
}

/**
 * Axis Slot Configuration
 *
 * Defines the available axis slots (X, Y, Z) and their current assignments.
 */
export interface AxisSlotConfig {
  x: { field: string | null; label: string; isRequired: boolean };
  y: { field: string | null; label: string; isRequired: boolean };
  z: { field: string | null; label: string; isRequired: boolean };
}

/**
 * Drag State
 *
 * Tracks the current state of axis dragging operations.
 */
export interface DragState {
  isDragging: boolean;                      // Whether any drag operation is active
  draggedAxis: string | null;               // Field name of axis being dragged
  draggedFromSlot: 'x' | 'y' | 'z' | null; // Which slot the axis was dragged from
  dragStartPosition: { x: number; y: number }; // Initial mouse/touch position
  currentPosition: { x: number; y: number }; // Current drag position
  validDropZones: DropZone[];               // Currently valid drop targets
  previewLayoutData: unknown | null;            // Preview data for layout changes
  dragStartTime: number;                    // Timestamp when drag started
}

/**
 * Drop Zone
 *
 * Defines a valid target area for dropping dragged axes.
 */
export interface DropZone {
  id: string;                               // Unique drop zone identifier
  slot: 'x' | 'y' | 'z' | 'remove';        // Target slot or removal action
  bounds: {                                 // Screen coordinates of drop zone
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  isActive: boolean;                        // Whether zone is currently valid
  isHighlighted: boolean;                   // Whether zone should show visual feedback
  label: string;                            // Display text for drop zone
  action: 'swap' | 'assign' | 'remove';    // What happens when axis is dropped here
}

/**
 * Grid Reflow Options
 *
 * Configuration for animated grid layout transitions.
 */
export interface GridReflowOptions {
  animationType: 'fade' | 'slide' | 'morph' | 'none'; // Type of transition animation
  duration: number;                         // Animation duration in ms
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'; // Easing function
  staggerDelay: number;                     // Delay between animating different elements
  preserveSelection: boolean;               // Maintain selected cards during reflow
  showLoadingState: boolean;                // Show loading indicator during reflow
  onComplete?: () => void;                  // Callback when reflow completes
}

/**
 * Axis Change Event
 *
 * Event data for axis configuration changes.
 */
export interface AxisChangeEvent {
  type: 'assign' | 'swap' | 'remove' | 'reorder';
  field: string;                            // Field being changed
  fromSlot?: 'x' | 'y' | 'z';              // Source slot (for swaps/moves)
  toSlot?: 'x' | 'y' | 'z';                // Target slot (for assignments/swaps)
  previousConfig: AxisSlotConfig;           // Configuration before change
  newConfig: AxisSlotConfig;                // Configuration after change
  affectedCardCount: number;                // Number of cards that will move
  estimatedRenderTime: number;              // Predicted time for layout change
  userInitiated: boolean;                   // Whether change was triggered by user action
  timestamp: number;                        // When the change occurred
}

/**
 * Drag Feedback State
 *
 * Visual feedback state during drag operations.
 */
export interface DragFeedbackState {
  showGhostImage: boolean;                  // Whether to show dragged axis ghost
  ghostOpacity: number;                     // Opacity of ghost image (0-1)
  showDropPreviews: boolean;                // Whether to show drop zone previews
  highlightValidTargets: boolean;           // Whether to highlight valid drop zones
  showLayoutPreview: boolean;               // Whether to show preview of new layout
  previewData: {                            // Preview layout data
    cards: Array<{
      id: string;
      currentPosition: CellPosition;
      targetPosition: CellPosition;
      isMoving: boolean;
    }>;
    axes: AxisSlotConfig;
    estimatedTransitionTime: number;
  } | null;
}

/**
 * Default SuperDynamic configuration
 */
export const DEFAULT_SUPER_DYNAMIC_CONFIG: SuperDynamicConfig = {
  enableAxisDragging: true,
  enableAnimatedReflow: true,
  showDropZones: true,
  enableAxisSwapping: true,
  enableAxisRemoval: false, // Disabled by default for data safety
  snapToGrid: true,
  animationDuration: 600,
  dragFeedbackDelay: 100,
  showPreviewDuringDrag: true,
  enableKeyboardAxisNavigation: true
};

/**
 * Dynamic interaction events for coordination between components
 */
export interface DynamicInteractionEvents {
  onDragStart: (axis: string, fromSlot: 'x' | 'y' | 'z') => void;
  onDragMove: (position: { x: number; y: number }, validDropZones: DropZone[]) => void;
  onDragEnd: (success: boolean, targetSlot?: 'x' | 'y' | 'z' | 'remove') => void;
  onAxisChange: (event: AxisChangeEvent) => void;
  onReflowStart: (options: GridReflowOptions) => void;
  onReflowComplete: (duration: number, cardsMoved: number) => void;
  onPreviewUpdate: (previewData: DragFeedbackState['previewData']) => void;
}