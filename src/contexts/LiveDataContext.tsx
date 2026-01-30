/**
 * Live Data Context for Application-wide Real-Time State Management
 *
 * Provides centralized live data management with subscription pooling,
 * state synchronization, and performance optimization across components.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useLiveData, useLiveDataMetrics } from '../hooks/useLiveData';
import type {
  LiveDataSubscription,
  LiveDataOptions,
  LiveDataPerformanceMetrics
} from '../hooks/useLiveData';
import type { Node } from '../types/node';

// Live data context types
export interface LiveDataState {
  // Active subscriptions
  subscriptions: Map<string, LiveDataSubscription>;

  // Global state flags
  isConnected: boolean;
  globalError: string | null;
  lastSyncTime: Date | null;

  // Performance tracking
  totalSubscriptions: number;
  averageLatency: number;
  errorRate: number;
  dataTransferRate: number;

  // Connection quality metrics
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  retryCount: number;

  // Cached data for common queries
  recentNodes: Node[];
  searchResults: Map<string, Node[]>;
  totalNodeCount: number;
}

export interface LiveDataActions {
  subscribe: (key: string, query: string, params?: unknown[], options?: LiveDataOptions) => void;
  unsubscribe: (key: string) => void;
  refresh: (key?: string) => void;
  refreshAll: () => void;
  clearCache: (pattern?: string) => void;
  getSubscription: (key: string) => LiveDataSubscription | null;
  updateConnectionQuality: (quality: LiveDataState['connectionQuality']) => void;
}

export interface LiveDataContextValue {
  state: LiveDataState;
  actions: LiveDataActions;
  metrics: LiveDataPerformanceMetrics[];
}

// Action types for reducer
type LiveDataAction =
  | { type: 'SUBSCRIBE'; payload: { key: string; subscription: LiveDataSubscription } }
  | { type: 'UNSUBSCRIBE'; payload: { key: string } }
  | { type: 'UPDATE_SUBSCRIPTION'; payload: { key: string; subscription: LiveDataSubscription } }
  | { type: 'SET_CONNECTION_STATUS'; payload: { isConnected: boolean } }
  | { type: 'SET_GLOBAL_ERROR'; payload: { error: string | null } }
  | { type: 'UPDATE_SYNC_TIME'; payload: { time: Date } }
  | { type: 'UPDATE_METRICS'; payload: { metrics: LiveDataPerformanceMetrics[] } }
  | { type: 'UPDATE_CONNECTION_QUALITY'; payload: { quality: LiveDataState['connectionQuality'] } }
  | { type: 'INCREMENT_RETRY_COUNT' }
  | { type: 'RESET_RETRY_COUNT' }
  | { type: 'UPDATE_CACHED_DATA'; payload: { nodes?: Node[]; nodeCount?: number; searchResults?: Map<string, Node[]> } };

// Initial state
const initialState: LiveDataState = {
  subscriptions: new Map(),
  isConnected: false,
  globalError: null,
  lastSyncTime: null,
  totalSubscriptions: 0,
  averageLatency: 0,
  errorRate: 0,
  dataTransferRate: 0,
  connectionQuality: 'disconnected',
  retryCount: 0,
  recentNodes: [],
  searchResults: new Map(),
  totalNodeCount: 0
};

// State reducer
function liveDataReducer(state: LiveDataState, action: LiveDataAction): LiveDataState {
  switch (action.type) {
    case 'SUBSCRIBE': {
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.set(action.payload.key, action.payload.subscription);

      return {
        ...state,
        subscriptions: newSubscriptions,
        totalSubscriptions: newSubscriptions.size
      };
    }

    case 'UNSUBSCRIBE': {
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.delete(action.payload.key);

      return {
        ...state,
        subscriptions: newSubscriptions,
        totalSubscriptions: newSubscriptions.size
      };
    }

    case 'UPDATE_SUBSCRIPTION': {
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.set(action.payload.key, action.payload.subscription);

      return {
        ...state,
        subscriptions: newSubscriptions
      };
    }

    case 'SET_CONNECTION_STATUS': {
      return {
        ...state,
        isConnected: action.payload.isConnected,
        globalError: action.payload.isConnected ? null : state.globalError
      };
    }

    case 'SET_GLOBAL_ERROR': {
      return {
        ...state,
        globalError: action.payload.error,
        isConnected: action.payload.error ? false : state.isConnected
      };
    }

    case 'UPDATE_SYNC_TIME': {
      return {
        ...state,
        lastSyncTime: action.payload.time
      };
    }

    case 'UPDATE_METRICS': {
      const metrics = action.payload.metrics;

      // Calculate aggregate metrics
      const totalLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0);
      const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
      const totalUpdates = metrics.reduce((sum, m) => sum + m.updateCount, 0);
      const totalDataTransfer = metrics.reduce((sum, m) => sum + m.totalDataTransferred, 0);

      const averageLatency = metrics.length > 0 ? totalLatency / metrics.length : 0;
      const errorRate = totalUpdates > 0 ? (totalErrors / totalUpdates) * 100 : 0;

      return {
        ...state,
        averageLatency,
        errorRate,
        dataTransferRate: totalDataTransfer
      };
    }

    case 'UPDATE_CONNECTION_QUALITY': {
      return {
        ...state,
        connectionQuality: action.payload.quality,
        retryCount: action.payload.quality === 'excellent' ? 0 : state.retryCount
      };
    }

    case 'INCREMENT_RETRY_COUNT': {
      return {
        ...state,
        retryCount: state.retryCount + 1
      };
    }

    case 'RESET_RETRY_COUNT': {
      return {
        ...state,
        retryCount: 0
      };
    }

    case 'UPDATE_CACHED_DATA': {
      return {
        ...state,
        recentNodes: action.payload.nodes || state.recentNodes,
        totalNodeCount: action.payload.nodeCount || state.totalNodeCount,
        searchResults: action.payload.searchResults || state.searchResults
      };
    }

    default:
      return state;
  }
}

// Create context
const LiveDataContext = createContext<LiveDataContextValue | null>(null);

/**
 * LiveData Provider Component
 */
