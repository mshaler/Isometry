/**
 * Performance Metrics Tab
 *
 * Detailed performance metrics and trends visualization
 */

import type { RenderingMetrics } from '../../../utils/performance/rendering-performance';

interface MetricsTabProps {
  currentMetrics: RenderingMetrics;
  renderingOptimization: {
    lodLevel: number;
    shouldBatch: boolean;
    memoryStrategy: string;
    memoryPressure: number;
  };
  memoryMetrics?: {
    usedJSHeapSize: number;
    leakDetected: boolean;
  };
  metricHistory: {
    frameRate: number[];
    renderTime: number[];
    memoryUsage: number[];
  };
}

export function MetricsTab({
  currentMetrics,
  renderingOptimization,
  memoryMetrics,
  metricHistory
}: MetricsTabProps) {
  return (
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
              <dd className={`text-sm font-medium ${currentMetrics.frameRate >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {currentMetrics.frameRate >= 60 ? 'Met' : 'Not Met'}
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
  );
}