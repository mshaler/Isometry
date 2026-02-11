/**
 * Connection Manager Types
 *
 * Type definitions for WebView connection management
 */

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'syncing' | 'degraded' | 'error';

export interface ConnectionQuality {
  latency: number; // Average response time in ms
  packetLoss: number; // Packet loss percentage
  stability: number; // Stability score (0-100)
  throughput: number; // Messages per second
  reliability: number; // Success rate percentage
}

export interface ConnectionMetrics {
  state: ConnectionState;
  quality: ConnectionQuality;
  uptime: number; // Connection uptime in ms
  downtime: number; // Total downtime in ms
  reconnectCount: number;
  lastReconnect?: Date;
  totalMessages: number;
  failedMessages: number;
  queuedMessages: number;
}

export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'quality_changed';
  timestamp: Date;
  data?: unknown;
  error?: Error;
}

export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffFactor: number; // Exponential backoff multiplier
  jitterRange: number; // Random jitter percentage
  enabled: boolean;
}

export interface ConnectionConfig {
  heartbeatInterval: number; // ms
  heartbeatTimeout: number; // ms
  reconnection: ReconnectionConfig;
  qualityThresholds: {
    latency: { good: number; poor: number };
    packetLoss: { good: number; poor: number };
    stability: { good: number; poor: number };
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    timeout: number;
    monitoringPeriod: number;
  };
}

export interface ConnectionManager {
  // State management
  getState(): ConnectionState;
  getMetrics(): ConnectionMetrics;
  getQuality(): ConnectionQuality;
  
  // Connection control
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  
  // Monitoring
  startMonitoring(): void;
  stopMonitoring(): void;
  
  // Event handling
  on(event: string, handler: (data: unknown) => void): unknown;
  emit(event: string, data?: unknown): unknown;
  
  // Quality management
  updateQuality(metrics: Partial<ConnectionQuality>): void;
  getHistoricalQuality(timeRange: number): ConnectionQuality[];
}
