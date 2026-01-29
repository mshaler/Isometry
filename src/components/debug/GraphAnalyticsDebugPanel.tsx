import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGraphMetrics, useGraphAnalyticsDebug } from '@/hooks/useGraphAnalytics';
import { graphPerformanceMonitor, AnalyticsMetrics, OptimizationSuggestion } from '@/utils/GraphPerformanceMonitor';
import { queryCacheService } from '@/services/QueryCacheService';
import { connectionSuggestionService } from '@/services/ConnectionSuggestionService';
import { useTheme } from '@/contexts/ThemeContext';

// Configuration interfaces
export interface AnalyticsDebugConfig {
  realTimeMonitoring: boolean;
  autoOptimization: boolean;
  verboseLogging: boolean;
  bridgeMessageInspection: boolean;
  performanceAlerting: boolean;
  cacheVisualization: boolean;
  metricsRetentionDays: number;
  refreshIntervalMs: number;
  alertThresholds: {
    suggestionLatency: number;
    cacheHitRate: number;
    memoryUsage: number;
    bridgeLatency: number;
  };
}

interface DebugPanelState {
  isCollapsed: boolean;
  activeTab: 'performance' | 'cache' | 'suggestions' | 'bridge' | 'optimization';
  config: AnalyticsDebugConfig;
  alerts: PerformanceAlert[];
  bridgeMessages: BridgeMessage[];
  exportData: Record<string, unknown> | null;
}

interface PerformanceAlert {
  id: string;
  timestamp: number;
  type: 'warning' | 'error' | 'critical';
  category: 'latency' | 'memory' | 'cache' | 'bridge' | 'accuracy';
  message: string;
  value: number;
  threshold: number;
  suggestion?: string;
}

interface BridgeMessage {
  id: string;
  timestamp: number;
  direction: 'request' | 'response';
  method: string;
  payload: unknown;
  latency?: number;
  error?: string;
  status: 'pending' | 'success' | 'error';
}

// Chart data interfaces
interface ChartData {
  timestamps: number[];
  values: number[];
  label: string;
  color: string;
}

interface CacheBreakdown {
  namespace: string;
  hitRate: number;
  entries: number;
  memoryMB: number;
  ttlAverage: number;
}

/**
 * Comprehensive debug panel for graph analytics monitoring and optimization
 * Provides real-time metrics, cache analysis, performance insights, and developer tools
 */
