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
import { ConnectionManager, ConnectionState, ConnectionQuality, getConnectionManager } from '../utils/connection-manager';
import { useLiveDataContext } from '../contexts/LiveDataContext';

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
    data: any;
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

  // Connection manager instance
  const connectionManager = useRef<ConnectionManager | null>(null);
  const metricsUpdateTimer = useRef<NodeJS.Timeout | null>(null);

  // Live data context integration
  const liveDataContext = useLiveDataContext();

  // Initialize connection manager
  useEffect(() => {
    connectionManager.current = getConnectionManager(managerOptions);

    // Set up state change listener
    connectionManager.current.onStateChange((newState: ConnectionState, metrics: any) => {
      setStatus(newState);
      setIsConnected(newState === 'connected' || newState === 'degraded' || newState === 'syncing');
      setUptime(metrics.uptime);
      setLastHeartbeat(metrics.lastHeartbeat);
      setReconnectionAttempts(metrics.reconnectionAttempts);

      // Coordinate with LiveDataContext
      if (newState === 'connected' && !liveDataContext.state.isConnected) {
        // LiveData context manages its own connections through executeQuery
        console.log('Connection established, LiveData context available');
      }
    });

    // Set up quality change listener
    connectionManager.current.onQualityChange((newQuality: ConnectionQuality) => {
      setQuality(newQuality);
    });

    // Start monitoring if requested
    if (autoStart) {
      connectionManager.current.start();
    }

    return () => {
      if (connectionManager.current) {
        connectionManager.current.stop();
        connectionManager.current.removeAllListeners();
      }
    };
  }, [autoStart, managerOptions, liveDataContext]);

  // Set up metrics update timer
  useEffect(() => {
    if (connectionManager.current) {
      metricsUpdateTimer.current = setInterval(() => {
        if (connectionManager.current) {
          const queueStatus = connectionManager.current.getQueueStatus();
          setPendingOperations(queueStatus.count);
        }
      }, 1000); // Update every second

      return () => {
        if (metricsUpdateTimer.current) {
          clearInterval(metricsUpdateTimer.current);
        }
      };
    }
  }, []);

  // Test connection manually
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connectionManager.current) {
      console.warn('[ConnectionContext] Connection manager not initialized');
      return false;
    }

    try {
      const result = await connectionManager.current.testConnection();

      // Update live data context if connection test succeeded
      if (result && !liveDataContext.state.isConnected) {
        // LiveData context will handle its own connection state
        console.log('Test connection successful, LiveData context ready');
      }

      return result;
    } catch (error) {
      console.error('[ConnectionContext] Connection test failed:', error);
      return false;
    }
  }, [liveDataContext]);

  // Force reconnection
  const forceReconnection = useCallback(async (): Promise<boolean> => {
    if (!connectionManager.current) {
      console.warn('[ConnectionContext] Connection manager not initialized');
      return false;
    }

    console.log('[ConnectionContext] Forcing reconnection');

    try {
      const result = await connectionManager.current.forceReconnection();

      // Sync with live data context on successful reconnection
      if (result) {
        // LiveData context will handle reconnection through executeQuery
        console.log('Forced reconnection successful, LiveData context ready');
      }

      return result;
    } catch (error) {
      console.error('[ConnectionContext] Force reconnection failed:', error);
      return false;
    }
  }, [liveDataContext]);

  // Queue operation for offline execution
  const queueOperation = useCallback((operation: {
    type: string;
    data: any;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    maxRetries?: number;
  }): string => {
    if (!connectionManager.current) {
      throw new Error('Connection manager not initialized');
    }

    if (!enableOfflineQueue) {
      throw new Error('Offline queue is disabled');
    }

    try {
      const operationId = connectionManager.current.queueOperation({
        type: operation.type,
        data: operation.data,
        priority: operation.priority ?? 'normal',
        maxRetries: operation.maxRetries ?? 3
      });

      console.log('[ConnectionContext] Queued operation:', {
        id: operationId,
        type: operation.type,
        priority: operation.priority
      });

      return operationId;
    } catch (error) {
      console.error('[ConnectionContext] Failed to queue operation:', error);
      throw error;
    }
  }, [enableOfflineQueue]);

  // Cancel queued operation
  const cancelOperation = useCallback((operationId: string): boolean => {
    if (!connectionManager.current) {
      console.warn('[ConnectionContext] Connection manager not initialized');
      return false;
    }

    const success = connectionManager.current.removeFromQueue(operationId);

    if (success) {
      console.log('[ConnectionContext] Cancelled operation:', operationId);
    } else {
      console.warn('[ConnectionContext] Failed to cancel operation:', operationId);
    }

    return success;
  }, []);

  // Get queue status
  const getQueueStatus = useCallback(() => {
    if (!connectionManager.current) {
      return {
        count: 0,
        byPriority: { low: 0, normal: 0, high: 0, critical: 0 },
        oldestTimestamp: null
      };
    }

    return connectionManager.current.getQueueStatus();
  }, []);

  // Handle window focus events for connection retry
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && connectionManager.current) {
        console.log('[ConnectionContext] Window focused, testing connection');
        testConnection();
      }
    };

    const handleOnline = () => {
      console.log('[ConnectionContext] Network online event detected');
      if (!isConnected && connectionManager.current) {
        testConnection();
      }
    };

    const handleOffline = () => {
      console.log('[ConnectionContext] Network offline event detected');
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
    console.log('[ConnectionContext] Connection status changed:', {
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
      console.warn('[ConnectionContext] Connection quality degraded:', {
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
      console.log('[ConnectionContext] Pending operations:', pendingOperations);
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