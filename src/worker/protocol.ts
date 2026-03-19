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
	CardWithDepth,
	Connection,
	ConnectionDirection,
	ConnectionInput,
	SearchResult,
} from '../database/queries/types';

import type { CanonicalCard, ImportResult, SourceType } from '../etl/types';
import type { AggregationMode, AxisMapping, TimeGranularity } from '../providers/types';
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
export type { SourceType, ImportResult, CanonicalCard };

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
	[key: string]: unknown; // Dynamic axis column values
	count: number;
	card_ids: string[];
	card_names: string[]; // Resolved card names from GROUP_CONCAT(name)
	/** True count of card_ids before truncation (Phase 76 RNDR-05). Present when count > 50. */
	card_ids_total?: number;
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
	// Native ETL Operations (Phase 33)
	| 'etl:import-native'
	// SuperGrid Operations (Phase 16)
	| 'supergrid:query'
	| 'db:distinct-values'
	// SuperGrid Cell Detail Operations (Phase 76 RNDR-05)
	| 'supergrid:cell-detail'
	// SuperCalc Operations (Phase 62)
	| 'supergrid:calc'
	// Chart Operations (Phase 65)
	| 'chart:query'
	// Histogram Operations (Phase 66)
	| 'histogram:query'
	// Datasets Operations (Phase 88)
	| 'datasets:query'
	| 'datasets:stats'
	| 'datasets:vacuum'
	// Datasets Recent Cards (Phase 90)
	| 'datasets:recent-cards';

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
	'card:update': { id: string; updates: Partial<CardInput> };
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
		data: string | ArrayBuffer; // Text content or binary (xlsx/xls) ArrayBuffer
		options?: {
			isBulkImport?: boolean; // Enable FTS optimization for large imports
			filename?: string; // Source filename for catalog
		};
	};
	'etl:export': {
		format: 'markdown' | 'json' | 'csv';
		cardIds?: string[]; // Optional filter (from SelectionProvider)
	};

	// Native ETL Operations (Phase 33 — pre-parsed cards from Swift adapters)
	'etl:import-native': {
		sourceType: string; // e.g., 'native_reminders', 'native_calendar', 'native_notes'
		cards: CanonicalCard[]; // Pre-parsed cards — no parsing step needed
	};

	// SuperGrid Operations (Phase 16)
	'supergrid:query': SuperGridQueryConfig;
	'db:distinct-values': { column: string; where?: string; params?: unknown[] };

	// SuperGrid Cell Detail Operations (Phase 76 RNDR-05 — lazy-fetch full card_ids for a cell)
	'supergrid:cell-detail': {
		/** Axis field → value pairs identifying the target cell (e.g. { card_type: 'note', folder: 'work' }) */
		axisValues: Record<string, string>;
		/** SQL WHERE fragment from FilterProvider.compile() (without deleted_at guard) */
		where: string;
		/** Bound parameters for the WHERE clause */
		params: unknown[];
	};

	// SuperCalc Operations (Phase 62 — per-group aggregate footer rows)
	'supergrid:calc': {
		rowAxes: AxisMapping[];
		colAxes?: AxisMapping[];
		where: string;
		params: unknown[];
		granularity?: TimeGranularity | null;
		searchTerm?: string;
		aggregates: Record<string, AggregationMode | 'off'>;
		/** Phase 71 DYNM-10: schema-derived time field names (falls back to frozen set when undefined) */
		timeFields?: string[];
		/** Phase 71 DYNM-10: schema-derived numeric field names (falls back to frozen set when undefined) */
		numericFields?: string[];
	};

	// Chart Operations (Phase 65 — chart block data queries)
	'chart:query': {
		chartType: 'bar' | 'pie' | 'line' | 'scatter';
		xField: string; // Validated column name (post-AliasProvider resolution)
		yField: string | null; // null when y-axis is 'count' (magic keyword)
		where: string; // From FilterProvider.compile()
		params: unknown[]; // From FilterProvider.compile()
		limit?: number; // Optional LIMIT clause
	};

	// Histogram Operations (Phase 66 — LATCH histogram scrubber data)
	'histogram:query': {
		field: string; // Column to bin (validated against filter allowlist)
		fieldType: 'numeric' | 'date'; // Determines binning strategy
		bins: number; // Number of bins (default 10)
		where: string; // From FilterProvider.compile()
		params: unknown[]; // From FilterProvider.compile()
	};

	// Datasets Operations (Phase 88)
	'datasets:query': Record<string, never>; // No payload — returns all rows
	'datasets:stats': Record<string, never>; // No payload — returns card/connection/size counts
	'datasets:vacuum': Record<string, never>; // No payload — runs VACUUM + REINDEX

	// Datasets Recent Cards (Phase 90)
	'datasets:recent-cards': Record<string, never>; // No payload — returns 8 most recently created non-deleted cards
}

/**
 * Response type map — keys are WorkerRequestType, values are response data shapes.
 * These are the `data` field contents when `success === true`.
 */
export interface WorkerResponses {
	'card:create': Card;
	'card:get': Card | null;
	'card:update': undefined;
	'card:delete': undefined;
	'card:undelete': undefined;
	'card:list': Card[];

