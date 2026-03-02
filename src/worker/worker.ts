// Isometry v5 — Phase 3 Worker Entry Point
// Self-initializing Web Worker that routes typed messages to v0.1 query handlers.
//
// Design principles:
//   - Eager initialization: Database initializes on script load
//   - Message queueing: Requests sent before init completes are queued and replayed
//   - Exhaustive routing: TypeScript enforces all request types are handled
//   - Error isolation: Handler errors are caught and returned as WorkerError
//
// Requirements addressed:
//   - WKBR-01: Receives typed WorkerRequest with correlation ID
//   - WKBR-02: Responds with WorkerResponse matching correlation ID
//   - WKBR-03: Errors propagate with code and message
//   - WKBR-04: All database operations execute here (off main thread)

import { Database } from '../database/Database';
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  WorkerError,
  WorkerErrorCode,
  WorkerReadyMessage,
  WorkerInitErrorMessage,
  WorkerPayloads,
  WorkerResponses,
} from './protocol';

// Import v0.1 query modules (unchanged)
import * as cards from '../database/queries/cards';
import * as connections from '../database/queries/connections';
import * as search from '../database/queries/search';
import * as graph from '../database/queries/graph';

// Import Phase 4 UI state handlers
import {
  handleUiGet,
  handleUiSet,
  handleUiDelete,
  handleUiGetAll,
  handleDbExec,
} from './handlers/ui-state.handler';

// Import Phase 7 simulation handler
import { handleGraphSimulate } from './handlers/simulate.handler';

// Import Phase 8/9 ETL handlers
import { handleETLImport } from './handlers/etl-import.handler';
import { handleETLExport } from './handlers/etl-export.handler';

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

/** Shared database instance — initialized once, used by all handlers */
let db: Database | null = null;

/** Initialization state flag */
let isInitialized = false;

/** Queue for messages received before initialization completes */
const pendingQueue: WorkerRequest[] = [];

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the database and signal readiness to main thread.
 * Called automatically on worker script load.
 */
async function initialize(): Promise<void> {
  try {
    db = new Database();
    await db.initialize();
    isInitialized = true;

    // Signal ready to main thread
    const readyMessage: WorkerReadyMessage = {
      type: 'ready',
      timestamp: Date.now(),
    };
    self.postMessage(readyMessage);

    // Process any queued messages
    await processPendingQueue();
  } catch (error) {
    // Signal initialization failure to main thread
    const initError: WorkerInitErrorMessage = {
      type: 'init-error',
      error: createWorkerError(error, 'NOT_INITIALIZED'),
    };
    self.postMessage(initError);
  }
}

/**
 * Process messages that were queued during initialization.
 * Maintains FIFO order to preserve request semantics.
 */
async function processPendingQueue(): Promise<void> {
  while (pendingQueue.length > 0) {
    const request = pendingQueue.shift()!;
    await handleRequest(request);
  }
}

// ---------------------------------------------------------------------------
// Message Handler
// ---------------------------------------------------------------------------

/**
 * Main message event handler.
 * Queues messages if not initialized, otherwise processes immediately.
 */
self.onmessage = async (event: MessageEvent) => {
  const raw: unknown = event.data;

  // Validate request shape
  if (!isValidRequest(raw)) {
    const maybeId = typeof raw === 'object' && raw !== null && 'id' in raw
      ? String((raw as { id: unknown }).id)
      : 'unknown';
    postErrorResponse(
      maybeId,
      'INVALID_REQUEST',
      'Invalid request format: missing id, type, or payload'
    );
    return;
  }

  const request: WorkerRequest = raw;

  if (!isInitialized) {
    // Queue for later processing
    pendingQueue.push(request);
    return;
  }

  await handleRequest(request);
};

/**
 * Process a single request and post the response.
 */
async function handleRequest(request: WorkerRequest): Promise<void> {
  if (!db) {
    postErrorResponse(request.id, 'NOT_INITIALIZED', 'Database not initialized');
    return;
  }

  try {
    const data = await routeRequest(db, request);
    postSuccessResponse(request.id, data);
  } catch (error) {
    const workerError = createWorkerError(error);
    postErrorResponse(request.id, workerError.code, workerError.message, workerError.stack);
  }
}

