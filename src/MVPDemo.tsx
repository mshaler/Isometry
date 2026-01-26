import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './contexts/PAFVContext';
import { Canvas } from './components/Canvas';

/**
 * Minimal MVP Demo - bypasses all complex dependencies
 * Just shows Canvas with mock data to prove visualization works
 */
function MVPDemo() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <FilterProvider>
            <PAFVProvider>
              <div className="h-screen bg-gray-50">
                <div className="p-4">
                  <h1 className="text-2xl font-bold mb-4">Isometry MVP Demo</h1>
                  <p className="text-gray-600 mb-4">Canvas with mock data - no database dependencies</p>
                </div>
                <div className="h-[calc(100vh-120px)]">
                  <Canvas />
                </div>
              </div>
            </PAFVProvider>
          </FilterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default MVPDemo;