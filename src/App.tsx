import MVPDemo from './MVPDemo';
import SQLiteV4TestApp from './SQLiteV4TestApp';
import { SQLiteP0GateTest } from './SQLiteP0GateTest';

function App() {
  // TEMP: Test sql.js integration before full integration
  const testMode = new URLSearchParams(window.location.search).get('test');

  if (testMode === 'sqlite') {
    return <SQLiteV4TestApp />;
  }

  if (testMode === 'p0') {
    return <SQLiteP0GateTest />;
  }

  if (testMode === 'supergrid') {
    // This would need a database instance - for now show message
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">SuperGrid v4 Direct Test</h1>
        <p className="text-gray-600 mb-4">
          Direct SuperGrid test requires database initialization.
          Use the P0 test instead: <a href="?test=p0" className="text-blue-600 underline">?test=p0</a>
        </p>
        <p className="text-sm text-gray-500">
          The P0 test includes both foundation verification AND live SuperGrid demo.
        </p>
      </div>
    );
  }

  // GSD: Use MVPDemo view switcher with notebook mode and UnifiedApp access
  return <MVPDemo />;
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
