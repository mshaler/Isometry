/**
 * ConnectionContext - Global Connection State Management
 *
 * Provides connection status monitoring, quality tracking, and offline operation
 * management with integration to LiveDataContext for coordinated state management.
 *
 * Features adaptive behavior based on connection quality and seamless offline
 * support with queued operations for sync on reconnection.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ConnectionState, ConnectionQuality, ConnectionMetrics } from '../utils/webview/connection-manager';
import { DefaultConnectionManager, DEFAULT_CONNECTION_CONFIG } from '../utils/webview/connection-manager';
import { useLiveDataContext } from '../contexts/LiveDataContext';
import { devLogger } from "../utils/logging/dev-logger";

/** Shape of a queued offline operation */
interface QueuedOperation {
  id: string;
  type: string;
  data: unknown;
  priority: 'low' | 'normal' | 'high' | 'critical';
  maxRetries: number;
  timestamp: number;
}

export interface ConnectionContextValue {
  /** Current connection state */
  isConnected: boolean;
  /** Detailed connection status */
  status: ConnectionState;
  /** Connection quality metrics */
  quality: ConnectionQuality;
  /** Pending operations count for offline scenarios */
  pendingOperations: number;
  /** Connection uptime in milliseconds */
  uptime: number;
  /** Last successful heartbeat timestamp */
  lastHeartbeat: number;
  /** Reconnection attempts count */
  reconnectionAttempts: number;
  /** Force connection test */
  testConnection: () => Promise<boolean>;
  /** Force reconnection with backoff reset */
  forceReconnection: () => Promise<boolean>;
  /** Queue operation for offline execution */
  queueOperation: (operation: {
    type: string;
    data: unknown;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    maxRetries?: number;
  }) => string;
  /** Remove operation from queue */
  cancelOperation: (operationId: string) => boolean;
  /** Get queue status */
  getQueueStatus: () => {
    count: number;
    byPriority: Record<string, number>;
    oldestTimestamp: number | null;
  };
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export interface ConnectionProviderProps {
  children: React.ReactNode;
  /** Connection manager options */
  managerOptions?: {
    heartbeatInterval?: number;
    connectionTimeout?: number;
    maxReconnectionAttempts?: number;
    enableAdaptiveBehavior?: boolean;
  };
  /** Auto-start connection monitoring */
  autoStart?: boolean;
  /** Enable offline queue processing */
  enableOfflineQueue?: boolean;
}

/** Generate a unique operation ID */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ConnectionProvider({
  children,
  managerOptions,
  autoStart = true,
  enableOfflineQueue = true
}: ConnectionProviderProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const [quality, setQuality] = useState<ConnectionQuality>({
    latency: 0,
    packetLoss: 0,
    stability: 100,
    throughput: 0,
    reliability: 100
  });
  const [uptime, setUptime] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(0);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const [pendingOperations, setPendingOperations] = useState(0);

  // Connection manager instance (DefaultConnectionManager extends EventEmitter)
  const connectionManager = useRef<DefaultConnectionManager | null>(null);
  const metricsUpdateTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Local offline operation queue
  const operationQueue = useRef<Map<string, QueuedOperation>>(new Map());

  // Live data context integration
  const liveDataContext = useLiveDataContext();

  /** Sync local state from the connection manager's metrics */
  const syncMetrics = useCallback((mgr: DefaultConnectionManager) => {
    const metrics: ConnectionMetrics = mgr.getMetrics();
    setUptime(metrics.uptime);
    setReconnectionAttempts(metrics.reconnectCount);
    setLastHeartbeat(Date.now());
  }, []);

  /** Update connection status from a state value */
  const applyState = useCallback((newState: ConnectionState) => {
    setStatus(newState);
    setIsConnected(
      newState === 'connected' || newState === 'degraded' || newState === 'syncing'
    );
  }, []);

  // Initialize connection manager
  useEffect(() => {
    const config = {
      ...DEFAULT_CONNECTION_CONFIG,
      ...(managerOptions?.heartbeatInterval != null && {
        heartbeatInterval: managerOptions.heartbeatInterval
      }),
      ...(managerOptions?.connectionTimeout != null && {
        heartbeatTimeout: managerOptions.connectionTimeout
      }),
      reconnection: {
        ...DEFAULT_CONNECTION_CONFIG.reconnection,
        ...(managerOptions?.maxReconnectionAttempts != null && {
          maxAttempts: managerOptions.maxReconnectionAttempts
        })
      }
    };

    const mgr = new DefaultConnectionManager(config);
    connectionManager.current = mgr;

    // Listen for connection lifecycle events
    mgr.on('connected', () => {
      applyState('connected');
      syncMetrics(mgr);

      // Coordinate with LiveDataContext
      if (!liveDataContext.state.isConnected) {
        devLogger.debug('Connection established', { liveDataContextAvailable: true });
      }
    });

    mgr.on('disconnected', () => {
      applyState('disconnected');
      syncMetrics(mgr);
    });

    mgr.on('reconnecting', () => {
      applyState('reconnecting');
      syncMetrics(mgr);
    });

    mgr.on('error', () => {
      applyState('error');
      syncMetrics(mgr);
    });

    // Listen for quality changes
    mgr.on('quality_changed', (data: unknown) => {
      if (data && typeof data === 'object' && 'latency' in data) {
        setQuality(data as ConnectionQuality);
      } else {
        setQuality(mgr.getQuality());
      }
    });

    // Start monitoring if requested
    if (autoStart) {
      void mgr.connect();
      mgr.startMonitoring();
    }

    return () => {
      if (connectionManager.current) {
        void connectionManager.current.disconnect();
        connectionManager.current.stopMonitoring();
        connectionManager.current.removeAllListeners();
      }
    };
  }, [autoStart, managerOptions, liveDataContext, applyState, syncMetrics]);

  // Set up metrics update timer
  useEffect(() => {
    metricsUpdateTimer.current = setInterval(() => {
      if (connectionManager.current) {
        const metrics = connectionManager.current.getMetrics();
        setPendingOperations(
          metrics.queuedMessages + operationQueue.current.size
        );
      }
    }, 1000);

    return () => {
      if (metricsUpdateTimer.current) {
        clearInterval(metricsUpdateTimer.current);
      }
    };
  }, []);

  // Test connection manually
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connectionManager.current) {
      devLogger.warn('Connection manager not initialized', { context: 'testConnection' });
      return false;
    }

