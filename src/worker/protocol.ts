// Isometry v5 — Phase 3 Worker Protocol Types
// Defines the typed message envelope system for main thread ↔ worker communication.
//
// Design principles:
//   - All payloads reference v0.1 types (no duplication)
//   - WorkerRequestType union enables exhaustive switch in router
//   - Correlation IDs enable concurrent request handling
//   - WorkerError provides structured error propagation (WKBR-03)

import type {
  Card,
  CardInput,
  CardListOptions,
  CardType,
  Connection,
  ConnectionInput,
  ConnectionDirection,
  SearchResult,
  CardWithDepth,
} from '../database/queries/types';

import type { SourceType, ImportResult } from '../etl/types';
import type { SuperGridQueryConfig } from '../views/supergrid/SuperGridQuery';

// Re-export types that consumers of WorkerBridge will need
export type {
  Card,
  CardInput,
  CardListOptions,
  CardType,
  Connection,
  ConnectionInput,
  ConnectionDirection,
  SearchResult,
  CardWithDepth,
};

// Re-export ETL types for consumers
export type { SourceType, ImportResult };

// Re-export SuperGrid types for downstream consumers
export type { SuperGridQueryConfig };

// ---------------------------------------------------------------------------
// SuperGrid Types (Phase 16)
// ---------------------------------------------------------------------------

/**
 * A single cell in the SuperGrid result set.
 * Dynamic axis column values are present as named keys.
 * card_ids is always string[] (split from GROUP_CONCAT comma-string).
 */
export interface CellDatum {
  [key: string]: unknown;  // Dynamic axis column values
  count: number;
  card_ids: string[];
}

// ---------------------------------------------------------------------------
// Notification Types (Phase 10 — Progress Reporting)
// ---------------------------------------------------------------------------

/**
 * Payload for import progress notifications.
 * Sent from Worker to main thread at each batch boundary during writeCards.
 */
export interface ImportProgressPayload {
  /** Cards processed so far */
  processed: number;
  /** Total cards to process */
  total: number;
  /** Cards per second (smoothed exponential moving average) */
  rate: number;
  /** Source type being imported */
  source: SourceType;
  /** Optional filename for display */
  filename: string | undefined;
}

/**
 * Notification message posted by Worker to main thread.
 * Unlike WorkerResponse, notifications have no correlation ID —
 * they are fire-and-forget progress updates.
 */
export interface WorkerNotification {
  type: 'import_progress';
  payload: ImportProgressPayload;
}

// ---------------------------------------------------------------------------
// Request Types
// ---------------------------------------------------------------------------

/**
 * All possible request types. Each maps to a handler function signature.
 * This union becomes the exhaustive switch in the worker router.
 *
 * Naming convention: `domain:action`
 *   - card:create, card:get, card:update, card:delete, card:undelete, card:list
 *   - connection:create, connection:get, connection:delete
 *   - search:cards
 *   - graph:connected, graph:shortestPath
 *   - db:export
 */
export type WorkerRequestType =
  // Cards (CARD-01..06)
  | 'card:create'
  | 'card:get'
  | 'card:update'
  | 'card:delete'
  | 'card:undelete'
  | 'card:list'
  // Connections (CONN-01..04)
  | 'connection:create'
  | 'connection:get'
  | 'connection:delete'
  // Search (SRCH-01..04)
  | 'search:cards'
  // Graph (PERF-04)
  | 'graph:connected'
  | 'graph:shortestPath'
  // Database operations
  | 'db:export'
  // UI State (Phase 4)
  | 'ui:get'
  | 'ui:set'
  | 'ui:delete'
  | 'ui:getAll'
  // Generic exec (Phase 4 — MutationManager only)
  | 'db:exec'
  // Generic query (Phase 11 — ViewManager SELECT queries)
  | 'db:query'
  // Graph simulation (Phase 7 — VIEW-08)
  | 'graph:simulate'
  // ETL Operations (Phase 8)
  | 'etl:import'
  | 'etl:export'
  // SuperGrid Operations (Phase 16)
  | 'supergrid:query'
  | 'db:distinct-values';

