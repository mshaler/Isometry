/**
 * Data Flow Monitor Component
 *
 * Real-time performance monitoring and debugging interface for live data
 * subscriptions, bridge communication, and system health metrics.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLiveDataContext, useLiveDataGlobalState } from '../contexts/LiveDataContext';
import { useLiveDataMetrics } from '../hooks/database/useLiveData';
import type { LiveDataPerformanceMetrics } from '../hooks/database/useLiveData';

// Component configuration
interface DataFlowMonitorProps {
  /** Whether to show the monitor by default (default: false) */
  isVisible?: boolean;
  /** Position of the monitor (default: 'bottom-right') */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'floating';
  /** Compact mode with reduced information (default: false) */
  compact?: boolean;
  /** Enable real-time updates (default: true) */
  realTime?: boolean;
  /** Update interval in milliseconds (default: 1000) */
  updateIntervalMs?: number;
  /** Enable detailed logging to console (default: false) */
  enableConsoleLogging?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Allow dragging when position is 'floating' */
  draggable?: boolean;
}

// Performance status levels
type PerformanceStatus = 'excellent' | 'good' | 'warning' | 'critical' | 'disconnected';

function getPerformanceStatus(
  averageLatency: number,
  errorRate: number,
  isConnected: boolean
): PerformanceStatus {
  if (!isConnected) return 'disconnected';
  if (averageLatency < 50 && errorRate < 1) return 'excellent';
  if (averageLatency < 100 && errorRate < 3) return 'good';
  if (averageLatency < 200 && errorRate < 10) return 'warning';
  return 'critical';
}

