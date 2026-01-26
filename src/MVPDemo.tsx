import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './contexts/PAFVContext';
import { Canvas } from './components/Canvas';
import { UnifiedApp } from './components/UnifiedApp';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { NotificationSystem } from './components/ui/NotificationSystem';

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
        <UnifiedApp />
        <NotificationSystem />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary level="app" name="MVPDemo">
      <BrowserRouter>
        <ThemeProvider>
          <AppStateProvider>
            <FilterProvider>
              <PAFVProvider>
                <div className="h-screen bg-gray-50">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h1 className="text-2xl font-bold mb-2">Isometry MVP Demo</h1>
                        <p className="text-gray-600">Canvas with mock data - no database dependencies</p>
                      </div>
                      <button
                        onClick={() => setShowUnified(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Test Unified UI
                      </button>
                    </div>
                  </div>
                  <ErrorBoundary level="feature" name="Canvas">
                    <div className="h-[calc(100vh-120px)]">
                      <Canvas />
                    </div>
                  </ErrorBoundary>
                </div>
                <NotificationSystem />
              </PAFVProvider>
            </FilterProvider>
          </AppStateProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default MVPDemo;