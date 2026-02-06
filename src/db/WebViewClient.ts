/**
 * DEPRECATED: WebViewClient (Bridge Elimination v4)
 *
 * This file is deprecated as of Isometry v4 Bridge Elimination architecture.
 *
 * OLD ARCHITECTURE (40KB bridge overhead):
 * SQLite -> SQLite.swift -> MessageBridge.swift -> WKWebView -> D3.js
 *
 * NEW ARCHITECTURE (zero bridge overhead):
 * SQLite file -> sql.js (WASM, in-browser) -> D3.js
 *
 * MIGRATION:
 * - Replace WebViewClient usage with DatabaseService from './DatabaseService'
 * - Use useSQLite() hook instead of bridge context
 * - Direct synchronous queries: db.query() not bridge.postMessage()
 *
 * See: docs/specs/v4 specs/BRIDGE-ELIMINATION-ARCHITECTURE.md
 */

export class WebViewClient {
  constructor() {
    throw new Error(
      'WebViewClient is DEPRECATED in Isometry v4. Use DatabaseService with sql.js instead. ' +
      'See docs/specs/v4 specs/BRIDGE-ELIMINATION-ARCHITECTURE.md for migration guide.'
    );
  }
}

// Legacy exports for backward compatibility during migration
export interface ConnectionStatus {
  isConnected: boolean;
  lastPing?: Date;
  pendingRequests: number;
  transport: 'webview' | 'fallback';
}

/**
 * @deprecated Use useSQLite() from SQLiteProvider instead
 */
export async function createWebViewClient(): Promise<never> {
  throw new Error(
    'createWebViewClient is DEPRECATED in Isometry v4. ' +
    'Use SQLiteProvider and useSQLite() hook for direct sql.js access. ' +
    'Bridge elimination eliminates 40KB of MessageBridge overhead.'
  );
}

/**
 * @deprecated Use useSQLite() from SQLiteProvider instead
 */
export async function isWebViewBridgeAvailable(): Promise<false> {
  console.warn(
    'isWebViewBridgeAvailable is DEPRECATED. Bridge eliminated in v4. ' +
    'Use SQLiteProvider for direct sql.js database access.'
  );
  return false;
}