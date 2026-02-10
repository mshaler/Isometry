/**
 * Cartographic Types - Zoom, pan, and navigation control
 *
 * Extracted from supergrid.old.ts - contains types for cartographic
 * navigation with zoom anchoring and boundary constraints.
 */

/**
 * Zoom anchor modes for cartographic navigation
 */
export type ZoomAnchorMode = 'upper-left' | 'center' | 'cursor';

/**
 * Configuration for cartographic navigation system
 */
export interface CartographicConfig {
  // Zoom behavior
  enableZoom: boolean;
  minZoomLevel: number;
  maxZoomLevel: number;
  zoomStep: number;
  zoomAnchor: ZoomAnchorMode;
  smoothZoom: boolean;
  zoomAnimationDuration: number;

  // Pan behavior
  enablePan: boolean;
  panSensitivity: number;
  smoothPan: boolean;
  panAnimationDuration: number;
  momentumPanning: boolean;
  momentumDecay: number;

  // Boundary constraints
  constrainToBounds: boolean;
  allowBeyondBounds: boolean;
  boundaryElasticity: number;
  snapBackDuration: number;

  // Visual feedback
  showZoomControls: boolean;
  showPanIndicator: boolean;
  showBoundaryIndicators: boolean;
  cursorStyle: 'grab' | 'move' | 'crosshair' | 'auto';

  // Performance
  renderThrottleMs: number;
  maxRenderNodes: number;
  useLevelOfDetail: boolean;
  preloadBuffer: { x: number; y: number };
}

/**
 * Current state of cartographic navigation
 */
export interface CartographicState {
  // Transform state
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number; // Future feature

  // Zoom state
  zoomLevel: number;
  zoomCenter: { x: number; y: number };
  zoomAnchor: ZoomAnchorMode;

  // Pan state
  panVelocity: { x: number; y: number };
  isPanning: boolean;
  lastPanTime: number;

  // Interaction state
  isZooming: boolean;
  isDragging: boolean;
  lastInteractionTime: number;

  // Viewport info
  viewportBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };

  // Content bounds (what's actually visible)
  contentBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };

  // Animation state
  isAnimating: boolean;
  animationStartTime: number;
  animationDuration: number;
  animationTarget: {
    scale?: number;
    translateX?: number;
    translateY?: number;
  };
}

/**
 * Boundary constraints for navigation
 */
export interface BoundaryConstraints {
  enabled: boolean;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  mode: 'strict' | 'elastic' | 'infinite';
  elasticStrength: number; // For elastic mode
  maxElasticDistance: number;
}

/**
 * Visual feedback for cartographic operations
 */
export interface CartographicVisualFeedback {
  // Zoom feedback
  showZoomLevel: boolean;
  zoomLevelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  zoomLevelFormat: 'percentage' | 'ratio' | 'level';

  // Pan feedback
  showPanIndicator: boolean;
  panIndicatorStyle: 'minimap' | 'compass' | 'coordinates';
  panIndicatorPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  // Boundary feedback
  showBoundaryWarnings: boolean;
  boundaryWarningStyle: 'highlight' | 'fade' | 'block';
  boundaryColor: string;

  // Animation feedback
  showAnimationProgress: boolean;
  animationEasing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Callback functions for cartographic events
 */
export interface CartographicCallbacks {
  onZoomStart?: (zoomLevel: number, center: { x: number; y: number }) => void;
  onZoom?: (zoomLevel: number, center: { x: number; y: number }) => void;
  onZoomEnd?: (zoomLevel: number, center: { x: number; y: number }) => void;

  onPanStart?: (position: { x: number; y: number }) => void;
  onPan?: (position: { x: number; y: number }, velocity: { x: number; y: number }) => void;
  onPanEnd?: (position: { x: number; y: number }) => void;

  onBoundaryHit?: (boundary: 'left' | 'right' | 'top' | 'bottom', position: { x: number; y: number }) => void;
  onBoundaryReturn?: (fromPosition: { x: number; y: number }, toPosition: { x: number; y: number }) => void;

  onViewportChange?: (bounds: { left: number; top: number; right: number; bottom: number }) => void;
  onPerformanceThresholdExceeded?: (metrics: CartographicPerformanceMetrics) => void;
}

/**
 * Performance metrics for cartographic operations
 */
export interface CartographicPerformanceMetrics {
  // Render performance
  averageFrameTime: number;
  droppedFrames: number;
  renderNodeCount: number;
  levelOfDetailUsed: boolean;

