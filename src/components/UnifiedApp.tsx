import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { EnvironmentProvider } from '../contexts/EnvironmentContext';
import { AppStateProvider } from '../contexts/AppStateContext';
import { FilterProvider } from '../contexts/FilterContext';
import { PAFVProvider } from '../contexts/PAFVContext';
import { NotebookProvider } from '../contexts/NotebookContext';
import { DatabaseProvider } from '../db/DatabaseContext';

// Import all Figma components
import { Toolbar } from './Toolbar';
import { Navigator } from './Navigator';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { Canvas } from './Canvas';
import { NavigatorFooter } from './NavigatorFooter';
import { CommandBar } from './CommandBar';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { NotificationSystem } from './ui/NotificationSystem';
import { CacheInvalidationProvider } from '../hooks/useCacheInvalidation';

/**
 * Unified App Component
 *
 * Combines our working MVP Canvas with all Figma-designed UI components
 * following the architectural layout:
 *
 * - Toolbar (menu + commands)
 * - Navigator (app/view selectors)
 * - PAFVNavigator (axis wells)
 * - MainContent
 *   - Sidebar (LATCH filters)
 *   - Canvas (with MVP data visualization)
 *   - RightSidebar (formats/settings)
 * - NavigatorFooter (map + time)
 * - CommandBar (DSL input)
 */
export function UnifiedApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <EnvironmentProvider>
          <DatabaseProvider>
            <NotebookProvider>
              <CacheInvalidationProvider>
                <AppStateProvider>
                  <FilterProvider>
                    <PAFVProvider>
                  <div className="h-screen flex flex-col bg-gray-50">
                    {/* Toolbar: Menu bar + command buttons */}
                    <ErrorBoundary level="component" name="Toolbar">
                      <Toolbar />
                    </ErrorBoundary>

                    {/* Navigator: App/View/Dataset selectors */}
                    <ErrorBoundary level="component" name="Navigator">
                      <Navigator />
                    </ErrorBoundary>

                    {/* PAFVNavigator: Already included in Navigator component above */}

                    {/* Main Content Area */}
                    <div className="flex-1 flex min-h-0">
                      {/* Left Sidebar: LATCH filters + Templates */}
                      <ErrorBoundary level="feature" name="Sidebar">
                        <Sidebar />
                      </ErrorBoundary>

                      {/* Central Canvas: Main data visualization */}
                      <div className="flex-1 flex flex-col">
                        <ErrorBoundary level="feature" name="Canvas">
                          <Canvas />
                        </ErrorBoundary>
                      </div>

                      {/* Right Sidebar: Formats + Settings */}
                      <ErrorBoundary level="feature" name="RightSidebar">
                        <RightSidebar />
                      </ErrorBoundary>
                    </div>

                    {/* Navigator Footer: Location map + Time slider */}
                    <ErrorBoundary level="component" name="NavigatorFooter">
                      <NavigatorFooter />
                    </ErrorBoundary>

                    {/* Command Bar: DSL command input */}
                    <ErrorBoundary level="feature" name="CommandBar">
                      <CommandBar />
                    </ErrorBoundary>
                  </div>
                  <NotificationSystem />
                    </PAFVProvider>
                  </FilterProvider>
                </AppStateProvider>
              </CacheInvalidationProvider>
            </NotebookProvider>
          </DatabaseProvider>
        </EnvironmentProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
