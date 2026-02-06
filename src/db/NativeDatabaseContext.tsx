/**
 * DEPRECATED: NativeDatabaseContext (Bridge Elimination v4)
 *
 * See WebViewDatabaseContext.tsx for migration guidance.
 * Both native and webview contexts replaced by SQLiteProvider.
 */

import React from 'react';
import { SQLiteProvider } from './SQLiteProvider';

export function NativeDatabaseContext({ children }: { children: React.ReactNode }) {
  console.warn(
    'NativeDatabaseContext is deprecated. Use SQLiteProvider directly. ' +
    'Bridge elimination means no distinction between native/webview contexts.'
  );
  return <SQLiteProvider>{children}</SQLiteProvider>;
}

export const useNativeDatabase = () => {
  throw new Error(
    'useNativeDatabase is deprecated. Use useSQLite() from SQLiteProvider instead.'
  );
};

// Legacy interfaces for backward compatibility during migration
export interface NativeDatabaseContextValue {
  db: unknown | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

export interface NativeDatabaseProviderProps {
  children: React.ReactNode;
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * @deprecated Use SQLiteProvider directly
 */
export function NativeDatabaseProvider({ children }: NativeDatabaseProviderProps) {
  console.warn(
    'NativeDatabaseProvider is deprecated. Use SQLiteProvider directly for bridge-free database access.'
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
export function NativeDatabaseStatus() {
  return (
    <div className="text-sm text-yellow-500">
      NativeDatabaseStatus is deprecated. Bridge eliminated in v4 - use sql.js directly.
    </div>
  );
}