/**
 * Performance Alerts Tab
 *
 * Performance alert management and history
 */

import type { PerformanceAlert } from '../../../utils/performance/rendering-performance';

interface AlertsTabProps {
  alerts: PerformanceAlert[];
  onClearAlerts: () => void;
}

export function AlertsTab({ alerts, onClearAlerts }: AlertsTabProps) {
  return (
    <div className="space-y-4">
      {/* Alert Controls */}
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-900">Performance Alerts</h4>
        {alerts.length > 0 && (
          <button
            onClick={onClearAlerts}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Alerts List */}
      {alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert: PerformanceAlert, index: number) => (
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
  );
}