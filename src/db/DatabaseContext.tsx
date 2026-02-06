import React from 'react';
// DEPRECATED: Bridge contexts eliminated in v4
// import { NativeDatabaseProvider, NativeDatabaseContextValue } from './NativeDatabaseContext';
// import { WebViewDatabaseProvider, useWebViewDatabase, WebViewDatabaseContextValue } from './WebViewDatabaseContext';
import { FallbackDatabaseProvider, useFallbackDatabase, FallbackDatabaseContextValue } from './FallbackDatabaseContext';
// DEPRECATED: EnvironmentContext no longer needed in v4
// import { DatabaseMode, useEnvironment } from '../contexts/EnvironmentContext';
import { logPerformanceReport } from './PerformanceMonitor';

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


// DEPRECATED: SQL.js Database Provider has been completely removed
// Use NativeDatabaseProvider or WebViewDatabaseProvider instead

/**
 * @deprecated Use SQLiteProvider instead
 *
 * Smart Database Provider that uses EnvironmentContext for provider selection
 * DEPRECATED in v4 Bridge Elimination - use SQLiteProvider directly
 */
function SmartDatabaseProvider({ children }: { children: React.ReactNode }) {
  console.warn(
    'SmartDatabaseProvider is DEPRECATED in Isometry v4. ' +
    'Use SQLiteProvider with sql.js for direct database access.'
  );

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

  // Always use fallback for now - bridge infrastructure eliminated
  console.log('🔄 Using Fallback Database (bridge infrastructure eliminated in v4)');
  return (
    <FallbackDatabaseProvider>
      {children}
    </FallbackDatabaseProvider>
  );
}

/**
 * @deprecated Use SQLiteProvider instead
 *
 * Unified Database Provider with automatic environment detection
 * DEPRECATED - bridge infrastructure eliminated in v4
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  console.warn(
    'DatabaseProvider is DEPRECATED in Isometry v4. ' +
    'Use SQLiteProvider with sql.js for direct database access.'
  );

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
// DEPRECATED: Removed excessive logging cache (bridge elimination v4)
// let lastLoggedMode: string | null = null;
// let loggedCount = 0;

/**
 * @deprecated Use useSQLite() from SQLiteProvider instead
 *
 * This function is deprecated as part of Bridge Elimination v4.
 * All bridge contexts (NativeAPIClient, WebViewClient) have been eliminated.
 * Use SQLiteProvider with sql.js for direct database access.
 */
export function useDatabase(): DatabaseContextValue | FallbackDatabaseContextValue {
  console.warn(
    'useDatabase() is DEPRECATED in Isometry v4. ' +
    'Bridge architecture eliminated. Use useSQLite() from SQLiteProvider instead.'
  );

  // Always use fallback for now - migration to SQLiteProvider in progress
  return useFallbackDatabase();
}
