/**
 * Fallback Database Context
 *
 * Pure web fallback provider that doesn't attempt any network connections.
 * Uses static fallback data for development when no backend is available.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SAMPLE_NOTES as ALL_NOTES } from './sample-data';

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
    console.log('[FallbackDB] Query executed:', {
      sql: sql.substring(0, 50) + '...',
      returning: sql.toLowerCase().includes('select') && sql.toLowerCase().includes('nodes') ? `${ALL_NOTES.length} real nodes` : 'other data'
    });

    // Return sample data for nodes queries
    if (sql.toLowerCase().includes('select') && sql.toLowerCase().includes('nodes')) {
      const sampleNodes = ALL_NOTES.map(note => {
        // Determine node type based on ID prefix
        let nodeType = 'note';
        if (note.id.startsWith('c')) nodeType = 'contact';
        if (note.id.startsWith('b')) nodeType = 'bookmark';

        return {
          id: note.id,
          node_type: nodeType,
          name: note.name,
          content: note.content,
          folder: note.folder,
          tags: JSON.stringify(note.tags),
          priority: note.priority,
          created_at: new Date(Date.now() - note.createdDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
          modified_at: new Date(Date.now() - Math.max(0, note.createdDaysAgo - Math.floor(Math.random() * 3)) * 24 * 60 * 60 * 1000).toISOString(),
          deleted_at: null,
          latitude: null,
          longitude: null,
          location_name: null,
          location_address: null,
          due_at: null,
          completed_at: null,
          event_start: null,
          event_end: null,
          status: null,
          importance: 0,
          sort_order: 0,
          source: null,
          source_id: null,
          source_url: null,
          version: 1,
          summary: null
        };
      }) as T[];

      const nodeTypeCounts = {
        notes: sampleNodes.filter(n => (n as any).node_type === 'note').length,
        contacts: sampleNodes.filter(n => (n as any).node_type === 'contact').length,
        bookmarks: sampleNodes.filter(n => (n as any).node_type === 'bookmark').length,
      };

      console.log(`[FallbackDB] Returning ${sampleNodes.length} total nodes:`, nodeTypeCounts);
      return sampleNodes;
    }

    // Return empty arrays for other queries
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