import { useTheme, ThemeProvider } from './contexts/ThemeContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { FilterProvider } from './state/FilterContext';
import { PAFVProvider } from './state/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Import Figma components (when ready)
// import { Toolbar } from './components/Toolbar';
// import { Navigator } from './components/Navigator';
// import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <div className={`app ${theme === 'NeXTSTEP' ? 'theme-nextstep' : 'theme-modern'}`}>
      <header className="app-header">
        {/* <Toolbar /> */}
        <h1 className="text-xl font-bold p-4">Isometry</h1>
      </header>
      
      <main className="app-main">
        {/* <Navigator /> */}
        {/* <Sidebar /> */}
        <Canvas />
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DatabaseProvider>
          <FilterProvider>
            <PAFVProvider>
              <SelectionProvider>
                <AppStateProvider>
                  <AppContent />
                </AppStateProvider>
              </SelectionProvider>
            </PAFVProvider>
          </FilterProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