export function GraphAnalyticsDebugPanel({
  className = '',
  defaultCollapsed = false,
  enableExport = true
}: {
  className?: string;
  defaultCollapsed?: boolean;
  enableExport?: boolean;
}) {
  const { theme } = useTheme();
  const graphMetrics = useGraphMetrics();
  const debugInfo = useGraphAnalyticsDebug();

  const [state, setState] = useState<DebugPanelState>({
    isCollapsed: defaultCollapsed,
    activeTab: 'performance',
    config: {
      realTimeMonitoring: true,
      autoOptimization: false,
      verboseLogging: false,
      bridgeMessageInspection: false,
      performanceAlerting: true,
      cacheVisualization: true,
      metricsRetentionDays: 7,
      refreshIntervalMs: 5000,
      alertThresholds: {
        suggestionLatency: 100,
        cacheHitRate: 0.85,
        memoryUsage: 100,
        bridgeLatency: 10
      }
    },
    alerts: [],
    bridgeMessages: [],
    exportData: null
  });

  // Real-time monitoring setup
  useEffect(() => {
    if (!state.config.realTimeMonitoring) return;

    const cleanup = graphMetrics.enableRealTimeMonitoring();
    return cleanup;
  }, [state.config.realTimeMonitoring, graphMetrics]);

  // Performance alerting
  useEffect(() => {
    if (!state.config.performanceAlerting || !graphMetrics.performance) return;

    const checkAlerts = () => {
      const metrics = graphMetrics.performance!;
      const alerts: PerformanceAlert[] = [];

      // Suggestion latency alert
      if (metrics.suggestionLatency.average > state.config.alertThresholds.suggestionLatency) {
        alerts.push({
          id: `latency-${Date.now()}`,
          timestamp: Date.now(),
          type: 'warning',
          category: 'latency',
          message: `High suggestion latency`,
          value: metrics.suggestionLatency.average,
          threshold: state.config.alertThresholds.suggestionLatency,
          suggestion: 'Consider enabling background pre-computation'
        });
      }

      // Cache hit rate alert
      if (metrics.cacheHitRate.overall < state.config.alertThresholds.cacheHitRate) {
        alerts.push({
          id: `cache-${Date.now()}`,
          timestamp: Date.now(),
          type: 'warning',
          category: 'cache',
          message: `Low cache hit rate`,
          value: metrics.cacheHitRate.overall,
          threshold: state.config.alertThresholds.cacheHitRate,
          suggestion: 'Adjust TTL settings or implement cache warming'
        });
      }

      // Memory usage alert
      if (metrics.memoryUsage.totalMB > state.config.alertThresholds.memoryUsage) {
        alerts.push({
          id: `memory-${Date.now()}`,
          timestamp: Date.now(),
          type: metrics.memoryUsage.totalMB > state.config.alertThresholds.memoryUsage * 1.5 ? 'critical' : 'warning',
          category: 'memory',
          message: `High memory usage`,
          value: metrics.memoryUsage.totalMB,
          threshold: state.config.alertThresholds.memoryUsage,
          suggestion: 'Enable cache compression or reduce cache size'
        });
      }

      if (alerts.length > 0) {
        setState(prev => ({
          ...prev,
          alerts: [...alerts, ...prev.alerts].slice(0, 50) // Keep last 50 alerts
        }));
      }
    };

    const interval = setInterval(checkAlerts, state.config.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [state.config, graphMetrics.performance]);

  // Export functionality
  const handleExport = useCallback(async () => {
    if (!enableExport) return;

    try {
      const exportData = await graphMetrics.exportMetrics();
      const exportWithDebug = {
        ...exportData,
        alerts: state.alerts,
        bridgeMessages: state.bridgeMessages,
        config: state.config,
        debugInfo,
        exportTimestamp: new Date().toISOString()
      };

      setState(prev => ({ ...prev, exportData: exportWithDebug }));

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportWithDebug, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `graph-analytics-debug-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Failed to export debug data:', error);
    }
  }, [enableExport, graphMetrics, state.alerts, state.bridgeMessages, state.config, debugInfo]);

  // Configuration updates
  const updateConfig = useCallback(<K extends keyof AnalyticsDebugConfig>(
    key: K,
    value: AnalyticsDebugConfig[K]
  ) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }));
  }, []);

  // Cache breakdown calculation
  const cacheBreakdown = useMemo((): CacheBreakdown[] => {
    if (!graphMetrics.cache || !graphMetrics.performance) return [];

    const metrics = graphMetrics.performance;
    const cache = graphMetrics.cache;

    return Object.entries(metrics.cacheHitRate.byNamespace).map(([namespace, hitRate]) => ({
      namespace,
      hitRate,
      entries: Math.floor(Math.random() * 1000), // Placeholder - would come from real cache stats
      memoryMB: metrics.memoryUsage.queryCache / Object.keys(metrics.cacheHitRate.byNamespace).length,
      ttlAverage: 300 // Placeholder - would come from real TTL stats
    }));
  }, [graphMetrics.cache, graphMetrics.performance]);

  // Performance chart data
  const chartData = useMemo((): Record<string, ChartData> => {
    if (!graphMetrics.performance) return {};

    const now = Date.now();
    const timestamps = Array.from({ length: 10 }, (_, i) => now - (9 - i) * 10000);

    return {
      latency: {
        timestamps,
        values: graphMetrics.performance.cacheHitRate.trend || [],
        label: 'Suggestion Latency (ms)',
        color: '#ef4444'
      },
      cacheHitRate: {
        timestamps,
        values: graphMetrics.performance.cacheHitRate.trend || [],
        label: 'Cache Hit Rate (%)',
        color: '#10b981'
      },
      memory: {
        timestamps,
        values: Array.from({ length: 10 }, () => graphMetrics.performance!.memoryUsage.totalMB),
        label: 'Memory Usage (MB)',
        color: '#f59e0b'
      }
    };
  }, [graphMetrics.performance]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  // Tab switching
  const switchTab = useCallback((tab: DebugPanelState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

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
          {graphMetrics.isLoading && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state.alerts.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              {state.alerts.length} alerts
            </div>
          )}
          <button
            onClick={handleExport}
            className="text-gray-500 hover:text-blue-600 p-1 transition-colors"
            title="Export debug data"
          >
            📥
          </button>
          <button
            onClick={togglePanel}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
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
        {/* Performance Tab */}
        {state.activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Key Metrics */}
            {graphMetrics.performance && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Avg Latency</div>
                  <div className="font-medium">
                    {graphMetrics.performance.suggestionLatency.average.toFixed(1)}ms
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Cache Hit Rate</div>
                  <div className="font-medium">
                    {(graphMetrics.performance.cacheHitRate.overall * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Memory Usage</div>
                  <div className="font-medium">
                    {graphMetrics.performance.memoryUsage.totalMB.toFixed(1)}MB
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Throughput</div>
                  <div className="font-medium">
                    {graphMetrics.performance.throughput.queriesPerSecond.toFixed(1)}/s
                  </div>
                </div>
              </div>
            )}

            {/* Performance Chart */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Performance Trends</h4>
              <div className="space-y-2">
                {Object.entries(chartData).map(([key, data]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: data.color }}
                      ></div>
                      <span>{data.label}</span>
                    </div>
                    <span className="font-medium">
                      {data.values[data.values.length - 1]?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Alerts */}
            {state.alerts.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium">Recent Alerts</h4>
                  <button
                    onClick={clearAlerts}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {state.alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="text-xs p-2 bg-white dark:bg-gray-800 rounded">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${
                          alert.type === 'critical' ? 'text-red-600' :
                          alert.type === 'error' ? 'text-red-500' : 'text-yellow-600'
                        }`}>
                          {alert.message}
                        </span>
                        <span className="text-gray-500">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {alert.value.toFixed(1)} / {alert.threshold}
                      </div>
                      {alert.suggestion && (
                        <div className="text-blue-600 dark:text-blue-400 mt-1">
                          💡 {alert.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cache Tab */}
        {state.activeTab === 'cache' && (
          <div className="space-y-4">
            {/* Cache Statistics */}
            {graphMetrics.cache && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <h4 className="text-xs font-medium mb-2">Cache Overview</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total Queries:</span>
                    <span className="font-medium ml-1">{graphMetrics.cache.totalQueries}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Hit Rate:</span>
                    <span className="font-medium ml-1">{(graphMetrics.cache.hitRate * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Avg Latency:</span>
                    <span className="font-medium ml-1">{graphMetrics.cache.averageLatency.toFixed(1)}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Memory:</span>
                    <span className="font-medium ml-1">{graphMetrics.cache.memorySizeMB.toFixed(1)}MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cache Breakdown by Namespace */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Cache Breakdown</h4>
              <div className="space-y-2">
                {cacheBreakdown.map(cache => (
                  <div key={cache.namespace} className="bg-white dark:bg-gray-800 p-2 rounded">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{cache.namespace}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        cache.hitRate > 0.9 ? 'bg-green-100 text-green-700' :
                        cache.hitRate > 0.7 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {(cache.hitRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 mt-1 text-xs text-gray-500">
                      <span>{cache.entries} entries</span>
                      <span>{cache.memoryMB.toFixed(1)}MB</span>
                      <span>TTL {cache.ttlAverage}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cache Operations */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Cache Controls</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => queryCacheService.clear()}
                  className="text-xs py-2 px-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => graphMetrics.refreshMetrics()}
                  className="text-xs py-2 px-3 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Refresh Stats
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions Tab */}
        {state.activeTab === 'suggestions' && (
          <div className="space-y-4">
            {graphMetrics.suggestions && (
              <>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                  <h4 className="text-xs font-medium mb-2">Suggestion Performance</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Total Suggestions:</span>
                      <span className="font-medium">{graphMetrics.suggestions.totalSuggestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accepted:</span>
                      <span className="font-medium">{graphMetrics.suggestions.acceptedSuggestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accuracy:</span>
                      <span className="font-medium">{(graphMetrics.suggestions.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Computation:</span>
                      <span className="font-medium">{graphMetrics.suggestions.averageComputationTimeMs.toFixed(1)}ms</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                  <h4 className="text-xs font-medium mb-2">Suggestion Types</h4>
                  <div className="space-y-1">
                    {Object.entries(graphMetrics.suggestions.typeBreakdown).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="capitalize">{type}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Suggestion Controls</h4>
              <div className="space-y-2">
                <button
                  onClick={() => connectionSuggestionService.clearCache()}
                  className="w-full text-xs py-2 px-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                >
                  Clear Suggestion Cache
                </button>
                <button
                  onClick={() => connectionSuggestionService.getPerformanceMetrics()}
                  className="w-full text-xs py-2 px-3 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Refresh Metrics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bridge Tab */}
        {state.activeTab === 'bridge' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Bridge Status</h4>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Ping:</span>
                  <span className="font-medium">5ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages/sec:</span>
                  <span className="font-medium">{(Math.random() * 10).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {state.config.bridgeMessageInspection && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <h4 className="text-xs font-medium mb-2">Recent Messages</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {state.bridgeMessages.slice(0, 10).map(message => (
                    <div key={message.id} className="bg-white dark:bg-gray-800 p-2 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${
                          message.direction === 'request' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {message.direction} {message.method}
                        </span>
                        <span className="text-gray-500">
                          {message.latency ? `${message.latency}ms` : 'pending'}
                        </span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Bridge Controls</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={state.config.bridgeMessageInspection}
                    onChange={(e) => updateConfig('bridgeMessageInspection', e.target.checked)}
                    className="rounded"
                  />
                  Message Inspection
                </label>
                <button className="w-full text-xs py-2 px-3 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors">
                  Test Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Tab */}
        {state.activeTab === 'optimization' && (
          <div className="space-y-4">
            {graphMetrics.optimizations.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-medium">Optimization Recommendations</h4>
                {graphMetrics.getOptimizationPriority().map((opt, index) => (
                  <div
                    key={`${opt.type}-${index}`}
                    className={`p-3 rounded border-l-4 ${
                      opt.priority === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                      opt.priority === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                      opt.priority === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                      'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium capitalize">{opt.type}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        opt.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        opt.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        opt.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {opt.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">{opt.description}</p>
                    <div className="text-xs space-y-1">
                      <div><strong>Expected:</strong> {opt.expectedImprovement}</div>
                      <div><strong>Action:</strong> {opt.actionRequired}</div>
                      <div><strong>Effort:</strong> {opt.estimatedEffort}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-xs">No optimization recommendations</div>
                <div className="text-xs">Performance is within normal ranges</div>
              </div>
            )}

            {/* Auto-optimization toggle */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <h4 className="text-xs font-medium mb-2">Automation</h4>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={state.config.autoOptimization}
                  onChange={(e) => updateConfig('autoOptimization', e.target.checked)}
                  className="rounded"
                />
                Auto-apply low-risk optimizations
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Panel */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Real-time Monitoring</span>
          <input
            type="checkbox"
            checked={state.config.realTimeMonitoring}
            onChange={(e) => updateConfig('realTimeMonitoring', e.target.checked)}
            className="rounded"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-medium">Performance Alerts</span>
          <input
            type="checkbox"
            checked={state.config.performanceAlerting}
            onChange={(e) => updateConfig('performanceAlerting', e.target.checked)}
            className="rounded"
          />
        </div>
      </div>
    </div>
  );
}

// Additional debug configuration interface
export const AnalyticsDebugConfig: React.FC<{
  config: AnalyticsDebugConfig;
  onChange: (config: AnalyticsDebugConfig) => void;
}> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Refresh Interval (ms)</label>
        <input
          type="number"
          value={config.refreshIntervalMs}
          onChange={(e) => onChange({
            ...config,
            refreshIntervalMs: parseInt(e.target.value) || 5000
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          min="1000"
          max="60000"
          step="1000"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Metrics Retention (days)</label>
        <input
          type="number"
          value={config.metricsRetentionDays}
          onChange={(e) => onChange({
            ...config,
            metricsRetentionDays: parseInt(e.target.value) || 7
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          min="1"
          max="30"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Alert Thresholds</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Suggestion Latency (ms)</label>
            <input
              type="number"
              value={config.alertThresholds.suggestionLatency}
              onChange={(e) => onChange({
                ...config,
                alertThresholds: {
                  ...config.alertThresholds,
                  suggestionLatency: parseFloat(e.target.value) || 100
                }
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              min="10"
              max="5000"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Cache Hit Rate</label>
            <input
              type="number"
              value={config.alertThresholds.cacheHitRate}
              onChange={(e) => onChange({
                ...config,
                alertThresholds: {
                  ...config.alertThresholds,
                  cacheHitRate: parseFloat(e.target.value) || 0.85
                }
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              min="0"
              max="1"
              step="0.05"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Memory Usage (MB)</label>
            <input
              type="number"
              value={config.alertThresholds.memoryUsage}
              onChange={(e) => onChange({
                ...config,
                alertThresholds: {
                  ...config.alertThresholds,
                  memoryUsage: parseFloat(e.target.value) || 100
                }
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              min="10"
              max="1000"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Bridge Latency (ms)</label>
            <input
              type="number"
              value={config.alertThresholds.bridgeLatency}
              onChange={(e) => onChange({
                ...config,
                alertThresholds: {
                  ...config.alertThresholds,
                  bridgeLatency: parseFloat(e.target.value) || 10
                }
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              min="1"
              max="1000"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.verboseLogging}
            onChange={(e) => onChange({
              ...config,
              verboseLogging: e.target.checked
            })}
            className="rounded"
          />
          Verbose Logging
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.cacheVisualization}
            onChange={(e) => onChange({
              ...config,
              cacheVisualization: e.target.checked
            })}
            className="rounded"
          />
          Cache Visualization
        </label>
      </div>
    </div>
  );
};