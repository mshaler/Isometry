/**
 * SuperGridZoom - Janus orthogonal zoom/pan control system for SuperGrid
 *
 * Implements user-decided separate zoom (value density) and pan (extent density) controls
 * with pinned upper-left corner zoom behavior and "quiet app" aesthetic.
 *
 * Key features:
 * - Orthogonal zoom/pan controls that operate independently
 * - Fixed corner anchor (upper-left pinned) for cartographic navigation
 * - Sparse/dense toggle for extent density control
 * - Smooth animations under 300ms with ease-out curves
 * - State restoration and persistence
 */

import * as d3 from 'd3';

export type ZoomLevel = 'leaf' | 'collapsed';
export type PanLevel = 'sparse' | 'dense';

export interface JanusState {
  zoomLevel: ZoomLevel;
  panLevel: PanLevel;
  zoomTransform: d3.ZoomTransform;
  viewportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface JanusControls {
  setZoomLevel: (level: ZoomLevel) => void;
  setPanLevel: (level: PanLevel) => void;
  zoomTo: (x: number, y: number, scale: number) => void;
  panTo: (x: number, y: number) => void;
  reset: () => void;
  getState: () => JanusState;
  restoreState: (state: JanusState) => void;
}

export interface SuperGridZoomConfig {
  minZoom: number;
  maxZoom: number;
  animationDuration: number;
  enableSmoothing: boolean;
  anchorCorner: 'upper-left' | 'center';
}

export class SuperGridZoom implements JanusControls {
  private container: d3.Selection<SVGElement, unknown, null, undefined>;
  private zoomBehavior: d3.ZoomBehavior<SVGElement, unknown> | null = null;
  private config: SuperGridZoomConfig;

  // Janus state
  private currentZoomLevel: ZoomLevel = 'leaf';
  private currentPanLevel: PanLevel = 'dense';
  private currentTransform: d3.ZoomTransform;

  // Event callbacks
  private onZoomChange?: (level: ZoomLevel, transform: d3.ZoomTransform) => void;
  private onPanChange?: (level: PanLevel, transform: d3.ZoomTransform) => void;
  private onStateChange?: (state: JanusState) => void;

  // Animation tracking
  private isAnimating = false;

  // Default configuration
  private static readonly DEFAULT_CONFIG: SuperGridZoomConfig = {
    minZoom: 0.1,
    maxZoom: 5.0,
    animationDuration: 300, // "quiet app" aesthetic
    enableSmoothing: true,
    anchorCorner: 'upper-left' // user-decided fixed corner anchor
  };

  constructor(
    container: SVGElement,
    config: Partial<SuperGridZoomConfig> = {},
    callbacks: {
      onZoomChange?: (level: ZoomLevel, transform: d3.ZoomTransform) => void;
      onPanChange?: (level: PanLevel, transform: d3.ZoomTransform) => void;
      onStateChange?: (state: JanusState) => void;
    } = {}
  ) {
    this.container = d3.select(container);
    this.config = { ...SuperGridZoom.DEFAULT_CONFIG, ...config };
    this.onZoomChange = callbacks.onZoomChange;
    this.onPanChange = callbacks.onPanChange;
    this.onStateChange = callbacks.onStateChange;

    this.currentTransform = d3.zoomIdentity;

    this.initializeZoomBehavior();
    this.setupZoomBehavior();
  }

  /**
   * Initialize D3 zoom behavior with orthogonal controls
   * Uses translateExtent to pin upper-left corner (SuperZoom spec)
   */
  private initializeZoomBehavior(): void {
    this.zoomBehavior = d3.zoom<SVGElement, unknown>()
      .scaleExtent([this.config.minZoom, this.config.maxZoom])
      // Pin upper-left corner: only allow panning that keeps (0,0) in view
      // translateExtent [[minX, minY], [maxX, maxY]] constrains the viewport
      .translateExtent([[-50, -50], [10000, 10000]]) // Allow slight negative for padding
      .on('start', (event) => this.handleZoomStart(event))
      .on('zoom', (event) => this.handleZoom(event))
      .on('end', (event) => this.handleZoomEnd(event));
  }

