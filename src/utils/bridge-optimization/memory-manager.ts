/**
 * Memory Manager Stub - Bridge Eliminated
 *
 * This is a minimal stub implementation to eliminate TS2307 errors.
 * The original bridge-based memory management is replaced with no-ops
 * since sql.js operates in the same memory space as D3.js.
 */

import { bridgeLogger } from '@/utils/logging/dev-logger';

export interface MemoryMetrics {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  bridgeOverhead: number;
  usedJSHeapSize: number;
  pressureLevel: 'low' | 'medium' | 'high';
}

export interface MemoryPressureCallback {
  (metrics: MemoryMetrics, activeCallbacks: number): void;
}

export interface BridgeCallback {
  id: string;
  cleanup: () => void;
}

class MemoryManagerStub {
  /**
   * Add memory pressure callback (stub - no-op)
   */
  addMemoryPressureCallback(_callback: MemoryPressureCallback): void {
    // No-op: Bridge eliminated, no memory pressure monitoring needed
    bridgeLogger.debug('Bridge eliminated - memory pressure callback ignored');
  }

  /**
   * Register bridge callback (stub - no-op)
   */
  registerBridgeCallback(_callback: BridgeCallback): void {
    // No-op: Bridge eliminated, no callbacks to register
    bridgeLogger.debug('Bridge eliminated - callback registration ignored');
  }

  /**
   * Cleanup bridge callbacks (stub - no-op)
   */
  cleanupBridgeCallbacks(): void {
    // No-op: Bridge eliminated, no cleanup needed
    bridgeLogger.debug('Bridge eliminated - callback cleanup ignored');
  }

  /**
   * Get memory metrics (stub - returns mock data)
   */
  getMemoryMetrics(): MemoryMetrics {
    return {
      totalMemory: 0,
      usedMemory: 0,
      availableMemory: 0,
      bridgeOverhead: 0, // Bridge eliminated
      usedJSHeapSize: 0,
      pressureLevel: 'low' as const
    };
  }
}

export const memoryManager = new MemoryManagerStub();