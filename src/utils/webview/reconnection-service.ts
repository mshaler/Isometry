/**
 * Reconnection Service
 *
 * Handles automatic reconnection logic with exponential backoff
 */

import { bridgeLogger } from '@/utils/logging/dev-logger';
import type { ReconnectionConfig } from './connection-types';

export class ReconnectionService {
  private config: ReconnectionConfig;
  private attemptCount = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private isReconnecting = false;

  constructor(config: ReconnectionConfig) {
    this.config = config;
  }

  async attemptReconnection(connectionCallback: () => Promise<void>): Promise<boolean> {
    if (!this.config.enabled || this.isReconnecting) {
      return false;
    }

    if (this.attemptCount >= this.config.maxAttempts) {
      bridgeLogger.warn('Max reconnection attempts reached');
      return false;
    }

    this.isReconnecting = true;
    this.attemptCount++;

    const delay = this.calculateDelay();
    bridgeLogger.info(`Reconnection attempt ${this.attemptCount}/${this.config.maxAttempts} in ${delay}ms`);

    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(async () => {
        try {
          await connectionCallback();
          this.reset();
          resolve(true);
        } catch (error) {
          bridgeLogger.error(`Reconnection attempt ${this.attemptCount} failed`, { error: error instanceof Error ? error.message : String(error) });
          this.isReconnecting = false;
          // Try again if we haven't reached max attempts
          if (this.attemptCount < this.config.maxAttempts) {
            resolve(await this.attemptReconnection(connectionCallback));
          } else {
            resolve(false);
          }
        }
      }, delay);
    });
  }

  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.isReconnecting = false;
    bridgeLogger.info('Reconnection cancelled');
  }

  reset(): void {
    this.attemptCount = 0;
    this.isReconnecting = false;
    this.cancel();
    bridgeLogger.info('Reconnection service reset');
  }

  private calculateDelay(): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffFactor, this.attemptCount - 1);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterRange * (Math.random() - 0.5);
    
    return Math.max(0, cappedDelay + jitter);
  }

  getAttemptCount(): number {
    return this.attemptCount;
  }

  isAttempting(): boolean {
    return this.isReconnecting;
  }
}
