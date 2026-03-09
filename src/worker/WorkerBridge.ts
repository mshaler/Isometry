// Isometry v5 — Phase 3 WorkerBridge Client
// Main-thread client for communicating with the sql.js Web Worker.
//
// Design principles:
//   - All public methods await isReady before sending requests
//   - Correlation IDs enable concurrent request handling
//   - Configurable timeout prevents silent hangs
//   - Typed API mirrors v0.1 query module signatures
//
// Requirements addressed:
//   - WKBR-01: Sends typed WorkerRequest with UUID correlation ID
//   - WKBR-02: Matches responses to originating promises via correlation ID
//   - WKBR-03: Propagates errors with code and message
//   - WKBR-04: All database operations routed through worker (off main thread)

import type {
	CanonicalCard,
	Card,
	CardInput,
	CardListOptions,
	CardWithDepth,
	CellDatum,
	Connection,
	ConnectionDirection,
	ConnectionInput,
	ImportResult,
	PendingRequest,
	SearchResult,
	SourceType,
	SuperGridQueryConfig,
	WorkerBridgeConfig,
	WorkerMessage,
	WorkerNotification,
	WorkerPayloads,
	WorkerRequest,
	WorkerRequestType,
	WorkerResponse,
	WorkerResponses,
} from './protocol';
import {
	DEFAULT_WORKER_CONFIG,
	ETL_TIMEOUT,
	isInitErrorMessage,
	isNotification,
	isReadyMessage,
	isResponse,
} from './protocol';

// ---------------------------------------------------------------------------
// WorkerBridge Class
// ---------------------------------------------------------------------------

/**
 * Main-thread client for the sql.js Web Worker.
 *
 * Usage:
 * ```typescript
 * const bridge = getWorkerBridge();
 * await bridge.isReady;
 *
 * const card = await bridge.createCard({ name: 'My Card' });
 * const results = await bridge.searchCards('query');
 * ```
 *
 * All methods automatically await `isReady` before sending requests,
 * so explicit await is optional but recommended for clarity.
 */
export class WorkerBridge {
	/** Resolves when worker signals ready; rejects on init failure */
	readonly isReady: Promise<void>;

	/** Callback for notification messages (e.g., import progress) */
	onnotification: ((notification: WorkerNotification) => void) | null = null;

	/** Configuration options (runtime options only — wasmBinary/dbData consumed at init) */
	private readonly config: Required<Pick<WorkerBridgeConfig, 'timeout' | 'debug'>>;

	/** The Web Worker instance */
	private readonly worker: Worker;

	/** Map of pending requests by correlation ID */
	private readonly pending: Map<string, PendingRequest> = new Map();

	/** Whether the worker has signaled ready */
	private ready = false;

	/** Pending rAF config -- latest-wins, replaces any queued but not-yet-sent config */
	private _pendingSuperGridResolve: ((cells: CellDatum[]) => void) | null = null;
	private _pendingSuperGridReject: ((e: Error) => void) | null = null;
	private _pendingSuperGridConfig: SuperGridQueryConfig | null = null;
	private _superGridRafId: ReturnType<typeof requestAnimationFrame> | null = null;

	/** Resolve function for isReady promise */
	private resolveReady!: () => void;

	/** Reject function for isReady promise */
	private rejectReady!: (error: Error) => void;

	/**
	 * Create a new WorkerBridge instance.
	 *
	 * @param config - Optional configuration overrides
	 */
	constructor(config: WorkerBridgeConfig = {}) {
		this.config = { ...DEFAULT_WORKER_CONFIG, ...config };

		// Create isReady promise
		this.isReady = new Promise<void>((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});

		// Create the worker
		// Note: Vite handles the ?worker import transform
		this.worker = this.createWorker();

		// Set up message handler
		this.worker.onmessage = this.handleMessage.bind(this);

		// Set up error handler
		this.worker.onerror = this.handleError.bind(this);

		// Tell the Worker how to initialize. No auto-init — message-driven only.
		if (config.wasmBinary) {
			// Native shell: Main thread fetched WASM via scheme handler.
			// Transfer the ArrayBuffer (zero-copy) so Worker skips fetch.
			// If dbData is also provided (checkpoint hydration), transfer it too.
			if (config.dbData) {
				this.worker.postMessage({ type: 'wasm-init', wasmBinary: config.wasmBinary, dbData: config.dbData }, [
					config.wasmBinary,
					config.dbData,
				]);
			} else {
				this.worker.postMessage({ type: 'wasm-init', wasmBinary: config.wasmBinary }, [config.wasmBinary]);
			}
		} else {
			// Standard mode: Worker fetches WASM itself.
			this.worker.postMessage({ type: 'init' });
		}
	}

