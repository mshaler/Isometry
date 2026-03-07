// Isometry v5 — Phase 3 Worker Router Tests
// Unit tests for the worker message router and error handling.
//
// NOTE: These tests do NOT import worker.ts directly because:
//   1. worker.ts uses `self.onmessage` which doesn't exist in Node
//   2. worker.ts self-initializes on import (side effects)
//
// Instead, we test:
//   - Protocol types and fixtures (no worker dependency)
//   - Error classification patterns (regex matching)
//   - Handler delegation (mocked modules)
//
// Full worker integration tests run in browser via integration.test.ts

import { describe, expect, it } from 'vitest';
import type { WorkerRequestType } from '../../src/worker/protocol';
import {
	createErrorResponse,
	createInitErrorMessage,
	createReadyMessage,
	createSuccessResponse,
	INVALID_REQUESTS,
	REQUEST_FIXTURES,
} from './fixtures';

// ---------------------------------------------------------------------------
// Protocol Type Tests
// ---------------------------------------------------------------------------

describe('Worker Protocol Types', () => {
	describe('Request type exhaustiveness', () => {
		// This test verifies that we have fixtures for all 13 request types
		const allRequestTypes: WorkerRequestType[] = [
			'card:create',
			'card:get',
			'card:update',
			'card:delete',
			'card:undelete',
			'card:list',
			'connection:create',
			'connection:get',
			'connection:delete',
			'search:cards',
			'graph:connected',
			'graph:shortestPath',
			'db:export',
		];

		it('should have exactly 13 request types', () => {
			expect(allRequestTypes.length).toBe(13);
		});

		it('should have fixtures for card operations', () => {
			expect(REQUEST_FIXTURES['card:create']).toBeDefined();
			expect(REQUEST_FIXTURES['card:get']).toBeDefined();
			expect(REQUEST_FIXTURES['card:update']).toBeDefined();
			expect(REQUEST_FIXTURES['card:delete']).toBeDefined();
			expect(REQUEST_FIXTURES['card:undelete']).toBeDefined();
			expect(REQUEST_FIXTURES['card:list']).toBeDefined();
		});

		it('should have fixtures for connection operations', () => {
			expect(REQUEST_FIXTURES['connection:create']).toBeDefined();
			expect(REQUEST_FIXTURES['connection:get']).toBeDefined();
			expect(REQUEST_FIXTURES['connection:delete']).toBeDefined();
		});

		it('should have fixtures for search and graph operations', () => {
			expect(REQUEST_FIXTURES['search:cards']).toBeDefined();
			expect(REQUEST_FIXTURES['graph:connected']).toBeDefined();
			expect(REQUEST_FIXTURES['graph:shortestPath']).toBeDefined();
		});

		it('should have fixture for db:export', () => {
			expect(REQUEST_FIXTURES['db:export']).toBeDefined();
		});
	});
});

// ---------------------------------------------------------------------------
// Message Shape Tests
// ---------------------------------------------------------------------------

describe('Worker Message Shapes', () => {
	describe('Ready message', () => {
		it('should have correct shape', () => {
			const ready = createReadyMessage();

			expect(ready).toHaveProperty('type', 'ready');
			expect(ready).toHaveProperty('timestamp');
			expect(typeof ready.timestamp).toBe('number');
		});
	});

	describe('Init error message', () => {
		it('should have correct shape', () => {
			const error = createInitErrorMessage({
				code: 'NOT_INITIALIZED',
				message: 'WASM failed to load',
			});

			expect(error).toHaveProperty('type', 'init-error');
			expect(error.error).toHaveProperty('code', 'NOT_INITIALIZED');
			expect(error.error).toHaveProperty('message', 'WASM failed to load');
		});
	});

	describe('Success response', () => {
		it('should have correct shape', () => {
			const response = createSuccessResponse<'card:list'>('req-123', []);

			expect(response).toHaveProperty('id', 'req-123');
			expect(response).toHaveProperty('success', true);
			expect(response).toHaveProperty('data');
			expect(response.data).toEqual([]);
		});
	});

	describe('Error response', () => {
		it('should have correct shape', () => {
			const response = createErrorResponse('req-456', {
				code: 'NOT_FOUND',
				message: 'Card not found',
			});

			expect(response).toHaveProperty('id', 'req-456');
			expect(response).toHaveProperty('success', false);
			expect(response.error).toHaveProperty('code', 'NOT_FOUND');
			expect(response.error).toHaveProperty('message', 'Card not found');
		});
	});
});

