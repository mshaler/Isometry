/**
 * WebView Bridge Waiter
 *
 * Waits for the native WebView bridge to be fully initialized before React
 * components try to detect it. This solves timing issues where React loads
 * before the Swift bridge injection scripts complete.
 */

import { devLogger } from './dev-logger';

export async function waitForWebViewBridge(timeoutMs: number = 5000): Promise<boolean> {
  devLogger.setup('Waiting for WebView bridge initialization', {});

  const startTime = Date.now();

  return new Promise((resolve) => {
    function checkBridge() {
      const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';
      const hasMessageHandlers = typeof window !== 'undefined' && typeof window.webkit?.messageHandlers !== 'undefined';
      const hasIsometryBridge = typeof (window as any)._isometryBridge !== 'undefined';
      const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
      const isIsometryNative = userAgent.includes('IsometryNative');

      devLogger.inspect('Bridge check', {
        hasWebKit,
        hasMessageHandlers,
        hasIsometryBridge,
        isIsometryNative,
        userAgent: userAgent.substring(0, 50) + '...',
        handlers: hasMessageHandlers ? Object.keys(window.webkit!.messageHandlers) : []
      });

      // Consider bridge ready if we have either webkit.messageHandlers OR IsometryNative user agent
      if (hasWebKit && hasMessageHandlers) {
        devLogger.setup('WebView bridge detected via webkit.messageHandlers', {});
        resolve(true);
        return;
      }

      if (isIsometryNative) {
        devLogger.setup('WebView bridge detected via IsometryNative user agent', {});
        resolve(true);
        return;
      }

      // Check if timeout exceeded
      if (Date.now() - startTime > timeoutMs) {
        console.log('⏰ WebView bridge detection timeout - assuming regular browser');
        resolve(false);
        return;
      }

      // Try again in 100ms
      setTimeout(checkBridge, 100);
    }

    // Start checking immediately
    checkBridge();

    // Also listen for the bridge ready event
    if (typeof window !== 'undefined') {
      window.addEventListener('isometry-bridge-ready', () => {
        console.log('📡 Received isometry-bridge-ready event');
        resolve(true);
      });
    }
  });
}

export function isWebViewEnvironmentImmediate(): boolean {
  const hasWebKit = typeof window !== 'undefined' && typeof window.webkit !== 'undefined';
  const hasMessageHandlers = typeof window !== 'undefined' && typeof window.webkit?.messageHandlers !== 'undefined';
  const isIsometryNative = typeof window !== 'undefined' && navigator.userAgent.includes('IsometryNative');

  return hasWebKit && hasMessageHandlers || isIsometryNative;
}