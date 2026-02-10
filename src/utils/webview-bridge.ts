/**
 * WebView Bridge Stub - Bridge Eliminated
 *
 * This is a minimal stub implementation to eliminate TS2307 errors.
 * The original WebView bridge is eliminated in favor of sql.js direct access.
 */

import { bridgeLogger } from '@/utils/logging/dev-logger';

export interface Environment {
  isNative: boolean;
  platform: 'ios' | 'macos' | 'web';
  version: string;
  isWebView?: boolean;
}

export interface WebViewBridge {
  isAvailable(): boolean;
  postMessage(message: unknown): Promise<any>;
  sendMessage(message: unknown): Promise<any>;
  addMessageListener(listener: (message: unknown) => void): void;
  removeMessageListener(listener: (message: unknown) => void): void;

  // Additional methods for compatibility
  sendTransactionMessage?(message: unknown): Promise<any>;
  liveData?: unknown;

  // Additional properties for compatibility
  database?: unknown;
  d3rendering?: unknown;
  transaction?: unknown;
}

class WebViewBridgeStub implements WebViewBridge {
  // Additional properties for compatibility
  database?: unknown;
  d3rendering?: unknown;
  transaction?: unknown;
  liveData?: unknown;

  isAvailable(): boolean {
    // Bridge eliminated - always false
    return false;
  }

  async postMessage(message: unknown): Promise<any> {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message ignored:', { message });
    return null;
  }

  async sendMessage(message: unknown): Promise<any> {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - sendMessage ignored:', { message });
    return null;
  }

  addMessageListener(_listener: (message: unknown) => void): void {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message listener ignored');
  }

  removeMessageListener(_listener: (message: unknown) => void): void {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message listener removal ignored');
  }

  async sendTransactionMessage(message: unknown): Promise<any> {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - sendTransactionMessage ignored:', { message });
    return null;
  }
}

/**
 * Get webview bridge (stub - returns disabled bridge)
 */
export function getWebViewBridge(): WebViewBridge {
  return new WebViewBridgeStub();
}

/**
 * Get current environment (stub - returns web environment)
 */
export function getEnvironment(): Environment {
  return {
    isNative: false, // Bridge eliminated - always web
    platform: 'web',
    version: 'v4-bridge-eliminated',
    isWebView: false
  };
}

/**
 * Post message to bridge (stub - no-op)
 */
export function postMessage(message: unknown): Promise<any> {
  bridgeLogger.debug('Bridge eliminated - postMessage ignored:', { message });
  return Promise.resolve(null);
}

// Legacy exports for compatibility
export const Environment = {
  isNative: false,
  platform: 'web' as const,
  version: 'v4-bridge-eliminated',
  isWebView: false
};

export const webViewBridge = new WebViewBridgeStub();