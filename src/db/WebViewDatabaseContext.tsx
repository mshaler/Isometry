/**
 * DEPRECATED: WebViewDatabaseContext (Bridge Elimination v4)
 *
 * This context is deprecated. Use SQLiteProvider instead.
 *
 * MIGRATION:
 * import { SQLiteProvider, useSQLite } from './SQLiteProvider';
 *
 * OLD: useWebViewDatabase()
 * NEW: useSQLite()
 *
 * Benefits:
 * - Direct sql.js access (no bridge latency)
 * - Synchronous queries (no promises)
 * - Same memory space as D3.js visualizations
 */

import React from 'react';
import { SQLiteProvider } from './SQLiteProvider';

export function WebViewDatabaseContext({ children }: { children: React.ReactNode }) {
  console.warn(
    'WebViewDatabaseContext is deprecated. Use SQLiteProvider directly. ' +
    'See Bridge Elimination documentation for migration guide.'
  );
  return <SQLiteProvider>{children}</SQLiteProvider>;
}

export const useWebViewDatabase = () => {
  throw new Error(
    'useWebViewDatabase is deprecated. Use useSQLite() from SQLiteProvider instead. ' +
    'Bridge eliminated in Isometry v4 - sql.js provides direct database access.'
  );
};

// Legacy interfaces for backward compatibility during migration
export interface WebViewDatabaseContextValue {
  db: unknown | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
  isConnected: () => boolean;
  getConnectionStatus: () => { isConnected: boolean; transport: string; };
  getBridgeHealth: () => {
    isConnected: boolean;
    pendingRequests: number;
    environment: {
      isNative: boolean;
      platform: string;
      version: string;
      transport: string;
    };
  };
}

export interface WebViewDatabaseProviderProps {
  children: React.ReactNode;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * @deprecated Use SQLiteProvider directly
 */
export function WebViewDatabaseProvider({ children }: WebViewDatabaseProviderProps) {
  console.warn(
    'WebViewDatabaseProvider is deprecated. Use SQLiteProvider directly for bridge-free database access.'
  );
  return <SQLiteProvider>{children}</SQLiteProvider>;
}

/**
 * @deprecated Use useSQLite() from SQLiteProvider instead
 */
export function useDatabaseCompat(): never {
  throw new Error(
    'useDatabaseCompat is deprecated. Use useSQLite() from SQLiteProvider instead.'
  );
}

/**
 * @deprecated Bridge eliminated - no status to display
 */
export function WebViewDatabaseStatus() {
  return (
    <div className="text-sm text-yellow-500">
      WebViewDatabaseStatus is deprecated. Bridge eliminated in v4 - use sql.js directly.
    </div>
  );
}

/**
 * @deprecated Bridge eliminated - no health to monitor
 */
export function WebViewBridgeHealthStatus() {
  return (
    <div className="text-xs text-gray-600">
      Bridge health monitoring deprecated. sql.js provides direct database access.
    </div>
  );
}