	// ---------------------------------------------------------------------------
	// Card Operations (CARD-01..06)
	// ---------------------------------------------------------------------------

	/**
	 * Create a new card.
	 * @param input - Card properties (name required, others optional)
	 * @returns The created Card with generated ID and timestamps
	 */
	async createCard(input: CardInput): Promise<Card> {
		return this.send('card:create', { input });
	}

	/**
	 * Get a card by ID.
	 * @param id - Card UUID
	 * @returns The Card or null if not found/deleted
	 */
	async getCard(id: string): Promise<Card | null> {
		return this.send('card:get', { id });
	}

	/**
	 * Update card fields.
	 * @param id - Card UUID
	 * @param updates - Fields to update (modified_at auto-updates)
	 */
	async updateCard(id: string, updates: Partial<Omit<CardInput, 'card_type'>>): Promise<void> {
		return this.send('card:update', { id, updates });
	}

	/**
	 * Soft-delete a card.
	 * @param id - Card UUID
	 */
	async deleteCard(id: string): Promise<void> {
		return this.send('card:delete', { id });
	}

	/**
	 * Restore a soft-deleted card.
	 * @param id - Card UUID
	 */
	async undeleteCard(id: string): Promise<void> {
		return this.send('card:undelete', { id });
	}

	/**
	 * List cards with optional filters.
	 * @param options - Filter options (folder, status, card_type, source, limit)
	 * @returns Array of matching cards
	 */
	async listCards(options?: CardListOptions): Promise<Card[]> {
		const payload: WorkerPayloads['card:list'] = {};
		if (options !== undefined) payload.options = options;
		return this.send('card:list', payload);
	}

	// ---------------------------------------------------------------------------
	// Connection Operations (CONN-01..04)
	// ---------------------------------------------------------------------------

	/**
	 * Create a connection between two cards.
	 * @param input - Connection properties (source_id, target_id required)
	 * @returns The created Connection
	 */
	async createConnection(input: ConnectionInput): Promise<Connection> {
		return this.send('connection:create', { input });
	}

	/**
	 * Get connections for a card.
	 * @param cardId - Card UUID
	 * @param direction - Filter direction (outgoing, incoming, bidirectional)
	 * @returns Array of connections
	 */
	async getConnections(cardId: string, direction: ConnectionDirection = 'bidirectional'): Promise<Connection[]> {
		return this.send('connection:get', { cardId, direction });
	}

	/**
	 * Delete a connection.
	 * @param id - Connection UUID
	 */
	async deleteConnection(id: string): Promise<void> {
		return this.send('connection:delete', { id });
	}

	// ---------------------------------------------------------------------------
	// Search Operations (SRCH-01..04)
	// ---------------------------------------------------------------------------

	/**
	 * Full-text search over cards.
	 * @param query - FTS5 query string
	 * @param limit - Maximum results (default 20)
	 * @returns BM25-ranked results with snippets
	 */
	async searchCards(query: string, limit?: number): Promise<SearchResult[]> {
		const payload: WorkerPayloads['search:cards'] = { query };
		if (limit !== undefined) payload.limit = limit;
		return this.send('search:cards', payload);
	}

	// ---------------------------------------------------------------------------
	// Graph Operations (PERF-04)
	// ---------------------------------------------------------------------------

	/**
	 * Get cards connected to a starting card.
	 * @param startId - Starting card UUID
	 * @param maxDepth - Maximum traversal depth (default 3)
	 * @returns Cards with depth information
	 */
	async connectedCards(startId: string, maxDepth?: number): Promise<CardWithDepth[]> {
		const payload: WorkerPayloads['graph:connected'] = { startId };
		if (maxDepth !== undefined) payload.maxDepth = maxDepth;
		return this.send('graph:connected', payload);
	}

