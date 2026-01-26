import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { EnvironmentProvider } from '../contexts/EnvironmentContext';
import { AppStateProvider } from '../contexts/AppStateContext';
import { FilterProvider } from '../contexts/FilterContext';
import { PAFVProvider } from '../contexts/PAFVContext';

// Import all Figma components
import { Toolbar } from './Toolbar';
import { Navigator } from './Navigator';
import { PAFVNavigator } from './PAFVNavigator';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { Canvas } from './Canvas';
import { NavigatorFooter } from './NavigatorFooter';
import { CommandBar } from './CommandBar';

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
          <AppStateProvider>
            <FilterProvider>
              <PAFVProvider>
              <div className="h-screen flex flex-col bg-gray-50">
                {/* Toolbar: Menu bar + command buttons */}
                <Toolbar />

                {/* Navigator: App/View/Dataset selectors */}
                <Navigator />

                {/* PAFVNavigator: Drag-drop axis assignment wells */}
                <PAFVNavigator />

                {/* Main Content Area */}
                <div className="flex-1 flex min-h-0">
                  {/* Left Sidebar: LATCH filters + Templates */}
                  <Sidebar />

                  {/* Central Canvas: Main data visualization */}
                  <div className="flex-1 flex flex-col">
                    <Canvas />
                  </div>

                  {/* Right Sidebar: Formats + Settings */}
                  <RightSidebar />
                </div>

                {/* Navigator Footer: Location map + Time slider */}
                <NavigatorFooter />

                {/* Command Bar: DSL command input */}
                <CommandBar />
              </div>
              </PAFVProvider>
            </FilterProvider>
          </AppStateProvider>
        </EnvironmentProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}