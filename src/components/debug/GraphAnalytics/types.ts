/**
 * Graph Analytics Debug Panel Types
 */

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

export interface DebugPanelState {
  isCollapsed: boolean;
  activeTab: 'performance' | 'cache' | 'suggestions' | 'bridge' | 'optimization';
  config: AnalyticsDebugConfig;
  alerts: PerformanceAlert[];
  bridgeMessages: BridgeMessage[];
  exportData: Record<string, unknown> | null;
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  type: 'warning' | 'error' | 'critical';
  category: 'latency' | 'memory' | 'cache' | 'bridge' | 'accuracy';
  message: string;
  value: number;
  threshold: number;
  suggestion?: string;
}

export interface BridgeMessage {
  id: string;
  timestamp: number;
  direction: 'request' | 'response';
  method: string;
  payload: unknown;
  latency?: number;
  error?: string;
}

export interface ChartData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface CacheBreakdown {
  namespace: string;
  hitRate: number;
  missCount: number;
  hitCount: number;
  avgResponseTime: number;
  memoryUsage: number;
  evictionCount: number;
  totalQueries: number;
  efficiency: number;
}

export interface TabComponentProps {
  graphMetrics: any;
  debugInfo: any;
  state: DebugPanelState;
  setState: (updater: (prev: DebugPanelState) => DebugPanelState) => void;
}