/**
 * React hook for managing SuperGrid coordinate system state.
 *
 * Provides stateful coordinate system with origin pattern switching,
 * zoom control, and point transformation helpers.
 *
 * @module hooks/useCoordinates
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  Point,
  CoordinateSystem,
  OriginPattern,
} from '../../types/coordinates';
import {
  screenToLogical as utilScreenToLogical,
  logicalToScreen as utilLogicalToScreen,
  getOriginPreset,
} from '../utils/coordinates';

/**
 * Hook interface returned by useCoordinates.
 */
export interface UseCoordinatesResult {
  /** Current coordinate system configuration */
  coordinateSystem: CoordinateSystem;

  /** Current origin pattern (anchor or bipolar) */
  originPattern: OriginPattern;

  /** Current zoom scale (1.0 = 100%) */
  scale: number;

  /** Change the origin pattern */
  setOriginPattern: (pattern: OriginPattern) => void;

  /** Change the zoom scale */
  setScale: (scale: number) => void;

  /** Update viewport dimensions */
  setViewportSize: (width: number, _height: number) => void;

  /** Convert screen point to logical coordinates */
  screenToLogical: (screenPoint: Point) => Point;

  /** Convert logical point to screen coordinates */
  logicalToScreen: (logicalPoint: Point) => Point;

  /** Reset to default state */
  reset: () => void;
}

/**
 * Options for useCoordinates hook.
 */
export interface UseCoordinatesOptions {
  /** Initial origin pattern (default: 'anchor') */
  initialPattern?: OriginPattern;

  /** Initial zoom scale (default: 1.0) */
  initialScale?: number;

  /** Initial viewport width (default: 1024) */
  initialWidth?: number;

  /** Initial viewport height (default: 768) */
  initialHeight?: number;
}

/**
 * Manage coordinate system state for SuperGrid.
 *
 * @param options - Configuration options
 * @returns Coordinate system state and transformation methods
 *
 * @example
 * // Basic usage with Anchor origin
 * const coords = useCoordinates();
 * const handleClick = (e) => {
 *   const screenPoint = { x: e.clientX, y: e.clientY };
 *   const logical = coords.screenToLogical(screenPoint);
 *   console.log('Clicked cell:', logical);
 * };
 *
 * @example
 * // Custom initial configuration
 * const coords = useCoordinates({
 *   initialPattern: 'bipolar',
 *   initialScale: 1.5,
 *   initialWidth: 800,
 *   initialHeight: 600,
 * });
 * // Bipolar origin: center is (0,0)
 * const origin = coords.logicalToScreen({ x: 0, y: 0 });
 * // origin.x = 400, origin.y = 300 (center of 800x600)
 */
export function useCoordinates(
  options: UseCoordinatesOptions = {}
): UseCoordinatesResult {
  const {
    initialPattern = 'anchor',
    initialScale = 1.0,
    initialWidth = 1024,
    initialHeight = 768,
  } = options;

  // State
  const [originPattern, setOriginPatternState] =
    useState<OriginPattern>(initialPattern);
  const [scale, setScaleState] = useState<number>(initialScale);
  const [viewportWidth, setViewportWidth] = useState<number>(initialWidth);
  const [viewportHeight, setViewportHeight] = useState<number>(initialHeight);

  // Memoized coordinate system
  const coordinateSystem = useMemo<CoordinateSystem>(
    () => ({
      pattern: originPattern,
      scale,
      viewportWidth,
      viewportHeight,
    }),
    [originPattern, scale, viewportWidth, viewportHeight]
  );

  // Set origin pattern with preset defaults
  const setOriginPattern = useCallback((pattern: OriginPattern) => {
    const preset = getOriginPreset(pattern);
    setOriginPatternState(pattern);
    setScaleState(preset.initialScale);
  }, []);

  // Set scale with validation
  const setScale = useCallback((newScale: number) => {
    // Clamp scale to reasonable range (0.1 to 10.0)
    const clampedScale = Math.max(0.1, Math.min(10.0, newScale));
    setScaleState(clampedScale);
  }, []);

  // Set viewport size
  const setViewportSize = useCallback(
    (width: number, _height: number) => {
      setViewportWidth(width);
      setViewportHeight(_height);
    },
    []
  );

  // Transformation helpers (bound to current coordinate system)
  const screenToLogical = useCallback(
    (screenPoint: Point): Point => {
      return utilScreenToLogical(screenPoint, coordinateSystem);
    },
    [coordinateSystem]
  );

  const logicalToScreen = useCallback(
    (logicalPoint: Point): Point => {
      return utilLogicalToScreen(logicalPoint, coordinateSystem);
    },
    [coordinateSystem]
  );

  // Reset to initial state
  const reset = useCallback(() => {
    setOriginPatternState(initialPattern);
    setScaleState(initialScale);
    setViewportWidth(initialWidth);
    setViewportHeight(initialHeight);
  }, [initialPattern, initialScale, initialWidth, initialHeight]);

  return {
    coordinateSystem,
    originPattern,
    scale,
    setOriginPattern,
    setScale,
    setViewportSize,
    screenToLogical,
    logicalToScreen,
    reset,
  };
}
