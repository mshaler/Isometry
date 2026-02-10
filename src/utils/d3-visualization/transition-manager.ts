/**
 * Transition Management
 *
 * Advanced transition system for smooth D3 animations with easing and callbacks.
 * Manages multiple concurrent transitions with high-performance requestAnimationFrame loop.
 */

import * as d3 from 'd3';

interface TransitionConfig {
  duration: number;
  easing: (t: number) => number;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

interface ActiveTransition {
  id: string;
  startTime: number;
  config: TransitionConfig;
  startValues: Record<string, number>;
  endValues: Record<string, number>;
  currentValues: Record<string, number>;
}

export class TransitionManager {
  private activeTransitions = new Map<string, ActiveTransition>();
  private animationFrame: number | null = null;

  start(
    id: string,
    startValues: Record<string, number>,
    endValues: Record<string, number>,
    config: TransitionConfig
  ): void {
    const transition: ActiveTransition = {
      id,
      startTime: performance.now(),
      config,
      startValues: { ...startValues },
      endValues: { ...endValues },
      currentValues: { ...startValues }
    };

    this.activeTransitions.set(id, transition);
    this.ensureAnimationLoop();
  }

  stop(id: string): boolean {
    return this.activeTransitions.delete(id);
  }

  isActive(id: string): boolean {
    return this.activeTransitions.has(id);
  }

  getCurrentValues(id: string): Record<string, number> | null {
    const transition = this.activeTransitions.get(id);
    return transition ? { ...transition.currentValues } : null;
  }

  private ensureAnimationLoop(): void {
    if (this.animationFrame === null && this.activeTransitions.size > 0) {
      this.animationFrame = requestAnimationFrame(() => this.update());
    }
  }

  private update(): void {
    const now = performance.now();
    const completedTransitions: string[] = [];

    for (const [id, transition] of Array.from(this.activeTransitions)) {
      const elapsed = now - transition.startTime;
      const progress = Math.min(elapsed / transition.config.duration, 1);
      const easedProgress = transition.config.easing(progress);

      // Update current values
      for (const key in transition.startValues) {
        const start = transition.startValues[key];
        const end = transition.endValues[key];
        transition.currentValues[key] = start + (end - start) * easedProgress;
      }

      // Call update callback
      transition.config.onUpdate?.(progress);

      // Check if completed
      if (progress >= 1) {
        completedTransitions.push(id);
        transition.config.onComplete?.();
      }
    }

    // Remove completed transitions
    for (const id of completedTransitions) {
      this.activeTransitions.delete(id);
    }

    // Continue loop if needed
    if (this.activeTransitions.size > 0) {
      this.animationFrame = requestAnimationFrame(() => this.update());
    } else {
      this.animationFrame = null;
    }
  }

  getStats(): { active: number; hasAnimationFrame: boolean } {
    return {
      active: this.activeTransitions.size,
      hasAnimationFrame: this.animationFrame !== null
    };
  }

  clear(): void {
    this.activeTransitions.clear();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}

export const transitionManager = new TransitionManager();

// PAFV Transition Effects
export const createPAFVTransition = (
  _fromState: unknown,
  _toState: unknown,
  duration: number = 300
): Promise<void> => {
  return new Promise((resolve) => {
    const transitionId = `pafv-${Date.now()}`;

    // Calculate animation values
    const startValues = {
      scaleProgress: 0
    };

    const endValues = {
      scaleProgress: 1
    };

    transitionManager.start(transitionId, startValues, endValues, {
      duration,
      easing: d3.easeCubicInOut,
      onUpdate: (_progress) => {
        // Custom PAFV transition logic can be added here
        // For now, just track progress
      },
      onComplete: () => {
        resolve();
      }
    });
  });
};

export type { TransitionConfig, ActiveTransition };