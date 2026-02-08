/**
 * Performance Monitor Stub - Bridge Eliminated
 *
 * This is a minimal stub implementation to eliminate TS2307 errors.
 * The original bridge-based performance monitoring is replaced with no-ops
 * since sql.js operates in the same memory space as D3.js.
 */

export interface PerformanceMetrics {
  bridgeLatency: number;
  queryTime: number;
  renderTime: number;
  memoryUsage: number;
}

export interface PerformanceCallback {
  (metrics: PerformanceMetrics): void;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance tracking (stub - no-op)
   */
  startTracking(_label: string): string {
    // No-op: Bridge eliminated, no bridge performance to track
    return `stub_${Date.now()}`;
  }

  /**
   * End performance tracking (stub - no-op)
   */
  endTracking(_trackingId: string): PerformanceMetrics {
    return {
      bridgeLatency: 0, // Bridge eliminated
      queryTime: 0,
      renderTime: 0,
      memoryUsage: 0
    };
  }

  /**
   * Add performance callback (stub - no-op)
   */
  addCallback(_callback: PerformanceCallback): void {
    // No-op: Bridge eliminated, no performance monitoring needed
    console.log('[PerformanceMonitor] Bridge eliminated - performance callback ignored');
  }

  /**
   * Remove all callbacks (stub - no-op)
   */
  clearCallbacks(): void {
    // No-op: Bridge eliminated, no callbacks to clear
  }

  /**
   * Get current metrics (stub - returns mock data)
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      bridgeLatency: 0, // Bridge eliminated
      queryTime: 0,
      renderTime: 0,
      memoryUsage: 0
    };
  }
}