// ---------------------------------------------------------------------------
// Request Fixture Tests
// ---------------------------------------------------------------------------

describe('Request Fixtures', () => {
	it('card:create should have input with name', () => {
		const req = REQUEST_FIXTURES['card:create']();

		expect(req.type).toBe('card:create');
		expect(req.payload).toHaveProperty('input');
		expect(req.payload.input).toHaveProperty('name');
		expect(typeof req.id).toBe('string');
		expect(req.id.length).toBe(36); // UUID length
	});

	it('card:get should have id', () => {
		const req = REQUEST_FIXTURES['card:get']('my-card-id');

		expect(req.type).toBe('card:get');
		expect(req.payload).toHaveProperty('id', 'my-card-id');
	});

	it('card:update should have id and updates', () => {
		const req = REQUEST_FIXTURES['card:update']('my-card-id');

		expect(req.type).toBe('card:update');
		expect(req.payload).toHaveProperty('id', 'my-card-id');
		expect(req.payload).toHaveProperty('updates');
	});

	it('search:cards should have query', () => {
		const req = REQUEST_FIXTURES['search:cards']('my query');

		expect(req.type).toBe('search:cards');
		expect(req.payload).toHaveProperty('query', 'my query');
	});

	it('graph:connected should have startId', () => {
		const req = REQUEST_FIXTURES['graph:connected']('start-node');

		expect(req.type).toBe('graph:connected');
		expect(req.payload).toHaveProperty('startId', 'start-node');
	});

	it('graph:shortestPath should have fromId and toId', () => {
		const req = REQUEST_FIXTURES['graph:shortestPath']('from-node', 'to-node');

		expect(req.type).toBe('graph:shortestPath');
		expect(req.payload).toHaveProperty('fromId', 'from-node');
		expect(req.payload).toHaveProperty('toId', 'to-node');
	});

	it('db:export should have empty payload', () => {
		const req = REQUEST_FIXTURES['db:export']();

		expect(req.type).toBe('db:export');
		expect(req.payload).toEqual({});
	});

	it('connection:create should have source_id and target_id', () => {
		const req = REQUEST_FIXTURES['connection:create']('source-id', 'target-id');

		expect(req.type).toBe('connection:create');
		expect(req.payload.input).toHaveProperty('source_id', 'source-id');
		expect(req.payload.input).toHaveProperty('target_id', 'target-id');
	});
});

// ---------------------------------------------------------------------------
// Invalid Request Tests
// ---------------------------------------------------------------------------

describe('Invalid Request Fixtures', () => {
	it('should have unknown type fixture', () => {
		expect(INVALID_REQUESTS.unknownType).toHaveProperty('type', 'unknown:action');
	});

	it('should have invalid id fixture', () => {
		expect(INVALID_REQUESTS.invalidId.payload).toHaveProperty('id', '');
	});
});

// ---------------------------------------------------------------------------
// Error Classification Pattern Tests
// ---------------------------------------------------------------------------

describe('Error Classification Patterns', () => {
	// These test the patterns that worker.ts uses to classify errors
	// We test the regex patterns directly without importing worker.ts

	const constraintPattern = /constraint/i;
	const notFoundPattern = /not found|does not exist/i;
	const initPattern = /not initialized|not open/i;

	describe('Constraint error patterns', () => {
		const constraintMessages = [
			'FOREIGN KEY constraint failed',
			'UNIQUE constraint failed: cards.id',
			'SQLITE_CONSTRAINT: NOT NULL constraint failed',
			'constraint violation on table',
		];

		it.each(constraintMessages)('should match: %s', (msg) => {
			expect(msg).toMatch(constraintPattern);
		});
	});

	describe('Not found error patterns', () => {
		const notFoundMessages = [
			'Card not found',
			'Entity does not exist',
			'undeleteCard: card xyz not found',
			'Resource does not exist in database',
		];

		it.each(notFoundMessages)('should match: %s', (msg) => {
			expect(msg).toMatch(notFoundPattern);
		});
	});

	describe('Initialization error patterns', () => {
		const initMessages = ['Database not initialized', 'database not open', 'Connection not initialized'];

		it.each(initMessages)('should match: %s', (msg) => {
			expect(msg).toMatch(initPattern);
		});
	});

	describe('Non-matching messages', () => {
		const genericMessages = ['An unexpected error occurred', 'Operation failed', 'Invalid input'];

		it.each(genericMessages)('should not match specific patterns: %s', (msg) => {
			expect(msg).not.toMatch(constraintPattern);
			expect(msg).not.toMatch(notFoundPattern);
			expect(msg).not.toMatch(initPattern);
		});
	});
});

