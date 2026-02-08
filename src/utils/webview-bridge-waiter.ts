/**
 * WebView Bridge Waiter - Bridge Elimination Stub
 *
 * This module provides a compatibility layer for components that expect
 * bridge functionality. In the v4 architecture, there is no bridge.
 */

export interface BridgeStatus {
  isAvailable: boolean;
  isReady: boolean;
  error?: string;
}

/**
 * Wait for WebView bridge to be available (v4: always resolves immediately)
 * Bridge eliminated - this is a compatibility stub
 */
export async function waitForWebViewBridge(_timeoutMs: number = 1000): Promise<BridgeStatus> {
  // In v4, there's no bridge to wait for - sql.js runs in the same context
  return Promise.resolve({
    isAvailable: false, // Bridge is eliminated
    isReady: false,
    error: 'Bridge eliminated in v4 - using direct sql.js integration'
  });
}

/**
 * Check if bridge is currently available (v4: always false)
 */
export function isBridgeAvailable(): boolean {
  return false; // Bridge eliminated
}

/**
 * Get current bridge status (v4: always reports eliminated)
 */
export function getBridgeStatus(): BridgeStatus {
  return {
    isAvailable: false,
    isReady: false,
    error: 'Bridge eliminated in v4 architecture'
  };
}

/**
 * Legacy bridge initialization (v4: no-op)
 */
export async function initializeBridge(): Promise<void> {
  // No-op in v4 - bridge eliminated
  console.warn('[Bridge] Bridge initialization called but bridge is eliminated in v4');
}