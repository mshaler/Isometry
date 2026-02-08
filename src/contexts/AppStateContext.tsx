import { createContext, useContext, ReactNode } from 'react';
import { useURLState } from '@/hooks';

export type AppName = 'Demo' | 'Inbox' | 'Projects' | 'LinkedIn' | 'MTGs' | 'ReadWatch';
export type ViewName = 'List' | 'Gallery' | 'Timeline' | 'Calendar' | 'Tree' | 'Kanban' | 'Grid' | 'Charts' | 'Graphs' | 'SuperGrid';
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
  // URL-synced state for shareable views
  const [activeApp, setActiveApp] = useURLState<AppName>(
    'app',
    'Demo',
    (v: AppName) => v,
    (s: string) => s as AppName
  );
  const [activeView, setActiveView] = useURLState<ViewName>(
    'view',
    'SuperGrid',
    (v: ViewName) => v,
    (s: string) => s as ViewName
  );
  const [activeDataset, setActiveDataset] = useURLState<DatasetName>(
    'dataset',
    'Notes',
    (v: DatasetName) => v,
    (s: string) => s as DatasetName
  );

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