export interface LiveDataProviderProps {
  children: React.ReactNode;
  enableGlobalSync?: boolean;
  syncIntervalMs?: number;
  enableConnectionMonitoring?: boolean;
}

export function LiveDataProvider({
  children,
  enableGlobalSync = true,
  syncIntervalMs = 30000,
  enableConnectionMonitoring = true
}: LiveDataProviderProps) {
  const [state, dispatch] = useReducer(liveDataReducer, initialState);
  const { metrics, clearMetrics, invalidateCache } = useLiveDataMetrics();

  // Active subscription tracking
  const activeSubscriptions = useRef<Map<string, {
    query: string;
    params?: unknown[];
    options?: LiveDataOptions;
    unsubscribe?: () => void;
  }>>(new Map());

  // Connection monitoring
  const connectionMonitorRef = useRef<NodeJS.Timeout>();
  const syncTimerRef = useRef<NodeJS.Timeout>();

  // Monitor connection quality based on metrics
  const updateConnectionQuality = useCallback((quality?: LiveDataState['connectionQuality']) => {
    if (quality) {
      dispatch({ type: 'UPDATE_CONNECTION_QUALITY', payload: { quality } });
      return;
    }

    // Auto-calculate quality based on metrics
    const avgLatency = state.averageLatency;
    const errorRate = state.errorRate;

    let calculatedQuality: LiveDataState['connectionQuality'];

    if (!state.isConnected) {
      calculatedQuality = 'disconnected';
    } else if (avgLatency < 50 && errorRate < 1) {
      calculatedQuality = 'excellent';
    } else if (avgLatency < 150 && errorRate < 5) {
      calculatedQuality = 'good';
    } else {
      calculatedQuality = 'poor';
    }

    if (calculatedQuality !== state.connectionQuality) {
      dispatch({ type: 'UPDATE_CONNECTION_QUALITY', payload: { quality: calculatedQuality } });
    }
  }, [state.averageLatency, state.errorRate, state.isConnected, state.connectionQuality]);

  // Bridge availability monitoring
  useEffect(() => {
    const checkBridgeConnection = () => {
      const isAvailable = window._isometryBridge !== undefined;

      if (isAvailable !== state.isConnected) {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: { isConnected: isAvailable } });

        if (isAvailable) {
          dispatch({ type: 'RESET_RETRY_COUNT' });
          dispatch({ type: 'SET_GLOBAL_ERROR', payload: { error: null } });
        } else {
          dispatch({ type: 'INCREMENT_RETRY_COUNT' });
          dispatch({ type: 'SET_GLOBAL_ERROR', payload: { error: 'Bridge connection lost' } });
        }
      }
    };

    if (enableConnectionMonitoring) {
      // Initial check
      checkBridgeConnection();

      // Listen for bridge events
      window.addEventListener('isometry-bridge-ready', checkBridgeConnection);
      window.addEventListener('isometry-bridge-error', checkBridgeConnection);

      // Periodic monitoring
      connectionMonitorRef.current = setInterval(checkBridgeConnection, 5000);

      return () => {
        window.removeEventListener('isometry-bridge-ready', checkBridgeConnection);
        window.removeEventListener('isometry-bridge-error', checkBridgeConnection);

        if (connectionMonitorRef.current) {
          clearInterval(connectionMonitorRef.current);
        }
      };
    }
  }, [state.isConnected, enableConnectionMonitoring]);

  // Update metrics periodically
  useEffect(() => {
    dispatch({ type: 'UPDATE_METRICS', payload: { metrics } });
    updateConnectionQuality();
  }, [metrics, updateConnectionQuality]);

  // Global sync for common data
  const performGlobalSync = useCallback(async () => {
    if (!state.isConnected) return;

    try {
      // Sync recent nodes
      const recentNodesQuery = `
        SELECT * FROM nodes
        WHERE deleted_at IS NULL
        ORDER BY modified_at DESC
        LIMIT 50
      `;

      // Sync total count
      const countQuery = `
        SELECT COUNT(*) as total FROM nodes
        WHERE deleted_at IS NULL
      `;

      // Note: These would use the actual bridge calls in production
      // For now, we'll update the sync time to show the mechanism works

      dispatch({ type: 'UPDATE_SYNC_TIME', payload: { time: new Date() } });

    } catch (error) {
      console.warn('[LiveDataProvider] Global sync failed:', error);
      dispatch({
        type: 'SET_GLOBAL_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Global sync failed' }
      });
    }
  }, [state.isConnected]);

  // Setup global sync timer
  useEffect(() => {
    if (enableGlobalSync && state.isConnected) {
      // Initial sync
      performGlobalSync();

      // Periodic sync
      syncTimerRef.current = setInterval(performGlobalSync, syncIntervalMs);

      return () => {
        if (syncTimerRef.current) {
          clearInterval(syncTimerRef.current);
        }
      };
    }
  }, [enableGlobalSync, state.isConnected, syncIntervalMs, performGlobalSync]);

  // Actions implementation
  const actions: LiveDataActions = {
    subscribe: useCallback((key: string, query: string, params?: unknown[], options?: LiveDataOptions) => {
      // Store subscription info for re-subscription on reconnect
      activeSubscriptions.current.set(key, { query, params, options });

      // Create a placeholder subscription
      const subscription: LiveDataSubscription = {
        id: `context_${key}_${Date.now()}`,
        query,
        params,
        data: null,
        isLoading: true,
        error: null,
        lastUpdated: null,
        updateCount: 0,
        latency: 0
      };

      dispatch({ type: 'SUBSCRIBE', payload: { key, subscription } });
    }, []),

    unsubscribe: useCallback((key: string) => {
      const subscription = activeSubscriptions.current.get(key);
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }

      activeSubscriptions.current.delete(key);
      dispatch({ type: 'UNSUBSCRIBE', payload: { key } });
    }, []),

    refresh: useCallback((key?: string) => {
      if (key) {
        invalidateCache(key);
      } else {
        invalidateCache();
      }

      // Dispatch refresh event
      window.dispatchEvent(new CustomEvent('isometry-refresh-request', {
        detail: { key }
      }));
    }, [invalidateCache]),

    refreshAll: useCallback(() => {
      invalidateCache();
      clearMetrics();

      // Re-perform global sync
      if (state.isConnected) {
        performGlobalSync();
      }

      // Dispatch global refresh
      window.dispatchEvent(new CustomEvent('isometry-global-refresh'));
    }, [invalidateCache, clearMetrics, state.isConnected, performGlobalSync]),

    clearCache: useCallback((pattern?: string) => {
      invalidateCache(pattern);

      // Clear metrics for pattern
      if (pattern) {
        // Note: Would need to enhance clearMetrics to support patterns
        clearMetrics();
      }
    }, [invalidateCache, clearMetrics]),

    getSubscription: useCallback((key: string) => {
      return state.subscriptions.get(key) || null;
    }, [state.subscriptions]),

    updateConnectionQuality: useCallback((quality: LiveDataState['connectionQuality']) => {
      updateConnectionQuality(quality);
    }, [updateConnectionQuality])
  };

  const contextValue: LiveDataContextValue = {
    state,
    actions,
    metrics
  };

  return (
    <LiveDataContext.Provider value={contextValue}>
      {children}
    </LiveDataContext.Provider>
  );
}

