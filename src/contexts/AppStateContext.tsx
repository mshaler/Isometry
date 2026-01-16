import { createContext, useContext, ReactNode, useState } from 'react';

export type AppName = 'Demo' | 'Inbox' | 'Projects' | 'LinkedIn' | 'MTGs' | 'ReadWatch';
export type ViewName = 'List' | 'Gallery' | 'Timeline' | 'Calendar' | 'Tree' | 'Kanban' | 'Grid' | 'Charts' | 'Graphs';
export type DatasetName = 'ETL' | 'CAS' | 'Catalog' | 'Taxonomy' | 'Notes' | 'Projects' | 'Contacts' | 'Messages';

interface AppStateContextType {
  activeApp: AppName;
  activeView: ViewName;
  activeDataset: DatasetName;
  setActiveApp: (app: AppName) => void;
  setActiveView: (view: ViewName) => void;
  setActiveDataset: (dataset: DatasetName) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Use regular state for MVP (URL state requires React Router)
  const [activeApp, setActiveApp] = useState<AppName>('Demo');
  const [activeView, setActiveView] = useState<ViewName>('Grid');
  const [activeDataset, setActiveDataset] = useState<DatasetName>('Notes');

  return (
    <AppStateContext.Provider value={{
      activeApp,
      activeView,
      activeDataset,
      setActiveApp,
      setActiveView,
      setActiveDataset,
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
