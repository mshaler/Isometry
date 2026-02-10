/**
 * Performance tracking utilities for SuperGrid Integration Demo
 */

import { useCallback, useRef, useState } from 'react';
import { contextLogger } from '../utils/logging/dev-logger';
import type { PerformanceMetrics } from './types';

/**
 * Hook for tracking demo performance and feature usage
 */
export function usePerformanceTracking() {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    lastRenderTime: 0,
    averageFrameRate: 60,
    featureUsageCount: {},
    userInteractions: []
  });

  const performanceRef = useRef<number>(0);

  const trackFeatureUsage = useCallback((feature: string, data?: any) => {
    const now = performance.now();
    setPerformanceMetrics(prev => ({
      ...prev,
      featureUsageCount: {
        ...prev.featureUsageCount,
        [feature]: (prev.featureUsageCount[feature] || 0) + 1
      },
      userInteractions: [
        ...prev.userInteractions.slice(-99), // Keep last 100 interactions
        {
          feature,
          timestamp: now,
          duration: now - performanceRef.current,
          data
        }
      ]
    }));
    performanceRef.current = now;
    contextLogger.metrics('Feature usage tracked', { feature, data });
  }, []);

  const updateFrameRate = useCallback((fps: number) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      averageFrameRate: Math.round((prev.averageFrameRate * 0.9 + fps * 0.1))
    }));
  }, []);

  const updateRenderTime = useCallback((duration: number) => {
    setPerformanceMetrics(prev => ({ ...prev, lastRenderTime: duration }));
  }, []);

  return {
    performanceMetrics,
    trackFeatureUsage,
    updateFrameRate,
    updateRenderTime
  };
}