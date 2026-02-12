// import MVPDemo from './MVPDemo'; // TEMP: Disabled due to TypeScript import issues
// import SQLiteV4TestApp from './SQLiteV4TestApp'; // TEMP: Disabled due to broken SQLiteProvider
import { SQLiteP0GateTest } from './SQLiteP0GateTest';
import SuperGridSQLDemo from './components/SuperGridSQLDemo';
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

  if (testMode === 'cli-test') {
    return <CLIIntegrationTest />;
  }

  if (testMode === 'three-canvas') {
    // SYNC-03: SelectionProvider enables cross-canvas selection synchronization
    // All notebook canvases (Capture, Shell, Preview) share the same selection state
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <SelectionProvider>
                <NotebookProvider>
                  <NotebookLayout />
                </NotebookProvider>
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
  if (testMode === 'integrated') {
    return (
      <SQLiteProvider>
        <FilterProvider>
          <ThemeProvider>
            <PAFVProvider>
              <AppStateProvider>
                <IntegratedLayout />
              </AppStateProvider>
            </PAFVProvider>
          </ThemeProvider>
        </FilterProvider>
      </SQLiteProvider>
    );
  }

  // TEMP: Redirect to P0 test until TypeScript cleanup is complete
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Isometry v4 - Bridge Elimination</h1>
      <p className="text-gray-600 mb-4">
        TypeScript cleanup in progress. Available tests:
      </p>
      <div className="space-y-2">
        <div><a href="?test=integrated" className="text-blue-600 underline font-bold">🎯 Integrated Layout</a> - Phase 57 Navigator + SuperGrid + Density</div>
        <div><a href="?test=p0" className="text-blue-600 underline">P0 Gate Test</a> - Foundation verification + SuperGrid v4 demo</div>
        <div><a href="?test=supergrid" className="text-blue-600 underline">SuperGrid + sql.js + FTS5</a> - Complete integration demonstration</div>
        <div><a href="?test=cli-test" className="text-blue-600 underline font-bold">🧪 CLI Integration Test</a> - Verify Phase 3 Claude CLI integration</div>
        <div><a href="?test=three-canvas" className="text-blue-600 underline">Three-Canvas Notebook</a> - Complete three-canvas integration demo</div>
        <div><a href="?test=navigator" className="text-blue-600 underline font-bold">🧭 Navigator Test</a> - Phase 51 Navigator UI Integration</div>
        <div><a href="?test=sqlite" className="text-blue-600 underline">SQLite Test</a> - sql.js integration testing</div>
      </div>
    </div>
  );
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