// ---------------------------------------------------------------------------
// Phase 7 — Force Simulation Types (VIEW-08)
// ---------------------------------------------------------------------------

/**
 * A node in the force simulation graph.
 * Optional x/y provide warm-start positions (previous stable positions).
 * Optional fx/fy pin a node to a fixed position (user-pinned nodes).
 */
export interface SimulateNode {
  id: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  /** Degree (edge count) — used for charge strength scaling */
  degree?: number;
}

/**
 * A directed or undirected edge between two nodes.
 * Uses string IDs; d3-force resolves them via the id accessor.
 */
export interface SimulateLink {
  source: string;
  target: string;
}

/**
 * Payload for 'graph:simulate' requests.
 * Passed from main thread to Worker for off-thread force simulation.
 */
export interface SimulatePayload {
  nodes: SimulateNode[];
  links: SimulateLink[];
  /** Viewport width — used for centering force center point */
  width: number;
  /** Viewport height — used for centering force center point */
  height: number;
}

/**
 * Stable position for a single node after force simulation converges.
 * Returned by handleGraphSimulate and sent back to main thread.
 */
export interface NodePosition {
  id: string;
  x: number;
  y: number;
  /** Non-null only for pinned nodes (user set fx) */
  fx: number | null;
  /** Non-null only for pinned nodes (user set fy) */
  fy: number | null;
}

/**
 * Payload type map — keys are WorkerRequestType, values are payload shapes.
 * Each payload is a plain object that can cross the structuredClone boundary.
 */
export interface WorkerPayloads {
  // Cards
  'card:create': { input: CardInput };
  'card:get': { id: string };
  'card:update': { id: string; updates: Partial<Omit<CardInput, 'card_type'>> };
  'card:delete': { id: string };
  'card:undelete': { id: string };
  'card:list': { options?: CardListOptions };

  // Connections
  'connection:create': { input: ConnectionInput };
  'connection:get': { cardId: string; direction?: ConnectionDirection };
  'connection:delete': { id: string };

  // Search
  'search:cards': { query: string; limit?: number };

  // Graph
  'graph:connected': { startId: string; maxDepth?: number };
  'graph:shortestPath': { fromId: string; toId: string };

  // Database
  'db:export': Record<string, never>; // Empty object — no payload needed

  // UI State (Phase 4)
  'ui:get': { key: string };
  'ui:set': { key: string; value: string };
  'ui:delete': { key: string };
  'ui:getAll': Record<string, never>;

  // Generic exec (Phase 4 — MutationManager only)
  'db:exec': { sql: string; params: unknown[] };

  // Generic query (Phase 11 — ViewManager SELECT queries)
  'db:query': { sql: string; params: unknown[] };

  // Graph simulation (Phase 7 — VIEW-08)
  'graph:simulate': SimulatePayload;

  // ETL Operations (Phase 8)
  'etl:import': {
    source: SourceType;
    data: string;              // File content or folder file list as JSON
    options?: {
      isBulkImport?: boolean;  // Enable FTS optimization for large imports
      filename?: string;       // Source filename for catalog
    };
  };
  'etl:export': {
    format: 'markdown' | 'json' | 'csv';
    cardIds?: string[];        // Optional filter (from SelectionProvider)
  };

  // SuperGrid Operations (Phase 16)
  'supergrid:query': SuperGridQueryConfig;
  'db:distinct-values': { column: string; where?: string; params?: unknown[] };
}

/**
 * Response type map — keys are WorkerRequestType, values are response data shapes.
 * These are the `data` field contents when `success === true`.
 */
export interface WorkerResponses {
  'card:create': Card;
  'card:get': Card | null;
  'card:update': void;
  'card:delete': void;
  'card:undelete': void;
  'card:list': Card[];

  'connection:create': Connection;
  'connection:get': Connection[];
  'connection:delete': void;

  'search:cards': SearchResult[];

