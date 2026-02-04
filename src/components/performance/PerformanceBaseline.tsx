/**
 * Performance Baseline Component
 *
 * Automated performance measurement and baseline establishment for production
 * validation. Provides comprehensive metrics collection, historical tracking,
 * and performance regression detection with detailed reporting capabilities.
 *
 * Integrates with existing DataFlowMonitor and provides export functionality
 * for performance reports and benchmarking documentation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiveDataMetrics } from '../../hooks/useLiveData';
import { useD3PerformanceWithMonitor } from '../../hooks/useD3Performance';
import { useDataFlowMonitor } from '../DataFlowMonitor';

// Baseline measurement interfaces
interface PerformanceBaseline {
  timestamp: Date;
  dataSize: number;
  initialRenderTime: number;
  averageFPS: number;
  averageLatency: number;
  memoryUsageBaseline: number;
  memoryUsagePeak: number;
  totalMeasurementDuration: number;
  measurementCount: number;
  cacheHitRate: number;
  errorRate: number;
  quality: 'excellent' | 'good' | 'warning' | 'critical';
}

interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  change: number; // percentage change
  confidence: number; // 0-1 confidence score
}

interface PerformanceReport {
  baseline: PerformanceBaseline;
  trends: PerformanceTrend[];
  recommendations: string[];
  alertThresholds: {
    fps: { warning: number; critical: number };
    latency: { warning: number; critical: number };
    memory: { warning: number; critical: number };
  };
  exportTimestamp: Date;
}

interface PerformanceBaselineProps {
  /** Whether the baseline component is visible */
  visible?: boolean;
  /** Target FPS for quality assessment (default: 60) */
  targetFPS?: number;
  /** Maximum acceptable latency in ms (default: 100) */
  maxLatency?: number;
  /** Current data size being processed */
  dataSize?: number;
  /** Measurement duration in seconds (default: 60) */
  measurementDuration?: number;
  /** Whether to auto-start measurements */
  autoStart?: boolean;
  /** Callback when baseline is established */
  onBaselineEstablished?: (baseline: PerformanceBaseline) => void;
  /** Custom CSS classes */
  className?: string;
}

// Default performance thresholds
const DEFAULT_THRESHOLDS = {
  fps: {
    excellent: 58,
    good: 45,
    warning: 30,
    critical: 15
  },
  latency: {
    excellent: 50,
    good: 100,
    warning: 200,
    critical: 500
  },
  memory: {
    excellent: 50, // MB
    good: 100,
    warning: 200,
    critical: 500
  }
};

