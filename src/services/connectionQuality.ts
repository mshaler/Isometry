/**
 * Connection Quality Monitoring Service
 *
 * Adapts sync behavior based on network conditions using connection quality
 * detection and adaptive strategies for optimal performance.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'offline' | 'slow' | 'moderate' | 'fast' | 'excellent';

/**
 * Network information interface (extending Navigator interface)
 */
interface NetworkInformation extends EventTarget {
  effectiveType?: '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

/**
 * Connection metrics interface
 */
interface ConnectionMetrics {
  quality: ConnectionQuality;
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number; // Mbps
  rtt?: number; // milliseconds
  saveData?: boolean;
  lastCheck: number;
  pingLatency?: number;
  measurementCount: number;
}

/**
 * Sync strategy configuration based on connection quality
 */
interface SyncStrategy {
  syncInterval: number; // milliseconds
  batchSize: number;
  timeout: number; // milliseconds
  retryDelay: number; // milliseconds
  enableOptimisticUpdates: boolean;
  enableBackgroundSync: boolean;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Default sync strategies for different connection qualities
 */
const SYNC_STRATEGIES: Record<ConnectionQuality, SyncStrategy> = {
  offline: {
    syncInterval: 0, // No sync when offline
    batchSize: 0,
    timeout: 0,
    retryDelay: 30000,
    enableOptimisticUpdates: true,
    enableBackgroundSync: false,
    compressionLevel: 'none'
  },
  slow: {
    syncInterval: 60000, // 1 minute
    batchSize: 5,
    timeout: 30000,
    retryDelay: 15000,
    enableOptimisticUpdates: true,
    enableBackgroundSync: false,
    compressionLevel: 'high'
  },
  moderate: {
    syncInterval: 30000, // 30 seconds
    batchSize: 10,
    timeout: 15000,
    retryDelay: 5000,
    enableOptimisticUpdates: true,
    enableBackgroundSync: true,
    compressionLevel: 'medium'
  },
  fast: {
    syncInterval: 15000, // 15 seconds
    batchSize: 20,
    timeout: 10000,
    retryDelay: 2000,
    enableOptimisticUpdates: false,
    enableBackgroundSync: true,
    compressionLevel: 'low'
  },
  excellent: {
    syncInterval: 5000, // 5 seconds
    batchSize: 50,
    timeout: 5000,
    retryDelay: 1000,
    enableOptimisticUpdates: false,
    enableBackgroundSync: true,
    compressionLevel: 'none'
  }
};

/**
 * Connection Quality Manager
 */
export class ConnectionQualityManager {
  private metrics: ConnectionMetrics;
  private listeners = new Set<(metrics: ConnectionMetrics) => void>();
  private pingInterval: NodeJS.Timeout | null = null;
  private networkConnection?: NetworkInformation;
  private measurementHistory: ConnectionMetrics[] = [];

  constructor() {
    this.metrics = {
      quality: 'moderate',
      isOnline: navigator.onLine,
      lastCheck: Date.now(),
      measurementCount: 0
    };

    this.initializeNetworkMonitoring();
    this.startPeriodicMeasurement();
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring() {
    // Get network connection object
    this.networkConnection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineStatusChange);
    window.addEventListener('offline', this.handleOnlineStatusChange);

    // Listen for connection changes
    if (this.networkConnection) {
      this.networkConnection.addEventListener('change', this.handleConnectionChange);
    }

    // Initial measurement
    this.measureConnection();
  }

  /**
   * Handle online/offline status changes
   */
  private handleOnlineStatusChange = () => {
    this.metrics.isOnline = navigator.onLine;
    this.measureConnection();
  };

  /**
   * Handle connection property changes
   */
  private handleConnectionChange = () => {
    this.measureConnection();
  };

  /**
   * Start periodic connection measurement
   */
  private startPeriodicMeasurement() {
    // Measure every 30 seconds
    this.pingInterval = setInterval(() => {
      this.measureConnection();
    }, 30000);
  }

  /**
   * Measure connection quality
   */
  private async measureConnection() {
    const now = Date.now();
    const isOnline = navigator.onLine;

    // Update basic metrics
    this.metrics.isOnline = isOnline;
    this.metrics.lastCheck = now;
    this.metrics.measurementCount++;

    if (!isOnline) {
      this.updateQuality('offline');
      return;
    }

    try {
      // Get network information if available
      if (this.networkConnection) {
        this.metrics.effectiveType = this.networkConnection.effectiveType;
        this.metrics.downlink = this.networkConnection.downlink;
        this.metrics.rtt = this.networkConnection.rtt;
        this.metrics.saveData = this.networkConnection.saveData;
      }

      // Perform ping test
      const pingLatency = await this.performPingTest();
      this.metrics.pingLatency = pingLatency;

      // Determine quality based on measurements
      const quality = this.calculateConnectionQuality();
      this.updateQuality(quality);

    } catch (error) {
      console.warn('[ConnectionQuality] Measurement failed:', error);
      // Fallback to moderate quality on measurement failure
      this.updateQuality('moderate');
    }
  }

  /**
   * Perform ping test to measure latency
   */
  private async performPingTest(): Promise<number> {
    const startTime = performance.now();

    try {
      // Use a small image or favicon for ping test
      const response = await fetch('/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });

      const endTime = performance.now();
      return endTime - startTime;
    } catch (error) {
      // Fallback ping using image
      return new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, 10000);

        img.onload = () => {
          clearTimeout(timeout);
          const endTime = performance.now();
          resolve(endTime - startTime);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Ping failed'));
        };

        img.src = '/favicon.ico?' + Date.now();
      });
    }
  }

