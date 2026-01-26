import { useState } from 'react';
import { useNotebook } from './contexts/NotebookContext';
import { NotebookLayout } from './components/notebook/NotebookLayout';
import { D3ComponentsDemo } from './components/demo/D3ComponentsDemo';
import { SuperGridDemo } from './components/SuperGridDemo';
import { ComponentCatalog } from './pages/ComponentCatalog';
import MVPDemo from './MVPDemo';
import UnifiedDemo from './UnifiedDemo';

type ViewMode = 'app' | 'd3demo' | 'supergrid' | 'components' | 'notebook' | 'unified';

function _AppContent() {
  const { toggleNotebookMode } = useNotebook();
  const [viewMode, setViewMode] = useState<ViewMode>('app'); // Start with main app

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'notebook') {
      toggleNotebookMode();
    }
  };

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
              onClick={() => handleViewModeChange('app')}
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
              onClick={() => handleViewModeChange('d3demo')}
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
              onClick={() => handleViewModeChange('supergrid')}
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
              onClick={() => handleViewModeChange('components')}
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
            <button
              onClick={() => handleViewModeChange('notebook')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'notebook'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Notebook
            </button>
            <button
              onClick={() => handleViewModeChange('unified')}
              className={`px-2 py-0.5 text-xs rounded ${
                viewMode === 'unified'
                  ? 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#707070]'
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Unified
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
            ) : viewMode === 'notebook' ? (
              <NotebookLayout />
            ) : viewMode === 'unified' ? (
              <UnifiedDemo />
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
  // GSD: Use working MVP demo with UnifiedApp accessible via "Unified" button
  // This provides clean testing environment without complex context dependencies
  return <MVPDemo />;
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