  /**
   * Setup zoom behavior on container
   */
  private setupZoomBehavior(): void {
    if (this.zoomBehavior) {
      this.container.call(this.zoomBehavior);
    }

    // Set initial transform
    if (this.zoomBehavior) {
      this.container.call(
        this.zoomBehavior.transform,
        this.currentTransform
      );
    }
  }

  /**
   * Set zoom level (value density control)
   * Orthogonal to pan level - operates independently
   */
  setZoomLevel(level: ZoomLevel): void {
    if (this.currentZoomLevel === level) return;

    this.currentZoomLevel = level;

    // Apply zoom level change with animation
    this.animateZoomLevelChange(level);

    // Trigger callback
    this.onZoomChange?.(level, this.currentTransform);
    this.notifyStateChange();
  }

  /**
   * Set pan level (extent density control)
   * Orthogonal to zoom level - operates independently
   */
  setPanLevel(level: PanLevel): void {
    if (this.currentPanLevel === level) return;

    this.currentPanLevel = level;

    // Apply pan level change with animation
    this.animatePanLevelChange(level);

    // Trigger callback
    this.onPanChange?.(level, this.currentTransform);
    this.notifyStateChange();
  }

  /**
   * Zoom to specific coordinates with fixed corner anchor
   */
  zoomTo(x: number, y: number, scale: number): void {
    // Constrain scale to configured bounds
    const constrainedScale = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, scale)
    );

    // Calculate transform with upper-left anchor
    const targetTransform = this.calculateAnchoredTransform(x, y, constrainedScale);

