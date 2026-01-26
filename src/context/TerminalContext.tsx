import { createContext, useContext, ReactNode, useRef, MutableRefObject } from 'react';

interface TerminalContextValue {
  currentWorkingDirectory: MutableRefObject<string>;
  setWorkingDirectory: (path: string) => void;
  getWorkingDirectory: () => string;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

interface TerminalProviderProps {
  children: ReactNode;
  initialDirectory?: string;
}

/**
 * Terminal context provider that manages shared terminal state
 * across components (terminal, command router, etc.)
 */
export function TerminalProvider({ children, initialDirectory = '/Users/mshaler/Developer/Projects/Isometry' }: TerminalProviderProps) {
  const currentWorkingDirectory = useRef(initialDirectory);

  const setWorkingDirectory = (path: string) => {
    currentWorkingDirectory.current = path;
  };

  const getWorkingDirectory = () => {
    return currentWorkingDirectory.current;
  };

  return (
    <TerminalContext.Provider value={{
      currentWorkingDirectory,
      setWorkingDirectory,
      getWorkingDirectory
    }}>
      {children}
    </TerminalContext.Provider>
  );
}

/**
 * Hook to access terminal context
 */
export function useTerminalContext(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminalContext must be used within a TerminalProvider');
  }
  return context;
}