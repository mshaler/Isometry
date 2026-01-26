/**
 * Fallback Database Context
 *
 * Pure web fallback provider that doesn't attempt any network connections.
 * Uses static fallback data for development when no backend is available.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FallbackDatabaseContextValue {
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

const FallbackDatabaseContext = createContext<FallbackDatabaseContextValue | null>(null);

interface FallbackDatabaseProviderProps {
  children: ReactNode;
}

/**
 * Fallback Database Provider
 *
 * Provides static fallback data for development when no backend is available.
 * All queries return empty arrays but don't throw errors.
 */
export function FallbackDatabaseProvider({ children }: FallbackDatabaseProviderProps) {
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  const execute = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[] => {
    console.log('[FallbackDB] Query executed with fallback data:', { sql: sql.substring(0, 50) + '...', params });

    // Return empty arrays for all queries
    // Components should use fallback data patterns from useSQLiteQuery
    return [];
  }, []);

  const save = useCallback(async (): Promise<void> => {
    console.log('[FallbackDB] Save operation (no-op in fallback mode)');
  }, []);

  const reset = useCallback(async (): Promise<void> => {
    console.log('[FallbackDB] Reset operation (no-op in fallback mode)');
  }, []);

  const contextValue: FallbackDatabaseContextValue = {
    loading,
    error,
    execute,
    save,
    reset,
  };

  return (
    <FallbackDatabaseContext.Provider value={contextValue}>
      {children}
    </FallbackDatabaseContext.Provider>
  );
}

/**
 * Hook to access fallback database context
 */
export function useFallbackDatabase(): FallbackDatabaseContextValue {
  const context = useContext(FallbackDatabaseContext);

  if (!context) {
    throw new Error('useFallbackDatabase must be used within FallbackDatabaseProvider');
  }

  return context;
}