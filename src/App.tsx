import MVPDemo from './MVPDemo';
import SQLiteV4TestApp from './SQLiteV4TestApp';

function App() {
  // TEMP: Test sql.js integration before full integration
  const isTestMode = new URLSearchParams(window.location.search).get('test') === 'sqlite';

  if (isTestMode) {
    return <SQLiteV4TestApp />;
  }

  // GSD: Use MVPDemo view switcher with notebook mode and UnifiedApp access
  return <MVPDemo />;
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
