// import MVPDemo from './MVPDemo'; // TEMP: Disabled due to TypeScript import issues
// import SQLiteV4TestApp from './SQLiteV4TestApp'; // TEMP: Disabled due to broken SQLiteProvider
import { SQLiteP0GateTest } from './SQLiteP0GateTest';
import SuperGridSQLDemo from './components/SuperGridSQLDemo';
import { SuperGridScrollTest } from './components/supergrid/SuperGridScrollTest';
import { SQLiteProvider } from './db/SQLiteProvider';
import { CLIIntegrationTest } from './CLIIntegrationTest';
import { NotebookLayout } from './components/notebook/NotebookLayout';
import { NotebookProvider } from './contexts/NotebookContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FilterProvider } from './contexts/FilterContext';
import { PAFVProvider } from './state/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { AppStateProvider } from './contexts/AppStateContext';
import { Navigator } from './components/Navigator';
import { IntegratedLayout } from './components/IntegratedLayout';
import { useNodeDeepLink } from './hooks/ui/useNodeDeepLink';

/**
 * DeepLinkHandler - Component that handles node deep linking via URL params
 *
 * This must be inside SQLiteProvider and SelectionProvider to access:
 * - db from SQLiteProvider (to validate node exists)
 * - select/scrollToNode from SelectionProvider (to select and scroll to node)
 *
 * @see Phase 78-01: URL Deep Linking
 */
function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  useNodeDeepLink();
  return <>{children}</>;
}

function App() {
  // TEMP: Disabled while imports are broken
  // const isDesktop = useIsDesktop();
  // if (isDesktop) {
  //   return <DesktopApp />;
  // }

  // TEMP: Test sql.js integration before full integration
  const testMode = new URLSearchParams(window.location.search).get('test');

  if (testMode === 'sqlite') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">SQLite Test Disabled</h1>
        <p className="text-gray-600 mb-4">
          SQLite test temporarily disabled due to broken SQLiteProvider dependencies.
          Use P0 test instead: <a href="?test=p0" className="text-blue-600 underline">?test=p0</a>
        </p>
      </div>
    );
  }

  if (testMode === 'p0') {
    return <SQLiteP0GateTest />;
  }

  if (testMode === 'supergrid') {
    return (
      <SQLiteProvider>
        <SuperGridSQLDemo />
      </SQLiteProvider>
    );
  }

  // Phase 92: Focused SuperGrid scroll test with alto-index data
  // Verifies CELL-02 (CSS sticky header scroll coordination)
  if (testMode === 'sg-scroll') {
    return (
      <SQLiteProvider>
        <SuperGridScrollTest />
      </SQLiteProvider>
    );
  }

  if (testMode === 'cli-test') {
    return <CLIIntegrationTest />;
  }

  // Phase 96: Isolated Notebook test page (Capture, Shell, Preview only)
  // No SuperGrid or other complex components - pure notebook debugging
  if (testMode === 'notebook') {
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <SelectionProvider>
                <NotebookProvider>
                  <div className="h-screen w-screen bg-gray-900 flex flex-col">
                    {/* Header */}
                    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4">
                      <h1 className="text-white font-semibold">Notebook Test Page</h1>
                      <span className="ml-4 text-gray-400 text-sm">
                        Isolated testing for Capture, Shell, and Preview
                      </span>
                      <a
                        href="/"
                        className="ml-auto text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Back to Main
                      </a>
                    </div>

                    {/* Notebook Layout - Full Height */}
                    <div className="flex-1 p-2 overflow-hidden">
                      <NotebookLayout />
                    </div>

                    {/* Footer with instructions */}
                    <div className="h-10 bg-gray-800 border-t border-gray-700 flex items-center px-4 text-xs text-gray-400">
                      <span>Cmd+1 (Capture) | Cmd+2 (Shell) | Cmd+3 (Preview) | Cmd+S (Save) | Type / for commands</span>
                    </div>
                  </div>
                </NotebookProvider>
              </SelectionProvider>
            </PAFVProvider>
          </ThemeProvider>
        </FilterProvider>
      </SQLiteProvider>
    );
  }

  if (testMode === 'three-canvas') {
    // SYNC-03: SelectionProvider enables cross-canvas selection synchronization
    // All notebook canvases (Capture, Shell, Preview) share the same selection state
    // Phase 78-01: Deep linking via ?nodeId= parameter
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <SelectionProvider>
                <DeepLinkHandler>
                  <NotebookProvider>
                    <NotebookLayout />
                  </NotebookProvider>
                </DeepLinkHandler>
              </SelectionProvider>
            </PAFVProvider>
          </ThemeProvider>
        </FilterProvider>
      </SQLiteProvider>
    );
  }

  if (testMode === 'navigator') {
    // Reset IndexedDB if requested
    // NOTE: Database name is hardcoded in IndexedDBPersistence.ts as 'isometry-db'
    const resetDb = new URLSearchParams(window.location.search).get('reset') === 'true';
    if (resetDb) {
      indexedDB.deleteDatabase('isometry-db');
      window.location.href = '?test=navigator';
      return <div className="p-4">Resetting database...</div>;
    }
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <AppStateProvider>
                <div className="min-h-screen bg-gray-100">
                  <Navigator />
                  <div className="p-4 text-sm text-gray-600">
                    Click the chevron button to expand/collapse PAFV controls.
                    <br />
                    Drag facets from LATCH buckets to plane drop zones (X, Y, Color).
                    <br /><br />
                    <a href="?test=navigator&reset=true" className="text-blue-600 underline">Reset database</a> if you see errors.
                  </div>
                </div>
              </AppStateProvider>
            </PAFVProvider>
          </ThemeProvider>
        </FilterProvider>
      </SQLiteProvider>
    );
  }

  // Phase 57: Integrated Navigator + SuperGrid + DensitySlider layout
  // Phase 80-01: NotebookProvider added for Notebook Integration
  if (testMode === 'integrated') {
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <SelectionProvider>
                <AppStateProvider>
                  <NotebookProvider>
                    <DeepLinkHandler>
                      <IntegratedLayout />
                    </DeepLinkHandler>
                  </NotebookProvider>
                </AppStateProvider>
              </SelectionProvider>
            </PAFVProvider>
          </ThemeProvider>
        </FilterProvider>
      </SQLiteProvider>
    );
  }

  // Default: IntegratedLayout (no ?test= param required)
  // Phase 78-01: Deep linking via ?nodeId= parameter
  // Phase 80-01: NotebookProvider added for Notebook Integration
  return (
    <SQLiteProvider>
      <FilterProvider>
        <ThemeProvider>
          <PAFVProvider>
            <SelectionProvider>
              <AppStateProvider>
                <NotebookProvider>
                  <DeepLinkHandler>
                    <IntegratedLayout />
                  </DeepLinkHandler>
                </NotebookProvider>
              </AppStateProvider>
            </SelectionProvider>
          </PAFVProvider>
        </ThemeProvider>
      </FilterProvider>
    </SQLiteProvider>
  );
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