  'graph:connected': CardWithDepth[];
  'graph:shortestPath': string[] | null;

  'db:export': Uint8Array;

  // UI State (Phase 4)
  'ui:get': { key: string; value: string | null; updated_at: string | null };
  'ui:set': void;
  'ui:delete': void;
  'ui:getAll': Array<{ key: string; value: string; updated_at: string }>;

  // Generic exec (Phase 4 — MutationManager only)
  'db:exec': { changes: number };

  // Generic query (Phase 11 — ViewManager SELECT queries)
  'db:query': { columns: string[]; rows: Record<string, unknown>[] };

  // Graph simulation (Phase 7 — VIEW-08)
  'graph:simulate': NodePosition[];

  // ETL Operations (Phase 8)
  'etl:import': ImportResult;
  'etl:export': { data: string; filename: string };

  // SuperGrid Operations (Phase 16)
  'supergrid:query': { cells: CellDatum[] };
  'db:distinct-values': { values: string[] };
}

// ---------------------------------------------------------------------------
// Message Envelopes
// ---------------------------------------------------------------------------

/**
 * Request envelope sent from main thread to worker.
 *
 * @template T - The request type (must be a valid WorkerRequestType)
 *
 * The `id` field is a UUID correlation ID generated by WorkerBridge.
 * The worker echoes this ID in its response for promise resolution.
 */
export interface WorkerRequest<T extends WorkerRequestType = WorkerRequestType> {
  /** UUID correlation ID — used to match response to originating promise */
  id: string;
  /** Request type — determines which handler processes the message */
  type: T;
  /** Payload shape depends on type — see WorkerPayloads */
  payload: WorkerPayloads[T];
}

/**
 * Response envelope sent from worker to main thread.
 *
 * @template T - The response data type (inferred from request type)
 *
 * Either `success === true` with `data`, or `success === false` with `error`.
 * Never both, never neither.
 */
export interface WorkerResponse<T = unknown> {
  /** Matches the request.id that triggered this response */
  id: string;
  /** True if handler completed without throwing */
  success: boolean;
  /** Result data — present only when success === true */
  data?: T | undefined;
  /** Error info — present only when success === false */
  error?: WorkerError | undefined;
}

/**
 * Success response helper type — narrows WorkerResponse to success case.
 */
export interface WorkerSuccessResponse<T> {
  id: string;
  success: true;
  data: T;
  error?: undefined | WorkerError;
}

/**
 * Error response helper type — narrows WorkerResponse to error case.
 */
export interface WorkerErrorResponse {
  id: string;
  success: false;
  data?: undefined | unknown;
  error: WorkerError;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Structured error for WKBR-03 compliance.
 * Provides machine-readable code and human-readable message.
 */
export interface WorkerError {
  /** Error classification code — enables programmatic error handling */
  code: WorkerErrorCode;
  /** Human-readable message (typically from Error.message) */
  message: string;
  /** Original stack trace — included only in development builds */
  stack?: string | undefined;
}

/**
 * Error codes for categorizing worker failures.
 *
 * UNKNOWN           - Catch-all for unexpected errors
 * NOT_INITIALIZED   - Operation attempted before database ready
 * INVALID_REQUEST   - Malformed request or unknown type
 * NOT_FOUND         - Requested entity does not exist
 * CONSTRAINT_VIOLATION - FK, unique, or check constraint failed
 * TIMEOUT           - Request exceeded time limit (set by WorkerBridge)
 */
export type WorkerErrorCode =
  | 'UNKNOWN'
  | 'NOT_INITIALIZED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'CONSTRAINT_VIOLATION'
  | 'TIMEOUT';

// ---------------------------------------------------------------------------
// Initialization Messages
// ---------------------------------------------------------------------------

/**
 * Special message posted by worker when initialization completes.
 * WorkerBridge awaits this before resolving `isReady`.
 */
export interface WorkerReadyMessage {
  type: 'ready';
  /** Timestamp when worker became ready (for latency tracking) */
  timestamp: number;
}

/**
 * Special message posted by worker if initialization fails.
 * WorkerBridge should reject `isReady` and surface the error.
 */
export interface WorkerInitErrorMessage {
  type: 'init-error';
  error: WorkerError;
}

/**
 * Union of all possible messages the worker can post.
 * Used for type narrowing in WorkerBridge's onmessage handler.
 */
export type WorkerMessage =
  | WorkerReadyMessage
  | WorkerInitErrorMessage
  | WorkerResponse
  | WorkerNotification;

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Type guard to check if a message is the ready signal.
 */
export function isReadyMessage(msg: unknown): msg is WorkerReadyMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WorkerReadyMessage).type === 'ready'
  );
}

