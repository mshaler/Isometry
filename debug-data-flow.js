// Quick debug script to check data sources
// Run in browser console on http://localhost:5175

console.log('=== DEBUGGING DATA FLOW ===');

// Check if FallbackDatabaseProvider is loaded
console.log('1. Environment detection:');
console.log('Window objects:', {
  webkit: typeof window.webkit !== 'undefined',
  userAgent: navigator.userAgent,
  hasWebKitHandlers: typeof window.webkit?.messageHandlers !== 'undefined'
});

// Check what SuperGrid is actually showing
console.log('2. Check SuperGrid DOM:');
const superGridElement = document.querySelector('.d3-sparsity-layer, .sparsity-container');
console.log('SuperGrid DOM found:', !!superGridElement);

// Check console for specific log patterns
console.log('3. Check for debug logs:');
console.log('Look for these patterns in console:');
console.log('- [FallbackDB] Query executed');
console.log('- 🎯 SuperGridView Live Debug');
console.log('- Using Fallback Database');
console.log('- useDemoData vs sample-data');

// Check active view
console.log('4. Check active view:');
const urlParams = new URLSearchParams(window.location.search);
console.log('URL params:', {
  view: urlParams.get('view'),
  app: urlParams.get('app'),
  dataset: urlParams.get('dataset')
});

console.log('5. Manual data check:');
console.log('If you see this in console, check for:');
console.log('- 100 nodes = FallbackDB working (sample-data.ts)');
console.log('- 110 nodes = Demo fallback active (useDemoData.ts)');
console.log('- 0 nodes = Query failing');

console.log('=== END DEBUG SCRIPT ===');