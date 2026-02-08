/**
 * Memory Management Utilities - Stub Implementation
 * Simple memory monitoring and cleanup utilities
 */

import type { DependencyList } from 'react';

export interface MemoryInfo {
  usedMB: number;
  totalMB: number;
  percentage: number;
}

export interface MemoryThresholds {
  warning: number;
  critical: number;
}

export interface CleanupCallback {
  (): void | Promise<void>;
}

export function getMemoryInfo(): MemoryInfo {
  // Basic memory info from performance API if available
  const memory = (performance as any).memory;
  if (memory) {
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const totalMB = memory.totalJSHeapSize / 1024 / 1024;
    return {
      usedMB,
      totalMB,
      percentage: (usedMB / totalMB) * 100
    };
  }
  
  return { usedMB: 0, totalMB: 0, percentage: 0 };
}

export function registerCleanupCallback(_callback: CleanupCallback): void {
  // Stub implementation - in production would register for memory pressure events
}

export function forceCleanup(): void {
  // Trigger garbage collection if available
  if (typeof window !== 'undefined' && 'gc' in window) {
    (window as any).gc();
  }
}

export function useMemoryMonitor(_thresholds: MemoryThresholds): MemoryInfo {
  return getMemoryInfo();
}

export function registerMemoryPressureHandler(_handler: (info: MemoryInfo) => void): void {
  // Stub - would register actual memory pressure handlers
}

export function useOptimizedEffect(_effect: () => void, _deps: DependencyList): void {
  // Stub for optimized React effect hook
}

// Additional exports for compatibility
export const useCleanupEffect = (effect: () => (() => void) | void, deps: DependencyList) => {
  // React effect with cleanup
  return { cleanup: effect, deps };
};

export const createCleanupStack = () => {
  const stack: (() => void)[] = [];
  return {
    push: (cleanup: () => void) => stack.push(cleanup),
    cleanup: () => stack.forEach(fn => fn())
  };
};
