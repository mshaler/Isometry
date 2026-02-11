import { useState, useEffect, useCallback } from 'react';
import { devLogger } from '../utils/logging';

export interface DatabaseConnection {
  isConnected: boolean;
  isInitialized: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface DatabaseService {
  connection: DatabaseConnection;
  query: (sql: string, params?: unknown[]) => Promise<any[]>;
  execute: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction: (queries: Array<{ sql: string; params?: unknown[] }>) => Promise<any[]>;
  initializeDatabase: () => Promise<void>;
  closeConnection: () => Promise<void>;
}

/**
 * Hook for database service operations
 * Bridge eliminated - direct sql.js database access
 */
export function useDatabaseService(): DatabaseService {
  const [connection, setConnection] = useState<DatabaseConnection>({
    isConnected: false,
    isInitialized: false,
    error: null,
    lastSync: null
  });

  const query = useCallback(async (sql: string, params?: unknown[]): Promise<any[]> => {
    try {
      // In v4, this would use direct sql.js access
      // For now, return empty results as a stub
      devLogger.debug('DatabaseService query', { sql, params });
      return [];
    } catch (error: unknown) {
      setConnection(prev => ({ ...prev, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }, []);

  const execute = useCallback(async (
    sql: string,
    params?: unknown[]
  ): Promise<{ changes: number; lastInsertRowid?: number }> => {
    try {
      // In v4, this would use direct sql.js access
      devLogger.debug('DatabaseService execute', { sql, params });
      return { changes: 0 };
    } catch (error: unknown) {
      setConnection(prev => ({ ...prev, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }, []);

  const transaction = useCallback(async (queries: Array<{ sql: string; params?: unknown[] }>): Promise<any[]> => {
    try {
      // In v4, this would use direct sql.js transactions
      devLogger.debug('DatabaseService transaction', { queryCount: queries.length });
      const results: unknown[] = [];

      for (const { sql, params } of queries) {
        if (sql.toLowerCase().startsWith('select')) {
          results.push(await query(sql, params));
        } else {
          results.push(await execute(sql, params));
        }
      }

      return results;
    } catch (error: unknown) {
      setConnection(prev => ({ ...prev, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }, [query, execute]);

  const initializeDatabase = useCallback(async (): Promise<void> => {
    try {
      setConnection(prev => ({ ...prev, error: null }));

      // In v4, this would initialize sql.js and load the database
      devLogger.debug('DatabaseService initializing database');

      setConnection({
        isConnected: true,
        isInitialized: true,
        error: null,
        lastSync: new Date()
      });

      devLogger.debug('DatabaseService database initialized successfully');
    } catch (error: unknown) {
      setConnection({
        isConnected: false,
        isInitialized: false,
        error: error instanceof Error ? error.message : String(error),
        lastSync: null
      });
      throw error;
    }
  }, []);

  const closeConnection = useCallback(async (): Promise<void> => {
    try {
      devLogger.debug('DatabaseService closing database connection');

      setConnection({
        isConnected: false,
        isInitialized: false,
        error: null,
        lastSync: null
      });
    } catch (error: unknown) {
      setConnection(prev => ({ ...prev, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (!connection.isInitialized) {
      initializeDatabase().catch(error => {
        devLogger.error('DatabaseService auto-initialization failed', { error });
      });
    }
  }, [connection.isInitialized, initializeDatabase]);

  return {
    connection,
    query,
    execute,
    transaction,
    initializeDatabase,
    closeConnection
  };
}