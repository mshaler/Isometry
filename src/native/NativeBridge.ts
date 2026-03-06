// Isometry v5 — Phase 12 NativeBridge
// JS-side bridge for WKWebView communication.
//
// Provides bidirectional messaging between the web runtime and Swift shell.
// All JS→Swift messages flow through window.webkit.messageHandlers.nativeBridge.
// All Swift→JS messages arrive via window.__isometry.receive().
//
// Requirements addressed:
//   - BRDG-01: Sends native:ready signal; receives LaunchPayload from Swift
//   - BRDG-02: Converts Uint8Array to base64 before posting checkpoint data
//   - BRDG-03: Forwards native:action messages to appropriate handlers (FILE-03)
//   - BRDG-04: Receives native:sync messages from CloudKit (stub)
//
// CRITICAL: Never post raw Uint8Array via nativeBridge.postMessage —
// WKScriptMessageHandler receives it as { "0": 0, "1": 1, ... } dictionary.
// Always convert to base64 first.

import type { WorkerBridge } from '../worker/WorkerBridge';
import type { SourceType, CanonicalCard } from '../etl/types';

// ---------------------------------------------------------------------------
// WebKit Global Type Declarations
// ---------------------------------------------------------------------------
// These APIs are available at runtime inside WKWebView. TypeScript
// doesn't know about them, so we declare them here.