    try {
      await connectionManager.current.connect();
      const state = connectionManager.current.getState();
      const result = state === 'connected';

      // Update live data context if connection test succeeded
      if (result && !liveDataContext.state.isConnected) {
        devLogger.debug('Test connection successful', { liveDataContextReady: true });
      }

      return result;
    } catch (error) {
      devLogger.error('Connection test failed', { error });
      return false;
    }
  }, [liveDataContext]);

  // Force reconnection
  const forceReconnection = useCallback(async (): Promise<boolean> => {
    if (!connectionManager.current) {
      devLogger.warn('Connection manager not initialized', { context: 'forceReconnection' });
      return false;
    }

    devLogger.debug('Forcing reconnection');

    try {
      await connectionManager.current.reconnect();
      const state = connectionManager.current.getState();
      const result = state === 'connected';

      if (result) {
        devLogger.debug('Forced reconnection successful', { liveDataContextReady: true });
      }

      return result;
    } catch (error) {
      devLogger.error('Force reconnection failed', { error });
      return false;
    }
  }, [liveDataContext]);

  // Queue operation for offline execution (managed locally)
  const queueOperation = useCallback((operation: {
    type: string;
    data: unknown;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    maxRetries?: number;
  }): string => {
    if (!connectionManager.current) {
      throw new Error('Connection manager not initialized');
    }

    if (!enableOfflineQueue) {
      throw new Error('Offline queue is disabled');
    }

    const operationId = generateOperationId();
    const entry: QueuedOperation = {
      id: operationId,
      type: operation.type,
      data: operation.data,
      priority: operation.priority ?? 'normal',
      maxRetries: operation.maxRetries ?? 3,
      timestamp: Date.now()
    };

    operationQueue.current.set(operationId, entry);
    setPendingOperations(operationQueue.current.size);

    devLogger.debug('Queued operation', {
      id: operationId,
      type: operation.type,
      priority: entry.priority
    });

    return operationId;
  }, [enableOfflineQueue]);

  // Cancel queued operation
  const cancelOperation = useCallback((operationId: string): boolean => {
    const success = operationQueue.current.delete(operationId);

    if (success) {
      setPendingOperations(operationQueue.current.size);
      devLogger.debug('Cancelled operation', { operationId });
    } else {
      devLogger.warn('Failed to cancel operation', { operationId });
    }

    return success;
  }, []);

  // Get queue status
  const getQueueStatus = useCallback(() => {
    const queue = operationQueue.current;

    if (queue.size === 0) {
      return {
        count: 0,
        byPriority: { low: 0, normal: 0, high: 0, critical: 0 } as Record<string, number>,
        oldestTimestamp: null
      };
    }

    const byPriority: Record<string, number> = { low: 0, normal: 0, high: 0, critical: 0 };
    let oldestTimestamp: number | null = null;

    for (const op of queue.values()) {
      byPriority[op.priority] = (byPriority[op.priority] ?? 0) + 1;
      if (oldestTimestamp === null || op.timestamp < oldestTimestamp) {
        oldestTimestamp = op.timestamp;
      }
    }

    return { count: queue.size, byPriority, oldestTimestamp };
  }, []);

  // Handle window focus events for connection retry
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && connectionManager.current) {
        devLogger.debug('Window focused, testing connection');
        void testConnection();
      }
    };

    const handleOnline = () => {
      devLogger.debug('Network online event detected');
      if (!isConnected && connectionManager.current) {
        void testConnection();
      }
    };

    const handleOffline = () => {
      devLogger.debug('Network offline event detected');
      // Connection manager will detect this through heartbeat failures
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, testConnection]);

  // Log connection status changes
  useEffect(() => {
    devLogger.debug('Connection status changed', {
      isConnected,
      status,
      quality: {
        latency: Math.round(quality.latency),
        reliability: Math.round(quality.reliability),
        stability: Math.round(quality.stability)
      },
      pendingOperations,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, status, quality.latency, quality.reliability, quality.stability, pendingOperations]);

  // Log quality degradation
  useEffect(() => {
    if (quality.latency > 1000 || quality.reliability < 90 || quality.stability < 80) {
      devLogger.warn('Connection quality degraded', {
        latency: Math.round(quality.latency),
        reliability: Math.round(quality.reliability),
        stability: Math.round(quality.stability),
        packetLoss: Math.round(quality.packetLoss)
      });
    }
  }, [quality]);

  // Handle offline queue status
  useEffect(() => {
    if (pendingOperations > 0) {
      devLogger.debug('Pending operations', { count: pendingOperations });
    }
  }, [pendingOperations]);

  const contextValue: ConnectionContextValue = {
    isConnected,
    status,
    quality,
    pendingOperations,
    uptime,
    lastHeartbeat,
    reconnectionAttempts,
    testConnection,
    forceReconnection,
    queueOperation,
    cancelOperation,
    getQueueStatus
  };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
}

/**
 * Hook to access connection context
 */
export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);

  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }

  return context;
}