  // Interaction responsiveness
  zoomLatency: number;
  panLatency: number;
  scrollLatency: number;

  // Memory usage
  memoryUsageMB: number;
  cacheHitRate: number;
  preloadedNodes: number;

  // User experience
  smoothnessScore: number; // 0-100
  responsiveScore: number; // 0-100
  overallScore: number; // 0-100

  // Thresholds
  targetFrameTime: number;
  maxMemoryUsage: number;
  minSmoothness: number;
}

/**
 * Interface for zoom control functionality
 */
export interface ZoomControlInterface {
  zoomIn(factor?: number): void;
  zoomOut(factor?: number): void;
  zoomTo(level: number, center?: { x: number; y: number }): void;
  zoomToFit(bounds: { left: number; top: number; right: number; bottom: number }): void;
  resetZoom(): void;
  getZoomLevel(): number;
  getZoomBounds(): { min: number; max: number };
  setZoomBounds(min: number, max: number): void;
}

/**
 * Interface for pan control functionality
 */
export interface PanControlInterface {
  panTo(x: number, y: number, animated?: boolean): void;
  panBy(deltaX: number, deltaY: number, animated?: boolean): void;
  centerOn(x: number, y: number): void;
  resetPan(): void;
  getPanPosition(): { x: number; y: number };
  setPanBounds(bounds: BoundaryConstraints): void;
  enableMomentum(enabled: boolean): void;
}

/**
 * Combined cartographic control interface
 */
export interface CartographicControlInterface extends ZoomControlInterface, PanControlInterface {
  // Combined operations
  resetView(): void;
  fitToContent(): void;
  getViewportBounds(): { left: number; top: number; right: number; bottom: number };
  getContentBounds(): { left: number; top: number; right: number; bottom: number };

  // State management
  saveState(): CartographicState;
  restoreState(state: CartographicState): void;
  getTransform(): { scale: number; translateX: number; translateY: number };
  setTransform(transform: { scale?: number; translateX?: number; translateY?: number }): void;

  // Event handling
  handleWheel(event: WheelEvent): void;
  handleMouseDown(event: MouseEvent): void;
  handleMouseMove(event: MouseEvent): void;
  handleMouseUp(event: MouseEvent): void;
  handleTouchStart(event: TouchEvent): void;
  handleTouchMove(event: TouchEvent): void;
  handleTouchEnd(event: TouchEvent): void;

  // Performance
  getPerformanceMetrics(): CartographicPerformanceMetrics;
  optimizePerformance(): void;
  enableLevelOfDetail(enabled: boolean): void;
  setRenderBudget(maxNodes: number, maxFrameTime: number): void;
}

/**
 * Default cartographic configuration
 */
export const DEFAULT_CARTOGRAPHIC_CONFIG: CartographicConfig = {
  enableZoom: true,
  minZoomLevel: 0.1,
  maxZoomLevel: 10.0,
  zoomStep: 0.1,
  zoomAnchor: 'center',
  smoothZoom: true,
  zoomAnimationDuration: 200,

  enablePan: true,
  panSensitivity: 1.0,
  smoothPan: true,
  panAnimationDuration: 200,
  momentumPanning: true,
  momentumDecay: 0.9,

  constrainToBounds: false,
  allowBeyondBounds: true,
  boundaryElasticity: 0.3,
  snapBackDuration: 300,

  showZoomControls: true,
  showPanIndicator: false,
  showBoundaryIndicators: true,
  cursorStyle: 'grab',

  renderThrottleMs: 16,
  maxRenderNodes: 1000,
  useLevelOfDetail: true,
  preloadBuffer: { x: 200, y: 200 }
};

// Type guards

export const isCartographicConfig = (obj: unknown): obj is CartographicConfig => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.enableZoom === 'boolean' &&
    typeof obj.enablePan === 'boolean' &&
    typeof obj.minZoomLevel === 'number' &&
    typeof obj.maxZoomLevel === 'number' &&
    ['upper-left', 'center', 'cursor'].includes(obj.zoomAnchor)
  );
};

export const isCartographicState = (obj: unknown): obj is CartographicState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.scale === 'number' &&
    typeof obj.translateX === 'number' &&
    typeof obj.translateY === 'number' &&
    typeof obj.zoomLevel === 'number' &&
    typeof obj.viewportBounds === 'object' &&
    typeof obj.contentBounds === 'object'
  );
};