    // Apply transform with smooth animation
    this.animateToTransform(targetTransform);
  }

  /**
   * Pan to specific coordinates maintaining current zoom
   */
  panTo(x: number, y: number): void {
    const targetTransform = d3.zoomIdentity
      .translate(x, y)
      .scale(this.currentTransform.k);

    // Apply transform with smooth animation
    this.animateToTransform(targetTransform);
  }

  /**
   * Reset to default zoom/pan state
   */
  reset(): void {
    this.currentZoomLevel = 'leaf';
    this.currentPanLevel = 'dense';

    // Reset to identity transform
    this.animateToTransform(d3.zoomIdentity);

    this.notifyStateChange();
  }

  /**
   * Get current Janus state
   */
  getState(): JanusState {
    const bounds = this.getViewportBounds();

    return {
      zoomLevel: this.currentZoomLevel,
      panLevel: this.currentPanLevel,
      zoomTransform: this.currentTransform,
      viewportBounds: bounds
    };
  }

  /**
   * Restore Janus state from saved state
   */
  restoreState(state: JanusState): void {
    this.currentZoomLevel = state.zoomLevel;
    this.currentPanLevel = state.panLevel;

    // Reconstruct ZoomTransform from serialized state (JSON loses prototype methods)
    // state.zoomTransform may be a plain object {x, y, k} after JSON.parse
    const savedTransform = state.zoomTransform;
    this.currentTransform = d3.zoomIdentity
      .translate(savedTransform.x ?? 0, savedTransform.y ?? 0)
      .scale(savedTransform.k ?? 1);

    if (this.zoomBehavior) {
      this.container.call(
        this.zoomBehavior.transform,
        this.currentTransform
      );
    }

    this.notifyStateChange();
  }

  // Private methods

  /**
   * Handle zoom start event
   */
  private handleZoomStart(_event: d3.D3ZoomEvent<SVGElement, unknown>): void {
    this.isAnimating = false; // User interaction interrupts animations
  }

  /**
   * Handle zoom event with orthogonal control logic
   * Applies transform to both grid-content AND headers to keep them aligned
   */
  private handleZoom(event: d3.D3ZoomEvent<SVGElement, unknown>): void {
    const { transform } = event;

    // Update current transform
    this.currentTransform = transform;

    // Apply transform to BOTH headers and grid-content to keep them aligned
    // This is critical for spreadsheet-like cell/header alignment
    this.container.selectAll('.grid-wrapper')
      .attr('transform', transform.toString());

    // Fallback: if no wrapper, apply to individual groups (backward compatibility)
    if (this.container.select('.grid-wrapper').empty()) {
      this.container.selectAll('.grid-content, .headers')
        .attr('transform', transform.toString());
    }

    // Update zoom level based on scale if not manually set
    this.updateZoomLevelFromScale(transform.k);

    this.notifyStateChange();
  }

  /**
   * Handle zoom end event
   */
  private handleZoomEnd(_event: d3.D3ZoomEvent<SVGElement, unknown>): void {
    // Zoom end handling complete
  }

  /**
   * Animate zoom level change with "quiet app" aesthetic
   */
  private animateZoomLevelChange(level: ZoomLevel): void {
    const targetScale = level === 'leaf' ? 1.0 : 0.7; // Collapsed shows more overview

    const targetTransform = this.currentTransform.scale(targetScale / this.currentTransform.k);

    this.animateToTransform(targetTransform);
  }

  /**
   * Animate pan level change with layout adjustment
   */
  private animatePanLevelChange(_level: PanLevel): void {
    // Pan level affects what's visible, not the transform directly
    // This triggers layout recalculation in the calling components
  }

  /**
   * Calculate transform with anchored positioning
   */
  private calculateAnchoredTransform(x: number, y: number, scale: number): d3.ZoomTransform {
    if (this.config.anchorCorner === 'upper-left') {
      // Fixed upper-left corner positioning
      return d3.zoomIdentity
        .translate(x, y)
        .scale(scale);
    } else {
      // Center positioning (fallback)
      const bounds = this.getViewportBounds();
      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;

      return d3.zoomIdentity
        .translate(centerX - x * scale, centerY - y * scale)
        .scale(scale);
    }
  }

  /**
   * Animate to target transform with smooth transition
   */
  private animateToTransform(targetTransform: d3.ZoomTransform): void {
    this.isAnimating = true;

    const transition = this.container.transition()
      .duration(this.config.animationDuration)
      .ease(d3.easeQuadOut); // "quiet app" aesthetic with ease-out

    if (this.zoomBehavior) {
      transition.call(
        this.zoomBehavior.transform,
        targetTransform
      ).on('end', () => {
        this.isAnimating = false;
      });
    }
  }

  /**
   * Update zoom level based on current scale (auto-detection)
   */
  private updateZoomLevelFromScale(scale: number): void {
    // Auto-detect zoom level based on scale thresholds
    const detectedLevel: ZoomLevel = scale > 0.8 ? 'leaf' : 'collapsed';

    if (detectedLevel !== this.currentZoomLevel) {
      this.currentZoomLevel = detectedLevel;
      this.onZoomChange?.(detectedLevel, this.currentTransform);
    }
  }

  /**
   * Get current viewport bounds
   */
  private getViewportBounds(): { x: number; y: number; width: number; height: number } {
    const containerNode = this.container.node();
    if (!containerNode) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    const rect = containerNode.getBoundingClientRect();
    return {
      x: 0,
      y: 0,
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Notify state change to callbacks
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      const state = this.getState();
      this.onStateChange(state);
    }
  }

  /**
   * Get current zoom behavior instance
   */
  getZoomBehavior(): d3.ZoomBehavior<SVGElement, unknown> | null {
    return this.zoomBehavior;
  }

  /**
   * Check if currently animating
   */
  isCurrentlyAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Get current zoom level
   */
  getCurrentZoomLevel(): ZoomLevel {
    return this.currentZoomLevel;
  }

  /**
   * Get current pan level
   */
  getCurrentPanLevel(): PanLevel {
    return this.currentPanLevel;
  }

  /**
   * Get current transform
   */
  getCurrentTransform(): d3.ZoomTransform {
    return this.currentTransform;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove zoom behavior
    this.container.on('.zoom', null);

    // Clear callbacks
    this.onZoomChange = undefined;
    this.onPanChange = undefined;
    this.onStateChange = undefined;
  }
}