// Debug script to check SuperGrid data flow
// Run this in browser console after navigating to Supergrid view

console.log('=== SuperGrid Debug Information ===');

// Check if React DevTools hooks are available
if (window.React && window.React.version) {
  console.log('React version:', window.React.version);
}

// Check for any SuperGrid-related elements
const superGridElements = document.querySelectorAll('[class*="SuperGrid"], [class*="supergrid"], [data-testid*="supergrid"]');
console.log('SuperGrid elements found:', superGridElements.length);
superGridElements.forEach((el, i) => {
  console.log(`  Element ${i + 1}:`, el);
});

// Check for D3 elements
const d3Elements = document.querySelectorAll('svg, [class*="d3-"]');
console.log('D3/SVG elements found:', d3Elements.length);

// Check for any error messages
const errorElements = document.querySelectorAll('[class*="error"], .text-red-600');
console.log('Error elements found:', errorElements.length);
errorElements.forEach((el, i) => {
  console.log(`  Error ${i + 1}:`, el.textContent);
});

// Check for loading states
const loadingElements = document.querySelectorAll('[class*="loading"], .text-gray-600');
console.log('Loading elements found:', loadingElements.length);

// Check for "No nodes found" message
const noNodesElements = document.querySelectorAll('[class*="gray-400"]');
console.log('Gray text elements (potential "No nodes found"):', noNodesElements.length);
noNodesElements.forEach((el, i) => {
  console.log(`  Text ${i + 1}:`, el.textContent);
});

// Check current URL and view mode
console.log('Current location:', window.location.href);

// Look for view buttons
const viewButtons = document.querySelectorAll('button[class*="blue"], button[class*="bg-"]');
console.log('View buttons found:', viewButtons.length);
viewButtons.forEach((btn, i) => {
  console.log(`  Button ${i + 1}:`, btn.textContent, 'active:', btn.classList.contains('bg-blue-600'));
});

console.log('=== End Debug Information ===');