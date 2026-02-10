/**
 * Rendering Metrics Panel Constants
 *
 * Predefined configurations and thresholds for performance monitoring
 */

import type { PerformancePreset } from './types';

export const PERFORMANCE_PRESETS: PerformancePreset[] = [
  {
    name: 'Performance',
    description: 'Maximum performance with aggressive optimizations',
    targetFPS: 60,
    enableAutoOptimization: true,
    memoryMonitoring: true,
    performanceAlerting: true,
    lodLevel: 3
  },
  {
    name: 'Balanced',
    description: 'Balance between performance and visual quality',
    targetFPS: 45,
    enableAutoOptimization: true,
    memoryMonitoring: true,
    performanceAlerting: true,
    lodLevel: 1
  },
  {
    name: 'Quality',
    description: 'Maximum visual quality with basic optimizations',
    targetFPS: 30,
    enableAutoOptimization: false,
    memoryMonitoring: true,
    performanceAlerting: false,
    lodLevel: 0
  },
  {
    name: 'Custom',
    description: 'Manual configuration for specific requirements',
    targetFPS: 60,
    enableAutoOptimization: false,
    memoryMonitoring: true,
    performanceAlerting: true,
    lodLevel: 1
  }
];

export const OPTIMIZATION_THRESHOLDS = {
  critical: { fps: 15, renderTime: 66.67 }, // < 15fps, > 66ms
  warning: { fps: 30, renderTime: 33.33 },  // < 30fps, > 33ms
  good: { fps: 50, renderTime: 20 },        // < 50fps, > 20ms
  excellent: { fps: 58, renderTime: 16.67 } // < 58fps, > 16.67ms
};