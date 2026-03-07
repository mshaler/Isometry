// Isometry v5 — Phase 3 Test Fixtures
// Reusable test data and helpers for Worker Bridge tests.

import type {
	Card,
	CardInput,
	CardWithDepth,
	Connection,
	ConnectionInput,
	SearchResult,
	WorkerError,
	WorkerInitErrorMessage,
	WorkerPayloads,
	WorkerReadyMessage,
	WorkerRequest,
	WorkerRequestType,
	WorkerResponse,
	WorkerResponses,
} from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Card Fixtures
// ---------------------------------------------------------------------------

/**
 * Valid CardInput for creating a minimal card.
 */
export const MINIMAL_CARD_INPUT: CardInput = {
	name: 'Test Card',
};

/**
 * Valid CardInput with all optional fields populated.
 */
export const FULL_CARD_INPUT: CardInput = {
	card_type: 'task',
	name: 'Complete Phase 3',
	content: 'Implement the Worker Bridge for sql.js operations.',
	summary: 'Worker Bridge implementation',
	folder: 'Isometry',
	tags: ['phase-3', 'worker', 'critical'],
	status: 'in-progress',
	priority: 1,
	sort_order: 100,
	url: 'https://github.com/example/isometry',
	mime_type: null,
	is_collective: false,
	source: 'manual',
	source_id: 'phase-3-task-001',
	source_url: null,
	due_at: '2026-03-15T00:00:00.000Z',
	completed_at: null,
	event_start: null,
	event_end: null,
	latitude: null,
	longitude: null,
	location_name: null,
};

/**
 * Sample Card object (as returned from database).
 */
export const SAMPLE_CARD: Card = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	card_type: 'note',
	name: 'Sample Note',
	content: 'This is sample content for testing.',
	summary: null,
	latitude: null,
	longitude: null,
	location_name: null,
	created_at: '2026-02-28T10:00:00.000Z',
	modified_at: '2026-02-28T10:00:00.000Z',
	due_at: null,
	completed_at: null,
	event_start: null,
	event_end: null,
	folder: 'Testing',
	tags: ['test', 'sample'],
	status: null,
	priority: 0,
	sort_order: 0,
	url: null,
	mime_type: null,
	is_collective: false,
	source: null,
	source_id: null,
	source_url: null,
	deleted_at: null,
};

/**
 * Generate a unique card input with optional overrides.
 */
export function createCardInput(overrides: Partial<CardInput> = {}): CardInput {
	return {
		name: `Card ${Date.now()}`,
		...overrides,
	};
}

/**
 * Generate a sample card with a unique ID.
 */
