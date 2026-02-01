import { useEffect } from 'react';
import MVPDemo from './MVPDemo';
import { useMemoryMonitor } from './utils/memory-management';

function App() {
  // Global memory management and monitoring
  const { getMemoryMetrics, setWarningCallback } = useMemoryMonitor({
    warningThreshold: 50,
    criticalThreshold: 100,
    monitoringInterval: 15000, // Check every 15 seconds
    enableLogging: true
  });

  // Set up global memory pressure detection
  useEffect(() => {
    setWarningCallback((metrics) => {
      console.warn('[App] Global memory pressure detected:', {
        usage: `${metrics.usedJSHeapSize.toFixed(1)}MB`,
        pressure: metrics.pressureLevel,
        bridgeRefs: metrics.estimatedBridgeReferences
      });

      // Trigger global cleanup in critical situations
      if (metrics.pressureLevel === 'critical') {
        // Force garbage collection if available
        if ('gc' in window && typeof (window as any).gc === 'function') {
          (window as any).gc();
          console.log('[App] Triggered garbage collection due to critical memory pressure');
        }
      }
    });
  }, [setWarningCallback]);

  // GSD: Use MVPDemo view switcher with notebook mode and UnifiedApp access
  return <MVPDemo />;
}

// Original complex App implementation moved to separate file for future restoration
// See docs/specs/app-architecture.md for complete component hierarchy

export default App;