	'connection:create': Connection;
	'connection:get': Connection[];
	'connection:delete': undefined;

	'search:cards': SearchResult[];

	'graph:connected': CardWithDepth[];
	'graph:shortestPath': string[] | null;

	'db:export': Uint8Array;

	// UI State (Phase 4)
	'ui:get': { key: string; value: string | null; updated_at: string | null };
	'ui:set': undefined;
	'ui:delete': undefined;
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

	// Native ETL Operations (Phase 33)
	'etl:import-native': ImportResult;

	// SuperGrid Operations (Phase 16, extended Phase 25 SRCH-04)
	'supergrid:query': { cells: CellDatum[]; searchTerms?: string[] };
	'db:distinct-values': { values: string[] };

	// SuperGrid Cell Detail Operations (Phase 76 RNDR-05)
	'supergrid:cell-detail': { card_ids: string[]; total: number };

	// SuperCalc Operations (Phase 62)
	'supergrid:calc': {
		rows: Array<{
			groupKey: Record<string, unknown>;
			values: Record<string, number | null>;
		}>;
	};

	// Chart Operations (Phase 65)
	'chart:query':
		| {
				type: 'labeled';
				rows: Array<{ label: string; value: number }>;
		  }
		| {
				type: 'xy';
				rows: Array<{ x: number; y: number }>;
		  };

	// Histogram Operations (Phase 66)
	'histogram:query': {
		bins: Array<{ binStart: number | string; binEnd: number | string; count: number }>;
	};

	// Datasets Operations (Phase 88)
	'datasets:query': Array<{
		id: string;
		name: string;
		source_type: string;
		card_count: number;
		connection_count: number;
		file_size_bytes: number | null;
		filename: string | null;
		is_active: number;
		created_at: string;
		last_imported_at: string;
	}>;
	'datasets:stats': {
		card_count: number;
		connection_count: number;
		db_size_bytes: number;
	};
	'datasets:vacuum': { success: boolean };

	// Datasets Recent Cards (Phase 90)
	'datasets:recent-cards': Array<{
		id: string;
		name: string;
		source: string;
		created_at: string;
	}>;
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
// Schema Metadata (Phase 70 — Dynamic Schema)
// ---------------------------------------------------------------------------

/**
 * LATCH information architecture family for a database column.
 * Used by SchemaProvider and PropertiesExplorer to group and sort columns.
 */
export type LatchFamily = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy';

/**
 * Runtime metadata for a single database column, derived from PRAGMA table_info().
 * Produced by classifyColumns() in the Worker and forwarded to the main thread
 * via WorkerReadyMessage.schema.
 */
export interface ColumnInfo {
	/** Column name (safe — regex-validated before inclusion) */
	name: string;
	/** SQLite type affinity: 'TEXT', 'INTEGER', 'REAL', etc. */
	type: string;
	/** Whether the column has a NOT NULL constraint */
	notnull: boolean;
	/** LATCH information architecture family */
	latchFamily: LatchFamily;
	/** True for INTEGER and REAL columns (usable in numeric aggregations) */
	isNumeric: boolean;
}

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
	/** Schema metadata derived from PRAGMA table_info() at Worker init time */
	schema: {
		cards: ColumnInfo[];
		connections: ColumnInfo[];
	};
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
export type WorkerMessage = WorkerReadyMessage | WorkerInitErrorMessage | WorkerResponse | WorkerNotification;

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Type guard to check if a message is the ready signal.
 */
export function isReadyMessage(msg: unknown): msg is WorkerReadyMessage {
	return typeof msg === 'object' && msg !== null && 'type' in msg && (msg as WorkerReadyMessage).type === 'ready';
}

/**
 * Type guard to check if a message is an init error.
 */
export function isInitErrorMessage(msg: unknown): msg is WorkerInitErrorMessage {
	return (
		typeof msg === 'object' && msg !== null && 'type' in msg && (msg as WorkerInitErrorMessage).type === 'init-error'
	);
}

/**
 * Type guard to check if a message is a notification (import progress).
 * CRITICAL: Must be checked BEFORE isResponse in handleMessage,
 * because notifications have no `id` or `success` field.
 */
export function isNotification(msg: unknown): msg is WorkerNotification {
	return (
		typeof msg === 'object' && msg !== null && 'type' in msg && (msg as WorkerNotification).type === 'import_progress'
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
export function isSuccessResponse<T>(response: WorkerResponse<T>): response is WorkerSuccessResponse<T> {
	return response.success === true;
}

/**
 * Type guard to narrow a response to error case.
 */
export function isErrorResponse(response: WorkerResponse): response is WorkerErrorResponse {
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

	/**
	 * Callback invoked with schema metadata from the Worker ready message.
	 * Called BEFORE isReady resolves, so the schema is available synchronously
	 * after `await bridge.isReady`.
	 *
	 * Phase 70: WorkerBridge passes through the schema — it does NOT store it.
	 * The caller (main.ts) provides this callback to wire SchemaProvider.
	 */
	onSchema?: (schema: { cards: ColumnInfo[]; connections: ColumnInfo[] }) => void;
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
export const ETL_TIMEOUT = 300_000; // 300 seconds