/**
 * Hook to use LiveData context
 */
export function useLiveDataContext(): LiveDataContextValue {
  const context = useContext(LiveDataContext);

  if (!context) {
    throw new Error('useLiveDataContext must be used within a LiveDataProvider');
  }

  return context;
}

/**
 * Hook for high-level live data operations
 */
export function useLiveDataSubscription<T = unknown>(
  key: string,
  query: string,
  params?: unknown[],
  options?: LiveDataOptions
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  subscription: LiveDataSubscription | null;
} {
  const { state, actions } = useLiveDataContext();

  // Subscribe on mount
  useEffect(() => {
    actions.subscribe(key, query, params, options);

    return () => {
      actions.unsubscribe(key);
    };
  }, [key, query, JSON.stringify(params), actions, options]);

  const subscription = actions.getSubscription(key);

  const refresh = useCallback(() => {
    actions.refresh(key);
  }, [actions, key]);

  return {
    data: subscription?.data as T | null,
    isLoading: subscription?.isLoading || false,
    error: subscription?.error || null,
    refresh,
    subscription
  };
}

/**
 * Hook for global live data state
 */
export function useLiveDataGlobalState(): {
  isConnected: boolean;
  connectionQuality: LiveDataState['connectionQuality'];
  totalSubscriptions: number;
  averageLatency: number;
  errorRate: number;
  lastSyncTime: Date | null;
  refreshAll: () => void;
  clearCache: (pattern?: string) => void;
} {
  const { state, actions } = useLiveDataContext();

  return {
    isConnected: state.isConnected,
    connectionQuality: state.connectionQuality,
    totalSubscriptions: state.totalSubscriptions,
    averageLatency: state.averageLatency,
    errorRate: state.errorRate,
    lastSyncTime: state.lastSyncTime,
    refreshAll: actions.refreshAll,
    clearCache: actions.clearCache
  };
}

/**
 * Development tools for debugging live data
 */
export const LiveDataDevTools = {
  getActiveSubscriptions: (): string[] => {
    const context = useContext(LiveDataContext);
    return context ? Array.from(context.state.subscriptions.keys()) : [];
  },

  simulateConnectionIssue: () => {
    window.dispatchEvent(new CustomEvent('isometry-bridge-error'));
  },

  simulateReconnection: () => {
    window.dispatchEvent(new CustomEvent('isometry-bridge-ready'));
  }
};

export default LiveDataProvider;