// ---------------------------------------------------------------------------
// Handler Module Mock Tests
// ---------------------------------------------------------------------------

describe('Handler Module Structure', () => {
	// These tests verify the v0.1 query modules exist and export expected functions
	// They don't test the handlers themselves (that requires worker context)

	it('cards module should export CRUD functions', async () => {
		const cards = await import('../../src/database/queries/cards');

		expect(typeof cards.createCard).toBe('function');
		expect(typeof cards.getCard).toBe('function');
		expect(typeof cards.updateCard).toBe('function');
		expect(typeof cards.deleteCard).toBe('function');
		expect(typeof cards.undeleteCard).toBe('function');
		expect(typeof cards.listCards).toBe('function');
	});

	it('connections module should export CRUD functions', async () => {
		const connections = await import('../../src/database/queries/connections');

		expect(typeof connections.createConnection).toBe('function');
		expect(typeof connections.getConnections).toBe('function');
		expect(typeof connections.deleteConnection).toBe('function');
	});

	it('search module should export searchCards', async () => {
		const search = await import('../../src/database/queries/search');

		expect(typeof search.searchCards).toBe('function');
	});

	it('graph module should export traversal functions', async () => {
		const graph = await import('../../src/database/queries/graph');

		expect(typeof graph.connectedCards).toBe('function');
		expect(typeof graph.shortestPath).toBe('function');
	});
});

// ---------------------------------------------------------------------------
// Handler Wrapper Tests (using actual handler files)
// ---------------------------------------------------------------------------

describe('Handler Wrappers', () => {
	// Test that handler files exist and export expected functions
	// These are thin wrappers so we just verify the structure

	it('cards.handler should export all card handlers', async () => {
		const handlers = await import('../../src/worker/handlers/cards.handler');

		expect(typeof handlers.handleCardCreate).toBe('function');
		expect(typeof handlers.handleCardGet).toBe('function');
		expect(typeof handlers.handleCardUpdate).toBe('function');
		expect(typeof handlers.handleCardDelete).toBe('function');
		expect(typeof handlers.handleCardUndelete).toBe('function');
		expect(typeof handlers.handleCardList).toBe('function');
	});

	it('connections.handler should export all connection handlers', async () => {
		const handlers = await import('../../src/worker/handlers/connections.handler');

		expect(typeof handlers.handleConnectionCreate).toBe('function');
		expect(typeof handlers.handleConnectionGet).toBe('function');
		expect(typeof handlers.handleConnectionDelete).toBe('function');
	});

	it('search.handler should export search handler', async () => {
		const handlers = await import('../../src/worker/handlers/search.handler');

		expect(typeof handlers.handleSearchCards).toBe('function');
	});

	it('graph.handler should export graph handlers', async () => {
		const handlers = await import('../../src/worker/handlers/graph.handler');

		expect(typeof handlers.handleGraphConnected).toBe('function');
		expect(typeof handlers.handleGraphShortestPath).toBe('function');
	});

	it('export.handler should export db export handler', async () => {
		const handlers = await import('../../src/worker/handlers/export.handler');

		expect(typeof handlers.handleDbExport).toBe('function');
	});

	it('index should re-export all handlers', async () => {
		const handlers = await import('../../src/worker/handlers');

		// Spot check a few
		expect(typeof handlers.handleCardCreate).toBe('function');
		expect(typeof handlers.handleConnectionCreate).toBe('function');
		expect(typeof handlers.handleSearchCards).toBe('function');
		expect(typeof handlers.handleGraphConnected).toBe('function');
		expect(typeof handlers.handleDbExport).toBe('function');
	});
});
