import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, saveDatabase, resetDatabase } from './init';

interface DatabaseContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  const execute = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[] => {
    if (!db) throw new Error('Database not initialized');
    
    try {
      const result = db.exec(sql, params);
      if (result.length === 0) return [];
      
      const { columns, values } = result[0];
      return values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } catch (err) {
      console.error('SQL Error:', sql, params, err);
      throw err;
    }
  }, [db]);
  
  const save = useCallback(async () => {
    await saveDatabase();
  }, []);
  
  const reset = useCallback(async () => {
    setLoading(true);
    try {
      const newDb = await resetDatabase();
      setDb(newDb);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return (
    <DatabaseContext.Provider value={{ db, loading, error, execute, save, reset }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}
