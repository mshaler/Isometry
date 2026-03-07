// Isometry v5 — Phase 16 WorkerBridge SuperGrid Tests
// Tests for superGridQuery() rAF coalescing and distinctValues() typed wrapper.
//
// Test strategy:
//   - Mock requestAnimationFrame for manual rAF flush control
//   - Reuse MockWorker pattern from WorkerBridge.test.ts
//   - Verify single-query-per-frame contract (4 calls -> 1 postMessage)
//   - Verify latest-wins semantics (earlier callers silently abandoned)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellDatum, WorkerRequest } from '../../src/worker/protocol';
import { createErrorResponse, createReadyMessage, createSuccessResponse, wait } from './fixtures';

// ---------------------------------------------------------------------------
// rAF Mock — capture callbacks for manual flushing
// ---------------------------------------------------------------------------

let rafCallbacks: Array<FrameRequestCallback> = [];
let rafIdCounter = 1;

function mockRequestAnimationFrame(cb: FrameRequestCallback): number {
	rafCallbacks.push(cb);
	return rafIdCounter++;
}

function flushRAF(): void {
	const cbs = rafCallbacks.slice();
	rafCallbacks = [];
	cbs.forEach((cb) => cb(performance.now()));
}

vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);

// ---------------------------------------------------------------------------
// Mock Worker (same pattern as WorkerBridge.test.ts)
// ---------------------------------------------------------------------------

class MockWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	private messageHandler: ((data: WorkerRequest) => void) | null = null;

	constructor() {
		setTimeout(() => {
			this.simulateMessage(createReadyMessage());
		}, 0);
	}

	postMessage(data: WorkerRequest): void {
		if (this.messageHandler) {
			this.messageHandler(data);
		}
	}

	terminate(): void {
		this.onmessage = null;
		this.onerror = null;
		this.messageHandler = null;
	}

	simulateMessage(data: unknown): void {
		if (this.onmessage) {
			this.onmessage(new MessageEvent('message', { data }));
		}
	}

	setMessageHandler(handler: (data: WorkerRequest) => void): void {
		this.messageHandler = handler;
	}
}

vi.stubGlobal('Worker', MockWorker);

