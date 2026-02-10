/**
 * Graph Analytics Debug Panel - Modular version with tab delegation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGraphMetrics, useGraphAnalyticsDebug } from '@/hooks/data/useGraphAnalytics';
import { PerformanceTab } from './PerformanceTab';
import type { AnalyticsDebugConfig, DebugPanelState, PerformanceAlert } from './types';

// Export types
export * from './types';

interface GraphAnalyticsDebugPanelProps {
  className?: string;
}

const defaultConfig: AnalyticsDebugConfig = {
  realTimeMonitoring: false,
  autoOptimization: false,
  verboseLogging: false,
  bridgeMessageInspection: false,
  performanceAlerting: true,
  cacheVisualization: true,
  metricsRetentionDays: 7,
  refreshIntervalMs: 5000,
  alertThresholds: {
    suggestionLatency: 500,
    cacheHitRate: 0.8,
    memoryUsage: 100,
    bridgeLatency: 200,
  },
};

export function GraphAnalyticsDebugPanel({
  className = ''
}: GraphAnalyticsDebugPanelProps) {
  const graphMetrics = useGraphMetrics();
  const debugInfo = useGraphAnalyticsDebug();

  const [state, setState] = useState<DebugPanelState>({
    isCollapsed: true,
    activeTab: 'performance',
    config: defaultConfig,
    alerts: [],
    bridgeMessages: [],
    exportData: null,
  });

  // Toggle panel
  const togglePanel = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  // Switch tab
  const switchTab = useCallback((tab: DebugPanelState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Setup real-time monitoring
  useEffect(() => {
    if (!state.config.realTimeMonitoring || !graphMetrics) return;

    const cleanup = graphMetrics.enableRealTimeMonitoring();
    return () => cleanup?.();
  }, [state.config.realTimeMonitoring, graphMetrics]);

  // Performance alerting
  useEffect(() => {
    if (!state.config.performanceAlerting || !graphMetrics.performance) return;

    const checkAlerts = () => {
      const metrics = graphMetrics.performance!;
      const alerts: PerformanceAlert[] = [];

      // Check suggestion latency
      if (metrics.suggestionLatency.average > state.config.alertThresholds.suggestionLatency) {
        alerts.push({
          id: `latency_${Date.now()}`,
          timestamp: Date.now(),
          type: metrics.suggestionLatency.average > state.config.alertThresholds.suggestionLatency * 2 ? 'critical' : 'warning',
          category: 'latency',
          message: 'High suggestion latency detected',
          value: metrics.suggestionLatency.average,
          threshold: state.config.alertThresholds.suggestionLatency,
          suggestion: 'Consider enabling cache preloading'
        });
      }

      // Check cache hit rate
      if (metrics.cacheHitRate.overall < state.config.alertThresholds.cacheHitRate) {
        alerts.push({
          id: `cache_${Date.now()}`,
          timestamp: Date.now(),
          type: metrics.cacheHitRate.overall < 0.5 ? 'critical' : 'warning',
          category: 'cache',
          message: 'Low cache hit rate',
          value: metrics.cacheHitRate.overall,
          threshold: state.config.alertThresholds.cacheHitRate,
          suggestion: 'Review cache eviction policies'
        });
      }

      setState(prev => ({ ...prev, alerts: [...prev.alerts, ...alerts].slice(-10) }));
    };

    const interval = setInterval(checkAlerts, state.config.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [state.config, graphMetrics.performance]);

  // Export functionality
  const handleExport = useCallback(async () => {
    try {
      const exportData = await graphMetrics.exportMetrics();
      const exportWithDebug = {
        ...exportData,
        debugInfo,
        alerts: state.alerts,
        bridgeMessages: state.bridgeMessages,
        config: state.config,
        timestamp: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportWithDebug, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-debug-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState(prev => ({ ...prev, exportData }));
    } catch (error) {
      console.error('Failed to export analytics data:', error);
    }
  }, [graphMetrics, debugInfo, state.alerts, state.bridgeMessages, state.config]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

  // Chart data for trends
  const chartData = useMemo(() => {
    if (!graphMetrics.performance) return {};

    return {
      latency: {
        label: 'Suggestion Latency (ms)',
        values: [graphMetrics.performance.suggestionLatency.average],
        color: '#3b82f6'
      },
      cacheHitRate: {
        label: 'Cache Hit Rate (%)',
        values: Object.values(graphMetrics.performance.cacheHitRate.byNamespace).map(r => r * 100),
        color: '#10b981'
      },
      memory: {
        label: 'Memory Usage (MB)',
        values: [graphMetrics.performance.memoryUsage.totalMB],
        color: '#f59e0b'
      }
    };
  }, [graphMetrics.performance]);

  if (state.isCollapsed) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={togglePanel}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
        >
          📊 Debug Panel
          {state.alerts.filter(a => a.type === 'critical').length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {state.alerts.filter(a => a.type === 'critical').length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 max-h-[80vh] bg-white dark:bg-gray-800 shadow-2xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Graph Analytics Debug</h3>
          {state.alerts.filter(a => a.type === 'critical').length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {state.alerts.filter(a => a.type === 'critical').length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
            title="Export Debug Data"
          >
            📊
          </button>
          <button
            onClick={togglePanel}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {(['performance', 'cache', 'suggestions', 'bridge', 'optimization'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-colors ${
              state.activeTab === tab
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
        {state.activeTab === 'performance' && (
          <PerformanceTab
            graphMetrics={graphMetrics}
            debugInfo={debugInfo}
            state={state}
            setState={setState}
            chartData={chartData}
            clearAlerts={clearAlerts}
          />
        )}

        {/* Simplified other tabs - can be extracted later */}
        {state.activeTab === 'cache' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">Cache metrics and breakdown</div>
            {/* Cache tab implementation would go here */}
          </div>
        )}

        {state.activeTab === 'suggestions' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">Suggestion performance and accuracy</div>
            {/* Suggestions tab implementation would go here */}
          </div>
        )}

        {state.activeTab === 'bridge' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">Bridge message inspection</div>
            {/* Bridge tab implementation would go here */}
          </div>
        )}

        {state.activeTab === 'optimization' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">Optimization recommendations</div>
            {/* Optimization tab implementation would go here */}
          </div>
        )}
      </div>
    </div>
  );
}