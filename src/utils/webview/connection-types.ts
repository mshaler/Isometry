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

