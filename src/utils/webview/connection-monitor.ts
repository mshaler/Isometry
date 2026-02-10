/**
 * Connection Monitoring Service
 *
 * Handles heartbeat monitoring and quality assessment
 */

import { bridgeLogger } from '@/utils/logging/dev-logger';
import type {
  ConnectionState,
  ConnectionQuality,
  ConnectionConfig
} from './connection-types';

export class ConnectionMonitor {
  private heartbeatTimer?: NodeJS.Timeout;
  private qualityMetrics: ConnectionQuality;
  private config: ConnectionConfig;
  private isMonitoring = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.qualityMetrics = {
      latency: 0,
      packetLoss: 0,
      stability: 100,
      throughput: 0,
      reliability: 100
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startHeartbeat();
    bridgeLogger.info('Connection monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    this.stopHeartbeat();
    bridgeLogger.info('Connection monitoring stopped');
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const startTime = performance.now();
      // In v4, this would use sql.js directly instead of bridge
      // await webViewBridge.send('heartbeat', { timestamp: Date.now() });
      const endTime = performance.now();
      
      const latency = endTime - startTime;
      this.updateLatency(latency);
      
    } catch (error) {
      bridgeLogger.error('Heartbeat failed:', error);
      this.updateConnectionFailure();
    }
  }

  private updateLatency(latency: number): void {
    // Exponential moving average
    const alpha = 0.3;
    this.qualityMetrics.latency = alpha * latency + (1 - alpha) * this.qualityMetrics.latency;
  }

  private updateConnectionFailure(): void {
    this.qualityMetrics.reliability = Math.max(0, this.qualityMetrics.reliability - 5);
    this.qualityMetrics.stability = Math.max(0, this.qualityMetrics.stability - 10);
  }

  getQuality(): ConnectionQuality {
    return { ...this.qualityMetrics };
  }

  updateQuality(updates: Partial<ConnectionQuality>): void {
    this.qualityMetrics = { ...this.qualityMetrics, ...updates };
  }

  assessConnectionState(): ConnectionState {
    const { latency, packetLoss, stability, reliability } = this.qualityMetrics;
    const thresholds = this.config.qualityThresholds;

    if (reliability < 50 || stability < 30) {
      return 'error';
    }
    
    if (latency > thresholds.latency.poor || 
        packetLoss > thresholds.packetLoss.poor || 
        stability < thresholds.stability.poor) {
      return 'degraded';
    }
    
    return 'connected';
  }
}
