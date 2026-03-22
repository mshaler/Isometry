// Polyfill Node.js Buffer for browser Worker context.
// gray-matter (used by AppleNotesParser) calls Buffer.from() internally.
import { Buffer } from 'buffer/';

if (typeof globalThis.Buffer === 'undefined') {
	(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

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
// Import v0.1 query modules (unchanged)
import * as cards from '../database/queries/cards';
// Import Phase 114 graph_metrics DDL
import { GRAPH_METRICS_DDL } from '../database/queries/graph-metrics';
import * as connections from '../database/queries/connections';
import * as graph from '../database/queries/graph';
import * as search from '../database/queries/search';
// Import Phase 88 Datasets handlers
import {
	handleDatasetsQuery,
	handleDatasetsRecentCards,
	handleDatasetsStats,
	handleDatasetsVacuum,
} from './handlers/datasets.handler';
// Import Phase 114 Graph Algorithm handlers
import {
	handleGraphCompute,
	handleGraphMetricsClear,
	handleGraphMetricsRead,
} from './handlers/graph-algorithms.handler';
// Import Phase 65 Chart handler
import { handleChartQuery } from './handlers/chart.handler';
import { handleETLExport } from './handlers/etl-export.handler';
// Import Phase 8/9 ETL handlers
import { handleETLImport } from './handlers/etl-import.handler';
// Import Phase 33 Native ETL handler
import { handleETLImportNative } from './handlers/etl-import-native.handler';
// Import Phase 66 Histogram handler
import { handleHistogramQuery } from './handlers/histogram.handler';
// Import Phase 7 simulation handler
import { handleGraphSimulate } from './handlers/simulate.handler';
// Import Phase 16 SuperGrid handlers (+ Phase 76 cell-detail)
import {
	handleDistinctValues,
	handleSuperGridCalc,
	handleSuperGridCellDetail,
	handleSuperGridQuery,
} from './handlers/supergrid.handler';
// Import Phase 4 UI state handlers
import {
	handleDbExec,
	handleDbQuery,
	handleUiDelete,
	handleUiGet,
	handleUiGetAll,
	handleUiSet,
} from './handlers/ui-state.handler';
import type {
	WorkerError,
	WorkerErrorCode,
	WorkerInitErrorMessage,
	WorkerNotification,
	WorkerPayloads,
	WorkerReadyMessage,
	WorkerRequest,
	WorkerRequestType,
	WorkerResponse,
	WorkerResponses,
} from './protocol';
// Import Phase 70 schema classifier
import { classifyColumns } from './schema-classifier';

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

/** Shared database instance — initialized once, used by all handlers */
let db: Database | null = null;

/** Initialization state flag */
let isInitialized = false;

/** Queue for messages received before initialization completes */
const pendingQueue: WorkerRequest[] = [];

/**
 * Worker-side valid column names Set.
 * Populated from PRAGMA table_info() at initialization time, before any handler runs.
 * Used by handlers for runtime column name validation (SCHM-06).
 */
export let validColumnNames: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the database and signal readiness to main thread.
 *
 * @param wasmBinary - Optional pre-loaded WASM ArrayBuffer from main thread.
 *   When provided, sql.js uses it directly instead of fetching.
 *   Required for WKWebView native shell where Worker fetch()
 *   doesn't route through WKURLSchemeHandler.
 * @param dbData - Optional existing database bytes for checkpoint hydration (Phase 12).
 *   When provided, loads the checkpoint into sql.js instead of creating a fresh database.
 */
async function initialize(wasmBinary?: ArrayBuffer, dbData?: ArrayBuffer): Promise<void> {
	try {
		db = new Database();
		await db.initialize(wasmBinary, dbData);

		// Schema migration: ensure tables added after v1.0 exist on hydrated databases.
		// CREATE TABLE IF NOT EXISTS is idempotent — safe on both fresh and existing DBs.
		if (dbData) {
			db.run(`CREATE TABLE IF NOT EXISTS datasets (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				source_type TEXT NOT NULL,
				card_count INTEGER NOT NULL DEFAULT 0,
				connection_count INTEGER NOT NULL DEFAULT 0,
				file_size_bytes INTEGER,
				filename TEXT,
				import_run_id TEXT,
				source_id TEXT,
				is_active INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
				last_imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
			)`);
			db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_datasets_name_source ON datasets(name, source_type)`);
			db.run(`CREATE INDEX IF NOT EXISTS idx_datasets_active ON datasets(is_active)`);
		}

		// Schema migration: ensure graph_metrics table exists (Phase 114, v9.0)
		{
			const ddlStatements = GRAPH_METRICS_DDL.split(';').filter((s) => s.trim());
			for (const stmt of ddlStatements) {
				db.run(stmt);
			}
		}

		isInitialized = true;

		// Phase 70: Introspect schema via PRAGMA and classify columns into LATCH families.
		// PRAGMA runs after db.initialize() so both schema tables exist.
		const rawCards = db.exec('PRAGMA table_info(cards)');
		const rawConns = db.exec('PRAGMA table_info(connections)');
		const cardColumns = classifyColumns(rawCards);
		const connColumns = classifyColumns(rawConns);

		// Validate cards table has columns — empty result means schema init failed.
		if (cardColumns.length === 0) {
			throw new Error('[Worker] PRAGMA table_info(cards) returned no columns — schema initialization failed');
		}

		// Populate Worker-side validation Set from classified column names (SCHM-06).
		// Must be populated before processPendingQueue() so handlers can use it.
		validColumnNames = new Set([...cardColumns.map((c) => c.name), ...connColumns.map((c) => c.name)]);

		// Signal ready to main thread, including schema metadata
		const readyMessage: WorkerReadyMessage = {
			type: 'ready',
			timestamp: Date.now(),
			schema: { cards: cardColumns, connections: connColumns },
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
 * Handles:
 *   - 'init': Initialize database (Worker fetches its own WASM)
 *   - 'wasm-init': Initialize with pre-loaded WASM binary (native shell)
 *   - WorkerRequest: Queue if not initialized, process if ready
 */
self.onmessage = async (event: MessageEvent) => {
	const raw: unknown = event.data;

	// Type-check for init messages (not WorkerRequests)
	if (typeof raw === 'object' && raw !== null) {
		const msg = raw as Record<string, unknown>;

		// Handle standard init from main thread.
		// Worker fetches WASM itself (works in browser, dev server, tests).
		if (msg['type'] === 'init') {
			await initialize();
			return;
		}

		// Handle wasm-init from main thread (WKWebView native shell).
		// Main thread fetches WASM via scheme handler, then sends ArrayBuffer here
		// because Worker fetch() doesn't route through WKURLSchemeHandler.
		// Optional dbData enables checkpoint hydration (Phase 12): existing database
		// bytes are loaded instead of creating a fresh schema-only database.
		if (msg['type'] === 'wasm-init' && msg['wasmBinary']) {
			const dbData = msg['dbData'] as ArrayBuffer | undefined;
			await initialize(msg['wasmBinary'] as ArrayBuffer, dbData);
			return;
		}
	}

	// Validate request shape
	if (!isValidRequest(raw)) {
		const maybeId =
			typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : 'unknown';
		postErrorResponse(maybeId, 'INVALID_REQUEST', 'Invalid request format: missing id, type, or payload');
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
async function routeRequest(db: Database, request: WorkerRequest): Promise<WorkerResponses[WorkerRequestType]> {
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

		case 'db:query': {
			const p = payload as WorkerPayloads['db:query'];
			return handleDbQuery(db, p);
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
		// Native ETL Operations (Phase 33)
		// -------------------------------------------------------------------------
		case 'etl:import-native': {
			const p = payload as WorkerPayloads['etl:import-native'];
			return handleETLImportNative(db, p);
		}

		// -------------------------------------------------------------------------
		// SuperGrid Operations (Phase 16)
		// -------------------------------------------------------------------------
		case 'supergrid:query': {
			const p = payload as WorkerPayloads['supergrid:query'];
			return handleSuperGridQuery(db, p);
		}

		case 'db:distinct-values': {
			const p = payload as WorkerPayloads['db:distinct-values'];
			return handleDistinctValues(db, p);
		}

		// -------------------------------------------------------------------------
		// SuperGrid Cell Detail Operations (Phase 76 RNDR-05)
		// -------------------------------------------------------------------------
		case 'supergrid:cell-detail': {
			const p = payload as WorkerPayloads['supergrid:cell-detail'];
			return handleSuperGridCellDetail(db, p);
		}

		// -------------------------------------------------------------------------
		// SuperCalc Operations (Phase 62)
		// -------------------------------------------------------------------------
		case 'supergrid:calc': {
			const p = payload as WorkerPayloads['supergrid:calc'];
			return handleSuperGridCalc(db, p);
		}

		// -------------------------------------------------------------------------
		// Chart Operations (Phase 65)
		// -------------------------------------------------------------------------
		case 'chart:query': {
			const p = payload as WorkerPayloads['chart:query'];
			return handleChartQuery(db, p);
		}

		// -------------------------------------------------------------------------
		// Histogram Operations (Phase 66)
		// -------------------------------------------------------------------------
		case 'histogram:query': {
			const p = payload as WorkerPayloads['histogram:query'];
			return handleHistogramQuery(db, p);
		}

		// -------------------------------------------------------------------------
		// Datasets Operations (Phase 88)
		// -------------------------------------------------------------------------
		case 'datasets:query': {
			return handleDatasetsQuery(db);
		}

		case 'datasets:stats': {
			return handleDatasetsStats(db);
		}

		case 'datasets:vacuum': {
			return handleDatasetsVacuum(db);
		}

		case 'datasets:recent-cards': {
			return handleDatasetsRecentCards(db);
		}

		// -------------------------------------------------------------------------
		// Graph Algorithm Operations (v9.0 Phase 114)
		// -------------------------------------------------------------------------
		case 'graph:compute': {
			const p = payload as WorkerPayloads['graph:compute'];
			return handleGraphCompute(db, p);
		}

		case 'graph:metrics-read': {
			const p = payload as WorkerPayloads['graph:metrics-read'];
			return handleGraphMetricsRead(db, p);
		}

		case 'graph:metrics-clear': {
			return handleGraphMetricsClear(db);
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
 * Post a notification (e.g., import progress) to the main thread.
 * Notifications have no correlation ID — they are fire-and-forget.
 */
export function postNotification(notification: WorkerNotification): void {
	self.postMessage(notification);
}

/**
 * Post an error response to the main thread.
 */
function postErrorResponse(id: string, code: WorkerErrorCode, message: string, stack?: string): void {
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
function createWorkerError(error: unknown, defaultCode: WorkerErrorCode = 'UNKNOWN'): WorkerError {
	if (error instanceof Error) {
		const code = classifyError(error, defaultCode);
		return {
			code,
			message: error.message,
			// Include stack — browser Workers have no process.env, so always include
			stack: error.stack,
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
	if (message.includes('not found') || message.includes('does not exist')) {
		return 'NOT_FOUND';
	}

	// Initialization errors
	if (message.includes('not initialized') || message.includes('database not open')) {
		return 'NOT_INITIALIZED';
	}

	// SQL safety violations (from validateAxisField / validateFilterField)
	if (message.includes('sql safety violation')) {
		return 'INVALID_REQUEST';
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
// Initialization is message-driven
// ---------------------------------------------------------------------------
// No auto-init. The main thread sends either:
//   - { type: 'init' }      → Worker fetches WASM itself (browser/tests)
//   - { type: 'wasm-init' } → Pre-loaded WASM binary (WKWebView native shell)
// This eliminates race conditions between auto-init and wasm-init.
