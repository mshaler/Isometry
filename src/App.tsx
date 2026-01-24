import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useTheme, ThemeProvider } from './contexts/ThemeContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './contexts/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { CardOverlayProvider } from './state/CardOverlayContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CardOverlay } from './components/CardOverlay';

// Layout components
import { Toolbar } from './components/Toolbar';
import { Navigator } from './components/Navigator';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { CommandBar } from './components/CommandBar';
import { Canvas } from './components/Canvas';
import { D3ComponentsDemo } from './components/demo/D3ComponentsDemo';
import { SuperGridDemo } from './components/SuperGridDemo';
import { ComponentCatalog } from './pages/ComponentCatalog';

type ViewMode = 'app' | 'd3demo' | 'supergrid' | 'components';

function AppContent() {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('app'); // Start with main app

  return (
    <div className={`h-screen flex flex-col ${theme === 'NeXTSTEP' ? 'theme-nextstep bg-[#808080]' : 'theme-modern bg-gray-50'}`}>
      {/* Top: Toolbar (menu bar + toolbar buttons) */}
      <Toolbar />

      {/* Navigator row (App/View/Dataset dropdowns + PAFV) */}
      <Navigator />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - LATCH filters */}
        <Sidebar />

        {/* Main Canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toggle for demo mode */}
          <div className={`flex items-center gap-2 px-3 py-1 ${
            theme === 'NeXTSTEP' ? 'bg-[#c0c0c0]' : 'bg-white/50'
          }`}>
            <button
              onClick={() => setViewMode('app')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'app'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Main App
            </button>
            <button
              onClick={() => setViewMode('d3demo')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'd3demo'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              D3 Demo
            </button>
            <button
              onClick={() => setViewMode('supergrid')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'supergrid'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              SuperGrid
            </button>
            <button
              onClick={() => setViewMode('components')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'components'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Components
            </button>
          </div>

          {/* Canvas or Demo */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'd3demo' ? (
              <D3ComponentsDemo />
            ) : viewMode === 'supergrid' ? (
              <SuperGridDemo />
            ) : viewMode === 'components' ? (
              <ComponentCatalog />
            ) : (
              <Canvas />
            )}
          </div>

          {/* Command Bar at bottom */}
          <CommandBar />
        </div>

        {/* Right Sidebar - Formats + Settings */}
        <RightSidebar />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <DatabaseProvider>
            <AppStateProvider>
              <FilterProvider>
                <PAFVProvider>
                  <SelectionProvider>
                    <CardOverlayProvider>
                      <AppContent />
                      <CardOverlay />
                    </CardOverlayProvider>
                  </SelectionProvider>
                </PAFVProvider>
              </FilterProvider>
            </AppStateProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