function getStatusColor(status: PerformanceStatus): string {
  switch (status) {
    case 'excellent': return 'text-green-600 bg-green-50';
    case 'good': return 'text-green-500 bg-green-50';
    case 'warning': return 'text-yellow-600 bg-yellow-50';
    case 'critical': return 'text-red-600 bg-red-50';
    case 'disconnected': return 'text-gray-500 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

function formatLatency(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDataSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Individual metric card component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: PerformanceStatus;
  icon?: string;
  compact?: boolean;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  status,
  icon,
  compact = false,
  onClick
}) => {
  const statusColorClass = status ? getStatusColor(status) : 'text-gray-600 bg-gray-50';

  return (
    <div
      className={`
        ${statusColorClass}
        ${compact ? 'p-2' : 'p-3'}
        rounded-lg border border-gray-200
        ${onClick ? 'cursor-pointer hover:bg-opacity-80' : ''}
        transition-colors
      `}
      onClick={onClick}
    >
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {icon && (
          <span className={`${compact ? 'text-sm' : 'text-lg'}`}>{icon}</span>
        )}
        <div className="flex-1">
          <div className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
            {title}
          </div>
          <div className={`${compact ? 'text-xs' : 'text-lg'} font-mono`}>
            {value}
          </div>
          {subtitle && !compact && (
            <div className="text-xs opacity-75">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Subscription detail component
interface SubscriptionDetailProps {
  metric: LiveDataPerformanceMetrics;
  compact?: boolean;
}

const SubscriptionDetail: React.FC<SubscriptionDetailProps> = ({ metric, compact = false }) => {
  const [expanded, setExpanded] = useState(false);

  const status = getPerformanceStatus(metric.averageLatency, metric.errorCount / metric.updateCount * 100, true);

  return (
    <div className="border border-gray-200 rounded-lg">
      <div
        className={`${getStatusColor(status)} p-2 cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {metric.subscriptionId.replace(/^live_\d+_/, '')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono">
              {formatLatency(metric.lastLatency)}
            </span>
            <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {expanded && !compact && (
        <div className="p-3 bg-white border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="font-medium text-gray-700">Updates</div>
              <div className="font-mono">{metric.updateCount}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Avg Latency</div>
              <div className="font-mono">{formatLatency(metric.averageLatency)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Errors</div>
              <div className="font-mono">{metric.errorCount}</div>
            </div>
            <div>
              <div className="font-medium text-gray-700">Cache Hit</div>
              <div className="font-mono">{(metric.cacheHitRate * 100).toFixed(1)}%</div>
            </div>
            <div className="col-span-2">
              <div className="font-medium text-gray-700">Data Transfer</div>
              <div className="font-mono">{formatDataSize(metric.totalDataTransferred)}</div>
            </div>
            {metric.lastError && (
              <div className="col-span-2">
                <div className="font-medium text-red-700">Last Error</div>
                <div className="text-xs text-red-600 bg-red-50 p-1 rounded">
                  {metric.lastError}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Main DataFlowMonitor component
const DataFlowMonitor: React.FC<DataFlowMonitorProps> = ({
  isVisible = false,
  position = 'bottom-right',
  compact = false,
  realTime = true,
  updateIntervalMs = 1000,
  enableConsoleLogging = false,
  className = '',
  draggable = false
}) => {
  const [visible, setVisible] = useState(isVisible);
  const [currentTab, setCurrentTab] = useState<'overview' | 'subscriptions' | 'logs'>('overview');
  const [logs, setLogs] = useState<Array<{ time: Date; level: string; message: string }>>([]);

  // Get live data context and metrics
  const { metrics } = useLiveDataContext();
  const globalState = useLiveDataGlobalState();
  const { cacheSize } = useLiveDataMetrics();

  // Performance calculations
  const overallStatus = getPerformanceStatus(
    globalState.averageLatency,
    globalState.errorRate,
    globalState.isConnected
  );

  // Console logging
  const addLog = useCallback((level: string, message: string) => {
    const logEntry = { time: new Date(), level, message };

    if (enableConsoleLogging) {
      console.log(`[DataFlowMonitor] ${level.toUpperCase()}: ${message}`);
    }

    setLogs(prev => {
      const newLogs = [...prev, logEntry];
      return newLogs.slice(-100); // Keep last 100 logs
    });
  }, [enableConsoleLogging]);

  // Monitor state changes
  useEffect(() => {
    addLog('info', `Connection: ${globalState.isConnected ? 'Connected' : 'Disconnected'}`);
  }, [globalState.isConnected, addLog]);

  useEffect(() => {
    addLog('info', `Quality: ${globalState.connectionQuality}`);
  }, [globalState.connectionQuality, addLog]);

  // Real-time updates
  useEffect(() => {
    if (!realTime) return;

    const intervalId = setInterval(() => {
      // Force re-render by updating state
      setLogs(prev => [...prev]);
    }, updateIntervalMs);

    return () => clearInterval(intervalId);
  }, [realTime, updateIntervalMs]);

  // Position styling
  const getPositionStyle = () => {
    if (position === 'floating') {
      return 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
    }

    const positions = {
      'bottom-right': 'fixed bottom-4 right-4',
      'bottom-left': 'fixed bottom-4 left-4',
      'top-right': 'fixed top-4 right-4',
      'top-left': 'fixed top-4 left-4'
    };

    return positions[position] || positions['bottom-right'];
  };

  // Render toggle button when hidden
  if (!visible) {
    return (
      <button
        className={`${getPositionStyle()} z-50 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors`}
        onClick={() => setVisible(true)}
        title="Open Data Flow Monitor"
      >
        📊
      </button>
    );
  }

  return (
    <div
      className={`
        ${getPositionStyle()}
        ${draggable ? 'cursor-move' : ''}
        z-50 bg-white shadow-xl rounded-lg border border-gray-200
        ${compact ? 'w-64' : 'w-80'}
        max-h-96 overflow-hidden
        ${className}
      `}
      style={{ resize: position === 'floating' ? 'both' : undefined }}
    >
      {/* Header */}
      <div className={`bg-gray-50 border-b border-gray-200 ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <span className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
              Data Flow Monitor
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!compact && (
              <div className={`w-2 h-2 rounded-full ${
                globalState.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
            )}
            <button
              className="p-1 hover:bg-gray-200 rounded"
              onClick={() => setVisible(false)}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!compact && (
          <div className="flex gap-1 mt-2">
            {(['overview', 'subscriptions', 'logs'] as const).map(tab => (
              <button
                key={tab}
                className={`px-2 py-1 text-xs rounded ${
                  currentTab === tab
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setCurrentTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${compact ? 'p-2' : 'p-3'} overflow-y-auto max-h-72`}>
        {/* Overview Tab */}
        {(compact || currentTab === 'overview') && (
          <div className="space-y-2">
            <div className={`grid ${compact ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-2'}`}>
              <MetricCard
                title="Status"
                value={overallStatus.toUpperCase()}
                status={overallStatus}
                icon="🔗"
                compact={compact}
              />
              {!compact && (
                <MetricCard
                  title="Quality"
                  value={globalState.connectionQuality.toUpperCase()}
                  subtitle="Connection"
                  compact={compact}
                />
              )}
              <MetricCard
                title="Latency"
                value={formatLatency(globalState.averageLatency)}
                subtitle="Average"
                icon="⚡"
                compact={compact}
              />
              {!compact && (
                <MetricCard
                  title="Error Rate"
                  value={`${globalState.errorRate.toFixed(1)}%`}
                  subtitle="Failures"
                  icon="⚠️"
                  compact={compact}
                />
              )}
              <MetricCard
                title="Active"
                value={globalState.totalSubscriptions}
                subtitle="Subscriptions"
                icon="📡"
                compact={compact}
              />
              {!compact && (
                <MetricCard
                  title="Cache"
                  value={cacheSize}
                  subtitle="Items"
                  icon="💾"
                  compact={compact}
                />
              )}
            </div>

            {/* Quick Actions */}
            {!compact && (
              <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                <button
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  onClick={() => globalState.refreshAll()}
                >
                  Refresh All
                </button>
                <button
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  onClick={() => globalState.clearCache()}
                >
                  Clear Cache
                </button>
              </div>
            )}
          </div>
        )}

        {/* Subscriptions Tab */}
        {!compact && currentTab === 'subscriptions' && (
          <div className="space-y-2">
            {metrics.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No active subscriptions
              </div>
            ) : (
              metrics.map(metric => (
                <SubscriptionDetail
                  key={metric.subscriptionId}
                  metric={metric}
                  compact={compact}
                />
              ))
            )}
          </div>
        )}

        {/* Logs Tab */}
        {!compact && currentTab === 'logs' && (
          <div className="space-y-1">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No logs available
              </div>
            ) : (
              <div className="space-y-1">
                {logs.slice(-10).map((log, index) => (
                  <div key={index} className="text-xs">
                    <span className="text-gray-500">
                      {log.time.toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 px-1 rounded text-white ${
                      log.level === 'error' ? 'bg-red-500' :
                      log.level === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="ml-2">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last sync indicator */}
      {globalState.lastSyncTime && !compact && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Last sync: {globalState.lastSyncTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

/**
 * Quick status indicator component for minimal footprint
 */
export const DataFlowStatusIndicator: React.FC<{
  showLatency?: boolean;
  className?: string;
}> = ({ showLatency = false, className = '' }) => {
  const globalState = useLiveDataGlobalState();

  const status = getPerformanceStatus(
    globalState.averageLatency,
    globalState.errorRate,
    globalState.isConnected
  );

  const getStatusIndicatorColor = (status: PerformanceStatus): string => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-green-400';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${getStatusIndicatorColor(status)}`} />
      {showLatency && (
        <span className="text-xs font-mono text-gray-600">
          {formatLatency(globalState.averageLatency)}
        </span>
      )}
    </div>
  );
};

/**
 * Hook for programmatic monitoring
 */
export function useDataFlowMonitor() {
  const globalState = useLiveDataGlobalState();

  const getHealthScore = useCallback(() => {
    if (!globalState.isConnected) return 0;

    let score = 100;

    // Penalize high latency
    if (globalState.averageLatency > 100) score -= 20;
    if (globalState.averageLatency > 500) score -= 30;

    // Penalize errors
    score -= globalState.errorRate * 2;

    return Math.max(0, score);
  }, [globalState.isConnected, globalState.averageLatency, globalState.errorRate]);

  return {
    healthScore: getHealthScore(),
    isHealthy: getHealthScore() > 70,
    connectionStatus: globalState.isConnected ? 'connected' : 'disconnected',
    latency: globalState.averageLatency,
    errorRate: globalState.errorRate
  };
}

export default DataFlowMonitor;