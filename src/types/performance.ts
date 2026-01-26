/**
 * Performance monitoring type definitions
 */

// Memory information interface matching the Performance API
export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Extended Performance interface with memory property
export interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

// Performance metrics for tracking
export interface PerformanceMetrics {
  frameRate?: number;
  averageTransitionTime: number;
  memoryUsage?: number;
}

// Declare global extension for Performance interface
declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
}