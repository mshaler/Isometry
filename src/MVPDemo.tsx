import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { DatabaseMode, EnvironmentProvider } from './contexts/EnvironmentContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './state/PAFVContext';
import { NotebookProvider, useNotebook } from './contexts/NotebookContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { Canvas } from './components/Canvas';
import { UnifiedApp } from './components/UnifiedApp';
import { NotebookLayout } from './components/notebook/NotebookLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationSystem } from './components/ui/NotificationSystem';
import { CacheInvalidationProvider } from './hooks/useCacheInvalidation';
import { LiveDataProvider } from './context/LiveDataContext';
import { SuperGridDemo } from './components/SuperGridDemo';
import { CardOverlayProvider } from './state/CardOverlayContext';

type ViewMode = 'app' | 'd3demo' | 'supergrid' | 'components' | 'notebook';

const VIEW_MODES: Array<{ value: ViewMode; label: string }> = [
  { value: 'app', label: 'App' },
  { value: 'd3demo', label: 'D3 Demo' },
  { value: 'supergrid', label: 'Supergrid' },
  { value: 'components', label: 'Components' },
  { value: 'notebook', label: 'Notebook' },
];

function MVPDemoShell({ onShowUnified }: { onShowUnified: () => void }) {
  const { isNotebookMode, toggleNotebookMode } = useNotebook();
  const [viewMode, setViewMode] = useState<ViewMode>(() => (isNotebookMode ? 'notebook' : 'app'));

  useEffect(() => {
    const shouldEnableNotebook = viewMode === 'notebook';
    if (shouldEnableNotebook !== isNotebookMode) {
      toggleNotebookMode();
    }
  }, [viewMode, isNotebookMode, toggleNotebookMode]);

  useEffect(() => {
    if (isNotebookMode && viewMode !== 'notebook') {
      setViewMode('notebook');
    }
  }, [isNotebookMode, viewMode]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="p-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Isometry MVP Demo</h1>
            <p className="text-gray-600">Canvas with mock data - no database dependencies</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {VIEW_MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => setViewMode(mode.value)}
                className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                  viewMode === mode.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {mode.label}
              </button>
            ))}
            <button
              onClick={onShowUnified}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Test Unified UI
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {viewMode === 'app' ? (
          <ErrorBoundary level="feature" name="Canvas">
            <div className="h-full">
              <Canvas />
            </div>
          </ErrorBoundary>
        ) : viewMode === 'notebook' ? (
          <ErrorBoundary level="feature" name="NotebookLayout">
            <div className="h-full">
              <NotebookLayout />
            </div>
          </ErrorBoundary>
        ) : viewMode === 'supergrid' ? (
          <ErrorBoundary level="feature" name="SuperGridDemo">
            <div className="h-full">
              <SuperGridDemo />
            </div>
          </ErrorBoundary>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-gray-500">
            <div>
              <h2 className="text-lg font-semibold mb-2">{VIEW_MODES.find(mode => mode.value === viewMode)?.label}</h2>
              <p>This view is staged for the next iteration.</p>
            </div>
          </div>
        )}
      </div>
      <NotificationSystem />
    </div>
  );
}

/**
 * Minimal MVP Demo - bypasses all complex dependencies
 * Just shows Canvas with mock data to prove visualization works
 * Now includes access to UnifiedApp for testing UI/UX integration
 */
function MVPDemo() {
  const [showUnified, setShowUnified] = useState(false);

  if (showUnified) {
    return (
      <ErrorBoundary level="app" name="UnifiedApp">
        <CacheInvalidationProvider>
          <BrowserRouter>
            <LiveDataProvider
              connectionCheckInterval={30000}
              enableMetrics={true}
            >
              <ThemeProvider>
                <EnvironmentProvider forcedMode={DatabaseMode.FALLBACK} enableAutoDetection={false}>
                  <DatabaseProvider>
                    <AppStateProvider>
                      <FilterProvider>
                        <PAFVProvider>
                          <NotebookProvider>
                            <CardOverlayProvider>
                              <UnifiedApp />
                              <NotificationSystem />
                            </CardOverlayProvider>
                          </NotebookProvider>
                        </PAFVProvider>
                      </FilterProvider>
                    </AppStateProvider>
                  </DatabaseProvider>
                </EnvironmentProvider>
              </ThemeProvider>
            </LiveDataProvider>
          </BrowserRouter>
        </CacheInvalidationProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary level="app" name="MVPDemo">
      <CacheInvalidationProvider>
        <BrowserRouter>
          <LiveDataProvider
            connectionCheckInterval={30000}
            enableMetrics={true}
          >
          <ThemeProvider>
            <EnvironmentProvider forcedMode={DatabaseMode.FALLBACK} enableAutoDetection={false}>
              <DatabaseProvider>
                <AppStateProvider>
                  <FilterProvider>
                    <PAFVProvider>
                      <NotebookProvider>
                        <CardOverlayProvider>
                          <MVPDemoShell onShowUnified={() => setShowUnified(true)} />
                        </CardOverlayProvider>
                      </NotebookProvider>
                    </PAFVProvider>
                  </FilterProvider>
                </AppStateProvider>
              </DatabaseProvider>
            </EnvironmentProvider>
          </ThemeProvider>
        </LiveDataProvider>
      </BrowserRouter>
    </CacheInvalidationProvider>
  </ErrorBoundary>
  );
}

export default MVPDemo;
