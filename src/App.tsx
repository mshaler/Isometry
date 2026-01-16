import { useTheme, ThemeProvider } from './contexts/ThemeContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { FilterProvider } from './state/FilterContext';
import { PAFVProvider } from './state/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Import Figma components (when ready)
// import { Toolbar } from './components/Toolbar';
// import { Navigator } from './components/Navigator';
// import { Sidebar } from './components/Sidebar';
// import { Canvas } from './components/Canvas';

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
        {/* <Canvas /> */}
        <div className="p-8 text-center">
          <p className="text-lg mb-4">🎉 Isometry is ready for development!</p>
          <p className="text-sm text-gray-600">
            Database, types, views, filters, and state management are all set up.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Start Claude Code and run: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code>
          </p>
        </div>
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
                <AppContent />
              </SelectionProvider>
            </PAFVProvider>
          </FilterProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
