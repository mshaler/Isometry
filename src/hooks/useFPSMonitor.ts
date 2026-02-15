/**
 * useFPSMonitor - Development-only FPS monitoring hook
 *
 * Part of Phase 93 - Polish & Performance (PERF-01)
 * Uses requestAnimationFrame to track frame rate during scroll and animations.
 * Only runs in development mode to avoid production overhead.
 */

import { useState, useEffect, useRef } from 'react';

interface FPSMonitorState {
  /** Current frames per second */
  fps: number;
  /** >= 30fps meets PERF-01 requirement */
  isPerformant: boolean;
  /** >= 55fps provides smooth 60fps experience with buffer */
  isSmooth: boolean;
  /** Rolling average over 1 second */
  avgFps: number;
}

/**
 * Monitor FPS in development mode for performance validation
 *
 * @param enabled - Whether to enable FPS monitoring (default: true)
 * @returns FPSMonitorState with fps, isPerformant, isSmooth, avgFps
 *
 * @example
 * ```tsx
 * const { fps, isPerformant } = useFPSMonitor(showFPSMonitor);
 *
 * return (
 *   <div>
 *     {showFPSMonitor && <FPSBadge fps={fps} isPerformant={isPerformant} />}
 *     <Grid />
 *   </div>
 * );
 * ```
 */
export function useFPSMonitor(enabled: boolean = true): FPSMonitorState {
  const [state, setState] = useState<FPSMonitorState>({
    fps: 60,
    isPerformant: true,
    isSmooth: true,
    avgFps: 60,
  });

  const framesRef = useRef<number[]>([]);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Only run in development and when enabled
    if (process.env.NODE_ENV !== 'development' || !enabled) {
      return;
    }

    const tick = (currentTime: number) => {
      // Add frame timestamp
      framesRef.current.push(currentTime);

      // Keep only last second of frames
      const oneSecondAgo = currentTime - 1000;
      framesRef.current = framesRef.current.filter(t => t > oneSecondAgo);

      // Calculate FPS (frames in last second)
      const currentFPS = framesRef.current.length;

      setState({
        fps: currentFPS,
        isPerformant: currentFPS >= 30,  // PERF-01 requirement
        isSmooth: currentFPS >= 55,       // Target 60fps with 5fps buffer
        avgFps: currentFPS,
      });

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [enabled]);

  return state;
}
