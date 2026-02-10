/**
 * SuperZoom - Cartographic Navigation React Component
 *
 * React wrapper for SuperZoomCartographic D3.js engine providing Apple Numbers-style
 * cartographic navigation with upper-left anchor zoom, boundary constraints, and
 * elastic resistance. Integrates with SuperDensity and SuperStack systems.
 *
 * Section 2.4 of SuperGrid specification: Cartographic navigation system with
 * upper-left anchor behavior and 60fps performance.
 *
 * Key Features:
 * - Fixed upper-left anchor zoom behavior
 * - Separate zoom and pan controls
 * - Boundary constraints with elastic bounce-back
 * - State persistence per-dataset
 * - Integration with density and header systems
 * - Real-time performance monitoring
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent
} from '@/components/ui/collapsible';
import {
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  MapPin,
  Target,
  Settings,
  Navigation
} from 'lucide-react';
import { SuperZoomCartographic } from '@/d3/SuperZoomCartographic';
import { devLogger } from '@/utils/logging';
import type {
  CartographicConfig,
  CartographicState,
  CartographicControlInterface,
  CartographicVisualFeedback,
  JanusDensityState
} from '@/types/supergrid';
import { DEFAULT_CARTOGRAPHIC_CONFIG } from '@/types/supergrid';

export interface SuperZoomProps {
  /** Container dimensions */
  width: number;
  height: number;
  /** Grid content dimensions */
  gridWidth: number;
  gridHeight: number;
  /** Configuration overrides */
  config?: Partial<CartographicConfig>;
  /** Initial state */
  initialState?: Partial<CartographicState>;
  /** Integration with density system */
  densityState?: JanusDensityState;
  /** Header system integration */
  headerState?: {
    totalHeight: number;
    isExpanded: boolean;
    levels: number;
  };
  /** Callbacks */
  onStateChange?: (state: CartographicState) => void;
  onZoomChange?: (scale: number, state: CartographicState) => void;
  onPanChange?: (x: number, y: number, state: CartographicState) => void;
  onBoundaryHit?: (boundary: 'left' | 'right' | 'top' | 'bottom', state: CartographicState) => void;
  /** Component configuration */
  showControls?: boolean;
  showPerformanceMonitor?: boolean;
  enableKeyboardShortcuts?: boolean;
  className?: string;
  /** Dataset ID for state persistence */
  datasetId?: string;
}

/**
 * SuperZoom Component
 */
