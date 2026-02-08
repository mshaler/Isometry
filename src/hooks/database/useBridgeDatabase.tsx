/**
 * Unified Database Abstraction Hook
 *
 * Provides consistent interface for both sql.js and native bridge backends
 * with automatic backend detection, switching, and state preservation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Node } from '../types/node';
import { isBridgeAvailable } from '../filters/bridge';
import { useDatabase } from '../db/DatabaseContext';

// Database backend types
export type DatabaseBackend = 'sqljs' | 'bridge';

export interface DatabaseQuery {
  sql: string;
  params?: unknown[];
}

export interface DatabaseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
  source: DatabaseBackend;
}

export interface DatabaseStatistics {
  backendSwitches: number;
  totalQueries: number;
  averageQueryTime: number;
  sqlJsQueries: number;
  bridgeQueries: number;
  lastBackendSwitch?: Date;
  currentBackend: DatabaseBackend;
}

// Database abstraction interface
export interface DatabaseAbstraction {
  // Core query methods
  executeQuery<T = unknown>(sql: string, params?: unknown[]): Promise<DatabaseResult<T>>;
  searchNodes(query: string): Promise<DatabaseResult<Node[]>>;
  getFilteredNodes(filters: unknown): Promise<DatabaseResult<Node[]>>;

  // Backend management
  currentBackend: DatabaseBackend;
  isBackendAvailable: (backend: DatabaseBackend) => boolean;
  switchBackend: (backend: DatabaseBackend) => Promise<boolean>;

  // State and statistics
  isLoading: boolean;
  lastError: string | null;
  statistics: DatabaseStatistics;
}

// Database context for provider pattern
interface DatabaseContextValue {
  database: DatabaseAbstraction;
  isInitialized: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// Performance monitoring
class DatabasePerformanceMonitor {
  private stats: DatabaseStatistics = {
    backendSwitches: 0,
    totalQueries: 0,
    averageQueryTime: 0,
    sqlJsQueries: 0,
    bridgeQueries: 0,
    currentBackend: 'sqljs'
  };

  private queryTimes: number[] = [];
  private readonly maxQueryTimes = 100; // Keep last 100 query times

  recordQuery(backend: DatabaseBackend, duration: number): void {
    this.stats.totalQueries++;
    this.queryTimes.push(duration);

    // Keep only recent query times for average calculation
    if (this.queryTimes.length > this.maxQueryTimes) {
      this.queryTimes.shift();
    }

    // Update backend-specific counters
    if (backend === 'sqljs') {
      this.stats.sqlJsQueries++;
    } else {
      this.stats.bridgeQueries++;
    }

    // Recalculate average
    this.stats.averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  recordBackendSwitch(newBackend: DatabaseBackend): void {
    this.stats.backendSwitches++;
    this.stats.currentBackend = newBackend;
    this.stats.lastBackendSwitch = new Date();
  }

  getStatistics(): DatabaseStatistics {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      backendSwitches: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      sqlJsQueries: 0,
      bridgeQueries: 0,
      currentBackend: this.stats.currentBackend
    };
    this.queryTimes = [];
  }
}

/**
 * Unified database abstraction hook
 */
