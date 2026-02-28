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
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  WorkerPayloads,
  WorkerResponses,
  WorkerMessage,
  WorkerBridgeConfig,
  PendingRequest,
  Card,
  CardInput,
  CardListOptions,
  Connection,
  ConnectionInput,
  ConnectionDirection,
  SearchResult,
  CardWithDepth,
} from './protocol';

import {
  isReadyMessage,
  isInitErrorMessage,
  isResponse,
  DEFAULT_WORKER_CONFIG,
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

  /** Configuration options */
  private readonly config: Required<WorkerBridgeConfig>;

  /** The Web Worker instance */
  private readonly worker: Worker;

  /** Map of pending requests by correlation ID */
  private readonly pending: Map<string, PendingRequest> = new Map();

  /** Whether the worker has signaled ready */
  private ready = false;

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
  async updateCard(
    id: string,
    updates: Partial<Omit<CardInput, 'card_type'>>
  ): Promise<void> {
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
  async getConnections(
    cardId: string,
    direction: ConnectionDirection = 'bidirectional'
  ): Promise<Connection[]> {
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
  async connectedCards(
    startId: string,
    maxDepth?: number
  ): Promise<CardWithDepth[]> {
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
   * @param type - Request type
   * @param payload - Request payload
   * @returns Promise resolving to response data
   */
  private async send<T extends WorkerRequestType>(
    type: T,
    payload: WorkerPayloads[T]
  ): Promise<WorkerResponses[T]> {
    // Wait for worker to be ready
    await this.isReady;

    return new Promise<WorkerResponses[T]>((resolve, reject) => {
      const id = crypto.randomUUID();
      const sentAt = Date.now();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(
          `Request ${type} timed out after ${this.config.timeout}ms`
        );
        (error as Error & { code: string }).code = 'TIMEOUT';
        reject(error);

        if (this.config.debug) {
          console.warn(`[WorkerBridge] Timeout: ${type} (${id})`);
        }
      }, this.config.timeout);

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
      const error = new Error(
        `Worker initialization failed: ${message.error.message}`
      );
      (error as Error & { code: string }).code = message.error.code;
      this.rejectReady(error);

      if (this.config.debug) {
        console.error('[WorkerBridge] Init error:', message.error);
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
        console.warn(
          `[WorkerBridge] Response for unknown request: ${response.id}`
        );
      }
      return;
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeoutId);
    this.pending.delete(response.id);

    // Calculate latency for debugging
    if (this.config.debug) {
      const latency = Date.now() - pending.sentAt;
      console.log(
        `[WorkerBridge] Response: ${pending.type} (${response.id}) in ${latency}ms`
      );
    }

    // Resolve or reject based on success
    if (response.success) {
      pending.resolve(response.data);
    } else {
      const error = new Error(response.error?.message ?? 'Unknown error');
      (error as Error & { code: string }).code =
        response.error?.code ?? 'UNKNOWN';
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
