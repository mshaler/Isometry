/**
 * Rendering Metrics Panel
 *
 * Comprehensive performance monitoring UI for D3 rendering optimization
 * Provides real-time metrics, optimization controls, and validation capabilities
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRenderingOptimization } from '../../hooks/useRenderingOptimization';
import { renderingPerformanceMonitor, memoryUsageTracker } from '../../utils/rendering-performance';
import type { Viewport, RenderingMetrics, OptimizationPlan, PerformanceAlert } from '../../utils/rendering-performance';
import { Environment } from '../../utils/webview-bridge';

// ============================================================================
// Types
// ============================================================================

export interface RenderingMetricsPanelProps {
  viewport: Viewport;
  nodeCount: number;
  onOptimizationChange?: (plan: OptimizationPlan) => void;
  className?: string;
  isVisible?: boolean;
}

interface PerformancePreset {
  name: string;
  description: string;
  targetFPS: number;
  enableAutoOptimization: boolean;
  memoryMonitoring: boolean;
  performanceAlerting: boolean;
  lodLevel: number;
}

interface MetricTrend {
  value: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'memory' | 'quality';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
  impact: string;
  implementable: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PERFORMANCE_PRESETS: PerformancePreset[] = [
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

const OPTIMIZATION_THRESHOLDS = {
  critical: { fps: 15, renderTime: 66.67 }, // < 15fps, > 66ms
  warning: { fps: 30, renderTime: 33.33 },  // < 30fps, > 33ms
  good: { fps: 50, renderTime: 20 },        // < 50fps, > 20ms
  excellent: { fps: 58, renderTime: 16.67 } // < 58fps, > 16.67ms
};

// ============================================================================
// Component
// ============================================================================

export const RenderingMetricsPanel: React.FC<RenderingMetricsPanelProps> = ({
  viewport,
  nodeCount,
  onOptimizationChange,
  className = '',
  isVisible = true
}) => {

  // ========================================================================
  // State
  // ========================================================================

  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'optimization' | 'memory' | 'alerts'>('overview');
  const [selectedPreset, setSelectedPreset] = useState<string>('Balanced');
  const [customConfig, setCustomConfig] = useState(PERFORMANCE_PRESETS[1]);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(true);
  const [isTestingEnabled, setIsTestingEnabled] = useState(false);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);

  // Rendering optimization hook
  const renderingOptimization = useRenderingOptimization({
    viewport,
    nodeCount,
    targetFPS: customConfig.targetFPS,
    enableAutoOptimization: autoOptimizeEnabled,
    memoryMonitoring: customConfig.memoryMonitoring,
    performanceAlerting: customConfig.performanceAlerting
  });

  // Performance trends tracking
  const [metricHistory, setMetricHistory] = useState<{
    frameRate: number[];
    renderTime: number[];
    memoryUsage: number[];
  }>({
    frameRate: [],
    renderTime: [],
    memoryUsage: []
  });

  // ========================================================================
  // Effects
  // ========================================================================

  // Update performance metrics history
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = renderingOptimization.performanceMetrics;

      setMetricHistory(prev => ({
        frameRate: [...prev.frameRate.slice(-59), metrics.frameRate], // Keep last 60 readings
        renderTime: [...prev.renderTime.slice(-59), metrics.renderTime],
        memoryUsage: [...prev.memoryUsage.slice(-59), metrics.memoryUsage / 1024 / 1024] // Convert to MB
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [renderingOptimization.performanceMetrics]);

  // Update optimization recommendations
  useEffect(() => {
    const updateRecommendations = async () => {
      try {
        const recs = await renderingOptimization.getOptimizationRecommendations();
        const optimizationRecs = generateOptimizationRecommendations(
          renderingOptimization.performanceMetrics,
          renderingOptimization.alerts,
          recs
        );
        setRecommendations(optimizationRecs);
      } catch (error) {
        console.warn('Failed to get optimization recommendations:', error);
      }
    };

    updateRecommendations();
    const interval = setInterval(updateRecommendations, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [renderingOptimization]);

  // Handle preset changes
  useEffect(() => {
    const preset = PERFORMANCE_PRESETS.find(p => p.name === selectedPreset);
    if (preset) {
      setCustomConfig(preset);
      setAutoOptimizeEnabled(preset.enableAutoOptimization);
    }
  }, [selectedPreset]);

  // ========================================================================
  // Computed Values
  // ========================================================================

  const currentMetrics = renderingOptimization.performanceMetrics;
  const alerts = renderingOptimization.alerts;
  const memoryMetrics = renderingOptimization.memoryMetrics;

  const performanceStatus = useMemo(() => {
    const fps = currentMetrics.frameRate;
    const renderTime = currentMetrics.renderTime;

    if (fps >= OPTIMIZATION_THRESHOLDS.excellent.fps && renderTime <= OPTIMIZATION_THRESHOLDS.excellent.renderTime) {
      return { level: 'excellent', color: '#10b981', label: 'Excellent' };
    } else if (fps >= OPTIMIZATION_THRESHOLDS.good.fps && renderTime <= OPTIMIZATION_THRESHOLDS.good.renderTime) {
      return { level: 'good', color: '#3b82f6', label: 'Good' };
    } else if (fps >= OPTIMIZATION_THRESHOLDS.warning.fps && renderTime <= OPTIMIZATION_THRESHOLDS.warning.renderTime) {
      return { level: 'warning', color: '#f59e0b', label: 'Needs Attention' };
    } else {
      return { level: 'critical', color: '#ef4444', label: 'Critical' };
    }
  }, [currentMetrics.frameRate, currentMetrics.renderTime]);

  const metricTrends = useMemo(() => {
    const calculateTrend = (values: number[]): MetricTrend => {
      if (values.length < 2) return { value: values[0] || 0, trend: 'stable', change: 0 };

      const current = values[values.length - 1];
      const previous = values[values.length - 2];
      const change = ((current - previous) / previous) * 100;

      return {
        value: current,
        trend: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down',
        change
      };
    };

    return {
      frameRate: calculateTrend(metricHistory.frameRate),
      renderTime: calculateTrend(metricHistory.renderTime),
      memoryUsage: calculateTrend(metricHistory.memoryUsage)
    };
  }, [metricHistory]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleOptimizeDataset = useCallback(async () => {
    try {
      // Create mock nodes array for optimization
      const mockNodes = Array.from({ length: nodeCount }, (_, i) => ({ id: `node-${i}` }));
      const plan = await renderingOptimization.optimizeForDataset(mockNodes);

      renderingOptimization.applyOptimizations(plan);
      onOptimizationChange?.(plan);

      console.log('Optimization plan applied:', plan);
    } catch (error) {
      console.error('Failed to optimize dataset:', error);
    }
  }, [nodeCount, renderingOptimization, onOptimizationChange]);

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
  }, []);

  const handleClearAlerts = useCallback(() => {
    renderingOptimization.clearAlerts();
  }, [renderingOptimization]);

  const handleForceGC = useCallback(() => {
    const success = renderingOptimization.forceGarbageCollection();
    if (!success) {
      console.warn('Garbage collection not available in this browser');
    }
  }, [renderingOptimization]);

  const handleRunPerformanceTest = useCallback(async () => {
    setIsTestingEnabled(true);

    try {
      // Start performance monitoring
      renderingPerformanceMonitor.startMonitoring();

      // Simulate intensive rendering operations
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        // Simulate rendering work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        const renderTime = performance.now() - startTime;
        renderingOptimization.recordFrame(renderTime);

        // Record memory usage periodically
        if (i % 10 === 0) {
          renderingOptimization.recordMemoryUsage();
        }
      }

      const testResults = renderingPerformanceMonitor.stopMonitoring();
      console.log('Performance test completed:', testResults);

    } finally {
      setIsTestingEnabled(false);
    }
  }, [renderingOptimization]);

  const handleExportReport = useCallback(async () => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        environment: Environment.isWebView() ? 'native' : 'browser',
        configuration: customConfig,
        metrics: currentMetrics,
        alerts: alerts,
        memoryMetrics: memoryMetrics,
        recommendations: recommendations,
        performance: {
          status: performanceStatus,
          trends: metricTrends,
          history: metricHistory
        }
      };

      const dataStr = JSON.stringify(report, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportFileDefaultName = `rendering-performance-${Date.now()}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      console.log('Performance report exported');
    } catch (error) {
      console.error('Failed to export performance report:', error);
    }
  }, [customConfig, currentMetrics, alerts, memoryMetrics, recommendations, performanceStatus, metricTrends, metricHistory]);

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const renderMetricCard = (
    title: string,
    value: string | number,
    unit: string,
    trend: MetricTrend,
    target?: number
  ) => (
    <div className="bg-white rounded-lg shadow p-4 border">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm font-medium text-gray-500">{title}</h4>
          <div className="mt-2 flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">
              {typeof value === 'number' ? value.toFixed(1) : value}
            </p>
            <span className="ml-1 text-sm text-gray-500">{unit}</span>
          </div>
          {target && (
            <p className="text-xs text-gray-400 mt-1">
              Target: {target}{unit}
            </p>
          )}
        </div>
        <div className={`flex items-center text-sm ${
          trend.trend === 'up' ? 'text-green-600' :
          trend.trend === 'down' ? 'text-red-600' :
          'text-gray-400'
        }`}>
          {trend.trend === 'up' ? '↗' : trend.trend === 'down' ? '↘' : '→'}
          <span className="ml-1">
            {Math.abs(trend.change).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );

  const renderAlertBadge = (alert: PerformanceAlert) => (
    <div
      key={alert.timestamp}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        alert.severity === 'high' ? 'bg-red-100 text-red-800' :
        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
        'bg-blue-100 text-blue-800'
      }`}
    >
      {alert.message}
    </div>
  );

  const renderRecommendationCard = (rec: OptimizationRecommendation) => (
    <div key={rec.id} className="bg-white rounded-lg shadow p-4 border">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-medium text-gray-900">{rec.title}</h4>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
          rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'
        }`}>
          {rec.priority}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
      <p className="text-xs text-gray-500 mb-2"><strong>Action:</strong> {rec.action}</p>
      <p className="text-xs text-gray-500"><strong>Impact:</strong> {rec.impact}</p>
      {rec.implementable && (
        <button
          className="mt-3 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => console.log('Implementing recommendation:', rec.id)}
        >
          Apply Recommendation
        </button>
      )}
    </div>
  );

  // ========================================================================
  // Render
  // ========================================================================

  if (!isVisible) return null;

  return (
    <div className={`bg-gray-50 rounded-lg border ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Rendering Performance</h3>
          <div className="flex items-center space-x-2">
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              performanceStatus.level === 'excellent' ? 'bg-green-100 text-green-800' :
              performanceStatus.level === 'good' ? 'bg-blue-100 text-blue-800' :
              performanceStatus.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {performanceStatus.label}
            </div>
            {renderingOptimization.bridgeConnected && (
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Native Bridge Connected
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'metrics', label: 'Metrics' },
              { id: 'optimization', label: 'Optimization' },
              { id: 'memory', label: 'Memory' },
              { id: 'alerts', label: `Alerts (${alerts.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderMetricCard(
                'Frame Rate',
                metricTrends.frameRate.value,
                'fps',
                metricTrends.frameRate,
                customConfig.targetFPS
              )}
              {renderMetricCard(
                'Render Time',
                metricTrends.renderTime.value,
                'ms',
                metricTrends.renderTime,
                16.67
              )}
              {renderMetricCard(
                'Memory Usage',
                metricTrends.memoryUsage.value,
                'MB',
                metricTrends.memoryUsage
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleOptimizeDataset}
                disabled={renderingOptimization.isOptimizing}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {renderingOptimization.isOptimizing ? 'Optimizing...' : 'Optimize Now'}
              </button>
              <button
                onClick={handleRunPerformanceTest}
                disabled={isTestingEnabled}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isTestingEnabled ? 'Testing...' : 'Run Test'}
              </button>
              <button
                onClick={handleExportReport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Export Report
              </button>
            </div>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Alerts</h4>
                <div className="space-y-2">
                  {alerts.slice(-3).map(alert => renderAlertBadge(alert))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4 border">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Rendering Performance</h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Frame Rate:</dt>
                    <dd className="text-sm font-medium">{currentMetrics.frameRate.toFixed(1)} fps</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Render Time:</dt>
                    <dd className="text-sm font-medium">{currentMetrics.renderTime.toFixed(1)} ms</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">60fps Target:</dt>
                    <dd className={`text-sm font-medium ${currentMetrics.performance60FPS ? 'text-green-600' : 'text-red-600'}`}>
                      {currentMetrics.performance60FPS ? 'Met' : 'Not Met'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-white rounded-lg shadow p-4 border">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Optimization Status</h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">LOD Level:</dt>
                    <dd className="text-sm font-medium">{renderingOptimization.lodLevel}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Batching:</dt>
                    <dd className="text-sm font-medium">{renderingOptimization.shouldBatch ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Strategy:</dt>
                    <dd className="text-sm font-medium capitalize">{renderingOptimization.memoryStrategy}</dd>
                  </div>
                </dl>
              </div>

              {memoryMetrics && (
                <div className="bg-white rounded-lg shadow p-4 border">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Memory Status</h4>
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Used Heap:</dt>
                      <dd className="text-sm font-medium">{(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Pressure:</dt>
                      <dd className="text-sm font-medium">{(renderingOptimization.memoryPressure * 100).toFixed(1)}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-600">Leaks:</dt>
                      <dd className={`text-sm font-medium ${memoryMetrics.leakDetected ? 'text-red-600' : 'text-green-600'}`}>
                        {memoryMetrics.leakDetected ? 'Detected' : 'None'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/* Performance Chart */}
            <div className="bg-white rounded-lg shadow p-4 border">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Performance Trends</h4>
              <div className="h-48 flex items-center justify-center text-gray-500">
                {/* Placeholder for performance chart - would integrate with a charting library */}
                <div className="text-center">
                  <div className="text-sm">Performance Chart</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {metricHistory.frameRate.length} data points collected
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'optimization' && (
          <div className="space-y-6">
            {/* Performance Presets */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Presets</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {PERFORMANCE_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetChange(preset.name)}
                    className={`text-left p-4 border rounded-lg ${
                      selectedPreset === preset.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h5 className="font-medium text-gray-900">{preset.name}</h5>
                    <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                    <div className="text-xs text-gray-500 mt-2">
                      Target: {preset.targetFPS}fps
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Optimization Toggle */}
            <div className="bg-white rounded-lg shadow p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto-Optimization</h4>
                  <p className="text-sm text-gray-600">Automatically adjust settings based on performance</p>
                </div>
                <button
                  onClick={() => setAutoOptimizeEnabled(!autoOptimizeEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    autoOptimizeEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoOptimizeEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Optimization Recommendations */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h4>
              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 4).map(rec => renderRecommendationCard(rec))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-4 border text-center text-gray-500">
                  No optimization recommendations at this time
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="space-y-6">
            {/* Memory Overview */}
            {memoryMetrics && (
              <div className="bg-white rounded-lg shadow p-4 border">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Memory Overview</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-semibold text-gray-900">
                      {(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500">Used Heap (MB)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-gray-900">
                      {(renderingOptimization.memoryPressure * 100).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500">Memory Pressure (%)</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-semibold ${memoryMetrics.leakDetected ? 'text-red-600' : 'text-green-600'}`}>
                      {memoryMetrics.leakDetected ? 'YES' : 'NO'}
                    </div>
                    <div className="text-sm text-gray-500">Memory Leaks</div>
                  </div>
                </div>
              </div>
            )}

            {/* Memory Actions */}
            <div className="bg-white rounded-lg shadow p-4 border">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Memory Management</h4>
              <div className="space-y-4">
                <button
                  onClick={handleForceGC}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Force Garbage Collection
                </button>
                <button
                  onClick={() => renderingOptimization.recordMemoryUsage()}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Record Memory Snapshot
                </button>
                <button
                  onClick={() => renderingOptimization.resetOptimizations()}
                  className="w-full inline-flex justify-center py-2 px-4 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Reset All Optimizations
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {/* Alert Controls */}
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-900">Performance Alerts</h4>
              {alerts.length > 0 && (
                <button
                  onClick={handleClearAlerts}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Alerts List */}
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div key={index} className="bg-white rounded-lg shadow p-4 border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                            alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.severity}
                          </span>
                          <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                            {alert.type}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{alert.message}</p>
                        <p className="mt-1 text-xs text-gray-500">{alert.recommendation}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 border text-center text-gray-500">
                <div className="text-lg">🎉</div>
                <div className="mt-2">No performance alerts</div>
                <div className="text-sm text-gray-400 mt-1">
                  Your application is running smoothly
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateOptimizationRecommendations(
  metrics: RenderingMetrics,
  alerts: PerformanceAlert[],
  nativeRecommendations: string[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Frame rate recommendations
  if (!metrics.performance60FPS) {
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
  const memoryMB = metrics.memoryUsage / 1024 / 1024;
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

export default RenderingMetricsPanel;