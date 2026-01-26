import MVPDemo from './MVPDemo';

function App() {
  // GSD: Use working MVP demo with UnifiedApp accessible via "Unified" button
  // This provides clean testing environment without complex context dependencies
  return <MVPDemo />;
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;