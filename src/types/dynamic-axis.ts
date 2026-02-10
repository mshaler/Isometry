/**
 * Dynamic Axis Types - Drag-and-drop axis management
 *
 * Extracted from supergrid.old.ts - contains types for the SuperDynamic
 * system that enables drag-and-drop axis repositioning.
 */

/**
 * Configuration for SuperDynamic axis reallocation system
 */
export interface SuperDynamicConfig {
  enableAxisDragDrop: boolean;
  enableAxisSwapping: boolean;
  enableAxisInsertion: boolean;
  showDropZones: boolean;
  animateTransitions: boolean;
  snapToSlots: boolean;
  reflowGrid: boolean;
  persistAxisLayout: boolean;

  // Visual feedback
  dragPreviewOpacity: number;
  dropZoneHighlight: string;
  axisSlotBorder: string;

  // Performance
  reflowDebounceMs: number;
  maxAxisCount: number;
}

/**
 * Configuration for an axis slot in the grid
 */
export interface AxisSlotConfig {
  id: string;
  plane: 'x' | 'y' | 'z';
  position: number; // Order within plane
  isOccupied: boolean;
  acceptedTypes: string[]; // LATCH types this slot accepts
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Current drag state for axis reallocation
 */
export interface DragState {
  isDragging: boolean;
  draggedAxisId: string | null;
  draggedAxisType: string | null; // LATCH type
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  startSlot: AxisSlotConfig | null;
  targetSlot: AxisSlotConfig | null;
  previewElement: HTMLElement | null;

  // Drag constraints
  allowedDropZones: string[];
  forbiddenDropZones: string[];
  snapThreshold: number;

  // Visual state
  showPreview: boolean;
  highlightDropZones: boolean;
  draggedElementOffset: { x: number; y: number };
}

/**
 * Drop zone for axis reallocation
 */
export interface DropZone {
  id: string;
  type: 'slot' | 'insertion' | 'swap' | 'remove';
  plane: 'x' | 'y' | 'z';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  isHighlighted: boolean;
  acceptedAxisTypes: string[];
  currentOccupant: string | null;

  // Visual properties
  highlightColor: string;
  borderStyle: string;
  iconType?: string;
}

/**
 * Options for grid reflow after axis changes
 */
export interface GridReflowOptions {
  animate: boolean;
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  staggerDelay: number;
  updateData: boolean;
  recalculateExtent: boolean;
  preserveSelection: boolean;
}

/**
 * Event data for axis change operations
 */
export interface AxisChangeEvent {
  type: 'move' | 'swap' | 'insert' | 'remove';
  axisId: string;
  sourceSlot: AxisSlotConfig;
  targetSlot: AxisSlotConfig | null;
  oldPlane: 'x' | 'y' | 'z';
  newPlane: 'x' | 'y' | 'z';
  oldPosition: number;
  newPosition: number;

  // Affected entities
  affectedAxes: string[];
  requiredReflow: boolean;
  requiredDataUpdate: boolean;

  // Metadata
  timestamp: number;
  userInitiated: boolean;
  reason?: string;
}

/**
 * Visual feedback state during drag operations
 */
export interface DragFeedbackState {
  showPreview: boolean;
  previewPosition: { x: number; y: number };
  previewRotation: number;
  previewScale: number;
  previewOpacity: number;

  // Drop zone feedback
  activeDropZone: string | null;
  dropZoneStates: Map<string, {
    isActive: boolean;
    animationPhase: 'enter' | 'hover' | 'exit';
    intensity: number; // 0-1 for animation intensity
  }>;

  // Visual effects
  showSnapGuides: boolean;
  snapGuidePositions: { x: number; y: number }[];
  showMeasurementOverlay: boolean;
  measurementLines: { start: { x: number; y: number }; end: { x: number; y: number } }[];
}

/**
 * Performance and usage metrics for SuperDynamic
 */
export interface SuperDynamicMetrics {
  // Usage patterns
  totalAxisMoves: number;
  totalAxisSwaps: number;
  averageMovesPerSession: number;
  mostMovedAxes: { axisId: string; moveCount: number }[];

  // Performance metrics
  averageDragLatency: number;
  averageReflowTime: number;
  droppedFrameCount: number;
  memoryUsageMB: number;

  // User experience
  successfulDrops: number;
  cancelledDrags: number;
  errorRate: number; // Failed drops / total attempts
  averageDragDistance: number;

  // System health
  isPerformant: boolean;
  needsOptimization: boolean;
  lastOptimizationTime: number;
  criticalThresholds: {
    maxDragLatency: number;
    maxReflowTime: number;
    maxMemoryUsage: number;
  };
}

// Type guards

export const isSuperDynamicConfig = (obj: any): obj is SuperDynamicConfig => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.enableAxisDragDrop === 'boolean' &&
    typeof obj.enableAxisSwapping === 'boolean' &&
    typeof obj.reflowGrid === 'boolean'
  );
};

export const isDragState = (obj: any): obj is DragState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.isDragging === 'boolean' &&
    (obj.draggedAxisId === null || typeof obj.draggedAxisId === 'string')
  );
};

export const isAxisChangeEvent = (obj: any): obj is AxisChangeEvent => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ['move', 'swap', 'insert', 'remove'].includes(obj.type) &&
    typeof obj.axisId === 'string' &&
    ['x', 'y', 'z'].includes(obj.oldPlane) &&
    ['x', 'y', 'z'].includes(obj.newPlane)
  );
};