declare global {
  interface Window {
    webkit?: {
      messageHandlers: {
        nativeBridge: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** LaunchPayload sent by Swift after receiving native:ready signal */
export interface LaunchPayload {
  /** Base64-encoded SQLite database bytes, or null on first launch */
  dbData: string | null;
  /** Platform: 'ios' | 'macos' */
  platform: string;
  /** Tier: 'free' (TIER-03 fills this in Phase 14) */
  tier: string;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Safe area insets (iOS only; all zero on macOS) */
  safeAreaInsets: { top: number; right: number; bottom: number; left: number };
}

// ---------------------------------------------------------------------------
// Exported Utility Functions (BRDG-02)
// ---------------------------------------------------------------------------

/**
 * Convert a Uint8Array to a base64 string for WKScriptMessageHandler transport.
 *
 * CRITICAL: Never post raw Uint8Array via nativeBridge.postMessage.
 * WKScriptMessageHandler receives it as a dictionary { "0": byte0, ... }.
 * This function ensures binary data survives the JS→Swift bridge intact.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return '';
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 * Used when receiving dbData from Swift's LaunchPayload.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (base64.length === 0) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Mutating operation types for mutation hook
// ---------------------------------------------------------------------------

/**
 * Set of WorkerRequestType values that mutate database state.
 * The mutation hook posts 'mutated' to nativeBridge after any of these.
 * Read-only operations (db:query, card:get, card:list, search:cards, etc.)
 * are intentionally excluded.
 */
const MUTATING_TYPES = new Set<string>([
  'card:create',
  'card:update',
  'card:delete',
  'card:undelete',
  'connection:create',
  'connection:delete',
  'db:exec',
  'etl:import',
  'etl:import-native',  // Native adapter imports (Phase 33)
]);

// ---------------------------------------------------------------------------
// Chunk accumulator for native imports (Phase 33)
// ---------------------------------------------------------------------------

/**
 * Module-level state for accumulating chunked native import cards.
 * Lives for the duration of a single multi-chunk import sequence.
 * Reset on chunkIndex 0 (new import) and after final chunk completes.
 */
let chunkAccumulator: CanonicalCard[] = [];
let activeSourceType: string | null = null;

// ---------------------------------------------------------------------------
// waitForLaunchPayload — Phase 1 of the 2-phase startup flow
// ---------------------------------------------------------------------------

/**
 * Register window.__isometry.receive() and wait for Swift's LaunchPayload.
 *
 * This is the first of two native bridge phases:
 * 1. main.ts calls waitForLaunchPayload() BEFORE creating WorkerBridge
 * 2. On LaunchPayload arrival, returns { dbData, platform, ... }
 * 3. main.ts creates WorkerBridge with the optional dbData bytes
 * 4. main.ts calls initNativeBridge(bridge) for ongoing handlers
 *
 * Guard: only activates when window.location.protocol === 'app:'
 * In browser/test environments, resolves immediately with null dbData.
 */
export function waitForLaunchPayload(): Promise<LaunchPayload> {
  // Guard: non-native environment — resolve with empty payload immediately
  if (window.location.protocol !== 'app:') {
    return Promise.resolve({
      dbData: null,
      platform: 'web',
      tier: 'free',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }

  return new Promise<LaunchPayload>((resolve) => {
    // Register the receive callback that Swift will call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__isometry = (window as any).__isometry ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__isometry.receive = (message: { type: string; payload: unknown }) => {
      if (message.type === 'native:launch') {
        const payload = message.payload as LaunchPayload;
        console.log('[NativeBridge] LaunchPayload received, platform:', payload.platform);
        resolve(payload);
      }
      // Other message types handled by initNativeBridge after bootstrap
    };

    // Signal Swift that JS is ready — Swift responds with LaunchPayload
    window.webkit!.messageHandlers.nativeBridge.postMessage({
      id: crypto.randomUUID(),
      type: 'native:ready',
      payload: {},
      timestamp: Date.now(),
    });

    console.log('[NativeBridge] Sent native:ready, waiting for LaunchPayload');
  });
}

// ---------------------------------------------------------------------------
// initNativeBridge — Phase 2: ongoing handlers after bootstrap
// ---------------------------------------------------------------------------

/**
 * Install ongoing bridge handlers after app bootstrap completes.
 *
 * Called by main.ts AFTER WorkerBridge is ready and all providers are wired.
 * Installs:
 * - Persistent receive handler for native:sync and native:checkpoint-request
 * - Mutation hook on bridge.send() to post 'mutated' after write operations
 * - Exposes sendCheckpoint on window.__isometry for Swift to trigger
 *
 * Guard: no-op when window.location.protocol !== 'app:'
 */
export function initNativeBridge(bridge: WorkerBridge): void {
  // Guard: non-native environment
  if (window.location.protocol !== 'app:') return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iso = (window as any).__isometry as Record<string, unknown>;

  // Install persistent receive handler (replaces the one-time LaunchPayload handler)
  // Use bracket notation to satisfy noUncheckedIndexedAccess strict mode
  iso['receive'] = (message: { type: string; payload: unknown }) => {
    switch (message.type) {
      case 'native:launch':
        // Already handled by waitForLaunchPayload; no-op here
        console.warn('[NativeBridge] Received duplicate native:launch — ignoring');
        break;

      case 'native:sync':
        // Phase 14 stub: CloudKit sync notification
        console.log('[NativeBridge] native:sync received (Phase 14 stub):', message.payload);
        break;

      case 'native:checkpoint-request':
        // Swift is explicitly requesting a checkpoint (e.g., before termination)
        sendCheckpoint(bridge).catch(err =>
          console.error('[NativeBridge] Checkpoint failed:', err)
        );
        break;

      case 'native:action': {
        const payload = message.payload as {
          kind: string;
          data: string;
          source: string;
          filename: string;
        };
        if (payload.kind === 'importFile') {
          handleNativeFileImport(bridge, payload).catch(err =>
            console.error('[NativeBridge] File import failed:', err)
          );
        } else {
          console.warn('[NativeBridge] Unknown native:action kind:', payload.kind);
        }
        break;
      }

      case 'native:import-chunk': {
        const payload = message.payload as {
          chunkIndex: number;
          isLast: boolean;
          cardsBase64: string;
        };
        handleNativeImportChunk(bridge, payload).catch(err =>
          console.error('[NativeBridge] native:import-chunk failed:', err)
        );
        break;
      }

      default:
        console.warn('[NativeBridge] Unknown message type:', message.type);
    }
  };

  // Expose sendCheckpoint on window.__isometry for Swift to trigger via evaluateJavaScript
  iso['sendCheckpoint'] = () => sendCheckpoint(bridge);

  // Install mutation hook: wrap bridge.send() to post 'mutated' after writes
  installMutationHook(bridge);

  console.log('[NativeBridge] Initialized, ongoing handlers active');
}

// ---------------------------------------------------------------------------
// sendCheckpoint — exported for use by initNativeBridge and direct calls
// ---------------------------------------------------------------------------

/**
 * Export the database and send bytes back to Swift as base64.
 *
 * Called either by the mutation-triggered autosave timer (Swift-side) or
 * by the explicit checkpoint request via native:checkpoint-request message.
 */
export async function sendCheckpoint(bridge: WorkerBridge): Promise<void> {
  const dbBytes = await bridge.exportDatabase();
  const base64 = uint8ArrayToBase64(dbBytes);
  window.webkit!.messageHandlers.nativeBridge.postMessage({
    id: crypto.randomUUID(),
    type: 'checkpoint',
    payload: { dbData: base64 },
    timestamp: Date.now(),
  });
  console.log('[NativeBridge] Checkpoint sent (' + dbBytes.byteLength + ' bytes)');
}

// ---------------------------------------------------------------------------
// installMutationHook — wraps bridge.send() to detect writes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// handleNativeFileImport — routes native file import to ETL pipeline
// ---------------------------------------------------------------------------

/**
 * Handle file import from native file picker.
 *
 * Swift sends file data through the native:action bridge message.
 * Text formats (json, csv, markdown) arrive as UTF-8 text strings.
 * Binary formats (xlsx) arrive as base64-encoded strings.
 *
 * Routes to WorkerBridge.importFile() which delegates to the
 * existing ETL pipeline (ImportOrchestrator) in the Web Worker.
 */
async function handleNativeFileImport(
  bridge: WorkerBridge,
  payload: { data: string; source: string; filename: string }
): Promise<void> {
  console.log('[NativeBridge] Importing file:', payload.filename, '(source:', payload.source + ')');

  const result = await bridge.importFile(
    payload.source as SourceType,
    payload.data,
    { filename: payload.filename }
  );

  console.log(
    '[NativeBridge] File import complete:',
    result.inserted, 'inserted,',
    result.updated, 'updated,',
    result.errors, 'errors'
  );
}

// ---------------------------------------------------------------------------
// handleNativeImportChunk — accumulates chunked cards from Swift adapters
// ---------------------------------------------------------------------------

/**
 * Handle a single chunk of native import cards from Swift.
 *
 * Swift sends cards in 200-card chunks via native:import-chunk messages.
 * Each chunk contains base64-encoded JSON array of CanonicalCard objects.
 *
 * Flow:
 * 1. Decode base64 → JSON → CanonicalCard[]
 * 2. Accumulate in module-level chunkAccumulator
 * 3. Send ack to Swift IMMEDIATELY (unblocks next chunk send)
 * 4. On final chunk (isLast === true), call bridge.importNative() ONCE
 *    for proper cross-chunk deduplication
 *
 * CRITICAL: Ack is sent BEFORE calling ImportOrchestrator to prevent
 * Swift from timing out during the database write phase.
 *
 * CRITICAL: ImportOrchestrator is called ONCE on the final chunk,
 * not per-chunk, to ensure cross-chunk deduplication works correctly.
 */
async function handleNativeImportChunk(
  bridge: WorkerBridge,
  payload: { chunkIndex: number; isLast: boolean; cardsBase64: string }
): Promise<void> {
  // Decode base64 JSON
  const cardsJson = atob(payload.cardsBase64);
  const cards: CanonicalCard[] = JSON.parse(cardsJson) as CanonicalCard[];

  if (payload.chunkIndex === 0) {
    // Reset accumulator for new import
    chunkAccumulator = [];
    activeSourceType = cards[0]?.source ?? null;
  }

  chunkAccumulator.push(...cards);

  console.log(
    '[NativeBridge] Chunk', payload.chunkIndex,
    'received:', cards.length, 'cards',
    '(accumulated:', chunkAccumulator.length + ')',
    payload.isLast ? '[FINAL]' : ''
  );

  // Send ack to Swift so next chunk is released
  // CRITICAL: Ack BEFORE ImportOrchestrator to prevent Swift timeout
  window.webkit!.messageHandlers.nativeBridge.postMessage({
    id: crypto.randomUUID(),
    type: 'native:import-chunk-ack',
    payload: { chunkIndex: payload.chunkIndex, success: true },
    timestamp: Date.now(),
  });

  if (payload.isLast && activeSourceType) {
    // All chunks received — call ImportOrchestrator ONCE for proper cross-chunk dedup
    const allCards = chunkAccumulator;
    const sourceType = activeSourceType;

    // Reset state before async call
    chunkAccumulator = [];
    activeSourceType = null;

    const result = await bridge.importNative(sourceType, allCards);
    console.log(
      '[NativeBridge] Native import complete:',
      result.inserted, 'inserted,',
      result.updated, 'updated,',
      result.unchanged, 'unchanged,',
      result.errors, 'errors'
    );
  }
}

// ---------------------------------------------------------------------------
// installMutationHook — wraps bridge.send() to detect writes
// ---------------------------------------------------------------------------

/**
 * Wraps WorkerBridge.send() to post 'mutated' to Swift after any write operation.
 *
 * Only fires for MUTATING_TYPES — read operations are excluded.
 * The 'mutated' message is lightweight (no payload) — Swift uses it to set isDirty.
 */
function installMutationHook(bridge: WorkerBridge): void {
  const originalSend = bridge.send.bind(bridge);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (bridge as any).send = async function <T extends string>(
    type: T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    timeoutOverride?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const result = await originalSend(type as Parameters<typeof originalSend>[0], payload, timeoutOverride);

    // Post 'mutated' after successful write operations only
    if (MUTATING_TYPES.has(type)) {
      try {
        window.webkit!.messageHandlers.nativeBridge.postMessage({
          id: crypto.randomUUID(),
          type: 'mutated',
          payload: {},
          timestamp: Date.now(),
        });
      } catch {
        // Silently swallow — mutation hook failure must not break the operation
      }
    }

    return result;
  };
}
