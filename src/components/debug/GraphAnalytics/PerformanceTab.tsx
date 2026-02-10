/**
 * Performance Tab Component - Shows performance metrics and alerts
 */

// PerformanceTab component - no React import needed with new JSX transform
import type { TabComponentProps } from './types';

interface PerformanceTabProps extends TabComponentProps {
  chartData: Record<string, {
    label: string;
    values: number[];
    color: string;
  }>;
  clearAlerts: () => void;
}

export function PerformanceTab({
  graphMetrics,
  state,
  chartData,
  clearAlerts
}: PerformanceTabProps) {
  return (
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
  );
}