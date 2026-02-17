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

export interface ReconnectionConfig {
  maxAttempts: number;
  baseDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  backoffFactor: number; // Exponential backoff multiplier
  jitterRange: number; // Random jitter percentage
  enabled: boolean;
}

export interface QualityThresholds {
  latency: { good: number; acceptable: number; poor: number };
  packetLoss: { good: number; acceptable: number; poor: number };
  stability: { good: number; acceptable: number; poor: number };
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export interface ConnectionConfig {
  reconnection: ReconnectionConfig;
  healthCheckInterval: number;
  connectionTimeout: number;
  messageQueueSize: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  qualityThresholds: QualityThresholds;
  circuitBreaker: CircuitBreakerConfig;
}

export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'reconnect' | 'error' | 'stateChange';
  timestamp: number;
  data?: unknown;
}

export interface ConnectionManager {
  getState(): ConnectionState;
  getMetrics(): ConnectionMetrics;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}