// ---------------------------------------------------------------------------
// Request Router
// ---------------------------------------------------------------------------

/**
 * Route a request to the appropriate handler based on type.
 * Uses exhaustive switch to ensure all request types are handled.
 *
 * @param db - Initialized Database instance
 * @param request - Typed WorkerRequest
 * @returns Handler result (type depends on request.type)
 */
async function routeRequest(
  db: Database,
  request: WorkerRequest
): Promise<WorkerResponses[WorkerRequestType]> {
  const { type, payload } = request;

  switch (type) {
    // -------------------------------------------------------------------------
    // Card Operations (CARD-01..06)
    // -------------------------------------------------------------------------
    case 'card:create': {
      const p = payload as WorkerPayloads['card:create'];
      return cards.createCard(db, p.input);
    }

    case 'card:get': {
      const p = payload as WorkerPayloads['card:get'];
      return cards.getCard(db, p.id);
    }

    case 'card:update': {
      const p = payload as WorkerPayloads['card:update'];
      cards.updateCard(db, p.id, p.updates);
      return undefined as unknown as WorkerResponses['card:update'];
    }

    case 'card:delete': {
      const p = payload as WorkerPayloads['card:delete'];
      cards.deleteCard(db, p.id);
      return undefined as unknown as WorkerResponses['card:delete'];
    }

    case 'card:undelete': {
      const p = payload as WorkerPayloads['card:undelete'];
      cards.undeleteCard(db, p.id);
      return undefined as unknown as WorkerResponses['card:undelete'];
    }

    case 'card:list': {
      const p = payload as WorkerPayloads['card:list'];
      return cards.listCards(db, p.options);
    }

    // -------------------------------------------------------------------------
    // Connection Operations (CONN-01..04)
    // -------------------------------------------------------------------------
    case 'connection:create': {
      const p = payload as WorkerPayloads['connection:create'];
      return connections.createConnection(db, p.input);
    }

    case 'connection:get': {
      const p = payload as WorkerPayloads['connection:get'];
      return connections.getConnections(db, p.cardId, p.direction);
    }

    case 'connection:delete': {
      const p = payload as WorkerPayloads['connection:delete'];
      connections.deleteConnection(db, p.id);
      return undefined as unknown as WorkerResponses['connection:delete'];
    }

    // -------------------------------------------------------------------------
    // Search Operations (SRCH-01..04)
    // -------------------------------------------------------------------------
    case 'search:cards': {
      const p = payload as WorkerPayloads['search:cards'];
      return search.searchCards(db, p.query, p.limit);
    }

    // -------------------------------------------------------------------------
    // Graph Operations (PERF-04)
    // -------------------------------------------------------------------------
    case 'graph:connected': {
      const p = payload as WorkerPayloads['graph:connected'];
      return graph.connectedCards(db, p.startId, p.maxDepth);
    }

    case 'graph:shortestPath': {
      const p = payload as WorkerPayloads['graph:shortestPath'];
      return graph.shortestPath(db, p.fromId, p.toId);
    }

    // -------------------------------------------------------------------------
    // Database Operations
    // -------------------------------------------------------------------------
    case 'db:export': {
      // db.export() returns Uint8Array of the SQLite database file
      // This is useful for native shell persistence
      return exportDatabase(db);
    }

    // -------------------------------------------------------------------------
    // UI State Operations (Phase 4)
    // -------------------------------------------------------------------------
    case 'ui:get': {
      const p = payload as WorkerPayloads['ui:get'];
      return handleUiGet(db, p);
    }

    case 'ui:set': {
      const p = payload as WorkerPayloads['ui:set'];
      handleUiSet(db, p);
      return undefined as unknown as WorkerResponses['ui:set'];
    }

    case 'ui:delete': {
      const p = payload as WorkerPayloads['ui:delete'];
      handleUiDelete(db, p);
      return undefined as unknown as WorkerResponses['ui:delete'];
    }

    case 'ui:getAll': {
      const p = payload as WorkerPayloads['ui:getAll'];
      return handleUiGetAll(db, p);
    }

    // -------------------------------------------------------------------------
    // Generic Exec (Phase 4 — MutationManager)
    // -------------------------------------------------------------------------
    case 'db:exec': {
      const p = payload as WorkerPayloads['db:exec'];
      return handleDbExec(db, p);
    }

    // -------------------------------------------------------------------------
    // Graph Simulation (Phase 7 — VIEW-08)
    // -------------------------------------------------------------------------
    case 'graph:simulate': {
      const p = payload as WorkerPayloads['graph:simulate'];
      return handleGraphSimulate(p);
    }

    // -------------------------------------------------------------------------
    // ETL Operations (Phase 8)
    // -------------------------------------------------------------------------
    case 'etl:import': {
      const p = payload as WorkerPayloads['etl:import'];
      return handleETLImport(db, p);
    }

    case 'etl:export': {
      const p = payload as WorkerPayloads['etl:export'];
      return handleETLExport(db, p);
    }

    // -------------------------------------------------------------------------
    // Exhaustive Check
    // -------------------------------------------------------------------------
    default: {
      // TypeScript will error here if a case is missing
      const _exhaustive: never = type;
      throw new Error(`Unknown request type: ${_exhaustive}`);
    }
  }
}