	/**
	 * Find shortest path between two cards.
	 * @param fromId - Source card UUID
	 * @param toId - Target card UUID
	 * @returns Array of card IDs forming path, or null if no path exists
	 */
	async shortestPath(fromId: string, toId: string): Promise<string[] | null> {
		return this.send('graph:shortestPath', { fromId, toId });
	}

	// ---------------------------------------------------------------------------
	// Database Operations
	// ---------------------------------------------------------------------------

	/**
	 * Export the database as a binary blob.
	 * Used by native shell for file system persistence.
	 * @returns SQLite database as Uint8Array
	 */
	async exportDatabase(): Promise<Uint8Array> {
		return this.send('db:export', {});
	}

	// ---------------------------------------------------------------------------
	// Generic Exec (Phase 4 — MutationManager only)
	// ---------------------------------------------------------------------------

	/**
	 * Execute a raw SQL statement via the Worker.
	 * Intended for MutationManager's forward/inverse command execution.
	 * Returns the number of rows changed.
	 *
	 * @param sql - Parameterized SQL statement
	 * @param params - Bound parameters
	 * @returns Object with `changes` count
	 */
	async exec(sql: string, params: unknown[]): Promise<{ changes: number }> {
		return this.send('db:exec', { sql, params });
	}

	// ---------------------------------------------------------------------------
	// ETL Operations (Phase 8)
	// ---------------------------------------------------------------------------

	/**
	 * Import data from an external source.
	 * Uses extended timeout (300s) to handle large imports.
	 *
	 * @param source - Source type identifier
	 * @param data - File content or file list JSON
	 * @param options - Import options (bulk mode, filename)
	 * @returns Import result with counts and inserted IDs
	 */
	async importFile(
		source: SourceType,
		data: string | ArrayBuffer,
		options?: { isBulkImport?: boolean; filename?: string },
	): Promise<ImportResult> {
		const payload: WorkerPayloads['etl:import'] = { source, data };
		if (options !== undefined) payload.options = options;
		return await this.send('etl:import', payload, ETL_TIMEOUT);
	}

	/**
	 * Export cards to a specified format.
	 *
	 * @param format - Output format (markdown, json, csv)
	 * @param cardIds - Optional card ID filter (from SelectionProvider)
	 * @returns Export data and suggested filename
	 */
	async exportFile(
		format: 'markdown' | 'json' | 'csv',
		cardIds?: string[],
	): Promise<{ data: string; filename: string }> {
		const payload: WorkerPayloads['etl:export'] = { format };
		if (cardIds !== undefined) payload.cardIds = cardIds;
		return await this.send('etl:export', payload);
	}

	/**
	 * Import pre-parsed native cards from Swift adapters.
	 * Bypasses the parse step — cards are already CanonicalCard[].
	 * Uses extended timeout (300s) to handle large imports.
	 *
	 * @param sourceType - Native source type (e.g., 'native_reminders')
	 * @param cards - Pre-parsed canonical cards from Swift adapter
	 * @returns Import result with counts and inserted IDs
	 */
	async importNative(sourceType: string, cards: CanonicalCard[]): Promise<ImportResult> {
		return this.send('etl:import-native', { sourceType, cards }, ETL_TIMEOUT);
	}

	// ---------------------------------------------------------------------------
	// SuperGrid Operations (Phase 16)
	// ---------------------------------------------------------------------------

	/**
	 * Send a supergrid:query request with rAF coalescing.
	 * Multiple calls within one frame collapse to a single Worker request.
	 * Stale responses (from requests superseded by newer ones within the same
	 * rAF window) are silently discarded -- only the latest caller's promise
	 * is fulfilled.
	 *
	 * @param config - Column axes, row axes, WHERE clause, and params
	 * @returns Promise resolving to CellDatum[] (the cells array from the response)
	 */
	async superGridQuery(config: SuperGridQueryConfig): Promise<CellDatum[]> {
		this._pendingSuperGridConfig = config;

		return new Promise<CellDatum[]>((resolve, reject) => {
			// Latest-wins: overwrite resolve/reject -- only the latest caller's promise is fulfilled
			this._pendingSuperGridResolve = resolve;
			this._pendingSuperGridReject = reject;

			if (this._superGridRafId !== null) return; // rAF already scheduled

			this._superGridRafId = requestAnimationFrame(() => {
				this._superGridRafId = null;
				const latestConfig = this._pendingSuperGridConfig!;
				const latestResolve = this._pendingSuperGridResolve!;
				const latestReject = this._pendingSuperGridReject!;
				this._pendingSuperGridConfig = null;
				this._pendingSuperGridResolve = null;
				this._pendingSuperGridReject = null;

				this.send('supergrid:query', latestConfig)
					.then((result) => latestResolve(result.cells))
					.catch((e) => latestReject(e as Error));
			});
		});
	}

