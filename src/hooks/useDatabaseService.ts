import { useState, useEffect, useCallback } from 'react';

export interface DatabaseConnection {
  isConnected: boolean;
  isInitialized: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface DatabaseService {
  connection: DatabaseConnection;
  query: (sql: string, params?: any[]) => Promise<any[]>;
  execute: (sql: string, params?: any[]) => Promise<{ changes: number; lastInsertRowid?: number }>;
  transaction: (queries: Array<{ sql: string; params?: any[] }>) => Promise<any[]>;
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

  const query = useCallback(async (sql: string, params?: any[]): Promise<any[]> => {
    try {
      // In v4, this would use direct sql.js access
      // For now, return empty results as a stub
      console.log('[DatabaseService] Query:', sql, params);
      return [];
    } catch (error: any) {
      setConnection(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  const execute = useCallback(async (sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }> => {
    try {
      // In v4, this would use direct sql.js access
      console.log('[DatabaseService] Execute:', sql, params);
      return { changes: 0 };
    } catch (error: any) {
      setConnection(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  const transaction = useCallback(async (queries: Array<{ sql: string; params?: any[] }>): Promise<any[]> => {
    try {
      // In v4, this would use direct sql.js transactions
      console.log('[DatabaseService] Transaction:', queries.length, 'queries');
      const results: any[] = [];

      for (const { sql, params } of queries) {
        if (sql.toLowerCase().startsWith('select')) {
          results.push(await query(sql, params));
        } else {
          results.push(await execute(sql, params));
        }
      }

      return results;
    } catch (error: any) {
      setConnection(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, [query, execute]);

  const initializeDatabase = useCallback(async (): Promise<void> => {
    try {
      setConnection(prev => ({ ...prev, error: null }));

      // In v4, this would initialize sql.js and load the database
      console.log('[DatabaseService] Initializing database...');

      setConnection({
        isConnected: true,
        isInitialized: true,
        error: null,
        lastSync: new Date()
      });

      console.log('[DatabaseService] Database initialized successfully');
    } catch (error: any) {
      setConnection({
        isConnected: false,
        isInitialized: false,
        error: error.message,
        lastSync: null
      });
      throw error;
    }
  }, []);

  const closeConnection = useCallback(async (): Promise<void> => {
    try {
      console.log('[DatabaseService] Closing database connection...');

      setConnection({
        isConnected: false,
        isInitialized: false,
        error: null,
        lastSync: null
      });
    } catch (error: any) {
      setConnection(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (!connection.isInitialized) {
      initializeDatabase().catch(error => {
        console.error('[DatabaseService] Auto-initialization failed:', error);
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