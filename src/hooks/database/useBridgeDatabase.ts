/**
 * Bridge Database Hook Stub - Bridge Eliminated
 *
 * This is a minimal stub implementation to eliminate TS2307 errors.
 * The original bridge database functionality is replaced with direct sql.js access.
 */

import { bridgeLogger } from '@/utils/logging/dev-logger';

export interface DatabaseResult {
  data: unknown[];
  error?: string;
  loading: boolean;
  metadata?: {
    rowCount: number;
    queryTime: number;
    columns: string[];
  };
}

export interface DatabaseConnection {
  isConnected: boolean;
  bridge: null; // Bridge eliminated
  lastSync: Date | null;
}

/**
 * Hook for bridge database access (stub - bridge eliminated)
 */
export function useBridgeDatabase() {
  return {
    connection: {
      isConnected: false, // Bridge eliminated
      bridge: null,
      lastSync: null
    } as DatabaseConnection,
    query: async (_sql: string, _params?: unknown[]): Promise<DatabaseResult> => {
      bridgeLogger.debug('Bridge eliminated - use useSQLiteQuery instead');
      return {
        data: [],
        error: 'Bridge eliminated - use useSQLiteQuery for direct sql.js access',
        loading: false,
        metadata: {
          rowCount: 0,
          queryTime: 0,
          columns: []
        }
      };
    },
    isConnected: false,
    error: 'Bridge eliminated'
  };
}

/**
 * Default export for compatibility
 */
export default useBridgeDatabase;