export function useBridgeDatabase(): DatabaseAbstraction {
  const [currentBackend, setCurrentBackend] = useState<DatabaseBackend>('sqljs');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const performanceMonitor = useRef(new DatabasePerformanceMonitor());
  const initializationRef = useRef<boolean>(false);

  // SQL.js database instance for fallback
  const sqliteDatabase = useDatabase();

  // Direct SQL.js execution via database context
  const executeSQLJSQuery = useCallback(async (sql: string, params?: unknown[]) => {
    try {
      if (!sqliteDatabase) {
        throw new Error('SQL.js database not available');
      }

      // Execute query using the existing database context
      const result = sqliteDatabase.execute(sql, params);
      return result;
    } catch (error) {
      console.error('[useBridgeDatabase] SQL.js query failed:', error);
      throw error;
    }
  }, [sqliteDatabase]);

  // Backend availability detection
  const isBackendAvailable = useCallback((backend: DatabaseBackend): boolean => {
    switch (backend) {
      case 'sqljs':
        return true; // SQL.js is always available in browser
      case 'bridge':
        return isBridgeAvailable();
      default:
        return false;
    }
  }, []);

  // Backend switching with validation
  const switchBackend = useCallback(async (backend: DatabaseBackend): Promise<boolean> => {
    if (!isBackendAvailable(backend)) {
      console.warn(`Backend ${backend} is not available`);
      return false;
    }

    if (currentBackend === backend) {
      return true; // Already using requested backend
    }

    try {
      setIsLoading(true);
      setLastError(null);

      // Record the switch
      performanceMonitor.current.recordBackendSwitch(backend);

      // Update current backend
      setCurrentBackend(backend);

      console.log(`[useBridgeDatabase] Switched to ${backend} backend`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during backend switch';
      setLastError(errorMessage);
      console.error(`[useBridgeDatabase] Failed to switch to ${backend}:`, error);
      return false;

    } finally {
      setIsLoading(false);
    }
  }, [currentBackend, isBackendAvailable]);

  // Auto-detect and switch to best available backend
  useEffect(() => {
    const detectBestBackend = async () => {
      if (initializationRef.current) return;

      // Prefer bridge when available, fallback to sql.js
      const preferredBackend = isBackendAvailable('bridge') ? 'bridge' : 'sqljs';

      if (preferredBackend !== currentBackend) {
        await switchBackend(preferredBackend);
      }

      initializationRef.current = true;
    };

    detectBestBackend();
  }, [currentBackend, switchBackend, isBackendAvailable]);

  // Monitor bridge availability and auto-switch
  useEffect(() => {
    const handleBridgeStateChange = async () => {
      const bridgeAvailable = isBackendAvailable('bridge');

      if (bridgeAvailable && currentBackend === 'sqljs') {
        // Bridge became available, switch to it
        await switchBackend('bridge');
      } else if (!bridgeAvailable && currentBackend === 'bridge') {
        // Bridge became unavailable, fallback to sql.js
        await switchBackend('sqljs');
      }
    };

    // Listen for bridge ready events
    window.addEventListener('isometry-bridge-ready', handleBridgeStateChange);

    // Periodic availability check
    const intervalId = setInterval(() => {
      handleBridgeStateChange();
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('isometry-bridge-ready', handleBridgeStateChange);
      clearInterval(intervalId);
    };
  }, [currentBackend, switchBackend, isBackendAvailable]);

  // Core query execution with backend routing
  const executeQuery = useCallback(async <T = unknown>(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseResult<T>> => {
    const startTime = performance.now();
    setLastError(null);

    try {
      setIsLoading(true);

      let result: T;

      if (currentBackend === 'bridge' && isBridgeAvailable()) {
        // Execute via bridge
        try {
          const response = await window._isometryBridge!.sendMessage('database', 'execute', {
            sql,
            params: params || []
          });

          result = response as T;

        } catch (bridgeError) {
          // Bridge failed, fallback to SQL.js
          console.warn('[useBridgeDatabase] Bridge query failed, falling back to SQL.js:', bridgeError);
          await switchBackend('sqljs');

          const sqlJsResult = await executeSQLJSQuery(sql, params);
          result = sqlJsResult as T;
        }

      } else {
        // Execute via SQL.js
        const sqlJsResult = await executeSQLJSQuery(sql, params);
        result = sqlJsResult as T;
      }

      const duration = performance.now() - startTime;
      performanceMonitor.current.recordQuery(currentBackend, duration);

      return {
        success: true,
        data: result,
        duration,
        source: currentBackend
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Query execution failed';

      setLastError(errorMessage);
      performanceMonitor.current.recordQuery(currentBackend, duration);

      return {
        success: false,
        error: errorMessage,
        duration,
        source: currentBackend
      };

    } finally {
      setIsLoading(false);
    }
  }, [currentBackend, executeSQLJSQuery, switchBackend]);

  // Specialized search nodes method
  const searchNodes = useCallback(async (query: string): Promise<DatabaseResult<Node[]>> => {
    const searchSQL = `
      SELECT *
      FROM nodes
      JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ?
      AND nodes.deleted_at IS NULL
      ORDER BY rank
      LIMIT 100
    `;

    return executeQuery<Node[]>(searchSQL, [query]);
  }, [executeQuery]);

  // Filtered nodes method (placeholder for LATCH filtering)
  const getFilteredNodes = useCallback(async (filters: unknown): Promise<DatabaseResult<Node[]>> => {
    // For now, return all nodes - this would integrate with LATCH filtering
    const allNodesSQL = `
      SELECT *
      FROM nodes
      WHERE deleted_at IS NULL
      ORDER BY modified_at DESC
      LIMIT 1000
    `;

    // In production, this would compile filters to SQL using the filter compiler
    console.log('[useBridgeDatabase] getFilteredNodes called with filters:', filters);

    return executeQuery<Node[]>(allNodesSQL);
  }, [executeQuery]);

  // Get current statistics
  const statistics = performanceMonitor.current.getStatistics();

  return {
    executeQuery,
    searchNodes,
    getFilteredNodes,
    currentBackend,
    isBackendAvailable,
    switchBackend,
    isLoading,
    lastError,
    statistics
  };
}

/**
 * Database Provider Component
 */
export interface DatabaseProviderProps {
  children: React.ReactNode;
  preferredBackend?: DatabaseBackend;
  enablePerformanceMonitoring?: boolean;
}

export function DatabaseProvider({
  children,
  preferredBackend = 'bridge',
  enablePerformanceMonitoring = true
}: DatabaseProviderProps) {
  const database = useBridgeDatabase();
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize database with preferred backend
  useEffect(() => {
    const initializeDatabase = async () => {
      if (!database.isBackendAvailable(preferredBackend)) {
        console.warn(`Preferred backend ${preferredBackend} not available, using current: ${database.currentBackend}`);
      } else if (database.currentBackend !== preferredBackend) {
        await database.switchBackend(preferredBackend);
      }

      setIsInitialized(true);
    };

    initializeDatabase();
  }, [database, preferredBackend]);

  // Performance monitoring logging
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const logPerformance = () => {
      const stats = database.statistics;
      if (stats.totalQueries > 0) {
        console.log('[DatabaseProvider Performance]', {
          currentBackend: stats.currentBackend,
          totalQueries: stats.totalQueries,
          averageQueryTime: `${stats.averageQueryTime.toFixed(2)}ms`,
          backendSwitches: stats.backendSwitches,
          distribution: `SQL.js: ${stats.sqlJsQueries}, Bridge: ${stats.bridgeQueries}`
        });
      }
    };

    // Log performance every 30 seconds
    const intervalId = setInterval(logPerformance, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [database, enablePerformanceMonitoring]);

  return (
    <DatabaseContext.Provider value={{ database, isInitialized }}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to use database from context
 */
export function useDatabaseContext(): DatabaseAbstraction {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabaseContext must be used within DatabaseProvider');
  }

  if (!context.isInitialized) {
    throw new Error('Database not initialized yet');
  }

  return context.database;
}

/**
 * Hook to get database initialization status
 */
export function useDatabaseStatus(): {
  isInitialized: boolean;
  currentBackend: DatabaseBackend | null;
  isLoading: boolean;
} {
  const context = useContext(DatabaseContext);

  if (!context) {
    return {
      isInitialized: false,
      currentBackend: null,
      isLoading: false
    };
  }

  return {
    isInitialized: context.isInitialized,
    currentBackend: context.database.currentBackend,
    isLoading: context.database.isLoading
  };
}

// Development utilities (use these within components)
export const DatabaseDevTools = {
  /**
   * Test backend availability
   */
  testBackends(): Record<DatabaseBackend, boolean> {
    return {
      sqljs: true, // Always available
      bridge: isBridgeAvailable()
    };
  }
};

export default useBridgeDatabase;