export function SuperZoom({
  width,
  height,
  gridWidth,
  gridHeight,
  config = {},
  initialState = {},
  densityState,
  headerState,
  onStateChange,
  onZoomChange,
  onPanChange,
  onBoundaryHit,
  showControls = true,
  showPerformanceMonitor = true,
  enableKeyboardShortcuts = true,
  className = '',
  datasetId
}: SuperZoomProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cartographicRef = useRef<CartographicControlInterface | null>(null);

  // State
  const [currentState, setCurrentState] = useState<CartographicState | null>(null);
  const [visualFeedback, setVisualFeedback] = useState<CartographicVisualFeedback>({
    showBoundaryIndicators: false
  });
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [performanceData, setPerformanceData] = useState({
    frameRate: 60,
    operationTime: 0,
    grade: 'A'
  });

  // Configuration with defaults
  const fullConfig: CartographicConfig = {
    ...DEFAULT_CARTOGRAPHIC_CONFIG,
    ...config,
    gridDimensions: { width: gridWidth, height: gridHeight },
    viewportDimensions: { width, height },
    datasetId
  };

  /**
   * Initialize SuperZoom cartographic engine
   */
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    // Clear existing SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    // Create SVG with proper dimensions
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('cursor', 'grab');

    // Create main container group
    const container = svg.append('g')
      .attr('class', 'superzoom-container');

    // Initialize cartographic engine
    try {
      cartographicRef.current = new SuperZoomCartographic(
        container.node()! as SVGElement,
        fullConfig,
        {
          onStateChange: (state) => {
            setCurrentState(state);
            onStateChange?.(state);
            updatePerformanceData(state);
          },
          onZoomChange: (scale, state) => {
            onZoomChange?.(scale, state);
          },
          onPanChange: (x, y, state) => {
            onPanChange?.(x, y, state);
          },
          onBoundaryHit: (boundary, state) => {
            onBoundaryHit?.(boundary, state);
            setVisualFeedback(prev => ({
              ...prev,
              bounceDirection: boundary
            }));
            // Clear bounce indicator after animation
            setTimeout(() => {
              setVisualFeedback(prev => ({
                ...prev,
                bounceDirection: undefined
              }));
            }, 500);
          },
          onAnimationToggle: (isAnimating) => {
            setVisualFeedback(prev => ({
              ...prev,
              showPanGuides: isAnimating
            }));
          }
        }
      );

      // Apply initial state if provided
      if (Object.keys(initialState).length > 0) {
        cartographicRef.current.restoreState(initialState as CartographicState);
      }

      devLogger.debug('SuperZoom cartographic engine initialized', {
        hasInitialState: !!initialState,
        containerDimensions: { width, height }
      });
    } catch (error) {
      devLogger.error('SuperZoom failed to initialize cartographic engine', { error });
    }

    return () => {
      cartographicRef.current?.destroy();
      cartographicRef.current = null;
    };
  }, [width, height, gridWidth, gridHeight, fullConfig]);

  /**
   * Update density integration
   */
  useEffect(() => {
    if (!cartographicRef.current || !densityState) return;

    cartographicRef.current.updateDensityState({
      valueDensity: densityState.valueDensity,
      extentDensity: densityState.extentDensity
    });
  }, [densityState]);

  /**
   * Update header integration
   */
  useEffect(() => {
    if (!cartographicRef.current || !headerState) return;

    cartographicRef.current.updateHeaderState(headerState);
  }, [headerState]);

  /**
   * Update performance monitoring
   */
  const updatePerformanceData = useCallback((state: CartographicState) => {
    const { performance } = state;
    const grade = performance.averageFrameRate >= 55 ? 'A' :
                  performance.averageFrameRate >= 45 ? 'B' :
                  performance.averageFrameRate >= 30 ? 'C' : 'D';

    setPerformanceData({
      frameRate: performance.averageFrameRate,
      operationTime: performance.lastOperationDuration,
      grade
    });
  }, []);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts || !cartographicRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!cartographicRef.current) return;

      const { key, ctrlKey, metaKey } = event;
      const isModifierPressed = ctrlKey || metaKey;

      switch (key) {
        case '=':
        case '+':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.zoomIn();
          }
          break;
        case '-':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.zoomOut();
          }
          break;
        case '0':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.resetZoom();
          }
          break;
        case 'ArrowUp':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.panBy(0, -50);
          }
          break;
        case 'ArrowDown':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.panBy(0, 50);
          }
          break;
        case 'ArrowLeft':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.panBy(-50, 0);
          }
          break;
        case 'ArrowRight':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.panBy(50, 0);
          }
          break;
        case 'Home':
          if (isModifierPressed) {
            event.preventDefault();
            cartographicRef.current.resetPan();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts]);

  /**
   * Control handlers
   */
  const handleZoomIn = useCallback(() => {
    cartographicRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    cartographicRef.current?.zoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    cartographicRef.current?.resetZoom();
  }, []);

  const handleResetPan = useCallback(() => {
    cartographicRef.current?.resetPan();
  }, []);

  const handleCenterOnGrid = useCallback(() => {
    cartographicRef.current?.centerOnGrid();
  }, []);

  const handleZoomToScale = useCallback((scale: number) => {
    cartographicRef.current?.zoomTo(scale);
  }, []);

  // Calculate current scale and position for display
  const currentScale = currentState?.scale ?? 1;
  const currentPosition = currentState?.transform ?? { x: 0, y: 0 };
  const zoomPercentage = Math.round(currentScale * 100);

  return (
    <div className={`relative ${className}`}>
      {/* Main SVG Container */}
      <div ref={containerRef} className="relative w-full h-full overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: currentState?.isAnimating ? 'grabbing' : 'grab' }}
        />

        {/* Visual Feedback Overlays */}
        {visualFeedback.showBoundaryIndicators && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Boundary indicators */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400 opacity-50" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-400 opacity-50" />
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-orange-400 opacity-50" />
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-orange-400 opacity-50" />
          </div>
        )}

        {/* Bounce Direction Indicator */}
        {visualFeedback.bounceDirection && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="px-3 py-1 bg-orange-500 text-white text-sm rounded-full animate-bounce">
              Boundary: {visualFeedback.bounceDirection}
            </div>
          </div>
        )}

        {/* Current State Indicator */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-xs font-mono">
          {zoomPercentage}% | ({currentPosition.x.toFixed(0)}, {currentPosition.y.toFixed(0)})
        </div>
      </div>

      {/* SuperZoom Controls */}
      {showControls && (
        <Card className="absolute top-4 right-4 w-80 z-30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                SuperZoom Navigation
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsControlsOpen(!isControlsOpen)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <Collapsible open={isControlsOpen} onOpenChange={setIsControlsOpen}>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Zoom Controls */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Zoom Controls
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={!cartographicRef.current?.canZoomIn()}
                    >
                      <ZoomIn className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleZoomOut}
                      disabled={!cartographicRef.current?.canZoomOut()}
                    >
                      <ZoomOut className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetZoom}
                      className="flex-1"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset Zoom
                    </Button>
                  </div>

                  {/* Zoom Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Scale: {currentScale.toFixed(1)}x</span>
                      <span>{zoomPercentage}%</span>
                    </div>
                    <Slider
                      value={[currentScale]}
                      onValueChange={([value]) => handleZoomToScale(value)}
                      min={fullConfig.zoomExtent[0]}
                      max={fullConfig.zoomExtent[1]}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Pan Controls */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Move className="w-4 h-4" />
                    Pan Controls
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div></div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cartographicRef.current?.panBy(0, -50)}
                    >
                      ↑
                    </Button>
                    <div></div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cartographicRef.current?.panBy(-50, 0)}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCenterOnGrid}
                    >
                      <MapPin className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cartographicRef.current?.panBy(50, 0)}
                    >
                      →
                    </Button>
                    <div></div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cartographicRef.current?.panBy(0, 50)}
                    >
                      ↓
                    </Button>
                    <div></div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetPan}
                    className="w-full"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset Position
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Actions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleResetZoom();
                        handleResetPan();
                      }}
                    >
                      Reset All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCenterOnGrid}
                    >
                      Center Grid
                    </Button>
                  </div>
                </div>

                {/* Performance Monitor */}
                {showPerformanceMonitor && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Performance</Label>
                      <Badge
                        variant={
                          performanceData.grade === 'A' ? 'default' :
                          performanceData.grade === 'B' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {performanceData.grade}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Frame Rate</span>
                        <span className="font-mono">{performanceData.frameRate.toFixed(1)} FPS</span>
                      </div>
                      <Progress
                        value={(performanceData.frameRate / 60) * 100}
                        className="h-2"
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Last Operation</span>
                      <span className="font-mono">{performanceData.operationTime.toFixed(1)}ms</span>
                    </div>
                  </div>
                )}

                {/* Keyboard Shortcuts Help */}
                {enableKeyboardShortcuts && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Keyboard Shortcuts</summary>
                    <div className="mt-2 space-y-1 text-xs">
                      <div><kbd>Ctrl/Cmd +</kbd> Zoom In</div>
                      <div><kbd>Ctrl/Cmd -</kbd> Zoom Out</div>
                      <div><kbd>Ctrl/Cmd 0</kbd> Reset Zoom</div>
                      <div><kbd>Ctrl/Cmd ↑↓←→</kbd> Pan</div>
                      <div><kbd>Ctrl/Cmd Home</kbd> Reset Position</div>
                    </div>
                  </details>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}

export default SuperZoom;