	/**
	 * Fire a supergrid:calc aggregate query for footer row values.
	 * No rAF coalescing — fires immediately (called in parallel with superGridQuery).
	 *
	 * @param payload - Row axes, WHERE clause, params, and per-column aggregates
	 * @returns Promise resolving to grouped aggregate values
	 */
	async calcQuery(payload: WorkerPayloads['supergrid:calc']): Promise<WorkerResponses['supergrid:calc']> {
		return this.send('supergrid:calc', payload);
	}

	/**
	 * Get distinct values for a column, optionally filtered by WHERE clause.
	 * Used by SuperFilter dropdowns (Phase 24) and initial axis value population.
	 *
	 * @param column - Column name (must be in axis allowlist)
	 * @param where - Optional SQL WHERE fragment
	 * @param params - Optional bound parameters for WHERE
	 * @returns Sorted string[] of distinct values
	 */
	async distinctValues(column: string, where?: string, params?: unknown[]): Promise<string[]> {
		const payload: WorkerPayloads['db:distinct-values'] = { column };
		if (where !== undefined) payload.where = where;
		if (params !== undefined) payload.params = params;
		const result = await this.send('db:distinct-values', payload);
		return result.values;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Terminate the worker and clean up resources.
	 * Rejects all pending requests with an error.
	 * After calling this, the bridge instance cannot be reused.
	 */
	terminate(): void {
		// Reject all pending requests
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timeoutId);
			pending.reject(new Error('WorkerBridge terminated'));
			this.pending.delete(id);
		}

		// Terminate the worker
		this.worker.terminate();

