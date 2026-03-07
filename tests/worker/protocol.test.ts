// Isometry v5 — Phase 3 Protocol Type Tests
// Validates type definitions, type guards, and exhaustiveness.

import { describe, it, expect } from 'vitest';
import {
  isReadyMessage,
  isInitErrorMessage,
  isResponse,
  isNotification,
  isSuccessResponse,
  isErrorResponse,
  DEFAULT_WORKER_CONFIG,
  ETL_TIMEOUT,
  type WorkerRequestType,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerNotification,
  type ImportProgressPayload,
  type WorkerPayloads,
  type WorkerResponses,
  type SourceType,
} from '../../src/worker/protocol';
import {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  createReadyMessage,
  createInitErrorMessage,
  REQUEST_FIXTURES,
} from './fixtures';

describe('Protocol Types', () => {
  describe('WorkerRequestType exhaustiveness', () => {
    it('should have exactly 13 request types', () => {
      // This test documents the expected request types.
      // If a type is added/removed, this test will need updating.
      const allTypes: WorkerRequestType[] = [
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

      expect(allTypes).toHaveLength(13);
    });

    it('should generate valid requests for all types', () => {
      // Verify each fixture generator produces a valid request shape
      const requests = [
        REQUEST_FIXTURES['card:create'](),
        REQUEST_FIXTURES['card:get'](),
        REQUEST_FIXTURES['card:update'](),
        REQUEST_FIXTURES['card:delete'](),
        REQUEST_FIXTURES['card:undelete'](),
        REQUEST_FIXTURES['card:list'](),
        REQUEST_FIXTURES['connection:create']('source-id', 'target-id'),
        REQUEST_FIXTURES['connection:get']('card-id'),
        REQUEST_FIXTURES['connection:delete']('conn-id'),
        REQUEST_FIXTURES['search:cards'](),
        REQUEST_FIXTURES['graph:connected']('start-id'),
        REQUEST_FIXTURES['graph:shortestPath']('from-id', 'to-id'),
        REQUEST_FIXTURES['db:export'](),
      ];

      for (const req of requests) {
        expect(req).toHaveProperty('id');
        expect(req).toHaveProperty('type');
        expect(req).toHaveProperty('payload');
        expect(typeof req.id).toBe('string');
        expect(req.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });
  });

  describe('Request structure', () => {
    it('should create a request with UUID correlation ID', () => {
      const request = createRequest('card:create', { input: { name: 'Test' } });

      expect(request.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(request.type).toBe('card:create');
      expect(request.payload).toEqual({ input: { name: 'Test' } });
    });

    it('should generate unique IDs for each request', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const request = createRequest('card:list', { options: {} });
        ids.add(request.id);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('Response structure', () => {
    it('should create a success response', () => {
      const requestId = crypto.randomUUID();
      const response = createSuccessResponse<'card:get'>(requestId, null);

      expect(response.id).toBe(requestId);
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
      expect(response.error).toBeUndefined();
    });

    it('should create an error response', () => {
      const requestId = crypto.randomUUID();
      const response = createErrorResponse(requestId, {
        code: 'NOT_FOUND',
        message: 'Card not found',
      });

      expect(response.id).toBe(requestId);
      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Card not found',
      });
    });
  });

  describe('Type guards', () => {
    describe('isReadyMessage', () => {
      it('should return true for valid ready message', () => {
        const msg = createReadyMessage();
        expect(isReadyMessage(msg)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isReadyMessage(null)).toBe(false);
        expect(isReadyMessage(undefined)).toBe(false);
        expect(isReadyMessage({})).toBe(false);
        expect(isReadyMessage({ type: 'other' })).toBe(false);
        expect(isReadyMessage(createInitErrorMessage())).toBe(false);
        expect(isReadyMessage(createSuccessResponse('id', null))).toBe(false);
      });
    });

    describe('isInitErrorMessage', () => {
      it('should return true for valid init error message', () => {
        const msg = createInitErrorMessage();
        expect(isInitErrorMessage(msg)).toBe(true);
      });

      it('should return false for other message types', () => {
        expect(isInitErrorMessage(null)).toBe(false);
        expect(isInitErrorMessage(undefined)).toBe(false);
        expect(isInitErrorMessage({})).toBe(false);
        expect(isInitErrorMessage({ type: 'other' })).toBe(false);
        expect(isInitErrorMessage(createReadyMessage())).toBe(false);
        expect(isInitErrorMessage(createErrorResponse('id'))).toBe(false);
      });
    });

    describe('isResponse', () => {
      it('should return true for success response', () => {
        const msg = createSuccessResponse('id', null);
        expect(isResponse(msg)).toBe(true);
      });

      it('should return true for error response', () => {
        const msg = createErrorResponse('id');
        expect(isResponse(msg)).toBe(true);
      });

      it('should return false for non-response messages', () => {
        expect(isResponse(null)).toBe(false);
        expect(isResponse(undefined)).toBe(false);
        expect(isResponse({})).toBe(false);
        expect(isResponse({ id: 'test' })).toBe(false); // missing success
        expect(isResponse({ success: true })).toBe(false); // missing id
        expect(isResponse(createReadyMessage())).toBe(false);
        expect(isResponse(createInitErrorMessage())).toBe(false);
      });
    });

    describe('isSuccessResponse', () => {
      it('should narrow success responses', () => {
        const success = createSuccessResponse<'card:list'>('id', []);
        const error = createErrorResponse('id');

        expect(isSuccessResponse(success)).toBe(true);
        expect(isSuccessResponse(error)).toBe(false);
      });
    });

    describe('isErrorResponse', () => {
      it('should narrow error responses', () => {
        const success = createSuccessResponse<'card:list'>('id', []);
        const error = createErrorResponse('id');

        expect(isErrorResponse(error)).toBe(true);
        expect(isErrorResponse(success)).toBe(false);
      });
    });
  });

  describe('Default configuration', () => {
    it('should have expected defaults', () => {
      expect(DEFAULT_WORKER_CONFIG.timeout).toBe(30_000);
      expect(DEFAULT_WORKER_CONFIG.debug).toBe(false);
    });
  });

  describe('Payload type safety', () => {
    // These tests verify TypeScript type inference at runtime
    // by checking that the payload shapes match expectations

    it('card:create payload should have input field', () => {
      const req = REQUEST_FIXTURES['card:create']();
      expect(req.payload).toHaveProperty('input');
      expect(req.payload.input).toHaveProperty('name');
    });

    it('card:get payload should have id field', () => {
      const req = REQUEST_FIXTURES['card:get']('test-id');
      expect(req.payload).toHaveProperty('id');
      expect(req.payload.id).toBe('test-id');
    });

    it('card:update payload should have id and updates fields', () => {
      const req = REQUEST_FIXTURES['card:update']('test-id');
      expect(req.payload).toHaveProperty('id');
      expect(req.payload).toHaveProperty('updates');
    });

    it('search:cards payload should have query field', () => {
      const req = REQUEST_FIXTURES['search:cards']('test query');
      expect(req.payload).toHaveProperty('query');
      expect(req.payload.query).toBe('test query');
    });

    it('graph:connected payload should have startId field', () => {
      const req = REQUEST_FIXTURES['graph:connected']('start');
      expect(req.payload).toHaveProperty('startId');
      expect(req.payload.startId).toBe('start');
    });

    it('graph:shortestPath payload should have fromId and toId fields', () => {
      const req = REQUEST_FIXTURES['graph:shortestPath']('from', 'to');
      expect(req.payload).toHaveProperty('fromId');
      expect(req.payload).toHaveProperty('toId');
      expect(req.payload.fromId).toBe('from');
      expect(req.payload.toId).toBe('to');
    });

    it('db:export payload should be empty object', () => {
      const req = REQUEST_FIXTURES['db:export']();
      expect(req.payload).toEqual({});
    });
  });
});

describe('Payload and Response type mapping', () => {
  // These compile-time tests ensure the type system is correctly wired.
  // If they fail to compile, the types are misaligned.

  it('should allow correct payload types (compile-time check)', () => {
    // This test exists to verify TypeScript accepts these assignments
    const _cardCreatePayload: WorkerPayloads['card:create'] = {
      input: { name: 'Test' },
    };

    const _cardGetPayload: WorkerPayloads['card:get'] = {
      id: 'test-id',
    };

    const _searchPayload: WorkerPayloads['search:cards'] = {
      query: 'test',
      limit: 10,
    };

    const _exportPayload: WorkerPayloads['db:export'] = {};

    // If this compiles, the types are correct
    expect(true).toBe(true);
  });

  it('should allow correct response types (compile-time check)', () => {
    // This test exists to verify TypeScript accepts these assignments
    const _cardCreateResponse: WorkerResponses['card:create'] = {
      id: 'test',
      card_type: 'note',
      name: 'Test',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: '2026-02-28T00:00:00.000Z',
      modified_at: '2026-02-28T00:00:00.000Z',
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
    };

    const _cardGetResponse: WorkerResponses['card:get'] = null;
    const _cardListResponse: WorkerResponses['card:list'] = [];
    const _searchResponse: WorkerResponses['search:cards'] = [];
    const _graphConnectedResponse: WorkerResponses['graph:connected'] = [];
    const _shortestPathResponse: WorkerResponses['graph:shortestPath'] = null;
    const _exportResponse: WorkerResponses['db:export'] = new Uint8Array();

    // If this compiles, the types are correct
    expect(true).toBe(true);
  });
});

describe('Worker Protocol - ETL Extensions', () => {
  describe('ETL_TIMEOUT constant', () => {
    it('should be 300 seconds (5 minutes)', () => {
      expect(ETL_TIMEOUT).toBe(300_000);
    });
  });

  describe('etl:import payload type', () => {
    it('should accept valid import payload', () => {
      const payload: WorkerPayloads['etl:import'] = {
        source: 'apple_notes',
        data: '{"files": []}',
        options: {
          isBulkImport: true,
          filename: 'notes-export',
        },
      };

      expect(payload.source).toBe('apple_notes');
      expect(payload.data).toBeDefined();
      expect(payload.options?.isBulkImport).toBe(true);
    });

    it('should accept all source types', () => {
      const sources: SourceType[] = [
        'apple_notes',
        'markdown',
        'excel',
        'csv',
        'json',
        'html',
      ];

      sources.forEach(source => {
        const payload: WorkerPayloads['etl:import'] = {
          source,
          data: '',
        };
        expect(payload.source).toBe(source);
      });
    });
  });

  describe('etl:export payload type', () => {
    it('should accept valid export payload', () => {
      const payload: WorkerPayloads['etl:export'] = {
        format: 'markdown',
        cardIds: ['card-1', 'card-2'],
      };

      expect(payload.format).toBe('markdown');
      expect(payload.cardIds).toHaveLength(2);
    });

    it('should accept export without cardIds filter', () => {
      const payload: WorkerPayloads['etl:export'] = {
        format: 'json',
      };

      expect(payload.cardIds).toBeUndefined();
    });
  });

  describe('etl:import response type', () => {
    it('should match ImportResult shape', () => {
      const response: WorkerResponses['etl:import'] = {
        inserted: 100,
        updated: 5,
        unchanged: 10,
        skipped: 2,
        errors: 1,
        connections_created: 50,
        insertedIds: ['id-1', 'id-2'],
        updatedIds: [],
        deletedIds: [],
        errors_detail: [{ index: 0, source_id: null, message: 'test error' }],
      };

      expect(response.inserted).toBe(100);
      expect(response.insertedIds).toContain('id-1');
      expect(response.errors_detail[0]?.message).toBe('test error');
    });
  });

  describe('etl:export response type', () => {
    it('should have data and filename', () => {
      const response: WorkerResponses['etl:export'] = {
        data: '# Exported content',
        filename: 'isometry-export-2026-03-01.md',
      };

      expect(response.data).toContain('Exported');
      expect(response.filename).toMatch(/\.md$/);
    });
  });
});

describe('Worker Protocol - Notification Types', () => {
  describe('isNotification type guard', () => {
    it('should return true for valid notification message', () => {
      const msg: WorkerNotification = {
        type: 'import_progress',
        payload: {
          processed: 100,
          total: 500,
          rate: 200,
          source: 'apple_notes',
          filename: 'notes.zip',
        },
      };

      expect(isNotification(msg)).toBe(true);
    });

    it('should return false for WorkerResponse', () => {
      const msg = { id: '123', success: true, data: {} };
      expect(isNotification(msg)).toBe(false);
    });

    it('should return false for ready message', () => {
      const msg = { type: 'ready', timestamp: 0 };
      expect(isNotification(msg)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNotification(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isNotification(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isNotification('import_progress')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isNotification(42)).toBe(false);
    });
  });

  describe('WorkerNotification type (compile-time check)', () => {
    it('should include ImportProgressPayload fields', () => {
      const payload: ImportProgressPayload = {
        processed: 50,
        total: 200,
        rate: 150,
        source: 'csv',
        filename: undefined,
      };

      const notification: WorkerNotification = {
        type: 'import_progress',
        payload,
      };

      expect(notification.type).toBe('import_progress');
      expect(notification.payload.processed).toBe(50);
      expect(notification.payload.total).toBe(200);
      expect(notification.payload.rate).toBe(150);
      expect(notification.payload.source).toBe('csv');
      expect(notification.payload.filename).toBeUndefined();
    });
  });
});