export function createSampleCard(overrides: Partial<Card> = {}): Card {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		card_type: 'note',
		name: `Card ${Date.now()}`,
		content: null,
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: now,
		modified_at: now,
		due_at: null,
		completed_at: null,
		event_start: null,
		event_end: null,
		folder: null,
		tags: [],
		status: null,
		priority: 0,
		sort_order: 0,
		url: null,
		mime_type: null,
		is_collective: false,
		source: null,
		source_id: null,
		source_url: null,
		deleted_at: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Connection Fixtures
// ---------------------------------------------------------------------------

/**
 * Valid ConnectionInput for creating a minimal connection.
 */
export function createConnectionInput(
	sourceId: string,
	targetId: string,
	overrides: Partial<ConnectionInput> = {},
): ConnectionInput {
	return {
		source_id: sourceId,
		target_id: targetId,
		...overrides,
	};
}

/**
 * Sample Connection object (as returned from database).
 */
export function createSampleConnection(
	sourceId: string,
	targetId: string,
	overrides: Partial<Connection> = {},
): Connection {
	return {
		id: crypto.randomUUID(),
		source_id: sourceId,
		target_id: targetId,
		via_card_id: null,
		label: null,
		weight: 1.0,
		created_at: new Date().toISOString(),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Search Fixtures
// ---------------------------------------------------------------------------

/**
 * Sample SearchResult for testing.
 */
export function createSearchResult(card: Card, overrides: Partial<SearchResult> = {}): SearchResult {
	return {
		card,
		rank: -1.5, // FTS5 rank is negative, more negative = better match
		snippet: `...${card.name}...`,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Graph Fixtures
// ---------------------------------------------------------------------------

/**
 * Sample CardWithDepth for graph traversal results.
 */
export function createCardWithDepth(card: Card, depth: number): CardWithDepth {
	return { card, depth };
}

// ---------------------------------------------------------------------------
// Request/Response Fixtures
// ---------------------------------------------------------------------------

/**
 * Generate a valid WorkerRequest with a unique correlation ID.
 */
export function createRequest<T extends WorkerRequestType>(type: T, payload: WorkerPayloads[T]): WorkerRequest<T> {
	return {
		id: crypto.randomUUID(),
		type,
		payload,
	};
}

/**
 * Generate a success response matching a request.
 */
export function createSuccessResponse<T extends WorkerRequestType>(
	requestId: string,
	data: WorkerResponses[T],
): WorkerResponse<WorkerResponses[T]> {
	return {
		id: requestId,
		success: true,
		data,
	};
}

/**
 * Generate an error response matching a request.
 */
export function createErrorResponse(requestId: string, error: Partial<WorkerError> = {}): WorkerResponse {
	return {
		id: requestId,
		success: false,
		error: {
			code: 'UNKNOWN',
			message: 'Test error',
			...error,
		},
	};
}

/**
 * Generate a ready message.
 */
export function createReadyMessage(): WorkerReadyMessage {
	return {
		type: 'ready',
		timestamp: Date.now(),
	};
}

/**
 * Generate an init error message.
 */
export function createInitErrorMessage(error: Partial<WorkerError> = {}): WorkerInitErrorMessage {
	return {
		type: 'init-error',
		error: {
			code: 'NOT_INITIALIZED',
			message: 'Worker initialization failed',
			...error,
		},
	};
}

// ---------------------------------------------------------------------------
// Request Generators (for all 13 request types)
// ---------------------------------------------------------------------------

export const REQUEST_FIXTURES = {
	'card:create': () => createRequest('card:create', { input: MINIMAL_CARD_INPUT }),

	'card:get': (id = '550e8400-e29b-41d4-a716-446655440000') => createRequest('card:get', { id }),

	'card:update': (id = '550e8400-e29b-41d4-a716-446655440000') =>
		createRequest('card:update', { id, updates: { name: 'Updated Name' } }),

	'card:delete': (id = '550e8400-e29b-41d4-a716-446655440000') => createRequest('card:delete', { id }),

	'card:undelete': (id = '550e8400-e29b-41d4-a716-446655440000') => createRequest('card:undelete', { id }),

	'card:list': () => createRequest('card:list', { options: { limit: 10 } }),

	'connection:create': (sourceId: string, targetId: string) =>
		createRequest('connection:create', {
			input: createConnectionInput(sourceId, targetId),
		}),

	'connection:get': (cardId: string) => createRequest('connection:get', { cardId, direction: 'bidirectional' }),

	'connection:delete': (id: string) => createRequest('connection:delete', { id }),

	'search:cards': (query = 'test') => createRequest('search:cards', { query, limit: 20 }),

	'graph:connected': (startId: string) => createRequest('graph:connected', { startId, maxDepth: 3 }),

	'graph:shortestPath': (fromId: string, toId: string) => createRequest('graph:shortestPath', { fromId, toId }),

	'db:export': () => createRequest('db:export', {}),
} as const;

// ---------------------------------------------------------------------------
// Invalid Request Fixtures (for error handling tests)
// ---------------------------------------------------------------------------

/**
 * Requests that should trigger specific error codes.
 */
export const INVALID_REQUESTS = {
	/** Unknown request type */
	unknownType: {
		id: crypto.randomUUID(),
		type: 'unknown:action' as WorkerRequestType,
		payload: {},
	},

	/** Missing required field */
	missingPayload: {
		id: crypto.randomUUID(),
		type: 'card:create',
		// payload missing
	},

	/** Invalid ID format (for get/update/delete) */
	invalidId: createRequest('card:get', { id: '' }),

	/** Non-existent card (for FK violation test) */
	nonExistentCard: createRequest('connection:create', {
		input: {
			source_id: 'non-existent-source',
			target_id: 'non-existent-target',
		},
	}),
};

// ---------------------------------------------------------------------------
// Timing Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a specified duration (useful for timeout tests).
 */
export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a timeout.
 */
export function timeout<T>(ms: number, message = 'Timeout'): Promise<T> {
	return new Promise((_, reject) => {
		setTimeout(() => reject(new Error(message)), ms);
	});
}

/**
 * Race a promise against a timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Timeout'): Promise<T> {
	return Promise.race([promise, timeout<T>(ms, message)]);
}

// ---------------------------------------------------------------------------
// Mock Worker Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock worker that responds to messages with predefined responses.
 * Useful for unit testing WorkerBridge without a real worker.
 */
export function createMockWorker(responseMap: Map<string, WorkerResponse> = new Map()): {
	worker: Worker;
	postMessage: (msg: WorkerRequest) => void;
	terminate: () => void;
	simulateMessage: (msg: WorkerResponse | WorkerReadyMessage) => void;
} {
	let onmessage: ((event: MessageEvent) => void) | null = null;

	const worker = {
		postMessage: (msg: WorkerRequest) => {
			// Simulate async response
			setTimeout(() => {
				const response =
					responseMap.get(msg.id) ??
					createErrorResponse(msg.id, {
						code: 'UNKNOWN',
						message: `No mock response for request ${msg.id}`,
					});
				if (onmessage) {
					onmessage(new MessageEvent('message', { data: response }));
				}
			}, 0);
		},
		terminate: () => {
			onmessage = null;
		},
		set onmessage(handler: ((event: MessageEvent) => void) | null) {
			onmessage = handler;
		},
		get onmessage(): ((event: MessageEvent) => void) | null {
			return onmessage;
		},
	} as unknown as Worker;

	return {
		worker,
		postMessage: worker.postMessage.bind(worker),
		terminate: worker.terminate.bind(worker),
		simulateMessage: (msg) => {
			if (onmessage) {
				onmessage(new MessageEvent('message', { data: msg }));
			}
		},
	};
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that two cards are equal (ignoring timestamp precision).
 */
export function assertCardsEqual(actual: Card, expected: Partial<Card>, ignoreTimestamps = true): void {
	const compareCard = { ...actual };
	const compareExpected = { ...expected };

	if (ignoreTimestamps) {
		delete (compareCard as Partial<Card>).created_at;
		delete (compareCard as Partial<Card>).modified_at;
		delete compareExpected.created_at;
		delete compareExpected.modified_at;
	}

	for (const [key, value] of Object.entries(compareExpected)) {
		if (compareCard[key as keyof Card] !== value) {
			throw new Error(
				`Card mismatch at ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(compareCard[key as keyof Card])}`,
			);
		}
	}
}

/**
 * Assert that a WorkerResponse is a success with expected data.
 */
export function assertSuccessResponse<T>(
	response: WorkerResponse<T>,
	expectedData?: T,
): asserts response is { id: string; success: true; data: T } {
	if (!response.success) {
		throw new Error(`Expected success response, got error: ${response.error?.message}`);
	}
	if (expectedData !== undefined && response.data !== expectedData) {
		throw new Error(
			`Response data mismatch: expected ${JSON.stringify(expectedData)}, got ${JSON.stringify(response.data)}`,
		);
	}
}

/**
 * Assert that a WorkerResponse is an error with expected code.
 */
export function assertErrorResponse(
	response: WorkerResponse,
	expectedCode?: string,
): asserts response is { id: string; success: false; error: WorkerError } {
	if (response.success) {
		throw new Error(`Expected error response, got success with data: ${JSON.stringify(response.data)}`);
	}
	if (expectedCode && response.error?.code !== expectedCode) {
		throw new Error(`Error code mismatch: expected ${expectedCode}, got ${response.error?.code}`);
	}
}
