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
  postMessage(message: any): Promise<any>;
  sendMessage(message: any): Promise<any>;
  addMessageListener(listener: (message: any) => void): void;
  removeMessageListener(listener: (message: any) => void): void;

  // Additional methods for compatibility
  sendTransactionMessage?(message: any): Promise<any>;
  liveData?: any;

  // Additional properties for compatibility
  database?: any;
  d3rendering?: any;
  transaction?: any;
}

class WebViewBridgeStub implements WebViewBridge {
  // Additional properties for compatibility
  database?: any;
  d3rendering?: any;
  transaction?: any;
  liveData?: any;

  isAvailable(): boolean {
    // Bridge eliminated - always false
    return false;
  }

  async postMessage(message: any): Promise<any> {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message ignored:', { message });
    return null;
  }

  async sendMessage(message: any): Promise<any> {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - sendMessage ignored:', { message });
    return null;
  }

  addMessageListener(_listener: (message: any) => void): void {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message listener ignored');
  }

  removeMessageListener(_listener: (message: any) => void): void {
    // No-op: Bridge eliminated
    bridgeLogger.debug('Bridge eliminated - message listener removal ignored');
  }

  async sendTransactionMessage(message: any): Promise<any> {
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
export function postMessage(message: any): Promise<any> {
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