  /**
   * Calculate connection quality based on available metrics
   */
  private calculateConnectionQuality(): ConnectionQuality {
    const { effectiveType, downlink, rtt, pingLatency } = this.metrics;

    // Use Network Information API if available
    if (effectiveType) {
      switch (effectiveType) {
        case '4g':
          return downlink && downlink >= 10 ? 'excellent' : 'fast';
        case '3g':
          return 'moderate';
        case '2g':
          return 'slow';
      }
    }

    // Use ping latency as fallback
    if (pingLatency !== undefined) {
      if (pingLatency < 50) return 'excellent';
      if (pingLatency < 150) return 'fast';
      if (pingLatency < 300) return 'moderate';
      if (pingLatency < 1000) return 'slow';
      return 'slow';
    }

    // Use RTT if available
    if (rtt !== undefined) {
      if (rtt < 100) return 'excellent';
      if (rtt < 200) return 'fast';
      if (rtt < 400) return 'moderate';
      return 'slow';
    }

    // Use downlink speed if available
    if (downlink !== undefined) {
      if (downlink >= 10) return 'excellent';
      if (downlink >= 5) return 'fast';
      if (downlink >= 1.5) return 'moderate';
      return 'slow';
    }

    // Default to moderate if no metrics available
    return 'moderate';
  }

  /**
   * Update connection quality and notify listeners
   */
  private updateQuality(quality: ConnectionQuality) {
    const previousQuality = this.metrics.quality;
    this.metrics.quality = quality;

    // Store measurement history (keep last 20 measurements)
    this.measurementHistory.push({ ...this.metrics });
    if (this.measurementHistory.length > 20) {
      this.measurementHistory.shift();
    }

    // Notify listeners if quality changed
    if (quality !== previousQuality) {
      console.log('[ConnectionQuality] Quality changed:', {
        from: previousQuality,
        to: quality,
        metrics: {
          effectiveType: this.metrics.effectiveType,
          downlink: this.metrics.downlink,
          rtt: this.metrics.rtt,
          pingLatency: this.metrics.pingLatency
        }
      });
    }

    // Notify all listeners
    for (const listener of this.listeners) {
      try {
        listener(this.metrics);
      } catch (error) {
        console.error('[ConnectionQuality] Listener error:', error);
      }
    }
  }

  /**
   * Subscribe to connection quality changes
   */
  subscribe(listener: (metrics: ConnectionMetrics) => void): () => void {
    this.listeners.add(listener);

    // Immediately call with current metrics
    listener(this.metrics);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get measurement history
   */
  getHistory(): ConnectionMetrics[] {
    return [...this.measurementHistory];
  }

  /**
   * Get sync strategy for current connection quality
   */
  getSyncStrategy(): SyncStrategy {
    return { ...SYNC_STRATEGIES[this.metrics.quality] };
  }

  /**
   * Get sync strategy for specific quality
   */
  getSyncStrategyForQuality(quality: ConnectionQuality): SyncStrategy {
    return { ...SYNC_STRATEGIES[quality] };
  }

  /**
   * Force connection measurement
   */
  async measureNow(): Promise<void> {
    await this.measureConnection();
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    window.removeEventListener('online', this.handleOnlineStatusChange);
    window.removeEventListener('offline', this.handleOnlineStatusChange);

    if (this.networkConnection) {
      this.networkConnection.removeEventListener('change', this.handleConnectionChange);
    }

    this.listeners.clear();
  }
}

// Singleton instance
export const connectionQualityManager = new ConnectionQualityManager();

/**
 * React hook for connection quality monitoring
 */
export function useConnectionQuality() {
  const [metrics, setMetrics] = useState<ConnectionMetrics>(
    connectionQualityManager.getMetrics()
  );
  const [strategy, setStrategy] = useState<SyncStrategy>(
    connectionQualityManager.getSyncStrategy()
  );

  useEffect(() => {
    const unsubscribe = connectionQualityManager.subscribe((newMetrics) => {
      setMetrics(newMetrics);
      setStrategy(connectionQualityManager.getSyncStrategy());
    });

    return unsubscribe;
  }, []);

  const measureNow = useCallback(async () => {
    await connectionQualityManager.measureNow();
  }, []);

  const getSyncStrategyForQuality = useCallback((quality: ConnectionQuality) => {
    return connectionQualityManager.getSyncStrategyForQuality(quality);
  }, []);

  return {
    metrics,
    strategy,
    measureNow,
    getSyncStrategyForQuality,
    getHistory: () => connectionQualityManager.getHistory()
  };
}

/**
 * Helper hook for adaptive sync intervals
 */
export function useAdaptiveSyncInterval(callback: () => void | Promise<void>) {
  const { strategy } = useConnectionQuality();
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update callback ref
  callbackRef.current = callback;

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Don't set interval if offline or sync disabled
    if (strategy.syncInterval <= 0) {
      intervalRef.current = null;
      return;
    }

    // Set new interval based on current strategy
    intervalRef.current = setInterval(() => {
      const result = callbackRef.current();
      // Handle async callbacks
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          console.error('[AdaptiveSync] Callback error:', error);
        });
      }
    }, strategy.syncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [strategy.syncInterval]);
}