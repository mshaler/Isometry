import React from 'react';
import { NativeDatabaseProvider, NativeDatabaseContextValue } from './NativeDatabaseContext';
import { WebViewDatabaseProvider, useWebViewDatabase, WebViewDatabaseContextValue } from './WebViewDatabaseContext';
import { FallbackDatabaseProvider, useFallbackDatabase, FallbackDatabaseContextValue } from './FallbackDatabaseContext';
import { DatabaseMode, useEnvironment } from '../contexts/EnvironmentContext';
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
 * Smart Database Provider that uses EnvironmentContext for provider selection
 */
function SmartDatabaseProvider({ children }: { children: React.ReactNode }) {
  const { environment, isLoading } = useEnvironment();
  const [stuckLoading, setStuckLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setStuckLoading(false);
      return;
    }

    const timeoutId = setTimeout(() => setStuckLoading(true), 2500);
    return () => clearTimeout(timeoutId);
  }, [isLoading]);

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
  if (isLoading && !stuckLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-600">Detecting database environment...</p>
        </div>
      </div>
    );
  }
  if (isLoading && stuckLoading) {
    console.warn('Environment detection stuck; falling back to fallback database mode.');
    return (
      <FallbackDatabaseProvider>
        {children}
      </FallbackDatabaseProvider>
    );
  }

  switch (environment.mode) {
    case DatabaseMode.WEBVIEW_BRIDGE:
      console.log('✅ DatabaseContext: Using WebView Database Bridge (auto-detected)');
      console.log('🔧 DatabaseContext: Environment mode =', environment.mode);
      return (
        <WebViewDatabaseProvider>
          {children}
        </WebViewDatabaseProvider>
      );

    case DatabaseMode.HTTP_API:
      // Additional safety check: if we're in a WebView environment but somehow ended up in HTTP_API mode,
      // force fallback mode to prevent crashes
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';

      if (userAgent.includes('IsometryNative') || hasWebKit) {
        console.log('🚨 DatabaseContext: HTTP_API mode detected in WebView environment - forcing fallback!');
        console.log('🔧 DatabaseContext: This is a safety fallback to prevent crashes');
        return (
          <FallbackDatabaseProvider>
            {children}
          </FallbackDatabaseProvider>
        );
      }

      console.log('❌ DatabaseContext: Using Native Database API (auto-detected) - THIS SHOULD NOT HAPPEN IN WEBVIEW!');
      console.log('🔧 DatabaseContext: Environment mode =', environment.mode);
      return (
        <NativeDatabaseProvider>
          {children}
        </NativeDatabaseProvider>
      );

    case DatabaseMode.FALLBACK:
      console.log('Using Fallback Database (no backend available)');
      return (
        <FallbackDatabaseProvider>
          {children}
        </FallbackDatabaseProvider>
      );

    default:
      // Fallback to FALLBACK mode - no backend required
      console.log('Unknown database mode - using fallback mode');
      return (
        <FallbackDatabaseProvider>
          {children}
        </FallbackDatabaseProvider>
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
// Cache to prevent excessive logging
let lastLoggedMode: string | null = null;
let loggedCount = 0;

export function useDatabase(): DatabaseContextValue | NativeDatabaseContextValue | WebViewDatabaseContextValue | FallbackDatabaseContextValue {
  const { environment } = useEnvironment();

  // Only log when mode changes or first few times
  if (lastLoggedMode !== environment.mode || loggedCount < 3) {
    console.log('🔍 useDatabase called with environment mode:', environment.mode);
    lastLoggedMode = environment.mode;
    loggedCount++;
  }

  // TEMPORARY NUCLEAR OPTION: For debugging, always use FallbackDatabase in any error case
  // This prevents the "useNativeDatabase must be used within NativeDatabaseProvider" crash
  try {
    // AGGRESSIVE RUNTIME CHECK: Force WebView provider if ANY WebView indicators are present
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
    const hasWebKit = typeof window !== 'undefined' && typeof window.webkit?.messageHandlers !== 'undefined';
    const isIsometryNative = userAgent.includes('IsometryNative');
    const hasWebKitAny = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';

    // Only log detailed checks when mode changes or first few times
    if (lastLoggedMode !== environment.mode || loggedCount < 3) {
      console.log('🔍 AGGRESSIVE CHECK in useDatabase:');
      console.log(`  - User Agent: "${userAgent}"`);
      console.log(`  - Has WebKit Object: ${hasWebKitAny}`);
      console.log(`  - Has WebKit MessageHandlers: ${hasWebKit}`);
      console.log(`  - IsometryNative in UA: ${isIsometryNative}`);
      console.log(`  - Environment Mode: ${environment.mode}`);
    }

    // If ANY WebView indicator is present, force WebView mode regardless of environment detection
    if (hasWebKit || isIsometryNative || hasWebKitAny) {
      if (lastLoggedMode !== environment.mode || loggedCount < 3) {
        console.log('🚨 FORCING WebView database provider due to WebView indicators');
      }
      return useWebViewDatabase();
    }

    switch (environment.mode) {
      case DatabaseMode.WEBVIEW_BRIDGE:
        if (lastLoggedMode !== environment.mode || loggedCount < 3) {
          console.log('✅ Using WebView database provider');
        }
        return useWebViewDatabase();

      case DatabaseMode.HTTP_API:
        if (lastLoggedMode !== environment.mode || loggedCount < 3) {
          console.log('⚠️ HTTP_API mode - this might cause the error, using fallback instead');
        }
        return useFallbackDatabase(); // TEMPORARY: Use fallback instead of native to prevent crash

      case DatabaseMode.FALLBACK:
        if (lastLoggedMode !== environment.mode || loggedCount < 3) {
          console.log('✅ Using Fallback database provider (should return 100 nodes)');
        }
        const fallbackDb = useFallbackDatabase();
        if (lastLoggedMode !== environment.mode || loggedCount < 3) {
          console.log('[DatabaseContext] Fallback DB execute type:', typeof fallbackDb.execute);
        }
        return fallbackDb;

      default:
        if (lastLoggedMode !== environment.mode || loggedCount < 3) {
          console.log('❓ Unknown mode - using fallback database provider');
        }
        return useFallbackDatabase();
    }
  } catch (error) {
    if (lastLoggedMode !== environment.mode || loggedCount < 3) {
      console.error('🚨 Error in useDatabase, falling back to fallback provider:', error);
    }
    return useFallbackDatabase();
  }
}
