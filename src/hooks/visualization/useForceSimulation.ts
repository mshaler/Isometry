/**
 * useForceSimulation Hook
 *
 * React hook for managing D3 force simulation lifecycle.
 * Integrates ForceSimulationManager with React's effect system
 * to ensure proper cleanup on unmount.
 */

import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import { ForceSimulationManager } from '../../d3/visualizations/network/ForceSimulationManager';
import type {
  GraphNode,
  GraphLink,
  ForceGraphConfig,
  SimulationState,
} from '../../d3/visualizations/network/types';

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for useForceSimulation hook
 */
export interface UseForceSimulationOptions {
  /** SVG container ref */
  containerRef: RefObject<SVGGElement | null>;
  /** Graph nodes */
  nodes: GraphNode[];
  /** Graph links */
  links: GraphLink[];
  /** Force simulation config */
  config?: Partial<ForceGraphConfig>;
  /** Enable/disable simulation (default: true) */
  enabled?: boolean;
  /** Called on each simulation tick */
  onTick?: (nodes: GraphNode[], links: GraphLink[]) => void;
  /** Called when simulation ends */
  onEnd?: () => void;
}

/**
 * Result from useForceSimulation hook
 */
export interface UseForceSimulationResult {
  /** Reheat the simulation to resume physics */
  reheat: (alpha?: number) => void;
  /** Stop the simulation */
  stop: () => void;
  /** Current simulation state */
  state: SimulationState;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useForceSimulation
 *
 * Manages D3 force simulation lifecycle with React.
 * Uses two-effect pattern:
 * 1. Manager creation/destruction (runs once)
 * 2. Simulation start/stop (runs on data changes)
 *
 * @param options - Hook configuration
 * @returns Control methods and state
 *
 * @example
 * ```tsx
 * const containerRef = useRef<SVGGElement>(null);
 * const { reheat, stop, state } = useForceSimulation({
 *   containerRef,
 *   nodes,
 *   links,
 *   config: { width: 800, height: 600 },
 *   onTick: (nodes) => {
 *     // Update positions in DOM
 *   },
 * });
 * ```
 */
export function useForceSimulation(
  options: UseForceSimulationOptions
): UseForceSimulationResult {
  const {
    containerRef,
    nodes,
    links,
    config = {},
    enabled = true,
    onTick,
    onEnd,
  } = options;

  // Manager ref - persists across renders
  const managerRef = useRef<ForceSimulationManager | null>(null);

  // Track simulation state
  const [state, setState] = useState<SimulationState>('stopped');

  // Effect 1: Manager creation (runs once)
  useEffect(() => {
    managerRef.current = new ForceSimulationManager();

    return () => {
      // CRITICAL: destroy() on unmount prevents memory leaks
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  // Effect 2: Simulation lifecycle (runs on data/config changes)
  useEffect(() => {
    const manager = managerRef.current;
    const container = containerRef.current;

    // Early exit if disabled or missing data
    if (!enabled || !container || nodes.length === 0) {
      manager?.stop();
      setState('stopped');
      return;
    }

    // Start simulation with callbacks
    manager?.start(container, nodes, links, config, {
      onTick: (n, l) => {
        setState(manager?.getState() ?? 'stopped');
        onTick?.(n, l);
      },
      onEnd: () => {
        setState('stopped');
        onEnd?.();
      },
    });

    // Cleanup: stop simulation when deps change
    return () => {
      manager?.stop();
    };
  }, [containerRef, nodes, links, config, enabled, onTick, onEnd]);

  // Memoized control methods
  const reheat = useCallback((alpha?: number) => {
    managerRef.current?.reheat(alpha);
  }, []);

  const stop = useCallback(() => {
    managerRef.current?.stop();
  }, []);

  return { reheat, stop, state };
}
