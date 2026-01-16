import { useTheme, ThemeProvider } from './contexts/ThemeContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { FilterProvider } from './state/FilterContext';
import { PAFVProvider } from './contexts/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Import Figma components (when ready)
// import { Toolbar } from './components/Toolbar';
// import { Navigator } from './components/Navigator';
// import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';

function AppContent() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP');
  };

  return (
    <div className={`app ${theme === 'NeXTSTEP' ? 'theme-nextstep' : 'theme-modern'}`}>
      <header className="app-header flex items-center justify-between px-4">
        {/* <Toolbar /> */}
        <h1 className="text-xl font-bold py-4">Isometry</h1>
        <button
          onClick={toggleTheme}
          className={`px-3 py-1.5 text-sm rounded ${
            theme === 'NeXTSTEP'
              ? 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
              : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
          }`}
        >
          {theme === 'NeXTSTEP' ? '🖥️ NeXTSTEP' : '✨ Modern'}
        </button>
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
