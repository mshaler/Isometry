import React, { createContext } from 'react';
import { NativeDatabaseProvider, useNativeDatabase, NativeDatabaseContextValue } from './NativeDatabaseContext';
import { WebViewDatabaseProvider, useWebViewDatabase } from './WebViewDatabaseContext';
import { DatabaseMode, useEnvironment } from '../contexts/EnvironmentContext';

// Legacy interface for backward compatibility during migration
interface LegacyDatabase {
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
}

interface DatabaseContextValue {
  db: LegacyDatabase | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

// Union type for unified database context (currently unused but may be needed for future type checking)
// type UnifiedDatabaseContextValue = DatabaseContextValue | NativeDatabaseContextValue;

const _DatabaseContext = createContext<DatabaseContextValue | null>(null);

// DEPRECATED: SQL.js Database Provider has been completely removed
// Use NativeDatabaseProvider or WebViewDatabaseProvider instead

/**
 * Smart Database Provider that uses EnvironmentContext for provider selection
 */
function SmartDatabaseProvider({ children }: { children: React.ReactNode }) {
  const { environment, isLoading } = useEnvironment();

  // Set up development performance reporting
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Log performance reports every 30 seconds
      const interval = setInterval(() => {
        logPerformanceReport();
      }, 30000);

      // Clean up on unmount
      return () => clearInterval(interval);
    }
  }, []);

  // Show loading state while environment is being detected
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">Detecting database environment...</p>
        </div>
      </div>
    );
  }

  switch (environment.mode) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      console.log('Using WebView Database Bridge (auto-detected)');
      return (
        <WebViewDatabaseProvider>
          {children}
        </WebViewDatabaseProvider>
      );

    case DatabaseMode.HTTP_API:
      console.log('Using Native Database API (auto-detected)');
      return (
        <NativeDatabaseProvider>
          {children}
        </NativeDatabaseProvider>
      );

    default:
      // Fallback to HTTP API - sql.js is no longer supported
      console.log('Unknown database mode - using HTTP API');
      return (
        <NativeDatabaseProvider>
          {children}
        </NativeDatabaseProvider>
      );
  }
}

/**
 * Unified Database Provider with automatic environment detection
 * Now uses EnvironmentContext for intelligent provider selection
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SmartDatabaseProvider>
      {children}
    </SmartDatabaseProvider>
  );
}

/**
 * Unified database hook that works with all database contexts
 * Uses EnvironmentContext to determine the appropriate provider
 */
export function useDatabase(): DatabaseContextValue | NativeDatabaseContextValue {
  const { environment } = useEnvironment();

  switch (environment.mode) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      return useWebViewDatabase();

    case DatabaseMode.HTTP_API:
      return useNativeDatabase();

    default:
      // Unknown mode - fallback to native API
      return useNativeDatabase();
  }
}
