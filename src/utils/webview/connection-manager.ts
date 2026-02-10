/**
 * Connection Manager for WebView Bridge Connectivity
 *
 * Main entry point for connection management functionality
 * Split into focused service modules for better maintainability
 */

// Re-export types
export type {
  ConnectionState,
  ConnectionQuality,
  ConnectionMetrics,
  ConnectionEvent,
  ReconnectionConfig,
  ConnectionConfig,
  ConnectionManager
} from './connection-types';

// Re-export services
export { ConnectionMonitor } from './connection-monitor';
export { ReconnectionService } from './reconnection-service';

// Main connection manager implementation
import { EventEmitter } from 'events';
import { ConnectionMonitor } from './connection-monitor';
import { ReconnectionService } from './reconnection-service';
import { bridgeLogger } from '@/utils/logging/dev-logger';
import type {
  ConnectionState,
  ConnectionMetrics,
  ConnectionQuality,
  ConnectionConfig,
  ConnectionManager as IConnectionManager
} from './connection-types';

export class DefaultConnectionManager extends EventEmitter implements IConnectionManager {
  private monitor: ConnectionMonitor;
  private reconnectionService: ReconnectionService;
  private currentState: ConnectionState = 'disconnected';
  private metrics: ConnectionMetrics;

  constructor(config: ConnectionConfig) {
    super();
    this.monitor = new ConnectionMonitor(config);
    this.reconnectionService = new ReconnectionService(config.reconnection);

    this.metrics = {
      state: 'disconnected',
      quality: this.monitor.getQuality(),
      uptime: 0,
      downtime: 0,
      reconnectCount: 0,
      totalMessages: 0,
      failedMessages: 0,
      queuedMessages: 0
    };
  }

  getState(): ConnectionState {
    return this.currentState;
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getQuality(): ConnectionQuality {
    return this.monitor.getQuality();
  }

  async connect(): Promise<void> {
    this.currentState = 'connected';
    this.monitor.startMonitoring();
    this.emit('connected');
    bridgeLogger.info('Connection established');
  }

  async disconnect(): Promise<void> {
    this.currentState = 'disconnected';
    this.monitor.stopMonitoring();
    this.reconnectionService.cancel();
    this.emit('disconnected');
    bridgeLogger.info('Connection closed');
  }

  async reconnect(): Promise<void> {
    this.currentState = 'reconnecting';
    this.emit('reconnecting');

    const success = await this.reconnectionService.attemptReconnection(
      () => this.connect()
    );

    if (!success) {
      this.currentState = 'error';
      this.emit('error', new Error('Reconnection failed'));
    }
  }

  startMonitoring(): void {
    this.monitor.startMonitoring();
  }

  stopMonitoring(): void {
    this.monitor.stopMonitoring();
  }

  updateQuality(metrics: Partial<ConnectionQuality>): void {
    this.monitor.updateQuality(metrics);
    this.emit('quality_changed', this.getQuality());
  }

  getHistoricalQuality(timeRange: number): ConnectionQuality[] {
    // Mock implementation - would track historical data
    return [this.getQuality()];
  }
}

// Default configuration
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  reconnection: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitterRange: 0.1,
    enabled: true
  },
  qualityThresholds: {
    latency: { good: 100, poor: 1000 },
    packetLoss: { good: 1, poor: 10 },
    stability: { good: 95, poor: 70 }
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    timeout: 60000,
    monitoringPeriod: 300000
  }
};