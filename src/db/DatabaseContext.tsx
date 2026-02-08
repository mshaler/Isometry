/**
 * Database Context - Stub Implementation for sql.js integration
 */

import { createContext, useContext, ReactNode } from 'react';

export interface DatabaseContextType {
  isConnected: boolean;
  execute: (sql: string, params?: unknown[]) => unknown[];
  close: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const value: DatabaseContextType = {
    isConnected: false,
    execute: () => [],
    close: () => {}
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}
