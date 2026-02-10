/**
 * Rendering Metrics Panel Types
 *
 * Type definitions for performance monitoring UI components
 */

import type { Viewport } from '../../utils/performance/rendering-performance';
import type { OptimizationPlan } from '@/hooks';

export interface RenderingMetricsPanelProps {
  viewport: Viewport;
  nodeCount: number;
  onOptimizationChange?: (plan: OptimizationPlan) => void;
  className?: string;
  isVisible?: boolean;
}

export interface PerformancePreset {
  name: string;
  description: string;
  targetFPS: number;
  enableAutoOptimization: boolean;
  memoryMonitoring: boolean;
  performanceAlerting: boolean;
  lodLevel: number;
}

export interface MetricTrend {
  value: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'memory' | 'quality';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
  impact: string;
  implementable: boolean;
}