/**
 * useRenderLoopGuard - Development-mode safeguard against infinite render loops
 *
 * Tracks render count and warns when a component renders too frequently,
 * which usually indicates an infinite loop caused by:
 * - Unmemoized context values
 * - Effects with unstable dependencies
 * - State updates during render
 *
 * @see .planning/phases/59-stability-memoization/59-01-PLAN.md
 */

import { useRef, useEffect } from 'react';
import { devLogger } from '../../utils/dev-logger';

interface RenderLoopGuardOptions {
  /** Component name for logging (defaults to 'Component') */
  componentName?: string;
  /** Max renders per second before warning (default: 10) */
  threshold?: number;
  /** Whether to throw an error instead of just warning (default: false) */
  throwOnExceed?: boolean;
}

/**
 * Hook to detect infinite render loops in development mode.
 *
 * Usage:
 * ```tsx
 * function MyProvider({ children }) {
 *   useRenderLoopGuard({ componentName: 'MyProvider' });
 *   // ... rest of component
 * }
 * ```
 *
 * In production: No-op (zero overhead)
 * In development: Tracks renders/second and warns if threshold exceeded
 */
export function useRenderLoopGuard(options: RenderLoopGuardOptions = {}): void {
  const {
    componentName = 'Component',
    threshold = 10,
    throwOnExceed = false,
  } = options;

  // Track render count and last reset time
  const renderCountRef = useRef(0);
  const lastResetRef = useRef(Date.now());
  const hasWarnedRef = useRef(false);

  // No-op in production for zero overhead
  if (import.meta.env.PROD) {
    return;
  }

  // Increment render count
  renderCountRef.current += 1;

  // Check if we need to reset (1 second window)
  const now = Date.now();
  const elapsed = now - lastResetRef.current;

  if (elapsed >= 1000) {
    // Reset counter for new window
    renderCountRef.current = 1;
    lastResetRef.current = now;
    hasWarnedRef.current = false;
  } else if (renderCountRef.current > threshold && !hasWarnedRef.current) {
    // Threshold exceeded within window
    hasWarnedRef.current = true;

    const message = `[RenderLoopGuard] ${componentName} rendered ${renderCountRef.current} times in ${elapsed}ms. ` +
      `This may indicate an infinite render loop. Check for:\n` +
      `  - Unmemoized context values (wrap in useMemo)\n` +
      `  - Effects with unstable dependencies\n` +
      `  - State updates during render`;

    if (throwOnExceed) {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }

  // Cleanup effect to log final count on unmount (useful for debugging)
  useEffect(() => {
    return () => {
      if (renderCountRef.current > threshold) {
        devLogger.debug(
          `[RenderLoopGuard] ${componentName} unmounted after ` +
          `${renderCountRef.current} renders in final window`
        );
      }
    };
  }, [componentName, threshold]);
}
