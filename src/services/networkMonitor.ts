/**
 * Network Monitor - Stub Implementation
 */

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  bandwidth: number;
}

export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'offline' | 'high' | 'medium' | 'low';
export type NetworkQuality = ConnectionQuality;

export interface NetworkChangeEvent {
  type: 'online' | 'offline' | 'quality-change';
  quality?: ConnectionQuality;
  timestamp: Date;
}

export type QualityConfigMap = Record<string, {
  bandwidth: number;
  latency: number;
  reliability: number;
}>;

export class NetworkMonitor {
  getStatus(): NetworkStatus {
    return {
      isOnline: navigator.onLine,
      connectionType: 'unknown',
      bandwidth: 0
    };
  }

  getQuality(): ConnectionQuality {
    return navigator.onLine ? 'good' : 'offline';
  }

  addEventListener(event: string, callback: EventListenerOrEventListenerObject): void {
    window.addEventListener(event, callback);
  }

  removeEventListener(event: string, callback: EventListenerOrEventListenerObject): void {
    window.removeEventListener(event, callback);
  }

  onStatusChange(callback: (status: NetworkStatus) => void): () => void {
    const handler = () => callback(this.getStatus());
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }
}

export const networkMonitor = new NetworkMonitor();

// Alternative export name for compatibility
export const getNetworkMonitor = () => networkMonitor;
