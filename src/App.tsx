import { useState } from 'react';
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
import { D3ComponentsDemo } from './components/demo/D3ComponentsDemo';

function AppContent() {
  const { theme, setTheme } = useTheme();
  const [showDemo, setShowDemo] = useState(true); // Start with demo visible

  const toggleTheme = () => {
    setTheme(theme === 'NeXTSTEP' ? 'Modern' : 'NeXTSTEP');
  };

  return (
    <div className={`app ${theme === 'NeXTSTEP' ? 'theme-nextstep' : 'theme-modern'}`}>
      <header className="app-header flex items-center justify-between px-4">
        {/* <Toolbar /> */}
        <h1 className="text-xl font-bold py-4">Isometry</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDemo(!showDemo)}
            className={`px-3 py-1.5 text-sm rounded ${
              theme === 'NeXTSTEP'
                ? 'bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#707070] border-r-[#707070]'
                : 'bg-blue-100 border border-blue-300 hover:bg-blue-200'
            }`}
          >
            {showDemo ? '📊 Main App' : '🧪 D3 Demo'}
          </button>
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
        </div>
      </header>

      <main className="app-main">
        {/* <Navigator /> */}
        {/* <Sidebar /> */}
        {showDemo ? <D3ComponentsDemo /> : <Canvas />}
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
