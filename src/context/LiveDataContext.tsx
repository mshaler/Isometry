/**
 * LiveDataContext - Global context for live data state and management
 *
 * Provides connection status tracking, query subscription registry,
 * and performance metrics integration with Phase 18 optimization infrastructure.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { changeNotifier } from '../utils/bridge-optimization/change-notifier';
import { webViewBridge } from '../utils/webview-bridge';

export interface LiveDataContextValue {
  /** Connection status */
  isConnected: boolean;
  /** Current status message */
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  /** Active subscription count */
  activeSubscriptions: number;
  /** Performance metrics */
  metrics: {
    eventCount: number;
    errorCount: number;
    averageLatency: number;
    outOfOrderPercentage: number;
  };
  /** Subscribe to live query changes */
  subscribe: (
    sql: string,
    params: unknown[],
    onChange: (data: { sequenceNumber: number; results: unknown[]; observationId: string }) => void,
    onError: (data: { error: string; observationId: string }) => void
  ) => string;
  /** Unsubscribe from live query changes */
  unsubscribe: (subscriptionId: string) => void;
  /** Force connection test */
  testConnection: () => Promise<boolean>;
  /** Get detailed statistics */
  getStatistics: () => ReturnType<typeof changeNotifier.getStatistics>;
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

export interface LiveDataProviderProps {
  children: React.ReactNode;
  /** Connection check interval in milliseconds */
  connectionCheckInterval?: number;
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
}

export function LiveDataProvider({
  children,
  connectionCheckInterval = 30000, // 30 seconds
  enableMetrics = true
}: LiveDataProviderProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<LiveDataContextValue['status']>('disconnected');

  // Metrics state
  const [metrics, setMetrics] = useState<LiveDataContextValue['metrics']>({
    eventCount: 0,
    errorCount: 0,
    averageLatency: 0,
    outOfOrderPercentage: 0
  });

  // Refs for tracking
  const activeSubscriptionsRef = useRef(0);
  const connectionCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Test connection to WebView bridge
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('syncing');

      // Test basic WebView bridge connectivity
      const bridgeHealth = webViewBridge.getHealthStatus();

      if (!bridgeHealth.isConnected) {
        setIsConnected(false);
        setStatus('disconnected');
        return false;
      }

      // Test database connectivity with a simple ping
      await webViewBridge.database.execute('SELECT 1', []);

      setIsConnected(true);
      setStatus('connected');
      return true;

    } catch (error) {
      console.error('[LiveDataContext] Connection test failed:', error);
      setIsConnected(false);
      setStatus('error');
      return false;
    }
  }, []);

  // Subscribe to live query
  const subscribe = useCallback((
    sql: string,
    params: unknown[],
    onChange: (data: { sequenceNumber: number; results: unknown[]; observationId: string }) => void,
    onError: (data: { error: string; observationId: string }) => void
  ): string => {
    if (!isConnected) {
      console.warn('[LiveDataContext] Attempting to subscribe while disconnected');
      onError({
        error: 'Not connected to live data service',
        observationId: ''
      });
      return '';
    }

    // Wrap handlers to update metrics
    const wrappedOnChange = (data: { sequenceNumber: number; results: unknown[]; observationId: string }) => {
      activeSubscriptionsRef.current++;
      onChange(data);
    };

    const wrappedOnError = (data: { error: string; observationId: string }) => {
      onError(data);
    };

    const subscriptionId = changeNotifier.subscribe(sql, params, wrappedOnChange, wrappedOnError);

    console.log('[LiveDataContext] Created subscription:', {
      id: subscriptionId,
      sql: sql.slice(0, 50),
      isConnected
    });

    return subscriptionId;
  }, [isConnected]);

  // Unsubscribe from live query
  const unsubscribe = useCallback((subscriptionId: string) => {
    changeNotifier.unsubscribe(subscriptionId);
    activeSubscriptionsRef.current = Math.max(0, activeSubscriptionsRef.current - 1);
  }, []);

  // Get detailed statistics
  const getStatistics = useCallback(() => {
    return changeNotifier.getStatistics();
  }, []);

  // Update metrics from changeNotifier
  const updateMetrics = useCallback(() => {
    if (!enableMetrics) return;

    const stats = changeNotifier.getStatistics();
    setMetrics({
      eventCount: stats.events.total,
      errorCount: stats.events.errors,
      averageLatency: 0, // Would be calculated from performance monitoring
      outOfOrderPercentage: stats.sequence.outOfOrderPercentage
    });
  }, [enableMetrics]);

  // Initial connection test on mount
  useEffect(() => {
    testConnection();
  }, [testConnection]);

  // Set up periodic connection checking
  useEffect(() => {
    if (connectionCheckInterval > 0) {
      connectionCheckTimerRef.current = setInterval(() => {
        // Only test if we think we're connected but want to verify
        if (isConnected) {
          testConnection();
        }
      }, connectionCheckInterval);
    }

    return () => {
      if (connectionCheckTimerRef.current) {
        clearInterval(connectionCheckTimerRef.current);
      }
    };
  }, [connectionCheckInterval, isConnected, testConnection]);

  // Set up metrics collection
  useEffect(() => {
    if (enableMetrics) {
      metricsUpdateTimerRef.current = setInterval(() => {
        updateMetrics();
      }, 5000); // Update every 5 seconds

      return () => {
        if (metricsUpdateTimerRef.current) {
          clearInterval(metricsUpdateTimerRef.current);
        }
      };
    }
  }, [enableMetrics, updateMetrics]);

  // Handle window focus events for connection retry
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected) {
        console.log('[LiveDataContext] Window focused, retrying connection');
        testConnection();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isConnected, testConnection]);

  // Log connection status changes
  useEffect(() => {
    console.log('[LiveDataContext] Connection status changed:', {
      isConnected,
      status,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, status]);

  const contextValue: LiveDataContextValue = {
    isConnected,
    status,
    activeSubscriptions: activeSubscriptionsRef.current,
    metrics,
    subscribe,
    unsubscribe,
    testConnection,
    getStatistics
  };

  return (
    <LiveDataContext.Provider value={contextValue}>
      {children}
    </LiveDataContext.Provider>
  );
}

/**
 * Hook to access live data context
 */
export function useLiveDataContext(): LiveDataContextValue {
  const context = useContext(LiveDataContext);

  if (!context) {
    throw new Error('useLiveDataContext must be used within a LiveDataProvider');
  }

  return context;
}

/**
 * Hook for simple connection status checking
 */
export function useLiveDataConnection(): {
  isConnected: boolean;
  status: LiveDataContextValue['status'];
  testConnection: () => Promise<boolean>;
} {
  const { isConnected, status, testConnection } = useLiveDataContext();

  return { isConnected, status, testConnection };
}

/**
 * Hook for live data metrics (useful for debugging/monitoring components)
 */
export function useLiveDataMetrics(): {
  metrics: LiveDataContextValue['metrics'];
  getStatistics: () => ReturnType<typeof changeNotifier.getStatistics>;
} {
  const { metrics, getStatistics } = useLiveDataContext();

  return { metrics, getStatistics };
}