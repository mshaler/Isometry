/**
 * Rendering Metrics Panel - Refactored
 *
 * Comprehensive performance monitoring UI using focused tab components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRenderingOptimization, type OptimizationPlan } from '@/hooks';
import { renderingPerformanceMonitor } from '../../utils/performance/rendering-performance';
import type { Viewport, RenderingMetrics, PerformanceAlert } from '../../utils/performance/rendering-performance';
// Bridge eliminated in v4 - sql.js direct access
import { Environment } from '../../utils/webview-bridge';

// Import focused components and utilities
import { OverviewTab, MetricsTab, OptimizationTab, MemoryTab, AlertsTab } from './tabs';
import { PERFORMANCE_PRESETS, OPTIMIZATION_THRESHOLDS } from './constants';
import type { RenderingMetricsPanelProps, PerformancePreset, MetricTrend, OptimizationRecommendation } from './types';
import { generateOptimizationRecommendations } from './utils';

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
        memoryUsage: [...prev.memoryUsage.slice(-59), metrics.memoryUsageMB]
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [renderingOptimization.performanceMetrics]);

  // Update optimization recommendations
  useEffect(() => {
    if (renderingOptimization.performanceMetrics && renderingOptimization.performanceAlerts) {
      const recs = generateOptimizationRecommendations(
        renderingOptimization.performanceMetrics,
        renderingOptimization.performanceAlerts,
        renderingOptimization.nativeRecommendations || []
      );
      setRecommendations(recs);
    }
  }, [renderingOptimization.performanceMetrics, renderingOptimization.performanceAlerts, renderingOptimization.nativeRecommendations]);

  // Pass optimization changes to parent
  useEffect(() => {
    if (onOptimizationChange && renderingOptimization.currentPlan) {
      onOptimizationChange(renderingOptimization.currentPlan);
    }
  }, [onOptimizationChange, renderingOptimization.currentPlan]);

  // ========================================================================
  // Memoized Values
  // ========================================================================

  const currentMetrics = renderingOptimization.performanceMetrics;
  const alerts = renderingOptimization.performanceAlerts || [];
  const memoryMetrics = renderingOptimization.memoryMetrics;

  // Calculate metric trends
  const metricTrends = useMemo(() => {
    const calculateTrend = (values: number[], current: number): MetricTrend => {
      if (values.length < 2) return { value: current, trend: 'stable', change: 0 };

      const previous = values[values.length - 2];
      const change = current - previous;
      const threshold = current * 0.05; // 5% threshold for trend detection

      return {
        value: current,
        trend: change > threshold ? 'up' : change < -threshold ? 'down' : 'stable',
        change: Math.abs(change)
      };
    };

    return {
      frameRate: calculateTrend(metricHistory.frameRate, currentMetrics.frameRate),
      renderTime: calculateTrend(metricHistory.renderTime, currentMetrics.renderTime),
      memoryUsage: calculateTrend(metricHistory.memoryUsage, currentMetrics.memoryUsageMB)
    };
  }, [metricHistory, currentMetrics]);

  // ========================================================================
  // Handlers
  // ========================================================================

  const handlePresetChange = useCallback((presetName: string) => {
    const preset = PERFORMANCE_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      setCustomConfig(preset);
      setAutoOptimizeEnabled(preset.enableAutoOptimization);

      if (renderingOptimization.applyOptimizationPlan) {
        renderingOptimization.applyOptimizationPlan({
          targetFPS: preset.targetFPS,
          memoryStrategy: 'balanced',
          lodLevel: preset.lodLevel
        });
      }
    }
  }, [renderingOptimization]);

  const handleOptimizeDataset = useCallback(() => {
    renderingOptimization.optimizeForDataset();
  }, [renderingOptimization]);

  const handleRunPerformanceTest = useCallback(() => {
    setIsTestingEnabled(true);
    renderingOptimization.runPerformanceTest?.()
      .finally(() => setIsTestingEnabled(false));
  }, [renderingOptimization]);

  const handleExportReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: currentMetrics,
      alerts: alerts,
      recommendations: recommendations,
      configuration: customConfig
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-report-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }, [currentMetrics, alerts, recommendations, customConfig]);

  const handleClearAlerts = useCallback(() => {
    renderingOptimization.clearAlerts?.();
  }, [renderingOptimization]);

  const handleForceGC = useCallback(() => {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }, []);

  // ========================================================================
  // Render Helpers
  // ========================================================================

  const renderMetricCard = (name: string, value: number, unit: string, trend: MetricTrend, target?: number) => (
    <div className="bg-white rounded-lg shadow p-4 border">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-500">{name}</h4>
          <div className="mt-1 flex items-baseline">
            <div className="text-2xl font-semibold text-gray-900">
              {value.toFixed(1)}
            </div>
            <div className="ml-2 text-sm text-gray-500">{unit}</div>
          </div>
          {target && (
            <div className={`text-xs mt-1 ${value >= target ? 'text-green-600' : 'text-red-600'}`}>
              Target: {target}{unit}
            </div>
          )}
        </div>
        <div className="flex items-center">
          {trend.trend === 'up' && <span className="text-red-500">↗</span>}
          {trend.trend === 'down' && <span className="text-green-500">↘</span>}
          {trend.trend === 'stable' && <span className="text-gray-400">→</span>}
        </div>
      </div>
    </div>
  );

  const renderAlertBadge = (alert: PerformanceAlert) => (
    <div key={alert.timestamp} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      alert.severity === 'high' ? 'bg-red-100 text-red-800' :
      alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
      'bg-blue-100 text-blue-800'
    }`}>
      {alert.message}
    </div>
  );

  const renderRecommendationCard = (rec: OptimizationRecommendation) => (
    <div key={rec.id} className="bg-white rounded-lg shadow p-4 border">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-medium text-gray-900">{rec.title}</h5>
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
          rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {rec.priority}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
      <p className="text-xs text-gray-500">{rec.action}</p>
    </div>
  );

  // ========================================================================
  // Render
  // ========================================================================

  if (!isVisible) return null;

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Performance Monitor
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {nodeCount.toLocaleString()} nodes • {currentMetrics.frameRate.toFixed(1)} fps
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 px-4">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'metrics', label: 'Metrics' },
            { id: 'optimization', label: 'Optimization' },
            { id: 'memory', label: 'Memory' },
            { id: 'alerts', label: 'Alerts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.id === 'alerts' && alerts.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            metricTrends={metricTrends}
            customConfig={customConfig}
            alerts={alerts}
            isOptimizing={renderingOptimization.isOptimizing}
            isTestingEnabled={isTestingEnabled}
            onOptimizeDataset={handleOptimizeDataset}
            onRunPerformanceTest={handleRunPerformanceTest}
            onExportReport={handleExportReport}
            renderMetricCard={renderMetricCard}
            renderAlertBadge={renderAlertBadge}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsTab
            currentMetrics={currentMetrics}
            renderingOptimization={renderingOptimization}
            memoryMetrics={memoryMetrics}
            metricHistory={metricHistory}
          />
        )}

        {activeTab === 'optimization' && (
          <OptimizationTab
            selectedPreset={selectedPreset}
            autoOptimizeEnabled={autoOptimizeEnabled}
            recommendations={recommendations}
            onPresetChange={handlePresetChange}
            onAutoOptimizeToggle={setAutoOptimizeEnabled}
            renderRecommendationCard={renderRecommendationCard}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryTab
            memoryMetrics={memoryMetrics}
            memoryPressure={renderingOptimization.memoryPressure}
            onForceGC={handleForceGC}
            onRecordMemorySnapshot={() => renderingOptimization.recordMemoryUsage()}
            onResetOptimizations={() => renderingOptimization.resetOptimizations()}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsTab
            alerts={alerts}
            onClearAlerts={handleClearAlerts}
          />
        )}
      </div>
    </div>
  );
};

export default RenderingMetricsPanel;