// Dynamic import after stubs are in place
const getModule = async () => {
	vi.resetModules();
	return import('../../src/worker/WorkerBridge');
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('WorkerBridge.superGridQuery()', () => {
	let createWorkerBridge: typeof import('../../src/worker/WorkerBridge').createWorkerBridge;

	beforeEach(async () => {
		rafCallbacks = [];
		rafIdCounter = 1;
		const module = await getModule();
		createWorkerBridge = module.createWorkerBridge;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	const sampleConfig = {
		colAxes: [{ field: 'status' as const, direction: 'asc' as const }],
		rowAxes: [{ field: 'folder' as const, direction: 'asc' as const }],
		where: '1=1',
		params: [],
	};

	it('returns CellDatum[] from Worker response', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		const expectedCells: CellDatum[] = [{ status: 'active', folder: 'Inbox', count: 3, card_ids: ['a', 'b', 'c'] }];

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			mockWorker.simulateMessage(createSuccessResponse<'supergrid:query'>(request.id, { cells: expectedCells }));
		});

		const promise = bridge.superGridQuery(sampleConfig);
		flushRAF();
		const result = await promise;

		expect(result).toEqual(expectedCells);
		bridge.terminate();
	});

	it('4 synchronous calls produce exactly 1 Worker postMessage', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		const postSpy = vi.spyOn(mockWorker, 'postMessage');

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			mockWorker.simulateMessage(createSuccessResponse<'supergrid:query'>(request.id, { cells: [] }));
		});

		// Fire 4 calls synchronously
		bridge.superGridQuery(sampleConfig);
		bridge.superGridQuery(sampleConfig);
		bridge.superGridQuery(sampleConfig);
		bridge.superGridQuery(sampleConfig);

		// Before rAF: zero postMessage calls (init postMessage already fired in constructor)
		// The init postMessage is for { type: 'init' }, so we filter for supergrid:query
		const superGridCalls = () =>
			postSpy.mock.calls.filter((call) => call[0] && (call[0] as WorkerRequest).type === 'supergrid:query');

		expect(superGridCalls()).toHaveLength(0);

		flushRAF();
		// send() awaits isReady (microtask) before posting — yield to let it resolve
		await Promise.resolve();

		// After rAF: exactly 1 postMessage with supergrid:query
		expect(superGridCalls()).toHaveLength(1);

		bridge.terminate();
	});

	it('latest-wins: only 4th caller resolves; first 3 are abandoned', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		const expectedCells: CellDatum[] = [{ status: 'done', count: 1, card_ids: ['z'] }];

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			mockWorker.simulateMessage(createSuccessResponse<'supergrid:query'>(request.id, { cells: expectedCells }));
		});

		const p1 = bridge.superGridQuery(sampleConfig);
		const p2 = bridge.superGridQuery(sampleConfig);
		const p3 = bridge.superGridQuery(sampleConfig);
		const p4 = bridge.superGridQuery(sampleConfig);

		flushRAF();

		// 4th promise resolves with data
		const result4 = await p4;
		expect(result4).toEqual(expectedCells);

		// 1st-3rd promises should never settle (silently abandoned)
		// Verify by racing against a short timeout
		const TIMEOUT_MS = 50;
		const timedOut = Symbol('timedOut');
		const raceResult1 = await Promise.race([p1, wait(TIMEOUT_MS).then(() => timedOut)]);
		const raceResult2 = await Promise.race([p2, wait(TIMEOUT_MS).then(() => timedOut)]);
		const raceResult3 = await Promise.race([p3, wait(TIMEOUT_MS).then(() => timedOut)]);

		expect(raceResult1).toBe(timedOut);
		expect(raceResult2).toBe(timedOut);
		expect(raceResult3).toBe(timedOut);

		bridge.terminate();
	});

	it('error propagation: Worker error rejects latest promise', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			mockWorker.simulateMessage(
				createErrorResponse(request.id, {
					code: 'INVALID_REQUEST',
					message: 'Invalid axis field: bad_field',
				}),
			);
		});

		const promise = bridge.superGridQuery(sampleConfig);
		flushRAF();

		await expect(promise).rejects.toThrow('Invalid axis field: bad_field');

		bridge.terminate();
	});
});

describe('WorkerBridge.distinctValues()', () => {
	let createWorkerBridge: typeof import('../../src/worker/WorkerBridge').createWorkerBridge;

	beforeEach(async () => {
		rafCallbacks = [];
		rafIdCounter = 1;
		const module = await getModule();
		createWorkerBridge = module.createWorkerBridge;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns string[] from Worker response', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		const expectedValues = ['Archive', 'Inbox', 'Projects'];

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			mockWorker.simulateMessage(createSuccessResponse<'db:distinct-values'>(request.id, { values: expectedValues }));
		});

		const result = await bridge.distinctValues('folder');
		expect(result).toEqual(expectedValues);

		bridge.terminate();
	});

	it('forwards WHERE + params in payload', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		let capturedPayload: unknown = null;

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			capturedPayload = request.payload;
			mockWorker.simulateMessage(createSuccessResponse<'db:distinct-values'>(request.id, { values: ['active'] }));
		});

		await bridge.distinctValues('status', 'folder = ?', ['Inbox']);

		expect(capturedPayload).toEqual({
			column: 'status',
			where: 'folder = ?',
			params: ['Inbox'],
		});

		bridge.terminate();
	});

	it('omits where and params when not provided', async () => {
		const bridge = createWorkerBridge();
		await bridge.isReady;

		const mockWorker = (bridge as unknown as { worker: MockWorker }).worker;
		let capturedPayload: unknown = null;

		mockWorker.setMessageHandler((request: WorkerRequest) => {
			capturedPayload = request.payload;
			mockWorker.simulateMessage(createSuccessResponse<'db:distinct-values'>(request.id, { values: [] }));
		});

		await bridge.distinctValues('folder');

		// Should only have { column: 'folder' } — no where or params keys
		expect(capturedPayload).toEqual({ column: 'folder' });
		expect(capturedPayload).not.toHaveProperty('where');
		expect(capturedPayload).not.toHaveProperty('params');

		bridge.terminate();
	});
});