		if (this.config.debug) {
			console.log('[WorkerBridge] Terminated');
		}
	}

	// ---------------------------------------------------------------------------
	// Private: Message Sending
	// ---------------------------------------------------------------------------

	/**
	 * Send a typed request to the worker and return a promise for the response.
	 * Automatically awaits isReady before sending.
	 *
	 * Public so that StateManager and MutationManager can use it directly
	 * for ui:* and db:* operations without requiring dedicated wrapper methods.
	 *
	 * @param type - Request type
	 * @param payload - Request payload
	 * @returns Promise resolving to response data
	 */
	async send<T extends WorkerRequestType>(
		type: T,
		payload: WorkerPayloads[T],
		timeoutOverride?: number,
	): Promise<WorkerResponses[T]> {
		// Wait for worker to be ready
		await this.isReady;

		return new Promise<WorkerResponses[T]>((resolve, reject) => {
			const id = crypto.randomUUID();
			const sentAt = Date.now();
			const effectiveTimeout = timeoutOverride ?? this.config.timeout;

			// Set up timeout
			const timeoutId = setTimeout(() => {
				this.pending.delete(id);
				const error = new Error(`Request ${type} timed out after ${effectiveTimeout}ms`);
				(error as Error & { code: string }).code = 'TIMEOUT';
				reject(error);

				if (this.config.debug) {
					console.warn(`[WorkerBridge] Timeout: ${type} (${id})`);
				}
			}, effectiveTimeout);

			// Track pending request
			const pending: PendingRequest<WorkerResponses[T]> = {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeoutId,
				type,
				sentAt,
			};
			this.pending.set(id, pending as PendingRequest);

			// Build and send request
			const request: WorkerRequest<T> = { id, type, payload };
			this.worker.postMessage(request);

			if (this.config.debug) {
				console.log(`[WorkerBridge] Sent: ${type} (${id})`);
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Private: Message Handling
	// ---------------------------------------------------------------------------

	/**
	 * Handle incoming messages from the worker.
	 */
	private handleMessage(event: MessageEvent<WorkerMessage>): void {
		const message = event.data;

		// Handle ready signal
		if (isReadyMessage(message)) {
			this.ready = true;
			this.resolveReady();

			if (this.config.debug) {
				console.log('[WorkerBridge] Worker ready');
			}
			return;
		}

		// Handle init error
		if (isInitErrorMessage(message)) {
			const error = new Error(`Worker initialization failed: ${message.error.message}`);
			(error as Error & { code: string }).code = message.error.code;
			this.rejectReady(error);

			if (this.config.debug) {
				console.error('[WorkerBridge] Init error:', message.error);
			}
			return;
		}

		// Handle notification (import progress)
		// CRITICAL: Must come BEFORE isResponse — notifications have no `id` or `success` field
		if (isNotification(message)) {
			if (this.onnotification) {
				this.onnotification(message);
			}
			return;
		}

		// Handle response
		if (isResponse(message)) {
			this.handleResponse(message);
			return;
		}

		// Unknown message type
		if (this.config.debug) {
			console.warn('[WorkerBridge] Unknown message:', message);
		}
	}

	/**
	 * Handle a response message by resolving/rejecting the corresponding promise.
	 */
	private handleResponse(response: WorkerResponse): void {
		const pending = this.pending.get(response.id);

		if (!pending) {
			// Response for unknown request (possibly timed out)
			if (this.config.debug) {
				console.warn(`[WorkerBridge] Response for unknown request: ${response.id}`);
			}
			return;
		}

		// Clear timeout and remove from pending
		clearTimeout(pending.timeoutId);
		this.pending.delete(response.id);

		// Calculate latency for debugging
		if (this.config.debug) {
			const latency = Date.now() - pending.sentAt;
			console.log(`[WorkerBridge] Response: ${pending.type} (${response.id}) in ${latency}ms`);
		}

		// Resolve or reject based on success
		if (response.success) {
			pending.resolve(response.data);
		} else {
			const error = new Error(response.error?.message ?? 'Unknown error');
			(error as Error & { code: string }).code = response.error?.code ?? 'UNKNOWN';
			pending.reject(error);
		}
	}

	/**
	 * Handle worker error events.
	 */
	private handleError(event: ErrorEvent): void {
		console.error('[WorkerBridge] Worker error:', event.message);

		// If not ready yet, reject isReady
		if (!this.ready) {
			const error = new Error(`Worker error: ${event.message}`);
			this.rejectReady(error);
		}

		// Note: Individual requests are not automatically rejected on worker error.
		// They will time out if the worker is unresponsive.
	}

	// ---------------------------------------------------------------------------
	// Private: Worker Creation
	// ---------------------------------------------------------------------------

	/**
	 * Create the Web Worker instance.
	 * Uses Vite's ?worker import syntax for bundling.
	 */
	private createWorker(): Worker {
		// Dynamic import to support both Vite dev and production builds.
		// In production, Vite bundles the worker and this becomes a blob URL.
		// In dev, Vite serves the worker as a separate module.
		//
		// Note: If this import fails, check vite.config.ts worker settings
		// and ensure src/worker/worker.ts is the correct entry point.
		return new Worker(new URL('./worker.ts', import.meta.url), {
			type: 'module',
			name: 'isometry-db',
		});
	}
}

// ---------------------------------------------------------------------------
// Singleton / Factory
// ---------------------------------------------------------------------------

/** Shared singleton instance */
let sharedBridge: WorkerBridge | null = null;

/**
 * Get the shared WorkerBridge singleton.
 * Creates the instance on first call.
 *
 * @returns The shared WorkerBridge instance
 */
export function getWorkerBridge(): WorkerBridge {
	if (!sharedBridge) {
		sharedBridge = new WorkerBridge();
	}
	return sharedBridge;
}

/**
 * Create a new isolated WorkerBridge instance.
 * Useful for testing or running multiple workers.
 *
 * @param config - Optional configuration overrides
 * @returns A new WorkerBridge instance
 */
export function createWorkerBridge(config?: WorkerBridgeConfig): WorkerBridge {
	return new WorkerBridge(config);
}

/**
 * Reset the shared singleton.
 * Terminates the existing worker if present.
 * Useful for testing.
 */
export function resetWorkerBridge(): void {
	if (sharedBridge) {
		sharedBridge.terminate();
		sharedBridge = null;
	}
}
