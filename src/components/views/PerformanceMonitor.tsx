import React, { useState, useEffect, useRef } from 'react';

/**
 * PerformanceMonitor - Component to track and display view switching performance
 *
 * Features:
 * - Measures transition times
 * - Tracks frame rates during animations
 * - Memory usage monitoring
 * - Performance alerts for slow operations
 */

export interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  details?: Record<string, any>;
}

export interface PerformanceStats {
  averageTransitionTime: number;
  totalTransitions: number;
  slowestTransition: PerformanceMetric | null;
  fastestTransition: PerformanceMetric | null;
  memoryUsage?: number;
  frameRate?: number;
}

export class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private startTimes = new Map<string, number>();
  private frameCounter = 0;
  private frameStartTime = 0;
  private currentFrameRate = 60;

  startOperation(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  endOperation(operation: string, details?: Record<string, any>): PerformanceMetric | null {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`);
      return null;
    }

    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operation,
      duration: performance.now() - startTime,
      details
    };

    this.metrics.push(metric);
    this.startTimes.delete(operation);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    return metric;
  }

  startFrameTracking(): void {
    this.frameCounter = 0;
    this.frameStartTime = performance.now();
    this.trackFrame();
  }

  private trackFrame = (): void => {
    this.frameCounter++;
    const elapsed = performance.now() - this.frameStartTime;

    if (elapsed >= 1000) {
      this.currentFrameRate = Math.round((this.frameCounter * 1000) / elapsed);
      this.frameCounter = 0;
      this.frameStartTime = performance.now();
    }

    requestAnimationFrame(this.trackFrame);
  };

  getStats(): PerformanceStats {
    const transitionMetrics = this.metrics.filter(m => m.operation.includes('transition'));

    if (transitionMetrics.length === 0) {
      return {
        averageTransitionTime: 0,
        totalTransitions: 0,
        slowestTransition: null,
        fastestTransition: null,
        frameRate: this.currentFrameRate
      };
    }

    const durations = transitionMetrics.map(m => m.duration);
    const average = durations.reduce((a, b) => a + b, 0) / durations.length;
    const slowest = transitionMetrics.reduce((prev, curr) =>
      prev.duration > curr.duration ? prev : curr
    );
    const fastest = transitionMetrics.reduce((prev, curr) =>
      prev.duration < curr.duration ? prev : curr
    );

    return {
      averageTransitionTime: Math.round(average),
      totalTransitions: transitionMetrics.length,
      slowestTransition: slowest,
      fastestTransition: fastest,
      frameRate: this.currentFrameRate,
      memoryUsage: this.getMemoryUsage()
    };
  }

  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
    }
    return undefined;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getRecentMetrics(count = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }
}

// Global performance tracker instance
export const performanceTracker = new PerformanceTracker();

export interface PerformanceMonitorProps {
  /** Whether to show the performance overlay */
  visible?: boolean;

  /** Position of the monitor overlay */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /** Whether to automatically start frame tracking */
  autoTrackFrames?: boolean;
}

export function PerformanceMonitor({
  visible = false,
  position = 'bottom-right',
  autoTrackFrames = true
}: PerformanceMonitorProps) {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoTrackFrames) {
      performanceTracker.startFrameTracking();
    }

    if (visible) {
      updateIntervalRef.current = setInterval(() => {
        setStats(performanceTracker.getStats());
      }, 1000);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [visible, autoTrackFrames]);

  if (!visible || !stats) {
    return null;
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  const getPerformanceColor = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return 'text-green-600';
    if (value <= thresholds[1]) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`fixed ${getPositionClasses()} z-50 max-w-xs`}>
      <div className="bg-black bg-opacity-90 text-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-3 py-2 cursor-pointer hover:bg-white hover:bg-opacity-10"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Performance</span>
            <div className="flex items-center space-x-2">
              <span className={`font-mono ${getPerformanceColor(stats.averageTransitionTime, [100, 300])}`}>
                {stats.averageTransitionTime}ms
              </span>
              <span className={isExpanded ? 'transform rotate-180' : ''}>▼</span>
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 py-2 text-xs space-y-2 border-t border-white border-opacity-20">
            {/* Basic Stats */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Transitions:</span>
                <span className="font-mono">{stats.totalTransitions}</span>
              </div>
              <div className="flex justify-between">
                <span>Frame Rate:</span>
                <span className={`font-mono ${getPerformanceColor(61 - (stats.frameRate || 60), [5, 15])}`}>
                  {stats.frameRate || 0} fps
                </span>
              </div>
              {stats.memoryUsage && (
                <div className="flex justify-between">
                  <span>Memory:</span>
                  <span className={`font-mono ${getPerformanceColor(stats.memoryUsage, [50, 100])}`}>
                    {stats.memoryUsage} MB
                  </span>
                </div>
              )}
            </div>

            {/* Transition Times */}
            <div className="border-t border-white border-opacity-20 pt-2">
              <div className="text-gray-300 mb-1">Transition Times:</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Average:</span>
                  <span className={`font-mono ${getPerformanceColor(stats.averageTransitionTime, [100, 300])}`}>
                    {stats.averageTransitionTime}ms
                  </span>
                </div>
                {stats.fastestTransition && (
                  <div className="flex justify-between text-xs">
                    <span>Fastest:</span>
                    <span className="font-mono text-green-400">
                      {Math.round(stats.fastestTransition.duration)}ms
                    </span>
                  </div>
                )}
                {stats.slowestTransition && (
                  <div className="flex justify-between text-xs">
                    <span>Slowest:</span>
                    <span className={`font-mono ${getPerformanceColor(stats.slowestTransition.duration, [200, 500])}`}>
                      {Math.round(stats.slowestTransition.duration)}ms
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-white border-opacity-20 pt-2">
              <button
                onClick={() => {
                  performanceTracker.clearMetrics();
                  setStats(performanceTracker.getStats());
                }}
                className="w-full py-1 text-xs bg-white bg-opacity-10 rounded hover:bg-opacity-20 transition-colors"
              >
                Clear Metrics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to easily track performance of operations
 */
export function usePerformanceTracking() {
  const trackOperation = (operation: string, fn: () => Promise<any> | any) => {
    performanceTracker.startOperation(operation);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.finally(() => {
          performanceTracker.endOperation(operation);
        });
      } else {
        performanceTracker.endOperation(operation);
        return result;
      }
    } catch (error) {
      performanceTracker.endOperation(operation, { error: error.message });
      throw error;
    }
  };

  return { trackOperation, tracker: performanceTracker };
}

export default PerformanceMonitor;