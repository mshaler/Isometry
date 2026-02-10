/**
 * Performance Overview Tab
 *
 * Main dashboard view showing key metrics, quick actions, and recent alerts
 */

import type { MetricTrend, PerformancePreset } from '../types';
import type { PerformanceAlert } from '../../../utils/performance/rendering-performance';
import type { OptimizationPlan } from '@/hooks';

interface OverviewTabProps {
  metricTrends: {
    frameRate: MetricTrend;
    renderTime: MetricTrend;
    memoryUsage: MetricTrend;
  };
  customConfig: PerformancePreset;
  alerts: PerformanceAlert[];
  isOptimizing: boolean;
  isTestingEnabled: boolean;
  onOptimizeDataset: () => void;
  onRunPerformanceTest: () => void;
  onExportReport: () => void;
  renderMetricCard: (name: string, value: number, unit: string, trend: MetricTrend, target?: number) => JSX.Element;
  renderAlertBadge: (alert: PerformanceAlert) => JSX.Element;
}

export function OverviewTab({
  metricTrends,
  customConfig,
  alerts,
  isOptimizing,
  isTestingEnabled,
  onOptimizeDataset,
  onRunPerformanceTest,
  onExportReport,
  renderMetricCard,
  renderAlertBadge
}: OverviewTabProps) {
  return (
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
          onClick={onOptimizeDataset}
          disabled={isOptimizing}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isOptimizing ? 'Optimizing...' : 'Optimize Now'}
        </button>
        <button
          onClick={onRunPerformanceTest}
          disabled={isTestingEnabled}
          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isTestingEnabled ? 'Testing...' : 'Run Test'}
        </button>
        <button
          onClick={onExportReport}
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
            {alerts.slice(-3).map((alert: PerformanceAlert) => renderAlertBadge(alert))}
          </div>
        </div>
      )}
    </div>
  );
}