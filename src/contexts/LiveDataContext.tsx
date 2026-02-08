/**
 * Live Data Context - Stub Implementation
 */

import { createContext, useContext, ReactNode } from 'react';
import { useLiveDataMetrics as _useLiveDataMetrics, LiveDataPerformanceMetrics } from '../hooks/database/useLiveData';

export interface LiveDataState {
  isConnected: boolean;
  lastUpdate: Date | null;
}

export interface LiveDataContextType {
  state: LiveDataState;
  subscribe: (callback: () => void) => () => void;
  unsubscribe: (callback: () => void) => void;
  metrics: LiveDataPerformanceMetrics[]; // Array of performance metrics
  executeQuery: (method: string, params?: unknown) => Promise<any>;
}

// Export the hook for compatibility
export const useLiveDataSubscription = () => {
  const context = useContext(LiveDataContext);
  if (!context) {
    throw new Error('useLiveDataSubscription must be used within LiveDataProvider');
  }
  return context;
};

const LiveDataContext = createContext<LiveDataContextType | undefined>(undefined);

export function useLiveData() {
  const context = useContext(LiveDataContext);
  if (!context) {
    throw new Error('useLiveData must be used within LiveDataProvider');
  }
  return context;
}

// Alias for compatibility
export function useLiveDataContext() {
  return useLiveData();
}

// Global state hook
export function useLiveDataGlobalState() {
  const context = useLiveData();
  return {
    isConnected: context.state.isConnected,
    lastUpdate: context.state.lastUpdate,
    subscribe: context.subscribe,
    unsubscribe: context.unsubscribe,
    // Additional stub properties for compatibility
    averageLatency: 0,
    errorRate: 0,
    connectionQuality: 'good' as const,
    totalSubscriptions: 0,
    refreshAll: () => {},
    clearCache: () => {},
    lastSyncTime: null as Date | null
  };
}

// Re-export metrics hook from database hooks
export const useLiveDataMetrics = _useLiveDataMetrics;

interface LiveDataProviderProps {
  children: ReactNode;
  enableGlobalSync?: boolean;
  syncIntervalMs?: number;
  enableConnectionMonitoring?: boolean;
}

export function LiveDataProvider({ children }: LiveDataProviderProps) {
  const value: LiveDataContextType = {
    state: { isConnected: false, lastUpdate: null },
    subscribe: () => () => {},
    unsubscribe: () => {},
    metrics: [], // Empty array for compatibility
    executeQuery: async () => ({ success: false, data: [], error: 'Stub implementation' })
  };

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
}
