/**
 * Global type definitions for browser bridge and cross-system communication
 * Provides type safety for WebView bridge, sync events, and environment detection
 */

// Environment detection (will be defined at runtime)
export interface EnvironmentType {
  readonly current: 'browser' | 'native' | 'development';
  readonly isNative: boolean;
  readonly isBrowser: boolean;
  readonly isDevelopment: boolean;
}

// Sync event interface for cache invalidation and real-time updates
export interface SyncEvent extends CustomEvent {
  detail: {
    type: 'isometry-sync-update' | 'isometry-sync-state';
    payload: {
      action: 'invalidate' | 'refresh' | 'update';
      tags?: string[];
      nodeId?: string;
      cardId?: string;
      data?: unknown;
    };
    timestamp: number;
  };
}

// WebView bridge message interfaces
export interface BridgeMessage {
  id: string;
  method: string;
  params?: Record<string, unknown>;
  timestamp: number;
}

export interface BridgeResponse<T = unknown> {
  id: string;
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

// Performance monitoring interfaces
export interface BridgePerformanceResults {
  latency: number;
  throughput: number;
  reliability: number;
  stress: number; // Added missing stress property
  errorRate: number;
  memoryUsage?: number;
}

export interface PerformanceMetrics {
  bridge: BridgePerformanceResults;
  rendering: {
    fps: number;
    frameTime: number;
  };
  memory: {
    used: number;
    total: number;
  };
}

// Global window extensions
declare global {
  interface Window {
    // Sync event handling
    addEventListener(
      type: 'isometry-sync-update' | 'isometry-sync-state',
      listener: (event: SyncEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void;

    // Native bridge communication
    webkit?: {
      messageHandlers?: {
        isometry?: {
          postMessage(message: BridgeMessage): void;
        };
      };
    };

    // Performance monitoring
    isometryPerformance?: {
      startMeasurement(name: string): void;
      endMeasurement(name: string): number;
      getMetrics(): PerformanceMetrics;
    };
  }

  // Environment global
  const Environment: EnvironmentType;
}

// Type guards for runtime type checking
export function isSyncEvent(event: Event): event is SyncEvent {
  return 'detail' in event &&
         typeof event.detail === 'object' &&
         event.detail !== null &&
         'type' in event.detail &&
         'payload' in event.detail &&
         'timestamp' in event.detail;
}

export function isBridgeResponse<T>(obj: unknown): obj is BridgeResponse<T> {
  return typeof obj === 'object' &&
         obj !== null &&
         'id' in obj &&
         'timestamp' in obj &&
         (('result' in obj) || ('error' in obj));
}

export function assertBridgeResponse<T>(obj: unknown): BridgeResponse<T> {
  if (!isBridgeResponse<T>(obj)) {
    throw new Error('Invalid bridge response format');
  }
  return obj;
}

// Environment detection utilities
export function isNativeEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         typeof window.webkit?.messageHandlers?.isometry !== 'undefined';
}

export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         !isNativeEnvironment();
}

export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' ||
         process.env.NODE_ENV === 'test';
}