export function PerformanceBaseline({
  visible = true,
  targetFPS = 60,
  maxLatency = 100,
  dataSize = 0,
  measurementDuration = 60,
  autoStart = true,
  onBaselineEstablished,
  className = ''
}: PerformanceBaselineProps) {
  // State management
  const [isBaselining, setIsBaselining] = useState(false);
  const [currentBaseline, setCurrentBaseline] = useState<PerformanceBaseline | null>(null);
  const [historicalBaselines, setHistoricalBaselines] = useState<PerformanceBaseline[]>([]);
  const [measurementProgress, setMeasurementProgress] = useState(0);
  const [currentMeasurements, setCurrentMeasurements] = useState<{
    fps: number[];
    latency: number[];
    memory: number[];
    renderTimes: number[];
    cacheHits: number[];
    errors: number;
  }>({
    fps: [],
    latency: [],
    memory: [],
    renderTimes: [],
    cacheHits: [],
    errors: 0
  });

  const measurementStartTimeRef = useRef<number>(0);
  const measurementIntervalRef = useRef<NodeJS.Timeout>();
  const progressIntervalRef = useRef<NodeJS.Timeout>();

  // Performance hooks
  const { metrics: liveDataMetrics } = useLiveDataMetrics();
  const { latency: systemLatency } = useDataFlowMonitor();

  // Mock D3 performance hook for baseline component
  const d3PerformanceRef = useRef<HTMLDivElement>(null);
  const d3Performance = useD3PerformanceWithMonitor(d3PerformanceRef.current || undefined, 'performance-baseline');

  // Calculate current performance quality
  const currentQuality = useMemo(() => {
    const fps = d3Performance.currentFps;
    const latency = systemLatency;
    const memory = d3Performance.memoryUsage;

    if (fps >= DEFAULT_THRESHOLDS.fps.excellent &&
        latency <= DEFAULT_THRESHOLDS.latency.excellent &&
        memory <= DEFAULT_THRESHOLDS.memory.excellent) {
      return 'excellent';
    } else if (fps >= DEFAULT_THRESHOLDS.fps.good &&
               latency <= DEFAULT_THRESHOLDS.latency.good &&
               memory <= DEFAULT_THRESHOLDS.memory.good) {
      return 'good';
    } else if (fps >= DEFAULT_THRESHOLDS.fps.warning &&
               latency <= DEFAULT_THRESHOLDS.latency.warning &&
               memory <= DEFAULT_THRESHOLDS.memory.warning) {
      return 'warning';
    } else {
      return 'critical';
    }
  }, [d3Performance.currentFps, systemLatency, d3Performance.memoryUsage]);

  // Performance measurement functions
  const startBaselining = useCallback(() => {
    setIsBaselining(true);
    setMeasurementProgress(0);
    setCurrentMeasurements({
      fps: [],
      latency: [],
      memory: [],
      renderTimes: [],
      cacheHits: [],
      errors: 0
    });

    measurementStartTimeRef.current = Date.now();

    // Collect measurements every second
    measurementIntervalRef.current = setInterval(() => {
      const avgCacheHit = liveDataMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / Math.max(1, liveDataMetrics.length);
      const totalErrors = liveDataMetrics.reduce((sum, m) => sum + m.errorCount, 0);

      setCurrentMeasurements(prev => ({
        fps: [...prev.fps, d3Performance.currentFps],
        latency: [...prev.latency, systemLatency],
        memory: [...prev.memory, d3Performance.memoryUsage],
        renderTimes: [...prev.renderTimes, d3Performance.renderTime],
        cacheHits: [...prev.cacheHits, avgCacheHit],
        errors: totalErrors
      }));
    }, 1000);

    // Update progress every 100ms
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - measurementStartTimeRef.current;
      const progress = Math.min((elapsed / (measurementDuration * 1000)) * 100, 100);
      setMeasurementProgress(progress);

      if (progress >= 100) {
        stopBaselining();
      }
    }, 100);
  }, [liveDataMetrics, d3Performance, systemLatency, measurementDuration]);

  const stopBaselining = useCallback(() => {
    if (measurementIntervalRef.current) {
      clearInterval(measurementIntervalRef.current);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const totalDuration = (Date.now() - measurementStartTimeRef.current) / 1000;

    // Calculate baseline metrics
    const baseline: PerformanceBaseline = {
      timestamp: new Date(),
      dataSize,
      initialRenderTime: currentMeasurements.renderTimes[0] || 0,
      averageFPS: currentMeasurements.fps.reduce((a, b) => a + b, 0) / Math.max(1, currentMeasurements.fps.length),
      averageLatency: currentMeasurements.latency.reduce((a, b) => a + b, 0) / Math.max(1, currentMeasurements.latency.length),
      memoryUsageBaseline: Math.min(...currentMeasurements.memory) || 0,
      memoryUsagePeak: Math.max(...currentMeasurements.memory) || 0,
      totalMeasurementDuration: totalDuration,
      measurementCount: currentMeasurements.fps.length,
      cacheHitRate: currentMeasurements.cacheHits.reduce((a, b) => a + b, 0) / Math.max(1, currentMeasurements.cacheHits.length),
      errorRate: (currentMeasurements.errors / Math.max(1, currentMeasurements.fps.length)) * 100,
      quality: currentQuality
    };

    setCurrentBaseline(baseline);
    setHistoricalBaselines(prev => [...prev, baseline]);
    setIsBaselining(false);
    setMeasurementProgress(0);

    if (onBaselineEstablished) {
      onBaselineEstablished(baseline);
    }

    console.log('Performance baseline established:', baseline);
  }, [currentMeasurements, dataSize, currentQuality, onBaselineEstablished]);

  // Performance trend analysis
  const performanceTrends = useMemo(() => {
    if (historicalBaselines.length < 2) return [];

    const recent = historicalBaselines[historicalBaselines.length - 1];
    const previous = historicalBaselines[historicalBaselines.length - 2];

    const trends: PerformanceTrend[] = [
      {
        metric: 'FPS',
        direction: recent.averageFPS > previous.averageFPS ? 'improving' :
                  recent.averageFPS < previous.averageFPS ? 'degrading' : 'stable',
        change: ((recent.averageFPS - previous.averageFPS) / previous.averageFPS) * 100,
        confidence: 0.9
      },
      {
        metric: 'Latency',
        direction: recent.averageLatency < previous.averageLatency ? 'improving' :
                  recent.averageLatency > previous.averageLatency ? 'degrading' : 'stable',
        change: ((recent.averageLatency - previous.averageLatency) / previous.averageLatency) * 100,
        confidence: 0.85
      },
      {
        metric: 'Memory Usage',
        direction: recent.memoryUsagePeak < previous.memoryUsagePeak ? 'improving' :
                  recent.memoryUsagePeak > previous.memoryUsagePeak ? 'degrading' : 'stable',
        change: ((recent.memoryUsagePeak - previous.memoryUsagePeak) / previous.memoryUsagePeak) * 100,
        confidence: 0.8
      }
    ];

    return trends;
  }, [historicalBaselines]);

  // Performance recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];

    if (currentBaseline) {
      if (currentBaseline.averageFPS < targetFPS) {
        recs.push(`FPS is below target (${currentBaseline.averageFPS.toFixed(1)} < ${targetFPS}). Consider optimizing render cycles.`);
      }
      if (currentBaseline.averageLatency > maxLatency) {
        recs.push(`Average latency exceeds threshold (${currentBaseline.averageLatency.toFixed(1)}ms > ${maxLatency}ms). Check database query optimization.`);
      }
      if (currentBaseline.memoryUsagePeak > DEFAULT_THRESHOLDS.memory.warning) {
        recs.push('Peak memory usage is high. Monitor for memory leaks and consider implementing virtual scrolling.');
      }
      if (currentBaseline.cacheHitRate < 0.8) {
        recs.push('Low cache hit rate. Review caching strategy and TTL settings.');
      }
      if (currentBaseline.errorRate > 5) {
        recs.push('High error rate detected. Review error handling and connection stability.');
      }
    }

    if (recs.length === 0) {
      recs.push('Performance is within acceptable parameters. No immediate optimizations required.');
    }

    return recs;
  }, [currentBaseline, targetFPS, maxLatency]);

  // Export performance report
  const exportReport = useCallback(() => {
    if (!currentBaseline) return;

    const report: PerformanceReport = {
      baseline: currentBaseline,
      trends: performanceTrends,
      recommendations,
      alertThresholds: {
        fps: { warning: DEFAULT_THRESHOLDS.fps.warning, critical: DEFAULT_THRESHOLDS.fps.critical },
        latency: { warning: DEFAULT_THRESHOLDS.latency.warning, critical: DEFAULT_THRESHOLDS.latency.critical },
        memory: { warning: DEFAULT_THRESHOLDS.memory.warning, critical: DEFAULT_THRESHOLDS.memory.critical }
      },
      exportTimestamp: new Date()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentBaseline, performanceTrends, recommendations]);

  // Auto-start baselining
  useEffect(() => {
    if (autoStart && visible && !isBaselining && !currentBaseline) {
      const timer = setTimeout(startBaselining, 2000); // Start after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [autoStart, visible, isBaselining, currentBaseline, startBaselining]);

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (measurementIntervalRef.current) {
        clearInterval(measurementIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Quality badge styling
  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Trend indicator styling
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'improving': return 'text-green-600';
      case 'degrading': return 'text-red-600';
      case 'stable': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (!visible) {
    return <div ref={d3PerformanceRef} className="hidden" />;
  }

  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">Performance Baseline</h2>
            {currentBaseline && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getQualityColor(currentBaseline.quality)}`}>
                {currentBaseline.quality.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!isBaselining && (
              <button
                onClick={startBaselining}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Start Baseline
              </button>
            )}
            {isBaselining && (
              <button
                onClick={stopBaselining}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Stop Baseline
              </button>
            )}
            {currentBaseline && (
              <button
                onClick={exportReport}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Export Report
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">

        {/* Measurement Progress */}
        {isBaselining && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Measuring Performance</span>
              <span className="text-sm text-gray-500">{measurementProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${measurementProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Collecting samples for {measurementDuration} seconds...
            </div>
          </div>
        )}

        {/* Current Baseline Metrics */}
        {currentBaseline && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Average FPS</h3>
              <div className="text-2xl font-bold text-gray-900">{currentBaseline.averageFPS.toFixed(1)}</div>
              <div className="text-sm text-gray-500">Target: {targetFPS}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Average Latency</h3>
              <div className="text-2xl font-bold text-gray-900">{currentBaseline.averageLatency.toFixed(1)}ms</div>
              <div className="text-sm text-gray-500">Max: {maxLatency}ms</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Memory Usage</h3>
              <div className="text-2xl font-bold text-gray-900">{currentBaseline.memoryUsagePeak.toFixed(1)}MB</div>
              <div className="text-sm text-gray-500">Peak during measurement</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Cache Hit Rate</h3>
              <div className="text-2xl font-bold text-gray-900">{(currentBaseline.cacheHitRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Data efficiency</div>
            </div>
          </div>
        )}

        {/* Performance Trends */}
        {performanceTrends.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Performance Trends</h3>
            <div className="space-y-2">
              {performanceTrends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">{trend.metric}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`${getTrendColor(trend.direction)} font-medium`}>
                      {trend.direction === 'improving' ? '↗' : trend.direction === 'degrading' ? '↘' : '→'}
                      {Math.abs(trend.change).toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500">
                      ({(trend.confidence * 100).toFixed(0)}% confidence)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Performance Recommendations</h3>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded">
                <span className="text-blue-600 mt-0.5">•</span>
                <span className="text-blue-800 text-sm">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Baselines */}
        {historicalBaselines.length > 1 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Historical Baselines</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Size</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FPS</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historicalBaselines.slice(-5).map((baseline, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {baseline.timestamp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {baseline.dataSize.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {baseline.averageFPS.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {baseline.averageLatency.toFixed(1)}ms
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getQualityColor(baseline.quality)}`}>
                          {baseline.quality}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Hidden performance monitoring element */}
      <div ref={d3PerformanceRef} className="hidden" />
    </div>
  );
}

export default PerformanceBaseline;