/**
 * Export the database as a Uint8Array.
 * Uses the Database.export() method added in Phase 3.
 */
function exportDatabase(db: Database): Uint8Array {
  return db.export();
}

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

/**
 * Post a success response to the main thread.
 */
function postSuccessResponse<T>(id: string, data: T): void {
  const response: WorkerResponse<T> = {
    id,
    success: true,
    data,
  };
  self.postMessage(response);
}

/**
 * Post an error response to the main thread.
 */
function postErrorResponse(
  id: string,
  code: WorkerErrorCode,
  message: string,
  stack?: string
): void {
  const response: WorkerResponse = {
    id,
    success: false,
    error: { code, message, stack },
  };
  self.postMessage(response);
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

/**
 * Convert an unknown error to a structured WorkerError.
 * Attempts to classify common SQLite/sql.js errors.
 */
function createWorkerError(
  error: unknown,
  defaultCode: WorkerErrorCode = 'UNKNOWN'
): WorkerError {
  if (error instanceof Error) {
    const code = classifyError(error, defaultCode);
    return {
      code,
      message: error.message,
      // Include stack in development only
      stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
    };
  }

  return {
    code: defaultCode,
    message: String(error),
  };
}

/**
 * Classify an error based on its message to determine the appropriate error code.
 */
function classifyError(error: Error, defaultCode: WorkerErrorCode): WorkerErrorCode {
  const message = error.message.toLowerCase();

  // SQLite constraint violations
  if (
    message.includes('foreign key constraint') ||
    message.includes('unique constraint') ||
    message.includes('constraint failed') ||
    message.includes('sqlite_constraint')
  ) {
    return 'CONSTRAINT_VIOLATION';
  }

  // Not found errors (from our query modules)
  if (
    message.includes('not found') ||
    message.includes('does not exist')
  ) {
    return 'NOT_FOUND';
  }

  // Initialization errors
  if (
    message.includes('not initialized') ||
    message.includes('database not open')
  ) {
    return 'NOT_INITIALIZED';
  }

  return defaultCode;
}

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a message has the expected WorkerRequest shape.
 */
function isValidRequest(request: unknown): request is WorkerRequest {
  return (
    typeof request === 'object' &&
    request !== null &&
    'id' in request &&
    'type' in request &&
    'payload' in request &&
    typeof (request as WorkerRequest).id === 'string' &&
    typeof (request as WorkerRequest).type === 'string'
  );
}

// ---------------------------------------------------------------------------
// Self-Initialize
// ---------------------------------------------------------------------------

// Start initialization immediately when worker script loads
initialize();