/**
 * Hook for simple connection status checking
 */
export function useConnectionStatus(): {
  isConnected: boolean;
  status: ConnectionState;
  testConnection: () => Promise<boolean>;
} {
  const { isConnected, status, testConnection } = useConnection();

  return { isConnected, status, testConnection };
}

/**
 * Hook for connection quality monitoring
 */
export function useConnectionQuality(): {
  quality: ConnectionQuality;
  isDegraded: boolean;
  isHealthy: boolean;
} {
  const { quality } = useConnection();

  const isDegraded = quality.latency > 500 ||
                    quality.reliability < 95 ||
                    quality.stability < 85 ||
                    quality.packetLoss > 5;

  const isHealthy = quality.latency < 200 &&
                   quality.reliability > 98 &&
                   quality.stability > 95 &&
                   quality.packetLoss < 1;

  return { quality, isDegraded, isHealthy };
}

/**
 * Hook for offline queue management
 */
export function useOfflineQueue(): {
  pendingOperations: number;
  queueStatus: ReturnType<ConnectionContextValue['getQueueStatus']>;
  queueOperation: ConnectionContextValue['queueOperation'];
  cancelOperation: ConnectionContextValue['cancelOperation'];
  hasQueuedOperations: boolean;
} {
  const { pendingOperations, queueOperation, cancelOperation, getQueueStatus } = useConnection();

  const queueStatus = getQueueStatus();
  const hasQueuedOperations = queueStatus.count > 0;

  return {
    pendingOperations,
    queueStatus,
    queueOperation,
    cancelOperation,
    hasQueuedOperations
  };
}