/**
 * Type guard to check if a message is an init error.
 */
export function isInitErrorMessage(msg: unknown): msg is WorkerInitErrorMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WorkerInitErrorMessage).type === 'init-error'
  );
}

/**
 * Type guard to check if a message is a notification (import progress).
 * CRITICAL: Must be checked BEFORE isResponse in handleMessage,
 * because notifications have no `id` or `success` field.
 */
export function isNotification(msg: unknown): msg is WorkerNotification {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WorkerNotification).type === 'import_progress'
  );
}

/**
 * Type guard to check if a message is a response (has correlation id).
 */
export function isResponse(msg: unknown): msg is WorkerResponse {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'id' in msg &&
    'success' in msg &&
    typeof (msg as WorkerResponse).id === 'string' &&
    typeof (msg as WorkerResponse).success === 'boolean'
  );
}

/**
 * Type guard to narrow a response to success case.
 */
export function isSuccessResponse<T>(
  response: WorkerResponse<T>
): response is WorkerSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to narrow a response to error case.
 */
export function isErrorResponse(
  response: WorkerResponse
): response is WorkerErrorResponse {
  return response.success === false;
}

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

/**
 * Extract the payload type for a given request type.
 * Usage: PayloadFor<'card:create'> → { input: CardInput }
 */
export type PayloadFor<T extends WorkerRequestType> = WorkerPayloads[T];

/**
 * Extract the response data type for a given request type.
 * Usage: ResponseFor<'card:create'> → Card
 */
export type ResponseFor<T extends WorkerRequestType> = WorkerResponses[T];

/**
 * Pending request tracker used internally by WorkerBridge.
 * Maps correlation ID to promise resolution callbacks.
 */
export interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  /** Request type — for debugging/logging */
  type: WorkerRequestType;
  /** Timestamp when request was sent — for latency tracking */
  sentAt: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * WorkerBridge configuration options.
 */
export interface WorkerBridgeConfig {
  /**
   * Pre-loaded WASM binary for native shell (WKWebView).
   * When provided, sent to Worker via postMessage before initialization.
   * Worker uses wasmBinary directly instead of fetch() which doesn't
   * route through WKURLSchemeHandler from Web Workers.
   */
  wasmBinary?: ArrayBuffer;

  /**
   * Pre-loaded database bytes for native shell checkpoint hydration (Phase 12).
   * When provided alongside wasmBinary, sent to Worker in the wasm-init message.
   * Worker loads these bytes into sql.js instead of creating a fresh database.
   * On first launch (no checkpoint file), this is undefined — Worker creates empty db.
   */
  dbData?: ArrayBuffer;

  /**
   * Timeout in milliseconds for each request.
   * If exceeded, promise rejects with TIMEOUT error.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Enable development mode logging.
   * Logs request/response timing and correlation IDs.
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration values for runtime options (timeout, debug).
 * wasmBinary and dbData are initialization-time values with no sensible default.
 */
export const DEFAULT_WORKER_CONFIG: Required<Pick<WorkerBridgeConfig, 'timeout' | 'debug'>> = {
  timeout: 30_000,
  debug: false,
};

/**
 * Extended timeout for ETL operations.
 * Large imports (5000+ notes) may take several minutes.
 */
export const ETL_TIMEOUT = 300_000;  // 300 seconds
