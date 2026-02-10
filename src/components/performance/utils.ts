/**
 * Rendering Metrics Panel Utilities
 *
 * Helper functions for performance analysis and optimization recommendations
 */

import type { RenderingMetrics, PerformanceAlert } from '../../utils/performance/rendering-performance';
import type { OptimizationRecommendation } from './types';

export function generateOptimizationRecommendations(
  metrics: RenderingMetrics,
  alerts: PerformanceAlert[],
  nativeRecommendations: string[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Frame rate recommendations
  if (metrics.frameRate < 60) {
    recommendations.push({
      id: 'fps-optimization',
      category: 'performance',
      priority: metrics.frameRate < 30 ? 'critical' : 'high',
      title: 'Improve Frame Rate',
      description: `Current frame rate (${metrics.frameRate.toFixed(1)}fps) is below 60fps target`,
      action: 'Enable viewport culling and increase LOD level',
      impact: 'Improve rendering smoothness and user experience',
      implementable: true
    });
  }

  // Memory recommendations
  const memoryMB = metrics.memoryUsageMB;
  if (memoryMB > 100) {
    recommendations.push({
      id: 'memory-optimization',
      category: 'memory',
      priority: memoryMB > 200 ? 'critical' : 'medium',
      title: 'Reduce Memory Usage',
      description: `Memory usage (${memoryMB.toFixed(1)}MB) is high`,
      action: 'Enable memory optimization strategies and garbage collection',
      impact: 'Prevent memory leaks and improve stability',
      implementable: true
    });
  }

  // Native bridge recommendations
  nativeRecommendations.forEach((rec, index) => {
    if (rec !== 'Performance is optimal') {
      recommendations.push({
        id: `native-rec-${index}`,
        category: 'performance',
        priority: rec.includes('critical') || rec.includes('high') ? 'high' :
                 rec.includes('poor') || rec.includes('exceeds') ? 'medium' : 'low',
        title: 'Native Bridge Recommendation',
        description: rec,
        action: 'Apply recommended optimizations from native analysis',
        impact: 'Leverage native-level performance insights',
        implementable: false
      });
    }
  });

  // Alert-based recommendations
  const highSeverityAlerts = alerts.filter(a => a.severity === 'high');
  if (highSeverityAlerts.length > 0) {
    recommendations.push({
      id: 'alert-response',
      category: 'performance',
      priority: 'high',
      title: 'Address Performance Alerts',
      description: `${highSeverityAlerts.length} high-severity alerts require attention`,
      action: 'Review and resolve performance alerts',
      impact: 'Prevent performance degradation',
      implementable: true
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}